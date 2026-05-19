import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, X, Check, ChevronRight, Star, Mail, MessageSquare, Phone, ExternalLink,
  Globe, Building2, Linkedin, RefreshCw, Trash2, Eye, Pause, Play, PlayCircle,
  BarChart2, Filter, Search, Zap, TrendingUp, Target, Calendar, ArrowRight,
  CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Send, Edit2, Activity,
  Radio, Layers, ListChecks, Megaphone, FileText, ChevronDown, ChevronUp, MapPin,
  Sparkles, BadgeCheck, Inbox, ToggleLeft, ToggleRight, Copy, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// ─── API helper ───────────────────────────────────────────────────────────────
async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface OutreachLead {
  id: string; fullName: string; title?: string; company?: string; email?: string;
  phone?: string; whatsapp?: string; mailingAddress?: string; linkedinUrl?: string;
  linkedinConnected?: boolean; website?: string; category?: string; score: number; status: string;
  optedOut: boolean; notes?: string; lastEnrichedAt?: string; createdAt: string;
  tags: string[]; activity?: ActivityLogEntry[];
  sequenceStartedAt?: string; sequencePaused?: boolean; sequencePausedReason?: string; sequenceFlow?: string;
}
interface SequenceEvent {
  id: string; leadId: string; day: number; channel: string; touchName: string; status: string;
  scheduledAt: string; executedAt?: string; notes?: string; metadata?: any; createdAt: string;
}
interface OutreachCampaign {
  id: string; name: string; tag?: string; goal?: string; status: string;
  startDate?: string; endDate?: string; channelsEnabled?: string[];
  dailySendLimits?: any; abTestEnabled: boolean; autoOptimize: boolean; createdAt: string;
  metrics?: CampaignMetrics | null; steps?: CampaignStep[];
}
interface CampaignStep {
  id: string; campaignId: string; stepNumber: number; channel: string; scheduledDay: number;
  subjectLine?: string; messageBody: string; variant: string; status: string;
}
interface CampaignMetrics {
  id: string; campaignId: string; sent: number; delivered: number; opened: number;
  replied: number; bounced: number; meetingsBooked: number; conversions: number;
  openRate: number; replyRate: number; conversionRate: number;
}
interface ActivityLogEntry {
  id: string; leadId: string; campaignId?: string; channel: string; status: string;
  sentAt?: string; openedAt?: string; repliedAt?: string; messagePreview?: string; createdAt: string;
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  immigration_attorney: "Immigration Attorney",
  relocation_consultant: "Relocation Consultant",
  real_estate: "Real Estate Broker",
  business_consultant: "Business Consultant",
  wealth_manager: "Wealth Manager",
  chamber: "Chamber of Commerce",
  visa_consultant: "Visa Consultant",
  franchise_broker: "Franchise Broker",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-50 text-blue-700",
  active: "bg-green-50 text-green-700",
  replied: "bg-purple-50 text-purple-700",
  nurture: "bg-amber-50 text-amber-700",
  converted: "bg-teal-50 text-teal-700",
  dead: "bg-gray-100 text-gray-500",
};

const CHANNEL_ICONS: Record<string, { icon: any; label: string; color: string }> = {
  email: { icon: Mail, label: "Email", color: "text-blue-500" },
  sms: { icon: Phone, label: "SMS", color: "text-green-500" },
  whatsapp: { icon: MessageSquare, label: "WhatsApp", color: "text-emerald-500" },
  mail: { icon: Inbox, label: "Physical Mail", color: "text-amber-500" },
  heygen: { icon: Radio, label: "HeyGen Video", color: "text-purple-500" },
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "bg-green-50 text-green-700 border border-green-100"
    : score >= 6 ? "bg-blue-50 text-blue-700 border border-blue-100"
    : score >= 4 ? "bg-amber-50 text-amber-700 border border-amber-100"
    : "bg-gray-50 text-gray-500 border border-gray-100";
  return <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${color}`}>{score}</span>;
}

function formatTs(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const m = Math.round(diff / 60000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Lead Profile Drawer ───────────────────────────────────────────────────────

function LeadProfileDrawer({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: lead, isLoading } = useQuery<OutreachLead>({
    queryKey: [`/api/leads/${leadId}`],
    queryFn: () => api(`/api/leads/${leadId}`),
  });
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [editScore, setEditScore] = useState(false);
  const [score, setScore] = useState(0);
  const [tagInput, setTagInput] = useState("");
  const [drawerTab, setDrawerTab] = useState<"overview" | "timeline" | "override" | "history">("override");

  const { data: timelineEvents = [], refetch: refetchTimeline } = useQuery<SequenceEvent[]>({
    queryKey: [`/api/leads/${leadId}/timeline`],
    queryFn: () => api(`/api/leads/${leadId}/timeline`),
    enabled: drawerTab === "timeline" || drawerTab === "override",
    refetchInterval: (drawerTab === "timeline" || drawerTab === "override") ? 10000 : false,
  });

  const startSequenceMutation = useMutation({
    mutationFn: () => api(`/api/leads/${leadId}/sequence/start`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] }); refetchTimeline(); toast({ title: "Sequence started!", description: `${lead?.fullName}'s 11-touch sequence is now live.` }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pauseSequenceMutation = useMutation({
    mutationFn: () => api(`/api/leads/${leadId}/sequence/pause`, { method: "POST", body: JSON.stringify({ reason: "Manually paused" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] }); refetchTimeline(); toast({ title: "Sequence paused" }); },
  });

  const cancelSequenceMutation = useMutation({
    mutationFn: () => api(`/api/leads/${leadId}/sequence/cancel`, { method: "POST", body: JSON.stringify({ reason: "Manually cancelled — Do Not Contact" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] }); refetchTimeline(); toast({ title: "Sequence cancelled — lead marked DNC" }); },
  });

  const linkedInConnectedMutation = useMutation({
    mutationFn: () => api(`/api/leads/${leadId}/linkedin-connected`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] }); refetchTimeline(); toast({ title: "LinkedIn connected! DM events unblocked." }); },
  });

  const patchMutation = useMutation({
    mutationFn: (data: any) => api(`/api/leads/${leadId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] }); qc.invalidateQueries({ queryKey: ["/api/leads"] }); setEditNotes(false); setEditScore(false); toast({ title: "Updated" }); },
  });

  const tagsMutation = useMutation({
    mutationFn: (tags: string[]) => api(`/api/leads/${leadId}/tags`, { method: "PATCH", body: JSON.stringify({ tags }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] }); qc.invalidateQueries({ queryKey: ["/api/leads"] }); qc.invalidateQueries({ queryKey: ["/api/leads/tags"] }); toast({ title: "Tags updated" }); },
  });

  const optOutMutation = useMutation({
    mutationFn: () => api(`/api/leads/${leadId}/optout`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries(); onClose(); toast({ title: "Lead opted out" }); },
  });

  if (isLoading || !lead) return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl m-4 p-8 flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto m-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b bg-gray-50 rounded-t-xl">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-[#1a2a4a] flex items-center justify-center text-white font-bold text-lg shrink-0">
              {lead.fullName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 text-lg">{lead.fullName}</h3>
                <ScoreBadge score={lead.score} />
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-500"}`}>{lead.status}</span>
              </div>
              {lead.title && <p className="text-sm text-gray-600">{lead.title}</p>}
              {lead.company && <p className="text-xs text-gray-400">{lead.company}</p>}
              {lead.category && <Badge variant="outline" className="mt-1 text-xs">{CATEGORY_LABELS[lead.category] || lead.category}</Badge>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Contact info bar — always visible */}
        <div className="grid grid-cols-2 gap-2 px-5 pt-4 pb-0">
          {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline bg-blue-50 rounded-lg px-3 py-2"><Mail className="w-4 h-4 shrink-0" /><span className="truncate">{lead.email}</span></a>}
          {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2"><Phone className="w-4 h-4 shrink-0" />{lead.phone}</a>}
          {lead.whatsapp && <span className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2"><MessageSquare className="w-4 h-4 shrink-0" />{lead.whatsapp}</span>}
          {lead.linkedinUrl && <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2"><Linkedin className="w-4 h-4 shrink-0" />{lead.linkedinConnected ? "✓ Connected" : "LinkedIn"}</a>}
          {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2"><Globe className="w-4 h-4 shrink-0" /><span className="truncate">{lead.website.replace(/^https?:\/\//, "")}</span></a>}
          {lead.mailingAddress && <span className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2"><MapPin className="w-4 h-4 shrink-0" /><span className="truncate">{lead.mailingAddress}</span></span>}
        </div>

        {/* Tab bar */}
        <div className="flex border-b mx-5 mt-4 gap-1 overflow-x-auto">
          {(["overview", "timeline", "override", "history"] as const).map(tab => (
            <button key={tab} onClick={() => setDrawerTab(tab)}
              className={`shrink-0 px-3 py-2 text-xs font-semibold capitalize transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${drawerTab === tab ? "border-[#1a2a4a] text-[#1a2a4a]" : "border-transparent text-gray-400 hover:text-gray-700"}`}>
              {tab === "timeline" ? "Outreach Timeline" : tab === "override" ? <><Zap className="w-3 h-3" />Manual Override</> : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "timeline" && lead.sequenceStartedAt && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${lead.sequencePaused ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                  {lead.sequencePaused ? "paused" : "active"}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5">

          {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
          {drawerTab === "overview" && <>
            {/* Score editor */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Score:</span>
              {editScore ? (
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={10} value={score} onChange={e => setScore(Number(e.target.value))}
                    className="w-16 border rounded px-2 py-1 text-sm" />
                  <Button size="sm" onClick={() => patchMutation.mutate({ score })} className="h-7 text-xs">Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditScore(false)} className="h-7 text-xs">Cancel</Button>
                </div>
              ) : (
                <button className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-blue-600" onClick={() => { setScore(lead.score); setEditScore(true); }}>
                  <ScoreBadge score={lead.score} /><Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" className="text-xs h-8"
                  onClick={() => patchMutation.mutate({ status: lead.status === "nurture" ? "active" : "nurture" })}>
                  {lead.status === "nurture" ? <><Play className="w-3 h-3 mr-1" />Resume</> : <><Pause className="w-3 h-3 mr-1" />Pause</>}
                </Button>
                <Button size="sm" variant="destructive" className="text-xs h-8" onClick={() => optOutMutation.mutate()}>
                  <XCircle className="w-3 h-3 mr-1" />Opt Out
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</span>
                <button onClick={() => { setNotes(lead.notes || ""); setEditNotes(true); }} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"><Edit2 className="w-3 h-3" /> Edit</button>
              </div>
              {editNotes ? (
                <div className="space-y-2">
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => patchMutation.mutate({ notes })} className="h-7 text-xs">Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditNotes(false)} className="h-7 text-xs">Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 min-h-[48px]">{lead.notes || "No notes yet."}</p>
              )}
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(lead.tags || []).map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-medium">
                    #{t}
                    <button className="hover:text-red-500 ml-0.5" onClick={() => tagsMutation.mutate((lead.tags || []).filter(x => x !== t))}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                {!(lead.tags?.length) && <span className="text-xs text-gray-400">No tags yet</span>}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add tag (press Enter)" value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && tagInput.trim()) {
                      const cleaned = tagInput.trim().toLowerCase();
                      const existing = lead.tags || [];
                      if (!existing.includes(cleaned)) tagsMutation.mutate([...existing, cleaned]);
                      setTagInput("");
                    }
                  }} className="h-8 text-xs flex-1" />
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                  if (tagInput.trim()) {
                    const cleaned = tagInput.trim().toLowerCase();
                    const existing = lead.tags || [];
                    if (!existing.includes(cleaned)) tagsMutation.mutate([...existing, cleaned]);
                    setTagInput("");
                  }
                }}>Add</Button>
              </div>
            </div>
          </>}

          {/* ── OUTREACH TIMELINE TAB ─────────────────────────────────── */}
          {drawerTab === "timeline" && (
            <SequenceTimelineTab
              lead={lead}
              events={timelineEvents}
              onStart={() => startSequenceMutation.mutate()}
              onPause={() => pauseSequenceMutation.mutate()}
              onCancel={() => cancelSequenceMutation.mutate()}
              onLinkedInConnected={() => linkedInConnectedMutation.mutate()}
              isStarting={startSequenceMutation.isPending}
            />
          )}

          {/* ── MANUAL OVERRIDE TAB ──────────────────────────────────── */}
          {drawerTab === "override" && (
            <ManualOverrideTab
              lead={lead}
              events={timelineEvents}
              leadId={leadId}
              onTriggered={() => { refetchTimeline(); qc.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] }); }}
              onStart={() => startSequenceMutation.mutate()}
              isStarting={startSequenceMutation.isPending}
            />
          )}

          {/* ── HISTORY TAB ──────────────────────────────────────────── */}
          {drawerTab === "history" && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Outreach History ({lead.activity?.length || 0})</p>
              {!lead.activity?.length ? (
                <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-3">No outreach recorded yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {lead.activity.map(a => {
                    const ch = CHANNEL_ICONS[a.channel] || CHANNEL_ICONS.email;
                    const Icon = ch.icon;
                    return (
                      <div key={a.id} className="flex items-start gap-2.5 bg-gray-50 rounded-lg px-3 py-2">
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ch.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 justify-between">
                            <span className="text-xs font-medium text-gray-700 capitalize">{a.channel} · {a.status}</span>
                            <span className="text-xs text-gray-400">{formatTs(a.sentAt)}</span>
                          </div>
                          {a.messagePreview && <p className="text-xs text-gray-500 truncate">{a.messagePreview}</p>}
                          {a.repliedAt && <span className="text-xs text-green-600 font-medium">✓ Replied {formatTs(a.repliedAt)}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manual Override Tab ─────────────────────────────────────────────────────────

const TRIGGERABLE_STATUSES = new Set(["scheduled", "failed", "paused", "cancelled", "skipped"]);

function ManualOverrideTab({ lead, events, leadId, onTriggered, onStart, isStarting }: {
  lead: OutreachLead;
  events: SequenceEvent[];
  leadId: string;
  onTriggered: () => void;
  onStart: () => void;
  isStarting: boolean;
}) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState<string | null>(null); // eventId being confirmed
  const [triggering, setTriggering] = useState<string | null>(null); // eventId being sent
  const [results, setResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const CHANNEL_META: Record<string, { icon: any; label: string; color: string; bg: string }> = {
    email:    { icon: Mail,           label: "Email",          color: "text-blue-600",    bg: "bg-blue-50" },
    sms:      { icon: MessageSquare,  label: "SMS",            color: "text-green-600",   bg: "bg-green-50" },
    whatsapp: { icon: MessageSquare,  label: "WhatsApp",       color: "text-emerald-600", bg: "bg-emerald-50" },
    linkedin: { icon: Linkedin,       label: "LinkedIn",       color: "text-blue-700",    bg: "bg-blue-50" },
    lob:      { icon: MapPin,         label: "Physical Mail",  color: "text-orange-600",  bg: "bg-orange-50" },
    heygen:   { icon: PlayCircle,     label: "HeyGen Video",   color: "text-purple-600",  bg: "bg-purple-50" },
  };

  const STATUS_PILL: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    sent:      "bg-green-100 text-green-700",
    opened:    "bg-emerald-100 text-emerald-700",
    clicked:   "bg-teal-100 text-teal-700",
    replied:   "bg-violet-100 text-violet-700",
    failed:    "bg-red-100 text-red-600",
    skipped:   "bg-gray-100 text-gray-500",
    paused:    "bg-amber-100 text-amber-700",
    cancelled: "bg-red-100 text-red-500",
  };

  const handleTrigger = async (evt: SequenceEvent) => {
    setTriggering(evt.id);
    setConfirming(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/sequence/trigger/${evt.id}`, { method: "POST", credentials: "include" });
      const data = await res.json();
      setResults(prev => ({ ...prev, [evt.id]: data }));
      if (data.success) {
        toast({ title: `✅ Sent: ${evt.touchName}`, description: data.message?.slice(0, 80) });
        onTriggered();
      } else {
        toast({ title: `Failed: ${evt.touchName}`, description: data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTriggering(null);
    }
  };

  if (!lead.sequenceStartedAt) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-dashed border-[#1a2a4a]/20 bg-[#1a2a4a]/5 p-6 text-center">
          <Activity className="w-8 h-8 text-[#1a2a4a]/40 mx-auto mb-3" />
          <p className="font-semibold text-gray-800 mb-1">11-Touch Broker Sequence</p>
          <p className="text-xs text-gray-500 mb-1 max-w-xs mx-auto">
            6 channels over 21 days — Email, SMS, WhatsApp, LinkedIn, {lead.mailingAddress ? "Lob physical mail" : "HeyGen AI video"}, and more.
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Start the sequence to unlock all steps, then use <strong>Send Now</strong> on any individual step to fire it immediately.
          </p>
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${lead.mailingAddress ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"}`}>
              {lead.mailingAddress ? "📬 Lob Flow (has mailing address)" : "🎬 HeyGen Flow (AI video)"}
            </span>
          </div>
          <Button onClick={onStart} disabled={isStarting} className="bg-[#1a2a4a] hover:bg-[#1a2a4a]/90 text-white gap-2">
            {isStarting ? <><Loader2 className="w-4 h-4 animate-spin" />Starting…</> : <><Play className="w-4 h-4" />Start Sequence &amp; View Steps</>}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header callout */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2.5">
        <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-amber-800">Manual Override Mode</p>
          <p className="text-xs text-amber-700 mt-0.5">Send any step immediately — bypasses the scheduled day and all conditions. The AI sequence continues on its normal schedule for remaining steps.</p>
        </div>
      </div>

      {/* Steps list */}
      {events.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Loading sequence steps…</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">All {events.length} Sequence Steps</p>
          {events.map(evt => {
            const ch = CHANNEL_META[evt.channel] ?? CHANNEL_META.email;
            const Icon = ch.icon;
            const canTrigger = TRIGGERABLE_STATUSES.has(evt.status);
            const isTriggering = triggering === evt.id;
            const isConfirming = confirming === evt.id;
            const result = results[evt.id];
            const alreadySent = ["sent", "opened", "clicked", "replied"].includes(evt.status);

            return (
              <div key={evt.id} className={`rounded-xl border px-3 py-3 transition-all ${alreadySent ? "bg-white border-green-100" : canTrigger ? "bg-white border-gray-200 hover:border-gray-300" : "bg-gray-50 border-gray-100"}`}>
                <div className="flex items-center gap-2.5">
                  {/* Channel icon */}
                  <div className={`w-8 h-8 rounded-lg ${ch.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${ch.color}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800 truncate">{evt.touchName}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${STATUS_PILL[evt.status] ?? STATUS_PILL.scheduled}`}>
                        {evt.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400">
                      <span>Day {evt.day}</span>
                      <span>·</span>
                      <span className={`${ch.color} font-medium`}>{ch.label}</span>
                      {alreadySent && evt.executedAt && (
                        <><span>·</span><span className="text-green-600">Sent {new Date(evt.executedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></>
                      )}
                    </div>
                    {/* Result feedback */}
                    {result && (
                      <p className={`text-[11px] mt-1 leading-snug ${result.success ? "text-green-600" : "text-red-500"}`}>
                        {result.success ? "✓" : "✗"} {result.message?.slice(0, 100)}
                      </p>
                    )}
                  </div>

                  {/* Action button */}
                  <div className="shrink-0">
                    {alreadySent ? (
                      <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Sent</span>
                    ) : canTrigger ? (
                      isTriggering ? (
                        <Button size="sm" disabled className="h-7 text-xs px-3">
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />Sending…
                        </Button>
                      ) : isConfirming ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 border-gray-300"
                            onClick={() => setConfirming(null)}>No</Button>
                          <Button size="sm" className="h-7 text-xs px-3 bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={() => handleTrigger(evt)}>
                            <Send className="w-3 h-3 mr-1" />Yes, Send
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline"
                          className="h-7 text-xs px-3 border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => setConfirming(evt.id)}>
                          <Zap className="w-3 h-3 mr-1" />Send Now
                        </Button>
                      )
                    ) : (
                      <span className="text-[10px] text-gray-400 capitalize">{evt.status}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sequence Timeline Tab Component ────────────────────────────────────────────
const SEQ_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  scheduled: { label: "SCHEDULED", color: "text-blue-700",   bg: "bg-blue-50",   dot: "bg-blue-400" },
  sent:      { label: "SENT",      color: "text-green-700",  bg: "bg-green-50",  dot: "bg-green-500" },
  opened:    { label: "OPENED",    color: "text-emerald-700",bg: "bg-emerald-50",dot: "bg-emerald-500" },
  clicked:   { label: "CLICKED",   color: "text-teal-700",   bg: "bg-teal-50",   dot: "bg-teal-500" },
  replied:   { label: "REPLIED",   color: "text-violet-700", bg: "bg-violet-50", dot: "bg-violet-500" },
  failed:    { label: "FAILED",    color: "text-red-700",    bg: "bg-red-50",    dot: "bg-red-500" },
  skipped:   { label: "SKIPPED",   color: "text-gray-500",   bg: "bg-gray-50",   dot: "bg-gray-400" },
  paused:    { label: "PAUSED",    color: "text-amber-700",  bg: "bg-amber-50",  dot: "bg-amber-500" },
  cancelled: { label: "CANCELLED", color: "text-red-600",    bg: "bg-red-50",    dot: "bg-red-400" },
};

const SEQ_CHANNEL_ICONS: Record<string, { icon: any; label: string; color: string }> = {
  email:    { icon: Mail,           label: "Email",    color: "text-blue-500" },
  sms:      { icon: MessageSquare,  label: "SMS",      color: "text-green-500" },
  whatsapp: { icon: MessageSquare,  label: "WhatsApp", color: "text-emerald-600" },
  linkedin: { icon: Linkedin,       label: "LinkedIn", color: "text-blue-700" },
  lob:      { icon: MapPin,         label: "Physical Mail", color: "text-orange-500" },
  heygen:   { icon: PlayCircle,     label: "HeyGen Video", color: "text-purple-500" },
};

function SequenceTimelineTab({ lead, events, onStart, onPause, onCancel, onLinkedInConnected, isStarting }: {
  lead: OutreachLead;
  events: SequenceEvent[];
  onStart: () => void;
  onPause: () => void;
  onCancel: () => void;
  onLinkedInConnected: () => void;
  isStarting: boolean;
}) {
  const hasSequence = !!lead.sequenceStartedAt;
  const isPaused = lead.sequencePaused;

  const completedCount = events.filter(e => ["sent","opened","clicked","replied"].includes(e.status)).length;
  const failedCount = events.filter(e => e.status === "failed").length;
  const scheduledCount = events.filter(e => e.status === "scheduled").length;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {!hasSequence ? (
        <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 p-5 text-center">
          <Activity className="w-8 h-8 text-blue-400 mx-auto mb-2" />
          <p className="font-semibold text-gray-800 mb-1">11-Touch Broker Sequence</p>
          <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
            6 channels over 21 days — Email, SMS, WhatsApp, LinkedIn, {lead.mailingAddress ? "Lob physical mail" : "HeyGen AI video"}, and more.
          </p>
          <div className="text-xs text-gray-500 mb-4">
            Flow: <span className={`font-semibold px-2 py-0.5 rounded-full ${lead.mailingAddress ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"}`}>
              {lead.mailingAddress ? "📬 Lob Enabled (physical mail)" : "🎬 HeyGen Flow (AI video)"}
            </span>
          </div>
          <Button onClick={onStart} disabled={isStarting} className="gap-2">
            {isStarting ? <><Loader2 className="w-4 h-4 animate-spin" />Starting...</> : <><Play className="w-4 h-4" />Start Sequence</>}
          </Button>
        </div>
      ) : (
        <div className={`rounded-xl p-4 ${isPaused ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${isPaused ? "text-amber-700" : "text-green-700"}`}>
                {isPaused ? "⏸ Sequence Paused" : "▶ Sequence Active"}
              </p>
              <p className="text-xs text-gray-600">
                Started {new Date(lead.sequenceStartedAt!).toLocaleDateString()} ·
                Flow: <span className="font-medium">{lead.sequenceFlow === "lob_enabled" ? "Lob Mail" : "HeyGen Video"}</span>
              </p>
              {isPaused && lead.sequencePausedReason && (
                <p className="text-xs text-amber-700 mt-0.5">{lead.sequencePausedReason}</p>
              )}
            </div>
            <div className="flex gap-1.5">
              {!isPaused && (
                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50" onClick={onPause}>
                  <Pause className="w-3 h-3 mr-1" />Pause
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={onCancel}>
                <XCircle className="w-3 h-3 mr-1" />Cancel (DNC)
              </Button>
            </div>
          </div>
          {/* Progress pills */}
          <div className="flex gap-3 mt-3 text-xs">
            <span className="text-green-700 font-semibold">{completedCount} sent</span>
            <span className="text-blue-700 font-semibold">{scheduledCount} upcoming</span>
            {failedCount > 0 && <span className="text-red-600 font-semibold">{failedCount} failed</span>}
          </div>
        </div>
      )}

      {/* LinkedIn connected toggle */}
      {hasSequence && !lead.linkedinConnected && (
        <button onClick={onLinkedInConnected}
          className="w-full flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors">
          <Linkedin className="w-3.5 h-3.5" />
          Mark LinkedIn as Connected — unlocks LinkedIn DM touches
        </button>
      )}

      {/* Timeline events list */}
      {events.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sequence Timeline ({events.length} events)</p>
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {events.map((evt, i) => {
              const cfg = SEQ_STATUS_CONFIG[evt.status] ?? SEQ_STATUS_CONFIG.scheduled;
              const ch = SEQ_CHANNEL_ICONS[evt.channel] ?? SEQ_CHANNEL_ICONS.email;
              const Icon = ch.icon;
              const isFuture = evt.status === "scheduled";
              return (
                <div key={evt.id} className={`rounded-lg border px-3 py-2.5 ${isFuture ? "border-gray-100 bg-gray-50/50" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-start gap-2.5">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center shrink-0 mt-0.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                      {i < events.length - 1 && <div className="w-px h-4 bg-gray-200 mt-0.5" />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <Icon className={`w-3 h-3 shrink-0 ${ch.color}`} />
                        <span className="text-xs font-medium text-gray-800 truncate">{evt.touchName}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span>Day {evt.day}</span>
                        <span>·</span>
                        <span>{isFuture ? "Scheduled" : "Executed"}: {new Date(isFuture ? evt.scheduledAt : (evt.executedAt ?? evt.scheduledAt)).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {evt.notes && (
                        <p className="text-[11px] text-gray-500 mt-1 leading-snug">{evt.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PANEL 1: Pipeline ────────────────────────────────────────────────────────

export function PipelineSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: "", title: "", company: "", email: "", phone: "", category: "immigration_attorney", score: "7", notes: "" });

  const { data: pipeline } = useQuery<{ pipeline: Record<string, number>; activeCampaigns: number; uniqueTags: number; recentActivity: any[] }>({
    queryKey: ["/api/leads/stats/pipeline"],
    queryFn: () => api("/api/leads/stats/pipeline"),
    refetchInterval: 30000,
  });

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (filterStatus) params.set("status", filterStatus);
  if (filterCategory) params.set("category", filterCategory);
  if (filterTag) params.set("tag", filterTag);

  const { data: allTags = [] } = useQuery<string[]>({
    queryKey: ["/api/leads/tags"],
    queryFn: () => api("/api/leads/tags"),
  });

  const { data: leads = [], isLoading } = useQuery<OutreachLead[]>({
    queryKey: ["/api/leads", search, filterStatus, filterCategory, filterTag],
    queryFn: () => api(`/api/leads?${params}`),
    refetchInterval: 30000,
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => api("/api/leads", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/leads"] }); qc.invalidateQueries({ queryKey: ["/api/leads/stats/pipeline"] }); setShowAddForm(false); setAddForm({ fullName: "", title: "", company: "", email: "", phone: "", category: "immigration_attorney", score: "7", notes: "" }); toast({ title: "Lead added" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusCols = ["new", "active", "replied", "nurture", "converted"];
  const stats = pipeline?.pipeline || {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Users className="w-5 h-5 text-[#1a2a4a]" />Referral Partner Pipeline</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage all referral partner leads</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="bg-[#1a2a4a] hover:bg-[#1a2a4a]/90 text-white text-sm h-9 gap-1.5">
          <Plus className="w-4 h-4" />Add Lead
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        {statusCols.map(s => (
          <button key={s} onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
            className={`rounded-xl p-3 text-center border transition-all ${filterStatus === s ? "border-[#1a2a4a] bg-[#1a2a4a]/5" : "bg-white border-gray-200 hover:border-gray-300"}`}>
            <p className="text-xl font-bold text-gray-900">{stats[s] || 0}</p>
            <p className="text-xs text-gray-500 capitalize mt-0.5">{s}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search leads..." className="pl-9 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white h-9 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/20">
          <option value="">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {allTags.length > 0 && (
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white h-9 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/20">
            <option value="">All Tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {(filterStatus || filterCategory || filterTag || search) && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setFilterStatus(""); setFilterCategory(""); setFilterTag(""); setSearch(""); }}>
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* Lead list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading leads...</div>
      ) : leads.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center">
          <Users className="w-8 h-8 mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">No leads yet</p>
          <p className="text-sm text-gray-400 mt-1">Add a lead manually or use Search & Discover to find referral partners</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => (
            <div key={lead.id} className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-gray-300 transition-all cursor-pointer ${lead.optedOut ? "opacity-50" : ""}`}
              onClick={() => setSelectedLead(lead.id)}>
              <div className="w-9 h-9 rounded-full bg-[#1a2a4a]/10 flex items-center justify-center text-[#1a2a4a] font-bold shrink-0">
                {lead.fullName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900">{lead.fullName}</span>
                  {lead.title && <span className="text-xs text-gray-400 truncate">{lead.title}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {lead.company && <span className="text-xs text-gray-500 flex items-center gap-0.5"><Building2 className="w-3 h-3" />{lead.company}</span>}
                  {lead.category && <Badge variant="outline" className="text-xs py-0 h-4">{CATEGORY_LABELS[lead.category] || lead.category}</Badge>}
                  {lead.email && <span className="text-xs text-blue-500 truncate">{lead.email}</span>}
                  {lead.tags?.map(t => (
                    <span key={t} className="text-xs px-1.5 py-0 rounded bg-violet-50 text-violet-700 font-medium border border-violet-100">#{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <ScoreBadge score={lead.score} />
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-500"}`}>{lead.status}</span>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Lead form */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowAddForm(false)}>
          <div className="bg-white rounded-xl w-full max-w-md m-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-gray-900">Add New Lead</h3>
              <button onClick={() => setShowAddForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <Input placeholder="Full name *" value={addForm.fullName} onChange={e => setAddForm(f => ({ ...f, fullName: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Title" value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} />
                <Input placeholder="Company" value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
                <Input placeholder="Phone" value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                  className="border rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/20">
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 shrink-0">Score</span>
                  <Input type="number" min={1} max={10} value={addForm.score} onChange={e => setAddForm(f => ({ ...f, score: e.target.value }))} />
                </div>
              </div>
              <Textarea placeholder="Notes (optional)" value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-2 p-5 pt-0">
              <Button className="flex-1 bg-[#1a2a4a] hover:bg-[#1a2a4a]/90 text-white"
                onClick={() => addMutation.mutate({ ...addForm, score: Number(addForm.score) })}
                disabled={!addForm.fullName || addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Add Lead
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {selectedLead && <LeadProfileDrawer leadId={selectedLead} onClose={() => setSelectedLead(null)} />}
    </div>
  );
}

// ─── PANEL 2: Lists Manager — REMOVED, grouping now done via tags ─────────────

export function ListsSection() { return null; }

// ─── PANEL 3: Campaigns Dashboard ────────────────────────────────────────────

export function CampaignsDashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "", tag: "", goal: "meeting_booked",
    channelsEnabled: ["email"], abTestEnabled: false, autoOptimize: false,
  });
  const [generatingSequence, setGeneratingSequence] = useState(false);
  const [sequenceCategory, setSequenceCategory] = useState("immigration_attorney");
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const [stepEdit, setStepEdit] = useState({ subjectLine: "", messageBody: "" });
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const { data: campaigns = [], isLoading } = useQuery<(OutreachCampaign & { metrics: CampaignMetrics | null })[]>({
    queryKey: ["/api/campaigns"],
    queryFn: () => api("/api/campaigns"),
    refetchInterval: 30000,
  });

  const { data: allTags = [] } = useQuery<string[]>({
    queryKey: ["/api/leads/tags"],
    queryFn: () => api("/api/leads/tags"),
  });

  const { data: campaign } = useQuery<OutreachCampaign & { steps: CampaignStep[]; metrics: CampaignMetrics | null }>(
    { queryKey: [`/api/campaigns/${selectedCampaignId}`], queryFn: () => api(`/api/campaigns/${selectedCampaignId}`), enabled: !!selectedCampaignId, refetchInterval: 15000 }
  );

  const createMutation = useMutation({
    mutationFn: (data: any) => api("/api/campaigns", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ["/api/campaigns"] }); setSelectedCampaignId(c.id); setShowCreateForm(false); toast({ title: "Campaign created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => api(`/api/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/campaigns"] }); qc.invalidateQueries({ queryKey: [`/api/campaigns/${selectedCampaignId}`] }); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api(`/api/campaigns/${id}/approve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/campaigns"] }); qc.invalidateQueries({ queryKey: [`/api/campaigns/${selectedCampaignId}`] }); toast({ title: "Campaign activated!" }); },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api(`/api/campaigns/${id}/pause`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/campaigns"] }); qc.invalidateQueries({ queryKey: [`/api/campaigns/${selectedCampaignId}`] }); toast({ title: "Campaign paused" }); },
  });

  const updateStepMutation = useMutation({
    mutationFn: ({ stepId, ...data }: any) => api(`/api/campaigns/${selectedCampaignId}/steps/${stepId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/campaigns/${selectedCampaignId}`] }); setEditingStep(null); },
  });

  const deleteStepMutation = useMutation({
    mutationFn: (stepId: string) => api(`/api/campaigns/${selectedCampaignId}/steps/${stepId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/campaigns/${selectedCampaignId}`] }),
  });

  async function generateSequence() {
    if (!selectedCampaignId) return;
    setGeneratingSequence(true);
    try {
      const result = await api(`/api/campaigns/${selectedCampaignId}/generate-sequence`, {
        method: "POST", body: JSON.stringify({ category: sequenceCategory }),
      });
      qc.invalidateQueries({ queryKey: [`/api/campaigns/${selectedCampaignId}`] });
      toast({ title: `Generated ${result.steps?.length || 0} sequence steps` });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingSequence(false);
    }
  }

  async function loadSuggestions() {
    if (!selectedCampaignId) return;
    setLoadingSuggestions(true);
    try {
      const data = await api(`/api/campaigns/${selectedCampaignId}/suggestions`);
      setSuggestions(data);
    } catch { setSuggestions([]); } finally { setLoadingSuggestions(false); }
  }

  const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600", approved: "bg-blue-50 text-blue-700",
    active: "bg-green-50 text-green-700", paused: "bg-amber-50 text-amber-700",
    completed: "bg-teal-50 text-teal-700",
  };

  const GOAL_LABELS: Record<string, string> = {
    awareness: "Brand Awareness", meeting_booked: "Meeting Booked", referral_agreement: "Referral Agreement",
  };

  const CHANNEL_COLORS: Record<string, string> = {
    email: "bg-blue-100 text-blue-700", sms: "bg-green-100 text-green-700",
    whatsapp: "bg-emerald-100 text-emerald-700", mail: "bg-amber-100 text-amber-700", heygen: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Megaphone className="w-5 h-5 text-[#1a2a4a]" />Campaigns Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage multi-channel outreach sequences</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="bg-[#1a2a4a] hover:bg-[#1a2a4a]/90 text-white text-sm h-9 gap-1.5">
          <Plus className="w-4 h-4" />New Campaign
        </Button>
      </div>

      {/* Campaign grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading...</div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center">
          <Megaphone className="w-8 h-8 mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">No campaigns yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first outreach campaign to start contacting referral partners</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id}
              className={`bg-white border rounded-xl p-4 cursor-pointer hover:border-gray-300 transition-all ${selectedCampaignId === c.id ? "border-[#1a2a4a]" : ""}`}
              onClick={() => setSelectedCampaignId(selectedCampaignId === c.id ? null : c.id)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAMPAIGN_STATUS_COLORS[c.status] || "bg-gray-100 text-gray-500"}`}>{c.status}</span>
                    {c.goal && <span className="text-xs text-gray-400">{GOAL_LABELS[c.goal] || c.goal}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {(c.channelsEnabled || []).map(ch => (
                      <span key={ch} className={`text-xs px-1.5 py-0.5 rounded font-medium ${CHANNEL_COLORS[ch] || "bg-gray-100 text-gray-600"}`}>{ch}</span>
                    ))}
                    {c.tag && <span className="text-xs px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100 font-medium">#{c.tag}</span>}
                    {c.metrics && (
                      <span className="text-xs text-gray-400">
                        {c.metrics.sent} sent · {Math.round((c.metrics.openRate || 0) * 100)}% open · {Math.round((c.metrics.replyRate || 0) * 100)}% reply
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${selectedCampaignId === c.id ? "rotate-180" : ""}`} />
              </div>

              {/* Expanded campaign detail */}
              {selectedCampaignId === c.id && campaign && (
                <div className="mt-4 border-t pt-4 space-y-4" onClick={e => e.stopPropagation()}>
                  {/* Campaign actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {campaign.status === "draft" && (
                      <Button size="sm" className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white gap-1"
                        onClick={() => approveMutation.mutate(campaign.id)}>
                        <Play className="w-3 h-3" />Activate Campaign
                      </Button>
                    )}
                    {campaign.status === "active" && (
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
                        onClick={() => pauseMutation.mutate(campaign.id)}>
                        <Pause className="w-3 h-3" />Pause
                      </Button>
                    )}
                    {campaign.status === "paused" && (
                      <Button size="sm" className="text-xs h-7 gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => updateMutation.mutate({ id: campaign.id, status: "active" })}>
                        <Play className="w-3 h-3" />Resume
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
                      onClick={loadSuggestions} disabled={loadingSuggestions}>
                      {loadingSuggestions ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      AI Suggestions
                    </Button>
                  </div>

                  {/* Metrics */}
                  {campaign.metrics && (
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Sent", value: campaign.metrics.sent },
                        { label: "Opened", value: campaign.metrics.opened },
                        { label: "Replied", value: campaign.metrics.replied },
                        { label: "Meetings", value: campaign.metrics.meetingsBooked },
                      ].map(m => (
                        <div key={m.label} className="bg-gray-50 rounded-lg p-2 text-center">
                          <p className="text-lg font-bold text-gray-900">{m.value}</p>
                          <p className="text-xs text-gray-400">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI suggestions */}
                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-blue-500" />Optimization Suggestions</p>
                      {suggestions.map((s, i) => (
                        <div key={i} className={`rounded-lg p-3 border text-sm ${s.priority === "high" ? "bg-red-50 border-red-100" : s.priority === "medium" ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"}`}>
                          <p className="font-semibold text-gray-800">{s.title}</p>
                          <p className="text-gray-600 text-xs mt-0.5">{s.description}</p>
                          {s.action && <p className="text-xs font-medium text-blue-700 mt-1.5">→ {s.action}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sequence builder */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Outreach Sequence ({campaign.steps?.length || 0} steps)</p>
                      <div className="flex items-center gap-2">
                        <select value={sequenceCategory} onChange={e => setSequenceCategory(e.target.value)}
                          className="text-xs border rounded px-2 py-1 text-gray-600 focus:outline-none">
                          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
                          onClick={generateSequence} disabled={generatingSequence}>
                          {generatingSequence ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          AI Generate
                        </Button>
                      </div>
                    </div>
                    {!campaign.steps?.length ? (
                      <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-400">
                        No steps yet. Click "AI Generate" to create an optimized sequence.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {campaign.steps.map(step => {
                          const ch = CHANNEL_ICONS[step.channel] || CHANNEL_ICONS.email;
                          const Icon = ch.icon;
                          return (
                            <div key={step.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                  <span className="w-6 h-6 rounded-full bg-[#1a2a4a] text-white text-xs flex items-center justify-center font-bold shrink-0">{step.stepNumber}</span>
                                  <Icon className={`w-3.5 h-3.5 shrink-0 ${ch.color}`} />
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CHANNEL_COLORS[step.channel] || "bg-gray-100"}`}>{step.channel}</span>
                                  <span className="text-xs text-gray-400">Day {step.scheduledDay}</span>
                                  {step.subjectLine && <span className="text-xs text-gray-600 truncate font-medium">"{step.subjectLine}"</span>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button className="p-1 text-gray-300 hover:text-blue-500" onClick={() => { setEditingStep(step.id); setStepEdit({ subjectLine: step.subjectLine || "", messageBody: step.messageBody }); }}>
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button className="p-1 text-gray-300 hover:text-red-500" onClick={() => deleteStepMutation.mutate(step.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {editingStep === step.id ? (
                                <div className="mt-2 space-y-2">
                                  {step.channel === "email" && (
                                    <Input placeholder="Subject line" value={stepEdit.subjectLine} onChange={e => setStepEdit(s => ({ ...s, subjectLine: e.target.value }))} className="text-xs" />
                                  )}
                                  <Textarea value={stepEdit.messageBody} onChange={e => setStepEdit(s => ({ ...s, messageBody: e.target.value }))} rows={4} className="text-xs" />
                                  <div className="flex gap-2">
                                    <Button size="sm" className="h-7 text-xs" onClick={() => updateStepMutation.mutate({ stepId: step.id, ...stepEdit })}>Save</Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingStep(null)}>Cancel</Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{step.messageBody}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowCreateForm(false)}>
          <div className="bg-white rounded-xl w-full max-w-md m-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-gray-900">Create New Campaign</h3>
              <button onClick={() => setShowCreateForm(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Campaign Name *</label>
                <Input placeholder='e.g. "E-2 Attorneys Q3 2026"' value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Target Tag <span className="font-normal text-gray-400">(optional — filter leads by tag)</span></label>
                <div className="flex gap-2">
                  <Input placeholder="e.g. immigration_attorney_ca" value={createForm.tag}
                    onChange={e => setCreateForm(f => ({ ...f, tag: e.target.value }))}
                    list="campaign-tags" className="flex-1" />
                  <datalist id="campaign-tags">
                    {allTags.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
                <p className="text-xs text-gray-400 mt-1">Contacts tagged with this will be enrolled. Leave blank for manual enrollment.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Goal</label>
                <select value={createForm.goal} onChange={e => setCreateForm(f => ({ ...f, goal: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/20">
                  <option value="awareness">Brand Awareness</option>
                  <option value="meeting_booked">Book a Meeting</option>
                  <option value="referral_agreement">Referral Agreement Signed</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Channels</label>
                <div className="flex gap-2 flex-wrap">
                  {["email","sms","whatsapp","mail"].map(ch => (
                    <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={createForm.channelsEnabled.includes(ch)}
                        onChange={e => setCreateForm(f => ({
                          ...f, channelsEnabled: e.target.checked ? [...f.channelsEnabled, ch] : f.channelsEnabled.filter(c => c !== ch),
                        }))} className="rounded" />
                      <span className="text-sm capitalize">{ch}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createForm.abTestEnabled} onChange={e => setCreateForm(f => ({ ...f, abTestEnabled: e.target.checked }))} className="rounded" />
                  <span className="text-sm">A/B Test</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createForm.autoOptimize} onChange={e => setCreateForm(f => ({ ...f, autoOptimize: e.target.checked }))} className="rounded" />
                  <span className="text-sm">Auto-Optimize</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 p-5 pt-0">
              <Button className="flex-1 bg-[#1a2a4a] hover:bg-[#1a2a4a]/90 text-white"
                onClick={() => createMutation.mutate(createForm)} disabled={!createForm.name || createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Create Campaign
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PANEL 4: Activity Feed ───────────────────────────────────────────────────

export function ActivityFeedSection() {
  const { data: activity = [], isLoading, refetch } = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/outreach/log"],
    queryFn: () => api("/api/outreach/log?limit=100"),
    refetchInterval: 20000,
  });

  const { data: leads = [] } = useQuery<OutreachLead[]>({
    queryKey: ["/api/leads"],
    queryFn: () => api("/api/leads"),
  });
  const leadMap = new Map(leads.map(l => [l.id, l]));

  const getStatusStyle = (status: string) => {
    if (["replied", "clicked"].includes(status)) return "border-l-green-400 bg-green-50";
    if (["opened"].includes(status)) return "border-l-blue-400 bg-blue-50";
    if (["bounced", "failed"].includes(status)) return "border-l-red-400 bg-red-50";
    return "border-l-gray-300 bg-white";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Activity className="w-5 h-5 text-[#1a2a4a]" />Activity Feed</h2>
          <p className="text-sm text-gray-500 mt-0.5">Live feed of all outreach actions</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="h-9 gap-1.5 text-sm">
          <RefreshCw className="w-4 h-4" />Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading activity...</div>
      ) : activity.length === 0 ? (
        <div className="bg-white border rounded-xl p-10 text-center">
          <Activity className="w-8 h-8 mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">No outreach activity yet</p>
          <p className="text-sm text-gray-400 mt-1">Activity will appear here as messages are sent</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activity.map(a => {
            const lead = leadMap.get(a.leadId);
            const ch = CHANNEL_ICONS[a.channel] || CHANNEL_ICONS.email;
            const Icon = ch.icon;
            return (
              <div key={a.id} className={`border-l-4 rounded-r-xl px-4 py-3 ${getStatusStyle(a.status || "sent")}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ch.color}`} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">{lead?.fullName || `Lead ${a.leadId.slice(0, 8)}`}</span>
                        {lead?.company && <span className="text-xs text-gray-400">{lead.company}</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${
                          a.status === "replied" ? "bg-green-100 text-green-700"
                          : a.status === "opened" ? "bg-blue-100 text-blue-700"
                          : a.status === "failed" || a.status === "bounced" ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                        }`}>{a.status}</span>
                      </div>
                      {a.messagePreview && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{a.messagePreview}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatTs(a.sentAt || a.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PANEL 5: Search & Discover ───────────────────────────────────────────────

export function DiscoverSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("immigration_attorney");
  const [location, setLocation] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [showTagPicker, setShowTagPicker] = useState<number | null>(null);
  const [tagInputDiscover, setTagInputDiscover] = useState("");

  const { data: allTags = [] } = useQuery<string[]>({
    queryKey: ["/api/leads/tags"],
    queryFn: () => api("/api/leads/tags"),
  });

  async function handleSearch() {
    if (!query.trim()) return;
    setIsSearching(true);
    setResults([]);
    try {
      const data = await api("/api/leads/research", {
        method: "POST",
        body: JSON.stringify({ description: query, category, location, scoreThreshold: 4 }),
      });
      setResults(data.leads || []);
      if (!data.leads?.length) toast({ title: "No results found", description: "Try a different search term or category" });
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }

  async function saveLeadToPipeline(lead: any, index: number) {
    try {
      await api("/api/leads", { method: "POST", body: JSON.stringify(lead) });
      setSavedIds(prev => new Set(prev).add(index));
      qc.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({ title: "Added to pipeline" });
    } catch (e: any) {
      if (e.message?.includes("duplicate")) toast({ title: "Already in pipeline" });
      else toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  async function saveLeadWithTag(lead: any, tag: string, index: number) {
    try {
      const saved = await api("/api/leads", { method: "POST", body: JSON.stringify({ ...lead, tags: [tag] }) });
      if (saved?.id && (lead.tags || []).length === 0) {
        await api(`/api/leads/${saved.id}/tags`, { method: "PATCH", body: JSON.stringify({ tags: [tag] }) });
      }
      setSavedIds(prev => new Set(prev).add(index));
      qc.invalidateQueries({ queryKey: ["/api/leads"] });
      qc.invalidateQueries({ queryKey: ["/api/leads/tags"] });
      setShowTagPicker(null);
      setTagInputDiscover("");
      toast({ title: `Saved with tag #${tag}` });
    } catch (e: any) {
      if (e.message?.includes("duplicate")) toast({ title: "Already in pipeline" });
      else toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  const SUGGESTED_SEARCHES = [
    { text: "E-2 visa attorneys in California", category: "immigration_attorney", location: "California" },
    { text: "Franchise brokers serving E-2 visa clients", category: "franchise_broker", location: "" },
    { text: "International relocation consultants Texas", category: "relocation_consultant", location: "Texas" },
    { text: "Immigration law firms New York", category: "immigration_attorney", location: "New York" },
    { text: "Wealth managers foreign national clients", category: "wealth_manager", location: "" },
    { text: "Foreign national real estate agents Florida", category: "real_estate", location: "Florida" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Search className="w-5 h-5 text-[#1a2a4a]" />Search & Discover</h2>
        <p className="text-sm text-gray-500 mt-0.5">Find and enrich referral partner leads using AI-powered research</p>
      </div>

      {/* Search form */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <Textarea placeholder='Describe who you want to find, e.g. "E-2 visa immigration attorneys in California with active LinkedIn presence and recent published content"'
          value={query} onChange={e => setQuery(e.target.value)} rows={2} className="text-sm resize-none" />
        <div className="flex gap-2 flex-wrap">
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white h-9 focus:outline-none focus:ring-2 focus:ring-[#1a2a4a]/20 flex-1">
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Input placeholder="Location (optional)" value={location} onChange={e => setLocation(e.target.value)} className="h-9 text-sm flex-1" />
          <Button onClick={handleSearch} disabled={isSearching || !query.trim()} className="bg-[#1a2a4a] hover:bg-[#1a2a4a]/90 text-white h-9 gap-1.5 text-sm">
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </div>
      </div>

      {/* Suggested searches */}
      {results.length === 0 && !isSearching && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Suggested Searches</p>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTED_SEARCHES.map((s, i) => (
              <button key={i} className="text-left bg-white border rounded-xl px-4 py-3 hover:border-[#1a2a4a]/30 hover:bg-[#1a2a4a]/5 transition-all text-sm text-gray-700"
                onClick={() => { setQuery(s.text); setCategory(s.category); setLocation(s.location); }}>
                <p className="font-medium">{s.text}</p>
                <p className="text-xs text-gray-400 mt-0.5">{CATEGORY_LABELS[s.category]}{s.location ? ` · ${s.location}` : ""}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {isSearching && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-sm">Searching web directories, enriching with Apollo...</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">{results.length} leads found</p>
            <button className="text-xs text-blue-600 hover:underline" onClick={() => setResults([])}>Clear results</button>
          </div>
          {results.map((lead, i) => (
            <div key={i} className={`bg-white border rounded-xl p-4 transition-all ${savedIds.has(i) ? "border-green-200 bg-green-50/30" : "hover:border-gray-300"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-900">{lead.fullName}</span>
                    {lead.title && <span className="text-xs text-gray-400">{lead.title}</span>}
                    <ScoreBadge score={lead.score || 5} />
                    {savedIds.has(i) && <span className="text-xs text-green-600 font-medium flex items-center gap-0.5"><BadgeCheck className="w-3.5 h-3.5" />Saved</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {lead.company && <span className="text-xs text-gray-500 flex items-center gap-1"><Building2 className="w-3 h-3" />{lead.company}</span>}
                    {lead.email && <span className="text-xs text-blue-500">{lead.email}</span>}
                    {lead.phone && <span className="text-xs text-gray-500">{lead.phone}</span>}
                    {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-0.5"><ExternalLink className="w-3 h-3" />Website</a>}
                  </div>
                  {lead.notes && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{lead.notes}</p>}
                </div>
                {!savedIds.has(i) && (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button size="sm" className="h-7 text-xs bg-[#1a2a4a] hover:bg-[#1a2a4a]/90 text-white gap-1"
                      onClick={() => saveLeadToPipeline(lead, i)}>
                      <Plus className="w-3 h-3" />Pipeline
                    </Button>
                    <div className="relative">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 w-full"
                        onClick={() => { setShowTagPicker(showTagPicker === i ? null : i); setTagInputDiscover(""); }}>
                        <Tag className="w-3 h-3" />Tag & Save
                      </Button>
                      {showTagPicker === i && (
                        <div className="absolute right-0 top-full mt-1 bg-white border shadow-lg rounded-lg z-20 min-w-52 p-2 space-y-1.5">
                          <div className="flex gap-1">
                            <input
                              placeholder="New tag..."
                              value={tagInputDiscover}
                              onChange={e => setTagInputDiscover(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter" && tagInputDiscover.trim()) saveLeadWithTag(lead, tagInputDiscover.trim().toLowerCase(), i); }}
                              className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-300"
                            />
                            <button className="px-2 py-1 bg-violet-600 text-white rounded text-xs"
                              onClick={() => tagInputDiscover.trim() && saveLeadWithTag(lead, tagInputDiscover.trim().toLowerCase(), i)}>+</button>
                          </div>
                          {allTags.length > 0 && <p className="text-xs text-gray-400">Or pick existing:</p>}
                          {allTags.map(t => (
                            <button key={t} className="w-full text-left px-2 py-1 text-xs text-violet-700 hover:bg-violet-50 rounded transition-colors"
                              onClick={() => saveLeadWithTag(lead, t, i)}>
                              #{t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
