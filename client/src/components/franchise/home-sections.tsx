import { DiscoveryCallLink } from "./discovery-call-link";
import { ReadMore } from "./read-more";
import { trackEvent } from "@/lib/analytics";
import {
  ATTORNEY_EMAIL_URL,
  BROKER_EMAIL_URL,
  BROKER_FEE_DISPLAY,
  BROKER_FEE_TERMS,
} from "@shared/partner-homepage";

export function HeroSection() {
  return (
    <section
      className="v4-hero partner-hero"
      data-testid="section-hero"
      aria-labelledby="hero-title"
    >
      <div className="v4-hero-copy">
        <div className="eyebrow">
          <i /> FOR IMMIGRATION ATTORNEYS &amp; BROKERS
        </div>
        <h1 id="hero-title" data-testid="text-hero-title">
          Your clients.
          <br />
          <span>Their next chapter.</span>
        </h1>
        <h2 data-testid="text-hero-subtitle">
          A U.S. business. A partner by your side.
        </h2>
        <p>
          Help your E-2 clients explore a property management franchise with
          local operating support. Choose the partnership that fits your work.
        </p>
        <div className="partner-actions" data-partner-hero>
          <a className="button primary" href="#attorneys">
            For Attorneys <span aria-hidden="true">↓</span>
          </a>
          <a className="button partner-secondary" href="#brokers">
            For Brokers <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="v4-principles" data-testid="section-trust-strip">
          <div>
            <strong>Property management expertise</strong>
          </div>
          <div>
            <strong>Operating roots in El Paso, Texas</strong>
          </div>
          <div>
            <strong>English &amp; Spanish support</strong>
          </div>
        </div>
      </div>
      <figure className="v4-hero-photo">
        <img
          src="/images/arrival-hero.png"
          width="1536"
          height="1024"
          fetchPriority="high"
          alt="Concept image of the Statue of Liberty, New York skyline, and an American flag at sunrise"
        />
        <figcaption>
          <span>A NEW CHAPTER IN AMERICA</span>
          <strong>
            Their ambition.
            <br />
            Your trusted guidance.
          </strong>
        </figcaption>
      </figure>
    </section>
  );
}

export function AttorneySection() {
  return (
    <section
      className="v4-section partner-section"
      id="attorneys"
      aria-labelledby="attorney-title"
    >
      <div className="partner-section-heading">
        <div className="eyebrow">FOR IMMIGRATION ATTORNEYS</div>
        <h2 id="attorney-title">
          Stronger client relationships.
          <br />A clearer business path.
        </h2>
        <p>
          Give clients a concrete franchise option to evaluate while you remain
          their independent legal adviser. Help them feel informed and supported
          through a major decision.
        </p>
      </div>
      <div className="partner-benefits">
        <article>
          <span>01</span>
          <h3>Support client retention.</h3>
          <p>
            Keep the legal relationship with your firm as clients explore
            business ownership. You advise on immigration strategy, applications
            and future legal needs.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Build client confidence.</h3>
          <p>
            A clear explanation of the business, costs and owner
            responsibilities helps clients understand their options and the next
            step.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Keep your focus on legal work.</h3>
          <p>
            Discuss the franchise and operating support with our team. Review
            the FDD and business information independently for your client’s
            circumstances.
          </p>
        </article>
      </div>
      <div className="partner-actions">
        <a
          className="button primary"
          href={ATTORNEY_EMAIL_URL}
          onClick={() =>
            trackEvent("partner_inquiry_click", {
              audience: "attorney",
              method: "email",
            })
          }
        >
          Discuss attorney collaboration <span aria-hidden="true">→</span>
        </a>
        <DiscoveryCallLink placement="attorney" label="Book an attorney call" />
      </div>
      <p className="partner-note">
        You retain independent professional judgment; clients choose their own
        counsel. Obtain client permission before an introduction or sharing
        information. This attorney pathway does not offer referral compensation.
      </p>
    </section>
  );
}

export function BrokerSection() {
  return (
    <section
      className="v4-section partner-section partner-brokers"
      id="brokers"
      aria-labelledby="broker-title"
    >
      <div className="partner-broker-grid">
        <div className="partner-section-heading">
          <div className="eyebrow">FOR FRANCHISE &amp; BUSINESS BROKERS</div>
          <h2 id="broker-title">
            A valuable introduction.
            <br />A generous referral fee.
          </h2>
          <p>
            Connect a prospective franchise owner with New Dawn. We guide the
            franchise conversation, FDD review and onboarding process.
          </p>
          <ul className="partner-list">
            <li>A property management option for your E-2 clients</li>
            <li>A direct contact for franchise questions</li>
            <li>Written referral terms before you get started</li>
          </ul>
          <div className="partner-actions">
            <a
              className="button primary"
              href={BROKER_EMAIL_URL}
              data-testid="broker-fee-inquiry"
              onClick={() =>
                trackEvent("partner_inquiry_click", {
                  audience: "broker",
                  method: "email",
                })
              }
            >
              Ask about referral fees <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className="partner-inline-links">
            <DiscoveryCallLink placement="broker" label="Book a broker call" />
            <a className="v6-resource-link" href="/brokers">
              Broker portal
            </a>
          </div>
        </div>
        <div className="partner-fee-card" data-testid="broker-fee-card">
          <div className="eyebrow">REFER ONE QUALIFYING CLIENT</div>
          <h3>
            Earn up to <strong>{BROKER_FEE_DISPLAY}</strong>
          </h3>
          <p className="partner-fee-equation">
            12.5% × $250,000 franchise sale
          </p>
          <p className="partner-fee-terms">{BROKER_FEE_TERMS}</p>
          <p className="partner-fee-terms">
            For eligible brokers. Not an attorney compensation offer or a
            promise of franchisee earnings.
          </p>
        </div>
      </div>
    </section>
  );
}

export function BusinessSection() {
  return (
    <section
      className="v4-section partner-section"
      id="opportunities"
      aria-labelledby="business-title"
    >
      <div className="partner-section-heading">
        <div className="eyebrow">THE BUSINESS BEHIND THE INTRODUCTION</div>
        <h2 id="business-title">
          Your client directs.
          <br />
          Our team supports.
        </h2>
        <p>
          A property management franchise serving rental property owners. Your
          client owns and actively directs the business; New Dawn provides local
          operating support, training and technology.
        </p>
      </div>
      <div className="v6-detail-group">
        <ReadMore
          id="owner-details"
          title="The owner’s role and our operating support"
        >
          <div className="v6-detail-body v6-detail-columns">
            <div>
              <h4>Your client leads.</h4>
              <p>
                The owner sets strategy, controls the business bank account,
                approves budgets and oversees the team. This is an actively
                directed business.
              </p>
            </div>
            <div>
              <h4>Our team supports daily work.</h4>
              <p>
                Local teams, training, workflows and technology support tenant
                communication, property coordination and reporting. The current
                FDD and agreements define the services and responsibilities.
              </p>
            </div>
          </div>
        </ReadMore>
        <ReadMore
          id="how"
          title="From first conversation to client introduction"
        >
          <div className="v6-detail-body">
            <ol>
              <li>
                <strong>Talk with our team.</strong> Attorneys discuss
                collaboration; brokers review eligibility and written referral
                terms.
              </li>
              <li>
                <strong>Explore the fit.</strong> Review the franchise,
                investment and territory availability. Obtain the client’s
                permission before making an introduction.
              </li>
              <li>
                <strong>Coordinate the next steps.</strong> New Dawn handles
                franchise discussions. The client’s attorney assesses
                eligibility and handles legal advice and applications.
              </li>
            </ol>
            <p>
              Share only professional contact details in your initial inquiry,
              not confidential client information. Brokers should disclose their
              financial interest when recommending the franchise, as required by
              applicable law.
            </p>
          </div>
        </ReadMore>
        <ReadMore
          id="investment"
          title="Investment, referral terms and the FDD"
        >
          <div className="v6-detail-body">
            <p>
              Confirm the full investment, fees, working capital and operating
              responsibilities in the current Franchise Disclosure Document. The
              $250,000 broker illustration is a commission example, not a
              universal package price or total investment quote.
            </p>
            <p>
              Review the written referral agreement for the qualifying
              commission basis, eligibility, payment conditions and timing.
              Broker compensation is separate from franchisee financial
              performance. Review any financial performance representation in
              Item 19; no earnings or return is guaranteed.
            </p>
            <a className="v6-resource-link" href="/request-fdd">
              Review the FDD request information
            </a>
          </div>
        </ReadMore>
        <ReadMore
          id="eligibility-details"
          title="E-2 eligibility and independent legal advice"
        >
          <div className="v6-detail-body">
            <p>
              E-2 requirements include treaty-country nationality, a substantial
              investment in a real operating enterprise, and developing and
              directing that business. The client’s independently retained
              attorney assesses all applicable criteria.
            </p>
            <p>
              Franchise ownership does not guarantee visa eligibility or
              approval. New Dawn provides franchise information and operational
              support, not legal or immigration advice. Attorney collaboration
              remains subject to the attorney’s professional obligations and
              applicable jurisdiction’s rules.
            </p>
            <a
              className="v6-resource-link"
              href="https://travel.state.gov/content/travel/en/us-visas/employment/treaty-trader-investor-visa-e.html"
              target="_blank"
              rel="noopener"
            >
              About the E-2 visa ↗
            </a>
          </div>
        </ReadMore>
      </div>
    </section>
  );
}

export function DiscoverySection() {
  return (
    <section
      className="v5-contact"
      id="contact"
      data-testid="section-meet-dylan"
    >
      <div className="v5-contact-copy">
        <div className="eyebrow">ONE CONVERSATION TO GET STARTED</div>
        <h2>
          Let’s talk about
          <br />
          your clients.
        </h2>
        <p>
          Tell Dylan how you work with E-2 investors. We’ll walk through the
          franchise and the right next step for your practice or brokerage.
        </p>
        <ul>
          <li>Attorneys: client fit and franchise information</li>
          <li>Brokers: referral eligibility, fees and payment terms</li>
          <li>A clear introduction process for both</li>
        </ul>
        <p className="partner-note">
          Please keep initial inquiries free of confidential client information.
        </p>
      </div>
      <div className="v5-call-card">
        <div className="v5-advisor">
          <img
            src="/dylan-headshot.png"
            loading="lazy"
            alt="Dylan Delaney"
            width="66"
            height="66"
          />
          <div>
            <strong>Dylan Delaney</strong>
            <span>Director of Franchise Development</span>
          </div>
        </div>
        <div className="v5-call-meta">
          <span>PARTNER CONVERSATION</span>
          <span>30 MINUTES</span>
        </div>
        <h3>
          A conversation.
          <br />A clearer next step.
        </h3>
        <p>
          Choose a time on Dylan’s calendar.
          <br />
          Bring your questions.
        </p>
        <DiscoveryCallLink placement="dylan" testId="button-dylan-calendly" />
        <small>Opens Calendly to select a time.</small>
      </div>
    </section>
  );
}
