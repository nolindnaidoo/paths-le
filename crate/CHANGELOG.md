# Changelog

The Rust CLI and MCP server. The VS Code extension has its own
[CHANGELOG](../CHANGELOG.md) and its own version — the two products in
this repository release on their own cadence.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-12

Point it at a repository and it reads the repository. 0.1.0 read the
eight formats it had a parser for and walked past everything else, which
is most of a codebase.

### Added

- **Every text file in the tree is read now.** Python, Go, Markdown,
  XML, a Dockerfile, a Makefile, a shell script — anything that is text
  and not a binary. A file whose extension means nothing to this tool is
  no longer skipped by the walk or refused when you name it.

  **Your finding count will move, and it may move a long way.** Over two
  real codebases the paths reported went from 1,930 to 6,598 and from
  487 to 6,555. Most of that is coverage you did not have; some of it is
  one file. In the second case 5,367 of those 6,555 came out of a single
  committed lockfile, and on the 501-file tree this crate's own budget
  test scans, a lockfile accounts for 2,000 of 3,000 paths. Nothing in a
  lockfile can become a finding — the resolver declines to claim about a
  value that does not commit to being a path — but they are rows. The
  walker is ripgrep's, so an `.ignore` file naming `bun.lock` is the
  lever, and it is the same lever you already use for `rg`.

  A file read this way has its paths reported as written and **not**
  checked against the filesystem unless you ask with `--resolve`
  (`resolveScanned` on the MCP audit tool). A raw-text scan is generous
  by construction, and resolving what it finds would turn a false
  positive into a `missing` finding — a claim — rather than a quiet
  extra row. `--no-resolve` still wins over both.

  Two shapes are claimed and nothing else: a **quoted** token, which
  gets the full path heuristic, and an **undelimited** run that carries
  a path separator. That second rule is why `os.path` in a Python file
  is not reported as a file — an extension and an attribute are the same
  shape, and only the quoting tells them apart.
  `fixtures/documents/paths.py` pins exactly what it claims and what it
  does not.

- **YAML is read by a real parser.** Every CI config, Kubernetes
  manifest and compose file in a repository was invisible to this tool
  and is now ordinary. Keys count as well as values, an alias resolves
  to its anchor, and a multi-document file is read through. `saphyr`
  reads it here where `js-yaml` reads it in the extension; positions
  come from a forward-moving text search rather than from either parser,
  which is the same design TOML's positions use and the reason the two
  frontends can agree at all.

- **Markdown is pinned by the shared corpus**
  (`fixtures/documents/paths.md`). It was advertised in the
  `extract_paths` schema with nothing holding the two servers to reading
  it the same way. Both run the case now.

### Changed

- **`--format` accepts any name.** One this engine does not recognise
  reads the document with the generic scan instead of refusing it. The
  report's `format` field names what was actually used, which is where a
  typo shows up.

- **`extract_paths` answers a call with neither `format` nor
  `filename`** instead of refusing it, on both servers. It scans the
  content and reports `fileType: "unknown"`.

- **A binary file gets no report line at all.** A NUL byte in the first
  8KB — ripgrep's own test — means the file was never a text candidate.
  Reporting each one as skipped made `--strict` exit 2 on every
  repository holding an image, which is every repository. They are
  counted instead: the summary ends `, 16 binary files skipped`, and the
  MCP audit carries a `binary` diagnostic. A file that looked like text
  and could not be read as it keeps its named `skipped` diagnostic and
  still fails `--strict`.

- **The unsupported-format diagnostic is gone**, having existed for the
  one message the scan replaced.

### Fixed

- **Paths were reported with backslashes on Windows.** `file`,
  `resolution.canonical` and `resolution.symlink` all came back spelled
  `\`, with a `\\?\` prefix on anything resolved — so the same tree
  audited on two machines produced two reports that could not be
  diffed, and neither matched the `/` the source files were written
  with. Every path in a report now spells its separators forward, on
  every platform.

- **Every absolute path was called `non-canonical` on Windows.** The
  separator rule fired on any backslash rather than on a genuine mix of
  both, so the platform's own canonical form was reported as deviating
  from canonical form — and an ordinary `src\lib\a.ts` with it.

- **A file your editor saved with a byte-order mark read differently
  here than in the editor.** Three invisible bytes, added by Notepad,
  Excel and a PowerShell redirect and stripped by VS Code before the
  extension ever sees a file. They shifted every column on line one, and
  in front of a `{` they made the parser reject the whole document —
  which is indistinguishable from a file with no paths in it.

- **A CSV cell could lose its first character.** A cell led by U+0085
  came back as `/a.txt` here and `\u{85}/a.txt` from the npm server,
  classified `absolute` against `file`, because the reader trimmed with
  Rust's idea of whitespace rather than JavaScript's. The two languages
  disagree about exactly two characters and both of them are reachable.

- **A format name with an invisible character around it resolved two
  ways.** `\u{feff}json` was read as JSON by the npm server and fell
  through to the generic scan here, so the same argument produced
  different answers depending on which server an agent reached.

- **Five findings on a tree of compose files, all five wrong.** A
  colon-joined composite — a volume mount
  (`/etc/localtime:/etc/localtime:ro`), a `PATH` entry, an `scp` target,
  a `file:line` reference — starts with `/` and so had evidence enough
  for a `missing` verdict about a string that was never one path. It
  still resolves to `ok` when something by that whole name is really
  there; only the unprovable negative is withheld.

- **A run failed because the repository contained a PNG.** Every
  repository has one, plus a zip and something the runner cannot read,
  and exiting 2 on those made the tool unusable in CI — the one place it
  is worth the most. Such a file is named on stderr and carried in the
  report with a `skipped` diagnostic, and the exit code reflects what
  was found. `--strict` restores zero tolerance for a pipeline that
  wants it. An audit that gives up part way through a file still fails
  without being asked.

- **A file that is text but undecodable used to vanish from the
  report** — which reads, to whoever ran it, as a file that was clean.
  It is named instead.

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

[0.2.0]: https://github.com/nolindnaidoo/paths-le/releases/tag/crate-v0.2.0
[0.1.0]: https://github.com/nolindnaidoo/paths-le/releases/tag/crate-v0.1.0
