import { useDeferredValue, useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Calendar,
  Headphones,
  Search,
  RefreshCw,
  Workflow,
  Network,
  BarChart2,
  Mail,
  ArrowUpRight,
  Sun,
} from "lucide-react";
import { deskQuerySchema } from "@shared/outreach-desk";
import type {
  CampaignPerson,
  DeskOverview,
  DeskPerson,
  DeskQuery,
  SavedDeskView,
} from "@shared/outreach-desk";
import {
  request,
  displayTime,
  initials,
  localTime,
} from "@/components/outreach-desk/api";
import { PersonPanel } from "@/components/outreach-desk/person-panel";
import { Followups } from "@/components/outreach-desk/followups";
import {
  AutomationSettings,
  Connections,
  Performance,
} from "@/components/outreach-desk/operations";
import "./outreach-desk.css";

type Page =
  | "today"
  | "campaigns"
  | "followups"
  | "automations"
  | "connections"
  | "performance";
const pages: Array<{ id: Page; label: string; icon: typeof Headphones }> = [
  { id: "today", label: "My desk", icon: Headphones },
  { id: "campaigns", label: "Campaign explorer", icon: Search },
  { id: "followups", label: "Follow-ups", icon: Mail },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "connections", label: "Connections", icon: Network },
  { id: "performance", label: "Performance", icon: BarChart2 },
];
function readFilters(): DeskQuery {
  const p = new URLSearchParams(window.location.search);
  const parsed = deskQuerySchema.safeParse({
    q: p.get("deskQ") || "",
    view: p.get("deskView") || "today",
    campaignId: p.get("deskCampaign") || "",
    signal: p.get("deskSignal") || "all",
    days: p.get("deskDays") || 30,
  });
  return parsed.success ? parsed.data : deskQuerySchema.parse({});
}
function reason(p: DeskPerson) {
  if (p.status === "callback") return "Requested callback";
  if (p.triggerType === "reply_no_meeting") return "Replied · no meeting yet";
  if (p.triggerType === "link_click") return "Link clicked · review context";
  return "Observed opens · confidence uncertain";
}
export default function OutreachDesk() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState<Page>(() => {
    const p = new URLSearchParams(window.location.search).get("desk");
    return pages.some((x) => x.id === p) ? (p as Page) : "today";
  });
  const [filters, setFilters] = useState<DeskQuery>(readFilters);
  const [selected, setSelected] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("person"),
  );
  const [savedName, setSavedName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const deferredQuery = useDeferredValue(filters.q);
  const effective = { ...filters, q: deferredQuery };
  const overview = useQuery<DeskOverview>({
    queryKey: ["desk", "overview"],
    queryFn: () => request("/overview"),
    refetchInterval: 60_000,
  });
  const queue = useInfiniteQuery({
    queryKey: ["desk", "queue", effective],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      request<{ items: DeskPerson[]; nextCursor: string | null }>(
        `/queue?${new URLSearchParams({ ...Object.fromEntries(Object.entries(effective).map(([k, v]) => [k, String(v)])), cursor: pageParam })}`,
      ),
    getNextPageParam: (result) => result.nextCursor || undefined,
    enabled: page === "today",
    refetchInterval: 60_000,
  });
  const campaigns = useQuery<
    Array<{ id: string; name: string; audienceType: string; isActive: boolean }>
  >({
    queryKey: ["desk", "campaigns"],
    queryFn: () => request("/campaigns"),
    enabled: page === "campaigns",
  });
  const matches = useInfiniteQuery({
    queryKey: ["desk", "campaignPeople", effective],
    initialPageParam: "",
    queryFn: ({ pageParam }) =>
      request<{ items: CampaignPerson[]; nextCursor: string | null }>(
        `/campaign-people?${new URLSearchParams({ ...Object.fromEntries(Object.entries(effective).map(([k, v]) => [k, String(v)])), cursor: pageParam })}`,
      ),
    getNextPageParam: (result) => result.nextCursor || undefined,
    enabled: page === "campaigns",
  });
  const views = useQuery<SavedDeskView[]>({
    queryKey: ["desk", "views"],
    queryFn: () => request("/views"),
  });
  const prepare = useMutation({
    mutationFn: () => request("/prepare", "POST"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["desk"] }),
  });
  const saveView = useMutation({
    mutationFn: () => request("/views", "POST", { name: savedName, filters }),
    onSuccess: () => {
      setSaveOpen(false);
      setSavedName("");
      void queryClient.invalidateQueries({ queryKey: ["desk", "views"] });
    },
  });
  const enqueue = useMutation({
    mutationFn: (sendId: string) =>
      request<{ id: string }>("/campaign-people/queue", "POST", { sendId }),
    onSuccess: (data) => {
      setSelected(data.id);
      setPage("today");
      void queryClient.invalidateQueries({ queryKey: ["desk"] });
    },
  });
  const items = queue.data?.pages.flatMap((result) => result.items) || [];
  const campaignItems =
    matches.data?.pages.flatMap((result) => result.items) || [];
  const selectedId = selected || items[0]?.id;
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({
      desk: page,
      deskQ: filters.q,
      deskView: filters.view,
      deskCampaign: filters.campaignId,
      deskSignal: filters.signal,
      deskDays: String(filters.days),
      person: selected || "",
    })) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(null, "", url);
  }, [page, filters, selected]);
  const update = (patch: Partial<DeskQuery>) =>
    setFilters((current) => ({ ...current, ...patch, cursor: "" }));
  const reset = () => setFilters(deskQuerySchema.parse({}));
  const select = (id: string) => {
    setSelected(id);
    setPage("today");
  };
  const title = {
    today: "A good day starts with a conversation.",
    campaigns: "Turn campaign activity into conversations.",
    followups: "Nothing slips through the cracks.",
    automations: "A capable assistant behind every conversation.",
    connections: "Know what your desk knows.",
    performance: "Measure the relationships that move forward.",
  }[page];
  return (
    <section className="outreach-desk" data-testid="outreach-desk">
      <aside className="desk-sidebar">
        <div className="desk-brand">
          <Sun size={30} />
          <div>
            NEW DAWN<small>OUTREACH DESK</small>
          </div>
        </div>
        <nav aria-label="Outreach Desk sections">
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={17} />
              {label}
              {id === "followups" && !!overview.data?.awaitingReview && (
                <span>{overview.data.awaitingReview}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="desk-sidebar-note">
          <Sun size={26} />
          <strong>You build the relationship.</strong>
          <p>Your desk takes care of the details.</p>
        </div>
      </aside>
      <div className="desk-main">
        <header className="desk-heading">
          <div>
            <div className="desk-eyebrow">
              Outreach Desk / {pages.find((p) => p.id === page)?.label}
            </div>
            <h1>{title}</h1>
            <p>Priorities, context and follow-through. All in one place.</p>
          </div>
          <button
            className="desk-button"
            disabled={prepare.isPending}
            onClick={() => prepare.mutate()}
          >
            <RefreshCw
              size={15}
              className={prepare.isPending ? "animate-spin" : ""}
            />
            Refresh queue
          </button>
        </header>
        {(prepare.error || enqueue.error || overview.error) && (
          <div className="desk-alert" role="alert">
            {prepare.error?.message ||
              enqueue.error?.message ||
              overview.error?.message}
            <button
              onClick={() =>
                void queryClient.invalidateQueries({ queryKey: ["desk"] })
              }
            >
              Retry
            </button>
          </div>
        )}
        {page === "today" && (
          <>
            <div className="desk-daily-brief">
              <Sun size={29} />
              <div>
                <strong>
                  {overview.isPending
                    ? "Preparing your desk…"
                    : overview.data
                      ? `${overview.data.callbacks} callbacks due · ${overview.data.replies} replies waiting · ${overview.data.needsResearch} need contact research`
                      : "Your desk needs a refresh"}
                </strong>
                <p>
                  Commitments and replies come first. Open-only signals need a
                  conversation to establish interest.
                </p>
                <small>
                  Last preparation:{" "}
                  {displayTime(overview.data?.settings.lastPreparedAt || null)}
                </small>
                {overview.data?.settings.preparationError && (
                  <p role="alert">{overview.data.settings.preparationError}</p>
                )}
              </div>
            </div>
            <div className="desk-stats">
              {[
                [
                  "Provider-recorded calls",
                  overview.data?.confirmedCalls,
                  "Today · UTC",
                ],
                [
                  "Completed calls",
                  overview.data?.connectedCalls,
                  "Provider duration > 0",
                ],
                [
                  "Confirmed meetings",
                  overview.data?.confirmedMeetings,
                  "Provider-identified bookings",
                ],
                [
                  "Prepared follow-ups",
                  overview.data?.awaitingReview,
                  "Awaiting review",
                ],
              ].map(([label, value, foot]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  <strong>{value ?? "—"}</strong>
                  <small>{foot}</small>
                </div>
              ))}
            </div>
          </>
        )}
        {(page === "today" || page === "campaigns") && (
          <>
            <div className="desk-filters">
              <label className="desk-search">
                <Search size={16} />
                <input
                  aria-label="Search people"
                  placeholder="Search name, company, email or phone…"
                  value={filters.q}
                  onChange={(e) => update({ q: e.target.value })}
                />
              </label>
              {page === "today" ? (
                <select
                  aria-label="Queue view"
                  value={filters.view}
                  onChange={(e) =>
                    update({ view: e.target.value as DeskQuery["view"] })
                  }
                >
                  {[
                    ["today", "Due now"],
                    ["all", "All upcoming"],
                    ["callbacks", "Callbacks"],
                    ["replies", "Replies"],
                    ["opens", "Observed opens"],
                    ["research", "Needs research"],
                    ["history", "History / handled"],
                  ].map(([v, label]) => (
                    <option value={v} key={v}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <select
                    aria-label="Campaign"
                    value={filters.campaignId}
                    onChange={(e) => update({ campaignId: e.target.value })}
                  >
                    <option value="">All campaigns</option>
                    {campaigns.data?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Engagement signal"
                    value={filters.signal}
                    onChange={(e) =>
                      update({ signal: e.target.value as DeskQuery["signal"] })
                    }
                  >
                    <option value="all">All activity</option>
                    <option value="opened">Observed opens</option>
                    <option value="clicked">Clicks</option>
                    <option value="replied">Replies</option>
                  </select>
                  <select
                    aria-label="Activity window"
                    value={filters.days}
                    onChange={(e) => update({ days: Number(e.target.value) })}
                  >
                    {[7, 30, 90, 365].map((days) => (
                      <option key={days} value={days}>
                        Last {days} days
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button
                className="desk-button"
                onClick={() => setSaveOpen(!saveOpen)}
              >
                Save view
              </button>
              <button className="desk-button" onClick={reset}>
                Reset
              </button>
              {!!views.data?.length && (
                <select
                  aria-label="Saved views"
                  value=""
                  onChange={(e) => {
                    const view = views.data?.find(
                      (v) => v.id === e.target.value,
                    );
                    if (view) setFilters(deskQuerySchema.parse(view.filters));
                  }}
                >
                  <option value="">Saved views</option>
                  {views.data.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {saveOpen && (
              <form
                className="desk-save-view"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveView.mutate();
                }}
              >
                <input
                  required
                  maxLength={80}
                  aria-label="Saved view name"
                  placeholder="Name this view"
                  value={savedName}
                  onChange={(e) => setSavedName(e.target.value)}
                />
                <button
                  className="desk-button primary"
                  disabled={saveView.isPending}
                >
                  Save current filters
                </button>
                {saveView.error && <p role="alert">{saveView.error.message}</p>}
              </form>
            )}
          </>
        )}
        {page === "today" && (
          <div className="desk-work-grid">
            <section className="desk-panel">
              <div className="desk-panel-heading">
                <h2>Your next conversations</h2>
                <p>{items.length} loaded · one action at a time</p>
              </div>
              {queue.isPending ? (
                <div className="desk-empty" aria-busy="true">
                  Loading your queue…
                </div>
              ) : queue.error ? (
                <div className="desk-empty" role="alert">
                  Could not load the queue.{" "}
                  <button onClick={() => void queue.refetch()}>Retry</button>
                </div>
              ) : !items.length ? (
                <div className="desk-empty">
                  No people match this view.{" "}
                  <button onClick={reset}>Clear filters</button>
                  <p>
                    Use Campaign explorer to choose a person from recent
                    activity.
                  </p>
                </div>
              ) : (
                items.map((p) => (
                  <button
                    key={p.id}
                    className={`desk-queue-person ${p.id === selectedId ? "selected" : ""}`}
                    aria-pressed={p.id === selectedId}
                    onClick={() => setSelected(p.id)}
                  >
                    <span className="desk-avatar small">
                      {initials(p.name)}
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>{p.company || p.email}</small>
                      <em>{reason(p)}</em>
                    </span>
                    <span className="desk-queue-time">
                      {localTime(p.timezone)}
                      <small>
                        {p.eligibility.call.allowed
                          ? "Call eligible"
                          : "Review eligibility"}
                      </small>
                    </span>
                  </button>
                ))
              )}
              {queue.hasNextPage && (
                <button
                  className="desk-button desk-load"
                  disabled={queue.isFetchingNextPage}
                  onClick={() => void queue.fetchNextPage()}
                >
                  Load more
                </button>
              )}
            </section>
            {selectedId ? (
              <PersonPanel
                key={selectedId}
                id={selectedId}
                onComplete={() => {
                  setSelected(
                    items.find((p) => p.id !== selectedId)?.id || null,
                  );
                  void queryClient.invalidateQueries({ queryKey: ["desk"] });
                }}
              />
            ) : (
              <section className="desk-panel desk-empty">
                <Headphones size={36} />
                <h2>Your next conversation starts here.</h2>
                <p>
                  Select someone from the queue or find people in a campaign.
                </p>
              </section>
            )}
          </div>
        )}
        {page === "campaigns" && (
          <section className="desk-panel">
            <div className="desk-panel-heading">
              <h2>People behind the activity</h2>
              <p>
                Unique email identities within the selected campaign and time
                window. Opens are observed events, not proof of interest.
              </p>
            </div>
            {campaigns.error && (
              <div className="desk-alert">
                Campaign list unavailable.{" "}
                <button onClick={() => void campaigns.refetch()}>Retry</button>
              </div>
            )}
            <div className="desk-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Campaign</th>
                    <th>Signals</th>
                    <th>Contact</th>
                    <th>Next step</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.isPending ? (
                    <tr>
                      <td colSpan={5}>Loading campaign activity…</td>
                    </tr>
                  ) : matches.error ? (
                    <tr>
                      <td colSpan={5} role="alert">
                        Could not load activity.{" "}
                        <button onClick={() => void matches.refetch()}>
                          Retry
                        </button>
                      </td>
                    </tr>
                  ) : !campaignItems.length ? (
                    <tr>
                      <td colSpan={5} className="desk-empty">
                        No matching people. Try another campaign or reset the
                        filters.
                      </td>
                    </tr>
                  ) : (
                    campaignItems.map((p) => (
                      <tr key={p.email}>
                        <td>
                          <strong>{p.name || p.email}</strong>
                          <small>{p.company}</small>
                        </td>
                        <td>
                          {p.campaignName}
                          <small>{displayTime(p.lastActivityAt)}</small>
                        </td>
                        <td>
                          <span
                            className={`desk-pill ${p.replied ? "" : "amber"}`}
                          >
                            {p.replied
                              ? "Reply recorded"
                              : p.clicks
                                ? "Click observed"
                                : "Email activity"}
                          </span>
                          <small>
                            {p.opens} opens · {p.clicks} clicks
                          </small>
                        </td>
                        <td>
                          {p.email}
                          <small>{p.phone || "Phone needed"}</small>
                        </td>
                        <td>
                          <button
                            className="desk-button"
                            disabled={enqueue.isPending}
                            onClick={() =>
                              p.queueId
                                ? select(p.queueId)
                                : enqueue.mutate(p.sendId)
                            }
                          >
                            {p.queueId ? "Open person" : "Add to my desk"}
                            <ArrowUpRight size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {matches.hasNextPage && (
              <button
                className="desk-button desk-load"
                disabled={matches.isFetchingNextPage}
                onClick={() => void matches.fetchNextPage()}
              >
                Load more people
              </button>
            )}
          </section>
        )}
        {page === "followups" && <Followups onSelect={select} />}
        {page === "automations" && <AutomationSettings />}
        {page === "connections" && <Connections />}
        {page === "performance" && <Performance overview={overview.data} />}
        <p className="desk-footnote">
          <Calendar size={12} /> Live CRM records ·{" "}
          {overview.data
            ? `Updated ${displayTime(overview.data.generatedAt)}`
            : "Waiting for data"}
        </p>
      </div>
    </section>
  );
}
