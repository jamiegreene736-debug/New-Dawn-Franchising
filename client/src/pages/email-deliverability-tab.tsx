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
