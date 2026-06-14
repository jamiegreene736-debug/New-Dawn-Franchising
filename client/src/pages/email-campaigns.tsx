import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  Edit2,
  ExternalLink,
  Linkedin,
  Loader2,
  Mail,
  MailOpen,
  MessageSquare,
  Pause,
  Phone,
  Play,
  Plus,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
  Eye,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  steps?: Step[];
}

interface Step {
  id: string;
  campaignId: string;
  stepOrder: number;
  delayDays: number;
  subject: string;
  bodyHtml: string;
  stepType?: string;
  stepName?: string | null;
  priority?: string | null;
}

interface CampaignStats {
  overview: {
    total: number;
    active: number;
    completed: number;
    paused: number;
    emails: number;
    opens: number;
    clicks: number;
    replies: number;
    bounced: number;
  };
  perStep: Record<string, { sent: number; opened: number; clicked: number; bounced: number; tasks: number; notSent: number }>;
}

interface Enrollment {
  id: string;
  campaignId: string;
  prospectId: string;
  prospectEmail: string;
  prospectName: string;
  currentStep: number;
  status: string;
  enrolledAt: string;
  completedAt: string | null;
}

// Projected send-schedule for a campaign (GET /api/crm/campaigns/:id/schedule).
interface ScheduledStep {
  stepOrder: number;
  stepNumber: number;
  name: string;
  stepType: string;
  delayDays: number;
  sendAt: string | null; // ISO; null when enrollment is paused/completed
}
interface EnrollmentSchedule {
  enrollmentId: string;
  prospectName: string;
  prospectEmail: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  nextSendAt: string | null;
  nextStepName: string | null;
  nextStepType: string | null;
  upcoming: ScheduledStep[];
}
interface CampaignSchedule {
  windowSummary: string;
  enrollments: EnrollmentSchedule[];
}

/** Format an ISO send time in Central time, e.g. "Tue, Jun 17, 8:00 AM CT". */
function formatSendTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(d) + " CT";
}

// One row in the unified Activity feed (/api/crm/activity) — a single touch on any
// channel: campaign sends, manual emails/texts/calls/LinkedIn, inbound replies, notes…
interface ActivityItem {
  id: string;
  source: "campaign" | "contact" | "client";
  channel: "email" | "sms" | "whatsapp" | "call" | "linkedin" | "note" | "status" | "document" | "task" | "other";
  direction: "outbound" | "inbound";
  name: string;
  target: string;
  detail: string;
  status: string;
  timestamp: string | null;
}

interface Prospect {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  category: string;
  location: string;
}

interface ProspectList {
  id: string;
  name: string;
  count: number;
}

interface ContactLite {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  firmName: string | null;
  jobTitle: string | null;
  source?: string;
}

interface SmsCampaignData {
  id: string;
  name: string;
  message: string;
  listId: string | null;
  status: string;
  sentCount: number;
  failCount: number;
  createdAt: string;
  sentAt: string | null;
}
type WaCampaignData = SmsCampaignData;

// ─── Activity feed channel catalog ───────────────────────────────────────────
// Drives the channel filter chips, the per-channel icon/colour in each row, and the
// stat tiles at the top of the Activity tab.
const CHANNEL_META: Record<
  ActivityItem["channel"],
  { label: string; icon: typeof Mail; color: string; bg: string }
> = {
  email:    { label: "Email",    icon: Mail,          color: "text-blue-600",    bg: "bg-blue-100 text-blue-700" },
  sms:      { label: "Text",     icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-100 text-emerald-700" },
  whatsapp: { label: "WhatsApp", icon: Smartphone,    color: "text-green-600",   bg: "bg-green-100 text-green-700" },
  call:     { label: "Call",     icon: Phone,         color: "text-amber-600",   bg: "bg-amber-100 text-amber-700" },
  linkedin: { label: "LinkedIn", icon: Linkedin,      color: "text-sky-600",     bg: "bg-sky-100 text-sky-700" },
  note:     { label: "Note",     icon: Edit2,         color: "text-gray-500",    bg: "bg-gray-100 text-gray-600" },
  status:   { label: "Status",   icon: Zap,           color: "text-violet-600",  bg: "bg-violet-100 text-violet-700" },
  document: { label: "Document", icon: CheckSquare,   color: "text-indigo-600",  bg: "bg-indigo-100 text-indigo-700" },
  task:     { label: "Task",     icon: CheckSquare,   color: "text-purple-600",  bg: "bg-purple-100 text-purple-700" },
  other:    { label: "Other",    icon: Clock,         color: "text-gray-400",    bg: "bg-gray-100 text-gray-600" },
};

function channelMeta(channel: string) {
  return CHANNEL_META[(channel as ActivityItem["channel"])] ?? CHANNEL_META.other;
}

// Chips shown above the Activity table — "All channels" plus one per channel.
const CHANNEL_FILTERS: { key: string; label: string; icon: typeof Mail }[] = [
  { key: "all", label: "All channels", icon: Zap },
  ...(["email", "sms", "whatsapp", "call", "linkedin", "note", "status", "document"] as const).map(
    (c) => ({ key: c, label: CHANNEL_META[c].label, icon: CHANNEL_META[c].icon })
  ),
];

function ActivityStatusBadge({ item }: { item: ActivityItem }) {
  const map: Record<string, { label: string; cls: string }> = {
    opened:   { label: "Opened",   cls: "bg-green-100 text-green-700" },
    sent:     { label: item.direction === "inbound" ? "Received" : "Sent", cls: "bg-blue-100 text-blue-700" },
    received: { label: "Received", cls: "bg-cyan-100 text-cyan-700" },
    failed:   { label: "Failed",   cls: "bg-red-100 text-red-700" },
    pending:  { label: "Pending",  cls: "bg-gray-100 text-gray-600" },
    task:     { label: "Task",     cls: "bg-purple-100 text-purple-700" },
  };
  const s = map[item.status] ?? { label: item.status || "—", cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── Step type catalog (Seamless-style "Add a Step" picker) ──────────────────

const STEP_TYPES = [
  { type: "email", label: "Automatic Email", desc: "Auto-sent email from franchising@", icon: Mail },
  { type: "manual_email", label: "Manual Email", desc: "A reminder to send an email yourself", icon: MailOpen },
  { type: "sms", label: "SMS (Quo)", desc: "Auto-sent text message via Quo", icon: MessageSquare },
  { type: "call", label: "Call", desc: "A task to call the contact", icon: Phone },
  { type: "linkedin_connect", label: "LinkedIn Connect Request", desc: "Task: send a LinkedIn connection", icon: Linkedin },
  { type: "linkedin_message", label: "LinkedIn Message", desc: "Task: send a LinkedIn message", icon: Linkedin },
  { type: "task", label: "Custom Task", desc: "A generic to-do for this contact", icon: CheckSquare },
] as const;

type StepMeta = { type: string; label: string; desc: string; icon: typeof Mail };

function stepMeta(type: string | undefined | null): StepMeta {
  return STEP_TYPES.find((s) => s.type === type) ?? { type: type || "email", label: "Automatic Email", desc: "", icon: Mail };
}

// email | sms steps carry content; everything else is a manual task.
const CHANNEL_OF: Record<string, "email" | "sms" | "task"> = {
  email: "email", manual_email: "email", sms: "sms",
  call: "task", linkedin_connect: "task", linkedin_message: "task", task: "task",
};

const PRIORITIES = ["None", "Low", "Medium", "High"];

// Swap merge fields for sample values in the live preview pane.
function previewMerge(text: string): string {
  return (text || "")
    .replace(/\[Contact First Name\]/gi, "John")
    .replace(/\{\{\s*firstName\s*\}\}/gi, "John")
    .replace(/\{\{\s*name\s*\}\}/gi, "John Carter")
    .replace(/\{\{\s*email\s*\}\}/gi, "john.carter@example.com");
}

function EmailCampaignTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"campaigns" | "sends">("campaigns");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [editCampaign, setEditCampaign] = useState<{ id: string; name: string; description: string } | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showEnrollListModal, setShowEnrollListModal] = useState(false);
  const [enrollListId, setEnrollListId] = useState<string>("");
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [viewingStep, setViewingStep] = useState<Step | null>(null);
  const [builderView, setBuilderView] = useState<"overview" | "contacts">("overview");
  const [showAddStep, setShowAddStep] = useState(false);
  const [addStepType, setAddStepType] = useState<string>("email");
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [showEnrollContacts, setShowEnrollContacts] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState("");
  const [openSchedule, setOpenSchedule] = useState<Set<string>>(new Set());
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/crm/campaigns"],
  });

  const { data: campaignDetail } = useQuery<Campaign>({
    queryKey: ["/api/crm/campaigns", selectedCampaign],
    queryFn: async () => {
      const res = await fetch(`/api/crm/campaigns/${selectedCampaign}`);
      return res.json();
    },
    enabled: !!selectedCampaign,
  });

  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: ["/api/crm/enrollments", selectedCampaign],
    queryFn: async () => {
      const url = selectedCampaign
        ? `/api/crm/enrollments?campaignId=${selectedCampaign}`
        : "/api/crm/enrollments";
      const res = await fetch(url);
      return res.json();
    },
    enabled: !!selectedCampaign,
  });

  const { data: stats } = useQuery<CampaignStats>({
    queryKey: ["/api/crm/campaigns", selectedCampaign, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/campaigns/${selectedCampaign}/stats`);
      return res.json();
    },
    enabled: !!selectedCampaign,
  });

  // Projected send schedule — when each enrollment's upcoming emails go out.
  const { data: schedule } = useQuery<CampaignSchedule>({
    queryKey: ["/api/crm/campaigns", selectedCampaign, "schedule"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/campaigns/${selectedCampaign}/schedule`);
      return res.json();
    },
    enabled: !!selectedCampaign,
  });
  const scheduleByEnrollment = new Map(
    (schedule?.enrollments ?? []).map((s) => [s.enrollmentId, s]),
  );
  // Earliest projected send time per step (across active enrollments) — drives
  // the timing shown on each step in the Steps tab.
  const sendAtByStepOrder = new Map<number, string>();
  for (const en of schedule?.enrollments ?? []) {
    if (en.status !== "active") continue;
    for (const u of en.upcoming) {
      if (!u.sendAt) continue;
      const prev = sendAtByStepOrder.get(u.stepOrder);
      if (!prev || new Date(u.sendAt) < new Date(prev)) sendAtByStepOrder.set(u.stepOrder, u.sendAt);
    }
  }
  const hasActiveEnrollment = (schedule?.enrollments ?? []).some((e) => e.status === "active");

  const { data: activity = [] } = useQuery<ActivityItem[]>({
    queryKey: ["/api/crm/activity"],
  });

  const { data: prospects = [] } = useQuery<Prospect[]>({
    queryKey: ["/api/crm/prospects"],
  });

  const { data: prospectLists = [] } = useQuery<ProspectList[]>({
    queryKey: ["/api/crm/prospect-lists"],
  });

  // Pull from BOTH CRM stores (crm_clients + contacts), merged + de-duped by the
  // server, so a person added in either CRM surface is enrollable here.
  const { data: contactsForEnroll = [] } = useQuery<ContactLite[]>({
    queryKey: ["/api/crm/enroll-candidates", "enroll-picker"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/crm/enroll-candidates");
      const json = await res.json();
      return (Array.isArray(json) ? json : json?.contacts ?? []) as ContactLite[];
    },
    enabled: showEnrollContacts,
  });

  const { data: listMembers = [], isFetching: listMembersFetching } = useQuery<Prospect[]>({
    queryKey: ["/api/crm/prospect-lists", enrollListId, "members"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/prospect-lists/${enrollListId}/members`);
      return res.json();
    },
    enabled: !!enrollListId,
  });

  const enrollFromListMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign || !enrollListId) throw new Error("No campaign or list selected");
      const eligible = listMembers.filter(m => m.email);
      if (eligible.length === 0) throw new Error("No prospects in this list have email addresses");
      const res = await apiRequest("POST", "/api/crm/enrollments", {
        campaignId: selectedCampaign,
        prospectIds: eligible.map(m => m.id),
      });
      return res.json();
    },
    onSuccess: (data: Enrollment[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns", selectedCampaign] });
      setShowEnrollListModal(false);
      setEnrollListId("");
      toast({ title: `${data.length} prospects enrolled from list`, description: "They will start receiving campaign emails." });
    },
    onError: (err: Error) => {
      toast({ title: "Enrollment failed", description: err.message, variant: "destructive" });
    },
  });

  const enrollableProspects = prospects.filter(
    (p) => p.email && !enrollments.some((e) => e.prospectId === p.id)
  );

  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set());

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) throw new Error("No campaign selected");
      const res = await apiRequest("POST", "/api/crm/enrollments", {
        campaignId: selectedCampaign,
        prospectIds: Array.from(selectedProspects),
      });
      return res.json();
    },
    onSuccess: (data: Enrollment[]) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns", selectedCampaign] });
      setShowEnrollModal(false);
      setSelectedProspects(new Set());
      toast({ title: `${data.length} prospects enrolled`, description: "They will start receiving campaign emails." });
    },
    onError: (err: Error) => {
      toast({ title: "Enrollment failed", description: err.message, variant: "destructive" });
    },
  });

  const enrollContactsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) throw new Error("No campaign selected");
      const res = await apiRequest("POST", "/api/crm/enrollments/from-contacts", {
        campaignId: selectedCampaign,
        contactIds: Array.from(selectedContacts),
      });
      return res.json();
    },
    onSuccess: (data: { count: number; skippedNoEmail: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns", selectedCampaign] });
      setShowEnrollContacts(false);
      setSelectedContacts(new Set());
      setContactSearch("");
      const skip = data.skippedNoEmail ? ` (${data.skippedNoEmail} skipped — no email)` : "";
      toast({ title: `${data.count} contact${data.count === 1 ? "" : "s"} enrolled`, description: `They'll start receiving the sequence.${skip}` });
    },
    onError: (err: Error) => {
      toast({ title: "Enrollment failed", description: err.message, variant: "destructive" });
    },
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) throw new Error("Open a campaign first.");
      // Scoped to THIS campaign only. Returns 202 immediately; processing
      // continues in the background.
      const res = await apiRequest("POST", "/api/crm/drip/process", { campaignId: selectedCampaign });
      return res.json();
    },
    onSuccess: () => {
      const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/activity"] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/enrollments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns", selectedCampaign] });
      };
      // The send runs server-side after we respond — refresh a couple of times
      // so the stats / step counts / schedule reflect it without a manual reload.
      refresh();
      setTimeout(refresh, 4000);
      setTimeout(refresh, 12000);
      toast({ title: "Sending started", description: "Due emails are going out now — counts will update in a few seconds." });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't start sending", description: err.message, variant: "destructive" });
    },
  });

  const toggleCampaignMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/crm/campaigns/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns"] });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/crm/campaigns", { name, isActive: true });
      return res.json();
    },
    onSuccess: (c: Campaign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns"] });
      setShowNewCampaign(false);
      setNewCampaignName("");
      setSelectedCampaign(c.id);
      setBuilderView("overview");
      toast({ title: "Campaign created", description: "Add your first step to start the sequence." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const duplicateCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/crm/campaigns/${id}/duplicate`);
      return res.json();
    },
    onSuccess: (c: Campaign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns"] });
      setSelectedCampaign(c.id);
      setBuilderView("overview");
      toast({ title: "Campaign duplicated", description: "Created as a paused copy — edit its steps, then activate." });
    },
    onError: (err: Error) => toast({ title: "Duplicate failed", description: err.message, variant: "destructive" }),
  });

  // Rename / edit a campaign's name + description.
  const updateCampaignMetaMutation = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description: string }) => {
      const res = await apiRequest("PATCH", `/api/crm/campaigns/${id}`, {
        name: name.trim(),
        description: description.trim() || null,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to save");
      return res.json();
    },
    onSuccess: (_c, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns", vars.id] });
      setEditCampaign(null);
      toast({ title: "Campaign updated" });
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const pauseEnrollmentMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/crm/enrollments/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns", selectedCampaign, "schedule"] });
      toast({ title: "Enrollment updated" });
    },
  });

  const saveStepMutation = useMutation({
    mutationFn: async (stepData: any) => {
      if (editingStep) {
        const res = await apiRequest("PATCH", `/api/crm/steps/${editingStep.id}`, stepData);
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/crm/campaigns/${selectedCampaign}/steps`, stepData);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns", selectedCampaign] });
      setShowStepEditor(false);
      setEditingStep(null);
      toast({ title: editingStep ? "Step updated" : "Step added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/crm/steps/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/campaigns", selectedCampaign] });
      toast({ title: "Step deleted" });
    },
  });

  const toggleProspect = (id: string) => {
    const next = new Set(selectedProspects);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProspects(next);
  };

  // Activity feed is already time-ordered (newest first) by the API — we only filter.
  const filteredActivity = useMemo(() => {
    let result = activity;
    if (filterChannel !== "all") {
      result = result.filter((a) => a.channel === filterChannel);
    }
    if (filterStatus !== "all") {
      result = result.filter((a) => (filterStatus === "opened" ? a.status === "opened" : a.status === filterStatus));
    }
    if (filterText) {
      const q = filterText.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.target.toLowerCase().includes(q) ||
          a.detail.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activity, filterText, filterStatus, filterChannel]);

  // Per-channel tallies for the stat tiles at the top of the Activity tab.
  const activityStats = useMemo(() => {
    const byChannel: Record<string, number> = {};
    for (const a of activity) byChannel[a.channel] = (byChannel[a.channel] || 0) + 1;
    return {
      total: activity.length,
      email: byChannel.email || 0,
      sms: byChannel.sms || 0,
      linkedin: byChannel.linkedin || 0,
      call: byChannel.call || 0,
      opened: activity.filter((a) => a.status === "opened").length,
    };
  }, [activity]);

  // Steps grouped by their "Day Step is Due" (delayDays) for the Seamless-style builder.
  const dayGroups = useMemo(() => {
    const steps = campaignDetail?.steps ?? [];
    const sorted = [...steps].sort((a, b) => a.delayDays - b.delayDays || a.stepOrder - b.stepOrder);
    const groups: { day: number; steps: Step[] }[] = [];
    for (const s of sorted) {
      let g = groups.find((x) => x.day === s.delayDays);
      if (!g) { g = { day: s.delayDays, steps: [] }; groups.push(g); }
      g.steps.push(s);
    }
    return groups;
  }, [campaignDetail]);

  return (
    <div data-testid="email-campaigns">
      <div className="flex gap-2 mb-6 border-b">
        <button
          data-testid="tab-campaigns"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "campaigns" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("campaigns")}
        >
          Campaigns
        </button>
        <button
          data-testid="tab-sends"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "sends" ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setActiveTab("sends")}
        >
          Activity ({activity.length})
        </button>
      </div>

      {activeTab === "campaigns" && (
        <>
          {!selectedCampaign ? (
            /* ── Campaign list ── */
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">Email Sequences</h3>
                  <p className="text-xs text-muted-foreground">Multi-step email, text &amp; task cadences. Open a campaign to edit its steps.</p>
                </div>
                <Button data-testid="button-new-campaign" size="sm" className="gap-1" onClick={() => { setShowNewCampaign(true); setNewCampaignName(""); }}>
                  <Plus className="size-3" /> New Campaign
                </Button>
              </div>

              {showNewCampaign && (
                <Card className="p-4 mb-4 border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]/30">
                  <Label>Campaign name</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      data-testid="input-new-campaign-name"
                      autoFocus
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder="e.g. E-2 Attorney Outreach"
                      onKeyDown={(e) => { if (e.key === "Enter" && newCampaignName.trim()) createCampaignMutation.mutate(newCampaignName.trim()); }}
                    />
                    <Button onClick={() => createCampaignMutation.mutate(newCampaignName.trim())} disabled={!newCampaignName.trim() || createCampaignMutation.isPending}>
                      {createCampaignMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewCampaign(false)}>Cancel</Button>
                  </div>
                </Card>
              )}

              {campaigns.length === 0 && !showNewCampaign ? (
                <Card className="p-8 text-center">
                  <Mail className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">No campaigns yet. Click <span className="font-medium">New Campaign</span> to build your first sequence.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <Card
                      key={campaign.id}
                      data-testid={`campaign-${campaign.id}`}
                      className="p-4 cursor-pointer transition-colors hover:border-[hsl(var(--primary))]"
                      onClick={() => { setSelectedCampaign(campaign.id); setBuilderView("overview"); }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{campaign.name}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${campaign.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {campaign.isActive ? "Active" : "Paused"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            data-testid={`button-edit-campaign-${campaign.id}`}
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-muted-foreground"
                            title="Rename or edit this campaign"
                            onClick={(e) => { e.stopPropagation(); setEditCampaign({ id: campaign.id, name: campaign.name, description: campaign.description || "" }); }}
                          >
                            <Edit2 className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            data-testid={`button-duplicate-campaign-${campaign.id}`}
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-muted-foreground"
                            title="Duplicate this campaign and its steps"
                            disabled={duplicateCampaignMutation.isPending}
                            onClick={(e) => { e.stopPropagation(); duplicateCampaignMutation.mutate(campaign.id); }}
                          >
                            {duplicateCampaignMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                            Duplicate
                          </Button>
                          <ChevronDown className="size-4 -rotate-90 text-muted-foreground" />
                        </div>
                      </div>
                      {campaign.description && <p className="mt-1 text-xs text-muted-foreground">{campaign.description}</p>}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : campaignDetail ? (
            /* ── Seamless-style sequence builder ── */
            <div>
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3 min-w-0">
                  <Button data-testid="button-back-campaigns" size="sm" variant="ghost" className="gap-1" onClick={() => setSelectedCampaign(null)}>
                    <ArrowLeft className="size-4" /> All
                  </Button>
                  <h3 className="text-xl font-semibold truncate">{campaignDetail.name}</h3>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${campaignDetail.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {campaignDetail.isActive ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button data-testid="button-process-drip" size="sm" variant="outline" className="gap-2" onClick={() => setShowSendConfirm(true)} disabled={processMutation.isPending}>
                    {processMutation.isPending ? <><Loader2 className="size-4 animate-spin" /> Processing…</> : <><Send className="size-4" /> Send Due Now</>}
                  </Button>
                  <Button data-testid="button-edit-campaign" size="sm" variant="outline" className="gap-1" title="Rename or edit this campaign" onClick={() => setEditCampaign({ id: campaignDetail.id, name: campaignDetail.name, description: campaignDetail.description || "" })}>
                    <Edit2 className="size-4" /> Edit
                  </Button>
                  <Button data-testid="button-duplicate-campaign" size="sm" variant="outline" className="gap-1" title="Duplicate this campaign and its steps" disabled={duplicateCampaignMutation.isPending} onClick={() => duplicateCampaignMutation.mutate(campaignDetail.id)}>
                    {duplicateCampaignMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />} Duplicate
                  </Button>
                  <Button data-testid="button-toggle-campaign" size="sm" variant="outline" className="gap-1" onClick={() => toggleCampaignMutation.mutate({ id: campaignDetail.id, isActive: !campaignDetail.isActive })}>
                    {campaignDetail.isActive ? <><Pause className="size-4" /> Pause Campaign</> : <><Play className="size-4" /> Activate</>}
                  </Button>
                </div>
              </div>

              {/* Overview stat row */}
              <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 mb-6">
                {[
                  { label: "Total", value: stats?.overview.total ?? enrollments.length, color: "text-[hsl(var(--primary))]" },
                  { label: "Active", value: stats?.overview.active ?? 0, color: "text-green-600" },
                  { label: "Completed", value: stats?.overview.completed ?? 0, color: "text-blue-600" },
                  { label: "Paused", value: stats?.overview.paused ?? 0, color: "text-gray-500" },
                  { label: "Emails", value: stats?.overview.emails ?? 0, color: "text-blue-600" },
                  { label: "Opens", value: stats?.overview.opens ?? 0, color: "text-green-600" },
                  { label: "Clicks", value: stats?.overview.clicks ?? 0, color: "text-amber-600" },
                  { label: "Replies", value: stats?.overview.replies ?? 0, color: "text-purple-600" },
                  { label: "Bounced", value: stats?.overview.bounced ?? 0, color: "text-red-600" },
                ].map((s) => (
                  <Card key={s.label} data-testid={`overview-stat-${s.label.toLowerCase()}`} className="p-3 text-center">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                  </Card>
                ))}
              </div>

              {/* Sub-tabs */}
              <div className="flex gap-1 mb-4 border-b">
                {([["overview", "Steps"], ["contacts", `Contacts (${enrollments.length})`]] as const).map(([key, lbl]) => (
                  <button
                    key={key}
                    data-testid={`builder-tab-${key}`}
                    onClick={() => setBuilderView(key)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${builderView === key ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {builderView === "overview" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Steps ({campaignDetail.steps?.length || 0})</h4>
                    <Button data-testid="button-add-step" size="sm" className="gap-1" onClick={() => setShowAddStep(true)}>
                      <Plus className="size-3" /> Add Step
                    </Button>
                  </div>

                  {(!campaignDetail.steps || campaignDetail.steps.length === 0) ? (
                    <Card className="p-8 text-center">
                      <Zap className="mx-auto size-8 text-muted-foreground/30" />
                      <p className="mt-2 text-sm text-muted-foreground">No steps yet. Add an email, text or task to start the sequence.</p>
                    </Card>
                  ) : (
                    <div className="space-y-5">
                      {/* Send-timing explainer + per-step projected times */}
                      {schedule?.windowSummary && (
                        <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          <Clock className="size-3.5 shrink-0 mt-0.5 text-primary" />
                          <span>
                            {schedule.windowSummary}
                            {hasActiveEnrollment
                              ? " Projected send times for the current contact(s) are shown on each day below."
                              : " Enroll a contact to see projected send times."}
                          </span>
                        </div>
                      )}
                      {dayGroups.map((group) => {
                        // All steps in a day share the same delay, so the same projected time.
                        const groupSendAt = group.steps
                          .map((s) => sendAtByStepOrder.get(s.stepOrder))
                          .filter((x): x is string => !!x)
                          .sort()[0];
                        return (
                        <div key={group.day}>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                              Day {group.day}
                            </span>
                            {groupSendAt && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary" data-testid={`step-sendat-day-${group.day}`}>
                                <Clock className="size-3" /> Sends {formatSendTime(groupSendAt)}
                              </span>
                            )}
                          </div>
                          <div className="space-y-2">
                            {group.steps.map((step) => {
                              const meta = stepMeta(step.stepType);
                              const Icon = meta.icon;
                              const st = stats?.perStep?.[step.id];
                              const channel = CHANNEL_OF[step.stepType || "email"] || "email";
                              return (
                                <Card key={step.id} data-testid={`step-${step.id}`} className="p-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"><Icon className="size-4" /></span>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm">{step.stepName || meta.label}</span>
                                          {step.priority && step.priority !== "None" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{step.priority}</span>}
                                        </div>
                                        {channel !== "task" && step.subject && <div className="text-xs text-muted-foreground truncate">{step.subject}</div>}
                                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                                          {(step.bodyHtml || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || meta.desc}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Button size="sm" variant="ghost" onClick={() => setViewingStep(viewingStep?.id === step.id ? null : step)}><Eye className="size-3" /></Button>
                                      <Button size="sm" variant="ghost" onClick={() => { setEditingStep(step); setAddStepType(step.stepType || "email"); setShowStepEditor(true); }}><Edit2 className="size-3" /></Button>
                                      <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => { if (confirm("Delete this step?")) deleteStepMutation.mutate(step.id); }}><Trash2 className="size-3" /></Button>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t pt-2 text-[11px] text-muted-foreground">
                                    {channel === "task" ? (
                                      <span><span className="font-semibold text-foreground">{st?.tasks ?? 0}</span> Created</span>
                                    ) : (
                                      <>
                                        <span><span className="font-semibold text-foreground">{st?.sent ?? 0}</span> Sent</span>
                                        {channel === "email" && <span><span className="font-semibold text-foreground">{st?.opened ?? 0}</span> Opened</span>}
                                        {channel === "email" && <span><span className="font-semibold text-foreground">{st?.clicked ?? 0}</span> Clicked</span>}
                                        <span><span className="font-semibold text-foreground">{st?.bounced ?? 0}</span> {channel === "sms" ? "Failed" : "Bounced"}</span>
                                      </>
                                    )}
                                    <span><span className="font-semibold text-foreground">{st?.notSent ?? 0}</span> Not Sent</span>
                                  </div>
                                  {viewingStep?.id === step.id && (
                                    <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm">
                                      {step.subject && <div className="mb-1 font-medium">Subject: {previewMerge(step.subject)}</div>}
                                      <div dangerouslySetInnerHTML={{ __html: previewMerge(step.bodyHtml) }} />
                                    </div>
                                  )}
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {builderView === "contacts" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">Enrolled Contacts ({enrollments.length})</h4>
                    <div className="flex gap-2">
                      <Button data-testid="button-enroll-from-list" size="sm" variant="outline" className="gap-1" onClick={() => { setShowEnrollListModal(true); setEnrollListId(""); }} disabled={prospectLists.length === 0}>
                        <Users className="size-3" /> From List
                      </Button>
                      <Button data-testid="button-enroll-prospects" size="sm" variant="outline" className="gap-1" onClick={() => { setShowEnrollModal(true); setSelectedProspects(new Set()); }} disabled={enrollableProspects.length === 0}>
                        <UserPlus className="size-3" /> From Prospects
                      </Button>
                      <Button data-testid="button-enroll-from-contacts" size="sm" className="gap-1" onClick={() => { setShowEnrollContacts(true); setSelectedContacts(new Set()); setContactSearch(""); }}>
                        <UserPlus className="size-3" /> Add from Contacts
                      </Button>
                    </div>
                  </div>
                  {enrollments.length === 0 ? (
                    <Card className="p-6 text-center">
                      <Users className="mx-auto size-8 text-muted-foreground/30" />
                      <p className="mt-2 text-sm text-muted-foreground">No contacts enrolled yet.</p>
                      {prospectLists.length === 0 && <p className="text-xs text-muted-foreground mt-1">Save prospects into a list in the People Finder first.</p>}
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {/* Send-window explainer so the projected times make sense */}
                      {schedule?.windowSummary && (
                        <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          <Clock className="size-3.5 shrink-0 mt-0.5 text-primary" />
                          <span>{schedule.windowSummary}</span>
                        </div>
                      )}
                      {enrollments.map((e) => {
                        const sched = scheduleByEnrollment.get(e.id);
                        const expanded = openSchedule.has(e.id);
                        const upcoming = sched?.upcoming ?? [];
                        return (
                        <Card key={e.id} data-testid={`enrollment-${e.id}`} className="p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{e.prospectName}</div>
                              <div className="text-xs text-muted-foreground">
                                {e.prospectEmail} &middot; Step {e.currentStep}/{campaignDetail.steps?.length || 0} &middot;{" "}
                                <span className={e.status === "active" ? "text-green-600" : e.status === "completed" ? "text-blue-600" : "text-gray-500"}>{e.status}</span>
                              </div>
                              {/* Next scheduled send */}
                              {e.status === "active" && (
                                <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground" data-testid={`next-send-${e.id}`}>
                                  <Clock className="size-3.5 text-primary" />
                                  {sched?.nextSendAt ? (
                                    <span>
                                      Next: <span className="text-primary">{formatSendTime(sched.nextSendAt)}</span>
                                      {sched.nextStepName ? <span className="text-muted-foreground font-normal"> · {sched.nextStepName}</span> : null}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground font-normal">No further steps scheduled</span>
                                  )}
                                </div>
                              )}
                              {e.status === "completed" && (
                                <div className="mt-1 text-xs text-blue-600">All steps sent — sequence complete</div>
                              )}
                              {e.status === "paused" && (
                                <div className="mt-1 text-xs text-amber-600">Paused — sending stopped. Resume to reschedule.</div>
                              )}
                              {/* Full upcoming schedule (collapsible) */}
                              {upcoming.length > 0 && (
                                <button
                                  type="button"
                                  data-testid={`toggle-schedule-${e.id}`}
                                  onClick={() => setOpenSchedule((prev) => {
                                    const next = new Set(prev);
                                    next.has(e.id) ? next.delete(e.id) : next.add(e.id);
                                    return next;
                                  })}
                                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                  <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                                  {expanded ? "Hide" : "View"} full schedule ({upcoming.length} step{upcoming.length === 1 ? "" : "s"})
                                </button>
                              )}
                              {expanded && upcoming.length > 0 && (
                                <ol className="mt-1.5 space-y-1 border-l border-border/70 pl-3">
                                  {upcoming.map((s) => (
                                    <li key={s.stepOrder} className="text-[11px] text-muted-foreground">
                                      <span className="font-medium text-foreground">Step {s.stepNumber}</span>
                                      <span className="ml-1 capitalize">({s.stepType})</span>
                                      {s.name ? <span> · {s.name}</span> : null}
                                      <span className="ml-1">
                                        → {e.status === "active" ? formatSendTime(s.sendAt) : `day ${s.delayDays} after enrollment`}
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                            <div className="shrink-0">
                              {e.status === "active" && <Button size="sm" variant="outline" onClick={() => pauseEnrollmentMutation.mutate({ id: e.id, status: "paused" })}>Pause</Button>}
                              {e.status === "paused" && <Button size="sm" variant="outline" onClick={() => pauseEnrollmentMutation.mutate({ id: e.id, status: "active" })}>Resume</Button>}
                            </div>
                          </div>
                        </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {showAddStep && (
                <AddStepModal
                  onPick={(type) => { setShowAddStep(false); setAddStepType(type); setEditingStep(null); setShowStepEditor(true); }}
                  onClose={() => setShowAddStep(false)}
                />
              )}

              {showStepEditor && (
                <StepEditorModal
                  step={editingStep}
                  defaultType={addStepType}
                  nextOrder={(campaignDetail.steps?.length || 0) + 1}
                  onSave={(data) => saveStepMutation.mutate(data)}
                  onCancel={() => { setShowStepEditor(false); setEditingStep(null); }}
                  isPending={saveStepMutation.isPending}
                />
              )}
            </div>
          ) : (
            <Card className="p-8 text-center"><Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" /></Card>
          )}

          {/* Confirm before sending — shows exactly which campaign + how many contacts */}
          {showSendConfirm && campaignDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSendConfirm(false)}>
              <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <div className="mb-3 flex items-center gap-2">
                  <Send className="size-5 text-[hsl(var(--primary))]" />
                  <h3 className="text-lg font-semibold">Send due emails now?</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  This sends real emails immediately for{" "}
                  <span className="font-semibold text-foreground">{campaignDetail.name}</span> only —
                  no other campaign is affected.
                </p>
                <div className="mt-3 rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Active contacts in this campaign</span>
                    <span className="font-semibold" data-testid="send-confirm-count">
                      {enrollments.filter((e) => e.status === "active").length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only contacts with a step currently due will be emailed; the rest stay on schedule.
                  </p>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowSendConfirm(false)} data-testid="send-confirm-cancel">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1"
                    disabled={processMutation.isPending}
                    onClick={() => { setShowSendConfirm(false); processMutation.mutate(); }}
                    data-testid="send-confirm-go"
                  >
                    <Send className="size-4" /> Send now
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {editCampaign && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditCampaign(null)}>
              <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Edit campaign</h3>
                  <Button size="sm" variant="ghost" onClick={() => setEditCampaign(null)}><X className="size-4" /></Button>
                </div>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editCampaign.name.trim()) return;
                    updateCampaignMetaMutation.mutate(editCampaign);
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-campaign-name">Campaign name</Label>
                    <Input
                      id="edit-campaign-name"
                      data-testid="input-edit-campaign-name"
                      value={editCampaign.name}
                      onChange={(e) => setEditCampaign({ ...editCampaign, name: e.target.value })}
                      placeholder="e.g. Broker Introduction Sequence"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-campaign-desc">Description</Label>
                    <Textarea
                      id="edit-campaign-desc"
                      data-testid="input-edit-campaign-desc"
                      value={editCampaign.description}
                      onChange={(e) => setEditCampaign({ ...editCampaign, description: e.target.value })}
                      placeholder="What this sequence is for (optional)"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditCampaign(null)}>Cancel</Button>
                    <Button type="submit" size="sm" data-testid="button-save-campaign" disabled={!editCampaign.name.trim() || updateCampaignMetaMutation.isPending}>
                      {updateCampaignMetaMutation.isPending ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                      Save
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {showEnrollContacts && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowEnrollContacts(false)}>
              <Card className="w-full max-w-lg max-h-[85vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">Add from Contacts</h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowEnrollContacts(false)}><X className="size-4" /></Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Pick contacts from your CRM to enroll in this campaign. They're added to the sequence directly — no separate prospect step needed. Contacts without an email are skipped.
                </p>
                <div className="relative mb-3">
                  <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <Input data-testid="input-contact-search" placeholder="Search by name, email, or firm…" value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} className="pl-9" />
                </div>
                {(() => {
                  const q = contactSearch.trim().toLowerCase();
                  const enrolledEmails = new Set(enrollments.map((e) => (e.prospectEmail || "").toLowerCase()));
                  const filtered = contactsForEnroll.filter((c) => {
                    const full = `${c.firstName} ${c.lastName}`.toLowerCase();
                    return !q || full.includes(q) || (c.email || "").toLowerCase().includes(q) || (c.firmName || "").toLowerCase().includes(q);
                  });
                  const selectableIds = filtered.filter((c) => c.email).map((c) => c.id);
                  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedContacts.has(id));
                  return (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">{filtered.length} contact{filtered.length === 1 ? "" : "s"}</span>
                        <button
                          className="text-xs text-[hsl(var(--primary))] hover:underline"
                          onClick={() => {
                            const next = new Set(selectedContacts);
                            if (allSelected) selectableIds.forEach((id) => next.delete(id));
                            else selectableIds.forEach((id) => next.add(id));
                            setSelectedContacts(next);
                          }}
                        >
                          {allSelected ? "Clear all" : "Select all"}
                        </button>
                      </div>
                      <div className="space-y-1 max-h-72 overflow-y-auto">
                        {filtered.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">No contacts match.</p>
                        ) : filtered.map((c) => {
                          const noEmail = !c.email;
                          const already = c.email ? enrolledEmails.has(c.email.toLowerCase()) : false;
                          const checked = selectedContacts.has(c.id);
                          return (
                            <div
                              key={c.id}
                              data-testid={`enroll-contact-${c.id}`}
                              className={`flex items-center gap-3 p-2 rounded ${noEmail || already ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"} ${checked ? "bg-[hsl(var(--primary))]/5" : ""}`}
                              onClick={() => { if (noEmail || already) return; const next = new Set(selectedContacts); checked ? next.delete(c.id) : next.add(c.id); setSelectedContacts(next); }}
                            >
                              <div className={`flex size-5 items-center justify-center rounded border ${checked ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white" : "border-gray-300"}`}>
                                {checked && <Check className="size-3" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                                  <span className="truncate">{c.firstName} {c.lastName}</span>
                                  {c.firmName ? <span className="text-muted-foreground font-normal truncate"> · {c.firmName}</span> : null}
                                  {c.source && (
                                    <span className="shrink-0 rounded-sm border px-1 text-[9px] font-semibold leading-4 text-muted-foreground">
                                      {c.source}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{c.email || "no email"}{already ? " · already enrolled" : ""}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          data-testid="button-confirm-enroll-contacts"
                          onClick={() => enrollContactsMutation.mutate()}
                          disabled={selectedContacts.size === 0 || enrollContactsMutation.isPending}
                        >
                          {enrollContactsMutation.isPending ? <><Loader2 className="size-4 mr-1 animate-spin" /> Enrolling…</> : `Enroll ${selectedContacts.size} contact${selectedContacts.size === 1 ? "" : "s"}`}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </Card>
            </div>
          )}

          {showEnrollModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <Card className="w-full max-w-lg max-h-[80vh] overflow-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Enroll Prospects</h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowEnrollModal(false)}>
                    <X className="size-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Select prospects with email addresses to enroll in this campaign. Only prospects not already enrolled are shown.
                </p>
                {enrollableProspects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No eligible prospects. Make sure saved prospects have email addresses.</p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {enrollableProspects.map((p) => (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 p-2 rounded cursor-pointer ${selectedProspects.has(p.id) ? "bg-[hsl(var(--primary))]/5" : "hover:bg-gray-50"}`}
                          onClick={() => toggleProspect(p.id)}
                        >
                          <div className={`flex size-5 items-center justify-center rounded border ${selectedProspects.has(p.id) ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white" : "border-gray-300"}`}>
                            {selectedProspects.has(p.id) && <Check className="size-3" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        data-testid="button-confirm-enroll"
                        onClick={() => enrollMutation.mutate()}
                        disabled={selectedProspects.size === 0 || enrollMutation.isPending}
                      >
                        {enrollMutation.isPending ? "Enrolling..." : `Enroll ${selectedProspects.size} prospects`}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}

          {showEnrollListModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <Card className="w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Enroll from Saved List</h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowEnrollListModal(false)}>
                    <X className="size-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose a saved prospect list. All members with email addresses will be enrolled.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                  {prospectLists.map(list => (
                    <div
                      key={list.id}
                      className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-colors ${enrollListId === list.id ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5" : "hover:border-gray-300"}`}
                      onClick={() => setEnrollListId(list.id)}
                    >
                      <div>
                        <div className="text-sm font-medium">{list.name}</div>
                        <div className="text-xs text-muted-foreground">{list.count} prospect{list.count !== 1 ? "s" : ""}</div>
                      </div>
                      {enrollListId === list.id && <Check className="size-4 text-[hsl(var(--primary))]" />}
                    </div>
                  ))}
                </div>
                {enrollListId && (
                  <div className="mb-3">
                    {listMembersFetching ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" /> Loading members…
                      </p>
                    ) : listMembers.length === 0 ? (
                      <p className="text-xs text-amber-600">This list has no members yet.</p>
                    ) : listMembers.filter(m => m.email).length === 0 ? (
                      <p className="text-xs text-amber-600">None of the {listMembers.length} members have email addresses.</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        <span className="text-green-700 font-medium">{listMembers.filter(m => m.email).length}</span> of {listMembers.length} members have email addresses and will be enrolled.
                        {listMembers.length - listMembers.filter(m => m.email).length > 0 && (
                          <span className="text-amber-600"> ({listMembers.length - listMembers.filter(m => m.email).length} skipped — no email)</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowEnrollListModal(false)}>Cancel</Button>
                  <Button
                    onClick={() => enrollFromListMutation.mutate()}
                    disabled={!enrollListId || enrollFromListMutation.isPending || listMembersFetching || listMembers.filter(m => m.email).length === 0}
                  >
                    {enrollFromListMutation.isPending ? <><Loader2 className="size-3 mr-1 animate-spin" /> Enrolling…</> : "Enroll List"}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {activeTab === "sends" && (
        <>
          <div className="mb-1">
            <h3 className="text-lg font-semibold">Activity</h3>
            <p className="text-xs text-muted-foreground">Every outreach touch across all channels — campaign sends, manual emails &amp; texts, calls, LinkedIn and inbound replies.</p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 my-4">
            {[
              { label: "All Activity", value: activityStats.total, color: "text-[hsl(var(--primary))]" },
              { label: "Email", value: activityStats.email, color: "text-blue-600" },
              { label: "Text", value: activityStats.sms, color: "text-emerald-600" },
              { label: "LinkedIn", value: activityStats.linkedin, color: "text-sky-600" },
              { label: "Calls", value: activityStats.call, color: "text-amber-600" },
              { label: "Opened", value: activityStats.opened, color: "text-green-600" },
            ].map((s) => (
              <Card key={s.label} className="p-3 text-center">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </Card>
            ))}
          </div>

          {/* Channel filter chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CHANNEL_FILTERS.map(({ key, label, icon: Icon }) => {
              const active = filterChannel === key;
              return (
                <button
                  key={key}
                  data-testid={`activity-channel-${key}`}
                  onClick={() => setFilterChannel(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white" : "border-input text-muted-foreground hover:text-foreground"}`}
                >
                  <Icon className="size-3" /> {label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
            <div className="relative flex-1 max-w-sm">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                data-testid="input-filter-sends"
                placeholder="Filter by name, email, detail..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <select
                data-testid="select-filter-send-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring appearance-none pr-8"
              >
                <option value="all">All statuses</option>
                <option value="sent">Sent</option>
                <option value="opened">Opened</option>
                <option value="received">Received</option>
                <option value="failed">Failed</option>
                <option value="task">Task</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5 size-4 text-muted-foreground" />
            </div>
          </div>

          {filteredActivity.length === 0 ? (
            <Card className="p-8 text-center">
              <Clock className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                {activity.length === 0 ? "No activity logged yet. Enroll prospects in a campaign or send a message to start the timeline." : "No activity matches your filter."}
              </p>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 px-3 font-medium">Channel</th>
                    <th className="text-left py-2 px-3 font-medium">Contact</th>
                    <th className="text-left py-2 px-3 font-medium">To / From</th>
                    <th className="text-left py-2 px-3 font-medium">Detail</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.map((item) => {
                    const meta = channelMeta(item.channel);
                    const Icon = meta.icon;
                    return (
                      <tr key={item.id} data-testid={`activity-row-${item.id}`} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.bg}`}>
                            <Icon className="size-3" /> {meta.label}
                            {item.direction === "inbound" && <ArrowLeft className="size-3" />}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium">{item.name || "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground max-w-44 truncate">{item.target || "—"}</td>
                        <td className="py-2 px-3 max-w-72 truncate" title={item.detail}>{item.detail || "—"}</td>
                        <td className="py-2 px-3"><ActivityStatusBadge item={item} /></td>
                        <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                          {item.timestamp ? new Date(item.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UserPlus(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}

// ─── "Add a Step" type picker (Seamless-style) ───────────────────────────────

function AddStepModal({ onPick, onClose }: { onPick: (type: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <Card className="w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Add a Step</h3>
          <Button size="sm" variant="ghost" onClick={onClose}><X className="size-4" /></Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Choose the type of step to add to the sequence.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {STEP_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.type}
                data-testid={`add-step-${t.type}`}
                onClick={() => onPick(t.type)}
                className="flex items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5"
              >
                <span className="inline-flex size-9 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"><Icon className="size-4" /></span>
                <div>
                  <div className="text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Step editor modal (Step Name · Day Due · Priority · body + live preview) ─

function StepEditorModal({
  step,
  defaultType,
  nextOrder,
  onSave,
  onCancel,
  isPending,
}: {
  step: Step | null;
  defaultType: string;
  nextOrder: number;
  onSave: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const initialType = step?.stepType || defaultType || "email";
  const [form, setForm] = useState({
    stepOrder: step?.stepOrder || nextOrder,
    delayDays: step?.delayDays ?? 0,
    stepType: initialType,
    stepName: step?.stepName || stepMeta(initialType).label,
    priority: step?.priority || "None",
    subject: step?.subject || "",
    bodyHtml: step?.bodyHtml || "",
  });
  const [mode, setMode] = useState<"template" | "ai">("template");

  const channel = CHANNEL_OF[form.stepType] || "task";
  const isEmail = channel === "email";
  const isSms = channel === "sms";
  const isTask = channel === "task";
  const HeaderIcon = stepMeta(form.stepType).icon;

  const canSave = isTask
    ? !!form.stepName.trim()
    : !!form.bodyHtml.trim() && (!isEmail || !!form.subject.trim());

  const bodyLabel = isEmail ? "Email body" : isSms ? "Text message" : "Task details";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <Card className="w-full max-w-3xl max-h-[88vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"><HeaderIcon className="size-4" /></span>
            <h3 className="text-lg font-semibold">{step ? "Edit Step" : stepMeta(form.stepType).label}</h3>
          </div>
          <Button size="sm" variant="ghost" onClick={onCancel}><X className="size-4" /></Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label>Step name</Label>
            <Input data-testid="step-name" value={form.stepName} onChange={(e) => setForm({ ...form, stepName: e.target.value })} placeholder={stepMeta(form.stepType).label} />
          </div>
          <div>
            <Label>Day step is due</Label>
            <Input data-testid="step-day" type="number" min={0} value={form.delayDays} onChange={(e) => setForm({ ...form, delayDays: parseInt(e.target.value) || 0 })} />
          </div>
          <div>
            <Label>Priority</Label>
            <select
              data-testid="step-priority"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {(isEmail || isSms) && (
          <>
            <div className="mt-4 inline-flex rounded-md border p-0.5">
              <button type="button" onClick={() => setMode("template")} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${mode === "template" ? "bg-[hsl(var(--primary))] text-white" : "text-muted-foreground"}`}>Template</button>
              <button type="button" onClick={() => setMode("ai")} className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition-colors ${mode === "ai" ? "bg-[hsl(var(--primary))] text-white" : "text-muted-foreground"}`}><Sparkles className="size-3" /> AI Prompt</button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                {isEmail && (
                  <div className="mb-3">
                    <Label>Subject</Label>
                    <Input data-testid="step-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. The U.S. business piece for your clients" />
                  </div>
                )}
                <Label>{mode === "ai" ? "AI prompt" : bodyLabel}</Label>
                <p className="text-xs text-muted-foreground mb-1">Use <code className="bg-gray-100 px-1 rounded">[Contact First Name]</code> to personalize.</p>
                <textarea
                  data-testid="step-body"
                  value={form.bodyHtml}
                  onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
                  rows={isSms ? 5 : 12}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                  placeholder={mode === "ai" ? "Describe the message you want the AI to draft…" : isSms ? "Hi [Contact First Name], …" : "Hi [Contact First Name],\n\n…"}
                />
                {isSms && <p className={`mt-0.5 text-xs text-right ${form.bodyHtml.length > 160 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>{form.bodyHtml.length}/160</p>}
              </div>

              <div>
                <Label>Preview</Label>
                <div className="mt-1 rounded-md border bg-gray-50 p-3 text-sm min-h-[120px]">
                  {isEmail && form.subject && <div className="mb-2 font-medium">Subject: {previewMerge(form.subject)}</div>}
                  {isEmail ? (
                    <div dangerouslySetInnerHTML={{ __html: previewMerge(form.bodyHtml) || '<span style="color:#9ca3af">Nothing to preview yet.</span>' }} />
                  ) : (
                    <div className="whitespace-pre-wrap">{previewMerge(form.bodyHtml) || <span className="text-muted-foreground">Nothing to preview yet.</span>}</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {isTask && (
          <div className="mt-4">
            <Label>Task details</Label>
            <p className="text-xs text-muted-foreground mb-1">This becomes a to-do in the Tasks tab on its due day. The step name is the task title — use <code className="bg-gray-100 px-1 rounded">[Contact First Name]</code> to personalize.</p>
            <textarea
              data-testid="step-body"
              value={form.bodyHtml}
              onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
              placeholder="e.g. Call [Contact First Name] to discuss the FDD and answer questions"
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            data-testid="step-save"
            onClick={() => onSave({
              stepOrder: form.stepOrder,
              delayDays: form.delayDays,
              stepType: form.stepType,
              stepName: form.stepName.trim() || stepMeta(form.stepType).label,
              priority: form.priority,
              subject: form.subject,
              bodyHtml: form.bodyHtml,
            })}
            disabled={isPending || !canSave}
          >
            {isPending ? "Saving…" : step ? "Update Step" : "Save Step"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─── SMS Blast Campaign Tab ──────────────────────────────────────────────────

interface SendEstimate {
  windowStatus: "open" | "closed";
  windowDescription: string;
  estimatedMinutes: number;
  recommendation: string;
}

function BlastCampaignTab({ channel }: { channel: "sms" | "whatsapp" }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", message: "", listId: "" });
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Per-campaign send mode: "smart" (default) or "now"
  const [sendModeMap, setSendModeMap] = useState<Record<string, "smart" | "now">>({});
  // Expanded estimate panel per campaign
  const [showEstimateId, setShowEstimateId] = useState<string | null>(null);
  const [estimateMap, setEstimateMap] = useState<Record<string, SendEstimate | null>>({});

  const apiBase = channel === "sms" ? "/api/crm/sms-campaigns" : "/api/crm/wa-campaigns";
  const queryKey = [apiBase];
  const label = channel === "sms" ? "SMS" : "WhatsApp";
  const Icon = channel === "sms" ? Smartphone : MessageSquare;
  // Auto-refresh every 5s if any campaign is "sending"
  const { data: campaigns = [] } = useQuery<SmsCampaignData[]>({
    queryKey,
    refetchInterval: (query) => {
      const data = query.state.data as SmsCampaignData[] | undefined;
      return data?.some(c => c.status === "sending") ? 5000 : false;
    },
  });
  const { data: prospectLists = [] } = useQuery<ProspectList[]>({ queryKey: ["/api/crm/prospect-lists"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Campaign name is required");
      if (!form.listId) throw new Error("Please select a prospect list");
      if (!form.message.trim()) throw new Error("Message is required");
      const res = await apiRequest("POST", apiBase, { name: form.name.trim(), message: form.message.trim(), listId: form.listId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setShowCreate(false);
      setForm({ name: "", message: "", listId: "" });
      toast({ title: `${label} campaign created` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: "smart" | "now" }) => {
      setSendingId(id);
      const res = await apiRequest("POST", `${apiBase}/${id}/send`, { mode });
      return res.json();
    },
    onSuccess: (data: any, { id }) => {
      queryClient.invalidateQueries({ queryKey });
      setSendingId(null);
      if (data?.queued) {
        toast({
          title: "Smart Send queued",
          description: data.message,
        });
      } else {
        toast({
          title: `${label} campaign launched`,
          description: "Messages are being delivered with smart pacing.",
        });
      }
    },
    onError: (err: Error) => {
      setSendingId(null);
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  async function fetchEstimate(campaignId: string) {
    try {
      const res = await fetch(`${apiBase}/${campaignId}/estimate`, { credentials: "include" });
      const data = await res.json();
      setEstimateMap(prev => ({ ...prev, [campaignId]: data }));
    } catch {
      setEstimateMap(prev => ({ ...prev, [campaignId]: null }));
    }
  }

  const duplicateMutation = useMutation({
    mutationFn: async (c: SmsCampaignData) => {
      const res = await apiRequest("POST", apiBase, {
        name: `Copy of ${c.name}`,
        message: c.message,
        listId: c.listId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: "Campaign duplicated as draft" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id);
      await apiRequest("DELETE", `${apiBase}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDeletingId(null);
      toast({ title: `${label} campaign deleted` });
    },
    onError: (err: Error) => {
      setDeletingId(null);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const statusColor = (s: string) => {
    if (s === "sent") return "bg-green-100 text-green-700";
    if (s === "sending") return "bg-yellow-100 text-yellow-700";
    return "bg-gray-100 text-gray-600";
  };

  const statusLabel = (s: string) => {
    if (s === "sent") return "Sent";
    if (s === "sending") return "Sending…";
    return "Draft";
  };

  const charWarning = channel === "sms" && form.message.length > 160
    ? "Over 160 chars — will be split into multiple SMS segments"
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{label} Campaigns</h3>
          <p className="text-xs text-muted-foreground">Send a one-time blast to everyone in a saved prospect list.</p>
        </div>
        <Button data-testid={`button-new-${channel}-campaign`} size="sm" className="gap-1" onClick={() => { setShowCreate(true); setForm({ name: "", message: "", listId: "" }); }}>
          <Plus className="size-3" /> New Campaign
        </Button>
      </div>

      {showCreate && (
        <Card className="p-4 mb-4 border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]/30">
          <h4 className="font-semibold mb-3">Create {label} Campaign</h4>
          <div className="space-y-3">
            <div>
              <Label>Campaign name</Label>
              <Input
                data-testid={`input-${channel}-name`}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={`e.g. April ${label} Blast`}
                autoFocus
              />
            </div>
            <div>
              <Label>Prospect list</Label>
              {prospectLists.length === 0 ? (
                <p className="text-sm text-amber-600 mt-1">No saved lists yet — go to the People Finder to save prospects into a list first.</p>
              ) : (
                <select
                  data-testid={`select-${channel}-list`}
                  value={form.listId}
                  onChange={e => setForm({ ...form, listId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Select a list —</option>
                  {prospectLists.map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.count} prospect{l.count !== 1 ? "s" : ""})</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <Label>Message</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Use <code className="bg-gray-100 px-1 rounded">{"{{name}}"}</code> to personalise with the recipient's first name.
              </p>
              <textarea
                data-testid={`input-${channel}-message`}
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                rows={5}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                placeholder={channel === "sms"
                  ? `Hi {{name}}, this is Dylan from New Dawn Franchising…`
                  : `Hi {{name}}, I wanted to reach out about…`}
              />
              <div className="flex items-center justify-between mt-0.5">
                {charWarning ? (
                  <p className="text-xs text-amber-600">{charWarning}</p>
                ) : <span />}
                <p className={`text-xs ${channel === "sms" && form.message.length > 160 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                  {form.message.length}{channel === "sms" ? "/160" : ""}
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.name.trim() || !form.message.trim() || !form.listId}
            >
              {createMutation.isPending ? <><Loader2 className="size-3 mr-1 animate-spin" /> Creating…</> : "Create Campaign"}
            </Button>
          </div>
        </Card>
      )}

      {campaigns.length === 0 && !showCreate ? (
        <Card className="p-10 text-center">
          <Icon className="mx-auto size-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No {label} campaigns yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            {prospectLists.length === 0
              ? "Save prospects into a list in the People Finder first, then come back here."
              : `Create a campaign, write your message, and blast it to any saved prospect list.`}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const list = prospectLists.find(l => l.id === c.listId);
            const isSending = sendingId === c.id || c.status === "sending";
            const isDeleting = deletingId === c.id;
            const currentMode = sendModeMap[c.id] ?? "smart";
            const estimate = estimateMap[c.id];
            const showEst = showEstimateId === c.id;

            return (
              <Card key={c.id} data-testid={`${channel}-campaign-${c.id}`} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{c.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(c.status)}`}>
                        {c.status === "sending" && <Loader2 className="size-3 mr-1 animate-spin" />}
                        {statusLabel(c.status)}
                      </span>
                    </div>

                    {list ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        List: <span className="font-medium">{list.name}</span> &middot; {list.count} prospect{list.count !== 1 ? "s" : ""}
                      </p>
                    ) : c.listId ? (
                      <p className="text-xs text-muted-foreground mt-0.5">List (deleted)</p>
                    ) : null}

                    {c.status === "sent" && c.sentAt && (
                      <p className="text-xs mt-0.5">
                        <span className="text-green-600 font-medium">{c.sentCount} delivered</span>
                        {c.failCount > 0 && <span className="text-red-500 ml-1">· {c.failCount} failed</span>}
                        <span className="text-muted-foreground ml-1">· {new Date(c.sentAt).toLocaleDateString()}</span>
                      </p>
                    )}

                    {c.status === "sending" && (
                      <p className="text-xs text-amber-600 mt-0.5">Sending in progress — this page will auto-refresh.</p>
                    )}

                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 italic">"{c.message}"</p>

                    {/* Smart Send mode selector + estimate (only on draft campaigns) */}
                    {c.status === "draft" && (
                      <div className="mt-2">
                        <div className="flex items-center gap-1">
                          <button
                            data-testid={`button-smart-mode-${c.id}`}
                            onClick={() => {
                              setSendModeMap(prev => ({ ...prev, [c.id]: "smart" }));
                              const next = showEstimateId === c.id ? null : c.id;
                              setShowEstimateId(next);
                              if (next) fetchEstimate(c.id);
                            }}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border transition-colors ${
                              currentMode === "smart"
                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                            }`}
                          >
                            <Clock className="size-2.5" />
                            Smart Send
                          </button>
                          <button
                            data-testid={`button-now-mode-${c.id}`}
                            onClick={() => setSendModeMap(prev => ({ ...prev, [c.id]: "now" }))}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border transition-colors ${
                              currentMode === "now"
                                ? "bg-amber-50 border-amber-300 text-amber-700"
                                : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-amber-50 hover:text-amber-600"
                            }`}
                          >
                            <Zap className="size-2.5" />
                            Send Now
                          </button>
                        </div>

                        {/* Estimate panel */}
                        {showEst && (
                          <div className={`mt-1.5 rounded-md px-2.5 py-2 text-xs border ${
                            estimate?.windowStatus === "open"
                              ? "bg-green-50 border-green-200 text-green-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          }`}>
                            {estimate ? (
                              <>
                                <span className={`font-medium mr-1 ${estimate.windowStatus === "open" ? "text-green-700" : "text-amber-700"}`}>
                                  {estimate.windowStatus === "open" ? "✓ Window open" : "⏱ Window closed"}
                                </span>
                                {estimate.recommendation}
                              </>
                            ) : (
                              <span className="text-muted-foreground">Loading estimate…</span>
                            )}
                          </div>
                        )}

                        {currentMode === "now" && (
                          <p className="text-xs text-amber-600 mt-1">
                            Send Now ignores the optimal window — use for urgent campaigns only.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0 flex-col sm:flex-row">
                    {c.status === "draft" && (
                      <Button
                        data-testid={`button-send-${channel}-${c.id}`}
                        size="sm"
                        className={`gap-1 ${currentMode === "now" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}
                        onClick={() => sendMutation.mutate({ id: c.id, mode: currentMode })}
                        disabled={isSending}
                      >
                        {isSending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : currentMode === "now" ? (
                          <Zap className="size-3" />
                        ) : (
                          <Clock className="size-3" />
                        )}
                        {isSending ? "Launching…" : currentMode === "now" ? "Send Now" : "Smart Send"}
                      </Button>
                    )}
                    <Button
                      data-testid={`button-duplicate-${channel}-${c.id}`}
                      size="sm"
                      variant="outline"
                      title="Duplicate as new draft"
                      onClick={() => duplicateMutation.mutate(c)}
                      disabled={duplicateMutation.isPending}
                    >
                      <Play className="size-3" />
                    </Button>
                    <Button
                      data-testid={`button-delete-${channel}-${c.id}`}
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => deleteMutation.mutate(c.id)}
                      disabled={c.status === "sending" || isDeleting}
                    >
                      {isDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Campaigns Hub (outer sub-tab switcher) ──────────────────────────────────

export default function CampaignsHub() {
  const [tab, setTab] = useState<"email" | "sms" | "whatsapp">("email");

  const tabs = [
    { key: "email" as const, label: "Email", Icon: Mail },
    { key: "sms" as const, label: "SMS", Icon: Smartphone },
    { key: "whatsapp" as const, label: "WhatsApp", Icon: MessageSquare },
  ];

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b overflow-x-auto scrollbar-none">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            data-testid={`campaigns-tab-${key}`}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "email" && <EmailCampaignTab />}
      {tab === "sms" && <BlastCampaignTab channel="sms" />}
      {tab === "whatsapp" && <BlastCampaignTab channel="whatsapp" />}
    </div>
  );
}
