import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src";

const AUTH_HEADERS = {
  Authorization: "Bearer test-gpt-key",
  "Content-Type": "application/json",
};
const MCP_AUTH_HEADERS = {
  Authorization: "Bearer test-mcp-token",
  "Content-Type": "application/json",
};
const BRAND_KEY = "vectrix";
const ALL_BRAND_KEYS = ["manifest_mental", "opmg_deadman", "vectrix"] as const;
type CanonicalBrandKey = typeof ALL_BRAND_KEYS[number];

let mcpSelectedKey: CanonicalBrandKey | null = null;
let mcpProceedConfirmed = false;




async function fetchFromWorker(path: string, init?: RequestInit): Promise<Response> {
  const request = new Request(`https://example.com${path}`, init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function operatorTool<T = Record<string, unknown>>(toolName: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetchFromWorker(`/api/operator/tools/${toolName}`, {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify(payload),
  });
  const data = await response.json() as T & { error?: string };
  expect(response.status, `${toolName}: ${data.error ?? ""}`).toBeLessThan(400);
  return data;
}

async function mcpRequest<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}, id = 1): Promise<T> {
  const response = await fetchFromWorker("/api/operator/mcp", {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const data = await response.json() as { result?: T; error?: { message?: string } };
  expect(response.status, `${method}: ${data.error?.message ?? ""}`).toBeLessThan(400);
  expect(data.error, `${method}: ${data.error?.message ?? ""}`).toBeUndefined();
  return data.result as T;
}

async function mcpToolRaw<T = Record<string, unknown>>(toolName: string, args: Record<string, unknown> = {}): Promise<{ structuredContent: T; isError?: boolean }> {
  return mcpRequest<{ structuredContent: T; isError?: boolean }>("tools/call", {
    name: toolName,
    arguments: args,
  });
}

function testRequestedBrandKey(toolName: string, args: Record<string, unknown>): CanonicalBrandKey | null {
  if (toolName.startsWith("mm_")) {
    return "manifest_mental";
  }
  if (toolName.startsWith("om_")) {
    return "opmg_deadman";
  }
  if (toolName.startsWith("vx_")) {
    return "vectrix";
  }
  const raw = typeof args.brand_key === "string" ? args.brand_key.trim().toLowerCase().replace(/-/g, "_") : "";
  if (raw === "manifest_mental" || raw === "opmg_deadman" || raw === "vectrix") {
    return raw;
  }
  return null;
}

async function ensureMcpAccountOpen(brandKey: CanonicalBrandKey): Promise<void> {
  if (mcpSelectedKey !== brandKey) {
    const selected = await mcpToolRaw<{ selected_key: CanonicalBrandKey }>("selectOperatorKey", { brand_key: brandKey });
    expect(selected.isError).not.toBe(true);
    expect(selected.structuredContent.selected_key).toBe(brandKey);
    mcpSelectedKey = brandKey;
    mcpProceedConfirmed = false;
  }
  if (!mcpProceedConfirmed) {
    const proceeded = await mcpToolRaw<{ proceeded: boolean }>("confirmOperatorProceed", { brand_key: brandKey });
    expect(proceeded.isError).not.toBe(true);
    expect(proceeded.structuredContent.proceeded).toBe(true);
    mcpProceedConfirmed = true;
  }
}

async function mcpTool<T = Record<string, unknown>>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
  const requestedBrand = testRequestedBrandKey(toolName, args);
  let callArgs = args;
  if (requestedBrand && toolName !== "selectOperatorKey" && toolName !== "confirmOperatorProceed") {
    await ensureMcpAccountOpen(requestedBrand);
    callArgs = { ...args, proceed_confirmed: true };
  }
  const result = await mcpToolRaw<T>(toolName, callArgs);
  expect(result.isError, `${toolName} returned MCP isError`).not.toBe(true);
  return result.structuredContent;
}


async function resetTables(): Promise<void> {
    mcpSelectedKey = null;
  mcpProceedConfirmed = false;
  (env as unknown as {
    LENSICALLY_GPT_API_KEY: string;
    LENSICALLY_MCP_ACCESS_TOKEN: string;
    LENSICALLY_MCP_OAUTH_CLIENT_ID: string;
    LENSICALLY_MCP_OAUTH_CLIENT_SECRET?: string;
  }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
  (env as unknown as { LENSICALLY_MCP_ACCESS_TOKEN: string }).LENSICALLY_MCP_ACCESS_TOKEN = "test-mcp-token";
  (env as unknown as { LENSICALLY_MCP_OAUTH_CLIENT_ID: string }).LENSICALLY_MCP_OAUTH_CLIENT_ID = "lensically-operator-mode";
  delete (env as unknown as { LENSICALLY_MCP_OAUTH_CLIENT_SECRET?: string }).LENSICALLY_MCP_OAUTH_CLIENT_SECRET;
    for (const table of [
    "operator_mcp_sessions",
    "operator_mcp_admin_errors",
    "operator_mcp_deployments",
    "operator_mcp_backlog_items",
    "operator_repo_write_sessions",
    "operator_engineering_audit",
    "operator_ops_memory",
    "operator_workflow_requirements",
    "operator_mcp_tool_overrides",
        "operator_gate_results",
    "operator_content_inventory",
    "operator_post_metric_snapshots",
    "operator_source_selections",
        "operator_source_selection_batches",
    "operator_gates",
    "operator_source_cards",
    "operator_source_card_families",

    "operator_production_board_items",

    "operator_context_admissions",
    "operator_workflow_sessions",
    "gpt_generation_drafts",
    "gpt_generation_runs",
    "gpt_strategy_memory",
    "gpt_post_strategy_tags",
    "scheduled_posts",
    "users",
    "external_patterns",
    "threads_posts_archive",
  ]) {
    await env.DB.prepare(`DROP TABLE IF EXISTS ${table}`).run();
  }
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
    `INSERT INTO users (
      id, email, password_hash, email_verified, threads_user_id, threads_username,
      access_token, token_expires_at, is_admin, connection_active, timezone, clock_format, created_at
    )
     VALUES ('workspace-owner', 'workspace@lensically.local', NULL, 1, 'vectrix', 'vectrixvoltmore', 'test-token', 0, 1, 1, 'America/New_York', '12h', 0)`,
  ).run();
}

async function createLockedSourceCard(forbiddenSurfaces: string[] = [], brandKey = BRAND_KEY): Promise<{ sessionId: string; sourceCardId: string; runId: string }> {
  const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", {
    brand_key: brandKey,
  });

    await operatorTool("admit_context", {
        brand_key: brandKey,
    workflow_session_id: session.workflow_session_id,
    admission_scope: "source_card_selection",
    sections: [{ section: "archive_top", returned_count: 1, total_count: 1, limit: 1, offset: 0, source: "existing_db" }],
  });
  let sourceSelectionId: string | undefined;
  if (brandKey === "manifest_mental") {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS external_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_user_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'threads',
        source_url TEXT NOT NULL,
        post_id TEXT,
        post_text TEXT NOT NULL,
        likes INTEGER NOT NULL DEFAULT 0,
        replies INTEGER NOT NULL DEFAULT 0,
        reposts INTEGER NOT NULL DEFAULT 0,
        shares INTEGER NOT NULL DEFAULT 0,
        views INTEGER,
        posted_at TEXT,
        capture_confidence TEXT NOT NULL DEFAULT 'high',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    for (let index = 1; index <= 24; index += 1) {
      await env.DB.prepare(
        `INSERT INTO external_patterns (
          app_user_id, account_id, platform, source_url, post_id, post_text,
          likes, replies, reposts, shares, views, posted_at, capture_confidence, updated_at
        ) VALUES ('lensically', 'manifest-mental', 'threads', ?, ?, ?, ?, 1, 1, 0, 10000, '2026-07-11T12:00:00Z', 'high', CURRENT_TIMESTAMP)`,
      ).bind(
        `https://www.threads.com/@fixture/post/helper-${index}`,
        `helper-${index}`,
        `Manifest helper source ${index}`,
        1000 + index,
      ).run();
    }
    const draw = await operatorTool<{ selections: Array<{ source_selection_id: string }> }>("draw_source_candidate_batch", {
      brand_key: brandKey,
      workflow_session_id: session.workflow_session_id,
    });
    sourceSelectionId = draw.selections[0]?.source_selection_id;
  }
  const card = await operatorTool<{ source_card_id: string }>("create_source_card", {
    brand_key: brandKey,

    workflow_session_id: session.workflow_session_id,
    source_selection_id: sourceSelectionId,
    sequence_label: "source_card_test_001",
    lane_key: "systems",
    title: "Systems source card",
    primary_source: { source_type: "archive_post", source_id: "archive-1", text: "A system makes the work easier." },

    secondary_sources: [],
    anti_sources: [],
        metrics_snapshot: { views: 100, likes: 10 },
    transformation_contract: brandKey === "manifest_mental" ? {
      may_reuse: ["A system"],
      must_transform: ["A system makes the work easier."],
      audience_reward: "A concrete operator benefit.",
    } : undefined,
    source_mechanism: "Turn operational complexity into a clean system advantage.",

    required_product: "A clear operator benefit that feels concrete.",
    forbidden_surfaces: forbiddenSurfaces,
    danger_surfaces: [],
    current_inventory_constraints: [],
    pass_conditions: ["Specific operational payoff."],
    fail_conditions: ["Generic motivation."],
    recommended_direction: "Write one concise systems post.",
  });
    await operatorTool("lock_source_card", { brand_key: brandKey, source_card_id: card.source_card_id });
  const run = await operatorTool<{ run_id: string }>("create_generation_run", {
    brand_key: brandKey,

        source_card_id: card.source_card_id,
    adaptation_plan: {
      adaptation_goal: "Generate one distinct candidate from the locked source card.",
      transformed_elements: ["payoff"],
      intentionally_different_from_prior: "Fixture run has no prior use or creates a new payoff.",
    },
    prompt_summary: "Use the locked source card.",

  });
  return { sessionId: session.workflow_session_id, sourceCardId: card.source_card_id, runId: run.run_id };
}

describe("operator mode backend spine", () => {
  beforeEach(async () => {
    await resetTables();
  }, 30000);

      it("qualifies, randomly draws, persists, and source-card-links Manifest sources", async () => {
    await operatorTool("list_accounts");
    await env.DB.prepare(
      `CREATE TABLE threads_posts_archive (
        threads_user_id TEXT NOT NULL,
        post_id TEXT NOT NULL,
        post_text TEXT,
        post_timestamp TEXT,
        post_permalink TEXT,
        views INTEGER NOT NULL DEFAULT 0,
        likes INTEGER NOT NULL DEFAULT 0,
        replies INTEGER NOT NULL DEFAULT 0,
        reposts INTEGER NOT NULL DEFAULT 0,
        quotes INTEGER NOT NULL DEFAULT 0,
        shares INTEGER NOT NULL DEFAULT 0,
        engagement_total INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (threads_user_id, post_id)
      )`,
    ).run();
    await env.DB.prepare(
      `CREATE TABLE external_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_user_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'threads',
        source_url TEXT NOT NULL,
        post_id TEXT,
        post_text TEXT NOT NULL,
        likes INTEGER NOT NULL DEFAULT 0,
        replies INTEGER NOT NULL DEFAULT 0,
        reposts INTEGER NOT NULL DEFAULT 0,
        shares INTEGER NOT NULL DEFAULT 0,
        views INTEGER,
        posted_at TEXT,
        capture_confidence TEXT NOT NULL DEFAULT 'high',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO threads_posts_archive (
        threads_user_id, post_id, post_text, post_timestamp, post_permalink,
        views, likes, replies, reposts, quotes, shares, engagement_total
      ) VALUES
        ('manifest-mental', 'archive-1500', 'Archive winner', '2026-07-10T12:00:00Z', 'https://www.threads.com/@manifestmental/post/archive-1500', 10000, 1500, 5, 2, 0, 1, 1508),
        ('manifest-mental', 'archive-900', 'Archive below threshold', '2026-07-11T12:00:00Z', 'https://www.threads.com/@manifestmental/post/archive-900', 50000, 900, 2000, 100, 0, 50, 3050)`,
    ).run();
    for (let index = 1; index <= 26; index += 1) {
      await env.DB.prepare(
        `INSERT INTO external_patterns (
          app_user_id, account_id, platform, source_url, post_id, post_text,
          likes, replies, reposts, shares, views, posted_at, capture_confidence, updated_at
        ) VALUES ('lensically', 'manifest-mental', 'threads', ?, ?, ?, ?, 2, 1, 0, 20000, '2026-07-11T12:00:00Z', 'high', CURRENT_TIMESTAMP)`,
      ).bind(
        `https://www.threads.com/@creator/post/pattern-${index}`,
        `pattern-${index}`,
        `Qualified pattern ${index}`,
        1000 + index,
      ).run();
    }
    await env.DB.prepare(
      `INSERT INTO external_patterns (
        app_user_id, account_id, platform, source_url, post_id, post_text,
        likes, replies, reposts, shares, views, posted_at, capture_confidence, updated_at
      ) VALUES ('lensically', 'manifest-mental', 'threads', 'https://www.threads.com/@creator/post/below', 'below', 'Below threshold pattern', 999, 5000, 500, 100, 60000, '2026-07-11T12:00:00Z', 'high', CURRENT_TIMESTAMP)`,
    ).run();

    const listed = await mcpTool<{
      candidates: Array<{
        source_candidate_id: string;
        source_identity_key: string;
        metrics: { likes: number };
        eligibility: { threshold: number; qualified: boolean };
        factor_1_rank?: number;
      }>;
      total_count: number;
      eligibility_min_likes: number;
    }>("list_source_candidates", {
      brand_key: "manifest_mental",
      limit: 100,
      offset: 0,
    });

    expect(listed.total_count).toBe(27);
    expect(listed.eligibility_min_likes).toBe(1000);
    expect(listed.candidates.every((candidate) => candidate.metrics.likes >= 1000)).toBe(true);
    expect(listed.candidates.every((candidate) => candidate.eligibility.qualified)).toBe(true);
    expect(listed.candidates.every((candidate) => candidate.factor_1_rank === undefined)).toBe(true);

    const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", {
      brand_key: "manifest_mental",
    });
    const draw = await operatorTool<{
      source_batch_id: string;
      selected_count: number;
      qualified_pool_count: number;
      posting_order_source: string;
      cross_day_cooldown_applied: boolean;
      selections: Array<{
        source_selection_id: string;
        draw_order: number;
        source_identity_key: string;
        metrics_snapshot: { likes: number; captured_at: string };
      }>;
    }>("draw_source_candidate_batch", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
    });

    expect(draw.selected_count).toBe(24);
    expect(draw.qualified_pool_count).toBe(27);
    expect(draw.posting_order_source).toBe("draw_order");
    expect(draw.cross_day_cooldown_applied).toBe(false);
    expect(draw.selections.map((selection) => selection.draw_order)).toEqual(Array.from({ length: 24 }, (_, index) => index + 1));
    expect(new Set(draw.selections.map((selection) => selection.source_identity_key)).size).toBe(24);
    expect(draw.selections.every((selection) => selection.metrics_snapshot.likes >= 1000)).toBe(true);

    const persisted = await operatorTool<{
      selections: Array<{ source_selection_id: string; draw_order: number }>;
    }>("get_source_candidate_batch", {
      brand_key: "manifest_mental",
      source_batch_id: draw.source_batch_id,
    });
    expect(persisted.selections.map((selection) => selection.source_selection_id)).toEqual(
      draw.selections.map((selection) => selection.source_selection_id),
    );
    expect(persisted.selections.map((selection) => selection.draw_order)).toEqual(Array.from({ length: 24 }, (_, index) => index + 1));

    const first = draw.selections[0];
    const card = await operatorTool<{ source_card_id: string; source_selection_id: string }>("create_source_card", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      source_selection_id: first.source_selection_id,
      title: "Random draw source card",
      source_mechanism: "Extract and rebuild the audience reward.",
      required_product: "One original Manifest Mental post.",
      forbidden_surfaces: [],
      pass_conditions: ["Preserves the audience payoff."],
      fail_conditions: ["Copies the source wording."],
    });
    expect(card.source_selection_id).toBe(first.source_selection_id);

    const storedCard = await operatorTool<{
      source_card: { primary_source: Record<string, unknown>; metrics_snapshot: { likes: number } };
    }>("get_source_card", {
      brand_key: "manifest_mental",
      source_card_id: card.source_card_id,
    });
    expect(storedCard.source_card.primary_source.source_selection_id).toBe(first.source_selection_id);
    expect(storedCard.source_card.metrics_snapshot.likes).toBe(first.metrics_snapshot.likes);

    const duplicateResponse = await fetchFromWorker("/api/operator/tools/create_source_card", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        brand_key: "manifest_mental",
        workflow_session_id: session.workflow_session_id,
        source_selection_id: first.source_selection_id,
        title: "Duplicate card",
        source_mechanism: "Duplicate",
        required_product: "Duplicate",
        forbidden_surfaces: [],
        pass_conditions: [],
        fail_conditions: [],
      }),
    });
    expect(duplicateResponse.status).toBe(400);
  }, 30000);

  it("preserves a Saved Pattern ID across Threads URL and username changes", async () => {
    const firstResponse = await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        app_user_id: "lensically",
        account_id: "manifest-mental",
        source_url: "https://www.threads.net/@oldname/post/ABC123?xmt=example",
        post_text: "The same source post.",
        likes: 1200,
        views: 10000,
        posted_at: "2026-07-10T12:00:00Z",
        capture_confidence: "high",
      }),
    });
    expect(firstResponse.status).toBe(200);
    const first = await firstResponse.json() as { pattern: { id: number; post_id: string; source_url: string; likes: number } };

    const secondResponse = await fetchFromWorker("/api/patterns/import", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        app_user_id: "lensically",
        account_id: "manifest-mental",
        source_url: "https://threads.com/@newname/post/ABC123/",
        post_text: "The same source post refreshed.",
        likes: 2500,
        views: 20000,
        posted_at: "2026-07-10T12:00:00Z",
        capture_confidence: "high",
      }),
    });
    expect(secondResponse.status).toBe(200);
    const second = await secondResponse.json() as { pattern: { id: number; post_id: string; source_url: string; likes: number } };

    expect(second.pattern.id).toBe(first.pattern.id);
    expect(second.pattern.post_id).toBe("ABC123");
    expect(second.pattern.likes).toBe(2500);
    expect(second.pattern.source_url).toBe("https://www.threads.com/@newname/post/ABC123");
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM external_patterns WHERE app_user_id = 'lensically' AND account_id = 'manifest-mental'`,
    ).first<{ total: number }>();
    expect(Number(count?.total ?? 0)).toBe(1);
  }, 30000);


  it("runs the source-card to approved schedule path", async () => {
    const { sourceCardId, runId } = await createLockedSourceCard();
    const draft = await operatorTool<{ draft_id: string; showable: boolean }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: runId,
      source_card_id: sourceCardId,
      text: "Your systems are about to make the busy work feel optional.",
      draft_index: 1,
      strategy: { pillar: "systems", hook_style: "direct_claim" },
      draft_analysis: { opening_phrase: "Your systems are about to", realm_entrance_key: "systems_about_to", hook_style: "direct_claim", lane_key: "systems" },
    });
    expect(draft.showable).toBe(true);

    await operatorTool("mark_draft_shown", { brand_key: BRAND_KEY, draft_id: draft.draft_id });
    const approval = await operatorTool<{ status: string; memory_id: number }>("approve_draft", {
      brand_key: BRAND_KEY,
      draft_id: draft.draft_id,
      feedback_note: "Concrete enough for the operator systems lane.",
      strategy: { pillar: "systems" },
    });
    expect(approval.status).toBe("approved");
    expect(approval.memory_id).toBeTruthy();

    const scheduled = await operatorTool<{ status: string; scheduled_post_id: number }>("schedule_approved_draft", {
      brand_key: BRAND_KEY,
      draft_id: draft.draft_id,
      date: "2099-01-01",
      time: "09:00",
      timezone: "America/New_York",
      strategy: { pillar: "systems" },
    });
        expect(scheduled.status).toBe("scheduled");
    expect(scheduled.scheduled_post_id).toBeTruthy();

    const publishedPostId = "published-lineage-1";
    await env.DB.prepare(
      `UPDATE scheduled_posts
       SET status = 'posted', published_post_id = ?, published_at = '2099-01-01T14:00:00Z'
       WHERE id = ?`,
    ).bind(publishedPostId, scheduled.scheduled_post_id).run();
    await env.DB.prepare(
      `UPDATE gpt_generation_drafts
       SET status = 'published', published_post_id = ?
       WHERE id = ?`,
    ).bind(publishedPostId, draft.draft_id).run();

    const beforeSync = await operatorTool<{ warning: string | null }>("get_post_results", {
      brand_key: BRAND_KEY,
      published_post_id: publishedPostId,
      include_history: true,
    });
    expect(beforeSync.warning).toContain("synced Threads metrics");

    await env.DB.prepare(
      `INSERT INTO threads_posts_archive (
        threads_user_id, post_id, post_text, post_timestamp, post_permalink, post_username,
        views, likes, replies, reposts, quotes, shares, engagement_total,
        first_seen_at, last_seen_at, last_synced_at
      ) VALUES (?, ?, ?, '2099-01-01T14:00:00Z', ?, 'vectrixvoltmore', 12000, 1400, 20, 10, 2, 4, 1436,
                '2099-01-01T14:00:00Z', '2099-01-02T14:00:00Z', '2099-01-02T14:00:00Z')`,
    ).bind(
      BRAND_KEY,
      publishedPostId,
      "Your systems are about to make the busy work feel optional.",
      `https://www.threads.com/@vectrixvoltmore/post/${publishedPostId}`,
    ).run();

    const results = await operatorTool<{
      metrics: { likes: number; views: number };
      lineage: {
        source_card_id: string;
        generation_run_id: string;
        draft_id: string;
        scheduled_post_id: number;
        published_post_id: string;
      };
      metric_history: Array<{ metrics: { likes: number } }>;
    }>("get_post_results", {
      brand_key: BRAND_KEY,
      published_post_id: publishedPostId,
      include_history: true,
    });
    expect(results.metrics.likes).toBe(1400);
    expect(results.metrics.views).toBe(12000);
    expect(results.lineage.source_card_id).toBe(sourceCardId);
    expect(results.lineage.generation_run_id).toBe(runId);
    expect(results.lineage.draft_id).toBe(draft.draft_id);
    expect(results.lineage.scheduled_post_id).toBe(scheduled.scheduled_post_id);
    expect(results.lineage.published_post_id).toBe(publishedPostId);
    expect(results.metric_history.at(-1)?.metrics.likes).toBe(1400);
  }, 30000);


  it("blocks showing a draft that repeats the latest realm entrance", async () => {
    const first = await createLockedSourceCard();
    const shown = await operatorTool<{ draft_id: string }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: first.runId,
      source_card_id: first.sourceCardId,
      text: "Imagine your workflow finally stops leaking time.",
      draft_analysis: { opening_phrase: "Imagine your workflow", realm_entrance_key: "imagine", lane_key: "systems" },
    });
    await operatorTool("mark_draft_shown", { brand_key: BRAND_KEY, draft_id: shown.draft_id });

    const second = await createLockedSourceCard();
    const blocked = await operatorTool<{ draft_id: string; showable: boolean; blocking_failures: Array<{ gate_key: string }> }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: second.runId,
      source_card_id: second.sourceCardId,
      text: "Imagine your calendar finally respecting your attention.",
      draft_analysis: { opening_phrase: "Imagine your calendar", realm_entrance_key: "imagine", lane_key: "systems" },
    });
    expect(blocked.showable).toBe(false);
    expect(blocked.blocking_failures.some((failure) => failure.gate_key === "current_inventory_repeat_gate")).toBe(true);

    const response = await fetchFromWorker("/api/operator/tools/mark_draft_shown", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ brand_key: BRAND_KEY, draft_id: blocked.draft_id }),
    });
    expect(response.status).toBe(400);
  }, 30000);

  it("blocks drafts that copy forbidden source surfaces", async () => {
    const { sourceCardId, runId } = await createLockedSourceCard(["making your life easier"]);
    const draft = await operatorTool<{ showable: boolean; blocking_failures: Array<{ gate_key: string }> }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: runId,
      source_card_id: sourceCardId,
      text: "The right system starts making your life easier before the week gets loud.",
      draft_analysis: { opening_phrase: "The right system starts", realm_entrance_key: "right_system", lane_key: "systems" },
    });
    expect(draft.showable).toBe(false);
    expect(draft.blocking_failures.some((failure) => failure.gate_key === "source_surface_copy_gate")).toBe(true);
  }, 30000);

  it("rejects scheduling a candidate draft", async () => {
    const { sourceCardId, runId } = await createLockedSourceCard();
    const draft = await operatorTool<{ draft_id: string }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: runId,
      source_card_id: sourceCardId,
      text: "A better system gives every good idea somewhere to land.",
      draft_analysis: { opening_phrase: "A better system gives", realm_entrance_key: "better_system", lane_key: "systems" },
    });

    const response = await fetchFromWorker("/api/operator/tools/schedule_approved_draft", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        brand_key: BRAND_KEY,
        draft_id: draft.draft_id,
        date: "2099-01-01",
        time: "10:00",
        timezone: "America/New_York",
      }),
    });
    const data = await response.json() as { blocking_failures?: Array<{ gate_key: string }> };
    expect(response.status).toBe(400);
    expect(data.blocking_failures?.some((failure) => failure.gate_key === "approved_before_schedule_gate")).toBe(true);
  }, 30000);

    it("rejects unsupported saved-workflow batch shapes for every brand", async () => {
    for (const brandKey of ALL_BRAND_KEYS) {
      const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", {
        brand_key: brandKey,
      });
      const sourceResponse = await fetchFromWorker("/api/operator/tools/create_source_card", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          brand_key: brandKey,
          workflow_session_id: session.workflow_session_id,
          sequence_label: "universal_batch_guard_001",
          title: "Twenty-four post batch fixture",
          primary_source: { source_type: "archive_post", source_id: "archive-1", text: "A system makes the work easier." },
          source_mechanism: "Generate 24 post batch from one source card.",
          required_product: "Twenty four candidate posts for review.",
          forbidden_surfaces: [],
          pass_conditions: ["Specific operational payoff."],
          fail_conditions: ["Generic motivation."],
          recommended_direction: "Generate 24 candidates at once.",
        }),
      });
      const sourceData = await sourceResponse.json() as { error?: string };
      expect(sourceResponse.status, brandKey).toBe(400);
      expect(sourceData.error).toBe("lensically_saved_workflow_required");

      const { sourceCardId } = await createLockedSourceCard([], brandKey);
      const runResponse = await fetchFromWorker("/api/operator/tools/create_generation_run", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          brand_key: brandKey,
          source_card_id: sourceCardId,
          objective: "Generate 24 candidate posts",
          prompt_summary: "Batch generation fixture.",
        }),
      });
      const runData = await runResponse.json() as { error?: string };
      expect(runResponse.status, brandKey).toBe(400);
      expect(runData.error).toBe("lensically_saved_workflow_required");
    }
  }, 40000);

  it("caps each source-card generation run for every brand", async () => {
    for (const brandKey of ALL_BRAND_KEYS) {
      const { sourceCardId, runId } = await createLockedSourceCard([], brandKey);
      for (const text of [
        "A clean system gives the first good idea somewhere useful to land.",
        "A better workflow makes the second useful idea easier to repeat.",
      ]) {
        const draft = await operatorTool<{ draft_id: string }>("submit_candidate_draft", {
          brand_key: brandKey,
          run_id: runId,
          source_card_id: sourceCardId,
          text,
          draft_analysis: { opening_phrase: text.split(" ").slice(0, 4).join(" "), realm_entrance_key: text.slice(0, 12), lane_key: "systems" },
        });
        expect(draft.draft_id).toBeTruthy();
      }
      const blocked = await fetchFromWorker("/api/operator/tools/submit_candidate_draft", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          brand_key: brandKey,
          run_id: runId,
          source_card_id: sourceCardId,
          text: "A third draft should require the next source-card loop.",
          draft_analysis: { opening_phrase: "A third draft", realm_entrance_key: "third_draft", lane_key: "systems" },
        }),
      });
      const blockedData = await blocked.json() as { error?: string; existing_draft_count?: number };
      expect(blocked.status, brandKey).toBe(400);
      expect(blockedData.error).toBe("lensically_saved_workflow_required");
      expect(blockedData.existing_draft_count).toBe(2);
    }
  }, 40000);

  it("keeps account-specific gates scoped to their brand", async () => {

    const gate = await operatorTool<{ gate_id: string }>("create_or_update_gate", {
      brand_key: BRAND_KEY,
      gate_key: "offer_specificity_gate",
      display_name: "Offer Specificity",
      description: "Vectrix offer posts need a concrete business/product object.",
      stage_scope: "gate_evaluation",
      lane_scope: "offers",
      gate_type: "hybrid",
      severity: "block",
      evaluator: "hybrid",
      active: true,
      order_index: 50,
    });
    expect(gate.gate_id).toBeTruthy();

    const vectrixGates = await operatorTool<{ gates: Array<{ gate_key: string }> }>("list_active_gates", {
      brand_key: BRAND_KEY,
      stage_scope: "gate_evaluation",
      lane_key: "offers",
    });
    expect(vectrixGates.gates.some((item) => item.gate_key === "offer_specificity_gate")).toBe(true);

    const manifestResponse = await fetchFromWorker("/api/operator/tools/list_active_gates", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ brand_key: "manifest_mental", stage_scope: "gate_evaluation", lane_key: "offers" }),
    });
    if (manifestResponse.status < 400) {
      const manifestGates = await manifestResponse.json() as { gates: Array<{ gate_key: string }> };
      expect(manifestGates.gates.some((item) => item.gate_key === "offer_specificity_gate")).toBe(false);
    }
  }, 30000);
});

describe("operator mode MCP endpoint", () => {
  beforeEach(async () => {
    await resetTables();
  }, 30000);

  it("supports ChatGPT app OAuth code exchange for the MCP token", async () => {
    const metadataResponse = await fetchFromWorker("/.well-known/oauth-authorization-server", { method: "GET" });
    const metadata = await metadataResponse.json() as { authorization_endpoint?: string; token_endpoint?: string; token_endpoint_auth_methods_supported?: string[] };
    expect(metadataResponse.status).toBe(200);
    expect(metadata.authorization_endpoint).toBe("https://api.lensically.com/api/operator/oauth/authorize");
    expect(metadata.token_endpoint).toBe("https://api.lensically.com/api/operator/oauth/token");
    expect(metadata.token_endpoint_auth_methods_supported).toContain("none");

    const redirectUri = "https://chatgpt.com/connector/oauth/test-callback";
    const authorizeUrl = `/api/operator/oauth/authorize?response_type=code&client_id=lensically-operator-mode&redirect_uri=${encodeURIComponent(redirectUri)}&state=state-fixture&scope=operator_mode`;
    const authorizeResponse = await fetchFromWorker(authorizeUrl, { method: "GET", redirect: "manual" });
    expect(authorizeResponse.status).toBe(302);
    const location = authorizeResponse.headers.get("location") ?? "";
    const callback = new URL(location);
    expect(callback.origin + callback.pathname).toBe(redirectUri);
    expect(callback.searchParams.get("state")).toBe("state-fixture");
    const code = callback.searchParams.get("code");
    expect(code).toBeTruthy();

    const tokenResponse = await fetchFromWorker("/api/operator/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: "lensically-operator-mode",
        redirect_uri: redirectUri,
        code: code ?? "",
      }).toString(),
    });
    const token = await tokenResponse.json() as { access_token?: string; token_type?: string };
    expect(tokenResponse.status).toBe(200);
    expect(token.access_token).toBe("test-mcp-token");
    expect(token.token_type).toBe("Bearer");

    const initialized = await fetchFromWorker("/api/operator/mcp", {
      method: "POST",
      headers: MCP_AUTH_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "vitest", version: "1.0.0" } },
      }),
    });
    const initializedBody = await initialized.json() as { result?: { serverInfo?: { name?: string } } };
    expect(initialized.status).toBe(200);
    expect(initializedBody.result?.serverInfo?.name).toBe("lensically-operator-mode");
  }, 30000);

  it("lists required MCP tools and Lensically accounts", async () => {
    const initialized = await mcpRequest<{ serverInfo: { name: string }; capabilities: Record<string, unknown>; instructions: string }>("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    expect(initialized.serverInfo.name).toBe("lensically-operator-mode");

    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    const toolNames = listed.tools.map((tool) => tool.name);
    expect(initialized.instructions).toContain("Initial key-selection stop");
    expect(initialized.instructions).toContain("Selected key: <selected_key>");
    expect(initialized.instructions).toContain(`Full tool surface loaded: ${toolNames.length} tools available and usable.`);
                expect(initialized.instructions).toContain("Only after the user explicitly approves proceeding, call confirmOperatorProceed.");
    expect(initialized.instructions).toContain("include proceed_confirmed=true on account-scoped calls");
    expect(toolNames.slice(0, 24)).toEqual([
      "getOperatorStartupContext",
      "engineeringPrecheck",
      "getEngineeringAccessState",
      "listRepoFiles",
      "readRepoFile",
      "searchRepoFiles",
      "getRepoStatus",
      "applyRepoTextPatch",
      "startRepoFileWrite",
      "appendRepoFileChunk",
      "commitRepoFileWrite",
      "createRepoFile",
      "deleteRepoFile",
      "listGitHubWorkflowRuns",
      "runGitHubWorkflow",
      "getGitHubWorkflowRun",
      "deployBackend",
      "verifyDeployedMcpVersion",
      "listEngineeringAudit",
      "listOpsMemory",
      "readOpsMemory",
      "recordOpsMemory",
      "updateOpsMemory",
      "searchOpsMemory",
    ]);
        expect(toolNames.slice(24, 48)).toEqual([
      "selectOperatorKey",
      "confirmOperatorProceed",
      "getMcpAdminState",
      "inspectMcpFailure",
      "listMcpTools",
      "runEngineeringTool",
      "readMcpToolDefinition",
      "updateMcpToolSchema",
      "updateMcpToolBehavior",
      "createMcpTool",
      "disableMcpTool",
      "runMcpTests",
      "deployMcpChanges",
      "rollbackMcpChanges",
      "getWorkflowStatus",
      "updateWorkflowRequirement",
      "advanceWorkflowStage",
      "prepareFullPreflight",
      "updateGate",
      "runGateSuite",
      "submitAndGateDraft",
      "createImplementationBacklogItem",
      "listImplementationBacklogItems",
      "markImplementationBacklogItemResolved",
    ]);
    for (const name of [
      "getOperatorStartupContext",
      "engineeringPrecheck",
      "getEngineeringAccessState",
      "listRepoFiles",
      "readRepoFile",
      "searchRepoFiles",
      "getRepoStatus",
      "applyRepoTextPatch",
      "startRepoFileWrite",
      "appendRepoFileChunk",
      "commitRepoFileWrite",
      "createRepoFile",
      "deleteRepoFile",
      "listGitHubWorkflowRuns",
      "runGitHubWorkflow",
      "getGitHubWorkflowRun",
      "deployBackend",
      "verifyDeployedMcpVersion",
      "listEngineeringAudit",
      "listOpsMemory",
      "readOpsMemory",
      "recordOpsMemory",
      "updateOpsMemory",
      "searchOpsMemory",
      "list_accounts",
      "get_account_state",
      "start_workflow_session",
      "admit_context",
      "get_production_board",
      "list_source_candidates",
      "create_source_card",
      "lock_source_card",
      "get_source_card",
      "create_generation_run",
      "run_gates",
      "submit_candidate_draft",
      "mark_draft_shown",
      "save_self_rejected_draft",
      "approve_draft",
      "reject_draft",
      "list_active_gates",
      "create_or_update_gate",
      "promote_memory_to_gate",
      "list_strategy_memory",
      "save_strategy_memory",
      "list_scheduled_posts",
      "schedule_approved_draft",
            "get_post_results",
      "selectOperatorKey",
      "confirmOperatorProceed",
      "getMcpAdminState",
      "inspectMcpFailure",
      "listMcpTools",
      "runEngineeringTool",
      "readMcpToolDefinition",
      "updateMcpToolSchema",
      "updateMcpToolBehavior",
      "createMcpTool",
      "disableMcpTool",
      "runMcpTests",
      "deployMcpChanges",
      "rollbackMcpChanges",
      "getWorkflowStatus",
      "updateWorkflowRequirement",
      "advanceWorkflowStage",
      "prepareFullPreflight",
      "updateGate",
      "runGateSuite",
      "submitAndGateDraft",
      "createImplementationBacklogItem",
      "listImplementationBacklogItems",
      "markImplementationBacklogItemResolved",
    ]) {
      expect(toolNames).toContain(name);
    }

        const accounts = await mcpTool<{ accounts: Array<{ brand_key: string }> }>("list_accounts");
    expect(accounts.accounts.map((account) => account.brand_key)).toEqual(expect.arrayContaining(["manifest_mental", "opmg_deadman", "vectrix"]));
  }, 30000);

  it("loads compact non-account startup bootstrap in a fresh session", async () => {
    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    const direct = await mcpTool<{
      bootstrap_version: string;
      account_data_loaded: boolean;
      no_account_sections_present: boolean;
      tool_surface: { total_tools: number; engineering_tools: string[]; admin_tools: string[]; account_wrapper_tools: string[] };
      repository: { repo: string; branch: string };
      runtime: { mcp_version: string };
      source_documents: Array<{ path: string; excerpt: string; truncated: boolean }>;
      ops_memory: Array<Record<string, unknown>>;
      mandatory_fallback_execution_routes: string[];
      universal_workflow_requirements: Array<{ stage: string; required_sections: string[] }>;
      boundary: { first_key_response_template: string[]; before_proceed_forbidden: string[] };
      open_implementation_backlog: Array<Record<string, unknown>>;
    }>("getOperatorStartupContext");
    expect(direct.bootstrap_version).toBe("operator-startup-v1");
    expect(direct.tool_surface.total_tools).toBe(listed.tools.length);
    expect(direct.account_data_loaded).toBe(false);
    expect(direct.no_account_sections_present).toBe(true);
    expect(direct.repository.repo).toBe("Lensically");
    expect(direct.repository.branch).toBe("main");
    expect(direct.runtime.mcp_version).toBe("1.1.0");
    expect(direct.source_documents.map((doc) => doc.path)).toEqual(["AGENTS.md", "CURRENT_STATE.md", "OPERATING_MEMORY.md"]);
    expect(direct.source_documents.every((doc) => doc.excerpt.length <= 6000)).toBe(true);
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("runEngineeringTool");
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("listMcpTools");
    expect(direct.boundary.before_proceed_forbidden).toEqual(expect.arrayContaining(["account_state", "workflow_status", "source_cards", "drafts", "scheduled_posts", "account_gates", "strategy_memory", "account_metrics"]));
    expect(JSON.stringify(direct)).not.toContain("scheduled_posts_count");
    expect(JSON.stringify(direct)).not.toContain("latest_context_admission");
    expect(direct.universal_workflow_requirements.some((item) => item.stage === "context_admission" && item.required_sections.includes("operator_precheck"))).toBe(true);
  }, 30000);

  it("reuses startup bootstrap through engineeringPrecheck and fallback bridges", async () => {
    const direct = await mcpTool<{ tool_surface: { total_tools: number } }>("getOperatorStartupContext");
    const precheck = await mcpTool<{ startup_context: { tool_surface: { total_tools: number } }; recent_ops_memory: Array<Record<string, unknown>> }>("engineeringPrecheck");
    expect(precheck.startup_context.tool_surface.total_tools).toBe(direct.tool_surface.total_tools);

    const runBridge = await mcpTool<{ executed_tool: string; result: { tool_surface: { total_tools: number } } }>("runEngineeringTool", {
      tool_name: "getOperatorStartupContext",
      arguments: {},
    });
    expect(runBridge.executed_tool).toBe("getOperatorStartupContext");
    expect(runBridge.result.tool_surface.total_tools).toBe(direct.tool_surface.total_tools);

    const listBridge = await mcpTool<{ executed_tool: string; result: { tool_surface: { total_tools: number } } }>("listMcpTools", {
      execute_tool: "getOperatorStartupContext",
      arguments: {},
    });
    expect(listBridge.executed_tool).toBe("getOperatorStartupContext");
    expect(listBridge.result.tool_surface.total_tools).toBe(direct.tool_surface.total_tools);
  }, 30000);

    it("preserves the exact initial key handshake for all canonical keys", async () => {
    await mcpRequest("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    const startup = await mcpTool<{ boundary: { first_key_response_template: string[] }; tool_surface: { total_tools: number } }>("getOperatorStartupContext");
    for (const key of ALL_BRAND_KEYS) {
      const selected = await mcpToolRaw<{ handshake: string[]; tool_count: number; account_data_loaded: boolean }>("selectOperatorKey", { brand_key: key });
      expect(selected.isError).not.toBe(true);
      expect(selected.structuredContent.account_data_loaded).toBe(false);
      expect(selected.structuredContent.tool_count).toBe(startup.tool_surface.total_tools);
      expect(selected.structuredContent.handshake).toEqual([
        "Lensically Operator Mode MCP is active.",
        `Selected key: ${key}`,
        `Full tool surface loaded: ${startup.tool_surface.total_tools} tools available and usable.`,
        "Proceed to the next step?",
      ]);
      expect(selected.structuredContent.handshake).toEqual(startup.boundary.first_key_response_template.map((line) => line.replace("<canonical_brand_key>", key)));
    }
  }, 30000);

      it("bridges handshake tools through listMcpTools when the app cache is stale", async () => {
    await mcpRequest("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    const selected = await mcpToolRaw<{ executed_tool: string; result: { selected_key: CanonicalBrandKey; handshake: string[] } }>("listMcpTools", {
      execute_tool: "selectOperatorKey",
      arguments: { brand_key: "manifest_mental" },
    });
    expect(selected.isError).not.toBe(true);
    expect(selected.structuredContent.executed_tool).toBe("selectOperatorKey");
    expect(selected.structuredContent.result.selected_key).toBe("manifest_mental");
    expect(selected.structuredContent.result.handshake).toHaveLength(4);

    const blocked = await mcpToolRaw<{ error: string; account_data_loaded: boolean }>("getWorkflowStatus", {
      brand_key: "manifest_mental",
    });
    expect(blocked.isError).toBe(true);
    expect(blocked.structuredContent).toMatchObject({ error: "explicit_proceed_required", account_data_loaded: false });

        const proceeded = await mcpToolRaw<{ executed_tool: string; result: { proceeded: boolean } }>("listMcpTools", {
      execute_tool: "confirmOperatorProceed",
      arguments: { brand_key: "manifest_mental" },
    });
    expect(proceeded.isError).not.toBe(true);
    expect(proceeded.structuredContent.executed_tool).toBe("confirmOperatorProceed");
    expect(proceeded.structuredContent.result.proceeded).toBe(true);

        const allowed = await mcpToolRaw<{ ok: boolean }>("getWorkflowStatus", { brand_key: "manifest_mental", proceed_confirmed: true });
    expect(allowed.isError).not.toBe(true);
    expect(allowed.structuredContent.ok).toBe(true);
  }, 30000);

  it("server-blocks selected account context until explicit proceed", async () => {
    await mcpRequest("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    const startup = await mcpTool<{ account_data_loaded: boolean }>("getOperatorStartupContext");
    expect(startup.account_data_loaded).toBe(false);

    const selected = await mcpToolRaw<{ selected_key: CanonicalBrandKey; account_data_loaded: boolean }>("selectOperatorKey", { brand_key: BRAND_KEY });
    expect(selected.isError).not.toBe(true);
    expect(selected.structuredContent.selected_key).toBe(BRAND_KEY);
    expect(selected.structuredContent.account_data_loaded).toBe(false);

    const blocked = await mcpToolRaw<{ error: string; account_data_loaded: boolean; required_next_tool: string }>("getWorkflowStatus", {
      brand_key: BRAND_KEY,
    });
    expect(blocked.isError).toBe(true);
    expect(blocked.structuredContent).toMatchObject({
      error: "explicit_proceed_required",
      account_data_loaded: false,
      required_next_tool: "confirmOperatorProceed",
    });

        const proceeded = await mcpToolRaw<{ proceeded: boolean; account_data_loaded: boolean }>("confirmOperatorProceed", { brand_key: BRAND_KEY });
    expect(proceeded.isError).not.toBe(true);
    expect(proceeded.structuredContent).toMatchObject({ proceeded: true, account_data_loaded: false });

                const preflight = await mcpToolRaw<{ complete: boolean; sections: Array<{ section: string; limit: number; source: string; coverage_status: string }> }>("prepareFullPreflight", {
      brand_key: BRAND_KEY,
      proceed_confirmed: true,
    });
    expect(preflight.isError).not.toBe(true);
    expect(preflight.structuredContent.complete).toBe(true);
    expect(preflight.structuredContent.sections.map((section) => section.section)).toEqual(expect.arrayContaining(["account_state", "source_candidates", "scheduled_posts", "active_gates"]));
    expect(preflight.structuredContent.sections.find((section) => section.section === "account_state")).toMatchObject({
      source: "active_operator_session",
      coverage_status: "complete",
    });
        expect(preflight.structuredContent.sections.find((section) => section.section === "source_candidates")).toMatchObject({
      source: "direct_db_count",
      coverage_status: "complete",
    });
    expect(preflight.structuredContent.sections.find((section) => section.section === "strategy_memory")).toMatchObject({
      source: "direct_db_count",
      coverage_status: "complete",
    });
  }, 30000);

  it("returns structured JSON-RPC errors for handler exceptions", async () => {
    await env.DB.prepare(`DROP TABLE IF EXISTS operator_workflow_requirements`).run();
    await env.DB.prepare(`CREATE TABLE operator_workflow_requirements (bad_column TEXT)`).run();
    const response = await fetchFromWorker("/api/operator/mcp", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ jsonrpc: "2.0", id: 501, method: "tools/call", params: { name: "getOperatorStartupContext", arguments: {} } }),
    });
    const payload = await response.json() as { error?: { code: number; message: string } };
    expect(response.status).toBe(500);
    expect(payload.error).toMatchObject({ code: -32603 });
    expect(payload.error?.message).toContain("Internal MCP error");
  }, 30000);

  it("seeds initial context admission as key-handshake only before account work", async () => {
    const state = await mcpTool<{ workflow_requirements: Array<{ stage: string; required_sections: string[]; completion_rule: string }> }>("getMcpAdminState");
    const contextRequirement = state.workflow_requirements.find((item) => item.stage === "context_admission");
    expect(contextRequirement).toMatchObject({
      required_sections: ["operator_precheck"],
      completion_rule: "key_handshake_complete_before_account_work",
    });
  }, 30000);

  it("repairs stale context admission requirements without loading account work first", async () => {
    await mcpTool("getMcpAdminState");
    await env.DB.prepare(
      `UPDATE operator_workflow_requirements
       SET required_sections_json = ?,
           completion_rule = 'all_required_sections_complete'
       WHERE stage = 'context_admission'`,
    ).bind(JSON.stringify(["operator_precheck", "account_state", "workflow_status_if_needed"])).run();

    const state = await mcpTool<{ workflow_requirements: Array<{ stage: string; required_sections: string[]; completion_rule: string }> }>("getMcpAdminState");
    const contextRequirement = state.workflow_requirements.find((item) => item.stage === "context_admission");
    expect(contextRequirement).toMatchObject({
      required_sections: ["operator_precheck"],
      completion_rule: "key_handshake_complete_before_account_work",
    });
  }, 30000);

  it("bridges scoped account wrappers without brand-key payloads", async () => {
    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    const toolNames = listed.tools.map((tool) => tool.name);
    for (const name of ["mm_get_account_state", "om_get_account_state", "vx_get_account_state"]) {
      expect(toolNames).toContain(name);
    }
    const manifest = await mcpTool<{ brand_key: string }>("mm_get_account_state");
    expect(manifest.brand_key).toBe("manifest_mental");
    const opmg = await mcpTool<{ brand_key: string }>("om_get_account_state");
    expect(opmg.brand_key).toBe("opmg_deadman");
    const vectrix = await mcpTool<{ brand_key: string }>("vx_get_account_state");
    expect(vectrix.brand_key).toBe("vectrix");
  }, 30000);


  it("exposes engineering access status and ops memory without raw secrets", async () => {
    const access = await mcpTool<{ github: { token_status: string; owner: string; repo: string }; capabilities: string[] }>("getEngineeringAccessState");
    expect(access.github.token_status).toMatch(/exists|missing/);
    expect(JSON.stringify(access)).not.toContain("test-gpt-key");
    expect(access.capabilities).toContain("applyRepoTextPatch");

    const memory = await mcpTool<{ memory_id: string }>("recordOpsMemory", {
      title: "Vitest MCP engineering fixture",
      problem: "Tool payloads can get too large.",
      fix: "Use exact text patches or chunked writes.",
      applies_when: "Editing source through MCP.",
      tags: ["engineering", "mcp"],
    });
    expect(memory.memory_id).toBeTruthy();

    const searched = await mcpTool<{ items: Array<{ id: string }> }>("searchOpsMemory", {
      query: "chunked writes",
    });
    expect(searched.items.some((item) => item.id === memory.memory_id)).toBe(true);

    const precheck = await mcpTool<{ tool_surface: { engineering_tools: number }; recent_ops_memory: Array<{ id: string }> }>("engineeringPrecheck");
    expect(precheck.tool_surface.engineering_tools).toBeGreaterThanOrEqual(20);
    expect(precheck.recent_ops_memory.some((item) => item.id === memory.memory_id)).toBe(true);

    const bridged = await mcpTool<{ executed_tool: string; result: { github: { token_status: string } } }>("runEngineeringTool", {
      tool_name: "getEngineeringAccessState",
      arguments: {},
    });
    expect(bridged.executed_tool).toBe("getEngineeringAccessState");
    expect(bridged.result.github.token_status).toMatch(/exists|missing/);

    const listBridge = await mcpTool<{ executed_tool: string; result: { tool_surface: { engineering_tools: number } } }>("listMcpTools", {
      execute_tool: "engineeringPrecheck",
      arguments: {},
    });
    expect(listBridge.executed_tool).toBe("engineeringPrecheck");
    expect(listBridge.result.tool_surface.engineering_tools).toBeGreaterThanOrEqual(20);
  }, 30000);

  it("runs the MCP happy path from session through scheduling", async () => {
    const session = await mcpTool<{ workflow_session_id: string }>("start_workflow_session", {
      brand_key: BRAND_KEY,
    });
    const card = await mcpTool<{ source_card_id: string }>("create_source_card", {
      brand_key: BRAND_KEY,
      workflow_session_id: session.workflow_session_id,
      sequence_label: "mcp_source_card_001",
      lane_key: "systems",
      title: "MCP systems card",
      primary_source: { source_type: "external_reference", source_id: "mcp-fixture", text: "Systems compound attention." },
      source_mechanism: "Make systems feel like leverage.",
      required_product: "A concrete operator advantage.",
      forbidden_surfaces: [],
      pass_conditions: ["Clear operator payoff."],
      fail_conditions: ["Generic productivity claim."],
    });
    await mcpTool("lock_source_card", { brand_key: BRAND_KEY, source_card_id: card.source_card_id });
    const run = await mcpTool<{ run_id: string }>("create_generation_run", {
      brand_key: BRAND_KEY,
      source_card_id: card.source_card_id,
      objective: "Generate one MCP candidate",
      prompt_summary: "MCP test prompt",
    });
    const draft = await mcpTool<{ draft_id: string; showable: boolean }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: run.run_id,
      source_card_id: card.source_card_id,
      text: "A clean system makes every good idea easier to use twice.",
      draft_analysis: { opening_phrase: "A clean system makes", realm_entrance_key: "clean_system", lane_key: "systems" },
    });
    expect(draft.showable).toBe(true);
    await mcpTool("mark_draft_shown", { brand_key: BRAND_KEY, draft_id: draft.draft_id });
    await mcpTool("approve_draft", { brand_key: BRAND_KEY, draft_id: draft.draft_id, feedback_note: "MCP fixture approval." });
    const scheduled = await mcpTool<{ status: string; scheduled_post_id: number }>("schedule_approved_draft", {
      brand_key: BRAND_KEY,
      draft_id: draft.draft_id,
      date: "2099-01-02",
      time: "09:00",
      timezone: "America/New_York",
    });
    expect(scheduled.status).toBe("scheduled");
    expect(scheduled.scheduled_post_id).toBeTruthy();
  }, 40000);

  it("returns structured MCP gate failure and blocks mark_draft_shown", async () => {
    const first = await createLockedSourceCard();
    const shown = await mcpTool<{ draft_id: string }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: first.runId,
      source_card_id: first.sourceCardId,
      text: "Picture the system doing the repeat work for you.",
      draft_analysis: { opening_phrase: "Picture the system", realm_entrance_key: "picture", lane_key: "systems" },
    });
    await mcpTool("mark_draft_shown", { brand_key: BRAND_KEY, draft_id: shown.draft_id });

    const second = await createLockedSourceCard();
    const blocked = await mcpTool<{ draft_id: string; showable: boolean; blocking_failures: Array<{ gate_key: string }> }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: second.runId,
      source_card_id: second.sourceCardId,
      text: "Picture your calendar finally getting a cleaner operating system.",
      draft_analysis: { opening_phrase: "Picture your calendar", realm_entrance_key: "picture", lane_key: "systems" },
    });
    expect(blocked.showable).toBe(false);
    expect(blocked.blocking_failures.some((failure) => failure.gate_key === "current_inventory_repeat_gate")).toBe(true);

    const call = await mcpRequest<{ structuredContent: { ok?: boolean; error?: string }; isError?: boolean }>("tools/call", {
      name: "mark_draft_shown",
            arguments: { brand_key: BRAND_KEY, draft_id: blocked.draft_id, proceed_confirmed: true },
    });
    expect(call.isError).toBe(true);
    expect(call.structuredContent.error).toBe("draft_not_showable");
  }, 40000);

  it("runs MCP admin state checks and runtime tool schema controls", async () => {
    const adminState = await mcpTool<{ tool_count: number; admin_tools: string[]; policies: Record<string, boolean> }>("getMcpAdminState", {
      brand_key: BRAND_KEY,
    });
    expect(adminState.admin_tools).toContain("prepareFullPreflight");
    expect(adminState.policies.workflow_requirements_db_backed).toBe(true);

    const tests = await mcpTool<{ ok: boolean; checks: Array<{ name: string; passed: boolean }> }>("runMcpTests", {
      brand_key: BRAND_KEY,
    });
    expect(tests.ok).toBe(true);
    expect(tests.checks.every((check) => check.passed)).toBe(true);

    const startDefinition = await mcpTool<{ tool?: { inputSchema?: { properties?: Record<string, unknown> } } }>("readMcpToolDefinition", {
      tool_name: "start_workflow_session",
    });
    expect(startDefinition.tool?.inputSchema?.properties?.objective).toBeUndefined();

    const preflightDefinition = await mcpTool<{ tool?: { inputSchema?: { properties?: Record<string, unknown> } } }>("readMcpToolDefinition", {
      tool_name: "prepareFullPreflight",
    });
    expect(preflightDefinition.tool?.inputSchema?.properties?.objective).toBeUndefined();

    const patched = await mcpTool<{ tool?: { inputSchema?: { properties?: Record<string, unknown> } } }>("updateMcpToolSchema", {
      tool_name: "prepareFullPreflight",
      schema_patch: { properties: { operator_note: { type: "string" } } },
      reason: "vitest schema patch",
    });
    expect(patched.tool?.inputSchema?.properties?.operator_note).toBeTruthy();

    await mcpTool("disableMcpTool", { tool_name: "get_post_results", reason: "vitest hide" });
    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    expect(listed.tools.some((tool) => tool.name === "get_post_results")).toBe(false);
  }, 30000);

  it("blocks workflow stage advancement until the key handshake precheck completes", async () => {
    const session = await mcpTool<{ workflow_session_id: string }>("start_workflow_session", {
      brand_key: BRAND_KEY,
    });

    const blocked = await mcpRequest<{ structuredContent: { ok?: boolean; error?: string; blockers?: Array<Record<string, unknown>> }; isError?: boolean }>("tools/call", {
      name: "advanceWorkflowStage",
            arguments: { brand_key: BRAND_KEY, workflow_session_id: session.workflow_session_id, target_stage: "context_admission", proceed_confirmed: true },
    });
    expect(blocked.isError).toBe(true);
    expect(blocked.structuredContent.error).toBe("workflow_stage_blocked");
    expect(blocked.structuredContent.blockers?.length).toBeGreaterThan(0);

        const preflight = await mcpTool<{ complete: boolean; context_admission_id: string; sections: Array<{ section: string; coverage_status: string }> }>("prepareFullPreflight", {
      brand_key: BRAND_KEY,
      workflow_session_id: session.workflow_session_id,
    });
    expect(preflight.complete).toBe(true);
    expect(preflight.context_admission_id).toBeTruthy();
    expect(preflight.sections[0]).toMatchObject({ section: "operator_precheck", coverage_status: "complete" });

    const advanced = await mcpTool<{ current_stage: string }>("advanceWorkflowStage", {
      brand_key: BRAND_KEY,
      workflow_session_id: session.workflow_session_id,
      target_stage: "context_admission",
    });
    expect(advanced.current_stage).toBe("context_admission");
  }, 40000);

  it("inspects failures and stores MCP implementation backlog", async () => {
    const inspected = await mcpTool<{ likely_cause: string; inspection_id: string }>("inspectMcpFailure", {
      tool_name: "mark_draft_shown",
      error_response: { error: "draft_not_showable" },
    });
    expect(inspected.likely_cause).toBe("draft_gate_blocker");
    expect(inspected.inspection_id).toBeTruthy();

    const item = await mcpTool<{ item_id: string }>("createImplementationBacklogItem", {
      title: "Make preflight blocker clearer",
      observed_issue: "User could miss a partial context admission.",
      required_change: "Return exact missing sections.",
      acceptance_test: "advanceWorkflowStage returns missing_sections.",
      related_stage: "context_admission",
    });
    expect(item.item_id).toBeTruthy();

    const listed = await mcpTool<{ items: Array<{ id: string; status: string }> }>("listImplementationBacklogItems", { status: "open" });
    expect(listed.items.some((row) => row.id === item.item_id)).toBe(true);

    await mcpTool("markImplementationBacklogItemResolved", {
      item_id: item.item_id,
      resolution_note: "Vitest fixture resolved.",
    });
    const resolved = await mcpTool<{ items: Array<{ id: string; status: string }> }>("listImplementationBacklogItems", { status: "resolved" });
    expect(resolved.items.some((row) => row.id === item.item_id && row.status === "resolved")).toBe(true);
  }, 30000);

  it("deploys and rolls back runtime MCP config snapshots", async () => {
    const deployment = await mcpTool<{ deployment_id: string; version: number }>("deployMcpChanges", {
      change_summary: "vitest runtime snapshot",
    });
    expect(deployment.deployment_id).toBeTruthy();
    expect(deployment.version).toBeGreaterThan(0);

    await mcpTool("updateMcpToolBehavior", {
      tool_name: "prepareFullPreflight",
      behavior_patch: { note: "temporary vitest patch" },
      reason: "vitest behavior patch",
    });

    const rollback = await mcpTool<{ restored: { workflow_requirements: number } }>("rollbackMcpChanges", {
      deployment_id: deployment.deployment_id,
      reason: "vitest rollback",
    });
    expect(rollback.restored.workflow_requirements).toBeGreaterThan(0);
  }, 30000);
});
