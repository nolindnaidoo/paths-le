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

All ten LE tools are on **[letools.dev](https://letools.dev)**.

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

Eight formats, the same eight the extension supports: **JSON/JSONC,
TOML, CSV, dotenv, JavaScript, TypeScript, HTML, CSS/SCSS/LESS.** A
directory is walked the way ripgrep walks one — `.gitignore` honoured,
hidden files skipped — so what it looks at is the answer you already have
in your head. A file named explicitly is always read, ignore rules
included.

Files in other formats are skipped silently when they turn up in a walk,
and refused loudly when you name one: a repository is full of files this
has nothing to say about, and naming one means you expected otherwise.

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
--no-resolve         report paths as written; skip the filesystem entirely
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

## Also by nolindnaidoo

**Rust**

- **[pixelcoords](https://github.com/nolindnaidoo/pixelcoords)** — Freeze your screen, mark regions, get pixel-exact coordinates and crops
  [pixelcoords.dev](https://pixelcoords.dev) · [crates.io](https://crates.io/crates/pixelcoords) · [docs.rs](https://docs.rs/pixelcoords)
- **[pixelactions](https://github.com/nolindnaidoo/pixelactions)** — Consume human-verified coordinates, perform the interaction, confirm it landed
  [pixelactions.dev](https://pixelactions.dev) · [crates.io](https://crates.io/crates/pixelactions) · [docs.rs](https://docs.rs/pixelactions)
- **[secrets-le](https://github.com/nolindnaidoo/secrets-le/tree/main/crate)** — Find hardcoded credentials, and never print one
  [crates.io](https://crates.io/crates/secrets-le)
- **[urls-le](https://github.com/nolindnaidoo/urls-le/tree/main/crate)** — Extract every URL from a codebase, with its protocol and exact position
  [crates.io](https://crates.io/crates/urls-le)
- **[regex-le](https://github.com/nolindnaidoo/regex-le/tree/main/crate)** — Find every regex in a codebase and report which can be driven into catastrophic backtracking
  [crates.io](https://crates.io/crates/regex-le)
- **[scrape-le](https://github.com/nolindnaidoo/scrape-le/tree/main/crate)** — Check whether a page is scrapeable before the scraper is written
  [crates.io](https://crates.io/crates/scrape-le)

**LE Tools** — ten editor extensions, each also an MCP server:
**[letools.dev](https://letools.dev)**

**Contact Developer** — [nolindnaidoo.com](https://nolindnaidoo.com) · [GitHub](https://github.com/nolindnaidoo) · [LinkedIn](https://www.linkedin.com/in/nolindnaidoo/)

## License

MIT — see [LICENSE](https://github.com/nolindnaidoo/paths-le/blob/main/LICENSE).
