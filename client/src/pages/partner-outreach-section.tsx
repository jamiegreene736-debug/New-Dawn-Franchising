import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Search, Filter, ChevronRight, ExternalLink, Check, X,
  Loader2, RefreshCw, Trash2, Play, Pause, Mail, Linkedin, FileText,
  Globe, Phone, MapPin, Building2, ToggleLeft, ToggleRight, AlertCircle,
  CheckCircle, Clock, BarChart2, ArrowLeft, Handshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const api = async (url: string, opts?: RequestInit) => {
  const res = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) } });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? res.statusText);
  return res.json();
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface PartnerLead {
  id: string;
  fullName: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  mailingAddress?: string;
  linkedinUrl?: string;
  linkedinConnected: boolean;
  website?: string;
  city?: string;
  audienceType: string;
  spanishFlag: boolean;
  subjectVariant: string;
  score: number;
  status: string;
  optedOut: boolean;
  notes?: string;
  tags: string[];
  sequenceStartedAt?: string;
  sequencePaused: boolean;
  sequenceFlow?: string;
  createdAt: string;
}

interface PartnerEvent {
  id: string;
  leadId: string;
  day: number;
  channel: string;
  touchName: string;
  status: string;
  scheduledAt: string;
  executedAt?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

interface PartnerStats {
  total: number;
  active: number;
  replied: number;
  byStatus: Record<string, number>;
  byAudience: Record<string, number>;
}

const AUDIENCE_TYPES = [
  { value: "immigration_attorney", label: "Immigration Attorney" },
  { value: "wealth_manager", label: "Wealth Manager" },
  { value: "business_advisor", label: "Business Advisor" },
  { value: "e2_consultant", label: "E-2 Consultant" },
  { value: "immigration_consultant", label: "Immigration Consultant" },
  { value: "other", label: "Other" },
];

const AUDIENCE_COLORS: Record<string, string> = {
  immigration_attorney: "bg-purple-100 text-purple-700",
  wealth_manager: "bg-emerald-100 text-emerald-700",
  business_advisor: "bg-blue-100 text-blue-700",
  e2_consultant: "bg-orange-100 text-orange-700",
  immigration_consultant: "bg-teal-100 text-teal-700",
  other: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-600",
  active: "bg-blue-100 text-blue-700",
  replied: "bg-purple-100 text-purple-700",
  booked: "bg-green-100 text-green-700",
  converted: "bg-emerald-100 text-emerald-700",
  dead: "bg-red-100 text-red-600",
  opted_out: "bg-red-50 text-red-500",
};

const EVENT_CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  lob: FileText,
};

const EVENT_STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-gray-100 text-gray-500",
  sent: "bg-green-100 text-green-700",
  opened: "bg-blue-100 text-blue-700",
  clicked: "bg-blue-200 text-blue-800",
  replied: "bg-purple-100 text-purple-700",
  failed: "bg-red-100 text-red-600",
  skipped: "bg-yellow-100 text-yellow-600",
  paused: "bg-orange-100 text-orange-600",
  cancelled: "bg-red-50 text-red-400",
};

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── Add Lead Form ────────────────────────────────────────────────────────────

function AddLeadForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    fullName: "", title: "", company: "", email: "", phone: "",
    mailingAddress: "", linkedinUrl: "", website: "", city: "",
    audienceType: "immigration_attorney",
    spanishFlag: false,
    notes: "",
  });

  const mut = useMutation({
    mutationFn: (data: typeof form) => api("/api/partner/leads", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (lead) => {
      toast({ title: "Lead added", description: `${lead.fullName} added to partner outreach.` });
      onSuccess();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Full Name *</label>
          <Input value={form.fullName} onChange={e => set("fullName", e.target.value)} placeholder="Sarah Mitchell" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Title</label>
          <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Immigration Attorney" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Firm / Company</label>
          <Input value={form.company} onChange={e => set("company", e.target.value)} placeholder="Mitchell Immigration Law" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">City</label>
          <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Miami, FL" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
          <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="sarah@mitchelllaw.com" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Phone</label>
          <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(305) 555-0100" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">LinkedIn URL</label>
          <Input value={form.linkedinUrl} onChange={e => set("linkedinUrl", e.target.value)} placeholder="linkedin.com/in/sarahmitchell" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Website</label>
          <Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="mitchelllaw.com" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Mailing Address (enables physical letter on Day 4)</label>
        <Input value={form.mailingAddress} onChange={e => set("mailingAddress", e.target.value)} placeholder="123 Main St, Miami, FL 33101" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Audience Type *</label>
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            value={form.audienceType}
            onChange={e => set("audienceType", e.target.value)}
          >
            {AUDIENCE_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm text-gray-600">Spanish warm-touch</span>
            <button
              type="button"
              onClick={() => set("spanishFlag", !form.spanishFlag)}
              className={`w-10 h-5 rounded-full transition-colors ${form.spanishFlag ? "bg-blue-500" : "bg-gray-300"} relative`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.spanishFlag ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </label>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Notes</label>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="How you found them, context, etc." rows={2} />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => mut.mutate(form)}
          disabled={!form.fullName || mut.isPending}
          className="bg-[#1a2a4a] hover:bg-[#243a60] text-white gap-2"
        >
          {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Lead
        </Button>
      </div>
    </div>
  );
}

// ─── Lead Detail ──────────────────────────────────────────────────────────────

function LeadDetail({ lead, onBack }: { lead: PartnerLead; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data } = useQuery<{ lead: PartnerLead; events: PartnerEvent[] }>({
    queryKey: ["partner-lead", lead.id],
    queryFn: () => api(`/api/partner/leads/${lead.id}`),
    refetchInterval: 10000,
  });

  const initMut = useMutation({
    mutationFn: () => api(`/api/partner/leads/${lead.id}/initialize`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Sequence started", description: "8-step partner sequence initialized." });
      qc.invalidateQueries({ queryKey: ["partner-lead", lead.id] });
      qc.invalidateQueries({ queryKey: ["partner-leads"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pauseMut = useMutation({
    mutationFn: () => api(`/api/partner/leads/${lead.id}/pause`, { method: "POST", body: JSON.stringify({ reason: "Manually paused" }) }),
    onSuccess: () => {
      toast({ title: "Sequence paused" });
      qc.invalidateQueries({ queryKey: ["partner-lead", lead.id] });
      qc.invalidateQueries({ queryKey: ["partner-leads"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const repliedMut = useMutation({
    mutationFn: () => api(`/api/partner/leads/${lead.id}/replied`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Marked as replied", description: "Sequence paused and handed to Dylan." });
      qc.invalidateQueries({ queryKey: ["partner-lead", lead.id] });
      qc.invalidateQueries({ queryKey: ["partner-leads"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const linkedinMut = useMutation({
    mutationFn: () => api(`/api/partner/leads/${lead.id}/linkedin-connected`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "LinkedIn connected marked" });
      qc.invalidateQueries({ queryKey: ["partner-lead", lead.id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const currentLead = data?.lead ?? lead;
  const events = data?.events ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      {/* Lead header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold text-gray-900">{currentLead.fullName}</h2>
              {currentLead.spanishFlag && <span className="text-lg" title="Spanish warm-touch active">🇪🇸</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 text-sm text-gray-500 mb-3">
              {currentLead.title && <span>{currentLead.title}</span>}
              {currentLead.title && currentLead.company && <span>·</span>}
              {currentLead.company && <span className="font-medium text-gray-700">{currentLead.company}</span>}
              {currentLead.city && <><span>·</span><span>{currentLead.city}</span></>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={AUDIENCE_COLORS[currentLead.audienceType] ?? "bg-gray-100 text-gray-600"}>
                {AUDIENCE_TYPES.find(a => a.value === currentLead.audienceType)?.label ?? currentLead.audienceType}
              </Badge>
              <Badge className={STATUS_COLORS[currentLead.status] ?? "bg-gray-100 text-gray-600"}>
                {currentLead.status}
              </Badge>
              {currentLead.sequenceFlow && (
                <Badge variant="outline" className="text-xs">
                  {currentLead.sequenceFlow === "lob_enabled" ? "📬 Lob letter" : "📧 Email-only"}
                </Badge>
              )}
              {currentLead.subjectVariant && (
                <Badge variant="outline" className="text-xs">Variant {currentLead.subjectVariant}</Badge>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!currentLead.sequenceStartedAt && (
              <Button size="sm" onClick={() => initMut.mutate()} disabled={initMut.isPending}
                className="bg-[#1a2a4a] hover:bg-[#243a60] text-white gap-1.5">
                {initMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Start Sequence
              </Button>
            )}
            {currentLead.sequenceStartedAt && !currentLead.sequencePaused && currentLead.status !== "replied" && (
              <Button size="sm" variant="outline" onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending}
                className="gap-1.5">
                <Pause className="w-4 h-4" />Pause
              </Button>
            )}
            {!currentLead.linkedinConnected && (
              <Button size="sm" variant="outline" onClick={() => linkedinMut.mutate()} disabled={linkedinMut.isPending}
                className="gap-1.5">
                <Linkedin className="w-4 h-4" />Mark Connected
              </Button>
            )}
            {currentLead.status !== "replied" && (
              <Button size="sm" variant="outline" onClick={() => repliedMut.mutate()} disabled={repliedMut.isPending}
                className="gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50">
                <CheckCircle className="w-4 h-4" />Replied
              </Button>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {currentLead.email && (
            <a href={`mailto:${currentLead.email}`} className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
              <Mail className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="truncate">{currentLead.email}</span>
            </a>
          )}
          {currentLead.phone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{currentLead.phone}</span>
            </div>
          )}
          {currentLead.linkedinUrl && (
            <a href={currentLead.linkedinUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600">
              <Linkedin className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="truncate">LinkedIn</span>
              {currentLead.linkedinConnected && <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />}
            </a>
          )}
          {currentLead.mailingAddress && (
            <div className="flex items-start gap-2 text-gray-600 col-span-2">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <span className="text-xs">{currentLead.mailingAddress}</span>
            </div>
          )}
        </div>

        {currentLead.sequenceStartedAt && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
            Sequence started {fmt(currentLead.sequenceStartedAt)}
            {currentLead.sequencePaused && (
              <span className="ml-2 text-orange-600 font-medium">· Paused</span>
            )}
          </div>
        )}
      </div>

      {/* Sequence Timeline */}
      {events.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Sequence Timeline</h3>
          <div className="space-y-3">
            {events.map((ev, i) => {
              const Icon = EVENT_CHANNEL_ICONS[ev.channel] ?? Mail;
              const isLast = i === events.length - 1;
              return (
                <div key={ev.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      ev.status === "sent" || ev.status === "opened" ? "bg-green-100" :
                      ev.status === "scheduled" ? "bg-gray-100" :
                      ev.status === "failed" ? "bg-red-100" :
                      ev.status === "skipped" || ev.status === "paused" || ev.status === "cancelled" ? "bg-gray-50" :
                      "bg-blue-100"
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        ev.status === "sent" || ev.status === "opened" ? "text-green-600" :
                        ev.status === "scheduled" ? "text-gray-400" :
                        ev.status === "failed" ? "text-red-500" :
                        ev.status === "skipped" ? "text-gray-300" :
                        "text-blue-500"
                      }`} />
                    </div>
                    {!isLast && <div className="w-0.5 bg-gray-100 flex-1 mt-1" />}
                  </div>
                  <div className="pb-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-gray-800">{ev.touchName}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${EVENT_STATUS_COLORS[ev.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {ev.status}
                      </Badge>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400">
                      <span>Day {ev.day}</span>
                      {ev.status === "scheduled" && <span>Scheduled: {fmtDt(ev.scheduledAt)}</span>}
                      {ev.executedAt && <span>Executed: {fmtDt(ev.executedAt)}</span>}
                    </div>
                    {ev.notes && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ev.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {currentLead.notes && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-2">Notes</h3>
          <p className="text-sm text-gray-600 whitespace-pre-line">{currentLead.notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PartnerOutreachSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PartnerLead | null>(null);

  const { data: statsData, isLoading: statsLoading } = useQuery<PartnerStats>({
    queryKey: ["partner-stats"],
    queryFn: () => api("/api/partner/stats"),
    refetchInterval: 30000,
  });

  const { data: leadsData, isLoading: leadsLoading, refetch } = useQuery<{
    leads: PartnerLead[];
    total: number;
  }>({
    queryKey: ["partner-leads", search, audienceFilter, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("q", search);
      if (audienceFilter) p.set("audienceType", audienceFilter);
      if (statusFilter) p.set("status", statusFilter);
      p.set("limit", "100");
      return api(`/api/partner/leads?${p.toString()}`);
    },
    refetchInterval: 15000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/partner/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Lead deleted" });
      qc.invalidateQueries({ queryKey: ["partner-leads"] });
      qc.invalidateQueries({ queryKey: ["partner-stats"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const processMut = useMutation({
    mutationFn: () => api("/api/partner/process", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Sequence processed", description: "All due events have been executed." });
      qc.invalidateQueries({ queryKey: ["partner-leads"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (selectedLead) {
    return (
      <div className="p-6">
        <LeadDetail lead={selectedLead} onBack={() => setSelectedLead(null)} />
      </div>
    );
  }

  const leads = leadsData?.leads ?? [];
  const stats = statsData;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Handshake className="w-6 h-6 text-[#1a2a4a]" />
            Partner Outreach
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            8-step sequence for immigration attorneys, wealth managers, advisors, and E-2 consultants
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="w-4 h-4" />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => processMut.mutate()} disabled={processMut.isPending}
            className="gap-1.5">
            {processMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Sequence
          </Button>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}
            className="bg-[#1a2a4a] hover:bg-[#243a60] text-white gap-1.5">
            <Plus className="w-4 h-4" />Add Partner
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Add New Partner Lead</h2>
          <AddLeadForm
            onClose={() => setShowAddForm(false)}
            onSuccess={() => {
              setShowAddForm(false);
              qc.invalidateQueries({ queryKey: ["partner-leads"] });
              qc.invalidateQueries({ queryKey: ["partner-stats"] });
            }}
          />
        </div>
      )}

      {/* Sequence overview */}
      <div className="bg-gradient-to-r from-[#1a2a4a]/5 to-[#1a2a4a]/10 border border-[#1a2a4a]/10 rounded-xl p-5">
        <h3 className="font-semibold text-[#1a2a4a] mb-3 text-sm uppercase tracking-wide">8-Step Sequence Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { day: 0, ch: "LinkedIn", touch: "Connection Request", icon: "🔗" },
            { day: 1, ch: "Email", touch: "Soft Intro", icon: "📧" },
            { day: 2, ch: "LinkedIn", touch: "DM (if connected)", icon: "💬" },
            { day: 4, ch: "Letter", touch: "Lob Physical Letter", icon: "📬" },
            { day: 7, ch: "Email", touch: "Opportunity + Escrow", icon: "📧" },
            { day: 10, ch: "Email", touch: "Loom Video", icon: "🎬" },
            { day: 14, ch: "Email", touch: "Partnership + Fee", icon: "🤝" },
            { day: 21, ch: "Email", touch: "Breakup (if no reply)", icon: "👋" },
          ].map((s, i) => (
            <div key={i} className="bg-white/60 rounded-lg p-2.5 text-xs">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span>{s.icon}</span>
                <span className="font-medium text-gray-700">Day {s.day} · {s.ch}</span>
              </div>
              <span className="text-gray-500">{s.touch}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">No SMS or WhatsApp. Partner fee revealed in Step 7 only.</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total Partners</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
            <div className="text-xs text-gray-500 mt-0.5">Active Sequences</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.replied}</div>
            <div className="text-xs text-gray-500 mt-0.5">Replied</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="text-2xl font-bold text-emerald-600">
              {stats.byStatus?.booked ?? 0}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Meetings Booked</div>
          </div>
        </div>
      )}

      {/* Audience breakdown */}
      {stats && Object.keys(stats.byAudience).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">By Audience Type</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byAudience).map(([type, count]) => (
              <button
                key={type}
                onClick={() => setAudienceFilter(audienceFilter === type ? "" : type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  audienceFilter === type
                    ? (AUDIENCE_COLORS[type] ?? "bg-gray-100") + " border-transparent"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {AUDIENCE_TYPES.find(a => a.value === type)?.label ?? type}
                <span className="font-bold">{count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, firm, email…"
            className="pl-9"
          />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          value={audienceFilter}
          onChange={e => setAudienceFilter(e.target.value)}
        >
          <option value="">All audience types</option>
          {AUDIENCE_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {["new", "active", "replied", "booked", "converted", "dead", "opted_out"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Leads table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {leadsLoading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />Loading leads…
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400">
            <Handshake className="w-8 h-8 text-gray-300" />
            <p className="text-sm">No partner leads yet. Add your first one above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Audience</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Sequence</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map(lead => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50/50 cursor-pointer group"
                  onClick={() => setSelectedLead(lead)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#1a2a4a]/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-[#1a2a4a]">
                          {lead.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-1.5">
                          {lead.fullName}
                          {lead.spanishFlag && <span className="text-sm">🇪🇸</span>}
                          {lead.linkedinConnected && <span title="LinkedIn connected" className="text-green-500 text-xs">●</span>}
                        </div>
                        <div className="text-xs text-gray-400">
                          {[lead.title, lead.company].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge className={`text-xs ${AUDIENCE_COLORS[lead.audienceType] ?? "bg-gray-100 text-gray-600"}`}>
                      {AUDIENCE_TYPES.find(a => a.value === lead.audienceType)?.label ?? lead.audienceType}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge className={`text-xs ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {lead.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                    {lead.sequenceStartedAt ? (
                      <span className={lead.sequencePaused ? "text-orange-500" : "text-blue-600"}>
                        {lead.sequencePaused ? "⏸ Paused" : "▶ Running"}
                        {lead.sequenceFlow === "lob_enabled" ? " · Lob" : ""}
                      </span>
                    ) : (
                      <span className="text-gray-300">Not started</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                    {fmt(lead.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={e => { e.stopPropagation(); setSelectedLead(lead); }}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(`Delete ${lead.fullName}?`)) deleteMut.mutate(lead.id);
                        }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {leads.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {leadsData?.total ?? leads.length} total partners
          </div>
        )}
      </div>
    </div>
  );
}
