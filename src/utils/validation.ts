import type { Configuration, ValidationResult } from '../types';
import {
	detectPathType,
	isValidPath,
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
	_config: Configuration,
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

	// Simulate file system validation
	const pathType = detectPathType(path);

	// For now, we'll simulate validation results
	// In a real implementation, you'd check file system existence and permissions
	if (pathType === 'url') {
		return {
			path,
			status: 'valid',
			exists: true,
		};
	}

	// Simulate validation result
	return {
		path,
		status: 'valid',
		exists: true,
		permissions: 'read-write',
	};
}
