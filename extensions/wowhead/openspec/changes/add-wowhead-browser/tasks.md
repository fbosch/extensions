## 1. OpenSpec Artifacts

- [x] 1.1 Finalize `proposal.md` with capability mapping for `wowhead-browser`
- [x] 1.2 Finalize `design.md` with architecture, risks, and trade-offs
- [x] 1.3 Finalize `specs/wowhead-browser/spec.md` with normative requirements and scenarios

## 2. Extension Scaffold

- [x] 2.1 Create `extensions/wowhead` directory with manifest, tsconfig, README, and icon asset
- [x] 2.2 Add a `mode: "view"` command in `package.json` and include required dependencies

## 3. Data + Cache

- [x] 3.1 Implement Wowhead search fetch/parsing module with typed result normalization
- [x] 3.2 Implement QueryClient defaults and Cache-backed React Query persister with aligned TTLs
- [x] 3.3 Wire persistence through `PersistQueryClientProvider` with `maxAge`

## 4. Command UX

- [x] 4.1 Build list UI with search input, type filter, and detail pane
- [x] 4.2 Add action panel ordering and shortcuts aligned with extension standards
- [x] 4.3 Add loading, empty, and error states with toasts from async handlers/callbacks only

## 5. Validation

- [x] 5.1 Run `openspec validate add-wowhead-browser`
- [x] 5.2 Run `pnpm -C extensions/wowhead lint`
- [x] 5.3 Run `pnpm -C extensions/wowhead build`
