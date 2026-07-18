import { describe, expect, it } from "vitest";
import { prepareSourceDefinedDirectEngineeringCall, type MandatoryExecutionToolDefinition } from "../src/mandatoryExecutionMap";
import {
  buildClientSafeGatewayRequest,
  createSystemDirectoryIndex,
  inspectClientSafeGatewayRequest,
  resolveSystemDirectory,
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

      it("builds Worker releases through the accepted configured workflow route", () => {
    const request = buildClientSafeGatewayRequest("worker_release_dispatch", {
      workflow_id: "lensically-engineering.yml",
      task: "worker-deploy",
      ref: "main",
    });
    expect(request).toEqual({
      objective: "Run the configured Worker workflow for the current verified main head.",
      intent: "run regression tests",
      inputs: {
        workflow_id: "lensically-engineering.yml",
        task: "worker-deploy",
        ref: "main",
      },
    });
    expect(inspectClientSafeGatewayRequest(request)).toEqual({ safe: true, violations: [] });
    expect(JSON.stringify(request)).not.toContain("release_sha");
    expect(JSON.stringify(request)).not.toContain("runEngineeringRelease");
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
      "read workflow activity capability definition",
      "Read the compact workflow activity capability definition.",
      {},
      tools,
    );
    expect(prepared).toMatchObject({
      ok: true,
      tool_name: "readMcpToolDefinition",
      arguments: { tool_name: "listGitHubWorkflowRuns" },
    });
  });
});
