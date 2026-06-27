// ============================================================
// qrcodes.js — generates printable SVG QR codes from the admin page
// Uses the "qrcode" library (window.QRCode) and JSZip for bulk download.
// ============================================================

const qrBaseUrlInput = document.getElementById("qr-base-url");
const qrPrefixInput = document.getElementById("qr-prefix");
const qrStartInput = document.getElementById("qr-start");
const qrCountInput = document.getElementById("qr-count");
const qrCustomIdsInput = document.getElementById("qr-custom-ids");
const qrGenerateBtn = document.getElementById("qr-generate-btn");
const qrDownloadAllBtn = document.getElementById("qr-download-all-btn");
const qrStatusEl = document.getElementById("qr-status");
const qrGridEl = document.getElementById("qr-grid");

// Default the base URL to wherever this admin page is being viewed from
if (qrBaseUrlInput && !qrBaseUrlInput.value) {
  qrBaseUrlInput.value = window.location.origin;
}

// Keeps the most recently generated batch so "Download all" can zip it up
let lastBatch = []; // [{ id, svg }]

function buildToyIdList() {
  const customRaw = qrCustomIdsInput.value.trim();
  if (customRaw) {
    return customRaw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  const prefix = qrPrefixInput.value.trim() || "toy-";
  const start = parseInt(qrStartInput.value, 10) || 1;
  const count = parseInt(qrCountInput.value, 10) || 0;

  const ids = [];
  for (let i = 0; i < count; i++) {
    const num = start + i;
    ids.push(`${prefix}${String(num).padStart(3, "0")}`);
  }
  return ids;
}

function sanitizeFilename(id) {
  return id.replace(/[^a-z0-9-_]/gi, "_");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

qrGenerateBtn.addEventListener("click", async () => {
  qrStatusEl.innerHTML = "";
  qrGridEl.innerHTML = "";
  qrDownloadAllBtn.style.display = "none";
  lastBatch = [];

  const baseUrl = (qrBaseUrlInput.value || window.location.origin).replace(/\/+$/, "");
  const ids = buildToyIdList();

  if (ids.length === 0) {
    qrStatusEl.innerHTML = `<div class="status-msg error">Please set a count, or paste at least one toy ID.</div>`;
    return;
  }
  if (ids.length > 200) {
    qrStatusEl.innerHTML = `<div class="status-msg error">That's a lot of toys at once (${ids.length}). Try 200 or fewer per batch.</div>`;
    return;
  }

  qrGenerateBtn.disabled = true;
  qrGenerateBtn.textContent = "Generating...";

  try {
    for (const id of ids) {
      const targetUrl = `${baseUrl}/find.html?toy=${encodeURIComponent(id)}`;
      const svg = await QRCode.toString(targetUrl, {
        type: "svg",
        width: 300,
        margin: 2,
      });

      lastBatch.push({ id, svg });

      const cell = document.createElement("div");
      cell.className = "qr-cell";
      cell.innerHTML = `
        <div class="qr-svg-wrap">${svg}</div>
        <div class="qr-label">${id}</div>
        <button type="button" class="secondary qr-download-one" data-id="${id}">Download SVG</button>
      `;
      cell.querySelector(".qr-download-one").addEventListener("click", () => {
        const blob = new Blob([svg], { type: "image/svg+xml" });
        downloadBlob(blob, `${sanitizeFilename(id)}.svg`);
      });
      qrGridEl.appendChild(cell);
    }

    qrStatusEl.innerHTML = `<div class="status-msg success">Generated ${ids.length} QR code${ids.length === 1 ? "" : "s"}.</div>`;
    qrDownloadAllBtn.style.display = "block";
  } catch (err) {
    console.error(err);
    qrStatusEl.innerHTML = `<div class="status-msg error">Something went wrong generating the codes. Please try again.</div>`;
  }

  qrGenerateBtn.disabled = false;
  qrGenerateBtn.textContent = "Generate QR codes";
});

qrDownloadAllBtn.addEventListener("click", async () => {
  if (lastBatch.length === 0) return;

  qrDownloadAllBtn.disabled = true;
  qrDownloadAllBtn.textContent = "Zipping...";

  try {
    const zip = new JSZip();
    lastBatch.forEach(({ id, svg }) => {
      zip.file(`${sanitizeFilename(id)}.svg`, svg);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "toy-qr-codes.zip");
  } catch (err) {
    console.error(err);
    qrStatusEl.innerHTML = `<div class="status-msg error">Couldn't build the ZIP file. Try downloading codes individually instead.</div>`;
  }

  qrDownloadAllBtn.disabled = false;
  qrDownloadAllBtn.textContent = "Download all as ZIP";
});
