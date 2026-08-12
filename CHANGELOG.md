# Changelog

All notable changes to Paths-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file covers the **VS Code extension**. The Rust CLI in `crate/` is a
separate product on its own cadence and keeps its own
[CHANGELOG](crate/CHANGELOG.md).

## [Unreleased]

### Added

- **A YAML extractor** (`yaml`), reading path-like scalar values and keys
  across every document in a file. Every CI config, Kubernetes manifest
  and compose file was previously a document this extension refused.

- **Every other language is now read too**, by a text scan:
  Python, Go, Markdown, XML, a Dockerfile, a Makefile. It makes the
  delimited tokens raw text does not have — a quoted run gets the whole
  path heuristic, and an undelimited run has to carry a path separator.
  That second rule is what keeps `os.path`, `np.array` and `logger.info`
  out of the results: an extension and an attribute are the same shape,
  and only the quoting tells them apart.

- **A markdown document in the shared corpus**
  (`crate/fixtures/documents/paths.md`). `markdown` is advertised in the
  `extract_paths` schema and nothing held the two servers to reading it
  the same way; now a case does. No behaviour changed — this pins what
  both already answer.

### Changed

- **The unsupported-format notice is gone.** `Path extraction is not
  supported for {languageId} files` was the honest answer while there was
  nothing to fall through to; the command now extracts from whatever
  document is open. The `format` error category went with it, having
  existed only for that message.

- **`extract_paths` no longer refuses a call with neither `format` nor
  `filename`.** It scans the content and answers `fileType: "unknown"`.
  `resolveFormat` returns that instead of `null`, and `SUPPORTED_FORMATS`
  gains `yaml` and `markdown`.

- The context menu entry is no longer gated on a list of language IDs,
  and `activationEvents` covers the languages the new formats bring.

### Added

- A **Rust CLI and MCP server**, in [`crate/`](crate/README.md), published
  to crates.io as [`paths-le`](https://crates.io/crates/paths-le). It runs
  the same extraction from a terminal and adds what an editor cannot do:
  resolving each path against the filesystem it is standing in, and
  reporting whether it still points at anything — missing, escaping the
  audited tree, non-canonical, or a symlink with its target named. Exit
  codes are the API, so `paths-le --strict .` is a CI step as it stands.

  The extension stays the reference implementation for extraction. The
  corpus both frontends build against lives in
  [`crate/fixtures/`](crate/fixtures/), `scripts/check-extraction-parity.ts`
  runs it against this extension, `cargo test` runs it against the crate,
  and `ci-crate.yml` watches `src/extraction/**` so neither side can drift
  green.

### Changed

- Documentation only for the extension itself — no behaviour change.

  The README, the npm server's README and the manifest now cross-reference
  the CLI, and the CLI references them back, so a reader arriving at any
  one of the five channels can find the other four.

- The npm server's README documented arguments and a response shape that
  were never this tool's — `format: "markdown"`, a `protocol` field, a URL
  in the example. They were carried over from a sibling package. The
  documented tool is now the tool that ships.

## [2.2.4] - 2026-08-07

### Changed

- Documentation only — no behaviour change.

  The cross-references now point at each tool's own page on letools.dev rather
  than its VS Code Marketplace listing. The Marketplace listing shows one of
  the four channels a tool ships through; the detail page shows all of them,
  which is what a reader following a link from another tool is looking for.
  Install instructions are untouched, and the rating links now lead with Open
  VSX — where the audience these READMEs reach actually installs from.

- `homepage` in the extension and MCP manifests, and `websiteUrl` in the
  registry entry, resolve to the same detail page.

## [2.2.3] - 2026-08-05

### Changed

- Documentation and packaging metadata only — no behaviour change.

  The MCP server's source now explains its decisions rather than restating its
  code: why MCP's stdio transport is line-delimited and what happens to a client
  if you copy LSP's framing, why a tool failure is a result carrying `isError`
  rather than a JSON-RPC error and what each does to a model's next move, why
  the result cap is measured in context windows rather than milliseconds, and
  why `truncated` matters more than the cap itself.

- The npm package declares `publishConfig.provenance`, so a release published
  from CI carries a Sigstore attestation binding the tarball to the commit and
  workflow that built it. A consumer can verify it with `npm audit signatures`.

- The registry entry names its registry (`registryBaseUrl`) and how to run the
  package (`runtimeHint`), rather than leaving a client to infer both.

- Package metadata points at the author's site, and the npm page links the rest
  of the family, the Rust tools and their crates.

## [2.2.2] - 2026-08-05

### Changed

- Documentation only — no behaviour change.

  The README described a keyboard shortcut and little else. 2.2.1 added an MCP
  server that VS Code registers with agent mode, published it to npm and to the
  official MCP registry, and submitted a Zed extension — and a reader could
  discover none of it from this page. There is now a section for calling the
  tool from an agent, including the JSON config for hosts that use one and a
  one-line check that the server answers before you wire it into anything.

  The privacy section previously spoke only for the extension. It covers the
  server too, which is the part an agent actually runs.

  The registry listing gains a display name, an icon and a link to letools.dev;
  the npm page gains the badges and links it was missing. Every surface now
  points at the others.

## [2.2.1] - 2026-08-05

### Changed

- **VS Code 1.101 is now the minimum.** `engines.vscode` moves from `^1.90.0`
  to `^1.101.0` and `@types/vscode` is pinned exactly to the new floor, per the
  rule that the declared floor and the type surface must match. 1.101 is the
  first stable release carrying `registerMcpServerDefinitionProvider`, which
  the MCP integration needs — declaring the contribution point against an older
  floor would be a claim the code could not honour. Cursor and VSCodium track
  well past this; Cursor 3.6.21 reports 1.105.1.

### Added

- An MCP server, shipped inside the VSIX as `dist/mcp-server.js`. It exposes
  `extract_paths` over stdio, so an agent can pull every path out of a document
  with its 1-based position.

  It imports the extraction engine and nothing from `vscode` —
  `check:mcp-bundle` fails the build if that stops being true, because the
  server has to run in Zed, in Claude Code, and from `npx`.

- The extension now offers that server to VS Code's agent mode, so installing
  it adds `extract_paths` to the agent's tools alongside the existing commands.
  Nothing is downloaded at runtime: the server is the copy inside the VSIX.
  The registration is skipped on editors that do not implement the API, which
  is not an error — an editor without agent mode is not a broken install.

- The server is on npm as [`paths-le-mcp`](https://www.npmjs.com/package/paths-le-mcp),
  so `npx paths-le-mcp` gives the same tool to Claude Code, Cursor, Windsurf or
  anything else that speaks MCP. It is the same build the VSIX carries, and its
  version is written from this manifest rather than maintained separately.

- A **Zed extension**, under `zed/`. Zed's extension API has no way to read the
  active buffer or register a command, so this extension could never be ported
  there in any language; a context server is the surface that fits. The crate
  is a launcher — it installs `paths-le-mcp` and starts it with Zed's Node — so
  there is no second implementation to keep in agreement with the goldens.

  Two things the boundary fixes rather than the engine, whose behaviour is
  pinned by goldens: the engine's severity scale has an `info` level against a
  diagnostic's two, and folding it into `error` would fail results that are
  completely fine, so it joins `warning`; and a dotfile like `.env` has no
  extension to split on, so the filename resolver matches the whole name before
  it tries an extension.

  Paths are reported exactly as written. Nothing is resolved against a
  workspace or touched on disk — `src/utils/pathResolver.ts` is deliberately
  outside this server, because canonical resolution is workspace-rooted and a
  server that reached the filesystem would add a path-traversal surface for no
  capability an agent does not already have.

### Fixed

- The coverage gate could pass against a stale summary. `coverage-readme.js`
  reads `coverage/coverage-summary.json` rather than running coverage, so when
  that file was older than the code both modes lied — the rewrite reproduced
  stale numbers and `--check` then compared the README against the same stale
  file and reported it current. Both modes now refuse a summary older than
  `src/`.

- The manifest placeholder gate only inspected `contributes.commands`, so a
  `%key%` on any other contribution point could ship as literal text. It now
  walks the whole `contributes` tree.

## [2.1.0] - 2026-08-05

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

- Every `else` block is gone (4 of them), replaced by guard clauses and early
  returns, per the code style in `AGENTS.md`.
- `commands/extract.ts` held orchestration, canonical path resolution, output
  routing and the success message in 398 lines. Routing moved to
  `commands/output.ts`, leaving 262 and 141.

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
