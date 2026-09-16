import { MICROSTOCK_SCHEMA, validateBundle } from "../../lib/prompt-policy.mjs";

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const BANNED_OUTPUT = /\b(?:in the style of|inspired by|influenced by|after the style of|celebrity|famous character|government agency|breaking news|news event|actual news)\b/i;

const INSTRUCTION = `You are a commercial microstock art director and prompt compiler.

Analyze the uploaded reference only to understand commercially useful intent. Do NOT copy, trace, recreate, match, or closely reproduce the reference. Preserve the underlying buyer need while changing creative expression.

Return exactly five materially different stock-asset concepts. Variation must be conceptual, not merely a flip, crop, recolor, filter, background-color change, or tiny composition adjustment. Change multiple dimensions such as subject treatment, environment, viewpoint, composition, lighting, color strategy, styling, negative space, narrative, or buyer use case.

Write each master prompt in clear professional English for a generic modern text-to-image model. Keep the prompt concrete and production-oriented: subject, action/state, environment, composition, viewpoint, lighting, materials/texture, color strategy, depth/focus when relevant, commercial intent, copy space when useful, and clean output constraints.

Microstock safety rules:
- Do not name artists, real people, celebrities, fictional characters, brands, trademarks, logos, proprietary products, government agencies, or copyrighted creative works.
- Do not describe or imply a real-world newsworthy event.
- Do not ask for an exact replica, trace, match, or reconstruction of the reference.
- Avoid embedded text, signatures, watermarks, interface elements, badges, labels, or accidental typography.
- Do not invent unseen factual details; use generic wording when uncertain.
- Photo prompts should use photographic language only when a photorealistic photo is appropriate. Illustration prompts should be labeled as illustration concepts.
- Negative prompts should target likely failure modes for that concept rather than becoming a generic giant list.

The tool is a prompt compiler. It does not generate the image or submit anything to a marketplace.`;

function response(status,payload){return new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store"}});}
function parseImage(dataUrl){if(typeof dataUrl!=="string")throw new Error("image is required");const m=dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/s);if(!m)throw new Error("image must be a JPEG, PNG, or WebP data URL");const mime=m[1]==="image/jpg"?"image/jpeg":m[1];const data=m[2].replace(/\s+/g,"");const bytes=Math.floor(data.length*3/4);if(bytes>MAX_IMAGE_BYTES)throw new Error("image is too large; keep analysis image under 12 MB");return{mime,data};}

export async function onRequestPost({request,env}){
  try{
    const key=env.GEMINI_API_KEY;
    if(!key)return response(503,{ok:false,error:"GEMINI_API_KEY is not configured"});
    const body=await request.json();
    const image=parseImage(body?.image);
    const assetType=String(body?.asset_type||"Any suitable stock type").slice(0,80);
    const aspect=String(body?.preferred_aspect||"Choose commercially useful framing").slice(0,80);
    const notes=String(body?.notes||"").slice(0,2000);
    const model=String(env.GEMINI_MODEL||DEFAULT_MODEL);
    const text=`${INSTRUCTION}\n\nRequested asset type: ${assetType}\nPreferred framing: ${aspect}\nOperator notes: ${notes||"None"}\n\nGenerate exactly five opportunities and return only JSON matching the supplied schema.`;
    const upstream=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents:[{role:"user",parts:[{inline_data:{mime_type:image.mime,data:image.data}},{text}]}],generationConfig:{temperature:0.72,maxOutputTokens:9000,responseMimeType:"application/json",responseSchema:MICROSTOCK_SCHEMA}})});
    const data=await upstream.json();
    if(!upstream.ok)return response(502,{ok:false,error:"Gemini request failed",upstream_status:upstream.status,upstream_message:data?.error?.message||"unknown upstream error"});
    const raw=data?.candidates?.[0]?.content?.parts?.find(p=>typeof p?.text==="string")?.text;
    if(!raw)return response(502,{ok:false,error:"Gemini returned no text result"});
    let parsed;try{parsed=JSON.parse(raw);}catch{return response(502,{ok:false,error:"Gemini returned invalid JSON"});}
    const validation=validateBundle(parsed);
    if(!validation.ok)return response(422,{ok:false,error:"Generated prompt bundle failed local validation",validation});
    const unsafe=parsed.opportunities.filter(o=>BANNED_OUTPUT.test(`${o.prompt} ${o.negative_prompt}`));
    if(unsafe.length)return response(422,{ok:false,error:"Generated prompt bundle failed prohibited-pattern scan",unsafe_count:unsafe.length});
    return response(200,{ok:true,model,validated:true,result:parsed});
  }catch(error){return response(400,{ok:false,error:error instanceof Error?error.message:"invalid request"});}
}
