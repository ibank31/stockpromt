import assert from "node:assert/strict";
import test from "node:test";
import { validatePromptText, validateBundle } from "../lib/prompt-policy.mjs";

const item=(id,prompt="A clean commercial stock image of a ceramic cup on a neutral tabletop, controlled soft lighting, crisp material detail, intentional composition, generous copy space, realistic texture, no branding, polished professional presentation")=>({id,concept_title:`Concept ${id}`,buyer_use_case:"Commercial editorial-free design use",creative_change_summary:"Uses a distinct environment and composition.",prompt,negative_prompt:"logos, trademarks, text, watermark, signature, distorted anatomy, clutter",content_type:"Photo",aspect_ratio:"4:3",copy_space:"right side"});

test("prompt validator rejects artist-style references",()=>{assert.equal(validatePromptText("A photorealistic commercial stock scene inspired by a famous artist, with clean lighting and simple composition.").ok,false)});
test("bundle validator requires exactly one final opportunity",()=>{const good={reference_summary:"summary",commercial_intent:"use",policy_notes:[],opportunities:[item("1")]};assert.equal(validateBundle(good).ok,true);const bad={...good,opportunities:[item("1"),item("2")]};assert.equal(validateBundle(bad).ok,false)});
test("short prompt is rejected",()=>{assert.equal(validatePromptText("nice photo").ok,false)});
