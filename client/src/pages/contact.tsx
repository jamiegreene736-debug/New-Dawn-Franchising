import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

const COMPANY = {
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938",
};

const VISITOR_TYPES = [
  { value: "", label: "Select one…" },
  { value: "investor", label: "I'm an investor exploring the E-2 visa" },
  { value: "attorney", label: "I'm an immigration attorney" },
  { value: "broker", label: "I'm a referring broker / advisor" },
  { value: "other", label: "Other" },
];

const COUNTRIES = [
  "", "Mexico", "Canada", "Colombia", "Argentina", "Brazil", "Chile", "Peru", "Venezuela",
  "Spain", "Germany", "France", "United Kingdom", "Italy", "Portugal", "Netherlands", "Belgium",
  "Turkey", "South Korea", "Japan", "China", "India", "Pakistan", "Australia", "New Zealand",
  "South Africa", "Nigeria", "Kenya", "UAE", "Saudi Arabia", "Israel", "Other",
];

type LeadFormState = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  visitorType: string;
  timeline: string;
  capitalRange: string;
  message: string;
};

const DEFAULTS: LeadFormState = {
  fullName: "",
  email: "",
  phone: "",
  country: "",
  visitorType: "",
  timeline: "",
  capitalRange: "",
  message: "",
};

export default function ContactPage() {
  const { toast } = useToast();
  const [state, setState] = useState<LeadFormState>(DEFAULTS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    if (type === "attorney") {
      setState((s) => ({ ...s, visitorType: "attorney" }));
    } else if (type === "investor") {
      setState((s) => ({ ...s, visitorType: "investor" }));
    }
  }, []);

  function update<K extends keyof LeadFormState>(key: K, value: LeadFormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!state.fullName.trim() || !state.email.trim()) {
      toast({
        title: "Missing info",
        description: "Please add your name and email.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { visitorType, ...rest } = state;
      const payload = {
        ...rest,
        message: [
          visitorType ? `Visitor type: ${VISITOR_TYPES.find((t) => t.value === visitorType)?.label ?? visitorType}` : "",
          rest.message,
        ]
          .filter(Boolean)
          .join("\n"),
      };

      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Something went wrong");
      }

      setSubmitted(true);
      toast({
        title: "Request received",
        description: "We'll be in touch shortly with your overview deck.",
      });
    } catch (err: any) {
      toast({
        title: "Couldn't submit",
        description: err.message || "Please try again or email us directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isAttorney = state.visitorType === "attorney";

  return (
    <div data-testid="page-contact" className="min-h-screen">
      <section data-testid="section-contact-hero" className="border-b">
        <div className="nh-container py-10 md:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <h1 data-testid="contact-title" className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
              Request information
            </h1>
            <p
              data-testid="contact-subtitle"
              className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground md:text-lg"
            >
              Share a few details and we will send you our overview deck and next steps. <span lang="es" className="text-foreground/50">También hablamos español.</span>
            </p>
          </div>

          <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-[1.1fr_.9fr]">
            <Card data-testid="card-contact-form" className="nh-surface nh-noise border-card-border/80 p-6">
              {submitted ? (
                <div data-testid="form-success" className="flex flex-col items-center gap-4 py-10 text-center">
                  <div className="grid size-14 place-items-center rounded-full border bg-[hsl(var(--accent))]/10">
                    <CheckCircle2 className="size-7 text-[hsl(var(--accent))]" />
                  </div>
                  <div className="text-xl font-semibold">Confirmed — we've received your request</div>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Thanks, {state.fullName.split(" ")[0]}! A member of our team will be in touch with you shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label data-testid="label-visitor-type" htmlFor="visitorType">
                      I am a… *
                    </Label>
                    <select
                      data-testid="select-visitor-type"
                      id="visitorType"
                      value={state.visitorType}
                      onChange={(e) => update("visitorType", e.target.value)}
                      required
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {VISITOR_TYPES.map((t) => (
                        <option key={t.value} value={t.value} disabled={t.value === ""}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label data-testid="label-fullname" htmlFor="fullName">
                      Full name *
                    </Label>
                    <Input
                      data-testid="input-fullname"
                      id="fullName"
                      value={state.fullName}
                      onChange={(e) => update("fullName", e.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label data-testid="label-email" htmlFor="email">
                        Email *
                      </Label>
                      <Input
                        data-testid="input-email"
                        id="email"
                        type="email"
                        value={state.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label data-testid="label-phone" htmlFor="phone">
                        Phone (optional)
                      </Label>
                      <Input
                        data-testid="input-phone"
                        id="phone"
                        value={state.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        placeholder="+1 (___) ___-____"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label data-testid="label-country" htmlFor="country">
                      Country of residence
                    </Label>
                    <select
                      data-testid="select-country"
                      id="country"
                      value={state.country}
                      onChange={(e) => update("country", e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Select country…</option>
                      {COUNTRIES.filter(Boolean).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {!isAttorney && (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label data-testid="label-timeline" htmlFor="timeline">
                            Investment timeline
                          </Label>
                          <Input
                            data-testid="input-timeline"
                            id="timeline"
                            value={state.timeline}
                            onChange={(e) => update("timeline", e.target.value)}
                            placeholder="e.g., 3–6 months"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label data-testid="label-capital" htmlFor="capitalRange">
                            Investment range
                          </Label>
                          <Input
                            data-testid="input-capital"
                            id="capitalRange"
                            value={state.capitalRange}
                            onChange={(e) => update("capitalRange", e.target.value)}
                            placeholder="e.g., $225k–$350k"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid gap-2">
                    <Label data-testid="label-message" htmlFor="message">
                      {isAttorney ? "How can we help your client?" : "Notes (optional)"}
                    </Label>
                    <Textarea
                      data-testid="textarea-message"
                      id="message"
                      value={state.message}
                      onChange={(e) => update("message", e.target.value)}
                      placeholder={
                        isAttorney
                          ? "Tell us about your client's situation or your preferred way to collaborate…"
                          : "What are you looking for in a franchise?"
                      }
                      className="min-h-28"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button data-testid="button-submit-lead" type="submit" className="gap-2" disabled={isSubmitting}>
                      <Mail className="size-4" />
                      {isSubmitting ? "Submitting…" : "Send request"}
                    </Button>
                  </div>

                  <div data-testid="text-form-note" className="text-xs text-muted-foreground">
                    By submitting, you're requesting information about the franchise. This is not legal or immigration advice.
                  </div>
                </form>
              )}
            </Card>

            <Card data-testid="card-contact-what" className="nh-surface nh-noise border-card-border/80 p-6">
              <div className="text-sm font-semibold">What happens next</div>
              <div className="mt-4 grid gap-3">
                {(isAttorney
                  ? [
                      { t: "We send you our attorney partnership overview", id: "a1" },
                      { t: "We confirm your client's country and timeline", id: "a2" },
                      { t: "We schedule a brief intro call", id: "a3" },
                      { t: "We provide the FDD and required materials", id: "a4" },
                    ]
                  : [
                      { t: "We send the overview deck + operating model", id: "w1" },
                      { t: "We confirm your timeline and territory interest", id: "w2" },
                      { t: "We schedule a short intro call", id: "w3" },
                      { t: "We share next steps and required materials", id: "w4" },
                    ]
                ).map((x) => (
                  <div
                    key={x.id}
                    data-testid={`row-next-${x.id}`}
                    className="flex items-start gap-3 rounded-2xl border bg-white/60 px-4 py-3"
                  >
                    <CheckCircle2 className="mt-0.5 size-4 text-[hsl(var(--accent))]" />
                    <div className="text-sm text-muted-foreground">{x.t}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border bg-white/60 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Phone className="size-4 text-[hsl(var(--primary))]" />
                    Give us a call
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Call us at <a href={`tel:${COMPANY.phoneTel}`} className="font-semibold text-foreground hover:underline">{COMPANY.phone}</a>
                  </div>
                </div>
                <div className="rounded-2xl border bg-white/60 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Mail className="size-4 text-[hsl(var(--primary))]" />
                    Prefer email?
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    Send a note to <a href={`mailto:${COMPANY.email}`} className="font-semibold text-foreground hover:underline">{COMPANY.email}</a>
                  </div>
                </div>
                <a href={COMPANY.mapsUrl} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border bg-white/60 p-4 transition-colors hover:bg-white/80">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <MapPin className="size-4 text-[hsl(var(--primary))]" />
                    Visit our office
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {COMPANY.addressFull}
                  </div>
                </a>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
