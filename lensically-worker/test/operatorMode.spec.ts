import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src";

const AUTH_HEADERS = {
  Authorization: "Bearer test-gpt-key",
  "Content-Type": "application/json",
};
const BRAND_KEY = "vectrix";

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

async function mcpTool<T = Record<string, unknown>>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await mcpRequest<{ structuredContent: T; isError?: boolean }>("tools/call", {
    name: toolName,
    arguments: args,
  });
  expect(result.isError, `${toolName} returned MCP isError`).not.toBe(true);
  return result.structuredContent;
}

async function resetTables(): Promise<void> {
  (env as unknown as { LENSICALLY_GPT_API_KEY: string }).LENSICALLY_GPT_API_KEY = "test-gpt-key";
  for (const table of [
    "operator_gate_results",
    "operator_content_inventory",
    "operator_gates",
    "operator_source_cards",
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

async function createLockedSourceCard(forbiddenSurfaces: string[] = []): Promise<{ sessionId: string; sourceCardId: string; runId: string }> {
  const session = await operatorTool<{ workflow_session_id: string }>("start_workflow_session", {
    brand_key: BRAND_KEY,
    objective: "operator mode test",
  });
  await operatorTool("admit_context", {
    brand_key: BRAND_KEY,
    workflow_session_id: session.workflow_session_id,
    admission_scope: "source_card_selection",
    sections: [{ section: "archive_top", returned_count: 1, total_count: 1, limit: 1, offset: 0, source: "existing_db" }],
  });
  const card = await operatorTool<{ source_card_id: string }>("create_source_card", {
    brand_key: BRAND_KEY,
    workflow_session_id: session.workflow_session_id,
    sequence_label: "source_card_test_001",
    lane_key: "systems",
    title: "Systems source card",
    primary_source: { source_type: "archive_post", source_id: "archive-1", text: "A system makes the work easier." },
    secondary_sources: [],
    anti_sources: [],
    metrics_snapshot: { views: 100, likes: 10 },
    source_mechanism: "Turn operational complexity into a clean system advantage.",
    required_product: "A clear operator benefit that feels concrete.",
    forbidden_surfaces: forbiddenSurfaces,
    danger_surfaces: [],
    current_inventory_constraints: [],
    pass_conditions: ["Specific operational payoff."],
    fail_conditions: ["Generic motivation."],
    recommended_direction: "Write one concise systems post.",
  });
  await operatorTool("lock_source_card", { brand_key: BRAND_KEY, source_card_id: card.source_card_id });
  const run = await operatorTool<{ run_id: string }>("create_generation_run", {
    brand_key: BRAND_KEY,
    source_card_id: card.source_card_id,
    objective: "Generate one candidate",
    prompt_summary: "Use the locked source card.",
  });
  return { sessionId: session.workflow_session_id, sourceCardId: card.source_card_id, runId: run.run_id };
}

describe("operator mode backend spine", () => {
  beforeEach(async () => {
    await resetTables();
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

  it("lists required MCP tools and Lensically accounts", async () => {
    const initialized = await mcpRequest<{ serverInfo: { name: string }; capabilities: Record<string, unknown> }>("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "1.0.0" },
    });
    expect(initialized.serverInfo.name).toBe("lensically-operator-mode");

    const listed = await mcpRequest<{ tools: Array<{ name: string }> }>("tools/list");
    const toolNames = listed.tools.map((tool) => tool.name);
    for (const name of [
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
    ]) {
      expect(toolNames).toContain(name);
    }

    const accounts = await mcpTool<{ accounts: Array<{ brand_key: string }> }>("list_accounts");
    expect(accounts.accounts.map((account) => account.brand_key)).toEqual(expect.arrayContaining(["manifest_mental", "opmg_deadman", "vectrix"]));
  }, 30000);

  it("runs the MCP happy path from session through scheduling", async () => {
    const session = await mcpTool<{ workflow_session_id: string }>("start_workflow_session", {
      brand_key: BRAND_KEY,
      objective: "mcp happy path",
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
      arguments: { brand_key: BRAND_KEY, draft_id: blocked.draft_id },
    });
    expect(call.isError).toBe(true);
    expect(call.structuredContent.error).toBe("draft_not_showable");
  }, 40000);

  it("keeps MCP-created account-specific gates scoped", async () => {
    await mcpTool("create_or_update_gate", {
      brand_key: BRAND_KEY,
      gate_key: "mcp_vectrix_fixture_gate",
      display_name: "MCP Vectrix Fixture Gate",
      description: "Vectrix-only fixture gate for MCP scoping.",
      stage_scope: "gate_evaluation",
      lane_scope: "money",
      gate_type: "hybrid",
      severity: "block",
      evaluator: "hybrid",
    });
    const vectrix = await mcpTool<{ gates: Array<{ gate_key: string }> }>("list_active_gates", {
      brand_key: BRAND_KEY,
      stage_scope: "gate_evaluation",
      lane_key: "money",
    });
    expect(vectrix.gates.some((gate) => gate.gate_key === "mcp_vectrix_fixture_gate")).toBe(true);

    const manifestResponse = await fetchFromWorker("/api/operator/mcp", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 99,
        method: "tools/call",
        params: {
          name: "list_active_gates",
          arguments: { brand_key: "manifest_mental", stage_scope: "gate_evaluation", lane_key: "money" },
        },
      }),
    });
    const manifestCall = await manifestResponse.json() as { result?: { structuredContent?: { gates?: Array<{ gate_key: string }> }; isError?: boolean } };
    if (manifestResponse.status < 400 && manifestCall.result?.isError !== true) {
      expect(manifestCall.result?.structuredContent?.gates?.some((gate) => gate.gate_key === "mcp_vectrix_fixture_gate")).toBe(false);
    }
    const opmgResponse = await fetchFromWorker("/api/operator/mcp", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 100,
        method: "tools/call",
        params: {
          name: "list_active_gates",
          arguments: { brand_key: "opmg_deadman", stage_scope: "gate_evaluation", lane_key: "money" },
        },
      }),
    });
    const opmgCall = await opmgResponse.json() as { result?: { structuredContent?: { gates?: Array<{ gate_key: string }> }; isError?: boolean } };
    if (opmgResponse.status < 400 && opmgCall.result?.isError !== true) {
      expect(opmgCall.result?.structuredContent?.gates?.some((gate) => gate.gate_key === "mcp_vectrix_fixture_gate")).toBe(false);
    }
    const ownAccount = await mcpTool<{ gates: Array<{ gate_key: string }> }>("list_active_gates", {
      brand_key: BRAND_KEY,
      stage_scope: "gate_evaluation",
      lane_key: "money",
    });
    expect(ownAccount.gates.some((gate) => gate.gate_key === "mcp_vectrix_fixture_gate")).toBe(true);
  }, 30000);
});
