export const MANIFEST_INTELLIGENCE_ENGINE_VERSION = "manifest-intelligence-engine-v1";
export const MANIFEST_SEMANTIC_SIGNATURE_VERSION = "manifest-semantic-signature-v1";
export const MANIFEST_MATURITY_EVALUATION_VERSION = "manifest-maturity-evaluation-v1";
export const MANIFEST_COMPARABLE_ANALYSIS_VERSION = "manifest-comparable-analysis-v1";
export const MANIFEST_MULTI_LEVEL_LEARNING_VERSION = "manifest-multi-level-learning-v1";
export const MANIFEST_CONTROLLED_EXPERIMENT_VERSION = "manifest-controlled-experiment-v1";
export const MANIFEST_ADAPTIVE_PORTFOLIO_VERSION = "manifest-adaptive-portfolio-v1";

export type ManifestPortfolioRole = "franchise" | "core" | "emerging" | "prospect" | "cooling" | "dormant";
export type ManifestConfidenceLabel = "insufficient" | "emerging" | "directional" | "reliable" | "contested";
export type ManifestExperimentDecision = "continue" | "expand" | "revise" | "stop" | "insufficient_evidence";

type JsonRecord = Record<string, unknown>;

export type ManifestSemanticSignature = {
  version: string;
  text_hash: string;
  question_type: string;
  financial_scenario_key: string;
  tension_key: string;
  audience_reward_key: string;
  sentence_architecture: string;
  opening_key: string;
  closing_key: string;
  premise_key: string;
  payoff_key: string;
  meaning_tokens: string[];
  dollar_amounts: string[];
  semantic_key: string;
};

export type ManifestSemanticComparison = {
  score: number;
  premise_similarity: number;
  execution_similarity: number;
  severity: "none" | "watch" | "high" | "collision";
  repeated_dimensions: string[];
  semantic_repetition: boolean;
};

export type ManifestMaturityEvaluation = {
  version: string;
  checkpoint_hours: number;
  maturity_state: "initial_signal" | "directional" | "strong_directional" | "authoritative";
  learning_weight: number;
  structural_change_allowed: boolean;
  performance_band: "breakout" | "strong" | "baseline" | "weak" | "severe_weakness";
  overall_score: number;
  distribution_state: string;
  metrics: JsonRecord;
  rates: JsonRecord;
  velocity: JsonRecord;
};

export type ManifestComparableCandidate = {
  published_post_id: string;
  checkpoint_hours: number;
  overall_score: number;
  family_key?: string | null;
  hook_style?: string | null;
  structure?: string | null;
  audience_reward?: string | null;
  format?: string | null;
  topic?: string | null;
  time_bucket?: string | null;
  semantic_signature?: ManifestSemanticSignature | null;
};

const STOP_WORDS = new Set([
  "a", "about", "after", "all", "an", "and", "are", "as", "at", "be", "because", "been", "before",
  "but", "by", "can", "could", "did", "do", "does", "for", "from", "had", "has", "have", "he", "her",
  "here", "him", "his", "how", "i", "if", "in", "into", "is", "it", "its", "just", "me", "more", "my",
  "no", "not", "of", "on", "or", "our", "out", "she", "so", "some", "that", "the", "their", "them",
  "then", "there", "these", "they", "this", "to", "up", "us", "was", "we", "were", "what", "when",
  "where", "which", "who", "why", "will", "with", "would", "you", "your", "youre",
]);

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function machine(value: unknown, fallback = "unknown"): string {
  const normalized = text(value, 240).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9$%]+/g, " ").replace(/\s+/g, " ").trim();
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as JsonRecord)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]));
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function unique(values: string[], limit = 24): string[] {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit);
}

function tokens(value: string): string[] {
  return unique(normalizeText(value).split(" ")
    .map((token) => token.replace(/^\$|[%.,]/g, ""))
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token) && !/^\d+$/.test(token)), 40);
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size && !rightSet.size) return 1;
  const intersection = Array.from(leftSet).filter((item) => rightSet.has(item)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union ? intersection / union : 0;
}

function median(values: number[]): number {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function timeBucket(value: unknown): string {
  const parsed = Date.parse(text(value, 100));
  if (!Number.isFinite(parsed)) return "unknown";
  const hour = new Date(parsed).getUTCHours();
  return hour < 6 ? "overnight" : hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

function inferQuestionType(normalized: string): string {
  if (!normalized.includes("?")) return "none";
  if (/\b(first|handle first|pay first|spend|do with|buy first|expense)\b/.test(normalized)) return "choice_priority";
  if (/\b(enough|sufficient)\b/.test(normalized)) return "sufficiency";
  if (/\b(restart|start over|begin again)\b/.test(normalized)) return "life_restart";
  if (/\b(who are you|which version|what kind of person)\b/.test(normalized)) return "identity";
  if (/\b(when|how soon|will it|will you)\b/.test(normalized)) return "prediction";
  return "open_question";
}

function inferFinancialScenario(normalized: string, amounts: string[]): string {
  if (/\b(restart|start over|begin again)\b/.test(normalized)) return "life_restart";
  if (amounts.length && /\b(first|handle|pay|spend|do with|buy|expense)\b/.test(normalized)) return "spending_priority";
  if (/\b(debt|mortgage|rent|bill|expense|loan|credit card)\b/.test(normalized)) return "debt_or_expense_relief";
  if (/\b(invest|portfolio|asset|stock|crypto|business)\b/.test(normalized)) return "investment_choice";
  if (/\b(income|salary|per month|a month|per year|a year)\b/.test(normalized)) return "income_target";
  if (amounts.length && /\b(arrive|reach|receive|received|win|won|touch|land|show up|deposit)\b/.test(normalized)) return "sudden_money";
  if (/\b(money|wealth|financial|dollar|cash|rich|millionaire)\b/.test(normalized)) return "general_financial_possibility";
  if (/\b(universe|manifest|blessing|abundance)\b/.test(normalized)) return "abundance_signal";
  return "none";
}

function inferTension(normalized: string): string {
  if (/\b(debt|bill|expense|pressure|burden|struggle)\b/.test(normalized) && /\b(clear|gone|free|relief|paid)\b/.test(normalized)) return "burden_to_relief";
  if (/\b(safe|security|secure|stable|freedom)\b/.test(normalized) && /\b(money|financial|income|debt)\b/.test(normalized)) return "scarcity_to_security";
  if (/\b(future|next version|becoming|new life)\b/.test(normalized)) return "current_self_to_future_self";
  if (/\b(trust|believe|know|certainty|sure|intuition)\b/.test(normalized)) return "uncertainty_to_certainty";
  if (/\b(stuck|delay|waiting|move|progress|momentum)\b/.test(normalized)) return "stagnation_to_momentum";
  if (/\b(first|choose|choice|priority)\b/.test(normalized)) return "choice_priority";
  return "none";
}

function inferReward(normalized: string, metadata: JsonRecord): string {
  const explicit = machine(metadata.audience_reward ?? metadata.required_product ?? metadata.expected_audience_reward, "");
  if (explicit) return explicit;
  if (machine(metadata.inferred_question_type, "none") !== "none" && array(metadata.dollar_amounts).length > 0) return "financial_choice";
  if (/\b(debt|bill|expense|mortgage|rent)\b/.test(normalized)) return "financial_relief";
  if (/\b(imagine|possible|possibility|what if|restart|new life)\b/.test(normalized)) return "possibility_expansion";
  if (/\b(trust|intuition|believe yourself|believe it)\b/.test(normalized)) return "self_trust";
  if (/\b(you deserve|worthy|enough|valid)\b/.test(normalized)) return "validation";
  if (normalized.includes("?")) return "participation";
  if (/\b(universe|manifest|abundance|blessing)\b/.test(normalized)) return "hope_and_certainty";
  return "general_encouragement";
}

function inferArchitecture(raw: string, normalized: string, amounts: string[]): string {
  const letters = raw.replace(/[^A-Za-z]/g, "");
  const uppercase = letters.length ? letters.replace(/[^A-Z]/g, "").length / letters.length : 0;
  const sentences = raw.split(/[.!?]+|\n+/).map((item) => item.trim()).filter(Boolean);
  if (uppercase >= 0.65 && letters.length >= 10) return "all_caps_directive";
  if (amounts.length && normalized.includes("?")) return "specific_amount_question";
  if (/^(if|when|once)\b/.test(normalized) && sentences.length >= 2) return "conditional_payoff";
  if (normalized.includes("?")) return "direct_question";
  if (/^(repeat|say|trust|believe|remember|choose|stop|never|let)\b/.test(normalized)) return "directive_declaration";
  if (sentences.length === 1) return "single_declaration";
  if (sentences.length === 2) return "two_step_claim";
  return "multi_step_claim";
}

export function buildManifestSemanticSignature(input: {
  text: string;
  metadata?: JsonRecord | null;
}): ManifestSemanticSignature {
  const raw = text(input.text, 20000);
  const normalized = normalizeText(raw);
  const metadata = record(input.metadata);
  const amounts = unique((raw.match(/\$\s?[\d,.]+(?:\s?(?:k|m|million|thousand))?/gi) ?? [])
    .map((amount) => amount.toLowerCase().replace(/\s+/g, "")), 12);
  const questionType = inferQuestionType(`${normalized}${raw.includes("?") ? "?" : ""}`);
  const scenario = inferFinancialScenario(normalized, amounts);
  const tension = inferTension(normalized);
    const reward = inferReward(normalized, { ...metadata, inferred_question_type: questionType, dollar_amounts: amounts });
  const architecture = inferArchitecture(raw, `${normalized}${raw.includes("?") ? "?" : ""}`, amounts);
  const meaningTokens = tokens(raw);
  const significant = normalizeText(raw).split(" ").filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  const opening = significant.slice(0, 6).join("_") || "none";
  const closing = significant.slice(-6).join("_") || "none";
  const premiseKey = `${questionType}:${scenario}:${tension}`;
  const payoffKey = `${reward}:${closing}`;
  return {
    version: MANIFEST_SEMANTIC_SIGNATURE_VERSION,
    text_hash: fnv1a(normalized),
    question_type: questionType,
    financial_scenario_key: scenario,
    tension_key: tension,
    audience_reward_key: reward,
    sentence_architecture: architecture,
    opening_key: opening,
    closing_key: closing,
    premise_key: premiseKey,
    payoff_key: payoffKey,
    meaning_tokens: meaningTokens,
    dollar_amounts: amounts,
    semantic_key: fnv1a(stableJson({ questionType, scenario, tension, reward, architecture, meaningTokens })),
  };
}

export function compareManifestSemanticSignatures(
  left: ManifestSemanticSignature,
  right: ManifestSemanticSignature,
): ManifestSemanticComparison {
  const repeated: string[] = [];
  const exact = (dimension: keyof ManifestSemanticSignature): number => {
    const matches = left[dimension] === right[dimension] && left[dimension] !== "none" && left[dimension] !== "unknown";
    if (matches) repeated.push(String(dimension));
    return matches ? 1 : 0;
  };
  const tokenOverlap = jaccard(left.meaning_tokens, right.meaning_tokens);
  const premise = clamp(
    exact("question_type") * 0.3
    + exact("financial_scenario_key") * 0.35
    + exact("tension_key") * 0.2
    + exact("audience_reward_key") * 0.15,
  );
  const execution = clamp(
    exact("sentence_architecture") * 0.35
    + exact("opening_key") * 0.2
    + exact("closing_key") * 0.15
    + tokenOverlap * 0.3,
  );
  const score = clamp(premise * 0.68 + execution * 0.32);
  const semanticRepetition = premise >= 0.65 && (score >= 0.7 || (left.premise_key === right.premise_key && execution >= 0.25));
    const samePremiseArchitecture = left.premise_key === right.premise_key
    && left.sentence_architecture === right.sentence_architecture
    && left.premise_key !== "none:none:none";
  const severity: ManifestSemanticComparison["severity"] = score >= 0.86 || (premise >= 0.85 && execution >= 0.55) || samePremiseArchitecture
    ? "collision"
    : semanticRepetition && score >= 0.76
      ? "high"
      : score >= 0.58
        ? "watch"
        : "none";
  return {
    score: Number(score.toFixed(4)),
    premise_similarity: Number(premise.toFixed(4)),
    execution_similarity: Number(execution.toFixed(4)),
    severity,
    repeated_dimensions: unique(repeated),
    semantic_repetition: semanticRepetition,
  };
}

export function buildManifestMaturityEvaluation(input: {
  checkpoint_hours: number;
  metrics: JsonRecord;
  rates: JsonRecord;
  velocity: JsonRecord;
  scores: JsonRecord;
  distribution_state: string;
}): ManifestMaturityEvaluation {
  const checkpoint = Number(input.checkpoint_hours);
  if (![6, 12, 18, 24].includes(checkpoint)) throw new Error("manifest_maturity_checkpoint_invalid");
  const overall = clamp(number(input.scores.overall, 50), 0, 100);
  const maturityState: ManifestMaturityEvaluation["maturity_state"] = checkpoint === 24
    ? "authoritative"
    : checkpoint === 18
      ? "strong_directional"
      : checkpoint === 12
        ? "directional"
        : "initial_signal";
  const band: ManifestMaturityEvaluation["performance_band"] = overall >= 75
    ? "breakout"
    : overall >= 60
      ? "strong"
      : overall >= 40
        ? "baseline"
        : overall >= 25
          ? "weak"
          : "severe_weakness";
  return {
    version: MANIFEST_MATURITY_EVALUATION_VERSION,
    checkpoint_hours: checkpoint,
    maturity_state: maturityState,
    learning_weight: checkpoint / 24,
    structural_change_allowed: checkpoint === 24,
    performance_band: band,
    overall_score: Number(overall.toFixed(2)),
    distribution_state: machine(input.distribution_state, "unknown"),
    metrics: record(input.metrics),
    rates: record(input.rates),
    velocity: record(input.velocity),
  };
}

export function buildManifestComparableAnalysis(
  target: ManifestComparableCandidate,
  candidates: ManifestComparableCandidate[],
): JsonRecord {
  const scored = candidates
    .filter((candidate) => candidate.published_post_id !== target.published_post_id && candidate.checkpoint_hours === target.checkpoint_hours)
    .map((candidate) => {
      const dimensions: string[] = ["maturity"];
      let score = 0.08;
      const add = (condition: boolean, weight: number, dimension: string): void => {
        if (condition) { score += weight; dimensions.push(dimension); }
      };
      add(Boolean(target.family_key && candidate.family_key && target.family_key === candidate.family_key), 0.28, "family");
      add(Boolean(target.hook_style && candidate.hook_style && target.hook_style === candidate.hook_style), 0.14, "hook");
      add(Boolean(target.structure && candidate.structure && target.structure === candidate.structure), 0.1, "structure");
      add(Boolean(target.audience_reward && candidate.audience_reward && target.audience_reward === candidate.audience_reward), 0.14, "reward");
      add(Boolean(target.format && candidate.format && target.format === candidate.format), 0.08, "format");
      add(Boolean(target.topic && candidate.topic && target.topic === candidate.topic), 0.08, "topic");
      add(Boolean(target.time_bucket && candidate.time_bucket && target.time_bucket === candidate.time_bucket), 0.05, "time_range");
      if (target.semantic_signature && candidate.semantic_signature) {
        const semantic = compareManifestSemanticSignatures(target.semantic_signature, candidate.semantic_signature);
        score += semantic.premise_similarity * 0.05;
        if (semantic.premise_similarity >= 0.65) dimensions.push("premise");
      }
      return { candidate, score: clamp(score), dimensions: unique(dimensions) };
    })
    .filter((entry) => entry.score >= 0.34)
    .sort((left, right) => right.score - left.score || right.candidate.overall_score - left.candidate.overall_score)
    .slice(0, 20);
  const comparableScores = scored.map((entry) => entry.candidate.overall_score);
  const comparableMedian = median(comparableScores);
  const below = comparableScores.filter((value) => value < target.overall_score).length;
  const percentile = comparableScores.length ? ((below + 0.5) / comparableScores.length) * 100 : 50;
  return {
    version: MANIFEST_COMPARABLE_ANALYSIS_VERSION,
    published_post_id: target.published_post_id,
    checkpoint_hours: target.checkpoint_hours,
    criteria: ["age", "family", "hook", "structure", "reward", "format", "topic", "time_range", "maturity"],
    comparable_post_ids: scored.map((entry) => entry.candidate.published_post_id),
    comparables: scored.map((entry) => ({
      published_post_id: entry.candidate.published_post_id,
      match_score: Number(entry.score.toFixed(4)),
      matched_dimensions: entry.dimensions,
      overall_score: entry.candidate.overall_score,
    })),
    comparable_count: scored.length,
    comparable_median_overall: Number(comparableMedian.toFixed(2)),
    target_overall: Number(target.overall_score.toFixed(2)),
    delta_from_comparable_median: Number((target.overall_score - comparableMedian).toFixed(2)),
    comparable_percentile: Number((clamp(percentile / 100) * 100).toFixed(2)),
  };
}

export function buildManifestLearningDimensions(input: {
  published_post_id: string;
  fingerprint: JsonRecord;
  semantic_signature: ManifestSemanticSignature;
  family_key?: string | null;
  source_identity_key?: string | null;
  generation_mode?: string | null;
  placement_key?: string | null;
  sequence_key?: string | null;
}): Array<{ level: string; feature_key: string }> {
  const fingerprint = record(input.fingerprint);
  const dimensions = [
    { level: "exact_post", feature_key: input.published_post_id },
    { level: "hook", feature_key: machine(fingerprint.hook_style, "unknown") },
    { level: "premise", feature_key: input.semantic_signature.premise_key },
    { level: "payoff", feature_key: input.semantic_signature.payoff_key },
    { level: "emotional_reward", feature_key: input.semantic_signature.audience_reward_key },
    { level: "structure", feature_key: machine(fingerprint.structure ?? input.semantic_signature.sentence_architecture, "unknown") },
    { level: "topic", feature_key: machine(fingerprint.topic, "unknown") },
    { level: "family", feature_key: machine(input.family_key, "unknown") },
    { level: "source", feature_key: machine(input.source_identity_key, "unknown") },
    { level: "generation_mode", feature_key: machine(input.generation_mode, "unknown") },
    { level: "placement", feature_key: machine(input.placement_key, "unknown") },
    { level: "sequence", feature_key: machine(input.sequence_key, "unknown") },
  ];
  return dimensions.filter((item) => item.feature_key !== "unknown");
}

export function deriveManifestConfidenceTransition(input: {
  sample_size: number;
  supporting_count: number;
  contradicting_count: number;
  effect_size: number;
  previous_label?: ManifestConfidenceLabel | null;
  authoritative_sample_size?: number;
}): { label: ManifestConfidenceLabel; score: number; transition_allowed: boolean; reason: string } {
  const sample = Math.max(0, Math.trunc(input.sample_size));
  const authoritative = Math.max(0, Math.trunc(input.authoritative_sample_size ?? sample));
  const support = Math.max(0, Math.trunc(input.supporting_count));
  const contradiction = Math.max(0, Math.trunc(input.contradicting_count));
  const totalDirectional = support + contradiction;
  const contradictionRatio = totalDirectional ? Math.min(support, contradiction) / totalDirectional : 0;
  const evidenceComponent = clamp(authoritative / 8) * 0.65;
  const effectComponent = clamp(Math.abs(input.effect_size) / 20) * 0.25;
  const consistencyComponent = (1 - contradictionRatio) * 0.1;
  const score = Number(((evidenceComponent + effectComponent + consistencyComponent) * 100).toFixed(2));
  let label: ManifestConfidenceLabel = "insufficient";
  if (authoritative >= 4 && contradictionRatio >= 0.35) label = "contested";
  else if (authoritative >= 8 && score >= 72) label = "reliable";
  else if (authoritative >= 4 && score >= 48) label = "directional";
  else if (authoritative >= 2) label = "emerging";
  const allowed = authoritative >= 3 && ["directional", "reliable", "contested"].includes(label);
  return {
    label,
    score,
    transition_allowed: allowed,
    reason: label === "contested"
      ? "Mature evidence is materially mixed, so the belief remains active but cannot be treated as settled."
      : allowed
        ? "Enough authoritative 24-hour evidence exists to permit a confidence-state transition."
        : "Structural strategy changes remain blocked until more authoritative 24-hour evidence exists.",
  };
}

export function deriveManifestPortfolioState(input: {
  current_role?: ManifestPortfolioRole | null;
  mature_count: number;
  median_overall: number;
  recent_median_overall?: number | null;
  baseline_median_overall?: number | null;
  strong_count: number;
  weak_count: number;
  semantic_repetition_ratio?: number;
  confidence_label: ManifestConfidenceLabel;
}): { role: ManifestPortfolioRole; recommended_role: ManifestPortfolioRole; transition_allowed: boolean; actual_decay: boolean; allocation_weight: number; reason: string } {
  const current = input.current_role ?? "prospect";
  const mature = Math.max(0, Math.trunc(input.mature_count));
  const medianOverall = number(input.median_overall, 50);
  const recent = input.recent_median_overall === null || input.recent_median_overall === undefined ? medianOverall : number(input.recent_median_overall, medianOverall);
  const baseline = input.baseline_median_overall === null || input.baseline_median_overall === undefined ? medianOverall : number(input.baseline_median_overall, medianOverall);
  const decay = mature >= 4 && baseline - recent >= 12;
  let recommended: ManifestPortfolioRole = "prospect";
  let reason = "Evidence is still developing, so the family remains a prospect without a fixed quota.";
  if (decay) {
    recommended = "cooling";
    reason = "Comparable mature evidence shows a material recent decline; frequency alone did not trigger cooling.";
  } else if (mature >= 5 && medianOverall >= 65 && input.strong_count >= 2) {
    recommended = "franchise";
    reason = "Repeated mature strength earns franchise status and continued opportunity.";
  } else if (mature >= 4 && medianOverall >= 52) {
    recommended = "core";
    reason = "Mature evidence supports dependable engagement-floor duty.";
  } else if (input.strong_count >= 1 || (mature >= 2 && medianOverall >= 56)) {
    recommended = "emerging";
    reason = "Promising mature evidence warrants deliberate development.";
  } else if (mature >= 5 && medianOverall <= 35 && input.weak_count >= 4 && input.strong_count === 0) {
    recommended = "dormant";
    reason = "Repeated mature weakness removes the family from current duty without deleting it.";
  }
  const transitionAllowed = ["directional", "reliable"].includes(input.confidence_label) || recommended === "prospect";
  const role = transitionAllowed ? recommended : current;
  const weights: Record<ManifestPortfolioRole, number> = { franchise: 1.6, core: 1.3, emerging: 1.15, prospect: 1, cooling: 0.25, dormant: 0 };
  return {
    role,
    recommended_role: recommended,
    transition_allowed: transitionAllowed,
    actual_decay: decay,
    allocation_weight: weights[role],
    reason: transitionAllowed ? reason : `${reason} The current role is preserved until confidence becomes directional.`,
  };
}

export function evaluateManifestExperiment(input: {
  variant_scores: number[];
  control_scores: number[];
  minimum_variant?: number;
  minimum_control?: number;
  win_delta?: number;
  loss_delta?: number;
}): { decision: ManifestExperimentDecision; variant_median: number; control_median: number; delta: number; reason: string } {
  const minimumVariant = Math.max(1, Math.trunc(input.minimum_variant ?? 3));
  const minimumControl = Math.max(1, Math.trunc(input.minimum_control ?? 3));
  const variantMedian = median(input.variant_scores);
  const controlMedian = median(input.control_scores);
  const delta = variantMedian - controlMedian;
  if (input.variant_scores.length < minimumVariant || input.control_scores.length < minimumControl) {
    return { decision: "insufficient_evidence", variant_median: variantMedian, control_median: controlMedian, delta, reason: "The experiment has not reached its mature comparison-group minimums." };
  }
  if (delta >= number(input.win_delta, 8)) return { decision: "expand", variant_median: variantMedian, control_median: controlMedian, delta, reason: "The mature variant median exceeds the matched control median by the win threshold." };
  if (delta <= number(input.loss_delta, -8)) return { decision: "stop", variant_median: variantMedian, control_median: controlMedian, delta, reason: "The mature variant median trails the matched control median by the loss threshold." };
  if (Math.abs(delta) <= 3) return { decision: "revise", variant_median: variantMedian, control_median: controlMedian, delta, reason: "The mature effect is neutral; revise one variable before another test." };
  return { decision: "continue", variant_median: variantMedian, control_median: controlMedian, delta, reason: "The effect is directional but has not crossed a terminal threshold." };
}

export async function ensureManifestIntelligenceEngineTables(db: D1Database): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS operator_manifest_semantic_signatures (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, content_type TEXT NOT NULL, content_id TEXT NOT NULL,
      scheduled_post_id INTEGER, published_post_id TEXT, observed_at TEXT, text_hash TEXT NOT NULL,
      signature_version TEXT NOT NULL, signature_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, content_type, content_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_manifest_semantic_signatures_recent
      ON operator_manifest_semantic_signatures (brand_key, observed_at DESC, updated_at DESC)`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_maturity_evaluations (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, published_post_id TEXT NOT NULL, checkpoint_hours INTEGER NOT NULL,
      evaluation_version TEXT NOT NULL, evaluation_json TEXT NOT NULL, structural_change_allowed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, published_post_id, checkpoint_hours)
    )`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_comparable_analyses (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, published_post_id TEXT NOT NULL, checkpoint_hours INTEGER NOT NULL,
      analysis_version TEXT NOT NULL, comparable_post_ids_json TEXT NOT NULL, analysis_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, published_post_id, checkpoint_hours)
    )`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_learning_observations (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, level TEXT NOT NULL, feature_key TEXT NOT NULL,
      checkpoint_hours INTEGER NOT NULL DEFAULT 24, sample_size INTEGER NOT NULL, supporting_count INTEGER NOT NULL,
      contradicting_count INTEGER NOT NULL, median_overall REAL NOT NULL, effect_size REAL NOT NULL,
      confidence_score REAL NOT NULL, confidence_label TEXT NOT NULL, state TEXT NOT NULL,
      evidence_json TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, learning_version TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, level, feature_key, checkpoint_hours)
    )`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_portfolio_states (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, family_key TEXT NOT NULL, role TEXT NOT NULL,
      recommended_role TEXT NOT NULL, previous_role TEXT, confidence_score REAL NOT NULL,
      confidence_label TEXT NOT NULL, allocation_weight REAL NOT NULL, actual_decay INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL, evidence_json TEXT NOT NULL, portfolio_version TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, family_key)
    )`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_state_transitions (
      id TEXT PRIMARY KEY, transition_key TEXT NOT NULL UNIQUE, brand_key TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, from_state TEXT, to_state TEXT NOT NULL,
      reason TEXT NOT NULL, evidence_json TEXT NOT NULL, transitioned_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_experiments (
      id TEXT PRIMARY KEY, brand_key TEXT NOT NULL, experiment_key TEXT NOT NULL, family_key TEXT,
      hypothesis_json TEXT NOT NULL, comparison_group_json TEXT NOT NULL, maturity_windows_json TEXT NOT NULL,
      result_criteria_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'running', latest_result_json TEXT NOT NULL DEFAULT '{}',
      follow_up_decision TEXT, experiment_version TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(brand_key, experiment_key)
    )`,
    `CREATE TABLE IF NOT EXISTS operator_manifest_experiment_assignments (
      id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL, brand_key TEXT NOT NULL, cycle_id TEXT,
      slot_key TEXT, hypothesis_id TEXT, scheduled_post_id INTEGER, published_post_id TEXT,
      variant_key TEXT NOT NULL DEFAULT 'variant', status TEXT NOT NULL DEFAULT 'scheduled',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(experiment_id, scheduled_post_id)
    )`,
  ];
  await db.batch(statements.map((statement) => db.prepare(statement)));
}

export async function upsertManifestLearningObservation(db: D1Database, input: {
  brand_key: string;
  level: string;
  feature_key: string;
  sample_size: number;
  supporting_count: number;
  contradicting_count: number;
  median_overall: number;
  effect_size: number;
  confidence_score: number;
  confidence_label: ManifestConfidenceLabel;
  state: string;
  evidence: JsonRecord;
  reason: string;
}): Promise<{ transitioned: boolean; from_state: string | null; to_state: string }> {
  await ensureManifestIntelligenceEngineTables(db);
  const previous = await db.prepare(`SELECT confidence_label, state
    FROM operator_manifest_learning_observations
    WHERE brand_key = ? AND level = ? AND feature_key = ? AND checkpoint_hours = 24 LIMIT 1`)
    .bind(input.brand_key, input.level, input.feature_key).first<JsonRecord>();
  const evidenceJson = stableJson(input.evidence);
  await db.prepare(`INSERT INTO operator_manifest_learning_observations (
    id, brand_key, level, feature_key, checkpoint_hours, sample_size, supporting_count,
    contradicting_count, median_overall, effect_size, confidence_score, confidence_label,
    state, evidence_json, active, learning_version
  ) VALUES (?, ?, ?, ?, 24, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  ON CONFLICT(brand_key, level, feature_key, checkpoint_hours) DO UPDATE SET
    sample_size = excluded.sample_size, supporting_count = excluded.supporting_count,
    contradicting_count = excluded.contradicting_count, median_overall = excluded.median_overall,
    effect_size = excluded.effect_size, confidence_score = excluded.confidence_score,
    confidence_label = excluded.confidence_label, state = excluded.state,
    evidence_json = excluded.evidence_json, active = 1, learning_version = excluded.learning_version,
    updated_at = CURRENT_TIMESTAMP`).bind(
    crypto.randomUUID(), input.brand_key, input.level, input.feature_key, input.sample_size,
    input.supporting_count, input.contradicting_count, input.median_overall, input.effect_size,
    input.confidence_score, input.confidence_label, input.state, evidenceJson,
    MANIFEST_MULTI_LEVEL_LEARNING_VERSION,
  ).run();
  const previousLabel = previous?.confidence_label ? machine(previous.confidence_label, "insufficient") : null;
  const transitioned = previousLabel !== input.confidence_label;
  if (transitioned) {
    const entityId = `${input.level}:${input.feature_key}`;
    const transitionKey = fnv1a(`${input.brand_key}|confidence|${entityId}|${previousLabel ?? "none"}|${input.confidence_label}|${evidenceJson}`);
    await db.prepare(`INSERT OR IGNORE INTO operator_manifest_state_transitions (
      id, transition_key, brand_key, entity_type, entity_id, from_state, to_state,
      reason, evidence_json, transitioned_at
    ) VALUES (?, ?, ?, 'confidence', ?, ?, ?, ?, ?, ?)`).bind(
      crypto.randomUUID(), transitionKey, input.brand_key, entityId, previousLabel,
      input.confidence_label, input.reason, evidenceJson, new Date().toISOString(),
    ).run();
  }
  return { transitioned, from_state: previousLabel, to_state: input.confidence_label };
}

export async function upsertManifestSemanticSignature(db: D1Database, input: {
  brand_key: string;
  content_type: "published" | "scheduled" | "candidate";
  content_id: string;
  text: string;
  metadata?: JsonRecord | null;
  scheduled_post_id?: number | null;
  published_post_id?: string | null;
  observed_at?: string | null;
}): Promise<ManifestSemanticSignature> {
  await ensureManifestIntelligenceEngineTables(db);
  const signature = buildManifestSemanticSignature({ text: input.text, metadata: input.metadata });
  await db.prepare(`INSERT INTO operator_manifest_semantic_signatures (
    id, brand_key, content_type, content_id, scheduled_post_id, published_post_id, observed_at,
    text_hash, signature_version, signature_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(brand_key, content_type, content_id) DO UPDATE SET
    scheduled_post_id = excluded.scheduled_post_id, published_post_id = excluded.published_post_id,
    observed_at = excluded.observed_at, text_hash = excluded.text_hash,
    signature_version = excluded.signature_version, signature_json = excluded.signature_json,
    updated_at = CURRENT_TIMESTAMP`).bind(
    crypto.randomUUID(), input.brand_key, input.content_type, input.content_id,
    input.scheduled_post_id ?? null, input.published_post_id ?? null, input.observed_at ?? null,
    signature.text_hash, MANIFEST_SEMANTIC_SIGNATURE_VERSION, stableJson(signature),
  ).run();
  return signature;
}

export async function analyzeManifestCandidateRepetition(db: D1Database, input: {
  brand_key: string;
  text: string;
  metadata?: JsonRecord | null;
  candidate_slot_utc?: string | null;
  exclude_scheduled_post_id?: number | null;
  recent_hours?: number;
  future_hours?: number;
}): Promise<JsonRecord> {
  await ensureManifestIntelligenceEngineTables(db);
  const signature = buildManifestSemanticSignature({ text: input.text, metadata: input.metadata });
  const recentHours = Math.max(1, Math.min(168, Math.trunc(input.recent_hours ?? 48)));
  const futureHours = Math.max(1, Math.min(168, Math.trunc(input.future_hours ?? 48)));
  const rows = await db.prepare(`SELECT content_type, content_id, scheduled_post_id, published_post_id,
      observed_at, signature_json
    FROM operator_manifest_semantic_signatures
    WHERE brand_key = ?
      AND (observed_at IS NULL OR datetime(observed_at) BETWEEN datetime('now', ?) AND datetime('now', ?))
    ORDER BY datetime(observed_at) DESC, datetime(updated_at) DESC LIMIT 200`).bind(
      input.brand_key, `-${recentHours} hours`, `+${futureHours} hours`,
    ).all<JsonRecord>();
  const candidateMs = Date.parse(text(input.candidate_slot_utc, 100)) || Date.now();
  const matches = (rows.results ?? []).map((row) => {
    if (input.exclude_scheduled_post_id && number(row.scheduled_post_id) === input.exclude_scheduled_post_id) return null;
    const existing = parseJson(row.signature_json, null) as ManifestSemanticSignature | null;
    if (!existing) return null;
    const comparison = compareManifestSemanticSignatures(signature, existing);
    const observedMs = Date.parse(text(row.observed_at, 100));
    const hoursApart = Number.isFinite(observedMs) ? Math.abs(candidateMs - observedMs) / 3600000 : Number.POSITIVE_INFINITY;
    const blockingWindowHours = row.content_type === "scheduled" ? 24 : 12;
    const blocking = comparison.severity === "collision" && hoursApart <= blockingWindowHours;
    return {
      content_type: row.content_type,
      content_id: row.content_id,
      scheduled_post_id: row.scheduled_post_id ?? null,
      published_post_id: row.published_post_id ?? null,
      observed_at: row.observed_at ?? null,
      hours_apart: Number.isFinite(hoursApart) ? Number(hoursApart.toFixed(3)) : null,
      blocking,
      ...comparison,
    };
  }).filter((item) => item !== null && number(item.score) >= 0.58) as Array<JsonRecord & ManifestSemanticComparison>;
  matches.sort((left, right) => number(right.score) - number(left.score));
  matches.splice(20);
  const collision = matches.find((match) => match.blocking === true) ?? null;
  const high = matches.find((match) => match.severity === "high" || match.severity === "collision") ?? null;
  return {
    engine_version: MANIFEST_INTELLIGENCE_ENGINE_VERSION,
    signature,
    collision,
    high_similarity: high,
    matches,
    semantic_repetition_blocked: Boolean(collision),
    highest_score: matches.length ? number(matches[0].score) : 0,
  };
}

export async function registerManifestExperimentAssignment(db: D1Database, input: {
  brand_key: string;
  cycle_id: string;
  slot_key: string;
  family_key: string;
  hypothesis_id: string;
  scheduled_post_id: number;
  experiment?: JsonRecord | null;
}): Promise<JsonRecord | null> {
  const experiment = record(input.experiment);
  const experimentKey = machine(experiment.experiment_key ?? experiment.key, "");
  if (!experimentKey) return null;
  await ensureManifestIntelligenceEngineTables(db);
  const existing = await db.prepare(`SELECT id FROM operator_manifest_experiments
    WHERE brand_key = ? AND experiment_key = ? LIMIT 1`).bind(input.brand_key, experimentKey).first<{ id: string }>();
  const experimentId = existing?.id ?? crypto.randomUUID();
  const hypothesis = record(experiment.hypothesis);
  const comparisonGroup = record(experiment.comparison_group);
  const maturityWindows = array(experiment.maturity_windows).length ? array(experiment.maturity_windows) : [6, 12, 18, 24];
  const criteria = Object.keys(record(experiment.result_criteria)).length
    ? record(experiment.result_criteria)
    : { minimum_variant: 3, minimum_control: 3, win_delta: 8, loss_delta: -8 };
  await db.prepare(`INSERT INTO operator_manifest_experiments (
    id, brand_key, experiment_key, family_key, hypothesis_json, comparison_group_json,
    maturity_windows_json, result_criteria_json, status, experiment_version
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?)
  ON CONFLICT(brand_key, experiment_key) DO UPDATE SET
    family_key = excluded.family_key, hypothesis_json = excluded.hypothesis_json,
    comparison_group_json = excluded.comparison_group_json,
    maturity_windows_json = excluded.maturity_windows_json, result_criteria_json = excluded.result_criteria_json,
    status = CASE WHEN operator_manifest_experiments.status IN ('completed', 'stopped') THEN operator_manifest_experiments.status ELSE 'running' END,
    updated_at = CURRENT_TIMESTAMP`).bind(
    experimentId, input.brand_key, experimentKey, input.family_key,
    stableJson(hypothesis), stableJson(comparisonGroup), stableJson(maturityWindows), stableJson(criteria),
    MANIFEST_CONTROLLED_EXPERIMENT_VERSION,
  ).run();
  const variantKey = machine(experiment.variant_key, "variant");
  await db.prepare(`INSERT INTO operator_manifest_experiment_assignments (
    id, experiment_id, brand_key, cycle_id, slot_key, hypothesis_id, scheduled_post_id, variant_key, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
  ON CONFLICT(experiment_id, scheduled_post_id) DO UPDATE SET
    cycle_id = excluded.cycle_id, slot_key = excluded.slot_key, hypothesis_id = excluded.hypothesis_id,
    variant_key = excluded.variant_key, updated_at = CURRENT_TIMESTAMP`).bind(
    crypto.randomUUID(), experimentId, input.brand_key, input.cycle_id, input.slot_key,
    input.hypothesis_id, input.scheduled_post_id, variantKey,
  ).run();
  return { id: experimentId, experiment_key: experimentKey, variant_key: variantKey, status: "running" };
}

export async function refreshManifestIntelligenceEngine(db: D1Database, input: {
  brand_key: string;
  threads_user_id: string;
}): Promise<JsonRecord> {
  await ensureManifestIntelligenceEngineTables(db);
  const published = await db.prepare(`SELECT a.post_id, a.post_text, a.post_timestamp,
      s.id AS scheduled_post_id, t.hook_style, t.pillar, t.format, t.metadata_json,
      f.fingerprint_json, c.family_id, fam.source_identity_key,
      l.generation_mode, l.slot_time
    FROM threads_posts_archive a
    LEFT JOIN scheduled_posts s ON s.threads_user_id = a.threads_user_id AND s.published_post_id = a.post_id
    LEFT JOIN gpt_post_strategy_tags t ON t.scheduled_post_id = s.id
    LEFT JOIN operator_post_fingerprints f ON f.brand_key = ? AND f.published_post_id = a.post_id
    LEFT JOIN gpt_generation_drafts d ON d.scheduled_post_id = s.id
    LEFT JOIN operator_source_cards c ON c.id = d.source_card_id AND c.brand_key = ?
    LEFT JOIN operator_source_card_families fam ON fam.id = c.family_id AND fam.brand_key = ?
    LEFT JOIN operator_autonomous_lineup_items l ON l.scheduled_post_id = s.id AND l.brand_key = ?
    WHERE a.threads_user_id = ?
    ORDER BY datetime(a.post_timestamp) DESC LIMIT 250`).bind(
      input.brand_key, input.brand_key, input.brand_key, input.brand_key, input.threads_user_id,
    ).all<JsonRecord>();
  const publishedRows = published.results ?? [];
  for (const row of publishedRows) {
    await upsertManifestSemanticSignature(db, {
      brand_key: input.brand_key,
      content_type: "published",
      content_id: String(row.post_id),
      text: text(row.post_text, 20000),
      metadata: {
        hook_style: row.hook_style,
        topic: row.pillar,
        format: row.format,
        ...record(parseJson(row.metadata_json, {})),
      },
      scheduled_post_id: row.scheduled_post_id === null || row.scheduled_post_id === undefined ? null : number(row.scheduled_post_id),
      published_post_id: String(row.post_id),
      observed_at: text(row.post_timestamp, 100) || null,
    });
  }
  const scheduled = await db.prepare(`SELECT s.id, s.post_text, s.scheduled_time, t.hook_style, t.pillar,
      t.format, t.metadata_json, l.family_key, l.generation_mode
    FROM scheduled_posts s
    LEFT JOIN gpt_post_strategy_tags t ON t.scheduled_post_id = s.id
    LEFT JOIN operator_autonomous_lineup_items l ON l.scheduled_post_id = s.id AND l.brand_key = ?
    WHERE s.threads_user_id = ? AND s.status IN ('approved', 'posting') AND datetime(s.scheduled_time) >= datetime('now')
    ORDER BY datetime(s.scheduled_time) ASC LIMIT 168`).bind(input.brand_key, input.threads_user_id).all<JsonRecord>();
  for (const row of scheduled.results ?? []) {
    await upsertManifestSemanticSignature(db, {
      brand_key: input.brand_key,
      content_type: "scheduled",
      content_id: String(row.id),
      text: text(row.post_text, 20000),
      metadata: {
        hook_style: row.hook_style,
        topic: row.pillar,
        format: row.format,
        family_key: row.family_key,
        generation_mode: row.generation_mode,
        ...record(parseJson(row.metadata_json, {})),
      },
      scheduled_post_id: number(row.id),
      observed_at: text(row.scheduled_time, 100) || null,
    });
  }
  const scoreRows = await db.prepare(`SELECT s.published_post_id, s.checkpoint_hours, s.metrics_json,
      s.rates_json, s.velocity_json, s.scores_json, s.distribution_state,
      f.fingerprint_json, sig.signature_json, c.family_id, fam.source_identity_key,
      l.family_key AS autonomous_family_key, l.generation_mode, l.slot_time, a.post_text, a.post_timestamp
    FROM operator_post_performance_scores s
    JOIN operator_post_fingerprints f ON f.brand_key = s.brand_key AND f.published_post_id = s.published_post_id
    LEFT JOIN operator_manifest_semantic_signatures sig ON sig.brand_key = s.brand_key
      AND sig.content_type = 'published' AND sig.content_id = s.published_post_id
    LEFT JOIN gpt_generation_drafts d ON d.scheduled_post_id = f.scheduled_post_id
    LEFT JOIN operator_source_cards c ON c.id = d.source_card_id AND c.brand_key = s.brand_key
    LEFT JOIN operator_source_card_families fam ON fam.id = c.family_id AND fam.brand_key = s.brand_key
    LEFT JOIN operator_autonomous_lineup_items l ON l.scheduled_post_id = f.scheduled_post_id AND l.brand_key = s.brand_key
    LEFT JOIN threads_posts_archive a ON a.post_id = s.published_post_id
    WHERE s.brand_key = ? AND s.valid_for_learning = 1
    ORDER BY s.checkpoint_hours ASC, datetime(a.post_timestamp) ASC, datetime(s.updated_at) ASC`).bind(input.brand_key).all<JsonRecord>();
  const candidates: ManifestComparableCandidate[] = [];
  const maturityRows: Array<{ row: JsonRecord; maturity: ManifestMaturityEvaluation; fingerprint: JsonRecord; signature: ManifestSemanticSignature; family_key: string; source_identity_key: string; generation_mode: string; placement_key: string }> = [];
  for (const row of scoreRows.results ?? []) {
    const fingerprint = record(parseJson(row.fingerprint_json, {}));
    const signature = parseJson(row.signature_json, null) as ManifestSemanticSignature | null
      ?? buildManifestSemanticSignature({ text: text(row.post_text, 20000), metadata: fingerprint });
    const maturity = buildManifestMaturityEvaluation({
      checkpoint_hours: number(row.checkpoint_hours),
      metrics: record(parseJson(row.metrics_json, {})),
      rates: record(parseJson(row.rates_json, {})),
      velocity: record(parseJson(row.velocity_json, {})),
      scores: record(parseJson(row.scores_json, {})),
      distribution_state: text(row.distribution_state, 80),
    });
    await db.prepare(`INSERT INTO operator_manifest_maturity_evaluations (
      id, brand_key, published_post_id, checkpoint_hours, evaluation_version, evaluation_json, structural_change_allowed
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_key, published_post_id, checkpoint_hours) DO UPDATE SET
      evaluation_version = excluded.evaluation_version, evaluation_json = excluded.evaluation_json,
      structural_change_allowed = excluded.structural_change_allowed, updated_at = CURRENT_TIMESTAMP`).bind(
      crypto.randomUUID(), input.brand_key, String(row.published_post_id), maturity.checkpoint_hours,
      MANIFEST_MATURITY_EVALUATION_VERSION, stableJson(maturity), maturity.structural_change_allowed ? 1 : 0,
    ).run();
    const familyKey = machine(row.autonomous_family_key ?? row.family_id, "unlinked");
    const placement = text(row.slot_time, 20) || timeBucket(row.post_timestamp);
    const candidate: ManifestComparableCandidate = {
      published_post_id: String(row.published_post_id),
      checkpoint_hours: maturity.checkpoint_hours,
      overall_score: maturity.overall_score,
      family_key: familyKey,
      hook_style: machine(fingerprint.hook_style, "unknown"),
      structure: machine(fingerprint.structure, "unknown"),
      audience_reward: signature.audience_reward_key,
      format: machine(fingerprint.format, "unknown"),
      topic: machine(fingerprint.topic, "unknown"),
      time_bucket: timeBucket(row.post_timestamp),
      semantic_signature: signature,
    };
    candidates.push(candidate);
    maturityRows.push({
      row, maturity, fingerprint, signature, family_key: familyKey,
      source_identity_key: machine(row.source_identity_key, "unlinked"),
      generation_mode: machine(row.generation_mode, "unknown"),
      placement_key: machine(placement, "unknown"),
    });
  }
  for (const target of candidates) {
    const analysis = buildManifestComparableAnalysis(target, candidates);
    await db.prepare(`INSERT INTO operator_manifest_comparable_analyses (
      id, brand_key, published_post_id, checkpoint_hours, analysis_version, comparable_post_ids_json, analysis_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_key, published_post_id, checkpoint_hours) DO UPDATE SET
      analysis_version = excluded.analysis_version, comparable_post_ids_json = excluded.comparable_post_ids_json,
      analysis_json = excluded.analysis_json, updated_at = CURRENT_TIMESTAMP`).bind(
      crypto.randomUUID(), input.brand_key, target.published_post_id, target.checkpoint_hours,
      MANIFEST_COMPARABLE_ANALYSIS_VERSION, stableJson(analysis.comparable_post_ids ?? []), stableJson(analysis),
    ).run();
  }
  await db.prepare(`UPDATE operator_manifest_learning_observations SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE brand_key = ?`).bind(input.brand_key).run();
  const authoritativeRows = maturityRows.filter((item) => item.maturity.structural_change_allowed);
  const globalMedian = median(authoritativeRows.map((item) => item.maturity.overall_score));
  const groups = new Map<string, { level: string; feature_key: string; rows: typeof authoritativeRows }>();
  for (const item of authoritativeRows) {
    for (const dimension of buildManifestLearningDimensions({
      published_post_id: String(item.row.published_post_id),
      fingerprint: item.fingerprint,
      semantic_signature: item.signature,
      family_key: item.family_key,
      source_identity_key: item.source_identity_key,
      generation_mode: item.generation_mode,
      placement_key: item.placement_key,
      sequence_key: machine(record(item.fingerprint).sequence_key, "unknown"),
    })) {
      const key = `${dimension.level}:${dimension.feature_key}`;
      const group = groups.get(key) ?? { ...dimension, rows: [] as typeof authoritativeRows };
      group.rows.push(item);
      groups.set(key, group);
    }
  }
  const familyObservations = new Map<string, JsonRecord>();
  for (const group of groups.values()) {
    const scores = group.rows.map((item) => item.maturity.overall_score);
    const groupMedian = median(scores);
    const effect = groupMedian - globalMedian;
    const supporting = scores.filter((score) => score >= globalMedian + 5).length;
    const contradicting = scores.filter((score) => score <= globalMedian - 5).length;
    const confidence = deriveManifestConfidenceTransition({
      sample_size: scores.length,
      authoritative_sample_size: scores.length,
      supporting_count: supporting,
      contradicting_count: contradicting,
      effect_size: effect,
    });
    const state = effect >= 6 ? "supporting" : effect <= -6 ? "contradicting" : "uncertain";
    const evidence = {
      published_post_ids: group.rows.map((item) => String(item.row.published_post_id)),
      overall_scores: scores,
      global_median_overall: globalMedian,
      structural_change_allowed: confidence.transition_allowed,
    };
        await upsertManifestLearningObservation(db, {
      brand_key: input.brand_key,
      level: group.level,
      feature_key: group.feature_key,
      sample_size: scores.length,
      supporting_count: supporting,
      contradicting_count: contradicting,
      median_overall: groupMedian,
      effect_size: effect,
      confidence_score: confidence.score,
      confidence_label: confidence.label,
      state,
      evidence,
      reason: confidence.reason,
    });
    if (group.level === "family") familyObservations.set(group.feature_key, {
      sample_size: scores.length, median_overall: groupMedian, supporting_count: supporting,
      contradicting_count: contradicting, confidence,
      strong_count: scores.filter((score) => score >= 65).length,
      weak_count: scores.filter((score) => score <= 35).length,
    });
  }
  for (const [familyKey, evidence] of familyObservations) {
    const current = await db.prepare(`SELECT role, confidence_label FROM operator_manifest_portfolio_states
      WHERE brand_key = ? AND family_key = ? LIMIT 1`).bind(input.brand_key, familyKey).first<JsonRecord>();
    const currentRole = machine(current?.role, "prospect") as ManifestPortfolioRole;
    const confidence = record(evidence.confidence);
    const familyRows = authoritativeRows.filter((item) => item.family_key === familyKey);
    const latestHalf = familyRows.slice(Math.max(0, familyRows.length - Math.ceil(familyRows.length / 2)));
    const baselineHalf = familyRows.slice(0, Math.max(1, Math.floor(familyRows.length / 2)));
    const portfolio = deriveManifestPortfolioState({
      current_role: currentRole,
      mature_count: number(evidence.sample_size),
      median_overall: number(evidence.median_overall, 50),
      recent_median_overall: median(latestHalf.map((item) => item.maturity.overall_score)),
      baseline_median_overall: median(baselineHalf.map((item) => item.maturity.overall_score)),
      strong_count: number(evidence.strong_count),
      weak_count: number(evidence.weak_count),
      confidence_label: machine(confidence.label, "insufficient") as ManifestConfidenceLabel,
    });
    await db.prepare(`INSERT INTO operator_manifest_portfolio_states (
      id, brand_key, family_key, role, recommended_role, previous_role, confidence_score,
      confidence_label, allocation_weight, actual_decay, reason, evidence_json, portfolio_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_key, family_key) DO UPDATE SET
      previous_role = operator_manifest_portfolio_states.role, role = excluded.role,
      recommended_role = excluded.recommended_role, confidence_score = excluded.confidence_score,
      confidence_label = excluded.confidence_label, allocation_weight = excluded.allocation_weight,
      actual_decay = excluded.actual_decay, reason = excluded.reason,
      evidence_json = excluded.evidence_json, portfolio_version = excluded.portfolio_version,
      updated_at = CURRENT_TIMESTAMP`).bind(
      crypto.randomUUID(), input.brand_key, familyKey, portfolio.role, portfolio.recommended_role,
      currentRole, number(confidence.score), machine(confidence.label, "insufficient"),
      portfolio.allocation_weight, portfolio.actual_decay ? 1 : 0, portfolio.reason,
      stableJson(evidence), MANIFEST_ADAPTIVE_PORTFOLIO_VERSION,
    ).run();
    if (portfolio.role !== currentRole) {
      const transitionKey = fnv1a(`${input.brand_key}|family|${familyKey}|${currentRole}|${portfolio.role}|${stableJson(evidence)}`);
      await db.prepare(`INSERT OR IGNORE INTO operator_manifest_state_transitions (
        id, transition_key, brand_key, entity_type, entity_id, from_state, to_state, reason, evidence_json, transitioned_at
      ) VALUES (?, ?, ?, 'family', ?, ?, ?, ?, ?, ?)`).bind(
        crypto.randomUUID(), transitionKey, input.brand_key, familyKey, currentRole, portfolio.role,
        portfolio.reason, stableJson(evidence), new Date().toISOString(),
      ).run();
    }
  }
  const experiments = await db.prepare(`SELECT * FROM operator_manifest_experiments
    WHERE brand_key = ? AND status IN ('running', 'planned')`).bind(input.brand_key).all<JsonRecord>();
  let experimentsEvaluated = 0;
  for (const experiment of experiments.results ?? []) {
    const assignments = await db.prepare(`SELECT a.scheduled_post_id, s.published_post_id, score.scores_json
      FROM operator_manifest_experiment_assignments a
      LEFT JOIN scheduled_posts s ON s.id = a.scheduled_post_id
      LEFT JOIN operator_post_performance_scores score ON score.brand_key = a.brand_key
        AND score.published_post_id = s.published_post_id AND score.checkpoint_hours = 24
      WHERE a.experiment_id = ?`).bind(experiment.id).all<JsonRecord>();
    const variantScores = (assignments.results ?? []).map((row) => number(record(parseJson(row.scores_json, {})).overall, Number.NaN)).filter(Number.isFinite);
    const comparison = record(parseJson(experiment.comparison_group_json, {}));
    const familyKey = machine(comparison.family_key ?? experiment.family_key, "");
    const controls = authoritativeRows.filter((item) => !familyKey || item.family_key === familyKey)
      .filter((item) => !(assignments.results ?? []).some((row) => String(row.published_post_id ?? "") === String(item.row.published_post_id)))
      .map((item) => item.maturity.overall_score);
    const criteria = record(parseJson(experiment.result_criteria_json, {}));
    const result = evaluateManifestExperiment({
      variant_scores: variantScores,
      control_scores: controls,
      minimum_variant: number(criteria.minimum_variant, 3),
      minimum_control: number(criteria.minimum_control, 3),
      win_delta: number(criteria.win_delta, 8),
      loss_delta: number(criteria.loss_delta, -8),
    });
    const terminal = ["expand", "stop"].includes(result.decision);
    await db.prepare(`UPDATE operator_manifest_experiments SET latest_result_json = ?,
      follow_up_decision = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(
      stableJson({ ...result, variant_count: variantScores.length, control_count: controls.length }),
      result.decision, terminal ? "completed" : "running", experiment.id,
    ).run();
    experimentsEvaluated += 1;
  }
  return {
    engine_version: MANIFEST_INTELLIGENCE_ENGINE_VERSION,
    published_signatures: publishedRows.length,
    scheduled_signatures: scheduled.results?.length ?? 0,
    maturity_evaluations: maturityRows.length,
    comparable_analyses: candidates.length,
    learning_observations: groups.size,
    portfolio_states: familyObservations.size,
    experiments_evaluated: experimentsEvaluated,
    authoritative_post_count: authoritativeRows.length,
  };
}

function compactManifestEngineEvidence(value: unknown): JsonRecord {
  const source = record(parseJson(value, {}));
  const publishedPostIds = array(source.published_post_ids).map(String);
  const overallScores = array(source.overall_scores).map(Number).filter(Number.isFinite);
  return {
    ...source,
    published_post_ids: publishedPostIds.slice(0, 12),
    overall_scores: overallScores.slice(0, 12),
    evidence_truncated: publishedPostIds.length > 12 || overallScores.length > 12,
    published_post_id_count: publishedPostIds.length,
    overall_score_count: overallScores.length,
  };
}

function compactManifestSemanticSignature(value: unknown): JsonRecord {
  const signature = record(parseJson(value, {}));
  const meaningTokens = array(signature.meaning_tokens).map(String);
  return {
    ...signature,
    meaning_tokens: meaningTokens.slice(0, 10),
    meaning_token_count: meaningTokens.length,
    meaning_tokens_truncated: meaningTokens.length > 10,
  };
}

export async function getManifestIntelligenceEngineState(db: D1Database, brandKey: string): Promise<JsonRecord> {
  await ensureManifestIntelligenceEngineTables(db);
  const portfolio = await db.prepare(`SELECT family_key, role, recommended_role, previous_role,
      confidence_score, confidence_label, allocation_weight, actual_decay, reason, evidence_json, updated_at
    FROM operator_manifest_portfolio_states WHERE brand_key = ?
    ORDER BY allocation_weight DESC, confidence_score DESC, updated_at DESC LIMIT 30`).bind(brandKey).all<JsonRecord>();
  const learning = await db.prepare(`SELECT level, feature_key, sample_size, supporting_count,
      contradicting_count, median_overall, effect_size, confidence_score, confidence_label,
      state, evidence_json, updated_at
    FROM operator_manifest_learning_observations WHERE brand_key = ? AND active = 1
    ORDER BY confidence_score DESC, sample_size DESC LIMIT 40`).bind(brandKey).all<JsonRecord>();
  const experiments = await db.prepare(`SELECT id, experiment_key, family_key, hypothesis_json,
      comparison_group_json, maturity_windows_json, result_criteria_json, status,
      latest_result_json, follow_up_decision, updated_at
    FROM operator_manifest_experiments WHERE brand_key = ?
    ORDER BY datetime(updated_at) DESC LIMIT 20`).bind(brandKey).all<JsonRecord>();
  const repetition = await db.prepare(`SELECT content_type, content_id, scheduled_post_id,
      published_post_id, observed_at, signature_json
    FROM operator_manifest_semantic_signatures WHERE brand_key = ?
    ORDER BY datetime(observed_at) DESC, datetime(updated_at) DESC LIMIT 40`).bind(brandKey).all<JsonRecord>();
  return {
    engine_version: MANIFEST_INTELLIGENCE_ENGINE_VERSION,
    bounded_read_contract: {
      portfolio_limit: 30,
      learning_limit: 40,
      experiment_limit: 20,
      semantic_exposure_limit: 40,
      evidence_post_limit: 12,
      semantic_token_limit: 10,
    },
    portfolio_states: (portfolio.results ?? []).map((row) => ({
      ...row,
      actual_decay: number(row.actual_decay) === 1,
      evidence: compactManifestEngineEvidence(row.evidence_json),
    })),
    learning_observations: (learning.results ?? []).map((row) => ({
      ...row,
      evidence: compactManifestEngineEvidence(row.evidence_json),
    })),
    experiments: (experiments.results ?? []).map((row) => ({
      ...row,
      hypothesis: parseJson(row.hypothesis_json, {}),
      comparison_group: parseJson(row.comparison_group_json, {}),
      maturity_windows: parseJson(row.maturity_windows_json, []),
      result_criteria: parseJson(row.result_criteria_json, {}),
      latest_result: parseJson(row.latest_result_json, {}),
    })),
    semantic_exposure: (repetition.results ?? []).map((row) => ({
      ...row,
      signature: compactManifestSemanticSignature(row.signature_json),
    })),
  };
}
