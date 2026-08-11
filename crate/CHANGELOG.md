# Changelog

The Rust CLI and MCP server. The VS Code extension has its own
[CHANGELOG](../CHANGELOG.md) and its own version — the two products in
this repository release on their own cadence.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Every absolute path was `non-canonical` on Windows.** The
  separator rule fired on any backslash rather than on a genuine mix of
  both, and `std::fs::canonicalize` there returns a verbatim
  `\\?\C:\...` prefix — so the platform's own canonical form was
  reported as deviating from canonical form. An ordinary Windows
  relative path, `src\lib\a.ts`, was called non-canonical for the same
  reason. Found by a Windows CI job; it cannot reproduce on macOS or
  Linux.

### Fixed

- **A leading byte-order mark is no longer part of the document.** Three
  invisible bytes, added by Notepad, Excel and a PowerShell redirect, and
  stripped by VS Code before the extension ever sees a file — so the two
  frontends read the same file differently. It shifted every column on
  line one, and before a `{` it made a structured parser reject the whole
  document, which is indistinguishable from a file with no paths in it.

- **A file that cannot be read no longer fails the run.** Every
  repository has a PNG, a zip and something the runner lacks permission
  for. Exiting 2 on those made the tool unusable in CI, which is the one
  place it is most worth running. Such a file is now named on stderr and
  carried in the report with a `skipped` diagnostic, and the exit code
  reflects what was found. `--strict` restores the old behaviour for a
  pipeline that wants zero tolerance.

  An audit that gives up part way through a file still fails without
  asking.

- **A file that is not text is named rather than dropped.** It used to
  vanish from the report entirely, which reads to whoever ran it as
  "that file was clean".

## [0.1.0] - 2026-08-08

First release. The extension's extraction engine, ported and pinned
against a shared corpus, plus the half an editor cannot do.

### Added

- **Extraction for all eight formats** the extension supports — JSON and
  JSONC, TOML, CSV, dotenv, JavaScript, TypeScript, HTML and
  CSS/SCSS/LESS — reproducing the extension's output for every case in
  `fixtures/`. Positions are 1-based, and columns count UTF-16 code
  units so they match what an editor reports.
- **Resolution**, which has no extension equivalent: each path is
  checked against the filesystem and gets one verdict — `ok`,
  `symlinked`, `non-canonical`, `missing`, `escapes-root` or
  `unresolved`. A relative path resolves against the directory of the
  file it was found in. An import written without an extension is probed
  against a fixed list (`.ts .tsx .js .jsx .mjs .cjs .json`) and the
  substitution is reported. A `missing` verdict requires the value to
  commit to being a path — explicit `./` syntax, or a file extension
  after a separator — so a MIME type, a package specifier or a version
  range comes back `unresolved` instead. Absence is only reported where
  absence is evidence.
- **A tree walker** using ripgrep's `ignore`, so a directory is walked
  the way `rg` walks one. A file named explicitly is read whatever the
  ignore rules say.
- **The CLI**: JSON reports on stdout one per line, a human summary on
  stderr, and exit codes as the API — 0 clear, 1 findings, 2 the
  question was malformed. `--strict`, `--no-resolve`, `--root`,
  `--format`, `--stdin`, `--follow-symlinks`, `--hidden`, `--no-ignore`.
- **The MCP server** (`paths-le mcp`) with two tools: `extract_paths`,
  shared byte-for-byte with the npm server and pinned by
  `fixtures/mcp-extract-paths.json`, and `paths_le_audit`, which returns
  the same reports the CLI writes.
- **The shared corpus** at `fixtures/`, read by both frontends.
  `../scripts/check-extraction-parity.ts` runs it against the extension;
  `src/extract/corpus.rs` runs it against this crate.

### Notes on parity

The extension is the reference implementation for extraction, and
several of its behaviours are ported as they stand rather than fixed —
the double-emission of a path-like dotenv key, TOML positions from a
text search, a bare domain classified as a file, and a `data:` URI
inside `srcset` splitting on its own base64 commas. Each is listed in
[SPEC.md](SPEC.md) and pinned in `fixtures/` on both sides, because
fixing one on one side only is how two frontends stop agreeing.

[0.1.0]: https://github.com/nolindnaidoo/paths-le/releases/tag/crate-v0.1.0
