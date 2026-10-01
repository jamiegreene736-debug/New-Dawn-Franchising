import { useEffect, type ReactNode } from "react";
import logo from "@assets/Gemini_Generated_Image_t1u2o5t1u2o5t1u2_1771946732580.png";
import { DiscoveryCallLink } from "./discovery-call-link";
import "./franchise-site.css";

function useLandingMetadata(isHome: boolean) {
  useEffect(() => {
    const title = isHome
      ? "New Dawn Franchising | Live in the USA. Own a Property Management Franchise."
      : "Other Supported Businesses | New Dawn Franchising";
    const description = isHome
      ? "Own and direct a property management franchise. New Dawn supports the day-to-day work. Explore the investment, operating support, and your E-2 plans. Book a discovery call."
      : "Explore New Dawn’s other supported business verticals, Telecom and Insurance, with training, systems, and operational support. Book a discovery call.";
    const previousTitle = document.title;
    document.title = title;
    const tags = [
      ["name", "description", description],
      ["property", "og:title", title],
      ["property", "og:description", description],
      ["name", "twitter:title", title],
      ["name", "twitter:description", description],
    ] as const;
    const cleanups = tags.map(([attribute, key, content]) => {
      const existing = document.head.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${key}"]`,
      );
      const element = existing ?? document.createElement("meta");
      const previous = element.getAttribute("content");
      element.setAttribute(attribute, key);
      element.setAttribute("content", content);
      if (!existing) document.head.appendChild(element);
      return () => {
        if (!existing) element.remove();
        else if (previous === null) element.removeAttribute("content");
        else element.setAttribute("content", previous);
      };
    });
    return () => {
      document.title = previousTitle;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [isHome]);
}

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <a
      href="/"
      className="brand official-brand"
      aria-label="New Dawn Franchising home"
      data-testid={footer ? "text-footer-brand" : "link-brand"}
    >
      <img src={logo} alt="New Dawn Franchising" width="192" height="88" />
    </a>
  );
}

function FranchiseFooter() {
  return (
    <footer className="franchise-footer" data-testid="footer-site">
      <div className="footer-top">
        <Brand footer />
        <p>
          A new chapter. A business of your own.
          <br />
          <a
            data-testid="link-footer-address"
            href="https://www.google.com/maps/search/?api=1&query=2601+N+Zaragoza+Rd+El+Paso+TX+79938"
            target="_blank"
            rel="noopener noreferrer"
          >
            Operating roots in El Paso, Texas.
          </a>
        </p>
        <div>
          <a href="/team">Meet the team ↗</a>
          <a href="/partners">Partners &amp; referrals ↗</a>
        </div>
        <div>
          <a href="/other-businesses">Other businesses ↗</a>
          <a href="/blog">Resources ↗</a>
          <a href="/login">Portal login ↗</a>
        </div>
      </div>
      <div className="footer-note">
        New York imagery expresses arrival in America and does not represent an
        available franchise territory. New Dawn Franchising LLC is a franchisor,
        not a law firm. No visa or financial outcome is guaranteed. Franchise
        offers are made only through the applicable Franchise Disclosure
        Document and subject to applicable law.
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} New Dawn Franchising LLC</span>
        <div className="footer-legal">
          <a href="/privacy-policy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/legal">Legal</a>
        </div>
      </div>
      <nav className="footer-languages" aria-label="Language">
        <a href="/" lang="en" hrefLang="en">
          English
        </a>
        <a href="/es" lang="es" hrefLang="es">
          Español
        </a>
        <a href="/fr" lang="fr" hrefLang="fr">
          Français
        </a>
        <a href="/zh" lang="zh" hrefLang="zh">
          中文
        </a>
        <a href="/ja" lang="ja" hrefLang="ja">
          日本語
        </a>
        <a href="/ko" lang="ko" hrefLang="ko">
          한국어
        </a>
        <a href="/tr" lang="tr" hrefLang="tr">
          Türkçe
        </a>
      </nav>
    </footer>
  );
}

export function FranchiseLayout({
  children,
  isHome,
}: {
  children: ReactNode;
  isHome: boolean;
}) {
  useLandingMetadata(isHome);
  return (
    <div className="franchise-site homepage-v4" data-testid="site-shell">
      <a className="franchise-skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="franchise-header" data-testid="header-site">
        <Brand />
        <nav aria-label="Main navigation" data-testid="nav-site">
          <a href={isHome ? "#opportunities" : "/#opportunities"}>
            How it works
          </a>
          <a href={isHome ? "#how" : "/#how"}>E-2 pathway</a>
        </nav>
        <DiscoveryCallLink placement="header" testId="button-top-cta" />
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <FranchiseFooter />
      <div className="v5-mobile-cta" aria-label="Book a discovery call">
        <DiscoveryCallLink placement="mobile" />
      </div>
    </div>
  );
}
