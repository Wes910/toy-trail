// ============================================================
// find.js — handles the "I found a toy!" page
// ============================================================

// Pull the toy ID out of the URL, e.g. find.html?toy=toy-007
const params = new URLSearchParams(window.location.search);
const toyId = params.get("toy") || "unknown-toy";
document.getElementById("toy-label").textContent = `You found: ${toyId}`;

// Default map view: center of the US-ish; will recenter on geolocation if available
let marker;
const map = L.map("map").setView([39.8, -98.6], 4);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

function placeMarker(lat, lng, zoom) {
  if (marker) {
    marker.setLatLng([lat, lng]);
  } else {
    marker = L.marker([lat, lng], { draggable: true }).addTo(map);
  }
  map.setView([lat, lng], zoom || 15);
}

// Try to get the user's location automatically on load
function tryGeolocate() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => placeMarker(pos.coords.latitude, pos.coords.longitude, 16),
    () => {
      // Permission denied or unavailable — let them click the map instead
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}
tryGeolocate();

document.getElementById("locate-btn").addEventListener("click", tryGeolocate);

// Let them click anywhere on the map to drop/move the pin
map.on("click", (e) => {
  placeMarker(e.latlng.lat, e.latlng.lng, map.getZoom());
});

// Character counter
const messageEl = document.getElementById("message");
const charCountEl = document.getElementById("char-count");
messageEl.addEventListener("input", () => {
  charCountEl.textContent = messageEl.value.length;
});

// Submit-related elements (declared here so the photo handler below can use statusEl)
const form = document.getElementById("sighting-form");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");

// Photo preview
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photo-preview");
let selectedPhotoFile = null;

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8MB

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) {
    selectedPhotoFile = null;
    photoPreview.style.display = "none";
    return;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    statusEl.innerHTML = `<div class="status-msg error">That photo is too big (max 8MB). Please choose a smaller one.</div>`;
    photoInput.value = "";
    selectedPhotoFile = null;
    photoPreview.style.display = "none";
    return;
  }
  selectedPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    photoPreview.src = e.target.result;
    photoPreview.style.display = "block";
  };
  reader.readAsDataURL(file);
});

// Uploads the selected photo (if any) to Supabase Storage and returns its public URL
async function uploadPhotoIfNeeded() {
  if (!selectedPhotoFile) return null;

  const ext = selectedPhotoFile.name.split(".").pop() || "jpg";
  const filename = `${toyId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("sighting-photos")
    .upload(filename, selectedPhotoFile);

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabaseClient.storage.from("sighting-photos").getPublicUrl(filename);
  return data.publicUrl;
}

// Submit handler
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.innerHTML = "";

  if (!marker) {
    statusEl.innerHTML = `<div class="status-msg error">Please drop a pin on the map first.</div>`;
    return;
  }

  const message = messageEl.value.trim();
  if (!message) {
    statusEl.innerHTML = `<div class="status-msg error">Please write a short message.</div>`;
    return;
  }

  const { lat, lng } = marker.getLatLng();

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  let photoUrl = null;
  try {
    photoUrl = await uploadPhotoIfNeeded();
  } catch (err) {
    console.error(err);
    submitBtn.disabled = false;
    submitBtn.textContent = "Drop my pin";
    statusEl.innerHTML = `<div class="status-msg error">Couldn't upload your photo. You can try again, or submit without one.</div>`;
    return;
  }

  const { error } = await supabaseClient.from("sightings").insert({
    toy_id: toyId,
    lat,
    lng,
    message,
    photo_url: photoUrl,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Drop my pin";

  if (error) {
    console.error(error);
    statusEl.innerHTML = `<div class="status-msg error">Something went wrong submitting your pin. Please try again.</div>`;
    return;
  }

  form.reset();
  charCountEl.textContent = "0";
  photoPreview.style.display = "none";
  selectedPhotoFile = null;

  const shareUrl = encodeURIComponent(window.location.href.split("?")[0] + `?toy=${encodeURIComponent(toyId)}`);
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;

  statusEl.innerHTML = `<div class="status-msg success">
    Thanks for sharing! Your post is awaiting a quick review and will appear on the <a href="map.html">community map</a> once approved.
    <div class="share-row">
      <a href="${facebookShareUrl}" target="_blank" rel="noopener" class="facebook-share-btn">📘 Share on Facebook</a>
    </div>
  </div>`;
});
