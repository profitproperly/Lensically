export const HUMAN_FREE_AUTONOMY_POLICY_VERSION = "human-free-autonomy-v1";

export const HUMAN_LEARNING_DISABLED = true as const;

export const LENSICALLY_NATIVE_RECOVERY_POLICY_VERSION = "lensically-native-recovery-v1";

export type LensicallyRecoveryCondition = "main_callable" | "main_unavailable" | "main_incapable";
export type LensicallyRecoveryPlane = "main_native" | "mcp_controller_break_glass";

export function resolveLensicallyRecoveryPlane(condition: LensicallyRecoveryCondition): LensicallyRecoveryPlane {
  return condition === "main_callable" ? "main_native" : "mcp_controller_break_glass";
}

export const LENSICALLY_NATIVE_RECOVERY_CONTRACT = Object.freeze({
  version: LENSICALLY_NATIVE_RECOVERY_POLICY_VERSION,
  default_plane: "main_native" as const,
  escalation_plane: "mcp_controller_break_glass" as const,
  dedicated_recovery_connector: "retired" as const,
  controller_domain_business_logic: false as const,
  claims_client_predispatch_interception: false as const,
  infrastructure_repair_strategy: "source_exact_repair_or_redeploy" as const,
  rule: "Main owns diagnosis, bounded repair, regression, release verification, and return-to-normal recovery while callable. Escalate only when Main is unavailable or incapable; MCP Controller repairs fleet infrastructure and returns control to Main after exact verification.",
});

export function isHumanLearningApiRetired(): boolean {
  return HUMAN_LEARNING_DISABLED === true;
}


export const SCHEDULED_POST_DELETION_REASON_CODES = [
  "constitution_violation",
  "platform_safety",
  "exact_duplicate",
  "technical_corruption",
  "wrong_account_or_slot",
  "owner_emergency_withdrawal",
] as const;

export type ScheduledPostDeletionReasonCode = typeof SCHEDULED_POST_DELETION_REASON_CODES[number];

const SCHEDULED_POST_DELETION_REASON_CODE_SET = new Set<string>(SCHEDULED_POST_DELETION_REASON_CODES);

export function normalizeScheduledPostDeletionReasonCode(value: unknown): ScheduledPostDeletionReasonCode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return SCHEDULED_POST_DELETION_REASON_CODE_SET.has(normalized)
    ? normalized as ScheduledPostDeletionReasonCode
    : null;
}

export function buildScheduledPostDeletionReason(
  reasonCode: ScheduledPostDeletionReasonCode,
  detail?: unknown,
): string {
  const normalizedDetail = typeof detail === "string" ? detail.trim() : "";
  return normalizedDetail || reasonCode.replace(/_/g, " ");
}

export const HUMAN_FREE_AUTONOMY_CONTRACT = Object.freeze({
  version: HUMAN_FREE_AUTONOMY_POLICY_VERSION,
  learning_inputs: [
    "published market performance",
    "mature metric snapshots",
    "source-family evidence",
    "recent and future exposure",
    "semantic repetition evidence",
    "experiment outcomes",
    "scheduler and delivery evidence",
  ],
  prohibited_learning_inputs: [
    "owner approvals",
    "owner rejections",
    "owner edits",
    "owner taste feedback",
    "guided-review history",
    "scheduled-post deletion history",
  ],
  deletion_policy: {
    learning_effect: "unobserved",
    allowed_reason_codes: SCHEDULED_POST_DELETION_REASON_CODES,
    selection_effect: "none",
    family_label_effect: "none",
    strategy_effect: "none",
  },
});
