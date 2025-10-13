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
	const paths: Path[] = [];
	const errors: ParseError[] = [];

	try {
		switch (fileType) {
			case 'csv':
				paths.push(...extractFromCsv(content));
				break;
			case 'toml':
				paths.push(...extractFromToml(content));
				break;
			case 'dotenv':
				paths.push(...extractFromDotenv(content));
				break;
			case 'javascript':
			case 'typescript':
				paths.push(...extractFromJavaScript(content));
				break;
			case 'json':
				paths.push(...extractFromJson(content));
				break;
			case 'css':
				paths.push(...extractFromCss(content));
				break;
			case 'html':
				paths.push(...extractFromHtml(content));
				break;
			default:
				// Add a helpful error for unsupported formats
				errors.push({
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
				});
				break;
		}
	} catch (error) {
		const parseError: ParseError = {
			category: 'parsing',
			severity: 'error',
			message: error instanceof Error ? error.message : 'Unknown parsing error',
			recoverable: true,
			recoveryAction: 'skip',
			timestamp: Date.now(),
			...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
		};
		errors.push(parseError);
	}

	return Object.freeze({
		success: errors.length === 0,
		paths: Object.freeze(paths),
		errors: Object.freeze(errors),
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
