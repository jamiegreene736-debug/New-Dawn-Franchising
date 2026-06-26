# Brochure PDFs

These files are served at `https://www.newdawnfranchising.com/brochures/<file>` and are
referenced by `client/src/lib/brochures.ts` + `client/src/components/brochure-download.tsx`.

Drop the six designed PDFs here with **exactly** these names:

| Brochure | File |
| --- | --- |
| Investor — English | `investor-brochure-en.pdf` |
| Investor — Spanish | `investor-brochure-es.pdf` |
| Investor — Traditional Chinese | `investor-brochure-zh-TW.pdf` |
| Broker / Partner — English | `partner-brochure-en.pdf` |
| Broker / Partner — Spanish | `partner-brochure-es.pdf` |
| Broker / Partner — Traditional Chinese | `partner-brochure-zh-TW.pdf` |

The language code maps from the site locale: `/zh` → `zh-TW`, `/es` → `es`, everything
else → `en`. Visitors can override with the EN · ES · 中文 selector in the download dialog.
