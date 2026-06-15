import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, UserPlus, Check, Linkedin, Mail, Phone, Megaphone, PenLine, Copy } from "lucide-react";
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
  location: string | null;
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

// Map an agent person onto the add-to-contacts payload shape.
const toContactBody = (p: AgentPerson) => ({
  fullName: p.fullName, firstName: p.firstName, lastName: p.lastName,
  companyName: p.companyName || "", email: p.email, phone: p.phone,
  linkedinUrl: p.linkedinUrl, jobTitle: p.jobTitle, country: p.location, bio: null,
});

export default function LeadResearchAgent({ provider }: { provider?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hi — I'm your Lead Research assistant. Describe who you want to reach and I'll build the list, analyze your ideal customer profile, or draft outreach. What are we looking for?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [enrollOpenFor, setEnrollOpenFor] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState<Map<string, string>>(new Map());
  const [drafting, setDrafting] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Map<string, { channel: string; subject: string | null; body: string }>>(new Map());
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

  // After adding contact(s), refetch the CRM tab so they show up immediately.
  // The contacts list query uses staleTime:Infinity, so without this it keeps
  // serving a cached list and the new contact appears "missing" until refresh.
  function refreshCrm() {
    queryClient.invalidateQueries({ queryKey: ["/api/contacts"] }); // CRM Contacts tab list
    queryClient.invalidateQueries({ queryKey: ["/api/crm/reports"] }); // dashboard counts
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
      const res = await apiRequest("POST", "/api/crm/lead-research/agent", {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        provider,
      });
      const data = await res.json() as { reply: string; people?: AgentPerson[] };
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Done.", people: data.people || [] }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry — I couldn't reach the AI service. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function addToContacts(p: AgentPerson) {
    const key = keyOf(p);
    try {
      await apiRequest("POST", "/api/crm/prospects/add-to-contacts", {
        contact: toContactBody(p),
        category: "ai_research",
      });
      setAdded((s) => new Set(s).add(key));
      refreshCrm();
      toast({ title: "Added to Contacts", description: `${p.fullName} is now in the CRM tab.` });
    } catch (err: any) {
      const m = String(err?.message || "");
      if (m.includes("already exists")) {
        setAdded((s) => new Set(s).add(key));
        toast({ title: "Already in Contacts", description: p.fullName });
      } else {
        toast({ title: "Couldn't add contact", description: p.fullName, variant: "destructive" });
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
    const selectable = people.filter((p) => !added.has(keyOf(p))).map(keyOf);
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
    const targets = people.filter((p) => selected.has(keyOf(p)) && !added.has(keyOf(p)));
    if (targets.length === 0) {
      toast({ title: "Nothing selected", description: "Tick the contacts you want to add first." });
      return;
    }
    setBulkAdding(true);
    try {
      const res = await apiRequest("POST", "/api/crm/prospects/add-to-contacts/bulk", {
        contacts: targets.map(toContactBody),
        category: "ai_research",
      });
      const data = (await res.json()) as { added: number; skipped: number; total: number };
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
      toast({
        title: `${data.added} added to the CRM tab`,
        description: data.skipped > 0 ? `${data.skipped} were already in your CRM.` : `${data.added} new contact${data.added === 1 ? "" : "s"} saved.`,
      });
    } catch {
      toast({ title: "Bulk add failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setBulkAdding(false);
    }
  }

  async function draftOutreach(p: AgentPerson, channel: "email" | "linkedin") {
    const key = (p.email || p.fullName).toLowerCase();
    setDrafting(key);
    try {
      const res = await apiRequest("POST", "/api/crm/lead-research/draft-outreach", {
        fullName: p.fullName, firstName: p.firstName, jobTitle: p.jobTitle,
        companyName: p.companyName, country: p.location, channel,
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
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-gradient-to-r from-[hsl(var(--primary))]/10 to-purple-500/10 px-4 py-3">
        <Sparkles className="size-4 text-[hsl(var(--primary))]" />
        <div>
          <p className="text-sm font-semibold leading-tight">AI Lead Research</p>
          <p className="text-[11px] text-muted-foreground">Build lists, analyze your ICP, and draft outreach — just ask.</p>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[420px] overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-[hsl(var(--primary))] text-white" : "bg-muted text-foreground"}`}>
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.people && m.people.length > 0 && (() => {
                const people = m.people;
                const selectable = people.filter((pp) => !added.has(keyOf(pp)));
                const selectedCount = selectable.filter((pp) => selected.has(keyOf(pp))).length;
                const allSelected = selectable.length > 0 && selectedCount === selectable.length;
                return (
                <div className="mt-2 space-y-1.5">
                  {people.length > 1 && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-2 py-1.5">
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
                        disabled={selectedCount === 0 || bulkAdding}
                        onClick={() => addSelected(people)}
                      >
                        {bulkAdding ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}
                        Add {selectedCount > 0 ? `${selectedCount} ` : ""}to CRM
                      </Button>
                    </div>
                  )}
                  {people.map((p, j) => {
                    const key = keyOf(p);
                    const isAdded = added.has(key);
                    const enrolledIn = enrolled.get(key);
                    const pickerOpen = enrollOpenFor === key;
                    return (
                      <div key={j} className="rounded-lg border bg-card px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          {!isAdded && (
                            <input
                              type="checkbox"
                              className="size-3.5 shrink-0 accent-[hsl(var(--primary))]"
                              checked={selected.has(key)}
                              onChange={() => toggleSelect(p)}
                              aria-label={`Select ${p.fullName}`}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-semibold text-foreground">{p.fullName}</p>
                              {p.intel && (
                                <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${TIER_STYLE[p.intel.tier]}`} title={`Fit ${p.intel.fitScore} · Intent ${p.intel.intentScore}`}>
                                  {TIER_LABEL[p.intel.tier]} {p.intel.composite}
                                </span>
                              )}
                              {p.inCrm && <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-medium text-violet-700">In CRM</span>}
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {[p.jobTitle, p.companyName].filter(Boolean).join(" · ") || p.location || "—"}
                            </p>
                            {p.intel && p.intel.reasons.length > 0 && (
                              <p className="mt-0.5 truncate text-[10px] text-muted-foreground/90" title={p.intel.reasons.join(" · ")}>
                                Why: {p.intel.reasons.slice(0, 3).join(" · ")}
                              </p>
                            )}
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                              {p.email && <span className="inline-flex items-center gap-0.5"><Mail className="size-2.5" />{p.email}</span>}
                              {p.phone && <span className="inline-flex items-center gap-0.5"><Phone className="size-2.5" />{p.phone}</span>}
                              {p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"><Linkedin className="size-2.5" />in</a>}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button size="sm" variant={isAdded ? "outline" : "default"} className="h-7 gap-1 px-2 text-[11px]" disabled={isAdded} onClick={() => addToContacts(p)}>
                              {isAdded ? <><Check className="size-3" /> Added</> : <><UserPlus className="size-3" /> Add</>}
                            </Button>
                            {enrolledIn ? (
                              <span className="inline-flex items-center gap-0.5 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700"><Check className="size-2.5" /> Enrolled</span>
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" disabled={campaigns.length === 0 || enrolling === key} onClick={() => setEnrollOpenFor(pickerOpen ? null : key)}>
                                {enrolling === key ? <Loader2 className="size-3 animate-spin" /> : <Megaphone className="size-3" />} Enroll
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px]" disabled={drafting === key} onClick={() => draftOutreach(p, "email")} title="Draft a personalized email">
                              {drafting === key ? <Loader2 className="size-3 animate-spin" /> : <PenLine className="size-3" />} Draft
                            </Button>
                          </div>
                        </div>
                        {drafts.has(key) && (() => {
                          const d = drafts.get(key)!;
                          const full = (d.subject ? `Subject: ${d.subject}\n\n` : "") + d.body;
                          return (
                            <div className="mt-1.5 rounded-md border bg-muted/40 p-2">
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
                          <div className="mt-1.5 flex flex-wrap gap-1 border-t pt-1.5">
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
            <button key={s} onClick={() => send(s)} className="rounded-full border border-input px-2.5 py-1 text-[11px] text-muted-foreground hover:border-[hsl(var(--primary))] hover:text-foreground">
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
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Describe who you want to reach…"
          className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button size="sm" className="h-9 gap-1.5" disabled={!input.trim() || loading} onClick={() => send()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
