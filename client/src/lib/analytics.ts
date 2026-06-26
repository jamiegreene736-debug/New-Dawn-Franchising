// Lightweight analytics helper.
//
// The site loads GA4 (gtag.js) from client/index.html *only* when GA_MEASUREMENT_ID
// is set (see /api/config/ga). That inline snippet now also assigns `window.gtag`,
// so app code can fire conversion events through this helper. When GA isn't
// configured (or hasn't loaded yet), `window.gtag` is undefined and every call
// here is a silent no-op — analytics must never break the UI.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Fire a GA4 event. No-op when GA isn't loaded. */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  try {
    window.gtag?.("event", name, params);
  } catch {
    /* never let analytics throw into the UI */
  }
}
