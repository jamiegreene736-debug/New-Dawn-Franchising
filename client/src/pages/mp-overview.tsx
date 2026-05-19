import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, ReferenceLine,
} from "recharts";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, ArrowRight,
  Minus, CheckCircle2, Send, Mail, MessageSquare, Calendar, Users,
  Zap, Activity, Clock, Target, Info, Settings, X, GripVertical,
  MailOpen, MousePointer2, Bookmark, Star, AlertTriangle, Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api/franchisee${path}`, { headers: { "Content-Type": "application/json" }, credentials: "include", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data as T;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className ?? ""}`} />;
}

// ─── Zone 1: Agent Status Bar ─────────────────────────────────────────────────

type AgentState = "pending" | "approved" | "executed" | "held" | "not_executed" | "no_brief";

const AGENT_CFG: Record<AgentState, { bg: string; text: string; border: string; cta: string; ctaNav: string }> = {
  pending:      { bg: "bg-yellow-50",  text: "text-yellow-800", border: "border-l-yellow-400", cta: "View & Approve Brief →",  ctaNav: "outreach"  },
  approved:     { bg: "bg-blue-50",    text: "text-blue-800",   border: "border-l-blue-400",   cta: "View Activity →",          ctaNav: "outreach"  },
  executed:     { bg: "bg-green-50",   text: "text-green-800",  border: "border-l-green-500",  cta: "View Summary →",           ctaNav: "reports"   },
  held:         { bg: "bg-gray-100",   text: "text-gray-700",   border: "border-l-gray-400",   cta: "Review in Outreach →",     ctaNav: "outreach"  },
  not_executed: { bg: "bg-red-50",     text: "text-red-800",    border: "border-l-red-400",    cta: "Review →",                 ctaNav: "outreach"  },
  no_brief:     { bg: "bg-slate-50",   text: "text-slate-600",  border: "border-l-slate-300",  cta: "",                         ctaNav: "outreach"  },
};

function AgentStatusBar({ state, data, onNavigate }: { state: AgentState; data: any; onNavigate: (v: string) => void }) {
  const cfg = AGENT_CFG[state];
  const messages: Record<AgentState, React.ReactNode> = {
    pending:      <><span className="mr-1.5">⏳</span>Today's outreach brief is ready and waiting for your approval.</>,
    approved:     <><span className="inline-block size-2 rounded-full bg-blue-500 animate-pulse mr-2" />Agent is executing — <strong>{data?.sending ?? "?"}</strong> messages are being sent right now.</>,
    executed:     <><span className="mr-1.5">✅</span>Done for today — <strong>{data?.emails ?? 0}</strong> emails, <strong>{data?.whatsapp ?? 0}</strong> WhatsApp, <strong>{data?.letters ?? 0}</strong> letters queued.</>,
    held:         <><span className="mr-1.5">⏸️</span>Today's outreach was held. Nothing was sent.</>,
    not_executed: <><span className="mr-1.5">⚠️</span>Today's brief expired without approval. Messages rolled over to tomorrow.</>,
    no_brief:     <>Agent is preparing today's brief. Check back at 7:00 AM.</>,
  };
  return (
    <div className={`border-b border-l-4 ${cfg.bg} ${cfg.border}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
        <p className={`flex-1 text-sm font-medium ${cfg.text}`}>{messages[state]}</p>
        {cfg.cta && (
          <button onClick={() => onNavigate(cfg.ctaNav)} className={`shrink-0 text-xs font-bold ${cfg.text} underline underline-offset-2 hover:no-underline whitespace-nowrap`}>
            {cfg.cta}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Zone 2: KPI Cards ────────────────────────────────────────────────────────

const COLOR_MAP = {
  green:   { val: "text-green-700",  pill: "bg-green-100 text-green-700",  ring: "border-green-100"  },
  red:     { val: "text-red-600",    pill: "bg-red-100 text-red-700",      ring: "border-red-100"    },
  amber:   { val: "text-amber-600",  pill: "bg-amber-100 text-amber-700",  ring: "border-amber-100"  },
  neutral: { val: "text-gray-900",   pill: "bg-gray-100 text-gray-600",    ring: "border-gray-100"   },
  blue:    { val: "text-indigo-700", pill: "bg-indigo-100 text-indigo-700",ring: "border-indigo-100" },
};

function KpiCard({ title, value, delta, deltaLabel, subLine, color, onClick, trend, tooltip }:
  { title: string; value: string; delta?: string; deltaLabel?: string; subLine?: string;
    color: keyof typeof COLOR_MAP; onClick?: () => void; trend?: "up" | "down" | "flat"; tooltip?: string }) {
  const [showTip, setShowTip] = useState(false);
  const c = COLOR_MAP[color];
  return (
    <button onClick={onClick} className={`rounded-xl border-2 ${c.ring} bg-white p-4 text-left hover:border-indigo-200 hover:shadow-sm transition-all group relative`}>
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-indigo-500 transition-colors leading-tight">{title}</p>
        {tooltip && (
          <button onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)} onClick={e => e.stopPropagation()} className="shrink-0 mt-0.5">
            <Info className="size-3 text-gray-300 hover:text-gray-500" />
          </button>
        )}
      </div>
      {showTip && <div className="absolute right-2 top-8 z-10 w-52 rounded-lg border bg-white p-2 shadow-lg text-xs text-gray-600">{tooltip}</div>}
      <p className={`text-3xl font-black ${c.val} leading-none mb-2 tracking-tight`}>{value}</p>
      {delta && (
        <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.pill}`}>
          {trend === "up"   && <ArrowUpRight className="size-3" />}
          {trend === "down" && <ArrowDownRight className="size-3" />}
          {trend === "flat" && <Minus className="size-3" />}
          {delta}
        </span>
      )}
      {deltaLabel && <p className="text-[11px] text-gray-400 mt-1">{deltaLabel}</p>}
      {subLine && <p className="text-[11px] text-gray-400 mt-2 pt-2 border-t">{subLine}</p>}
    </button>
  );
}

function KpiZone({ summary, prefs, onNavigate }: { summary: any; prefs: any; onNavigate: (v: string) => void }) {
  const target = prefs?.consultationTarget ?? 4;
  const fee    = prefs?.avgManagementFee ?? 120;
  if (!summary) return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-36" />)}
    </div>
  );
  const openColor: keyof typeof COLOR_MAP = summary.emailOpenRate >= 35 ? "green" : summary.emailOpenRate >= 20 ? "amber" : "red";
  const replyColor: keyof typeof COLOR_MAP = summary.replyRate >= 8 ? "green" : summary.replyRate >= 4 ? "amber" : "red";
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCard title="Total Active Leads" value={summary.activeLeads.toString()} delta="+3 this week" trend="up"
        deltaLabel="Excludes Cold & DNC" color="neutral" onClick={() => onNavigate("pipeline")} />
      <KpiCard title="🔴 Hot Leads" value={summary.hotLeads.toString()} delta="+1 vs last week" trend="up"
        subLine={`${summary.hotLeadsVerified} verified addr · letter ready`} color="red" onClick={() => onNavigate("pipeline")} />
      <KpiCard title="Consultations Booked" value={summary.consultationsBooked.toString()}
        delta={summary.consultationsBooked >= target ? `✓ Above ${target}/mo target` : `Target: ${target}/mo`}
        trend={summary.consultationsBooked >= target ? "up" : "flat"}
        subLine={summary.nextConsultation ? `Next: ${summary.nextConsultation.date} · ${summary.nextConsultation.name}` : "No consultations yet"}
        color={summary.consultationsBooked >= target ? "green" : "amber"}
        onClick={() => onNavigate("outreach")} />
      <KpiCard title="Outreach Sent Today" value={summary.outreachSentToday.toString()}
        delta={`${summary.emailsSentToday} emails / ${summary.whatsappSentToday} WhatsApp`}
        color={summary.outreachSentToday > 0 ? "blue" : "neutral"} onClick={() => onNavigate("outreach")} />
      <KpiCard title="Email Open Rate (30d)" value={`${summary.emailOpenRate}%`} delta="+7% vs last month" trend="up"
        deltaLabel={openColor === "green" ? "Above 35% target ✓" : "Target: 35%"} color={openColor}
        onClick={() => onNavigate("reports")} />
      <KpiCard title="Reply Rate (30d)" value={`${summary.replyRate}%`} delta="+2.1% vs last month" trend="up"
        deltaLabel={replyColor === "green" ? "Above 8% target ✓" : "Target: 8%"} color={replyColor}
        onClick={() => onNavigate("reports")} />
      <KpiCard title="Active Managed Props." value={summary.activeProperties.toString()}
        delta={summary.activeProperties === 0 ? "First client waiting in Pipeline →" : "+0 this month"}
        trend="flat" color="neutral"
        subLine={summary.activeProperties > 0 ? `$${(summary.activeProperties * fee).toLocaleString()}/mo revenue` : undefined} />
      <KpiCard title="Est. Pipeline Value" value={`$${summary.pipelineValue.toLocaleString()}/mo`}
        delta="+$360 vs last week" trend="up"
        color="green" onClick={() => onNavigate("reports")}
        tooltip={`Based on ${summary.activeLeads} leads × avg $${fee}/mo × 15% est. conversion rate`} />
    </div>
  );
}

// ─── Zone 3: Pipeline Health ──────────────────────────────────────────────────

function ConvBadge({ rate }: { rate: number }) {
  const color = rate >= 50 ? "text-green-600 bg-green-50" : rate >= 30 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>{rate}% →</span>;
}

const TIER_DOTS: Record<string, string> = { Hot: "🔴", Warm: "🟠", Nurture: "🟡", Watch: "🔵", Cold: "⚪" };

function PipelineHealthZone({ health, onNavigate }: { health: any; onNavigate: (v: string) => void }) {
  if (!health) return <Skeleton className="h-64" />;
  const { stages, conversions, tiers, velocity } = health;
  const maxCount = Math.max(...stages.map((s: any) => s.count));
  const activeTotal = tiers.filter((t: any) => t.tier !== "Cold").reduce((sum: number, t: any) => sum + t.count, 0);

  return (
    <div className="grid sm:grid-cols-12 gap-4">
      {/* A: Stage Funnel */}
      <div className="sm:col-span-5 rounded-xl border bg-white p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
          Stage Funnel
          <button onClick={() => onNavigate("pipeline")} className="text-xs text-indigo-500 font-medium hover:underline ml-auto">View all →</button>
        </h3>
        <div className="space-y-2">
          {stages.map((s: any, i: number) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs text-gray-500 w-28 truncate shrink-0">{s.stage}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                  <div className="h-full rounded transition-all" style={{ width: `${(s.count / maxCount) * 100}%`, backgroundColor: s.color }} />
                </div>
                <span className="text-xs font-bold text-gray-700 w-4 text-right">{s.count}</span>
              </div>
              {i < conversions.length && <div className="ml-28 pl-2"><ConvBadge rate={conversions[i].rate} /></div>}
            </div>
          ))}
        </div>
      </div>

      {/* B: Tier Donut */}
      <div className="sm:col-span-3 rounded-xl border bg-white p-5 flex flex-col items-center">
        <h3 className="font-bold text-gray-900 text-sm mb-2 self-start">Lead Tiers</h3>
        <div className="relative">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie data={tiers} cx="50%" cy="50%" innerRadius={42} outerRadius={62} dataKey="count" paddingAngle={3}>
                {tiers.map((t: any, i: number) => <Cell key={i} fill={t.color} />)}
              </Pie>
              <ReTooltip formatter={(v: any, n: any, p: any) => [v, p.payload.tier]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-black text-gray-900">{activeTotal}</span>
            <span className="text-[10px] text-gray-400 font-medium">active</span>
          </div>
        </div>
        <div className="space-y-1 w-full mt-2">
          {tiers.map((t: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1"><span>{TIER_DOTS[t.tier]}</span>{t.tier}</span>
              <span className="font-semibold text-gray-700">{t.count} <span className="text-gray-400 font-normal">({Math.round(t.count / tiers.reduce((s: number, x: any) => s + x.count, 0) * 100)}%)</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* C: Velocity */}
      <div className="sm:col-span-4 rounded-xl border bg-white p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-4">Pipeline Velocity</h3>
        <div className="space-y-4">
          {[
            { label: "Lead → First Contact",        value: velocity.leadToContact,          unit: "days", benchmark: 1,  fmt: (v: any) => v < 1 ? `${Math.round(v * 24)}h` : `${v}d` },
            { label: "Contact → Consultation",       value: velocity.contactToConsultation,  unit: "days", benchmark: 14, fmt: (v: any) => `${v}d` },
            { label: "Consultation → Signed Client", value: velocity.consultationToSigned,   unit: "days", benchmark: 21, fmt: (v: any) => v == null ? "—" : `${v}d` },
          ].map((m, i) => {
            const good  = m.value != null && m.value <= m.benchmark;
            const color = m.value == null ? "text-gray-400" : good ? "text-green-600" : "text-amber-600";
            return (
              <div key={i}>
                <p className="text-xs text-gray-500 mb-0.5">{m.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black ${color}`}>{m.fmt(m.value)}</span>
                  <span className="text-[10px] text-gray-400">benchmark: &lt;{m.benchmark}d</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-3 border-t text-xs text-gray-500">
          <span className="font-semibold text-indigo-600">Best source: </span>{velocity.bestSource} — {velocity.bestSourceRate}% conv.
        </div>
      </div>
    </div>
  );
}

// ─── Zone 4: Outreach Performance ─────────────────────────────────────────────

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  );
}

function OutreachZone({ perf }: { perf: any }) {
  if (!perf) return <Skeleton className="h-52" />;
  const { email, whatsapp, letters, approval } = perf;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Email */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <MailOpen className="size-4 text-indigo-500" />
          <h4 className="font-bold text-sm text-gray-900">Email (30d)</h4>
        </div>
        {[
          { label: "Sent",         value: email.sent,          pct: 100,                 color: "#6366f1" },
          { label: "Delivered",    value: `${email.delivered} (${email.deliveredPct}%)`, pct: email.deliveredPct, color: "#8b5cf6" },
          { label: "Opened",       value: `${email.opened} (${email.openedPct}%)`,       pct: email.openedPct,    color: "#10b981" },
          { label: "Replied",      value: `${email.replied} (${email.repliedPct}%)`,     pct: email.repliedPct,   color: "#f59e0b" },
          { label: "Clicked",      value: `${email.clicked} (${email.clickedPct}%)`,     pct: email.clickedPct,   color: "#3b82f6" },
          { label: "Bounced",      value: email.bounced,                                 pct: (email.bounced / email.sent) * 100, color: "#ef4444" },
          { label: "Unsubscribed", value: email.unsubscribed,                            pct: 0, color: "#9ca3af" },
        ].map((r, i) => (
          <div key={i} className="mb-2">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-500">{r.label}</span>
              <span className="font-semibold text-gray-800">{typeof r.value === "number" ? r.value : r.value}</span>
            </div>
            <MiniBar pct={r.pct} color={r.color} />
          </div>
        ))}
      </div>

      {/* WhatsApp */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="size-4 text-green-500" />
          <h4 className="font-bold text-sm text-gray-900">WhatsApp (30d)</h4>
          <span className={`ml-auto text-[10px] font-bold px-1.5 rounded-full ${whatsapp.connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {whatsapp.connected ? "✓ Connected" : "⚠ Disconnected"}
          </span>
        </div>
        {[
          { label: "Sent",      value: whatsapp.sent,                                pct: 100,                color: "#22c55e" },
          { label: "Delivered", value: `${whatsapp.delivered} (${whatsapp.deliveredPct}%)`, pct: whatsapp.deliveredPct, color: "#16a34a" },
          { label: "Read",      value: `${whatsapp.read} (${whatsapp.readPct}%)`,    pct: whatsapp.readPct,   color: "#15803d" },
          { label: "Replied",   value: `${whatsapp.replied} (${whatsapp.repliedPct}%)`, pct: whatsapp.repliedPct, color: "#f59e0b" },
          { label: "Opted Out", value: whatsapp.optedOut,                            pct: (whatsapp.optedOut / whatsapp.sent) * 100, color: "#ef4444" },
        ].map((r, i) => (
          <div key={i} className="mb-2">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-gray-500">{r.label}</span>
              <span className="font-semibold text-gray-800">{typeof r.value === "number" ? r.value : r.value}</span>
            </div>
            <MiniBar pct={r.pct} color={r.color} />
          </div>
        ))}
      </div>

      {/* Letters/Lob */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mail className="size-4 text-amber-500" />
          <h4 className="font-bold text-sm text-gray-900">Physical Mail (30d)</h4>
        </div>
        <div className="space-y-2">
          {[
            { label: "Sent This Month",        value: letters.sentThisMonth },
            { label: "In Transit",             value: letters.inTransit },
            { label: "Est. Delivered",         value: letters.delivered },
            { label: "Returned",               value: letters.returned },
            { label: "Total Spend",            value: `$${letters.totalSpend.toFixed(2)}` },
            { label: "Avg Cost Per Letter",    value: `$${letters.avgCost.toFixed(2)}` },
            { label: "Consultations (14d)",    value: letters.consultationsFromLetters },
          ].map((r, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-500">{r.label}</span>
              <span className="font-semibold text-gray-800">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Approvals */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="size-4 text-purple-500" />
          <h4 className="font-bold text-sm text-gray-900">Agent Approvals</h4>
        </div>
        <div className="space-y-2 mb-4">
          {[
            { label: "Days Briefed",   value: `${approval.daysBriefed} / ${approval.daysInMonth}` },
            { label: "Days Approved",  value: `${approval.daysApproved} (${approval.approvedPct}%)` },
            { label: "Days Held",      value: approval.daysHeld },
            { label: "Avg Approval",   value: `${approval.avgApprovalMins} min after brief` },
          ].map((r, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-500">{r.label}</span>
              <span className="font-semibold text-gray-800">{r.value}</span>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Approval rate</span>
            <span className="font-bold text-purple-600">{approval.approvedPct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${approval.approvedPct}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">You've approved {approval.approvedPct}% of briefs this month</p>
        </div>
      </div>
    </div>
  );
}

// ─── Zone 5: Activity Feed ────────────────────────────────────────────────────

const ICON_MAP: Record<string, { Icon: any; color: string; bg: string }> = {
  lead:       { Icon: Users,          color: "text-gray-500",   bg: "bg-gray-100"   },
  email_sent: { Icon: Send,           color: "text-indigo-500", bg: "bg-indigo-50"  },
  reply:      { Icon: ArrowRight,     color: "text-green-500",  bg: "bg-green-50"   },
  email_open: { Icon: MailOpen,       color: "text-blue-500",   bg: "bg-blue-50"    },
  link_click: { Icon: MousePointer2,  color: "text-purple-500", bg: "bg-purple-50"  },
  booking:    { Icon: Calendar,       color: "text-purple-600", bg: "bg-purple-50"  },
  letter:     { Icon: Mail,           color: "text-amber-500",  bg: "bg-amber-50"   },
  score_up:   { Icon: TrendingUp,     color: "text-green-500",  bg: "bg-green-50"   },
  score_down: { Icon: TrendingDown,   color: "text-red-400",    bg: "bg-red-50"     },
  brief:      { Icon: Zap,            color: "text-indigo-500", bg: "bg-indigo-50"  },
  executed:   { Icon: CheckCircle2,   color: "text-green-600",  bg: "bg-green-50"   },
  held:       { Icon: AlertTriangle,  color: "text-gray-500",   bg: "bg-gray-100"   },
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function ActivityFeed({ autoRefresh }: { autoRefresh: boolean }) {
  const { data, refetch } = useQuery({
    queryKey: ["/api/franchisee/dashboard/activity-feed"],
    queryFn: () => api<{ feed: any[]; total: number }>("/dashboard/activity-feed?limit=20"),
    refetchInterval: autoRefresh ? 60000 : false,
  });

  const feed = data?.feed ?? [];

  return (
    <div className="rounded-xl border bg-white p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Live Activity Feed</h3>
        <button onClick={() => refetch()} className="text-[10px] text-gray-400 hover:text-indigo-500 font-medium">↻ Refresh</button>
      </div>
      {!feed.length ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Activity className="size-8 text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">No activity yet</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {feed.map((item: any) => {
            const cfg = ICON_MAP[item.icon] ?? ICON_MAP.brief;
            return (
              <div key={item.id} className="flex gap-3">
                <div className={`size-7 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <cfg.Icon className={`size-3.5 ${cfg.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 leading-snug">{item.text}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(item.time)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Zone 5: Upcoming Actions ─────────────────────────────────────────────────

function UpcomingActions({ actions, onNavigate }: { actions: any; onNavigate: (v: string) => void }) {
  if (!actions) return <Skeleton className="h-64" />;
  const sections = [
    { key: "today",    label: "Today",     badge: "bg-red-100 text-red-700",   items: actions.today    },
    { key: "thisWeek", label: "This Week", badge: "bg-amber-100 text-amber-700", items: actions.thisWeek },
    { key: "watch",    label: "Watch",     badge: "bg-blue-100 text-blue-700",  items: actions.watch    },
  ];
  const allEmpty = sections.every(s => !s.items?.length);
  return (
    <div className="rounded-xl border bg-white p-5 h-full">
      <h3 className="font-bold text-gray-900 mb-4">Upcoming Actions</h3>
      {allEmpty ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="size-8 text-green-400 mb-2" />
          <p className="font-semibold text-green-700">You're all caught up!</p>
          <p className="text-xs text-gray-400 mt-1">No urgent actions right now.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map(s => s.items?.length > 0 && (
            <div key={s.key}>
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 ${s.badge}`}>{s.label}</span>
              <div className="space-y-2">
                {s.items.map((item: any, i: number) => (
                  <button key={i} onClick={() => onNavigate(item.cta)}
                    className="w-full flex items-start gap-2 text-left hover:bg-gray-50 rounded-lg px-2 py-1.5 -mx-2 group transition-colors">
                    <ArrowRight className="size-3.5 text-gray-300 group-hover:text-indigo-400 mt-1 shrink-0 transition-colors" />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Zone 6: Mini Charts ──────────────────────────────────────────────────────

function ChartsZone({ sparklines }: { sparklines: any }) {
  if (!sparklines) return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-36" />)}
    </div>
  );
  const { leadsPerDay, outreachPerDay, replyRateWeekly, consultationsWeekly } = sparklines;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {/* Leads per day */}
      <div className="rounded-xl border bg-white p-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Leads / Day (30d)</p>
        <p className="text-2xl font-black text-gray-900 mb-1">{(leadsPerDay.reduce((s: number, d: any) => s + d.value, 0) / 30).toFixed(1)}<span className="text-sm font-normal text-gray-400"> avg/d</span></p>
        <ResponsiveContainer width="100%" height={56}>
          <AreaChart data={leadsPerDay} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <defs><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
            <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#gl)" strokeWidth={1.5} dot={false} />
            <ReTooltip contentStyle={{ fontSize: 11 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Outreach per day */}
      <div className="rounded-xl border bg-white p-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Outreach / Day (30d)</p>
        <p className="text-2xl font-black text-gray-900 mb-1">{(outreachPerDay.reduce((s: number, d: any) => s + d.email + d.whatsapp, 0) / 30).toFixed(1)}<span className="text-sm font-normal text-gray-400"> avg/d</span></p>
        <ResponsiveContainer width="100%" height={56}>
          <BarChart data={outreachPerDay} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <Bar dataKey="email"     stackId="a" fill="#6366f1" radius={[0,0,0,0]} />
            <Bar dataKey="whatsapp"  stackId="a" fill="#22c55e" radius={[0,0,0,0]} />
            <Bar dataKey="letter"    stackId="a" fill="#f59e0b" radius={[2,2,0,0]} />
            <ReTooltip contentStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Reply rate weekly */}
      <div className="rounded-xl border bg-white p-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Reply Rate % (8w)</p>
        <p className="text-2xl font-black text-gray-900 mb-1">{replyRateWeekly[replyRateWeekly.length - 1]?.rate ?? 0}%<span className="text-sm font-normal text-gray-400"> this week</span></p>
        <ResponsiveContainer width="100%" height={56}>
          <LineChart data={replyRateWeekly} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <Line type="monotone" dataKey="rate" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            <ReferenceLine y={8} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} />
            <ReTooltip contentStyle={{ fontSize: 11 }} formatter={(v: any) => [`${v}%`, "Rate"]} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Consultations weekly */}
      <div className="rounded-xl border bg-white p-4">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Consultations / Wk (8w)</p>
        <p className="text-2xl font-black text-gray-900 mb-1">{consultationsWeekly[consultationsWeekly.length - 1]?.booked ?? 0}<span className="text-sm font-normal text-gray-400"> this week</span></p>
        <ResponsiveContainer width="100%" height={56}>
          <BarChart data={consultationsWeekly} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <Bar dataKey="booked" fill="#10b981" radius={[3,3,0,0]} />
            <ReferenceLine y={1} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
            <ReTooltip contentStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Customise Dashboard Panel ────────────────────────────────────────────────

function CustomisePanel({ prefs, onClose, onSave }: { prefs: any; onClose: () => void; onSave: (p: any) => void }) {
  const [local, setLocal] = useState({ ...prefs });
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-80 bg-white border-l shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">Customise Dashboard</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 text-gray-400"><X className="size-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Monthly Consultation Target</label>
            <div className="flex items-center gap-3">
              <input type="number" min={1} max={20} value={local.consultationTarget}
                onChange={e => setLocal((p: any) => ({ ...p, consultationTarget: parseInt(e.target.value) || 4 }))}
                className="w-20 rounded-lg border px-3 py-2 text-sm font-semibold text-center focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <span className="text-sm text-gray-500">consultations / month</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Avg Management Fee Per Property</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">$</span>
              <input type="number" min={50} max={500} step={10} value={local.avgManagementFee}
                onChange={e => setLocal((p: any) => ({ ...p, avgManagementFee: parseFloat(e.target.value) || 120 }))}
                className="w-24 rounded-lg border px-3 py-2 text-sm font-semibold text-center focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <span className="text-sm text-gray-500">/ month</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Used to calculate estimated pipeline value</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Default Date Range</label>
            <div className="flex gap-2">
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setLocal((p: any) => ({ ...p, defaultDateRange: d }))}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${local.defaultDateRange === d ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "text-gray-500 hover:border-gray-300"}`}>
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-10 h-5 rounded-full transition-colors ${local.activityFeedAutoRefresh ? "bg-indigo-500" : "bg-gray-300"}`}
                onClick={() => setLocal((p: any) => ({ ...p, activityFeedAutoRefresh: !p.activityFeedAutoRefresh }))}>
                <div className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${local.activityFeedAutoRefresh ? "translate-x-5" : ""}`} />
              </div>
              <span className="text-sm text-gray-700">Activity feed auto-refresh (60s)</span>
            </label>
          </div>
        </div>
        <div className="border-t px-5 py-4 flex gap-3">
          <Button onClick={() => { onSave(local); onClose(); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700">Save Changes</Button>
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Overview Dashboard ──────────────────────────────────────────────────

export function MpOverview({ franchisee, onNavigate }: { franchisee: any; onNavigate: (v: string) => void }) {
  const queryClient = useQueryClient();
  const [showCustomise, setShowCustomise] = useState(false);

  const { data: summary }   = useQuery({ queryKey: ["/api/franchisee/dashboard/summary"],             queryFn: () => api<any>("/dashboard/summary"),             staleTime: 30000 });
  const { data: health }    = useQuery({ queryKey: ["/api/franchisee/dashboard/pipeline-health"],     queryFn: () => api<any>("/dashboard/pipeline-health"),     staleTime: 60000 });
  const { data: perf }      = useQuery({ queryKey: ["/api/franchisee/dashboard/outreach-performance"],queryFn: () => api<any>("/dashboard/outreach-performance"), staleTime: 60000 });
  const { data: actions }   = useQuery({ queryKey: ["/api/franchisee/dashboard/upcoming-actions"],    queryFn: () => api<any>("/dashboard/upcoming-actions"),    staleTime: 60000 });
  const { data: sparklines } = useQuery({ queryKey: ["/api/franchisee/dashboard/sparklines"],         queryFn: () => api<any>("/dashboard/sparklines"),          staleTime: 120000 });
  const { data: prefs }     = useQuery({ queryKey: ["/api/franchisee/dashboard/preferences"],         queryFn: () => api<any>("/dashboard/preferences"),         staleTime: 300000 });

  const savePrefsMutation = useMutation({
    mutationFn: (p: any) => api("/dashboard/preferences", { method: "PATCH", body: JSON.stringify(p) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/franchisee/dashboard/preferences"] }),
  });

  const agentState: AgentState = (summary?.agentState as AgentState) ?? "pending";
  const agentStateData = { emails: 6, whatsapp: 2, letters: 1, sending: 3 };

  return (
    <div className="flex flex-col min-h-full">
      <AgentStatusBar state={agentState} data={agentStateData} onNavigate={onNavigate} />

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Welcome + customise */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-700 text-white px-5 py-4 flex-1">
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-wide mb-0.5">Marketing Portal · Overview</p>
            <h1 className="text-xl font-bold">Welcome back, {franchisee.firstName}!</h1>
            <p className="text-indigo-300 text-sm mt-0.5">{franchisee.territory ?? "El Paso, TX"} · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
          </div>
          <Button onClick={() => setShowCustomise(true)} variant="outline" className="gap-2 h-full rounded-xl border-2 shrink-0">
            <Settings className="size-4" /> Customise
          </Button>
        </div>

        {/* Zone 2: KPIs */}
        <div>
          <SectionHeader title="Key Metrics" />
          <KpiZone summary={summary} prefs={prefs} onNavigate={onNavigate} />
        </div>

        {/* Zone 3: Pipeline Health */}
        <div>
          <SectionHeader title="Pipeline Health" />
          <PipelineHealthZone health={health} onNavigate={onNavigate} />
        </div>

        {/* Zone 4: Outreach Performance */}
        <div>
          <SectionHeader title="Outreach Performance · Last 30 Days" />
          <OutreachZone perf={perf} />
        </div>

        {/* Zone 5: Activity + Upcoming */}
        <div>
          <SectionHeader title="Activity & Upcoming" />
          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <ActivityFeed autoRefresh={prefs?.activityFeedAutoRefresh ?? true} />
            </div>
            <div className="lg:col-span-2">
              <UpcomingActions actions={actions} onNavigate={onNavigate} />
            </div>
          </div>
        </div>

        {/* Zone 6: Charts */}
        <div>
          <SectionHeader title="30-Day Trends" />
          <ChartsZone sparklines={sparklines} />
        </div>
      </div>

      {showCustomise && (
        <CustomisePanel prefs={prefs} onClose={() => setShowCustomise(false)} onSave={(p) => savePrefsMutation.mutate(p)} />
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">{title}</h2>;
}
