import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutList, Columns, Filter, SlidersHorizontal, ChevronUp, ChevronDown,
  Mail, MessageSquare, FileText, Eye, Phone, ArrowRight, X, Search,
  AlertTriangle, CheckSquare, Square, MoreHorizontal, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api/franchisee${path}`, { headers: { "Content-Type": "application/json" }, credentials: "include", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data as T;
}

// ─── Types & constants ────────────────────────────────────────────────────────

type Lead = {
  id: string; name: string; score: number; tier: string; stage: string;
  source: string; propertyCount: number; address: string; daysInStage: number;
  lastActivity: string; hasVerifiedAddress: boolean;
  channels: { email: boolean; whatsapp: boolean; letter: boolean };
  letterStatus: string | null;
};

const STAGES = ["New Lead", "Contacted", "Replied", "Call Scheduled", "Call Completed", "Proposal Sent", "Converted"];

const TIER_CFG: Record<string, { bg: string; text: string; dot: string; rowBg: string }> = {
  hot:     { bg: "bg-red-100",    text: "text-red-700",    dot: "🔴", rowBg: "bg-red-50/40"    },
  warm:    { bg: "bg-orange-100", text: "text-orange-700", dot: "🟠", rowBg: "bg-orange-50/40" },
  nurture: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "🟡", rowBg: ""                 },
  watch:   { bg: "bg-blue-100",   text: "text-blue-700",   dot: "🔵", rowBg: ""                 },
  cold:    { bg: "bg-gray-100",   text: "text-gray-600",   dot: "⚪", rowBg: ""                 },
};

const STAGE_COLORS: Record<string, string> = {
  "New Lead":       "border-t-gray-400",
  "Contacted":      "border-t-blue-400",
  "Replied":        "border-t-indigo-400",
  "Call Scheduled": "border-t-violet-500",
  "Call Completed": "border-t-purple-500",
  "Proposal Sent":  "border-t-fuchsia-500",
  "Converted":      "border-t-green-500",
};

const STAGE_DOT: Record<string, string> = {
  "New Lead":       "bg-gray-400",
  "Contacted":      "bg-blue-400",
  "Replied":        "bg-indigo-400",
  "Call Scheduled": "bg-violet-500",
  "Call Completed": "bg-purple-500",
  "Proposal Sent":  "bg-fuchsia-500",
  "Converted":      "bg-green-500",
};

// ─── Channel icons ────────────────────────────────────────────────────────────

function ChannelIcons({ channels }: { channels: Lead["channels"] }) {
  return (
    <div className="flex gap-1">
      <Mail className={`size-3.5 ${channels.email ? "text-indigo-500" : "text-gray-200"}`} aria-label="Email" />
      <MessageSquare className={`size-3.5 ${channels.whatsapp ? "text-green-500" : "text-gray-200"}`} aria-label="WhatsApp" />
      <FileText className={`size-3.5 ${channels.letter ? "text-amber-500" : "text-gray-200"}`} aria-label="Letter" />
    </div>
  );
}

// ─── Days-in-stage badge ──────────────────────────────────────────────────────

function DaysBadge({ days }: { days: number }) {
  const color = days >= 14 ? "bg-red-100 text-red-700" : days >= 7 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500";
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${color}`}>{days}d</span>;
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

function KanbanCard({ lead, onMove }: { lead: Lead; onMove: (id: string, stage: string) => void }) {
  const [showActions, setShowActions] = useState(false);
  const tc = TIER_CFG[lead.tier] ?? TIER_CFG.cold;
  const stageIdx = STAGES.indexOf(lead.stage);

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("leadId", lead.id); e.dataTransfer.setData("leadStage", lead.stage); }}
      className="rounded-lg border bg-white p-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-grab active:cursor-grabbing group relative"
      onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}
    >
      {/* Score + name */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 leading-tight truncate">{lead.name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">🏠 {lead.propertyCount} {lead.propertyCount === 1 ? "prop" : "props"}</p>
        </div>
        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${tc.bg} ${tc.text} shrink-0`}>
          {tc.dot} {lead.score}
        </span>
      </div>

      {/* Source tag */}
      <div className="flex items-center gap-2 mb-2">
        <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] px-1.5">{lead.source}</Badge>
        <DaysBadge days={lead.daysInStage} />
      </div>

      {/* Channel icons + last activity */}
      <div className="flex items-center justify-between">
        <ChannelIcons channels={lead.channels} />
        <span className="text-[10px] text-gray-400 truncate max-w-[80px]">{lead.lastActivity}</span>
      </div>

      {/* Hover actions */}
      {showActions && (
        <div className="absolute inset-x-0 bottom-0 bg-white border-t rounded-b-lg flex divide-x">
          {[
            { icon: Eye,   label: "View"        },
            { icon: Mail,  label: "Email"       },
            { icon: Phone, label: "Log Call"    },
            { icon: ArrowRight, label: "Move",  onClick: () => { const next = STAGES[stageIdx + 1]; if (next) onMove(lead.id, next); } },
          ].map(a => (
            <button key={a.label} onClick={a.onClick} title={a.label}
              className="flex-1 flex items-center justify-center py-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
              <a.icon className="size-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Kanban Board ─────────────────────────────────────────────────────────────

function KanbanBoard({ leads, onMoveStage }: { leads: Lead[]; onMoveStage: (id: string, stage: string) => void }) {
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("leadId");
    if (id) onMoveStage(id, stage);
    setDragOverStage(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[60vh]">
      {STAGES.map(stage => {
        const stageLeads = leads.filter(l => l.stage === stage);
        const stageVal = stageLeads.reduce((s, l) => s + l.propertyCount * 120, 0);
        return (
          <div
            key={stage}
            className={`shrink-0 w-60 flex flex-col rounded-xl border-t-4 bg-gray-50/80 ${STAGE_COLORS[stage]} transition-colors ${dragOverStage === stage ? "bg-indigo-50/60" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragOverStage(stage); }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={e => handleDrop(e, stage)}
          >
            <div className="px-3 pt-3 pb-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{stage}</span>
                <span className="text-xs font-black text-gray-400">{stageLeads.length}</span>
              </div>
              {stageVal > 0 && <p className="text-[10px] text-gray-400">${stageVal.toLocaleString()} est.</p>}
            </div>
            <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto min-h-[200px]">
              {stageLeads.map(l => <KanbanCard key={l.id} lead={l} onMove={onMoveStage} />)}
              {stageLeads.length === 0 && (
                <div className="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-gray-200">
                  <p className="text-[10px] text-gray-400">Drop leads here</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────────────────────

type SortKey = "name" | "score" | "stage" | "daysInStage" | "propertyCount";

function TableView({ leads, selected, onSelect, onSelectAll }: {
  leads: Lead[]; selected: Set<string>;
  onSelect: (id: string) => void; onSelectAll: (check: boolean) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...leads].sort((a, b) => {
    const va = a[sortKey] as any, vb = b[sortKey] as any;
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortAsc ? <ChevronUp className="size-3 inline ml-0.5" /> : <ChevronDown className="size-3 inline ml-0.5" />)
    : null;

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(false); }
  };

  const allSelected = leads.length > 0 && leads.every(l => selected.has(l.id));

  return (
    <div className="rounded-xl border bg-white overflow-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead className="bg-gray-50 border-b sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 sticky left-0 bg-gray-50 z-20">
              <button onClick={() => onSelectAll(!allSelected)}>
                {allSelected ? <CheckSquare className="size-4 text-indigo-600" /> : <Square className="size-4 text-gray-400" />}
              </button>
            </th>
            {[
              { key: "name" as SortKey,           label: "Name",          cls: "sticky left-10 bg-gray-50 z-20 min-w-[160px]" },
              { key: "score" as SortKey,          label: "Score",         cls: "text-center" },
              { key: "stage" as SortKey,          label: "Stage",         cls: "" },
              { key: null,                         label: "Source",        cls: "hidden sm:table-cell" },
              { key: "propertyCount" as SortKey,  label: "Props",         cls: "text-center hidden sm:table-cell" },
              { key: "daysInStage" as SortKey,    label: "Days in Stage", cls: "text-center" },
              { key: null,                         label: "Channels",      cls: "hidden md:table-cell" },
              { key: null,                         label: "Last Activity", cls: "hidden lg:table-cell" },
              { key: null,                         label: "Actions",       cls: "text-right" },
            ].map((col, i) => (
              <th key={i} className={`px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap ${col.cls ?? ""}`}>
                {col.key ? (
                  <button className="flex items-center gap-0.5 hover:text-gray-900" onClick={() => col.key && toggleSort(col.key)}>
                    {col.label}<SortIcon k={col.key} />
                  </button>
                ) : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map(lead => {
            const tc = TIER_CFG[lead.tier] ?? TIER_CFG.cold;
            const dot = STAGE_DOT[lead.stage] ?? "bg-gray-300";
            return (
              <tr key={lead.id} className={`hover:bg-gray-50 cursor-pointer ${tc.rowBg} ${selected.has(lead.id) ? "bg-indigo-50/50" : ""}`}
                onClick={() => onSelect(lead.id)}>
                <td className="px-4 py-3 sticky left-0 bg-inherit">
                  {selected.has(lead.id) ? <CheckSquare className="size-4 text-indigo-600" /> : <Square className="size-4 text-gray-300" />}
                </td>
                <td className="px-4 py-3 sticky left-10 bg-inherit">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">{lead.name[0]}</div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{lead.name}</p>
                      <p className="text-[11px] text-gray-400">{lead.address}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full ${tc.bg} ${tc.text}`}>{tc.dot} {lead.score}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5"><div className={`size-1.5 rounded-full ${dot} shrink-0`} /><span className="text-xs text-gray-600 whitespace-nowrap">{lead.stage}</span></div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 hidden sm:table-cell whitespace-nowrap">{lead.source}</td>
                <td className="px-4 py-3 text-center text-sm font-semibold text-gray-700 hidden sm:table-cell">{lead.propertyCount}</td>
                <td className="px-4 py-3 text-center"><DaysBadge days={lead.daysInStage} /></td>
                <td className="px-4 py-3 hidden md:table-cell"><ChannelIcons channels={lead.channels} /></td>
                <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell whitespace-nowrap">{lead.lastActivity}</td>
                <td className="px-4 py-3 text-right">
                  <button className="rounded-lg p-1 hover:bg-gray-100 text-gray-400 hover:text-gray-600" onClick={e => e.stopPropagation()}>
                    <MoreHorizontal className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

type Filters = { tiers: string[]; stages: string[]; sources: string[]; scoreMin: number; scoreMax: number; daysInStage: string; hasVerifiedAddress: string };

function FilterPanel({ filters, onChange, onClose }: { filters: Filters; onChange: (f: Filters) => void; onClose: () => void }) {
  const [local, setLocal] = useState<Filters>({ ...filters });

  const tiers = ["hot", "warm", "nurture", "watch", "cold"];
  const sources = ["Zillow", "Facebook", "Craigslist", "Nextdoor", "Google Ads", "Referral", "Apollo", "Reddit"];
  const daysOptions = ["any", "0-7", "7-14", "14-30", "30+"];

  const toggle = (key: "tiers" | "stages" | "sources", val: string) => {
    setLocal(p => {
      const arr = p[key].includes(val) ? p[key].filter(v => v !== val) : [...p[key], val];
      return { ...p, [key]: arr };
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1" onClick={onClose} />
      <div className="w-72 bg-white border-l shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">Filter Pipeline</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Tier */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Lead Tier</p>
            <div className="flex flex-wrap gap-1.5">
              {tiers.map(t => (
                <button key={t} onClick={() => toggle("tiers", t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-colors ${local.tiers.includes(t) ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"}`}>
                  {TIER_CFG[t].dot} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {/* Stage */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Stage</p>
            <div className="space-y-1.5">
              {STAGES.map(s => (
                <label key={s} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={local.stages.includes(s)} onChange={() => toggle("stages", s)} className="size-3.5 rounded" />
                  <span className="text-sm text-gray-700">{s}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Score range */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Score Range</p>
            <div className="flex items-center gap-3">
              <input type="number" min={0} max={100} value={local.scoreMin}
                onChange={e => setLocal(p => ({ ...p, scoreMin: parseInt(e.target.value) || 0 }))}
                className="w-16 rounded border px-2 py-1 text-sm text-center" />
              <span className="text-gray-400">to</span>
              <input type="number" min={0} max={100} value={local.scoreMax}
                onChange={e => setLocal(p => ({ ...p, scoreMax: parseInt(e.target.value) || 100 }))}
                className="w-16 rounded border px-2 py-1 text-sm text-center" />
            </div>
          </div>
          {/* Days in stage */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Days in Stage</p>
            <div className="flex flex-wrap gap-1.5">
              {daysOptions.map(o => (
                <button key={o} onClick={() => setLocal(p => ({ ...p, daysInStage: o }))}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-colors ${local.daysInStage === o ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>
          {/* Verified address */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Verified Address</p>
            <div className="flex gap-2">
              {["any", "yes", "no"].map(o => (
                <button key={o} onClick={() => setLocal(p => ({ ...p, hasVerifiedAddress: o }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${local.hasVerifiedAddress === o ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500"}`}>
                  {o}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t px-5 py-4 flex gap-3">
          <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => { onChange(local); onClose(); }}>Apply</Button>
          <Button variant="outline" className="flex-1" onClick={() => {
            const reset: Filters = { tiers: [], stages: [], sources: [], scoreMin: 0, scoreMax: 100, daysInStage: "any", hasVerifiedAddress: "any" };
            setLocal(reset); onChange(reset); onClose();
          }}>Reset</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Pipeline Page ───────────────────────────────────────────────────────

export function MpPipeline() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode]   = useState<"kanban" | "table">("kanban");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [filters, setFilters]     = useState<Filters>({ tiers: [], stages: [], sources: [], scoreMin: 0, scoreMax: 100, daysInStage: "any", hasVerifiedAddress: "any" });
  const [localLeads, setLocalLeads] = useState<Lead[] | null>(null);

  const { data: apiLeads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/franchisee/pipeline"],
    queryFn: () => api<Lead[]>("/pipeline"),
  });

  useEffect(() => {
    if (apiLeads.length > 0 && !localLeads) setLocalLeads(apiLeads);
  }, [apiLeads, localLeads]);

  const leads: Lead[] = localLeads ?? apiLeads;

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api(`/pipeline/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/franchisee/pipeline"] }),
  });

  const moveLeadToStage = (id: string, stage: string) => {
    setLocalLeads(prev => (prev ?? leads).map(l => l.id === id ? { ...l, stage } : l));
    stageMutation.mutate({ id, stage });
  };

  // Apply filters
  const filtered = leads.filter(l => {
    if (filters.tiers.length && !filters.tiers.includes(l.tier)) return false;
    if (filters.stages.length && !filters.stages.includes(l.stage)) return false;
    if (l.score < filters.scoreMin || l.score > filters.scoreMax) return false;
    if (filters.daysInStage !== "any") {
      const ranges: Record<string, [number, number]> = { "0-7": [0,7], "7-14": [7,14], "14-30": [14,30], "30+": [30,999] };
      const [min, max] = ranges[filters.daysInStage];
      if (l.daysInStage < min || l.daysInStage > max) return false;
    }
    if (filters.hasVerifiedAddress === "yes" && !l.hasVerifiedAddress) return false;
    if (filters.hasVerifiedAddress === "no"  &&  l.hasVerifiedAddress) return false;
    return true;
  });

  const activeFilters = filters.tiers.length + filters.stages.length + (filters.daysInStage !== "any" ? 1 : 0) + (filters.hasVerifiedAddress !== "any" ? 1 : 0);
  const stageSummary = STAGES.map(s => ({ stage: s, count: leads.filter(l => l.stage === s).length }));
  const totalValue = leads.filter(l => l.tier === "hot" || l.tier === "warm").reduce((s, l) => s + l.propertyCount * 120, 0);

  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectAll = (check: boolean) => setSelected(check ? new Set(leads.map(l => l.id)) : new Set());

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Pipeline</h1>
          <p className="text-sm text-gray-500">{leads.length} leads · Est. value $<strong>{totalValue.toLocaleString()}</strong>/mo</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFilterOpen(true)} className="gap-2">
            <Filter className="size-4" /> Filters {activeFilters > 0 && <Badge className="bg-indigo-100 text-indigo-700 border-0 ml-1">{activeFilters}</Badge>}
          </Button>
          <div className="flex rounded-lg border overflow-hidden">
            <button onClick={() => setViewMode("kanban")} className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 ${viewMode === "kanban" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <Columns className="size-3.5" /> Kanban
            </button>
            <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 border-l ${viewMode === "table" ? "bg-indigo-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <LayoutList className="size-3.5" /> Table
            </button>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      <div className="rounded-xl border bg-white px-4 py-3 mb-5 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {stageSummary.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <div className={`size-1.5 rounded-full ${STAGE_DOT[s.stage] ?? "bg-gray-300"}`} />
                <span className="text-xs text-gray-500 whitespace-nowrap">{s.stage}:</span>
                <span className="text-xs font-black text-gray-800">{s.count}</span>
              </div>
              {i < stageSummary.length - 1 && <span className="text-gray-200">|</span>}
            </div>
          ))}
          <div className="ml-4 pl-4 border-l flex items-center gap-3">
            <span className="text-xs text-gray-500">Total active: <strong className="text-gray-800">{leads.filter(l => l.tier !== "cold").length}</strong></span>
            <span className="text-xs text-gray-500">Est. value: <strong className="text-green-700">${totalValue.toLocaleString()}/mo</strong></span>
          </div>
        </div>
      </div>

      {/* Active filter pills */}
      {activeFilters > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {filters.tiers.map(t => <Badge key={t} className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1">{t} <button onClick={() => setFilters(p => ({ ...p, tiers: p.tiers.filter(x => x !== t) }))}><X className="size-3" /></button></Badge>)}
          {filters.stages.map(s => <Badge key={s} className="bg-purple-50 text-purple-700 border-purple-200 gap-1">{s} <button onClick={() => setFilters(p => ({ ...p, stages: p.stages.filter(x => x !== s) }))}><X className="size-3" /></button></Badge>)}
          <button onClick={() => setFilters({ tiers: [], stages: [], sources: [], scoreMin: 0, scoreMax: 100, daysInStage: "any", hasVerifiedAddress: "any" })} className="text-xs text-gray-400 hover:text-red-500 font-medium">Clear all</button>
        </div>
      )}

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3 mb-4 flex items-center gap-4">
          <span className="text-sm font-semibold text-indigo-700">{selected.size} lead{selected.size > 1 ? "s" : ""} selected</span>
          <div className="flex gap-2 flex-wrap">
            {["Move Stage", "Add Tag", "Assign Sequence", "Mark DNC", "Export"].map(a => (
              <Button key={a} size="sm" variant="outline" className="text-xs h-7 bg-white border-indigo-200">{a}</Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="ml-auto text-gray-400" onClick={() => setSelected(new Set())}><X className="size-4" /></Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="size-7 animate-spin text-indigo-400" /></div>
      ) : viewMode === "kanban" ? (
        <KanbanBoard leads={filtered} onMoveStage={moveLeadToStage} />
      ) : (
        <TableView leads={filtered} selected={selected} onSelect={toggleSelect} onSelectAll={selectAll} />
      )}

      {filterOpen && <FilterPanel filters={filters} onChange={setFilters} onClose={() => setFilterOpen(false)} />}
    </div>
  );
}
