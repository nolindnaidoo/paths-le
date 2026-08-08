# The shared corpus

These files are the contract between the two frontends of Paths-LE: the
VS Code extension at the repository root, and the Rust CLI and MCP server
in this crate. **Both read them, and CI fails when either side drifts.**

They live inside `crate/` rather than at the repository root because
`cargo package` cannot reach above its own directory, and a published
crate whose corpus is missing does not build for a consumer. The
extension reaches down into them; the crate embeds them.

## What is here

| File | What it pins |
|---|---|
| `documents/` | The source documents both sides extract from. |
| `extraction.json` | Every path the extension finds in each document, with kind, position and context. |
| `heuristics.json` | `isPathLike` and `classifyPathType` over the inputs most likely to drift. |
| `mcp-extract-paths.json` | The `extract_paths` MCP tool, which **both** servers offer and must answer identically. |

## Who checks what

- `bun ../scripts/check-extraction-parity.ts` runs the **extension's own
  exported functions** over these files. It fails when the extension's
  behaviour no longer reproduces the corpus.
- `cargo test` runs the **crate's** implementation over the same files,
  from `src/extract/corpus.rs`.

Neither side is allowed to be the sole author of a case. A change to a
document or an expectation is a behaviour change for **both** frontends
and needs a CHANGELOG entry.

## Deliberate contents

Several cases exist to pin behaviour that looks like a bug and is not —
or is a bug, and is ported anyway because parity is the contract:

- **`documents/unicode.json`** pins that columns are counted in **UTF-16
  code units**, not bytes and not Unicode scalars. A byte-counted
  implementation answers column 12 on line 2 where the correct answer is
  11. It is the only case that catches this, and it is the reason the
  file exists.
- **`documents/paths.env`** covers the double-emission case: a line whose
  key is itself path-like yields two results, value first.
- **`documents/paths.json`** contains `example.com`, which is reported as
  a `file`. A bare domain is indistinguishable from a filename without a
  TLD list; the limitation is documented in SPEC.md and pinned here so it
  cannot be "fixed" on one side only.
- **`documents/paths.json`** also contains `1.8.1` and
  `documents/paths.csv` contains `3.4.5`, neither of which is extracted —
  the numeric-dotted guard that keeps version strings and IP addresses
  out of the results.
- **`documents/paths.html`** covers a multi-line tag and a `srcset` with
  two entries, each of which must get its own real position.
- **`documents/srcset-data-uri.html`** pins a quirk found by porting: a
  `data:` URI inside `srcset` is split on its own base64 commas before
  the scheme exclusion runs, so the tail is reported as a path. Both
  frontends do this. It is ported rather than fixed, because fixing it
  on one side only is how the two stop agreeing.

## Adding a case

Add the document to `documents/`, add the expectation to the relevant
JSON file, and run both checks. If the two frontends disagree, the
disagreement is the finding — resolve it before committing, or record it
as a documented divergence in SPEC.md with a test asserting what each
side actually answers.
