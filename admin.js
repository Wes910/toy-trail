// ============================================================
// admin.js — login + moderation dashboard
// ============================================================

const loginCard = document.getElementById("login-card");
const dashboardCard = document.getElementById("dashboard-card");
const loginStatus = document.getElementById("login-status");
const listEl = document.getElementById("sightings-list");

let adminMap, markersLayer;
let currentFilter = "pending";

document.querySelectorAll("#filter-tabs .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#filter-tabs .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.status;
    loadSightings();
  });
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    showDashboard();
  }
}
checkSession();

document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;
  loginStatus.innerHTML = "";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    loginStatus.innerHTML = `<div class="status-msg error">Login failed: ${escapeHtml(error.message)}</div>`;
    return;
  }
  showDashboard();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  dashboardCard.style.display = "none";
  document.getElementById("qr-card").style.display = "none";
  document.getElementById("notify-card").style.display = "none";
  loginCard.style.display = "block";
});

function showDashboard() {
  loginCard.style.display = "none";
  dashboardCard.style.display = "block";
  document.getElementById("qr-card").style.display = "block";
  document.getElementById("notify-card").style.display = "block";
  if (typeof loadRecipients === "function") loadRecipients();

  if (!adminMap) {
    adminMap = L.map("admin-map").setView([39.8, -98.6], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(adminMap);
    markersLayer = L.layerGroup().addTo(adminMap);
  }

  loadSightings();
}

async function loadSightings() {
  listEl.innerHTML = "<p class='hint'>Loading...</p>";
  markersLayer.clearLayers();

  let query = supabaseClient.from("sightings").select("*").order("created_at", { ascending: false });
  if (currentFilter !== "all") {
    query = query.eq("status", currentFilter);
  }
  const { data, error } = await query;

  if (error) {
    listEl.innerHTML = `<div class="status-msg error">Failed to load: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Nothing here.</div>`;
    return;
  }

  const bounds = [];
  listEl.innerHTML = "";

  data.forEach((s) => {
    const marker = L.marker([s.lat, s.lng]).addTo(markersLayer);
    const popupPhotoHtml = s.photo_url
      ? `<img class="popup-photo" src="${escapeHtml(s.photo_url)}" alt="Photo of the toy" />`
      : "";
    marker.bindPopup(`${popupPhotoHtml}<strong>${escapeHtml(s.toy_id)}</strong><br>${escapeHtml(s.message)}`);
    bounds.push([s.lat, s.lng]);

    const photoHtml = s.photo_url
      ? `<img class="sighting-photo" src="${escapeHtml(s.photo_url)}" alt="Photo of the toy" />`
      : "";

    const actionButtons =
      s.status === "pending"
        ? `<button class="approve" data-id="${s.id}">Approve</button>
           <button class="danger reject" data-id="${s.id}">Reject</button>`
        : "";

    const item = document.createElement("div");
    item.className = "sighting-item";
    item.innerHTML = `
      <div class="meta">${escapeHtml(s.toy_id)} • ${new Date(s.created_at).toLocaleString()}
        <span class="status-badge ${s.status}">${s.status}</span>
      </div>
      ${photoHtml}
      <div class="msg">${escapeHtml(s.message)}</div>
      <div class="actions">
        ${actionButtons}
        <button class="danger" data-id="${s.id}">Delete</button>
      </div>
    `;
    item.querySelector("button.danger:not(.reject)").addEventListener("click", () => deleteSighting(s.id, s.photo_url));
    const approveBtn = item.querySelector("button.approve");
    if (approveBtn) approveBtn.addEventListener("click", () => setStatus(s.id, "approved"));
    const rejectBtn = item.querySelector("button.reject");
    if (rejectBtn) rejectBtn.addEventListener("click", () => setStatus(s.id, "rejected"));
    listEl.appendChild(item);
  });

  if (bounds.length > 0) {
    adminMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  }
}

async function setStatus(id, status) {
  const { error } = await supabaseClient.from("sightings").update({ status }).eq("id", id);
  if (error) {
    alert("Failed to update: " + error.message);
    return;
  }
  loadSightings();
}

async function deleteSighting(id, photoUrl) {
  if (!confirm("Delete this post permanently?")) return;

  const { error } = await supabaseClient.from("sightings").delete().eq("id", id);
  if (error) {
    alert("Failed to delete: " + error.message);
    return;
  }

  // Best-effort cleanup of the associated photo file, if any
  if (photoUrl) {
    try {
      const filename = photoUrl.split("/sighting-photos/").pop();
      if (filename) {
        await supabaseClient.storage.from("sighting-photos").remove([filename]);
      }
    } catch (err) {
      console.warn("Could not remove photo file:", err);
    }
  }

  loadSightings();
}
