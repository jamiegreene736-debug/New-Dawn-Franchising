import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { CheckCircle, XCircle, Clock, FileText, Mail, MessageSquare, Linkedin, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

async function api(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any).error ?? `Error ${res.status}`);
  return body;
}

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  whatsapp: MessageSquare,
  sms: MessageSquare,
  linkedin_draft: Linkedin,
  forum_draft: FileText,
};

// ── Main Router ───────────────────────────────────────────────────────────────
export default function ApprovePage() {
  const [matchSeo, paramsSeo] = useRoute("/approve/seo/:token");
  const [matchOutreach, paramsOutreach] = useRoute("/approve/outreach/:token");
  const [matchPlan, paramsPlan] = useRoute("/approve/outreach-plan/:token");
  const [matchForum, paramsForum] = useRoute("/approve/forum/:token");
  const [matchLinkedIn, paramsLinkedIn] = useRoute("/approve/linkedin/:token");

  if (matchSeo && paramsSeo?.token) return <SeoApproval token={paramsSeo.token} />;
  if (matchOutreach && paramsOutreach?.token) return <OutreachApproval token={paramsOutreach.token} />;
  if (matchPlan && paramsPlan?.token) return <OutreachPlanApproval token={paramsPlan.token} />;
  if (matchForum && paramsForum?.token) return <ForumApproval token={paramsForum.token} />;
  if (matchLinkedIn && paramsLinkedIn?.token) return <LinkedInApproval token={paramsLinkedIn.token} />;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Invalid approval link.</p>
    </div>
  );
}

// ── SEO Draft Approval ────────────────────────────────────────────────────────
function SeoApproval({ token }: { token: string }) {
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [showBody, setShowBody] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/api/approve/seo/${token}`)
      .then(setDraft)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (act: "approve" | "reject") => {
    setAction(act);
    setSubmitting(true);
    try {
      await api(`/api/approve/seo/${token}`, {
        method: "POST",
        body: JSON.stringify({ action: act, notes: notes.trim() || undefined }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (done) return <DoneScreen action={action!} type="seo" title={draft?.title} />;
  if (draft?.status && draft.status !== "awaiting_approval") {
    return <AlreadyProcessed status={draft.status} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">SEO Content Approval</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{draft?.title}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        {/* Meta cards */}
        <div className="grid grid-cols-3 gap-3">
          <MetaCard label="Type" value={draft?.contentType?.replace(/_/g, " ")} />
          <MetaCard label="Keyword" value={draft?.targetKeyword} />
          <MetaCard label="Words" value={draft?.wordCount?.toString()} />
        </div>

        {/* Meta description */}
        {draft?.metaDescription && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Meta Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{draft.metaDescription}</p>
          </div>
        )}

        {/* Article body (collapsible) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowBody(b => !b)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50">
            <span>Article Content ({draft?.wordCount ?? "?"} words)</span>
            {showBody ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showBody && (
            <div className="px-4 pb-4 border-t border-gray-100">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed mt-3 max-h-96 overflow-y-auto">
                {draft?.body}
              </pre>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any feedback or changes needed…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pb-8">
          <button
            onClick={() => submit("reject")}
            disabled={submitting}
            className="py-4 rounded-2xl border-2 border-red-200 text-red-600 font-semibold text-base hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && action === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-5 h-5" />}
            Reject
          </button>
          <button
            onClick={() => submit("approve")}
            disabled={submitting}
            className="py-4 rounded-2xl bg-green-600 text-white font-semibold text-base hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && action === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Approve
          </button>
        </div>

        <p className="text-xs text-center text-gray-400 pb-6">New Dawn Franchising · AI SEO Agent</p>
      </div>
    </div>
  );
}

// ── Outreach Touch Approval ───────────────────────────────────────────────────
function OutreachApproval({ token }: { token: string }) {
  const [touch, setTouch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/api/approve/outreach/${token}`)
      .then(setTouch)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (act: "approve" | "reject") => {
    setAction(act);
    setSubmitting(true);
    try {
      await api(`/api/approve/outreach/${token}`, {
        method: "POST",
        body: JSON.stringify({ action: act, notes: notes.trim() || undefined }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (done) return <DoneScreen action={action!} type="outreach" title={touch?.subject ?? `${touch?.channel} message`} />;
  if (touch?.status && touch.status !== "awaiting_approval") {
    return <AlreadyProcessed status={touch.status} />;
  }

  const ChannelIcon = CHANNEL_ICONS[touch?.channel] ?? Mail;
  const channelLabel = (touch?.channel ?? "email").replace(/_/g, " ");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <ChannelIcon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Outreach Approval · {channelLabel}</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{touch?.subject ?? "No subject"}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        {/* Lead info */}
        {touch?.lead && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recipient</p>
            <p className="text-base font-semibold text-gray-900">{touch.lead.fullName}</p>
            {touch.lead.title && <p className="text-sm text-gray-600">{touch.lead.title}</p>}
            {touch.lead.company && <p className="text-sm text-gray-500">{touch.lead.company}</p>}
            {touch.lead.email && <p className="text-sm text-blue-600 mt-1">{touch.lead.email}</p>}
          </div>
        )}

        {/* Meta cards */}
        <div className="grid grid-cols-3 gap-3">
          <MetaCard label="Channel" value={channelLabel} />
          <MetaCard label="Step" value={`Touch ${touch?.stepNumber}`} />
          <MetaCard label="Confidence" value={touch?.confidenceScore ? `${touch.confidenceScore}%` : "—"} />
        </div>

        {/* Personalization hook */}
        {touch?.personalizationHook && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Personalization Hook</p>
            <p className="text-sm text-amber-800 leading-relaxed">{touch.personalizationHook}</p>
          </div>
        )}

        {/* Message body */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Message</p>
          {touch?.subject && (
            <p className="text-sm font-semibold text-gray-800 mb-2 pb-2 border-b border-gray-100">
              Subject: {touch.subject}
            </p>
          )}
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">
            {touch?.body}
          </pre>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any feedback…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pb-8">
          <button
            onClick={() => submit("reject")}
            disabled={submitting}
            className="py-4 rounded-2xl border-2 border-red-200 text-red-600 font-semibold text-base hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && action === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-5 h-5" />}
            Reject
          </button>
          <button
            onClick={() => submit("approve")}
            disabled={submitting}
            className="py-4 rounded-2xl bg-green-600 text-white font-semibold text-base hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && action === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Approve &amp; Send
          </button>
        </div>

        <p className="text-xs text-center text-gray-400 pb-6">New Dawn Franchising · AI Outreach Agent</p>
      </div>
    </div>
  );
}

// ── Outreach Daily Plan Approval ──────────────────────────────────────────────
function OutreachPlanApproval({ token }: { token: string }) {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showQueries, setShowQueries] = useState(false);

  useEffect(() => {
    api(`/api/approve/plan/${token}`)
      .then(setPlan)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (act: "approve" | "reject") => {
    setAction(act);
    setSubmitting(true);
    try {
      await api(`/api/approve/plan/${token}`, {
        method: "POST",
        body: JSON.stringify({ action: act, notes: notes.trim() || undefined }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center">
        {action === "approve"
          ? <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          : <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />}
        <h1 className="text-xl font-bold text-gray-900">
          {action === "approve" ? "Plan Approved!" : "Plan Rejected"}
        </h1>
        {action === "approve" && (
          <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
            The agent is now searching for leads. You'll get a text when it's done.
          </p>
        )}
        <p className="text-xs text-gray-300 mt-8">New Dawn Franchising · Outreach Intelligence Agent</p>
      </div>
    </div>
  );
  if (plan?.status && plan.status !== "awaiting_approval") {
    return <AlreadyProcessed status={plan.status} />;
  }

  const categories = (plan?.leadCategories ?? []) as any[];
  const blockers = (plan?.blockerRequests ?? []) as any[];
  const queries = (plan?.searchQueries ?? []) as any[];
  const highPriority = categories.filter((c: any) => c.priority === "high");
  const rest = categories.filter((c: any) => c.priority !== "high");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">
              Daily Lead Plan · {plan?.planDate}
            </p>
            <p className="text-sm font-semibold text-gray-900 truncate">~{plan?.estimatedLeads} leads estimated across {categories.length} categories</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        {/* Plan summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agent's Plan</p>
          <p className="text-sm text-gray-700 leading-relaxed">{plan?.planSummary}</p>
        </div>

        {/* Lead categories */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Target Categories</p>
          {[...highPriority, ...rest].map((cat: any, i: number) => (
            <div key={i} className={`bg-white rounded-xl border p-4 ${cat.priority === "high" ? "border-emerald-200" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 capitalize">{cat.category?.replace(/_/g, " ")}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{cat.country}</span>
                    {cat.priority === "high" && (
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">High priority</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{cat.geoFocus}</p>
                  <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{cat.reasoning}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900">~{cat.estimatedLeads}</p>
                  <p className="text-[10px] text-gray-400">leads</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Strategic reasoning (collapsible) */}
        {plan?.strategicReasoning && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setShowReasoning(r => !r)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50">
              <span>Why these targets today?</span>
              {showReasoning ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showReasoning && (
              <div className="px-4 pb-4 border-t border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed mt-3">{plan.strategicReasoning}</p>
              </div>
            )}
          </div>
        )}

        {/* Search queries (collapsible) */}
        {queries.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setShowQueries(q => !q)} className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700 hover:bg-gray-50">
              <span>{queries.length} search queries planned</span>
              {showQueries ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showQueries && (
              <div className="px-4 pb-4 border-t border-gray-100 space-y-2 mt-3">
                {queries.map((q: any, i: number) => (
                  <div key={i} className="text-xs">
                    <span className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono mr-2">{q.source}</span>
                    <span className="text-gray-700 font-medium">"{q.query}"</span>
                    <p className="text-gray-400 mt-0.5 ml-0">{q.purpose}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Blocker requests */}
        {blockers.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Agent Requests Access To:</p>
            <div className="space-y-2">
              {blockers.map((b: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 mt-0.5 ${b.priority === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{b.priority}</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">{b.tool}</p>
                    <p className="text-xs text-amber-700">{b.reason}</p>
                    {b.url && <a href={b.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">{b.url}</a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Notes / Adjustments (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Any targets to skip, add, or adjust…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pb-8">
          <button onClick={() => submit("reject")} disabled={submitting}
            className="py-4 rounded-2xl border-2 border-red-200 text-red-600 font-semibold text-base hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && action === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-5 h-5" />}
            Skip Today
          </button>
          <button onClick={() => submit("approve")} disabled={submitting}
            className="py-4 rounded-2xl bg-emerald-600 text-white font-semibold text-base hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && action === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Find These Leads
          </button>
        </div>

        <p className="text-xs text-center text-gray-400 pb-6">New Dawn Franchising · Outreach Intelligence Agent</p>
      </div>
    </div>
  );
}

// ── Forum Reply Approval ──────────────────────────────────────────────────────
function ForumApproval({ token }: { token: string }) {
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    api(`/api/approve/forum/${token}`)
      .then(setDraft)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (act: "approve" | "reject") => {
    setAction(act);
    setSubmitting(true);
    try {
      await api(`/api/approve/forum/${token}`, {
        method: "POST",
        body: JSON.stringify({ action: act, notes: notes.trim() || undefined }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (done) return <DoneScreen action={action!} type="forum" title={draft?.postTitle} />;
  if (draft?.status && draft.status !== "awaiting_approval") {
    return <AlreadyProcessed status={draft.status} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-violet-600 uppercase tracking-wide">Forum Reply Approval · {draft?.platform}</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{draft?.postTitle ?? "Forum post"}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-5">
        {/* Original post */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <button
            className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wide"
            onClick={() => setShowOriginal(p => !p)}
          >
            <span>Original Post</span>
            {showOriginal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showOriginal && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-800 mb-2">{draft?.postTitle}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{draft?.postBody}</p>
              {draft?.postUrl && (
                <a
                  href={draft.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                >
                  View original post ↗
                </a>
              )}
            </div>
          )}
          {!showOriginal && (
            <p className="text-xs text-gray-400 mt-1 truncate">{draft?.postBody?.slice(0, 100)}…</p>
          )}
        </div>

        {/* Platform + link */}
        <div className="grid grid-cols-2 gap-3">
          <MetaCard label="Platform" value={draft?.platform} />
          <MetaCard label="Status" value="Awaiting approval" />
        </div>

        {/* Draft reply */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Drafted Reply</p>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed max-h-80 overflow-y-auto">
            {draft?.draftReply}
          </pre>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any feedback or edits…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pb-8">
          <button
            onClick={() => submit("reject")}
            disabled={submitting}
            className="py-4 rounded-2xl border-2 border-red-200 text-red-600 font-semibold text-base hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && action === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-5 h-5" />}
            Reject
          </button>
          <button
            onClick={() => submit("approve")}
            disabled={submitting}
            className="py-4 rounded-2xl bg-violet-600 text-white font-semibold text-base hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && action === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Approve
          </button>
        </div>

        <p className="text-xs text-center text-gray-400 pb-6">New Dawn Franchising · AI Outreach Agent</p>
      </div>
    </div>
  );
}

// ── LinkedIn Action Approval ──────────────────────────────────────────────────
function LinkedInApproval({ token }: { token: string }) {
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"sent" | "skip" | null>(null);
  const [done, setDone] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api(`/api/approve/linkedin/${token}`)
      .then(setItem)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (act: "sent" | "skip") => {
    setAction(act);
    setSubmitting(true);
    try {
      await api(`/api/approve/linkedin/${token}`, {
        method: "POST",
        body: JSON.stringify({ action: act, notes: notes.trim() || undefined }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (done) {
    const approved = action === "sent";
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          {approved
            ? <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            : <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />}
          <h1 className="text-xl font-bold text-gray-900">
            {approved ? "Marked as Sent!" : "Skipped"}
          </h1>
          <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
            {approved
              ? item?.type === "connection_request"
                ? "Connection request confirmed. The Day 3 LinkedIn DM will unlock once accepted."
                : "LinkedIn DM confirmed as sent."
              : "This LinkedIn action has been skipped."}
          </p>
          <p className="text-xs text-gray-300 mt-8">New Dawn Franchising · AI Agent Platform</p>
        </div>
      </div>
    );
  }
  if (item?.status && item.status !== "pending") {
    return <AlreadyProcessed status={item.status} />;
  }

  const isConnection = item?.type === "connection_request";

  return (
    <div className="min-h-screen bg-[#f3f6f9]">
      {/* Header */}
      <div className="bg-[#0a66c2] px-5 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Linkedin className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-100 uppercase tracking-wide">
              LinkedIn {isConnection ? "Connection Request" : "Direct Message"}
            </p>
            <p className="text-sm font-semibold text-white truncate">{item?.leadName}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        {/* Lead info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-[#0a66c2] flex items-center justify-center flex-shrink-0 text-white font-bold text-lg">
              {(item?.leadName ?? "?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{item?.leadName}</p>
              {item?.leadCompany && <p className="text-sm text-gray-500">{item.leadCompany}</p>}
              {item?.leadTitle && <p className="text-xs text-gray-400 mt-0.5 capitalize">{item.leadTitle}</p>}
            </div>
          </div>
          {item?.leadLinkedinUrl && (
            <a
              href={item.leadLinkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 text-sm text-[#0a66c2] hover:underline font-medium"
            >
              <Linkedin className="w-4 h-4" />
              Open LinkedIn Profile ↗
            </a>
          )}
        </div>

        {/* Action type badge */}
        <div className="grid grid-cols-2 gap-3">
          <MetaCard label="Action Type" value={isConnection ? "Connection Request" : "Direct Message"} />
          <MetaCard label="Status" value="Pending your action" />
        </div>

        {/* Draft message */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {isConnection ? "Connection Note" : "Message to Send"}
          </p>
          <div className="bg-[#f3f6f9] rounded-lg p-3">
            <p className="text-sm text-gray-800 leading-relaxed">{item?.message}</p>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Copy this message and paste it into LinkedIn when sending.
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">How to send</p>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Tap "Open LinkedIn Profile" above</li>
            <li>Click {isConnection ? '"Connect" → "Add a note"' : '"Message"'}</li>
            <li>Paste the message above</li>
            <li>Send, then come back and tap "Mark as Sent" below</li>
          </ol>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Profile not found, already connected…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3 pb-8">
          <button
            onClick={() => submit("skip")}
            disabled={submitting}
            className="py-4 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-base hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && action === "skip" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-5 h-5" />}
            Skip
          </button>
          <button
            onClick={() => submit("sent")}
            disabled={submitting}
            className="py-4 rounded-2xl bg-[#0a66c2] text-white font-semibold text-base hover:bg-[#004182] disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && action === "sent" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Mark as Sent
          </button>
        </div>

        <p className="text-xs text-center text-gray-400 pb-6">New Dawn Franchising · LinkedIn Outreach Queue</p>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────
function MetaCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5 capitalize truncate">{value ?? "—"}</p>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  const PORTAL = "https://newdawnfranchising.replit.app/agent";
  const isNotFound = /not found|expired|no longer valid/i.test(message);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center max-w-sm">
        {isNotFound
          ? <Clock className="w-14 h-14 text-amber-400 mx-auto mb-4" />
          : <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />}
        <p className="text-gray-900 font-semibold text-lg">
          {isNotFound ? "This link has expired" : "Something went wrong"}
        </p>
        <p className="text-gray-500 text-sm mt-2 leading-relaxed">
          {isNotFound
            ? "This approval link is no longer valid — the item may have already been processed, or a system update cleared the queue."
            : message}
        </p>
        <a
          href={PORTAL}
          className="mt-6 inline-block px-5 py-3 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700">
          Open Agent Portal →
        </a>
        <p className="text-xs text-gray-300 mt-6">New Dawn Franchising · AI Agent Platform</p>
      </div>
    </div>
  );
}

function DoneScreen({ action, type, title }: { action: "approve" | "reject"; type: string; title?: string }) {
  const approved = action === "approve";
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center">
        {approved
          ? <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          : <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />}
        <h1 className="text-xl font-bold text-gray-900">
          {approved ? (type === "outreach" ? "Approved & Sent!" : "Approved!") : "Rejected"}
        </h1>
        {title && <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">"{title}"</p>}
        <p className="text-sm text-gray-400 mt-4">
          {approved
            ? type === "outreach"
              ? "The message has been sent to the recipient."
              : type === "forum"
                ? "The reply is marked as approved. Copy it into the forum using your saved credentials."
                : "The content is now marked as approved."
            : "The draft has been rejected. The agent will note your feedback."}
        </p>
        <p className="text-xs text-gray-300 mt-8">New Dawn Franchising · AI Agent Platform</p>
      </div>
    </div>
  );
}

function AlreadyProcessed({ status }: { status: string }) {
  const icons: Record<string, any> = { approved: CheckCircle, rejected: XCircle, sent: CheckCircle, published: CheckCircle };
  const Icon = icons[status] ?? Clock;
  const colors: Record<string, string> = { approved: "text-green-500", rejected: "text-red-400", sent: "text-green-500", published: "text-green-500" };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center">
        <Icon className={`w-12 h-12 mx-auto mb-3 ${colors[status] ?? "text-gray-400"}`} />
        <p className="text-gray-900 font-semibold capitalize">Already {status}</p>
        <p className="text-gray-500 text-sm mt-1">This item has already been processed.</p>
      </div>
    </div>
  );
}
