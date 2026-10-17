# Changelog

All notable changes to Paths-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file covers the **VS Code extension**, the npm MCP server and the
npm command line. The Rust CLI in `crate/` keeps its own
[CHANGELOG](crate/CHANGELOG.md). From 2.5.0 every surface carries one
version and releases from one tag.

## [2.6.0] - 2026-10-17

### Fixed

- **`mcp` no longer ends the session on a frame that is not UTF-8**, in
  the crate or the npm package. Such a frame is dropped like one that is not
  JSON, and the requests after it are served. The npm server reads frames
  with `src/cli/frames.ts`, the crate server's framing in one file shared
  across the family, and `check:cli-pipes` now feeds both servers eighteen
  malformed frames and requests and compares the answers.
- **The npm `mcp` server answers every request as the crate does.** It ran
  on the extension's MCP transport, which differs from the crate on
  requests a client should not send: it refused a frame with no `jsonrpc`,
  ignored a null id, answered a malformed frame with a parse error, echoed
  the client's protocol version, worded an unknown method or tool
  differently, and dropped a last line with no newline. It now runs the
  crate's protocol, in `src/cli/mcp.ts`, over the extension's tools.
- **JSON, YAML and TOML now parse exactly as the Rust crate does.** The
  extension, the npm MCP server and the npm command line read them with
  npm's `jsonc-parser`, js-yaml and `@iarna/toml`, which refuse documents
  the crate reads. They now read with transcriptions of the crate's own
  parsers in `src/parsers/`, shared with units-le. Documents that used to
  be refused and now yield their paths, as the crate's always did:
  - a YAML file indented with a tab before a sequence entry,
  - a YAML mapping with a repeated or a complex key, or an invalid
    `!!binary` payload,
  - a TOML array that mixes types.
- The CLI parity tree holds each of those shapes, so the two parsers are
  compared on them from now on.

## [2.5.4] - 2026-10-17

### Fixed

- **The npm command line no longer crashes when its reader goes away.**
  A reader that closed stdout early, as `| head` does, got a Node stack
  trace and an exit code of 1, or 0 in some tools. It now gets what the
  Rust CLI prints, `paths-le: could not write the report: Broken pipe (os error 32)`, and exit 2.
  A reader that closes stderr early no longer stops the run, and stdout
  is written in full. `paths-le mcp` exits 2 without a word when it cannot
  write a reply, as the crate's server does.
- The listing on stderr now follows the reports written to stdout before
  it, as the crate's does. `scripts/check-cli-pipes.ts` closes each pipe
  under both binaries on macOS, Windows and Linux and fails on any
  difference.

## [2.5.3] - 2026-10-17

### Fixed

- **The npm command line no longer cuts off the end of stderr.** It exited
  once stdout had drained, while stderr could still hold the end of the
  listing and its summary line. On macOS and Windows a pipe writes
  asynchronously, so a reader slower than the writer lost them. It now
  exits once both streams have drained.

## [2.5.2] - 2026-10-16

### Fixed

- **The npm command line words an OS error as the Rust one does on
  Windows.** It said `No such file or directory (os error 4058)` where the
  crate said `The system cannot find the file specified. (os error 2)`,
  because Node hands over libuv's POSIX name for a Windows error. It now
  recovers Windows' code and sentence from that name. On Linux it words
  `EBUSY` as glibc does.
- **The npm command line resolves a rooted path as Rust does on Windows.**
  `/etc/hosts` has a root but no drive there, so Rust lands it at the
  drive's root and reports it as escaping the root. The npm CLI joined it
  under the referring file's directory and reported it missing.
- **The npm command line finds a symlink loop at the same depth on
  Windows.** A directory reached directly and through a link reported
  different file numbers, so the loop went unseen for a level and the
  error named a deeper path than the crate's.
- The command-line parity check ran the npm package under Bun rather than
  Node, and only on Linux. It runs Node, as `npx` does, on macOS, Windows
  and Linux.

## [2.5.1] - 2026-10-15

### Fixed

- **`.env.local`, `.env.production` and every other `.env.*` file read as
  dotenv**, as the crate has read them since 0.3.1. The npm MCP server's
  `extract_paths`, `paths-le mcp` and Extract Workspace split the name on
  the last dot, asked `local` for a format and fell to the generic scan,
  which breaks a value at whitespace: `LOG_DIR=./my logs/app.log` came back
  as `./my` and `logs/app.log`. Extract Workspace also resolved the format
  from the file's relative path rather than its name, so a dotenv file in a
  subfolder missed the rule. The CLI parity check now sends `extract_paths`
  a `.env.local`.

## [2.5.0] - 2026-10-15

### Changed

- **One version for every surface.** The extension, the MCP server on
  npm, the new npm command line and the Rust crate all release as 2.5.0
  from the tag `v2.5.0`. The crate jumps from 0.4.0 to join them, and CI
  now fails a commit where any of them disagree.

### Added

- An npm command line, `paths-le`, built in `cli/` from `src/cli/`. It is
  the Rust CLI's surface over this extension's extraction engine: the same
  flags, walk, root, verdicts, exit codes, JSON Lines and stderr summary,
  and `paths-le mcp` serves the same two tools. `scripts/check-cli-parity.ts`
  runs both binaries over one tree and fails on any byte of difference.
  It is published as `paths-le` on npm, beside `paths-le-mcp`.

### Fixed

- The rating prompt's Rate button opened the Marketplace review page for
  every install, including one from Open VSX in VSCodium, Cursor or
  Windsurf, because it told the registries apart by a publisher name the
  Open VSX listing does not carry. It reads the editor's name instead, and
  an Open VSX install rates on Open VSX.

## [2.4.1] - 2026-10-11

A bug fix and hardening pass over the extension, the bundled MCP server and
the shared extraction engine, made by driving every feature, every failure
path and every locale rather than by reading. One release carries all of it;
nothing here adds a feature.

### Fixed

- A JSON, TOML or YAML document that does not parse was read as empty, the
  answer a clean file gives, so a file holding `/etc/passwd` behind a syntax
  error read as clean, and on a JSON document cut off mid-value the bundled
  server and the Rust CLI disagreed. All three readers refuse with a named
  reason now, as CSV always has, in the same words on both.
- A document nested deeper than its parser can follow ended the extension
  with "Maximum call stack size exceeded" and the CLI with an empty answer.
  Both refuse before parsing, at the depth the weakest parser behind each
  format can follow: 512 levels for JSON, 80 for TOML, 96 for YAML.
- The MCP server answered a `filename` or `format` that is an
  `Object.prototype` name, such as `constructor` or `__proto__`, with a
  function or an object for its file type, or dropped the field. It answers
  `unknown`, as the crate's server always did.
- A number setting cleared to an empty string or null read as 0 and was
  clamped to its floor, so the size guard became 1,000 bytes. It falls back
  to the default.
- `Sort Paths` ordered by the machine's locale, so one list sorted two ways
  on two machines. It orders by code unit, as the workspace report does;
  uppercase sorts before lowercase.
- With `resolution.resolveWorkspaceRelative` on, a URL was rewritten under
  the workspace folder, `https://example.com/a` becoming
  `/workspace/https:/example.com/a`, and so was a drive-letter path on macOS
  and Linux. Both are left as written.
- Workspace-relative resolution looked the folder up from the extension
  host's working directory, so in a multi-root workspace it silently did
  nothing. It resolves against the folder the document is in.
- The status bar spinner stayed up after the security dialog was dismissed
  or declined, and after any failure in the output step.
- "Canonical resolution failed, using original paths" was shown whenever no
  path changed, which is also what happens when every path was already
  canonical. Nothing had failed, and the message is gone.
- A folder or workspace scan counted a file deleted or made unreadable after
  it was listed as "not UTF-8 text". It has its own line in the report:
  "N file(s) could not be read."
- `paths-le.safety.largeOutputLinesThreshold` changed nothing a user could
  see: the warning it governs was computed and never shown. It is shown,
  with the path-density warning, before the extraction proceeds.
- `paths-le.telemetryEnabled` was read once at activation, so changing it
  took effect only after a reload. It is read per event.
- The help page listed seven file types and told a user with no results to
  check whether the file type was supported. It names every format,
  including YAML and TSV, and the text scan over everything else.
- Four runtime strings were missing from every locale and showed in
  English: the three "the edit was rejected" errors and the clipboard
  warning. Eight more never went through the localization layer: the
  dedupe toast, the two status bar messages, the three safety messages and
  the help panel's title. All twelve are translated into all twelve locales,
  and a unit test now holds the bundle and the source equal.
- A failure inside a command, such as the editor refusing to open a document
  or an edit throwing, escaped as an unhandled rejection the editor reported
  in its own words. Every command reports it as one redacted, localized
  error notification.
- The MCP server's stdio buffer had no ceiling: input with no newline grew
  the process without bound, and 64 MiB of it held the server at 737 MB. A
  frame over 16 MiB is refused with a JSON-RPC parse error and the server
  keeps serving.
- In replace mode, the paths computed from the text read at the start of the
  command were written over the whole document after the security dialog
  closed, so anything typed while the dialog was up was lost. The replace
  route now refuses, with an error, when the document changed in between.
- Eleven locales rendered the count in "Extracted {0} paths from document" as
  a name ("{0}-Pfade", "las rutas de «{0}»"); Japanese, Korean and Chinese
  rendered the sort order in "Sorted {0} paths ({1})" as a second count; the
  Japanese Continue button read as "read more". Each value is corrected.

## [2.4.0] - 2026-10-07

### Added

- A rating prompt. On the 3rd successful use, one notification asks whether
  you would rate the extension, with *Rate*, *Later* and *Don't Ask Again*.
  *Rate* opens the registry your copy was installed from: the VS Code
  Marketplace or Open VSX. *Later*, or dismissing it, asks once more on the
  20th use; that second ask is the last. It never appears on activation or
  after a failed run, and it is never shown if you have set
  `notificationsLevel` to `important` or `silent` yourself. The answer
  follows you through Settings Sync. Translated into all 12 locales.
- Extract across a folder or the whole workspace.
  `Paths-LE: Extract Paths from Workspace` reads every file in the workspace
  from disk, and `Paths-LE: Extract Paths from Folder` does the same for one
  folder, from the command palette or from a folder in the Explorer. The
  report lists each distinct path once, the most widely used first, with how
  often it is written, in how many files, and where. It ends with a line for
  each thing the scan left unread.
- A scan skips three things by default, each with its own switch:
  dependency folders, build output, caches and lockfiles
  (`paths-le.workspace.scanUseDefaultExcludes`), whatever the project's
  `.gitignore` files skip (`paths-le.workspace.scanRespectGitignore`), and
  images, fonts, archives and other files that are not text
  (`paths-le.workspace.scanSkipBinaryFiles`). `paths-le.workspace.scanExcludes`
  skips more, and `paths-le.workspace.scanAlwaysInclude` reads a path whatever
  the switches say. `paths-le.workspace.scanPatterns` chooses the files to
  read in the first place.
- `paths-le.workspace.scanMaxFiles` caps how many files are read and
  `paths-le.workspace.scanMaxResults` caps how many occurrences are listed.
- A file its format reader refused is listed in the report with the reason.
- The positions settings apply to a scan as they do to Extract: off by
  default, and then each line is a file and how many times the path is in it.
- Positions are now a setting. `paths-le.showPositions` decides whether the
  output gives the line and column of each path, and
  `paths-le.clipboardIncludesPositions` decides the same for the copy on the
  clipboard. Both are off by default, so the output is what it was. With
  positions shown, Sort still orders by the path and keeps each position with
  it, and Dedupe keeps the first occurrence of a path, with that occurrence's
  position.

### Changed

- No command is bound to a key by default any more. The one default this
  extension shipped sat on a key the editor, the system or another LE
  extension already used. Every command can still be given a key under
  Keyboard Shortcuts.

## [2.3.5] - 2026-10-04

### Added

- `scripts/check-mcp-definition.ts`, run in CI after the differential: it fails
  when the two servers define the shared MCP tool differently — its
  description or any part of its schema. Six of the ten had drifted.
- The npm README test also checks that every value an argument offers is
  named in that argument's row.

### Fixed

- The Open VSX links and the Open VSX downloads badge in the README and the
  npm README pointed at a namespace the listing has left, so they led nowhere.
  The listing is under `nolindnaidoo` now, and so are they.

### Removed

- The Zed extension in `zed/`, with the CI job that built it and the workflow
  that synced it. It was never listed in Zed's registry.

## [2.3.4] - 2026-10-03

### Fixed

- The npm README's opening line still said the server extracts URLs.
- The npm README's list of the family's Rust tools left out `dates-le`.

### Added

- `src/mcp/readme.test.ts` holds the npm README to the tool it documents: the
  heading names the tool, the argument table lists exactly the schema's
  arguments, the required ones are marked, the example is this tool's answer,
  and the opening sentence names what the tool works on.

## [2.3.3] - 2026-09-30

### Fixed

- **A bare domain is no longer reported as a path.** `example.com`,
  `api.github.com` and `www.example.org` matched the `name.ext` rule and
  came back as files. A slash-free name ending in `com`, `net`, `edu`,
  `gov`, `mil` or `int`, or starting with `www.`, is now left out. A
  general TLD list was not an option, because `.py`, `.md`, `.sh` and
  `.rs` are country codes: `docs.rs` and `notes.org` are still paths.

## [2.3.2] - 2026-09-29

### Fixed

- **A CSV this extension cannot read now says so instead of reporting a
  clean file.** Every malformed-quote refusal came back as no paths and
  an empty `diagnostics` — the reader threw and a `catch` returned `[]`
  — so a spreadsheet holding `/etc/passwd` and `/var/log/app.log` read
  to an agent exactly like a file with no paths in it. That silent miss
  is the failure this tool exists to prevent. A refused document now
  carries one diagnostic, severity `error` and code `parsing`, naming
  which malformation happened and where:

  ```
  Invalid CSV: quoted field is never closed (row 1, cell 1)
  Invalid CSV: a closing quote is followed by more than whitespace (row 3, cell 2)
  ```

  `TSV` replaces `CSV` for a tab-separated document, and the coordinates
  are the cell coordinates a reported path already carries. The
  `extract_paths` MCP tool answers `ok: false` for such a document; the
  Rust CLI exits 2 rather than 0. Both frontends changed together.

- **A no-break space after a closing quote no longer loses the whole
  document.** `csv-parse` walks the whitespace run after a closing quote
  one *byte* at a time, so `"name" ,size` was read and
  `"name"<U+00A0>,size` was refused — as were U+FEFF, U+2028 and every
  other multi-byte space, all of them ordinary in a spreadsheet export.
  Whitespace is whitespace whatever its encoded length, and both
  frontends now step the whole character.

### Changed

- **CSV is read by a reader in this repository rather than by
  `csv-parse`.** The library throws on a malformed quote, which leaves
  nothing to report about *which* malformation it was, and its
  byte-at-a-time whitespace walk is the bug above. `csv-parse` is gone
  from the dependencies; `src/extraction/formats/csv.ts` is now the same
  reader as the crate's `extract/csv.rs`, rule for rule, held equal by
  `crate/fixtures/`. Every other rule is unchanged: a quote opens a cell
  only where nothing precedes it, `""` is one literal quote, ragged rows
  are data, a byte-order mark is stripped, cells are trimmed, and the row
  separator is fixed by the first one outside a quoted cell.

  It costs throughput: the benchmark's 2.09 MB CSV went from 57 ms to
  67 ms, and the README's generated table is regenerated to say so. A
  reader that refuses a document nobody mis-quoted, and cannot say what
  was wrong with one that is, is not worth 10 ms.

## [2.3.1] - 2026-08-16

### Fixed

- **A tab-separated file is read with tabs.** `.tsv` was handed to the
  comma reader, so every row came back as a single field and the paths
  inside it were never seen. Fixed on both frontends.

### Changed

- **New icon artwork.** A new drawing in the style the family is moving
  to, framed like the rest of the set.

### Fixed

- **The agent-files check no longer times out on Windows.** A test-only
  fix; nothing a user of the extension can observe.

## [2.3.0] - 2026-08-14

Run it on the file you have open and it reads the file you have open.
Until now it refused anything outside eight formats, which on most days
is the file you are actually looking at.

### Added

- **YAML** (`yaml`), read by a real parser: path-like scalar values and
  keys, across every document in a file. Every CI config, Kubernetes
  manifest and compose file was a document this extension used to
  refuse.

- **Every other language too**, by a text scan: Python, Go, Markdown,
  XML, a Dockerfile, a Makefile, a shell script. **Expect more results
  than before** — a scan claims two shapes and nothing else: a quoted
  token, which gets the whole path heuristic, and an undelimited run
  that carries a path separator. That second rule is what keeps
  `os.path`, `np.array` and `logger.info` out of the list — an extension
  and an attribute are the same shape, and only the quoting tells them
  apart.

- A **Rust CLI and MCP server**, in [`crate/`](crate/README.md),
  published to crates.io as
  [`paths-le`](https://crates.io/crates/paths-le). It runs the same
  extraction from a terminal and adds what an editor cannot do:
  resolving each path against the filesystem it is standing in, and
  reporting whether it still points at anything — missing, escaping the
  audited tree, non-canonical, or a symlink with its target named. Exit
  codes are the API, so `paths-le --strict .` is a CI step as it stands.

  The extension stays the reference implementation for extraction. The
  corpus both frontends build against lives in
  [`crate/fixtures/`](crate/fixtures/),
  `scripts/check-extraction-parity.ts` runs it against this extension,
  `cargo test` runs it against the crate, and `ci-crate.yml` watches
  `src/extraction/**` so neither side can drift green.

- **Markdown is pinned by the shared corpus**
  (`crate/fixtures/documents/paths.md`). It was advertised in the
  `extract_paths` schema with nothing holding the two servers to reading
  it the same way. No behaviour changed — this pins what both already
  answer.

### Changed

- **"Path extraction is not supported for … files" is gone.** It was the
  honest answer while there was nothing to fall through to; the command
  now extracts from whatever document is open. The `format` error
  category went with it, having existed only for that message.

- **The context menu entry is no longer gated on a list of language
  IDs**, so it appears on the files it can now read, and
  `activationEvents` covers the languages the new formats bring.

- **`extract_paths` answers a call with neither `format` nor
  `filename`** instead of refusing it. It scans the content and reports
  `fileType: "unknown"`. `SUPPORTED_FORMATS` gains `yaml` and
  `markdown`, so an agent asking for either is told the ask is
  understood.

- The npm server's README documented arguments and a response shape that
  were never this tool's — `format: "markdown"`, a `protocol` field, a
  URL in the example — carried over from a sibling package. The
  documented tool is now the tool that ships.

- The README, the npm server's README and the manifest cross-reference
  the CLI, and the CLI references them back, so a reader arriving at any
  one of the five channels can find the other four.

- **New icon artwork.** All sixteen tools were redrawn in one style, so
  the family reads as one set wherever the listings sit side by side —
  the Marketplace, Open VSX and letools.dev. The framing is unchanged:
  the drawing fills 65.8% of an 800×800 canvas, and every smaller size
  is derived from that one file rather than drawn again.

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
[0.2.0]: https://crates.io/crates/paths-le/0.2.0
