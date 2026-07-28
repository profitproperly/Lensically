type JsonRecord = Record<string, unknown>;

type OperatorActiveGateReadDependencies<TStage extends string> = {
  normalizeStage: (value: unknown) => TStage;
  normalizeMachineKey: (value: unknown, fallback: string) => string;
  listGates: (input: {
    brandKey: string;
        stageScope: TStage | null;
    laneKey: string | null;
    contentType: string | null;
  }) => Promise<unknown[]>;
};

export async function readOperatorActiveGates<TStage extends string>(input: {
  brandKey: string;
  payload: JsonRecord;
}, dependencies: OperatorActiveGateReadDependencies<TStage>): Promise<JsonRecord> {
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
