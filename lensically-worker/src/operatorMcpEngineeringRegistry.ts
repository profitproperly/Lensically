import {
  CLIENT_SAFETY_BRAND_KEY_DESCRIPTION,
} from "./systemDirectory";
import type { OperatorMcpToolDefinition } from "./operatorMcpToolDefinitions";

export const OPERATOR_MCP_ENGINEERING_TOOL_NAMES = [
    "getOperatorSessionMap",
  "getOperatorKnowledge",
  "getOperatorLiveState",
  "getEngineeringContinuation",
  "getDatabaseSchemaState",
  "executeOperatorReadAction",
  "executeOperatorAction",
  "executeOperatorCaseAction",
  "closeOperatorAction",
  "engineeringPrecheck",
  "getEngineeringAccessState",
  "recordHardeningIncident",
  "getHardeningStatus",
  "advanceHardeningIncident",
  "recordOperationalObservation",
  "getOperatorWorkState",
  "intakeOperatorWork",
  "advanceOperatorWork",
  "listRepoFiles",
  "searchRepoFiles",
  "readRepoFile",
  "getRepoStatus",
  "applyRepoTextPatch",
  "applyRepoPatchSet",
  "startRepoFileWrite",
  "appendRepoFileChunk",
  "commitRepoFileWrite",
  "createRepoFile",
    "createGitHubRepository",
  "upsertGitHubRepositoryFile",
  "operateGitHubRepositories",
  "createCloudflarePagesProject",
  "deployCloudflarePagesProject",
  "deleteRepoFile",
  "listGitHubWorkflowRuns",
  "runGitHubWorkflow",
  "getGitHubWorkflowRun",
  "verifyDeployedMcpVersion",
  "listEngineeringAudit",
] as const;

export type OperatorMcpEngineeringToolName = typeof OPERATOR_MCP_ENGINEERING_TOOL_NAMES[number];

export const OPERATOR_ENGINEERING_WORKFLOW_ID = "lensically-engineering.yml";

export function resolveOperatorEngineeringWorkflowId(workflowId: unknown): string | null {
  const raw = typeof workflowId === "string" ? workflowId.trim() : "";
  if (!raw) return null;
  if (raw.toLowerCase() === "push-validation" || raw.toLowerCase() === OPERATOR_ENGINEERING_WORKFLOW_ID) {
    return OPERATOR_ENGINEERING_WORKFLOW_ID;
  }
  return raw;
}

const OPERATOR_ENGINEERING_WORKFLOW_TASKS = new Set([
  "typecheck",
  "operator-smoke",
  "operator-tests",
  "system-directory-tests",
  "threads-publish-tests",
  "human-free-tests",
  "architecture-baseline",
  "worker-deploy",
]);
const OPERATOR_ENGINEERING_WORKFLOW_INPUT_KEYS = new Set(["task", "release_id", "release_sha"]);

export function operatorEngineeringWorkflowDispatchInputsValid(
  workflowId: unknown,
  inputs: Record<string, unknown>,
): boolean {
  if (resolveOperatorEngineeringWorkflowId(workflowId) !== OPERATOR_ENGINEERING_WORKFLOW_ID) return true;
  if (Object.keys(inputs).some((key) => !OPERATOR_ENGINEERING_WORKFLOW_INPUT_KEYS.has(key))) return false;
  if (inputs.task !== undefined && (typeof inputs.task !== "string" || !OPERATOR_ENGINEERING_WORKFLOW_TASKS.has(inputs.task))) return false;
  if (inputs.release_id !== undefined && typeof inputs.release_id !== "string") return false;
  if (inputs.release_sha !== undefined && (typeof inputs.release_sha !== "string" || (inputs.release_sha !== "" && !/^[a-fA-F0-9]{40}$/.test(inputs.release_sha)))) return false;
  if (inputs.task === "worker-deploy" && (typeof inputs.release_sha !== "string" || !/^[a-fA-F0-9]{40}$/.test(inputs.release_sha))) return false;
  return true;
}

const BRAND_KEY_SCHEMA = {
  type: "string",
  enum: ["manifest_mental", "manifestmental", "opmg_deadman", "opmgdeadman", "vectrix"],
  description: CLIENT_SAFETY_BRAND_KEY_DESCRIPTION,
};

const REPO_PATH_SCHEMA = {
  type: "string",
  description: "Repository-relative path. Keep narrow, for example lensically-worker/src/index.ts.",
};

export const OPERATOR_MCP_ENGINEERING_TOOLS: OperatorMcpToolDefinition[] = [
    {
    name: "getOperatorSessionMap",
    title: "Get operator session map",
    description: "Step 1 of the canonical Operator lifecycle. Load only the compact recursive session map, canonical node pointers, lifecycle sequence, and signed session-map token. It does not load durable knowledge or live task state.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
        {
    name: "getOperatorKnowledge",
    title: "Get operator knowledge",
    description: "Step 2 of the canonical Operator lifecycle. Accept one closed typed planned action from the Step-1 map, derive exactly the durable knowledge that action requires, and bind the normalized action server-side for the remaining lifecycle. Callers do not choose knowledge nodes.",
    inputSchema: {
      type: "object",
      properties: {
        session_map_token: { type: "string", minLength: 16 },
        planned_action: {
          type: "object",
          description: "Generated at runtime as the closed typed preparation action union. The normalized action is stored server-side and is not replayed by Steps 4 or 5.",
        },
      },
      required: ["session_map_token", "planned_action"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "getOperatorLiveState",
    title: "Get operator live state",
    description: "Step 3 of the canonical Operator lifecycle. Derive exactly the mutable live-state scopes required by the action already bound into Step 2. The optional exact Step-2 planned_action exists only for preparation-stage reference recovery; successful Step 3 carries the verified action forward server-side. Callers do not choose scopes or account targets.",
    inputSchema: {
      type: "object",
      properties: {
        knowledge_token: { type: "string", minLength: 16 },
        planned_action: { type: "object", description: "Repeat the exact typed Step-2 planned action. Runtime composition replaces this placeholder with the same closed action union used by Steps 2 and 4." },
      },
      required: ["knowledge_token"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "getEngineeringContinuation",
    title: "Get engineering continuation",
    description: "Read the sole canonical root ENGINEERING_CONTINUATION.md ledger before deciding what Lensically work to resume. It contains every accepted incomplete job, explicit precedence, exactly one active job, and exactly one current action; chat, D1 work state, and action-closure receipts cannot override it.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "getDatabaseSchemaState",
    title: "Get database schema state",
    description: "Verify one expected D1 table and a bounded set of expected columns through read-only existence probes. Canonical enumeration belongs to versioned repository migrations, not runtime catalog access.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", minLength: 1, maxLength: 120, pattern: "^[A-Za-z_][A-Za-z0-9_]*$" },
        column_names: { type: "array", maxItems: 50, items: { type: "string", minLength: 1, maxLength: 120, pattern: "^[A-Za-z_][A-Za-z0-9_]*$" }, default: [] },
      },
      required: ["table_name"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "recordHardeningIncident",
    title: "Record hardening incident",
    description: "Open or reuse one continuous-hardening incident for a blocked or contradictory operation.",
    inputSchema: {
      type: "object",
      properties: {
        boundary: { type: "string", enum: ["client", "gateway", "routing", "server", "database", "deployment", "quality", "efficiency", "external"] },
        blocked_profile_id: { type: "string" },
        field_names: { type: "array", items: { type: "string" } },
        request_fingerprint: { type: "string" },
        error_category: { type: "string" },
        payload_size: { type: "integer", minimum: 0 },
        operation_class: { type: "string" },
        expected_outcome: {},
        observed_outcome: {},
        resume_capsule: { type: "object", additionalProperties: true },
      },
      required: ["boundary", "blocked_profile_id", "error_category"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "getHardeningStatus",
    title: "Get hardening status",
    description: "Read continuous-hardening incidents and transition evidence.",
    inputSchema: { type: "object", properties: { incident_id: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 50 } }, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "advanceHardeningIncident",
    title: "Advance hardening incident",
    description: "Advance exactly one incident state with required proof.",
    inputSchema: {
      type: "object",
      properties: {
        incident_id: { type: "string" },
        target_state: { type: "string", enum: ["next", "contained", "classified", "reproduced", "generalized", "repaired", "prevention_locked", "validated", "released", "live_verified", "resumed", "closed"] },
        evidence: { type: "object", additionalProperties: true },
        root_cause: { type: "string" },
        generalized_cause: { type: "string" },
        prevention_rule_id: { type: "string" },
        regression_test_ids: { type: "array", items: { type: "string" } },
        tested_sha: { type: "string" },
        deployment_id: { type: "string" },
        live_verification: { type: "object", additionalProperties: true },
        resume_result: { type: "object", additionalProperties: true },
                autonomy_dividend: { type: "object", additionalProperties: true },
        efficiency_result: { type: "object", additionalProperties: true },
        dry_run: { type: "boolean" },
      },
      required: ["incident_id", "target_state"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "recordOperationalObservation",
    title: "Record operational observation",
    description: "Record compact execution cost and progress evidence for autonomous efficiency detection.",
    inputSchema: {
      type: "object",
      properties: {
        operation_id: { type: "string" },
        incident_id: { type: "string" },
        profile_id: { type: "string" },
        capability: { type: "string" },
        outcome: { type: "string" },
        duration_ms: { type: "integer", minimum: 0 },
        call_count: { type: "integer", minimum: 0 },
        external_requests: { type: "integer", minimum: 0 },
        repeated_fingerprint_count: { type: "integer", minimum: 0 },
        progress_checkpoint: { type: "string" },
        metadata: { type: "object", additionalProperties: true },
      },
      required: ["capability", "outcome"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "getOperatorWorkState",
    title: "Get operator work state",
    description: "Read the legacy D1 work-state telemetry and historical intake ledger. This surface is non-authoritative and cannot establish, reorder, or resume work; call getEngineeringContinuation for canonical precedence and the current action.",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["queued", "deferred", "interrupting", "completed", "merged", "rejected"] }, limit: { type: "integer", minimum: 1, maximum: 100 } }, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "intakeOperatorWork",
    title: "Intake operator work",
    description: "Persist one proposed work item into the non-authoritative D1 intake mirror. This does not accept, activate, or order canonical work; update ENGINEERING_CONTINUATION.md before execution.",
    inputSchema: {
      type: "object",
      properties: {
        work_key: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        severity: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
        prerequisite_for_active_outcome: { type: "boolean" },
        irreversible_rework_if_deferred: { type: "boolean" },
        duplicate_of: { type: "string" },
        conflicts_with_mission: { type: "boolean" },
        dependencies: { type: "array", items: { type: "string" } },
        completion_condition: { type: "string" },
        execution_order: { type: "integer", minimum: 1 },
      },
      required: ["work_key", "title", "summary", "completion_condition"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "advanceOperatorWork",
    title: "Advance operator work",
    description: "Update the non-authoritative D1 work telemetry mirror. This cannot change canonical precedence or continuation; ENGINEERING_CONTINUATION.md remains the sole authority.",
    inputSchema: {
      type: "object",
      properties: {
        work_key: { type: "string" },
        status: { type: "string", enum: ["queued", "deferred", "interrupting", "completed", "merged", "rejected"] },
        evidence: { type: "array", items: { type: "string" } },
        next_action: { type: "string" },
        complete_active_outcome: { type: "boolean" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["work_key", "status"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
      {
    name: "executeOperatorReadAction",
    title: "Execute read-only operator action",
    description: "Read-only Step 4 of the canonical Operator lifecycle. Execute exactly one server-bound read-only action prepared in Steps 2 and 3 by replaying the exact execution_descriptor from Step 3. The dispatcher rejects any mutation-bound live-state token on this gateway.",
    inputSchema: {
      type: "object",
      properties: {
        live_state_token: { type: "string", minLength: 16 },
      },
      required: ["live_state_token"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
      {
    name: "executeOperatorAction",
    title: "Execute mutating operator action",
    description: "Mutating Step 4 of the canonical Operator lifecycle. Execute exactly one server-bound mutating action prepared in Steps 2 and 3 by replaying the exact execution_descriptor from Step 3. Read-only actions must use executeOperatorReadAction so client-visible tool metadata matches the prepared effect before dispatch.",
    inputSchema: {
      type: "object",
      properties: {
        live_state_token: { type: "string", minLength: 16 },
      },
      required: ["live_state_token"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "closeOperatorAction",
    title: "Close operator action",
    description: "Step 5 of the canonical Operator lifecycle. Consume the server-bound Step-4 execution proof, require verification evidence, preserve prevention obligations, and leave one explicit next checkpoint before closure. The executed action is not replayed through the client.",
    inputSchema: {
      type: "object",
      properties: {
        action_execution_token: { type: "string", minLength: 16 },
        verification: {
          type: "object",
          properties: {
            verified: { type: "boolean" },
            evidence: { type: "array", minItems: 1, maxItems: 20, items: { type: "string", minLength: 1, maxLength: 1000 } },
            next_action: { type: "string", minLength: 1, maxLength: 2000 },
            durable_learning: { type: "string", maxLength: 4000 },
            prevention_required: { type: "boolean" },
          },
          required: ["verified", "evidence", "next_action"],
          additionalProperties: false,
        },
      },
      required: ["action_execution_token", "verification"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "engineeringPrecheck",
    title: "Engineering precheck",
    description: "Load compact source-control, MCP, ops-memory, failure-pattern, gate, requirement, and runtime state before engineering work.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "getEngineeringAccessState",
    title: "Get engineering access state",
    description: "Report GitHub/Cloudflare engineering access status without exposing secret values.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "listRepoFiles",
    title: "List repo files",
    description: "List GitHub repository files from the default branch with optional prefix filtering.",
    inputSchema: { type: "object", properties: { prefix: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 500 } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "searchRepoFiles",
    title: "Search repo files",
    description: "Search one known repository file using a bounded case-insensitive line scan. Returns verified complete matches for that file without GitHub code-search dependence.",
    inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 500 }, prefix: REPO_PATH_SCHEMA, limit: { type: "integer", minimum: 1, maximum: 50 } }, required: ["query", "prefix"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "readRepoFile",
    title: "Read repo file",
    description: "Read one GitHub repository file from the default branch, with optional line bounds.",
    inputSchema: { type: "object", properties: { path: REPO_PATH_SCHEMA, start_line: { type: "integer", minimum: 1 }, max_lines: { type: "integer", minimum: 1, maximum: 400 } }, required: ["path"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "getRepoStatus",
    title: "Get repo status",
    description: "Read the configured GitHub repo, branch, latest commit SHA, bounded check runs, commit statuses, and Cloudflare validation state.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "applyRepoTextPatch",
    title: "Apply repo text patch",
    description: "Apply one exact find/replace patch to a GitHub repo file and commit directly to the configured branch.",
    inputSchema: { type: "object", properties: { path: REPO_PATH_SCHEMA, find: { type: "string" }, replace: { type: "string" }, message: { type: "string" }, summary: { type: "string" } }, required: ["path", "find", "replace", "message"], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "applyRepoPatchSet",
    title: "Apply atomic repo patch set",
    description: "Apply up to 20 exact replacements across multiple GitHub repo files and create one commit only after every replacement validates.",
    inputSchema: {
      type: "object",
      properties: {
        patches: { type: "array", minItems: 1, maxItems: 20, items: { type: "object", properties: { path: REPO_PATH_SCHEMA, find: { type: "string" }, replace: { type: "string" } }, required: ["path", "find", "replace"], additionalProperties: false } },
        message: { type: "string" },
        summary: { type: "string" },
        expected_head_sha: { type: "string" },
        dry_run: { type: "boolean" },
      },
      required: ["patches", "message"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "startRepoFileWrite",
    title: "Start repo file write",
    description: "Start a chunked file write session for a GitHub repo path.",
    inputSchema: { type: "object", properties: { path: REPO_PATH_SCHEMA, mode: { type: "string", enum: ["replace", "create"] }, message: { type: "string" }, summary: { type: "string" } }, required: ["path", "mode", "message"], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "appendRepoFileChunk",
    title: "Append repo file chunk",
    description: "Append a compact text chunk to a pending repo file write session.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" }, chunk: { type: "string" } }, required: ["session_id", "chunk"], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "commitRepoFileWrite",
    title: "Commit repo file write",
    description: "Commit a pending chunked file write to GitHub.",
    inputSchema: { type: "object", properties: { session_id: { type: "string" } }, required: ["session_id"], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "createRepoFile",
    title: "Create repo file",
    description: "Create a small GitHub repo file directly. Use chunked writes for larger files.",
    inputSchema: { type: "object", properties: { path: REPO_PATH_SCHEMA, content: { type: "string" }, message: { type: "string" }, summary: { type: "string" } }, required: ["path", "content", "message"], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "createGitHubRepository",
    title: "Create GitHub repository",
    description: "Create or idempotently reconcile one repository under the configured GitHub owner. Returns only compact repository metadata and never returns credentials.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 100, pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$" },
        description: { type: "string", maxLength: 350 },
        visibility: { type: "string", enum: ["private", "public"], default: "private" },
        initialize_with_readme: { type: "boolean", default: true },
        operation_id: { type: "string", minLength: 1, maxLength: 120 },
      },
      required: ["name", "operation_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "upsertGitHubRepositoryFile",
    title: "Upsert GitHub repository file",
    description: "Create or replace one bounded text file in a named repository under the configured GitHub owner, with idempotent content reconciliation and compact audit output.",
    inputSchema: {
      type: "object",
      properties: {
        repository: { type: "string", minLength: 1, maxLength: 100, pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$" },
        path: REPO_PATH_SCHEMA,
        content: { type: "string", maxLength: 100000 },
        message: { type: "string", minLength: 1, maxLength: 200 },
        branch: { type: "string", minLength: 1, maxLength: 120, pattern: "^[A-Za-z0-9._/-]+$", default: "main" },
        operation_id: { type: "string", minLength: 1, maxLength: 120 },
      },
      required: ["repository", "path", "content", "message", "operation_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
    {
    name: "operateGitHubRepositories",
    title: "Operate GitHub repositories",
    description: "List every repository available to the configured GitHub token and perform bounded read, search, file mutation, and workflow operations against any explicitly named accessible repository. Bare repository names use the configured owner; owner/repository targets are also accepted. Destructive file deletion requires the owner's exact approval.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["list_repositories", "get_repository", "list_files", "read_file", "search_file", "upsert_file", "patch_file", "delete_file", "list_workflow_runs", "dispatch_workflow", "get_workflow_run"] },
        repository: { type: "string", minLength: 1, maxLength: 220, pattern: "^[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?$" },
        branch: { type: "string", minLength: 1, maxLength: 120, pattern: "^[A-Za-z0-9._/-]+$" },
                path: { ...REPO_PATH_SCHEMA, description: "Exact repository-relative file path for read, search, upsert, patch, or delete operations." },
                prefix: { type: "string", maxLength: 500, description: "Directory prefix for list_files only. For search_file, omit prefix and pass the exact repository file path in path; directory-wide search is not supported." },
        query: { type: "string", maxLength: 500 },
        content: { type: "string", maxLength: 100000 },
        find: { type: "string", maxLength: 100000 },
        replace: { type: "string", maxLength: 100000 },
        message: { type: "string", maxLength: 200 },
        workflow_id: { type: "string", maxLength: 200 },
        ref: { type: "string", maxLength: 120 },
        inputs: { type: "object", additionalProperties: true },
        run_id: { type: "integer", minimum: 1 },
        limit: { type: "integer", minimum: 1, maximum: 500 },
        start_line: { type: "integer", minimum: 1 },
        max_lines: { type: "integer", minimum: 1, maximum: 400 },
        operation_id: { type: "string", minLength: 1, maxLength: 120 },
        owner_response: { type: "string", maxLength: 8000, description: "Exact owner approval from the current conversation; required only for delete_file." },
      },
      required: ["operation"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  },
  {
    name: "createCloudflarePagesProject",
    title: "Create Cloudflare Pages project",
    description: "Dispatch an idempotent protected workflow to create or reconcile one Cloudflare Pages project without exposing Cloudflare credentials.",
    inputSchema: {
      type: "object",
      properties: {
        project_name: { type: "string", minLength: 1, maxLength: 58, pattern: "^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$" },
        production_branch: { type: "string", minLength: 1, maxLength: 120, pattern: "^[A-Za-z0-9._/-]+$", default: "main" },
        operation_id: { type: "string", minLength: 1, maxLength: 80 },
      },
      required: ["project_name", "operation_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "deployCloudflarePagesProject",
    title: "Deploy Cloudflare Pages project",
    description: "Dispatch a protected workflow that checks out one named public repository and deploys a bounded directory to an existing Cloudflare Pages project.",
    inputSchema: {
      type: "object",
      properties: {
        project_name: { type: "string", minLength: 1, maxLength: 58, pattern: "^[a-z0-9](?:[a-z0-9-]{0,56}[a-z0-9])?$" },
        repository: { type: "string", minLength: 1, maxLength: 100, pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$" },
        branch: { type: "string", minLength: 1, maxLength: 120, pattern: "^[A-Za-z0-9._/-]+$", default: "main" },
        directory: { type: "string", minLength: 1, maxLength: 200, default: "site" },
        operation_id: { type: "string", minLength: 1, maxLength: 80 },
      },
      required: ["project_name", "repository", "operation_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "deleteRepoFile",
    title: "Delete repo file",
    description: "Delete one GitHub repo file when explicitly requested by the owner. Include owner_response with the owner's exact approval so authorization is persisted before execution.",
    inputSchema: {
      type: "object",
      properties: {
        brand_key: BRAND_KEY_SCHEMA,
        path: REPO_PATH_SCHEMA,
        message: { type: "string" },
        owner_approval: { type: "string" },
        owner_response: { type: "string", description: "Exact owner approval from the current conversation." },
      },
      required: ["path", "message", "owner_approval"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: "listGitHubWorkflowRuns",
    title: "List GitHub workflow runs",
    description: "List recent GitHub Actions workflow runs compactly.",
    inputSchema: { type: "object", properties: { workflow_id: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "runGitHubWorkflow",
    title: "Run GitHub validation or release workflow",
    description: "Dispatch one configured Main validation task or one explicit exact-SHA Worker release.",
    inputSchema: {
      type: "object",
      properties: {
                task: { type: "string", enum: ["typecheck", "operator-smoke", "operator-tests", "system-directory-tests", "threads-publish-tests", "human-free-tests", "worker-deploy"] },
        release_id: { type: "string", maxLength: 80 },
        release_sha: { type: "string", pattern: "^[a-fA-F0-9]{40}$" },
        dry_run: { type: "boolean" },
      },
      required: ["task"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "getGitHubWorkflowRun",
    title: "Get GitHub workflow run",
    description: "Read one GitHub Actions workflow run, optionally waiting once for a terminal result.",
    inputSchema: { type: "object", properties: { run_id: { type: "integer" }, wait_seconds: { type: "integer", minimum: 0, maximum: 60 } }, required: ["run_id"], additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "verifyDeployedMcpVersion",
    title: "Verify deployed MCP version",
    description: "Verify the live deployed Lensically MCP endpoint version and tool count.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "listEngineeringAudit",
    title: "List engineering audit",
    description: "List compact audit entries for source edits, workflow dispatches, deploys, and memory updates.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 }, action: { type: "string" } }, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];
