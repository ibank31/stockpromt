import { MICROSTOCK_SCHEMA, validateBundle } from "../../lib/prompt-policy.mjs";
import { REFERENCE_FORENSICS_CONTRACT } from "../../lib/reference-forensics.mjs";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_WORKERS_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const POLICY = /\b(?:in the style of|inspired by|influenced by|after the style of|in the tradition of|celebrity|famous person|famous character|government agency|breaking news|news event|actual news)\b/i;
const INSTRUCTION = `You are an autonomous commercial microstock art director and prompt compiler. The uploaded image may be a marketplace email, dashboard, social post, or screenshot containing an embedded stock illustration. Do not treat the screenshot as one unified scene. ${REFERENCE_FORENSICS_CONTRACT}

ANALYSIS REQUIREMENTS
- Inspect the entire uploaded image first, then localize the reusable artwork and identify its boundary relative to surrounding screenshot/UI elements.
- Analyze the reference's actual medium and rendering language accurately. Do not replace a flat, outlined, pixel-like, hand-drawn, or vector illustration with photorealistic CGI, glossy 3D, cinematic haze, or studio photography unless the operator explicitly requests that change.
- Keep Asset DNA separate from Market DNA. Asset DNA describes how the reference is visually made; Market DNA describes why a buyer might use it.
- If the operator supplies a new subject, use the reference only for transferable visual attributes and do not carry over the reference's literal subject, silhouette, composition, text, logo, price, or screenshot framing.
- For the common case of a small illustrated house shown inside a marketplace screenshot, recognize the house as the reference subject, but do not place a house, building, architecture, roof, windows, or residential scene into a new concept when the operator excludes those elements. Transfer only valid generic attributes such as clean outlined illustration, simplified geometry, restrained palette, flat or limited shading, and crisp edges, and only when those attributes are actually observed.
- The operator's explicit prompt and negative constraints take priority over incidental objects in the reference. Do not invent gold 3D objects, glowing particles, financial symbols, bars, arrows, clouds, or other motifs unless the requested concept calls for them.
- Return exactly ONE strongest production-ready concept, not multiple alternatives. Include a detailed master prompt and a comprehensive comma-separated negative prompt.
- The master prompt must include subject, action/state, environment, composition, viewpoint, medium/rendering method, line and shading behavior, color strategy, depth/focus only when relevant, commercial use, copy space, aspect ratio, output format, and clean-output constraints.
- The final prompt must include explicit STYLE TRANSFER CONSTRAINTS and SUBJECT SEPARATION sections. The requested subject must remain dominant.
- Do not name artists, real people, celebrities, fictional characters, brands, trademarks, logos, proprietary products, government agencies, copyrighted works, or actual newsworthy events. Do not ask for reference matching or an exact replica.
- Avoid embedded text, signatures, watermarks, UI elements, badges, labels, prices, buttons, and accidental typography. Do not invent unseen factual details.
- The negative prompt must cover reference-copy risk, screenshot contamination, unwanted text/UI/branding, quality defects, composition failures, anatomy/object deformation when relevant, and format-specific issues.
- If notes are empty, infer commercially sensible assumptions and record them in the summary, intent, policy notes, forensics, and final concept.

Return only JSON matching this schema: ${JSON.stringify(MICROSTOCK_SCHEMA)}`;

function out(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json;charset=utf-8", "cache-control": "no-store" } });
}

function imagePart(value) {
  if (typeof value !== "string") throw new Error("image is required");
  const match = value.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/s);
  if (!match) throw new Error("image must be a JPEG, PNG, or WebP data URL");
  const data = match[2].replace(/\s+/g, "");
  const bytes = Math.floor(data.length * 3 / 4);
  if (bytes > MAX_IMAGE_BYTES) throw new Error("analysis image exceeds 12 MB");
  return { mime_type: match[1] === "image/jpg" ? "image/jpeg" : match[1], data };
}

function requestPrompt(body) {
  const outputFormat = String(body?.output_format || "JPEG").toUpperCase() === "PNG" ? "PNG" : "JPEG";
  const aspect = String(body?.preferred_aspect || "Choose commercially useful framing").slice(0, 80);
  const notes = String(body?.notes || "").slice(0, 2000);
  return `${INSTRUCTION}\nRequested output format: ${outputFormat}. Keep the concept suitable for this file format; do not add transparency unless PNG is selected, and do not rely on transparency when JPEG is selected.\nPreferred framing: ${aspect}\nOperator notes: ${notes || "None"}`;
}

function parseJson(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || text;
  try { return JSON.parse(fenced); } catch { return null; }
}

async function validateAndReturn(parsed, provider, model) {
  if (!parsed) return { ok: false, response: out(502, { ok: false, error: `${provider} returned invalid JSON` }) };
  const validation = validateBundle(parsed);
  if (!validation.ok) return { ok: false, response: out(422, { ok: false, error: "Prompt bundle failed local validation", validation }) };
  for (const item of parsed.opportunities) {
    if (POLICY.test(`${item.prompt} ${item.negative_prompt} ${item.style_transfer_constraints} ${item.subject_separation}`)) return { ok: false, response: out(422, { ok: false, error: "Prompt bundle failed prohibited-pattern scan" }) };
  }
  return { ok: true, response: out(200, { ok: true, provider, model, validated: true, result: parsed }) };
}

async function runGemini(env, image, prompt) {
  const model = String(env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: image }, { text: prompt }] }], generationConfig: { temperature: 0.45, maxOutputTokens: 9000, responseMimeType: "application/json", responseSchema: MICROSTOCK_SCHEMA } }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || `Gemini request failed (${response.status})`);
  const raw = data?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === "string")?.text;
  return { model, parsed: parseJson(raw) };
}

async function runWorkersAI(env, image, prompt) {
  if (!env.AI || typeof env.AI.run !== "function") throw new Error("Workers AI binding is not configured");
  const model = String(env.WORKERS_AI_MODEL || DEFAULT_WORKERS_MODEL);
  const response = await env.AI.run(model, { messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${image.mime_type};base64,${image.data}` } }] }], temperature: 0.2, max_tokens: 7000 });
  return { model, parsed: parseJson(response?.response || response?.result || response) };
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const image = imagePart(body?.image);
    const prompt = requestPrompt(body);
    const requestedProvider = String(body?.provider || env.PROMPT_PROVIDER || "auto").toLowerCase();
    const attempts = requestedProvider === "gemini" ? ["gemini"] : requestedProvider === "workers-ai" ? ["workers-ai"] : ["workers-ai", "gemini"];
    const failures = [];
    for (const provider of attempts) {
      if (provider === "gemini" && !env.GEMINI_API_KEY) { failures.push("Gemini key is not configured"); continue; }
      try {
        const result = provider === "gemini" ? await runGemini(env, image, prompt) : await runWorkersAI(env, image, prompt);
        const checked = await validateAndReturn(result.parsed, provider, result.model);
        if (checked.ok) return checked.response;
        failures.push(`${provider}: ${checked.response.status} validation failure`);
      } catch (error) { failures.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    return out(503, { ok: false, error: "No prompt model is available", detail: "Configure the Cloudflare Pages AI binding for free-first mode, or add GEMINI_API_KEY for Gemini mode.", attempts: failures });
  } catch (error) { return out(400, { ok: false, error: error instanceof Error ? error.message : "invalid request" }); }
}

export { imagePart, parseJson, requestPrompt, runWorkersAI };
