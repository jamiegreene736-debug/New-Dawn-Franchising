# Campaign templates: email and consented text

Research reviewed: October 1, 2026. Status: implemented as a template library and paused-draft creation flow. Activating a campaign and enrolling a real audience are separate operator actions.

## Product and campaign strategy

Build three distinct sequences: brokers who can introduce clients, attorneys who can introduce clients, and direct prospective owners. Use concise, professional language, factual personalization, one reply request per message, and a useful review resource. The partner templates go to professionals, not to their newly referred clients. Once someone replies, pause automation and review the conversation. The direct template does not imply a referral or prior inquiry.

Only email and SMS are supported in these templates. The first email offers a guide without an attachment or booking demand. Do not claim an unverified relationship, revenue, portfolio size, guaranteed immigration outcome, reduced investment risk, or compensation agreement. Any broker compensation belongs in its separate signed agreement; the attorney campaign offers no compensation.

The implementation plan was: (1) research copy, reputation and messaging permission; (2) reuse the CRM's existing campaign editor and sender safeguards; (3) implement the three complete sequences and source-backed guidance; (4) create atomic paused drafts and record text permissions; (5) verify persistence, retries, suppression and timing; (6) merge and verify production.

## Cadence and rationale

| Day | Channel | Purpose | Condition |
| --- | --- | --- | --- |
| 0 | Email | Relevant introduction and resource offer | Reviewed fit, valid address, sending readiness |
| 4 | Email | Add useful screening or operating questions | No recorded reply or confirmed meeting |
| 7 | Optional SMS | Offer the resource in a chosen channel | Written marketing permission, exact number, known timezone |
| 11 | Email | Explain handoff or support due diligence | No reply or suppression |
| 16 | Optional SMS | Final small offer | Current permission and at most two texts per 45 days |
| 21 | Email | Respectful closing note | No reply; then complete the sequence |

These are minimum day offsets from enrollment, not six immediate actions. Preserve the gaps from actual accepted sends when capacity or readiness delays a touch. A missed or revoked text permission skips that step and keeps email moving. A confirmed meeting or any recorded reply pauses automation. An opt-out or suppression stops the sequence across channels. No automatic recycling of completed recipients.

This is a cautious pilot design, not a scientifically established New Dawn optimum. Gong's observational work supports concise, relevant copy and small interest requests; older Gong content recommends longer emails, illustrating why context and cohort testing matter. We choose four emails with optional consented texts to start, and test outcomes for this audience. There is no universal best weekday or hour for every recipient.

Email retains the app's existing weekday Central-time windows, recipient and domain pacing, address verification, current qualification, global pause and volume caps. The text window is weekdays 10 AM–4 PM in the recorded recipient timezone. An hourly text-only sweep checks those local windows without releasing off-hours email. Foreign recipients require review of their jurisdiction and provider rules before enrollment; CAN-SPAM alone does not authorize international outreach.

## Flow, exits and re-entry

Enrollment in paused draft -> review audience and content -> activate -> due email -> no reply: next due step -> text permission absent: record skipped text -> continue email -> final email -> completed.

At every touch: suppression or opt-out -> suppressed; recorded inbound reply or meeting -> paused for a human; unresolved provider send -> hold for reconciliation; quiet hours/cap/cooldown -> wait. Opens and clicks do not create consent, trigger texts or trigger a call. A later restart requires a fresh review of fit, permission, prior replies and the cross-campaign contact limits. The template policy allows at most four outreach emails per recipient in 45 days and expires old enrollments after 45 days. Existing cold campaigns retain their three-email policy.

## Email quality and deliverability

There is no universal banned-word list or inbox guarantee. Authentication, reputation, permission, relevance and complaints matter. These are copy-review flags, not a deliverability score.

Avoid/review:
- Guaranteed returns / guaranteed visa / risk-free
- Act now / last chance / limited time when no real deadline exists
- Free money / get rich / passive income / hands-off investment
- Fake Re: or Fwd: on a first message
- ALL CAPS, repeated !!!, clickbait and misleading sender names
- I hope this finds you well / just checking in / exciting opportunity
- Unverified revenue, client counts, funding or attorney referral-fee promises

Prefer:
- One relevant reason to write; one easy reply request
- Plain paragraphs and roughly 60–100 words before the signature/footer
- Truthful, specific subject lines; no attachment in the first email
- Current FDD and signed agreements for terms; independent counsel for immigration
- Sender identity, postal address and easy unsubscribe in every marketing email

SPF, DKIM and DMARC must reflect the real sending mailbox. Keep recipient lists relevant, monitor provider deferrals and verified bounces, and make unsubscribing easy. Google's target is below 0.1% reported Gmail complaints, avoiding 0.3% or above. Those complaint rates do not turn a content review into an inbox probability. Keep the app's campaign spam gauge and observed placement tests separate from copy guidance; accepted delivery is not proof of inbox placement. The SMTP sender already adds a physical address and unsubscribe link/headers; templates add commercial-message identification. Verify live sender readiness before launch.

## Text permission and evidence

A phone number, email open, referral or email reply is not marketing SMS consent. Record prior express written consent for New Dawn and this subject, with the disclosure, source, date, number and timezone. Missing or revoked consent skips the text and keeps the email sequence moving.

The Templates tab records permission already obtained, rather than asking an operator to tick a generic consent box. Save email, exact E.164 phone number, actual consent date, source record, exact disclosure, written evidence, recipient timezone and recording administrator. Disclosures must name New Dawn and marketing/promotional texts. Evidence persists after revocation. Changing the recipient number does not carry consent to the new number. A partner sharing a client number is not that client's consent. An individual conversational reply is not permission for recurring marketing. Include sender identity and STOP instructions in each template text; verify sender registration/use-case approval with the provider before launch.

## Reply content and companion assets

The review resource at https://www.newdawnfranchising.com/partner-review returned HTTP 200 during implementation. The Templates tab includes persona-specific guide replies and client-approved introduction notes alongside the full sequence. Send the current FDD through the existing request/review process. Do not send a confidential client file or an unreviewed attachment with the first email.

**Positive reply from a partner**

Hi [First name],

Thanks. Here is our business review guide: https://www.newdawnfranchising.com/partner-review. It covers the owner's role, operating responsibilities and documents to request. Which business question would you want answered before considering an introduction?

Dylan

**Broker introduction note (use only after client permission)**

Hi Dylan,

[Client name] has asked to be introduced to New Dawn so they can compare the property management franchise with their business goals. With their permission, I've copied them here. They would like to understand [business question]. Please coordinate next steps with them directly.

[Broker name]

**Attorney introduction note (use only after client permission)**

Hi Dylan,

My client [Client name] would like to review the business materials for New Dawn and has authorized this introduction. Please coordinate the business discussion with them directly. I remain their independent immigration counsel. This introduction does not express an eligibility assessment or endorsement of the business.

[Attorney name]

**Positive reply from a direct client**

Hi [First name],

Thanks. The review guide is here: https://www.newdawnfranchising.com/partner-review. We can also provide the current FDD for your review with your advisers. Which part would you like to start with: the owner's role, operating support, or total costs?

Dylan

**Timing objection**

Thanks for letting me know. I'll pause the follow-up. If the timing changes, you can reply here whenever you want to revisit it.

**Decline or opt-out**

Understood. We'll stop this outreach. Thank you for letting us know.

Do not append another pitch to an opt-out response. Save the suppression before considering any required one-time confirmation. Do not enroll a referred client automatically; review that client's own contact permissions and direct-client fit first.

## Measurement and experiments

Track delivered/accepted separately from observed inbox placement. Review qualified replies, client-approved introductions, disclosure requests, opt-outs and verified bounces weekly. Start with a small reviewed cohort; test one subject or CTA at a time. Opens and clicks can be automated and never trigger a text.

Primary partner outcome: client-approved introductions or meaningful requests for review materials. Primary direct-client outcome: relevant replies and current-disclosure requests. Report per recipient and per cohort, with explicit denominators. Count negative replies and opt-outs separately from positive replies; distinguish provider acceptance, actual observed placement and verified bounces. Do not use privacy-distorted open rates as the launch objective.

Start with a small, reviewed audience sized within the existing mailbox caps (for example 25–50 recipients per audience). This is an operational pilot size, not sufficient statistical power for a reliable uplift claim. Review weekly. Test one change at a time within the same persona/source: default subject versus an alternative; guide offer versus a specific review question; after enough data, spacing between follow-ups. Keep recipient timezone and permission constant. Select a winner on qualified replies or introductions per accepted recipient, with complaint/opt-out constraints, rather than opens. Do not mix SMS-opted-in and non-opted-in cohorts when estimating text's effect without accounting for selection bias.

## Implementation and verification

Templates live in shared typed data and are copied into existing drip campaigns/steps in one database transaction. Request UUIDs and a unique database index recover a lost-response retry without creating a second campaign. A retry with changed template/settings returns a conflict. A failed step insert rolls back the whole draft. No contacts are enrolled by template creation and it does not send messages.

New campaigns are paused and retain their template origin/policy on duplication. The UI and API support only email/SMS and time triggers for template campaigns. The dispatcher also checks that restriction. Each optional text looks up current evidence for the same email and normalized phone, applies local hours, respects accepted-touch spacing and text caps, and skips missing/revoked consent with a visible reason. Edited texts still require sender identity and STOP instructions. Unknown or pending send outcomes block retry, including network errors or unreadable provider responses; known failed text attempts are bounded before holding for review.

Existing campaign editing, enrollment, sending readiness, spam gauge, placement tests, sender footer, global pause and DNC remain the review workflow. This feature creates reusable content and drafts; it does not launch an existing audience or certify delivery.

Tests cover all three audience copies, channels, merge fields, email-only copies, request validation, recorded consent, quiet hours/DST, actual-touch spacing, unchanged cold limits, admin-only APIs, persistent draft creation, concurrent retries, transactional rollback, phone/email consent matching and revocation, replies and meetings. Run the relevant type-check, build and outreach tests before merge and verify the deployed template UI/API afterward.

## Research sources

[Gong: 85 million email research](https://www.gong.io/files/gong-guide-how-to-master-cold-email-get-the-data-backed-guide-based-on-85-million-emails.pdf) — Short, relevant messages and interest-based requests are a useful starting point. Observational sales data does not prove the best cadence for New Dawn.

[Google: email sender guidelines](https://support.google.com/a/answer/81126?hl=en) — Use SPF, DKIM and DMARC; monitor complaints and sender reputation. Aim below 0.1% Gmail spam complaints and avoid 0.3% or higher. Bulk marketing senders need one-click unsubscribe.

[Yahoo: sender best practices](https://senders.yahooinc.com/best-practices/) — Send wanted, relevant mail to engaged recipients and honor unsubscribes promptly.

[FTC: CAN-SPAM guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) — Commercial email, including B2B, needs truthful identity and subjects, advertising identification, a postal address and an easy opt-out. Non-U.S. rules may be stricter.

[Quo: SMS consent](https://www.quo.com/blog/sms-consent/) — Record written marketing permission and retain evidence; a collected number alone is insufficient.

[Twilio: messaging policy](https://www.twilio.com/en-us/legal/messaging-policy) — Marketing consent is sender- and subject-specific. Identify the sender and offer a simple STOP opt-out.

[Apple: Mail Privacy Protection](https://www.apple.com/legal/privacy/data/en/mail-privacy-protection/) — Privacy protections make open tracking unreliable for deciding whom to contact.

## Complete sequences

### Broker client introductions

Help business and franchise brokers assess client fit and make a permission-based introduction.

Goal: A relevant client introduction with the client's permission.

#### Day 0: email — Offer a useful comparison

Purpose: Start with relevance and a small reply request.

Subject: client business options

Alternatives: franchise client fit / a referral resource

Preview: A review guide for clients comparing business ownership options.

Hi {{firstName}},

When a client is comparing U.S. businesses, owner responsibilities and operating support can be as important as the asking price.

I'm Dylan at New Dawn Franchising. Our property management franchise is one option to review. I can share a short guide to the questions a client should ask before deciding whether it fits.

Would that be useful for your client reviews?

Dylan Delaney
New Dawn Franchising

#### Day 4: email — Make client fit concrete

Purpose: Give the broker a screening framework.

Subject: questions before an introduction

Alternatives: owner role and fit / your client criteria

Preview: Start with the owner's role, staffing, costs and territory.

Hi {{firstName}},

A useful first screen covers the client's preferred owner role, location, available capital and timeline. The next review should cover staffing, licensing, territory and the current Franchise Disclosure Document (FDD).

If a client is considering an E-2 pathway, their immigration attorney should assess that separately.

Which of those criteria matters most to your clients?

Dylan Delaney
New Dawn Franchising

#### Day 7: optional text — Optional text: review guide

Purpose: Offer the same resource through a consented channel.

Hi {{firstName}}, Dylan at New Dawn Franchising. Would a franchise review guide help with a client comparison? Happy to send it by email. Reply STOP to opt out.

Condition: exact recipient permission and local send window. Otherwise skip.

#### Day 11: email — Explain an introduction

Purpose: Reduce friction without implying a commission agreement.

Subject: a simple client introduction

Alternatives: permission to introduce / how introductions work

Preview: The client stays in control of what they share and review.

Hi {{firstName}},

If New Dawn seems relevant, please ask the client whether they want an introduction before sharing their contact details. An introductory email with their permission and a brief description of what they want to compare is enough to start.

We can then provide current materials and answer business questions. Any broker compensation requires a separate written agreement.

Would you like a short introduction note you can adapt?

Dylan Delaney
New Dawn Franchising

#### Day 16: optional text — Optional text: introduction note

Purpose: Make one final resource offer by text.

Hi {{firstName}}, Dylan at New Dawn Franchising. Want a short client introduction note to adapt? I can send it by email. Reply STOP to opt out.

Condition: exact recipient permission and local send window. Otherwise skip.

#### Day 21: email — Close the sequence

Purpose: Close respectfully and leave an easy route back.

Subject: closing my follow-up

Alternatives: keep the review guide / a resource for later

Preview: Keep the resource if helpful; no further automated follow-up.

Hi {{firstName}},

I'll close this follow-up here. If a client later wants to compare a property management franchise, you can reply for the review guide or current disclosure materials.

An introduction should only happen when the client wants it.

Would you like the guide before I close the loop?

Dylan Delaney
New Dawn Franchising

### Attorney client introductions

Offer immigration attorneys factual business materials for independent review and client-approved introductions.

Goal: An attorney requests review materials or introduces a client who wants to evaluate the business.

#### Day 0: email — Offer independent review materials

Purpose: Offer useful material while preserving counsel's role.

Subject: business review materials

Alternatives: client business review / a franchise review guide

Preview: Business facts for independent attorney and client review.

Hi {{firstName}},

When a client is evaluating a U.S. business, it can help to separate the business facts from immigration advice.

I'm Dylan at New Dawn Franchising. I can share a short property management franchise review guide covering the owner's role, operating support and documents to request. You and your client can evaluate whether it merits further review.

Would that guide be useful to your practice?

Dylan Delaney
New Dawn Franchising

#### Day 4: email — Name the documents to review

Purpose: Invite the attorney's requirements instead of promising eligibility.

Subject: documents for client review

Alternatives: owner role and documents / your review requirements

Preview: Current disclosure documents and operating questions come first.

Hi {{firstName}},

For a business review, start with the current FDD, proposed ownership and management structure, staffing responsibilities, costs and the actual contractual terms. We can answer business questions and identify the materials available for review.

Immigration eligibility and strategy remain with independent counsel; a franchise purchase does not guarantee a visa.

Which document or business question would you want to review first?

Dylan Delaney
New Dawn Franchising

#### Day 7: optional text — Optional text: review materials

Purpose: Offer a factual resource only after recorded marketing consent.

Hi {{firstName}}, Dylan at New Dawn Franchising. Would our business review guide be useful for independent client review? I can email it. Reply STOP to opt out.

Condition: exact recipient permission and local send window. Otherwise skip.

#### Day 11: email — Describe a client-approved handoff

Purpose: Describe a limited handoff without soliciting confidential details.

Subject: a client-approved introduction

Alternatives: client permission first / independent business review

Preview: Introductions require permission; legal advice stays with counsel.

Hi {{firstName}},

If your client wants to evaluate New Dawn, a client-approved introduction is enough to start a business conversation. Please share only the contact details and business questions the client agrees to share.

We do not need immigration files or privileged advice. You retain the legal relationship, and the client decides whether to continue. This outreach offers no attorney referral compensation.

Would a short client introduction note help?

Dylan Delaney
New Dawn Franchising

#### Day 16: optional text — Optional text: business questions

Purpose: Offer help with review questions without requesting sensitive facts.

Hi {{firstName}}, Dylan at New Dawn Franchising. Is there a business document you would want before considering an introduction? Happy to help by email. Reply STOP to opt out.

Condition: exact recipient permission and local send window. Otherwise skip.

#### Day 21: email — Close respectfully

Purpose: End the outreach without pressure.

Subject: closing my follow-up

Alternatives: materials for future review / a resource for clients

Preview: A resource for future review, with no automatic re-enrollment.

Hi {{firstName}},

I'll close my follow-up here. If business review materials would help a future client, you can reply to request the current guide and disclosure documents.

Your client's legal assessment stays independent, and any introduction is their choice.

Would you like the guide to keep on file?

Dylan Delaney
New Dawn Franchising

### Direct client ownership review

Help prospective owners compare responsibilities, support and disclosure materials without pressure or promises.

Goal: The prospect replies with a business question or requests current disclosure materials.

#### Day 0: email — Start with the owner's questions

Purpose: Offer help with comparison instead of demanding a meeting.

Subject: your business options

Alternatives: franchise ownership questions / comparing business ownership

Preview: A guide to the owner's role, operating support and costs.

Hi {{firstName}},

When you compare businesses, it helps to understand what you would do as the owner, what support is available and what the full costs look like.

I'm Dylan at New Dawn Franchising. Our property management franchise is one option to evaluate. I can share a short guide to those questions so you can decide whether a closer look makes sense.

Would that guide help with your comparison?

Dylan Delaney
New Dawn Franchising

#### Day 4: email — Clarify active ownership

Purpose: Clarify responsibilities without presenting a passive investment.

Subject: the owner's role

Alternatives: what ownership involves / your preferred owner role

Preview: Compare responsibilities, staffing and local requirements.

Hi {{firstName}},

Before choosing a franchise, ask who makes business decisions, supervises staff, handles local requirements and carries the financial responsibilities. Operating support does not remove the owner's obligations.

For New Dawn, review those responsibilities alongside the current FDD and proposed agreements rather than relying on an email summary.

Which part of owning and operating the business would you want to understand first?

Dylan Delaney
New Dawn Franchising

#### Day 7: optional text — Optional text: comparison guide

Purpose: Offer a resource on a channel the prospect has chosen.

Hi {{firstName}}, Dylan at New Dawn Franchising. Would a franchise comparison guide help you review the owner's role and costs? I can email it. Reply STOP to opt out.

Condition: exact recipient permission and local send window. Otherwise skip.

#### Day 11: email — Support due diligence

Purpose: Invite informed review without earnings or visa claims.

Subject: before you decide

Alternatives: documents worth reviewing / questions before investing

Preview: Use current documents and independent advisers for your review.

Hi {{firstName}},

A careful review includes the current FDD, total capital needs, fees, territory, staffing, licensing and the signed contractual terms. Your independent advisers can help assess what those mean for you.

If immigration is part of your plans, speak with your own immigration attorney. Buying a franchise does not guarantee a visa, earnings or a particular outcome.

Would you like current disclosure materials to review?

Dylan Delaney
New Dawn Franchising

#### Day 16: optional text — Optional text: disclosure materials

Purpose: Make a final low-pressure offer through consented SMS.

Hi {{firstName}}, Dylan at New Dawn Franchising. Would current disclosure materials help your business review, or is the timing better later? Reply STOP to opt out.

Condition: exact recipient permission and local send window. Otherwise skip.

#### Day 21: email — Leave the decision with the client

Purpose: End the automated sequence and respect the prospect's timing.

Subject: closing my follow-up

Alternatives: when the timing fits / your review, your timing

Preview: Reply whenever a business comparison becomes relevant.

Hi {{firstName}},

I'll close this follow-up here. If you'd like to revisit New Dawn, you can reply for the review guide or current disclosure materials. Take the time you need to compare the business with your goals and advisers.

Would you prefer the guide now, or to leave it for later?

Dylan Delaney
New Dawn Franchising
