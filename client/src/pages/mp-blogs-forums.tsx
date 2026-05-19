import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink, MessageSquare, BookOpen, Users, Filter,
  KeyRound, Eye, EyeOff, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, LogIn,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ForumEntry {
  name: string;
  url: string;
  type: "Forum" | "Blog" | "Community" | "Newsletter" | "Association";
  audience: "investors" | "brokers" | "both";
  activity: "Very High" | "High" | "Medium";
  description: string;
  tip: string;
  defaultLoginUrl?: string;
}

interface ForumAccount {
  id: string;
  forumName: string;
  siteUrl: string;
  loginUrl: string | null;
  username: string | null;
  password: string | null;
  notes: string | null;
  autoScanEnabled: boolean;
  lastScannedAt: string | null;
  lastPostedAt: string | null;
  postsCount: number;
}

// ─── Static forum list ────────────────────────────────────────────────────────

const ENTRIES: ForumEntry[] = [
  {
    name: "Visa Journey Forums",
    url: "https://www.visajourney.com/forums/",
    defaultLoginUrl: "https://www.visajourney.com/forums/index.php?app=core&module=global&section=login",
    type: "Forum", audience: "investors", activity: "Very High",
    description: "The largest US visa community online. Dedicated E-2 visa subforum with thousands of active applicants sharing timelines, documents, and advice.",
    tip: "Answer questions in the E-2 subforum. Mention New Dawn as a franchise that meets USCIS requirements and offers escrow protection.",
  },
  {
    name: "Reddit r/immigration",
    url: "https://www.reddit.com/r/immigration/",
    defaultLoginUrl: "https://www.reddit.com/login/",
    type: "Community", audience: "investors", activity: "Very High",
    description: "600k+ members. Regular posts from people exploring treaty investor visas, especially from Mexico, UK, and Canada.",
    tip: "Search 'E-2 visa franchise' — provide genuinely helpful answers and link to newdawnfranchising.com as an example.",
  },
  {
    name: "Reddit r/expats",
    url: "https://www.reddit.com/r/expats/",
    defaultLoginUrl: "https://www.reddit.com/login/",
    type: "Community", audience: "investors", activity: "Very High",
    description: "300k+ expats discussing relocation, visas, and building a US life. Many are actively researching E-2.",
    tip: "Posts about 'moving to USA' or 'US business visa' are prime opportunities. Reference the E-2 pathway naturally.",
  },
  {
    name: "Reddit r/Entrepreneur",
    url: "https://www.reddit.com/r/Entrepreneur/",
    defaultLoginUrl: "https://www.reddit.com/login/",
    type: "Community", audience: "investors", activity: "Very High",
    description: "1.5M+ members. International entrepreneurs who want to enter the US market frequently ask about investor visas.",
    tip: "Posts asking 'how do I start a business in the USA' are opportunities to explain the E-2 franchise pathway.",
  },
  {
    name: "Expat Forum",
    url: "https://www.expatforum.com/expats/usa-expat-forum/",
    defaultLoginUrl: "https://www.expatforum.com/expats/login/",
    type: "Forum", audience: "investors", activity: "High",
    description: "UK-focused expat community with a large USA subforum. British nationals are among the top E-2 visa applicants.",
    tip: "UK citizens are the #1 E-2 visa national group. Target British expats researching the visa pathway here.",
  },
  {
    name: "Expat Exchange",
    url: "https://www.expatexchange.com/",
    defaultLoginUrl: "https://www.expatexchange.com/login.cfm",
    type: "Community", audience: "investors", activity: "High",
    description: "Global expat network with country-specific USA sections. Articles and forum threads on immigration and investment.",
    tip: "Submit a guest article titled 'The E-2 Franchise Route to Living and Working in the USA'.",
  },
  {
    name: "BiggerPockets Forums",
    url: "https://www.biggerpockets.com/forums",
    defaultLoginUrl: "https://www.biggerpockets.com/login",
    type: "Forum", audience: "investors", activity: "Very High",
    description: "2M+ real estate investors. International investors frequently ask about US property investments and visa implications.",
    tip: "The 'General Real Estate' and 'International' subforums are best. Property management franchises pair perfectly with real estate discussions.",
  },
  {
    name: "ImmiHelp E-2 Visa Forum",
    url: "https://www.immihelp.com/forum/",
    defaultLoginUrl: "https://www.immihelp.com/forum/member.php?action=login",
    type: "Forum", audience: "investors", activity: "High",
    description: "Immigration-focused Q&A community with an E-2 visa section. Users actively research investment requirements and business types.",
    tip: "Answer common questions about the minimum investment threshold and explain how a franchise reduces risk vs. a startup.",
  },
  {
    name: "Internations.org",
    url: "https://www.internations.org/usa-expats",
    defaultLoginUrl: "https://www.internations.org/login",
    type: "Community", audience: "investors", activity: "High",
    description: "4M+ expat members globally. Large USA communities in major cities — many are HNW individuals exploring US relocation.",
    tip: "Join the Mexico, UAE, and UK city groups. Local meetup events are great for in-person relationship building.",
  },
  {
    name: "Dave's ESL Cafe Immigration Board",
    url: "https://forums.eslcafe.com/job/viewforum.php?f=19",
    defaultLoginUrl: "https://forums.eslcafe.com/job/ucp.php?mode=login",
    type: "Forum", audience: "investors", activity: "Medium",
    description: "Popular among foreign nationals working or living in the US — many ask about immigration options including E-2.",
    tip: "Posts from people on other visa types asking 'what are my options' are prime E-2 educational opportunities.",
  },
  {
    name: "AILA (American Immigration Lawyers Assoc.)",
    url: "https://www.aila.org/",
    defaultLoginUrl: "https://www.aila.org/login",
    type: "Association", audience: "brokers", activity: "High",
    description: "The professional home of US immigration attorneys. AILA hosts conferences, webinars, and a member community where attorneys network.",
    tip: "Sponsor or present at an AILA local chapter event. Attorneys who handle E-2 cases are your highest-value referral partners.",
  },
  {
    name: "Blue MauMau",
    url: "https://www.bluemaumau.org/",
    defaultLoginUrl: "https://www.bluemaumau.org/user/login",
    type: "Forum", audience: "brokers", activity: "High",
    description: "The leading online forum for franchise industry professionals — brokers, consultants, attorneys, and franchisors.",
    tip: "Post about E-2 visa franchising as a growing segment. Franchise brokers here can refer international clients directly.",
  },
  {
    name: "FBA (Franchise Brokers Association)",
    url: "https://www.fba.inc/",
    type: "Association", audience: "brokers", activity: "High",
    description: "Largest network of independent franchise brokers in the US. Members actively match investors with franchise opportunities.",
    tip: "List New Dawn Franchising in the FBA brand catalog. Members can earn referral fees by placing E-2 investors with you.",
  },
  {
    name: "IFA (International Franchise Association)",
    url: "https://www.franchise.org/",
    type: "Association", audience: "brokers", activity: "High",
    description: "The premier franchise industry trade group. Their events and publications reach both brokers and international investors.",
    tip: "The IFA's annual convention is the top place to meet franchise attorneys, brokers, and consultants with international clients.",
  },
  {
    name: "Immigration Daily (ILW.com)",
    url: "https://www.ilw.com/",
    defaultLoginUrl: "https://www.ilw.com/immigrationdaily/",
    type: "Blog", audience: "brokers", activity: "High",
    description: "Daily publication read by thousands of US immigration attorneys and consultants. Articles on E-2 visa strategy, case law, and investment structures.",
    tip: "Submit a guest article: 'Property Management Franchises as a Viable E-2 Investment'.",
  },
  {
    name: "ImmigrationProf Blog",
    url: "https://lawprofessors.typepad.com/immigration/",
    type: "Blog", audience: "brokers", activity: "Medium",
    description: "Read by immigration law faculty, practitioners, and advanced researchers. Covers E-2 precedent decisions and USCIS policy changes.",
    tip: "Post a comment with a link to your blog when relevant articles appear.",
  },
  {
    name: "Visa Law Group Blog",
    url: "https://www.visalawgroup.com/blog/",
    type: "Blog", audience: "brokers", activity: "Medium",
    description: "E-2 visa specialist law firm blog read by clients AND other attorneys seeking referral partners or co-counsel.",
    tip: "Comment thoughtfully on E-2 franchise content. This positions New Dawn as knowledgeable to referring attorneys.",
  },
  {
    name: "LinkedIn — Immigration Attorney Groups",
    url: "https://www.linkedin.com/groups/",
    defaultLoginUrl: "https://www.linkedin.com/login",
    type: "Community", audience: "brokers", activity: "Very High",
    description: "Several LinkedIn groups for US immigration attorneys — 'Immigration Lawyers Worldwide,' 'US Immigration Professionals,' and 'E-2 Visa Investors.'",
    tip: "Search 'E-2 visa' and 'immigration attorney' on LinkedIn. Connect, share content, and offer co-marketing agreements.",
  },
  {
    name: "Franchise Times Blog",
    url: "https://www.franchisetimes.com/",
    type: "Blog", audience: "brokers", activity: "High",
    description: "Trade publication for franchise industry professionals. Brokers, attorneys, and consultants read it to stay current on brands and deals.",
    tip: "Pitch a bylined article about E-2 visa franchising in Texas.",
  },
  {
    name: "FranchiseChat.com",
    url: "https://www.franchisechat.com/",
    defaultLoginUrl: "https://www.franchisechat.com/login",
    type: "Forum", audience: "brokers", activity: "Medium",
    description: "Community for franchisors, franchisees, and consultants. Discussions on finding the right franchise and working with international buyers.",
    tip: "Start a thread on E-2 visa franchise investing — consultants here may refer international clients if you educate them.",
  },
  {
    name: "Entrepreneur.com — Franchises Section",
    url: "https://www.entrepreneur.com/franchises",
    type: "Blog", audience: "both", activity: "Very High",
    description: "One of the most-read business publications globally. The franchise section reaches both investors looking for opportunities and consultants.",
    tip: "Pitch a guest post: 'How a $250K Property Management Franchise Can Qualify You for the E-2 Visa.'",
  },
  {
    name: "Boundless Immigration Blog",
    url: "https://www.boundless.com/blog/",
    type: "Blog", audience: "both", activity: "High",
    description: "Consumer-facing immigration blog with 500k+ monthly readers. Articles on E-2 visa requirements reach both applicants and their advisors.",
    tip: "The comments section on E-2 articles draws active researchers. Provide expert-level answers and include your website.",
  },
  {
    name: "CitizenPath Blog",
    url: "https://citizenpath.com/blog/",
    type: "Blog", audience: "both", activity: "High",
    description: "DIY immigration guide blog with strong SEO rankings for E-2 visa searches. Reaches investors who are early in their research phase.",
    tip: "Comment on E-2 visa articles with helpful clarifications.",
  },
  {
    name: "Quora — E-2 Visa Topics",
    url: "https://www.quora.com/topic/E-2-Visa",
    defaultLoginUrl: "https://www.quora.com/",
    type: "Community", audience: "both", activity: "High",
    description: "Thousands of questions about E-2 visas answered publicly. Content ranks on Google, giving long-term SEO value to well-written answers.",
    tip: "Answer the top E-2 visa questions thoroughly. Include a mention of New Dawn Franchising as a qualifying investment example.",
  },
  {
    name: "Forbes — Immigrant Entrepreneurship",
    url: "https://www.forbes.com/immigration/",
    type: "Blog", audience: "both", activity: "Very High",
    description: "Forbes content on immigration and entrepreneurship is syndicated widely. A mention or byline here reaches both HNW investors and their advisors.",
    tip: "Pitch a contributed article through Forbes Councils or by connecting with a Forbes reporter who covers immigration business stories.",
  },
];

// ─── Display helpers ──────────────────────────────────────────────────────────

const TYPE_ICONS: Record<ForumEntry["type"], React.ElementType> = {
  Forum: MessageSquare, Blog: BookOpen, Community: Users, Newsletter: BookOpen, Association: Users,
};
const TYPE_COLORS: Record<ForumEntry["type"], string> = {
  Forum: "bg-blue-50 text-blue-700 border-blue-200",
  Blog: "bg-purple-50 text-purple-700 border-purple-200",
  Community: "bg-green-50 text-green-700 border-green-200",
  Newsletter: "bg-orange-50 text-orange-700 border-orange-200",
  Association: "bg-amber-50 text-amber-700 border-amber-200",
};
const ACTIVITY_COLORS: Record<ForumEntry["activity"], string> = {
  "Very High": "bg-emerald-100 text-emerald-700",
  "High": "bg-sky-100 text-sky-700",
  "Medium": "bg-slate-100 text-slate-600",
};
const AUDIENCE_LABELS: Record<ForumEntry["audience"], string> = {
  investors: "Direct Investors", brokers: "Brokers / Attorneys", both: "Both",
};

// ─── Inline credential form ───────────────────────────────────────────────────

function CredentialForm({
  entry,
  existing,
  onSave,
  onCancel,
}: {
  entry: ForumEntry;
  existing: ForumAccount | null;
  onSave: (data: Partial<ForumAccount>) => void;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState(existing?.username ?? "");
  const [password, setPassword] = useState(existing?.password ?? "");
  const [loginUrl, setLoginUrl] = useState(existing?.loginUrl ?? entry.defaultLoginUrl ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="mt-3 border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Username / Email</label>
        <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="your@email.com" className="h-8 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Password</label>
        <div className="relative">
          <Input
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-8 text-sm pr-8"
          />
          <button onClick={() => setShowPw(p => !p)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Login URL</label>
        <Input value={loginUrl} onChange={e => setLoginUrl(e.target.value)} placeholder="https://..." className="h-8 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Notes (optional)</label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. 2FA via email" className="h-8 text-sm" />
      </div>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="size-3.5 mr-1" />Cancel</Button>
        <Button size="sm" onClick={() => onSave({ username, password, loginUrl, notes })}>
          <Check className="size-3.5 mr-1" />Save
        </Button>
      </div>
    </div>
  );
}

// ─── Credential display ───────────────────────────────────────────────────────

function CredentialBadge({ account, onEdit, onDelete, onToggle }: {
  account: ForumAccount;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
          <KeyRound className="size-3.5 text-green-600 shrink-0" />
          <span className="text-xs font-medium text-green-800">{account.username}</span>
        </div>
        <div className="flex items-center gap-1 bg-gray-50 border rounded-lg px-2 py-1.5">
          <span className="text-xs font-mono text-gray-600">
            {showPw ? account.password : "••••••••"}
          </span>
          <button onClick={() => setShowPw(p => !p)} className="text-gray-400 hover:text-gray-600 ml-1">
            {showPw ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </button>
        </div>
        {account.loginUrl && (
          <a
            href={account.loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 font-medium transition-colors"
          >
            <LogIn className="size-3.5" />Login page
          </a>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={onToggle}
            title={account.autoScanEnabled ? "AI scanning ON — click to pause" : "AI scanning OFF — click to enable"}
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border transition-colors ${
              account.autoScanEnabled
                ? "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
            }`}
          >
            {account.autoScanEnabled
              ? <><ToggleRight className="size-3.5" />AI scan ON</>
              : <><ToggleLeft className="size-3.5" />AI scan OFF</>}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {account.lastScannedAt && (
        <p className="text-xs text-gray-400 mt-1.5">
          Last scanned: {new Date(account.lastScannedAt).toLocaleDateString()} ·{" "}
          {account.postsCount ?? 0} draft{account.postsCount !== 1 ? "s" : ""} created
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MpBlogsForums() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "investors" | "brokers" | "both">("all");
  const [search, setSearch] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);

  const { data: accounts = [] } = useQuery<ForumAccount[]>({
    queryKey: ["/api/agent/forum-accounts"],
    queryFn: () => fetch("/api/agent/forum-accounts").then(r => r.json()),
    refetchInterval: 30000,
  });

  const accountByName = (name: string) => accounts.find(a => a.forumName === name) ?? null;

  const saveMut = useMutation({
    mutationFn: async ({ entry, data }: { entry: ForumEntry; data: Partial<ForumAccount> }) => {
      const existing = accountByName(entry.name);
      if (existing) {
        return fetch(`/api/agent/forum-accounts/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }).then(r => r.json());
      } else {
        return fetch("/api/agent/forum-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forumName: entry.name, siteUrl: entry.url, ...data }),
        }).then(r => r.json());
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/agent/forum-accounts"] }); setEditingName(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/agent/forum-accounts/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/agent/forum-accounts"] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      fetch(`/api/agent/forum-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoScanEnabled: enabled }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/agent/forum-accounts"] }),
  });

  const filtered = ENTRIES.filter(e => {
    const audienceMatch = filter === "all" || e.audience === filter || (filter !== "both" && e.audience === "both");
    const searchMatch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase());
    return audienceMatch && searchMatch;
  });

  const counts = {
    all: ENTRIES.length,
    investors: ENTRIES.filter(e => e.audience === "investors" || e.audience === "both").length,
    brokers: ENTRIES.filter(e => e.audience === "brokers" || e.audience === "both").length,
    both: ENTRIES.filter(e => e.audience === "both").length,
  };

  const savedCount = accounts.length;
  const scanEnabled = accounts.filter(a => a.autoScanEnabled).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Blogs &amp; Forums</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Curated communities to reach E-2 investors and referral partners. Add your login credentials — the AI agent will scan each platform daily for relevant discussions and draft replies for your approval.
        </p>
        {savedCount > 0 && (
          <div className="mt-3 flex gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1">
              <KeyRound className="size-3.5" />{savedCount} credential{savedCount !== 1 ? "s" : ""} saved
            </span>
            {scanEnabled > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-3 py-1">
                AI scanning {scanEnabled} platform{scanEnabled !== 1 ? "s" : ""} daily
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex rounded-lg border bg-white overflow-hidden shrink-0">
          {(["all", "investors", "brokers", "both"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-sm font-medium transition-colors border-r last:border-r-0 ${
                filter === f ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f === "all" ? `All (${counts.all})` :
               f === "investors" ? `Investors (${counts.investors})` :
               f === "brokers" ? `Brokers (${counts.brokers})` :
               `Both (${counts.both})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="Search by name or keyword..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">{filtered.length} place{filtered.length !== 1 ? "s" : ""} shown</p>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map(entry => {
          const TypeIcon = TYPE_ICONS[entry.type];
          const acct = accountByName(entry.name);
          const isEditing = editingName === entry.name;

          return (
            <div key={entry.name} className={`bg-white rounded-xl border p-4 transition-all ${acct ? "border-green-200 shadow-sm" : "border-gray-200 hover:border-indigo-200 hover:shadow-sm"}`}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Icon */}
                <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${acct ? "bg-green-50" : "bg-indigo-50"}`}>
                  <TypeIcon className={`size-5 ${acct ? "text-green-500" : "text-indigo-500"}`} />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors flex items-center gap-1"
                    >
                      {entry.name}
                      <ExternalLink className="size-3.5 text-gray-400 shrink-0" />
                    </a>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[entry.type]}`}>{entry.type}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ACTIVITY_COLORS[entry.activity]}`}>{entry.activity} Activity</span>
                    <span className="text-xs text-gray-400 font-medium">→ {AUDIENCE_LABELS[entry.audience]}</span>

                    {/* Add credentials button (only if none saved) */}
                    {!acct && !isEditing && (
                      <button
                        onClick={() => setEditingName(entry.name)}
                        className="ml-auto flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-2.5 py-1 transition-colors"
                      >
                        <KeyRound className="size-3.5" />Add credentials
                      </button>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-2">{entry.description}</p>

                  {/* Tip */}
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-800">
                      <span className="font-semibold">💡 How to use it: </span>{entry.tip}
                    </p>
                  </div>

                  {/* Credentials section */}
                  {isEditing && (
                    <CredentialForm
                      entry={entry}
                      existing={acct}
                      onSave={data => saveMut.mutate({ entry, data })}
                      onCancel={() => setEditingName(null)}
                    />
                  )}
                  {acct && !isEditing && (
                    <CredentialBadge
                      account={acct}
                      onEdit={() => setEditingName(entry.name)}
                      onDelete={() => deleteMut.mutate(acct.id)}
                      onToggle={() => toggleMut.mutate({ id: acct.id, enabled: !acct.autoScanEnabled })}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare className="size-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No results found</p>
          <p className="text-sm mt-1">Try a different search or filter</p>
        </div>
      )}

      {/* Footer note */}
      <div className="mt-8 bg-violet-50 border border-violet-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-violet-900 mb-1">How the AI agent uses these credentials</p>
        <p className="text-xs text-violet-700">
          Every day during the 6 AM preparation run, the agent searches each platform where you've enabled AI scanning, finds posts asking about E-2 visas, franchises, or US immigration, and drafts a helpful reply that naturally mentions New Dawn. Drafts appear in the <strong>Forum Drafts</strong> tab of the AI Agent portal for your review before anything gets posted. You always have the final say.
        </p>
      </div>
    </div>
  );
}
