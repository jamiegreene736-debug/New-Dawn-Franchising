export interface PlacementSnapshot {
  subject: string; bodyHtml: string; previewText: string; sender: string; rendererVersion: number;
}
export interface PlacementMessage {
  email: string; send_status: string; placement: string;
  authentication: { spf: string; dkim: string; dmarc: string } | null;
}
export interface PlacementTest {
  id: string; step_id: string; status: string; error: string | null; created_at: string; checked_at: string | null;
  snapshot: PlacementSnapshot; current: boolean; stale: boolean; messages: PlacementMessage[];
}
export interface PlacementOverview {
  configured: boolean; senderReady: boolean; outreachPaused: boolean;
  seedCount: number; tests: PlacementTest[];
}
