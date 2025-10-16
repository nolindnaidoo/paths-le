import type { PathType } from '../types';
import {
	getWorkspaceFolderForPath,
	type PathResolutionOptions,
	safeResolvePath,
} from './pathResolver';

export function isValidPath(path: string): boolean {
	if (!path || path.trim().length === 0) return false;

	// Check for invalid characters
	const invalidChars = /[<>:"|?*]/;
	if (invalidChars.test(path)) return false;

	// Check for reserved names (Windows)
	const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
	const pathParts = path.split(/[/\\]/);
	if (pathParts.some((part) => reservedNames.test(part))) return false;

	return true;
}

export function detectPathType(path: string): PathType {
	const trimmed = path.trim();

	// Check for URL
	if (
		trimmed.startsWith('http://') ||
		trimmed.startsWith('https://') ||
		trimmed.startsWith('ftp://')
	) {
		return 'url';
	}

	// Check for absolute path
	if (trimmed.startsWith('/') || trimmed.match(/^[A-Za-z]:[\\/]/)) {
		return 'absolute';
	}

	// Check for relative path
	if (
		trimmed.startsWith('./') ||
		trimmed.startsWith('../') ||
		trimmed.includes('/') ||
		trimmed.includes('\\')
	) {
		return 'relative';
	}

	// Check if it looks like a directory (ends with / or \)
	if (trimmed.endsWith('/') || trimmed.endsWith('\\')) {
		return 'directory';
	}

	// Check if it has a file extension
	if (trimmed.includes('.') && !trimmed.endsWith('.')) {
		return 'file';
	}

	return 'unknown';
}

export function normalizePath(path: string): string {
	// Normalize path separators
	let normalized = path.replace(/\\/g, '/');

	// Remove duplicate separators
	normalized = normalized.replace(/\/+/g, '/');

	// Remove trailing separator unless it's root
	if (normalized.length > 1 && normalized.endsWith('/')) {
		normalized = normalized.slice(0, -1);
	}

	return normalized;
}

export function getPathComponents(path: string): {
	directory: string;
	filename: string;
	extension: string;
	basename: string;
} {
	const normalized = normalizePath(path);
	const lastSlash = normalized.lastIndexOf('/');

	if (lastSlash === -1) {
		// No directory separator
		const lastDot = normalized.lastIndexOf('.');
		if (lastDot === -1) {
			return {
				directory: '',
				filename: normalized,
				extension: '',
				basename: normalized,
			};
		}

		return {
			directory: '',
			filename: normalized,
			extension: normalized.slice(lastDot + 1),
			basename: normalized.slice(0, lastDot),
		};
	}

	const directory = normalized.slice(0, lastSlash);
	const filename = normalized.slice(lastSlash + 1);
	const lastDot = filename.lastIndexOf('.');

	if (lastDot === -1) {
		return {
			directory,
			filename,
			extension: '',
			basename: filename,
		};
	}

	return {
		directory,
		filename,
		extension: filename.slice(lastDot + 1),
		basename: filename.slice(0, lastDot),
	};
}

export function getPathDepth(path: string): number {
	const normalized = normalizePath(path);
	const parts = normalized.split('/').filter((part) => part.length > 0);
	return parts.length;
}

export function isAbsolutePath(path: string): boolean {
	return path.startsWith('/') || path.match(/^[A-Za-z]:[\\/]/) !== null;
}

export function isRelativePath(path: string): boolean {
	return (
		!isAbsolutePath(path) &&
		(path.startsWith('./') ||
			path.startsWith('../') ||
			path.includes('/') ||
			path.includes('\\'))
	);
}

export function isFilePath(path: string): boolean {
	const components = getPathComponents(path);
	return components.extension.length > 0;
}

export function isDirectoryPath(path: string): boolean {
	return (
		path.endsWith('/') ||
		path.endsWith('\\') ||
		(!isFilePath(path) && (path.includes('/') || path.includes('\\')))
	);
}

export function getFileExtension(path: string): string {
	const components = getPathComponents(path);
	return components.extension.toLowerCase();
}

export function getDirectoryPath(path: string): string {
	const components = getPathComponents(path);
	return components.directory;
}

export function getFileName(path: string): string {
	const components = getPathComponents(path);
	return components.filename;
}

export function getBaseName(path: string): string {
	const components = getPathComponents(path);
	return components.basename;
}

export function resolvePath(basePath: string, relativePath: string): string {
	if (isAbsolutePath(relativePath)) {
		return normalizePath(relativePath);
	}

	const baseDir = getDirectoryPath(basePath);
	const resolved = `${baseDir}/${relativePath}`;
	return normalizePath(resolved);
}

/**
 * Resolve a path with canonical resolution support (symlinks and workspace-relative)
 * This is the enhanced version that supports monorepo and symlink scenarios
 */
export async function resolvePathCanonical(
	inputPath: string,
	options?: Partial<PathResolutionOptions>,
): Promise<string> {
	const workspaceFolder =
		options?.workspaceFolder || getWorkspaceFolderForPath(inputPath);

	const resolveOptions: PathResolutionOptions = {
		resolveSymlinks: options?.resolveSymlinks ?? true,
		resolveWorkspaceRelative: options?.resolveWorkspaceRelative ?? true,
		...(workspaceFolder && { workspaceFolder }),
	};

	return await safeResolvePath(inputPath, resolveOptions);
}

/**
 * Enhanced path resolution that combines traditional and canonical approaches
 * Falls back gracefully to traditional resolution if canonical fails
 */
export async function resolvePathEnhanced(
	basePath: string,
	relativePath: string,
	options?: Partial<PathResolutionOptions>,
): Promise<string> {
	// First, do traditional resolution
	const traditionalResolved = resolvePath(basePath, relativePath);

	// If canonical resolution is disabled, return traditional result
	if (
		options?.resolveSymlinks === false &&
		options?.resolveWorkspaceRelative === false
	) {
		return traditionalResolved;
	}

	// Try canonical resolution
	try {
		return await resolvePathCanonical(traditionalResolved, options);
	} catch {
		// Fallback to traditional resolution
		return traditionalResolved;
	}
}

export function isPathSafe(path: string): boolean {
	// Check for path traversal attempts
	if (path.includes('..') || path.includes('~')) {
		return false;
	}

	// Check for absolute paths in sensitive contexts
	if (
		isAbsolutePath(path) &&
		(path.startsWith('/etc/') ||
			path.startsWith('/sys/') ||
			path.startsWith('C:\\Windows\\'))
	) {
		return false;
	}

	return true;
}

export function validatePathFormat(path: string): {
	isValid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!path || path.trim().length === 0) {
		errors.push('Path is empty');
		return { isValid: false, errors };
	}

	// Check for invalid characters
	const invalidChars = /[<>:"|?*]/;
	if (invalidChars.test(path)) {
		errors.push('Path contains invalid characters');
	}

	// Check for reserved names (Windows)
	const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
	const pathParts = path.split(/[/\\]/);
	const reservedParts = pathParts.filter((part) => reservedNames.test(part));
	if (reservedParts.length > 0) {
		errors.push(`Path contains reserved names: ${reservedParts.join(', ')}`);
	}

	// Check for path traversal
	if (path.includes('..')) {
		errors.push('Path contains traversal sequences (..)');
	}

	// Check for excessive length
	if (path.length > 260) {
		errors.push('Path exceeds maximum length (260 characters)');
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

export function analyzePathPatterns(paths: string[]): {
	commonPatterns: Array<{
		pattern: string;
		count: number;
		percentage: number;
		examples: string[];
	}>;
	depthDistribution: Record<string, number>;
	namingConventions: Record<string, number>;
	extensions: Record<string, number>;
} {
	const patternCounts: Record<string, number> = {};
	const depthCounts: Record<string, number> = {};
	const namingCounts: Record<string, number> = {};
	const extensionCounts: Record<string, number> = {};

	paths.forEach((path) => {
		// Analyze patterns
		const normalized = normalizePath(path);
		const pattern = extractPathPattern(normalized);
		patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;

		// Analyze depth
		const depth = getPathDepth(path);
		depthCounts[depth.toString()] = (depthCounts[depth.toString()] || 0) + 1;

		// Analyze naming conventions
		const components = getPathComponents(path);
		const namingConvention = detectNamingConvention(components.basename);
		namingCounts[namingConvention] = (namingCounts[namingConvention] || 0) + 1;

		// Analyze extensions
		const extension = getFileExtension(path);
		if (extension) {
			extensionCounts[extension] = (extensionCounts[extension] || 0) + 1;
		}
	});

	const commonPatterns = Object.entries(patternCounts)
		.map(([pattern, count]) => ({
			pattern,
			count,
			percentage: (count / paths.length) * 100,
			examples: paths
				.filter((p) => extractPathPattern(normalizePath(p)) === pattern)
				.slice(0, 3),
		}))
		.sort((a, b) => b.count - a.count);

	return {
		commonPatterns,
		depthDistribution: depthCounts,
		namingConventions: namingCounts,
		extensions: extensionCounts,
	};
}

function extractPathPattern(path: string): string {
	// Extract a pattern from the path
	return path
		.replace(/[a-zA-Z0-9]/g, 'X')
		.replace(/[0-9]/g, 'N')
		.replace(/\./g, '.');
}

function detectNamingConvention(basename: string): string {
	if (basename.includes('_')) return 'snake_case';
	if (basename.includes('-')) return 'kebab-case';
	if (basename.match(/[A-Z]/) && basename.match(/[a-z]/)) return 'camelCase';
	if (basename === basename.toUpperCase()) return 'UPPERCASE';
	if (basename === basename.toLowerCase()) return 'lowercase';
	return 'mixed';
}

// Freeze all exports for immutability
Object.freeze({
	isValidPath,
	detectPathType,
	normalizePath,
	getPathComponents,
	getPathDepth,
	isAbsolutePath,
	isRelativePath,
	isFilePath,
	isDirectoryPath,
	getFileExtension,
	getDirectoryPath,
	getFileName,
	getBaseName,
	resolvePath,
	resolvePathCanonical,
	resolvePathEnhanced,
	isPathSafe,
	validatePathFormat,
	analyzePathPatterns,
	getWorkspaceFolderForPath,
});
