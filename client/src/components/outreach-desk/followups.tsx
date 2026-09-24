import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeskAction } from "@shared/outreach-desk";
import { request, displayTime } from "./api";
export function Followups({ onSelect }: { onSelect: (id: string) => void }) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<DeskAction | null>(null);
  const [copyError, setCopyError] = useState("");
  const edit = useMutation({
    mutationFn: (item: DeskAction) =>
      request(`/actions/${item.id}`, "PATCH", {
        subject: item.subject,
        body: item.body,
        updatedAt: item.updatedAt,
      }),
    onSuccess: () => {
      setEditing(null);
      void client.invalidateQueries({ queryKey: ["desk"] });
    },
  });
  const [schedule, setSchedule] = useState<Record<string, string>>({});
  const query = useQuery<DeskAction[]>({
    queryKey: ["desk", "actions"],
    queryFn: () => request("/actions"),
    refetchInterval: 30_000,
  });
  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: "approve" | "cancel" }) =>
      request(
        `/actions/${id}/${kind}`,
        "POST",
        kind === "approve"
          ? {
              scheduledAt: schedule[id]
                ? new Date(schedule[id]).toISOString()
                : new Date().toISOString(),
            }
          : {},
      ),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["desk"] }),
  });
  return (
    <section className="desk-panel">
      <div className="desk-panel-heading">
        <h2>Follow-through, without the loose ends.</h2>
        <p>
          Review exact content, then schedule. Eligibility is checked again
          immediately before sending.
        </p>
      </div>
      {(action.error || edit.error || copyError) && (
        <div className="desk-alert" role="alert">
          {action.error?.message || edit.error?.message || copyError}
        </div>
      )}
      {query.isPending ? (
        <div className="desk-empty">Loading follow-ups…</div>
      ) : query.error ? (
        <div className="desk-empty" role="alert">
          Could not load follow-ups.{" "}
          <button onClick={() => void query.refetch()}>Retry</button>
        </div>
      ) : !query.data?.length ? (
        <div className="desk-empty">
          No follow-ups yet. Save a draft or record “Send details” after a
          conversation.
        </div>
      ) : (
        query.data.map((item) => (
          <article className="desk-followup" key={item.id}>
            <div className="desk-section-heading">
              <div>
                <h3>{item.name}</h3>
                <p>
                  {item.channel} · {item.recipient}
                </p>
              </div>
              <span
                className={`desk-pill ${["held", "unknown", "failed"].includes(item.status) ? "amber" : ""}`}
              >
                {item.status}
              </span>
            </div>
            {editing?.id === item.id ? (
              <form
                className="desk-person-body"
                onSubmit={(e) => {
                  e.preventDefault();
                  edit.mutate(editing);
                }}
              >
                <label className="desk-field">
                  Subject
                  <input
                    aria-label="Subject"
                    maxLength={200}
                    value={editing.subject}
                    onChange={(e) =>
                      setEditing({ ...editing, subject: e.target.value })
                    }
                  />
                </label>
                <label className="desk-field">
                  Message
                  <textarea
                    aria-label="Message"
                    required
                    maxLength={4000}
                    value={editing.body}
                    onChange={(e) =>
                      setEditing({ ...editing, body: e.target.value })
                    }
                  />
                </label>
                <button
                  className="desk-button primary"
                  disabled={edit.isPending}
                >
                  Save changes
                </button>
                <button
                  type="button"
                  className="desk-button"
                  onClick={() => setEditing(null)}
                >
                  Discard changes
                </button>
              </form>
            ) : (
              <>
                <strong>{item.subject}</strong>
                <p className="desk-message">{item.body}</p>
              </>
            )}
            {item.error && <div className="desk-alert">{item.error}</div>}
            <p className="desk-hint">
              {item.scheduledAt
                ? `Scheduled: ${displayTime(item.scheduledAt)}`
                : `Prepared: ${displayTime(item.createdAt)}`}
              {item.providerId ? ` · Provider receipt: ${item.providerId}` : ""}
            </p>
            <div className="desk-toolbar">
              {["draft", "held"].includes(item.status) && (
                <button
                  className="desk-button"
                  onClick={() => setEditing(item)}
                >
                  Edit draft
                </button>
              )}
              <button
                className="desk-button"
                onClick={() => onSelect(item.queueId)}
              >
                Open person
              </button>
              {["draft", "held"].includes(item.status) &&
                item.channel !== "linkedin" && (
                  <>
                    <label className="desk-field compact">
                      Send time · your device timezone
                      <input
                        aria-label={`Send time for ${item.name}`}
                        type="datetime-local"
                        value={schedule[item.id] || ""}
                        onChange={(e) =>
                          setSchedule({
                            ...schedule,
                            [item.id]: e.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      className="desk-button primary"
                      disabled={action.isPending || editing?.id === item.id}
                      onClick={() =>
                        action.mutate({ id: item.id, kind: "approve" })
                      }
                    >
                      {schedule[item.id]
                        ? "Approve & schedule"
                        : "Approve for next run"}
                    </button>
                  </>
                )}
              {item.channel === "linkedin" && (
                <button
                  className="desk-button"
                  onClick={() => {
                    navigator.clipboard.writeText(item.body).then(
                      () => setCopyError(""),
                      () =>
                        setCopyError(
                          "Clipboard unavailable. Select and copy the draft text manually.",
                        ),
                    );
                  }}
                >
                  Copy draft
                </button>
              )}
              {["draft", "held", "scheduled"].includes(item.status) && (
                <button
                  className="desk-button"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: item.id, kind: "cancel" })}
                >
                  Cancel
                </button>
              )}
            </div>
          </article>
        ))
      )}
      <div className="desk-panel-heading">
        <p>
          Latest 100 follow-ups. “Accepted” means the provider accepted the
          message; it does not prove delivery or a reply. Unknown results
          require checking provider history.
        </p>
      </div>
    </section>
  );
}
