import { trackEvent } from "@/lib/analytics";

export const DISCOVERY_CALL_URL =
  "https://calendly.com/dylan-newdawnfranchising/30min";

type DiscoveryCallLinkProps = {
  placement: "header" | "hero" | "dylan" | "mobile" | "telecom" | "insurance";
  testId?: string;
};

export function DiscoveryCallLink({
  placement,
  testId,
}: DiscoveryCallLinkProps) {
  return (
    <a
      className="button primary"
      href={DISCOVERY_CALL_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-booking={placement}
      data-testid={testId}
      onClick={() => trackEvent("discovery_call_click", { placement })}
    >
      Book a discovery call <span aria-hidden="true">↗</span>
    </a>
  );
}
