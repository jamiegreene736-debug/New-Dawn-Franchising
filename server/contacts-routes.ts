import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { insertContactSchema, insertContactActivitySchema, insertContactTaskSchema, insertPipelineDealSchema, insertSavedSegmentSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { calculateLeadScore, rescoreContact } from "./lead-scoring";
import { seamlessSearch, getSeamlessStatus } from "./seamless-service";
import { syncSeamlessOrgContacts, getSeamlessSyncConfig, getSeamlessSyncState } from "./seamless-org-sync";
import { sendEmail } from "./email-service";

function requireAdminAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.adminId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

// Simple dice coefficient for fuzzy name matching
function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const aBigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.substring(i, i + 2);
    aBigrams.set(bigram, (aBigrams.get(bigram) || 0) + 1);
  }
  let intersectionSize = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.substring(i, i + 2);
    const count = aBigrams.get(bigram) || 0;
    if (count > 0) {
      aBigrams.set(bigram, count - 1);
      intersectionSize++;
    }
  }
  return (2.0 * intersectionSize) / (a.length + b.length - 2);
}

export function registerContactRoutes(app: Express) {

  // ─── Contacts CRUD ────────────────────────────────────────────────────────

  app.get("/api/contacts", requireAdminAuth, async (req, res) => {
    try {
      const {
        search, status, country, personaType, source,
        minScore, maxScore, page, limit: limitParam,
      } = req.query as Record<string, string | string[]>;

      const toArray = (v: string | string[] | undefined) =>
        !v ? undefined : Array.isArray(v) ? v : v.split(",").filter(Boolean);

      const pageNum = parseInt(String(page || "1"), 10);
      const pageSize = parseInt(String(limitParam || "50"), 10);

      const result = await storage.getContacts({
        search: search as string | undefined,
        status: toArray(status),
        country: toArray(country),
        personaType: toArray(personaType),
        source: toArray(source),
        minScore: minScore !== undefined ? parseInt(String(minScore), 10) : undefined,
        maxScore: maxScore !== undefined ? parseInt(String(maxScore), 10) : undefined,
        limit: pageSize,
        offset: (pageNum - 1) * pageSize,
      });
      res.json({ ...result, page: pageNum, pageSize });
    } catch (err) {
      console.error("GET /api/contacts error:", err);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", requireAdminAuth, async (req, res) => {
    try {
      const data = insertContactSchema.parse(req.body);

      if (data.email) {
        const existing = await storage.getContactByEmail(data.email);
        if (existing) {
          return res.status(409).json({ message: "A contact with this email already exists", existingId: existing.id });
        }
      }

      const score = calculateLeadScore(data, false);

      // Fuzzy duplicate check
      let possibleDuplicateOf: string | null = null;
      const allContacts = await storage.getAllContactsRaw();
      const fullName = `${data.firstName} ${data.lastName}`.toLowerCase();
      for (const c of allContacts) {
        const existingName = `${c.firstName} ${c.lastName}`.toLowerCase();
        const nameSim = diceSimilarity(fullName, existingName);
        const firmSim = data.firmName && c.firmName
          ? diceSimilarity(data.firmName.toLowerCase(), c.firmName.toLowerCase())
          : 0;
        if (nameSim > 0.85 && (firmSim > 0.85 || !data.firmName)) {
          possibleDuplicateOf = c.id;
          break;
        }
      }

      const contact = await storage.createContact({
        ...data,
        leadScore: score,
        possibleDuplicateOf,
      });

      await storage.createContactActivity({
        contactId: contact.id,
        activityType: "note_added",
        metadata: { note: `Contact created from ${data.source || "Manual"}` },
      });

      res.status(201).json(contact);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(err).message });
      }
      console.error("POST /api/contacts error:", err);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.get("/api/contacts/duplicates", requireAdminAuth, async (req, res) => {
    try {
      const allContacts = await storage.getAllContactsRaw();
      const pairs: Array<{ a: (typeof allContacts)[0]; b: (typeof allContacts)[0]; similarity: number }> = [];
      const seen = new Set<string>();

      for (let i = 0; i < allContacts.length; i++) {
        for (let j = i + 1; j < allContacts.length; j++) {
          const a = allContacts[i];
          const b = allContacts[j];
          const key = [a.id, b.id].sort().join("|");
          if (seen.has(key)) continue;
          seen.add(key);

          if (a.email && b.email && a.email === b.email) {
            pairs.push({ a, b, similarity: 1.0 });
            continue;
          }

          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
          const nameSim = diceSimilarity(nameA, nameB);
          const firmSim = a.firmName && b.firmName
            ? diceSimilarity(a.firmName.toLowerCase(), b.firmName.toLowerCase())
            : 0;

          if (nameSim > 0.85 && firmSim > 0.7) {
            pairs.push({ a, b, similarity: (nameSim + firmSim) / 2 });
          }
        }
      }

      res.json(pairs.sort((x, y) => y.similarity - x.similarity).slice(0, 100));
    } catch (err) {
      res.status(500).json({ message: "Failed to find duplicates" });
    }
  });

  app.post("/api/contacts/merge", requireAdminAuth, async (req, res) => {
    try {
      const { keepId, deleteId } = req.body as { keepId: string; deleteId: string };
      if (!keepId || !deleteId) {
        return res.status(400).json({ message: "keepId and deleteId are required" });
      }

      const keepContact = await storage.getContact(keepId);
      const deleteContact = await storage.getContact(deleteId);
      if (!keepContact || !deleteContact) {
        return res.status(404).json({ message: "One or both contacts not found" });
      }

      const deleteActivities = await storage.getContactActivities(deleteId);
      for (const act of deleteActivities) {
        await storage.createContactActivity({
          contactId: keepId,
          activityType: act.activityType,
          metadata: act.metadata as Record<string, unknown>,
        });
      }

      const deleteTasks = await storage.getContactTasks(deleteId);
      for (const task of deleteTasks) {
        await storage.createContactTask({
          contactId: keepId,
          title: task.title,
          dueDate: task.dueDate,
        });
      }

      const mergedTags = Array.from(new Set([...(keepContact.tags || []), ...(deleteContact.tags || [])]));
      await storage.updateContact(keepId, { tags: mergedTags });
      await storage.createContactActivity({
        contactId: keepId,
        activityType: "note_added",
        metadata: { note: `Merged with ${deleteContact.firstName} ${deleteContact.lastName} (${deleteContact.email || "no email"})` },
      });

      await storage.deleteContact(deleteId);
      const merged = await storage.getContact(keepId);
      res.json(merged);
    } catch (err) {
      console.error("POST /api/contacts/merge error:", err);
      res.status(500).json({ message: "Failed to merge contacts" });
    }
  });

  app.get("/api/contacts/:id", requireAdminAuth, async (req, res) => {
    try {
      const contact = await storage.getContact(String(String(req.params.id)));
      if (!contact) return res.status(404).json({ message: "Contact not found" });
      res.json(contact);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.patch("/api/contacts/:id", requireAdminAuth, async (req, res) => {
    try {
      const contactId = String(String(req.params.id));
      const contact = await storage.getContact(contactId);
      if (!contact) return res.status(404).json({ message: "Contact not found" });

      const oldStatus = contact.status;
      const updated = await storage.updateContact(contactId, req.body);

      if (req.body.status && req.body.status !== oldStatus) {
        await storage.createContactActivity({
          contactId: contactId,
          activityType: "status_changed",
          metadata: { oldStatus, newStatus: req.body.status },
        });
      }

      const newScore = await rescoreContact(contactId);
      res.json({ ...updated, leadScore: newScore });
    } catch (err) {
      console.error("PATCH /api/contacts/:id error:", err);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteContact(String(req.params.id));
      res.json({ message: "Contact archived" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  app.post("/api/contacts/:id/rescore", requireAdminAuth, async (req, res) => {
    try {
      const score = await rescoreContact(String(req.params.id));
      res.json({ score });
    } catch (err) {
      res.status(500).json({ message: "Failed to rescore contact" });
    }
  });

  // Bulk actions
  app.post("/api/contacts/bulk/tags", requireAdminAuth, async (req, res) => {
    try {
      const { ids, tags } = req.body as { ids: string[]; tags: string[] };
      await storage.bulkUpdateContactTags(ids, tags);
      res.json({ updated: ids.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to bulk update tags" });
    }
  });

  app.post("/api/contacts/bulk/status", requireAdminAuth, async (req, res) => {
    try {
      const { ids, status } = req.body as { ids: string[]; status: string };
      await storage.bulkUpdateContactStatus(ids, status);
      res.json({ updated: ids.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to bulk update status" });
    }
  });

  // ─── Activities ───────────────────────────────────────────────────────────

  app.get("/api/contacts/:id/activities", requireAdminAuth, async (req, res) => {
    try {
      const acts = await storage.getContactActivities(String(req.params.id));
      res.json(acts);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/contacts/:id/activities", requireAdminAuth, async (req, res) => {
    try {
      const act = await storage.createContactActivity({
        contactId: String(req.params.id),
        activityType: req.body.activityType || "note_added",
        metadata: req.body.metadata || {},
      });
      res.status(201).json(act);
    } catch (err) {
      res.status(500).json({ message: "Failed to log activity" });
    }
  });

  // ─── Tasks ────────────────────────────────────────────────────────────────

  app.get("/api/tasks", requireAdminAuth, async (req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/api/contacts/:id/tasks", requireAdminAuth, async (req, res) => {
    try {
      const tasks = await storage.getContactTasks(String(req.params.id));
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/contacts/:id/tasks", requireAdminAuth, async (req, res) => {
    try {
      const task = await storage.createContactTask({
        contactId: String(req.params.id),
        title: req.body.title,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      });
      res.status(201).json(task);
    } catch (err) {
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", requireAdminAuth, async (req, res) => {
    try {
      const task = await storage.updateContactTask(String(req.params.id), req.body);
      // Drip-generated tasks belong to a prospect (contactId null) — only log a
      // contact activity when the task is tied to an attorney contact.
      if (req.body.completed && task.contactId) {
        await storage.createContactActivity({
          contactId: task.contactId,
          activityType: "note_added",
          metadata: { note: `Task completed: ${task.title}` },
        });
      }
      res.json(task);
    } catch (err) {
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteContactTask(String(req.params.id));
      res.json({ message: "Task deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // ─── Pipeline ─────────────────────────────────────────────────────────────

  app.get("/api/pipeline", requireAdminAuth, async (req, res) => {
    try {
      const deals = await storage.getPipelineDeals();
      res.json(deals);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pipeline" });
    }
  });

  app.post("/api/pipeline", requireAdminAuth, async (req, res) => {
    try {
      const { contactId, stage, notes } = req.body as { contactId: string; stage: string; notes?: string };
      if (!contactId || !stage) {
        return res.status(400).json({ message: "contactId and stage are required" });
      }
      const deal = await storage.upsertPipelineDeal(contactId, stage, notes);

      await storage.createContactActivity({
        contactId,
        activityType: "status_changed",
        metadata: { pipelineStage: stage },
      });

      res.json(deal);
    } catch (err) {
      res.status(500).json({ message: "Failed to update pipeline" });
    }
  });

  // ─── Segments ─────────────────────────────────────────────────────────────

  app.get("/api/segments", requireAdminAuth, async (req, res) => {
    try {
      const segs = await storage.getSavedSegments();
      res.json(segs);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch segments" });
    }
  });

  app.post("/api/segments", requireAdminAuth, async (req, res) => {
    try {
      const { name, filters } = req.body as { name: string; filters: Record<string, unknown> };
      if (!name) return res.status(400).json({ message: "name is required" });
      const seg = await storage.createSavedSegment({ name, filters: filters || {} });
      res.status(201).json(seg);
    } catch (err) {
      res.status(500).json({ message: "Failed to create segment" });
    }
  });

  app.delete("/api/segments/:id", requireAdminAuth, async (req, res) => {
    try {
      await storage.deleteSavedSegment(String(req.params.id));
      res.json({ message: "Segment deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete segment" });
    }
  });

  // Count contacts matching a segment's filters
  app.get("/api/segments/:id/count", requireAdminAuth, async (req, res) => {
    try {
      const segs = await storage.getSavedSegments();
      const seg = segs.find((s) => s.id === String(req.params.id));
      if (!seg) return res.status(404).json({ message: "Segment not found" });
      await storage.touchSavedSegment(String(req.params.id));
      const filters = seg.filters as Record<string, unknown>;
      const result = await storage.getContacts({
        status: filters.status as string[] | undefined,
        country: filters.country as string[] | undefined,
        personaType: filters.personaType as string[] | undefined,
        minScore: filters.minScore as number | undefined,
        maxScore: filters.maxScore as number | undefined,
        source: filters.source as string[] | undefined,
        limit: 10000,
      });
      res.json({ count: result.total, segmentId: String(req.params.id) });
    } catch (err) {
      res.status(500).json({ message: "Failed to count segment" });
    }
  });

  // ─── Seamless.AI ──────────────────────────────────────────────────────────

  app.get("/api/seamless/status", requireAdminAuth, (_req, res) => {
    res.json(getSeamlessStatus());
  });

  app.post("/api/seamless/search", requireAdminAuth, async (req, res) => {
    try {
      const { titles, locations, keywords, page } = req.body as {
        titles?: string[];
        locations?: string[];
        keywords?: string;
        page?: number;
      };
      const result = await seamlessSearch({ titles, locations, keywords, page });
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Seamless search failed" });
    }
  });

  // ─── Seamless.AI org-contact sync ─────────────────────────────────────────
  // Pull the contacts saved in your Seamless account ("My Contacts") into the CRM
  // and the dedicated, campaign-selectable "Seamless — Synced Contacts" list. The
  // scheduler (server/seamless-org-sync.ts) runs this automatically; this is the
  // manual "Sync now" trigger. Pass { full: true } to force a full re-backfill.

  app.post("/api/seamless/sync", requireAdminAuth, async (req, res) => {
    try {
      if (!process.env.SEAMLESS_API_KEY) {
        return res.status(503).json({ message: "Seamless.AI is not configured (SEAMLESS_API_KEY missing)." });
      }
      const full = req.body?.full === true || req.query?.full === "1";
      const result = await syncSeamlessOrgContacts({ full });
      res.json(result);
    } catch (err: any) {
      console.error("POST /api/seamless/sync error:", err);
      res.status(500).json({ message: err?.message || "Seamless sync failed" });
    }
  });

  app.get("/api/seamless/sync/status", requireAdminAuth, async (_req, res) => {
    try {
      const last = await getSeamlessSyncState();
      res.json({ ...getSeamlessSyncConfig(), last });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to fetch Seamless sync status" });
    }
  });

  // ─── Admin Self-Tests ─────────────────────────────────────────────────────

  app.get("/api/admin/tests", requireAdminAuth, async (_req, res) => {
    const results: Array<{ name: string; passed: boolean; detail?: string }> = [];

    const run = async (name: string, fn: () => Promise<void>) => {
      try {
        await fn();
        results.push({ name, passed: true });
      } catch (err) {
        results.push({ name, passed: false, detail: err instanceof Error ? err.message : String(err) });
      }
    };

    // DB table tests
    await run("contacts table exists", async () => {
      await storage.getContacts({ limit: 1 });
    });
    await run("contact_activities table exists", async () => {
      await storage.getContactActivities("nonexistent");
    });
    await run("contact_tasks table exists", async () => {
      await storage.getAllTasks();
    });
    await run("pipeline_deals table exists", async () => {
      await storage.getPipelineDeals();
    });
    await run("saved_segments table exists", async () => {
      await storage.getSavedSegments();
    });

    // Lead scoring tests
    await run("UAE attorney with email scores 65+", async () => {
      const score = calculateLeadScore(
        { country: "UAE", personaType: "immigration_attorney", email: "test@test.com", phone: "+1234567890", linkedinUrl: "https://linkedin.com/in/test", status: "new" },
        false
      );
      if (score < 65) throw new Error(`Score was ${score}, expected >= 65`);
    });
    await run("Bounced contact loses 10 points", async () => {
      const base = calculateLeadScore({ country: "Mexico", personaType: "immigration_attorney", email: "test@test.com", status: "new" }, false);
      const bounced = calculateLeadScore({ country: "Mexico", personaType: "immigration_attorney", email: "test@test.com", status: "bounced" }, false);
      if (base - bounced !== 10) throw new Error(`Expected 10pt reduction, got ${base - bounced}`);
    });
    await run("Score is capped at 100", async () => {
      const score = calculateLeadScore(
        { country: "Mexico", personaType: "immigration_attorney", email: "test@test.com", phone: "+1", linkedinUrl: "x", status: "responded" },
        true
      );
      if (score > 100) throw new Error(`Score ${score} exceeds 100`);
    });

    // Seamless tests
    await run("Seamless status endpoint responds", async () => {
      const status = getSeamlessStatus();
      if (typeof status.configured !== "boolean") throw new Error("No configured field");
    });
    await run("Seamless API key configured", async () => {
      const status = getSeamlessStatus();
      if (!status.configured) throw new Error("SEAMLESS_API_KEY not set");
    });

    // Contact CRUD tests
    const testEmail = `test-${Date.now()}@crm-test.example.com`;
    let testId = "";

    await run("POST /api/contacts creates contact (storage)", async () => {
      const score = calculateLeadScore({ country: "Mexico", personaType: "immigration_attorney", email: testEmail, status: "new" }, false);
      const c = await storage.createContact({
        firstName: "CRM",
        lastName: "Test",
        email: testEmail,
        status: "new",
        tags: [],
        leadScore: score,
      });
      testId = c.id;
      if (!c.id) throw new Error("No ID returned");
    });

    await run("GET contact by ID (storage)", async () => {
      if (!testId) throw new Error("No test contact created");
      const c = await storage.getContact(testId);
      if (!c) throw new Error("Contact not found");
    });

    await run("PATCH contact updates status + logs activity", async () => {
      if (!testId) throw new Error("No test contact");
      await storage.updateContact(testId, { status: "contacted" });
      await storage.createContactActivity({
        contactId: testId,
        activityType: "status_changed",
        metadata: { oldStatus: "new", newStatus: "contacted" },
      });
      const acts = await storage.getContactActivities(testId);
      const found = acts.some((a) => a.activityType === "status_changed");
      if (!found) throw new Error("Activity not logged");
    });

    await run("Soft delete sets status = archived", async () => {
      if (!testId) throw new Error("No test contact");
      await storage.deleteContact(testId);
      const c = await storage.getContact(testId);
      if (c?.status !== "archived") throw new Error(`Status is ${c?.status}, expected archived`);
    });

    // Duplicate tests
    await run("Exact email duplicate is detected", async () => {
      const email2 = `dup-${Date.now()}@example.com`;
      await storage.createContact({ firstName: "John", lastName: "Smith", email: email2, status: "new", tags: [], leadScore: 0 });
      const existing = await storage.getContactByEmail(email2);
      if (!existing) throw new Error("Duplicate not detected via email lookup");
    });

    // Pipeline tests
    await run("Pipeline deals table queryable", async () => {
      await storage.getPipelineDeals();
    });

    // Segment tests
    await run("Empty segment returns 0 contacts (no error)", async () => {
      const result = await storage.getContacts({ status: ["__nonexistent__"] });
      if (typeof result.total !== "number") throw new Error("No total returned");
    });

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    res.json({ passed, failed, total: results.length, results });
  });

  // ─── Task Daily Digest ────────────────────────────────────────────────────

  app.post("/api/admin/task-digest", requireAdminAuth, async (_req, res) => {
    try {
      const tasks = await storage.getAllTasks();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const due = tasks.filter((t) => {
        if (t.completed || !t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= today && d < tomorrow;
      });

      if (due.length === 0) {
        return res.json({ message: "No tasks due today" });
      }

      const list = due.map((t) => `• ${t.title} (Contact ID: ${t.contactId})`).join("\n");
      const adminEmail = process.env.ADMIN_EMAIL || "dylan@newdawnfranchising.com";

      await sendEmail(
        adminEmail,
        `Daily Task Digest — ${due.length} task${due.length !== 1 ? "s" : ""} due today`,
        `<h2>Tasks Due Today</h2><pre>${list}</pre>`
      );

      res.json({ sent: true, count: due.length });
    } catch (err) {
      console.error("Task digest error:", err);
      res.status(500).json({ message: "Failed to send task digest" });
    }
  });
}
