import { trackEvent } from "@/lib/analytics";

export const DISCOVERY_CALL_URL =
  "https://calendly.com/dylan-newdawnfranchising/30min";

type DiscoveryCallLinkProps = {
  placement: "header" | "hero" | "dylan" | "mobile" | "telecom" | "insurance";
  testId?: string;
  tabIndex?: number;
  hideArrow?: boolean;
};

export function DiscoveryCallLink({
  placement,
  testId,
  tabIndex,
  hideArrow = false,
}: DiscoveryCallLinkProps) {
  return (
    <a
      className="button primary"
      href={DISCOVERY_CALL_URL}
      target="_blank"
      rel="noopener"
      tabIndex={tabIndex}
      data-booking={placement}
      data-testid={testId}
      onClick={() => trackEvent("discovery_call_click", { placement })}
    >
      {placement === "dylan" ? "Choose a time with Dylan" : "Book a discovery call"}
      {!hideArrow && <span aria-hidden="true">↗</span>}
    </a>
  );
}
