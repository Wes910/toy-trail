// ============================================================
// Toy Trail — Supabase configuration
//
// Fill these two values in after creating your Supabase project:
//   1. Go to your Supabase project dashboard
//   2. Click "Project Settings" (gear icon) → "API Keys"
//   3. Copy the "Project URL" and the "Publishable" key
//   4. Paste them below
//
// These are safe to be public — the publishable key only allows the
// limited actions defined by the RLS policies in supabase-setup.sql.
//
// Note: admin.html signs in with a real Supabase Auth session (the admin
// login). supabase-js persists that session in localStorage under a key
// tied to this project, and localStorage is shared across every page on
// the same domain. Without the isolation below, that meant: once someone
// logged into admin.html in a browser, the *same browser's* find.html page
// would silently pick up the leftover admin session and submit "Drop my
// pin" requests as an authenticated admin instead of an anonymous visitor
// — which fails, because only "anon" has permission to insert sightings,
// not "authenticated". Giving the public pages (find/map) their own
// separate, non-persisted session storage keeps them fully anonymous and
// fixes that.
// ============================================================

const SUPABASE_URL = "https://pecbjwvmuurzrvjoukwd.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_aAMpr1-Ic86aDDaOmue9aQ_UGSygBFR";

const isAdminPage = window.location.pathname.includes("admin");

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: isAdminPage,
    storageKey: isAdminPage ? "toytrail-admin-auth" : "toytrail-public-auth",
  },
});
