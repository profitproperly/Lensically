import { CLIENT_SAFETY_BRAND_KEY_DESCRIPTION } from "./systemDirectory";

export const BRAND_KEY_SCHEMA = {
  type: "string",
  enum: ["manifest_mental", "manifestmental", "opmg_deadman", "opmgdeadman", "vectrix"],
  description: CLIENT_SAFETY_BRAND_KEY_DESCRIPTION,
};

export const SOURCE_TRANSFORMATION_CONTRACT_SCHEMA = {
  type: "object",
    description: "Internal record of source evidence and source-specific owner guidance. Never expose these property names owner-facing, and do not treat them as one universal repeat-or-change formula for Manifest.",
  properties: {
    must_preserve_exact: { type: "array", items: { type: "string" }, description: "Exact hook or high-performing source wording that should remain when useful. Manifest hooks may be preserved heavily." },
    must_preserve_function: { type: "array", items: { type: "string" }, description: "Meaning, emotional sequence, structure, tone, or payoff that must remain." },
    may_reuse: { type: "array", items: { type: "string" }, description: "Recognizable source wording explicitly allowed to recur." },
    should_transform: { type: "array", items: {}, description: "Optional for Manifest. Use only when a specific source element truly needs changing." },
    must_transform: { type: "array", items: {}, description: "Optional for Manifest. Do not populate merely to create distance from the source." },
    forbidden_complete_combinations: { type: "array", items: {}, description: "Optional source packages that cannot be reproduced together. Manifest already blocks an exact full-source copy." },
    audience_reward: { type: "string", description: "The same emotional or practical product the source delivers." },
    time_or_context_requirements: { type: "array", items: { type: "string" }, description: "Only timing or context already present in the source; do not invent new scenes or events." },
        notes: { type: "string", description: "Source-specific context and owner guidance. Preserve its wording without prescribing a universal amount or type of change." },
  },
  additionalProperties: false,
};

export const GENERATION_ADAPTATION_PLAN_SCHEMA = {
  type: "object",
  description: "Structured plan for one new use of a canonical source card. Manifest runs require adaptation_goal.",
  properties: {
    adaptation_goal: { type: "string" },
    retained_exact_surfaces: { type: "array", items: { type: "string" } },
    preserved_functions: { type: "array", items: { type: "string" } },
    transformed_elements: { type: "array", items: { type: "string" } },
    payoff_choice: { type: "string" },
    time_or_context_choice: { type: "string" },
    closing_choice: { type: "string" },
    experiment_notes: { type: "string" },
    intentionally_different_from_prior: { type: "string" },
  },
  additionalProperties: false,
};

export const SOURCE_DRAFT_ANALYSIS_SCHEMA = {
  type: "object",
    description: "Gate evidence for how the candidate used the active source evidence and source-specific owner guidance. Do not infer a universal mimicry or novelty level from this schema.",
  properties: {
    opening_phrase: { type: "string" },
    realm_entrance_key: { type: "string" },
    hook_style: { type: "string" },
    lane_key: { type: "string" },
    preserved_functions: { type: "array", items: { type: "string" } },
    transformed_elements: { type: "array", items: { type: "string" } },
    satisfied_time_or_context_requirements: { type: "array", items: { type: "string" } },
    audience_reward_delivered: { type: "boolean" },
  },
  additionalProperties: true,
};
