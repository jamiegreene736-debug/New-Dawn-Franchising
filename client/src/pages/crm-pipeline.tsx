import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Filter } from "lucide-react";
import { CrmLayout } from "@/components/crm-layout";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const PIPELINE_STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "responded", label: "Responded" },
  { key: "call_scheduled", label: "Call Scheduled" },
  { key: "active_partner", label: "Active Partner" },
  { key: "closed", label: "Closed" },
];

const COUNTRY_FLAGS: Record<string, string> = {
  mexico: "🇲🇽", colombia: "🇨🇴", brazil: "🇧🇷", uae: "🇦🇪",
  "united arab emirates": "🇦🇪", "saudi arabia": "🇸🇦",
  "south korea": "🇰🇷", taiwan: "🇹🇼", canada: "🇨🇦",
  israel: "🇮🇱", uk: "🇬🇧", "united kingdom": "🇬🇧",
  china: "🇨🇳", india: "🇮🇳", germany: "🇩🇪",
  france: "🇫🇷", spain: "🇪🇸", australia: "🇦🇺",
};

function countryFlag(country?: string | null) {
  if (!country) return "";
  return COUNTRY_FLAGS[country.toLowerCase()] || "🌍";
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-green-100 text-green-700" :
    score >= 50 ? "bg-amber-100 text-amber-700" :
    "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${color}`}>{score}</span>
  );
}

interface ContactData {
  id: string;
  firstName: string;
  lastName: string;
  firmName?: string | null;
  country?: string | null;
  leadScore: number;
  status: string;
}

interface DealWithContact {
  id: string;
  contactId: string;
  stage: string;
  movedAt: string;
  contact: ContactData | null;
}

export default function CrmPipelinePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const [filterPersona, setFilterPersona] = useState("");
  const [filterCountry, setFilterCountry] = useState("");

  const { data: deals = [], isLoading } = useQuery<DealWithContact[]>({
    queryKey: ["/api/pipeline"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/pipeline");
      return res.json();
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ contactId, stage }: { contactId: string; stage: string }) => {
      const res = await apiRequest("POST", "/api/pipeline", { contactId, stage });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline"] });
    },
    onError: () => toast({ title: "Move failed", variant: "destructive" }),
  });

  const filtered = deals.filter((d) => {
    if (!d.contact) return true;
    if (filterCountry && !(d.contact.country || "").toLowerCase().includes(filterCountry.toLowerCase())) return false;
    return true;
  });

  const byStage = (stage: string) => filtered.filter((d) => d.stage === stage);

  const onDragStart = (e: React.DragEvent, deal: DealWithContact) => {
    setDragging(deal.id);
    e.dataTransfer.setData("dealId", deal.id);
    e.dataTransfer.setData("contactId", deal.contactId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    const contactId = e.dataTransfer.getData("contactId");
    if (contactId) {
      moveMutation.mutate({ contactId, stage });
    }
    setDragging(null);
  };

  const onDragEnd = () => setDragging(null);

  return (
    <CrmLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pipeline</h1>
            <p className="text-sm text-muted-foreground">{deals.length} deal{deals.length !== 1 ? "s" : ""} in pipeline</p>
          </div>
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <input
              placeholder="Filter by country…"
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm w-44"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 480 }}>
            {PIPELINE_STAGES.map((stage) => {
              const stageDeals = byStage(stage.key);
              return (
                <div
                  key={stage.key}
                  className="flex-shrink-0 w-60 flex flex-col"
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, stage.key)}
                >
                  {/* Column header */}
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold">{stage.label}</h3>
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{stageDeals.length}</span>
                  </div>

                  {/* Column body */}
                  <div
                    className={`flex flex-col gap-2 flex-1 rounded-xl p-2 min-h-[200px] transition-colors ${
                      stageDeals.length === 0 ? "border-2 border-dashed border-muted" : "bg-muted/30"
                    }`}
                  >
                    {stageDeals.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center pt-6">Drop here</p>
                    )}
                    {stageDeals.map((deal) => {
                      if (!deal.contact) return null;
                      const contact = deal.contact;
                      const isDragging = dragging === deal.id;
                      return (
                        <div
                          key={deal.id}
                          data-testid={`pipeline-card-${deal.id}`}
                          draggable
                          onDragStart={(e) => onDragStart(e, deal)}
                          onDragEnd={onDragEnd}
                          className={`rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing shadow-sm transition-opacity ${
                            isDragging ? "opacity-40" : "opacity-100"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <Link href={`/crm/contacts/${contact.id}`}>
                              <a className="text-sm font-medium hover:text-[hsl(var(--primary))] hover:underline leading-tight">
                                {contact.firstName} {contact.lastName}
                              </a>
                            </Link>
                            <ScoreBadge score={contact.leadScore} />
                          </div>
                          {contact.firmName && (
                            <p className="text-xs text-muted-foreground mb-1 truncate">{contact.firmName}</p>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>{countryFlag(contact.country)}</span>
                            <span>{contact.country || "—"}</span>
                          </div>
                          <div className="mt-2 text-[10px] text-muted-foreground">
                            Moved {new Date(deal.movedAt).toLocaleDateString()}
                          </div>
                          <div className="mt-2 flex gap-1">
                            <Link href={`/crm/contacts/${contact.id}`}>
                              <a className="text-[10px] text-[hsl(var(--primary))] hover:underline">View</a>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CrmLayout>
  );
}
