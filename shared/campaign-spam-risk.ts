export interface CampaignSpamRisk {
  checkedAt: string;
  domain: string;
  level: "high" | "review" | "unknown";
  label: string;
  reasons: string[];
  domainChecks: { label: string; status: string; summary: string }[];
  postmaster: { configured: boolean; day: string | null; spamRate: number | null; reputation: string | null; fresh: boolean };
  seed: { id: string; at: string; status: string; accepted: number; inbox: number; spam: number; unresolved: number; fresh: boolean } | null;
  steps: { id: string; order: number; subject: string; level: "review" | "lower"; words: number; findings: string[] }[];
  limitations: string[];
}
