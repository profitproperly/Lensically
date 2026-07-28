type JsonRecord = Record<string, unknown>;

export interface OperatorSourceCardPersistencePlanningInput {
  brandKey: string;
  payload: JsonRecord;
  sourceCardId: string;
  workflowSessionId: string | null;
  sequenceLabel: string;
  primarySource: unknown;
  metricsSnapshot: unknown;
  sourceMechanism: string | null;
  requiredProduct: string | null;
  familyId: string | null;
  sourceSelectionId: string | null;
  versionNumber: number;
  supersedesSourceCardId: string | null;
  versionReason: string | null;
  transformationContract: JsonRecord;
  savedPatternId: number | null;
}

export interface OperatorSourceCardPersistencePlanningDependencies {
  normalizeMachineKey(value: unknown, fallback: string): string;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  normalizeJson(value: unknown, fallback: unknown): string;
  parseWorkflowSequence(sequenceLabel: string): number | null;
    validateSourceCard(sourceCard: JsonRecord): unknown;

  nowIso(): string;
}

export interface OperatorSourceCardInsertValues {
  sourceCardId: string;
  brandKey: string;
  workflowSessionId: string | null;
  sequenceLabel: string;
  laneKey: string | null;
  title: string;
  primarySourceJson: string;
  secondarySourcesJson: string;
  antiSourcesJson: string;
  metricsSnapshotJson: string;
  sourceMechanism: string | null;
  requiredProduct: string | null;
  forbiddenSurfacesJson: string;
  dangerSurfacesJson: string;
  currentInventoryConstraintsJson: string;
  passConditionsJson: string;
  failConditionsJson: string;
  recommendedDirection: string | null;
  contextAdmissionId: string | null;
  createdBy: string;
  familyId: string | null;
  sourceSelectionId: string | null;
  versionNumber: number;
  supersedesSourceCardId: string | null;
  versionReason: string | null;
  transformationContractJson: string;
}

export interface OperatorSourceCardPersistencePlan {
  insertValues: OperatorSourceCardInsertValues;
  status: "draft" | "locked";
  lockedAt: string | null;
  retireSupersededCardId: string | null;
  familyUpdate: {
    familyId: string;
    threadsPostId: unknown;
    canonicalSourceUrl: unknown;
  } | null;
  selectionLink: {
    sourceSelectionId: string;
    workflowSequence: number | null;
  } | null;
}

export type OperatorSourceCardPersistencePlanningResult =
  | { kind: "response"; status: number; body: JsonRecord }
  | { kind: "continue"; plan: OperatorSourceCardPersistencePlan };

export function planOperatorSourceCardPersistence(
  input: OperatorSourceCardPersistencePlanningInput,
  dependencies: OperatorSourceCardPersistencePlanningDependencies,
): OperatorSourceCardPersistencePlanningResult {
  const forbiddenSurfaces = Array.isArray(input.payload.forbidden_surfaces)
    ? input.payload.forbidden_surfaces
    : [];
  const passConditions = Array.isArray(input.payload.pass_conditions)
    ? input.payload.pass_conditions
    : [];
  const failConditions = Array.isArray(input.payload.fail_conditions)
    ? input.payload.fail_conditions
    : [];

  if (input.savedPatternId !== null) {
        const validation = dependencies.validateSourceCard({
      brand_key: input.brandKey,
      primary_source: input.primarySource,
      source_mechanism: input.sourceMechanism,
      required_product: input.requiredProduct,
      forbidden_surfaces: forbiddenSurfaces,
      pass_conditions: passConditions,
      fail_conditions: failConditions,
      transformation_contract: input.transformationContract,
    });
    const validationRecord = validation
      && typeof validation === "object"
      && !Array.isArray(validation)
      ? validation as JsonRecord
      : {};
    if (validationRecord.can_lock !== true) {
      return {
        kind: "response",
        status: 400,
        body: {
          success: false,
          error: "saved_pattern_source_card_not_lockable",
          saved_pattern_id: input.savedPatternId,
          validation,
        },
      };
    }
  }

  const lockedAt = input.savedPatternId !== null ? dependencies.nowIso() : null;
  const primarySourceRecord = input.primarySource
    && typeof input.primarySource === "object"
    && !Array.isArray(input.primarySource)
    ? input.primarySource as JsonRecord
    : {};

  const laneKey = dependencies.normalizeMachineKey(input.payload.lane_key, "") || null;
  const title = dependencies.normalizeText(input.payload.title, 500) || "Source card";

  return {
    kind: "continue",
    plan: {
      insertValues: {
        sourceCardId: input.sourceCardId,
        brandKey: input.brandKey,
        workflowSessionId: input.workflowSessionId,
        sequenceLabel: input.sequenceLabel,
        laneKey,
        title,
        primarySourceJson: dependencies.normalizeJson(input.primarySource, {}),
        secondarySourcesJson: dependencies.normalizeJson(input.payload.secondary_sources, []),
        antiSourcesJson: dependencies.normalizeJson(input.payload.anti_sources, []),
        metricsSnapshotJson: dependencies.normalizeJson(input.metricsSnapshot, null),
        sourceMechanism: input.sourceMechanism,
        requiredProduct: input.requiredProduct,
        forbiddenSurfacesJson: dependencies.normalizeJson(input.payload.forbidden_surfaces, []),
        dangerSurfacesJson: dependencies.normalizeJson(input.payload.danger_surfaces, []),
        currentInventoryConstraintsJson: dependencies.normalizeJson(
          input.payload.current_inventory_constraints,
          [],
        ),
        passConditionsJson: dependencies.normalizeJson(input.payload.pass_conditions, []),
        failConditionsJson: dependencies.normalizeJson(input.payload.fail_conditions, []),
        recommendedDirection: dependencies.normalizeText(
          input.payload.recommended_direction,
          4000,
          true,
        ),
        contextAdmissionId: dependencies.normalizeText(
          input.payload.context_admission_id,
          120,
          true,
        ),
        createdBy: dependencies.normalizeMachineKey(input.payload.created_by, "gpt"),
        familyId: input.familyId,
        sourceSelectionId: input.sourceSelectionId,
        versionNumber: input.versionNumber,
        supersedesSourceCardId: input.supersedesSourceCardId,
        versionReason: input.versionReason,
        transformationContractJson: dependencies.normalizeJson(input.transformationContract, {}),
      },
      status: input.savedPatternId !== null ? "locked" : "draft",
      lockedAt,
      retireSupersededCardId: input.supersedesSourceCardId,
      familyUpdate: input.familyId
        ? {
            familyId: input.familyId,
            threadsPostId: primarySourceRecord.threads_post_id ?? null,
            canonicalSourceUrl: primarySourceRecord.canonical_source_url ?? null,
          }
        : null,
      selectionLink: input.sourceSelectionId
        ? {
            sourceSelectionId: input.sourceSelectionId,
            workflowSequence: dependencies.parseWorkflowSequence(input.sequenceLabel),
          }
        : null,
    },
  };
}

export function composeOperatorSourceCardPersistenceResponse(
  input: {
    plan: OperatorSourceCardPersistencePlan;
    persistedCard: JsonRecord | null;
    ownerPresentation: JsonRecord;
  },
  dependencies: Pick<OperatorSourceCardPersistencePlanningDependencies, "validateSourceCard">,
): { status: number; body: JsonRecord } {
  const values = input.plan.insertValues;
  return {
    status: 200,
    body: {
      source_card_id: values.sourceCardId,
      source_selection_id: values.sourceSelectionId,
      family_id: values.familyId,
      version_number: values.versionNumber,
      supersedes_source_card_id: values.supersedesSourceCardId,
      status: input.plan.status,
      locked_at: input.plan.lockedAt,
      reused_existing: false,
      validation: dependencies.validateSourceCard(input.persistedCard ?? {}),
      owner_presentation: {
        ...input.ownerPresentation,
        account_scope: values.brandKey,
      },
    },
  };
}
