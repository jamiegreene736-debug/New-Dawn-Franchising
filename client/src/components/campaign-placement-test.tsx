import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlacementOverview } from "@shared/campaign-placement";
import { Button } from "@/components/ui/button";

async function post(url: string, body = {}) {
  const response = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "The test could not be updated.");
  return result;
}
export function CampaignPlacementTest({ campaignId, revision, steps }: { campaignId: string; revision: string; steps: { id: string; subject: string }[] }) {
  const base = `/api/crm/campaigns/${encodeURIComponent(campaignId)}/placement-tests`;
  const client = useQueryClient();
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const request = useRef<{ key: string; id: string } | undefined>(undefined);
  const query = useQuery<PlacementOverview>({ queryKey: [base, revision], queryFn: async () => {
    const response = await fetch(base,{ credentials: "include" });
    if (!response.ok) throw new Error("Placement tests unavailable. Retry shortly.");
    return response.json();
  }, refetchInterval: 30_000, retry: 1 });
  const stepId = steps.some(s => s.id === selected) ? selected : steps[0]?.id || "";
  const mutate = useMutation({ mutationFn: async ({ action, id }: { action: "start" | "refresh" | "cancel"; id?: string }) => {
    if (action !== "start") return post(`${base}/${id}/${action}`);
    const key = JSON.stringify([campaignId,stepId,revision,reason]);
    if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
    return post(base,{ stepId, requestId: request.current!.id, reason });
  }, onSuccess: () => { client.invalidateQueries({ queryKey: [base] }); } });
  const data = query.data;
  const active = data?.tests.some(t => ["creating","queued","awaiting_placement"].includes(t.status));
  const ready = data?.configured && data.senderReady && data.outreachPaused;
  return <section aria-label="Inbox placement test" className="mt-4 rounded-lg border border-slate-300 bg-white p-4 text-slate-900">
    <h4 className="font-semibold">Test inbox placement</h4>
    <p className="mt-1 text-sm">Send one saved email to controlled test mailboxes and measure where it lands. This uses your real sender. No prospects are contacted and the campaign stays paused.</p>
    {query.isError && <p role="alert" className="mt-2 text-sm text-red-700">{query.error.message}</p>}
    {data && !data.configured && <p className="mt-2 text-sm">Connect GlockApps to enable testing. <a href="https://glockapps.com/api-documentation-v2/" target="_blank" rel="noreferrer" className="underline">Create a free account</a>, then have its API connection and up to 12 test mailboxes configured. One test uses one provider test credit.</p>}
    {data && !data.senderReady && <p className="mt-2 text-sm">The sending mailbox needs to be connected.</p>}
    {data && !data.outreachPaused && <p className="mt-2 text-sm">Pause outreach before starting or continuing a controlled test.</p>}
    <label className="mt-3 block text-sm font-medium" htmlFor={`placement-step-${campaignId}`}>Saved email to test</label>
    <select id={`placement-step-${campaignId}`} className="mt-1 w-full rounded border p-2 text-sm" value={stepId} onChange={e=>setSelected(e.target.value)} disabled={mutate.isPending}>
      {steps.map((s,i)=><option key={s.id} value={s.id}>Email {i+1}: {s.subject}</option>)}
    </select>
    <label className="mt-3 block text-sm" htmlFor={`placement-reason-${campaignId}`}>What changed? Required for a repeat of the same email within seven days.</label>
    <input id={`placement-reason-${campaignId}`} className="mt-1 w-full rounded border p-2 text-sm" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} placeholder="For example, describe the DNS or sender change." />
    <p className="mt-2 text-xs">Tests use sample recipient Alex Morgan and an empty firm introduction. Subject and body stay unchanged except personalization; a test header identifies the message. Save edits before testing. Sending respects the 15/hour and 80/day limits; each copy is paced five minutes apart.</p>
    <Button type="button" className="mt-3" disabled={!ready || !stepId || active || mutate.isPending} onClick={()=>mutate.mutate({action:"start"})}>Start test · 1 credit{data?.configured ? ` · ${data.seedCount} mailboxes` : ""}</Button>
    {mutate.isError && <p role="alert" className="mt-2 text-sm text-red-700">{mutate.error.message}</p>}
    <div className="mt-4 space-y-3" aria-live="polite">
      {data?.tests.map(test=>{
        const counts = { inbox: 0, tabs: 0, spam: 0, missing: 0, unknown: 0 };
        for (const m of test.messages) {
          if (m.placement in counts) counts[m.placement as keyof typeof counts]++;
          else counts.unknown++;
        }
        return <details key={test.id} className={`rounded border p-3 ${counts.spam ? "border-red-400" : "border-slate-200"}`} open={data.tests[0].id === test.id}>
          <summary className="cursor-pointer text-sm font-semibold">{test.snapshot.subject} · {test.status.replaceAll("_"," ")} · {new Date(test.created_at).toLocaleString()}</summary>
          <p className="mt-2 text-sm">{counts.inbox} inbox · {counts.tabs} tabs/other · {counts.spam} spam · {counts.missing} missing · {counts.unknown} unknown/pending</p>
          <p className="text-xs">{test.messages.filter(m=>m.send_status === "accepted").length} sender accepted of {test.messages.length} test copies. Acceptance alone is not confirmed delivery.</p>
          {(!test.current || test.stale) && <p className="mt-2 text-sm font-semibold text-amber-800">{!test.current ? "The saved email has changed; this report does not test the current version." : "This test is more than seven days old. Placement may have changed."}</p>}
          {test.error && <p className="mt-2 text-sm text-red-700">{test.error}</p>}
          <ul className="mt-2 space-y-1 text-xs">{test.messages.map(m=><li key={m.email}>{m.email}: {m.placement} ({m.send_status.replaceAll("_"," ")}){m.authentication && ` · SPF ${m.authentication.spf}, DKIM ${m.authentication.dkim}, DMARC ${m.authentication.dmarc}`}</li>)}</ul>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={mutate.isPending || test.status === "cancelled"} onClick={()=>mutate.mutate({action:"refresh",id:test.id})}>Refresh results</Button>
            {["creating","queued","awaiting_placement"].includes(test.status) && <Button type="button" variant="outline" size="sm" disabled={mutate.isPending} onClick={()=>mutate.mutate({action:"cancel",id:test.id})}>Stop remaining copies</Button>}
          </div>
        </details>;
      })}
    </div>
    <p className="mt-3 text-xs">These are observations from selected test mailboxes, not a guarantee or a spam probability for every recipient. A clean content check or inbox result does not automatically clear domain warnings or resume sending.</p>
  </section>;
}
