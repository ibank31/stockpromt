const BANNED_PATTERNS = [/\bin the style of\b/i, /\binspired by\b/i, /\binfluenced by\b/i, /\bafter the style of\b/i, /\bin the tradition of\b/i, /\bdrawing on\b/i, /\bcelebrity\b/i, /\bfamous person\b/i, /\bfamous character\b/i, /\bgovernment agency\b/i, /\bbreaking news\b/i, /\bnews event\b/i, /\bactual news\b/i];

export function validatePromptText(text = "") {
  const value = String(text || "").trim();
  const violations = BANNED_PATTERNS.filter((pattern) => pattern.test(value)).map((pattern) => pattern.source);
  return { ok: value.length >= 80 && violations.length === 0, length: value.length, violations };
}

export function validateBundle(bundle) {
  const errors = [];
  if (!bundle || typeof bundle !== "object") return { ok: false, errors: ["response is not an object"] };
  const ops = bundle.opportunities;
  if (!Array.isArray(ops)) return { ok: false, errors: ["opportunities must be an array"] };
  if (ops.length !== 1) errors.push(`expected exactly 1 opportunity, got ${ops.length}`);
  const forensics = bundle.reference_forensics;
  if (!forensics || typeof forensics !== "object") errors.push("reference_forensics missing");
  else for (const key of ["asset_boundary", "asset_dna", "market_dna", "confidence"]) if (typeof forensics[key] !== "string" || !forensics[key].trim()) errors.push(`reference_forensics.${key} missing`);
  if (forensics && !Array.isArray(forensics.contamination)) errors.push("reference_forensics.contamination must be an array");
  if (forensics && !Array.isArray(forensics.transfer_constraints)) errors.push("reference_forensics.transfer_constraints must be an array");
  const ids = new Set();
  ops.forEach((item, index) => {
    const opportunity = item || {};
    if (!opportunity.id || ids.has(opportunity.id)) errors.push(`opportunity ${index + 1}: id missing or duplicated`);
    ids.add(opportunity.id);
    for (const key of ["concept_title", "buyer_use_case", "creative_change_summary", "prompt", "negative_prompt", "content_type", "aspect_ratio", "copy_space", "style_transfer_constraints", "subject_separation"]) {
      if (typeof opportunity[key] !== "string" || !opportunity[key].trim()) errors.push(`opportunity ${index + 1}: ${key} missing`);
    }
    if (!validatePromptText(opportunity.prompt).ok) errors.push(`opportunity ${index + 1}: prompt failed policy/length check`);
  });
  return { ok: errors.length === 0, errors };
}

export const MICROSTOCK_SCHEMA = {
  type: "OBJECT",
  properties: {
    reference_summary: { type: "STRING" },
    commercial_intent: { type: "STRING" },
    policy_notes: { type: "ARRAY", items: { type: "STRING" } },
    reference_forensics: {
      type: "OBJECT",
      properties: {
        asset_boundary: { type: "STRING" },
        asset_dna: { type: "STRING" },
        market_dna: { type: "STRING" },
        contamination: { type: "ARRAY", items: { type: "STRING" } },
        transfer_constraints: { type: "ARRAY", items: { type: "STRING" } },
        confidence: { type: "STRING" },
      },
      required: ["asset_boundary", "asset_dna", "market_dna", "contamination", "transfer_constraints", "confidence"],
    },
    opportunities: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          concept_title: { type: "STRING" },
          buyer_use_case: { type: "STRING" },
          creative_change_summary: { type: "STRING" },
          style_transfer_constraints: { type: "STRING" },
          subject_separation: { type: "STRING" },
          prompt: { type: "STRING" },
          negative_prompt: { type: "STRING" },
          content_type: { type: "STRING" },
          aspect_ratio: { type: "STRING" },
          copy_space: { type: "STRING" },
        },
        required: ["id", "concept_title", "buyer_use_case", "creative_change_summary", "style_transfer_constraints", "subject_separation", "prompt", "negative_prompt", "content_type", "aspect_ratio", "copy_space"],
      },
    },
  },
  required: ["reference_summary", "commercial_intent", "policy_notes", "reference_forensics", "opportunities"],
};
