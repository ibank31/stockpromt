const imageInput = document.querySelector("#image");
const preview = document.querySelector("#preview");
const runButton = document.querySelector("#run");
const statusEl = document.querySelector("#status");
const drop = document.querySelector("#drop");
const results = document.querySelector("#results");
const summary = document.querySelector("#summary");

let selectedFile = null;

imageInput.addEventListener("change", () => {
  selectedFile = imageInput.files?.[0] || null;
  updatePreview();
});

drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("dragging");
});
drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
drop.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.classList.remove("dragging");
  selectedFile = event.dataTransfer.files?.[0] || null;
  if (selectedFile) updatePreview();
});

function setStatus(text, busy = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("busy", busy);
}

async function resizeForAnalysis(file) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Could not prepare image"));
      resolve(blob);
    }, "image/jpeg", 0.88);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

function updatePreview() {
  if (!selectedFile || !selectedFile.type.startsWith("image/")) {
    runButton.disabled = true;
    preview.hidden = true;
    return;
  }
  const url = URL.createObjectURL(selectedFile);
  preview.src = url;
  preview.hidden = false;
  runButton.disabled = false;
  setStatus("READY");
}

async function copyText(text, button) {
  await navigator.clipboard.writeText(text);
  const old = button.textContent;
  button.textContent = "COPIED";
  setTimeout(() => { button.textContent = old; }, 900);
}

function makeCard(item, index) {
  const article = document.createElement("article");
  article.className = "card";
  article.innerHTML = `
    <div class="card-head">
      <div>
        <span class="num">0${index + 1}</span>
        <h3>${escapeHtml(item.concept_title)}</h3>
      </div>
      <span class="badge">${escapeHtml(item.content_type)}</span>
    </div>
    <p class="use"><strong>Buyer use:</strong> ${escapeHtml(item.buyer_use_case)}</p>
    <p class="change"><strong>Creative change:</strong> ${escapeHtml(item.creative_change_summary)}</p>
    <div class="prompt-box"><div class="box-head"><span>MASTER PROMPT</span><button class="copy">COPY</button></div><pre>${escapeHtml(item.prompt)}</pre></div>
    <div class="prompt-box muted"><div class="box-head"><span>NEGATIVE / FAILURE AVOIDANCE</span><button class="copy">COPY</button></div><pre>${escapeHtml(item.negative_prompt)}</pre></div>
    <div class="meta"><span>Aspect: ${escapeHtml(item.aspect_ratio)}</span><span>Copy space: ${escapeHtml(item.copy_space)}</span></div>
  `;
  article.querySelectorAll("button.copy")[0].addEventListener("click", (e) => copyText(item.prompt, e.currentTarget));
  article.querySelectorAll("button.copy")[1].addEventListener("click", (e) => copyText(item.negative_prompt, e.currentTarget));
  return article;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

runButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  try {
    runButton.disabled = true;
    setStatus("ANALYZING", true);
    const prepared = await resizeForAnalysis(selectedFile);
    const dataUrl = await blobToDataUrl(prepared);
    const response = await fetch("./api/prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        image: dataUrl,
        asset_type: document.querySelector("#assetType").value,
        preferred_aspect: document.querySelector("#aspect").value,
        notes: document.querySelector("#notes").value,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Prompt compilation failed");

    document.querySelector("#referenceSummary").textContent = payload.result.reference_summary;
    document.querySelector("#commercialIntent").textContent = payload.result.commercial_intent;
    const notes = document.querySelector("#policyNotes");
    notes.replaceChildren(...payload.result.policy_notes.map((note) => {
      const li = document.createElement("li");
      li.textContent = note;
      return li;
    }));
    document.querySelector("#modelBadge").textContent = `Model: ${payload.model}`;

    const cards = document.querySelector("#cards");
    cards.replaceChildren(...payload.result.opportunities.map(makeCard));
    summary.hidden = false;
    results.hidden = false;
    setStatus("5 PROMPTS READY");
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setStatus("ERROR");
    alert(error instanceof Error ? error.message : String(error));
  } finally {
    runButton.disabled = !selectedFile;
  }
});
