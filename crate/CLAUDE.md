# Instructions for AI coding assistants

Read [AGENTS.md](AGENTS.md) first — it is the engineering-standards
document for this crate and the source of truth for layout, control-flow
style, the settled decisions, testing requirements, and the definition
of done. [SPEC.md](SPEC.md) defines the product behavior. AGENTS.md wins
on any conflict. The extension at the repo root is a separate product
with its own `CLAUDE.md`.

- Before declaring any change complete, run exactly what CI runs:
  `cargo fmt --all --check`,
  `cargo clippy --all-targets -- -D warnings`,
  `cargo test --locked`. All three must pass — and
  `bun ../scripts/check-extraction-parity.ts` when extraction changed.
- Never add inline `#[allow(...)]` — CI fails the build on it. Fix the
  lint, or add a commented relaxation to `[lints.clippy]` in
  `Cargo.toml`.
- New logic goes in `extract/` when it is pure (it must then be
  unit-tested, 90% module coverage floor), and in `resolve.rs` /
  `walk.rs` only when it needs the filesystem. A `std::fs` call in
  `extract/` fails a CI job.
- `fixtures/` is shared with the extension — changing it changes both
  frontends and needs a CHANGELOG entry. The extension is the reference
  implementation for extraction; a difference is a regression until
  SPEC.md says otherwise.
- Write regression tests for every bug you fix; keep unit tests free of
  clocks, randomness, and the filesystem outside `resolve`/`walk`/
  `audit`.
- **Run the binary, not only the tests.** The first `escapes-root` bug
  fired on every relative path on macOS and every unit test passed,
  because every one of them built its own canonical root. Filesystem
  behavior cannot be verified by reading code: run it, or say plainly
  that it needs a run.
