import { describe, expect, it } from "vitest";
import { prepareSourceDefinedDirectEngineeringCall, type MandatoryExecutionToolDefinition } from "../src/mandatoryExecutionMap";
import {
      assertClientSafetyRegistry,
  buildClientSafeGatewayRequest,
  CLIENT_BLOCK_INTAKE_CONTRACT,
  CLIENT_SAFE_REQUEST_PROFILES,
  CLIENT_SAFETY_CANONICAL_LOCATION,
  CLIENT_SAFETY_LEGACY_MIGRATIONS,
  CLIENT_SAFETY_POLICIES,
    createSystemDirectoryIndex,
  LENSICALLY_SYSTEM_DIRECTORY_ENTRIES,
  getClientSafetyRegistrySummary,
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
    expect(resolveLensicallySystemDirectory("Deploy the main Worker release.")).toMatchObject({ entry_id: "deployment.main_worker", recommended_next_planes: ["recovery"] });
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

                    it("routes deployment exclusively through the Recovery surface", () => {
    expect(CLIENT_SAFE_REQUEST_PROFILES.worker_release_dispatch).toMatchObject({ surface: "recovery_plane", allowed_input_keys: [] });
    expect(() => buildClientSafeGatewayRequest("worker_release_dispatch")).toThrow("client_safe_request_external_surface:worker_release_dispatch");
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
            "public_repeated_identical_status_poll",
            "public_zero_input_main_workflow_request",
      "public_policy_repository_search_terms",
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

  it("routes free-text source discovery exclusively through Recovery", () => {
    expect(CLIENT_SAFE_REQUEST_PROFILES.repository_search).toMatchObject({ surface: "recovery_plane" });
    expect(() => buildClientSafeGatewayRequest("repository_search", { query: "follower attribution behavior", max_results: 5 })).toThrow("client_safe_request_external_surface:repository_search");
  });

  it("uses compact recent activity after one workflow-status read", () => {
    const incident = PREVENTED_CLIENT_BLOCKS.find((item) => item.id === "public_repeated_identical_status_poll");
    expect(incident?.safe_profile_id).toBe("workflow_run_list");
    expect(buildClientSafeGatewayRequest("workflow_run_list", { limit: 4 })).toMatchObject({ intent: "list github workflow runs" });
  });

    it("fails closed when the centralized registry is inconsistent", () => {
    expect(validateClientSafetyRegistry()).toEqual({ ok: true, errors: [] });
    expect(() => assertClientSafetyRegistry()).not.toThrow();
  });

  it("returns the mandatory client-safety receipt for every startup response", () => {
    expect(getClientSafetyRegistrySummary()).toMatchObject({
      registry_version: "client-safe-requests-v2",
      canonical_location: "lensically-worker/src/systemDirectory/clientSafeRequests.ts",
      registry_valid: true,
      intake_contract_version: "client-block-intake-v1",
      intake_mandatory: true,
      resume_allowed_only_after: "registry_validation_and_live_deployment",
                                    prevented_client_block_count: 10,
      safe_request_profile_count: 7,
      universal_policy_count: 8,
      migrated_legacy_rule_count: 8,
    });
    expect((getClientSafetyRegistrySummary().required_sequence as string[]).at(-1)).toBe("resume_original_objective");
  });

      it("keeps Worker deployment outside the main router", () => {
    expect(CLIENT_SAFE_REQUEST_PROFILES.worker_release_dispatch).toMatchObject({ surface: "recovery_plane" });
    expect(resolveLensicallySystemDirectory("Deploy the main Worker release.")).toMatchObject({
      entry_id: "deployment.main_worker",
      recommended_next_planes: ["recovery"],
      hard_gates: expect.arrayContaining(["Deployment requests never use the main public gateway."]),
    });
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
});
