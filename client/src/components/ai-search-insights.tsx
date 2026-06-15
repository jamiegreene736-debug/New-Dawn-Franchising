import { useState, useEffect, useCallback } from "react";
import { Sparkles, Loader2, Play, Trash2, RefreshCw, PenLine, Check, X, Bell, BarChart3, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SavedSearch {
  id: string; name: string; provider: string; query: string | null;
  active: boolean; lastRunAt: string | null; lastResultCount: number | null;
  lastNewCount: number | null; autoOutreach: boolean; autoChannel: string; autoMinScore: number;
}
interface Analytics {
  rangeDays: number; totalSearches: number; cacheHitRate: number; avgDurationMs: number;
  bySurface: { surface: string; count: number }[]; topQueries: { query: string; count: number }[];
  signals: { total: number; last7d: number }; icp: { scored: number; hot: number; warm: number };
  savedSearches: { active: number; newMatches7d: number };
}
interface Match { contactKey: string; fullName: string; jobTitle: string | null; company: string | null; icpScore: number; icpTier: string; reasons: string[]; }
interface DigestEntry { savedSearch: SavedSearch; newMatches: Match[]; }
interface Queued { id: string; fullName: string; company: string | null; channel: string; subject: string | null; body: string; icpScore: number; }

const TIER: Record<string, string> = {
  hot: "border-red-200 bg-red-50 text-red-700", warm: "border-amber-200 bg-amber-50 text-amber-700",
  cool: "border-sky-200 bg-sky-50 text-sky-700", low: "border-gray-200 bg-gray-50 text-gray-500",
};

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AiSearchInsights() {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [digest, setDigest] = useState<DigestEntry[]>([]);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // New saved-search form
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [autoOutreach, setAutoOutreach] = useState(false);
  const [autoChannel, setAutoChannel] = useState<"email" | "linkedin">("email");
  const [autoMinScore, setAutoMinScore] = useState(70);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s, d, q] = await Promise.all([
        apiRequest("GET", "/api/crm/search-analytics?days=30").then((r) => r.json()),
        apiRequest("GET", "/api/crm/saved-searches").then((r) => r.json()),
        apiRequest("GET", "/api/crm/saved-searches/digest?hours=168").then((r) => r.json()),
        apiRequest("GET", "/api/crm/auto-outreach/queue").then((r) => r.json()),
      ]);
      setAnalytics(a);
      setSaved(s.savedSearches || []);
      setDigest(d.digest || []);
      setQueue(q.queue || []);
    } catch {
      toast({ title: "Couldn't load AI search insights", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function createSaved() {
    if (!name.trim() || !query.trim()) { toast({ title: "Add a name and a query" }); return; }
    setBusy("create");
    try {
      await apiRequest("POST", "/api/crm/saved-searches", { name, query, autoOutreach, autoChannel, autoMinScore });
      setName(""); setQuery(""); setAutoOutreach(false);
      toast({ title: "Saved search created" });
      await load();
    } catch { toast({ title: "Couldn't save search", variant: "destructive" }); }
    finally { setBusy(null); }
  }

  async function runOne(id: string) {
    setBusy(id);
    try {
      const r = await apiRequest("POST", `/api/crm/saved-searches/${id}/run`, {}).then((x) => x.json());
      toast({ title: "Search ran", description: `${r.newMatches?.length ?? 0} new match(es)` });
      await load();
    } catch { toast({ title: "Run failed", variant: "destructive" }); }
    finally { setBusy(null); }
  }

  async function runAll() {
    setBusy("run-all");
    try {
      const r = await apiRequest("POST", "/api/crm/saved-searches/run-all", {}).then((x) => x.json());
      toast({ title: "Watchlists refreshed", description: `${r.totalNew ?? 0} new high-intent match(es)` });
      await load();
    } catch { toast({ title: "Run failed", variant: "destructive" }); }
    finally { setBusy(null); }
  }

  async function removeSaved(id: string) {
    setBusy(id);
    try { await apiRequest("DELETE", `/api/crm/saved-searches/${id}`); await load(); }
    catch { toast({ title: "Delete failed", variant: "destructive" }); }
    finally { setBusy(null); }
  }

  async function queueAction(id: string, action: "approve" | "dismiss") {
    setBusy(id);
    try {
      await apiRequest("POST", `/api/crm/auto-outreach/${id}/${action}`, {});
      setQueue((q) => q.filter((x) => x.id !== id));
    } catch { toast({ title: "Action failed", variant: "destructive" }); }
    finally { setBusy(null); }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" /> Loading AI search insights…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-[hsl(var(--primary))]" />
          <h2 className="text-lg font-semibold">AI Search Insights</h2>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={!!busy}><RefreshCw className="mr-1 size-3.5" /> Refresh</Button>
      </div>

      {/* Analytics */}
      {analytics && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><BarChart3 className="size-4" /> Last {analytics.rangeDays} days</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Searches" value={analytics.totalSearches} />
            <Stat label="Cache hit" value={`${Math.round(analytics.cacheHitRate * 100)}%`} />
            <Stat label="Avg latency" value={`${analytics.avgDurationMs}ms`} />
            <Stat label="Signals (7d)" value={analytics.signals.last7d} sub={`${analytics.signals.total} total`} />
            <Stat label="ICP scored" value={analytics.icp.scored} sub={`${analytics.icp.hot} hot · ${analytics.icp.warm} warm`} />
            <Stat label="New matches (7d)" value={analytics.savedSearches.newMatches7d} sub={`${analytics.savedSearches.active} watchlists`} />
          </div>
          {analytics.topQueries.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">Top queries: {analytics.topQueries.slice(0, 5).map((q) => `"${q.query}" (${q.count})`).join(" · ")}</p>
          )}
        </div>
      )}

      {/* Create saved search */}
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Bookmark className="size-4" /> New watchlist</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. UK founders exploring US)" className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="What to look for…" className="flex-[2] rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={autoOutreach} onChange={(e) => setAutoOutreach(e.target.checked)} /> Auto-draft outreach for new matches
          </label>
          {autoOutreach && (
            <>
              <select value={autoChannel} onChange={(e) => setAutoChannel(e.target.value as "email" | "linkedin")} className="rounded-md border border-input bg-transparent px-2 py-1">
                <option value="email">Email</option>
                <option value="linkedin">LinkedIn</option>
              </select>
              <label className="inline-flex items-center gap-1.5">min score
                <input type="number" min={0} max={100} value={autoMinScore} onChange={(e) => setAutoMinScore(parseInt(e.target.value, 10) || 0)} className="w-16 rounded-md border border-input bg-transparent px-2 py-1" />
              </label>
              <span className="text-muted-foreground">drafts queue for your approval — never auto-sent</span>
            </>
          )}
          <Button size="sm" className="ml-auto" onClick={createSaved} disabled={busy === "create"}>
            {busy === "create" ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      {/* Saved searches */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Watchlists ({saved.length})</p>
          {saved.length > 0 && <Button size="sm" variant="outline" onClick={runAll} disabled={busy === "run-all"}>{busy === "run-all" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Play className="mr-1 size-3.5" />} Run all now</Button>}
        </div>
        {saved.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No watchlists yet. Create one above to monitor for new high-intent prospects daily.</p>
        ) : (
          <div className="space-y-2">
            {saved.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name} {s.autoOutreach && <span className="ml-1 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">AUTO-PILOT ≥{s.autoMinScore}</span>}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{s.query || "(filters)"} · {s.lastRunAt ? `last run ${new Date(s.lastRunAt).toLocaleString()}` : "never run"} · {s.lastNewCount ?? 0} new / {s.lastResultCount ?? 0}</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => runOne(s.id)} disabled={busy === s.id}>{busy === s.id ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-red-600" onClick={() => removeSaved(s.id)} disabled={busy === s.id}><Trash2 className="size-3" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-pilot approval queue */}
      {queue.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><PenLine className="size-4" /> Auto-drafted outreach awaiting approval ({queue.length})</p>
          <div className="space-y-2">
            {queue.map((q) => (
              <div key={q.id} className="rounded-lg border bg-card p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-sm font-medium">{q.fullName}{q.company ? ` · ${q.company}` : ""} <span className="ml-1 text-[11px] text-muted-foreground">{q.channel} · ICP {q.icpScore}</span></p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-[11px] text-green-700" onClick={() => queueAction(q.id, "approve")} disabled={busy === q.id}><Check className="size-3" /> Approve</Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px] text-muted-foreground" onClick={() => queueAction(q.id, "dismiss")} disabled={busy === q.id}><X className="size-3" /> Dismiss</Button>
                  </div>
                </div>
                {q.subject && <p className="text-[11px] font-medium">{q.subject}</p>}
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/90">{q.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Digest of recent new matches */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Bell className="size-4" /> New matches this week</p>
        {digest.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No new matches yet. They'll appear here as watchlists run.</p>
        ) : (
          <div className="space-y-3">
            {digest.map((e) => (
              <div key={e.savedSearch.id} className="rounded-lg border bg-card p-3">
                <p className="mb-1.5 text-sm font-semibold">{e.savedSearch.name} <span className="text-[11px] font-normal text-muted-foreground">· {e.newMatches.length} new</span></p>
                <div className="space-y-1">
                  {e.newMatches.slice(0, 8).map((m) => (
                    <div key={m.contactKey} className="flex items-center gap-2 text-xs">
                      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${TIER[m.icpTier] || TIER.low}`}>{m.icpScore}</span>
                      <span className="font-medium">{m.fullName}</span>
                      <span className="truncate text-muted-foreground">{[m.jobTitle, m.company].filter(Boolean).join(" · ")}</span>
                    </div>
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
