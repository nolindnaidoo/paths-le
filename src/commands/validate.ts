import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import type { Telemetry } from '../telemetry/telemetry';
import type { ValidationResult } from '../types';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { validatePaths } from '../utils/validation';

export function registerValidateCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.postProcess.validate',
		async () => {
			deps.telemetry.event('command-validate-paths');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning('No active editor found');
				return;
			}

			try {
				deps.statusBar.showProgress('Validating paths...');

				const document = editor.document;
				const text = document.getText();
				const lines = text.split('\n');
				const config = getConfiguration();

				// Check if this looks like a paths file (simple heuristic)
				const pathLines = lines.filter((line) => line.trim());
				const isPathsFile =
					pathLines.length > 0 &&
					pathLines.every((line) => {
						const trimmed = line.trim();
						return trimmed === '' || /[/\\]/.test(trimmed); // Has path separators
					});

				let pathsToValidate: string[];
				if (isPathsFile) {
					// Parse paths directly from the current file
					pathsToValidate = pathLines.filter((line) => line.trim().length > 0);
				} else {
					// Extract paths from source file first
					// This would need path extraction logic - for now use existing lines
					pathsToValidate = lines.filter((line) => line.trim().length > 0);
				}

				// Validate paths
				const validationResults = await validatePaths(pathsToValidate, config);

				// Generate validation report
				const report = generateValidationReport(validationResults);

				// Replace the content of the current editor
				const success = await editor.edit((editBuilder) => {
					const fullRange = new vscode.Range(
						editor.document.positionAt(0),
						editor.document.positionAt(editor.document.getText().length),
					);
					editBuilder.replace(fullRange, report);
				});

				if (success) {
					deps.notifier.showInfo(
						`Validation complete: ${validationResults.length} paths validated in current editor`,
					);
				} else {
					deps.notifier.showError('Failed to update the editor content');
				}
				deps.telemetry.event('validate-success', {
					count: validationResults.length,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				deps.notifier.showError(`Validation failed: ${message}`);
				deps.telemetry.event('validate-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}

function generateValidationReport(results: ValidationResult[]): string {
	const lines: string[] = [];

	lines.push('# Path Validation Report');
	lines.push('');
	lines.push(`**Total Paths:** ${results.length}`);
	lines.push('');

	const valid = results.filter((r) => r.status === 'valid').length;
	const invalid = results.filter((r) => r.status === 'invalid').length;
	const broken = results.filter((r) => r.status === 'broken').length;
	const inaccessible = results.filter(
		(r) => r.status === 'inaccessible',
	).length;

	lines.push('## Summary');
	lines.push(`- **Valid:** ${valid}`);
	lines.push(`- **Invalid:** ${invalid}`);
	lines.push(`- **Broken:** ${broken}`);
	lines.push(`- **Inaccessible:** ${inaccessible}`);
	lines.push('');

	if (invalid > 0) {
		lines.push('## Invalid Paths');
		results
			.filter((r) => r.status === 'invalid')
			.forEach((result) => {
				lines.push(`- ${result.path}: ${result.error}`);
			});
		lines.push('');
	}

	if (broken > 0) {
		lines.push('## Broken Paths');
		results
			.filter((r) => r.status === 'broken')
			.forEach((result) => {
				lines.push(`- ${result.path}: ${result.error}`);
			});
		lines.push('');
	}

	if (inaccessible > 0) {
		lines.push('## Inaccessible Paths');
		results
			.filter((r) => r.status === 'inaccessible')
			.forEach((result) => {
				lines.push(`- ${result.path}: ${result.error}`);
			});
		lines.push('');
	}

	return lines.join('\n');
}
