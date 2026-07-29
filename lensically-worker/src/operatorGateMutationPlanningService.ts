type GateMutationToolName = "create_or_update_gate" | "promote_memory_to_gate";

type StrategyMemoryRecord = {
  id: number;
  title: string | null;
  body: string;
};

type ExistingGateRecord = {
  id: string;
};

type GateMutationResponse = {
  kind: "response";
  status: number;
  body: Record<string, unknown>;
};

export type OperatorGateMutationPlan<TBrand, TStage> = {
  kind: "plan";
  mode: "insert" | "update";
  gateId: string;
  identity: {
    brandScope: TBrand | null;
    gateKey: string;
    laneScope: string | null;
    contentTypeScope: string | null;
  };
  values: {
    displayName: string;
    description: string;
    stageScope: TStage;
    gateType: string;
    severity: string;
    evaluator: string;
    activeFlag: number;
    orderIndex: number;
    passExamplesJson: string;
    failExamplesJson: string;
    sourceMemoryIdsJson: string;
    createdFrom: string;
  };
  body: Record<string, unknown>;
};

export async function planOperatorGateMutation<TBrand, TStage>(
  input: {
    toolName: GateMutationToolName;
    payload: Record<string, unknown>;
    accountBrandKey: TBrand;
  },
  dependencies: {
    normalizeText: (value: unknown, maxLength: number, allowEmpty?: boolean) => string | null;
    normalizeMachineKey: (value: unknown, fallback?: string) => string;
        normalizeStage: (value: unknown, fallback: "gate_evaluation") => TStage;
    normalizeJson: (value: unknown, fallback: unknown) => string;
    loadMemory: (memoryId: number) => Promise<StrategyMemoryRecord | null>;
    loadExistingGate: (identity: {
      brandScope: TBrand | null;
      gateKey: string;
      laneScope: string | null;
      contentTypeScope: string | null;
    }) => Promise<ExistingGateRecord | null>;
    createGateId: () => string;
  },
): Promise<GateMutationResponse | OperatorGateMutationPlan<TBrand, TStage>> {
  const { payload, toolName, accountBrandKey } = input;
  let description = dependencies.normalizeText(payload.description, 4_000, true);
  let displayName = dependencies.normalizeText(payload.display_name, 240, true);
  let sourceMemoryIds: unknown = payload.source_memory_ids ?? [];
  let createdFrom = dependencies.normalizeMachineKey(payload.created_from, "owner_feedback");

  if (toolName === "promote_memory_to_gate") {
    const memoryId = Number(payload.memory_id);
    const memory = Number.isFinite(memoryId)
      ? await dependencies.loadMemory(memoryId)
      : null;
    if (!memory) {
      return {
        kind: "response",
        status: 404,
        body: { success: false, error: "memory_not_found" },
      };
    }
    displayName = displayName
      ?? memory.title
      ?? dependencies.normalizeText(payload.gate_key, 120)
      ?? "Promoted memory gate";
    description = description ?? memory.body;
    sourceMemoryIds = [memory.id];
    createdFrom = "strategy_memory";
  }

  const gateKey = dependencies.normalizeMachineKey(payload.gate_key);
  if (!gateKey || !description) {
    return {
      kind: "response",
      status: 400,
      body: { success: false, error: "gate_key and description are required" },
    };
  }

  const brandScope = payload.brand_key === null || payload.brand_key === "global"
    ? null
    : accountBrandKey;
  const laneScope = dependencies.normalizeMachineKey(payload.lane_scope, "") || null;
  const contentTypeScope = dependencies.normalizeMachineKey(
    payload.content_type_scope ?? payload.content_type,
    "",
  ) || null;
  const identity = {
    brandScope,
    gateKey,
    laneScope,
    contentTypeScope,
  };
  const existing = await dependencies.loadExistingGate(identity);
  const gateId = existing?.id ?? dependencies.createGateId();
  const values = {
    displayName: displayName ?? gateKey,
    description,
    stageScope: dependencies.normalizeStage(payload.stage_scope, "gate_evaluation"),
    gateType: dependencies.normalizeMachineKey(payload.gate_type, "hard"),
    severity: dependencies.normalizeMachineKey(payload.severity, "block"),
    evaluator: dependencies.normalizeMachineKey(payload.evaluator, "hybrid"),
    activeFlag: payload.active === false ? 0 : 1,
    orderIndex: Number(payload.order_index ?? 100),
    passExamplesJson: dependencies.normalizeJson(payload.pass_examples, []),
    failExamplesJson: dependencies.normalizeJson(payload.fail_examples, []),
    sourceMemoryIdsJson: dependencies.normalizeJson(sourceMemoryIds, []),
    createdFrom,
  };

  return {
    kind: "plan",
    mode: existing?.id ? "update" : "insert",
    gateId,
    identity,
    values,
    body: {
      gate_id: gateId,
      gate_key: gateKey,
      active: payload.active !== false,
            created_from_memory_id: toolName === "promote_memory_to_gate"
        ? payload.memory_id ?? null
        : null,
    },
  };
}

export type OperatorGateEvaluationResult = {
  showable: boolean;
  gate_results: Record<string, unknown>[];
  blocking_failures: Record<string, unknown>[];
  warnings: string[];
};

export async function evaluateOperatorGates<TStage extends string>(
  input: { payload: Record<string, unknown> },
  dependencies: {
    normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
    normalizeStage(value: unknown, fallback: "gate_evaluation"): TStage;
    normalizeMachineKey(value: unknown, fallback?: string): string;
    runGates(gateInput: {
      sourceCardId: string | null;
      draftText: string | null;
      stageScope: TStage;
      laneKey: string | null;
      contentType: string | null;
      draftAnalysis: Record<string, unknown> | null;
      modelGateResults: Array<Record<string, unknown>> | null;
    }): Promise<OperatorGateEvaluationResult>;
  },
): Promise<OperatorGateEvaluationResult> {
  const payload = input.payload;
  const draftAnalysis = payload.draft_analysis
    && typeof payload.draft_analysis === "object"
    && !Array.isArray(payload.draft_analysis)
    ? payload.draft_analysis as Record<string, unknown>
    : null;

  return dependencies.runGates({
    sourceCardId: dependencies.normalizeText(payload.source_card_id, 120, true),
    draftText: dependencies.normalizeText(payload.draft_text, 20000, true),
    stageScope: dependencies.normalizeStage(payload.stage, "gate_evaluation"),
    laneKey: dependencies.normalizeMachineKey(
      payload.lane_key ?? draftAnalysis?.lane_key,
      "",
    ) || null,
    contentType: dependencies.normalizeMachineKey(payload.content_type, "") || null,
    draftAnalysis,
        modelGateResults: Array.isArray(payload.model_gate_results)
      ? payload.model_gate_results as Array<Record<string, unknown>>
      : null,
  });
}

type OperatorGateResultValue = "pass" | "pass_with_caution" | "fail" | "not_applicable";

type OperatorGateEngineInput<TStage extends string> = {
  brandKey: string;
  accountId: string;
  threadsUserId: string;
  sourceCardId?: string | null;
  draftId?: string | null;
  draftText?: string | null;
  stageScope: TStage;
  laneKey?: string | null;
  contentType?: string | null;
  draftAnalysis?: Record<string, unknown> | null;
  modelGateResults?: Array<Record<string, unknown>> | null;
  scheduling?: { date?: string | null; time?: string | null; timezone?: string | null } | null;
};

type OperatorGateEngineDependencies<TStage extends string> = {
  defaultTimezone: string;
  prepare(): Promise<unknown>;
  listGates(input: {
    brandKey: string;
    stageScope: TStage;
    laneKey: string | null;
    contentType: string | null;
  }): Promise<Array<Record<string, unknown>>>;
  getSourceCard(brandKey: string, sourceCardId: string): Promise<Record<string, unknown> | null>;
  getRejectionContext(): Promise<Record<string, unknown> | null>;
  getLatestContextAdmission(brandKey: string): Promise<Record<string, unknown> | null>;
  getLatestInventory(brandKey: string): Promise<Record<string, unknown> | null>;
  findExactDuplicate(input: {
    accountId: string;
    threadsUserId: string;
    draftId: string | null;
    normalizedDraft: string;
  }): Promise<{ source_type: string } | null>;
  getDraft(draftId: string): Promise<Record<string, unknown> | null>;
  listScheduledPosts(input: {
    threadsUserId: string;
    date: string;
    timezone: string;
  }): Promise<Array<Record<string, unknown>>>;
  persistGateResult(input: {
    brandKey: string;
    draftId: string;
    sourceCardId: string | null;
    result: Record<string, unknown>;
  }): Promise<unknown>;
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  normalizeMachineKey(value: unknown, fallback?: string): string;
  normalizeComparableText(value: unknown): string;
  normalizeSourceContract(value: unknown): Record<string, unknown>;
  normalizeSourceContractStringList(value: unknown): string[];
  sourceContractItemText(value: unknown): string | null;
  inferRealmEntranceKey(value: string | null): string;
  extractOpeningPhrase(value: string): string | null;
  containsRejectedSurface(normalizedDraft: string, surface: string): boolean;
  rejectionSimilarity(left: string, right: string): number;
  compactRejectionText(value: unknown, maxLength: number): string | null;
  isValidIsoDate(value: string): boolean;
};

function buildOperatorGateResult(
  gate: Record<string, unknown>,
  result: OperatorGateResultValue,
  rationale: string,
  evidence: Record<string, unknown> | null = null,
  repairGuidance: string | null = null,
): Record<string, unknown> {
  return {
    gate_id: gate.id,
    gate_key: gate.gate_key,
    result,
    blocking: result === "fail" && String(gate.severity) === "block",
    rationale,
    evaluated_by: gate.evaluator,
    evidence,
    repair_guidance: repairGuidance,
  };
}

export async function runOperatorGateEngine<TStage extends string>(
  input: OperatorGateEngineInput<TStage>,
  dependencies: OperatorGateEngineDependencies<TStage>,
): Promise<OperatorGateEvaluationResult> {
  await dependencies.prepare();
  const gates = await dependencies.listGates({
    brandKey: input.brandKey,
    stageScope: input.stageScope,
    laneKey: input.laneKey ?? null,
    contentType: input.contentType ?? null,
  });
  const sourceCard = input.sourceCardId
    ? await dependencies.getSourceCard(input.brandKey, input.sourceCardId)
    : null;
  const rejectionContext = input.stageScope === "gate_evaluation"
    ? await dependencies.getRejectionContext()
    : null;
  const draftText = dependencies.normalizeText(input.draftText, 20000, true) ?? "";
  const normalizedDraft = dependencies.normalizeComparableText(draftText);
  const sourceContract = dependencies.normalizeSourceContract(sourceCard?.transformation_contract);
  const manifestCloseMimicry = input.brandKey === "manifest_mental";
  const primarySource = sourceCard?.primary_source
    && typeof sourceCard.primary_source === "object"
    && !Array.isArray(sourceCard.primary_source)
    ? sourceCard.primary_source as Record<string, unknown>
    : {};
  const primarySourceText = dependencies.normalizeText(primarySource.text ?? primarySource.post_text, 20000, true) ?? "";
  const exactSourceCopy = Boolean(primarySourceText)
    && normalizedDraft === dependencies.normalizeComparableText(primarySourceText);
  const mustPreserveExact = Array.isArray(sourceContract.must_preserve_exact)
    ? sourceContract.must_preserve_exact.map(String)
    : [];
  const mayReuse = Array.isArray(sourceContract.may_reuse)
    ? sourceContract.may_reuse.map(String)
    : [];
  const approvedReusableSurfaces = new Set(
    [...mustPreserveExact, ...mayReuse]
      .map((surface) => dependencies.normalizeComparableText(surface))
      .filter(Boolean),
  );
  const results: Record<string, unknown>[] = [];
  const warnings: string[] = [];

  for (const gate of gates) {
    const gateKey = String(gate.gate_key);
    if (gateKey === "account_selected_gate") {
      results.push(buildOperatorGateResult(
        gate,
        input.brandKey ? "pass" : "fail",
        input.brandKey ? "Account is selected." : "Missing account selection.",
      ));
      continue;
    }
    if (gateKey === "operator_precheck_before_workflow") {
      const latestAdmission = await dependencies.getLatestContextAdmission(input.brandKey);
      const sections = Array.isArray(latestAdmission?.sections)
        ? latestAdmission.sections as Array<Record<string, unknown>>
        : [];
      const operatorPrecheck = sections.find((section) => section.section === "operator_precheck");
      const precheckComplete = latestAdmission?.admission_scope === "full_preflight"
        && latestAdmission?.is_partial !== true
        && operatorPrecheck?.coverage_status === "complete"
        && operatorPrecheck?.has_more !== true
        && !operatorPrecheck.error;
      results.push(buildOperatorGateResult(
        gate,
        precheckComplete ? "pass" : "fail",
        precheckComplete ? "Operator precheck is loaded." : "Operator precheck is missing or partial.",
        {
          context_admission_id: latestAdmission?.id ?? null,
          admission_scope: latestAdmission?.admission_scope ?? null,
          is_partial: latestAdmission?.is_partial ?? null,
          section_count: sections.length,
          operator_precheck_status: operatorPrecheck?.coverage_status ?? null,
        },
        "Complete the initial key-selection handshake before workflow, admin, or engineering actions.",
      ));
      continue;
    }
    if (gateKey === "source_card_required_gate") {
      results.push(buildOperatorGateResult(
        gate,
        input.sourceCardId ? "pass" : "fail",
        input.sourceCardId ? "Source card id is present." : "Serious generation requires a source card.",
        null,
        "Create and lock a source card or record a narrow rewrite override.",
      ));
      continue;
    }
    if (gateKey === "source_lock_gate") {
      const locked = sourceCard?.status === "locked";
      results.push(buildOperatorGateResult(
        gate,
        locked ? "pass" : "fail",
        locked ? "Source card is locked." : "Source card is not locked.",
        { source_card_status: sourceCard?.status ?? null },
        "Lock the source card before showing drafts.",
      ));
      continue;
    }
    if (gateKey === "source_transformation_contract_gate") {
      const preservedFunctions = new Set(
        dependencies.normalizeSourceContractStringList(input.draftAnalysis?.preserved_functions)
          .map((item) => dependencies.normalizeComparableText(item)),
      );
      const transformedElements = new Set(
        dependencies.normalizeSourceContractStringList(input.draftAnalysis?.transformed_elements)
          .map((item) => dependencies.normalizeComparableText(item)),
      );
      const satisfiedTimeRequirements = new Set(
        dependencies.normalizeSourceContractStringList(input.draftAnalysis?.satisfied_time_or_context_requirements)
          .map((item) => dependencies.normalizeComparableText(item)),
      );
      const missingExact = mustPreserveExact.filter((surface) => {
        const normalizedSurface = dependencies.normalizeComparableText(surface);
        return normalizedSurface && !normalizedDraft.includes(normalizedSurface);
      });
      const requiredFunctions = Array.isArray(sourceContract.must_preserve_function)
        ? sourceContract.must_preserve_function.map(String)
        : [];
      const missingFunctions = requiredFunctions.filter(
        (requirement) => !preservedFunctions.has(dependencies.normalizeComparableText(requirement)),
      );
      const requiredTime = Array.isArray(sourceContract.time_or_context_requirements)
        ? sourceContract.time_or_context_requirements.map(String)
        : [];
      const missingTime = requiredTime.filter(
        (requirement) => !satisfiedTimeRequirements.has(dependencies.normalizeComparableText(requirement)),
      );
      const copiedTransformTargets: string[] = [];
      const undeclaredTransformRoles: string[] = [];
      const mustTransform = Array.isArray(sourceContract.must_transform) ? sourceContract.must_transform : [];
      for (const item of mustTransform) {
        const sourceText = dependencies.sourceContractItemText(item);
        if (sourceText) {
          const normalizedSourceText = dependencies.normalizeComparableText(sourceText);
          if (normalizedSourceText && normalizedDraft.includes(normalizedSourceText)) {
            copiedTransformTargets.push(sourceText);
          }
        }
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const role = dependencies.normalizeText((item as Record<string, unknown>).role, 240, true);
          if (role && !transformedElements.has(dependencies.normalizeComparableText(role))) {
            undeclaredTransformRoles.push(role);
          }
        }
      }
      const prohibitedPackages: Array<Record<string, unknown>> = [];
      const forbiddenCombinations = Array.isArray(sourceContract.forbidden_complete_combinations)
        ? sourceContract.forbidden_complete_combinations as Array<Record<string, unknown>>
        : [];
      for (const combination of forbiddenCombinations) {
        const surfaces = Array.isArray(combination.surfaces) ? combination.surfaces : [];
        const matched = surfaces
          .map((surface) => typeof surface === "string" ? surface : "")
          .filter((surface) => {
            const normalizedSurface = dependencies.normalizeComparableText(surface);
            return normalizedSurface && normalizedDraft.includes(normalizedSurface);
          });
        const minMatches = Math.max(2, Number(combination.min_matches ?? surfaces.length));
        if (matched.length >= minMatches) {
          prohibitedPackages.push({
            matched_surfaces: matched,
            min_matches: minMatches,
            rationale: combination.rationale ?? null,
          });
        }
      }
      const shouldTransform = Array.isArray(sourceContract.should_transform) ? sourceContract.should_transform : [];
      const copiedShouldTransform = shouldTransform
        .map((item) => dependencies.sourceContractItemText(item))
        .filter((item): item is string => Boolean(item))
        .filter((surface) => {
          const normalizedSurface = dependencies.normalizeComparableText(surface);
          return normalizedSurface && normalizedDraft.includes(normalizedSurface);
        });
      const audienceRewardRequired = Boolean(
        dependencies.normalizeText(sourceContract.audience_reward, 2000, true),
      );
      const audienceRewardDelivered = input.draftAnalysis?.audience_reward_delivered === true;
      const failures = {
        missing_exact_surfaces: missingExact,
        missing_preserved_functions: missingFunctions,
        missing_time_or_context_requirements: missingTime,
        exact_source_copy: manifestCloseMimicry && exactSourceCopy,
        copied_must_transform_surfaces: manifestCloseMimicry ? [] : copiedTransformTargets,
        undeclared_transformed_roles: manifestCloseMimicry ? [] : undeclaredTransformRoles,
        prohibited_complete_packages: manifestCloseMimicry ? [] : prohibitedPackages,
        audience_reward_missing: audienceRewardRequired && !audienceRewardDelivered,
      };
      const hasFailure = missingExact.length > 0
        || missingFunctions.length > 0
        || missingTime.length > 0
        || (manifestCloseMimicry && exactSourceCopy)
        || (!manifestCloseMimicry && copiedTransformTargets.length > 0)
        || (!manifestCloseMimicry && undeclaredTransformRoles.length > 0)
        || (!manifestCloseMimicry && prohibitedPackages.length > 0)
        || (audienceRewardRequired && !audienceRewardDelivered);
      if (hasFailure) {
        results.push(buildOperatorGateResult(
          gate,
          "fail",
          manifestCloseMimicry
            ? "Manifest draft failed the source-fidelity boundary."
            : "Draft does not satisfy the active source transformation contract.",
          failures,
          manifestCloseMimicry
            ? "Keep the source hook, structure, meaning, tone, and payoff; change only enough wording to avoid reproducing the source exactly. Do not add a new scene or premise."
            : "Preserve approved exact hooks/functions, declare satisfied semantic requirements, transform designated elements, deliver the audience reward, and avoid the prohibited full source package.",
        ));
      } else if (!manifestCloseMimicry && copiedShouldTransform.length) {
        results.push(buildOperatorGateResult(
          gate,
          "pass_with_caution",
          "Required transformation rules pass, but a should-transform surface remains close to the source.",
          { copied_should_transform_surfaces: copiedShouldTransform },
          "Consider changing the optional source surface unless retaining it is deliberate.",
        ));
      } else {
        results.push(buildOperatorGateResult(
          gate,
          "pass",
          manifestCloseMimicry
            ? "Manifest draft preserves the source contract and is not an exact source copy."
            : "Draft satisfies the active source transformation contract.",
        ));
      }
      continue;
    }
    if (gateKey === "source_surface_copy_gate") {
      if (manifestCloseMimicry) {
        results.push(exactSourceCopy
          ? buildOperatorGateResult(
            gate,
            "fail",
            "Manifest draft exactly copies the source post.",
            { source_text: primarySourceText },
            "Change a small amount of wording while preserving the hook, structure, meaning, tone, and payoff.",
          )
          : buildOperatorGateResult(
            gate,
            "pass",
            "Manifest draft is not an exact source copy; close source mimicry is allowed.",
          ));
        continue;
      }
      const forbidden = Array.isArray(sourceCard?.forbidden_surfaces) ? sourceCard.forbidden_surfaces : [];
      let copied: string | null = null;
      let cautious: string | null = null;
      for (const surface of forbidden) {
        const phrase = typeof surface === "string"
          ? surface
          : String((surface as Record<string, unknown>)?.text ?? "");
        const normalizedPhrase = dependencies.normalizeComparableText(phrase);
        if (!normalizedPhrase || approvedReusableSurfaces.has(normalizedPhrase)) continue;
        const wordCount = normalizedPhrase.split(" ").filter(Boolean).length;
        if (wordCount > 3 && normalizedDraft.includes(normalizedPhrase)) {
          copied = phrase;
          break;
        }
        if (wordCount <= 3 && normalizedDraft.includes(normalizedPhrase)) cautious = phrase;
      }
      if (copied) {
        results.push(buildOperatorGateResult(
          gate,
          "fail",
          "Draft copies a forbidden source surface.",
          { copied_surface: copied },
          "Rewrite away from the source surface while preserving the mechanism.",
        ));
      } else if (cautious) {
        results.push(buildOperatorGateResult(
          gate,
          "pass_with_caution",
          "Draft includes a short forbidden surface fragment.",
          { caution_surface: cautious },
          "Check whether the short phrase is too close.",
        ));
      } else {
        results.push(buildOperatorGateResult(gate, "pass", "No forbidden source surface copied."));
      }
      continue;
    }
    if (gateKey === "current_inventory_repeat_gate") {
      const latest = await dependencies.getLatestInventory(input.brandKey);
      const candidateRealm = dependencies.normalizeMachineKey(input.draftAnalysis?.realm_entrance_key, "")
        || dependencies.inferRealmEntranceKey(
          dependencies.normalizeText(input.draftAnalysis?.opening_phrase, 240, true)
            ?? dependencies.extractOpeningPhrase(draftText),
        );
      const latestRealm = dependencies.normalizeMachineKey(latest?.realm_entrance_key, "");
      const candidateOpening = dependencies.normalizeComparableText(
        dependencies.normalizeText(input.draftAnalysis?.opening_phrase, 240, true)
          ?? dependencies.extractOpeningPhrase(draftText)
          ?? "",
      );
      const latestOpening = dependencies.normalizeComparableText(String(latest?.opening_phrase ?? ""));
      const reusableOpening = Array.from(approvedReusableSurfaces).find(
        (surface) => Boolean(surface)
          && (candidateOpening.includes(surface) || normalizedDraft.startsWith(surface)),
      ) ?? null;
      if (candidateRealm && latestRealm && candidateRealm === latestRealm && !reusableOpening) {
        results.push(buildOperatorGateResult(
          gate,
          "fail",
          "Candidate repeats the latest realm entrance for this account.",
          { candidate_realm: candidateRealm, latest_inventory_id: latest?.id ?? null },
          "Rotate the opener/realm entrance before showing.",
        ));
      } else if (candidateOpening && latestOpening && candidateOpening === latestOpening && !reusableOpening) {
        results.push(buildOperatorGateResult(
          gate,
          "fail",
          "Candidate repeats the latest opening phrase for this account.",
          { opening_phrase: candidateOpening, latest_inventory_id: latest?.id ?? null },
          "Change the opening phrase.",
        ));
      } else if (reusableOpening) {
        results.push(buildOperatorGateResult(
          gate,
          "pass",
          "Opening repetition is explicitly authorized by the active source transformation contract.",
          { reusable_surface: reusableOpening, latest_inventory_id: latest?.id ?? null },
        ));
      } else {
        results.push(buildOperatorGateResult(gate, "pass", "No latest-inventory opening repeat detected."));
      }
      continue;
    }
    if (gateKey === "historical_owner_rejection_gate") {
      const coverageComplete = rejectionContext?.coverage_complete === true;
      const requiredReviewCount = Number(rejectionContext?.required_review_count ?? 0);
      const expectedFingerprint = String(rejectionContext?.context_fingerprint ?? "");
      const explicitBannedSurfaces = Array.isArray(rejectionContext?.explicit_banned_surfaces)
        ? rejectionContext.explicit_banned_surfaces.map(String)
        : [];
      const ownerApprovedSurfaceInputs = [
        ...(Array.isArray(input.draftAnalysis?.owner_approved_surfaces)
          ? input.draftAnalysis.owner_approved_surfaces.map(String)
          : []),
        dependencies.normalizeText(input.draftAnalysis?.owner_requested_exact_surface, 500, true),
      ].filter((surface): surface is string => Boolean(surface));
      const currentOwnerApprovedSurfaces = ownerApprovedSurfaceInputs
        .map((surface) => dependencies.normalizeComparableText(surface))
        .filter((surface) => Boolean(surface) && normalizedDraft.includes(surface));
      const matchedBannedSurfaces = explicitBannedSurfaces.filter((surface) => {
        const normalizedSurface = dependencies.normalizeComparableText(surface);
        const approvedForCurrentDraft = currentOwnerApprovedSurfaces.some(
          (approvedSurface) => approvedSurface === normalizedSurface
            || approvedSurface.includes(normalizedSurface),
        );
        return !approvedForCurrentDraft
          && dependencies.containsRejectedSurface(normalizedDraft, surface);
      });
      if (manifestCloseMimicry) {
        if (matchedBannedSurfaces.length) {
          results.push(buildOperatorGateResult(
            gate,
            "fail",
            "Manifest draft repeats language the owner explicitly hard-banned.",
            {
              enforcement_mode: "explicit_hard_bans_only",
              context_fingerprint: expectedFingerprint,
              matched_banned_surfaces: matchedBannedSurfaces,
            },
            "Remove only the matched hard-ban wording. Keep the source hook, structure, meaning, tone, and payoff close to the original.",
          ));
        } else {
          results.push(buildOperatorGateResult(
            gate,
            coverageComplete ? "pass" : "pass_with_caution",
            coverageComplete
              ? "Manifest draft contains no explicit owner hard-ban surface."
              : "Manifest draft contains no hard-ban surface in the available compact rejection context.",
            {
              enforcement_mode: "explicit_hard_bans_only",
              context_fingerprint: expectedFingerprint,
              explicit_hard_ban_count: explicitBannedSurfaces.length,
              coverage_status: rejectionContext?.coverage_status ?? null,
            },
          ));
        }
        continue;
      }
      const rejectedDrafts = Array.isArray(rejectionContext?.rejected_drafts)
        ? rejectionContext.rejected_drafts as Array<Record<string, unknown>>
        : [];
      const similarRejectedDrafts = rejectedDrafts
        .map((record) => ({
          context_id: record.context_id,
          draft_id: record.draft_id,
          similarity: dependencies.rejectionSimilarity(draftText, String(record.text ?? "")),
          rejected_text: dependencies.compactRejectionText(record.text, 300),
          rejection_reason: dependencies.compactRejectionText(record.rejection_reason, 600),
        }))
        .filter((record) => record.similarity >= 0.72)
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, 5);
      if (!coverageComplete) {
        results.push(buildOperatorGateResult(
          gate,
          "fail",
          "Account rejection context is partial, so historical owner feedback cannot be safely enforced.",
          {
            context_fingerprint: expectedFingerprint,
            required_review_count: requiredReviewCount,
            coverage_status: rejectionContext?.coverage_status ?? "partial",
          },
          "Load the complete account rejection context before generating or showing another draft.",
        ));
      } else if (matchedBannedSurfaces.length || similarRejectedDrafts.length) {
        results.push(buildOperatorGateResult(
          gate,
          "fail",
          matchedBannedSurfaces.length
            ? "Draft repeats language explicitly banned in prior owner rejection feedback."
            : "Draft is too similar to a previously owner-rejected draft.",
          {
            context_fingerprint: expectedFingerprint,
            matched_banned_surfaces: matchedBannedSurfaces,
            similar_rejected_drafts: similarRejectedDrafts,
          },
          "Remove the matched rejected language or structure and regenerate from the source card using the account rejection context.",
        ));
      } else if (requiredReviewCount === 0) {
        results.push(buildOperatorGateResult(gate, "pass", "No account owner-rejection records exist yet."));
      } else {
        const modelResult = input.modelGateResults?.find((item) => item.gate_key === gateKey);
        const evidence = modelResult?.evidence
          && typeof modelResult.evidence === "object"
          && !Array.isArray(modelResult.evidence)
          ? modelResult.evidence as Record<string, unknown>
          : {};
        const reviewedFingerprint = String(
          evidence.context_fingerprint ?? evidence.reviewed_rejection_context_fingerprint ?? "",
        );
        const reviewedCount = Number(evidence.reviewed_rejection_count ?? 0);
        if (!modelResult?.result || !modelResult?.rationale) {
          results.push(buildOperatorGateResult(
            gate,
            "fail",
            "Historical owner rejection review was not recorded.",
            { context_fingerprint: expectedFingerprint, required_review_count: requiredReviewCount },
            "Review the complete account rejection context and submit an auditable historical_owner_rejection_gate result.",
          ));
        } else if (reviewedFingerprint !== expectedFingerprint || reviewedCount < requiredReviewCount) {
          results.push(buildOperatorGateResult(
            gate,
            "fail",
            "Historical owner rejection review did not cover the complete current context.",
            {
              expected_context_fingerprint: expectedFingerprint,
              reviewed_context_fingerprint: reviewedFingerprint || null,
              required_review_count: requiredReviewCount,
              reviewed_rejection_count: reviewedCount,
            },
            "Review every rejection record in the current context pack and resubmit the gate with the exact fingerprint and count.",
          ));
        } else {
          results.push(buildOperatorGateResult(
            gate,
            modelResult.result as OperatorGateResultValue,
            String(modelResult.rationale),
            {
              ...evidence,
              context_fingerprint: expectedFingerprint,
              reviewed_rejection_count: reviewedCount,
            },
            dependencies.normalizeText(modelResult.repair_guidance, 1000, true),
          ));
        }
      }
      continue;
    }
    if (gateKey === "required_gate_execution_gate") {
      const requiredGateKeys = gates
        .filter((candidate) => String(candidate.severity) === "block"
          && String(candidate.gate_key) !== gateKey)
        .map((candidate) => String(candidate.gate_key));
      const resultByGate = new Map(results.map((result) => [String(result.gate_key), result]));
      const missingGateKeys = requiredGateKeys.filter((requiredKey) => !resultByGate.has(requiredKey));
      const unauditableGateKeys = requiredGateKeys.filter((requiredKey) => {
        const result = resultByGate.get(requiredKey);
        return result?.result === "not_applicable"
          || !dependencies.normalizeText(result?.rationale, 2000, true);
      });
      const complete = missingGateKeys.length === 0 && unauditableGateKeys.length === 0;
      results.push(buildOperatorGateResult(
        gate,
        complete ? "pass" : "fail",
        complete
          ? "Every active blocking gate executed with an auditable result."
          : "One or more active blocking gates did not execute with an auditable result.",
        {
          required_gate_keys: requiredGateKeys,
          executed_gate_keys: Array.from(resultByGate.keys()),
          missing_gate_keys: missingGateKeys,
          unauditable_gate_keys: unauditableGateKeys,
        },
        complete
          ? null
          : "Run every active blocking gate and include required model evidence before showing the draft.",
      ));
      continue;
    }
    if (gateKey === "exact_duplicate_gate") {
      const duplicate = await dependencies.findExactDuplicate({
        accountId: input.accountId,
        threadsUserId: input.threadsUserId,
        draftId: input.draftId ?? null,
        normalizedDraft,
      });
      results.push(duplicate
        ? buildOperatorGateResult(
          gate,
          "fail",
          "Draft exactly matches known account content.",
          { source_type: duplicate.source_type },
          "Write a materially different draft.",
        )
        : buildOperatorGateResult(gate, "pass", "No exact duplicate found in checked inventory."));
      continue;
    }
    if (gateKey === "approved_before_schedule_gate") {
      const draft = input.draftId ? await dependencies.getDraft(input.draftId) : null;
      const approved = draft?.status === "approved";
      results.push(buildOperatorGateResult(
        gate,
        approved ? "pass" : "fail",
        approved ? "Draft is approved." : "Draft is not approved.",
        { draft_status: draft?.status ?? null },
        "Approve the draft before scheduling.",
      ));
      continue;
    }
    if (gateKey === "scheduled_collision_gate") {
      const timezone = input.scheduling?.timezone || dependencies.defaultTimezone;
      const date = input.scheduling?.date;
      const scheduled = date && dependencies.isValidIsoDate(date)
        ? await dependencies.listScheduledPosts({
          threadsUserId: input.threadsUserId,
          date,
          timezone,
        })
        : [];
      const sameText = scheduled.find(
        (post) => dependencies.normalizeComparableText(post.post_text) === normalizedDraft,
      );
      const sameTime = scheduled.find(
        (post) => input.scheduling?.time && post.local_time === input.scheduling.time,
      );
      if (sameText || sameTime) {
        results.push(buildOperatorGateResult(
          gate,
          "fail",
          sameText
            ? "Draft text collides with scheduled inventory."
            : "Requested time already has a scheduled post.",
          { scheduled_post_id: sameText?.id ?? sameTime?.id ?? null },
          "Choose a different draft or time.",
        ));
      } else {
        results.push(buildOperatorGateResult(gate, "pass", "No scheduled collision detected."));
      }
      continue;
    }
    if (String(gate.evaluator) === "model" || String(gate.evaluator) === "hybrid") {
      const modelResult = input.modelGateResults?.find((item) => item.gate_key === gateKey);
      if (modelResult?.result && modelResult?.rationale) {
        results.push(buildOperatorGateResult(
          gate,
          modelResult.result as OperatorGateResultValue,
          String(modelResult.rationale),
          modelResult.evidence && typeof modelResult.evidence === "object"
            ? modelResult.evidence as Record<string, unknown>
            : null,
          dependencies.normalizeText(modelResult.repair_guidance, 1000, true),
        ));
      } else {
        results.push(buildOperatorGateResult(
          gate,
          "fail",
          "Hybrid/model gate requires a recorded model or owner evaluation before showing.",
          null,
          "Submit the gate result rationale before marking this draft showable.",
        ));
      }
      continue;
    }
    results.push(buildOperatorGateResult(
      gate,
      "not_applicable",
      "Gate has no v1 backend evaluator for this context.",
    ));
  }

  if (results.length === 0) {
    results.push({
      gate_id: "required-gate-execution",
      gate_key: "required_gate_execution_gate",
      result: "fail",
      blocking: true,
      rationale: "No candidate gate executed for this context.",
      evaluated_by: "backend",
      evidence: { stage_scope: input.stageScope, source_card_id: input.sourceCardId ?? null },
      repair_guidance: "Load the applicable gates and provide the source card, candidate text, and required model evaluations before treating the candidate as showable.",
    });
  }

  if (input.draftId) {
    for (const result of results) {
      await dependencies.persistGateResult({
        brandKey: input.brandKey,
        draftId: input.draftId,
        sourceCardId: input.sourceCardId ?? null,
        result,
      });
    }
  }

  const blockingFailures = results.filter(
    (result) => result.blocking === true && result.result === "fail",
  );
  return {
    showable: blockingFailures.length === 0,
    gate_results: results,
    blocking_failures: blockingFailures,
    warnings,
  };
}



