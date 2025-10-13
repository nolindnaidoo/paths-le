import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractPaths } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { handleSafetyChecks } from '../utils/safety';

export function registerExtractCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.extractPaths',
		async () => {
			deps.telemetry.event('command-extract-paths');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning('No active editor found');
				return;
			}

			const document = editor.document;
			const config = getConfiguration();

			// Safety checks
			const safetyResult = handleSafetyChecks(document, config);
			if (!safetyResult.proceed) {
				deps.notifier.showWarning(safetyResult.message);
				return;
			}

			try {
				deps.statusBar.showProgress('Extracting paths...');

				const result = await extractPaths(
					document.getText(),
					document.languageId,
				);

				if (!result.success) {
					const firstError = result.errors[0];
					if (firstError?.category === 'format') {
						// Show friendly message for unsupported formats
						deps.notifier.showInfo(firstError.message);
					} else {
						deps.notifier.showError(
							`Failed to extract paths: ${firstError?.message || 'Unknown error'}`,
						);
					}
					return;
				}

				if (result.paths.length === 0) {
					deps.notifier.showInfo('No paths found in the current document');
					return;
				}

				// Format paths
				const formattedPaths = result.paths.map((path) => path.value);

				// Open results
				if (config.openResultsSideBySide) {
					const doc = await vscode.workspace.openTextDocument({
						content: formattedPaths.join('\n'),
						language: 'plaintext',
					});
					await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
				} else if (config.postProcessOpenInNewFile) {
					const doc = await vscode.workspace.openTextDocument({
						content: formattedPaths.join('\n'),
						language: 'plaintext',
					});
					await vscode.window.showTextDocument(doc);
				} else {
					// Replace current selection or entire document
					const edit = new vscode.WorkspaceEdit();
					edit.replace(
						document.uri,
						new vscode.Range(0, 0, document.lineCount, 0),
						formattedPaths.join('\n'),
					);
					await vscode.workspace.applyEdit(edit);
				}

				// Copy to clipboard if enabled
				if (config.copyToClipboardEnabled) {
					await vscode.env.clipboard.writeText(formattedPaths.join('\n'));
				}

				deps.notifier.showInfo(
					`Extracted ${result.paths.length} paths from document`,
				);
				deps.telemetry.event('extract-success', {
					count: result.paths.length,
					language: document.languageId,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				deps.notifier.showError(`Path extraction failed: ${message}`);
				deps.telemetry.event('extract-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}
