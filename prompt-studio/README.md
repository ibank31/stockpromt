# StockPromt Studio

Standalone microstock prompt compiler.

```text
Reference / screenshot
        ↓
Multimodal analysis
        ↓
Commercial intent
        ↓
Exactly 5 distinct concepts
        ↓
Copy-ready master prompt + negative prompt
        ↓
Manual generation in external APK or browser tool
        ↓
Upload generated image
        ↓
AI super-resolution lane
        ↓
Editable metadata
        ↓
Download final asset + metadata
        ↓
Human review / ready upload
```

This project intentionally does not generate images. The image generator remains an external APK or browser tool chosen by the operator. It also does not submit to Adobe Stock automatically. The browser workspace keeps the selected prompt, manually uploaded result, upscale provenance, metadata, and final download state together in one workflow.

## Why the old error appeared

`/api/prompt` is a **Cloudflare Pages Function**, not a static browser file. The site must be deployed to the Cloudflare Pages project `stockpromt-studio`; GitHub Pages can serve the UI but cannot execute `functions/api/prompt.js` or provide its bindings. When the Function was reached without its secret, it returned `GEMINI_API_KEY is not configured`.

## Prompt contract

Every concept must contain a concrete subject treatment, composition, viewpoint, environment, lighting, materials/texture where relevant, color strategy, buyer use case, copy-space guidance, aspect ratio guidance, and practical failure-prevention terms.

The compiler returns exactly one strongest production-ready concept with a detailed master prompt and comprehensive negative prompt. It must materially differentiate the new asset from the reference rather than copy, trace, crop, recolor, flip, or filter it.

## Free-first provider architecture

The default provider is Cloudflare Workers AI through the Pages `AI` binding, using `@cf/meta/llama-3.2-11b-vision-instruct`. This route is server-side, requires no Gemini key in the browser, and is selected by `auto` or `workers-ai`.

Gemini 2.5 Flash remains an optional higher-quality route. Set `GEMINI_API_KEY` as a **Cloudflare Pages secret**, never in frontend code, and select `Gemini` or leave provider on `auto` to use Gemini after a Workers AI failure. The endpoint validates every provider response locally before returning it to the UI.

## Environment and deployment

Cloudflare Pages project settings:

```text
AI                  Workers AI binding
GEMINI_API_KEY      optional secret
GEMINI_MODEL        optional variable, default gemini-2.5-flash
WORKERS_AI_MODEL    optional variable, default @cf/meta/llama-3.2-11b-vision-instruct
UPSCALER_API_URL    optional while the prompt-only stage is being tested
```

The deployment must preserve the `prompt-studio/functions/` directory as Pages Functions. Do not publish this directory through GitHub Pages and expect `/api/prompt` to work.

## Human-review boundaries

The prompt compiler is a deterministic policy guardrail plus a model-assisted drafting tool. It is not legal clearance or a substitute for human review. Image generation, marketplace submission, similarity review, and metadata approval remain explicit operator actions.
