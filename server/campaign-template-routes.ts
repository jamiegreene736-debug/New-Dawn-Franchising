import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "./db";
import { CAMPAIGN_TEMPLATES, CAMPAIGN_TEMPLATE_GUIDANCE, TEMPLATE_OUTREACH_POLICY, templateStepValues } from "@shared/campaign-templates";
import { validRecipientTimezone, smsPermissionIssue } from "./campaign-template-safety";

export const templateCreateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  includeSms: z.boolean().default(true),
  requestKey: z.string().uuid(),
}).strict();

export const smsPermissionSchema = z.object({
  email: z.string().trim().email().transform(v => v.toLowerCase()),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international number such as +14155552671"),
  consentedAt: z.string().datetime({ offset: true }).refine(v => new Date(v).getTime() <= Date.now(), "Consent date cannot be in the future"),
  source: z.string().trim().min(5).max(500),
  disclosure: z.string().trim().min(20).max(2000).refine(v => /new dawn/i.test(v) && /marketing|promotional/i.test(v), "Disclosure must name New Dawn and marketing or promotional texts"),
  evidence: z.string().trim().min(20).max(2000),
  timezone: z.string().refine(validRecipientTimezone, "Use the recipient's known IANA timezone"),
}).strict();

export async function createTemplateCampaign(templateId: string, input: z.infer<typeof templateCreateSchema>) {
  const template = CAMPAIGN_TEMPLATES.find(t => t.id === templateId);
  if (!template) return undefined;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize retries with the same key so an uncertain response cannot create a second draft.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [input.requestKey]);
    const previous = await client.query<{ id: string; template_id: string; name: string; is_active: boolean }>("SELECT id,template_id,name,is_active FROM drip_campaigns WHERE template_request_key=$1", [input.requestKey]);
    if (previous.rows[0]) {
      const row = previous.rows[0];
      const sms = await client.query("SELECT 1 FROM drip_steps WHERE campaign_id=$1 AND step_type='sms'", [row.id]);
      if (row.template_id !== templateId || row.name !== input.name || (sms.rowCount! > 0) !== input.includeSms) {
        await client.query("ROLLBACK");
        return { conflict: true as const };
      }
      await client.query("COMMIT");
      return { id: row.id, replayed: true, isActive: row.is_active };
    }
    const id = randomUUID();
    await client.query(`INSERT INTO drip_campaigns(id,name,description,is_active,audience_type,outreach_policy,template_id,template_request_key)
      VALUES($1,$2,$3,false,$4,$5,$6,$7)`, [id, input.name, template.description, template.audienceType, TEMPLATE_OUTREACH_POLICY, templateId, input.requestKey]);
    for (const step of templateStepValues(template, input.includeSms)) {
      await client.query(`INSERT INTO drip_steps(id,campaign_id,step_order,delay_days,step_type,step_name,subject,body_html,preview_text,trigger_type)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'time')`, [randomUUID(),id,step.stepOrder,step.delayDays,step.stepType,step.stepName,step.subject,step.bodyHtml,step.previewText]);
    }
    await client.query("COMMIT");
    return { id, replayed: false, isActive: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export function registerCampaignTemplateRoutes(app: Express, auth: RequestHandler) {
  app.get("/api/crm/campaign-templates", auth, (_req, res) => {
    res.json({ templates: CAMPAIGN_TEMPLATES, guidance: CAMPAIGN_TEMPLATE_GUIDANCE });
  });
  app.post("/api/crm/campaign-templates/:id/create", auth, async (req, res) => {
    const parsed = templateCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues.map(i => i.message).join("; ") });
    try {
      const campaign = await createTemplateCampaign(String(req.params.id), parsed.data);
      if (!campaign) return res.status(404).json({ message: "Template not found" });
      if ("conflict" in campaign) return res.status(409).json({ message: "This request key already belongs to a different draft" });
      res.status(campaign.replayed ? 200 : 201).json(campaign);
    } catch (error) {
      console.error("[Campaign templates] Draft creation failed", error);
      res.status(500).json({ message: "Could not create the draft. Retry to recover the same campaign." });
    }
  });
  app.get("/api/crm/sms-permissions", auth, async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM campaign_sms_permissions ORDER BY created_at DESC LIMIT 100");
      res.setHeader("Cache-Control", "no-store");
      res.json(rows);
    } catch { res.status(500).json({ message: "Could not load text permissions" }); }
  });
  app.post("/api/crm/sms-permissions", auth, async (req, res) => {
    const parsed = smsPermissionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues.map(i => i.message).join("; ") });
    const v = parsed.data;
    const issue = smsPermissionIssue({ consented_at: v.consentedAt, revoked_at: null, source: v.source, disclosure: v.disclosure, evidence: v.evidence, timezone: v.timezone });
    if (issue) return res.status(400).json({ message: issue });
    try {
      const { rows } = await pool.query(`INSERT INTO campaign_sms_permissions(id,email,phone,consented_at,source,disclosure,evidence,timezone,recorded_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [randomUUID(),v.email,v.phone,v.consentedAt,v.source,v.disclosure,v.evidence,v.timezone,String(req.session.adminId || "admin")]);
      res.status(201).json(rows[0]);
    } catch { res.status(500).json({ message: "Could not save text permission" }); }
  });
  app.post("/api/crm/sms-permissions/:id/revoke", auth, async (req, res) => {
    if (!z.string().uuid().safeParse(req.params.id).success) return res.status(400).json({ message: "Invalid permission ID" });
    try {
      const { rows } = await pool.query(`UPDATE campaign_sms_permissions SET revoked_at=now()
        WHERE (email,phone) IN (SELECT email,phone FROM campaign_sms_permissions WHERE id=$1) RETURNING id`, [String(req.params.id)]);
      if (!rows.length) return res.status(404).json({ message: "Permission not found" });
      res.json({ revoked: true });
    } catch { res.status(500).json({ message: "Could not revoke text permission" }); }
  });
}
