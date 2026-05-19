import { useState } from "react";
import {
  TrendingUp, Plus, Edit2, Check, X, MoreVertical, Bookmark,
  AlertTriangle, Lightbulb, PauseCircle, BarChart2, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Mock Data ────────────────────────────────────────────────────────────────

type Campaign = {
  id: number;
  platform: "facebook" | "google";
  name: string;
  status: "Active" | "Paused";
  dailyBudget: number;
  spentThisMonth: number;
  leads: number;
  cpl: number | null;
};

const INITIAL_CAMPAIGNS: Campaign[] = [
  { id: 1, platform: "facebook", name: "Franchise Lead Gen — Lookalike Audience", status: "Active",  dailyBudget: 75,  spentThisMonth: 2180, leads: 47, cpl: 46.38  },
  { id: 2, platform: "facebook", name: "Retargeting — Website Visitors",          status: "Active",  dailyBudget: 25,  spentThisMonth: 640,  leads: 11, cpl: 58.18  },
  { id: 3, platform: "google",   name: "Franchise Opportunity — Search",           status: "Active",  dailyBudget: 100, spentThisMonth: 2950, leads: 28, cpl: 105.36 },
  { id: 4, platform: "google",   name: "Brand Keywords",                           status: "Paused",  dailyBudget: 30,  spentThisMonth: 0,    leads: 0,  cpl: null   },
];

type Listing = {
  id: number;
  name: string;
  type: string;
  model: string;
  cost: string;
  leadsPerMonth: string;
  fit: "High" | "Medium";
  description: string;
  cta: string;
};

const LISTINGS: Listing[] = [
  { id: 1, name: "FranChoice",                  type: "Franchise Consultant Network",       model: "Referral-based",        cost: "$0 upfront / % of franchise fee on close", leadsPerMonth: "3–8 highly qualified", fit: "High",   description: "Connects you with pre-screened candidates through a national network of franchise consultants.",                         cta: "Request Info"   },
  { id: 2, name: "Franchise.com",               type: "Franchise Directory Listing",        model: "Monthly subscription",  cost: "$299–$499/mo",                             leadsPerMonth: "10–20 leads",          fit: "High",   description: "One of the largest franchise opportunity directories with high organic search traffic.",                                   cta: "Get Started"    },
  { id: 3, name: "Entrepreneur.com Franchise 500", type: "Editorial + Directory",           model: "Annual listing fee",    cost: "$1,200–$2,500/yr",                         leadsPerMonth: "5–12 leads",           fit: "High",   description: "Feature your franchise in the annual Franchise 500 ranking and year-round directory.",                                    cta: "Learn More"     },
  { id: 4, name: "BizBuySell",                  type: "Business Opportunity Marketplace",   model: "Monthly listing",       cost: "$99–$199/mo",                              leadsPerMonth: "6–14 leads",           fit: "Medium", description: "Large marketplace for buyers exploring business ownership, including franchise opportunities.",                           cta: "Get Started"    },
  { id: 5, name: "FranConnect",                 type: "Franchise Development Platform",     model: "Platform subscription", cost: "Custom pricing",                           leadsPerMonth: "8–18 leads",           fit: "Medium", description: "End-to-end franchise development and lead management platform used by growing brands.",                                  cta: "Request Demo"   },
  { id: 6, name: "Franchise Gator",             type: "Franchise Lead Generation",          model: "Pay per lead",          cost: "$25–$60/lead",                             leadsPerMonth: "15–30 leads",          fit: "Medium", description: "Performance-based lead generation platform where you only pay for the leads you receive.",                                cta: "Get Started"    },
];

type Recommendation = {
  id: number;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  body: string;
  primaryBtn: string;
};

const RECOMMENDATIONS: Recommendation[] = [
  { id: 1, icon: AlertTriangle, iconColor: "text-yellow-500", title: "Reduce Google CPL",            primaryBtn: "Apply Suggestion",    body: "Your Google Search CPL ($105) is 2.3× higher than your Facebook CPL ($46). Consider shifting $400/mo from Google to Facebook or testing a new Google ad group with tighter keyword targeting."                                                                                                 },
  { id: 2, icon: Lightbulb,     iconColor: "text-violet-500", title: "Untapped Listing Opportunity", primaryBtn: "Explore Platforms",   body: "You're not currently listed on Franchise.com or Franchise Gator. Based on your target CPL of under $60, both platforms offer estimated CPLs within your range. Adding these two channels could generate an estimated 25–50 additional leads per month." },
  { id: 3, icon: PauseCircle,   iconColor: "text-orange-500", title: "Paused Campaign Alert",        primaryBtn: "Reactivate Campaign", body: "Your Brand Keywords Google campaign has been paused for 12 days. Brand keyword protection is typically low-cost and high-converting. Consider reactivating with a modest $15/day budget."                                                                                              },
  { id: 4, icon: BarChart2,     iconColor: "text-green-500",  title: "Monthly Budget Pacing",        primaryBtn: "Boost Campaign",      body: "You are on pace to spend $5,820 this month across all campaigns. This is 94% of your $6,200 monthly budget. You have $380 remaining — consider boosting your top-performing Facebook campaign for the final week of the month."                                              },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function PlatformBadge({ platform }: { platform: "facebook" | "google" }) {
  return platform === "facebook" ? (
    <span className="inline-flex items-center justify-center size-8 rounded-lg bg-blue-600 text-white font-bold text-sm select-none">f</span>
  ) : (
    <span className="inline-flex items-center justify-center size-8 rounded-lg bg-white border border-gray-200 font-bold text-sm select-none">
      <span className="text-blue-500">G</span>
    </span>
  );
}

function StatusPill({ status, onClick }: { status: "Active" | "Paused"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer
        ${status === "Active" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
    >
      <span className={`size-1.5 rounded-full ${status === "Active" ? "bg-green-500" : "bg-gray-400"}`} />
      {status}
    </button>
  );
}

function ListingAvatar({ name }: { name: string }) {
  const colors = ["bg-blue-100 text-blue-700", "bg-violet-100 text-violet-700", "bg-green-100 text-green-700", "bg-orange-100 text-orange-700", "bg-pink-100 text-pink-700", "bg-teal-100 text-teal-700"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <span className={`inline-flex items-center justify-center size-10 rounded-xl font-bold text-lg ${colors[idx]}`}>
      {name[0]}
    </span>
  );
}

// ─── Campaign Row ─────────────────────────────────────────────────────────────

function CampaignRow({ c, onToggleStatus, onUpdateBudget }: {
  c: Campaign;
  onToggleStatus: (id: number) => void;
  onUpdateBudget: (id: number, v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(c.dailyBudget));
  const [menuOpen, setMenuOpen] = useState(false);

  const save = () => {
    const v = parseFloat(draft);
    if (!isNaN(v) && v > 0) onUpdateBudget(c.id, v);
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <PlatformBadge platform={c.platform} />
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{c.name}</p>
          <p className="text-xs text-gray-400 capitalize">{c.platform} Ads</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusPill status={c.status} onClick={() => onToggleStatus(c.id)} />

        <div className="flex items-center gap-1">
          {editing ? (
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-xs">$</span>
              <input
                className="w-16 border border-blue-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === "Enter" && save()}
                autoFocus
              />
              <button onClick={save} className="text-green-600 hover:text-green-700"><Check className="size-3.5" /></button>
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X className="size-3.5" /></button>
            </div>
          ) : (
            <span className="text-gray-600 text-xs flex items-center gap-1">
              ${c.dailyBudget}/day
              <button onClick={() => { setDraft(String(c.dailyBudget)); setEditing(true); }} className="text-gray-400 hover:text-blue-500 transition-colors">
                <Edit2 className="size-3" />
              </button>
            </span>
          )}
        </div>

        <span className="text-gray-600 text-xs">{fmt(c.spentThisMonth)} spent</span>
        <span className="text-gray-600 text-xs">{c.leads} leads</span>
        <span className="text-gray-600 text-xs">{c.cpl !== null ? `$${c.cpl.toFixed(2)} CPL` : "N/A CPL"}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" className="text-xs h-7">View Details</Button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <MoreVertical className="size-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 text-sm">
              {["Edit", "Duplicate", c.status === "Active" ? "Pause" : "Resume", "Delete"].map(action => (
                <button
                  key={action}
                  onClick={() => { if (action === "Pause" || action === "Resume") onToggleStatus(c.id); setMenuOpen(false); }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${action === "Delete" ? "text-red-500" : "text-gray-700"}`}
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MpPaidMarketing() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [filter, setFilter] = useState<"All" | "Facebook" | "Google" | "Active" | "Paused">("All");
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const toggleStatus = (id: number) =>
    setCampaigns(cs => cs.map(c => c.id === id ? { ...c, status: c.status === "Active" ? "Paused" : "Active" } : c));

  const updateBudget = (id: number, v: number) =>
    setCampaigns(cs => cs.map(c => c.id === id ? { ...c, dailyBudget: v } : c));

  const toggleSaved = (id: number) =>
    setSaved(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const dismiss = (id: number) =>
    setDismissed(s => new Set([...Array.from(s), id]));

  const FILTER_BTNS = ["All", "Facebook", "Google", "Active", "Paused"] as const;

  const filtered = campaigns.filter(c => {
    if (filter === "All")      return true;
    if (filter === "Facebook") return c.platform === "facebook";
    if (filter === "Google")   return c.platform === "google";
    if (filter === "Active")   return c.status === "Active";
    if (filter === "Paused")   return c.status === "Paused";
    return true;
  });

  const activeCampaigns = campaigns.filter(c => c.status === "Active");
  const totalSpend      = campaigns.reduce((a, c) => a + c.spentThisMonth, 0);
  const totalLeads      = campaigns.reduce((a, c) => a + c.leads, 0);
  const blendedCpl      = totalLeads > 0 ? totalSpend / totalLeads : 0;

  const visibleRecs = RECOMMENDATIONS.filter(r => !dismissed.has(r.id));

  return (
    <div className="min-h-full bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paid Marketing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your campaigns and discover new growth channels</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2 self-start sm:self-auto">
          <Plus className="size-4" /> Add Campaign
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Monthly Spend",   value: fmt(totalSpend),          sub: "across all campaigns"       },
          { label: "Total Leads Generated", value: totalLeads.toLocaleString(), sub: "this month"               },
          { label: "Blended Cost Per Lead", value: `$${blendedCpl.toFixed(2)}`, sub: "avg across channels"     },
          { label: "Active Campaigns",      value: activeCampaigns.length.toString(), sub: "currently running" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Section 1: Active Campaigns ─────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-bold text-gray-900">Active Campaigns</h2>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTER_BTNS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                ${filter === f ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
              No campaigns match this filter.
            </div>
          ) : (
            filtered.map(c => (
              <CampaignRow key={c.id} c={c} onToggleStatus={toggleStatus} onUpdateBudget={updateBudget} />
            ))
          )}
        </div>
      </div>

      {/* ── Section 2: Directory Listings ───────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-base font-bold text-gray-900">Recommended Listing Platforms</h2>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <p className="text-sm text-gray-500 mb-4">Expand your reach beyond paid social and search</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LISTINGS.map(l => (
            <div key={l.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col transition-all duration-200 hover:shadow-md relative">
              {/* Bookmark */}
              <button
                onClick={() => toggleSaved(l.id)}
                className={`absolute top-4 right-4 transition-colors duration-200 ${saved.has(l.id) ? "text-blue-600" : "text-gray-300 hover:text-gray-500"}`}
              >
                <Bookmark className={`size-4 ${saved.has(l.id) ? "fill-blue-600" : ""}`} />
              </button>

              {/* Avatar + Name */}
              <div className="flex items-center gap-3 mb-3">
                <ListingAvatar name={l.name} />
                <div>
                  <p className="font-bold text-gray-900 text-sm leading-tight pr-5">{l.name}</p>
                  <p className="text-xs text-gray-400">{l.type}</p>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-2">{l.model}</p>

              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Est. Cost</p>
                  <p className="text-sm font-bold text-gray-900">{l.cost}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-medium">Est. Leads/mo</p>
                  <p className="text-sm font-semibold text-gray-800">{l.leadsPerMonth}</p>
                </div>
              </div>

              <span className={`self-start mb-3 px-2 py-0.5 rounded-full text-xs font-semibold
                ${l.fit === "High" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                {l.fit} Fit
              </span>

              <p className="text-xs text-gray-500 leading-relaxed flex-1 mb-4">{l.description}</p>

              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-xs">{l.cta}</Button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: AI Recommendations ───────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">Smart Recommendations</h2>
            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-bold tracking-wide">AI</span>
          </div>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {visibleRecs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
            <CheckCircle2 className="size-10 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No new recommendations. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRecs.map(r => (
              <div
                key={r.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-violet-300 p-5 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="shrink-0">
                    <r.icon className={`size-5 mt-0.5 ${r.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm mb-1">{r.title}</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{r.body}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-7 text-xs">{r.primaryBtn}</Button>
                      <button
                        onClick={() => dismiss(r.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
