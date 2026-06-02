export type PageShell = {
  title: string;
  description: string;
  html: string;
};

const SITE = "New Dawn Franchising";
const TAGLINE = "The first franchise designed specifically for the E-2 Visa investor.";
const ADDR = "2601 N Zaragoza Rd, El Paso, TX 79938";
const PHONE = "(346) 597-9994";
const EMAIL = "franchising@newdawnfranchising.com";

const shells: Record<string, PageShell> = {
  "/": {
    title: `${SITE} | E-2 Visa Property Management Franchise | El Paso, TX`,
    description:
      "New Dawn Franchising is a property management franchise built for E-2 visa investors. You direct the business — we handle daily operations. FDD available upon request.",
    html: `
<main>
  <h1>You Own It. You Direct It. We Run It.</h1>
  <p>New Dawn Franchising is a property management franchise built specifically for E-2 visa investors. You maintain full control of your bank accounts and all business decisions — while our team handles the daily operational workload so you can focus on leading and growing your enterprise, exactly as the E-2 visa requires.</p>
  <p>${TAGLINE}</p>
  <p>Franchise Disclosure Document (FDD) available upon request. New Dawn Franchising is a registered franchisor.</p>

  <section>
    <h2>Proprietary Technology. Built Exclusively for New Dawn Franchisees.</h2>
    <p>Every New Dawn franchisee benefits from proprietary technology built exclusively for our system — from automated tenant communications and leasing workflows to marketing that works around the clock. This isn't off-the-shelf software. It's infrastructure we designed specifically for the E-2 property management model, so your business runs with the efficiency of a seasoned operation from day one.</p>
    <ul>
      <li>Automated tenant communication &amp; follow-up</li>
      <li>Technology-assisted leasing and property marketing</li>
      <li>Operational dashboards so you always know what's happening in your business</li>
    </ul>
  </section>

  <section>
    <h2>How It Works</h2>
    <ol>
      <li><strong>Invest &amp; Acquire Your Franchise</strong> — Purchase your New Dawn Franchising territory starting at $250,000. This structured investment is designed to meet E-2 visa capital requirements and gives you a real, operating business.</li>
      <li><strong>Apply for Your E-2 Visa</strong> — Our partner immigration attorneys guide you through the E-2 visa application. You own and direct a legitimate U.S. business — that's the foundation of a strong E-2 petition.</li>
      <li><strong>Your Territory Manager Runs Operations</strong> — An approved territory representative manages day-to-day property management. You oversee the business, review reports, and make key decisions.</li>
      <li><strong>Grow Your Portfolio</strong> — Scale your property management portfolio, generate referral income through our affiliated real estate brokerage, and build equity in a real U.S. business.</li>
    </ol>
  </section>

  <section>
    <h2>Why New Dawn Franchising?</h2>
    <ul>
      <li>Franchise packages from $250,000 — structured to meet E-2 visa requirements</li>
      <li>Proprietary technology powers the entire operation</li>
      <li>Territory-approved manager handles day-to-day operations</li>
      <li>In-house E-2 immigration attorneys and real estate professionals</li>
      <li>In-house buy-back program available after approximately 4 years</li>
      <li>Located in El Paso, Texas — a growing rental market</li>
      <li>Part of the New Dawn Franchising Group of Companies™</li>
    </ul>
  </section>

  <section>
    <h2>Investment Overview</h2>
    <p>Franchise packages start at $250,000. This covers your territory license, training, technology platform access, and operational setup. Financing options are available through our affiliated lending partners.</p>
    <p>The E-2 visa requires a substantial and at-risk investment in a U.S. business. Our franchise is structured specifically to meet this requirement.</p>
  </section>

  <section>
    <h2>Frequently Asked Questions</h2>
    <h3>What is the E-2 visa?</h3>
    <p>The E-2 Treaty Investor Visa allows nationals of treaty countries to enter and work in the U.S. based on a substantial investment in a U.S. business. The investor must own and direct the enterprise.</p>
    <h3>How much do I need to invest?</h3>
    <p>Our franchise packages start at $250,000. The E-2 visa does not have a fixed minimum, but the investment must be "substantial" relative to the total cost of the business.</p>
    <h3>Do I have to do property management work myself?</h3>
    <p>The franchise is structured so you are the business director and decision-maker. You maintain full ownership control and oversight — including control over your bank accounts — while an approved territory representative manages day-to-day execution.</p>
    <h3>Can I live anywhere in the USA on the E-2 visa?</h3>
    <p>Yes. E-2 visa holders are authorized to live anywhere in the United States. Your business is based in El Paso, Texas, but you are not required to live there.</p>
    <h3>What is the in-house buy-back program?</h3>
    <p>Our in-house buy-back program gives you a path to recover your investment. After approximately 4 years, we can work with you on an exit. Contact us for full details.</p>
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
  },

  "/about": {
    title: `About ${SITE} | Property Management Franchise for E-2 Visa Investors`,
    description:
      "Learn about New Dawn Franchising LLC — a property management franchise built specifically for E-2 visa investors, backed by the New Dawn Franchising Group of Companies™.",
    html: `
<main>
  <h1>About New Dawn Franchising</h1>
  <p>${TAGLINE}</p>
  <p>New Dawn Franchising LLC is a property management franchise headquartered in El Paso, Texas. We work exclusively with E-2 visa investors who want to own a real, operating U.S. business — one they direct and control — while benefiting from a professionally managed operation.</p>
  <p>Unlike general-purpose franchises retrofitted for visa purposes, New Dawn was designed from the ground up with the E-2 investor in mind. Our legal structure, operating model, and proprietary technology all reflect the requirements of the E-2 treaty investor visa.</p>

  <section>
    <h2>The New Dawn Franchising Group of Companies™</h2>
    <p>New Dawn Franchising is part of the New Dawn Franchising Group of Companies™ — an established organization with large, experienced teams across real estate, financing, and law, each with over a decade of proven success. All supported by proprietary technology built in-house.</p>
    <ul>
      <li><strong>Star Spangled Banner Realty</strong> — An established real estate brokerage with dozens of experienced agents and over a decade of expertise across El Paso and beyond.</li>
      <li><strong>New Dawn Financing</strong> — In-house financing solutions to help franchise buyers structure their investment and meet E-2 capital requirements.</li>
      <li><strong>New Dawn Legal</strong> — Partner immigration attorneys specializing in E-2 visa applications for franchise investors.</li>
      <li><strong>New Dawn Property Management</strong> — The operational arm that provides territory management services to New Dawn franchisees.</li>
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

  "/e2-fit": {
    title: `E-2 Visa Franchise Fit | Why New Dawn is the Right E-2 Business | ${SITE}`,
    description:
      "New Dawn Franchising is built specifically for the E-2 Treaty Investor Visa. Learn why our property management franchise model satisfies E-2 requirements and how you can qualify.",
    html: `
<main>
  <h1>Why New Dawn is the Right E-2 Visa Franchise</h1>
  <p>The E-2 Treaty Investor Visa requires a substantial investment in a real, active U.S. business that you own and direct. New Dawn Franchising is structured specifically to meet every E-2 requirement — from the investment amount to the "at risk" capital test to the requirement that you direct and develop the enterprise.</p>

  <section>
    <h2>E-2 Visa Requirements — and How We Satisfy Each One</h2>
    <ul>
      <li><strong>Substantial investment:</strong> Our franchise packages start at $250,000 — a proven threshold that immigration attorneys consistently use for E-2 petitions.</li>
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
  },

  "/territories": {
    title: `Available Territories | El Paso, Texas | ${SITE}`,
    description:
      "New Dawn Franchising operates in El Paso, Texas with 300+ active property management contracts. Learn about available franchise territories and next steps.",
    html: `
<main>
  <h1>El Paso, Texas</h1>
  <p>Our franchise currently operates in El Paso, Texas with 300+ active management contracts in the network. A focused model for single-family long-term rental management, designed for repeatable operations and clear oversight.</p>

  <section>
    <h2>Why El Paso?</h2>
    <ul>
      <li>Strong and growing rental demand driven by military presence (Fort Bliss), UTEP enrollment, and cross-border population</li>
      <li>Affordable housing stock creates a large pool of manageable single-family rentals</li>
      <li>Landlord-friendly Texas market with clear eviction processes and low regulatory burden</li>
      <li>300+ active management contracts already in the network — proven demand</li>
      <li>Strategic border location attracting investors from Mexico and Latin America</li>
    </ul>
  </section>

  <section>
    <h2>Territory Details</h2>
    <p>Each New Dawn franchise territory covers a defined geographic area within the El Paso metropolitan area. Our model focuses on single-family long-term rental management — typically 12-month leases — which provides stable, recurring revenue and manageable operations.</p>
    <p>Initial operating target: approximately 10 long-term rental management contracts per territory representative, scaling with systems and staffing.</p>
  </section>

  <section>
    <h2>Availability &amp; Next Steps</h2>
    <p>Our current operations are based in El Paso, Texas with 300+ contracts across the network. Contact us with your timeline and we'll share the current overview and available territory details.</p>
    <address>
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
      <li><strong>Franchise Agreement &amp; Investment</strong> — Sign the franchise agreement and place your investment starting at $250,000. This creates your legal franchise entity and activates your territory.</li>
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
};

export function getPageShell(pathname: string): PageShell | null {
  return shells[pathname] ?? null;
}

export const defaultShell: PageShell = {
  title: `${SITE} | E-2 Visa Property Management Franchise | El Paso, TX`,
  description:
    "New Dawn Franchising is a property management franchise built for E-2 visa investors. You direct the business — we handle daily operations. FDD available upon request.",
  html: `<main><h1>${SITE}</h1><p>${TAGLINE}</p></main>`,
};
