import { MICROSTOCK_SCHEMA, validateBundle } from "../../lib/prompt-policy.mjs";

const MODEL = "gemini-2.5-flash";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const SYSTEM_INSTRUCTION = `You are a commercial microstock art director and prompt compiler.

The user uploads a reference or screenshot. Analyze what makes the reference commercially useful, but do NOT reproduce it as a near-copy. Preserve the underlying market intent while changing creative expression.

Produce exactly FIVE distinct asset concepts. Each concept must be independently useful as a stock asset and materially different from the reference and from the other four concepts. Change multiple dimensions such as subject treatment, composition, viewpoint, environment, styling, color strategy, lighting, negative space, narrative, or buyer use case.

Write copy-ready prompts in clear professional English for a generic modern text-to-image generator. Do not depend on model-specific tokens unless the user explicitly requests them.

Microstock prompt rules:
- No artist names or requests for an artist's style.
- No real-person names, celebrities, fictional characters, brands, logos, trademarks, copyrighted works, government agencies, or proprietary product names.
- Do not imply an actual newsworthy event.
- Do not instruct the generator to copy, trace, recreate, reproduce, or match the reference image.
- Avoid embedded text, signatures, watermarks, UI controls, sales badges, web-page chrome, and accidental typography.
- Prefer commercially useful compositions, clean subject definition, intentional lighting, realistic materials/anatomy when applicable, and purposeful copy space where relevant.
- Do not invent facts that are not visible. For uncertain details, use generic descriptions.
- Photo concepts should use photographic language only when it fits the image; illustration concepts should not be mislabeled as photographs.

The 'negative_prompt' should contain practical failure-prevention terms relevant to the concept, not a giant generic list.

The 'creative_change_summary' must explain how the concept is intentionally different from the uploaded reference.\n`;

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function dataUrlParts(dataUrl) {
  if (typeof dataUrl !== "string") throw new Error("image data must be a string");
  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/s);
  if (!match) throw new Error("image must be a jpeg, png, or webp data URL");
  const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const data = match[2].replace(/\s+/g, "");
  const approxBytes = Math.floor(data.length * 3 / 4);
  if (approxBytes > MAX_IMAGE_BYTES) throw new Error("image is too large; keep it under 12 MB");
  return { mimeType, data };
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.GEMINI_API_KEY) return jsonResponse(503, { ok: false, error: "GEMINI_API_KEY is not configured" });

    const body = await request.json();
    const image = dataUrlParts(body?.image);
    const assetType = String(body?.asset_type || "photo or illustration").slice(0, 80);
    const aspect = String(body?.preferred_aspect || "choose commercially useful framing").slice(0, 80);
    const notes = String(body?.notes || "").slice(0, 2000);

    const userInstruction = `${SYSTEM_INSTRUCTION}\nAsset type requested: ${assetType}\nPreferred framing: ${aspect}\nAdditional operator notes: ${notes || "None"}\n\nReturn JSON matching the provided schema. The five concepts must not be simple flips, recolors, crops, or minor variations.`;

    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { inline_data: { mime_type: image.mimeType, data: image.data } },
            { text: userInstruction },
          ],
        }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 9000,
          responseMimeType: "application/json",
          responseSchema: MICROSTOCK_SCHEMA,
        },
      }),
    });

    const upstreamJson = await upstream.json();
    if (!upstream.ok) {
      return jsonResponse(502, {
        ok: false,
        error: "Gemini request failed",
        upstream_status: upstream.status,
        upstream_message: upstreamJson?.error?.message || "unknown upstream error",
      });
    }

    const rawText = upstreamJson?.candidates?.[0]?.content?.parts?.find((part) => typeof part?.text === "string")?.text;
    if (!rawText) return jsonResponse(502, { ok: false, error: "Gemini returned no structured text" });

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return jsonResponse(502, { ok: false, error: "Gemini response was not valid JSON" });
    }

    const validation = validateBundle(parsed);
    if (!validation.ok) {
      return jsonResponse(422, { ok: false, error: "Prompt bundle failed local policy validation", validation });
    }

    return jsonResponse(200, {
      ok: true,
      model: MODEL,
      validated: true,
      result: parsed,
    });
  } catch (error) {
    return jsonResponse(400, {
      ok: false,
      error: error instanceof Error ? error.message : "invalid request",
    });
  }
}
