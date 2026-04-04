## Why

Vicinae currently has no dedicated way to browse Wowhead content without manually switching to a browser and rebuilding the same search repeatedly. Adding a focused Wowhead extension improves lookup speed for WoW players and keeps common discovery workflows in one place.

## What Changes

- Add a new `extensions/wowhead` Vicinae extension with a view command for retail Wowhead browsing.
- Implement universal Wowhead search with entity-type filtering (items, NPCs, quests, spells, achievements, objects, zones, factions, currencies, recipes, and guides).
- Add lightweight in-app preview metadata and browser handoff for full content.
- Add React Query persistence backed by Vicinae Cache so prior results are restored across sessions.
- Add loading, empty, and error states plus action ordering/shortcut behavior aligned with existing extension standards.

## Capabilities

### New Capabilities

- `wowhead-browser`: Browse retail Wowhead entities from Vicinae with search, filtering, preview metadata, cache-backed persistence, and browser handoff.

### Modified Capabilities

- None.

## Impact

- Adds a new extension directory: `extensions/wowhead`.
- Adds new dependency usage in the extension: `@tanstack/react-query` and `@tanstack/react-query-persist-client` with `@vicinae/api` Cache as persistence storage.
- Adds OpenSpec artifacts for proposal/design/spec/tasks under `openspec/changes/add-wowhead-browser`.
