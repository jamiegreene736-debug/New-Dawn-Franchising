import { useState } from "react";
import {
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
  BookOpen,
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
  actionLabel?: string;
  actionUrl?: string;
  externalLabel?: string;
  externalUrl?: string;
}

// ─── Sequence data (investor & referral partner audience) ─────────────────────

const STEPS: Step[] = [
  {
    id: "email",
    day: "Day 1",
    channel: "Cold Email",
    icon: Mail,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    tagline: "Start wide. Non-intrusive. Lets the prospect engage on their own timeline.",
    why:
      "Email is still the highest-volume, lowest-friction first touch for both investors and referral partners. For immigration attorneys and consultants, a professional, concise email positions you as a serious business partner — not a cold solicitation. For investors, it opens the door without pressure.",
    howTo: [
      "Go to Campaigns → Email and select the right template (see scripts below).",
      "For immigration attorneys/consultants: use the 'Referral Partner Intro' template.",
      "For potential investors: use the 'E-2 Franchise Opportunity' template.",
      "Personalise the opening line — reference their firm name, practice area, or how you found them.",
      "Set the send time for 9–11 AM or 1–3 PM on a Tuesday, Wednesday, or Thursday.",
      "Enable the automatic 3-day follow-up drip for any lead who opens but doesn't reply.",
    ],
    script:
      "--- FOR IMMIGRATION ATTORNEYS / CONSULTANTS ---\nSubject: E-2 franchise opportunity for your clients — New Dawn Franchising\n\nHi [Name],\n\nI'm reaching out because your firm works with E-2 visa applicants, and I wanted to introduce a franchise opportunity your clients may find relevant.\n\nNew Dawn Franchising offers a $225,000 property management franchise in El Paso, Texas — specifically structured for E-2 investors. We handle the day-to-day operations, provide FDD documentation, and support the investor through every milestone of their visa application.\n\nWould you be open to a 15-minute call to learn more? Happy to send our FDD and investor overview in the meantime.\n\n— Dylan Delaney\nDirector of Franchise Development\nNew Dawn Franchising LLC\n\n---\n\n--- FOR POTENTIAL INVESTORS ---\nSubject: E-2 visa franchise opportunity — El Paso, Texas\n\nHi [Name],\n\nI came across your profile and wanted to reach out directly — New Dawn Franchising offers a property management franchise in El Paso, Texas starting at $225,000, specifically structured to support E-2 investor visa applications.\n\nYou own the business and direct its strategy. Our experienced team handles day-to-day operations so you can focus on the bigger picture.\n\nWould you have 15 minutes for a conversation? I'm happy to send our investor overview and FDD right away.\n\n— Dylan Delaney\nDirector of Franchise Development, New Dawn Franchising",
    tip: "Send to referral partners first — a single immigration attorney can send you multiple qualified leads every month. One good relationship there is worth dozens of individual investor cold emails.",
  },
  {
    id: "mailer",
    day: "Day 1 (submit now — arrives Day 5–7)",
    channel: "Physical Mailer",
    icon: Printer,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    tagline: "A professional package in the mail signals legitimacy that no email can replicate.",
    why:
      "For immigration law firms and serious investors, a physical packet — franchise overview brochure, FDD summary, and a personal letter — lands differently than a cold email. It takes effort to produce and shows you're a real, established operation. High-value prospects and professional offices pay attention to physical mail in a way they rarely do with email.",
    howTo: [
      "Go to the Letters tab and select the 'Franchise Overview Packet' template.",
      "For attorney offices: address it to the firm's immigration practice lead.",
      "For investors: address to the individual, include the personalised investor letter.",
      "The packet includes: cover letter, franchise overview, FDD summary page, and a QR code to schedule a call.",
      "Approve the layout and submit — our team handles print, folding, addressing, and postage.",
      "Allow 5–7 days for delivery. Mark the expected arrival date in the CRM lead record.",
    ],
    script:
      "Dear [Name / Firm Name],\n\nI wanted to introduce New Dawn Franchising LLC — a property management franchise based in El Paso, Texas, specifically designed to support E-2 investor visa applications.\n\nWe work with investors from across the world who want to live and do business in the United States. Our model is simple: the investor owns and directs the business; our experienced team manages day-to-day operations. It's a real, active business that meets the substantiality and at-risk requirements of the E-2 visa.\n\nI've enclosed a brief overview and an FDD summary. I'd welcome the opportunity to speak with you or your clients directly.\n\n[Scan the QR code to schedule a call] or reply to dylan@newdawnfranchising.com.\n\nSincerely,\nDylan Delaney\nDirector of Franchise Development\nNew Dawn Franchising LLC\n(346) 597-9994",
    tip: "For immigration law firms, send the packet to the named partner or the attorney who leads E-2 visa cases — not the general reception address. Use LinkedIn to find the right contact first.",
  },
  {
    id: "sms",
    day: "Day 4",
    channel: "SMS Text",
    icon: MessageCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    tagline: "A quick, personal text bridge between the email and the deeper conversation.",
    why:
      "By Day 4, your email has been seen. A short SMS is the natural next touch — it feels personal rather than automated, and it gives the prospect an easy way to respond without committing to a call. Keep it conversational and brief.",
    howTo: [
      "Go to Campaigns → SMS and select leads who opened your email but haven't replied.",
      "Use the 'Follow-up' SMS template and personalise the first line.",
      "For attorney contacts: reference the email you sent and keep it professional.",
      "For investors: make it warm and direct.",
      "Send between 10 AM–12 PM or 4–6 PM on a weekday. Never evenings or weekends.",
      "Log the send in the CRM lead activity timeline.",
    ],
    script:
      "--- FOR ATTORNEYS / CONSULTANTS ---\nHi [Name], this is Dylan Delaney from New Dawn Franchising. I sent you an email earlier this week about our E-2 franchise opportunity in El Paso. Happy to send over an FDD summary or jump on a quick call if that works better. Let me know what would be helpful!\n\n--- FOR INVESTORS ---\nHi [Name] — Dylan here from New Dawn Franchising. I reached out by email earlier about our E-2 investor franchise in Texas. Would you have 15 minutes this week for a quick call? I'd love to walk you through the details. No pressure at all.",
    tip: "If you have a CRM note about the prospect (their country of origin, their professional background, a referral source), reference it subtly in the text. Personalisation dramatically increases response rates.",
  },
  {
    id: "whatsapp",
    day: "Day 7",
    channel: "WhatsApp",
    icon: Phone,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    tagline: "Essential for international investors. More personal, richer media, higher open rates.",
    why:
      "A significant portion of E-2 investors are based internationally or have strong international ties. WhatsApp is their primary communication channel — not email, not SMS. Reaching out on WhatsApp signals that you understand their world. You can also send a short PDF overview or an investor brochure directly in the chat.",
    howTo: [
      "Go to Campaigns → WhatsApp in the CRM.",
      "Filter for leads where the country field indicates international presence, or where email/SMS haven't received a response.",
      "Use the 'WhatsApp Investor Intro' template — shorter and more conversational than email.",
      "Attach the 'New Dawn Investor Overview.pdf' (available in Documents) for added credibility.",
      "Send during the prospect's local daytime hours — check the timezone field in the CRM record.",
      "If they respond, move to a live conversation. Don't follow up with more templates.",
    ],
    script:
      "Hi [Name] — I'm Dylan Delaney, Director of Franchise Development at New Dawn Franchising in Texas.\n\nI reached out earlier by email about our E-2 investor franchise opportunity. I wanted to follow up on WhatsApp in case that's easier for you.\n\nIn short: we offer a property management franchise in El Paso, Texas starting at $225,000 — structured specifically for E-2 visa investors. You direct the business; our team handles daily operations.\n\nI'm happy to share our investor overview or schedule a 15-min call at your convenience 📄\n\nWould that be of interest?",
    tip: "Record a short (60-second) personal video introduction on your phone and send it in WhatsApp for your highest-priority leads. A video converts significantly better than any written template.",
  },
  {
    id: "linkedin",
    day: "Day 10",
    channel: "LinkedIn",
    icon: Users,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    tagline: "The best place to reach immigration attorneys, wealth managers, and investor brokers.",
    why:
      "LinkedIn is the single best channel for building referral partner relationships. Immigration attorneys, financial advisors, and business brokers are all active on LinkedIn — and a thoughtful connection request from someone offering a relevant franchise opportunity is a completely natural professional interaction.",
    howTo: [
      "Search LinkedIn for: 'immigration attorney E-2 visa', 'EB-5 attorney', 'business immigration consultant', 'investment advisor Texas'.",
      "Also search for potential investors by job title: 'entrepreneur', 'business owner', or by location.",
      "Send a personalised connection request — never use the default LinkedIn message.",
      "After they accept, wait 2–3 days before sending your follow-up message.",
      "Log every connection and message in the CRM lead record.",
      "Limit yourself to 15–20 connection requests per day to avoid LinkedIn restrictions.",
    ],
    script:
      "CONNECTION REQUEST NOTE:\n\"Hi [Name] — I lead franchise development at New Dawn Franchising, a property management franchise in Texas built for E-2 investors. I'd love to connect with professionals in the immigration and investment space. Hope to be in touch!\"\n\nFOLLOW-UP (after they accept):\n\"Thanks for connecting, [Name].\n\nI wanted to briefly introduce what we offer: a $225,000 property management franchise in El Paso, Texas, specifically structured for E-2 visa applicants. We handle day-to-day operations — the investor owns and directs the business.\n\nIf any of your clients are exploring E-2-eligible investments, I'd love to share our FDD and investor overview. Happy to schedule a quick call whenever works for you. No pressure either way — just wanted to make sure you're aware of what we have available.\"",
    tip: "Post one piece of content per week on your LinkedIn profile — a market update, a client success story, or a short explainer about the E-2 visa franchise model. Referral partners will see it and remember you before they send clients your way.",
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
    tagline: "Retarget every visitor to the franchise website who hasn't booked a call yet.",
    why:
      "By Day 14, some prospects have visited newdawnfranchising.com (from clicking your email, scanning your mailer QR code, or searching you by name) but haven't booked a call. Facebook remarketing shows your ad to those exact people while they scroll — keeping New Dawn top of mind at no wasted spend on cold audiences.",
    howTo: [
      "Go to Paid Marketing → Facebook in the CRM.",
      "Confirm the Facebook Pixel is active on the website (one-time setup — check with the team).",
      "Create a 'Custom Audience' from website visitors in the last 30 days.",
      "Choose the 'Investor Retargeting' ad creative — headline, one-liner, and Dylan's photo.",
      "Set the daily budget to $10–$20/day (small audience, so this goes far).",
      "Monitor click-through rate weekly in the Reports tab and refresh the creative every 3–4 weeks.",
    ],
    script:
      "AD HEADLINE:\nStill exploring E-2 visa franchise options?\n\nAD COPY:\nNew Dawn Franchising offers a property management franchise in El Paso, Texas — structured specifically for E-2 investors. $225K minimum investment. Director-led operations. Full FDD available on request.\n\nIf you've been thinking about it, let's talk. No pressure, no commitment — just a straightforward 15-minute conversation.\n\n[Button: Schedule a Free Call]\n\nAD IMAGE:\nUse Dylan's headshot with the New Dawn logo. Real faces outperform branded imagery for this audience.",
    tip: "Layer a second Facebook audience: upload your CRM email list as a 'Custom Audience' and run the same retargeting ad to people who are already in your pipeline. This keeps warm leads engaged without additional outreach effort from you.",
  },
  {
    id: "followup",
    day: "Day 21",
    channel: "Personal Follow-up Email",
    icon: Mail,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    tagline: "High-value deals often need 7–12 touches. This is the touch that opens conversations.",
    why:
      "Silence after 21 days doesn't mean no. Immigration attorneys are busy. Investors are weighing options. A personal, non-template follow-up at Day 21 — written by Dylan, not generated — creates a human moment that often prompts a response from someone who has been meaning to reply.",
    howTo: [
      "Open the lead record in the CRM and review all prior outreach activity.",
      "Write the follow-up email personally — do not use a template.",
      "Reference the specific context: how you first connected, what you sent, what they may be working on.",
      "Keep it to 3–4 sentences. One question at the end.",
      "If they reply negatively, thank them sincerely and move to DNC.",
      "If no reply, move to the monthly nurture sequence and stop active outreach.",
    ],
    script:
      "--- FOR ATTORNEYS ---\nSubject: Re: New Dawn Franchising — E-2 opportunity\n\nHi [Name],\n\nJust circling back one final time on the New Dawn E-2 franchise opportunity I shared a few weeks ago.\n\nIf any of your clients are currently exploring investments for an E-2 application, I'd be glad to send the FDD and set up a quick call. If the timing isn't right, no worries at all — I appreciate you considering it.\n\n— Dylan\n\n--- FOR INVESTORS ---\nSubject: Re: E-2 franchise — El Paso, TX\n\nHi [Name],\n\nJust one last note before I stop reaching out — I wanted to make sure the door stays open in case the timing ever works for a conversation about the E-2 franchise.\n\nIf you're exploring this now or in the next few months, I'm happy to talk through the details, the FDD, or any questions you have.\n\nThanks for your time either way.\n— Dylan",
    tip: "The 'one last note' framing consistently outperforms standard follow-ups. It removes pressure and triggers reciprocity — people are more likely to reply when they know you're not going to keep emailing them.",
  },
  {
    id: "nurture",
    day: "Month 2 onwards",
    channel: "Monthly Nurture Loop",
    icon: Zap,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    tagline: "Franchise deals and referral relationships rarely close in month 1. Stay present.",
    why:
      "The investment decision for a $225K+ franchise takes time — often 3–12 months from first contact to signed agreement. Referral partners need to trust you before they send clients your way. A consistent monthly presence — educational, not salesy — keeps New Dawn top of mind for the moment they or their clients are ready.",
    howTo: [
      "Move non-converting leads to the 'Nurture' segment in the CRM.",
      "Send a monthly email newsletter (one per month — market update, visa news, success stories).",
      "Send a quarterly physical mailer to your top-priority attorney offices and investor prospects.",
      "Keep the Facebook remarketing ad running at $15/day on your CRM email list and website visitors.",
      "Post 1–2 LinkedIn updates per week to stay visible to your referral partner network.",
      "Any lead that re-engages (clicks an email, visits the site, replies to any message) should be moved back to active outreach immediately.",
    ],
    script:
      "MONTHLY NEWSLETTER SUBJECT IDEAS:\n• 'E-2 visa update — what investors should know this quarter'\n• 'How New Dawn franchisees are building income in El Paso'\n• 'The most common E-2 franchise questions we get (answered)'\n• 'New territory availability — El Paso, Texas'\n• 'What a $225K franchise investment looks like in year 1'\n\nKEEP IT SHORT: Under 200 words. One clear CTA: 'Reply to this email or book a 15-min call.'\n\nFOR ATTORNEY NEWSLETTERS: Add a one-paragraph E-2 regulatory update sourced from USCIS. This adds genuine value and positions you as a knowledgeable partner, not just a vendor.",
    tip: "Track which leads open your newsletters and visit the website. These are your warmest prospects — reach out to them directly within 24 hours with a personal email or call. Intent signals are more valuable than any cold list.",
  },
];

// ─── Channel strip ────────────────────────────────────────────────────────────

const CHANNELS = [
  { icon: Mail,          label: "Cold Email",      timing: "Day 1"         },
  { icon: Printer,       label: "Physical Mail",   timing: "Day 1 (send)"  },
  { icon: MessageCircle, label: "SMS",             timing: "Day 4"         },
  { icon: Phone,         label: "WhatsApp",        timing: "Day 7"         },
  { icon: Users,         label: "LinkedIn",        timing: "Day 10"        },
  { icon: Globe,         label: "FB Remarketing",  timing: "Day 14"        },
  { icon: Mail,          label: "Follow-up",       timing: "Day 21"        },
  { icon: Zap,           label: "Nurture",         timing: "Month 2+"      },
];

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({ step, index }: { step: Step; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const Icon = step.icon;

  return (
    <div
      data-testid={`crm-playbook-step-${step.id}`}
      className={`rounded-2xl border-2 ${open ? step.borderColor : "border-gray-100"} bg-white shadow-sm transition-all duration-200`}
    >
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

      {open && (
        <div className="border-t border-gray-100 px-5 pb-6 pt-4 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Why this, why now</p>
            <p className="text-sm text-gray-600 leading-relaxed">{step.why}</p>
          </div>

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

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Scripts & copy</p>
            <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 border border-gray-100 p-4 text-xs text-gray-700 font-mono leading-relaxed">
              {step.script}
            </pre>
          </div>

          <div className={`rounded-xl ${step.bgColor} border ${step.borderColor} px-4 py-3 flex gap-3 items-start`}>
            <Sparkles className={`size-4 shrink-0 mt-0.5 ${step.color}`} />
            <p className={`text-xs leading-relaxed ${step.color} font-medium`}>{step.tip}</p>
          </div>

          {step.externalLabel && step.externalUrl && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" className="gap-2" asChild>
                <a href={step.externalUrl} target="_blank" rel="noopener noreferrer">
                  {step.externalLabel}
                  <ExternalLink className="size-3" />
                </a>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CrmPlaybook() {
  return (
    <div data-testid="crm-playbook" className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[hsl(var(--primary)/0.08)]">
          <BookOpen className="size-6 text-[hsl(var(--primary))]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outreach Playbook</h1>
          <p className="mt-1 text-sm text-gray-500">
            The recommended sequence for reaching E-2 investors and immigration referral partners — from first touch through long-term nurture. Includes scripts for both audiences.
          </p>
        </div>
      </div>

      {/* Audience pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "E-2 Investors", color: "bg-blue-50 text-blue-700 border-blue-200" },
          { label: "Immigration Attorneys", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
          { label: "Referral Brokers", color: "bg-violet-50 text-violet-700 border-violet-200" },
          { label: "Wealth Managers", color: "bg-sky-50 text-sky-700 border-sky-200" },
        ].map((a) => (
          <span key={a.label} className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${a.color}`}>
            {a.label}
          </span>
        ))}
      </div>

      {/* Channel strip */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">The sequence at a glance</p>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: "max-content" }}>
            {CHANNELS.map((ch, i) => {
              const Icon = ch.icon;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="grid size-10 place-items-center rounded-xl bg-gray-50 border border-gray-100">
                    <Icon className="size-4 text-gray-500" />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight max-w-[60px]">
                    {ch.label}
                  </span>
                  <span className="text-[10px] text-gray-400 text-center">{ch.timing}</span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Most franchise deals close after 7–12 touches. Referral partner relationships take 1–3 months to convert to their first referral. Run the full sequence before writing a lead off.
        </p>
      </div>

      <div className="border-t border-gray-100" />

      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <StepCard key={step.id} step={step} index={i} />
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-center">
        <p className="text-xs text-gray-400 leading-relaxed">
          Scripts are templates — adapt them to fit each prospect. The goal is a genuine conversation, not a broadcast. Every lead in the CRM should be treated as a person, not a contact.
        </p>
      </div>
    </div>
  );
}
