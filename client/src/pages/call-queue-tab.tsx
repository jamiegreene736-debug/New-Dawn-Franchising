import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatPhone } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Clock,
  Headphones,
  Loader2,
  Mail,
  Phone,
  PhoneCall,
  RefreshCw,
  Send,
  User,
} from "lucide-react";

type QueueItem = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  timezone?: string | null;
  track: string;
  triggerType: string;
  triggerAt: string;
  triggerLabel?: string | null;
  emailSubject?: string | null;
  priority: number;
  status: string;
  attemptCount: number;
  lastAttemptAt?: string | null;
  nextAttemptAt?: string | null;
  phoneCallId?: string | null;
  outcomeNotes?: string | null;
  calendlyUrlSentAt?: string | null;
  meetingId?: string | null;
};

type QueueDetail = QueueItem & {
  attempts: Array<{
    id: string;
    attemptedAt: string;
    outcome: string;
    notes?: string | null;
    durationSeconds?: number | null;
    phoneCallId?: string | null;
  }>;
  linkedCall?: {
    id: string;
    durationSeconds?: number | null;
    recordingUrl?: string | null;
    transcriptText?: string | null;
    aiSummary?: string | null;
    status?: string | null;
    openphoneCreatedAt?: string | null;
  } | null;
};

type Stats = {
  waiting: number;
  dials: number;
  connects: number;
  booked: number;
  notInterested: number;
  voicemail: number;
  noAnswer: number;
  calledToday: number;
  connectRate: number;
  bookRate: number;
};

const OUTCOMES: Array<{ id: string; label: string; needsNotes?: boolean }> = [
  { id: "booked", label: "Booked", needsNotes: true },
  { id: "callback", label: "Callback" },
  { id: "voicemail", label: "Voicemail" },
  { id: "no_answer", label: "No answer" },
  { id: "not_interested", label: "Not interested", needsNotes: true },
  { id: "wrong_number", label: "Wrong number" },
  { id: "dnc", label: "DNC" },
];

function telHref(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return `tel:${e164}`;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isGoodWindow(timezone?: string | null): { ok: boolean; label: string } {
  const tz = timezone || "America/New_York";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
      weekday: "short",
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const wd = parts.find((p) => p.type === "weekday")?.value || "";
    const weekend = wd === "Sat" || wd === "Sun";
    const ok = !weekend && hour >= 8 && hour < 18;
    return { ok, label: ok ? "Good to call now" : weekend ? "Weekend there" : "Outside their hours" };
  } catch {
    return { ok: true, label: "Check their hours" };
  }
}

function ScriptBlock({ track, name }: { track: string; name: string }) {
  const first = name.trim().split(/\s+/)[0] || "there";
  const investor = track !== "broker";
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Live answer</p>
        <p>
          {investor
            ? `“Hi ${first}, this is calling from New Dawn Franchising on behalf of Dylan Delaney. We emailed you about the E-2 director model — the $225k path where you oversee the business and a local team runs day to day. Have I caught you at an okay moment for 30 seconds?”`
            : `“Hi ${first}, this is calling from New Dawn Franchising, for Dylan Delaney. We sent you a note about referring E-2 clients into a turnkey franchise — commission when the visa clears, funds in escrow. Is now a bad time for 30 seconds?”`}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">If yes</p>
        <p>
          {investor
            ? "“Are you actively looking at a U.S. E-2 business this year, or still just researching?” Then offer two specific times for a 20-minute call with Dylan."
            : "“Do you currently see E-2 or treaty-investor clients who need a qualifying U.S. business?” Then offer two specific times for a 20-minute call with Dylan."}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Voicemail (~20s)</p>
        <p>
          {investor
            ? `“Hi ${first}, following up on Dylan’s note about the E-2 director model. If you want a short call with him, I can text his calendar. I’ll try you once more later this week.”`
            : `“Hi ${first}, following Dylan’s note on E-2 referral partners. If you have even one client a year who needs a qualifying business, he would like 20 minutes. I’ll email the calendar link.”`}
        </p>
      </div>
      <details className="rounded-lg border bg-muted/30 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          If they object
        </summary>
        <ul className="mt-2 space-y-2 text-sm">
          <li><span className="font-medium">Just looking:</span> “That’s why it’s a short call with Dylan — 20 minutes this week or next?”</li>
          <li><span className="font-medium">Send more info:</span> “I will. One question so I send the right thing — are you looking for yourself, or referring clients?”</li>
          <li><span className="font-medium">How did you get my number?:</span> “It’s the number on the outreach we emailed. Happy to stick to email — I can send Dylan’s calendar and leave you alone.”</li>
          <li><span className="font-medium">Not interested:</span> “Understood — I’ll take you off the call list.” Then mark Not interested or DNC.</li>
          <li><span className="font-medium">What’s the investment?:</span> “$225,000, funds in escrow until the visa. Dylan covers structure on the call. Can I put 20 minutes on his calendar?”</li>
        </ul>
      </details>
      <p className="text-xs text-muted-foreground">
        Do not mention opens or clicks. Do not pitch the FDD. You are booking Dylan, not closing.
      </p>
    </div>
  );
}

export default function CallQueueTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"today" | "history">("today");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery<QueueItem[]>({
    queryKey: ["/api/crm/call-queue", view],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/call-queue?view=${view}`);
      return res.json();
    },
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/crm/call-queue/stats"],
    queryFn: async () => (await apiRequest("GET", "/api/crm/call-queue/stats")).json(),
  });

  const { data: detail } = useQuery<QueueDetail>({
    queryKey: ["/api/crm/call-queue/item", selectedId],
    enabled: !!selectedId,
    queryFn: async () => (await apiRequest("GET", `/api/crm/call-queue/${selectedId}`)).json(),
  });

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].id);
    if (selectedId && items.length && !items.some((i) => i.id === selectedId)) {
      setSelectedId(items[0]?.id || null);
    }
  }, [items, selectedId]);

  useEffect(() => {
    setNotes(detail?.outcomeNotes || "");
  }, [detail?.id, detail?.outcomeNotes]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/crm/call-queue"] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/call-queue/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/call-queue/item"] });
  };

  const dialMut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/crm/call-queue/${id}/dial`),
    onSuccess: invalidate,
  });

  const outcomeMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/crm/call-queue/${id}`, { status, notes });
      return res.json();
    },
    onSuccess: (_item, vars) => {
      toast({ title: vars.status === "booked" ? "Meeting logged for Dylan" : "Outcome saved" });
      invalidate();
      const idx = items.findIndex((i) => i.id === vars.id);
      const next = items[idx + 1] || items[idx - 1] || null;
      if (view === "today" && next && next.id !== vars.id) setSelectedId(next.id);
    },
    onError: (err: any) => toast({ title: err.message || "Failed to save", variant: "destructive" }),
  });

  const smsMut = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/crm/call-queue/${id}/calendly-sms`),
    onSuccess: () => {
      toast({ title: "Calendly link texted" });
      invalidate();
    },
    onError: (err: any) => toast({ title: err.message || "SMS failed", variant: "destructive" }),
  });

  const backfillMut = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/crm/call-queue/backfill")).json() as Promise<{ clicks: number; opens: number; replies: number }>,
    onSuccess: (data) => {
      toast({ title: `Queued ${data.clicks} clicks, ${data.opens} engaged opens, ${data.replies} replies` });
      invalidate();
    },
    onError: (err: any) => toast({ title: err.message || "Backfill failed", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.name, i.email, i.phone, i.company, i.triggerLabel, i.emailSubject]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [items, search]);

  const selected = detail && detail.id === selectedId ? detail : items.find((i) => i.id === selectedId);
  const windowInfo = isGoodWindow(selected?.timezone);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Headphones className="size-5 text-[hsl(var(--primary))]" /> Call Queue
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Thailand setter queue — call people who clicked, replied, or opened 3+ times. Book Dylan. Do not pitch the FDD.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={view === "today" ? "default" : "outline"} size="sm" onClick={() => setView("today")}>
            Today
          </Button>
          <Button variant={view === "history" ? "default" : "outline"} size="sm" onClick={() => setView("history")}>
            History
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => backfillMut.mutate()}
            disabled={backfillMut.isPending}
          >
            {backfillMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Backfill signals
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: "Waiting", value: stats?.waiting ?? "—" },
          { label: "Dials today", value: stats?.dials ?? "—" },
          { label: "Connects", value: stats?.connects ?? "—" },
          { label: "Booked", value: stats?.booked ?? "—" },
          { label: "Connect %", value: stats ? `${stats.connectRate}%` : "—" },
          { label: "Book %", value: stats ? `${stats.bookRate}%` : "—" },
          { label: "Voicemail", value: stats?.voicemail ?? "—" },
          { label: "No answer", value: stats?.noAnswer ?? "—" },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-semibold mt-0.5">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-4 min-h-[640px]">
        <Card className="overflow-hidden flex flex-col">
          <div className="p-3 border-b">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
            />
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {isLoading && (
              <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading queue…
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">
                No one in this view. Click Backfill signals to pull existing clicks, 3+ opens, and unreplied replies.
              </div>
            )}
            {filtered.map((item) => {
              const win = isGoodWindow(item.timezone);
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left p-3 hover:bg-muted/50 ${active ? "bg-muted/70" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                      P{item.priority}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{item.triggerLabel || item.triggerType}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span>{timeAgo(item.triggerAt)}</span>
                    <span>·</span>
                    <span>{item.track}</span>
                    {win.ok && view === "today" && (
                      <>
                        <span>·</span>
                        <span className="text-green-700">{win.label}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          {!selected && <p className="text-sm text-muted-foreground">Select someone from the list.</p>}
          {selected && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <User className="size-5" /> {selected.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selected.company || "—"} · {selected.track === "broker" ? "Broker / attorney" : "Investor"} · {selected.status.replace(/_/g, " ")}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${windowInfo.ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>
                  {windowInfo.label}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <p className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" /> {formatPhone(selected.phone) || "No phone"}</p>
                <p className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" /> {selected.email || "—"}</p>
                <p className="flex items-center gap-2 sm:col-span-2">
                  <Clock className="size-4 text-muted-foreground" />
                  {selected.triggerLabel || selected.triggerType} · {timeAgo(selected.triggerAt)}
                  {selected.emailSubject ? ` · ${selected.emailSubject}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {telHref(selected.phone) ? (
                  <Button asChild className="gap-2">
                    <a
                      href={telHref(selected.phone)!}
                      onClick={() => dialMut.mutate(selected.id)}
                    >
                      <PhoneCall className="size-4" /> Call in Quo
                    </a>
                  </Button>
                ) : (
                  <Button disabled className="gap-2"><PhoneCall className="size-4" /> No phone</Button>
                )}
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!selected.phone || smsMut.isPending}
                  onClick={() => smsMut.mutate(selected.id)}
                >
                  {smsMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Text Calendly
                </Button>
                <Button variant="outline" className="gap-2" asChild>
                  <a href="https://calendly.com/dylan-newdawnfranchising" target="_blank" rel="noreferrer">
                    <Calendar className="size-4" /> Open Dylan’s calendar
                  </a>
                </Button>
              </div>
              {selected.calendlyUrlSentAt && (
                <p className="text-xs text-muted-foreground">Calendly SMS sent {timeAgo(selected.calendlyUrlSentAt)}</p>
              )}

              <ScriptBlock track={selected.track} name={selected.name} />

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes for Dylan</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="Interested, timeline this year, asked about escrow…"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {OUTCOMES.map((o) => (
                  <Button
                    key={o.id}
                    size="sm"
                    variant={o.id === "booked" ? "default" : "outline"}
                    disabled={outcomeMut.isPending || (o.needsNotes && !notes.trim())}
                    onClick={() => outcomeMut.mutate({ id: selected.id, status: o.id })}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Booked and Not interested need a note. Max 3 attempts, then they drop off Today.</p>

              {detail?.linkedCall && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Quo call</p>
                  <p className="text-sm">
                    {detail.linkedCall.durationSeconds ? `${Math.floor(detail.linkedCall.durationSeconds / 60)}:${String(detail.linkedCall.durationSeconds % 60).padStart(2, "0")}` : "—"}
                    {detail.linkedCall.status ? ` · ${detail.linkedCall.status}` : ""}
                  </p>
                  {detail.linkedCall.aiSummary && <p className="text-sm">{detail.linkedCall.aiSummary}</p>}
                  {detail.linkedCall.recordingUrl && (
                    <audio controls className="w-full" src={detail.linkedCall.recordingUrl} />
                  )}
                </div>
              )}

              {detail?.attempts?.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Attempts</p>
                  <ul className="space-y-1 text-sm">
                    {detail.attempts.map((a) => (
                      <li key={a.id} className="flex justify-between gap-3">
                        <span>{a.outcome.replace(/_/g, " ")}{a.notes ? ` — ${a.notes}` : ""}</span>
                        <span className="text-muted-foreground shrink-0">{timeAgo(a.attemptedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
