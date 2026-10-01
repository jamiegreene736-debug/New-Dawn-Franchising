import { useEffect } from "react";
import {
  BROKER_PAGE_TITLE,
  BROKER_PAGE_DESCRIPTION,
  BROKER_EMAIL_URL,
} from "@shared/partner-homepage";
import { DiscoveryCallLink } from "@/components/franchise/discovery-call-link";
import { trackEvent } from "@/lib/analytics";

function usePartnersSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = BROKER_PAGE_TITLE;

    const setMeta = (
      selector: string,
      attr: "name" | "property",
      key: string,
      content: string,
    ) => {
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
    };

    const cleanups = [
      setMeta(
        'meta[name="description"]',
        "name",
        "description",
        BROKER_PAGE_DESCRIPTION,
      ),
      setMeta(
        'meta[property="og:title"]',
        "property",
        "og:title",
        BROKER_PAGE_TITLE,
      ),
      setMeta(
        'meta[property="og:description"]',
        "property",
        "og:description",
        BROKER_PAGE_DESCRIPTION,
      ),
    ];

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    const createdCanonical = !canonical;
    const prevCanonical = canonical?.getAttribute("href") ?? null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute(
      "href",
      "https://www.newdawnfranchising.com/partners",
    );

    return () => {
      document.title = prevTitle;
      cleanups.forEach((fn) => fn());
      if (createdCanonical) canonical?.remove();
      else if (prevCanonical !== null)
        canonical?.setAttribute("href", prevCanonical);
    };
  }, []);
}

export default function PartnersPage() {
  usePartnersSeo();
  return (
    <div data-testid="page-partners" className="min-h-screen">
      <section className="border-b" data-testid="section-partners-hero">
        <div className="nh-container py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              For franchise &amp; business brokers
            </p>
            <h1
              data-testid="partners-title"
              className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              A partnership built around your client.
            </h1>
            <p
              data-testid="partners-subtitle"
              className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground"
            >
              Introduce clients to a property management franchise with local
              operating support. Explore the business, understand the fit and
              agree on clear referral terms before making an introduction.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-4">
              <a
                className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground"
                href={BROKER_EMAIL_URL}
                data-testid="broker-terms-inquiry"
                onClick={() =>
                  trackEvent("partner_inquiry_click", {
                    audience: "broker",
                    method: "email",
                  })
                }
              >
                Request referral terms
              </a>
              <a
                className="rounded-lg border px-6 py-3 font-semibold"
                href="#broker-conversation"
              >
                Talk with our team
              </a>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Already a partner?{" "}
              <a className="underline underline-offset-4" href="/brokers">
                Open the broker portal
              </a>
            </p>
          </div>
        </div>
      </section>
      <section
        className="nh-container py-12 md:py-16"
        aria-labelledby="broker-support-title"
      >
        <div className="mx-auto max-w-5xl">
          <h2 id="broker-support-title" className="text-3xl font-semibold">
            A clear opportunity. A supported introduction.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <article className="rounded-2xl border p-6">
              <h3 className="text-lg font-semibold">A business to evaluate</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Understand the property management model, owner responsibilities
                and operating support before recommending it to a client.
              </p>
            </article>
            <article className="rounded-2xl border p-6">
              <h3 className="text-lg font-semibold">A direct team contact</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Discuss client fit, territory availability, the FDD and the
                introduction process with our franchise team.
              </p>
            </article>
            <article className="rounded-2xl border p-6">
              <h3 className="text-lg font-semibold">Written referral terms</h3>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Eligible brokers may receive compensation for qualifying
                franchise sales. Request the rate, commission basis,
                eligibility, payment conditions and timing.
              </p>
            </article>
          </div>
        </div>
      </section>
      <section
        className="border-y bg-muted/30"
        aria-labelledby="broker-process-title"
      >
        <div className="nh-container py-12 md:py-16">
          <div className="mx-auto max-w-5xl">
            <h2 id="broker-process-title" className="text-3xl font-semibold">
              Start with clarity.
            </h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              <li>
                <span className="text-sm font-semibold text-muted-foreground">
                  01
                </span>
                <h3 className="mt-2 text-lg font-semibold">
                  Review the partnership.
                </h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Talk through the business and request the written referral
                  agreement. Confirm eligibility and compensation terms before
                  referring.
                </p>
              </li>
              <li>
                <span className="text-sm font-semibold text-muted-foreground">
                  02
                </span>
                <h3 className="mt-2 text-lg font-semibold">
                  Explain your role early.
                </h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Before introducing a client, explain that New Dawn may pay
                  you, how your compensation is calculated and any relevant
                  conditions. Provide required disclosures and answer
                  compensation questions accurately.
                </p>
              </li>
              <li>
                <span className="text-sm font-semibold text-muted-foreground">
                  03
                </span>
                <h3 className="mt-2 text-lg font-semibold">
                  Introduce with permission.
                </h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Get your client’s permission before sharing their information.
                  New Dawn handles franchise discussions; the client’s
                  independently retained attorney handles legal advice.
                </p>
              </li>
            </ol>
            <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
              The written agreement and applicable law govern eligibility,
              commission basis, rate, payment conditions and timing. An
              introduction alone does not earn a fee.
            </p>
          </div>
        </div>
      </section>
      <section id="broker-conversation" className="nh-container py-12 md:py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border p-8 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            DYLAN DELANEY · DIRECTOR OF FRANCHISE DEVELOPMENT
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Let’s discuss the right fit.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Book a conversation about the franchise, your clients and the
            partnership. Bring professional contact details; please leave
            confidential client information out of your initial inquiry.
          </p>
          <div className="mt-6 font-semibold underline underline-offset-4">
            <DiscoveryCallLink placement="broker" label="Book a broker call" />
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Immigration attorney?{" "}
            <a className="underline underline-offset-4" href="/#attorneys">
              Explore attorney collaboration
            </a>
            . That pathway does not offer referral compensation.
          </p>
        </div>
      </section>
      <section className="border-t" data-testid="section-partners-disclaimer">
        <div className="nh-container py-8">
          <p className="mx-auto max-w-5xl text-sm leading-relaxed text-muted-foreground">
            New Dawn Franchising LLC is a franchisor, not a law firm. This page
            describes a broker relationship and is not an offer to sell a
            franchise. Franchise offers are made through the applicable
            Franchise Disclosure Document and subject to applicable law. No visa
            or financial outcome is guaranteed. Clients should review the full
            investment, any referral-related charges and separate professional
            fees in their written documents with their advisers.
          </p>
        </div>
      </section>
    </div>
  );
}
