import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Trash2, ExternalLink, Loader2, Target } from "lucide-react";
import { CrmLayout } from "@/components/crm-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Segment {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  lastUsedAt?: string | null;
  createdAt: string;
}

function filterSummary(filters: Record<string, unknown>): string {
  const parts: string[] = [];
  if (Array.isArray(filters.country) && filters.country.length) parts.push(filters.country.join(", "));
  if (Array.isArray(filters.status) && filters.status.length) parts.push(filters.status.join(", "));
  if (Array.isArray(filters.personaType) && filters.personaType.length) parts.push(filters.personaType.join(", "));
  if (typeof filters.minScore === "number") parts.push(`Score ≥ ${filters.minScore}`);
  if (typeof filters.maxScore === "number") parts.push(`Score ≤ ${filters.maxScore}`);
  if (Array.isArray(filters.source) && filters.source.length) parts.push(filters.source.join(", "));
  return parts.length ? parts.join(" · ") : "No filters";
}

function SegmentCount({ segId }: { segId: string }) {
  const { data, isLoading } = useQuery<{ count: number }>({
    queryKey: [`/api/segments/${segId}/count`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/segments/${segId}/count`);
      return res.json();
    },
    staleTime: 60_000,
  });
  if (isLoading) return <span className="text-xs text-muted-foreground">—</span>;
  return <span className="text-sm font-semibold">{data?.count ?? 0} contacts</span>;
}

export default function CrmSegmentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: segments = [], isLoading } = useQuery<Segment[]>({
    queryKey: ["/api/segments"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/segments");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/segments/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Segment deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/segments"] });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  function buildContactsLink(filters: Record<string, unknown>): string {
    const p = new URLSearchParams();
    if (Array.isArray(filters.status) && filters.status.length) p.set("status", filters.status.join(","));
    if (Array.isArray(filters.country) && filters.country.length) p.set("country", filters.country.join(","));
    if (Array.isArray(filters.personaType) && filters.personaType.length) p.set("personaType", filters.personaType.join(","));
    if (typeof filters.minScore === "number") p.set("minScore", String(filters.minScore));
    if (typeof filters.maxScore === "number") p.set("maxScore", String(filters.maxScore));
    return `/crm/contacts?${p.toString()}`;
  }

  return (
    <CrmLayout>
      <div className="p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Saved Segments</h1>
          <p className="text-sm text-muted-foreground">Save contact filter combinations for quick reuse</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : segments.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Target className="size-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">No saved segments yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Go to <Link href="/crm/contacts"><a className="text-[hsl(var(--primary))] hover:underline">Contacts</a></Link>, apply filters, then click "Save Segment".
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {segments.map((seg) => (
              <Card key={seg.id} data-testid={`segment-${seg.id}`} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{seg.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{filterSummary(seg.filters)}</p>
                    <div className="mt-2 flex items-center gap-4">
                      <SegmentCount segId={seg.id} />
                      {seg.lastUsedAt && (
                        <span className="text-xs text-muted-foreground">
                          Last used {new Date(seg.lastUsedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={buildContactsLink(seg.filters)}>
                      <a>
                        <Button size="sm" variant="outline" className="gap-1">
                          <ExternalLink className="size-3.5" /> View Contacts
                        </Button>
                      </a>
                    </Link>
                    <Button
                      data-testid={`button-delete-segment-${seg.id}`}
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        if (confirm("Delete this segment?")) deleteMutation.mutate(seg.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </CrmLayout>
  );
}
