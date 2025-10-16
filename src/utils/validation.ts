import type { Configuration, ValidationResult } from '../types';
import {
	getWorkspaceFolderForPath,
	type PathResolutionOptions,
} from './pathResolver';
import {
	detectPathType,
	isValidPath,
	resolvePathCanonical,
	validatePathFormat,
} from './pathValidation';

export async function validatePaths(
	paths: string[],
	config: Configuration,
): Promise<ValidationResult[]> {
	const results: ValidationResult[] = [];

	for (const path of paths) {
		try {
			const result = await validateSinglePath(path, config);
			results.push(result);
		} catch (error) {
			results.push({
				path,
				status: 'invalid',
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	return results;
}

async function validateSinglePath(
	path: string,
	config: Configuration,
): Promise<ValidationResult> {
	// Validate path format
	const formatValidation = validatePathFormat(path);
	if (!formatValidation.isValid) {
		return {
			path,
			status: 'invalid',
			error: formatValidation.errors.join(', '),
		};
	}

	// Check if path is safe
	if (!isValidPath(path)) {
		return {
			path,
			status: 'invalid',
			error: 'Path contains invalid characters or reserved names',
		};
	}

	// Detect path type
	const pathType = detectPathType(path);

	// URLs don't need file system validation
	if (pathType === 'url') {
		return {
			path,
			status: 'valid',
			exists: true,
		};
	}

	// Resolve path canonically if enabled in config
	let resolvedPath = path;
	try {
		if (
			config.validation?.enabled &&
			(config.resolution?.resolveSymlinks ||
				config.resolution?.resolveWorkspaceRelative)
		) {
			const workspaceFolder = getWorkspaceFolderForPath(path);
			const resolveOptions: Partial<PathResolutionOptions> = {
				resolveSymlinks: config.resolution?.resolveSymlinks ?? true,
				resolveWorkspaceRelative:
					config.resolution?.resolveWorkspaceRelative ?? true,
				...(workspaceFolder && { workspaceFolder }),
			};

			resolvedPath = await resolvePathCanonical(path, resolveOptions);
		}
	} catch (_error) {
		// If canonical resolution fails, continue with original path
		resolvedPath = path;
	}

	// Perform file system checks if enabled
	if (config.validation?.checkExistence) {
		try {
			// Use VS Code's file system API for better compatibility
			const uri = require('vscode').Uri.file(resolvedPath);
			const _stat = await require('vscode').workspace.fs.stat(uri);

			const result: ValidationResult = {
				path,
				status: 'valid',
				exists: true,
			};

			if (config.validation?.checkPermissions) {
				result.permissions = 'read-write';
			}

			if (resolvedPath !== path) {
				result.resolvedPath = resolvedPath;
			}

			return result;
		} catch (_error) {
			const result: ValidationResult = {
				path,
				status: 'invalid',
				exists: false,
				error: `File not found: ${resolvedPath}`,
			};

			if (resolvedPath !== path) {
				result.resolvedPath = resolvedPath;
			}

			return result;
		}
	}

	// If existence checking is disabled, assume valid
	const result: ValidationResult = {
		path,
		status: 'valid',
		exists: true,
	};

	if (config.validation?.checkPermissions) {
		result.permissions = 'read-write';
	}

	if (resolvedPath !== path) {
		result.resolvedPath = resolvedPath;
	}

	return result;
}
