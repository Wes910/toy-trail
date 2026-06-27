# Toy Trail — Setup Guide

A site for your hidden 3D-printed toys: scan a toy's QR code, drop a pin where you
found it, leave a short message, and see it join a community map. You moderate
posts from a private admin page.

Total setup time: ~35-40 minutes, no coding required (a little copy/paste and
account-creating).

---

## What you're setting up

- **Supabase** — free database that stores every pin/message, your admin login, and the two small server functions that handle texting and moderation
- **Discord** — posts a notification with Approve/Reject links to a Discord channel when someone posts (free)
- **Netlify** — free static hosting for the actual website
- **This folder** — the website files, ready to deploy as-is once configured

---

## Step 1: Create your Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**. Give it any name, set a database password (save it somewhere), pick a region close to you.
3. Wait ~1 minute for it to finish setting up.

## Step 2: Run the database setup script

1. In your Supabase project, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase-setup.sql` (in this folder), copy all of it, paste into the editor.
4. Click **Run**.

This creates the table that stores sightings, a storage bucket for uploaded
photos, and locks both down so:
- Anyone can submit a pin/message/photo (it goes in as **pending**)
- Only approved posts are visible on the public map
- Only you (logged in) can approve, reject, or delete a post

**Already had this set up before?** Re-running the script is safe — it only
adds what's missing (the photo column, and now the status/approval columns).
Existing posts get marked `approved` automatically so nothing you already
published disappears.

## Step 3: Create your admin login

1. In Supabase, go to **Authentication → Users**.
2. Click **Add user → Create new user**.
3. Enter:
   - Email: `wes910@yahoo.com`
   - Password: `Elvis3198!`

This is what you'll type into the admin page (`admin.html`) to moderate posts. It doesn't need to be a real inbox — Supabase doesn't send anything to it, it's just used as your login ID.

(Consider changing this password down the road, since it's now written here in plain text in a file on your computer — anyone with access to this folder could read it.)

## Step 4: Connect the website to your Supabase project

1. In Supabase, go to **Project Settings (gear icon) → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open `js/config.js` in this folder and paste them in:

```js
const SUPABASE_URL = "https://xxxxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIs...";
```

Save the file.

## Step 5: Create your Discord webhook

1. In Discord, create a server (or use an existing one) and a channel you want notifications in — e.g. `#toy-trail-alerts`.
2. Click the gear icon next to the channel name → **Integrations → Webhooks → New Webhook**.
3. Give it a name (e.g. "Toy Trail Bot"), then click **Copy Webhook URL**. Keep this somewhere safe — you'll paste it in as a secret in Step 6.
4. Anyone you add to that channel (or invite to the server) will see new sighting notifications and can click Approve/Reject — no per-person phone number list to manage.

## Step 6: Deploy the two server functions

These two small functions are what actually send the text and handle the approve/reject clicks. They run on Supabase, not on Netlify, and need the Supabase CLI to deploy (a one-time install).

1. Install the CLI and log in (run in any terminal — Mac: Terminal app, Windows: Command Prompt):
   ```
   npm install -g supabase
   supabase login
   ```
2. From inside this `toy-trail` folder, link it to your Supabase project (find your **Project Ref** in Supabase under Project Settings → General):
   ```
   supabase link --project-ref YOUR_PROJECT_REF
   ```
3. Set the secrets these functions need (replace each value with your own):
   ```
   supabase secrets set DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/xxxxx/xxxxx"
   supabase secrets set WEBHOOK_SECRET="make-up-any-long-random-string-here"
   supabase secrets set FUNCTIONS_BASE_URL="https://YOUR_PROJECT_REF.functions.supabase.co"
   ```
4. Deploy both functions:
   ```
   supabase functions deploy notify-admin
   supabase functions deploy moderate
   ```
   Make sure both are set to allow public access (no JWT required) — when prompted, or afterward in the Supabase Dashboard under **Edge Functions → (function name) → Settings**, turn off "Enforce JWT verification" for both. They have their own protection built in (the webhook secret and the per-post token), so this is expected and safe.

**Who actually sees the notification?** Anyone in the Discord channel you picked in Step 5 — add or remove people from that channel/server any time in Discord itself, no redeploying needed. (The **Text notifications** card in `admin.html` and its phone number list are no longer used now that notifications go to Discord — safe to ignore, or you can come back to SMS later if you ever want it alongside Discord.)

## Step 7: Connect the database to the notify function

1. In Supabase, go to **Database → Webhooks → Create a new hook**.
2. Name it anything (e.g. "notify-admin-on-new-sighting").
3. Table: `sightings`. Events: check only **Insert**.
4. Type: **Supabase Edge Functions**. Choose the `notify-admin` function.
5. Under HTTP Headers, add one: key `x-webhook-secret`, value — the exact same random string you set as `WEBHOOK_SECRET` in Step 6.
6. Save.

Now, every time someone submits a sighting, this webhook fires, which posts the approve/reject links to your Discord channel.

## Step 8: Put the site online (Netlify)

1. Go to [netlify.com](https://netlify.com) and sign up (free).
2. From your Netlify dashboard, drag and drop this whole `toy-trail` folder onto the page (look for "Deploy manually" / the drag-and-drop box).
3. Netlify gives you a live URL like `https://random-name-123.netlify.app`. You can rename it (Site settings → Change site name) to something like `mycitytoytrail.netlify.app`.

Your site is now live. Four pages:
- `yoursite.netlify.app/index.html` — homepage
- `yoursite.netlify.app/map.html` — public community map
- `yoursite.netlify.app/admin.html` — your private moderation page (log in with the account from Step 3)
- `yoursite.netlify.app/find.html?toy=toy-001` — the page each QR code links to

## Step 9: Generate your QR codes

The easiest way — no install required:

1. Log in to `admin.html`. Scroll down to **Generate QR codes**.
2. Confirm the **Site URL** field shows your real Netlify address (it defaults to whatever URL you're viewing the admin page from).
3. Either set a prefix/starting number/count (e.g. `toy-`, starting at 1, for 20 toys → `toy-001` through `toy-020`), or paste your own specific IDs, one per line, if you'd rather name toys after where you hide them (e.g. `toy-park-bench`).
4. Click **Generate QR codes** — a preview grid appears.
5. Click **Download all as ZIP** to get every code as an individual SVG file, ready to print. Or download codes one at a time with the button under each.

SVGs print cleanly at any size with no blurring, so you can size them however small or large you like.

There's also a `generate_qr_codes.py` script in this folder that does the same thing from the command line, if you'd rather batch-generate from a terminal — it produces PNGs instead of SVGs. Either approach works; the admin page is simpler if you don't want to touch Python.

## Step 10: Try it yourself

- Open `find.html?toy=toy-001` on your phone, drop a pin, submit a message.
- You should see a message in your Discord channel within a few seconds with **Approve** and **Reject** links.
- Tap **Approve** — it opens a confirmation page in your browser.
- Check `map.html` — your pin should now appear.
- Open `admin.html`, log in — you'll see a Pending / Approved / Rejected / All view where you can also approve, reject, or delete posts without needing Discord.

---

## How moderation works

Every post starts as **pending** and is invisible on the public map. The
moment it's submitted, Supabase posts a message to your Discord channel with
the post's message preview and two links — tap Approve to publish it, tap
Reject to keep it hidden permanently. If nobody responds, the post simply
stays pending and hidden — nothing goes live without action. You can also
handle posts anytime from the `admin.html` dashboard instead of from Discord.

## Notes on cost

Supabase and Netlify's free tiers comfortably support a project like this
(thousands of sightings, no traffic concerns for a city-sized audience).
Discord notifications are free, so this setup has no ongoing cost beyond
hosting (which is also free at this scale).

## If you want a custom domain

Once live on Netlify, you can connect a real domain (e.g. `toytrail.city`) under
Site settings → Domain management. Domains themselves typically cost $10-15/year
from a registrar like Namecheap or Google Domains — that's the only part of this
project that isn't free.
