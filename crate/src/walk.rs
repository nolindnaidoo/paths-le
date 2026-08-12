//! Turning what the caller named into the list of files to examine.
//!
//! Directories are walked with ripgrep's `ignore`, so "what this tool
//! looks at" and "what ripgrep looks at" are the same answer — which is
//! the answer a person auditing a repository already has in their head.
//! A file named explicitly is always read, ignore rules included: you
//! asked for it.
//!
//! **There is no format filter, and that is now the point rather than an
//! oversight.** A file no typed extractor reads falls through to the
//! generic scan, so a `.py`, a `.yml` and a `Dockerfile` are read by the
//! walk instead of skipped by it — and naming one explicitly no longer
//! draws a refusal, because naming a file is an instruction, not a
//! question. What a file is not is decided later, by `audit.rs`, which
//! reports a non-text file rather than pretending it was clean.

use std::path::{Path as StdPath, PathBuf};

use crate::extract::format::{FALLBACK_FORMAT, resolve_format};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Target {
    pub(crate) path: PathBuf,
    /// The VS Code language id the extraction engine wants.
    pub(crate) language_id: &'static str,
}

#[derive(Debug, Clone)]
pub(crate) struct WalkOptions {
    pub(crate) hidden: bool,
    pub(crate) respect_ignore: bool,
    pub(crate) follow_symlinks: bool,
    /// Forces the format for every target, instead of inferring it from
    /// each filename.
    pub(crate) format: Option<&'static str>,
}

impl Default for WalkOptions {
    fn default() -> Self {
        Self {
            hidden: false,
            respect_ignore: true,
            follow_symlinks: false,
            format: None,
        }
    }
}

/// Collect every file to examine, in a stable order.
///
/// The sort is not cosmetic: `ignore` makes no ordering guarantee, and
/// a report whose lines move between two runs over an unchanged tree
/// cannot be diffed — which is most of what a report in CI is for.
pub(crate) fn collect(inputs: &[PathBuf], options: &WalkOptions) -> Result<Vec<Target>, String> {
    let mut targets = Vec::new();

    for input in inputs {
        let metadata =
            std::fs::metadata(input).map_err(|error| format!("{}: {error}", input.display()))?;

        if metadata.is_file() {
            // Named explicitly, so it is read whatever the ignore rules
            // say, and whatever its name suggests it is.
            targets.push(Target {
                path: input.clone(),
                language_id: options.format.unwrap_or_else(|| language_for(input)),
            });
            continue;
        }

        targets.extend(walk_directory(input, options)?);
    }

    targets.sort_by(|a, b| a.path.cmp(&b.path));
    targets.dedup();
    Ok(targets)
}

fn walk_directory(root: &StdPath, options: &WalkOptions) -> Result<Vec<Target>, String> {
    let mut builder = ignore::WalkBuilder::new(root);
    builder
        .hidden(!options.hidden)
        .git_ignore(options.respect_ignore)
        .git_global(options.respect_ignore)
        .git_exclude(options.respect_ignore)
        .ignore(options.respect_ignore)
        .parents(options.respect_ignore)
        .follow_links(options.follow_symlinks);

    let mut targets = Vec::new();
    for entry in builder.build() {
        let entry = entry.map_err(|error| format!("{}: {error}", root.display()))?;
        if !entry.file_type().is_some_and(|kind| kind.is_file()) {
            continue;
        }
        targets.push(Target {
            path: entry.path().to_path_buf(),
            language_id: options.format.unwrap_or_else(|| language_for(entry.path())),
        });
    }
    Ok(targets)
}

/// The language id a file's name implies, or the generic scan.
///
/// A name that resolves to nothing is not a reason to skip the file. It
/// is the reason the scan exists.
fn language_for(path: &StdPath) -> &'static str {
    path.file_name()
        .and_then(|name| name.to_str())
        .map_or(FALLBACK_FORMAT, |name| resolve_format(None, Some(name)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;

    fn names(targets: &[Target]) -> Vec<String> {
        targets
            .iter()
            .map(|target| {
                target
                    .path
                    .file_name()
                    .expect("a name")
                    .to_string_lossy()
                    .into_owned()
            })
            .collect()
    }

    /// Changed deliberately in 0.2.0: the walk used to yield only the
    /// formats it had an extractor for, which left four fifths of a
    /// repository unexamined. Every file is a target now, and the
    /// language id says which extractor will read it.
    #[test]
    fn a_directory_yields_every_file_and_names_what_will_read_it() {
        let tree = TempTree::new("walk-formats");
        tree.write("a.json", "{}");
        tree.write("b.toml", "");
        tree.write("c.md", "# no");
        tree.write("d.py", "pass");
        tree.write("e.yml", "a: 1");
        let targets = collect(&[tree.path().to_path_buf()], &WalkOptions::default())
            .expect("the walk succeeds");
        assert_eq!(
            names(&targets),
            ["a.json", "b.toml", "c.md", "d.py", "e.yml"]
        );
        let languages: Vec<&str> = targets.iter().map(|target| target.language_id).collect();
        assert_eq!(
            languages,
            ["json", "toml", "markdown", FALLBACK_FORMAT, "yaml"]
        );
    }

    #[test]
    fn the_order_is_stable() {
        let tree = TempTree::new("walk-order");
        for name in ["z.json", "a.json", "m.json"] {
            tree.write(name, "{}");
        }
        let first = collect(&[tree.path().to_path_buf()], &WalkOptions::default())
            .expect("the walk succeeds");
        let second = collect(&[tree.path().to_path_buf()], &WalkOptions::default())
            .expect("the walk succeeds");
        assert_eq!(names(&first), ["a.json", "m.json", "z.json"]);
        assert_eq!(first, second);
    }

    #[test]
    fn gitignored_files_are_skipped_by_default_and_walked_on_request() {
        let tree = TempTree::new("walk-ignore");
        // `.gitignore` applies inside a git repository, which is
        // ripgrep's rule and therefore this tool's — see the test below.
        tree.mkdir(".git");
        tree.write(".gitignore", "skipped.json\n");
        tree.write("skipped.json", "{}");
        tree.write("kept.json", "{}");

        let default = collect(&[tree.path().to_path_buf()], &WalkOptions::default())
            .expect("the walk succeeds");
        assert_eq!(names(&default), ["kept.json"]);

        let everything = collect(
            &[tree.path().to_path_buf()],
            &WalkOptions {
                respect_ignore: false,
                ..WalkOptions::default()
            },
        )
        .expect("the walk succeeds");
        assert_eq!(names(&everything), ["kept.json", "skipped.json"]);
    }

    /// Outside a git repository a `.gitignore` is inert, because that
    /// is what ripgrep does and matching it is the whole reason the
    /// walker uses `ignore`. Pinned so the behaviour is a decision
    /// rather than a default nobody checked.
    #[test]
    fn a_gitignore_outside_a_repository_is_inert() {
        let tree = TempTree::new("walk-ignore-nogit");
        tree.write(".gitignore", "skipped.json\n");
        tree.write("skipped.json", "{}");
        let targets = collect(&[tree.path().to_path_buf()], &WalkOptions::default())
            .expect("the walk succeeds");
        assert_eq!(names(&targets), ["skipped.json"]);
    }

    #[test]
    fn hidden_files_are_skipped_by_default_and_walked_on_request() {
        let tree = TempTree::new("walk-hidden");
        tree.write(".hidden.json", "{}");
        tree.write("shown.json", "{}");

        let default = collect(&[tree.path().to_path_buf()], &WalkOptions::default())
            .expect("the walk succeeds");
        assert_eq!(names(&default), ["shown.json"]);

        let everything = collect(
            &[tree.path().to_path_buf()],
            &WalkOptions {
                hidden: true,
                ..WalkOptions::default()
            },
        )
        .expect("the walk succeeds");
        assert_eq!(names(&everything), [".hidden.json", "shown.json"]);
    }

    /// A file named on the command line is read even when the ignore
    /// rules exclude it. Refusing it would mean the tool silently
    /// disagreed with an explicit instruction.
    #[test]
    fn an_explicitly_named_file_beats_the_ignore_rules() {
        let tree = TempTree::new("walk-explicit");
        tree.write(".gitignore", "skipped.json\n");
        let file = tree.write("skipped.json", "{}");
        let targets = collect(&[file], &WalkOptions::default()).expect("the walk succeeds");
        assert_eq!(names(&targets), ["skipped.json"]);
    }

    /// Changed deliberately in 0.2.0: naming a file used to be refused
    /// when its name implied no format. Naming a file is an instruction,
    /// and the scan is what carries it out.
    #[test]
    fn an_explicitly_named_file_of_unknown_format_is_read_by_the_scan() {
        let tree = TempTree::new("walk-unknown");
        let file = tree.write("Dockerfile", "COPY ./src /app\n");
        let targets = collect(&[file], &WalkOptions::default()).expect("the walk succeeds");
        assert_eq!(names(&targets), ["Dockerfile"]);
        assert_eq!(targets[0].language_id, FALLBACK_FORMAT);
    }

    #[test]
    fn a_forced_format_overrides_the_filename() {
        let tree = TempTree::new("walk-forced");
        let file = tree.write("notes.md", "{}");
        let targets = collect(
            &[file],
            &WalkOptions {
                format: Some("json"),
                ..WalkOptions::default()
            },
        )
        .expect("the walk succeeds");
        assert_eq!(targets[0].language_id, "json");
    }

    #[test]
    fn a_missing_input_is_refused_by_name() {
        let tree = TempTree::new("walk-missing");
        let error =
            collect(&[tree.path().join("nope")], &WalkOptions::default()).expect_err("a refusal");
        assert!(error.contains("nope"), "{error}");
    }

    #[test]
    fn a_dotfile_resolves_by_its_whole_name() {
        let tree = TempTree::new("walk-dotenv");
        tree.write(".env", "A=/x.txt\n");
        let targets = collect(
            &[tree.path().to_path_buf()],
            &WalkOptions {
                hidden: true,
                ..WalkOptions::default()
            },
        )
        .expect("the walk succeeds");
        assert_eq!(targets.len(), 1);
        assert_eq!(targets[0].language_id, "dotenv");
    }

    #[test]
    fn naming_the_same_file_twice_examines_it_once() {
        let tree = TempTree::new("walk-dedupe");
        let file = tree.write("a.json", "{}");
        let targets =
            collect(&[file.clone(), file], &WalkOptions::default()).expect("the walk succeeds");
        assert_eq!(targets.len(), 1);
    }
}
