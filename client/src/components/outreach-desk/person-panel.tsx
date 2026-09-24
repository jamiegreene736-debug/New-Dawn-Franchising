import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  Linkedin,
  Save,
  X,
  ShieldCheck,
} from "lucide-react";
import type {
  DeskChannel,
  DeskDetail,
  DeskOutcome,
} from "@shared/outreach-desk";
import {
  request,
  displayTime,
  initials,
  localTime,
  localCallbackToUtc,
} from "./api";

const outcomes: Array<[DeskOutcome["outcome"], string]> = [
  ["details", "Send details"],
  ["callback", "Callback"],
  ["no_answer", "No answer"],
  ["voicemail", "Voicemail"],
  ["meeting_pending", "Ready to meet"],
  ["not_interested", "Not interested"],
  ["wrong_number", "Wrong number"],
  ["dnc", "Do not contact"],
];
const icons = {
  call: Phone,
  email: Mail,
  sms: MessageCircle,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
};
export function PersonPanel({
  id,
  onComplete,
}: {
  id: string;
  onComplete: () => void;
}) {
  const client = useQueryClient();
  const query = useQuery<DeskDetail>({
    queryKey: ["desk", "person", id],
    queryFn: () => request(`/people/${id}`),
    refetchInterval: 60_000,
  });
  const [mode, setMode] = useState<
    "profile" | "call" | "edit" | "permission" | "compose"
  >("profile");
  const [channel, setChannel] = useState<DeskChannel>("email");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState<DeskOutcome["outcome"]>("details");
  const [callback, setCallback] = useState("");
  const [expectedVersion, setExpectedVersion] = useState<string | null>(null);
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [draftSubject, setDraftSubject] = useState(
    "Following up with New Dawn Franchising",
  );
  const [draftBody, setDraftBody] = useState("");
  const [timezone, setTimezone] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [evidence, setEvidence] = useState("");
  const [allowed, setAllowed] = useState(true);
  const [expires, setExpires] = useState(() =>
    new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10),
  );
  const mutation = useMutation({
    mutationFn: ({
      path,
      method = "POST",
      body,
    }: {
      path: string;
      method?: string;
      body?: unknown;
    }) => request<Record<string, unknown>>(path, method, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["desk"] });
    },
  });
  if (query.isPending)
    return (
      <section className="desk-panel desk-empty" aria-busy="true">
        Loading the conversation…
      </section>
    );
  if (query.error || !query.data)
    return (
      <section className="desk-panel desk-empty">
        <p role="alert">Could not load this person.</p>
        <button onClick={() => void query.refetch()}>Retry</button>
      </section>
    );
  const { person: p, brief, timeline } = query.data;
  const act = async (path: string, body?: unknown, method = "POST") => {
    try {
      const result = await mutation.mutateAsync({ path, body, method });
      setNotice("");
      return result;
    } catch {
      return null;
    }
  };
  const beginCall = async () => {
    if (await act(`/people/${id}/claim`)) {
      setExpectedVersion(p.updatedAt);
      setMode("call");
    }
  };
  const save = async () => {
    let scheduledAt: string | undefined;
    try {
      if (outcome === "callback")
        scheduledAt = localCallbackToUtc(callback, p.timezone || "");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Check the callback time.",
      );
      return;
    }
    const saved = await act(`/people/${id}/outcome`, {
      operationId,
      expectedUpdatedAt: expectedVersion || p.updatedAt,
      outcome,
      notes,
      scheduledAt,
    });
    if (saved) {
      setOperationId(crypto.randomUUID());
      setNotes("");
      setMode("profile");
      onComplete();
    }
  };
  const openCompose = (next: DeskChannel) => {
    setChannel(next);
    setDraftBody(
      `Hi ${p.name.split(" ")[0]},\n\nI’m reaching out from New Dawn Franchising. Would a short introduction with Dylan be useful?`,
    );
    setMode("compose");
  };
  const openProfile = () => {
    setTimezone(p.timezone || "");
    setPhone(p.phone || "");
    setLinkedin(p.linkedinUrl || "");
    setMode("edit");
  };
  return (
    <section className="desk-panel desk-person" aria-label="Contact workspace">
      <header className="desk-person-heading">
        <span className="desk-avatar">{initials(p.name)}</span>
        <div>
          <h2>{p.name}</h2>
          <p>
            {p.company ||
              (p.track === "client" ? "Franchise buyer" : "Referral partner")}
          </p>
          <span className="desk-pill">{p.status.replaceAll("_", " ")}</span>
        </div>
        {mode !== "profile" && (
          <button
            className="desk-icon-button"
            aria-label="Back to profile"
            onClick={() => setMode("profile")}
          >
            <X size={18} />
          </button>
        )}
      </header>
      <div className="desk-person-body">
        {mutation.error && (
          <div className="desk-alert" role="alert">
            {mutation.error.message}{" "}
            <button
              onClick={() => {
                mutation.reset();
                setExpectedVersion(null);
                void query.refetch();
              }}
            >
              Refresh record
            </button>
          </div>
        )}
        {notice && (
          <div className="desk-alert" role="status">
            {notice}
          </div>
        )}
        {mode === "profile" && (
          <>
            <div className="desk-channels">
              {(["call", "email", "sms", "whatsapp", "linkedin"] as const).map(
                (key) => {
                  const Icon = icons[key];
                  return (
                    <button
                      key={key}
                      className={`desk-button ${key === "call" ? "primary" : ""}`}
                      onClick={() =>
                        key === "call" ? void beginCall() : openCompose(key)
                      }
                      title={p.eligibility[key].reason}
                    >
                      <Icon size={14} />
                      {key === "call"
                        ? "Call workspace"
                        : key === "whatsapp"
                          ? "WhatsApp"
                          : key === "linkedin"
                            ? "LinkedIn"
                            : key === "sms"
                              ? "SMS"
                              : "Email"}
                    </button>
                  );
                },
              )}
            </div>
            <dl className="desk-fields">
              <div>
                <dt>Phone</dt>
                <dd>{p.phone || "Phone needed"}</dd>
                <small>{p.eligibility.call.reason}</small>
              </div>
              <div>
                <dt>Local time</dt>
                <dd>{localTime(p.timezone)}</dd>
                <small>{p.timezone || "Confirm before timed outreach"}</small>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{p.email || "Email needed"}</dd>
                <small>
                  {query.data.emailStatus || "Unverified"} ·{" "}
                  {displayTime(query.data.emailVerifiedAt)}
                </small>
              </div>
              <div>
                <dt>Next commitment</dt>
                <dd>{displayTime(p.nextAttemptAt, p.timezone)}</dd>
                <small>{p.attemptCount} recorded outcomes</small>
              </div>
            </dl>
            <div className="desk-toolbar">
              <button className="desk-link" onClick={openProfile}>
                Edit contact details
              </button>
              <button
                className="desk-link"
                onClick={() => {
                  setChannel("call");
                  setMode("permission");
                }}
              >
                Channel eligibility
              </button>
              <button
                className="desk-link"
                disabled={mutation.isPending || !p.email}
                onClick={() => void act(`/people/${id}/verify-email`)}
              >
                Verify email
              </button>
            </div>
            <div className="desk-brief">
              <div className="desk-eyebrow">
                Conversation brief · source-based
              </div>
              <p>{brief}</p>
              <small>
                {p.emailSubject
                  ? `Campaign subject: ${p.emailSubject}`
                  : "Based on the recorded queue signal and audience."}
              </small>
            </div>
            {p.outcomeNotes && (
              <div className="desk-brief">
                <strong>Last conversation note</strong>
                <p>{p.outcomeNotes}</p>
              </div>
            )}
            <div className="desk-section-heading">
              <h3>Relationship timeline</h3>
              <span>Latest 60 events</span>
            </div>
            <ol className="desk-timeline">
              {timeline.length ? (
                timeline.map((item) => (
                  <li key={`${item.kind}:${item.id}`}>
                    <time>{displayTime(item.occurredAt)}</time>
                    <strong>{item.kind.replaceAll("_", " ")}</strong>
                    <p>{item.detail}</p>
                  </li>
                ))
              ) : (
                <li>No activity has been recorded yet.</li>
              )}
            </ol>
          </>
        )}
        {mode === "call" && (
          <>
            <div className="desk-brief">
              <strong>
                {p.eligibility.call.allowed
                  ? "Ready for a dialer handoff"
                  : "Call held"}
              </strong>
              <p>{p.eligibility.call.reason}</p>
            </div>
            <button
              className="desk-button primary"
              disabled={!p.eligibility.call.allowed || mutation.isPending}
              onClick={async () => {
                const result = await act(`/people/${id}/handoff`);
                if (typeof result?.href === "string") {
                  setNotice(
                    "Dialer handoff requested. A completed call requires provider evidence.",
                  );
                  window.location.href = result.href;
                }
              }}
            >
              <Phone size={15} />
              Open dialer
            </button>
            <div className="desk-script">
              <h3>Open naturally</h3>
              <p>
                “Hi {p.name.split(" ")[0]}, this is [your name] with New Dawn
                Franchising. Have I caught you at an okay time for a quick
                conversation?”
              </p>
              <h3>Listen, then invite</h3>
              <p>{brief}</p>
            </div>
            <div className="desk-outcomes">
              {outcomes.map(([value, label]) => (
                <button
                  key={value}
                  className={outcome === value ? "selected" : ""}
                  aria-pressed={outcome === value}
                  onClick={() => setOutcome(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="desk-field">
              Conversation notes
              <textarea
                maxLength={4000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What mattered to them? What did you promise?"
              />
            </label>
            {outcome === "callback" && (
              <label className="desk-field">
                Callback in {p.timezone || "confirmed recipient timezone"}
                <input
                  type="datetime-local"
                  value={callback}
                  onChange={(e) => setCallback(e.target.value)}
                />
              </label>
            )}
            {outcome === "meeting_pending" && (
              <p className="desk-hint">
                This creates a pending meeting outcome. Use the calendar link;
                the provider booking is the confirmation.
              </p>
            )}
            {outcome === "details" && (
              <p className="desk-hint">
                Prepares an overview email draft and pauses competing campaign
                outreach. Review it in Follow-ups.
              </p>
            )}
            <button
              className="desk-button primary wide"
              disabled={mutation.isPending}
              onClick={() => void save()}
            >
              <Save size={15} />
              Save outcome & next person
            </button>
          </>
        )}
        {mode === "edit" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act(
                  `/people/${id}/profile`,
                  {
                    timezone,
                    phone: phone || undefined,
                    linkedinUrl: linkedin,
                  },
                  "PATCH",
                )
              )
                setMode("profile");
            }}
          >
            <h3>Confirm contact details</h3>
            <label className="desk-field">
              Timezone
              <input
                required
                placeholder="America/New_York"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                list="desk-timezones"
              />
            </label>
            <datalist id="desk-timezones">
              {[
                "America/New_York",
                "America/Chicago",
                "America/Denver",
                "America/Los_Angeles",
                "Pacific/Honolulu",
                "Europe/London",
                "Asia/Bangkok",
                "America/Mexico_City",
              ].map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
            <label className="desk-field">
              Phone with country code
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1…"
              />
            </label>
            <label className="desk-field">
              LinkedIn profile
              <input
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://www.linkedin.com/in/…"
              />
            </label>
            <button
              className="desk-button primary"
              disabled={mutation.isPending}
            >
              Save verified details
            </button>
          </form>
        )}
        {mode === "permission" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act(`/people/${id}/permissions`, {
                  channel,
                  allowed,
                  evidence,
                  expiresAt: new Date(`${expires}T23:59:59Z`).toISOString(),
                })
              )
                setMode("profile");
            }}
          >
            <h3>Record channel eligibility</h3>
            <p className="desk-hint">
              Record the actual basis for this contact and jurisdiction:
              requested contact, permission, screening or another approved
              policy. An email open alone is insufficient.
            </p>
            <label className="desk-field">
              Channel
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as DeskChannel)}
              >
                {["call", "email", "sms", "whatsapp"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="desk-field">
              Decision
              <select
                value={allowed ? "yes" : "no"}
                onChange={(e) => setAllowed(e.target.value === "yes")}
              >
                <option value="yes">Eligible based on recorded evidence</option>
                <option value="no">Hold this channel</option>
              </select>
            </label>
            <label className="desk-field">
              Evidence
              <textarea
                required
                minLength={8}
                maxLength={1000}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Source, date, scope and screening reference…"
              />
            </label>
            <label className="desk-field">
              Review / expiry date
              <input
                type="date"
                required
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </label>
            <button
              className="desk-button primary"
              disabled={mutation.isPending}
            >
              <ShieldCheck size={15} />
              Save evidence
            </button>
          </form>
        )}
        {mode === "compose" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await act(`/people/${id}/drafts`, {
                  operationId,
                  channel,
                  subject: draftSubject,
                  body: draftBody,
                })
              ) {
                setOperationId(crypto.randomUUID());
                setNotice("Draft saved. Review and schedule it in Follow-ups.");
                setMode("profile");
              }
            }}
          >
            <h3>
              {channel === "linkedin"
                ? "Prepare a personal LinkedIn touch"
                : `Prepare ${channel} follow-up`}
            </h3>
            <p className="desk-hint">{p.eligibility[channel].reason}</p>
            {channel === "linkedin" && p.linkedinUrl && (
              <a
                className="desk-button"
                href={p.linkedinUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open verified profile
              </a>
            )}
            {channel === "email" && (
              <label className="desk-field">
                Subject
                <input
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  maxLength={200}
                />
              </label>
            )}
            <label className="desk-field">
              Message
              <textarea
                required
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                maxLength={4000}
              />
            </label>
            <button
              className="desk-button primary"
              disabled={mutation.isPending}
            >
              Save draft
            </button>
          </form>
        )}
      </div>
      <footer className="desk-person-footer">
        <span>One relationship. A clear next step.</span>
        <a
          href={query.data.calendarUrl}
          target="_blank"
          rel="noreferrer"
          className="desk-button"
        >
          <Calendar size={14} />
          Open calendar
        </a>
      </footer>
    </section>
  );
}
