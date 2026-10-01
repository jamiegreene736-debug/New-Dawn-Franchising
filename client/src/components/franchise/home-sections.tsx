import { DiscoveryCallLink } from "./discovery-call-link";
import { ReadMore } from "./read-more";
import { trackEvent } from "@/lib/analytics";
import { ATTORNEY_EMAIL_URL } from "@shared/partner-homepage";

export function HeroSection() {
  return (
    <section
      className="v4-hero partner-hero"
      data-testid="section-hero"
      aria-labelledby="hero-title"
    >
      <div className="v4-hero-copy">
        <div className="eyebrow">
          <i /> PROPERTY MANAGEMENT · E-2 PLANS
        </div>
        <h1 id="hero-title" data-testid="text-hero-title">
          Your next chapter.
          <br />
          <span>A business of your own.</span>
        </h1>
        <h2 data-testid="text-hero-subtitle">
          You direct. We handle the day-to-day.
        </h2>
        <p>
          Own a U.S. property management business with a local team, office
          space and operating support. You keep control of the business and
          its key decisions, with your own advisers by your side.
        </p>
        <div className="partner-actions" data-partner-hero>
          <DiscoveryCallLink placement="hero" testId="button-hero-booking" />
          <a className="v6-resource-link" href="#opportunities">
            Explore the franchise <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="v4-principles" data-testid="section-trust-strip">
          <div>
            <strong>70+ E-2 visa approvals</strong>
            <span>supported by our team</span>
          </div>
          <div>
            <strong>Operating roots in El Paso, Texas</strong>
          </div>
          <div>
            <strong>English &amp; Spanish support</strong>
          </div>
        </div>
        <p className="partner-note hero-experience-note">
          Past outcomes do not guarantee future visa approval.
        </p>
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
            Your ambition.
            <br />
            Support for the journey.
          </strong>
        </figcaption>
      </figure>
    </section>
  );
}

export function ProfessionalPathsSection() {
  return (
    <section
      className="v4-section partner-section partner-brokers"
      aria-labelledby="professionals-title"
    >
      <div className="partner-section-heading">
        <div className="eyebrow">FOR PROFESSIONAL PARTNERS</div>
        <h2 id="professionals-title">
          Help clients take an informed next step.
        </h2>
        <p>
          Separate ways to work together, with your client’s interests at the
          center.
        </p>
      </div>
      <div className="professional-paths">
        <article id="attorneys" aria-labelledby="attorney-title">
          <div className="eyebrow">FOR IMMIGRATION ATTORNEYS</div>
          <h3 id="attorney-title">Support your client relationships.</h3>
          <p>
            Help clients feel informed and supported while you remain their
            independent legal adviser. Review franchise information with our
            team and coordinate next steps with your client’s permission.
          </p>
          <ul className="partner-list">
            <li>Continuity of legal representation</li>
            <li>Operating, staffing and ownership records for your review</li>
            <li>
              Coordination that respects client choice and confidentiality
            </li>
          </ul>
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
          <p className="partner-note">
            This attorney pathway does not offer referral compensation. Your
            professional obligations and independent judgment remain yours.
          </p>
        </article>
        <article id="brokers" aria-labelledby="broker-title">
          <div className="eyebrow">FOR FRANCHISE &amp; BUSINESS BROKERS</div>
          <h3 id="broker-title">Make a thoughtful introduction.</h3>
          <p>
            Explore whether New Dawn’s property management franchise fits your
            client’s goals. Get a direct contact, a clear introduction process
            and written partnership terms.
          </p>
          <ul className="partner-list">
            <li>Business and operating support information</li>
            <li>A conversation about your client’s goals</li>
            <li>Clear roles from introduction onward</li>
          </ul>
          <a className="button primary" href="/partners">
            Explore the broker partnership <span aria-hidden="true">→</span>
          </a>
        </article>
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
        <div className="eyebrow">THE PROPERTY MANAGEMENT FRANCHISE</div>
        <h2 id="business-title">
          You direct.
          <br />
          We handle the daily work.
        </h2>
        <p>
          A business built around recurring property management fees. You set
          the direction and oversee performance. Our team handles leasing,
          tenant communication and property coordination under your direction.
        </p>
      </div>
      <div className="buyer-benefits" data-testid="buyer-benefits">
        <article>
          <h3>Funds in escrow. Full refund if not approved.</h3>
          <p>
            All franchise investment funds are held in escrow pending E-2
            approval. If approval is not granted, they are refunded in full
            under the written escrow agreement.
          </p>
        </article>
        <article>
          <h3>Office space provided. Room to be flexible.</h3>
          <p>
            We provide office space and local operating support so you can
            oversee your business remotely. Your attorney reviews your
            location plans and E-2 responsibilities with you.
          </p>
        </article>
        <article>
          <h3>A real business creating U.S. jobs.</h3>
          <p>
            We help build your operating team, supporting U.S. job creation
            through leasing, property coordination and back-office roles.
            Staffing reflects your business plan and operating needs.
          </p>
        </article>
        <article>
          <h3>Training, visibility and ongoing support.</h3>
          <p>
            Online training and owner dashboards help you lead with confidence.
            Business reports document your active oversight and give your
            attorney records to review for applications and renewals.
          </p>
        </article>
      </div>
      <div className="v6-detail-group">
        <ReadMore
          id="owner-details"
          title="The owner’s role and our operating support"
        >
          <div className="v6-detail-body v6-detail-columns">
            <div>
              <h4>You lead the business.</h4>
              <p>
                The owner sets strategy, controls the business bank account,
                approves budgets and oversees the team. This is an actively
                directed business.
              </p>
              <p>
                Remote oversight gives you flexibility without giving up those
                responsibilities. Discuss the office arrangement, territory
                and your proposed location with our team and your attorney.
              </p>
            </div>
            <div>
              <h4>Our team supports daily work.</h4>
              <p>
                Local teams handle daily operations under your direction.
                Online training, owner dashboards and reporting help you
                monitor the business and document decisions. The current FDD
                and agreements define the services and responsibilities.
              </p>
            </div>
          </div>
        </ReadMore>
        <ReadMore
          id="how"
          title="From first conversation to an informed decision"
        >
          <div className="v6-detail-body">
            <ol>
              <li>
                <strong>Explore the business.</strong> Discuss your goals, owner
                responsibilities and available territories with our team.
              </li>
              <li>
                <strong>Review the details.</strong> Read the current FDD and
                agreements with your advisers. Understand the full investment,
                services and obligations.
              </li>
              <li>
                <strong>Plan your next steps.</strong> Your independently
                retained attorney assesses your E-2 eligibility and handles
                legal advice and applications.
              </li>
            </ol>
          </div>
        </ReadMore>
        <ReadMore id="investment" title="Escrow, the full refund and investment details">
          <div className="v6-detail-body">
            <p>
              All franchise investment funds stay in escrow pending your E-2
              visa approval. If approval is not granted, those funds are
              refunded in full. Review the written escrow agreement with your
              independent attorney before transferring funds, including who
              holds them and how release or refund works.
            </p>
            <p>
              Confirm the full investment, initial and ongoing fees, working
              capital and operating responsibilities in the current Franchise
              Disclosure Document and written agreements.
            </p>
            <p>
              Ask our team for a written breakdown of your proposed package and
              any separate professional fees. Review any financial performance
              representation in Item 19; no earnings or return is guaranteed.
            </p>
            <p>
              The business earns recurring monthly management fees from rental
              property owners, with leasing and renewal fees where applicable.
              Actual revenue depends on management agreements and business
              performance. The visa-contingent refund does not protect against
              business losses after funds are released.
            </p>
            <a className="v6-resource-link" href="/request-fdd">
              Review the FDD request information
            </a>
          </div>
        </ReadMore>
        <ReadMore id="referral-details" title="If a broker introduced you">
          <div className="v6-detail-body">
            <p>
              New Dawn may compensate participating brokers when a referred
              client completes a qualifying franchise purchase. Ask your broker
              who pays them and how their compensation is calculated.
            </p>
            <p>
              You decide whether the business fits your goals. Review the
              recommendation, all fees and services, and your proposed
              investment with your own advisers. Ask our team to explain your
              written pricing and any referral-related charges before you
              commit.
            </p>
          </div>
        </ReadMore>
        <ReadMore id="team-details" title="Meet the people behind New Dawn">
          <div className="v6-detail-body">
            <p>
              Our team brings experience in business operations, real estate,
              finance and technology, with operating roots in El Paso, Texas.
              Dylan Delaney is your contact for franchise conversations, the FDD
              and next steps.
            </p>
            <p>
              Our team has supported investors through more than 70 E-2 visa
              approvals. That experience belongs to the team; it is not a
              promise about any individual application. U.S. authorities make
              all visa decisions.
            </p>
            <a className="v6-resource-link" href="/team">
              Meet the full team
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
          your next chapter.
        </h2>
        <p>
          Get your questions answered. Discuss the business, operating support
          and whether a New Dawn franchise fits your plans. Your broker or
          attorney is welcome to join with your permission.
        </p>
        <ul>
          <li>The business and your responsibilities as owner</li>
          <li>Escrow, the full refund terms and the FDD</li>
          <li>Office space, staffing and ongoing support</li>
        </ul>
        <p className="partner-note">
          Please keep initial inquiries free of sensitive personal or client
          information.
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
          <span>DISCOVERY CALL</span>
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
