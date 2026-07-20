import { describe, expect, it } from "vitest";
import {
  LOCAL_VALIDATION_RECEIPT_VERSION,
  classifyValidationFailure,
  selectValidationPlane,
  validateLocalExecutionJob,
  validateLocalValidationReceipt,
  validateWorkerUpdatePlan,
  type LocalExecutionJob,
  type LocalValidationReceipt,
} from "../src/localExecution";

const sha = "38f4e6e0ff155812005214d761fc5dd3811b59b0";

function job(overrides: Partial<LocalExecutionJob> = {}): LocalExecutionJob {
  return {
    job_id: "job-1",
    repo: "profitproperly/Lensically",
    commit_sha: sha,
    job_type: "validate_sha",
    inputs: { scope: "focused" },
    node_id: "brian-win-node",
    created_at: "2026-07-20T00:00:00.000Z",
    expires_at: "2026-07-20T01:00:00.000Z",
    nonce: "nonce-1",
    max_runtime_ms: 600000,
    expected_stages: ["typecheck"],
    authorization_level: "validate",
    signature: "server.signature",
    attempt_count: 0,
    result_status: "pending",
    ...overrides,
  };
}

function receipt(overrides: Partial<LocalValidationReceipt> = {}): LocalValidationReceipt {
  return {
    version: LOCAL_VALIDATION_RECEIPT_VERSION,
    repository_sha: sha,
    checked_out_sha: sha,
    validated_sha: sha,
    release_candidate_sha: sha,
    node_id: "brian-win-node",
    worker_version: "local-worker-v1",
    bootstrap_version: "lensically-local-bootstrap-v1",
    validation_profile: "full",
    stages: [{ name: "typecheck", status: "passed", duration_ms: 100, output_hash: "h1" }],
    started_at: "2026-07-20T00:00:00.000Z",
    completed_at: "2026-07-20T00:01:00.000Z",
    duration_ms: 60000,
    environment: { os: "win32", node: "v22" },
    result_hashes: { logs: "h1" },
    integrity: { algorithm: "server-hmac-sha256", signature: "receipt-signature" },
    ...overrides,
  };
}

describe("Lensically local execution node primitives", () => {
  it("rejects arbitrary commands, unknown job types, bad signatures, expired jobs, and branch-only SHAs", () => {
    expect(validateLocalExecutionJob(job({ job_type: "shell" as never }))).toEqual({ ok: false, error: "unknown_job_type" });
    expect(validateLocalExecutionJob(job({ commit_sha: "main" }))).toEqual({ ok: false, error: "exact_commit_sha_required" });
    expect(validateLocalExecutionJob(job({ signature: "" }))).toEqual({ ok: false, error: "invalid_signature" });
    expect(validateLocalExecutionJob(job({ expires_at: "2026-07-19T23:59:59.000Z" }), new Date("2026-07-20T00:00:00.000Z"))).toEqual({
      ok: false,
      error: "expired_job",
    });
  });

  it("requires stronger authorization for deployment and worker update jobs", () => {
    const now = new Date("2026-07-20T00:00:00.000Z");
    expect(validateLocalExecutionJob(job({ job_type: "deploy_validated_sha", authorization_level: "validate" }), now)).toEqual({
      ok: false,
      error: "deploy_authorization_required",
    });
    expect(validateLocalExecutionJob(job({ job_type: "update_worker", authorization_level: "validate" }), now)).toEqual({
      ok: false,
      error: "update_authorization_required",
    });
    expect(validateLocalExecutionJob(job({ job_type: "deploy_validated_sha", authorization_level: "deploy" }), now)).toEqual({ ok: true });
  });

  it("routes to local first, queues or conserves hosted fallbacks when offline, and uses GitHub only by policy", () => {
    expect(selectValidationPlane({
      node_id: "brian-win-node",
      healthy: true,
      heartbeat_at: "2026-07-20T00:00:30.000Z",
      worker_version: "local-worker-v1",
      bootstrap_version: "lensically-local-bootstrap-v1",
      active_slot: "active",
    }, {}, new Date("2026-07-20T00:01:00.000Z"))).toEqual({ plane: "local_node", reason: "local_node_healthy" });

    expect(selectValidationPlane(null, { queue_when_local_offline: true }, new Date("2026-07-20T00:01:00.000Z"))).toEqual({
      plane: "queue_local",
      reason: "local_offline_queued_by_policy",
    });
    expect(selectValidationPlane(null, { urgent: true }, new Date("2026-07-20T00:01:00.000Z"))).toEqual({
      plane: "cloudflare_builds",
      reason: "local_unavailable_hosted_fallback",
    });
    expect(selectValidationPlane(null, { require_independent_third_plane: true }, new Date("2026-07-20T00:01:00.000Z"))).toEqual({
      plane: "github_actions",
      reason: "explicit_third_plane_required",
    });
  });

  it("classifies code failures separately from infrastructure failures so hosted fallback cannot hide test failures", () => {
    expect(classifyValidationFailure({ exit_code: 1, stage: "typecheck" })).toBe("code_failure");
    expect(classifyValidationFailure({ error_kind: "node_offline" })).toBe("local_infrastructure_failure");
    expect(classifyValidationFailure({ error_kind: "cloudflare_quota" })).toBe("hosted_infrastructure_failure");
  });

  it("requires exact-SHA validation receipts and rejects mismatched deployments", () => {
    expect(validateLocalValidationReceipt(receipt(), sha)).toEqual({ ok: true });
    expect(validateLocalValidationReceipt(receipt({ validated_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }), sha)).toEqual({
      ok: false,
      error: "receipt_sha_mismatch",
    });
    expect(validateLocalValidationReceipt(receipt({ stages: [{ name: "typecheck", status: "failed", duration_ms: 10 }] }), sha)).toEqual({
      ok: false,
      error: "receipt_stage_failed",
    });
  });

  it("requires worker updates to install into the inactive slot and pass health without weakening signing authority", () => {
    expect(validateWorkerUpdatePlan({
      candidate_sha: sha,
      active_slot: "active",
      inactive_slot: "previous",
      candidate_health_ok: true,
    })).toEqual({ ok: true });
    expect(validateWorkerUpdatePlan({
      candidate_sha: sha,
      active_slot: "active",
      inactive_slot: "active",
      candidate_health_ok: true,
    })).toEqual({ ok: false, error: "inactive_slot_required" });
    expect(validateWorkerUpdatePlan({
      candidate_sha: sha,
      active_slot: "active",
      inactive_slot: "previous",
      signing_authority_changed: true,
      candidate_health_ok: true,
    })).toEqual({ ok: false, error: "ordinary_worker_update_cannot_change_signing_authority" });
    expect(validateWorkerUpdatePlan({
      candidate_sha: sha,
      active_slot: "active",
      inactive_slot: "previous",
      candidate_health_ok: false,
    })).toEqual({ ok: false, error: "candidate_health_check_required" });
  });
});
