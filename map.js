// ============================================================
// map.js — public community map showing every sighting
// ============================================================

const map = L.map("map").setView([39.8, -98.6], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Sightings often pile up at the same spot (the same yard, the same park
// bench), which used to make pins stack invisibly on top of each other.
// A cluster group shows a single numbered badge for nearby pins and, when
// clicked, either zooms in or "spiderfies" — fanning pins that share the
// exact same coordinates out into a small arc so every one is reachable.
const markers = L.markerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  maxClusterRadius: 50,
});
map.addLayer(markers);

const countLabel = document.getElementById("count-label");

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const units = [
    ["year", 31536000], ["month", 2592000], ["day", 86400],
    ["hour", 3600], ["minute", 60],
  ];
  for (const [name, secs] of units) {
    const val = Math.floor(seconds / secs);
    if (val >= 1) return `${val} ${name}${val > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

async function loadSightings() {
  const { data, error } = await supabaseClient
    .from("sightings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    countLabel.textContent = "Couldn't load sightings right now.";
    return;
  }

  if (!data || data.length === 0) {
    countLabel.textContent = "No toys found yet — be the first!";
    return;
  }

  countLabel.textContent = `${data.length} toy${data.length === 1 ? "" : "s"} found so far`;

  markers.clearLayers();
  const bounds = [];
  data.forEach((s) => {
    const marker = L.marker([s.lat, s.lng]);
    const photoHtml = s.photo_url
      ? `<img class="popup-photo" src="${escapeHtml(s.photo_url)}" alt="Photo of the toy" />`
      : "";
    marker.bindPopup(
      `${photoHtml}<strong>${escapeHtml(s.toy_id)}</strong><br>${escapeHtml(s.message)}<br><small>${timeAgo(s.created_at)}</small>`
    );
    markers.addLayer(marker);
    bounds.push([s.lat, s.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
  }
}

loadSightings();
