import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Loader2, Mail, Phone, Linkedin, Building2, CheckCircle2, AlertTriangle } from "lucide-react";

interface EnrichmentStatus {
  seamless?: boolean;
  apollo?: boolean;
  origami?: boolean;
}

interface BulkEnrichResult {
  id: string;
  name?: string;
  found: boolean;
  filled: string[];
  sources: string[];
}

interface BulkSummary {
  processed: number;
  enriched: number;
  updated: number;
  fieldCounts: Record<string, number>;
}

const PROVIDERS: Array<{ id: keyof EnrichmentStatus; label: string }> = [
  { id: "seamless", label: "Seamless.AI" },
  { id: "apollo", label: "Apollo.io" },
  { id: "origami", label: "Origami" },
];

const FIELD_META: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "email", icon: Mail },
  phone: { label: "phone", icon: Phone },
  linkedin: { label: "LinkedIn", icon: Linkedin },
  company: { label: "company", icon: Building2 },
  title: { label: "job title", icon: Building2 },
  website: { label: "website", icon: Building2 },
  country: { label: "location", icon: Building2 },
  address: { label: "location", icon: Building2 },
};

const CHUNK_SIZE = 8;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Confirm + run bulk contact enrichment for a set of record ids.
 * Looks up email, phone, LinkedIn, job title, company and location via every
 * connected provider (Seamless.AI, Apollo.io, Origami) and fills only the empty
 * fields on each record. Large selections are sent in chunks with live progress.
 */
export function BulkEnrichDialog({
  open,
  onOpenChange,
  ids,
  endpoint,
  entityNoun,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ids: string[];
  endpoint: string;
  /** Singular noun for the records, e.g. "contact" or "client". */
  entityNoun: string;
  /** Called after a successful run so the parent can refresh + clear selection. */
  onComplete?: () => void;
}) {
  const [phase, setPhase] = useState<"confirm" | "running" | "done">("confirm");
  const [done, setDone] = useState(0);
  const [summary, setSummary] = useState<BulkSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: status } = useQuery<EnrichmentStatus>({
    queryKey: ["/api/crm/enrichment-status"],
  });

  // Reset to the confirm step whenever the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setDone(0);
      setSummary(null);
      setError(null);
    }
  }, [open]);

  const connected = PROVIDERS.filter((p) => status?.[p.id]);
  const anyConnected = connected.length > 0;
  const count = ids.length;
  const plural = count === 1 ? "" : "s";

  const run = async () => {
    setPhase("running");
    setDone(0);
    setError(null);
    const batches = chunk(ids, CHUNK_SIZE);
    const all: BulkEnrichResult[] = [];
    try {
      for (const batch of batches) {
        const res = await apiRequest("POST", endpoint, { ids: batch });
        const data = (await res.json()) as { results?: BulkEnrichResult[] };
        if (data.results) all.push(...data.results);
        setDone((d) => d + batch.length);
      }
      const fieldCounts: Record<string, number> = {};
      for (const r of all) for (const f of r.filled) fieldCounts[f] = (fieldCounts[f] || 0) + 1;
      setSummary({
        processed: all.length,
        enriched: all.filter((r) => r.found).length,
        updated: all.filter((r) => r.filled.length > 0).length,
        fieldCounts,
      });
      setPhase("done");
      onComplete?.();
    } catch (err: any) {
      setError(err?.message || "Enrichment failed");
      setPhase("done");
      onComplete?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (phase !== "running") onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-purple-600" />
            {phase === "done" ? "Enrichment complete" : `Enrich ${count} ${entityNoun}${plural}?`}
          </DialogTitle>
          {phase === "confirm" && (
            <DialogDescription className="space-y-3 pt-1">
              <span className="block">
                We'll look up the best <strong>email</strong>, <strong>phone</strong>,{" "}
                <strong>LinkedIn</strong>, job title, company and location for the {count} selected{" "}
                {entityNoun}{plural} using your connected providers. Only <strong>empty fields are filled</strong> —
                existing data is never overwritten. This may use provider credits.
              </span>
              <span className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Providers</span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {PROVIDERS.map((p) => {
                    const on = !!status?.[p.id];
                    return (
                      <span
                        key={p.id}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                          on ? "border-green-300 bg-green-50 text-green-700" : "border-muted bg-muted/40 text-muted-foreground line-through"
                        }`}
                      >
                        {p.label}
                      </span>
                    );
                  })}
                </span>
              </span>
              {!anyConnected && (
                <span className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  No enrichment provider is connected. Add SEAMLESS_API_KEY, APOLLO_API_KEY or ORIGAMI_API_KEY in Railway → Variables.
                </span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {phase === "running" && (
          <div className="space-y-2 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Enriching {done} of {count} {entityNoun}{plural}…
            </div>
            <Progress value={count > 0 ? (done / count) * 100 : 0} />
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-2 py-1 text-sm">
            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-red-700">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : summary ? (
              <>
                <div className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span>
                    Found data for <strong>{summary.enriched}</strong> of {summary.processed} ·{" "}
                    <strong>{summary.updated}</strong> updated
                  </span>
                </div>
                {Object.keys(summary.fieldCounts).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(summary.fieldCounts).map(([field, n]) => {
                      const meta = FIELD_META[field] || { label: field, icon: Building2 };
                      const Icon = meta.icon;
                      return (
                        <span key={field} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs">
                          <Icon className="size-3" /> {n} {meta.label}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No empty fields needed filling for the selection.</p>
                )}
              </>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {phase === "confirm" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                disabled={!anyConnected || count === 0}
                onClick={run}
              >
                <Sparkles className="size-3.5" /> Enrich {count}
              </Button>
            </>
          )}
          {phase === "running" && (
            <Button disabled className="gap-1.5">
              <Loader2 className="size-3.5 animate-spin" /> Enriching…
            </Button>
          )}
          {phase === "done" && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
