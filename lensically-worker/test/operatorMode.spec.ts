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
        const card = await operatorTool<{ source_card_id: string; source_selection_id: string; owner_presentation: { version: string; account_scope: string; prohibited_owner_headings: string[]; manifest_mental_sections: string[] } }>("create_source_card", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      source_selection_id: first.source_selection_id,
      title: "Random draw source card",
      source_mechanism: "Extract and rebuild the audience reward.",
            required_product: "One original Manifest Mental post.",
      transformation_contract: {
        must_preserve_exact: ["Qualified pattern"],
        must_transform: ["Qualified pattern source payoff"],
        audience_reward: "A personally relevant Manifest Mental outcome.",
      },
      forbidden_surfaces: [],

      pass_conditions: ["Preserves the audience payoff."],
      fail_conditions: ["Copies the source wording."],
    });
        expect(card.source_selection_id).toBe(first.source_selection_id);
    expect(card.owner_presentation.version).toBe("source-card-owner-presentation-v1");
    expect(card.owner_presentation.account_scope).toBe("manifest_mental");
    expect(card.owner_presentation.prohibited_owner_headings).toContain("Must preserve");
    expect(card.owner_presentation.manifest_mental_sections).toContain("Adaptation approach");

    const storedCard = await operatorTool<{
      source_card: { primary_source: Record<string, unknown>; metrics_snapshot: { likes: number } };
      owner_presentation: { version: string; account_scope: string; prohibited_owner_headings: string[]; manifest_mental_sections: string[] };
    }>("get_source_card", {
      brand_key: "manifest_mental",
      source_card_id: card.source_card_id,
    });
        expect(storedCard.source_card.primary_source.source_selection_id).toBe(first.source_selection_id);
    expect(storedCard.source_card.metrics_snapshot.likes).toBe(first.metrics_snapshot.likes);
    expect(storedCard.owner_presentation.version).toBe("source-card-owner-presentation-v1");
    expect(storedCard.owner_presentation.account_scope).toBe("manifest_mental");
    expect(storedCard.owner_presentation.prohibited_owner_headings).toEqual(expect.arrayContaining(["Must preserve", "Pass conditions"]));
    expect(storedCard.owner_presentation.manifest_mental_sections).toEqual(expect.arrayContaining(["Why the source works", "Generation freedom"]));

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
        expect(duplicateResponse.status).toBe(200);
    const duplicateData = await duplicateResponse.json() as { source_card_id: string; reused_existing: boolean; reason: string };
        expect(duplicateData.source_card_id).toBe(card.source_card_id);
    expect(duplicateData.reused_existing).toBe(true);
    expect(duplicateData.reason).toBe("selection_already_resolved");

    await operatorTool("lock_source_card", {
      brand_key: "manifest_mental",
      source_card_id: card.source_card_id,
    });
    const revised = await operatorTool<{
      source_card_id: string;
      version_number: number;
      supersedes_source_card_id: string;
      reused_existing: boolean;
    }>("create_source_card", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      source_selection_id: first.source_selection_id,
      create_new_version: true,
      version_reason: "Owner approved a gender-neutral direct-reader hook.",
      title: "Gender-neutral revised card",
      source_mechanism: "Directly identify the person reading the post.",
      required_product: "A gender-neutral direct-reader prediction.",
      transformation_contract: {
        must_preserve_function: ["Directly identify the person reading the post."],
        may_reuse: ["THE PERSON READING THIS"],
        audience_reward: "Personal selection without gendering the reader.",
      },
      forbidden_surfaces: [],
      pass_conditions: ["Uses a gender-neutral reader hook."],
      fail_conditions: ["Uses a gendered reader hook."],
    });
    expect(revised.source_card_id).not.toBe(card.source_card_id);
    expect(revised.version_number).toBe(2);
    expect(revised.supersedes_source_card_id).toBe(card.source_card_id);
    expect(revised.reused_existing).toBe(false);
    const revisedCard = await operatorTool<{
      source_card: { title: string; version_number: number; is_current: boolean; supersedes_source_card_id: string };
    }>("get_source_card", {
      brand_key: "manifest_mental",
      source_card_id: revised.source_card_id,
      include_history: false,
    });
    expect(revisedCard.source_card.title).toBe("Gender-neutral revised card");
    expect(revisedCard.source_card.version_number).toBe(2);
    expect(revisedCard.source_card.is_current).toBe(true);
    expect(revisedCard.source_card.supersedes_source_card_id).toBe(card.source_card_id);
    const relinkedSelection = await env.DB.prepare(
      `SELECT source_card_id FROM operator_source_selections WHERE id = ? LIMIT 1`,
    ).bind(first.source_selection_id).first<{ source_card_id: string }>();
    expect(relinkedSelection?.source_card_id).toBe(revised.source_card_id);

  }, 30000);

        it("allows close Manifest hook mimicry with slight wording changes while blocking an exact source copy", async () => {
    const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", { brand_key: "manifest_mental" });
    const batchId = crypto.randomUUID();
    const selectionId = crypto.randomUUID();
    const sourceText = "IF YOUR FINGER TOUCHED THIS, Something is shifting in your favour across JULY.\nLET IT HAPPEN.";
    await env.DB.prepare(
      `INSERT INTO operator_source_selection_batches (id, brand_key, workflow_session_id, selection_method, eligibility_min_likes, qualified_pool_count, requested_count, selected_count, selected_at, metadata_json)
       VALUES (?, 'manifest_mental', ?, 'test_fixture', 1000, 1, 1, 1, CURRENT_TIMESTAMP, '{}')`,
    ).bind(batchId, session.workflow_session_id).run();
    await env.DB.prepare(
      `INSERT INTO operator_source_selections (id, batch_id, brand_key, workflow_session_id, draw_order, source_identity_key, source_type, internal_source_id, threads_post_id, canonical_source_url, post_text, original_posted_at, metrics_snapshot_json, source_snapshot_json, selected_at)
       VALUES (?, ?, 'manifest_mental', ?, 1, 'threads:contract-1', 'saved_pattern', 'contract-1', 'contract-1', 'https://www.threads.com/@fixture/post/contract-1', ?, NULL, '{"likes":1700}', ?, CURRENT_TIMESTAMP)`,
    ).bind(selectionId, batchId, session.workflow_session_id, sourceText, JSON.stringify({ source_identity_key: "threads:contract-1", source_type: "saved_pattern", internal_source_id: "contract-1", threads_post_id: "contract-1", text: sourceText, metrics: { likes: 1700 } })).run();
    const card = await operatorTool<{ source_card_id: string }>("create_source_card", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      source_selection_id: selectionId,
      title: "Finger-touch source",
      source_mechanism: "Touch becomes personal selection for an imminent outcome.",
      required_product: "Personal confirmation of a desirable near-term outcome.",
      transformation_contract: {
                must_preserve_exact: ["If your finger touched this"],
        must_preserve_function: ["Physical contact with the post acts as personal selection."],
        may_reuse: ["If your finger touched this", "Something is shifting in your favour"],
        audience_reward: "Personal confirmation that a desired outcome is approaching.",
        time_or_context_requirements: ["A named month or near-term time boundary is present."],
        notes: "Keep the hook, structure, meaning, tone, and payoff close to the source. Change only slight wording and invent no new scene or premise.",
      },
      forbidden_surfaces: ["If your finger touched this", "Something is shifting in your favour", "LET IT HAPPEN"],
      pass_conditions: ["Reusable hook remains and payoff changes."],
      fail_conditions: ["Complete original package is copied."],
    });
    await operatorTool("lock_source_card", { brand_key: "manifest_mental", source_card_id: card.source_card_id });
    const run = await operatorTool<{ run_id: string }>("create_generation_run", {
      brand_key: "manifest_mental",
      source_card_id: card.source_card_id,
            adaptation_plan: { adaptation_goal: "Create a close source mimic with only slight wording changes.", retained_exact_surfaces: ["If your finger touched this", "Something is shifting in your favour"] },
    });
    const analysis = {
      opening_phrase: "If your finger touched this",
      realm_entrance_key: "finger_touch",
      preserved_functions: ["Physical contact with the post acts as personal selection."],
            satisfied_time_or_context_requirements: ["A named month or near-term time boundary is present."],
      audience_reward_delivered: true,
    };
    const passing = await operatorTool<{ showable: boolean; gate_results: Array<{ gate_key: string; result: string }> }>("submit_candidate_draft", {
      brand_key: "manifest_mental",
      run_id: run.run_id,
      source_card_id: card.source_card_id,
            text: "If your finger touched this, something is shifting in your favor this week. Let it unfold.",
      draft_analysis: analysis,
    });
    expect(passing.showable).toBe(true);
    expect(passing.gate_results.find((result) => result.gate_key === "source_surface_copy_gate")?.result).toBe("pass");
    const copied = await operatorTool<{ showable: boolean; blocking_failures: Array<{ gate_key: string }> }>("submit_candidate_draft", {
      brand_key: "manifest_mental",
      run_id: run.run_id,
      source_card_id: card.source_card_id,
      text: sourceText,
      draft_index: 2,
      draft_analysis: analysis,
    });
        expect(copied.showable).toBe(false);
    expect(copied.blocking_failures.some((failure) => failure.gate_key === "source_transformation_contract_gate")).toBe(true);
    }, 30000);

  it("ignores rejected drafts in exact duplicate inventory but still blocks approved drafts", async () => {
    const fixture = await createLockedSourceCard();
    const text = "THE PERSON READING THIS\nis making this their first six-figure year.\nCLAIM IT";
    const rejected = await operatorTool<{ draft_id: string }>("save_self_rejected_draft", {
      brand_key: BRAND_KEY,
      run_id: fixture.runId,
      source_card_id: fixture.sourceCardId,
      text,
      rejection_reason: "Post-specific repair fixture.",
    });

    const afterRejected = await operatorTool<{ gate_results: Array<{ gate_key: string; result: string }> }>("run_gates", {
      brand_key: BRAND_KEY,
      source_card_id: fixture.sourceCardId,
      draft_text: text,
      stage: "gate_evaluation",
    });
    expect(afterRejected.gate_results.find((result) => result.gate_key === "exact_duplicate_gate")?.result).toBe("pass");

    await env.DB.prepare(
      `UPDATE gpt_generation_drafts SET status = 'approved' WHERE id = ?`,
    ).bind(rejected.draft_id).run();

    const afterApproved = await operatorTool<{ gate_results: Array<{ gate_key: string; result: string }> }>("run_gates", {
      brand_key: BRAND_KEY,
      source_card_id: fixture.sourceCardId,
      draft_text: text,
      stage: "gate_evaluation",
    });
    expect(afterApproved.gate_results.find((result) => result.gate_key === "exact_duplicate_gate")?.result).toBe("fail");
  }, 30000);

  it("loads account rejection context and blocks repeated owner-rejected language before showing", async () => {
    const first = await createLockedSourceCard();
    const shown = await operatorTool<{ draft_id: string; showable: boolean; gate_results: Array<{ gate_key: string; result: string }> }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: first.runId,
      source_card_id: first.sourceCardId,
      text: "The whole room changes when the right person is finally recognized.",
      draft_analysis: { opening_phrase: "The whole room changes", realm_entrance_key: "room_changes", lane_key: "systems" },
    });
    expect(shown.showable).toBe(true);
    expect(shown.gate_results.find((result) => result.gate_key === "required_gate_execution_gate")?.result).toBe("pass");
    await operatorTool("mark_draft_shown", { brand_key: BRAND_KEY, draft_id: shown.draft_id });
    await operatorTool("reject_draft", {
      brand_key: BRAND_KEY,
      draft_id: shown.draft_id,
      rejection_reason: "Owner rejected this direction. Avoid banned 'rooms' in future drafts; room language was already explicitly rejected.",
      strategy: { ban_phrases: ["rooms"], rejection_type: "banned_setting_language" },
    });

    const second = await createLockedSourceCard();
    const persistedRun = await env.DB.prepare(
      `SELECT prior_adaptation_context_json FROM gpt_generation_runs WHERE id = ? LIMIT 1`,
    ).bind(second.runId).first<{ prior_adaptation_context_json: string }>();
    const persistedContext = JSON.parse(String(persistedRun?.prior_adaptation_context_json ?? "{}")) as {
      account_rejection_context?: {
        context_fingerprint?: string;
        required_review_count?: number;
        coverage_complete?: boolean;
        explicit_banned_surfaces?: string[];
      };
    };
    const rejectionContext = persistedContext.account_rejection_context;
    expect(rejectionContext?.coverage_complete).toBe(true);
    expect(Number(rejectionContext?.required_review_count ?? 0)).toBeGreaterThanOrEqual(1);
    expect(rejectionContext?.explicit_banned_surfaces?.map((item) => item.toLowerCase())).toContain("rooms");

    const blockedSurface = await operatorTool<{
      showable: boolean;
      blocking_failures: Array<{ gate_key: string; evidence?: { matched_banned_surfaces?: string[] } }>;
      gate_results: Array<{ gate_key: string; result: string }>;
    }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: second.runId,
      source_card_id: second.sourceCardId,
      text: "Your work deserves to be the reason the room starts paying attention.",
      draft_analysis: { opening_phrase: "Your work deserves", realm_entrance_key: "work_deserves", lane_key: "systems" },
    });
    expect(blockedSurface.showable).toBe(false);
    expect(blockedSurface.blocking_failures.some((failure) => failure.gate_key === "historical_owner_rejection_gate")).toBe(true);
    expect(blockedSurface.gate_results.find((result) => result.gate_key === "required_gate_execution_gate")?.result).toBe("pass");

    const missingReview = await operatorTool<{ showable: boolean; blocking_failures: Array<{ gate_key: string; rationale: string }> }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: second.runId,
      source_card_id: second.sourceCardId,
      draft_index: 2,
      text: "A clean system earns trust because the work becomes easier to verify.",
      draft_analysis: { opening_phrase: "A clean system earns trust", realm_entrance_key: "clean_system_trust", lane_key: "systems" },
    });
    expect(missingReview.showable).toBe(false);
    expect(missingReview.blocking_failures.some((failure) =>
      failure.gate_key === "historical_owner_rejection_gate" && failure.rationale.includes("not recorded"),
    )).toBe(true);

    const third = await createLockedSourceCard();
    const thirdRun = await env.DB.prepare(
      `SELECT prior_adaptation_context_json FROM gpt_generation_runs WHERE id = ? LIMIT 1`,
    ).bind(third.runId).first<{ prior_adaptation_context_json: string }>();
    const thirdContext = (JSON.parse(String(thirdRun?.prior_adaptation_context_json ?? "{}")) as {
      account_rejection_context?: { context_fingerprint?: string; required_review_count?: number };
    }).account_rejection_context;
    const passing = await operatorTool<{ showable: boolean; gate_results: Array<{ gate_key: string; result: string }> }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: third.runId,
      source_card_id: third.sourceCardId,
      text: "A clean system earns trust because anyone can verify the work.",
      draft_analysis: { opening_phrase: "A clean system earns trust", realm_entrance_key: "clean_system_verification", lane_key: "systems" },
      model_gate_results: [{
        gate_key: "historical_owner_rejection_gate",
        result: "pass",
        rationale: "Reviewed the complete account rejection context and found no repeated banned language, rejected concept, failed structure, or close rejected-draft match.",
        evidence: {
          context_fingerprint: thirdContext?.context_fingerprint,
          reviewed_rejection_count: thirdContext?.required_review_count,
        },
      }],
    });
    expect(passing.showable).toBe(true);
    expect(passing.gate_results.find((result) => result.gate_key === "historical_owner_rejection_gate")?.result).toBe("pass");
    expect(passing.gate_results.find((result) => result.gate_key === "required_gate_execution_gate")?.result).toBe("pass");
        }, 30000);

    it("allows a current owner-approved exact surface without removing the older Manifest hard ban globally", async () => {
    await operatorTool("save_strategy_memory", {
      brand_key: "manifest_mental",
      kind: "rejection_feedback",
      title: "Explicit hard ban fixture",
      body: "Avoid banned 'something' in future drafts.",
      source: "owner_feedback",
    });

    const blockedRun = await createLockedSourceCard([], "manifest_mental");
        const blocked = await operatorTool<{
      showable: boolean;
      gate_results: Array<{ gate_key: string; result: string }>;
    }>("submit_candidate_draft", {
      brand_key: "manifest_mental",
      run_id: blockedRun.runId,
      source_card_id: blockedRun.sourceCardId,
      text: "A system makes something easier to verify.",
      draft_analysis: {
        opening_phrase: "A system makes",
        realm_entrance_key: "system_verify_blocked",
        lane_key: "systems",
      },
    });
    expect(blocked.gate_results.find((result) => result.gate_key === "historical_owner_rejection_gate")?.result).toBe("fail");

    const approvedRun = await createLockedSourceCard([], "manifest_mental");
    const approved = await operatorTool<{
      showable: boolean;
      gate_results: Array<{ gate_key: string; result: string }>;
    }>("submit_candidate_draft", {
      brand_key: "manifest_mental",
      run_id: approvedRun.runId,
      source_card_id: approvedRun.sourceCardId,
      text: "A system makes something easier to verify.",
      draft_analysis: {
        opening_phrase: "A system makes",
        realm_entrance_key: "system_verify_approved",
        lane_key: "systems",
        owner_requested_exact_surface: "something easier",
      },
    });
        expect(approved.gate_results.find((result) => result.gate_key === "historical_owner_rejection_gate")?.result).toBe("pass");
  }, 30000);

  it("persists complete rejection coverage in a compact generation-run context", async () => {
    const first = await createLockedSourceCard();
    const runOwner = await env.DB.prepare(
      `SELECT account_id, threads_user_id FROM gpt_generation_runs WHERE id = ? LIMIT 1`,
    ).bind(first.runId).first<{ account_id: string; threads_user_id: string }>();
    expect(runOwner).toBeTruthy();

    const oversizedStrategy = JSON.stringify({
      ban_phrases: ["oversized_token"],
      unused_payload: "x".repeat(20000),
    });
    await env.DB.prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1
         UNION ALL
         SELECT value + 1 FROM sequence WHERE value < 120
       )
       INSERT INTO gpt_generation_drafts (
         id, run_id, account_id, threads_user_id, draft_index, text, status,
         rejection_reason, owner_feedback, strategy_json
       )
       SELECT
         'bulk-rejection-' || value,
         ?,
         ?,
         ?,
         value,
         'Previously rejected draft number ' || value || ' with a distinct failed structure.',
         'rejected',
         'Owner rejected this wording. Avoid banned "oversized_token" in future drafts.',
         'Keep the lesson, but do not persist unrelated raw strategy payloads.',
         ?
       FROM sequence`,
    ).bind(first.runId, runOwner?.account_id, runOwner?.threads_user_id, oversizedStrategy).run();

        const second = await createLockedSourceCard();
    let latestRunId = second.runId;
    for (let index = 1; index <= 6; index += 1) {
      const nextRun = await operatorTool<{ run_id: string }>("create_generation_run", {
        brand_key: BRAND_KEY,
        source_card_id: second.sourceCardId,
        adaptation_plan: {
          adaptation_goal: `Bounded repair run ${index}.`,
          transformed_elements: [`payoff-${index}`],
          intentionally_different_from_prior: `Flat repair variation ${index}.`,
        },
        prompt_summary: `Compact repeated source-card run ${index}.`,
      });
      latestRunId = nextRun.run_id;
    }

    const persistedRun = await env.DB.prepare(
      `SELECT prior_adaptation_context_json FROM gpt_generation_runs WHERE id = ? LIMIT 1`,
    ).bind(latestRunId).first<{ prior_adaptation_context_json: string }>();
    const serialized = String(persistedRun?.prior_adaptation_context_json ?? "{}");
    const persistedContext = JSON.parse(serialized) as {
      prior_runs?: Array<Record<string, unknown>>;
      account_rejection_context?: {
        coverage_complete?: boolean;
        required_review_count?: number;
        explicit_banned_surfaces?: string[];
        rejected_drafts?: Array<Record<string, unknown>>;
      };
    };
    const rejectionContext = persistedContext.account_rejection_context;
    expect(rejectionContext?.coverage_complete).toBe(true);
    expect(rejectionContext?.required_review_count).toBe(120);
    expect(rejectionContext?.explicit_banned_surfaces).toContain("oversized_token");
    expect(rejectionContext?.rejected_drafts?.[0]).not.toHaveProperty("strategy");
        expect(persistedContext.prior_runs?.length).toBe(6);
    expect(persistedContext.prior_runs?.every((run) => !("prior_adaptation_context" in run))).toBe(true);
    expect(serialized.length).toBeLessThan(500000);
  }, 60000);

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
                    draft_analysis: {
            opening_phrase: text.split(" ").slice(0, 4).join(" "),
            realm_entrance_key: text.slice(0, 12),
            lane_key: "systems",
            audience_reward_delivered: brandKey === "manifest_mental" ? true : undefined,
          },

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
    expect(new Set(toolNames).size).toBe(toolNames.length);
    expect(() => JSON.stringify(listed.tools)).not.toThrow();
    expect(toolNames.some((name) => /^(mm|om|vx)_/.test(name))).toBe(false);
    expect(initialized.instructions).toContain("Initial key-selection stop");
    expect(initialized.instructions).toContain("Selected key: <selected_key>");
    expect(initialized.instructions).toContain(`Full tool surface loaded: ${toolNames.length} tools available and usable.`);
                expect(initialized.instructions).toContain("Only after the user explicitly approves proceeding, call confirmOperatorProceed.");
        expect(initialized.instructions).toContain("pick up where the persisted workflow left off or start fresh");
        expect(initialized.instructions).toContain("Do not load account/workflow state or create a session until the owner explicitly chooses");
        expect(initialized.instructions).toContain("include proceed_confirmed=true on the selected account-scoped path");
        expect(initialized.instructions).toContain("generation_run_and_candidates and gate_evaluation are silent internal stages");
    expect(initialized.instructions).toContain("Owner-visible transition labels are mandatory across accounts and fresh chats");
    expect(initialized.instructions).toContain("Completed:, Showing now:, and Next decision:");
    expect(initialized.instructions).toContain("The next owner approval question must occur only after a draft passed all blocking gates");
        expect(initialized.instructions).toContain("If no candidate becomes showable, report the blocker or generation failure instead of asking for approval");
                expect(initialized.instructions).toContain("Manifest close-mimicry rule");
    expect(initialized.instructions).toContain("Source-card presentation rule");
    expect(initialized.instructions).toContain("Never display Must preserve, May reuse, Must change, Cannot repeat, Pass conditions, Fail conditions");
    expect(initialized.instructions).toContain("Original source, Source performance, Why the source works, Audience reward, Adaptation approach, Generation freedom");
    expect(initialized.instructions).toContain("explicit owner hard bans");
    expect(initialized.instructions).toContain("historical_owner_rejection_gate");
    expect(initialized.instructions).toContain("Never claim that a gate passed unless that exact gate_key appears");

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
      "delete_saved_pattern_source",
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

    it("keeps initialize and key-handshake counts aligned with runtime-added tools", async () => {
    await mcpTool("createMcpTool", {
      tool_name: "runtime_count_fixture",
      description: "Runtime count fixture.",
      input_schema: { type: "object", properties: {}, additionalProperties: false },
      behavior: { test_only: true },
      handler_spec: { requires_backend_handler: true },
      reason: "Verify runtime-aware handshake counts.",
    });
    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    expect(listed.tools.map((tool) => tool.name)).toContain("runtime_count_fixture");
    const initialized = await mcpRequest<{ instructions: string }>("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    expect(initialized.instructions).toContain(`Full tool surface loaded: ${listed.tools.length} tools available and usable.`);
    const selected = await mcpToolRaw<{ tool_count: number; handshake: string[] }>("selectOperatorKey", { brand_key: "manifest_mental" });
    expect(selected.isError).not.toBe(true);
    expect(selected.structuredContent.tool_count).toBe(listed.tools.length);
    expect(selected.structuredContent.handshake[2]).toBe(`Full tool surface loaded: ${listed.tools.length} tools available and usable.`);
  }, 30000);

  it("loads compact non-account startup bootstrap in a fresh session", async () => {

    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    const direct = await mcpTool<{
            bootstrap_version: string;
            collaboration_contract: { version: string; principles: string[]; durable_change_reporting: { required_fields: string[] }; system_layers: Array<{ key: string }> };
                                                owner_interaction_contract: { version: string; silent_stages: string[]; owner_visible_checkpoints: string[]; transition_label_contract: { required_labels: string[]; instruction: string }; continuation_choice_contract: { required_after_confirm_operator_proceed: boolean; owner_prompt: string; allowed_choices: string[]; before_choice_forbidden: string[]; resume_behavior: string; fresh_behavior: string; owner_visible_format: { completed: string; showing_now: string; next_decision: string } }; source_card_presentation_contract: { version: string; raw_contract_fields_are_internal_only: boolean; prohibited_owner_headings: string[]; manifest_mental_sections: string[]; instruction: string; no_finished_draft_rule: string }; rules: string[]; next_owner_decision_after_source_card: string };
      rejection_memory_contract: { version: string; infrastructure_scope: string; evidence_scope: string; required_generation_behavior: string[]; required_gate_keys: string[]; showability_rule: string };
      account_data_loaded: boolean;


      no_account_sections_present: boolean;
      tool_surface: { total_tools: number; engineering_tools: string[]; admin_tools: string[]; account_wrapper_tools: string[] };
      repository: { repo: string; branch: string };
      runtime: { mcp_version: string };
      source_documents: Array<{ path: string; excerpt: string; truncated: boolean }>;
      ops_memory: Array<Record<string, unknown>>;
      mandatory_fallback_execution_routes: string[];
      universal_workflow_requirements: Array<{ stage: string; required_sections: string[] }>;
      boundary: { first_key_response_template: string[]; before_proceed_forbidden: string[]; after_explicit_proceed: string };
      open_implementation_backlog: Array<Record<string, unknown>>;
    }>("getOperatorStartupContext");
        expect(direct.bootstrap_version).toBe("operator-startup-v2");
    expect(direct.collaboration_contract.version).toBe("operator-collaboration-v1");
    expect(direct.collaboration_contract.principles.join(" ")).toContain("independent judgment");
    expect(direct.collaboration_contract.durable_change_reporting.required_fields).toEqual(expect.arrayContaining([
      "change_name",
      "primary_system_layer",
      "scope_universal_or_account_scoped",
      "survives_new_chats_because",
    ]));
        expect(direct.collaboration_contract.system_layers.map((layer) => layer.key)).toEqual(expect.arrayContaining([
      "backend_behavior",
      "workflow_requirement",
      "mcp_contract",
      "data_model",
      "gate_evaluator",
      "regression_test",
      "startup_contract",
      "supporting_memory",
    ]));
                expect(direct.owner_interaction_contract.version).toBe("operator-owner-interaction-v4");
    expect(direct.owner_interaction_contract.silent_stages).toEqual(["generation_run_and_candidates", "gate_evaluation"]);
    expect(direct.owner_interaction_contract.owner_visible_checkpoints).toContain("post_handshake_continuation_choice");
    expect(direct.owner_interaction_contract.continuation_choice_contract.required_after_confirm_operator_proceed).toBe(true);
    expect(direct.owner_interaction_contract.continuation_choice_contract.owner_prompt).toContain("pick up where the existing workflow left off");
    expect(direct.owner_interaction_contract.continuation_choice_contract.allowed_choices).toEqual(["resume_existing_workflow", "start_fresh_workflow"]);
    expect(direct.owner_interaction_contract.continuation_choice_contract.before_choice_forbidden).toEqual(expect.arrayContaining(["getWorkflowStatus", "get_account_state", "prepareFullPreflight", "start_workflow_session"]));
    expect(direct.owner_interaction_contract.continuation_choice_contract.resume_behavior).toContain("exact checkpoint");
    expect(direct.owner_interaction_contract.continuation_choice_contract.fresh_behavior).toContain("preserving the previous session");
    expect(direct.owner_interaction_contract.transition_label_contract.required_labels).toEqual(["Completed:", "Showing now:", "Next decision:"]);
    expect(direct.owner_interaction_contract.transition_label_contract.instruction).toContain("Never make the owner infer");
    expect(direct.owner_interaction_contract.source_card_presentation_contract.version).toBe("source-card-owner-presentation-v1");
    expect(direct.owner_interaction_contract.source_card_presentation_contract.raw_contract_fields_are_internal_only).toBe(true);
    expect(direct.owner_interaction_contract.source_card_presentation_contract.prohibited_owner_headings).toEqual(expect.arrayContaining([
      "Must preserve",
      "May reuse",
      "Must change",
      "Cannot repeat",
      "Pass conditions",
      "Fail conditions",
    ]));
    expect(direct.owner_interaction_contract.source_card_presentation_contract.manifest_mental_sections).toEqual(expect.arrayContaining([
      "Original source",
      "Source performance",
      "Why the source works",
      "Audience reward",
      "Adaptation approach",
      "Generation freedom",
      "Recommended direction",
    ]));
    expect(direct.owner_interaction_contract.source_card_presentation_contract.instruction).toContain("Never dump the raw transformation matrix");
    expect(direct.owner_interaction_contract.source_card_presentation_contract.no_finished_draft_rule).toContain("must not preselect");
    expect(direct.owner_interaction_contract.owner_visible_checkpoints).toEqual(expect.arrayContaining([
      "source_card_review",
      "draft_review_and_decision",
      "scheduling_confirmation",
    ]));
        expect(direct.owner_interaction_contract.rules.join(" ")).toContain("without asking the owner to proceed");
    expect(direct.owner_interaction_contract.next_owner_decision_after_source_card).toContain("passing showable draft");
        expect(direct.rejection_memory_contract.version).toBe("operator-rejection-context-v2");
    expect(direct.rejection_memory_contract.infrastructure_scope).toBe("universal");
    expect(direct.rejection_memory_contract.evidence_scope).toBe("selected_account");
    expect(direct.rejection_memory_contract.required_generation_behavior.join(" ")).toContain("compact selected-account rejection context");
    expect(direct.rejection_memory_contract.required_generation_behavior.join(" ")).toContain("explicit hard bans");
    expect(direct.rejection_memory_contract.required_gate_keys).toEqual(expect.arrayContaining([
      "historical_owner_rejection_gate",
      "required_gate_execution_gate",
    ]));
        expect(direct.rejection_memory_contract.showability_rule).toContain("Close source mimicry is allowed and preferred");
    expect(direct.tool_surface.total_tools).toBe(listed.tools.length);


    expect(direct.account_data_loaded).toBe(false);
    expect(direct.no_account_sections_present).toBe(true);
    expect(direct.repository.repo).toBe("Lensically");
    expect(direct.repository.branch).toBe("main");
    expect(direct.runtime.mcp_version).toBe("1.3.0");
    expect(direct.source_documents.map((doc) => doc.path)).toEqual(["AGENTS.md", "CURRENT_STATE.md", "OPERATING_MEMORY.md"]);
    expect(direct.source_documents.every((doc) => doc.excerpt.length <= 6000)).toBe(true);
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("runEngineeringTool");
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("listMcpTools");
    expect(direct.boundary.before_proceed_forbidden).toEqual(expect.arrayContaining(["account_state", "workflow_status", "source_cards", "drafts", "scheduled_posts", "account_gates", "strategy_memory", "account_metrics"]));
    expect(direct.boundary.after_explicit_proceed).toContain("resume the persisted workflow or start fresh");
    expect(direct.boundary.after_explicit_proceed).toContain("Do not load account/workflow state until the owner explicitly chooses");
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
    const payload = await response.json() as { error?: { code: number; message: string; data?: Record<string, unknown> } };
    expect(response.status).toBe(200);
    expect(payload.error).toMatchObject({ code: -32603 });
    expect(payload.error?.message).toContain("Internal MCP error");
    expect(payload.error?.data).toMatchObject({
      ok: false,
      error_code: "operator_mcp_method_failed",
      phase: "tools_call:getOperatorStartupContext",
      retryable: true,
      surface_available: true,
    });
  }, 30000);

  it("keeps initialize and canonical discovery available when runtime override storage is unavailable", async () => {
    await env.DB.prepare(`DROP TABLE IF EXISTS operator_mcp_tool_overrides`).run();
    const initialized = await mcpRequest<{ serverInfo: { version: string } }>("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    expect(initialized.serverInfo.version).toBe("1.3.0");
    expect(listed.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      "getOperatorStartupContext",
      "engineeringPrecheck",
      "searchRepoFiles",
      "applyRepoTextPatch",
      "create_source_card",
      "create_generation_run",
    ]));
    expect(new Set(listed.tools.map((tool) => tool.name)).size).toBe(listed.tools.length);
  });

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
      expect(toolNames).not.toContain(name);
    }
    const manifestBridge = await mcpTool<{ result: { brand_key: string } }>("listMcpTools", { execute_tool: "mm_get_account_state", arguments: { proceed_confirmed: true } });
    const manifest = manifestBridge.result;
    expect(manifest.brand_key).toBe("manifest_mental");
    const opmgBridge = await mcpTool<{ result: { brand_key: string } }>("listMcpTools", { execute_tool: "om_get_account_state", arguments: { proceed_confirmed: true } });
    const opmg = opmgBridge.result;
    expect(opmg.brand_key).toBe("opmg_deadman");
    const vectrixBridge = await mcpTool<{ result: { brand_key: string } }>("listMcpTools", { execute_tool: "vx_get_account_state", arguments: { proceed_confirmed: true } });
    const vectrix = vectrixBridge.result;
    expect(vectrix.brand_key).toBe("vectrix");
  }, 30000);

  it("returns non-enumerating operator health metadata", async () => {
    const response = await fetchFromWorker("/api/operator/health");
    const payload = await response.json() as { status?: string; mcp_version?: string; registry_generation?: string; live_tool_count?: number; timestamp?: string; tools?: unknown };
    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
    expect(payload.mcp_version).toBe("1.3.0");
    expect(payload.registry_generation).toBe("resilient-canonical-v2");
    expect(payload.live_tool_count).toBeGreaterThan(0);
    expect(payload.timestamp).toBeTruthy();
    expect(payload.tools).toBeUndefined();
  });


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
