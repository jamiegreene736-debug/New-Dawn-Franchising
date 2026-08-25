import { type User, type InsertUser, type Lead, type InsertLead, type BlogPost, type InsertBlogPost, type Broker, type BrokerClient, type InsertBrokerClient, type CrmClient, type InsertCrmClient, type CrmClientActivity, type InsertCrmClientActivity, type CrmClientDocument, type CrmDirectEmail, type Prospect, type InsertProspect, type ProspectList, type CrmList, type DripCampaign, type InsertDripCampaign, type DripStep, type InsertDripStep, type DripEnrollment, type InsertDripEnrollment, type DripSend, type InsertDripSend, type FacebookPost, type InsertFacebookPost, type SignatureRequest, type SmsCampaign, type InsertSmsCampaign, type WhatsappCampaign, type InsertWhatsappCampaign, users, leads, blogPosts, brokers, brokerClients, crmClients, crmClientActivities, crmClientDocuments, crmDirectEmails, signatureRequests, prospects, prospectLists, prospectListMembers, crmLists, crmListMembers, dripCampaigns, dripSteps, dripEnrollments, dripSends, facebookPosts, smsCampaigns, whatsappCampaigns, type Contact, type InsertContact, type ContactActivity, type InsertContactActivity, type ContactTask, type InsertContactTask, type PipelineDeal, type InsertPipelineDeal, type SavedSegment, type InsertSavedSegment, type EmailTemplate, type InsertEmailTemplate, contacts, contactActivities, contactTasks, pipelineDeals, savedSegments, emailTemplates, type PhoneCall, phoneCalls } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, asc, sql, ilike, or, gte, lte, inArray, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createLead(lead: InsertLead): Promise<Lead>;
  getLeads(): Promise<Lead[]>;
  getBlogPosts(): Promise<BlogPost[]>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost): Promise<BlogPost>;
  updateBlogPost(id: string, data: Partial<InsertBlogPost>): Promise<BlogPost | undefined>;
  getBrokerById(id: string): Promise<Broker | undefined>;
  getBrokerByEmail(email: string): Promise<Broker | undefined>;
  createBroker(broker: { fullName: string; email: string; phone?: string; company?: string; passwordHash: string }): Promise<Broker>;
  signBrokerAgreement(brokerId: string, pdfBase64?: string): Promise<Broker>;
  getBrokerClients(brokerId: string): Promise<BrokerClient[]>;
  createBrokerClient(brokerId: string, client: InsertBrokerClient): Promise<BrokerClient>;
  markBrokerClientImported(id: string): Promise<void>;
  getAllBrokers(): Promise<Broker[]>;
  getCrmClients(): Promise<CrmClient[]>;
  getCrmClient(id: string): Promise<CrmClient | undefined>;
  getUniqueCrmTags(): Promise<string[]>;
  createCrmClient(client: InsertCrmClient): Promise<CrmClient>;
  updateCrmClient(id: string, data: Partial<InsertCrmClient>): Promise<CrmClient>;
  deleteCrmClient(id: string): Promise<void>;
  getProspects(): Promise<Prospect[]>;
  getProspect(id: string): Promise<Prospect | undefined>;
  getProspectByEmail(email: string): Promise<Prospect | undefined>;
  getProspectByPhone(phone: string): Promise<Prospect | undefined>;
  updateProspect(id: string, data: Partial<Prospect>): Promise<Prospect | undefined>;
  getProspectsByLocation(category: string, location: string): Promise<Prospect[]>;
  createProspect(prospect: InsertProspect): Promise<Prospect>;
  findOrCreateProspectForContact(contact: Contact): Promise<Prospect>;
  findOrCreateProspectForClient(client: CrmClient): Promise<Prospect>;
  findOrCreateContactForProspect(prospect: Prospect): Promise<Contact>;
  createProspects(prospectList: InsertProspect[]): Promise<Prospect[]>;
  deleteProspect(id: string): Promise<void>;
  deleteProspectsByLocation(category: string, location: string): Promise<void>;
  getProspectLists(): Promise<(ProspectList & { count: number })[]>;
  createProspectList(name: string): Promise<ProspectList>;
  deleteProspectList(id: string): Promise<void>;
  addProspectToList(listId: string, prospectId: string): Promise<void>;
  removeProspectFromList(listId: string, prospectId: string): Promise<void>;
  getProspectsByListId(listId: string): Promise<Prospect[]>;
  getCrmLists(): Promise<(CrmList & { count: number })[]>;
  createCrmList(name: string): Promise<CrmList>;
  renameCrmList(id: string, name: string): Promise<void>;
  deleteCrmList(id: string): Promise<void>;
  addClientsToList(listId: string, clientIds: string[]): Promise<number>;
  removeClientsFromList(listId: string, clientIds: string[]): Promise<void>;
  addContactsToList(listId: string, contactIds: string[]): Promise<number>;
  removeContactsFromList(listId: string, contactIds: string[]): Promise<void>;
  backfillCrmListMirrors(): Promise<number>;
  getClientsByListId(listId: string): Promise<CrmClient[]>;
  getDripCampaigns(): Promise<DripCampaign[]>;
  getDripCampaign(id: string): Promise<DripCampaign | undefined>;
  createDripCampaign(campaign: InsertDripCampaign): Promise<DripCampaign>;
  updateDripCampaign(id: string, data: Partial<InsertDripCampaign>): Promise<DripCampaign>;
  deleteDripCampaign(id: string): Promise<void>;
  getDripSteps(campaignId: string): Promise<DripStep[]>;
  createDripStep(step: InsertDripStep): Promise<DripStep>;
  updateDripStep(id: string, data: Partial<InsertDripStep>): Promise<DripStep>;
  deleteDripStep(id: string): Promise<void>;
  getDripEnrollments(campaignId?: string): Promise<DripEnrollment[]>;
  getDripEnrollmentsByEmail(email: string): Promise<DripEnrollment[]>;
  getDripEnrollment(id: string): Promise<DripEnrollment | undefined>;
  createDripEnrollment(enrollment: InsertDripEnrollment): Promise<DripEnrollment>;
  updateDripEnrollment(id: string, data: Partial<DripEnrollment>): Promise<DripEnrollment>;
  getActiveEnrollments(campaignId?: string): Promise<DripEnrollment[]>;
  getDripSends(enrollmentId?: string): Promise<DripSend[]>;
  getAllDripSends(): Promise<DripSend[]>;
  countSentEmailsSince(since: Date): Promise<number>;
  getDripSendsByCampaign(campaignId: string): Promise<DripSend[]>;
  getInboundReplyAddresses(): Promise<string[]>;
  getDripSend(id: string): Promise<DripSend | undefined>;
  createDripSend(send: InsertDripSend): Promise<DripSend>;
  updateDripSend(id: string, data: Partial<DripSend>): Promise<DripSend>;
  deleteDripSend(id: string): Promise<void>;
  recordEmailOpen(sendId: string): Promise<DripSend | undefined>;
  recordEmailClick(sendId: string): Promise<DripSend | undefined>;
  recordBotEmailOpen(sendId: string): Promise<void>;
  recordBotEmailClick(sendId: string): Promise<void>;
  markEnrollmentsUnsubscribed(email: string): Promise<number>;
  markDripSendBounced(recipientEmail: string, reason: string): Promise<DripSend | null>;
  getSmsCampaigns(): Promise<SmsCampaign[]>;
  createSmsCampaign(data: InsertSmsCampaign): Promise<SmsCampaign>;
  updateSmsCampaign(id: string, data: Partial<SmsCampaign>): Promise<SmsCampaign>;
  deleteSmsCampaign(id: string): Promise<void>;
  getWhatsappCampaigns(): Promise<WhatsappCampaign[]>;
  createWhatsappCampaign(data: InsertWhatsappCampaign): Promise<WhatsappCampaign>;
  updateWhatsappCampaign(id: string, data: Partial<WhatsappCampaign>): Promise<WhatsappCampaign>;
  deleteWhatsappCampaign(id: string): Promise<void>;
  getFacebookPosts(): Promise<FacebookPost[]>;
  getFacebookPost(id: string): Promise<FacebookPost | undefined>;
  createFacebookPost(post: InsertFacebookPost): Promise<FacebookPost>;
  updateFacebookPost(id: string, data: Partial<InsertFacebookPost & { postedAt: Date; facebookPostId: string; errorMessage: string }>): Promise<FacebookPost>;
  deleteFacebookPost(id: string): Promise<void>;
  getScheduledFacebookPosts(): Promise<FacebookPost[]>;
  // Investor CRM activities + documents
  getCrmClientActivities(clientId: string): Promise<CrmClientActivity[]>;
  createCrmClientActivity(data: InsertCrmClientActivity): Promise<CrmClientActivity>;
  getCrmClientDocuments(clientId: string): Promise<Omit<CrmClientDocument, "fileData">[]>;
  getCrmClientDocument(id: string): Promise<CrmClientDocument | undefined>;
  createCrmClientDocument(data: { clientId: string; fileName: string; fileType: string; fileSize: number; fileData: string }): Promise<Omit<CrmClientDocument, "fileData">>;
  deleteCrmClientDocument(id: string): Promise<void>;
  // Direct CRM emails
  getCrmClientByEmail(email: string): Promise<CrmClient | undefined>;
  getCrmDirectEmails(clientId: string): Promise<CrmDirectEmail[]>;
  getCrmDirectEmailByMessageId(messageId: string): Promise<CrmDirectEmail | undefined>;
  createCrmDirectEmail(data: { clientId: string; fromEmail: string; fromName: string; toEmail: string; subject: string; bodyHtml: string; bodyText?: string; trackingId?: string; direction?: "inbound" | "outbound"; messageId?: string; status?: string }): Promise<CrmDirectEmail>;
  recordDirectEmailOpen(trackingId: string): Promise<void>;
  recordDirectEmailClick(trackingId: string): Promise<void>;
  // Signature requests
  getSignatureRequests(clientId: string): Promise<SignatureRequest[]>;
  getSignatureRequestByToken(token: string): Promise<SignatureRequest | undefined>;
  createSignatureRequest(data: { clientId: string; documentType: string; token: string; sentToEmail: string }): Promise<SignatureRequest>;
  // Phone calls
  getPhoneCalls(opts?: { limit?: number; offset?: number }): Promise<PhoneCall[]>;
  upsertPhoneCall(data: Partial<PhoneCall> & { id: string; direction: string; fromNumber: string; toNumber: string; status: string }): Promise<PhoneCall>;
  updatePhoneCall(id: string, data: Partial<PhoneCall>): Promise<PhoneCall | undefined>;
  getPhoneCallByExternalId(id: string): Promise<PhoneCall | undefined>;
  completeSignature(token: string, signerName: string, signerIp: string, signatureData: string): Promise<SignatureRequest | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [created] = await db.insert(leads).values(lead).returning();
    return created;
  }

  async getLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async getBlogPosts(): Promise<BlogPost[]> {
    return db.select().from(blogPosts).orderBy(desc(blogPosts.publishedAt));
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async createBlogPost(post: InsertBlogPost): Promise<BlogPost> {
    const [created] = await db.insert(blogPosts).values(post).returning();
    return created;
  }

  async updateBlogPost(id: string, data: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    const [updated] = await db.update(blogPosts).set(data).where(eq(blogPosts.id, id)).returning();
    return updated;
  }

  async getBrokerById(id: string): Promise<Broker | undefined> {
    const [broker] = await db.select().from(brokers).where(eq(brokers.id, id));
    return broker;
  }

  async getBrokerByEmail(email: string): Promise<Broker | undefined> {
    const [broker] = await db.select().from(brokers).where(eq(brokers.email, email));
    return broker;
  }

  async createBroker(broker: { fullName: string; email: string; phone?: string; company?: string; passwordHash: string }): Promise<Broker> {
    const [created] = await db.insert(brokers).values(broker).returning();
    return created;
  }

  async signBrokerAgreement(brokerId: string, pdfBase64?: string): Promise<Broker> {
    const [updated] = await db.update(brokers)
      .set({ agreementSigned: true, agreementSignedAt: new Date(), agreementPdf: pdfBase64 || null })
      .where(eq(brokers.id, brokerId))
      .returning();
    return updated;
  }

  async getBrokerClients(brokerId: string): Promise<BrokerClient[]> {
    return db.select().from(brokerClients)
      .where(eq(brokerClients.brokerId, brokerId))
      .orderBy(desc(brokerClients.createdAt));
  }

  async createBrokerClient(brokerId: string, client: InsertBrokerClient): Promise<BrokerClient> {
    const [created] = await db.insert(brokerClients).values({ ...client, brokerId }).returning();
    return created;
  }

  async markBrokerClientImported(id: string): Promise<void> {
    await db.update(brokerClients).set({ importedAt: new Date() }).where(eq(brokerClients.id, id));
  }

  async getAllBrokers(): Promise<Broker[]> {
    return db.select().from(brokers).orderBy(desc(brokers.createdAt));
  }

  async getCrmClients(): Promise<CrmClient[]> {
    return db.select().from(crmClients).orderBy(desc(crmClients.createdAt));
  }

  async getUniqueCrmTags(): Promise<string[]> {
    const rows = await db.select({ tags: crmClients.tags }).from(crmClients);
    const tagSet = new Set<string>();
    for (const row of rows) {
      if (row.tags) for (const t of row.tags) if (t) tagSet.add(t.trim());
    }
    return Array.from(tagSet).sort();
  }

  async getCrmClient(id: string): Promise<CrmClient | undefined> {
    const [client] = await db.select().from(crmClients).where(eq(crmClients.id, id));
    return client;
  }

  async createCrmClient(client: InsertCrmClient): Promise<CrmClient> {
    const [created] = await db.insert(crmClients).values(client).returning();
    return created;
  }

  async updateCrmClient(id: string, data: Partial<InsertCrmClient>): Promise<CrmClient> {
    const [updated] = await db.update(crmClients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crmClients.id, id))
      .returning();
    return updated;
  }

  async deleteCrmClient(id: string): Promise<void> {
    // Delete child records first to satisfy FK constraints (no cascade on these refs)
    await db.delete(signatureRequests).where(eq(signatureRequests.clientId, id));
    await db.delete(crmDirectEmails).where(eq(crmDirectEmails.clientId, id));
    await db.delete(crmClientDocuments).where(eq(crmClientDocuments.clientId, id));
    await db.delete(crmClientActivities).where(eq(crmClientActivities.clientId, id));
    await db.delete(crmClients).where(eq(crmClients.id, id));
  }

  async getProspects(): Promise<Prospect[]> {
    return db.select().from(prospects).orderBy(desc(prospects.createdAt));
  }

  async getProspect(id: string): Promise<Prospect | undefined> {
    const [p] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
    return p;
  }

  async getProspectByEmail(email: string): Promise<Prospect | undefined> {
    if (!email) return undefined;
    const [p] = await db.select().from(prospects)
      .where(sql`lower(${prospects.email}) = ${email.toLowerCase()}`).limit(1);
    return p;
  }

  async getProspectByPhone(phone: string): Promise<Prospect | undefined> {
    const last10 = (phone || "").replace(/\D/g, "").slice(-10);
    if (last10.length < 10) return undefined;
    // Exact last-10 match (not a suffix LIKE, which would also match a longer
    // number sharing the trailing digits), consistent with phoneLast10 elsewhere.
    const [p] = await db.select().from(prospects)
      .where(sql`right(regexp_replace(coalesce(${prospects.phone}, ''), '[^0-9]', '', 'g'), 10) = ${last10}`)
      .limit(1);
    return p;
  }

  async updateProspect(id: string, data: Partial<Prospect>): Promise<Prospect | undefined> {
    const [updated] = await db.update(prospects).set(data).where(eq(prospects.id, id)).returning();
    return updated;
  }

  async getProspectsByLocation(category: string, location: string): Promise<Prospect[]> {
    return db.select().from(prospects)
      .where(and(eq(prospects.category, category), eq(prospects.location, location)))
      .orderBy(desc(prospects.createdAt));
  }

  async createProspect(prospect: InsertProspect): Promise<Prospect> {
    const [created] = await db.insert(prospects).values(prospect).returning();
    return created;
  }

  async createProspects(prospectList: InsertProspect[]): Promise<Prospect[]> {
    if (prospectList.length === 0) return [];
    return db.insert(prospects).values(prospectList).returning();
  }

  async deleteProspect(id: string): Promise<void> {
    await db.delete(prospects).where(eq(prospects.id, id));
  }

  async deleteProspectsByLocation(category: string, location: string): Promise<void> {
    await db.delete(prospects).where(and(eq(prospects.category, category), eq(prospects.location, location)));
  }

  async getProspectLists(): Promise<(ProspectList & { count: number })[]> {
    const lists = await db.select().from(prospectLists).orderBy(asc(prospectLists.createdAt));
    const counts = await db.select({
      listId: prospectListMembers.listId,
      count: sql<number>`cast(count(*) as int)`,
    }).from(prospectListMembers).groupBy(prospectListMembers.listId);
    const countMap = new Map(counts.map((c) => [c.listId, c.count]));
    return lists.map((l) => ({ ...l, count: countMap.get(l.id) ?? 0 }));
  }

  async createProspectList(name: string): Promise<ProspectList> {
    const [list] = await db.insert(prospectLists).values({ name }).returning();
    return list;
  }

  async deleteProspectList(id: string): Promise<void> {
    await db.delete(prospectLists).where(eq(prospectLists.id, id));
  }

  async addProspectToList(listId: string, prospectId: string): Promise<void> {
    const existing = await db.select().from(prospectListMembers)
      .where(and(eq(prospectListMembers.listId, listId), eq(prospectListMembers.prospectId, prospectId)));
    if (existing.length === 0) {
      await db.insert(prospectListMembers).values({ listId, prospectId });
    }
  }

  async removeProspectFromList(listId: string, prospectId: string): Promise<void> {
    await db.delete(prospectListMembers)
      .where(and(eq(prospectListMembers.listId, listId), eq(prospectListMembers.prospectId, prospectId)));
  }

  async getProspectsByListId(listId: string): Promise<Prospect[]> {
    const members = await db.select({ prospectId: prospectListMembers.prospectId })
      .from(prospectListMembers).where(eq(prospectListMembers.listId, listId));
    if (members.length === 0) return [];
    const ids = members.map((m) => m.prospectId);
    return db.select().from(prospects).where(inArray(prospects.id, ids)).orderBy(desc(prospects.createdAt));
  }

  async getCrmLists(): Promise<(CrmList & { count: number })[]> {
    const lists = await db.select().from(crmLists).orderBy(asc(crmLists.createdAt));
    const counts = await db.select({
      listId: crmListMembers.listId,
      count: sql<number>`cast(count(*) as int)`,
    }).from(crmListMembers).groupBy(crmListMembers.listId);
    const countMap = new Map(counts.map((c) => [c.listId, c.count]));
    return lists.map((l) => ({ ...l, count: countMap.get(l.id) ?? 0 }));
  }

  async createCrmList(name: string): Promise<CrmList> {
    const [list] = await db.insert(crmLists).values({ name }).returning();
    // Create the campaign-facing mirror up front so the list is immediately
    // selectable as a campaign audience (even while still empty).
    const [pl] = await db.insert(prospectLists).values({ name }).returning();
    await db.update(crmLists).set({ prospectListId: pl.id }).where(eq(crmLists.id, list.id));
    return { ...list, prospectListId: pl.id };
  }

  async renameCrmList(id: string, name: string): Promise<void> {
    await db.update(crmLists).set({ name }).where(eq(crmLists.id, id));
    const pid = await this.getLinkedProspectListId(id);
    if (pid) await db.update(prospectLists).set({ name }).where(eq(prospectLists.id, pid));
  }

  async deleteCrmList(id: string): Promise<void> {
    const pid = await this.getLinkedProspectListId(id);
    // Drop the mirror too (cascades prospect_list_members; any campaign listId FK
    // is set null per the prospect_lists FK rule).
    if (pid) await this.deleteProspectList(pid);
    await db.delete(crmLists).where(eq(crmLists.id, id));
  }

  async addClientsToList(listId: string, clientIds: string[]): Promise<number> {
    if (clientIds.length === 0) return 0;
    const existing = await db.select({ clientId: crmListMembers.clientId })
      .from(crmListMembers)
      .where(and(eq(crmListMembers.listId, listId), inArray(crmListMembers.clientId, clientIds)));
    const have = new Set(existing.map((e) => e.clientId));
    const toAdd = clientIds.filter((id) => !have.has(id));
    if (toAdd.length === 0) return 0;
    const prospectListId = await this.ensureLinkedProspectList(listId);
    let added = 0;
    for (const clientId of toAdd) {
      const c = await this.getCrmClient(clientId);
      if (!c) continue;
      // Mirror to a prospect and record it on the member row so removal is exact.
      const prospectId = (await this.findOrCreateProspectForClient(c)).id;
      await db.insert(crmListMembers).values({ listId, clientId, prospectId }).onConflictDoNothing();
      await this.addProspectToList(prospectListId, prospectId);
      added++;
    }
    return added;
  }

  async removeClientsFromList(listId: string, clientIds: string[]): Promise<void> {
    if (clientIds.length === 0) return;
    const removedPids = await this.memberProspectIds(listId, "clientId", clientIds);
    await db.delete(crmListMembers)
      .where(and(eq(crmListMembers.listId, listId), inArray(crmListMembers.clientId, clientIds)));
    await this.unmirrorProspects(listId, removedPids);
  }

  async addContactsToList(listId: string, contactIds: string[]): Promise<number> {
    if (contactIds.length === 0) return 0;
    const existing = await db.select({ contactId: crmListMembers.contactId })
      .from(crmListMembers)
      .where(and(eq(crmListMembers.listId, listId), inArray(crmListMembers.contactId, contactIds)));
    const have = new Set(existing.map((e) => e.contactId));
    const toAdd = contactIds.filter((id) => !have.has(id));
    if (toAdd.length === 0) return 0;
    const prospectListId = await this.ensureLinkedProspectList(listId);
    let added = 0;
    for (const contactId of toAdd) {
      const ct = await this.getContact(contactId);
      if (!ct) continue;
      const prospectId = (await this.findOrCreateProspectForContact(ct)).id;
      await db.insert(crmListMembers).values({ listId, contactId, prospectId }).onConflictDoNothing();
      await this.addProspectToList(prospectListId, prospectId);
      added++;
    }
    return added;
  }

  async removeContactsFromList(listId: string, contactIds: string[]): Promise<void> {
    if (contactIds.length === 0) return;
    const removedPids = await this.memberProspectIds(listId, "contactId", contactIds);
    await db.delete(crmListMembers)
      .where(and(eq(crmListMembers.listId, listId), inArray(crmListMembers.contactId, contactIds)));
    await this.unmirrorProspects(listId, removedPids);
  }

  async getClientsByListId(listId: string): Promise<CrmClient[]> {
    const members = await db.select({ clientId: crmListMembers.clientId })
      .from(crmListMembers).where(eq(crmListMembers.listId, listId));
    const ids = members.map((m) => m.clientId).filter((id): id is string => !!id);
    if (ids.length === 0) return [];
    return db.select().from(crmClients).where(inArray(crmClients.id, ids)).orderBy(desc(crmClients.createdAt));
  }

  /**
   * One-time backfill so CRM lists created before the mirror existed become
   * campaign-selectable without the user having to re-touch them. Idempotent:
   * lists that already have a linked prospect_list are skipped, so it's safe to
   * run on every boot. Called from server/index.ts after ensureSchema().
   */
  async backfillCrmListMirrors(): Promise<number> {
    const lists = await db.select({ id: crmLists.id }).from(crmLists).where(isNull(crmLists.prospectListId));
    let healed = 0;
    for (const l of lists) {
      try {
        await this.ensureLinkedProspectList(l.id);
        healed++;
      } catch (err: any) {
        console.error(`[crm-list-mirror] backfill failed for list ${l.id}: ${err?.message}`);
      }
    }
    return healed;
  }

  // ── CRM-list → prospect-list mirror helpers ───────────────────────────────
  // Campaigns enrol prospects, not CRM clients/contacts. Every CRM list is
  // reflected into a `prospect_list` (link stored on crm_lists.prospect_list_id)
  // so it appears in the campaign audience pickers. Each member row records the
  // prospect it was mirrored to (crm_list_members.prospect_id) so removal targets
  // the exact prospect — re-resolving by identity would mint a fresh, unrelated
  // prospect for an email-less person and orphan the real one in the campaign.

  /** The linked prospect_list id for a CRM list, or null if it has none yet. */
  private async getLinkedProspectListId(listId: string): Promise<string | null> {
    const [list] = await db.select({ pid: crmLists.prospectListId }).from(crmLists).where(eq(crmLists.id, listId));
    return list?.pid ?? null;
  }

  /** The recorded mirror-prospect ids for the given members of a list. */
  private async memberProspectIds(
    listId: string,
    col: "clientId" | "contactId",
    ids: string[],
  ): Promise<Set<string>> {
    const rows = await db.select({ prospectId: crmListMembers.prospectId })
      .from(crmListMembers)
      .where(and(eq(crmListMembers.listId, listId), inArray(crmListMembers[col], ids)));
    return new Set(rows.map((r) => r.prospectId).filter((p): p is string => !!p));
  }

  /**
   * Ensure the CRM list has a linked prospect_list, creating it (and backfilling
   * every current member) on first use — so lists created before the mirror
   * existed self-heal the moment a member is touched. Returns the prospect_list id.
   */
  private async ensureLinkedProspectList(listId: string): Promise<string> {
    const [list] = await db.select().from(crmLists).where(eq(crmLists.id, listId));
    if (!list) throw new Error("CRM list not found");
    if (list.prospectListId) {
      const [pl] = await db.select({ id: prospectLists.id }).from(prospectLists).where(eq(prospectLists.id, list.prospectListId));
      if (pl) return list.prospectListId;
    }
    const [pl] = await db.insert(prospectLists).values({ name: list.name }).returning();
    await db.update(crmLists).set({ prospectListId: pl.id }).where(eq(crmLists.id, listId));
    for (const pid of await this.backfillMemberProspectIds(listId)) {
      await this.addProspectToList(pl.id, pid);
    }
    return pl.id;
  }

  /**
   * Populate any member rows missing a recorded prospect_id (legacy rows added
   * before the mirror existed), then return the list's distinct mirror-prospect ids.
   */
  private async backfillMemberProspectIds(listId: string): Promise<string[]> {
    const rows = await db.select().from(crmListMembers).where(eq(crmListMembers.listId, listId));
    const ids = new Set<string>();
    for (const m of rows) {
      let pid = m.prospectId ?? null;
      if (!pid) {
        if (m.clientId) {
          const c = await this.getCrmClient(m.clientId);
          if (c) pid = (await this.findOrCreateProspectForClient(c)).id;
        } else if (m.contactId) {
          const ct = await this.getContact(m.contactId);
          if (ct) pid = (await this.findOrCreateProspectForContact(ct)).id;
        }
        if (pid) await db.update(crmListMembers).set({ prospectId: pid }).where(eq(crmListMembers.id, m.id));
      }
      if (pid) ids.add(pid);
    }
    return Array.from(ids);
  }

  /**
   * After members leave a list, drop their mirrored prospects from the linked
   * prospect_list — but only those no longer referenced by any remaining member
   * (two members can map to the same prospect when they share an email).
   */
  private async unmirrorProspects(listId: string, candidatePids: Set<string>): Promise<void> {
    if (candidatePids.size === 0) return;
    const prospectListId = await this.getLinkedProspectListId(listId);
    if (!prospectListId) return;
    const remaining = await db.select({ prospectId: crmListMembers.prospectId })
      .from(crmListMembers).where(eq(crmListMembers.listId, listId));
    const stillReferenced = new Set(remaining.map((r) => r.prospectId).filter((p): p is string => !!p));
    for (const pid of candidatePids) {
      if (!stillReferenced.has(pid)) await this.removeProspectFromList(prospectListId, pid);
    }
  }

  async getDripCampaigns(): Promise<DripCampaign[]> {
    return db.select().from(dripCampaigns).orderBy(desc(dripCampaigns.createdAt));
  }

  async getDripCampaign(id: string): Promise<DripCampaign | undefined> {
    const [campaign] = await db.select().from(dripCampaigns).where(eq(dripCampaigns.id, id));
    return campaign;
  }

  async createDripCampaign(campaign: InsertDripCampaign): Promise<DripCampaign> {
    const [created] = await db.insert(dripCampaigns).values(campaign).returning();
    return created;
  }

  async updateDripCampaign(id: string, data: Partial<InsertDripCampaign>): Promise<DripCampaign> {
    const [updated] = await db.update(dripCampaigns).set(data).where(eq(dripCampaigns.id, id)).returning();
    return updated;
  }

  async deleteDripCampaign(id: string): Promise<void> {
    await db.delete(dripSteps).where(eq(dripSteps.campaignId, id));
    await db.delete(dripCampaigns).where(eq(dripCampaigns.id, id));
  }

  async getDripSteps(campaignId: string): Promise<DripStep[]> {
    return db.select().from(dripSteps)
      .where(eq(dripSteps.campaignId, campaignId))
      .orderBy(asc(dripSteps.stepOrder));
  }

  async createDripStep(step: InsertDripStep): Promise<DripStep> {
    const [created] = await db.insert(dripSteps).values(step).returning();
    return created;
  }

  async updateDripStep(id: string, data: Partial<InsertDripStep>): Promise<DripStep> {
    const [updated] = await db.update(dripSteps).set(data).where(eq(dripSteps.id, id)).returning();
    return updated;
  }

  async deleteDripStep(id: string): Promise<void> {
    await db.delete(dripSteps).where(eq(dripSteps.id, id));
  }

  async getDripEnrollments(campaignId?: string): Promise<DripEnrollment[]> {
    if (campaignId) {
      return db.select().from(dripEnrollments)
        .where(eq(dripEnrollments.campaignId, campaignId))
        .orderBy(desc(dripEnrollments.enrolledAt));
    }
    return db.select().from(dripEnrollments).orderBy(desc(dripEnrollments.enrolledAt));
  }

  // All enrollments for a person, matched by their (denormalized) email. Used to
  // surface a CRM client's live campaigns — crm_clients has no FK to prospects,
  // so email is the only bridge into the drip world.
  async getDripEnrollmentsByEmail(email: string): Promise<DripEnrollment[]> {
    return db.select().from(dripEnrollments)
      .where(sql`lower(${dripEnrollments.prospectEmail}) = ${email.toLowerCase()}`)
      .orderBy(desc(dripEnrollments.enrolledAt));
  }

  async getDripEnrollment(id: string): Promise<DripEnrollment | undefined> {
    const [enrollment] = await db.select().from(dripEnrollments).where(eq(dripEnrollments.id, id));
    return enrollment;
  }

  async createDripEnrollment(enrollment: InsertDripEnrollment): Promise<DripEnrollment> {
    const [created] = await db.insert(dripEnrollments).values(enrollment).returning();
    return created;
  }

  async updateDripEnrollment(id: string, data: Partial<DripEnrollment>): Promise<DripEnrollment> {
    const [updated] = await db.update(dripEnrollments).set(data).where(eq(dripEnrollments.id, id)).returning();
    return updated;
  }

  async getActiveEnrollments(campaignId?: string): Promise<DripEnrollment[]> {
    const where = campaignId
      ? and(eq(dripEnrollments.status, "active"), eq(dripEnrollments.campaignId, campaignId))
      : eq(dripEnrollments.status, "active");
    return db.select().from(dripEnrollments)
      .where(where)
      .orderBy(asc(dripEnrollments.enrolledAt));
  }

  async getDripSends(enrollmentId?: string): Promise<DripSend[]> {
    if (enrollmentId) {
      return db.select().from(dripSends)
        .where(eq(dripSends.enrollmentId, enrollmentId))
        .orderBy(desc(dripSends.createdAt));
    }
    return db.select().from(dripSends).orderBy(desc(dripSends.createdAt));
  }

  async getAllDripSends(): Promise<DripSend[]> {
    return db.select().from(dripSends).orderBy(desc(dripSends.createdAt));
  }

  /**
   * Count campaign emails actually SENT since `since`. Backs the drip
   * processor's daily + hourly throttles so they survive process restarts
   * (Railway redeploys) rather than resetting an in-memory counter.
   */
  async countSentEmailsSince(since: Date): Promise<number> {
    const [row] = await db.select({ n: sql<number>`count(*)` })
      .from(dripSends)
      .where(and(
        eq(dripSends.channel, "email"),
        eq(dripSends.status, "sent"),
        gte(dripSends.sentAt, since),
      ));
    return Number(row?.n ?? 0);
  }

  async getDripSendsByCampaign(campaignId: string): Promise<DripSend[]> {
    // Resolve the campaign's enrollment ids, then fetch their sends. Avoids any
    // ambiguity about Drizzle's joined-result key shape.
    const enr = await db.select({ id: dripEnrollments.id }).from(dripEnrollments)
      .where(eq(dripEnrollments.campaignId, campaignId));
    const ids = enr.map((e) => e.id);
    if (ids.length === 0) return [];
    return db.select().from(dripSends)
      .where(inArray(dripSends.enrollmentId, ids))
      .orderBy(desc(dripSends.createdAt));
  }

  // Lowercased sender addresses of every inbound (synced) reply — used to count
  // campaign replies by intersecting with enrolled prospect emails.
  async getInboundReplyAddresses(): Promise<string[]> {
    const rows = await db.select({ from: crmDirectEmails.fromEmail }).from(crmDirectEmails)
      .where(eq(crmDirectEmails.direction, "inbound"));
    return rows.map((r) => (r.from || "").toLowerCase());
  }

  async getDripSend(id: string): Promise<DripSend | undefined> {
    const [send] = await db.select().from(dripSends).where(eq(dripSends.id, id));
    return send;
  }

  async createDripSend(send: InsertDripSend): Promise<DripSend> {
    const [created] = await db.insert(dripSends).values(send).returning();
    return created;
  }

  async updateDripSend(id: string, data: Partial<DripSend>): Promise<DripSend> {
    const [updated] = await db.update(dripSends).set(data).where(eq(dripSends.id, id)).returning();
    return updated;
  }

  async deleteDripSend(id: string): Promise<void> {
    await db.delete(dripSends).where(eq(dripSends.id, id));
  }

  async getFacebookPosts(): Promise<FacebookPost[]> {
    return db.select().from(facebookPosts).orderBy(desc(facebookPosts.createdAt));
  }

  async getFacebookPost(id: string): Promise<FacebookPost | undefined> {
    const [post] = await db.select().from(facebookPosts).where(eq(facebookPosts.id, id));
    return post;
  }

  async createFacebookPost(post: InsertFacebookPost): Promise<FacebookPost> {
    const [created] = await db.insert(facebookPosts).values(post).returning();
    return created;
  }

  async updateFacebookPost(id: string, data: Partial<InsertFacebookPost & { postedAt: Date; facebookPostId: string; errorMessage: string }>): Promise<FacebookPost> {
    const [updated] = await db.update(facebookPosts).set(data).where(eq(facebookPosts.id, id)).returning();
    return updated;
  }

  async deleteFacebookPost(id: string): Promise<void> {
    await db.delete(facebookPosts).where(eq(facebookPosts.id, id));
  }

  async getScheduledFacebookPosts(): Promise<FacebookPost[]> {
    return db.select().from(facebookPosts)
      .where(eq(facebookPosts.status, "scheduled"))
      .orderBy(asc(facebookPosts.scheduledFor));
  }

  async recordEmailOpen(sendId: string): Promise<DripSend | undefined> {
    const [updated] = await db.update(dripSends)
      .set({
        openedAt: sql`COALESCE(${dripSends.openedAt}, NOW())`,
        openCount: sql`${dripSends.openCount} + 1`,
      })
      .where(eq(dripSends.id, sendId))
      .returning();
    return updated;
  }

  async recordEmailClick(sendId: string): Promise<DripSend | undefined> {
    // A click implies an open — set both so opens are never undercounted.
    const [updated] = await db.update(dripSends)
      .set({
        clickedAt: sql`COALESCE(${dripSends.clickedAt}, NOW())`,
        clickCount: sql`${dripSends.clickCount} + 1`,
        openedAt: sql`COALESCE(${dripSends.openedAt}, NOW())`,
      })
      .where(eq(dripSends.id, sendId))
      .returning();
    return updated;
  }

  // Scanner/bot hits (see server/tracking-bot-filter.ts) — counted separately so
  // openedAt/clickedAt + openCount/clickCount always mean a human engaged.
  async recordBotEmailOpen(sendId: string): Promise<void> {
    await db.update(dripSends)
      .set({ botOpenCount: sql`${dripSends.botOpenCount} + 1` })
      .where(eq(dripSends.id, sendId));
  }

  async recordBotEmailClick(sendId: string): Promise<void> {
    // A bot that clicked also fetched the message — still only bot counters.
    await db.update(dripSends)
      .set({
        botClickCount: sql`${dripSends.botClickCount} + 1`,
        botOpenCount: sql`${dripSends.botOpenCount} + 1`,
      })
      .where(eq(dripSends.id, sendId));
  }

  // Unsubscribe write-through: stop every live enrollment for this address so the
  // drip halts immediately and the campaign UI shows WHY (not just "bounced").
  async markEnrollmentsUnsubscribed(email: string): Promise<number> {
    const rows = await db.update(dripEnrollments)
      .set({ status: "unsubscribed" })
      .where(and(
        sql`lower(${dripEnrollments.prospectEmail}) = ${email.toLowerCase()}`,
        eq(dripEnrollments.status, "active"),
      ))
      .returning({ id: dripEnrollments.id });
    return rows.length;
  }

  async markDripSendBounced(recipientEmail: string, reason: string): Promise<DripSend | null> {
    // A bounce NDR arrives asynchronously (minutes after Gmail accepted the
    // message), so flip the most recent delivered send to this address from
    // "sent" → "bounced" and store the reason. Falls back to the newest send.
    const rows = await db.select().from(dripSends)
      .where(eq(dripSends.recipientEmail, recipientEmail))
      .orderBy(desc(dripSends.sentAt));
    if (rows.length === 0) return null;
    const target = rows.find((r) => r.status === "sent" || r.status === "pending") || rows[0];
    if (target.status === "bounced") return null; // already recorded
    const [updated] = await db.update(dripSends)
      .set({ status: "bounced", errorMessage: reason.slice(0, 500) })
      .where(eq(dripSends.id, target.id))
      .returning();
    return updated ?? target;
  }

  async getSmsCampaigns(): Promise<SmsCampaign[]> {
    return db.select().from(smsCampaigns).orderBy(desc(smsCampaigns.createdAt));
  }
  async createSmsCampaign(data: InsertSmsCampaign): Promise<SmsCampaign> {
    const [created] = await db.insert(smsCampaigns).values(data).returning();
    return created;
  }
  async updateSmsCampaign(id: string, data: Partial<SmsCampaign>): Promise<SmsCampaign> {
    const [updated] = await db.update(smsCampaigns).set(data).where(eq(smsCampaigns.id, id)).returning();
    return updated;
  }
  async deleteSmsCampaign(id: string): Promise<void> {
    await db.delete(smsCampaigns).where(eq(smsCampaigns.id, id));
  }

  async getWhatsappCampaigns(): Promise<WhatsappCampaign[]> {
    return db.select().from(whatsappCampaigns).orderBy(desc(whatsappCampaigns.createdAt));
  }
  async createWhatsappCampaign(data: InsertWhatsappCampaign): Promise<WhatsappCampaign> {
    const [created] = await db.insert(whatsappCampaigns).values(data).returning();
    return created;
  }
  async updateWhatsappCampaign(id: string, data: Partial<WhatsappCampaign>): Promise<WhatsappCampaign> {
    const [updated] = await db.update(whatsappCampaigns).set(data).where(eq(whatsappCampaigns.id, id)).returning();
    return updated;
  }
  async deleteWhatsappCampaign(id: string): Promise<void> {
    await db.delete(whatsappCampaigns).where(eq(whatsappCampaigns.id, id));
  }

  // ─── Attorney CRM: Contacts ──────────────────────────────────────────────

  async getContacts(filters?: {
    search?: string;
    status?: string[];
    country?: string[];
    personaType?: string[];
    minScore?: number;
    maxScore?: number;
    source?: string[];
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ contacts: Contact[]; total: number }> {
    let query = db.select().from(contacts).$dynamic();
    const conditions: ReturnType<typeof eq>[] = [];

    if (filters?.search) {
      const s = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(contacts.firstName, s),
          ilike(contacts.lastName, s),
          ilike(contacts.email, s),
          ilike(contacts.firmName, s),
          ilike(contacts.country, s),
        ) as ReturnType<typeof eq>
      );
    }
    if (filters?.status?.length) {
      conditions.push(inArray(contacts.status, filters.status) as ReturnType<typeof eq>);
    }
    if (filters?.country?.length) {
      conditions.push(inArray(contacts.country, filters.country) as ReturnType<typeof eq>);
    }
    if (filters?.personaType?.length) {
      conditions.push(inArray(contacts.personaType, filters.personaType) as ReturnType<typeof eq>);
    }
    if (filters?.source?.length) {
      conditions.push(inArray(contacts.source, filters.source) as ReturnType<typeof eq>);
    }
    if (filters?.minScore !== undefined) {
      conditions.push(gte(contacts.leadScore, filters.minScore) as ReturnType<typeof eq>);
    }
    if (filters?.maxScore !== undefined) {
      conditions.push(lte(contacts.leadScore, filters.maxScore) as ReturnType<typeof eq>);
    }

    if (conditions.length) {
      query = query.where(and(...conditions) as ReturnType<typeof eq>);
    }

    const allRows = await query.orderBy(desc(contacts.createdAt));
    const total = allRows.length;
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 50;
    return { contacts: allRows.slice(offset, offset + limit), total };
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
    return c;
  }

  // Mirror a CRM contact into a prospect (campaigns enroll prospects, not contacts).
  // Matches an existing prospect by email (preferred), else by name + company.
  async findOrCreateProspectForContact(contact: Contact): Promise<Prospect> {
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || contact.firstName || "Unknown";
    if (contact.email) {
      const [byEmail] = await db.select().from(prospects)
        .where(sql`lower(${prospects.email}) = ${contact.email.toLowerCase()}`).limit(1);
      if (byEmail) return byEmail;
    } else {
      // Match on company correctly whether it's set or NULL (eq(col, "") never matches NULL).
      const companyCond = contact.firmName
        ? eq(prospects.company, contact.firmName)
        : isNull(prospects.company);
      const [byName] = await db.select().from(prospects)
        .where(and(eq(prospects.name, name), companyCond)).limit(1);
      if (byName) return byName;
    }
    return this.createProspect({
      name,
      company: contact.firmName ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      website: contact.websiteUrl ?? null,
      category: contact.personaType || "Referral Partner",
      location: contact.city || contact.country || "International",
      source: contact.source || "contact",
      notes: contact.notes ?? null,
    } as InsertProspect);
  }

  async findOrCreateProspectForClient(client: CrmClient): Promise<Prospect> {
    const name = (client.fullName || "").trim() || "Unknown";
    if (client.email) {
      const [byEmail] = await db.select().from(prospects)
        .where(sql`lower(${prospects.email}) = ${client.email.toLowerCase()}`).limit(1);
      if (byEmail) return byEmail;
    }
    return this.createProspect({
      name,
      company: client.companyName ?? null,
      email: client.email ?? null,
      phone: client.phone ?? null,
      website: null,
      category: client.profession || "CRM Client",
      location: client.country || "International",
      source: client.leadSource || "crm_client",
    } as InsertProspect);
  }

  async getContactByEmail(email: string): Promise<Contact | undefined> {
    // Case-insensitive: emails are matched lower-cased everywhere (inbox sync
    // lowercases the sender), so a verbatim-cased stored address still resolves.
    const [c] = await db.select().from(contacts)
      .where(sql`lower(${contacts.email}) = ${(email || "").toLowerCase()}`).limit(1);
    return c;
  }

  // Mirror a prospect into a CRM contact (the reverse of findOrCreateProspectForContact)
  // so an inbound reply from a cold prospect can be logged + surfaced in the
  // campaign Activity feed. Idempotent: matches an existing contact by email first.
  async findOrCreateContactForProspect(prospect: Prospect): Promise<Contact> {
    const email = prospect.email?.trim().toLowerCase() || null;
    if (email) {
      const [byEmail] = await db.select().from(contacts)
        .where(sql`lower(${contacts.email}) = ${email}`).limit(1);
      if (byEmail) return byEmail;
    }
    // Phone-only prospects have no unique email key — NULL emails are all
    // distinct under the UNIQUE index, so without a phone match we'd create a
    // fresh contact (and duplicate its reply) on every inbound SMS. Dedupe on
    // the normalized last-10 phone instead.
    const last10 = (prospect.phone || "").replace(/\D/g, "").slice(-10);
    if (!email && last10.length === 10) {
      const [byPhone] = await db.select().from(contacts)
        .where(sql`right(regexp_replace(coalesce(${contacts.phone}, ''), '[^0-9]', '', 'g'), 10) = ${last10}`)
        .limit(1);
      if (byPhone) return byPhone;
    }
    const parts = (prospect.name || "").trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || prospect.name?.trim() || "Unknown";
    const lastName = parts.slice(1).join(" ");
    try {
      return await this.createContact({
        firstName,
        lastName,
        email, // store lower-cased so the case-sensitive UNIQUE(email) index lines up with our lookups
        phone: prospect.phone ?? null,
        firmName: prospect.company ?? null,
        websiteUrl: prospect.website ?? null,
        source: prospect.source || "prospect-reply",
        status: "new",
      } as InsertContact);
    } catch (e: any) {
      // Lost a concurrent insert race on the unique email — return the winner.
      if (email && e?.code === "23505") {
        const [byEmail] = await db.select().from(contacts)
          .where(sql`lower(${contacts.email}) = ${email}`).limit(1);
        if (byEmail) return byEmail;
      }
      throw e;
    }
  }

  async createContact(data: InsertContact & { leadScore?: number }): Promise<Contact> {
    const [c] = await db.insert(contacts).values(data).returning();
    return c;
  }

  async updateContact(id: string, data: Partial<InsertContact> & { leadScore?: number }): Promise<Contact> {
    const [c] = await db
      .update(contacts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return c;
  }

  async deleteContact(id: string): Promise<void> {
    await db.update(contacts).set({ status: "archived" as string, updatedAt: new Date() }).where(eq(contacts.id, id));
  }

  async getAllContactsRaw(): Promise<Contact[]> {
    return db.select().from(contacts).orderBy(desc(contacts.createdAt));
  }

  async bulkUpdateContactTags(ids: string[], tags: string[]): Promise<void> {
    for (const id of ids) {
      const [c] = await db.select().from(contacts).where(eq(contacts.id, id));
      if (c) {
        const merged = Array.from(new Set([...(c.tags || []), ...tags]));
        await db.update(contacts).set({ tags: merged, updatedAt: new Date() }).where(eq(contacts.id, id));
      }
    }
  }

  async bulkUpdateContactStatus(ids: string[], status: string): Promise<void> {
    for (const id of ids) {
      await db.update(contacts).set({ status, updatedAt: new Date() }).where(eq(contacts.id, id));
    }
  }

  // ─── Contact Activities ──────────────────────────────────────────────────

  async getContactActivities(contactId: string): Promise<ContactActivity[]> {
    return db
      .select()
      .from(contactActivities)
      .where(eq(contactActivities.contactId, contactId))
      .orderBy(desc(contactActivities.createdAt));
  }

  async createContactActivity(data: InsertContactActivity): Promise<ContactActivity> {
    const [a] = await db.insert(contactActivities).values(data).returning();
    return a;
  }

  // Recent contact-level touches (manual email/SMS/WhatsApp/call/note, inbound email,
  // LinkedIn, status changes …) joined to the contact's name — feeds the Activity tab.
  async getRecentContactActivities(limit = 400): Promise<Array<{
    id: string; contactId: string; activityType: string; metadata: any;
    createdAt: Date; name: string | null; email: string | null;
  }>> {
    const rows = await db
      .select({
        id: contactActivities.id,
        contactId: contactActivities.contactId,
        activityType: contactActivities.activityType,
        metadata: contactActivities.metadata,
        createdAt: contactActivities.createdAt,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
      })
      .from(contactActivities)
      .leftJoin(contacts, eq(contactActivities.contactId, contacts.id))
      .orderBy(desc(contactActivities.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      contactId: r.contactId,
      activityType: r.activityType,
      metadata: r.metadata,
      createdAt: r.createdAt,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
      email: r.email,
    }));
  }

  // Recent investor-CRM client touches (email/SMS/WhatsApp/voicemail/notes/signatures …)
  // joined to the client's name — also feeds the Activity tab.
  async getRecentCrmClientActivities(limit = 400): Promise<Array<{
    id: string; clientId: string; activityType: string; metadata: any;
    createdAt: Date; name: string | null; email: string | null;
  }>> {
    return db
      .select({
        id: crmClientActivities.id,
        clientId: crmClientActivities.clientId,
        activityType: crmClientActivities.activityType,
        metadata: crmClientActivities.metadata,
        createdAt: crmClientActivities.createdAt,
        name: crmClients.fullName,
        email: crmClients.email,
      })
      .from(crmClientActivities)
      .leftJoin(crmClients, eq(crmClientActivities.clientId, crmClients.id))
      .orderBy(desc(crmClientActivities.createdAt))
      .limit(limit);
  }

  // Inbound reply/received touches for a set of emails (case-insensitive), with
  // no global recency cap. Powers the per-campaign Activity feed so a campaign's
  // replies are complete even when older than the global "recent activity" window.
  private static readonly INBOUND_REPLY_TYPES = [
    "email_received", "email_reply", "sms_received", "whatsapp_received",
  ];

  async getInboundContactActivitiesByEmails(emails: string[]): Promise<Array<{
    id: string; contactId: string; activityType: string; metadata: any;
    createdAt: Date; name: string | null; email: string | null;
  }>> {
    const lower = Array.from(new Set(emails.map((e) => (e || "").trim().toLowerCase()).filter(Boolean)));
    if (lower.length === 0) return [];
    const rows = await db
      .select({
        id: contactActivities.id,
        contactId: contactActivities.contactId,
        activityType: contactActivities.activityType,
        metadata: contactActivities.metadata,
        createdAt: contactActivities.createdAt,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
      })
      .from(contactActivities)
      .innerJoin(contacts, eq(contactActivities.contactId, contacts.id))
      .where(and(
        inArray(contactActivities.activityType, DatabaseStorage.INBOUND_REPLY_TYPES),
        inArray(sql`lower(${contacts.email})`, lower),
      ))
      .orderBy(desc(contactActivities.createdAt))
      .limit(1000);
    return rows.map((r) => ({
      id: r.id,
      contactId: r.contactId,
      activityType: r.activityType,
      metadata: r.metadata,
      createdAt: r.createdAt,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
      email: r.email,
    }));
  }

  async getInboundCrmClientActivitiesByEmails(emails: string[]): Promise<Array<{
    id: string; clientId: string; activityType: string; metadata: any;
    createdAt: Date; name: string | null; email: string | null;
  }>> {
    const lower = Array.from(new Set(emails.map((e) => (e || "").trim().toLowerCase()).filter(Boolean)));
    if (lower.length === 0) return [];
    return db
      .select({
        id: crmClientActivities.id,
        clientId: crmClientActivities.clientId,
        activityType: crmClientActivities.activityType,
        metadata: crmClientActivities.metadata,
        createdAt: crmClientActivities.createdAt,
        name: crmClients.fullName,
        email: crmClients.email,
      })
      .from(crmClientActivities)
      .innerJoin(crmClients, eq(crmClientActivities.clientId, crmClients.id))
      .where(and(
        inArray(crmClientActivities.activityType, DatabaseStorage.INBOUND_REPLY_TYPES),
        inArray(sql`lower(${crmClients.email})`, lower),
      ))
      .orderBy(desc(crmClientActivities.createdAt))
      .limit(1000);
  }

  // ─── Contact Tasks ────────────────────────────────────────────────────────

  async getAllTasks(): Promise<ContactTask[]> {
    return db.select().from(contactTasks).orderBy(asc(contactTasks.dueDate));
  }

  async getContactTasks(contactId: string): Promise<ContactTask[]> {
    return db
      .select()
      .from(contactTasks)
      .where(eq(contactTasks.contactId, contactId))
      .orderBy(asc(contactTasks.dueDate));
  }

  async createContactTask(data: InsertContactTask): Promise<ContactTask> {
    const [t] = await db.insert(contactTasks).values(data).returning();
    return t;
  }

  async updateContactTask(id: string, data: Partial<ContactTask>): Promise<ContactTask> {
    const [t] = await db.update(contactTasks).set(data).where(eq(contactTasks.id, id)).returning();
    return t;
  }

  async deleteContactTask(id: string): Promise<void> {
    await db.delete(contactTasks).where(eq(contactTasks.id, id));
  }

  // ─── Pipeline Deals ───────────────────────────────────────────────────────

  async getPipelineDeals(): Promise<(PipelineDeal & { contact: Contact | null })[]> {
    const deals = await db.select().from(pipelineDeals).orderBy(desc(pipelineDeals.movedAt));
    const result = [];
    for (const deal of deals) {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, deal.contactId));
      result.push({ ...deal, contact: contact || null });
    }
    return result;
  }

  async getPipelineDealByContact(contactId: string): Promise<PipelineDeal | undefined> {
    const [deal] = await db.select().from(pipelineDeals).where(eq(pipelineDeals.contactId, contactId));
    return deal;
  }

  async upsertPipelineDeal(contactId: string, stage: string, notes?: string): Promise<PipelineDeal> {
    const existing = await this.getPipelineDealByContact(contactId);
    if (existing) {
      const [updated] = await db
        .update(pipelineDeals)
        .set({ stage, notes: notes ?? existing.notes, movedAt: new Date() })
        .where(eq(pipelineDeals.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(pipelineDeals)
      .values({ contactId, stage, notes })
      .returning();
    return created;
  }

  async deletePipelineDeal(id: string): Promise<void> {
    await db.delete(pipelineDeals).where(eq(pipelineDeals.id, id));
  }

  // ─── Saved Segments ───────────────────────────────────────────────────────

  async getSavedSegments(): Promise<SavedSegment[]> {
    return db.select().from(savedSegments).orderBy(desc(savedSegments.createdAt));
  }

  async createSavedSegment(data: InsertSavedSegment): Promise<SavedSegment> {
    const [s] = await db.insert(savedSegments).values(data).returning();
    return s;
  }

  async deleteSavedSegment(id: string): Promise<void> {
    await db.delete(savedSegments).where(eq(savedSegments.id, id));
  }

  async touchSavedSegment(id: string): Promise<void> {
    await db.update(savedSegments).set({ lastUsedAt: new Date() }).where(eq(savedSegments.id, id));
  }

  // ─── Email Templates ──────────────────────────────────────────────────────

  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return db.select().from(emailTemplates).orderBy(desc(emailTemplates.createdAt));
  }

  async createEmailTemplate(data: InsertEmailTemplate): Promise<EmailTemplate> {
    const [t] = await db.insert(emailTemplates).values(data).returning();
    return t;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  }

  // ─── CRM Client Activities ─────────────────────────────────────────────────

  async getCrmClientActivities(clientId: string): Promise<CrmClientActivity[]> {
    return db.select().from(crmClientActivities)
      .where(eq(crmClientActivities.clientId, clientId))
      .orderBy(desc(crmClientActivities.createdAt));
  }

  async createCrmClientActivity(data: InsertCrmClientActivity): Promise<CrmClientActivity> {
    const [act] = await db.insert(crmClientActivities).values(data).returning();
    return act;
  }

  // ─── CRM Client Documents ──────────────────────────────────────────────────

  async getCrmClientDocuments(clientId: string): Promise<Omit<CrmClientDocument, "fileData">[]> {
    const docs = await db.select().from(crmClientDocuments)
      .where(eq(crmClientDocuments.clientId, clientId))
      .orderBy(desc(crmClientDocuments.createdAt));
    return docs.map(({ fileData: _fd, ...rest }) => rest);
  }

  async getCrmClientDocument(id: string): Promise<CrmClientDocument | undefined> {
    const [doc] = await db.select().from(crmClientDocuments).where(eq(crmClientDocuments.id, id));
    return doc;
  }

  async createCrmClientDocument(data: { clientId: string; fileName: string; fileType: string; fileSize: number; fileData: string }): Promise<Omit<CrmClientDocument, "fileData">> {
    const [doc] = await db.insert(crmClientDocuments).values(data).returning();
    const { fileData: _fd, ...rest } = doc;
    return rest;
  }

  async deleteCrmClientDocument(id: string): Promise<void> {
    await db.delete(crmClientDocuments).where(eq(crmClientDocuments.id, id));
  }

  async getCrmClientByEmail(email: string): Promise<CrmClient | undefined> {
    const [client] = await db.select().from(crmClients)
      .where(sql`lower(${crmClients.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return client;
  }

  async getCrmDirectEmails(clientId: string): Promise<CrmDirectEmail[]> {
    return db.select().from(crmDirectEmails)
      .where(eq(crmDirectEmails.clientId, clientId))
      .orderBy(desc(crmDirectEmails.sentAt));
  }

  async getCrmDirectEmailByMessageId(messageId: string): Promise<CrmDirectEmail | undefined> {
    const [email] = await db.select().from(crmDirectEmails)
      .where(eq(crmDirectEmails.messageId, messageId))
      .limit(1);
    return email;
  }

  async createCrmDirectEmail(data: { clientId: string; fromEmail: string; fromName: string; toEmail: string; subject: string; bodyHtml: string; bodyText?: string; trackingId?: string; direction?: "inbound" | "outbound"; messageId?: string; status?: string }): Promise<CrmDirectEmail> {
    const direction = data.direction ?? "outbound";
    const [email] = await db.insert(crmDirectEmails).values({
      clientId: data.clientId,
      fromEmail: data.fromEmail,
      fromName: data.fromName,
      toEmail: data.toEmail,
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      bodyText: data.bodyText,
      trackingId: data.trackingId,
      direction,
      messageId: data.messageId,
      status: data.status ?? (direction === "inbound" ? "received" : "sent"),
    }).returning();
    // Touch lastContactedAt on the client for either direction.
    await db.update(crmClients)
      .set({ lastContactedAt: new Date(), lastContactMethod: "email", updatedAt: new Date() })
      .where(eq(crmClients.id, data.clientId));
    return email;
  }

  async recordDirectEmailOpen(trackingId: string): Promise<void> {
    const [existing] = await db.select().from(crmDirectEmails)
      .where(eq(crmDirectEmails.trackingId, trackingId));
    if (!existing) return;
    await db.update(crmDirectEmails)
      .set({
        openedAt: existing.openedAt || new Date(),
        openCount: (existing.openCount || 0) + 1,
        status: "opened",
      })
      .where(eq(crmDirectEmails.trackingId, trackingId));
  }

  async recordDirectEmailClick(trackingId: string): Promise<void> {
    const [existing] = await db.select().from(crmDirectEmails)
      .where(eq(crmDirectEmails.trackingId, trackingId));
    if (!existing) return;
    await db.update(crmDirectEmails)
      .set({
        clickedAt: existing.clickedAt || new Date(),
        clickCount: (existing.clickCount || 0) + 1,
        openedAt: existing.openedAt || new Date(),
        status: "opened",
      })
      .where(eq(crmDirectEmails.trackingId, trackingId));
  }

  async getSignatureRequests(clientId: string): Promise<SignatureRequest[]> {
    return db.select().from(signatureRequests)
      .where(eq(signatureRequests.clientId, clientId))
      .orderBy(desc(signatureRequests.createdAt));
  }

  async getSignatureRequestByToken(token: string): Promise<SignatureRequest | undefined> {
    const [req] = await db.select().from(signatureRequests)
      .where(eq(signatureRequests.token, token));
    return req;
  }

  async createSignatureRequest(data: { clientId: string; documentType: string; token: string; sentToEmail: string }): Promise<SignatureRequest> {
    const [req] = await db.insert(signatureRequests).values(data).returning();
    return req;
  }

  async completeSignature(token: string, signerName: string, signerIp: string, signatureData: string): Promise<SignatureRequest | undefined> {
    const [updated] = await db.update(signatureRequests)
      .set({ signedAt: new Date(), signerName, signerIp, signatureData })
      .where(eq(signatureRequests.token, token))
      .returning();
    return updated;
  }

  async getPhoneCalls(opts?: { limit?: number; offset?: number }): Promise<PhoneCall[]> {
    let q = db.select().from(phoneCalls).orderBy(desc(phoneCalls.openphoneCreatedAt));
    if (opts?.limit) (q as any).limit(opts.limit);
    if (opts?.offset) (q as any).offset(opts.offset);
    return q;
  }

  async upsertPhoneCall(data: Partial<PhoneCall> & { id: string; direction: string; fromNumber: string; toNumber: string; status: string }): Promise<PhoneCall> {
    const [row] = await db.insert(phoneCalls)
      .values({ ...data, syncedAt: new Date() })
      .onConflictDoUpdate({ target: phoneCalls.id, set: { ...data, syncedAt: new Date() } })
      .returning();
    return row;
  }

  async updatePhoneCall(id: string, data: Partial<PhoneCall>): Promise<PhoneCall | undefined> {
    const [row] = await db.update(phoneCalls).set(data).where(eq(phoneCalls.id, id)).returning();
    return row;
  }

  async getPhoneCallByExternalId(id: string): Promise<PhoneCall | undefined> {
    const [row] = await db.select().from(phoneCalls).where(eq(phoneCalls.id, id));
    return row;
  }
}

export const storage = new DatabaseStorage();
