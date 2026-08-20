// Pre-enrollment email verification (Hunter.io, STRICT / valid-only policy).
//
// Goal: when a list is enrolled into a campaign, confirm each address is
// deliverable before it ever receives mail. Undeliverable addresses are
// excluded and suppressed (DNC); risky/unknown ones are excluded under the
// strict policy but NOT suppressed (the user can override per-contact).
//
// IMPORTANT — fail-open on infra failure: a null Hunter response (no API key,
// rate-limited, network error) must NOT be treated as "bad". We enroll those
// and leave them unverified, so a transient Hunter outage or exhausted credit
// quota can never silently drop a whole good list.
//
// What verification CAN and CANNOT prevent:
//   - CAN catch: dead mailboxes (550 5.1.1 user-unknown), disposable domains,
//     syntax/MX failures. This is what cuts hard bounces.
//   - CANNOT catch: policy/reputation rejections (550 5.7.0) of a real mailbox
//     that refuses our cold burst. Those look "deliverable" to any verifier —
//     they are a warmup/reputation problem, handled by the deliverability stack.

import { hunterVerifyEmail, getHunterStatus, type HunterVerifyResult } from "./hunter-service";

// The value persisted to <table>.email_status. NULL (absent here) = unverified.
export type StoredEmailStatus = "valid" | "risky" | "invalid" | "unknown";

export interface EnrollVerifyResult {
  email: string;
  /** Status to persist on the record; null = could not verify (leave unverified). */
  status: StoredEmailStatus | null;
  /** Strict deliverability: true only when Hunter says "deliverable". */
  deliverable: boolean;
  /** Strict-mode enroll decision: deliverable, OR couldn't-verify (fail-open). */
  shouldEnroll: boolean;
  /** Hard-undeliverable / disposable → globally suppress so no later campaign re-imports it. */
  shouldDnc: boolean;
  /** Human-readable reason (also used as the DNC reason). */
  reason: string;
  /** Hunter confidence 0-100. */
  score: number;
}

// Classify a Hunter email-verifier response under the STRICT (valid-only) policy.
export function classifyHunterResult(r: HunterVerifyResult | null): EnrollVerifyResult {
  if (!r) {
    // Could not verify — fail open. Never exclude, never suppress.
    return {
      email: "",
      status: null,
      deliverable: false,
      shouldEnroll: true,
      shouldDnc: false,
      reason: getHunterStatus().configured ? "Could not verify (Hunter unavailable)" : "Hunter not configured",
      score: 0,
    };
  }

  const result = (r.result || "unknown").toLowerCase();

  // Disposable mailboxes always bounce / burn reputation — treat as invalid.
  if (r.disposable || result === "undeliverable") {
    return {
      email: r.email,
      status: "invalid",
      deliverable: false,
      shouldEnroll: false,
      shouldDnc: true,
      reason: r.disposable ? "Disposable address" : `Undeliverable (${r.status || "invalid"})`,
      score: r.score,
    };
  }

  if (result === "deliverable") {
    return { email: r.email, status: "valid", deliverable: true, shouldEnroll: true, shouldDnc: false, reason: "Deliverable", score: r.score };
  }

  if (result === "risky") {
    // accept_all (catch-all) / low score. Strict mode excludes these, but does
    // NOT suppress them — many catch-all domains do deliver, so the address can
    // be enrolled later via an override without being globally DNC'd.
    return {
      email: r.email,
      status: "risky",
      deliverable: false,
      shouldEnroll: false,
      shouldDnc: false,
      reason: r.status === "accept_all" ? "Catch-all domain (risky)" : "Risky address",
      score: r.score,
    };
  }

  // unknown — Hunter reached the server but couldn't get a definitive answer.
  return { email: r.email, status: "unknown", deliverable: false, shouldEnroll: false, shouldDnc: false, reason: "Could not confirm deliverability", score: r.score };
}

// Verify one address for enrollment. (One Hunter credit per fresh call — the
// routes cache the verdict on the record so re-enroll doesn't re-spend.)
// Cheap structural sanity check run BEFORE spending a Hunter verification: a
// malformed string ("john at firm dot com", a bare domain, whitespace) makes
// Hunter return HTTP 400 — which the fail-open policy then treats as
// "couldn't verify" and ENROLLS, guaranteeing a bounce.
const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function verifyEmailForEnrollment(email: string): Promise<EnrollVerifyResult> {
  if (!EMAIL_FORMAT_RE.test(email.trim())) {
    return {
      email,
      status: "invalid",
      deliverable: false,
      shouldEnroll: false,
      shouldDnc: false, // record-level junk, not a suppressible address
      reason: "malformed address (failed format check; not sent to verifier)",
      score: 0,
    };
  }
  const r = await hunterVerifyEmail(email);
  const out = classifyHunterResult(r);
  out.email = email;
  return out;
}

// A cached verdict is reusable for 30 days before we re-verify.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function isFreshVerification(verifiedAt: Date | string | null | undefined): boolean {
  if (!verifiedAt) return false;
  const t = new Date(verifiedAt).getTime();
  return Number.isFinite(t) && Date.now() - t < CACHE_TTL_MS;
}

// Strict-mode enroll decision from an already-stored status (cache hit path).
export function decisionFromStoredStatus(status: string | null | undefined): {
  shouldEnroll: boolean;
  bucket: StoredEmailStatus | "unverified";
} {
  switch (status) {
    case "valid":
      return { shouldEnroll: true, bucket: "valid" };
    case "invalid":
      return { shouldEnroll: false, bucket: "invalid" };
    case "risky":
      return { shouldEnroll: false, bucket: "risky" };
    case "unknown":
      return { shouldEnroll: false, bucket: "unknown" };
    default:
      // null / unverified → fail-open.
      return { shouldEnroll: true, bucket: "unverified" };
  }
}
