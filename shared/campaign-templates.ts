export const TEMPLATE_OUTREACH_POLICY = "template_drip";

export interface CampaignTemplateStep {
  day: number;
  channel: "email" | "sms";
  name: string;
  purpose: string;
  subject: string;
  alternateSubjects: string[];
  previewText: string;
  body: string;
  cta: string;
}

export interface CampaignTemplate {
  id: string;
  name: string;
  audience: "broker" | "attorney" | "client";
  audienceType: "broker" | "client";
  description: string;
  goal: string;
  enrollment: string;
  steps: CampaignTemplateStep[];
}

const email = (day: number, name: string, subject: string, alternateSubjects: string[], previewText: string, purpose: string, body: string, cta: string): CampaignTemplateStep => ({
  day, channel: "email", name, subject, alternateSubjects, previewText, purpose,
  body: `Hi {{firstName}},\n\n${body}\n\n${cta}\n\nDylan Delaney\nNew Dawn Franchising`, cta,
});
const sms = (day: number, name: string, purpose: string, body: string): CampaignTemplateStep => ({
  day, channel: "sms", name, purpose, subject: "", alternateSubjects: [], previewText: "",
  body: `${body} Reply STOP to opt out.`, cta: "Reply if useful",
});

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "broker-introductions", name: "Broker client introductions", audience: "broker", audienceType: "broker",
    description: "Help business and franchise brokers assess client fit and make a permission-based introduction.",
    goal: "A relevant client introduction with the client's permission.",
    enrollment: "A reviewed broker whose current practice includes clients considering U.S. business ownership. Research relevance before enrollment; never imply an existing relationship.",
    steps: [
      email(0, "Offer a useful comparison", "client business options", ["franchise client fit", "a referral resource"], "A review guide for clients comparing business ownership options.", "Start with relevance and a small reply request.",
        "When a client is comparing U.S. businesses, owner responsibilities and operating support can be as important as the asking price.\n\nI'm Dylan at New Dawn Franchising. Our property management franchise is one option to review. I can share a short guide to the questions a client should ask before deciding whether it fits.", "Would that be useful for your client reviews?"),
      email(4, "Make client fit concrete", "questions before an introduction", ["owner role and fit", "your client criteria"], "Start with the owner's role, staffing, costs and territory.", "Give the broker a screening framework.",
        "A useful first screen covers the client's preferred owner role, location, available capital and timeline. The next review should cover staffing, licensing, territory and the current Franchise Disclosure Document (FDD).\n\nIf a client is considering an E-2 pathway, their immigration attorney should assess that separately.", "Which of those criteria matters most to your clients?"),
      sms(7, "Optional text: review guide", "Offer the same resource through a consented channel.", "Hi {{firstName}}, Dylan at New Dawn Franchising. Would a franchise review guide help with a client comparison? Happy to send it by email."),
      email(11, "Explain an introduction", "a simple client introduction", ["permission to introduce", "how introductions work"], "The client stays in control of what they share and review.", "Reduce friction without implying a commission agreement.",
        "If New Dawn seems relevant, please ask the client whether they want an introduction before sharing their contact details. An introductory email with their permission and a brief description of what they want to compare is enough to start.\n\nWe can then provide current materials and answer business questions. Any broker compensation requires a separate written agreement.", "Would you like a short introduction note you can adapt?"),
      sms(16, "Optional text: introduction note", "Make one final resource offer by text.", "Hi {{firstName}}, Dylan at New Dawn Franchising. Want a short client introduction note to adapt? I can send it by email."),
      email(21, "Close the sequence", "closing my follow-up", ["keep the review guide", "a resource for later"], "Keep the resource if helpful; no further automated follow-up.", "Close respectfully and leave an easy route back.",
        "I'll close this follow-up here. If a client later wants to compare a property management franchise, you can reply for the review guide or current disclosure materials.\n\nAn introduction should only happen when the client wants it.", "Would you like the guide before I close the loop?"),
    ],
  },
  {
    id: "attorney-introductions", name: "Attorney client introductions", audience: "attorney", audienceType: "broker",
    description: "Offer immigration attorneys factual business materials for independent review and client-approved introductions.",
    goal: "An attorney requests review materials or introduces a client who wants to evaluate the business.",
    enrollment: "A reviewed attorney whose current practice includes investor/business immigration. The CRM uses the referral-partner audience track; the copy remains attorney-specific.",
    steps: [
      email(0, "Offer independent review materials", "business review materials", ["client business review", "a franchise review guide"], "Business facts for independent attorney and client review.", "Offer useful material while preserving counsel's role.",
        "When a client is evaluating a U.S. business, it can help to separate the business facts from immigration advice.\n\nI'm Dylan at New Dawn Franchising. I can share a short property management franchise review guide covering the owner's role, operating support and documents to request. You and your client can evaluate whether it merits further review.", "Would that guide be useful to your practice?"),
      email(4, "Name the documents to review", "documents for client review", ["owner role and documents", "your review requirements"], "Current disclosure documents and operating questions come first.", "Invite the attorney's requirements instead of promising eligibility.",
        "For a business review, start with the current FDD, proposed ownership and management structure, staffing responsibilities, costs and the actual contractual terms. We can answer business questions and identify the materials available for review.\n\nImmigration eligibility and strategy remain with independent counsel; a franchise purchase does not guarantee a visa.", "Which document or business question would you want to review first?"),
      sms(7, "Optional text: review materials", "Offer a factual resource only after recorded marketing consent.", "Hi {{firstName}}, Dylan at New Dawn Franchising. Would our business review guide be useful for independent client review? I can email it."),
      email(11, "Describe a client-approved handoff", "a client-approved introduction", ["client permission first", "independent business review"], "Introductions require permission; legal advice stays with counsel.", "Describe a limited handoff without soliciting confidential details.",
        "If your client wants to evaluate New Dawn, a client-approved introduction is enough to start a business conversation. Please share only the contact details and business questions the client agrees to share.\n\nWe do not need immigration files or privileged advice. You retain the legal relationship, and the client decides whether to continue. This outreach offers no attorney referral compensation.", "Would a short client introduction note help?"),
      sms(16, "Optional text: business questions", "Offer help with review questions without requesting sensitive facts.", "Hi {{firstName}}, Dylan at New Dawn Franchising. Is there a business document you would want before considering an introduction? Happy to help by email."),
      email(21, "Close respectfully", "closing my follow-up", ["materials for future review", "a resource for clients"], "A resource for future review, with no automatic re-enrollment.", "End the outreach without pressure.",
        "I'll close my follow-up here. If business review materials would help a future client, you can reply to request the current guide and disclosure documents.\n\nYour client's legal assessment stays independent, and any introduction is their choice.", "Would you like the guide to keep on file?"),
    ],
  },
  {
    id: "direct-client", name: "Direct client ownership review", audience: "client", audienceType: "client",
    description: "Help prospective owners compare responsibilities, support and disclosure materials without pressure or promises.",
    goal: "The prospect replies with a business question or requests current disclosure materials.",
    enrollment: "A relevant, reviewed prospective owner where email outreach is permitted. Prefer expressed interest; never invent a prior inquiry, referral or conversation.",
    steps: [
      email(0, "Start with the owner's questions", "your business options", ["franchise ownership questions", "comparing business ownership"], "A guide to the owner's role, operating support and costs.", "Offer help with comparison instead of demanding a meeting.",
        "When you compare businesses, it helps to understand what you would do as the owner, what support is available and what the full costs look like.\n\nI'm Dylan at New Dawn Franchising. Our property management franchise is one option to evaluate. I can share a short guide to those questions so you can decide whether a closer look makes sense.", "Would that guide help with your comparison?"),
      email(4, "Clarify active ownership", "the owner's role", ["what ownership involves", "your preferred owner role"], "Compare responsibilities, staffing and local requirements.", "Clarify responsibilities without presenting a passive investment.",
        "Before choosing a franchise, ask who makes business decisions, supervises staff, handles local requirements and carries the financial responsibilities. Operating support does not remove the owner's obligations.\n\nFor New Dawn, review those responsibilities alongside the current FDD and proposed agreements rather than relying on an email summary.", "Which part of owning and operating the business would you want to understand first?"),
      sms(7, "Optional text: comparison guide", "Offer a resource on a channel the prospect has chosen.", "Hi {{firstName}}, Dylan at New Dawn Franchising. Would a franchise comparison guide help you review the owner's role and costs? I can email it."),
      email(11, "Support due diligence", "before you decide", ["documents worth reviewing", "questions before investing"], "Use current documents and independent advisers for your review.", "Invite informed review without earnings or visa claims.",
        "A careful review includes the current FDD, total capital needs, fees, territory, staffing, licensing and the signed contractual terms. Your independent advisers can help assess what those mean for you.\n\nIf immigration is part of your plans, speak with your own immigration attorney. Buying a franchise does not guarantee a visa, earnings or a particular outcome.", "Would you like current disclosure materials to review?"),
      sms(16, "Optional text: disclosure materials", "Make a final low-pressure offer through consented SMS.", "Hi {{firstName}}, Dylan at New Dawn Franchising. Would current disclosure materials help your business review, or is the timing better later?"),
      email(21, "Leave the decision with the client", "closing my follow-up", ["when the timing fits", "your review, your timing"], "Reply whenever a business comparison becomes relevant.", "End the automated sequence and respect the prospect's timing.",
        "I'll close this follow-up here. If you'd like to revisit New Dawn, you can reply for the review guide or current disclosure materials. Take the time you need to compare the business with your goals and advisers.", "Would you prefer the guide now, or to leave it for later?"),
    ],
  },
];

export const CAMPAIGN_REPLY_RESOURCES: { audiences: CampaignTemplate["audience"][]; title: string; body: string }[] = [
  { audiences: ["broker", "attorney"], title: "Reply when a partner requests the guide", body: "Hi [First name],\n\nThanks. Here is our business review guide: https://www.newdawnfranchising.com/partner-review. It covers the owner's role, operating responsibilities and documents to request. Which business question would you want answered before considering an introduction?\n\nDylan" },
  { audiences: ["broker"], title: "Client-approved broker introduction note", body: "Hi Dylan,\n\n[Client name] has asked to be introduced to New Dawn so they can compare the property management franchise with their business goals. With their permission, I've copied them here. They would like to understand [business question]. Please coordinate next steps with them directly.\n\n[Broker name]" },
  { audiences: ["attorney"], title: "Client-approved attorney introduction note", body: "Hi Dylan,\n\nMy client [Client name] would like to review the business materials for New Dawn and has authorized this introduction. Please coordinate the business discussion with them directly. I remain their independent immigration counsel. This introduction does not express an eligibility assessment or endorsement of the business.\n\n[Attorney name]" },
  { audiences: ["client"], title: "Reply when a client requests the guide", body: "Hi [First name],\n\nThanks. The review guide is here: https://www.newdawnfranchising.com/partner-review. We can also provide the current FDD for your review with your advisers. Which part would you like to start with: the owner's role, operating support, or total costs?\n\nDylan" },
  { audiences: ["broker", "attorney", "client"], title: "Reply when the timing is later", body: "Thanks for letting me know. I'll pause the follow-up. If the timing changes, you can reply here whenever you want to revisit it." },
];

export const CAMPAIGN_TEMPLATE_GUIDANCE = {
  replyResources: CAMPAIGN_REPLY_RESOURCES,
  researchedAt: "2026-10-01",
  cadence: "Emails on days 0, 4, 11 and 21; optional texts on days 7 and 16. Days are minimum offsets from enrollment. Actual sends may be later because of windows, spacing and safety holds.",
  timing: "Email uses the existing Central-time business windows. Texts require a known recipient timezone and send weekdays 10 AM–4 PM there. This cadence is a pilot hypothesis; compare qualified replies, not opens.",
  stops: "Any recorded reply or confirmed meeting pauses the sequence. Opt-outs and bounces suppress it. No automatic re-entry. Review a later restart with the recipient's permission.",
  sms: "A phone number, email open, referral or email reply is not marketing SMS consent. Record prior express written consent for New Dawn and this subject, with the disclosure, source, date, number and timezone. Missing or revoked consent skips the text and keeps the email sequence moving.",
  quality: "There is no universal banned-word list or inbox guarantee. Authentication, reputation, permission, relevance and complaints matter. These are copy-review flags, not a deliverability score.",
  avoid: ["Guaranteed returns / guaranteed visa / risk-free", "Act now / last chance / limited time when no real deadline exists", "Free money / get rich / passive income / hands-off investment", "Fake Re: or Fwd: on a first message", "ALL CAPS, repeated !!!, clickbait and misleading sender names", "I hope this finds you well / just checking in / exciting opportunity", "Unverified revenue, client counts, funding or attorney referral-fee promises"],
  prefer: ["One relevant reason to write; one easy reply request", "Plain paragraphs and roughly 60–100 words before the signature/footer", "Truthful, specific subject lines; no attachment in the first email", "Current FDD and signed agreements for terms; independent counsel for immigration", "Sender identity, postal address and easy unsubscribe in every marketing email"],
  measurement: "Track delivered/accepted separately from observed inbox placement. Review qualified replies, client-approved introductions, disclosure requests, opt-outs and verified bounces weekly. Start with a small reviewed cohort; test one subject or CTA at a time. Opens and clicks can be automated and never trigger a text.",
  sources: [
    { title: "Gong: 85 million email research", url: "https://www.gong.io/files/gong-guide-how-to-master-cold-email-get-the-data-backed-guide-based-on-85-million-emails.pdf", finding: "Short, relevant messages and interest-based requests are a useful starting point. Observational sales data does not prove the best cadence for New Dawn." },
    { title: "Google: email sender guidelines", url: "https://support.google.com/a/answer/81126?hl=en", finding: "Use SPF, DKIM and DMARC; monitor complaints and sender reputation. Aim below 0.1% Gmail spam complaints and avoid 0.3% or higher. Bulk marketing senders need one-click unsubscribe." },
    { title: "Yahoo: sender best practices", url: "https://senders.yahooinc.com/best-practices/", finding: "Send wanted, relevant mail to engaged recipients and honor unsubscribes promptly." },
    { title: "FTC: CAN-SPAM guide", url: "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business", finding: "Commercial email, including B2B, needs truthful identity and subjects, advertising identification, a postal address and an easy opt-out. Non-U.S. rules may be stricter." },
    { title: "Quo: SMS consent", url: "https://www.quo.com/blog/sms-consent/", finding: "Record written marketing permission and retain evidence; a collected number alone is insufficient." },
    { title: "Twilio: messaging policy", url: "https://www.twilio.com/en-us/legal/messaging-policy", finding: "Marketing consent is sender- and subject-specific. Identify the sender and offer a simple STOP opt-out." },
    { title: "Apple: Mail Privacy Protection", url: "https://www.apple.com/legal/privacy/data/en/mail-privacy-protection/", finding: "Privacy protections make open tracking unreliable for deciding whom to contact." },
  ],
};

export function templateStepValues(template: CampaignTemplate, includeSms: boolean) {
  return template.steps.filter(s => includeSms || s.channel === "email").map((s, index) => ({
    stepOrder: index + 1, delayDays: s.day, stepType: s.channel, stepName: s.name,
    subject: s.subject, previewText: s.previewText || null, triggerType: "time",
    bodyHtml: s.channel === "sms" ? s.body : textToTemplateHtml(s.body) + "<p>Commercial message from New Dawn Franchising.</p>",
  }));
}

function textToTemplateHtml(text: string): string {
  return text.split("\n\n").map(p => `<p>${p.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)).replaceAll("\n", "<br/>")}</p>`).join("");
}
