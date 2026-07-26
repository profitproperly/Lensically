export type OperatorMcpToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
};

type ScopedWrapperDefinition = {
  prefix: string;
  titlePrefix: string;
  accountLabel: string;
};

export type BuildOperatorMcpToolDefinitionsOptions = {
  engineeringTools: readonly OperatorMcpToolDefinition[];
  adminTools: readonly OperatorMcpToolDefinition[];
  accountTools: readonly OperatorMcpToolDefinition[];
  includeScopedWrappers: boolean;
  directPriorities: ReadonlyMap<string, number>;
  requiresProceed: (toolName: string) => boolean;
};

const SCOPED_WRAPPERS: readonly ScopedWrapperDefinition[] = [
  { prefix: "mm", titlePrefix: "Manifest", accountLabel: "Manifest Mental" },
  { prefix: "om", titlePrefix: "OPMG", accountLabel: "OPMG Deadman" },
  { prefix: "vx", titlePrefix: "Vectrix", accountLabel: "Vectrix" },
];

export function cloneOperatorMcpTool(
  tool: OperatorMcpToolDefinition,
): OperatorMcpToolDefinition {
  return JSON.parse(JSON.stringify(tool)) as OperatorMcpToolDefinition;
}

export function createScopedOperatorWrapperTool(
  tool: OperatorMcpToolDefinition,
  prefix: string,
  titlePrefix: string,
  accountLabel: string,
): OperatorMcpToolDefinition {
  const cloned = cloneOperatorMcpTool(tool);
  const schema = cloned.inputSchema;
  const properties = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
    ? { ...(schema.properties as Record<string, unknown>) }
    : {};
  delete properties.brand_key;
  const required = Array.isArray(schema.required)
    ? (schema.required as unknown[]).filter((value) => value !== "brand_key")
    : [];
  const inputSchema: Record<string, unknown> = {
    ...schema,
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) {
    inputSchema.required = required;
  } else {
    delete inputSchema.required;
  }
  return {
    ...cloned,
    name: `${prefix}_${tool.name}`,
    title: `${titlePrefix} ${tool.title}`,
    description: `${tool.description} This wrapper automatically scopes the call to ${accountLabel} and does not accept brand_key.`,
    inputSchema,
  };
}

export function addOperatorExecutionMetadataSchema(
  tool: OperatorMcpToolDefinition,
  includeMetadata: boolean,
): OperatorMcpToolDefinition {
  const cloned = cloneOperatorMcpTool(tool);
  if (!includeMetadata) return cloned;

  const schema = cloned.inputSchema;
  const properties = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
    ? { ...(schema.properties as Record<string, unknown>) }
    : {};
  properties.proceed_confirmed = {
    type: "boolean",
    description: "Optional compatibility field for guided workflows. Autonomous Manifest cycle tools do not require a Proceed handshake.",
  };
  properties.operation_id = {
    type: "string",
    description: "Stable operation identity for idempotent retries. Reuse the same value after a stream interruption or uncertain tool result.",
  };
  cloned.inputSchema = { ...schema, properties };
  return cloned;
}

export function buildOperatorMcpToolDefinitions(
  options: BuildOperatorMcpToolDefinitionsOptions,
): OperatorMcpToolDefinition[] {
  const scopedWrapperTools = options.includeScopedWrappers
    ? SCOPED_WRAPPERS.flatMap((wrapper) => options.accountTools
      .filter((tool) => tool.name !== "list_accounts")
      .map((tool) => createScopedOperatorWrapperTool(
        tool,
        wrapper.prefix,
        wrapper.titlePrefix,
        wrapper.accountLabel,
      )))
    : [];

  return [
    ...options.engineeringTools,
    ...options.adminTools,
    ...options.accountTools,
    ...scopedWrapperTools,
  ]
    .map((tool) => {
      const schema = tool.inputSchema;
      const properties = schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
        ? schema.properties as Record<string, unknown>
        : {};
      const acceptsBrandContext = Object.prototype.hasOwnProperty.call(properties, "brand_key");
      return addOperatorExecutionMetadataSchema(
        tool,
        options.requiresProceed(tool.name)
          || acceptsBrandContext
          || tool.name === "updateWorkflowRequirement",
      );
    })
    .sort((left, right) => {
      const leftPriority = options.directPriorities.get(left.name) ?? 1000;
      const rightPriority = options.directPriorities.get(right.name) ?? 1000;
      return leftPriority - rightPriority;
    });
}
