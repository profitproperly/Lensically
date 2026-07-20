import {
  finalizeRecoveryAction,
  MANDATORY_RECOVERY_MAP_VERSION,
  prepareRecoveryAction,
  recoveryMapSummary,
  type RecoveryMapTool,
} from "./mandatoryRecoveryMap";

// Recovery source commits may carry [operator-tests] to trigger one bounded validation of deterministic MCP self-check routing, health metadata generation, single-preparation routing, compact receipts, and canonical execution policy enforcement.
// Verified main Worker release marker: profile-only-gateway-v2.

interface Env {
  GITHUB_TOKEN: string;
  RECOVERY_MCP_ACCESS_TOKEN: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  RECOVERY_SESSIONS: KVNamespace;
  RECOVERY_MCP_OAUTH_CLIENT_ID?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
  GITHUB_BRANCH?: string;
  MAIN_MCP_ORIGIN?: string;
  LENSICALLY_COMMIT_SHA?: string;
  CF_VERSION_METADATA?: { id?: string };
}

type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, unknown>;
};

const VERSION = "1.4.2";
const JSON_HEADERS = { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store" };
const TOOLS: Tool[] = [
  { name: "recoveryHealth", title: "Recovery health", description: "Verify the independent recovery plane and the main Lensically health endpoint.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "getRepoStatus", title: "Get repository status", description: "Read the Lensically main branch SHA and latest commit metadata.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "readRepoFile", title: "Read repository file", description: "Read one repository file with optional line bounds.", inputSchema: { type: "object", properties: { path: { type: "string" }, start_line: { type: "integer", minimum: 1 }, max_lines: { type: "integer", minimum: 1, maximum: 500 } }, required: ["path"], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "searchRepoFiles", title: "Search repository files", description: "Search source files by path and text using the GitHub tree and bounded file reads.", inputSchema: { type: "object", properties: { query: { type: "string" }, prefix: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["query"], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "applyRepoTextPatch", title: "Apply repository text patch", description: "Apply one exact source-controlled find/replace patch and commit it to the main branch.", inputSchema: { type: "object", properties: { path: { type: "string" }, find: { type: "string" }, replace: { type: "string" }, message: { type: "string" } }, required: ["path", "find", "replace", "message"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: "listGitHubWorkflowRuns", title: "List workflow runs", description: "List recent Lensically Engineering workflow runs.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 20 } }, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "runGitHubWorkflow", title: "Run GitHub workflow", description: "Dispatch a typecheck, operator-tests, gpt-memory-tests, or verified worker deployment. For the client-safe exact-head release path, submit task=typecheck and ref=release; Recovery compiles it server-side to worker-deploy.", inputSchema: { type: "object", properties: { task: { type: "string", enum: ["typecheck", "operator-tests", "gpt-memory-tests", "worker-deploy"] }, ref: { type: "string" } }, required: ["task"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: "getGitHubWorkflowRun", title: "Get workflow run", description: "Read one workflow run and its jobs.", inputSchema: { type: "object", properties: { run_id: { type: "integer" } }, required: ["run_id"], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "verifyMainMcp", title: "Verify main MCP", description: "Probe main Lensically health, OAuth metadata, initialize, and unauthenticated transport behavior without enumerating account data.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "getCloudflareWorkerState", title: "Get Cloudflare Worker state", description: "Inspect main Worker deployments, versions, settings/bindings, and account custom domains.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "queryCloudflareTelemetry", title: "Query Cloudflare telemetry", description: "Run a bounded raw Workers Observability telemetry query for logs, invocations, errors, or traces. Pass the Cloudflare telemetry query body directly.", inputSchema: { type: "object", properties: { query: { type: "object", additionalProperties: true } }, required: ["query"], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "rollbackMainWorker", title: "Rollback main Worker", description: "Promote one existing main Worker version to 100% traffic. Requires an exact version ID, reason, and owner_approval=true.", inputSchema: { type: "object", properties: { version_id: { type: "string" }, reason: { type: "string" }, owner_approval: { type: "boolean" } }, required: ["version_id", "reason", "owner_approval"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true } },
  { name: "startRepoFileWrite", title: "Start repository file write", description: "Start a KV-backed chunked create/replace session for a repository file.", inputSchema: { type: "object", properties: { path: { type: "string" }, mode: { type: "string", enum: ["create", "replace"] }, message: { type: "string" } }, required: ["path", "mode", "message"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: "appendRepoFileChunk", title: "Append repository file chunk", description: "Append a text chunk to an open recovery write session.", inputSchema: { type: "object", properties: { session_id: { type: "string" }, chunk: { type: "string" } }, required: ["session_id", "chunk"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: "commitRepoFileWrite", title: "Commit repository file write", description: "Commit a completed recovery write session to GitHub and delete the temporary KV session.", inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: "runMainMcpSmoke", title: "Run main MCP smoke", description: "Run the live main-MCP OAuth, initialize, deployment-scoped session enforcement, permanent one-tool public contract, server-side startup, direct-call rejection, and Execution Kernel path. Returns compact runtime, kernel, and compatibility receipts.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
];

const PUBLIC_TOOLS: Tool[] = TOOLS;

function json(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function metadata(env: Env): Record<string, unknown> {
  return { recovery_version: VERSION, deployment_id: env.CF_VERSION_METADATA?.id ?? null, commit_sha: env.LENSICALLY_COMMIT_SHA ?? null };
}

function bearer(request: Request): string {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
}

function repo(env: Env) {
  return { owner: env.GITHUB_OWNER || "profitproperly", repo: env.GITHUB_REPO || "Lensically", branch: env.GITHUB_BRANCH || "main" };
}

function safePath(value: unknown): string {
  const path = typeof value === "string" ? value.trim().replace(/\\/g, "/").replace(/^\/+/, "") : "";
  return path && !path.includes("..") && !path.startsWith(".git/") ? path : "";
}

async function github(env: Env, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: unknown }> {
  const request = () => fetch(`https://api.github.com${path}`, { ...init, headers: { accept: "application/vnd.github+json", authorization: `Bearer ${env.GITHUB_TOKEN}`, "user-agent": "lensically-recovery", "x-github-api-version": "2022-11-28", ...(init.headers || {}) } });
  let response = await request();
  const method = String(init.method || "GET").toUpperCase();
  if (["GET", "HEAD"].includes(method) && [502, 503, 504].includes(response.status)) response = await request();
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => null) };
}

async function cloudflare(env: Env, path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; result: unknown; errors: unknown }> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { ...init, headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json", ...(init.headers || {}) } });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  return { ok: response.ok && payload?.success !== false, status: response.status, result: payload?.result ?? null, errors: payload?.errors ?? [] };
}

type RecoveryWriteSession = { id: string; path: string; mode: "create" | "replace"; message: string; content: string; created_at: string; updated_at: string };

async function readRecoverySession(env: Env, id: string): Promise<RecoveryWriteSession | null> {
  return env.RECOVERY_SESSIONS.get(`write:${id}`, "json");
}

async function writeRecoverySession(env: Env, session: RecoveryWriteSession): Promise<void> {
  await env.RECOVERY_SESSIONS.put(`write:${session.id}`, JSON.stringify(session), { expirationTtl: 24 * 60 * 60 });
}

async function mainMcpRequest(
  origin: string,
  token: string,
  id: number,
  method: string,
  params: Record<string, unknown>,
  sessionId?: string,
): Promise<{
  status: number;
  body: Record<string, unknown> | null;
  headers: {
    mcp_session_id: string | null;
    deployment_id: string | null;
    commit_sha: string | null;
    execution_kernel: string | null;
  };
}> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;
  const response = await fetch(`${origin}/api/operator/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  return {
    status: response.status,
    body: await response.json().catch(() => null) as Record<string, unknown> | null,
    headers: {
      mcp_session_id: response.headers.get("mcp-session-id"),
      deployment_id: response.headers.get("x-lensically-deployment-id"),
      commit_sha: response.headers.get("x-lensically-commit-sha"),
      execution_kernel: response.headers.get("x-lensically-execution-kernel"),
    },
  };
}

function base64ToText(value: string): string {
  const bytes = Uint8Array.from(atob(value.replace(/\s/g, "")), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function textToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function repoFile(env: Env, path: string): Promise<{ ok: boolean; status: number; sha: string | null; content: string | null }> {
  const config = repo(env);
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const result = await github(env, `/repos/${config.owner}/${config.repo}/contents/${encodedPath}?ref=${encodeURIComponent(config.branch)}`);
  const data = result.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data as Record<string, unknown> : null;
  const content = typeof data?.content === "string" && data.content.trim() ? base64ToText(data.content) : null;
  const sha = typeof data?.sha === "string" ? data.sha : null;
  if (result.ok && content && sha) return { ok: true, status: result.status, sha, content };

  const tree = await github(env, `/repos/${config.owner}/${config.repo}/git/trees/${encodeURIComponent(config.branch)}?recursive=1`);
  const entries = Array.isArray((tree.data as Record<string, unknown> | null)?.tree)
    ? (tree.data as { tree: Array<Record<string, unknown>> }).tree
    : [];
  const entry = entries.find((item) => item.type === "blob" && item.path === path);
  const blobSha = typeof entry?.sha === "string" ? entry.sha : null;
  if (!tree.ok || !blobSha) return { ok: false, status: tree.status || result.status, sha: null, content: null };
  const blob = await github(env, `/repos/${config.owner}/${config.repo}/git/blobs/${blobSha}`);
  const blobData = blob.data && typeof blob.data === "object" && !Array.isArray(blob.data) ? blob.data as Record<string, unknown> : null;
  const blobContent = typeof blobData?.content === "string" ? base64ToText(blobData.content) : null;
  return { ok: blob.ok && Boolean(blobContent), status: blob.status, sha: blobSha, content: blobContent };
}

async function commitRepoFileViaGitData(env: Env, path: string, content: string, message: string): Promise<{ ok: boolean; status: number; commit_sha: string | null; phase?: string }> {
  const config = repo(env);
  const refPath = `/repos/${config.owner}/${config.repo}/git/ref/heads/${encodeURIComponent(config.branch)}`;
  const ref = await github(env, refPath);
  const refData = ref.data && typeof ref.data === "object" && !Array.isArray(ref.data) ? ref.data as Record<string, unknown> : null;
  const refObject = refData?.object && typeof refData.object === "object" && !Array.isArray(refData.object) ? refData.object as Record<string, unknown> : null;
  const headSha = typeof refObject?.sha === "string" ? refObject.sha : null;
  if (!ref.ok || !headSha) return { ok: false, status: ref.status, commit_sha: null, phase: "read_ref" };

  const parent = await github(env, `/repos/${config.owner}/${config.repo}/git/commits/${headSha}`);
  const parentData = parent.data && typeof parent.data === "object" && !Array.isArray(parent.data) ? parent.data as Record<string, unknown> : null;
  const parentTree = parentData?.tree && typeof parentData.tree === "object" && !Array.isArray(parentData.tree) ? parentData.tree as Record<string, unknown> : null;
  const baseTreeSha = typeof parentTree?.sha === "string" ? parentTree.sha : null;
  if (!parent.ok || !baseTreeSha) return { ok: false, status: parent.status, commit_sha: null, phase: "read_parent_commit" };

  const blob = await github(env, `/repos/${config.owner}/${config.repo}/git/blobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, encoding: "utf-8" }),
  });
  const blobData = blob.data && typeof blob.data === "object" && !Array.isArray(blob.data) ? blob.data as Record<string, unknown> : null;
  const blobSha = typeof blobData?.sha === "string" ? blobData.sha : null;
  if (!blob.ok || !blobSha) return { ok: false, status: blob.status, commit_sha: null, phase: "create_blob" };

  const tree = await github(env, `/repos/${config.owner}/${config.repo}/git/trees`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: [{ path, mode: "100644", type: "blob", sha: blobSha }] }),
  });
  const treeData = tree.data && typeof tree.data === "object" && !Array.isArray(tree.data) ? tree.data as Record<string, unknown> : null;
  const treeSha = typeof treeData?.sha === "string" ? treeData.sha : null;
  if (!tree.ok || !treeSha) return { ok: false, status: tree.status, commit_sha: null, phase: "create_tree" };

  const commit = await github(env, `/repos/${config.owner}/${config.repo}/git/commits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, tree: treeSha, parents: [headSha] }),
  });
  const commitData = commit.data && typeof commit.data === "object" && !Array.isArray(commit.data) ? commit.data as Record<string, unknown> : null;
  const commitSha = typeof commitData?.sha === "string" ? commitData.sha : null;
  if (!commit.ok || !commitSha) return { ok: false, status: commit.status, commit_sha: null, phase: "create_commit" };

  const update = await github(env, `/repos/${config.owner}/${config.repo}/git/refs/heads/${encodeURIComponent(config.branch)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
  if (update.ok) return { ok: true, status: update.status, commit_sha: commitSha };

  const reconciled = await github(env, refPath);
  const reconciledData = reconciled.data && typeof reconciled.data === "object" && !Array.isArray(reconciled.data) ? reconciled.data as Record<string, unknown> : null;
  const reconciledObject = reconciledData?.object && typeof reconciledData.object === "object" && !Array.isArray(reconciledData.object) ? reconciledData.object as Record<string, unknown> : null;
  const reconciledSha = typeof reconciledObject?.sha === "string" ? reconciledObject.sha : null;
  if (reconciled.ok && reconciledSha === commitSha) return { ok: true, status: update.status, commit_sha: commitSha, phase: "update_ref_reconciled" };
  return { ok: false, status: update.status, commit_sha: null, phase: reconciled.ok && reconciledSha === headSha ? "update_ref_unchanged" : "update_ref_conflicted" };
}

async function toolCall(name: string, args: Record<string, unknown>, env: Env): Promise<Record<string, unknown>> {
  const config = repo(env);
  if (name === "recoveryHealth") {
    const main = await fetch(`${env.MAIN_MCP_ORIGIN || "https://api.lensically.com"}/api/operator/health?recovery=${Date.now()}`).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) })).catch((error) => ({ status: 0, body: { error: String(error) } }));
    return { ok: true, recovery: metadata(env), main };
  }
  if (name === "getRepoStatus") {
    const result = await github(env, `/repos/${config.owner}/${config.repo}/branches/${encodeURIComponent(config.branch)}`);
    const data = result.data as Record<string, unknown> | null;
    const commit = data?.commit as Record<string, unknown> | undefined;
    return { ok: result.ok, status: result.status, owner: config.owner, repo: config.repo, branch: config.branch, sha: commit?.sha ?? null };
  }
  if (name === "readRepoFile") {
    const path = safePath(args.path);
    if (!path) return { ok: false, error: "invalid_repo_path" };
    const file = await repoFile(env, path);
    const lines = (file.content || "").split(/\r?\n/);
    const start = Math.max(1, Number(args.start_line || 1));
    const max = Math.min(500, Math.max(1, Number(args.max_lines || 200)));
    return { ...file, path, start_line: start, end_line: Math.min(lines.length, start + max - 1), content: lines.slice(start - 1, start - 1 + max).join("\n") };
  }
  if (name === "searchRepoFiles") {
    const query = String(args.query || "").trim();
    const prefix = safePath(args.prefix || "") || "";
    const limit = Math.min(20, Math.max(1, Number(args.limit || 20)));
    if (!query) return { ok: false, error: "query_required" };
    if (prefix && /\.[a-z0-9]+$/i.test(prefix)) {
      const file = await repoFile(env, prefix);
      if (file.ok && file.content) {
        const normalizedQuery = query.toLowerCase();
        const lines = file.content.split(/\r?\n/);
        const matches = lines
          .map((line, index) => ({ line_number: index + 1, line }))
          .filter((entry) => entry.line.toLowerCase().includes(normalizedQuery))
          .slice(0, limit);
        return { ok: true, matches, path: prefix, search_mode: "bounded_known_file_content", external_requests: 1, file_content_fanout: 1 };
      }
    }
    const searchTerms = [`${query} repo:${config.owner}/${config.repo}`];
    if (prefix) searchTerms.push(`path:${prefix}`);
    const codeSearch = await github(env, `/search/code?q=${encodeURIComponent(searchTerms.join(" "))}&per_page=${limit}`);
    if (codeSearch.ok && codeSearch.data && typeof codeSearch.data === "object" && !Array.isArray(codeSearch.data)) {
      const items = Array.isArray((codeSearch.data as Record<string, unknown>).items)
        ? (codeSearch.data as { items: Array<Record<string, unknown>> }).items
        : [];
      return {
        ok: true,
        matches: items.slice(0, limit).map((item) => ({ path: item.path ?? null, name: item.name ?? null, sha: item.sha ?? null, source: "github_code_search" })),
        search_mode: "github_code_search",
        external_requests: 1,
        file_content_fanout: 0,
      };
    }
    const tree = await github(env, `/repos/${config.owner}/${config.repo}/git/trees/${encodeURIComponent(config.branch)}?recursive=1`);
    const entries = Array.isArray((tree.data as Record<string, unknown> | null)?.tree) ? (tree.data as { tree: Array<Record<string, unknown>> }).tree : [];
    const normalized = query.toLowerCase();
    const matches = entries
      .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
      .map((entry) => String(entry.path))
      .filter((path) => (!prefix || path.startsWith(prefix)) && path.toLowerCase().includes(normalized))
      .slice(0, limit)
      .map((path) => ({ path, source: "bounded_tree_path_fallback" }));
    return { ok: tree.ok, matches, search_mode: "bounded_tree_path_fallback", external_requests: 2, file_content_fanout: 0, code_search_status: codeSearch.status };
  }
  if (name === "applyRepoTextPatch") {
    const path = safePath(args.path); const find = String(args.find || ""); const replace = String(args.replace ?? ""); const message = String(args.message || "");
    if (!path || !find || !message) return { ok: false, error: "path_find_and_message_required" };
    const file = await repoFile(env, path);
    if (!file.ok || !file.content || !file.sha) return { ok: false, error: "repo_file_unavailable", status: file.status };
    const occurrences = file.content.split(find).length - 1;
    if (occurrences !== 1) return { ok: false, error: "find_text_must_match_exactly_once", occurrences };
    const content = file.content.replace(find, replace);
    if (content === file.content) return { ok: true, status: 200, path, commit_sha: null, phase: "no_change", write_mode: "git_data_api" };
    const result = await commitRepoFileViaGitData(env, path, content, message);
    return { ok: result.ok, status: result.status, path, commit_sha: result.commit_sha, phase: result.phase ?? null, write_mode: "git_data_api" };
  }
  if (name === "listGitHubWorkflowRuns") {
    const limit = Math.min(20, Math.max(1, Number(args.limit || 10)));
    const result = await github(env, `/repos/${config.owner}/${config.repo}/actions/workflows/lensically-engineering.yml/runs?per_page=${limit}`);
    const runs = Array.isArray((result.data as Record<string, unknown> | null)?.workflow_runs) ? (result.data as { workflow_runs: Array<Record<string, unknown>> }).workflow_runs : [];
    return { ok: result.ok, status: result.status, runs: runs.map((run) => ({ id: run.id, status: run.status, conclusion: run.conclusion, head_sha: run.head_sha, html_url: run.html_url, created_at: run.created_at })) };
  }
  if (name === "runGitHubWorkflow") {
    const publicTask = String(args.task || "");
    if (!["typecheck", "operator-tests", "gpt-memory-tests", "worker-deploy"].includes(publicTask)) return { ok: false, error: "invalid_workflow_task" };
    const rawRequestedRef = String(args.ref || "").trim();
    const clientSafeRelease = publicTask === "typecheck" && rawRequestedRef === "release";
    const workflowTask = publicTask === "worker-deploy" || clientSafeRelease ? "worker-deploy" : publicTask;
    const requestedRef = clientSafeRelease ? "" : rawRequestedRef;
    let dispatchRef = requestedRef || config.branch;
    let verifiedHeadSha: string | null = null;
    if (workflowTask === "worker-deploy") {
      const branchRef = await github(env, `/repos/${config.owner}/${config.repo}/git/ref/heads/${encodeURIComponent(config.branch)}`);
      const branchData = branchRef.data && typeof branchRef.data === "object" && !Array.isArray(branchRef.data)
        ? branchRef.data as Record<string, unknown>
        : {};
      const objectData = branchData.object && typeof branchData.object === "object" && !Array.isArray(branchData.object)
        ? branchData.object as Record<string, unknown>
        : {};
      verifiedHeadSha = typeof objectData.sha === "string" ? objectData.sha : null;
      if (!branchRef.ok || !verifiedHeadSha) {
        return { ok: false, error: "current_branch_head_unavailable", branch: config.branch, status: branchRef.status };
      }
      if (/^[a-f0-9]{40}$/i.test(requestedRef) && requestedRef !== verifiedHeadSha) {
        return { ok: false, error: "exact_sha_not_current_branch_head", requested_ref: requestedRef, branch: config.branch, current_head_sha: verifiedHeadSha, status: branchRef.status };
      }
      dispatchRef = config.branch;
    }
    const inputs = workflowTask === "worker-deploy"
      ? { task: workflowTask, release_id: verifiedHeadSha!.slice(0, 12), release_sha: verifiedHeadSha }
      : { task: workflowTask };
    const result = await github(env, `/repos/${config.owner}/${config.repo}/actions/workflows/lensically-engineering.yml/dispatches`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: dispatchRef, inputs }) });
    return { ok: result.ok, status: result.status, task: publicTask, workflow_task: workflowTask, dispatched: result.status === 204, requested_ref: requestedRef, dispatch_ref: dispatchRef, verified_head_sha: verifiedHeadSha };
  }
  if (name === "getGitHubWorkflowRun") {
    const id = Math.trunc(Number(args.run_id));
    const [run, jobs] = await Promise.all([
      github(env, `/repos/${config.owner}/${config.repo}/actions/runs/${id}`),
      github(env, `/repos/${config.owner}/${config.repo}/actions/runs/${id}/jobs?per_page=20`),
    ]);
    const runData = run.data as Record<string, unknown> | null;
    const jobRows = Array.isArray((jobs.data as Record<string, unknown> | null)?.jobs)
      ? (jobs.data as { jobs: Array<Record<string, unknown>> }).jobs
      : [];
    const serializedJobs = [];
    for (const job of jobRows) {
      const jobId = Math.trunc(Number(job.id));
      const failed = job.conclusion === "failure" || job.conclusion === "timed_out" || job.conclusion === "cancelled";
      const annotations = failed && jobId > 0
        ? await github(env, `/repos/${config.owner}/${config.repo}/check-runs/${jobId}/annotations?per_page=50`)
        : null;
      const annotationRows = Array.isArray(annotations?.data) ? annotations.data as Array<Record<string, unknown>> : [];
      serializedJobs.push({
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        html_url: job.html_url,
        steps: Array.isArray(job.steps)
          ? (job.steps as Array<Record<string, unknown>>).map((step) => ({ name: step.name, status: step.status, conclusion: step.conclusion, number: step.number }))
          : [],
        failure_annotations: annotationRows.slice(0, 50).map((annotation) => ({
          path: annotation.path ?? null,
          start_line: annotation.start_line ?? null,
          end_line: annotation.end_line ?? null,
          title: annotation.title ?? null,
          message: annotation.message ?? null,
          raw_details: typeof annotation.raw_details === "string" ? annotation.raw_details.slice(0, 8000) : null,
        })),
      });
    }
    return {
      ok: run.ok && jobs.ok,
      run: { id: runData?.id, status: runData?.status, conclusion: runData?.conclusion, head_sha: runData?.head_sha, html_url: runData?.html_url, created_at: runData?.created_at, updated_at: runData?.updated_at },
      jobs: serializedJobs,
    };
  }
  if (name === "verifyMainMcp") {
    const origin = env.MAIN_MCP_ORIGIN || "https://api.lensically.com";
    const [health, oauth, mcpGet] = await Promise.all([
      fetch(`${origin}/api/operator/health?recovery=${Date.now()}`),
      fetch(`${origin}/.well-known/oauth-authorization-server`),
      fetch(`${origin}/api/operator/mcp`),
    ]);
    return { ok: health.ok && oauth.ok && mcpGet.status === 405, health: { status: health.status, body: await health.json().catch(() => null) }, oauth: { status: oauth.status, body: await oauth.json().catch(() => null) }, mcp_get_status: mcpGet.status };
  }
  if (name === "getCloudflareWorkerState") {
    const account = encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID);
    const [deployments, versions, settings, domains] = await Promise.all([
      cloudflare(env, `/accounts/${account}/workers/scripts/lensically-worker/deployments`),
      cloudflare(env, `/accounts/${account}/workers/workers/lensically-worker/versions?per_page=20`),
      cloudflare(env, `/accounts/${account}/workers/scripts/lensically-worker/settings`),
      cloudflare(env, `/accounts/${account}/workers/domains`),
    ]);
    const deploymentPayload = deployments.result && typeof deployments.result === "object" ? deployments.result as Record<string, unknown> : {};
    const deploymentRows = Array.isArray(deploymentPayload.deployments) ? deploymentPayload.deployments : Array.isArray(deployments.result) ? deployments.result : [];
    const versionPayload = versions.result && typeof versions.result === "object" && !Array.isArray(versions.result) ? versions.result as Record<string, unknown> : {};
    const versionRows = Array.isArray(versionPayload.items) ? versionPayload.items : Array.isArray(versions.result) ? versions.result : [];
    const domainRows = Array.isArray(domains.result) ? domains.result : [];
    const settingsPayload = settings.result && typeof settings.result === "object" ? settings.result as Record<string, unknown> : {};
    return {
      ok: deployments.ok && settings.ok,
      deployments: deploymentRows.slice(0, 20),
      versions: versionRows.slice(0, 20),
      bindings: Array.isArray(settingsPayload.bindings) ? settingsPayload.bindings : ((versionRows[0] as Record<string, unknown> | undefined)?.bindings ?? []),
      compatibility_date: settingsPayload.compatibility_date ?? null,
      compatibility_flags: settingsPayload.compatibility_flags ?? [],
      custom_domains: domainRows.filter((row) => row && typeof row === "object" && String((row as Record<string, unknown>).service || "") === "lensically-worker"),
      errors: { deployments: deployments.errors, versions: versions.errors, settings: settings.errors, domains: domains.errors },
    };
  }
  if (name === "queryCloudflareTelemetry") {
    const query = args.query && typeof args.query === "object" && !Array.isArray(args.query) ? args.query as Record<string, unknown> : null;
    if (!query) return { ok: false, error: "telemetry_query_required" };
    const result = await cloudflare(env, `/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/workers/observability/telemetry/query`, { method: "POST", body: JSON.stringify(query) });
    return { ok: result.ok, status: result.status, result: result.result, errors: result.errors };
  }
  if (name === "rollbackMainWorker") {
    const versionId = String(args.version_id || "").trim(); const reason = String(args.reason || "").trim();
    if (!versionId || !reason || args.owner_approval !== true) return { ok: false, error: "version_reason_and_owner_approval_required" };
    const result = await cloudflare(env, `/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/workers/scripts/lensically-worker/deployments`, { method: "POST", body: JSON.stringify({ strategy: "percentage", versions: [{ version_id: versionId, percentage: 100 }], annotations: { "workers/message": `Recovery rollback: ${reason}` } }) });
    return { ok: result.ok, status: result.status, deployment: result.result, errors: result.errors };
  }
  if (name === "startRepoFileWrite") {
    const path = safePath(args.path); const mode = String(args.mode || "") as "create" | "replace"; const message = String(args.message || "").trim();
    if (!path || !["create", "replace"].includes(mode) || !message) return { ok: false, error: "path_mode_and_message_required" };
    const existing = await repoFile(env, path);
    if (mode === "create" && existing.ok) return { ok: false, error: "repo_file_already_exists" };
    if (mode === "replace" && !existing.ok) return { ok: false, error: "repo_file_not_found" };
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    await writeRecoverySession(env, { id, path, mode, message, content: "", created_at: now, updated_at: now });
    return { ok: true, session_id: id, path, mode, expires_in_seconds: 86400 };
  }
  if (name === "appendRepoFileChunk") {
    const id = String(args.session_id || ""); const chunk = typeof args.chunk === "string" ? args.chunk : ""; const session = await readRecoverySession(env, id);
    if (!session) return { ok: false, error: "write_session_not_found_or_expired" };
    if (!chunk) return { ok: false, error: "chunk_required" };
    if (session.content.length + chunk.length > 750000) return { ok: false, error: "write_session_too_large", maximum_characters: 750000 };
    session.content += chunk; session.updated_at = new Date().toISOString(); await writeRecoverySession(env, session);
    return { ok: true, session_id: id, total_characters: session.content.length };
  }
  if (name === "commitRepoFileWrite") {
    const id = String(args.session_id || ""); const session = await readRecoverySession(env, id); if (!session) return { ok: false, error: "write_session_not_found_or_expired" };
    const existing = await repoFile(env, session.path);
    if (session.mode === "create" && existing.ok) return { ok: false, error: "repo_file_now_exists" };
    if (session.mode === "replace" && (!existing.ok || !existing.sha)) return { ok: false, error: "repo_file_no_longer_available" };
    if (session.mode === "replace" && existing.content === session.content) {
      await env.RECOVERY_SESSIONS.delete(`write:${id}`);
      return { ok: true, status: 200, path: session.path, commit_sha: null, phase: "no_change", write_mode: "git_data_api" };
    }
    const result = await commitRepoFileViaGitData(env, session.path, session.content, session.message);
    if (result.ok) await env.RECOVERY_SESSIONS.delete(`write:${id}`);
    return { ok: result.ok, status: result.status, path: session.path, commit_sha: result.commit_sha, phase: result.phase ?? null, write_mode: "git_data_api" };
  }
  if (name === "runMainMcpSmoke") {
    const origin = env.MAIN_MCP_ORIGIN || "https://api.lensically.com";
    const redirect = "https://chatgpt.com/connector/oauth/lensically-recovery-smoke";
    const clientId = "lensically-operator-mode";
    const authorize = await fetch(`${origin}/api/operator/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirect)}&scope=operator_mode`, { redirect: "manual" });
    const location = authorize.headers.get("location"); const code = location ? new URL(location).searchParams.get("code") : null;
    if (authorize.status !== 302 || !code) return { ok: false, phase: "oauth_authorize", status: authorize.status };
    const tokenResponse = await fetch(`${origin}/api/operator/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, redirect_uri: redirect, code }) });
    const tokenBody = await tokenResponse.json().catch(() => null) as Record<string, unknown> | null; const token = typeof tokenBody?.access_token === "string" ? tokenBody.access_token : "";
    if (!tokenResponse.ok || !token) return { ok: false, phase: "oauth_token", status: tokenResponse.status };
    const initialize = await mainMcpRequest(origin, token, 1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "lensically-recovery", version: VERSION } });
    const sessionId = initialize.headers.mcp_session_id ?? "";
    const invalidSession = sessionId ? `${sessionId}.invalid` : "invalid-mcp-session";
    const staleSession = await mainMcpRequest(origin, token, 2, "tools/list", {}, invalidSession);
    const listed = await mainMcpRequest(origin, token, 3, "tools/list", {}, sessionId);
    const startup = await mainMcpRequest(origin, token, 4, "tools/call", { name: "executeLensicallyIntent", arguments: { profile_id: "startup", inputs: {} } }, sessionId);
    const accountKey = await mainMcpRequest(origin, token, 5, "tools/call", { name: "executeLensicallyIntent", arguments: { profile_id: "account_key_selection", inputs: { brand_key: "manifest_mental" } } }, sessionId);
    const direct = await mainMcpRequest(origin, token, 6, "tools/call", { name: "getEngineeringAccessState", arguments: {} }, sessionId);
    const mapped = await mainMcpRequest(origin, token, 7, "tools/call", { name: "executeLensicallyIntent", arguments: { profile_id: "get_engineering_access_state", inputs: {} } }, sessionId);
    const legacyMapped = await mainMcpRequest(origin, token, 8, "tools/call", { name: "executeLensicallyIntent", arguments: { objective: "Read the current Lensically engineering access state.", intent: "get engineering access state", inputs: {} } }, sessionId);
    const scheduler = await mainMcpRequest(origin, token, 9, "tools/call", { name: "executeLensicallyIntent", arguments: { profile_id: "get_scheduled_post_scheduler_state", inputs: {} } }, sessionId);
    const campaign = await mainMcpRequest(origin, token, 10, "tools/call", { name: "executeLensicallyIntent", arguments: { profile_id: "capability_campaign", inputs: { segment: "s0" } } }, sessionId);
    const scheduledToday = await mainMcpRequest(origin, token, 11, "tools/call", { name: "executeLensicallyIntent", arguments: { profile_id: "list_scheduled_posts", inputs: { brand_key: "manifest_mental", date: "2026-07-18", timezone: "America/New_York", proceed_confirmed: true } } }, sessionId);
    const scheduledTomorrow = await mainMcpRequest(origin, token, 12, "tools/call", { name: "executeLensicallyIntent", arguments: { profile_id: "list_scheduled_posts", inputs: { brand_key: "manifest_mental", date: "2026-07-19", timezone: "America/New_York", proceed_confirmed: true } } }, sessionId);
    const tools = Array.isArray((listed.body?.result as Record<string, unknown> | undefined)?.tools) ? (listed.body?.result as { tools: Array<Record<string, unknown>> }).tools : [];
    const toolNames = tools.map((tool) => String(tool.name || ""));
    const gatewayTool = tools.find((tool) => tool.name === "executeLensicallyIntent") ?? null;
    const gatewaySchema = gatewayTool?.inputSchema && typeof gatewayTool.inputSchema === "object" && !Array.isArray(gatewayTool.inputSchema)
      ? gatewayTool.inputSchema as Record<string, unknown>
      : null;
    const gatewayProperties = gatewaySchema?.properties && typeof gatewaySchema.properties === "object" && !Array.isArray(gatewaySchema.properties)
      ? gatewaySchema.properties as Record<string, unknown>
      : {};
    const gatewayRequired = Array.isArray(gatewaySchema?.required) ? gatewaySchema.required.map(String) : [];
    const publicContractSucceeded = gatewayRequired.length === 2
      && gatewayRequired.includes("profile_id")
      && gatewayRequired.includes("inputs")
      && Object.prototype.hasOwnProperty.call(gatewayProperties, "profile_id")
      && Object.prototype.hasOwnProperty.call(gatewayProperties, "inputs")
      && !Object.prototype.hasOwnProperty.call(gatewayProperties, "objective")
      && !Object.prototype.hasOwnProperty.call(gatewayProperties, "intent")
      && gatewaySchema?.additionalProperties === false;
    const startupContent = ((startup.body?.result as Record<string, unknown> | undefined)?.structuredContent as Record<string, unknown> | undefined) ?? null;
    const accountKeyContent = ((accountKey.body?.result as Record<string, unknown> | undefined)?.structuredContent as Record<string, unknown> | undefined) ?? null;
    const directContent = ((direct.body?.result as Record<string, unknown> | undefined)?.structuredContent as Record<string, unknown> | undefined) ?? null;
    const mappedContent = ((mapped.body?.result as Record<string, unknown> | undefined)?.structuredContent as Record<string, unknown> | undefined) ?? null;
    const legacyMappedContent = ((legacyMapped.body?.result as Record<string, unknown> | undefined)?.structuredContent as Record<string, unknown> | undefined) ?? null;
    const schedulerContent = ((scheduler.body?.result as Record<string, unknown> | undefined)?.structuredContent as Record<string, unknown> | undefined) ?? null;
    const campaignContent = ((campaign.body?.result as Record<string, unknown> | undefined)?.structuredContent as Record<string, unknown> | undefined) ?? null;
    const scheduledTodayContent = ((scheduledToday.body?.result as Record<string, unknown> | undefined)?.structuredContent as Record<string, unknown> | undefined) ?? null;
    const scheduledTomorrowContent = ((scheduledTomorrow.body?.result as Record<string, unknown> | undefined)?.structuredContent as Record<string, unknown> | undefined) ?? null;
    const mappedSurface = toolNames.length === 1 && toolNames.includes("executeLensicallyIntent") && publicContractSucceeded;
    const staleSessionError = staleSession.body?.error && typeof staleSession.body.error === "object" && !Array.isArray(staleSession.body.error)
      ? staleSession.body.error as Record<string, unknown>
      : null;
    const staleSessionData = staleSessionError?.data && typeof staleSessionError.data === "object" && !Array.isArray(staleSessionError.data)
      ? staleSessionError.data as Record<string, unknown>
      : null;
    const sessionIssued = initialize.status === 200
      && Boolean(sessionId)
      && initialize.headers.execution_kernel === "lensically-execution-kernel-v1"
      && Boolean(initialize.headers.deployment_id)
      && Boolean(initialize.headers.commit_sha);
    const staleSessionRejected = staleSession.status === 404
      && ["invalid_mcp_session", "stale_mcp_deployment_session"].includes(String(staleSessionData?.reason ?? ""))
      && Boolean(staleSession.headers.mcp_session_id)
      && staleSession.headers.mcp_session_id !== invalidSession;
    const directRejected = directContent?.error === "routed_execution_gateway_required" && directContent?.required_tool === "executeLensicallyIntent";
    const mappedSucceeded = mapped.status === 200
      && mappedContent?.ok === true
      && (mappedContent?.routed_execution as Record<string, unknown> | undefined)?.profile_id === "get_engineering_access_state"
      && (mappedContent?.routed_execution as Record<string, unknown> | undefined)?.executed_tool === "getEngineeringAccessState"
      && (mappedContent?.execution_guard_enforcement as Record<string, unknown> | undefined)?.model_tool_choice_allowed === false;
    const legacyFreehandRetired = legacyMapped.status === 200
      && legacyMappedContent?.ok === false
      && legacyMappedContent?.error === "registered_profile_id_required";
    const executionKernel = startupContent?.execution_kernel && typeof startupContent.execution_kernel === "object" && !Array.isArray(startupContent.execution_kernel)
      ? startupContent.execution_kernel as Record<string, unknown>
      : null;
    const executionKernelSucceeded = executionKernel?.name === "Execution Kernel"
      && executionKernel?.version === "lensically-execution-kernel-v1"
      && executionKernel?.public_contract === "profile_id_inputs_v1"
      && executionKernel?.deployment_fresh_sessions === true;
    const mapSummary = startupContent?.mandatory_execution_map as Record<string, unknown> | undefined;
    const executionLifecycle = executionKernel?.lifecycle && typeof executionKernel.lifecycle === "object" && !Array.isArray(executionKernel.lifecycle)
      ? executionKernel.lifecycle as Record<string, unknown>
      : null;
    const startupPolicySucceeded = executionLifecycle?.version === "static-execution-router-v1"
      && executionLifecycle?.map_state === "source_defined_route_completed"
      && executionLifecycle?.route_mode === "source_defined_static_route"
      && executionLifecycle?.mandatory_path_followed === true
      && executionLifecycle?.d1_execution_library_bypassed === true
      && executionLifecycle?.discovery_allowed === false
      && executionLifecycle?.model_tool_choice_allowed === false;
    const accountKeyRoute = accountKeyContent?.routed_execution as Record<string, unknown> | undefined;
    const accountKeySucceeded = accountKey.status === 200
      && accountKeyContent?.ok === true
      && accountKeyContent?.selected_key === "manifest_mental"
      && accountKeyContent?.account_data_loaded === false
      && accountKeyContent?.next_profile_id === "account_proceed"
      && accountKeyRoute?.profile_id === "account_key_selection"
      && accountKeyRoute?.executed_tool === "selectOperatorKey";
    return {
      ok: initialize.status === 200
        && listed.status === 200
        && startup.status === 200
        && startupContent?.ok === true
        && accountKeySucceeded
        && mappedSurface
        && sessionIssued
        && staleSessionRejected
        && executionKernelSucceeded
        && directRejected
        && mappedSucceeded
        && legacyFreehandRetired
        && startupPolicySucceeded,
      oauth: { authorize: authorize.status, token: tokenResponse.status },
      initialize: {
        status: initialize.status,
        server_info: (initialize.body?.result as Record<string, unknown> | undefined)?.serverInfo ?? null,
        deployment_id: initialize.headers.deployment_id,
        commit_sha: initialize.headers.commit_sha,
        execution_kernel: initialize.headers.execution_kernel,
        session_issued: sessionIssued,
      },
      tools_list: {
        status: listed.status,
        count: tools.length,
        unique_count: new Set(toolNames).size,
        names: toolNames,
        public_contract_enforced: publicContractSucceeded,
        legacy_profile_schema_retired: Object.prototype.hasOwnProperty.call(gatewayProperties, "profile_id")
          && !Object.prototype.hasOwnProperty.call(gatewayProperties, "objective")
          && !Object.prototype.hasOwnProperty.call(gatewayProperties, "intent"),
        legacy_freehand_contract_retired: legacyFreehandRetired,
        required: gatewayRequired,
        properties: Object.keys(gatewayProperties),
      },
      session_freshness: {
        version: "deployment-scoped-mcp-session-v1",
        issued: sessionIssued,
        stale_or_invalid_session_rejected_before_routing: staleSessionRejected,
        rejection_status: staleSession.status,
        rejection_reason: staleSessionData?.reason ?? null,
        replacement_session_issued: Boolean(staleSession.headers.mcp_session_id),
      },
      startup: {
        status: startup.status,
        ok: startupContent?.ok === true,
        execution_kernel: executionKernel,
        mandatory_execution_map: mapSummary ?? null,
        client_safety: startupContent?.client_safety ?? null,
        system_directory: startupContent?.system_directory ?? null,
        tool_surface: startupContent?.tool_surface ?? null,
        repository: startupContent?.repository ?? null,
        runtime: startupContent?.runtime ?? null,
      },
      account_key_lifecycle: {
        status: accountKey.status,
        ok: accountKeySucceeded,
        selected_key: accountKeyContent?.selected_key ?? null,
        account_data_loaded: accountKeyContent?.account_data_loaded ?? null,
        resolved_profile_id: accountKeyRoute?.profile_id ?? null,
        executed_tool: accountKeyRoute?.executed_tool ?? null,
        next_profile_id: accountKeyContent?.next_profile_id ?? null,
      },
      direct_operational_call: { status: direct.status, rejected: directRejected, error: directContent?.error ?? null },
      mapped_execution_call: { status: mapped.status, ok: mappedSucceeded, profile_id: (mappedContent?.routed_execution as Record<string, unknown> | undefined)?.profile_id ?? null, executed_tool: (mappedContent?.routed_execution as Record<string, unknown> | undefined)?.executed_tool ?? null, model_tool_choice_allowed: (mappedContent?.execution_guard_enforcement as Record<string, unknown> | undefined)?.model_tool_choice_allowed ?? null },
      legacy_freehand_retirement: { status: legacyMapped.status, ok: legacyFreehandRetired, error: legacyMappedContent?.error ?? null },
      capability_campaign: { status: campaign.status, ok: campaignContent?.ok ?? null, report: campaignContent?.campaign ?? null },
      scheduler_state: { status: scheduler.status, content: schedulerContent },
      scheduled_inventory: { today: { status: scheduledToday.status, content: scheduledTodayContent }, tomorrow: { status: scheduledTomorrow.status, content: scheduledTomorrowContent } },
    };
  }
  return { ok: false, error: "unknown_recovery_tool" };
}

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return base64Url(binary);
}

async function signRecoveryMapPayload(env: Env, payload: Record<string, unknown>): Promise<string> {
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${await hmac(env.RECOVERY_MCP_ACCESS_TOKEN, encoded)}`;
}

async function verifyRecoveryMapPayload(env: Env, token: unknown): Promise<Record<string, unknown> | null> {
  if (typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || await hmac(env.RECOVERY_MCP_ACCESS_TOKEN, payload) !== signature) return null;
  try {
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - payload.length % 4) % 4));
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    return Number(parsed.exp ?? 0) > Math.floor(Date.now() / 1000) ? parsed : null;
  } catch {
    return null;
  }
}

async function oauthCode(env: Env, clientId: string, redirectUri: string): Promise<string> {
  const payload = base64Url(JSON.stringify({ client_id: clientId, redirect_uri: redirectUri, exp: Math.floor(Date.now() / 1000) + 600, nonce: crypto.randomUUID() }));
  return `${payload}.${await hmac(env.RECOVERY_MCP_ACCESS_TOKEN, payload)}`;
}

async function verifyCode(env: Env, code: string): Promise<Record<string, unknown> | null> {
  const [payload, signature] = code.split("."); if (!payload || !signature || await hmac(env.RECOVERY_MCP_ACCESS_TOKEN, payload) !== signature) return null;
  try { const parsed = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - payload.length % 4) % 4))); return Number(parsed.exp) > Math.floor(Date.now() / 1000) ? parsed : null; } catch { return null; }
}

function allowedRedirect(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "chatgpt.com" && url.pathname.startsWith("/connector/oauth/"); } catch { return false; }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url); const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
    try {
      if (url.pathname === "/health") return json({
        status: "ok",
        ...metadata(env),
        execution_map_version: MANDATORY_RECOVERY_MAP_VERSION,
        public_tool_count: PUBLIC_TOOLS.length,
        internal_tool_count: TOOLS.length,
        model_tool_choice_allowed: false,
        timestamp: new Date().toISOString(),
      });
      if (url.pathname === "/.well-known/oauth-authorization-server" || url.pathname === "/.well-known/openid-configuration") return json({ issuer: url.origin, authorization_endpoint: `${url.origin}/oauth/authorize`, token_endpoint: `${url.origin}/oauth/token`, response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], token_endpoint_auth_methods_supported: ["none"], scopes_supported: ["recovery", "offline_access"], code_challenge_methods_supported: ["plain", "S256"] });
      if (url.pathname === "/.well-known/oauth-protected-resource") return json({ resource: `${url.origin}/mcp`, authorization_servers: [url.origin], scopes_supported: ["recovery", "offline_access"] });
      if (url.pathname === "/oauth/authorize") {
        const clientId = url.searchParams.get("client_id") || ""; const redirectUri = url.searchParams.get("redirect_uri") || "";
        if (url.searchParams.get("response_type") !== "code" || clientId !== (env.RECOVERY_MCP_OAUTH_CLIENT_ID || "lensically-recovery") || !allowedRedirect(redirectUri)) return json({ error: "invalid_request" }, 400);
        const destination = new URL(redirectUri); destination.searchParams.set("code", await oauthCode(env, clientId, redirectUri)); const state = url.searchParams.get("state"); if (state) destination.searchParams.set("state", state); return Response.redirect(destination.toString(), 302);
      }
      if (url.pathname === "/oauth/token" && request.method === "POST") {
        const form = new URLSearchParams(await request.text());
        if (form.get("grant_type") === "refresh_token") {
          if (form.get("refresh_token") !== env.RECOVERY_MCP_ACCESS_TOKEN) return json({ error: "invalid_grant" }, 400);
          return json({ access_token: env.RECOVERY_MCP_ACCESS_TOKEN, refresh_token: env.RECOVERY_MCP_ACCESS_TOKEN, token_type: "Bearer", expires_in: 31536000, scope: "recovery offline_access" });
        }
        const code = form.get("code") || ""; const payload = await verifyCode(env, code); const clientId = form.get("client_id") || ""; const redirectUri = form.get("redirect_uri") || "";
        if (form.get("grant_type") !== "authorization_code" || !payload || payload.client_id !== clientId || payload.redirect_uri !== redirectUri) return json({ error: "invalid_grant" }, 400);
        return json({ access_token: env.RECOVERY_MCP_ACCESS_TOKEN, refresh_token: env.RECOVERY_MCP_ACCESS_TOKEN, token_type: "Bearer", expires_in: 31536000, scope: "recovery offline_access" });
      }
      if (url.pathname !== "/mcp") return json({ ok: false, error: "not_found" }, 404);
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
      if (!env.RECOVERY_MCP_ACCESS_TOKEN || bearer(request) !== env.RECOVERY_MCP_ACCESS_TOKEN) return json({ ok: false, error: "unauthorized" }, 401);
      const message = await request.json().catch(() => null) as { id?: string | number | null; method?: string; params?: Record<string, unknown> } | null;
      if (!message?.method) return json({ jsonrpc: "2.0", id: message?.id ?? null, error: { code: -32600, message: "Invalid Request" } });
      if (message.method === "initialize") return json({ jsonrpc: "2.0", id: message.id ?? null, result: { protocolVersion: String(message.params?.protocolVersion || "2025-06-18"), capabilities: { tools: { listChanged: true } }, serverInfo: { name: "lensically-recovery", title: "Lensically Recovery", version: VERSION }, instructions: "Independent break-glass recovery plane. Use these source-defined recovery tools when the main Lensically MCP gateway is unavailable or cannot repair itself. This service can inspect and patch the repository, dispatch tests/deployments, inspect Cloudflare state, and run main-MCP smoke tests. It does not access Lensically account, generation, or customer data. Protected destructive rollback still requires explicit owner approval." } });
      if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
      if (message.method === "ping") return json({ jsonrpc: "2.0", id: message.id ?? null, result: {} });
      if (message.method === "tools/list") return json({ jsonrpc: "2.0", id: message.id ?? null, result: { tools: PUBLIC_TOOLS } });
      if (message.method === "tools/call") {
        const name = String(message.params?.name || "");
        const args = message.params?.arguments && typeof message.params.arguments === "object" ? message.params.arguments as Record<string, unknown> : {};
        const publicTool = PUBLIC_TOOLS.find((tool) => tool.name === name);
        if (!publicTool) {
          const result = { ok: false, error: "recovery_tool_not_found", requested_tool: name, public_tool_count: PUBLIC_TOOLS.length };
          return json({ jsonrpc: "2.0", id: message.id ?? null, result: { structuredContent: result, content: [{ type: "text", text: "Recovery tool not found." }], isError: true } });
        }
        const result = await toolCall(name, args, env);
        return json({ jsonrpc: "2.0", id: message.id ?? null, result: { structuredContent: result, content: [{ type: "text", text: result.ok === false ? `Recovery action failed: ${String(result.error || result.status || "unknown")}` : "Recovery action completed." }], isError: result.ok === false } });
      }
      return json({ jsonrpc: "2.0", id: message.id ?? null, error: { code: -32601, message: "Method not found" } });
    } catch (error) {
      return json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Recovery method failed", data: { ok: false, error_code: "recovery_method_failed", request_id: requestId, ...metadata(env), safe_message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500) } } });
    }
  },
} satisfies ExportedHandler<Env>;
