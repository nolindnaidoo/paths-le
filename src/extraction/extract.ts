import type { ExtractionResult, FileType, Path } from '../types';
import { extractFromCss } from './formats/css';
import { extractFromCsv } from './formats/csv';
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
	const paths = extractPathsByFileType(content, determineFileType(languageId));

	return Object.freeze({
		success: true,
		paths: Object.freeze(paths),
		errors: Object.freeze([]),
	});
}

function extractPathsByFileType(
	content: string,
	fileType: FileType,
): readonly Path[] {
	switch (fileType) {
		case 'csv':
			return extractFromCsv(content);
		case 'toml':
			return extractFromToml(content);
		case 'dotenv':
			return extractFromDotenv(content);
		case 'javascript':
		case 'typescript':
			return extractFromJavaScript(content);
		case 'json':
			return extractFromJson(content);
		case 'css':
			return extractFromCss(content);
		case 'html':
			return extractFromHtml(content);
		case 'yaml':
			return extractFromYaml(content);
		default:
			return extractFromFallback(content);
	}
}

function determineFileType(languageId: string): FileType {
	switch (languageId) {
		case 'csv':
			return 'csv';
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
