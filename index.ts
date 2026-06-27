// ============================================================
// notify-admin
//
// Triggered by a Supabase Database Webhook whenever a new row is
// inserted into the `sightings` table. Posts a message to a Discord
// channel (via a Discord webhook) with a link to approve or reject
// the post. Anyone in that channel sees it instantly — no per-person
// list to manage.
//
// Required secrets (set with `supabase secrets set`):
//   DISCORD_WEBHOOK_URL          the webhook URL from your Discord channel
//                                 (Server Settings → Integrations → Webhooks)
//   FUNCTIONS_BASE_URL           e.g. https://abcxyz.supabase.co/functions/v1
//                                 (must include the /functions/v1 path — a
//                                 base URL without it produces broken
//                                 approve/reject links and a gateway-level
//                                 "requested path is invalid" error)
//   WEBHOOK_SECRET                any random string you make up — must match
//                                 the header you set on the Database Webhook
//   SUPABASE_URL                 (auto-provided by Supabase, no action needed)
//   SUPABASE_SERVICE_ROLE_KEY    (auto-provided by Supabase, no action needed)
// ============================================================

Deno.serve(async (req) => {
  try {
    // Confirm this request really came from our own Database Webhook,
    // not someone who found this function's URL.
    const incomingSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    if (!expectedSecret || incomingSecret !== expectedSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await req.json();
    const record = payload.record;

    if (!record || !record.id || !record.approval_token) {
      return new Response("Missing record data", { status: 400 });
    }

    const functionsBaseUrl = Deno.env.get("FUNCTIONS_BASE_URL");
    const approveUrl = `${functionsBaseUrl}/moderate?id=${record.id}&token=${record.approval_token}&action=approve`;
    const rejectUrl = `${functionsBaseUrl}/moderate?id=${record.id}&token=${record.approval_token}&action=reject`;

    const messagePreview = (record.message || "").slice(0, 300);
    const mapUrl =
      record.lat != null && record.lng != null
        ? `https://www.google.com/maps?q=${record.lat},${record.lng}`
        : null;

    // Build a rich embed so the moderator can see what the submission
    // actually looks like (photo + pin location) without leaving Discord.
    const embed: Record<string, unknown> = {
      title: `🧸 New sighting: ${record.toy_id}`,
      description: messagePreview ? `"${messagePreview}"` : "(no message)",
      color: 0x4ade80,
      fields: [
        {
          name: "Moderate",
          value: `✅ [Approve](${approveUrl})  |  ❌ [Reject](${rejectUrl})`,
          inline: false,
        },
      ],
      timestamp: record.created_at || new Date().toISOString(),
    };

    if (mapUrl) {
      (embed.fields as unknown[]).unshift({
        name: "📍 Location",
        value: `[View pin on map](${mapUrl})`,
        inline: false,
      });
    }

    // If a photo was attached, embed it directly so it renders as an
    // image preview right in the Discord message.
    if (record.photo_url) {
      embed.image = { url: record.photo_url };
    }

    // Always include a link to the full admin dashboard at the bottom,
    // in case the moderator wants more context than fits in this card.
    const adminUrl = Deno.env.get("ADMIN_URL") || "https://roysecitytoys.com/admin.html";
    (embed.fields as unknown[]).push({
      name: "🛠️ Admin",
      value: `[Open admin dashboard](${adminUrl})`,
      inline: false,
    });

    const content = `**New Royse City Toys Around Town post** (\`${record.toy_id}\`)`;

    const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is not set");
      return new Response("Discord webhook not configured", { status: 500 });
    }

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, embeds: [embed] }),
    });

    if (!resp.ok) {
      console.error("Discord webhook error:", await resp.text());
      return new Response("Failed to post to Discord", { status: 502 });
    }

    return new Response("OK — posted to Discord", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("Internal error", { status: 500 });
  }
});
