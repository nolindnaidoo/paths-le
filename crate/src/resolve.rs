//! The filesystem half: does this path still point at anything?
//!
//! **This is the only module allowed to touch the filesystem.** It has
//! no equivalent in the extension and is therefore outside parity
//! scope — see SPEC.md, "Resolution — the enhancement". It is also the
//! reason this crate exists rather than being the extension with a
//! different front door: extracting a path string is something an
//! editor can do, and deciding whether it points at anything is not.
//!
//! Every verdict here is checkable by hand against the same filesystem.
//! A claim that cannot be checked that way does not belong in this
//! module.

use std::path::{Component, Path as StdPath, PathBuf};

use serde::Serialize;

use crate::extract::PathType;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum Verdict {
    Ok,
    Symlinked,
    NonCanonical,
    Missing,
    EscapesRoot,
    Unresolved,
}

impl Verdict {
    /// Whether this verdict counts against the exit code.
    ///
    /// **`non-canonical` counts by default**, and that follows the
    /// extension rather than a preference. `normalizePath` in
    /// `src/utils/pathResolver.ts` *is* the definition of canonical form
    /// — separators forward, duplicates collapsed, no trailing slash —
    /// and `path.resolve` collapses embedded traversal on top of it. A
    /// path that deviates is one the extension would have rewritten, so
    /// an audit that stayed quiet about it would be withholding the
    /// thing it was asked for.
    ///
    /// **`symlinked` counts only when asked.** The extension pairs
    /// symlink resolution with canonicalisation as one ordinary step,
    /// not as an anomaly, so a link is a fact by default. It is also the
    /// thing some trusted-environment audits exist to catch, which is
    /// why `deny_symlinks` exists at all rather than the answer being
    /// "grep the JSON".
    pub(crate) fn is_finding(self, deny_symlinks: bool) -> bool {
        match self {
            Verdict::Missing | Verdict::EscapesRoot | Verdict::NonCanonical => true,
            Verdict::Symlinked => deny_symlinks,
            Verdict::Ok | Verdict::Unresolved => false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub(crate) struct Resolution {
    pub(crate) verdict: Verdict,
    /// Where the path points, resolved as far as it could be: the
    /// filesystem's own canonical form when the target exists, and the
    /// lexically-resolved absolute path when it does not — so a
    /// `missing` verdict still says *where* it looked.
    pub(crate) canonical: Option<String>,
    /// The link target, when the path itself is a symlink. Present
    /// whatever the verdict, so a broken link still names what it
    /// pointed at.
    pub(crate) symlink: Option<String>,
    pub(crate) reason: Option<String>,
}

impl Resolution {
    pub(crate) fn unresolved(reason: &str) -> Self {
        Self {
            verdict: Verdict::Unresolved,
            canonical: None,
            symlink: None,
            reason: Some(reason.to_string()),
        }
    }
}

/// Resolve one extracted path.
///
/// `base_dir` is the directory of the file the path was found in, never
/// the working directory — that is what the path means to the code that
/// contains it. `root` is the boundary a relative path may not escape,
/// and must already be absolute and canonical, or the escape check
/// compares two different spellings of the same directory.
pub(crate) fn resolve(
    value: &str,
    kind: PathType,
    base_dir: &StdPath,
    root: &StdPath,
) -> Resolution {
    if kind == PathType::Url {
        return Resolution::unresolved("not a filesystem path");
    }
    if value.starts_with('#') {
        return Resolution::unresolved("a fragment, not a filesystem path");
    }
    // Extraction classifies only http, https and file as `url`, so
    // `ftp://`, `postgresql://`, `mongodb://` and `git+https://` arrive
    // here looking like paths with slashes in them. Anything carrying a
    // scheme is a locator for something that is not this filesystem,
    // whatever the scheme happens to be.
    if value.contains("://") {
        return Resolution::unresolved("a scheme-qualified locator, not a filesystem path");
    }
    if is_windows_path(value) && !cfg!(windows) {
        return Resolution::unresolved("a Windows path, not resolvable on this platform");
    }

    let absolute = StdPath::new(value).is_absolute();
    let target = if absolute {
        lexical_normalise(StdPath::new(value))
    } else {
        lexical_normalise(&base_dir.join(value))
    };

    // An absolute path is absolute by intent; it is not "escaping"
    // anything. Flagging every absolute path as an escape would be
    // noise dressed as rigour, and it would fire on every well-formed
    // reference to /etc or /var in a config file.
    if !absolute && !target.starts_with(root) {
        return Resolution {
            verdict: Verdict::EscapesRoot,
            canonical: Some(display(&target)),
            symlink: None,
            reason: Some(format!("resolves outside {}", display(root))),
        };
    }

    let link = std::fs::symlink_metadata(&target)
        .ok()
        .and_then(|metadata| {
            metadata
                .file_type()
                .is_symlink()
                .then(|| std::fs::read_link(&target).ok())
                .flatten()
        });
    let symlink = link.as_deref().map(display);

    let found = std::fs::canonicalize(&target)
        .ok()
        .map(|canonical| (canonical, None))
        .or_else(|| probe_extensions(&target).map(|(path, name)| (path, Some(name))));

    let Some((canonical, probed)) = found else {
        // A link is the exception to everything below: `symlink_metadata`
        // succeeding is proof the value named something real, whatever
        // its shape, so a broken one is a finding rather than a shrug.
        if symlink.is_none() && !commits_to_being_a_path(value) {
            return Resolution::unresolved(
                "nothing here by that name, and the value does not commit to being a path — \
                 no leading ./ and no file extension, so its absence is not evidence",
            );
        }
        let reason = if symlink.is_some() {
            "a broken symlink".to_string()
        } else {
            "no such file or directory".to_string()
        };
        return Resolution {
            verdict: Verdict::Missing,
            canonical: Some(display(&target)),
            symlink,
            reason: Some(reason),
        };
    };

    if let Some(name) = probed {
        // Reported rather than silently absorbed: the caller asked
        // about `./dedupe` and got an answer about `dedupe.ts`, and
        // that substitution has to be visible to be checkable.
        return Resolution {
            verdict: Verdict::Ok,
            canonical: Some(display(&canonical)),
            symlink,
            reason: Some(format!("written without an extension; resolved to {name}")),
        };
    }

    if let Some(reason) = non_canonical_reason(value) {
        return Resolution {
            verdict: Verdict::NonCanonical,
            canonical: Some(display(&canonical)),
            symlink,
            reason: Some(reason),
        };
    }

    if symlink.is_some() {
        return Resolution {
            verdict: Verdict::Symlinked,
            canonical: Some(display(&canonical)),
            symlink,
            reason: None,
        };
    }

    Resolution {
        verdict: Verdict::Ok,
        canonical: Some(display(&canonical)),
        symlink: None,
        reason: None,
    }
}

/// Whether the written form commits to being a path at all.
///
/// **`missing` is a claim, and a claim needs evidence.** Extraction is
/// generous by design — it hands over anything shaped vaguely like a
/// path, because in an editor a human glances at the list and moves on.
/// A resolver cannot be that generous: saying `image/png` or
/// `io.github.you/tool` is a missing file is answering confidently and
/// wrongly, and enough of those get the tool switched off.
///
/// So a value earns a `missing` verdict two ways, and only two:
///
/// - **It says it is a path**: `./x`, `../x`, `/x`, `C:\x`.
/// - **It carries a file extension after a separator**: `src/app.ts`,
///   `images/bg.png`.
///
/// Everything else — `image/png`, `text/html`, `@heroui/styles`,
/// `io.github.you/tool`, `^1.101.0`, `example.com`, a localised string
/// with a slash in it — still resolves to `ok` when something is
/// actually there, and comes back `unresolved` when it is not. Nothing
/// true is lost: only the unprovable negative.
///
/// The cost, stated plainly: an extensionless path written without a
/// leading `./`, like `docs/api`, is no longer reported when it goes
/// missing. That shape is also how bare module specifiers are written,
/// which this tool refuses to resolve for the same reason.
fn commits_to_being_a_path(value: &str) -> bool {
    if is_composite(value) {
        return false;
    }
    if value.starts_with("./")
        || value.starts_with("../")
        || value.starts_with('/')
        || is_windows_path(value)
    {
        return true;
    }
    let Some((_, last)) = value.rsplit_once(['/', '\\']) else {
        return false;
    };
    // A dot anywhere but the very end: `bg.png` yes, `paths-le` no,
    // `png` no, `trailing.` no.
    last.rsplit_once('.')
        .is_some_and(|(stem, extension)| !stem.is_empty() && !extension.is_empty())
}

/// Whether a colon makes the value several things joined, rather than
/// one path.
///
/// A colon is the separator everything on Unix reaches for once it needs
/// to write two paths in one string: a compose volume
/// (`/etc/localtime:/etc/localtime:ro`), a `PATH` entry
/// (`/usr/bin:/usr/local/bin`), an `scp` target, a `file:line` reference.
/// Each of those starts with `/` and so *says* it is a path, which is
/// enough evidence for `missing` — and the claim is then false about a
/// string that was never one path.
///
/// Found by running the binary over a repository of compose files: five
/// findings, all five wrong, in the format the YAML extractor was added
/// for. The value is still reported and still resolves to `ok` if
/// something by that whole name is really there; only the unprovable
/// negative is withheld, which is the same trade the rule above makes.
///
/// The drive letter is the exception it has to make room for: `C:\Temp`
/// is one path with a colon in it, and it is the only shape that is.
fn is_composite(value: &str) -> bool {
    let tail = if is_windows_path(value) {
        &value[2..]
    } else {
        value
    };
    tail.contains(':')
}

/// Extensions a module specifier written without one can resolve to.
///
/// **This is filesystem probing, not module resolution.** Every answer
/// it gives is a file you can `ls` — which is the line this tool does
/// not cross. `tsconfig` path maps, bundler aliases and `node_modules`
/// lookup stay out of scope, as SPEC.md says, because those need a
/// config file to be right about and getting them half-right produces
/// confident wrong answers.
///
/// Without this, every relative import in a TypeScript codebase —
/// `./dedupe`, `../ui/notifier` — reports as a missing file, which is
/// most of the paths in most repositories this will ever be pointed at.
const MODULE_EXTENSIONS: [&str; 7] = ["ts", "tsx", "js", "jsx", "mjs", "cjs", "json"];

/// The file a written-without-an-extension path actually names, with
/// the name it was found under. `None` when nothing matches, which is
/// then a real `missing`.
fn probe_extensions(target: &StdPath) -> Option<(PathBuf, String)> {
    // The candidate is the written name **plus** an extension, never
    // the written name with its own extension replaced. That keeps
    // `./gone.ts` a true finding — it probes `gone.ts.ts`, which is not
    // there — while still resolving `./tool-facts.generated`, whose
    // last segment contains a dot that is not an extension at all.
    // Gating on `Path::extension().is_some()` looked equivalent and was
    // not: it refused to probe exactly that case.
    //
    // No `index.<ext>` pass, deliberately. For `./feature/index.ts` to
    // be reachable, `./feature` must be a directory that exists — and
    // then the caller already resolved it as itself, one branch up.
    // A probe that can never fire is a claim the code does not back.
    let file_name = target.file_name()?.to_str()?.to_string();
    MODULE_EXTENSIONS.iter().find_map(|extension| {
        let name = format!("{file_name}.{extension}");
        std::fs::canonicalize(target.with_file_name(&name))
            .ok()
            .map(|canonical| (canonical, name))
    })
}

/// Why the written form is ambiguous, or `None` when it is not.
///
/// A leading `./` or `../` is idiomatic and is deliberately *not* a
/// reason: flagging it would fire on every relative import in every
/// codebase, and a check that fires everywhere is a check nobody reads.
fn non_canonical_reason(value: &str) -> Option<String> {
    if value.contains("//") {
        return Some("contains a duplicate separator".to_string());
    }
    if value.len() > 1 && value.ends_with('/') {
        return Some("ends with a separator".to_string());
    }
    // Both separators, not merely one. A path that uses only
    // backslashes is ordinary on Windows — `src\\lib\\a.ts` is how it is
    // written there — and `std::fs::canonicalize` hands back a verbatim
    // `\\\\?\\C:\\...` prefix, so testing for a single backslash called
    // every absolute path on Windows non-canonical.
    if value.contains('\\') && value.contains('/') {
        return Some("mixes backslash and forward-slash separators".to_string());
    }
    has_embedded_traversal(value).then(|| "traverses upward mid-path".to_string())
}

/// A `..` segment that appears after a segment which is not itself
/// `..` — `a/../b`, but not `../../a`. The leading run is how a
/// relative path reaches its sibling; the embedded one is how a path
/// stops meaning what it looks like it means.
fn has_embedded_traversal(value: &str) -> bool {
    let mut seen_named_segment = false;
    for segment in value.split('/') {
        match segment {
            ".." if seen_named_segment => return true,
            ".." | "." | "" => {}
            _ => seen_named_segment = true,
        }
    }
    false
}

fn is_windows_path(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(letter) = chars.next() else {
        return false;
    };
    letter.is_ascii_alphabetic()
        && chars.next() == Some(':')
        && matches!(chars.next(), Some('/' | '\\'))
}

/// Resolve `.` and `..` without touching the filesystem.
///
/// Lexical on purpose. Canonicalising here would follow symlinks, so a
/// directory that is a link out of the tree would read as an escape —
/// which is a different finding, reported by a different verdict, and
/// conflating the two would make both untrustworthy.
fn lexical_normalise(path: &StdPath) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// A path as the report writes it: **separators forward, on every
/// platform**.
///
/// Windows spells them `\`, and `canonicalize` hands back a `\\?\`
/// verbatim prefix on top. Either one puts a spelling in the report that
/// the same report taken on another machine cannot be diffed against,
/// and the paths this tool extracts are written with `/` in the source
/// it read them from — so a Windows run would answer in a different
/// alphabet from the document it was answering about.
///
/// The rewrite is Windows-only, deliberately: `\` is a legal character
/// in a Unix filename, and rewriting it there would rename the file in
/// the report.
pub(crate) fn display(path: &StdPath) -> String {
    let rendered = path.to_string_lossy();
    if cfg!(windows) {
        return forward_slashes(&rendered);
    }
    rendered.into_owned()
}

/// The directory `path` sits in, as a path a syscall will accept.
///
/// `Path::parent` answers `Some("")` for a bare filename rather than
/// `None`, so the obvious `parent().unwrap_or(".")` never fires and
/// hands back an empty path instead. Nothing accepts one: `paths-le
/// a.yaml` failed with an error that named no file, and every relative
/// path inside such a file resolved against an empty base and came back
/// `escapes-root` — a file that was there and a file that was not got
/// the same verdict. Naming a file and naming its directory must agree.
pub(crate) fn parent_dir(path: &StdPath) -> PathBuf {
    match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent.to_path_buf(),
        _ => PathBuf::from("."),
    }
}

/// The Windows half of `display`, written as a pure string function so
/// that every platform compiles and tests it. A branch only Windows can
/// execute is a branch only Windows CI can catch.
fn forward_slashes(rendered: &str) -> String {
    let bare = match rendered.strip_prefix(r"\\?\UNC\") {
        // `\\?\UNC\server\share` is `\\server\share` written the long
        // way, so dropping the whole prefix would lose the host.
        Some(tail) => format!(r"\\{tail}"),
        None => rendered
            .strip_prefix(r"\\?\")
            .unwrap_or(rendered)
            .to_string(),
    };
    bare.replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testing::TempTree;

    fn resolve_in(tree: &TempTree, value: &str) -> Resolution {
        resolve(value, PathType::Relative, tree.path(), tree.path())
    }

    /// The empty parent is the whole bug: `Path::parent` reports
    /// `Some("")` for a bare filename, and an empty path is one no
    /// syscall accepts and one no relative path can be joined onto.
    #[test]
    fn a_bare_filename_has_the_working_directory_for_a_parent() {
        assert_eq!(parent_dir(StdPath::new("a.yaml")), PathBuf::from("."));
        assert_eq!(parent_dir(StdPath::new("./a.yaml")), PathBuf::from("."));
        assert_eq!(parent_dir(StdPath::new("src/a.yaml")), PathBuf::from("src"));
        assert_eq!(parent_dir(StdPath::new("/a.yaml")), PathBuf::from("/"));
    }

    /// The Windows rewrite, tested on every platform. envsync-le shipped
    /// `\` in its reports for a release because the only machine that
    /// could see the bug was the only machine nothing asserted on.
    #[test]
    fn a_reported_path_spells_its_separators_forward() {
        assert_eq!(
            forward_slashes(r"C:\Users\me\src\app.ts"),
            "C:/Users/me/src/app.ts"
        );
        assert_eq!(forward_slashes(r"\\?\C:\a\b.txt"), "C:/a/b.txt");
        assert_eq!(
            forward_slashes(r"\\?\UNC\host\share\a.txt"),
            "//host/share/a.txt"
        );
        assert_eq!(forward_slashes(r"\\host\share\a.txt"), "//host/share/a.txt");
        assert_eq!(forward_slashes("already/forward.ts"), "already/forward.ts");
    }

    /// A Unix filename may legally contain a backslash, so the rewrite
    /// must not run there — renaming a file in the report would be worse
    /// than an unfamiliar separator.
    #[cfg(unix)]
    #[test]
    fn a_backslash_in_a_unix_filename_survives_the_report() {
        assert_eq!(display(StdPath::new(r"/tmp/od\d.txt")), r"/tmp/od\d.txt");
    }

    #[test]
    fn an_existing_file_is_ok() {
        let tree = TempTree::new("resolve-ok");
        tree.write("a/b.txt", "x");
        let resolution = resolve_in(&tree, "./a/b.txt");
        assert_eq!(resolution.verdict, Verdict::Ok);
        assert!(resolution.canonical.is_some());
        assert_eq!(resolution.symlink, None);
    }

    #[test]
    fn a_missing_file_says_where_it_looked() {
        let tree = TempTree::new("resolve-missing");
        let resolution = resolve_in(&tree, "./nope.txt");
        assert_eq!(resolution.verdict, Verdict::Missing);
        assert_eq!(
            resolution.reason.as_deref(),
            Some("no such file or directory")
        );
        assert!(
            resolution
                .canonical
                .expect("a target")
                .ends_with("nope.txt"),
            "the report must say where it looked"
        );
    }

    #[test]
    fn a_relative_path_resolves_against_the_file_not_the_working_directory() {
        let tree = TempTree::new("resolve-base");
        tree.write("pkg/inner/x.txt", "x");
        let base = tree.path().join("pkg/inner");
        let resolution = resolve("./x.txt", PathType::Relative, &base, tree.path());
        assert_eq!(resolution.verdict, Verdict::Ok);
    }

    #[test]
    fn a_relative_path_that_climbs_out_of_the_root_is_a_finding() {
        let tree = TempTree::new("resolve-escape");
        tree.write("pkg/x.txt", "x");
        let base = tree.path().join("pkg");
        let resolution = resolve("../../outside.txt", PathType::Relative, &base, tree.path());
        assert_eq!(resolution.verdict, Verdict::EscapesRoot);
        assert!(resolution.reason.expect("a reason").contains("outside"));
    }

    /// Climbing and coming back is not an escape — it never leaves.
    #[test]
    fn climbing_within_the_root_is_not_an_escape() {
        let tree = TempTree::new("resolve-climb");
        tree.write("a/x.txt", "x");
        let base = tree.path().join("b");
        std::fs::create_dir_all(&base).expect("a directory");
        let resolution = resolve("../a/x.txt", PathType::Relative, &base, tree.path());
        assert_eq!(resolution.verdict, Verdict::Ok);
    }

    /// The rule is a *mix* of separators, not the presence of a
    /// backslash. `std::fs::canonicalize` on Windows hands back a
    /// verbatim `\\?\C:\...` prefix, so testing for one backslash
    /// called every absolute path there non-canonical — which is how
    /// this was found, on a Windows CI job and nowhere else.
    #[test]
    fn a_backslash_alone_is_not_non_canonical() {
        assert_eq!(non_canonical_reason(r"\\?\C:\tmp\x.txt"), None);
        assert_eq!(non_canonical_reason(r"src\lib\a.ts"), None);
        assert_eq!(non_canonical_reason(r"C:\tmp\x.txt"), None);
    }

    #[test]
    fn genuinely_mixed_separators_are_non_canonical() {
        assert_eq!(
            non_canonical_reason(r"src\lib/a.ts").as_deref(),
            Some("mixes backslash and forward-slash separators")
        );
    }

    /// An absolute path is absolute by intent, so it is judged on
    /// existence alone however far outside the root it points.
    #[test]
    fn an_absolute_path_never_escapes() {
        let tree = TempTree::new("resolve-absolute");
        tree.write("x.txt", "x");
        let outside = tree.path().join("x.txt");
        let inner_root = tree.path().join("inner");
        std::fs::create_dir_all(&inner_root).expect("a directory");
        let resolution = resolve(
            &outside.to_string_lossy(),
            PathType::Absolute,
            &inner_root,
            &inner_root,
        );
        assert_eq!(resolution.verdict, Verdict::Ok);
    }

    #[test]
    fn a_url_is_never_resolved() {
        let tree = TempTree::new("resolve-url");
        let resolution = resolve(
            "https://example.com/a",
            PathType::Url,
            tree.path(),
            tree.path(),
        );
        assert_eq!(resolution.verdict, Verdict::Unresolved);
        assert_eq!(resolution.reason.as_deref(), Some("not a filesystem path"));
    }

    /// An HTML `href="#section"` reaches the resolver as an ordinary
    /// value. Resolving it would report a missing file for something
    /// that was never a file, which is the kind of false finding that
    /// gets a tool switched off.
    #[test]
    fn a_fragment_is_never_resolved() {
        let tree = TempTree::new("resolve-fragment");
        let resolution = resolve("#section", PathType::Unknown, tree.path(), tree.path());
        assert_eq!(resolution.verdict, Verdict::Unresolved);
    }

    #[test]
    fn a_windows_path_is_unresolved_off_windows() {
        let tree = TempTree::new("resolve-windows");
        let resolution = resolve(
            r"C:\Temp\x.txt",
            PathType::Absolute,
            tree.path(),
            tree.path(),
        );
        if cfg!(windows) {
            assert_eq!(resolution.verdict, Verdict::Missing);
        } else {
            assert_eq!(resolution.verdict, Verdict::Unresolved);
        }
    }

    #[test]
    fn duplicate_separators_and_trailing_slashes_are_non_canonical() {
        let tree = TempTree::new("resolve-noncanon");
        tree.write("a/b.txt", "x");
        assert_eq!(resolve_in(&tree, "a//b.txt").verdict, Verdict::NonCanonical);
        tree.write("a/dir/keep.txt", "x");
        assert_eq!(resolve_in(&tree, "a/dir/").verdict, Verdict::NonCanonical);
    }

    #[test]
    fn an_embedded_traversal_is_non_canonical_but_a_leading_one_is_not() {
        let tree = TempTree::new("resolve-traversal");
        tree.write("a/b.txt", "x");
        tree.write("c/keep.txt", "x");
        assert_eq!(
            resolve_in(&tree, "c/../a/b.txt").verdict,
            Verdict::NonCanonical
        );
        let base = tree.path().join("c");
        assert_eq!(
            resolve("../a/b.txt", PathType::Relative, &base, tree.path()).verdict,
            Verdict::Ok,
            "a leading climb is idiomatic, not a finding"
        );
    }

    #[test]
    fn a_leading_dot_slash_is_not_a_finding() {
        let tree = TempTree::new("resolve-dotslash");
        tree.write("a.txt", "x");
        assert_eq!(resolve_in(&tree, "./a.txt").verdict, Verdict::Ok);
    }

    /// The defect that made the first build unusable: every relative
    /// import in a TypeScript codebase reported as a missing file.
    #[test]
    fn an_extensionless_import_resolves_to_the_file_it_names() {
        let tree = TempTree::new("resolve-probe");
        tree.write("ui/notifier.ts", "");
        tree.write("dedupe.tsx", "");
        tree.write("legacy.js", "");
        for (written, found) in [
            ("./ui/notifier", "notifier.ts"),
            ("./dedupe", "dedupe.tsx"),
            ("./legacy", "legacy.js"),
        ] {
            let resolution = resolve_in(&tree, written);
            assert_eq!(resolution.verdict, Verdict::Ok, "{written}");
            assert_eq!(
                resolution.reason.as_deref(),
                Some(format!("written without an extension; resolved to {found}").as_str()),
                "the substitution must be visible to be checkable"
            );
        }
    }

    /// `./feature` where `feature/index.ts` exists resolves to the
    /// directory, not the index — and needs no probing to do it,
    /// because the directory is there. This pins why `probe_extensions`
    /// has no `index.<ext>` pass.
    #[test]
    fn an_extensionless_import_naming_a_directory_resolves_to_it() {
        let tree = TempTree::new("resolve-probe-index");
        tree.write("feature/index.ts", "");
        let resolution = resolve_in(&tree, "./feature");
        assert_eq!(resolution.verdict, Verdict::Ok);
        assert_eq!(
            resolution.reason, None,
            "the directory resolved as itself; nothing was substituted"
        );
    }

    /// Probing must not rescue a path that names a file outright. A
    /// missing `./gone.ts` is a real finding, and turning it into a
    /// pass would be worse than the noise it was meant to fix.
    #[test]
    fn a_path_naming_a_file_that_is_not_there_is_still_missing() {
        let tree = TempTree::new("resolve-probe-exact");
        tree.write("gone.js", "");
        assert_eq!(resolve_in(&tree, "./gone.ts").verdict, Verdict::Missing);
    }

    /// A dot in the last segment is not always an extension.
    /// `./tool-facts.generated` names `tool-facts.generated.ts`, and
    /// gating the probe on `Path::extension().is_some()` refused it —
    /// found by running the binary over a real repository.
    #[test]
    fn a_dotted_name_that_is_not_an_extension_still_probes() {
        let tree = TempTree::new("resolve-probe-dotted");
        tree.write("tool-facts.generated.ts", "");
        let resolution = resolve_in(&tree, "./tool-facts.generated");
        assert_eq!(resolution.verdict, Verdict::Ok);
        assert!(
            resolution
                .reason
                .expect("a reason")
                .contains("tool-facts.generated.ts")
        );
    }

    /// Extraction classifies only http, https and file as `url`, so
    /// every other scheme reaches the resolver looking like a path with
    /// slashes in it.
    #[test]
    fn any_scheme_qualified_locator_is_unresolved() {
        let tree = TempTree::new("resolve-schemes");
        for value in [
            "ftp://example.com/pub",
            "postgresql://user:pw@host:5432/db",
            "mongodb://host:27017/db",
            "git+https://github.com/a/b.git",
        ] {
            let resolution = resolve(value, PathType::File, tree.path(), tree.path());
            assert_eq!(resolution.verdict, Verdict::Unresolved, "{value}");
            assert_eq!(
                resolution.reason.as_deref(),
                Some("a scheme-qualified locator, not a filesystem path")
            );
        }
    }

    #[test]
    fn an_extensionless_path_with_nothing_behind_it_is_still_missing() {
        let tree = TempTree::new("resolve-probe-none");
        assert_eq!(resolve_in(&tree, "./nowhere").verdict, Verdict::Missing);
    }

    /// The values that made a healthy repository report dozens of
    /// missing files. Every one of them is something else wearing a
    /// slash: a MIME type, an npm package, an MCP server id, a secret,
    /// a localised UI string. All found by running the binary over the
    /// eleven repositories in this family.
    #[test]
    fn a_value_that_does_not_commit_to_being_a_path_is_unresolved() {
        let tree = TempTree::new("resolve-noncommittal");
        for token in [
            "image/png",
            "text/html",
            "@heroui/styles",
            "io.github.nolindnaidoo/paths-le",
            "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            "RGB/RGBA\u{306e}\u{307f}",
            "^1.101.0",
            "paths-le.extractPaths",
            "example.com",
        ] {
            let resolution = resolve(token, PathType::File, tree.path(), tree.path());
            assert_eq!(resolution.verdict, Verdict::Unresolved, "{token}");
        }
    }

    /// The useful half survives: a value that *is* there still resolves,
    /// so nothing true is lost by refusing to guess about absence.
    #[test]
    fn a_noncommittal_value_that_is_there_still_resolves() {
        let tree = TempTree::new("resolve-noncommittal-real");
        tree.write("index.js", "");
        tree.write("image/png", "");
        for token in ["index.js", "image/png"] {
            let resolution = resolve(token, PathType::File, tree.path(), tree.path());
            assert_eq!(resolution.verdict, Verdict::Ok, "{token}");
        }
    }

    /// The signal the noise reduction must not swallow: a value that
    /// does commit to being a path is still a finding when it is gone.
    #[test]
    fn a_committed_path_that_is_not_there_is_still_missing() {
        let tree = TempTree::new("resolve-committed");
        for token in ["images/bg.png", "./anything", "../up", "/etc/nope-xyz"] {
            let resolution = resolve(token, PathType::File, tree.path(), tree.path());
            assert_ne!(resolution.verdict, Verdict::Unresolved, "{token}");
        }
    }

    #[test]
    fn commitment_is_explicit_syntax_or_an_extension_after_a_separator() {
        for committed in [
            "./a",
            "../a",
            "/a",
            r"C:\a",
            "src/app.ts",
            r"src\app.ts",
            "a/b.c",
        ] {
            assert!(commits_to_being_a_path(committed), "{committed}");
        }
        for not in [
            "index.js",
            "^1.101.0",
            "a/b",
            "image/png",
            "a/b.",
            "a/.hidden",
            "",
        ] {
            assert!(!commits_to_being_a_path(not), "{not}");
        }
    }

    /// A regression, found by running the binary over a tree of compose
    /// files rather than by reading the code: every one of the five new
    /// findings the YAML extractor produced was a volume mapping, and
    /// every one of them was wrong. A composite is several things joined
    /// by a colon, so this declines to claim it is one missing path.
    #[test]
    fn a_colon_joined_composite_does_not_commit_to_being_a_path() {
        for composite in [
            "/etc/localtime:/etc/localtime:ro",
            "/var/run/docker.sock:/var/run/docker.sock",
            "./stack.conf:/redis-stack.conf:ro",
            "/usr/bin:/usr/local/bin",
            "src/app.ts:42",
        ] {
            assert!(!commits_to_being_a_path(composite), "{composite}");
        }
        // The one shape that is genuinely one path with a colon in it.
        assert!(commits_to_being_a_path(r"C:\Temp\out.txt"));
        assert!(commits_to_being_a_path("C:/Temp/out.txt"));
    }

    /// Withholding the negative is not withholding the answer: a
    /// composite that really names something still resolves.
    #[test]
    // Windows cannot hold this file at all: `:` is the drive and
    // alternate-data-stream separator, so creating `a:b.txt` fails with
    // "The system cannot find the path specified" before the resolver is
    // ever reached. The rule under test — a name containing `:` that is
    // genuinely on disk resolves rather than being dismissed as a
    // `host:path` composite — is a statement about filesystems that allow
    // the character, so it is asserted only where one does.
    #[cfg(unix)]
    fn a_composite_that_is_actually_there_still_resolves() {
        let tree = TempTree::new("resolve-composite");
        tree.write("a:b.txt", "");
        let resolution = resolve_in(&tree, "./a:b.txt");
        assert_eq!(resolution.verdict, Verdict::Ok);
    }

    /// The other half of the composite rule needs no file, so it holds on
    /// every platform: a `:` name that is not on disk stays unresolved.
    #[test]
    fn a_composite_that_is_not_there_stays_unresolved() {
        let tree = TempTree::new("resolve-composite-absent");
        let absent = resolve_in(&tree, "./nope:also-nope.txt");
        assert_eq!(absent.verdict, Verdict::Unresolved);
    }

    /// Canonicalisation is the audit; a link is a fact until asked
    /// about. Both defaults are the extension's, not a preference.
    #[test]
    fn canonicalisation_counts_by_default_and_links_count_on_request() {
        for denied in [false, true] {
            assert!(Verdict::Missing.is_finding(denied));
            assert!(Verdict::EscapesRoot.is_finding(denied));
            assert!(Verdict::NonCanonical.is_finding(denied));
            assert!(!Verdict::Ok.is_finding(denied));
            assert!(!Verdict::Unresolved.is_finding(denied));
        }
        assert!(!Verdict::Symlinked.is_finding(false));
        assert!(Verdict::Symlinked.is_finding(true));
    }

    #[cfg(unix)]
    mod unix {
        use super::*;

        #[test]
        fn a_symlink_is_reported_with_its_target() {
            let tree = TempTree::new("resolve-symlink");
            tree.write("real/file.txt", "x");
            tree.symlink("real/file.txt", "link.txt");
            let resolution = resolve_in(&tree, "link.txt");
            assert_eq!(resolution.verdict, Verdict::Symlinked);
            assert_eq!(resolution.symlink.as_deref(), Some("real/file.txt"));
            assert!(
                resolution
                    .canonical
                    .expect("a target")
                    .ends_with("file.txt"),
                "the canonical form follows the link"
            );
        }

        /// A link is a fact until someone asks about it.
        #[test]
        fn a_symlink_is_not_a_finding_unless_denied() {
            let tree = TempTree::new("resolve-symlink-ok");
            tree.write("real/file.txt", "x");
            tree.symlink("real/file.txt", "link.txt");
            let verdict = resolve_in(&tree, "link.txt").verdict;
            assert!(!verdict.is_finding(false), "a link is a fact by default");
            assert!(verdict.is_finding(true), "and a finding when denied");
        }

        /// A broken link is missing, and still names what it pointed
        /// at — which is the whole reason anyone looks.
        #[test]
        fn a_broken_symlink_is_missing_and_names_its_target() {
            let tree = TempTree::new("resolve-broken");
            tree.symlink("gone.txt", "link.txt");
            let resolution = resolve_in(&tree, "link.txt");
            assert_eq!(resolution.verdict, Verdict::Missing);
            assert_eq!(resolution.reason.as_deref(), Some("a broken symlink"));
            assert_eq!(resolution.symlink.as_deref(), Some("gone.txt"));
        }

        /// A directory reached through a symlink out of the tree is
        /// `symlinked`, not `escapes-root`: the written path never
        /// leaves, and conflating the two would make both verdicts
        /// unreliable.
        #[test]
        fn a_link_pointing_out_of_the_tree_is_a_link_not_an_escape() {
            let tree = TempTree::new("resolve-link-out");
            tree.write("outside/target.txt", "x");
            tree.mkdir("root");
            tree.symlink("../outside/target.txt", "root/inside.txt");
            let root = tree.path().join("root");
            let resolution = resolve("inside.txt", PathType::File, &root, &root);
            assert_eq!(resolution.verdict, Verdict::Symlinked);
        }
    }
}
