import { randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";

import type {
  MobileAccount,
  MobileAuthenticatedResponse,
  MobileRole,
  MobileSession,
} from "@shared/mobile/contracts";

import {
  MobileAccessTokenService,
  MobileAuthenticationError,
  type MobilePrincipal,
} from "./access-tokens";
import type {
  ActivePrincipalRecord,
  MobileAuthRepository,
  MobileIdentityAuthRecord,
} from "./auth-repository";
import { createMobileRefreshToken, hashMobileOpaqueToken } from "./refresh-tokens";

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 600 as const;
const REFRESH_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const VERIFICATION_TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const RECOVERY_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH = "$2b$12$8CavhorWnWv/bfZ5eCg80ebEq.7.UVxlihj4FhdEB9DtLEVzhse2K";

export type MobileAuthServiceErrorCode =
  | "INVALID_REQUEST"
  | "NOT_AUTHENTICATED"
  | "NOT_AUTHORIZED"
  | "SERVICE_UNAVAILABLE";

export class MobileAuthServiceError extends Error {
  constructor(
    readonly code: MobileAuthServiceErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "MobileAuthServiceError";
  }
}

type PasswordHasher = {
  hash(password: string): Promise<string>;
  compare(password: string, passwordHash: string): Promise<boolean>;
};

export type MobileAuthServiceOptions = {
  testTokensEnabled?: boolean;
  now?: () => Date;
  passwordHasher?: PasswordHasher;
};

export type MobileRegistrationResult = {
  status: "verification_required";
  testToken?: string;
};

export type MobileVerificationResult =
  | Omit<MobileAuthenticatedResponse, "requestId">
  | { status: "pending_approval" };

export class MobileAuthService {
  private readonly testTokensEnabled: boolean;
  private readonly now: () => Date;
  private readonly passwordHasher: PasswordHasher;

  constructor(
    private readonly repository: MobileAuthRepository,
    private readonly accessTokens: MobileAccessTokenService,
    options: MobileAuthServiceOptions = {},
  ) {
    this.testTokensEnabled = options.testTokensEnabled ?? false;
    this.now = options.now ?? (() => new Date());
    this.passwordHasher = options.passwordHasher ?? {
      hash: (password) => bcrypt.hash(password, 12),
      compare: (password, passwordHash) => bcrypt.compare(password, passwordHash),
    };
  }

  async register(input: {
    email: string;
    password: string;
    role: "investor" | "partner";
    requestId: string;
  }): Promise<MobileRegistrationResult> {
    const now = this.now();
    const verificationToken = createMobileRefreshToken();
    const passwordHash = await this.passwordHasher.hash(input.password);
    const result = await this.repository.createRegistration({
      normalizedEmail: normalizeEmail(input.email),
      passwordHash,
      role: input.role,
      tokenHash: hashMobileOpaqueToken(verificationToken),
      requestId: input.requestId,
      tokenExpiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_LIFETIME_MS),
      now,
    });

    return {
      status: "verification_required",
      ...(result.created && this.testTokensEnabled ? { testToken: verificationToken } : {}),
    };
  }

  async verifyEmail(input: {
    token: string;
    deviceLabel?: string;
    requestId: string;
  }): Promise<MobileVerificationResult> {
    const now = this.now();
    const refreshToken = createMobileRefreshToken();
    const result = await this.repository.verifyEmailAndCreateSession({
      verificationTokenHash: hashMobileOpaqueToken(input.token),
      refreshSession: {
        tokenHash: hashMobileOpaqueToken(refreshToken),
        tokenFamilyId: randomUUID(),
        deviceLabel: input.deviceLabel?.trim() || null,
        expiresAt: new Date(now.getTime() + REFRESH_SESSION_LIFETIME_MS),
        requestId: input.requestId,
        now,
      },
      requestId: input.requestId,
      now,
    });

    if (result.outcome === "invalid") {
      throw new MobileAuthServiceError("INVALID_REQUEST", 400);
    }
    if (result.outcome === "pending_approval") {
      return { status: "pending_approval" };
    }
    return this.authenticatedResponse(result, refreshToken, now);
  }

  async login(input: {
    email: string;
    password: string;
    deviceLabel?: string;
    requestId: string;
  }): Promise<Omit<MobileAuthenticatedResponse, "requestId">> {
    const now = this.now();
    const identity = await this.repository.findIdentityForLogin(normalizeEmail(input.email));
    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      identity?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!identity || !passwordMatches) {
      if (identity) {
        const shouldLock = identity.failedLoginCount + 1 >= LOGIN_FAILURE_LIMIT;
        await this.repository.recordFailedLogin(
          identity.id,
          shouldLock ? new Date(now.getTime() + LOGIN_LOCK_MS) : null,
          input.requestId,
          now,
        );
      }
      throw new MobileAuthServiceError("NOT_AUTHENTICATED", 401);
    }

    requireLoginReady(identity, now);
    const refreshToken = createMobileRefreshToken();
    const sessionId = await this.repository.createLoginSession({
      identityId: identity.id,
      tokenHash: hashMobileOpaqueToken(refreshToken),
      tokenFamilyId: randomUUID(),
      deviceLabel: input.deviceLabel?.trim() || null,
      expiresAt: new Date(now.getTime() + REFRESH_SESSION_LIFETIME_MS),
      requestId: input.requestId,
      now,
    });
    return this.authenticatedResponse({
      identityId: identity.id,
      email: identity.email,
      roles: identity.activeRoles,
      sessionId,
    }, refreshToken, now);
  }

  async refresh(refreshToken: string, requestId: string): Promise<Omit<MobileAuthenticatedResponse, "requestId">> {
    const now = this.now();
    const nextRefreshToken = createMobileRefreshToken();
    const result = await this.repository.rotateRefreshSession({
      currentTokenHash: hashMobileOpaqueToken(refreshToken),
      nextTokenHash: hashMobileOpaqueToken(nextRefreshToken),
      nextExpiresAt: new Date(now.getTime() + REFRESH_SESSION_LIFETIME_MS),
      requestId,
      now,
    });
    if (result.outcome !== "rotated") {
      throw new MobileAuthServiceError("NOT_AUTHENTICATED", 401);
    }
    return this.authenticatedResponse(result, nextRefreshToken, now);
  }

  async logout(refreshToken: string, requestId: string): Promise<void> {
    await this.repository.revokeByRefreshTokenHash(
      hashMobileOpaqueToken(refreshToken),
      requestId,
      this.now(),
      "user-logout",
    );
  }

  async authenticate(authorizationHeader: string | undefined): Promise<{
    principal: MobilePrincipal;
    account: MobileAccount;
  }> {
    const token = readBearerToken(authorizationHeader);
    let tokenPrincipal: MobilePrincipal;
    try {
      tokenPrincipal = await this.accessTokens.verify(token, this.now());
    } catch (error) {
      if (error instanceof MobileAuthenticationError) {
        throw new MobileAuthServiceError("NOT_AUTHENTICATED", 401);
      }
      throw error;
    }

    const principal = await this.repository.readActivePrincipal(
      tokenPrincipal.identityId,
      tokenPrincipal.sessionId,
      this.now(),
    );
    if (!principal || !sameRoles(principal.roles, tokenPrincipal.roles)) {
      throw new MobileAuthServiceError("NOT_AUTHENTICATED", 401);
    }
    return {
      principal: tokenPrincipal,
      account: accountFromPrincipal(principal),
    };
  }

  async listSessions(identityId: string, currentSessionId: string): Promise<MobileSession[]> {
    return (await this.repository.listSessions(identityId, this.now())).map((session) => ({
      id: session.id,
      deviceLabel: session.deviceLabel,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt?.toISOString() ?? null,
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === currentSessionId,
    }));
  }

  async revokeSession(identityId: string, sessionId: string, requestId: string): Promise<void> {
    const revoked = await this.repository.revokeOwnedSession(
      identityId,
      sessionId,
      requestId,
      this.now(),
    );
    if (!revoked) throw new MobileAuthServiceError("NOT_AUTHORIZED", 403);
  }

  async requestRecovery(input: {
    email: string;
    requestId: string;
  }): Promise<{ status: "recovery_requested"; testToken?: string }> {
    const now = this.now();
    const recoveryToken = createMobileRefreshToken();
    const created = await this.repository.createRecoveryToken({
      normalizedEmail: normalizeEmail(input.email),
      tokenHash: hashMobileOpaqueToken(recoveryToken),
      requestId: input.requestId,
      expiresAt: new Date(now.getTime() + RECOVERY_TOKEN_LIFETIME_MS),
      now,
    });
    return {
      status: "recovery_requested",
      ...(created && this.testTokensEnabled ? { testToken: recoveryToken } : {}),
    };
  }

  async completeRecovery(token: string, newPassword: string, requestId: string): Promise<void> {
    const passwordHash = await this.passwordHasher.hash(newPassword);
    const completed = await this.repository.completeRecovery({
      tokenHash: hashMobileOpaqueToken(token),
      passwordHash,
      requestId,
      now: this.now(),
    });
    if (!completed) throw new MobileAuthServiceError("INVALID_REQUEST", 400);
  }

  async requestDeletion(identityId: string, requestId: string): Promise<void> {
    await this.repository.requestDeletion(identityId, requestId, this.now());
  }

  private async authenticatedResponse(
    principal: ActivePrincipalRecord & { sessionId: string },
    refreshToken: string,
    now: Date,
  ): Promise<Omit<MobileAuthenticatedResponse, "requestId">> {
    const accessToken = await this.accessTokens.issue({
      identityId: principal.identityId,
      sessionId: principal.sessionId,
      roles: principal.roles,
    }, now);
    return {
      status: "authenticated",
      accessToken,
      refreshToken,
      accessTokenExpiresInSeconds: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      account: accountFromPrincipal(principal),
    };
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireLoginReady(identity: MobileIdentityAuthRecord, now: Date): void {
  if (
    identity.status !== "active"
    || !identity.emailVerifiedAt
    || identity.activeRoles.length === 0
    || (identity.lockedUntil && identity.lockedUntil.getTime() > now.getTime())
  ) {
    throw new MobileAuthServiceError("NOT_AUTHENTICATED", 401);
  }
}

function readBearerToken(header: string | undefined): string {
  const match = header?.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  if (!match) throw new MobileAuthServiceError("NOT_AUTHENTICATED", 401);
  return match[1];
}

function accountFromPrincipal(principal: ActivePrincipalRecord): MobileAccount {
  return {
    id: principal.identityId,
    email: principal.email,
    roles: principal.roles,
  };
}

function sameRoles(left: readonly MobileRole[], right: readonly MobileRole[]): boolean {
  return [...left].sort().join("|") === [...right].sort().join("|");
}
