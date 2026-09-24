export const deskApi = "/api/outreach-desk";
export async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${deskApi}${path}`, {
    method,
    credentials: "include",
    headers:
      method !== "GET" ? { "Content-Type": "application/json" } : undefined,
    body: method !== "GET" ? JSON.stringify(body ?? {}) : undefined,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : "Request failed. Please retry.",
    );
  return data as T;
}
export function displayTime(
  value: string | null,
  timezone?: string | null,
): string {
  if (!value) return "Not recorded";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || undefined,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Time unavailable";
  }
}
export function localTime(timezone: string | null): string {
  if (!timezone) return "Timezone needs confirmation";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeStyle: "short",
    }).format(new Date());
  } catch {
    return "Timezone needs confirmation";
  }
}
export function localCallbackToUtc(value: string, timezone: string): string {
  const [date, time] = value.split("T");
  if (!date || !time) throw new Error("Choose a callback date and time.");
  const target = `${date} ${time}`;
  const nominal = Date.parse(`${value}:00Z`);
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const matches: number[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = nominal + offset * 60_000;
    if (formatter.format(candidate) === target) matches.push(candidate);
  }
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? "This time occurs twice during the clock change. Choose another time."
        : "That local time does not exist. Choose another time.",
    );
  return new Date(matches[0]).toISOString();
}
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
