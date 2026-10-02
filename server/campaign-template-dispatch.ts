import { pool } from "./db";
import type { SmsPermission } from "./campaign-template-safety";

export async function templateRecipientOptedOut(email: string, phone: string | null | undefined): Promise<boolean> {
  const { rows } = await pool.query<{ opted_out: boolean }>(`SELECT EXISTS(
    SELECT 1 FROM drip_sends s JOIN drip_enrollments e ON e.id=s.enrollment_id
      WHERE lower(trim(e.prospect_email))=lower(trim($1)) AND s.reply_signal='opt_out'
    UNION ALL SELECT 1 FROM contact_activities a JOIN contacts c ON a.contact_id=c.id
      WHERE (lower(trim(c.email))=lower(trim($1)) OR NULLIF(regexp_replace(c.phone,'[^0-9]','','g'),'')=NULLIF(regexp_replace($2,'[^0-9]','','g'),''))
      AND a.activity_type IN ('sms_received','email_received','email_reply')
      AND coalesce(a.metadata->>'replyText',a.metadata->>'message','') ~* '^\\s*(stop|stopall|unsubscribe|optout|cancel|end|quit|please unsubscribe|please remove me|do not contact)(\\s|[.!]|$)'
    UNION ALL SELECT 1 FROM crm_client_activities a JOIN crm_clients c ON a.client_id=c.id
      WHERE (lower(trim(c.email))=lower(trim($1)) OR NULLIF(regexp_replace(c.phone,'[^0-9]','','g'),'')=NULLIF(regexp_replace($2,'[^0-9]','','g'),''))
      AND a.activity_type IN ('sms_received','email_received','email_reply')
      AND coalesce(a.metadata->>'replyText',a.metadata->>'message','') ~* '^\\s*(stop|stopall|unsubscribe|optout|cancel|end|quit|please unsubscribe|please remove me|do not contact)(\\s|[.!]|$)'
    ) AS opted_out`, [email, phone || ""]);
  return rows[0].opted_out;
}

export async function templateRecipientReplied(email: string, phone: string | null | undefined, enrolledAt: Date | string): Promise<boolean> {
  const { rows } = await pool.query<{ replied: boolean }>(`SELECT EXISTS(
    SELECT 1 FROM drip_sends s JOIN drip_enrollments e ON e.id=s.enrollment_id
      WHERE lower(trim(e.prospect_email))=lower(trim($1)) AND s.status='replied' AND s.sent_at >= $2
    UNION ALL SELECT 1 FROM crm_direct_emails WHERE direction='inbound' AND lower(trim(from_email))=lower(trim($1)) AND sent_at >= $2
    UNION ALL SELECT 1 FROM contact_activities a JOIN contacts c ON a.contact_id=c.id
      WHERE (lower(trim(c.email))=lower(trim($1)) OR NULLIF(regexp_replace(c.phone,'[^0-9]','','g'),'')=NULLIF(regexp_replace($3,'[^0-9]','','g'),''))
      AND a.activity_type IN ('email_received','email_reply','sms_received','whatsapp_received') AND a.created_at >= $2
    UNION ALL SELECT 1 FROM crm_client_activities a JOIN crm_clients c ON a.client_id=c.id
      WHERE (lower(trim(c.email))=lower(trim($1)) OR NULLIF(regexp_replace(c.phone,'[^0-9]','','g'),'')=NULLIF(regexp_replace($3,'[^0-9]','','g'),''))
      AND a.activity_type IN ('email_received','email_reply','sms_received','whatsapp_received') AND a.created_at >= $2
    UNION ALL SELECT 1 FROM meetings WHERE lower(trim(invitee_email))=lower(trim($1)) AND status IN ('confirmed','completed')
    ) AS replied`, [email, enrolledAt, phone || ""]);
  return rows[0].replied;
}

export async function getTemplateSmsPermission(email: string, phone: string): Promise<SmsPermission | undefined> {
  const { rows } = await pool.query<SmsPermission>("SELECT * FROM campaign_sms_permissions WHERE email=$1 AND phone=$2 ORDER BY created_at DESC,id DESC LIMIT 1", [email.trim().toLowerCase(),phone]);
  return rows[0];
}

export async function templateSmsCapacity(email: string, phone: string): Promise<{ allowedAt: number; capped: boolean; exhausted: boolean }> {
  const { rows } = await pool.query<{ latest: Date | null; texts: number; hourly: number; daily: number }>(`SELECT
    max(sent_at) FILTER(WHERE channel IN ('email','sms') AND (lower(trim(recipient_email))=$1 OR recipient_email=$2)) AS latest,
    count(*) FILTER(WHERE channel='sms' AND recipient_email=$2 AND sent_at>now()-interval '45 days')::int AS texts,
    count(*) FILTER(WHERE channel='sms' AND sent_at>now()-interval '1 hour')::int AS hourly,
    count(*) FILTER(WHERE channel='sms' AND sent_at>now()-interval '24 hours')::int AS daily
    FROM drip_sends WHERE sent_at IS NOT NULL`, [email, phone]);
  const row = rows[0];
  return { allowedAt: row.latest ? new Date(row.latest).getTime() + 86400_000 : 0, capped: row.hourly >= 10 || row.daily >= 50, exhausted: row.texts >= 2 };
}
