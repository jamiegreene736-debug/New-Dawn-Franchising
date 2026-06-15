/** Ordered pipeline stages for CRM profile email/SMS/WhatsApp templates. */
export const CRM_TEMPLATE_GROUPS = [
  "1 — Pitch the Broker",
  "2 — Pitch the Investor",
  "3 — FDD & Receipt",
  "4 — Close the Deal",
  "5 — Follow-Up",
] as const;

export type CrmTemplateGroup = (typeof CRM_TEMPLATE_GROUPS)[number];