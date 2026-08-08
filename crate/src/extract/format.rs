//! What format a document is, from a language id or a filename.
//!
//! Two layers, matching the extension's split. `determine_file_type`
//! accepts VS Code language ids and nothing else, because that is what
//! the extension's engine accepts and its behaviour is pinned by the
//! corpus. `resolve_format` widens: an agent or a shell sends `yml`,
//! `.env`, `jsx` or `tsconfig.json`, and widening happens here rather
//! than in the engine.

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
        _ => FileType::Unknown,
    }
}

/// The formats a caller can name, for the MCP tool schema's enum and the
/// CLI's `--format` error message. Byte-identical to the npm server's
/// `SUPPORTED_FORMATS`, in the same order, because both appear in a
/// message the corpus pins.
pub(crate) const SUPPORTED_FORMATS: [&str; 8] = [
    "csv",
    "toml",
    "dotenv",
    "javascript",
    "typescript",
    "json",
    "html",
    "css",
];

/// Every language id the engine understands, keyed by what a caller
/// might send. Mirrors `src/mcp/fileType.ts`.
const ALIASES: [(&str, &str); 26] = [
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
];

fn normalise(value: &str) -> String {
    let trimmed = value.trim().to_lowercase();
    trimmed.strip_prefix('.').unwrap_or(&trimmed).to_string()
}

fn alias(key: &str) -> Option<&'static str> {
    ALIASES
        .iter()
        .find(|(from, _)| *from == key)
        .map(|(_, to)| *to)
}

/// Resolve a language id from an explicit format, else from a filename.
///
/// Returns `None` rather than guessing: a wrong format extracts nothing
/// and looks like a document with no paths, which is the least
/// debuggable outcome for a caller.
pub(crate) fn resolve_format(format: Option<&str>, filename: Option<&str>) -> Option<&'static str> {
    if let Some(format) = format
        && let Some(direct) = alias(&normalise(format))
    {
        return Some(direct);
    }

    let filename = filename?;
    // A dotfile like `.env` has no extension to split on; its whole name
    // is the type, which is exactly the case a caller sends most often.
    let bare = normalise(filename);
    if let Some(whole) = alias(bare.strip_prefix('.').unwrap_or(&bare)) {
        return Some(whole);
    }

    let extension = filename.rsplit_once('.').map(|(_, ext)| ext)?;
    alias(&normalise(extension))
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
        assert_eq!(determine_file_type("python"), FileType::Unknown);
    }

    #[test]
    fn an_explicit_format_wins() {
        assert_eq!(resolve_format(Some("tsx"), None), Some("typescript"));
        assert_eq!(resolve_format(Some(".TOML"), None), Some("toml"));
        assert_eq!(resolve_format(Some(" js "), None), Some("javascript"));
    }

    #[test]
    fn a_filename_resolves_by_extension() {
        assert_eq!(resolve_format(None, Some("tsconfig.json")), Some("json"));
        assert_eq!(resolve_format(None, Some("a/b/style.SCSS")), Some("scss"));
    }

    /// The case a caller sends most often, and the one an extension
    /// split would get wrong.
    #[test]
    fn a_dotfile_resolves_by_its_whole_name() {
        assert_eq!(resolve_format(None, Some(".env")), Some("dotenv"));
        assert_eq!(resolve_format(None, Some("env")), Some("dotenv"));
    }

    #[test]
    fn an_unrecognised_format_falls_through_to_the_filename() {
        assert_eq!(resolve_format(Some("python"), Some("a.json")), Some("json"));
    }

    #[test]
    fn nothing_recognisable_returns_none() {
        assert_eq!(resolve_format(Some("python"), None), None);
        assert_eq!(resolve_format(None, Some("script.py")), None);
        assert_eq!(resolve_format(None, Some("noextension")), None);
        assert_eq!(resolve_format(None, None), None);
    }

    /// Every format the schema advertises must actually resolve, or the
    /// enum promises something the engine refuses.
    #[test]
    fn every_advertised_format_resolves() {
        for format in SUPPORTED_FORMATS {
            assert!(resolve_format(Some(format), None).is_some(), "{format}");
        }
    }

    /// Every alias must land on a language id the engine understands,
    /// or a caller gets an empty result for a format that was accepted.
    #[test]
    fn every_alias_lands_on_a_known_file_type() {
        for (from, to) in ALIASES {
            assert_ne!(determine_file_type(to), FileType::Unknown, "{from} -> {to}");
        }
    }
}
