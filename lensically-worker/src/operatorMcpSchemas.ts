import { CLIENT_SAFETY_BRAND_KEY_DESCRIPTION } from "./systemDirectory";

export const BRAND_KEY_SCHEMA = {
  type: "string",
  enum: ["manifest_mental", "manifestmental", "opmg_deadman", "opmgdeadman", "vectrix"],
  description: CLIENT_SAFETY_BRAND_KEY_DESCRIPTION,
};

export const SOURCE_DRAFT_ANALYSIS_SCHEMA = {
  type: "object",
  description: "Gate evidence for the active source contract. For Manifest, record preserved hook/function/time requirements and audience reward; transformed_elements is optional because close source mimicry is preferred.",
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
