import { test, expect, request } from "@playwright/test";

test.describe("API Health Checks", () => {
  test("GET /api/config/whatsapp returns a phone number", async ({ request }) => {
    const res = await request.get("/api/config/whatsapp");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty("number");
    expect(typeof body.number).toBe("string");
    expect(body.number.length).toBeGreaterThan(5);
  });

  test("GET /api/posts returns an array of blog posts", async ({ request }) => {
    const res = await request.get("/api/posts");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("POST /api/chat returns a non-empty reply", async ({ request }) => {
    const res = await request.post("/api/chat", {
      data: { messages: [{ role: "user", content: "What is the E-2 visa?" }] },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty("reply");
    expect(typeof body.reply).toBe("string");
    expect(body.reply.length).toBeGreaterThan(10);
  }, 35000);

  test("POST /api/contact/message saves valid payload", async ({ request }) => {
    const res = await request.post("/api/contact/message", {
      data: {
        name: "Playwright API Test",
        phone: "+1 555-000-9000",
        message: "Automated test — please ignore.",
      },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test("POST /api/contact/message returns 400 without required fields", async ({ request }) => {
    const res = await request.post("/api/contact/message", {
      data: { message: "Missing name" },
    });
    expect(res.status()).toBe(400);
  });

  test("GET /sitemap.xml returns valid XML", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text).toContain("<urlset");
  });

  test("GET /robots.txt returns valid content", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBe(true);
    const text = await res.text();
    expect(text).toContain("User-agent");
  });
});
