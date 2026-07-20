export const LOCAL_EXECUTION_VERSION = "local-execution-node-v1";
export const LOCAL_VALIDATION_RECEIPT_VERSION = "local-validation-receipt-v1";
export const LOCAL_EXECUTION_BOOTSTRAP_VERSION = "lensically-local-bootstrap-v1";

export const LOCAL_EXECUTION_JOB_STATES = [
  "pending",
  "claimed",
  "running",
  "completed",
  "failed",
  "expired",
  "cancelled",
] as const;

export type LocalExecutionJobState = typeof LOCAL_EXECUTION_JOB_STATES[number];

export const LOCAL_EXECUTION_JOB_TYPES = [
  "node_status",
  "validate_sha",
  "run_typecheck",
  "run_focused_tests",
  "run_full_validation",
  "build_worker",
  "deploy_validated_sha",
  "collect_diagnostics",
  "update_worker",
  "cancel_job",
] as const;

export type LocalExecutionJobType = typeof LOCAL_EXECUTION_JOB_TYPES[number];

export type LocalExecutionPlane = "local_node" | "cloudflare_builds" | "github_actions";
export type ValidationFailureClass = "code_failure" | "local_infrastructure_failure" | "hosted_infrastructure_failure";

export type LocalExecutionNodeStatus = {
  node_id: string;
  healthy: boolean;
  heartbeat_at: string | null;
  worker_version: string | null;
  bootstrap_version: string | null;
  active_slot: "active" | "previous" | null;
  previous_worker_version?: string | null;
};

export type LocalExecutionJob = {
  job_id: string;
  repo: string;
  commit_sha: string;
  job_type: LocalExecutionJobType;
  inputs: Record<string, unknown>;
  node_id: string;
  created_at: string;
  expires_at: string;
  nonce: string;
  max_runtime_ms: number;
  expected_stages: string[];
  authorization_level: "read" | "validate" | "deploy" | "update" | "bootstrap_update";
  signature: string;
  attempt_count: number;
  result_status: LocalExecutionJobState;
};

export type LocalValidationReceipt = {
  version: typeof LOCAL_VALIDATION_RECEIPT_VERSION;
  repository_sha: string;
  checked_out_sha: string;
  validated_sha: string;
  release_candidate_sha: string;
  node_id: string;
  worker_version: string;
  bootstrap_version: string;
  validation_profile: string;
  stages: Array<{ name: string; status: "passed" | "failed" | "skipped"; duration_ms: number; output_hash?: string }>;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  environment: Record<string, string>;
  result_hashes: Record<string, string>;
  integrity: { algorithm: "server-hmac-sha256"; signature: string };
};

export type ValidationPlanePolicy = {
  urgent?: boolean;
  require_independent_third_plane?: boolean;
  queue_when_local_offline?: boolean;
  cloudflare_quota_reserved?: boolean;
  github_quota_reserved?: boolean;
};

const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,160}$/;

export function isExactSha(value: unknown): value is string {
  return typeof value === "string" && SHA_PATTERN.test(value);
}

export function normalizeLocalExecutionJobType(value: unknown): LocalExecutionJobType | null {
  return LOCAL_EXECUTION_JOB_TYPES.includes(value as LocalExecutionJobType) ? value as LocalExecutionJobType : null;
}

export function validateLocalExecutionJob(job: LocalExecutionJob, now = new Date()): { ok: true } | { ok: false; error: string } {
  if (!SAFE_ID_PATTERN.test(job.job_id)) return { ok: false, error: "invalid_job_id" };
  if (!SAFE_ID_PATTERN.test(job.node_id)) return { ok: false, error: "invalid_node_id" };
  if (!isExactSha(job.commit_sha)) return { ok: false, error: "exact_commit_sha_required" };
  if (!normalizeLocalExecutionJobType(job.job_type)) return { ok: false, error: "unknown_job_type" };
  if (!job.nonce || !SAFE_ID_PATTERN.test(job.nonce)) return { ok: false, error: "invalid_nonce" };
  if (!job.signature || !SAFE_ID_PATTERN.test(job.signature)) return { ok: false, error: "invalid_signature" };
  if (Date.parse(job.expires_at) <= now.getTime()) return { ok: false, error: "expired_job" };
  if (!Number.isInteger(job.max_runtime_ms) || job.max_runtime_ms < 1 || job.max_runtime_ms > 6 * 60 * 60 * 1000) {
    return { ok: false, error: "invalid_max_runtime" };
  }
  if (job.job_type === "deploy_validated_sha" && job.authorization_level !== "deploy") {
    return { ok: false, error: "deploy_authorization_required" };
  }
  if (job.job_type === "update_worker" && job.authorization_level !== "update") {
    return { ok: false, error: "update_authorization_required" };
  }
  return { ok: true };
}

export function classifyValidationFailure(result: { exit_code?: number | null; error_kind?: string | null; stage?: string | null }): ValidationFailureClass {
  const errorKind = String(result.error_kind ?? "").toLowerCase();
  if (errorKind.includes("timeout") || errorKind.includes("node_offline") || errorKind.includes("lease") || errorKind.includes("worker_update")) {
    return "local_infrastructure_failure";
  }
  if (errorKind.includes("cloudflare") || errorKind.includes("github") || errorKind.includes("quota")) {
    return "hosted_infrastructure_failure";
  }
  return "code_failure";
}

export function selectValidationPlane(
  localNode: LocalExecutionNodeStatus | null,
  policy: ValidationPlanePolicy = {},
  now = new Date(),
): { plane: LocalExecutionPlane | "queue_local"; reason: string } {
  if (policy.require_independent_third_plane) return { plane: "github_actions", reason: "explicit_third_plane_required" };
  const heartbeatFresh = Boolean(localNode?.heartbeat_at && now.getTime() - Date.parse(localNode.heartbeat_at) <= 2 * 60 * 1000);
  if (localNode?.healthy && heartbeatFresh) return { plane: "local_node", reason: "local_node_healthy" };
  if (policy.queue_when_local_offline && !policy.urgent) return { plane: "queue_local", reason: "local_offline_queued_by_policy" };
  if (policy.cloudflare_quota_reserved !== false) return { plane: "cloudflare_builds", reason: "local_unavailable_hosted_fallback" };
  if (policy.github_quota_reserved !== false) return { plane: "github_actions", reason: "local_and_cloudflare_unavailable" };
  return { plane: "queue_local", reason: "hosted_quota_reserved" };
}

export function validateLocalValidationReceipt(receipt: LocalValidationReceipt, requestedSha: string): { ok: true } | { ok: false; error: string } {
  if (receipt.version !== LOCAL_VALIDATION_RECEIPT_VERSION) return { ok: false, error: "invalid_receipt_version" };
  if (!isExactSha(requestedSha)) return { ok: false, error: "requested_exact_sha_required" };
  if (
    receipt.repository_sha !== requestedSha
    || receipt.checked_out_sha !== requestedSha
    || receipt.validated_sha !== requestedSha
    || receipt.release_candidate_sha !== requestedSha
  ) {
    return { ok: false, error: "receipt_sha_mismatch" };
  }
  if (!receipt.node_id || !receipt.worker_version || !receipt.bootstrap_version) return { ok: false, error: "receipt_identity_missing" };
  if (!receipt.integrity?.signature) return { ok: false, error: "receipt_integrity_missing" };
  if (!receipt.stages.length || receipt.stages.some((stage) => stage.status !== "passed")) return { ok: false, error: "receipt_stage_failed" };
  return { ok: true };
}

export function validateWorkerUpdatePlan(plan: {
  candidate_sha: string;
  active_slot: "active" | "previous";
  inactive_slot: "active" | "previous";
  signing_authority_changed?: boolean;
  candidate_health_ok?: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!isExactSha(plan.candidate_sha)) return { ok: false, error: "candidate_exact_sha_required" };
  if (plan.active_slot === plan.inactive_slot) return { ok: false, error: "inactive_slot_required" };
  if (plan.signing_authority_changed) return { ok: false, error: "ordinary_worker_update_cannot_change_signing_authority" };
  if (plan.candidate_health_ok !== true) return { ok: false, error: "candidate_health_check_required" };
  return { ok: true };
}
