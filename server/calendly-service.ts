const CALENDLY_TOKEN = process.env.CALENDLY_API_KEY;
const BASE = "https://api.calendly.com";

interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  scheduling_url: string;
  current_organization: string;
}

interface CalendlyEvent {
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  location?: { type: string; join_url?: string; location?: string };
  invitees_counter: { total: number };
  event_type: string;
  created_at: string;
}

interface CalendlyInvitee {
  uri: string;
  email: string;
  name: string;
  status: string;
  timezone: string;
  created_at: string;
  questions_and_answers?: Array<{ question: string; answer: string }>;
}

async function calendlyFetch(path: string): Promise<any> {
  if (!CALENDLY_TOKEN) throw new Error("CALENDLY_API_KEY not set");
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${CALENDLY_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendly API error ${res.status}: ${body}`);
  }
  return res.json();
}

let _userCache: CalendlyUser | null = null;

export async function getCalendlyUser(): Promise<CalendlyUser> {
  if (_userCache) return _userCache;
  const data = await calendlyFetch("/users/me");
  _userCache = data.resource as CalendlyUser;
  return _userCache!;
}

export async function getUpcomingBookings(count = 20): Promise<Array<{
  uri: string; name: string; startTime: string; endTime: string;
  joinUrl?: string; invitees: CalendlyInvitee[]; status: string;
}>> {
  if (!CALENDLY_TOKEN) return [];

  try {
    const user = await getCalendlyUser();
    const now = new Date().toISOString();
    const in90days = new Date(Date.now() + 90 * 86400000).toISOString();

    const data = await calendlyFetch(
      `/scheduled_events?user=${encodeURIComponent(user.uri)}&status=active&min_start_time=${now}&max_start_time=${in90days}&count=${count}&sort=start_time:asc`
    );

    const events: CalendlyEvent[] = (data.collection || []);
    const results = [];

    for (const event of events) {
      let invitees: CalendlyInvitee[] = [];
      try {
        const uuid = event.uri.split("/").pop();
        const inv = await calendlyFetch(`/scheduled_events/${uuid}/invitees?count=5`);
        invitees = inv.collection || [];
      } catch {}

      results.push({
        uri: event.uri,
        name: event.name,
        startTime: event.start_time,
        endTime: event.end_time,
        joinUrl: event.location?.join_url,
        invitees,
        status: event.status,
      });
    }

    return results;
  } catch (e) {
    console.error("[Calendly] getUpcomingBookings error:", e);
    return [];
  }
}

export async function getRecentBookings(count = 10): Promise<Array<{
  uri: string; name: string; startTime: string; endTime: string;
  joinUrl?: string; invitees: CalendlyInvitee[];
}>> {
  if (!CALENDLY_TOKEN) return [];

  try {
    const user = await getCalendlyUser();
    const past30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const now = new Date().toISOString();

    const data = await calendlyFetch(
      `/scheduled_events?user=${encodeURIComponent(user.uri)}&status=active&min_start_time=${past30}&max_start_time=${now}&count=${count}&sort=start_time:desc`
    );

    const events: CalendlyEvent[] = (data.collection || []);
    const results = [];

    for (const event of events) {
      let invitees: CalendlyInvitee[] = [];
      try {
        const uuid = event.uri.split("/").pop();
        const inv = await calendlyFetch(`/scheduled_events/${uuid}/invitees?count=5`);
        invitees = inv.collection || [];
      } catch {}

      results.push({
        uri: event.uri,
        name: event.name,
        startTime: event.start_time,
        endTime: event.end_time,
        joinUrl: event.location?.join_url,
        invitees,
      });
    }

    return results;
  } catch (e) {
    console.error("[Calendly] getRecentBookings error:", e);
    return [];
  }
}

export async function getCalendlyStats(): Promise<{
  upcomingCount: number;
  recentCount: number;
  schedulingUrl: string;
  userName: string;
}> {
  if (!CALENDLY_TOKEN) {
    return { upcomingCount: 0, recentCount: 0, schedulingUrl: "", userName: "" };
  }

  try {
    const user = await getCalendlyUser();
    const [upcoming, recent] = await Promise.all([
      getUpcomingBookings(50),
      getRecentBookings(50),
    ]);

    return {
      upcomingCount: upcoming.length,
      recentCount: recent.length,
      schedulingUrl: user.scheduling_url,
      userName: user.name,
    };
  } catch (e) {
    console.error("[Calendly] getCalendlyStats error:", e);
    return { upcomingCount: 0, recentCount: 0, schedulingUrl: "", userName: "" };
  }
}

export function isCalendlyConfigured(): boolean {
  return !!CALENDLY_TOKEN;
}
