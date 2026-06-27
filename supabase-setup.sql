-- ============================================================
-- Toy Trail — Supabase setup script
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste all of this → Run)
-- ============================================================

-- 1. Table that stores every "I found it!" submission
create table if not exists sightings (
  id uuid primary key default gen_random_uuid(),
  toy_id text not null,
  lat double precision not null,
  lng double precision not null,
  message text not null check (char_length(message) <= 500),
  photo_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approval_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- If you already ran this script before photos were added, run this line
-- on its own to add the new column to your existing table:
-- alter table sightings add column if not exists photo_url text;

-- If you already ran this script before moderation/approval was added, run
-- these on their own to add the new columns to your existing table:
-- alter table sightings add column if not exists status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'));
-- alter table sightings add column if not exists approval_token uuid not null default gen_random_uuid();
-- update sightings set status = 'approved' where status is null; -- treat old posts as already approved

-- If you already ran this script before multi-recipient texting was added,
-- just run the "notify_recipients" table block below on its own — everything
-- in this script uses "if not exists" / "on conflict do nothing" so re-running
-- the whole thing is also safe.

-- Helpful index for filtering by toy
create index if not exists sightings_toy_id_idx on sightings (toy_id);

-- 2. Lock the table down, then open only the specific access we want
alter table sightings enable row level security;

-- Anyone (anonymous visitors using the public site) can submit a sighting
create policy "Public can insert sightings"
on sightings for insert
to anon
with check (true);

-- Anyone can read APPROVED sightings only (so the community map only shows
-- posts you've approved — pending/rejected posts stay invisible to the public)
create policy "Public can read approved sightings"
on sightings for select
to anon
using (status = 'approved');

-- Logged-in admin can read every sighting, regardless of status
create policy "Authenticated can read all sightings"
on sightings for select
to authenticated
using (true);

-- Only logged-in admin users can delete a sighting (moderation)
create policy "Authenticated can delete sightings"
on sightings for delete
to authenticated
using (true);

-- Only logged-in admin users can update (e.g. approve/reject from the dashboard)
create policy "Authenticated can update sightings"
on sightings for update
to authenticated
using (true);

-- 3. Phone numbers that get texted when a new sighting comes in.
-- Manage this list from the admin page (no SQL needed after initial setup).
create table if not exists notify_recipients (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  created_at timestamptz not null default now()
);

alter table notify_recipients enable row level security;

-- Only the logged-in admin can ever see, add, or remove recipients.
-- Anonymous visitors have no access at all to this table.
create policy "Authenticated can read recipients"
on notify_recipients for select
to authenticated
using (true);

create policy "Authenticated can add recipients"
on notify_recipients for insert
to authenticated
with check (true);

create policy "Authenticated can delete recipients"
on notify_recipients for delete
to authenticated
using (true);

-- Seeds your number in so texts start working immediately. Add/remove more
-- any time from the admin page — you never need to touch this table again.
insert into notify_recipients (phone_number) values ('+12142834243')
on conflict (phone_number) do nothing;

-- 4. Storage bucket for uploaded photos
insert into storage.buckets (id, name, public)
values ('sighting-photos', 'sighting-photos', true)
on conflict (id) do nothing;

-- Anyone can upload a photo (visitors submitting a sighting)
create policy "Public can upload sighting photos"
on storage.objects for insert
to anon
with check (bucket_id = 'sighting-photos');

-- Anyone can view photos (so they show up on the public map)
create policy "Public can view sighting photos"
on storage.objects for select
to anon
using (bucket_id = 'sighting-photos');

-- Only logged-in admin users can delete a photo (moderation cleanup)
create policy "Authenticated can delete sighting photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'sighting-photos');

-- ============================================================
-- Next step: create your one admin login.
-- Dashboard → Authentication → Users → Add user
-- Enter an email and password you'll remember — this is what you'll
-- type into the admin page on the website to moderate posts.
-- ============================================================
