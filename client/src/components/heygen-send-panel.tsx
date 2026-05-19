import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Play, RotateCcw, Send, Loader2, CheckCircle2, Video, AlertTriangle,
  Mail, MessageSquare, FileText, ChevronRight, ChevronLeft, Clock,
  ExternalLink, Bookmark, RefreshCw, Info, Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;
type Channel = "email" | "sms" | "whatsapp";

interface Lead {
  id: string; firstName: string; lastName: string; email?: string | null;
  phone?: string | null; country?: string | null; aiScore?: number;
  sequenceStage?: number; researchDossier?: any;
}

interface HeygenVideo {
  id: string; status: string; videoUrl?: string | null; thumbnailUrl?: string | null;
  deliveryStatus: string; deliveryChannel?: string | null; sentAt?: string | null;
  clickedAt?: string | null; renderDurationSec?: number | null; script: string;
  subjectLine?: string | null; leadName?: string | null; createdAt: string;
  errorMessage?: string | null;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json as T;
}
async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json as T;
}
async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json;
  return json as T;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const CHANNEL_CFG = {
  email:    { Icon: Mail,           label: "Email",    color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  sms:      { Icon: FileText,       label: "SMS",      color: "text-blue-600",   bg: "bg-blue-50 border-blue-200"     },
  whatsapp: { Icon: MessageSquare,  label: "WhatsApp", color: "text-green-600",  bg: "bg-green-50 border-green-200"   },
};

function wordCount(s: string) { return s.trim().split(/\s+/).filter(Boolean).length; }
function estimatedDuration(s: string) { return Math.round(wordCount(s) / 130 * 60); }

function countdown(startedAt: Date, estimatedSecs: number) {
  const elapsed = (Date.now() - startedAt.getTime()) / 1000;
  const remaining = Math.max(0, estimatedSecs - elapsed);
  if (remaining === 0) return "finishing up…";
  if (remaining < 60) return `~${Math.round(remaining)}s remaining`;
  return `~${Math.ceil(remaining / 60)}m remaining`;
}

// ─── Channel Selector ─────────────────────────────────────────────────────────

function ChannelSelector({ value, onChange, recommended, lead }: {
  value: Channel; onChange: (c: Channel) => void; recommended: Channel; lead: Lead;
}) {
  const channels: Channel[] = ["email", "sms", "whatsapp"];
  return (
    <div className="space-y-2">
      {channels.map(ch => {
        const cfg = CHANNEL_CFG[ch];
        const isRec = ch === recommended;
        const active = ch === value;
        const details = { email: lead.email, sms: lead.phone, whatsapp: lead.phone };
        return (
          <button key={ch} onClick={() => onChange(ch)}
            className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${active ? cfg.bg + " border-2" : "border-gray-200 hover:border-gray-300"}`}>
            <cfg.Icon className={`size-5 ${active ? cfg.color : "text-gray-400"}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm ${active ? cfg.color : "text-gray-700"}`}>{cfg.label}</span>
                {isRec && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Recommended</span>}
              </div>
              <p className="text-xs text-gray-400">{details[ch] ?? "No contact info"}</p>
            </div>
            <div className={`size-4 rounded-full border-2 flex-shrink-0 ${active ? `${cfg.color.replace("text", "bg").replace("-600", "-500")} border-transparent` : "border-gray-300"}`} />
          </button>
        );
      })}
    </div>
  );
}

// ─── Rendering Progress ───────────────────────────────────────────────────────

function RenderingProgress({ videoId, onComplete }: { videoId: string; onComplete: (video: HeygenVideo) => void }) {
  const startedAt = useRef(new Date());
  const [elapsed, setElapsed] = useState(0);
  const ESTIMATED = 180; // 3 min estimate for real HeyGen; 3s in demo

  const { data: video, refetch } = useQuery<HeygenVideo>({
    queryKey: ["heygen-video-status", videoId],
    queryFn: () => apiGet(`/api/heygen/videos/${videoId}/status`),
    refetchInterval: 3000,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(e => e + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (video?.status === "completed") onComplete(video);
  }, [video?.status]);

  const pct = Math.min(95, (elapsed / ESTIMATED) * 100);
  const isFailed = video?.status === "failed";
  const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <div className="flex flex-col items-center py-8 px-4 text-center">
      {isFailed ? (
        <>
          <div className="size-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle className="size-8 text-red-500" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">Rendering Failed</h3>
          <p className="text-sm text-gray-400">{video?.errorMessage ?? "HeyGen encountered an error."}</p>
        </>
      ) : (
        <>
          <div className="relative size-20 mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 animate-spin border-t-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Video className="size-7 text-indigo-500" />
            </div>
          </div>
          <h3 className="font-bold text-gray-900 mb-1">Rendering your video…</h3>
          <p className="text-sm text-indigo-500 font-medium mb-4">{countdown(startedAt.current, ESTIMATED)}</p>
          <div className="w-full max-w-xs">
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>{elapsedStr} elapsed</span>
              <span>Usually 2-3 min</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">HeyGen is rendering the AI video.<br/>You'll be able to preview it before sending.</p>
        </>
      )}
    </div>
  );
}

// ─── Video Preview Player ─────────────────────────────────────────────────────

function VideoPreview({ video, channel, onSend, onQueue, onDiscard }: {
  video: HeygenVideo; channel: Channel; onSend: () => void; onQueue: () => void; onDiscard: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const cfg = CHANNEL_CFG[channel];
  const est = video.renderDurationSec ? `${video.renderDurationSec}s render time` : "HeyGen rendered";

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend();
      setSent(true);
    } catch (e: any) {
      alert(e?.error ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="size-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="size-8 text-green-500" />
        </div>
        <h3 className="font-bold text-green-800 text-lg mb-1">Video sent!</h3>
        <p className="text-sm text-gray-500">Logged to the lead's activity timeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video thumbnail / player */}
      {video.thumbnailUrl || video.videoUrl ? (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video group">
          {video.thumbnailUrl && (
            <img src={video.thumbnailUrl} alt="Video thumbnail" className="w-full h-full object-cover" />
          )}
          <a href={video.videoUrl ?? "#"} target="_blank" rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
            <div className="size-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="size-6 text-gray-900 ml-1" />
            </div>
          </a>
          <div className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded">{est}</div>
        </div>
      ) : (
        <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
          <Video className="size-12 text-gray-300" />
        </div>
      )}
      {video.videoUrl && (
        <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-indigo-500 hover:underline">
          <ExternalLink className="size-3" /> Open full video in HeyGen
        </a>
      )}

      {/* Channel info */}
      <div className={`flex items-center gap-3 rounded-xl border p-3 ${cfg.bg}`}>
        <cfg.Icon className={`size-5 ${cfg.color} shrink-0`} />
        <div>
          <p className="text-xs font-semibold text-gray-700">Sending via {cfg.label}</p>
          <p className="text-xs text-gray-400">{channel === "email" ? video.leadName : ""}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2" onClick={handleSend} disabled={sending}>
          {sending ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : <><Send className="size-4" /> Approve & Send Now</>}
        </Button>
        <Button variant="outline" className="w-full gap-2" onClick={onQueue}>
          <Clock className="size-4" /> Add to Tomorrow's Brief
        </Button>
        <Button variant="ghost" className="w-full text-gray-400 hover:text-red-500" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </div>
  );
}

// ─── Existing Videos Section ──────────────────────────────────────────────────

export function LeadVideosSection({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const { data: videos = [], isLoading } = useQuery<HeygenVideo[]>({
    queryKey: ["heygen-lead-videos", lead.id],
    queryFn: () => apiGet(`/api/heygen/leads/${lead.id}/videos`),
    staleTime: 10000,
  });

  const resendMut = useMutation({
    mutationFn: (id: string) => apiPost(`/api/heygen/videos/${id}/resend`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["heygen-lead-videos", lead.id] }),
  });

  const saveTemplateMut = useMutation({
    mutationFn: ({ id, label }: { id: string; label: string }) =>
      apiPost(`/api/heygen/videos/${id}/save-template`, { label }),
  });

  if (isLoading) return <div className="h-12 animate-pulse bg-gray-100 rounded-lg" />;
  if (!videos.length) return <p className="text-sm text-gray-400">No videos sent yet.</p>;

  const DELIVERY_COLORS: Record<string, string> = {
    not_sent: "bg-gray-100 text-gray-500",
    sent:     "bg-blue-100 text-blue-700",
    clicked:  "bg-green-100 text-green-700",
    replied:  "bg-purple-100 text-purple-700",
  };
  const STATUS_COLORS: Record<string, string> = {
    rendering: "text-yellow-600", completed: "text-green-600",
    failed: "text-red-500", timed_out: "text-red-400", pending: "text-gray-500",
  };

  return (
    <div className="space-y-3">
      {videos.map(v => (
        <div key={v.id} className="rounded-xl border bg-white p-4">
          <div className="flex gap-3">
            {/* Thumbnail */}
            <div className="size-20 rounded-lg bg-gray-100 overflow-hidden shrink-0 relative">
              {v.thumbnailUrl ? (
                <img src={v.thumbnailUrl} alt="thumb" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Video className="size-6 text-gray-300" />
                </div>
              )}
              {v.videoUrl && (
                <a href={v.videoUrl} target="_blank" rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                  <Play className="size-5 text-white" />
                </a>
              )}
            </div>
            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className={`text-xs font-bold uppercase ${STATUS_COLORS[v.status] ?? "text-gray-500"}`}>
                  {v.status.replace("_", " ")}
                </span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${DELIVERY_COLORS[v.deliveryStatus] ?? DELIVERY_COLORS.not_sent}`}>
                  {v.deliveryStatus.replace("_", " ")}
                </span>
                {v.deliveryChannel && (
                  <span className="text-[10px] text-gray-400">via {v.deliveryChannel}</span>
                )}
              </div>
              {v.subjectLine && <p className="text-xs text-gray-600 font-medium truncate mb-0.5">{v.subjectLine}</p>}
              <p className="text-[11px] text-gray-400">
                {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                {v.clickedAt && " · ✅ Video clicked"}
                {v.sentAt && !v.clickedAt && " · Sent"}
              </p>
              {/* Script preview */}
              <details className="mt-1">
                <summary className="text-[11px] text-indigo-500 cursor-pointer select-none">View script</summary>
                <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2 whitespace-pre-wrap">{v.script}</p>
              </details>
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-2 mt-3 pt-3 border-t flex-wrap">
            {v.videoUrl && (
              <a href={v.videoUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="text-xs gap-1 h-7"><Play className="size-3" /> Watch</Button>
              </a>
            )}
            {v.status === "completed" && (
              <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => {
                if (confirm(`Resend this video to ${lead.firstName}?`)) resendMut.mutate(v.id);
              }}>
                <RefreshCw className="size-3" /> Resend
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-xs gap-1 h-7 text-gray-400" onClick={() => {
              const label = prompt("Template label:", `${v.deliveryChannel} — ${v.subjectLine ?? "video"}`);
              if (label) saveTemplateMut.mutate({ id: v.id, label });
            }}>
              <Bookmark className="size-3" /> Save as template
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Send Video Panel ────────────────────────────────────────────────────

export function HeygenSendPanel({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [script, setScript] = useState("");
  const [subjectLine, setSubjectLine] = useState("");
  const [channel, setChannel] = useState<Channel>("email");
  const [recommendedChannel, setRecommendedChannel] = useState<Channel>("email");
  const [generating, setGenerating] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [renderedVideo, setRenderedVideo] = useState<HeygenVideo | null>(null);
  const [touchType, setTouchType] = useState("first_contact");

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["heygen-templates"],
    queryFn: () => apiGet("/api/heygen/templates"),
  });

  // Auto-generate script on open
  useEffect(() => {
    generateScript();
  }, []);

  async function generateScript() {
    setGenerating(true);
    setScript("");
    try {
      const res = await apiPost<{ script: string; subjectLine: string; recommendedChannel: string }>(
        "/api/heygen/generate-script", { leadId: lead.id, touchType }
      );
      setScript(res.script);
      setSubjectLine(res.subjectLine);
      setChannel(res.recommendedChannel as Channel ?? "email");
      setRecommendedChannel(res.recommendedChannel as Channel ?? "email");
    } catch {
      setScript(`Hey ${lead.firstName}, I wanted to reach out personally with a quick message about what we're building at New Dawn Franchising. I think it could be really relevant to your situation. Would love to jump on a quick call — book a time at [CALENDLY LINK].`);
      setSubjectLine(`A personal message for ${lead.firstName} from New Dawn Franchising`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate() {
    try {
      const res = await apiPost<{ videoId: string; status: string }>("/api/heygen/generate", {
        leadId: lead.id, script, subjectLine, deliveryChannel: channel,
      });
      setVideoId(res.videoId);
      setStep(3);
    } catch (e: any) {
      alert(e?.error ?? "Failed to start video generation");
    }
  }

  async function handleSend() {
    if (!videoId) throw new Error("No video ID");
    await apiPost(`/api/heygen/videos/${videoId}/send`);
    qc.invalidateQueries({ queryKey: ["heygen-lead-videos", lead.id] });
  }

  const wc = wordCount(script);
  const dur = estimatedDuration(script);
  const wcColor = wc > 150 ? "text-red-500" : wc > 120 ? "text-amber-500" : "text-green-600";

  return (
    <div className="fixed inset-0 z-[60] flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-[480px] bg-white flex flex-col border-l shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b bg-gradient-to-r from-indigo-600 to-violet-700 text-white">
          <Video className="size-5 shrink-0" />
          <div className="flex-1">
            <h2 className="font-bold">Send AI Video</h2>
            <p className="text-indigo-300 text-xs">New Dawn Avatar · {lead.firstName} {lead.lastName}</p>
          </div>
          <button onClick={onClose}><X className="size-5 text-white/60 hover:text-white" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-5 py-3 border-b bg-gray-50 gap-2">
          {([1, 2, 3] as Step[]).map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`size-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"}`}>{s}</div>
              <span className={`text-xs font-medium ${step >= s ? "text-indigo-600" : "text-gray-400"}`}>
                {s === 1 ? "Script" : s === 2 ? "Channel" : "Preview & Send"}
              </span>
              {s < 3 && <ChevronRight className="size-3.5 text-gray-300" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Step 1: Script ── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Touch type selector */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Video Type</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "first_contact",   label: "First Contact"      },
                    { key: "touch3_no_reply", label: "Touch 3 (no reply)" },
                    { key: "post_consultation",label: "Post-consultation" },
                    { key: "re_engagement",   label: "Re-engagement"      },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => { setTouchType(opt.key); generateScript(); }}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${touchType === opt.key ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Or use template */}
              {templates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Use a Template</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {templates.map((t: any) => (
                      <button key={t.id} onClick={() => setScript(t.script)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border hover:border-indigo-200 hover:bg-indigo-50 text-left transition-colors">
                        <Bookmark className="size-3.5 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-700">{t.label}</span>
                        <span className="ml-auto text-[10px] text-gray-400">×{t.useCount}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Script editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Script</p>
                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-semibold ${wcColor}`}>{wc} words · ~{dur}s</span>
                    <button onClick={generateScript} disabled={generating}
                      className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 disabled:opacity-40">
                      {generating ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                      Regenerate
                    </button>
                  </div>
                </div>
                {generating ? (
                  <div className="min-h-[160px] rounded-xl border bg-gray-50 flex items-center justify-center">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="size-4 animate-spin text-indigo-400" /> Generating script…
                    </div>
                  </div>
                ) : (
                  <textarea value={script} onChange={e => setScript(e.target.value)}
                    className="w-full min-h-[160px] rounded-xl border bg-white px-4 py-3 text-sm text-gray-800 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 leading-relaxed"
                    placeholder="Script will appear here…" />
                )}
                {wc > 150 && <p className="text-[11px] text-red-500 mt-1">⚠️ Script too long — keep under 150 words for best quality</p>}
              </div>

              {/* Subject line */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email Subject Line</p>
                <input value={subjectLine} onChange={e => setSubjectLine(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="Used if sent via email" />
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <Info className="size-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">Replace [CALENDLY LINK] — it won't be spoken in the video. It will be inserted in the email or SMS wrapper message.</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Channel ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Choose Delivery Channel</h3>
                <p className="text-sm text-gray-500 mb-4">The video wrapper message will be personalised for {lead.firstName}.</p>
                <ChannelSelector value={channel} onChange={setChannel} recommended={recommendedChannel} lead={lead} />
              </div>
              <div className="rounded-xl bg-gray-50 border p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Script preview</p>
                <p className="text-sm text-gray-700 line-clamp-4 leading-relaxed">{script}</p>
                <p className="text-[11px] text-gray-400 mt-2">{wc} words · ~{dur} second video</p>
              </div>
            </div>
          )}

          {/* ── Step 3: Preview & Send ── */}
          {step === 3 && (
            <div>
              {!videoId && <p className="text-sm text-gray-500">Starting video generation…</p>}
              {videoId && !renderedVideo && (
                <RenderingProgress videoId={videoId} onComplete={v => setRenderedVideo(v)} />
              )}
              {renderedVideo && (
                <VideoPreview
                  video={renderedVideo}
                  channel={channel}
                  onSend={handleSend}
                  onQueue={() => { alert("Added to tomorrow's brief."); onClose(); }}
                  onDiscard={onClose}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step < 3 && (
          <div className="border-t p-4 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(s => (s - 1) as Step)} className="gap-2">
                <ChevronLeft className="size-4" /> Back
              </Button>
            ) : <div />}
            {step === 1 && (
              <Button onClick={() => setStep(2)} disabled={!script.trim() || generating} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                Use this script <ChevronRight className="size-4" />
              </Button>
            )}
            {step === 2 && (
              <Button onClick={handleGenerate} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
                <Video className="size-4" /> Generate Video
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
