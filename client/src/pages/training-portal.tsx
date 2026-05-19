import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, CheckCircle2, Circle, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  Award, GraduationCap, Clock, LogOut, Home, AlertTriangle, Loader2, Lock,
  FileText, Upload, AlertCircle, Trophy, Star, Menu, X, Bell, Search, HelpCircle,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CHECKLIST_ITEMS, TRAINING_TRACKS, TrainingModule } from "@shared/training-content";
import logo from "@assets/Gemini_Generated_Image_t1u2o5t1u2o5t1u2_1771946732580.png";

// ─── Types ────────────────────────────────────────────────────────────────────

type View =
  | "login"
  | "checklist"
  | "dashboard"
  | "modules"
  | "module-detail"
  | "certificates";

interface Franchisee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  territory?: string;
  checklistComplete: boolean;
  calendlyUrl?: string;
}

// ─── Demo Mode Engine ─────────────────────────────────────────────────────────

const DEMO_FRANCHISEE: Franchisee = {
  id: "demo-user",
  firstName: "Alex",
  lastName: "Rivera",
  email: "demo@newdawnfranchising.com",
  territory: "El Paso West Territory",
  checklistComplete: true,
  calendlyUrl: "https://calendly.com/dylan-newdawnfranchising",
};

function buildDemoState() {
  const now = new Date().toISOString();
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const oneWeekAgo  = new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString();

  const mkProg = (key: string, status: "in_progress" | "completed", at?: string) => ({
    id: `demo-prog-${key}`, franchiseeId: "demo-user", moduleKey: key,
    status, quizScore: status === "completed" ? 80 : null,
    quizAttempts: status === "completed" ? 1 : 0,
    lastLessonIndex: 0,
    completedAt: at ?? null, updatedAt: now,
  });

  return {
    checklist: CHECKLIST_ITEMS.map((ci, i) => ({
      id: `demo-cl-${ci.key}`, franchiseeId: "demo-user", itemKey: ci.key,
      status: "confirmed",
      notes: i === 0 ? "LexTex LLC registered with Texas Secretary of State"
           : i === 1 ? "Business account opened at Wells Fargo, El Paso" : "",
      confirmedAt: twoWeeksAgo, overriddenBy: null,
    })),
    progress: {
      "1.1": mkProg("1.1", "completed", twoWeeksAgo),
      "1.2": mkProg("1.2", "completed", twoWeeksAgo),
      "1.3": mkProg("1.3", "completed", oneWeekAgo),
      "2.1": mkProg("2.1", "completed", oneWeekAgo),
      "2.2": mkProg("2.2", "in_progress"),
    } as Record<string, ReturnType<typeof mkProg>>,
    certificates: [
      { id: "demo-cert-1", franchiseeId: "demo-user", type: "track_1",
        issuedAt: oneWeekAgo, verificationId: "DEMO-TRACK1-VERIFY" },
    ],
    announcements: [
      { id: "demo-ann-1", title: "Welcome to the Franchisee Training Portal!",
        body: "Explore your training modules, complete quizzes, and earn certificates at your own pace. Your dedicated territory manager is here to support you every step of the way.",
        isUrgent: false, publishedAt: twoWeeksAgo },
    ],
    acknowledgedDisclaimers: [] as string[],
  };
}

let _isDemoMode = false;
let _demoState: ReturnType<typeof buildDemoState> | null = null;

function enableDemoMode()  { _isDemoMode = true;  _demoState = buildDemoState(); }
function disableDemoMode() { _isDemoMode = false; _demoState = null; }

function handleDemoRequest(path: string, opts?: RequestInit): unknown {
  const method = (opts?.method ?? "GET").toUpperCase();
  const body: Record<string, any> = opts?.body ? JSON.parse(opts.body as string) : {};
  const ds = _demoState!;

  if (path === "/me")     return DEMO_FRANCHISEE;
  if (path === "/logout") return {};
  if (path === "/login")  return { franchisee: DEMO_FRANCHISEE };

  if (path === "/checklist") return ds.checklist;
  if (path.startsWith("/checklist/") && method === "PUT") {
    const key = path.split("/")[2];
    const item = ds.checklist.find(i => i.itemKey === key);
    if (item) { item.status = body.status ?? "confirmed"; item.notes = body.notes ?? ""; }
    return {};
  }

  if (path === "/training/tracks") {
    return TRAINING_TRACKS.map(track => ({
      number: track.number, title: track.title, subtitle: track.subtitle,
      showDisclaimer: track.showDisclaimer ?? false, disclaimerBanner: track.disclaimerBanner,
      modules: track.modules.map(mod => ({
        key: mod.key, track: mod.track, title: mod.title,
        description: mod.description, passMark: mod.passMark,
        requiresDisclaimerAck: mod.requiresDisclaimerAck,
        progress: ds.progress[mod.key] ?? null,
      })),
    }));
  }

  if (path.startsWith("/training/module/")) {
    const key = path.replace("/training/module/", "");
    const track = TRAINING_TRACKS.find(t => t.modules.some(m => m.key === key));
    const module = track?.modules.find(m => m.key === key);
    if (!module) throw { error: "not_found" };
    return { module, progress: ds.progress[key] ?? null };
  }

  if (path.startsWith("/training/progress/") && method === "POST") {
    const key = path.replace("/training/progress/", "");
    const status = body.status ?? "in_progress";
    if (!ds.progress[key]) {
      ds.progress[key] = { id: `demo-prog-${key}`, franchiseeId: "demo-user", moduleKey: key,
        status, quizScore: null, quizAttempts: 0, lastLessonIndex: 0,
        completedAt: null, updatedAt: new Date().toISOString() };
    } else if (status === "in_progress" && ds.progress[key].status !== "completed") {
      ds.progress[key].status = status;
    }
    return {};
  }

  if (path.startsWith("/training/quiz/") && method === "POST") {
    const key = path.replace("/training/quiz/", "");
    const track = TRAINING_TRACKS.find(t => t.modules.some(m => m.key === key));
    const module = track?.modules.find(m => m.key === key);
    if (!module) return { score: 0, passed: false, correct: 0, total: 0, passMark: 80 };
    const answers: Record<string, number> = body.answers ?? {};
    let correct = 0;
    module.quiz.forEach(q => { if (answers[q.id] === q.correctIndex) correct++; });
    const total   = module.quiz.length;
    const score   = Math.round((correct / total) * 100);
    const passMark = module.passMark ?? 80;
    const passed   = score >= passMark;
    const alreadyPassed = ds.progress[key]?.status === "completed";
    if (passed && !alreadyPassed) {
      ds.progress[key] = { id: `demo-prog-${key}`, franchiseeId: "demo-user", moduleKey: key,
        status: "completed", quizScore: score,
        quizAttempts: (ds.progress[key]?.quizAttempts ?? 0) + 1, lastLessonIndex: 0,
        completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const allDone = track!.modules.every(m => ds.progress[m.key]?.status === "completed");
      if (allDone) {
        const certType = `track_${track!.number}`;
        if (!ds.certificates.some(c => c.type === certType)) {
          ds.certificates.push({ id: `demo-cert-${track!.number}`, franchiseeId: "demo-user",
            type: certType, issuedAt: new Date().toISOString(),
            verificationId: `DEMO-${certType.toUpperCase()}-${Date.now()}` });
        }
      }
    }
    return { score, passed, correct, total, passMark, alreadyPassed };
  }

  if (path === "/certificates")  return ds.certificates;
  if (path === "/announcements") return ds.announcements;
  if (path.includes("/announcements/")) return {};
  if (path === "/disclaimer/status") return { acknowledged: ds.acknowledgedDisclaimers };
  if (path === "/disclaimer/acknowledge" && method === "POST") {
    const type = body.disclaimerType;
    if (type && !ds.acknowledgedDisclaimers.includes(type)) ds.acknowledgedDisclaimers.push(type);
    return {};
  }
  return {};
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  if (_isDemoMode) return handleDemoRequest(path, opts) as T;
  const res = await fetch(`/api/franchisee${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data as T;
}

// ─── Login View ───────────────────────────────────────────────────────────────

function LoginView({ onLogin, onDemoLogin }: { onLogin: (f: Franchisee) => void; onDemoLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api<{ franchisee: Franchisee }>("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin(data.franchisee);
    } catch (err: any) {
      setError(err.error || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4">
        <a href="/" className="flex items-center gap-2">
          <img src={logo} alt="New Dawn Franchising" className="h-12 w-auto" />
        </a>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          {/* Demo card */}
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border-2 border-violet-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <FlaskConical className="size-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-violet-900 text-sm">Want to explore first?</p>
                <p className="text-xs text-violet-600 mt-0.5 leading-relaxed">
                  Take a tour with sample data — see the dashboard, read training modules, try quizzes, and view certificates. No account needed.
                </p>
              </div>
            </div>
            <Button
              data-testid="button-demo-login"
              onClick={onDemoLogin}
              className="w-full mt-4 bg-violet-600 hover:bg-violet-700 gap-2"
            >
              <FlaskConical className="size-4" /> Try Demo — No Login Required
            </Button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-blue-50 mb-4">
                <GraduationCap className="size-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Franchisee Training Portal</h1>
              <p className="text-sm text-gray-500 mt-2">New Dawn Franchising LLC</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                <Input
                  data-testid="input-franchisee-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <Input
                  data-testid="input-franchisee-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </div>
              )}
              <Button
                data-testid="button-franchisee-login"
                type="submit"
                className="w-full h-11"
                disabled={loading}
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Sign in to Training Portal
              </Button>
            </form>
            <p className="text-center text-xs text-gray-400 mt-6">
              This portal is for New Dawn Franchising franchisees only.
              <br />Contact <a href="mailto:franchising@newdawnfranchising.com" className="underline">franchising@newdawnfranchising.com</a> for access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Checklist View ───────────────────────────────────────────────────────────

function ChecklistView({
  franchisee,
  onComplete,
}: {
  franchisee: Franchisee;
  onComplete: () => void;
}) {
  const qc = useQueryClient();
  const { data: checklistItems = [], isLoading } = useQuery({
    queryKey: ["checklist"],
    queryFn: () => api<any[]>("/checklist"),
  });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  const confirmedCount = checklistItems.filter((i) => i.status === "confirmed").length;
  const allConfirmed = confirmedCount === CHECKLIST_ITEMS.length && confirmedCount > 0;

  useEffect(() => {
    if (allConfirmed) {
      setTimeout(() => setShowComplete(true), 300);
    }
  }, [allConfirmed]);

  const markConfirmed = async (key: string) => {
    setSavingKey(key);
    try {
      const itemNotes = notes[key] ?? checklistItems.find((i) => i.itemKey === key)?.notes ?? "";
      await api(`/checklist/${key}`, {
        method: "PUT",
        body: JSON.stringify({ status: "confirmed", notes: itemNotes }),
      });
      await qc.invalidateQueries({ queryKey: ["checklist"] });
    } catch (e) {
      console.error(e);
    } finally {
      setSavingKey(null);
    }
  };

  const iconMap: Record<string, React.ReactNode> = {
    building: <span className="text-2xl">🏢</span>,
    banknote: <span className="text-2xl">🏦</span>,
    "file-check": <span className="text-2xl">📋</span>,
    award: <span className="text-2xl">🏆</span>,
    shield: <span className="text-2xl">🛡️</span>,
    "shield-check": <span className="text-2xl">✅</span>,
    "map-pin": <span className="text-2xl">📍</span>,
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (showComplete) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Your franchise is ready to launch.</h2>
        <p className="text-lg text-gray-600 mb-2">All pre-training requirements are confirmed.</p>
        <p className="text-gray-500 mb-8">Your training modules are now unlocked. Let's build your business.</p>
        <Button size="lg" onClick={onComplete} className="gap-2">
          Start Training <ChevronRight className="size-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Launch Your Franchise Checklist</h1>
        <p className="text-gray-500 text-sm">Complete all 7 items to unlock your training modules.</p>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{confirmedCount} of {CHECKLIST_ITEMS.length} complete</span>
            <span className="text-sm font-semibold text-blue-600">{Math.round((confirmedCount / CHECKLIST_ITEMS.length) * 100)}%</span>
          </div>
          <Progress value={(confirmedCount / CHECKLIST_ITEMS.length) * 100} className="h-2.5" />
        </div>
      </div>

      <div className="space-y-4">
        {CHECKLIST_ITEMS.map((ci, index) => {
          const dbItem = checklistItems.find((i) => i.itemKey === ci.key);
          const isConfirmed = dbItem?.status === "confirmed";
          const isExpanded = expanded === ci.key;
          const isOverridden = !!dbItem?.overriddenBy;

          return (
            <div
              key={ci.key}
              data-testid={`card-checklist-${ci.key}`}
              className={`rounded-xl border-2 transition-all ${
                isConfirmed
                  ? "border-green-200 bg-green-50"
                  : "border-gray-200 bg-white hover:border-blue-200"
              }`}
            >
              <button
                className="w-full flex items-start gap-4 p-5 text-left"
                onClick={() => setExpanded(isExpanded ? null : ci.key)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`flex items-center justify-center size-10 rounded-xl shrink-0 ${
                    isConfirmed ? "bg-green-100" : "bg-gray-100"
                  }`}>
                    {(ci.icon ? iconMap[ci.icon] : undefined) ?? <span className="text-xl">📝</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-400">ITEM {index + 1}</span>
                      {isConfirmed && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                          {isOverridden ? "Confirmed by admin" : "✓ Confirmed"}
                        </Badge>
                      )}
                    </div>
                    <p className={`font-semibold text-sm mt-0.5 ${isConfirmed ? "text-green-800" : "text-gray-900"}`}>
                      {ci.title}
                    </p>
                  </div>
                </div>
                {isConfirmed ? (
                  <CheckCircle2 className="size-5 text-green-500 shrink-0 mt-0.5" />
                ) : isExpanded ? (
                  <ChevronUp className="size-5 text-gray-400 shrink-0 mt-0.5" />
                ) : (
                  <ChevronDown className="size-5 text-gray-400 shrink-0 mt-0.5" />
                )}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
                  <p className="text-sm text-gray-600">{ci.description}</p>

                  {ci.warning && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                      {ci.warning}
                    </div>
                  )}

                  {ci.extra && (
                    <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">{ci.extra}</p>
                  )}

                  <details className="text-sm">
                    <summary className="cursor-pointer text-blue-600 font-medium flex items-center gap-1 hover:text-blue-800">
                      <HelpCircle className="size-4" /> Why do I need this?
                    </summary>
                    <p className="mt-2 text-gray-600 pl-5">{ci.whyItMatters}</p>
                  </details>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <span className="flex items-center gap-1.5"><FileText className="size-4" />{ci.notesLabel}</span>
                    </label>
                    <Textarea
                      data-testid={`textarea-checklist-notes-${ci.key}`}
                      rows={2}
                      value={notes[ci.key] ?? dbItem?.notes ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [ci.key]: e.target.value }))}
                      placeholder="Optional notes..."
                      className="text-sm"
                    />
                  </div>

                  <div className="rounded-lg border-2 border-dashed border-gray-200 p-4 text-center">
                    <Upload className="size-5 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">{ci.uploadLabel}</p>
                    <p className="text-xs text-gray-300 mt-1">Document upload coming soon — email <a href="mailto:franchising@newdawnfranchising.com" className="underline">franchising@newdawnfranchising.com</a> to share documents.</p>
                  </div>

                  {!isConfirmed && (
                    <Button
                      data-testid={`button-checklist-confirm-${ci.key}`}
                      onClick={() => markConfirmed(ci.key)}
                      disabled={savingKey === ci.key}
                      className="w-full gap-2"
                    >
                      {savingKey === ci.key ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Mark as Complete
                    </Button>
                  )}
                  {isConfirmed && !isOverridden && (
                    <p className="text-center text-sm text-green-600 font-medium">✓ This item is confirmed</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allConfirmed && !showComplete && (
        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={() => setShowComplete(true)} className="gap-2">
            Begin Training <ChevronRight className="size-5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Module List View ─────────────────────────────────────────────────────────

function ModulesView({
  onSelectModule,
}: {
  onSelectModule: (moduleKey: string) => void;
}) {
  const { data: tracks = [], isLoading } = useQuery({
    queryKey: ["training-tracks"],
    queryFn: () => api<any[]>("/training/tracks"),
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const totalModules = tracks.reduce((acc: number, t: any) => acc + t.modules.length, 0);
  const completedModules = tracks.reduce(
    (acc: number, t: any) =>
      acc + t.modules.filter((m: any) => m.progress?.status === "completed").length,
    0
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Training Modules</h1>
        <p className="text-gray-500 text-sm mt-1">
          {completedModules} of {totalModules} modules completed
        </p>
        <Progress value={totalModules ? (completedModules / totalModules) * 100 : 0} className="mt-3 h-2" />
      </div>

      <div className="space-y-6">
        {tracks.map((track: any, trackIndex: number) => {
          const prevTrackComplete =
            trackIndex === 0 ||
            tracks[trackIndex - 1].modules.every((m: any) => m.progress?.status === "completed");
          const trackComplete = track.modules.every((m: any) => m.progress?.status === "completed");
          const trackModsDone = track.modules.filter((m: any) => m.progress?.status === "completed").length;

          return (
            <div key={track.number} className={`rounded-xl border-2 overflow-hidden ${
              !prevTrackComplete ? "border-gray-200 opacity-60" : "border-gray-200"
            }`}>
              <div className={`px-5 py-4 flex items-center justify-between ${
                trackComplete ? "bg-green-50" : prevTrackComplete ? "bg-slate-50" : "bg-gray-50"
              }`}>
                <div className="flex items-center gap-3">
                  {trackComplete ? (
                    <Award className="size-6 text-green-500" />
                  ) : !prevTrackComplete ? (
                    <Lock className="size-5 text-gray-400" />
                  ) : (
                    <BookOpen className="size-6 text-blue-500" />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Track {track.number}</p>
                    <h2 className="font-bold text-gray-900">{track.title}</h2>
                    <p className="text-xs text-gray-500">{track.subtitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">{trackModsDone}/{track.modules.length}</p>
                  <p className="text-xs text-gray-400">modules</p>
                </div>
              </div>

              {prevTrackComplete && (
                <div className="divide-y divide-gray-100">
                  {track.modules.map((mod: any, modIndex: number) => {
                    const prevModComplete =
                      modIndex === 0 ||
                      track.modules[modIndex - 1].progress?.status === "completed";
                    const isComplete = mod.progress?.status === "completed";
                    const isInProgress = mod.progress?.status === "in_progress";
                    const isLocked = !prevModComplete;

                    return (
                      <button
                        key={mod.key}
                        data-testid={`button-module-${mod.key}`}
                        onClick={() => !isLocked && onSelectModule(mod.key)}
                        disabled={isLocked}
                        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
                          isLocked
                            ? "cursor-not-allowed bg-gray-50/50"
                            : "hover:bg-blue-50/50 cursor-pointer"
                        }`}
                      >
                        <div className={`flex size-9 items-center justify-center rounded-full shrink-0 ${
                          isComplete ? "bg-green-100" : isInProgress ? "bg-blue-100" : isLocked ? "bg-gray-100" : "bg-slate-100"
                        }`}>
                          {isComplete ? (
                            <CheckCircle2 className="size-5 text-green-500" />
                          ) : isLocked ? (
                            <Lock className="size-4 text-gray-400" />
                          ) : (
                            <span className="text-sm font-bold text-gray-500">{mod.key}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${isLocked ? "text-gray-400" : "text-gray-900"}`}>
                            {mod.title}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{mod.description}</p>
                        </div>
                        {isComplete && <Badge className="bg-green-100 text-green-700 border-green-200 text-xs shrink-0">Completed</Badge>}
                        {isInProgress && <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs shrink-0">In Progress</Badge>}
                        {!isLocked && !isComplete && <ChevronRight className="size-4 text-gray-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Module Detail & Quiz View ────────────────────────────────────────────────

function ModuleDetailView({
  moduleKey,
  onBack,
  onComplete,
}: {
  moduleKey: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const qc = useQueryClient();
  const [lessonIndex, setLessonIndex] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [disclaimerAcked, setDisclaimerAcked] = useState(false);
  const [ackLoading, setAckLoading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["module", moduleKey],
    queryFn: () => api<{ module: TrainingModule; progress: any }>(`/training/module/${moduleKey}`),
  });

  const { data: disclaimerStatus } = useQuery({
    queryKey: ["disclaimer-status"],
    queryFn: () => api<{ acknowledged: string[] }>("/disclaimer/status"),
  });

  useEffect(() => {
    setLessonIndex(0);
    setShowQuiz(false);
    setQuizAnswers({});
    setQuizResult(null);
  }, [moduleKey]);

  const markProgress = useCallback(async (status: string) => {
    try {
      await api(`/training/progress/${moduleKey}`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
    } catch {}
  }, [moduleKey]);

  useEffect(() => {
    markProgress("in_progress");
  }, [markProgress]);

  const submitQuiz = async () => {
    setSubmittingQuiz(true);
    try {
      const result = await api<any>(`/training/quiz/${moduleKey}`, {
        method: "POST",
        body: JSON.stringify({ answers: quizAnswers }),
      });
      setQuizResult(result);
      if (result.passed) {
        await qc.invalidateQueries({ queryKey: ["training-tracks"] });
        await qc.invalidateQueries({ queryKey: ["module", moduleKey] });
        await qc.invalidateQueries({ queryKey: ["certificates"] });
      }
    } catch (err: any) {
      setQuizResult({ error: err.message || "Failed to submit quiz" });
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const acknowledgeDisclaimer = async (type: string) => {
    setAckLoading(true);
    try {
      await api("/disclaimer/acknowledge", {
        method: "POST",
        body: JSON.stringify({ disclaimerType: type }),
      });
      await qc.invalidateQueries({ queryKey: ["disclaimer-status"] });
      setDisclaimerAcked(true);
    } catch {}
    setAckLoading(false);
  };

  if (isLoading) return (
    <div className="flex h-96 items-center justify-center">
      <Loader2 className="size-8 animate-spin text-blue-500" />
    </div>
  );

  if (error || !data) {
    const err = error as any;
    if (err?.error === "module_locked" || err?.error === "track_locked") {
      return (
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <Lock className="size-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Module Locked</h2>
          <p className="text-gray-500 mb-6">Complete the previous modules to unlock this one.</p>
          <Button variant="outline" onClick={onBack}><ChevronLeft className="size-4 mr-1" /> Back to Modules</Button>
        </div>
      );
    }
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="size-12 text-red-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">Failed to load module.</p>
        <Button variant="outline" onClick={onBack}><ChevronLeft className="size-4 mr-1" /> Back</Button>
      </div>
    );
  }

  const { module, progress } = data;
  const requiresAck = module.requiresDisclaimerAck;
  const hasAcked = disclaimerStatus?.acknowledged?.includes(requiresAck ?? "") ?? false;
  const alreadyPassed = progress?.status === "completed";

  // Check if disclaimer acknowledgement is needed before showing content
  if (requiresAck && !hasAcked && !disclaimerAcked) {
    const disclaimerTexts: Record<string, { title: string; text: string }> = {
      e2_visa_module: {
        title: "Important: General Business Education Only",
        text: "New Dawn Franchising and its franchisees are not immigration attorneys and cannot provide immigration legal advice. Nothing in this training constitutes legal advice. The information in this module is provided for general business education purposes only. For all questions about your E-2 visa application, renewal, consulate interview, eligibility, or any immigration legal matter, you must consult a qualified licensed immigration attorney.",
      },
      compliance_acknowledgement: {
        title: "Compliance Acknowledgement",
        text: "I understand that as a New Dawn Franchising franchisee I am not an immigration attorney, real estate attorney, or legal professional of any kind. I will not provide immigration legal advice, visa application guidance, eviction legal strategy, or any legal interpretation to homeowners, tenants, or any other party. I will always direct parties to a qualified licensed attorney for any legal questions. I understand that failure to comply may result in termination of my franchise agreement.",
      },
    };
    const dt = disclaimerTexts[requiresAck] ?? {
      title: "Acknowledgement Required",
      text: "Please read and acknowledge before proceeding.",
    };

    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-6 gap-1">
          <ChevronLeft className="size-4" /> Back
        </Button>
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6">
          <AlertTriangle className="size-8 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-3">{dt.title}</h2>
          <p className="text-gray-700 text-sm leading-relaxed mb-6">{dt.text}</p>
          <Button
            onClick={() => acknowledgeDisclaimer(requiresAck)}
            disabled={ackLoading}
            className="w-full gap-2"
          >
            {ackLoading && <Loader2 className="size-4 animate-spin" />}
            I understand and agree — Continue to Module
          </Button>
        </div>
      </div>
    );
  }

  const currentLesson = module.lessons[lessonIndex];
  const isLastLesson = lessonIndex === module.lessons.length - 1;
  const progress_pct = Math.round(((lessonIndex + 1) / module.lessons.length) * 100);

  if (showQuiz) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="sm" onClick={() => setShowQuiz(false)} className="gap-1">
            <ChevronLeft className="size-4" /> Lessons
          </Button>
          <div className="flex-1 text-center">
            <h2 className="font-bold text-gray-900">{module.title} — Quiz</h2>
            <p className="text-xs text-gray-400">{module.passMark}% to pass</p>
          </div>
        </div>

        {quizResult ? (
          <div className={`rounded-xl border-2 p-6 text-center ${quizResult.passed ? "border-green-200 bg-green-50" : quizResult.error ? "border-red-200 bg-red-50" : "border-orange-200 bg-orange-50"}`}>
            {quizResult.error ? (
              <>
                <AlertCircle className="size-8 text-red-400 mx-auto mb-3" />
                <p className="text-red-700 font-medium">{quizResult.error}</p>
              </>
            ) : quizResult.passed ? (
              <>
                <Trophy className="size-12 text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-green-800 mb-1">
                  {quizResult.alreadyPassed ? "Already Passed!" : "Excellent! You passed!"}
                </h3>
                <p className="text-green-700 mb-4">Score: {quizResult.score}%</p>
                <Button onClick={onComplete} className="gap-2">
                  Continue <ChevronRight className="size-4" />
                </Button>
              </>
            ) : (
              <>
                <AlertCircle className="size-8 text-orange-400 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-orange-800 mb-1">Not Quite</h3>
                <p className="text-orange-700 mb-1">Score: {quizResult.score}% (need {quizResult.passMark}%)</p>
                <p className="text-sm text-orange-600 mb-4">You got {quizResult.correct} of {quizResult.total} correct. Review the lessons and try again in 10 minutes.</p>
                <Button
                  variant="outline"
                  onClick={() => { setQuizResult(null); setQuizAnswers({}); }}
                >
                  Review & Retry
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {module.quiz.map((q, qi) => (
              <div key={q.id} className="rounded-xl border bg-white p-5">
                <p className="font-medium text-gray-900 mb-3">
                  <span className="text-xs font-semibold text-gray-400 mr-2">Q{qi + 1}.</span>
                  {q.question}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      data-testid={`button-quiz-option-${q.id}-${oi}`}
                      onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                      className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm border-2 transition-colors ${
                        quizAnswers[q.id] === oi
                          ? "border-blue-500 bg-blue-50 text-blue-900"
                          : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/30"
                      }`}
                    >
                      <span className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        quizAnswers[q.id] === oi ? "border-blue-500 bg-blue-500" : "border-gray-300"
                      }`}>
                        {quizAnswers[q.id] === oi && <span className="size-2 rounded-full bg-white" />}
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <Button
              data-testid="button-submit-quiz"
              onClick={submitQuiz}
              disabled={
                submittingQuiz ||
                Object.keys(quizAnswers).length < module.quiz.length
              }
              className="w-full h-12 gap-2"
            >
              {submittingQuiz && <Loader2 className="size-4 animate-spin" />}
              Submit Quiz ({Object.keys(quizAnswers).length}/{module.quiz.length} answered)
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Module header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 shrink-0">
          <ChevronLeft className="size-4" /> Modules
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">Module {module.key}</p>
          <h1 className="font-bold text-gray-900 text-lg leading-tight">{module.title}</h1>
        </div>
        {alreadyPassed && <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0">Completed</Badge>}
      </div>

      {/* Progress bar through lessons */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
          <span>Lesson {lessonIndex + 1} of {module.lessons.length}</span>
          <span>{progress_pct}%</span>
        </div>
        <Progress value={progress_pct} className="h-1.5" />
      </div>

      {/* Disclaimer banner for tracks 2 & 6 */}
      {(module.key.startsWith("2.") || module.key.startsWith("6.")) && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 mb-5">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          You are not an immigration attorney or legal professional. Always refer immigration and legal questions to a qualified licensed attorney.
        </div>
      )}

      {/* Lesson content */}
      <div className="rounded-xl border bg-white p-6 mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{currentLesson.title}</h2>

        {currentLesson.disclaimer && (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-700 mb-4">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            {currentLesson.disclaimer}
          </div>
        )}

        <div className="prose prose-sm max-w-none text-gray-700">
          {currentLesson.content.split("\n").map((line, i) => {
            if (!line.trim()) return <br key={i} />;
            const isBullet = line.startsWith("•") || line.startsWith("-");
            const isNumbered = /^\d+\./.test(line);
            if (isBullet) return <p key={i} className="ml-4 text-sm">{line}</p>;
            if (isNumbered) return <p key={i} className="ml-4 text-sm font-medium">{line}</p>;
            if (line.endsWith(":") || (line.startsWith("**") && line.endsWith("**"))) {
              return <p key={i} className="font-semibold text-gray-900 mt-3 text-sm">{line.replace(/\*\*/g, "")}</p>;
            }
            return <p key={i} className="text-sm leading-relaxed">{line}</p>;
          })}
        </div>
      </div>

      {/* Resources */}
      {module.resources.length > 0 && lessonIndex === 0 && (
        <div className="rounded-xl border bg-slate-50 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="size-4" /> Resources
          </h3>
          <div className="space-y-2">
            {module.resources.map((r, ri) => (
              <div key={ri} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                <FileText className="size-4 shrink-0" />
                <span className="font-medium">{r.title}</span>
                <span className="text-gray-400 text-xs">— {r.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => setLessonIndex((i) => Math.max(0, i - 1))}
          disabled={lessonIndex === 0}
          className="gap-1"
        >
          <ChevronLeft className="size-4" /> Previous
        </Button>

        {isLastLesson ? (
          <Button
            data-testid="button-start-quiz"
            onClick={() => setShowQuiz(true)}
            className="flex-1 gap-2"
          >
            {alreadyPassed ? "Review Quiz" : "Take Quiz"} <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            data-testid="button-next-lesson"
            onClick={() => setLessonIndex((i) => i + 1)}
            className="flex-1 gap-2"
          >
            Next Lesson <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────────────────

function DashboardView({
  franchisee,
  onNavigate,
}: {
  franchisee: Franchisee;
  onNavigate: (v: View, extra?: string) => void;
}) {
  const { data: tracks = [] } = useQuery({
    queryKey: ["training-tracks"],
    queryFn: () => api<any[]>("/training/tracks"),
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => api<any[]>("/certificates"),
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api<any[]>("/announcements"),
  });

  const totalModules = tracks.reduce((a: number, t: any) => a + t.modules.length, 0);
  const completedModules = tracks.reduce(
    (a: number, t: any) => a + t.modules.filter((m: any) => m.progress?.status === "completed").length,
    0
  );
  const overallPct = totalModules ? Math.round((completedModules / totalModules) * 100) : 0;

  // Find next module to work on
  let nextModule: { trackTitle: string; module: any } | null = null;
  for (const track of tracks) {
    for (const mod of track.modules) {
      if (mod.progress?.status !== "completed") {
        nextModule = { trackTitle: track.title, module: mod };
        break;
      }
    }
    if (nextModule) break;
  }

  const urgentAnnouncements = Array.isArray(announcements)
    ? announcements.filter((a: any) => a.isUrgent)
    : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 text-white p-6 mb-6">
        <p className="text-blue-100 text-sm mb-1">Welcome back,</p>
        <h1 className="text-2xl font-bold">{franchisee.firstName} {franchisee.lastName}</h1>
        {franchisee.territory && (
          <p className="text-blue-200 text-sm mt-1">{franchisee.territory}</p>
        )}
      </div>

      {/* Urgent announcements */}
      {urgentAnnouncements.length > 0 && (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="size-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Action Required</span>
          </div>
          {urgentAnnouncements.map((a: any) => (
            <div key={a.id} className="text-sm text-amber-800">
              <span className="font-medium">{a.title}</span>: {a.body.substring(0, 100)}
            </div>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Modules Done", value: `${completedModules}/${totalModules}`, icon: "📚" },
          { label: "Certificates", value: certificates.length, icon: "🏆" },
          { label: "Tracks Completed", value: certificates.filter((c: any) => c.type.startsWith("track_")).length, icon: "✅" },
          { label: "Overall Progress", value: `${overallPct}%`, icon: "📈" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-white p-4 text-center">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className="text-xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="rounded-xl border bg-white p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Overall Progress</h2>
          <span className="text-lg font-bold text-blue-600">{overallPct}%</span>
        </div>
        <Progress value={overallPct} className="h-3 mb-2" />
        <p className="text-xs text-gray-400">{completedModules} of {totalModules} modules completed</p>
      </div>

      {/* Next step */}
      {nextModule ? (
        <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-5 mb-6">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Up Next</p>
          <h3 className="font-bold text-gray-900">{nextModule.module.title}</h3>
          <p className="text-sm text-gray-500 mb-4">{nextModule.trackTitle} — Module {nextModule.module.key}</p>
          <Button onClick={() => onNavigate("module-detail", nextModule!.module.key)} className="gap-2">
            Continue <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5 mb-6 text-center">
          <Trophy className="size-8 text-green-500 mx-auto mb-2" />
          <p className="font-bold text-green-800 text-lg">All Training Complete!</p>
          <p className="text-sm text-green-600">Congratulations — you've completed all training modules.</p>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate("modules")}
          className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
        >
          <BookOpen className="size-6 text-blue-500" />
          <div>
            <p className="font-semibold text-sm text-gray-900">All Modules</p>
            <p className="text-xs text-gray-400">View training roadmap</p>
          </div>
        </button>
        <button
          onClick={() => onNavigate("certificates")}
          className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
        >
          <Award className="size-6 text-yellow-500" />
          <div>
            <p className="font-semibold text-sm text-gray-900">My Certificates</p>
            <p className="text-xs text-gray-400">{certificates.length} earned</p>
          </div>
        </button>
        <a
          href="/marketing-portal"
          className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
        >
          <span className="text-2xl">📣</span>
          <div>
            <p className="font-semibold text-sm text-gray-900">Marketing Portal</p>
            <p className="text-xs text-gray-400">Manage your leads</p>
          </div>
        </a>
        <button
          onClick={() => onNavigate("checklist")}
          className="flex items-center gap-3 rounded-xl border bg-white p-4 text-left hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
        >
          <CheckCircle2 className="size-6 text-green-500" />
          <div>
            <p className="font-semibold text-sm text-gray-900">My Business Setup</p>
            <p className="text-xs text-gray-400">View & update checklist docs</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Certificates View ────────────────────────────────────────────────────────

function CertificatesView({ franchisee }: { franchisee: Franchisee }) {
  const { data: certs = [] } = useQuery({
    queryKey: ["certificates"],
    queryFn: () => api<any[]>("/certificates"),
  });

  const certLabels: Record<string, { title: string; desc: string }> = {
    track_1: { title: "Welcome & Foundations", desc: "Track 1 Completion Certificate" },
    track_2: { title: "The Property Management Business", desc: "Track 2 Completion Certificate" },
    track_3: { title: "Finding & Winning Homeowner Clients", desc: "Track 3 Completion Certificate" },
    track_4: { title: "Managing Properties & Tenants", desc: "Track 4 Completion Certificate" },
    track_5: { title: "Marketing Your Business", desc: "Track 5 Completion Certificate" },
    track_6: { title: "Compliance, Legal & Professional Standards", desc: "Track 6 Completion Certificate" },
    final: { title: "Certified NDF Property Manager", desc: "Full Program Completion Certificate" },
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Certificates</h1>
      {certs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Award className="size-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Complete training modules to earn certificates.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {certs.map((cert: any) => {
            const info = certLabels[cert.type] ?? { title: cert.type, desc: "Certificate" };
            return (
              <div key={cert.id} data-testid={`card-cert-${cert.type}`} className="rounded-xl border-2 border-yellow-200 bg-yellow-50 p-5 flex items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-yellow-100">
                  <Trophy className="size-6 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{info.title}</p>
                  <p className="text-sm text-gray-500">{info.desc}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Issued: {new Date(cert.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                  <p className="text-xs text-blue-600 mt-1 font-mono">
                    Verification ID: {cert.verificationId}
                  </p>
                  <a
                    href={`/verify/${cert.verificationId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 underline mt-1 inline-block hover:text-blue-800"
                  >
                    View public verification page →
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Portal Shell ─────────────────────────────────────────────────────────────

function PortalShell({
  franchisee,
  view,
  onNavigate,
  onLogout,
  isDemoMode,
  children,
}: {
  franchisee: Franchisee;
  view: View;
  onNavigate: (v: View, extra?: string) => void;
  onLogout: () => void;
  isDemoMode?: boolean;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "checklist", label: "My Setup", icon: CheckCircle2 },
    { id: "modules", label: "Training", icon: BookOpen },
    { id: "certificates", label: "Certificates", icon: Award },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Demo banner */}
      {isDemoMode && (
        <div className="bg-violet-600 text-white px-4 py-2 text-center text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0">
          <FlaskConical className="size-3.5 shrink-0" />
          <span><strong>Demo Mode</strong> — You're exploring with sample data. Nothing you do here will be saved.</span>
        </div>
      )}
      {/* Top bar */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/">
              <img src={logo} alt="NDF" className="h-10 w-auto" />
            </a>
            <div className="hidden sm:block w-px h-5 bg-gray-200" />
            <span className="hidden sm:block text-sm font-semibold text-gray-600">Training Portal</span>
          </div>
          <div className="flex items-center gap-2">
            {isDemoMode && (
              <span className="hidden sm:flex items-center gap-1.5 bg-violet-100 text-violet-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                <FlaskConical className="size-3" /> Demo
              </span>
            )}
            <span className="hidden sm:block text-sm text-gray-500">{franchisee.firstName} {franchisee.lastName}</span>
            <Button variant="ghost" size="sm" onClick={onLogout} className={`gap-1.5 ${isDemoMode ? "text-violet-600 hover:text-violet-800" : "text-gray-500 hover:text-red-600"}`}>
              <LogOut className="size-4" /> {isDemoMode ? "Exit Demo" : "Sign out"}
            </Button>
            <button
              className="sm:hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        {mobileMenuOpen && (
          <div className="border-t bg-white p-4 sm:hidden">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { onNavigate(item.id as View); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    view === item.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-1">
        {/* Sidebar nav (desktop) */}
        <nav className="hidden sm:flex w-52 flex-col border-r bg-white p-3 sticky top-14 h-[calc(100vh-56px)]">
          {navItems.map((item) => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => onNavigate(item.id as View)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mb-0.5 ${
                view === item.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
          <div className="mt-auto pt-4 border-t">
            <a
              href="/marketing-portal"
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            >
              <span>📣</span>
              <span className="text-sm">Marketing Portal</span>
            </a>
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

// ─── Main Portal Page ─────────────────────────────────────────────────────────

export default function TrainingPortal() {
  const [franchisee, setFranchisee] = useState<Franchisee | null>(null);
  const [view, setView] = useState<View>("login");
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Check existing session on mount
  useEffect(() => {
    api<Franchisee>("/me")
      .then((f) => {
        setFranchisee(f);
        setView(f.checklistComplete ? "dashboard" : "checklist");
      })
      .catch(() => setView("login"))
      .finally(() => setAuthChecked(true));
  }, []);

  const handleLogin = (f: Franchisee) => {
    setFranchisee(f);
    setView(f.checklistComplete ? "dashboard" : "checklist");
  };

  const handleDemoLogin = () => {
    enableDemoMode();
    setIsDemoMode(true);
    setFranchisee(DEMO_FRANCHISEE);
    setView("dashboard");
  };

  const handleLogout = async () => {
    if (isDemoMode) {
      disableDemoMode();
      setIsDemoMode(false);
    } else {
      await api("/logout", { method: "POST" }).catch(() => {});
    }
    setFranchisee(null);
    setView("login");
  };

  const navigateTo = (v: View, extra?: string) => {
    setView(v);
    if (v === "module-detail" && extra) {
      setSelectedModule(extra);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (view === "login" || !franchisee) {
    return <LoginView onLogin={handleLogin} onDemoLogin={handleDemoLogin} />;
  }

  let content: React.ReactNode;
  switch (view) {
    case "checklist":
      content = (
        <ChecklistView
          franchisee={franchisee}
          onComplete={() => {
            setFranchisee({ ...franchisee, checklistComplete: true });
            setView("dashboard");
          }}
        />
      );
      break;
    case "dashboard":
      content = <DashboardView franchisee={franchisee} onNavigate={navigateTo} />;
      break;
    case "modules":
      content = <ModulesView onSelectModule={(key) => navigateTo("module-detail", key)} />;
      break;
    case "module-detail":
      content = (
        <ModuleDetailView
          moduleKey={selectedModule!}
          onBack={() => setView("modules")}
          onComplete={() => setView("modules")}
        />
      );
      break;
    case "certificates":
      content = <CertificatesView franchisee={franchisee} />;
      break;
    default:
      content = <DashboardView franchisee={franchisee} onNavigate={navigateTo} />;
  }

  return (
    <PortalShell
      franchisee={franchisee}
      view={view}
      onNavigate={navigateTo}
      onLogout={handleLogout}
      isDemoMode={isDemoMode}
    >
      {content}
    </PortalShell>
  );
}
