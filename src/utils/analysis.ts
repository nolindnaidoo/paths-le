import type { AnalysisResult, Configuration, PathType } from '../types';
import {
	analyzePathPatterns,
	detectPathType,
	isValidPath,
} from './pathValidation';

export function analyzePaths(
	lines: string[],
	config: Configuration,
): AnalysisResult {
	const paths = lines.filter((line) => line.trim().length > 0);
	const uniquePaths = new Set(paths);

	const types: Record<PathType, number> = {
		file: 0,
		directory: 0,
		relative: 0,
		absolute: 0,
		url: 0,
		unknown: 0,
	};

	paths.forEach((path) => {
		const type = detectPathType(path);
		types[type]++;
	});

	const result: AnalysisResult = {
		count: paths.length,
		types,
		unique: uniquePaths.size,
		duplicates: paths.length - uniquePaths.size,
	};

	if (config.analysisIncludeValidation) {
		result.validation = analyzeValidation(paths);
	}

	if (config.analysisIncludePatterns) {
		result.patterns = analyzePathPatterns(paths);
	}

	return result;
}

function analyzeValidation(paths: string[]) {
	const valid = paths.filter((path) => isValidPath(path)).length;
	const invalid = paths.length - valid;

	const permissions: Record<string, number> = {
		'read-write': valid,
		'read-only': 0,
		'no-access': invalid,
	};

	return {
		valid,
		invalid,
		broken: 0,
		inaccessible: invalid,
		permissions,
	};
}
