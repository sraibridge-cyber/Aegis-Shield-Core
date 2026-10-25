import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/neon/client";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({ component: Home });

type Post = { id: string; slug: string | null; title: string; body: string | null };

// Canonical Vincen pattern — PUBLIC reads via an automatic anonymous token, NO server.
// Build pages from small section components in `src/components/sections/*` that fetch with
// useQuery + db.from(...) and handle loading/error/empty. The agent replaces `posts` +
// this page with the real site's tables and sections.
function Home() {
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await db
        .from<Post[]>("posts")
        .select("id, slug, title, body")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Posts</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Public reads for everyone via an anonymous token — no server we run.
      </p>

      {isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
      {error && <p className="mt-6 text-destructive">Couldn't load posts.</p>}

      <div className="mt-6 space-y-4">
        {(posts ?? []).map((p) => {
          // List → detail click-through. `<Link to="/posts/$slug" params={{ slug }}>`
          // is type-safe TanStack navigation (see routes/posts.$slug.tsx) — NEVER an
          // `<a href>` (that full-reloads and drops SPA state). Only link a row that
          // HAS the param; a null slug can't build a valid detail URL.
          const card = (
            <Card className="transition-colors hover:border-primary/40">
              <CardContent className="py-4">
                <h2 className="font-medium text-card-foreground">{p.title}</h2>
                {p.body && <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>}
              </CardContent>
            </Card>
          );
          return p.slug ? (
            <Link key={p.id} to="/posts/$slug" params={{ slug: p.slug }} className="block">
              {card}
            </Link>
          ) : (
            <div key={p.id}>{card}</div>
          );
        })}
        {!isLoading && !error && (posts ?? []).length === 0 && (
          <p className="text-muted-foreground">No posts yet.</p>
        )}
      </div>
    </main>
  );
}
