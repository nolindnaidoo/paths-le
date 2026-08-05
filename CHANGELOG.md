# Changelog

All notable changes to Paths-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-08-04

### Added

- Runtime strings are localized, and this time they render. All 11 of them —
  notifications, status bar, quick-picks and prompts — go through
  `vscode.l10n` and ship as twelve translated bundles in `l10n/`. The v1.x
  line carried manifest catalogues that worked and runtime catalogues that
  never reached the screen: `vscode-nls` was configured without
  `__filename`, so every runtime string fell back to English while the VSIX
  looked correct.
- An integration test covering both localization mechanisms — manifest
  substitution, key parity across all thirteen catalogues, and placeholder
  integrity in every translation. A translation that silently drops `{0}`
  now fails the build instead of shipping a message with the value missing.

- Dependency review on pull requests, failing on a high-severity addition
  before Dependabot's auto-merge can act.

### Fixed

- A clipboard that could not be written failed the whole extraction. The
  results are already in an editor by the time the copy runs, so an
  unavailable clipboard — a remote or headless session — surfaced as "Failed
  to extract paths" for work that had succeeded. It is now a warning, and the
  three copy sites share one guarded helper.
- Extract, dedupe and sort all reported success over documents they had not
  touched. `vscode.workspace.applyEdit` resolves `false` when an edit is
  rejected — a read-only document, or one that changed underneath the command
  — and all three discarded that value, then announced "Extracted 12 paths
  from document", "Removed 3 duplicate paths" or "Sorted 12 paths". The
  rejection is now reported as a failure and nothing is announced.
- `fullDocumentRange` is defined once, in `utils/document.ts`. It had three
  forms across three commands, one of them `Range(0, 0, lineCount, 0)` — which
  covers the whole document only because VS Code clamps the out-of-range
  position, and reads as though it might drop the final line. Behaviour is
  unchanged; verified against a real extension host before touching it.
- Symlink resolution branched on `ENOENT`/`EACCES`/`EPERM` and then returned
  the same value from both arms, so the condition — and the
  `as NodeJS.ErrnoException` cast it needed — did nothing at all. Falling back
  to the path as written is the right answer for every failure here, and the
  code now says so.
- The pseudo-scheme guard that keeps `javascript:`, `data:` and `vbscript:`
  values from being extracted as file paths existed as two identical copies,
  one in the HTML extractor and one in CSS, each commented as a copy of the
  other. It is now defined once, with tests covering the case-insensitivity
  and leading-whitespace cases the original CodeQL finding
  (`js/incomplete-url-scheme-check`) was actually about. Adding a scheme to
  one copy and not the other would have reintroduced the bug in one format
  only, and the extractors are tested separately, so nothing would have caught
  it.
- The status bar tooltip was never localized.

### Fixed

- The canonical-path security warning was never localized. It is the dialog
  that decides whether absolute filesystem paths end up in the extracted
  output, and it — along with its three buttons and the progress label — was
  English in all twelve locales. The button labels are now bound to constants
  and compared by reference: `showWarningMessage` returns the label that was
  clicked, so localizing them without binding would have made every answer
  read as "dismissed" in every non-English locale, silently skipping the
  extraction.

### Changed

- Test coverage raised from 74.04% to 83.87% of branches (82.20% to 90.72% of
  statements). Four files sat below one of the repo's own floors; none do now.
  `commands/extract.ts` was the least-covered file in the family at 40%
  statements — nearly all of it sits behind guards or behind the
  canonical-resolution dialog, so the default happy path exercised none of it.
  `utils/pathResolver.ts` had its workspace-relative resolution and its cache
  untested.


- CI gains fleet-wide checks that no single repo can perform: shared config is
  compared across all ten extensions, and every README link is verified —
  including Open VSX links, which are checked against the API because
  open-vsx.org answers HTTP 200 for extensions that do not exist.

## [2.0.1] - 2026-08-04

### Fixed

- `vbscript:` URLs are no longer reported as file paths, and pseudo-scheme
  matching is now case-insensitive and tolerates leading whitespace, so
  `JavaScript:` and ` vbscript:` are caught too. The CSS extractor shared
  the same gap, having only excluded `data:`. Found by CodeQL
  (`js/incomplete-url-scheme-check`).

### Changed

- Marketplace categories re-targeted for discovery. `Other` is dropped
  (65,992 extensions, no discovery value); each extension now sits in
  categories matching how it is actually used.
- Search keywords widened to 30, targeting the terms users actually type
  rather than internal vocabulary.
- Toolchain moved to current: TypeScript 7, vitest 4, Biome 2.5.7,
  @types/node 26. `@types/vscode` is now pinned exactly to the
  `engines.vscode` floor — the caret had let the type surface drift 15
  minors ahead of the version actually supported.
- Runtime dependencies updated across majors where present: csv-parse 7,
  ini 7, js-yaml 5. Extraction output is unchanged, verified against the
  characterization goldens.
- Packaging no longer walks the npm tree (`vsce package --no-dependencies`).
  The bundle is self-contained, so the walk served no purpose and failed
  after any dependency change. Scrape-LE keeps it, since it genuinely
  ships `playwright-core`.
- Documentation claims corrected against the code. Removed: Numbers-LE
  "with statistics", EnvSync-LE "visual diffs", Regex-LE "live feedback",
  String-LE "and validation" — none of those features exist.

### Added

- Rating links in the in-extension help output, for both the VS Code
  Marketplace and Open VSX. Acquisitions exceed listing page views, so most
  users never see the listing's rating control; help is the surface they do
  reach.
- README now carries measured Performance and Testing sections, both
  generated rather than written — from `scripts/benchmark.ts` and from the
  coverage summary. CI fails if the coverage numbers drift from a real run.
- Coverage thresholds enforced at 75 lines / 80 functions / 60 branches /
  75 statements.
- CodeQL scanning, Dependabot with grouped weekly updates, and auto-merge
  limited to patch and minor devDependency bumps that pass CI.

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
