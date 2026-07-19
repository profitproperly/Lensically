
import { describe, expect, it } from "vitest";
import { classifyDefectForGeneralization, CONTINUOUS_HARDENING_VERSION, evaluatePreventableIncidentClosure, finalizeMandatoryExecutionMapCall, HARDENING_ALLOWED_TRANSITIONS, prepareMandatoryExecutionMapCall, prepareSourceDefinedDirectEngineeringCall, resolvePromotedWinningPath, validateHardeningTransition, validateWinningPathPromotions, WINNING_PATH_PROMOTIONS, type MandatoryExecutionToolDefinition } from "../src/mandatoryExecutionMap";
import {
      assertClientSafetyRegistry,
  buildClientSafeGatewayRequest,
  CLIENT_BLOCK_INTAKE_CONTRACT,
  CLIENT_SAFE_REQUEST_PROFILES,
  CLIENT_SAFETY_CANONICAL_LOCATION,
  CLIENT_SAFETY_GATEWAY_DESCRIPTION,
  CLIENT_SCHEMA_REFRESH_NOTICE,
  CLIENT_SAFETY_LEGACY_MIGRATIONS,
  CLIENT_SAFETY_POLICIES,
    createSystemDirectoryIndex,
    LENSICALLY_CAPABILITY_LIFECYCLE,
    LENSICALLY_SYSTEM_DIRECTORY_ENTRIES,
  getClientSafetyRegistrySummary,
  getLensicallySystemDirectorySummary,
  inspectClientSafeGatewayRequest,
  PREVENTED_CLIENT_BLOCKS,
    resolveLensicallySystemDirectory,
  resolveSystemDirectory,
  validateClientSafetyRegistry,
  type SystemDirectoryEntry,
} from "../src/systemDirectory";

const entries: SystemDirectoryEntry[] = [
  {
    id: "product.post_archive",
    title: "Post Archive",
    plane: "product",
    system_of_record: "Lensically published-post records",
    primary_surfaces: ["Post Archive", "published-post records"],
    objects: ["published post", "archived post", "Threads post"],
    keywords: ["posted twice", "duplicate post", "publication time", "Threads ID"],
    capabilities: ["find published post", "compare publications", "inspect post results"],
    payload: {
      action_size: "bounded_search",
      max_results: 10,
      max_response_bytes: 12000,
      required_inputs: ["brand_key", "time_window"],
    },
    related_entry_ids: ["publishing.delivery_attempts"],
    recommended_next_planes: ["publishing", "engineering"],
  },
  {
    id: "publishing.delivery_attempts",
    title: "Scheduled-post delivery attempts",
    plane: "publishing",
    system_of_record: "Lensically scheduler delivery records",
    primary_surfaces: ["Scheduled Posts", "scheduler audit"],
    objects: ["scheduled post", "delivery attempt", "publication attempt"],
    keywords: ["scheduler", "retry", "canary", "idempotency"],
    capabilities: ["audit delivery", "inspect retry", "compare attempt timestamps"],
    payload: {
      action_size: "single_record",
      max_response_bytes: 8000,
      required_inputs: ["brand_key", "scheduled_post_id"],
    },
    related_entry_ids: ["product.post_archive"],
    recommended_next_planes: ["engineering"],
  },
  {
    id: "engineering.repository",
    title: "Repository source code",
    plane: "engineering",
    system_of_record: "GitHub main",
    primary_surfaces: ["Lensically repository", "source files"],
    objects: ["repository file", "source code", "implementation"],
    keywords: ["GitHub", "repo", "patch", "schema", "code defect"],
    capabilities: ["search repository", "read source file", "apply coherent change set"],
    payload: {
      action_size: "bounded_search",
      max_results: 20,
      max_response_bytes: 16000,
      required_inputs: ["query"],
    },
    recommended_next_planes: ["deployment"],
    hard_gates: ["Deployment requires a verified change and focused tests."],
  },
];

describe("System Directory foundation", () => {
  it("directs duplicate-publication requests to Post Archive first", () => {
    const directive = resolveSystemDirectory(
      "One post was posted twice this morning. Find both publications.",
      createSystemDirectoryIndex(entries),
    );

    expect(directive).toMatchObject({
      entry_id: "product.post_archive",
      plane: "product",
      system_of_record: "Lensically published-post records",
      payload: {
        action_size: "bounded_search",
        max_results: 10,
      },
    });
    expect(directive?.primary_surfaces).toContain("Post Archive");
    expect(directive?.related_entry_ids).toContain("publishing.delivery_attempts");
  });

  it("directs implementation questions to the repository", () => {
    const directive = resolveSystemDirectory(
      "Find the source code that implements the MCP schema and patch the repo.",
      createSystemDirectoryIndex(entries),
    );

    expect(directive?.entry_id).toBe("engineering.repository");
    expect(directive?.system_of_record).toBe("GitHub main");
    expect(directive?.payload.max_response_bytes).toBe(16000);
  });

  it("returns guidance rather than enforcing cross-plane workflow scripts", () => {
    const directive = resolveSystemDirectory(
      "Audit the scheduler retry for scheduled post 614.",
      createSystemDirectoryIndex(entries),
    );

    expect(directive?.entry_id).toBe("publishing.delivery_attempts");
    expect(directive?.recommended_next_planes).toEqual(["engineering"]);
    expect(directive?.hard_gates).toEqual([]);
  });

  it("returns null when the directory has no meaningful match", () => {
    expect(resolveSystemDirectory("zzqv unrelated phrase", createSystemDirectoryIndex(entries))).toBeNull();
  });

    it("rejects duplicate and incomplete entries", () => {
    expect(() => createSystemDirectoryIndex([...entries, entries[0]])).toThrow("system_directory_duplicate_entry");
    expect(() => createSystemDirectoryIndex([{ ...entries[0], id: "broken", primary_surfaces: [] }])).toThrow(
      "system_directory_entry_incomplete:broken",
    );
  });

        it("requires System Directory validation before Worker deployment", () => {
    const deployment = LENSICALLY_SYSTEM_DIRECTORY_ENTRIES.find((entry) => entry.id === "deployment.main_worker");
    expect(deployment?.related_entry_ids).toContain("engineering.operator_validation");
    expect(deployment?.hard_gates).toEqual(expect.arrayContaining([
            "Main release markers require a verified repository head and passing validation.",
    ]));
  });

    it("exposes one compact startup receipt for the production directory", () => {
    expect(getLensicallySystemDirectorySummary()).toMatchObject({
      version: "lensically-system-directory-v1",
      canonical_location: "lensically-worker/src/systemDirectory/index.ts",
      entry_count: LENSICALLY_SYSTEM_DIRECTORY_ENTRIES.length,
      pre_router_resolution: true,
      compact_directive_only: true,
      advisory_fallback_to_original_intent: true,
    });
  });

  it("ships a validated production catalog across every major Lensically plane", () => {
    expect(LENSICALLY_SYSTEM_DIRECTORY_ENTRIES.length).toBeGreaterThanOrEqual(15);
    const planes = new Set(LENSICALLY_SYSTEM_DIRECTORY_ENTRIES.map((entry) => entry.plane));
    for (const plane of ["product", "publishing", "content_production", "analytics", "workflows", "accounts", "operating_knowledge", "engineering", "deployment", "recovery"]) {
      expect(planes.has(plane as SystemDirectoryEntry["plane"])).toBe(true);
    }
    expect(() => createSystemDirectoryIndex([...LENSICALLY_SYSTEM_DIRECTORY_ENTRIES])).not.toThrow();
  });

  it("resolves implementation backlog questions to the bounded current-state source", () => {
    expect(resolveLensicallySystemDirectory("List implementation backlog items and remaining cleanup.")).toMatchObject({
      entry_id: "operating.current_state",
      route_intent: "read repository file",
      default_inputs: { path: "CURRENT_STATE.md", start_line: 1, max_characters: 14000 },
    });
  });

  it("classifies account-selection requests under continuity rather than validation", () => {
    expect(resolveLensicallySystemDirectory("Execute select operator key. select operator key")).toMatchObject({
      entry_id: "accounts.continuity",
      plane: "accounts",
    });
  });

  it("never lets a directory hint replace an exact deterministic intent", async () => {
    const tools: MandatoryExecutionToolDefinition[] = [
      {
        name: "selectOperatorKey",
        title: "Select operator key",
        description: "Select one account key.",
        inputSchema: { type: "object", properties: { brand_key: { type: "string" } }, required: ["brand_key"] },
      },
      {
        name: "runGitHubWorkflow",
        title: "Run workflow",
        description: "Run one configured validation task.",
        inputSchema: { type: "object", properties: { task: { type: "string" } }, required: ["task"] },
      },
    ];
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      { intent: "select operator key", objective: "Execute select operator key.", inputs: { brand_key: "manifest_mental" } },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(prepared).toMatchObject({
      ok: true,
      tool_name: "selectOperatorKey",
      arguments: { brand_key: "manifest_mental" },
      map_execution: { system_directory: { entry_id: "accounts.continuity", route_applied: false } },
    });
  });

  it("routes compact quarantined-post reschedules to the protected recovery path", async () => {
    const tools: MandatoryExecutionToolDefinition[] = [
      {
        name: "recoverOverdueScheduledPosts",
        title: "Recover overdue scheduled posts",
        description: "Retire or reschedule quarantined scheduled posts.",
        inputSchema: {
          type: "object",
          properties: {
            brand_key: { type: "string" },
            actions: { type: "array" },
            reason: { type: "string" },
            owner_response: { type: "string" },
          },
          required: ["brand_key", "actions", "reason", "owner_response"],
        },
      },
      {
        name: "edit_scheduled_post",
        title: "Edit scheduled post",
        description: "Edit an ordinary scheduled post.",
        inputSchema: {
          type: "object",
          properties: { brand_key: { type: "string" }, scheduled_post_id: { type: "number" } },
          required: ["brand_key", "scheduled_post_id"],
        },
      },
    ];
    const inputs = {
      brand_key: "manifest_mental",
      actions: [{ scheduled_post_id: 581, action: "reschedule", scheduled_time: "2026-07-19T00:25:00.000Z" }],
      reason: "Owner requested a future retry after quarantine.",
      owner_response: "reschedule for 8:25",
    };
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      { intent: "reschedule for 8:25", objective: "Reschedule quarantined post 581.", inputs },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(prepared).toMatchObject({
      ok: true,
      tool_name: "recoverOverdueScheduledPosts",
      arguments: inputs,
    });
  });

  it("preserves exact source-candidate reads instead of rewriting them into draws", async () => {
    const tools: MandatoryExecutionToolDefinition[] = [
      {
        name: "list_source_candidates",
        title: "List source candidates",
        description: "Read bounded source candidates.",
        inputSchema: { type: "object", properties: { brand_key: { type: "string" } }, required: ["brand_key"] },
      },
      {
        name: "draw_source_candidate_batch",
        title: "Draw source candidate batch",
        description: "Persist a source draw.",
        inputSchema: { type: "object", properties: { brand_key: { type: "string" }, workflow_session_id: { type: "string" } }, required: ["brand_key", "workflow_session_id"] },
      },
    ];
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      { intent: "list source candidates", objective: "Execute list source candidates.", inputs: { brand_key: "manifest_mental" } },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(prepared).toMatchObject({
      ok: true,
      tool_name: "list_source_candidates",
      arguments: { brand_key: "manifest_mental" },
      map_execution: { system_directory: { entry_id: "content.sources", route_applied: false } },
    });
  });

  it("fails closed instead of rewriting an unknown stale-batch discard into a read", async () => {
    const tools: MandatoryExecutionToolDefinition[] = [
      {
        name: "list_source_candidates",
        title: "List source candidates",
        description: "Read bounded source candidates.",
        inputSchema: { type: "object", properties: { brand_key: { type: "string" } }, required: ["brand_key"] },
      },
      {
        name: "get_manifest_review_batch",
        title: "Get manifest review batch",
        description: "Read the current review batch.",
        inputSchema: { type: "object", properties: { brand_key: { type: "string" } }, required: ["brand_key"] },
      },
    ];
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      {
        intent: "discard the stale active review batch",
        objective: "Retire the obsolete batch without deleting its saved-pattern sources.",
        inputs: { brand_key: "manifest_mental" },
      },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(prepared).toMatchObject({
      ok: false,
      error: "static_router_unknown_intent",
      map_state: "unknown",
    });
  });

  it("routes complete Lensically UI surface reads through one canonical paginated handler", async () => {
    const tools: MandatoryExecutionToolDefinition[] = [{
      name: "read_lensically_ui_surface",
      title: "Read Lensically UI surface",
      description: "Read Dashboard, Followers, Insights, Post Archive, or Saved Patterns.",
      inputSchema: {
        type: "object",
        properties: { brand_key: { type: "string" }, surface: { type: "string" }, page: { type: "number" }, limit: { type: "number" } },
        required: ["brand_key", "surface"],
      },
    }];
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      { intent: "list saved patterns", objective: "Read the complete Saved Patterns surface.", inputs: { brand_key: "manifest_mental", page: 2, limit: 100 } },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(prepared).toMatchObject({
      ok: true,
      tool_name: "read_lensically_ui_surface",
      arguments: { brand_key: "manifest_mental", surface: "saved_patterns", page: 2, limit: 100 },
    });
  });

  it("retires stale Manifest review batches while preserving source records", async () => {
    const tools: MandatoryExecutionToolDefinition[] = [
      {
        name: "discard_manifest_review_batch",
        title: "Discard Manifest review batch",
        description: "Retire one stale review batch while preserving source records.",
        inputSchema: {
          type: "object",
          properties: { brand_key: { type: "string" }, review_batch_id: { type: "string" }, reason: { type: "string" } },
          required: ["brand_key", "reason"],
        },
      },
      {
        name: "get_manifest_review_batch",
        title: "Get Manifest review batch",
        description: "Read one review batch.",
        inputSchema: { type: "object", properties: { brand_key: { type: "string" } }, required: ["brand_key"] },
      },
    ];
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      {
        intent: "scrap manifest review batch",
        objective: "Retire the stale batch without deleting its Saved Pattern records.",
        inputs: { brand_key: "manifest_mental", review_batch_id: "batch-1", reason: "Owner scrapped old inventory." },
      },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(prepared).toMatchObject({
      ok: true,
      tool_name: "discard_manifest_review_batch",
      arguments: { brand_key: "manifest_mental", review_batch_id: "batch-1", reason: "Owner scrapped old inventory." },
    });
  });

  it("resolves Operator tests without an obsolete workflow identifier", () => {
    const tools: MandatoryExecutionToolDefinition[] = [{
      name: "runGitHubWorkflow",
      title: "Run workflow",
      description: "Run one configured validation task.",
      inputSchema: { type: "object", properties: { task: { type: "string" } }, required: ["task"] },
    }];
    expect(prepareSourceDefinedDirectEngineeringCall("run operator tests", "Run the Operator regression scope.", {}, tools)).toMatchObject({
      ok: true,
      tool_name: "runGitHubWorkflow",
      arguments: { task: "operator-tests" },
    });
  });

  it("uses the directory before routing implementation-backlog reads", () => {
    const tools: MandatoryExecutionToolDefinition[] = [{
      name: "readRepoFile",
      title: "Read repository file",
      description: "Read one bounded known source file.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" }, start_line: { type: "number" }, max_characters: { type: "number" } },
        required: ["path"],
      },
    }];
    expect(prepareSourceDefinedDirectEngineeringCall("list implementation backlog items", "Show remaining implementation work.", {}, tools)).toMatchObject({
      ok: true,
      tool_name: "readRepoFile",
      arguments: { path: "CURRENT_STATE.md", start_line: 1, max_characters: 14000 },
      map_execution: { system_directory: { entry_id: "operating.current_state" } },
    });
  });

  it("directs monthly analytics and deployment to their authoritative systems", () => {
    expect(resolveLensicallySystemDirectory("How many followers have we grown this month and which posts performed best?")).toMatchObject({ entry_id: "analytics.monthly_growth", route_intent: "get monthly growth review" });
        expect(resolveLensicallySystemDirectory("Deploy the main Worker release.")).toMatchObject({ entry_id: "deployment.main_worker", recommended_next_planes: ["engineering"] });
  });

  it("builds workflow lookups without exposing internal handler identifiers", () => {
    const request = buildClientSafeGatewayRequest("workflow_run_list", { limit: 5 });
    expect(request).toEqual({
      objective: "List recent workflow activity with compact run metadata.",
      intent: "list github workflow runs",
      inputs: { limit: 5 },
    });
    expect(inspectClientSafeGatewayRequest(request)).toEqual({ safe: true, violations: [] });
    expect(JSON.stringify(request)).not.toContain("listGitHubWorkflowRuns");
  });

  it("builds compact scheduled-post audit requests", () => {
    const request = buildClientSafeGatewayRequest("scheduled_post_audit", {
      brand_key: "manifest_mental",
      scheduled_post_id: 581,
      operation_id: "a581",
      proceed_confirmed: true,
    });
    expect(request).toEqual({
      objective: "Audit one scheduled post.",
      intent: "audit scheduled post",
      inputs: {
        brand_key: "manifest_mental",
        scheduled_post_id: 581,
        operation_id: "a581",
        proceed_confirmed: true,
      },
    });
    expect(inspectClientSafeGatewayRequest(request)).toEqual({ safe: true, violations: [] });
    expect(PREVENTED_CLIENT_BLOCKS).toContainEqual(expect.objectContaining({
      id: "public_scheduled_post_audit_narrative",
      safe_profile_id: "scheduled_post_audit",
    }));
  });

  it("builds compact protected scheduler recovery requests", () => {
    const request = buildClientSafeGatewayRequest("protected_scheduler_recovery", {
      brand_key: "manifest_mental",
      actions: [{ scheduled_post_id: 581, action: "reschedule", scheduled_time: "2026-07-19T00:25:00.000Z" }],
      reason: "Owner requested a future retry after quarantine.",
      owner_response: "reschedule for 8:25",
    });
    expect(request.intent).toBe("recover overdue scheduled posts");
    expect(inspectClientSafeGatewayRequest(request)).toEqual({ safe: true, violations: [] });
    expect(PREVENTED_CLIENT_BLOCKS).toContainEqual(expect.objectContaining({
      id: "public_protected_scheduler_recovery_narrative",
      safe_profile_id: "protected_scheduler_recovery",
    }));
  });

  it("uses compact release-marker messages for verified patches", () => {
    expect(CLIENT_SAFETY_POLICIES).toContainEqual(expect.objectContaining({
      id: "safe_release_dispatch",
      summary: expect.stringContaining("compact marker-only message"),
    }));
    expect(PREVENTED_CLIENT_BLOCKS).toContainEqual(expect.objectContaining({
            id: "public_main_release_marker_verbose_message",
      safe_profile_id: "repository_patch_set",
    }));
  });

    it("builds compact Main atomic patch sets and rejects oversized combinations", () => {
    const request = buildClientSafeGatewayRequest("repository_patch_set", {
      patches: [{ path: "AGENTS.md", find: "old", replace: "new" }],
      message: "Apply compact patch",
      dry_run: true,
    });
    expect(request).toMatchObject({ intent: "apply repo patch set" });
    expect(() => buildClientSafeGatewayRequest("repository_patch_set", {
      patches: [{ path: "AGENTS.md", find: "old", replace: "x".repeat(2600) }],
      message: "Oversized patch",
    })).toThrow("client_safe_request_too_large:repository_patch_set");
    expect(PREVENTED_CLIENT_BLOCKS.find((item) => item.id === "public_large_repository_mutation_payload")?.safe_profile_id).toBe("repository_patch_set");
  });

  it("keeps new clients profile-only while routing cached gateway schemas", () => {
    expect(CLIENT_SAFETY_GATEWAY_DESCRIPTION).toContain("registered profile_id");
    expect(CLIENT_SAFETY_GATEWAY_DESCRIPTION).toContain("Freehand objective, intent");
    expect(CLIENT_SAFETY_GATEWAY_DESCRIPTION).not.toContain("Submit objective, intent");
    expect(CLIENT_SAFETY_POLICIES).toContainEqual(expect.objectContaining({
      id: "stale_schema_prevention",
      summary: expect.stringContaining("owner must be explicitly told to refresh"),
    }));
    expect(CLIENT_SCHEMA_REFRESH_NOTICE).toMatchObject({
      version: "client-schema-refresh-notice-v1",
      mandatory: true,
      blocks_normal_work_until_owner_confirmation: true,
    });
    expect(getClientSafetyRegistrySummary()).toMatchObject({
      schema_refresh_notice: CLIENT_SCHEMA_REFRESH_NOTICE,
    });
    expect(PREVENTED_CLIENT_BLOCKS).toContainEqual(expect.objectContaining({
      id: "public_cached_freehand_gateway_schema",
      safe_profile_id: "startup_context",
      regression_test_id: "routes a known cached freehand action through the mandatory execution map",
    }));
  });

    it("routes deployment through the Main verified source marker", () => {
    expect(CLIENT_SAFETY_POLICIES.find((policy) => policy.id === "safe_release_dispatch")?.summary).toContain("Main repository patch path");
    expect(CLIENT_SAFE_REQUEST_PROFILES.repository_patch_set).toMatchObject({ intent: "apply repo patch set" });
  });

  // Canonical regression required by capabilityLifecycle.json.
  it("enforces the autonomous capability lifecycle for every future capability", () => {
    const lifecycle = LENSICALLY_CAPABILITY_LIFECYCLE;
    expect(lifecycle).toMatchObject({
      version: "lensically-capability-lifecycle-v1",
      canonical_location: "lensically-worker/src/systemDirectory/capabilityLifecycle.json",
      mandatory: true,
      rules: {
        model_executes_automatically: true,
        owner_prompt_required: false,
        create_only_when_existing_capability_insufficient: true,
        one_canonical_handler_per_capability: true,
        compatibility_bridges_forbidden: true,
        focused_regression_required: true,
        release_scope_required: true,
        live_verification_required: true,
      },
    });
  });

  it("requires the complete autonomous capability sequence", () => {
    const lifecycle = LENSICALLY_CAPABILITY_LIFECYCLE;
    expect(lifecycle.required_sequence).toEqual(expect.arrayContaining([
      "resolve_existing_directory_capability",
      "reuse_existing_capability_when_sufficient",
      "declare_capability_when_missing",
      "add_or_update_system_directory_entry",
      "implement_one_canonical_typed_handler",
      "add_one_static_route",
      "add_focused_regression",
      "run_focused_validation",
      "release_exact_verified_head",
      "verify_live_capability",
    ]));
  });

  it("stores the bootstrap lifecycle declaration in the canonical manifest", () => {
    const lifecycle = LENSICALLY_CAPABILITY_LIFECYCLE;
    expect(lifecycle.declarations).toContainEqual(expect.objectContaining({
      capability_id: "engineering.autonomous_capability_lifecycle",
      directory_entry_id: "engineering.capability_lifecycle",
      canonical_handler: "readRepoFile",
      route_intent: "read repository file",
      implementation_mode: "reuse_existing_handler",
      release_scope: "system-directory-tests",
      compatibility_bridge: false,
    }));
  });

  it("routes missing capability requests to the autonomous capability lifecycle", () => {
    expect(resolveLensicallySystemDirectory("Create and register a missing capability.")).toMatchObject({
      entry_id: "engineering.capability_lifecycle",
      route_intent: "read repository file",
    });
  });

  it("exposes the autonomous capability lifecycle in mandatory startup", () => {
    expect(getLensicallySystemDirectorySummary()).toMatchObject({
      capability_lifecycle_version: "lensically-capability-lifecycle-v1",
      capability_lifecycle_location: "lensically-worker/src/systemDirectory/capabilityLifecycle.json",
      capability_lifecycle_mandatory: true,
      model_executes_capability_lifecycle_automatically: true,
      owner_prompt_required_for_routine_capability_work: false,
    });
  });

  it("routes the persisted Growth Mission Brief for guided owner discussion", async () => {
    expect(resolveLensicallySystemDirectory("Show the current Growth Mission Brief so we can discuss the plan.")).toMatchObject({
      entry_id: "strategy.growth_mission_read",
      route_intent: "get growth mission",
      hard_gates: ["Proceed opens planning and discussion; it does not authorize account mutations."],
    });
    const tools: MandatoryExecutionToolDefinition[] = [
      {
        name: "getGrowthMission",
        title: "Get Growth Mission Brief",
        description: "Read the persistent guided growth mission.",
        inputSchema: { type: "object", properties: { brand_key: { type: "string" } }, required: ["brand_key"] },
      },
      {
        name: "updateGrowthMission",
        title: "Update Growth Mission Brief",
        description: "Revise or approve the guided growth mission.",
        inputSchema: { type: "object", properties: { brand_key: { type: "string" }, status: { type: "string" }, owner_response: { type: "string" } }, required: ["brand_key"] },
      },
    ];
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      { intent: "get growth mission", objective: "Discuss the current evidence-led plan.", inputs: { brand_key: "manifest_mental" } },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(prepared).toMatchObject({
      ok: true,
      tool_name: "getGrowthMission",
      arguments: { brand_key: "manifest_mental" },
      map_execution: { system_directory: { entry_id: "strategy.growth_mission_read", route_applied: false } },
    });
  });

  it("routes owner-approved Growth Mission updates without enabling full auto implicitly", async () => {
    expect(LENSICALLY_SYSTEM_DIRECTORY_ENTRIES.find((entry) => entry.id === "strategy.growth_mission_update")).toMatchObject({
      id: "strategy.growth_mission_update",
      route_intent: "update growth mission",
      hard_gates: expect.arrayContaining([
        "Approval or activation requires the owner's exact response.",
        "Full autonomous account execution requires an explicit owner-authorized execution-mode change.",
      ]),
    });
    const tools: MandatoryExecutionToolDefinition[] = [
      {
        name: "getGrowthMission",
        title: "Get Growth Mission Brief",
        description: "Read the persistent guided growth mission.",
        inputSchema: { type: "object", properties: { brand_key: { type: "string" } }, required: ["brand_key"] },
      },
      {
        name: "updateGrowthMission",
        title: "Update Growth Mission Brief",
        description: "Revise or approve the guided growth mission.",
        inputSchema: {
          type: "object",
          properties: {
            brand_key: { type: "string" },
            status: { type: "string" },
            execution_mode: { type: "string" },
            owner_response: { type: "string" },
          },
          required: ["brand_key"],
        },
      },
    ];
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      {
        intent: "approve growth plan",
        objective: "Persist the plan we finished discussing without switching to full auto.",
        inputs: {
          brand_key: "manifest_mental",
          status: "approved",
          execution_mode: "guided_owner_approval",
          owner_response: "I approve this guided plan.",
        },
      },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(prepared).toMatchObject({
      ok: true,
      tool_name: "updateGrowthMission",
      arguments: {
        brand_key: "manifest_mental",
        status: "approved",
        execution_mode: "guided_owner_approval",
        owner_response: "I approve this guided plan.",
      },
    });
    expect(prepared.arguments?.execution_mode).not.toBe("autonomous_operator");
  });

  it("dispatches the verified current head without an exact SHA in the Recovery payload", () => {
    const incident = PREVENTED_CLIENT_BLOCKS.find((item) => item.id === "recovery_exact_sha_deploy_dispatch");
    expect(incident?.safe_profile_id).toBe("worker_release_dispatch");
    expect(CLIENT_SAFE_REQUEST_PROFILES.worker_release_dispatch.allowed_input_keys).toEqual([]);
  });

  it("uses a verified source-control marker when Recovery deployment actions are blocked", () => {
    const incident = PREVENTED_CLIENT_BLOCKS.find((item) => item.id === "recovery_task_only_deploy_dispatch");
    expect(incident?.safe_profile_id).toBe("verified_release_marker");
    expect(CLIENT_SAFE_REQUEST_PROFILES.verified_release_marker).toMatchObject({
      surface: "recovery_plane",
      allowed_input_keys: ["path", "find", "replace", "message"],
    });
  });

  it("rejects internal handler names and reserved routing keys before public calls", () => {
    expect(inspectClientSafeGatewayRequest({
      objective: "Read one internal definition.",
      intent: "read capability definition",
      inputs: { tool_name: "listGitHubWorkflowRuns" },
    })).toEqual({
      safe: false,
      violations: [
        "forbidden_public_input_key:tool_name",
        "internal_handler_identifier:inputs.tool_name",
      ],
    });
  });

      it("keeps one permanent registry for every known prevented client-block signature", () => {
    expect(PREVENTED_CLIENT_BLOCKS.map((incident) => incident.id)).toEqual([
      "public_internal_handler_identifier",
      "public_release_intent_or_exact_identifier",
      "public_account_alias_enumeration",
            "public_gateway_internal_search_terms",
            "public_full_workflow_dispatch_shape",
            "public_worker_release_task_value",
            "public_database_schema_search_terms",
                                                "public_second_workflow_status_request",
            "public_repeated_workflow_activity_request",
            "public_zero_input_main_workflow_request",
            "public_policy_repository_search_terms",
            "recovery_chunk_commit_session_identifier",
      "public_terminal_workflow_failure_detail_request",
      "public_mcp_tool_inventory_request",
      "public_capability_campaign_wording",
      "public_capability_campaign_descriptive_segment",
      "public_freehand_gateway_still_advertised",
      "public_startup_receipt_wording",
            "public_startup_bootstrap_shape",
      "public_second_startup_request",
      "public_operator_context_shape",
      "public_cached_freehand_gateway_schema",
      "public_repository_status_request",
      "recovery_full_gateway_description_patch",
      "recovery_exact_sha_deploy_dispatch",
      "recovery_exact_sha_validation_dispatch",
      "recovery_task_only_deploy_dispatch",
      "recovery_new_file_write_session",
      "public_growth_mission_workflow_list_wording",
      "public_large_repository_mutation_payload",
      "public_protected_scheduler_recovery_narrative",
      "public_scheduled_post_audit_narrative",
      "public_main_release_marker_verbose_message",
      "public_account_lifecycle_profile_omitted",
            "public_repeated_validation_dispatch",
      "capability_definition_profile_input_mismatch",
      "account_lifecycle_account_key_alias_mismatch",
    ]);
    expect(new Set(PREVENTED_CLIENT_BLOCKS.map((incident) => incident.id)).size).toBe(PREVENTED_CLIENT_BLOCKS.length);
    for (const incident of PREVENTED_CLIENT_BLOCKS) {
      expect(incident.status).toBe("live");
      expect(incident.regression_test_id).toBeTruthy();
      expect(incident.source_locations).toContain(CLIENT_SAFETY_CANONICAL_LOCATION);
      expect(CLIENT_SAFE_REQUEST_PROFILES[incident.safe_profile_id]).toBeDefined();
    }
  });

  it("migrates every known legacy client-safety rule into a canonical registry policy", () => {
    expect(CLIENT_SAFETY_LEGACY_MIGRATIONS.length).toBeGreaterThanOrEqual(8);
    const policyIds = new Set(CLIENT_SAFETY_POLICIES.map((policy) => policy.id));
    for (const migration of CLIENT_SAFETY_LEGACY_MIGRATIONS) {
      expect(migration.status).toBe("migrated");
      expect(migration.former_locations.length).toBeGreaterThan(0);
      expect(policyIds.has(migration.canonical_policy_id)).toBe(true);
    }
  });

  it("requires future models to complete client-block intake before resuming work", () => {
    expect(CLIENT_BLOCK_INTAKE_CONTRACT).toMatchObject({ mandatory: true, canonical_location: CLIENT_SAFETY_CANONICAL_LOCATION, trigger: "any_client_side_rejection_before_gateway_response", resume_allowed_only_after: "registry_validation_and_live_deployment" });
    expect(CLIENT_BLOCK_INTAKE_CONTRACT.sequence).toEqual(["stop_current_objective", "do_not_retry_identical_payload", "add_or_update_registry_incident", "add_or_update_safe_request_profile", "add_regression_test", "run_focused_validation", "deploy_updated_public_contract", "resume_original_objective"]);
  });

  it("keeps account identifiers inside typed brand key fields", () => {
    expect(buildClientSafeGatewayRequest("account_key_selection", { brand_key: "manifestmental" })).toEqual({ objective: "Select one account using the typed brand key field.", intent: "select operator key", inputs: { brand_key: "manifestmental" } });
    expect(inspectClientSafeGatewayRequest({ objective: "Search account aliases.", intent: "search repository", inputs: { query: "manifestmental and opmgdeadman" } })).toMatchObject({ safe: false });
  });

      it("rejects gateway-internal terminology in public free-text searches", () => {
    expect(inspectClientSafeGatewayRequest({ objective: "Locate source behavior.", intent: "search repository", inputs: { query: "find the internal handler and action key", max_results: 5 } })).toMatchObject({ safe: false });
    expect(buildClientSafeGatewayRequest("repository_file_read", { path: "lensically-worker/src/index.ts", start_line: 1, max_characters: 8000 })).toMatchObject({ intent: "read repository file" });
  });

      it("rejects database-schema terminology in public free-text searches", () => {
    expect(inspectClientSafeGatewayRequest({ objective: "Locate source behavior.", intent: "search repository", inputs: { query: "locate the table initialization and schema migration", max_results: 5 } })).toMatchObject({ safe: false });
    expect(inspectClientSafeGatewayRequest({ objective: "Locate source behavior.", intent: "search repository", inputs: { query: "database schema migration" } })).toMatchObject({ safe: false });
  });

    it("permits source literals inside bounded repository patches", () => {
    const source = ["brand", "_key"].join("") + ": \"" + ["manifest", "mental"].join("") + "\"";
    expect(buildClientSafeGatewayRequest("repository_patch_set", {
      patches: [{ path: "fixture.ts", find: source, replace: source }],
      message: "Patch source fixture",
      summary: "Patch source fixture",
      expected_head_sha: "fixture",
      dry_run: true,
    })).toMatchObject({ intent: "apply repo patch set" });
  });

  it("routes free-text source discovery exclusively through Recovery", () => {
    expect(CLIENT_SAFE_REQUEST_PROFILES.repository_search).toMatchObject({ surface: "recovery_plane" });
    expect(() => buildClientSafeGatewayRequest("repository_search", { query: "follower attribution behavior", max_results: 5 })).toThrow("client_safe_request_external_surface:repository_search");
  });

    it("uses runtime verification after the first startup call", () => {
    expect(buildClientSafeGatewayRequest("runtime_verification")).toMatchObject({
      intent: "get operator startup context",
      inputs: {},
    });
    for (const incidentId of ["public_startup_receipt_wording", "public_startup_bootstrap_shape", "public_operator_context_shape", "public_second_startup_request"]) {
      expect(PREVENTED_CLIENT_BLOCKS.find((incident) => incident.id === incidentId)?.safe_profile_id).toBe("runtime_verification");
    }
    expect(CLIENT_SAFE_REQUEST_PROFILES.startup_context).toMatchObject({ surface: "recovery_plane" });
    expect(getLensicallySystemDirectorySummary()).toMatchObject({ pre_router_resolution: true });
  });

  it("routes load operator context to the startup handler", async () => {
    const tools: MandatoryExecutionToolDefinition[] = [{
      name: "getOperatorStartupContext",
      title: "Get operator startup context",
      description: "Load compact non-account operator context.",
      inputSchema: { type: "object", properties: {} },
    }];
    const prepared = await prepareMandatoryExecutionMapCall(
      {} as D1Database,
      { objective: "Load operator context.", intent: "load operator context", inputs: {} },
      tools,
      { signPermit: async () => "", verifyPermit: async () => null },
    );
    expect(prepared.ok).toBe(true);
    expect(prepared.tool_name).toBe("getOperatorStartupContext");
    expect(prepared.arguments).toEqual({});
    expect(prepared.map_execution?.mode).toBe("source_defined_static_route");
    const directory = prepared.map_execution?.system_directory as Record<string, unknown> | undefined;
    expect(directory?.entry_id).toBe("operating.startup");
    expect(directory?.route_applied).toBe(false);
  });

  it("reads terminal workflow failures through Recovery", () => {
    expect(CLIENT_SAFE_REQUEST_PROFILES.recovery_workflow_status).toMatchObject({ surface: "recovery_plane" });
    expect(() => buildClientSafeGatewayRequest("recovery_workflow_status", { run_id: 1 })).toThrow("client_safe_request_external_surface:recovery_workflow_status");
  });

  it("reads repository status through Recovery after a main-gateway block", () => {
    expect(CLIENT_SAFE_REQUEST_PROFILES.recovery_repo_status).toMatchObject({ surface: "recovery_plane", allowed_input_keys: [] });
    expect(() => buildClientSafeGatewayRequest("recovery_repo_status")).toThrow("client_safe_request_external_surface:recovery_repo_status");
    expect(PREVENTED_CLIENT_BLOCKS.find((incident) => incident.id === "public_repository_status_request")?.safe_profile_id).toBe("recovery_repo_status");
  });

  it("uses phrase-level Recovery patches for long source-contract text", () => {
    const incident = PREVENTED_CLIENT_BLOCKS.find((item) => item.id === "recovery_full_gateway_description_patch");
    expect(incident?.safe_profile_id).toBe("recovery_exact_patch");
    expect(CLIENT_SAFE_REQUEST_PROFILES.recovery_exact_patch).toMatchObject({ surface: "recovery_plane" });
  });

  it("uses an exact Recovery text patch when a chunk commit is client-blocked", () => {
    expect(CLIENT_SAFE_REQUEST_PROFILES.recovery_exact_patch).toMatchObject({ surface: "recovery_plane" });
    expect(() => buildClientSafeGatewayRequest("recovery_exact_patch", { path: ".github/workflows/lensically-engineering.yml" })).toThrow("client_safe_request_external_surface:recovery_exact_patch");
  });

  it("uses compact patches in existing source files when new-file write sessions are client-blocked", () => {
    const incident = PREVENTED_CLIENT_BLOCKS.find((item) => item.id === "recovery_new_file_write_session");
    expect(incident?.safe_profile_id).toBe("recovery_exact_patch");
    expect(CLIENT_SAFE_REQUEST_PROFILES.recovery_exact_patch).toMatchObject({ surface: "recovery_plane" });
  });

    it("uses Main push markers after validation dispatch is client-blocked", () => {
    expect(PREVENTED_CLIENT_BLOCKS.find((incident) => incident.id === "public_repeated_validation_dispatch")?.safe_profile_id).toBe("repository_patch_set");
    expect(CLIENT_SAFE_REQUEST_PROFILES.repository_patch_set).toMatchObject({
      intent: "apply repo patch set",
      allowed_input_keys: ["patches", "message", "summary", "expected_head_sha", "dry_run"],
    });
  });

    it("uses Main compact activity after the first workflow status read", () => {
    const incident = PREVENTED_CLIENT_BLOCKS.find((item) => item.id === "public_second_workflow_status_request");
    expect(incident?.safe_profile_id).toBe("workflow_run_list");
    expect(buildClientSafeGatewayRequest("workflow_run_list", { limit: 4 })).toMatchObject({ intent: "list github workflow runs" });
        expect(CLIENT_SAFETY_POLICIES.find((policy) => policy.id === "no_identical_blocked_retry")?.summary).toContain("workflow_terminal_watch");
    expect(CLIENT_SAFETY_GATEWAY_DESCRIPTION).toContain("workflow_terminal_watch");
  });

    it("uses one terminal watch after the compact activity read", () => {
    const incident = PREVENTED_CLIENT_BLOCKS.find((item) => item.id === "public_repeated_workflow_activity_request");
    expect(incident?.safe_profile_id).toBe("workflow_terminal_watch");
    expect(buildClientSafeGatewayRequest("workflow_terminal_watch", { run_id: 1, wait_seconds: 60 })).toMatchObject({
      intent: "get github workflow run",
      inputs: { run_id: 1, wait_seconds: 60 },
    });
  });

  it("uses Recovery workflow activity when strategy-contract wording blocks the main list", () => {
    const incident = PREVENTED_CLIENT_BLOCKS.find((item) => item.id === "public_growth_mission_workflow_list_wording");
    expect(incident?.safe_profile_id).toBe("recovery_workflow_run_list");
    expect(CLIENT_SAFE_REQUEST_PROFILES.recovery_workflow_run_list).toMatchObject({
      surface: "recovery_plane",
      allowed_input_keys: ["limit"],
    });
    expect(() => buildClientSafeGatewayRequest("recovery_workflow_run_list", { limit: 3 })).toThrow(
      "client_safe_request_external_surface:recovery_workflow_run_list",
    );
  });

    it("fails closed when the centralized registry is inconsistent", () => {
    expect(validateClientSafetyRegistry()).toEqual({ ok: true, errors: [] });
    expect(() => assertClientSafetyRegistry()).not.toThrow();
  });

  it("returns the mandatory client-safety receipt for every startup response", () => {
    expect(getClientSafetyRegistrySummary()).toMatchObject({
            registry_version: "client-safe-requests-v7",
      canonical_location: "lensically-worker/src/systemDirectory/clientSafeRequests.ts",
      registry_valid: true,
      intake_contract_version: "client-block-intake-v1",
      intake_mandatory: true,
            resume_allowed_only_after: "prevention_validation_exact_head_release_and_live_verification",
                        prevented_client_block_count: 37,
                                                      safe_request_profile_count: 28,
      universal_policy_count: 8,
      migrated_legacy_rule_count: 8,
    });
        expect((getClientSafetyRegistrySummary().required_sequence as string[]).at(-1)).toBe("close_incident");
    expect(getClientSafetyRegistrySummary().required_sequence).toEqual(expect.arrayContaining([
      "generalize_shared_cause", "lock_prevention_rule", "verify_live", "resume_original_objective", "record_autonomy_dividend",
    ]));
  });

        it("keeps Worker deployment on the Main verified marker path", () => {
    expect(resolveLensicallySystemDirectory("Deploy the main Worker release.")).toMatchObject({
      entry_id: "deployment.main_worker",
      recommended_next_planes: ["engineering"],
      hard_gates: expect.arrayContaining(["Main release markers require a verified repository head and passing validation."]),
    });
    expect(CLIENT_SAFE_REQUEST_PROFILES.worker_release_dispatch).toMatchObject({ surface: "recovery_plane" });
  });

    it("falls back to the original semantic route when a directory hint target is unavailable", () => {
    const tools: MandatoryExecutionToolDefinition[] = [{
      name: "readMcpToolDefinition",
      title: "Read capability definition",
      description: "Read one compact internal capability definition.",
      inputSchema: { type: "object", properties: { tool_name: { type: "string" } }, required: ["tool_name"] },
    }];
        expect(prepareSourceDefinedDirectEngineeringCall(
      "read capability definition",
      "Read the compact workflow activity capability definition.",
      { capability: "workflow activity listing" },
      tools,
    )).toMatchObject({
      ok: true,
      tool_name: "readMcpToolDefinition",
      arguments: { tool_name: "listGitHubWorkflowRuns" },
      map_execution: { system_directory: { route_applied: false } },
    });
    expect(prepareSourceDefinedDirectEngineeringCall(
      "read capability definition",
      "Read the compact repository patch-set capability definition.",
      { capability: "repository patch set" },
      tools,
    )).toMatchObject({
      ok: true,
      tool_name: "readMcpToolDefinition",
      arguments: { tool_name: "applyRepoPatchSet" },
    });
  });

  it("keeps successful known-path engineering work outside the defect gate", async () => {
    const finalized = await finalizeMandatoryExecutionMapCall(
      null as unknown as D1Database,
      { action_intent: "apply implementation", mode: "source_defined_direct_engineering" },
      "applyRepoPatchSet",
      {},
      { ok: true },
      [],
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(finalized).toMatchObject({ objective_may_resume: true, failure: null });
    expect(finalized).not.toHaveProperty("defect_generalization_gate");
  });

  it("requires a targeted sibling scan for stale duplicated assumptions", () => {
    expect(classifyDefectForGeneralization("repair version validation", {
      ok: false,
      error: "stale hardcoded version literal in an assertion",
    })).toMatchObject({
      defect_class: "duplicated_assumption",
      sibling_scan_required: true,
      prevention_disposition: "targeted_sibling_scan_required_before_local_fix",
      local_fix_closure_allowed: false,
    });
  });

  it("keeps isolated and external failures bounded", () => {
    expect(classifyDefectForGeneralization("repair one parser branch", { ok: false, error: "single malformed fixture" })).toMatchObject({
      defect_class: "isolated",
      sibling_scan_required: false,
      prevention_disposition: "bounded_local_fix",
    });
    expect(classifyDefectForGeneralization("check validation", { ok: false, error: "temporary upstream timeout" })).toMatchObject({
      defect_class: "external_transient",
      sibling_scan_required: false,
      prevention_disposition: "bounded_external_handling",
    });
  });

  it("blocks resume when an engineering result contains an explicit contract contradiction", async () => {
    const finalized = await finalizeMandatoryExecutionMapCall(
      null as unknown as D1Database,
      { action_intent: "verify engineering contract", mode: "source_defined_direct_engineering" },
      "inspectMcpFailure",
      {},
      { ok: true, contradiction: true, error: "schema mismatch" },
      [],
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(finalized).toMatchObject({
      map_state: "source_defined_direct_failed",
      objective_may_resume: false,
      defect_generalization_gate: {
        defect_class: "contract_drift",
        sibling_scan_required: true,
        prevention_disposition: "targeted_sibling_scan_required_before_local_fix",
      },
      failure: {
        defect_class: "contract_drift",
        sibling_scan_required: true,
      },
    });
  });

  it("routes multi-stage engineering requests to implementation before final verification", async () => {
    const tools: MandatoryExecutionToolDefinition[] = [
      {
        name: "applyRepoPatchSet",
        title: "Apply implementation",
        description: "Apply one coherent repository change set.",
        inputSchema: { type: "object", properties: { patches: { type: "array" } }, required: ["patches"] },
      },
      {
        name: "verifyDeployedMcpVersion",
        title: "Verify live deployment",
        description: "Verify the deployed MCP version.",
        inputSchema: { type: "object", properties: {} },
      },
    ];
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      {
        intent: "implement the gateway change, release it, and verify live deployment",
        objective: "Complete the engineering change from implementation through verification.",
        inputs: { patches: [] },
      },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(prepared).toMatchObject({ ok: true, tool_name: "applyRepoPatchSet", arguments: { patches: [] } });
  });

  it("promotes multi-stage architecture work to implementation before release", async () => {
    const tools: MandatoryExecutionToolDefinition[] = [{
      name: "applyRepoPatchSet",
      title: "Apply implementation",
      description: "Apply one coherent repository change set.",
      inputSchema: { type: "object", properties: { patches: { type: "array" } }, required: ["patches"] },
    }];
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      {
        objective: "Implement, validate, release, and live-verify the approved architecture.",
        intent: "Apply the approved prevention architecture end to end and complete the production release.",
        inputs: { patches: [] },
      },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
    expect(prepared).toMatchObject({
      ok: true,
      tool_name: "applyRepoPatchSet",
      map_execution: {
        winning_path_promotion: {
          id: "multi_stage_engineering_implementation_first",
          losing_path_prohibited: true,
          surface: "main_gateway",
        },
      },
    });
  });

    it("keeps bounded large repository patch sets on the Main gateway", async () => {
    const tools: MandatoryExecutionToolDefinition[] = [{
      name: "applyRepoPatchSet",
      title: "Apply atomic repo patch set",
      description: "Apply bounded exact replacements atomically.",
      inputSchema: {
        type: "object",
        properties: { patches: { type: "array" }, message: { type: "string" } },
        required: ["patches", "message"],
      },
    }];
    const prepared = await prepareMandatoryExecutionMapCall(
      null as unknown as D1Database,
      {
        objective: "Implement the repository architecture correction.",
        intent: "Apply the approved repository implementation.",
                inputs: {
          patches: [{ path: "AGENTS.md", find: "old", replace: "x".repeat(3200) }],
          message: "Apply bounded Main patch set",
        },
      },
      tools,
      { signPermit: async () => "unused", verifyPermit: async () => null },
    );
        expect(prepared).toMatchObject({
      ok: true,
      tool_name: "applyRepoPatchSet",
      map_execution: {
        winning_path_promotion: {
          id: "large_repository_mutation_main_atomic",
          losing_path_prohibited: true,
          surface: "main_gateway",
        },
      },
    });
  });

  it("blocks incident closure until the winning path is promoted and enforced", () => {
    expect(evaluatePreventableIncidentClosure({
      cause_classified: true,
      winning_path_proven: true,
      scope_determined: true,
      original_objective_completed: true,
    })).toEqual({
      closure_allowed: false,
      missing_steps: ["winning_path_promoted", "losing_path_prohibited", "enforcement_installed", "regression_passed"],
    });
    expect(evaluatePreventableIncidentClosure({
      cause_classified: true,
      winning_path_proven: true,
      scope_determined: true,
      winning_path_promoted: true,
      losing_path_prohibited: true,
      enforcement_installed: true,
      regression_passed: true,
      original_objective_completed: true,
    })).toEqual({ closure_allowed: true, missing_steps: [] });
  });

  it("validates active winning paths and preserves superseded history", () => {
    expect(validateWinningPathPromotions()).toEqual({ ok: true, errors: [] });
    const original = WINNING_PATH_PROMOTIONS[0];
    expect(validateWinningPathPromotions([
      { ...original, id: "older_path", status: "superseded" },
      { ...original, id: "newer_path", supersedes: "older_path" },
    ])).toEqual({ ok: true, errors: [] });
  });

  it("keeps unknown, isolated, and transient terrain available for bounded discovery", () => {
    expect(resolvePromotedWinningPath("repair one malformed fixture", "Handle one isolated parser branch.", {})).toBeNull();
    expect(resolvePromotedWinningPath("check temporary upstream timeout", "Retry bounded external validation.", {})).toBeNull();
    expect(resolvePromotedWinningPath("explore a new account workflow", "No proven route exists yet.", {})).toBeNull();
  });

  it("records the bounded integration-test timeout winning path", () => {
    expect(WINNING_PATH_PROMOTIONS.find((promotion) => promotion.id === "bounded_integration_test_timeout")).toMatchObject({
      defect_class: "contract_drift",
      scope: "component",
      winning_path: { surface: "source_control" },
      enforcement_point: "Focused integration test definition and deterministic shard regression.",
    });
  });

  it("promotes uncertain scheduled publishing to quarantine instead of retry", () => {
    const path = resolvePromotedWinningPath(
      "repair the scheduler retry after a duplicate post",
      "Prevent another double post when the posting state is uncertain.",
      {},
    );
    expect(path).toMatchObject({
      id: "scheduled_publish_unknown_state_quarantine",
      defect_class: "known_recurrence",
      scope: "universal",
      winning_path: { surface: "runtime_guard" },
    });
    expect(path?.losing_path).toContain("Return a scheduled post to approved");
    expect(path?.winning_path.procedure.join(" ")).toContain("explicit reconciliation");
  });

  it("keeps Operator MCP version metadata single-source", () => {
    const path = WINNING_PATH_PROMOTIONS.find((promotion) => promotion.id === "operator_mcp_version_single_source");
    expect(path).toMatchObject({
      defect_class: "duplicated_assumption",
      winning_path: { surface: "source_control" },
      enforcement_point: "Release preflight.",
    });
    expect(path?.winning_path.procedure.join(" ")).toContain("OPERATOR_MCP_VERSION");
  });

  it("infers the internal workflow-list capability from semantic public language", () => {
    const tools: MandatoryExecutionToolDefinition[] = [{
      name: "readMcpToolDefinition",
      title: "Read capability definition",
      description: "Read one compact internal capability definition.",
      inputSchema: {
        type: "object",
        properties: { tool_name: { type: "string" } },
        required: ["tool_name"],
      },
    }];
        const prepared = prepareSourceDefinedDirectEngineeringCall(
      "read capability definition",
      "Read the compact workflow activity capability definition.",
      { capability: "workflow activity listing" },
      tools,
    );
        expect(prepared).toMatchObject({
      ok: true,
      tool_name: "readMcpToolDefinition",
      arguments: { tool_name: "listGitHubWorkflowRuns" },
    });
  });

  it("enforces the continuous-hardening lifecycle and closure proof", () => {
    expect(CONTINUOUS_HARDENING_VERSION).toBe("continuous-hardening-loop-v1");
    expect(HARDENING_ALLOWED_TRANSITIONS.detected).toEqual(["contained"]);
    expect(validateHardeningTransition("detected", "generalized")).toMatchObject({ allowed: false });
    const proof = {
      root_cause: "Typed public and internal contracts diverged.",
      generalized_cause: "Semantic profiles must compile to exact typed handler arguments.",
      prevention_rule_id: "typed_profile_exact_contract",
      regression_test_ids: ["systemDirectory:continuous-hardening"],
      tested_sha: "abc123",
      deployment_id: "deployment-1",
      live_verification: { ok: true },
      resume_result: { ok: true },
      autonomy_dividend: { owner_intervention_removed: true },
    };
    expect(validateHardeningTransition("released", "live_verified", proof)).toEqual({ allowed: true, errors: [] });
    expect(validateHardeningTransition("resumed", "closed", proof)).toEqual({ allowed: true, errors: [] });
    expect(validateHardeningTransition("resumed", "closed", { ...proof, autonomy_dividend: null })).toMatchObject({ allowed: false });
  });

  it("registers typed hardening and repository inspection profiles", () => {
    expect(CLIENT_SAFE_REQUEST_PROFILES.client_block_intake.allowed_input_keys).toContain("resume_capsule");
    expect(CLIENT_SAFE_REQUEST_PROFILES.hardening_transition.allowed_input_keys).toContain("prevention_rule_id");
    expect(CLIENT_SAFE_REQUEST_PROFILES.repository_symbol_search.allowed_input_keys).toEqual(["path", "symbol", "limit"]);
    expect(CLIENT_SAFE_REQUEST_PROFILES.repository_file_read.allowed_input_keys).toContain("max_lines");
    expect(buildClientSafeGatewayRequest("repository_symbol_search", { path: "lensically-worker/src/index.ts", symbol: "validateHardeningTransition", limit: 5 })).toMatchObject({
      intent: "search repository symbol",
      inputs: { path: "lensically-worker/src/index.ts", symbol: "validateHardeningTransition", limit: 5 },
    });
  });
});
