// Proxycurl shut down July 2025.
// LinkedIn employee discovery is now handled by Apollo's domain search (apolloSearchByDomain).
// This file is kept as a stub so any lingering imports don't break compilation.

export function getProxycurlStatus() {
  return { configured: false, provider: "Apollo (LinkedIn via domain)" };
}

export interface LinkedInEmployee {
  fullName: string;
  linkedinUrl: string;
  jobTitle: string | null;
  seniority: string | null;
}

export interface LinkedInProfile {
  fullName: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  summary: string | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
}

/** @deprecated — use apolloSearchByDomain from apollo-service.ts instead */
export async function getCompanyEmployees(): Promise<LinkedInEmployee[]> {
  return [];
}

/** @deprecated — use apolloMatchPerson from apollo-service.ts instead */
export async function enrichLinkedInProfile(): Promise<LinkedInProfile | null> {
  return null;
}
