export const PARTNER_HOME_TITLE =
  "For Immigration Attorneys & Brokers | New Dawn Franchising";
export const PARTNER_HOME_DESCRIPTION =
  "Support your E-2 clients with New Dawn's property management franchise. Separate paths for immigration attorneys and brokers, with broker referral fees up to 12.5% on qualifying sales.";
export const BROKER_REFERRAL_RATE = 0.125;
export const BROKER_SALE_EXAMPLE = 250_000;
export const BROKER_FEE_EXAMPLE = BROKER_REFERRAL_RATE * BROKER_SALE_EXAMPLE;
export const BROKER_FEE_DISPLAY = `$${BROKER_FEE_EXAMPLE.toLocaleString("en-US")}`;
export const BROKER_FEE_TERMS =
  "Illustrative maximum on a qualifying $250,000 franchise sale. Payment requires a completed, funded sale and satisfaction of the written referral agreement. Eligibility, commission basis, rate and payment timing are subject to its terms and applicable law. An introduction alone does not earn a fee.";
export const PARTNER_EMAIL = "franchising@newdawnfranchising.com";
export const ATTORNEY_EMAIL_URL = `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent("Attorney inquiry — E-2 franchise collaboration")}&body=${encodeURIComponent("Hello New Dawn,\n\nI am an immigration attorney interested in discussing your franchise and how we can coordinate for clients.\n\nName:\nFirm:\nPreferred contact:\n\nPlease send information about the business model and attorney collaboration process.")}`;
export const BROKER_EMAIL_URL = `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent("Broker inquiry — referral fees up to 12.5%")}&body=${encodeURIComponent("Hello New Dawn,\n\nI am interested in your broker referral program. Please send the written agreement, eligibility requirements, commission basis and payment terms for the up to 12.5% referral fee.\n\nName:\nCompany:\nPreferred contact:")}`;
