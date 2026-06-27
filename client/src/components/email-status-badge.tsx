import { XCircle, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

// Deliverability verdict badge driven by <record>.email_status (Hunter).
// Rendered next to an email address in contact lists + campaign enrollment views.
// - invalid  → red "Will bounce" (excluded from sending, auto-suppressed)
// - risky    → amber "Risky"      (catch-all / low confidence; excluded under strict)
// - valid    → green "Valid"
// - unknown  → gray "Unverified"  (Hunter couldn't confirm)
// - null/unverified → nothing (never checked)
const MAP: Record<string, { label: string; cls: string; Icon: typeof XCircle; title: string }> = {
  invalid: { label: "Will bounce", cls: "bg-red-100 text-red-700", Icon: XCircle, title: "Undeliverable — will bounce. Excluded from sending and suppressed." },
  risky: { label: "Risky", cls: "bg-amber-100 text-amber-700", Icon: AlertTriangle, title: "Catch-all / risky address — excluded under strict verification." },
  valid: { label: "Valid", cls: "bg-green-100 text-green-700", Icon: CheckCircle2, title: "Verified deliverable." },
  unknown: { label: "Unverified", cls: "bg-gray-100 text-gray-600", Icon: HelpCircle, title: "Could not confirm deliverability." },
};

export function EmailStatusBadge({
  status,
  showValid = false,
  className = "",
}: {
  status?: string | null;
  /** Show the green "Valid" pill too. Off by default to keep lists quiet. */
  showValid?: boolean;
  className?: string;
}) {
  if (!status || status === "unverified") return null;
  if (status === "valid" && !showValid) return null;
  const m = MAP[status];
  if (!m) return null;
  const Icon = m.Icon;
  return (
    <span
      title={m.title}
      data-testid={`email-status-${status}`}
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-4 ${m.cls} ${className}`}
    >
      <Icon className="size-3" /> {m.label}
    </span>
  );
}
