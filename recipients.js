// ============================================================
// recipients.js — manage who gets texted on new sightings
// (the notify-admin Edge Function reads this table directly)
// ============================================================

const recipientsListEl = document.getElementById("recipients-list");
const newPhoneInput = document.getElementById("new-phone");
const addPhoneBtn = document.getElementById("add-phone-btn");
const recipientsStatusEl = document.getElementById("recipients-status");

// Turns "214-283-4243", "(214) 283 4243", "2142834243" etc. into
// E.164 format ("+12142834243") that Twilio expects. If the number
// already has a "+" we leave it alone (besides stripping spaces/dashes).
function normalizePhone(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/[^0-9]/g, "");
  }
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length === 10) {
    return "+1" + digits;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return "+" + digits;
  }
  return null; // doesn't look like a valid US number
}

async function loadRecipients() {
  recipientsListEl.innerHTML = "<p class='hint'>Loading...</p>";

  const { data, error } = await supabaseClient
    .from("notify_recipients")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    recipientsListEl.innerHTML = `<div class="status-msg error">Failed to load: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    recipientsListEl.innerHTML = `<div class="empty-state">No phone numbers yet — add one below.</div>`;
    return;
  }

  recipientsListEl.innerHTML = "";
  data.forEach((r) => {
    const row = document.createElement("div");
    row.className = "recipient-row";
    row.innerHTML = `
      <span class="phone">${escapeHtml(r.phone_number)}</span>
      <button type="button" class="danger" data-id="${r.id}">Remove</button>
    `;
    row.querySelector("button").addEventListener("click", () => deleteRecipient(r.id));
    recipientsListEl.appendChild(row);
  });
}

addPhoneBtn.addEventListener("click", async () => {
  recipientsStatusEl.innerHTML = "";
  const raw = newPhoneInput.value;
  const phone = normalizePhone(raw);

  if (!phone) {
    recipientsStatusEl.innerHTML = `<div class="status-msg error">That doesn't look like a valid phone number. Try a 10-digit US number.</div>`;
    return;
  }

  addPhoneBtn.disabled = true;
  const { error } = await supabaseClient.from("notify_recipients").insert({ phone_number: phone });
  addPhoneBtn.disabled = false;

  if (error) {
    const msg = error.message.includes("duplicate")
      ? "That number is already on the list."
      : error.message;
    recipientsStatusEl.innerHTML = `<div class="status-msg error">${escapeHtml(msg)}</div>`;
    return;
  }

  newPhoneInput.value = "";
  recipientsStatusEl.innerHTML = `<div class="status-msg success">Added.</div>`;
  loadRecipients();
});

async function deleteRecipient(id) {
  if (!confirm("Stop texting this number for new sightings?")) return;

  const { error } = await supabaseClient.from("notify_recipients").delete().eq("id", id);
  if (error) {
    alert("Failed to remove: " + error.message);
    return;
  }
  loadRecipients();
}
