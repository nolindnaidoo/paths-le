//! The shared corpus, run against this implementation.
//!
//! `fixtures/` is the contract between the two frontends. The parity
//! script (`../scripts/check-extraction-parity.ts`) runs the extension
//! over these same files; this module runs the crate over them. Neither
//! side may be the sole author of a case, and a case that disagrees is
//! a regression until SPEC.md says otherwise.
//!
//! The files are embedded rather than read from disk so the tests pass
//! from a packaged crate, where the working directory is not this
//! repository.

use serde::Deserialize;

use super::{PathType, extract, heuristics};

const EXTRACTION: &str = include_str!("../../fixtures/extraction.json");
const HEURISTICS: &str = include_str!("../../fixtures/heuristics.json");

/// Every document the corpus refers to, by the name its cases use.
///
/// Visible to the rest of `extract/`'s tests because `fuzz.rs` seeds its
/// generator from them: a mutation of a real document reaches further
/// into the extractors than a random string does.
pub(crate) const DOCUMENTS: [(&str, &str); 14] = [
    (
        "srcset-data-uri.html",
        include_str!("../../fixtures/documents/srcset-data-uri.html"),
    ),
    (
        "paths.js",
        include_str!("../../fixtures/documents/paths.js"),
    ),
    (
        "paths.json",
        include_str!("../../fixtures/documents/paths.json"),
    ),
    (
        "comments.jsonc",
        include_str!("../../fixtures/documents/comments.jsonc"),
    ),
    (
        "unicode.json",
        include_str!("../../fixtures/documents/unicode.json"),
    ),
    (
        "paths.toml",
        include_str!("../../fixtures/documents/paths.toml"),
    ),
    (
        "paths.csv",
        include_str!("../../fixtures/documents/paths.csv"),
    ),
    (
        "paths.tsv",
        include_str!("../../fixtures/documents/paths.tsv"),
    ),
    (
        "paths.env",
        include_str!("../../fixtures/documents/paths.env"),
    ),
    (
        "paths.css",
        include_str!("../../fixtures/documents/paths.css"),
    ),
    (
        "paths.html",
        include_str!("../../fixtures/documents/paths.html"),
    ),
    (
        "paths.yml",
        include_str!("../../fixtures/documents/paths.yml"),
    ),
    (
        "paths.py",
        include_str!("../../fixtures/documents/paths.py"),
    ),
    (
        "paths.md",
        include_str!("../../fixtures/documents/paths.md"),
    ),
];

pub(crate) fn document(name: &str) -> &'static str {
    DOCUMENTS
        .iter()
        .find(|(file, _)| *file == name)
        .map_or_else(
            || panic!("the corpus refers to {name}, which is not embedded"),
            |(_, content)| *content,
        )
}

#[derive(Debug, Deserialize)]
struct ExtractionCase {
    name: String,
    file: String,
    #[serde(rename = "languageId")]
    language_id: String,
    expected: Vec<ExpectedPath>,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
struct ExpectedPath {
    value: String,
    #[serde(rename = "type")]
    kind: String,
    line: usize,
    column: usize,
    context: String,
}

#[derive(Debug, Deserialize)]
struct HeuristicsCorpus {
    #[serde(rename = "isPathLike")]
    is_path_like: Vec<PathLikeCase>,
    #[serde(rename = "classifyPathType")]
    classify_path_type: Vec<ClassifyCase>,
}

#[derive(Debug, Deserialize)]
struct PathLikeCase {
    input: String,
    expected: bool,
}

#[derive(Debug, Deserialize)]
struct ClassifyCase {
    input: String,
    expected: String,
}

fn kind_name(kind: PathType) -> &'static str {
    match kind {
        PathType::File => "file",
        PathType::Relative => "relative",
        PathType::Absolute => "absolute",
        PathType::Url => "url",
        PathType::Unknown => "unknown",
    }
}

#[test]
fn every_extraction_case_reproduces() {
    let cases: Vec<ExtractionCase> =
        serde_json::from_str(EXTRACTION).expect("the corpus is valid JSON");
    assert!(!cases.is_empty(), "the corpus is empty");

    for case in cases {
        let result = extract(document(&case.file), &case.language_id);
        assert!(result.success, "{}: {:?}", case.name, result.errors);
        let actual: Vec<ExpectedPath> = result
            .paths
            .iter()
            .map(|path| ExpectedPath {
                value: path.value.clone(),
                kind: kind_name(path.kind).to_string(),
                line: path.position.line,
                column: path.position.column,
                context: path.context.clone(),
            })
            .collect();
        assert_eq!(actual, case.expected, "{}", case.name);
    }
}

#[test]
fn every_heuristics_case_reproduces() {
    let corpus: HeuristicsCorpus =
        serde_json::from_str(HEURISTICS).expect("the corpus is valid JSON");

    for case in corpus.is_path_like {
        assert_eq!(
            heuristics::is_path_like(&case.input),
            case.expected,
            "is_path_like {:?}",
            case.input
        );
    }

    for case in corpus.classify_path_type {
        assert_eq!(
            kind_name(heuristics::classify_path_type(&case.input)),
            case.expected,
            "classify_path_type {:?}",
            case.input
        );
    }
}

/// Every embedded document must be used by a case, and every case must
/// name an embedded document. An orphan on either side means the corpus
/// is claiming coverage it does not have.
#[test]
fn the_corpus_and_the_embedded_documents_match() {
    let cases: Vec<ExtractionCase> =
        serde_json::from_str(EXTRACTION).expect("the corpus is valid JSON");
    for (name, _) in DOCUMENTS {
        assert!(
            cases.iter().any(|case| case.file == name),
            "{name} is embedded but no case uses it"
        );
    }
    for case in &cases {
        assert!(
            DOCUMENTS.iter().any(|(name, _)| *name == case.file),
            "{} names {}, which is not embedded",
            case.name,
            case.file
        );
    }
}

/// The reason `unicode.json` is in the corpus at all. Stated as its own
/// test so that deleting the document fails here with the reason,
/// rather than silently reducing coverage.
#[test]
fn the_unicode_case_pins_utf16_columns() {
    let result = extract(document("unicode.json"), "json");
    let columns: Vec<usize> = result.paths.iter().map(|p| p.position.column).collect();
    assert_eq!(
        columns,
        [11, 17],
        "columns must count UTF-16 code units; bytes would answer [12, 19]"
    );
}
