type JsonRecord = Record<string, unknown>;

type OperatorActiveGateReadDependencies = {
  normalizeStage: (value: unknown) => string;
  normalizeMachineKey: (value: unknown, fallback: string) => string;
  listGates: (input: {
    brandKey: string;
    stageScope: string | null;
    laneKey: string | null;
    contentType: string | null;
  }) => Promise<unknown[]>;
};

export async function readOperatorActiveGates(input: {
  brandKey: string;
  payload: JsonRecord;
}, dependencies: OperatorActiveGateReadDependencies): Promise<JsonRecord> {
  const stageScope = input.payload.stage_scope
    ? dependencies.normalizeStage(input.payload.stage_scope)
    : null;
  const laneKey = dependencies.normalizeMachineKey(
    input.payload.lane_key,
    "",
  ) || null;
  const contentType = dependencies.normalizeMachineKey(
    input.payload.content_type,
    "",
  ) || null;
  const gates = await dependencies.listGates({
    brandKey: input.brandKey,
    stageScope,
    laneKey,
    contentType,
  });
  return { gates };
}
