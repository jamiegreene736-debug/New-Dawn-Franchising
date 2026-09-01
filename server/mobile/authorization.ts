import type { MobileCapability, MobileRole } from "@shared/mobile/contracts";

import type { MobilePrincipal } from "./access-tokens";

const COMMON_ACCOUNT_CAPABILITIES: readonly MobileCapability[] = [
  "account:read-own",
  "account:sessions:manage-own",
  "account:deletion:request-own",
];

const ROLE_CAPABILITIES: Readonly<Record<MobileRole, readonly MobileCapability[]>> = {
  investor: [...COMMON_ACCOUNT_CAPABILITIES, "investor:path:read-own"],
  partner: [
    ...COMMON_ACCOUNT_CAPABILITIES,
    "partner:application:write-own",
    "partner:referral:create",
    "partner:referral:read-own",
  ],
  attorney: [
    ...COMMON_ACCOUNT_CAPABILITIES,
    "attorney:resources:read",
    "attorney:coordination:read-invited",
  ],
};

export class MobileAuthorizationError extends Error {
  constructor() {
    super("Mobile authorization denied");
    this.name = "MobileAuthorizationError";
  }
}

export function capabilitiesForMobilePrincipal(
  principal: MobilePrincipal,
): ReadonlySet<MobileCapability> {
  return new Set(principal.roles.flatMap((role) => ROLE_CAPABILITIES[role]));
}

export function requireMobileCapability(
  principal: MobilePrincipal,
  capability: MobileCapability,
): void {
  if (!capabilitiesForMobilePrincipal(principal).has(capability)) {
    throw new MobileAuthorizationError();
  }
}

export function requireOwnedMobileResource(
  principal: MobilePrincipal,
  ownerIdentityId: string,
): void {
  if (principal.identityId !== ownerIdentityId) {
    throw new MobileAuthorizationError();
  }
}

export function requireInvitedMobileResource(
  principal: MobilePrincipal,
  invitedIdentityIds: readonly string[],
): void {
  if (!invitedIdentityIds.includes(principal.identityId)) {
    throw new MobileAuthorizationError();
  }
}
