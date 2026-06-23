import zlib from "zlib";
import { ImapFlow } from "imapflow";
import { pool } from "./db";

// ─────────────────────────────────────────────────────────────────────────────
// DMARC aggregate (rua) report ingestion (Phase 3)
//
// Mailbox providers email daily XML aggregate reports to the rua= address in the
// DMARC record (the records the DNS-setup tool generates point rua= at
// dmarc@newdawnfranchising.com). This polls that mailbox over IMAP, decompresses
// the .gz/.zip/.xml attachments, parses the aggregate XML, and stores per-source
// alignment so the tab can show who's sending as the domain and whether SPF/DKIM
// align — the Dmarcian/Postmark-style view, dependency-free.
//
// Configure via env: DMARC_IMAP_USER + DMARC_IMAP_PASSWORD (the mailbox the rua
// reports land in, e.g. dmarc@ or franchising@). Inert until both are set.
// ─────────────────────────────────────────────────────────────────────────────

export function getDmarcConfig() {
  const user = process.env.DMARC_IMAP_USER || "";
  const pass = (process.env.DMARC_IMAP_PASSWORD || "").replace(/\s+/g, "");
  const host = process.env.DMARC_IMAP_HOST || "imap.gmail.com";
  return { user, pass, host, configured: !!(user && pass) };
}

// ── Decompression ─────────────────────────────────────────────────────────────
function unzipFirstEntry(buf: Buffer): Buffer | null {
  // Minimal single-entry ZIP reader (DMARC reports are one XML per archive).
  if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) return null;
  const method = buf.readUInt16LE(8);
  const compSize = buf.readUInt32LE(18);
  const nameLen = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  try {
    if (method === 0) {
      // stored
      return compSize > 0 ? buf.subarray(start, start + compSize) : buf.subarray(start);
    }
    // deflate (method 8). If size is unknown (streamed), inflate the remainder.
    const comp = compSize > 0 ? buf.subarray(start, start + compSize) : buf.subarray(start);
    return zlib.inflateRawSync(comp);
  } catch {
    return null;
  }
}

function decompress(filename: string, buf: Buffer): string | null {
  const f = filename.toLowerCase();
  try {
    if (f.endsWith(".gz")) return zlib.gunzipSync(buf).toString("utf8");
    if (f.endsWith(".zip")) { const x = unzipFirstEntry(buf); return x ? x.toString("utf8") : null; }
    if (f.endsWith(".xml")) return buf.toString("utf8");
    // Unknown extension — sniff magic bytes.
    if (buf[0] === 0x1f && buf[1] === 0x8b) return zlib.gunzipSync(buf).toString("utf8"); // gzip
    if (buf[0] === 0x50 && buf[1] === 0x4b) { const x = unzipFirstEntry(buf); return x ? x.toString("utf8") : null; } // zip
    if (buf.subarray(0, 5).toString() === "<?xml") return buf.toString("utf8");
  } catch {}
  return null;
}

// ── Minimal XML field extraction (DMARC aggregate schema is flat + stable) ────
const tag = (xml: string, name: string): string | undefined => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1].trim() : undefined;
};

interface ParsedReport {
  reportId: string;
  org: string;
  domain: string;
  dateBegin: number;
  dateEnd: number;
  records: { sourceIp: string; count: number; disposition: string; dkim: string; spf: string; dkimDomain: string; spfDomain: string }[];
}

function parseAggregate(xml: string): ParsedReport | null {
  const meta = tag(xml, "report_metadata") || "";
  const policy = tag(xml, "policy_published") || "";
  const reportId = tag(meta, "report_id") || "";
  const org = tag(meta, "org_name") || "unknown";
  const domain = tag(policy, "domain") || "";
  const range = tag(meta, "date_range") || "";
  const dateBegin = Number(tag(range, "begin") || 0);
  const dateEnd = Number(tag(range, "end") || 0);
  if (!reportId && !domain) return null;

  const records: ParsedReport["records"] = [];
  for (const rec of xml.matchAll(/<record>([\s\S]*?)<\/record>/gi)) {
    const r = rec[1];
    const row = tag(r, "row") || "";
    const pe = tag(row, "policy_evaluated") || "";
    const ar = tag(r, "auth_results") || "";
    records.push({
      sourceIp: tag(row, "source_ip") || "",
      count: Number(tag(row, "count") || 1),
      disposition: (tag(pe, "disposition") || "none").toLowerCase(),
      dkim: (tag(pe, "dkim") || "fail").toLowerCase(),
      spf: (tag(pe, "spf") || "fail").toLowerCase(),
      dkimDomain: tag(tag(ar, "dkim") || "", "domain") || "",
      spfDomain: tag(tag(ar, "spf") || "", "domain") || "",
    });
  }
  return { reportId: reportId || `${org}-${dateBegin}`, org, domain, dateBegin, dateEnd, records };
}

async function storeReport(p: ParsedReport): Promise<boolean> {
  // Idempotent on report_id.
  const { rowCount } = await pool.query(
    `INSERT INTO dmarc_reports (id, report_id, org, domain, date_begin, date_end)
     VALUES (gen_random_uuid(), $1, $2, $3, to_timestamp($4), to_timestamp($5))
     ON CONFLICT (report_id) DO NOTHING`,
    [p.reportId, p.org, p.domain, p.dateBegin || 0, p.dateEnd || 0],
  );
  if (!rowCount) return false; // already ingested
  for (const r of p.records) {
    await pool.query(
      `INSERT INTO dmarc_records (id, report_id, source_ip, count, disposition, dkim_pass, spf_pass, dkim_domain, spf_domain)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)`,
      [p.reportId, r.sourceIp, r.count, r.disposition, r.dkim === "pass", r.spf === "pass", r.dkimDomain, r.spfDomain],
    );
  }
  return true;
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function collectParts(node: any, acc: any[] = []): any[] {
  if (!node) return acc;
  if (node.childNodes?.length) for (const c of node.childNodes) collectParts(c, acc);
  else acc.push(node);
  return acc;
}

let lastSync = { at: new Date(0).toISOString(), ingested: 0, scanned: 0, error: null as string | null };
export function getDmarcSyncStatus() { return { ...lastSync, ...getDmarcConfig() }; }

export async function syncDmarcReports(): Promise<{ scanned: number; ingested: number }> {
  const cfg = getDmarcConfig();
  if (!cfg.configured) { lastSync = { at: new Date().toISOString(), ingested: 0, scanned: 0, error: "DMARC_IMAP_USER/PASSWORD not set" }; return { scanned: 0, ingested: 0 }; }

  const client = new ImapFlow({ host: cfg.host, port: 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false });
  let scanned = 0, ingested = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      for await (const msg of client.fetch({ since }, { uid: true, bodyStructure: true, envelope: true })) {
        const subject = msg.envelope?.subject || "";
        // DMARC report subjects look like: "Report domain: ... Submitter: ..."
        if (!/report domain|dmarc/i.test(subject)) continue;
        scanned++;
        const parts = collectParts((msg as any).bodyStructure);
        for (const part of parts) {
          const fname = part.dispositionParameters?.filename || part.parameters?.name || "";
          if (!/\.(gz|zip|xml)$/i.test(fname)) continue;
          try {
            const dl = await client.download(String(msg.uid), part.part, { uid: true });
            const buf = await streamToBuffer(dl.content);
            const xml = decompress(fname, buf);
            if (!xml) continue;
            const parsed = parseAggregate(xml);
            if (parsed && (await storeReport(parsed))) ingested++;
          } catch (e: any) {
            console.error("[DMARC] part failed:", e?.message);
          }
        }
      }
    } finally { lock.release(); }
    lastSync = { at: new Date().toISOString(), ingested, scanned, error: null };
  } catch (e: any) {
    console.error("[DMARC] sync failed:", e?.message);
    lastSync = { at: new Date().toISOString(), ingested, scanned, error: e?.message || "sync failed" };
  } finally {
    try { await client.logout(); } catch {}
  }
  if (ingested > 0) console.log(`[DMARC] ingested ${ingested} new report(s) from ${scanned} scanned`);
  return { scanned, ingested };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function getDmarcOverview() {
  const cfg = getDmarcConfig();
  const totals = await pool.query(
    `SELECT
       coalesce(sum(count),0)::int AS total,
       coalesce(sum(count) FILTER (WHERE dkim_pass OR spf_pass),0)::int AS aligned_pass,
       coalesce(sum(count) FILTER (WHERE disposition='none'),0)::int AS delivered
     FROM dmarc_records r WHERE r.report_id IN (SELECT report_id FROM dmarc_reports WHERE received_at > now() - interval '30 days')`,
  ).catch(() => ({ rows: [{}] }));
  const t = totals.rows[0] || {};
  const total = Number(t.total || 0);
  const alignedPass = Number(t.aligned_pass || 0);

  const sources = await pool.query(
    `SELECT source_ip,
       sum(count)::int AS volume,
       sum(count) FILTER (WHERE dkim_pass OR spf_pass)::int AS pass,
       max(dkim_domain) AS dkim_domain
     FROM dmarc_records
     WHERE report_id IN (SELECT report_id FROM dmarc_reports WHERE received_at > now() - interval '30 days')
     GROUP BY source_ip ORDER BY volume DESC LIMIT 15`,
  ).catch(() => ({ rows: [] }));

  const recentReports = await pool.query(
    `SELECT org, domain, date_begin, date_end, received_at FROM dmarc_reports ORDER BY received_at DESC LIMIT 10`,
  ).catch(() => ({ rows: [] }));

  return {
    config: { configured: cfg.configured, user: cfg.user || null },
    syncStatus: { at: lastSync.at, error: lastSync.error },
    summary: { total, alignedPass, passRate: total ? Math.round((alignedPass / total) * 100) : 0 },
    sources: sources.rows.map((s: any) => ({
      sourceIp: s.source_ip, volume: Number(s.volume), pass: Number(s.pass),
      passRate: s.volume ? Math.round((Number(s.pass) / Number(s.volume)) * 100) : 0,
      dkimDomain: s.dkim_domain || null,
    })),
    reports: recentReports.rows.map((r: any) => ({
      org: r.org, domain: r.domain,
      begin: r.date_begin ? new Date(r.date_begin).toISOString() : null,
      end: r.date_end ? new Date(r.date_end).toISOString() : null,
      receivedAt: r.received_at ? new Date(r.received_at).toISOString() : null,
    })),
  };
}
