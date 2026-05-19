import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid,
} from "recharts";
import { Download, Mail, MessageSquare, FileText, TrendingUp, Users, DollarSign, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Demo data ────────────────────────────────────────────────────────────────

const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const weeks8 = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];

const emailData = months.map((m, i) => ({
  month: m, sent: 30 + i * 8, delivered: 29 + i * 8, opened: 10 + i * 4, replied: 2 + i, bounced: Math.max(0, 2 - i),
}));

const whatsappData = months.map((m, i) => ({
  month: m, sent: 20 + i * 5, delivered: 19 + i * 5, read: 14 + i * 4, replied: 3 + i,
}));

const lettersData = months.map((m, i) => ({
  month: m, sent: i === 5 ? 1 : 0, cost: i === 5 ? 3.40 : 0, delivered: 0,
}));

const pipelineStagesData = months.map((m, i) => ({
  month: m,
  "New Lead": 4 + i, "Contacted": 2 + i, "Replied": 1 + Math.floor(i/2),
  "Call Scheduled": Math.floor(i/2), "Converted": Math.max(0, Math.floor(i/3) - 1),
}));

const conversionRates = weeks8.map((w, i) => ({
  week: w, contacted: 60 + Math.sin(i) * 10, replied: 45 + Math.sin(i+1) * 8, conversion: 8 + Math.sin(i+2) * 4,
}));

const sourceData = [
  { source: "Zillow FSBO",     leads: 3, converted: 1, rate: 33 },
  { source: "Referral",        leads: 1, converted: 1, rate: 100 },
  { source: "Facebook Group",  leads: 2, converted: 0, rate: 0 },
  { source: "Craigslist",      leads: 1, converted: 0, rate: 0 },
  { source: "Nextdoor",        leads: 1, converted: 0, rate: 0 },
  { source: "Google Ads",      leads: 1, converted: 0, rate: 0 },
];

const revenueData = months.map((m, i) => ({
  month: m, current: i * 0, projected3m: 120 + i * 120, projected6m: 120 + i * 240,
}));

// ─── Tab config ───────────────────────────────────────────────────────────────

const REPORT_TABS = [
  { key: "overview",       label: "Overview",         icon: BarChart2 },
  { key: "email",          label: "Email",            icon: Mail      },
  { key: "whatsapp",       label: "WhatsApp",         icon: MessageSquare },
  { key: "letters",        label: "Letters",          icon: FileText  },
  { key: "pipeline",       label: "Pipeline Trends",  icon: TrendingUp },
  { key: "sources",        label: "Lead Sources",     icon: Users     },
  { key: "revenue",        label: "Revenue Forecast", icon: DollarSign },
  { key: "export",         label: "Export",           icon: Download  },
] as const;
type ReportTab = typeof REPORT_TABS[number]["key"];

// ─── Chart wrapper ────────────────────────────────────────────────────────────

function Card({ title, children, sub }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <h3 className="font-bold text-gray-900 mb-0.5">{title}</h3>
      {sub && <p className="text-xs text-gray-400 mb-4">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </div>
  );
}

function MetricGrid({ items }: { items: { label: string; value: string; sub?: string; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map((m, i) => (
        <div key={i} className="rounded-xl border bg-white p-4 text-center">
          <p className={`text-3xl font-black ${m.color ?? "text-gray-900"}`}>{m.value}</p>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">{m.label}</p>
          {m.sub && <p className="text-[11px] text-gray-400 mt-0.5">{m.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-5">
      <MetricGrid items={[
        { label: "Total Leads (30d)", value: "7",    color: "text-indigo-700" },
        { label: "Outreach Sent",     value: "84",   color: "text-gray-900"   },
        { label: "Open Rate",         value: "42%",  color: "text-green-700"  },
        { label: "Consultations",     value: "1",    color: "text-purple-700" },
      ]} />
      <div className="grid sm:grid-cols-2 gap-4">
        <Card title="Lead Volume Trend" sub="Last 6 months">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={pipelineStagesData}>
              <defs><linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
              <Area type="monotone" dataKey="New Lead" stroke="#6366f1" fill="url(#gp)" strokeWidth={2} dot={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Funnel Conversion Rates" sub="Last 8 weeks">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={conversionRates}>
              <Line type="monotone" dataKey="contacted" stroke="#6366f1" strokeWidth={2} dot={false} name="Contacted %" />
              <Line type="monotone" dataKey="replied"   stroke="#10b981" strokeWidth={2} dot={false} name="Replied %"   />
              <Line type="monotone" dataKey="conversion"stroke="#f59e0b" strokeWidth={2} dot={false} name="Reply Rate %" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card title="Period vs Period Comparison" sub="Current 30 days vs previous 30 days">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 font-semibold text-gray-500 pr-8">Metric</th>
              <th className="text-right py-2 font-semibold text-gray-500 pr-8">This Period</th>
              <th className="text-right py-2 font-semibold text-gray-500 pr-8">Last Period</th>
              <th className="text-right py-2 font-semibold text-gray-500">Change</th>
            </tr></thead>
            <tbody className="divide-y text-sm">
              {[
                { metric: "Leads Discovered",   curr: "7",    prev: "4",    change: "+75%",  pos: true  },
                { metric: "Outreach Sent",       curr: "84",   prev: "62",   change: "+35%",  pos: true  },
                { metric: "Email Open Rate",     curr: "42%",  prev: "35%",  change: "+7pp",  pos: true  },
                { metric: "Reply Rate",          curr: "9.5%", prev: "7.3%", change: "+2.2pp",pos: true  },
                { metric: "Consultations",       curr: "1",    prev: "0",    change: "+1",    pos: true  },
                { metric: "Bounced",             curr: "1",    prev: "3",    change: "-2",    pos: true  },
              ].map((r, i) => (
                <tr key={i}>
                  <td className="py-2 text-gray-700 pr-8">{r.metric}</td>
                  <td className="py-2 text-right font-semibold text-gray-900 pr-8">{r.curr}</td>
                  <td className="py-2 text-right text-gray-400 pr-8">{r.prev}</td>
                  <td className={`py-2 text-right font-semibold ${r.pos ? "text-green-600" : "text-red-500"}`}>{r.change}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Email Tab ────────────────────────────────────────────────────────────────

function EmailTab() {
  return (
    <div className="space-y-5">
      <MetricGrid items={[
        { label: "Sent (30d)",    value: "48",  color: "text-indigo-700" },
        { label: "Open Rate",     value: "42%", color: "text-green-700"  },
        { label: "Reply Rate",    value: "8.3%",color: "text-purple-700" },
        { label: "Bounced",       value: "1",   color: "text-red-600"    },
      ]} />
      <Card title="Email Performance Over Time" sub="Last 6 months">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={emailData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="sent"      fill="#6366f1" name="Sent"      radius={[2,2,0,0]} />
            <Bar dataKey="opened"    fill="#10b981" name="Opened"    radius={[2,2,0,0]} />
            <Bar dataKey="replied"   fill="#f59e0b" name="Replied"   radius={[2,2,0,0]} />
            <Bar dataKey="bounced"   fill="#ef4444" name="Bounced"   radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Sequence Performance by Touch" sub="Reply rate per email touch number">
        <div className="space-y-3">
          {[
            { touch: "Touch 1 — Introduction",      sent: 7, openRate: 57, replyRate: 14 },
            { touch: "Touch 2 — Follow-up",         sent: 6, openRate: 50, replyRate: 0  },
            { touch: "Touch 3 — Value add",         sent: 4, openRate: 25, replyRate: 0  },
            { touch: "Touch 4 — Break-up email",    sent: 2, openRate: 100,replyRate: 50 },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-48 shrink-0">
                <p className="text-xs font-semibold text-gray-700">{t.touch}</p>
                <p className="text-[11px] text-gray-400">{t.sent} sent</p>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5"><span className="text-gray-400">Open rate</span><span className="font-semibold">{t.openRate}%</span></div>
                  <div className="h-1.5 rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-400" style={{ width: `${t.openRate}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5"><span className="text-gray-400">Reply rate</span><span className="font-semibold">{t.replyRate}%</span></div>
                  <div className="h-1.5 rounded-full bg-gray-100"><div className="h-full rounded-full bg-green-400" style={{ width: `${t.replyRate}%` }} /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── WhatsApp Tab ─────────────────────────────────────────────────────────────

function WhatsAppTab() {
  return (
    <div className="space-y-5">
      <MetricGrid items={[
        { label: "Sent (30d)",  value: "36",   color: "text-green-700"  },
        { label: "Read Rate",   value: "80%",  color: "text-green-700"  },
        { label: "Reply Rate",  value: "14.3%",color: "text-purple-700" },
        { label: "Opted Out",   value: "1",    color: "text-red-600"    },
      ]} />
      <Card title="WhatsApp Performance Over Time" sub="Last 6 months">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={whatsappData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="sent"      stroke="#22c55e" strokeWidth={2} name="Sent"      />
            <Line type="monotone" dataKey="read"      stroke="#16a34a" strokeWidth={2} name="Read"      />
            <Line type="monotone" dataKey="replied"   stroke="#f59e0b" strokeWidth={2} name="Replied"   />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─── Letters Tab ──────────────────────────────────────────────────────────────

function LettersTab() {
  return (
    <div className="space-y-5">
      <MetricGrid items={[
        { label: "Sent This Month", value: "1",     color: "text-amber-700" },
        { label: "In Transit",      value: "1",     color: "text-blue-700"  },
        { label: "Total Spend",     value: "$3.40", color: "text-gray-900"  },
        { label: "Consultations",   value: "0",     color: "text-gray-400"  },
      ]} />
      <div className="rounded-xl border bg-amber-50/50 border-amber-200 p-5">
        <h3 className="font-bold text-amber-900 mb-1">Letter Status — James Thompson</h3>
        <p className="text-sm text-amber-700">Submitted to Lob on Apr 7 · Est. delivery Apr 10-12 · In transit ✈️</p>
        <div className="flex gap-3 mt-3">
          {["Submitted", "In Transit", "Delivered", "Responded"].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i <= 1 ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-400"}`}>{i + 1}</div>
              <span className={`text-xs ${i <= 1 ? "text-amber-800 font-semibold" : "text-gray-400"}`}>{step}</span>
              {i < 3 && <div className={`h-px w-4 ${i < 1 ? "bg-amber-400" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>
      </div>
      <Card title="Monthly Letter Volume" sub="Letters sent, in transit, delivered by month">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={lettersData}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="sent" fill="#f59e0b" name="Sent" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─── Pipeline Trends Tab ──────────────────────────────────────────────────────

function PipelineTrendsTab() {
  const COLORS = ["#94a3b8", "#60a5fa", "#818cf8", "#a78bfa", "#10b981"];
  const stageKeys = ["New Lead", "Contacted", "Replied", "Call Scheduled", "Converted"];
  return (
    <div className="space-y-5">
      <Card title="Lead Volume by Stage Over Time" sub="Last 6 months — stacked area">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={pipelineStagesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {stageKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.6} strokeWidth={1.5} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Stage Conversion Rates" sub="Week by week conversion improvements">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={conversionRates}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: any) => [`${v.toFixed(1)}%`]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={8} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "8% target", fontSize: 10, fill: "#ef4444" }} />
            <Line type="monotone" dataKey="conversion" stroke="#8b5cf6" strokeWidth={2} name="Reply Rate %" dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ─── Lead Sources Tab ─────────────────────────────────────────────────────────

function LeadSourcesTab() {
  const best = sourceData.reduce((a, b) => b.rate > a.rate ? b : a);
  return (
    <div className="space-y-5">
      <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
        <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-0.5">Best Source This Month</p>
        <p className="font-bold text-green-900">{best.source} — {best.rate}% conversion rate 🏆</p>
      </div>
      <Card title="Leads by Source" sub="Volume and conversion rate by lead source">
        <div className="space-y-3">
          {sourceData.sort((a, b) => b.leads - a.leads).map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-40 shrink-0">
                <p className="text-sm font-semibold text-gray-800">{s.source}</p>
                <p className="text-[11px] text-gray-400">{s.leads} leads · {s.converted} converted</p>
              </div>
              <div className="flex-1">
                <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500 flex items-center justify-end pr-2" style={{ width: `${(s.leads / Math.max(...sourceData.map(x => x.leads))) * 100}%` }}>
                    <span className="text-[10px] text-white font-bold">{s.leads}</span>
                  </div>
                </div>
              </div>
              <div className="w-16 text-right">
                <span className={`text-xs font-bold ${s.rate > 0 ? "text-green-600" : "text-gray-400"}`}>{s.rate}%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Revenue Forecast Tab ─────────────────────────────────────────────────────

function RevenueForecastTab() {
  const projections = [
    { horizon: "3 Months",  mrr: "$360",  props: 3,  assumption: "Based on 1 signed client + 2 projected" },
    { horizon: "6 Months",  mrr: "$840",  props: 7,  assumption: "Based on current pipeline conversion" },
    { horizon: "12 Months", mrr: "$2,040",props: 17, assumption: "Conservative growth estimate" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-4">
        {projections.map((p, i) => (
          <div key={i} className="rounded-xl border-2 bg-white p-5 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{p.horizon}</p>
            <p className="text-3xl font-black text-green-700 mb-1">{p.mrr}<span className="text-sm font-normal text-gray-400">/mo</span></p>
            <p className="text-xs text-gray-500">{p.props} properties</p>
            <p className="text-[11px] text-gray-400 mt-2">{p.assumption}</p>
          </div>
        ))}
      </div>
      <Card title="Estimated MRR Growth" sub="Projected monthly recurring revenue at 15% pipeline conversion">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueData}>
            <defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: any) => [`$${v}`, ""]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="projected3m" stroke="#10b981" fill="url(#gr)" strokeWidth={2} name="Projected (3m)" strokeDasharray="5 5" />
            <Area type="monotone" dataKey="projected6m" stroke="#6366f1" fill="none" strokeWidth={1.5} name="Projected (6m)" strokeDasharray="5 5" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Important Disclaimer</p>
        <p className="text-sm text-amber-800">These projections are estimates only based on current pipeline leads and a 15% assumed conversion rate. Actual results will vary. Past performance is not a guarantee of future results.</p>
      </div>
    </div>
  );
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

function ExportTab() {
  const exports = [
    { label: "Export Leads",             format: "CSV / Excel", icon: Users,        desc: "All pipeline leads with scores, stages, and contact info" },
    { label: "Export Outreach History",  format: "CSV",         icon: Mail,         desc: "Full send history with open/reply timestamps" },
    { label: "Export Letter History",    format: "CSV",         icon: FileText,     desc: "Lob letter records with delivery status" },
    { label: "Performance Report",       format: "PDF (NDF branded)", icon: BarChart2, desc: "Professional summary report with your logo and stats" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {exports.map((e, i) => (
          <div key={i} className="rounded-xl border bg-white p-5 flex items-start gap-4">
            <div className="size-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <e.icon className="size-5 text-indigo-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">{e.label}</p>
              <p className="text-xs text-gray-400 mb-3">{e.desc}</p>
              <Button size="sm" variant="outline" className="gap-2 text-xs">
                <Download className="size-3.5" /> Download {e.format}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-5">
        <h3 className="font-bold text-gray-900 mb-2">Scheduled Weekly Report</h3>
        <p className="text-sm text-gray-500 mb-3">Get a branded PDF performance report emailed to you every Monday morning at 8:00 AM.</p>
        <div className="flex items-center gap-3">
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">Enable Weekly Report</Button>
          <span className="text-xs text-gray-400">Sent to your registered email</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────

export function MpReports() {
  const [tab, setTab] = useState<ReportTab>("overview");

  const content: Record<ReportTab, React.ReactNode> = {
    overview: <OverviewTab />,
    email:    <EmailTab />,
    whatsapp: <WhatsAppTab />,
    letters:  <LettersTab />,
    pipeline: <PipelineTrendsTab />,
    sources:  <LeadSourcesTab />,
    revenue:  <RevenueForecastTab />,
    export:   <ExportTab />,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Historical analysis, charts, and exports</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 overflow-x-auto mb-6 border-b pb-0">
        {REPORT_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}>
            <t.icon className="size-3.5" />{t.label}
          </button>
        ))}
      </div>

      {content[tab]}
    </div>
  );
}
