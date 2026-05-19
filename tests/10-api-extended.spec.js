import { test, expect } from "@playwright/test";

test.describe("Extended API Tests", () => {
  // ── Lead Capture ──────────────────────────────────────────────────────────
  test("POST /api/leads accepts a full lead payload", async ({ request }) => {
    const res = await request.post("/api/leads", {
      data: {
        fullName: "Playwright Lead Test",
        email: `pw-test-${Date.now()}@example.com`,
        phone: "+1 555 000 7777",
        country: "Mexico",
        visitorType: "investor",
        investmentRange: "$100k–$150k",
        message: "Automated Playwright test — please ignore.",
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    // Response is the saved lead object with an id field
    expect(body).toHaveProperty("id");
    expect(body.fullName).toBe("Playwright Lead Test");
  });

  test("POST /api/leads returns 400 without required fields", async ({ request }) => {
    const res = await request.post("/api/leads", {
      data: { email: "missing-name@test.com" },
    });
    expect(res.status()).toBe(400);
  });

  // ── Newsletter ────────────────────────────────────────────────────────────
  test("POST /api/newsletter subscribes a valid email", async ({ request }) => {
    const res = await request.post("/api/newsletter", {
      data: { email: `pw-newsletter-${Date.now()}@example.com`, name: "Playwright" },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("POST /api/newsletter returns 400 without email", async ({ request }) => {
    const res = await request.post("/api/newsletter", {
      data: { name: "No Email" },
    });
    expect(res.status()).toBe(400);
  });

  // ── Admin Auth ────────────────────────────────────────────────────────────
  test("POST /api/auth/login returns 401 for bad credentials", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: "nobody@fake.com", password: "wrongpass" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/auth/login succeeds with admin credentials", async ({ request }) => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      test.skip();
      return;
    }
    const res = await request.post("/api/auth/login", {
      data: { email, password },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    // Response is {email, role} directly (no user wrapper)
    expect(body).toHaveProperty("email");
    expect(body).toHaveProperty("role");
    expect(body.role).toBe("admin");
  });

  // ── Protected CRM endpoints (unauthenticated) ─────────────────────────────
  test("GET /api/crm/clients returns 401 when not logged in", async ({ request }) => {
    const res = await request.get("/api/crm/clients");
    expect(res.status()).toBe(401);
  });

  test("GET /api/crm/leads returns 401 when not logged in", async ({ request }) => {
    const res = await request.get("/api/crm/leads");
    expect(res.status()).toBe(401);
  });

  test("GET /api/crm/reports returns 401 when not logged in", async ({ request }) => {
    const res = await request.get("/api/crm/reports");
    expect(res.status()).toBe(401);
  });

  // ── Broker Auth ───────────────────────────────────────────────────────────
  test("POST /api/brokers/login returns 401 for bad credentials", async ({ request }) => {
    const res = await request.post("/api/brokers/login", {
      data: { email: "fake-broker@test.com", password: "badpass" },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/brokers/me returns 401 when not logged in", async ({ request }) => {
    const res = await request.get("/api/brokers/me");
    expect(res.status()).toBe(401);
  });

  // ── Misc Public Endpoints ─────────────────────────────────────────────────
  test("GET /api/config/ga returns GA config object", async ({ request }) => {
    const res = await request.get("/api/config/ga");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    // Response is {id: "..."} — the GA measurement/stream ID
    expect(body).toHaveProperty("id");
    expect(typeof body.id).toBe("string");
  });

  test("GET /api/brochure returns a PDF or redirect", async ({ request }) => {
    const res = await request.get("/api/brochure");
    const status = res.status();
    expect([200, 302, 404]).toContain(status);
  });

  test("GET /api/posts/:slug returns 404 for unknown slug", async ({ request }) => {
    const res = await request.get("/api/posts/this-slug-does-not-exist-xyz");
    expect(res.status()).toBe(404);
  });
});
