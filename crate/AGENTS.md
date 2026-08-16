# paths-le (CLI) — engineering standards

This is the source of truth for how code in `crate/` is written, tested,
and reviewed. It applies to every contributor, human or AI-assisted. CI
(`.github/workflows/ci-crate.yml`) enforces the mechanical parts;
reviewers enforce the rest. [SPEC.md](SPEC.md) defines the product
behavior — verdicts, exit codes, the parity scope; this file is how the
code gets there. The extension at the repo root is a separate TypeScript
product with its own `AGENTS.md`.

## What this project is

The command-line and MCP frontend of Paths-LE: read the paths out of a
document, then go and look at whether they still point at anything. One
product, two frontends, one repository: the corpus (`fixtures/`) is
shared with the VS Code extension, and CI fails when either side drifts
from it.

**Status: released.** Every format, both surfaces, the resolver and the
test layers below are built and green. Releases go out through
`release-crate.yml`, which is dispatch-only and refuses a version that
crates.io already carries, has no changelog entry, would ship a tarball
missing its own corpus, or whose corpus the extension no longer
reproduces.

## Layout

```
crate/src/
├── extract/      pure: heuristics, positions, the nine format
│                 extractors and the generic scan. No filesystem,
│                 pub(crate).
├── resolve.rs    the filesystem half — canonicalize, symlinks, roots
├── walk.rs       ignore-aware tree walking and format detection
├── audit.rs      one file end to end — the only path either surface calls
├── cli.rs        the terminal surface
└── mcp/          the agent surface
```

- **`extract/` touches no filesystem.** It takes document text and a
  format and returns paths, so the entire extraction layer tests from a
  fixture file — no temp directories, no flake. It carries the **75%
  line coverage floor per module**, enforced by the `coverage` job. A
  `std::fs` call appearing there is a bug, and the `policy` job greps
  for one.
- **`resolve.rs` is the only module allowed to touch the filesystem.**
  Everything it claims is checkable by hand against the same filesystem;
  a claim that is not does not belong there.
- **Both surfaces are one implementation.** `cli.rs` and `mcp/` both call
  `audit.rs`. A surface that grows its own copy of a rule is a bug, and
  a contract test asserts the two return identical reports for the same
  tree.
- **`walk.rs` selects, it does not decide.** Its one rule — a file named
  explicitly is read whatever the ignore rules say — is why intent beats
  configuration. It applies no format filter: a file no typed extractor
  reads falls through to the generic scan, and what a file *is not* is
  decided in `audit.rs`, which drops a binary file and reports a text
  one it could not read.
- Keep modules flat. No layers, registries, managers, or services. No
  trait with a single implementation.

## Decisions already made (do not relitigate)

- **One crate, self-contained. No published `-core`, no shared crate
  with the rest of the family.** pixelcoords/pixelactions split because
  pixelactions genuinely consumes `pixelcoords-core`; there is no second
  consumer here. `extract/` as a `pub(crate)` module gives the
  architectural separation without the packaging ceremony. Where two crates in the family need the same
  thing it is copied, and nothing holds the copies equal — where they
  agree it is because the same answer was right twice, and where they
  diverge that is the point.
- **Two regex engines, on purpose.** `regex` for patterns that need no
  backtracking, because its matching cannot fail and needs no error
  path; `fancy-regex` for the extension's quote-matching patterns, which
  use backreferences `regex` cannot express. Rewriting them as
  alternations would change their behaviour on strings containing the
  other quote character. Porting verbatim is parity; rewriting is parity
  drift waiting to happen.
- **Columns count UTF-16 code units**, not bytes and not scalars,
  because that is what an editor reports and this tool's output gets
  compared against one. `fixtures/documents/unicode.json` exists solely
  to pin it.
- **JavaScript's string primitives are spelled out** in `extract/js.rs`
  rather than borrowed from Rust's. `\s` and `trim` are not the same set
  in the two languages — U+FEFF and U+0085 differ — and a file with a
  byte-order mark is ordinary.
- **Resolution is on by default; `--no-resolve` turns it off** and the
  report says so. The richer answer is the one the tool exists to give;
  the flag documents its own consequence, the way scrape-le's
  `--no-render` does.
- **`symlinked` never sets the exit code.** In a trusted environment the
  point is to see the links. A tool that treats every link as a problem
  gets muted, after which it reports nothing at all.
- **A leading `./` or `../` is not `non-canonical`.** A check that fires
  on every relative import in every codebase is a check nobody reads.
- **stdout is protocol, stderr is human. There is no `--json` flag.**
  One mode, nothing to misremember, and the human summary is a
  projection of the same reports so the two cannot drift.
- **Parity scope is extraction only** — the extension's
  `src/extraction/**`. Commands, UI, i18n, the config reader and the
  status bar are extension concerns with no CLI equivalent. The resolver
  and the walker have no extension equivalent and are outside parity in
  the other direction.

## Control-flow style

Flat over nested, guards over branches — the same rules as pixelcoords,
pixelactions and scrape-le:

- **No statement-position `else`.** Guard clauses and early `return`
  (`if !ok { return ... }` / `let Some(x) = ... else { return }`), then
  fall through to the happy path.
- **Value-position `if/else` is fine** — `let x = if cond { a } else
  { b }` is Rust's ternary.
- **`match` is fine and preferred** over any chain of condition tests on
  the same value; use match guards instead of `if/else` inside arms.
- Prefer combinators where they read cleanly: `bool::then_some`,
  `Option::map/filter/is_some_and`, `?`.
- No nesting deeper than two levels inside a function; extract a named
  helper instead.

## Hard rules

- **No inline `#[allow(...)]`** — CI greps and fails the build. Either
  fix the lint or add a visible, commented relaxation to
  `[lints.clippy]` in `Cargo.toml`.
- **Clippy pedantic, deny warnings.** `cargo clippy --all-targets --
  -D warnings` must pass exactly as CI runs it.
- **No async runtime.** This tool reads files and asks the filesystem
  about them. There is nothing to await.
- **`unsafe` is forbidden crate-wide** (`[lints.rust]`).
- **Dependencies are a cost.** Four format parsers and two regex engines
  is already more than most tools carry, and every one of them is
  justified by a comment in `Cargo.toml` — as is the reader that is
  *not* a dependency: CSV is spelled out by hand in `extract/csv.rs`,
  because no Rust reader answers a malformed quote the way the extension
  does, and no CSV library on either side can both name which
  malformation happened and let a no-break space through. The extension
  carries the same reader in TypeScript; the two are held equal by
  `fixtures/mcp-extract-paths.json`. Justify any addition; prefer the
  standard library; prefer what is already in the tree.
- **No network, ever.** An `https://` path is classified and left alone.
  There is no telemetry.
- **Nothing writes.** No `--fix`, no rewriting, no temp files outside
  the test helpers. A tool that edits source needs a confirmation story
  this one has not designed yet.
- **Strict parsing, never silent defaults.** An unrecognised flag, a
  format that does not resolve, an input that does not exist: all are
  errors with actionable messages. A typo'd `--stict` that silently did
  nothing would report a clean audit that never ran the check asked for.
- **Refuse rather than guess.** A file that cannot be read is reported
  as unexamined and the run exits 2 — never a clean result that quietly
  skipped it. Never report coverage you did not achieve.
- **Refusals speak the caller's vocabulary.** An MCP caller has no
  command line; no message aimed at one mentions `--no-resolve` or any
  other flag. A test asserts no MCP output contains `--`.
- **`extract_paths` belongs to both servers.** The npm server
  (`src/mcp/tools.ts`) and this one offer the same tool: same schema,
  same envelope, byte-identical output. `fixtures/mcp-extract-paths.json`
  runs against both, so changing one without the other fails a build.
  Every tool here returns that envelope — `{ ok, data, diagnostics,
  meta }` — where `ok` means the check ran, never that the answer was
  yes.

## The corpus contract

`fixtures/` lives inside this crate so the published package is
self-contained — `cargo package` cannot reach above its own directory.
The corpus is **not** needed to build the binary; that was checked
rather than assumed, by deleting it from an unpacked tarball and
building. It is needed to *verify*: `cargo test` on the published crate
runs every corpus case, so a consumer can check the parity claims
instead of trusting them. That is why it ships, and the release workflow
asserts it is in the tarball. It is still shared ground: the extension
reads the same files.
`../scripts/check-extraction-parity.ts` (the `parity` job in
`ci-crate.yml`) fails when the extension drifts. Changing a document or
an expectation is a behavior change for **both** frontends and needs a
CHANGELOG entry.

Where the two must disagree, the disagreement is written down in
SPEC.md and a test asserts what each side actually answers. There is no
other sanctioned way to differ.

## Testing

The bar, enforced by review:

- **`extract/`: 75% line coverage floor per module.** Everything in it
  is pure; if something is hard to test there, the design is wrong. Per
  module rather than the crate total, because a total lets one module
  slide while the others carry it.
- **The parity corpus is embedded.** Every `fixtures/` case runs as a
  unit test; the expected values are the extension's answers.
- **Exit codes belong in `tests/contracts.rs`.** They are the API —
  callers branch on them — so they are pinned by tests that drive the
  built binary against a temporary tree: no network, no privileged
  operation, so they run everywhere on every push. A new refusal adds
  its case there.
- **Anything needing the real filesystem to misbehave is
  `tests/scenarios.rs`** — symlink loops, unreadable directories, case
  folding — gated behind `PATHS_LE_SCENARIOS` and run by CI on all three
  OSes. A skipped scenario is never reported as a pass; each one says
  plainly that it did not run.
- **Every bug fix ships with a regression test** that fails before the
  fix. The `escapes-root` bug that fired on every relative path is the
  cautionary one: every unit test passed, because every one of them
  built its own canonical root. Run the binary, not only the tests.
- Tests are deterministic: no clocks, no randomness, and **no filesystem
  in `extract/` tests** — everything there runs from the corpus.

## Verification — the definition of done

All of it, exactly as CI runs it, before every push:

```bash
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
bun ../scripts/check-extraction-parity.ts   # when extraction changed
```

CI additionally builds on macOS, Windows and Linux, checks the Rust 1.88
minimum version, runs `cargo audit`, the no-inline-`#[allow]` and
no-filesystem-in-`extract/` policy jobs, the per-module coverage floor,
the gated scenarios, and parity — including on extension-side edits to
`src/extraction/**`, so neither frontend can drift green.

Six further jobs exist because something got past all of the above by
hand, and each one is runnable locally:

| job | what it holds | locally |
|---|---|---|
| `hazards` | A tree built at runtime — BOM, CRLF, NUL, invalid UTF-8, a FIFO, a symlink loop, a mode-000 file, a path over 260 characters. No panic, no hang, exit 0/1/2, never a signal. A platform that cannot express a case says so by name. | `cargo test --test hazards -- --nocapture` |
| `platform` | Separators forward in every reported path, a walk that survives a reserved device name, no file reported twice on a case-folding filesystem, a stdin refusal judged by its exit code. The suite runs under `TZ=UTC` and with `TZ` unset. | `cargo test --test platform -- --nocapture` |
| `differential` | Several hundred generated `extract_paths` calls through **both** servers, byte-identical. Scoped to the shared tool: the two *surfaces* are allowed to differ (SPEC.md, "Deliberate divergences"). | `bun ../scripts/check-extraction-differential.ts` |
| `fuzz` | 60 s per target over `is_path_like`, `classify_path_type`, `resolve_format` and the extractors. In-crate rather than `cargo-fuzz`: there is no library target, and adding one would make `extract/` public API. | `PATHS_LE_FUZZ_SECONDS=20 cargo test --bin paths-le fuzz::` |
| `budget` | A 500-file tree inside 10× a recorded local measurement, and four times the tree inside six times the clock. | `PATHS_LE_BUDGET=1 cargo test --release --test budget -- --nocapture` |
| `coverage-matrix` | One file per alias-table entry plus a dozen extensions it does not know: every one opened and reported under the format that read it. Fails on a `SUPPORTED_FORMATS` entry with no corpus case. | `cargo test --test coverage_matrix -- --nocapture` |

The alias mapping `coverage-matrix` checks is read out of
`src/extract/format.rs` rather than copied — a copy is a second source of
truth that agrees until somebody edits one of them.

A change is not done because it compiles; it is done when it is tested,
linted, documented where behavior changed (README / CHANGELOG / SPEC /
this file), and honest — claims in docs must match the code.

## Commits and pull requests

The repo root's convention applies unchanged (root `AGENTS.md`):
conventional prefix, imperative subject, body carrying the *why* —
enforced by the `commit-msg` hook and the `Commit messages` CI job.
One concern per change; if docs describe the thing you changed, update
them in the same commit. Release tags are `crate-v*`, and a release
goes out by dispatching `release-crate.yml` with its publish opt-in —
never by pushing a tag, because a crates.io version can never be
reused.
