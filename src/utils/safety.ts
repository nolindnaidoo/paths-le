import * as vscode from 'vscode';
import type { Configuration } from '../types';
import { createEnhancedError, type EnhancedError } from './errorHandling';

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
		return Object.freeze({ proceed: true, message: '', warnings: [] });
	}

	const content = document.getText();
	const fileSizeThreshold =
		options.customThresholds?.fileSizeBytes ?? config.safetyFileSizeWarnBytes;

	if (content.length > fileSizeThreshold) {
		return buildFileSizeError(
			content.length,
			fileSizeThreshold,
			document.fileName,
		);
	}

	const warnings = collectSafetyWarnings(content, config, options);

	return Object.freeze({
		proceed: true,
		message: buildSafetyMessage(warnings),
		warnings: Object.freeze(warnings),
	});
}

function buildFileSizeError(
	fileSize: number,
	threshold: number,
	fileName: string,
): SafetyResult {
	const error = createEnhancedError(
		new Error(
			`File size (${fileSize} bytes) exceeds safety threshold (${threshold} bytes)`,
		),
		'safety',
		{ fileSize, threshold, fileName },
		{
			recoverable: false,
			severity: 'high',
			suggestion:
				'Consider splitting the file or increasing the safety threshold in settings',
		},
	);

	return Object.freeze({
		proceed: false,
		message: error.userMessage,
		error,
		warnings: [],
	});
}

function collectSafetyWarnings(
	content: string,
	config: Configuration,
	options: SafetyCheckOptions,
): string[] {
	const warnings: string[] = [];
	const lines = content.split('\n');
	const lineCountThreshold =
		options.customThresholds?.lineCount ??
		config.safetyLargeOutputLinesThreshold;

	if (lines.length > lineCountThreshold) {
		warnings.push(
			`Large file detected: ${lines.length} lines (threshold: ${lineCountThreshold})`,
		);
	}

	const estimatedPaths = estimatePathCount(content);
	if (estimatedPaths > 1000) {
		warnings.push(
			`Large number of paths detected: estimated ${estimatedPaths} paths`,
		);
	}

	const complexPatterns = countComplexPatterns(content);
	if (complexPatterns > 100) {
		warnings.push(`Complex patterns detected: ${complexPatterns} patterns`);
	}

	return warnings;
}

function buildSafetyMessage(warnings: string[]): string {
	if (warnings.length === 0) {
		return 'Safety checks passed';
	}

	return `Safety checks passed with ${warnings.length} warnings`;
}

export async function handleSafetyChecksWithUserConfirmation(
	document: vscode.TextDocument,
	config: Configuration,
	options: SafetyCheckOptions = {},
): Promise<SafetyResult> {
	const result = handleSafetyChecks(document, config, options);

	if (!result.proceed && options.allowOverride) {
		const shouldContinue = await promptUserOverride(result.message);
		if (shouldContinue) {
			return Object.freeze({
				...result,
				proceed: true,
				message: 'Safety override approved by user',
			});
		}
	}

	return result;
}

async function promptUserOverride(message: string): Promise<boolean> {
	const override = await vscode.window.showWarningMessage(
		message,
		{
			modal: true,
			detail:
				'This operation may take a long time or consume significant resources. Do you want to continue?',
		},
		'Continue Anyway',
		'Cancel',
	);

	return override === 'Continue Anyway';
}

function estimatePathCount(content: string): number {
	const unixPaths = (content.match(/\/[^\s"'<>|*?]+/g) ?? []).length;
	const windowsPaths = (content.match(/[A-Za-z]:\\[^\s"'<>|*?]+/g) ?? [])
		.length;
	const relativePaths = (content.match(/\.\.?\/[^\s"'<>|*?]+/g) ?? []).length;
	const quotedPaths = (content.match(/["'][^"']*["']/g) ?? []).filter(
		(path) => path.includes('/') || path.includes('\\'),
	).length;

	return unixPaths + windowsPaths + relativePaths + quotedPaths;
}

function countComplexPatterns(content: string): number {
	const nestedObjects = (content.match(/\{[^{}]*\{[^{}]*\}[^{}]*\}/g) ?? [])
		.length;
	const nestedArrays = (content.match(/\[[^[\]]*\[[^[\]]*\][^[\]]*\]/g) ?? [])
		.length;
	const regexPatterns = (content.match(/\/[^/\n]+\/[gimuy]*/g) ?? []).length;
	const templateLiterals = (content.match(/`[^`]*\$\{[^}]*\}[^`]*`/g) ?? [])
		.length;

	return nestedObjects + nestedArrays + regexPatterns + templateLiterals;
}

export function shouldCancelOperation(
	processedItems: number,
	threshold: number,
	startTime: number,
	maxTimeMs: number = 30000,
): boolean {
	const elapsedTime = Date.now() - startTime;
	return processedItems > threshold || elapsedTime > maxTimeMs;
}

export function createSafetyWarning(
	message: string,
	details: Record<string, unknown> = {},
): EnhancedError {
	return createEnhancedError(new Error(message), 'safety', details, {
		severity: 'medium',
		recoverable: true,
		suggestion:
			'Consider adjusting safety settings or breaking down the operation',
	});
}
