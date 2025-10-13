import type { FileType } from '../types';

/**
 * File type detection utilities
 * Determines file types based on language IDs and file extensions
 */

export interface FileTypeInfo {
	readonly type: FileType;
	readonly name: string;
	readonly extensions: readonly string[];
	readonly languageIds: readonly string[];
	readonly description: string;
}

export const FILE_TYPES: readonly FileTypeInfo[] = Object.freeze([
	{
		type: 'json',
		name: 'JSON',
		extensions: ['.json'],
		languageIds: ['json'],
		description: 'JavaScript Object Notation files',
	},
	{
		type: 'yaml',
		name: 'YAML',
		extensions: ['.yaml', '.yml'],
		languageIds: ['yaml', 'yml'],
		description: "YAML Ain't Markup Language files",
	},
	{
		type: 'javascript',
		name: 'JavaScript',
		extensions: ['.js', '.mjs', '.cjs'],
		languageIds: ['javascript'],
		description: 'JavaScript source files',
	},
	{
		type: 'typescript',
		name: 'TypeScript',
		extensions: ['.ts', '.tsx', '.mts', '.cts'],
		languageIds: ['typescript', 'typescriptreact'],
		description: 'TypeScript source files',
	},
	{
		type: 'log',
		name: 'Log',
		extensions: ['.log', '.txt'],
		languageIds: ['log', 'plaintext'],
		description: 'Log and text files',
	},
	{
		type: 'ini',
		name: 'INI',
		extensions: ['.ini', '.cfg', '.conf'],
		languageIds: ['ini'],
		description: 'Configuration files',
	},
	{
		type: 'csv',
		name: 'CSV',
		extensions: ['.csv'],
		languageIds: ['csv'],
		description: 'Comma-separated values files',
	},
	{
		type: 'toml',
		name: 'TOML',
		extensions: ['.toml'],
		languageIds: ['toml'],
		description: "Tom's Obvious, Minimal Language files",
	},
	{
		type: 'dotenv',
		name: 'Environment',
		extensions: ['.env', '.env.local', '.env.production'],
		languageIds: ['dotenv', 'env'],
		description: 'Environment variable files',
	},
]);

/**
 * Get file type information by type
 */
export function getFileTypeInfo(type: FileType): FileTypeInfo | undefined {
	return FILE_TYPES.find((ft) => ft.type === type);
}

/**
 * Get file type information by language ID
 */
export function getFileTypeByLanguageId(
	languageId: string,
): FileTypeInfo | undefined {
	return FILE_TYPES.find((ft) => ft.languageIds.includes(languageId));
}

/**
 * Get file type information by file extension
 */
export function getFileTypeByExtension(
	filename: string,
): FileTypeInfo | undefined {
	const extension = getFileExtension(filename);
	return FILE_TYPES.find((ft) => ft.extensions.includes(extension));
}

/**
 * Determine file type from language ID
 */
export function determineFileType(languageId: string): FileType {
	const fileTypeInfo = getFileTypeByLanguageId(languageId);
	return fileTypeInfo?.type || 'unknown';
}

/**
 * Determine file type from filename
 */
export function determineFileTypeFromFilename(filename: string): FileType {
	const fileTypeInfo = getFileTypeByExtension(filename);
	return fileTypeInfo?.type || 'unknown';
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
	const lastDotIndex = filename.lastIndexOf('.');
	if (lastDotIndex === -1 || lastDotIndex === 0) return '';
	return filename.substring(lastDotIndex).toLowerCase();
}

/**
 * Check if a file type is supported
 */
export function isSupportedFileType(type: FileType): boolean {
	return FILE_TYPES.some((ft) => ft.type === type);
}

/**
 * Get all supported file types
 */
export function getSupportedFileTypes(): readonly FileType[] {
	return FILE_TYPES.map((ft) => ft.type);
}

/**
 * Get all supported extensions
 */
export function getSupportedExtensions(): readonly string[] {
	return FILE_TYPES.flatMap((ft) => ft.extensions);
}

/**
 * Get all supported language IDs
 */
export function getSupportedLanguageIds(): readonly string[] {
	return FILE_TYPES.flatMap((ft) => ft.languageIds);
}
