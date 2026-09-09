export const MOBILE_MIGRATION_TABLES = [
  "mobile_audit_events",
  "mobile_deletion_requests",
  "mobile_identities",
  "mobile_identity_roles",
  "mobile_investor_links",
  "mobile_one_time_tokens",
  "mobile_notification_preferences",
  "mobile_notification_reminders",
  "mobile_notifications",
  "mobile_partner_profiles",
  "mobile_pathway_events",
  "mobile_pathway_instances",
  "mobile_pathway_milestones",
  "mobile_referral_matches",
  "mobile_referrals",
  "mobile_refresh_sessions",
  "mobile_push_devices",
] as const;

export const MOBILE_MIGRATION_ENUMS = [
  "mobile_deletion_status",
  "mobile_identity_status",
  "mobile_one_time_token_purpose",
  "mobile_notification_category",
  "mobile_notification_platform",
  "mobile_notification_urgency",
  "mobile_partner_status",
  "mobile_pathway_milestone_state",
  "mobile_pathway_owner",
  "mobile_referral_status",
  "mobile_review_status",
  "mobile_role",
  "mobile_role_status",
  "mobile_reminder_kind",
] as const;

export const MOBILE_MIGRATION_PREREQUISITE_TABLES = ["crm_clients"] as const;
