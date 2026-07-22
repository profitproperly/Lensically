import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
    ScheduledPostScheduler,
  activateNextApprovedScheduledPostCanary,
        buildManifestRollingHourlySlots,
    buildOperatorContentFocusDailyDecisions,
  buildOperatorMaturityObservation,
  buildOperatorPostFingerprint,
    classifyManifestAutonomousFamilyRole,
  classifyOperatorContentFocusFamily,
  evaluateThreadsPostMetricsForLearning,
    finalizeScheduledPostPublished,
  getScheduledPostPublishLineageStatus,
  isSixHourInsightsRefreshWindow,
  OPERATOR_MCP_VERSION,
  searchKnownRepositoryFileContent,
  quarantineScheduledPostPublishAttempt,
  recoverStalePostingScheduledPosts,
    OPERATOR_PERFORMANCE_MATURITY_CHECKPOINTS,
    rankManifestAutonomousPortfolioCandidates,
  selectOperatorContentFocusSources,
  shouldAutoArmScheduledPostAlarm,

} from "../src";

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

async function mcpToolCallRaw<T = Record<string, unknown>>(toolName: string, args: Record<string, unknown> = {}): Promise<{ structuredContent: T; isError?: boolean }> {
  return mcpRequest<{ structuredContent: T; isError?: boolean }>("tools/call", {
    name: toolName,
    arguments: args,
  });
}

async function mcpToolRaw<T = Record<string, unknown>>(toolName: string, args: Record<string, unknown> = {}): Promise<{ structuredContent: T; isError?: boolean }> {
  return mcpToolCallRaw<T>(toolName, args);
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
    if (selected.isError) {
      throw new Error(`selectOperatorKey returned MCP isError: ${JSON.stringify(selected.structuredContent)}`);
    }
    expect(selected.structuredContent.selected_key).toBe(brandKey);
        mcpSelectedKey = brandKey;
    mcpProceedConfirmed = false;
  }
    if (!mcpProceedConfirmed) {
    const proceeded = await mcpToolRaw<{ proceeded: boolean; continuity_loaded: boolean; continuation_choice_required: boolean; continuity_capsule: { brand_key: string }; account_data_loaded: boolean }>("confirmOperatorProceed", { brand_key: brandKey });
    if (proceeded.isError) {
      throw new Error(`confirmOperatorProceed returned MCP isError: ${JSON.stringify(proceeded.structuredContent)}`);
    }
    expect(proceeded.structuredContent.proceeded).toBe(true);
    expect(proceeded.structuredContent.account_data_loaded).toBe(true);
    expect(proceeded.structuredContent.continuity_loaded).toBe(true);
    expect(proceeded.structuredContent.continuation_choice_required).toBe(false);
    expect(proceeded.structuredContent.continuity_capsule.brand_key).toBe(brandKey);
        mcpProceedConfirmed = true;
  }
}

async function activateManifestAutonomyForTest(): Promise<void> {
  await ensureMcpAccountOpen("manifest_mental");
  const activated = await mcpToolRaw<{
    growth_mission?: { execution_mode?: string; status?: string };
    full_auto_enabled?: boolean;
  }>("updateGrowthMission", {
    brand_key: "manifest_mental",
    status: "active",
    execution_mode: "autonomous_operator",
    mission_patch: {
      permanent_mission: "Grow Manifest Mental to 1,000,000 followers through the Autonomous Growth Engine.",
      target_followers: 1000000,
      growth_phase: "autonomous_growth_engine_v1",
      current_bottleneck: "maintain rolling runway",
      primary_objective: "Maintain a strategic rolling 48-hour runway without owner dependency.",
      recommended_next_action: "Prepare and execute the next autonomous growth cycle.",
    },
    owner_response: "I explicitly approve full autonomous Manifest operation for this isolated regression.",
    change_summary: "Activate autonomous growth engine in isolated test state.",
    proceed_confirmed: true,
  });
  expect(activated.isError).not.toBe(true);
  expect(activated.structuredContent.full_auto_enabled).toBe(true);
}


async function mcpTool<T = Record<string, unknown>>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
  const requestedBrand = testRequestedBrandKey(toolName, args);
  let callArgs = args;
  if (requestedBrand && toolName !== "selectOperatorKey" && toolName !== "confirmOperatorProceed") {
    await ensureMcpAccountOpen(requestedBrand);
    callArgs = args;
  }
  let result = await mcpToolRaw<Record<string, unknown>>(toolName, callArgs);
  if (result.isError && result.structuredContent.error === "approved_growth_mission_required") {
    const growthBrand = requestedBrand ?? "manifest_mental";
    const approvedMission = await mcpToolRaw<Record<string, unknown>>("updateGrowthMission", {
      brand_key: growthBrand,
      status: "approved",
      execution_mode: "guided_owner_approval",
      mission_patch: {
        permanent_mission: "Grow Manifest Mental to 1,000,000 followers while protecting audience trust, content quality, account safety, and brand identity.",
        target_followers: 1000000,
        current_bottleneck: "test_fixture_execution",
        primary_objective: "Preserve existing regression coverage under the guided approval boundary.",
        recommended_next_action: "Run the requested isolated regression fixture.",
      },
      owner_response: "Approved automatically by the isolated test harness.",
      change_summary: "Test-only guided plan approval.",
      proceed_confirmed: true,
    });
    expect(approvedMission.isError, `updateGrowthMission for ${toolName}`).not.toBe(true);
    result = await mcpToolRaw<Record<string, unknown>>(toolName, callArgs);
  }
  if (result.isError && result.structuredContent.error === "approved_operator_decision_required") {
    const governanceBrand = requestedBrand ?? "manifest_mental";
    const decisionKey = `vitest_auto_${toolName.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${crypto.randomUUID()}`;
    const proposed = await mcpToolRaw<{ decision: { id: string } }>("proposeOperatorDecision", {
      brand_key: governanceBrand,
      decision_key: decisionKey,
      category: "engineering",
      title: `Authorize ${toolName} test fixture`,
      decision: `Execute ${toolName} only for the current legacy regression fixture.`,
      rationale: "Legacy MCP tests exercise isolated mutations; production governance remains covered by the dedicated raw-call autonomy regression.",
      evidence: [{ source: "operatorMode.spec.ts", tool_name: toolName }],
      expected_outcome: `${toolName} completes its existing regression path.`,
      risks: ["Test-only auto-ratification must not alter production behavior."],
      reversibility: "The test database resets after each test.",
      execution_plan: `Authorize ${toolName} with a bounded test-only budget and retry the blocked fixture once.`,
      authorized_tools: [toolName],
            execution_budget: { [toolName]: 100 },
      proceed_confirmed: true,
    });
    expect(proposed.isError, `proposeOperatorDecision for ${toolName}`).not.toBe(true);
    const approved = await mcpToolRaw("resolveOperatorDecision", {
      brand_key: governanceBrand,
      decision_id: proposed.structuredContent.decision.id,
      resolution: "approve",
            owner_response: "Approved automatically by the isolated test harness.",
      proceed_confirmed: true,
    });
    expect(approved.isError, `resolveOperatorDecision for ${toolName}`).not.toBe(true);
    result = await mcpToolRaw<Record<string, unknown>>(toolName, callArgs);
  }
  if (result.isError) {
    throw new Error(`${toolName} returned MCP isError: ${JSON.stringify(result.structuredContent)}`);
  }
  return result.structuredContent as T;
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
                "operator_execution_events",
    "operator_execution_map_promotions",
    "operator_execution_map_attempts",
    "operator_execution_map_incidents",
    "operator_execution_map_entries",
    "operator_decision_execution_events",
    "operator_decision_proposals",
    "operator_growth_mission_revisions",
    "operator_growth_missions",
    "operator_autonomy_profiles",
    "operator_operation_receipts",
    "operator_continuity_refs",
    "operator_ops_memory",
    "operator_workflow_requirements",
    "operator_mcp_tool_overrides",
        "operator_gate_results",
    "operator_content_inventory",
            "operator_post_metric_snapshots",
    "operator_operational_incidents",
    "operator_daily_source_claims",
    "operator_review_batches",
    "operator_source_exclusions",
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

async function seedManifestPatterns(count = 30): Promise<void> {
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
  for (let index = 1; index <= count; index += 1) {
    await env.DB.prepare(
      `INSERT INTO external_patterns (
        app_user_id, account_id, platform, source_url, post_id, post_text,
        likes, replies, reposts, shares, views, posted_at, capture_confidence, updated_at
      ) VALUES ('lensically', 'manifest-mental', 'threads', ?, ?, ?, ?, 2, 1, 0, 20000, '2026-07-11T12:00:00Z', 'high', CURRENT_TIMESTAMP)`,
    ).bind(
      `https://www.threads.com/@fixture/post/calendar-${index}`,
      `calendar-${index}`,
      `Calendar workflow source ${index}`,
      2000 + index,
    ).run();
  }
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
        await env.DB.batch(Array.from({ length: 24 }, (_, offset) => {
      const index = offset + 1;
      return env.DB.prepare(
        `INSERT INTO external_patterns (
          app_user_id, account_id, platform, source_url, post_id, post_text,
          likes, replies, reposts, shares, views, posted_at, capture_confidence, updated_at
        ) VALUES ('lensically', 'manifest-mental', 'threads', ?, ?, ?, ?, 1, 1, 0, 10000, '2026-07-11T12:00:00Z', 'high', CURRENT_TIMESTAMP)`,
      ).bind(
        `https://www.threads.com/@fixture/post/helper-${index}`,
        `helper-${index}`,
        `Manifest helper source ${index}`,
        1000 + index,
      );
    }));
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

    it("auto-arms the scheduled-post alarm only on the configured canonical Worker host", () => {
    const workerOrigin = (env as unknown as { WORKER_ORIGIN: string }).WORKER_ORIGIN;
    expect(workerOrigin).toBeTruthy();
    expect(shouldAutoArmScheduledPostAlarm(new Request("https://example.com/api/operator/health"), env)).toBe(false);
    expect(shouldAutoArmScheduledPostAlarm(new Request(`${workerOrigin}/api/operator/health`), env)).toBe(true);
  });

  it("never reopens stale posting rows after an external publish attempt", async () => {
    await env.DB.prepare(
      `CREATE TABLE scheduled_posts (
        id INTEGER PRIMARY KEY,
        status TEXT NOT NULL,
        publish_request_id TEXT,
        published_post_id TEXT,
        publish_error_message TEXT,
        published_at TEXT,
        processing_started_at TEXT
      )`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO scheduled_posts (id, status, processing_started_at)
       VALUES
         (1, 'posting', datetime('now', '-10 minutes')),
         (2, 'posting', CURRENT_TIMESTAMP)`,
    ).run();

    await recoverStalePostingScheduledPosts(env);

    const stale = await env.DB.prepare(
      `SELECT status, publish_error_message FROM scheduled_posts WHERE id = 1`,
    ).first<{ status: string; publish_error_message: string | null }>();
    const fresh = await env.DB.prepare(
      `SELECT status, publish_error_message FROM scheduled_posts WHERE id = 2`,
    ).first<{ status: string; publish_error_message: string | null }>();
    expect(stale).toMatchObject({
      status: "posting",
      publish_error_message: "publish_state_unknown_reconciliation_required",
    });
    expect(fresh).toMatchObject({ status: "posting", publish_error_message: null });
  });

  it("quarantines uncertain attempts and treats returned Threads ids as authoritative", async () => {
    await env.DB.prepare(
      `CREATE TABLE scheduled_posts (
        id INTEGER PRIMARY KEY,
        status TEXT NOT NULL,
        publish_request_id TEXT,
        published_post_id TEXT,
        publish_error_message TEXT,
        published_at TEXT,
        processing_started_at TEXT
      )`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO scheduled_posts (id, status, processing_started_at)
       VALUES (3, 'posting', CURRENT_TIMESTAMP)`,
    ).run();

    expect(await quarantineScheduledPostPublishAttempt(env, 3, "threads_publish_commit_exception")).toBe(true);
    const quarantined = await env.DB.prepare(
      `SELECT status, publish_error_message FROM scheduled_posts WHERE id = 3`,
    ).first<{ status: string; publish_error_message: string | null }>();
    expect(quarantined).toMatchObject({
      status: "posting",
      publish_error_message: "threads_publish_commit_exception",
    });

    await env.DB.prepare(`UPDATE scheduled_posts SET status = 'approved' WHERE id = 3`).run();
    expect(await finalizeScheduledPostPublished(env, 3, "request-3", "thread-3")).toBe(true);
    const finalized = await env.DB.prepare(
      `SELECT status, publish_request_id, published_post_id, publish_error_message, published_at
       FROM scheduled_posts WHERE id = 3`,
    ).first<Record<string, unknown>>();
    expect(finalized).toMatchObject({
      status: "posted",
      publish_request_id: "request-3",
      published_post_id: "thread-3",
      publish_error_message: null,
    });
    expect(finalized?.published_at).toBeTruthy();
  });

  it("admits Insights collection at four Eastern-time windows across daylight-saving changes", () => {
    for (const timestamp of [
      "2026-07-15T04:00:00.000Z",
      "2026-07-15T10:00:00.000Z",
      "2026-07-15T16:00:00.000Z",
      "2026-07-15T22:00:00.000Z",
      "2026-01-15T05:00:00.000Z",
      "2026-01-15T11:00:00.000Z",
    ]) {
      expect(isSixHourInsightsRefreshWindow(Date.parse(timestamp)), timestamp).toBe(true);
    }
    expect(isSixHourInsightsRefreshWindow(Date.parse("2026-07-15T05:00:00.000Z"))).toBe(false);
    expect(isSixHourInsightsRefreshWindow(Date.parse("2026-01-15T06:00:00.000Z"))).toBe(false);
  });

  it("quarantines structurally impossible post metrics from learning", () => {
    const valid = evaluateThreadsPostMetricsForLearning({
      id: "valid-post",
      text: "Valid",
      timestamp: null,
      permalink: null,
      username: null,
      profile_picture_url: null,
      views: 1000,
      likes: 100,
      replies: 10,
      reposts: 5,
      quotes: 2,
      shares: 3,
      engagement_total: 120,
    });
    expect(valid.validForLearning).toBe(true);
    expect(valid.anomalyReason).toBeNull();

    const broken = evaluateThreadsPostMetricsForLearning({
      id: "broken-post",
      text: "Broken",
      timestamp: null,
      permalink: null,
      username: null,
      profile_picture_url: null,
      views: 1,
      likes: 50000,
      replies: 100000,
      reposts: 500000,
      quotes: 0,
      shares: 1000000,
      engagement_total: 1650000,
    });
    expect(broken.validForLearning).toBe(false);
    expect(broken.anomalyReason).toContain("likes_exceeds_views");
        expect(broken.anomalyReason).toContain("shares_exceeds_views");
  });

  it("routes the exact monthly growth question to one bounded analytics response", async () => {
    await env.DB.prepare(`DROP TABLE IF EXISTS threads_follower_snapshots`).run();
    await env.DB.prepare(
      `CREATE TABLE threads_follower_snapshots (
        threads_user_id TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        followers_count INTEGER NOT NULL,
        baseline_followers_count INTEGER,
        captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (threads_user_id, snapshot_date)
      )`,
    ).run();
        await env.DB.prepare(
      `INSERT INTO threads_follower_snapshots (
        threads_user_id, snapshot_date, followers_count, baseline_followers_count, captured_at
      ) VALUES
        ('35758578720393972', '2026-07-01', 105, 100, '2026-07-01T12:00:00Z'),
        ('35758578720393972', '2026-07-17', 145, 140, '2026-07-17T12:00:00Z')`,
    ).run();
    await env.DB.prepare(`DROP TABLE IF EXISTS threads_accounts`).run();
    await env.DB.prepare(
      `CREATE TABLE threads_accounts (
        threads_user_id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        configured_account_id TEXT
      )`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO threads_accounts (threads_user_id, access_token, expires_at, created_at, configured_account_id)
       VALUES ('35758578720393972', 'test-token-manifest', 0, 0, 'manifest-mental')`,
    ).run();
    await env.DB.prepare(
      `CREATE TABLE threads_posts_archive (
        threads_user_id TEXT NOT NULL,
        post_id TEXT NOT NULL,
        post_text TEXT,
        post_timestamp TEXT,
        post_permalink TEXT,
        post_username TEXT,
        profile_picture_url TEXT,
        views INTEGER NOT NULL DEFAULT 0,
        likes INTEGER NOT NULL DEFAULT 0,
        replies INTEGER NOT NULL DEFAULT 0,
        reposts INTEGER NOT NULL DEFAULT 0,
        quotes INTEGER NOT NULL DEFAULT 0,
        shares INTEGER NOT NULL DEFAULT 0,
        engagement_total INTEGER NOT NULL DEFAULT 0,
        source_rank INTEGER NOT NULL DEFAULT 0,
        first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (threads_user_id, post_id)
      )`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO threads_posts_archive (
        threads_user_id, post_id, post_text, post_timestamp, post_permalink,
        views, likes, replies, reposts, quotes, shares, engagement_total
      ) VALUES
        ('35758578720393972', 'july-winner', 'July winner', '2026-07-10T16:00:00Z', 'https://threads.net/july-winner', 5000, 900, 40, 30, 5, 2, 977),
        ('35758578720393972', 'july-second', 'July second', '2026-07-12T16:00:00Z', 'https://threads.net/july-second', 3000, 400, 80, 10, 2, 1, 493)`,
    ).run();

    
    const beforeProceedSnapshots = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM threads_follower_snapshots WHERE threads_user_id = ?`,
    ).bind("35758578720393972").first<{ total: number }>();
    expect(Number(beforeProceedSnapshots?.total ?? 0)).toBe(2);

    await ensureMcpAccountOpen("manifest_mental");

    const afterProceedSnapshots = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM threads_follower_snapshots WHERE threads_user_id = ?`,
    ).bind("35758578720393972").first<{ total: number }>();
    expect(Number(afterProceedSnapshots?.total ?? 0)).toBe(2);

    const result = await mcpToolRaw<Record<string, unknown>>("get_monthly_growth_review", {
      brand_key: "manifest_mental",
      proceed_confirmed: true,
      date_from: "2026-07-01",
      date_to: "2026-07-17",
      timezone: "America/New_York",
      top_limit: 5,
    });
    expect(result.isError).not.toBe(true);
        const payload = result.structuredContent as {
      threads_user_id?: string;
      follower_growth?: { starting_followers?: number; current_followers?: number; net_growth?: number };
      post_performance?: { by_views?: Array<{ id: string }> };
    };
    expect(payload.threads_user_id).toBe("35758578720393972");
    expect(payload.follower_growth).toMatchObject({ starting_followers: 100, current_followers: 145, net_growth: 45 });
    expect(payload.post_performance?.by_views?.[0]?.id).toBe("july-winner");
    expect(new TextEncoder().encode(JSON.stringify(result.structuredContent)).byteLength).toBeLessThanOrEqual(24000);
  }, 15000);

  it("opens a guided Growth Mission discussion after Proceed and blocks account mutations until approval", async () => {
    const selected = await mcpToolRaw<{ selected_key: string }>("selectOperatorKey", { brand_key: "manifest_mental" });
    expect(selected.isError).not.toBe(true);
    expect(selected.structuredContent.selected_key).toBe("manifest_mental");

    const proceeded = await mcpToolRaw<{
      account_execution_locked_until_growth_plan_approval: boolean;
      required_next_owner_action: string;
      continuity_capsule: {
        growth_mission_brief: {
          version: string;
          status: string;
          proposed_plan: { target_followers: number; execution_mode: string };
          discussion_contract: { execution_locked: boolean; no_account_mutation_before_approval: boolean };
        };
        workflow_checkpoint: { next_pending_action: string; next_owner_checkpoint: string };
      };
    }>("confirmOperatorProceed", { brand_key: "manifest_mental" });
    expect(proceeded.isError).not.toBe(true);
    expect(proceeded.structuredContent.account_execution_locked_until_growth_plan_approval).toBe(true);
    expect(proceeded.structuredContent.required_next_owner_action).toContain("Growth Mission Brief");
    expect(proceeded.structuredContent.continuity_capsule.growth_mission_brief).toMatchObject({
            version: "autonomous-growth-mission-v2",
      status: "discussion",
      proposed_plan: { target_followers: 1000000, execution_mode: "guided_owner_approval" },
      discussion_contract: { execution_locked: true, no_account_mutation_before_approval: true },
    });
    expect(proceeded.structuredContent.continuity_capsule.workflow_checkpoint).toMatchObject({
      next_pending_action: "discuss_growth_mission_brief",
      next_owner_checkpoint: "growth_mission_brief",
    });

    const blocked = await mcpToolRaw<Record<string, unknown>>("approve_draft", {
      brand_key: "manifest_mental",
      draft_id: "not-yet-authorized",
      proceed_confirmed: true,
    });
    expect(blocked.isError).toBe(true);
    expect(blocked.structuredContent).toMatchObject({
      error: "approved_growth_mission_required",
      account_execution_locked: true,
      growth_mission_status: "discussion",
      required_next_tool: "updateGrowthMission",
    });

    const approved = await mcpToolRaw<{
      account_execution_unlocked: boolean;
      full_auto_enabled: boolean;
      growth_mission: { status: string; execution_mode: string };
    }>("updateGrowthMission", {
      brand_key: "manifest_mental",
      status: "approved",
      execution_mode: "guided_owner_approval",
      mission_patch: {
        permanent_mission: "Grow Manifest Mental to 1,000,000 followers while protecting audience trust, content quality, account safety, and brand identity.",
        target_followers: 1000000,
        current_bottleneck: "evidence_led_growth_focus",
        primary_objective: "Increase the share of posts outperforming the recent account baseline.",
        recommended_next_action: "Prepare the first owner-reviewed execution batch.",
      },
      owner_response: "I approve this guided plan, not full auto.",
      change_summary: "Approved Guided Growth Mission v1.",
      proceed_confirmed: true,
    });
    expect(approved.isError).not.toBe(true);
    expect(approved.structuredContent).toMatchObject({
      account_execution_unlocked: true,
      full_auto_enabled: false,
      growth_mission: { status: "approved", execution_mode: "guided_owner_approval" },
    });
  }, 15000);

  it("fingerprints content and evaluates age-matched post performance without follower attribution", () => {
    const fingerprint = buildOperatorPostFingerprint({
      text: "Trust what your intuition keeps telling you. BELIEVE IT.",
      strategy: {
        pillar: "intuition",
        hook_style: "direct_validation",
        format: "short_text",
        intent: "reassurance",
        experiment: "payoff_test",
        novelty_level: "improvement",
      },
      sourceCard: {
        source_mechanism: "urgent_internal_warning",
        required_product: "permission_to_trust_yourself",
      },
      sourceSelection: { source_identity_key: "threads:source-1" },
      adaptationPlan: { adaptation_style: "structure_preserving_rewrite" },
    });
        expect(OPERATOR_PERFORMANCE_MATURITY_CHECKPOINTS).toEqual([6, 12, 18, 24]);
    expect(fingerprint).toMatchObject({
      hook_style: "direct_validation",
      topic: "intuition",
      source_mechanism: "urgent_internal_warning",
      payoff_style: "all_caps_declaration",
      adaptation_style: "structure_preserving_rewrite",
      direct_address: "yes",
    });
    expect(JSON.stringify(fingerprint)).not.toContain("follower");

    const observation = buildOperatorMaturityObservation({
      checkpointHours: 12,
      currentMetrics: {
        views: 260,
        likes: 30,
        replies: 6,
        reposts: 3,
        quotes: 1,
        shares: 2,
        engagement_total: 42,
      },
      currentAgeHours: 12,
      previousMetrics: {
        views: 100,
        likes: 8,
        replies: 1,
        reposts: 0,
        quotes: 0,
        shares: 0,
        engagement_total: 9,
      },
      previousAgeHours: 6,
    });
    expect(observation.distribution_state).toBe("accelerating");
    expect(observation.rates.like_rate).toBeCloseTo(30 / 260, 6);
    expect(observation.rates.propagation_rate).toBeCloseTo(6 / 260, 6);
    expect(observation.velocity.interval_views_per_hour).toBeCloseTo(160 / 6, 3);
    expect(JSON.stringify(observation)).not.toContain("follower");
    });

  it("reads Content Focus through a direct typed Main tool after Proceed", async () => {
    await ensureMcpAccountOpen("manifest_mental");
    const result = await mcpToolRaw<{
      success: boolean;
      brand_key: string;
      content_focus: { version: string; reviews: Record<string, unknown>; family_states: unknown[] };
    }>("get_content_focus", {
      brand_key: "manifest_mental",
    });
    expect(result.isError, JSON.stringify(result.structuredContent)).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      success: true,
      brand_key: "manifest_mental",
            content_focus: { version: "content-focus-v2" },
    });
    expect(result.structuredContent.content_focus.reviews).toBeTruthy();
    expect(Array.isArray(result.structuredContent.content_focus.family_states)).toBe(true);
  }, 30000);

  it("classifies source-card families with daily, weekly, and monthly authority", () => {
    const strong = classifyOperatorContentFocusFamily({
      cadence: "weekly",
      horizons: {
        operating_7d: { post_count: 3, mature_count: 3, strong_count: 2, weak_count: 0, median_overall: 72, latest_overall: 75 },
        baseline_30d: { post_count: 4, mature_count: 4, strong_count: 3, weak_count: 0, median_overall: 70, latest_overall: 75 },
        strategic_90d: { post_count: 5, mature_count: 5, strong_count: 3, weak_count: 0, median_overall: 68, latest_overall: 75 },
      },
    });
    expect(strong.status).toBe("repeat");
    expect(strong.allocation_weight).toBe(1.5);

    const daily = classifyOperatorContentFocusFamily({
      cadence: "daily",
      current_status: "repeat",
      fatigue_ratio: 0.6,
      horizons: {
        operating_7d: { post_count: 5, mature_count: 3, strong_count: 0, weak_count: 3, median_overall: 34, latest_overall: 30 },
        baseline_30d: { post_count: 6, mature_count: 4, strong_count: 2, weak_count: 2, median_overall: 55, latest_overall: 30 },
      },
    });
    expect(daily.status).toBe("repeat");
    expect(daily.recommended_status).toBe("hold");

    const weakHorizons = {
      operating_7d: { post_count: 4, mature_count: 3, strong_count: 0, weak_count: 3, median_overall: 30, latest_overall: 28 },
      baseline_30d: { post_count: 6, mature_count: 5, strong_count: 0, weak_count: 4, median_overall: 32, latest_overall: 28 },
      strategic_90d: { post_count: 8, mature_count: 7, strong_count: 0, weak_count: 6, median_overall: 29, latest_overall: 28 },
    };
    expect(classifyOperatorContentFocusFamily({ cadence: "weekly", horizons: weakHorizons }).status).toBe("hold");
    expect(classifyOperatorContentFocusFamily({ cadence: "monthly", horizons: weakHorizons }).status).toBe("retire");
  });

  it("limits daily focus to use-more, use-less, and learn-next decisions", () => {
    const decisions = buildOperatorContentFocusDailyDecisions([
      { source_card_family_id: "winner", status: "repeat", operating_score: 76, baseline_score: 72, mature_count: 5, strong_count: 3, weak_count: 0, fatigue_ratio: 0.2 },
      { source_card_family_id: "fatigued", status: "hold", operating_score: 31, baseline_score: 44, mature_count: 4, strong_count: 0, weak_count: 3, fatigue_ratio: 0.55 },
      { source_card_family_id: "question", status: "test", recommended_status: "expand", operating_score: 55, baseline_score: 58, mature_count: 1, strong_count: 1, weak_count: 0, fatigue_ratio: 0.1 },
    ]);
    expect(decisions).toHaveLength(3);
    expect(decisions.map((decision) => decision.role)).toEqual(["use_more", "use_less", "learn_next"]);
    expect(new Set(decisions.map((decision) => decision.source_card_family_id)).size).toBe(3);
  });

    it("selects an adaptive portfolio without fixed ratios and excludes inactive families", () => {
    const result = selectOperatorContentFocusSources([
      { source_identity_key: "repeat-1", focus_status: "repeat", focus_weight: 1.5, focus_observed: true, confidence_score: 90 },
      { source_identity_key: "repeat-2", focus_status: "repeat", focus_weight: 1.5, focus_observed: true, confidence_score: 85 },
      { source_identity_key: "expand-1", focus_status: "expand", focus_weight: 1.25, focus_observed: true, confidence_score: 75 },
      { source_identity_key: "test-1", focus_status: "test", focus_weight: 1, focus_observed: true, confidence_score: 70 },
      { source_identity_key: "new-1", focus_status: "test", focus_weight: 1, focus_observed: false, confidence_score: 10 },
      { source_identity_key: "hold-1", focus_status: "hold", focus_weight: 0, focus_observed: true },
      { source_identity_key: "retire-1", focus_status: "retire", focus_weight: 0, focus_observed: true },
      { source_identity_key: "blocked-1", focus_status: "blocked", focus_weight: 0, focus_observed: true },
    ], 4, () => 0.5);
    const selected = result.selected.map((item) => item.source_identity_key);
    expect(selected).toHaveLength(4);
    expect(selected).toEqual(expect.arrayContaining(["repeat-1", "repeat-2", "expand-1", "test-1"]));
    expect(selected).not.toEqual(expect.arrayContaining(["hold-1", "retire-1", "blocked-1"]));
    expect(result.allocation).toMatchObject({
      strategy: "adaptive_expected_marginal_value",
      fixed_percentages: false,
      excluded_zero_allocation_count: 3,
    });
  });

  it("builds the exact 48-hour rolling runway from the next viable hour", () => {
    const slots = buildManifestRollingHourlySlots("2026-07-21", 6, 48);
    expect(slots).toHaveLength(48);
    expect(slots[0]).toEqual({ key: "2026-07-21T07:00", date: "2026-07-21", time: "07:00" });
    expect(slots[16]).toEqual({ key: "2026-07-21T23:00", date: "2026-07-21", time: "23:00" });
    expect(slots[17]).toEqual({ key: "2026-07-22T00:00", date: "2026-07-22", time: "00:00" });
    expect(slots[40]).toEqual({ key: "2026-07-22T23:00", date: "2026-07-22", time: "23:00" });
    expect(slots[47]).toEqual({ key: "2026-07-23T06:00", date: "2026-07-23", time: "06:00" });
  });

  it("preserves a frequent winner until comparable mature performance actually decays", () => {
    const frequentWinner = classifyManifestAutonomousFamilyRole({
      baseline_mature_count: 6,
      baseline_median_overall: 74,
      operating_mature_count: 4,
      operating_median_overall: 72,
      strong_count: 5,
      recent_use_count: 7,
      execution_similarity_ratio: 0.3,
    });
    expect(frequentWinner).toMatchObject({ role: "franchise", actual_decay: false });

    const decayingWinner = classifyManifestAutonomousFamilyRole({
      baseline_mature_count: 8,
      baseline_median_overall: 76,
      operating_mature_count: 3,
      operating_median_overall: 57,
      strong_count: 5,
      recent_use_count: 3,
      execution_similarity_ratio: 0.7,
    });
    expect(decayingWinner).toMatchObject({ role: "cooling", actual_decay: true });
  });

  it("ranks franchise and emerging opportunities above prospects without rigid quotas", () => {
    const ranked = rankManifestAutonomousPortfolioCandidates([
      { source_identity_key: "prospect", autonomous_role: "prospect", expected_value: 10 },
      { source_identity_key: "franchise", autonomous_role: "franchise", expected_value: 5 },
      { source_identity_key: "emerging", autonomous_role: "emerging", expected_value: 8 },
      { source_identity_key: "cooling", autonomous_role: "cooling", expected_value: 30, actual_decay: true },
    ], () => 0.5);
    expect(ranked.map((item) => item.source_identity_key).slice(0, 2)).toEqual(["franchise", "emerging"]);
    expect(ranked.at(-1)?.source_identity_key).toBe("cooling");
  });

    it("arms, executes, and re-arms the independent scheduled-post alarm with shared cron health", async () => {

        const values = new Map<string, unknown>();
    let alarmAt: number | null = null;
    let exclusiveControlCount = 0;
    const state = {
      blockConcurrencyWhile: async <T>(callback: () => Promise<T>) => {
        exclusiveControlCount += 1;
        return callback();
      },
      storage: {
        get: async (key: string) => values.get(key),
        put: async (key: string, value: unknown) => {
          values.set(key, value);
        },
        getAlarm: async () => alarmAt,
        setAlarm: async (value: number | Date) => {
          alarmAt = typeof value === "number" ? value : value.getTime();
        },
      },
    } as unknown as DurableObjectState;
        const scheduler = new ScheduledPostScheduler(state, env as unknown as ConstructorParameters<typeof ScheduledPostScheduler>[1]);

    const initialResponse = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/health"));
    const initial = await initialResponse.json() as { healthy: boolean; heartbeat_fresh: boolean; run_count: number };
    expect(initial.healthy).toBe(false);
    expect(initial.heartbeat_fresh).toBe(false);
    expect(initial.run_count).toBe(0);

    const armResponse = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/arm", { method: "POST" }));
    expect(armResponse.ok).toBe(true);
    const armed = await armResponse.json() as { health: { next_alarm_at: string | null } };
    expect(armed.health.next_alarm_at).toBeTruthy();

    await scheduler.alarm();

    const alarmHealthResponse = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/health"));
    const alarmHealth = await alarmHealthResponse.json() as {
      healthy: boolean;
      heartbeat_fresh: boolean;
      last_trigger: string;
      last_success: boolean;
      run_count: number;
      alarm_last_completed_at: string | null;
      next_alarm_at: string | null;
      overdue_before: number;
      overdue_after: number;
    };
    expect(alarmHealth.healthy).toBe(true);
    expect(alarmHealth.heartbeat_fresh).toBe(true);
    expect(alarmHealth.last_trigger).toBe("alarm");
    expect(alarmHealth.last_success).toBe(true);
    expect(alarmHealth.run_count).toBe(1);
    expect(alarmHealth.alarm_last_completed_at).toBeTruthy();
    expect(alarmHealth.next_alarm_at).toBeTruthy();
    expect(alarmHealth.overdue_before).toBe(0);
    expect(alarmHealth.overdue_after).toBe(0);
    expect(Date.parse(String(alarmHealth.next_alarm_at))).toBeGreaterThanOrEqual(Date.parse(String(armed.health.next_alarm_at)));

    const cronHeartbeat = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trigger: "cron", phase: "completed", overdue_before: 0, overdue_after: 0 }),
    }));
    expect(cronHeartbeat.ok).toBe(true);
    const sharedHealthResponse = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/health"));
    const sharedHealth = await sharedHealthResponse.json() as {
      last_trigger: string;
      cron_last_completed_at: string | null;
      last_success: boolean;
      run_count: number;
    };
        expect(sharedHealth.last_trigger).toBe("cron");
    expect(sharedHealth.cron_last_completed_at).toBeTruthy();
    expect(sharedHealth.last_success).toBe(true);
    expect(sharedHealth.run_count).toBe(1);

        const automaticHealth = await (await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/health"))).json() as {
      control: { mode: string; allowed_post_ids: number[]; max_posts: number };
    };
    expect(automaticHealth.control).toMatchObject({ mode: "normal", allowed_post_ids: [], max_posts: 25 });
    const explicitPause = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "paused", reason: "explicit maintenance fixture" }),
    }));
    expect(explicitPause.ok).toBe(true);

    const firstInsert = await env.DB.prepare(
      `INSERT INTO scheduled_posts (user_id, threads_user_id, post_text, status, scheduled_time)
       VALUES ('workspace-owner', 'missing-account', 'Canary target', 'approved', '2000-01-01T00:00:00.000Z')`,
    ).run();
    const secondInsert = await env.DB.prepare(
      `INSERT INTO scheduled_posts (user_id, threads_user_id, post_text, status, scheduled_time)
       VALUES ('workspace-owner', 'missing-account', 'Held overdue post', 'approved', '2000-01-01T00:01:00.000Z')`,
    ).run();
    const firstPostId = Number(firstInsert.meta?.last_row_id ?? 0);
    const secondPostId = Number(secondInsert.meta?.last_row_id ?? 0);

    await scheduler.alarm();
    const heldBeforeCanary = await env.DB.prepare(
      `SELECT id, last_attempted_at FROM scheduled_posts WHERE id IN (?, ?) ORDER BY id`,
    ).bind(firstPostId, secondPostId).all<{ id: number; last_attempted_at: string | null }>();
    expect((heldBeforeCanary.results ?? []).every((row) => row.last_attempted_at === null)).toBe(true);

    const invalidCanary = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "canary", allowed_post_ids: [firstPostId, secondPostId], reason: "invalid fixture" }),
    }));
    expect(invalidCanary.status).toBe(400);

    const canaryControl = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "canary", allowed_post_ids: [firstPostId], reason: "isolated fixture" }),
    }));
    expect(canaryControl.ok).toBe(true);
    const canaryRun = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ trigger: "cron" }),
    }));
    expect(canaryRun.ok).toBe(true);

    const afterCanary = await (await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/health"))).json() as {
      control: { mode: string; allowed_post_ids: number[]; max_posts: number };
      last_processed_count: number;
      last_processed_post_ids: number[];
      last_trigger: string;
    };
    expect(afterCanary.control).toMatchObject({ mode: "paused", allowed_post_ids: [], max_posts: 0 });
    expect(afterCanary.last_trigger).toBe("cron");
    expect(afterCanary.last_processed_count).toBe(1);
    expect(afterCanary.last_processed_post_ids).toEqual([firstPostId]);

    const audited = await env.DB.prepare(
      `SELECT id, status, last_attempted_at, publish_error_message
       FROM scheduled_posts WHERE id IN (?, ?) ORDER BY id`,
    ).bind(firstPostId, secondPostId).all<{
      id: number;
      status: string;
      last_attempted_at: string | null;
      publish_error_message: string | null;
    }>();
    const rows = audited.results ?? [];
    expect(rows.find((row) => row.id === firstPostId)?.last_attempted_at).toBeTruthy();
    expect(rows.find((row) => row.id === firstPostId)?.publish_error_message).toContain("threads_account_not_connected");
        expect(rows.find((row) => row.id === secondPostId)).toMatchObject({
      status: "approved",
      last_attempted_at: null,
      publish_error_message: null,
    });

    const blockedActivation = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "normal", reason: "must remain blocked with overdue rows" }),
    }));
    expect(blockedActivation.status).toBe(409);
    const blockedPayload = await blockedActivation.json() as {
      error: string;
      control: { mode: string };
      overdue_post_ids: number[];
      required_recovery_actions: string[];
    };
    expect(blockedPayload.error).toBe("scheduler_overdue_recovery_required");
    expect(blockedPayload.control.mode).toBe("paused");
    expect(blockedPayload.overdue_post_ids).toEqual([secondPostId]);
    expect(blockedPayload.required_recovery_actions).toEqual(["retire", "reschedule"]);

    const futureScheduledTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const recoveryResponse = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/recover-overdue", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "bounded recovery fixture",
        actions: [
          { scheduled_post_id: firstPostId, action: "reschedule", scheduled_time: futureScheduledTime },
          { scheduled_post_id: secondPostId, action: "retire" },
        ],
      }),
    }));
    const recoveryPayload = await recoveryResponse.json() as {
      ok?: boolean;
      error?: string;
      recovery: {
        retired_post_ids: number[];
        rescheduled_post_ids: number[];
        remaining_overdue_post_ids: number[];
      };
    };
    expect(recoveryResponse.ok, `recovery failed: ${JSON.stringify(recoveryPayload)}`).toBe(true);
    expect(recoveryPayload.recovery.retired_post_ids).toEqual([secondPostId]);
    expect(recoveryPayload.recovery.rescheduled_post_ids).toEqual([firstPostId]);
    expect(recoveryPayload.recovery.remaining_overdue_post_ids).toEqual([]);

    const recoveredRows = await env.DB.prepare(
      `SELECT id, scheduled_time, cancelled_at, publish_error_message
       FROM scheduled_posts WHERE id IN (?, ?) ORDER BY id`,
    ).bind(firstPostId, secondPostId).all<{
      id: number;
      scheduled_time: string;
      cancelled_at: string | null;
      publish_error_message: string | null;
    }>();
    const recovered = recoveredRows.results ?? [];
    expect(recovered.find((row) => row.id === firstPostId)).toMatchObject({
      scheduled_time: futureScheduledTime,
      cancelled_at: null,
      publish_error_message: null,
    });
    expect(recovered.find((row) => row.id === secondPostId)?.cancelled_at).toBeTruthy();

    const normalActivation = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "normal", reason: "overdue set resolved" }),
    }));
    expect(normalActivation.ok).toBe(true);
    const normalPayload = await normalActivation.json() as { control: { mode: string } };
    expect(normalPayload.control.mode).toBe("normal");
    expect(exclusiveControlCount).toBeGreaterThanOrEqual(3);

    const stalePause = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "paused", reason: "Preserve scheduler paused during deployment smoke." }),
    }));
    expect(stalePause.ok).toBe(true);
    const staleControl = values.get("control") as Record<string, unknown>;
    values.set("control", {
      ...staleControl,
      updated_at: "2000-01-01T00:00:00.000Z",
    });
    const staleInsert = await env.DB.prepare(
      `INSERT INTO scheduled_posts (user_id, threads_user_id, post_text, status, scheduled_time)
       VALUES ('workspace-owner', 'missing-account', 'Stale deployment pause target', 'approved', '2000-01-01T00:02:00.000Z')`,
    ).run();
    const stalePostId = Number(staleInsert.meta?.last_row_id ?? 0);

    await scheduler.alarm();

    const autoResumed = await (await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/health"))).json() as {
      control: { mode: string; reason: string | null };
      operational: boolean;
      publishing_enabled: boolean;
      blocked_reason: string | null;
      attention_required: boolean;
      quarantined_post_ids: number[];
      current_overdue_count: number;
    };
    expect(autoResumed.control.mode).toBe("normal");
    expect(autoResumed.control.reason).toContain("auto_resumed_temporary_pause");
    expect(autoResumed.operational).toBe(true);
    expect(autoResumed.publishing_enabled).toBe(true);
    expect(autoResumed.blocked_reason).toBeNull();
    expect(autoResumed.attention_required).toBe(true);
    expect(autoResumed.quarantined_post_ids).toContain(stalePostId);
    expect(autoResumed.current_overdue_count).toBeGreaterThanOrEqual(1);
    const staleRow = await env.DB.prepare(
      `SELECT last_attempted_at, publish_error_message FROM scheduled_posts WHERE id = ?`,
    ).bind(stalePostId).first<{ last_attempted_at: string | null; publish_error_message: string | null }>();
    expect(staleRow?.last_attempted_at).toBeTruthy();
    expect(staleRow?.publish_error_message).toContain("threads_account_not_connected");
    await env.DB.prepare(
      `UPDATE scheduled_posts SET cancelled_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(stalePostId).run();

    const teardownPause = await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "paused", reason: "scheduler regression teardown" }),
    }));
    expect(teardownPause.ok).toBe(true);
    }, 30000);

  it("automatically consumes an approved scheduled-post canary decision", async () => {
    await operatorTool("list_accounts");
    const inserted = await env.DB.prepare(
      `INSERT INTO scheduled_posts (user_id, threads_user_id, post_text, status, scheduled_time)
       VALUES ('workspace-owner', 'missing-account', 'Approved automatic canary', 'approved', '2000-01-01T00:00:00.000Z')`,
    ).run();
    const scheduledPostId = Number(inserted.meta?.last_row_id ?? 0);
    const decisionId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO operator_decision_proposals (
        id, brand_key, decision_key, category, title, decision_text, rationale, evidence_json,
        expected_outcome, risks_json, reversibility, execution_plan, authorized_tools_json,
        execution_budget_json, status, proposed_by, owner_response, approved_at
      ) VALUES (?, 'manifest_mental', ?, 'risk', ?, ?, 'Owner approved fixture.', ?,
                'Run one canary.', '[]', 'One attempt.', 'Activate and execute one scheduled post canary.',
                ?, ?, 'approved', 'model', 'Proceed', CURRENT_TIMESTAMP)`,
    ).bind(
      decisionId,
      `approved_canary_${scheduledPostId}`,
      `Scheduled post ${scheduledPostId} canary`,
      `Authorize exactly one canary for scheduled post ${scheduledPostId}.`,
      JSON.stringify([{ scheduled_post_id: scheduledPostId }]),
      JSON.stringify(["setScheduledPostSchedulerMode"]),
      JSON.stringify({ setScheduledPostSchedulerMode: 1 }),
    ).run();

    const activated = await activateNextApprovedScheduledPostCanary(env as unknown as Parameters<typeof activateNextApprovedScheduledPostCanary>[0]);
    expect(activated).toMatchObject({
      activated: true,
      decision_id: decisionId,
      scheduled_post_id: scheduledPostId,
      scheduler: {
        control: { mode: "canary", allowed_post_ids: [scheduledPostId] },
      },
    });
    const decision = await env.DB.prepare(
      `SELECT status, outcome_summary FROM operator_decision_proposals WHERE id = ?`,
    ).bind(decisionId).first<{ status: string; outcome_summary: string }>();
    expect(decision?.status).toBe("executed");
    expect(decision?.outcome_summary).toContain(String(scheduledPostId));
    const event = await env.DB.prepare(
      `SELECT status, tool_name FROM operator_decision_execution_events WHERE decision_id = ?`,
    ).bind(decisionId).first<{ status: string; tool_name: string }>();
    expect(event).toEqual({ status: "completed", tool_name: "setScheduledPostSchedulerMode" });

    await mcpToolRaw("setScheduledPostSchedulerMode", {
      mode: "paused",
      reason: "reset automatic canary fixture",
      owner_response: "Proceed",
    });
  }, 30000);

    it("fails closed when a Manifest scheduled post has no generation lineage", async () => {
    await operatorTool("list_accounts");
    const scheduled = await env.DB.prepare(
      `INSERT INTO scheduled_posts (user_id, threads_user_id, post_text, status, scheduled_time)
       VALUES ('workspace-owner', '35758578720393972', 'Unlinked fixture', 'approved', '2026-07-20T12:00:00Z')`,
    ).run();
    const status = await getScheduledPostPublishLineageStatus(
      env,
      Number(scheduled.meta?.last_row_id ?? 0),
      "35758578720393972",
    );
    expect(status).toMatchObject({
      required: true,
      complete: false,
      brand_key: "manifest_mental",
      missing_stages: ["source", "source_card", "generation_run", "draft"],
    });
  });

  it("recovers a known Saved Pattern into complete published-post lineage", async () => {
    await operatorTool("list_accounts");
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
    const patternInsert = await env.DB.prepare(
      `INSERT INTO external_patterns (
        app_user_id, account_id, source_url, post_id, post_text,
        likes, replies, reposts, shares, views, posted_at
      ) VALUES ('lensically', 'manifest-mental',
                'https://www.threads.com/@fixture/post/universe-source',
                'universe-source',
                'Universe! Make the woman reading this a multimillionaire!',
                23100, 135, 1000, 47, 191165, '2026-06-25T01:59:47Z')`,
    ).run();
    const savedPatternId = Number(patternInsert.meta?.last_row_id ?? 0);

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS threads_posts_archive (
        threads_user_id TEXT NOT NULL,
        post_id TEXT NOT NULL,
        post_text TEXT,
        post_timestamp TEXT,
        post_permalink TEXT,
        post_username TEXT,
        profile_picture_url TEXT,
        views INTEGER NOT NULL DEFAULT 0,
        likes INTEGER NOT NULL DEFAULT 0,
        replies INTEGER NOT NULL DEFAULT 0,
        reposts INTEGER NOT NULL DEFAULT 0,
        quotes INTEGER NOT NULL DEFAULT 0,
        shares INTEGER NOT NULL DEFAULT 0,
        engagement_total INTEGER NOT NULL DEFAULT 0,
        source_rank INTEGER NOT NULL DEFAULT 0,
        first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (threads_user_id, post_id)
      )`,
    ).run();
    const publishedPostId = "recovered-universe-winner";
    const publishedText = "Universe, make the person reading this rich enough to pay it off, take the trip, move where they want, and still have money left.";
    await env.DB.prepare(
      `INSERT INTO threads_posts_archive (
        threads_user_id, post_id, post_text, post_timestamp, post_permalink,
        views, likes, replies, reposts, quotes, shares, engagement_total
      ) VALUES ('35758578720393972', ?, ?, '2026-07-18T05:00:08+0000',
                'https://www.threads.com/@manifestmental/post/recovered-universe-winner',
                8680, 1800, 32, 43, 4, 7, 1886)`,
    ).bind(publishedPostId, publishedText).run();
    const scheduledInsert = await env.DB.prepare(
      `INSERT INTO scheduled_posts (
        user_id, threads_user_id, post_text, status, scheduled_time,
        published_post_id, published_at
      ) VALUES ('workspace-owner', '35758578720393972', ?, 'posted',
                '2026-07-18T05:00:00Z', ?, '2026-07-18T05:00:08Z')`,
    ).bind(publishedText, publishedPostId).run();
    const scheduledPostId = Number(scheduledInsert.meta?.last_row_id ?? 0);
    const scheduledCountBeforeBypass = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM scheduled_posts WHERE threads_user_id = '35758578720393972'`,
    ).first<{ total: number | string }>();
    const blockedDirectBatch = await fetchFromWorker("/api/operator/tools/schedule_owner_approved_batch", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        brand_key: "manifest_mental",
        owner_approval: "Approved fixture text only.",
        timezone: "America/New_York",
        posts: [{ text: "This must not bypass lineage.", date: "2026-07-20", time: "12:00" }],
      }),
    });
    expect(blockedDirectBatch.status).toBe(409);
    expect(await blockedDirectBatch.json()).toMatchObject({
      success: false,
      error: "manifest_lineage_preserving_schedule_required",
      account_mutated: false,
    });
    const scheduledCountAfterBypass = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM scheduled_posts WHERE threads_user_id = '35758578720393972'`,
    ).first<{ total: number | string }>();
    expect(Number(scheduledCountAfterBypass?.total ?? 0)).toBe(Number(scheduledCountBeforeBypass?.total ?? 0));

    const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", {
      brand_key: "manifest_mental",
    });

    await ensureMcpAccountOpen("manifest_mental");
    const auditBeforeCall = await mcpToolCallRaw<{
      audited_count: number;
      complete_count: number;
      incomplete_count: number;
      posts: Array<{ published_post_id: string; complete: boolean; missing_stages: string[] }>;
      error?: string;
    }>("audit_published_post_lineage", {
      brand_key: "manifest_mental",
      proceed_confirmed: true,
      minimum_likes: 1000,
      days: 90,
      limit: 10,
    });
    expect(auditBeforeCall.isError, JSON.stringify(auditBeforeCall.structuredContent)).not.toBe(true);
    const auditBefore = auditBeforeCall.structuredContent;
    const incompleteWinner = auditBefore.posts.find((post) => post.published_post_id === publishedPostId);
    expect(incompleteWinner).toMatchObject({ complete: false });
    expect(incompleteWinner?.missing_stages).toEqual(expect.arrayContaining([
      "source",
      "source_card",
      "generation_run",
      "draft",
      "metrics",
    ]));

    const recovered = await operatorTool<{
      source_selection_id: string;
      source_card_id: string;
      recovered_posts: Array<{ generation_run_id: string; draft_id: string }>;
    }>("recover_published_post_lineage", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      saved_pattern_id: savedPatternId,
      published_post_ids: [publishedPostId],
      source_card: {
        title: "Universe direct-reader financial freedom",
        lane_key: "financial_manifestation",
        source_mechanism: "The exact Universe reader opener makes the financial blessing feel personally assigned.",
        required_product: "Keep the exact Universe reader opener and rotate concrete financial-freedom payoffs.",
        transformation_contract: {
          must_preserve_exact: ["Universe, make the person reading this"],
          may_reuse: ["Universe, make the person reading this"],
          must_transform: ["The payoff after the opener."],
          audience_reward: "Concrete financial relief and freedom.",
        },
        forbidden_surfaces: [],
        danger_surfaces: ["Changing the fixed opener."],
        pass_conditions: ["Keep the opener exact."],
        fail_conditions: ["Paraphrase the opener."],
        recommended_direction: "Keep the opener and change the concrete payoff.",
      },
    });

    const auditAfter = await operatorTool<{
      complete_count: number;
      incomplete_count: number;
      posts: Array<{
        published_post_id: string;
        complete: boolean;
        missing_stages: string[];
        lineage: { linked_metric_snapshot_count: number };
      }>;
    }>("audit_published_post_lineage", {
      brand_key: "manifest_mental",
      minimum_likes: 1000,
      days: 90,
      limit: 10,
    });
    const completeWinner = auditAfter.posts.find((post) => post.published_post_id === publishedPostId);
    expect(completeWinner).toMatchObject({ complete: true, missing_stages: [] });
        expect(completeWinner?.lineage.linked_metric_snapshot_count).toBeGreaterThan(0);
    const linkedSnapshot = await env.DB.prepare(
      `SELECT generation_run_id FROM operator_post_metric_snapshots
       WHERE brand_key = 'manifest_mental' AND published_post_id = ? LIMIT 1`,
    ).bind(publishedPostId).first<{ generation_run_id: string | null }>();
    expect(linkedSnapshot?.generation_run_id).toBe(recovered.recovered_posts[0].generation_run_id);

    const results = await operatorTool<{
      metrics: { likes: number };
      lineage: {
        source_selection_id: string;
        source_card_id: string;
        generation_run_id: string;
        draft_id: string;
        scheduled_post_id: number;
      };
      source_card: { transformation_contract: { must_preserve_exact: string[] } };
    }>("get_post_results", {
      brand_key: "manifest_mental",
      published_post_id: publishedPostId,
      include_history: true,
    });
    expect(results.metrics.likes).toBe(1800);
    expect(results.lineage).toMatchObject({
      source_selection_id: recovered.source_selection_id,
      source_card_id: recovered.source_card_id,
      generation_run_id: recovered.recovered_posts[0].generation_run_id,
      draft_id: recovered.recovered_posts[0].draft_id,
      scheduled_post_id: scheduledPostId,
    });
    expect(results.source_card.transformation_contract.must_preserve_exact)
      .toContain("Universe, make the person reading this");

    const compact = await operatorTool<{
      response_mode: string;
      lineage: { source_card_id: string; generation_run_id: string; draft_id: string };
      source: { saved_pattern_id: number; source_text: string };
      source_card: { id: string; version_number: number };
      generation_run: { id: string; metadata: Record<string, unknown> };
      draft: { id: string };
      performance_evaluation?: unknown;
      metric_history?: unknown;
    }>("get_post_results", {
      brand_key: "manifest_mental",
      published_post_id: publishedPostId,
      compact: true,
    });
    expect(compact.response_mode).toBe("compact");
    expect(compact.lineage).toMatchObject({
      source_card_id: recovered.source_card_id,
      generation_run_id: recovered.recovered_posts[0].generation_run_id,
      draft_id: recovered.recovered_posts[0].draft_id,
    });
    expect(compact.source.saved_pattern_id).toBe(savedPatternId);
    expect(compact.source.source_text).toContain("Universe");
    expect(compact.source_card.id).toBe(recovered.source_card_id);
    expect(compact.generation_run.id).toBe(recovered.recovered_posts[0].generation_run_id);
    expect(compact.draft.id).toBe(recovered.recovered_posts[0].draft_id);
    expect(compact.performance_evaluation).toBeUndefined();
    expect(compact.metric_history).toBeUndefined();
    expect(new TextEncoder().encode(JSON.stringify(compact)).byteLength).toBeLessThan(8000);
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
        post_username TEXT,
        profile_picture_url TEXT,
        views INTEGER NOT NULL DEFAULT 0,
        likes INTEGER NOT NULL DEFAULT 0,
        replies INTEGER NOT NULL DEFAULT 0,
        reposts INTEGER NOT NULL DEFAULT 0,
        quotes INTEGER NOT NULL DEFAULT 0,
        shares INTEGER NOT NULL DEFAULT 0,
        engagement_total INTEGER NOT NULL DEFAULT 0,
        source_rank INTEGER NOT NULL DEFAULT 0,
        first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
        ('35758578720393972', 'archive-1500', 'Archive winner', '2026-07-10T12:00:00Z', 'https://www.threads.com/@manifestmental/post/archive-1500', 10000, 1500, 5, 2, 0, 1, 1508),
        ('35758578720393972', 'archive-900', 'Archive below threshold', '2026-07-11T12:00:00Z', 'https://www.threads.com/@manifestmental/post/archive-900', 50000, 900, 2000, 100, 0, 50, 3050)`,
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

    await operatorTool("get_post_results", {
      brand_key: BRAND_KEY,
      published_post_id: publishedPostId,
      include_history: true,
    });
    const snapshotCount = await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM operator_post_metric_snapshots
       WHERE brand_key = ? AND published_post_id = ?`,
    ).bind(BRAND_KEY, publishedPostId).first<{ total: number | string }>();
    expect(Number(snapshotCount?.total ?? 0)).toBe(1);
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

        const second = await operatorTool<{ run_id: string }>("create_generation_run", {
      brand_key: BRAND_KEY,
      source_card_id: first.sourceCardId,
      adaptation_plan: {
        adaptation_goal: "Generate a second candidate to verify account-inventory entrance repetition blocking.",
        transformed_elements: ["calendar payoff"],
        intentionally_different_from_prior: "The payoff changes while the repeated realm entrance remains intentional for this gate regression.",
      },
      prompt_summary: "Reuse the locked source card for the repeated-realm gate regression.",
    });
    const blocked = await operatorTool<{ draft_id: string; showable: boolean; blocking_failures: Array<{ gate_key: string }> }>("submit_candidate_draft", {
      brand_key: BRAND_KEY,
      run_id: second.run_id,
      source_card_id: first.sourceCardId,
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

      it("allows backend-supported review batch language while keeping each generation run source-card scoped", async () => {
    for (const brandKey of ALL_BRAND_KEYS) {
      const { sourceCardId } = await createLockedSourceCard([], brandKey);
      const run = await operatorTool<{ run_id: string; source_card_id: string }>("create_generation_run", {
        brand_key: brandKey,
        source_card_id: sourceCardId,
        adaptation_plan: {
          adaptation_goal: "Create one passing draft for a numbered multi-post owner review batch.",
          preserved_functions: ["Keep this generation run attached to one canonical source card."],
          transformed_elements: ["surface wording"],
          intentionally_different_from_prior: "The review batch groups independent source-card runs rather than placing multiple posts inside one source card.",
        },
        objective: "Prepare one item for a four-post review batch.",
        prompt_summary: "Backend-supported review batch fixture.",
      });
      expect(run.run_id, brandKey).toBeTruthy();
      expect(run.source_card_id).toBe(sourceCardId);
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

  it("keeps the retired local execution HTTP plane unreachable", async () => {
    for (const path of [
      "/api/operator/local-node/enroll",
      "/api/operator/local-node/heartbeat",
      "/api/operator/local-node/poll",
      "/api/operator/local-node/result",
    ]) {
      const response = await fetchFromWorker(path, {
        method: "POST",
        headers: AUTH_HEADERS,
        body: "{}",
      });
      expect(response.status).toBe(404);
    }
  });

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

  it("rejects an MCP session created by a previous Worker deployment before routing", async () => {
    const mutableEnv = env as unknown as {
      CF_VERSION_METADATA?: { id: string };
      LENSICALLY_COMMIT_SHA?: string;
    };
    const originalMetadata = mutableEnv.CF_VERSION_METADATA;
    const originalSha = mutableEnv.LENSICALLY_COMMIT_SHA;
    try {
      mutableEnv.CF_VERSION_METADATA = { id: "deployment-before" };
      mutableEnv.LENSICALLY_COMMIT_SHA = "commit-before";
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
      const staleSessionId = initialized.headers.get("mcp-session-id");
      expect(initialized.status).toBe(200);
      expect(staleSessionId).toBeTruthy();
      expect(initialized.headers.get("x-lensically-deployment-id")).toBe("deployment-before");
      expect(initialized.headers.get("x-lensically-execution-kernel")).toBe("lensically-execution-kernel-v1");

      const malformedRequest = await fetchFromWorker("/api/operator/mcp", {
        method: "POST",
        headers: { ...MCP_AUTH_HEADERS, "Mcp-Session-Id": `${staleSessionId}.invalid` },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      });
      const malformedBody = await malformedRequest.json() as { error?: { data?: { reason?: string } } };
      expect(malformedRequest.status).toBe(404);
      expect(malformedBody.error?.data?.reason).toBe("invalid_mcp_session");

      mutableEnv.CF_VERSION_METADATA = { id: "deployment-after" };
      mutableEnv.LENSICALLY_COMMIT_SHA = "commit-after";
      const staleRequest = await fetchFromWorker("/api/operator/mcp", {
        method: "POST",
        headers: { ...MCP_AUTH_HEADERS, "Mcp-Session-Id": staleSessionId ?? "" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      });
      const staleBody = await staleRequest.json() as { error?: { data?: { reason?: string } } };
      expect(staleRequest.status).toBe(404);
      expect(staleBody.error?.data?.reason).toBe("stale_mcp_deployment_session");
      expect(staleRequest.headers.get("x-lensically-deployment-id")).toBe("deployment-after");
      expect(staleRequest.headers.get("mcp-session-id")).toBeTruthy();
      expect(staleRequest.headers.get("mcp-session-id")).not.toBe(staleSessionId);

      const reinitialized = await fetchFromWorker("/api/operator/mcp", {
        method: "POST",
        headers: MCP_AUTH_HEADERS,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "initialize",
          params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "vitest", version: "1.0.0" } },
        }),
      });
      const freshSessionId = reinitialized.headers.get("mcp-session-id");
      const listed = await fetchFromWorker("/api/operator/mcp", {
        method: "POST",
        headers: { ...MCP_AUTH_HEADERS, "Mcp-Session-Id": freshSessionId ?? "" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} }),
      });
      expect(reinitialized.status).toBe(200);
      expect(freshSessionId).toBeTruthy();
      expect(listed.status).toBe(200);
    } finally {
      if (originalMetadata) mutableEnv.CF_VERSION_METADATA = originalMetadata;
      else delete mutableEnv.CF_VERSION_METADATA;
      if (originalSha !== undefined) mutableEnv.LENSICALLY_COMMIT_SHA = originalSha;
      else delete mutableEnv.LENSICALLY_COMMIT_SHA;
    }
  }, 30000);

  it("advertises the curated direct typed Main surface and concise instructions", async () => {
    const initialized = await mcpRequest<{ instructions: string }>("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
        const listed = await mcpRequest<{ tools: Array<{ name: string; description?: string; inputSchema?: { additionalProperties?: boolean; properties?: Record<string, unknown> } }> }>("tools/list");
    const names = listed.tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining([
      "getOperatorStartupContext",
      "selectOperatorKey",
      "confirmOperatorProceed",
      "getGrowthMission",
      "getWorkflowStatus",
      "get_performance_learning",
      "get_content_focus",
            "get_manifest_review_batch",
            "prepare_manifest_autonomous_cycle",
      "persist_manifest_autonomous_post",
      "review_manifest_scheduled_post",
      "create_source_card",
      "create_generation_run",
      "schedule_approved_draft",
      "getScheduledPostSchedulerState",
      "getRepoStatus",
      "readRepoFile",
      "searchRepoFiles",
      "applyRepoPatchSet",
      "verifyDeployedMcpVersion",
    ]));
    expect(names).not.toEqual(expect.arrayContaining([
      "executeLensicallyIntent",
      "listMcpTools",
      "readMcpToolDefinition",
      "recordHardeningIncident",
      "runEngineeringTool",
      "recordOpsMemory",
      "listOpsMemory",
    ]));
        expect(names.some((name) => /^(mm|om|vx)_/.test(name))).toBe(false);
    expect(listed.tools.every((tool) => tool.inputSchema?.additionalProperties === false)).toBe(true);
        const saveStrategyMemoryTool = listed.tools.find((tool) => tool.name === "save_strategy_memory");
    const saveStrategyMemoryKind = saveStrategyMemoryTool?.inputSchema?.properties?.kind as { enum?: string[] } | undefined;
    expect(saveStrategyMemoryKind?.enum).toEqual(expect.arrayContaining(["approved_rule", "voice_rule", "rejection_feedback"]));
    expect(saveStrategyMemoryKind?.enum).not.toContain("generation_rule");
                const autonomousPersistTool = listed.tools.find((tool) => tool.name === "persist_manifest_autonomous_post");
    const autonomousPrepareTool = listed.tools.find((tool) => tool.name === "prepare_manifest_autonomous_cycle");
    expect(autonomousPrepareTool?.description).toContain("tool discovery or schema loading is not execution");
    expect(autonomousPrepareTool?.description).toContain("no failure may be reported without this tool's returned result");
    expect(autonomousPersistTool?.inputSchema?.properties?.post).toBeTruthy();
    expect(autonomousPersistTool?.inputSchema?.properties?.posts).toBeUndefined();
    expect(names).not.toContain("commit_manifest_autonomous_runway");
    const startup = await mcpTool<{
      runtime?: { execution_kernel?: { name?: string; version?: string; public_contract?: string; deployment_fresh_sessions?: boolean } };
    }>("getOperatorStartupContext");
    expect(startup.runtime?.execution_kernel).toMatchObject({
      name: "Execution Kernel",
      version: "lensically-execution-kernel-v1",
      public_contract: "direct_typed_tools_v1",
      deployment_fresh_sessions: true,
    });
        expect(initialized.instructions).toContain("advertised direct typed tool");
    expect(initialized.instructions).toContain("Tool discovery, schema loading, and tools/list are preparation only and never count as execution.");
    expect(initialized.instructions).toContain("Without a tool result, the only valid status is not invoked");
    expect(initialized.instructions).toContain(`Full tool surface loaded: ${names.length} tools available and usable.`);
    expect(initialized.instructions.length).toBeLessThan(5000);
  }, 30000);

        it("keeps a missing guided review batch non-blocking and routes an active autonomous cycle back to persistence", async () => {
    await activateManifestAutonomyForTest();
    const prepared = await mcpTool<{ cycle: { id: string } }>("prepare_manifest_autonomous_cycle", {
      brand_key: "manifest_mental",
      timezone: "America/New_York",
      horizon_hours: 48,
      operation_id: `test-autonomous-review-route-${crypto.randomUUID()}`,
      proceed_confirmed: true,
    });
    const result = await mcpTool<{
      success: boolean;
      active: boolean;
      state: string;
      normal_work_blocked: boolean;
      autonomous_cycle_active: boolean;
      autonomous_cycle: { cycle_id: string } | null;
      required_tool: string | null;
    }>("get_manifest_review_batch", {
      brand_key: "manifest_mental",
      production_date: "2099-01-01",
      proceed_confirmed: true,
    });
    expect(result).toMatchObject({
      success: true,
      active: false,
      state: "no_active_review_batch",
      normal_work_blocked: false,
      autonomous_cycle_active: true,
      required_tool: "persist_manifest_autonomous_post",
    });
    expect(result.autonomous_cycle?.cycle_id).toBe(prepared.cycle.id);
    const falseIncidents = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM operator_hardening_incidents
       WHERE blocked_tool_name = 'get_manifest_review_batch'
         AND observed_json LIKE '%active_review_batch_not_found%'
         AND state <> 'closed'`,
    ).first<{ total: number }>();
    expect(Number(falseIncidents?.total ?? 0)).toBe(0);
  }, 30000);

    it("prepares the autonomous rolling runway without requiring owner review", async () => {
    await activateManifestAutonomyForTest();
    const prepared = await mcpTool<{
      success: boolean;
            cycle: {
        id: string;
        target_slots: Array<{ key: string; date: string; time: string }>;
        missing_slots: Array<{ key: string }>;
        account_position: { runway: { target_slot_count: number; missing_slot_count: number } };
      };
      strategy_contract: { fixed_percentages: boolean; winner_preservation: string };
            persistence_contract: { tool: string; posts_per_call: number; model_orchestrated: boolean; internal_gate_fanout: boolean; internal_runway_scan: boolean; threads_api_during_persistence: boolean; complete_lineage_required: boolean };
    }>("prepare_manifest_autonomous_cycle", {
      brand_key: "manifest_mental",
      timezone: "America/New_York",
      horizon_hours: 48,
      operation_id: `test-autonomous-prepare-${crypto.randomUUID()}`,
      proceed_confirmed: true,
    });
    expect(prepared.success).toBe(true);
        expect(prepared.cycle.account_position.runway.target_slot_count).toBe(48);
    expect(prepared.cycle.account_position.runway.missing_slot_count).toBeLessThanOrEqual(48);
    expect(prepared.cycle.target_slots.length).toBeGreaterThan(0);
    expect(prepared.cycle.target_slots.length).toBeLessThanOrEqual(48);
    expect(prepared.cycle.missing_slots.length).toBeLessThanOrEqual(48);
    expect(prepared.strategy_contract).toMatchObject({ fixed_percentages: false });
        expect(prepared.strategy_contract.winner_preservation).toContain("Continue using winners");
    expect(prepared.strategy_contract.winner_preservation).toContain("spacing");
                expect(prepared.persistence_contract).toMatchObject({
      tool: "persist_manifest_autonomous_post",
      posts_per_call: 1,
      model_orchestrated: true,
      internal_gate_fanout: false,
      internal_runway_scan: false,
      threads_api_during_persistence: false,
      complete_lineage_required: true,
    });
    }, 30000);

  it("reads the active intelligence policies, latest strategy version, exposure ledger, and latest cycle receipt without mutation", async () => {
    await activateManifestAutonomyForTest();
    const prepared = await mcpTool<{ cycle: { id: string } }>("prepare_manifest_autonomous_cycle", {
      brand_key: "manifest_mental",
      timezone: "America/New_York",
      horizon_hours: 48,
      operation_id: `test-intelligence-foundation-${crypto.randomUUID()}`,
      proceed_confirmed: true,
    });
    const countsBefore = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM operator_manifest_strategy_versions WHERE brand_key = 'manifest_mental') AS strategies,
        (SELECT COUNT(*) FROM operator_manifest_exposure_snapshots WHERE brand_key = 'manifest_mental') AS exposures,
        (SELECT COUNT(*) FROM operator_manifest_cycle_receipts WHERE brand_key = 'manifest_mental') AS receipts`,
    ).first<{ strategies: number; exposures: number; receipts: number }>();
    const first = await mcpTool<{
      intelligence_foundation: {
        foundation_version: string;
        policy: { noninterference: { learning_source: string }; follower_attribution: { account_level_only: boolean } };
        latest_strategy_version: { id: string } | null;
        latest_cycle_receipt: { cycle_id: string; exposure_snapshot: { id: string } | null } | null;
      };
    }>("get_manifest_intelligence_foundation", {
      brand_key: "manifest_mental",
      proceed_confirmed: true,
    });
    const second = await mcpTool<typeof first>("get_manifest_intelligence_foundation", {
      brand_key: "manifest_mental",
      proceed_confirmed: true,
    });
    expect(first.intelligence_foundation.foundation_version).toBe("manifest-intelligence-foundation-v2");
    expect(first.intelligence_foundation.policy.noninterference.learning_source).toBe("observable_post_engagement");
    expect(first.intelligence_foundation.policy.follower_attribution.account_level_only).toBe(true);
    expect(first.intelligence_foundation.latest_strategy_version?.id).toBeTruthy();
    expect(first.intelligence_foundation.latest_cycle_receipt?.cycle_id).toBe(prepared.cycle.id);
    expect(first.intelligence_foundation.latest_cycle_receipt?.exposure_snapshot?.id).toBeTruthy();
    expect(second).toEqual(first);
    const countsAfter = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM operator_manifest_strategy_versions WHERE brand_key = 'manifest_mental') AS strategies,
        (SELECT COUNT(*) FROM operator_manifest_exposure_snapshots WHERE brand_key = 'manifest_mental') AS exposures,
        (SELECT COUNT(*) FROM operator_manifest_cycle_receipts WHERE brand_key = 'manifest_mental') AS receipts`,
    ).first<{ strategies: number; exposures: number; receipts: number }>();
    expect(countsAfter).toEqual(countsBefore);
  }, 30000);

  it("reconciles prepare_manifest_autonomous_cycle again with the same durable operation id", async () => {
    await activateManifestAutonomyForTest();
    const operationId = `test-autonomous-reconcile-${crypto.randomUUID()}`;
    const first = await mcpTool<{ cycle: { id: string } }>("prepare_manifest_autonomous_cycle", {
      brand_key: "manifest_mental",
      timezone: "America/New_York",
      horizon_hours: 48,
      operation_id: operationId,
      proceed_confirmed: true,
    });
        await env.DB.prepare(
      `UPDATE operator_autonomous_growth_cycles SET horizon_start_local = '2000-01-01T00:00' WHERE id = ?`,
    ).bind(first.cycle.id).run();
    await env.DB.prepare(
      `UPDATE operator_manifest_exposure_snapshots SET source_hash = 'stale-test-hash' WHERE cycle_id = ?`,
    ).bind(first.cycle.id).run();

    const second = await mcpTool<{ cycle: { id: string; horizon_start_local: string }; idempotency?: unknown }>(
      "prepare_manifest_autonomous_cycle",
      {
        brand_key: "manifest_mental",
        timezone: "America/New_York",
        horizon_hours: 48,
        operation_id: operationId,
        proceed_confirmed: true,
      },
    );

    expect(second.cycle.id).toBe(first.cycle.id);
    expect(second.cycle.horizon_start_local).not.toBe("2000-01-01T00:00");
    expect(second.idempotency).toBeUndefined();
        const stored = await env.DB.prepare(
      `SELECT horizon_start_local FROM operator_autonomous_growth_cycles WHERE id = ?`,
    ).bind(first.cycle.id).first<{ horizon_start_local: string }>();
    expect(stored?.horizon_start_local).toBe(second.cycle.horizon_start_local);
    const exposure = await env.DB.prepare(
      `SELECT revision, source_hash FROM operator_manifest_exposure_snapshots WHERE cycle_id = ?`,
    ).bind(first.cycle.id).first<{ revision: number; source_hash: string }>();
    expect(Number(exposure?.revision ?? 0)).toBeGreaterThan(1);
    expect(exposure?.source_hash).not.toBe("stale-test-hash");
    const preparationEvents = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM operator_manifest_cycle_receipt_events
       WHERE cycle_id = ? AND event_type = 'cycle_prepared'`,
    ).bind(first.cycle.id).first<{ total: number }>();
    expect(Number(preparationEvents?.total ?? 0)).toBeGreaterThanOrEqual(2);
    }, 30000);

  it("rejects follower attribution before strategy or scheduling state is created", async () => {
    await activateManifestAutonomyForTest();
    const prepared = await mcpTool<{
      cycle: { id: string; missing_slots: Array<{ key: string; date: string; time: string }> };
    }>("prepare_manifest_autonomous_cycle", {
      brand_key: "manifest_mental",
      timezone: "America/New_York",
      horizon_hours: 48,
      operation_id: `test-follower-boundary-prepare-${crypto.randomUUID()}`,
      proceed_confirmed: true,
    });
    const slot = prepared.cycle.missing_slots[0];
    expect(slot).toBeTruthy();
    const strategyBefore = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM operator_manifest_strategy_versions WHERE brand_key = 'manifest_mental'`,
    ).first<{ total: number }>();
    const operationId = `test-follower-boundary-${crypto.randomUUID()}`;
    const rejected = await mcpTool<{ success: boolean; error: string; details: string[] }>("persist_manifest_autonomous_post", {
      brand_key: "manifest_mental",
      cycle_id: prepared.cycle.id,
      strategic_thesis: {
        position: "Test a direct-statement candidate.",
        expected_followers_from_post: 25,
      },
      post: {
        date: slot.date,
        time: slot.time,
        text: `Follower boundary candidate ${crypto.randomUUID().slice(0, 8)}.`,
        generation_mode: "original_discovery",
        family_key: `test_follower_boundary_${crypto.randomUUID().slice(0, 8)}`,
        source_mechanism: "A concise direct statement.",
        audience_reward: "A grounded moment of clarity.",
        strategic_purpose: "Verify the follower attribution boundary.",
        source_context: { kind: "operator_hypothesis", source_type: "operator_hypothesis" },
        hypothesis: {
          expected_response_type: "likes",
          expected_audience_reward: "A grounded moment of clarity.",
          hook_rationale: "The direct statement is immediately accessible.",
          premise_rationale: "The premise offers a concrete emotional reward.",
          exploration_mode: "explore",
          comparable_post_ids: [],
          expected_performance_range: { views: { min: 100, max: 10_000 }, likes: { min: 5, max: 1_000 } },
          uncertainty: "Distribution remains uncertain before maturity.",
          falsification_conditions: ["Comparable mature posts consistently underperform."],
        },
        strategy: { pillar: "clarity", hook_style: "direct_statement", novelty_level: "original_discovery" },
      },
      model_evaluation: {
        generation_passed: true,
        scheduling_passed: true,
        novelty_assessment: "Distinct from current inventory.",
        winner_preservation_assessment: "Does not displace a proven winner.",
        slot_placement_assessment: "Uses an authoritative missing slot.",
        recent_exposure_assessment: "No avoidable recent cluster was found.",
      },
      operation_id: operationId,
      proceed_confirmed: true,
    });
    expect(rejected.success).toBe(false);
    expect(rejected.error).toBe("follower_attribution_forbidden");
    const strategyAfter = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM operator_manifest_strategy_versions WHERE brand_key = 'manifest_mental'`,
    ).first<{ total: number }>();
    expect(Number(strategyAfter?.total ?? 0)).toBe(Number(strategyBefore?.total ?? 0));
    const scheduled = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM operator_autonomous_lineup_items WHERE cycle_id = ? AND slot_key = ?`,
    ).bind(prepared.cycle.id, slot.key).first<{ total: number }>();
    expect(Number(scheduled?.total ?? 0)).toBe(0);
    const rejectionEvent = await env.DB.prepare(
      `SELECT event_type, payload_json FROM operator_manifest_cycle_receipt_events
       WHERE cycle_id = ? AND event_key = ? LIMIT 1`,
    ).bind(prepared.cycle.id, `rejected:${operationId}`).first<{ event_type: string; payload_json: string }>();
    expect(rejectionEvent?.event_type).toBe("candidate_rejected");
    expect(rejectionEvent?.payload_json).toContain("follower_attribution_forbidden");
  }, 30000);

    it("persists one model-orchestrated autonomous post with full lineage into one exact missing slot", async () => {

    await activateManifestAutonomyForTest();
    const prepared = await mcpTool<{
      success: boolean;
      cycle: { id: string; missing_slots: Array<{ key: string; date: string; time: string }> };
    }>("prepare_manifest_autonomous_cycle", {
      brand_key: "manifest_mental",
      timezone: "America/New_York",
      horizon_hours: 48,
      operation_id: `test-autonomous-persist-prepare-${crypto.randomUUID()}`,
      proceed_confirmed: true,
    });
    const slot = prepared.cycle.missing_slots[0];
    expect(slot).toBeTruthy();
    const persistOperationId = `test-autonomous-persist-${crypto.randomUUID()}`;
    const payload = {
      brand_key: "manifest_mental",
      cycle_id: prepared.cycle.id,
      strategic_thesis: {
        position: "Protect the engagement floor while testing one original micro-length mechanism.",
        invalidator: "Comparable mature performance falls materially below the account floor.",
      },
      post: {
        date: slot.date,
        time: slot.time,
                text: "If $25,123 reached you today, what expense disappears first?",
        generation_mode: "adjacent_experiment",
        family_key: "test_specific_money_priority",
        source_mechanism: "A specific-dollar question invites one concrete financial priority.",
        audience_reward: "A specific financial choice worth discussing.",
                strategic_purpose: "Test a controlled specific-money question while proving semantic collision prevention.",
        source_context: {
          kind: "operator_hypothesis",
          source_type: "operator_hypothesis",
        },
        hypothesis: {
          expected_response_type: "balanced_engagement",
                    expected_audience_reward: "A specific financial choice worth discussing.",
          hook_rationale: "The concrete amount creates immediate imagination.",
          premise_rationale: "The question exposes a real spending-priority tradeoff.",
          exploration_mode: "explore",
          comparable_post_ids: [],
          expected_performance_range: {
            views: { min: 100, max: 10_000 },
            likes: { min: 5, max: 1_000 },
          },
                    uncertainty: "The premise may already be overexposed even when the amount changes.",
          falsification_conditions: ["Comparable mature posts consistently underperform the engagement floor."],
          experiment: {
            experiment_key: "test-money-question-payoff-v1",
            hypothesis: { variable: "payoff", expected_effect: "higher conversation rate" },
            comparison_group: { family_key: "test_specific_money_priority", variant_excluded: true },
            maturity_windows: [6, 12, 18, 24],
            result_criteria: { minimum_variant: 3, minimum_control: 3, win_delta: 8, loss_delta: -8 },
            variant_key: "direct-relief-payoff",
          },
        },
        transformed_elements: ["operator_originated_premise"],
        strategy: {
                    pillar: "money",
          hook_style: "specific_money_question",
          format: "direct_question",
          intent: "conversation",
          experiment: "test-money-question-payoff-v1",
          novelty_level: "adjacent_experiment",
        },
      },
      model_evaluation: {
        generation_passed: true,
        scheduling_passed: true,
        novelty_assessment: "The wording and payoff are distinct from current scheduled inventory.",
                winner_preservation_assessment: "The post preserves the proven concise direct-statement mechanism without forcing fatigue rotation.",
        slot_placement_assessment: "The selected slot is the first authoritative future opening in the prepared ET runway.",
        recent_exposure_assessment: "The candidate was checked against recent published and scheduled exposure and does not create an avoidable cluster.",
      },
      operation_id: persistOperationId,
      proceed_confirmed: true,
    };
        const persisted = await mcpTool<{
      success: boolean;
      scheduled_post_id: number;
            lineage: { source_batch_id: string; source_selection_id: string; source_card_id: string; generation_run_id: string; draft_id: string; inventory_id: string; hypothesis_id: string; strategy_version_id: string };
      hypothesis_id: string;
      strategy_version_id: string;
      publish_lineage_complete: boolean;
      intelligence_lineage_complete: boolean;
            experiment_assignment: { id: string; experiment_key: string; variant_key: string; status: string } | null;
      semantic_repetition: { semantic_repetition_blocked: boolean; highest_score: number };
      server_checks: { semantic_repetition_collision: boolean; no_internal_gate_fanout: boolean; no_internal_runway_scan: boolean; no_threads_api_call: boolean };
      remaining_missing_count: number;
    }>("persist_manifest_autonomous_post", payload);
    expect(persisted.success).toBe(true);
    expect(persisted.scheduled_post_id).toBeGreaterThan(0);
        expect(persisted.lineage.source_batch_id).toBeTruthy();
    expect(persisted.lineage.source_selection_id).toBeTruthy();
    expect(persisted.lineage.source_card_id).toBeTruthy();
    expect(persisted.lineage.generation_run_id).toBeTruthy();
    expect(persisted.lineage.draft_id).toBeTruthy();
        expect(persisted.lineage.inventory_id).toBeTruthy();
    expect(persisted.lineage.hypothesis_id).toBeTruthy();
    expect(persisted.lineage.strategy_version_id).toBeTruthy();
    expect(persisted.hypothesis_id).toBe(persisted.lineage.hypothesis_id);
    expect(persisted.strategy_version_id).toBe(persisted.lineage.strategy_version_id);
    expect(persisted.publish_lineage_complete).toBe(true);
        expect(persisted.intelligence_lineage_complete).toBe(true);
    expect(persisted.experiment_assignment).toMatchObject({
      experiment_key: "test_money_question_payoff_v1",
      variant_key: "direct_relief_payoff",
      status: "running",
    });
    expect(persisted.semantic_repetition.semantic_repetition_blocked).toBe(false);
    expect(persisted.server_checks).toMatchObject({
      semantic_repetition_collision: false,
      no_internal_gate_fanout: true,
      no_internal_runway_scan: true,
      no_threads_api_call: true,
    });
    const publishLineage = await getScheduledPostPublishLineageStatus(
      env,
      persisted.scheduled_post_id,
      "35758578720393972",
    );
        expect(publishLineage).toMatchObject({ required: true, complete: true, missing_stages: [] });
    const intelligenceLineage = await env.DB.prepare(
      `SELECT l.hypothesis_id, l.source_selection_id,
              h.status AS hypothesis_status, h.locked_at, h.scheduled_post_id, h.revision
       FROM operator_autonomous_lineup_items l
       JOIN operator_manifest_post_hypotheses h ON h.id = l.hypothesis_id
       WHERE l.cycle_id = ? AND l.slot_key = ? AND l.scheduled_post_id = ? LIMIT 1`,
    ).bind(prepared.cycle.id, slot.key, persisted.scheduled_post_id).first<{
      hypothesis_id: string; source_selection_id: string; hypothesis_status: string;
      locked_at: string | null; scheduled_post_id: number; revision: number;
    }>();
    expect(intelligenceLineage?.hypothesis_id).toBe(persisted.hypothesis_id);
    expect(intelligenceLineage?.source_selection_id).toBe(persisted.lineage.source_selection_id);
    expect(intelligenceLineage?.hypothesis_status).toBe("scheduled");
    expect(intelligenceLineage?.locked_at).toBeTruthy();
        expect(Number(intelligenceLineage?.scheduled_post_id)).toBe(persisted.scheduled_post_id);
    expect(Number(intelligenceLineage?.revision ?? 0)).toBeGreaterThanOrEqual(1);
    const semanticSignature = await env.DB.prepare(
      `SELECT signature_json FROM operator_manifest_semantic_signatures
       WHERE brand_key = 'manifest_mental' AND content_type = 'scheduled' AND scheduled_post_id = ? LIMIT 1`,
    ).bind(persisted.scheduled_post_id).first<{ signature_json: string }>();
    expect(JSON.parse(String(semanticSignature?.signature_json ?? "{}"))).toMatchObject({
      question_type: "choice_priority",
      financial_scenario_key: "spending_priority",
      sentence_architecture: "specific_amount_question",
    });
    const experimentLineage = await env.DB.prepare(
      `SELECT e.experiment_key, a.hypothesis_id, a.scheduled_post_id, a.variant_key
       FROM operator_manifest_experiment_assignments a
       JOIN operator_manifest_experiments e ON e.id = a.experiment_id
       WHERE a.scheduled_post_id = ? LIMIT 1`,
    ).bind(persisted.scheduled_post_id).first<{
      experiment_key: string; hypothesis_id: string; scheduled_post_id: number; variant_key: string;
    }>();
    expect(experimentLineage).toMatchObject({
      experiment_key: "test_money_question_payoff_v1",
      hypothesis_id: persisted.hypothesis_id,
      scheduled_post_id: persisted.scheduled_post_id,
      variant_key: "direct_relief_payoff",
    });
        const directEvents = await env.DB.prepare(
      `SELECT event_type FROM operator_manifest_cycle_receipt_events
       WHERE cycle_id = ? ORDER BY datetime(created_at) ASC, event_key ASC`,
    ).bind(prepared.cycle.id).all<{ event_type: string }>();
    const directEventTypes = (directEvents.results ?? []).map((event) => event.event_type);
    expect(directEventTypes).toEqual(expect.arrayContaining([
      "cycle_prepared", "candidate_evaluated", "post_persisted", "coverage_reconciled",
    ]));
        const receipt = await mcpTool<{
      available: boolean;
      cycle_receipt: {
        input_strategy_version: { id: string } | null;
        output_strategy_version: { id: string } | null;
        exposure_snapshot: { id: string; revision: number } | null;
        event_count: number;
        hypothesis_count: number;
        read_contract: { version: string; canonical_receipt_preserved: boolean; payload_budget_truncation_forbidden: boolean };
      } | null;
      receipt_section: { section: string; items: unknown[]; pagination: Record<string, unknown> | null } | null;
    }>("get_manifest_cycle_receipt", {
      brand_key: "manifest_mental",
      cycle_id: prepared.cycle.id,
      receipt_section: "summary",
      proceed_confirmed: true,
    });
    expect(receipt.available).toBe(true);
    expect(receipt.cycle_receipt?.input_strategy_version?.id).toBeTruthy();
    expect(receipt.cycle_receipt?.output_strategy_version?.id).toBe(persisted.strategy_version_id);
    expect(receipt.cycle_receipt?.exposure_snapshot?.id).toBeTruthy();
    expect(receipt.cycle_receipt?.event_count).toBe(directEventTypes.length);
    expect(receipt.cycle_receipt?.hypothesis_count).toBeGreaterThanOrEqual(1);
    expect(receipt.cycle_receipt?.read_contract).toMatchObject({
      version: "manifest-cycle-receipt-read-v1",
      canonical_receipt_preserved: true,
      payload_budget_truncation_forbidden: true,
    });
    expect(receipt.receipt_section).toMatchObject({ section: "summary", items: [], pagination: null });

    const eventPage = await mcpTool<{
      receipt_section: {
        section: string;
        items: Array<{ event_type: string }>;
        pagination: { returned: number; total: number; has_more: boolean; next_offset: number | null };
      };
    }>("get_manifest_cycle_receipt", {
      brand_key: "manifest_mental",
      cycle_id: prepared.cycle.id,
      receipt_section: "events",
      offset: 0,
            limit: 10,
      proceed_confirmed: true,
    });
    expect(eventPage.receipt_section.section).toBe("events");
    expect(eventPage.receipt_section.items.map((event) => event.event_type)).toEqual(directEventTypes);
    expect(eventPage.receipt_section.pagination).toMatchObject({
      returned: directEventTypes.length,
      total: directEventTypes.length,
      has_more: false,
      next_offset: null,
    });

    const hypothesisPage = await mcpTool<{
      receipt_section: {
        section: string;
        items: Array<{ id: string; scheduled_post_id: number; status: string; locked_at: string | null }>;
        pagination: { total: number; has_more: boolean };
      };
    }>("get_manifest_cycle_receipt", {
      brand_key: "manifest_mental",
      cycle_id: prepared.cycle.id,
      receipt_section: "hypotheses",
      offset: 0,
            limit: 10,
      proceed_confirmed: true,
    });
    expect(hypothesisPage.receipt_section.section).toBe("hypotheses");
    expect(hypothesisPage.receipt_section.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: persisted.hypothesis_id,
        scheduled_post_id: persisted.scheduled_post_id,
        status: "scheduled",
      }),
    ]));
        expect(hypothesisPage.receipt_section.pagination.total).toBeGreaterThanOrEqual(1);
    expect(hypothesisPage.receipt_section.pagination.has_more).toBe(false);

    const collisionSlot = prepared.cycle.missing_slots[1];
    expect(collisionSlot).toBeTruthy();
    const collision = await mcpTool<{
      success: boolean;
      error: string;
      semantic_repetition: {
        semantic_repetition_blocked: boolean;
        collision: { severity: string; premise_similarity: number; blocking: boolean };
      };
    }>("persist_manifest_autonomous_post", {
      ...payload,
      post: {
        ...payload.post,
        date: collisionSlot.date,
        time: collisionSlot.time,
        text: "$50,456 arrives today. What gets handled first?",
      },
      operation_id: `test-autonomous-semantic-collision-${crypto.randomUUID()}`,
    });
    expect(collision).toMatchObject({
      success: false,
      error: "semantic_repetition_collision",
      semantic_repetition: {
        semantic_repetition_blocked: true,
        collision: { severity: "collision", premise_similarity: 1, blocking: true },
      },
    });
        const collisionScheduled = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM operator_autonomous_lineup_items
       WHERE cycle_id = ? AND slot_key = ? AND scheduled_post_id IS NOT NULL`,
    ).bind(prepared.cycle.id, collisionSlot.key).first<{ count: number }>();
    expect(Number(collisionScheduled?.count ?? 0)).toBe(0);

    const replayed = await mcpTool<typeof persisted>("persist_manifest_autonomous_post", payload);
    expect(replayed.scheduled_post_id).toBe(persisted.scheduled_post_id);
    const scheduled = await mcpTool<{ items: Array<{ id: number }> }>("list_scheduled_posts", {
      brand_key: "manifest_mental",
      date: slot.date,
      timezone: "America/New_York",
      limit: 100,
    });
        expect(scheduled.items.filter((item) => item.id === persisted.scheduled_post_id)).toHaveLength(1);

    await env.DB.prepare(
      `UPDATE operator_source_cards SET source_selection_id = NULL WHERE id = ? AND brand_key = 'manifest_mental'`,
    ).bind(persisted.lineage.source_card_id).run();
    await env.DB.prepare(
      `UPDATE scheduled_posts SET publish_error_message = 'manifest_lineage_incomplete:source' WHERE id = ?`,
    ).bind(persisted.scheduled_post_id).run();
    const repaired = await mcpTool<typeof persisted>("persist_manifest_autonomous_post", {
      ...payload,
      operation_id: `test-autonomous-persist-repair-${crypto.randomUUID()}`,
    });
    expect(repaired.scheduled_post_id).toBe(persisted.scheduled_post_id);
    expect(repaired.publish_lineage_complete).toBe(true);
    const repairedLineage = await getScheduledPostPublishLineageStatus(
      env,
      repaired.scheduled_post_id,
      "35758578720393972",
    );
    expect(repairedLineage).toMatchObject({ required: true, complete: true, missing_stages: [] });
    const repairedScheduled = await env.DB.prepare(
      `SELECT publish_error_message FROM scheduled_posts WHERE id = ?`,
    ).bind(repaired.scheduled_post_id).first<{ publish_error_message: string | null }>();
    expect(repairedScheduled?.publish_error_message).toBeNull();
  }, 30000);

  it("reviews a scheduled autonomous post without making the owner an operational dependency", async () => {
    await activateManifestAutonomyForTest();
    const prepared = await mcpTool<{
      cycle: { id: string; missing_slots: Array<{ date: string; time: string }> };
    }>("prepare_manifest_autonomous_cycle", {
      brand_key: "manifest_mental",
      horizon_hours: 48,
      operation_id: `test-autonomous-review-prepare-${crypto.randomUUID()}`,
      proceed_confirmed: true,
    });
    const slot = prepared.cycle.missing_slots[0];
        const persisted = await mcpTool<{
      scheduled_post_id: number;
    }>("persist_manifest_autonomous_post", {
      brand_key: "manifest_mental",
      cycle_id: prepared.cycle.id,
      strategic_thesis: { position: "Test one reviewable autonomous post." },
      post: {
        date: slot.date,
        time: slot.time,
        text: `Optional owner review ${crypto.randomUUID().slice(0, 8)}: a good day can begin with one honest decision.`,
        generation_mode: "original_discovery",
        family_key: `test_owner_review_${crypto.randomUUID().slice(0, 8)}`,
        source_mechanism: "A concise decision-oriented reflection.",
        audience_reward: "A grounded sense of agency.",
                strategic_purpose: "Verify optional criticism after autonomous scheduling.",
        source_context: { kind: "operator_hypothesis", source_type: "operator_hypothesis" },
        hypothesis: {
          expected_response_type: "likes",
          expected_audience_reward: "A grounded sense of agency.",
          hook_rationale: "The direct opening makes the reflection immediately accessible.",
          premise_rationale: "One honest decision is a concrete, low-friction action.",
          exploration_mode: "explore",
          comparable_post_ids: [],
          expected_performance_range: { views: { min: 100, max: 10_000 }, likes: { min: 5, max: 1_000 } },
          uncertainty: "The reflective premise may produce quiet resonance rather than replies.",
          falsification_conditions: ["Comparable mature posts consistently fail the engagement floor."],
        },
        strategy: { pillar: "agency", hook_style: "direct_statement", novelty_level: "original_discovery" },
      },
      model_evaluation: {
        generation_passed: true,
        scheduling_passed: true,
        novelty_assessment: "The wording is distinct from current scheduled inventory.",
                winner_preservation_assessment: "The post preserves a proven direct-statement mechanism.",
        slot_placement_assessment: "The selected slot is the first authoritative future opening in the prepared ET runway.",
        recent_exposure_assessment: "The candidate was checked against recent published and scheduled exposure and does not create an avoidable cluster.",
      },
      operation_id: `test-autonomous-review-persist-${crypto.randomUUID()}`,
      proceed_confirmed: true,
    });
    const scheduledPostId = persisted.scheduled_post_id;
    const reviewed = await mcpTool<{
      success: boolean;
      action: string;
      lesson_scope: string;
      operational_effect: string;
    }>("review_manifest_scheduled_post", {
      brand_key: "manifest_mental",
      scheduled_post_id: scheduledPostId,
      action: "keep",
      feedback: "Keep this post. This is post-specific approval, not a permanent rule.",
      lesson_scope: "post_specific",
      operation_id: `test-autonomous-review-${crypto.randomUUID()}`,
      proceed_confirmed: true,
    });
    expect(reviewed).toMatchObject({ success: true, action: "keep", lesson_scope: "post_specific" });
    expect(reviewed.operational_effect).toContain("No production change");
  }, 30000);

  it.skip("retired: bloated internal registry contract", async () => {
    const initialized = await mcpRequest<{ serverInfo: { name: string }; capabilities: Record<string, unknown>; instructions: string }>("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    expect(initialized.serverInfo.name).toBe("lensically-operator-mode");

        const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    expect(listed.tools.map((tool) => tool.name)).toEqual(["executeLensicallyIntent"]);
    const registry = await mcpTool<{ tools: Array<{ name: string; inputSchema?: Record<string, unknown> }> }>("listMcpTools");
    const toolNames = registry.tools.map((tool) => tool.name);
        expect(new Set(toolNames).size).toBe(toolNames.length);
        expect(registry.tools.slice(0, 75).map((tool) => tool.name)).toEqual(expect.arrayContaining([
      "setScheduledPostSchedulerMode",
      "recoverOverdueScheduledPosts",
      "runApprovedPostCanary",
    ]));
    expect(() => JSON.stringify(registry.tools)).not.toThrow();
    expect(toolNames.some((name) => /^(mm|om|vx)_/.test(name))).toBe(false);
    expect(initialized.instructions).toContain("Initial key-selection stop");
    expect(initialized.instructions).toContain("Selected key: <selected_key>");
    expect(initialized.instructions).toContain(`Full tool surface loaded: ${toolNames.length} tools available and usable.`);
                    expect(initialized.instructions).toContain("Only after the user explicitly approves proceeding, call executeLensicallyIntent with intent='confirm operator proceed'");
    expect(initialized.instructions).toContain("automatically restores canonical persisted schedule");
    expect(initialized.instructions).toContain("Never ask resume or start fresh");
        expect(initialized.instructions).toContain("verifies continuity from server-side state");
                                expect(initialized.instructions).toContain("Mandatory Execution Map is universal");
        expect(initialized.instructions).toContain("Direct operational tool calls are not advertised or executable");
    expect(initialized.instructions).toContain("Source cards are backend-only during Manifest calendar production");
    expect(initialized.instructions).toContain("Autonomous account and engineering transitions use Completed:, Showing now:, and Next action:");
    expect(initialized.instructions).toContain("Calendar controller rule");
    expect(initialized.instructions).toContain("Autonomous batch rule");
    expect(initialized.instructions).toContain("If no candidate becomes showable, replace it internally or report the blocker");
    expect(initialized.instructions).toContain("Manifest source-adaptation rule");
    expect(initialized.instructions).toContain("Show Source / Generated pairs only for monitoring reports");
    expect(initialized.instructions).toContain("explicit owner hard bans");
    expect(initialized.instructions).toContain("historical_owner_rejection_gate");
        expect(initialized.instructions).toContain("Never claim that a gate passed unless that exact gate_key appears");
    expect(initialized.instructions).toContain("Engineering efficiency is mandatory");
    expect(initialized.instructions).toContain("applyRepoPatchSet");
    expect(initialized.instructions).toContain("runEngineeringRelease exactly once per SHA");
    expect(initialized.instructions).toContain("getEngineeringRelease");

                const patchSetTool = await mcpTool<{ tool?: { inputSchema?: { properties?: { patches?: { maxItems?: number } } } } }>("readMcpToolDefinition", { tool_name: "applyRepoPatchSet" });
    const releaseTool = await mcpTool<{ tool?: { inputSchema?: { properties?: { force?: { type?: string } } } } }>("readMcpToolDefinition", { tool_name: "runEngineeringRelease" });
        const releaseStatusTool = await mcpTool<{ tool?: { inputSchema?: { properties?: { wait_seconds?: { maximum?: number } } } } }>("readMcpToolDefinition", { tool_name: "getEngineeringRelease" });
    const workflowWatchTool = await mcpTool<{ tool?: { inputSchema?: { properties?: { wait_seconds?: { maximum?: number } } } } }>("readMcpToolDefinition", { tool_name: "getGitHubWorkflowRun" });
    const hardeningTransitionTool = await mcpTool<{ tool?: { inputSchema?: { properties?: Record<string, unknown> } } }>("readMcpToolDefinition", { tool_name: "advanceHardeningIncident" });
    expect(patchSetTool.tool?.inputSchema?.properties?.patches?.maxItems).toBe(20);
    expect(releaseTool.tool?.inputSchema?.properties?.force?.type).toBe("boolean");
        expect(releaseStatusTool.tool?.inputSchema?.properties?.wait_seconds?.maximum).toBe(55);
    expect(workflowWatchTool.tool?.inputSchema?.properties?.wait_seconds?.maximum).toBe(60);
    expect(hardeningTransitionTool.tool?.inputSchema?.properties).toHaveProperty("resume_result");

        expect(toolNames).toEqual(expect.arrayContaining([
      "getOperatorStartupContext",
      "engineeringPrecheck",
      "getEngineeringAccessState",
      "listRepoFiles",
      "readRepoFile",
      "searchRepoFiles",
      "getRepoStatus",
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
      "runEngineeringRelease",
      "getEngineeringRelease",
      "deployBackend",
      "verifyDeployedMcpVersion",
      "listEngineeringAudit",
      "listOpsMemory",
      "readOpsMemory",
      "recordOpsMemory",
      "updateOpsMemory",
            "searchOpsMemory",
    ]));
                                                                expect(toolNames).toEqual(expect.arrayContaining([
      "selectOperatorKey",
      "confirmOperatorProceed",
      "resolveContinuationContext",
      "planOperatorExecution",
      "getMcpAdminState",
      "getOperatorDecisionState",
      "proposeOperatorDecision",
      "resolveOperatorDecision",
      "markOperatorDecisionExecuted",
      "getScheduledPostSchedulerState",
      "setScheduledPostSchedulerMode",
      "recoverOverdueScheduledPosts",
      "auditScheduledPost",
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
    ]));
    for (const name of [
      "getOperatorStartupContext",
      "engineeringPrecheck",
      "getEngineeringAccessState",
      "listRepoFiles",
      "readRepoFile",
      "searchRepoFiles",
            "getRepoStatus",
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
      "runEngineeringRelease",
      "getEngineeringRelease",
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
      "get_performance_learning",
      "selectOperatorKey",

      "confirmOperatorProceed",
      "resolveContinuationContext",
            "planOperatorExecution",
      "getMcpAdminState",
      "getOperatorDecisionState",
      "proposeOperatorDecision",
      "resolveOperatorDecision",
            "markOperatorDecisionExecuted",
      "getScheduledPostSchedulerState",
      "setScheduledPostSchedulerMode",
      "recoverOverdueScheduledPosts",
      "auditScheduledPost",
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

  it("loads a compact source-defined startup bootstrap", async () => {
    const registry = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    const startup = await mcpTool<{
      bootstrap_version: string;
      operating_contract: {
        public_gateway: string;
        router: string;
        model_tool_choice_allowed: boolean;
        d1_route_lookup_required: boolean;
        recovery_role: string;
      };
      account_data_loaded: boolean;
      no_account_sections_present: boolean;
            tool_surface: { public_tool_count: number; categories: { engineering: number; admin: number; operator: number } };
      runtime: { mcp_version: string; registry_generation: string };
      source_documents: Array<{ path: string; ok: boolean; status: number; size: number }>;
      boundary: { first_key_response_template: string[]; before_proceed_forbidden: string[] };
    }>("getOperatorStartupContext");
    expect(startup.bootstrap_version).toBe("operator-startup-v4");
    expect(startup.operating_contract).toMatchObject({
      public_gateway: "direct_typed_tools",
      router: "direct_handler_dispatch_v1",
      model_tool_choice_allowed: true,
      d1_route_lookup_required: false,
      recovery_role: "independent_break_glass_only",
    });
    expect(startup.account_data_loaded).toBe(false);
    expect(startup.no_account_sections_present).toBe(true);
        expect(startup.tool_surface.public_tool_count).toBe(registry.tools.length);
    expect(startup.runtime).toMatchObject({ mcp_version: OPERATOR_MCP_VERSION, registry_generation: "static-execution-router-v1" });
    expect(startup.source_documents.map((document) => document.path)).toEqual(["AGENTS.md", "CURRENT_STATE.md", "OPERATING_MEMORY.md"]);
        expect(startup.source_documents.every((document) => !Object.prototype.hasOwnProperty.call(document, "excerpt"))).toBe(true);
    expect(startup.boundary.first_key_response_template).toHaveLength(4);
    expect(startup.boundary.before_proceed_forbidden).toContain("account_state");
    const serialized = JSON.stringify(startup);
    expect(serialized).not.toContain("collaboration_contract");
    expect(serialized).not.toContain("open_implementation_backlog");
    expect(serialized).not.toContain("active_runtime_config_deployment");
    expect(serialized.length).toBeLessThan(25000);
  }, 30000);

  it.skip("retired: historical startup contract payload", async () => {

        const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    expect(listed.tools.map((tool) => tool.name)).toEqual(["executeLensicallyIntent"]);
    const registry = await mcpTool<{ tools: Array<{ name: string }> }>("listMcpTools");
    const direct = await mcpTool<{
            bootstrap_version: string;
                        collaboration_contract: { version: string; principles: string[]; durable_change_reporting: { required_fields: string[] }; system_layers: Array<{ key: string }> };
            autonomy_contract: { version: string; infrastructure_scope: string; active_account_scope: string; active_mode: string; objective: string; model_role: string; owner_role: string; approval_policy: string; fresh_chat_rule: string; decision_categories: string[]; training_exit_rule: string };
      engineering_authority_contract: { version: string; scope: string; mode: string; numerical_tool_budgets: boolean; owner_ratification_required: boolean; known_path_rule: string; recursive_improvement_rule: string; protected_operations: string[] };
      continuity_contract: { version: string; scope: string; source_of_truth: string; required_sequence: string[]; capsule_sections?: string[]; rule: string };
      execution_policy_contract: { version: string; scope: string; authority_order: string[]; execution_planes: Record<string, string>; known_failure_rule: string; alias_rule: string; scope_rule: string; memory_rule: string };
                                                      owner_interaction_contract: { version: string; silent_stages: string[]; owner_visible_checkpoints: string[]; transition_label_contract: { account_required_labels: string[]; engineering_required_labels: string[]; instruction: string }; continuity_contract: { auto_resolve_after_confirm_operator_proceed: boolean; owner_prompt_removed: boolean; behavior: string }; calendar_coverage_contract: { controller: string; hourly_requirement: string; past_slots: string; day_advance_rule: string }; review_batch_contract: { visible_batch_size: number; visible_fields: string[]; hidden_fields: string[]; provisional_times_forbidden: boolean; numbering_rule: string; scheduling_rule: string }; source_card_presentation_contract: { version: string; raw_contract_fields_are_internal_only: boolean; prohibited_owner_headings: string[]; manifest_mental_sections: string[]; instruction: string; no_finished_draft_rule: string }; rules: string[]; next_owner_decision_after_review_batch: string };
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
      runtime: { mcp_version: string; deployment_id: string | null; active_runtime_deployment?: unknown; active_runtime_config_deployment?: unknown };
    }>("getOperatorStartupContext");
        expect(direct.bootstrap_version).toBe("operator-startup-v3");
        expect(direct.collaboration_contract.version).toBe("operator-collaboration-v1");
                expect(direct.autonomy_contract.version).toBe("operator-autonomy-governance-v3");
    expect(direct.autonomy_contract.infrastructure_scope).toBe("universal");
    expect(direct.autonomy_contract.active_account_scope).toBe("manifest_mental");
    expect(direct.autonomy_contract.active_mode).toBe("autonomous_operator");
    expect(direct.autonomy_contract.objective).toContain("1,000,000 followers");
    expect(direct.autonomy_contract.model_role).toContain("content decisions");
    expect(direct.autonomy_contract.approval_policy).toContain("Routine Manifest account operations");
    expect(direct.engineering_authority_contract).toMatchObject({
      version: "operator-engineering-authority-v1",
      scope: "universal_engineering",
      mode: "full_discretion_recursive",
      numerical_tool_budgets: false,
      owner_ratification_required: false,
    });
                expect(direct.engineering_authority_contract.known_path_rule).toContain("the model can call only executeLensicallyIntent for operational work");
    expect(direct.engineering_authority_contract.recursive_improvement_rule).toContain("stop the active engineering sequence");
    expect(direct.engineering_authority_contract.protected_operations).toEqual(expect.arrayContaining(["deleteRepoFile", "rollbackMcpChanges", "disableMcpTool", "setScheduledPostSchedulerMode", "recoverOverdueScheduledPosts"]));
        expect(direct.continuity_contract.version).toBe("operator-continuity-v2");
    expect(direct.continuity_contract.scope).toBe("universal");
    expect(direct.continuity_contract.source_of_truth).toContain("canonical database state");
    expect(direct.continuity_contract.required_sequence).toContain("confirmOperatorProceed_and_auto_resolve_canonical_continuity");
    expect(direct.execution_policy_contract.version).toBe("operator-execution-policy-v2");
    expect(direct.execution_policy_contract.scope).toBe("universal");
    expect(direct.execution_policy_contract.authority_order.slice(0, 2)).toEqual(["backend enforcement", "mandatory known-path registry"]);
    expect(direct.execution_policy_contract.alias_rule).toContain("not fallback routes");
    expect(direct.execution_policy_contract.scope_rule).toContain("default universal");
    expect(direct.execution_policy_contract.memory_rule).toContain("cannot authorize or enforce");
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
                                        expect(direct.owner_interaction_contract.version).toBe("operator-owner-interaction-v7");
        expect(direct.owner_interaction_contract.owner_visible_checkpoints).toContain("owner_ratified_account_decision");
    expect(direct.owner_interaction_contract.owner_visible_checkpoints).toContain("meaningful_engineering_outcome");
    expect(direct.owner_interaction_contract.owner_visible_checkpoints).toContain("true_owner_required_blocker");
    expect(direct.owner_interaction_contract.silent_stages).toEqual(expect.arrayContaining(["context_admission", "source_selection", "source_card", "review_batch_generation", "generation_run_and_candidates", "gate_evaluation"]));
    expect(direct.owner_interaction_contract.owner_visible_checkpoints).toContain("calendar_coverage_confirmation");
    expect(direct.owner_interaction_contract.owner_visible_checkpoints).toContain("four_post_review_batch");
    expect(direct.owner_interaction_contract.continuity_contract.auto_resolve_after_confirm_operator_proceed).toBe(true);
    expect(direct.owner_interaction_contract.continuity_contract.owner_prompt_removed).toBe(true);
    expect(direct.owner_interaction_contract.calendar_coverage_contract.controller).toBe("earliest_incomplete_future_day");
    expect(direct.owner_interaction_contract.review_batch_contract.visible_batch_size).toBe(4);
    expect(direct.owner_interaction_contract.review_batch_contract.provisional_times_forbidden).toBe(true);
    expect(direct.owner_interaction_contract.review_batch_contract.visible_fields).toEqual(["Post number", "Source", "Generated post"]);
        expect(direct.owner_interaction_contract.transition_label_contract.account_required_labels).toEqual(["Completed:", "Showing now:", "Next decision:"]);
    expect(direct.owner_interaction_contract.transition_label_contract.engineering_required_labels).toEqual(["Completed:", "Showing now:", "Next action:"]);
    expect(direct.owner_interaction_contract.transition_label_contract.instruction).toContain("Use decision language only when the owner actually must decide");
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
      "calendar_coverage_confirmation",
      "four_post_review_batch",
      "confirmed_scheduling_report",
      "day_completion_confirmation",
    ]));
    expect(direct.owner_interaction_contract.rules.join(" ")).toContain("four numbered Source / Generated post pairs");
    expect(direct.owner_interaction_contract.next_owner_decision_after_review_batch).toContain("Posts 1 through 4");
        expect(direct.rejection_memory_contract.version).toBe("operator-rejection-context-v2");
    expect(direct.rejection_memory_contract.infrastructure_scope).toBe("universal");
    expect(direct.rejection_memory_contract.evidence_scope).toBe("selected_account");
    expect(direct.rejection_memory_contract.required_generation_behavior.join(" ")).toContain("compact selected-account rejection context");
    expect(direct.rejection_memory_contract.required_generation_behavior.join(" ")).toContain("explicit hard bans");
    expect(direct.rejection_memory_contract.required_gate_keys).toEqual(expect.arrayContaining([
      "historical_owner_rejection_gate",
      "required_gate_execution_gate",
    ]));
            expect(direct.rejection_memory_contract.showability_rule).toContain("near-verbatim source copying");
        expect(direct.tool_surface.total_tools).toBe(registry.tools.length);


    expect(direct.account_data_loaded).toBe(false);
    expect(direct.no_account_sections_present).toBe(true);
    expect(direct.repository.repo).toBe("Lensically");
    expect(direct.repository.branch).toBe("main");
    expect(direct.runtime.mcp_version).toBe(OPERATOR_MCP_VERSION);
    expect(Object.prototype.hasOwnProperty.call(direct.runtime, "deployment_id")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(direct.runtime, "active_runtime_deployment")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(direct.runtime, "active_runtime_config_deployment")).toBe(true);
    expect(direct.source_documents.map((doc) => doc.path)).toEqual(["AGENTS.md", "CURRENT_STATE.md", "OPERATING_MEMORY.md"]);
    expect(direct.source_documents.every((doc) => doc.excerpt.length <= 6000)).toBe(true);
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("executeLensicallyIntent");
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("source-defined router");
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("Database route lookup");
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("bounded repository reads and searches");
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("independent Recovery plane");
    expect(direct.boundary.before_proceed_forbidden).toEqual(expect.arrayContaining(["account_state", "workflow_status", "source_cards", "drafts", "scheduled_posts", "account_gates", "strategy_memory", "account_metrics"]));
        expect(direct.boundary.after_explicit_proceed).toContain("automatically restores canonical persisted schedule");
    expect(direct.boundary.after_explicit_proceed).toContain("Never ask resume or start fresh");
        expect(direct.boundary.after_explicit_proceed).toContain("server-side state");
    expect(direct.boundary.after_explicit_proceed).toContain("Conversation memory is not accepted");
    expect(JSON.stringify(direct)).not.toContain("scheduled_posts_count");
    expect(JSON.stringify(direct)).not.toContain("latest_context_admission");
    expect(direct.universal_workflow_requirements.some((item) => item.stage === "context_admission" && item.required_sections.includes("operator_precheck"))).toBe(true);
  }, 30000);

    it("preserves the exact initial key handshake for all canonical keys", async () => {
    await mcpRequest("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
        const startup = await mcpTool<{ boundary: { first_key_response_template: string[] }; tool_surface: { public_tool_count: number } }>("getOperatorStartupContext");
    for (const key of ALL_BRAND_KEYS) {
      const selected = await mcpToolRaw<{ handshake: string[]; tool_count: number; account_data_loaded: boolean }>("selectOperatorKey", { brand_key: key });
      expect(selected.isError).not.toBe(true);
      expect(selected.structuredContent.account_data_loaded).toBe(false);
            expect(selected.structuredContent.tool_count).toBe(startup.tool_surface.public_tool_count);
      expect(selected.structuredContent.handshake).toEqual([
        "Lensically Operator Mode MCP is active.",
        `Selected key: ${key}`,
        `Full tool surface loaded: ${startup.tool_surface.public_tool_count} tools available and usable.`,
        "Proceed to the next step?",
      ]);
      expect(selected.structuredContent.handshake).toEqual(startup.boundary.first_key_response_template.map((line) => line.replace("<canonical_brand_key>", key)));
    }
  }, 30000);

      it.skip("retired: internal handshake bridge for stale multi-tool schemas", async () => {
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

                        const proceeded = await mcpToolRaw<{ executed_tool: string; result: { proceeded: boolean; continuity_loaded: boolean; continuation_choice_required: boolean } }>("listMcpTools", {
      execute_tool: "confirmOperatorProceed",
      arguments: { brand_key: "manifest_mental" },
    });
    expect(proceeded.isError).not.toBe(true);
    expect(proceeded.structuredContent.executed_tool).toBe("confirmOperatorProceed");
    expect(proceeded.structuredContent.result.proceeded).toBe(true);
    expect(proceeded.structuredContent.result.continuity_loaded).toBe(true);
    expect(proceeded.structuredContent.result.continuation_choice_required).toBe(false);

        const allowed = await mcpToolRaw<{ ok: boolean }>("getWorkflowStatus", {
      brand_key: "manifest_mental",
      proceed_confirmed: true,
    });
    expect(allowed.isError).not.toBe(true);
    expect(allowed.structuredContent.ok).toBe(true);
  }, 30000);

  it.skip("retired: capped multi-tool account bridge", async () => {
    await ensureMcpAccountOpen("manifest_mental");
    const coverage = await mcpToolRaw<{
      bridge_mode: string;
      executed_tool: string;
      canonical_executed_tool: string;
      scoped_brand_key: string;
      result: { ok: boolean; open_slots: string[] };
    }>("listMcpTools", {
      execute_tool: "mm_get_hourly_coverage",
      arguments: {
        proceed_confirmed: true,
        timezone: "America/New_York",
        horizon_days: 3,
      },
    });
    expect(coverage.isError).not.toBe(true);
    expect(coverage.structuredContent).toMatchObject({
      bridge_mode: "strict_client_cap_allowlist",
      executed_tool: "mm_get_hourly_coverage",
      canonical_executed_tool: "get_hourly_coverage",
      scoped_brand_key: "manifest_mental",
    });
    expect(coverage.structuredContent.result.ok).toBe(true);
    expect(Array.isArray(coverage.structuredContent.result.open_slots)).toBe(true);

    const invalid = await mcpToolRaw<{ error: string; validation_errors: Array<{ path: string; error: string }> }>("listMcpTools", {
      execute_tool: "get_hourly_coverage",
      arguments: {
        brand_key: "manifest_mental",
        proceed_confirmed: true,
        unexpected: true,
      },
    });
    expect(invalid.isError).toBe(true);
    expect(invalid.structuredContent.error).toBe("client_cap_bridge_payload_invalid");
    expect(invalid.structuredContent.validation_errors).toContainEqual({
      path: "$.unexpected",
      error: "additional_property_forbidden",
    });

    const forbidden = await mcpToolRaw<{ error: string }>("listMcpTools", {
      execute_tool: "create_source_card",
      arguments: {
        brand_key: "manifest_mental",
        proceed_confirmed: true,
      },
    });
    expect(forbidden.isError).toBe(true);
    expect(forbidden.structuredContent.error).toBe("direct_typed_tool_required");
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

                                                const proceeded = await mcpToolRaw<{ proceeded: boolean; account_data_loaded: boolean; continuity_loaded: boolean; continuation_choice_required: boolean; continuity_capsule: { brand_key: string }; next_call_requirement: { brand_key: string; proceed_confirmed: boolean; continuity_loaded?: unknown } }>("confirmOperatorProceed", { brand_key: BRAND_KEY });
    expect(proceeded.isError).not.toBe(true);
    expect(proceeded.structuredContent).toMatchObject({ proceeded: true, account_data_loaded: true, continuity_loaded: true, continuation_choice_required: false });
        expect(proceeded.structuredContent.continuity_capsule.brand_key).toBe(BRAND_KEY);
    expect(proceeded.structuredContent.next_call_requirement).toMatchObject({ brand_key: "vectrix" });
    expect(proceeded.structuredContent.next_call_requirement).not.toHaveProperty("proceed_confirmed");
    expect(proceeded.structuredContent.next_call_requirement.continuity_loaded).toBeUndefined();

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

  it("routes bounded known-file repository search through the main Execution Kernel without Recovery", async () => {
    const bounded = searchKnownRepositoryFileContent(
      "alpha\nexecuteLensicallyIntent first\nbeta\nEXECUTELENSICALLYINTENT second",
      "executeLensicallyIntent",
      1,
    );
    expect(bounded).toEqual({
      matches: [{ line_number: 2, line: "executeLensicallyIntent first" }],
      match_count: 2,
      searched_line_count: 4,
      truncated: true,
    });

        const repositorySource = "export async function executeLensicallyIntent(profileId: string) {\n  return profileId;\n}\n";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (
        request.method === "GET"
        && url.origin === "https://api.github.com"
        && url.pathname === "/repos/profitproperly/Lensically/contents/lensically-worker/src/index.ts"
        && url.searchParams.get("ref") === "main"
      ) {
        return new Response(JSON.stringify({
          sha: "vitest-index-sha",
          size: repositorySource.length,
          content: btoa(repositorySource),
          encoding: "base64",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`No outbound mock for ${request.method} ${url.toString()}`);
    });

    const routed = await mcpToolCallRaw<{
      ok: boolean;
      query: string;
      path: string;
      matches: Array<{ line_number: number; line: string }>;
      verified_complete_for_known_file: boolean;
      search_mode: string;
    }>("searchRepoFiles", {
      prefix: "lensically-worker/src/index.ts",
      query: "executeLensicallyIntent",
      limit: 1,
    });
        fetchSpy.mockRestore();
    expect(routed.isError, JSON.stringify(routed.structuredContent)).not.toBe(true);
    expect(routed.structuredContent).toMatchObject({
      ok: true,
      query: "executeLensicallyIntent",
      path: "lensically-worker/src/index.ts",
      verified_complete_for_known_file: true,
      search_mode: "bounded_known_file_content",
    });
    expect(routed.structuredContent.matches).toHaveLength(1);

    const directorySpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (
        request.method === "GET"
        && url.origin === "https://api.github.com"
        && url.pathname === "/repos/profitproperly/Lensically/git/trees/main"
        && url.searchParams.get("recursive") === "1"
      ) {
        return new Response(JSON.stringify({
          tree: [{ type: "blob", path: "lensically-worker/src/index.ts", size: 100 }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (
        request.method === "GET"
        && url.origin === "https://api.github.com"
        && url.pathname === "/repos/profitproperly/Lensically/contents/lensically-worker/src"
        && url.searchParams.get("ref") === "main"
      ) {
        return new Response(JSON.stringify([{ type: "file", path: "lensically-worker/src/index.ts" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`No outbound mock for ${request.method} ${url.toString()}`);
    });
    const directoryPath = await mcpToolCallRaw<Record<string, unknown>>("searchRepoFiles", {
      prefix: "lensically-worker/src",
      query: "executeLensicallyIntent",
      limit: 1,
    });
    directorySpy.mockRestore();
    expect(directoryPath.structuredContent).toMatchObject({
      ok: false,
      error: "known_file_path_required",
      status: 200,
      path: "lensically-worker/src",
    });
    expect(directoryPath.structuredContent.hardening_incident).toBeUndefined();
    expect(directoryPath.structuredContent.normal_work_blocked).not.toBe(true);
  }, 30000);

  it("builds one complete non-mutating Execution Kernel capability campaign", async () => {
    const campaign = await mcpToolCallRaw<{
      campaign: {
        segment: string;
        total_internal_capabilities: number;
        total_read_only_capabilities: number;
        route_only: boolean;
        mutations_executed: number;
        passed: number;
        failed: number;
        failure_classes: Record<string, number>;
        failures: Array<Record<string, unknown>>;
        live_reads: { eligible: number; executed: number; passed: number; skipped: number; failed: number; failures: Array<Record<string, unknown>> };
        mutation_preflights: { eligible: number; executed: number; passed: number; failed: number; failures: Array<Record<string, unknown>>; side_effects_executed: number };
        risk_groups: { read_only: number; mutation: number };
      };
    }>("runMcpTests", { segment: "s0" });
    expect(campaign.structuredContent.campaign).toMatchObject({
            segment: "routes",
                        total_internal_capabilities: 97,
      total_read_only_capabilities: 42,
      route_only: true,
      mutations_executed: 0,
      live_reads: { eligible: 0, failed: 0 },
    });
    expect(
      campaign.structuredContent.campaign.failed,
      JSON.stringify(campaign.structuredContent.campaign.failures),
    ).toBe(0);
                                expect(campaign.structuredContent.campaign.passed).toBe(97);
    expect(campaign.structuredContent.campaign.risk_groups).toEqual({
      read_only: 42,
            mutation: 55,
      mutation_without_required_inputs: 0,
    });
    expect(Object.keys(campaign.structuredContent.campaign.failure_classes).sort()).toEqual([
      "client_safety",
      "policy_classification",
      "routing",
      "schema_contract",
      "zero_input_mutation",
    ]);

    const readSegments = [
      ["s1", "engineering_reads"],
      ["s2", "admin_reads_a"],
      ["admin_reads", "admin_reads_b"],
      ["s3", "account_reads_a"],
      ["s4", "account_reads_b"],
    ] as const;
    let eligibleReads = 0;
    let failedReads = 0;
    for (const [transportSegment, canonicalSegment] of readSegments) {
      const result = await mcpToolCallRaw<typeof campaign.structuredContent>("runMcpTests", {
        segment: transportSegment,
      });
      expect(result.structuredContent.campaign.segment).toBe(canonicalSegment);
      expect(result.structuredContent.campaign.route_only).toBe(false);
      eligibleReads += result.structuredContent.campaign.live_reads.eligible;
      failedReads += result.structuredContent.campaign.live_reads.failed;
      expect(
        result.structuredContent.campaign.live_reads.failed,
        JSON.stringify(result.structuredContent.campaign.live_reads.failures),
      ).toBe(0);
    }
                expect(eligibleReads).toBe(42);
    expect(failedReads).toBe(0);

    const mutationSegments = [
      ["s5", "engineering_mutations"],
      ["s6", "admin_mutations"],
      ["s7", "account_mutations_a"],
      ["s8", "account_mutations_b"],
    ] as const;
    let eligibleMutations = 0;
    let failedMutationPreflights = 0;
    for (const [transportSegment, canonicalSegment] of mutationSegments) {
      const result = await mcpToolCallRaw<typeof campaign.structuredContent>("runMcpTests", {
        segment: transportSegment,
      });
      expect(result.structuredContent.campaign.segment).toBe(canonicalSegment);
      expect(result.structuredContent.campaign.mutations_executed).toBe(0);
      eligibleMutations += result.structuredContent.campaign.mutation_preflights.eligible;
      failedMutationPreflights += result.structuredContent.campaign.mutation_preflights.failed;
      expect(
        result.structuredContent.campaign.mutation_preflights.failed,
        JSON.stringify(result.structuredContent.campaign.mutation_preflights.failures),
      ).toBe(0);
      expect(result.structuredContent.campaign.mutation_preflights.side_effects_executed).toBe(0);
    }
                expect(eligibleMutations).toBe(55);
    expect(failedMutationPreflights).toBe(0);
  }, 120000);

  it.skip("retired: static router as the only public action path", async () => {
    const direct = await mcpToolCallRaw<{ error: string; required_tool: string }>("getEngineeringAccessState", {});
    expect(direct.isError).toBe(true);
    expect(direct.structuredContent).toMatchObject({
      error: "routed_execution_gateway_required",
      required_tool: "executeLensicallyIntent",
    });

    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list", {});
    expect(listed.tools.map((tool) => tool.name)).toEqual(["executeLensicallyIntent"]);

        const freehand = await mcpToolCallRaw<{ error: string }>("executeLensicallyIntent", {
      objective: "Read current engineering access.",
      intent: "get engineering access state",
      inputs: {},
    });
    expect(freehand.isError).toBe(true);
    expect(freehand.structuredContent.error).toBe("registered_profile_id_required");

    const cachedEngineeringMutation = await mcpToolCallRaw<{
      error: string;
      tool_name: string;
      routed_execution?: { profile_id?: string; executed_tool?: string };
    }>("executeLensicallyIntent", {
      objective: "Repair routing and preserve account context after Proceed without mutating account data.",
      intent: "Implement repository changes and verify context persistence after Proceed.",
      inputs: {
        brand_key: "manifest_mental",
        dry_run: true,
        message: "Cached engineering mutation routing regression",
        patches: [],
      },
    });
    expect(cachedEngineeringMutation.isError).toBe(true);
        expect(cachedEngineeringMutation.structuredContent).toMatchObject({
      error: "registered_profile_id_required",
    });
    expect(JSON.stringify(cachedEngineeringMutation.structuredContent)).not.toContain("confirmOperatorProceed");

    const cachedAccountRead = await mcpToolCallRaw<{
      ok: boolean;
      routed_execution: { profile_id: string; executed_tool: string };
    }>("executeLensicallyIntent", {
      objective: "Read the selected account's scheduled posts.",
      intent: "list scheduled posts",
      inputs: { brand_key: BRAND_KEY, proceed_confirmed: true },
    });
    expect(cachedAccountRead.isError).toBe(true);
        expect(cachedAccountRead.structuredContent).toMatchObject({
      error: "registered_profile_id_required",
    });

        const resolvedFreshKey = await mcpToolCallRaw<{ error: string }>("executeLensicallyIntent", {
      objective: "key manifest",
      intent: "initialize account handshake",
      inputs: { brand_key: "manifest" },
    });
        
    expect(resolvedFreshKey.isError).toBe(true);
    expect(resolvedFreshKey.structuredContent.error).toBe("registered_profile_id_required");

        const nestedProfileKey = await mcpToolCallRaw<{ error: string }>("executeLensicallyIntent", {
      inputs: { profile_id: "account_key_selection", brand_key: "manifest_mental" },
    });
        
    expect(nestedProfileKey.isError).toBe(true);
    expect(nestedProfileKey.structuredContent.error).toBe("registered_profile_id_required");

    const accountKeyAlias = await mcpToolCallRaw<{
      selected_key: CanonicalBrandKey;
      routed_execution: { profile_id: string; executed_tool: string };
    }>("executeLensicallyIntent", {
      profile_id: "account_key_selection",
      inputs: { account_key: "manifest_mental" },
    });
    expect(accountKeyAlias.isError).not.toBe(true);
    expect(accountKeyAlias.structuredContent).toMatchObject({
      selected_key: "manifest_mental",
      routed_execution: { profile_id: "account_key_selection", executed_tool: "selectOperatorKey" },
    });

    const accountProceed = await mcpToolCallRaw<{
      selected_key: CanonicalBrandKey;
      proceeded: boolean;
      account_data_loaded: boolean;
      routed_execution: { profile_id: string; executed_tool: string };
    }>("executeLensicallyIntent", {
      profile_id: "account_proceed",
      inputs: { brand_key: "manifest_mental" },
    });
    expect(accountProceed.isError).not.toBe(true);
    expect(accountProceed.structuredContent).toMatchObject({
      selected_key: "manifest_mental",
      proceeded: true,
      account_data_loaded: true,
      routed_execution: { profile_id: "account_proceed", executed_tool: "confirmOperatorProceed" },
    });

    const routedErrorAfterProceed = await mcpToolCallRaw<{
      error: string;
      tool_name: string;
      account_data_loaded: boolean;
    }>("executeLensicallyIntent", {
      objective: "Verify engineering routing without changing account data.",
      intent: "Implement repository changes and verify context persistence after Proceed.",
      inputs: {
        brand_key: "manifest_mental",
        dry_run: true,
        message: "Post-Proceed continuity receipt regression",
        patches: [],
      },
    });
    expect(routedErrorAfterProceed.isError).toBe(true);
        expect(routedErrorAfterProceed.structuredContent).toMatchObject({
      error: "registered_profile_id_required",
      account_data_loaded: true,
    });

        const startup = await mcpToolCallRaw<{
      execution_kernel: { public_contract: string; route: { tool_name: string }; lifecycle: { route_mode: string; d1_execution_library_bypassed: boolean; discovery_allowed: boolean } };
    }>("executeLensicallyIntent", {
      profile_id: "startup",
      inputs: {},
    });
    expect(startup.isError).not.toBe(true);
    expect(startup.structuredContent.execution_kernel).toMatchObject({
      public_contract: "profile_id_inputs_v1",
      route: { tool_name: "getOperatorStartupContext" },
      lifecycle: { route_mode: "source_defined_static_route", d1_execution_library_bypassed: true, discovery_allowed: false },
    });
    for (const retiredField of ["gateway", "mandatory_execution_map", "execution_library", "execution_policy"]) {
      expect(startup.structuredContent).not.toHaveProperty(retiredField);
    }

            const capabilityDefinition = await mcpToolCallRaw<{ ok: boolean; tool: { name: string } }>("executeLensicallyIntent", {
      profile_id: "capability_definition",
      inputs: { capability: "repository patch set" },
    });
    expect(capabilityDefinition.isError).not.toBe(true);
    expect(capabilityDefinition.structuredContent).toMatchObject({ ok: true, tool: { name: "applyRepoPatchSet" } });

        const mapped = await mcpToolCallRaw<{
      ok: boolean;
      routed_execution: { executed_tool: string; model_tool_choice_allowed: boolean };
      execution_kernel: { lifecycle: { map_state: string; mandatory_path_followed: boolean; d1_execution_library_bypassed: boolean } };
    }>("executeLensicallyIntent", {
      profile_id: "get_engineering_access_state",
      inputs: {},
    });
    expect(mapped.isError).not.toBe(true);
    expect(mapped.structuredContent.ok).toBe(true);
    expect(mapped.structuredContent.routed_execution).toMatchObject({
      executed_tool: "getEngineeringAccessState",
      model_tool_choice_allowed: false,
    });
        expect(mapped.structuredContent.execution_kernel.lifecycle).toMatchObject({
      map_state: "source_defined_direct_completed",
      mandatory_path_followed: true,
      d1_execution_library_bypassed: true,
    });
    for (const retiredField of ["gateway", "mandatory_execution_map", "execution_library", "execution_policy"]) {
      expect(mapped.structuredContent).not.toHaveProperty(retiredField);
    }
  }, 30000);

  it.skip("retired: dynamic execution-library policy refresh", async () => {
    const warm = await mcpToolCallRaw<{ execution_library: { policy_ready: boolean } }>("executeLensicallyIntent", {
      objective: "Initialize the mandatory execution library.",
      intent: "inspect engineering access state",
      inputs: {},
    });
    expect(warm.isError).not.toBe(true);
    expect(warm.structuredContent.execution_library.policy_ready).toBe(true);
    const routeSources = await env.DB.prepare(
      `SELECT source_type, COUNT(*) AS total
       FROM operator_execution_library_sources
       WHERE active = 1 AND source_type IN ('pre_call_route', 'pre_call_route_override')
       GROUP BY source_type ORDER BY source_type`,
    ).all<{ source_type: string; total: number }>();
    const canonicalRoutes = (routeSources.results ?? []).find((row) => row.source_type === "pre_call_route");
    expect(Number(canonicalRoutes?.total ?? 0)).toBeGreaterThan(0);

    await env.DB.prepare(`DROP TABLE operator_ops_memory`).run();
    await env.DB.prepare(
      `CREATE TABLE operator_ops_memory (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        problem TEXT,
        fix TEXT NOT NULL,
        applies_when TEXT,
        tags_json TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    ).run();
    const rewarmed = await mcpToolCallRaw<{ execution_library: { policy_ready: boolean } }>("executeLensicallyIntent", {
      objective: "Restore execution-policy triggers after a policy table reset.",
      intent: "inspect engineering access state",
      inputs: {},
    });
    expect(rewarmed.isError).not.toBe(true);
    expect(rewarmed.structuredContent.execution_library.policy_ready).toBe(true);

    await env.DB.prepare(
      `UPDATE operator_execution_library_sources
       SET active = 0
       WHERE source_type = 'd1_table_manifest' AND source_id = 'operator_ops_memory'`,
    ).run();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO operator_execution_library_sources (
        source_key, source_type, source_id, source_scope, text, metadata_json, active, synced_at
      ) VALUES ('d1_table_manifest:stale_fixture_table', 'd1_table_manifest', 'stale_fixture_table',
                'universal', 'stale manifest fixture', '{}', 1, CURRENT_TIMESTAMP)`,
    ).run();
    const manifestRepaired = await mcpToolCallRaw<{ execution_library: { policy_ready: boolean; table_manifest_complete: boolean } }>("executeLensicallyIntent", {
      objective: "Repair an exact D1 manifest membership mismatch.",
      intent: "inspect engineering access state",
      inputs: {},
    });
    expect(manifestRepaired.isError).not.toBe(true);
    expect(manifestRepaired.structuredContent.execution_library).toMatchObject({
      policy_ready: true,
      table_manifest_complete: true,
    });
    const manifestRows = await env.DB.prepare(
      `SELECT source_id, active FROM operator_execution_library_sources
       WHERE source_type = 'd1_table_manifest' AND source_id IN ('operator_ops_memory', 'stale_fixture_table')
       ORDER BY source_id`,
    ).all<{ source_id: string; active: number }>();
    expect(manifestRows.results).toEqual([
      { source_id: "operator_ops_memory", active: 1 },
      { source_id: "stale_fixture_table", active: 0 },
    ]);

    const memoryId = crypto.randomUUID();
    const marker = `immediate policy refresh marker ${memoryId}`;
    await env.DB.prepare(
      `INSERT INTO operator_ops_memory (id, title, fix, applies_when, tags_json, active)
       VALUES (?, ?, ?, ?, '[]', 1)`,
    ).bind(memoryId, marker, "Use the newly written policy on the next action.", marker).run();
    const dirty = await env.DB.prepare(
      `SELECT source_fingerprint FROM operator_execution_library_ingestion_state
       WHERE source_system = 'refresh' AND source_name = 'dynamic_sources' LIMIT 1`,
    ).first<{ source_fingerprint: string }>();
    expect(dirty?.source_fingerprint).toBe("dirty");

    const applied = await mcpToolCallRaw<{ execution_library: { policy_ready: boolean } }>("executeLensicallyIntent", {
      objective: "Verify the newly written policy is used immediately.",
      intent: `${marker} gateway status`,
      inputs: {},
    });
    expect(applied.isError).not.toBe(true);
    expect(applied.structuredContent.execution_library.policy_ready).toBe(true);

    const compiled = await env.DB.prepare(
      `SELECT policy_json FROM operator_execution_library_events
       WHERE action_intent = ? AND phase = 'policy_compiled'
       ORDER BY datetime(created_at) DESC, rowid DESC LIMIT 1`,
    ).bind(`${marker} gateway status`).first<{ policy_json: string }>();
    const policy = JSON.parse(String(compiled?.policy_json ?? "{}")) as { matched_source_keys?: string[] };
    expect(policy.matched_source_keys).toContain(`ops_memory:${memoryId}`);
    const refreshed = await env.DB.prepare(
      `SELECT source_fingerprint FROM operator_execution_library_ingestion_state
       WHERE source_system = 'refresh' AND source_name = 'dynamic_sources' LIMIT 1`,
    ).first<{ source_fingerprint: string }>();
    expect(refreshed?.source_fingerprint).not.toBe("dirty");

    const forcedRefresh = await mcpToolCallRaw<{ ok: boolean }>("executeLensicallyIntent", {
      objective: "Persist a policy-changing memory entry and preserve canonical routes.",
      intent: "record ops memory",
      inputs: {
        title: `forced refresh fixture ${memoryId}`,
        fix: "Preserve source-defined phonebook policies during forced refresh.",
      },
    });
    expect(forcedRefresh.isError, JSON.stringify(forcedRefresh.structuredContent)).not.toBe(true);
    const preservedRoutes = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM operator_execution_library_sources
       WHERE active = 1 AND source_type = 'pre_call_route' AND source_id LIKE 'source:%'`,
    ).first<{ total: number }>();
    expect(Number(preservedRoutes?.total ?? 0)).toBeGreaterThan(0);
  }, 30000);

  it.skip("retired: dynamic route discovery and promotion", async () => {
    const actionIntent = "perform a completely novel memory census";
    const unknown = await mcpToolCallRaw<{
      error: string;
      map_state: string;
      incident: { id: string };
      discovery_permit: string;
    }>("executeLensicallyIntent", {
      objective: "Test unknown-path promotion.",
      intent: actionIntent,
      inputs: { limit: 1 },
    });
    expect(unknown.isError).toBe(true);
    expect(unknown.structuredContent.error).toBe("mandatory_execution_map_unknown");
    expect(unknown.structuredContent.map_state).toBe("unknown");
    expect(typeof unknown.structuredContent.discovery_permit).toBe("string");

    const failedDiscovery = await mcpToolCallRaw<{
      mandatory_execution_map: { map_state: string; failed_path_recorded: boolean };
    }>("executeLensicallyIntent", {
      objective: "Test unknown-path promotion.",
      intent: actionIntent,
      inputs: { path: "missing-file-for-map-discovery.txt", discovery_tool: "readRepoFile" },
      permit: unknown.structuredContent.discovery_permit,
    });
    expect(failedDiscovery.isError).toBe(true);
    expect(failedDiscovery.structuredContent.mandatory_execution_map).toMatchObject({
      map_state: "discovery_continues",
      failed_path_recorded: true,
    });

    const duplicateDiscovery = await mcpToolCallRaw<{ error: string }>("executeLensicallyIntent", {
      objective: "Test unknown-path promotion.",
      intent: actionIntent,
      inputs: { path: "missing-file-for-map-discovery.txt", discovery_tool: "readRepoFile" },
      permit: unknown.structuredContent.discovery_permit,
    });
    expect(duplicateDiscovery.isError).toBe(true);
    expect(duplicateDiscovery.structuredContent.error).toBe("mandatory_execution_map_duplicate_discovery_attempt");

    const discovered = await mcpToolCallRaw<{
      ok: boolean;
      mandatory_execution_map: { map_state: string; mandatory_from_now_on: boolean; active_entry: { tool_name: string } };
    }>("executeLensicallyIntent", {
      objective: "Test unknown-path promotion.",
      intent: actionIntent,
      inputs: { limit: 1, discovery_tool: "listOpsMemory" },
      permit: unknown.structuredContent.discovery_permit,
    });
    expect(discovered.isError).not.toBe(true);
    expect(discovered.structuredContent.mandatory_execution_map).toMatchObject({
      map_state: "discovery_promoted",
      mandatory_from_now_on: true,
      active_entry: { tool_name: "listOpsMemory" },
    });

    const repeated = await mcpToolCallRaw<{
      routed_execution: { executed_tool: string; model_tool_choice_allowed: boolean };
      mandatory_execution_map: { map_state: string };
    }>("executeLensicallyIntent", {
      objective: "Repeat the now-known task.",
      intent: actionIntent,
      inputs: { limit: 1 },
    });
    expect(repeated.isError).not.toBe(true);
    expect(repeated.structuredContent.routed_execution).toMatchObject({
      executed_tool: "listOpsMemory",
      model_tool_choice_allowed: false,
    });
    expect(repeated.structuredContent.mandatory_execution_map.map_state).toBe("known_path_completed");
  }, 30000);

  it.skip("retired: discovery permit round trip", async () => {
    const actionIntent = "perform a novel gateway permit round trip";
    const unknown = await mcpToolCallRaw<{
      error: string;
      incident: { id: string };
      discovery_permit: string;
    }>("executeLensicallyIntent", {
      objective: "Open a permit round-trip incident.",
      intent: actionIntent,
      inputs: { limit: 2 },
    });
    expect(unknown.isError).toBe(true);
    expect(unknown.structuredContent.error).toBe("mandatory_execution_map_unknown");

    const roundTrip = await mcpToolCallRaw<{
      error: string;
      discovery_permit: string;
      map_execution: { permit_accepted: boolean; incident_id: string; requested_inputs: { limit: number } };
    }>("executeLensicallyIntent", {
      objective: "Open a permit round-trip incident.",
      intent: actionIntent,
      incident_id: unknown.structuredContent.incident.id,
      inputs: { limit: 2 },
      permit: unknown.structuredContent.discovery_permit,
    });
    expect(roundTrip.isError).toBe(true);
    expect(roundTrip.structuredContent.error).toBe("mandatory_execution_map_discovery_tool_required");
    expect(roundTrip.structuredContent.map_execution).toMatchObject({
      permit_accepted: true,
      incident_id: unknown.structuredContent.incident.id,
      requested_inputs: { limit: 2 },
    });

    const discovered = await mcpToolCallRaw<{
      mandatory_execution_map: { map_state: string; mandatory_from_now_on: boolean; active_entry: { tool_name: string } };
    }>("executeLensicallyIntent", {
      objective: "Open a permit round-trip incident.",
      intent: actionIntent,
      incident_id: unknown.structuredContent.incident.id,
      inputs: { limit: 2, discovery_tool: "listOpsMemory" },
      permit: unknown.structuredContent.discovery_permit,
    });
    expect(discovered.isError).not.toBe(true);
    expect(discovered.structuredContent.mandatory_execution_map).toMatchObject({
      map_state: "discovery_promoted",
      mandatory_from_now_on: true,
      active_entry: { tool_name: "listOpsMemory" },
    });
    }, 30000);

    it.skip("retired: discovery incident continuation", async () => {
    const actionIntent = "perform a novel client-safe discovery round trip";
    const unknown = await mcpToolCallRaw<{
      error: string;
      incident: { id: string };
    }>("executeLensicallyIntent", {
      objective: "Open a client-safe discovery incident.",
      intent: actionIntent,
      inputs: { ticket: "client-safe-discovery" },
    });
    expect(unknown.isError).toBe(true);
    expect(unknown.structuredContent.error).toBe("mandatory_execution_map_unknown");

    const roundTrip = await mcpToolCallRaw<{
      error: string;
      map_execution: { permit_accepted: boolean; incident_id: string; requested_inputs: { ticket: string } };
    }>("executeLensicallyIntent", {
      objective: "Continue the client-safe discovery incident.",
      intent: actionIntent,
      continuation_id: unknown.structuredContent.incident.id,
      inputs: { ticket: "client-safe-discovery" },
    });
    expect(roundTrip.isError).toBe(true);
    expect(roundTrip.structuredContent.error).toBe("mandatory_execution_map_discovery_tool_required");
    expect(roundTrip.structuredContent.map_execution).toMatchObject({
      permit_accepted: true,
      incident_id: unknown.structuredContent.incident.id,
      requested_inputs: { ticket: "client-safe-discovery" },
    });

    const discovered = await mcpToolCallRaw<{
      mandatory_execution_map: { map_state: string; mandatory_from_now_on: boolean; active_entry: { tool_name: string } };
    }>("executeLensicallyIntent", {
      objective: "Complete the client-safe discovery incident.",
      intent: actionIntent,
      continuation_id: unknown.structuredContent.incident.id,
      inputs: {
        ticket: "client-safe-discovery",
        discovery_tool: "listOpsMemory",
        discovery_inputs: { limit: 3 },
      },
    });
    expect(discovered.isError).not.toBe(true);
    expect(discovered.structuredContent.mandatory_execution_map).toMatchObject({
      map_state: "discovery_promoted",
      mandatory_from_now_on: true,
      active_entry: { tool_name: "listOpsMemory" },
    });
  }, 30000);

  it("routes operational status and engineering intents deterministically away from content procedures", async () => {
    const status = await mcpToolCallRaw<{
      ok: boolean;
      routed_execution: { executed_tool: string };
      mandatory_execution_map: { map_state: string; d1_execution_library_bypassed: boolean; discovery_allowed: boolean };
      execution_guard_enforcement: {
        mode: string;
        d1_bootstrap_bypassed: boolean;
        d1_pre_call_routing_bypassed: boolean;
        d1_execution_events_bypassed: boolean;
        d1_autonomy_bypassed: boolean;
      };
      status_kind?: string;
      missing_inputs?: string[];
    }>("executeLensicallyIntent", {
      profile_id: "engineering_precheck",
      inputs: {},
    });
    if (status.isError) throw new Error(JSON.stringify(status.structuredContent));
    expect(status.structuredContent.routed_execution.executed_tool).toBe("engineeringPrecheck");
    expect(status.structuredContent.status_kind).toBe("compact_engineering_precheck");
    expect(status.structuredContent.mandatory_execution_map).toMatchObject({
      map_state: "source_defined_direct_completed",
      d1_execution_library_bypassed: true,
      discovery_allowed: false,
    });
    expect(status.structuredContent.execution_guard_enforcement).toMatchObject({
      mode: "source_defined_direct_engineering",
      d1_bootstrap_bypassed: true,
      d1_pre_call_routing_bypassed: true,
      d1_execution_events_bypassed: true,
      d1_autonomy_bypassed: true,
    });
    expect(status.structuredContent.routed_execution.executed_tool).not.toBe("submit_candidate_draft");
    expect(status.structuredContent.missing_inputs ?? []).not.toEqual(expect.arrayContaining(["brand_key", "run_id", "source_card_id"]));

    const gatewayHealth = await mcpToolCallRaw<{ routed_execution: { executed_tool: string }; status_kind?: string }>("executeLensicallyIntent", {
      profile_id: "engineering_precheck",
      inputs: {},
    });
    expect(gatewayHealth.isError).not.toBe(true);
    expect(gatewayHealth.structuredContent.routed_execution.executed_tool).toBe("engineeringPrecheck");
    expect(gatewayHealth.structuredContent.status_kind).toBe("compact_engineering_precheck");

        const repoStatusFetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (request.method !== "GET" || url.origin !== "https://api.github.com") {
        throw new Error(`No outbound mock for ${request.method} ${url.toString()}`);
      }
      if (url.pathname === "/repos/profitproperly/Lensically/branches/main") {
        return new Response(JSON.stringify({ commit: { sha: "vitest-head-sha" } }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/repos/profitproperly/Lensically/commits/vitest-head-sha/check-runs" && url.searchParams.get("per_page") === "100") {
        return new Response(JSON.stringify({ total_count: 0, check_runs: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.pathname === "/repos/profitproperly/Lensically/commits/vitest-head-sha/status") {
        return new Response(JSON.stringify({ state: "pending", statuses: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`No outbound mock for ${request.method} ${url.toString()}`);
    });
    const alignment = await mcpToolCallRaw<{ routed_execution: { executed_tool: string } }>("executeLensicallyIntent", {
            profile_id: "repository_status",
      inputs: {},
    });
    repoStatusFetchSpy.mockRestore();
    expect(alignment.isError, JSON.stringify(alignment.structuredContent)).not.toBe(true);
    expect(alignment.structuredContent.routed_execution.executed_tool).toBe("getRepoStatus");

    const audit = await mcpToolCallRaw<{ routed_execution: { executed_tool: string } }>("executeLensicallyIntent", {
      profile_id: "list_engineering_audit",
      inputs: { limit: 1 },
    });
    expect(audit.isError).not.toBe(true);
    expect(audit.structuredContent.routed_execution.executed_tool).toBe("listEngineeringAudit");
    expect(audit.structuredContent.routed_execution.executed_tool).not.toBe("inspectMcpFailure");

    const repair = await mcpToolCallRaw<{
      tool_name: string;
      error: string;
      validation_errors?: Array<{ path: string }>;
    }>("executeLensicallyIntent", {
            profile_id: "repository_patch_set",
      inputs: {
        dry_run: true,
        message: "Dry-run gateway repair route",
        patches: [],
      },
    });
    expect(repair.isError).toBe(true);
    expect(repair.structuredContent.error).toBe("routed_gateway_payload_invalid");
    expect(repair.structuredContent.tool_name).toBe("applyRepoPatchSet");
    expect(JSON.stringify(repair.structuredContent)).not.toContain("submit_candidate_draft");
  }, 30000);

  it.skip("retired: stale dynamic route replacement", async () => {
    const actionIntent = "read repository file";
    const stale = await mcpToolCallRaw<{
      mandatory_execution_map: { map_state: string; discovery_permit: string; old_path_blocked: boolean };
    }>("executeLensicallyIntent", {
      objective: "Exercise stale-path replacement.",
      intent: actionIntent,
      inputs: { path: "missing-file-for-map-test.txt" },
    });
    expect(stale.isError).toBe(true);
    expect(stale.structuredContent.mandatory_execution_map).toMatchObject({
      map_state: "known_path_became_stale",
      old_path_blocked: true,
    });

    const bypass = await mcpToolCallRaw<{ error: string; discovery_permit: string }>("executeLensicallyIntent", {
      objective: "Try to bypass stale-path replacement.",
      intent: actionIntent,
      inputs: { prefix: "lensically-worker/src", limit: 1 },
    });
    expect(bypass.isError).toBe(true);
    expect(bypass.structuredContent.error).toBe("mandatory_execution_map_open_incident_permit_required");
    expect(typeof bypass.structuredContent.discovery_permit).toBe("string");

    const replacement = await mcpToolCallRaw<{
      mandatory_execution_map: {
        map_state: string;
        previous_path_superseded: boolean;
        active_entry: {
          tool_name: string;
          procedure: { ordered_steps: string[]; testimony: { failed_paths: Array<{ tool_name: string }>; verified_successful_tool: string; mandatory_statement: string } };
          historical_failures: Array<{ tool_name: string }>;
        };
      };
    }>("executeLensicallyIntent", {
      objective: "Exercise stale-path replacement.",
      intent: actionIntent,
      inputs: { limit: 1, discovery_tool: "listOpsMemory" },
      permit: stale.structuredContent.mandatory_execution_map.discovery_permit,
    });
    expect(replacement.isError, `replacement failed: ${JSON.stringify(replacement.structuredContent)}`).not.toBe(true);
    expect(replacement.structuredContent.mandatory_execution_map).toMatchObject({
      map_state: "discovery_promoted",
      previous_path_superseded: true,
      active_entry: { tool_name: "listOpsMemory" },
    });
    const promotedEntry = replacement.structuredContent.mandatory_execution_map.active_entry;
    expect(promotedEntry.procedure.ordered_steps.length).toBeGreaterThan(0);
    expect(promotedEntry.procedure.testimony.verified_successful_tool).toBe("listOpsMemory");
    expect(promotedEntry.procedure.testimony.mandatory_statement).toContain("active verified path");
    expect(promotedEntry.procedure.testimony.failed_paths).toContainEqual(expect.objectContaining({ tool_name: "readRepoFile" }));
    expect(promotedEntry.historical_failures).toContainEqual(expect.objectContaining({ tool_name: "readRepoFile" }));

    const enforced = await mcpToolCallRaw<{
      routed_execution: { executed_tool: string };
      mandatory_execution_map: { map_state: string };
    }>("executeLensicallyIntent", {
      objective: "Use the replacement path.",
      intent: actionIntent,
      inputs: { limit: 1 },
    });
    expect(enforced.isError, `enforced replacement failed: ${JSON.stringify(enforced.structuredContent)}`).not.toBe(true);
    expect(enforced.structuredContent.routed_execution.executed_tool).toBe("listOpsMemory");
    expect(enforced.structuredContent.mandatory_execution_map.map_state).toBe("known_path_completed");
  }, 30000);

  it("replays interrupted workflow-session creation without duplicates", async () => {
    await ensureMcpAccountOpen(BRAND_KEY);
    const operationId = "vitest-session-create-001";
    const first = await mcpTool<{ workflow_session_id: string; idempotency: { replayed: boolean } }>("start_workflow_session", {
      brand_key: BRAND_KEY,
      operation_id: operationId,
    });
    const replay = await mcpTool<{ workflow_session_id: string; idempotency: { replayed: boolean } }>("start_workflow_session", {
      brand_key: BRAND_KEY,
      operation_id: operationId,
    });
    expect(replay.workflow_session_id).toBe(first.workflow_session_id);
    expect(first.idempotency.replayed).toBe(false);
    expect(replay.idempotency.replayed).toBe(true);
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM operator_workflow_sessions WHERE brand_key = ? AND status = 'active'`,
    ).bind(BRAND_KEY).first<{ total: number }>();
    expect(Number(count?.total ?? 0)).toBe(1);
  }, 30000);

      it("reconfirming Proceed refreshes canonical continuity without a second owner choice", async () => {
    await ensureMcpAccountOpen(BRAND_KEY);
    const reconfirmed = await mcpToolRaw<{ continuity_loaded: boolean; continuation_choice_required: boolean; continuity_capsule: { brand_key: string } }>("confirmOperatorProceed", { brand_key: BRAND_KEY });
    expect(reconfirmed.isError).not.toBe(true);
    expect(reconfirmed.structuredContent.continuity_loaded).toBe(true);
    expect(reconfirmed.structuredContent.continuation_choice_required).toBe(false);
    expect(reconfirmed.structuredContent.continuity_capsule.brand_key).toBe(BRAND_KEY);

        const allowed = await mcpToolRaw<{ ok: boolean }>("getWorkflowStatus", {
      brand_key: BRAND_KEY,
      proceed_confirmed: true,
    });
    expect(allowed.isError).not.toBe(true);
    expect(allowed.structuredContent.ok).toBe(true);
  }, 30000);

    it("automatic continuity preserves and resumes the current active workflow session", async () => {
    const prior = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", { brand_key: BRAND_KEY });
    const proceeded = await mcpToolRaw<{
      continuity_loaded: boolean;
      continuation_choice_required: boolean;
      continuity_capsule: { workflow_checkpoint: { workflow_session_id: string } };
    }>("confirmOperatorProceed", { brand_key: BRAND_KEY });
    expect(proceeded.isError).not.toBe(true);
    expect(proceeded.structuredContent.continuity_loaded).toBe(true);
    expect(proceeded.structuredContent.continuation_choice_required).toBe(false);
    expect(proceeded.structuredContent.continuity_capsule.workflow_checkpoint.workflow_session_id).toBe(prior.workflow_session_id);
    const active = await env.DB.prepare(`SELECT COUNT(*) AS total FROM operator_workflow_sessions WHERE brand_key = ? AND status = 'active'`).bind(BRAND_KEY).first<{ total: number }>();
    expect(Number(active?.total ?? 0)).toBe(1);
  }, 30000);

      it("replaces a skipped Manifest review item without preserving stale source lineage", async () => {
    await seedManifestPatterns(30);
    const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", { brand_key: "manifest_mental" });
    const batch = await operatorTool<{
      review_batch_id: string;
      items: Array<{
        item_number: number;
        source_selection_id: string;
        source_batch_id: string;
        source_identity_key: string;
        source_text: string;
      }>;
    }>("claim_manifest_review_batch", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      production_date: "2099-01-04",
      timezone: "America/New_York",
      fresh_draw: true,
    });
    const original = batch.items[0];
    expect(original).toBeTruthy();

    const buildShownDraft = async (sourceSelectionId: string, title: string, text: string) => {
      const card = await operatorTool<{ source_card_id: string }>("create_source_card", {
        brand_key: "manifest_mental",
        workflow_session_id: session.workflow_session_id,
        source_selection_id: sourceSelectionId,
        sequence_label: title,
        lane_key: "systems",
        title,
        transformation_contract: {
          must_preserve_function: ["Keep the source's calendar-workflow focus."],
          may_reuse: ["calendar workflow"],
          must_transform: [{ source_text: "complete source wording", role: "complete source wording", instruction: "Rewrite the complete source wording." }],
          audience_reward: "Give the reader one concise calendar-workflow observation.",
        },
        source_mechanism: "Use the source's calendar-workflow focus in one concise observation.",
        required_product: "One independently written calendar-workflow sentence.",
        forbidden_surfaces: ["exact complete source sentence"],
        pass_conditions: ["The calendar-workflow focus remains clear."],
        fail_conditions: ["The complete source sentence is copied."],
      });
      await operatorTool("lock_source_card", { brand_key: "manifest_mental", source_card_id: card.source_card_id });
      const run = await operatorTool<{ run_id: string }>("create_generation_run", {
        brand_key: "manifest_mental",
        source_card_id: card.source_card_id,
        adaptation_plan: {
          adaptation_goal: "Create one independently written calendar-workflow observation.",
          preserved_functions: ["Keep the source's calendar-workflow focus."],
          transformed_elements: ["complete source wording"],
          intentionally_different_from_prior: "Use a new source and independently written surface language.",
        },
      });
      const draft = await operatorTool<{ draft_id: string; showable: boolean }>("submit_candidate_draft", {
        brand_key: "manifest_mental",
        run_id: run.run_id,
        source_card_id: card.source_card_id,
                text,
        strategy: { lane_key: "systems" },
        draft_analysis: {
          opening_phrase: text.split(" ").slice(0, 4).join(" "),
          realm_entrance_key: title.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          hook_style: "direct_observation",
          lane_key: "systems",
          preserved_functions: ["Keep the source's calendar-workflow focus."],
          transformed_elements: ["complete source wording"],
          satisfied_time_or_context_requirements: [],
          audience_reward_delivered: true,
        },
      });
      expect(draft.showable).toBe(true);
      await operatorTool("mark_draft_shown", { brand_key: "manifest_mental", draft_id: draft.draft_id });
      return { sourceCardId: card.source_card_id, runId: run.run_id, draftId: draft.draft_id };
    };

    const originalDraft = await buildShownDraft(
      original.source_selection_id,
      "Original review source",
      "A calendar workflow works better when each step stays connected.",
    );

    const priorBatchId = crypto.randomUUID();
    const priorSelectionId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO operator_source_selection_batches (
        id, brand_key, workflow_session_id, selection_method, eligibility_min_likes,
        qualified_pool_count, requested_count, selected_count, selected_at, metadata_json,
        production_date, status
      )
      SELECT ?, brand_key, workflow_session_id, selection_method, eligibility_min_likes,
             qualified_pool_count, requested_count, selected_count, selected_at, metadata_json,
             '2099-01-03', 'retired'
      FROM operator_source_selection_batches
      WHERE id = ?`,
    ).bind(priorBatchId, original.source_batch_id).run();
    await env.DB.prepare(
      `INSERT INTO operator_source_selections (
        id, batch_id, brand_key, workflow_session_id, draw_order, source_identity_key,
        source_type, internal_source_id, threads_post_id, canonical_source_url,
        post_text, original_posted_at, metrics_snapshot_json, source_snapshot_json, selected_at
      )
      SELECT ?, ?, brand_key, workflow_session_id, draw_order, source_identity_key,
             source_type, internal_source_id, threads_post_id, canonical_source_url,
             post_text, original_posted_at, metrics_snapshot_json, source_snapshot_json, selected_at
      FROM operator_source_selections
      WHERE id = ?`,
    ).bind(priorSelectionId, priorBatchId, original.source_selection_id).run();
    await env.DB.prepare(
      `UPDATE operator_source_cards SET source_selection_id = ? WHERE id = ?`,
    ).bind(priorSelectionId, originalDraft.sourceCardId).run();

    const canonicalReuse = await operatorTool<{
      items: Array<{
        item_number: number;
        source_selection_id: string;
        source_identity_key: string;
        source_text: string;
        source_card_id: string;
        generated_post: string;
      }>;
    }>("attach_manifest_review_draft", {
      brand_key: "manifest_mental",
      review_batch_id: batch.review_batch_id,
      item_number: 1,
      source_card_id: originalDraft.sourceCardId,
      generation_run_id: originalDraft.runId,
      draft_id: originalDraft.draftId,
    });
    expect(canonicalReuse.items.find((item) => item.item_number === 1)).toMatchObject({
      source_selection_id: original.source_selection_id,
      source_identity_key: original.source_identity_key,
      source_text: original.source_text,
      source_card_id: originalDraft.sourceCardId,
      generated_post: "A calendar workflow works better when each step stays connected.",
    });

    await operatorTool("skip_manifest_review_source", {
      brand_key: "manifest_mental",
      review_batch_id: batch.review_batch_id,
      item_number: 1,
      scope: "current_day",
      reason: "Replace a recently used source.",
    });

    const claimedIds = new Set(batch.items.map((item) => item.source_selection_id));
    const replacement = await env.DB.prepare(
      `SELECT id, source_identity_key, post_text
       FROM operator_source_selections
       WHERE batch_id = ? AND brand_key = 'manifest_mental'
       ORDER BY draw_order ASC`,
    ).bind(original.source_batch_id).all<{ id: string; source_identity_key: string; post_text: string }>();
    const replacementSelection = (replacement.results ?? []).find((row) => !claimedIds.has(row.id));
    expect(replacementSelection).toBeTruthy();

    const replacementDraft = await buildShownDraft(
      replacementSelection!.id,
      "Replacement review source",
      "A different calendar workflow can keep every step clear and connected.",
    );
    const repaired = await operatorTool<{
      items: Array<{
        item_number: number;
        source_selection_id: string;
        source_identity_key: string;
        source_text: string;
        generated_post: string;
        disposition_reason: string | null;
      }>;
    }>("attach_manifest_review_draft", {
      brand_key: "manifest_mental",
      review_batch_id: batch.review_batch_id,
      item_number: 1,
      source_card_id: replacementDraft.sourceCardId,
      generation_run_id: replacementDraft.runId,
      draft_id: replacementDraft.draftId,
    });
    const repairedItem = repaired.items.find((item) => item.item_number === 1);
    expect(repairedItem).toMatchObject({
      source_selection_id: replacementSelection!.id,
      source_identity_key: replacementSelection!.source_identity_key,
      source_text: replacementSelection!.post_text,
      generated_post: "A different calendar workflow can keep every step clear and connected.",
      disposition_reason: null,
    });

    const dispositions = await env.DB.prepare(
      `SELECT id, disposition FROM operator_source_selections WHERE id IN (?, ?) ORDER BY id`,
    ).bind(original.source_selection_id, replacementSelection!.id).all<{ id: string; disposition: string }>();
    const dispositionById = new Map((dispositions.results ?? []).map((row) => [row.id, row.disposition]));
        expect(dispositionById.get(original.source_selection_id)).toBe("skipped");
    expect(dispositionById.get(replacementSelection!.id)).toBe("claimed");

    const reviewDrafts = [replacementDraft];
    for (const item of batch.items.slice(1)) {
      const itemDraft = await buildShownDraft(
        item.source_selection_id,
        `Sparse strategy review source ${item.item_number}`,
        `Calendar workflow ${item.item_number} keeps each next step clear and connected.`,
      );
      await operatorTool("attach_manifest_review_draft", {
        brand_key: "manifest_mental",
        review_batch_id: batch.review_batch_id,
        item_number: item.item_number,
        source_card_id: itemDraft.sourceCardId,
        generation_run_id: itemDraft.runId,
        draft_id: itemDraft.draftId,
      });
      reviewDrafts.push(itemDraft);
    }
    for (const itemDraft of reviewDrafts) {
      await operatorTool("approve_draft", {
        brand_key: "manifest_mental",
        draft_id: itemDraft.draftId,
        feedback_note: "Approved sparse-strategy batch scheduling fixture.",
      });
    }

    const scheduledResults: Array<{ item_number: number; success: boolean; scheduled_post_id?: number }> = [];
    let scheduledReviewBatch: { status: string; items: Array<{ item_number: number; status: string; scheduled_post_id: number | null }> } | null = null;
    for (const itemNumber of [1, 2, 3, 4]) {
      const scheduled = await operatorTool<{
        results: Array<{ item_number: number; success: boolean; scheduled_post_id?: number }>;
        invocation_item_limit: number;
        continuation_required: boolean;
        review_batch: { status: string; items: Array<{ item_number: number; status: string; scheduled_post_id: number | null }> };
      }>("schedule_manifest_review_batch", {
        brand_key: "manifest_mental",
        review_batch_id: batch.review_batch_id,
        item_numbers: [itemNumber],
      });
      expect(scheduled.invocation_item_limit).toBe(1);
      expect(scheduled.results).toHaveLength(1);
      scheduledResults.push(...scheduled.results);
      scheduledReviewBatch = scheduled.review_batch;
    }
    expect(scheduledResults).toHaveLength(4);
    expect(scheduledResults.every((result) => result.success && Number(result.scheduled_post_id ?? 0) > 0)).toBe(true);
    expect(scheduledReviewBatch?.status).toBe("completed");
    expect(scheduledReviewBatch?.items.every((item) => item.status === "scheduled" && Number(item.scheduled_post_id ?? 0) > 0)).toBe(true);

    const reconciledAttachment = await operatorTool<{ status: string }>("attach_manifest_review_draft", {
      brand_key: "manifest_mental",
      review_batch_id: batch.review_batch_id,
      item_number: 1,
      source_card_id: replacementDraft.sourceCardId,
      generation_run_id: replacementDraft.runId,
      draft_id: replacementDraft.draftId,
    });
    expect(reconciledAttachment.status).toBe("completed");

    await env.DB.prepare(
      `UPDATE operator_review_batches SET status = 'owner_review' WHERE id = ?`,
    ).bind(batch.review_batch_id).run();
    const continued = await mcpToolRaw<{
      continuity_capsule: {
        active_review_batch: null;
        completed_review_batch: { review_batch_id: string };
        workflow_checkpoint: { next_pending_action: string; canonical_next_tool: string };
      };
    }>("confirmOperatorProceed", { brand_key: "manifest_mental" });
    expect(continued.isError).not.toBe(true);
    expect(continued.structuredContent.continuity_capsule.active_review_batch).toBeNull();
    expect(continued.structuredContent.continuity_capsule.completed_review_batch.review_batch_id).toBe(batch.review_batch_id);
    expect(continued.structuredContent.continuity_capsule.workflow_checkpoint).toMatchObject({
      next_pending_action: "discuss_growth_mission_brief",
      canonical_next_tool: "getGrowthMission",
    });

    const nextBatch = await operatorTool<{ review_batch_id: string; reused_existing?: boolean }>("claim_manifest_review_batch", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      production_date: "2099-01-04",
      timezone: "America/New_York",
    });
    expect(nextBatch.review_batch_id).not.toBe(batch.review_batch_id);
    expect(nextBatch.reused_existing).not.toBe(true);
    const repairedParent = await env.DB.prepare(
      `SELECT status FROM operator_review_batches WHERE id = ?`,
    ).bind(batch.review_batch_id).first<{ status: string }>();
    expect(repairedParent?.status).toBe("completed");
  }, 70000);

    it("automatic continuity prioritizes the earliest incomplete calendar day without redrawing", async () => {

    await seedManifestPatterns(30);
    const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", { brand_key: "manifest_mental" });
    const batch = await operatorTool<{ review_batch_id: string; source_batch_reused: boolean; items: Array<{ source_identity_key: string }> }>("claim_manifest_review_batch", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      production_date: "2099-01-03",
      timezone: "America/New_York",
      fresh_draw: true,
    });
    const proceeded = await mcpToolRaw<{
      continuity_loaded: boolean;
      continuity_capsule: {
        continuity_mode: string;
        workflow_checkpoint: { workflow_session_id: string; next_pending_action: string; canonical_next_tool: string };
        active_review_batch: { review_batch_id: string; items: Array<{ source_identity_key: string }> };
        calendar_coverage: { earliest_incomplete_date: string | null };
      };
    }>("confirmOperatorProceed", { brand_key: "manifest_mental" });
    expect(proceeded.isError).not.toBe(true);
    const capsule = proceeded.structuredContent.continuity_capsule;
    expect(capsule.continuity_mode).toBe("guided_growth_diagnostic");
    expect(capsule.workflow_checkpoint.workflow_session_id).toBe(session.workflow_session_id);
    expect(capsule.workflow_checkpoint.next_pending_action).toBe("discuss_growth_mission_brief");
    expect(capsule.workflow_checkpoint.canonical_next_tool).toBe("getGrowthMission");
    expect(capsule.active_review_batch.review_batch_id).toBe(batch.review_batch_id);
    expect(capsule.active_review_batch.items.map((item) => item.source_identity_key)).toEqual(batch.items.map((item) => item.source_identity_key));
    const sourceBatchCount = await env.DB.prepare(`SELECT COUNT(*) AS total FROM operator_source_selection_batches WHERE workflow_session_id = ?`).bind(session.workflow_session_id).first<{ total: number }>();
        expect(Number(sourceBatchCount?.total ?? 0)).toBe(1);
  }, 40000);

  it("inspects unresolved delivery incidents read-only before the Growth Mission discussion", async () => {
    await seedManifestPatterns(30);
    const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", {
      brand_key: "manifest_mental",
    });
    const batch = await operatorTool<{ review_batch_id: string }>("claim_manifest_review_batch", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      production_date: "2099-01-03",
      timezone: "America/New_York",
      fresh_draw: true,
    });
    const accounts = await operatorTool<{ accounts: Array<{ brand_key: string; threads_user_id: string | null }> }>("list_accounts");
    const manifestThreadsUserId = accounts.accounts.find((account) => account.brand_key === "manifest_mental")?.threads_user_id;
    expect(manifestThreadsUserId).toBeTruthy();
    await operatorTool("list_scheduled_posts", {
      brand_key: "manifest_mental",
      date: "2000-01-01",
      timezone: "America/New_York",
    });
    const inserted = await env.DB.prepare(
      `INSERT INTO scheduled_posts (
        user_id, threads_user_id, post_text, status, scheduled_time
      ) VALUES ('workspace-owner', ?, 'Past-due delivery incident fixture', 'approved', '2000-01-01T12:00:00.000Z')`,
    ).bind(manifestThreadsUserId).run();
    const scheduledPostId = Number(inserted.meta?.last_row_id ?? 0);
    expect(scheduledPostId).toBeGreaterThan(0);

    const proceeded = await mcpToolRaw<{
      continuity_capsule: {
        active_review_batch: { review_batch_id: string };
        unresolved_incidents: Array<{ scheduled_post_id: number; delivery_state: string }>;
        required_recovery_actions: Array<{ scheduled_post_id: number }>;
        new_scheduling_blocked: boolean;
        current_engineering_continuation: { kind: string; blocking: boolean };
        calendar_coverage: { unresolved_delivery_count: number; published_coverage_excludes_unresolved_delivery: boolean };
        workflow_checkpoint: { next_pending_action: string; canonical_next_tool: string };
      };
    }>("confirmOperatorProceed", { brand_key: "manifest_mental" });
    expect(proceeded.isError).not.toBe(true);
    const blockedCapsule = proceeded.structuredContent.continuity_capsule;
    expect(blockedCapsule.active_review_batch.review_batch_id).toBe(batch.review_batch_id);
    expect(blockedCapsule.unresolved_incidents).toEqual(expect.arrayContaining([
      expect.objectContaining({ scheduled_post_id: scheduledPostId, delivery_state: "not_attempted" }),
    ]));
    expect(blockedCapsule.required_recovery_actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ scheduled_post_id: scheduledPostId }),
    ]));
    expect(blockedCapsule.new_scheduling_blocked).toBe(true);
    expect(blockedCapsule.current_engineering_continuation).toMatchObject({
      kind: "delivery_incident",
      blocking: true,
    });
    expect(blockedCapsule.calendar_coverage).toMatchObject({
      unresolved_delivery_count: 1,
      published_coverage_excludes_unresolved_delivery: true,
    });
    expect(blockedCapsule.workflow_checkpoint).toMatchObject({
      next_pending_action: "discuss_growth_mission_brief",
      canonical_next_tool: "getGrowthMission",
    });

    const listed = await operatorTool<{
      items: Array<{ id: number; delivery_state: string; is_past_due: boolean }>;
    }>("list_scheduled_posts", {
      brand_key: "manifest_mental",
      date: "2000-01-01",
      timezone: "America/New_York",
    });
    expect(listed.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: scheduledPostId, delivery_state: "not_attempted", is_past_due: true }),
    ]));

    await env.DB.prepare(
      `UPDATE scheduled_posts
       SET status = 'posted', published_post_id = 'verified-thread-post', published_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(scheduledPostId).run();
    const resumed = await mcpToolRaw<{
      continuity_capsule: {
        unresolved_incidents: Array<Record<string, unknown>>;
        new_scheduling_blocked: boolean;
        workflow_checkpoint: { next_pending_action: string; canonical_next_tool: string };
      };
    }>("confirmOperatorProceed", { brand_key: "manifest_mental" });
    expect(resumed.isError).not.toBe(true);
    expect(resumed.structuredContent.continuity_capsule.unresolved_incidents).toHaveLength(0);
    expect(resumed.structuredContent.continuity_capsule.new_scheduling_blocked).toBe(true);
    expect(resumed.structuredContent.continuity_capsule.workflow_checkpoint).toMatchObject({
      next_pending_action: "discuss_growth_mission_brief",
      canonical_next_tool: "getGrowthMission",
    });
    const incident = await env.DB.prepare(
      `SELECT status, resolution_note FROM operator_operational_incidents WHERE scheduled_post_id = ? LIMIT 1`,
    ).bind(scheduledPostId).first<{ status: string; resolution_note: string | null }>();
    expect(incident).toBeNull();
  }, 50000);

      it("runs Manifest account mutations only after Guided Growth Mission approval and locks again on the next Proceed", async () => {
    await ensureMcpAccountOpen("manifest_mental");

    const blocked = await mcpToolRaw<{ error: string; required_next_tool: string }>("save_strategy_memory", {
      brand_key: "manifest_mental",
      kind: "current_belief",
      body: "Blocked before Guided Growth Mission approval.",
      proceed_confirmed: true,
    });
    expect(blocked.isError).toBe(true);
    expect(blocked.structuredContent).toMatchObject({
      error: "approved_growth_mission_required",
      required_next_tool: "updateGrowthMission",
    });

    const mission = await mcpToolRaw<{
      growth_mission: { status: string; execution_mode: string; mission: Record<string, unknown>; diagnostic: Record<string, unknown> };
    }>("getGrowthMission", {
      brand_key: "manifest_mental",
      proceed_confirmed: true,
    });
    expect(mission.isError).not.toBe(true);
    expect(mission.structuredContent.growth_mission).toMatchObject({
      status: "discussion",
      execution_mode: "guided_owner_approval",
    });
    expect(mission.structuredContent.growth_mission.mission.permanent_mission).toContain("1,000,000 followers");
    expect(mission.structuredContent.growth_mission.diagnostic.diagnosed_bottleneck).toBeTruthy();

    const missingApproval = await mcpToolRaw<{ error: string }>("updateGrowthMission", {
      brand_key: "manifest_mental",
      status: "approved",
      execution_mode: "guided_owner_approval",
      mission_patch: {
        current_bottleneck: "test_fixture_execution",
        primary_objective: "Validate guided account execution.",
        recommended_next_action: "Run the requested isolated regression fixture.",
      },
      proceed_confirmed: true,
    });
    expect(missingApproval.isError).toBe(true);
    expect(missingApproval.structuredContent.error).toBe("owner_response_required_for_growth_plan_approval");

    const approvedMission = await mcpToolRaw<{
      account_execution_unlocked: boolean;
      full_auto_enabled: boolean;
      growth_mission: { status: string; execution_mode: string };
    }>("updateGrowthMission", {
      brand_key: "manifest_mental",
      status: "approved",
      execution_mode: "guided_owner_approval",
      mission_patch: {
        permanent_mission: "Grow Manifest Mental to 1,000,000 followers while protecting audience trust, content quality, account safety, and brand identity.",
        target_followers: 1000000,
        current_bottleneck: "test_fixture_execution",
        primary_objective: "Validate guided account execution.",
        recommended_next_action: "Run the requested isolated regression fixture.",
      },
      owner_response: "I approve this guided growth plan for the current cycle.",
      change_summary: "Approve the isolated Guided Growth Mission fixture.",
      proceed_confirmed: true,
    });
    expect(approvedMission.isError).not.toBe(true);
        expect(approvedMission.structuredContent).toMatchObject({
      account_execution_unlocked: true,
      full_auto_enabled: false,
      growth_mission: { status: "approved", execution_mode: "guided_owner_approval" },
    });

    const invalidKind = await mcpToolRaw<{
      error: string;
      allowed_kinds: string[];
      hardening_incident?: Record<string, unknown>;
      normal_work_blocked?: boolean;
    }>("save_strategy_memory", {
      brand_key: "manifest_mental",
      kind: "generation_rule",
      body: "Invalid finite-kind regression fixture.",
      proceed_confirmed: true,
    });
    expect(invalidKind.isError).toBe(true);
    expect(invalidKind.structuredContent.error).toBe("invalid_strategy_memory_kind");
    expect(invalidKind.structuredContent.allowed_kinds).toContain("approved_rule");
    expect(invalidKind.structuredContent.hardening_incident).toBeUndefined();
    expect(invalidKind.structuredContent.normal_work_blocked).toBeUndefined();

    const first = await mcpToolRaw<{
      ok: boolean;
      account_authority: {
        mode: string;
        growth_plan_status: string;
        owner_ratification_required: boolean;
        routine_account_operations_autonomous: boolean;
        execution_within_approved_plan: boolean;
      };
    }>("save_strategy_memory", {
      brand_key: "manifest_mental",
      kind: "current_belief",
      body: "First guided Manifest mutation fixture.",
      proceed_confirmed: true,
    });
    expect(first.isError).not.toBe(true);
    expect(first.structuredContent.ok).toBe(true);
    expect(first.structuredContent.account_authority).toMatchObject({
      mode: "guided_owner_approval",
      growth_plan_status: "approved",
      owner_ratification_required: true,
      routine_account_operations_autonomous: false,
      execution_within_approved_plan: true,
    });

    const second = await mcpToolRaw<{ ok: boolean }>("save_strategy_memory", {
      brand_key: "manifest_mental",
      kind: "current_belief",
      body: "Second guided Manifest mutation fixture.",
      proceed_confirmed: true,
    });
    expect(second.isError).not.toBe(true);
    expect(second.structuredContent.ok).toBe(true);

        const protectedAttempt = await mcpToolCallRaw<{
      error: string;
      route_trail: Array<{ route_key: string }>;
      map_state: string;
    }>("executeLensicallyIntent", {
      profile_id: "delete_repo_file",
      inputs: {
        path: "AUTONOMY_PROTECTED_FIXTURE.md",
        message: "Protected-operation regression fixture.",
        owner_approval: "No specific protected-operation approval supplied.",
      },
    });
    expect(protectedAttempt.isError).toBe(true);
    expect(protectedAttempt.structuredContent.error).toBe("known_blocker_prevented");
    expect(protectedAttempt.structuredContent.route_trail).toContainEqual(expect.objectContaining({
      route_key: "explicit_owner_ratification_handoff",
    }));

    const compactProposal = await mcpToolRaw<{ decision: { id: string; rationale: string; expected_outcome: string; reversibility: string; execution_plan: string } }>("proposeOperatorDecision", {
      brand_key: "manifest_mental",
      category: "risk",
      title: "Protected deletion fixture",
      decision: "Authorize one protected repository deletion fixture.",
      authorized_tools: ["deleteRepoFile"],
      proceed_confirmed: true,
    });
    expect(compactProposal.isError).not.toBe(true);
    expect(compactProposal.structuredContent.decision.id).toBeTruthy();
    expect(compactProposal.structuredContent.decision.rationale).toBeTruthy();
    expect(compactProposal.structuredContent.decision.expected_outcome).toBeTruthy();
    expect(compactProposal.structuredContent.decision.reversibility).toBeTruthy();
    expect(compactProposal.structuredContent.decision.execution_plan).toBeTruthy();

    const state = await mcpTool<{
      profile: { mode: string; objective: string; operating_constraints: Record<string, unknown> };
    }>("getOperatorDecisionState", {
            brand_key: "manifest_mental",
      proceed_confirmed: true,
    });
    expect(state.profile.mode).toBe("ai_led_owner_ratified");
    expect(state.profile.objective).toContain("1,000,000 followers");
    expect(state.profile.operating_constraints).toMatchObject({
      owner_ratification_required: true,
      routine_account_operations_autonomous: false,
      account_mutations_require_approved_growth_plan: true,
      protected_operations_owner_ratified: true,
    });

    const decisionEvents = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM operator_decision_execution_events WHERE tool_name = 'save_strategy_memory'`,
    ).first<{ total: number }>();
    expect(Number(decisionEvents?.total ?? 0)).toBe(0);

    const reconfirmed = await mcpToolRaw<{
      continuity_capsule: {
        autonomy_governance: {
          profile: { mode: string; objective: string };
        };
        growth_mission_brief: { status: string; discussion_contract: { execution_locked: boolean } };
        account_execution: { unlocked: boolean; discussion_required: boolean };
      };
    }>("confirmOperatorProceed", { brand_key: "manifest_mental" });
    expect(reconfirmed.isError).not.toBe(true);
    expect(reconfirmed.structuredContent.continuity_capsule.autonomy_governance.profile.mode).toBe("ai_led_owner_ratified");
    expect(reconfirmed.structuredContent.continuity_capsule.autonomy_governance.profile.objective).toContain("1,000,000 followers");
    expect(reconfirmed.structuredContent.continuity_capsule.growth_mission_brief).toMatchObject({
      status: "discussion",
      discussion_contract: { execution_locked: true },
    });
    expect(reconfirmed.structuredContent.continuity_capsule.account_execution).toMatchObject({
      unlocked: false,
      discussion_required: true,
    });

    const relocked = await mcpToolRaw<{ error: string; required_next_tool: string }>("save_strategy_memory", {
      brand_key: "manifest_mental",
      kind: "current_belief",
      body: "The next Proceed must require a fresh guided plan approval.",
      proceed_confirmed: true,
    });
    expect(relocked.isError).toBe(true);
    expect(relocked.structuredContent).toMatchObject({
      error: "approved_growth_mission_required",
      required_next_tool: "updateGrowthMission",
    });
    }, 40000);

  it("persists explicit owner ratification before the first protected scheduler call", async () => {
    await ensureMcpAccountOpen("manifest_mental");
    const canary = await mcpToolRaw<{
      ok: boolean;
      scheduler?: { control: { mode: string; allowed_post_ids: number[] } };
      result?: { scheduler: { control: { mode: string; allowed_post_ids: number[] } } };
      autonomy_decision: { governed: boolean; decision_id: string };
        }>("executeLensicallyIntent", {
      profile_id: "run_approved_post_canary",
      inputs: {
        brand_key: "manifest_mental",
        scheduled_post_id: 987654,
        reason: "Protected-operation owner-ratification regression fixture.",
        owner_response: "Proceed",
      },
    });
    expect(canary.isError).not.toBe(true);
    expect(canary.structuredContent.ok).toBe(true);
    const canaryScheduler = canary.structuredContent.scheduler ?? canary.structuredContent.result?.scheduler;
    expect(canaryScheduler?.control).toMatchObject({
      mode: "canary",
      allowed_post_ids: [987654],
    });
    expect(canary.structuredContent.autonomy_decision).toMatchObject({ governed: true });
    const decision = await env.DB.prepare(
      `SELECT status, owner_response FROM operator_decision_proposals WHERE id = ? LIMIT 1`,
    ).bind(canary.structuredContent.autonomy_decision.decision_id).first<{ status: string; owner_response: string }>();
    expect(decision).toEqual({ status: "executed", owner_response: "Proceed" });

    const paused = await mcpToolRaw<{ ok: boolean; scheduler?: { control: { mode: string } }; result?: { scheduler: { control: { mode: string } } } }>("executeLensicallyIntent", {
      profile_id: "set_scheduled_post_scheduler_mode",
      inputs: {
        brand_key: "manifest_mental",
        mode: "paused",
        reason: "Return regression fixture scheduler to safe state.",
        owner_response: "Proceed",
      },
    });
    expect(paused.isError).not.toBe(true);
    const pausedScheduler = paused.structuredContent.scheduler ?? paused.structuredContent.result?.scheduler;
    expect(pausedScheduler?.control.mode).toBe("paused");
  }, 30000);

  it("returns a compact tool inventory without recursive payloads", async () => {
    const listed = await mcpTool<{
      total_tools: number;
      tools: Array<{ name: string }>;
      definition_intent: string;
    }>("listMcpTools", {
      include_disabled: true,
    });
    expect(listed.tools.length).toBeGreaterThan(0);
    expect(listed.total_tools).toBe(listed.tools.length);
    expect(new Set(listed.tools.map((tool) => tool.name)).size).toBe(listed.tools.length);
    expect(listed.tools.every((tool) => Object.keys(tool).length === 1 && typeof tool.name === "string")).toBe(true);
    expect(listed.definition_intent).toBe("read capability definition");
    expect(JSON.stringify(listed)).not.toContain("inputSchema");
    expect(JSON.stringify(listed)).not.toContain("required_fields");
  });

  it.skip("retired: startup depended on database bootstrap failures", async () => {
    await env.DB.prepare(`DROP TABLE IF EXISTS operator_workflow_requirements`).run();
    await env.DB.prepare(`CREATE TABLE operator_workflow_requirements (bad_column TEXT)`).run();
    const response = await fetchFromWorker("/api/operator/mcp", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({ jsonrpc: "2.0", id: 501, method: "tools/call", params: { name: "executeLensicallyIntent", arguments: { objective: "Load startup.", intent: "startup", inputs: {} } } }),
    });
    const payload = await response.json() as { error?: { code: number; message: string; data?: Record<string, unknown> } };
    expect(response.status).toBe(200);
    expect(payload.error).toMatchObject({ code: -32603 });
    expect(payload.error?.message).toContain("Internal MCP error");
    expect(payload.error?.data).toMatchObject({
      ok: false,
      error_code: "operator_mcp_method_failed",
      phase: "tools_call:executeLensicallyIntent",
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
    const listed = await mcpRequest<{ tools: Array<{ name: string; inputSchema?: { additionalProperties?: boolean } }> }>("tools/list");
    const names = listed.tools.map((tool) => tool.name);
    expect(initialized.serverInfo.version).toBe(OPERATOR_MCP_VERSION);
    expect(names).toEqual(expect.arrayContaining([
      "getOperatorStartupContext",
      "selectOperatorKey",
      "confirmOperatorProceed",
      "get_content_focus",
      "start_workflow_session",
      "getRepoStatus",
    ]));
    expect(names).not.toContain("executeLensicallyIntent");
    expect(new Set(names).size).toBe(names.length);
    expect(listed.tools.every((tool) => tool.inputSchema?.additionalProperties === false)).toBe(true);
  });

  it.skip("retired: legacy MCP admin-state requirement view", async () => {
    const state = await mcpTool<{ workflow_requirements: Array<{ stage: string; required_sections: string[]; completion_rule: string }> }>("getMcpAdminState");
    const contextRequirement = state.workflow_requirements.find((item) => item.stage === "context_admission");
    expect(contextRequirement).toMatchObject({
      required_sections: ["operator_precheck"],
      completion_rule: "key_handshake_complete_before_account_work",
    });
  }, 30000);

  it.skip("retired: legacy MCP admin-state repair path", async () => {
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

    it.skip("retired: generic account bridge compatibility", async () => {
    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    const toolNames = listed.tools.map((tool) => tool.name);
    for (const name of ["mm_get_account_state", "om_get_account_state", "vx_get_account_state"]) {
      expect(toolNames).not.toContain(name);
    }

        await ensureMcpAccountOpen("manifest_mental");
    const blockedBridge = await mcpToolRaw<{ error: string; bridge_scope: string }>("listMcpTools", {
      execute_tool: "mm_get_account_state",
      arguments: { proceed_confirmed: true },
    });
    expect(blockedBridge.isError).toBe(true);
    expect(blockedBridge.structuredContent).toMatchObject({
      error: "direct_typed_tool_required",
      bridge_scope: "engineering_admin_and_strict_client_cap_allowlist",
    });

            for (const [clientKey, canonicalKey] of [["manifestmental", "manifest_mental"], ["opmgdeadman", "opmg_deadman"], ["vectrix", "vectrix"]] as const) {
      await ensureMcpAccountOpen(canonicalKey);
      const direct = await mcpToolRaw<{ brand_key: string }>("get_account_state", { brand_key: clientKey, proceed_confirmed: true });
      expect(direct.isError).not.toBe(true);
      expect(direct.structuredContent.brand_key).toBe(canonicalKey);
    }
  }, 30000);

  it("returns non-enumerating operator health metadata", async () => {
    const response = await fetchFromWorker("/api/operator/health");
    const payload = await response.json() as { status?: string; mcp_version?: string; registry_generation?: string; live_tool_count?: number; timestamp?: string; tools?: unknown };
    expect(response.status).toBe(200);
        expect(payload.status).toBe("ok");
    expect(payload.mcp_version).toBe(OPERATOR_MCP_VERSION);
    expect(payload.registry_generation).toBe("static-execution-router-v1");
    expect(payload.live_tool_count).toBeGreaterThan(0);
    expect(payload.timestamp).toBeTruthy();
    expect(payload.tools).toBeUndefined();
  });


  it.skip("retired: OpsMemory and engineering bridge compatibility", async () => {
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

                                const editScheduledDefinition = await mcpTool<{ tool?: { inputSchema?: { properties?: Record<string, unknown> } } }>("readMcpToolDefinition", {
      tool_name: "edit_scheduled_post",
    });
    expect(editScheduledDefinition.tool).toBeTruthy();
    expect(editScheduledDefinition.tool?.inputSchema?.properties?.retry_now).toBeTruthy();
    const beforeEdit = await env.DB.prepare(
      `SELECT scheduled_time FROM scheduled_posts WHERE id = ? LIMIT 1`,
    ).bind(scheduled.scheduled_post_id).first<{ scheduled_time: string }>();
    const edited = await mcpTool<{
      success: boolean;
      scheduled_post: { id: number; text: string; scheduled_time_utc: string };
      linked_drafts_updated: number;
      linked_draft_id: string | null;
    }>("edit_scheduled_post", {
      brand_key: BRAND_KEY,
      scheduled_post_id: scheduled.scheduled_post_id,
      text: "A clean system makes every good idea easier to reuse.",
    });
    expect(edited.success).toBe(true);
    expect(edited.scheduled_post.text).toBe("A clean system makes every good idea easier to reuse.");
    expect(edited.scheduled_post.scheduled_time_utc).toBe(beforeEdit?.scheduled_time);
    expect(edited.linked_drafts_updated).toBe(1);
    expect(edited.linked_draft_id).toBe(draft.draft_id);

    const persistedScheduled = await env.DB.prepare(
      `SELECT post_text, scheduled_time FROM scheduled_posts WHERE id = ? LIMIT 1`,
    ).bind(scheduled.scheduled_post_id).first<{ post_text: string; scheduled_time: string }>();
    const persistedDraft = await env.DB.prepare(
      `SELECT text FROM gpt_generation_drafts WHERE id = ? LIMIT 1`,
    ).bind(draft.draft_id).first<{ text: string }>();
    const inventory = await env.DB.prepare(
      `SELECT text, source_id, status
       FROM operator_content_inventory
       WHERE brand_key = ? AND source_type = 'scheduled_post' AND source_id = ?
       ORDER BY datetime(created_at) DESC LIMIT 1`,
    ).bind(BRAND_KEY, String(scheduled.scheduled_post_id)).first<{ text: string; source_id: string; status: string }>();
    expect(persistedScheduled).toMatchObject({
      post_text: "A clean system makes every good idea easier to reuse.",
      scheduled_time: beforeEdit?.scheduled_time,
    });
    expect(persistedDraft?.text).toBe("A clean system makes every good idea easier to reuse.");
        expect(inventory).toMatchObject({
      text: "A clean system makes every good idea easier to reuse.",
      source_id: String(scheduled.scheduled_post_id),
      status: "scheduled",
    });

        const futureRetry = await mcpToolRaw<{ success?: boolean; error?: string; scheduled_time?: string }>("edit_scheduled_post", {
      brand_key: BRAND_KEY,
      scheduled_post_id: scheduled.scheduled_post_id,
      retry_now: true,
      proceed_confirmed: true,
    });
    expect(futureRetry.isError).toBe(true);
    expect(futureRetry.structuredContent.error).toBe("scheduled_post_not_due");

    await env.DB.prepare(
      `UPDATE scheduled_posts SET status = 'posted' WHERE id = ?`,
    ).bind(scheduled.scheduled_post_id).run();
        const blocked = await mcpToolRaw<{ success?: boolean; error?: string }>("edit_scheduled_post", {
      brand_key: BRAND_KEY,
      scheduled_post_id: scheduled.scheduled_post_id,
      text: "This edit must not persist.",
      proceed_confirmed: true,
    });
        expect(blocked.isError).toBe(true);
    expect(blocked.structuredContent.error).toBe("only_approved_scheduled_posts_can_be_edited");

        const publishedRetry = await mcpToolRaw<{ success?: boolean; error?: string }>("edit_scheduled_post", {
      brand_key: BRAND_KEY,
      scheduled_post_id: scheduled.scheduled_post_id,
      retry_now: true,
      proceed_confirmed: true,
    });
    expect(publishedRetry.isError).toBe(true);
    expect(publishedRetry.structuredContent.error).toBe("scheduled_post_already_published");
  }, 40000);

  it("hides scheduled posts from other account scopes when editing", async () => {
    await operatorTool("list_accounts");
    const inserted = await env.DB.prepare(
      `INSERT INTO scheduled_posts (
        user_id, threads_user_id, post_text, status, scheduled_time
      ) VALUES ('workspace-owner', 'manifest-mental', 'Other account post', 'approved', '2099-01-02T14:00:00.000Z')`,
    ).run();
    const response = await fetchFromWorker("/api/operator/tools/edit_scheduled_post", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        brand_key: BRAND_KEY,
        scheduled_post_id: Number(inserted.meta?.last_row_id ?? 0),
        text: "Cross-account edit must not persist.",
      }),
    });
    const payload = await response.json() as { error?: string };
    expect(response.status).toBe(404);
    expect(payload.error).toBe("scheduled_post_not_found");
    const stored = await env.DB.prepare(
      `SELECT post_text FROM scheduled_posts WHERE id = ? LIMIT 1`,
    ).bind(Number(inserted.meta?.last_row_id ?? 0)).first<{ post_text: string }>();
    expect(stored?.post_text).toBe("Other account post");
  }, 30000);

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

        const call = await mcpToolRaw<{ ok?: boolean; error?: string }>("mark_draft_shown", {
      brand_key: BRAND_KEY,
      draft_id: blocked.draft_id,
      proceed_confirmed: true,
    });
    expect(call.isError).toBe(true);
    expect(call.structuredContent.error).toBe("draft_not_showable");
  }, 40000);

  it.skip("retired: runtime MCP admin and schema mutation controls", async () => {
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
    expect(startDefinition.tool?.inputSchema?.properties?.continuity_loaded).toBeUndefined();

    const preflightDefinition = await mcpTool<{ tool?: { inputSchema?: { properties?: Record<string, unknown> } } }>("readMcpToolDefinition", {
      tool_name: "prepareFullPreflight",
    });
        expect(preflightDefinition.tool?.inputSchema?.properties?.objective).toBeUndefined();
    expect(preflightDefinition.tool?.inputSchema?.properties?.continuity_loaded).toBeUndefined();

    const patched = await mcpTool<{ tool?: { inputSchema?: { properties?: Record<string, unknown> } } }>("updateMcpToolSchema", {
      tool_name: "prepareFullPreflight",
      schema_patch: { properties: { operator_note: { type: "string" } } },
      reason: "vitest schema patch",
    });
    expect(patched.tool?.inputSchema?.properties?.operator_note).toBeTruthy();

        await mcpTool("disableMcpTool", {
      tool_name: "get_post_results",
      reason: "vitest hide",
      owner_response: "Approve disabling get_post_results for this isolated vitest fixture.",
    });
    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    expect(listed.tools.some((tool) => tool.name === "get_post_results")).toBe(false);
  }, 30000);

  it("blocks workflow stage advancement until the key handshake precheck completes", async () => {
    const session = await mcpTool<{ workflow_session_id: string }>("start_workflow_session", {
      brand_key: BRAND_KEY,
    });

        const blocked = await mcpToolRaw<{ ok?: boolean; error?: string; blockers?: Array<Record<string, unknown>> }>("advanceWorkflowStage", {
      brand_key: BRAND_KEY,
      workflow_session_id: session.workflow_session_id,
      target_stage: "context_admission",
      proceed_confirmed: true,
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

  it.skip("retired: persisted failure inspection and implementation backlog", async () => {
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

    it("auto-resolves canonical continuity after Proceed and exposes calendar state", async () => {
    const selected = await mcpToolRaw<{ selected_key: string }>("selectOperatorKey", { brand_key: "manifest_mental" });
    expect(selected.structuredContent.selected_key).toBe("manifest_mental");

    const proceeded = await mcpToolRaw<{
      proceeded: boolean;
      account_data_loaded: boolean;
      continuity_loaded: boolean;
      continuation_choice_required: boolean;
      continuity_capsule: {
        brand_key: string;
        calendar_coverage: { earliest_incomplete_date: string | null; open_slots: string[] };
        active_review_batch: unknown;
      };
    }>("confirmOperatorProceed", { brand_key: "manifest_mental" });

    expect(proceeded.isError).not.toBe(true);
    expect(proceeded.structuredContent.proceeded).toBe(true);
    expect(proceeded.structuredContent.account_data_loaded).toBe(true);
    expect(proceeded.structuredContent.continuity_loaded).toBe(true);
    expect(proceeded.structuredContent.continuation_choice_required).toBe(false);
    expect(proceeded.structuredContent.continuity_capsule.brand_key).toBe("manifest_mental");
    expect(Array.isArray(proceeded.structuredContent.continuity_capsule.calendar_coverage.open_slots)).toBe(true);

        const status = await mcpToolRaw<{ ok: boolean }>("getWorkflowStatus", {
      brand_key: "manifest_mental",
      proceed_confirmed: true,
    });
    expect(status.isError).not.toBe(true);
    expect(status.structuredContent.ok).toBe(true);
  }, 40000);

  it("persists four-item Manifest review batches and prevents same-day duplicate sources across chats", async () => {
    await seedManifestPatterns(30);
    const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", {
      brand_key: "manifest_mental",
    });
    const first = await operatorTool<{
      review_batch_id: string;
      production_date: string;
      items: Array<{ item_number: number; source_identity_key: string; source_type: string; internal_source_id: string }>;
    }>("claim_manifest_review_batch", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      production_date: "2099-01-02",
      timezone: "America/New_York",
      fresh_draw: true,
    });

    expect(first.items).toHaveLength(4);
    expect(first.items.map((item) => item.item_number)).toEqual([1, 2, 3, 4]);
    expect(new Set(first.items.map((item) => item.source_identity_key)).size).toBe(4);

        mcpSelectedKey = null;
    mcpProceedConfirmed = false;
    await ensureMcpAccountOpen("manifest_mental");
    const restored = await mcpTool<{
      review_batch_id: string;
      items: Array<{ item_number: number; source_identity_key: string }>;
    }>("get_manifest_review_batch", {
      brand_key: "manifest_mental",
      production_date: "2099-01-02",
    });
    expect(restored.review_batch_id).toBe(first.review_batch_id);
    expect(restored.items.map((item) => item.source_identity_key)).toEqual(first.items.map((item) => item.source_identity_key));

    for (const item of first.items) {
      await operatorTool("skip_manifest_review_source", {
        brand_key: "manifest_mental",
        review_batch_id: first.review_batch_id,
        item_number: item.item_number,
        scope: "current_day",
        reason: "Fixture moves to the next source set.",
      });
    }

    const second = await operatorTool<{
      review_batch_id: string;
      items: Array<{ item_number: number; source_identity_key: string; source_type: string; internal_source_id: string }>;
    }>("claim_manifest_review_batch", {
      brand_key: "manifest_mental",
      workflow_session_id: session.workflow_session_id,
      production_date: "2099-01-02",
      timezone: "America/New_York",
    });
    expect(second.items).toHaveLength(4);
    const firstIdentities = new Set(first.items.map((item) => item.source_identity_key));
    expect(second.items.every((item) => !firstIdentities.has(item.source_identity_key))).toBe(true);

    const deletedItem = second.items[0];
    expect(deletedItem.source_type).toBe("saved_pattern");
    await operatorTool("skip_manifest_review_source", {
      brand_key: "manifest_mental",
      review_batch_id: second.review_batch_id,
      item_number: deletedItem.item_number,
      scope: "delete_source",
      reason: "Delete this Saved Pattern as a future source while preserving its data.",
    });
    const preservedPattern = await env.DB.prepare(
      `SELECT id FROM external_patterns WHERE id = ? LIMIT 1`,
    ).bind(Number(deletedItem.internal_source_id)).first<{ id: number }>();
    const exclusion = await env.DB.prepare(
      `SELECT active FROM operator_source_exclusions
       WHERE brand_key = 'manifest_mental' AND source_identity_key = ? LIMIT 1`,
    ).bind(deletedItem.source_identity_key).first<{ active: number }>();
    expect(preservedPattern?.id).toBe(Number(deletedItem.internal_source_id));
    expect(Number(exclusion?.active ?? 0)).toBe(1);

    const claimCount = await env.DB.prepare(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT source_identity_key) AS unique_total
       FROM operator_daily_source_claims
       WHERE brand_key = 'manifest_mental' AND production_date = '2099-01-02'`,
    ).first<{ total: number; unique_total: number }>();
    expect(Number(claimCount?.total ?? 0)).toBe(Number(claimCount?.unique_total ?? 0));
  }, 60000);

  it.skip("retired: runtime MCP deployment snapshots", async () => {
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
      owner_response: "Approve rollback of this isolated vitest runtime snapshot.",
    });
    expect(rollback.restored.workflow_requirements).toBeGreaterThan(0);
  }, 30000);
});
