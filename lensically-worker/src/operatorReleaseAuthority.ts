export const OPERATOR_RELEASE_AUTHORITY_ID = "production";

export const OPERATOR_RELEASE_CONTROL_TOOLS = new Set<string>([
  "getOperatorStartupContext",
  "getEngineeringContinuation",
  "engineeringPrecheck",
  "getEngineeringAccessState",
  "getRepoStatus",
  "listRepoFiles",
  "searchRepoFiles",
  "readRepoFile",
  "applyRepoTextPatch",
  "applyRepoPatchSet",
  "startRepoFileWrite",
  "appendRepoFileChunk",
  "commitRepoFileWrite",
  "createRepoFile",
  "deleteRepoFile",
  "listGitHubWorkflowRuns",
  "runGitHubWorkflow",
  "getGitHubWorkflowRun",
  "verifyDeployedMcpVersion",
  "listEngineeringAudit",
]);

export type OperatorReleaseAuthorityRow = {
  authority_id: string;
  expected_release_sha: string;
  previous_release_sha: string | null;
  release_id: string | null;
  state: string;
  source: string;
  updated_at: string;
};

function normalizeReleaseSha(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-f0-9]{40}$/.test(normalized) ? normalized : null;
}

export function evaluateOperatorReleaseAuthority(input: {
  toolName: string;
  executingSha: unknown;
  authority: OperatorReleaseAuthorityRow | null;
}): {
  allowed: boolean;
  error: "stale_operator_runtime_release" | null;
  executing_release_sha: string | null;
  expected_release_sha: string | null;
  release_authority_state: string | null;
  release_control_exempt: boolean;
} {
  const executing = normalizeReleaseSha(input.executingSha);
  const expected = normalizeReleaseSha(input.authority?.expected_release_sha);
  const exempt = OPERATOR_RELEASE_CONTROL_TOOLS.has(input.toolName);
  const allowed = exempt || !expected || executing === expected;
  return {
    allowed,
    error: allowed ? null : "stale_operator_runtime_release",
    executing_release_sha: executing,
    expected_release_sha: expected,
    release_authority_state: input.authority?.state ?? null,
    release_control_exempt: exempt,
  };
}

export async function readOperatorReleaseAuthority(db: D1Database): Promise<OperatorReleaseAuthorityRow | null> {
  try {
    return await db.prepare(
      `SELECT authority_id, expected_release_sha, previous_release_sha, release_id, state, source, updated_at
       FROM operator_release_authority
       WHERE authority_id = ?
       LIMIT 1`,
    ).bind(OPERATOR_RELEASE_AUTHORITY_ID).first<OperatorReleaseAuthorityRow>();
  } catch (error) {
    if (/no such table:\s*operator_release_authority/i.test(error instanceof Error ? error.message : String(error))) return null;
    throw error;
  }
}

export async function publishOperatorReleaseTarget(
  db: D1Database,
  input: { releaseSha: string; currentSha: unknown; releaseId?: string | null },
): Promise<OperatorReleaseAuthorityRow | null> {
  const releaseSha = normalizeReleaseSha(input.releaseSha);
  if (!releaseSha) throw new Error("invalid_operator_release_sha");
  const existing = await readOperatorReleaseAuthority(db);
  const currentSha = normalizeReleaseSha(input.currentSha);
  await db.prepare(
    `INSERT INTO operator_release_authority (
       authority_id, expected_release_sha, previous_release_sha, release_id, state, source, updated_at
     ) VALUES (?, ?, ?, ?, 'pending', 'worker_deploy_dispatch', CURRENT_TIMESTAMP)
     ON CONFLICT(authority_id) DO UPDATE SET
       previous_release_sha = operator_release_authority.expected_release_sha,
       expected_release_sha = excluded.expected_release_sha,
       release_id = excluded.release_id,
       state = 'pending',
       source = 'worker_deploy_dispatch',
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    OPERATOR_RELEASE_AUTHORITY_ID,
    releaseSha,
    existing?.expected_release_sha ?? currentSha,
    input.releaseId ?? null,
  ).run();
  return existing;
}

export async function restoreOperatorReleaseAuthority(
  db: D1Database,
  previous: OperatorReleaseAuthorityRow | null,
): Promise<void> {
  if (!previous) {
    await db.prepare(`DELETE FROM operator_release_authority WHERE authority_id = ?`).bind(OPERATOR_RELEASE_AUTHORITY_ID).run();
    return;
  }
  await db.prepare(
    `INSERT INTO operator_release_authority (
       authority_id, expected_release_sha, previous_release_sha, release_id, state, source, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(authority_id) DO UPDATE SET
       expected_release_sha = excluded.expected_release_sha,
       previous_release_sha = excluded.previous_release_sha,
       release_id = excluded.release_id,
       state = excluded.state,
       source = excluded.source,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(
    OPERATOR_RELEASE_AUTHORITY_ID,
    previous.expected_release_sha,
    previous.previous_release_sha,
    previous.release_id,
    previous.state,
    previous.source,
  ).run();
}

export async function activateOperatorReleaseAuthority(
  db: D1Database,
  releaseSha: unknown,
): Promise<void> {
  const normalized = normalizeReleaseSha(releaseSha);
  if (!normalized) return;
  const existing = await readOperatorReleaseAuthority(db);
  if (!existing) {
    await db.prepare(
      `INSERT INTO operator_release_authority (
         authority_id, expected_release_sha, previous_release_sha, release_id, state, source, updated_at
       ) VALUES (?, ?, NULL, NULL, 'active', 'live_verification_bootstrap', CURRENT_TIMESTAMP)`,
    ).bind(OPERATOR_RELEASE_AUTHORITY_ID, normalized).run();
    return;
  }
  if (normalizeReleaseSha(existing.expected_release_sha) !== normalized) return;
  await db.prepare(
    `UPDATE operator_release_authority
     SET state = 'active', source = 'live_verification', updated_at = CURRENT_TIMESTAMP
     WHERE authority_id = ? AND expected_release_sha = ?`,
  ).bind(OPERATOR_RELEASE_AUTHORITY_ID, normalized).run();
}
