import { useEffect } from "react";
import { Link } from "wouter";

const COMPANY = {
  name: "New Dawn Franchising LLC",
  email: "franchising@newdawnfranchising.com",
  phone: "(346) 597-9994",
  phoneTel: "+13465979994",
  addressFull: "2601 N Zaragoza Rd, El Paso, TX 79938",
};

const SEO = {
  title: "Legal & Disclaimers | New Dawn Franchising",
  description:
    "Legal notices and disclaimers for New Dawn Franchising — franchise offering disclaimer, immigration disclaimer, and marketing content notice. Franchises are offered only through an FDD; E-2 visa approval is never guaranteed.",
  canonical: "https://www.newdawnfranchising.com/legal",
  image: "https://www.newdawnfranchising.com/opengraph.jpg",
};

function setMetaTag(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  const created = !el;
  const previous = el?.getAttribute("content") ?? null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return () => {
    if (created) el?.remove();
    else if (previous !== null) el?.setAttribute("content", previous);
  };
}

function useLegalSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = SEO.title;

    const cleanups: Array<() => void> = [];
    cleanups.push(setMetaTag('meta[name="description"]', "name", "description", SEO.description));
    cleanups.push(setMetaTag('meta[property="og:title"]', "property", "og:title", SEO.title));
    cleanups.push(setMetaTag('meta[property="og:description"]', "property", "og:description", SEO.description));
    cleanups.push(setMetaTag('meta[name="twitter:title"]', "name", "twitter:title", SEO.title));
    cleanups.push(setMetaTag('meta[name="twitter:description"]', "name", "twitter:description", SEO.description));

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    const prevCanonical = canonical?.getAttribute("href") ?? null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", SEO.canonical);

    return () => {
      document.title = prevTitle;
      cleanups.forEach((fn) => fn());
      if (createdCanonical) canonical?.remove();
      else if (prevCanonical !== null) canonical?.setAttribute("href", prevCanonical);
    };
  }, []);
}

export default function LegalPage() {
  useLegalSeo();

  return (
    <div data-testid="page-legal" className="nh-container py-16 max-w-3xl mx-auto">
      <h1 data-testid="legal-title" className="text-3xl font-bold mb-2">
        Legal &amp; Disclaimers
      </h1>
      <p className="text-sm text-muted-foreground mb-10">
        Please read these notices carefully. They apply to the entire {COMPANY.name} website and all of its content.
      </p>

      <div className="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed text-foreground/90">
        <section data-testid="section-legal-franchise">
          <h2 className="text-lg font-semibold mb-2">1. Franchise Offering Disclaimer</h2>
          <p>
            The information on this website is provided for general informational and educational purposes only and is
            not an offer to sell, or the solicitation of an offer to buy, a franchise. A franchise is offered and sold
            only through a Franchise Disclosure Document (FDD) that complies with the FTC Franchise Rule (16 CFR Part
            436) and applicable state franchise laws.
          </p>
          <p className="mt-2">
            Certain states regulate the offer and sale of franchises and require registration or filing. {COMPANY.name}{" "}
            will offer or sell a franchise only in states where we are registered, exempt, or otherwise authorized, and
            only after we have met applicable pre-sale registration, filing, and disclosure requirements and delivered
            the FDD as required by law.
          </p>
          <p className="mt-2">
            Submitting a contact form or inquiry on this website does not create any contractual obligation on the part
            of {COMPANY.name} to offer or grant a franchise. Any income, earnings, results, or performance figures
            referenced on this website are illustrative only, are not guarantees of future results, and individual
            outcomes vary.
          </p>
        </section>

        <section data-testid="section-legal-immigration">
          <h2 className="text-lg font-semibold mb-2">2. Immigration Disclaimer</h2>
          <p>
            {COMPANY.name} is a franchisor, not a law firm. Nothing on this website is legal, immigration, tax, or
            financial advice, and no attorney-client or other professional relationship is created by using the site or
            contacting us. We do not provide immigration services and do not file petitions or form your legal entity —
            your own licensed attorney does.
          </p>
          <p className="mt-2">
            E-2 treaty investor visa information on this website is general and educational only. Immigration laws and
            qualifying treaty-country lists change over time. E-2 eligibility and approval are determined solely by the
            U.S. government — Department of State consular officers, and USCIS for change or extension of status — never
            by us, and a visa is never guaranteed.
          </p>
          <p className="mt-2">
            Before making any investment or visa-related decision, you should retain your own licensed U.S. immigration
            attorney and qualified tax and financial advisors, and conduct your own independent due diligence.
          </p>
        </section>

        <section data-testid="section-legal-marketing">
          <h2 className="text-lg font-semibold mb-2">3. Marketing Content Notice</h2>
          <p>
            Content on this website is marketing material intended to describe the New Dawn Franchising opportunity in
            general terms. It is not a substitute for professional advice and should be reviewed by qualified
            immigration and franchise counsel before being relied upon. Information is provided &ldquo;as is,&rdquo; may
            be incomplete or out of date, and we make no warranty as to its accuracy or completeness.
          </p>
        </section>

        <section data-testid="section-legal-contact">
          <h2 className="text-lg font-semibold mb-2">4. Contact</h2>
          <p>
            If you have questions about these disclaimers, please contact us. To review the franchise opportunity in
            detail, you can{" "}
            <Link href="/request-fdd" className="text-primary underline">
              request the FDD
            </Link>
            .
          </p>
          <address className="not-italic mt-2 space-y-0.5">
            <p className="font-semibold">{COMPANY.name}</p>
            <p>{COMPANY.addressFull}</p>
            <p>
              <a href={`mailto:${COMPANY.email}`} className="text-primary underline">{COMPANY.email}</a>
            </p>
            <p>
              <a href={`tel:${COMPANY.phoneTel}`} className="text-primary underline">{COMPANY.phone}</a>
            </p>
          </address>
          <p className="mt-6">
            See also our{" "}
            <Link href="/terms" className="text-primary underline">Terms &amp; Conditions</Link> and{" "}
            <Link href="/privacy-policy" className="text-primary underline">Privacy Policy</Link> for complete
            disclosures.
          </p>
        </section>
      </div>
    </div>
  );
}
