import { z } from "zod";

const BASE = "https://api.glockapps.com/gateway/spamtest-v2/api";
export class PlacementError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
const truth = z.union([z.boolean(), z.enum(["true", "false"])]).transform(v => v === true || v === "true");
export const createdTestSchema = z.object({
  status: z.literal("success"), testId: z.string().min(1).max(200),
  // GlockApps adds its authentication diagnostic address to the selected seeds.
  emails: z.array(z.string().email().max(254)).min(1).max(13),
  insertHeader: z.string().regex(/^X-API-Campaign-id: [^\r\n]{1,200}$/i),
});
const reportSchema = z.object({ status: z.literal("success"), result: z.object({
  testId: z.string(), finished: truth, failedReport: truth.optional(),
  authenticationResult: z.object({ email: z.string(), finished: truth,
    spfAuth: z.string().optional(), dkimAuth: z.string().optional(), dmarcAuth: z.string().optional(),
  }).optional(),
  inboxes: z.array(z.object({ email: z.string().email(), iType: z.string(), finished: truth, visible: truth.optional(),
    spf: z.string().optional(), dkim: z.string().optional(), dmarc: z.string().optional(),
  })).max(200).default([]),
}) });
export function glockConfig() {
  const apiKey = process.env.GLOCKAPPS_API_KEY?.trim();
  const projectId = process.env.GLOCKAPPS_PROJECT_ID?.trim();
  const seedIds = (process.env.GLOCKAPPS_SEED_ACCOUNT_IDS || "").split(",").map(v => v.trim()).filter(Boolean);
  const configured = !!apiKey && /^\d+$/.test(projectId || "") && seedIds.length > 0 && seedIds.length <= 12 && seedIds.every(v => /^\d+$/.test(v)) && new Set(seedIds).size === seedIds.length;
  return { apiKey, projectId, seedIds, configured };
}
async function request(path: string, method = "GET", body?: unknown): Promise<unknown> {
  const { apiKey, configured } = glockConfig();
  if (!configured) throw new PlacementError("Connect GlockApps and select up to 12 test mailboxes first.", 409);
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { method, headers: { "x-api-key": apiKey!, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000), redirect: "error" });
  } catch { throw new PlacementError("GlockApps did not respond. The outcome may be unknown; check the provider account before creating another paid test."); }
  if (!response.ok) throw new PlacementError(response.status === 401 || response.status === 403 ? "GlockApps rejected the connection. Check account access and the API key." : response.status === 429 ? "GlockApps is rate limiting requests. Wait before refreshing." : response.status === 402 ? "GlockApps needs available test credits." : `GlockApps could not complete the request (HTTP ${response.status}).`);
  try { return await response.json(); } catch { throw new PlacementError("GlockApps returned an unreadable report. Placement is unknown."); }
}
export async function createGlockTest(note: string) {
  const config = glockConfig();
  // A paid POST is never retried: a timed-out request may already have used a credit.
  const raw = await request(`/projects/${config.projectId}/manualTest`, "POST", { testType: "ManualTest", seedAccountIds: config.seedIds, note, linkChecker: true });
  const parsed = createdTestSchema.safeParse(raw);
  if (!parsed.success || parsed.data.emails.length > config.seedIds.length + 1 || parsed.data.insertHeader.slice(parsed.data.insertHeader.indexOf(":") + 1).trim() !== parsed.data.testId || new Set(parsed.data.emails.map(e => e.toLowerCase())).size !== parsed.data.emails.length) throw new PlacementError("GlockApps returned an invalid or oversized seed panel. No emails were sent; check the provider account before retrying.");
  return parsed.data;
}
export async function getGlockReport(projectId: string, testId: string) {
  const parsed = reportSchema.safeParse(await request(`/projects/${encodeURIComponent(projectId)}/tests?testId=${encodeURIComponent(testId)}`));
  if (!parsed.success || parsed.data.result.testId !== testId) throw new PlacementError("GlockApps returned an invalid or mismatched report. Placement is unknown.");
  return parsed.data.result;
}
export function normalizePlacement(value: string): "inbox" | "tabs" | "spam" | "missing" | "unknown" {
  switch (value.toLowerCase().replace(/[ _-]/g, "")) {
    case "inbox": return "inbox";
    case "other": case "tabs": case "promotions": case "social": case "updates": return "tabs";
    case "spam": case "junk": return "spam";
    case "x": case "notdelivered": case "missing": return "missing";
    default: return "unknown";
  }
}
