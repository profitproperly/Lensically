import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker, {
    ScheduledPostScheduler,
  activateNextApprovedScheduledPostCanary,
  buildOperatorMaturityObservation,
  buildOperatorPostFingerprint,
  evaluateThreadsPostMetricsForLearning,
  isSixHourInsightsRefreshWindow,
  OPERATOR_PERFORMANCE_MATURITY_CHECKPOINTS,
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

const MCP_DIRECT_ENTRY_TOOLS = new Set(["getOperatorStartupContext", "guardLensicallyCall", "routeAndExecuteLensicallyCall"]);

async function mcpToolRaw<T = Record<string, unknown>>(toolName: string, args: Record<string, unknown> = {}): Promise<{ structuredContent: T; isError?: boolean }> {
  if (MCP_DIRECT_ENTRY_TOOLS.has(toolName)) {
    return mcpToolCallRaw<T>(toolName, args);
  }
  return mcpToolCallRaw<T>("routeAndExecuteLensicallyCall", {
    intended_tool: toolName,
    arguments_json: JSON.stringify(args),
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
    const proceeded = await mcpToolRaw<{ proceeded: boolean; continuity_loaded: boolean; continuation_choice_required: boolean; continuity_capsule: { brand_key: string }; account_data_loaded: boolean }>("confirmOperatorProceed", { brand_key: brandKey });
    expect(proceeded.isError).not.toBe(true);
    expect(proceeded.structuredContent.proceeded).toBe(true);
    expect(proceeded.structuredContent.account_data_loaded).toBe(true);
    expect(proceeded.structuredContent.continuity_loaded).toBe(true);
    expect(proceeded.structuredContent.continuation_choice_required).toBe(false);
    expect(proceeded.structuredContent.continuity_capsule.brand_key).toBe(brandKey);
        mcpProceedConfirmed = true;
  }
}


async function mcpTool<T = Record<string, unknown>>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
  const requestedBrand = testRequestedBrandKey(toolName, args);
  let callArgs = args;
  if (requestedBrand && toolName !== "selectOperatorKey" && toolName !== "confirmOperatorProceed" && toolName !== "resolveContinuationContext") {
    await ensureMcpAccountOpen(requestedBrand);
                        callArgs = { ...args, proceed_confirmed: true };
  }
  let result = await mcpToolRaw<Record<string, unknown>>(toolName, callArgs);
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
  expect(result.isError, `${toolName} returned MCP isError`).not.toBe(true);
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
    "operator_decision_execution_events",
    "operator_decision_proposals",
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

    it("auto-arms the scheduled-post alarm only on the configured canonical Worker host", () => {
    const workerOrigin = (env as unknown as { WORKER_ORIGIN: string }).WORKER_ORIGIN;
    expect(workerOrigin).toBeTruthy();
    expect(shouldAutoArmScheduledPostAlarm(new Request("https://example.com/api/operator/health"), env)).toBe(false);
    expect(shouldAutoArmScheduledPostAlarm(new Request(`${workerOrigin}/api/operator/health`), env)).toBe(true);
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

    it("arms, executes, and re-arms the independent scheduled-post alarm with shared cron health", async () => {

    const values = new Map<string, unknown>();
    let alarmAt: number | null = null;
    const state = {
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

        const pausedHealth = await (await scheduler.fetch(new Request("https://scheduled-post-scheduler.internal/health"))).json() as {
      control: { mode: string; allowed_post_ids: number[]; max_posts: number };
    };
    expect(pausedHealth.control).toMatchObject({ mode: "paused", allowed_post_ids: [], max_posts: 0 });

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

    const namespace = (env as unknown as { SCHEDULED_POST_SCHEDULER: DurableObjectNamespace }).SCHEDULED_POST_SCHEDULER;
    const stub = namespace.get(namespace.idFromName("scheduled-post-publisher"));
    const health = await (await stub.fetch("https://scheduled-post-scheduler.internal/health")).json() as {
      control: { mode: string; allowed_post_ids: number[] };
    };
    expect(health.control).toMatchObject({ mode: "canary", allowed_post_ids: [scheduledPostId] });
    await stub.fetch("https://scheduled-post-scheduler.internal/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "paused", reason: "reset automatic canary fixture" }),
    });
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
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "getOperatorStartupContext",
      "routeAndExecuteLensicallyCall",
    ]);
    const registry = await mcpTool<{ tools: Array<{ name: string; inputSchema?: Record<string, unknown> }> }>("listMcpTools");
    const toolNames = registry.tools.map((tool) => tool.name);
        expect(new Set(toolNames).size).toBe(toolNames.length);
        expect(registry.tools.slice(0, 75).map((tool) => tool.name)).toEqual(expect.arrayContaining([
      "setScheduledPostSchedulerMode",
      "runApprovedPostCanary",
    ]));
    expect(() => JSON.stringify(registry.tools)).not.toThrow();
    expect(toolNames.some((name) => /^(mm|om|vx)_/.test(name))).toBe(false);
    expect(initialized.instructions).toContain("Initial key-selection stop");
    expect(initialized.instructions).toContain("Selected key: <selected_key>");
    expect(initialized.instructions).toContain(`Full tool surface loaded: ${toolNames.length} tools available and usable.`);
                    expect(initialized.instructions).toContain("Only after the user explicitly approves proceeding, call confirmOperatorProceed.");
    expect(initialized.instructions).toContain("automatically restores canonical persisted schedule");
    expect(initialized.instructions).toContain("Never ask resume or start fresh");
        expect(initialized.instructions).toContain("verifies continuity from server-side state");
                                expect(initialized.instructions).toContain("Routed execution gateway is mandatory");
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

        const patchSetTool = registry.tools.find((tool) => tool.name === "applyRepoPatchSet") as unknown as { inputSchema: { properties: { patches: { maxItems: number } } } };
    const releaseTool = registry.tools.find((tool) => tool.name === "runEngineeringRelease") as unknown as { inputSchema: { properties: { force: { type: string } } } };
    const releaseStatusTool = registry.tools.find((tool) => tool.name === "getEngineeringRelease") as unknown as { inputSchema: { properties: { wait_seconds: { maximum: number } } } };
    expect(patchSetTool.inputSchema.properties.patches.maxItems).toBe(20);
    expect(releaseTool.inputSchema.properties.force.type).toBe("boolean");
    expect(releaseStatusTool.inputSchema.properties.wait_seconds.maximum).toBe(55);

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
    expect(listed.tools.map((tool) => tool.name)).toEqual(["getOperatorStartupContext", "routeAndExecuteLensicallyCall"]);
    const registry = await mcpTool<{ tools: Array<{ name: string }> }>("listMcpTools");
    expect(registry.tools.map((tool) => tool.name)).toContain("runtime_count_fixture");
    const initialized = await mcpRequest<{ instructions: string }>("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    expect(initialized.instructions).toContain(`Full tool surface loaded: ${registry.tools.length} tools available and usable.`);
    const selected = await mcpToolRaw<{ tool_count: number; handshake: string[] }>("selectOperatorKey", { brand_key: "manifest_mental" });
    expect(selected.isError).not.toBe(true);
    expect(selected.structuredContent.tool_count).toBe(registry.tools.length);
    expect(selected.structuredContent.handshake[2]).toBe(`Full tool surface loaded: ${registry.tools.length} tools available and usable.`);
  }, 30000);

  it("loads compact non-account startup bootstrap in a fresh session", async () => {

        const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    expect(listed.tools.map((tool) => tool.name)).toEqual(["getOperatorStartupContext", "routeAndExecuteLensicallyCall"]);
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
                expect(direct.engineering_authority_contract.known_path_rule).toContain("the model can call only routeAndExecuteLensicallyCall for operational work");
    expect(direct.engineering_authority_contract.recursive_improvement_rule).toContain("stop the active engineering sequence");
    expect(direct.engineering_authority_contract.protected_operations).toEqual(expect.arrayContaining(["deleteRepoFile", "rollbackMcpChanges", "disableMcpTool", "setScheduledPostSchedulerMode"]));
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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                expect(direct.runtime.mcp_version).toBe("1.22.0");
    expect(direct.source_documents.map((doc) => doc.path)).toEqual(["AGENTS.md", "CURRENT_STATE.md", "OPERATING_MEMORY.md"]);
    expect(direct.source_documents.every((doc) => doc.excerpt.length <= 6000)).toBe(true);
        expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("guardLensicallyCall before every Lensically tool");
        expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("Do not create owner proposals or numerical tool budgets");
        expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("Call account tools directly with compact typed schemas");
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("exact file prefix");
    expect(direct.mandatory_fallback_execution_routes.join(" ")).toContain("stop, promote the fix");
    expect(direct.boundary.before_proceed_forbidden).toEqual(expect.arrayContaining(["account_state", "workflow_status", "source_cards", "drafts", "scheduled_posts", "account_gates", "strategy_memory", "account_metrics"]));
        expect(direct.boundary.after_explicit_proceed).toContain("automatically restores canonical persisted schedule");
    expect(direct.boundary.after_explicit_proceed).toContain("Never ask resume or start fresh");
        expect(direct.boundary.after_explicit_proceed).toContain("server-side state");
    expect(direct.boundary.after_explicit_proceed).toContain("Conversation memory is not accepted");
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

  it("uses a strict schema-validated allowlist when the current chat cached a capped account surface", async () => {
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
    expect(proceeded.structuredContent.next_call_requirement).toMatchObject({ brand_key: "vectrix", proceed_confirmed: true });
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

  it("classifies universal hardening separately from account creative changes", async () => {
    const universal = await mcpTool<{ policy: { execution_plane: string; scope_classification: { scope: string }; hard_bounds: Record<string, unknown>; forbidden_routes: string[] } }>("planOperatorExecution", {
      intended_tool: "searchRepoFiles",
      operation: "Prevent repository search limits and 502 retries across every fresh chat.",
    });
    expect(universal.policy.execution_plane).toBe("engineering_control");
    expect(universal.policy.scope_classification.scope).toBe("universal");
    expect(universal.policy.hard_bounds).toMatchObject({ external_requests_max: 2, file_content_fanout_max: 0, result_limit_max: 20 });
    expect(universal.policy.forbidden_routes.join(" ")).toContain("recursive tree plus per-file content reads");

    const accountScoped = await mcpTool<{ policy: { scope_classification: { scope: string } } }>("planOperatorExecution", {
      intended_tool: "create_source_card",
      operation: "Change Manifest brand voice and source interpretation for one content lane.",
    });
    expect(accountScoped.policy.scope_classification.scope).toBe("account_scoped");
  }, 30000);

        it("requires the routed gateway and never repairs a direct operational attempt", async () => {
    const unguarded = await mcpToolCallRaw<{
      error: string;
      required_tool: string;
    }>("getEngineeringAccessState", {});
    expect(unguarded.isError).toBe(true);
    expect(unguarded.structuredContent).toMatchObject({
      error: "routed_execution_gateway_required",
      required_tool: "routeAndExecuteLensicallyCall",
    });

        const invalid = await mcpToolCallRaw<{ error: string; validation_errors: Array<{ path: string; error: string }> }>("routeAndExecuteLensicallyCall", {
      intended_tool: "readRepoFile",
      arguments_json: JSON.stringify({ path: "CURRENT_STATE.md", unexpected: true }),
    });
    expect(invalid.isError).toBe(true);
    expect(invalid.structuredContent.error).toBe("routed_gateway_payload_invalid");
    expect(invalid.structuredContent.validation_errors).toContainEqual({
      path: "$.unexpected",
      error: "additional_property_forbidden",
    });

    const guarded = await mcpToolCallRaw<{
      ok: boolean;
      execution_guard: string;
      normalized_arguments: Record<string, unknown>;
      corrections: Array<{ path: string; from: unknown; to: unknown; reason: string }>;
    }>("guardLensicallyCall", {
      intended_tool: "readRepoFile",
      arguments_json: JSON.stringify({ path: "CURRENT_STATE.md", max_lines: 410 }),
    });
    expect(guarded.isError).not.toBe(true);
    expect(guarded.structuredContent.ok).toBe(true);
    expect(guarded.structuredContent.normalized_arguments).toMatchObject({ path: "CURRENT_STATE.md", max_lines: 400 });
    expect(guarded.structuredContent.corrections).toContainEqual({
      path: "$.max_lines",
      from: 410,
      to: 400,
      reason: "maximum_enforced",
    });

        expect(typeof guarded.structuredContent.execution_guard).toBe("string");

    const localGuard = await mcpToolCallRaw<{
      ok: boolean;
      execution_guard: string;
      normalized_arguments: Record<string, unknown>;
    }>("guardLensicallyCall", {
      intended_tool: "getEngineeringAccessState",
      arguments_json: "{}",
    });
    expect(localGuard.isError).not.toBe(true);
    expect(localGuard.structuredContent.ok).toBe(true);
        const directWithGuard = await mcpToolCallRaw<{ error: string; required_tool: string }>("getEngineeringAccessState", {
      ...localGuard.structuredContent.normalized_arguments,
      execution_guard: localGuard.structuredContent.execution_guard,
    });
    expect(directWithGuard.isError).toBe(true);
    expect(directWithGuard.structuredContent).toMatchObject({
      error: "routed_execution_gateway_required",
      required_tool: "routeAndExecuteLensicallyCall",
    });

    const access = await mcpToolRaw<{
      ok: boolean;
      github: { token_status: string };
      routed_execution: { requested_tool: string; executed_tool: string };
      execution_guard_enforcement: { mode: string; direct_operational_calls_allowed: boolean };
    }>("getEngineeringAccessState", {});
    expect(access.isError).not.toBe(true);
    expect(access.structuredContent.ok).toBe(true);
    expect(access.structuredContent.github.token_status).toMatch(/exists|missing/);
    expect(access.structuredContent.routed_execution).toMatchObject({
      requested_tool: "getEngineeringAccessState",
      executed_tool: "getEngineeringAccessState",
    });
    expect(access.structuredContent.execution_guard_enforcement).toMatchObject({
      mode: "mandatory_routed_gateway",
      direct_operational_calls_allowed: false,
    });


    const sensitive = await mcpToolCallRaw<{ error: string; required_route: string }>("guardLensicallyCall", {
      intended_tool: "searchRepoFiles",
      arguments_json: JSON.stringify({ query: "x-openai-subject", prefix: "lensically-worker/src/index.ts", limit: 20 }),
    });
        expect(sensitive.isError).toBe(true);
    expect(sensitive.structuredContent.error).toBe("known_blocker_prevented");
    expect(sensitive.structuredContent.required_route).toContain("neutral function-name search");

    const releaseBridge = await mcpToolCallRaw<{ error: string; required_route: string; blocker_key: string }>("guardLensicallyCall", {
      intended_tool: "runEngineeringTool",
      arguments_json: JSON.stringify({
        tool_name: "runEngineeringRelease",
        arguments: { ref: "abc123" },
      }),
    });
    expect(releaseBridge.isError).toBe(true);
    expect(releaseBridge.structuredContent).toMatchObject({
      error: "known_blocker_prevented",
      blocker_key: "release_bridge_client_preflight",
    });
    expect(releaseBridge.structuredContent.required_route).toContain("runEngineeringRelease directly");

        const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list", {});
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "getOperatorStartupContext",
      "routeAndExecuteLensicallyCall",
    ]);
  }, 30000);

        it("forces verified pre-call routes before operational intent reaches a handler", async () => {
        const rawArgs = { limit: 50 };
        const staleGuard = await mcpToolCallRaw<{
      ok: boolean;
      execution_guard: string;
      normalized_arguments: Record<string, unknown>;
    }>("guardLensicallyCall", {
      intended_tool: "listOpsMemory",
      arguments_json: JSON.stringify(rawArgs),
    });
    expect(staleGuard.isError).not.toBe(true);
    expect(staleGuard.structuredContent.normalized_arguments).toMatchObject(rawArgs);

        const routeKey = "vitest_list_ops_memory_compact_route";
    const recorded = await mcpToolRaw<{
      ok: boolean;
      version: string;
      route: { route_key: string; source: string };
    }>("recordPreCallRoute", {
      route_key: routeKey,
            provider: "lensically",
      tool_name: "listOpsMemory",
      operation_key: "*",
      match: { limit: 50 },
      action: "apply",
      mandatory_route: "Use the verified compact result limit.",
      argument_patch: { limit: 1 },
      allowed_argument_keys: ["limit"],
      reason: "Avoid oversized memory listings.",
      verification_summary: "Vitest verifies guard and dispatcher enforcement.",
      priority: 900,
    });
    expect(recorded.isError).not.toBe(true);
    expect(recorded.structuredContent).toMatchObject({
      ok: true,
      version: "operator-pre-call-routing-v1",
      route: { route_key: routeKey, source: "persistent_phonebook" },
    });

                const staleExecution = await mcpToolCallRaw<{
      error: string;
      required_tool: string;
    }>("listOpsMemory", {
      ...rawArgs,
      execution_guard: staleGuard.structuredContent.execution_guard,
    });
    expect(staleExecution.isError).toBe(true);
        expect(staleExecution.structuredContent).toMatchObject({
      error: "routed_execution_gateway_required",
      required_tool: "routeAndExecuteLensicallyCall",
    });

    const routedExecution = await mcpToolRaw<{
      ok: boolean;
      items: Array<unknown>;
      execution_policy: { pre_call_route: { route_key: string } };
      routed_execution: { executed_tool: string; route_trail: Array<{ route_key: string }> };
    }>("listOpsMemory", rawArgs);
    expect(routedExecution.isError, JSON.stringify(routedExecution.structuredContent)).not.toBe(true);
    expect(routedExecution.structuredContent.items.length).toBeLessThanOrEqual(1);
    expect(routedExecution.structuredContent.execution_policy.pre_call_route.route_key).toBe(routeKey);
    expect(routedExecution.structuredContent.routed_execution.executed_tool).toBe("listOpsMemory");
    expect(routedExecution.structuredContent.routed_execution.route_trail).toContainEqual(expect.objectContaining({ route_key: routeKey }));

        const routedGuard = await mcpToolCallRaw<{
      ok: boolean;
      normalized_arguments: Record<string, unknown>;
      corrections: Array<{ path: string; reason: string }>;
      pre_call_route: { route_key: string };
    }>("guardLensicallyCall", {
      intended_tool: "listOpsMemory",
      arguments_json: JSON.stringify(rawArgs),
    });
    expect(routedGuard.isError).not.toBe(true);
    expect(routedGuard.structuredContent.normalized_arguments).toEqual({ limit: 1 });
    expect(routedGuard.structuredContent.corrections).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "$.limit", reason: "pre_call_route_patch" }),
    ]));
    expect(routedGuard.structuredContent.pre_call_route.route_key).toBe(routeKey);

    const listed = await mcpToolRaw<{
      version: string;
      routes: Array<{ route_key: string; source: string }>;
        }>("listPreCallRoutes", { provider: "lensically", tool_name: "listOpsMemory" });
    expect(listed.isError).not.toBe(true);
    expect(listed.structuredContent.version).toBe("operator-pre-call-routing-v1");
    expect(listed.structuredContent.routes).toContainEqual(expect.objectContaining({
      route_key: routeKey,
      source: "persistent_phonebook",
    }));

    const redirectKey = "vitest_access_state_redirect";
    await mcpToolRaw("recordPreCallRoute", {
      route_key: redirectKey,
      provider: "lensically",
      tool_name: "getEngineeringAccessState",
      operation_key: "*",
      action: "redirect",
      required_tool: "getOperatorStartupContext",
      mandatory_route: "Load startup context first.",
      reason: "Verified test redirect.",
      verification_summary: "Vitest verifies redirect before execution.",
      priority: 950,
    });
    const redirected = await mcpToolCallRaw<{
      error: string;
      required_tool: string;
      pre_call_route: { route_key: string };
    }>("guardLensicallyCall", {
      intended_tool: "getEngineeringAccessState",
      arguments_json: "{}",
    });
    expect(redirected.isError).toBe(true);
        expect(redirected.structuredContent).toMatchObject({
      error: "pre_call_route_required",
      required_tool: "getOperatorStartupContext",
      pre_call_route: { route_key: redirectKey },
    });

    const followedRedirect = await mcpToolRaw<{
      routed_execution: { executed_tool: string; route_trail: Array<{ route_key: string }> };
    }>("getEngineeringAccessState", {});
    expect(followedRedirect.isError).not.toBe(true);
    expect(followedRedirect.structuredContent.routed_execution.executed_tool).toBe("getOperatorStartupContext");
    expect(followedRedirect.structuredContent.routed_execution.route_trail).toContainEqual(expect.objectContaining({ route_key: redirectKey }));

    for (const route of [
      {
                route_key: routeKey, provider: "lensically", tool_name: "listOpsMemory", operation_key: "*",
        match: { limit: 50 }, action: "apply", mandatory_route: "Use the verified compact result limit.",
        argument_patch: { limit: 1 }, allowed_argument_keys: ["limit"],
        reason: "Test cleanup.", verification_summary: "Previously verified.", active: false,
      },
      {
        route_key: redirectKey, provider: "lensically", tool_name: "getEngineeringAccessState", operation_key: "*",
        action: "redirect", required_tool: "getOperatorStartupContext", mandatory_route: "Load startup context first.",
        reason: "Test cleanup.", verification_summary: "Previously verified.", active: false,
      },
    ]) {
      const disabled = await mcpToolRaw<{ ok: boolean }>("recordPreCallRoute", route);
      expect(disabled.isError).not.toBe(true);
      expect(disabled.structuredContent.ok).toBe(true);
    }
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
      next_pending_action: "confirm_fill_calendar_day",
      canonical_next_tool: "get_hourly_coverage",
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
    expect(capsule.continuity_mode).toBe("bounded_manifest_proceed");
    expect(capsule.workflow_checkpoint.workflow_session_id).toBe(session.workflow_session_id);
    expect(capsule.workflow_checkpoint.next_pending_action).toBe("resume_review_batch");
    expect(capsule.workflow_checkpoint.canonical_next_tool).toBe("get_manifest_review_batch");
    expect(capsule.active_review_batch.review_batch_id).toBe(batch.review_batch_id);
    expect(capsule.active_review_batch.items.map((item) => item.source_identity_key)).toEqual(batch.items.map((item) => item.source_identity_key));
    const sourceBatchCount = await env.DB.prepare(`SELECT COUNT(*) AS total FROM operator_source_selection_batches WHERE workflow_session_id = ?`).bind(session.workflow_session_id).first<{ total: number }>();
        expect(Number(sourceBatchCount?.total ?? 0)).toBe(1);
  }, 40000);

  it("restores unresolved delivery incidents before Manifest review work and closes them only after verified publication", async () => {
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
      next_pending_action: "resolve_delivery_incident",
      canonical_next_tool: "list_scheduled_posts",
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
    expect(resumed.structuredContent.continuity_capsule.new_scheduling_blocked).toBe(false);
    expect(resumed.structuredContent.continuity_capsule.workflow_checkpoint).toMatchObject({
      next_pending_action: "resume_review_batch",
      canonical_next_tool: "get_manifest_review_batch",
    });
    const incident = await env.DB.prepare(
      `SELECT status, resolution_note FROM operator_operational_incidents WHERE scheduled_post_id = ? LIMIT 1`,
    ).bind(scheduledPostId).first<{ status: string; resolution_note: string | null }>();
    expect(incident).toMatchObject({
      status: "resolved",
      resolution_note: "verified_scheduled_post_published",
    });
  }, 50000);

    it("blocks same-build wrapper hopping but clears stale failures after deployment", async () => {
    const mutableEnv = env as unknown as Record<string, unknown>;
    const originalCommitSha = mutableEnv.LENSICALLY_COMMIT_SHA;
    try {
      mutableEnv.LENSICALLY_COMMIT_SHA = "vitest-deployment-a";
      const direct = await mcpToolRaw<{ error: string }>("readRepoFile", { path: "missing-vitest-file.md" });
      expect(direct.isError).toBe(true);
      expect(direct.structuredContent.error).toBe("repo_file_read_failed");
      const alias = await mcpToolRaw<{ error: string; prior_failed_route: string }>("runEngineeringTool", {
        tool_name: "readRepoFile",
        arguments: { path: "missing-vitest-file.md" },
      });
      expect(alias.isError).toBe(true);
      expect(alias.structuredContent.error).toBe("same_backend_route_retry_forbidden");
      expect(alias.structuredContent.prior_failed_route).toBe("readRepoFile");

      mutableEnv.LENSICALLY_COMMIT_SHA = "vitest-deployment-b";
      const afterDeployment = await mcpToolRaw<{ ok: boolean; result: { error: string } }>("runEngineeringTool", {
        tool_name: "readRepoFile",
        arguments: { path: "missing-vitest-file.md" },
      });
      expect(afterDeployment.isError).toBe(true);
      expect(afterDeployment.structuredContent.result.error).toBe("repo_file_read_failed");
    } finally {
      mutableEnv.LENSICALLY_COMMIT_SHA = originalCommitSha;
    }
  }, 30000);

  it("authorizes routine engineering without owner decisions or numerical budgets and resolves known paths before execution", async () => {
    const planned = await mcpTool<{
      policy: {
        version: string;
        known_path: { rule_key: string; mandatory_route: string };
        mandatory_path_applied: boolean;
        numerical_tool_budget_applies: boolean;
      };
    }>("planOperatorExecution", {
      intended_tool: "resolveOperatorDecision",
      operation: "Resolve an owner-ratified account decision through the compact canonical path.",
    });
    expect(planned.policy).toMatchObject({
      version: "operator-execution-policy-v2",
      mandatory_path_applied: true,
      numerical_tool_budget_applies: false,
      known_path: {
        rule_key: "compact_governance_payload",
      },
    });

    const engineering = await mcpToolRaw<{
      ok: boolean;
      memory_id: string;
      engineering_authority: {
        mode: string;
        version: string;
        owner_ratification_required: boolean;
        numerical_tool_budget_applies: boolean;
      };
      execution_policy: {
        authorization_mode: string;
        mandatory_path_applied: boolean;
      };
    }>("recordOpsMemory", {
      title: "Autonomous engineering fixture",
      fix: "Routine engineering executes through persistent outcome-bound authority.",
      applies_when: "Any repository, test, deploy, routing, or infrastructure repair operation.",
      tags: ["engineering", "recursive-improvement"],
    });
    expect(engineering.isError).not.toBe(true);
    expect(engineering.structuredContent.ok).toBe(true);
    expect(engineering.structuredContent.engineering_authority).toMatchObject({
      mode: "full_discretion_recursive",
      version: "operator-engineering-authority-v1",
      owner_ratification_required: false,
      numerical_tool_budget_applies: false,
    });
    expect(engineering.structuredContent.execution_policy).toMatchObject({
      authorization_mode: "persistent_outcome_bound_engineering",
      mandatory_path_applied: true,
    });

    const decisionEvents = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM operator_decision_execution_events WHERE tool_name = 'recordOpsMemory'`,
    ).first<{ total: number }>();
    expect(Number(decisionEvents?.total ?? 0)).toBe(0);
  }, 30000);

      it("runs routine Manifest mutations autonomously while preserving protected operations", async () => {
    await ensureMcpAccountOpen("manifest_mental");

    const first = await mcpToolRaw<{
      ok: boolean;
      account_authority: { mode: string; owner_ratification_required: boolean; protected_operations_owner_ratified: boolean };
    }>("save_strategy_memory", {
      brand_key: "manifest_mental",
      kind: "current_belief",
            body: "First autonomous Manifest mutation fixture.",
      proceed_confirmed: true,
    });
    expect(first.isError).not.toBe(true);
    expect(first.structuredContent.ok).toBe(true);
    expect(first.structuredContent.account_authority).toMatchObject({
      mode: "autonomous_operator",
      owner_ratification_required: false,
      protected_operations_owner_ratified: true,
    });

    const second = await mcpToolRaw<{ ok: boolean }>("save_strategy_memory", {
      brand_key: "manifest_mental",
      kind: "current_belief",
            body: "Second autonomous Manifest mutation fixture.",
      proceed_confirmed: true,
    });
    expect(second.isError).not.toBe(true);
    expect(second.structuredContent.ok).toBe(true);

        const protectedAttempt = await mcpToolCallRaw<{
      error: string;
      required_tool: string;
      pre_call_route: { route_key: string };
    }>("guardLensicallyCall", {
      intended_tool: "deleteRepoFile",
      arguments_json: JSON.stringify({
        path: "AUTONOMY_PROTECTED_FIXTURE.md",
        message: "Protected-operation regression fixture.",
        owner_approval: "No specific protected-operation approval supplied.",
      }),
    });
    expect(protectedAttempt.isError).toBe(true);
    expect(protectedAttempt.structuredContent).toMatchObject({
      error: "known_blocker_prevented",
      required_tool: "deleteRepoFile",
      pre_call_route: { route_key: "explicit_owner_ratification_handoff" },
    });

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
    expect(state.profile.mode).toBe("autonomous_operator");
    expect(state.profile.objective).toContain("1,000,000 followers");
    expect(state.profile.operating_constraints).toMatchObject({
      owner_ratification_required: false,
      routine_account_operations_autonomous: true,
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
      };
    }>("confirmOperatorProceed", { brand_key: "manifest_mental" });
    expect(reconfirmed.isError).not.toBe(true);
    expect(reconfirmed.structuredContent.continuity_capsule.autonomy_governance.profile.mode).toBe("autonomous_operator");
    expect(reconfirmed.structuredContent.continuity_capsule.autonomy_governance.profile.objective).toContain("1,000,000 followers");
    }, 40000);

  it("persists explicit owner ratification before the first protected scheduler call", async () => {
    await ensureMcpAccountOpen("manifest_mental");
    const canary = await mcpToolRaw<{
      ok: boolean;
      result: { scheduler: { control: { mode: string; allowed_post_ids: number[] } } };
      autonomy_decision: { governed: boolean; decision_id: string };
        }>("listMcpTools", {
      execute_tool: "runApprovedPostCanary",
      arguments: {
        brand_key: "manifest_mental",
        scheduled_post_id: 987654,
        reason: "Protected-operation owner-ratification regression fixture.",
        owner_response: "Proceed",
      },
    });
    expect(canary.isError).not.toBe(true);
    expect(canary.structuredContent.ok).toBe(true);
    expect(canary.structuredContent.result.scheduler.control).toMatchObject({
      mode: "canary",
      allowed_post_ids: [987654],
    });
    expect(canary.structuredContent.autonomy_decision).toMatchObject({ governed: true });
    const decision = await env.DB.prepare(
      `SELECT status, owner_response FROM operator_decision_proposals WHERE id = ? LIMIT 1`,
    ).bind(canary.structuredContent.autonomy_decision.decision_id).first<{ status: string; owner_response: string }>();
    expect(decision).toEqual({ status: "executed", owner_response: "Proceed" });

    const paused = await mcpToolRaw<{ ok: boolean; result: { scheduler: { control: { mode: string } } } }>("listMcpTools", {
      execute_tool: "setScheduledPostSchedulerMode",
      arguments: {
        brand_key: "manifest_mental",
        mode: "paused",
        reason: "Return regression fixture scheduler to safe state.",
        owner_response: "Proceed",
      },
    });
    expect(paused.isError).not.toBe(true);
    expect(paused.structuredContent.result.scheduler.control.mode).toBe("paused");
  }, 30000);

    it("returns a compact tool inventory without recursive payloads", async () => {
    const listed = await mcpTool<{ tools: Array<{ name: string; required_fields: string[]; disabled: boolean }> }>("listMcpTools", {
      include_disabled: true,
    });
    expect(listed.tools.length).toBeGreaterThan(0);
    expect(new Set(listed.tools.map((tool) => tool.name)).size).toBe(listed.tools.length);
    expect(listed.tools.every((tool) => Array.isArray(tool.required_fields))).toBe(true);
    expect(JSON.stringify(listed)).not.toContain("inputSchema");
  });

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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                expect(initialized.serverInfo.version).toBe("1.21.0");
    expect(listed.tools.map((tool) => tool.name)).toEqual(expect.arrayContaining([
      "getOperatorStartupContext",
      "guardLensicallyCall",
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

    it("rejects generic account bridges and uses compact direct account tools", async () => {
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
                expect(payload.mcp_version).toBe("1.22.0");
    expect(payload.registry_generation).toBe("recursive-engineering-execution-v1");
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

        const listedTools = await mcpRequest<{ tools: Array<{ name: string; inputSchema?: { properties?: Record<string, unknown> } }> }>("tools/list");
    const editScheduledDefinition = listedTools.tools.find((tool) => tool.name === "edit_scheduled_post");
    expect(editScheduledDefinition).toBeTruthy();
    expect(editScheduledDefinition?.inputSchema?.properties?.retry_now).toBeTruthy();
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
      owner_response: "Approve rollback of this isolated vitest runtime snapshot.",
    });
    expect(rollback.restored.workflow_requirements).toBeGreaterThan(0);
  }, 30000);
});
