# StockPromt Studio

Standalone prompt-engineering tool for commercial microstock asset production.

This directory is a **new project surface**. It does not call, import, deploy, or modify the StockForge AI repository. The workflow is intentionally split:

```text
Reference / screenshot
        ↓
StockPromt Studio
        ↓
5 distinct microstock-ready prompt concepts
        ↓
Manual generation in external APK
        ↓
Generated image upload
        ↓
Dedicated AI upscaler lane (planned/optional)
        ↓
Human visual review
```

## Current design

- Multimodal analysis: Gemini 2.5 Flash through the API, selected because Google's current documentation lists text+image input and a free tier for the model. The free tier is subject to Google's current rate limits and may use submitted data to improve products. Never put a Gemini key in browser code.
- Hosting: Cloudflare Pages + Pages Functions. Static assets are free and Pages Functions use the Workers Free request quota.
- Output: exactly 5 distinct concepts. Each concept contains a commercial use case, creative-distance summary, copy-ready English prompt, negative constraints, content type, and aspect ratio guidance.
- Policy guard: the server rejects malformed responses and screens prompts for common prohibited-IP patterns. This is a safety gate, not a legal clearance system.
- No image generation happens inside this tool.
- No Adobe upload happens automatically.

## Environment

Pages Function secret:

```text
GEMINI_API_KEY=...
```

Optional variable:

```text
GEMINI_MODEL=gemini-2.5-flash
```

## Deployment target

Use a separate Cloudflare Pages project whose project root is `prompt-studio/` and build output is the same directory. The included `_routes.json` keeps function invocation limited to `/api/*`.

## Important commercial rule

Adobe Stock's current generative-AI guidance says prompts, titles, and keywords must not contain artist names, real people, fictional characters, government agencies, third-party IP, or descriptions implying an actual newsworthy event. It also requires AI labeling at submission and rights to submit the generated work. This tool therefore treats those elements as prohibited prompt content rather than as prompt style hints.

## Upscaling research

The preferred free path is a dedicated Hugging Face ZeroGPU Space running a real super-resolution model, rather than a plain resize. Current Hugging Face documentation says free accounts have 5 GPU-minutes/day for ZeroGPU use and can host up to two ZeroGPU Spaces when eligible. A later stage should use a controlled, owned Space so provider/model identity and output dimensions can be verified instead of relying on an arbitrary public demo.
