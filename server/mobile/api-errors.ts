import {
  mobileApiErrorSchema,
  type MobileApiError,
} from "@shared/mobile/contracts";

type MobileApiErrorCode = MobileApiError["error"]["code"];

const SAFE_MESSAGES: Readonly<Record<MobileApiErrorCode, string>> = {
  INVALID_REQUEST: "The request could not be processed.",
  NOT_AUTHENTICATED: "Authentication is required.",
  NOT_AUTHORIZED: "This action is not permitted.",
  CONTENT_NOT_APPROVED: "Content is not available.",
  CONFLICT_REVIEW_REQUIRED: "This request requires review.",
  RATE_LIMITED: "Please wait before trying again.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
  INTERNAL_ERROR: "The request could not be completed.",
};

export function createMobileApiError(
  code: MobileApiErrorCode,
  requestId: string,
  retryable = false,
): MobileApiError {
  return mobileApiErrorSchema.parse({
    error: {
      code,
      message: SAFE_MESSAGES[code],
      requestId,
      retryable,
    },
  });
}
