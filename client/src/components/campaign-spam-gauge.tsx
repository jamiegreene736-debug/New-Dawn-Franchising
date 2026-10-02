import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { CampaignSpamRisk } from "@shared/campaign-spam-risk";
import { Button } from "@/components/ui/button";

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown date";
}

export function CampaignSpamGauge({ campaignId, revision }: { campaignId: string; revision: string }) {
  const query = useQuery<CampaignSpamRisk>({
    queryKey: ["/api/crm/campaigns", campaignId, "spam-risk", revision],
    queryFn: async () => {
      const response = await fetch(`/api/crm/campaigns/${encodeURIComponent(campaignId)}/spam-risk`, { credentials: "include" });
      if (!response.ok) throw new Error("Risk checks unavailable");
      return response.json();
    },
    staleTime: 60_000, retry: 1,
  });
  const report = query.data;
  const unavailable = query.isError;
  const level = unavailable ? "unknown" : report?.level ?? "unknown";
  const tone = level === "high" ? "border-red-300 bg-red-50 text-red-950" : level === "review" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-slate-300 bg-slate-50 text-slate-900";
  return (
    <section aria-label="Campaign spam risk" data-testid="campaign-spam-gauge" className={`mb-5 rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Spam risk</h3>
          <p role="status" className="mt-1 text-lg font-semibold">{unavailable ? "Checks unavailable — placement unknown" : report?.label ?? "Checking saved campaign…"}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} /> Recheck
        </Button>
      </div>
      <div aria-hidden="true" className="my-3 grid grid-cols-3 gap-1">
        {(["unknown", "review", "high"] as const).map((band, index) => <div key={band} className={`h-2 rounded ${band === level ? ["bg-slate-500", "bg-amber-500", "bg-red-600"][index] : "bg-slate-200"}`} />)}
      </div>
      <p className="text-sm">Risk guidance, not a promise of inbox delivery. Rechecking sends no emails and does not activate the campaign.</p>
      {unavailable ? <p className="mt-2 text-sm">Evidence could not be refreshed. Retry before making a sending decision.</p> : report && <>
        <p className="mt-2 text-xs">Checked {dateLabel(report.checkedAt)} · {report.domain}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{report.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        <details className="mt-4 rounded-lg border border-current/15 bg-white/70 p-3">
          <summary className="cursor-pointer text-sm font-semibold">Domain and delivery evidence</summary>
          <div className="mt-3 space-y-2 text-sm">
            {report.domainChecks.map(check => <p key={check.label}><strong>{check.label} · {check.status}</strong> — {check.summary}</p>)}
            <p><strong>Postmaster:</strong> {report.postmaster.configured ? "API connected" : "API not connected"}. {report.postmaster.day ? <>Data dated {report.postmaster.day}{report.postmaster.fresh ? "" : " (stale)"}; user-reported spam {report.postmaster.spamRate === null ? "unknown" : `${(report.postmaster.spamRate * 100).toFixed(2)}%`}; reputation {report.postmaster.reputation ?? "unknown"}.</> : "No traffic data in the app."}</p>
            <p><strong>Workspace seed test:</strong> {report.seed ? <>{dateLabel(report.seed.at)}{report.seed.fresh ? "" : " (stale)"} — {report.seed.accepted} provider accepted, {report.seed.inbox} inbox, {report.seed.spam} spam, {report.seed.unresolved} unresolved. This is workspace evidence, not a test of every campaign step.</> : "No observed placement available."}</p>
            <a className="inline-block underline" href={`https://postmaster.google.com/v2/sender_compliance?domain=${encodeURIComponent(report.domain)}`} target="_blank" rel="noreferrer">Open Google Postmaster</a>
          </div>
        </details>
        <details className="mt-2 rounded-lg border border-current/15 bg-white/70 p-3">
          <summary className="cursor-pointer text-sm font-semibold">Email checks · {report.steps.filter(step => step.findings.length).length} of {report.steps.length} need review</summary>
          <div className="mt-3 space-y-4">
            {report.steps.map((step, index) => <div key={step.id} className="text-sm">
              <p className="font-semibold">Email {index + 1}: {step.subject}</p>
              <p className="text-xs">{step.words} body words · {step.level === "lower" ? "Fewer local concerns; placement unverified" : "Review"}</p>
              {!!step.findings.length && <ul className="mt-1 list-disc space-y-1 pl-5">{step.findings.map((finding, i) => <li key={i}>{finding}</li>)}</ul>}
            </div>)}
          </div>
        </details>
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer font-medium">What this gauge can and cannot tell you</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">{report.limitations.map(text => <li key={text}>{text}</li>)}</ul>
          <a className="mt-2 inline-block underline" href="https://support.google.com/mail/answer/81126" target="_blank" rel="noreferrer">Google’s sender guidelines</a>
        </details>
      </>}
    </section>
  );
}
