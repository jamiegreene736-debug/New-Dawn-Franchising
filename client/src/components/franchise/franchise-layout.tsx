import { useEffect, useState, type ReactNode } from "react";
import {
  PARTNER_HOME_TITLE,
  PARTNER_HOME_DESCRIPTION,
} from "@shared/partner-homepage";
import logo from "@assets/Gemini_Generated_Image_t1u2o5t1u2o5t1u2_1771946732580.png";
import { DiscoveryCallLink } from "./discovery-call-link";
import "./franchise-site.css";

function useLandingMetadata(isHome: boolean) {
  useEffect(() => {
    const title = isHome
      ? PARTNER_HOME_TITLE
      : "Other Supported Businesses | New Dawn Franchising";
    const description = isHome
      ? PARTNER_HOME_DESCRIPTION
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

function FranchiseFooter({ isHome }: { isHome: boolean }) {
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
            rel="noopener"
          >
            Operating roots in El Paso, Texas.{isHome && " ↗"}
          </a>
        </p>
        <div>
          <a href="/team">Meet the team{!isHome && " ↗"}</a>
          <a href="/#attorneys">For attorneys{!isHome && " ↗"}</a>
          <a href="/partners">For brokers{!isHome && " ↗"}</a>
        </div>
        <div>
          <a href="/other-businesses">Other businesses{!isHome && " ↗"}</a>
          <a href="/blog">Resources{!isHome && " ↗"}</a>
          <a href="/login">Portal login{!isHome && " ↗"}</a>
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

function MobileHomeCallBar() {
  const [isMobile, setIsMobile] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setVisible(false);
    if (!isMobile) return;
    const hero = document.querySelector("[data-partner-hero]");
    const contact = document.getElementById("contact");
    if (!hero || !contact) return;
    let heroPassed = false;
    let contactReached = false;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) {
          heroPassed =
            !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
        } else {
          // Stay hidden below the final card, and restore when scrolling back above it.
          contactReached =
            entry.isIntersecting || entry.boundingClientRect.top < 0;
        }
      }
      setVisible(heroPassed && !contactReached);
    });
    observer.observe(hero);
    observer.observe(contact);
    return () => observer.disconnect();
  }, [isMobile]);

  if (!isMobile) return null;
  return (
    <div className="v5-mobile-cta" aria-hidden={!visible} inert={!visible}>
      <a className="button primary" href="#contact" tabIndex={visible ? 0 : -1}>
        Talk with our team
      </a>
    </div>
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
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      className={`franchise-site homepage-v4${isHome ? " homepage-refinements" : ""}`}
      data-testid="site-shell"
    >
      <a className="franchise-skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="franchise-header" data-testid="header-site">
        <Brand />
        {isHome && (
          <button
            className="home-menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            aria-controls="home-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span aria-hidden="true">☰</span>
          </button>
        )}
        <nav
          id="home-navigation"
          data-open={menuOpen}
          aria-label="Main navigation"
          data-testid="nav-site"
          onClick={() => setMenuOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMenuOpen(false);
              document
                .querySelector<HTMLButtonElement>(".home-menu-toggle")
                ?.focus();
            }
          }}
        >
          {isHome ? (
            <>
              <a href="#attorneys">For Attorneys</a>
              <a href="/team">Meet the team</a>
              <a href="#opportunities">The franchise</a>
            </>
          ) : (
            <>
              <a href="/#opportunities">How it works</a>
              <a href="/#how">E-2 pathway</a>
            </>
          )}
        </nav>
        {isHome ? (
          <a
            className="button primary partner-header-link"
            href="/partners"
            data-testid="button-top-cta"
          >
            For Brokers <span aria-hidden="true">→</span>
          </a>
        ) : (
          <DiscoveryCallLink placement="header" testId="button-top-cta" />
        )}
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <FranchiseFooter isHome={isHome} />
      {isHome ? (
        <MobileHomeCallBar />
      ) : (
        <div className="v5-mobile-cta" aria-label="Book a discovery call">
          <DiscoveryCallLink placement="mobile" />
        </div>
      )}
    </div>
  );
}
