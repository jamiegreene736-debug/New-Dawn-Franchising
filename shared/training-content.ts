export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TrainingLesson {
  id: string;
  title: string;
  content: string;
  disclaimer?: string;
  requiresAcknowledgement?: boolean;
  acknowledgementText?: string;
}

export interface TrainingModule {
  key: string; // e.g. "1.1"
  track: number;
  title: string;
  description: string;
  lessons: TrainingLesson[];
  resources: { title: string; description: string; type: string }[];
  quiz: QuizQuestion[];
  passMark: number;
  requiresDisclaimerAck?: string; // disclaimer type key
}

export interface TrainingTrack {
  number: number;
  title: string;
  subtitle: string;
  modules: TrainingModule[];
  showDisclaimer?: boolean;
  disclaimerBanner?: string;
}

export interface ChecklistItem {
  key: string;
  title: string;
  description: string;
  whyItMatters?: string;
  uploadLabel?: string;
  notesLabel?: string;
  icon?: string;
  warning?: string;
  extra?: string;
}

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    key: "entity_registered",
    title: "Your US Business Entity is Registered",
    description:
      "Confirm that your business entity (LLC or Corporation) has been officially registered with the state. This is a foundational E-2 visa requirement — you must own a legally registered US business.",
    whyItMatters:
      "Your E-2 visa is tied to your US business. Without a registered entity you cannot legally operate or demonstrate the ownership required for your visa.",
    uploadLabel: "Certificate of Formation / Articles of Incorporation",
    notesLabel: "Business entity name and state of registration",
    icon: "building",
  },
  {
    key: "bank_account",
    title: "Your Business Bank Account is Open and Active",
    description:
      "Confirm that you have opened a dedicated US business bank account in the name of your business entity and that it is active. Your operating capital should be deposited and you should have full control and signatory authority over this account.",
    whyItMatters:
      "E-2 visa compliance requires you to maintain full financial control of your business. Your bank account must be in the business name with you as the account holder. Never commingle personal and business funds.",
    uploadLabel: "Bank account confirmation letter or statement",
    notesLabel: "Bank name and account type",
    icon: "banknote",
  },
  {
    key: "operating_license",
    title: "Your Operating License from the County is Confirmed",
    description:
      "Confirm that you have obtained the required business operating license from your county or city. In El Paso, Texas this is the local business license required to legally operate a property management company.",
    whyItMatters:
      "Operating a property management business without the required local license is illegal and could jeopardise your franchise agreement and your visa status.",
    uploadLabel: "Operating license document (PDF or image)",
    notesLabel: "License number and expiry date",
    icon: "file-check",
  },
  {
    key: "pm_license",
    title: "Texas Real Estate / Property Management Licensing Confirmed",
    description:
      "Texas has specific licensing requirements for property managers. Confirm that you understand the current requirements and have taken any steps needed to comply. Your NDF territory manager handles day-to-day operations and will hold any required real estate license — confirm with Dylan that this is covered for your territory.",
    whyItMatters:
      "Operating without the correct license in Texas can result in fines and legal action. This item confirms you have verified the requirements with Dylan and your territory manager.",
    uploadLabel: "Relevant license documentation or confirmation",
    notesLabel: "Notes",
    warning:
      "For specific licensing legal requirements, always consult a licensed real estate attorney in Texas.",
    icon: "award",
  },
  {
    key: "liability_insurance",
    title: "Your General Liability Insurance Policy is Active",
    description:
      "Confirm that you have obtained a general liability insurance policy for your property management business and that it is currently active. Your policy should name your business entity as the insured party.",
    whyItMatters:
      "General liability insurance protects you, your homeowner clients, and your business from claims arising from property management operations. It is a requirement of your NDF franchise agreement and is essential for professional credibility with homeowners.",
    uploadLabel: "Certificate of Insurance (COI)",
    notesLabel: "Insurance provider, policy number, expiry date",
    extra: "Recommended minimum: $1,000,000 per occurrence / $2,000,000 aggregate",
    icon: "shield",
  },
  {
    key: "eo_insurance",
    title: "Your Errors & Omissions (E&O) Insurance is Active",
    description:
      "Confirm that you have obtained Errors & Omissions insurance (also called Professional Liability insurance) specific to property management. This covers you against claims from homeowner clients related to mistakes or omissions in your professional services.",
    whyItMatters:
      "Property managers can face claims from homeowners if something goes wrong with how their property is managed. E&O insurance is standard professional protection in the property management industry and is required under your franchise agreement.",
    uploadLabel: "Certificate of Insurance (COI)",
    notesLabel: "Insurance provider, policy number, expiry date",
    icon: "shield-check",
  },
  {
    key: "office_space",
    title: "Your Office or Workspace is Set Up and Confirmed",
    description:
      "Confirm that you have a dedicated workspace for your business operations. This can be a leased office space, a co-working membership, or a confirmed dedicated home office setup.",
    whyItMatters:
      "Having a dedicated workspace demonstrates that you are actively directing a real operating business — which is important for E-2 visa compliance. It also gives your homeowner clients confidence that they are working with a professional operation.",
    uploadLabel: "Office lease agreement or workspace confirmation (optional)",
    notesLabel: "Office address or workspace description",
    icon: "map-pin",
  },
] as const;

export const TRAINING_TRACKS: TrainingTrack[] = [
  {
    number: 1,
    title: "Welcome & Foundations",
    subtitle: "Everything you need to know before you do anything else",
    modules: [
      {
        key: "1.1",
        track: 1,
        title: "Welcome to New Dawn Franchising",
        description: "Learn the NDF mission, your role, and how the franchise system works.",
        lessons: [
          {
            id: "1.1.1",
            title: "The NDF Mission, Vision, and Values",
            content:
              "New Dawn Franchising was built with one purpose: to give E-2 visa investors a legitimate, director-led US business they can own and grow with confidence.\n\nOur mission is to make property management a genuine business opportunity — not a passive investment scheme. You own and direct the business. Your territory manager handles day-to-day operations. You make the decisions, control the finances, and build the enterprise.\n\nOur values: transparency, compliance, long-term thinking, and franchisee success above all else.",
          },
          {
            id: "1.1.2",
            title: "How the Franchise System Works",
            content:
              "As a New Dawn Franchising franchisee, you own the rights to operate a property management business within your assigned territory (El Paso, Texas).\n\nWhat NDF provides: brand, systems, technology, training, support, and a territory manager.\nWhat you provide: business direction, financial oversight, client relationships, and active management of your enterprise.\n\nRevenue comes from property management fees paid by homeowner clients whose properties you manage for long-term rental.",
          },
          {
            id: "1.1.3",
            title: "Your Role as the Business Director",
            content:
              "Your role is to direct and develop the business — not to perform day-to-day property management tasks yourself. Think of yourself as the CEO of your property management company.\n\nYour responsibilities include:\n• Acquiring homeowner clients and building your portfolio\n• Financial oversight and control of all business accounts\n• Strategic decisions about pricing, marketing, and growth\n• Monitoring your territory manager's performance\n• Ensuring compliance with NDF brand standards\n• Active participation in the business (E-2 requirement)",
          },
          {
            id: "1.1.4",
            title: "What the Territory Manager Does vs What You Do",
            content:
              "Territory Manager (operational):\n• Tenant screening and placement\n• Lease management\n• Maintenance coordination\n• Rent collection process management\n• Day-to-day tenant communications\n• Property inspections\n\nYou (business director):\n• All financial decisions and account control\n• Homeowner client acquisition and relationship management\n• Business strategy and growth planning\n• Marketing approvals\n• Monitoring and evaluating the territory manager\n• Compliance and legal oversight",
          },
        ],
        resources: [
          { title: "Franchise Agreement Summary", description: "Key points from your franchise agreement", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "What is the primary role of an NDF franchisee?", options: ["Handling day-to-day property maintenance", "Directing and developing the business as a whole", "Screening tenants for properties", "Managing the territory manager's schedule"], correctIndex: 1 },
          { id: "q2", question: "Who controls the business bank accounts?", options: ["The territory manager", "New Dawn Franchising HQ", "The franchisee", "A shared account between franchisee and NDF"], correctIndex: 2 },
          { id: "q3", question: "What does NDF provide to franchisees?", options: ["A guaranteed income", "Brand, systems, technology, training, support, and a territory manager", "A real estate license", "Tenant placement guarantees"], correctIndex: 1 },
          { id: "q4", question: "NDF franchises focus on:", options: ["Short-term vacation rentals", "Commercial real estate", "Long-term residential property management", "Real estate sales"], correctIndex: 2 },
          { id: "q5", question: "The E-2 visa requires the business owner to:", options: ["Be a passive investor only", "Own, direct, and develop the business", "Hire a US citizen to run the business", "Invest in a publicly traded company"], correctIndex: 1 },
        ],
        passMark: 80,
      },
      {
        key: "1.2",
        track: 1,
        title: "Your First 30 Days",
        description: "The essential steps to set up and launch your franchise.",
        lessons: [
          { id: "1.2.1", title: "The 30-Day Onboarding Checklist", content: "Your first 30 days are about building the legal and operational foundation of your business. By day 30, you should have your business entity registered, your bank account open, your workspace set up, and your first homeowner client conversations started.\n\nThe Launch Checklist in this portal tracks your progress through these foundational requirements." },
          { id: "1.2.2", title: "Setting Up Your US Business Entity", content: "Your LLC or Corporation must be registered in Texas. Key steps:\n1. Choose a business name (check availability with the Texas Secretary of State)\n2. File a Certificate of Formation with the Texas Secretary of State\n3. Obtain an EIN (Employer Identification Number) from the IRS\n4. Register for Texas state taxes if applicable\n\nRecommendation: Work with a US business attorney or CPA who has experience with E-2 visa investors." },
          { id: "1.2.3", title: "Opening Your US Business Bank Account", content: "This is critical for E-2 visa compliance. Your operating capital must be in a business bank account in your business entity's name, with you as the sole account holder and signatory.\n\nNever commingle personal and business funds. Your bank account demonstrates your investment in the business and your financial control — both critical for E-2 compliance.\n\nRecommended: JP Morgan Chase, Wells Fargo, or Bank of America business accounts (available in El Paso)." },
          { id: "1.2.4", title: "Setting Up Your Workspace", content: "You need a dedicated workspace — either a leased office, a co-working space, or a confirmed home office. Document it for your E-2 visa records.\n\nFor El Paso: co-working spaces such as Common Desk or WeWork provide professional addresses and meeting rooms at lower cost than a full office lease." },
          { id: "1.2.5", title: "Meeting Your Territory Manager", content: "Schedule an introduction call with your NDF territory manager in your first week. Understand their background, how they operate, and establish your communication rhythm.\n\nYou should meet or speak with your territory manager at minimum weekly. You are the director — stay informed and involved." },
        ],
        resources: [
          { title: "30-Day Onboarding Checklist", description: "Your complete first-month action plan", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "Where should your operating capital be held?", options: ["In your personal bank account for easy access", "In a business bank account in your entity's name with you as sole signatory", "In NDF's master account", "Split between personal and business accounts"], correctIndex: 1 },
          { id: "q2", question: "How often should you communicate with your territory manager?", options: ["Only when there's a problem", "Once a month", "At minimum weekly", "Annually during reviews"], correctIndex: 2 },
          { id: "q3", question: "Which entity types can NDF franchisees use?", options: ["Only sole proprietorship", "LLC or Corporation", "Partnership only", "Any entity type including informal ones"], correctIndex: 1 },
          { id: "q4", question: "Why is it critical to keep business and personal finances separate?", options: ["It's only a recommendation", "For E-2 visa compliance and financial control demonstration", "To save on taxes", "It's only required if you have employees"], correctIndex: 1 },
          { id: "q5", question: "What does EIN stand for?", options: ["Entity Identification Number", "Employer Identification Number", "E-2 Investor Number", "Enterprise Integration Network"], correctIndex: 1 },
        ],
        passMark: 80,
      },
      {
        key: "1.3",
        track: 1,
        title: "Your Tools & Systems",
        description: "An overview of every platform and system you'll use as an NDF franchisee.",
        lessons: [
          { id: "1.3.1", title: "Overview of Every Tool You Will Use", content: "As an NDF franchisee, you have access to:\n\n• Franchisee Training Academy (this portal) — your learning hub\n• Franchisee Marketing Academy — your lead pipeline and outreach tools\n• Property Management Platform — for managing properties and tenants\n• CRM — for managing homeowner client relationships\n• Operational Dashboards — for monitoring your business KPIs" },
          { id: "1.3.2", title: "How to Log Into the Franchisee Marketing Academy", content: "Your Marketing Academy is accessible from the navigation menu under Portals → Franchisee Marketing Academy.\n\nYou use the same login credentials as this Training Academy. The Marketing Academy unlocks automatically once you've completed the Launch Checklist and Track 1 training.\n\nIn the Marketing Academy you'll find your homeowner lead pipeline, your daily outreach brief for approval, and your analytics dashboard." },
          { id: "1.3.3", title: "How to Use the Property Management Platform", content: "Your NDF territory manager operates the property management platform day-to-day. Your role is oversight and strategic decision-making.\n\nYou have read access to all property records, tenant information, maintenance logs, and financial reports. Schedule a monthly review with your territory manager to go through the dashboard together." },
          { id: "1.3.4", title: "How to Use Your CRM to Manage Homeowner Clients", content: "Your CRM is where you track every homeowner relationship from first contact to signed management agreement and beyond.\n\nKey CRM workflows:\n• Log every homeowner conversation\n• Track leads through your pipeline stages\n• Set follow-up reminders\n• Monitor conversion rates\n• Document your client acquisition activity (useful for E-2 records)" },
          { id: "1.3.5", title: "How to Read Your Operational Dashboards", content: "Your dashboards show you the health of your business at a glance:\n\n• Portfolio size (number of properties under management)\n• Occupancy rate\n• Average rent per property\n• Maintenance request volume\n• Owner satisfaction scores\n• Lead pipeline metrics (homeowner acquisition)\n• Monthly revenue and operating costs" },
        ],
        resources: [
          { title: "Tools Setup Guide", description: "Step-by-step setup instructions for all tools", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "When does the Marketing Academy unlock?", options: ["Immediately after registration", "After completing the Launch Checklist and Track 1 training", "After 30 days", "Only when Dylan manually enables it"], correctIndex: 1 },
          { id: "q2", question: "Your role in the property management platform is:", options: ["Day-to-day operations", "Tenant screening only", "Oversight and strategic decision-making", "No access required"], correctIndex: 2 },
          { id: "q3", question: "What should you use the CRM for?", options: ["Managing tenant relationships", "Tracking homeowner client relationships and pipeline", "Booking flights", "Managing your personal finances"], correctIndex: 1 },
          { id: "q4", question: "How often should you review your operational dashboards with your territory manager?", options: ["Never — the territory manager handles it", "At least monthly", "Only annually", "Only when problems arise"], correctIndex: 1 },
          { id: "q5", question: "What does the Franchisee Marketing Academy help you do?", options: ["Manage your personal social media", "Find and reach out to homeowner leads in your territory", "Apply for your E-2 visa", "Hire staff"], correctIndex: 1 },
        ],
        passMark: 80,
      },
    ],
  },
  {
    number: 2,
    title: "The Property Management Business",
    subtitle: "Understanding the service you are delivering and how it works",
    showDisclaimer: true,
    disclaimerBanner: "Reminder: You are not an immigration attorney or legal professional. Always refer immigration and legal questions to a qualified licensed attorney.",
    modules: [
      {
        key: "2.1",
        track: 2,
        title: "What Is Property Management?",
        description: "The full lifecycle of a managed property and what homeowners expect.",
        lessons: [
          { id: "2.1.1", title: "What a Property Management Company Does", content: "A property management company acts as the professional intermediary between homeowners (landlords) and tenants. You handle everything so the homeowner doesn't have to.\n\nCore services:\n• Marketing vacant properties\n• Tenant screening and placement\n• Lease preparation and signing\n• Rent collection\n• Maintenance coordination\n• Owner reporting and financial accounting\n• Lease renewals and tenant retention" },
          { id: "2.1.2", title: "The Full Lifecycle of a Managed Property", content: "Every property follows this journey:\n\n1. Homeowner Onboarding — sign management agreement, inspect property, set rental price\n2. Marketing — list on Zillow, Apartments.com, Facebook, etc.\n3. Tenant Screening — applications, credit, background, income verification\n4. Lease Signing — execute NDF standard lease\n5. Move-In — document condition, collect deposits\n6. Ongoing Management — rent collection, maintenance, communication\n7. Owner Reporting — monthly financial statements\n8. Renewal — renegotiate lease, retain good tenants\n9. Move-Out — inspection, deposit accounting, re-marketing" },
          { id: "2.1.3", title: "Why Long-Term Rentals", content: "NDF franchisees focus exclusively on long-term rentals (12-month leases and beyond), not short-term or vacation rentals.\n\nWhy:\n• More stable, predictable income for homeowners and franchisees\n• Less regulatory risk (short-term rentals face increasing restrictions)\n• Stronger ongoing management relationship\n• More consistent revenue base for business planning\n• Better alignment with E-2 visa business stability requirements" },
          { id: "2.1.4", title: "The El Paso, Texas Rental Market", content: "El Paso is a growing military and border city with consistent rental demand.\n\nKey characteristics:\n• Large military population (Fort Bliss) creates consistent, reliable tenant demand\n• Border economy creates cross-cultural tenant pool\n• Strong single-family home stock\n• Historically stable rental market with moderate appreciation\n• Affordable compared to major metros — attractive to investors\n• Growing population and employment base" },
        ],
        resources: [
          { title: "NDF Property Management Service Overview", description: "Client-facing overview of our services", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "Why does NDF focus on long-term rentals rather than short-term?", options: ["Short-term rentals are illegal in Texas", "Long-term rentals provide more stable income and align better with E-2 business stability", "Dylan prefers it personally", "Short-term rentals require more technology"], correctIndex: 1 },
          { id: "q2", question: "What is step 1 in the managed property lifecycle?", options: ["Tenant screening", "Homeowner onboarding", "Marketing", "Lease signing"], correctIndex: 1 },
          { id: "q3", question: "What major employer creates consistent rental demand in El Paso?", options: ["Amazon", "Fort Bliss military base", "UT El Paso", "Border Patrol"], correctIndex: 1 },
          { id: "q4", question: "Which of these is NOT a core property management service?", options: ["Rent collection", "Maintenance coordination", "Providing immigration legal advice", "Owner reporting"], correctIndex: 2 },
          { id: "q5", question: "Owner financial reporting should happen:", options: ["Only when requested", "Never — that's the bank's job", "Monthly", "Annually"], correctIndex: 2 },
          { id: "q6", question: "Move-out procedures include:", options: ["Nothing — tenant just leaves", "Inspection, deposit accounting, and re-marketing", "Automatically keeping the deposit", "Calling the previous tenant's references"], correctIndex: 1 },
          { id: "q7", question: "What makes El Paso attractive for property investment?", options: ["High short-term rental demand only", "Stable rental market, affordable prices, military tenant base", "No property taxes", "Only luxury properties available"], correctIndex: 1 },
          { id: "q8", question: "Lease renewal benefits include:", options: ["Higher vacancy costs", "Retaining good tenants and providing stable income", "More paperwork for the owner", "Shorter management agreements"], correctIndex: 1 },
          { id: "q9", question: "Security deposits should be:", options: ["Kept by the franchisee as profit", "Commingled with operating funds", "Held separately and accounted for per Texas law", "Returned immediately at move-in"], correctIndex: 2 },
          { id: "q10", question: "Property marketing platforms include:", options: ["Only Craigslist", "Zillow, Apartments.com, and Facebook among others", "Only yard signs", "TV commercials only"], correctIndex: 1 },
        ],
        passMark: 80,
      },
      {
        key: "2.4",
        track: 2,
        title: "The E-2 Visa & Your Business",
        description: "Understanding what the E-2 visa requires from you as a business director.",
        requiresDisclaimerAck: "e2_visa_module",
        lessons: [
          {
            id: "2.4.1",
            title: "Why This Franchise Was Built for E-2 Visa Investors",
            content: "The E-2 Treaty Investor visa allows nationals of treaty countries to enter and work in the US based on a substantial investment in a bona fide US business.\n\nNDF was designed from the ground up to create a business structure where franchisees can genuinely direct and develop a real operating company — meeting the core requirements of the E-2 visa.\n\nThis is not a passive investment. You are the business owner and director.",
            disclaimer: "Nothing in this training constitutes legal or immigration advice. Always consult a licensed immigration attorney for visa-specific guidance.",
          },
          {
            id: "2.4.2",
            title: "What the E-2 Visa Requires From You",
            content: "For general business education purposes: the E-2 visa generally requires that you own and direct a real, operating business — not a marginal enterprise.\n\nThis means demonstrating:\n• Substantial investment in the business\n• Active ownership and direction\n• A business that generates more than enough income to support you and your family\n• Engagement in more than just passive investment\n\nAlways consult your immigration attorney for the specific requirements that apply to your situation.",
            disclaimer: "This is general business education only, not immigration legal advice.",
          },
          {
            id: "2.4.3",
            title: "How Your Business Activities Demonstrate Active Direction",
            content: "From a business operations standpoint, active direction of your franchise includes:\n\n• Regular financial review and decision-making\n• Client acquisition and relationship management\n• Strategic planning and goal-setting\n• Monitoring your territory manager's performance\n• Marketing and business development decisions\n• Attending industry events and networking\n• Maintaining business records and documentation\n\nKeep records of your business activities. Your immigration attorney will advise you on which records are relevant for your visa purposes.",
            disclaimer: "Always consult your immigration attorney for guidance on documentation and compliance requirements specific to your visa status.",
          },
        ],
        resources: [
          { title: "List of NDF Partner Immigration Attorneys", description: "Recommended immigration attorneys with E-2 experience", type: "pdf" },
          { title: "Questions to Ask Your Immigration Attorney", description: "A starting point for your attorney consultations", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "What type of business does the E-2 visa generally require?", options: ["A passive investment vehicle", "A real operating business that you own and direct", "A publicly traded company", "Any business regardless of your involvement"], correctIndex: 1 },
          { id: "q2", question: "Who should you consult for E-2 visa-specific legal guidance?", options: ["New Dawn Franchising", "Your territory manager", "A licensed immigration attorney", "The US Embassy website only"], correctIndex: 2 },
          { id: "q3", question: "Which of these demonstrates active business direction?", options: ["Delegating all decisions and never reviewing financials", "Regular financial review, client acquisition, and strategic planning", "Only attending the annual franchise conference", "Signing up but not engaging with the business"], correctIndex: 1 },
          { id: "q4", question: "Does the training content in this module constitute immigration legal advice?", options: ["Yes, it's authoritative legal guidance", "No, it's general business education only", "Only the quiz questions are legal advice", "It depends on your country of origin"], correctIndex: 1 },
          { id: "q5", question: "What should you keep records of for your business?", options: ["Nothing — records aren't important", "Your business activities, financial decisions, and client relationships", "Only positive financial results", "Personal diary entries only"], correctIndex: 1 },
          { id: "q6", question: "The E-2 visa is generally designed for:", options: ["Job seekers moving to the US", "Treaty country nationals investing in and directing a US business", "US citizens returning from abroad", "Tourists who want to work part-time"], correctIndex: 1 },
          { id: "q7", question: "A 'marginal enterprise' for E-2 purposes typically means:", options: ["A small but growing business", "A business that only supports the investor with no broader economic contribution", "Any franchise business", "A business with fewer than 10 employees"], correctIndex: 1 },
          { id: "q8", question: "When should you involve your immigration attorney?", options: ["Never — it's too expensive", "Only at the initial application stage", "Regularly, including for renewals and status questions", "Only if you get a rejection"], correctIndex: 2 },
          { id: "q9", question: "What does NDF provide that supports your E-2 business?", options: ["Immigration legal advice", "A real operating property management business with genuine revenue", "A guaranteed visa approval", "A guaranteed return on investment"], correctIndex: 1 },
          { id: "q10", question: "Your franchisee role in the business is:", options: ["Silent investor", "Passive shareholder only", "Active director who owns, oversees, and develops the business", "An employee of NDF"], correctIndex: 2 },
        ],
        passMark: 80,
      },
    ],
  },
  {
    number: 3,
    title: "Finding & Winning Homeowner Clients",
    subtitle: "How to fill your pipeline with homeowners who need long-term rental management",
    modules: [
      {
        key: "3.1",
        track: 3,
        title: "Where to Find Homeowner Clients",
        description: "The best sources of homeowner leads in your El Paso territory.",
        lessons: [
          { id: "3.1.1", title: "The Best Lead Sources in Your Territory", content: "Top sources for homeowner leads in El Paso:\n\n• Real estate agents and brokers (best referral source)\n• El Paso Landlord Association members\n• Local Facebook groups for landlords and real estate investors\n• Nextdoor — homeowners asking about renting their property\n• Google Ads targeting 'property management El Paso'\n• Direct mail to multi-property owners (public records)\n• For-rent-by-owner listings on Zillow and Craigslist\n• Referrals from mortgage brokers and real estate attorneys" },
          { id: "3.1.2", title: "The Warmest Leads: Self-Managing Homeowners", content: "The most valuable leads are homeowners who are already self-managing and frustrated with it. Signs of a self-managing homeowner:\n\n• For-rent-by-owner listing (they're doing it themselves)\n• Complaints in landlord forums about tenant problems\n• Multiple vacancy posts\n• Questions about eviction processes\n• Posts about maintenance headaches\n\nThese people are already in pain — they just need the right solution presented at the right time." },
          { id: "3.1.3", title: "How to Build a Referral Pipeline from Real Estate Agents", content: "Real estate agents are your single best referral source. When agents sell investment properties to buyers, those buyers often need property management.\n\nStrategy:\n1. Identify the top 20 investor-focused agents in El Paso\n2. Introduce yourself and your service\n3. Make it easy for them to refer: give them your branded one-pager and Calendly link\n4. Follow up monthly — relationships take time\n5. Reciprocate: refer sellers who aren't ready to manage their property to trusted agents" },
        ],
        resources: [
          { title: "Lead Source Directory for El Paso Territory", description: "Contact details and resources for all major lead sources", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "What is typically your warmest lead source?", options: ["Cold calling random homeowners", "Self-managing homeowners who are frustrated with the process", "New tenants looking for properties", "Other property management companies"], correctIndex: 1 },
          { id: "q2", question: "How do you identify for-rent-by-owner listings?", options: ["Only through word of mouth", "Zillow, Craigslist, and Facebook Marketplace FSBO sections", "Only through a paid database", "Through the city's housing records exclusively"], correctIndex: 1 },
          { id: "q3", question: "How many top investor-focused agents should you initially target?", options: ["100+", "Just 1 or 2", "The top 20 in El Paso", "None — agents aren't useful"], correctIndex: 2 },
          { id: "q4", question: "When building referral relationships with agents, expect:", options: ["Instant results in week 1", "Relationships that develop over time with consistent follow-up", "Never needing to follow up after the first meeting", "Only digital outreach to work"], correctIndex: 1 },
          { id: "q5", question: "What should you give real estate agents to make referrals easy?", options: ["Your personal phone number only", "A branded one-pager and your Calendly booking link", "Nothing — just your email", "A complex intake form"], correctIndex: 1 },
          { id: "q6", question: "Which homeowner profile tends to have the most urgency?", options: ["Someone who has never considered renting their property", "A homeowner relocating who needs someone to manage their property while they're away", "An owner who just renewed with another property manager", "Someone only considering selling"], correctIndex: 1 },
          { id: "q7", question: "Nextdoor is useful for finding:", options: ["Commercial tenants", "Homeowners publicly asking about renting their property", "Real estate attorneys", "Only apartment renters"], correctIndex: 1 },
          { id: "q8", question: "Mortgage data for recently purchased investment properties helps you find:", options: ["Existing landlords with full portfolios", "New landlords who just bought an investment property and may need management", "Tenants looking for rentals", "Real estate developers"], correctIndex: 1 },
          { id: "q9", question: "What is a key benefit of direct mail to multi-property owners?", options: ["It's free", "It reaches landlords before they've reached out to competitors", "It generates instant responses", "It replaces all digital outreach"], correctIndex: 1 },
          { id: "q10", question: "What should you do with referral partners who send you clients?", options: ["Nothing — they referred for free", "Track them and thank them, consider a formal referral arrangement", "Ignore them after the first referral", "Only thank them with a social media post"], correctIndex: 1 },
        ],
        passMark: 80,
      },
      {
        key: "3.2",
        track: 3,
        title: "The Homeowner Consultation Call",
        description: "How to structure and close the perfect homeowner discovery call.",
        lessons: [
          { id: "3.2.1", title: "Structure of the Perfect Discovery Call", content: "Every homeowner consultation should follow this structure:\n\n1. UNDERSTAND (10 min) — Ask about their property, their situation, and what they're looking for in a property manager. Listen more than you talk.\n2. EXPLAIN (5 min) — Describe your service clearly. How you work, what's included, your fees.\n3. ADDRESS (10 min) — Handle their concerns one by one. Don't rush past objections.\n4. PRESENT (5 min) — Walk them through your management agreement.\n5. CLOSE (5 min) — Ask for the business." },
          { id: "3.2.2", title: "Common Homeowner Objections & How to Handle Them", content: "The three most common objections and how to respond:\n\n'Your fee is too high'\n→ 'I understand. Our fee is [X]% and covers [full list of services]. When you add up your time, the vacancies, and the maintenance calls you're currently handling, the math often works in your favor. Let me show you what that typically looks like for a property like yours.'\n\n'I've managed it myself fine'\n→ 'That's great — and I hear that from many of our best clients right before they switch. What typically changes is when they want their time back, or when a difficult tenant situation comes up. We're here when that time comes.'\n\n'I had a bad experience with a property manager before'\n→ 'I'm sorry to hear that — and I want to understand what went wrong. [Listen.] Here's specifically how we handle that situation differently...'" },
          { id: "3.2.3", title: "How to Close Without Being Pushy", content: "The close should feel natural — you've just solved a real problem for someone who has it.\n\nSimple close: 'Based on everything you've told me, it sounds like we'd be a great fit. Are you ready to get started?'\n\nIf they hesitate: 'What's holding you back?' — then address that specific concern.\n\nAlways have a next step: even if they're not ready to sign today, agree on a specific follow-up date." },
        ],
        resources: [
          { title: "Homeowner Discovery Call Script", description: "Word-for-word guidance for your consultation calls", type: "pdf" },
          { title: "Objection Handling Cheat Sheet", description: "Quick reference for the most common objections", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "In the perfect discovery call, you should spend the most time:", options: ["Talking about your services", "Understanding the homeowner's situation by listening", "Reading the management agreement aloud", "Discussing your credentials"], correctIndex: 1 },
          { id: "q2", question: "When a homeowner says 'your fee is too high', the best response is:", options: ["Immediately offer a discount", "Explain the full value of your service and show the cost comparison", "Agree and offer your services for free", "End the call politely"], correctIndex: 1 },
          { id: "q3", question: "When closing, if a homeowner hesitates, you should:", options: ["Walk away immediately", "Pressure them until they agree", "Ask 'What's holding you back?' and address that specific concern", "Call them every day until they sign"], correctIndex: 2 },
          { id: "q4", question: "The correct call structure ends with:", options: ["Sending a follow-up email", "Asking for the business", "Scheduling another call to go over the same material", "Sending the agreement without discussion"], correctIndex: 1 },
          { id: "q5", question: "If a homeowner has had a bad experience with a previous property manager, you should:", options: ["Tell them all property managers are bad", "Listen to understand what went wrong, then explain specifically how you handle it differently", "Promise it will never happen again without knowing what went wrong", "Change the subject"], correctIndex: 1 },
        ],
        passMark: 80,
      },
    ],
  },
  {
    number: 4,
    title: "Managing Properties & Tenants",
    subtitle: "How to deliver an excellent service that keeps homeowners as long-term clients",
    modules: [
      {
        key: "4.1",
        track: 4,
        title: "Marketing a Property for Long-Term Rent",
        description: "How to list, price, and fill vacancies fast.",
        lessons: [
          { id: "4.1.1", title: "How to List a Property Effectively", content: "Professional photos are non-negotiable. Poorly photographed properties take significantly longer to rent and often rent for less.\n\nYour listing must include:\n• Professional photography (hire a photographer — worth every penny)\n• Compelling, accurate property description\n• Correct pricing (research comparable active listings)\n• All amenities listed clearly\n• Virtual tour if possible\n• Clear contact/application instructions" },
          { id: "4.1.2", title: "Which Platforms to List On", content: "Primary platforms for El Paso:\n• Zillow (highest volume traffic)\n• Apartments.com (strong for longer-term seekers)\n• Facebook Marketplace (active for El Paso rentals)\n• Craigslist (still relevant in many markets)\n• Realtor.com\n• Trulia (Zillow-owned, auto-syndicates)\n\nUse the NDF technology platform to distribute to all platforms simultaneously from one listing." },
          { id: "4.1.3", title: "How to Price a Rental", content: "Pricing too high = extended vacancy (costs more than lowering the rent)\nPricing too low = less income for your homeowner client\n\nPricing process:\n1. Search active comparable listings in the same zip code\n2. Match: bedrooms, bathrooms, garage, yard, condition\n3. Note the range of asking rents\n4. Price at or slightly below market to attract quality applicants quickly\n5. Review pricing every 2 weeks if not rented — adjust as needed" },
        ],
        resources: [
          { title: "Property Marketing Checklist", description: "Everything you need to list a property correctly", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "Why are professional photos important for rental listings?", options: ["They're required by law", "Poorly photographed properties take longer to rent and often rent for less", "Tenants never look at photos", "They're only needed for luxury properties"], correctIndex: 1 },
          { id: "q2", question: "If a property isn't renting after 2 weeks, you should:", options: ["Do nothing and wait", "Review the pricing and adjust if needed", "Remove it from all listings", "Only blame market conditions"], correctIndex: 1 },
          { id: "q3", question: "What does the NDF technology platform help you do?", options: ["Only communicate with tenants", "Distribute listings to multiple platforms simultaneously", "Apply for permits", "Process payroll"], correctIndex: 1 },
          { id: "q4", question: "The best pricing strategy is:", options: ["Always price as high as possible", "At or slightly below market to attract quality applicants quickly", "Price based only on what you personally think the property is worth", "Price 20% above market to leave negotiation room"], correctIndex: 1 },
          { id: "q5", question: "Which platform typically has the highest traffic volume?", options: ["Craigslist only", "Zillow", "Newspaper classifieds", "A single custom website"], correctIndex: 1 },
        ],
        passMark: 80,
      },
    ],
  },
  {
    number: 5,
    title: "Marketing Your Property Management Business",
    subtitle: "How to consistently generate new homeowner clients",
    modules: [
      {
        key: "5.1",
        track: 5,
        title: "Your Personal Brand as an NDF Franchisee",
        description: "How to position yourself as the trusted property management expert in El Paso.",
        lessons: [
          { id: "5.1.1", title: "Why Your Personal Brand Matters", content: "Property management is a trust business. Homeowners are handing you the keys to their most valuable asset. They need to trust you before they sign anything.\n\nYour personal brand as the local property management expert in El Paso is your most valuable marketing asset. It's built through consistency, visibility, and genuine value." },
          { id: "5.1.2", title: "LinkedIn and Facebook Profile Optimisation", content: "LinkedIn:\n• Headline: 'Property Management Expert | New Dawn Franchising | El Paso, TX'\n• Summary: Tell your story — why you chose this business, what you bring to homeowners\n• Feature your NDF franchise\n• Post monthly: market updates, property tips, success stories\n\nFacebook:\n• Create a business page for your franchise\n• Join El Paso landlord and real estate investor groups\n• Post useful content (not just promotions) 2-3x per week" },
        ],
        resources: [
          { title: "LinkedIn Profile Template for NDF Franchisees", description: "A proven profile structure", type: "pdf" },
          { title: "Elevator Pitch Script", description: "How to introduce yourself at networking events", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "Why does personal brand matter in property management?", options: ["It's a requirement of the franchise agreement", "Property management is a trust business — homeowners are handing you their most valuable asset", "Only to impress other franchisees", "It doesn't matter at all"], correctIndex: 1 },
          { id: "q2", question: "How often should you post on LinkedIn?", options: ["Every hour", "Monthly", "Never", "Only when something goes wrong"], correctIndex: 1 },
          { id: "q3", question: "What should your LinkedIn headline say?", options: ["'Looking for work in El Paso'", "'Property Management Expert | New Dawn Franchising | El Paso, TX'", "'Investor | Visa holder | Real estate'", "Leave it blank"], correctIndex: 1 },
          { id: "q4", question: "On Facebook, you should post:", options: ["Only promotions and sales offers", "Useful content (tips, market updates) 2-3x per week plus occasional promotions", "Nothing — Facebook isn't relevant", "Personal content only"], correctIndex: 1 },
          { id: "q5", question: "When networking in person, your elevator pitch should:", options: ["List every service you offer in detail", "Tell your story briefly and explain what problems you solve for homeowners", "Focus mainly on your credentials and certifications", "Avoid mentioning property management"], correctIndex: 1 },
        ],
        passMark: 80,
      },
    ],
  },
  {
    number: 6,
    title: "Compliance, Legal & Professional Standards",
    subtitle: "Protecting yourself, your homeowner clients, and New Dawn Franchising",
    showDisclaimer: true,
    disclaimerBanner: "Reminder: You are not an immigration attorney or legal professional. Always refer immigration and legal questions to a qualified licensed attorney.",
    modules: [
      {
        key: "6.1",
        track: 6,
        title: "What You Can and Cannot Say",
        description: "The legal boundaries of your role and how to stay compliant.",
        requiresDisclaimerAck: "compliance_acknowledgement",
        lessons: [
          {
            id: "6.1.1",
            title: "The Legal Boundaries of Your Role",
            content: "As an NDF franchisee, you are a property management business owner — not an attorney, not an immigration advisor, and not a legal professional of any kind.\n\nYou MUST NOT:\n• Provide immigration legal advice (E-2 visa guidance, application help, interview coaching)\n• Provide legal advice on eviction processes\n• Interpret lease clauses as legal guidance\n• Tell tenants or owners what their 'legal rights' are\n• Act as a mediator in legal disputes\n\nYou CAN:\n• Explain your business services clearly\n• Describe general industry practices\n• Refer clients to appropriate professionals",
          },
          {
            id: "6.1.2",
            title: "Phrases to Use When Redirecting to Attorneys",
            content: "When anyone asks a legal or immigration question, these are the exact phrases to use:\n\n'That's an important question — I'd strongly encourage you to speak with a licensed [immigration / real estate] attorney who can give you advice specific to your situation.'\n\n'That's outside my area of expertise, and I'd be doing you a disservice if I guessed. Please consult an attorney.'\n\n'I can share how we handle this from a business operations standpoint, but for the legal specifics you'll need an attorney.'\n\nDo not guess. Do not improvise legal answers. Always redirect.",
          },
        ],
        resources: [
          { title: "Brand Standards Guide", description: "What you can and cannot say in all communications", type: "pdf" },
          { title: "Approved Marketing Materials Library", description: "Pre-approved templates and assets", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "If a prospect asks you about their E-2 visa application, you should:", options: ["Answer based on your own E-2 experience", "Redirect them to a licensed immigration attorney", "Give general information from the internet", "Tell them NDF guarantees E-2 approval"], correctIndex: 1 },
          { id: "q2", question: "Can you explain a lease clause as 'what it means legally'?", options: ["Yes, if you've read it carefully", "No — refer them to a real estate attorney", "Yes, as long as you add a disclaimer", "Only if they really need help"], correctIndex: 1 },
          { id: "q3", question: "What can you do when a homeowner asks about the eviction process?", options: ["Walk them through the full legal process", "Explain the general steps from a business operations standpoint and refer them to an attorney for the legal specifics", "Tell them evictions never happen with your company", "Refuse to discuss it at all"], correctIndex: 1 },
          { id: "q4", question: "Providing immigration legal advice as a franchisee could result in:", options: ["Nothing, it's a minor issue", "Termination of your franchise agreement among other consequences", "A small fine only", "No consequences if you add a disclaimer"], correctIndex: 1 },
          { id: "q5", question: "Which of these is acceptable to say to a prospect?", options: ["'This franchise will definitely get you your E-2 visa'", "'I can help you prepare for your consulate interview'", "'That's outside my expertise — please consult a licensed immigration attorney'", "'I know immigration law well enough to advise you'"], correctIndex: 2 },
        ],
        passMark: 80,
      },
      {
        key: "6.2",
        track: 6,
        title: "Fair Housing & Landlord-Tenant Law Basics",
        description: "The key rules every property manager must know.",
        lessons: [
          {
            id: "6.2.1",
            title: "Fair Housing Act — Key Rules",
            content: "The Fair Housing Act prohibits discrimination in housing based on:\n• Race, color, national origin\n• Religion\n• Sex\n• Familial status (families with children)\n• Disability\n\nAs a property manager, you must apply the same screening criteria to every applicant. Your criteria must be:\n• Objective (credit score, income requirements, rental history)\n• Applied consistently to all applicants\n• Documented\n\n⚠️ Always consult a licensed attorney for specific fair housing legal situations.",
            disclaimer: "This is general education only. Always consult a licensed attorney for specific legal situations.",
          },
          {
            id: "6.2.2",
            title: "Texas Landlord-Tenant Law Basics",
            content: "Key Texas requirements (general education only — always consult an attorney):\n\n• Security deposits: no Texas state limit but must be returned within 30 days of move-out with itemized deductions if any\n• Notice to vacate: varies by lease terms and situation\n• Habitability: landlords must maintain properties in habitable condition\n• Entry notice: landlords typically provide reasonable notice before entry\n\n⚠️ Texas landlord-tenant law can be complex. Always involve a licensed Texas real estate attorney for specific situations.",
            disclaimer: "This is general business education only, not legal advice.",
          },
        ],
        resources: [
          { title: "Fair Housing Act Reference Guide", description: "A quick reference for Fair Housing compliance", type: "pdf" },
          { title: "Texas Landlord-Tenant Law Overview", description: "General overview for business education purposes", type: "pdf" },
        ],
        quiz: [
          { id: "q1", question: "The Fair Housing Act protects against discrimination based on:", options: ["Income level only", "Race, color, national origin, religion, sex, familial status, and disability among others", "Only race and gender", "Employment status"], correctIndex: 1 },
          { id: "q2", question: "Your tenant screening criteria must be:", options: ["Different for each applicant based on your gut feeling", "Objective, consistently applied, and documented", "Based on nationality preferences", "Flexible depending on the homeowner's wishes"], correctIndex: 1 },
          { id: "q3", question: "In Texas, security deposits must generally be returned within:", options: ["1 week", "30 days of move-out with itemized deductions", "6 months", "There is no requirement"], correctIndex: 1 },
          { id: "q4", question: "If you're unsure whether a screening decision complies with Fair Housing law:", options: ["Make your best guess", "Consult a licensed real estate attorney", "Ask the tenant's previous landlord", "Apply your own interpretation"], correctIndex: 1 },
          { id: "q5", question: "Familial status protection means:", options: ["Married couples get priority", "You cannot discriminate against families with children", "Single people have fewer rights", "Only applies to adoption situations"], correctIndex: 1 },
        ],
        passMark: 80,
      },
    ],
  },
];
