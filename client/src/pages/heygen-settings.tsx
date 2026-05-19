import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Video, Settings, CheckCircle2, AlertCircle, Loader2, Play, Edit3, Trash2,
  Plus, RefreshCw, Info, ChevronDown, ChevronUp, Eye, Cpu, DollarSign,
  BarChart2, Send, Mail, MessageSquare, FileText, ToggleLeft, ToggleRight,
  X, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  return res.json();
}
async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
  return res.json();
}
async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
  return res.json();
}
async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: "DELETE", credentials: "include" });
  return res.json();
}

// ─── Avatar Verify ────────────────────────────────────────────────────────────

function AvatarVerify({ avatarId }: { avatarId: string }) {
  const { data: avatars = [], isLoading, error } = useQuery<any[]>({
    queryKey: ["heygen-avatars"],
    queryFn: () => apiGet("/api/heygen/avatars"),
    staleTime: 60000,
  });

  const matched = avatars.find((a: any) => a.avatar_id === avatarId);

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="size-4 animate-spin" /> Verifying avatar…</div>;
  if (error) return <div className="flex items-center gap-2 text-sm text-red-500"><AlertCircle className="size-4" /> Could not reach HeyGen API</div>;

  if (!avatarId) return (
    <div className="flex items-center gap-2 text-sm text-amber-600">
      <AlertCircle className="size-4" /> No Avatar ID configured
    </div>
  );

  if (!matched) return (
    <div className="flex items-center gap-2 text-sm text-red-500">
      <AlertCircle className="size-4" /> Avatar ID not found in your HeyGen account ({avatars.length} available)
    </div>
  );

  return (
    <div className="flex items-center gap-3">
      {matched.preview_image_url && (
        <img src={matched.preview_image_url} alt={matched.avatar_name} className="size-12 rounded-full object-cover border-2 border-green-200" />
      )}
      <div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-green-500" />
          <span className="text-sm font-semibold text-green-700">✓ Connected — {matched.avatar_name}</span>
        </div>
        <p className="text-xs text-gray-400">ID: {avatarId}</p>
      </div>
    </div>
  );
}

// ─── Script Template Manager ──────────────────────────────────────────────────

interface ScriptTemplate {
  id: string; label: string; script: string; touchType?: string; useCount: number; createdAt: string;
}

function ScriptTemplates() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", script: "", touchType: "" });
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ label: "", script: "", touchType: "" });

  const { data: templates = [] } = useQuery<ScriptTemplate[]>({
    queryKey: ["heygen-templates"],
    queryFn: () => apiGet("/api/heygen/templates"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: any) => apiPatch(`/api/heygen/templates/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["heygen-templates"] }); setEditingId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/heygen/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["heygen-templates"] }),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiPost("/api/heygen/templates", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["heygen-templates"] }); setAdding(false); setNewForm({ label: "", script: "", touchType: "" }); },
  });

  const TOUCH_TYPES = [
    { key: "hot_first_contact",   label: "HOT lead first contact" },
    { key: "touch3_no_reply",     label: "Touch 3 — no reply" },
    { key: "post_consultation",   label: "Post-consultation" },
    { key: "re_engagement",       label: "Re-engagement 30d" },
    { key: "custom",              label: "Custom" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900">Script Templates</h3>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
          <Plus className="size-4" /> Add Template
        </Button>
      </div>

      {adding && (
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/40 p-4 mb-4 space-y-3">
          <h4 className="font-semibold text-sm text-indigo-800">New Template</h4>
          <input value={newForm.label} onChange={e => setNewForm(p => ({ ...p, label: e.target.value }))}
            placeholder="Template label" className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <select value={newForm.touchType} onChange={e => setNewForm(p => ({ ...p, touchType: e.target.value }))}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">Select touch type (optional)</option>
            {TOUCH_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <textarea value={newForm.script} onChange={e => setNewForm(p => ({ ...p, script: e.target.value }))}
            placeholder="Write the script here…" rows={5}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y" />
          <div className="flex gap-2">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => createMut.mutate(newForm)} disabled={!newForm.label || !newForm.script || createMut.isPending}>
              {createMut.isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3.5" />} Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates.map(t => (
          <div key={t.id} className="rounded-xl border bg-white p-4">
            {editingId === t.id ? (
              <div className="space-y-3">
                <input value={editForm.label} onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <textarea value={editForm.script} onChange={e => setEditForm(p => ({ ...p, script: e.target.value }))}
                  rows={5} className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y" />
                <div className="flex gap-2">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => updateMut.mutate({ id: t.id, ...editForm })}>Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{t.label}</p>
                    {t.touchType && <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 text-[10px] mt-0.5">{t.touchType}</Badge>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingId(t.id); setEditForm({ label: t.label, script: t.script, touchType: t.touchType ?? "" }); }}>
                      <Edit3 className="size-3.5 text-gray-400" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { if (confirm("Delete?")) deleteMut.mutate(t.id); }}>
                      <Trash2 className="size-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{t.script}</p>
                <p className="text-[11px] text-gray-400 mt-2">Used {t.useCount}× · {new Date(t.createdAt).toLocaleDateString()}</p>
              </>
            )}
          </div>
        ))}
        {templates.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No templates yet — add one above</p>}
      </div>
    </div>
  );
}

// ─── Video History ────────────────────────────────────────────────────────────

function VideoHistory() {
  const { data: stats } = useQuery<any>({ queryKey: ["heygen-stats"], queryFn: () => apiGet("/api/heygen/stats") });
  const { data: videos = [] } = useQuery<any[]>({ queryKey: ["heygen-videos"], queryFn: () => apiGet("/api/heygen/videos?limit=30") });

  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-gray-100 text-gray-500", rendering: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700", failed: "bg-red-100 text-red-700",
    timed_out: "bg-red-50 text-red-400",
  };

  return (
    <div>
      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
          {[
            { label: "Generated (all time)", value: stats.totalGenerated },
            { label: "Sent",                 value: stats.totalSent      },
            { label: "This month",           value: stats.thisMonthGenerated },
            { label: "Click rate",           value: `${stats.clickRate}%` },
            { label: "Avg render",           value: stats.avgRenderSec ? `${stats.avgRenderSec}s` : "N/A" },
            { label: "Est. monthly cost",    value: `$${stats.estimatedMonthlyCost}`, color: "text-green-700" },
          ].map((m, i) => (
            <div key={i} className="rounded-xl border bg-white p-3 text-center">
              <p className={`text-xl font-black ${m.color ?? "text-gray-900"}`}>{m.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{m.label}</p>
            </div>
          ))}
        </div>
      )}

      {stats?.demoMode && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <Info className="size-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">Demo mode — add HEYGEN_API_KEY, HEYGEN_AVATAR_ID, HEYGEN_VOICE_ID to enable live video generation.</p>
        </div>
      )}

      {/* Video list */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Lead", "Script Preview", "Channel", "Status", "Delivery", "Date", "Cost"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {videos.map((v: any) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{v.leadName ?? v.leadId.slice(0,8)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs"><p className="truncate text-xs">{v.script?.slice(0, 80)}…</p></td>
                  <td className="px-4 py-3 capitalize text-xs text-gray-600 whitespace-nowrap">{v.deliveryChannel ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status] ?? STATUS_COLORS.pending}`}>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 capitalize whitespace-nowrap">{v.deliveryStatus.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(v.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">~$0.20</td>
                </tr>
              ))}
              {videos.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No videos generated yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

type Tab = "avatar" | "templates" | "automation" | "history";

export default function HeygenSettingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("avatar");
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["heygen-settings"],
    queryFn: () => apiGet<any>("/api/heygen/settings"),
  });

  useEffect(() => {
    if (settings && !form) setForm({ ...settings });
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: (data: any) => apiPatch("/api/heygen/settings", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["heygen-settings"] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "avatar",      label: "Avatar & Voice",  icon: Cpu      },
    { id: "automation",  label: "Automation Rules", icon: Settings },
    { id: "templates",   label: "Script Templates", icon: Edit3    },
    { id: "history",     label: "Video History",    icon: BarChart2 },
  ];

  if (!form) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="size-8 animate-spin text-indigo-400" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <Video className="size-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">HeyGen AI Video</h1>
          <p className="text-sm text-gray-500">Dylan's AI avatar for personalised video outreach</p>
        </div>
        {settings?.demoMode && (
          <Badge className="ml-auto bg-amber-100 text-amber-700 border-amber-200">Demo Mode</Badge>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 border-b">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}>
            <t.icon className="size-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* ── Avatar & Voice Tab ── */}
      {tab === "avatar" && (
        <div className="space-y-6">
          {/* Avatar */}
          <div className="rounded-xl border bg-white p-5">
            <h3 className="font-bold text-gray-900 mb-4">Avatar Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">HeyGen Avatar ID</label>
                <input value={form.avatarId ?? ""} onChange={e => setForm((p: any) => ({ ...p, avatarId: e.target.value }))}
                  placeholder="Enter your HeyGen avatar ID"
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <p className="text-[11px] text-gray-400 mt-1">Found in your HeyGen account under Avatars. You can also set HEYGEN_AVATAR_ID as an environment variable.</p>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Avatar Status</p>
                <AvatarVerify avatarId={form.avatarId ?? ""} />
              </div>
            </div>
          </div>

          {/* Voice */}
          <div className="rounded-xl border bg-white p-5">
            <h3 className="font-bold text-gray-900 mb-4">Voice Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">HeyGen Voice ID</label>
                <input value={form.voiceId ?? ""} onChange={e => setForm((p: any) => ({ ...p, voiceId: e.target.value }))}
                  placeholder="Enter your HeyGen voice ID"
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Speaking Speed</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={0.8} max={1.2} step={0.05} value={form.speakingSpeed ?? 1.0}
                      onChange={e => setForm((p: any) => ({ ...p, speakingSpeed: parseFloat(e.target.value) }))}
                      className="flex-1 accent-indigo-600" />
                    <span className="text-sm font-bold text-gray-700 w-10 text-right">{(form.speakingSpeed ?? 1.0).toFixed(2)}×</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Background Colour</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.bgColour ?? "#ffffff"}
                      onChange={e => setForm((p: any) => ({ ...p, bgColour: e.target.value }))}
                      className="h-9 w-14 rounded border cursor-pointer" />
                    <span className="text-sm text-gray-600 font-mono">{form.bgColour ?? "#ffffff"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Default channel */}
          <div className="rounded-xl border bg-white p-5">
            <h3 className="font-bold text-gray-900 mb-4">Default Delivery Channel</h3>
            <div className="flex gap-3">
              {(["email", "sms", "whatsapp"] as const).map(ch => (
                <button key={ch} onClick={() => setForm((p: any) => ({ ...p, defaultChannel: ch }))}
                  className={`flex-1 rounded-xl border-2 py-3 text-sm font-semibold capitalize transition-colors ${form.defaultChannel === ch ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Save */}
          <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            {saveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saved ? "Saved ✓" : "Save Settings"}
          </Button>
        </div>
      )}

      {/* ── Automation Tab ── */}
      {tab === "automation" && (
        <div className="space-y-5">
          <div className="rounded-xl border bg-white p-5">
            <h3 className="font-bold text-gray-900 mb-1">Auto-trigger Rules</h3>
            <p className="text-sm text-gray-500 mb-5">Videos generated during the 6 AM preparation run and included in the daily brief for your approval.</p>
            <div className="space-y-4">
              {[
                { key: "autoHotLeads",  label: "HOT leads (85+) on first contact",       desc: "Lead with a personalised video instead of a plain cold email" },
                { key: "autoTouch3",    label: "Touch 3 — no reply after Touch 2 (60+)", desc: "Switch to video outreach when email isn't getting replies" },
                { key: "autoPostCall",  label: "Post-consultation follow-up (48 hours)",  desc: "Warm follow-up video 48 hours after a completed discovery call" },
              ].map(rule => (
                <div key={rule.key} className="flex items-center gap-4 p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                  <button onClick={() => setForm((p: any) => ({ ...p, [rule.key]: !p[rule.key] }))} className="shrink-0">
                    {form[rule.key] ? <ToggleRight className="size-8 text-indigo-600" /> : <ToggleLeft className="size-8 text-gray-300" />}
                  </button>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{rule.label}</p>
                    <p className="text-xs text-gray-400">{rule.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h3 className="font-bold text-gray-900 mb-1">Daily Video Limit</h3>
            <p className="text-sm text-gray-500 mb-4">Cap the number of videos generated per day to control HeyGen API costs and rate limits.</p>
            <div className="flex items-center gap-4">
              <input type="number" min={1} max={20} value={form.dailyVideoLimit ?? 5}
                onChange={e => setForm((p: any) => ({ ...p, dailyVideoLimit: parseInt(e.target.value) || 5 }))}
                className="w-20 rounded-lg border px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <div>
                <p className="text-sm text-gray-600">videos per day</p>
                <p className="text-xs text-gray-400">~${((form.dailyVideoLimit ?? 5) * 0.20).toFixed(2)}/day estimated cost</p>
              </div>
            </div>
          </div>

          <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            {saveMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saved ? "Saved ✓" : "Save Settings"}
          </Button>
        </div>
      )}

      {/* ── Templates Tab ── */}
      {tab === "templates" && <ScriptTemplates />}

      {/* ── History Tab ── */}
      {tab === "history" && <VideoHistory />}
    </div>
  );
}
