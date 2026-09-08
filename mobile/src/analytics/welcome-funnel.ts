export const welcomeFunnelEvents = {
  investorSelected: 'welcome.investor_selected',
  partnerSelected: 'welcome.partner_selected',
  attorneySelected: 'welcome.attorney_selected',
  e2OverviewSelected: 'welcome.e2_overview_selected',
  signInSelected: 'welcome.sign_in_selected',
} as const;

export type WelcomeFunnelEvent = typeof welcomeFunnelEvents[keyof typeof welcomeFunnelEvents];
export type WelcomeFunnelEventSink = (event: WelcomeFunnelEvent) => void;

const deviceLogSink: WelcomeFunnelEventSink = (event) => {
  console.info(`[welcome-funnel] ${event}`);
};

export function trackWelcomeFunnelEvent(
  event: WelcomeFunnelEvent,
  sink: WelcomeFunnelEventSink = deviceLogSink,
): void {
  sink(event);
}
