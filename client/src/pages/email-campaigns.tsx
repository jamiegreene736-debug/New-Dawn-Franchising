import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Clock,
  Edit2,
  ExternalLink,
  Loader2,
  Mail,
  MailOpen,
  MailX,
  MessageSquare,
  Play,
  Plus,
  Send,
  Smartphone,
  Trash2,
  Users,
  Eye,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface EmailSend {
  id: string;
  enrollmentId: string;
  stepId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  openCount: number;
  errorMessage: string | null;
  createdAt: string;
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

type SortKey = "recipientName" | "recipientEmail" | "subject" | "status" | "sentAt" | "openedAt" | "openCount";
type SortDir = "asc" | "desc";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "sent":
      return <Mail className="size-4 text-blue-500" />;
    case "opened":
      return <MailOpen className="size-4 text-green-500" />;
    case "failed":
      return <MailX className="size-4 text-red-500" />;
    case "pending":
      return <Mail className="size-4 text-gray-400" />;
    default:
      return <Mail className="size-4 text-gray-400" />;
  }
}

function SendStatusBadge({ send }: { send: EmailSend }) {
  if (send.openedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <MailOpen className="size-3" /> Opened ({send.openCount}x)
      </span>
    );
  }
  switch (send.status) {
    case "sent":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          <Mail className="size-3" /> Sent
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          <MailX className="size-3" /> Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
          <Mail className="size-3" /> Pending
        </span>
      );
  }
}

function EmailCampaignTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"campaigns" | "sends">("campaigns");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showEnrollListModal, setShowEnrollListModal] = useState(false);
  const [enrollListId, setEnrollListId] = useState<string>("");
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [viewingStep, setViewingStep] = useState<Step | null>(null);

  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("sentAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const { data: sends = [] } = useQuery<EmailSend[]>({
    queryKey: ["/api/crm/sends"],
  });

  const { data: prospects = [] } = useQuery<Prospect[]>({
    queryKey: ["/api/crm/prospects"],
  });

  const { data: prospectLists = [] } = useQuery<ProspectList[]>({
    queryKey: ["/api/crm/prospect-lists"],
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
      setShowEnrollModal(false);
      setSelectedProspects(new Set());
      toast({ title: `${data.length} prospects enrolled`, description: "They will start receiving campaign emails." });
    },
    onError: (err: Error) => {
      toast({ title: "Enrollment failed", description: err.message, variant: "destructive" });
    },
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crm/drip/process");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/sends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/enrollments"] });
      toast({ title: "Drip emails processed", description: "Any due emails have been sent." });
    },
    onError: (err: Error) => {
      toast({ title: "Processing failed", description: err.message, variant: "destructive" });
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

  const pauseEnrollmentMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/crm/enrollments/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/enrollments"] });
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filteredSends = useMemo(() => {
    let result = sends;
    if (filterText) {
      const q = filterText.toLowerCase();
      result = result.filter(
        (s) =>
          s.recipientName.toLowerCase().includes(q) ||
          s.recipientEmail.toLowerCase().includes(q) ||
          s.subject.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "all") {
      if (filterStatus === "opened") {
        result = result.filter((s) => s.openedAt);
      } else if (filterStatus === "not_opened") {
        result = result.filter((s) => s.status === "sent" && !s.openedAt);
      } else {
        result = result.filter((s) => s.status === filterStatus);
      }
    }
    result = [...result].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortKey) {
        case "recipientName":
          aVal = a.recipientName.toLowerCase();
          bVal = b.recipientName.toLowerCase();
          break;
        case "recipientEmail":
          aVal = a.recipientEmail.toLowerCase();
          bVal = b.recipientEmail.toLowerCase();
          break;
        case "subject":
          aVal = a.subject.toLowerCase();
          bVal = b.subject.toLowerCase();
          break;
        case "status":
          aVal = a.openedAt ? "opened" : a.status;
          bVal = b.openedAt ? "opened" : b.status;
          break;
        case "sentAt":
          aVal = a.sentAt || "";
          bVal = b.sentAt || "";
          break;
        case "openedAt":
          aVal = a.openedAt || "";
          bVal = b.openedAt || "";
          break;
        case "openCount":
          aVal = a.openCount;
          bVal = b.openCount;
          break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [sends, filterText, filterStatus, sortKey, sortDir]);

  const sendStats = useMemo(() => ({
    total: sends.length,
    sent: sends.filter((s) => s.status === "sent" || s.openedAt).length,
    opened: sends.filter((s) => s.openedAt).length,
    failed: sends.filter((s) => s.status === "failed").length,
    pending: sends.filter((s) => s.status === "pending").length,
  }), [sends]);

  const SortHeader = ({ label, sortKeyVal }: { label: string; sortKeyVal: SortKey }) => (
    <button
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={() => handleSort(sortKeyVal)}
    >
      {label}
      <ArrowUpDown className={`size-3 ${sortKey === sortKeyVal ? "text-foreground" : ""}`} />
    </button>
  );

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
          Email Activity ({sends.length})
        </button>
      </div>

      {activeTab === "campaigns" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Email Campaigns</h3>
            <Button
              data-testid="button-process-drip"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending}
            >
              {processMutation.isPending ? (
                <><Loader2 className="size-4 animate-spin" /> Processing...</>
              ) : (
                <><Send className="size-4" /> Send Due Emails</>
              )}
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <Card className="p-8 text-center">
              <Mail className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">No campaigns yet. A default campaign will be created automatically.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  data-testid={`campaign-${campaign.id}`}
                  className={`p-4 cursor-pointer transition-colors ${selectedCampaign === campaign.id ? "border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]" : "hover:border-gray-300"}`}
                  onClick={() => setSelectedCampaign(selectedCampaign === campaign.id ? null : campaign.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{campaign.name}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${campaign.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                          {campaign.isActive ? "Active" : "Paused"}
                        </span>
                      </div>
                      {campaign.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{campaign.description}</p>
                      )}
                    </div>
                    <Button
                      data-testid={`toggle-campaign-${campaign.id}`}
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCampaignMutation.mutate({ id: campaign.id, isActive: !campaign.isActive });
                      }}
                    >
                      {campaign.isActive ? "Pause" : "Activate"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {selectedCampaign && campaignDetail && (
            <div className="mt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Email Steps ({campaignDetail.steps?.length || 0})</h4>
                  <Button
                    data-testid="button-add-step"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => { setShowStepEditor(true); setEditingStep(null); }}
                  >
                    <Plus className="size-3" /> Add Step
                  </Button>
                </div>

                {showStepEditor && (
                  <StepEditor
                    step={editingStep}
                    nextOrder={(campaignDetail.steps?.length || 0) + 1}
                    onSave={(data) => saveStepMutation.mutate(data)}
                    onCancel={() => { setShowStepEditor(false); setEditingStep(null); }}
                    isPending={saveStepMutation.isPending}
                  />
                )}

                <div className="space-y-2">
                  {campaignDetail.steps?.map((step) => (
                    <Card key={step.id} data-testid={`step-${step.id}`} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center size-6 rounded-full bg-[hsl(var(--primary))] text-white text-xs font-bold">
                              {step.stepOrder}
                            </span>
                            <span className="font-medium text-sm">{step.subject}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Day {step.delayDays} after enrollment
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingStep(viewingStep?.id === step.id ? null : step)}
                          >
                            <Eye className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingStep(step); setShowStepEditor(true); }}
                          >
                            <Edit2 className="size-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              if (confirm("Delete this email step?")) {
                                deleteStepMutation.mutate(step.id);
                              }
                            }}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                      {viewingStep?.id === step.id && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border text-sm">
                          <div dangerouslySetInnerHTML={{ __html: step.bodyHtml }} />
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Enrolled Prospects ({enrollments.length})</h4>
                  <div className="flex gap-2">
                    <Button
                      data-testid="button-enroll-from-list"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => { setShowEnrollListModal(true); setEnrollListId(""); }}
                      disabled={prospectLists.length === 0}
                    >
                      <Users className="size-3" /> From List
                    </Button>
                    <Button
                      data-testid="button-enroll-prospects"
                      size="sm"
                      className="gap-1"
                      onClick={() => { setShowEnrollModal(true); setSelectedProspects(new Set()); }}
                      disabled={enrollableProspects.length === 0}
                    >
                      <UserPlus className="size-3" /> Enroll Individuals
                    </Button>
                  </div>
                </div>

                {enrollments.length === 0 ? (
                  <Card className="p-6 text-center">
                    <Users className="mx-auto size-8 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">No prospects enrolled yet.</p>
                    {prospectLists.length > 0 && (
                      <Button
                        size="sm"
                        className="mt-3 gap-1"
                        onClick={() => { setShowEnrollListModal(true); setEnrollListId(""); }}
                      >
                        <Users className="size-3" /> Enroll from a List
                      </Button>
                    )}
                    {prospectLists.length === 0 && <p className="text-xs text-muted-foreground mt-1">Save prospects into a list in the People Finder first.</p>}
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {enrollments.map((e) => (
                      <Card key={e.id} data-testid={`enrollment-${e.id}`} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">{e.prospectName}</div>
                            <div className="text-xs text-muted-foreground">
                              {e.prospectEmail} &middot; Step {e.currentStep}/{campaignDetail.steps?.length || 0} &middot;{" "}
                              <span className={e.status === "active" ? "text-green-600" : e.status === "completed" ? "text-blue-600" : "text-gray-500"}>
                                {e.status}
                              </span>
                            </div>
                          </div>
                          {e.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => pauseEnrollmentMutation.mutate({ id: e.id, status: "paused" })}
                            >
                              Pause
                            </Button>
                          )}
                          {e.status === "paused" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => pauseEnrollmentMutation.mutate({ id: e.id, status: "active" })}
                            >
                              Resume
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
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
          <div className="grid gap-4 sm:grid-cols-4 mb-6">
            <Card className="p-3 text-center">
              <div className="text-xl font-bold text-[hsl(var(--primary))]">{sendStats.total}</div>
              <div className="text-xs text-muted-foreground">Total Emails</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-xl font-bold text-blue-600">{sendStats.sent}</div>
              <div className="text-xs text-muted-foreground">Sent</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-xl font-bold text-green-600">{sendStats.opened}</div>
              <div className="text-xs text-muted-foreground">Opened</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-xl font-bold text-red-600">{sendStats.failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </Card>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
            <div className="relative flex-1 max-w-sm">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                data-testid="input-filter-sends"
                placeholder="Filter by name, email, subject..."
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
                <option value="not_opened">Not opened</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-2.5 size-4 text-muted-foreground" />
            </div>
          </div>

          {filteredSends.length === 0 ? (
            <Card className="p-8 text-center">
              <Mail className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                {sends.length === 0 ? "No emails sent yet. Enroll prospects in a campaign and process the drip." : "No emails match your filter."}
              </p>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3"><SortHeader label="Recipient" sortKeyVal="recipientName" /></th>
                    <th className="text-left py-2 px-3"><SortHeader label="Email" sortKeyVal="recipientEmail" /></th>
                    <th className="text-left py-2 px-3"><SortHeader label="Subject" sortKeyVal="subject" /></th>
                    <th className="text-left py-2 px-3"><SortHeader label="Status" sortKeyVal="status" /></th>
                    <th className="text-left py-2 px-3"><SortHeader label="Sent" sortKeyVal="sentAt" /></th>
                    <th className="text-left py-2 px-3"><SortHeader label="Opened" sortKeyVal="openedAt" /></th>
                    <th className="text-left py-2 px-3"><SortHeader label="Opens" sortKeyVal="openCount" /></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSends.map((send) => (
                    <tr key={send.id} data-testid={`send-row-${send.id}`} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium">{send.recipientName}</td>
                      <td className="py-2 px-3 text-muted-foreground">{send.recipientEmail}</td>
                      <td className="py-2 px-3 max-w-48 truncate">{send.subject}</td>
                      <td className="py-2 px-3"><SendStatusBadge send={send} /></td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {send.sentAt ? new Date(send.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {send.openedAt ? new Date(send.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="py-2 px-3 text-center">{send.openCount}</td>
                    </tr>
                  ))}
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

function StepEditor({
  step,
  nextOrder,
  onSave,
  onCancel,
  isPending,
}: {
  step: Step | null;
  nextOrder: number;
  onSave: (data: any) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({
    stepOrder: step?.stepOrder || nextOrder,
    delayDays: step?.delayDays || 0,
    subject: step?.subject || "",
    bodyHtml: step?.bodyHtml || "",
  });

  return (
    <Card className="p-4 mb-4">
      <h4 className="font-semibold mb-3">{step ? "Edit Step" : "Add New Step"}</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Step order</Label>
          <Input
            type="number"
            value={form.stepOrder}
            onChange={(e) => setForm({ ...form, stepOrder: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div>
          <Label>Delay (days after enrollment)</Label>
          <Input
            type="number"
            value={form.delayDays}
            onChange={(e) => setForm({ ...form, delayDays: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div className="mt-3">
        <Label>Subject line</Label>
        <Input
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="Email subject..."
        />
      </div>
      <div className="mt-3">
        <Label>Email body (HTML)</Label>
        <p className="text-xs text-muted-foreground mb-1">Use {"{{name}}"} and {"{{email}}"} as placeholders for the recipient's name and email.</p>
        <textarea
          value={form.bodyHtml}
          onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
          rows={8}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono"
        />
      </div>
      <div className="mt-3 flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={isPending || !form.subject || !form.bodyHtml}>
          {isPending ? "Saving..." : step ? "Update" : "Add Step"}
        </Button>
      </div>
    </Card>
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
