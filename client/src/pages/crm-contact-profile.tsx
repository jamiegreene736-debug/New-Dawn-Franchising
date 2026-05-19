import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Mail, Phone, Linkedin, Globe, Edit2, Save, X, Plus,
  CheckCircle2, Circle, Loader2, ExternalLink, Tag, ChevronDown,
  FileText, PhoneCall, MessageSquare, MousePointer, RefreshCw,
} from "lucide-react";
import { CrmLayout } from "@/components/crm-layout";
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

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#6b7280";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 96 96" className="rotate-[-90deg]">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle cx="48" cy="48" r={radius} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
      </svg>
      <div className="mt-[-80px] flex h-[80px] w-[96px] items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
      </div>
      <span className="text-xs text-muted-foreground mt-1">Lead Score</span>
    </div>
  );
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  email_sent: <Mail className="size-4 text-blue-500" />,
  email_opened: <Mail className="size-4 text-green-500" />,
  email_clicked: <MousePointer className="size-4 text-purple-500" />,
  email_replied: <MessageSquare className="size-4 text-teal-500" />,
  email_bounced: <Mail className="size-4 text-red-500" />,
  status_changed: <RefreshCw className="size-4 text-orange-500" />,
  note_added: <FileText className="size-4 text-gray-500" />,
  call_logged: <PhoneCall className="size-4 text-indigo-500" />,
  sms_sent: <MessageSquare className="size-4 text-violet-500" />,
  tag_added: <Tag className="size-4 text-amber-500" />,
};

function activityDescription(act: { activityType: string; metadata: unknown }): string {
  const meta = (act.metadata as Record<string, unknown>) || {};
  switch (act.activityType) {
    case "email_sent": return `Email sent: ${meta.subject || meta.campaignName || ""}`;
    case "email_opened": return `Opened: ${meta.subject || meta.campaignName || ""}`;
    case "email_clicked": return `Clicked: ${String(meta.url || "")}`;
    case "email_replied": return "Replied to email";
    case "email_bounced": return "Email bounced";
    case "status_changed": return `Status: ${meta.oldStatus || ""} → ${meta.newStatus || meta.pipelineStage || ""}`;
    case "note_added": return String(meta.note || "Note added");
    case "call_logged": return `Call logged: ${meta.summary || ""}`;
    case "sms_sent": return "SMS sent";
    case "tag_added": return `Tag added: ${meta.tag || ""}`;
    default: return act.activityType.replace(/_/g, " ");
  }
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  firmName?: string | null;
  jobTitle?: string | null;
  personaType?: string | null;
  country?: string | null;
  city?: string | null;
  source?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  leadScore: number;
  status: string;
  tags: string[];
  notes?: string | null;
  gdprNote?: string | null;
  consentSource?: string | null;
  referredByContactId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  contactId: string;
  activityType: string;
  metadata: unknown;
  createdAt: string;
}

interface Task {
  id: string;
  contactId: string;
  title: string;
  dueDate?: string | null;
  completed: boolean;
  createdAt: string;
}

export default function CrmContactProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [noteText, setNoteText] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");

  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: [`/api/contacts/${id}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${id}`);
      return res.json();
    },
  });

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: [`/api/contacts/${id}/activities`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${id}/activities`);
      return res.json();
    },
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: [`/api/contacts/${id}/tasks`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/contacts/${id}/tasks`);
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Contact>) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}/activities`] });
      setEditing(false);
      toast({ title: "Contact updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const rescoreMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contacts/${id}/rescore`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}`] });
      toast({ title: "Score recalculated" });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const res = await apiRequest("POST", `/api/contacts/${id}/activities`, {
        activityType: "note_added",
        metadata: { note },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}/activities`] });
      setNoteText("");
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      if (!contact) return;
      const tags = Array.from(new Set([...(contact.tags || []), tag]));
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, { tags });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}`] });
      setNewTag("");
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      if (!contact) return;
      const tags = (contact.tags || []).filter((t) => t !== tag);
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, { tags });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}`] }),
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/contacts/${id}/tasks`, {
        title: newTaskTitle,
        dueDate: newTaskDate || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}/tasks`] });
      setNewTaskTitle("");
      setNewTaskDate("");
      toast({ title: "Task created" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${taskId}`, { completed });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}/tasks`] }),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}/activities`] });
    },
  });

  const pipelineMutation = useMutation({
    mutationFn: async (stage: string) => {
      const res = await apiRequest("POST", "/api/pipeline", { contactId: id, stage });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}/activities`] });
      toast({ title: "Pipeline stage updated" });
    },
  });

  if (isLoading) {
    return (
      <CrmLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </CrmLayout>
    );
  }

  if (!contact) {
    return (
      <CrmLayout>
        <div className="p-8 text-center text-muted-foreground">Contact not found</div>
      </CrmLayout>
    );
  }

  const startEdit = () => {
    setEditForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      firmName: contact.firmName,
      jobTitle: contact.jobTitle,
      personaType: contact.personaType,
      country: contact.country,
      city: contact.city,
      linkedinUrl: contact.linkedinUrl,
      websiteUrl: contact.websiteUrl,
      notes: contact.notes,
      gdprNote: contact.gdprNote,
      consentSource: contact.consentSource,
    });
    setEditing(true);
  };

  const openTasks = tasks.filter((t) => !t.completed);
  const doneTasks = tasks.filter((t) => t.completed);

  return (
    <CrmLayout>
      <div className="p-6">
        {/* Back nav */}
        <button onClick={() => setLocation("/crm/contacts")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="size-4" /> Back to Contacts
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_280px] gap-6">

          {/* ── LEFT PANEL ───────────────────────────────── */}
          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              {/* Score gauge */}
              <div className="flex justify-center pt-2">
                <ScoreGauge score={contact.leadScore} />
              </div>

              {/* Name/title */}
              {editing ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="First" value={editForm.firstName || ""} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
                    <Input placeholder="Last" value={editForm.lastName || ""} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
                  </div>
                  <Input placeholder="Job title" value={editForm.jobTitle || ""} onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })} />
                  <Input placeholder="Firm" value={editForm.firmName || ""} onChange={(e) => setEditForm({ ...editForm, firmName: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Country" value={editForm.country || ""} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
                    <Input placeholder="City" value={editForm.city || ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl font-bold">{contact.firstName} {contact.lastName}</h2>
                  {contact.jobTitle && <p className="text-sm text-muted-foreground">{contact.jobTitle}</p>}
                  {contact.firmName && <p className="text-sm font-medium">{contact.firmName}</p>}
                  {(contact.city || contact.country) && (
                    <p className="text-sm text-muted-foreground">{[contact.city, contact.country].filter(Boolean).join(", ")}</p>
                  )}
                </div>
              )}

              {/* Contact info */}
              <div className="space-y-2 text-sm">
                {editing ? (
                  <>
                    <Input placeholder="Email" type="email" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    <Input placeholder="Phone" value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                    <Input placeholder="LinkedIn URL" value={editForm.linkedinUrl || ""} onChange={(e) => setEditForm({ ...editForm, linkedinUrl: e.target.value })} />
                    <Input placeholder="Website" value={editForm.websiteUrl || ""} onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })} />
                  </>
                ) : (
                  <>
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-[hsl(var(--primary))] hover:underline">
                        <Mail className="size-3.5" /> {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-[hsl(var(--primary))] hover:underline">
                        <Phone className="size-3.5" /> {contact.phone}
                      </a>
                    )}
                    {contact.linkedinUrl && (
                      <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[hsl(var(--primary))] hover:underline">
                        <Linkedin className="size-3.5" /> LinkedIn <ExternalLink className="size-3" />
                      </a>
                    )}
                    {contact.websiteUrl && (
                      <a href={contact.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[hsl(var(--primary))] hover:underline">
                        <Globe className="size-3.5" /> Website <ExternalLink className="size-3" />
                      </a>
                    )}
                  </>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Status</label>
                <div className="relative">
                  <select value={contact.status} onChange={(e) => statusMutation.mutate(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm appearance-none">
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 text-muted-foreground" />
                </div>
              </div>

              {/* Persona */}
              {editing ? (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Persona</label>
                  <select value={editForm.personaType || ""} onChange={(e) => setEditForm({ ...editForm, personaType: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                    {Object.entries(PERSONA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ) : contact.personaType ? (
                <p className="text-xs text-muted-foreground">{PERSONA_LABELS[contact.personaType] || contact.personaType}</p>
              ) : null}

              {/* Tags */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Tags</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(contact.tags || []).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                      {tag}
                      <button onClick={() => removeTagMutation.mutate(tag)} className="hover:text-red-500"><X className="size-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input placeholder="Add tag…" value={newTag} onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && newTag.trim()) addTagMutation.mutate(newTag.trim()); }}
                    className="h-7 text-xs" />
                  <Button size="sm" variant="ghost" className="h-7 px-2"
                    onClick={() => { if (newTag.trim()) addTagMutation.mutate(newTag.trim()); }}>
                    <Plus className="size-3" />
                  </Button>
                </div>
              </div>

              {/* Action buttons */}
              {editing ? (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => updateMutation.mutate(editForm)} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : <Save className="size-4 mr-1" />}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="size-4" /></Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={startEdit}>
                    <Edit2 className="size-4 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rescoreMutation.mutate()} disabled={rescoreMutation.isPending}>
                    <RefreshCw className={`size-4 ${rescoreMutation.isPending ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              )}

              {/* Pipeline */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Pipeline Stage</label>
                <div className="relative">
                  <select defaultValue="" onChange={(e) => { if (e.target.value) pipelineMutation.mutate(e.target.value); }}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm appearance-none">
                    <option value="" disabled>Move to stage…</option>
                    {["new", "contacted", "responded", "call_scheduled", "active_partner", "closed"].map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-2.5 size-4 text-muted-foreground" />
                </div>
              </div>
            </Card>
          </div>

          {/* ── CENTER PANEL: Activity Timeline ──────────── */}
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Activity Timeline</h3>
              {/* Add Note */}
              <div className="mb-5 flex gap-2">
                <textarea
                  placeholder="Add a note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none"
                />
                <Button size="sm" disabled={!noteText.trim()} onClick={() => addNoteMutation.mutate(noteText.trim())}>
                  {addNoteMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add"}
                </Button>
              </div>

              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((act) => (
                    <div key={act.id} data-testid={`activity-${act.id}`} className="flex gap-3 items-start">
                      <div className="mt-0.5 shrink-0">
                        {ACTIVITY_ICONS[act.activityType] || <Circle className="size-4 text-gray-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activityDescription(act)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(act.createdAt).toLocaleString("en-US", {
                            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ── RIGHT PANEL ──────────────────────────────── */}
          <div className="space-y-4">
            {/* Tasks */}
            <Card className="p-5">
              <h3 className="font-semibold mb-3">Tasks</h3>
              <div className="space-y-2 mb-3">
                {openTasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">No open tasks</p>
                )}
                {openTasks.map((t) => (
                  <div key={t.id} data-testid={`task-${t.id}`} className="flex items-start gap-2">
                    <button onClick={() => completeTaskMutation.mutate({ taskId: t.id, completed: true })}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-green-500">
                      <Circle className="size-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{t.title}</p>
                      {t.dueDate && (
                        <p className={`text-xs ${new Date(t.dueDate) < new Date() ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          Due: {new Date(t.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {doneTasks.length > 0 && (
                  <div className="pt-2 border-t">
                    {doneTasks.slice(0, 3).map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                        <span className="text-xs line-through">{t.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Add task */}
              <div className="space-y-2 border-t pt-3">
                <Input data-testid="input-task-title" placeholder="Task title…" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="h-8 text-sm" />
                <Input data-testid="input-task-date" type="date" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} className="h-8 text-sm" />
                <Button size="sm" className="w-full" disabled={!newTaskTitle.trim()} onClick={() => createTaskMutation.mutate()}>
                  <Plus className="size-4 mr-1" /> Add Task
                </Button>
              </div>
            </Card>

            {/* Metadata */}
            <Card className="p-5 space-y-3">
              <h3 className="font-semibold">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <span className="font-medium">{contact.source || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Added</span>
                  <span>{new Date(contact.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{new Date(contact.updatedAt).toLocaleDateString()}</span>
                </div>
                {contact.consentSource && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Consent</span>
                    <span>{contact.consentSource}</span>
                  </div>
                )}
              </div>
              {editing && (
                <div className="space-y-2 border-t pt-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">GDPR Note</label>
                    <textarea value={editForm.gdprNote || ""} onChange={(e) => setEditForm({ ...editForm, gdprNote: e.target.value })}
                      rows={2} placeholder="GDPR note…" className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Consent Source</label>
                    <Input value={editForm.consentSource || ""} onChange={(e) => setEditForm({ ...editForm, consentSource: e.target.value })} className="text-xs h-8" />
                  </div>
                </div>
              )}
              {contact.notes && !editing && (
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                </div>
              )}
              {editing && (
                <div className="border-t pt-3">
                  <label className="text-xs font-semibold text-muted-foreground">Notes</label>
                  <textarea value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={3} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm resize-none" />
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </CrmLayout>
  );
}
