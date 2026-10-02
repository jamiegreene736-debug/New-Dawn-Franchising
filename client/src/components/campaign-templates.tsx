import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type CampaignTemplate, CAMPAIGN_TEMPLATE_GUIDANCE } from "@shared/campaign-templates";

type TemplateLibrary = { templates: CampaignTemplate[]; guidance: typeof CAMPAIGN_TEMPLATE_GUIDANCE };

export function CampaignTemplates({ onCreated }: { onCreated: (id: string) => void }) {
  const { data, isLoading, isError, refetch } = useQuery<TemplateLibrary>({ queryKey: ["/api/crm/campaign-templates"] });
  const [previewId, setPreviewId] = useState("broker-introductions");
  const [create, setCreate] = useState<{ template: CampaignTemplate; requestKey: string } | null>(null);
  const [name, setName] = useState("");
  const [includeSms, setIncludeSms] = useState(true);
  const { toast } = useToast();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!create) throw new Error("Choose a template first");
      const res = await apiRequest("POST", `/api/crm/campaign-templates/${create.template.id}/create`, { name: name.trim(), includeSms, requestKey: create.requestKey });
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: result => {
      qc.invalidateQueries({ queryKey: ["/api/crm/campaigns"] });
      setCreate(null);
      toast({ title: "Paused draft created", description: "Review the copy and audience in the campaign editor before activation." });
      onCreated(result.id);
    },
    onError: (error: Error) => toast({ title: "Draft could not be created", description: error.message, variant: "destructive" }),
  });

  if (isLoading) return <p role="status" className="py-8 flex gap-2"><Loader2 className="size-4 animate-spin" />Loading templates…</p>;
  if (isError || !data) return <div role="alert">Could not load templates. <Button variant="outline" onClick={() => refetch()}>Retry</Button></div>;
  const template = data.templates.find(t => t.id === previewId) || data.templates[0];
  const guidance = data.guidance;

  return <div className="space-y-6" data-testid="campaign-template-library">
    <div><h3 className="text-xl font-semibold flex gap-2 items-center"><BookOpen className="size-5" />Campaign templates</h3>
      <p className="text-sm text-muted-foreground mt-1">Three complete email and text sequences. Preview the content, then create an editable paused draft.</p>
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      {data.templates.map(t => <Card key={t.id} className={`p-4 space-y-3 ${template?.id === t.id ? "border-primary" : ""}`}>
        <h4 className="font-semibold">{t.name}</h4><p className="text-sm text-muted-foreground">{t.description}</p>
        <p className="text-xs text-muted-foreground">4 emails · 2 optional texts · 21 days</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" aria-pressed={template?.id === t.id} onClick={() => setPreviewId(t.id)} data-testid={`preview-template-${t.id}`}>Preview sequence</Button>
          <Button size="sm" onClick={() => { setName(t.name); setIncludeSms(true); setCreate({ template: t, requestKey: crypto.randomUUID() }); }} data-testid={`use-template-${t.id}`}>Use template</Button>
        </div>
      </Card>)}
    </div>
    {template && <Card className="p-4 sm:p-6 space-y-4" data-testid="template-preview">
      <div><h4 className="text-lg font-semibold">{template.name}</h4><p className="text-sm mt-1">Goal: {template.goal}</p><p className="text-sm text-muted-foreground mt-2">{template.enrollment}</p></div>
      <p className="text-sm text-muted-foreground">{guidance.cadence}</p>
      <ol className="space-y-3">
        {template.steps.map((s, i) => <li key={i} className="border rounded-lg p-3">
          <details open={i === 0}>
            <summary className="cursor-pointer text-sm font-medium">Day {s.day} · {s.channel === "email" ? "Email" : "Optional text"} · {s.name}</summary>
            <div className="space-y-2 pt-3 text-sm">
              <p className="text-muted-foreground">{s.purpose}</p>
              {s.channel === "email" && <><p><strong>Subject:</strong> {s.subject}</p><p className="text-xs text-muted-foreground">Alternatives: {s.alternateSubjects.join(" · ")}</p><p><strong>Preview:</strong> {s.previewText}</p></>}
              <p className="whitespace-pre-wrap break-words bg-muted/40 rounded-md p-3">{s.body}</p>
              <p className="text-xs text-muted-foreground">{s.channel === "sms" ? "Requires recorded written marketing permission. Otherwise this step is skipped." : "The campaign includes a commercial-message disclosure. The sender adds the postal address and unsubscribe footer."}</p>
            </div>
          </details>
        </li>)}
      </ol>
      <p className="text-sm text-muted-foreground">{guidance.stops}</p>
      <details><summary className="cursor-pointer text-sm font-medium">Reply resources and introduction notes</summary>
        <p className="text-xs text-muted-foreground mt-3">Use these after reviewing a reply. Replace the bracketed details before sharing. An introduction requires the client's permission.</p>
        <div className="mt-3 space-y-3">{guidance.replyResources.filter(r => r.audiences.includes(template.audience)).map(r => <div key={r.title}><h5 className="text-sm font-medium">{r.title}</h5><p className="whitespace-pre-wrap break-words bg-muted/40 rounded-md p-3 mt-2 text-sm">{r.body}</p></div>)}</div>
      </details>
    </Card>}
    <Card className="p-4 sm:p-6 space-y-4">
      <h4 className="font-semibold">Email quality and sending guide</h4>
      <p className="text-sm text-muted-foreground">{guidance.quality}</p>
      <div className="grid md:grid-cols-2 gap-5 text-sm"><div><h5 className="font-medium mb-2">Avoid or review</h5><ul className="list-disc pl-5 space-y-1">{guidance.avoid.map(v => <li key={v}>{v}</li>)}</ul></div>
        <div><h5 className="font-medium mb-2">Prefer</h5><ul className="list-disc pl-5 space-y-1">{guidance.prefer.map(v => <li key={v}>{v}</li>)}</ul></div></div>
      <p className="text-sm">{guidance.timing}</p><p className="text-sm">{guidance.measurement}</p>
      <details><summary className="cursor-pointer text-sm font-medium">Research sources · reviewed {guidance.researchedAt}</summary><ul className="space-y-3 mt-3 text-sm">{guidance.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{s.title}</a><p className="text-muted-foreground">{s.finding}</p></li>)}</ul></details>
    </Card>
    <SmsPermissions />
    <Dialog open={!!create} onOpenChange={open => { if (!open && !mutation.isPending) setCreate(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Create campaign from template</DialogTitle><DialogDescription>Creates a paused draft with editable steps. Choose contacts and review sending readiness in the campaign editor.</DialogDescription></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="template-campaign-name">Campaign name</Label><Input id="template-campaign-name" maxLength={150} required value={name} disabled={mutation.isPending} onChange={e => setName(e.target.value)} data-testid="template-campaign-name" /></div>
          <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={includeSms} disabled={mutation.isPending} onChange={e => setIncludeSms(e.target.checked)} data-testid="template-include-sms" /><span>Include the two optional text steps. Only recipients with recorded written marketing permission can receive them.</span></label>
          <p className="text-xs text-muted-foreground">{includeSms ? "4 emails + 2 optional texts" : "4 emails"} · No calling or LinkedIn steps</p>
          <Button type="submit" disabled={!name.trim() || mutation.isPending} data-testid="create-template-campaign">{mutation.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Mail className="size-4 mr-2" />}Create paused draft</Button>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}

interface PermissionRow { id: string; email: string; phone: string; consented_at: string; timezone: string; revoked_at: string | null }

function SmsPermissions() {
  const [open, setOpen] = useState(false);
  const empty = { email: "", phone: "", consentedAt: "", source: "", disclosure: "", evidence: "", timezone: "" };
  const [form, setForm] = useState(empty);
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = ["/api/crm/sms-permissions"];
  const { data: permissions = [], isError, isLoading, refetch } = useQuery<PermissionRow[]>({ queryKey, enabled: open });
  const save = useMutation({
    mutationFn: async () => {
      const consentedAt = new Date(form.consentedAt).toISOString();
      const res = await apiRequest("POST", "/api/crm/sms-permissions", { ...form, consentedAt }); return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey }); setForm(empty); toast({ title: "Text permission recorded" }); },
    onError: (error: Error) => toast({ title: "Permission could not be saved", description: error.message, variant: "destructive" }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/crm/sms-permissions/${id}/revoke`),
    onSuccess: () => { qc.invalidateQueries({ queryKey }); toast({ title: "Text permission revoked" }); },
    onError: (error: Error) => toast({ title: "Could not revoke permission", description: error.message, variant: "destructive" }),
  });
  const fields = [
    ["email", "Recipient email", "email", "person@example.com"], ["phone", "Consented phone number", "tel", "+14155552671"],
    ["consentedAt", "Date consent was given (your local time)", "datetime-local", ""], ["timezone", "Recipient timezone", "text", "America/New_York"],
    ["source", "Where consent was collected", "text", "Form URL or signed-record reference"],
  ] as const;

  return <Card className="p-4 sm:p-6"><details onToggle={e => setOpen(e.currentTarget.open)}>
    <summary className="cursor-pointer font-semibold"><Smartphone className="size-4 inline mr-2" />Text permissions</summary>
    <p className="text-sm text-muted-foreground mt-3">{CAMPAIGN_TEMPLATE_GUIDANCE.sms}</p>
    <p className="text-sm mt-2">Record permission already given by the recipient. This form does not obtain consent or remove any suppression.</p>
    <form className="space-y-3 mt-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="grid gap-3 sm:grid-cols-2">{fields.map(([key,label,type,placeholder]) => <div className="space-y-1" key={key}><Label htmlFor={`permission-${key}`}>{label}</Label><Input id={`permission-${key}`} type={type} placeholder={placeholder} required value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}</div>
      <div className="space-y-1"><Label htmlFor="permission-disclosure">Exact disclosure the recipient agreed to</Label><Textarea id="permission-disclosure" required minLength={20} maxLength={2000} value={form.disclosure} onChange={e => setForm({ ...form, disclosure: e.target.value })} placeholder="Must identify New Dawn and the marketing text subject; paste the actual disclosure." /></div>
      <div className="space-y-1"><Label htmlFor="permission-evidence">Evidence of the recipient's written agreement</Label><Textarea id="permission-evidence" required minLength={20} maxLength={2000} value={form.evidence} onChange={e => setForm({ ...form, evidence: e.target.value })} placeholder="Record reference and what the recipient agreed to. Do not enter sensitive client documents." /></div>
      <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Record existing permission"}</Button>
    </form>
    {isLoading && <p role="status" className="text-sm mt-4">Loading permissions…</p>}
    {isError && <p role="alert" className="mt-4 text-sm">Could not load permissions. <button className="underline" onClick={() => refetch()}>Retry</button></p>}
    {!isLoading && !isError && <div className="mt-4 space-y-2">{permissions.length === 0 ? <p className="text-sm text-muted-foreground">No recorded text permissions.</p> : permissions.map(p => <div key={p.id} className="border rounded-md p-3 flex flex-wrap gap-2 items-center justify-between text-xs"><span className="break-all">{p.email} · {p.phone} · {p.timezone} · {p.revoked_at ? "Revoked" : "Recorded"}</span>{!p.revoked_at && <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(p.id)}>Revoke</Button>}</div>)}</div>}
  </details></Card>;
}
