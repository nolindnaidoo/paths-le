/**
 * Pseudo-schemes that are never file paths.
 *
 * Matched case-insensitively and past leading whitespace because HTML
 * attribute values and CSS `url()` arguments are neither case-normalised nor
 * trimmed by the parsers — `JavaScript:` and ` vbscript:` are both valid in
 * markup and were previously extracted as paths. That was a real finding
 * (CodeQL `js/incomplete-url-scheme-check`), not a hypothetical.
 *
 * Defined once rather than per-extractor: the HTML and CSS parsers each
 * carried an identical copy, with comments pointing at each other. Adding a
 * scheme to one and not the other would reintroduce exactly the bug this
 * guards against, in one format only, and the two extractors are tested
 * separately so nothing would catch it.
 *
 * The JavaScript extractor does not use this and does not need to: it works
 * from an allow-list of shapes that count as module paths, so an unrecognised
 * scheme is excluded by construction.
 */
const NON_PATH_SCHEME = /^\s*(?:data|javascript|vbscript):/i;

export function isExcludedScheme(value: string): boolean {
	return NON_PATH_SCHEME.test(value);
}
