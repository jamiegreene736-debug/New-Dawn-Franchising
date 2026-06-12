import { useState, useRef, useEffect } from "react";
import { formatPhone } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, ChevronRight, Download, ExternalLink, Globe, Loader2,
  MapPin, Phone, Search, Trash2, Mail, Linkedin, Star, Check, Info,
  Building2, Users, UserPlus, Bookmark, Eye, EyeOff, RefreshCw,
  PhoneCall, CheckCircle2, AlertCircle, Plus, ListPlus, FolderOpen, X, PhoneOff, Edit2, SlidersHorizontal, Tag, ShieldCheck,
  MessageCircle, Send, Sparkles,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import SeamlessSearchPanel, { type LeadFilters, EMPTY_FILTERS, countActiveFilters } from "@/components/seamless-search-panel";

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut",
  "Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa",
  "Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan",
  "Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio",
  "Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota",
  "Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia",
  "Wisconsin","Wyoming","District of Columbia",
];

const COUNTRIES = [
  "United States","Canada","United Kingdom","Germany","France","Brazil","Mexico",
  "Japan","South Korea","China","India","Australia","Israel","Turkey","Italy",
  "Spain","Netherlands","Sweden","Switzerland","United Arab Emirates","Saudi Arabia",
  "Colombia","Argentina","Chile","Peru","South Africa","Nigeria","Egypt","Thailand",
  "Vietnam","Philippines","Indonesia","Singapore","Hong Kong","Taiwan",
];

interface EnrichedContact {
  id: string;
  companyId: string;
  companyName: string;
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  seniority: string;
  email: string | null;
  emailVerified: boolean;
  emailConfidence: number;
  emailStatus: string;
  phone: string | null;
  phoneType: string | null;
  whatsappEligible?: boolean;
  linkedinUrl: string | null;
  bio: string | null;
  sources: string[];
  decisionMakerScore: number;
  scoreBreakdown: {
    titleScore: number; reachabilityScore: number; relevanceScore: number;
    total: number; tier: string; tierLabel: string; tierEmoji: string;
  };
  e2ViaBio: boolean;
  internationalBio: boolean;
  ailaNumber: boolean;
  address?: string | null;
  searchResultId?: string | null;
  revealed?: boolean;
  industries?: string[] | null;
  employeeSizeRange?: string | null;
}

interface EnrichedCompany {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  address: string | null;
  addressValidity?: "valid" | "partial" | "international" | "invalid" | "unknown";
  phone: string | null;
  googleRating: number | null;
  googleReviews: number | null;
  source: string;
  contacts: EnrichedContact[];
  enrichmentStatus: "complete" | "partial" | "no_contacts";
  searchCategory: string;
  searchLocation: string;
  description?: string | null;
}

interface SavedProspect {
  id: string; name: string; company: string | null; email: string | null;
  phone: string | null; website: string | null; address: string | null;
  category: string; location: string; source: string | null;
  sourceUrl: string | null; notes: string | null; createdAt: string;
}
interface EnrichmentStatus {
  seamless: boolean;
  hunter: boolean;
  zerobounce: boolean;
  proxycurl?: boolean;
  whitepages?: boolean;
  pdl?: boolean;
}

function ScoreBadge({ score, tier, tierEmoji, tierLabel }: {
  score: number; tier: string; tierEmoji: string; tierLabel: string;
}) {
  const palette: Record<string, { wrap: string; bar: string; track: string }> = {
    hot:         { wrap: "bg-green-50 text-green-800 border-green-200",  bar: "bg-green-500",  track: "bg-green-200"  },
    warm:        { wrap: "bg-yellow-50 text-yellow-800 border-yellow-200", bar: "bg-yellow-400", track: "bg-yellow-200" },
    cold:        { wrap: "bg-orange-50 text-orange-700 border-orange-200", bar: "bg-orange-400", track: "bg-orange-200" },
    unqualified: { wrap: "bg-gray-50 text-gray-500 border-gray-200",     bar: "bg-gray-300",   track: "bg-gray-200"   },
  };
  const c = palette[tier] || palette.unqualified;
  return (
    <div className={`inline-flex flex-col rounded-lg border px-2.5 pt-1.5 pb-1.5 text-xs font-semibold min-w-[110px] ${c.wrap}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1">{tierEmoji} <span className="hidden sm:inline">{tierLabel}</span></span>
        <span className="tabular-nums font-bold">{score}<span className="font-normal opacity-50">/100</span></span>
      </div>
      <div className={`mt-1.5 h-1 w-full rounded-full ${c.track}`}>
        <div className={`h-1 rounded-full transition-all ${c.bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function EmailStatusBadge({ status, verified }: { status: string; verified: boolean }) {
  if (status === "unverified" || status === "not_found" || status === "catch-all" || status === "unknown") return null;
  const config: Record<string, { label: string; className: string }> = {
    valid:   { label: "✓ Valid",   className: "bg-green-50 border-green-200 text-green-700" },
    invalid: { label: "✗ Invalid", className: "bg-red-50 border-red-200 text-red-700" },
  };
  const cfg = config[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function PhoneTypeBadge({ type }: { type: string | null }) {
  if (!type || type === "unverified") return null;
  const config: Record<string, { label: string; className: string }> = {
    mobile:   { label: "Mobile",   className: "bg-green-50 border-green-200 text-green-700" },
    landline: { label: "Landline", className: "bg-amber-50 border-amber-200 text-amber-700" },
    voip:     { label: "VoIP",     className: "bg-purple-50 border-purple-200 text-purple-700" },
    unknown:  { label: "Unknown",  className: "bg-gray-50 border-gray-200 text-gray-500" },
  };
  const cfg = config[type];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function AddressValidityBadge({ validity }: { validity?: string }) {
  if (!validity || validity === "unknown") return null;
  const config: Record<string, { label: string; className: string }> = {
    valid:         { label: "Address ✓",     className: "bg-green-50 border-green-200 text-green-700" },
    partial:       { label: "Address ~",     className: "bg-amber-50 border-amber-200 text-amber-700" },
    international: { label: "International", className: "bg-blue-50 border-blue-200 text-blue-700" },
    invalid:       { label: "Address ✗",     className: "bg-red-50 border-red-200 text-red-700" },
  };
  const cfg = config[validity];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}



type WaState = "idle" | "checking" | "confirmed" | "not_found" | "error" | "sent";

function ContactCard({
  contact,
  isSelected,
  onToggle,
  onSave,
  onAddToList,
  isSaving,
  isAddedToCrm,
  onReveal,
  isRevealing,
}: {
  contact: EnrichedContact;
  isSelected: boolean;
  onToggle: () => void;
  onSave: () => void;
  onAddToList: () => void;
  isSaving: boolean;
  isAddedToCrm?: boolean;
  onReveal?: () => void;
  isRevealing?: boolean;
}) {
  const [showBio, setShowBio] = useState(false);
  const [waState, setWaState] = useState<WaState>("idle");
  const [waMode, setWaMode] = useState<"template" | "freeform">("template");
  const [waMsg, setWaMsg] = useState("");
  const [waTemplateId, setWaTemplateId] = useState("wa_intro");
  const [phoneVerify, setPhoneVerify] = useState<{
    loading: boolean;
    result?: {
      valid: boolean; lineType?: string; carrier?: string;
      subscriberName?: string; nameMatches?: boolean; nameMatchScore?: number;
    };
  }>({ loading: false });
  const { toast } = useToast();
  const score = contact.scoreBreakdown;

  // Static template list (mirrors server/meta-whatsapp-service.ts WHATSAPP_TEMPLATES)
  const WA_TEMPLATES = [
    { id: "wa_intro",     label: "Cold intro",        metaName: "new_dawn_intro",     lang: "en_US", body: `Hi ${contact.firstName}, I'm Dylan from New Dawn Franchising. We help international investors acquire E-2 visa compliant property management businesses in Texas. Would you be open to a quick call?` },
    { id: "wa_followup",  label: "Follow-up",         metaName: "new_dawn_followup",  lang: "en_US", body: `Hi ${contact.firstName}, following up on my note about E-2 visa franchise opportunities in Texas. Happy to send details or jump on a 15-min call. Reply STOP to opt out.` },
    { id: "wa_brochure",  label: "Brochure offer",    metaName: "new_dawn_brochure",  lang: "en_US", body: `Hi ${contact.firstName}, I've put together an investor brochure covering the full E-2 franchise model, investment details, and Texas market data. Want me to send it over?` },
  ];
  const selectedTpl = WA_TEMPLATES.find(t => t.id === waTemplateId) ?? WA_TEMPLATES[0];

  const checkWa = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("POST", "/api/crm/whatsapp-check-number", { phone });
      return res.json() as Promise<{ onWhatsApp: boolean; waId?: string; error?: string }>;
    },
    onMutate: () => setWaState("checking"),
    onSuccess: (data) => {
      setWaState(data.onWhatsApp ? "confirmed" : "not_found");
    },
    onError: () => {
      setWaState("error");
      toast({ title: "WhatsApp check failed", variant: "destructive" });
    },
  });

  const sendWaFreeform = useMutation({
    mutationFn: async ({ to, message }: { to: string; message: string }) => {
      const res = await apiRequest("POST", "/api/prospects/whatsapp/send", { to, message });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || "Send failed"); }
      return res.json();
    },
    onSuccess: () => {
      setWaState("sent"); setWaMsg("");
      toast({ title: "WhatsApp sent!", description: `Free-form message delivered to ${contact.fullName}` });
    },
    onError: (err: Error) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  const sendWaTemplate = useMutation({
    mutationFn: async ({ to, templateName, lang, firstName }: { to: string; templateName: string; lang: string; firstName: string }) => {
      const res = await apiRequest("POST", "/api/prospects/whatsapp/send-template", { to, templateName, languageCode: lang, firstName });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || "Send failed"); }
      return res.json();
    },
    onSuccess: () => {
      setWaState("sent");
      toast({ title: "WhatsApp template sent!", description: `"${selectedTpl.label}" sent to ${contact.fullName}` });
    },
    onError: (err: Error) => toast({ title: "Failed to send template", description: err.message, variant: "destructive" }),
  });

  const isSendingWa = sendWaFreeform.isPending || sendWaTemplate.isPending;

  return (
    <div className={`rounded-lg border p-3 transition-colors ${isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/30"}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={`mt-0.5 size-4 shrink-0 rounded border transition-colors ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}
        >
          {isSelected && <Check className="size-4 text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start gap-2 mb-0.5">
            <ScoreBadge score={score.total} tier={score.tier} tierEmoji={score.tierEmoji} tierLabel={score.tierLabel} />
            <span className="font-semibold text-sm">{contact.fullName}</span>
            {contact.jobTitle && <span className="text-xs text-muted-foreground">{contact.jobTitle}</span>}
          </div>

          {/* Company context line */}
          {contact.companyName && (
            <div className="flex items-center gap-1.5 mb-1">
              <Building2 className="size-3 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-foreground/80">{contact.companyName}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground mt-1">
            {onReveal && !contact.revealed && !contact.email && !contact.phone && (
              <button
                onClick={onReveal}
                disabled={isRevealing}
                data-testid={`reveal-${contact.id}`}
                title="Reveal email & phone via Seamless.AI (uses ~1 credit)"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {isRevealing ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
                {isRevealing ? "Revealing…" : "Reveal email & phone"}
              </button>
            )}
            {contact.email && (
              <span className="flex items-center gap-1.5 flex-wrap">
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-foreground">
                  <Mail className="size-3" />
                  {contact.email}
                  {contact.emailStatus !== "invalid" && contact.emailConfidence >= 85 && contact.emailStatus === "unverified" && (
                    <span title="High confidence" className="text-green-600"><CheckCircle2 className="size-3" /></span>
                  )}
                </a>
                <EmailStatusBadge status={contact.emailStatus} verified={contact.emailVerified} />
                {contact.emailStatus === "unverified" && contact.emailConfidence >= 70 && (
                  <span className="text-[10px] text-amber-600">~{contact.emailConfidence}%</span>
                )}
              </span>
            )}
            {contact.phone ? (
              <span className="flex items-center gap-1.5 flex-wrap">
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 hover:text-foreground">
                  {contact.phoneType === "mobile" ? <Phone className="size-3 text-green-600" /> : <PhoneCall className="size-3" />}
                  {formatPhone(contact.phone)}
                </a>
                <PhoneTypeBadge type={contact.phoneType} />
                {/* Whitepages phone verification */}
                {!phoneVerify.result && (
                  <button
                    data-testid={`btn-verify-phone-${contact.id}`}
                    title="Verify this number with Whitepages — checks subscriber name & line type"
                    onClick={async () => {
                      setPhoneVerify({ loading: true });
                      try {
                        const res = await apiRequest("POST", "/api/crm/verify/phone", {
                          phone: contact.phone,
                          expectName: `${contact.firstName} ${contact.lastName}`,
                        });
                        setPhoneVerify({ loading: false, result: res as any });
                      } catch {
                        toast({ title: "Phone verification failed", variant: "destructive" });
                        setPhoneVerify({ loading: false });
                      }
                    }}
                    disabled={phoneVerify.loading}
                    className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
                  >
                    {phoneVerify.loading ? <Loader2 className="size-2.5 animate-spin" /> : <ShieldCheck className="size-2.5" />}
                    {phoneVerify.loading ? "…" : "Verify"}
                  </button>
                )}
                {phoneVerify.result && (
                  <span
                    title={phoneVerify.result.subscriberName
                      ? `Subscriber: ${phoneVerify.result.subscriberName}${phoneVerify.result.carrier ? ` · ${phoneVerify.result.carrier}` : ""}`
                      : phoneVerify.result.carrier ?? ""}
                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold border cursor-default ${
                      !phoneVerify.result.valid
                        ? "bg-red-50 text-red-700 border-red-200"
                        : phoneVerify.result.nameMatches === true
                        ? "bg-green-50 text-green-700 border-green-200"
                        : phoneVerify.result.nameMatches === false
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {!phoneVerify.result.valid ? (
                      <><AlertCircle className="size-2.5" />Invalid</>
                    ) : phoneVerify.result.nameMatches === true ? (
                      <><CheckCircle2 className="size-2.5" />Verified</>
                    ) : phoneVerify.result.nameMatches === false ? (
                      <><AlertCircle className="size-2.5" />Name mismatch{phoneVerify.result.subscriberName ? ` · ${phoneVerify.result.subscriberName}` : ""}</>
                    ) : (
                      <><ShieldCheck className="size-2.5" />Valid{phoneVerify.result.lineType ? ` · ${phoneVerify.result.lineType}` : ""}</>
                    )}
                  </span>
                )}
                {contact.whatsappEligible && (
                  <button
                    title={waState === "sent" ? "Message sent" : "Check & send WhatsApp"}
                    onClick={() => {
                      if (waState === "idle" || waState === "error") {
                        checkWa.mutate(contact.phone!);
                      } else if (waState === "confirmed" || waState === "not_found") {
                        setWaState("idle");
                      }
                    }}
                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${
                      waState === "sent" ? "bg-green-600 text-white cursor-default" :
                      waState === "confirmed" ? "bg-green-500 text-white" :
                      waState === "not_found" ? "bg-orange-100 text-orange-700 border border-orange-300" :
                      waState === "checking" ? "bg-green-50 text-green-500 animate-pulse" :
                      "bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer"
                    }`}
                    data-testid={`wa-badge-${contact.id}`}
                  >
                    <MessageCircle className="size-2.5" />
                    {waState === "checking" ? "…" :
                     waState === "confirmed" ? "✓ WA" :
                     waState === "not_found" ? "Not on WA" :
                     waState === "sent" ? "Sent" :
                     "WA"}
                  </button>
                )}
              </span>
            ) : contact.revealed ? (
              <span className="flex items-center gap-1 text-red-400/70" title="No phone number found">
                <PhoneOff className="size-3" />
                <span className="text-[10px]">No phone</span>
              </span>
            ) : null}
            {contact.linkedinUrl && (
              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
                <Linkedin className="size-3 text-[#0A66C2]" /> LinkedIn
              </a>
            )}
          </div>

          {contact.address && (
            <div className="flex items-start gap-1 mt-1 text-[11px] text-muted-foreground">
              <MapPin className="size-3 shrink-0 mt-0.5 text-amber-500" />
              <span>{contact.address}</span>
            </div>
          )}

          {/* WhatsApp compose panel */}
          {(waState === "confirmed" || waState === "not_found") && contact.phone && (
            <div className="mt-2 rounded-md border border-green-200 bg-green-50/60 p-2 space-y-2" data-testid={`wa-compose-${contact.id}`}>

              {/* Header */}
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-green-800">
                <MessageCircle className="size-3" />
                {waState === "confirmed"
                  ? `${contact.firstName} is on WhatsApp ✓`
                  : <span className="text-orange-700">Not confirmed on WhatsApp — you can still try</span>
                }
                <button onClick={() => setWaState("idle")} className="ml-auto text-green-600 hover:text-green-800" title="Close">
                  <X className="size-3" />
                </button>
              </div>

              {/* Mode toggle */}
              <div className="flex rounded overflow-hidden border border-green-200 text-[10px] font-semibold w-fit">
                <button
                  onClick={() => setWaMode("template")}
                  className={`px-2 py-0.5 transition-colors ${waMode === "template" ? "bg-green-600 text-white" : "bg-white text-green-700 hover:bg-green-50"}`}
                  data-testid={`wa-mode-template-${contact.id}`}
                >
                  Template
                </button>
                <button
                  onClick={() => setWaMode("freeform")}
                  className={`px-2 py-0.5 transition-colors ${waMode === "freeform" ? "bg-green-600 text-white" : "bg-white text-green-700 hover:bg-green-50"}`}
                  data-testid={`wa-mode-freeform-${contact.id}`}
                >
                  Free-form
                </button>
              </div>

              {/* ── TEMPLATE MODE ── */}
              {waMode === "template" && (
                <div className="space-y-1.5">
                  <select
                    value={waTemplateId}
                    onChange={(e) => setWaTemplateId(e.target.value)}
                    className="w-full rounded border border-green-200 bg-white px-2 py-1 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-green-400"
                    data-testid={`wa-tpl-select-${contact.id}`}
                  >
                    {WA_TEMPLATES.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>

                  {/* Preview */}
                  <div className="rounded bg-white border border-green-100 px-2 py-1.5 text-[11px] text-muted-foreground italic leading-relaxed">
                    {selectedTpl.body}
                  </div>

                  <p className="text-[9px] text-amber-600">
                    Template must be approved in Meta Business Manager before sending.
                  </p>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={isSendingWa}
                      onClick={() => sendWaTemplate.mutate({
                        to: contact.phone!,
                        templateName: selectedTpl.metaName,
                        lang: selectedTpl.lang,
                        firstName: contact.firstName,
                      })}
                      data-testid={`wa-send-tpl-btn-${contact.id}`}
                    >
                      {isSendingWa ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                      Send Template
                    </Button>
                  </div>
                </div>
              )}

              {/* ── FREE-FORM MODE ── */}
              {waMode === "freeform" && (
                <div className="space-y-1.5">
                  <p className="text-[9px] text-amber-600 flex items-center gap-1">
                    <AlertCircle className="size-3 shrink-0" />
                    Only works if {contact.firstName} has messaged your WhatsApp in the last 24 hours.
                  </p>
                  <Textarea
                    rows={3}
                    placeholder={`Hi ${contact.firstName}, Dylan here from New Dawn Franchising…`}
                    value={waMsg}
                    onChange={(e) => setWaMsg(e.target.value)}
                    className="text-xs resize-none bg-white"
                    data-testid={`wa-textarea-${contact.id}`}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground">{waMsg.length} chars</span>
                    <Button
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1 bg-green-600 hover:bg-green-700 text-white"
                      disabled={!waMsg.trim() || isSendingWa}
                      onClick={() => sendWaFreeform.mutate({ to: contact.phone!, message: waMsg })}
                      data-testid={`wa-send-btn-${contact.id}`}
                    >
                      {isSendingWa ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                      Send Message
                    </Button>
                  </div>
                </div>
              )}

            </div>
          )}

          {(contact.e2ViaBio || contact.internationalBio) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {contact.e2ViaBio && <span className="rounded-full bg-green-50 border border-green-200 px-1.5 py-0.5 text-[10px] text-green-700">E-2 Visa</span>}
              {contact.internationalBio && <span className="rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] text-blue-700">International</span>}
            </div>
          )}

          {contact.bio && (
            <div className="mt-1.5">
              {!showBio ? (
                <button onClick={() => setShowBio(true)} className="text-[10px] text-muted-foreground hover:text-foreground">
                  Show bio snippet
                </button>
              ) : (
                <div>
                  <p className="text-[10px] text-muted-foreground italic leading-relaxed">{contact.bio.slice(0, 200)}…</p>
                  <button onClick={() => setShowBio(false)} className="text-[10px] text-muted-foreground hover:text-foreground">
                    Hide
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <div className="flex gap-1 ml-auto">
              <Button
                size="sm"
                variant={isAddedToCrm ? "default" : "outline"}
                className={`h-6 px-2 text-[10px] gap-1 ${isAddedToCrm ? "bg-green-600 hover:bg-green-700 border-green-600 text-white" : ""}`}
                disabled={isSaving || isAddedToCrm}
                onClick={onSave}
              >
                {isSaving ? <Loader2 className="size-3 animate-spin" /> : isAddedToCrm ? <CheckCircle2 className="size-3" /> : <UserPlus className="size-3" />}
                {isAddedToCrm ? "In CRM" : "Add to CRM"}
              </Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1 text-primary border-primary/30"
                disabled={isSaving} onClick={onAddToList}>
                {isSaving ? <Loader2 className="size-3 animate-spin" /> : <ListPlus className="size-3" />}
                Add to List
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanySection({
  company,
  showAll,
  selected,
  onToggle,
  onSaveContact,
  onAddContactToList,
  savingIds,
  addedToCrmIds,
  onClickEnrichedBadge,
  onRevealContact,
  revealingIds,
  onFindPeople,
  isFindingPeople,
}: {
  company: EnrichedCompany;
  showAll: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSaveContact: (contact: EnrichedContact) => void;
  onAddContactToList: (contact: EnrichedContact) => void;
  savingIds: Set<string>;
  addedToCrmIds: Set<string>;
  onClickEnrichedBadge: () => void;
  onRevealContact: (contact: EnrichedContact) => void;
  revealingIds: Set<string>;
  onFindPeople?: () => void;
  isFindingPeople?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const visibleContacts = showAll
    ? company.contacts
    : company.contacts.filter((c) => c.scoreBreakdown.tier === "hot" || c.scoreBreakdown.tier === "warm");

  const hiddenCount = company.contacts.length - visibleContacts.length;
  const isEnriched = company.enrichmentStatus === "complete" || company.enrichmentStatus === "partial";

  return (
    <div className="rounded-xl border overflow-hidden">
      {/* Company header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">{company.name}</span>
            {company.address && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3" />{company.address.split(",").slice(-2).join(",").trim()}
                <AddressValidityBadge validity={company.addressValidity} />
              </span>
            )}
            {company.googleRating && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <Star className="size-3 fill-amber-500" />{company.googleRating}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                <Globe className="size-3" />{company.domain || company.website}
              </a>
            )}
            {company.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{formatPhone(company.phone)}</span>}
          </div>
          {company.description && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {company.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEnriched && (
            <button
              onClick={(e) => { e.stopPropagation(); onClickEnrichedBadge(); }}
              title="Click to show only enriched companies"
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors cursor-pointer hover:bg-green-100 ${
                company.enrichmentStatus === "complete"
                  ? "bg-green-50 text-green-700 border-green-300"
                  : "bg-amber-50 text-amber-700 border-amber-300"
              }`}
            >
              <Users className="size-3" />
              +{company.contacts.length} {company.enrichmentStatus === "complete" ? "Enriched" : "Partial"}
            </button>
          )}
          {!isEnriched && onFindPeople && (
            <button
              onClick={(e) => { e.stopPropagation(); onFindPeople(); }}
              disabled={isFindingPeople}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {isFindingPeople ? <Loader2 className="size-3 animate-spin" /> : <Users className="size-3" />}
              {isFindingPeople ? "Finding…" : "Find decision-makers"}
            </button>
          )}
          {!isEnriched && !onFindPeople && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
              No contacts
            </span>
          )}
        </div>
      </button>

      {/* Contacts */}
      {expanded && (
        <div className="p-3 space-y-2">
          {visibleContacts.length === 0 ? (
            company.contacts.length === 0 && onFindPeople ? (
              <div className="text-center py-3">
                <p className="text-sm text-muted-foreground mb-2">No decision-makers loaded yet for this company.</p>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={isFindingPeople} onClick={onFindPeople}>
                  {isFindingPeople ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />}
                  Find decision-makers
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3">
                {company.contacts.length === 0
                  ? "No individual contacts found for this company."
                  : "No hot or warm leads — click \"Show all\" to see all contacts."}
              </p>
            )
          ) : (
            visibleContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                isSelected={selected.has(contact.id)}
                onToggle={() => onToggle(contact.id)}
                onSave={() => onSaveContact(contact)}
                onAddToList={() => onAddContactToList(contact)}
                isSaving={savingIds.has(contact.id)}
                isAddedToCrm={addedToCrmIds.has(contact.id)}
                onReveal={() => onRevealContact(contact)}
                isRevealing={revealingIds.has(contact.id)}
              />
            ))
          )}
          {hiddenCount > 0 && (
            <p className="text-xs text-center text-muted-foreground py-1">
              +{hiddenCount} cold/unqualified contact{hiddenCount !== 1 ? "s" : ""} hidden — use "Show all" to reveal
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProspectFinder() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [viewTab, setViewTab] = useState<"search" | "saved">("search");
  // ── Seamless.AI Lead Research search state ──
  const [searchTab, setSearchTab] = useState<"contacts" | "companies">("contacts");
  const [filters, setFilters] = useState<LeadFilters>({ ...EMPTY_FILTERS });
  const [aiQuery, setAiQuery] = useState("");
  const [revealingIds, setRevealingIds] = useState<Set<string>>(new Set());
  const [findingCompanyIds, setFindingCompanyIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [companies, setCompanies] = useState<EnrichedCompany[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterEnrichedOnly, setFilterEnrichedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"contacts_desc" | "score_desc" | "name_asc" | "location_asc" | "category_asc">("contacts_desc");
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  // Saved tab filters
  const [savedSortBy, setSavedSortBy] = useState<"name_asc" | "category_asc" | "location_asc" | "phone_first" | "email_first">("name_asc");
  const [savedFilterHasPhone, setSavedFilterHasPhone] = useState(false);
  const [savedFilterHasEmail, setSavedFilterHasEmail] = useState(false);
  const [savedFilterCategory, setSavedFilterCategory] = useState("");
  const [savedFilterLocation, setSavedFilterLocation] = useState("");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameListName, setRenameListName] = useState("");
  const [openAddToList, setOpenAddToList] = useState<string | null>(null);
  const [selectedSavedProspect, setSelectedSavedProspect] = useState<SavedProspect | null>(null);
  const newListInputRef = useRef<HTMLInputElement>(null);
  const [listPickerContact, setListPickerContact] = useState<EnrichedContact | null>(null);
  const [listPickerProspectId, setListPickerProspectId] = useState<string | null>(null);
  const [listPickerSaving, setListPickerSaving] = useState(false);
  const [newListNameForPicker, setNewListNameForPicker] = useState("");
  const [showNewListInPicker, setShowNewListInPicker] = useState(false);
  const [listPickerAdding, setListPickerAdding] = useState(false);

  useEffect(() => {
    if (!openAddToList) return;
    const handler = () => setOpenAddToList(null);
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [openAddToList]);

  const { data: savedProspects = [] } = useQuery<SavedProspect[]>({ queryKey: ["/api/crm/prospects"] });

  type ProspectListItem = { id: string; name: string; count: number; createdAt: string };
  const { data: prospectLists = [] } = useQuery<ProspectListItem[]>({ queryKey: ["/api/crm/prospect-lists"] });

  const { data: listMembers = [] } = useQuery<SavedProspect[]>({
    queryKey: ["/api/crm/prospect-lists", selectedListId, "members"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/crm/prospect-lists/${selectedListId}/members`);
      return res.json();
    },
    enabled: !!selectedListId,
  });

  const { data: enrichmentStatus } = useQuery<EnrichmentStatus>({
    queryKey: ["/api/crm/enrichment-status"],
  });

  // ── Seamless.AI search helpers ──────────────────────────────────────────────
  const toSearchFilters = (f: LeadFilters) => ({
    jobTitle: f.jobTitle,
    seniority: f.seniority,
    department: f.department,
    industry: f.industry,
    companySize: f.companySize,
    companyRevenue: f.companyRevenue,
    companyName: f.companyName,
    companyDomain: f.companyDomain,
    contactState: f.contactState,
    contactCountry: f.contactCountry,
    keywords: f.keywords,
    fullName: f.fullName,
    companyType: f.companyType,
    companyFoundedOn: f.companyFoundedOn,
  });

  const runSeamlessSearch = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/crm/prospects/seamless-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = text;
      try { msg = JSON.parse(text).message || text; } catch { /* raw */ }
      throw new Error(msg || res.statusText);
    }
    return res.json() as Promise<{
      companies: EnrichedCompany[];
      totalContacts: number;
      enrichedCount: number;
      nextToken: string | null;
      appliedFilters?: LeadFilters;
    }>;
  };

  const applyResults = (
    data: { companies: EnrichedCompany[]; totalContacts: number },
    label: string,
  ) => {
    setCompanies(data.companies);
    setHasSearched(true);
    setSelected(new Set());
    setShowAll(true);
    const msg = searchTab === "companies"
      ? `Found ${data.companies.length} companies — open one to find its decision-makers`
      : data.totalContacts > 0
        ? `Found ${data.totalContacts} contacts across ${data.companies.length} companies`
        : "No matching contacts — try adjusting your filters";
    toast({ title: label, description: msg });
  };

  const searchMutation = useMutation({
    mutationFn: async () => {
      if (countActiveFilters(filters) === 0) throw new Error("Add at least one filter, or use AI Search above.");
      return runSeamlessSearch({ mode: searchTab, filters: toSearchFilters(filters) });
    },
    onSuccess: (data) => applyResults(data, "Search complete"),
    onError: (err: Error) => toast({ title: "Search failed", description: err.message, variant: "destructive" }),
  });

  const aiSearchMutation = useMutation({
    mutationFn: async () => {
      if (!aiQuery.trim()) throw new Error("Type what you're looking for first.");
      return runSeamlessSearch({ mode: searchTab, filters: toSearchFilters(filters), aiQuery: aiQuery.trim() });
    },
    onSuccess: (data) => {
      if (data.appliedFilters) setFilters({ ...EMPTY_FILTERS, ...data.appliedFilters });
      applyResults(data, "AI search complete");
    },
    onError: (err: Error) => toast({ title: "AI search failed", description: err.message, variant: "destructive" }),
  });

  const isSearchPending = searchMutation.isPending || aiSearchMutation.isPending;

  // Reveal email + phone for one or more contacts (spends Seamless credits).
  const revealContacts = async (contactIds: string[]) => {
    const all = companies.flatMap((c) => c.contacts);
    const targets = all.filter((c) => contactIds.includes(c.id) && c.searchResultId && !c.revealed);
    if (targets.length === 0) return;
    const targetIds = new Set(targets.map((t) => t.id));
    const bySr = new Map(targets.map((t) => [t.searchResultId as string, t.id]));
    setRevealingIds((s) => new Set([...Array.from(s), ...targets.map((t) => t.id)]));
    try {
      const res = await apiRequest("POST", "/api/crm/prospects/seamless-reveal", {
        searchResultIds: targets.map((t) => t.searchResultId),
      });
      const data = (await res.json()) as { results: Array<any> };
      const byId = new Map<string, any>();
      for (const r of data.results || []) {
        const id = r.searchResultId ? bySr.get(r.searchResultId) : undefined;
        if (id) byId.set(id, r);
      }
      let withContact = 0;
      setCompanies((prev) => prev.map((co) => ({
        ...co,
        contacts: co.contacts.map((ct) => {
          if (!targetIds.has(ct.id)) return ct;
          const r = byId.get(ct.id);
          if (!r) return { ...ct, revealed: true };
          if (r.email || r.phone) withContact++;
          return {
            ...ct,
            email: r.email ?? ct.email,
            emailConfidence: r.emailConfidence ?? ct.emailConfidence,
            emailStatus: r.emailStatus ?? ct.emailStatus,
            emailVerified: r.emailVerified ?? ct.emailVerified,
            phone: r.phone ?? ct.phone,
            phoneType: r.phoneType ?? ct.phoneType,
            whatsappEligible: r.whatsappEligible ?? ct.whatsappEligible,
            linkedinUrl: r.linkedinUrl ?? ct.linkedinUrl,
            decisionMakerScore: r.decisionMakerScore ?? ct.decisionMakerScore,
            scoreBreakdown: r.scoreBreakdown ?? ct.scoreBreakdown,
            revealed: true,
          };
        }),
      })));
      toast({
        title: "Reveal complete",
        description: withContact > 0
          ? `Revealed contact info for ${withContact} of ${targets.length}`
          : "Seamless returned no email/phone for the selected contact(s)",
      });
    } catch (err: any) {
      toast({ title: "Reveal failed", description: err.message, variant: "destructive" });
    } finally {
      setRevealingIds((s) => { const n = new Set(s); targets.forEach((t) => n.delete(t.id)); return n; });
    }
  };

  // Companies tab: load decision-makers for one company (scoped contact search).
  const findPeopleForCompany = async (company: EnrichedCompany) => {
    const f = company.domain ? { companyDomain: [company.domain] } : { companyName: [company.name] };
    setFindingCompanyIds((s) => new Set([...Array.from(s), company.id]));
    try {
      const data = await runSeamlessSearch({ mode: "contacts", filters: f });
      const found = (data.companies || []).flatMap((c) => c.contacts);
      setCompanies((prev) => prev.map((c) => c.id === company.id
        ? {
            ...c,
            contacts: found.map((ct) => ({ ...ct, companyId: c.id, companyName: c.name })),
            enrichmentStatus: (found.length ? "complete" : "no_contacts") as EnrichedCompany["enrichmentStatus"],
          }
        : c));
      if (found.length === 0) {
        toast({ title: "No decision-makers found", description: `Seamless returned no contacts for ${company.name}` });
      }
    } catch (err: any) {
      toast({ title: "Lookup failed", description: err.message, variant: "destructive" });
    } finally {
      setFindingCompanyIds((s) => { const n = new Set(s); n.delete(company.id); return n; });
    }
  };

  const saveContact = async (contact: EnrichedContact) => {
    setSavingIds((s) => new Set([...Array.from(s), contact.id]));
    const parentCompany = companies.find((c) => c.id === contact.companyId);
    try {
      await apiRequest("POST", "/api/crm/prospects/save-individual", {
        contact: { ...contact, website: parentCompany?.website || null },
        category: parentCompany?.searchCategory || "Seamless Search",
        location: parentCompany?.searchLocation || "Global",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospects"] });
      toast({ title: `${contact.fullName} saved to prospect list` });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingIds((s) => { const n = new Set(s); n.delete(contact.id); return n; });
    }
  };

  const [addedToCrmIds, setAddedToCrmIds] = useState<Set<string>>(new Set());
  const [showBulkCrmPanel, setShowBulkCrmPanel] = useState(false);
  const [bulkCrmTagInput, setBulkCrmTagInput] = useState("");
  const [bulkCrmAdding, setBulkCrmAdding] = useState(false);

  const addToCRM = async (contact: EnrichedContact, extraTags?: string[]) => {
    if (addedToCrmIds.has(contact.id)) {
      toast({ title: "Already added", description: `${contact.fullName} is already in the CRM.` });
      return;
    }
    setSavingIds((s) => new Set([...Array.from(s), contact.id]));
    try {
      await apiRequest("POST", "/api/crm/clients", {
        fullName: contact.fullName,
        email: contact.email || "",
        phone: contact.phone || undefined,
        leadSource: "prospect_finder",
        companyName: contact.companyName || undefined,
        profession: contact.jobTitle || undefined,
        linkedinUrl: contact.linkedinUrl || undefined,
        notes: contact.bio ? contact.bio.slice(0, 500) : undefined,
        status: "new",
        tags: extraTags && extraTags.length > 0 ? extraTags : [],
      });
      setAddedToCrmIds((s) => new Set([...Array.from(s), contact.id]));
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/client-tags"] });
      toast({ title: `${contact.fullName} added to CRM`, description: "Now visible in the CRM tab." });
    } catch (err: any) {
      toast({ title: "Failed to add to CRM", description: err.message, variant: "destructive" });
    } finally {
      setSavingIds((s) => { const n = new Set(s); n.delete(contact.id); return n; });
    }
  };

  const bulkAddToCrm = async (tagStr: string) => {
    const tags = tagStr.split(",").map(t => t.trim()).filter(Boolean);
    const allContacts = companies.flatMap((c) => c.contacts);
    const contacts = allContacts.filter((c: EnrichedContact) => selected.has(c.id) && !addedToCrmIds.has(c.id));
    if (contacts.length === 0) {
      toast({ title: "Nothing to add", description: "All selected contacts are already in the CRM." });
      setShowBulkCrmPanel(false);
      return;
    }
    setBulkCrmAdding(true);
    try {
      const res = await apiRequest("POST", "/api/crm/clients/bulk-add", { contacts, tags });
      const data = await res.json();
      const addedIds = contacts.map((c: EnrichedContact) => c.id);
      setAddedToCrmIds((s) => new Set<string>([...Array.from(s), ...addedIds]));
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/client-tags"] });
      toast({ title: `${data.added} contacts added to CRM`, description: tags.length > 0 ? `Tagged: ${tags.join(", ")}` : undefined });
      setSelected(new Set());
      setShowBulkCrmPanel(false);
      setBulkCrmTagInput("");
    } catch (err: any) {
      toast({ title: "Bulk add failed", description: err.message, variant: "destructive" });
    } finally {
      setBulkCrmAdding(false);
    }
  };

  // Resolve the saved prospect ID for a contact: prefer already-saved, else save fresh
  const resolveProspectId = async (contact: EnrichedContact): Promise<string | null> => {
    // 1. Already saved from this session
    if (listPickerProspectId) return listPickerProspectId;
    // 2. Already in savedProspects by email
    if (contact.email) {
      const match = savedProspects.find(p => p.email === contact.email);
      if (match) return match.id;
    }
    // 3. Save fresh
    try {
      const parentCompany = companies.find((c) => c.id === contact.companyId);
      const res = await apiRequest("POST", "/api/crm/prospects/save-individual", {
        contact: { ...contact, website: parentCompany?.website || null },
        category: parentCompany?.searchCategory || "Seamless Search",
        location: parentCompany?.searchLocation || "Global",
      });
      const saved = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospects"] });
      return saved.id as string;
    } catch {
      return null;
    }
  };

  const openListPicker = async (contact: EnrichedContact) => {
    setListPickerContact(contact);
    setListPickerProspectId(null);
    setNewListNameForPicker("");
    setShowNewListInPicker(false);
    setListPickerSaving(true);
    try {
      // Check cache first so we don't create duplicates
      if (contact.email) {
        const match = savedProspects.find(p => p.email === contact.email);
        if (match) { setListPickerProspectId(match.id); return; }
      }
      const parentCompany = companies.find((c) => c.id === contact.companyId);
      const res = await apiRequest("POST", "/api/crm/prospects/save-individual", {
        contact: { ...contact, website: parentCompany?.website || null },
        category: parentCompany?.searchCategory || "Seamless Search",
        location: parentCompany?.searchLocation || "Global",
      });
      const saved = await res.json();
      setListPickerProspectId(saved.id);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospects"] });
    } catch {
      // Silent — will fall back to email-match in addToListFromPicker
    } finally {
      setListPickerSaving(false);
    }
  };

  const addToListFromPicker = async (listId: string) => {
    setListPickerAdding(true);
    try {
      const prospectId = await resolveProspectId(listPickerContact!);
      if (!prospectId) {
        toast({ title: "Couldn't save contact", description: "Please use the Save button first, then try again.", variant: "destructive" });
        return;
      }
      await apiRequest("POST", `/api/crm/prospect-lists/${listId}/members`, { prospectId });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists", listId, "members"] });
      const listName = prospectLists.find(l => l.id === listId)?.name ?? "list";
      toast({ title: `${listPickerContact?.fullName} added to "${listName}"`, description: 'Switch to the Saved tab to view.' });
      setListPickerContact(null);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setListPickerAdding(false);
    }
  };

  const createListAndAddFromPicker = async () => {
    const name = newListNameForPicker.trim();
    if (!name) return;
    setListPickerAdding(true);
    try {
      const res = await apiRequest("POST", "/api/crm/prospect-lists", { name });
      const newList = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      const prospectId = await resolveProspectId(listPickerContact!);
      if (prospectId) {
        await apiRequest("POST", `/api/crm/prospect-lists/${newList.id}/members`, { prospectId });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists", newList.id, "members"] });
        toast({ title: `${listPickerContact?.fullName} added to new list "${name}"`, description: 'Switch to the Saved tab to view.' });
        setSelectedListId(newList.id);
      } else {
        toast({ title: `List "${name}" created` });
      }
      setListPickerContact(null);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setListPickerAdding(false);
    }
  };

  const saveSelected = async () => {
    const allContacts = companies.flatMap((c) => c.contacts);
    const toSave = allContacts.filter((c) => selected.has(c.id));
    if (toSave.length === 0) return;
    for (const contact of toSave) await saveContact(contact);
    setSelected(new Set());
    toast({ title: `${toSave.length} contacts saved` });
  };

  const toggleContact = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/crm/prospects/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      if (selectedListId) queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists", selectedListId, "members"] });
    },
  });

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/crm/prospect-lists", { name });
      return res.json();
    },
    onSuccess: (list: ProspectListItem) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      setSelectedListId(list.id);
      setShowNewListInput(false);
      setNewListName("");
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => { await apiRequest("DELETE", `/api/crm/prospect-lists/${listId}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      setSelectedListId(null);
    },
  });

  const renameListMutation = useMutation({
    mutationFn: async ({ listId, name }: { listId: string; name: string }) => {
      await apiRequest("PATCH", `/api/crm/prospect-lists/${listId}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      setRenamingListId(null);
      setRenameListName("");
    },
  });

  const addToListMutation = useMutation({
    mutationFn: async ({ listId, prospectId }: { listId: string; prospectId: string }) => {
      await apiRequest("POST", `/api/crm/prospect-lists/${listId}/members`, { prospectId });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists", vars.listId, "members"] });
      const listName = prospectLists.find(l => l.id === vars.listId)?.name ?? "list";
      toast({ title: `Added to "${listName}"` });
      setOpenAddToList(null);
    },
  });

  const removeFromListMutation = useMutation({
    mutationFn: async ({ listId, prospectId }: { listId: string; prospectId: string }) => {
      await apiRequest("DELETE", `/api/crm/prospect-lists/${listId}/members/${prospectId}`);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/prospect-lists", vars.listId, "members"] });
    },
  });

  const allContacts = companies.flatMap((c) => c.contacts);
  const hotWarmCount = allContacts.filter((c) => c.scoreBreakdown.tier === "hot" || c.scoreBreakdown.tier === "warm").length;
  const selectedRevealableCount = allContacts.filter((c) => selected.has(c.id) && c.searchResultId && !c.revealed).length;

  // Derive unique category/location values from search results for filter dropdowns
  const uniqueCategories = Array.from(new Set(companies.map((c) => c.searchCategory).filter(Boolean))).sort();
  const uniqueLocations  = Array.from(new Set(companies.map((c) => c.searchLocation).filter(Boolean))).sort();

  const displayCompanies = companies
    .filter((c) => !filterEnrichedOnly || c.enrichmentStatus !== "no_contacts")
    .filter((c) => !filterHasPhone || c.contacts.some((ct) => !!ct.phone))
    .filter((c) => !filterHasEmail || c.contacts.some((ct) => !!ct.email))
    .filter((c) => !filterCategory || c.searchCategory === filterCategory)
    .filter((c) => !filterLocation || c.searchLocation === filterLocation)
    .sort((a, b) => {
      if (sortBy === "contacts_desc") return b.contacts.length - a.contacts.length;
      if (sortBy === "score_desc") {
        const aMax = Math.max(0, ...a.contacts.map(c => c.decisionMakerScore));
        const bMax = Math.max(0, ...b.contacts.map(c => c.decisionMakerScore));
        return bMax - aMax;
      }
      if (sortBy === "location_asc") return (a.searchLocation || "").localeCompare(b.searchLocation || "");
      if (sortBy === "category_asc") return (a.searchCategory || "").localeCompare(b.searchCategory || "");
      return a.name.localeCompare(b.name);
    });

  const activeSearchFilterCount = [filterHasPhone, filterHasEmail, !!filterCategory, !!filterLocation].filter(Boolean).length;

  // Saved tab: derive unique values for filters
  const currentViewSource = selectedListId ? listMembers : savedProspects;
  const savedCategories = Array.from(new Set(currentViewSource.map((p) => p.category).filter(Boolean))).sort();
  const savedLocations  = Array.from(new Set(currentViewSource.map((p) => p.location).filter(Boolean))).sort();

  const filteredSaved = currentViewSource
    .filter((p) =>
      !filterText || p.name?.toLowerCase().includes(filterText.toLowerCase()) ||
      p.company?.toLowerCase().includes(filterText.toLowerCase())
    )
    .filter((p) => !savedFilterHasPhone || !!p.phone)
    .filter((p) => !savedFilterHasEmail || !!p.email)
    .filter((p) => !savedFilterCategory || p.category === savedFilterCategory)
    .filter((p) => !savedFilterLocation || p.location === savedFilterLocation)
    .sort((a, b) => {
      if (savedSortBy === "category_asc") return (a.category || "").localeCompare(b.category || "");
      if (savedSortBy === "location_asc") return (a.location || "").localeCompare(b.location || "");
      if (savedSortBy === "phone_first") return (!!b.phone ? 1 : 0) - (!!a.phone ? 1 : 0);
      if (savedSortBy === "email_first") return (!!b.email ? 1 : 0) - (!!a.email ? 1 : 0);
      return (a.name || "").localeCompare(b.name || "");
    });

  const activeSavedFilterCount = [savedFilterHasPhone, savedFilterHasEmail, !!savedFilterCategory, !!savedFilterLocation].filter(Boolean).length;

  const downloadCsv = (rows: (string | number | null | undefined)[][], filename: string) => {
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  const exportCsv = () => {
    const rows: (string | number | null | undefined)[][] = [
      ["Name","Company","Email","Email Status","Phone","Phone Type","Job Title","Score","Tier","LinkedIn","Website","Address","Category","Location","Source","Notes"],
      ...filteredSaved.map((p) => [
        p.name, p.company || "", p.email || "", "", p.phone || "", "",
        "", "", "", p.sourceUrl || "", p.website || "", p.address || "",
        p.category, p.location, p.source || "", p.notes || "",
      ]),
    ];
    downloadCsv(rows, `saved_prospects_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const exportSearchResults = () => {
    const rows: (string | number | null | undefined)[][] = [
      [
        "Full Name","First Name","Last Name","Job Title","Seniority",
        "Company","Company Website","Email","Email Verified","Email Confidence %","Email Status",
        "Phone","Phone Type","WhatsApp Eligible",
        "LinkedIn URL","Address","Score","Tier","Sources",
        "E-2 Signals","International Bio","Category","Location",
      ],
    ];
    for (const company of displayCompanies) {
      for (const c of company.contacts) {
        rows.push([
          c.fullName, c.firstName, c.lastName, c.jobTitle || "", c.seniority || "",
          company.name, company.website || "",
          c.email || "", c.emailVerified ? "Yes" : "No", c.emailConfidence || 0, c.emailStatus || "",
          c.phone || "", c.phoneType || "", c.whatsappEligible ? "Yes" : "No",
          c.linkedinUrl || "", (c as any).address || "",
          c.decisionMakerScore, c.scoreBreakdown?.tierLabel || "",
          (c.sources || []).join("; "),
          c.e2ViaBio ? "Yes" : "No", c.internationalBio ? "Yes" : "No",
          company.searchCategory || "", company.searchLocation || "",
        ]);
      }
    }
    const dateStr = new Date().toISOString().slice(0,10);
    downloadCsv(rows, `search_results_${dateStr}.csv`);
  };

  const seamlessConnected = !!enrichmentStatus?.seamless;

  return (
    <div className="space-y-4 p-1">
      {/* Seamless.AI connection banner */}
      {enrichmentStatus && !seamlessConnected && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Seamless.AI is not connected</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Lead Research is powered entirely by Seamless.AI. Add your <code className="font-mono">SEAMLESS_API_KEY</code> in Railway → Variables to enable contact &amp; company search.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0">
        {(["search", "saved"] as const).map((t) => (
          <button key={t} onClick={() => setViewTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              viewTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t === "search" ? "Find Decision Makers" : `Saved List (${savedProspects.length})`}
          </button>
        ))}
      </div>

      {/* ── Search Tab ── */}
      {viewTab === "search" && (
        <div className="space-y-4">
          {/* Seamless.AI search */}
          <SeamlessSearchPanel
            searchTab={searchTab}
            setSearchTab={(t) => { setSearchTab(t); setHasSearched(false); setCompanies([]); }}
            filters={filters}
            setFilters={setFilters}
            aiQuery={aiQuery}
            setAiQuery={setAiQuery}
            onSearch={() => searchMutation.mutate()}
            onAiSearch={() => aiSearchMutation.mutate()}
            isSearching={isSearchPending}
          />

          {/* Results */}
          {hasSearched && (
            <div className="space-y-3">
              {/* Summary + controls bar */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground flex-1 min-w-0">
                    <span className="font-semibold text-foreground">{allContacts.length}</span> individuals across{" "}
                    <span className="font-semibold text-foreground">{displayCompanies.length}</span>
                    {displayCompanies.length !== companies.length && <span className="text-muted-foreground"> (filtered from {companies.length})</span>}
                    {" "}companies ·{" "}
                    <span className={hotWarmCount > 0 ? "text-green-700 font-semibold" : "text-muted-foreground"}>
                      {hotWarmCount} hot/warm
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Sort dropdown */}
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="h-7 rounded-md border border-input bg-transparent pl-2 pr-6 text-xs appearance-none"
                      >
                        <option value="contacts_desc">Most contacts</option>
                        <option value="score_desc">Highest score</option>
                        <option value="name_asc">Company A → Z</option>
                        <option value="category_asc">By category</option>
                        <option value="location_asc">By country / location</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-1.5 top-1.5 size-3 text-muted-foreground" />
                    </div>

                    {/* Filter button with badge */}
                    <Button
                      size="sm"
                      variant={showSearchFilters || activeSearchFilterCount > 0 ? "default" : "outline"}
                      className="gap-1 h-7 text-xs relative"
                      onClick={() => setShowSearchFilters((v) => !v)}
                    >
                      <SlidersHorizontal className="size-3.5" />
                      Filter
                      {activeSearchFilterCount > 0 && (
                        <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-white text-primary size-4 text-[10px] font-bold">
                          {activeSearchFilterCount}
                        </span>
                      )}
                    </Button>

                    <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => setShowAll(!showAll)}>
                      {showAll ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      {showAll ? "Hot/Warm only" : "Show all"}
                    </Button>
                    {selectedRevealableCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs border-primary/40 text-primary"
                        onClick={() => revealContacts(Array.from(selected))}
                        data-testid="bulk-reveal-btn"
                        title="Reveal email & phone for selected contacts (uses ~1 Seamless credit each)"
                      >
                        <Sparkles className="size-3.5" /> Reveal {selectedRevealableCount}
                      </Button>
                    )}
                    {selected.size > 0 && (
                      <Button
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        onClick={() => setShowBulkCrmPanel((v) => !v)}
                        data-testid="bulk-add-crm-btn"
                      >
                        <UserPlus className="size-3.5" /> Add {selected.size} to CRM
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded filter panel */}
                {/* Bulk Add to CRM panel */}
                {showBulkCrmPanel && selected.size > 0 && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <p className="text-xs font-semibold text-primary">
                      Add {selected.size} selected contact{selected.size !== 1 ? "s" : ""} to CRM
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <Tag className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Tags (comma-separated, e.g. Dallas List, Hot Lead)"
                          value={bulkCrmTagInput}
                          onChange={(e) => setBulkCrmTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && bulkAddToCrm(bulkCrmTagInput)}
                          className="h-8 w-full rounded-md border border-input bg-white pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          data-testid="bulk-crm-tag-input"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1 shrink-0"
                        disabled={bulkCrmAdding}
                        onClick={() => bulkAddToCrm(bulkCrmTagInput)}
                        data-testid="bulk-crm-confirm-btn"
                      >
                        {bulkCrmAdding ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                        {bulkCrmAdding ? "Adding..." : "Confirm"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => setShowBulkCrmPanel(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Leave tags blank to add without a tag. Tags appear as filters in the CRM.</p>
                  </div>
                )}

                {showSearchFilters && (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Category filter */}
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Category</label>
                        <div className="relative">
                          <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="h-7 w-full rounded-md border border-input bg-background pl-2 pr-6 text-xs appearance-none"
                          >
                            <option value="">All categories</option>
                            {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-1.5 top-1.5 size-3 text-muted-foreground" />
                        </div>
                      </div>

                      {/* Location / Country filter */}
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Country / Location</label>
                        <div className="relative">
                          <select
                            value={filterLocation}
                            onChange={(e) => setFilterLocation(e.target.value)}
                            className="h-7 w-full rounded-md border border-input bg-background pl-2 pr-6 text-xs appearance-none"
                          >
                            <option value="">All locations</option>
                            {uniqueLocations.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-1.5 top-1.5 size-3 text-muted-foreground" />
                        </div>
                      </div>

                      {/* Has Phone toggle */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Has Phone</label>
                        <button
                          onClick={() => setFilterHasPhone((v) => !v)}
                          className={`h-7 rounded-md border text-xs font-medium px-3 transition-colors ${filterHasPhone ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:text-foreground"}`}
                        >
                          <Phone className="size-3 inline mr-1" />
                          {filterHasPhone ? "✓ With phone" : "Any"}
                        </button>
                      </div>

                      {/* Has Email toggle */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Has Email</label>
                        <button
                          onClick={() => setFilterHasEmail((v) => !v)}
                          className={`h-7 rounded-md border text-xs font-medium px-3 transition-colors ${filterHasEmail ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:text-foreground"}`}
                        >
                          <Mail className="size-3 inline mr-1" />
                          {filterHasEmail ? "✓ With email" : "Any"}
                        </button>
                      </div>
                    </div>

                    {/* Enriched only + clear */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant={filterEnrichedOnly ? "default" : "ghost"} className="gap-1 h-7 text-xs"
                        onClick={() => setFilterEnrichedOnly(!filterEnrichedOnly)}>
                        <CheckCircle2 className="size-3.5" />
                        Enriched only
                      </Button>
                      {activeSearchFilterCount > 0 && (
                        <button
                          className="text-xs text-muted-foreground underline hover:text-foreground"
                          onClick={() => { setFilterHasPhone(false); setFilterHasEmail(false); setFilterCategory(""); setFilterLocation(""); setFilterEnrichedOnly(false); }}
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {displayCompanies.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">
                    {filterEnrichedOnly ? "No enriched companies found — clear the filter to see all results." : "No companies found. Try a different category or location."}
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {displayCompanies.map((company) => (
                    <CompanySection
                      key={company.id}
                      company={company}
                      showAll={showAll || filterEnrichedOnly}
                      selected={selected}
                      onToggle={toggleContact}
                      onSaveContact={addToCRM}
                      onAddContactToList={openListPicker}
                      savingIds={savingIds}
                      addedToCrmIds={addedToCrmIds}
                      onClickEnrichedBadge={() => setFilterEnrichedOnly(true)}
                      onRevealContact={(c) => revealContacts([c.id])}
                      revealingIds={revealingIds}
                      onFindPeople={searchTab === "companies" ? () => findPeopleForCompany(company) : undefined}
                      isFindingPeople={findingCompanyIds.has(company.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!hasSearched && !isSearchPending && (
            <Card className="p-10 text-center">
              <Search className="size-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-medium">Find decision-makers with Seamless.AI</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
                Type who you're looking for in the AI Search box (e.g. “Finance CEOs in Texas with more than 500 employees”),
                or set filters above and hit Search. Results are free — reveal email &amp; phone on demand (~1 credit each),
                then add the best leads straight to your CRM.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ── Saved Tab ── */}
      {viewTab === "saved" && (
        <div className="flex flex-col md:flex-row gap-4 min-h-[400px]">
          {/* ── List selector: horizontal pill-tabs on mobile, sidebar on md+ ── */}
          <div className="md:w-52 shrink-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1 hidden md:block">Lists</p>

            {/* Scrollable nav row (mobile) / stacked column (desktop) */}
            <div className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0 md:space-y-0.5 md:gap-0">

              {/* All Saved */}
              <button
                onClick={() => setSelectedListId(null)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full md:rounded-md px-3 md:px-2.5 py-1.5 text-sm transition-colors whitespace-nowrap ${
                  selectedListId === null
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted text-foreground border md:border-0"
                }`}
              >
                <Bookmark className="size-3.5" />All Saved
                <span className="text-xs text-muted-foreground ml-1">{savedProspects.length}</span>
              </button>

              {/* Named lists */}
              {prospectLists.map((list) => (
                <div key={list.id} className="group relative shrink-0">
                  {renamingListId === list.id ? (
                    <form
                      className="flex gap-1 shrink-0"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renameListName.trim()) renameListMutation.mutate({ listId: list.id, name: renameListName.trim() });
                      }}
                    >
                      <Input
                        autoFocus
                        value={renameListName}
                        onChange={(e) => setRenameListName(e.target.value)}
                        className="h-7 text-xs w-32 min-w-0"
                        onKeyDown={(e) => { if (e.key === "Escape") { setRenamingListId(null); setRenameListName(""); } }}
                      />
                      <Button type="submit" size="sm" className="h-7 px-2 shrink-0" disabled={renameListMutation.isPending}>
                        <Check className="size-3" />
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={() => { setRenamingListId(null); setRenameListName(""); }}>
                        <X className="size-3" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <button
                        onClick={() => setSelectedListId(list.id)}
                        className={`w-full flex items-center gap-1.5 rounded-full md:rounded-md px-3 md:px-2.5 py-1.5 text-sm transition-colors whitespace-nowrap ${
                          selectedListId === list.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground border md:border-0"
                        }`}
                      >
                        <FolderOpen className="size-3.5 shrink-0" />
                        <span className="truncate max-w-[120px]">{list.name}</span>
                        <span className="text-xs text-muted-foreground ml-1">{list.count}</span>
                      </button>
                      <div className="absolute -right-1 -top-1 hidden group-hover:flex items-center gap-0.5 z-10">
                        <button
                          onClick={() => { setRenamingListId(list.id); setRenameListName(list.name); }}
                          className="flex items-center justify-center size-4 rounded-full bg-blue-100 text-blue-500 hover:bg-blue-200"
                          title="Rename list"
                        >
                          <Edit2 className="size-2.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete list "${list.name}"? Prospects won't be deleted.`)) deleteListMutation.mutate(list.id); }}
                          className="flex items-center justify-center size-4 rounded-full bg-red-100 text-red-500 hover:bg-red-200"
                          title="Delete list"
                        >
                          <X className="size-2.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* New List — always visible */}
              {showNewListInput ? (
                <form
                  className="flex gap-1 shrink-0"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newListName.trim()) createListMutation.mutate(newListName.trim());
                  }}
                >
                  <Input
                    ref={newListInputRef}
                    autoFocus
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="List name…"
                    className="h-7 text-xs w-28 min-w-0"
                    onKeyDown={(e) => { if (e.key === "Escape") { setShowNewListInput(false); setNewListName(""); }}}
                  />
                  <Button type="submit" size="sm" className="h-7 px-2 shrink-0" disabled={createListMutation.isPending}>
                    <Check className="size-3" />
                  </Button>
                </form>
              ) : (
                <button
                  onClick={() => { setShowNewListInput(true); setTimeout(() => newListInputRef.current?.focus(), 50); }}
                  className="shrink-0 flex items-center gap-1.5 px-3 md:px-2.5 py-1.5 rounded-full md:rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border md:border-0 whitespace-nowrap"
                >
                  <Plus className="size-3.5" /> New list
                </button>
              )}
            </div>
          </div>

          {/* ── Right: Prospect Cards ── */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Toolbar */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Search by name or company…"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="max-w-xs h-8 text-sm"
                />

                {/* Sort */}
                <div className="relative">
                  <select
                    value={savedSortBy}
                    onChange={(e) => setSavedSortBy(e.target.value as typeof savedSortBy)}
                    className="h-8 rounded-md border border-input bg-transparent pl-2 pr-6 text-xs appearance-none"
                  >
                    <option value="name_asc">Name A → Z</option>
                    <option value="category_asc">By category</option>
                    <option value="location_asc">By country</option>
                    <option value="phone_first">Phone first</option>
                    <option value="email_first">Email first</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-2 size-3 text-muted-foreground" />
                </div>

                {/* Filter toggle button */}
                <Button
                  size="sm"
                  variant={activeSavedFilterCount > 0 ? "default" : "outline"}
                  className="gap-1 h-8 text-xs"
                  onClick={() => {
                    const hasFilters = activeSavedFilterCount > 0;
                    if (hasFilters) {
                      setSavedFilterHasPhone(false);
                      setSavedFilterHasEmail(false);
                      setSavedFilterCategory("");
                      setSavedFilterLocation("");
                    }
                  }}
                >
                  <SlidersHorizontal className="size-3.5" />
                  {activeSavedFilterCount > 0 ? `${activeSavedFilterCount} filter${activeSavedFilterCount > 1 ? "s" : ""} — clear` : "Filters"}
                </Button>

                <Button size="sm" variant="outline" className="gap-1 h-8 text-xs ml-auto" onClick={exportCsv}>
                  <Download className="size-3.5" /> Export CSV
                </Button>
              </div>

              {/* Quick filter chips */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSavedFilterHasPhone((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${savedFilterHasPhone ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}
                >
                  <Phone className="size-3" /> Has phone
                </button>
                <button
                  onClick={() => setSavedFilterHasEmail((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${savedFilterHasEmail ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}
                >
                  <Mail className="size-3" /> Has email
                </button>
                {savedCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSavedFilterCategory(savedFilterCategory === cat ? "" : cat)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${savedFilterCategory === cat ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:text-foreground hover:border-foreground/40"}`}
                  >
                    {cat}
                  </button>
                ))}
                {savedLocations.length > 1 && (
                  <div className="relative">
                    <select
                      value={savedFilterLocation}
                      onChange={(e) => setSavedFilterLocation(e.target.value)}
                      className="h-6 rounded-full border border-input bg-background pl-2.5 pr-5 text-xs appearance-none text-muted-foreground"
                    >
                      <option value="">All countries</option>
                      {savedLocations.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-1.5 top-1.5 size-3 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Result count */}
              {(activeSavedFilterCount > 0 || filterText) && (
                <p className="text-xs text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{filteredSaved.length}</span> of {currentViewSource.length} prospects
                </p>
              )}
            </div>

            {/* Cards */}
            {filteredSaved.length === 0 ? (
              <Card className="p-10 text-center">
                <Bookmark className="size-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">
                  {selectedListId
                    ? "This list is empty. Add prospects from All Saved."
                    : savedProspects.length === 0
                      ? "No saved prospects yet. Search and save contacts."
                      : "No results match your filters."}
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredSaved.map((p) => (
                    <Card key={p.id} className="p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelectedSavedProspect(p)}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{p.name}</span>
                            {p.company && <span className="text-xs text-muted-foreground">{p.company}</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                            {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="size-3" />{p.email}</a>}
                            {p.phone && <a href={`tel:${p.phone}`} className="flex items-center gap-1 hover:text-foreground"><Phone className="size-3" />{formatPhone(p.phone)}</a>}
                            {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground"><Globe className="size-3" />{p.website.replace(/^https?:\/\/(www\.)?/, "").slice(0, 30)}</a>}
                            {p.sourceUrl && p.sourceUrl.includes("linkedin") && <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground"><Linkedin className="size-3 text-[#0A66C2]" />LinkedIn</a>}
                          </div>
                          <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{p.category}</span><span>·</span><span>{p.location}</span>
                            {p.source && <><span>·</span><span>{p.source}</span></>}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Add to list dropdown */}
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                              onClick={(e) => { e.stopPropagation(); setOpenAddToList(openAddToList === p.id ? null : p.id); }}
                              disabled={prospectLists.length === 0}
                              title={prospectLists.length === 0 ? "Create a list first" : "Add to list"}
                            >
                              <ListPlus className="size-3.5" />
                            </Button>
                            {openAddToList === p.id && prospectLists.length > 0 && (
                              <div className="absolute right-0 top-8 z-20 w-44 rounded-md border bg-popover shadow-md py-1">
                                <p className="text-[11px] font-semibold text-muted-foreground px-3 py-1 uppercase tracking-wide">Add to list</p>
                                {prospectLists.map((list) => (
                                  <button
                                    key={list.id}
                                    onClick={(e) => { e.stopPropagation(); addToListMutation.mutate({ listId: list.id, prospectId: p.id }); }}
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2"
                                  >
                                    <FolderOpen className="size-3.5 text-muted-foreground" />
                                    <span className="truncate">{list.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Remove from list (only when viewing a named list) */}
                          {selectedListId && (
                            <Button size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                              title="Remove from this list"
                              onClick={(e) => { e.stopPropagation(); removeFromListMutation.mutate({ listId: selectedListId, prospectId: p.id }); }}
                            >
                              <X className="size-3.5" />
                            </Button>
                          )}
                          {/* Delete prospect */}
                          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-700 h-7 w-7 p-0"
                            title="Delete prospect permanently"
                            onClick={(e) => { e.stopPropagation(); if (confirm("Delete this prospect permanently?")) deleteMutation.mutate(p.id); }}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add to List Dialog ── */}
      <Dialog open={!!listPickerContact} onOpenChange={(open) => { if (!open) setListPickerContact(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Add to a List</DialogTitle>
            {listPickerContact && (
              <DialogDescription className="flex items-center gap-1.5 text-sm">
                <Building2 className="size-3.5 shrink-0" />
                <span className="font-medium text-foreground">{listPickerContact.fullName}</span>
                {listPickerContact.companyName && (
                  <span className="text-muted-foreground">at {listPickerContact.companyName}</span>
                )}
              </DialogDescription>
            )}
          </DialogHeader>

          {listPickerSaving ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Saving contact…
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {prospectLists.length === 0 && !showNewListInPicker && (
                <p className="text-sm text-muted-foreground text-center py-3">No lists yet — create one below.</p>
              )}
              {prospectLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => addToListFromPicker(list.id)}
                  disabled={listPickerAdding}
                  className="w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center gap-2">
                    {listPickerAdding ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <FolderOpen className="size-4 text-muted-foreground" />}
                    <span className="font-medium">{list.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{list.count} contacts</span>
                </button>
              ))}

              {showNewListInPicker ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => { e.preventDefault(); createListAndAddFromPicker(); }}
                >
                  <Input
                    autoFocus
                    value={newListNameForPicker}
                    onChange={(e) => setNewListNameForPicker(e.target.value)}
                    placeholder="e.g. Immigration Attorneys"
                    className="h-9 text-sm flex-1"
                    onKeyDown={(e) => { if (e.key === "Escape") setShowNewListInPicker(false); }}
                  />
                  <Button type="submit" size="sm" className="h-9 px-3 gap-1.5" disabled={!newListNameForPicker.trim() || listPickerAdding}>
                    {listPickerAdding ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Create
                  </Button>
                </form>
              ) : (
                <button
                  onClick={() => setShowNewListInPicker(true)}
                  disabled={listPickerAdding}
                  className="w-full flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <Plus className="size-4" /> Create new list
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Saved Prospect Detail Dialog ── */}
      <Dialog open={!!selectedSavedProspect} onOpenChange={(open) => { if (!open) setSelectedSavedProspect(null); }}>
        <DialogContent className="max-w-sm">
          {selectedSavedProspect && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selectedSavedProspect.name}</DialogTitle>
                {selectedSavedProspect.company && (
                  <DialogDescription className="flex items-center gap-1.5">
                    <Building2 className="size-3.5 shrink-0" />
                    <span>{selectedSavedProspect.company}</span>
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="space-y-3 pt-1">
                {/* Contact info rows */}
                <div className="space-y-2 text-sm">
                  {selectedSavedProspect.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="size-4 text-muted-foreground shrink-0" />
                      <a href={`mailto:${selectedSavedProspect.email}`} className="text-primary hover:underline break-all">
                        {selectedSavedProspect.email}
                      </a>
                    </div>
                  )}
                  {selectedSavedProspect.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 text-muted-foreground shrink-0" />
                      <a href={`tel:${selectedSavedProspect.phone}`} className="hover:underline">
                        {formatPhone(selectedSavedProspect.phone)}
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <PhoneOff className="size-4 text-red-400/70 shrink-0" />
                      <span className="text-xs italic">No phone number</span>
                    </div>
                  )}
                  {selectedSavedProspect.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="size-4 text-muted-foreground shrink-0" />
                      <a href={selectedSavedProspect.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                        {selectedSavedProspect.website.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    </div>
                  )}
                  {selectedSavedProspect.sourceUrl?.includes("linkedin") && (
                    <div className="flex items-center gap-2">
                      <Linkedin className="size-4 text-[#0A66C2] shrink-0" />
                      <a href={selectedSavedProspect.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                  {selectedSavedProspect.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{selectedSavedProspect.address}</span>
                    </div>
                  )}
                </div>

                {/* Meta tags */}
                <div className="flex flex-wrap gap-1.5 pt-1 border-t text-xs text-muted-foreground">
                  {selectedSavedProspect.category && <span className="rounded-full bg-muted px-2 py-0.5">{selectedSavedProspect.category}</span>}
                  {selectedSavedProspect.location && <span className="rounded-full bg-muted px-2 py-0.5">{selectedSavedProspect.location}</span>}
                  {selectedSavedProspect.source && <span className="rounded-full bg-muted px-2 py-0.5">{selectedSavedProspect.source}</span>}
                </div>

                {/* Notes */}
                {selectedSavedProspect.notes && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground italic">
                    {selectedSavedProspect.notes}
                  </div>
                )}

                {/* Quick actions */}
                <div className="flex gap-2 pt-1">
                  {selectedSavedProspect.email && (
                    <Button size="sm" className="gap-1.5 flex-1" asChild>
                      <a href={`mailto:${selectedSavedProspect.email}`}>
                        <Mail className="size-3.5" /> Email
                      </a>
                    </Button>
                  )}
                  {selectedSavedProspect.phone && (
                    <Button size="sm" variant="outline" className="gap-1.5 flex-1" asChild>
                      <a href={`tel:${selectedSavedProspect.phone}`}>
                        <Phone className="size-3.5" /> Call
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
