/**
 * daily-campaign-service.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Turns the leads discovered from an APPROVED daily outreach plan into a
 * self-contained, trackable campaign — one new list + one new campaign per day:
 *
 *   discovered leads → deduped CRM contacts → a per-day custom list →
 *   a fresh clone of the "Grok 2.0 - for brokers" sequence → enrol the list →
 *   set the campaign live and start sending.
 *
 * Because each day gets its own named list + named campaign, the strategy the
 * agent used that day is easy to track and compare in the CRM.
 *
 * Dedup is enforced at the person level: anyone already enrolled in ANY drip
 * campaign (active or completed) is skipped, so the same referral partner never
 * receives duplicate outreach across days. Enrollment reuses the same
 * verify-before-enrol policy as the manual CRM enrollment routes so we never
 * send to addresses that will bounce.
 */

import { storage } from "./storage";
import { addProspectContact } from "./contact-upsert";
import { isOnDnc, addToDnc } from "./agent-service";
import {
  verifyEmailForEnrollment,
  isFreshVerification,
  decisionFromStoredStatus,
} from "./email-verification-service";
import { processDripEmails } from "./drip-processor";
import { hunterFindEmail } from "./hunter-service";
import { BROKER_2_CAMPAIGN_NAME } from "@shared/campaign-tracks";
import type { DripCampaign, Prospect } from "@shared/schema";

export interface DiscoveredLeadInput {
  fullName: string;
  company?: string | null;
  email?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  jobTitle?: string | null;
  category?: string | null;
  country?: string | null;
  city?: string | null;
}

export interface DailyCampaignResult {
  listName: string;
  listId: string;
  campaignName: string;
  campaignId: string;
  contactsAdded: number;
  emailsEnriched: number;
  enrolled: number;
  skippedDuplicate: number;
  skippedUndeliverable: number;
  skippedNoEmail: number;
}

// Public directories / social sites / webmail whose domain would never yield a
// person's work email via Hunter — skip enrichment for these so we don't waste
// calls or mint a bogus address (e.g. "jane.doe@linkedin.com").
const NON_FIRM_DOMAINS = new Set([
  "linkedin.com", "facebook.com", "twitter.com", "x.com", "instagram.com",
  "youtube.com", "google.com", "goo.gl", "yelp.com", "wikipedia.org",
  "crunchbase.com", "bloomberg.com", "glassdoor.com", "indeed.com", "avvo.com",
  "justia.com", "martindale.com", "lawyers.com", "yellowpages.com", "bbb.org",
  "medium.com", "wordpress.com", "blogspot.com", "gmail.com", "yahoo.com",
  "hotmail.com", "outlook.com",
]);

// Generic leading sub-domains to peel off a deep-page URL so it still resolves to
// the firm's mail domain (careers.smithlaw.com → smithlaw.com). Kept to a known
// list so we stay correct for multi-part TLDs (we never blindly drop a label).
const GENERIC_SUBDOMAINS = new Set([
  "www", "blog", "careers", "jobs", "info", "mail", "news", "shop", "store",
  "app", "go", "get", "m", "en", "us", "about", "team", "home", "web", "portal",
  "support", "help",
]);

// Tokens that mark a firm / organisation name rather than a person. Hunter's
// email-finder needs a human first + last name, so a name carrying one of these
// is skipped instead of guessing a bogus address (e.g. "Smith Immigration Law").
const ORG_NAME_TOKENS =
  /\b(llc|llp|pllc|inc|incorporated|corp|corporation|ltd|co|group|firm|law|legal|associates|partners|partnership|association|chamber|bureau|holdings|capital|realty|ventures|advisory)\b|&|,/i;

/** Derive a firm domain from a website URL, or null if it's blank/non-firm. */
function domainFromWebsite(website?: string | null): string | null {
  const raw = (website ?? "").trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const labels = new URL(withScheme).hostname.toLowerCase().split(".");
    // Peel a single known generic sub-domain, but only while a domain.tld remains.
    if (labels.length >= 3 && GENERIC_SUBDOMAINS.has(labels[0])) labels.shift();
    const host = labels.join(".");
    if (!host.includes(".")) return null;
    const base = labels.slice(-2).join(".");
    if (NON_FIRM_DOMAINS.has(host) || NON_FIRM_DOMAINS.has(base)) return null;
    return host;
  } catch {
    return null;
  }
}

/**
 * Best-effort discover a work email for a person lead via Hunter's email-finder.
 * Discovery (SerpAPI) returns a name + firm website but no email, and the Grok
 * broker sequence is email-led — so without this step the whole day's list is
 * un-enrollable. Only attempts leads that look like a real person (2+ name parts
 * and no firm/org token) on a real firm domain; returns null otherwise.
 */
async function enrichLeadEmail(lead: DiscoveredLeadInput): Promise<string | null> {
  const domain = domainFromWebsite(lead.website);
  if (!domain) return null;
  const name = (lead.fullName ?? "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  // Need a plausible person: 2+ name parts that don't read as an org/firm name.
  if (parts.length < 2 || ORG_NAME_TOKENS.test(name)) return null;
  try {
    const r = await hunterFindEmail(parts[0], parts[parts.length - 1], domain);
    return r?.email ?? null;
  } catch {
    return null;
  }
}

/** Short, human label for the day's dominant strategy, used in list/campaign names. */
function strategyLabel(categories: string[] | undefined): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const c of categories ?? []) {
    const clean = (c ?? "").replace(/_/g, " ").trim();
    if (!clean || seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    parts.push(clean);
    if (parts.length === 2) break;
  }
  return parts.join(" + ");
}

/**
 * Clone the "Grok 2.0 - for brokers" drip campaign — every step, in order —
 * into a brand-new live campaign under `name`. Throws if the source template
 * hasn't been seeded yet (it is seeded at boot via seedGrokCampaign()).
 */
export async function cloneGrokBrokerCampaign(
  name: string,
  description: string,
): Promise<DripCampaign> {
  const campaigns = await storage.getDripCampaigns();
  const source = campaigns.find((c) => c.name === BROKER_2_CAMPAIGN_NAME);
  if (!source) {
    throw new Error(
      `Source campaign "${BROKER_2_CAMPAIGN_NAME}" not found — cannot clone the daily campaign.`,
    );
  }

  const steps = await storage.getDripSteps(source.id);
  const created = await storage.createDripCampaign({
    name,
    description,
    isActive: true,
    audienceType: (source as any).audienceType ?? "broker",
  } as any);

  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  for (const s of ordered) {
    await storage.createDripStep({
      campaignId: created.id,
      stepOrder: s.stepOrder,
      delayDays: s.delayDays,
      stepType: s.stepType,
      stepName: s.stepName,
      priority: s.priority,
      subject: s.subject,
      bodyHtml: s.bodyHtml,
      triggerType: (s as any).triggerType,
      triggerRefStep: (s as any).triggerRefStep,
      triggerWindowHours: (s as any).triggerWindowHours,
    } as any);
  }

  console.log(`[DailyCampaign] Cloned "${BROKER_2_CAMPAIGN_NAME}" → "${name}" (${ordered.length} steps).`);
  return created;
}

type EnrollOutcome = "enrolled" | "no_email" | "duplicate" | "undeliverable";

/**
 * Enrol one prospect into the campaign, honouring the same guards as the manual
 * CRM enrollment route:
 *  • skip if no email (the sequence is email-led),
 *  • skip if the person is already enrolled in ANY campaign (cross-day dedup),
 *  • skip if on the DNC list,
 *  • verify deliverability (cached 30d) and skip undeliverable, failing open on
 *    a verifier outage so a Hunter hiccup can't silently drop a good list.
 */
async function enrolProspect(
  campaignId: string,
  prospect: Prospect,
  seenThisRun: Set<string>,
): Promise<EnrollOutcome> {
  // Trim before testing: a whitespace-only address (" ") is truthy but is not a
  // real email and would violate the intent of dripEnrollments.prospectEmail.
  const email = prospect.email?.trim();
  if (!email) return "no_email";
  const emailLc = email.toLowerCase();

  if (seenThisRun.has(emailLc)) return "duplicate";

  // Cross-day / cross-campaign person dedup: never double-enrol the same person.
  const prior = await storage.getDripEnrollmentsByEmail(email);
  if (prior.some((e) => e.status === "active" || e.status === "completed")) {
    seenThisRun.add(emailLc);
    return "duplicate";
  }

  if (await isOnDnc(email)) return "undeliverable";

  // Deliverability gate — reuse the cached verdict when fresh, else verify once.
  const cachedStatus = (prospect as any).emailStatus as string | null | undefined;
  let shouldEnroll = true;
  if (cachedStatus && isFreshVerification((prospect as any).emailVerifiedAt)) {
    shouldEnroll = decisionFromStoredStatus(cachedStatus).shouldEnroll;
  } else {
    const r = await verifyEmailForEnrollment(email);
    if (r.status) {
      await storage
        .updateProspect(prospect.id, { emailStatus: r.status, emailVerifiedAt: new Date() } as any)
        .catch(() => {});
      if (r.shouldDnc) {
        await addToDnc(email, undefined, undefined, `Hunter verify: ${r.reason}`).catch(() => {});
      }
      shouldEnroll = r.shouldEnroll;
    } else {
      // Verifier unavailable — honour a known-bad cached verdict if we have one,
      // otherwise fail open (a null/unknown cached status → enrol unverified) so
      // a Hunter outage can't silently drop an otherwise-good list.
      shouldEnroll = decisionFromStoredStatus(cachedStatus).shouldEnroll;
    }
  }
  if (!shouldEnroll) return "undeliverable";

  await storage.createDripEnrollment({
    campaignId,
    prospectId: prospect.id,
    prospectEmail: email,
    prospectName: prospect.name,
    currentStep: 0,
    status: "active",
  });
  seenThisRun.add(emailLc);
  return "enrolled";
}

/**
 * Materialise the day's approved-plan leads into a custom list + a fresh clone
 * of the Grok 2.0 broker campaign, enrol the list, and set it live. Returns a
 * summary (or null if there were no usable leads).
 */
export async function buildDailyCampaignFromLeads(opts: {
  planDate: string;
  /**
   * The date the campaign is actually built & goes live — used for the list /
   * campaign display names. Defaults to planDate, but a stale plan approved days
   * later should surface the run date (today), not the day it was drafted.
   */
  runDate?: string;
  planSummary?: string | null;
  topCategories?: string[];
  leads: DiscoveredLeadInput[];
}): Promise<DailyCampaignResult | null> {
  const leads = opts.leads.filter((l) => l.fullName && l.fullName.trim().length >= 3);
  if (leads.length === 0) return null;

  // 1. Discovered leads → deduped CRM contacts. SerpAPI gives us a name + firm
  //    website but no email; enrich a work email via Hunter first so the
  //    email-led campaign actually has someone to send to.
  const contactIds: string[] = [];
  let emailsEnriched = 0;
  for (const l of leads) {
    let email = l.email?.trim() || null;
    let enrichedEmail: string | null = null;
    if (!email) {
      enrichedEmail = await enrichLeadEmail(l);
      if (enrichedEmail) email = enrichedEmail;
    }
    try {
      const { contact } = await addProspectContact(
        {
          fullName: l.fullName,
          companyName: l.company,
          email,
          websiteUrl: l.website,
          linkedinUrl: l.linkedinUrl,
          jobTitle: l.jobTitle,
          country: l.country,
          city: l.city,
        },
        l.category ?? undefined,
        { source: "Outreach Agent — Daily Plan" },
      );
      contactIds.push(contact.id);
      // Only count an enrichment once the address has actually landed on the
      // persisted contact — so the SMS never claims a Hunter email that didn't
      // stick (a pre-existing row can keep its own address, and a throw above
      // skips this line entirely).
      if (enrichedEmail && (contact.email ?? "").toLowerCase() === enrichedEmail.toLowerCase()) {
        emailsEnriched++;
      }
    } catch (e) {
      console.warn(`[DailyCampaign] Could not add contact "${l.fullName}":`, (e as Error).message);
    }
  }
  if (contactIds.length === 0) return null;

  // 2. Per-day custom list (auto-mirrored into a campaign-audience prospect list).
  const runDate = opts.runDate || opts.planDate;
  const label = strategyLabel(opts.topCategories);
  const suffix = label ? ` · ${label}` : "";
  const listName = `Daily Leads — ${runDate}${suffix}`;
  const list = await storage.createCrmList(listName);
  await storage.addContactsToList(list.id, contactIds);

  // 3. Clone the Grok 2.0 broker sequence into a fresh live campaign for today.
  const campaignName = `Grok 2.0 Brokers — ${runDate}${suffix}`;
  const plannedNote = opts.planDate && opts.planDate !== runDate ? ` (planned ${opts.planDate})` : "";
  const description =
    `Auto-generated ${runDate}${plannedNote} from the approved outreach plan. ` +
    `Audience: "${listName}" (${contactIds.length} contacts). ` +
    `${opts.planSummary ?? ""}`.trim().slice(0, 500);
  const campaign = await cloneGrokBrokerCampaign(campaignName, description);

  // 4. Enrol the list's prospects into the new campaign (verify + dedup).
  const prospectListId = (list as any).prospectListId as string | null;
  const prospectsInList = prospectListId
    ? await storage.getProspectsByListId(prospectListId)
    : [];

  const seenThisRun = new Set<string>();
  let enrolled = 0,
    skippedDuplicate = 0,
    skippedUndeliverable = 0,
    skippedNoEmail = 0;
  for (const p of prospectsInList) {
    try {
      const outcome = await enrolProspect(campaign.id, p, seenThisRun);
      if (outcome === "enrolled") enrolled++;
      else if (outcome === "duplicate") skippedDuplicate++;
      else if (outcome === "undeliverable") skippedUndeliverable++;
      else skippedNoEmail++;
    } catch (e) {
      console.warn(`[DailyCampaign] Enrol failed for ${p.email ?? p.name}:`, (e as Error).message);
    }
  }

  // 5. Start the sequence promptly (non-force, so the optimal send window + caps
  //    still apply); a paused/empty campaign just no-ops.
  if (enrolled > 0) {
    processDripEmails({ campaignId: campaign.id }).catch((err) =>
      console.error("[DailyCampaign] post-enroll process error:", err),
    );
  }

  console.log(
    `[DailyCampaign] ${runDate}: list "${listName}" (${contactIds.length}, ${emailsEnriched} emails enriched), ` +
      `campaign "${campaignName}" — enrolled ${enrolled}, dup ${skippedDuplicate}, ` +
      `undeliverable ${skippedUndeliverable}, no-email ${skippedNoEmail}.`,
  );

  return {
    listName,
    listId: list.id,
    campaignName,
    campaignId: campaign.id,
    contactsAdded: contactIds.length,
    emailsEnriched,
    enrolled,
    skippedDuplicate,
    skippedUndeliverable,
    skippedNoEmail,
  };
}
