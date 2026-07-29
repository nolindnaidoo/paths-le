import type * as vscode from 'vscode';
import type { Configuration } from '../types';

export interface SafetyResult {
	readonly proceed: boolean;
	readonly message: string;
	readonly warnings: readonly string[];
}

/**
 * Pre-extraction guardrails: refuse files over the configured size
 * threshold and surface warnings for large line counts or heavy path
 * density. Pure string checks — no filesystem access.
 */
export function handleSafetyChecks(
	document: vscode.TextDocument,
	config: Configuration,
): SafetyResult {
	if (!config.safetyEnabled) {
		return Object.freeze({ proceed: true, message: '', warnings: [] });
	}

	const content = document.getText();

	if (content.length > config.safetyFileSizeWarnBytes) {
		return Object.freeze({
			proceed: false,
			message: `File size (${content.length} bytes) exceeds safety threshold (${config.safetyFileSizeWarnBytes} bytes). Consider splitting the file or increasing the threshold in settings.`,
			warnings: [],
		});
	}

	const warnings = collectSafetyWarnings(content, config);

	return Object.freeze({
		proceed: true,
		message:
			warnings.length === 0
				? 'Safety checks passed'
				: `Safety checks passed with ${warnings.length} warnings`,
		warnings: Object.freeze(warnings),
	});
}

function collectSafetyWarnings(
	content: string,
	config: Configuration,
): string[] {
	const warnings: string[] = [];
	const lineCount = content.split('\n').length;

	if (lineCount > config.safetyLargeOutputLinesThreshold) {
		warnings.push(
			`Large file detected: ${lineCount} lines (threshold: ${config.safetyLargeOutputLinesThreshold})`,
		);
	}

	const estimatedPaths = estimatePathCount(content);
	if (estimatedPaths > 1000) {
		warnings.push(
			`Large number of paths detected: estimated ${estimatedPaths} paths`,
		);
	}

	return warnings;
}

function estimatePathCount(content: string): number {
	const unixPaths = (content.match(/\/[^\s"'<>|*?]+/g) ?? []).length;
	const windowsPaths = (content.match(/[A-Za-z]:\\[^\s"'<>|*?]+/g) ?? [])
		.length;
	const relativePaths = (content.match(/\.\.?\/[^\s"'<>|*?]+/g) ?? []).length;

	return unixPaths + windowsPaths + relativePaths;
}
