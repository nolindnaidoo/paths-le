# paths-le — Rust specification

A port of the [Paths-LE](https://github.com/nolindnaidoo/paths-le) VS Code
extension to a Rust CLI and MCP server, plus the one thing a terminal can
do that an editor cannot: resolve what it found against the filesystem it
is standing in.

**Parity first.** For extraction, the extension is the reference
implementation. Anything this produces for a given document must match
what the extension produces for that document. A difference is a
regression until proven otherwise — not an improvement. The resolution
layer has no extension equivalent and is specified separately, at the
bottom, so nobody mistakes an addition for a port.

## The one question

**Where are the paths in this code, and do they still point at anything?**

The extension answers the first half, in an editor, one file at a time.
This answers both halves, over a tree, as a report a person reads and an
exit code a script branches on.

## Why this is not a linter

The temptation, at every design decision, will be to have opinions about
the paths it finds. Prefer forward slashes. Prefer relative imports.
Prefer no deep nesting. Resist all of it, for a structural reason:

**A tool with style opinions stops being trusted about facts.** The
moment "this path is wrong" can mean "I disagree with how you wrote it",
"this path is broken" stops being believable — and the only reason to run
this in a trusted environment is that it reports what is *there*.

Every finding this tool reports is checkable against the filesystem by
hand. If a claim cannot be verified that way, it does not belong here.

Same reason pixelcoords never moves the mouse, and scrape-le never
scrapes.

## Shape

**One crate.** Self-contained: no published `-core`, no shared crate with
the rest of the family. The separation that matters is architectural, and
an internal module boundary gives all of it.

```
crate/
├── src/
│   ├── extract/      pure: heuristics, positions, the nine format
│   │                 extractors and the generic scan. No filesystem,
│   │                 no I/O, pub(crate).
│   ├── resolve.rs    the filesystem half — canonicalize, symlinks, roots
│   ├── walk.rs       ignore-aware tree walking and format detection
│   ├── audit.rs      one file end to end — the only path either surface calls
│   ├── cli.rs        the terminal surface
│   └── mcp/          the agent surface
└── fixtures/         the shared corpus, read by both frontends
```

**`extract/` touches no filesystem.** It takes document text and a
format, and returns paths with positions. The entire extraction layer is
therefore testable from a fixture file: no I/O, no temp directories, no
flake. It is `pub(crate)` and carries the **75% line coverage floor per
module**, which is the only thing the split was ever for.

**`resolve.rs` is the only module allowed to touch the filesystem.** If a
`std::fs` call appears in `extract/`, that is a bug.

**Both surfaces are one implementation.** `cli.rs` and `mcp/` both call
`audit.rs`, which calls `extract()` and then `resolve()`. A surface that
grows its own copy of a rule is a bug, and a contract test asserts the
two return identical findings for the same file.

## Extraction — parity scope

Ported as-is, including limitations. Where the extension is limited, this
is limited the same way, and the limitation is written down rather than
quietly fixed — otherwise "parity" cannot be tested.

### Formats

Nine typed extractors, matching the extension exactly: **JSON/JSONC,
YAML, TOML, CSV, dotenv, JavaScript, TypeScript, HTML, CSS/SCSS/LESS.**
Each is handed already-delimited tokens by a parser.

**A document in any other format is scanned, not refused.** Every
language id the engine has no extractor for — `python`, `go`,
`markdown`, `xml`, a Dockerfile, a Makefile — resolves to `unknown` and
goes through `extract/fallback.rs`. The refusal it replaced said
`"Path extraction is not supported for {language_id} files"`, which was
the honest answer while there was nothing to fall through to; with a
scan behind it, refusing would be declining to look at four fifths of a
repository.

#### The generic scan

Raw text has no delimited token, so the scan makes them and then applies
the same heuristic:

- A **quoted run** — single, double or backtick, closing on the same
  line — is a delimited token and gets the whole heuristic, spaces
  included. An unterminated quote is not a delimiter, or an apostrophe
  in prose would swallow the rest of the line.
- Everything else is an **undelimited run**, broken on whitespace and on
  `()[]{},;=`, with a trailing `.` or `:` dropped. `<>|*?` are *not*
  break characters: they are forbidden inside a candidate anyway, so
  leaving them in rejects the whole token instead of salvaging a
  fragment — `src/**/*.ts` stays one rejected glob.
- **An undelimited run must carry a path separator.** This is the one
  rule the scan adds, and it is what keeps `os.path`, `np.array` and
  `logger.info` out: an extension and an attribute are the same shape,
  and separating them by dictionary would be the TLD list this spec
  already declined for `example.com`. What separates them is the
  delimiter, because source quotes its filenames and does not quote its
  attribute access — so `open("data.csv")` still reports `data.csv`.
- A candidate made only of `/`, `\` and `.` is rejected. `//` matches
  the Unix-absolute pattern exactly and opens a comment in half the
  languages in a repository.

`fixtures/documents/paths.py` pins all of it, `os.path` included.

**Known limitation, pinned rather than fixed:** a quoted run swallows
what is inside it, so a path inside a Python triple-quoted docstring is
read as part of one long delimited token and not claimed. Both frontends
do this identically.

#### YAML

`saphyr` here, `js-yaml` in the extension. **Positions come from a
forward-moving text search, not from either parser**, exactly as TOML's
do — a position taken from `saphyr`'s markers would disagree with
`js-yaml`, which has no equivalent, on every quoted, folded or anchored
scalar. So the two parsers only have to agree on the values and their
order, which is what the corpus checks.

Keys count as well as values, as TOML's do: a mapping keyed by path is
ordinary in a config map or a compose file. An alias expands to its
anchor's value, so the same string is reported twice and the second
occurrence resolves to the anchor's position.

**Known limitation, pinned:** a scalar holding a shell command —
`run: node ./scripts/build.js` — is one delimited token containing
spaces, so no path is claimed from it. That is the same rule JSON and
TOML follow, and reading inside such a scalar would give YAML answers
different in kind from theirs for identical input.

### The path heuristic

One heuristic, shared by every format extractor, in two halves.

**Strongly-structured candidates may contain spaces**, because the input
is always an already-delimited token (a JSON string, an env value, a CSV
cell): Unix absolute (`/…`), Windows drive (`C:\…`, `C:/…`), relative
(`./…`, `../…`), and `http(s)://` / `file://` URLs.

**Weakly-structured candidates must not contain whitespace**: bare
`name.ext` and `dir/file`. `name.ext` must additionally not be purely
numeric, which is what keeps version strings (`1.8.1`) and IP addresses
(`192.168.1.1`) out of the results.

`"'<>|*?` are forbidden anywhere in a candidate. Anything shorter than
two characters is rejected.

**Known limitation, ported deliberately:** a bare domain (`example.com`)
matches `name.ext` and is reported as a `file`. It is indistinguishable
from a filename without a TLD list, and the extension carries the same
behaviour. `fixtures/heuristics.json` pins it on both sides.

### Classification

Five kinds, in the extension's precedence order: `url` (`http://`,
`https://`, `file://`, or a `//host` UNC form that is not `///`),
`unknown` (`#fragment`), `absolute` (`/…` or a drive letter), `relative`
(`./`, `../`), `file` (contains a dot), `unknown` (everything else).

### Positions

**Line and column are 1-based, and columns are counted in UTF-16 code
units — not bytes and not Unicode scalars.** This is not an accident of
the JavaScript original. It is what an editor reports, so it is what a
person comparing this tool's output against their editor needs to see.
`fixtures/documents/unicode.json` exists solely to pin it: a byte-counted
column answers 12 where the correct answer is 11.

CSV is the one exception, and it is the extension's: a CSV position is a
cell coordinate — line is the row number, column is the cell index — not
a character offset. The context string repeats both so nobody reads it as
an offset.

### Ported bug-for-bug

These are the extension's current answers, pinned by
`fixtures/extraction.json`. They are behaviour, not aspiration:

- **dotenv emits twice** for a line whose key is itself path-like: once
  for the value, once for the key, value first.
- **TOML positions come from a forward-moving text search**, not from the
  parser, because `@iarna/toml` exposes no offsets. Repeated identical
  values resolve to successive occurrences; a value that cannot be
  located falls back to 1:1.
- **JavaScript extraction is regex over module specifiers**, not an AST
  walk. Package names (`react`, `node:fs`, `@org/pkg`) are excluded by
  an allow-list of shapes: relative, absolute, drive-letter, or URL.
- **String escapes are not interpreted.** A JavaScript source containing
  `'C:\\Program Files\\app'` yields the path exactly as written in the
  source, backslash pairs intact. dotenv is the sole exception, because
  the extension unescapes `\\` there.
- **CSS `@import` wins over `url()`** for the same span, so a path inside
  `@import url(…)` is counted once.
- **`data:`, `javascript:` and `vbscript:` are excluded** in HTML and CSS,
  case-insensitively and past leading whitespace. The JavaScript
  extractor does not need the exclusion: its allow-list excludes unknown
  schemes by construction.
- **A `data:` URI inside `srcset` survives that exclusion**, because
  `srcset` is split on commas *before* the scheme check runs and a
  base64 payload contains commas. The tail is reported as a path with
  kind `unknown`. Verified against the extension rather than assumed;
  `fixtures/documents/srcset-data-uri.html` pins it on both sides.

### Out of parity scope

Commands, the editor UI, i18n, the configuration reader, the status bar
and telemetry are extension concerns with no CLI equivalent. Parity is
`src/extraction/**` and nothing else.

### Deliberate divergences

Two different things get called "drift", and only one of them is a bug.

**The shared `extract_paths` tool may never diverge.** One tool name, one
schema, two servers — the npm one the extension ships and this one. An
agent must get the same answer whichever it reaches, so a difference
there is a defect in one of them, full stop. It is pinned two ways:
`fixtures/mcp-extract-paths.json` runs the cases somebody wrote down
against both, and `scripts/check-extraction-differential.ts` generates
several hundred more and puts them through both servers.

**The two surfaces are allowed to differ, and should.** The extension is
IDE-first — one open buffer, a person reading results in an editor — and
this is terminal-first: trees, exit codes, JSON Lines, piping,
automation. Holding either to the other's shape would make both worse.
What follows from that split, and why:

| divergence | why |
|---|---|
| The walk, resolution, exit codes, `--strict`, JSON Lines on stdout | A terminal answers about a tree and a script branches on the answer. An editor has neither a tree nor an exit code. |
| A file read by the generic scan is not resolved unless `--resolve` asks | A scan is generous by construction. In an editor a human glances at a generous list and moves on; a `missing` verdict is a claim, and a claim needs evidence. |
| A relative path resolves against the directory of the file it was found in, not the workspace folder | See "Resolution — the enhancement". `./helper` in `src/app.ts` means a sibling of `app.ts`, and that is the dominant case on a command line. |
| Extraction can fail here with a parsing diagnostic; the extension's engine cannot report one | The regex-driven extractors have a backtracking budget, and exhausting it is a refusal rather than a wrong answer. The extension's engine has no channel to say so. Both return no paths; only this one says why. |

Anything else is drift. A difference that does not follow from IDE-first
versus terminal-first is a bug in one of the two, and it belongs in this
table only after it has an answer to "which use case asked for this?".

## Output contract

**stdout is protocol. stderr is human. There is no `--json` flag** — one
mode, nothing to misremember, and the human summary is a projection of
the same report so the two cannot drift.

stdout carries one JSON report per line, one line per file examined —
including a file that turned out to contain no paths, because silence
about it is indistinguishable from never having looked:

```json
{
  "file": "src/app.ts",
  "format": "typescript",
  "paths": [
    {
      "value": "./utils/helper",
      "type": "relative",
      "line": 2,
      "column": 25,
      "context": "JS import",
      "resolution": {
        "verdict": "missing",
        "canonical": "/repo/src/utils/helper",
        "symlink": null,
        "reason": "no such file or directory"
      }
    }
  ],
  "diagnostics": [],
  "summary": { "paths": 11, "findings": 1 }
}
```

`resolution` is always present, so a consumer writes one reader. When
resolution did not run it carries `verdict: "unresolved"` and the reason.

`diagnostics` carries what happened to the file rather than to a path —
an unsupported format, or a file that could not be read at all. A
diagnostic with severity `error` means this file was **not examined**,
and a run containing one exits 2 rather than reporting a clean result
that quietly skipped something.

Paths are reported as they were walked, so naming a relative directory
gives relative report paths. Resolution compares canonically underneath,
because a finding that depended on how the argument was spelled would be
worse than no finding at all.

**Every path in the report spells its separators forward, on every
platform** — `file`, `resolution.canonical` and `resolution.symlink`
alike. A report is a document somebody diffs against the same report
taken on another machine, and the paths this tool extracts are written
with `/` in the source it read them from, so a Windows run answering in
`\` would be answering in a different alphabet from the question. The
rewrite is Windows-only: `\` is a legal character in a Unix filename,
and rewriting it there would rename the file in the report.
`canonicalize`'s `\\?\` verbatim prefix goes the same way, being an
artefact of the call rather than part of the path.

### Exit codes are the API

- **0** — every path examined is fine, or nothing was found to examine.
- **1** — at least one finding: `missing`, `escapes-root` or
  `non-canonical`, plus `symlinked` under `--deny-symlinks`.
- **2** — the question was malformed: an unknown flag, an unreadable
  input, a path that does not exist, a `--root` that is not a directory.

A run over many files exits with the worst outcome in it. **Exit 1 is not
an error** — it is the tool answering "no". Only exit 2 means the tool
could not answer.

## The CLI surface

```
usage: paths-le [options] <file|dir>...
       paths-le [options] --stdin --format <format>
       paths-le mcp
       paths-le --version | --help

Finds every file and directory path in a document and reports whether it
still points at anything. JSON reports on stdout, human summary on stderr.

Options:
  --resolve            check the paths a generic scan found against the
                       filesystem too. A file no format extractor reads
                       is scanned as raw text, and those paths are
                       reported as written unless this is given.
  --no-resolve         report every path as written; skip the filesystem
                       entirely. No path can then be a finding.
  --root <dir>         the boundary a relative path may not escape
                       (default: the enclosing git repository, else the
                       directory argument, else the working directory)
  --deny-symlinks      treat a symlink as a finding too (it is reported
                       either way)
  --format <format>    force a format instead of inferring from the
                       extension; required with --stdin. A name no
                       extractor answers to is scanned generically.
  --stdin              read one document from stdin
  --follow-symlinks    resolve through symlinks when walking a tree
                       (default: report the link, do not descend it)
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes
```

Rendering the report for a human on stderr is a projection: the file, the
path, its position, and its verdict — never prose that says something the
JSON does not.

## Resolution — the enhancement

**This has no extension equivalent and is therefore outside parity
scope.** It is why this crate exists rather than being the extension with
a different front door: the editor can extract path *strings*, but only a
binary standing in the actual filesystem can say whether they point at
anything.

Each extracted path gets exactly one verdict:

| verdict | meaning |
|---|---|
| `ok` | exists, canonical, and inside the root |
| `symlinked` | exists, but the path or a component is a symlink. The target is reported. A finding only with `--deny-symlinks`. |
| `non-canonical` | exists, but the written form is not the canonical one — **a finding by default** |
| `missing` | does not exist |
| `escapes-root` | a **relative** path that resolves above the root |
| `unresolved` | resolution did not run, or the path is not a filesystem path |

Rules that keep this honest:

- **A relative path resolves against the directory of the file it was
  found in**, never against the working directory. That is what the path
  means to the code that contains it.

  This is the one place the CLI departs from the extension, which
  resolves against the *workspace folder*. That is right for a path
  written relative to a project root and wrong for `./helper` in
  `src/app.ts` — which is the dominant case — so the base is the file
  and the departure is recorded here rather than left to be discovered.
- **The root defaults to the enclosing git repository.** The extension's
  `resolveWorkspaceRelative` works against the workspace folder, and a
  repository is what a workspace folder is on a command line. Rooting at
  the directory argument instead made every cross-package import in a
  monorepo an escape — measured: auditing one package of this family
  produced three `escapes-root` findings for correct code. `--root`
  overrides; outside a repository the directory argument is used.
- **An absolute path never `escapes-root`.** It is absolute by intent;
  its verdict is decided by existence alone. Flagging every absolute path
  as an escape would be noise dressed as rigour.
- **`url`-typed paths are `unresolved`**, with the reason `not a
  filesystem path`. So is anything else carrying a scheme — `ftp://`,
  `postgresql://`, `git+https://` — because extraction only classifies
  http, https and file as `url`, and the rest arrive here looking like
  paths with slashes in them. Resolving `file://` URLs is deliberately
  not done: a second URL parser's worth of surface for one rare case.
- **A path written without an extension is probed against a fixed
  list** — `.ts .tsx .js .jsx .mjs .cjs .json` appended to the name as
  written — and the substitution is reported in the verdict's reason so
  it stays checkable. Without this, every relative import in a
  TypeScript codebase reports as a missing file, which is most of the
  paths in most repositories this will ever be pointed at. The candidate
  is the written name **plus** an extension, never with its own
  extension replaced, so `./gone.ts` stays a real finding and
  `./tool-facts.generated` still resolves to `tool-facts.generated.ts`.
- **A file read by the generic scan is not resolved unless asked.** The
  scan is generous by construction, so resolving what it finds turns a
  false positive into a `missing` finding — a claim — rather than a
  quiet extra row. A typed extractor was handed a delimited token by a
  parser and has earned the claim; a scan has not. `--resolve` on the
  CLI and `resolveScanned` on the MCP tool ask for it. `--no-resolve`
  still wins over both: asking for more resolution is not asking for
  less.
- **A colon-joined composite does not commit to being a path.** A
  compose volume (`/etc/localtime:/etc/localtime:ro`), a `PATH` entry
  (`/usr/bin:/usr/local/bin`), an `scp` target, a `file:line` reference:
  each starts with `/` and so says it is a path, which would be evidence
  enough for `missing` — about a string that was never one path. Found
  by running the binary over a tree of compose files: five findings, all
  five wrong. The value still resolves to `ok` if something by that whole
  name is really there; only the unprovable negative is withheld. A
  drive letter is the exception, being the one shape that is genuinely
  one path with a colon in it.
- **`missing` is a claim, and a claim needs evidence.** Extraction is
  generous by design: in an editor a human glances at the list and moves
  on. A resolver cannot be, so a value earns a `missing` verdict two
  ways and only two — it uses explicit path syntax (`./x`, `../x`, `/x`,
  `C:\x`), or it carries a file extension after a separator
  (`src/app.ts`, `images/bg.png`).

  Everything else — `image/png`, `text/html`, `@heroui/styles`,
  `io.github.you/tool`, `^1.101.0`, `example.com`, a localised UI string
  with a slash in it — still resolves to `ok` when something is actually
  there, and comes back `unresolved` when it is not. Nothing true is
  lost; only the unprovable negative.

  **The cost, stated plainly:** an extensionless path written without a
  leading `./`, like `docs/api`, is no longer reported when it goes
  missing. That shape is also how bare module specifiers are written,
  which this tool refuses to resolve for the same reason. A symlink is
  the exception to all of it — `symlink_metadata` succeeding is proof
  the value named something real, so a broken link is a finding whatever
  its shape.
- **`non-canonical` means the written form is genuinely ambiguous**:
  duplicate separators (`a//b`), an embedded traversal (`a/../b`), a
  trailing slash, or backslash separators in an otherwise POSIX path. A
  leading `./` is idiomatic and is *not* a finding — flagging it would
  make the tool unusable on every codebase that uses relative imports.
- **Resolution never mutates anything.** There is no `--fix`. A tool that
  rewrites source files needs a confirmation story this one does not have
  yet; see Not in v1.
- **The two defaults come from the extension, not from taste.**
  `normalizePath` in `src/utils/pathResolver.ts` *is* the definition of
  canonical form — separators forward, duplicates collapsed, no trailing
  slash — and `path.resolve` collapses embedded traversal on top of it.
  A path that deviates is one the extension would have rewritten, so
  **`non-canonical` counts by default**: an audit that stayed quiet
  about it would be withholding the thing it was asked for.

  The same file treats symlink resolution as an ordinary step rather
  than an anomaly, so **a link is a fact by default** and
  `--deny-symlinks` is how you say otherwise. It exists because catching
  an unexpected link is exactly what some trusted-environment audits are
  for, and "grep the JSON" is not an answer for a CI step.

## The MCP surface

Two tools, both returning the family envelope
`{ ok, data, diagnostics, meta }`, where `ok` means the check ran — never
that the answer was yes.

- **`extract_paths` belongs to both servers.** The npm server
  (`src/mcp/tools.ts`) and this one offer the same tool: same schema,
  same envelope, byte-identical output. `fixtures/mcp-extract-paths.json`
  runs against both, so changing one without the other fails a build.
  It touches no filesystem, in either implementation — an agent already
  has file-read tools, and duplicating them adds a path-traversal
  surface for no capability.
- **`paths_le_audit` is this server's own**, because it is the tool that
  needs a filesystem: it takes files or directories, walks them, and
  returns the same reports the CLI writes to stdout.

**Refusals speak the caller's vocabulary.** An MCP caller has no command
line, so no message returned by this server mentions `--no-resolve` or
any other flag.

## Non-goals

- **It does not rewrite files.** See Not in v1.
- **It does not follow paths off this machine.** No network, ever — a
  `https://` path is classified and left alone.
- **It has no style opinions.** See "Why this is not a linter".
- **It does not learn a project's module resolution.** `tsconfig` path
  maps, bundler aliases and `node_modules` lookup all need a config file
  to be right about, and getting them half-right produces confident
  wrong answers. Appending a known extension is *not* that: every answer
  it gives is a file you can `ls`, which is the line this tool does not
  cross. A package specifier like `@heroui/styles` in a CSS `@import`
  is therefore `unresolved` rather than `missing` — this tool cannot
  tell it from a path without reading a config it does not read, so it
  declines to claim either way.

## Not in v1

Listed here so nobody smuggles one in early.

- **`--fix`**, rewriting non-canonical paths in place. The extension's
  `sanitize`-style write path needs a confirmation story: what it touches,
  what it backs up, what happens on a partial write.
- **Module-resolution awareness** — extension inference and `tsconfig`
  path mapping, behind an explicit opt-in that says what it assumed.
- **A `file://` resolver.**
- **Watch mode.**

## Files that cannot be read

Exit 2 means the *question* was malformed — an unknown flag, an
unreadable format name, a path that does not exist. It does not mean one
file in fifty thousand was a PNG.

**A binary file is not a skipped file.** A NUL byte in the first 8KB —
ripgrep's heuristic, so the answer matches the walker's ignore rules —
means the file was never a text candidate. It gets no report line at all
and never moves the exit code. Before the walk widened to every
extension it was never opened; reporting it now would make `--strict`
exit 2 on every repository holding an image, which is every repository.
It is still *counted*: the stderr summary ends `, 16 binary files
skipped`, and the MCP audit carries a `binary` diagnostic, because
coverage narrower than the tree that nobody was told about is the
failure this tool exists to avoid.

A file that looked like text and could not be read as it — a permission,
invalid UTF-8 without a NUL — is:

- named on stderr,
- carried in the JSON report with a `skipped` diagnostic saying why,
- and left out of the exit code.

`--strict` turns any skipped file back into exit 2, for a pipeline that
wants zero tolerance. What is never allowed is the third option: a text
file that silently vanishes from the report, which reads to whoever ran
it as a file that was clean.

## The byte-order mark

A leading BOM is stripped before extraction. It is three invisible bytes
that Notepad, Excel and a PowerShell redirect all add, and that VS Code
removes before the extension sees a document — so leaving it in means
the two frontends read the same file differently. It shifts every column
on the first line, and in a structured format it can lose the document
entirely.

A BOM anywhere other than the start is a zero-width no-break space and
belongs to the text.
