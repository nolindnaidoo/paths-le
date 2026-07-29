# Changelog

All notable changes to Paths-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- 18 settings that were never read by any code path (`analysis.*`,
  `validation.*`, `performance.*`, `keyboard.*`, `presets.*`,
  `dedupeEnabled`, `safety.manyDocumentsThreshold`). 12 real settings
  remain.
- Three hidden, broken settings commands (export/import/reset) and the
  `createTestFixture` dev command (it wrote shell scripts to disk).
- The runtime "localization" layer: it never loaded a single
  translation (broken `vscode-nls` wiring, and the bundles it needed
  were never generated) — users always saw English. Manifest/settings
  translations in 13 languages remain and now have full key parity.
- Unused dependencies (`vscode-nls`, `js-yaml`, `ini`) and ~2,500 lines
  of dead modules; stale docs (`ENTERPRISE_QUALITY.md`, `docs/`)
  replaced by an accurate README + AGENTS.md.

### Infrastructure

- `engines.vscode ^1.90.0` — current VS Code and Cursor 2.x supported.
- Real quality gates: typecheck now covers tests, coverage thresholds
  actually enforce (the old config used an inert key — real coverage
  was 30%; now 84% and enforced at 80), integration tests run in a
  downloaded VS Code on all 3 OSes, CI packages the VSIX and uploads it.
- Release workflow publishes to both the VS Code Marketplace and Open
  VSX (Cursor's marketplace source).

## [1.8.1] - 2025-11-02

### Documentation

- **LE Family Updates** - Added Regex-LE and Secrets-LE to the "More from the LE Family" section in README

## [1.8.0] - 2025-10-26

### Security & Enterprise Readiness

- **Path Traversal Prevention** - Added 64 comprehensive security tests covering:
  - `../` and `../../` attack vectors
  - Symlink exploitation prevention
  - Null byte injection protection
  - Windows reserved names (CON, PRN, AUX, NUL)
  - Cross-platform path validation
- **Error Handling Hardening** - Expanded from 33% to 94% coverage with 62 new tests:
  - Credential sanitization in error messages
  - Path sanitization for sensitive directories
  - Comprehensive error categorization and recovery
  - Safe error reporting without information leakage
- **Test Suite Expansion** - Increased from 152 to 289 unit tests (+90%)
  - 93.55% function coverage, 84.32% line coverage
  - Zero critical vulnerabilities
  - Enterprise-grade reliability

### Quality Improvements

- **Type Safety** - 100% TypeScript strict mode compliance
- **Immutability** - All exports frozen with `Object.freeze()`
- **Dependency Security** - Zero vulnerabilities in dependency chain

## [1.7.0] - 2025-01-27

### Initial Public Release

Paths-LE brings zero-hassle path extraction to VS Code. Simple, reliable, focused.

#### Supported File Types

- **JavaScript** - JS files with imports and requires
- **TypeScript** - TS files with imports and requires
- **JSON** - Configuration files and package.json
- **HTML** - HTML files with asset references
- **CSS** - Stylesheets with asset imports
- **TOML** - Configuration files
- **CSV** - Data files with path references
- **Environment files** - .env files with path variables

#### Features

- **Multi-language support** - Comprehensive localization for 13+ languages
- **Complete path detection** - Automatically finds file paths in multiple formats:
  - Absolute paths
  - Relative paths
  - Windows paths
  - Unix paths
- **Powerful post-processing**:
  - **Deduplicate paths** for cleaner analysis
  - **Sort** with multiple modes (alphabetically or by length)
- **Interactive sorting options**:
  - Sort alphabetically (A→Z/Z→A)
  - Sort by length (short→long/long→short)
- **Smart path detection** - Intelligently filters package imports (like 'react' or 'lodash') from actual file paths
- **Cross-platform compatibility** - Handles both Windows and Unix path formats with intelligent normalization
- **Canonical path resolution** - Full monorepo and symlink support for enterprise development workflows
- **Dependency analysis support** - Perfect for analyzing imports, exports, and file references
- **One-command extraction** - `Ctrl+Alt+P` (`Cmd+Alt+P` on macOS)
- **Developer-friendly** - 152 passing tests (93.33% function coverage, 84.32% line coverage), TypeScript strict mode, functional programming, MIT licensed

#### Use Cases

- **Dependency Analysis** - Analyze imports, exports, and file references to identify missing files and circular dependencies
- **Configuration Management** - Extract and validate file paths from configuration files
- **Path Validation** - Verify that all referenced files exist and are accessible
- **Monorepo Management** - Handle complex monorepo structures with cross-package references
