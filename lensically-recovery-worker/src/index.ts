interface Env {
  GITHUB_TOKEN: string;
  RECOVERY_MCP_ACCESS_TOKEN: string;
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

const VERSION = "1.0.0";
const JSON_HEADERS = { "content-type": "application/json; charset=UTF-8", "cache-control": "no-store" };
const TOOLS: Tool[] = [
  { name: "recoveryHealth", title: "Recovery health", description: "Verify the independent recovery plane and the main Lensically health endpoint.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "getRepoStatus", title: "Get repository status", description: "Read the Lensically main branch SHA and latest commit metadata.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "readRepoFile", title: "Read repository file", description: "Read one repository file with optional line bounds.", inputSchema: { type: "object", properties: { path: { type: "string" }, start_line: { type: "integer", minimum: 1 }, max_lines: { type: "integer", minimum: 1, maximum: 500 } }, required: ["path"], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "searchRepoFiles", title: "Search repository files", description: "Search source files by path and text using the GitHub tree and bounded file reads.", inputSchema: { type: "object", properties: { query: { type: "string" }, prefix: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["query"], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "applyRepoTextPatch", title: "Apply repository text patch", description: "Apply one exact source-controlled find/replace patch and commit it to the main branch.", inputSchema: { type: "object", properties: { path: { type: "string" }, find: { type: "string" }, replace: { type: "string" }, message: { type: "string" } }, required: ["path", "find", "replace", "message"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: "listGitHubWorkflowRuns", title: "List workflow runs", description: "List recent Lensically Engineering workflow runs.", inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 20 } }, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "runGitHubWorkflow", title: "Run GitHub workflow", description: "Dispatch a typecheck, operator-tests, gpt-memory-tests, or worker-deploy recovery task.", inputSchema: { type: "object", properties: { task: { type: "string", enum: ["typecheck", "operator-tests", "gpt-memory-tests", "worker-deploy"] }, ref: { type: "string" } }, required: ["task"], additionalProperties: false }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: "getGitHubWorkflowRun", title: "Get workflow run", description: "Read one workflow run and its jobs.", inputSchema: { type: "object", properties: { run_id: { type: "integer" } }, required: ["run_id"], additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
  { name: "verifyMainMcp", title: "Verify main MCP", description: "Probe main Lensically health, OAuth metadata, initialize, and unauthenticated transport behavior without enumerating account data.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: true } },
];

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
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { accept: "application/vnd.github+json", authorization: `Bearer ${env.GITHUB_TOKEN}`, "user-agent": "lensically-recovery", "x-github-api-version": "2022-11-28", ...(init.headers || {}) } });
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => null) };
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
  const result = await github(env, `/repos/${config.owner}/${config.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(config.branch)}`);
  const data = result.data && typeof result.data === "object" && !Array.isArray(result.data) ? result.data as Record<string, unknown> : null;
  return { ok: result.ok, status: result.status, sha: typeof data?.sha === "string" ? data.sha : null, content: typeof data?.content === "string" ? base64ToText(data.content) : null };
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
    const query = String(args.query || "").toLowerCase();
    const prefix = safePath(args.prefix || "") || "";
    const limit = Math.min(50, Math.max(1, Number(args.limit || 20)));
    const tree = await github(env, `/repos/${config.owner}/${config.repo}/git/trees/${encodeURIComponent(config.branch)}?recursive=1`);
    const entries = Array.isArray((tree.data as Record<string, unknown> | null)?.tree) ? (tree.data as { tree: Array<Record<string, unknown>> }).tree : [];
    const candidates = entries.filter((entry) => entry.type === "blob" && typeof entry.path === "string" && (!prefix || entry.path.startsWith(prefix))).slice(0, 500);
    const pathMatches = candidates.filter((entry) => String(entry.path).toLowerCase().includes(query)).slice(0, limit).map((entry) => ({ path: entry.path, source: "path" }));
    if (pathMatches.length >= limit) return { ok: true, matches: pathMatches };
    const textMatches: Array<Record<string, unknown>> = [];
    for (const entry of candidates.slice(0, 12)) {
      if (textMatches.length + pathMatches.length >= limit) break;
      const file = await repoFile(env, String(entry.path));
      if (!file.content || file.content.length > 200000) continue;
      const index = file.content.toLowerCase().indexOf(query);
      if (index >= 0) textMatches.push({ path: entry.path, source: "content", excerpt: file.content.slice(Math.max(0, index - 120), index + query.length + 240) });
    }
    return { ok: true, matches: [...pathMatches, ...textMatches] };
  }
  if (name === "applyRepoTextPatch") {
    const path = safePath(args.path); const find = String(args.find || ""); const replace = String(args.replace ?? ""); const message = String(args.message || "");
    if (!path || !find || !message) return { ok: false, error: "path_find_and_message_required" };
    const file = await repoFile(env, path);
    if (!file.ok || !file.content || !file.sha) return { ok: false, error: "repo_file_unavailable", status: file.status };
    const occurrences = file.content.split(find).length - 1;
    if (occurrences !== 1) return { ok: false, error: "find_text_must_match_exactly_once", occurrences };
    const content = file.content.replace(find, replace);
    const result = await github(env, `/repos/${config.owner}/${config.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, content: textToBase64(content), sha: file.sha, branch: config.branch }) });
    const data = result.data as Record<string, unknown> | null;
    return { ok: result.ok, status: result.status, path, commit_sha: (data?.commit as Record<string, unknown> | undefined)?.sha ?? null };
  }
  if (name === "listGitHubWorkflowRuns") {
    const limit = Math.min(20, Math.max(1, Number(args.limit || 10)));
    const result = await github(env, `/repos/${config.owner}/${config.repo}/actions/workflows/lensically-engineering.yml/runs?per_page=${limit}`);
    const runs = Array.isArray((result.data as Record<string, unknown> | null)?.workflow_runs) ? (result.data as { workflow_runs: Array<Record<string, unknown>> }).workflow_runs : [];
    return { ok: result.ok, status: result.status, runs: runs.map((run) => ({ id: run.id, status: run.status, conclusion: run.conclusion, head_sha: run.head_sha, html_url: run.html_url, created_at: run.created_at })) };
  }
  if (name === "runGitHubWorkflow") {
    const task = String(args.task || "");
    if (!["typecheck", "operator-tests", "gpt-memory-tests", "worker-deploy"].includes(task)) return { ok: false, error: "invalid_workflow_task" };
    const result = await github(env, `/repos/${config.owner}/${config.repo}/actions/workflows/lensically-engineering.yml/dispatches`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: String(args.ref || config.branch), inputs: { task } }) });
    return { ok: result.ok, status: result.status, task, dispatched: result.status === 204 };
  }
  if (name === "getGitHubWorkflowRun") {
    const id = Math.trunc(Number(args.run_id));
    const [run, jobs] = await Promise.all([github(env, `/repos/${config.owner}/${config.repo}/actions/runs/${id}`), github(env, `/repos/${config.owner}/${config.repo}/actions/runs/${id}/jobs?per_page=20`)]);
    const runData = run.data as Record<string, unknown> | null;
    const jobRows = Array.isArray((jobs.data as Record<string, unknown> | null)?.jobs) ? (jobs.data as { jobs: Array<Record<string, unknown>> }).jobs : [];
    return { ok: run.ok && jobs.ok, run: { id: runData?.id, status: runData?.status, conclusion: runData?.conclusion, head_sha: runData?.head_sha, html_url: runData?.html_url, created_at: runData?.created_at, updated_at: runData?.updated_at }, jobs: jobRows.map((job) => ({ id: job.id, name: job.name, status: job.status, conclusion: job.conclusion, html_url: job.html_url })) };
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
      if (url.pathname === "/health") return json({ status: "ok", ...metadata(env), tool_count: TOOLS.length, timestamp: new Date().toISOString() });
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
      if (message.method === "initialize") return json({ jsonrpc: "2.0", id: message.id ?? null, result: { protocolVersion: String(message.params?.protocolVersion || "2025-06-18"), capabilities: { tools: { listChanged: false } }, serverInfo: { name: "lensically-recovery", title: "Lensically Recovery", version: VERSION }, instructions: "Independent break-glass recovery plane for repairing the main Lensically MCP. Diagnose first, patch narrowly, run CI, deploy only after tests pass, and verify the main endpoint. This service does not access Lensically account or generation data." } });
      if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
      if (message.method === "ping") return json({ jsonrpc: "2.0", id: message.id ?? null, result: {} });
      if (message.method === "tools/list") return json({ jsonrpc: "2.0", id: message.id ?? null, result: { tools: TOOLS } });
      if (message.method === "tools/call") {
        const name = String(message.params?.name || ""); const tool = TOOLS.find((item) => item.name === name); if (!tool) return json({ jsonrpc: "2.0", id: message.id ?? null, error: { code: -32602, message: "Unknown recovery tool" } });
        const args = message.params?.arguments && typeof message.params.arguments === "object" ? message.params.arguments as Record<string, unknown> : {};
        const result = await toolCall(name, args, env); return json({ jsonrpc: "2.0", id: message.id ?? null, result: { structuredContent: result, content: [{ type: "text", text: result.ok === false ? `Recovery tool ${name} failed: ${String(result.error || result.status || "unknown")}` : `Recovery tool ${name} completed.` }], isError: result.ok === false } });
      }
      return json({ jsonrpc: "2.0", id: message.id ?? null, error: { code: -32601, message: "Method not found" } });
    } catch (error) {
      return json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Recovery method failed", data: { ok: false, error_code: "recovery_method_failed", request_id: requestId, ...metadata(env), safe_message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500) } } });
    }
  },
} satisfies ExportedHandler<Env>;
