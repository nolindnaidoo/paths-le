import type { Extracted, ExtractionResult, FileType } from '../types';
import { extractFromCss } from './formats/css';
import { extractFromCsv, TAB } from './formats/csv';
import { extractFromDotenv } from './formats/dotenv';
import { extractFromFallback } from './formats/fallback';
import { extractFromHtml } from './formats/html';
import { extractFromJavaScript } from './formats/javascript';
import { extractFromJson } from './formats/json';
import { extractFromToml } from './formats/toml';
import { extractFromYaml } from './formats/yaml';

/**
 * A language with no typed extractor is read by the generic scan rather than
 * refused. The refusal it replaces — `"Path extraction is not supported for
 * ${languageId} files"` — was the honest answer while there was nothing to fall
 * through to; with a scan behind it, refusing would be declining to look at
 * four fifths of a repository.
 */
export async function extractPaths(
	content: string,
	languageId: string,
): Promise<ExtractionResult> {
	const extracted = extractPathsByFileType(
		content,
		determineFileType(languageId),
	);
	if ('refusal' in extracted) return refused(extracted.refusal);

	return Object.freeze({
		success: true,
		paths: Object.freeze(extracted.paths),
		errors: Object.freeze([]),
	});
}

/**
 * A document a format reader refused: no paths, **and the reason why**.
 *
 * An empty result carrying an empty `diagnostics` is indistinguishable from a
 * file that is genuinely clean, which is the silent miss this tool exists to
 * prevent — a malformed CSV holding `/etc/passwd` reported neither the path nor
 * a word about the malformation. The severity is `error`, so the MCP envelope
 * comes back `ok: false` and the CLI exits 2 rather than reporting a clean run.
 */
function refused(message: string): ExtractionResult {
	return Object.freeze({
		success: false,
		paths: Object.freeze([]),
		errors: Object.freeze([
			Object.freeze({
				category: 'parsing' as const,
				severity: 'error' as const,
				message,
				recoverable: false,
				recoveryAction: 'none' as const,
				timestamp: Date.now(),
			}),
		]),
	});
}

function extractPathsByFileType(
	content: string,
	fileType: FileType,
): Extracted {
	switch (fileType) {
		case 'csv':
			return extractFromCsv(content);
		case 'tsv':
			return extractFromCsv(content, TAB);
		case 'toml':
			return { paths: extractFromToml(content) };
		case 'dotenv':
			return { paths: extractFromDotenv(content) };
		case 'javascript':
		case 'typescript':
			return { paths: extractFromJavaScript(content) };
		case 'json':
			return { paths: extractFromJson(content) };
		case 'css':
			return { paths: extractFromCss(content) };
		case 'html':
			return { paths: extractFromHtml(content) };
		case 'yaml':
			return { paths: extractFromYaml(content) };
		default:
			return { paths: extractFromFallback(content) };
	}
}

function determineFileType(languageId: string): FileType {
	switch (languageId) {
		case 'csv':
			return 'csv';
		case 'tsv':
			return 'tsv';
		case 'toml':
			return 'toml';
		case 'dotenv':
		case 'env':
			return 'dotenv';
		case 'javascript':
		case 'javascriptreact':
			return 'javascript';
		case 'typescript':
		case 'typescriptreact':
			return 'typescript';
		case 'json':
		case 'jsonc':
			return 'json';
		case 'html':
			return 'html';
		case 'css':
		case 'scss':
		case 'less':
			return 'css';
		case 'yaml':
			return 'yaml';
		default:
			return 'unknown';
	}
}
