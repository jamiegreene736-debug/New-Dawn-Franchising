import { sendEmailFromSender } from "./email-service";

const ALERT_TO = "jamie.greene736@gmail.com";
const ALERT_FROM = "dylan@newdawnfranchising.com";
const BASE_URL = process.env.BASE_URL || "https://www.newdawnfranchising.com";

export interface ApiHealthResult {
  name: string;
  key: string;
  status: "ok" | "error" | "unconfigured";
  message: string;
  latencyMs?: number;
  checkedAt: string;
  category: "ai" | "email" | "comms" | "data" | "analytics" | "platform";
}

// Track previous statuses to only alert on NEW failures
const previousStatuses = new Map<string, "ok" | "error" | "unconfigured">();

// Skip alerting on the very first check after startup — no baseline to compare against yet
let isFirstHealthCheck = true;

// ─── Individual API Checks ─────────────────────────────────────────────────────

async function checkOpenAI(): Promise<ApiHealthResult> {
  const key = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const start = Date.now();
  if (!key) return result("openai", "OpenAI", "unconfigured", "API key not set", undefined, "ai");
  try {
    // Use a minimal chat completion instead of /models — some proxy endpoints don't support GET /models
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as any;
      return result("openai", "OpenAI", "error", body?.error?.message || `HTTP ${res.status}`, Date.now() - start, "ai");
    }
    return result("openai", "OpenAI", "ok", "Chat completions responding", Date.now() - start, "ai");
  } catch (e: any) {
    return result("openai", "OpenAI", "error", e.message, Date.now() - start, "ai");
  }
}

async function checkApollo(): Promise<ApiHealthResult> {
  const key = process.env.APOLLO_API_KEY;
  const start = Date.now();
  if (!key) return result("apollo", "Apollo.io", "unconfigured", "API key not set", undefined, "data");
  try {
    const res = await fetch("https://api.apollo.io/api/v1/auth/health", {
      headers: { "Content-Type": "application/json", "x-api-key": key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return result("apollo", "Apollo.io", "error", `HTTP ${res.status}`, Date.now() - start, "data");
    const body = await res.json() as any;
    const isOk = body?.is_logged_in === true || res.ok;
    return result("apollo", "Apollo.io", isOk ? "ok" : "error", isOk ? "Authenticated" : "Auth failed", Date.now() - start, "data");
  } catch (e: any) {
    return result("apollo", "Apollo.io", "error", e.message, Date.now() - start, "data");
  }
}

async function checkHunter(): Promise<ApiHealthResult> {
  const key = process.env.HUNTER_API_KEY;
  const start = Date.now();
  if (!key) return result("hunter", "Hunter.io", "unconfigured", "API key not set", undefined, "data");
  try {
    const res = await fetch(`https://api.hunter.io/v2/account?api_key=${key}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return result("hunter", "Hunter.io", "error", `HTTP ${res.status}`, Date.now() - start, "data");
    const body = await res.json() as any;
    const plan = body?.data?.plan_name;
    const searches = body?.data?.requests?.searches?.available;
    return result("hunter", "Hunter.io", "ok", `Plan: ${plan || "active"} · ${searches ?? "?"} searches left`, Date.now() - start, "data");
  } catch (e: any) {
    return result("hunter", "Hunter.io", "error", e.message, Date.now() - start, "data");
  }
}

async function checkApify(): Promise<ApiHealthResult> {
  const key = process.env.APIFY_API_TOKEN;
  const start = Date.now();
  if (!key) return result("apify", "Apify", "unconfigured", "API token not set", undefined, "data");
  try {
    const res = await fetch(`https://api.apify.com/v2/users/me?token=${key}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return result("apify", "Apify", "error", `HTTP ${res.status}`, Date.now() - start, "data");
    const body = await res.json() as any;
    const plan = body?.data?.subscription?.plan?.name;
    return result("apify", "Apify", "ok", `User: ${body?.data?.username || "ok"}${plan ? ` · ${plan}` : ""}`, Date.now() - start, "data");
  } catch (e: any) {
    return result("apify", "Apify", "error", e.message, Date.now() - start, "data");
  }
}

async function checkCalendly(): Promise<ApiHealthResult> {
  const key = process.env.CALENDLY_API_KEY;
  const start = Date.now();
  if (!key) return result("calendly", "Calendly", "unconfigured", "API key not set", undefined, "platform");
  try {
    const res = await fetch("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return result("calendly", "Calendly", "error", `HTTP ${res.status}`, Date.now() - start, "platform");
    const body = await res.json() as any;
    return result("calendly", "Calendly", "ok", `User: ${body?.resource?.name || "ok"}`, Date.now() - start, "platform");
  } catch (e: any) {
    return result("calendly", "Calendly", "error", e.message, Date.now() - start, "platform");
  }
}

async function checkQuo(): Promise<ApiHealthResult> {
  const key = process.env.QUO_API_KEY;
  const start = Date.now();
  if (!key) return result("quo", "Quo (SMS)", "unconfigured", "QUO_API_KEY not set", undefined, "comms");
  try {
    const res = await fetch("https://api.openphone.com/v1/phone-numbers", {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return result("quo", "Quo (SMS)", "error", `HTTP ${res.status}`, Date.now() - start, "comms");
    const body = await res.json() as any;
    const count = body?.data?.length ?? 0;
    return result("quo", "Quo (SMS)", "ok", `${count} number${count !== 1 ? "s" : ""} active`, Date.now() - start, "comms");
  } catch (e: any) {
    return result("quo", "Quo (SMS)", "error", e.message, Date.now() - start, "comms");
  }
}

async function checkMetaWhatsApp(): Promise<ApiHealthResult> {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const start = Date.now();
  if (!token || !phoneId) return result("meta_whatsapp", "WhatsApp (Meta)", "unconfigured", "META_WHATSAPP_ACCESS_TOKEN or META_WHATSAPP_PHONE_NUMBER_ID not set", undefined, "comms");
  try {
    const res = await fetch(`https://graph.facebook.com/v23.0/${phoneId}?access_token=${token}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return result("meta_whatsapp", "WhatsApp (Meta)", "error", `HTTP ${res.status}`, Date.now() - start, "comms");
    const body = await res.json() as any;
    const name = body?.display_phone_number || body?.verified_name || "Ready";
    return result("meta_whatsapp", "WhatsApp (Meta)", "ok", name, Date.now() - start, "comms");
  } catch (e: any) {
    return result("meta_whatsapp", "WhatsApp (Meta)", "error", e.message, Date.now() - start, "comms");
  }
}

async function checkSerpAPI(): Promise<ApiHealthResult> {
  const key = process.env.SERPAPI_KEY;
  const start = Date.now();
  if (!key) return result("serpapi", "SerpAPI", "unconfigured", "API key not set", undefined, "analytics");
  try {
    const res = await fetch(`https://serpapi.com/account.json?api_key=${key}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return result("serpapi", "SerpAPI", "error", `HTTP ${res.status}`, Date.now() - start, "analytics");
    const body = await res.json() as any;
    const searches = body?.searches_per_month_used;
    const limit = body?.searches_per_month;
    return result("serpapi", "SerpAPI", "ok", `${searches ?? "?"}/${limit ?? "?"} searches used this month`, Date.now() - start, "analytics");
  } catch (e: any) {
    return result("serpapi", "SerpAPI", "error", e.message, Date.now() - start, "analytics");
  }
}

async function checkSlack(): Promise<ApiHealthResult> {
  const value = process.env.SLACK_WEBHOOK_URL;
  const start = Date.now();
  if (!value) return result("slack", "Slack", "unconfigured", "Not configured", undefined, "comms");

  // Determine type: webhook URL vs OAuth token
  const isWebhook = value.startsWith("https://");
  const isToken = value.startsWith("xox");

  try {
    if (isWebhook) {
      // Test webhook URL with an empty payload — Slack returns "no_text" for valid webhooks
      const res = await fetch(value, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      if (res.ok || text === "no_text") return result("slack", "Slack", "ok", "Webhook reachable", Date.now() - start, "comms");
      return result("slack", "Slack", "error", `Webhook error: ${text}`, Date.now() - start, "comms");
    } else if (isToken) {
      // Test OAuth token with auth.test
      const res = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: { Authorization: `Bearer ${value}`, "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(8000),
      });
      const body = await res.json() as any;
      if (body.ok) return result("slack", "Slack", "ok", `Workspace: ${body.team || "connected"}`, Date.now() - start, "comms");
      return result("slack", "Slack", "error", body.error || "Auth failed", Date.now() - start, "comms");
    } else {
      return result("slack", "Slack", "error", "Unrecognised credential format — expected webhook URL or xox* token", Date.now() - start, "comms");
    }
  } catch (e: any) {
    return result("slack", "Slack", "error", e.message, Date.now() - start, "comms");
  }
}

async function checkGmailDylan(): Promise<ApiHealthResult> {
  const pass = process.env.GMAIL_APP_PASSWORD_DYLAN;
  const start = Date.now();
  if (!pass) return result("gmail_dylan", "Gmail (dylan@)", "unconfigured", "App password not set — IMAP reply detection disabled", undefined, "email");
  const clean = pass.replace(/\s/g, "");
  if (clean.length !== 16) return result("gmail_dylan", "Gmail (dylan@)", "error", "App password appears malformed (should be 16 chars)", Date.now() - start, "email");
  return result("gmail_dylan", "Gmail (dylan@)", "ok", "Credentials present — IMAP polling active", Date.now() - start, "email");
}

async function checkZeroBounce(): Promise<ApiHealthResult> {
  const key = process.env.ZEROBOUNCE_API_KEY;
  const start = Date.now();
  if (!key) return result("zerobounce", "ZeroBounce", "unconfigured", "API key not set", undefined, "data");
  try {
    const res = await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${key}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return result("zerobounce", "ZeroBounce", "error", `HTTP ${res.status}`, Date.now() - start, "data");
    const body = await res.json() as any;
    const credits = body?.Credits;
    if (credits === -1 || credits === "-1") return result("zerobounce", "ZeroBounce", "error", "Invalid API key", Date.now() - start, "data");
    return result("zerobounce", "ZeroBounce", "ok", `${credits} credits remaining`, Date.now() - start, "data");
  } catch (e: any) {
    return result("zerobounce", "ZeroBounce", "error", e.message, Date.now() - start, "data");
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function result(
  key: string, name: string,
  status: "ok" | "error" | "unconfigured",
  message: string, latencyMs?: number,
  category: ApiHealthResult["category"] = "platform",
): ApiHealthResult {
  return { key, name, status, message, latencyMs, checkedAt: new Date().toISOString(), category };
}

// ─── Run All Checks ───────────────────────────────────────────────────────────

export async function runAllHealthChecks(): Promise<ApiHealthResult[]> {
  const results = await Promise.allSettled([
    checkOpenAI(),
    checkApollo(),
    checkHunter(),
    checkApify(),
    checkCalendly(),
    checkQuo(),
    checkMetaWhatsApp(),
    checkSerpAPI(),
    checkSlack(),
    checkGmailDylan(),
    checkZeroBounce(),
  ]);

  return results.map(r => r.status === "fulfilled" ? r.value : {
    key: "unknown", name: "Unknown", status: "error" as const,
    message: (r as PromiseRejectedResult).reason?.message || "Check failed",
    checkedAt: new Date().toISOString(), category: "platform" as const,
  });
}

// ─── Alerting ─────────────────────────────────────────────────────────────────

export async function checkAndAlertApiHealth(): Promise<ApiHealthResult[]> {
  return runHealthCheckWithAlerts();
}

async function sendApiAlertEmail(failures: ApiHealthResult[], allChecks: ApiHealthResult[]) {
  const failureRows = failures.map(f => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #fee2e2;">
        <strong style="color:#b91c1c;">${f.name}</strong>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #fee2e2;color:#374151;">${f.message}</td>
    </tr>`).join("");

  const allRows = allChecks.map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${c.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">
        <span style="color:${c.status === "ok" ? "#16a34a" : c.status === "error" ? "#dc2626" : "#6b7280"};">
          ${c.status === "ok" ? "✅ OK" : c.status === "error" ? "🔴 ERROR" : "⚪ Not set"}
        </span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${c.message}</td>
    </tr>`).join("");

  const subject = `🚨 API Alert — ${failures.length} service${failures.length > 1 ? "s" : ""} down | New Dawn Franchising`;

  const html = `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1a1a2e;">
  <div style="background:#1a2a4a;padding:20px 28px;border-radius:8px 8px 0 0;">
    <span style="color:#fff;font-size:18px;font-weight:700;">🚨 API Health Alert</span>
    <span style="color:#a0b4d0;font-size:13px;margin-left:12px;">New Dawn Franchising</span>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;">
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-weight:700;color:#b91c1c;font-size:15px;">
        ${failures.length} API service${failures.length > 1 ? "s have" : " has"} gone offline
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;">Detected at ${new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })} CT</p>
    </div>

    <h3 style="font-size:14px;font-weight:700;color:#1a2a4a;margin:0 0 8px;">❌ Newly Failed</h3>
    <table style="width:100%;border-collapse:collapse;background:#fef2f2;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#fee2e2;">
          <th style="padding:10px 14px;text-align:left;font-size:13px;color:#7f1d1d;">Service</th>
          <th style="padding:10px 14px;text-align:left;font-size:13px;color:#7f1d1d;">Error</th>
        </tr>
      </thead>
      <tbody>${failureRows}</tbody>
    </table>

    <h3 style="font-size:14px;font-weight:700;color:#1a2a4a;margin:0 0 8px;">📊 Full API Status Snapshot</h3>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Service</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Status</th>
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;">Details</th>
        </tr>
      </thead>
      <tbody>${allRows}</tbody>
    </table>

    <div style="margin-top:20px;padding:16px;background:#f0f9ff;border-radius:8px;border-left:4px solid #0ea5e9;">
      <p style="margin:0;font-size:13px;color:#0c4a6e;">
        <strong>Action required:</strong> Log in to the admin portal and go to the <strong>API Status</strong> tab to run a fresh check and resolve the issue.
      </p>
      <p style="margin:8px 0 0;">
        <a href="${BASE_URL}/crm" style="color:#0ea5e9;font-size:13px;font-weight:600;">→ Open Admin Portal</a>
      </p>
    </div>

    <p style="font-size:12px;color:#9ca3af;margin-top:20px;">
      This alert was sent automatically by the New Dawn Franchising API Health Monitor.<br/>
      You will only receive this email when a service newly goes offline — not on every check.
    </p>
  </div>
</div>`;

  try {
    await sendEmailFromSender(ALERT_FROM, ALERT_TO, subject, html);
    console.log(`[ApiHealth] Alert email sent to ${ALERT_TO} for ${failures.length} failure(s)`);
  } catch (e) {
    console.error("[ApiHealth] Failed to send alert email:", e);
  }
}

// ─── Recovery alert ──────────────────────────────────────────────────────────

export async function sendRecoveryAlert(recovered: ApiHealthResult[]) {
  if (recovered.length === 0) return;
  const names = recovered.map(r => r.name).join(", ");
  const subject = `✅ API Recovered — ${names} | New Dawn Franchising`;
  const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
  <div style="background:#1a2a4a;padding:18px 24px;border-radius:8px 8px 0 0;">
    <span style="color:#fff;font-size:17px;font-weight:700;">✅ API Recovery Notice</span>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:22px 24px;border-radius:0 0 8px 8px;">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;">
      <p style="margin:0;font-weight:700;color:#15803d;">The following services have recovered and are back online:</p>
      <ul style="margin:8px 0 0;padding-left:18px;">
        ${recovered.map(r => `<li style="color:#166534;font-size:14px;">${r.name} — ${r.message}</li>`).join("")}
      </ul>
    </div>
    <p style="font-size:12px;color:#9ca3af;margin-top:18px;">New Dawn Franchising API Health Monitor</p>
  </div>
</div>`;

  try {
    await sendEmailFromSender(ALERT_FROM, ALERT_TO, subject, html);
  } catch (e) {
    console.error("[ApiHealth] Failed to send recovery email:", e);
  }
}

// Enhanced check with recovery detection
export async function runHealthCheckWithAlerts(): Promise<ApiHealthResult[]> {
  const checks = await runAllHealthChecks();
  const newFailures: ApiHealthResult[] = [];
  const recovered: ApiHealthResult[] = [];

  for (const check of checks) {
    const prev = previousStatuses.get(check.key);
    if (check.status === "error" && prev !== "error") newFailures.push(check);
    if (check.status === "ok" && prev === "error") recovered.push(check);
    previousStatuses.set(check.key, check.status);
  }

  // On first run after startup, just build the baseline — don't alert.
  // This prevents a flood of "new failure" emails every time the server restarts/deploys.
  if (isFirstHealthCheck) {
    isFirstHealthCheck = false;
    console.log(`[ApiHealth] Baseline established on startup — ${checks.filter(c => c.status === "error").length} existing errors suppressed (not new).`);
    return checks;
  }

  if (newFailures.length > 0) await sendApiAlertEmail(newFailures, checks);
  if (recovered.length > 0) await sendRecoveryAlert(recovered);

  return checks;
}
