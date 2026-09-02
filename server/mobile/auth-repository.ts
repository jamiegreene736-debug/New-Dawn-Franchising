import type { Pool, PoolClient, QueryResultRow } from "pg";
import { z } from "zod";

import { mobileRoleSchema, type MobileRole } from "@shared/mobile/contracts";

const identityAuthRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string().nullable(),
  status: z.string(),
  emailVerifiedAt: z.date().nullable(),
  failedLoginCount: z.number().int().nonnegative(),
  lockedUntil: z.date().nullable(),
  activeRoles: z.array(mobileRoleSchema),
});

const tokenIdentityRowSchema = z.object({
  tokenId: z.string().uuid(),
  identityId: z.string().uuid(),
  email: z.string().email(),
  expiresAt: z.date(),
  usedAt: z.date().nullable(),
});

const refreshSessionRowSchema = z.object({
  id: z.string().uuid(),
  identityId: z.string().uuid(),
  email: z.string().email(),
  tokenHash: z.string(),
  tokenFamilyId: z.string().uuid(),
  deviceLabel: z.string().nullable(),
  expiresAt: z.date(),
  rotatedAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
  reuseDetectedAt: z.date().nullable(),
});

const sessionListRowSchema = z.object({
  id: z.string().uuid(),
  deviceLabel: z.string().nullable(),
  createdAt: z.date(),
  lastUsedAt: z.date().nullable(),
  expiresAt: z.date(),
});

export type MobileIdentityAuthRecord = z.infer<typeof identityAuthRowSchema>;
export type MobileSessionListRecord = z.infer<typeof sessionListRowSchema>;

export type CreateRegistrationInput = {
  normalizedEmail: string;
  passwordHash: string;
  role: "investor" | "partner";
  tokenHash: string;
  requestId: string;
  tokenExpiresAt: Date;
  now: Date;
};

export type CreateSessionInput = {
  identityId: string;
  tokenHash: string;
  tokenFamilyId: string;
  deviceLabel: string | null;
  expiresAt: Date;
  requestId: string;
  now: Date;
};

export type VerifiedIdentityResult =
  | { outcome: "invalid" }
  | { outcome: "pending_approval" }
  | {
    outcome: "authenticated";
    identityId: string;
    email: string;
    roles: MobileRole[];
    sessionId: string;
  };

export type RotateSessionResult =
  | { outcome: "invalid" | "expired" | "revoked" | "reuse_detected" }
  | {
    outcome: "rotated";
    identityId: string;
    email: string;
    roles: MobileRole[];
    sessionId: string;
  };

export type ActivePrincipalRecord = {
  identityId: string;
  email: string;
  roles: MobileRole[];
};

export interface MobileAuthRepository {
  createRegistration(input: CreateRegistrationInput): Promise<{ created: boolean }>;
  verifyEmailAndCreateSession(input: {
    verificationTokenHash: string;
    refreshSession: Omit<CreateSessionInput, "identityId">;
    requestId: string;
    now: Date;
  }): Promise<VerifiedIdentityResult>;
  findIdentityForLogin(normalizedEmail: string): Promise<MobileIdentityAuthRecord | null>;
  recordFailedLogin(identityId: string, lockedUntil: Date | null, requestId: string, now: Date): Promise<void>;
  createLoginSession(input: CreateSessionInput): Promise<string>;
  rotateRefreshSession(input: {
    currentTokenHash: string;
    nextTokenHash: string;
    nextExpiresAt: Date;
    requestId: string;
    now: Date;
  }): Promise<RotateSessionResult>;
  readActivePrincipal(identityId: string, sessionId: string, now: Date): Promise<ActivePrincipalRecord | null>;
  revokeByRefreshTokenHash(tokenHash: string, requestId: string, now: Date, reason: string): Promise<void>;
  listSessions(identityId: string, now: Date): Promise<MobileSessionListRecord[]>;
  revokeOwnedSession(identityId: string, sessionId: string, requestId: string, now: Date): Promise<boolean>;
  createRecoveryToken(input: {
    normalizedEmail: string;
    tokenHash: string;
    requestId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean>;
  completeRecovery(input: {
    tokenHash: string;
    passwordHash: string;
    requestId: string;
    now: Date;
  }): Promise<boolean>;
  requestDeletion(identityId: string, requestId: string, now: Date): Promise<void>;
}

type QueryClient = Pick<PoolClient, "query">;

async function activeRoles(client: QueryClient, identityId: string): Promise<MobileRole[]> {
  const result = await client.query(
    `select role
       from mobile_identity_roles
      where identity_id = $1 and status = 'active'
      order by role`,
    [identityId],
  );
  return z.array(z.object({ role: mobileRoleSchema })).parse(result.rows).map((row) => row.role);
}

async function withTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original transactional error.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function writeAuditEvent(client: QueryClient, input: {
  actorIdentityId: string | null;
  eventType: string;
  subjectType: string;
  subjectId: string | null;
  requestId: string;
  now: Date;
}): Promise<void> {
  await client.query(
    `insert into mobile_audit_events
       (actor_identity_id, event_type, subject_type, subject_id, request_id, created_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      input.actorIdentityId,
      input.eventType,
      input.subjectType,
      input.subjectId,
      input.requestId,
      input.now,
    ],
  );
}

export class PostgresMobileAuthRepository implements MobileAuthRepository {
  constructor(private readonly pool: Pool) {}

  async createRegistration(input: CreateRegistrationInput): Promise<{ created: boolean }> {
    return withTransaction(this.pool, async (client) => {
      const identity = await client.query<{ id: string }>(
        `insert into mobile_identities
           (normalized_email, password_hash, status, created_at, updated_at)
         values ($1, $2, 'pending_verification', $3, $3)
         on conflict (normalized_email) do nothing
         returning id`,
        [input.normalizedEmail, input.passwordHash, input.now],
      );
      const identityId = identity.rows[0]?.id;
      if (!identityId) return { created: false };

      await client.query(
        `insert into mobile_identity_roles
           (identity_id, role, status, created_at, updated_at)
         values ($1, $2, 'pending', $3, $3)`,
        [identityId, input.role, input.now],
      );
      await client.query(
        `insert into mobile_one_time_tokens
           (identity_id, purpose, token_hash, request_id, expires_at, created_at)
         values ($1, 'verify_email', $2, $3, $4, $5)`,
        [identityId, input.tokenHash, input.requestId, input.tokenExpiresAt, input.now],
      );
      await writeAuditEvent(client, {
        actorIdentityId: identityId,
        eventType: "registration.created",
        subjectType: "mobile_identity",
        subjectId: identityId,
        requestId: input.requestId,
        now: input.now,
      });
      return { created: true };
    });
  }

  async verifyEmailAndCreateSession(input: {
    verificationTokenHash: string;
    refreshSession: Omit<CreateSessionInput, "identityId">;
    requestId: string;
    now: Date;
  }): Promise<VerifiedIdentityResult> {
    return withTransaction(this.pool, async (client) => {
      const tokenResult = await client.query(
        `select t.id as "tokenId", i.id as "identityId", i.normalized_email as email,
                t.expires_at as "expiresAt", t.used_at as "usedAt"
           from mobile_one_time_tokens t
           join mobile_identities i on i.id = t.identity_id
          where t.token_hash = $1 and t.purpose = 'verify_email'
          for update of t, i`,
        [input.verificationTokenHash],
      );
      const token = tokenResult.rows[0]
        ? tokenIdentityRowSchema.parse(tokenResult.rows[0])
        : null;
      if (!token || token.usedAt || token.expiresAt.getTime() <= input.now.getTime()) {
        return { outcome: "invalid" };
      }

      await client.query("update mobile_one_time_tokens set used_at = $2 where id = $1", [
        token.tokenId,
        input.now,
      ]);
      await client.query(
        `update mobile_identities
            set status = 'active', email_verified_at = $2, updated_at = $2
          where id = $1 and status = 'pending_verification'`,
        [token.identityId, input.now],
      );
      await writeAuditEvent(client, {
        actorIdentityId: token.identityId,
        eventType: "email.verified",
        subjectType: "mobile_identity",
        subjectId: token.identityId,
        requestId: input.requestId,
        now: input.now,
      });
      await client.query(
        `update mobile_identity_roles
            set status = 'active', approved_at = $2, approved_by = 'email-verification', updated_at = $2
          where identity_id = $1 and role = 'investor' and status = 'pending'`,
        [token.identityId, input.now],
      );

      const roles = await activeRoles(client, token.identityId);
      if (roles.length === 0) {
        return { outcome: "pending_approval" };
      }

      const session = await client.query<{ id: string }>(
        `insert into mobile_refresh_sessions
           (identity_id, token_hash, token_family_id, device_label, expires_at, created_at)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [
          token.identityId,
          input.refreshSession.tokenHash,
          input.refreshSession.tokenFamilyId,
          input.refreshSession.deviceLabel,
          input.refreshSession.expiresAt,
          input.now,
        ],
      );
      return {
        outcome: "authenticated",
        identityId: token.identityId,
        email: token.email,
        roles,
        sessionId: z.string().uuid().parse(session.rows[0]?.id),
      };
    });
  }

  async findIdentityForLogin(normalizedEmail: string): Promise<MobileIdentityAuthRecord | null> {
    const result = await this.pool.query(
      `select i.id, i.normalized_email as email, i.password_hash as "passwordHash",
              i.status, i.email_verified_at as "emailVerifiedAt",
              i.failed_login_count as "failedLoginCount", i.locked_until as "lockedUntil",
              coalesce(
                array_agg(r.role::text order by r.role::text) filter (where r.status = 'active'),
                '{}'::text[]
              ) as "activeRoles"
         from mobile_identities i
         left join mobile_identity_roles r on r.identity_id = i.id
        where i.normalized_email = $1
        group by i.id`,
      [normalizedEmail],
    );
    return result.rows[0] ? identityAuthRowSchema.parse(result.rows[0]) : null;
  }

  async recordFailedLogin(identityId: string, lockedUntil: Date | null, requestId: string, now: Date): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      await client.query(
        `update mobile_identities
            set failed_login_count = failed_login_count + 1,
                locked_until = coalesce($2, locked_until),
                updated_at = $3
          where id = $1`,
        [identityId, lockedUntil, now],
      );
      await writeAuditEvent(client, {
        actorIdentityId: identityId,
        eventType: "login.failed",
        subjectType: "mobile_identity",
        subjectId: identityId,
        requestId,
        now,
      });
    });
  }

  async createLoginSession(input: CreateSessionInput): Promise<string> {
    return withTransaction(this.pool, async (client) => {
      await client.query(
        `update mobile_identities
            set failed_login_count = 0, locked_until = null,
                last_authenticated_at = $2, updated_at = $2
          where id = $1`,
        [input.identityId, input.now],
      );
      const session = await client.query<{ id: string }>(
        `insert into mobile_refresh_sessions
           (identity_id, token_hash, token_family_id, device_label, expires_at, created_at)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [
          input.identityId,
          input.tokenHash,
          input.tokenFamilyId,
          input.deviceLabel,
          input.expiresAt,
          input.now,
        ],
      );
      const sessionId = z.string().uuid().parse(session.rows[0]?.id);
      await writeAuditEvent(client, {
        actorIdentityId: input.identityId,
        eventType: "session.created",
        subjectType: "mobile_session",
        subjectId: sessionId,
        requestId: input.requestId,
        now: input.now,
      });
      return sessionId;
    });
  }

  async rotateRefreshSession(input: {
    currentTokenHash: string;
    nextTokenHash: string;
    nextExpiresAt: Date;
    requestId: string;
    now: Date;
  }): Promise<RotateSessionResult> {
    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `select s.id, s.identity_id as "identityId", i.normalized_email as email,
                s.token_hash as "tokenHash", s.token_family_id as "tokenFamilyId",
                s.device_label as "deviceLabel", s.expires_at as "expiresAt",
                s.rotated_at as "rotatedAt", s.revoked_at as "revokedAt",
                s.reuse_detected_at as "reuseDetectedAt"
           from mobile_refresh_sessions s
           join mobile_identities i on i.id = s.identity_id
          where s.token_hash = $1
          for update of s, i`,
        [input.currentTokenHash],
      );
      const session = result.rows[0] ? refreshSessionRowSchema.parse(result.rows[0]) : null;
      if (!session) return { outcome: "invalid" };

      if (session.reuseDetectedAt || session.rotatedAt) {
        await client.query(
          `update mobile_refresh_sessions
              set revoked_at = coalesce(revoked_at, $2),
                  reuse_detected_at = coalesce(reuse_detected_at, $2),
                  revocation_reason = 'refresh-token-reuse'
            where token_family_id = $1`,
          [session.tokenFamilyId, input.now],
        );
        await writeAuditEvent(client, {
          actorIdentityId: session.identityId,
          eventType: "refresh.reuse_detected",
          subjectType: "mobile_session_family",
          subjectId: session.tokenFamilyId,
          requestId: input.requestId,
          now: input.now,
        });
        return { outcome: "reuse_detected" };
      }
      if (session.revokedAt) return { outcome: "revoked" };
      if (session.expiresAt.getTime() <= input.now.getTime()) return { outcome: "expired" };

      const principal = await this.readActivePrincipalWithClient(
        client,
        session.identityId,
        session.id,
        input.now,
      );
      if (!principal) return { outcome: "invalid" };

      await client.query(
        "update mobile_refresh_sessions set rotated_at = $2, last_used_at = $2 where id = $1",
        [session.id, input.now],
      );
      const nextSession = await client.query<{ id: string }>(
        `insert into mobile_refresh_sessions
           (identity_id, token_hash, token_family_id, device_label, expires_at, created_at)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [
          session.identityId,
          input.nextTokenHash,
          session.tokenFamilyId,
          session.deviceLabel,
          input.nextExpiresAt,
          input.now,
        ],
      );
      const nextSessionId = z.string().uuid().parse(nextSession.rows[0]?.id);
      await writeAuditEvent(client, {
        actorIdentityId: session.identityId,
        eventType: "refresh.rotated",
        subjectType: "mobile_session",
        subjectId: nextSessionId,
        requestId: input.requestId,
        now: input.now,
      });
      return {
        outcome: "rotated",
        ...principal,
        sessionId: nextSessionId,
      };
    });
  }

  private async readActivePrincipalWithClient(
    client: QueryClient,
    identityId: string,
    sessionId: string,
    now: Date,
  ): Promise<ActivePrincipalRecord | null> {
    const result = await client.query(
      `select i.id as "identityId", i.normalized_email as email
         from mobile_identities i
         join mobile_refresh_sessions s on s.identity_id = i.id
        where i.id = $1 and s.id = $2 and i.status = 'active'
          and s.revoked_at is null and s.rotated_at is null
          and s.reuse_detected_at is null and s.expires_at > $3`,
      [identityId, sessionId, now],
    );
    const row = result.rows[0] as QueryResultRow | undefined;
    if (!row) return null;
    const roles = await activeRoles(client, identityId);
    if (roles.length === 0) return null;
    return {
      identityId: z.string().uuid().parse(row.identityId),
      email: z.string().email().parse(row.email),
      roles,
    };
  }

  async readActivePrincipal(
    identityId: string,
    sessionId: string,
    now: Date,
  ): Promise<ActivePrincipalRecord | null> {
    return this.readActivePrincipalWithClient(this.pool, identityId, sessionId, now);
  }

  async revokeByRefreshTokenHash(tokenHash: string, requestId: string, now: Date, reason: string): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      const result = await client.query<{ id: string; identityId: string }>(
        `update mobile_refresh_sessions
            set revoked_at = coalesce(revoked_at, $2), revocation_reason = $3
          where token_hash = $1
          returning id, identity_id as "identityId"`,
        [tokenHash, now, reason],
      );
      const session = result.rows[0];
      if (session) {
        await writeAuditEvent(client, {
          actorIdentityId: session.identityId,
          eventType: "session.revoked",
          subjectType: "mobile_session",
          subjectId: session.id,
          requestId,
          now,
        });
      }
    });
  }

  async listSessions(identityId: string, now: Date): Promise<MobileSessionListRecord[]> {
    const result = await this.pool.query(
      `select id, device_label as "deviceLabel", created_at as "createdAt",
              last_used_at as "lastUsedAt", expires_at as "expiresAt"
         from mobile_refresh_sessions
        where identity_id = $1 and revoked_at is null and rotated_at is null
          and reuse_detected_at is null and expires_at > $2
        order by created_at desc`,
      [identityId, now],
    );
    return z.array(sessionListRowSchema).parse(result.rows);
  }

  async revokeOwnedSession(
    identityId: string,
    sessionId: string,
    requestId: string,
    now: Date,
  ): Promise<boolean> {
    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `update mobile_refresh_sessions
            set revoked_at = coalesce(revoked_at, $3), revocation_reason = 'user-revoked'
          where id = $1 and identity_id = $2 and revoked_at is null`,
        [sessionId, identityId, now],
      );
      if (result.rowCount === 1) {
        await writeAuditEvent(client, {
          actorIdentityId: identityId,
          eventType: "session.revoked",
          subjectType: "mobile_session",
          subjectId: sessionId,
          requestId,
          now,
        });
      }
      return result.rowCount === 1;
    });
  }

  async createRecoveryToken(input: {
    normalizedEmail: string;
    tokenHash: string;
    requestId: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean> {
    return withTransaction(this.pool, async (client) => {
      const identity = await client.query<{ id: string }>(
        `select id from mobile_identities
          where normalized_email = $1 and status = 'active' and email_verified_at is not null
          for update`,
        [input.normalizedEmail],
      );
      const identityId = identity.rows[0]?.id;
      if (!identityId) return false;

      await client.query(
        `update mobile_one_time_tokens
            set used_at = $2
          where identity_id = $1 and purpose = 'reset_password' and used_at is null`,
        [identityId, input.now],
      );
      await client.query(
        `insert into mobile_one_time_tokens
           (identity_id, purpose, token_hash, request_id, expires_at, created_at)
         values ($1, 'reset_password', $2, $3, $4, $5)`,
        [identityId, input.tokenHash, input.requestId, input.expiresAt, input.now],
      );
      await writeAuditEvent(client, {
        actorIdentityId: identityId,
        eventType: "recovery.requested",
        subjectType: "mobile_identity",
        subjectId: identityId,
        requestId: input.requestId,
        now: input.now,
      });
      return true;
    });
  }

  async completeRecovery(input: {
    tokenHash: string;
    passwordHash: string;
    requestId: string;
    now: Date;
  }): Promise<boolean> {
    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `select t.id as "tokenId", i.id as "identityId", i.normalized_email as email,
                t.expires_at as "expiresAt", t.used_at as "usedAt"
           from mobile_one_time_tokens t
           join mobile_identities i on i.id = t.identity_id
          where t.token_hash = $1 and t.purpose = 'reset_password' and i.status = 'active'
          for update of t, i`,
        [input.tokenHash],
      );
      const token = result.rows[0] ? tokenIdentityRowSchema.parse(result.rows[0]) : null;
      if (!token || token.usedAt || token.expiresAt.getTime() <= input.now.getTime()) return false;

      await client.query("update mobile_one_time_tokens set used_at = $2 where id = $1", [
        token.tokenId,
        input.now,
      ]);
      await client.query(
        `update mobile_identities
            set password_hash = $2, failed_login_count = 0, locked_until = null, updated_at = $3
          where id = $1`,
        [token.identityId, input.passwordHash, input.now],
      );
      await client.query(
        `update mobile_refresh_sessions
            set revoked_at = coalesce(revoked_at, $2), revocation_reason = 'password-recovery'
          where identity_id = $1`,
        [token.identityId, input.now],
      );
      await writeAuditEvent(client, {
        actorIdentityId: token.identityId,
        eventType: "recovery.completed",
        subjectType: "mobile_identity",
        subjectId: token.identityId,
        requestId: input.requestId,
        now: input.now,
      });
      return true;
    });
  }

  async requestDeletion(identityId: string, requestId: string, now: Date): Promise<void> {
    await withTransaction(this.pool, async (client) => {
      const existing = await client.query(
        `select id from mobile_deletion_requests
          where identity_id = $1 and status in ('requested', 'identity_verified', 'in_progress')
          limit 1
          for update`,
        [identityId],
      );
      if (existing.rows.length === 0) {
        await client.query(
          `insert into mobile_deletion_requests
             (identity_id, status, requested_at, created_at, updated_at)
           values ($1, 'requested', $2, $2, $2)`,
          [identityId, now],
        );
      }
      await client.query(
        "update mobile_identities set status = 'deletion_requested', updated_at = $2 where id = $1",
        [identityId, now],
      );
      await client.query(
        `update mobile_refresh_sessions
            set revoked_at = coalesce(revoked_at, $2), revocation_reason = 'deletion-requested'
          where identity_id = $1`,
        [identityId, now],
      );
      await writeAuditEvent(client, {
        actorIdentityId: identityId,
        eventType: "deletion.requested",
        subjectType: "mobile_identity",
        subjectId: identityId,
        requestId,
        now,
      });
    });
  }
}
