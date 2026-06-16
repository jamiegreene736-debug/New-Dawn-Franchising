import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, json, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  country: text("country"),
  timeline: text("timeline"),
  capitalRange: text("capital_range"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
});

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  coverImageUrl: text("cover_image_url"),
  generatedByAi: text("generated_by_ai").default("true"),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
});

export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

export const brokers = pgTable("brokers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  company: text("company"),
  passwordHash: text("password_hash").notNull(),
  agreementSigned: boolean("agreement_signed").default(false).notNull(),
  agreementSignedAt: timestamp("agreement_signed_at"),
  agreementPdf: text("agreement_pdf"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBrokerSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  company: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type Broker = typeof brokers.$inferSelect;
export type InsertBroker = z.infer<typeof insertBrokerSchema>;

export const brokerClients = pgTable("broker_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brokerId: varchar("broker_id").notNull().references(() => brokers.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  importedAt: timestamp("imported_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBrokerClientSchema = createInsertSchema(brokerClients).omit({
  id: true,
  brokerId: true,
  createdAt: true,
});

export type BrokerClient = typeof brokerClients.$inferSelect;
export type InsertBrokerClient = z.infer<typeof insertBrokerClientSchema>;

export const crmClients = pgTable("crm_clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  country: text("country"),
  address: text("address"),
  status: text("status").notNull().default("new"),
  fddSent: boolean("fdd_sent").default(false).notNull(),
  receiptSigned: boolean("receipt_signed").default(false).notNull(),
  brokerId: varchar("broker_id").references(() => brokers.id),
  notes: text("notes"),
  lastContactedAt: timestamp("last_contacted_at"),
  lastContactMethod: text("last_contact_method"),
  // Richer profile fields
  investmentAmount: text("investment_amount"),
  citizenship: text("citizenship"),
  visaType: text("visa_type"),
  languagePreference: text("language_preference"),
  linkedinUrl: text("linkedin_url"),
  leadSource: text("lead_source"),
  companyName: text("company_name"),
  profession: text("profession"),
  leadTemperature: text("lead_temperature"),
  tags: text("tags").array().default([]),
  // ── Seamless enrichment: the FULL raw research payload (nothing lost) plus
  // promoted columns for the high-value fields we display / filter on. ──
  enrichmentJson: jsonb("enrichment_json"),       // complete Seamless contact payload
  enrichmentSource: text("enrichment_source"),    // e.g. "seamless"
  enrichedAt: timestamp("enriched_at"),
  email2: text("email2"),
  email3: text("email3"),
  emailConfidence: integer("email_confidence"),
  phone2: text("phone2"),
  phoneType: text("phone_type"),                  // mobile / direct / …
  seniority: text("seniority"),
  department: text("department"),
  contactCity: text("contact_city"),
  contactState: text("contact_state"),
  companyDomain: text("company_domain"),
  companyWebsite: text("company_website"),
  companyIndustry: text("company_industry"),
  companyStaffCount: integer("company_staff_count"),
  companyStaffRange: text("company_staff_range"),
  companyRevenue: text("company_revenue"),        // range, e.g. "$20M - $50M"
  companyRevenueExact: text("company_revenue_exact"),
  companyFounded: text("company_founded"),
  companyType: text("company_type"),
  companyDescription: text("company_description"),
  companyLinkedinUrl: text("company_linkedin_url"),
  companyFundingTotal: text("company_funding_total"),
  companyCity: text("company_city"),
  companyState: text("company_state"),
  companyCountry: text("company_country"),
  timeAtCompany: text("time_at_company"),
  startedAtCurrentCompany: text("started_at_current_company"),
  jobChangeAlert: text("job_change_alert"),       // "New Hire" | "New Promotion"
  stockTicker: text("stock_ticker"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCrmClientSchema = createInsertSchema(crmClients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CrmClient = typeof crmClients.$inferSelect;
export type InsertCrmClient = z.infer<typeof insertCrmClientSchema>;

// Activity timeline for investor CRM clients
export const crmClientActivities = pgTable("crm_client_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => crmClients.id),
  activityType: text("activity_type").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCrmClientActivitySchema = createInsertSchema(crmClientActivities).omit({
  id: true,
  createdAt: true,
});

export type CrmClientActivity = typeof crmClientActivities.$inferSelect;
export type InsertCrmClientActivity = z.infer<typeof insertCrmClientActivitySchema>;

// Document uploads for investor CRM clients
export const crmClientDocuments = pgTable("crm_client_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => crmClients.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileData: text("file_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CrmClientDocument = typeof crmClientDocuments.$inferSelect;

// ─── Direct CRM Emails ───────────────────────────────────────────────────────
export const crmDirectEmails = pgTable("crm_direct_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => crmClients.id),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  status: text("status").notNull().default("sent"),
  openedAt: timestamp("opened_at"),
  openCount: integer("open_count").default(0).notNull(),
  clickedAt: timestamp("clicked_at"),
  clickCount: integer("click_count").default(0).notNull(),
  trackingId: varchar("tracking_id", { length: 128 }).unique(),
  // "outbound" (sent from the CRM) or "inbound" (synced from the franchising@ Gmail inbox).
  direction: text("direction").notNull().default("outbound"),
  // Gmail Message-ID header — used to dedupe inbound replies across poll cycles.
  messageId: text("message_id"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CrmDirectEmail = typeof crmDirectEmails.$inferSelect;

// ─── Signature Requests ──────────────────────────────────────────────────────
export const signatureRequests = pgTable("signature_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => crmClients.id),
  documentType: text("document_type").notNull(), // 'fdd_receipt' | 'franchise_agreement'
  token: varchar("token", { length: 128 }).notNull().unique(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  sentToEmail: text("sent_to_email").notNull(),
  signedAt: timestamp("signed_at"),
  signerName: text("signer_name"),
  signerIp: text("signer_ip"),
  signatureData: text("signature_data"), // base64 canvas PNG
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSignatureRequestSchema = createInsertSchema(signatureRequests).omit({
  id: true,
  createdAt: true,
  signedAt: true,
  signerName: true,
  signerIp: true,
  signatureData: true,
});

export type SignatureRequest = typeof signatureRequests.$inferSelect;
export type InsertSignatureRequest = z.infer<typeof insertSignatureRequestSchema>;

export const prospects = pgTable("prospects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  category: text("category").notNull(),
  location: text("location").notNull(),
  source: text("source"),
  sourceUrl: text("source_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProspectSchema = createInsertSchema(prospects).omit({
  id: true,
  createdAt: true,
});

export type Prospect = typeof prospects.$inferSelect;
export type InsertProspect = z.infer<typeof insertProspectSchema>;

export const prospectLists = pgTable("prospect_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProspectListSchema = createInsertSchema(prospectLists).omit({ id: true, createdAt: true });
export type ProspectList = typeof prospectLists.$inferSelect;
export type InsertProspectList = z.infer<typeof insertProspectListSchema>;

export const prospectListMembers = pgTable("prospect_list_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listId: varchar("list_id").notNull().references(() => prospectLists.id, { onDelete: "cascade" }),
  prospectId: varchar("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export type ProspectListMember = typeof prospectListMembers.$inferSelect;

// CRM client lists — named lists of investor CRM clients (crm_clients), the
// counterpart to prospectLists for the lead-research prospects table. Lets the
// CRM tab group selected contacts into reusable lists.
export const crmLists = pgTable("crm_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  // Each CRM list is mirrored into a prospect_list so it can be selected as a
  // campaign audience (campaigns enrol prospects, not CRM clients/contacts).
  prospectListId: varchar("prospect_list_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCrmListSchema = createInsertSchema(crmLists).omit({ id: true, createdAt: true });
export type CrmList = typeof crmLists.$inferSelect;
export type InsertCrmList = z.infer<typeof insertCrmListSchema>;

export const crmListMembers = pgTable("crm_list_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listId: varchar("list_id").notNull().references(() => crmLists.id, { onDelete: "cascade" }),
  // A member is exactly one of: a CRM client, or a contact. `client_id` was the
  // original column; `contact_id` was added so the Contacts tab can build lists too.
  clientId: varchar("client_id").references(() => crmClients.id, { onDelete: "cascade" }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  // The prospect this member was mirrored to in the linked prospect_list. Stored at
  // add-time so removal is exact (re-resolving by identity would mint a fresh,
  // unrelated prospect for email-less people and leave the real one in the campaign).
  prospectId: varchar("prospect_id"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export type CrmListMember = typeof crmListMembers.$inferSelect;

export const dripCampaigns = pgTable("drip_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  // Which audience the campaign's steps speak to: "broker" (referral-partner
  // pitch) or "client" (direct-to-E-2-investor pitch). Drives the Send-now track.
  audienceType: text("audience_type").notNull().default("broker"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDripCampaignSchema = createInsertSchema(dripCampaigns).omit({
  id: true,
  createdAt: true,
});

export type DripCampaign = typeof dripCampaigns.$inferSelect;
export type InsertDripCampaign = z.infer<typeof insertDripCampaignSchema>;

export const dripSteps = pgTable("drip_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => dripCampaigns.id),
  stepOrder: integer("step_order").notNull(),
  delayDays: integer("delay_days").notNull(),
  // Channel for this step. "email"/"manual_email" send mail; "sms" texts via Quo;
  // "call"/"linkedin"/"linkedin_connect"/"linkedin_message"/"task" create to-dos.
  stepType: text("step_type").notNull().default("email"),
  // Display label shown in the sequence builder (e.g. "Automatic Email", "LinkedIn Connect Request").
  stepName: text("step_name"),
  // Optional priority surfaced in the editor: None | Low | Medium | High.
  priority: text("priority"),
  // `subject` is used for email/sms steps ("" for task steps); `bodyHtml` holds the
  // content for every step type (email HTML, SMS text, or task instructions).
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  // ── Automation triggers ──
  // How this step fires: "time" (delayDays, default) or a behavioural signal —
  // "email_opened" | "link_clicked" | "not_opened" | "engaged". Signal steps
  // watch a prior step's send (triggerRefStep = that step's stepOrder; null =
  // the immediately previous step). triggerWindowHours bounds the wait: for
  // not_opened it's how long to wait before firing; for opened/clicked it's how
  // long to wait for the signal before skipping the step.
  triggerType: text("trigger_type").notNull().default("time"),
  triggerRefStep: integer("trigger_ref_step"),
  triggerWindowHours: integer("trigger_window_hours"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDripStepSchema = createInsertSchema(dripSteps).omit({
  id: true,
  createdAt: true,
});

export type DripStep = typeof dripSteps.$inferSelect;
export type InsertDripStep = z.infer<typeof insertDripStepSchema>;

export const dripEnrollments = pgTable("drip_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => dripCampaigns.id),
  prospectId: varchar("prospect_id").notNull().references(() => prospects.id),
  prospectEmail: text("prospect_email").notNull(),
  prospectName: text("prospect_name").notNull(),
  currentStep: integer("current_step").default(0).notNull(),
  status: text("status").notNull().default("active"),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertDripEnrollmentSchema = createInsertSchema(dripEnrollments).omit({
  id: true,
  enrolledAt: true,
  completedAt: true,
});

export type DripEnrollment = typeof dripEnrollments.$inferSelect;
export type InsertDripEnrollment = z.infer<typeof insertDripEnrollmentSchema>;

export const dripSends = pgTable("drip_sends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enrollmentId: varchar("enrollment_id").notNull().references(() => dripEnrollments.id),
  stepId: varchar("step_id").notNull().references(() => dripSteps.id),
  // Outreach channel this send/touch belongs to: email | sms | linkedin | call | task.
  // Lets the unified Activity feed render & filter by channel without a step join.
  channel: text("channel").notNull().default("email"),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  openCount: integer("open_count").default(0).notNull(),
  clickedAt: timestamp("clicked_at"),
  clickCount: integer("click_count").default(0).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDripSendSchema = createInsertSchema(dripSends).omit({
  id: true,
  sentAt: true,
  openedAt: true,
  openCount: true,
  errorMessage: true,
  createdAt: true,
});

export type DripSend = typeof dripSends.$inferSelect;
export type InsertDripSend = z.infer<typeof insertDripSendSchema>;

// ─── SMS Campaigns ──────────────────────────────────────────────────────────
export const smsCampaigns = pgTable("sms_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  message: text("message").notNull(),
  listId: varchar("list_id").references(() => prospectLists.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"), // draft | sending | sent
  sentCount: integer("sent_count").default(0).notNull(),
  failCount: integer("fail_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
});
export const insertSmsCampaignSchema = createInsertSchema(smsCampaigns).omit({ id: true, createdAt: true, sentAt: true, sentCount: true, failCount: true });
export type SmsCampaign = typeof smsCampaigns.$inferSelect;
export type InsertSmsCampaign = z.infer<typeof insertSmsCampaignSchema>;

// ─── WhatsApp Campaigns ───────────────────────────────────────────────────────
export const whatsappCampaigns = pgTable("whatsapp_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  message: text("message").notNull(),
  listId: varchar("list_id").references(() => prospectLists.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"), // draft | sending | sent
  sentCount: integer("sent_count").default(0).notNull(),
  failCount: integer("fail_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
});
export const insertWhatsappCampaignSchema = createInsertSchema(whatsappCampaigns).omit({ id: true, createdAt: true, sentAt: true, sentCount: true, failCount: true });
export type WhatsappCampaign = typeof whatsappCampaigns.$inferSelect;
export type InsertWhatsappCampaign = z.infer<typeof insertWhatsappCampaignSchema>;

export const facebookPosts = pgTable("facebook_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  imagePrompt: text("image_prompt"),
  status: text("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for"),
  postedAt: timestamp("posted_at"),
  facebookPostId: text("facebook_post_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFacebookPostSchema = createInsertSchema(facebookPosts).omit({
  id: true,
  createdAt: true,
});

export type FacebookPost = typeof facebookPosts.$inferSelect;
export type InsertFacebookPost = z.infer<typeof insertFacebookPostSchema>;

// ─── Attorney CRM Tables ─────────────────────────────────────────────────────

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique(),
  phone: text("phone"),
  firmName: text("firm_name"),
  jobTitle: text("job_title"),
  personaType: text("persona_type"),
  country: text("country"),
  city: text("city"),
  source: text("source"),
  linkedinUrl: text("linkedin_url"),
  websiteUrl: text("website_url"),
  leadScore: integer("lead_score").default(0).notNull(),
  status: text("status").default("new").notNull(),
  tags: text("tags").array().default([]).notNull(),
  notes: text("notes"),
  gdprNote: text("gdpr_note"),
  consentSource: text("consent_source"),
  referredByContactId: varchar("referred_by_contact_id"),
  possibleDuplicateOf: varchar("possible_duplicate_of"),
  // ICP fit + buying-intent scoring (lead-intelligence + lead-signals), refreshed
  // nightly. Nullable until first scored. See server/lead-intelligence.ts.
  icpScore: integer("icp_score"),
  icpFitScore: integer("icp_fit_score"),
  icpIntentScore: integer("icp_intent_score"),
  icpTier: text("icp_tier"),
  icpAudience: text("icp_audience"),
  icpReasons: text("icp_reasons").array(),
  icpExplanation: text("icp_explanation"),
  icpScoredAt: timestamp("icp_scored_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  leadScore: true,
  createdAt: true,
  updatedAt: true,
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export const contactActivities = pgTable("contact_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  activityType: text("activity_type").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactActivitySchema = createInsertSchema(contactActivities).omit({
  id: true,
  createdAt: true,
});

export type ContactActivity = typeof contactActivities.$inferSelect;
export type InsertContactActivity = z.infer<typeof insertContactActivitySchema>;

export const contactTasks = pgTable("contact_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Nullable: tasks can belong to an attorney `contact` OR a `prospect` (drip-generated
  // call/LinkedIn steps), or neither for ad-hoc to-dos.
  contactId: varchar("contact_id").references(() => contacts.id),
  prospectId: varchar("prospect_id").references(() => prospects.id),
  // Secondary line shown under the title (e.g. the prospect/contact name a call is for).
  subtitle: text("subtitle"),
  title: text("title").notNull(),
  dueDate: timestamp("due_date"),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactTaskSchema = createInsertSchema(contactTasks).omit({
  id: true,
  completed: true,
  createdAt: true,
});

export type ContactTask = typeof contactTasks.$inferSelect;
export type InsertContactTask = z.infer<typeof insertContactTaskSchema>;

export const outreachCampaigns = pgTable("outreach_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  subjectA: text("subject_a").notNull(),
  subjectB: text("subject_b"),
  bodyA: text("body_a").notNull(),
  bodyB: text("body_b"),
  status: text("status").default("draft").notNull(),
  segmentFilter: jsonb("segment_filter"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  stats: jsonb("stats"),
  abWinner: text("ab_winner"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOutreachCampaignSchema = createInsertSchema(outreachCampaigns).omit({
  id: true,
  createdAt: true,
});

export type OutreachCampaign = typeof outreachCampaigns.$inferSelect;
export type InsertOutreachCampaign = z.infer<typeof insertOutreachCampaignSchema>;

export const outreachSequences = pgTable("outreach_sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  steps: jsonb("steps").default([]).notNull(),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOutreachSequenceSchema = createInsertSchema(outreachSequences).omit({
  id: true,
  createdAt: true,
});

export type OutreachSequence = typeof outreachSequences.$inferSelect;
export type InsertOutreachSequence = z.infer<typeof insertOutreachSequenceSchema>;

export const sequenceEnrollments = pgTable("sequence_enrollments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sequenceId: varchar("sequence_id").notNull().references(() => outreachSequences.id),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  currentStep: integer("current_step").default(0).notNull(),
  status: text("status").default("active").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  nextSendAt: timestamp("next_send_at"),
});

export const insertSequenceEnrollmentSchema = createInsertSchema(sequenceEnrollments).omit({
  id: true,
  enrolledAt: true,
});

export type SequenceEnrollment = typeof sequenceEnrollments.$inferSelect;
export type InsertSequenceEnrollment = z.infer<typeof insertSequenceEnrollmentSchema>;

export const pipelineDeals = pgTable("pipeline_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  stage: text("stage").default("new").notNull(),
  notes: text("notes"),
  referralValue: integer("referral_value"),
  movedAt: timestamp("moved_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPipelineDealSchema = createInsertSchema(pipelineDeals).omit({
  id: true,
  movedAt: true,
  createdAt: true,
});

export type PipelineDeal = typeof pipelineDeals.$inferSelect;
export type InsertPipelineDeal = z.infer<typeof insertPipelineDealSchema>;

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

export const savedSegments = pgTable("saved_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  filters: jsonb("filters").notNull().default({}),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSavedSegmentSchema = createInsertSchema(savedSegments).omit({
  id: true,
  createdAt: true,
});

export type SavedSegment = typeof savedSegments.$inferSelect;
export type InsertSavedSegment = z.infer<typeof insertSavedSegmentSchema>;

// ─── Website Visitor Tracking ────────────────────────────────────────────────

export const visitorSessions = pgTable("visitor_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(),
  ip: text("ip"),
  country: text("country"),
  city: text("city"),
  region: text("region"),
  org: text("org"),
  isp: text("isp"),
  userAgent: text("user_agent"),
  device: text("device"),
  identifiedEmail: text("identified_email"),
  identifiedName: text("identified_name"),
  identifiedCompany: text("identified_company"),
  crmClientId: varchar("crm_client_id"),
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  totalDuration: integer("total_duration").default(0),
  pageViewCount: integer("page_view_count").default(0),
});

export const visitorPageViews = pgTable("visitor_page_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  path: text("path").notNull(),
  title: text("title"),
  referrer: text("referrer"),
  duration: integer("duration").default(0),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export type VisitorSession = typeof visitorSessions.$inferSelect;
export type VisitorPageView = typeof visitorPageViews.$inferSelect;

// ─── SEO Command Center ───────────────────────────────────────────────────────

export const seoKeywords = pgTable("seo_keywords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyword: text("keyword").notNull(),
  domain: text("domain").notNull().default("newdawnfranchising.com"),
  targetUrl: text("target_url"),
  tags: text("tags"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seoKeywordRankings = pgTable("seo_keyword_rankings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keywordId: varchar("keyword_id").notNull().references(() => seoKeywords.id, { onDelete: "cascade" }),
  position: integer("position"),
  url: text("url"),
  serpSnapshot: jsonb("serp_snapshot"),
  checkedAt: timestamp("checked_at").defaultNow().notNull(),
});

export const seoGeneratedContent = pgTable("seo_generated_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyword: text("keyword").notNull(),
  title: text("title"),
  body: text("body"),
  metaDescription: text("meta_description"),
  wordCount: integer("word_count"),
  status: text("status").default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seoScheduledTasks = pgTable("seo_scheduled_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskKey: text("task_key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  cadence: text("cadence").notNull(), // daily | weekly | monthly
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: text("last_run_status"), // completed | failed | running
  lastRunResult: text("last_run_result"),
  nextRunAt: timestamp("next_run_at"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seoAgentTasks = pgTable("seo_agent_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskType: text("task_type").notNull(),
  status: text("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  resultSummary: text("result_summary"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seoBacklinkOutreach = pgTable("seo_backlink_outreach", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetSite: text("target_site").notNull(),
  targetUrl: text("target_url"),
  contactEmail: text("contact_email"),
  status: text("status").notNull().default("not_sent"),
  notes: text("notes"),
  emailBody: text("email_body"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type SeoKeyword = typeof seoKeywords.$inferSelect;
export type SeoKeywordRanking = typeof seoKeywordRankings.$inferSelect;
export type SeoGeneratedContent = typeof seoGeneratedContent.$inferSelect;
export type SeoAgentTask = typeof seoAgentTasks.$inferSelect;
export type SeoBacklinkOutreach = typeof seoBacklinkOutreach.$inferSelect;

// ─── AI Outreach Agent Tables ────────────────────────────────────────────────

export const agentLeads = pgTable("agent_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  company: text("company"),
  title: text("title"),
  country: text("country"),
  language: text("language").notNull().default("en"),
  source: text("source").notNull().default("manual"),
  sourceUrl: text("source_url"),
  aiScore: integer("ai_score").notNull().default(0),
  stage: text("stage").notNull().default("new"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  investmentType: text("investment_type"),
  researchDossier: jsonb("research_dossier"),
  sequenceStage: integer("sequence_stage").notNull().default(0),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  lastContactedAt: timestamp("last_contacted_at"),
  dnc: boolean("dnc").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentMessages = pgTable("agent_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  dailyBatchId: varchar("daily_batch_id"),
  channel: text("channel").notNull().default("email"),
  subject: text("subject"),
  body: text("body").notNull(),
  status: text("status").notNull().default("staged"),
  touchNumber: integer("touch_number").notNull().default(1),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  repliedAt: timestamp("replied_at"),
  abVariant: text("ab_variant"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentDailyBatches = pgTable("agent_daily_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchDate: text("batch_date").notNull(),
  briefEmailSentAt: timestamp("brief_email_sent_at"),
  briefSubject: text("brief_subject"),
  briefBody: text("brief_body"),
  approvalStatus: text("approval_status").notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  replyBody: text("reply_body"),
  skippedItems: integer("skipped_items").array().notNull().default(sql`'{}'::integer[]`),
  executedAt: timestamp("executed_at"),
  executionSummary: jsonb("execution_summary"),
  confirmationSentAt: timestamp("confirmation_sent_at"),
  totalStaged: integer("total_staged").notNull().default(0),
  totalSent: integer("total_sent").notNull().default(0),
  totalFailed: integer("total_failed").notNull().default(0),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentForumPosts = pgTable("agent_forum_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: text("platform").notNull(),
  postUrl: text("post_url").notNull(),
  postTitle: text("post_title").notNull(),
  postBody: text("post_body"),
  author: text("author"),
  draftReply: text("draft_reply"),
  status: text("status").notNull().default("awaiting_approval"),
  approvalToken: text("approval_token").unique(),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  reviewNotes: text("review_notes"),
  dailyBatchId: varchar("daily_batch_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentCompetitors = pgTable("agent_competitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  lastScannedAt: timestamp("last_scanned_at"),
  insights: jsonb("insights"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentSettings = pgTable("agent_settings", {
  id: integer("id").primaryKey().default(1),
  approvalEmail: text("approval_email").notNull().default("jamie.greene736@gmail.com"),
  briefSendHour: integer("brief_send_hour").notNull().default(7),
  approvalDeadlineHour: integer("approval_deadline_hour").notNull().default(14),
  maxLeadsPerDay: integer("max_leads_per_day").notNull().default(50),
  maxEmailsPerDay: integer("max_emails_per_day").notNull().default(80),
  maxWhatsappPerDay: integer("max_whatsapp_per_day").notNull().default(30),
  calendlyLink: text("calendly_link").default("https://calendly.com/newdawnfranchising"),
  dylanBio: text("dylan_bio"),
  dylanVoiceSamples: text("dylan_voice_samples").array().notNull().default(sql`'{}'::text[]`),
  prohibitedPhrases: text("prohibited_phrases").array().notNull().default(sql`'{}'::text[]`),
  targetCountries: text("target_countries").array().notNull().default(sql`'{}'::text[]`),
  blacklistDomains: text("blacklist_domains").array().notNull().default(sql`'{}'::text[]`),
  agentPaused: boolean("agent_paused").notNull().default(false),
  slackWebhookUrl: text("slack_webhook_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentRunLogs = pgTable("agent_run_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runType: text("run_type").notNull(),
  status: text("status").notNull().default("running"),
  summary: jsonb("summary"),
  tasksLog: jsonb("tasks_log"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentDnc = pgTable("agent_dnc", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email"),
  phone: text("phone"),
  domain: text("domain"),
  reason: text("reason"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

// ─── Agent Chat Sessions ──────────────────────────────────────────────────────

export const agentChatSessions = pgTable("agent_chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull().default("New Chat"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentChatMessages = pgTable("agent_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => agentChatSessions.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentScheduledJobs = pgTable("agent_scheduled_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  tool: text("tool").notNull(),
  args: jsonb("args").notNull().default({}),
  scheduledAt: timestamp("scheduled_at").notNull(),
  timezone: varchar("timezone").notNull().default("America/Chicago"),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  sessionId: varchar("session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AgentScheduledJob = typeof agentScheduledJobs.$inferSelect;

export type AgentLead = typeof agentLeads.$inferSelect;
export type InsertAgentLead = typeof agentLeads.$inferInsert;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type InsertAgentMessage = typeof agentMessages.$inferInsert;
export type AgentDailyBatch = typeof agentDailyBatches.$inferSelect;
export type AgentForumPost = typeof agentForumPosts.$inferSelect;
export type AgentCompetitor = typeof agentCompetitors.$inferSelect;
export type AgentSettings = typeof agentSettings.$inferSelect;
export type AgentRunLog = typeof agentRunLogs.$inferSelect;
export type AgentChatSession = typeof agentChatSessions.$inferSelect;
export type AgentChatMessage = typeof agentChatMessages.$inferSelect;

// ─── Franchisee Portal Tables ─────────────────────────────────────────────────

export const franchisees = pgTable("franchisees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  territory: text("territory"),
  franchiseStart: timestamp("franchise_start"),
  status: text("status").notNull().default("active"),
  trainingAccess: boolean("training_access").notNull().default(true),
  marketingAccess: boolean("marketing_access").notNull().default(false),
  calendlyUrl: text("calendly_url"),
  checklistComplete: boolean("checklist_complete").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const franchiseeChecklistItems = pgTable("franchisee_checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  franchiseeId: varchar("franchisee_id").notNull(),
  itemKey: text("item_key").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  documentUrl: text("document_url"),
  documentName: text("document_name"),
  confirmedAt: timestamp("confirmed_at"),
  overriddenBy: text("overridden_by"),
  overriddenAt: timestamp("overridden_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const franchiseeTrainingProgress = pgTable("franchisee_training_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  franchiseeId: varchar("franchisee_id").notNull(),
  moduleKey: text("module_key").notNull(),
  status: text("status").notNull().default("not_started"),
  quizScore: integer("quiz_score"),
  quizAttempts: integer("quiz_attempts").notNull().default(0),
  quizLastAttemptAt: timestamp("quiz_last_attempt_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const franchiseeCertificates = pgTable("franchisee_certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  franchiseeId: varchar("franchisee_id").notNull(),
  type: text("type").notNull(),
  verificationId: varchar("verification_id").unique().default(sql`gen_random_uuid()`),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
});

export const disclaimerAcknowledgements = pgTable("disclaimer_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  franchiseeId: varchar("franchisee_id").notNull(),
  disclaimerType: text("disclaimer_type").notNull(),
  version: text("version").notNull().default("1.0"),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
});

export const trainingAnnouncements = pgTable("training_announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isUrgent: boolean("is_urgent").notNull().default(false),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  readBy: jsonb("read_by").notNull().default(sql`'[]'::jsonb`),
  createdBy: text("created_by").notNull().default("admin"),
});

// ─── HeyGen Video Tables ──────────────────────────────────────────────────────

export const heygenVideos = pgTable("heygen_videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  leadName: text("lead_name"),
  leadEmail: text("lead_email"),
  leadPhone: text("lead_phone"),
  franchiseeId: varchar("franchisee_id"),
  script: text("script").notNull(),
  heygenVideoId: varchar("heygen_video_id"),
  status: varchar("status").notNull().default("pending"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  trackingToken: varchar("tracking_token").unique().default(sql`gen_random_uuid()`),
  trackingUrl: text("tracking_url"),
  deliveryChannel: varchar("delivery_channel").default("email"),
  deliveryStatus: varchar("delivery_status").notNull().default("not_sent"),
  sentAt: timestamp("sent_at"),
  clickedAt: timestamp("clicked_at"),
  renderStartedAt: timestamp("render_started_at"),
  renderCompletedAt: timestamp("render_completed_at"),
  renderDurationSec: integer("render_duration_sec"),
  dailyBatchId: varchar("daily_batch_id"),
  scriptTemplateId: varchar("script_template_id"),
  subjectLine: text("subject_line"),
  emailBody: text("email_body"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const heygenScriptTemplates = pgTable("heygen_script_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  script: text("script").notNull(),
  touchType: varchar("touch_type"),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const heygenSettings = pgTable("heygen_settings", {
  id: integer("id").primaryKey().default(1),
  avatarId: text("avatar_id").notNull().default(""),
  voiceId: text("voice_id").notNull().default(""),
  defaultChannel: varchar("default_channel").notNull().default("email"),
  speakingSpeed: doublePrecision("speaking_speed").notNull().default(1.0),
  bgColour: text("bg_colour").notNull().default("#ffffff"),
  dailyVideoLimit: integer("daily_video_limit").notNull().default(5),
  autoHotLeads: boolean("auto_hot_leads").notNull().default(true),
  autoTouch3: boolean("auto_touch3").notNull().default(true),
  autoPostCall: boolean("auto_post_call").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type HeygenVideo = typeof heygenVideos.$inferSelect;
export type InsertHeygenVideo = typeof heygenVideos.$inferInsert;
export type HeygenScriptTemplate = typeof heygenScriptTemplates.$inferSelect;
export type HeygenSettings = typeof heygenSettings.$inferSelect;

export type Franchisee = typeof franchisees.$inferSelect;
export type InsertFranchisee = typeof franchisees.$inferInsert;
export type FranchiseeChecklistItem = typeof franchiseeChecklistItems.$inferSelect;
export type FranchiseeTrainingProgress = typeof franchiseeTrainingProgress.$inferSelect;
export type FranchiseeCertificate = typeof franchiseeCertificates.$inferSelect;
export type DisclaimerAcknowledgement = typeof disclaimerAcknowledgements.$inferSelect;
export type TrainingAnnouncement = typeof trainingAnnouncements.$inferSelect;
export type SeoScheduledTask = typeof seoScheduledTasks.$inferSelect;

// ─── Lead Gen / Outreach Engine ───────────────────────────────────────────────

export const outreachLeads = pgTable("outreach_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  title: text("title"),
  company: text("company"),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  mailingAddress: text("mailing_address"),
  linkedinUrl: text("linkedin_url"),
  linkedinConnected: boolean("linkedin_connected").default(false),
  website: text("website"),
  category: text("category"), // immigration_attorney | relocation_consultant | real_estate | business_consultant | wealth_manager | chamber | visa_consultant | franchise_broker
  score: integer("score").default(0),
  status: text("status").default("new"), // new | active | replied | nurture | converted | dead
  optedOut: boolean("opted_out").default(false),
  notes: text("notes"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  sequenceStartedAt: timestamp("sequence_started_at"),
  sequencePaused: boolean("sequence_paused").default(false),
  sequencePausedReason: text("sequence_paused_reason"),
  sequenceFlow: text("sequence_flow"), // "heygen_flow" (legacy: "lob_enabled" before postcards were removed)
  sequenceTrack: text("sequence_track").notNull().default("broker"), // "broker" | "client"
  lastEnrichedAt: timestamp("last_enriched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const outreachSequenceEvents = pgTable("outreach_sequence_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  day: integer("day").notNull(),
  channel: text("channel").notNull(), // email | sms | whatsapp | linkedin | lob | heygen
  touchName: text("touch_name").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled | sent | opened | clicked | replied | failed | skipped | paused | cancelled
  scheduledAt: timestamp("scheduled_at").notNull(),
  executedAt: timestamp("executed_at"),
  notes: text("notes"),
  metadata: jsonb("metadata"), // { subject, trackingToken, lobId, heygenVideoId, reason }
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const outreachLists = pgTable("outreach_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  segmentTag: text("segment_tag"),
  listType: text("list_type").default("cold"), // cold | warm | re_engagement | vip | partner
  status: text("status").default("draft"), // draft | approved | active | archived
  contactCount: integer("contact_count").default(0),
  performanceScore: integer("performance_score"),
  lastRefreshedAt: timestamp("last_refreshed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const outreachListMembers = pgTable("outreach_list_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listId: varchar("list_id").notNull(),
  leadId: varchar("lead_id").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
  removedAt: timestamp("removed_at"),
  removalReason: text("removal_reason"),
});

export const leadCampaigns = pgTable("lead_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  listId: varchar("list_id"), // deprecated — use tag instead
  tag: text("tag"), // filter: send to all outreach leads that have this tag
  goal: text("goal"), // awareness | meeting_booked | referral_agreement
  status: text("status").default("draft"), // draft | approved | active | paused | completed
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  channelsEnabled: text("channels_enabled").array(),
  dailySendLimits: jsonb("daily_send_limits"),
  abTestEnabled: boolean("ab_test_enabled").default(false),
  autoOptimize: boolean("auto_optimize").default(false),
  // Persona-based campaign fields (outreach agent)
  personaTarget: jsonb("persona_target"), // { titles, industries, geos, company_size }
  weeklyMeetingGoal: integer("weekly_meeting_goal").default(5),
  autoSendRules: jsonb("auto_send_rules"), // per-channel thresholds
  voiceProfileId: varchar("voice_profile_id"),
  meetingsBookedThisWeek: integer("meetings_booked_this_week").default(0),
  killSwitch: boolean("kill_switch").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leadCampaignSteps = pgTable("lead_campaign_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  stepNumber: integer("step_number").notNull(),
  channel: text("channel").notNull(), // email | sms | whatsapp | mail | heygen
  scheduledDay: integer("scheduled_day").notNull(),
  subjectLine: text("subject_line"),
  messageBody: text("message_body").notNull(),
  variant: text("variant").default("A"),
  status: text("status").default("pending"), // pending | active | paused | completed
});

export const outreachActivityLog = pgTable("outreach_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  campaignId: varchar("campaign_id"),
  stepId: varchar("step_id"),
  channel: text("channel").notNull(),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  repliedAt: timestamp("replied_at"),
  status: text("status").default("sent"), // sent | delivered | opened | clicked | replied | bounced | failed
  messagePreview: text("message_preview"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const outreachCampaignMetrics = pgTable("outreach_campaign_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  computedAt: timestamp("computed_at").defaultNow(),
  totalContacted: integer("total_contacted").default(0),
  sent: integer("sent").default(0),
  delivered: integer("delivered").default(0),
  opened: integer("opened").default(0),
  clicked: integer("clicked").default(0),
  replied: integer("replied").default(0),
  optedOut: integer("opted_out_count").default(0),
  bounced: integer("bounced").default(0),
  meetingsBooked: integer("meetings_booked").default(0),
  conversions: integer("conversions").default(0),
  openRate: doublePrecision("open_rate"),
  replyRate: doublePrecision("reply_rate"),
  conversionRate: doublePrecision("conversion_rate"),
  bestSendDay: text("best_send_day"),
  bestSendTime: text("best_send_time"),
  topPerformingChannel: text("top_performing_channel"),
});

// ─── Outreach Agent: Voice Profiles ───────────────────────────────────────────

export const voiceProfiles = pgTable("voice_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  sampleMessages: jsonb("sample_messages").default([]),
  toneRules: text("tone_rules"),
  signatureBlock: text("signature_block"),
  doNotSay: text("do_not_say").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type VoiceProfile = typeof voiceProfiles.$inferSelect;

// ─── Outreach Agent: Lead Sources ─────────────────────────────────────────────

export const leadSources = pgTable("lead_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  sourceType: text("source_type").notNull(), // seamless | apify | reddit | referral | manual
  queryPayload: jsonb("query_payload"),
  lastRunAt: timestamp("last_run_at"),
  contactsFound: integer("contacts_found").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LeadSource = typeof leadSources.$inferSelect;

// ─── Outreach Agent: Lead Scores ──────────────────────────────────────────────

export const leadScores = pgTable("lead_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  campaignId: varchar("campaign_id").notNull(),
  score: integer("score").default(0),
  scoreBreakdown: jsonb("score_breakdown"),
  rationale: text("rationale"),
  scoredAt: timestamp("scored_at").defaultNow().notNull(),
});
export type LeadScore = typeof leadScores.$inferSelect;

// ─── Outreach Agent: Touches (per-contact drafted/sent messages) ───────────────

export const outreachTouches = pgTable("outreach_touches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull(),
  campaignId: varchar("campaign_id").notNull(),
  sequenceId: varchar("sequence_id"),
  channel: text("channel").notNull(), // email | whatsapp | sms | linkedin_draft | forum_draft
  stepNumber: integer("step_number").default(1),
  status: text("status").notNull().default("drafted"), // drafted | awaiting_approval | sent | delivered | opened | replied | failed
  subject: text("subject"),
  body: text("body").notNull(),
  personalizationNotes: text("personalization_notes"),
  personalizationHook: text("personalization_hook"),
  confidenceScore: integer("confidence_score"),
  ymylFlag: boolean("ymyl_flag").default(false),
  sentAt: timestamp("sent_at"),
  replyBody: text("reply_body"),
  replySentiment: text("reply_sentiment"), // interested | objection | unsubscribe | out_of_office | cold
  replyReceivedAt: timestamp("reply_received_at"),
  approvalToken: text("approval_token").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type OutreachTouch = typeof outreachTouches.$inferSelect;

// ─── Core Infrastructure Tables ───────────────────────────────────────────────

export const systemNotifications = pgTable("system_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  system: text("system").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  leadId: varchar("lead_id"),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});

export const rateLimitUsage = pgTable("rate_limit_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  service: text("service").notNull(),
  date: text("date").notNull(),
  count: integer("count").default(0).notNull(),
  limit: integer("limit").default(100).notNull(),
  resetAt: timestamp("reset_at"),
});

export const emailLog = pgTable("email_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  queueId: text("queue_id"),
  toAddress: text("to_address").notNull(),
  fromAddress: text("from_address"),
  subject: text("subject").notNull(),
  status: text("status").default("sent").notNull(),
  attempts: integer("attempts").default(1).notNull(),
  sentAt: timestamp("sent_at"),
  failedAt: timestamp("failed_at"),
  preview: text("preview"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── SEO Data Tables (new structured data) ────────────────────────────────────

export const keywordRankings = pgTable("keyword_rankings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  keyword: text("keyword").notNull(),
  rank: integer("rank"),
  previousRank: integer("previous_rank"),
  delta: integer("delta"),
  flagged: boolean("flagged").default(false),
  checkedAt: timestamp("checked_at").defaultNow(),
});

export const webVitals = pgTable("web_vitals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageUrl: text("page_url").notNull(),
  lcp: doublePrecision("lcp"),
  inp: doublePrecision("inp"),
  cls: doublePrecision("cls"),
  performanceScore: integer("performance_score"),
  flagged: boolean("flagged").default(false),
  checkedAt: timestamp("checked_at").defaultNow(),
});

export const brokenLinks = pgTable("broken_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceUrl: text("source_url").notNull(),
  brokenUrl: text("broken_url").notNull(),
  statusCode: integer("status_code"),
  type: text("type"),
  flagged: boolean("flagged").default(true),
  foundAt: timestamp("found_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const seoIssues = pgTable("seo_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  severity: text("severity").notNull(), // critical | high | medium | low
  pageUrl: text("page_url"),
  description: text("description").notNull(),
  status: text("status").default("open"), // open | in_progress | resolved
  foundAt: timestamp("found_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const backlinks = pgTable("backlinks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceDomain: text("source_domain").notNull(),
  spamScore: integer("spam_score").default(0),
  flagged: boolean("flagged").default(false),
  discoveredAt: timestamp("discovered_at").defaultNow(),
});

export const contentSuggestions = pgTable("content_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  topic: text("topic").notNull(),
  keyword: text("keyword"),
  sourceTask: text("source_task"),
  priority: text("priority").default("medium"),
  status: text("status").default("pending"), // pending | drafted | published | discarded
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Content Engine Tables ────────────────────────────────────────────────────

export const contentDrafts = pgTable("content_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  body: text("body").notNull(),
  targetKeyword: text("target_keyword"),
  wordCount: integer("word_count"),
  status: text("status").default("draft").notNull(), // draft | approved | published | discarded
  triggerSource: text("trigger_source"), // content_gap_analysis | keyword_trend_report | manual
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  publishedAt: timestamp("published_at"),
});

export const metaSuggestions = pgTable("meta_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageUrl: text("page_url").notNull(),
  currentTitle: text("current_title"),
  currentMeta: text("current_meta"),
  suggestedTitle: text("suggested_title"),
  suggestedMeta: text("suggested_meta"),
  impressions: integer("impressions"),
  currentCtr: doublePrecision("current_ctr"),
  status: text("status").default("pending"), // pending | approved | rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
});

// ─── Visitor Trigger Tables ───────────────────────────────────────────────────

export const visitorEvents = pgTable("visitor_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  fingerprint: text("fingerprint"),
  pageUrl: text("page_url").notNull(),
  referralSource: text("referral_source"),
  utmSource: text("utm_source"),
  utmCampaign: text("utm_campaign"),
  timeOnPageSeconds: integer("time_on_page_seconds"),
  visitedAt: timestamp("visited_at").defaultNow().notNull(),
  leadId: varchar("lead_id"),
});

export const visitorWatchlist = pgTable("visitor_watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fingerprint: text("fingerprint").notNull(),
  pagesVisited: text("pages_visited").array().default([]),
  visitCount: integer("visit_count").default(1),
  firstSeen: timestamp("first_seen").defaultNow(),
  lastSeen: timestamp("last_seen").defaultNow(),
  status: text("status").default("watching"), // watching | identified | contacted
  leadId: varchar("lead_id"),
});

// ─── Meetings Table ───────────────────────────────────────────────────────────

export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id"),
  campaignId: varchar("campaign_id"),
  calendlyEventId: text("calendly_event_id"),
  scheduledAt: timestamp("scheduled_at"),
  status: text("status").default("confirmed"), // confirmed | cancelled | completed | no_show
  outcome: text("outcome"), // attended | no_show | converted | lost
  briefSentAt: timestamp("brief_sent_at"),
  inviteeName: text("invitee_name"),
  inviteeEmail: text("invitee_email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Strategy Brief Table ─────────────────────────────────────────────────────

export const briefs = pgTable("briefs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  generatedAt: timestamp("generated_at").defaultNow(),
  deliveredAt: timestamp("delivered_at"),
  deliveryStatus: text("delivery_status").default("pending"), // pending | sent | failed
  subject: text("subject"),
  htmlBody: text("html_body"),
  prioritiesCount: integer("priorities_count").default(0),
  winsCount: integer("wins_count").default(0),
  portalActionsTaken: integer("portal_actions_taken").default(0),
});

export type OutreachLead = typeof outreachLeads.$inferSelect;
export type OutreachSequenceEvent = typeof outreachSequenceEvents.$inferSelect;
export type InsertOutreachSequenceEvent = typeof outreachSequenceEvents.$inferInsert;
export type OutreachList = typeof outreachLists.$inferSelect;
export type OutreachListMember = typeof outreachListMembers.$inferSelect;
export type LeadCampaign = typeof leadCampaigns.$inferSelect;
export type LeadCampaignStep = typeof leadCampaignSteps.$inferSelect;
export type OutreachActivityLog = typeof outreachActivityLog.$inferSelect;
export type OutreachCampaignMetrics = typeof outreachCampaignMetrics.$inferSelect;

// ─── SEO Campaign Agent ───────────────────────────────────────────────────────

export const seoCampaigns = pgTable("seo_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetKeyword: text("target_keyword").notNull(),
  targetUrl: text("target_url").notNull(),
  goalRank: integer("goal_rank").default(10),
  deadline: timestamp("deadline"),
  currentRank: integer("current_rank"),
  startingRank: integer("starting_rank"),
  status: text("status").notNull().default("active"), // active | paused | blocked | completed
  autoPublish: boolean("auto_publish").notNull().default(false),
  monthlyBudgetCap: integer("monthly_budget_cap").default(0), // 0 = unlimited
  killSwitch: boolean("kill_switch").notNull().default(false),
  lastRunAt: timestamp("last_run_at"),
  lastRetrospective: text("last_retrospective"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const seoCampaignActions = pgTable("seo_campaign_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  actionType: text("action_type").notNull(), // write_blog_post | on_page_optimization | internal_linking | competitor_gap_analysis | technical_audit | haro_response | directory_submission | guest_post_outreach | request_blocker
  status: text("status").notNull().default("planned"), // planned | running | done | failed | awaiting_approval | skipped
  rationale: text("rationale"),
  expectedImpact: text("expected_impact"),
  payload: json("payload"),
  result: json("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const seoCampaignBlockers = pgTable("seo_campaign_blockers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  actionId: varchar("action_id"),
  type: text("type").notNull(), // credentials_needed | approval_needed | budget_needed | info_needed
  service: text("service"),
  reason: text("reason").notNull(),
  instructionsForUser: text("instructions_for_user"),
  priority: text("priority").notNull().default("medium"), // high | medium | low
  status: text("status").notNull().default("open"), // open | resolved | skipped
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seoContentDrafts = pgTable("seo_content_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull(),
  actionId: varchar("action_id"),
  title: text("title").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  metaDescription: text("meta_description"),
  targetKeyword: text("target_keyword").notNull(),
  wordCount: integer("word_count"),
  contentType: text("content_type").notNull().default("blog_post"), // blog_post | on_page_diff | outreach_email | haro_response
  status: text("status").notNull().default("awaiting_approval"), // draft | awaiting_approval | approved | rejected | published
  publishedUrl: text("published_url"),
  reviewNotes: text("review_notes"),
  approvalToken: text("approval_token").unique(),
  metadata: jsonb("metadata"), // slug, internal_link_suggestions, external_citations, ymyl_disclaimer_included
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SeoCampaign = typeof seoCampaigns.$inferSelect;
export type SeoCampaignAction = typeof seoCampaignActions.$inferSelect;
export type SeoCampaignBlocker = typeof seoCampaignBlockers.$inferSelect;
export type SeoContentDraft = typeof seoContentDrafts.$inferSelect;

// ─── Phone Calls (OpenPhone / Quo) ────────────────────────────────────────────
export const phoneCalls = pgTable("phone_calls", {
  id: varchar("id").primaryKey(), // OpenPhone call ID
  direction: text("direction").notNull(), // inbound | outbound
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  status: text("status").notNull(), // completed | missed | busy | no-answer | voicemail
  durationSeconds: integer("duration_seconds"),
  callerName: text("caller_name"),
  recordingUrl: text("recording_url"),
  recordingId: text("recording_id"),
  transcriptText: text("transcript_text"),
  aiSummary: text("ai_summary"),
  voicemailUrl: text("voicemail_url"),
  voicemailTranscript: text("voicemail_transcript"),
  crmClientId: text("crm_client_id"),
  openphoneCreatedAt: timestamp("openphone_created_at"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
});

export type PhoneCall = typeof phoneCalls.$inferSelect;

// ─── Agent SMS Messages ────────────────────────────────────────────────────────
export const agentSmsMessages = pgTable("agent_sms_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentType: text("agent_type").notNull(), // seo | outreach
  direction: text("direction").notNull(), // outbound | inbound
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  body: text("body").notNull(),
  quoMessageId: text("quo_message_id"),
  contextJson: jsonb("context_json"), // arbitrary context from the agent
  status: text("status").default("sent"), // sent | delivered | failed | pending_reply
  triggerType: text("trigger_type"), // draft_pending | blocker | error | manual
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type AgentSmsMessage = typeof agentSmsMessages.$inferSelect;

// ─── Outreach Daily Intelligence Plans ───────────────────────────────────────
export const outreachDailyPlans = pgTable("outreach_daily_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planDate: text("plan_date").notNull(), // YYYY-MM-DD — the day this plan covers
  status: text("status").default("awaiting_approval"), // awaiting_approval | approved | rejected | executing | completed | failed
  // Claude's narrative: who to target and why
  planSummary: text("plan_summary").notNull(),
  strategicReasoning: text("strategic_reasoning"), // why these categories now
  // Array of {category, country, geoFocus, reasoning, estimatedLeads, priority}
  leadCategories: jsonb("lead_categories").notNull().$type<{
    category: string; country: string; geoFocus: string;
    reasoning: string; estimatedLeads: number; priority: "high"|"medium"|"low";
  }[]>(),
  // Array of {query, source, purpose} — generated by Claude, executed on approval
  searchQueries: jsonb("search_queries").$type<{
    query: string; source: "serpapi"|"seamless"|"hunter";
    purpose: string; executed?: boolean; resultsCount?: number;
  }[]>(),
  // Any tools/credentials the agent says it needs
  blockerRequests: jsonb("blocker_requests").$type<{
    tool: string; reason: string; priority: "high"|"medium"|"low"; url?: string;
  }[]>(),
  approvalToken: text("approval_token").unique(),
  estimatedLeads: integer("estimated_leads").default(0),
  discoveredCount: integer("discovered_count").default(0),
  reviewNotes: text("review_notes"),
  executedAt: timestamp("executed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type OutreachDailyPlan = typeof outreachDailyPlans.$inferSelect;

// ─── Forum Accounts (credentials for agent posting) ───────────────────────────

export const forumAccounts = pgTable("forum_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  forumName: text("forum_name").notNull(),
  siteUrl: text("site_url").notNull(),
  loginUrl: text("login_url"),
  username: text("username"),
  password: text("password"),
  notes: text("notes"),
  autoScanEnabled: boolean("auto_scan_enabled").default(true),
  lastScannedAt: timestamp("last_scanned_at"),
  lastPostedAt: timestamp("last_posted_at"),
  postsCount: integer("posts_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type ForumAccount = typeof forumAccounts.$inferSelect;

// ─── LinkedIn Queue ───────────────────────────────────────────────────────────

export const linkedinQueue = pgTable("linkedin_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  sequenceEventId: varchar("sequence_event_id"),
  leadName: text("lead_name").notNull(),
  leadLinkedinUrl: text("lead_linkedin_url"),
  leadCompany: text("lead_company"),
  leadTitle: text("lead_title"),
  type: text("type").notNull(), // connection_request | dm
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"), // pending | sent | skipped
  approvalToken: varchar("approval_token").unique(),
  sentAt: timestamp("sent_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LinkedInQueueItem = typeof linkedinQueue.$inferSelect;

// ─── Partner Outreach Sequence ────────────────────────────────────────────────

export const partnerLeads = pgTable("partner_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  title: text("title"),
  company: text("company"), // firm name
  email: text("email"),
  phone: text("phone"),
  mailingAddress: text("mailing_address"),
  linkedinUrl: text("linkedin_url"),
  linkedinConnected: boolean("linkedin_connected").default(false),
  website: text("website"),
  city: text("city"),
  audienceType: text("audience_type").notNull().default("other"),
  // immigration_attorney | wealth_manager | business_advisor | e2_consultant | immigration_consultant | other
  spanishFlag: boolean("spanish_flag").default(false),
  subjectVariant: text("subject_variant").default("A"), // A | B | C
  score: integer("score").default(0),
  status: text("status").default("new"), // new | active | replied | booked | converted | dead | opted_out
  optedOut: boolean("opted_out").default(false),
  notes: text("notes"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  sequenceStartedAt: timestamp("sequence_started_at"),
  sequencePaused: boolean("sequence_paused").default(false),
  sequencePausedReason: text("sequence_paused_reason"),
  sequenceFlow: text("sequence_flow"), // "lob_enabled" | "standard"
  lastEnrichedAt: timestamp("last_enriched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const partnerSequenceEvents = pgTable("partner_sequence_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(),
  day: integer("day").notNull(),
  channel: text("channel").notNull(), // email | linkedin | lob
  touchName: text("touch_name").notNull(),
  status: text("status").notNull().default("scheduled"),
  // scheduled | sent | opened | clicked | replied | failed | skipped | paused | cancelled
  scheduledAt: timestamp("scheduled_at").notNull(),
  executedAt: timestamp("executed_at"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PartnerLead = typeof partnerLeads.$inferSelect;
export type PartnerSequenceEvent = typeof partnerSequenceEvents.$inferSelect;
