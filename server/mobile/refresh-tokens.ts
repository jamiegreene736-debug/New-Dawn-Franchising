import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;
const SHA_256_HEX_LENGTH = 64;

export interface MobileRefreshSessionSnapshot {
  tokenHash: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  reuseDetectedAt: Date | null;
}

export type MobileRefreshTokenUseDecision =
  | "allowed"
  | "invalid"
  | "expired"
  | "revoked"
  | "reuse_detected";

export function createMobileRefreshToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashMobileOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function evaluateMobileRefreshTokenUse(
  session: MobileRefreshSessionSnapshot,
  presentedToken: string,
  now = new Date(),
): MobileRefreshTokenUseDecision {
  if (!/^[a-f0-9]{64}$/i.test(session.tokenHash) || session.tokenHash.length !== SHA_256_HEX_LENGTH) {
    return "invalid";
  }

  const presentedHash = Buffer.from(hashMobileOpaqueToken(presentedToken), "hex");
  const storedHash = Buffer.from(session.tokenHash, "hex");
  if (presentedHash.length !== storedHash.length || !timingSafeEqual(presentedHash, storedHash)) {
    return "invalid";
  }

  if (session.reuseDetectedAt || session.rotatedAt) {
    return "reuse_detected";
  }

  if (session.revokedAt) {
    return "revoked";
  }

  if (session.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  return "allowed";
}
