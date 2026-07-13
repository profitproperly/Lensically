import assert from "node:assert/strict";

const base = process.env.RECOVERY_ORIGIN || "https://lensically-recovery.lensically.workers.dev";
const redirect = "https://chatgpt.com/connector/oauth/lensically-recovery-live-smoke";
const clientId = "lensically-recovery";

const authorize = await fetch(`${base}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&scope=recovery%20offline_access`, { redirect: "manual" });
assert.equal(authorize.status, 302);
const location = authorize.headers.get("location");
assert.ok(location);
const code = new URL(location).searchParams.get("code");
assert.ok(code);

const tokenResponse = await fetch(`${base}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, redirect_uri: redirect, code }) });
assert.equal(tokenResponse.status, 200);
const tokenBody = await tokenResponse.json();
assert.ok(tokenBody.access_token);
assert.ok(tokenBody.refresh_token);

async function mcp(id, method, params = {}) {
  const response = await fetch(`${base}/mcp`, { method: "POST", headers: { authorization: `Bearer ${tokenBody.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.error, undefined, JSON.stringify(payload.error));
  return payload.result;
}

const initialize = await mcp(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "recovery-live-smoke", version: "1" } });
assert.equal(initialize.serverInfo.name, "lensically-recovery");
const listed = await mcp(2, "tools/list");
const names = listed.tools.map((tool) => tool.name);
assert.equal(new Set(names).size, names.length);
for (const name of ["getCloudflareWorkerState", "queryCloudflareTelemetry", "rollbackMainWorker", "startRepoFileWrite", "appendRepoFileChunk", "commitRepoFileWrite", "runMainMcpSmoke"]) assert.ok(names.includes(name), name);

const mainSmoke = await mcp(3, "tools/call", { name: "runMainMcpSmoke", arguments: {} });
assert.equal(mainSmoke.isError, false, JSON.stringify(mainSmoke.structuredContent));
assert.equal(mainSmoke.structuredContent.ok, true, JSON.stringify(mainSmoke.structuredContent));
const cloudflare = await mcp(4, "tools/call", { name: "getCloudflareWorkerState", arguments: {} });
assert.equal(cloudflare.isError, false, JSON.stringify(cloudflare.structuredContent));
assert.equal(cloudflare.structuredContent.ok, true, JSON.stringify(cloudflare.structuredContent));
assert.ok((cloudflare.structuredContent.deployments?.length ?? 0) > 0, "Cloudflare deployments were not returned");

console.log(JSON.stringify({ ok: true, recovery_version: initialize.serverInfo.version, tool_count: names.length, main_smoke: mainSmoke.structuredContent, cloudflare_deployments: cloudflare.structuredContent.deployments?.length ?? 0 }));
