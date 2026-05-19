import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "./db";
import {
  franchisees,
  franchiseeChecklistItems,
  franchiseeTrainingProgress,
  franchiseeCertificates,
  disclaimerAcknowledgements,
  trainingAnnouncements,
} from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { CHECKLIST_ITEMS, TRAINING_TRACKS } from "../shared/training-content";
import { sendSlackMessage } from "./slack-service";

const router = Router();

// ─── Session helpers ────────────────────────────────────────────────────────

declare module "express-session" {
  interface SessionData {
    franchiseeId?: string;
  }
}

function requireFranchisee(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.franchiseeId) {
    return res.status(401).json({ error: "Not authenticated as franchisee" });
  }
  next();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  try {
    const [franchisee] = await db
      .select()
      .from(franchisees)
      .where(eq(franchisees.email, email.toLowerCase().trim()))
      .limit(1);

    if (!franchisee || franchisee.status !== "active") {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, franchisee.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    req.session.franchiseeId = franchisee.id;
    const { passwordHash: _pw, ...safe } = franchisee;
    return res.json({ franchisee: safe });
  } catch (err) {
    console.error("Franchisee login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.franchiseeId = undefined;
  res.json({ ok: true });
});

router.get("/me", requireFranchisee, async (req: Request, res: Response) => {
  try {
    const [franchisee] = await db
      .select()
      .from(franchisees)
      .where(eq(franchisees.id, req.session.franchiseeId!))
      .limit(1);
    if (!franchisee) return res.status(404).json({ error: "Not found" });
    const { passwordHash: _pw, ...safe } = franchisee;
    return res.json(safe);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// ─── Checklist ───────────────────────────────────────────────────────────────

router.get("/checklist", requireFranchisee, async (req: Request, res: Response) => {
  const franchiseeId = req.session.franchiseeId!;
  try {
    let items = await db
      .select()
      .from(franchiseeChecklistItems)
      .where(eq(franchiseeChecklistItems.franchiseeId, franchiseeId));

    // Seed checklist items if not yet created
    if (items.length === 0) {
      const toInsert = CHECKLIST_ITEMS.map((ci) => ({
        franchiseeId,
        itemKey: ci.key,
        status: "pending",
      }));
      await db.insert(franchiseeChecklistItems).values(toInsert);
      items = await db
        .select()
        .from(franchiseeChecklistItems)
        .where(eq(franchiseeChecklistItems.franchiseeId, franchiseeId));
    }

    // Enrich with content from constant
    const enriched = items.map((item) => ({
      ...item,
      content: CHECKLIST_ITEMS.find((ci) => ci.key === item.itemKey),
    }));

    return res.json(enriched);
  } catch (err) {
    console.error("Checklist fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch checklist" });
  }
});

router.put("/checklist/:key", requireFranchisee, async (req: Request, res: Response) => {
  const franchiseeId = req.session.franchiseeId!;
  const { key } = req.params as Record<string, string>;
  const { status, notes, documentUrl, documentName } = req.body;

  try {
    const [existing] = await db
      .select()
      .from(franchiseeChecklistItems)
      .where(
        and(
          eq(franchiseeChecklistItems.franchiseeId, franchiseeId),
          eq(franchiseeChecklistItems.itemKey, key)
        )
      )
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Item not found" });

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (documentUrl !== undefined) updates.documentUrl = documentUrl;
    if (documentName !== undefined) updates.documentName = documentName;
    if (status === "confirmed") updates.confirmedAt = new Date();

    await db
      .update(franchiseeChecklistItems)
      .set(updates)
      .where(
        and(
          eq(franchiseeChecklistItems.franchiseeId, franchiseeId),
          eq(franchiseeChecklistItems.itemKey, key)
        )
      );

    // Check if all items confirmed → update franchisee
    const allItems = await db
      .select()
      .from(franchiseeChecklistItems)
      .where(eq(franchiseeChecklistItems.franchiseeId, franchiseeId));

    const allConfirmed = allItems.every((i) => i.status === "confirmed");
    if (allConfirmed) {
      await db
        .update(franchisees)
        .set({ checklistComplete: true, updatedAt: new Date() })
        .where(eq(franchisees.id, franchiseeId));

      const [f] = await db.select().from(franchisees).where(eq(franchisees.id, franchiseeId));
      if (f) {
        sendSlackMessage(
          `✅ *${f.firstName} ${f.lastName}* has completed their Launch Checklist and is starting training.`
        ).catch(() => {});
      }
    }

    return res.json({ ok: true, allConfirmed });
  } catch (err) {
    console.error("Checklist update error:", err);
    return res.status(500).json({ error: "Failed to update checklist item" });
  }
});

// ─── Training modules & progress ─────────────────────────────────────────────

router.get("/training/tracks", requireFranchisee, async (req: Request, res: Response) => {
  const franchiseeId = req.session.franchiseeId!;
  try {
    const [franchisee] = await db
      .select()
      .from(franchisees)
      .where(eq(franchisees.id, franchiseeId))
      .limit(1);

    if (!franchisee?.checklistComplete) {
      return res.status(403).json({ error: "checklist_incomplete" });
    }

    const progress = await db
      .select()
      .from(franchiseeTrainingProgress)
      .where(eq(franchiseeTrainingProgress.franchiseeId, franchiseeId));

    const progressMap = Object.fromEntries(progress.map((p) => [p.moduleKey, p]));

    const tracks = TRAINING_TRACKS.map((track) => ({
      number: track.number,
      title: track.title,
      subtitle: track.subtitle,
      showDisclaimer: track.showDisclaimer ?? false,
      disclaimerBanner: track.disclaimerBanner,
      modules: track.modules.map((mod) => ({
        key: mod.key,
        track: mod.track,
        title: mod.title,
        description: mod.description,
        passMark: mod.passMark,
        requiresDisclaimerAck: mod.requiresDisclaimerAck,
        progress: progressMap[mod.key] ?? null,
      })),
    }));

    return res.json(tracks);
  } catch (err) {
    console.error("Tracks fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch tracks" });
  }
});

router.get("/training/module/:key", requireFranchisee, async (req: Request, res: Response) => {
  const franchiseeId = req.session.franchiseeId!;
  const { key } = req.params as Record<string, string>;

  try {
    const [franchisee] = await db
      .select()
      .from(franchisees)
      .where(eq(franchisees.id, franchiseeId))
      .limit(1);
    if (!franchisee?.checklistComplete) {
      return res.status(403).json({ error: "checklist_incomplete" });
    }

    const track = TRAINING_TRACKS.find((t) => t.modules.some((m) => m.key === key));
    const module = track?.modules.find((m) => m.key === key);
    if (!module) return res.status(404).json({ error: "Module not found" });

    // Check sequential unlock: all previous modules in the track must be complete
    const trackModules = track!.modules;
    const modIndex = trackModules.findIndex((m) => m.key === key);

    if (modIndex > 0) {
      const prevModules = trackModules.slice(0, modIndex);
      const progress = await db
        .select()
        .from(franchiseeTrainingProgress)
        .where(eq(franchiseeTrainingProgress.franchiseeId, franchiseeId));
      const doneKeys = new Set(progress.filter((p) => p.status === "completed").map((p) => p.moduleKey));
      const allPrevDone = prevModules.every((m) => doneKeys.has(m.key));
      if (!allPrevDone) {
        return res.status(403).json({ error: "module_locked" });
      }
    }

    // Check track sequential unlock (track N requires track N-1 complete)
    if (track!.number > 1) {
      const prevTrack = TRAINING_TRACKS.find((t) => t.number === track!.number - 1);
      if (prevTrack) {
        const progress = await db
          .select()
          .from(franchiseeTrainingProgress)
          .where(eq(franchiseeTrainingProgress.franchiseeId, franchiseeId));
        const doneKeys = new Set(progress.filter((p) => p.status === "completed").map((p) => p.moduleKey));
        const prevTrackDone = prevTrack.modules.every((m) => doneKeys.has(m.key));
        if (!prevTrackDone) {
          return res.status(403).json({ error: "track_locked" });
        }
      }
    }

    const [myProgress] = await db
      .select()
      .from(franchiseeTrainingProgress)
      .where(
        and(
          eq(franchiseeTrainingProgress.franchiseeId, franchiseeId),
          eq(franchiseeTrainingProgress.moduleKey, key)
        )
      )
      .limit(1);

    return res.json({ module, progress: myProgress ?? null });
  } catch (err) {
    console.error("Module fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch module" });
  }
});

router.post("/training/progress/:key", requireFranchisee, async (req: Request, res: Response) => {
  const franchiseeId = req.session.franchiseeId!;
  const { key } = req.params as Record<string, string>;
  const { status } = req.body;

  try {
    const [existing] = await db
      .select()
      .from(franchiseeTrainingProgress)
      .where(
        and(
          eq(franchiseeTrainingProgress.franchiseeId, franchiseeId),
          eq(franchiseeTrainingProgress.moduleKey, key)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.status !== "completed") {
        await db
          .update(franchiseeTrainingProgress)
          .set({ status, updatedAt: new Date() })
          .where(eq(franchiseeTrainingProgress.id, existing.id));
      }
    } else {
      await db.insert(franchiseeTrainingProgress).values({
        franchiseeId,
        moduleKey: key,
        status,
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update progress" });
  }
});

router.post("/training/quiz/:key", requireFranchisee, async (req: Request, res: Response) => {
  const franchiseeId = req.session.franchiseeId!;
  const { key } = req.params as Record<string, string>;
  const { answers } = req.body; // { [questionId]: selectedIndex }

  try {
    const track = TRAINING_TRACKS.find((t) => t.modules.some((m) => m.key === key));
    const module = track?.modules.find((m) => m.key === key);
    if (!module) return res.status(404).json({ error: "Module not found" });

    // Enforce 10-minute cooldown server-side
    const [existing] = await db
      .select()
      .from(franchiseeTrainingProgress)
      .where(
        and(
          eq(franchiseeTrainingProgress.franchiseeId, franchiseeId),
          eq(franchiseeTrainingProgress.moduleKey, key)
        )
      )
      .limit(1);

    if (existing?.status === "completed") {
      return res.json({ passed: true, score: existing.quizScore, alreadyPassed: true });
    }

    if (existing?.quizLastAttemptAt) {
      const msSince = Date.now() - new Date(existing.quizLastAttemptAt).getTime();
      const cooldownMs = 10 * 60 * 1000;
      if (msSince < cooldownMs) {
        const remainSec = Math.ceil((cooldownMs - msSince) / 1000);
        return res.status(429).json({
          error: "cooldown",
          message: `Please wait ${Math.ceil(remainSec / 60)} minute(s) before retrying.`,
          remainingSeconds: remainSec,
        });
      }
    }

    // Score the quiz
    let correct = 0;
    for (const q of module.quiz) {
      if (answers[q.id] === q.correctIndex) correct++;
    }
    const score = Math.round((correct / module.quiz.length) * 100);
    const passed = score >= module.passMark;
    const now = new Date();

    if (existing) {
      await db
        .update(franchiseeTrainingProgress)
        .set({
          quizScore: score,
          quizAttempts: (existing.quizAttempts ?? 0) + 1,
          quizLastAttemptAt: now,
          status: passed ? "completed" : "in_progress",
          completedAt: passed ? now : undefined,
          updatedAt: now,
        })
        .where(eq(franchiseeTrainingProgress.id, existing.id));
    } else {
      await db.insert(franchiseeTrainingProgress).values({
        franchiseeId,
        moduleKey: key,
        quizScore: score,
        quizAttempts: 1,
        quizLastAttemptAt: now,
        status: passed ? "completed" : "in_progress",
        completedAt: passed ? now : undefined,
      });
    }

    // If passed, check if entire track is complete → issue certificate
    if (passed) {
      const trackModules = track!.modules.map((m) => m.key);
      const allProgress = await db
        .select()
        .from(franchiseeTrainingProgress)
        .where(eq(franchiseeTrainingProgress.franchiseeId, franchiseeId));
      const doneKeys = new Set(allProgress.filter((p) => p.status === "completed").map((p) => p.moduleKey));
      doneKeys.add(key); // just passed
      const trackComplete = trackModules.every((mk) => doneKeys.has(mk));
      if (trackComplete) {
        const certType = `track_${track!.number}`;
        const [existingCert] = await db
          .select()
          .from(franchiseeCertificates)
          .where(
            and(
              eq(franchiseeCertificates.franchiseeId, franchiseeId),
              eq(franchiseeCertificates.type, certType)
            )
          )
          .limit(1);
        if (!existingCert) {
          await db.insert(franchiseeCertificates).values({ franchiseeId, type: certType });
          const [f] = await db.select().from(franchisees).where(eq(franchisees.id, franchiseeId));
          if (f) {
            sendSlackMessage(
              `🎓 *${f.firstName} ${f.lastName}* has completed Track ${track!.number}: ${track!.title} and earned their certificate.`
            ).catch(() => {});
          }
          // Check if all 6 tracks done → final cert
          const allTracksDone = TRAINING_TRACKS.every((t) =>
            t.modules.every((m) => doneKeys.has(m.key))
          );
          if (allTracksDone) {
            const [existingFinal] = await db
              .select()
              .from(franchiseeCertificates)
              .where(
                and(
                  eq(franchiseeCertificates.franchiseeId, franchiseeId),
                  eq(franchiseeCertificates.type, "final")
                )
              )
              .limit(1);
            if (!existingFinal) {
              await db.insert(franchiseeCertificates).values({ franchiseeId, type: "final" });
              const [f2] = await db.select().from(franchisees).where(eq(franchisees.id, franchiseeId));
              if (f2) {
                sendSlackMessage(
                  `🏆 *${f2.firstName} ${f2.lastName}* has earned their *Certified New Dawn Franchising Property Manager* certificate!`
                ).catch(() => {});
              }
            }
          }
        }
      }
    }

    return res.json({
      passed,
      score,
      passMark: module.passMark,
      correct,
      total: module.quiz.length,
    });
  } catch (err) {
    console.error("Quiz submission error:", err);
    return res.status(500).json({ error: "Failed to submit quiz" });
  }
});

// ─── Disclaimer acknowledgements ─────────────────────────────────────────────

router.post("/disclaimer/acknowledge", requireFranchisee, async (req: Request, res: Response) => {
  const franchiseeId = req.session.franchiseeId!;
  const { disclaimerType, version } = req.body;
  const ipAddress = req.ip ?? req.socket?.remoteAddress;

  if (!disclaimerType) return res.status(400).json({ error: "disclaimerType required" });

  try {
    await db.insert(disclaimerAcknowledgements).values({
      franchiseeId,
      disclaimerType,
      version: version ?? "1.0",
      ipAddress,
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to record acknowledgement" });
  }
});

router.get("/disclaimer/status", requireFranchisee, async (req: Request, res: Response) => {
  const franchiseeId = req.session.franchiseeId!;
  try {
    const acks = await db
      .select()
      .from(disclaimerAcknowledgements)
      .where(eq(disclaimerAcknowledgements.franchiseeId, franchiseeId));
    const ackSet = new Set(acks.map((a) => a.disclaimerType));
    return res.json({ acknowledged: Array.from(ackSet) });
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

// ─── Certificates ─────────────────────────────────────────────────────────────

router.get("/certificates", requireFranchisee, async (req: Request, res: Response) => {
  const franchiseeId = req.session.franchiseeId!;
  try {
    const certs = await db
      .select()
      .from(franchiseeCertificates)
      .where(eq(franchiseeCertificates.franchiseeId, franchiseeId));
    return res.json(certs);
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

// Public verification endpoint
router.get("/verify/:verificationId", async (req: Request, res: Response) => {
  const { verificationId } = req.params as Record<string, string>;
  try {
    const [cert] = await db
      .select()
      .from(franchiseeCertificates)
      .where(eq(franchiseeCertificates.verificationId, verificationId))
      .limit(1);
    if (!cert) return res.status(404).json({ valid: false });

    const [franchisee] = await db
      .select()
      .from(franchisees)
      .where(eq(franchisees.id, cert.franchiseeId))
      .limit(1);

    const certLabels: Record<string, string> = {
      track_1: "Welcome & Foundations",
      track_2: "The Property Management Business",
      track_3: "Finding & Winning Homeowner Clients",
      track_4: "Managing Properties & Tenants",
      track_5: "Marketing Your Property Management Business",
      track_6: "Compliance, Legal & Professional Standards",
      final: "Certified New Dawn Franchising Property Manager",
    };

    return res.json({
      valid: true,
      verificationId,
      franchiseeName: franchisee ? `${franchisee.firstName} ${franchisee.lastName}` : "Unknown",
      certType: certLabels[cert.type] ?? cert.type,
      issuedAt: cert.issuedAt,
    });
  } catch {
    return res.status(500).json({ error: "Verification failed" });
  }
});

// ─── Announcements ────────────────────────────────────────────────────────────

router.get("/announcements", requireFranchisee, async (req: Request, res: Response) => {
  try {
    const items = await db
      .select()
      .from(trainingAnnouncements)
      .orderBy(trainingAnnouncements.publishedAt);
    return res.json(items);
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

router.post("/announcements/:id/read", requireFranchisee, async (req: Request, res: Response) => {
  const franchiseeId = req.session.franchiseeId!;
  const { id } = req.params as Record<string, string>;
  try {
    const [ann] = await db
      .select()
      .from(trainingAnnouncements)
      .where(eq(trainingAnnouncements.id, id))
      .limit(1);
    if (!ann) return res.status(404).json({ error: "Not found" });
    const readBy = Array.isArray(ann.readBy) ? ann.readBy : [];
    if (!readBy.includes(franchiseeId)) {
      await db
        .update(trainingAnnouncements)
        .set({ readBy: [...readBy, franchiseeId] })
        .where(eq(trainingAnnouncements.id, id));
    }
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

// ─── Admin: manage franchisees ────────────────────────────────────────────────

router.get("/admin/franchisees", async (req: Request, res: Response) => {
  if (!(req.session as any)?.adminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const all = await db.select().from(franchisees).orderBy(franchisees.createdAt);
    return res.json(all.map(({ passwordHash: _pw, ...f }) => f));
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

router.post("/admin/franchisees", async (req: Request, res: Response) => {
  if (!(req.session as any)?.adminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { firstName, lastName, email, password, territory, calendlyUrl } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: "firstName, lastName, email, password required" });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [created] = await db
      .insert(franchisees)
      .values({ firstName, lastName, email: email.toLowerCase().trim(), passwordHash, territory, calendlyUrl })
      .returning();
    const { passwordHash: _pw, ...safe } = created;
    return res.status(201).json(safe);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Email already exists" });
    return res.status(500).json({ error: "Failed to create franchisee" });
  }
});

router.put("/admin/franchisees/:id", async (req: Request, res: Response) => {
  if (!(req.session as any)?.adminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { id } = req.params as Record<string, string>;
  const { status, trainingAccess, marketingAccess, territory, calendlyUrl, notes } = req.body;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updates.status = status;
    if (trainingAccess !== undefined) updates.trainingAccess = trainingAccess;
    if (marketingAccess !== undefined) updates.marketingAccess = marketingAccess;
    if (territory !== undefined) updates.territory = territory;
    if (calendlyUrl !== undefined) updates.calendlyUrl = calendlyUrl;
    if (notes !== undefined) updates.notes = notes;

    await db.update(franchisees).set(updates).where(eq(franchisees.id, id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

router.put("/admin/franchisees/:franchiseeId/checklist/:key/override", async (req: Request, res: Response) => {
  if (!(req.session as any)?.adminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { franchiseeId, key } = req.params as Record<string, string>;
  try {
    await db
      .update(franchiseeChecklistItems)
      .set({
        status: "confirmed",
        overriddenBy: "admin",
        overriddenAt: new Date(),
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(franchiseeChecklistItems.franchiseeId, franchiseeId),
          eq(franchiseeChecklistItems.itemKey, key)
        )
      );

    // Check if all confirmed now
    const allItems = await db
      .select()
      .from(franchiseeChecklistItems)
      .where(eq(franchiseeChecklistItems.franchiseeId, franchiseeId));
    const allConfirmed = allItems.length > 0 && allItems.every((i) => i.status === "confirmed");
    if (allConfirmed) {
      await db
        .update(franchisees)
        .set({ checklistComplete: true, updatedAt: new Date() })
        .where(eq(franchisees.id, franchiseeId));
    }

    return res.json({ ok: true, allConfirmed });
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

router.get("/admin/franchisees/:id/progress", async (req: Request, res: Response) => {
  if (!(req.session as any)?.adminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { id } = req.params as Record<string, string>;
  try {
    const checklist = await db
      .select()
      .from(franchiseeChecklistItems)
      .where(eq(franchiseeChecklistItems.franchiseeId, id));
    const progress = await db
      .select()
      .from(franchiseeTrainingProgress)
      .where(eq(franchiseeTrainingProgress.franchiseeId, id));
    const certs = await db
      .select()
      .from(franchiseeCertificates)
      .where(eq(franchiseeCertificates.franchiseeId, id));
    return res.json({ checklist, progress, certificates: certs });
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

router.post("/admin/announcements", async (req: Request, res: Response) => {
  if (!(req.session as any)?.adminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const { title, body, isUrgent } = req.body;
  if (!title || !body) return res.status(400).json({ error: "title and body required" });
  try {
    const [created] = await db
      .insert(trainingAnnouncements)
      .values({ title, body, isUrgent: isUrgent ?? false })
      .returning();
    return res.status(201).json(created);
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

// ─── Dashboard API ─────────────────────────────────────────────────────────────

// Demo data factory — scoped per franchisee (seeded from their ID for consistency)
function getDemoSummary(_franchiseeId: string) {
  return {
    activeLeads: 6, hotLeads: 2, consultationsBooked: 1, outreachSentToday: 8,
    emailsSentToday: 6, whatsappSentToday: 2, emailOpenRate: 42, replyRate: 9.5,
    activeProperties: 0, pipelineValue: 4320, avgManagementFee: 120,
    nextConsultation: { date: "Fri Apr 12 · 2:00 PM", name: "James" },
    hotLeadsVerified: 2, agentState: "pending",
  };
}

function getDemoPipelineHealth() {
  const stages = [
    { stage: "New Lead",       count: 4, color: "#94a3b8" },
    { stage: "Contacted",      count: 3, color: "#60a5fa" },
    { stage: "Replied",        count: 2, color: "#818cf8" },
    { stage: "Call Scheduled", count: 1, color: "#a78bfa" },
    { stage: "Call Completed", count: 1, color: "#c084fc" },
    { stage: "Proposal Sent",  count: 1, color: "#e879f9" },
    { stage: "Converted",      count: 1, color: "#10b981" },
  ];
  const conversions = [
    { from: "Contacted", to: "Replied",       rate: 67 },
    { from: "Replied",   to: "Call Scheduled",rate: 50 },
    { from: "Call Sch.", to: "Completed",      rate: 100 },
    { from: "Completed", to: "Converted",      rate: 100 },
  ];
  const tiers = [
    { tier: "Hot",     count: 2, color: "#ef4444" },
    { tier: "Warm",    count: 2, color: "#f97316" },
    { tier: "Nurture", count: 1, color: "#eab308" },
    { tier: "Watch",   count: 1, color: "#3b82f6" },
    { tier: "Cold",    count: 1, color: "#9ca3af" },
  ];
  const velocity = { leadToContact: 0.5, contactToConsultation: 8, consultationToSigned: null, bestSource: "Real estate agent referral", bestSourceRate: 100 };
  return { stages, conversions, tiers, velocity };
}

function getDemoOutreachPerformance() {
  return {
    email: { sent: 48, delivered: 47, deliveredPct: 98, opened: 20, openedPct: 42, replied: 4, repliedPct: 8.3, clicked: 3, clickedPct: 6.3, bounced: 1, unsubscribed: 0 },
    whatsapp: { sent: 36, delivered: 35, deliveredPct: 97, read: 28, readPct: 80, replied: 5, repliedPct: 14.3, optedOut: 1, connected: true },
    letters: { sentThisMonth: 1, inTransit: 1, delivered: 0, returned: 0, totalSpend: 3.40, avgCost: 3.40, consultationsFromLetters: 0 },
    approval: { daysInMonth: 9, daysBriefed: 7, daysApproved: 6, approvedPct: 86, daysHeld: 1, avgApprovalMins: 12 },
  };
}

function getDemoActivityFeed() {
  const now = new Date();
  const ago = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();
  return [
    { id: "1",  time: ago(0.5), type: "email_open",    icon: "email_open",   text: "James Thompson opened your follow-up email (x2)",                      leadName: "James Thompson" },
    { id: "2",  time: ago(1.5), type: "brief_sent",    icon: "brief",        text: "Daily brief sent — 8 outreach messages staged",                         leadName: null             },
    { id: "3",  time: ago(4),   type: "link_click",    icon: "link_click",   text: "James Thompson clicked your Calendly link",                              leadName: "James Thompson" },
    { id: "4",  time: ago(6),   type: "booking",       icon: "booking",      text: "James Thompson booked a consultation for Fri Apr 12 at 2:00 PM",         leadName: "James Thompson" },
    { id: "5",  time: ago(10),  type: "reply",         icon: "reply",        text: "Carlos Mendoza replied: \"Can we schedule a call next...\" [View →]",   leadName: "Carlos Mendoza" },
    { id: "6",  time: ago(18),  type: "email_sent",    icon: "email_sent",   text: "Email sent to Carlos Mendoza — Touch 2 of sequence",                     leadName: "Carlos Mendoza" },
    { id: "7",  time: ago(22),  type: "score_change",  icon: "score_up",     text: "James Thompson's score increased from 82 to 91 — consultation booked",   leadName: "James Thompson" },
    { id: "8",  time: ago(25),  type: "letter",        icon: "letter",       text: "Letter to James Thompson submitted to Lob — est. delivery Apr 11",        leadName: "James Thompson" },
    { id: "9",  time: ago(30),  type: "lead_found",    icon: "lead",         text: "New lead found: Angela Rivera, homeowner, El Paso TX — Score: 28 Cold",   leadName: "Angela Rivera"  },
    { id: "10", time: ago(36),  type: "brief_exec",    icon: "executed",     text: "Yesterday's brief executed — 6 messages sent",                            leadName: null             },
    { id: "11", time: ago(48),  type: "email_sent",    icon: "email_sent",   text: "Email sent to Patricia Williams — Touch 1 of sequence",                   leadName: "Patricia Williams" },
    { id: "12", time: ago(50),  type: "lead_found",    icon: "lead",         text: "New lead found: David Chen, homeowner, El Paso TX — Score: 39 Watch",     leadName: "David Chen"     },
  ];
}

function getDemoUpcomingActions() {
  return {
    today: [
      { label: "Approve today's brief",                        cta: "outreach",  priority: "high"   },
      { label: "2 leads need a follow-up today",               cta: "pipeline",  priority: "high"   },
      { label: "Consultation with James · Fri Apr 12, 2PM",    cta: "outreach",  priority: "medium" },
    ],
    thisWeek: [
      { label: "Carlos Mendoza — Touch 3 due in 2 days (no reply yet)", cta: "pipeline", priority: "medium" },
      { label: "1 HOT lead has no outreach scheduled yet",               cta: "pipeline", priority: "medium" },
    ],
    watch: [
      { label: "Maria Santos has been in 'Contacted' 18 days with no reply", cta: "pipeline", priority: "low" },
      { label: "1 lead decayed from WARM to NURTURE this week",              cta: "pipeline", priority: "low" },
    ],
  };
}

function getDemoSparklines() {
  const seed = (i: number, base: number, variance: number) => Math.round(base + Math.sin(i * 0.7) * variance + Math.random() * variance * 0.3);
  const days30 = Array.from({ length: 30 }, (_, i) => ({ day: i + 1 }));
  return {
    leadsPerDay:       days30.map((d, i) => ({ ...d, value: Math.max(0, seed(i, 2.5, 2)) })),
    outreachPerDay:    days30.map((d, i) => ({ ...d, email: Math.max(0, seed(i, 3, 2)), whatsapp: Math.max(0, seed(i, 2, 1.5)), letter: i === 8 || i === 21 ? 1 : 0 })),
    replyRateWeekly:   Array.from({ length: 8 }, (_, i) => ({ week: `W${i+1}`, rate: Math.max(3, seed(i, 8, 4)) })),
    consultationsWeekly: Array.from({ length: 8 }, (_, i) => ({ week: `W${i+1}`, booked: i === 7 ? 1 : Math.max(0, seed(i, 0.5, 1)) })),
  };
}

function getDemoLeads() {
  return [
    { id: "L1", name: "James Thompson",   score: 91, tier: "hot",     stage: "Call Scheduled", source: "Referral",    propertyCount: 5, address: "El Paso, TX 79902", daysInStage: 1,  lastActivity: "Today",      hasVerifiedAddress: true,  channels: { email: true, whatsapp: true, letter: true  }, letterStatus: "in_transit" },
    { id: "L2", name: "Carlos Mendoza",   score: 87, tier: "hot",     stage: "Contacted",      source: "Zillow",      propertyCount: 3, address: "El Paso, TX 79905", daysInStage: 2,  lastActivity: "2 days ago", hasVerifiedAddress: true,  channels: { email: true, whatsapp: true, letter: false }, letterStatus: null         },
    { id: "L3", name: "Patricia Williams",score: 72, tier: "warm",    stage: "New Lead",        source: "Facebook",    propertyCount: 1, address: "El Paso, TX 79901", daysInStage: 7,  lastActivity: "1 week ago", hasVerifiedAddress: false, channels: { email: true, whatsapp: false,letter: false }, letterStatus: null         },
    { id: "L4", name: "Robert Kim",       score: 65, tier: "warm",    stage: "Replied",         source: "Craigslist",  propertyCount: 2, address: "El Paso, TX 79907", daysInStage: 3,  lastActivity: "3 days ago", hasVerifiedAddress: true,  channels: { email: true, whatsapp: false,letter: false }, letterStatus: null         },
    { id: "L5", name: "Maria Santos",     score: 48, tier: "nurture", stage: "Contacted",       source: "Nextdoor",    propertyCount: 1, address: "El Paso, TX 79904", daysInStage: 18, lastActivity: "2 wks ago",  hasVerifiedAddress: false, channels: { email: true, whatsapp: false,letter: false }, letterStatus: null         },
    { id: "L6", name: "David Chen",       score: 39, tier: "watch",   stage: "New Lead",        source: "Google Ads",  propertyCount: 1, address: "El Paso, TX 79912", daysInStage: 5,  lastActivity: "5 days ago", hasVerifiedAddress: false, channels: { email: false,whatsapp: false,letter: false }, letterStatus: null         },
    { id: "L7", name: "Angela Rivera",    score: 28, tier: "cold",    stage: "New Lead",        source: "Zillow",      propertyCount: 1, address: "El Paso, TX 79915", daysInStage: 22, lastActivity: "3 wks ago",  hasVerifiedAddress: false, channels: { email: false,whatsapp: false,letter: false }, letterStatus: null         },
  ];
}

router.get("/dashboard/summary", requireFranchisee, async (req, res) => {
  const fId = (req.session as any).franchiseeId;
  return res.json(getDemoSummary(fId));
});

router.get("/dashboard/pipeline-health", requireFranchisee, async (req, res) => {
  return res.json(getDemoPipelineHealth());
});

router.get("/dashboard/outreach-performance", requireFranchisee, async (req, res) => {
  return res.json(getDemoOutreachPerformance());
});

router.get("/dashboard/activity-feed", requireFranchisee, async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const feed = getDemoActivityFeed().slice(0, limit);
  return res.json({ feed, total: getDemoActivityFeed().length });
});

router.get("/dashboard/upcoming-actions", requireFranchisee, async (req, res) => {
  return res.json(getDemoUpcomingActions());
});

router.get("/dashboard/sparklines", requireFranchisee, async (req, res) => {
  return res.json(getDemoSparklines());
});

router.get("/pipeline", requireFranchisee, async (req, res) => {
  return res.json(getDemoLeads());
});

router.patch("/pipeline/:leadId/stage", requireFranchisee, async (req, res) => {
  const { stage } = req.body;
  if (!stage) return res.status(400).json({ error: "stage required" });
  return res.json({ ok: true, leadId: req.params.leadId, stage });
});

router.get("/dashboard/preferences", requireFranchisee, async (req, res) => {
  const fId = (req.session as any).franchiseeId;
  try {
    const rows = await db.execute(
      sql`SELECT * FROM franchisee_dashboard_prefs WHERE franchisee_id = ${fId} LIMIT 1`
    );
    if (rows.rows.length === 0) {
      return res.json({ consultationTarget: 4, avgManagementFee: 120, defaultDateRange: 30, activityFeedAutoRefresh: true });
    }
    const r = rows.rows[0] as any;
    return res.json({ consultationTarget: r.consultation_target, avgManagementFee: r.avg_management_fee, defaultDateRange: r.default_date_range, activityFeedAutoRefresh: r.activity_feed_auto_refresh });
  } catch {
    return res.json({ consultationTarget: 4, avgManagementFee: 120, defaultDateRange: 30, activityFeedAutoRefresh: true });
  }
});

router.patch("/dashboard/preferences", requireFranchisee, async (req, res) => {
  const fId = (req.session as any).franchiseeId;
  const { consultationTarget, avgManagementFee, defaultDateRange, activityFeedAutoRefresh } = req.body;
  try {
    await db.execute(sql`
      INSERT INTO franchisee_dashboard_prefs (franchisee_id, consultation_target, avg_management_fee, default_date_range, activity_feed_auto_refresh)
      VALUES (${fId}, ${consultationTarget ?? 4}, ${avgManagementFee ?? 120}, ${defaultDateRange ?? 30}, ${activityFeedAutoRefresh ?? true})
      ON CONFLICT (franchisee_id) DO UPDATE SET
        consultation_target = EXCLUDED.consultation_target,
        avg_management_fee = EXCLUDED.avg_management_fee,
        default_date_range = EXCLUDED.default_date_range,
        activity_feed_auto_refresh = EXCLUDED.activity_feed_auto_refresh,
        updated_at = NOW()
    `);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
