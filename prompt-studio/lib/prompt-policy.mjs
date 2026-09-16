const BANNED_PATTERNS = [
  /\bin the style of\b/i,
  /\binspired by\b/i,
  /\binfluenced by\b/i,
  /\bafter the style of\b/i,
  /\bcelebrity\b/i,
  /\bfamous person\b/i,
  /\bfamous character\b/i,
  /\bgovernment agency\b/i,
  /\bbreaking news\b/i,
  /\bnews event\b/i,
  /\bactual news\b/i,
];

export function validatePromptText(text = "") {
  const value = String(text || "").trim();
  const violations = BANNED_PATTERNS.filter((pattern) => pattern.test(value)).map((pattern) => pattern.toString());
  return {
    ok: value.length >= 80 && violations.length === 0,
    length: value.length,
    violations,
  };
}

export function validateBundle(bundle) {
  const errors = [];
  if (!bundle || typeof bundle !== "object") errors.push("response is not an object");
  const opportunities = bundle?.opportunities;
  if (!Array.isArray(opportunities)) {
    errors.push("opportunities must be an array");
    return { ok: false, errors };
  }
  if (opportunities.length !== 5) errors.push(`expected exactly 5 opportunities, got ${opportunities.length}`);

  const ids = new Set();
  for (let i = 0; i < opportunities.length; i += 1) {
    const item = opportunities[i] || {};
    if (!item.id || ids.has(item.id)) errors.push(`opportunity ${i + 1}: id missing or duplicated`);
    ids.add(item.id);
    for (const key of ["concept_title", "buyer_use_case", "prompt", "negative_prompt", "content_type", "aspect_ratio"]) {
      if (typeof item[key] !== "string" || !item[key].trim()) errors.push(`opportunity ${i + 1}: ${key} missing`);
    }
    const promptCheck = validatePromptText(item.prompt);
    if (!promptCheck.ok) errors.push(`opportunity ${i + 1}: prompt failed policy/length check`);
  }

  return { ok: errors.length === 0, errors };
}

export const MICROSTOCK_SCHEMA = {
  type: "OBJECT",
  properties: {
    reference_summary: { type: "STRING" },
    commercial_intent: { type: "STRING" },
    policy_notes: { type: "ARRAY", items: { type: "STRING" } },
    opportunities: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          concept_title: { type: "STRING" },
          buyer_use_case: { type: "STRING" },
          creative_change_summary: { type: "STRING" },
          prompt: { type: "STRING" },
          negative_prompt: { type: "STRING" },
          content_type: { type: "STRING" },
          aspect_ratio: { type: "STRING" },
          copy_space: { type: "STRING" },
        },
        required: [
          "id",
          "concept_title",
          "buyer_use_case",
          "creative_change_summary",
          "prompt",
          "negative_prompt",
          "content_type",
          "aspect_ratio",
          "copy_space",
        ],
      },
    },
  },
  required: ["reference_summary", "commercial_intent", "policy_notes", "opportunities"],
};
