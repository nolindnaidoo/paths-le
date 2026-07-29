# AGENTS.md — Paths-LE

Technical source of truth for this repo. README.md is the user-facing doc; this file is for anyone (human or agent) changing the code.

## What this is

A VS Code extension that extracts file paths from the active document (JS/TS, JSON/JSONC, HTML, CSS/SCSS/LESS, TOML, CSV, dotenv) into a results editor, with dedupe/sort post-processing. No network access, no filesystem writes outside optional opt-in canonical path resolution (reads only).

## Architecture

```
extension.ts            activate(): createServices() -> registerCommands()
services/serviceFactory createServices(context) -> { telemetry, notifier, statusBar }
commands/               one file per command; deps injected as a frozen bag
extraction/extract.ts   dispatcher: languageId -> FileType -> extractor
extraction/heuristics.ts  THE single isPathLike + classifyPathType
extraction/position.ts    offset -> {line, column} via newline index (1-based)
extraction/formats/*.ts   one extractor per format, whole-content matching
ui/                     notifier (window messages, gated by notificationsLevel:
                        all -> everything, important -> warn+error, silent -> error only),
                        statusBar, help webView
utils/                  errors (sanitizeErrorMessage), safety (size guards),
                        pathResolver (normalize + opt-in canonical resolution)
config/config.ts        getConfiguration() snapshot; CONFIG_DEFAULTS table
types.ts                shared types only — no logic
```

Conventions: factory functions + `Object.freeze` (no classes), early returns, dependency bags typed inline at the consumer. Runtime strings are plain English; the 13 `package.nls*.json` catalogues localize **manifest** strings only (VS Code `%key%` substitution — do not add a runtime i18n layer without wiring real bundles).

## Invariants (things that were once broken — keep them true)

- **The bundle must be self-contained.** The VSIX ships `dist/extension.js` only; `scripts/check-bundle.js` (run in `vscode:prepublish` and CI) does a static require scan AND loads the bundle with `vscode` stubbed. esbuild uses `--main-fields=module,main` because jsonc-parser's UMD build smuggles `require` through a factory parameter.
- **`CONFIG_DEFAULTS` must equal package.json defaults.** `config.test.ts` asserts parity over every declared setting; add new settings to both plus the KEY_MAP in the test.
- **Every declared setting must have a consumer.** v1 shipped 19 no-op settings; don't add a setting without wiring it.
- **Extractor behavior is pinned by golden snapshots** (`extraction/characterization.test.ts` + `__fixtures__/`). Any output change must update goldens in the same commit and be listed in the CHANGELOG.
- **Extension-internal flags go in `context.globalState`,** never in undeclared `paths-le.*` config keys (VS Code rejects writes to unregistered keys).
- **nls catalogues stay in key-parity:** all 12 locale files carry exactly the keys of `package.nls.json`.
- **Heuristics live in one place** (`extraction/heuristics.ts`). Never re-implement `isPathLike`/`classifyPathType` inside a format extractor.

## Toolchain

- **Build:** esbuild bundle (`bun run build`, `build:prod` minified). `tsc` is typecheck-only (`noEmit`) and covers test files.
- **Unit tests:** vitest; `vscode` aliased to `src/__mocks__/vscode.ts` (stateful mock with `_reset/_set` helpers). Coverage thresholds enforced: 80 lines / 80 funcs / 75 branches / 80 stmts.
- **Integration tests:** `bun run test:integration` — `@vscode/test-cli` launches a real VS Code (config in `.vscode-test.mjs`, tests compiled via `tsconfig.it.json` to `out-test/`).
- **Lint/format:** Biome (tabs, single quotes). `__fixtures__`/`__snapshots__` are exempt — formatting fixtures would corrupt goldens.
- **Packaging:** `bun run package` → `release/*.vsix`. `.vscodeignore` is an allow-list; the VSIX is ~21 files.

## Release

1. Bump `version` in package.json, add a CHANGELOG entry.
2. CI green on all 3 OSes (includes packaging + integration tests).
3. `Release` workflow (manual dispatch) publishes to the VS Code Marketplace (`VSCE_PAT`) and Open VSX (`OVSX_PAT`) — Open VSX is what Cursor/VSCodium users install from. Locally: `bun run package` then `vsce publish` / `ovsx publish`.

## Known limitations (documented, not bugs)

- Bare domains (`example.com`) match the `name.ext` heuristic.
- TOML positions come from forward-locate over the source (no offsets from @iarna/toml); repeated identical values resolve to successive occurrences.
- CSV positions are row/cell coordinates, not character offsets.
- JS/TS extraction is regex-based: `from '…'` inside a string literal or comment can false-positive; only module-specifier contexts are targeted, not arbitrary string paths.
