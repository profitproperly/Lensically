import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src";
import { LOCAL_VALIDATION_RECEIPT_VERSION } from "../src/localExecution";

async function fetchFromWorker(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request(`https://example.com${path}`, init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function postJson<T>(path: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<T & { ok?: boolean; error?: string }> {
  const response = await fetchFromWorker(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const data = await response.json() as T & { ok?: boolean; error?: string };
  expect(response.status, `${path}: ${data.error ?? ""}`).toBeLessThan(400);
  return data;
}

async function resetLocalExecutionTables(): Promise<void> {
  (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
  await env.DB.prepare("DROP TABLE IF EXISTS users").run();
  await env.DB.prepare(
    `CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT,
      password_hash TEXT,
      email_verified INTEGER NOT NULL DEFAULT 1,
      threads_user_id TEXT,
      threads_username TEXT,
      access_token TEXT,
      token_expires_at INTEGER,
      is_admin INTEGER NOT NULL DEFAULT 0,
      connection_active INTEGER NOT NULL DEFAULT 1,
      timezone TEXT,
      clock_format TEXT,
      created_at INTEGER NOT NULL DEFAULT 0
    )`,
  ).run();
  await env.DB.prepare(
    `INSERT INTO users (id, email, is_admin, connection_active, created_at)
     VALUES ('workspace-owner', 'owner@example.test', 1, 1, 0)`,
  ).run();
  await env.DB.prepare("DROP TABLE IF EXISTS operator_local_execution_nodes").run();
  await env.DB.prepare("DROP TABLE IF EXISTS operator_local_execution_jobs").run();
  await env.DB.prepare("DROP TABLE IF EXISTS operator_local_validation_receipts").run();
  await env.DB.prepare("DROP TABLE IF EXISTS operator_validation_plane_events").run();
  await env.DB.prepare("DROP TABLE IF EXISTS operator_local_execution_enrollment_tokens").run();
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signedEnvelope(payload: Record<string, unknown>): Promise<string> {
  const encodedPayload = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-gpt-key"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${base64Url(new Uint8Array(signature))}`;
}

describe("local execution node integration", () => {
  beforeEach(async () => {
    await resetLocalExecutionTables();
  });

  it("enrolls one node, authenticates heartbeat/poll/result, and stores an actual local-validation receipt", async () => {
    const sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const nodeId = `vitest_node_${crypto.randomUUID().replace(/-/g, "_")}`;
    const credential = `credential.${crypto.randomUUID()}.${crypto.randomUUID()}`;

    await fetchFromWorker("/api/operator/local-node/enroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const enrollmentToken = `enroll.${crypto.randomUUID()}.${crypto.randomUUID()}`;
    await env.DB.prepare(
      `INSERT INTO operator_local_execution_enrollment_tokens (token_hash, node_id, display_name, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(await sha256Hex(enrollmentToken), nodeId, "Vitest local node", new Date().toISOString(), new Date(Date.now() + 300000).toISOString()).run();

    const enrolled = await postJson<{ credential_status: string }>("/api/operator/local-node/enroll", {
      node_id: nodeId,
      enrollment_token: enrollmentToken,
      device_credential: credential,
    });
    expect(enrolled).toMatchObject({ ok: true, credential_status: "active" });

    const reused = await fetchFromWorker("/api/operator/local-node/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, enrollment_token: enrollmentToken, device_credential: credential }),
    });
    expect(reused.status).toBe(409);

    const nodeHeaders = {
      "x-lensically-node-id": nodeId,
      "x-lensically-node-credential": credential,
    };
    const heartbeat = await postJson<{ heartbeat_at: string }>("/api/operator/local-node/heartbeat", {
      bootstrap_version: "lensically-local-bootstrap-v1",
      worker_version: "local-worker-v1",
      active_slot: "active",
      healthy: true,
    }, nodeHeaders);
    expect(heartbeat.ok).toBe(true);

    const jobId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(Date.now() + 600000).toISOString();
    const payload = {
      job_id: jobId,
      repo: "profitproperly/Lensically",
      commit_sha: sha,
      job_type: "validate_sha",
      inputs: { commit_sha: sha, node_id: nodeId },
      node_id: nodeId,
      created_at: now.toISOString(),
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
      max_runtime_ms: 120000,
      expected_stages: ["typecheck", "focused_tests"],
      authorization_level: "validate",
      attempt_count: 0,
      result_status: "pending",
      exp: Math.floor(Date.parse(expiresAt) / 1000),
    };
    const signature = await signedEnvelope(payload);
    await env.DB.prepare(
      `INSERT INTO operator_local_execution_jobs (
        job_id, repo, commit_sha, job_type, inputs_json, node_id, state, created_at, expires_at,
        nonce, max_runtime_ms, expected_stages_json, authorization_level, signature, attempt_count, result_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
    ).bind(
      jobId,
      payload.repo,
      sha,
      payload.job_type,
      JSON.stringify(payload.inputs),
      nodeId,
      payload.created_at,
      expiresAt,
      payload.nonce,
      payload.max_runtime_ms,
      JSON.stringify(payload.expected_stages),
      payload.authorization_level,
      signature,
    ).run();

    const poll = await postJson<{ job: Record<string, unknown> }>("/api/operator/local-node/poll", {}, nodeHeaders);
    expect(poll.job?.job_id).toBe(jobId);

    const verified = await postJson("/api/operator/local-node/verify-job", { job: poll.job }, nodeHeaders);
    expect(verified.ok).toBe(true);

    const receipt = {
      version: LOCAL_VALIDATION_RECEIPT_VERSION,
      repository_sha: sha,
      checked_out_sha: sha,
      validated_sha: sha,
      release_candidate_sha: sha,
      node_id: nodeId,
      worker_version: "local-worker-v1",
      bootstrap_version: "lensically-local-bootstrap-v1",
      validation_profile: "focused",
      stages: [{ name: "integration", status: "passed", duration_ms: 1 }],
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 1,
      environment: { os: "test", node: "test" },
      result_hashes: { integration: "h1" },
      integrity: { algorithm: "server-hmac-sha256", signature: "integration-signature" },
    };

    const result = await postJson<{ receipt_id: string; validation: { ok: boolean } }>("/api/operator/local-node/result", {
      job_id: poll.job.job_id,
      status: "completed",
      receipt,
    }, nodeHeaders);
    expect(result.validation.ok).toBe(true);

    const stored = await env.DB.prepare(
      "SELECT receipt_json, ok FROM operator_local_validation_receipts WHERE receipt_id = ?",
    ).bind(result.receipt_id).first<{ receipt_json: string; ok: number }>();
    expect(stored?.ok).toBe(1);
    expect(JSON.parse(stored?.receipt_json ?? "{}")).toMatchObject({
      version: LOCAL_VALIDATION_RECEIPT_VERSION,
      repository_sha: sha,
      checked_out_sha: sha,
      validated_sha: sha,
      release_candidate_sha: sha,
      node_id: nodeId,
    });
  });
});
