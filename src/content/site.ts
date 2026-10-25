/**
 * UI CONFIG ONLY — site name + navigation. NOT where page content lives.
 *
 * The site's actual content (copy, lists, stats, posts) lives in **Neon** (the
 * Data API), seeded by `neon/migrations/0001_init.sql` and fetched at runtime via
 * `db.from(...)` (`@/integrations/neon/client`) + `useQuery`. Keep ONLY structural
 * UI config here:
 *   - `name` — brand name (header + document <title>)
 *   - `nav`  — primary navigation; each `to` must match a `src/routes/*` file
 *
 * Add a page → add its route file under `src/routes/*` AND a `nav` entry here
 * (the header renders `nav` as <Link>s). Do NOT put headlines/copy/data here.
 */

export const site = {
  /** Brand name — shown in the header, reuse for the document <title>. */
  name: "Vincen Site",
  /** Primary nav. `to` must match a file-based route under `src/routes/*`. */
  nav: [{ label: "Home", to: "/" }],
} as const;
