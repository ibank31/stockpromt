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
Manual generation in external APK
        ↓
Upload generated image
        ↓
AI super-resolution lane
```

This project intentionally does not generate images. The image generator remains an external APK chosen by the operator. It also does not submit to Adobe Stock automatically.

## Prompt contract

Every concept must contain a concrete subject treatment, composition, viewpoint, environment, lighting, materials/texture where relevant, color strategy, buyer use case, copy-space guidance, aspect ratio guidance, and practical failure-prevention terms.

The compiler must return exactly five materially different concepts. It must not reduce variation to crop/flip/recolor/filter tweaks.

## Microstock policy guardrails

The prompt compiler avoids artist names, real people, fictional characters, copyrighted creative works, government agencies, third-party IP, and descriptions implying actual newsworthy events. It also avoids copy/trace/match instructions and accidental typography, watermarks, branding, and UI artifacts.

The validator is only a deterministic guardrail. It is not legal clearance or a substitute for human review.

## Free-first architecture

Prompt compiler: Cloudflare Pages + Pages Functions + Gemini 2.5 Flash. Keep the Gemini key in the Pages Function secret, never in browser code.

Upscaler: dedicated Hugging Face ZeroGPU Space using a real super-resolution model. Use an owned Space so model/provider identity, output dimensions, and failures can be logged honestly. A public demo can be used for experiments, but should not be treated as a production dependency.

## Environment

```text
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
UPSCALER_API_URL=https://<your-owned-upscaler-endpoint>
```

`UPSCALER_API_URL` is optional while the prompt-only stage is being tested.
