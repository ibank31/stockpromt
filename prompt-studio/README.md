# StockPromt Studio

A standalone tool that turns a reference/screenshot into **exactly five distinct, copy-ready image-generation prompts** for commercial microstock work.

It deliberately does **not** generate images. The operator copies a selected prompt into an external image-generation APK, then can upload the result to an independent upscaling lane.

## Workflow

```text
Reference / screenshot
        ↓
Multimodal analysis
        ↓
Commercial intent extraction
        ↓
5 materially different concepts
        ↓
Copy-ready master prompt + negative prompt
        ↓
Manual image generation in external APK
        ↓
Upload generated image for AI upscaling
```

## Research-backed design

Adobe Stock's current generative-AI guidance says prompts, titles, and keywords must not contain artist names, real people, fictional characters, government agencies, third-party IP, or descriptions implying an actual newsworthy event. It also requires contributors to have the necessary rights to submit the generated work and to mark generative AI content appropriately at submission.

The prompt compiler therefore separates **commercial intent** from **creative expression** and explicitly tells the model not to copy, trace, recreate, or match the reference. The implementation also performs a deterministic local screen for common prohibited prompt patterns. That screen is a guardrail, not legal clearance.

Adobe currently accepts AI-generated still images when they meet the applicable technical and quality requirements. For photo/illustration uploads the current technical baseline is JPEG, sRGB, 4MP–100MP, maximum 45MB, with no watermarks, timestamps, or branding. The generated image itself must still be inspected by a human.

## Free-first infrastructure

### Prompt compiler

- Front end: Cloudflare Pages.
- API: Cloudflare Pages Function.
- Model: `gemini-2.5-flash` by default.
- Current Google documentation lists text+image input, structured JSON output, and a free tier for Gemini 2.5 Flash. Free usage remains subject to Google's quotas/rate limits, and Google notes that free-tier content may be used to improve products.
- The browser never receives the Gemini API key.

### Upscaler

The preferred zero-cost route is a dedicated Hugging Face ZeroGPU Space running a real super-resolution model such as Real-ESRGAN. Current Hugging Face documentation says Free accounts get 5 GPU-minutes/day for ZeroGPU use and can host up to two ZeroGPU Spaces when the account is eligible. A controlled Space is preferable to depending on a random public demo because provider, model, output dimensions, and queue failures can be logged honestly.

## Environment

Set the Cloudflare Pages Function secret:

```text
GEMINI_API_KEY=...
```

Optional variable:

```text
GEMINI_MODEL=gemini-2.5-flash
```

The deployed project should use `prompt-studio/` as its Pages project root, with `index.html` as the static entrypoint.
