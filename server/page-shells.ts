export type PageShell = {
  title: string;
  description: string;
  html: string;
  /** Structured Q&A, mirrored from the page's FAQ section, emitted as FAQPage JSON-LD. */
  faq?: { question: string; answer: string }[];
};

const SITE = "New Dawn Franchising";
const TAGLINE = "The first franchise designed specifically for the E-2 Visa investor.";
const ADDR = "2601 N Zaragoza Rd, El Paso, TX 79938";
const PHONE = "(346) 597-9994";
const EMAIL = "franchising@newdawnfranchising.com";

const shells: Record<string, PageShell> = {
  "/": {
    title: `${SITE} | E-2 Visa Franchise Platform — Property Management, Telecom & Insurance | El Paso, TX`,
    description:
      "New Dawn Franchising is a multi-vertical franchisor for E-2 visa investors. Choose from three recurring-revenue franchises — Property Management, Telecom, or Insurance. You direct the business; our teams run daily operations. Investment from $225,000. FDD available upon request.",
    html: `
<main>
  <h1>Three Industries. One E-2 Platform.</h1>
  <p>New Dawn Franchising is a multi-vertical franchisor built specifically for E-2 Treaty Investor Visa investors. Choose from three recurring-revenue franchise verticals — Property Management, Telecom, or Insurance — and direct a real, operating U.S. business while our teams handle the daily execution, exactly as the E-2 visa requires.</p>
  <p>${TAGLINE}</p>
  <p>Franchise Disclosure Document (FDD) available upon request. New Dawn Franchising is a registered franchisor.</p>

  <section>
    <h2>Our Three E-2 Franchise Verticals</h2>
    <p>New Dawn selected three industries that lend themselves to recurring revenue, documented operating systems, supervisory control, staffing, and renewal-ready reporting — traits that support a credible E-2 business.</p>
    <ul>
      <li><strong>Property Management</strong> — Long-term rental management operations with local execution teams and owner-level reporting.</li>
      <li><strong>Telecom</strong> — Recurring-service telecom operations supported by centralized systems, sales workflows, and oversight dashboards.</li>
      <li><strong>Insurance</strong> — Insurance-sector franchise operations designed around compliant supervision, client service, and recurring revenue.</li>
    </ul>
  </section>

  <section>
    <h2>Proprietary Technology Across Every Vertical</h2>
    <p>Every New Dawn franchisee benefits from proprietary technology built exclusively for our multi-vertical system — from owner dashboards and client communications to marketing, reporting, and workflow automation. This isn't off-the-shelf software. It's infrastructure designed around E-2 investor oversight across Property Management, Telecom, and Insurance.</p>
    <ul>
      <li>Owner dashboards and operational reporting</li>
      <li>Automated client communication &amp; follow-up</li>
      <li>Marketing and lead generation that runs around the clock</li>
    </ul>
  </section>

  <section>
    <h2>How It Works</h2>
    <ol>
      <li><strong>Choose Your Vertical &amp; Invest</strong> — Select Property Management, Telecom, or Insurance and acquire your New Dawn franchise starting at $225,000. This structured investment is designed to meet E-2 visa capital requirements and gives you a real, operating business.</li>
      <li><strong>Apply for Your E-2 Visa</strong> — Our partner immigration attorneys guide you through the E-2 visa application. You own and direct a legitimate U.S. business — the foundation of a strong E-2 petition.</li>
      <li><strong>Local Teams Run Daily Operations</strong> — Approved operating teams manage day-to-day execution in your chosen vertical. You oversee the business, review reports, and make the key decisions.</li>
      <li><strong>Grow Your U.S. Enterprise</strong> — Scale your business, build equity, and maintain executive control while living anywhere in the United States.</li>
    </ol>
  </section>

  <section>
    <h2>Why New Dawn Franchising?</h2>
    <ul>
      <li>A multi-vertical E-2 platform — choose Property Management, Telecom, or Insurance</li>
      <li>Franchise investment from $225,000 — structured to meet E-2 visa requirements</li>
      <li>Proprietary technology powers every vertical</li>
      <li>Approved local teams handle day-to-day operations</li>
      <li>In-house E-2 immigration, finance, real estate, and legal professionals</li>
      <li>Headquartered in El Paso, Texas, with domestic geographic flexibility for owners</li>
      <li>Part of the New Dawn Franchising Group of Companies™</li>
    </ul>
  </section>

  <section>
    <h2>Investment Overview</h2>
    <p>Franchise investment starts at $225,000, covering your franchise license, training, technology platform access, and operational setup. Financing options are available through our affiliated lending partners.</p>
    <p>The E-2 visa requires a substantial and at-risk investment in a U.S. business. Each New Dawn vertical is structured specifically to meet this requirement.</p>
  </section>

  <section>
    <h2>Frequently Asked Questions</h2>
    <h3>What is New Dawn Franchising?</h3>
    <p>New Dawn Franchising is a multi-vertical franchisor specializing in E-2 Treaty Investor Visa-qualifying franchises. Investors choose from three recurring-revenue industries — Property Management, Telecom, or Insurance.</p>
    <h3>What is the E-2 visa?</h3>
    <p>The E-2 Treaty Investor Visa allows nationals of treaty countries to enter and work in the U.S. based on a substantial investment in a U.S. business. The investor must own and direct the enterprise.</p>
    <h3>How much do I need to invest?</h3>
    <p>New Dawn franchise investment starts at $225,000. The E-2 visa does not have a fixed minimum, but the investment must be "substantial" relative to the total cost of the business.</p>
    <h3>How do I choose between Property Management, Telecom, and Insurance?</h3>
    <p>The FDD and discovery process help you compare the three options. We look at your goals, market fit, investment preferences, operational comfort, and E-2 strategy, then walk you through which vertical is the strongest fit.</p>
    <h3>Do I have to do the day-to-day work myself?</h3>
    <p>No. Each New Dawn vertical is structured so you are the business director and decision-maker. You maintain ownership control, bank-account oversight, and executive supervision while approved local teams manage daily execution.</p>
    <h3>Can I live anywhere in the USA on the E-2 visa?</h3>
    <p>Yes. New Dawn is headquartered in El Paso, Texas, but qualified E-2 owners can live elsewhere in the United States while maintaining executive oversight of the franchise.</p>
  </section>

  <section>
    <h2>Contact New Dawn Franchising</h2>
    <p>Ready to learn more? Contact us to request the FDD and schedule an intro call.</p>
    <address>
      <p>${ADDR}</p>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
    </address>
  </section>
</main>`,
    faq: [
      {
        question: "What is New Dawn Franchising?",
        answer:
          "New Dawn Franchising is a multi-vertical franchisor specializing in E-2 Treaty Investor Visa-qualifying franchises. Investors choose from three recurring-revenue industries — Property Management, Telecom, or Insurance — and direct a real U.S. business while New Dawn's operating teams handle daily execution.",
      },
      {
        question: "What is the E-2 visa?",
        answer:
          "The E-2 Treaty Investor Visa allows nationals of treaty countries to enter and work in the U.S. based on a substantial investment in a U.S. business. The investor must own and direct the enterprise.",
      },
      {
        question: "How much do I need to invest?",
        answer:
          "New Dawn franchise investment starts at $225,000. The E-2 visa does not have a fixed minimum, but the investment must be \"substantial\" relative to the total cost of the business.",
      },
      {
        question: "How do I choose between Property Management, Telecom, and Insurance?",
        answer:
          "The FDD and discovery process help you compare the three options. We look at your goals, market fit, investment preferences, operational comfort, and E-2 strategy, then walk you through which vertical is the strongest fit.",
      },
      {
        question: "Do I have to do the day-to-day work myself?",
        answer:
          "No. Each New Dawn vertical is structured so you are the business director and decision-maker. You maintain ownership control, bank-account oversight, and executive supervision while approved local teams manage daily execution.",
      },
      {
        question: "Can I live anywhere in the USA on the E-2 visa?",
        answer:
          "Yes. New Dawn is headquartered in El Paso, Texas, but qualified E-2 owners can live elsewhere in the United States while maintaining executive oversight of the franchise.",
      },
    ],
  },

  "/about": {
    title: `About ${SITE} | Multi-Vertical E-2 Visa Franchisor for International Investors`,
    description:
      "Learn about New Dawn Franchising LLC — a multi-vertical franchisor specializing in E-2 visa-qualifying franchises across Property Management, Telecom, and Insurance, backed by the New Dawn Franchising Group of Companies™.",
    html: `
<main>
  <h1>About New Dawn Franchising</h1>
  <p>${TAGLINE}</p>
  <p>New Dawn Franchising LLC is a multi-vertical franchisor headquartered in El Paso, Texas. We work exclusively with E-2 visa investors who want to own a real, operating U.S. business — one they direct and control — across three recurring-revenue industries: Property Management, Telecom, and Insurance.</p>
  <p>Unlike general-purpose franchises retrofitted for visa purposes, New Dawn was designed from the ground up with the E-2 investor in mind. Our legal structure, operating model, and proprietary technology all reflect the requirements of the E-2 treaty investor visa.</p>

  <section>
    <h2>Three Recurring-Revenue Verticals</h2>
    <ul>
      <li><strong>Property Management</strong> — Long-term rental management operations with local execution teams and owner-level reporting.</li>
      <li><strong>Telecom</strong> — Recurring-service telecom operations supported by centralized systems, sales workflows, and oversight dashboards.</li>
      <li><strong>Insurance</strong> — Insurance-sector franchise operations designed around compliant supervision, client service, and recurring revenue.</li>
    </ul>
  </section>

  <section>
    <h2>The New Dawn Franchising Group of Companies™</h2>
    <p>New Dawn Franchising is part of the New Dawn Franchising Group of Companies™ — an established organization with large, experienced teams across real estate, financing, and law, each with over a decade of proven success. All supported by proprietary technology built in-house.</p>
    <ul>
      <li><strong>Star Spangled Banner Realty</strong> — An established real estate brokerage with dozens of experienced agents and over a decade of expertise across El Paso and beyond.</li>
      <li><strong>New Dawn Financing</strong> — In-house financing solutions to help franchise buyers structure their investment and meet E-2 capital requirements.</li>
      <li><strong>New Dawn Legal</strong> — Partner immigration attorneys specializing in E-2 visa applications for franchise investors.</li>
      <li><strong>New Dawn Property Management</strong> — The operational arm that provides management services for the property management vertical.</li>
    </ul>
  </section>

  <section>
    <h2>Our Mission</h2>
    <p>To create a clear, compliant, and professionally operated pathway for international investors to establish and direct a U.S. business through the E-2 Treaty Investor Visa — and to build lasting value for every franchisee in our network.</p>
  </section>

  <section>
    <h2>Contact Us</h2>
    <address>
      <p>${ADDR}</p>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
    </address>
  </section>
</main>`,
  },

  "/team": {
    title: `Our Team | ${SITE}`,
    description:
      "Meet the New Dawn Franchising leadership team — experienced professionals in property management, real estate, immigration law, and franchise operations.",
    html: `
<main>
  <h1>Our Team</h1>
  <p>New Dawn Franchising is led by experienced professionals in property management, real estate, immigration law, and franchise operations. Our team is dedicated to helping E-2 visa investors build and direct successful U.S. businesses.</p>

  <section>
    <h2>Leadership</h2>
    <ul>
      <li><strong>Chris Von Pohlot</strong> — Managing Director. Founder and visionary behind New Dawn Franchising LLC. Chris brings deep expertise in property management, franchise development, and building scalable operational systems for E-2 visa investors.</li>
      <li><strong>Tom Meister</strong> — Advisor. Founding Member. Brings decades of experience in real estate and business operations to the New Dawn advisory team.</li>
      <li><strong>Kamal Obbad</strong> — Advisor. Founding Member. Expert in franchise development, investor relations, and strategic business growth.</li>
      <li><strong>Zachary Bohlender</strong> — Advisor. Founding Member. Specialist in legal compliance, franchise disclosure, and investor structuring.</li>
      <li><strong>Dylan Delaney</strong> — Advisor. Founding Member. Experienced in property management operations and franchise system development.</li>
      <li><strong>Kevin Hatch</strong> — Advisor. Founding Member. Expert in real estate investment, market analysis, and franchise territory evaluation.</li>
    </ul>
  </section>
</main>`,
  },

  "/e2-visa-franchise": {
    title: `The Franchisor Built for the E-2 Visa | ${SITE}`,
    description:
      "New Dawn Franchising is a multi-vertical franchisor built specifically for the E-2 Treaty Investor Visa. Choose Property Management, Telecom, or Insurance — own and direct a real U.S. business from $225,000. FDD available upon request.",
    html: `
<main>
  <h1>The Franchisor Built for the E-2 Visa</h1>
  <p>New Dawn Franchising is a multi-vertical franchisor designed specifically for E-2 Treaty Investor Visa investors. You choose one of three recurring-revenue franchises — Property Management, Telecom, or Insurance — own and direct a real U.S. business, and our teams handle the daily execution.</p>
  <p>Unlike general-purpose franchises that merely qualify for the E-2 visa, New Dawn was designed from the ground up around the E-2 requirements.</p>

  <section>
    <h2>Designed Around the E-2 Requirements</h2>
    <ul>
      <li><strong>A substantial investment:</strong> Franchise investment starts at $225,000, sized to meet the E-2 substantiality test.</li>
      <li><strong>Capital genuinely at risk:</strong> Your investment funds a real, operating U.S. business, satisfying the E-2 "at-risk" requirement.</li>
      <li><strong>You direct and develop it:</strong> You own the franchise, control the bank accounts, and make the key decisions while approved teams execute day-to-day.</li>
      <li><strong>More than a marginal enterprise:</strong> All three verticals are recurring-revenue businesses built to generate real, ongoing activity.</li>
      <li><strong>Open to treaty nationals:</strong> The E-2 visa is available to nationals of 80+ treaty countries.</li>
    </ul>
  </section>

  <section>
    <h2>Choose Your Franchise Vertical</h2>
    <ul>
      <li><strong>Property Management</strong> — Long-term rental management operations with local execution teams and owner-level reporting.</li>
      <li><strong>Telecom</strong> — Recurring-service telecom operations supported by centralized systems, sales workflows, and oversight dashboards.</li>
      <li><strong>Insurance</strong> — Insurance-sector franchise operations designed around compliant supervision, client service, and recurring revenue.</li>
    </ul>
  </section>

  <section>
    <h2>Frequently Asked Questions</h2>
    <h3>What does "a franchisor built for the E-2 visa" mean?</h3>
    <p>Most franchises are general-purpose businesses that happen to qualify for the E-2 visa. New Dawn Franchising was designed from the ground up around the E-2 requirements — a substantial, at-risk investment in a real operating business that you own and direct.</p>
    <h3>Which franchise verticals does New Dawn offer?</h3>
    <p>Three recurring-revenue industries chosen for E-2 fit: Property Management, Telecom, and Insurance.</p>
    <h3>How much do I need to invest?</h3>
    <p>Franchise investment starts at $225,000, structured to meet the E-2 substantial-investment requirement. Financing options are available.</p>
    <h3>Do I have to run the business day-to-day?</h3>
    <p>No. Each vertical is structured so you are the business director and decision-maker while approved local teams manage daily execution.</p>
    <h3>Can I live anywhere in the U.S.?</h3>
    <p>Yes. New Dawn is headquartered in El Paso, Texas, but qualified E-2 owners can live anywhere in the United States.</p>
  </section>

  <section>
    <h2>Request Information</h2>
    <p>Contact us to request the FDD and schedule an intro call.</p>
    <address>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
    </address>
  </section>
</main>`,
    faq: [
      {
        question: "What does \"a franchisor built for the E-2 visa\" mean?",
        answer:
          "Most franchises are general-purpose businesses that happen to qualify for the E-2 visa. New Dawn Franchising was designed from the ground up around the E-2 requirements — a substantial, at-risk investment in a real operating business that you own and direct.",
      },
      {
        question: "Which franchise verticals does New Dawn offer?",
        answer:
          "Three recurring-revenue industries chosen for E-2 fit: Property Management, Telecom, and Insurance. You select the one that best matches your goals during the discovery process.",
      },
      {
        question: "How much do I need to invest?",
        answer:
          "Franchise investment starts at $225,000, structured to meet the E-2 substantial-investment requirement. Financing options are available.",
      },
      {
        question: "Do I have to run the business day-to-day?",
        answer:
          "No. Each vertical is structured so you are the business director and decision-maker. You keep ownership control and bank-account oversight while approved local teams manage daily execution.",
      },
      {
        question: "Can I live anywhere in the U.S.?",
        answer:
          "Yes. New Dawn is headquartered in El Paso, Texas, but qualified E-2 owners can live anywhere in the United States while maintaining executive oversight of the franchise.",
      },
    ],
  },

  "/e2-fit": {
    title: `E-2 Visa Franchise Fit | Why New Dawn is the Right E-2 Business | ${SITE}`,
    description:
      "New Dawn Franchising is built specifically for the E-2 Treaty Investor Visa. Learn why our multi-vertical franchise model — Property Management, Telecom, and Insurance — satisfies E-2 requirements and how you can qualify.",
    html: `
<main>
  <h1>Why New Dawn is the Right E-2 Visa Franchise</h1>
  <p>The E-2 Treaty Investor Visa requires a substantial investment in a real, active U.S. business that you own and direct. New Dawn Franchising is structured specifically to meet every E-2 requirement — from the investment amount to the "at risk" capital test to the requirement that you direct and develop the enterprise.</p>

  <section>
    <h2>E-2 Visa Requirements — and How We Satisfy Each One</h2>
    <ul>
      <li><strong>Substantial investment:</strong> Our franchise packages start at $225,000 — a proven threshold that immigration attorneys consistently use for E-2 petitions.</li>
      <li><strong>Capital at risk:</strong> Your franchise investment is a real, operating business. The capital is at commercial risk, satisfying the E-2 "at risk" requirement.</li>
      <li><strong>Ownership and direction:</strong> You are the franchise owner and director. You control the bank accounts, make all key business decisions, and oversee operations.</li>
      <li><strong>More than marginal enterprise:</strong> Our property management territories generate real revenue from day one, with a network of 300+ active management contracts.</li>
      <li><strong>Treaty country nationality:</strong> E-2 is available to nationals of over 80 treaty countries. Contact us to confirm your country's eligibility.</li>
    </ul>
  </section>

  <section>
    <h2>The E-2 Visa Process with New Dawn</h2>
    <ol>
      <li>Sign the franchise agreement and place your investment</li>
      <li>Work with our partner immigration attorneys to prepare your E-2 petition</li>
      <li>E-2 visa approved — you're authorized to enter or remain in the U.S.</li>
      <li>Your territory-approved manager begins or continues day-to-day operations</li>
      <li>90-day contract replacement guarantee protects your portfolio</li>
      <li>Live anywhere in the USA while your franchise operates in El Paso, Texas</li>
    </ol>
  </section>

  <section>
    <h2>Why Property Management for E-2?</h2>
    <p>Property management is one of the strongest E-2 visa business categories because:</p>
    <ul>
      <li>High demand for professional rental management in growing U.S. markets</li>
      <li>Recurring revenue from monthly management fees provides stable cash flow</li>
      <li>Scalable model — add contracts without proportional increase in overhead</li>
      <li>Real, active business operations that clearly satisfy E-2 "non-marginal" requirements</li>
      <li>El Paso, Texas has a strong and growing rental market with consistent demand</li>
    </ul>
  </section>

  <section>
    <h2>Frequently Asked Questions About E-2 and New Dawn</h2>
    <h3>Which countries are eligible for the E-2 visa?</h3>
    <p>The E-2 visa is available to nationals of countries that have a bilateral investment treaty with the United States. There are over 80 eligible countries including Mexico, Canada, Germany, Japan, South Korea, Turkey, Israel, and many more. Contact us to confirm your country's eligibility.</p>
    <h3>How long does the E-2 visa last?</h3>
    <p>E-2 visas are typically issued for 2–5 years and can be renewed indefinitely as long as the business remains operational and you continue to direct the enterprise.</p>
    <h3>Can my spouse and children come to the U.S. on E-2?</h3>
    <p>Yes. E-2 visa holders can bring their spouse and unmarried children under 21 as E-2 dependents. Your spouse is eligible for work authorization anywhere in the U.S.</p>
  </section>
</main>`,
    faq: [
      {
        question: "Which countries are eligible for the E-2 visa?",
        answer:
          "The E-2 visa is available to nationals of countries that have a bilateral investment treaty with the United States. There are over 80 eligible countries including Mexico, Canada, Germany, Japan, South Korea, Turkey, Israel, and many more. Contact us to confirm your country's eligibility.",
      },
      {
        question: "How long does the E-2 visa last?",
        answer:
          "E-2 visas are typically issued for 2–5 years and can be renewed indefinitely as long as the business remains operational and you continue to direct the enterprise.",
      },
      {
        question: "Can my spouse and children come to the U.S. on E-2?",
        answer:
          "Yes. E-2 visa holders can bring their spouse and unmarried children under 21 as E-2 dependents. Your spouse is eligible for work authorization anywhere in the U.S.",
      },
    ],
  },

  "/territories": {
    title: `Where You Operate | Territories & Nationwide Verticals | ${SITE}`,
    description:
      "Each New Dawn vertical has its own footprint: Property Management runs in defined local territories (El Paso, TX, with 300+ contracts), while Telecom and Insurance are recurring-revenue businesses that serve clients across the United States.",
    html: `
<main>
  <h1>Where You Operate</h1>
  <p>New Dawn is a multi-vertical franchise platform, and each vertical has its own geographic footprint. Property Management is a local, on-the-ground business that runs in defined territories. Telecom and Insurance are recurring-revenue businesses that are not tied to one city — they serve clients across the entire United States.</p>

  <section>
    <h2>Property Management — local territories (El Paso, Texas)</h2>
    <p>Property management is an on-the-ground service business: you manage physical homes, coordinate local vendors, and serve property owners in a specific market. It runs in defined geographic territories, and our operations are established in El Paso, Texas with 300+ active management contracts in the network. Leasing, inspections, and maintenance happen on location, so the business is tied to a metro.</p>
  </section>

  <section>
    <h2>Telecom (VoIP) — nationwide</h2>
    <p>Telecom is a recurring-subscription business delivered over the internet and phone networks. It is not tied to a storefront or a single metro — subscribers can be located anywhere in the U.S., so the market is national rather than a fixed territory. You direct the business while centralized systems and teams handle provisioning, billing, and support.</p>
  </section>

  <section>
    <h2>Insurance — nationwide</h2>
    <p>Insurance is a renewal-driven business built on a book of clients and recurring premiums. Like telecom, it is not confined to a single metro — you build a nationwide book of business, subject to applicable state licensing. Licensed staff handle regulated activity under proper supervision while you direct the operation.</p>
  </section>

  <section>
    <h2>Direct your business — and live where you choose</h2>
    <p>Wherever your business operates, you direct it. New Dawn is headquartered in El Paso, Texas, and the Property Management operation runs there, but qualified E-2 owners can live elsewhere in the United States while maintaining ownership, financial control, and executive oversight. Telecom and Insurance add nationwide reach on top of that flexibility.</p>
  </section>

  <section>
    <h2>Availability &amp; next steps</h2>
    <p>Tell us your goals and timeline and we'll walk you through whether a local Property Management territory or a nationwide Telecom or Insurance business is the better fit — then send the FDD.</p>
    <address>
      <p>${ADDR}</p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
    </address>
  </section>
</main>`,
  },

  "/contact": {
    title: `Request Information | ${SITE}`,
    description:
      "Contact New Dawn Franchising to request the FDD, investor overview deck, or to schedule an intro call. También hablamos español.",
    html: `
<main>
  <h1>Request Information</h1>
  <p>Share a few details and we will send you our overview deck and next steps. También hablamos español.</p>

  <section>
    <h2>What Happens Next</h2>
    <ol>
      <li>We send the overview deck and operating model</li>
      <li>We confirm your timeline and territory interest</li>
      <li>We schedule a short intro call</li>
      <li>We share next steps and required materials including the FDD</li>
    </ol>
  </section>

  <section>
    <h2>Contact Details</h2>
    <address>
      <p>${ADDR}</p>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
    </address>
  </section>
</main>`,
  },

  "/process": {
    title: `How the Franchise Works | ${SITE}`,
    description:
      "Learn how the New Dawn Franchising process works — from initial investment to E-2 visa approval to running your property management franchise in El Paso, Texas.",
    html: `
<main>
  <h1>How New Dawn Franchising Works</h1>
  <p>A clear, structured process from your first inquiry to E-2 visa approval and franchise operations.</p>

  <section>
    <h2>The New Dawn Process</h2>
    <ol>
      <li><strong>Discovery &amp; Information</strong> — Request our investor overview deck and FDD. Schedule an intro call with our team. Ask questions, review materials, and determine if New Dawn is the right fit.</li>
      <li><strong>Franchise Agreement &amp; Investment</strong> — Sign the franchise agreement and place your investment starting at $225,000. This creates your legal franchise entity and activates your territory.</li>
      <li><strong>E-2 Visa Application</strong> — Our partner immigration attorneys prepare and file your E-2 petition with all required documentation, including the FDD and proof of investment.</li>
      <li><strong>Approval &amp; Onboarding</strong> — Once approved, you complete our franchise onboarding program. Your territory manager is assigned and operations begin.</li>
      <li><strong>Ongoing Operations &amp; Growth</strong> — Your territory manager handles day-to-day management. You direct the business, review performance, and grow your portfolio.</li>
    </ol>
  </section>

  <section>
    <h2>Timeline</h2>
    <p>Most investors complete the full process — from initial inquiry to E-2 visa approval — in 4 to 8 months. Timeline varies by country of nationality and consulate processing times.</p>
  </section>
</main>`,
  },

  "/blog": {
    title: `Blog | Property Management &amp; E-2 Visa Insights | ${SITE}`,
    description:
      "Insights on property management franchising, the E-2 Treaty Investor Visa, Texas real estate, and franchise investment for international investors.",
    html: `
<main>
  <h1>New Dawn Franchising Blog</h1>
  <p>Insights on property management franchising, the E-2 Treaty Investor Visa, Texas real estate, and franchise investment for international investors.</p>
</main>`,
  },

  "/marketing": {
    title: `Franchise Marketing System | ${SITE}`,
    description:
      "New Dawn franchisees get access to a proprietary marketing academy — automating lead generation, email campaigns, social media, and property marketing from one dashboard.",
    html: `
<main>
  <h1>Your Marketing Engine</h1>
  <p>A state-of-the-art marketing department at your fingertips, powered by proprietary technology built exclusively for New Dawn franchisees. Our systems automate campaigns, generate content, and optimize your outreach — with a human touch — so you can grow your property management portfolio without becoming a marketing expert.</p>

  <section>
    <h2>One Portal. Every Marketing Channel.</h2>
    <ul>
      <li>Email drip campaigns for property owners and tenants</li>
      <li>Social media content and scheduling</li>
      <li>Pay-per-click advertising management</li>
      <li>Property listing syndication</li>
      <li>Lead tracking and follow-up automation</li>
      <li>Performance analytics and reporting</li>
    </ul>
  </section>
</main>`,
  },

  "/real-estate": {
    title: `Real Estate Opportunities | ${SITE} &amp; Star Spangled Banner Realty`,
    description:
      "New Dawn franchisees can earn real estate referral commissions and become licensed agents through Star Spangled Banner Realty — a partner brokerage with over a decade of Texas real estate experience.",
    html: `
<main>
  <h1>Real Estate Income for New Dawn Franchisees</h1>
  <p>Your New Dawn franchise doesn't just earn property management fees. You also have access to real estate income through Star Spangled Banner Realty — our affiliated brokerage with dozens of experienced agents and over a decade of expertise across El Paso and beyond.</p>

  <section>
    <h2>Star Spangled Banner Realty</h2>
    <p>Star Spangled Banner Realty brings over a decade of experience, dozens of experienced agents, and the proprietary tools you need to succeed in Texas real estate.</p>
  </section>

  <section>
    <h2>How You Can Earn Real Estate Income</h2>
    <ul>
      <li>Earn referral commissions by referring buyers and sellers — no license required</li>
      <li>Become a licensed real estate agent with our support and mentorship</li>
      <li>Use your franchise marketing academy to generate real estate leads in El Paso and surrounding areas</li>
    </ul>
  </section>
</main>`,
  },

  "/quiz": {
    title: `E-2 Franchise Fit Quiz | Is New Dawn Right for You? | ${SITE}`,
    description:
      "Take our short quiz to find out if New Dawn Franchising is the right E-2 visa franchise for your situation. Takes less than 2 minutes.",
    html: `
<main>
  <h1>Is New Dawn Franchising Right for You?</h1>
  <p>Take our short fit quiz to find out if New Dawn is the right E-2 visa franchise for your situation. Takes less than 2 minutes.</p>
  <p>We'll ask about your investment timeline, capital range, and goals to help you understand if our model aligns with your E-2 visa franchise investment plans.</p>
</main>`,
  },

  "/property-management": {
    title: `Property Management Franchise for E-2 Visa Investors — Long-Term Rentals | ${SITE}`,
    description:
      "E-2 visa property management franchise. Own and direct a recurring-revenue long-term rental management business while New Dawn's local teams run daily operations. Investment from $225,000. FDD available upon request.",
    html: `
<main>
  <h1>Property Management: Recurring Revenue You Direct, Operations We Run</h1>
  <p>The New Dawn Property Management franchise is a real, operating U.S. business that manages residential long-term rentals on behalf of property owners — handling leasing, rent collection, tenant relations, maintenance coordination, and owner reporting under ongoing management agreements. It is structured so you own and direct the enterprise while approved local teams handle daily execution, exactly as the E-2 visa requires.</p>

  <section>
    <h2>Where the recurring revenue comes from</h2>
    <p>Each property owner signs an ongoing management agreement appointing your franchise to manage their rental. The franchise earns a recurring monthly management fee for every property under management, plus leasing/tenant-placement fees and, where applicable, renewal fees — so revenue compounds as the portfolio of doors under management grows and clients renew.</p>
  </section>

  <section>
    <h2>You direct it; our teams run it</h2>
    <p>You are the owner and director. You set direction, review performance, approve key decisions, and keep ownership and bank-account control. Approved local teams handle leasing, tenant relations, rent collection, and maintenance, supported by proprietary technology and owner dashboards that give you the information you use to supervise and decide.</p>
  </section>

  <section>
    <h2>Why property management fits the E-2 visa</h2>
    <ul>
      <li>You own and direct a genuine operating business — the foundation of a strong E-2 petition.</li>
      <li>Recurring monthly management fees that compound rather than restarting from zero.</li>
      <li>Long-term (annual) leases mean steadier income and lower turnover than short-term rentals.</li>
      <li>The business employs U.S. workers, helping demonstrate the enterprise is more than marginal.</li>
      <li>Owner dashboards and reporting create an auditable record of your active oversight for renewals.</li>
    </ul>
  </section>

  <section>
    <h2>Investment overview</h2>
    <p>Property Management franchise investment starts at $225,000, covering your franchise license, training, technology platform access, and operational setup. Financing options are available through affiliated lending partners. The E-2 visa requires a substantial, at-risk investment in a U.S. business; this vertical is structured to meet that requirement. Full details are in the Franchise Disclosure Document (FDD).</p>
  </section>

  <section>
    <h2>Frequently Asked Questions</h2>
    <h3>What does the Property Management franchise actually do?</h3>
    <p>It manages residential long-term rentals on behalf of property owners — leasing, rent collection, tenant relations, maintenance coordination, and owner reporting — under ongoing management agreements.</p>
    <h3>Do I have to run the day-to-day myself?</h3>
    <p>No. You are the owner and director. Approved local teams handle daily execution while you maintain ownership control, bank-account oversight, and executive supervision through your owner dashboard.</p>
    <h3>Is this long-term rentals or short-term/vacation rentals?</h3>
    <p>Long-term rentals — annual leases with established tenants, which provide steadier monthly income and lower turnover.</p>
    <h3>How much do I invest?</h3>
    <p>Property Management franchise investment starts at $225,000. The E-2 visa has no fixed minimum, but the investment must be substantial relative to the total cost of the business.</p>
  </section>

  <section>
    <h2>Request the FDD</h2>
    <p>Contact us to request the FDD and schedule an intro call.</p>
    <address>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
    </address>
  </section>
</main>`,
    faq: [
      {
        question: "What does the Property Management franchise actually do?",
        answer:
          "It manages residential long-term rentals on behalf of property owners — handling leasing, rent collection, tenant relations, maintenance coordination, and owner reporting — under ongoing management agreements.",
      },
      {
        question: "Where does the recurring revenue come from?",
        answer:
          "Each property owner signs a management agreement. The franchise earns a recurring monthly management fee for every property under management, plus leasing fees when tenants are placed, so revenue builds as the portfolio grows and clients renew.",
      },
      {
        question: "Do I have to run the day-to-day myself?",
        answer:
          "No. You are the owner and director. Approved local teams handle daily execution while you maintain ownership control, bank-account oversight, and executive supervision through your owner dashboard.",
      },
      {
        question: "How much do I invest?",
        answer:
          "Property Management franchise investment starts at $225,000. The E-2 visa has no fixed minimum, but the investment must be substantial relative to the total cost of the business.",
      },
    ],
  },

  "/telecom": {
    title: `Telecom (VoIP) Franchise for E-2 Visa Investors — Recurring Subscriptions | ${SITE}`,
    description:
      "E-2 visa telecom franchise. Own and direct a recurring-subscription VoIP/telecom business while New Dawn's teams and systems run daily operations. Investment from $225,000. FDD available upon request.",
    html: `
<main>
  <h1>Telecom: A Recurring-Subscription Business You Direct</h1>
  <p>The New Dawn Telecom franchise operates a recurring-service telecom/VoIP business — customers subscribe to ongoing communication services and are billed every month. It is structured so you own and direct the enterprise while centralized systems, sales workflows, and approved teams handle daily execution, exactly as the E-2 visa requires.</p>

  <section>
    <h2>Recurring subscription revenue</h2>
    <p>Telecom revenue is subscription-based: each customer pays a recurring monthly fee for service. That single fact is what makes telecom attractive both as an investment and as the foundation of a credible E-2 business — predictable, compounding revenue across a growing subscriber base.</p>
  </section>

  <section>
    <h2>You direct it; systems and teams run it</h2>
    <p>You are the owner and director — you set strategy, approve key decisions, control the bank accounts, and supervise performance. Centralized billing, provisioning, customer-service workflows, and proprietary technology handle the day-to-day so you keep executive control without managing every ticket.</p>
  </section>

  <section>
    <h2>Why telecom fits the E-2 visa</h2>
    <ul>
      <li>You own and direct a real, active enterprise — central to a strong E-2 petition.</li>
      <li>Recurring monthly subscriptions provide substantial, non-marginal revenue.</li>
      <li>The business employs U.S. workers and produces an auditable operating record for renewals.</li>
      <li>Investment from $225,000, structured to meet the E-2 substantial, at-risk requirement.</li>
    </ul>
  </section>

  <section>
    <h2>Request the FDD</h2>
    <p>Contact us to request the FDD and schedule an intro call.</p>
    <address>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
    </address>
  </section>
</main>`,
  },

  "/insurance": {
    title: `Insurance Franchise for E-2 Visa Investors — Recurring Premiums & Renewals | ${SITE}`,
    description:
      "E-2 visa insurance franchise. Own and direct a recurring-revenue insurance operation built around compliant supervision, client service, and renewals while New Dawn's teams run daily operations. Investment from $225,000. FDD available upon request.",
    html: `
<main>
  <h1>Insurance: Recurring Renewal Revenue You Direct</h1>
  <p>The New Dawn Insurance franchise operates an insurance-sector business built around recurring premiums, policy renewals, and ongoing client service. It is structured so you own and direct the enterprise — with compliant supervision and licensed staff handling regulated activities — while approved teams run daily operations, exactly as the E-2 visa requires.</p>

  <section>
    <h2>Where the recurring revenue comes from</h2>
    <p>Insurance is renewal-driven: policies generate commissions that recur as clients renew year after year. A growing book of business compounds, producing predictable revenue and the kind of ongoing activity that supports a credible E-2 case.</p>
  </section>

  <section>
    <h2>You direct it; our teams run it</h2>
    <p>You are the owner and director. You set direction, approve key decisions, control the bank accounts, and supervise the operation. Licensed producers and service staff handle regulated, day-to-day activity under proper supervision, supported by proprietary technology and owner reporting.</p>
  </section>

  <section>
    <h2>Why insurance fits the E-2 visa</h2>
    <ul>
      <li>You own and direct a genuine operating business — the foundation of a strong E-2 petition.</li>
      <li>Recurring premiums and renewals create substantial, non-marginal revenue.</li>
      <li>The business employs U.S. workers and creates an auditable record for renewals.</li>
      <li>Investment from $225,000, structured to meet the E-2 substantial, at-risk requirement.</li>
    </ul>
  </section>

  <section>
    <h2>Request the FDD</h2>
    <p>Contact us to request the FDD and schedule an intro call.</p>
    <address>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
    </address>
  </section>
</main>`,
  },

  "/e-2-visa-process": {
    title: `The E-2 Visa Process, Explained | Treaty Countries, Investment & Timeline | ${SITE}`,
    description:
      "An in-depth walkthrough of the E-2 Treaty Investor Visa: treaty countries, the substantial and at-risk investment requirement, the own-and-direct requirement, typical timeline, and the role of partner immigration attorneys. Learn how a New Dawn franchise fits.",
    html: `
<main>
  <h1>The E-2 Treaty Investor Visa Process, Step by Step</h1>
  <p>The E-2 Treaty Investor Visa lets nationals of treaty countries live and work in the United States based on a substantial investment in a U.S. business they own and direct. This guide walks through the core requirements — treaty countries, the substantial and at-risk investment, the own-and-direct requirement, marginality, and the typical timeline — and how a New Dawn franchise is structured to fit.</p>

  <section>
    <h2>Treaty countries</h2>
    <p>The E-2 visa is available to nationals of countries that maintain a qualifying treaty of commerce and navigation with the United States — more than 80 countries. Examples include Mexico, Canada, Germany, Japan, South Korea, Spain, Italy, Turkey, Israel, Argentina, Colombia, the United Kingdom, and France. The list changes over time; confirm your country's current eligibility with a licensed immigration attorney.</p>
  </section>

  <section>
    <h2>The substantial and at-risk investment requirement</h2>
    <p>There is no fixed legal minimum, but the investment must be "substantial" relative to the total cost of the business and must be irrevocably committed and genuinely at commercial risk. A New Dawn franchise investment from $225,000 funds a real, operating U.S. business across Property Management, Telecom, or Insurance — capital placed at risk in an active enterprise.</p>
  </section>

  <section>
    <h2>The "own and direct" requirement</h2>
    <p>The investor must own at least 50% of the enterprise and develop and direct it. New Dawn's model is built around this: you hold ownership and bank-account control, approve the key decisions, and supervise performance, while approved local teams handle daily execution. That is a substantive directing role — not passive investment.</p>
  </section>

  <section>
    <h2>More than a marginal enterprise</h2>
    <p>The business must do more than earn a minimal living for you and your family. Recurring-revenue verticals that employ U.S. workers and generate ongoing activity directly address the non-marginality requirement.</p>
  </section>

  <section>
    <h2>Typical timeline</h2>
    <p>A typical path runs: discovery and FDD review, franchise agreement and investment, business plan preparation, filing the E-2 petition, and the consular interview or change of status. Most investors complete the process in roughly 4–8 months, varying by country and consulate. E-2 status is granted in increments (often 2–5 years) and is renewable while the business operates and you continue to direct it.</p>
  </section>

  <section>
    <h2>The role of partner immigration attorneys</h2>
    <p>New Dawn works alongside experienced immigration attorneys who prepare and file your E-2 petition. New Dawn Franchising is a franchisor, not a law firm, and does not provide legal or immigration advice; you retain your own licensed U.S. immigration counsel. Purchasing a franchise never guarantees a visa — eligibility and approval are determined solely by U.S. consular officers and USCIS.</p>
  </section>

  <section>
    <h2>Frequently Asked Questions</h2>
    <h3>Which countries are eligible for the E-2 visa?</h3>
    <p>Nationals of 80+ treaty countries. Examples include Mexico, Canada, Germany, Japan, South Korea, Spain, Italy, Turkey, and Israel. Confirm your country's current eligibility with a licensed immigration attorney.</p>
    <h3>How much do I need to invest?</h3>
    <p>There is no fixed legal minimum; the investment must be substantial and at risk. New Dawn franchise investment starts at $225,000.</p>
    <h3>Does buying a franchise guarantee the E-2 visa?</h3>
    <p>No. A franchise can support a strong petition, but approval is decided solely by U.S. consular officers and USCIS.</p>
    <h3>Can my spouse and children come with me?</h3>
    <p>Yes. E-2 holders can bring a spouse and unmarried children under 21 as dependents, and spouses are eligible for U.S. work authorization.</p>
    <h3>Can the E-2 lead to a green card?</h3>
    <p>The E-2 itself is a nonimmigrant visa, but a growing business can become a pathway to the EB-5 immigrant investor program. This is not guaranteed and depends on your circumstances.</p>
  </section>

  <section>
    <h2>Request the FDD</h2>
    <p>Contact us to request the FDD and schedule an intro call.</p>
    <address>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
    </address>
  </section>
</main>`,
    faq: [
      {
        question: "Which countries are eligible for the E-2 visa?",
        answer:
          "Nationals of 80+ treaty countries. Examples include Mexico, Canada, Germany, Japan, South Korea, Spain, Italy, Turkey, and Israel. Confirm your country's current eligibility with a licensed immigration attorney.",
      },
      {
        question: "How much do I need to invest for the E-2 visa?",
        answer:
          "There is no fixed legal minimum; the investment must be substantial relative to the total cost of the business and genuinely at risk. New Dawn franchise investment starts at $225,000.",
      },
      {
        question: "Does buying a franchise guarantee the E-2 visa?",
        answer:
          "No. A franchise can support a strong petition, but eligibility and approval are determined solely by U.S. consular officers and USCIS. New Dawn does not provide legal or immigration advice or guarantee any outcome.",
      },
      {
        question: "Can my spouse and children come with me on the E-2 visa?",
        answer:
          "Yes. E-2 holders can bring a spouse and unmarried children under 21 as dependents, and spouses are eligible for U.S. work authorization.",
      },
      {
        question: "Can the E-2 visa lead to a green card?",
        answer:
          "The E-2 itself is a nonimmigrant visa, but a growing business can become a pathway to the EB-5 immigrant investor program. This is not guaranteed and depends on your circumstances.",
      },
    ],
  },

  "/request-fdd": {
    title: `Request the FDD | E-2 Visa Franchise Information | ${SITE}`,
    description:
      "Request the New Dawn Franchising Franchise Disclosure Document (FDD) and investor overview. Tell us your treaty country and vertical of interest — Property Management, Telecom, or Insurance — and we'll schedule an intro call.",
    html: `
<main>
  <h1>Request the Franchise Disclosure Document (FDD)</h1>
  <p>Request the New Dawn Franchising FDD and investor overview. Share your name, email, phone, nationality/treaty country, and which vertical interests you — Property Management, Telecom, or Insurance — and our team will follow up to schedule an intro call.</p>
  <section>
    <h2>What happens next</h2>
    <ol>
      <li>We send the FDD and investor overview.</li>
      <li>We confirm your treaty country and timeline.</li>
      <li>We schedule a short intro call and outline next steps.</li>
    </ol>
  </section>
  <section>
    <address>
      <p>${ADDR}</p>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
    </address>
  </section>
</main>`,
  },

  "/legal": {
    title: `Legal & Disclaimers | Franchise Offering & Immigration | ${SITE}`,
    description:
      "New Dawn Franchising legal disclaimers: franchise-offering disclaimer (FTC Franchise Rule and state law) and immigration disclaimer. Information on this site is marketing material, not legal or immigration advice.",
    html: `
<main>
  <h1>Legal &amp; Disclaimers</h1>
  <section>
    <h2>Franchise Offering Disclaimer</h2>
    <p>This website is for general information only and is not an offer to sell, or a solicitation of an offer to buy, a franchise. A franchise is offered and sold only through a Franchise Disclosure Document (FDD) that complies with the FTC Franchise Rule (16 CFR Part 436) and applicable state franchise laws, and only in states where New Dawn Franchising is registered, exempt, or otherwise authorized. Any earnings or results described anywhere on this site are illustrative only and are not guarantees of future performance.</p>
  </section>
  <section>
    <h2>Immigration Disclaimer</h2>
    <p>New Dawn Franchising LLC is a franchisor, not a law firm. Nothing on this site is legal, immigration, tax, or financial advice, and no attorney-client relationship is created by using the site or contacting us. E-2 treaty investor visa information is general and educational; treaty country lists and immigration laws change over time. E-2 eligibility and approval are determined solely by the U.S. Department of State (consular officers) and USCIS, never by us, and a visa is never guaranteed. Retain your own licensed U.S. immigration attorney before making any decision.</p>
  </section>
  <section>
    <h2>Marketing content notice</h2>
    <p>Content on this site is marketing material and should be reviewed by qualified immigration and franchise counsel before being relied upon.</p>
    <address>
      <p>${ADDR}</p>
      <p>Phone: <a href="tel:+13465979994">${PHONE}</a></p>
      <p>Email: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
    </address>
  </section>
</main>`,
  },

  "/why-new-dawn": {
    title: `What Makes New Dawn Different | E-2 Visa Franchise Platform | ${SITE}`,
    description:
      "What makes New Dawn Franchising different: a multi-vertical E-2 platform, owner control and oversight, proprietary technology, and the New Dawn Franchising Group of Companies. Investment from $225,000.",
    html: `
<main>
  <h1>What Makes New Dawn Different</h1>
  <p>New Dawn Franchising was designed from the ground up for the E-2 Treaty Investor Visa, across three recurring-revenue verticals — Property Management, Telecom, and Insurance. You own and direct a real U.S. business while our teams handle daily execution.</p>
  <section>
    <h2>Built around the E-2 investor</h2>
    <ul>
      <li>A multi-vertical platform — choose Property Management, Telecom, or Insurance.</li>
      <li>Owner control and oversight: you keep ownership, bank-account control, and the key decisions.</li>
      <li>Proprietary technology and owner dashboards built for E-2 investor oversight.</li>
      <li>Backed by the New Dawn Franchising Group of Companies — real estate, financing, and legal teams.</li>
      <li>Investment from $225,000, structured to meet E-2 requirements.</li>
    </ul>
  </section>
</main>`,
  },

  "/es/property-management": {
    title: `Franquicia de Administración de Propiedades para la Visa E-2 | ${SITE}`,
    description:
      "Franquicia de administración de propiedades para inversionistas de la visa E-2. Usted dirige el negocio y controla las finanzas; nuestros equipos locales manejan las operaciones diarias. Inversión desde $225,000.",
    html: `
<main lang="es">
  <h1>Administración de Propiedades: Ingresos Recurrentes que Usted Dirige</h1>
  <p>La franquicia de Administración de Propiedades de New Dawn es un negocio real y operativo en EE. UU. que administra alquileres residenciales a largo plazo en nombre de los propietarios. Está estructurada para que usted sea dueño y dirija la empresa —controlando las cuentas bancarias y las decisiones clave— mientras nuestros equipos locales manejan la ejecución diaria, tal como lo exige la visa E-2.</p>
  <section>
    <h2>De dónde provienen los ingresos recurrentes</h2>
    <p>Cada propietario firma un contrato de administración continuo. La franquicia gana una tarifa de administración mensual recurrente por cada propiedad administrada, más tarifas de colocación de inquilinos, por lo que los ingresos se acumulan a medida que crece la cartera.</p>
  </section>
  <section>
    <h2>Por qué encaja con la visa E-2</h2>
    <ul>
      <li>Usted es dueño y dirige un negocio operativo genuino.</li>
      <li>Tarifas de administración mensuales recurrentes.</li>
      <li>El negocio emplea a trabajadores en EE. UU.</li>
      <li>Inversión desde $225,000, estructurada para los requisitos de la E-2.</li>
    </ul>
  </section>
  <p>La información de esta página es material de marketing y no constituye asesoría legal ni migratoria.</p>
</main>`,
  },
};

export function getPageShell(pathname: string): PageShell | null {
  return shells[pathname] ?? null;
}

export const defaultShell: PageShell = {
  title: `${SITE} | E-2 Visa Franchise Platform — Property Management, Telecom & Insurance | El Paso, TX`,
  description:
    "New Dawn Franchising is a multi-vertical franchisor for E-2 visa investors — choose from Property Management, Telecom, or Insurance. You direct the business; our teams run daily operations. FDD available upon request.",
  html: `<main><h1>${SITE}</h1><p>A multi-vertical franchisor for E-2 visa investors — Property Management, Telecom, and Insurance.</p><p>${TAGLINE}</p></main>`,
};
