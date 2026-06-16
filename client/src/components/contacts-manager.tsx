import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search, Filter, Plus, Download, ChevronDown, ChevronUp,
  X, Tag, UserCheck, BookmarkPlus, Loader2, RefreshCw, ListPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const PERSONA_LABELS: Record<string, string> = {
  immigration_attorney: "Immigration Attorney",
  immigration_consultant: "Immigration Consultant",
  business_migration_agent: "Business Migration Agent",
  relocation_consultant: "Relocation Consultant",
  international_tax_advisor: "International Tax Advisor",
};

const STATUS_OPTIONS = [
  "new", "contacted", "responded", "call_scheduled",
  "active_partner", "closed", "unsubscribed", "bounced",
];

const STATUS_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", responded: "Responded",
  call_scheduled: "Call Scheduled", active_partner: "Active Partner",
  closed: "Closed", unsubscribed: "Unsubscribed", bounced: "Bounced",
};

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green-100 text-green-700" :
    score >= 50 ? "bg-amber-100 text-amber-700" :
    "bg-gray-100 text-gray-600";
  return (
    <span data-testid={`badge-score-${score}`} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    contacted: "bg-yellow-100 text-yellow-700",
    responded: "bg-purple-100 text-purple-700",
    call_scheduled: "bg-indigo-100 text-indigo-700",
    active_partner: "bg-green-100 text-green-700",
    closed: "bg-gray-100 text-gray-600",
    unsubscribed: "bg-orange-100 text-orange-700",
    bounced: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

interface ContactRow {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  firmName?: string | null;
  country?: string | null;
  personaType?: string | null;
  leadScore: number;
  status: string;
  tags: string[];
  source?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  firmName: string;
  jobTitle: string;
  personaType: string;
  country: string;
  city: string;
  source: string;
  linkedinUrl: string;
  websiteUrl: string;
  notes: string;
}

function AddContactModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<ContactFormData>({
    firstName: "", lastName: "", email: "", phone: "",
    firmName: "", jobTitle: "", personaType: "immigration_attorney",
    country: "", city: "", source: "Manual",
    linkedinUrl: "", websiteUrl: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiRequest("POST", "/api/contacts", {
        ...form,
        email: form.email || null,
        phone: form.phone || null,
        firmName: form.firmName || null,
        jobTitle: form.jobTitle || null,
        country: form.country || null,
        city: form.city || null,
        linkedinUrl: form.linkedinUrl || null,
        websiteUrl: form.websiteUrl || null,
        notes: form.notes || null,
        tags: [],
      });
      toast({ title: "Contact added" });
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add contact";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-card border shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Add Contact</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="size-5" /></button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">First Name *</label>
              <Input data-testid="input-contact-first" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="text-sm font-medium">Last Name *</label>
              <Input data-testid="input-contact-last" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input data-testid="input-contact-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input data-testid="input-contact-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Firm / Company</label>
              <Input data-testid="input-contact-firm" value={form.firmName} onChange={(e) => setForm({ ...form, firmName: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Job Title</label>
              <Input data-testid="input-contact-title" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Persona Type</label>
              <select data-testid="select-contact-persona" value={form.personaType} onChange={(e) => setForm({ ...form, personaType: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                {Object.entries(PERSONA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Source</label>
              <select data-testid="select-contact-source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                {["Manual", "Seamless", "Apify/Google", "Apify/LinkedIn"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Country</label>
              <Input data-testid="input-contact-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">City</label>
              <Input data-testid="input-contact-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">LinkedIn URL</label>
              <Input data-testid="input-contact-linkedin" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Website</label>
              <Input data-testid="input-contact-website" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}Add Contact</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * The full Contacts list (search, filters, bulk actions, profile links). Rendered
 * both at the standalone `/crm/contacts` route (wrapped in <CrmLayout>) and as the
 * "Contacts" tab inside the Marketing Academy CRM shell (crm.tsx), so Lead Research
 * adds — which land in the `contacts` table — are visible without leaving the shell.
 */
export function ContactsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const [showSaveSegment, setShowSaveSegment] = useState(false);
  const [addToListId, setAddToListId] = useState<string>("");
  const [newListName, setNewListName] = useState("");

  const [filters, setFilters] = useState<{
    status: string[];
    country: string[];
    personaType: string[];
    source: string[];
    minScore: string;
    maxScore: string;
  }>({
    status: [], country: [], personaType: [], source: [],
    minScore: "", maxScore: "",
  });

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (filters.status.length) params.set("status", filters.status.join(","));
  if (filters.country.length) params.set("country", filters.country.join(","));
  if (filters.personaType.length) params.set("personaType", filters.personaType.join(","));
  if (filters.source.length) params.set("source", filters.source.join(","));
  if (filters.minScore) params.set("minScore", filters.minScore);
  if (filters.maxScore) params.set("maxScore", filters.maxScore);
  params.set("page", String(page));

  const { data, isLoading, refetch } = useQuery<{ contacts: ContactRow[]; total: number; page: number; pageSize: number }>({
    queryKey: ["/api/contacts", params.toString()],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts?${params}`);
      return res.json();
    },
  });

  const contacts = data?.contacts || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / 50));

  // CRM lists are shared with campaigns — adding contacts here makes the list
  // selectable as a campaign audience (the server mirrors members to prospects).
  const { data: crmLists = [] } = useQuery<{ id: string; name: string; count: number }[]>({
    queryKey: ["/api/crm/lists"],
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  };

  const exportCSV = () => {
    const rows = contacts.filter((c) => selected.has(c.id));
    if (!rows.length) return;
    const headers = ["Name", "Email", "Firm", "Country", "Persona", "Score", "Status", "Source", "Tags"];
    const csv = [
      headers.join(","),
      ...rows.map((c) => [
        `"${c.firstName} ${c.lastName}"`,
        `"${c.email || ""}"`,
        `"${c.firmName || ""}"`,
        `"${c.country || ""}"`,
        `"${PERSONA_LABELS[c.personaType || ""] || c.personaType || ""}"`,
        c.leadScore,
        c.status,
        `"${c.source || ""}"`,
        `"${(c.tags || []).join("; ")}"`,
      ].join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const bulkStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("POST", "/api/contacts/bulk/status", { ids: Array.from(selected), status });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Status updated" });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  const bulkTagMutation = useMutation({
    mutationFn: async (tags: string[]) => {
      const res = await apiRequest("POST", "/api/contacts/bulk/tags", { ids: Array.from(selected), tags });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Tags added" });
      setSelected(new Set());
      setBulkTagInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  const saveSegmentMutation = useMutation({
    mutationFn: async () => {
      const segFilters: Record<string, unknown> = {};
      if (filters.status.length) segFilters.status = filters.status;
      if (filters.country.length) segFilters.country = filters.country;
      if (filters.personaType.length) segFilters.personaType = filters.personaType;
      if (filters.source.length) segFilters.source = filters.source;
      if (filters.minScore) segFilters.minScore = parseInt(filters.minScore);
      if (filters.maxScore) segFilters.maxScore = parseInt(filters.maxScore);
      const res = await apiRequest("POST", "/api/segments", { name: segmentName, filters: segFilters });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Segment saved" });
      setShowSaveSegment(false);
      setSegmentName("");
    },
  });

  // Add the selected contacts to a CRM list (existing, or a new one created on the
  // fly). The server mirrors each contact into the list's linked prospect_list, so
  // the same list becomes selectable inside a campaign.
  const addToListMutation = useMutation({
    mutationFn: async ({ ids, listId, newName }: { ids: string[]; listId: string | null; newName?: string }) => {
      let targetId = listId;
      if (!targetId) {
        const created = await apiRequest("POST", "/api/crm/lists", { name: newName });
        targetId = (await created.json()).id as string;
      }
      const res = await apiRequest("POST", `/api/crm/lists/${targetId}/members`, { contactIds: ids });
      const data = await res.json();
      return { added: data.added as number, requested: ids.length, listId: targetId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/lists", data.listId, "members"] });
      // Refresh the campaign-facing queries (global staleTime is Infinity).
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/enroll-candidates"] });
      setSelected(new Set());
      setNewListName("");
      setAddToListId("");
      const skipped = data.requested - data.added;
      toast({
        title: `Added ${data.added} contact${data.added !== 1 ? "s" : ""} to list`,
        description: skipped > 0 ? `${skipped} already in the list` : undefined,
      });
    },
    onError: () => toast({ title: "Failed to add to list", variant: "destructive" }),
  });

  const submitAddToList = () => {
    if (!addToListId || selected.size === 0) return;
    if (addToListId === "__new__" && !newListName.trim()) return;
    addToListMutation.mutate({
      ids: Array.from(selected),
      listId: addToListId === "__new__" ? null : addToListId,
      newName: addToListId === "__new__" ? newListName.trim() : undefined,
    });
  };

  const filterSummary = [
    ...filters.status.map((s) => STATUS_LABELS[s] || s),
    ...filters.personaType.map((p) => PERSONA_LABELS[p] || p),
    ...filters.country,
    ...filters.source,
    filters.minScore ? `Score ≥ ${filters.minScore}` : "",
    filters.maxScore ? `Score ≤ ${filters.maxScore}` : "",
  ].filter(Boolean);

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contacts</h1>
            <p className="text-sm text-muted-foreground">{total.toLocaleString()} contact{total !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="button-refresh-contacts" size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="size-4 mr-1" /> Refresh
            </Button>
            <Button data-testid="button-add-contact" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="size-4 mr-1" /> Add Contact
            </Button>
          </div>
        </div>

        {/* Search + Filter bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              data-testid="input-contact-search"
              placeholder="Search name, email, firm, country…"
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Button data-testid="button-toggle-filters" variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "border-[hsl(var(--primary))]" : ""}>
            <Filter className="size-4 mr-1" />
            Filters {filterSummary.length > 0 ? `(${filterSummary.length})` : ""}
            {showFilters ? <ChevronUp className="size-3 ml-1" /> : <ChevronDown className="size-3 ml-1" />}
          </Button>
          {filterSummary.length > 0 && (
            <Button data-testid="button-save-segment" variant="outline" size="sm" onClick={() => setShowSaveSegment(true)}>
              <BookmarkPlus className="size-4 mr-1" /> Save Segment
            </Button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Status</label>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {STATUS_OPTIONS.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={filters.status.includes(s)}
                      onChange={(e) => {
                        setFilters((f) => ({ ...f, status: e.target.checked ? [...f.status, s] : f.status.filter((x) => x !== s) }));
                        setPage(1);
                      }} />
                    {STATUS_LABELS[s]}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Persona</label>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {Object.entries(PERSONA_LABELS).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={filters.personaType.includes(v)}
                      onChange={(e) => {
                        setFilters((f) => ({ ...f, personaType: e.target.checked ? [...f.personaType, v] : f.personaType.filter((x) => x !== v) }));
                        setPage(1);
                      }} />
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Source</label>
              <div className="space-y-1">
                {["Seamless", "Manual", "Apify/Google", "Apify/LinkedIn", "Prospect Finder"].map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={filters.source.includes(s)}
                      onChange={(e) => {
                        setFilters((f) => ({ ...f, source: e.target.checked ? [...f.source, s] : f.source.filter((x) => x !== s) }));
                        setPage(1);
                      }} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Score Range</label>
                <div className="flex items-center gap-2">
                  <Input placeholder="Min" value={filters.minScore} onChange={(e) => { setFilters((f) => ({ ...f, minScore: e.target.value })); setPage(1); }} className="h-8 text-sm w-20" />
                  <span className="text-muted-foreground">–</span>
                  <Input placeholder="Max" value={filters.maxScore} onChange={(e) => { setFilters((f) => ({ ...f, maxScore: e.target.value })); setPage(1); }} className="h-8 text-sm w-20" />
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground"
                onClick={() => { setFilters({ status: [], country: [], personaType: [], source: [], minScore: "", maxScore: "" }); setPage(1); }}>
                Clear filters
              </Button>
            </div>
          </Card>
        )}

        {/* Bulk toolbar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))]/5 border border-[hsl(var(--primary))]/20 px-4 py-2">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="ml-2 flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportCSV}>
                <Download className="size-3" /> Export CSV
              </Button>
              <div className="relative">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowBulkMenu(!showBulkMenu)}>
                  <UserCheck className="size-3" /> Change Status <ChevronDown className="size-3" />
                </Button>
                {showBulkMenu && (
                  <div className="absolute top-full left-0 mt-1 z-10 w-44 rounded-lg border bg-card shadow-lg py-1">
                    {STATUS_OPTIONS.map((s) => (
                      <button key={s} onClick={() => { bulkStatusMutation.mutate(s); setShowBulkMenu(false); }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted">
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Input placeholder="tag1, tag2" value={bulkTagInput} onChange={(e) => setBulkTagInput(e.target.value)}
                  className="h-7 text-xs w-32" />
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  onClick={() => {
                    const tags = bulkTagInput.split(",").map((t) => t.trim()).filter(Boolean);
                    if (tags.length) bulkTagMutation.mutate(tags);
                  }}>
                  <Tag className="size-3" /> Add Tags
                </Button>
              </div>
              {/* Add selected contacts to a CRM list (shared with campaigns) */}
              <div className="flex items-center gap-1">
                <select
                  data-testid="select-contacts-add-to-list"
                  aria-label="Add selected contacts to a list"
                  value={addToListId}
                  onChange={(e) => setAddToListId(e.target.value)}
                  className="h-7 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Add to list…</option>
                  {crmLists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.count})</option>
                  ))}
                  <option value="__new__">＋ New list…</option>
                </select>
                {addToListId === "__new__" && (
                  <Input
                    data-testid="input-contacts-new-list-name"
                    aria-label="New list name"
                    placeholder="New list name"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitAddToList(); }}
                    className="h-7 text-xs w-32"
                  />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="button-contacts-add-to-list"
                  className="h-7 text-xs gap-1"
                  disabled={addToListMutation.isPending || !addToListId || (addToListId === "__new__" && !newListName.trim())}
                  onClick={submitAddToList}
                >
                  <ListPlus className="size-3" /> Add
                </Button>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
                <X className="size-3 mr-1" /> Clear
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="size-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No contacts found</p>
              <Button className="mt-4" size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="size-4 mr-1" /> Add your first contact
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="py-3 pl-4 pr-2 text-left w-10">
                      <input type="checkbox" checked={selected.size === contacts.length && contacts.length > 0}
                        onChange={toggleSelectAll} className="rounded" />
                    </th>
                    <th className="py-3 px-3 text-left font-semibold text-muted-foreground">Name</th>
                    <th className="py-3 px-3 text-left font-semibold text-muted-foreground">Firm</th>
                    <th className="py-3 px-3 text-left font-semibold text-muted-foreground">Country</th>
                    <th className="py-3 px-3 text-left font-semibold text-muted-foreground">Persona</th>
                    <th className="py-3 px-3 text-left font-semibold text-muted-foreground">Score</th>
                    <th className="py-3 px-3 text-left font-semibold text-muted-foreground">Status</th>
                    <th className="py-3 px-3 text-left font-semibold text-muted-foreground">Tags</th>
                    <th className="py-3 px-3 text-right font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.map((c) => (
                    <tr key={c.id} data-testid={`row-contact-${c.id}`}
                      className={`hover:bg-muted/20 transition-colors ${selected.has(c.id) ? "bg-[hsl(var(--primary))]/5" : ""}`}>
                      <td className="py-3 pl-4 pr-2">
                        <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" />
                      </td>
                      <td className="py-3 px-3">
                        <Link href={`/crm/contacts/${c.id}`}>
                          <a className="font-medium hover:text-[hsl(var(--primary))] hover:underline">
                            {c.firstName} {c.lastName}
                          </a>
                        </Link>
                        {c.email && <div className="text-xs text-muted-foreground truncate max-w-[180px]">{c.email}</div>}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{c.firmName || "—"}</td>
                      <td className="py-3 px-3 text-muted-foreground">{c.country || "—"}</td>
                      <td className="py-3 px-3">
                        <span className="text-xs">{PERSONA_LABELS[c.personaType || ""] || c.personaType || "—"}</span>
                      </td>
                      <td className="py-3 px-3"><ScoreBadge score={c.leadScore} /></td>
                      <td className="py-3 px-3"><StatusBadge status={c.status} /></td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags || []).slice(0, 2).map((tag) => (
                            <span key={tag} className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">{tag}</span>
                          ))}
                          {(c.tags || []).length > 2 && (
                            <span className="text-xs text-muted-foreground">+{(c.tags || []).length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Link href={`/crm/contacts/${c.id}`}>
                          <a data-testid={`link-contact-view-${c.id}`} className="text-xs text-[hsl(var(--primary))] hover:underline font-medium">
                            View →
                          </a>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddContactModal
          onClose={() => setShowAdd(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/contacts"] })}
        />
      )}

      {showSaveSegment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card border shadow-xl p-6 space-y-4">
            <h3 className="font-semibold">Save Segment</h3>
            <p className="text-sm text-muted-foreground">Active filters: {filterSummary.join(", ")}</p>
            <Input placeholder="Segment name" value={segmentName} onChange={(e) => setSegmentName(e.target.value)} />
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowSaveSegment(false)}>Cancel</Button>
              <Button disabled={!segmentName} onClick={() => saveSegmentMutation.mutate()}>
                {saveSegmentMutation.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const Users = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
