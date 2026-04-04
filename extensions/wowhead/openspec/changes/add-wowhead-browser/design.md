## Context

This repo contains multiple Vicinae extensions that already establish conventions for command manifests, action layout, and React Query persistence. A Wowhead extension should follow those conventions while accounting for a practical integration risk: direct scraping/fetching from Wowhead pages can intermittently return blocked responses depending on request environment.

## Goals / Non-Goals

**Goals:**

- Add a new `wowhead` extension with one retail-focused view command.
- Support universal search with a user-selectable entity type filter.
- Show lightweight preview metadata in Vicinae and open full pages in browser.
- Persist query results across sessions using React Query + Vicinae Cache.
- Keep UX behavior consistent with repo standards for loading/empty/error states and action ordering.

**Non-Goals:**

- Deep content extraction/rendering of full Wowhead pages.
- Authentication, account features, or write operations.
- Classic variant switching in v1.

## Decisions

1. **Use expanded extension structure**
   - We split API, constants, query client/persistence, and UI concerns into separate modules.
   - This mirrors existing non-trivial extensions and keeps command code small.

2. **Retail-only URL strategy in v1**
   - All links target `https://www.wowhead.com`.
   - This avoids early complexity around flavor/subdomain mapping and preserves room for future expansion.

3. **React Query persistence with Cache-backed persister**
   - Query data is persisted via `PersistQueryClientProvider` and a custom `Persister` backed by `@vicinae/api` `Cache`.
   - `staleTime`, `gcTime`, and persistence `maxAge` are aligned to avoid early garbage collection and stale cache mismatch.

4. **Action behavior favors explicit open handler**
   - Browser opens use an explicit async handler that performs open + success toast + close window.
   - This enforces the extension rule that external URL opens provide user feedback and exit cleanly.

5. **Graceful degradation for fetch limitations**
   - Search parsing stays lightweight and defensive.
   - When network/parsing fails, users still get explicit error feedback and can run browser search directly.

## Risks / Trade-offs

- **[Risk] Wowhead response shape changes or anti-bot behavior increases** -> Mitigation: keep parser minimal, avoid hard dependency on brittle page internals, and preserve browser search fallback.
- **[Risk] HTML parsing can return fewer results than native site UX** -> Mitigation: communicate lightweight preview scope in README and keep open-in-browser as primary deep-navigation path.
- **[Risk] Persisted cache can mask fresh changes for short periods** -> Mitigation: keep TTL finite and expose Refresh action that invalidates queries.
