import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, Loader2, UserPlus, Check, Linkedin, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AgentPerson {
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  location: string | null;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  people?: AgentPerson[];
}

const SUGGESTIONS = [
  "Find immigration attorneys in the US who work with international investors",
  "Build a list of business owners in the UK exploring US investment",
  "Who should I target for the E-2 franchise? Analyze our ICP",
  "Find investors in Japan and South Korea, titles CEO or Owner",
];

export default function LeadResearchAgent({ provider }: { provider?: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hi — I'm your Lead Research assistant. Describe who you want to reach and I'll build the list, analyze your ideal customer profile, or draft outreach. What are we looking for?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const history: ChatMsg[] = [...messages, { role: "user", content: msg }];
    setMessages(history);
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/crm/lead-research/agent", {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        provider,
      });
      const data = await res.json() as { reply: string; people?: AgentPerson[] };
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "Done.", people: data.people || [] }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry — I couldn't reach the AI service. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function addToContacts(p: AgentPerson) {
    const key = (p.email || p.fullName).toLowerCase();
    try {
      await apiRequest("POST", "/api/crm/prospects/add-to-contacts", {
        contact: {
          fullName: p.fullName, firstName: p.firstName, lastName: p.lastName,
          companyName: p.companyName || "", email: p.email, phone: p.phone,
          linkedinUrl: p.linkedinUrl, jobTitle: p.jobTitle, bio: null,
          decisionMakerScore: 0, e2ViaBio: false, internationalBio: false,
        },
        category: "ai_research",
      });
      setAdded((s) => new Set(s).add(key));
      toast({ title: "Added to Contacts", description: p.fullName });
    } catch (err: any) {
      const m = String(err?.message || "");
      if (m.includes("already exists")) {
        setAdded((s) => new Set(s).add(key));
        toast({ title: "Already in Contacts", description: p.fullName });
      } else {
        toast({ title: "Couldn't add contact", description: p.fullName, variant: "destructive" });
      }
    }
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-gradient-to-r from-[hsl(var(--primary))]/10 to-purple-500/10 px-4 py-3">
        <Sparkles className="size-4 text-[hsl(var(--primary))]" />
        <div>
          <p className="text-sm font-semibold leading-tight">AI Lead Research</p>
          <p className="text-[11px] text-muted-foreground">Build lists, analyze your ICP, and draft outreach — just ask.</p>
        </div>
      </div>

      <div ref={scrollRef} className="max-h-[420px] overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user" ? "bg-[hsl(var(--primary))] text-white" : "bg-muted text-foreground"}`}>
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              {m.people && m.people.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {m.people.map((p, j) => {
                    const key = (p.email || p.fullName).toLowerCase();
                    const isAdded = added.has(key);
                    return (
                      <div key={j} className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{p.fullName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {[p.jobTitle, p.companyName].filter(Boolean).join(" · ") || p.location || "—"}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            {p.email && <span className="inline-flex items-center gap-0.5"><Mail className="size-2.5" />{p.email}</span>}
                            {p.phone && <span className="inline-flex items-center gap-0.5"><Phone className="size-2.5" />{p.phone}</span>}
                            {p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"><Linkedin className="size-2.5" />in</a>}
                          </div>
                        </div>
                        <Button size="sm" variant={isAdded ? "outline" : "default"} className="h-7 shrink-0 gap-1 px-2 text-[11px]" disabled={isAdded} onClick={() => addToContacts(p)}>
                          {isAdded ? <><Check className="size-3" /> Added</> : <><UserPlus className="size-3" /> Add</>}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> Working on it…</span>
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-input px-2.5 py-1 text-[11px] text-muted-foreground hover:border-[hsl(var(--primary))] hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 border-t p-3">
        <textarea
          data-testid="input-lead-agent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Describe who you want to reach…"
          className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button size="sm" className="h-9 gap-1.5" disabled={!input.trim() || loading} onClick={() => send()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
