# paths-le

Find every file and directory path in a codebase and report whether it still
points at anything. Answered over a whole repository with an exit code a CI
step can fail on.

```bash
npx paths-le src/
npx paths-le --no-resolve config/        # what the documents mention
npx paths-le --deny-symlinks deploy/     # a link counts as a finding too
```

This is the same command line as the Rust crate
[`paths-le`](https://crates.io/crates/paths-le), and it behaves identically:
same flags, same walk, same verdicts, same output, same exit codes. Install
whichever toolchain you already have.

## What it reads

Every file. JSON, YAML, TOML, CSV, TSV, dotenv, JavaScript, TypeScript, HTML
and CSS are read with a parser for that format. Anything else, such as Python,
Markdown or a Dockerfile, is scanned as raw text, and those paths are reported
as written unless you pass `--resolve`. Directories are walked the way ripgrep
walks them: `.gitignore`, `.ignore` and hidden files are respected unless you
pass `--no-ignore` or `--hidden`. A binary file is passed over and counted in
the summary.

## Verdicts

Each path is resolved against the directory of the file it was written in:

- **ok**: it points at something. A module written without an extension,
  such as `./dedupe`, resolves to `dedupe.ts`, and the report says so.
- **missing**: nothing is there, and the value commits to being a path.
- **escapes-root**: a relative path climbs out of the root.
- **non-canonical**: a duplicate separator, a trailing one, mixed separators,
  or `..` in the middle.
- **symlinked**: a link, with its target. Counted only under
  `--deny-symlinks`.
- **unresolved**: a URL, a fragment, or a bare name whose absence proves
  nothing.

The root is the enclosing git repository, else the directory you named, else
the working directory. `--root <dir>` sets it.

## Output

stdout carries one JSON report per file whenever it is piped or redirected,
and nothing when it is a terminal. stderr carries the human summary, which
lists the findings and names the root once:

```text
src/app.ts:2:23  ./gone  [missing — no such file or directory]
2 paths in 1 file — 1 finding (root /home/me/repo)
```

```json
{"file":"src/app.ts","root":"/home/me/repo","format":"typescript","paths":[{"value":"./dedupe","type":"relative","line":1,"column":25,"context":"JS import","resolution":{"verdict":"ok","canonical":"src/dedupe.ts","symlink":null,"reason":"written without an extension; resolved to dedupe.ts"}},{"value":"./gone","type":"relative","line":2,"column":23,"context":"JS import","resolution":{"verdict":"missing","canonical":"src/gone","symlink":null,"reason":"no such file or directory"}}],"diagnostics":[],"summary":{"paths":2,"findings":1}}
```

## Exit codes

- **0**: clear.
- **1**: at least one finding.
- **2**: the question was malformed, a document could not be parsed, or
  `--strict` and a file could not be read.

## For agents

`paths-le mcp` serves the Model Context Protocol on stdio with two tools:
`extract_paths` for a document's text and `paths_le_audit` for files and
directories. Hosts that want the extraction server alone can install
[`paths-le-mcp`](https://www.npmjs.com/package/paths-le-mcp).

`paths-le --help` lists every option.

MIT licensed. Part of [letools](https://letools.dev/tools/paths-le).
