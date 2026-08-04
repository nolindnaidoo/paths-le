# Changelog

All notable changes to Paths-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-08-03

### Changed

- Marketplace categories re-targeted for discovery. `Other` is dropped
  (65,992 extensions, no discovery value); each extension now sits in
  categories matching how it is actually used.

### Added

- Rating links in the in-extension help output, for both the VS Code
  Marketplace and Open VSX. Acquisitions exceed listing page views, so most
  users never see the listing's rating control; help is the surface they do
  reach.

## [2.0.0] - 2026-07-29

Full rehabilitation release. The headline: **v1.x VSIXes built from this
repo could not activate** — the build had no bundler while the package
excluded `node_modules`, so the extension crashed on load with
`Cannot find module 'vscode-nls'`. 2.0.0 ships a self-contained esbuild
bundle, verified by a packaging gate and a real extension-host
integration suite on every CI run.

### Fixed

- **Packaging**: `dist/extension.js` is now a single self-contained
  bundle (VSIX: 130 files → 21). A bundle gate (static require scan +
  loading the bundle with `vscode` stubbed) blocks any regression.
- **Canonical-resolution warning**: accepting the security warning wrote
  to an undeclared config key, which VS Code rejects — the extraction
  flow died every time. The flag now lives in `globalState`.
- **Dedupe/Sort**: whole-document replacement overshot the last line;
  dedupe counted removed blank lines as "duplicates".
- **dotenv**: quoted-key lines no longer emit each path twice.
- **JSONC**: files with comments/trailing commas now extract (previously
  returned nothing, silently).
- **Config**: non-numeric setting overrides no longer produce `NaN`
  thresholds; the string `"false"` no longer reads as `true`; code
  fallbacks now provably match manifest defaults (asserted by a test).
- **Status bar**: reacts to `statusBar.enabled` changes without reload.
- **Context menu**: the `resourceExtname in …` when-clause never
  matched; replaced with an `editorLangId` regex.

### Changed — extraction output

- **Multi-line JS/TS imports are now extracted** (previously missed
  entirely).
- **Real line/column positions everywhere**: JSON via jsonc-parser node
  offsets, TOML via forward-locate, columns point at the path itself
  (previously JSON/TOML always reported 1:1).
- **Unified path heuristics** across all formats (was 4 divergent
  `isPathLike` + 6 `classifyPathType` copies): version strings
  (`1.8.1`) and IPs are no longer extracted; well-formed paths with
  spaces now are. Each `srcset` entry gets its own position.
- Known limitation (documented): bare domains like `example.com` still
  match the `name.ext` heuristic.

### Removed

- 19 settings that were never read by any code path (`analysis.*`,
  `validation.*`, `performance.*`, `keyboard.*`, `presets.*`,
  `dedupeEnabled`, `safety.manyDocumentsThreshold`, `showParseErrors`).
  11 real settings remain, and `notificationsLevel` is now actually
  wired: `all` shows everything, `important` shows warnings and errors,
  `silent` (the default) shows errors only.
- Three hidden, broken settings commands (export/import/reset) and the
  `createTestFixture` dev command (it wrote shell scripts to disk).
- The runtime "localization" layer: it never loaded a single
  translation (broken `vscode-nls` wiring, and the bundles it needed
  were never generated) — users always saw English. Manifest/settings
  translations in 13 languages remain and now have full key parity.
- Unused dependencies (`vscode-nls`, `js-yaml`, `ini`) and roughly
  4,000 lines of dead modules; stale docs (`ENTERPRISE_QUALITY.md`,
  `docs/`) replaced by an accurate README + AGENTS.md.

### Infrastructure

- `engines.vscode ^1.90.0` — current VS Code and Cursor 2.x supported.
- Real quality gates: typecheck now covers tests, coverage thresholds
  actually enforce (the old config used an inert key — real coverage
  was 30%; now 84% and enforced at 80), integration tests run in a
  downloaded VS Code on all 3 OSes, CI packages the VSIX and uploads it.
- Release workflow publishes to both the VS Code Marketplace and Open
  VSX (Cursor's marketplace source).

> Entries below this line predate 2.0.0 and have been condensed: the
> original release notes contained coverage, security, and feature
> claims that did not hold up against the code (see 2.0.0 above for the
> corrected record).

## [1.8.1] - 2025-11-02

### Documentation

- Added Regex-LE and Secrets-LE to the "More from the LE Family" section in README

## [1.8.0] - 2025-10-26

- Added unit tests around path validation and error handling; added
  credential/home-directory redaction for error messages. (Condensed —
  much of the tested code was not reachable from the shipped extension.)

## [1.7.0] - 2025-01-27

- Initial public release: path extraction for JS/TS, JSON, HTML, CSS,
  TOML, CSV, and .env files; dedupe and sort post-processing;
  `Ctrl+Alt+P` / `Cmd+Alt+P`; opt-in canonical path resolution;
  manifest/settings translations. (Condensed.)
