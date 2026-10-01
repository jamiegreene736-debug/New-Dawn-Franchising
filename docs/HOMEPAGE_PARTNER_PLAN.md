# Attorney and broker homepage

Approved direction: 2026-10-01. Focus on immigration attorneys and franchise/business brokers. Preserve the existing navy/gold design, photography, simple layout, and legal/FDD disclosure. The owner subsequently requested public broker compensation: up to 12.5% of $250,000 ($31,250); this supersedes the earlier private-fee presentation.

## Audience and conversion plan

1. Hero: identify both audiences immediately; two anchor choices, For Attorneys and For Brokers. A persistent header link says Broker referral fees, including on mobile.
2. Attorneys: lead with stronger client relationships and a clearer business decision. Explain continuity of legal representation, franchise information for independent review, and a coordinated introduction with client permission. Retention and satisfaction are intended benefits, not measured or guaranteed outcomes. Offer a direct attorney-specific email and call booking.
3. Brokers: lead with Refer a client. Earn up to $31,250. Display the complete calculation, 12.5% × $250,000. State adjacent to the figure that this is a qualifying-sale example, not guaranteed income or payment for an introduction alone. Written terms govern eligibility, commission basis, funding, payment timing, and other conditions. One click opens a prefilled broker fee inquiry; booking is an alternative. Existing broker portal remains available; do not imply an unbuilt affiliate-link generator exists.
4. Shared context: explain the property management franchise, investor direction and local operating support. Keep deeper investment/FDD and introduction-process information in closed, keyboard-accessible disclosures. Preserve existing #opportunities, #how, and #investment deep links.
5. Contact: retain Dylan's existing calendar and verified business email. Ask for professional contact information only, with no confidential client information in initial inquiries.
6. Search: keep homepage title, description, and server-rendered content aligned. Correct the existing partners-page blanket attorney-compensation statement so linked content does not contradict the new separation.

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

- Use a clean branch from main, leaving the original checkout's unrelated edits intact.
- Reuse existing sections, native details, analytics helper, booking destination, and scoped CSS. No new backend intake or payment system.
- Verify distinct audience actions, the exact fee calculation and nearby conditions, mail subjects, no attorney payment pitch, no client-data request, and existing disclaimers.
- Test 375/390/768/1280px, overflow, keyboard disclosure controls, mobile navigation, contextual CTA visibility, and reduced motion. Compare server HTML and browser copy; check other-businesses route regressions.
- Run TypeScript, production build, homepage browser and server-shell tests; require PR CI before merge. Verify the merged commit deploys successfully and check the live page.

## Completion

Implementation and verification results are recorded in the pull request and task delivery message.
