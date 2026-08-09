type JsonRecord = Record<string, unknown>;

export const MANIFEST_WINNING_SOURCE_MIN_LIKES = 1000;
export const MANIFEST_WINNER_PRESERVATION_VERSION = "manifest-winner-preservation-v1";

const UNSAFE_MANIFEST_EXACT_ANCHOR_WORDS = new Set([
  "woman", "women", "man", "men", "girl", "girls", "boy", "boys",
  "she", "he", "her", "hers", "him", "his",
  "god", "gods", "jesus", "christ", "lord", "allah",
]);
const CERTAINTY_WORDS = new Set([
  "expect", "will", "going", "about", "coming", "arrive", "arrives",
  "begin", "begins", "receive", "receives", "become", "becomes",
]);
const TIME_BOUNDARY_WORDS = new Set(["within", "before", "after", "by", "tonight", "tomorrow"]);

type WinnerCandidate = {
  text: string;
  likes: number;
  evidenceSource: string;
  publishedPostId: string | null;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function asRecordList(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function cleanText(value: unknown, maxLength = 20_000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  return normalized || null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item, 2_000)).filter((item): item is string => Boolean(item))
    : [];
}

function metricLikes(value: unknown): number {
  const record = asRecord(value);
  const candidates = [
    Number(record.likes ?? 0),
    Number(asRecord(record.metrics).likes ?? 0),
    Number(asRecord(record.scores).likes ?? 0),
  ].filter((item) => Number.isFinite(item) && item >= 0);
  return candidates.length ? Math.max(...candidates) : 0;
}

function collectWinnerCandidates(sourceCard: JsonRecord): WinnerCandidate[] {
  const candidates: WinnerCandidate[] = [];
  const primarySource = asRecord(sourceCard.primary_source);
  const primaryText = cleanText(primarySource.text ?? primarySource.post_text);
  if (primaryText) {
    candidates.push({
      text: primaryText,
      likes: Math.max(metricLikes(sourceCard.metrics_snapshot), metricLikes(primarySource.metrics)),
      evidenceSource: "canonical_source_metrics",
      publishedPostId: cleanText(primarySource.threads_post_id, 240),
    });
  }

  for (const revision of asRecordList(sourceCard.owner_revision_history)) {
    const text = cleanText(
      revision.exact_published_text
        ?? revision.revised_text
        ?? revision.owner_version
        ?? revision.draft_text
        ?? revision.post_text,
    );
    if (!text) continue;
    candidates.push({
      text,
      likes: Math.max(
        metricLikes(revision.performance_24h),
        metricLikes(revision.metrics),
        metricLikes(revision.performance),
      ),
      evidenceSource: "published_execution_24h",
      publishedPostId: cleanText(revision.published_post_id, 240),
    });
  }
  return candidates.sort((left, right) => right.likes - left.likes);
}

function extractWords(value: string): string[] {
  return value.match(/[$€£]?\d[\d,]*(?:\.\d+)?%?|[A-Za-z]+(?:['’][A-Za-z]+)*/g) ?? [];
}

function comparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceSurfaceText(value: unknown): string | null {
  if (typeof value === "string") return cleanText(value, 1_000);
  const record = asRecord(value);
  return cleanText(record.source_text ?? record.text, 1_000);
}

function forbiddenAnchorSurfaces(sourceCard: JsonRecord, contract: JsonRecord): Set<string> {
  const surfaces = [
    ...stringList(sourceCard.forbidden_surfaces),
    ...stringList(sourceCard.danger_surfaces),
    ...asRecordList(contract.must_transform)
      .map((item) => sourceSurfaceText(item))
      .filter((item): item is string => Boolean(item)),
  ];
  return new Set(surfaces.map(comparable).filter(Boolean));
}

function isSafeExactAnchor(
  anchor: string,
  forbidden: Set<string>,
  options: { allowSingleWord?: boolean } = {},
): boolean {
  const words = extractWords(anchor);
  if (words.length < (options.allowSingleWord ? 1 : 2)) return false;
  const loweredWords = words.map((word) => word.toLowerCase().replace(/[^a-z]/g, ""));
  if (loweredWords.some((word) => UNSAFE_MANIFEST_EXACT_ANCHOR_WORDS.has(word))) return false;
  const normalized = comparable(anchor);
  if (!normalized) return false;
  for (const surface of forbidden) {
    const surfaceWords = surface.split(" ").filter(Boolean);
    if (surfaceWords.length <= 8 && (normalized.includes(surface) || surface.includes(normalized))) {
      return false;
    }
  }
  return true;
}

function deriveWinnerExactSurfaces(
  winnerText: string,
  sourceCard: JsonRecord,
  contract: JsonRecord,
): string[] {
  const fullComparable = comparable(winnerText);
  const forbidden = forbiddenAnchorSurfaces(sourceCard, contract);
  const anchors: string[] = [];
  const addAnchor = (value: string | null) => {
    if (!value || anchors.length >= 2) return;
    let candidate = value.replace(/\s+/g, " ").trim();
    let words = extractWords(candidate);
    if (comparable(candidate) === fullComparable && words.length > 3) {
      words = words.slice(0, Math.max(2, words.length - 2));
      candidate = words.join(" ");
    }
    if (!isSafeExactAnchor(candidate, forbidden)) return;
    const normalized = comparable(candidate);
    if (anchors.some((existing) => {
      const existingNormalized = comparable(existing);
      return existingNormalized === normalized
        || existingNormalized.includes(normalized)
        || normalized.includes(existingNormalized);
    })) return;
    anchors.push(candidate);
  };

  const clauses = winnerText
    .split(/(?:\r?\n)+|[.!?;:]+|,\s+/g)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const firstClauseWords = extractWords(clauses[0] ?? winnerText);
  if (firstClauseWords.length) {
    const openingCount = firstClauseWords.length <= 8 && clauses.length > 1
      ? firstClauseWords.length
      : Math.min(6, Math.max(3, Math.ceil(firstClauseWords.length / 2)));
    addAnchor(firstClauseWords.slice(0, openingCount).join(" "));
  }

  for (const clause of clauses) {
    if (anchors.length >= 2) break;
    const words = extractWords(clause);
    const lowered = words.map((word) => word.toLowerCase().replace(/[^a-z]/g, ""));
    const triggerIndex = lowered.findIndex((word) => CERTAINTY_WORDS.has(word));
    if (triggerIndex < 0) continue;
    const trigger = lowered[triggerIndex];
    const start = ["coming", "arrive", "arrives", "begin", "begins"].includes(trigger)
      ? Math.max(0, triggerIndex - 3)
      : triggerIndex;
    let end = Math.min(words.length, start + 6);
    for (let index = start + 3; index < end; index += 1) {
      if (TIME_BOUNDARY_WORDS.has(lowered[index])) {
        end = index;
        break;
      }
    }
    addAnchor(words.slice(start, end).join(" "));
  }

  if (!anchors.length) {
    addAnchor(extractWords(winnerText).slice(0, 4).join(" "));
  }
  return anchors;
}

function deriveWinnerFunctions(winnerText: string): string[] {
  const lower = winnerText.toLowerCase();
  const functions = [
    "Preserve the winning post's recognizable opening hook and directness.",
  ];
  if (/\b(expect|will|going to|about to|is coming|are coming|arrives?|begins?)\b/i.test(winnerText)) {
    functions.push("Preserve the winner's certainty level; do not soften a definitive promise into vague possibility.");
  }
  if (/[$€£]|\b\d[\d,]*(?:\.\d+)?\b|\b(money|financial|wealth|wealthy|rich|million|income|debt|bill)\b/i.test(winnerText)) {
    functions.push("Preserve the winner's concrete payoff, amount, or financial specificity.");
  }
  if (/\b(within|before|after|today|tonight|tomorrow|days?|weeks?|months?|midnight|friday|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(lower)) {
    functions.push("Preserve the winner's concrete timing or deadline when the timing is part of the hook.");
  }
  const letters = winnerText.match(/[A-Za-z]/g) ?? [];
  const uppercase = winnerText.match(/[A-Z]/g) ?? [];
  if (letters.length >= 6 && uppercase.length / letters.length >= 0.55) {
    functions.push("Preserve the winner's compact visual intensity and capitalization pattern.");
  }
  return functions;
}

export function normalizeManifestWinnerPreservation(value: unknown): JsonRecord | null {
  const record = asRecord(value);
  const observedLikes = Number(record.observed_likes ?? 0);
  const required = record.required === true;
  const exactSurfaces = stringList(record.exact_surfaces);
  const requiredFunctions = stringList(record.required_functions);
  const winnerText = cleanText(record.winner_text, 2_000);
  if (!required && !Number.isFinite(observedLikes) && !exactSurfaces.length && !requiredFunctions.length && !winnerText) {
    return null;
  }
  if (!required && observedLikes <= 0 && !exactSurfaces.length && !requiredFunctions.length && !winnerText) {
    return null;
  }
  return {
    version: MANIFEST_WINNER_PRESERVATION_VERSION,
    required,
    threshold_likes: MANIFEST_WINNING_SOURCE_MIN_LIKES,
    observed_likes: Number.isFinite(observedLikes) ? Math.max(0, observedLikes) : 0,
    evidence_source: cleanText(record.evidence_source, 240),
    winner_post_id: cleanText(record.winner_post_id, 240),
    winner_text: winnerText,
    exact_surfaces: exactSurfaces,
    required_functions: requiredFunctions,
    enforcement_mode: "performance_bearing_language_package",
    variation_policy: cleanText(record.variation_policy, 1_000)
      ?? "Vary non-load-bearing details without weakening the winning hook, certainty, specificity, payoff, timing, or visual intensity.",
  };
}

export function applyManifestWinnerPreservation(
  sourceCard: JsonRecord,
  normalizedTransformationContract: JsonRecord,
): JsonRecord {
  const contract = { ...normalizedTransformationContract };
  const existing = normalizeManifestWinnerPreservation(contract.winner_preservation);
  const strongest = collectWinnerCandidates(sourceCard)[0] ?? null;
  const existingObservedLikes = Number(existing?.observed_likes ?? 0);
  const observedLikes = Math.max(
    strongest?.likes ?? 0,
    Number.isFinite(existingObservedLikes) ? existingObservedLikes : 0,
  );
  const required = existing?.required === true
    || observedLikes >= MANIFEST_WINNING_SOURCE_MIN_LIKES;
  if (!required) {
    return {
      ...sourceCard,
      transformation_contract: {
        ...contract,
        winner_preservation: existing,
      },
      winner_preservation: existing,
    };
  }

    const winnerText = strongest?.text ?? cleanText(existing?.winner_text, 2_000) ?? "";
  const forbiddenExactSurfaces = forbiddenAnchorSurfaces(sourceCard, contract);
  const existingExact = stringList(contract.must_preserve_exact)
    .filter((anchor) => isSafeExactAnchor(anchor, forbiddenExactSurfaces, { allowSingleWord: true }));
  const metadataExact = stringList(existing?.exact_surfaces)
    .filter((anchor) => isSafeExactAnchor(anchor, forbiddenExactSurfaces, { allowSingleWord: true }));
  const exactSurfaces = existingExact.length
    ? existingExact
    : metadataExact.length
      ? metadataExact
      : winnerText
        ? deriveWinnerExactSurfaces(winnerText, sourceCard, contract)
        : [];
  const requiredFunctions = Array.from(new Set([
    ...stringList(contract.must_preserve_function),
    ...stringList(existing?.required_functions),
    ...(winnerText ? deriveWinnerFunctions(winnerText) : []),
  ]));
  const preservation: JsonRecord = {
    version: MANIFEST_WINNER_PRESERVATION_VERSION,
    required: true,
    threshold_likes: MANIFEST_WINNING_SOURCE_MIN_LIKES,
    observed_likes: observedLikes,
    evidence_source: strongest?.evidenceSource ?? existing?.evidence_source ?? null,
    winner_post_id: strongest?.publishedPostId ?? existing?.winner_post_id ?? null,
    winner_text: winnerText || null,
    exact_surfaces: exactSurfaces,
    required_functions: requiredFunctions,
    enforcement_mode: "performance_bearing_language_package",
    variation_policy: "Vary non-load-bearing details without weakening the winning hook, certainty, specificity, payoff, timing, or visual intensity.",
  };
  return {
    ...sourceCard,
    transformation_contract: {
      ...contract,
      must_preserve_exact: exactSurfaces,
      must_preserve_function: requiredFunctions,
      winner_preservation: preservation,
    },
    winner_preservation: preservation,
  };
}

export interface OperatorSourceCardReadDependencies {
  normalizeText(value: unknown, maxLength: number, allowEmpty?: boolean): string | null;
  loadSourceCard(sourceCardId: string): Promise<JsonRecord | null>;
  loadHistory(sourceCard: JsonRecord): Promise<unknown>;
}

export async function readOperatorSourceCard(
  input: {
    brandKey: string;
    payload: JsonRecord;
    ownerPresentation: JsonRecord;
  },
  dependencies: OperatorSourceCardReadDependencies,
): Promise<{ status: number; body: JsonRecord }> {
  const sourceCardId = dependencies.normalizeText(input.payload.source_card_id, 120);
  const sourceCard = sourceCardId
    ? await dependencies.loadSourceCard(sourceCardId)
    : null;
  if (!sourceCard) {
    return {
      status: 404,
      body: { success: false, error: "source_card_not_found" },
    };
  }

  const canonicalContext = input.payload.include_history === false
    ? null
    : await dependencies.loadHistory(sourceCard);
  return {
    status: 200,
    body: {
      source_card: sourceCard,
      canonical_context: canonicalContext,
      owner_presentation: {
        ...input.ownerPresentation,
        account_scope: input.brandKey,
      },
    },
  };
}

