import { DiscoveryCallLink } from "./discovery-call-link";
import { ReadMore } from "./read-more";

export function HeroSection() {
  return (
    <section
      className="v4-hero"
      data-testid="section-hero"
      aria-labelledby="hero-title"
    >
      <div className="v4-hero-copy">
        <div className="eyebrow">
          <i></i> E-2 INVESTOR VISA · PROPERTY MANAGEMENT
        </div>
        <h1 id="hero-title" data-testid="text-hero-title">
          Live in the USA.
          <br />
          <span>
            Build your
            <br />
            own business.
          </span>
        </h1>
        <h2 data-testid="text-hero-subtitle">
          Own a property management franchise.
        </h2>
        <p>
          Invest in America. Create local jobs.
          <br />
          We handle the day-to-day.
          <br />
          <strong>You own and direct the business.</strong>
        </p>
        <DiscoveryCallLink placement="hero" testId="button-hero-booking" />
        <span className="v5-call-note">
          30-minute call · Franchise, investment &amp; next steps
        </span>
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
            <br />A business of your own.
          </strong>
        </figcaption>
      </figure>
    </section>
  );
}

export function PrinciplesSection() {
  return (
    <div className="v4-principles" data-testid="section-trust-strip">
      <div>
        <span>01</span>
        <strong>Invest in the USA.</strong>
      </div>
      <div>
        <span>02</span>
        <strong>Create local jobs.</strong>
      </div>
      <div>
        <span>03</span>
        <strong>Own your franchise.</strong>
      </div>
    </div>
  );
}

export function BusinessSection() {
  return (
    <section
      className="v4-section v4-business"
      id="opportunities"
      aria-labelledby="business-title"
    >
      <div className="v4-intro">
        <div className="eyebrow">THE PROPERTY MANAGEMENT FRANCHISE</div>
        <h2 id="business-title">
          Your business.
          <br />
          Our day-to-day team.
        </h2>
        <p>
          Your franchise serves rental property owners. Our local team and
          technology support the daily work. You set the direction.
        </p>
      </div>
      <div className="v4-responsibilities">
        <article>
          <div className="v4-role-label">
            <span className="v4-symbol" aria-hidden="true">
              ↗
            </span>
            <span>YOU OWN &amp; DIRECT</span>
          </div>
          <h3>Lead your business.</h3>
          <ul>
            <li>Set strategy and make key decisions</li>
            <li>Control the business bank account</li>
            <li>Oversee your team and performance</li>
          </ul>
        </article>
        <article>
          <div className="v4-role-label">
            <span className="v4-symbol" aria-hidden="true">
              ⌘
            </span>
            <span>WE HANDLE THE DAY-TO-DAY</span>
          </div>
          <h3>We support the work.</h3>
          <ul>
            <li>Tenant communication and property coordination</li>
            <li>Local operating teams and training</li>
            <li>Technology, workflows, and reporting</li>
          </ul>
        </article>
      </div>
      <div className="v6-detail-group v6-business-details">
        <div className="v6-detail-intro">
          <span>A CLOSER LOOK</span>
          <p>Open a topic to explore the details.</p>
        </div>
        <ReadMore id="owner-details" title="Your role as franchise owner">
          <div className="v6-detail-body">
            <p>
              You own and actively direct the business. We implement the daily
              work under your direction, so you can focus on decisions,
              performance, and growth.
            </p>
            <div className="v6-detail-columns">
              <div>
                <h4>You control the finances.</h4>
                <p>
                  You are the business bank account signatory and make payments
                  for payroll, vendors, rent, and fees. You approve budgets and
                  major expenditures.
                </p>
              </div>
              <div>
                <h4>You lead the business.</h4>
                <p>
                  You make hiring and firing decisions, set pricing and
                  strategy, supervise the team, and review results. Our
                  operating support keeps you informed as you lead.
                </p>
              </div>
            </div>
          </div>
        </ReadMore>
        <ReadMore id="support-details" title="Our day-to-day support">
          <div className="v6-detail-body v6-detail-columns">
            <div>
              <h4>A local team with a clear process.</h4>
              <p>
                Property management brings together ongoing owner relationships,
                repeatable operations, and local staffing. We help staff and
                train the local operating team. That team handles client and
                tenant communication, coordinates property and field work, and
                reports to you.
              </p>
            </div>
            <div>
              <h4>Support from setup onward.</h4>
              <p>
                Our training, operating procedures, and technology support
                launch and ongoing operations. The franchise agreement and FDD
                explain the services, responsibilities, and fees. Our team can
                also support conversations in English and Spanish.
              </p>
            </div>
          </div>
        </ReadMore>
        <ReadMore
          id="technology-details"
          title="Technology and marketing tools"
        >
          <div className="v6-detail-body">
            <p>
              New Dawn’s systems bring daily workflows, communication, and
              performance reporting into the tools your team uses to run the
              business.
            </p>
            <div className="v6-detail-columns">
              <div>
                <h4>Visibility into your operations.</h4>
                <ul>
                  <li>Owner dashboards and performance reports</li>
                  <li>Client communication and follow-up workflows</li>
                  <li>Training and repeatable operating processes</li>
                </ul>
              </div>
              <div>
                <h4>Tools to support growth.</h4>
                <ul>
                  <li>Property-focused campaigns and email/SMS follow-up</li>
                  <li>Paid campaign, social content, and referral tracking</li>
                  <li>
                    AI-assisted prospect discovery and suggested follow-up
                  </li>
                </ul>
              </div>
            </div>
            <p>
              Discuss the tools and marketing support included in your package,
              any additional costs, and expansion options. Additional
              territories depend on availability, readiness, and the franchise
              terms.
            </p>
          </div>
        </ReadMore>
        <ReadMore id="team-details" title="The team behind New Dawn">
          <div className="v6-detail-body">
            <p>
              Our team brings experience in business operations, real estate,
              finance, and technology. Our operating roots are in El Paso,
              Texas, including real estate experience through Star Spangled
              Banner Realty.
            </p>
            <div className="v6-team-grid">
              <article>
                <h4>Jeffrey Tung</h4>
                <small>FOUNDING MEMBER</small>
                <p>
                  Small-business operations, private equity, and building
                  businesses across markets.
                </p>
              </article>
              <article>
                <h4>Chris von Pohlot</h4>
                <small>MANAGING DIRECTOR</small>
                <p>
                  Real estate, alternative finance, and capital markets
                  experience.
                </p>
              </article>
              <article>
                <h4>Tom Meister</h4>
                <small>FOUNDING MEMBER</small>
                <p>Entrepreneurial, finance, and legal industry experience.</p>
              </article>
            </div>
            <p>
              Dylan Delaney guides franchise conversations, FDD review,
              territory discussions, and launch planning. Your independently
              retained attorney handles immigration and legal advice.
            </p>
            <a
              className="v6-resource-link"
              href="/team"
              target="_blank"
              rel="noopener"
            >
              Meet the full team ↗
            </a>
          </div>
        </ReadMore>
      </div>
    </section>
  );
}

export function PathwaySection() {
  return (
    <section
      className="v4-section v4-path"
      id="how"
      data-testid="section-how"
      aria-labelledby="path-title"
    >
      <div className="v4-path-heading">
        <div>
          <div className="eyebrow">YOUR BUSINESS. YOUR E-2 PLANS.</div>
          <h2 id="path-title">A path worth exploring.</h2>
        </div>
        <p>
          The E-2 investor visa may allow eligible investors to live in the U.S.
          to develop and direct their business. Your immigration attorney
          assesses your eligibility and guides your application.
        </p>
      </div>
      <div className="v4-steps">
        <article>
          <span>01</span>
          <h3>Explore the franchise.</h3>
          <p>
            Discuss your goals. Review the business model, investment details,
            and Franchise Disclosure Document.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Plan your E-2 application.</h3>
          <p>
            Work with your own immigration attorney while we help you understand
            and plan the franchise.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Lead with our support.</h3>
          <p>
            Following the required approvals, begin your U.S. chapter and direct
            your business with our operating team behind you.
          </p>
        </article>
      </div>
      <div className="v4-path-note">
        Franchise ownership does not guarantee visa eligibility or approval.{" "}
        <a
          href="https://travel.state.gov/content/travel/en/us-visas/employment/treaty-trader-investor-visa-e.html"
          target="_blank"
          rel="noopener"
        >
          About the E-2 visa ↗
        </a>
      </div>
      <div className="v6-detail-group">
        <ReadMore
          id="eligibility-details"
          title="Eligibility and your family’s plans"
        >
          <div className="v6-detail-body v6-detail-columns">
            <div>
              <h4>Start with an individual assessment.</h4>
              <p>
                E-2 requirements include treaty-country nationality, a
                substantial investment in a real operating enterprise, and
                developing and directing that business. The enterprise must meet
                the applicable economic requirements. Your attorney assesses the
                complete criteria against your circumstances.
              </p>
              <p>
                New Dawn provides franchise information and operational support.
                Immigration advice and applications are handled by your
                attorney.
              </p>
            </div>
            <div>
              <h4>Plan for your family, too.</h4>
              <p>
                Your spouse and unmarried children under 21 may apply to
                accompany or join you. Discuss the principal applicant,
                dependent eligibility, work, and study with your attorney.
              </p>
              <p>
                E-2 is a temporary visa category. Longer-term plans, renewals,
                and any separate permanent-residence option, including EB-5,
                need their own legal assessment.
              </p>
            </div>
          </div>
        </ReadMore>
        <ReadMore id="location-details" title="Location, timing and next steps">
          <div className="v6-detail-body v6-detail-columns">
            <div>
              <h4>Choose a business that fits your plans.</h4>
              <p>
                New Dawn’s operating roots are in El Paso. We’ll discuss
                available territories and how you would oversee the local team.
                Review any plans to live elsewhere with your attorney and our
                franchise team.
              </p>
              <p>
                Your franchise serves property owners; buying real estate is a
                separate decision from owning the property management business.
              </p>
            </div>
            <div>
              <h4>Build a realistic timeline.</h4>
              <p>
                Franchise review, business setup, application preparation, and
                consular processing each take time. Appointment availability and
                processing vary by location and individual case.
              </p>
              <p>
                Start with a discovery call, review the FDD, and coordinate your
                business and immigration plans before making relocation
                commitments.
              </p>
              <a
                className="v6-resource-link"
                href="https://www.usembassy.gov/"
                target="_blank"
                rel="noopener"
              >
                Find your U.S. embassy or consulate ↗
              </a>
            </div>
          </div>
        </ReadMore>
      </div>
    </section>
  );
}

export function InvestmentSection() {
  return (
    <section
      className="v4-section v6-investment"
      id="investment"
      aria-labelledby="investment-title"
    >
      <div className="v6-investment-intro">
        <div className="eyebrow">UNDERSTAND THE INVESTMENT</div>
        <h2 id="investment-title">
          The numbers.
          <br /> The details.
          <br /> Your decision.
        </h2>
        <div className="v6-price">
          <span>FRANCHISE PACKAGES FROM</span>
          <strong>$225,000</strong>
        </div>
        <p>
          Confirm the full property management investment, fees, and working
          capital in the current Franchise Disclosure Document.
        </p>
      </div>
      <div className="v6-detail-group">
        <ReadMore id="investment-details" title="What your investment includes">
          <div className="v6-detail-body">
            <p>
              Franchise packages bring together the franchise license, initial
              training, technology access, and business setup support.
            </p>
            <p>
              Review the property management package’s exact scope, initial and
              ongoing fees, operating capital, and any separate professional or
              immigration costs before deciding. The current FDD and agreements
              provide the full breakdown.
            </p>
          </div>
        </ReadMore>
        <ReadMore id="financing-details" title="Financing and escrow terms">
          <div className="v6-detail-body">
            <h4>Explore the funding options.</h4>
            <p>
              Financing may be available through affiliates, subject to approval
              and applicable terms. Review the funding structure with your
              advisers, including whether it fits your E-2 plans.
            </p>
            <h4>Understand the written conditions.</h4>
            <p>
              Ask us to walk through the escrow agreement, release conditions,
              and any visa-denial refund or exit provisions. Eligibility,
              timing, deductions, and other conditions depend on the applicable
              documents.
            </p>
            <p>
              Review these terms in the FDD and agreements with your advisers
              before committing funds.
            </p>
          </div>
        </ReadMore>
        <ReadMore id="fdd-details" title="Financial performance and the FDD">
          <div className="v6-detail-body">
            <p>
              The Franchise Disclosure Document explains the franchise offering,
              fees, obligations, and key terms. For financial performance
              information, review the representation provided in Item 19.
            </p>
            <p>
              Read the full Item 19 disclosures, assumptions, and limitations
              with your advisers. Financial performance varies, and no earnings
              or return is guaranteed.
            </p>
            <p>
              We can walk through the available materials and your questions on
              a discovery call.
            </p>
            <a
              className="v6-resource-link"
              href="/request-fdd"
              target="_blank"
              rel="noopener"
            >
              Review the FDD request information ↗
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
        <div className="eyebrow">YOUR NEXT STEP</div>
        <h2>
          Let’s talk about
          <br />
          your American chapter.
        </h2>
        <p>
          Get your questions answered and understand whether a New Dawn property
          management franchise fits your plans.
        </p>
        <ul>
          <li>The franchise and your role as owner</li>
          <li>Investment details and the FDD</li>
          <li>Day-to-day support and next steps</li>
        </ul>
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
          Bring your goals and your questions.
        </p>
        <DiscoveryCallLink placement="dylan" testId="button-dylan-calendly" />
        <small>Opens Calendly to select a time.</small>
      </div>
    </section>
  );
}
