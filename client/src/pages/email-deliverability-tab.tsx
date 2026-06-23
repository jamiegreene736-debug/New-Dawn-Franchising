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
  Globe,
  Copy,
  Flame,
  Play,
  Plus,
  Trash2,
  Power,
  Server,
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

// ─── Shared helpers ───────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs hover:bg-muted"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        toast({ title: "Copied", description: text.length > 60 ? text.slice(0, 57) + "…" : text });
      }}
    >
      <Copy className="size-3" /> Copy
    </button>
  );
}

const scoreColorClass = (s: number) => (s >= 80 ? "text-emerald-600" : s >= 50 ? "text-amber-600" : "text-red-600");

// ─── DNS / Subdomain setup panel ──────────────────────────────────────────────
interface DnsRecord {
  id: string; group: string; type: string; host: string; hostRelative: string;
  value: string; ttl: number; required: boolean; purpose: string;
}
interface TrackingVerification { host: string; expectedTarget: string; status: AuthStatus; summary: string; resolved?: string[]; }
interface DnsSetupReport {
  generatedAt: string;
  config: { rootDomain: string; sendingSubdomain: string; trackingDomain: string; trackingTarget: string; dmarcRua: string; trackingDomainActive: boolean; extraDomains: string[] };
  records: DnsRecord[];
  verification: { root: AuthReport; subdomain: AuthReport; tracking: TrackingVerification; extra: AuthReport[] };
}

function VerifyChip({ status }: { status: AuthStatus }) {
  const s = AUTH_STYLE[status];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.ring} ${s.bg} ${s.text}`}><s.Icon className="size-3" /> {s.word}</span>;
}

function DnsSetupPanel() {
  const qc = useQueryClient();
  const q = useQuery<DnsSetupReport>({ queryKey: ["/api/admin/deliverability/dns-setup"] });
  const d = q.data;
  const groups = Array.from(new Set((d?.records || []).map((r) => r.group)));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><Globe className="size-4" /> Dedicated sending subdomain &amp; tracking domain</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Cold outreach should run from a dedicated subdomain with its own SPF/DKIM/DMARC so the brand root's reputation stays protected (SPF does <em>not</em> cascade — every record is published at the subdomain). Add the records below at your DNS host, then hit “Re-verify”.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/deliverability/dns-setup"] })} disabled={q.isFetching}>
          <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} /> Re-verify
        </Button>
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Generating records &amp; running live DNS checks…</div>
      ) : !d ? (
        <div className="text-sm text-red-600">Could not load DNS setup.</div>
      ) : (
        <>
          {/* Config summary */}
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Sending subdomain" value={d.config.sendingSubdomain} />
            <StatCard label="Tracking domain" value={d.config.trackingDomain} sub={d.config.trackingDomainActive ? "active (EMAIL_TRACKING_DOMAIN set)" : "not yet active — set EMAIL_TRACKING_DOMAIN after the CNAME resolves"} />
            <StatCard label="DMARC reports →" value={d.config.dmarcRua} />
          </div>

          {/* Live verification */}
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="size-4" /> Subdomain auth — {d.verification.subdomain.domain}</h4>
                <span className={`text-lg font-bold ${scoreColorClass(d.verification.subdomain.score)}`}>{d.verification.subdomain.score}<span className="text-xs text-muted-foreground">/100</span></span>
              </div>
              <div className="space-y-2">{d.verification.subdomain.checks.map((c) => <AuthRow key={c.key} check={c} />)}</div>
            </Card>
            <div className="space-y-3">
              <Card className="p-4">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Server className="size-4" /> Tracking domain (CNAME)</h4>
                <div className="flex items-center gap-2"><VerifyChip status={d.verification.tracking.status} /> <span className="text-sm font-medium">{d.verification.tracking.host}</span></div>
                <p className="mt-1.5 text-sm text-foreground/80">{d.verification.tracking.summary}</p>
              </Card>
              <Card className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4" /> Root domain — {d.verification.root.domain}</h4>
                  <span className={`text-lg font-bold ${scoreColorClass(d.verification.root.score)}`}>{d.verification.root.score}<span className="text-xs text-muted-foreground">/100</span></span>
                </div>
                <p className="text-xs text-muted-foreground">Reference only — keep cold sending OFF the root. Watch for a duplicate DMARC record here (it breaks enforcement).</p>
              </Card>
            </div>
          </div>

          {/* Additional sending domains (separate SLD / extra subdomains) */}
          {d.verification.extra.length > 0 && (
            <Card className="p-4">
              <h4 className="mb-2 text-sm font-semibold">Additional sending domains <span className="font-normal text-muted-foreground">(EXTRA_SENDING_DOMAINS)</span></h4>
              <div className="space-y-1.5">
                {d.verification.extra.map((x) => (
                  <div key={x.domain} className="flex items-center justify-between gap-2 border-b py-1 text-sm last:border-0">
                    <span className="font-medium">{x.domain}</span>
                    <span className={`font-semibold ${scoreColorClass(x.score)}`}>{x.score}/100</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Records to add */}
          <div className="space-y-4">
            {groups.map((g) => (
              <Card key={g} className="p-4">
                <h4 className="mb-2 text-sm font-semibold">{g}</h4>
                <div className="space-y-2">
                  {d.records.filter((r) => r.group === g).map((r) => (
                    <div key={r.id} className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono font-semibold text-white">{r.type}</span>
                        <span className="text-muted-foreground">Host:</span>
                        <code className="rounded bg-black/5 px-1.5 py-0.5">{r.hostRelative}</code>
                        <CopyBtn text={r.hostRelative} />
                        {r.required ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">required</span> : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">optional</span>}
                        <span className="ml-auto text-muted-foreground">TTL {r.ttl}</span>
                      </div>
                      <div className="mt-2 flex items-start gap-2">
                        <code className="flex-1 overflow-x-auto rounded bg-black/5 p-2 font-mono text-[11px]">{r.value}</code>
                        <CopyBtn text={r.value} />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{r.purpose}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Order: publish SPF + DKIM + MX → confirm mail authenticates for ~48h → then ramp DMARC none → quarantine → reject. Generate the DKIM key for the subdomain in Google Admin (Apps → Gmail → Authenticate email) before pasting it.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Blacklist panel ──────────────────────────────────────────────────────────
interface BlacklistEntry { list: string; zone: string; kind: string; severity: string; target: string; status: "clean" | "listed" | "error"; detail?: string; }
interface BlacklistReport { checkedAt: string; domain: string; ips: string[]; listedCount: number; errorCount: number; totalChecks: number; entries: BlacklistEntry[]; }

function BlacklistPanel() {
  const qc = useQueryClient();
  const q = useQuery<BlacklistReport>({ queryKey: ["/api/admin/deliverability/blacklist"] });
  const d = q.data;
  const statusColor = (s: string) => (s === "listed" ? "text-red-600" : s === "error" ? "text-amber-600" : "text-emerald-600");
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><Ban className="size-4" /> Blacklist / DNSBL monitor</h3>
          <p className="mt-1 text-sm text-muted-foreground">Checks the sending domain + its IPs against public blocklists. (Spamhaus is excluded unless BLACKLIST_INCLUDE_SPAMHAUS=1 — it blocks shared resolvers.)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/deliverability/blacklist"] })} disabled={q.isFetching}>
          <RefreshCw className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`} /> Re-check
        </Button>
      </div>
      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Querying blocklists…</div>
      ) : !d ? (
        <div className="text-sm text-red-600">Could not run blacklist checks.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Listings" value={`${d.listedCount}`} valueClass={d.listedCount ? "text-red-600" : "text-emerald-600"} sub={d.listedCount ? "needs delisting" : "all clear"} />
            <StatCard label="Lists checked" value={`${d.totalChecks}`} />
            <StatCard label="Errors / blocked" value={`${d.errorCount}`} valueClass={d.errorCount ? "text-amber-600" : ""} />
            <StatCard label="IPs resolved" value={`${d.ips.length}`} sub={d.ips.slice(0, 2).join(", ")} />
          </div>
          <Card className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-1 pr-3">List</th><th className="py-1 pr-3">Target</th><th className="py-1 pr-3">Kind</th><th className="py-1">Status</th></tr></thead>
                <tbody>
                  {d.entries.map((e, i) => (
                    <tr key={`${e.zone}-${e.target}-${i}`} className="border-t">
                      <td className="py-1 pr-3 font-medium">{e.list}</td>
                      <td className="py-1 pr-3 font-mono text-xs">{e.target}</td>
                      <td className="py-1 pr-3 text-xs text-muted-foreground">{e.kind}</td>
                      <td className={`py-1 font-semibold ${statusColor(e.status)}`}>{e.status === "listed" ? `LISTED${e.detail ? ` (${e.detail})` : ""}` : e.status === "error" ? `error${e.detail ? ` (${e.detail})` : ""}` : "clean"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Warmup panel ─────────────────────────────────────────────────────────────
interface WarmupSettings {
  enabled: boolean; provider: string; dailyTarget: number; rampStart: number; rampIncrement: number;
  replyRatePct: number; markImportantPct: number; spamRescuePct: number; weekdaysOnly: boolean; filterTag: string; startedAt: string | null;
}
interface WarmupMember { id: string; email: string; name: string | null; type: string; active: boolean; }
interface WarmupHealth { mailbox: string; score: number | null; sent: number; inboxed: number; spam: number; }
interface WarmupOverview {
  settings: WarmupSettings; members: WarmupMember[]; health: WarmupHealth[]; todayTarget: number;
  totals: { today?: number; week?: number; inbox_week?: number; spam_week?: number; replied_week?: number };
  recent: { from: string; to: string; subject: string; landed: string; sentAt: string | null }[];
  lastTick: { ran: boolean; reason?: string; sent: number; at: string };
}

function NumField({ label, value, onSave, suffix }: { label: string; value: number; onSave: (n: number) => void; suffix?: string }) {
  const [v, setV] = useState(String(value));
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-foreground/80">{label}</span>
      <span className="flex items-center gap-1">
        <input type="number" className="w-20 rounded border px-2 py-1 text-right text-sm" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const n = Number(v); if (!Number.isNaN(n) && n !== value) onSave(n); }} />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

function WarmupPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery<WarmupOverview>({ queryKey: ["/api/admin/warmup/overview"] });
  const [newEmail, setNewEmail] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/admin/warmup/overview"] });

  const patch = useMutation({
    mutationFn: async (body: any) => apiRequest("PATCH", "/api/admin/warmup/settings", body),
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
  const seed = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/admin/warmup/members/seed-owned", {}); return res.json(); },
    onSuccess: (res: any) => { invalidate(); toast({ title: "Added owned mailboxes", description: `${res?.added || 0} sender mailbox(es)` }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const addMem = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/warmup/members", { email: newEmail }),
    onSuccess: () => { setNewEmail(""); invalidate(); },
    onError: (e: any) => toast({ title: "Add failed", description: e.message, variant: "destructive" }),
  });
  const toggleMem = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => apiRequest("PATCH", `/api/admin/warmup/members/${id}`, { active }),
    onSuccess: invalidate,
  });
  const delMem = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/warmup/members/${id}`),
    onSuccess: invalidate,
  });
  const runNow = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/admin/warmup/run-now", {}); return res.json(); },
    onSuccess: (res: any) => { invalidate(); toast({ title: "Warmup cycle ran", description: `sent ${res?.send?.sent ?? 0}, engaged ${res?.engage?.mailboxes ?? 0} mailbox(es)` }); },
    onError: (e: any) => toast({ title: "Run failed", description: e.message, variant: "destructive" }),
  });

  const d = q.data;
  const s = d?.settings;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><Flame className="size-4" /> Mailbox warmup</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Slow-ramp warmup across the mailboxes you own: they email each other and auto read / reply / star / rescue-from-spam over IMAP to build sender reputation. Ships off — turn it on once you've added members.
          </p>
        </div>
        {s && (
          <Button
            size="sm"
            variant={s.enabled ? "default" : "outline"}
            onClick={() => patch.mutate({ enabled: !s.enabled })}
            disabled={patch.isPending}
          >
            <Power className="mr-2 size-4" /> {s.enabled ? "Enabled" : "Disabled"}
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading warmup…</div>
      ) : !d || !s ? (
        <div className="text-sm text-red-600">Could not load warmup.</div>
      ) : (
        <>
          {!s.enabled && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Warmup is off. Add at least 2 owned mailboxes (with their Gmail app passwords configured), then enable it. Note: warming across your own org's mailboxes maintains reputation but is lower-signal than a real stranger-inbox network — switch the provider to an external pool later for that.
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Today's ramp target" value={`${d.todayTarget}`} sub="emails / mailbox" />
            <StatCard label="Sent today" value={`${d.totals.today ?? 0}`} />
            <StatCard label="Inbox (7d)" value={`${d.totals.inbox_week ?? 0}`} sub={`${d.totals.spam_week ?? 0} in spam`} valueClass="text-emerald-600" />
            <StatCard label="Replies (7d)" value={`${d.totals.replied_week ?? 0}`} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {/* Settings */}
            <Card className="p-4">
              <h4 className="mb-3 text-sm font-semibold">Settings</h4>
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground/80">Provider</span>
                  <select className="rounded border px-2 py-1 text-sm" value={s.provider} onChange={(e) => patch.mutate({ provider: e.target.value })}>
                    <option value="owned">Owned mailboxes (IMAP)</option>
                    <option value="instantly">Instantly (external — seam)</option>
                    <option value="smartlead">Smartlead (external — seam)</option>
                    <option value="mailreach">Mailreach (external — seam)</option>
                  </select>
                </label>
                <NumField label="Daily target (ceiling)" value={s.dailyTarget} onSave={(n) => patch.mutate({ dailyTarget: n })} suffix="/day" />
                <NumField label="Ramp start (day 1)" value={s.rampStart} onSave={(n) => patch.mutate({ rampStart: n })} />
                <NumField label="Ramp increment" value={s.rampIncrement} onSave={(n) => patch.mutate({ rampIncrement: n })} suffix="/day" />
                <NumField label="Reply rate" value={s.replyRatePct} onSave={(n) => patch.mutate({ replyRatePct: n })} suffix="%" />
                <NumField label="Mark important" value={s.markImportantPct} onSave={(n) => patch.mutate({ markImportantPct: n })} suffix="%" />
                <NumField label="Spam rescue" value={s.spamRescuePct} onSave={(n) => patch.mutate({ spamRescuePct: n })} suffix="%" />
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground/80">Weekdays only</span>
                  <input type="checkbox" checked={s.weekdaysOnly} onChange={(e) => patch.mutate({ weekdaysOnly: e.target.checked })} />
                </label>
              </div>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => runNow.mutate()} disabled={runNow.isPending || !s.enabled}>
                <Play className="mr-2 size-4" /> Run a cycle now
              </Button>
            </Card>

            {/* Members + health */}
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Pool members</h4>
                <Button size="sm" variant="ghost" onClick={() => seed.mutate()} disabled={seed.isPending}>
                  <Plus className="mr-1 size-3" /> Add owned senders
                </Button>
              </div>
              <div className="space-y-1.5">
                {d.members.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No members yet.</div>
                ) : (
                  d.members.map((m) => {
                    const h = d.health.find((x) => x.mailbox === m.email);
                    return (
                      <div key={m.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                        <button onClick={() => toggleMem.mutate({ id: m.id, active: !m.active })} title={m.active ? "Active" : "Paused"}>
                          <Power className={`size-4 ${m.active ? "text-emerald-600" : "text-muted-foreground"}`} />
                        </button>
                        <span className="flex-1 truncate">{m.email}</span>
                        {h?.score != null && <span className={`font-semibold ${scoreColorClass(h.score)}`}>{h.score}%</span>}
                        <span className="text-xs text-muted-foreground">{m.type === "owned_imap" ? "owned" : m.type}</span>
                        <button onClick={() => delMem.mutate(m.id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="size-3.5" /></button>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <input className="flex-1 rounded border px-2 py-1 text-sm" placeholder="add mailbox email…" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <Button size="sm" variant="outline" onClick={() => addMem.mutate()} disabled={addMem.isPending || !newEmail}>Add</Button>
              </div>
            </Card>
          </div>

          {/* Recent */}
          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold">Recent warmup sends</h4>
            {d.recent.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nothing sent yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-1 pr-3">From → To</th><th className="py-1 pr-3">Landed</th><th className="py-1">When</th></tr></thead>
                  <tbody>
                    {d.recent.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-1 pr-3 text-xs">{r.from} → {r.to}</td>
                        <td className={`py-1 pr-3 font-medium ${r.landed === "inbox" ? "text-emerald-600" : r.landed === "spam" ? "text-red-600" : "text-muted-foreground"}`}>{r.landed}</td>
                        <td className="py-1 text-xs text-muted-foreground">{r.sentAt ? new Date(r.sentAt).toLocaleString() : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Sending & Safety panel (Phase 2) ────────────────────────────────────────
interface SafetySettings {
  verifyBeforeSend: boolean; senderRotation: boolean; domainGuard: boolean;
  domainBounceThresholdPct: number; domainBounceMin: number;
  campaignPauseEnabled: boolean; campaignBounceThresholdPct: number; campaignBounceMin: number;
  softBounceSkipDnc: boolean;
  dailyCapOverride: number | null; hourlyCapOverride: number | null; domainGapOverrideSeconds: number | null;
  rampMode: string; rampStartCap: number; rampDays: number;
  effectiveDailyCap: number; effectiveHourlyCap: number; effectiveDomainGapMs: number;
}
interface SafetyData {
  settings: SafetySettings;
  senders: { email: string; name: string }[];
  senderStats: { email: string; sentTotal: number; lastSentAt: string | null }[];
  lastGuard: { ran: boolean; domainsSuppressed: { domain: string; rate: number }[]; campaignsPaused: { campaignId: string; rate: number }[]; at: string };
}

function BoolRow({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3 rounded border p-2.5 text-sm">
      <span>
        <span className="font-medium">{label}</span>
        {desc && <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>}
      </span>
      <input type="checkbox" className="mt-1 size-4 shrink-0" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function OverrideField({ label, value, effective, unit, onSave }: { label: string; value: number | null; effective: string; unit: string; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-foreground/80">{label} <span className="text-xs text-muted-foreground">(now {effective})</span></span>
      <span className="flex items-center gap-1">
        <input
          className="w-24 rounded border px-2 py-1 text-right text-sm" placeholder="default" value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => { const t = v.trim(); const n = t === "" ? null : Number(t); if (t === "" || !Number.isNaN(n as number)) onSave(n); }}
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </span>
    </label>
  );
}

function SendingSafetyPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery<SafetyData>({ queryKey: ["/api/admin/deliverability/settings"] });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/admin/deliverability/settings"] });
  const patch = useMutation({
    mutationFn: async (body: any) => apiRequest("PATCH", "/api/admin/deliverability/settings", body),
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
  const guard = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/admin/deliverability/bounce-guard/run", {}); return res.json(); },
    onSuccess: (r: any) => { invalidate(); toast({ title: "Bounce guard ran", description: `${r?.domainsSuppressed?.length || 0} domain(s) suppressed, ${r?.campaignsPaused?.length || 0} campaign(s) paused` }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const d = q.data;
  const s = d?.settings;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold"><Server className="size-4" /> Sending &amp; safety</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Opt-in guards on the live send path. Defaults preserve current behaviour — verify-gate and rotation are off; the domain bounce-guard is on (protective, high threshold); transient soft bounces are no longer auto-suppressed.</p>
      </div>
      {q.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !d || !s ? (
        <div className="text-sm text-red-600">Could not load settings.</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-4 space-y-2">
              <h4 className="text-sm font-semibold">Send-path guards</h4>
              <BoolRow label="Verify before send" desc="Drop & suppress addresses ZeroBounce flags INVALID at send time (needs ZEROBOUNCE_API_KEY)." value={s.verifyBeforeSend} onChange={(b) => patch.mutate({ verifyBeforeSend: b })} />
              <BoolRow label="Sender rotation" desc="Spread sends across all configured mailboxes; sticky per contact to preserve threading." value={s.senderRotation} onChange={(b) => patch.mutate({ senderRotation: b })} />
              <BoolRow label="Skip DNC on soft bounces" desc="Don't suppress transient 4.x.x bounces (full mailbox, greylisting) — let them retry." value={s.softBounceSkipDnc} onChange={(b) => patch.mutate({ softBounceSkipDnc: b })} />
            </Card>

            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Bounce guard</h4>
                <Button size="sm" variant="outline" onClick={() => guard.mutate()} disabled={guard.isPending}><Play className="mr-2 size-4" /> Run now</Button>
              </div>
              <BoolRow label="Auto-suppress hard-blocking domains" value={s.domainGuard} onChange={(b) => patch.mutate({ domainGuard: b })} />
              <NumField label="Domain bounce threshold" value={s.domainBounceThresholdPct} onSave={(n) => patch.mutate({ domainBounceThresholdPct: n })} suffix="%" />
              <NumField label="Min sends before judging a domain" value={s.domainBounceMin} onSave={(n) => patch.mutate({ domainBounceMin: n })} />
              <BoolRow label="Auto-pause runaway campaigns" desc="Off by default — pauses a whole campaign over the bounce threshold." value={s.campaignPauseEnabled} onChange={(b) => patch.mutate({ campaignPauseEnabled: b })} />
              <NumField label="Campaign bounce threshold" value={s.campaignBounceThresholdPct} onSave={(n) => patch.mutate({ campaignBounceThresholdPct: n })} suffix="%" />
              <NumField label="Min sends before judging a campaign" value={s.campaignBounceMin} onSave={(n) => patch.mutate({ campaignBounceMin: n })} />
              {d.lastGuard?.ran && (
                <p className="text-xs text-muted-foreground">Last run {new Date(d.lastGuard.at).toLocaleString()}: {d.lastGuard.domainsSuppressed.length} domain(s), {d.lastGuard.campaignsPaused.length} campaign(s).</p>
              )}
            </Card>
          </div>

          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold">Volume cap overrides <span className="font-normal text-muted-foreground">— blank = use the env default</span></h4>
            <div className="grid gap-2 md:grid-cols-3">
              <OverrideField label="Daily cap / sender" value={s.dailyCapOverride} effective={String(s.effectiveDailyCap)} unit="/day" onSave={(v) => patch.mutate({ dailyCapOverride: v })} />
              <OverrideField label="Hourly cap" value={s.hourlyCapOverride} effective={String(s.effectiveHourlyCap)} unit="/hr" onSave={(v) => patch.mutate({ hourlyCapOverride: v })} />
              <OverrideField label="Same-domain gap" value={s.domainGapOverrideSeconds} effective={`${Math.round(s.effectiveDomainGapMs / 1000)}s`} unit="s" onSave={(v) => patch.mutate({ domainGapOverrideSeconds: v })} />
            </div>
            <div className="mt-3 border-t pt-3">
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground/80">Linear ramp <span className="text-xs text-muted-foreground">(grow the daily cap to target over N days — today: {s.effectiveDailyCap}/day)</span></span>
                <select className="rounded border px-2 py-1 text-sm" value={s.rampMode} onChange={(e) => patch.mutate({ rampMode: e.target.value })}>
                  <option value="off">Off</option>
                  <option value="linear">Linear</option>
                </select>
              </label>
              {s.rampMode === "linear" && (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <NumField label="Start cap (day 1)" value={s.rampStartCap} onSave={(n) => patch.mutate({ rampStartCap: n })} suffix="/day" />
                  <NumField label="Ramp over" value={s.rampDays} onSave={(n) => patch.mutate({ rampDays: n })} suffix="days" />
                </div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="mb-2 text-sm font-semibold">Sender rotation {s.senderRotation ? "(active)" : "(off)"}</h4>
            <div className="space-y-1 text-sm">
              {d.senders.map((sender) => {
                const st = d.senderStats.find((x) => x.email === sender.email);
                return (
                  <div key={sender.email} className="flex items-center justify-between gap-2 border-b py-1 last:border-0">
                    <span className="truncate">{sender.email}</span>
                    <span className="text-xs text-muted-foreground">{st ? `${st.sentTotal} sent` : "—"}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Inbox Placement Test (PR #156) ───────────────────────────────────────────
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

// ─── Composite health score (Phase 3) ────────────────────────────────────────
interface ScoreFactor { key: string; label: string; score: number; weight: number; detail: string }
interface ScoreData { overall: number; grade: string; factors: ScoreFactor[]; topIssues: { label: string; score: number; detail: string }[] }

function ScoreCard() {
  const q = useQuery<ScoreData>({ queryKey: ["/api/admin/deliverability/score"] });
  const d = q.data;
  if (q.isLoading) return <Card className="p-4 text-sm text-muted-foreground">Computing composite score…</Card>;
  if (!d) return null;
  const gradeColor = d.overall >= 80 ? "text-emerald-600" : d.overall >= 65 ? "text-amber-600" : "text-red-600";
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-5">
        <div className="text-center">
          <div className={`text-5xl font-extrabold ${gradeColor}`}>{d.overall}</div>
          <div className="text-xs text-muted-foreground">composite /100 · grade {d.grade}</div>
        </div>
        <div className="flex-1 space-y-1.5">
          {d.factors.map((f) => (
            <div key={f.key} className="flex items-center gap-2 text-xs">
              <span className="w-44 shrink-0 truncate text-foreground/80">{f.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${f.score >= 80 ? "bg-emerald-500" : f.score >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${f.score}%` }} />
              </div>
              <span className="w-9 shrink-0 text-right font-semibold tabular-nums">{f.score}</span>
              <span className="w-8 shrink-0 text-right text-[10px] text-muted-foreground">{f.weight}%</span>
            </div>
          ))}
        </div>
      </div>
      {d.topIssues.length > 0 && (
        <div className="mt-3 border-t pt-2 text-sm">
          <span className="font-medium">Top factors to fix:</span>{" "}
          {d.topIssues.map((i) => i.label).join(" · ")}
        </div>
      )}
    </Card>
  );
}

// ─── Seed inbox-placement test (Phase 3) ──────────────────────────────────────
interface SeedInbox { id: string; provider: string; email: string; active: boolean }
interface SeedTestRow { id: string; subject: string; status: string; total: number; sent: number; inbox: number; spam: number; missing: number; inboxRate: number; startedAt: string | null }
interface SeedOverview {
  seeds: SeedInbox[];
  tests: SeedTestRow[];
  latestResults: { email: string; provider: string; placement: string; checkedAt: string | null }[];
}

function SeedTestPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery<SeedOverview>({ queryKey: ["/api/admin/deliverability/seed/overview"] });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/admin/deliverability/seed/overview"] });
  const [email, setEmail] = useState("");
  const [passEnv, setPassEnv] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");

  const addSeed = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/deliverability/seed/seeds", { email, imapPassEnv: passEnv || undefined }),
    onSuccess: () => { setEmail(""); setPassEnv(""); invalidate(); },
    onError: (e: any) => toast({ title: "Add failed", description: e.message, variant: "destructive" }),
  });
  const toggleSeed = useMutation({ mutationFn: async ({ id, active }: { id: string; active: boolean }) => apiRequest("PATCH", `/api/admin/deliverability/seed/seeds/${id}`, { active }), onSuccess: invalidate });
  const delSeed = useMutation({ mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/deliverability/seed/seeds/${id}`), onSuccess: invalidate });
  const runTest = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/admin/deliverability/seed/test", { subject, html }); return r.json(); },
    onSuccess: (r: any) => { invalidate(); toast({ title: "Seed test sent", description: `${r?.sent || 0} seed(s) — placement read in ~3 min, or check now.` }); },
    onError: (e: any) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });
  const checkNow = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/admin/deliverability/seed/test/${id}/check`, {}),
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Check failed", description: e.message, variant: "destructive" }),
  });

  const d = q.data;
  const latest = d?.tests?.[0];
  const placeColor = (p: string) => p === "inbox" ? "text-emerald-600" : p === "spam" ? "text-red-600" : "text-muted-foreground";
  return (
    <Card className="p-4">
      <h3 className="mb-1 flex items-center gap-2 font-semibold"><Inbox className="size-4" /> Seed inbox-placement test</h3>
      <p className="mb-3 text-xs text-muted-foreground">Sends your real content to seed inboxes you control, then reads each over IMAP to show where it actually landed per provider. Add seeds on Gmail/Outlook/Yahoo (each needs an app password set as an env var, named below).</p>

      {/* Seeds */}
      <div className="mb-3 space-y-1.5">
        {(d?.seeds || []).length === 0 ? <div className="text-sm text-muted-foreground">No seed inboxes yet.</div> : d!.seeds.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded border p-2 text-sm">
            <button onClick={() => toggleSeed.mutate({ id: s.id, active: !s.active })}><Power className={`size-4 ${s.active ? "text-emerald-600" : "text-muted-foreground"}`} /></button>
            <span className="flex-1 truncate">{s.email}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">{s.provider}</span>
            <button onClick={() => delSeed.mutate(s.id)} className="text-muted-foreground hover:text-red-600"><Trash2 className="size-3.5" /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <input className="flex-1 rounded border px-2 py-1 text-sm" placeholder="seed email (gmail/outlook/yahoo)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="w-48 rounded border px-2 py-1 text-sm" placeholder="app-password ENV var name" value={passEnv} onChange={(e) => setPassEnv(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => addSeed.mutate()} disabled={addSeed.isPending || !email}><Plus className="mr-1 size-3" /> Add seed</Button>
        </div>
      </div>

      {/* Run */}
      <div className="space-y-2 border-t pt-3">
        <input className="w-full rounded-md border px-2 py-1.5 text-sm" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea className="h-24 w-full rounded-md border px-2 py-1.5 font-mono text-xs" placeholder="Email HTML body" value={html} onChange={(e) => setHtml(e.target.value)} />
        <Button size="sm" onClick={() => runTest.mutate()} disabled={runTest.isPending || !(d?.seeds || []).some((s) => s.active)}>
          {runTest.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />} Send seed test
        </Button>
      </div>

      {/* Latest result */}
      {latest && (
        <div className="mt-4 border-t pt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm"><span className="font-semibold">{latest.inboxRate}%</span> inbox · {latest.inbox} inbox / {latest.spam} spam / {latest.missing} missing <span className="text-xs text-muted-foreground">({latest.status})</span></div>
            {latest.status !== "complete" && <Button size="sm" variant="outline" onClick={() => checkNow.mutate(latest.id)} disabled={checkNow.isPending}><RefreshCw className={`mr-1 size-3 ${checkNow.isPending ? "animate-spin" : ""}`} /> Check now</Button>}
          </div>
          <div className="space-y-1">
            {(d?.latestResults || []).map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">{r.email}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-600">{r.provider}</span>
                <span className={`w-16 text-right font-medium ${placeColor(r.placement)}`}>{r.placement}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Monitoring: DMARC + Postmaster (Phase 3) ─────────────────────────────────
interface DmarcOverview {
  config: { configured: boolean; user: string | null };
  syncStatus: { at: string; error: string | null };
  summary: { total: number; alignedPass: number; passRate: number };
  sources: { sourceIp: string; volume: number; pass: number; passRate: number; dkimDomain: string | null }[];
  reports: { org: string; domain: string; receivedAt: string | null }[];
}
interface PostmasterOverview {
  config: { configured: boolean; domains: string[] };
  syncStatus: { at: string; stored: number; error: string | null };
  latest: { domain: string; day: string; spamRate: number | null; domainReputation: string | null; dkimRatio: number | null; spfRatio: number | null; dmarcRatio: number | null }[];
}

function MonitoringPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const dmarc = useQuery<DmarcOverview>({ queryKey: ["/api/admin/deliverability/dmarc"] });
  const pm = useQuery<PostmasterOverview>({ queryKey: ["/api/admin/deliverability/postmaster"] });
  const syncDmarc = useMutation({ mutationFn: async () => apiRequest("POST", "/api/admin/deliverability/dmarc/sync", {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/deliverability/dmarc"] }), onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }) });
  const syncPm = useMutation({ mutationFn: async () => apiRequest("POST", "/api/admin/deliverability/postmaster/sync", {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/deliverability/postmaster"] }), onError: (e: any) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }) });
  const dd = dmarc.data;
  const pp = pm.data;
  const repColor = (r: string | null) => r === "HIGH" ? "text-emerald-600" : r === "MEDIUM" ? "text-amber-600" : r === "LOW" || r === "BAD" ? "text-red-600" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      {/* DMARC */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" /> DMARC aggregate reports</h3>
          <Button size="sm" variant="outline" onClick={() => syncDmarc.mutate()} disabled={syncDmarc.isPending}><RefreshCw className={`mr-2 size-4 ${syncDmarc.isPending ? "animate-spin" : ""}`} /> Sync now</Button>
        </div>
        {!dd?.config.configured ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Not configured. Point your DMARC <code>rua=</code> at a mailbox and set <code>DMARC_IMAP_USER</code> + <code>DMARC_IMAP_PASSWORD</code> so reports are ingested.</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="DMARC pass rate (30d)" value={`${dd.summary.passRate}%`} valueClass={dd.summary.passRate >= 95 ? "text-emerald-600" : dd.summary.passRate >= 80 ? "text-amber-600" : "text-red-600"} />
              <StatCard label="Messages reported" value={`${dd.summary.total}`} />
              <StatCard label="Aligned/pass" value={`${dd.summary.alignedPass}`} />
            </div>
            {dd.sources.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-1 pr-3">Source IP</th><th className="py-1 pr-3">DKIM domain</th><th className="py-1 pr-3 text-right">Volume</th><th className="py-1 text-right">Pass</th></tr></thead>
                  <tbody>
                    {dd.sources.map((s) => (
                      <tr key={s.sourceIp} className="border-t">
                        <td className="py-1 pr-3 font-mono text-xs">{s.sourceIp}</td>
                        <td className="py-1 pr-3 text-xs text-muted-foreground">{s.dkimDomain || "—"}</td>
                        <td className="py-1 pr-3 text-right tabular-nums">{s.volume}</td>
                        <td className={`py-1 text-right font-semibold tabular-nums ${s.passRate >= 95 ? "text-emerald-600" : s.passRate >= 80 ? "text-amber-600" : "text-red-600"}`}>{s.passRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {dd.summary.total === 0 && <div className="mt-2 text-sm text-muted-foreground">No reports ingested yet — they arrive ~daily once rua is set.</div>}
            {dd.syncStatus.error && <div className="mt-2 text-xs text-red-600">Last sync: {dd.syncStatus.error}</div>}
          </>
        )}
      </Card>

      {/* Postmaster */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><Activity className="size-4" /> Google Postmaster Tools</h3>
          <Button size="sm" variant="outline" onClick={() => syncPm.mutate()} disabled={syncPm.isPending}><RefreshCw className={`mr-2 size-4 ${syncPm.isPending ? "animate-spin" : ""}`} /> Sync now</Button>
        </div>
        {!pp?.config.configured ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Not configured. Add the domain in Google Postmaster Tools and set <code>POSTMASTER_ACCESS_TOKEN</code> or a service-account <code>POSTMASTER_SA_KEY</code>.</div>
        ) : pp.latest.length === 0 ? (
          <div className="text-sm text-muted-foreground">No data yet — Postmaster needs sustained volume before Gmail publishes stats.</div>
        ) : (
          <div className="space-y-2">
            {pp.latest.map((l) => (
              <div key={l.domain} className="rounded border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{l.domain}</span>
                  <span className={`font-semibold ${repColor(l.domainReputation)}`}>{l.domainReputation || "—"}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>spam {l.spamRate == null ? "—" : `${(l.spamRate * 100).toFixed(2)}%`}</span>
                  <span>SPF {l.spfRatio == null ? "—" : `${Math.round(l.spfRatio * 100)}%`}</span>
                  <span>DKIM {l.dkimRatio == null ? "—" : `${Math.round(l.dkimRatio * 100)}%`}</span>
                  <span>DMARC {l.dmarcRatio == null ? "—" : `${Math.round(l.dmarcRatio * 100)}%`}</span>
                  <span>· {l.day}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────
type DeliverabilitySection = "health" | "dns" | "warmup" | "content" | "blacklist" | "safety" | "monitoring";
const SECTION_TABS: { id: DeliverabilitySection; label: string; Icon: any }[] = [
  { id: "health", label: "Health & roadmap", Icon: Activity },
  { id: "dns", label: "Subdomain & DNS", Icon: Globe },
  { id: "warmup", label: "Warmup", Icon: Flame },
  { id: "safety", label: "Sending & safety", Icon: Server },
  { id: "content", label: "Inbox placement", Icon: FlaskConical },
  { id: "monitoring", label: "Monitoring", Icon: ShieldCheck },
  { id: "blacklist", label: "Blacklist", Icon: Ban },
];

export default function EmailDeliverabilityTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [section, setSection] = useState<DeliverabilitySection>("health");

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
        {section === "health" && (
          <Button variant="outline" size="sm" onClick={rerun} disabled={auth.isFetching || metrics.isFetching}>
            <RefreshCw className={`mr-2 size-4 ${auth.isFetching || metrics.isFetching ? "animate-spin" : ""}`} /> Re-run checks
          </Button>
        )}
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-1 border-b">
        {SECTION_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${section === t.id ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <t.Icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {section === "dns" && <DnsSetupPanel />}
      {section === "warmup" && <WarmupPanel />}
      {section === "safety" && <SendingSafetyPanel />}
      {section === "content" && (
        <div className="space-y-4">
          <InboxPlacementTest />
          <SeedTestPanel />
        </div>
      )}
      {section === "monitoring" && <MonitoringPanel />}
      {section === "blacklist" && <BlacklistPanel />}

      {section === "health" && (
      <>
      <ScoreCard />
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
      </>
      )}
    </div>
  );
}
