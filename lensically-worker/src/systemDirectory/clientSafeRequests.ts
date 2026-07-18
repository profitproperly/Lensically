export const CLIENT_SAFE_REQUEST_REGISTRY_VERSION = "client-safe-requests-v1";

export type ClientSafeRequestProfileId =
  | "workflow_run_list"
    | "workflow_run_status"
  | "worker_release_dispatch"
  | "capability_definition";

export type ClientSafeGatewayRequest = {
  objective: string;
  intent: string;
  inputs: Record<string, unknown>;
};

export type ClientSafeRequestProfile = {
  id: ClientSafeRequestProfileId;
  objective: string;
  intent: string;
  allowed_input_keys: string[];
  max_input_characters: number;
};

export type ClientSafeRequestInspection = {
  safe: boolean;
  violations: string[];
};

export type PreventedClientBlock = {
  id: string;
  observed_on: string;
  blocked_shape: string;
  cause: string;
  safe_profile_id: ClientSafeRequestProfileId;
};

const FORBIDDEN_PUBLIC_INPUT_KEYS = new Set([
  "tool_name",
  "mapped_tool",
  "handler",
  "action_key",
  "execution_guard",
]);

const INTERNAL_HANDLER_IDENTIFIER = /^[a-z][a-z0-9]*(?:[A-Z][A-Za-z0-9]*){2,}$/;
const INTERNAL_ACTION_KEY = /^(?:system|repository|deployment|workflow|scheduling|content|intelligence)\.[a-z0-9_]+$/;

export const PREVENTED_CLIENT_BLOCKS: readonly PreventedClientBlock[] = [
  {
    id: "public_internal_handler_identifier",
    observed_on: "2026-07-18",
    blocked_shape: "Public inputs contained a reserved tool key with an internal CamelCase handler identifier.",
    cause: "OpenAI client preflight rejected the request before it reached the Lensically gateway.",
    safe_profile_id: "workflow_run_list",
  },
  {
    id: "public_release_intent_or_exact_identifier",
    observed_on: "2026-07-18",
    blocked_shape: "Public request used a release intent or exact release identifiers.",
    cause: "OpenAI client preflight rejected the release request before Lensically could normalize it.",
    safe_profile_id: "worker_release_dispatch",
  },
];

export const CLIENT_SAFE_REQUEST_PROFILES: Readonly<Record<ClientSafeRequestProfileId, ClientSafeRequestProfile>> = {
  workflow_run_list: {
    id: "workflow_run_list",
    objective: "List recent workflow activity with compact run metadata.",
    intent: "list github workflow runs",
    allowed_input_keys: ["limit"],
    max_input_characters: 80,
  },
    workflow_run_status: {
    id: "workflow_run_status",
    objective: "Read one workflow run and return compact status and step results.",
    intent: "get github workflow run",
    allowed_input_keys: ["run_id", "wait_seconds"],
    max_input_characters: 120,
  },
  worker_release_dispatch: {
    id: "worker_release_dispatch",
    objective: "Run the configured Worker workflow for the current verified main head.",
    intent: "run regression tests",
    allowed_input_keys: ["workflow_id", "task", "ref"],
    max_input_characters: 180,
  },
  capability_definition: {
    id: "capability_definition",
    objective: "Read the compact definition for the named semantic capability.",
    intent: "read capability definition",
    allowed_input_keys: ["capability"],
    max_input_characters: 160,
  },
};

function inspectValue(value: unknown, path: string, violations: string[]): void {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (INTERNAL_HANDLER_IDENTIFIER.test(trimmed)) {
      violations.push(`internal_handler_identifier:${path}`);
    }
    if (INTERNAL_ACTION_KEY.test(trimmed)) {
      violations.push(`internal_action_key:${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectValue(item, `${path}[${index}]`, violations));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      inspectValue(nested, `${path}.${key}`, violations);
    }
  }
}

export function inspectClientSafeGatewayRequest(request: ClientSafeGatewayRequest): ClientSafeRequestInspection {
  const violations: string[] = [];
  for (const key of Object.keys(request.inputs)) {
    if (FORBIDDEN_PUBLIC_INPUT_KEYS.has(key)) {
      violations.push(`forbidden_public_input_key:${key}`);
    }
  }
  inspectValue(request.objective, "objective", violations);
  inspectValue(request.intent, "intent", violations);
  inspectValue(request.inputs, "inputs", violations);
  return { safe: violations.length === 0, violations: Array.from(new Set(violations)) };
}

export function buildClientSafeGatewayRequest(
  profileId: ClientSafeRequestProfileId,
  inputs: Record<string, unknown> = {},
): ClientSafeGatewayRequest {
  const profile = CLIENT_SAFE_REQUEST_PROFILES[profileId];
  const unsupportedKeys = Object.keys(inputs).filter((key) => !profile.allowed_input_keys.includes(key));
  if (unsupportedKeys.length > 0) {
    throw new Error(`client_safe_request_unsupported_inputs:${profileId}:${unsupportedKeys.join(",")}`);
  }
  if (JSON.stringify(inputs).length > profile.max_input_characters) {
    throw new Error(`client_safe_request_too_large:${profileId}`);
  }
  const request = { objective: profile.objective, intent: profile.intent, inputs };
  const inspection = inspectClientSafeGatewayRequest(request);
  if (!inspection.safe) {
    throw new Error(`client_safe_request_violation:${inspection.violations.join(",")}`);
  }
  return request;
}
