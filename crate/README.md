<p align="center">
  <img src="https://raw.githubusercontent.com/nolindnaidoo/paths-le/main/src/assets/images/icon.png" alt="paths-le logo" width="96" height="96"/>
</p>

<h1 align="center">paths-le</h1>

<p align="center">
  <b>Find every path in a codebase and report whether it still points at anything</b><br/>
  <i>missing, escaping the tree, non-canonical, symlinked — one verdict a script can branch on</i>
</p>

<p align="center">
  <a href="https://crates.io/crates/paths-le">
    <img src="https://img.shields.io/crates/v/paths-le.svg" alt="paths-le on crates.io" />
  </a>
  <a href="https://crates.io/crates/paths-le">
    <img src="https://img.shields.io/crates/d/paths-le.svg" alt="crates.io downloads" />
  </a>
  <a href="https://github.com/nolindnaidoo/paths-le/actions/workflows/ci-crate.yml">
    <img src="https://github.com/nolindnaidoo/paths-le/actions/workflows/ci-crate.yml/badge.svg" alt="Build Status" />
  </a>
  <img src="https://img.shields.io/badge/rustc-1.88+-93450a.svg" alt="MSRV: Rust 1.88+" />
  <a href="https://github.com/nolindnaidoo/paths-le/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  </a>
  <a href="https://letools.dev/tools/paths-le">
    <img src="https://img.shields.io/badge/web-letools.dev-00A0FF.svg" alt="letools.dev" />
  </a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/nolindnaidoo/paths-le/main/assets/demo.gif" alt="paths-le demo — the real binary, recorded by assets/demo.tape" width="100%"/>
</p>

> **Useful?** A star is how other developers find it —
> [★ GitHub](https://github.com/nolindnaidoo/paths-le) ·
> [letools.dev/tools/paths-le](https://letools.dev/tools/paths-le)

A path in a config file is a promise about the filesystem, and nothing
checks it. The import still compiles because the bundler resolves it
differently. The asset still loads because the symlink is still there.
The `..` in the middle of that path means something other than it looks
like. paths-le reads the paths out of your files and then goes and looks:
does it exist, does it leave the tree, is it written the way it resolves,
and is anything on the way a link.

It is the second frontend of
[Paths-LE](https://github.com/nolindnaidoo/paths-le#readme), the VS Code
extension — one product, two frontends, one repository, so the two can
never read a document differently. The corpus both build against lives at
[`crate/fixtures/`](https://github.com/nolindnaidoo/paths-le/tree/main/crate/fixtures),
and CI fails on drift.

## The other four ways to run it

Same engine, four other front doors. Pick the one that fits where you
are; nothing here is a lesser version of anything else.

| Where | What you get | Install |
|---|---|---|
| **VS Code** | The extraction, in your editor, on a keystroke | [Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le) |
| **Cursor, VSCodium, Windsurf** | The same extension | [Open VSX](https://open-vsx.org/extension/OffensiveEdge/paths-le) |
| **Any MCP agent, via Node** | `extract_paths` over stdio — the same tool this binary offers | `npx paths-le-mcp` · [npm](https://www.npmjs.com/package/paths-le-mcp) |
| **Zed** | The MCP server as a context server | [add it by hand](https://zed.dev/docs/ai/mcp) *(no listing yet)* |

**Which MCP server should you run?** They answer identically —
`fixtures/mcp-extract-paths.json` runs against both and CI fails if they
diverge. Take `npx paths-le-mcp` if Node is already there and you only
want `extract_paths`. Take `paths-le mcp` if you want one static binary
with no runtime, or if you want `paths_le_audit` too — resolving paths
against the filesystem is this binary's half, and the npm server
deliberately touches no files.

All sixteen LE tools are on **[letools.dev](https://letools.dev)**.

## Sixty seconds

```bash
paths-le .                      # audit a tree
paths-le --deny-symlinks .      # fail on an unexpected symlink too
paths-le --no-resolve src/      # just list what is written, touch nothing
cat pkg.json | paths-le --stdin --format json
```

```
./pkg.json:3:12  ./docs//guide.md  [non-canonical — contains a duplicate separator]
./src/app.ts:2:16  ./gone.ts  [missing — no such file or directory]
./src/app.ts:3:16  ../../escape/out  [escapes root — resolves outside /repo]
5 paths in 3 files — 3 findings
```

The report is JSON on stdout — one object per line, one line per file —
the summary above is stderr, and the exit code is the answer: **0 clear ·
1 findings · 2 the question was malformed.**

Every verdict is checkable by hand against the same filesystem. That is
the rule the tool is built to: if a claim cannot be verified that way, it
does not get made.

## Install

| Route | Command | Worth knowing |
|---|---|---|
| **cargo** | `cargo install paths-le` | Any platform, needs **Rust 1.88+**. |
| **From source** | `git clone https://github.com/nolindnaidoo/paths-le`<br>`cd paths-le/crate && cargo build --release` | The same build CI runs. |

No runtime, no browser, no network — it reads files and asks the
filesystem about them, and that is all it ever does.

## What it reads

**Every text file in the tree.** Nine formats have a parser behind
them — **JSON/JSONC, YAML, TOML, CSV, dotenv, JavaScript, TypeScript,
HTML, CSS/SCSS/LESS** — and everything else is read by a generic text
scan: Python, Go, Markdown, XML, a Dockerfile, a Makefile.

A directory is walked the way ripgrep walks one — `.gitignore` honoured,
hidden files skipped — so what it looks at is the answer you already have
in your head. A file named explicitly is always read, ignore rules
included.

The scan claims two shapes and nothing else: a **quoted** token, which
gets the full path heuristic, and an **undelimited** run that carries a
path separator. That second rule is why `os.path` in a Python file is
not reported as a file — an extension and an attribute are the same
shape, and only the quoting tells them apart. Because a scan is generous,
**its paths are not resolved unless you pass `--resolve`**: a false
positive would otherwise arrive as a `missing` finding rather than a
quiet extra row.

A binary file — a NUL byte in the first 8KB, ripgrep's own test — is
skipped with no report line and counted in the summary. A file that
looked like text and could not be read as it is named, and `--strict`
fails the run on it.

Reading every text file means reading the ones you may not want: a
committed lockfile is text, and its integrity hashes and version ranges
match the path heuristic the same way `example.com` does. None of them
can become a finding — the resolver declines to claim about a value that
does not commit to being a path — but they are rows, and there are a lot
of them. **On the 501-file tree the `budget` job scans, one lockfile
accounts for 2,000 of the 3,000 paths reported — two thirds of the
output from one file.** A real TypeScript application measured the same
shape: 5,367 of 6,555. The walker is ripgrep's, so an `.ignore` file
naming `bun.lock` is the lever, and it is the same lever you already use
for `rg`.

## The verdicts

| verdict | meaning | counts as a finding |
|---|---|---|
| `ok` | exists, canonical, inside the root | no |
| `symlinked` | exists; the path or a component is a link, target reported | with `--deny-symlinks` |
| `non-canonical` | exists, but the written form is not how it resolves | **yes** |
| `missing` | does not exist | **yes** |
| `escapes-root` | a relative path that resolves above the root | **yes** |
| `unresolved` | not checked, or not a filesystem path | no |

Five rules keep this usable rather than noisy — each one came from
running it over real repositories and throwing out the answers that were
technically true and practically useless:

- **An import written without an extension resolves to the file it
  names.** `./dedupe` finds `dedupe.ts`, and says so in the verdict. The
  candidate list is fixed — `.ts .tsx .js .jsx .mjs .cjs .json` — and
  every answer is a file you can `ls`. `tsconfig` path maps and bundler
  aliases stay out of scope.
- **`missing` requires the value to commit to being a path.** It earns
  that two ways: explicit syntax (`./x`, `../x`, `/x`, `C:\x`), or a
  file extension after a separator (`src/app.ts`). Everything else —
  `image/png`, `@heroui/styles`, `io.github.you/tool`, `^1.101.0`,
  `example.com` — still resolves to `ok` when something is there, and
  comes back `unresolved` when it is not. Its absence is not evidence it
  was ever a path.
- **A leading `./` or `../` is idiomatic, not a finding.** A check that
  fires on every relative import in every codebase is a check nobody
  reads. `non-canonical` means genuinely ambiguous: a duplicate
  separator, a trailing slash, mixed separators, or a `..` in the middle
  of a path.
- **An absolute path never "escapes".** It is absolute by intent; it is
  judged on existence alone.
- **A symlink is a fact by default, and a finding when you ask.** The
  extension treats resolving a link as an ordinary step, so that is the
  default here; `--deny-symlinks` is for the audits that exist to catch
  an unexpected one.
- **Canonicalisation counts without being asked.** `normalizePath` in
  the extension defines canonical form, so a path that deviates is one
  it would have rewritten — an audit that stayed quiet about that would
  be withholding the thing it was asked for.
- **The root is the enclosing git repository.** Rooting at the directory
  you named instead makes every cross-package import in a monorepo an
  escape.

Run over the eleven repositories these rules were developed against,
six report zero findings and the rest report one or two — each of which
is a genuinely absent path. The cost of that quiet is stated plainly
above: an extensionless path written without a leading `./`, like
`docs/api`, is no longer reported when it goes missing, because that
shape is also how bare module specifiers are written.

## Options

```
--resolve            check what a generic scan found against the filesystem too
--no-resolve         report every path as written; skip the filesystem entirely
--root <dir>         the boundary a relative path may not escape
                     (default: the enclosing git repository)
--deny-symlinks      treat a symlink as a finding too
--format <format>    force a format instead of inferring it from the name
--stdin              read one document from stdin
--follow-symlinks    resolve through symlinks when walking a tree
--hidden             walk hidden files and directories too
--no-ignore          walk files that .gitignore excludes
```

A relative path resolves against the directory of the **file it was found
in**, never the working directory — that is what it means to the code
that contains it.

## In CI

```yaml
- name: No broken paths
  run: paths-le .
```

Exit 1 fails the step on a real finding. Exit 2 means the tool could not
answer — an unreadable file, a directory it cannot enter — and fails it
too, because an audit that silently skipped something is worse than no
audit.

## As an MCP server

```bash
paths-le mcp
```

Two tools, both returning `{ ok, data, diagnostics, meta }`:

- **`extract_paths`** — content in, paths out. Touches no filesystem.
  The npm server ships the same tool with byte-identical output; one
  corpus runs against both.
- **`paths_le_audit`** — files or directories in, the same reports the
  CLI writes to stdout.

`ok` means the check ran, never that the answer was yes. A file full of
broken paths is a result, not an error.

## What it will not do

- **It does not rewrite files.** There is no `--fix`.
- **It has no style opinions.** Where you put your paths is your
  business; whether they point at anything is not an opinion.
- **It does not learn your bundler.** It appends a known extension and
  looks — that is a filesystem question. `tsconfig` path maps, bundler
  aliases and `node_modules` resolution need a config file to be right
  about, and half-guessing them would produce confident wrong answers.
- **It never touches the network.** An `https://` path is classified and
  left alone.

Full behaviour, including what is ported from the extension bug-for-bug
and why, is in
[SPEC.md](https://github.com/nolindnaidoo/paths-le/blob/main/crate/SPEC.md);
the engineering standard this crate is held to is in
[AGENTS.md](https://github.com/nolindnaidoo/paths-le/blob/main/crate/AGENTS.md),
and what changed is in
[CHANGELOG.md](https://github.com/nolindnaidoo/paths-le/blob/main/crate/CHANGELOG.md).

## Documentation

| What | Where |
|---|---|
| What this tool is allowed to say — scope, output contract, refusals, non-goals | [SPEC.md](https://github.com/nolindnaidoo/paths-le/blob/main/crate/SPEC.md) |
| How the code is written and held together — architecture, invariants, the gates | [AGENTS.md](https://github.com/nolindnaidoo/paths-le/blob/main/crate/AGENTS.md) |
| The VS Code extension this shares its extraction with | [README.md](https://github.com/nolindnaidoo/paths-le/blob/main/README.md) |
| What changed | [CHANGELOG.md](https://github.com/nolindnaidoo/paths-le/blob/main/crate/CHANGELOG.md) |
| The tool's page, and the other fifteen | [letools.dev/tools/paths-le](https://letools.dev/tools/paths-le) |

## More from the LE family

Sixteen single-purpose tools for the work in front of every model. Each ships
a Rust CLI and an MCP server. One page: **[letools.dev](https://letools.dev)**

**Get it out**

- **[String-LE](https://letools.dev/tools/string-le)** — Extract every string in a codebase, with its position, so a person can read them
- **[Numbers-LE](https://letools.dev/tools/numbers-le)** — Extract every hardcoded number in a codebase, so a person can check them
- **[Units-LE](https://letools.dev/tools/units-le)** — Extract every quantity with its unit, normalized, and refuse the ambiguous ones by name
- **[Dates-LE](https://letools.dev/tools/dates-le)** — Extract every date and timestamp, and the exact instant each one resolves to
- **[IDs-LE](https://letools.dev/tools/ids-le)** — Extract every UUID, ULID, NanoID, ObjectId and Snowflake, and decode the time inside
- **[IPs-LE](https://letools.dev/tools/ips-le)** — Extract every IP address, CIDR block and MAC, normalized and classified by scope
- **[URLs-LE](https://letools.dev/tools/urls-le)** — Extract every URL in a codebase, with its protocol and exact position
- **[Paths-LE](https://letools.dev/tools/paths-le)** — Extract every file path in a codebase, and say whether it still points at anything
- **[Colors-LE](https://letools.dev/tools/colors-le)** — Extract every color in a codebase, and say which ones are not in your palette

**Check it**

- **[Regex-LE](https://letools.dev/tools/regex-le)** — Find every regex in a codebase, and report which can be driven into catastrophic backtracking
- **[Versions-LE](https://letools.dev/tools/versions-le)** — Find where one dependency is constrained differently across a repository's manifests
- **[i18n-LE](https://letools.dev/tools/i18n-le)** — Identify the i18n library a project uses, then audit its catalogs by that library's rules
- **[Scrape-LE](https://letools.dev/tools/scrape-le)** — Check whether a page is scrapeable before the scraper is written, and say when it cannot tell

**Guard it**

- **[Secrets-LE](https://letools.dev/tools/secrets-le)** — Find hardcoded credentials in a codebase, and never print one into the report
- **[EnvSync-LE](https://letools.dev/tools/envsync-le)** — Compare the dotenv files in a tree, and say which keys are missing from which
- **[Unicode-LE](https://letools.dev/tools/unicode-le)** — Find the Unicode that hides meaning — bidi controls, invisibles, homoglyphs, mixed scripts

Each stands on its own: no shared crate, no published core. Where two of them
agree, it is because the same answer was right twice.

**Contact** — [nolindnaidoo.com](https://nolindnaidoo.com) · [GitHub](https://github.com/nolindnaidoo) · [LinkedIn](https://www.linkedin.com/in/nolindnaidoo/)

## Also by nolindnaidoo

**Rust** — pixelcoords and pixelactions are one loop: pixelcoords answers
*where*, pixelactions *acts* there. Their own tools, their own voice — not
part of the LE family.

- **[pixelcoords](https://github.com/nolindnaidoo/pixelcoords)** — Freeze your screen, mark regions, get pixel-exact coordinates and crops
  [pixelcoords.dev](https://pixelcoords.dev) · [crates.io](https://crates.io/crates/pixelcoords) · [docs.rs](https://docs.rs/pixelcoords)
- **[pixelactions](https://github.com/nolindnaidoo/pixelactions)** — Consume human-verified coordinates, perform the interaction, confirm it landed
  [pixelactions.dev](https://pixelactions.dev) · [crates.io](https://crates.io/crates/pixelactions) · [docs.rs](https://docs.rs/pixelactions)

## License

MIT — see [LICENSE](https://github.com/nolindnaidoo/paths-le/blob/main/LICENSE).
