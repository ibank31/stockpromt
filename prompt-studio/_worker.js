import { onRequestPost as promptPost } from "./functions/api/prompt.js";
import { onRequestPost as upscalePost } from "./functions/api/upscale.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/prompt" && request.method === "POST") {
      return promptPost({ request, env, waitUntil: ctx.waitUntil.bind(ctx) });
    }
    if (url.pathname === "/api/upscale" && request.method === "POST") {
      return upscalePost({ request, env, waitUntil: ctx.waitUntil.bind(ctx) });
    }
    return env.ASSETS.fetch(request);
  },
};
