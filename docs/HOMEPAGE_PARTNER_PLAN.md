# Homepage and professional partner pathways

Current direction: 2026-10-01. Keep attorney and broker acquisition paths while making the public homepage reassuring for referred clients. Preserve the existing navy/gold design, imagery and legal/FDD disclosures.

## Audience and conversion plan

1. Homepage: lead with the property management franchise, owner responsibilities, local support, team and discovery call. Put the business explanation before professional partner recruitment.
2. Navigation: use a simple For Brokers link to the existing /partners route, now dedicated to franchise and business brokers. Keep a separate attorney collaboration anchor and preserve #brokers for older links without a public payout pitch.
3. Professional pathways: concise, separate attorney and broker introductions. Attorneys see relationship continuity, independent review and client confidence; brokers see client fit and the introduction process. No attorney compensation offer.
4. Broker page: request written referral terms through a direct email inquiry or book a conversation. Remove commission figures from public page content, metadata, email subjects/bodies and shared homepage code. Rates are discussed directly using the current agreement and internal partnership guide.
5. Transparency: explain the paid broker relationship in a client-facing homepage disclosure. Ask brokers to explain the payer, calculation and conditions before introduction, answer client questions accurately and obtain permission to share information. Private marketing materials do not replace applicable disclosures.
6. Pricing: invite clients to review a written fee breakdown. Do not claim direct/referred price parity, zero cost or no extra charge without verification of the actual proposal and arrangement.
7. Internal materials: docs/partners/BROKER_REFERRAL_CONVERSATION_GUIDE.md preserves the approved compensation illustration and provides conversation/disclosure guidance. It is not served as a public website asset. No email campaign is sent and no payment contract or commission logic is changed.

## Research and boundaries

Reviewed 2026-10-01. These are marketing design decisions informed by primary sources, not a nationwide legal opinion or approval of any individual arrangement.

- [Clio 2025 Legal Trends Report](https://www.clio.com/resources/legal-trends/read-online/), Part 4: clients value experience, reputation, and clear information; growing firms prioritize satisfaction. Inference: emphasize clarity, less friction, and relationship continuity. The report does not establish that New Dawn increases retention; publish no percentage or guarantee.
- [ABA Model Rule 1.7](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_7_conflict_of_interest_current_clients/): personal financial interests can materially limit representation; some conflicts are not consentable. Model rules are not a substitute for the applicable jurisdiction's rules. Keep the attorney path separate from broker compensation.
- [ABA Model Rule 1.6](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/): representation information is protected, subject to consent and specified exceptions. Start with a professional conversation; obtain appropriate client permission before any introduction or information sharing.
- [Texas Professional Ethics Opinion 536](https://www.law.uh.edu/libraries/ethics/Opinions/501-600/eo536.pdf): rejects a particular ongoing investment-adviser referral-fee arrangement because of conflicts. It concerns investment advisers, not this franchise program; it illustrates why generic attorney commission promises and blanket claims that disclosure cures every conflict are inappropriate.
- [FTC franchise buyer guide](https://www.ftc.gov/business-guidance/resources/consumers-guide-buying-franchise): FDD review is central, generally at least 14 days before signing or paying the franchisor/affiliate. Franchisee financial performance representations belong in Item 19 when made. Broker referral compensation is distinct from franchisee earnings; do not conflate the two or treat the $250,000 example as a revised universal investment price.
- [FTC endorsement guidance](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking): material relationships in endorsements require clear disclosure where applicable. Tell brokers to disclose their financial interest; qualification and any applicable licensing requirements remain subject to written terms and law.
- [U.S. Department of State E visas](https://travel.state.gov/content/travel/en/us-visas/employment/treaty-trader-investor-visa-e.html): E-2 is conditional on individual eligibility, a real enterprise, and developing/directing the business. Preserve attorney assessment, active direction, and no-approval-guarantee language.

## Delivery and acceptance

- Use a clean branch from main and preserve unrelated local work.
- Keep browser metadata and server-rendered content consistent for / and /partners.
- Verify absence of public commission figures in page HTML, metadata, link destinations and inquiry copy; retain a transparent paid-relationship explanation.
- Test homepage and broker page at 375/390/768/1280px, keyboard disclosures, navigation, contact destinations, overflow and mobile CTA behavior.
- Run TypeScript, production build and regression checks; require PR CI before merge. Verify the exact merged commit deploys and repeat targeted checks on the live website.

Implementation and production verification results are recorded in the pull request and task delivery message.

## Buyer reassurance restored — 2026-10-01

### Implementation plan

1. Keep the existing hero, business, professional pathways and discovery-call structure; preserve broker compensation privacy and independent attorney representation.
2. Explain executive ownership in plain language: the investor directs; New Dawn handles daily work under that direction. Restore team experience in the existing trust strip.
3. Add four short, always-visible benefits inside the existing business section: visa-contingent escrow/full refund; provided office space/remote oversight; staffing/job creation; training/reporting. Keep deeper terms in the six existing disclosures.
4. Use the business's recurring management-fee model and documented oversight as additional reasons to inquire. Keep earnings, future visa decisions, job counts and legal eligibility unpromised.
5. Correct the older E-2 process page's blanket statement against fully refundable investments to account for properly structured visa-contingent escrow. Match relevant server-rendered HTML and metadata.
6. Verify public claims and disclosures, responsive layouts, calls to action and search content; merge after CI and verify the deployed commit and live pages.

### Source review and claim decisions

Reviewed all 35 public routes exposed by the app and sitemap using both current HTTP responses and rendered pages. Authenticated CRM, training, broker and marketing portals were outside this public-site audit. All 35 routes loaded successfully. Page presence is not independent proof of a marketing claim.

| Buyer benefit | Evidence and wording decision |
| --- | --- |
| Daily operations handled for the owner | `/property-management`, `/why-new-dawn`, `/about`, `/e2-visa-franchise`: local execution, owner control of bank accounts, budgets and strategy. Use executive ownership with daily support; avoid describing a passive investment. |
| Escrow and full refund without E-2 approval | `/process` describes attorney-held escrow pending approval; `/blog/how-much-to-invest-e2-visa-franchise` describes return if approval is not obtained. Jamie explicitly reconfirmed all funds in escrow and full refund in this request, consistent with `docs/BROKER_ESCROW_CAMPAIGN.md`. Publish all franchise investment funds, with written release/refund terms for review. No invented exclusions or refund deadline. This does not promise protection against subsequent business losses. |
| Office space and remote oversight | Office provision is owner-confirmed in this request. `/territories` and `/why-new-dawn` describe flexibility with active oversight; `/about` and `/contact` identify the El Paso office. Publish office provision and remote business oversight, with individualized attorney review of location plans; do not turn this into unlimited work authorization. |
| U.S. jobs | `/property-management` identifies leasing, coordination and back-office roles. Publish staffing/job-creation support linked to the business plan and operating needs, without fixed headcounts or asserting that any staffing arrangement automatically satisfies E-2 criteria. |
| 70+ E-2 approvals supported by the team | Owner-confirmed in this request. Attribute experience to the team, not a New Dawn franchise approval rate or government endorsement. The public audit did not independently establish the count; do not invent a case list, success rate or verification badge. |
| Recurring management fees | `/property-management` explains monthly management fees, leasing fees and applicable renewal fees. Publish the model, without income amounts, returns or guaranteed contracts. |
| Training and visible performance | `/process` describes online training; `/property-management` and `/why-new-dawn` describe dashboards and documented decisions. Use online training without adding a timing guarantee, and records for attorney review of applications/renewals rather than guaranteed renewals. |
| Independent advice and accessible team | `/legal`, `/partner-review`, `/request-fdd` and `/team`: FDD review, independent counsel, identifiable people, bilingual support. Retain these and the existing contact flow. |

The additional selling points selected for the homepage are recurring management fees, control of the business bank account and key decisions, online training, owner dashboards, and records for applications/renewals. Financing, generalized family work rights, fixed approval/setup timelines and broad profitability language remain outside this homepage pitch because they need individual qualification and would add complexity.

Primary legal sources consulted:

- [State Department E visa requirements](https://travel.state.gov/content/travel/en/us-visas/employment/treaty-trader-investor-visa-e.html): the investor develops/directs a real enterprise and must meet the other individual criteria. This informs the ownership wording, not an endorsement of New Dawn's arrangement.
- [9 FAM 402.9-6(B), investment commitment and escrow](https://fam.state.gov/fam/09FAM/09FAM040209.html): recognizes a purchase conditional on visa issuance where assets are held in escrow for transfer when that condition is met. Legal review of the particular agreement remains necessary; the general guidance does not verify New Dawn's contract.
- The existing FTC/FDD research above continues to govern performance claims and investor review.

Public routes reviewed: `/`, `/other-businesses`, `/about`, `/team`, `/property-management`, `/why-new-dawn`, `/process`, `/e-2-visa-process`, `/e2-fit`, `/e2-visa-franchise`, `/territories`, `/partner-review`, `/request-fdd`, `/legal`, `/partners`, `/contact`, `/marketing`, `/real-estate`, `/telecom`, `/insurance`, `/quiz`, `/blog`, `/es`, `/es/property-management`, `/fr`, `/zh`, `/ja`, `/ko`, `/tr`, `/privacy-policy`, `/terms`, and the four published articles: `/blog/e2-vs-eb5-visa`, `/blog/telecom-franchise-e2-visa`, `/blog/how-much-to-invest-e2-visa-franchise`, `/blog/best-franchise-for-e2-visa`.

Audit follow-ups outside this homepage change: some older pages use broader family work-rights, profitability, in-house legal-services and timing language than this homepage. Those statements were not reused as homepage promises. Several translated/legal routes have minimal server-rendered text even though their rendered browser content is present; this revision updates only the affected homepage and E-2 process content.
