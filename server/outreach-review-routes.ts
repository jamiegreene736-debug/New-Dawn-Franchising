import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "./db";
import { qualificationIssue, sequenceIssue } from "./outreach-readiness";

const reviewSchema = z.object({
  email: z.string().email().transform(v => v.trim().toLowerCase()),
  status: z.enum(["approved", "rejected"]),
  audience: z.enum(["broker", "client"]),
  sourceUrl: z.string().url().refine(v => v.startsWith("https://"), "Use a current HTTPS source"),
  reason: z.string().trim().min(30).max(2000),
  role: z.string().trim().min(3).max(200),
  firmDomain: z.string().trim().toLowerCase().regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/),
});
export function registerOutreachReviewRoutes(app: Express, auth: RequestHandler) {
  app.get("/api/crm/campaigns/:id/readiness", auth, async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT e.id,e.prospect_email AS email,e.prospect_name AS name,e.status,e.enrolled_at,
        e.hold_reason,c.audience_type AS audience,p.email_status,p.email_verified_at,q.status AS qualification_status,
        q.source_url,q.reason,q.role,q.firm_domain,q.reviewed_at,q.audience AS qualified_audience,
        (SELECT count(*)::int FROM drip_sends ds WHERE ds.channel='email' AND lower(trim(ds.recipient_email))=lower(trim(e.prospect_email)) AND ds.sent_at>now()-interval '45 days') AS recent_emails,
        EXISTS(SELECT 1 FROM drip_sends ds LEFT JOIN outreach_qualifications fq ON fq.email=lower(trim(ds.recipient_email))
          WHERE ds.channel='email' AND ds.sent_at>now()-interval '7 days' AND lower(trim(ds.recipient_email))<>lower(trim(e.prospect_email))
          AND (fq.firm_domain=q.firm_domain OR split_part(lower(trim(ds.recipient_email)),'@',2)=q.firm_domain)) AS colleague
        FROM drip_enrollments e JOIN drip_campaigns c ON c.id=e.campaign_id
        LEFT JOIN prospects p ON p.id=e.prospect_id LEFT JOIN outreach_qualifications q ON q.email=lower(trim(e.prospect_email))
        WHERE e.campaign_id=$1 ORDER BY e.prospect_name`, [String(req.params.id)]);
      const results = [];
      for (const row of rows) {
        const issue = qualificationIssue({ ...row, status: row.qualification_status, audience: row.qualified_audience }, row.audience || "broker")
          || sequenceIssue(row.enrolled_at, row.recent_emails)
          || (row.colleague ? "Another person at this firm received outreach in the last seven days." : null);
        const fresh = row.email_status === "valid" && row.email_verified_at && Date.now() - new Date(row.email_verified_at).getTime() < 30 * 86400_000;
        results.push({ ...row, issue: issue || (!fresh ? "Current valid address verification required before sending." : row.status !== "active" ? `Enrollment is ${row.status}.` : null) });
      }
      res.json(results);
    } catch { res.status(500).json({ message: "Could not load outreach readiness." }); }
  });
  app.post("/api/crm/outreach/qualification", auth, async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues.map(i => i.message).join("; ") });
    const v = parsed.data;
    try {
      await pool.query(`INSERT INTO outreach_qualifications(email,status,audience,source_url,reason,role,firm_domain)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(email) DO UPDATE SET status=$2,audience=$3,source_url=$4,reason=$5,role=$6,firm_domain=$7,reviewed_at=now()`,
      [v.email,v.status,v.audience,v.sourceUrl,v.reason,v.role,v.firmDomain]);
      res.json({ saved: true, emailsSent: 0 });
    } catch { res.status(500).json({ message: "Could not save qualification." }); }
  });
}
