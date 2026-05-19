import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/utils";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Play,
  Mic,
  MicOff,
  User,
  Link2,
  Clock,
  BarChart2,
  Search,
  Loader2,
  Voicemail,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface PhoneCall {
  id: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  durationSeconds?: number | null;
  callerName?: string | null;
  recordingUrl?: string | null;
  recordingId?: string | null;
  transcriptText?: string | null;
  aiSummary?: string | null;
  voicemailUrl?: string | null;
  voicemailTranscript?: string | null;
  crmClientId?: string | null;
  openphoneCreatedAt?: string | null;
  syncedAt: string;
}

interface CrmClientOption {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function statusInfo(status: string, direction: string) {
  if (status === "missed" || status === "no-answer")
    return { label: "Missed", color: "text-red-600 bg-red-50", Icon: PhoneMissed };
  if (status === "voicemail")
    return { label: "Voicemail", color: "text-amber-600 bg-amber-50", Icon: Voicemail };
  if (status === "completed")
    return {
      label: direction === "inbound" ? "Answered" : "Outbound",
      color: direction === "inbound" ? "text-green-700 bg-green-50" : "text-blue-700 bg-blue-50",
      Icon: direction === "inbound" ? PhoneIncoming : PhoneOutgoing,
    };
  return { label: status, color: "text-gray-600 bg-gray-100", Icon: Phone };
}

function CallRow({
  call,
  clients,
  onLink,
  onRefetchCalls,
}: {
  call: PhoneCall;
  clients: CrmClientOption[];
  onLink: (callId: string, clientId: string) => void;
  onRefetchCalls: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { status, direction } = call;
  const info = statusInfo(status, direction);
  const Icon = info.Icon;

  const callerNum = direction === "inbound" ? call.fromNumber : call.toNumber;
  const displayName = call.callerName || formatPhone(callerNum) || callerNum;

  const linkedClient = clients.find((c) => c.id === call.crmClientId);
  const filteredClients = clients.filter(
    (c) =>
      search === "" ||
      c.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search))
  );

  return (
    <div className={`rounded-xl border bg-white transition-shadow ${expanded ? "shadow-md" : "hover:shadow-sm"}`}>
      {/* ── Collapsed row ── */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Icon */}
        <div className={`shrink-0 size-9 rounded-full flex items-center justify-center ${info.color}`}>
          <Icon className="size-4" />
        </div>

        {/* Name + number */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{displayName}</span>
            {linkedClient && (
              <span className="text-[10px] bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium truncate max-w-[120px]">
                {linkedClient.fullName}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatPhone(callerNum)}
          </div>
        </div>

        {/* Status badge */}
        <span className={`hidden sm:inline-flex shrink-0 items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${info.color}`}>
          {info.label}
        </span>

        {/* Duration */}
        <div className="shrink-0 text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" />
          {formatDuration(call.durationSeconds)}
        </div>

        {/* Date */}
        <div className="shrink-0 text-xs text-muted-foreground hidden md:block">
          {call.openphoneCreatedAt
            ? new Date(call.openphoneCreatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "—"}
        </div>

        {/* Chevron */}
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground font-medium mb-0.5">Direction</div>
              <div className="capitalize font-semibold">{direction}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-medium mb-0.5">Status</div>
              <div className="font-semibold">{info.label}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-medium mb-0.5">Duration</div>
              <div className="font-semibold">{formatDuration(call.durationSeconds)}</div>
            </div>
            <div>
              <div className="text-muted-foreground font-medium mb-0.5">Time</div>
              <div className="font-semibold">
                {call.openphoneCreatedAt
                  ? new Date(call.openphoneCreatedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "Unknown"}
              </div>
            </div>
          </div>

          {/* Recording */}
          {call.recordingUrl && (
            <div className="rounded-lg bg-gray-50 border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Play className="size-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">Call Recording</span>
              </div>
              <audio
                controls
                src={call.recordingUrl}
                className="w-full h-9"
                style={{ colorScheme: "light" }}
              />
            </div>
          )}

          {/* Voicemail */}
          {call.voicemailUrl && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Voicemail className="size-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">Voicemail</span>
              </div>
              <audio
                controls
                src={call.voicemailUrl}
                className="w-full h-9"
                style={{ colorScheme: "light" }}
              />
              {call.voicemailTranscript && (
                <p className="text-xs text-amber-800 mt-2 leading-relaxed italic">
                  "{call.voicemailTranscript}"
                </p>
              )}
            </div>
          )}

          {/* AI Summary */}
          {call.aiSummary && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-indigo-700">✦ AI Call Summary</span>
              </div>
              <p className="text-xs text-indigo-900 leading-relaxed">{call.aiSummary}</p>
            </div>
          )}

          {/* Transcript */}
          {call.transcriptText && !call.aiSummary && (
            <div className="rounded-lg bg-gray-50 border p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Mic className="size-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600">Transcript</span>
              </div>
              <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                {call.transcriptText}
              </pre>
            </div>
          )}

          {/* No audio/transcript */}
          {!call.recordingUrl && !call.voicemailUrl && !call.transcriptText && !call.aiSummary && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MicOff className="size-3.5" />
              No recording or transcript available for this call.
            </div>
          )}

          {/* CRM Link */}
          <div className="border-t pt-3">
            {linkedClient ? (
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="size-3.5 text-green-600" />
                <span className="text-green-700 font-medium">Linked to CRM:</span>
                <span className="font-semibold">{linkedClient.fullName}</span>
                <button
                  className="ml-2 text-muted-foreground underline hover:text-foreground"
                  onClick={() => { setLinkMode(!linkMode); setSearch(""); }}
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                onClick={() => { setLinkMode(!linkMode); setSearch(""); }}
              >
                <Link2 className="size-3.5" />
                Link to CRM client
              </button>
            )}

            {linkMode && (
              <div className="mt-2 rounded-lg border bg-white p-3 shadow-sm space-y-2 max-w-sm">
                <Input
                  placeholder="Search client…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs"
                  autoFocus
                />
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredClients.slice(0, 20).map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-indigo-50 hover:text-indigo-800 transition-colors"
                      onClick={() => {
                        onLink(call.id, c.id);
                        setLinkMode(false);
                        setSearch("");
                      }}
                    >
                      <span className="font-semibold">{c.fullName}</span>
                      <span className="text-muted-foreground ml-1">· {c.email}</span>
                    </button>
                  ))}
                  {filteredClients.length === 0 && (
                    <div className="text-xs text-muted-foreground px-2">No clients match</div>
                  )}
                </div>
                <button
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setLinkMode(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PhoneCallsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterDir, setFilterDir] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: calls = [], isLoading, refetch } = useQuery<PhoneCall[]>({
    queryKey: ["/api/crm/phone-calls"],
    queryFn: async () => (await apiRequest("GET", "/api/crm/phone-calls")).json(),
  });

  const { data: clients = [] } = useQuery<CrmClientOption[]>({
    queryKey: ["/api/crm/clients"],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crm/phone-calls/sync", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/phone-calls"] });
      toast({ title: `Synced ${data.synced} call${data.synced !== 1 ? "s" : ""} from OpenPhone` });
    },
    onError: () => toast({ title: "Sync failed", variant: "destructive" }),
  });

  const linkMutation = useMutation({
    mutationFn: async ({ callId, clientId }: { callId: string; clientId: string }) => {
      const res = await apiRequest("PATCH", `/api/crm/phone-calls/${callId}`, { crmClientId: clientId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/phone-calls"] });
      toast({ title: "Call linked to CRM client and logged in their timeline" });
    },
    onError: () => toast({ title: "Failed to link call", variant: "destructive" }),
  });

  const filtered = calls.filter((c) => {
    if (filterDir !== "all" && c.direction !== filterDir) return false;
    if (filterStatus === "answered" && c.status !== "completed") return false;
    if (filterStatus === "missed" && !["missed", "no-answer"].includes(c.status)) return false;
    if (filterStatus === "voicemail" && c.status !== "voicemail") return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (
        !(c.callerName?.toLowerCase().includes(q) ||
          c.fromNumber.includes(q) ||
          c.toNumber.includes(q))
      )
        return false;
    }
    return true;
  });

  // Stats
  const totalCalls = calls.length;
  const inbound = calls.filter((c) => c.direction === "inbound").length;
  const outbound = calls.filter((c) => c.direction === "outbound").length;
  const missed = calls.filter((c) => ["missed", "no-answer"].includes(c.status)).length;
  const answered = calls.filter((c) => c.status === "completed").length;
  const totalSecs = calls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
  const totalMins = Math.floor(totalSecs / 60);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Phone className="size-5 text-[hsl(var(--primary))]" /> Phone Calls
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Call log for (346) 597-9994 — synced from OpenPhone
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="gap-2 shrink-0"
        >
          {syncMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {syncMutation.isPending ? "Syncing…" : "Sync Calls"}
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Calls", value: totalCalls, icon: <Phone className="size-4" />, color: "text-gray-700" },
          { label: "Inbound", value: inbound, icon: <PhoneIncoming className="size-4" />, color: "text-green-700" },
          { label: "Outbound", value: outbound, icon: <PhoneOutgoing className="size-4" />, color: "text-blue-700" },
          { label: "Missed", value: missed, icon: <PhoneMissed className="size-4" />, color: "text-red-600" },
          { label: "Answered", value: answered, icon: <CheckCircle2 className="size-4" />, color: "text-green-700" },
          { label: "Talk Time", value: `${totalMins}m`, icon: <Clock className="size-4" />, color: "text-indigo-700" },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <div className={`flex items-center gap-1.5 text-xs text-muted-foreground mb-1`}>
              {s.icon} {s.label}
            </div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search caller…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs w-44"
          />
        </div>
        <select
          value={filterDir}
          onChange={(e) => setFilterDir(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 rounded-md border border-input bg-transparent px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All statuses</option>
          <option value="answered">Answered</option>
          <option value="missed">Missed</option>
          <option value="voicemail">Voicemail</option>
        </select>
        <span className="text-xs text-muted-foreground self-center">
          {filtered.length} of {totalCalls} calls
        </span>
      </div>

      {/* ── Call list ── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-16 rounded-xl border bg-white/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <Phone className="mx-auto size-10 text-muted-foreground/30 mb-3" />
          {calls.length === 0 ? (
            <>
              <p className="text-sm font-medium text-muted-foreground">No calls synced yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click <strong>Sync Calls</strong> to pull call history from OpenPhone.
              </p>
              <Button
                className="mt-4 gap-2"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                <RefreshCw className="size-4" /> Sync Now
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No calls match your filters.</p>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((call) => (
            <CallRow
              key={call.id}
              call={call}
              clients={clients}
              onLink={(callId, clientId) => linkMutation.mutate({ callId, clientId })}
              onRefetchCalls={() => refetch()}
            />
          ))}
        </div>
      )}

      {/* ── OpenPhone webhook tip ── */}
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Real-time inbound call logging:</strong> To log calls automatically as they come in, add this webhook URL in your OpenPhone account settings:<br />
        <code className="mt-1 block bg-white border rounded px-2 py-1 text-[11px] font-mono select-all">
          {window.location.origin}/api/webhooks/openphone
        </code>
        Set it to trigger on <code>call.completed</code>, <code>call.ringing</code>, and <code>call.missed</code> events. Once set, every call will auto-appear here and be logged in the caller's CRM record if their number is on file.
      </div>
    </div>
  );
}
