import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  RefreshCw,
  Ban,
  Mail,
  Activity,
  ChevronDown,
  FlaskConical,
  Send,
  Inbox,
  Megaphone,
  Loader2,
} from "lucide-react";

// ─── Types (mirror server/deliverability-service.ts) ──────────────────────────
type AuthStatus = "pass" | "warn" | "fail" | "info";
interface AuthCheck {
  key: string;
  label: string;
  status: AuthStatus;
  summary: string;
  value?: string;
  details?: string[];
  fix?: string;
}
interface AuthReport {
  domain: string;
  checkedAt: string;
  checks: AuthCheck[];
  score: number;
}
interface SendWindow {
  attempted: number;
  bounced: number;
  failed: number;
  opened: number;
  clicked: number;
  bounceRate: number;
  openRate: number;
  clickRate: number;
}
interface DeliverabilityMetrics {
  generatedAt: string;
  sendingDomain: string;
  volume: { last24h: SendWindow; last7d: SendWindow; last30d: SendWindow; allTime: SendWindow };
  suppression: { total: number; last7: number; last30: number; byReason: { reason: string; count: number }[] };
  topBounceDomains: { domain: string; attempted: number; bounced: number; rate: number }[];
  enrollments: { total: number; replied: number; bounced: number; replyRate: number };
  config: { dailyCap: number; hourlyCap: number; domainGapSeconds: number; sendersConfigured: number; sendersTotal: number; sendingModel: string };
  gaps: { key: string; ok: boolean; label: string }[];
}
type ChecklistStatus = "todo" | "in_progress" | "done" | "not_applicable";
interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  detail: string;
  priority: "critical" | "high" | "medium" | "low";
  owner: "you" | "dev" | "both";
  effort: "low" | "medium" | "high";
  impact: "critical" | "high" | "medium" | "low";
  status: ChecklistStatus;
  notes: string | null;
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const AUTH_STYLE: Record<AuthStatus, { ring: string; text: string; bg: string; Icon: any; word: string }> = {
  pass: { ring: "border-emerald-200", text: "text-emerald-700", bg: "bg-emerald-50", Icon: CheckCircle2, word: "Pass" },
  warn: { ring: "border-amber-200", text: "text-amber-700", bg: "bg-amber-50", Icon: AlertTriangle, word: "Warning" },
  fail: { ring: "border-red-200", text: "text-red-700", bg: "bg-red-50", Icon: XCircle, word: "Action needed" },
  info: { ring: "border-slate-200", text: "text-slate-600", bg: "bg-slate-50", Icon: Info, word: "Info" },
};

const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};
const OWNER_STYLE: Record<string, string> = {
  you: "bg-violet-100 text-violet-700",
  dev: "bg-sky-100 text-sky-700",
  both: "bg-teal-100 text-teal-700",
};

function bounceColor(rate: number) {
  if (rate <= 2) return "text-emerald-600";
  if (rate <= 5) return "text-amber-600";
  return "text-red-600";
}

function StatCard({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${valueClass || ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

// ─── Auth check row ───────────────────────────────────────────────────────────
function AuthRow({ check }: { check: AuthCheck }) {
  const [open, setOpen] = useState(false);
  const s = AUTH_STYLE[check.status];
  const hasMore = !!(check.details?.length || check.fix || check.value);
  return (
    <div className={`rounded-lg border ${s.ring} ${s.bg}`}>
      <button
        className="flex w-full items-start gap-3 p-3 text-left"
        onClick={() => hasMore && setOpen((o) => !o)}
      >
        <s.Icon className={`mt-0.5 size-5 shrink-0 ${s.text}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{check.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.text} ${s.bg} border ${s.ring}`}>{s.word}</span>
          </div>
          <div className="mt-0.5 text-sm text-foreground/80">{check.summary}</div>
        </div>
        {hasMore && <ChevronDown className={`mt-1 size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-black/5 px-3 pb-3 pt-2 text-sm">
          {check.details?.map((d) => (
            <div key={d} className="text-foreground/80">• {d}</div>
          ))}
          {check.value && (
            <div className="overflow-x-auto rounded bg-black/5 p-2 font-mono text-[11px] text-foreground/70">{check.value}</div>
          )}
          {check.fix && (
            <div className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-800">
              <span className="font-semibold">Fix: </span>
              {check.fix}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Checklist row ────────────────────────────────────────────────────────────
const STATUS_BTNS: { value: ChecklistStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "Doing" },
  { value: "done", label: "Done" },
  { value: "not_applicable", label: "N/A" },
];

function ChecklistRow({ item, onSet }: { item: ChecklistItem; onSet: (s: ChecklistStatus) => void }) {
  const [open, setOpen] = useState(false);
  const done = item.status === "done" || item.status === "not_applicable";
  return (
    <div className={`rounded-lg border p-3 ${done ? "border-emerald-100 bg-emerald-50/40" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <button className="flex-1 text-left" onClick={() => setOpen((o) => !o)}>
          <div className={`font-medium ${done ? "text-muted-foreground line-through decoration-1" : ""}`}>{item.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[item.priority]}`}>{item.priority}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${OWNER_STYLE[item.owner]}`}>{item.owner === "you" ? "you" : item.owner === "dev" ? "dev" : "you + dev"}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">effort: {item.effort}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">impact: {item.impact}</span>
          </div>
        </button>
        <div className="flex shrink-0 overflow-hidden rounded-md border">
          {STATUS_BTNS.map((b) => (
            <button
              key={b.value}
              onClick={() => onSet(b.value)}
              className={`px-2 py-1 text-[11px] font-medium transition-colors ${
                item.status === b.value
                  ? b.value === "done"
                    ? "bg-emerald-600 text-white"
                    : b.value === "in_progress"
                      ? "bg-sky-600 text-white"
                      : b.value === "not_applicable"
                        ? "bg-slate-500 text-white"
                        : "bg-slate-800 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
      {open && <div className="mt-2 border-t pt-2 text-sm text-foreground/80">{item.detail}</div>}
    </div>
  );
}

// ─── Inbox Placement Test ─────────────────────────────────────────────────────
interface SpamFinding {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "unknown";
  message: string;
  points: number;
  signals: "spam" | "promotions" | "inbox";
}
interface SpamReport {
  score: number;
  spamScore: number;
  promoPoints: number;
  placement: "inbox" | "promotions" | "spam";
  placementReason: string;
  findings: SpamFinding[];
  notEvaluated: { id: string; message: string }[];
  stats: { subjectLength: number; wordCount: number; visibleTextLength: number; linkCount: number; imageCount: number; hasUnsubscribe: boolean; htmlBytes: number };
  auth: { spf: string; dkim: string; dmarc: string };
  sendingDomain: string;
  liveSend?: { sent: boolean; to: string; from: string; error?: string };
}
interface CampaignSample {
  id: string;
  name: string;
  steps: { id: string; stepOrder: number; subject: string; bodyHtml: string }[];
}

const PLACEMENT: Record<string, { label: string; bg: string; text: string; ring: string; Icon: any }> = {
  inbox: { label: "Primary Inbox", bg: "bg-emerald-50", text: "text-emerald-700", ring: "border-emerald-200", Icon: Inbox },
  promotions: { label: "Promotions / At-risk", bg: "bg-amber-50", text: "text-amber-700", ring: "border-amber-200", Icon: Megaphone },
  spam: { label: "Spam", bg: "bg-red-50", text: "text-red-700", ring: "border-red-200", Icon: Ban },
};
const SEV_COLOR: Record<string, string> = {
  critical: "text-red-600", high: "text-orange-600", medium: "text-amber-600", low: "text-slate-500", unknown: "text-slate-400",
};

function InboxPlacementTest() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"campaign" | "paste">("campaign");
  const [campaignId, setCampaignId] = useState("");
  const [stepId, setStepId] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [sender, setSender] = useState("franchising@newdawnfranchising.com");
  const [liveSendTo, setLiveSendTo] = useState("");
  const [report, setReport] = useState<SpamReport | null>(null);
  const [showNotEval, setShowNotEval] = useState(false);

  const samples = useQuery<CampaignSample[]>({ queryKey: ["/api/admin/deliverability/email-samples"], enabled: mode === "campaign" });
  const campaign = samples.data?.find((c) => c.id === campaignId);

  const pickStep = (cId: string, sId: string) => {
    setCampaignId(cId);
    setStepId(sId);
    const c = samples.data?.find((x) => x.id === cId);
    const s = c?.steps.find((x) => x.id === sId);
    if (s) { setSubject(s.subject); setHtml(s.bodyHtml); }
  };

  const run = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/deliverability/spam-test", {
        subject, html, senderEmail: sender, liveSendTo: liveSendTo.trim() || undefined,
      });
      return (await res.json()) as SpamReport;
    },
    onSuccess: (r) => {
      setReport(r);
      if (r.liveSend) {
        toast(r.liveSend.sent
          ? { title: "Live test sent", description: `Check ${r.liveSend.to} to see where it landed.` }
          : { title: "Live send failed", description: r.liveSend.error || "", variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  const canRun = !!(subject.trim() || html.trim()) && !run.isPending;
  const p = report ? PLACEMENT[report.placement] : null;

  return (
    <Card className="p-4">
      <h3 className="mb-1 flex items-center gap-2 font-semibold">
        <FlaskConical className="size-4" /> Inbox placement test
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Content + authentication health score that predicts Inbox vs Promotions vs Spam — modelled on Mail-Tester / SpamAssassin. Optionally send a live copy to an inbox you control.
      </p>

      {/* Source toggle */}
      <div className="mb-3 inline-flex overflow-hidden rounded-md border text-sm">
        {(["campaign", "paste"] as const).map((mTab) => (
          <button
            key={mTab}
            onClick={() => setMode(mTab)}
            className={`px-3 py-1.5 font-medium transition-colors ${mode === mTab ? "bg-slate-800 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            {mTab === "campaign" ? "Test campaign content" : "Paste custom"}
          </button>
        ))}
      </div>

      {mode === "campaign" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="rounded-md border bg-background px-2 py-1.5 text-sm" value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setStepId(""); }}>
            <option value="">{samples.isLoading ? "Loading campaigns…" : "Select a campaign…"}</option>
            {samples.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="rounded-md border bg-background px-2 py-1.5 text-sm" value={stepId} onChange={(e) => pickStep(campaignId, e.target.value)} disabled={!campaign}>
            <option value="">{campaign ? "Select an email step…" : "—"}</option>
            {campaign?.steps.map((s) => <option key={s.id} value={s.id}>Step {s.stepOrder}: {s.subject?.slice(0, 50) || "(no subject)"}</option>)}
          </select>
        </div>
      ) : (
        <div className="space-y-2">
          <input className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" placeholder="Subject line" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="h-28 w-full rounded-md border bg-background px-2 py-1.5 font-mono text-xs" placeholder="Paste the email HTML body…" value={html} onChange={(e) => setHtml(e.target.value)} />
        </div>
      )}

      {/* Optional live send + run */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className="rounded-md border bg-background px-2 py-1.5 text-sm" value={sender} onChange={(e) => setSender(e.target.value)}>
          <option value="franchising@newdawnfranchising.com">franchising@</option>
          <option value="dylan@newdawnfranchising.com">dylan@</option>
          <option value="info@newdawnfranchising.com">info@</option>
          <option value="support@newdawnfranchising.com">support@</option>
        </select>
        <input className="flex-1 rounded-md border bg-background px-2 py-1.5 text-sm" placeholder="(optional) send a live copy to e.g. you@gmail.com" value={liveSendTo} onChange={(e) => setLiveSendTo(e.target.value)} />
        <Button size="sm" onClick={() => run.mutate()} disabled={!canRun}>
          {run.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : liveSendTo.trim() ? <Send className="mr-2 size-4" /> : <FlaskConical className="mr-2 size-4" />}
          {liveSendTo.trim() ? "Test + send live" : "Run test"}
        </Button>
      </div>

      {/* Result */}
      {report && p && (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border ${p.ring} ${p.bg} p-3`}>
            <div className="flex items-center gap-3">
              <p.Icon className={`size-7 ${p.text}`} />
              <div>
                <div className={`text-lg font-bold ${p.text}`}>{p.label}</div>
                <div className="text-xs text-foreground/70">{report.placementReason}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${p.text}`}>{report.score}<span className="text-sm text-muted-foreground">/100</span></div>
              <div className="text-xs text-muted-foreground">spam score {report.spamScore} (lower is better)</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {[
              { label: "Words", value: report.stats.wordCount },
              { label: "Links", value: report.stats.linkCount },
              { label: "Images", value: report.stats.imageCount },
              { label: "Subject", value: report.stats.subjectLength },
              { label: "HTML", value: `${Math.round(report.stats.htmlBytes / 1024)}KB` },
              { label: "Unsub link", value: report.stats.hasUnsubscribe ? "✓" : "✗" },
            ].map((s) => (
              <div key={s.label} className="rounded border bg-muted/40 p-1.5">
                <div className="text-sm font-semibold tabular-nums">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {report.findings.filter((f) => f.points !== 0).length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold text-muted-foreground">What's affecting placement</div>
              <div className="space-y-1">
                {report.findings.filter((f) => f.points !== 0).map((f) => (
                  <div key={f.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 w-12 shrink-0 text-right font-mono text-xs ${f.points > 0 ? "text-red-500" : "text-emerald-600"}`}>
                      {f.points > 0 ? `+${f.points}` : f.points}
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${f.signals === "spam" ? "bg-red-100 text-red-700" : f.signals === "promotions" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{f.signals}</span>
                    <span className="text-foreground/80">{f.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.liveSend && (
            <div className={`rounded border p-2 text-sm ${report.liveSend.sent ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {report.liveSend.sent
                ? <>Live copy sent from {report.liveSend.from} to <strong>{report.liveSend.to}</strong> — open that inbox to see the real Gmail/Outlook placement.</>
                : <>Live send failed: {report.liveSend.error}</>}
            </div>
          )}

          <div>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowNotEval((v) => !v)}>
              <ChevronDown className={`size-3 transition-transform ${showNotEval ? "rotate-180" : ""}`} /> What this can't see (needs live infrastructure)
            </button>
            {showNotEval && (
              <ul className="mt-1 space-y-0.5 pl-4 text-xs text-muted-foreground">
                {report.notEvaluated.map((n) => <li key={n.id}>• {n.message}</li>)}
                <li className="pt-1 italic">This is a content + auth prediction. For true per-provider placement, run a seed-list test (GlockApps / MailReach).</li>
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────
export default function EmailDeliverabilityTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const auth = useQuery<AuthReport>({ queryKey: ["/api/admin/deliverability/auth"] });
  const metrics = useQuery<DeliverabilityMetrics>({ queryKey: ["/api/admin/deliverability/metrics"] });
  const checklist = useQuery<ChecklistItem[]>({ queryKey: ["/api/admin/deliverability/checklist"] });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ChecklistStatus }) =>
      apiRequest("PATCH", `/api/admin/deliverability/checklist/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/deliverability/checklist"] }),
    onError: (e: any) => toast({ title: "Couldn't update", description: e.message, variant: "destructive" }),
  });

  const rerun = () => {
    qc.invalidateQueries({ queryKey: ["/api/admin/deliverability/auth"] });
    qc.invalidateQueries({ queryKey: ["/api/admin/deliverability/metrics"] });
  };

  const m = metrics.data;
  const items = checklist.data || [];
  const doneCount = items.filter((i) => i.status === "done" || i.status === "not_applicable").length;
  const categories = Array.from(new Set(items.map((i) => i.category)));

  const scoreColor = (s: number) => (s >= 80 ? "text-emerald-600" : s >= 50 ? "text-amber-600" : "text-red-600");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="size-5" /> Email Deliverability
          </h2>
          <p className="text-sm text-muted-foreground">
            Authentication, reputation &amp; inbox-placement health for{" "}
            <span className="font-medium">{auth.data?.domain || m?.sendingDomain || "newdawnfranchising.com"}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={rerun} disabled={auth.isFetching || metrics.isFetching}>
          <RefreshCw className={`mr-2 size-4 ${auth.isFetching || metrics.isFetching ? "animate-spin" : ""}`} /> Re-run checks
        </Button>
      </div>

      {/* Inbox placement / spam test */}
      <InboxPlacementTest />

      {/* Auth score + checks */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-4" /> Domain authentication
          </h3>
          {auth.data && (
            <div className="text-right">
              <span className={`text-2xl font-bold ${scoreColor(auth.data.score)}`}>{auth.data.score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          )}
        </div>
        {auth.isLoading ? (
          <div className="text-sm text-muted-foreground">Running live DNS checks…</div>
        ) : auth.error ? (
          <div className="text-sm text-red-600">Could not run auth checks.</div>
        ) : (
          <div className="space-y-2">
            {auth.data?.checks.map((c) => (
              <AuthRow key={c.key} check={c} />
            ))}
            <div className="pt-1 text-xs text-muted-foreground">
              Checked {auth.data ? new Date(auth.data.checkedAt).toLocaleString() : ""}. Score weights SPF, DKIM &amp; DMARC.
            </div>
          </div>
        )}
      </Card>

      {/* Metrics */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 font-semibold">
          <Activity className="size-4" /> Live deliverability metrics
        </h3>
        {metrics.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading metrics…</div>
        ) : m ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="Bounce rate (30d)"
                value={`${m.volume.last30d.bounceRate}%`}
                valueClass={bounceColor(m.volume.last30d.bounceRate)}
                sub={`${m.volume.last30d.bounced + m.volume.last30d.failed} of ${m.volume.last30d.attempted} sends · target <2%`}
              />
              <StatCard
                label="Open rate (30d)"
                value={`${m.volume.last30d.openRate}%`}
                sub="pixel-based — under-counts"
              />
              <StatCard label="Reply rate" value={`${m.enrollments.replyRate}%`} sub={`${m.enrollments.replied} of ${m.enrollments.total} enrolled`} />
              <StatCard
                label="Suppression list"
                value={`${m.suppression.total}`}
                sub={`+${m.suppression.last7} in 7d · +${m.suppression.last30} in 30d`}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Sent (24h)" value={`${m.volume.last24h.attempted}`} />
              <StatCard label="Sent (7d)" value={`${m.volume.last7d.attempted}`} />
              <StatCard label="Sent (30d)" value={`${m.volume.last30d.attempted}`} />
              <StatCard label="Sent (all-time)" value={`${m.volume.allTime.attempted}`} sub={`${m.volume.allTime.bounceRate}% lifetime bounce`} />
            </div>

            {/* Per-domain bounce concentration */}
            <Card className="mt-3 p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Ban className="size-4" /> Bounces by recipient domain
                <span className="font-normal text-muted-foreground">— a domain with a high % is blocking you, not bad luck</span>
              </h4>
              {m.topBounceDomains.length === 0 ? (
                <div className="text-sm text-muted-foreground">No bounces recorded yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="py-1 pr-3">Domain</th>
                        <th className="py-1 pr-3 text-right">Sent</th>
                        <th className="py-1 pr-3 text-right">Bounced</th>
                        <th className="py-1 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.topBounceDomains.map((d) => (
                        <tr key={d.domain} className="border-t">
                          <td className="py-1 pr-3 font-medium">{d.domain}</td>
                          <td className="py-1 pr-3 text-right tabular-nums">{d.attempted}</td>
                          <td className="py-1 pr-3 text-right tabular-nums">{d.bounced}</td>
                          <td className={`py-1 text-right font-semibold tabular-nums ${bounceColor(d.rate)}`}>{d.rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Suppression reasons + pipeline gaps + config */}
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Card className="p-4">
                <h4 className="mb-2 text-sm font-semibold">Suppression by reason</h4>
                {m.suppression.byReason.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Empty.</div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {m.suppression.byReason.map((r) => (
                      <li key={r.reason} className="flex justify-between gap-2">
                        <span className="truncate text-foreground/80">{r.reason}</span>
                        <span className="tabular-nums font-medium">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Mail className="size-4" /> Per-message pipeline
                </h4>
                <ul className="space-y-1.5 text-sm">
                  {m.gaps.map((g) => (
                    <li key={g.key} className="flex items-center gap-2">
                      {g.ok ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <XCircle className="size-4 shrink-0 text-red-500" />
                      )}
                      <span className={g.ok ? "" : "text-foreground/80"}>{g.label}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-4">
                <h4 className="mb-2 text-sm font-semibold">Sending configuration</h4>
                <ul className="space-y-1 text-sm text-foreground/80">
                  <li className="flex justify-between"><span>Daily cap / sender</span><span className="font-medium">{m.config.dailyCap}</span></li>
                  <li className="flex justify-between"><span>Hourly cap</span><span className="font-medium">{m.config.hourlyCap}</span></li>
                  <li className="flex justify-between"><span>Same-domain spacing</span><span className="font-medium">{m.config.domainGapSeconds}s</span></li>
                  <li className="flex justify-between"><span>Senders configured</span><span className="font-medium">{m.config.sendersConfigured}/{m.config.sendersTotal}</span></li>
                  <li className="mt-1 border-t pt-1 text-xs text-muted-foreground">{m.config.sendingModel}</li>
                </ul>
              </Card>
            </div>
          </>
        ) : (
          <div className="text-sm text-red-600">Could not load metrics.</div>
        )}
      </div>

      {/* Roadmap */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-4" /> Remediation roadmap
          </h3>
          {items.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {doneCount}/{items.length} complete
            </span>
          )}
        </div>
        {items.length > 0 && (
          <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / items.length) * 100}%` }} />
          </div>
        )}
        {checklist.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading roadmap…</div>
        ) : (
          <div className="space-y-4">
            {categories.map((cat) => (
              <div key={cat}>
                <div className="mb-1.5 text-sm font-semibold text-muted-foreground">{cat}</div>
                <div className="space-y-2">
                  {items
                    .filter((i) => i.category === cat)
                    .map((item) => (
                      <ChecklistRow key={item.id} item={item} onSet={(status) => setStatus.mutate({ id: item.id, status })} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
