//! What format a document is, from a language id or a filename.
//!
//! Two layers, matching the extension's split. `determine_file_type`
//! accepts VS Code language ids and nothing else, because that is what
//! the extension's engine accepts and its behaviour is pinned by the
//! corpus. `resolve_format` widens: an agent or a shell sends `yml`,
//! `.env`, `jsx` or `tsconfig.json`, and widening happens here rather
//! than in the engine.
//!
//! **Nothing fails to resolve.** A name neither layer recognises lands
//! on the generic scan rather than on a refusal, so a Python file, a
//! Dockerfile and a `.md` are read instead of being turned away. What is
//! lost is the typo guard — `--format jso` now scans generically instead
//! of being refused — and what replaces it is the report, which names
//! the format it actually used on every line.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum FileType {
    Json,
    Javascript,
    Typescript,
    Html,
    Css,
    Csv,
    Toml,
    Dotenv,
    Yaml,
    Unknown,
}

pub(crate) fn determine_file_type(language_id: &str) -> FileType {
    match language_id {
        "csv" => FileType::Csv,
        "toml" => FileType::Toml,
        "dotenv" | "env" => FileType::Dotenv,
        "javascript" | "javascriptreact" => FileType::Javascript,
        "typescript" | "typescriptreact" => FileType::Typescript,
        "json" | "jsonc" => FileType::Json,
        "html" => FileType::Html,
        "css" | "scss" | "less" => FileType::Css,
        "yaml" => FileType::Yaml,
        _ => FileType::Unknown,
    }
}

/// The formats a caller can name, for the MCP tool schema's enum.
/// Byte-identical to the npm server's `SUPPORTED_FORMATS`, in the same
/// order, because both appear in a message the corpus pins.
///
/// `markdown` is here and `xml` is not, even though both are read by the
/// generic scan: `markdown` is a format an agent asks for by name, and
/// the enum is what tells it the ask is understood. Anything absent from
/// this list still resolves — the enum advertises, it does not gate.
pub(crate) const SUPPORTED_FORMATS: [&str; 10] = [
    "csv",
    "toml",
    "dotenv",
    "javascript",
    "typescript",
    "json",
    "html",
    "css",
    "yaml",
    "markdown",
];

/// What the engine uses when it recognises nothing.
///
/// **`unknown`, not `fallback`.** The extension's `determineFileType`
/// already answers `unknown` for a language it has no extractor for, and
/// the name is user-visible: it is the `fileType` every MCP answer
/// carries and the `format` every audit report carries, so a second name
/// here would be the two frontends disagreeing on a field in plain
/// sight.
pub(crate) const FALLBACK_FORMAT: &str = "unknown";

/// Every language id the engine understands, keyed by what a caller
/// might send. Mirrors `src/mcp/fileType.ts`.
///
/// `markdown` and `xml` map to themselves and then to the generic scan.
/// They earn a row because the row is what puts the real name in the
/// report — a `.md` file reads as `markdown` rather than as `unknown`,
/// which is the difference between "scanned generically" and "not
/// recognised at all".
const ALIASES: [(&str, &str); 31] = [
    ("csv", "csv"),
    ("tsv", "csv"),
    ("toml", "toml"),
    ("dotenv", "dotenv"),
    ("env", "dotenv"),
    ("javascript", "javascript"),
    ("js", "javascript"),
    ("jsx", "javascript"),
    ("mjs", "javascript"),
    ("cjs", "javascript"),
    ("javascriptreact", "javascript"),
    ("typescript", "typescript"),
    ("ts", "typescript"),
    ("tsx", "typescript"),
    ("mts", "typescript"),
    ("cts", "typescript"),
    ("typescriptreact", "typescript"),
    ("json", "json"),
    ("jsonc", "json"),
    ("html", "html"),
    ("htm", "html"),
    ("xhtml", "html"),
    ("css", "css"),
    ("scss", "scss"),
    ("sass", "scss"),
    ("less", "less"),
    ("yaml", "yaml"),
    ("yml", "yaml"),
    ("markdown", "markdown"),
    ("md", "markdown"),
    ("xml", "xml"),
];

/// `value.trim().toLowerCase().replace(/^\./, '')`, and the trim is
/// JavaScript's on purpose: Rust's strips U+0085 and keeps U+FEFF, and
/// the extension's does the opposite. A format name arrives from an
/// agent or a shell, so a stray invisible character around it is exactly
/// the input that would have the two servers resolve one name two ways.
fn normalise(value: &str) -> String {
    let trimmed = super::js::trim(value).to_lowercase();
    trimmed.strip_prefix('.').unwrap_or(&trimmed).to_string()
}

fn alias(key: &str) -> Option<&'static str> {
    ALIASES
        .iter()
        .find(|(from, _)| *from == key)
        .map(|(_, to)| *to)
}

/// Resolve a language id from an explicit format, else from a filename,
/// else the generic scan.
///
/// A caller who knows nothing about a document still gets its paths,
/// which is the difference between a tool that can be pointed at a
/// repository and one that has to have the repository described to it
/// first.
pub(crate) fn resolve_format(format: Option<&str>, filename: Option<&str>) -> &'static str {
    if let Some(format) = format
        && let Some(direct) = alias(&normalise(format))
    {
        return direct;
    }

    let Some(filename) = filename else {
        return FALLBACK_FORMAT;
    };
    // A dotfile like `.env` has no extension to split on; its whole name
    // is the type, which is exactly the case a caller sends most often.
    let bare = normalise(filename);
    if let Some(whole) = alias(bare.strip_prefix('.').unwrap_or(&bare)) {
        return whole;
    }

    filename
        .rsplit_once('.')
        .and_then(|(_, extension)| alias(&normalise(extension)))
        .unwrap_or(FALLBACK_FORMAT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn language_ids_map_to_file_types() {
        assert_eq!(determine_file_type("json"), FileType::Json);
        assert_eq!(determine_file_type("jsonc"), FileType::Json);
        assert_eq!(determine_file_type("typescriptreact"), FileType::Typescript);
        assert_eq!(determine_file_type("scss"), FileType::Css);
        assert_eq!(determine_file_type("env"), FileType::Dotenv);
        assert_eq!(determine_file_type("yaml"), FileType::Yaml);
        assert_eq!(determine_file_type("python"), FileType::Unknown);
    }

    #[test]
    fn an_explicit_format_wins() {
        assert_eq!(resolve_format(Some("tsx"), None), "typescript");
        assert_eq!(resolve_format(Some(".TOML"), None), "toml");
        assert_eq!(resolve_format(Some(" js "), None), "javascript");
    }

    /// A format name is trimmed with JavaScript's whitespace set, not
    /// Rust's. The two disagree about exactly two characters, and a name
    /// wrapped in one of them would otherwise resolve on one server and
    /// fall through to the generic scan on the other.
    #[test]
    fn a_format_name_is_trimmed_with_javascripts_whitespace() {
        assert_eq!(resolve_format(Some("\u{feff}json\u{feff}"), None), "json");
        assert_eq!(
            resolve_format(Some("\u{85}json"), None),
            FALLBACK_FORMAT,
            "U+0085 is not whitespace to JavaScript, so it is part of the name"
        );
    }

    #[test]
    fn a_filename_resolves_by_extension() {
        assert_eq!(resolve_format(None, Some("tsconfig.json")), "json");
        assert_eq!(resolve_format(None, Some("a/b/style.SCSS")), "scss");
    }

    /// The highest-value addition: every CI config, Kubernetes manifest
    /// and compose file in a repository is one of these two extensions.
    #[test]
    fn yaml_resolves_under_both_spellings() {
        assert_eq!(resolve_format(None, Some("ci.yml")), "yaml");
        assert_eq!(resolve_format(None, Some("deployment.yaml")), "yaml");
        assert_eq!(resolve_format(Some("yml"), None), "yaml");
    }

    /// The case a caller sends most often, and the one an extension
    /// split would get wrong.
    #[test]
    fn a_dotfile_resolves_by_its_whole_name() {
        assert_eq!(resolve_format(None, Some(".env")), "dotenv");
        assert_eq!(resolve_format(None, Some("env")), "dotenv");
    }

    #[test]
    fn an_unrecognised_format_falls_through_to_the_filename() {
        assert_eq!(resolve_format(Some("python"), Some("a.json")), "json");
    }

    /// Not a refusal and not an empty result — the generic scan. This is
    /// the property the whole file-type widening rests on.
    #[test]
    fn nothing_recognisable_falls_back() {
        for name in ["python", "rust", "", "jso"] {
            assert_eq!(resolve_format(Some(name), None), FALLBACK_FORMAT, "{name}");
        }
        assert_eq!(resolve_format(None, Some("script.py")), FALLBACK_FORMAT);
        assert_eq!(resolve_format(None, Some("Makefile")), FALLBACK_FORMAT);
        assert_eq!(resolve_format(None, None), FALLBACK_FORMAT);
    }

    /// The fallback name is itself a language id the engine accepts, or
    /// a report's `format` field would name something that cannot be
    /// fed back in.
    #[test]
    fn the_fallback_name_round_trips() {
        assert_eq!(determine_file_type(FALLBACK_FORMAT), FileType::Unknown);
    }

    /// Every format the schema advertises must actually resolve to
    /// itself, or the enum promises something the engine reads
    /// differently.
    #[test]
    fn every_advertised_format_resolves_to_itself() {
        for format in SUPPORTED_FORMATS {
            assert_eq!(resolve_format(Some(format), None), format, "{format}");
        }
    }

    /// Every alias must land on a language id the engine dispatches on —
    /// a typed extractor, or the generic scan named as such. An alias
    /// landing anywhere else would accept a format and then read the
    /// document as something it is not.
    #[test]
    fn every_alias_lands_on_a_language_the_engine_dispatches() {
        for (from, to) in ALIASES {
            let generic = determine_file_type(to) == FileType::Unknown;
            assert!(
                !generic || matches!(to, "markdown" | "xml"),
                "{from} -> {to} is neither typed nor a declared generic scan"
            );
        }
    }
}
