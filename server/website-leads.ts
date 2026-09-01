/**
 * Keep website-inbound form submissions visible in CRM: upsert a client,
 * stamp leadSource, and maintain the "Website Leads" list.
 */
import type { CrmClient, InsertCrmClient } from "@shared/schema";
import {
  WEBSITE_LEADS_LIST_NAME,
  inferWebsiteLeadSourceFromMessage,
  isWebsiteLeadSource,
  type WebsiteLeadSource,
} from "@shared/website-leads";
import { storage } from "./storage";

export interface WebsiteLeadIngestInput {
  fullName: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  notes?: string | null;
  leadSource: WebsiteLeadSource;
}

export interface WebsiteLeadSyncResult {
  created: number;
  updated: number;
  listed: number;
}

export async function findOrCreateWebsiteLeadsList(): Promise<{ id: string; name: string }> {
  return storage.findOrCreateCrmListByName(WEBSITE_LEADS_LIST_NAME);
}

export async function ingestWebsiteLeadToCrm(input: WebsiteLeadIngestInput): Promise<CrmClient | null> {
  const email = (input.email || "").trim();
  if (!email || !email.includes("@")) return null;

  const existing = await storage.getCrmClientByEmail(email);
  let client: CrmClient;

  if (!existing) {
    client = await storage.createCrmClient({
      fullName: input.fullName.trim() || email.split("@")[0],
      email,
      phone: input.phone || null,
      country: input.country || null,
      status: "new",
      leadSource: input.leadSource,
      notes: input.notes || null,
    });
  } else {
    const patch: Partial<InsertCrmClient> = {};
    if (!existing.leadSource?.trim()) patch.leadSource = input.leadSource;
    if (!existing.notes && input.notes) patch.notes = input.notes;
    if (!existing.phone && input.phone) patch.phone = input.phone;
    if (!existing.country && input.country) patch.country = input.country;
    client = Object.keys(patch).length
      ? await storage.updateCrmClient(existing.id, patch)
      : existing;
  }

  const list = await findOrCreateWebsiteLeadsList();
  await storage.addClientsToList(list.id, [client.id]);
  return client;
}

export async function syncWebsiteLeadsFromHistory(): Promise<WebsiteLeadSyncResult> {
  const list = await findOrCreateWebsiteLeadsList();
  const [formLeads, clients] = await Promise.all([
    storage.getLeads(),
    storage.getCrmClients(),
  ]);

  const toList = new Set<string>();
  const result: WebsiteLeadSyncResult = { created: 0, updated: 0, listed: 0 };
  const seenEmails = new Set<string>();

  for (const lead of formLeads) {
    const source = inferWebsiteLeadSourceFromMessage(lead.message);
    if (!source) continue;
    const email = (lead.email || "").trim();
    if (!email || !email.includes("@")) continue;
    const key = email.toLowerCase();
    if (seenEmails.has(key)) continue;
    seenEmails.add(key);

    const before = await storage.getCrmClientByEmail(email);
    const client = await ingestWebsiteLeadToCrm({
      fullName: lead.fullName,
      email,
      phone: lead.phone,
      country: lead.country,
      notes: lead.message,
      leadSource: source,
    });
    if (!client) continue;
    if (!before) result.created++;
    else if (client.updatedAt !== before.updatedAt) result.updated++;
    toList.add(client.id);
  }

  for (const client of clients) {
    if (isWebsiteLeadSource(client.leadSource)) toList.add(client.id);
  }

  if (toList.size) {
    result.listed = await storage.addClientsToList(list.id, Array.from(toList));
  }
  return result;
}

