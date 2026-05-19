import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart2, Search, Link2, FileText, Bot, TrendingUp, Activity,
  Plus, Trash2, RefreshCw, Check, X, ExternalLink, Copy, ChevronDown,
  ChevronUp, Download, Zap, Globe, Mail, AlertTriangle, ArrowUp, ArrowDown,
  Minus, Target, BookOpen, Layers, LayoutDashboard, Settings,
  Users, Monitor, Smartphone, Clock, MapPin, Building2, Eye, UserPlus,
  Pencil, CheckCheck, Send, Sparkles, MessageSquare, SquareTerminal,
  Calendar, PlayCircle, Pause, TimerReset, BadgeCheck, TriangleAlert,
  Loader2, Repeat2, Rocket, ShieldAlert, ShieldCheck, Flag, CheckCircle2,
  AlertCircle, Power, PowerOff, ChevronRight, ListChecks, PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar, Cell,
} from "recharts";

// ─── API helpers ──────────────────────────────────────────────────────────────
async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Keyword {
  id: string; keyword: string; domain: string; targetUrl?: string; tags?: string;
  createdAt: string; currentPosition: number | null; previousPosition: number | null;
  rankingUrl: string | null; lastChecked: string | null;
}
interface AgentTask {
  id: string; taskType: string; status: string; startedAt?: string;
  completedAt?: string; resultSummary?: string; errorMessage?: string; createdAt: string;
}
interface GeneratedContent {
  id: string; keyword: string; title?: string; body?: string;
  metaDescription?: string; wordCount?: number; status: string; createdAt: string;
}
interface BacklinkOutreach {
  id: string; targetSite: string; targetUrl?: string; contactEmail?: string;
  status: string; notes?: string; emailBody?: string; createdAt: string;
}
interface SeoOverview {
  keywordsTracked: number; avgPosition: number | null; top10Count: number;
  top3Count: number; seoScore: number; recentTasks: AgentTask[];
}

// ─── Position badge ───────────────────────────────────────────────────────────
function PositionBadge({ pos }: { pos: number | null }) {
  if (!pos) return <span className="text-gray-400 text-sm">—</span>;
  const cls = pos <= 3 ? "bg-green-100 text-green-700" :
    pos <= 10 ? "bg-blue-100 text-blue-700" :
    pos <= 20 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${cls}`}>#{pos}</span>;
}

// ─── Change arrow ─────────────────────────────────────────────────────────────
function PositionChange({ curr, prev }: { curr: number | null; prev: number | null }) {
  if (!curr || !prev) return <span className="text-gray-400 text-xs">—</span>;
  const diff = prev - curr; // positive = improved (lower number)
  if (diff === 0) return <span className="text-gray-400 text-xs flex items-center gap-0.5"><Minus className="w-3 h-3" />0</span>;
  if (diff > 0) return <span className="text-green-600 text-xs flex items-center gap-0.5"><ArrowUp className="w-3 h-3" />+{diff}</span>;
  return <span className="text-red-500 text-xs flex items-center gap-0.5"><ArrowDown className="w-3 h-3" />{diff}</span>;
}

// ─── Task status badge ────────────────────────────────────────────────────────
function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    running: "bg-blue-100 text-blue-700 animate-pulse",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || "bg-gray-100 text-gray-500"}`}>{status}</span>;
}

// ─── Overview Section ─────────────────────────────────────────────────────────
function OverviewSection() {
  const { data: overview, isLoading } = useQuery<SeoOverview>({
    queryKey: ["/api/seo/overview"],
    queryFn: () => api("/api/seo/overview"),
    refetchInterval: 30000,
  });
  const { data: score } = useQuery<{ score: number; breakdown: { label: string; score: number; max: number; note: string }[] }>({
    queryKey: ["/api/seo/score"],
    queryFn: () => api("/api/seo/score"),
  });

  if (isLoading) return <div className="p-8 text-gray-400 animate-pulse">Loading overview...</div>;

  const metrics = [
    { label: "Keywords Tracked", value: overview?.keywordsTracked ?? 0, icon: Target, color: "text-blue-600" },
    { label: "Avg. Ranking Position", value: overview?.avgPosition ? `#${overview.avgPosition}` : "—", icon: BarChart2, color: "text-indigo-600" },
    { label: "Top 10 Keywords", value: overview?.top10Count ?? 0, icon: TrendingUp, color: "text-green-600" },
    { label: "SEO Health Score", value: overview?.seoScore ? `${overview.seoScore}/100` : "—", icon: Activity, color: "text-orange-500" },
  ];

  const scoreColor = (score?.score ?? 0) >= 70 ? "#22c55e" : (score?.score ?? 0) >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">SEO Overview</h2>
        <p className="text-sm text-gray-500">newdawnfranchising.com</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <m.icon className={`w-4 h-4 ${m.color}`} />
              <span className="text-xs text-gray-500">{m.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SEO Score breakdown */}
        {score && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">SEO Health Score</h3>
              <div className={`text-3xl font-bold`} style={{ color: scoreColor }}>{score.score}<span className="text-base text-gray-400">/100</span></div>
            </div>
            <div className="space-y-3">
              {score.breakdown.map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{b.label}</span>
                    <span className="text-gray-400">{b.note}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${(b.score / b.max) * 100}%`, backgroundColor: scoreColor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent agent activity */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Agent Activity</h3>
          {!overview?.recentTasks?.length ? (
            <p className="text-sm text-gray-400">No agent tasks run yet. Go to the AI Agent tab to run tasks.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {overview.recentTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2 text-sm">
                  <TaskStatusBadge status={t.status} />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-700 capitalize">{t.taskType.replace(/_/g, " ")}</div>
                    {t.resultSummary && <div className="text-xs text-gray-500 truncate">{t.resultSummary}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Keywords Section ─────────────────────────────────────────────────────────
function KeywordsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newKeyword, setNewKeyword] = useState("");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [research, setResearch] = useState<{ keyword: string; relatedSearches: string[]; peopleAlsoAsk: string[] } | null>(null);
  const [researching, setResearching] = useState(false);
  const [researchInput, setResearchInput] = useState("");
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const { data: keywords = [], isLoading } = useQuery<Keyword[]>({
    queryKey: ["/api/seo/keywords"],
    queryFn: () => api("/api/seo/keywords"),
    refetchInterval: 15000,
  });

  const addMutation = useMutation({
    mutationFn: () => api("/api/seo/keywords", { method: "POST", body: JSON.stringify({ keyword: newKeyword, targetUrl: newTargetUrl }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/seo/keywords"] }); setNewKeyword(""); setNewTargetUrl(""); toast({ title: "Keyword added" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/seo/keywords/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/seo/keywords"] }); toast({ title: "Keyword removed" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function checkRanking(kw: Keyword) {
    setCheckingId(kw.id);
    try {
      const result = await api(`/api/seo/keywords/${kw.id}/check`, { method: "POST" }) as { position: number | null; url: string | null };
      qc.invalidateQueries({ queryKey: ["/api/seo/keywords"] });
      toast({ title: result.position ? `Ranking found: #${result.position}` : "Not found in top 100" });
    } catch (e: any) {
      toast({ title: "Check failed", description: e.message, variant: "destructive" });
    } finally {
      setCheckingId(null);
    }
  }

  async function doResearch() {
    if (!researchInput.trim()) return;
    setResearching(true);
    try {
      const result = await api("/api/seo/keywords/research", { method: "POST", body: JSON.stringify({ keyword: researchInput }) });
      setResearch(result as { keyword: string; relatedSearches: string[]; peopleAlsoAsk: string[] });
    } catch (e: any) {
      toast({ title: "Research failed", description: e.message, variant: "destructive" });
    } finally {
      setResearching(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Keyword Tracker</h2>

      {/* Add keyword */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Add Keyword to Track</h3>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. E-2 visa franchise Texas"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newKeyword.trim() && addMutation.mutate()}
          />
          <Input placeholder="Target URL (optional)" value={newTargetUrl} onChange={(e) => setNewTargetUrl(e.target.value)} className="max-w-xs" />
          <Button onClick={() => addMutation.mutate()} disabled={!newKeyword.trim() || addMutation.isPending}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Keywords table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{keywords.length} Tracked Keywords</h3>
          <span className="text-xs text-gray-400">Click "Check" to get latest ranking</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-gray-400 animate-pulse">Loading...</div>
        ) : !keywords.length ? (
          <div className="p-8 text-center text-gray-400">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No keywords tracked yet. Add your first keyword above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Keyword</th>
                <th className="px-3 py-3 text-center">Position</th>
                <th className="px-3 py-3 text-center">Change</th>
                <th className="px-3 py-3 text-left hidden md:table-cell">Ranking URL</th>
                <th className="px-3 py-3 text-center">Last Checked</th>
                <th className="px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {keywords.map((kw) => (
                <tr key={kw.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">{kw.keyword}</td>
                  <td className="px-3 py-3 text-center"><PositionBadge pos={kw.currentPosition} /></td>
                  <td className="px-3 py-3 text-center"><PositionChange curr={kw.currentPosition} prev={kw.previousPosition} /></td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    {kw.rankingUrl ? (
                      <a href={kw.rankingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs truncate block max-w-xs">
                        {kw.rankingUrl}
                      </a>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center text-xs text-gray-400">
                    {kw.lastChecked ? new Date(kw.lastChecked).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <Button variant="ghost" size="sm" onClick={() => checkRanking(kw)} disabled={checkingId === kw.id} className="text-xs">
                        {checkingId === kw.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(kw.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Keyword Research */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-semibold text-gray-800 mb-3">Keyword Research</h3>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Enter a seed keyword to research..."
            value={researchInput}
            onChange={(e) => setResearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doResearch()}
          />
          <Button onClick={doResearch} disabled={researching || !researchInput.trim()}>
            {researching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ml-1">{researching ? "Searching..." : "Research"}</span>
          </Button>
        </div>

        {research && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><TrendingUp className="w-4 h-4 text-blue-500" /> Related Searches</h4>
              <div className="space-y-1">
                {research.relatedSearches.map((q, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                    <span className="text-gray-700">{q}</span>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setNewKeyword(q); toast({ title: "Added to keyword input" }); }}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><BookOpen className="w-4 h-4 text-green-500" /> People Also Ask</h4>
              <div className="space-y-2">
                {research.peopleAlsoAsk.map((q, i) => (
                  <div key={i} className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-1.5">{q}</div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Backlinks Section ────────────────────────────────────────────────────────
function BacklinksSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ targetSite: "", targetUrl: "", contactEmail: "", notes: "" });
  const [emailLookup, setEmailLookup] = useState({ domain: "", firstName: "", lastName: "" });
  const [lookingUp, setLookingUp] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: outreach = [], isLoading } = useQuery<BacklinkOutreach[]>({
    queryKey: ["/api/seo/backlinks/outreach"],
    queryFn: () => api("/api/seo/backlinks/outreach"),
  });

  const addMutation = useMutation({
    mutationFn: () => api("/api/seo/backlinks/outreach", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/seo/backlinks/outreach"] }); setForm({ targetSite: "", targetUrl: "", contactEmail: "", notes: "" }); setShowAddForm(false); toast({ title: "Added to outreach tracker" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; status?: string; notes?: string }) => api(`/api/seo/backlinks/outreach/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/seo/backlinks/outreach"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/seo/backlinks/outreach/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/seo/backlinks/outreach"] }),
  });

  async function findEmail() {
    if (!emailLookup.domain) return;
    setLookingUp(true);
    try {
      const res = await api("/api/seo/backlinks/find-email", {
        method: "POST",
        body: JSON.stringify(emailLookup),
      }) as { email: string | null };
      if (res.email) { setForm(f => ({ ...f, contactEmail: res.email! })); toast({ title: `Found: ${res.email}` }); }
      else toast({ title: "No email found for that domain" });
    } catch (e: any) {
      toast({ title: "Lookup failed", description: e.message, variant: "destructive" });
    } finally {
      setLookingUp(false);
    }
  }

  const statusColors: Record<string, string> = {
    not_sent: "bg-gray-100 text-gray-600",
    sent: "bg-blue-100 text-blue-700",
    replied: "bg-yellow-100 text-yellow-700",
    won: "bg-green-100 text-green-700",
    lost: "bg-red-100 text-red-700",
  };

  const stats = [
    { label: "Total Targets", value: outreach.length },
    { label: "Emails Sent", value: outreach.filter(o => o.status !== "not_sent").length },
    { label: "Replied", value: outreach.filter(o => o.status === "replied").length },
    { label: "Won", value: outreach.filter(o => o.status === "won").length },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Backlink Outreach</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Add Outreach Target</h3>
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? "Cancel" : <><Plus className="w-4 h-4 mr-1" /> Add Target</>}
          </Button>
        </div>

        {showAddForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Target site (e.g. immigrationattorney.com)" value={form.targetSite} onChange={(e) => setForm(f => ({ ...f, targetSite: e.target.value }))} />
              <Input placeholder="Specific URL to get a link from" value={form.targetUrl} onChange={(e) => setForm(f => ({ ...f, targetUrl: e.target.value }))} />
            </div>

            {/* Hunter.io email finder */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1"><Mail className="w-3 h-3" /> Find Contact Email via Hunter.io</p>
              <div className="flex gap-2">
                <Input placeholder="Domain (e.g. example.com)" value={emailLookup.domain} onChange={(e) => setEmailLookup(l => ({ ...l, domain: e.target.value }))} className="bg-white" />
                <Input placeholder="First name" value={emailLookup.firstName} onChange={(e) => setEmailLookup(l => ({ ...l, firstName: e.target.value }))} className="bg-white max-w-28" />
                <Input placeholder="Last name" value={emailLookup.lastName} onChange={(e) => setEmailLookup(l => ({ ...l, lastName: e.target.value }))} className="bg-white max-w-28" />
                <Button variant="outline" size="sm" onClick={findEmail} disabled={lookingUp}>
                  {lookingUp ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                </Button>
              </div>
            </div>

            <Input placeholder="Contact email" value={form.contactEmail} onChange={(e) => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
            <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            <Button onClick={() => addMutation.mutate()} disabled={!form.targetSite.trim() || addMutation.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Add to Tracker
            </Button>
          </div>
        )}
      </div>

      {/* Outreach table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Outreach Tracker</h3>
        </div>
        {isLoading ? <div className="p-6 text-gray-400 animate-pulse">Loading...</div> :
          !outreach.length ? (
            <div className="p-8 text-center text-gray-400">
              <Link2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No outreach targets added yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {outreach.map((o) => (
                <div key={o.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm">{o.targetSite}</div>
                      {o.contactEmail && <div className="text-xs text-gray-400">{o.contactEmail}</div>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[o.status] || statusColors.not_sent}`}>
                      {o.status.replace("_", " ")}
                    </span>
                    <select
                      className="text-xs border border-gray-200 rounded px-2 py-1"
                      value={o.status}
                      onChange={(e) => updateMutation.mutate({ id: o.id, status: e.target.value })}
                    >
                      <option value="not_sent">Not Sent</option>
                      <option value="sent">Sent</option>
                      <option value="replied">Replied</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                    </select>
                    <Button variant="ghost" size="sm" onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}>
                      {expandedId === o.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(o.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {expandedId === o.id && o.notes && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2">{o.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ─── Content Section ──────────────────────────────────────────────────────────
function ContentSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"generator" | "meta" | "library">("generator");
  const [generating, setGenerating] = useState(false);
  const [generatedItem, setGeneratedItem] = useState<GeneratedContent | null>(null);
  const [metaUrl, setMetaUrl] = useState("");
  const [metaResult, setMetaResult] = useState<{ title: string; metaDescription: string; suggestions: string[] } | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [form, setForm] = useState({ keyword: "", secondaryKeywords: "", tone: "informational", wordCount: 1000 });

  const { data: library = [] } = useQuery<GeneratedContent[]>({
    queryKey: ["/api/seo/content"],
    queryFn: () => api("/api/seo/content"),
  });

  async function generate() {
    if (!form.keyword.trim()) return;
    setGenerating(true);
    try {
      const result = await api("/api/seo/content/generate", { method: "POST", body: JSON.stringify(form) }) as GeneratedContent;
      setGeneratedItem(result);
      qc.invalidateQueries({ queryKey: ["/api/seo/content"] });
      toast({ title: "Content generated!", description: `${result.wordCount} words` });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function generateMeta() {
    if (!metaUrl.trim()) return;
    setMetaLoading(true);
    try {
      const result = await api("/api/seo/content/meta-tags", { method: "POST", body: JSON.stringify({ url: metaUrl }) });
      setMetaResult(result as { title: string; metaDescription: string; suggestions: string[] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setMetaLoading(false);
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/seo/content/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/seo/content"] }),
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">SEO Content Generator</h2>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[["generator", "Article Generator"], ["meta", "Meta Tags"], ["library", "Content Library"]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "generator" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-800">Article Settings</h3>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Primary Keyword *</label>
              <Input placeholder="e.g. E-2 visa franchise opportunity Texas" value={form.keyword} onChange={(e) => setForm(f => ({ ...f, keyword: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Secondary Keywords (comma separated)</label>
              <Input placeholder="e.g. property management franchise, E-2 investor visa" value={form.secondaryKeywords} onChange={(e) => setForm(f => ({ ...f, secondaryKeywords: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Tone</label>
                <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" value={form.tone} onChange={(e) => setForm(f => ({ ...f, tone: e.target.value }))}>
                  <option value="informational">Informational</option>
                  <option value="commercial">Commercial</option>
                  <option value="listicle">Listicle</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Word Count</label>
                <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" value={form.wordCount} onChange={(e) => setForm(f => ({ ...f, wordCount: parseInt(e.target.value) }))}>
                  <option value={500}>~500 words</option>
                  <option value={1000}>~1,000 words</option>
                  <option value={1500}>~1,500 words</option>
                  <option value={2000}>~2,000 words</option>
                </select>
              </div>
            </div>
            <Button className="w-full" onClick={generate} disabled={generating || !form.keyword.trim()}>
              {generating ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Zap className="w-4 h-4 mr-2" /> Generate Article</>}
            </Button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            {generatedItem ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-800">Generated Article</h3>
                  <Badge variant="outline">{generatedItem.wordCount} words</Badge>
                </div>
                <div className="bg-navy/5 rounded-lg p-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">Title Tag</div>
                  <div className="font-semibold text-gray-800">{generatedItem.title}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">Meta Description</div>
                  <div className="text-sm text-gray-700">{generatedItem.metaDescription}</div>
                  <div className="text-xs text-gray-400 mt-1">{(generatedItem.metaDescription || "").length}/155 chars</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                  <div className="text-xs font-medium text-gray-500 mb-2">Article Preview</div>
                  <div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{generatedItem.body?.substring(0, 800)}...</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(generatedItem.body || ""); toast({ title: "Copied!" }); }}>
                    <Copy className="w-3 h-3 mr-1" /> Copy Article
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(generatedItem.title || ""); toast({ title: "Title copied!" }); }}>
                    <Copy className="w-3 h-3 mr-1" /> Copy Title
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <FileText className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Generated article will appear here</p>
                <p className="text-xs mt-1">Fill in the settings and click Generate</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "meta" && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">Meta Tag Optimizer</h3>
          <p className="text-sm text-gray-500">Enter a URL on your site and get AI-optimized title and meta description suggestions.</p>
          <div className="flex gap-2">
            <Input placeholder="https://newdawnfranchising.com/e2-fit" value={metaUrl} onChange={(e) => setMetaUrl(e.target.value)} />
            <Button onClick={generateMeta} disabled={metaLoading || !metaUrl.trim()}>
              {metaLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span className="ml-1">{metaLoading ? "Analyzing..." : "Optimize"}</span>
            </Button>
          </div>
          {metaResult && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <div className="text-xs font-bold text-blue-600 mb-1">OPTIMIZED TITLE TAG</div>
                <div className="font-semibold text-gray-800">{metaResult.title}</div>
                <div className="text-xs text-gray-400 mt-1">{metaResult.title.length}/60 chars</div>
                <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => { navigator.clipboard.writeText(metaResult.title); toast({ title: "Copied!" }); }}>
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                <div className="text-xs font-bold text-green-600 mb-1">META DESCRIPTION</div>
                <div className="text-sm text-gray-700">{metaResult.metaDescription}</div>
                <div className="text-xs text-gray-400 mt-1">{metaResult.metaDescription.length}/155 chars</div>
                <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => { navigator.clipboard.writeText(metaResult.metaDescription); toast({ title: "Copied!" }); }}>
                  <Copy className="w-3 h-3 mr-1" /> Copy
                </Button>
              </div>
              {metaResult.suggestions?.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-gray-500 mb-2">ALTERNATIVE TITLES</div>
                  <div className="space-y-1">
                    {metaResult.suggestions.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                        <span>{s}</span>
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => { navigator.clipboard.writeText(s); toast({ title: "Copied!" }); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "library" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">{library.length} Generated Articles</h3>
          </div>
          {!library.length ? (
            <div className="p-8 text-center text-gray-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No articles generated yet. Use the Article Generator.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {library.map((item) => (
                <div key={item.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800">{item.title || item.keyword}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{item.keyword} · {item.wordCount} words · {new Date(item.createdAt).toLocaleDateString()}</div>
                    {item.metaDescription && <div className="text-xs text-gray-500 mt-1 truncate">{item.metaDescription}</div>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(item.body || ""); toast({ title: "Copied!" }); }}>
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-400" onClick={() => deleteMutation.mutate(item.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Agent Section ─────────────────────────────────────────────────────────

const AGENT_TASKS = [
  { type: "rankings_check", label: "Rankings Check", desc: "Check all keyword positions via SerpAPI", icon: TrendingUp, color: "blue" },
  { type: "content_ideas", label: "Content Ideas", desc: "Generate 5 AI blog post ideas for your niche", icon: BookOpen, color: "purple" },
  { type: "seo_score", label: "SEO Health Score", desc: "Recalculate today's SEO health score", icon: Activity, color: "green" },
  { type: "competitor_spy", label: "Competitor Analysis", desc: "Analyze top competitors and their content moves", icon: Search, color: "red" },
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; status: "running" | "done"; preview?: string }[];
};

const SEO_PROMPTS = [
  { icon: "📊", text: "Show me a full rank report — positions, traffic estimates, and CTR for all keywords" },
  { icon: "📈", text: "What is the expected monthly traffic if we rank #1 for 'E-2 visa franchise Texas'?" },
  { icon: "⚔️", text: "How difficult is it to rank for 'property management franchise for investors'?" },
  { icon: "🌿", text: "Find me 20 long-tail keyword variations of 'E-2 visa franchise'" },
  { icon: "🎯", text: "Analyze the SERP features for 'E-2 visa franchise Texas' — are there featured snippets, ads, local packs?" },
  { icon: "⭐", text: "Which of my tracked keywords have featured snippet opportunities I can win?" },
  { icon: "🗂️", text: "Show page coverage — which pages rank for what keywords, and are there any orphan pages?" },
  { icon: "🏗️", text: "Audit my structured data — which pages are missing JSON-LD schema?" },
  { icon: "🌐", text: "Analyze my website and tell me what keywords I should be targeting" },
  { icon: "🔎", text: "Find the best keyword opportunities for my business right now" },
  { icon: "🏆", text: "Give me an SEO overview — score, rankings, and top priorities" },
  { icon: "🕵️", text: "Run a competitor analysis — who ranks for E-2 visa franchise?" },
];

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-gray-800 mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-gray-900 mt-4 mb-1 text-base">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-gray-900 mt-4 mb-2 text-lg">$1</h1>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-700">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-gray-700">$2</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function AgentSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeView, setActiveView] = useState<"chat" | "tasks">("chat");
  const messagesEndRef = { current: null as HTMLDivElement | null };

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<AgentTask[]>({
    queryKey: ["/api/seo/agent/tasks"],
    queryFn: () => api("/api/seo/agent/tasks"),
    refetchInterval: 5000,
  });

  async function runTask(taskType: string) {
    setRunningTask(taskType);
    try {
      await api(`/api/seo/agent/run/${taskType}`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["/api/seo/agent/tasks"] });
      toast({ title: "Task started", description: "Results will appear in the log below." });
    } catch (e: any) {
      toast({ title: "Failed to start task", description: e.message, variant: "destructive" });
    } finally {
      setTimeout(() => setRunningTask(null), 2000);
    }
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content };
    const assistantMsg: ChatMessage = { role: "assistant", content: "", toolCalls: [] };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch("/api/seo/agent/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: history }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "token") {
              setMessages(prev => {
                const next = [...prev];
                const last = { ...next[next.length - 1] };
                last.content += evt.content;
                next[next.length - 1] = last;
                return next;
              });
            } else if (evt.type === "tool_start") {
              setMessages(prev => {
                const next = [...prev];
                const last = { ...next[next.length - 1] };
                last.toolCalls = [...(last.toolCalls || []), { tool: evt.tool, status: "running" }];
                next[next.length - 1] = last;
                return next;
              });
            } else if (evt.type === "tool_end") {
              setMessages(prev => {
                const next = [...prev];
                const last = { ...next[next.length - 1] };
                last.toolCalls = (last.toolCalls || []).map(tc =>
                  tc.tool === evt.tool ? { ...tc, status: "done" as const, preview: evt.result } : tc
                );
                next[next.length - 1] = last;
                return next;
              });
            } else if (evt.type === "error") {
              setMessages(prev => {
                const next = [...prev];
                const last = { ...next[next.length - 1] };
                last.content = `⚠️ Error: ${evt.message}`;
                next[next.length - 1] = last;
                return next;
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e: any) {
      setMessages(prev => {
        const next = [...prev];
        const last = { ...next[next.length - 1] };
        last.content = `⚠️ Connection error: ${e.message}`;
        next[next.length - 1] = last;
        return next;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    green: "bg-green-50 text-green-600 border-green-100",
    red: "bg-red-50 text-red-600 border-red-100",
  };

  const TOOL_LABELS: Record<string, string> = {
    get_seo_overview: "📊 Loading SEO overview...",
    get_keywords: "🔑 Fetching tracked keywords...",
    check_rankings: "🔍 Checking Google rankings via SerpAPI...",
    research_keywords: "💡 Researching keyword opportunities...",
    add_keyword: "➕ Adding keyword to tracker...",
    generate_content: "✍️ Generating SEO content with AI...",
    get_backlinks: "🔗 Loading backlink pipeline...",
    find_backlink_email: "📧 Looking up contact email via Hunter...",
    update_backlink_status: "✅ Updating backlink status...",
    get_content_history: "📚 Loading content history...",
    run_seo_score: "🏆 Calculating SEO health score...",
    competitor_analysis: "🕵️ Searching Google + analyzing competitors with AI...",
    analyze_website: "🌐 Crawling your website pages — reading content, titles, headings...",
    find_keywords: "🔎 Researching keyword opportunities across 6 seed topics via SerpAPI...",
    find_best_keywords: "🔎 Researching keyword opportunities across 6 seed topics via SerpAPI...",
    rank_report: "📊 Building full rank report with traffic estimates and CTR data...",
    keyword_traffic: "📈 Estimating search volume and traffic projections at positions 1, 3, 5, 10...",
    estimate_traffic: "📈 Estimating search volume and traffic projections...",
    keyword_difficulty: "⚔️ Analyzing SERP competition and calculating difficulty score...",
    difficulty: "⚔️ Analyzing SERP competition...",
    long_tail_keywords: "🌿 Discovering long-tail variations via autocomplete + PAA + related searches...",
    long_tail: "🌿 Discovering long-tail keyword variations...",
    serp_features: "🎯 Detecting SERP features: snippets, PAA boxes, local pack, ads...",
    serp_analysis: "🎯 Analyzing SERP features...",
    featured_snippet_opportunities: "⭐ Scanning all tracked keywords for featured snippet opportunities...",
    featured_snippets: "⭐ Scanning for featured snippet opportunities...",
    page_coverage: "🗂️ Mapping pages to keywords — finding orphans and cannibalization risks...",
    page_report: "🗂️ Analyzing page coverage...",
    schema_audit: "🏗️ Auditing structured data (JSON-LD) across all pages...",
  };

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">AI SEO Agent</h2>
          <p className="text-sm text-gray-500">Conversational AI with real-time data access — rankings, content, backlinks and more.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeView === "chat" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </button>
          <button
            onClick={() => setActiveView("tasks")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeView === "tasks" ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <SquareTerminal className="w-3.5 h-3.5" /> Tasks
          </button>
        </div>
      </div>

      {activeView === "chat" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col" style={{ height: "680px" }}>
          {/* Chat header */}
          <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">SEO AI Agent</div>
              <div className="text-xs text-gray-500">Powered by GPT-4o · SerpAPI · Hunter.io</div>
            </div>
            {isStreaming && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                Thinking...
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <Sparkles className="w-7 h-7 text-blue-500" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">Ask anything about your SEO</h3>
                <p className="text-sm text-gray-400 text-center max-w-sm mb-6">
                  Check rankings, find keyword opportunities, generate content, or manage your backlink pipeline.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                  {SEO_PROMPTS.map((p) => (
                    <button
                      key={p.text}
                      onClick={() => sendMessage(p.text)}
                      className="text-left text-xs text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-lg px-3 py-2.5 transition-all flex gap-2 items-start"
                    >
                      <span className="text-base leading-none shrink-0">{p.icon}</span>
                      <span>{p.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={`max-w-[80%] ${msg.role === "user" ? "ml-auto" : ""}`}>
                      {/* Tool calls */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {msg.toolCalls.map((tc, j) => (
                            <div key={j} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${
                              tc.status === "running"
                                ? "bg-blue-50 border-blue-100 text-blue-700"
                                : "bg-green-50 border-green-100 text-green-700"
                            }`}>
                              {tc.status === "running"
                                ? <RefreshCw className="w-3 h-3 animate-spin" />
                                : <Check className="w-3 h-3" />
                              }
                              <span>{tc.status === "running" ? TOOL_LABELS[tc.tool] || `⚙️ Running ${tc.tool}...` : `✅ ${tc.tool} completed`}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Message bubble */}
                      {(msg.content || (msg.role === "assistant" && isStreaming && i === messages.length - 1)) && (
                        <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-50 border border-gray-200 text-gray-800"
                        }`}>
                          {msg.role === "user" ? (
                            msg.content
                          ) : msg.content ? (
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                          ) : (
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={(el) => { messagesEndRef.current = el; }} />
              </>
            )}
          </div>

          {/* Suggested prompts strip (when there are messages) */}
          {messages.length > 0 && (
            <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
              {SEO_PROMPTS.slice(0, 6).map((p) => (
                <button
                  key={p.text}
                  onClick={() => sendMessage(p.text)}
                  disabled={isStreaming}
                  className="shrink-0 text-xs text-gray-500 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-full px-3 py-1 transition-all whitespace-nowrap disabled:opacity-50 flex items-center gap-1"
                >
                  <span>{p.icon}</span>
                  <span>{p.text.length > 38 ? p.text.slice(0, 38) + "…" : p.text}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4">
            <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder="Ask about rankings, keywords, backlinks, or content…"
                rows={1}
                disabled={isStreaming}
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none min-h-[36px] max-h-32 py-1 px-2 disabled:opacity-50"
                style={{ lineHeight: "1.5" }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isStreaming || !input.trim()}
                className="w-9 h-9 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
              >
                {isStreaming
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </div>
            <div className="text-xs text-gray-400 mt-1 px-1">Press Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      )}

      {activeView === "tasks" && (
        <div className="space-y-4">
          {/* Task cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AGENT_TASKS.map((task) => {
              const recentRun = tasks.find(t => t.taskType === task.type);
              const isRunning = runningTask === task.type || recentRun?.status === "running";
              return (
                <div key={task.type} className={`bg-white border rounded-xl p-4 flex flex-col gap-3 ${colorMap[task.color]?.split(" ")[2]}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[task.color]?.split(" ").slice(0, 2).join(" ")}`}>
                      <task.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 text-sm">{task.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{task.desc}</div>
                    </div>
                  </div>
                  {recentRun && (
                    <div className="bg-gray-50 rounded-lg p-2 text-xs">
                      <div className="flex items-center gap-1 mb-1">
                        <TaskStatusBadge status={recentRun.status} />
                        <span className="text-gray-400">{recentRun.completedAt ? new Date(recentRun.completedAt).toLocaleString() : "Running..."}</span>
                      </div>
                      {recentRun.resultSummary && (
                        <div>
                          <div className="text-gray-600 line-clamp-2">{recentRun.resultSummary.slice(0, 120)}{recentRun.resultSummary.length > 120 ? "…" : ""}</div>
                          {recentRun.resultSummary.length > 120 && (
                            <button onClick={() => { setActiveView("tasks"); setExpandedTaskId(recentRun.id); }} className="text-blue-600 mt-0.5 hover:underline">
                              View full result →
                            </button>
                          )}
                        </div>
                      )}
                      {recentRun.errorMessage && <div className="text-red-500">{recentRun.errorMessage}</div>}
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={() => runTask(task.type)} disabled={isRunning} className="mt-auto">
                    {isRunning ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Running...</> : <><Zap className="w-3 h-3 mr-1" /> Run Now</>}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Task log */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Task Log</h3>
              <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["/api/seo/agent/tasks"] })}>
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
            {tasksLoading ? (
              <div className="p-6 text-gray-400 animate-pulse">Loading...</div>
            ) : !tasks.length ? (
              <div className="p-8 text-center text-gray-400">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No tasks run yet. Click "Run Now" above.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
                {tasks.map((t) => {
                  const isLong = (t.resultSummary?.length || 0) > 200;
                  const isExpanded = expandedTaskId === t.id;
                  return (
                    <div key={t.id} className="px-5 py-4">
                      <div className="flex items-center gap-3 mb-1">
                        <TaskStatusBadge status={t.status} />
                        <div className="font-medium text-gray-700 text-sm capitalize flex-1">{t.taskType.replace(/_/g, " ")}</div>
                        <div className="text-xs text-gray-400 shrink-0">{new Date(t.createdAt).toLocaleString()}</div>
                      </div>
                      {t.errorMessage && <div className="text-xs text-red-500 mt-1 ml-0.5">{t.errorMessage}</div>}
                      {t.resultSummary && (
                        <div className="mt-2">
                          {isLong && !isExpanded ? (
                            <div>
                              <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed line-clamp-3">
                                {t.resultSummary.slice(0, 200)}…
                              </div>
                              <button
                                onClick={() => setExpandedTaskId(t.id)}
                                className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                              >
                                <ChevronDown className="w-3 h-3" /> View full analysis
                              </button>
                            </div>
                          ) : isExpanded ? (
                            <div>
                              <div
                                className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(t.resultSummary) }}
                              />
                              <button
                                onClick={() => setExpandedTaskId(null)}
                                className="mt-1 text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
                              >
                                <ChevronUp className="w-3 h-3" /> Collapse
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 leading-relaxed">
                              {t.resultSummary}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports Section ──────────────────────────────────────────────────────────
function ReportsSection() {
  const { data: keywords = [] } = useQuery<Keyword[]>({
    queryKey: ["/api/seo/keywords"],
    queryFn: () => api("/api/seo/keywords"),
  });
  const { data: tasks = [] } = useQuery<AgentTask[]>({
    queryKey: ["/api/seo/agent/tasks"],
    queryFn: () => api("/api/seo/agent/tasks"),
  });
  const { data: score } = useQuery<{ score: number; breakdown: { label: string; score: number; max: number; note: string }[] }>({
    queryKey: ["/api/seo/score"],
    queryFn: () => api("/api/seo/score"),
  });

  const positionGroups = [
    { name: "Top 3", count: keywords.filter(k => k.currentPosition !== null && k.currentPosition <= 3).length, fill: "#22c55e" },
    { name: "4-10", count: keywords.filter(k => k.currentPosition !== null && k.currentPosition > 3 && k.currentPosition <= 10).length, fill: "#3b82f6" },
    { name: "11-20", count: keywords.filter(k => k.currentPosition !== null && k.currentPosition > 10 && k.currentPosition <= 20).length, fill: "#f59e0b" },
    { name: "21+", count: keywords.filter(k => k.currentPosition !== null && k.currentPosition > 20).length, fill: "#ef4444" },
    { name: "Not Ranked", count: keywords.filter(k => k.currentPosition === null).length, fill: "#d1d5db" },
  ];

  const tasksByType = AGENT_TASKS.map(t => ({
    name: t.label,
    completed: tasks.filter(tsk => tsk.taskType === t.type && tsk.status === "completed").length,
    failed: tasks.filter(tsk => tsk.taskType === t.type && tsk.status === "failed").length,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">SEO Reports</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Ranking Position Distribution</h3>
          {!keywords.length ? (
            <div className="text-center text-gray-400 py-8">No keywords tracked yet.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={positionGroups} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {positionGroups.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-3">
                {positionGroups.map((g) => (
                  <div key={g.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: g.fill }} />
                    <span className="text-gray-600">{g.name}: <strong>{g.count}</strong></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* SEO score breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-4">SEO Health Score Breakdown</h3>
          {score ? (
            <div className="space-y-3">
              <div className="text-5xl font-bold text-center py-2" style={{ color: score.score >= 70 ? "#22c55e" : score.score >= 40 ? "#f59e0b" : "#ef4444" }}>
                {score.score}<span className="text-xl text-gray-400">/100</span>
              </div>
              {score.breakdown.map((b) => (
                <div key={b.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{b.label}</span>
                    <span className="font-semibold">{b.score}/{b.max}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(b.score / b.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-gray-400 text-sm">Loading score...</div>}
        </div>

        {/* Agent task history */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">Agent Task Performance</h3>
          {!tasks.length ? (
            <div className="text-center text-gray-400 py-4">No agent tasks run yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tasksByType} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Ranked keywords table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Top Ranking Keywords</h3>
        </div>
        {!keywords.filter(k => k.currentPosition).length ? (
          <div className="p-6 text-center text-gray-400">No rankings data yet. Add keywords and check their positions.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Keyword</th>
                <th className="px-3 py-3 text-center">Position</th>
                <th className="px-3 py-3 text-center">Change</th>
                <th className="px-3 py-3 text-left hidden md:table-cell">Ranking URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {keywords
                .filter(k => k.currentPosition)
                .sort((a, b) => (a.currentPosition || 999) - (b.currentPosition || 999))
                .map((kw) => (
                  <tr key={kw.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-2.5 font-medium text-gray-800">{kw.keyword}</td>
                    <td className="px-3 py-2.5 text-center"><PositionBadge pos={kw.currentPosition} /></td>
                    <td className="px-3 py-2.5 text-center"><PositionChange curr={kw.currentPosition} prev={kw.previousPosition} /></td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      {kw.rankingUrl ? (
                        <a href={kw.rankingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs truncate block max-w-xs">
                          {kw.rankingUrl}
                        </a>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Visitors Section ─────────────────────────────────────────────────────────

interface VisitorSession {
  id: string;
  sessionId: string;
  ip?: string;
  country?: string;
  city?: string;
  region?: string;
  org?: string;
  isp?: string;
  userAgent?: string;
  device?: string;
  identifiedEmail?: string;
  identifiedName?: string;
  identifiedCompany?: string;
  crmClientId?: string;
  firstSeen: string;
  lastSeen: string;
  totalDuration: number;
  pageViewCount: number;
  pages: { id: string; path: string; title?: string; referrer?: string; duration?: number; viewedAt: string }[];
}

function formatDuration(secs: number): string {
  if (!secs || secs < 5) return "< 5s";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DeviceIcon({ device }: { device?: string }) {
  if (device === "Mobile") return <Smartphone className="w-3.5 h-3.5 text-gray-400" />;
  return <Monitor className="w-3.5 h-3.5 text-gray-400" />;
}

interface FindPeopleResult {
  firstName: string;
  lastName: string;
  email: string | null;
  emailConfidence: number;
  phone: string | null;
  linkedinUrl: string | null;
  jobTitle: string | null;
  seniority: string | null;
}

function VisitorsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addToCrmId, setAddToCrmId] = useState<string | null>(null);
  const [crmForm, setCrmForm] = useState({ fullName: "", email: "" });
  const [identifyId, setIdentifyId] = useState<string | null>(null);
  const [identifyForm, setIdentifyForm] = useState({ identifiedName: "", identifiedEmail: "", identifiedCompany: "" });
  const [findPeopleId, setFindPeopleId] = useState<string | null>(null);
  const [findPeopleData, setFindPeopleData] = useState<{ companyName: string; location: string; results: FindPeopleResult[] } | null>(null);

  const { data: visitors = [], isLoading, refetch } = useQuery<VisitorSession[]>({
    queryKey: ["/api/seo/visitors"],
    queryFn: () => api("/api/seo/visitors"),
    refetchInterval: 30000,
  });

  const addToCrmMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; fullName: string; email: string }) =>
      api(`/api/seo/visitors/${id}/add-to-crm`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/seo/visitors"] });
      setAddToCrmId(null);
      setCrmForm({ fullName: "", email: "" });
      toast({ title: "Added to CRM as a new lead!" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const identifyMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; identifiedName: string; identifiedEmail: string; identifiedCompany: string }) =>
      api(`/api/seo/visitors/${id}/identify`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/seo/visitors"] });
      setIdentifyId(null);
      toast({ title: "Visitor identified" });
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const findPeopleMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/seo/visitors/${id}/find-people`, { method: "POST", body: "{}" }),
    onSuccess: (data, id) => {
      setFindPeopleId(id);
      setFindPeopleData(data);
    },
    onError: (e: Error) => toast({ title: "Search failed", description: e.message, variant: "destructive" }),
  });

  function openAddToCrm(v: VisitorSession) {
    setAddToCrmId(v.id);
    setCrmForm({
      fullName: v.identifiedName || "",
      email: v.identifiedEmail || "",
    });
  }

  function openIdentify(v: VisitorSession) {
    setIdentifyId(v.id);
    setIdentifyForm({
      identifiedName: v.identifiedName || "",
      identifiedEmail: v.identifiedEmail || "",
      identifiedCompany: v.identifiedCompany || v.org || "",
    });
  }

  const totalToday = visitors.filter(v => {
    const diff = Date.now() - new Date(v.lastSeen).getTime();
    return diff < 86400000;
  }).length;

  const identified = visitors.filter(v => v.identifiedName || v.identifiedEmail).length;
  const avgDuration = visitors.length
    ? Math.round(visitors.reduce((a, v) => a + (v.totalDuration || 0), 0) / visitors.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Website Visitors</h2>
          <p className="text-sm text-gray-500 mt-0.5">Live session data from your public pages. Identifies company/org via IP lookup.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Sessions", value: visitors.length, icon: Users, color: "text-blue-600" },
          { label: "Active Today", value: totalToday, icon: Activity, color: "text-green-600" },
          { label: "Avg. Time on Site", value: formatDuration(avgDuration), icon: Clock, color: "text-indigo-600" },
          { label: "Identified", value: identified, icon: CheckCheck, color: "text-orange-500" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tracking notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-start gap-2.5 text-sm">
        <Activity className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-blue-700">
          <strong>How it works:</strong> Every page visit on your public website is recorded (home, about, blog, contact, etc.). 
          The visitor's IP address is used to look up their company/organization automatically. 
          If they fill out a contact form, their identity is linked here. You can also manually identify any visitor and add them to your CRM.
        </div>
      </div>

      {/* Visitor table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{visitors.length} Visitor Sessions</h3>
          <span className="text-xs text-gray-400">Most recent first · Updates every 30s</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Loading visitor data...</div>
        ) : !visitors.length ? (
          <div className="p-10 text-center text-gray-400">
            <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium">No visitors recorded yet</p>
            <p className="text-sm mt-1">Visitor data will appear here once people browse your public pages.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {visitors.map((v) => {
              const isExpanded = expandedId === v.id;
              const isAddingToCrm = addToCrmId === v.id;
              const isIdentifying = identifyId === v.id;
              const displayName = v.identifiedName || v.org || v.isp || "Anonymous";
              const isKnown = !!(v.identifiedName || v.identifiedEmail);
              const isInCrm = !!v.crmClientId;
              const lastActivity = timeSince(v.lastSeen);
              const isActive = Date.now() - new Date(v.lastSeen).getTime() < 120000; // active in last 2 min

              return (
                <div key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  {/* Main row */}
                  <div className="px-5 py-3 flex items-center gap-3">
                    {/* Identity avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                      isKnown ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {displayName.charAt(0).toUpperCase()}
                    </div>

                    {/* Name + identity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium text-sm ${isKnown ? "text-gray-900" : "text-gray-500"}`}>
                          {displayName}
                        </span>
                        {isActive && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Active now
                          </span>
                        )}
                        {isInCrm && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">In CRM</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                        {v.identifiedEmail && <span className="text-blue-500">{v.identifiedEmail}</span>}
                        {v.city && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{v.city}, {v.country}</span>}
                        {!v.city && v.country && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{v.country}</span>}
                        <DeviceIcon device={v.device} />
                        <span>{v.device || "Desktop"}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-4 text-xs text-gray-500 shrink-0">
                      <div className="text-center">
                        <div className="font-semibold text-gray-800">{v.pageViewCount || 0}</div>
                        <div>pages</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-800">{formatDuration(v.totalDuration || 0)}</div>
                        <div>on site</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-gray-800">{lastActivity}</div>
                        <div>last seen</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {(v.org || v.isp) && (
                        <Button
                          variant="ghost" size="sm"
                          className={`text-xs ${findPeopleId === v.id ? "text-purple-800 bg-purple-50" : "text-purple-600 hover:text-purple-800 hover:bg-purple-50"}`}
                          onClick={() => {
                            if (findPeopleId === v.id) {
                              setFindPeopleId(null);
                              setFindPeopleData(null);
                            } else {
                              setFindPeopleData(null);
                              findPeopleMutation.mutate(v.id);
                            }
                          }}
                          disabled={findPeopleMutation.isPending && findPeopleMutation.variables === v.id}
                          title="Find decision-makers at this company via Apollo"
                        >
                          {findPeopleMutation.isPending && findPeopleMutation.variables === v.id
                            ? <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Searching…</>
                            : <><Search className="w-3.5 h-3.5 mr-1" /> Find People</>}
                        </Button>
                      )}
                      {!isInCrm && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          onClick={() => { setAddToCrmId(isAddingToCrm ? null : v.id); openAddToCrm(v); }}
                          title="Add to CRM"
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-1" /> Add to CRM
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        className="text-xs text-gray-500 hover:text-gray-700"
                        onClick={() => { setIdentifyId(isIdentifying ? null : v.id); openIdentify(v); }}
                        title="Identify visitor"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : v.id)}
                        className="text-gray-400"
                        title="View pages"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Add to CRM form */}
                  {isAddingToCrm && (
                    <div className="mx-5 mb-3 bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium text-blue-800 flex items-center gap-1.5">
                        <UserPlus className="w-4 h-4" /> Add to CRM as New Lead
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Full name"
                          value={crmForm.fullName}
                          onChange={(e) => setCrmForm(f => ({ ...f, fullName: e.target.value }))}
                          className="bg-white text-sm"
                        />
                        <Input
                          placeholder="Email address"
                          value={crmForm.email}
                          onChange={(e) => setCrmForm(f => ({ ...f, email: e.target.value }))}
                          className="bg-white text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => addToCrmMutation.mutate({ id: v.id, ...crmForm })}
                          disabled={addToCrmMutation.isPending}
                        >
                          {addToCrmMutation.isPending ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                          Add to CRM
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setAddToCrmId(null)}>Cancel</Button>
                      </div>
                      <p className="text-xs text-blue-600">
                        Will be added as "New Lead" with their location ({v.city || v.country || "unknown"}) and visit summary in the notes.
                      </p>
                    </div>
                  )}

                  {/* Identify form */}
                  {isIdentifying && (
                    <div className="mx-5 mb-3 bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                        <Pencil className="w-4 h-4" /> Manually Identify This Visitor
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder="Name" value={identifyForm.identifiedName} onChange={(e) => setIdentifyForm(f => ({ ...f, identifiedName: e.target.value }))} className="text-sm" />
                        <Input placeholder="Email" value={identifyForm.identifiedEmail} onChange={(e) => setIdentifyForm(f => ({ ...f, identifiedEmail: e.target.value }))} className="text-sm" />
                        <Input placeholder="Company" value={identifyForm.identifiedCompany} onChange={(e) => setIdentifyForm(f => ({ ...f, identifiedCompany: e.target.value }))} className="text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => identifyMutation.mutate({ id: v.id, ...identifyForm })} disabled={identifyMutation.isPending}>
                          <Check className="w-3 h-3 mr-1" /> Save Identity
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setIdentifyId(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {/* Find People results */}
                  {findPeopleId === v.id && findPeopleData && (
                    <div className="mx-5 mb-3 bg-purple-50 border border-purple-100 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-purple-900 flex items-center gap-1.5">
                          <Users className="w-4 h-4" />
                          Decision-makers at <span className="text-purple-700">{findPeopleData.companyName}</span>
                          {findPeopleData.location && <span className="font-normal text-purple-500">· {findPeopleData.location}</span>}
                        </p>
                        <span className="text-xs text-purple-500">{findPeopleData.results.length} found via Apollo</span>
                      </div>
                      {findPeopleData.results.length === 0 ? (
                        <p className="text-sm text-purple-600">No Apollo results found. Try adding a website URL in the Prospect Finder for a deeper search.</p>
                      ) : (
                        <div className="space-y-2">
                          {findPeopleData.results.map((p, i) => (
                            <div key={i} className="bg-white rounded-lg px-3 py-2 flex items-start justify-between gap-3 border border-purple-100">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm text-gray-900">{p.firstName} {p.lastName}</span>
                                  {p.jobTitle && <span className="text-xs text-gray-500">{p.jobTitle}</span>}
                                  {p.seniority && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{p.seniority}</span>}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  {p.email && (
                                    <a href={`mailto:${p.email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                                      <Mail className="w-3 h-3" />{p.email}
                                      {p.emailConfidence >= 90 && <CheckCheck className="w-3 h-3 text-green-500" />}
                                    </a>
                                  )}
                                  {p.phone && <span className="text-xs text-gray-500">{p.phone}</span>}
                                  {p.linkedinUrl && (
                                    <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">LinkedIn</a>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm" variant="outline"
                                className="text-xs shrink-0"
                                onClick={() => {
                                  setCrmForm({ fullName: `${p.firstName} ${p.lastName}`, email: p.email || "" });
                                  setAddToCrmId(v.id);
                                }}
                              >
                                <UserPlus className="w-3 h-3 mr-1" /> Add to CRM
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expanded page views */}
                  {isExpanded && (
                    <div className="mx-5 mb-3 bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pages Visited</p>
                      {!v.pages?.length ? (
                        <p className="text-xs text-gray-400">No page detail recorded yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {v.pages.map((pv) => (
                            <div key={pv.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <Globe className="w-3 h-3 text-gray-400 shrink-0" />
                                <span className="font-mono text-gray-700 truncate">{pv.path}</span>
                                {pv.title && pv.title !== "New Dawn Franchising" && (
                                  <span className="text-gray-400 truncate hidden md:block">— {pv.title}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-gray-400 shrink-0 ml-3">
                                {pv.referrer && pv.referrer !== "" && (
                                  <span className="hidden md:block truncate max-w-32" title={pv.referrer}>
                                    via {pv.referrer.replace(/https?:\/\//, "").split("/")[0]}
                                  </span>
                                )}
                                <span className="text-gray-400">{timeSince(pv.viewedAt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {v.org && (
                        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-500">
                          <Building2 className="w-3 h-3" />
                          <span>Organization / ISP: <strong>{v.org}</strong></span>
                          {v.isp && v.isp !== v.org && <span className="text-gray-400">({v.isp})</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scheduled Tasks Panel ────────────────────────────────────────────────────

interface ScheduledTask {
  id: string; taskKey: string; name: string; description: string; cadence: string;
  lastRunAt: string | null; lastRunStatus: string | null; lastRunResult: string | null;
  nextRunAt: string | null; isEnabled: boolean;
}

function summarySnippet(result: string | null): string {
  if (!result) return "No result yet.";
  try { return (JSON.parse(result) as { summary?: string }).summary || result.slice(0, 120); } catch { return result.slice(0, 120); }
}

function parseSummaryFull(result: string | null): { summary?: string; issues?: string[]; brokenLinks?: string[]; newContent?: string[]; opportunities?: string[]; contentOpportunities?: string[] } | null {
  if (!result) return null;
  try { return JSON.parse(result); } catch { return null; }
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  if (status === "completed") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700"><BadgeCheck className="w-3 h-3" />Completed</span>;
  if (status === "running") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700"><Loader2 className="w-3 h-3 animate-spin" />Running</span>;
  if (status === "failed") return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700"><TriangleAlert className="w-3 h-3" />Failed</span>;
  return <span className="text-xs text-gray-400 capitalize">{status}</span>;
}

function CadenceBadge({ cadence }: { cadence: string }) {
  const map: Record<string, { label: string; color: string }> = {
    daily: { label: "Daily", color: "bg-purple-50 text-purple-700" },
    weekly: { label: "Weekly", color: "bg-amber-50 text-amber-700" },
    monthly: { label: "Monthly", color: "bg-teal-50 text-teal-700" },
  };
  const c = map[cadence] || { label: cadence, color: "bg-gray-50 text-gray-600" };
  return <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.color}`}><Repeat2 className="w-3 h-3" />{c.label}</span>;
}

function formatRelativeTime(ts: string | null): string {
  if (!ts) return "Never";
  const d = new Date(ts);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.round(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.round(diffHrs / 24);
  return `${diffDays}d ago`;
}

function formatNextRun(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const diffMs = d.getTime() - Date.now();
  if (diffMs < 0) return "Overdue";
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) return `In ${diffMins}m`;
  const diffHrs = Math.round(diffMins / 60);
  if (diffHrs < 24) return `In ${diffHrs}h`;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function TaskResultDrawer({ task }: { task: ScheduledTask }) {
  const [open, setOpen] = useState(false);
  const parsed = parseSummaryFull(task.lastRunResult);
  const issues = parsed?.issues || parsed?.brokenLinks || [];
  const opps = parsed?.opportunities || parsed?.contentOpportunities || parsed?.newContent || [];

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
        <Eye className="w-3 h-3" /> View result
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <p className="font-semibold text-gray-900">{task.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Last run {formatRelativeTime(task.lastRunAt)}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Summary</p>
                <p className="text-sm text-gray-800">{summarySnippet(task.lastRunResult)}</p>
              </div>
              {issues.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Issues Found ({issues.length})</p>
                  <ul className="space-y-1">
                    {issues.map((iss, i) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <TriangleAlert className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{iss}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {opps.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Opportunities ({opps.length})</p>
                  <ul className="space-y-1">
                    {opps.map((opp, i) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                        <Sparkles className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />{opp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!parsed && task.lastRunResult && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Raw Output</p>
                  <pre className="text-xs text-gray-700 bg-gray-50 rounded p-3 whitespace-pre-wrap break-words">{task.lastRunResult}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ScheduledTasksPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [runningKey, setRunningKey] = useState<string | null>(null);

  const { data: tasks = [], isLoading, refetch } = useQuery<ScheduledTask[]>({
    queryKey: ["/api/seo/automation/tasks"],
    queryFn: () => api("/api/seo/automation/tasks"),
    refetchInterval: 15000,
  });

  const runMutation = useMutation({
    mutationFn: (key: string) => api(`/api/seo/automation/run/${key}`, { method: "POST" }),
    onMutate: (key) => setRunningKey(key),
    onSettled: () => { setRunningKey(null); setTimeout(() => refetch(), 3000); },
    onSuccess: (_, key) => toast({ title: "Task started", description: `Running "${key}" in the background` }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, isEnabled }: { key: string; isEnabled: boolean }) =>
      api(`/api/seo/automation/tasks/${key}`, { method: "PATCH", body: JSON.stringify({ isEnabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/seo/automation/tasks"] }),
  });

  const digestMutation = useMutation({
    mutationFn: () => api("/api/seo/automation/digest", { method: "POST" }),
    onSuccess: () => toast({ title: "Digest sent", description: "Daily briefing email is on its way" }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const daily = tasks.filter(t => t.cadence === "daily");
  const weekly = tasks.filter(t => t.cadence === "weekly");
  const monthly = tasks.filter(t => t.cadence === "monthly");

  const completed = tasks.filter(t => t.lastRunStatus === "completed").length;
  const failed = tasks.filter(t => t.lastRunStatus === "failed").length;
  const total = tasks.length;

  function TaskRow({ t }: { t: ScheduledTask }) {
    return (
      <div key={t.taskKey} className={`bg-white border rounded-xl p-4 transition-all ${!t.isEnabled ? "opacity-50" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm text-gray-900">{t.name}</span>
              <CadenceBadge cadence={t.cadence} />
              {t.lastRunStatus && <StatusBadge status={t.lastRunStatus} />}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{t.description}</p>
            <div className="flex items-center gap-4 mt-2.5 flex-wrap">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last run: <span className="text-gray-600">{formatRelativeTime(t.lastRunAt)}</span>
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Next: <span className={`font-medium ${!t.nextRunAt || new Date(t.nextRunAt) < new Date() ? "text-amber-600" : "text-gray-600"}`}>{formatNextRun(t.nextRunAt)}</span>
              </span>
              {t.lastRunStatus === "completed" && t.lastRunResult && (
                <TaskResultDrawer task={t} />
              )}
              {t.lastRunStatus === "failed" && t.lastRunResult && (
                <span className="text-xs text-red-500 flex items-center gap-1"><TriangleAlert className="w-3 h-3" />{t.lastRunResult.slice(0, 60)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => toggleMutation.mutate({ key: t.taskKey, isEnabled: !t.isEnabled })}
              className={`p-1.5 rounded-lg transition-colors ${t.isEnabled ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
              title={t.isEnabled ? "Disable" : "Enable"}
            >
              {t.isEnabled ? <BadgeCheck className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <Button
              size="sm" variant="outline"
              className="text-xs h-8"
              onClick={() => runMutation.mutate(t.taskKey)}
              disabled={runningKey === t.taskKey || runMutation.isPending}
            >
              {runningKey === t.taskKey
                ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                : <PlayCircle className="w-3 h-3 mr-1" />}
              Run Now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TimerReset className="w-5 h-5 text-blue-600" /> SEO Automations
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Automated tasks run on schedule and send a daily briefing at 9 AM ET.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} className="text-xs h-8">
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
          <Button
            size="sm" onClick={() => digestMutation.mutate()}
            disabled={digestMutation.isPending}
            className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {digestMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
            Send Digest Now
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Tasks</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{completed}</p>
          <p className="text-xs text-gray-500 mt-0.5">Completed Recently</p>
        </div>
        <div className="bg-white border rounded-xl p-4 text-center">
          <p className={`text-2xl font-bold ${failed > 0 ? "text-red-600" : "text-gray-300"}`}>{failed}</p>
          <p className="text-xs text-gray-500 mt-0.5">Needs Attention</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading automations...
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center text-gray-400">
          <Calendar className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No automation tasks found.</p>
          <p className="text-sm mt-1">Tasks are seeded automatically on server startup.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {daily.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Repeat2 className="w-3.5 h-3.5 text-purple-500" /> Daily · 6:00 AM CT
              </h3>
              <div className="space-y-3">{daily.map(t => <TaskRow key={t.taskKey} t={t} />)}</div>
            </div>
          )}
          {weekly.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Repeat2 className="w-3.5 h-3.5 text-amber-500" /> Weekly · Monday 7:00 AM CT
              </h3>
              <div className="space-y-3">{weekly.map(t => <TaskRow key={t.taskKey} t={t} />)}</div>
            </div>
          )}
          {monthly.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Repeat2 className="w-3.5 h-3.5 text-teal-500" /> Monthly · 1st of Month 8:00 AM CT
              </h3>
              <div className="space-y-3">{monthly.map(t => <TaskRow key={t.taskKey} t={t} />)}</div>
            </div>
          )}
        </div>
      )}

      {/* Digest email info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Mail className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-900">Daily SEO Briefing Email</p>
          <p className="text-xs text-blue-700 mt-0.5">
            An automated summary email is sent to <strong>jamie.greene736@gmail.com</strong> at 9:00 AM ET every day.
            It covers completed tasks, any issues, and what's coming up. Use "Send Digest Now" to trigger it immediately.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Content Engine Section ────────────────────────────────────────────────────
function ContentEngineSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"drafts" | "meta">("drafts");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [requesting, setRequesting] = useState(false);

  const { data: drafts = [], isLoading: draftsLoading } = useQuery<any[]>({
    queryKey: ["/api/content/drafts"],
    queryFn: () => api("/api/content/drafts"),
    refetchInterval: 15000,
  });

  const { data: metaSuggestions = [], isLoading: metaLoading } = useQuery<any[]>({
    queryKey: ["/api/content/meta-suggestions"],
    queryFn: () => api("/api/content/meta-suggestions"),
    refetchInterval: 30000,
  });

  const pendingDrafts = drafts.filter((d: any) => d.status === "draft");
  const approvedDrafts = drafts.filter((d: any) => d.status === "approved");
  const pendingMeta = metaSuggestions.filter((m: any) => m.status === "pending");

  async function approveDraft(id: string) {
    await api(`/api/content/drafts/${id}/approve`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["/api/content/drafts"] });
    toast({ title: "Draft approved!" });
  }

  async function discardDraft(id: string) {
    await api(`/api/content/drafts/${id}/discard`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["/api/content/drafts"] });
    toast({ title: "Draft discarded" });
  }

  async function saveEdit(id: string) {
    await api(`/api/content/drafts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ body: editBody }),
    });
    qc.invalidateQueries({ queryKey: ["/api/content/drafts"] });
    setEditingId(null);
    toast({ title: "Draft saved" });
  }

  async function approveMeta(id: string) {
    await api(`/api/content/meta-suggestions/${id}/approve`, { method: "POST" });
    qc.invalidateQueries({ queryKey: ["/api/content/meta-suggestions"] });
    toast({ title: "Meta suggestion approved + sitemap pinged!" });
  }

  async function requestDraft() {
    if (!topicInput.trim()) return;
    setRequesting(true);
    try {
      await api("/api/content/drafts/request", {
        method: "POST",
        body: JSON.stringify({ topic: topicInput }),
      });
      setTopicInput("");
      toast({ title: "Draft generation started", description: "Check back in ~30 seconds" });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["/api/content/drafts"] }), 15000);
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Content Engine</h2>
          <p className="text-sm text-gray-500 mt-0.5">AI-generated blog drafts and meta optimization suggestions</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full">{pendingDrafts.length} drafts pending</span>
          <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-1 rounded-full">{pendingMeta.length} meta pending</span>
        </div>
      </div>

      {/* Request Draft */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-500" /> Request a New Draft</p>
        <div className="flex gap-2">
          <input
            value={topicInput}
            onChange={e => setTopicInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && requestDraft()}
            placeholder="Enter a topic or keyword (e.g. 'E-2 visa requirements 2025')"
            className="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={requestDraft}
            disabled={requesting || !topicInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { id: "drafts", label: `Blog Drafts (${pendingDrafts.length})` },
          { id: "meta", label: `Meta Optimizer (${pendingMeta.length})` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Drafts Tab */}
      {activeTab === "drafts" && (
        <div className="space-y-4">
          {draftsLoading && <div className="text-center py-12 text-gray-400 animate-pulse">Loading drafts…</div>}
          {!draftsLoading && pendingDrafts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No drafts pending. Request one above or wait for the SEO agent to trigger generation.</p>
            </div>
          )}
          {pendingDrafts.map((d: any) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{d.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {d.targetKeyword && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">🎯 {d.targetKeyword}</span>}
                      {d.wordCount && <span>{d.wordCount.toLocaleString()} words</span>}
                      <span>Trigger: {d.triggerSource || "manual"}</span>
                      <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                    </div>
                    {d.metaDescription && (
                      <p className="text-xs text-gray-500 mt-2 italic">Meta: {d.metaDescription}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setEditingId(d.id); setEditBody(d.body); }} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => approveDraft(d.id)} className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5">
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => discardDraft(d.id)} className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
              {editingId === d.id ? (
                <div className="p-5">
                  <textarea
                    value={editBody}
                    onChange={e => setEditBody(e.target.value)}
                    rows={15}
                    className="w-full font-mono text-xs border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => saveEdit(d.id)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Save Changes</button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-gray-50">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans line-clamp-6">{d.body?.slice(0, 600)}…</pre>
                </div>
              )}
            </div>
          ))}
          {approvedDrafts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Approved</h3>
              {approvedDrafts.map((d: any) => (
                <div key={d.id} className="bg-green-50 rounded-xl border border-green-100 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{d.title}</p>
                    <p className="text-xs text-gray-500">{d.wordCount} words · Approved {new Date(d.approvedAt).toLocaleDateString()}</p>
                  </div>
                  <BadgeCheck className="w-5 h-5 text-green-600" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Meta Tab */}
      {activeTab === "meta" && (
        <div className="space-y-4">
          {metaLoading && <div className="text-center py-12 text-gray-400 animate-pulse">Loading suggestions…</div>}
          {!metaLoading && pendingMeta.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No meta suggestions pending. Run Content Performance Review in Automations to generate suggestions.</p>
            </div>
          )}
          {pendingMeta.map((m: any) => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="font-semibold text-gray-900 text-sm truncate">{m.pageUrl}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    {m.impressions && <span>{m.impressions.toLocaleString()} impressions</span>}
                    {m.currentCtr !== null && <span className="text-red-600">CTR: {(m.currentCtr * 100).toFixed(1)}%</span>}
                  </div>
                </div>
                <button onClick={() => approveMeta(m.id)} className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 shrink-0">
                  <Check className="w-3 h-3" /> Apply
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Current</p>
                  <p className="text-sm font-medium text-gray-900 mb-1">{m.currentTitle || "—"}</p>
                  <p className="text-xs text-gray-500">{m.currentMeta || "—"}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <p className="text-xs font-medium text-blue-400 mb-2 uppercase tracking-wide">✨ Suggested</p>
                  <p className="text-sm font-medium text-blue-900 mb-1">{m.suggestedTitle || "—"}</p>
                  <p className="text-xs text-blue-700">{m.suggestedMeta || "—"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SEO Campaigns Section ────────────────────────────────────────────────────

type Campaign = {
  id: string; targetKeyword: string; targetUrl: string; goalRank: number | null;
  deadline: string | null; currentRank: number | null; startingRank: number | null;
  status: string; autoPublish: boolean; monthlyBudgetCap: number | null;
  killSwitch: boolean; lastRunAt: string | null; lastRetrospective: string | null;
  openBlockers: number; pendingDrafts: number; totalActions: number;
};
type CampaignAction = {
  id: string; campaignId: string; actionType: string; status: string;
  rationale: string | null; expectedImpact: "low" | "medium" | "high" | null; payload: unknown;
  result: unknown; createdAt: string; completedAt: string | null;
};
type Blocker = {
  id: string; campaignId: string; type: string; service: string | null;
  reason: string; instructionsForUser: string | null; priority: string;
  status: string; createdAt: string;
};
type DraftMetadata = {
  slug?: string;
  internalLinkSuggestions?: { anchor: string; target_url_hint: string }[];
  externalCitations?: { claim: string; source_hint: string }[];
  ymylDisclaimerIncluded?: boolean;
};
type ContentDraft = {
  id: string; campaignId: string; title: string; bodyMarkdown: string;
  metaDescription: string | null; targetKeyword: string; wordCount: number | null;
  contentType: string; status: string; publishedUrl: string | null;
  reviewNotes: string | null; metadata: DraftMetadata | null; createdAt: string;
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  blocked: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
};
const actionTypeLabel: Record<string, string> = {
  write_blog_post: "📝 Blog Post",
  on_page_optimization: "🔧 On-Page Opt.",
  technical_audit: "⚙️ Tech Audit",
  haro_response: "📰 HARO Response",
  internal_linking: "🔗 Internal Links",
  competitor_gap_analysis: "🔍 Competitor Gap",
  directory_submission: "📋 Directory",
  guest_post_outreach: "✉️ Outreach",
  request_blocker: "🚧 Blocker",
};
const actionStatusColor: Record<string, string> = {
  planned: "bg-gray-100 text-gray-600",
  running: "bg-blue-100 text-blue-600",
  done: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
  awaiting_approval: "bg-amber-100 text-amber-700",
  skipped: "bg-gray-100 text-gray-400",
};
const draftTypeLabel: Record<string, string> = {
  blog_post: "Blog Post",
  on_page_diff: "Page Checklist",
  outreach_email: "Outreach Email",
  haro_response: "HARO Response",
};

function RankBadge({ rank, goal }: { rank: number | null; goal: number | null }) {
  if (!rank) return <span className="text-xs text-gray-400">Not ranking</span>;
  const isGood = goal ? rank <= goal : rank <= 10;
  return (
    <span className={`font-bold text-sm ${isGood ? "text-green-600" : rank <= 30 ? "text-amber-600" : "text-red-500"}`}>
      #{rank}
    </span>
  );
}

function CampaignDetailPanel({
  campaign,
  onClose,
}: {
  campaign: Campaign;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draftView, setDraftView] = useState<ContentDraft | null>(null);
  const [runLoading, setRunLoading] = useState(false);

  const { data: detail } = useQuery<{
    campaign: Campaign; actions: CampaignAction[]; blockers: Blocker[]; drafts: ContentDraft[];
  }>({
    queryKey: [`/api/seo/campaigns/${campaign.id}`],
    queryFn: () => api(`/api/seo/campaigns/${campaign.id}`),
  });

  const resolveBlocker = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/api/seo/campaigns/blockers/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/seo/campaigns/${campaign.id}`] }); qc.invalidateQueries({ queryKey: ["/api/seo/campaigns"] }); },
  });

  const updateDraft = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes?: string }) =>
      api(`/api/seo/campaigns/drafts/${id}`, { method: "PATCH", body: JSON.stringify({ status, reviewNotes }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/seo/campaigns/${campaign.id}`] }); qc.invalidateQueries({ queryKey: ["/api/seo/campaigns"] }); toast({ title: "Draft updated" }); },
  });

  const updateCampaign = useMutation({
    mutationFn: (data: Partial<Campaign>) =>
      api(`/api/seo/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/seo/campaigns"] }); qc.invalidateQueries({ queryKey: [`/api/seo/campaigns/${campaign.id}`] }); },
  });

  async function runNow() {
    setRunLoading(true);
    try {
      const result = await api(`/api/seo/campaigns/${campaign.id}/run`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["/api/seo/campaigns"] });
      qc.invalidateQueries({ queryKey: [`/api/seo/campaigns/${campaign.id}`] });
      toast({ title: "Daily loop complete", description: `${(result as { steps: unknown[] }).steps?.length ?? 0} steps executed` });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    setRunLoading(false);
  }

  const { actions = [], blockers = [], drafts = [] } = detail || {};
  const openBlockers = blockers.filter(b => b.status === "open");
  const pendingDrafts = drafts.filter(d => d.status === "awaiting_approval");

  if (draftView) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end">
        <div className="bg-white w-full max-w-3xl h-screen overflow-y-auto shadow-xl flex flex-col">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center gap-3">
            <button onClick={() => setDraftView(null)} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
            <div>
              <div className="font-semibold text-gray-900">{draftView.title}</div>
              <div className="text-xs text-gray-500">{draftTypeLabel[draftView.contentType] || draftView.contentType} · {draftView.wordCount?.toLocaleString()} words · {new Date(draftView.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { updateDraft.mutate({ id: draftView.id, status: "rejected" }); setDraftView(null); }}>
                <X className="w-3 h-3 mr-1" /> Reject
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => { updateDraft.mutate({ id: draftView.id, status: "approved" }); setDraftView(null); }}>
                <Check className="w-3 h-3 mr-1" /> Approve
              </Button>
            </div>
          </div>
          {/* SEO metadata panel */}
          <div className="mx-6 mt-4 space-y-3">
            {draftView.metaDescription && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-700">Meta Description</span>
                  <span className={`text-xs ${draftView.metaDescription.length > 160 ? "text-red-500" : "text-blue-400"}`}>
                    {draftView.metaDescription.length}/160
                  </span>
                </div>
                <div className="text-sm text-blue-900">{draftView.metaDescription}</div>
              </div>
            )}
            {draftView.metadata?.slug && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-xs font-medium text-gray-500 mb-1">Suggested URL Slug</div>
                <code className="text-xs text-gray-700">/blog/{draftView.metadata.slug}</code>
              </div>
            )}
            {(draftView.metadata?.internalLinkSuggestions ?? []).length > 0 && (
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="text-xs font-medium text-emerald-700 mb-2">
                  Internal Link Suggestions ({draftView.metadata!.internalLinkSuggestions!.length})
                </div>
                <ul className="space-y-1">
                  {draftView.metadata!.internalLinkSuggestions!.map((s, i) => (
                    <li key={i} className="text-xs text-emerald-800">
                      <span className="font-medium">"{s.anchor}"</span>
                      <span className="text-emerald-500"> → </span>
                      <span className="text-emerald-700">{s.target_url_hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(draftView.metadata?.externalCitations ?? []).length > 0 && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="text-xs font-medium text-amber-700 mb-2">
                  Claims Needing Citations ({draftView.metadata!.externalCitations!.length})
                </div>
                <ul className="space-y-1">
                  {draftView.metadata!.externalCitations!.map((c, i) => (
                    <li key={i} className="text-xs text-amber-800">
                      <span className="italic">"{c.claim}"</span>
                      <span className="text-amber-500"> — </span>
                      <span className="text-amber-700">source: {c.source_hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex-1 p-6">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">{draftView.bodyMarkdown}</pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end">
      <div className="bg-white w-full max-w-2xl h-screen overflow-y-auto shadow-xl flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center gap-3 z-10">
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate">"{campaign.targetKeyword}"</div>
            <div className="text-xs text-gray-500 truncate">{campaign.targetUrl}</div>
          </div>
          <Badge className={statusColors[campaign.status] || "bg-gray-100 text-gray-600"}>{campaign.status}</Badge>
          <Button size="sm" variant="outline" onClick={runNow} disabled={runLoading}>
            {runLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PlayCircle className="w-3 h-3 mr-1" />}
            Run Now
          </Button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Current Rank", value: campaign.currentRank ? `#${campaign.currentRank}` : "—", color: "text-blue-600" },
              { label: "Starting Rank", value: campaign.startingRank ? `#${campaign.startingRank}` : "—", color: "text-gray-600" },
              { label: "Goal Rank", value: campaign.goalRank ? `Top ${campaign.goalRank}` : "—", color: "text-green-600" },
              { label: "Total Actions", value: String(actions.length), color: "text-purple-600" },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <button
              onClick={() => updateCampaign.mutate({ status: campaign.status === "paused" ? "active" : "paused" })}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium ${campaign.status === "paused" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
            >
              {campaign.status === "paused" ? <PlayCircle className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {campaign.status === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              onClick={() => updateCampaign.mutate({ killSwitch: !campaign.killSwitch })}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium ${campaign.killSwitch ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}
            >
              {campaign.killSwitch ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
              {campaign.killSwitch ? "Kill Switch ON" : "Kill Switch"}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 ml-auto cursor-pointer">
              <input type="checkbox" checked={campaign.autoPublish} onChange={e => updateCampaign.mutate({ autoPublish: e.target.checked })} className="rounded" />
              Auto-publish
            </label>
          </div>

          {/* Open blockers */}
          {openBlockers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold text-red-700">Open Blockers ({openBlockers.length})</span>
              </div>
              <div className="space-y-2">
                {openBlockers.map(b => (
                  <div key={b.id} className="border border-red-200 rounded-lg p-3 bg-red-50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium text-red-700 uppercase tracking-wide">{b.type.replace(/_/g, " ")}{b.service ? ` — ${b.service}` : ""}</div>
                        <div className="text-sm text-gray-800 mt-0.5">{b.reason}</div>
                        {b.instructionsForUser && <div className="text-xs text-gray-600 mt-1 italic">{b.instructionsForUser}</div>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => resolveBlocker.mutate({ id: b.id, status: "resolved" })}
                          className="p-1 text-green-600 hover:bg-green-100 rounded" title="Mark resolved">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => resolveBlocker.mutate({ id: b.id, status: "skipped" })}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Skip forever">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending drafts */}
          {pendingDrafts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <PenLine className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-700">Awaiting Your Approval ({pendingDrafts.length})</span>
              </div>
              <div className="space-y-2">
                {pendingDrafts.map(d => (
                  <div key={d.id} className="border border-amber-200 rounded-lg p-3 bg-amber-50 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-amber-600 font-medium">{draftTypeLabel[d.contentType] || d.contentType} · {d.wordCount?.toLocaleString()} words</div>
                      <div className="text-sm font-medium text-gray-800 truncate">{d.title}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => setDraftView(d)}>
                        <Eye className="w-3 h-3 mr-1" /> Review
                      </Button>
                      <button onClick={() => updateDraft.mutate({ id: d.id, status: "approved" })}
                        className="p-1 text-green-600 hover:bg-green-100 rounded" title="Approve">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => updateDraft.mutate({ id: d.id, status: "rejected" })}
                        className="p-1 text-red-400 hover:bg-red-50 rounded" title="Reject">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Retrospective */}
          {campaign.lastRetrospective && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-blue-700">Last AI Retrospective</span>
                {campaign.lastRunAt && <span className="text-xs text-blue-400 ml-auto">{new Date(campaign.lastRunAt).toLocaleDateString()}</span>}
              </div>
              <p className="text-sm text-blue-900 leading-relaxed">{campaign.lastRetrospective}</p>
            </div>
          )}

          {/* Action log */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Action Log</span>
              <span className="text-xs text-gray-400">({actions.length} total)</span>
            </div>
            {actions.length === 0 ? (
              <div className="text-sm text-gray-400 italic">No actions yet. Click "Run Now" to start the first loop.</div>
            ) : (
              <div className="space-y-2">
                {actions.map(a => (
                  <div key={a.id} className="border border-gray-100 rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium">{actionTypeLabel[a.actionType] || a.actionType}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${actionStatusColor[a.status] || "bg-gray-100 text-gray-600"}`}>{a.status}</span>
                      {a.expectedImpact && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          a.expectedImpact === "high" ? "bg-green-100 text-green-700" :
                          a.expectedImpact === "medium" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>{a.expectedImpact} impact</span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{new Date(a.createdAt).toLocaleDateString()}</span>
                    </div>
                    {a.rationale && <p className="text-xs text-gray-600">{a.rationale}</p>}
                    {typeof a.result === "object" && a.result !== null && "message" in a.result && (
                      <p className="text-xs text-gray-500 mt-1 italic">{String((a.result as Record<string, unknown>).message)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All drafts */}
          {drafts.filter(d => d.status !== "awaiting_approval").length > 0 && (
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">All Drafts</div>
              <div className="space-y-2">
                {drafts.filter(d => d.status !== "awaiting_approval").map(d => (
                  <div key={d.id} className="border border-gray-100 rounded-lg p-3 flex items-center gap-3 bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500">{draftTypeLabel[d.contentType] || d.contentType}</div>
                      <div className="text-sm text-gray-800 truncate">{d.title}</div>
                    </div>
                    <Badge className={
                      d.status === "approved" ? "bg-green-100 text-green-700" :
                      d.status === "rejected" ? "bg-red-100 text-red-600" :
                      d.status === "published" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                    }>{d.status}</Badge>
                    <button onClick={() => setDraftView(d)} className="p-1 text-gray-400 hover:text-gray-700 rounded">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CampaignsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ targetKeyword: "", targetUrl: "/", goalRank: "10", deadline: "", monthlyBudgetCap: "0" });

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/seo/campaigns"],
    queryFn: () => api("/api/seo/campaigns"),
    refetchInterval: 30000,
  });

  const createCampaign = useMutation({
    mutationFn: (data: typeof form) => api("/api/seo/campaigns", {
      method: "POST",
      body: JSON.stringify({
        targetKeyword: data.targetKeyword,
        targetUrl: data.targetUrl,
        goalRank: parseInt(data.goalRank) || 10,
        deadline: data.deadline || null,
        monthlyBudgetCap: parseInt(data.monthlyBudgetCap) || 0,
      }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/seo/campaigns"] });
      setShowCreate(false);
      setForm({ targetKeyword: "", targetUrl: "/", goalRank: "10", deadline: "", monthlyBudgetCap: "0" });
      toast({ title: "Campaign created! The daily agent loop will run automatically at 7 AM ET on weekdays. Click 'Run Now' on the campaign to test immediately." });
    },
    onError: () => toast({ title: "Error creating campaign", variant: "destructive" }),
  });

  const deleteCampaign = useMutation({
    mutationFn: (id: string) => api(`/api/seo/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/seo/campaigns"] }); toast({ title: "Campaign deleted" }); },
  });

  const globalKillSwitch = useMutation({
    mutationFn: (enabled: boolean) => api("/api/seo/campaigns/kill-switch", { method: "POST", body: JSON.stringify({ enabled }) }),
    onSuccess: (_, enabled) => { qc.invalidateQueries({ queryKey: ["/api/seo/campaigns"] }); toast({ title: enabled ? "🚨 All campaigns paused (kill switch ON)" : "✅ Kill switch lifted — campaigns active" }); },
  });

  const anyKillSwitch = campaigns.some(c => c.killSwitch);
  const totalOpenBlockers = campaigns.reduce((sum, c) => sum + (c.openBlockers || 0), 0);
  const totalPendingDrafts = campaigns.reduce((sum, c) => sum + (c.pendingDrafts || 0), 0);

  return (
    <div>
      {selectedCampaign && (
        <CampaignDetailPanel
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">SEO Campaigns</h2>
          <p className="text-sm text-gray-500 mt-0.5">Autonomous daily ranking improvement — white-hat only</p>
        </div>
        <div className="flex items-center gap-2">
          {(totalOpenBlockers > 0 || totalPendingDrafts > 0) && (
            <div className="flex items-center gap-2">
              {totalOpenBlockers > 0 && (
                <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
                  <ShieldAlert className="w-3 h-3" /> {totalOpenBlockers} blocker{totalOpenBlockers > 1 ? "s" : ""}
                </span>
              )}
              {totalPendingDrafts > 0 && (
                <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                  <PenLine className="w-3 h-3" /> {totalPendingDrafts} draft{totalPendingDrafts > 1 ? "s" : ""} need review
                </span>
              )}
            </div>
          )}
          <Button
            size="sm" variant="outline"
            className={anyKillSwitch ? "border-red-300 text-red-600 bg-red-50" : "text-gray-600"}
            onClick={() => globalKillSwitch.mutate(!anyKillSwitch)}
          >
            {anyKillSwitch ? <><PowerOff className="w-3 h-3 mr-1.5" /> Kill Switch ON</> : <><Power className="w-3 h-3 mr-1.5" /> Kill Switch</>}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-3 h-3 mr-1.5" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Create campaign form */}
      {showCreate && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">New SEO Campaign</h3>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Target Keyword *</label>
              <Input placeholder='e.g. "E-2 visa franchise Texas"' value={form.targetKeyword}
                onChange={e => setForm(f => ({ ...f, targetKeyword: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Target URL (page to rank) *</label>
              <Input placeholder="/franchise" value={form.targetUrl}
                onChange={e => setForm(f => ({ ...f, targetUrl: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Goal Rank (default: Top 10)</label>
              <Input type="number" min="1" max="100" value={form.goalRank}
                onChange={e => setForm(f => ({ ...f, goalRank: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Deadline (optional)</label>
              <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Monthly Budget Cap ($, 0 = unlimited)</label>
              <Input type="number" min="0" value={form.monthlyBudgetCap}
                onChange={e => setForm(f => ({ ...f, monthlyBudgetCap: e.target.value }))} />
            </div>
          </div>
          <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-700">
            ⚠️ This is a YMYL website (E-2 visa investment content). All generated content will require your approval before publishing — auto-publish is off by default.
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createCampaign.mutate(form)} disabled={!form.targetKeyword || !form.targetUrl || createCampaign.isPending}>
              {createCampaign.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Rocket className="w-3 h-3 mr-1" />}
              Launch Campaign
            </Button>
          </div>
        </div>
      )}

      {/* Campaign list */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <Rocket className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <div className="text-gray-500 font-medium">No campaigns yet</div>
          <div className="text-sm text-gray-400 mt-1">Create your first campaign to start autonomous ranking improvement</div>
          <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
            <Plus className="w-3 h-3 mr-1" /> New Campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => setSelectedCampaign(c)}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={statusColors[c.status] || "bg-gray-100 text-gray-600"} onClick={e => e.stopPropagation()}>{c.status}</Badge>
                    {c.killSwitch && <Badge className="bg-red-100 text-red-600"><PowerOff className="w-2.5 h-2.5 mr-1" />Kill Switch</Badge>}
                    {c.openBlockers > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium">
                        <ShieldAlert className="w-3 h-3" /> {c.openBlockers} blocker{c.openBlockers > 1 ? "s" : ""}
                      </span>
                    )}
                    {c.pendingDrafts > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                        <PenLine className="w-3 h-3" /> {c.pendingDrafts} for review
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-gray-900 truncate">"{c.targetKeyword}"</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate">newdawnfranchising.com{c.targetUrl} · Goal: Top {c.goalRank ?? 10}</div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-center">
                    <RankBadge rank={c.currentRank} goal={c.goalRank} />
                    <div className="text-xs text-gray-400 mt-0.5">Current Rank</div>
                  </div>
                  {c.startingRank && c.currentRank && (
                    <div className="text-center">
                      {c.currentRank < c.startingRank ? (
                        <span className="text-green-600 font-bold text-sm flex items-center gap-0.5">
                          <ArrowUp className="w-3 h-3" />+{c.startingRank - c.currentRank}
                        </span>
                      ) : c.currentRank > c.startingRank ? (
                        <span className="text-red-500 font-bold text-sm flex items-center gap-0.5">
                          <ArrowDown className="w-3 h-3" />{c.currentRank - c.startingRank}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                      <div className="text-xs text-gray-400">vs Start</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-sm font-semibold text-gray-700">{c.totalActions}</div>
                    <div className="text-xs text-gray-400">Actions</div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm("Delete this campaign?")) deleteCampaign.mutate(c.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {c.lastRetrospective && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 line-clamp-2">{c.lastRetrospective}</p>
                </div>
              )}

              {c.lastRunAt && (
                <div className="mt-2 text-xs text-gray-400">
                  Last run: {new Date(c.lastRunAt).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="mt-8 bg-gray-50 rounded-xl p-5 border border-gray-200">
        <h3 className="font-semibold text-gray-700 mb-3 text-sm">How the Agent Works</h3>
        <div className="grid grid-cols-5 gap-2">
          {[
            { icon: Target, label: "1. Rank Check", desc: "Checks current Google rank via SerpAPI every morning" },
            { icon: Bot, label: "2. AI Plans", desc: "Claude analyzes your rank trend + competitors and picks 1-3 actions" },
            { icon: Zap, label: "3. Execute", desc: "Writes blog posts, optimizes pages, finds links — white-hat only" },
            { icon: PenLine, label: "4. Your Review", desc: "All content queued for your approval — nothing published without you" },
            { icon: BarChart2, label: "5. Learns", desc: "End-of-day retrospective feeds into next day's planning" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mx-auto mb-2 border border-gray-200">
                <s.icon className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xs font-medium text-gray-700">{s.label}</div>
              <div className="text-xs text-gray-400 mt-0.5 leading-tight">{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100 text-xs text-green-700">
          <strong>White-hat guarantee:</strong> The agent will never use PBNs, paid links, keyword stuffing, thin AI content, or automated forum posting. All YMYL content (visa/investment topics) requires human approval before publishing. Runs at 7 AM ET weekdays.
        </div>
      </div>
    </div>
  );
}

// ─── Main SEO Page ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Rocket },
  { id: "keywords", label: "Keywords", icon: Target },
  { id: "backlinks", label: "Backlinks", icon: Link2 },
  { id: "content", label: "Content", icon: FileText },
  { id: "content_engine", label: "Content Engine", icon: Sparkles },
  { id: "agent", label: "AI Agent", icon: Bot },
  { id: "reports", label: "Reports", icon: BarChart2 },
  { id: "automations", label: "Automations", icon: TimerReset },
  { id: "visitors", label: "Visitors", icon: Users },
  { id: "comms", label: "SMS Communications", icon: MessageSquare },
] as const;

type SectionId = typeof SECTIONS[number]["id"];

export default function SeoPage() {
  const [, navigate] = useLocation();
  const [section, setSection] = useState<SectionId>("overview");

  // Auth check
  const { data: me, isLoading: authLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => api("/api/auth/me"),
    retry: false,
  });

  const isAdmin = (me as any)?.role === "admin" || (me as any)?.isAdmin;

  useEffect(() => {
    if (!authLoading && (!me || !isAdmin)) {
      navigate("/login");
    }
  }, [me, authLoading, navigate, isAdmin]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!me || !isAdmin) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">SEO Center</div>
              <div className="text-xs text-gray-400">newdawnfranchising.com</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                section === s.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <s.icon className="w-4 h-4 shrink-0" />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => navigate("/crm")}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50"
          >
            <Globe className="w-3 h-3" />
            Back to CRM
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          {section === "overview" && <OverviewSection />}
          {section === "campaigns" && <CampaignsSection />}
          {section === "keywords" && <KeywordsSection />}
          {section === "backlinks" && <BacklinksSection />}
          {section === "content" && <ContentSection />}
          {section === "content_engine" && <ContentEngineSection />}
          {section === "agent" && <AgentSection />}
          {section === "reports" && <ReportsSection />}
          {section === "automations" && <ScheduledTasksPanel />}
          {section === "visitors" && <VisitorsSection />}
          {section === "comms" && <SeoSmsCommsSection />}
        </div>
      </main>
    </div>
  );
}

// ─── SEO Agent SMS Communications Panel ──────────────────────────────────────
interface SeoSmsMsg {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  createdAt: string;
  triggerType?: string;
}

function SeoSmsCommsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery<SeoSmsMsg[]>({
    queryKey: ["agent-sms", "seo"],
    queryFn: () => api("/api/agent-sms/seo"),
    refetchInterval: 10000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMut = useMutation({
    mutationFn: (body: string) => api("/api/agent-sms/seo/send", { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => { setMessage(""); qc.invalidateQueries({ queryKey: ["agent-sms", "seo"] }); },
    onError: (e: Error) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const testMut = useMutation({
    mutationFn: () => api("/api/agent-sms/test", { method: "POST", body: JSON.stringify({ agentType: "seo", message: "Test notification from SEO agent" }) }),
    onSuccess: () => { toast({ title: "Test SMS sent" }); qc.invalidateQueries({ queryKey: ["agent-sms", "seo"] }); },
    onError: (e: Error) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  const sorted = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">SMS Communications — SEO Agent</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Agent line: +1 (407) 449-7941 · Dylan: +1 (863) 360-7768
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {testMut.isPending ? "Sending…" : "Send Test SMS"}
          </button>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["agent-sms", "seo"] })}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 h-[480px] overflow-y-auto space-y-3 flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading messages…</div>
        ) : sorted.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
            <MessageSquare className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">The SEO agent will send notifications here when drafts or blockers arise.</p>
          </div>
        ) : (
          sorted.map(msg => {
            const isDylan = msg.direction === "inbound";
            return (
              <div key={msg.id} className={`flex ${isDylan ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${isDylan ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-800"}`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                  <p className={`text-[10px] mt-1 ${isDylan ? "text-blue-200" : "text-gray-400"}`}>
                    {isDylan ? "Dylan" : "SEO Agent"} · {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                    {msg.status && msg.status !== "sent" && ` · ${msg.status}`}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && message.trim()) { e.preventDefault(); sendMut.mutate(message.trim()); } }}
          placeholder="Reply to SEO Agent…"
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => { if (message.trim()) sendMut.mutate(message.trim()); }}
          disabled={sendMut.isPending || !message.trim()}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
          <Send className="w-4 h-4" />
          {sendMut.isPending ? "Sending…" : "Send"}
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center">
        Messages sent via Quo SMS. Dylan can also reply directly from his phone at any time.
      </p>
    </div>
  );
}
