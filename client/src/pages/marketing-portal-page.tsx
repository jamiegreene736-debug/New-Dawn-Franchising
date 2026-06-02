import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, GitMerge, Users, Send, Mail, BarChart2, Settings,
  Lock, GraduationCap, LogOut, Loader2, Menu, X, ChevronLeft, ChevronRight, TrendingUp,
  BookOpen, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@assets/Gemini_Generated_Image_t1u2o5t1u2o5t1u2_1771946732580.png";
import { MpOverview } from "./mp-overview";
import { MpPipeline } from "./mp-pipeline";
import { MpReports } from "./mp-reports";
import { MpPaidMarketing } from "./mp-paid-marketing";
import { MpPlaybook } from "./mp-playbook";
import { MpBlogsForums } from "./mp-blogs-forums";

async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api/franchisee${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data as T;
}

export type MarketingView = "overview" | "playbook" | "pipeline" | "leads" | "outreach" | "letters" | "reports" | "paid" | "blogs-forums" | "settings";

// ─── Nav config ───────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: MarketingView; label: string; icon: React.ElementType }[] = [
  { id: "overview",     label: "Overview",       icon: LayoutDashboard },
  { id: "playbook",     label: "Playbook",       icon: BookOpen        },
  { id: "pipeline",     label: "Pipeline",       icon: GitMerge        },
  { id: "leads",        label: "Leads",          icon: Users           },
  { id: "outreach",     label: "Outreach",       icon: Send            },
  { id: "letters",      label: "Letters",        icon: Mail            },
  { id: "reports",      label: "Reports",        icon: BarChart2       },
  { id: "paid",         label: "Paid Marketing", icon: TrendingUp      },
  { id: "blogs-forums", label: "Blogs & Forums", icon: Globe           },
  { id: "settings",     label: "Settings",       icon: Settings        },
];

// ─── Locked State ─────────────────────────────────────────────────────────────

function LockedState({ checklistComplete, track1Complete }: { checklistComplete: boolean; track1Complete: boolean }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4">
        <a href="/"><img src={logo} alt="New Dawn Franchising" className="h-12 w-auto" /></a>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center size-20 rounded-full bg-slate-100 mb-6">
            <Lock className="size-10 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Marketing Academy Locked</h1>
          <p className="text-gray-500 mb-8">Complete your Launch Checklist and Welcome &amp; Foundations training to unlock your Marketing Academy.</p>
          <div className="space-y-4 text-left mb-8">
            {[
              { done: checklistComplete, label: "Launch Checklist",              sub: "All 7 business setup items confirmed",           n: "1" },
              { done: track1Complete,    label: "Track 1: Welcome & Foundations", sub: "Complete the first training track (3 modules)", n: "2" },
            ].map(({ done, label, sub, n }) => (
              <div key={n} className={`flex items-center gap-3 rounded-xl p-4 border-2 ${done ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
                <div className={`size-8 rounded-full flex items-center justify-center font-bold text-sm ${done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                  {done ? "✓" : n}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${done ? "text-green-800" : "text-gray-700"}`}>{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
              </div>
            ))}
          </div>
          <Button asChild className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <a href="/training"><GraduationCap className="size-4" /> Go to Training Academy</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Stub view ────────────────────────────────────────────────────────────────

function StubView({ title, icon: Icon, description }: { title: string; icon: React.ElementType; description: string }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-indigo-50 mb-4">
        <Icon className="size-8 text-indigo-400" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
      <p className="text-gray-500">{description}</p>
      <p className="text-sm text-indigo-500 mt-4 font-medium">Full functionality launching in the next update.</p>
    </div>
  );
}

// ─── Portal Shell ─────────────────────────────────────────────────────────────

function MarketingShell({
  franchisee, view, onNavigate, onLogout, children,
}: {
  franchisee: any; view: MarketingView; onNavigate: (v: MarketingView) => void;
  onLogout: () => void; children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b sticky top-0 z-30 h-14 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <button className="sm:hidden rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <a href="/"><img src={logo} alt="NDF" className="h-9 w-auto" /></a>
          <div className="hidden sm:block w-px h-5 bg-gray-200" />
          <span className="hidden sm:block text-sm font-semibold text-gray-500">Marketing Academy</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/training" className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors">
            <GraduationCap className="size-4" /> Training
          </a>
          <span className="hidden sm:block text-sm text-gray-500">{franchisee.firstName}</span>
          <Button variant="ghost" size="sm" onClick={onLogout} className="gap-1.5 text-gray-500 hover:text-red-600 text-xs">
            <LogOut className="size-4" /><span className="hidden sm:block">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setMobileOpen(false)}>
            <div className="absolute inset-0 bg-black/40" />
          </div>
        )}

        {/* Sidebar */}
        <nav className={`
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} sm:translate-x-0
          fixed sm:sticky top-14 z-50 sm:z-auto
          h-[calc(100vh-56px)]
          flex flex-col bg-white border-r transition-all duration-200 shrink-0
          ${collapsed ? "w-14" : "w-52"}
        `}>
          <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map(item => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  data-testid={`marketing-nav-${item.id}`}
                  onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                  title={collapsed ? item.label : undefined}
                  className={`
                    w-full flex items-center gap-2.5 rounded-lg py-2.5 text-sm font-medium transition-all
                    ${collapsed ? "px-2.5 justify-center" : "px-2.5"}
                    ${active
                      ? "border-l-[3px] border-indigo-600 bg-indigo-50 text-indigo-700 pl-[7px]"
                      : "border-l-[3px] border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"}
                  `}
                >
                  <item.icon className={`size-4 shrink-0 ${active ? "text-indigo-600" : "text-gray-400"}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
          {/* Collapse toggle (desktop only) */}
          <div className="hidden sm:flex border-t p-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="size-4" /> : <><ChevronLeft className="size-4" /><span>Collapse</span></>}
            </button>
          </div>
        </nav>

        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

// ─── Main Marketing Academy ────────────────────────────────────────────────────

export default function MarketingPortalPage() {
  const [franchisee, setFranchisee] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [view, setView] = useState<MarketingView>("overview");

  useEffect(() => {
    api<any>("/me")
      .then(f => setFranchisee(f))
      .catch(() => setFranchisee(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const { data: tracks = [] } = useQuery({
    queryKey: ["marketing-tracks"],
    queryFn: () => api<any[]>("/training/tracks"),
    enabled: !!franchisee?.checklistComplete,
  });

  const handleLogout = async () => {
    await api("/logout", { method: "POST" }).catch(() => {});
    setFranchisee(null);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!franchisee) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col">
        <header className="bg-white border-b px-6 py-4">
          <a href="/"><img src={logo} alt="New Dawn Franchising" className="h-12 w-auto" /></a>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-sm text-center">
            <div className="text-5xl mb-4">📣</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Franchisee Marketing Academy</h1>
            <p className="text-gray-500 mb-6">Sign in with your franchisee account to access your marketing tools.</p>
            <Button asChild className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <a href="/training"><GraduationCap className="size-4" /> Sign in via Training Academy</a>
            </Button>
            <p className="text-xs text-gray-400 mt-4">Same email and password as your Training Academy.</p>
          </div>
        </div>
      </div>
    );
  }

  const track1Keys = ["1.1", "1.2", "1.3"];
  const track1Complete = track1Keys.every(key =>
    (tracks as any[]).some((t: any) => t.modules.some((m: any) => m.key === key && m.progress?.status === "completed"))
  );

  if (!franchisee.checklistComplete || (!track1Complete && tracks.length > 0)) {
    return <LockedState checklistComplete={franchisee.checklistComplete} track1Complete={track1Complete} />;
  }

  const navigate = (v: string) => setView(v as MarketingView);

  const viewContent: Record<MarketingView, React.ReactNode> = {
    overview:      <MpOverview franchisee={franchisee} onNavigate={navigate} />,
    playbook:      <MpPlaybook onNavigate={navigate} />,
    pipeline:      <MpPipeline />,
    leads:         <StubView title="Leads" icon={Users} description="Full lead discovery, individual lead records, and scoring details. Coming in the next update." />,
    outreach:      <StubView title="Outreach" icon={Send} description="Today's staged messages, sent log, email sequences, and daily brief management." />,
    letters:       <StubView title="Physical Mail" icon={Mail} description="Physical letter recommendations for high-scoring leads (80+). Review and approve letters here." />,
    reports:       <MpReports />,
    paid:          <MpPaidMarketing />,
    "blogs-forums": <MpBlogsForums />,
    settings:      <StubView title="Settings" icon={Settings} description="Voice profile, Calendly link, notification preferences, and agent configuration." />,
  };

  return (
    <MarketingShell franchisee={franchisee} view={view} onNavigate={v => setView(v)} onLogout={handleLogout}>
      {viewContent[view]}
    </MarketingShell>
  );
}
