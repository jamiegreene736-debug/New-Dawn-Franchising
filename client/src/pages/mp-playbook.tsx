import { useState } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Mail,
  MessageCircle,
  Phone,
  Printer,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  day: string;
  channel: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  tagline: string;
  why: string;
  howTo: string[];
  script: string;
  tip: string;
  portalLabel?: string;
  portalTab?: string;
  externalLabel?: string;
  externalUrl?: string;
}

// ─── Sequence data ────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: "email",
    day: "Day 1",
    channel: "Cold Email",
    icon: Mail,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    tagline: "Start wide. Low friction. Sets the stage for everything after.",
    why:
      "Email is the lowest-friction first touch — it reaches the most people with the least effort and gives homeowners a way to respond on their own time. A good first email doesn't sell anything; it simply opens the door. The goal here is visibility, not an immediate yes.",
    howTo: [
      "Go to the Outreach tab → Email Campaigns.",
      "Select your territory homeowner list (pre-loaded for your area).",
      "Pick the 'Property Management Introduction' template and personalise the first line with the homeowner's street name.",
      "Set the send time to 9–11 AM or 6–8 PM local time (highest open rates).",
      "Enable automatic follow-up #2 for any lead who opens but doesn't reply within 3 days.",
      "Launch the campaign. The portal handles deliverability and tracking.",
    ],
    script:
      "Subject: Quick question about [Street Name]\n\nHi [First Name],\n\nI noticed you own a property on [Street Name] — I'm reaching out because we help El Paso homeowners maximise their rental income while completely stepping back from day-to-day management.\n\nWould you be open to a 10-minute conversation this week? No pressure at all.\n\n— [Your Name]\nNew Dawn Property Management",
    tip: "Keep the subject line hyper-local (street name, neighbourhood). Local specificity dramatically improves open rates compared to generic subject lines.",
    portalLabel: "Open Email Campaigns",
    portalTab: "outreach",
  },
  {
    id: "mailer",
    day: "Day 1 (submit now — arrives Day 5–7)",
    channel: "Physical Mailer",
    icon: Printer,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    tagline: "Submit today. It lands in their hands right as your digital touches are warming them up.",
    why:
      "Physical mail has a 90%+ open rate — people almost always open what arrives in their mailbox. It also signals permanence and professionalism: a real company with a real address sending a real piece of mail. Submitting on Day 1 means the mailer arrives right when your email has already been seen, creating a powerful 1-2 punch.",
    howTo: [
      "Go to the Letters tab → Physical Mail.",
      "Select the same homeowner list you emailed in Step 1.",
      "Choose the 'Introduction Postcard' or 'Rent Maximiser Letter' design.",
      "Review the personalised preview (name, address auto-filled).",
      "Approve the creative — our team handles print, addressing, postage, and delivery.",
      "Production takes 2–3 business days; allow 5–7 days total delivery time.",
    ],
    script:
      "[Front of postcard]\nAre you getting the most out of your El Paso rental property?\n\n[Back of postcard]\nHi [Name],\n\nNew Dawn Property Management handles everything — leasing, tenant communication, maintenance coordination, and monthly reporting — so you don't have to.\n\n✓ No management headaches\n✓ Consistent monthly income\n✓ Full transparency\n\nScan to learn more: [QR code → your landing page]\nOr call us: [Your Number]",
    tip: "Include a QR code on the postcard linking to a simple landing page. Scans are trackable — any homeowner who scans is a hot lead worth following up by phone or WhatsApp immediately.",
    portalLabel: "Open Physical Mail",
    portalTab: "letters",
  },
  {
    id: "sms",
    day: "Day 4",
    channel: "SMS Text",
    icon: MessageCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    tagline: "98% open rate. Nothing cuts through like a text.",
    why:
      "By Day 4 most people have seen your email (even if they haven't replied) and your mailer is in transit. An SMS creates urgency and feels more personal than email. Keep it very short — 2-3 lines maximum. Long texts get deleted.",
    howTo: [
      "Go to Outreach → SMS/Text.",
      "Filter to leads who opened your email but haven't replied yet (portal tracks this automatically).",
      "Choose the 'Warm Follow-up' SMS template.",
      "Personalise the first line — use their first name.",
      "Schedule for 10 AM–12 PM or 5–7 PM (never early morning or late night).",
      "Enable opt-out compliance footer — required by law and already built into the template.",
    ],
    script:
      "Hi [First Name], this is [Your Name] from New Dawn Property Mgmt in El Paso. I sent you a quick note earlier this week — just following up to see if managing your property on [Street] is something you'd want to talk through. Happy to keep it brief! 😊",
    tip: "Text is conversational. Don't make it sound like a corporation sent it. Write it exactly how you'd text a neighbour.",
    portalLabel: "Open SMS Outreach",
    portalTab: "outreach",
  },
  {
    id: "whatsapp",
    day: "Day 7",
    channel: "WhatsApp",
    icon: Phone,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    tagline: "More personal than SMS. Supports PDFs, images, and voice notes.",
    why:
      "WhatsApp feels personal — it's the same app people use to talk to family. It's especially effective with leads who appear to have international ties (common in El Paso's E-2 investor community). You can also share a short PDF or a photo of your results dashboard, which adds credibility you can't get in a plain text.",
    howTo: [
      "Go to Outreach → WhatsApp.",
      "Select leads who haven't responded to email or SMS.",
      "Use the 'WhatsApp Intro' template — it's shorter and more conversational than email.",
      "Optional: attach the 'New Dawn Results Overview' PDF (available in Documents).",
      "Send during business hours only.",
      "If they reply, move the conversation to a real-time chat. Don't use another template — talk to them.",
    ],
    script:
      "Hi [First Name] — I'm [Your Name] from New Dawn Property Management here in El Paso. I reached out by email and text earlier this week. We help property owners like yourself hand off the day-to-day and focus on what matters.\n\nWould you have 10 mins for a quick call this week? I can work around your schedule completely.\n\nHappy to send over a short overview if that'd be helpful 📄",
    tip: "If you have a short (60–90 second) video of yourself on your phone, send it here. A personal video introduction converts at a significantly higher rate than text alone.",
    portalLabel: "Open WhatsApp Outreach",
    portalTab: "outreach",
  },
  {
    id: "linkedin",
    day: "Day 10",
    channel: "LinkedIn",
    icon: Users,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    tagline: "Reach property-owning professionals on their professional turf.",
    why:
      "LinkedIn works best for landlords who have a professional profile — business owners, investors, executives. A connection request with a personalised note feels completely natural in a professional context, whereas the same message on Facebook might feel invasive. Don't pitch on the connection request — connect first, then follow up.",
    howTo: [
      "Search LinkedIn for 'real estate investor El Paso' or 'landlord El Paso Texas'.",
      "Also search your known leads by name to see if they have profiles.",
      "Send a connection request with a short personalised note (see script below).",
      "Wait 2–3 days after they accept, then send your follow-up message.",
      "Log the interaction in the portal's Leads tab so your activity is tracked.",
      "Do not send more than 15–20 connection requests per day (LinkedIn may flag aggressive activity).",
    ],
    script:
      "Connection note:\n\"Hi [Name] — I run a property management franchise in El Paso and came across your profile. Always interested in connecting with property investors in the area. No pitch, just expanding my network. Hope to connect!\"\n\nFollow-up (after they accept):\n\"Thanks for connecting, [Name]! I'll keep this brief — we manage rental properties in El Paso for owners who want consistent income without the day-to-day headache. If that's ever something you'd want to explore, I'm happy to chat. If not, no worries at all — great to be connected either way.\"",
    tip: "Your LinkedIn profile should look polished before you start this. Add your title, a professional headshot, and a one-line description of what New Dawn does. Leads will check your profile before they accept.",
    externalLabel: "Open LinkedIn",
    externalUrl: "https://www.linkedin.com",
  },
  {
    id: "facebook",
    day: "Day 14",
    channel: "Facebook Remarketing",
    icon: Globe,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    tagline: "Retarget anyone who visited your page but didn't reach out. Stay top of mind.",
    why:
      "By Day 14, some leads have visited your website (from the QR code on your mailer, from clicking your email, or from searching your name) but haven't taken action. Facebook remarketing shows your ad specifically to those people — they see your brand again while scrolling their feed, which reinforces trust and keeps you top of mind when they're finally ready to talk.",
    howTo: [
      "Go to Paid Marketing → Facebook Ads.",
      "Confirm your Facebook Pixel is installed (check with the team if unsure — this is a one-time setup).",
      "Create a 'Custom Audience' from website visitors in the last 30 days.",
      "Create a simple ad using the 'Property Owner Retargeting' template — headline, one line, and your photo.",
      "Set your budget at $5–$10/day. This is a retargeting audience (small and warm), so a small budget goes far.",
      "Run the ad for 2–3 weeks, then review performance in the Reports tab.",
    ],
    script:
      "Ad headline: Still thinking about it?\n\nAd copy: Most El Paso property owners we work with say the same thing — they wish they'd made the call sooner. If you're curious about how New Dawn handles everything for you, let's talk. No pressure.\n\n[Button: Get a Free Consultation]",
    tip: "Use your own face in the Facebook ad creative — not stock photos or logos. Ads with a real person's photo consistently outperform branded imagery in this market.",
    portalLabel: "Open Paid Marketing",
    portalTab: "paid",
  },
  {
    id: "followup",
    day: "Day 21",
    channel: "Personal Follow-up Email",
    icon: Mail,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    tagline: "Most deals close between the 7th and 12th touch. This is where persistence becomes conversion.",
    why:
      "Most people don't ignore your outreach because they're not interested — they ignore it because they're busy and haven't prioritised it yet. A warm, personal follow-up email at Day 21 (not a template blast) often gets a response when nothing else has. Write it yourself. Reference something specific.",
    howTo: [
      "Go to Outreach → Email and open the individual lead records that still haven't replied.",
      "Write each follow-up email manually — no template. Use their name, their street, acknowledge the time that's passed.",
      "Keep it short: 3–4 sentences maximum.",
      "Don't apologise for reaching out. Be confident and friendly.",
      "If they reply negatively, thank them and move them to the DNC list in the portal.",
      "If no reply, move to the monthly nurture loop and stop active outreach.",
    ],
    script:
      "Subject: Re: [Street Name] property\n\nHi [First Name],\n\nJust circling back one last time — I know you've probably seen my earlier notes and haven't had a chance to respond, which is completely fine.\n\nIf managing your property on [Street] ever becomes something you'd want help with, I'm always happy to talk. I won't keep reaching out after this — just wanted to make sure the door stays open.\n\nThanks for your time, [First Name].\n\n— [Your Name]",
    tip: "The phrase 'I won't keep reaching out after this' dramatically increases reply rates. It removes pressure and shows respect — which often prompts a reply from someone who felt overwhelmed by earlier outreach.",
    portalLabel: "Open Outreach",
    portalTab: "outreach",
  },
  {
    id: "nurture",
    day: "Month 2 onwards",
    channel: "Monthly Nurture Loop",
    icon: Zap,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    tagline: "Not every lead is ready today. The nurture loop converts them when they are.",
    why:
      "A homeowner who doesn't respond in month 1 might be mid-lease, dealing with a personal situation, or just not prioritising it yet. Keeping them in a low-frequency nurture loop means you're the first call they make when they're finally ready — which might be 3, 6, or 12 months from now.",
    howTo: [
      "Move non-converting leads to the 'Nurture' segment in your Leads tab.",
      "Set up a monthly email newsletter via the portal (one send per month — market update, tips, your results).",
      "Run a seasonal physical mailer campaign each quarter (4 times per year).",
      "Keep your Facebook remarketing ad running at $5/day — it covers everyone who has ever visited your page.",
      "Any lead that replies or visits your page again should be immediately moved to active outreach and restarted from Step 3.",
    ],
    script:
      "Monthly newsletter subject ideas:\n• 'El Paso rental market update — [Month]'\n• 'How much should your property earn this quarter?'\n• 'What good property management actually looks like'\n• '3 mistakes El Paso landlords make (and how to avoid them)'\n\nKeep newsletters under 200 words. Add one clear CTA: 'Reply to this email to chat.'",
    tip: "Nurture is a volume game. 10% of your non-converting leads will convert within 12 months if you stay consistent. That's real revenue from leads you've already paid to acquire.",
    portalLabel: "Open Pipeline",
    portalTab: "pipeline",
  },
];

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  index,
  onNavigate,
}: {
  step: Step;
  index: number;
  onNavigate: (tab: string) => void;
}) {
  const [open, setOpen] = useState(index === 0);
  const Icon = step.icon;

  return (
    <div
      data-testid={`playbook-step-${step.id}`}
      className={`rounded-2xl border-2 ${open ? step.borderColor : "border-gray-100"} bg-white shadow-sm transition-all duration-200`}
    >
      {/* Header */}
      <button
        className="flex w-full items-start gap-4 p-5 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${step.bgColor}`}>
          <Icon className={`size-5 ${step.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
              Step {index + 1}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${step.bgColor} ${step.color}`}>
              {step.day}
            </span>
          </div>
          <p className="mt-1.5 text-base font-bold text-gray-900">{step.channel}</p>
          <p className="mt-0.5 text-sm text-gray-500 leading-snug">{step.tagline}</p>
        </div>
        <div className="mt-1 shrink-0 text-gray-400">
          {open ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-gray-100 px-5 pb-6 pt-4 space-y-5">
          {/* Why */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Why this, why now</p>
            <p className="text-sm text-gray-600 leading-relaxed">{step.why}</p>
          </div>

          {/* How to */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">How to do it</p>
            <ol className="space-y-2">
              {step.howTo.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold ${step.bgColor} ${step.color}`}>
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ol>
          </div>

          {/* Script */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Example script / copy</p>
            <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 border border-gray-100 p-4 text-xs text-gray-700 font-mono leading-relaxed">
              {step.script}
            </pre>
          </div>

          {/* Tip */}
          <div className={`rounded-xl ${step.bgColor} border ${step.borderColor} px-4 py-3 flex gap-3 items-start`}>
            <Sparkles className={`size-4 shrink-0 mt-0.5 ${step.color}`} />
            <p className={`text-xs leading-relaxed ${step.color} font-medium`}>{step.tip}</p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {step.portalLabel && step.portalTab && (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => onNavigate(step.portalTab!)}
              >
                {step.portalLabel}
              </Button>
            )}
            {step.externalLabel && step.externalUrl && (
              <Button size="sm" variant="outline" className="gap-2" asChild>
                <a href={step.externalUrl} target="_blank" rel="noopener noreferrer">
                  {step.externalLabel}
                  <ExternalLink className="size-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Channel overview strip ───────────────────────────────────────────────────

const CHANNELS = [
  { icon: Mail,          label: "Cold Email",      timing: "Day 1",        color: "text-blue-600",    bg: "bg-blue-50"    },
  { icon: Printer,       label: "Physical Mailer", timing: "Day 1 (send)", color: "text-amber-600",   bg: "bg-amber-50"   },
  { icon: MessageCircle, label: "SMS",             timing: "Day 4",        color: "text-green-600",   bg: "bg-green-50"   },
  { icon: Phone,         label: "WhatsApp",        timing: "Day 7",        color: "text-emerald-600", bg: "bg-emerald-50" },
  { icon: Users,         label: "LinkedIn",        timing: "Day 10",       color: "text-sky-600",     bg: "bg-sky-50"     },
  { icon: Globe,         label: "FB Remarketing",  timing: "Day 14",       color: "text-indigo-600",  bg: "bg-indigo-50"  },
  { icon: Mail,          label: "Follow-up Email", timing: "Day 21",       color: "text-violet-600",  bg: "bg-violet-50"  },
  { icon: Zap,           label: "Nurture Loop",    timing: "Month 2+",     color: "text-rose-600",    bg: "bg-rose-50"    },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function MpPlaybook({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [agentDismissed, setAgentDismissed] = useState(false);

  return (
    <div data-testid="mp-playbook" className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outreach Playbook</h1>
        <p className="mt-1 text-sm text-gray-500">
          A step-by-step guide to converting homeowner leads into property management contracts — using every channel available to you in exactly the right order.
        </p>
      </div>

      {/* AI Agent banner */}
      {!agentDismissed && (
        <div className="flex items-start gap-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-100">
            <Bot className="size-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-indigo-900">Using the AI Outreach Agent?</p>
            <p className="mt-0.5 text-sm text-indigo-700 leading-relaxed">
              The AI Agent runs this entire playbook automatically — daily lead discovery, email drafting, WhatsApp execution, and sequence timing. You don't need to follow these steps manually if the agent is active. This guide is for <strong>manual outreach</strong> when you want to run campaigns yourself.
            </p>
          </div>
          <button
            onClick={() => setAgentDismissed(true)}
            className="shrink-0 text-xs text-indigo-400 hover:text-indigo-700 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sequence overview strip */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">The sequence at a glance</p>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-2" style={{ minWidth: "max-content" }}>
            {CHANNELS.map((ch, i) => {
              const Icon = ch.icon;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className={`grid size-10 place-items-center rounded-xl ${ch.bg}`}>
                    <Icon className={`size-4 ${ch.color}`} />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight max-w-[56px]">
                    {ch.label}
                  </span>
                  <span className="text-[10px] text-gray-400 text-center">{ch.timing}</span>
                  {i < CHANNELS.length - 1 && (
                    <div className="absolute" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Most deals require 7–12 touches across multiple channels before a homeowner responds. Run the full sequence before deciding a lead is cold.
        </p>
      </div>

      <div className="border-t border-gray-100" />

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            index={i}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* Footer note */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">
        <p className="text-xs text-gray-400 leading-relaxed">
          This playbook is a guide — not a rigid script. Adjust timing and messaging based on what you learn about your leads. Every market responds slightly differently. Track everything in your Pipeline and review your Results monthly.
        </p>
      </div>
    </div>
  );
}
