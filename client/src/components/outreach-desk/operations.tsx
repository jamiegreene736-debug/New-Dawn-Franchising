import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DeskConnection,
  DeskOverview,
  DeskSettings,
} from "@shared/outreach-desk";
import { request, displayTime } from "./api";
export function AutomationSettings() {
  const client = useQueryClient();
  const query = useQuery<DeskSettings>({
    queryKey: ["desk", "settings"],
    queryFn: () => request("/settings"),
  });
  const [confirmation, setConfirmation] = useState(false);
  const change = useMutation({
    mutationFn: (data: DeskSettings) =>
      request("/settings", "PATCH", {
        paused: data.paused,
        autoFollowups: data.autoFollowups,
        dailyLimit: data.dailyLimit,
      }),
    onSuccess: () => {
      setConfirmation(false);
      void client.invalidateQueries({ queryKey: ["desk"] });
    },
  });
  const s = query.data;
  if (!s)
    return (
      <div className="desk-empty">
        {query.error ? "Settings could not be loaded." : "Loading settings…"}
        <button onClick={() => void query.refetch()}>Retry</button>
      </div>
    );
  return (
    <div className="desk-operations">
      <section className="desk-panel">
        <div className="desk-panel-heading">
          <h2>From activity to a useful conversation</h2>
          <p>
            One shared queue. Preparation every 15 minutes. The agent owns the
            conversation.
          </p>
        </div>
        <ol className="desk-flow">
          {[
            [
              "Read synced activity",
              "Collect engagement and replies from the existing provider syncs.",
            ],
            [
              "Prepare the queue",
              "Surface callbacks, replies, campaign signals and missing information.",
            ],
            [
              "Make the connection",
              "Read the brief, start the call and agree a next step.",
            ],
            [
              "Handle follow-through",
              "Prepare requested-details drafts; dispatch approved, eligible follow-ups.",
            ],
            [
              "Stop and reconcile",
              "Hold on replies, suppression, bookings, expired permission or uncertain provider results.",
            ],
          ].map(([title, body], i) => (
            <li key={title}>
              <span>{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="desk-panel">
        <div className="desk-panel-heading">
          <h2>Execution controls</h2>
          <p>
            These controls affect Outreach Desk follow-ups. Existing campaigns
            have their own controls.
          </p>
        </div>
        <div className="desk-person-body">
          {change.error && (
            <div className="desk-alert" role="alert">
              {change.error.message}
            </div>
          )}
          <label className="desk-switch">
            <span>
              <strong>Pause desk sending</strong>
              <small>
                Scheduled work is held; in-flight messages may already be
                accepted.
              </small>
            </span>
            <input
              type="checkbox"
              checked={s.paused}
              disabled={change.isPending}
              onChange={(e) =>
                change.mutate({ ...s, paused: e.target.checked })
              }
            />
          </label>
          <label className="desk-switch">
            <span>
              <strong>Requested-details playbook</strong>
              <small>
                Automatically schedule the fixed overview email after the agent
                records “Send details”. Permission, verification and stop rules
                still apply.
              </small>
            </span>
            <input
              type="checkbox"
              checked={s.autoFollowups}
              disabled={change.isPending}
              onChange={(e) =>
                e.target.checked
                  ? setConfirmation(true)
                  : change.mutate({ ...s, autoFollowups: false })
              }
            />
          </label>
          {confirmation && (
            <div className="desk-brief">
              <h3>Activate this specific playbook?</h3>
              <p>
                After “Send details”, the prepared message links to New Dawn’s
                process or partner overview and asks whether an introduction
                with Dylan would help. This permits automatic sending of
                eligible requested-details drafts prepared within the last seven
                days.
              </p>
              <div className="desk-toolbar">
                <button
                  className="desk-button primary"
                  disabled={change.isPending}
                  onClick={() => change.mutate({ ...s, autoFollowups: true })}
                >
                  Activate playbook
                </button>
                <button
                  className="desk-button"
                  onClick={() => setConfirmation(false)}
                >
                  Keep manual review
                </button>
              </div>
            </div>
          )}
          <label className="desk-field">
            Daily desk send cap
            <select
              value={s.dailyLimit}
              disabled={change.isPending}
              onChange={(e) =>
                change.mutate({ ...s, dailyLimit: Number(e.target.value) })
              }
            >
              {Array.from(new Set([10, 20, 30, 50, 100, s.dailyLimit]))
                .sort((a, b) => a - b)
                .map((value) => (
                  <option key={value} value={value}>
                    {value} messages
                  </option>
                ))}
            </select>
          </label>
          <p className="desk-hint">
            Maximum one desk follow-up per contact per rolling 24 hours. Local
            contact hours: weekdays 9 AM–6 PM. LinkedIn remains manual.
          </p>
          <div className="desk-brief">
            <strong>Last preparation</strong>
            <p>{displayTime(s.lastPreparedAt)}</p>
            {s.preparationError && <p role="alert">{s.preparationError}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
export function Connections() {
  const query = useQuery<DeskConnection[]>({
    queryKey: ["desk", "connections"],
    queryFn: () => request("/connections"),
    refetchInterval: 60_000,
  });
  if (query.isPending)
    return <div className="desk-empty">Reading connection evidence…</div>;
  if (query.error)
    return (
      <div className="desk-alert" role="alert">
        Connections could not be loaded.{" "}
        <button onClick={() => void query.refetch()}>Retry</button>
      </div>
    );
  return (
    <>
      <div className="desk-brief">
        <p>
          “Configured” means credentials are present. It does not prove account
          authorization, delivery or a successful sync. Evidence timestamps show
          recorded activity.
        </p>
      </div>
      <div className="desk-connection-grid">
        {query.data?.map((card) => (
          <section className="desk-panel desk-connection" key={card.id}>
            <span className={`desk-pill ${card.configured ? "" : "amber"}`}>
              {card.status}
            </span>
            <h2>{card.name}</h2>
            <p>{card.detail}</p>
            <small>Latest evidence: {displayTime(card.lastEvidenceAt)}</small>
          </section>
        ))}
      </div>
    </>
  );
}
export function Performance({ overview }: { overview?: DeskOverview }) {
  return (
    <section className="desk-panel">
      <div className="desk-panel-heading">
        <h2>Activity backed by recorded evidence</h2>
        <p>
          Today · UTC reporting boundary. Counts are not conversion cohorts.
        </p>
      </div>
      <div className="desk-person-body">
        <dl className="desk-fields">
          <div>
            <dt>Provider-recorded outbound calls</dt>
            <dd>{overview?.confirmedCalls ?? "—"}</dd>
          </div>
          <div>
            <dt>Completed calls with duration</dt>
            <dd>{overview?.connectedCalls ?? "—"}</dd>
          </div>
          <div>
            <dt>Provider-identified confirmed bookings</dt>
            <dd>{overview?.confirmedMeetings ?? "—"}</dd>
          </div>
          <div>
            <dt>Follow-ups needing attention</dt>
            <dd>{overview?.exceptions ?? "—"}</dd>
          </div>
        </dl>
        <div className="desk-brief">
          <h3>What these numbers mean</h3>
          <p>
            Dialer handoffs do not count as calls. Ready-to-meet outcomes do not
            count as confirmed bookings. Only imported Calendly API event URLs
            qualify as provider-identified bookings here; older manually
            recorded meetings remain visible in the existing reports.
          </p>
          <p>
            Meeting attendance and qualification are separate relationship
            outcomes. Use the existing Reports and meeting records to review
            them.
          </p>
        </div>
      </div>
    </section>
  );
}
