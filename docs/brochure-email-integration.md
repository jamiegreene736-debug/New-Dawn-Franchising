# Multilingual brochures in the Grok 2.0 email campaign

How the English / Spanish / Traditional-Chinese brochures are delivered through the
Grok 2.0 drip sequences, and why it's done this way.

## TL;DR

- **Link the brochures, don't attach them.** Every brochure is referenced by a
  first-party `https://www.newdawnfranchising.com/brochures/...` link, never as a
  PDF attachment.
- **All three languages inline.** Each brochure mention surfaces `English · Español ·
  中文` links side by side, so the recipient self-selects — same pattern as the
  EN · ES · 中文 selector on the website.
- **Two brochures, two audiences.** Brokers get the 1-page partner one-pager (plus a
  forward-to-client investor brochure); end consumers get the 6-page investor brochure.

## Why link instead of attach (the deliverability question)

These sequences send as **cold drip mail over Gmail SMTP** on a domain the platform is
actively warming. The repo already invests heavily in deliverability — a DNSBL monitor,
List-Unsubscribe headers, plain-text alternatives, a tracking subdomain, and a warmup
engine. Attaching a PDF would work against all of it:

| Attaching the PDF | Linking the hosted PDF |
| --- | --- |
| A binary attachment on cold outreach is one of the strongest spam/quarantine signals; many corporate gateways defang or block it outright. | A first-party `https://` link on the **same domain we send from** carries sender reputation instead of risk. |
| Inflates message size → slower sends, worse inbox placement, higher chance of clipping. | Keeps the message light and text-forward — what warmed cold mail wants to look like. |
| Largest brochure (`investor-brochure-zh-TW.pdf`) is ~2.3 MB — heavy on every send. | Hosted once, fetched on demand only by interested readers. |
| No engagement signal — you can't tell who opened it. | Click is a measurable intent signal feeding the CRM. |

Additional spam-hygiene choices already baked in:

- **Descriptive anchor text**, never raw pasted URLs (raw links read as spammier).
- **One brochure block per email**, and only in a couple of steps — not every touch —
  so the sequence stays conversational, not "download-bait."
- The PDFs live on the **sending domain**, so the link domain aligns with the From
  domain (no mismatched/shortened-link penalty).

## Where the brochures land

Source of truth: `shared/campaign-tracks.ts`. The links are built by the
`brochureLinksHtml()` / `brochureLinksText()` helpers (HTML body + plain-text part),
which point at `brochureFileUrl(kind, lang)`.

### Broker sequence — `BROKER_2_TRACK` ("Grok 2.0 - for brokers")

- **Touch 1 — intro email (Step 2):** the **broker one-pager** (`partner` brochure).
  Natural moment — the LinkedIn/DM steps already promise "a broker one-pager," so this
  delivers it.
- **Touch 3 — director model (Step 6):** the **investor brochure** (`investor`), framed
  as a client-facing PDF the broker can forward straight to a candidate in their language.

### Client sequence — `CLIENT_TRACK` ("Grok Campaign 2.0 - Clients")

- **Touch 1 — intro email (Step 2):** the **investor brochure** (`investor`).

The legacy `BROKER_TRACK` ("Grok Campaign") is intentionally left unchanged.

## The brochure files

Six PDFs in `client/public/brochures`, served at `/brochures/<file>`:

| Kind | English | Spanish | Traditional Chinese |
| --- | --- | --- | --- |
| Investor (6-page) | `investor-brochure-en.pdf` | `investor-brochure-es.pdf` | `investor-brochure-zh-TW.pdf` |
| Partner / Broker (1-page) | `partner-brochure-en.pdf` | `partner-brochure-es.pdf` | `partner-brochure-zh-TW.pdf` |

## Compliance note

The brochure **markets**; it is never an offer. Franchises are offered only through the
FDD (Item 19). The brochure steps sit alongside — not in place of — the existing
"Request the FDD" calls to action, and broker commission figures never appear in the
client-facing investor brochure.
