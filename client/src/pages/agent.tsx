import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, LayoutDashboard, Users, Mail, MessageSquare, Globe, Settings,
  PlayCircle, PauseCircle, CheckCircle, XCircle, Clock, Send, RefreshCw,
  Plus, Trash2, ExternalLink, ChevronRight, AlertTriangle, TrendingUp,
  Zap, Eye, Edit2, Phone, Linkedin, MapPin, Building2, Search, Filter,
  Download, Upload, Shield, Star, Activity, BarChart2, ChevronDown, ChevronUp,
  X, Check, Copy, Target, Calendar, ArrowRight, Info, Loader2, Video,
  MessageCircle, User, Brain, Handshake, FileText, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { HeygenSendPanel, LeadVideosSection } from "@/components/heygen-send-panel";
import { PipelineSection, CampaignsDashboard, ActivityFeedSection, DiscoverSection } from "@/pages/leadgen-panels";
import { PartnerOutreachSection } from "@/pages/partner-outreach-section";

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as any;
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentStats {
  totalLeads: number;
  todayBatch: DailyBatch | null;
  sentToday: number;
  repliedToday: number;
  recentActivity: RunLog[];
  upcomingFollowUps: AgentLead[];
}
interface DailyBatch {
  id: string; batchDate: string; approvalStatus: string;
  briefEmailSentAt?: string; totalStaged: number; totalSent: number;
  totalFailed: number; approvedAt?: string; executedAt?: string;
}
interface AgentLead {
  id: string; firstName: string; lastName: string; email?: string;
  phone?: string; company?: string; title?: string; country?: string;
  source: string; aiScore: number; stage: string; tags: string[];
  linkedinUrl?: string; notes?: string; investmentType?: string;
  sequenceStage: number; lastContactedAt?: string; nextFollowUpAt?: string;
  dnc: boolean; createdAt: string;
}
interface AgentMessage {
  id: string; leadId: string; channel: string; subject?: string;
  body: string; status: string; touchNumber: number;
  sentAt?: string; repliedAt?: string; createdAt: string;
}
interface ForumPost {
  id: string; platform: string; postUrl: string; postTitle: string;
  postBody?: string; author?: string; draftReply?: string; status: string;
}
interface Competitor {
  id: string; name: string; domain: string;
  lastScannedAt?: string; insights?: any;
}
interface RunLog {
  id: string; runType: string; status: string;
  summary?: any; createdAt: string; completedAt?: string;
}
interface AgentSettings {
  approvalEmail: string; briefSendHour: number; approvalDeadlineHour: number;
  maxLeadsPerDay: number; maxEmailsPerDay: number; maxWhatsappPerDay: number;
  calendlyLink?: string; dylanBio?: string; dylanVoiceSamples: string[];
  prohibitedPhrases: string[]; targetCountries: string[];
  blacklistDomains: string[]; agentPaused: boolean; slackWebhookUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 75) return "bg-green-100 text-green-700";
  if (score >= 50) return "bg-yellow-100 text-yellow-700";
  if (score >= 25) return "bg-orange-100 text-orange-700";
  return "bg-gray-100 text-gray-500";
}
function stageColor(stage: string) {
  const m: Record<string, string> = {
    new: "bg-blue-50 text-blue-700",
    contacted: "bg-indigo-50 text-indigo-700",
    replied: "bg-yellow-50 text-yellow-700",
    call_scheduled: "bg-purple-50 text-purple-700",
    converted: "bg-green-50 text-green-700",
    lost: "bg-red-50 text-red-600",
    dnc: "bg-gray-100 text-gray-500",
  };
  return m[stage] || "bg-gray-100 text-gray-600";
}
function statusColor(status: string) {
  const m: Record<string, string> = {
    staged: "bg-blue-100 text-blue-700",
    executing: "bg-yellow-100 text-yellow-700 animate-pulse",
    sent: "bg-green-100 text-green-700",
    replied: "bg-purple-100 text-purple-700",
    failed: "bg-red-100 text-red-600",
    held: "bg-gray-100 text-gray-500",
    pending: "bg-yellow-50 text-yellow-600",
    approved: "bg-green-50 text-green-700",
    executed: "bg-green-100 text-green-800",
  };
  return m[status] || "bg-gray-100 text-gray-600";
}
function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────
type SectionId = "dashboard" | "leads" | "outreach" | "forum" | "competitors" | "settings" | "dnc" | "chat" | "pipeline" | "campaigns" | "activity" | "discover" | "visitors" | "meetings" | "outreach-campaigns" | "approval-inbox" | "reply-center" | "linkedin-queue" | "voice-profile" | "comms" | "intelligence" | "partner-outreach";
const NAV: { id: SectionId; label: string; icon: any; dividerBefore?: boolean; badge?: string }[] = [
  { id: "dashboard", label: "Command Center", icon: LayoutDashboard },
  { id: "chat", label: "Ask the Agent", icon: MessageCircle },
  { id: "leads", label: "Agent Leads", icon: Users },
  { id: "outreach", label: "Agent Outreach", icon: Mail },
  { id: "forum", label: "Forum Drafts", icon: MessageSquare },
  { id: "competitors", label: "Competitors", icon: Globe },
  { id: "dnc", label: "Do Not Contact", icon: Shield },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "pipeline", label: "Pipeline", icon: Target, dividerBefore: true },
  { id: "campaigns", label: "Campaigns", icon: Zap },
  { id: "activity", label: "Activity Feed", icon: Activity },
  { id: "discover", label: "Search & Discover", icon: Search },
  { id: "visitors", label: "Visitor Intelligence", icon: Eye, dividerBefore: true },
  { id: "meetings", label: "Meetings", icon: Calendar },
  { id: "outreach-campaigns", label: "Outreach Campaigns", icon: Target, dividerBefore: true },
  { id: "approval-inbox", label: "Approval Inbox", icon: CheckCircle },
  { id: "reply-center", label: "Reply Center", icon: MessageCircle },
  { id: "linkedin-queue", label: "LinkedIn Queue", icon: Users },
  { id: "voice-profile", label: "Voice Profile", icon: Settings },
  { id: "comms", label: "SMS Communications", icon: MessageCircle, dividerBefore: true },
  { id: "intelligence", label: "Daily Intelligence", icon: Brain, dividerBefore: true },
  { id: "partner-outreach", label: "Partner Outreach", icon: Handshake, dividerBefore: true },
];

// ─── Approval Banner ──────────────────────────────────────────────────────────
function ApprovalBanner({ batch, onApprove, onHold, approveLoading, holdLoading }:
  { batch: DailyBatch | null; onApprove: () => void; onHold: () => void; approveLoading: boolean; holdLoading: boolean }) {
  if (!batch) return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-center gap-3">
      <Clock className="w-5 h-5 text-gray-400" />
      <span className="text-gray-500 text-sm">No batch today yet — the agent runs at 6 AM to prepare today's outreach.</span>
    </div>
  );

  const statusConfig: Record<string, { bg: string; icon: any; label: string; desc: string }> = {
    preparing: { bg: "bg-blue-50 border-blue-200", icon: RefreshCw, label: "Preparing", desc: "Agent is discovering leads and drafting messages…" },
    pending: { bg: "bg-yellow-50 border-yellow-300", icon: Clock, label: "Waiting for your approval", desc: `${batch.totalStaged} message${batch.totalStaged !== 1 ? "s" : ""} staged. Reply YES to your email or approve below.` },
    approved: { bg: "bg-green-50 border-green-300", icon: CheckCircle, label: "Approved — executing", desc: `Sending ${batch.totalStaged} messages with staggered delays…` },
    executing: { bg: "bg-green-50 border-green-300", icon: Send, label: "Executing", desc: "Messages are being sent now…" },
    executed: { bg: "bg-emerald-50 border-emerald-300", icon: Check, label: "Executed ✓", desc: `${batch.totalSent} sent, ${batch.totalFailed} failed.` },
    held: { bg: "bg-gray-50 border-gray-300", icon: PauseCircle, label: "Held", desc: "Today's batch was held. Messages will be retried tomorrow." },
    failed: { bg: "bg-red-50 border-red-300", icon: AlertTriangle, label: "Failed", desc: "Something went wrong. Check logs." },
    preparing_failed: { bg: "bg-red-50 border-red-300", icon: AlertTriangle, label: "Preparation failed", desc: "Check logs for details." },
  };
  const cfg = statusConfig[batch.approvalStatus] || statusConfig.pending;
  const Icon = cfg.icon;

  return (
    <div className={`${cfg.bg} border rounded-xl p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 mt-0.5 ${batch.approvalStatus === "executed" ? "text-emerald-600" : batch.approvalStatus === "held" ? "text-gray-500" : "text-yellow-600"}`} />
          <div>
            <p className="font-semibold text-gray-900">{cfg.label}</p>
            <p className="text-sm text-gray-600 mt-0.5">{cfg.desc}</p>
          </div>
        </div>
        {batch.approvalStatus === "pending" && (
          <div className="flex gap-2 shrink-0">
            <Button size="sm" onClick={onApprove} disabled={approveLoading}
              className="bg-green-600 hover:bg-green-700 text-white gap-1.5">
              <Check className="w-4 h-4" />
              {approveLoading ? "Approving…" : "Approve All"}
            </Button>
            <Button size="sm" variant="outline" onClick={onHold} disabled={holdLoading}>
              {holdLoading ? "Holding…" : "Hold"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AgentPage() {
  const [section, setSection] = useState<SectionId>("dashboard");
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const navigate = (id: SectionId) => {
    setSection(id);
    // Auto-close sidebar on mobile after selecting
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  // Check URL params for auto-actions and deep-links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // ?s=approval-inbox  — deep-link from SMS / daily brief to a specific section
    const sectionParam = params.get("s");
    if (sectionParam && ["dashboard","leads","outreach","forum","competitors","settings","dnc","chat","pipeline","campaigns","activity","discover","visitors","meetings","outreach-campaigns","approval-inbox","reply-center","linkedin-queue","voice-profile","comms","intelligence","partner-outreach"].includes(sectionParam)) {
      setSection(sectionParam as SectionId);
      window.history.replaceState({}, "", "/agent");
    }

    if (params.get("approve")) {
      const batchId = params.get("approve")!;
      api(`/api/agent/batches/${batchId}/approve`, { method: "POST", body: JSON.stringify({}) })
        .then(() => { toast({ title: "Approved!", description: "Batch execution started." }); qc.invalidateQueries(); })
        .catch(e => toast({ title: "Error", description: e.message, variant: "destructive" }));
      window.history.replaceState({}, "", "/agent");
    }
    if (params.get("hold")) {
      const batchId = params.get("hold")!;
      api(`/api/agent/batches/${batchId}/hold`, { method: "POST", body: JSON.stringify({}) })
        .then(() => { toast({ title: "Held", description: "Today's batch has been held." }); qc.invalidateQueries(); })
        .catch(e => toast({ title: "Error", description: e.message, variant: "destructive" }));
      window.history.replaceState({}, "", "/agent");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-[#1a2a4a] text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Hamburger toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
            <div className="w-5 flex flex-col gap-1">
              <span className={`block h-0.5 bg-white transition-all duration-200 ${sidebarOpen ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`block h-0.5 bg-white transition-all duration-200 ${sidebarOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 bg-white transition-all duration-200 ${sidebarOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </div>
          </button>
          <Bot className="w-5 h-5 text-blue-300 shrink-0" />
          <span className="font-bold text-base tracking-tight">AI Outreach Agent</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/crm")}
            className="text-blue-200 hover:text-white text-sm flex items-center gap-1">
            <ArrowRight className="w-4 h-4" /> CRM
          </button>
          <button onClick={() => setLocation("/seo")}
            className="text-blue-200 hover:text-white text-sm flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> SEO
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed md:relative inset-y-0 left-0 z-30 md:z-auto
          w-56 bg-white border-r border-gray-200 flex flex-col py-4 shrink-0
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0 shadow-xl md:shadow-none" : "-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-0 md:py-0"}
        `}
          style={{ top: "49px" }}
        >
          {NAV.map(({ id, label, icon: Icon, dividerBefore }) => (
            <div key={id}>
              {dividerBefore && (
                <div className="mx-4 my-2 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pt-2 pb-0.5 px-0">Lead Gen</p>
                </div>
              )}
              <button onClick={() => navigate(id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
                  section === id ? "bg-[#1a2a4a] text-white font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 min-w-0">
          {section === "dashboard" && <DashboardSection onNavigate={navigate} />}
          {section === "chat" && <ChatSection />}
          {section === "leads" && <LeadsSection />}
          {section === "outreach" && <OutreachSection />}
          {section === "forum" && <ForumSection />}
          {section === "competitors" && <CompetitorsSection />}
          {section === "dnc" && <DncSection />}
          {section === "settings" && <SettingsSection />}
          {section === "pipeline" && <PipelineSection />}
          {section === "campaigns" && <CampaignsDashboard />}
          {section === "activity" && <ActivityFeedSection />}
          {section === "discover" && <DiscoverSection />}
          {section === "visitors" && <VisitorIntelligenceSection />}
          {section === "meetings" && <MeetingsSection />}
          {section === "outreach-campaigns" && <OutreachCampaignsSection />}
          {section === "approval-inbox" && <ApprovalInboxSection />}
          {section === "reply-center" && <ReplyCenterSection />}
          {section === "linkedin-queue" && <LinkedInQueueSection />}
          {section === "voice-profile" && <VoiceProfileSection />}
          {section === "comms" && <AgentSmsCommsSection agentType="outreach" />}
          {section === "intelligence" && <DailyIntelligenceSection />}
          {section === "partner-outreach" && <PartnerOutreachSection />}
        </main>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardSection({ onNavigate }: { onNavigate: (s: SectionId) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: stats, isLoading } = useQuery<AgentStats>({
    queryKey: ["agent-stats"],
    queryFn: () => api("/api/agent/stats"),
    refetchInterval: 30000,
  });
  const { data: settings } = useQuery<AgentSettings>({ queryKey: ["agent-settings"], queryFn: () => api("/api/agent/settings") });

  const approveMut = useMutation({
    mutationFn: () => api(`/api/agent/batches/${stats?.todayBatch?.id}/approve`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => { qc.invalidateQueries(); toast({ title: "Approved!", description: "Batch execution started." }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const holdMut = useMutation({
    mutationFn: () => api(`/api/agent/batches/${stats?.todayBatch?.id}/hold`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => { qc.invalidateQueries(); toast({ title: "Held", description: "Today's batch held." }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const prepareMut = useMutation({
    mutationFn: () => api("/api/agent/run/prepare", { method: "POST", body: "{}" }),
    onSuccess: () => { toast({ title: "Preparation started", description: "Agent is discovering and staging leads…" }); qc.invalidateQueries({ queryKey: ["agent-stats"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const briefMut = useMutation({
    mutationFn: () => api("/api/agent/run/brief", { method: "POST", body: "{}" }),
    onSuccess: () => toast({ title: "Brief sent", description: `Check ${settings?.approvalEmail || "your approval email"} — reply YES to approve.` }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const pauseMut = useMutation({
    mutationFn: () => api(settings?.agentPaused ? "/api/agent/resume" : "/api/agent/pause", { method: "POST", body: "{}" }),
    onSuccess: () => { qc.invalidateQueries(); toast({ title: settings?.agentPaused ? "Agent resumed" : "Agent paused" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const discoverMut = useMutation({
    mutationFn: () => api("/api/agent/run/discover", { method: "POST", body: JSON.stringify({ max: 25 }) }),
    onSuccess: () => toast({ title: "Discovery started", description: "Pulling new leads from Apollo…" }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-gray-400 text-sm p-4">Loading…</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Command Center</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending}
            className={settings?.agentPaused ? "border-green-300 text-green-700" : "border-orange-300 text-orange-600"}>
            {settings?.agentPaused ? <><PlayCircle className="w-4 h-4 mr-1" />Resume Agent</> : <><PauseCircle className="w-4 h-4 mr-1" />Pause Agent</>}
          </Button>
          {settings?.agentPaused && (
            <Badge className="bg-orange-100 text-orange-700 border-orange-200 self-center">⏸ PAUSED</Badge>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: stats?.totalLeads ?? 0, icon: Users, color: "text-blue-600" },
          { label: "Sent Today", value: stats?.sentToday ?? 0, icon: Send, color: "text-green-600" },
          { label: "Replied Today", value: stats?.repliedToday ?? 0, icon: MessageSquare, color: "text-purple-600" },
          { label: "Staged Today", value: stats?.todayBatch?.totalStaged ?? 0, icon: Clock, color: "text-yellow-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      {/* Approval banner */}
      <ApprovalBanner
        batch={stats?.todayBatch ?? null}
        onApprove={() => approveMut.mutate()}
        onHold={() => holdMut.mutate()}
        approveLoading={approveMut.isPending}
        holdLoading={holdMut.isPending}
      />

      {/* Manual controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" />Manual Controls</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => prepareMut.mutate()} disabled={prepareMut.isPending}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />{prepareMut.isPending ? "Running…" : "Run Preparation Now"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => briefMut.mutate()} disabled={briefMut.isPending}>
            <Mail className="w-3.5 h-3.5 mr-1.5" />{briefMut.isPending ? "Sending…" : "Send Daily Brief"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => discoverMut.mutate()} disabled={discoverMut.isPending}>
            <Search className="w-3.5 h-3.5 mr-1.5" />{discoverMut.isPending ? "Discovering…" : "Discover Leads (Apollo)"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { qc.invalidateQueries(); toast({ title: "Refreshed" }); }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-3">Scheduled: Prep 8 AM ET · Brief 9 AM ET · Reply poll every 15 min · Deadline 2 PM ET — brief sent to: <strong>{settings?.approvalEmail || "(not set)"}</strong></p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity feed */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" />Agent Activity Log</h2>
          {!stats?.recentActivity?.length ? (
            <p className="text-sm text-gray-400">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.recentActivity.map(log => (
                <div key={log.id} className="flex items-start gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${log.status === "completed" ? "bg-green-100 text-green-700" : log.status === "failed" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}>
                    {log.runType.replace("_", " ")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-700 truncate">
                      {log.summary ? JSON.stringify(log.summary).replace(/[{}"]/g, "").replace(/,/g, " · ") : log.status}
                    </div>
                    <div className="text-gray-400 text-xs">{fmt(log.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming follow-ups */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-purple-500" />Upcoming Follow-Ups</h2>
          {!stats?.upcomingFollowUps?.length ? (
            <p className="text-sm text-gray-400">No follow-ups due in the next 48 hours.</p>
          ) : (
            <div className="space-y-2">
              {stats.upcomingFollowUps.map(lead => (
                <div key={lead.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 text-sm truncate">{lead.firstName} {lead.lastName}</div>
                    <div className="text-gray-400 text-xs">{lead.company || lead.country || "—"} · Touch {lead.sequenceStage + 1}</div>
                  </div>
                  <div className="text-xs text-gray-500 shrink-0">{lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendly + Integrations row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CalendlyWidget />
        <IntegrationsStatus />
      </div>
    </div>
  );
}

// ─── Calendly Widget ─────────────────────────────────────────────────────────
function CalendlyWidget() {
  const { data: stats } = useQuery<any>({ queryKey: ["agent-calendly-stats"], queryFn: () => api("/api/agent/calendly/stats"), retry: false });
  const { data: upcoming = [] } = useQuery<any[]>({ queryKey: ["agent-calendly-upcoming"], queryFn: () => api("/api/agent/calendly/upcoming"), retry: false });

  if (!stats?.configured) return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-purple-500" />Bookings (Calendly)
      </h2>
      <div className="text-sm text-gray-400">Calendly not connected. Add CALENDLY_API_KEY to enable.</div>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-500" />Upcoming Bookings
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{stats.upcomingCount} upcoming</span>
          {stats.schedulingUrl && (
            <a href={stats.schedulingUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />Book link
            </a>
          )}
        </div>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-sm text-gray-400">No upcoming calls scheduled.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.slice(0, 5).map((b: any) => {
            const invitee = b.invitees?.[0];
            const start = new Date(b.startTime);
            return (
              <div key={b.uri} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="bg-purple-100 text-purple-700 rounded-lg px-2 py-1 text-center shrink-0 min-w-[48px]">
                  <div className="text-xs font-semibold">{start.toLocaleDateString("en-US", { month: "short" })}</div>
                  <div className="text-lg font-bold leading-none">{start.getDate()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800 text-sm">{invitee?.name || b.name}</div>
                  <div className="text-gray-500 text-xs">{invitee?.email || ""}</div>
                  <div className="text-gray-400 text-xs">{start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div>
                </div>
                {b.joinUrl && (
                  <a href={b.joinUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline shrink-0 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />Join
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Integration Status Panel ─────────────────────────────────────────────────
function IntegrationsStatus() {
  const { data: integrations, refetch } = useQuery<any>({ queryKey: ["agent-integrations"], queryFn: () => api("/api/agent/integrations"), retry: false });
  const { data: channels = [] } = useQuery<any[]>({ queryKey: ["slack-channels"], queryFn: () => api("/api/agent/slack/channels"), enabled: !!integrations?.slack, retry: false });
  const [slackChannel, setSlackChannel] = useState("general");
  const [slackTesting, setSlackTesting] = useState(false);
  const { toast } = useToast();

  const items = [
    { key: "openai", label: "OpenAI (AI drafting)", required: true },
    { key: "apollo", label: "Apollo.io (lead discovery)" },
    { key: "apify", label: "Apify (Reddit/Quora)" },
    { key: "calendly", label: "Calendly (bookings)" },
    { key: "slack", label: "Slack (notifications)" },
    { key: "whatsapp", label: "Quo (SMS) + WhatsApp (Meta)" },
    { key: "gmail_dylan", label: "Gmail (Outreach inbox)" },
    { key: "hunter", label: "Hunter.io (email finder)" },
    { key: "serpapi", label: "SerpAPI (search)" },
  ];

  async function testSlack() {
    setSlackTesting(true);
    try {
      const res = await api("/api/agent/slack/test", { method: "POST", body: JSON.stringify({ channel: slackChannel }) });
      if (res.ok) toast({ title: "Slack test sent!", description: `Check #${slackChannel} in Slack.` });
      else toast({ title: "Slack test failed", description: res.error || "Unknown error", variant: "destructive" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSlackTesting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-yellow-500" />Integration Status
      </h2>
      <div className="space-y-1.5">
        {items.map(({ key, label, required }) => {
          const connected = integrations?.[key];
          return (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{label}{required && <span className="text-red-400 ml-1">*</span>}</span>
              {connected === undefined ? (
                <span className="text-gray-300 text-xs">checking…</span>
              ) : connected ? (
                <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><Check className="w-3 h-3" />Connected</span>
              ) : (
                <span className="flex items-center gap-1 text-gray-400 text-xs"><X className="w-3 h-3" />Not set</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Slack test section */}
      {integrations?.slack && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2 font-medium">Test Slack notification</p>
          <div className="flex gap-2">
            <select
              value={slackChannel}
              onChange={e => setSlackChannel(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
            >
              {channels.length > 0
                ? channels.filter(c => c.is_member).map(c => <option key={c.id} value={c.name}>#{c.name}</option>)
                : <option value="general">#general</option>
              }
            </select>
            <button
              onClick={testSlack}
              disabled={slackTesting}
              className="text-xs bg-[#4A154B] text-white px-3 py-1.5 rounded-md hover:bg-[#3a0f3b] disabled:opacity-50 flex items-center gap-1"
            >
              {slackTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              {slackTesting ? "Sending…" : "Send test"}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">* Required for core agent functionality</p>
    </div>
  );
}

// ─── Leads ────────────────────────────────────────────────────────────────────
function LeadsSection() {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedLead, setSelectedLead] = useState<AgentLead | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: leads = [], isLoading } = useQuery<AgentLead[]>({
    queryKey: ["agent-leads", stage, search],
    queryFn: () => api(`/api/agent/leads?stage=${stage}&search=${encodeURIComponent(search)}&limit=100`),
    refetchInterval: 30000,
  });

  const dncMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent/leads/${id}/dnc`, { method: "POST", body: JSON.stringify({ reason: "Manually added via portal" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-leads"] }); toast({ title: "Added to DNC" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stages = ["new", "contacted", "replied", "call_scheduled", "converted", "lost", "dnc"];

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <Button size="sm" onClick={() => setShowAdd(true)} className="bg-[#1a2a4a]">
          <Plus className="w-4 h-4 mr-1.5" />Add Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9 w-56" placeholder="Search name, email, company…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={stage} onChange={e => setStage(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm bg-white text-gray-700">
          <option value="">All stages</option>
          {stages.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <Badge className="self-center bg-gray-100 text-gray-600 border-gray-200">{leads.length} leads</Badge>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "Company", "Country", "Source", "Score", "Stage", "Last Contact", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No leads yet. Run discovery or add manually.</td></tr>
              ) : leads.map(lead => (
                <tr key={lead.id} className={`hover:bg-gray-50 cursor-pointer ${lead.dnc ? "opacity-50" : ""}`}
                  onClick={() => setSelectedLead(lead)}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{lead.firstName} {lead.lastName}</div>
                    {lead.email && <div className="text-gray-400 text-xs">{lead.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.company || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-gray-600">
                      <MapPin className="w-3 h-3 shrink-0" />{lead.country || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className="bg-blue-50 text-blue-600 border-blue-100 text-xs">{lead.source}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${scoreColor(lead.aiScore)}`}>{lead.aiScore}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs capitalize ${stageColor(lead.stage)}`}>{lead.stage.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{lead.lastContactedAt ? fmt(lead.lastContactedAt) : "Never"}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-7 px-2"
                      onClick={() => { if (confirm(`Add ${lead.firstName} to DNC?`)) dncMut.mutate(lead.id); }}>
                      <Shield className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} />}
      {selectedLead && <LeadDetailDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} />}
    </div>
  );
}

// ─── Add Lead Modal ───────────────────────────────────────────────────────────
function AddLeadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "", title: "", country: "", linkedinUrl: "", notes: "", source: "manual" });

  const createMut = useMutation({
    mutationFn: () => api("/api/agent/leads", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-leads"] }); toast({ title: "Lead added" }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-semibold text-gray-900">Add Lead Manually</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">First Name *</label>
              <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Last Name</label>
              <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Email</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phone</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Company</label>
              <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Title</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Country</label>
              <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="UAE, India, China…" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Source</label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm">
                {["manual", "referral", "event", "linkedin", "apollo", "inbound", "other"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">LinkedIn URL</label>
            <Input value={form.linkedinUrl} onChange={e => setForm(f => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/…" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notes</label>
            <Textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Context, where you met them, interest level…" />
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!form.firstName || createMut.isPending} className="bg-[#1a2a4a]">
            {createMut.isPending ? "Adding…" : "Add Lead"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Detail Drawer ───────────────────────────────────────────────────────
function LeadDetailDrawer({ lead, onClose }: { lead: AgentLead; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showVideoPanel, setShowVideoPanel] = useState(false);
  const { data: detail } = useQuery({
    queryKey: ["agent-lead", lead.id],
    queryFn: () => api(`/api/agent/leads/${lead.id}`),
  });

  const messages = (detail as any)?.messages as AgentMessage[] ?? [];

  return (
    <>
    {showVideoPanel && (
      <HeygenSendPanel lead={lead as any} onClose={() => setShowVideoPanel(false)} />
    )}
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-5 border-b bg-gray-50">
        <div>
          <h3 className="font-semibold text-gray-900">{lead.firstName} {lead.lastName}</h3>
          <p className="text-sm text-gray-500">{lead.title}{lead.company ? ` @ ${lead.company}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowVideoPanel(true)}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-xs h-8">
            <Video className="size-3.5" /> Send Video
          </Button>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Score & Stage */}
        <div className="flex gap-3">
          <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${scoreColor(lead.aiScore)}`}>
            Score: {lead.aiScore}/100
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-sm capitalize ${stageColor(lead.stage)}`}>
            {lead.stage.replace("_", " ")}
          </div>
          {lead.dnc && <div className="px-3 py-1.5 rounded-lg text-sm bg-red-100 text-red-700">DNC</div>}
        </div>

        {/* Contact info */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          {lead.email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-gray-400" /><a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a></div>}
          {lead.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-gray-400" /><span>{lead.phone}</span></div>}
          {lead.country && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /><span>{lead.country}</span></div>}
          {lead.linkedinUrl && <div className="flex items-center gap-2"><Linkedin className="w-4 h-4 text-gray-400" /><a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">LinkedIn Profile</a></div>}
          <div className="flex items-center gap-2 text-gray-500"><Target className="w-4 h-4 text-gray-400" />Source: {lead.source}</div>
          {lead.investmentType && <div className="flex items-center gap-2 text-gray-600"><Star className="w-4 h-4 text-gray-400" />Interest: {lead.investmentType}</div>}
        </div>

        {lead.notes && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</h4>
            <p className="text-sm text-gray-700 bg-gray-50 rounded p-3">{lead.notes}</p>
          </div>
        )}

        {/* AI Research */}
        {(detail as any)?.researchDossier && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">AI Research</h4>
            <p className="text-sm text-gray-700 bg-blue-50 rounded p-3">
              {(detail as any).researchDossier.scoringReasoning || JSON.stringify((detail as any).researchDossier)}
            </p>
          </div>
        )}

        {/* Message timeline */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Message History ({messages.length})</h4>
          {messages.length === 0 ? (
            <p className="text-sm text-gray-400">No messages yet.</p>
          ) : (
            <div className="space-y-2">
              {messages.map(msg => (
                <div key={msg.id} className="border border-gray-200 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {msg.channel === "email" ? <Mail className="w-3.5 h-3.5 text-blue-500" /> : <MessageSquare className="w-3.5 h-3.5 text-green-500" />}
                      <span className="font-medium">Touch {msg.touchNumber} · {msg.channel}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${statusColor(msg.status)}`}>{msg.status}</span>
                  </div>
                  {msg.subject && <div className="text-xs text-gray-500 mb-1">Subject: {msg.subject}</div>}
                  <p className="text-gray-700 text-xs line-clamp-4 whitespace-pre-wrap">{msg.body}</p>
                  <div className="text-gray-400 text-xs mt-1.5">{fmt(msg.createdAt)}{msg.sentAt ? ` · Sent ${fmt(msg.sentAt)}` : ""}{msg.repliedAt ? ` · Replied ${fmt(msg.repliedAt)}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Videos sent to this lead */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Videos Sent</h4>
          <LeadVideosSection lead={lead as any} />
        </div>
      </div>
    </div>
    </>
  );
}

// ─── Outreach ─────────────────────────────────────────────────────────────────
function OutreachSection() {
  const [statusFilter, setStatusFilter] = useState("");
  const { data: batches = [] } = useQuery<DailyBatch[]>({ queryKey: ["agent-batches"], queryFn: () => api("/api/agent/batches") });
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [] } = useQuery<AgentMessage[]>({
    queryKey: ["agent-messages", selectedBatch, statusFilter],
    queryFn: () => api(`/api/agent/messages?${selectedBatch ? `batchId=${selectedBatch}&` : ""}${statusFilter ? `status=${statusFilter}` : ""}`),
  });

  const [editingMsg, setEditingMsg] = useState<AgentMessage | null>(null);
  const saveMut = useMutation({
    mutationFn: ({ id, body, subject }: { id: string; body: string; subject?: string }) =>
      api(`/api/agent/messages/${id}`, { method: "PATCH", body: JSON.stringify({ body, subject }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-messages"] }); toast({ title: "Message updated" }); setEditingMsg(null); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Outreach Center</h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm bg-white">
          <option value="">All batches</option>
          {batches.map(b => <option key={b.id} value={b.id}>{b.batchDate} ({b.approvalStatus})</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm bg-white">
          <option value="">All statuses</option>
          {["staged", "sent", "replied", "failed", "held"].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <Badge className="self-center bg-gray-100 text-gray-600 border-gray-200">{messages.length} messages</Badge>
      </div>

      {/* Batch summary cards */}
      {batches.slice(0, 5).map(batch => (
        <div key={batch.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-blue-300"
          onClick={() => setSelectedBatch(selectedBatch === batch.id ? "" : batch.id)}>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{batch.batchDate}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${statusColor(batch.approvalStatus)}`}>{batch.approvalStatus}</span>
            </div>
            <div className="text-sm text-gray-500 mt-0.5">
              {batch.totalStaged} staged · {batch.totalSent} sent · {batch.totalFailed} failed
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${selectedBatch === batch.id ? "rotate-90" : ""}`} />
        </div>
      ))}

      {/* Messages */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-900">Messages</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {messages.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No messages found.</div>
          ) : messages.map(msg => (
            <div key={msg.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {msg.channel === "email" ? <Mail className="w-4 h-4 text-blue-500 shrink-0" /> : <MessageSquare className="w-4 h-4 text-green-500 shrink-0" />}
                    <span className={`px-2 py-0.5 rounded text-xs ${statusColor(msg.status)}`}>{msg.status}</span>
                    <span className="text-xs text-gray-500">Touch {msg.touchNumber}</span>
                    <span className="text-xs text-gray-400">{fmt(msg.createdAt)}</span>
                  </div>
                  {msg.subject && <div className="text-sm font-medium text-gray-800 mb-0.5">{msg.subject}</div>}
                  <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">{msg.body}</p>
                </div>
                {(msg.status === "staged" || msg.status === "held") && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingMsg(msg)} className="shrink-0">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {editingMsg && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-semibold">Edit Message</h3>
              <button onClick={() => setEditingMsg(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              {editingMsg.subject !== undefined && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Subject</label>
                  <Input value={editingMsg.subject || ""} onChange={e => setEditingMsg({ ...editingMsg, subject: e.target.value })} />
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Message Body</label>
                <Textarea rows={12} value={editingMsg.body} onChange={e => setEditingMsg({ ...editingMsg, body: e.target.value })} className="font-mono text-sm" />
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingMsg(null)}>Cancel</Button>
              <Button onClick={() => saveMut.mutate({ id: editingMsg.id, body: editingMsg.body, subject: editingMsg.subject })} disabled={saveMut.isPending} className="bg-[#1a2a4a]">
                {saveMut.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Forum ────────────────────────────────────────────────────────────────────
function ForumSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ platform: "Reddit", postUrl: "", postTitle: "", postBody: "", author: "", draftReply: "" });

  const { data: posts = [] } = useQuery<ForumPost[]>({ queryKey: ["agent-forum"], queryFn: () => api("/api/agent/forum") });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api(`/api/agent/forum/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-forum"] }); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const createMut = useMutation({
    mutationFn: () => api("/api/agent/forum", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-forum"] }); setShowAdd(false); toast({ title: "Forum post added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusLabel: Record<string, string> = {
    pending: "🟡 Pending review",
    included_in_brief: "📧 In today's brief",
    approved: "✅ Approved",
    posted_manually: "✔️ Posted",
    skipped: "⏭ Skipped",
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forum Reply Drafts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review AI-drafted replies to forum posts. All posting is manual — never auto-posted.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="bg-[#1a2a4a]">
          <Plus className="w-4 h-4 mr-1.5" />Add Post
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2 text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        Forum replies are <strong>never auto-posted</strong>. The agent drafts them for manual review and posting. Max 5 per platform per day.
      </div>

      {posts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400">No forum posts yet.</div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <ForumPostCard key={post.id} post={post} onUpdate={(data) => updateMut.mutate({ id: post.id, data })} />
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-semibold">Add Forum Post</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Platform</label>
                  <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm">
                    {["Reddit", "Quora", "Facebook Group", "Other"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Author</label>
                  <Input value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} placeholder="u/username" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Post URL</label>
                <Input value={form.postUrl} onChange={e => setForm(f => ({ ...f, postUrl: e.target.value }))} placeholder="https://reddit.com/…" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Post Title</label>
                <Input value={form.postTitle} onChange={e => setForm(f => ({ ...f, postTitle: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Post Body (optional)</label>
                <Textarea rows={3} value={form.postBody} onChange={e => setForm(f => ({ ...f, postBody: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Draft Reply</label>
                <Textarea rows={5} value={form.draftReply} onChange={e => setForm(f => ({ ...f, draftReply: e.target.value }))} placeholder="Draft reply…" />
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="bg-[#1a2a4a]">Add</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ForumPostCard({ post, onUpdate }: { post: ForumPost; onUpdate: (d: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reply, setReply] = useState(post.draftReply || "");

  const statusEmoji: Record<string, string> = {
    pending: "🟡", approved: "✅", posted_manually: "✔️", skipped: "⏭", included_in_brief: "📧",
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="p-4 flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-50 text-purple-700 border-purple-100 text-xs">{post.platform}</Badge>
            {post.author && <span className="text-xs text-gray-400">{post.author}</span>}
            <span className="text-xs text-gray-400">{statusEmoji[post.status] || "🟡"} {post.status.replace("_", " ")}</span>
          </div>
          <p className="font-medium text-gray-900 text-sm">{post.postTitle}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {post.postBody && <p className="text-sm text-gray-600 bg-gray-50 rounded p-3">{post.postBody}</p>}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reply Draft</label>
              <button onClick={() => setEditing(e => !e)} className="text-xs text-blue-600 hover:underline">{editing ? "Cancel" : "Edit"}</button>
            </div>
            {editing ? (
              <div className="space-y-2">
                <Textarea rows={6} value={reply} onChange={e => setReply(e.target.value)} className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => { onUpdate({ draftReply: reply }); setEditing(false); }} className="bg-[#1a2a4a]">Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 bg-green-50 border border-green-100 rounded p-3 whitespace-pre-wrap">{post.draftReply || "No draft yet."}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => window.open(post.postUrl, "_blank")}><ExternalLink className="w-3.5 h-3.5 mr-1" />View Post</Button>
            <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={() => onUpdate({ status: "posted_manually" })}>✔ Mark as Posted</Button>
            <Button size="sm" variant="outline" className="text-gray-400" onClick={() => onUpdate({ status: "skipped" })}>Skip</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Competitors ──────────────────────────────────────────────────────────────
function CompetitorsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", domain: "" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: competitors = [] } = useQuery<Competitor[]>({ queryKey: ["agent-competitors"], queryFn: () => api("/api/agent/competitors") });

  const scanMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent/competitors/${id}/scan`, { method: "POST", body: "{}" }),
    onSuccess: () => { toast({ title: "Scan started", description: "Pulling data via SerpAPI…" }); setTimeout(() => qc.invalidateQueries({ queryKey: ["agent-competitors"] }), 5000); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent/competitors/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-competitors"] }); toast({ title: "Removed" }); },
  });
  const addMut = useMutation({
    mutationFn: () => api("/api/agent/competitors", { method: "POST", body: JSON.stringify(addForm) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-competitors"] }); setShowAdd(false); toast({ title: "Competitor added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competitor Intelligence</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track competitor content, backlinks, and audience signals.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="bg-[#1a2a4a]">
          <Plus className="w-4 h-4 mr-1.5" />Add Competitor
        </Button>
      </div>

      <div className="space-y-3">
        {competitors.map(comp => (
          <div key={comp.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{comp.name}</div>
                <a href={`https://${comp.domain}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  {comp.domain}<ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {comp.lastScannedAt && (
                <span className="text-xs text-gray-400">Scanned {new Date(comp.lastScannedAt).toLocaleDateString()}</span>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => scanMut.mutate(comp.id)} disabled={scanMut.isPending}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${scanMut.isPending ? "animate-spin" : ""}`} />Scan
                </Button>
                {comp.insights && (
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === comp.id ? null : comp.id)}>
                    {expanded === comp.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => { if (confirm(`Remove ${comp.name}?`)) deleteMut.mutate(comp.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {expanded === comp.id && comp.insights && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {comp.insights.organicResults?.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-700 mb-2">Top Pages</p>
                      <div className="space-y-1.5">
                        {comp.insights.organicResults.map((r: any, i: number) => (
                          <a key={i} href={r.link} target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline text-xs truncate">{r.title}</a>
                        ))}
                      </div>
                    </div>
                  )}
                  {comp.insights.relatedSearches?.length > 0 && (
                    <div>
                      <p className="font-medium text-gray-700 mb-2">Related Searches</p>
                      <div className="flex flex-wrap gap-1.5">
                        {comp.insights.relatedSearches.map((s: string, i: number) => (
                          <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">Scanned: {comp.insights.scannedAt ? new Date(comp.insights.scannedAt).toLocaleString() : "—"}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-semibold">Add Competitor</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Company Name</label>
                <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="FranChoice" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Domain</label>
                <Input value={addForm.domain} onChange={e => setAddForm(f => ({ ...f, domain: e.target.value }))} placeholder="franchoice.com" />
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={() => addMut.mutate()} disabled={!addForm.name || !addForm.domain || addMut.isPending} className="bg-[#1a2a4a]">Add</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DNC ─────────────────────────────────────────────────────────────────────
function DncSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ email: "", phone: "", domain: "", reason: "" });
  const [showAdd, setShowAdd] = useState(false);

  const { data: list = [] } = useQuery<any[]>({ queryKey: ["agent-dnc"], queryFn: () => api("/api/agent/dnc") });

  const addMut = useMutation({
    mutationFn: () => api("/api/agent/dnc", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-dnc"] }); setShowAdd(false); toast({ title: "Added to DNC" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent/dnc/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-dnc"] }); toast({ title: "Removed from DNC" }); },
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Do Not Contact List</h1>
          <p className="text-sm text-gray-500 mt-0.5">The agent permanently skips anyone on this list, regardless of other settings.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="bg-red-600 hover:bg-red-700">
          <Plus className="w-4 h-4 mr-1.5" />Add to DNC
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {["Email", "Phone", "Domain", "Reason", "Added", ""].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No DNC entries.</td></tr>
            ) : list.map((item: any) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-700">{item.email || "—"}</td>
                <td className="px-4 py-3 text-gray-700">{item.phone || "—"}</td>
                <td className="px-4 py-3 text-gray-700">{item.domain || "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{item.reason || "—"}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{item.addedAt ? new Date(item.addedAt).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-7 px-2" onClick={() => removeMut.mutate(item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-semibold">Add to DNC</h3>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Email (optional)</label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} type="email" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Phone (optional)</label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Domain (optional, e.g. competitor.com)</label>
                <Input value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="domain.com" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Reason</label>
                <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Unsubscribed, competitor, etc." />
              </div>
            </div>
            <div className="p-5 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={() => addMut.mutate()} disabled={addMut.isPending} className="bg-red-600 text-white hover:bg-red-700">Add to DNC</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
interface ChatMessage { role: "user" | "assistant"; content: string; }

const SUGGESTED_PROMPTS = [
  { icon: "🔍", text: "Find 50 immigration attorneys in Florida and add them to the brokers list." },
  { icon: "📋", text: "Find 20 investor leads from UAE and Mexico." },
  { icon: "📊", text: "Show me the current leads in the system." },
  { icon: "📈", text: "What does the CRM pipeline look like right now?" },
  { icon: "✉️", text: "Draft a cold email to an immigration attorney in Dallas." },
  { icon: "💬", text: "Write a WhatsApp follow-up for a lead who hasn't replied in 5 days." },
];

// ── Simple markdown → React renderer ──────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  const inlineFormat = (str: string, key: string | number): React.ReactNode => {
    // Bold + italic ***text***, bold **text**, italic *text*, inline code `code`
    const parts = str.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return (
      <span key={key}>
        {parts.map((part, pi) => {
          if (part.startsWith("***") && part.endsWith("***")) return <strong key={pi}><em>{part.slice(3, -3)}</em></strong>;
          if (part.startsWith("**") && part.endsWith("**")) return <strong key={pi}>{part.slice(2, -2)}</strong>;
          if (part.startsWith("*") && part.endsWith("*")) return <em key={pi}>{part.slice(1, -1)}</em>;
          if (part.startsWith("`") && part.endsWith("`")) return <code key={pi} className="bg-gray-200 rounded px-1 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>;
          return part;
        })}
      </span>
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-gray-200 my-2" />);
      i++; continue;
    }
    // H1
    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-lg font-bold text-gray-900 mt-3 mb-1">{inlineFormat(line.slice(2), `h1-${i}`)}</h1>);
      i++; continue;
    }
    // H2
    if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-base font-bold text-gray-900 mt-3 mb-1">{inlineFormat(line.slice(3), `h2-${i}`)}</h2>);
      i++; continue;
    }
    // H3
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-sm font-bold text-gray-800 mt-2 mb-0.5">{inlineFormat(line.slice(4), `h3-${i}`)}</h3>);
      i++; continue;
    }
    // Unordered list
    if (/^[-•*] /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-•*] /.test(lines[i])) {
        items.push(<li key={i}>{inlineFormat(lines[i].replace(/^[-•*] /, ""), `li-${i}`)}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 my-1 pl-1">{items}</ul>);
      continue;
    }
    // Numbered list
    if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(<li key={i}>{inlineFormat(lines[i].replace(/^\d+\. /, ""), `li-${i}`)}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`} className="list-decimal list-inside space-y-0.5 my-1 pl-1">{items}</ol>);
      continue;
    }
    // Empty line = spacer
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
      i++; continue;
    }
    // Paragraph
    elements.push(<p key={i} className="leading-relaxed">{inlineFormat(line, `p-${i}`)}</p>);
    i++;
  }
  return <>{elements}</>;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

function ChatSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [statusText, setStatusText] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);

  const [showScheduled, setShowScheduled] = useState(false);

  // ── Sessions list ───────────────────────────────────────────────────────────
  const { data: sessions = [] } = useQuery<ChatSession[]>({
    queryKey: ["agent-chat-sessions"],
    queryFn: () => api("/api/agent/chat/sessions"),
    refetchInterval: showHistory ? 10000 : false,
  });

  // ── Scheduled jobs ──────────────────────────────────────────────────────────
  type ScheduledJob = {
    id: string; description: string; tool: string; args: Record<string, unknown>;
    scheduledAt: string; timezone: string; status: string; result: string | null; createdAt: string;
  };
  const { data: scheduledJobs = [], refetch: refetchJobs } = useQuery<ScheduledJob[]>({
    queryKey: ["agent-scheduled-jobs"],
    queryFn: () => api("/api/agent/scheduled-jobs"),
    refetchInterval: showScheduled ? 15000 : false,
  });
  const deleteJobMutation = useMutation({
    mutationFn: (id: string) => api(`/api/agent/scheduled-jobs/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-scheduled-jobs"] }),
  });
  const runJobNowMutation = useMutation({
    mutationFn: (id: string) => api(`/api/agent/scheduled-jobs/${id}/run`, { method: "POST" }),
    onSuccess: () => { toast({ title: "Job started", description: "Running the job now." }); setTimeout(() => qc.invalidateQueries({ queryKey: ["agent-scheduled-jobs"] }), 2000); },
  });

  // Save messages to the current session after every completed exchange
  const saveSession = async (msgs: ChatMessage[], sessionId: string | null) => {
    if (msgs.length === 0) return;
    try {
      let sid = sessionId;
      if (!sid) {
        const title = msgs[0]?.content?.slice(0, 60) || "New Chat";
        const sess = await api("/api/agent/chat/sessions", { method: "POST", body: JSON.stringify({ title }) });
        sid = sess.id;
        setActiveSessionId(sid);
      }
      await api(`/api/agent/chat/sessions/${sid}/messages`, {
        method: "POST",
        body: JSON.stringify({
          messages: msgs,
          title: msgs[0]?.content?.slice(0, 60),
        }),
      });
      qc.invalidateQueries({ queryKey: ["agent-chat-sessions"] });
    } catch {}
  };

  const loadSession = async (session: ChatSession) => {
    try {
      const data = await api(`/api/agent/chat/sessions/${session.id}`);
      setMessages((data.messages || []).map((m: any) => ({ role: m.role, content: m.content })));
      setActiveSessionId(session.id);
      setStreamingText("");
      setStatusText("");
      setShowHistory(false);
    } catch (e: any) {
      toast({ title: "Error loading chat", description: e.message, variant: "destructive" });
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api(`/api/agent/chat/sessions/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["agent-chat-sessions"] });
      if (activeSessionId === id) {
        setMessages([]);
        setActiveSessionId(null);
      }
    } catch {}
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveSessionId(null);
    setStreamingText("");
    setStatusText("");
    setInput("");
    setShowHistory(false);
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    setStreamingText("");
    setStatusText("");
    scrollToBottom();

    abortRef.current = new AbortController();

    try {
      const resp = await fetch("/api/agent/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: abortRef.current.signal,
        credentials: "include",
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: "Failed" }));
        throw new Error(err.message);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "message";
          let dataLine = "";
          for (const l of lines) {
            if (l.startsWith("event: ")) eventType = l.slice(7).trim();
            if (l.startsWith("data: ")) dataLine = l.slice(6);
          }
          if (!dataLine) continue;
          let payload: Record<string, string> = {};
          try { payload = JSON.parse(dataLine); } catch { continue; }

          if (eventType === "status") {
            setStatusText(payload.text || "");
            scrollToBottom();
          } else if (eventType === "token") {
            accumulated += payload.text;
            setStreamingText(accumulated);
            scrollToBottom();
          } else if (eventType === "done") {
            const finalMsgs = [...next, { role: "assistant" as const, content: accumulated }];
            setMessages(finalMsgs);
            setStreamingText("");
            setStatusText("");
            // Auto-save conversation
            saveSession(finalMsgs, activeSessionId);
          } else if (eventType === "error") {
            throw new Error(payload.message || "Stream error");
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast({ title: "Agent error", description: e.message, variant: "destructive" });
        setStreamingText("");
        setStatusText("");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      scrollToBottom();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    if (streamingText) {
      setMessages(prev => [...prev, { role: "assistant", content: streamingText }]);
    }
    setStreamingText("");
    setStatusText("");
    setLoading(false);
  };

  const isStreaming = loading || !!streamingText;

  const formatSessionDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-full gap-3" style={{ maxHeight: "calc(100vh - 110px)" }}>

      {/* Scheduled Tasks sidebar */}
      {showScheduled && (
        <div className="w-72 shrink-0 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 shrink-0">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="size-3.5" /> Scheduled Tasks
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => refetchJobs()} className="text-gray-400 hover:text-gray-600 p-0.5 rounded" title="Refresh">
                <RefreshCw className="size-3" />
              </button>
              <button onClick={() => setShowScheduled(false)} className="text-gray-400 hover:text-gray-600 p-0.5 rounded">
                <X className="size-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {scheduledJobs.length === 0 && (
              <div className="text-center py-8">
                <Calendar className="size-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No scheduled tasks yet</p>
                <p className="text-[10px] text-gray-300 mt-1">Ask the AI to schedule an SMS, WhatsApp, or email task</p>
              </div>
            )}
            {scheduledJobs.map(job => {
              const isRunning = job.status === "running";
              const isDone = job.status === "done";
              const isFailed = job.status === "failed";
              const isPending = job.status === "pending";
              const scheduledDate = new Date(job.scheduledAt);
              const isOverdue = isPending && scheduledDate < new Date();
              const toolLabel: Record<string, string> = {
                send_sms_blast: "📱 SMS blast",
                send_whatsapp_blast: "💬 WhatsApp blast",
                enroll_list_in_campaign: "📧 Email campaign",
                find_new_leads: "🔍 Lead search",
                find_people_at_company: "🔍 Company search",
              };
              return (
                <div key={job.id} className={`rounded-lg border p-2.5 text-xs ${
                  isDone ? "bg-green-50 border-green-200" :
                  isFailed ? "bg-red-50 border-red-200" :
                  isRunning ? "bg-blue-50 border-blue-200" :
                  isOverdue ? "bg-amber-50 border-amber-200" :
                  "bg-gray-50 border-gray-200"
                }`}>
                  <div className="flex items-start justify-between gap-1.5 mb-1">
                    <p className="font-medium text-gray-800 leading-tight flex-1">{job.description}</p>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {(isPending || isOverdue) && (
                        <button
                          onClick={() => runJobNowMutation.mutate(job.id)}
                          disabled={runJobNowMutation.isPending}
                          className="text-blue-400 hover:text-blue-600 p-0.5 rounded"
                          title="Run now"
                        >
                          <PlayCircle className="size-3.5" />
                        </button>
                      )}
                      {!isRunning && (
                        <button
                          onClick={() => deleteJobMutation.mutate(job.id)}
                          disabled={deleteJobMutation.isPending}
                          className="text-gray-300 hover:text-red-400 p-0.5 rounded"
                          title="Cancel / delete"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-500 text-[10px] mb-1">{toolLabel[job.tool] || job.tool}</p>
                  <div className="flex items-center gap-1 text-[10px]">
                    <Clock className="size-2.5 text-gray-400" />
                    <span className="text-gray-500">
                      {scheduledDate.toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })} MT
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      isDone ? "bg-green-100 text-green-700" :
                      isFailed ? "bg-red-100 text-red-700" :
                      isRunning ? "bg-blue-100 text-blue-700" :
                      isOverdue ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {isRunning && <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />}
                      {isDone ? "✓ Done" : isFailed ? "✗ Failed" : isRunning ? "Running…" : isOverdue ? "⚠ Overdue" : "Pending"}
                    </span>
                  </div>
                  {job.result && (
                    <p className="mt-1.5 text-[10px] text-gray-500 leading-relaxed border-t border-gray-200 pt-1.5 line-clamp-3">{job.result}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-gray-100 shrink-0">
            <p className="text-[10px] text-gray-400 text-center">
              Ask the AI: "Send SMS to Texas Brokers at 5 AM Tuesday"
            </p>
          </div>
        </div>
      )}

      {/* History sidebar */}
      {showHistory && (
        <div className="w-64 shrink-0 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 shrink-0">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Chat History</span>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600 p-0.5 rounded">
              <X className="size-3.5" />
            </button>
          </div>
          <button
            onClick={startNewChat}
            className="mx-2 mt-2 mb-1 shrink-0 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-[#1a2a4a] text-white hover:bg-[#243558] transition-colors"
          >
            <Plus className="size-3.5" /> New Chat
          </button>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No saved chats yet</p>
            )}
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => loadSession(s)}
                className={`w-full text-left px-3 py-2.5 rounded-lg group flex items-start gap-2 transition-colors ${
                  activeSessionId === s.id
                    ? "bg-[#1a2a4a]/8 border border-[#1a2a4a]/20"
                    : "hover:bg-gray-50 border border-transparent"
                }`}
              >
                <MessageCircle className="size-3.5 text-gray-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{s.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{formatSessionDate(s.updatedAt)}</p>
                </div>
                <button
                  onClick={(e) => deleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 p-0.5 rounded transition-all shrink-0"
                >
                  <Trash2 className="size-3" />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="mb-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowHistory(h => !h)}
            className={`size-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${showHistory ? "bg-[#1a2a4a] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            title="Chat history"
          >
            <Activity className="size-4" />
          </button>
          <button
            onClick={() => setShowScheduled(s => !s)}
            className={`size-9 rounded-xl flex items-center justify-center shrink-0 transition-colors relative ${showScheduled ? "bg-[#1a2a4a] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
            title="Scheduled tasks"
          >
            <Calendar className="size-4" />
            {scheduledJobs.filter(j => j.status === "pending").length > 0 && (
              <span className="absolute -top-1 -right-1 size-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {scheduledJobs.filter(j => j.status === "pending").length}
              </span>
            )}
          </button>
          <div className="size-9 rounded-xl bg-[#1a2a4a] flex items-center justify-center shrink-0">
            <Bot className="size-4 text-blue-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">AI Assistant</h2>
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isStreaming ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                <span className={`size-1.5 rounded-full ${isStreaming ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                {isStreaming ? "Thinking…" : "Ready"}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">Chat naturally — search leads, manage lists, send blasts, or schedule tasks for any future time.</p>
          </div>
          {messages.length > 0 && (
            <button onClick={startNewChat} className="text-xs text-gray-400 hover:text-gray-600 shrink-0 px-2 py-1 rounded hover:bg-gray-100 transition-colors">
              New chat
            </button>
          )}
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 mb-3 min-h-0">
          {messages.length === 0 && !streamingText ? (
            <div className="h-full flex flex-col items-center justify-center gap-5 p-6">
              <div className="size-14 rounded-2xl bg-[#1a2a4a]/5 flex items-center justify-center">
                <MessageCircle className="size-7 text-[#1a2a4a]/40" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-700 text-base">What do you need help with?</p>
                <p className="text-sm text-gray-400 mt-1 max-w-xs">Type anything — or tap a suggestion below. The agent will figure out what to do.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map(({ icon, text }) => (
                  <button
                    key={text}
                    onClick={() => sendMessage(text)}
                    className="text-left text-sm px-3 py-2.5 rounded-xl border border-gray-200 hover:border-[#1a2a4a]/40 hover:bg-[#1a2a4a]/3 text-gray-600 hover:text-gray-900 transition-all flex items-start gap-2 group"
                  >
                    <span className="text-base shrink-0">{icon}</span>
                    <span className="leading-snug">{text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="size-7 rounded-lg bg-[#1a2a4a] flex items-center justify-center shrink-0 mt-1">
                      <Bot className="size-3.5 text-blue-300" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-[#1a2a4a] text-white rounded-br-sm"
                      : "bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm"
                  }`}>
                    {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="size-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                      <User className="size-3.5 text-blue-700" />
                    </div>
                  )}
                </div>
              ))}

              {statusText && (
                <div className="flex gap-3 justify-start">
                  <div className="size-7 rounded-lg bg-[#1a2a4a] flex items-center justify-center shrink-0 mt-1">
                    <Bot className="size-3.5 text-blue-300" />
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin shrink-0" />
                    {statusText}
                  </div>
                </div>
              )}

              {streamingText && (
                <div className="flex gap-3 justify-start">
                  <div className="size-7 rounded-lg bg-[#1a2a4a] flex items-center justify-center shrink-0 mt-1">
                    <Bot className="size-3.5 text-blue-300" />
                  </div>
                  <div className="max-w-[85%] bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-gray-800">
                    {renderMarkdown(streamingText)}
                    <span className="inline-block w-0.5 h-3.5 bg-gray-400 ml-0.5 animate-pulse align-middle" />
                  </div>
                </div>
              )}

              {loading && !streamingText && !statusText && (
                <div className="flex gap-3 justify-start">
                  <div className="size-7 rounded-lg bg-[#1a2a4a] flex items-center justify-center shrink-0">
                    <Bot className="size-3.5 text-blue-300" />
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="size-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="size-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#1a2a4a]/40 focus-within:ring-1 focus-within:ring-[#1a2a4a]/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message the agent… (Enter to send, Shift+Enter for new line)"
            className="w-full px-4 pt-3 pb-2 text-sm text-gray-800 placeholder-gray-400 resize-none outline-none bg-transparent"
            rows={1}
            style={{ minHeight: "44px", maxHeight: "160px" }}
          />
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
            <p className="text-[11px] text-gray-400">Shift+Enter for new line</p>
            <div className="flex gap-2">
              {isStreaming ? (
                <button
                  onClick={stopGeneration}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
                >
                  <span className="size-3 rounded-sm bg-red-500 shrink-0" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#1a2a4a] text-white hover:bg-[#243558] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Send className="size-3" />
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function SettingsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery<AgentSettings>({ queryKey: ["agent-settings"], queryFn: () => api("/api/agent/settings") });
  const [form, setForm] = useState<Partial<AgentSettings>>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () => api("/api/agent/settings", { method: "PATCH", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-settings"] }); toast({ title: "Settings saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [newCountry, setNewCountry] = useState("");
  const [newPhrase, setNewPhrase] = useState("");
  const [newSample, setNewSample] = useState("");

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Agent Settings</h1>

      {/* HeyGen Video shortcut */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl p-5 flex items-center gap-4 text-white">
        <div className="size-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Video className="size-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold">HeyGen AI Video Settings</h2>
          <p className="text-sm text-violet-200">Configure avatar, script templates, and automation rules</p>
        </div>
        <Button onClick={() => window.open("/heygen", "_blank")} className="bg-white text-violet-700 hover:bg-violet-50 gap-2 shrink-0">
          <ExternalLink className="size-4" /> Open
        </Button>
      </div>

      {/* Approval */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Mail className="w-4 h-4 text-blue-500" />Approval &amp; Schedule</h2>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Approval Email <span className="text-blue-500">(where daily briefs are sent)</span></label>
          <Input value={form.approvalEmail || ""} onChange={e => setForm(f => ({ ...f, approvalEmail: e.target.value }))} placeholder="dylan@newdawnfranchising.com" />
          <p className="text-xs text-gray-400 mt-1">Daily brief emails go here. Reply YES/NO from this address to approve or hold the batch.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Daily Brief Time (hour, Central)</label>
            <Input type="number" min={0} max={23} value={form.briefSendHour ?? 7}
              onChange={e => setForm(f => ({ ...f, briefSendHour: parseInt(e.target.value) }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Approval Deadline (hour, Central)</label>
            <Input type="number" min={0} max={23} value={form.approvalDeadlineHour ?? 14}
              onChange={e => setForm(f => ({ ...f, approvalDeadlineHour: parseInt(e.target.value) }))} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Calendly Link</label>
          <Input value={form.calendlyLink || ""} onChange={e => setForm(f => ({ ...f, calendlyLink: e.target.value }))} placeholder="https://calendly.com/…" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Slack Webhook (optional, for reminders)</label>
          <Input value={form.slackWebhookUrl || ""} onChange={e => setForm(f => ({ ...f, slackWebhookUrl: e.target.value }))} placeholder="https://hooks.slack.com/…" />
        </div>
      </div>

      {/* Limits */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-green-500" />Daily Limits</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: "maxLeadsPerDay", label: "Max leads/day" },
            { key: "maxEmailsPerDay", label: "Max emails/day" },
            { key: "maxWhatsappPerDay", label: "Max WhatsApp/day" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 mb-1 block">{label}</label>
              <Input type="number" min={0} value={(form as any)[key] ?? 0}
                onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) }))} />
            </div>
          ))}
        </div>
      </div>

      {/* Dylan's voice */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Bot className="w-4 h-4 text-purple-500" />AI Voice & Outreach Style</h2>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Sender Bio (used in all AI prompts)</label>
          <Textarea rows={4} value={form.dylanBio || ""} onChange={e => setForm(f => ({ ...f, dylanBio: e.target.value }))} placeholder="Describe the sender's background, expertise, and the New Dawn Franchising opportunity…" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Writing Samples (paste 2-3 real outreach emails for tone matching)</label>
          {(form.dylanVoiceSamples || []).map((s, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <Textarea rows={3} value={s} onChange={e => {
                const arr = [...(form.dylanVoiceSamples || [])];
                arr[i] = e.target.value;
                setForm(f => ({ ...f, dylanVoiceSamples: arr }));
              }} className="flex-1 text-sm" />
              <Button variant="ghost" size="sm" className="text-red-400 shrink-0" onClick={() => setForm(f => ({ ...f, dylanVoiceSamples: (f.dylanVoiceSamples || []).filter((_, j) => j !== i) }))}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <Textarea rows={2} value={newSample} onChange={e => setNewSample(e.target.value)} placeholder="Paste a sample outreach email…" className="flex-1 text-sm" />
            <Button size="sm" variant="outline" className="shrink-0 self-end" onClick={() => { if (newSample.trim()) { setForm(f => ({ ...f, dylanVoiceSamples: [...(f.dylanVoiceSamples || []), newSample.trim()] })); setNewSample(""); } }}>
              Add
            </Button>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Prohibited Phrases (AI will never use these)</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(form.prohibitedPhrases || []).map((p, i) => (
              <Badge key={i} className="bg-red-50 text-red-700 border-red-200 gap-1">
                {p}
                <button onClick={() => setForm(f => ({ ...f, prohibitedPhrases: (f.prohibitedPhrases || []).filter((_, j) => j !== i) }))}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={newPhrase} onChange={e => setNewPhrase(e.target.value)} placeholder="passive income…" className="text-sm" onKeyDown={e => { if (e.key === "Enter" && newPhrase.trim()) { setForm(f => ({ ...f, prohibitedPhrases: [...(f.prohibitedPhrases || []), newPhrase.trim()] })); setNewPhrase(""); } }} />
            <Button size="sm" variant="outline" onClick={() => { if (newPhrase.trim()) { setForm(f => ({ ...f, prohibitedPhrases: [...(f.prohibitedPhrases || []), newPhrase.trim()] })); setNewPhrase(""); } }}>Add</Button>
          </div>
        </div>
      </div>

      {/* Target countries */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Globe className="w-4 h-4 text-blue-400" />Target Countries</h2>
        <div className="flex flex-wrap gap-1.5">
          {(form.targetCountries || []).map((c, i) => (
            <Badge key={i} className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
              {c}
              <button onClick={() => setForm(f => ({ ...f, targetCountries: (f.targetCountries || []).filter((_, j) => j !== i) }))}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={newCountry} onChange={e => setNewCountry(e.target.value)} placeholder="UAE, India…" className="text-sm" onKeyDown={e => { if (e.key === "Enter" && newCountry.trim()) { setForm(f => ({ ...f, targetCountries: [...(f.targetCountries || []), newCountry.trim()] })); setNewCountry(""); } }} />
          <Button size="sm" variant="outline" onClick={() => { if (newCountry.trim()) { setForm(f => ({ ...f, targetCountries: [...(f.targetCountries || []), newCountry.trim()] })); setNewCountry(""); } }}>Add</Button>
        </div>
      </div>

      <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="bg-[#1a2a4a] w-full">
        {saveMut.isPending ? "Saving…" : "Save All Settings"}
      </Button>
    </div>
  );
}

// ─── Visitor Intelligence Section ─────────────────────────────────────────────
function VisitorIntelligenceSection() {
  const [activeTab, setActiveTab] = useState<"live" | "identified" | "watchlist">("live");
  const { data: live = [] } = useQuery<any[]>({
    queryKey: ["/api/visitors/live"],
    queryFn: async () => { const r = await fetch("/api/visitors/live", { credentials: "include" }); return r.json(); },
    refetchInterval: 15000,
  });
  const { data: identified = [] } = useQuery<any[]>({
    queryKey: ["/api/visitors/identified"],
    queryFn: async () => { const r = await fetch("/api/visitors/identified", { credentials: "include" }); return r.json(); },
    refetchInterval: 30000,
  });
  const { data: watchlist = [] } = useQuery<any[]>({
    queryKey: ["/api/visitors/watchlist"],
    queryFn: async () => { const r = await fetch("/api/visitors/watchlist", { credentials: "include" }); return r.json(); },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Eye className="w-5 h-5 text-blue-500" />Visitor Intelligence</h2>
        <p className="text-sm text-gray-500 mt-0.5">Real-time monitoring of who is visiting your site and how they engage</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Live Now", value: live.length, color: "green" },
          { label: "Identified", value: identified.length, color: "blue" },
          { label: "High-Intent Watch", value: watchlist.length, color: "yellow" },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-bold text-${s.color}-700`}>{s.value}</p>
            <p className={`text-xs text-${s.color}-600 mt-1`}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { id: "live", label: `Live (${live.length})` },
          { id: "identified", label: `Identified (${identified.length})` },
          { id: "watchlist", label: `Watch List (${watchlist.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >{t.label}</button>
        ))}
      </div>

      {activeTab === "live" && (
        <div className="space-y-2">
          {live.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No active sessions in the last 5 minutes. The tracking script must be installed on your site for data to appear here.</div>}
          {live.map((v: any) => (
            <div key={v.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">{v.pageUrl}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  {v.referralSource && <span>from {v.referralSource}</span>}
                  {v.utmSource && <span>utm: {v.utmSource}</span>}
                  <span>{new Date(v.visitedAt).toLocaleTimeString()}</span>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {activeTab === "identified" && (
        <div className="space-y-3">
          {identified.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No identified visitors yet. Visitors are identified when they submit a form or click a tracked email link.</div>}
          {identified.map((v: any) => (
            <div key={v.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Identified Visitor</p>
                    <p className="text-xs text-gray-500">{v.visitCount} visits · Last seen {new Date(v.lastSeen).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">Identified</span>
              </div>
              <div className="text-xs text-gray-500">
                Pages: {(v.pagesVisited || []).slice(0, 3).join(", ")}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "watchlist" && (
        <div className="space-y-3">
          {watchlist.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No high-intent anonymous visitors yet. Visitors are added to the watch list after 2+ visits to high-intent pages within 7 days.</div>}
          {watchlist.map((v: any) => (
            <div key={v.id} className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Eye className="w-3.5 h-3.5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Anonymous Visitor</p>
                    <p className="text-xs text-gray-500">{v.visitCount} visits · First: {new Date(v.firstSeen).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${v.visitCount >= 3 ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {v.visitCount >= 3 ? "Very High Intent" : "High Intent"}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Pages: {(v.pagesVisited || []).slice(0, 4).join(", ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Meetings Section ──────────────────────────────────────────────────────────
function MeetingsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ inviteeName: "", inviteeEmail: "", scheduledAt: "" });
  const [activeTab, setActiveTab] = useState<"upcoming" | "all">("upcoming");

  const { data: meetings = [] } = useQuery<any[]>({
    queryKey: ["/api/meetings"],
    queryFn: async () => { const r = await fetch("/api/meetings", { credentials: "include" }); return r.json(); },
    refetchInterval: 30000,
  });
  const { data: upcoming = [] } = useQuery<any[]>({
    queryKey: ["/api/meetings/upcoming"],
    queryFn: async () => { const r = await fetch("/api/meetings/upcoming", { credentials: "include" }); return r.json(); },
    refetchInterval: 30000,
  });

  async function updateOutcome(id: string, outcome: string) {
    await fetch(`/api/meetings/${id}/outcome`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ outcome }),
    });
    qc.invalidateQueries({ queryKey: ["/api/meetings"] });
    toast({ title: "Meeting outcome updated" });
  }

  async function bookManual() {
    const r = await fetch("/api/meetings/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(manualForm),
    });
    if (r.ok) {
      setShowManual(false);
      setManualForm({ inviteeName: "", inviteeEmail: "", scheduledAt: "" });
      qc.invalidateQueries({ queryKey: ["/api/meetings"] });
      qc.invalidateQueries({ queryKey: ["/api/meetings/upcoming"] });
      toast({ title: "Meeting logged!" });
    }
  }

  const pastMeetings = meetings.filter((m: any) => new Date(m.scheduledAt) < new Date());
  const OUTCOME_OPTIONS = ["attended", "no_show", "converted", "lost"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-500" />Meetings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track booked meetings, outcomes, and conversion rates</p>
        </div>
        <button onClick={() => setShowManual(!showManual)} className="px-4 py-2 bg-[#1a2a4a] text-white text-sm font-medium rounded-lg hover:bg-[#243860] flex items-center gap-2">
          <Plus className="w-4 h-4" /> Book Manual Meeting
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: meetings.length },
          { label: "Upcoming", value: upcoming.length },
          { label: "Converted", value: meetings.filter((m: any) => m.outcome === "converted").length },
          { label: "No-shows", value: meetings.filter((m: any) => m.outcome === "no_show").length },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Manual meeting form */}
      {showManual && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Log a Manual Meeting</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Invitee Name</label>
              <Input value={manualForm.inviteeName} onChange={e => setManualForm(f => ({ ...f, inviteeName: e.target.value }))} placeholder="Jane Smith" className="text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Invitee Email</label>
              <Input type="email" value={manualForm.inviteeEmail} onChange={e => setManualForm(f => ({ ...f, inviteeEmail: e.target.value }))} placeholder="jane@firm.com" className="text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Meeting Date/Time</label>
            <Input type="datetime-local" value={manualForm.scheduledAt} onChange={e => setManualForm(f => ({ ...f, scheduledAt: e.target.value }))} className="text-sm" />
          </div>
          <div className="flex gap-2">
            <Button onClick={bookManual} size="sm" className="bg-[#1a2a4a]">Log Meeting</Button>
            <Button variant="outline" size="sm" onClick={() => setShowManual(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[{ id: "upcoming", label: `Upcoming (${upcoming.length})` }, { id: "all", label: `All Meetings (${meetings.length})` }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >{t.label}</button>
        ))}
      </div>

      <div className="space-y-3">
        {(activeTab === "upcoming" ? upcoming : meetings).length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No meetings yet. Meetings are automatically created when leads book via Calendly, or you can log one manually above.</div>
        )}
        {(activeTab === "upcoming" ? upcoming : meetings).map((m: any) => (
          <div key={m.id} className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{m.inviteeName || "Unknown"}</p>
                    <p className="text-xs text-gray-500">{m.inviteeEmail || ""}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "TBD"}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-medium ${m.status === "confirmed" ? "bg-green-100 text-green-700" : m.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                    {m.status}
                  </span>
                  {m.outcome && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{m.outcome}</span>}
                </div>
                {m.notes && <p className="text-xs text-gray-500 mt-1 italic">{m.notes}</p>}
              </div>
              {new Date(m.scheduledAt) < new Date() && !m.outcome && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-gray-400 mb-1">Mark outcome:</p>
                  {OUTCOME_OPTIONS.map(o => (
                    <button key={o} onClick={() => updateOutcome(m.id, o)}
                      className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 capitalize">{o.replace("_", " ")}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTREACH CAMPAIGNS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function OutreachCampaignsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "", goal: "meeting_booked", weeklyMeetingGoal: 5,
    personaTitles: "immigration attorney, immigration lawyer",
    personaGeos: "United Arab Emirates, Saudi Arabia, Mexico, South Korea",
    voiceProfileId: "dylan-default",
  });

  const { data: campaigns = [], isLoading } = useQuery<any[]>({
    queryKey: ["outreach-campaigns"],
    queryFn: () => api("/api/agent/outreach-campaigns"),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => api("/api/agent/outreach-campaigns", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["outreach-campaigns"] }); setShowCreate(false); toast({ title: "Campaign created" }); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, killSwitch }: { id: string; killSwitch: boolean }) =>
      api(`/api/agent/outreach-campaigns/${id}`, { method: "PATCH", body: JSON.stringify({ killSwitch }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach-campaigns"] }),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent/outreach-campaigns/${id}/run`, { method: "POST" }),
    onSuccess: (_, id) => { qc.invalidateQueries({ queryKey: ["outreach-campaigns"] }); toast({ title: "Campaign loop complete" }); },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outreach Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Persona-driven autonomous campaigns. Claude finds leads, scores them, drafts touches.</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + New Campaign
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Create Campaign</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Campaign Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="UAE Immigration Attorneys — E-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Weekly Meeting Goal</label>
              <input type="number" value={form.weeklyMeetingGoal} onChange={e => setForm(f => ({ ...f, weeklyMeetingGoal: parseInt(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Target Titles (comma-separated)</label>
            <input value={form.personaTitles} onChange={e => setForm(f => ({ ...f, personaTitles: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Target Geographies (comma-separated)</label>
            <input value={form.personaGeos} onChange={e => setForm(f => ({ ...f, personaGeos: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm">Cancel</button>
            <button
              onClick={() => createMut.mutate({
                name: form.name, goal: form.goal, weeklyMeetingGoal: form.weeklyMeetingGoal,
                voiceProfileId: form.voiceProfileId,
                personaTarget: {
                  titles: form.personaTitles.split(",").map(s => s.trim()),
                  geos: form.personaGeos.split(",").map(s => s.trim()),
                },
                channelsEnabled: ["email", "whatsapp"],
              })}
              disabled={!form.name || createMut.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {createMut.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-center text-gray-400 py-12">Loading...</div> : (
        <div className="space-y-4">
          {campaigns.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No campaigns yet. Create one to start booking meetings.</p>
            </div>
          ) : campaigns.map((c: any) => (
            <div key={c.campaign.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{c.campaign.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.campaign.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.campaign.status}
                    </span>
                    {c.campaign.killSwitch && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">PAUSED</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {((c.campaign.personaTarget as any)?.titles ?? []).join(", ")} · {((c.campaign.personaTarget as any)?.geos ?? []).join(", ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleMut.mutate({ id: c.campaign.id, killSwitch: !c.campaign.killSwitch })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${c.campaign.killSwitch ? "border-green-300 text-green-700 hover:bg-green-50" : "border-red-300 text-red-600 hover:bg-red-50"}`}>
                    {c.campaign.killSwitch ? "Resume" : "Pause"}
                  </button>
                  <button onClick={() => runMut.mutate(c.campaign.id)} disabled={runMut.isPending}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                    {runMut.isPending ? "Running..." : "Run Now"}
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-5 gap-3">
                {[
                  { label: "Meetings / Goal", value: `${c.stats.meetingsBookedThisWeek}/${c.stats.weeklyGoal}` },
                  { label: "Pending Approval", value: c.stats.pending },
                  { label: "Sent", value: c.stats.sent },
                  { label: "Replied", value: `${c.stats.replied} (${c.stats.replyRate}%)` },
                  { label: "LinkedIn Queue", value: c.stats.linkedinQueue },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-gray-900">{s.value}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVAL INBOX SECTION
// ═══════════════════════════════════════════════════════════════════════════════

type Touch = {
  id: string; contactId: string; campaignId: string; channel: string; stepNumber: number;
  status: string; subject: string | null; body: string; personalizationHook: string | null;
  confidenceScore: number | null; createdAt: string;
  lead?: { fullName: string; title: string | null; company: string | null; email: string | null; score: number | null } | null;
};

function ApprovalInboxSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const { data, isLoading, refetch } = useQuery<{ total: number; byChannel: Record<string, Touch[]> }>({
    queryKey: ["touches-pending"],
    queryFn: () => api("/api/agent/touches/pending"),
    refetchInterval: 30000,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent/touches/${id}/approve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["touches-pending"] }); toast({ title: "Approved & marked sent" }); },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent/touches/${id}/reject`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["touches-pending"] }); toast({ title: "Rejected" }); },
  });

  const editMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api(`/api/agent/touches/${id}`, { method: "PATCH", body: JSON.stringify({ body }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["touches-pending"] }); setEditingId(null); toast({ title: "Saved" }); },
  });

  const bulkMut = useMutation({
    mutationFn: (channel: string) => api("/api/agent/touches/bulk-approve", { method: "POST", body: JSON.stringify({ channel }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["touches-pending"] }); toast({ title: "All approved" }); },
  });

  const CHANNEL_LABELS: Record<string, string> = {
    email: "📧 Email", whatsapp: "💬 WhatsApp", sms: "📱 SMS",
    linkedin_draft: "💼 LinkedIn Draft", forum_draft: "🗣 Forum Draft",
  };

  if (isLoading) return <div className="text-center text-gray-400 py-12">Loading...</div>;

  const total = data?.total ?? 0;
  const byChannel = data?.byChannel ?? {};

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Inbox</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} touch{total !== 1 ? "es" : ""} awaiting your review</p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-gray-100">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {total === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
          <p>You're all caught up. No pending touches.</p>
        </div>
      ) : (
        Object.entries(byChannel).map(([channel, touches]) => (
          <div key={channel} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <span className="font-medium text-gray-700">{CHANNEL_LABELS[channel] ?? channel} · {touches.length}</span>
              {channel !== "linkedin_draft" && channel !== "forum_draft" && (
                <button onClick={() => bulkMut.mutate(channel)} disabled={bulkMut.isPending}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                  Approve all {touches.length}
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {touches.map((t: Touch) => (
                <div key={t.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-sm text-gray-900">{t.lead?.fullName ?? "Unknown"}</span>
                        {t.lead?.title && <span className="text-xs text-gray-500">{t.lead.title} at {t.lead.company}</span>}
                        {t.lead?.score && <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">Score: {t.lead.score}</span>}
                        {t.personalizationHook && <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full italic truncate max-w-xs">{t.personalizationHook}</span>}
                      </div>
                      {t.subject && <div className="text-xs font-medium text-gray-600 mb-1">Subject: {t.subject}</div>}
                      {editingId === t.id ? (
                        <div className="space-y-2">
                          <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={6}
                            className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none" />
                          <div className="flex gap-2">
                            <button onClick={() => editMut.mutate({ id: t.id, body: editBody })} className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1 border border-gray-200 rounded-lg">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-2 max-h-40 overflow-y-auto">{t.body}</pre>
                      )}
                    </div>
                    {editingId !== t.id && (
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button onClick={() => approveMut.mutate(t.id)} disabled={approveMut.isPending}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">Approve</button>
                        <button onClick={() => { setEditingId(t.id); setEditBody(t.body); }}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">Edit</button>
                        <button onClick={() => rejectMut.mutate(t.id)}
                          className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50">Reject</button>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-400">{new Date(t.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPLY CENTER SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const SENTIMENT_COLORS: Record<string, string> = {
  interested: "bg-green-100 text-green-700",
  objection: "bg-amber-100 text-amber-700",
  unsubscribe: "bg-red-100 text-red-700",
  out_of_office: "bg-gray-100 text-gray-500",
  cold: "bg-blue-50 text-blue-600",
};

function ReplyCenterSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [manualReply, setManualReply] = useState<Record<string, string>>({});

  const { data: replies = [], isLoading } = useQuery<any[]>({
    queryKey: ["touches-replies"],
    queryFn: () => api("/api/agent/touches/replies"),
    refetchInterval: 60000,
  });

  const handleMut = useMutation({
    mutationFn: ({ id, replyBody }: { id: string; replyBody: string }) =>
      api(`/api/agent/touches/${id}/handle-reply`, { method: "POST", body: JSON.stringify({ replyBody }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["touches-replies"] }); qc.invalidateQueries({ queryKey: ["touches-pending"] }); toast({ title: "Reply processed — follow-up drafted" }); setProcessingId(null); },
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent/touches/${id}/approve`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["touches-replies"] }); toast({ title: "Follow-up approved" }); },
  });

  if (isLoading) return <div className="text-center text-gray-400 py-12">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reply Center</h1>
        <p className="text-sm text-gray-500 mt-0.5">{replies.length} repl{replies.length !== 1 ? "ies" : "y"} received. Claude classifies sentiment and drafts responses.</p>
      </div>

      {replies.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No replies yet. Once leads respond, they appear here.</p>
        </div>
      ) : (
        replies.map((r: any) => (
          <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{r.lead?.fullName ?? "Unknown"}</span>
                  {r.lead?.company && <span className="text-xs text-gray-500">{r.lead.company}</span>}
                  {r.replySentiment && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SENTIMENT_COLORS[r.replySentiment] ?? "bg-gray-100 text-gray-600"}`}>
                      {r.replySentiment.replace("_", " ")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{r.replyReceivedAt ? new Date(r.replyReceivedAt).toLocaleString() : "Recently"}</p>
              </div>
            </div>

            {r.replyBody && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <div className="text-xs font-medium text-blue-700 mb-1">Their reply</div>
                <p className="text-sm text-blue-900 whitespace-pre-wrap">{r.replyBody}</p>
              </div>
            )}

            {r.followUp && (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="text-xs font-medium text-gray-600 mb-1">Suggested follow-up — awaiting your approval</div>
                <div className="text-xs text-gray-500 mb-1">Subject: {r.followUp.subject}</div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.followUp.body}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => approveMut.mutate(r.followUp.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs">Approve & Send</button>
                </div>
              </div>
            )}

            {!r.replySentiment && !r.replyBody && (
              <div className="space-y-2">
                <label className="text-xs text-gray-500">Paste the reply body to have Claude classify and draft a response:</label>
                <textarea
                  value={manualReply[r.id] ?? ""}
                  onChange={e => setManualReply(m => ({ ...m, [r.id]: e.target.value }))}
                  rows={4} className="w-full text-sm border border-gray-200 rounded-lg p-2 resize-none"
                  placeholder="Paste their reply here..." />
                <button
                  onClick={() => { setProcessingId(r.id); handleMut.mutate({ id: r.id, replyBody: manualReply[r.id] ?? "" }); }}
                  disabled={!manualReply[r.id] || handleMut.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs disabled:opacity-50">
                  {processingId === r.id && handleMut.isPending ? "Processing..." : "Process with Claude"}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINKEDIN QUEUE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function LinkedInQueueSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "sent" | "skipped" | "all">("pending");

  const { data: allItems = [], isLoading } = useQuery<any[]>({
    queryKey: ["linkedin-queue"],
    queryFn: () => api("/api/agent/touches/linkedin"),
    refetchInterval: 60000,
  });

  const markSentMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent/touches/${id}/mark-sent`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin-queue"] }); toast({ title: "Marked as sent ✓" }); },
  });
  const skipMut = useMutation({
    mutationFn: (id: string) => api(`/api/agent/touches/${id}/skip`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["linkedin-queue"] }); toast({ title: "Skipped" }); },
  });

  const pending = allItems.filter((t: any) => t.status === "pending");
  const items = filter === "all" ? allItems : allItems.filter((t: any) => t.status === filter);

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    sent: "bg-green-100 text-green-800",
    skipped: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LinkedIn Queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {pending.length} pending · {allItems.length} total. Copy-paste into LinkedIn — no automation, ever.
          </p>
        </div>
        <div className="flex gap-1 text-xs">
          {(["pending","sent","skipped","all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg capitalize ${filter === f ? "bg-gray-900 text-white" : "border border-gray-200 hover:bg-gray-50 text-gray-600"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Manual only:</strong> LinkedIn does not allow third-party automation. Copy each message below and paste it into LinkedIn's messaging. Then click "Mark as Sent."
      </div>

      {isLoading ? <div className="text-center text-gray-400 py-12">Loading...</div> : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{filter === "pending" ? "No pending LinkedIn messages. The agent will queue them here when it runs." : `No ${filter} items.`}</p>
        </div>
      ) : (
        items.map((t: any) => (
          <div key={t.id} className={`bg-white border rounded-xl p-5 ${t.status === "skipped" ? "opacity-60" : "border-gray-200"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{t.lead?.fullName ?? "Unknown"}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[t.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {t.status}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 capitalize">
                    {t.type?.replace("_", " ")}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{t.lead?.title}{t.lead?.company ? ` · ${t.lead.company}` : ""}</div>
                {t.lead?.linkedinUrl && (
                  <a href={t.lead.linkedinUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block">View LinkedIn →</a>
                )}
              </div>
              {t.status === "pending" && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { navigator.clipboard.writeText(t.body); toast({ title: "Copied to clipboard" }); }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50">Copy</button>
                  <button onClick={() => skipMut.mutate(t.id)} disabled={skipMut.isPending}
                    className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50">Skip</button>
                  <button onClick={() => markSentMut.mutate(t.id)} disabled={markSentMut.isPending}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50">Mark Sent</button>
                </div>
              )}
              {t.status === "sent" && (
                <span className="text-xs text-green-600 flex-shrink-0">Sent {t.sentAt ? new Date(t.sentAt).toLocaleDateString() : ""}</span>
              )}
            </div>
            <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap font-mono">{t.body}</div>
            <div className="mt-2 text-xs text-gray-400">Queued {new Date(t.createdAt).toLocaleString()}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE PROFILE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function VoiceProfileSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState("dylan-default");
  const [form, setForm] = useState<any>(null);
  const [newSample, setNewSample] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const { data: profiles = [] } = useQuery<any[]>({
    queryKey: ["voice-profiles"],
    queryFn: () => api("/api/agent/voice-profiles"),
  });

  const selected = profiles.find((p: any) => p.id === selectedId) ?? profiles[0];

  useEffect(() => {
    if (selected && !form) setForm({ ...selected });
  }, [selected]);

  const saveMut = useMutation({
    mutationFn: (data: any) => api(`/api/agent/voice-profiles/${form.id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["voice-profiles"] }); toast({ title: "Voice profile saved" }); },
  });

  if (!form) return <div className="text-center text-gray-400 py-12">Loading...</div>;

  const samples: string[] = Array.isArray(form.sampleMessages) ? form.sampleMessages : [];
  const doNotSay: string[] = Array.isArray(form.doNotSay) ? form.doNotSay : [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Voice Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Train Claude to write in Dylan's voice. Paste real messages he's sent as samples.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Profile Name</label>
          <input value={form.name ?? ""} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Tone Rules</label>
          <textarea value={form.toneRules ?? ""} onChange={e => setForm((f: any) => ({ ...f, toneRules: e.target.value }))}
            rows={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
            placeholder="Describe the writing style. E.g.: Short sentences. Warm but direct. Occasional dry humor. Never corporate." />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">Signature Block</label>
          <textarea value={form.signatureBlock ?? ""} onChange={e => setForm((f: any) => ({ ...f, signatureBlock: e.target.value }))}
            rows={4} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none font-mono text-xs"
            placeholder={"Dylan Rivera\nFounder, New Dawn Franchising\ndylan@newdawnfranchising.com\n\nUnsubscribe: {{unsubscribe_url}} | 1234 Montana Ave, El Paso TX 79902"} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">Banned Phrases ({doNotSay.length})</label>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {doNotSay.map((phrase, i) => (
              <span key={i} className="flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-100">
                {phrase}
                <button onClick={() => setForm((f: any) => ({ ...f, doNotSay: f.doNotSay.filter((_: string, j: number) => j !== i) }))}
                  className="hover:text-red-900 ml-0.5">×</button>
              </span>
            ))}
          </div>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Type a phrase to ban and press Enter"
            onKeyDown={e => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) { setForm((f: any) => ({ ...f, doNotSay: [...(f.doNotSay ?? []), val] })); (e.target as HTMLInputElement).value = ""; }
              }
            }} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-700">Sample Messages ({samples.length})</label>
            <span className="text-xs text-gray-400">Paste real messages Dylan has sent. Claude studies these to match his voice.</span>
          </div>
          <div className="space-y-2 mb-3">
            {samples.map((s, i) => (
              <div key={i} className="flex gap-2 items-start">
                <pre className="flex-1 text-xs bg-gray-50 rounded-lg p-2 whitespace-pre-wrap font-sans border border-gray-100">{s}</pre>
                <button onClick={() => setForm((f: any) => ({ ...f, sampleMessages: f.sampleMessages.filter((_: string, j: number) => j !== i) }))}
                  className="text-red-400 hover:text-red-600 text-sm mt-1">×</button>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <textarea value={newSample} onChange={e => setNewSample(e.target.value)} rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="Paste a real email or message Dylan sent here..." />
            <button onClick={() => { if (newSample.trim()) { setForm((f: any) => ({ ...f, sampleMessages: [...(f.sampleMessages ?? []), newSample.trim()] })); setNewSample(""); } }}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">+ Add Sample</button>
          </div>
        </div>

        {preview && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="text-xs font-medium text-blue-700 mb-2">Voice Preview (test message)</div>
            <pre className="text-sm text-blue-900 whitespace-pre-wrap font-sans">{preview}</pre>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => saveMut.mutate({ name: form.name, toneRules: form.toneRules, signatureBlock: form.signatureBlock, doNotSay: form.doNotSay, sampleMessages: form.sampleMessages })}
            disabled={saveMut.isPending}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saveMut.isPending ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Agent SMS Communications Panel ──────────────────────────────────────────
interface SmsMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  createdAt: string;
  fromNumber: string;
  toNumber: string;
  triggerType?: string;
}

function AgentSmsCommsSection({ agentType }: { agentType: "outreach" | "seo" }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery<SmsMessage[]>({
    queryKey: ["agent-sms", agentType],
    queryFn: () => api(`/api/agent-sms/${agentType}`),
    refetchInterval: 10000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMut = useMutation({
    mutationFn: (body: string) => api(`/api/agent-sms/${agentType}/send`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => {
      setMessage("");
      qc.invalidateQueries({ queryKey: ["agent-sms", agentType] });
    },
    onError: (e: Error) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const testMut = useMutation({
    mutationFn: () => api("/api/agent-sms/test", { method: "POST", body: JSON.stringify({ agentType, message: "Test notification from agent" }) }),
    onSuccess: () => { toast({ title: "Test SMS sent" }); qc.invalidateQueries({ queryKey: ["agent-sms", agentType] }); },
    onError: (e: Error) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  const agentLabel = agentType === "seo" ? "SEO Agent" : "Outreach Agent";
  const agentNumber = agentType === "seo" ? "+1 (407) 449-7941" : "+1 (808) 460-6509";
  const dylanNumber = "+1 (863) 360-7768";

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">SMS Communications — {agentLabel}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Agent line: {agentNumber} · Dylan: {dylanNumber}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {testMut.isPending ? "Sending…" : "Send Test SMS"}
          </button>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["agent-sms", agentType] })}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* Thread */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 h-[480px] overflow-y-auto space-y-3 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading messages…</div>
        ) : sorted.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
            <MessageCircle className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">The agent will send notifications here when drafts or blockers arise.</p>
          </div>
        ) : (
          sorted.map(msg => {
            const isDylan = msg.direction === "inbound";
            return (
              <div key={msg.id} className={`flex ${isDylan ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${isDylan ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                  <p className={`text-[10px] mt-1 ${isDylan ? "text-blue-200" : "text-gray-400"}`}>
                    {isDylan ? "Dylan" : agentLabel} · {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                    {msg.status && msg.status !== "sent" && ` · ${msg.status}`}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex gap-2">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && message.trim()) { e.preventDefault(); sendMut.mutate(message.trim()); } }}
          placeholder={`Reply to ${agentLabel}…`}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => { if (message.trim()) sendMut.mutate(message.trim()); }}
          disabled={sendMut.isPending || !message.trim()}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
          <Send className="w-4 h-4" />
          {sendMut.isPending ? "Sending…" : "Send"}
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center">
        Messages are sent via Quo SMS. Dylan can also reply directly from his phone at any time.
      </p>
    </div>
  );
}

// ─── Daily Intelligence Section ───────────────────────────────────────────────
function DailyIntelligenceSection() {
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ["/api/outreach/intelligence/plans"],
    queryFn: () => fetch("/api/outreach/intelligence/plans", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const todayQuery = useQuery({
    queryKey: ["/api/outreach/intelligence/today"],
    queryFn: () => fetch("/api/outreach/intelligence/today", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 15000,
  });

  const runNow = async () => {
    setRunning(true);
    setRunMsg("");
    try {
      const r = await fetch("/api/outreach/intelligence/run", { method: "POST", credentials: "include" });
      const d = await r.json();
      setRunMsg(d.message ?? "Running…");
      setTimeout(() => { plansQuery.refetch(); todayQuery.refetch(); }, 5000);
    } catch (e: any) {
      setRunMsg("Error: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  const statusColors: Record<string, string> = {
    awaiting_approval: "bg-yellow-100 text-yellow-800",
    approved: "bg-blue-100 text-blue-800",
    executing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    rejected: "bg-gray-100 text-gray-600",
    failed: "bg-red-100 text-red-700",
  };

  const today = todayQuery.data as any;
  const plans = (plansQuery.data ?? []) as any[];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-emerald-600" />
            Daily Intelligence Agent
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Runs at 6 AM ET Mon–Fri · Plans target categories · Texts Dylan for approval · Discovers leads on approval
          </p>
        </div>
        <button onClick={runNow} disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {running ? "Planning…" : "Run Now"}
        </button>
      </div>

      {runMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">{runMsg}</div>
      )}

      {/* Today's plan status */}
      {today && !today.error && (
        <div className={`rounded-xl border p-5 ${statusColors[today.status] ? "" : ""}`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Today · {today.planDate}</p>
              <p className="text-base font-semibold text-gray-900">{today.planSummary}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${statusColors[today.status] ?? "bg-gray-100 text-gray-600"}`}>
              {today.status?.replace(/_/g, " ")}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-lg font-bold text-gray-900">{(today.leadCategories as any[])?.length ?? 0}</p>
              <p className="text-xs text-gray-500">categories</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-lg font-bold text-gray-900">~{today.estimatedLeads ?? 0}</p>
              <p className="text-xs text-gray-500">est. leads</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-lg font-bold text-gray-900">{today.discoveredCount ?? 0}</p>
              <p className="text-xs text-gray-500">discovered</p>
            </div>
          </div>
          {today.status === "awaiting_approval" && (
            <p className="text-xs text-yellow-700 mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              ⏳ Waiting for your approval via SMS link. Check your phone!
            </p>
          )}
        </div>
      )}

      {/* Recent plans table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Plans (last 14 days)</h3>
        {plansQuery.isLoading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading plans…</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
            <Brain className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No plans yet. Click "Run Now" to generate today's plan.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {plans.map((plan: any) => (
              <div key={plan.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[plan.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {plan.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">{plan.planDate}</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{plan.planSummary}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                    <div className="text-right text-xs text-gray-500 hidden sm:block">
                      <span className="font-semibold text-gray-700">{plan.discoveredCount ?? 0}</span>/{plan.estimatedLeads ?? 0} leads
                    </div>
                    {expandedId === plan.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>
                {expandedId === plan.id && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    {plan.strategicReasoning && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reasoning</p>
                        <p className="text-sm text-gray-700">{plan.strategicReasoning}</p>
                      </div>
                    )}
                    {(plan.leadCategories as any[])?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Target Categories</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(plan.leadCategories as any[]).map((c: any, i: number) => (
                            <span key={i} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full capitalize">
                              {c.category?.replace(/_/g, " ")} · {c.country}
                              {c.priority === "high" && " ⭐"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {plan.reviewNotes && (
                      <p className="text-xs text-gray-500 italic">Notes: {plan.reviewNotes}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
