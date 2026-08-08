//! Paths-LE: find every path in a codebase and report whether it still
//! points at anything.
//!
//! Two products live in this repository. The VS Code extension at the
//! root is the reference implementation for extraction; this crate is
//! the terminal and agent frontend, and adds the half an editor cannot
//! do — resolving what it found against the filesystem it is standing
//! in. `SPEC.md` draws the line between the two, and `fixtures/` is the
//! contract that keeps the shared half honest.

mod audit;
mod cli;
mod extract;
mod mcp;
mod resolve;
mod walk;

#[cfg(test)]
mod testing;

fn main() -> std::process::ExitCode {
    cli::run()
}
