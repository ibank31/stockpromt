const $ = (s) => document.querySelector(s);
const state = { referenceFile: null, generatedFile: null, generatedUrl: '', selected: null, analysis: null, upscale: null, finalUrl: '', finalFileName: 'stockpromt-final-asset.jpg' };

const imageInput = $('#image');
const generatedInput = $('#generatedImage');
const statusEl = $('#status');
const setStatus = (text, busy = false) => { statusEl.textContent = text; statusEl.classList.toggle('busy', busy); };
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const dataUrl = (blob) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error || new Error('image read failed')); reader.readAsDataURL(blob); });

async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  const max = 1800;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('image preparation failed')), 'image/jpeg', .88));
}

function bindDrop(dropId, input, onFile) {
  const drop = $(dropId);
  input.addEventListener('change', () => onFile(input.files?.[0] || null));
  drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (event) => { event.preventDefault(); drop.classList.remove('dragging'); onFile(event.dataTransfer.files?.[0] || null); });
}

function showReference(file) {
  if (!file || !file.type.startsWith('image/')) { state.referenceFile = null; $('#run').disabled = true; $('#preview').hidden = true; return; }
  state.referenceFile = file;
  $('#preview').src = URL.createObjectURL(file);
  $('#preview').hidden = false;
  $('#run').disabled = false;
  setStatus('READY');
}

function showGenerated(file) {
  if (!file || !file.type.startsWith('image/')) return;
  state.generatedFile = file;
  if (state.generatedUrl) URL.revokeObjectURL(state.generatedUrl);
  state.generatedUrl = URL.createObjectURL(file);
  $('#generatedPreview').src = state.generatedUrl;
  $('#generatedPreviewWrap').hidden = false;
  $('#generatedInfo').textContent = `${file.name} · ${formatBytes(file.size)} · uploaded manually by operator`;
  setStatus('IMAGE UPLOADED');
}

function formatBytes(bytes) { return `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
function formatDimensions(width, height) { return width && height ? `${width.toLocaleString()} × ${height.toLocaleString()}` : 'Provider reported dimensions'; }
function go(stage) {
  const ids = { reference: 'referenceStage', prompt: 'promptStage', manual: 'manualStage', finalize: 'finalizeStage', ready: 'readyStage' };
  Object.entries(ids).forEach(([key, id]) => { const el = $(`#${id}`); el.hidden = key !== stage; el.classList.toggle('active-stage', key === stage); });
  document.querySelectorAll('.step').forEach((el) => el.classList.toggle('active', el.dataset.step === stage));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function copyText(text, button) { navigator.clipboard?.writeText(text).then(() => { const old = button.textContent; button.textContent = 'COPIED'; setTimeout(() => button.textContent = old, 900); }); }

function makeCard(opportunity, index) {
  const card = document.createElement('article');
  card.className = 'prompt-card';
  card.dataset.id = opportunity.id;
  card.innerHTML = `<div class="card-head"><div><span class="num">0${index + 1}</span><h3>${esc(opportunity.concept_title)}</h3></div><span class="badge">${esc(opportunity.content_type)}</span></div><p class="use"><strong>Buyer use:</strong> ${esc(opportunity.buyer_use_case)}</p><p class="change"><strong>Creative change:</strong> ${esc(opportunity.creative_change_summary)}</p><div class="prompt-box"><div class="box-head"><span>MASTER PROMPT</span><button class="ghost copy-master">COPY</button></div><pre>${esc(opportunity.prompt)}</pre></div><div class="prompt-box muted"><div class="box-head"><span>NEGATIVE / FAILURE AVOIDANCE</span><button class="ghost copy-negative">COPY</button></div><pre>${esc(opportunity.negative_prompt)}</pre></div><div class="meta"><span>Aspect: ${esc(opportunity.aspect_ratio)}</span><span>Copy space: ${esc(opportunity.copy_space)}</span></div><button class="select-card">Select direction <span>→</span></button>`;
  card.querySelector('.copy-master').onclick = (event) => { event.stopPropagation(); copyText(opportunity.prompt, event.currentTarget); };
  card.querySelector('.copy-negative').onclick = (event) => { event.stopPropagation(); copyText(opportunity.negative_prompt, event.currentTarget); };
  card.addEventListener('click', () => selectOpportunity(opportunity, card));
  return card;
}

function selectOpportunity(opportunity, card) {
  state.selected = opportunity;
  document.querySelectorAll('.prompt-card').forEach((el) => el.classList.remove('selected'));
  card.classList.add('selected');
  $('#selectionText').textContent = `Selected: ${opportunity.concept_title}`;
  $('#continueManual').disabled = false;
}

function populateSelected() {
  const item = state.selected;
  $('#selectedMaster').textContent = item.prompt;
  $('#selectedNegative').textContent = item.negative_prompt;
  $('#selectedMeta').innerHTML = `<span>Aspect: ${esc(item.aspect_ratio)}</span><span>Copy space: ${esc(item.copy_space)}</span><span>Type: ${esc(item.content_type)}</span>`;
}

function slug(value) { return String(value || 'asset').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'asset'; }
function buildMetadata() {
  const item = state.selected || {};
  const title = `${item.concept_title || 'Commercial stock asset'} — ${item.content_type || 'stock image'}`;
  const summary = state.analysis?.reference_summary || item.buyer_use_case || 'Commercial stock asset';
  const keywords = [...new Set(`${item.concept_title || ''}, ${item.buyer_use_case || ''}, ${item.content_type || ''}, ${item.aspect_ratio || ''}, commercial stock, marketplace asset, copy space, professional, high quality`.split(/[,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 49);
  $('#metaTitle').value = title.slice(0, 200);
  $('#metaDescription').value = `${summary}. ${item.buyer_use_case || 'Suitable for commercial design and editorial-free stock use.'}`.slice(0, 500);
  $('#metaKeywords').value = keywords.join(', ');
}

async function analyze() {
  if (!state.referenceFile) return;
  $('#run').disabled = true; setStatus('ANALYZING', true);
  try {
    const image = await dataUrl(await prepareImage(state.referenceFile));
    const response = await fetch('./api/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image, asset_type: $('#assetType').value, preferred_aspect: $('#aspect').value, notes: $('#notes').value }) });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Prompt analysis failed');
    state.analysis = payload.result;
    $('#referenceSummary').textContent = payload.result.reference_summary;
    $('#commercialIntent').textContent = payload.result.commercial_intent;
    $('#policyNotes').replaceChildren(...payload.result.policy_notes.map((note) => { const li = document.createElement('li'); li.textContent = note; return li; }));
    $('#modelBadge').textContent = `${payload.result.opportunities.length} OPTIONS · ${payload.model}`;
    $('#cards').replaceChildren(...payload.result.opportunities.map(makeCard));
    setStatus('PROMPTS READY'); go('prompt');
  } catch (error) { setStatus('ERROR'); alert(error instanceof Error ? error.message : String(error)); }
  finally { $('#run').disabled = !state.referenceFile; }
}

function prepareFinalize() {
  if (!state.generatedFile) return;
  $('#finalPreview').src = state.generatedUrl;
  $('#finalSourceInfo').textContent = `${state.generatedFile.name} · ${formatBytes(state.generatedFile.size)}`;
  $('#finalState').textContent = 'SOURCE UPLOADED';
  buildMetadata();
  $('#markReady').disabled = true;
  go('finalize');
}

async function upscale() {
  if (!state.generatedFile) return;
  $('#runUpscale').disabled = true; $('#finalState').textContent = 'UPSCALING'; setStatus('UPSCALING', true); $('#upscaleMessage').textContent = 'Sending the manually generated image to the configured super-resolution provider...';
  try {
    const response = await fetch('./api/upscale', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: await dataUrl(state.generatedFile) }) });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Upscale failed');
    state.upscale = payload; state.finalUrl = payload.image_url; state.finalFileName = `${slug($('#metaTitle').value)}-final.jpg`;
    $('#provider').textContent = payload.provider; $('#model').textContent = payload.model; $('#dimensions').textContent = `${formatDimensions(payload.source_width, payload.source_height)} → ${formatDimensions(payload.final_width, payload.final_height)}`;
    $('#upscaleResult').hidden = false; $('#finalState').textContent = 'UPSCALE READY'; $('#upscaleMessage').textContent = 'Provider identity recorded. Review the final image and metadata before marking ready.'; $('#markReady').disabled = false; setStatus('FINALIZE READY');
  } catch (error) { $('#finalState').textContent = 'ERROR'; $('#upscaleMessage').textContent = error instanceof Error ? error.message : String(error); setStatus('ERROR'); }
  finally { $('#runUpscale').disabled = false; }
}

function makeMetadata() { return { status: 'READY_UPLOAD_MANUAL_REVIEW', title: $('#metaTitle').value.trim(), description: $('#metaDescription').value.trim(), keywords: $('#metaKeywords').value.split(',').map((x) => x.trim()).filter(Boolean), category: $('#metaCategory').value, source_file: state.generatedFile?.name || null, upscale: state.upscale ? { provider: state.upscale.provider, model: state.upscale.model, operation: 'ai_super_resolution', source_width: state.upscale.source_width, source_height: state.upscale.source_height, final_width: state.upscale.final_width, final_height: state.upscale.final_height } : { operation: 'manual_upload_without_upscale', verified: false }, prompt: state.selected?.prompt || '', negative_prompt: state.selected?.negative_prompt || '', human_review_required: true, generated_at: new Date().toISOString() }; }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function markReady() { const metadata = makeMetadata(); $('#readyAssetName').textContent = $('#metaTitle').value.trim() || 'Final master'; $('#readyAssetInfo').textContent = state.upscale ? `${state.upscale.provider} · ${state.upscale.model} · ${formatDimensions(state.upscale.final_width, state.upscale.final_height)}` : 'Manual upload · upscale not verified'; const assetLink = $('#downloadAsset'); assetLink.href = state.finalUrl || state.generatedUrl; assetLink.download = state.finalFileName; $('#downloadMetadata').onclick = () => downloadBlob(new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }), `${slug(metadata.title)}-metadata.json`); setStatus('READY UPLOAD'); go('ready'); }
function reset() { window.location.reload(); }

bindDrop('#drop', imageInput, showReference); bindDrop('#generatedDrop', generatedInput, showGenerated);
$('#run').addEventListener('click', analyze);
$('#continueManual').addEventListener('click', () => { populateSelected(); go('manual'); });
$('#continueFinalize').addEventListener('click', prepareFinalize);
$('#runUpscale').addEventListener('click', upscale);
$('#markReady').addEventListener('click', markReady);
$('#copyMaster').addEventListener('click', (event) => state.selected && copyText(state.selected.prompt, event.currentTarget));
$('#copyNegative').addEventListener('click', (event) => state.selected && copyText(state.selected.negative_prompt, event.currentTarget));
$('#startOver').addEventListener('click', reset);
document.querySelectorAll('.step').forEach((button) => button.addEventListener('click', () => { const stage = button.dataset.step; if (stage === 'reference' || (stage === 'prompt' && state.analysis) || (stage === 'manual' && state.selected) || (stage === 'finalize' && state.generatedFile) || (stage === 'ready' && state.finalUrl)) go(stage); }));
