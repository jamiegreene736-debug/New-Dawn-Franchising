import { useState, useRef, useEffect } from "react";
import { formatPhone } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Mail, Phone, MessageSquare, Mic, Send, Plus, Download,
  Trash2, FileText, Loader2, CheckCircle2, Circle, ExternalLink,
  Linkedin, Globe, ChevronDown, RefreshCw, Clock, Paperclip,
  PhoneCall, MessageCircle, PenLine, Timer, AlertTriangle, Sparkles,
  Printer, Zap, Check, Search, Megaphone, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  email_sent: <Mail className="size-4 text-blue-500" />,
  email_opened: <Mail className="size-4 text-green-500" />,
  email_clicked: <Mail className="size-4 text-purple-500" />,
  sms_sent: <MessageSquare className="size-4 text-teal-500" />,
  sms_failed: <MessageSquare className="size-4 text-red-500" />,
  whatsapp_sent: <MessageCircle className="size-4 text-green-600" />,
  whatsapp_failed: <MessageCircle className="size-4 text-red-500" />,
  voicemail_dropped: <Mic className="size-4 text-indigo-500" />,
  voicemail_failed: <Mic className="size-4 text-red-500" />,
  note_added: <FileText className="size-4 text-gray-500" />,
  status_changed: <RefreshCw className="size-4 text-orange-500" />,
  document_uploaded: <Paperclip className="size-4 text-amber-600" />,
  call_logged: <PhoneCall className="size-4 text-indigo-500" />,
  signature_sent: <PenLine className="size-4 text-violet-500" />,
  document_signed: <CheckCircle2 className="size-4 text-green-600" />,
};

function activityLabel(act: { activityType: string; metadata: unknown }): string {
  const m = (act.metadata || {}) as Record<string, unknown>;
  switch (act.activityType) {
    case "email_sent": return `Email sent: ${m.subject || ""}`;
    case "email_opened": return `Email opened: ${m.subject || ""}`;
    case "sms_sent": return `SMS sent: "${String(m.message || "").slice(0, 60)}${String(m.message || "").length > 60 ? "…" : ""}"`;
    case "sms_failed": return `SMS failed: ${m.error || ""}`;
    case "whatsapp_sent": return `WhatsApp sent: "${String(m.message || "").slice(0, 60)}…"`;
    case "whatsapp_failed": return `WhatsApp failed: ${m.error || ""}`;
    case "voicemail_dropped": return "Ringless voicemail dropped";
    case "voicemail_failed": return `Voicemail failed: ${m.error || ""}`;
    case "note_added": return String(m.note || "Note added");
    case "status_changed": return `Status: ${m.oldStatus || ""} → ${m.newStatus || ""}`;
    case "document_uploaded": return `Document uploaded: ${m.fileName || ""}`;
    case "call_logged": return `Call: ${m.summary || ""}`;
    case "signature_sent": return `${m.documentType === "fdd_receipt" ? "FDD Receipt" : "Franchise Agreement"} sent for signature to ${m.email || ""}`;
    case "document_signed": return `${m.documentType === "fdd_receipt" ? "FDD Receipt" : "Franchise Agreement"} signed by ${m.signerName || "client"}`;
    default: return act.activityType.replace(/_/g, " ");
  }
}

interface CrmClientFull {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  address?: string | null;
  status: string;
  fddSent: boolean;
  receiptSigned: boolean;
  brokerId?: string | null;
  notes?: string | null;
  lastContactedAt?: string | null;
  lastContactMethod?: string | null;
  investmentAmount?: string | null;
  citizenship?: string | null;
  visaType?: string | null;
  languagePreference?: string | null;
  linkedinUrl?: string | null;
  leadSource?: string | null;
  companyName?: string | null;
  profession?: string | null;
  leadTemperature?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DirectEmail {
  id: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  status: string;
  direction?: "inbound" | "outbound";
  openedAt: string | null;
  openCount: number;
  sentAt: string;
}

interface SenderProfile { email: string; name: string; }
interface EmailTpl { id: string; label: string; subject: string; bodyHtml: string; signatureRequest?: boolean; }

interface Activity {
  id: string;
  clientId: string;
  activityType: string;
  metadata: unknown;
  note?: string | null;
  createdAt: string;
}

interface Doc {
  id: string;
  clientId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

interface SigRequest {
  id: string;
  clientId: string;
  documentType: string;
  token: string;
  sentAt: string;
  sentToEmail: string;
  signedAt: string | null;
  signerName: string | null;
  signerIp: string | null;
}

interface Template { id: string; label: string; body?: string; script?: string; }
interface SmsMessage { id: string; direction: "inbound" | "outbound"; body: string; status: string; sentAt: string; }
interface TwilioStatus { configured: boolean; smsReady: boolean; whatsappReady: boolean; }
interface VoicemailStatus { configured: boolean; }

type Tab = "override" | "campaigns" | "email" | "sms" | "whatsapp" | "voicemail" | "documents" | "signing" | "linkedin" | "postcard";

interface ClientCampaignStep {
  stepOrder: number;
  stepName: string;
  stepType: string;
  delayDays: number;
  state: "done" | "current" | "upcoming";
}
interface ClientCampaign {
  enrollmentId: string;
  campaignId: string;
  campaignName: string;
  campaignActive: boolean;
  status: string;
  currentStep: number;
  totalSteps: number;
  currentStepName: string | null;
  currentStepType: string | null;
  enrolledAt: string;
  completedAt: string | null;
  steps: ClientCampaignStep[];
}

export function CrmClientDetail({ client, onClose, onRefresh }: {
  client: CrmClientFull;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("override");
  const [showMobileProfile, setShowMobileProfile] = useState(false);
  const [overrideExpanded, setOverrideExpanded] = useState<string | null>(null);
  const [overrideCompose, setOverrideCompose] = useState<{ subject: string; body: string; sender: string }>({ subject: "", body: "", sender: "" });
  const [overrideSending, setOverrideSending] = useState(false);
  const [overrideGenerating, setOverrideGenerating] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [linkedinNote, setLinkedinNote] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [postcardAddress, setPostcardAddress] = useState(client.address ?? "");
  const [waCheckResult, setWaCheckResult] = useState<{ onWhatsApp: boolean; waId?: string; error?: string } | null>(null);
  const [waChecking, setWaChecking] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    email?: { result: string; status: string; score: number; disposable?: boolean; webmail?: boolean; configured?: boolean };
    phone?: { valid: boolean; normalized: string; note: string };
  } | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [apolloLoading, setApolloLoading] = useState(false);
  const [apolloResult, setApolloResult] = useState<{
    found: boolean;
    enrichment?: { email?: string | null; phone?: string | null; jobTitle?: string | null; company?: string | null; linkedinUrl?: string | null; city?: string | null; state?: string | null; country?: string | null };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const smsBottomRef = useRef<HTMLDivElement>(null);

  const activitiesKey = [`/api/crm/clients/${client.id}/activities`];
  const docsKey = [`/api/crm/clients/${client.id}/documents`];
  const sigsKey = [`/api/crm/clients/${client.id}/signatures`];

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: activitiesKey,
    queryFn: async () => (await apiRequest("GET", `/api/crm/clients/${client.id}/activities`)).json(),
  });

  const { data: documents = [] } = useQuery<Doc[]>({
    queryKey: docsKey,
    queryFn: async () => (await apiRequest("GET", `/api/crm/clients/${client.id}/documents`)).json(),
  });

  const { data: signatures = [], refetch: refetchSigs } = useQuery<SigRequest[]>({
    queryKey: sigsKey,
    queryFn: async () => (await apiRequest("GET", `/api/crm/clients/${client.id}/signatures`)).json(),
    enabled: tab === "signing",
  });

  const { data: twilioStatus } = useQuery<TwilioStatus>({
    queryKey: ["/api/crm/twilio-status"],
    queryFn: async () => (await apiRequest("GET", "/api/crm/twilio-status")).json(),
  });

  // Drip campaigns this client is enrolled in (matched by email server-side).
  // Loaded eagerly — the Campaigns tab dot and the Send Now banner both depend on it.
  const { data: clientCampaigns = [] } = useQuery<ClientCampaign[]>({
    queryKey: [`/api/crm/clients/${client.id}/campaigns`],
    queryFn: async () => (await apiRequest("GET", `/api/crm/clients/${client.id}/campaigns`)).json(),
  });
  const activeCampaigns = clientCampaigns.filter((c) => c.status === "active");
  const isActiveOnCampaign = activeCampaigns.length > 0;

  // Email
  const emailsKey = [`/api/crm/clients/${client.id}/emails`];
  const { data: directEmails = [], refetch: refetchEmails } = useQuery<DirectEmail[]>({
    queryKey: emailsKey,
    queryFn: async () => (await apiRequest("GET", `/api/crm/clients/${client.id}/emails`)).json(),
    enabled: tab === "email",
  });
  const { data: senderProfiles = [] } = useQuery<SenderProfile[]>({
    queryKey: ["/api/crm/sender-profiles"],
    queryFn: async () => (await apiRequest("GET", "/api/crm/sender-profiles")).json(),
    enabled: tab === "email",
  });
  const { data: emailTemplates = [] } = useQuery<EmailTpl[]>({
    queryKey: ["/api/crm/email-templates"],
    queryFn: async () => (await apiRequest("GET", "/api/crm/email-templates")).json(),
    enabled: tab === "email",
  });
  const [emailForm, setEmailForm] = useState({
    fromEmail: "",
    subject: "",
    bodyHtml: "",
    selectedTemplate: "",
  });
  const [emailPreview, setEmailPreview] = useState(false);

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/send-email`, {
        fromEmail: emailForm.fromEmail,
        subject: emailForm.subject,
        bodyHtml: emailForm.bodyHtml.replace(/\{\{name\}\}/g, client.fullName).replace(/\{\{senderName\}\}/g, senderProfiles.find(s => s.email === emailForm.fromEmail)?.name || emailForm.fromEmail),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email sent", description: `Message delivered to ${client.email}` });
      setEmailForm({ fromEmail: emailForm.fromEmail, subject: "", bodyHtml: "", selectedTemplate: "" });
      refetchEmails();
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      onRefresh();
    },
    onError: (err: Error) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  const { data: voicemailStatus } = useQuery<VoicemailStatus>({
    queryKey: ["/api/crm/voicemail-status"],
    queryFn: async () => (await apiRequest("GET", "/api/crm/voicemail-status")).json(),
  });

  const smsHistoryKey = [`/api/crm/clients/${client.id}/sms`];
  const { data: smsHistory = [], refetch: refetchSmsHistory, isLoading: smsHistoryLoading } = useQuery<SmsMessage[]>({
    queryKey: smsHistoryKey,
    queryFn: async () => (await apiRequest("GET", `/api/crm/clients/${client.id}/sms`)).json(),
    enabled: tab === "sms",
    refetchInterval: tab === "sms" ? 15000 : false,
  });

  useEffect(() => {
    if (tab === "sms") smsBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tab, smsHistory.length]);

  const { data: smsTemplates = [] } = useQuery<Template[]>({
    queryKey: ["/api/crm/sms-templates"],
    queryFn: async () => (await apiRequest("GET", "/api/crm/sms-templates")).json(),
    enabled: tab === "sms",
  });

  const { data: waTemplates = [] } = useQuery<Template[]>({
    queryKey: ["/api/crm/whatsapp-templates"],
    queryFn: async () => (await apiRequest("GET", "/api/crm/whatsapp-templates")).json(),
    enabled: tab === "whatsapp",
  });

  const { data: voicemailScripts = [] } = useQuery<Template[]>({
    queryKey: ["/api/crm/voicemail-scripts"],
    queryFn: async () => (await apiRequest("GET", "/api/crm/voicemail-scripts")).json(),
    enabled: tab === "voicemail",
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/activities`, {
        activityType: "note_added",
        metadata: { note: noteText },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      setNoteText("");
    },
  });

  const smsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/sms`, { message: smsMessage });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      refetchSmsHistory();
      setSmsMessage("");
      toast({ title: "SMS sent" });
    },
    onError: (e: Error) => toast({ title: "SMS failed", description: e.message, variant: "destructive" }),
  });

  const waMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/whatsapp`, { message: waMessage });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      setWaMessage("");
      toast({ title: "WhatsApp message sent" });
    },
    onError: (e: Error) => toast({ title: "WhatsApp failed", description: e.message, variant: "destructive" }),
  });

  const logLinkedInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/activities`, {
        activityType: "note_added",
        note: `[LinkedIn] ${linkedinNote}`,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      setLinkedinNote("");
      toast({ title: "LinkedIn interaction logged" });
    },
    onError: (e: Error) => toast({ title: "Failed to log", description: e.message, variant: "destructive" }),
  });

  const voicemailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/voicemail`, { audioUrl });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      setAudioUrl("");
      toast({ title: "Voicemail dropped successfully" });
    },
    onError: (e: Error) => toast({ title: "Voicemail failed", description: e.message, variant: "destructive" }),
  });

  const postcardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/postcard`, { address: postcardAddress });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      toast({
        title: data.demoMode ? "Postcard queued (demo mode)" : "Postcard submitted to Lob!",
        description: data.demoMode
          ? "Add a LOB_API_KEY secret to send real postcards."
          : `Lob ID: ${data.lobId} — arrives in ~5 business days.`,
      });
    },
    onError: (e: Error) => toast({ title: "Postcard failed", description: e.message, variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      await apiRequest("DELETE", `/api/crm/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docsKey });
      toast({ title: "Document deleted" });
    },
  });

  const sendSignatureMutation = useMutation({
    mutationFn: async (documentType: string) => {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/send-signature`, { documentType });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: sigsKey });
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      onRefresh();
      toast({
        title: data.emailSent ? "Signature request sent" : "Signature request created (email failed)",
        description: data.emailSent ? `Signing link sent to ${client.email}` : "Created but email delivery failed — check GMAIL_APP_PASSWORD",
      });
    },
    onError: (e: Error) => toast({ title: "Failed to send", description: e.message, variant: "destructive" }),
  });

  const sendWelcomeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/send-welcome`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      toast({ title: "Wire receipt + welcome email sent" });
    },
    onError: (e: Error) => toast({ title: "Email failed", description: e.message, variant: "destructive" }),
  });

  const markPlaybookStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/activities`, {
        activityType: "playbook_step",
        note: `Playbook step marked complete: ${stepId}`,
        metadata: { step: stepId },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
      toast({ title: "Step marked as done" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 6MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        await apiRequest("POST", `/api/crm/clients/${client.id}/documents`, {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileData: base64,
        });
        queryClient.invalidateQueries({ queryKey: docsKey });
        queryClient.invalidateQueries({ queryKey: activitiesKey });
        toast({ title: "Document uploaded" });
      } catch (err) {
        toast({ title: "Upload failed", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const firstName = client.fullName.split(" ")[0];
  const lastName = client.fullName.split(" ").slice(1).join(" ") || "";

  const runVerifyContact = async () => {
    if (!client.email && !client.phone) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const res = await apiRequest("POST", "/api/crm/verify-contact", {
        email: client.email ?? undefined,
        phone: client.phone ?? undefined,
      });
      const data = await res.json();
      setVerifyResult(data);
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setVerifyLoading(false);
    }
  };

  const runApolloEnrich = async () => {
    setApolloLoading(true);
    setApolloResult(null);
    try {
      const res = await apiRequest("POST", `/api/crm/clients/${client.id}/enrich`, {});
      const data = await res.json();
      setApolloResult(data);
      if (!data.found) toast({ title: "No match found", description: "No provider returned a record for this name/email." });
    } catch {
      toast({ title: "Enrichment failed", variant: "destructive" });
    } finally {
      setApolloLoading(false);
    }
  };

  const applyApolloField = async (patch: Record<string, string>) => {
    try {
      await apiRequest("PATCH", `/api/crm/clients/${client.id}`, patch);
      toast({ title: "Saved to contact" });
      onRefresh();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const applyTemplate = (tmpl: Template, setter: (v: string) => void) => {
    const text = (tmpl.body || tmpl.script || "").replace(/\{\{name\}\}/g, firstName);
    setter(text);
  };

  // 10-day countdown helpers
  const fddSignedActivity = activities.find((a) => a.activityType === "document_signed" && (a.metadata as Record<string, unknown>)?.documentType === "fdd_receipt");
  const fddSignedAt = fddSignedActivity ? new Date(fddSignedActivity.createdAt) : null;
  const daysWaited = fddSignedAt ? Math.floor((Date.now() - fddSignedAt.getTime()) / 86400000) : null;
  const daysRemaining = daysWaited !== null ? Math.max(0, 14 - daysWaited) : null;
  const canSignAgreement = daysRemaining !== null && daysRemaining === 0;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "override", label: "Send Now", icon: <Zap className="size-3.5" /> },
    { key: "campaigns", label: "Campaigns", icon: <Megaphone className="size-3.5" /> },
    { key: "email", label: "Email", icon: <Mail className="size-3.5" /> },
    { key: "signing", label: "Signing", icon: <PenLine className="size-3.5" /> },
    { key: "linkedin", label: "LinkedIn", icon: <Linkedin className="size-3.5" /> },
    { key: "sms", label: "SMS", icon: <MessageSquare className="size-3.5" /> },
    { key: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="size-3.5" /> },
    { key: "voicemail", label: "Voicemail", icon: <Mic className="size-3.5" /> },
    { key: "postcard", label: "Postcard", icon: <Printer className="size-3.5" /> },
    { key: "documents", label: "Documents", icon: <Paperclip className="size-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 md:p-3">
      <div className="w-full md:max-w-4xl h-[92dvh] md:max-h-[92vh] flex flex-col rounded-t-2xl md:rounded-2xl bg-card border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-4 md:px-6 py-3 md:py-4 bg-muted/30 shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg md:text-xl font-bold truncate">{client.fullName}</h2>
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-0.5 text-sm text-muted-foreground">
              {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-foreground min-w-0"><Mail className="size-3.5 shrink-0" /><span className="truncate max-w-[180px] md:max-w-none">{client.email}</span></a>}
              {client.phone && <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-foreground shrink-0"><Phone className="size-3.5" />{formatPhone(client.phone)}</a>}
              {client.linkedinUrl && <a href={client.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hidden md:flex items-center gap-1 hover:text-foreground"><Linkedin className="size-3.5" />LinkedIn</a>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted ml-2 shrink-0"><X className="size-5" /></button>
        </div>

        {/* Mobile-only: collapsible profile section */}
        <div className="md:hidden border-b shrink-0">
          <button
            onClick={() => setShowMobileProfile(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <ChevronDown className={`size-4 transition-transform duration-200 ${showMobileProfile ? "rotate-180" : ""}`} />
              Profile Details
            </span>
            <span className="text-xs text-muted-foreground capitalize">{client.status.replace(/_/g, " ")} · {client.visaType || ""}</span>
          </button>
          {showMobileProfile && (
            <div className="px-4 pb-4 pt-1 grid grid-cols-2 gap-x-4 gap-y-3 border-t overflow-y-auto max-h-52">
              <ProfileField label="Status" value={client.status.replace(/_/g, " ")} />
              <ProfileField label="Citizenship" value={client.citizenship} />
              <ProfileField label="Visa Type" value={client.visaType} />
              <ProfileField label="Language" value={client.languagePreference} />
              <ProfileField label="Country" value={client.country} />
              <ProfileField label="Lead Source" value={client.leadSource} />
              <ProfileField label="FDD Sent" value={client.fddSent ? "Yes" : "No"} />
              <ProfileField label="Receipt Signed" value={client.receiptSigned ? "Yes" : "No"} />
              <ProfileField label="Investment" value={client.investmentAmount} />
              <ProfileField label="Company" value={client.companyName} />
              {client.address && <div className="col-span-2"><ProfileField label="Address" value={client.address} /></div>}
              {client.notes && <div className="col-span-2"><ProfileField label="Notes" value={client.notes} /></div>}
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Left: Profile fields — desktop only */}
          <div className="hidden md:block w-64 shrink-0 border-r overflow-y-auto p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile</h3>
            <ProfileField label="Status" value={client.status.replace(/_/g, " ")} />
            {client.leadTemperature && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Temperature</p>
                {(() => {
                  const TEMP_MAP: Record<string, { label: string; icon: string; color: string }> = {
                    cold:      { label: "Cold",      icon: "🧊", color: "text-blue-600" },
                    warm:      { label: "Warm",      icon: "☀️", color: "text-amber-600" },
                    hot:       { label: "Hot",       icon: "🔥", color: "text-red-600" },
                    qualified: { label: "Qualified", icon: "✅", color: "text-green-600" },
                    closed:    { label: "Closed",    icon: "🔒", color: "text-gray-500" },
                  };
                  const t = TEMP_MAP[client.leadTemperature!] || { label: client.leadTemperature!, icon: "•", color: "" };
                  return <p className={`text-sm font-semibold ${t.color}`}>{t.icon} {t.label}</p>;
                })()}
              </div>
            )}
            <ProfileField label="Country" value={client.country} />
            <ProfileField label="Address" value={client.address} />

            {/* Contact verification (Hunter.io email verifier + phone format check) */}
            <div>
              <button
                data-testid="button-verify-contact"
                onClick={runVerifyContact}
                disabled={verifyLoading || (!client.email && !client.phone)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {verifyLoading ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
                {verifyLoading ? "Verifying…" : "Verify email & phone"}
              </button>
              {verifyResult && (
                <div className="mt-2 space-y-2 rounded-md border bg-muted/40 p-2">
                  {verifyResult.email && (() => {
                    const e = verifyResult.email!;
                    const cls = e.result === "deliverable" ? "bg-green-100 text-green-700"
                      : e.result === "risky" ? "bg-amber-100 text-amber-700"
                      : e.result === "undeliverable" ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600";
                    return (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Mail className="size-3 text-muted-foreground" />
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>{e.result}</span>
                          {e.score != null && <span className="text-[10px] text-muted-foreground">score {e.score}/100</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {e.configured === false ? "Hunter.io API key not set" : `${e.status}${e.disposable ? " · disposable" : ""}${e.webmail ? " · webmail" : ""}`}
                        </p>
                      </div>
                    );
                  })()}
                  {verifyResult.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3 text-muted-foreground" />
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${verifyResult.phone.valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {verifyResult.phone.valid ? "Valid format" : "Invalid format"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{verifyResult.phone.note}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Apollo.io profile enrichment */}
            <div>
              <button
                data-testid="button-apollo-enrich"
                onClick={runApolloEnrich}
                disabled={apolloLoading}
                className="flex items-center gap-1.5 text-[11px] font-medium text-purple-600 hover:text-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {apolloLoading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                {apolloLoading ? "Enriching…" : "Enrich contact (Apollo + Origami)"}
              </button>
              {apolloResult?.found && apolloResult.enrichment && (() => {
                const e = apolloResult.enrichment!;
                const loc = [e.city, e.state, e.country].filter(Boolean).join(", ");
                const ApplyBtn = ({ onClick }: { onClick: () => void }) => (
                  <button onClick={onClick} className="shrink-0 rounded border border-purple-300 px-1.5 py-0.5 text-[10px] font-semibold text-purple-600 hover:text-purple-800">Apply</button>
                );
                return (
                  <div className="mt-2 space-y-1.5 rounded-md border border-purple-200 bg-purple-50 p-2 text-xs">
                    {e.jobTitle && <p className="text-foreground"><span className="font-semibold">Title:</span> {e.jobTitle}</p>}
                    {e.company && <p className="text-foreground"><span className="font-semibold">Company:</span> {e.company}</p>}
                    {e.email && (
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-foreground">{e.email}</span>
                        {!client.email && <ApplyBtn onClick={() => applyApolloField({ email: e.email! })} />}
                      </div>
                    )}
                    {e.phone && (
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-foreground">{e.phone}</span>
                        {!client.phone && <ApplyBtn onClick={() => applyApolloField({ phone: e.phone! })} />}
                      </div>
                    )}
                    {e.linkedinUrl && (
                      <div className="flex items-center justify-between gap-1">
                        <a href={e.linkedinUrl} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 hover:underline">LinkedIn profile</a>
                        {!client.linkedinUrl && <ApplyBtn onClick={() => applyApolloField({ linkedinUrl: e.linkedinUrl! })} />}
                      </div>
                    )}
                    {loc && (
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-foreground">{loc}</span>
                        {!client.address && <ApplyBtn onClick={() => applyApolloField({ address: loc })} />}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {client.lastContactedAt && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Last Contacted</p>
                <p className="text-sm">{new Date(client.lastContactedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{client.lastContactMethod ? ` · ${client.lastContactMethod}` : ""}</p>
              </div>
            )}
            <ProfileField label="Citizenship" value={client.citizenship} />
            <ProfileField label="Investment" value={client.investmentAmount} />
            <ProfileField label="Visa Type" value={client.visaType} />
            <ProfileField label="Language" value={client.languagePreference} />
            <ProfileField label="Company" value={client.companyName} />
            <ProfileField label="Profession" value={client.profession} />
            <ProfileField label="Lead Source" value={client.leadSource} />
            <ProfileField label="FDD Sent" value={client.fddSent ? "Yes" : "No"} />
            <ProfileField label="Receipt Signed" value={client.receiptSigned ? "Yes" : "No"} />
            <ProfileField label="Added" value={new Date(client.createdAt).toLocaleDateString()} />
            {client.notes && (
              <div className="border-t pt-2">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
                <p className="text-xs whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </div>

          {/* Right: Tabbed content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b px-2 md:px-4 pt-2 gap-0.5 shrink-0 overflow-x-auto scrollbar-tab">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                    tab === t.key
                      ? "bg-background border border-b-0 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.icon} {t.label}
                  {t.key === "campaigns" && (
                    <span
                      title={isActiveOnCampaign ? `Active on ${activeCampaigns.length} campaign${activeCampaigns.length > 1 ? "s" : ""}` : "Not active on any campaign"}
                      className={`ml-1 size-2 shrink-0 rounded-full ${isActiveOnCampaign ? "bg-green-500" : "bg-red-400"}`}
                    />
                  )}
                  {t.key === "email" && directEmails.length > 0 && (
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{directEmails.length}</span>
                  )}
                  {t.key === "documents" && documents.length > 0 && (
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{documents.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4">

              {/* ── Active Campaigns ── */}
              {tab === "campaigns" && (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold">Campaign Enrollments</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {clientCampaigns.length === 0
                        ? "Not enrolled in any campaign yet."
                        : `${activeCampaigns.length} active · ${clientCampaigns.length} total`}
                    </p>
                  </div>

                  {clientCampaigns.length === 0 && (
                    <div className="rounded-xl border border-dashed p-6 text-center">
                      <Megaphone className="size-7 mx-auto text-muted-foreground/40" />
                      <p className="text-sm font-medium mt-2">No campaign enrollments</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Enroll {firstName} into a drip campaign from the Contacts list to start automated outreach.
                      </p>
                    </div>
                  )}

                  {clientCampaigns.map((c) => {
                    const STATUS_STYLES: Record<string, string> = {
                      active: "bg-green-100 text-green-700 border-green-200",
                      paused: "bg-amber-100 text-amber-700 border-amber-200",
                      bounced: "bg-red-100 text-red-700 border-red-200",
                      completed: "bg-gray-100 text-gray-600 border-gray-200",
                    };
                    const CHANNEL_LABEL: Record<string, string> = {
                      email: "Email", manual_email: "Email",
                      sms: "SMS", call: "Call", task: "Task",
                      linkedin: "LinkedIn", linkedin_connect: "LinkedIn", linkedin_message: "LinkedIn",
                    };
                    const doneSteps = c.steps.filter((s) => s.state === "done").length;
                    const pct = c.totalSteps > 0 ? (doneSteps / c.totalSteps) * 100 : 0;
                    const isComplete = c.status === "completed" || c.currentStep >= c.totalSteps;
                    // A stopped enrollment (bounced/paused) must not look like it's
                    // actively progressing — that's what made it seem "active".
                    const isStopped = c.status === "bounced" || c.status === "paused";
                    const barColor = c.status === "bounced" ? "bg-red-400" : c.status === "paused" ? "bg-amber-400" : "bg-[hsl(var(--primary))]";
                    return (
                      <div key={c.enrollmentId} className="rounded-xl border bg-card overflow-hidden">
                        {/* Campaign header */}
                        <div className="flex items-start justify-between gap-2 border-b bg-muted/30 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-tight truncate">{c.campaignName}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Enrolled {new Date(c.enrolledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              {!c.campaignActive && <span className="text-amber-600"> · campaign paused</span>}
                            </p>
                          </div>
                          <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${STATUS_STYLES[c.status] || STATUS_STYLES.completed}`}>
                            {c.status}
                          </span>
                        </div>

                        {/* Progress + steps */}
                        <div className="px-3 py-2.5 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground min-w-0 truncate">
                              {c.status === "bounced"
                                ? <><span className="font-semibold text-red-600">Stopped — email bounced</span> at step {c.currentStep + 1} of {c.totalSteps}</>
                                : c.status === "paused"
                                  ? <><span className="font-semibold text-amber-600">Paused</span> at step {c.currentStep + 1} of {c.totalSteps}</>
                                  : isComplete
                                    ? "All steps complete"
                                    : <>Currently on <span className="font-semibold text-foreground">step {c.currentStep + 1}</span> of {c.totalSteps}{c.currentStepName ? <span className="text-foreground"> — {c.currentStepName}</span> : null}</>}
                            </span>
                            <span className="shrink-0 ml-2 font-medium text-muted-foreground tabular-nums">{doneSteps}/{c.totalSteps}</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>

                          <div className="pt-1 space-y-1">
                            {c.steps.map((s, idx) => (
                              <div key={idx} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${s.state === "current" && !isStopped ? "bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.3)]" : ""}`}>
                                {s.state === "done"
                                  ? <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                                  : s.state === "current"
                                    ? (isStopped
                                        ? <span className="size-4 shrink-0 grid place-items-center"><span className={`size-2.5 rounded-full ${c.status === "bounced" ? "bg-red-400" : "bg-amber-400"}`} /></span>
                                        : <span className="size-4 shrink-0 grid place-items-center"><span className="size-2.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" /></span>)
                                    : <Circle className="size-4 shrink-0 text-muted-foreground/40" />}
                                <span className={`text-xs flex-1 min-w-0 truncate ${s.state === "upcoming" ? "text-muted-foreground" : "font-medium"}`}>
                                  {idx + 1}. {s.stepName}
                                </span>
                                <span className="shrink-0 text-[10px] text-muted-foreground">{CHANNEL_LABEL[s.stepType] || s.stepType}</span>
                                <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums w-12 text-right">Day {s.delayDays}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Manual Override / Send Now ── */}
              {tab === "override" && (() => {
                const autoStep = (type: string) => activities.find(a => a.activityType === type);
                const manualStep = (id: string) =>
                  activities.find(a => a.activityType === "playbook_step" && (a.metadata as Record<string,string>)?.step === id);

                const CALENDLY = "https://calendly.com/dylan-newdawnfranchising";
                const fromEmail = senderProfiles[0]?.email || "dylan@newdawnfranchising.com";

                interface OverrideStep {
                  id: string;
                  day: string;
                  channel: string;
                  icon: React.ReactNode;
                  iconBg: string;
                  iconColor: string;
                  description: string;
                  condition?: string;
                  sendType: "email" | "sms" | "whatsapp" | "manual";
                  defaultSubject?: string;
                  defaultBody: string;
                  autoDetect?: () => Activity | undefined;
                }

                const STEPS: OverrideStep[] = [
                  {
                    id: "d0_linkedin",
                    day: "Day 0",
                    channel: "LinkedIn Connection Request",
                    icon: <Linkedin className="size-4" />,
                    iconBg: "bg-sky-50",
                    iconColor: "text-sky-600",
                    description: "Send a personalised connection request on LinkedIn to open the relationship.",
                    sendType: "manual",
                    defaultBody: `Hi ${firstName} — I came across your work and wanted to connect. I'm with New Dawn Franchising, built specifically for E-2 Treaty Investor Visa candidates who want to own a U.S. business without running the day-to-day. Would love to connect.`,
                  },
                  {
                    id: "d1_email",
                    day: "Day 1",
                    channel: "Touch 1 — Soft Intro Email",
                    icon: <Mail className="size-4" />,
                    iconBg: "bg-blue-50",
                    iconColor: "text-blue-600",
                    description: "First email — warm, non-salesy intro to the E-2 franchise opportunity.",
                    sendType: "email",
                    defaultSubject: "Franchise Investment Opportunity — E-2 Visa Pathway",
                    defaultBody: `Hi ${firstName},\n\nI wanted to reach out about an exciting franchise investment opportunity based in El Paso, Texas. Our model has helped dozens of international investors secure their E-2 visa and build a thriving business in the US.\n\nRecognized by Forbes 30 Under 30 — and all client funds are held in escrow with a full refund if the visa is denied.\n\nWould love to share more in a quick 20-minute call: ${CALENDLY}\n\nLooking forward to connecting,\nDylan Delaney\nNew Dawn Franchising`,
                    autoDetect: () => activities.find(a => a.activityType === "email_sent" && (a.metadata as any)?.step === "d1_email"),
                  },
                  {
                    id: "d1_sms",
                    day: "Day 1",
                    channel: "SMS — Email Open Trigger",
                    icon: <MessageSquare className="size-4" />,
                    iconBg: "bg-green-50",
                    iconColor: "text-green-600",
                    description: "If the Day 1 email was opened within 24 hours, fire this SMS to strike while interest is hot.",
                    condition: "If: email opened < 24 hrs",
                    sendType: "sms",
                    defaultBody: `Hi ${firstName}, Dylan from New Dawn Franchising — just wanted to make sure my email came through. Happy to hop on a quick call: ${CALENDLY}`,
                  },
                  {
                    id: "d1_lob",
                    day: "Day 1",
                    channel: "Lob Postcard",
                    icon: <Printer className="size-4" />,
                    iconBg: "bg-amber-50",
                    iconColor: "text-amber-600",
                    description: "Submit a branded postcard via Lob (physical mail) — arrives in ~5 days.",
                    condition: "If: mailing address on file",
                    sendType: "manual",
                    defaultBody: "",
                  },
                  {
                    id: "d3_email",
                    day: "Day 3",
                    channel: "Touch 2 — Credibility & Social Proof",
                    icon: <Mail className="size-4" />,
                    iconBg: "bg-blue-50",
                    iconColor: "text-blue-600",
                    description: "Second email — share success stories, investor testimonials, and key differentiators.",
                    sendType: "email",
                    defaultSubject: "Real investors, real results — New Dawn Franchising",
                    defaultBody: `Hi ${firstName},\n\nFollowing up from my earlier note. Wanted to share a quick snapshot of what our investors have achieved:\n\n• E-2 visa approved in under 6 months\n• Full-service franchise support (training, marketing, operations)\n• Average ROI in Year 1: 22%\n\nWe work exclusively with E-2 visa investors, so the entire model is built around what immigration attorneys and investors need to succeed.\n\nHappy to send over our investor overview deck — just say the word, or book a call here: ${CALENDLY}\n\nBest,\nDylan Delaney\nNew Dawn Franchising`,
                    autoDetect: () => activities.find(a => a.activityType === "email_sent" && (a.metadata as any)?.step === "d3_email"),
                  },
                  {
                    id: "d3_linkedin",
                    day: "Day 3",
                    channel: "LinkedIn DM",
                    icon: <Linkedin className="size-4" />,
                    iconBg: "bg-sky-50",
                    iconColor: "text-sky-600",
                    description: "If they accepted the Day 0 connection request, send a short LinkedIn DM.",
                    condition: "If: LinkedIn connected",
                    sendType: "manual",
                    defaultBody: `Hi ${firstName} — thanks for connecting! I sent you an email too so it doesn't get buried. We built New Dawn for E-2 candidates: a qualifying U.S. business they direct while our team runs daily ops, and they can live anywhere in the U.S. Happy to share a quick overview if it's useful for anyone in your pipeline.`,
                  },
                  {
                    id: "d5_heygen",
                    day: "Day 5",
                    channel: "HeyGen AI Video Email",
                    icon: <Zap className="size-4" />,
                    iconBg: "bg-purple-50",
                    iconColor: "text-purple-600",
                    description: "Send a personalised AI avatar video email via HeyGen (no mailing address flow only).",
                    condition: "If: no mailing address",
                    sendType: "manual",
                    defaultBody: "",
                  },
                  {
                    id: "d7_email",
                    day: "Day 7",
                    channel: "Touch 3 — Referral Fee Reveal",
                    icon: <Mail className="size-4" />,
                    iconBg: "bg-blue-50",
                    iconColor: "text-blue-600",
                    description: "Third email — reveal the referral fee structure to appeal to immigration attorneys and brokers.",
                    sendType: "email",
                    defaultSubject: `${firstName}, here's what we pay for referrals`,
                    defaultBody: `Hi ${firstName},\n\nI wanted to share something I don't always lead with: we pay a generous referral fee to immigration attorneys and financial advisors who send us investors.\n\nIf you work with clients exploring the E-2 visa, this could be a meaningful additional revenue stream for your practice — and a genuine value-add for your clients.\n\nOur franchise was built specifically around E-2 investors. Every client gets:\n• Escrow-protected investment\n• Full visa support documentation\n• Operations and training included\n\nWorth 15 minutes? Book here: ${CALENDLY}\n\nDylan Delaney\nNew Dawn Franchising`,
                    autoDetect: () => activities.find(a => a.activityType === "email_sent" && (a.metadata as any)?.step === "d7_email"),
                  },
                  {
                    id: "d7_sms",
                    day: "Day 7",
                    channel: "SMS — Email Open Trigger",
                    icon: <MessageSquare className="size-4" />,
                    iconBg: "bg-green-50",
                    iconColor: "text-green-600",
                    description: "If the Day 7 referral email was opened within 4 hours, send this SMS follow-up.",
                    condition: "If: email opened < 4 hrs",
                    sendType: "sms",
                    defaultBody: `Hi ${firstName}, Dylan from New Dawn Franchising. Sent you an email about our referral program — did it land okay? Happy to chat: ${CALENDLY}`,
                  },
                  {
                    id: "d7_lob",
                    day: "Day 7",
                    channel: "Lob Premium Letter",
                    icon: <Printer className="size-4" />,
                    iconBg: "bg-amber-50",
                    iconColor: "text-amber-600",
                    description: "Send a premium printed letter via Lob for leads with a mailing address.",
                    condition: "If: mailing address on file",
                    sendType: "manual",
                    defaultBody: "",
                  },
                  {
                    id: "d10_whatsapp",
                    day: "Day 10",
                    channel: "WhatsApp Follow-Up",
                    icon: <MessageCircle className="size-4" />,
                    iconBg: "bg-emerald-50",
                    iconColor: "text-emerald-600",
                    description: "WhatsApp message if they haven't replied on any channel yet.",
                    condition: "If: no reply on any channel",
                    sendType: "whatsapp",
                    defaultBody: `Hi ${firstName}! 👋 Dylan here from New Dawn Franchising. I've sent a couple of emails about our E-2 visa franchise opportunity — I know inboxes get busy. Even a 10-minute call would be great: ${CALENDLY}`,
                    autoDetect: () => autoStep("whatsapp_sent"),
                  },
                  {
                    id: "d14_email",
                    day: "Day 14",
                    channel: "Case Study Email",
                    icon: <Mail className="size-4" />,
                    iconBg: "bg-violet-50",
                    iconColor: "text-violet-600",
                    description: "Deep-dive case study for HeyGen flow leads who haven't replied yet.",
                    condition: "If: no mailing address (HeyGen flow)",
                    sendType: "email",
                    defaultSubject: "How Omar got his E-2 visa through New Dawn Franchising",
                    defaultBody: `Hi ${firstName},\n\nI wanted to share a quick case study before I close the loop.\n\nOmar, an Egyptian investor, came to us after two failed E-2 attempts. Within 5 months of working with New Dawn:\n\n✅ Visa approved\n✅ Franchise opened in El Paso\n✅ $180K in Year 1 revenue\n\nThe key difference: our franchise is purpose-built for E-2 applicants. We handle the business plan, documentation, and attorney coordination.\n\nIf this resonates, I'd love to connect: ${CALENDLY}\n\nDylan Delaney\nNew Dawn Franchising`,
                    autoDetect: () => activities.find(a => a.activityType === "email_sent" && (a.metadata as any)?.step === "d14_email"),
                  },
                  {
                    id: "d21_email",
                    day: "Day 21",
                    channel: "Final Breakup Email",
                    icon: <Mail className="size-4" />,
                    iconBg: "bg-rose-50",
                    iconColor: "text-rose-600",
                    description: "Last email in the sequence — short, respectful, leaves the door open.",
                    sendType: "email",
                    defaultSubject: `Closing the loop, ${firstName}`,
                    defaultBody: `Hi ${firstName},\n\nI've reached out a few times about our E-2 franchise opportunity and I don't want to keep interrupting your inbox.\n\nIf the timing isn't right — totally understood. If you'd ever like to revisit, my calendar is always open: ${CALENDLY}\n\nWishing you and your clients the very best.\n\nDylan Delaney\nNew Dawn Franchising`,
                    autoDetect: () => activities.find(a => a.activityType === "email_sent" && (a.metadata as any)?.step === "d21_email"),
                  },
                ];

                const isDone = (s: OverrideStep) => {
                  if (s.autoDetect) { const act = s.autoDetect(); if (act) return { done: true, at: new Date(act.createdAt) }; }
                  const m = manualStep(s.id);
                  if (m) return { done: true, at: new Date(m.createdAt) };
                  return { done: false };
                };

                const sendNow = async (s: OverrideStep) => {
                  const activeSender = overrideCompose.sender || fromEmail;
                  if (s.sendType === "email" && !activeSender) {
                    toast({ title: "No sender email configured", description: "Add a sender profile in Settings → Email Senders first.", variant: "destructive" });
                    return;
                  }
                  setOverrideSending(true);
                  try {
                    if (s.sendType === "email") {
                      await apiRequest("POST", `/api/crm/clients/${client.id}/send-email`, {
                        fromEmail: activeSender,
                        subject: overrideCompose.subject || s.defaultSubject || "",
                        bodyHtml: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${(overrideCompose.body || s.defaultBody).replace(/\n/g, "<br/>")}</div>`,
                      });
                      toast({ title: `Email sent to ${firstName}` });
                    } else if (s.sendType === "sms") {
                      await apiRequest("POST", `/api/crm/clients/${client.id}/sms`, { message: overrideCompose.body || s.defaultBody });
                      toast({ title: `SMS sent to ${firstName}` });
                    } else if (s.sendType === "whatsapp") {
                      await apiRequest("POST", `/api/crm/clients/${client.id}/whatsapp`, { message: overrideCompose.body || s.defaultBody });
                      toast({ title: `WhatsApp sent to ${firstName}` });
                    }
                    // If no autoDetect, log a playbook_step so the step shows "Done"
                    if (!s.autoDetect) {
                      await apiRequest("POST", `/api/crm/clients/${client.id}/activities`, {
                        activityType: "playbook_step",
                        note: `Sent via Send Now: ${s.channel}`,
                        metadata: { step: s.id },
                      });
                    }
                    queryClient.invalidateQueries({ queryKey: activitiesKey });
                    setOverrideExpanded(null);
                    setOverrideCompose({ subject: "", body: "", sender: "" });
                  } catch (e: any) {
                    toast({ title: "Send failed", description: e.message, variant: "destructive" });
                  } finally {
                    setOverrideSending(false);
                  }
                };

                const generateDraft = async (s: OverrideStep) => {
                  if (s.sendType === "manual") return;
                  setOverrideGenerating(true);
                  try {
                    const res = await apiRequest("POST", `/api/crm/clients/${client.id}/draft-outreach`, {
                      stepId: s.id,
                      stepName: s.channel,
                      channel: s.sendType,
                      dayNumber: parseInt(s.day.replace(/\D/g, "")) || 0,
                    });
                    const data: { subject?: string; body: string } = await res.json();
                    setOverrideCompose(c => ({
                      ...c,
                      subject: data.subject || s.defaultSubject || "",
                      body: data.body || s.defaultBody,
                    }));
                  } catch {
                    // fall back to static template silently
                    setOverrideCompose(c => ({
                      ...c,
                      subject: s.defaultSubject || "",
                      body: s.defaultBody,
                    }));
                  } finally {
                    setOverrideGenerating(false);
                  }
                };

                const openStep = (s: OverrideStep) => {
                  setOverrideExpanded(s.id);
                  setOverrideCompose({ subject: s.defaultSubject || "", body: "", sender: fromEmail });
                  generateDraft(s);
                };

                const doneCount = STEPS.filter(s => isDone(s).done).length;

                return (
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">Outreach Sequence for {firstName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{doneCount} of {STEPS.length} steps complete</p>
                      </div>
                      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-[hsl(var(--primary))] transition-all" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
                      </div>
                    </div>

                    {/* Live-campaign status banner */}
                    {isActiveOnCampaign ? (
                      <button
                        onClick={() => setTab("campaigns")}
                        className="w-full flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-left text-xs hover:bg-green-100 transition-colors dark:border-green-900 dark:bg-green-950/30"
                      >
                        <span className="size-2 shrink-0 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-green-800 dark:text-green-300">
                          <span className="font-semibold">{firstName}</span> is active on{" "}
                          <span className="font-semibold">{activeCampaigns.length} campaign{activeCampaigns.length > 1 ? "s" : ""}</span>
                          {" — "}{activeCampaigns.map((c) => c.campaignName).join(", ")}
                        </span>
                        <span className="ml-auto shrink-0 font-medium text-green-700 dark:text-green-400">View →</span>
                      </button>
                    ) : clientCampaigns.length > 0 ? (
                      <button
                        onClick={() => setTab("campaigns")}
                        className="w-full flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                      >
                        <span className="size-2 shrink-0 rounded-full bg-red-400" />
                        <span>
                          <span className="font-semibold text-foreground">{firstName}</span> isn't active —{" "}
                          {clientCampaigns.filter((c) => c.status === "bounced").length > 0
                            ? <>enrollment in <span className="font-medium text-foreground">{clientCampaigns.find((c) => c.status === "bounced")?.campaignName}</span> stopped (email bounced).</>
                            : <>{clientCampaigns.length} enrollment{clientCampaigns.length > 1 ? "s" : ""}, none active.</>}
                        </span>
                        <span className="ml-auto shrink-0 font-medium text-foreground/70">View →</span>
                      </button>
                    ) : (
                      <div className="w-full flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        <span className="size-2 shrink-0 rounded-full bg-red-400" />
                        <span><span className="font-semibold text-foreground">{firstName}</span> is not active on any campaign.</span>
                      </div>
                    )}

                    {/* Note composer (add to timeline) */}
                    <div className="flex gap-2">
                      <textarea placeholder="Add a note to timeline…" value={noteText} onChange={e => setNoteText(e.target.value)}
                        rows={1} className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm resize-none" />
                      <Button size="sm" variant="outline" disabled={!noteText.trim() || addNoteMutation.isPending}
                        onClick={() => addNoteMutation.mutate()}>
                        {addNoteMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : "Log"}
                      </Button>
                    </div>

                    {/* Steps */}
                    {STEPS.map((s, i) => {
                      const status = isDone(s);
                      const isExpanded = overrideExpanded === s.id;
                      const isEmail = s.sendType === "email";
                      const needsPhone = s.sendType === "sms" || s.sendType === "whatsapp";
                      const hasContact = isEmail ? !!client.email : !!client.phone;
                      const isLinkedInStep = /linkedin/i.test(s.channel);
                      // Direct profile link if we have it, otherwise a name search on LinkedIn.
                      const linkedInHref = client.linkedinUrl
                        ? client.linkedinUrl
                        : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(client.fullName || "")}`;

                      return (
                        <div key={s.id} className={`rounded-xl border transition-all ${status.done ? "border-green-100 bg-green-50/50" : isExpanded ? "border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.03)]" : "border-muted bg-card"}`}>
                          {/* Step header row */}
                          <div className="flex items-center gap-2.5 p-3">
                            <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${s.iconBg}`}>
                              <span className={s.iconColor}>{s.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className="text-[10px] font-semibold text-muted-foreground">Step {i + 1}</span>
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.iconBg} ${s.iconColor}`}>{s.day}</span>
                                {s.sendType === "manual" && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">Manual — you do this</span>
                                )}
                                {s.condition && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">{s.condition}</span>
                                )}
                              </div>
                              <p className="text-sm font-semibold leading-tight">{s.channel}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.description}</p>
                            </div>

                            {/* Action button */}
                            <div className="shrink-0">
                              {status.done ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                                  <Check className="size-3" />Done
                                </span>
                              ) : s.sendType === "manual" ? (
                                <Button size="sm" className="h-7 text-xs gap-1" disabled={markPlaybookStepMutation.isPending}
                                  onClick={() => markPlaybookStepMutation.mutate(s.id)}>
                                  {markPlaybookStepMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}Mark done
                                </Button>
                              ) : (
                                <Button size="sm" variant={isExpanded ? "outline" : "default"}
                                  className={`h-7 text-xs gap-1 ${isExpanded ? "" : "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)]"}`}
                                  onClick={() => isExpanded ? setOverrideExpanded(null) : openStep(s)}>
                                  {isExpanded ? "Cancel" : <><Zap className="size-3" />Send Now</>}
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* LinkedIn manual-step helper: jump to the profile + copy the note */}
                          {isLinkedInStep && s.sendType === "manual" && !status.done && (
                            <div className="border-t px-3 pb-3 pt-2.5 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <a
                                  href={linkedInHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                                >
                                  <Linkedin className="size-3.5" />
                                  {client.linkedinUrl ? "Open LinkedIn profile" : "Find on LinkedIn"}
                                  <ExternalLink className="size-3" />
                                </a>
                                {s.defaultBody && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => {
                                      navigator.clipboard?.writeText(s.defaultBody);
                                      toast({ title: "Note copied", description: "Paste it into your LinkedIn message." });
                                    }}
                                  >
                                    <Copy className="size-3.5" /> Copy note
                                  </Button>
                                )}
                              </div>
                              {s.defaultBody && (
                                <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                  {s.defaultBody}
                                </div>
                              )}
                              {!client.linkedinUrl && (
                                <p className="text-[11px] text-muted-foreground">
                                  No LinkedIn URL on file — this opens a name search. Add their profile via Edit to link directly.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Inline compose area */}
                          {isExpanded && !status.done && (
                            <div className="border-t px-3 pb-3 pt-2.5 space-y-2">
                              {/* AI generation banner */}
                              {overrideGenerating ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-[hsl(var(--primary))] font-medium">
                                    <Loader2 className="size-3 animate-spin" />
                                    Writing a personalised draft for {firstName}…
                                  </div>
                                  <div className="animate-pulse space-y-1.5">
                                    {isEmail && <div className="h-6 bg-muted rounded w-3/4" />}
                                    <div className="h-3 bg-muted rounded" />
                                    <div className="h-3 bg-muted rounded w-11/12" />
                                    <div className="h-3 bg-muted rounded w-4/5" />
                                    {isEmail && <>
                                      <div className="h-3 bg-muted rounded" />
                                      <div className="h-3 bg-muted rounded w-3/4" />
                                    </>}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* AI badge */}
                                  <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-full px-2 py-0.5">
                                      <Sparkles className="size-2.5" />AI draft · personalised for {firstName}
                                    </span>
                                    <Button size="sm" variant="ghost" className="h-5 text-[10px] text-muted-foreground gap-1 px-1.5"
                                      onClick={() => generateDraft(s)}>
                                      <RefreshCw className="size-2.5" />Regenerate
                                    </Button>
                                  </div>

                                  {!hasContact && (
                                    <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-2.5 py-1.5">
                                      ⚠ No {needsPhone ? "phone number" : "email"} on file for this client.
                                    </p>
                                  )}

                                  {isEmail && (
                                    <>
                                      {senderProfiles.length > 1 ? (
                                        <select
                                          value={overrideCompose.sender || fromEmail}
                                          onChange={e => setOverrideCompose(c => ({ ...c, sender: e.target.value }))}
                                          className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm">
                                          {senderProfiles.map(p => (
                                            <option key={p.email} value={p.email}>{p.name} &lt;{p.email}&gt;</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <p className="text-[11px] text-muted-foreground px-1">From: {fromEmail || <span className="text-amber-600">No sender configured</span>}</p>
                                      )}
                                      <input
                                        value={overrideCompose.subject}
                                        onChange={e => setOverrideCompose(c => ({ ...c, subject: e.target.value }))}
                                        placeholder="Subject line"
                                        className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                                      />
                                    </>
                                  )}

                                  <textarea
                                    rows={isEmail ? 7 : 4}
                                    value={overrideCompose.body}
                                    onChange={e => setOverrideCompose(c => ({ ...c, body: e.target.value }))}
                                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none"
                                  />

                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] text-muted-foreground">
                                      {needsPhone
                                        ? `${client.phone || "no number"} · ${overrideCompose.body.length} chars`
                                        : isEmail ? `To: ${client.email || "no email"}` : ""}
                                    </span>
                                    <Button size="sm" className="h-7 text-xs gap-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)]"
                                      disabled={!hasContact || overrideSending || !(overrideCompose.body.trim())}
                                      onClick={() => sendNow(s)}>
                                      {overrideSending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                                      {isEmail ? "Send Email" : s.sendType === "sms" ? "Send SMS" : "Send WhatsApp"}
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* ── Signing ── */}
              {tab === "signing" && (
                <div className="space-y-5">
                  {/* Pipeline overview */}
                  <div className="rounded-xl bg-muted/40 border p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Franchise Signing Pipeline</h3>
                    <div className="space-y-2">
                      {[
                        {
                          step: 1,
                          label: "Send FDD for Receipt Signature",
                          done: client.fddSent,
                          action: () => { if (confirm("Send FDD Receipt signature request to " + client.email + "?")) sendSignatureMutation.mutate("fdd_receipt"); },
                          buttonLabel: client.fddSent ? "Resend FDD Receipt" : "Send FDD Receipt",
                          pending: sendSignatureMutation.isPending,
                        },
                        {
                          step: 2,
                          label: "Client signs FDD Receipt electronically",
                          done: client.receiptSigned,
                          info: client.receiptSigned ? "Signed ✓" : "Awaiting client signature",
                        },
                        {
                          step: 3,
                          label: "14-day mandatory waiting period",
                          done: canSignAgreement,
                          info: daysRemaining !== null
                            ? (daysRemaining === 0 ? "Waiting period complete ✓" : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`)
                            : (client.receiptSigned ? "Calculating…" : "Starts after FDD is signed"),
                        },
                        {
                          step: 4,
                          label: "Send Franchise Agreement for Signature",
                          done: ["agreement_sent","agreement_signed","wire_received","active"].includes(client.status),
                          action: canSignAgreement
                            ? () => { if (confirm("Send Franchise Agreement signature request to " + client.email + "?")) sendSignatureMutation.mutate("franchise_agreement"); }
                            : undefined,
                          buttonLabel: "Send Agreement",
                          pending: sendSignatureMutation.isPending,
                          locked: !canSignAgreement && !["agreement_sent","agreement_signed","wire_received","active"].includes(client.status),
                        },
                        {
                          step: 5,
                          label: "Client signs Franchise Agreement",
                          done: ["agreement_signed","wire_received","active"].includes(client.status),
                          info: ["agreement_signed","wire_received","active"].includes(client.status) ? "Signed ✓" : "Awaiting client signature",
                        },
                        {
                          step: 6,
                          label: "Client wires franchise fee",
                          done: ["wire_received","active"].includes(client.status),
                          info: ["wire_received","active"].includes(client.status) ? "Wire confirmed ✓" : "Pending",
                        },
                        {
                          step: 7,
                          label: "Send wire receipt + welcome email",
                          done: client.status === "active",
                          action: ["wire_received","active"].includes(client.status)
                            ? () => { if (confirm("Send wire receipt and welcome email to " + client.email + "?")) sendWelcomeMutation.mutate(); }
                            : undefined,
                          buttonLabel: "Send Welcome Email",
                          pending: sendWelcomeMutation.isPending,
                          locked: !["wire_received","active"].includes(client.status),
                        },
                      ].map((step) => (
                        <div key={step.step} className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${step.done ? "bg-green-50 border-green-200" : "bg-white"}`}>
                          <div className={`size-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step.done ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                            {step.done ? "✓" : step.step}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${step.done ? "text-green-800" : "text-foreground"}`}>{step.label}</p>
                            {step.info && <p className={`text-xs mt-0.5 ${step.done ? "text-green-600" : "text-muted-foreground"}`}>{step.info}</p>}
                          </div>
                          {step.action && !step.done && (
                            <Button size="sm" variant={step.locked ? "outline" : "default"} disabled={!!step.locked || step.pending} onClick={step.action} className="shrink-0 gap-1.5 text-xs h-8">
                              {step.pending ? <Loader2 className="size-3 animate-spin" /> : <PenLine className="size-3" />}
                              {step.buttonLabel}
                            </Button>
                          )}
                          {step.locked && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"><Timer className="size-3" /> Locked</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Countdown banner */}
                  {daysRemaining !== null && daysRemaining > 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                      <Timer className="size-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Mandatory Waiting Period</p>
                        <p className="text-sm text-amber-700">
                          <strong>{daysRemaining} day{daysRemaining !== 1 ? "s" : ""}</strong> remaining before the Franchise Agreement can be signed.
                          Federal franchise law requires 14 days between FDD receipt signature and signing the agreement.
                        </p>
                        {fddSignedAt && (
                          <p className="text-xs text-amber-600 mt-1">
                            FDD signed: {fddSignedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} ·
                            Earliest signing date: {new Date(fddSignedAt.getTime() + 14 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Signature history */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Signing History</h3>
                    {signatures.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No signature requests sent yet</p>
                    ) : (
                      <div className="space-y-2">
                        {signatures.map((sig) => (
                          <div key={sig.id} className={`rounded-lg border p-4 ${sig.signedAt ? "bg-green-50 border-green-200" : "bg-white"}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  {sig.signedAt ? <CheckCircle2 className="size-4 text-green-600" /> : <PenLine className="size-4 text-muted-foreground" />}
                                  <p className="text-sm font-semibold">
                                    {sig.documentType === "fdd_receipt" ? "FDD Receipt" : "Franchise Agreement"}
                                  </p>
                                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${sig.signedAt ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                    {sig.signedAt ? "Signed" : "Pending"}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Sent to {sig.sentToEmail} · {new Date(sig.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </p>
                                {sig.signedAt && (
                                  <p className="text-xs text-green-700 mt-0.5">
                                    ✓ Signed by <strong>{sig.signerName}</strong> on {new Date(sig.signedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                                    {sig.signerIp && <span className="text-green-600"> · IP: {sig.signerIp}</span>}
                                  </p>
                                )}
                              </div>
                              <a
                                href={`/sign/${sig.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline shrink-0 flex items-center gap-1"
                              >
                                <ExternalLink className="size-3" /> View
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── LinkedIn ── */}
              {tab === "linkedin" && (
                <div className="space-y-5">
                  {/* Profile link card */}
                  <div className="rounded-xl border bg-[#0077B5]/5 border-[#0077B5]/20 p-4 flex items-center gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#0077B5] text-white">
                      <Linkedin className="size-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{client.fullName}</p>
                      {client.linkedinUrl ? (
                        <p className="text-xs text-muted-foreground truncate">{client.linkedinUrl}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No LinkedIn URL saved — edit the client profile to add one.</p>
                      )}
                    </div>
                    {client.linkedinUrl && (
                      <div className="flex gap-2 shrink-0">
                        <a
                          href={client.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs border-[#0077B5] text-[#0077B5] hover:bg-[#0077B5]/10">
                            <ExternalLink className="size-3.5" /> View Profile
                          </Button>
                        </a>
                        <a
                          href={`https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(client.linkedinUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" className="gap-1.5 text-xs bg-[#0077B5] hover:bg-[#006097]">
                            <Send className="size-3.5" /> Message on LinkedIn
                          </Button>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* How it works note */}
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 space-y-1">
                    <p className="font-semibold">How to use this tab</p>
                    <p>Click <strong>Message on LinkedIn</strong> to open a new message in LinkedIn. After you send a message or receive a reply, log a note below — it will appear in the Timeline so you have a full history of your LinkedIn outreach.</p>
                  </div>

                  {/* Log an interaction */}
                  <div>
                    <p className="text-sm font-medium mb-2">Log a LinkedIn interaction</p>
                    <div className="flex gap-2">
                      <textarea
                        placeholder="e.g. Sent connection request with personalised note about E-2 visa opportunity…"
                        value={linkedinNote}
                        onChange={(e) => setLinkedinNote(e.target.value)}
                        rows={3}
                        className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none"
                      />
                      <Button
                        size="sm"
                        className="self-end"
                        disabled={!linkedinNote.trim() || logLinkedInMutation.isPending}
                        onClick={() => logLinkedInMutation.mutate()}
                      >
                        {logLinkedInMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Log"}
                      </Button>
                    </div>
                  </div>

                  {/* Past LinkedIn interactions from timeline */}
                  {activities.filter(a => a.activityType === "note_added" && String(a.note || "").startsWith("[LinkedIn]")).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Past LinkedIn Interactions</p>
                      <div className="space-y-2">
                        {activities
                          .filter(a => a.activityType === "note_added" && String(a.note || "").startsWith("[LinkedIn]"))
                          .map(a => (
                            <div key={a.id} className="rounded-lg border bg-muted/40 px-3 py-2">
                              <p className="text-sm">{String(a.note || "").replace(/^\[LinkedIn\]\s*/, "")}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── SMS ── */}
              {tab === "sms" && (
                <div className="space-y-5">
                  {!twilioStatus?.smsReady && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      SMS not configured. Add QUO_API_KEY and QUO_PHONE_NUMBER_ID in Secrets to enable SMS via Quo.
                    </div>
                  )}
                  {!client.phone && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      This client has no phone number on file.
                    </div>
                  )}

                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Compose SMS</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Quick Templates</label>
                        <div className="flex flex-wrap gap-2">
                          {smsTemplates.map((t) => (
                            <button key={t.id} onClick={() => applyTemplate(t, setSmsMessage)}
                              className="text-xs rounded-full border px-2.5 py-1 hover:bg-muted transition-colors">
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                          Message to {formatPhone(client.phone) || "(no phone)"}
                        </label>
                        <textarea
                          data-testid="input-sms-body"
                          value={smsMessage}
                          onChange={(e) => setSmsMessage(e.target.value)}
                          rows={4}
                          placeholder="Type your SMS message…"
                          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none"
                        />
                        <p className="text-xs text-muted-foreground mt-1">{smsMessage.length} chars · {Math.ceil(smsMessage.length / 160) || 0} segment{Math.ceil(smsMessage.length / 160) !== 1 ? "s" : ""}</p>
                      </div>
                      <Button disabled={!smsMessage.trim() || !client.phone || smsMutation.isPending}
                        data-testid="button-send-sms"
                        onClick={() => smsMutation.mutate()} className="gap-2">
                        {smsMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                        Send SMS
                      </Button>
                    </div>
                  </Card>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">SMS Conversation</h3>
                      <button onClick={() => refetchSmsHistory()} className="text-xs text-muted-foreground hover:text-foreground">
                        <RefreshCw className="size-3 inline mr-1" />Refresh
                      </button>
                    </div>
                    <div
                      data-testid="sms-conversation-thread"
                      className="rounded-lg border bg-muted/30 p-4 min-h-[280px] max-h-[420px] overflow-y-auto space-y-3"
                    >
                      {smsHistoryLoading ? (
                        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin mr-2" />Loading messages…
                        </div>
                      ) : smsHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <MessageSquare className="size-10 text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">No SMS messages yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Sent and received texts with this contact will appear here.</p>
                        </div>
                      ) : (
                        smsHistory.map((msg) => {
                          const isInbound = msg.direction === "inbound";
                          const failed = msg.status === "failed";
                          return (
                            <div key={msg.id} className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
                              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                                isInbound
                                  ? "bg-white border border-border text-foreground"
                                  : failed
                                    ? "bg-red-50 border border-red-200 text-red-900"
                                    : "bg-[hsl(var(--primary))] text-white"
                              }`}>
                                <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.body}</p>
                                <p className={`text-[10px] mt-1.5 ${
                                  isInbound ? "text-muted-foreground" : failed ? "text-red-600" : "text-white/70"
                                }`}>
                                  {isInbound ? client.fullName.split(" ")[0] : "You"}
                                  {" · "}
                                  {new Date(msg.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  {" "}
                                  {new Date(msg.sentAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                  {failed && " · Failed to send"}
                                  {!failed && !isInbound && msg.status === "delivered" && " · Delivered"}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={smsBottomRef} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── WhatsApp ── */}
              {tab === "whatsapp" && (
                <div className="space-y-4">
                  {!twilioStatus?.whatsappReady && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      WhatsApp not configured. Add META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID in Secrets to enable WhatsApp via Meta Cloud API.
                    </div>
                  )}
                  {!client.phone && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      This client has no phone number on file.
                    </div>
                  )}

                  {/* ── WhatsApp number check ── */}
                  {client.phone && twilioStatus?.whatsappReady && (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Is this number on WhatsApp?</span>
                        <button
                          disabled={waChecking}
                          onClick={async () => {
                            setWaChecking(true);
                            setWaCheckResult(null);
                            try {
                              const res = await apiRequest("POST", "/api/crm/whatsapp-check-number", { phone: client.phone });
                              setWaCheckResult(await res.json());
                            } catch {
                              setWaCheckResult({ onWhatsApp: false, error: "Check failed" });
                            } finally {
                              setWaChecking(false);
                            }
                          }}
                          className="text-xs rounded-full border px-2.5 py-1 bg-white hover:bg-muted transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {waChecking ? <Loader2 className="size-3 animate-spin" /> : <MessageCircle className="size-3" />}
                          {waChecking ? "Checking…" : "Check"}
                        </button>
                      </div>
                      {waCheckResult !== null && (
                        <div className={`text-xs rounded px-2 py-1 font-medium ${waCheckResult.onWhatsApp ? "bg-green-100 text-green-800" : "bg-red-50 text-red-700"}`}>
                          {waCheckResult.onWhatsApp
                            ? `✓ Registered on WhatsApp${waCheckResult.waId ? ` (ID: ${waCheckResult.waId})` : ""}`
                            : `✗ Not on WhatsApp${waCheckResult.error ? ` — ${waCheckResult.error}` : ""}`}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Template guidance ── */}
                  <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-800 space-y-1">
                    <p className="font-semibold">First-time message?</p>
                    <p>Meta requires an approved template for cold outreach. Use one of the template options below — they map to templates you submit in Meta Business Manager. Free-form text only works if they've messaged you within the last 24 hours.</p>
                    <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noopener noreferrer"
                      className="underline font-medium">Submit templates in Meta Business Manager →</a>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Quick Templates</label>
                    <div className="flex flex-wrap gap-2">
                      {waTemplates.map((t) => (
                        <button key={t.id} onClick={() => applyTemplate(t, setWaMessage)}
                          className="text-xs rounded-full border px-2.5 py-1 hover:bg-muted transition-colors">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                      WhatsApp to {formatPhone(client.phone) || "(no phone)"}
                    </label>
                    <textarea
                      value={waMessage}
                      onChange={(e) => setWaMessage(e.target.value)}
                      rows={5}
                      placeholder="Type your WhatsApp message…"
                      className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none"
                    />
                  </div>
                  <Button disabled={!waMessage.trim() || !client.phone || waMutation.isPending}
                    onClick={() => waMutation.mutate()} className="gap-2 bg-green-600 hover:bg-green-700">
                    {waMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
                    Send WhatsApp
                  </Button>
                </div>
              )}

              {/* ── Voicemail ── */}
              {tab === "voicemail" && (
                <div className="space-y-4">
                  {!voicemailStatus?.configured && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Voicemail drops not configured. Set DROPCOWBOY_TOKEN, DROPCOWBOY_HMAC_KEY, and DROPCOWBOY_FROM_NUMBER.
                    </div>
                  )}
                  {!client.phone && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      This client has no phone number on file.
                    </div>
                  )}
                  <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">How it works</p>
                    <p>Provide a publicly accessible URL to an MP3 or WAV audio file. Drop Cowboy will deliver it directly to the prospect's voicemail without the phone ringing.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Sample Scripts</label>
                    <div className="space-y-2">
                      {voicemailScripts.map((s) => (
                        <div key={s.id} className="rounded-lg border p-3">
                          <p className="text-xs font-semibold mb-1">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.script?.replace(/\{\{name\}\}/g, firstName)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Audio File URL</label>
                    <Input
                      placeholder="https://example.com/voicemail.mp3"
                      value={audioUrl}
                      onChange={(e) => setAudioUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Must be a publicly accessible MP3 or WAV URL.</p>
                  </div>
                  <Button disabled={!audioUrl.trim() || !client.phone || voicemailMutation.isPending}
                    onClick={() => voicemailMutation.mutate()} className="gap-2">
                    {voicemailMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
                    Drop Voicemail
                  </Button>
                </div>
              )}

              {/* ── Postcard ── */}
              {tab === "postcard" && (
                <div className="space-y-4">
                  {/* Info banner */}
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
                    <p className="font-semibold mb-1">Lob Physical Postcard</p>
                    <p>Submits a branded 4×6 postcard via Lob's print-and-mail API. Typically arrives in <strong>5–7 business days</strong>. Includes your New Dawn branding, E-2 visa pitch, and Calendly booking link on the back.</p>
                  </div>

                  {/* Address field */}
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Mailing Address</label>
                    <Input
                      data-testid="input-postcard-address"
                      placeholder="123 Main St, City, ST 00000"
                      value={postcardAddress}
                      onChange={(e) => setPostcardAddress(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Format: street, city, state zip — e.g. <em>456 Oak Ave, Dallas, TX 75201</em></p>
                    {!client.address && (
                      <p className="text-xs text-amber-600 mt-1">No address saved on this contact yet. Enter one above to proceed.</p>
                    )}
                  </div>

                  {/* Postcard preview */}
                  <div className="rounded-lg border overflow-hidden text-xs">
                    <div className="bg-slate-900 text-white p-4 text-center">
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">E-2 Visa Investment Opportunity</p>
                      <p className="font-black text-base leading-snug">Own a U.S. Business.<br/>Secure Your E-2 Visa.</p>
                      <p className="text-slate-400 mt-1 text-[11px]">A proven $225K franchise pathway in El Paso, Texas.</p>
                    </div>
                    <div className="bg-white p-4 text-slate-800 space-y-2">
                      <p className="text-[11px] text-slate-500">Dear {client.fullName.split(" ")[0]},</p>
                      <p className="text-[11px]">New Dawn Franchising specializes in E-2 visa compliant property management franchises in Texas.</p>
                      <ul className="text-[11px] space-y-0.5">
                        <li>✅ $225K minimum — fully E-2 compliant</li>
                        <li>✅ Funds held in escrow — full refund if visa denied</li>
                        <li>✅ Forbes 30 Under 30 leadership</li>
                      </ul>
                      <p className="text-[11px] text-blue-700 font-medium">calendly.com/dylan-newdawnfranchising</p>
                    </div>
                  </div>

                  {/* Send button */}
                  <Button
                    data-testid="button-send-postcard"
                    disabled={!postcardAddress.trim() || postcardMutation.isPending}
                    onClick={() => postcardMutation.mutate()}
                    className="gap-2"
                  >
                    {postcardMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
                    Send Postcard via Lob
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Requires a <code className="font-mono">LOB_API_KEY</code> secret. Without it, the send is logged in demo mode but nothing is physically mailed.
                  </p>
                </div>
              )}

              {/* ── Email ── */}
              {tab === "email" && (
                <div className="space-y-5">
                  {/* Composer */}
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Compose Email</h3>
                    <div className="space-y-3">
                      {/* Sender selector */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">From</label>
                        {senderProfiles.length === 0 ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                            No senders configured. Add a Gmail App Password as an environment variable
                            (e.g. <code className="font-mono">GMAIL_APP_PASSWORD</code> for franchising@ or
                            <code className="font-mono"> GMAIL_APP_PASSWORD_DYLAN</code> for dylan@).
                          </div>
                        ) : (
                          <div className="relative">
                            <select
                              data-testid="select-email-sender"
                              value={emailForm.fromEmail}
                              onChange={(e) => setEmailForm({ ...emailForm, fromEmail: e.target.value })}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm appearance-none pr-8 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="">— Select sender —</option>
                              {senderProfiles.map(p => (
                                <option key={p.email} value={p.email}>{p.name} &lt;{p.email}&gt;</option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Template picker */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Template (optional)</label>
                        <div className="relative">
                          <select
                            data-testid="select-email-template"
                            value={emailForm.selectedTemplate}
                            onChange={(e) => {
                              const tpl = emailTemplates.find(t => t.id === e.target.value);
                              setEmailForm({
                                ...emailForm,
                                selectedTemplate: e.target.value,
                                subject: tpl ? tpl.subject : emailForm.subject,
                                bodyHtml: tpl ? tpl.bodyHtml : emailForm.bodyHtml,
                              });
                            }}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm appearance-none pr-8 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="">— Blank / custom email —</option>
                            {emailTemplates.map(t => (
                              <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Templates use <code>{"{{name}}"}</code> and <code>{"{{senderName}}"}</code> placeholders, auto-filled on send.
                        </p>
                      </div>

                      {/* Signature-request template: show info box, hide editors */}
                      {emailTemplates.find(t => t.id === emailForm.selectedTemplate)?.signatureRequest ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
                          <p className="text-sm font-semibold text-amber-800">📋 FDD Receipt — Signature Request</p>
                          <p className="text-xs text-amber-700">
                            Clicking <strong>Send Signature Request</strong> will:
                          </p>
                          <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                            <li>Send a cover email to <strong>{client.email}</strong> explaining the process.</li>
                            <li>Send a second email with the secure signing link.</li>
                            <li>Record both emails in the Email History tab.</li>
                            <li>Mark the client's FDD as <em>sent</em> and update the pipeline stage.</li>
                          </ul>
                          <p className="text-[11px] text-amber-600 mt-1">The subject and body are fixed by the signing workflow — they cannot be edited here.</p>
                        </div>
                      ) : (
                        <>
                          {/* Subject */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Subject</label>
                            <Input
                              data-testid="input-email-subject"
                              value={emailForm.subject}
                              onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                              placeholder="Email subject…"
                            />
                          </div>

                          {/* Body */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-medium text-muted-foreground">Message</label>
                              <button
                                type="button"
                                onClick={() => setEmailPreview(!emailPreview)}
                                className="text-xs text-muted-foreground hover:text-foreground underline"
                              >
                                {emailPreview ? "Edit" : "Preview"}
                              </button>
                            </div>
                            {emailPreview ? (
                              <div
                                className="rounded-lg border bg-white p-3 text-sm min-h-[160px] overflow-auto prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{
                                  __html: emailForm.bodyHtml
                                    .replace(/\{\{name\}\}/g, client.fullName)
                                    .replace(/\{\{senderName\}\}/g, senderProfiles.find(s => s.email === emailForm.fromEmail)?.name || emailForm.fromEmail || "New Dawn Franchising")
                                }}
                              />
                            ) : (
                              <textarea
                                data-testid="input-email-body"
                                value={emailForm.bodyHtml}
                                onChange={(e) => setEmailForm({ ...emailForm, bodyHtml: e.target.value })}
                                rows={8}
                                placeholder="Write your email here… You can use HTML or plain text. Templates use {{name}} and {{senderName}} placeholders."
                                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono text-xs"
                              />
                            )}
                          </div>
                        </>
                      )}

                      {/* To display */}
                      <div className="text-xs text-muted-foreground">
                        Sending to: <span className="font-medium text-foreground">{client.email}</span>
                        {" · "}Open tracking: <span className="text-green-600 font-medium">On</span>
                      </div>

                      {emailTemplates.find(t => t.id === emailForm.selectedTemplate)?.signatureRequest ? (
                        <Button
                          data-testid="button-send-signature-request"
                          onClick={() => { if (confirm("Send FDD Receipt signature request to " + client.email + "?")) sendSignatureMutation.mutate("fdd_receipt"); }}
                          disabled={sendSignatureMutation.isPending || !emailForm.fromEmail}
                          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          {sendSignatureMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                          Send Signature Request
                        </Button>
                      ) : (
                        <Button
                          data-testid="button-send-email"
                          onClick={() => sendEmailMutation.mutate()}
                          disabled={sendEmailMutation.isPending || !emailForm.fromEmail || !emailForm.subject || !emailForm.bodyHtml}
                          className="gap-2"
                        >
                          {sendEmailMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                          Send Email
                        </Button>
                      )}
                    </div>
                  </Card>

                  {/* Email history */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Email History</h3>
                      <button onClick={() => refetchEmails()} className="text-xs text-muted-foreground hover:text-foreground">
                        <RefreshCw className="size-3 inline mr-1" />Refresh
                      </button>
                    </div>
                    {directEmails.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Mail className="size-10 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No email activity yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {directEmails.map(em => {
                          const isInbound = em.direction === "inbound";
                          return (
                          <Card key={em.id} className={`p-3 ${isInbound ? "border-l-4 border-l-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5" : ""}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium truncate">{em.subject}</span>
                                  {isInbound ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-full font-medium">
                                      <Mail className="size-3" /> Reply received
                                    </span>
                                  ) : em.status === "opened" ? (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="size-3" /> Opened{em.openCount > 1 ? ` ×${em.openCount}` : ""}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Delivered</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {isInbound ? "From" : "Sent from"}: {em.fromEmail}
                                  {" · "}
                                  {new Date(em.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                                  {!isInbound && em.openedAt && ` · Opened ${new Date(em.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                                </div>
                                {isInbound && (em.bodyText || em.bodyHtml) && (
                                  <p className="mt-1.5 text-xs text-foreground/80 line-clamp-3 whitespace-pre-wrap">
                                    {(em.bodyText || em.bodyHtml.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 280)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Deliverability guidance */}
                  <Card className="p-4 bg-blue-50 border-blue-200">
                    <h4 className="text-xs font-semibold text-blue-800 mb-2">Email Deliverability Checklist</h4>
                    <ul className="text-xs text-blue-700 space-y-1.5">
                      <li>✅ <strong>SPF</strong> — Automatic with Google Workspace (no action needed)</li>
                      <li>✅ <strong>DKIM</strong> — Authenticated in Google Workspace (DNS TXT key published)</li>
                      <li>✅ <strong>DMARC</strong> — DNS TXT record active: <code className="bg-blue-100 px-1 rounded font-mono">v=DMARC1; p=none; rua=mailto:postmaster@newdawnfranchising.com</code></li>
                      <li>✅ <strong>Open tracking</strong> — Enabled via invisible pixel in every email</li>
                      <li>✅ <strong>Primary sender + inbox sync</strong> — <code className="bg-blue-100 px-1 rounded font-mono">GMAIL_APP_PASSWORD_FRANCHISING</code> set; franchising@ sends + two-way reply sync active</li>
                    </ul>
                  </Card>
                </div>
              )}

              {/* ── Documents ── */}
              {tab === "documents" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{documents.length} document{documents.length !== 1 ? "s" : ""} attached</p>
                    <div>
                      <input ref={fileInputRef} type="file" className="hidden"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                        onChange={handleFileUpload} />
                      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1">
                        <Plus className="size-4" /> Upload Document
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Supported: PDF, DOCX, DOC, images, TXT · Max 6MB</p>
                  {documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Paperclip className="size-10 text-muted-foreground/40 mb-2" />
                      <p className="text-muted-foreground text-sm">No documents yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                          <FileText className="size-8 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{doc.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {(doc.fileSize / 1024).toFixed(1)} KB · {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <a href={`/api/crm/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><Download className="size-4" /></Button>
                            </a>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                              onClick={() => { if (confirm("Delete this document?")) deleteDocMutation.mutate(doc.id); }}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm capitalize">{value}</p>
    </div>
  );
}
