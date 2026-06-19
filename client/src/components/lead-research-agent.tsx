import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, UserPlus, Check, Linkedin, Mail, Phone, Megaphone, PenLine, Copy, Trash2, ListPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProspectIntel {
  fitScore: number;
  intentScore: number;
  composite: number;
  tier: "hot" | "warm" | "cool" | "low";
  audience: "investor" | "partner" | "unknown";
  reasons: string[];
  explanation: string;
}

interface AgentPerson {
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  contactLocation: string | null;
  companyLocation: string | null;
  seniority: string | null;
  department: string | null;
  industries: string[] | null;
  website: string | null;
  searchResultId?: string | null;
  intel?: ProspectIntel;
  inCrm?: boolean;
}

const TIER_STYLE: Record<string, string> = {
  hot: "border-red-200 bg-red-50 text-red-700",
  warm: "border-amber-200 bg-amber-50 text-amber-700",
  cool: "border-sky-200 bg-sky-50 text-sky-700",
  low: "border-gray-200 bg-gray-50 text-gray-500",
};
const TIER_LABEL: Record<string, string> = { hot: "🔥 Hot", warm: "Warm", cool: "Cool", low: "Low fit" };

const cell = (value?: string | null) => value?.trim() || "—";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  people?: AgentPerson[];
}

const SUGGESTIONS = [
  "Find immigration attorneys in the US who work with international investors",
  "Build a list of business owners in the UK exploring US investment",
  "Who should I target for the E-2 franchise? Analyze our ICP",
  "Find investors in Japan and South Korea, titles CEO or Owner",
];

// Stable per-person key used for selection / added tracking.
const keyOf = (p: AgentPerson) => (p.email || p.fullName).toLowerCase();

// Map an agent person onto the add-to-contacts payload shape (used by the
// campaign-enrollment path, which still works off the `contacts` table).
const toContactBody = (p: AgentPerson) => ({
  fullName: p.fullName, firstName: p.firstName, lastName: p.lastName,
  companyName: p.companyName || "", email: p.email, phone: p.phone,
  linkedinUrl: p.linkedinUrl, jobTitle: p.jobTitle, country: p.contactLocation || p.companyLocation, bio: null,
  searchResultId: p.searchResultId ?? null,
});

// Map an agent person onto the crm_clients payload shape — "Add to CRM" creates
// a CRM client (the main CRM tab) so the lead gets the full profile (enrich,
// email, SMS, documents…). Investor-only fields stay blank; leadSource + tag
// mark it as Lead Research so it's filterable in the pipeline.
const toClientBody = (p: AgentPerson) => ({
  fullName: p.fullName,
  email: p.email || "",
  phone: p.phone || undefined,
  country: p.contactLocation || p.companyLocation || undefined,
  companyName: p.companyName || undefined,
  profession: p.jobTitle || undefined,
  linkedinUrl: p.linkedinUrl || undefined,
  leadSource: "ai_research",
  status: "new",
  tags: ["lead-research"],
  searchResultId: p.searchResultId ?? null,
});

// Pull the human-readable message out of an apiRequest error ("<status>: <json>").
function apiErrorMessage(err: any, fallback: string): string {
  const raw = String(err?.message || "");
  const body = raw.replace(/^\d+:\s*/, "");
  try {
    const j = JSON.parse(body);
    if (j?.message) return j.message as string;
  } catch { /* not JSON */ }
  return body || fallback;
}

// A single agent turn returns up to this many unique people (mirrors the server's
// `.slice(0, …)` in runLeadResearchAgent). Used for the pre-search credit estimate.
const MAX_RESULTS = 500;

// Results table page size — long result sets are paged client-side so the user
// can step through all of them ("page 2, 3 …") instead of one capped scroll.
const PAGE_SIZE = 25;

// A CRM list ("Add to list" target). Mirrors GET /api/crm/lists.
interface LeadList { id: string; name: string; count?: number }

// Compact page list for the pager: 1 … (p-1) p (p+1) … N (no ellipsis ≤ 7 pages).
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(total - 1, current + 1);
  if (lo > 2) out.push("…");
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < total - 1) out.push("…");
  out.push(total);
  return out;
}

type LeadProviderId = "seamless" | "apollo" | "origami";

const PROVIDER_LABELS: Record<LeadProviderId, string> = {
  seamless: "Seamless.AI",
  apollo: "Apollo.io",
  origami: "Origami",
};

function normalizeProviderId(raw?: string): LeadProviderId {
  const r = (raw || "").toLowerCase().trim();
  if (r === "apollo" || r === "apollo.io" || r.startsWith("apollo")) return "apollo";
  if (r === "origami") return "origami";
  return "seamless";
}

type DraftEntry = { channel: string; subject: string | null; body: string };

const GREETING: ChatMsg = {
  role: "assistant",
  content: "Hi — I'm your Lead Research assistant. Describe who you want to reach and I'll build the list, analyze your ideal customer profile, or draft outreach. What are we looking for?",
};

// The conversation + results live only in component state, so leaving the panel
// (CRM tab, etc.) used to wipe them. Persist to sessionStorage so they survive
// unmount/remount and reloads within the tab session. Bump the key whenever the
// persisted shape changes so stale payloads are ignored rather than mis-read.
const storeKeyFor = (provider: LeadProviderId) => `nd_lead_agent_v4_${provider}`;
const SKIP_CREDIT_KEY = "nd_lead_agent_skip_credit_note";

interface PersistedState {
  messages: ChatMsg[];
  added: string[];
  enrolled: [string, string][];
  drafts: [string, DraftEntry][];
}
function loadAgentState(provider: LeadProviderId): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(storeKeyFor(provider));
    if (!raw) return null;
    const p = JSON.parse(raw);
    // Validate the shape before trusting it — a wrong-shape payload (e.g. from a
    // future version) would otherwise crash `new Map()`/`new Set()` at render.
    if (!p || !Array.isArray(p.messages)) return null;
    return {
      messages: p.messages,
      added: Array.isArray(p.added) ? p.added.filter((x: unknown) => typeof x === "string") : [],
      enrolled: Array.isArray(p.enrolled) ? p.enrolled.filter(isPair) : [],
      drafts: Array.isArray(p.drafts) ? p.drafts.filter((e: unknown) => Array.isArray(e) && typeof e[0] === "string" && e[1]) : [],
    };
  } catch {
    return null;
  }
}
function isPair(x: unknown): x is [string, string] {
  return Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "string";
}
function saveAgentState(provider: LeadProviderId, s: PersistedState) {
  try {
    sessionStorage.setItem(storeKeyFor(provider), JSON.stringify(s));
  } catch {
    /* sessionStorage unavailable / over quota — non-fatal */
  }
}

export default function LeadResearchAgent({ provider: providerProp }: { provider: string }) {
  const provider = normalizeProviderId(providerProp);
  const providerLabel = PROVIDER_LABELS[provider];
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const providerRef = useRef(provider);
  providerRef.current = provider;
  // Restore the prior conversation/results once (sessionStorage) so switching
  // tabs and coming back doesn't wipe them. Guarded so the parse runs once, not
  // on every render (useRef evaluates its argument eagerly each render).
  const restoredRef = useRef<PersistedState | null | undefined>(undefined);
  if (restoredRef.current === undefined) restoredRef.current = loadAgentState(provider);
  const restored = restoredRef.current;
  const [messages, setMessages] = useState<ChatMsg[]>(
    () => (restored?.messages?.length ? restored.messages : [GREETING]),
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(() => new Set(restored?.added ?? []));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [listAdding, setListAdding] = useState(false);
  const [lists, setLists] = useState<LeadList[]>([]);
  // Current page per results block, keyed by the message index it belongs to.
  const [pageByMsg, setPageByMsg] = useState<Map<number, number>>(new Map());
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [enrollOpenFor, setEnrollOpenFor] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<Map<string, string>>(() => new Map(restored?.enrolled ?? []));
  const [drafting, setDrafting] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Map<string, DraftEntry>>(() => new Map(restored?.drafts ?? []));
  // Live Seamless credit balance + the pre-search "what will this cost" dialog.
  const [credits, setCredits] = useState<number | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  const [skipCreditNote, setSkipCreditNote] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    apiRequest("GET", "/api/crm/campaigns")
      .then((r) => r.json())
      .then((rows: any[]) => setCampaigns((rows || []).map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

  // CRM lists for the "Add to list" picker. Refetched after we create one.
  function refreshLists() {
    apiRequest("GET", "/api/crm/lists")
      .then((r) => r.json())
      .then((rows: any[]) => setLists((rows || []).map((l) => ({ id: l.id, name: l.name, count: l.count }))))
      .catch(() => {});
  }
  useEffect(() => { refreshLists(); }, []);

  // Persist conversation + results + which were added/enrolled + any drafts, so
  // leaving the panel and returning restores them instead of resetting. (selected
  // is intentionally transient and resets on return.)
  useEffect(() => {
    saveAgentState(provider, {
      messages,
      added: Array.from(added),
      enrolled: Array.from(enrolled.entries()),
      drafts: Array.from(drafts.entries()),
    });
  }, [provider, messages, added, enrolled, drafts]);

  // Live Seamless credit balance for the pre-search estimate; also read whether
  // the user has dismissed the estimate dialog.
  useEffect(() => {
    try { setSkipCreditNote(localStorage.getItem(SKIP_CREDIT_KEY) === "1"); } catch { /* ignore */ }
    apiRequest("GET", "/api/crm/prospects/provider-status")
      .then((r) => r.json())
      .then((d: { providers?: { id: string; credits: number | null }[] }) => {
        const p = (d.providers || []).find((x) => x.id === provider);
        if (p && typeof p.credits === "number") setCredits(p.credits);
      })
      .catch(() => {});
  }, [provider]);

  // After adding, refetch the CRM tab so new rows show up immediately. The lists
  // use staleTime:Infinity, so without this they keep serving a cached list and
  // the new lead appears "missing" until a manual refresh.
  function refreshCrm() {
    queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] }); // CRM tab list
    queryClient.invalidateQueries({ queryKey: ["/api/crm/client-tags"] }); // tag filters
    queryClient.invalidateQueries({ queryKey: ["/api/contacts"] }); // enrollment/contacts views
    queryClient.invalidateQueries({ queryKey: ["/api/crm/reports"] }); // dashboard counts
  }

  // A person is non-addable if we've added them this session OR the server says
  // they're already in the CRM (inCrm) — so the UI doesn't offer to re-add them.
  const isInCrm = (p: AgentPerson) => added.has(keyOf(p)) || !!p.inCrm;

  // Reset the conversation, results, and persisted session state.
  function clearChat() {
    setMessages([GREETING]);
    setAdded(new Set());
    setSelected(new Set());
    setEnrolled(new Map());
    setDrafts(new Map());
    setPageByMsg(new Map());
    setInput("");
    try { sessionStorage.removeItem(storeKeyFor(provider)); } catch { /* ignore */ }
  }

  // Ensure the agent-found person exists as a CRM contact; returns the id.
  async function ensureContact(p: AgentPerson): Promise<string | null> {
    const res = await fetch("/api/crm/prospects/add-to-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ contact: toContactBody(p), category: "ai_research" }),
    });
    if (res.ok) { refreshCrm(); return (await res.json())?.id ?? null; }
    if (res.status === 409) return (await res.json())?.existing?.id ?? null;
    return null;
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const history: ChatMsg[] = [...messages, { role: "user", content: msg }];
    setMessages(history);
    setLoading(true);
    try {
      const activeProvider = providerRef.current;
      const res = await apiRequest("POST", "/api/crm/lead-research/agent", {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        provider: activeProvider,
      });
      const data = await res.json() as { reply: string; people?: AgentPerson[]; provider?: string };
      const people = data.people || [];
      // Re-addable after deletion: the server re-checks the CRM on every search,
      // so if it now says a person is NOT in the CRM (e.g. you deleted them),
      // drop any stale session "added" mark so the Add button comes back.
      setAdded((prev) => {
        if (!people.length) return prev;
        let changed = false;
        const next = new Set(prev);
        for (const p of people) if (!p.inCrm && next.delete(keyOf(p))) changed = true;
        return changed ? next : prev;
      });
      const usedProvider = normalizeProviderId(data.provider ?? activeProvider);
      const prefix = usedProvider !== activeProvider
        ? `[via ${PROVIDER_LABELS[usedProvider]}] `
        : "";
      setMessages((prev) => [...prev, { role: "assistant", content: `${prefix}${data.reply || "Done."}`, people }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry — I couldn't reach the AI service. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  // Gate sending behind the credit-estimate dialog (unless dismissed). Searching
  // is free; the dialog explains what revealing the results would later cost.
  function requestSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    if (skipCreditNote) { void send(msg); return; }
    setConfirmMsg(msg);
  }

  function confirmSend(dontAskAgain: boolean) {
    const msg = confirmMsg;
    setConfirmMsg(null);
    if (dontAskAgain) {
      setSkipCreditNote(true);
      try { localStorage.setItem(SKIP_CREDIT_KEY, "1"); } catch { /* ignore */ }
    }
    if (msg) void send(msg);
  }

  async function addToCrm(p: AgentPerson) {
    const key = keyOf(p);
    try {
      const res = await apiRequest("POST", "/api/crm/clients", toClientBody(p));
      const saved = await res.json().catch(() => null);
      setAdded((s) => new Set(s).add(key));
      refreshCrm();
      const gotContact = !!(saved?.email || saved?.phone);
      toast({
        title: "Added to CRM",
        description: gotContact
          ? `${p.fullName} added & enriched — email/phone revealed via ${providerLabel}.`
          : `${p.fullName} added. ${providerLabel} had no email/phone on file for them.`,
      });
    } catch (err: any) {
      const m = String(err?.message || "");
      if (m.includes("already exists") || m.includes("409")) {
        setAdded((s) => new Set(s).add(key));
        toast({ title: "Already in CRM", description: p.fullName });
      } else {
        toast({ title: "Couldn't add to CRM", description: apiErrorMessage(err, p.fullName), variant: "destructive" });
      }
    }
  }

  // Toggle one person's selection.
  function toggleSelect(p: AgentPerson) {
    const key = keyOf(p);
    setSelected((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Select / deselect every not-yet-added person in a result list.
  function toggleSelectAll(people: AgentPerson[]) {
    const selectable = people.filter((p) => !isInCrm(p)).map(keyOf);
    const allOn = selectable.length > 0 && selectable.every((k) => selected.has(k));
    setSelected((s) => {
      const next = new Set(s);
      if (allOn) selectable.forEach((k) => next.delete(k));
      else selectable.forEach((k) => next.add(k));
      return next;
    });
  }

  // Add every selected (and not-yet-added) person in a result list at once.
  async function addSelected(people: AgentPerson[]) {
    const targets = people.filter((p) => selected.has(keyOf(p)) && !isInCrm(p));
    if (targets.length === 0) {
      toast({ title: "Nothing selected", description: "Tick the contacts you want to add first." });
      return;
    }
    setBulkAdding(true);
    try {
      const res = await apiRequest("POST", "/api/crm/clients/bulk-add", {
        contacts: targets.map(toContactBody),
        leadSource: "ai_research",
        tags: ["lead-research"],
      });
      const data = (await res.json()) as { added: number; skipped: number; enriched?: number };
      setAdded((s) => {
        const next = new Set(s);
        targets.forEach((p) => next.add(keyOf(p)));
        return next;
      });
      setSelected((s) => {
        const next = new Set(s);
        targets.forEach((p) => next.delete(keyOf(p)));
        return next;
      });
      refreshCrm();
      const parts = [
        data.enriched ? `${data.enriched} enriched via ${providerLabel}` : null,
        data.skipped > 0 ? `${data.skipped} already in your CRM` : null,
      ].filter(Boolean);
      toast({
        title: `${data.added} added to the CRM tab`,
        description: parts.length > 0 ? parts.join(" · ") : `${data.added} new lead${data.added === 1 ? "" : "s"} saved — open a profile to message.`,
      });
    } catch (err: any) {
      toast({ title: "Couldn't add to CRM", description: apiErrorMessage(err, "Please try again."), variant: "destructive" });
    } finally {
      setBulkAdding(false);
    }
  }

  // Add the selected (not-yet-added) people to the CRM AND drop them into a list —
  // either an existing one or a new one created on the fly. Membership references
  // crm_clients, so this adds them to the CRM first (which reveals email/phone and
  // therefore spends ~1 credit per contact, exactly like "Add to CRM").
  async function addSelectedToList(people: AgentPerson[], target: { listId?: string; newName?: string }) {
    const targets = people.filter((p) => selected.has(keyOf(p)) && !isInCrm(p));
    if (targets.length === 0) {
      toast({ title: "Nothing selected", description: "Tick the contacts you want to add first." });
      return;
    }
    setListAdding(true);
    try {
      // 1) Add to the CRM (reveals + dedups) and collect the created client ids.
      const addRes = await apiRequest("POST", "/api/crm/clients/bulk-add", {
        contacts: targets.map(toContactBody),
        leadSource: "ai_research",
        tags: ["lead-research"],
      });
      const addData = (await addRes.json()) as { added: number; skipped: number; clients?: { id: string }[] };
      const clientIds = (addData.clients || []).map((c) => c.id).filter(Boolean);

      // 2) Resolve the target list — create it when the user typed a new name.
      let listId = target.listId || "";
      let listName = lists.find((l) => l.id === listId)?.name || target.newName || "list";
      if (!listId) {
        const name = (target.newName || "").trim();
        if (!name) throw new Error("List name is required");
        const created = await apiRequest("POST", "/api/crm/lists", { name });
        const list = await created.json();
        listId = list.id;
        listName = list.name || name;
      }

      // 3) Drop the freshly-added clients into the list.
      let inList = 0;
      if (clientIds.length) {
        const memRes = await apiRequest("POST", `/api/crm/lists/${listId}/members`, { clientIds });
        inList = ((await memRes.json()) as { added?: number }).added ?? clientIds.length;
      }

      setAdded((s) => {
        const next = new Set(s);
        targets.forEach((p) => next.add(keyOf(p)));
        return next;
      });
      setSelected((s) => {
        const next = new Set(s);
        targets.forEach((p) => next.delete(keyOf(p)));
        return next;
      });
      refreshCrm();
      refreshLists();
      // The list mirrors into a prospect_list so campaigns can target it — refresh
      // those caches too (global staleTime is Infinity).
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospects"] });

      const extra = addData.skipped > 0 ? ` · ${addData.skipped} already in your CRM` : "";
      toast({
        title: `Added to "${listName}"`,
        description: `${addData.added} added to the CRM, ${inList} placed in the list${extra}.`,
      });
    } catch (err: any) {
      toast({ title: "Couldn't add to list", description: apiErrorMessage(err, "Please try again."), variant: "destructive" });
    } finally {
      setListAdding(false);
    }
  }

  async function draftOutreach(p: AgentPerson, channel: "email" | "linkedin") {
    const key = (p.email || p.fullName).toLowerCase();
    setDrafting(key);
    try {
      const res = await apiRequest("POST", "/api/crm/lead-research/draft-outreach", {
        fullName: p.fullName, firstName: p.firstName, jobTitle: p.jobTitle,
        companyName: p.companyName, country: p.contactLocation || p.companyLocation, channel,
        audience: p.intel?.audience, reasons: p.intel?.reasons, explanation: p.intel?.explanation,
      });
      const d = await res.json() as { channel: string; subject: string | null; body: string };
      setDrafts((m) => new Map(m).set(key, d));
    } catch {
      toast({ title: "Couldn't draft outreach", description: p.fullName, variant: "destructive" });
    } finally {
      setDrafting(null);
    }
  }

  async function enroll(p: AgentPerson, campaignId: string, campaignName: string) {
    const key = (p.email || p.fullName).toLowerCase();
    setEnrolling(key);
    try {
      const contactId = await ensureContact(p);
      if (!contactId) throw new Error("contact");
      const res = await apiRequest("POST", "/api/crm/enrollments/from-contacts", {
        campaignId,
        contactIds: [`contact:${contactId}`],
      });
      await res.json();
      setAdded((s) => new Set(s).add(key)); // it's now a contact too
      setEnrolled((m) => new Map(m).set(key, campaignName));
      setEnrollOpenFor(null);
      toast({ title: "Enrolled", description: `${p.fullName} → ${campaignName}` });
    } catch {
      toast({ title: "Couldn't enroll", description: p.fullName, variant: "destructive" });
    } finally {
      setEnrolling(null);
    }
  }

  return (
    <>
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-gradient-to-r from-[hsl(var(--primary))]/10 to-purple-500/10 px-4 py-3">
        <Sparkles className="size-4 text-[hsl(var(--primary))]" />
        <div>
          <p className="text-sm font-semibold leading-tight">AI Lead Research</p>
          <p className="text-[11px] text-muted-foreground">
            Searching via <span className="font-medium text-foreground">{providerLabel}</span> — build lists, analyze ICP, draft outreach.
          </p>
        </div>
        {messages.length > 1 && (
          <button
            data-testid="button-clear-chat"
            onClick={clearChat}
            title="Clear the conversation and start over"
            className="ml-auto shrink-0 flex items-center gap-1 rounded-md border bg-background/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          >
            <Trash2 className="size-3" /> Clear
          </button>
        )}
      </div>

      <div ref={scrollRef} className="max-h-[520px] overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "assistant" && m.people?.length ? "space-y-2" : ""}>
            <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-[hsl(var(--primary))] text-white" : "bg-muted text-foreground"}`}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
            </div>
            {m.role === "assistant" && m.people && m.people.length > 0 && (() => {
              const people = m.people;
              const selectable = people.filter((pp) => !isInCrm(pp));
              const selectedCount = selectable.filter((pp) => selected.has(keyOf(pp))).length;
              const allSelected = selectable.length > 0 && selectedCount === selectable.length;
              // Client-side pagination of this result set.
              const totalPages = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
              const page = Math.min(pageByMsg.get(i) ?? 1, totalPages);
              const pageStart = (page - 1) * PAGE_SIZE;
              const pagePeople = people.slice(pageStart, pageStart + PAGE_SIZE);
              const setPage = (p: number) => setPageByMsg((prev) => {
                const next = new Map(prev);
                next.set(i, Math.min(Math.max(1, p), totalPages));
                return next;
              });
              return (
                <div className="w-full rounded-xl border bg-card shadow-sm overflow-hidden" data-testid="agent-results-table">
                  <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                    <p className="text-[11px] font-semibold text-foreground">
                      {people.length} result{people.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-foreground">
                        <input
                          type="checkbox"
                          className="size-3.5 accent-[hsl(var(--primary))]"
                          checked={allSelected}
                          disabled={selectable.length === 0}
                          onChange={() => toggleSelectAll(people)}
                        />
                        Select all ({selectable.length})
                      </label>
                      <Button
                        size="sm"
                        className="h-7 gap-1 px-2 text-[11px]"
                        disabled={selectedCount === 0 || bulkAdding || listAdding}
                        onClick={() => addSelected(people)}
                      >
                        {bulkAdding ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}
                        Add {selectedCount > 0 ? `${selectedCount} ` : ""}to CRM
                      </Button>
                      <AddToListMenu
                        lists={lists}
                        count={selectedCount}
                        busy={listAdding}
                        disabled={selectedCount === 0 || bulkAdding}
                        onRefresh={refreshLists}
                        onPick={(target) => addSelectedToList(people, target)}
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[960px] text-xs whitespace-nowrap">
                      <thead className="border-b bg-muted/30">
                        <tr className="[&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium [&>th]:text-muted-foreground">
                          <th className="w-8" />
                          <th>Name</th>
                          <th>Title</th>
                          <th>Company</th>
                          <th>Contact Location</th>
                          <th>Company Location</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>LinkedIn</th>
                          <th>Seniority</th>
                          <th>Department</th>
                          <th>Industries</th>
                          <th>Website</th>
                          <th>Fit</th>
                          <th className="sticky right-0 bg-muted/30">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagePeople.map((p) => {
                          const key = keyOf(p);
                          const isAdded = isInCrm(p);
                          const enrolledIn = enrolled.get(key);
                          const pickerOpen = enrollOpenFor === key;
                          return (
                            <tr key={key} className="border-b last:border-0 hover:bg-muted/20 [&>td]:px-2.5 [&>td]:py-1.5 align-top">
                              <td>
                                {!isAdded && (
                                  <input
                                    type="checkbox"
                                    className="size-3.5 accent-[hsl(var(--primary))]"
                                    checked={selected.has(key)}
                                    onChange={() => toggleSelect(p)}
                                    aria-label={`Select ${p.fullName}`}
                                  />
                                )}
                              </td>
                              <td>
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-1 font-medium text-foreground">
                                    <span>{p.fullName}</span>
                                    {p.inCrm && <span className="rounded-full border border-violet-200 bg-violet-50 px-1 py-0 text-[9px] font-medium text-violet-700">In CRM</span>}
                                  </div>
                                  {p.intel?.reasons?.length ? (
                                    <span className="max-w-[180px] truncate text-[10px] text-muted-foreground" title={p.intel.reasons.join(" · ")}>
                                      {p.intel.reasons.slice(0, 2).join(" · ")}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="max-w-[160px] truncate" title={p.jobTitle || ""}>{cell(p.jobTitle)}</td>
                              <td className="font-medium text-foreground">{cell(p.companyName)}</td>
                              <td>{cell(p.contactLocation)}</td>
                              <td>{cell(p.companyLocation)}</td>
                              <td>
                                {p.email ? (
                                  <span className="inline-flex items-center gap-0.5 text-foreground"><Mail className="size-2.5 shrink-0" />{p.email}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td>
                                {p.phone ? (
                                  <span className="inline-flex items-center gap-0.5 text-foreground"><Phone className="size-2.5 shrink-0" />{p.phone}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td>
                                {p.linkedinUrl ? (
                                  <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">
                                    <Linkedin className="size-2.5" /> Profile
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td>{cell(p.seniority)}</td>
                              <td>{cell(p.department)}</td>
                              <td className="max-w-[140px] truncate" title={(p.industries || []).join(", ")}>{cell(p.industries?.join(", "))}</td>
                              <td>
                                {p.website ? (
                                  <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.website.replace(/^https?:\/\//, "")}</a>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td>
                                {p.intel ? (
                                  <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${TIER_STYLE[p.intel.tier]}`} title={`Fit ${p.intel.fitScore} · Intent ${p.intel.intentScore}`}>
                                    {TIER_LABEL[p.intel.tier]} {p.intel.composite}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="sticky right-0 bg-card">
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant={isAdded ? "outline" : "default"} className="h-7 gap-1 px-2 text-[11px]" disabled={isAdded} onClick={() => addToCrm(p)}>
                                    {isAdded ? <><Check className="size-3" /> {added.has(key) ? "Added" : "In CRM"}</> : <><UserPlus className="size-3" /> Add</>}
                                  </Button>
                                  {enrolledIn ? (
                                    <span className="inline-flex items-center gap-0.5 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700"><Check className="size-2.5" /> Enrolled</span>
                                  ) : (
                                    <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" disabled={campaigns.length === 0 || enrolling === key} onClick={() => setEnrollOpenFor(pickerOpen ? null : key)}>
                                      {enrolling === key ? <Loader2 className="size-3 animate-spin" /> : <Megaphone className="size-3" />}
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={drafting === key} onClick={() => draftOutreach(p, "email")} title="Draft outreach">
                                    {drafting === key ? <Loader2 className="size-3 animate-spin" /> : <PenLine className="size-3" />}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2 text-[11px]">
                      <span className="text-muted-foreground">
                        {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, people.length)} of {people.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPage(page - 1)}
                          disabled={page <= 1}
                          className="inline-flex items-center gap-0.5 rounded border border-input px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                        >
                          <ChevronLeft className="size-3" /> Prev
                        </button>
                        {pageNumbers(page, totalPages).map((p, idx) =>
                          p === "…" ? (
                            <span key={`gap-${idx}`} className="px-1 text-muted-foreground">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setPage(p as number)}
                              className={`min-w-[1.5rem] rounded border px-1.5 py-0.5 ${p === page ? "border-primary bg-[hsl(var(--primary))] text-primary-foreground" : "border-input text-muted-foreground hover:text-foreground"}`}
                            >
                              {p}
                            </button>
                          ),
                        )}
                        <button
                          onClick={() => setPage(page + 1)}
                          disabled={page >= totalPages}
                          className="inline-flex items-center gap-0.5 rounded border border-input px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
                        >
                          Next <ChevronRight className="size-3" />
                        </button>
                      </div>
                    </div>
                  )}
                  {pagePeople.map((p) => {
                    const key = keyOf(p);
                    const enrolledIn = enrolled.get(key);
                    const pickerOpen = enrollOpenFor === key;
                    if (!drafts.has(key) && !(pickerOpen && !enrolledIn)) return null;
                    return (
                      <div key={`meta-${key}`} className="border-t bg-muted/20 px-3 py-2">
                        <p className="mb-1 text-[10px] font-semibold text-muted-foreground">{p.fullName}</p>
                        {drafts.has(key) && (() => {
                          const d = drafts.get(key)!;
                          const full = (d.subject ? `Subject: ${d.subject}\n\n` : "") + d.body;
                          return (
                            <div className="mb-2 rounded-md border bg-card p-2">
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{d.channel === "linkedin" ? "LinkedIn message" : "Email draft"}</span>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => draftOutreach(p, d.channel === "linkedin" ? "email" : "linkedin")} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground" title="Switch channel">
                                    {d.channel === "linkedin" ? "→ Email" : "→ LinkedIn"}
                                  </button>
                                  <button onClick={() => { navigator.clipboard?.writeText(full); toast({ title: "Copied draft" }); }} className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground" title="Copy">
                                    <Copy className="size-2.5" /> Copy
                                  </button>
                                </div>
                              </div>
                              {d.subject && <p className="mb-1 text-[11px] font-medium text-foreground">{d.subject}</p>}
                              <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/90">{d.body}</p>
                            </div>
                          );
                        })()}
                        {pickerOpen && !enrolledIn && (
                          <div className="flex flex-wrap gap-1">
                            {campaigns.length === 0 ? (
                              <span className="text-[10px] text-muted-foreground">No campaigns yet.</span>
                            ) : (
                              campaigns.map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => enroll(p, c.id, c.name)}
                                  disabled={enrolling === key}
                                  className="rounded-full border border-input px-2 py-0.5 text-[10px] text-foreground hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))] disabled:opacity-50"
                                >
                                  {c.name}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> Working on it…</span>
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => requestSend(s)} className="rounded-full border border-input px-2.5 py-1 text-[11px] text-muted-foreground hover:border-[hsl(var(--primary))] hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 border-t p-3">
        <textarea
          data-testid="input-lead-agent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); requestSend(); } }}
          rows={1}
          placeholder={`Describe who to find on ${providerLabel}…`}
          className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button size="sm" className="h-9 gap-1.5" disabled={!input.trim() || loading} onClick={() => requestSend()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
      </div>
      {confirmMsg !== null && (
        <CreditEstimateDialog
          credits={credits}
          providerLabel={providerLabel}
          onCancel={() => setConfirmMsg(null)}
          onConfirm={confirmSend}
        />
      )}
    </>
  );
}

// "Add to list" dropdown for the results header — pick an existing CRM list or
// type a new one. Self-contained state (open / search / new-name) so it lives
// happily inside the results-block render. Adding to a list also adds to the CRM.
function AddToListMenu({ lists, count, busy, disabled, onPick, onRefresh }: {
  lists: LeadList[];
  count: number;
  busy: boolean;
  disabled: boolean;
  onPick: (target: { listId?: string; newName?: string }) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  // Refresh the list set whenever the menu opens so newly-created lists show up.
  useEffect(() => { if (open) onRefresh(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = lists.filter((l) => !query.trim() || l.name.toLowerCase().includes(query.trim().toLowerCase()));
  const pick = (target: { listId?: string; newName?: string }) => {
    setOpen(false); setNewName(""); setQuery("");
    onPick(target);
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 px-2 text-[11px]"
        disabled={disabled || busy}
        onClick={() => setOpen((o) => !o)}
        title="Add the selected contacts to a CRM list (also adds them to the CRM)"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <ListPlus className="size-3" />}
        Add {count > 0 ? `${count} ` : ""}to list
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-1 w-64 rounded-lg border bg-popover p-2 shadow-md">
          <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Add to a list</p>
          {lists.length > 3 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lists…"
              className="mb-1 h-7 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          )}
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-1 py-1 text-[11px] text-muted-foreground">
                {lists.length === 0 ? "No lists yet — create one below." : "No match."}
              </p>
            ) : (
              filtered.map((l) => (
                <button
                  key={l.id}
                  onClick={() => pick({ listId: l.id })}
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted"
                >
                  <span className="truncate text-foreground">{l.name}</span>
                  {typeof l.count === "number" && <span className="shrink-0 text-[10px] text-muted-foreground">{l.count}</span>}
                </button>
              ))
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 border-t pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) pick({ newName: newName.trim() }); }}
              placeholder="New list name…"
              className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" disabled={!newName.trim()} onClick={() => pick({ newName: newName.trim() })}>
              <Plus className="size-3" /> Create
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[10px] leading-snug text-muted-foreground">
            Also adds them to the CRM — reveals email &amp; phone (~1 credit each).
          </p>
        </div>
      )}
    </div>
  );
}

// Pre-send dialog. The assistant also answers free intents (analyze ICP, search
// our own CRM, draft outreach), so the copy is intent-agnostic: it confirms that
// building a list is free and estimates what REVEALING the results would later
// cost (~1 credit/contact), and shows the live balance.
function CreditEstimateDialog({ credits, providerLabel, onCancel, onConfirm }: {
  credits: number | null;
  providerLabel: string;
  onCancel: () => void;
  onConfirm: (dontAskAgain: boolean) => void;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-[hsl(var(--primary))]" />
          <h3 className="text-sm font-semibold">Send to Lead Research?</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Searching, building a list, analyzing your ICP, and drafting are <span className="font-semibold text-foreground">free</span> — they don't use any credits.
        </p>
        <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Adding all results to the CRM</span>
            <span className="font-semibold text-foreground">up to ~{MAX_RESULTS} credits</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Search results come without email or phone. Revealing a contact's email &amp; phone is what
            uses credits (about <span className="font-medium text-foreground">1 each</span>), and that
            happens when you add them to your CRM or a list. Browsing and paging the results costs nothing.
          </p>
          {credits != null && (
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground">{providerLabel} balance</span>
              <span className="font-semibold text-foreground">{credits.toLocaleString()} credits</span>
            </div>
          )}
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5 accent-[hsl(var(--primary))]"
            checked={dontAsk}
            onChange={(e) => setDontAsk(e.target.checked)}
          />
          Don't remind me again
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" className="h-8" onClick={onCancel}>Cancel</Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => onConfirm(dontAsk)}>
            <Send className="size-3.5" /> Send
          </Button>
        </div>
      </div>
    </div>
  );
}
