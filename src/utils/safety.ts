import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import type { Configuration } from '../types';
import { createEnhancedError, type EnhancedError } from './errorHandling';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export interface SafetyResult {
	readonly proceed: boolean;
	readonly message: string;
	readonly error?: EnhancedError;
	readonly warnings: readonly string[];
}

export interface SafetyCheckOptions {
	readonly showProgress?: boolean;
	readonly allowOverride?: boolean;
	readonly customThresholds?: {
		readonly fileSizeBytes?: number;
		readonly lineCount?: number;
		readonly pathCount?: number;
	};
}

export function handleSafetyChecks(
	document: vscode.TextDocument,
	config: Configuration,
	options: SafetyCheckOptions = {},
): SafetyResult {
	if (!config.safetyEnabled) {
		return { proceed: true, message: '', warnings: [] };
	}

	const content = document.getText();
	const lines = content.split('\n');
	const warnings: string[] = [];

	// Use custom thresholds if provided, otherwise use config
	const fileSizeThreshold =
		options.customThresholds?.fileSizeBytes ?? config.safetyFileSizeWarnBytes;
	const lineCountThreshold =
		options.customThresholds?.lineCount ??
		config.safetyLargeOutputLinesThreshold;

	// Check file size
	if (content.length > fileSizeThreshold) {
		const error = createEnhancedError(
			new Error(
				localize(
					'runtime.safety.file-size',
					'File size ({0} bytes) exceeds safety threshold ({1} bytes)',
					content.length,
					fileSizeThreshold,
				),
			),
			'safety',
			{
				fileSize: content.length,
				threshold: fileSizeThreshold,
				fileName: document.fileName,
			},
			{
				recoverable: false,
				severity: 'high',
				suggestion: localize(
					'runtime.safety.file-size.suggestion',
					'Consider splitting the file or increasing the safety threshold in settings',
				),
			},
		);

		return {
			proceed: false,
			message: error.userMessage,
			error,
			warnings: [],
		};
	}

	// Check line count
	if (lines.length > lineCountThreshold) {
		warnings.push(
			localize(
				'runtime.safety.line-count.warning',
				'Large file detected: {0} lines (threshold: {1})',
				lines.length,
				lineCountThreshold,
			),
		);
	}

	// Check for potential performance issues
	const estimatedPaths = estimatePathCount(content);
	if (estimatedPaths > 1000) {
		warnings.push(
			localize(
				'runtime.safety.path-count.warning',
				'Large number of paths detected: estimated {0} paths',
				estimatedPaths,
			),
		);
	}

	// Check for complex patterns that might be slow to parse
	const complexPatterns = countComplexPatterns(content);
	if (complexPatterns > 100) {
		warnings.push(
			localize(
				'runtime.safety.complex-patterns.warning',
				'Complex patterns detected: {0} patterns',
				complexPatterns,
			),
		);
	}

	return {
		proceed: true,
		message:
			warnings.length > 0
				? localize(
						'runtime.safety.warnings',
						'Safety checks passed with {0} warnings',
						warnings.length,
					)
				: localize('runtime.safety.passed', 'Safety checks passed'),
		warnings: Object.freeze(warnings),
	};
}

export async function handleSafetyChecksWithUserConfirmation(
	document: vscode.TextDocument,
	config: Configuration,
	options: SafetyCheckOptions = {},
): Promise<SafetyResult> {
	const result = handleSafetyChecks(document, config, options);

	if (!result.proceed && options.allowOverride) {
		const override = await vscode.window.showWarningMessage(
			result.message,
			{
				modal: true,
				detail: localize(
					'runtime.safety.override.detail',
					'This operation may take a long time or consume significant resources. Do you want to continue?',
				),
			},
			localize('runtime.safety.override.continue', 'Continue Anyway'),
			localize('runtime.safety.override.cancel', 'Cancel'),
		);

		if (
			override ===
			localize('runtime.safety.override.continue', 'Continue Anyway')
		) {
			return {
				...result,
				proceed: true,
				message: localize(
					'runtime.safety.override.approved',
					'Safety override approved by user',
				),
			};
		}
	}

	return result;
}

/**
 * Estimate the number of paths in the content
 */
function estimatePathCount(content: string): number {
	// Simple heuristic based on common path patterns
	const unixPaths = (content.match(/\/[^\s"'<>|*?]+/g) || []).length;
	const windowsPaths = (content.match(/[A-Za-z]:\\[^\s"'<>|*?]+/g) || [])
		.length;
	const relativePaths = (content.match(/\.\.?\/[^\s"'<>|*?]+/g) || []).length;
	const quotedPaths = (content.match(/["'][^"']*["']/g) || []).filter(
		(path) => path.includes('/') || path.includes('\\'),
	).length;

	return unixPaths + windowsPaths + relativePaths + quotedPaths;
}

/**
 * Count complex patterns that might be slow to parse
 */
function countComplexPatterns(content: string): number {
	// Count complex patterns like nested JSON, regex patterns, etc.
	const nestedObjects = (content.match(/\{[^{}]*\{[^{}]*\}[^{}]*\}/g) || [])
		.length;
	const nestedArrays = (content.match(/\[[^[\]]*\[[^[\]]*\][^[\]]*\]/g) || [])
		.length;
	const regexPatterns = (content.match(/\/[^/\n]+\/[gimuy]*/g) || []).length;
	const templateLiterals = (content.match(/`[^`]*\$\{[^}]*\}[^`]*`/g) || [])
		.length;

	return nestedObjects + nestedArrays + regexPatterns + templateLiterals;
}

/**
 * Check if operation should be cancelled based on safety thresholds
 */
export function shouldCancelOperation(
	processedItems: number,
	threshold: number,
	startTime: number,
	maxTimeMs: number = 30000, // 30 seconds
): boolean {
	const elapsedTime = Date.now() - startTime;

	return processedItems > threshold || elapsedTime > maxTimeMs;
}

/**
 * Create safety warning for display
 */
export function createSafetyWarning(
	message: string,
	details: Record<string, unknown> = {},
): EnhancedError {
	return createEnhancedError(new Error(message), 'safety', details, {
		severity: 'medium',
		recoverable: true,
		suggestion: localize(
			'runtime.safety.warning.suggestion',
			'Consider adjusting safety settings or breaking down the operation',
		),
	});
}

void localize;
