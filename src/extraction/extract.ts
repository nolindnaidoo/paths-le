import type { ExtractionResult, FileType, ParseError, Path } from '../types';
import { extractFromCss } from './formats/css';
import { extractFromCsv } from './formats/csv';
import { extractFromDotenv } from './formats/dotenv';
import { extractFromHtml } from './formats/html';
import { extractFromJavaScript } from './formats/javascript';
import { extractFromJson } from './formats/json';
import { extractFromToml } from './formats/toml';

export async function extractPaths(
	content: string,
	languageId: string,
): Promise<ExtractionResult> {
	const fileType = determineFileType(languageId);

	if (fileType === 'unknown') {
		return buildUnsupportedFormatResult(languageId);
	}

	const paths = extractPathsByFileType(content, fileType);

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
		default:
			return [];
	}
}

function buildUnsupportedFormatResult(languageId: string): ExtractionResult {
	const error: ParseError = {
		category: 'format',
		severity: 'info',
		message: `Path extraction is not supported for ${languageId} files. Supported formats: CSV, TOML, ENV, JS, TS, JSON, HTML, CSS.`,
		context: `File type: ${languageId}`,
		recoverable: false,
		recoveryAction: 'none',
		timestamp: Date.now(),
		metadata: {
			languageId,
			supportedFormats: [
				'csv',
				'toml',
				'dotenv',
				'javascript',
				'typescript',
				'json',
				'html',
				'css',
			],
		},
	};

	return Object.freeze({
		success: false,
		paths: Object.freeze([]),
		errors: Object.freeze([error]),
	});
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
		default:
			return 'unknown';
	}
}
