import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/neon/client";

export const Route = createFileRoute("/posts/$slug")({ component: PostDetail });

type Post = { id: string; slug: string | null; title: string; body: string | null };

// ── CANONICAL DETAIL ROUTE (list → click → detail) ──────────────────────────
// Copy this SHAPE for every real detail page (attorneys/$slug, products/$id …).
// The three things that make click-through actually work:
//
//   1. FILE NAME encodes the param: `posts.$slug.tsx` → route `/posts/$slug`.
//      The `$slug` here MUST match `Route.useParams()` below AND the
//      `<Link params={{ slug }}>` on the list side (routes/index.tsx). A
//      mismatch = the link goes nowhere / the page can't read its id.
//
//   2. FETCH THE ONE ROW BY THAT PARAM AS AN ARRAY + take [0] — do NOT use
//      `.single()`: on a missing/unknown id PostgREST errors, which turns a
//      normal "not found" into a scary error. `.limit(1)` → `[0] ?? null` gives
//      a clean null for "no such row".
//
//   3. GUARD EVERY STATE: loading → error → NOT-FOUND (row is null) → content.
//      NEVER touch `post.title` before you've checked `post` exists — an
//      unguarded field on a missing row is THE #1 broken-detail crash (it
//      throws → the root ErrorBoundary shows "Something went wrong").
function PostDetail() {
  const { slug } = Route.useParams();
  const { data: post, isLoading, error } = useQuery({
    queryKey: ["post", slug],
    queryFn: async () => {
      const { data, error } = await db
        .from<Post[]>("posts")
        .select("id, slug, title, body")
        .eq("slug", slug)
        .limit(1);
      if (error) throw new Error(error.message);
      return (data ?? [])[0] ?? null;
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </Link>

      {isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <p className="mt-6 text-destructive">Couldn’t load this post.</p>}
      {!isLoading && !error && !post && (
        <p className="mt-6 text-muted-foreground">Not found.</p>
      )}

      {post && (
        <article className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {post.title}
          </h1>
          {post.body && (
            <p className="mt-4 whitespace-pre-line text-muted-foreground">{post.body}</p>
          )}
        </article>
      )}
    </main>
  );
}
