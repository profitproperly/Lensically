type JsonRecord = Record<string, unknown>;

export interface OperatorProductionBoardDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  listActiveItems(input: {
    brandKey: string;
    workflowSessionId: string | null;
  }): Promise<JsonRecord[]>;
  parseJsonString(value: string): unknown;
}

export async function readOperatorProductionBoard(
  input: { brandKey: string; payload: JsonRecord },
  dependencies: OperatorProductionBoardDependencies,
): Promise<JsonRecord> {
  const workflowSessionId = dependencies.normalizeText(
    input.payload.workflow_session_id,
    120,
    true,
  );
  const rows = await dependencies.listActiveItems({
    brandKey: input.brandKey,
    workflowSessionId,
  });
  return {
    brand_key: input.brandKey,
    items: rows.map((row) => ({
      id: row.id,
      item_type: row.item_type,
      lane_key: row.lane_key ?? null,
      title: row.title,
      body: row.body,
      priority: row.priority === null || row.priority === undefined
        ? null
        : Number(row.priority),
      evidence: dependencies.parseJsonString(String(row.evidence_json ?? "[]")) ?? [],
      created_from: row.created_from ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
    warnings: [],
  };
}
