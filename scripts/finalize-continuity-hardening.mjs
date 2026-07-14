import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const indexPath = path.join(root, "lensically-worker", "src", "index.ts");
const testPath = path.join(root, "lensically-worker", "test", "operatorMode.spec.ts");
const workflowPath = path.join(root, ".github", "workflows", "lensically-engineering.yml");
const selfPath = fileURLToPath(import.meta.url);

function replaceLiteralOnce(source, find, replacement, label) {
  const count = source.split(find).length - 1;
  if (count === 0 && source.includes(replacement)) return source;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return source.replace(find, replacement);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const matches = source.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`)) ?? [];
  if (matches.length === 0 && typeof replacement === "string" && source.includes(replacement.slice(0, Math.min(replacement.length, 120)))) {
    return source;
  }
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one match, found ${matches.length}`);
  return source.replace(pattern, replacement);
}

let index = fs.readFileSync(indexPath, "utf8");

index = replaceLiteralOnce(
  index,
  'const OPERATOR_MCP_VERSION = "1.3.0";\nconst OPERATOR_REGISTRY_GENERATION = "resilient-canonical-v2";',
  'const OPERATOR_MCP_VERSION = "1.4.0";\nconst OPERATOR_REGISTRY_GENERATION = "continuity-hardened-v3";',
  "version bump",
);

const githubReadReplacement = `async function getGithubFile(env: Env, repoPath: string): Promise<{ ok: boolean; status: number; sha: string | null; content: string | null; size: number }> {
  const config = githubRepoConfig(env);
  const encodedPath = encodeURIComponent(repoPath).replace(/%2F/g, "/");
  const contents = await githubRepoApi(env, \`/contents/\${encodedPath}?ref=\${encodeURIComponent(config.branch)}\`);
  if (contents.ok && contents.data && typeof contents.data === "object" && !Array.isArray(contents.data)) {
    const data = contents.data as Record<string, unknown>;
    const encoded = typeof data.content === "string" ? data.content.trim() : "";
    const sha = typeof data.sha === "string" ? data.sha : null;
    if (encoded && sha) {
      return {
        ok: true,
        status: contents.status,
        sha,
        content: base64ToTextUtf8(encoded),
        size: Number(data.size ?? 0),
      };
    }
  }

  const tree = await githubRepoApi(env, \`/git/trees/\${encodeURIComponent(config.branch)}?recursive=1\`);
  const entries = tree.data && typeof tree.data === "object" && !Array.isArray(tree.data) && Array.isArray((tree.data as Record<string, unknown>).tree)
    ? (tree.data as Record<string, unknown>).tree as Array<Record<string, unknown>>
    : [];
  const entry = entries.find((item) => item.type === "blob" && item.path === repoPath);
  const blobSha = typeof entry?.sha === "string" ? entry.sha : null;
  if (!tree.ok || !blobSha) {
    return { ok: false, status: tree.status || contents.status, sha: null, content: null, size: 0 };
  }
  const blob = await githubRepoApi(env, \`/git/blobs/\${blobSha}\`);
  if (!blob.ok || !blob.data || typeof blob.data !== "object" || Array.isArray(blob.data)) {
    return { ok: false, status: blob.status, sha: null, content: null, size: 0 };
  }
  const blobData = blob.data as Record<string, unknown>;
  const encoded = typeof blobData.content === "string" ? blobData.content : "";
  return {
    ok: Boolean(encoded),
    status: blob.status,
    sha: blobSha,
    content: encoded ? base64ToTextUtf8(encoded) : null,
    size: Number(entry?.size ?? 0),
  };
}

async function putGithubFile`;

index = replaceRegexOnce(
  index,
  /async function getGithubFile\(env: Env, repoPath: string\): Promise<\{[\s\S]*?\n\}\n\nasync function putGithubFile/,
  githubReadReplacement,
  "large-file-safe read",
);

const githubWriteReplacement = `async function putGithubFile(env: Env, input: { path: string; content: string; message: string; sha?: string | null }): Promise<{ ok: boolean; status: number; commit_sha: string | null; data: unknown }> {
  const config = githubRepoConfig(env);
  const branchRef = config.branch.split("/").map(encodeURIComponent).join("/");
  const ref = await githubRepoApi(env, \`/git/ref/heads/\${branchRef}\`);
  const refData = ref.data && typeof ref.data === "object" && !Array.isArray(ref.data) ? ref.data as Record<string, unknown> : null;
  const refObject = refData?.object && typeof refData.object === "object" && !Array.isArray(refData.object)
    ? refData.object as Record<string, unknown>
    : null;
  const headSha = typeof refObject?.sha === "string" ? refObject.sha : null;
  if (!ref.ok || !headSha) {
    return { ok: false, status: ref.status, commit_sha: null, data: { phase: "read_ref", response: ref.data } };
  }

  const parent = await githubRepoApi(env, \`/git/commits/\${headSha}\`);
  const parentData = parent.data && typeof parent.data === "object" && !Array.isArray(parent.data) ? parent.data as Record<string, unknown> : null;
  const parentTree = parentData?.tree && typeof parentData.tree === "object" && !Array.isArray(parentData.tree)
    ? parentData.tree as Record<string, unknown>
    : null;
  const baseTreeSha = typeof parentTree?.sha === "string" ? parentTree.sha : null;
  if (!parent.ok || !baseTreeSha) {
    return { ok: false, status: parent.status, commit_sha: null, data: { phase: "read_parent_commit", response: parent.data } };
  }

  const blob = await githubRepoApi(env, "/git/blobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: input.content, encoding: "utf-8" }),
  });
  const blobData = blob.data && typeof blob.data === "object" && !Array.isArray(blob.data) ? blob.data as Record<string, unknown> : null;
  const blobSha = typeof blobData?.sha === "string" ? blobData.sha : null;
  if (!blob.ok || !blobSha) {
    return { ok: false, status: blob.status, commit_sha: null, data: { phase: "create_blob", response: blob.data } };
  }

  const tree = await githubRepoApi(env, "/git/trees", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [{ path: input.path, mode: "100644", type: "blob", sha: blobSha }],
    }),
  });
  const treeData = tree.data && typeof tree.data === "object" && !Array.isArray(tree.data) ? tree.data as Record<string, unknown> : null;
  const treeSha = typeof treeData?.sha === "string" ? treeData.sha : null;
  if (!tree.ok || !treeSha) {
    return { ok: false, status: tree.status, commit_sha: null, data: { phase: "create_tree", response: tree.data } };
  }

  const commit = await githubRepoApi(env, "/git/commits", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: input.message, tree: treeSha, parents: [headSha] }),
  });
  const commitData = commit.data && typeof commit.data === "object" && !Array.isArray(commit.data) ? commit.data as Record<string, unknown> : null;
  const commitSha = typeof commitData?.sha === "string" ? commitData.sha : null;
  if (!commit.ok || !commitSha) {
    return { ok: false, status: commit.status, commit_sha: null, data: { phase: "create_commit", response: commit.data } };
  }

  const update = await githubRepoApi(env, \`/git/refs/heads/\${branchRef}\`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
  return {
    ok: update.ok,
    status: update.status,
    commit_sha: update.ok ? commitSha : null,
    data: update.ok ? { write_mode: "git_data_api", commit: commit.data } : { phase: "update_ref", response: update.data },
  };
}

async function recordEngineeringAudit`;

index = replaceRegexOnce(
  index,
  /async function putGithubFile\(env: Env, input: \{[\s\S]*?\n\}\n\nasync function recordEngineeringAudit/,
  githubWriteReplacement,
  "large-file-safe write",
);

const verifierReplacement = `    if (toolName === "verifyDeployedMcpVersion") {
    const authorization = request.headers.get("authorization") ?? "";
    const endpoint = \`\${DEFAULT_WORKER_ORIGIN}/api/operator/mcp\`;
    const body = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "lensically-engineering-mcp", version: "1.0.0" } } };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": authorization },
      body: JSON.stringify(body),
    });
    const payload = await readJsonSafe(response) as Record<string, unknown> | null;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        initialize: payload?.result ?? null,
        boundary_test: null,
      };
    }
    const sessionHeaders = {
      "content-type": "application/json",
      "authorization": authorization,
      "MCP-Protocol-Version": "2025-06-18",
    };
    const callLiveMcp = async (id: number, method: string, params: Record<string, unknown>): Promise<{ status: number; payload: Record<string, unknown> | null }> => {
      const liveResponse = await fetch(endpoint, {
        method: "POST",
        headers: sessionHeaders,
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      });
      return {
        status: liveResponse.status,
        payload: await readJsonSafe(liveResponse) as Record<string, unknown> | null,
      };
    };
    const structured = (result: Record<string, unknown> | null): Record<string, unknown> => {
      const rpcResult = result?.result && typeof result.result === "object" && !Array.isArray(result.result)
        ? result.result as Record<string, unknown>
        : {};
      return rpcResult.structuredContent && typeof rpcResult.structuredContent === "object" && !Array.isArray(rpcResult.structuredContent)
        ? rpcResult.structuredContent as Record<string, unknown>
        : {};
    };

    const listed = await callLiveMcp(2, "tools/list", {});
    const listedTools = listed.payload?.result && typeof listed.payload.result === "object" && !Array.isArray(listed.payload.result)
      ? (listed.payload.result as Record<string, unknown>).tools
      : [];
    const select = await callLiveMcp(3, "tools/call", { name: "selectOperatorKey", arguments: { brand_key: "manifest_mental" } });
    const blocked = await callLiveMcp(4, "tools/call", { name: "getWorkflowStatus", arguments: { brand_key: "manifest_mental" } });
    const proceed = await callLiveMcp(5, "tools/call", { name: "confirmOperatorProceed", arguments: { brand_key: "manifest_mental" } });
    const proceedContent = structured(proceed.payload);
    const beforeContinuity = await callLiveMcp(6, "tools/call", {
      name: "getWorkflowStatus",
      arguments: { brand_key: "manifest_mental", proceed_confirmed: true },
    });
    const continuation = await callLiveMcp(7, "tools/call", {
      name: "resolveContinuationContext",
      arguments: {
        brand_key: "manifest_mental",
        proceed_confirmed: true,
        continuation_choice: "resume_existing_workflow",
        continuation_nonce: proceedContent.continuation_nonce,
      },
    });
    const continuationContent = structured(continuation.payload);
    const allowed = await callLiveMcp(8, "tools/call", {
      name: "getWorkflowStatus",
      arguments: {
        brand_key: "manifest_mental",
        proceed_confirmed: true,
        continuity_token: continuationContent.continuity_token,
      },
    });

    const selectContent = structured(select.payload);
    const blockedContent = structured(blocked.payload);
    const beforeContinuityContent = structured(beforeContinuity.payload);
    const allowedContent = structured(allowed.payload);
    const boundaryTest = {
      selected_key: selectContent.selected_key ?? null,
      handshake: selectContent.handshake ?? null,
      blocked_before_proceed: blockedContent.error === "explicit_proceed_required" && blockedContent.account_data_loaded === false,
      blocked_error: blockedContent.error ?? null,
      proceed_confirmed: proceedContent.proceeded === true,
      continuation_nonce_issued: typeof proceedContent.continuation_nonce === "string" && proceedContent.continuation_nonce.length > 0,
      continuity_required_after_proceed: beforeContinuityContent.error === "continuity_context_required",
      continuity_resolved: typeof continuationContent.continuity_token === "string" && continuationContent.continuity_token.length > 0,
      continuity_capsule_version: (continuationContent.continuity_capsule as Record<string, unknown> | undefined)?.version ?? null,
      allowed_after_continuity: allowedContent.ok === true,
    };
    return {
      ok: response.ok
        && listed.status < 400
        && select.status < 400
        && blocked.status < 400
        && proceed.status < 400
        && beforeContinuity.status < 400
        && continuation.status < 400
        && allowed.status < 400
        && boundaryTest.blocked_before_proceed
        && boundaryTest.proceed_confirmed
        && boundaryTest.continuation_nonce_issued
        && boundaryTest.continuity_required_after_proceed
        && boundaryTest.continuity_resolved
        && boundaryTest.allowed_after_continuity,
      status: response.status,
      initialize: payload?.result ?? null,
      transport_mode: "signed_continuity_token",
      live_tool_count: Array.isArray(listedTools) ? listedTools.length : 0,
      boundary_test: boundaryTest,
    };
  }

  if (toolName === "listEngineeringAudit")`;

index = replaceRegexOnce(
  index,
  /    if \(toolName === "verifyDeployedMcpVersion"\) \{[\s\S]*?\n  \}\n\n  if \(toolName === "listEngineeringAudit"\)/,
  verifierReplacement,
  "live continuity verifier",
);

fs.writeFileSync(indexPath, index);

let tests = fs.readFileSync(testPath, "utf8");
tests = tests.replaceAll('"1.3.0"', '"1.4.0"');
tests = tests.replaceAll('"resilient-canonical-v2"', '"continuity-hardened-v3"');
fs.writeFileSync(testPath, tests);

let workflow = fs.readFileSync(workflowPath, "utf8");
workflow = workflow.replace("permissions:\n  contents: write\n\n", "");
workflow = workflow.replace(/\n      # BEGIN CONTINUITY FINALIZER[\s\S]*?      # END CONTINUITY FINALIZER\n/, "\n");
fs.writeFileSync(workflowPath, workflow);

fs.unlinkSync(selfPath);
