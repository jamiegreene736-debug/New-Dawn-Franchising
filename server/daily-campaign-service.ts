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
import {
  enrichLeadEmail,
  findPeopleAtFirm,
  looksLikePersonName,
  domainFromWebsite,
} from "./lead-email-enrichment";
import { clearHunterIssue, getHunterIssue } from "./hunter-service";
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
  /** Extra people discovered at org-only leads' firms (Hunter domain-search). */
  firmPeopleAdded: number;
  enrolled: number;
  skippedDuplicate: number;
  skippedUndeliverable: number;
  skippedNoEmail: number;
  /**
   * Enrichment-time provider problems worth telling the operator about (Hunter
   * quota exhaustion, leads arriving with nothing to enrich) — merged into the
   * daily report SMS's provider-issues line by the caller.
   */
  providerIssues?: string[];
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

  // Track Hunter failures fresh for this run so a quota-dead key shows up in
  // the report instead of masquerading as "no emails found".
  clearHunterIssue();
  // Leads that arrive with neither an email nor a usable firm domain give the
  // enrichment waterfall nothing to work with — count them so a low-yield day
  // is explainable at a glance.
  let unenrichableLeads = 0;

  // 1. Discovered leads → deduped CRM contacts. SerpAPI gives us a name + firm
  //    website but no email; enrich a work email (Hunter → Apollo → PDL →
  //    verified pattern guess) first so the email-led campaign actually has
  //    someone to send to. Org-only leads ("Smith Immigration Law") are
  //    expanded into the real people Hunter knows at that firm's domain.
  const contactIds: string[] = [];
  let emailsEnriched = 0;
  let firmPeopleAdded = 0;
  // Addresses whose deliverability was already confirmed during enrichment —
  // carried to the enrol step so the same address isn't verified (and billed)
  // twice in one run.
  const verifiedDuringEnrichment = new Set<string>();
  // Bound the per-run Hunter domain-search spend for firm expansion (org-only
  // leads AND person leads whose email enrichment came up dry). Only ~25-35% of
  // discovered leads yield an email otherwise, so this budget is the main lever
  // for converting a big discovery day into enrollable contacts.
  let orgExpansionsLeft = 40;
  // How many named mailboxes to pull per expanded firm.
  const PEOPLE_PER_FIRM = 5;

  const addContact = async (input: {
    fullName: string;
    companyName?: string | null;
    email: string | null;
    websiteUrl?: string | null;
    linkedinUrl?: string | null;
    jobTitle?: string | null;
    country?: string | null;
    city?: string | null;
  }, category?: string | null): Promise<{ id: string; email: string | null } | null> => {
    try {
      const { contact } = await addProspectContact(
        input,
        category ?? undefined,
        { source: "Outreach Agent — Daily Plan" },
      );
      contactIds.push(contact.id);
      return { id: contact.id, email: contact.email ?? null };
    } catch (e) {
      console.warn(`[DailyCampaign] Could not add contact "${input.fullName}":`, (e as Error).message);
      return null;
    }
  };

  for (const l of leads) {
    let email = l.email?.trim() || null;
    let enrichedEmail: string | null = null;
    const isPerson = looksLikePersonName(l.fullName);
    if (!email && !domainFromWebsite(l.website)) unenrichableLeads++;

    if (!email && isPerson) {
      const enriched = await enrichLeadEmail(l);
      if (enriched) {
        email = enrichedEmail = enriched.email;
        if (enriched.verifiedStatus === "valid") {
          verifiedDuringEnrichment.add(enriched.email.toLowerCase());
        }
      }
    }

    // Still no address: expand the firm's domain into the real people Hunter
    // has on file there. Each person arrives WITH a work email, so this
    // converts what used to be a guaranteed "no email" skip into enrollable
    // contacts. Applies to org-only leads ("Smith Immigration Law") AND to
    // person leads whose enrichment came up dry — a colleague at the same
    // referral firm is an equally good campaign target. If the expansion
    // happens to surface the person lead themself, that's their email.
    if (!email && l.website && orgExpansionsLeft > 0) {
      orgExpansionsLeft--;
      const people = await findPeopleAtFirm(l.website, PEOPLE_PER_FIRM);
      const leadNameLc = l.fullName.trim().toLowerCase();
      for (const person of people) {
        if (isPerson && person.fullName.trim().toLowerCase() === leadNameLc) {
          // The "colleague" is the lead — recovered their address after all.
          email = enrichedEmail = person.email;
          continue;
        }
        const added = await addContact({
          fullName: person.fullName,
          // Org leads carry the firm in fullName; person leads only in company.
          companyName: l.company?.trim() || (isPerson ? null : l.fullName),
          email: person.email,
          websiteUrl: l.website,
          jobTitle: person.jobTitle ?? l.jobTitle,
          country: l.country,
          city: l.city,
        }, l.category);
        if (added && (added.email ?? "").toLowerCase() === person.email.toLowerCase()) {
          firmPeopleAdded++;
          emailsEnriched++;
        }
      }
      // An org lead whose expansion produced people is fully replaced by them;
      // it's only added as an (email-less) contact when expansion found nobody.
      // A person lead always falls through and is added under their own name.
      if (!isPerson && people.length > 0) continue;
    }

    const added = await addContact({
      fullName: l.fullName,
      companyName: l.company,
      email,
      websiteUrl: l.website,
      linkedinUrl: l.linkedinUrl,
      jobTitle: l.jobTitle,
      country: l.country,
      city: l.city,
    }, l.category);
    // Only count an enrichment once the address has actually landed on the
    // persisted contact — so the SMS never claims an email that didn't stick
    // (a pre-existing row can keep its own address, and an add failure skips
    // this entirely).
    if (added && enrichedEmail && (added.email ?? "").toLowerCase() === enrichedEmail.toLowerCase()) {
      emailsEnriched++;
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
      // An address whose deliverability was already confirmed during
      // enrichment doesn't need a second verifier call — persist the verdict
      // so enrolProspect's 30-day cache path picks it up.
      const pEmail = (p.email ?? "").trim().toLowerCase();
      if (
        pEmail &&
        verifiedDuringEnrichment.has(pEmail) &&
        !((p as any).emailStatus && isFreshVerification((p as any).emailVerifiedAt))
      ) {
        const now = new Date();
        await storage
          .updateProspect(p.id, { emailStatus: "valid", emailVerifiedAt: now } as any)
          .catch(() => {});
        (p as any).emailStatus = "valid";
        (p as any).emailVerifiedAt = now;
      }
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

  const providerIssues: string[] = [];
  const hunterIssue = getHunterIssue();
  if (hunterIssue) providerIssues.push(hunterIssue);
  if (unenrichableLeads > 0) {
    providerIssues.push(
      `${unenrichableLeads}/${leads.length} discovered leads had no email and no website — enrichment had nothing to work with`,
    );
  }

  console.log(
    `[DailyCampaign] ${runDate}: list "${listName}" (${contactIds.length}, ${emailsEnriched} emails enriched, ` +
      `${firmPeopleAdded} people found at org leads), ` +
      `campaign "${campaignName}" — enrolled ${enrolled}, dup ${skippedDuplicate}, ` +
      `undeliverable ${skippedUndeliverable}, no-email ${skippedNoEmail}.` +
      (providerIssues.length ? ` Issues: ${providerIssues.join("; ")}` : ""),
  );

  return {
    listName,
    listId: list.id,
    campaignName,
    campaignId: campaign.id,
    contactsAdded: contactIds.length,
    emailsEnriched,
    firmPeopleAdded,
    enrolled,
    skippedDuplicate,
    skippedUndeliverable,
    skippedNoEmail,
    providerIssues,
  };
}
