import assert from "node:assert/strict";
import test from "node:test";
import { validatePromptText, validateBundle } from "../lib/prompt-policy.mjs";

const item = (id, prompt = "A clean commercial stock image of a ceramic cup on a neutral tabletop, controlled soft lighting, crisp material detail, intentional composition, generous copy space, realistic texture, no branding, polished professional presentation") => ({
  id,
  concept_title: `Concept ${id}`,
  buyer_use_case: "Commercial editorial-free design use",
  creative_change_summary: "Uses a distinct environment and composition.",
  style_transfer_constraints: "Transfer only generic observed line, palette, and shading characteristics; do not copy the reference subject or composition.",
  subject_separation: "The requested subject is dominant; exclude the reference's literal subject and screenshot elements.",
  prompt,
  negative_prompt: "logos, trademarks, text, watermark, signature, distorted anatomy, clutter",
  content_type: "Illustration",
  aspect_ratio: "4:3",
  copy_space: "right side",
});

const forensics = {
  asset_boundary: "The reusable artwork is the centered embedded illustration; surrounding email branding and controls are not artwork.",
  asset_dna: "Clean outlined illustration with simplified geometry and restrained flat shading.",
  market_dna: "A reusable commercial visual for a broad buyer message.",
  contamination: ["header branding", "price text", "button", "watermark"],
  transfer_constraints: ["do not copy subject", "do not copy composition"],
  confidence: "medium",
};

test("prompt validator rejects artist-style references", () => {
  assert.equal(validatePromptText("A photorealistic commercial stock scene inspired by a famous artist, with clean lighting and simple composition.").ok, false);
});

test("bundle validator requires exactly one final opportunity", () => {
  const good = { reference_summary: "summary", commercial_intent: "use", policy_notes: [], reference_forensics: forensics, opportunities: [item("1")] };
  assert.equal(validateBundle(good).ok, true);
  const bad = { ...good, opportunities: [item("1"), item("2")] };
  assert.equal(validateBundle(bad).ok, false);
});

test("bundle validator rejects missing forensics fields", () => {
  const invalid = { reference_summary: "summary", commercial_intent: "use", policy_notes: [], reference_forensics: { ...forensics, asset_dna: "" }, opportunities: [item("1")] };
  assert.equal(validateBundle(invalid).ok, false);
});

test("short prompt is rejected", () => {
  assert.equal(validatePromptText("nice photo").ok, false);
});
