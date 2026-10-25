-- ============================================================================
-- Vincen / Neon Data API migration. The migration is DECLARATIVE: it is the
-- site's desired schema + content, and the platform RE-APPLIES it on EVERY build
-- (first generation AND every revision). So it MUST be IDEMPOTENT — re-running it
-- converges the DB to what this file says, never duplicating or erroring. That's
-- what makes "fill the table / add a column / update the copy" revisions take
-- effect. The agent ADAPTS this: replace `posts` with the app's real tables.
--
-- NEON SPECIFICS (this is NOT Supabase — do not copy Supabase SQL):
--   • Roles are `anonymous` (logged-out) and `authenticated` (logged-in).
--     There is NO `anon` and NO `service_role`.
--   • The current user id is `auth.user_id()` (returns TEXT) — NOT `auth.uid()`.
--   • There is NO `auth.users` table. Don't FK to it.
--   • TWO table kinds:
--       – PUBLIC content (what the site shows): NO owner_id, public-read, SEEDED.
--         Give it a UNIQUE natural key + seed with ON CONFLICT (idempotent).
--       – PER-USER data (rows a user creates): owner_id DEFAULT auth.user_id(),
--         RLS by owner, NEVER seeded.
--     ⚠ owner_id DEFAULT auth.user_id() on a SEEDED table breaks it — seeds run
--       over an admin connection where auth.user_id() is NULL.
--   • Idempotent DDL: CREATE TABLE IF NOT EXISTS; for policies use
--     DROP POLICY IF EXISTS … ; CREATE POLICY … .
--   • No storage engine: media → the platform-managed `assets` table (don't seed it).
--   • Escape seed text with dollar-quoting ($$…$$) so apostrophes never break it.
--   • RLS is the only thing between the public internet and your rows — keep it ON.
-- ============================================================================

-- Canonical "public feed" table: anyone reads, only signed-in authors write.
-- (A blend: public-read + per-user write. Pure public-content tables omit author_id.)
CREATE TABLE IF NOT EXISTS public.posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE,                            -- natural key → idempotent seeding
  author_id  TEXT NOT NULL DEFAULT auth.user_id(),   -- auto-set for the signed-in user
  title      TEXT NOT NULL,
  body       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Grants: anonymous + authenticated READ; only authenticated WRITE.
GRANT SELECT ON public.posts TO anonymous, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;

-- RLS policies (idempotent: drop-then-create so re-apply never errors).
DROP POLICY IF EXISTS posts_public_read   ON public.posts;
DROP POLICY IF EXISTS posts_author_insert ON public.posts;
DROP POLICY IF EXISTS posts_author_update ON public.posts;
DROP POLICY IF EXISTS posts_author_delete ON public.posts;
CREATE POLICY posts_public_read   ON public.posts FOR SELECT                  USING (true);
CREATE POLICY posts_author_insert ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.user_id() = author_id);
CREATE POLICY posts_author_update ON public.posts FOR UPDATE TO authenticated USING (auth.user_id() = author_id);
CREATE POLICY posts_author_delete ON public.posts FOR DELETE TO authenticated USING (auth.user_id() = author_id);

-- Seed one public post — idempotent via the slug natural key.
INSERT INTO public.posts (slug, author_id, title, body) VALUES
  ($$welcome$$, $$seed$$, $$Welcome to your new site$$, $$This post is public — anyone can read it. Sign in to add your own.$$)
  ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body;
