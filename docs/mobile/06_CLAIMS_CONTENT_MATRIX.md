# New Dawn Pathways — Claims and Content Matrix

**Status:** Draft inventory; no legal or public-use approval is implied
**Prepared:** August 30, 2026
**Rule:** A controlling item cannot be released until its owner, required reviewers, source, locale parity, version, effective date, and expiration/review date are recorded.

## Approval roles

| Role | Approval scope |
|---|---|
| Product owner | Product intent, placement, next action, and release decision |
| Immigration counsel | Immigration boundaries, official-source references, and avoidance of eligibility or outcome claims |
| Franchise counsel/compliance | Opportunity, FDD, compensation, referral, earnings, and franchise-process claims |
| Privacy/security owner | Consent, collection, retention, sharing, deletion, and sensitive-data boundaries |
| Operations owner | Status accuracy, owner, timing, and escalation path |
| Spanish legal-content reviewer | Meaning parity, not literal translation alone |

## Prototype controlling-content register

| ID | Surface | Intended statement or rule | Risk | Required review | Source/status | Release disposition |
|---|---|---|---|---|---|---|
| BND-001 | Launch | New Dawn provides business education and coordination; independent immigration counsel determines legal eligibility and leads the legal process. | High | Immigration counsel, product | Draft prototype language | Block until approved in English and Spanish |
| BND-002 | Assessment | The assessment organizes business next steps and does not evaluate, predict, or guarantee visa eligibility or approval. | High | Immigration counsel | Draft prototype language | Block until approved and versioned |
| BND-003 | Results | A result may suggest a New Dawn business consultation but cannot recommend a visa path or make a legal determination. | High | Immigration counsel, product | Deterministic product rule drafted | Block until scoring and every result variant are reviewed |
| BND-004 | Attorney track | Independent counsel retains professional judgment; business-side status is never a legal conclusion. | High | Immigration counsel | Draft prototype language | Block until approved |
| OPP-001 | Opportunities | Opportunity descriptions are informational, current only as of their version date, and do not promise immigration, earnings, returns, residency, refund, or franchise outcomes. | Critical | Franchise counsel/compliance, immigration counsel | Approved opportunity set not yet named | No public opportunity content until source package is approved |
| OPP-002 | Investment range | Collect an exploratory range only to discuss business fit and responsibilities, not source of funds or legal eligibility. | High | Immigration counsel, privacy | Prototype question drafted | Allow only after purpose, retention, and access are approved |
| REF-001 | Partner application | Application is not acceptance; referral access requires approval, current agreement, and required training. | High | Franchise counsel/compliance, operations | Workflow rule drafted | Block live access until enforced server-side |
| REF-002 | Permission | Before sharing contact details, the partner confirms that the person requested or clearly permitted the introduction. | Critical | Privacy, franchise counsel/compliance | Consent text drafted | Require recorded text/version/time/actor evidence |
| REF-003 | Minimum data | Referral intake accepts minimum contact, language, and general business timing and rejects sensitive legal, identity, tax, banking, and source-of-funds material. | Critical | Privacy/security, immigration counsel | Data-minimization rule drafted | Enforce in UI, API validation, support, logs, and training |
| REF-004 | Duplicate review | A receipt may state that duplicate review is underway but cannot reveal whether or through whom a person already exists. | Critical | Privacy/security, operations | Safe status pattern drafted | Enforce transactionally and test cross-partner isolation |
| REF-005 | Partner claims | Partners may use only current approved materials and may not promise visa approval, earnings, returns, residency, refunds, or franchise outcomes. | Critical | Franchise counsel/compliance, immigration counsel | Training statement drafted | Agreement and training control required before referral |
| ATT-001 | Attorney compensation | Attorney access and professional judgment are uncompensated by default; any exception requires separate written approval and jurisdiction review. | Critical | Immigration counsel, franchise counsel/compliance | Product policy decision | Keep compensation disabled until an exception is approved |
| DOC-001 | Sensitive documents | The MVP does not request or accept passports, bank/tax records, immigration filings, biometrics, source-of-funds evidence, or legal documents. | Critical | Privacy/security, immigration counsel | MVP boundary approved in product direction | Enforce across support, upload absence, APIs, and staff procedures |
| PAY-001 | Payments | The MVP does not collect investments, wires, commissions, or payment-status information. | Critical | Product, franchise counsel/compliance, privacy/security | MVP boundary approved in product direction | Any change requires a new gate and data-flow review |
| STA-001 | Pathway status | Every status describes an authoritative business event, names the next owner/action, and avoids implying government, legal, payment, or investment completion. | Critical | Operations, immigration counsel | Event model drafted | Map only from authoritative server events |
| NOT-001 | Notifications | Lock-screen text contains no immigration, financial, legal, referral, or sensitive answer detail. | High | Privacy/security, product | Notification rule drafted | Use generic safe preview text and authenticated deep links |
| LOC-001 | English/Spanish | All controlling disclosures, results, status labels, errors, permissions, and notifications have approved meaning parity. | High | Each content owner, Spanish reviewer | Launch entry drafted; deeper prototype incomplete | Production release blocked until complete |
| AI-001 | AI concierge | No generative immigration, opportunity, compensation, or outcome guidance is released without approved sources, refusals, escalation, evaluation, and audit controls. | Critical | All review owners | Deferred product decision | Outside MVP unless separately authorized |

## Required evidence fields for the production content service

Each released record must include:

- stable content ID and content type;
- English and Spanish text bound to one version;
- product owner and required reviewer identities;
- source URL or controlled source document reference;
- jurisdiction and audience constraints;
- approval timestamps and immutable approval receipts;
- effective date, review/expiration date, and superseded version;
- required acknowledgement behavior, when applicable;
- app surfaces and notification templates that consume the record.

## Approval sequence

1. Product and operations confirm intent, surface, next action, and authoritative status source.
2. Privacy/security reviews collection, disclosure, storage, analytics, and notification effects.
3. Immigration and franchise reviewers approve their assigned high/critical content.
4. Spanish review begins from the approved English meaning and records parity approval.
5. Engineering imports only complete, currently effective records and fails closed on missing or expired controlling content.
6. Pilot feedback may improve comprehension but cannot silently change an approved legal meaning.
