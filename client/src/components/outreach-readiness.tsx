import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Review = {
  id: string; email: string; name: string; audience: string; issue: string | null;
  source_url: string | null; reason: string | null; role: string | null; firm_domain: string | null;
};
export function OutreachReadiness({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryKey = [`/api/crm/campaigns/${campaignId}/readiness`];
  const { data, isLoading, isError } = useQuery<Review[]>({ queryKey, enabled: open });
  async function save(status: "approved" | "rejected") {
    if (!selected) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/crm/outreach/qualification", {
        email: selected.email, status, audience: selected.audience || "broker",
        sourceUrl: selected.source_url, reason: selected.reason, role: selected.role, firmDomain: selected.firm_domain,
      });
      await queryClient.invalidateQueries({ queryKey });
      setSelected(null);
      toast({ title: "Qualification saved", description: "This does not activate the campaign or send an email." });
    } catch (e) { toast({ title: "Could not save", description: e instanceof Error ? e.message : "Try again", variant: "destructive" }); }
    finally { setSaving(false); }
  }
  return <section className="border rounded-lg p-4 mb-5" aria-label="Outreach readiness">
    <Button variant="outline" onClick={() => setOpen(!open)}>{open ? "Hide" : "Review"} recipient readiness</Button>
    {open && <div className="mt-3 space-y-3">
      <p className="text-sm text-muted-foreground">Verify the person's current role and a specific U.S. E-2 or buyer-placement practice. Category labels and directory scores are insufficient. For investors, document their expressed interest. Reviews expire after 30 days.</p>
      {isLoading && <p>Loading recipients…</p>}
      {isError && <p role="alert">Readiness could not be loaded. Sending remains subject to checks.</p>}
      <div className="max-h-80 overflow-y-auto">{data?.map(row => <div key={row.id} className="flex gap-3 justify-between border-b py-3">
        <div><p className="font-medium">{row.name}</p><p className="text-sm break-all">{row.email}</p><p className="text-sm text-muted-foreground">{row.issue || "Qualification and address checks current; campaign controls still apply."}</p></div>
        <Button size="sm" variant="outline" onClick={() => setSelected(row)}>Review</Button>
      </div>)}</div>
      {selected && <form className="space-y-3 border rounded p-3" onSubmit={e => { e.preventDefault(); void save("approved"); }}>
        <p className="font-medium">Review {selected.name}</p>
        {([['source_url', 'Current public practice or permission source URL'], ['role', 'Verified current role'], ['firm_domain', 'Firm domain (example.com)'], ['reason', 'Specific, factual opening line explaining why this person is relevant']] as const).map(([key, label]) => <label key={key} className="block text-sm">{label}<Input required value={selected[key] || ""} onChange={e => setSelected({ ...selected, [key]: e.target.value })} /></label>)}
        <div className="flex gap-2"><Button disabled={saving} type="submit">Save qualified</Button><Button disabled={saving} type="button" variant="outline" onClick={() => void save("rejected")}>Save unsuitable</Button><Button type="button" variant="ghost" onClick={() => setSelected(null)}>Cancel</Button></div>
      </form>}
    </div>}
  </section>;
}
