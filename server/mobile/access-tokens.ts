import { randomUUID } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { mobileRoleSchema, type MobileRole } from "@shared/mobile/contracts";

const DEFAULT_ISSUER = "new-dawn-pathways";
const DEFAULT_AUDIENCE = "new-dawn-mobile-api";
const DEFAULT_LIFETIME_SECONDS = 10 * 60;
const MINIMUM_SECRET_BYTES = 32;

const mobileAccessTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  sid: z.string().uuid(),
  roles: z.array(mobileRoleSchema).min(1).max(3).refine(
    (roles) => new Set(roles).size === roles.length,
    "Access-token roles must be unique",
  ),
  jti: z.string().uuid(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});

export interface MobilePrincipal {
  identityId: string;
  sessionId: string;
  roles: readonly MobileRole[];
  tokenId: string;
  issuedAt: Date;
  expiresAt: Date;
}

export interface MobileAccessTokenServiceOptions {
  issuer?: string;
  audience?: string;
  lifetimeSeconds?: number;
}

export interface IssueMobileAccessTokenInput {
  identityId: string;
  sessionId: string;
  roles: readonly MobileRole[];
}

export class MobileAuthenticationError extends Error {
  constructor() {
    super("Mobile authentication failed");
    this.name = "MobileAuthenticationError";
  }
}

export class MobileAccessTokenService {
  private readonly secretKey: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly lifetimeSeconds: number;

  constructor(secret: string, options: MobileAccessTokenServiceOptions = {}) {
    if (Buffer.byteLength(secret, "utf8") < MINIMUM_SECRET_BYTES) {
      throw new Error(`Mobile access-token secret must be at least ${MINIMUM_SECRET_BYTES} bytes`);
    }

    const lifetimeSeconds = options.lifetimeSeconds ?? DEFAULT_LIFETIME_SECONDS;
    if (!Number.isInteger(lifetimeSeconds) || lifetimeSeconds < 300 || lifetimeSeconds > 900) {
      throw new Error("Mobile access-token lifetime must be between 300 and 900 seconds");
    }

    this.secretKey = new TextEncoder().encode(secret);
    this.issuer = options.issuer ?? DEFAULT_ISSUER;
    this.audience = options.audience ?? DEFAULT_AUDIENCE;
    this.lifetimeSeconds = lifetimeSeconds;
  }

  async issue(input: IssueMobileAccessTokenInput, now = new Date()): Promise<string> {
    const issuedAt = Math.floor(now.getTime() / 1000);
    const roles = mobileAccessTokenPayloadSchema.shape.roles.parse([...input.roles]);
    const identityId = z.string().uuid().parse(input.identityId);
    const sessionId = z.string().uuid().parse(input.sessionId);

    return new SignJWT({ sid: sessionId, roles })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setSubject(identityId)
      .setJti(randomUUID())
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + this.lifetimeSeconds)
      .sign(this.secretKey);
  }

  async verify(token: string, now = new Date()): Promise<MobilePrincipal> {
    try {
      const verified = await jwtVerify(token, this.secretKey, {
        algorithms: ["HS256"],
        issuer: this.issuer,
        audience: this.audience,
        currentDate: now,
        clockTolerance: 5,
        maxTokenAge: this.lifetimeSeconds,
      });
      const payload = mobileAccessTokenPayloadSchema.parse(verified.payload);

      return {
        identityId: payload.sub,
        sessionId: payload.sid,
        roles: payload.roles,
        tokenId: payload.jti,
        issuedAt: new Date(payload.iat * 1000),
        expiresAt: new Date(payload.exp * 1000),
      };
    } catch {
      throw new MobileAuthenticationError();
    }
  }
}
