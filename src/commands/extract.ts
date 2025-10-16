import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractPaths } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { getWorkspaceFolderForPath } from '../utils/pathResolver';
import { resolvePathCanonical } from '../utils/pathValidation';
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

				// Format paths with canonical resolution if enabled
				const canonicalEnabled =
					config.resolution?.resolveSymlinks ||
					config.resolution?.resolveWorkspaceRelative;
				let resolvedCount = 0;
				let fallbackCount = 0;

				// Show security warning if canonical resolution is enabled
				if (canonicalEnabled) {
					deps.statusBar.showProgress('⚠️ Resolving canonical paths...');

					// Show one-time security warning
					const _warningKey = 'paths-le.canonical.warning.shown';
					const context = vscode.workspace.getConfiguration('paths-le');
					const warningShown = context.get(
						'_internal.canonicalWarningShown',
						false,
					);

					if (!warningShown) {
						const choice = await vscode.window.showWarningMessage(
							'⚠️ SECURITY WARNING: Canonical path resolution is enabled. This may expose sensitive file system paths in the extracted output. Only use in trusted environments.',
							'Continue',
							'Disable and Continue',
							'Learn More',
						);

						if (choice === 'Disable and Continue') {
							// Disable canonical resolution for this session
							await vscode.workspace
								.getConfiguration('paths-le')
								.update(
									'resolution.resolveSymlinks',
									false,
									vscode.ConfigurationTarget.Workspace,
								);
							await vscode.workspace
								.getConfiguration('paths-le')
								.update(
									'resolution.resolveWorkspaceRelative',
									false,
									vscode.ConfigurationTarget.Workspace,
								);
							deps.notifier.showInfo(
								'Canonical path resolution disabled for security',
							);
							return; // Exit and let user re-run the command
						} else if (choice === 'Learn More') {
							vscode.env.openExternal(
								vscode.Uri.parse(
									'https://github.com/nolindnaidoo/paths-le#security-considerations',
								),
							);
							return;
						}

						// Mark warning as shown
						await context.update(
							'_internal.canonicalWarningShown',
							true,
							vscode.ConfigurationTarget.Global,
						);
					}
				}

				const formattedPaths = await Promise.all(
					result.paths.map(async (path) => {
						// Check if canonical resolution is enabled
						if (canonicalEnabled) {
							try {
								const workspaceFolder = getWorkspaceFolderForPath(path.value);
								const resolveOptions = {
									resolveSymlinks: config.resolution?.resolveSymlinks ?? false,
									resolveWorkspaceRelative:
										config.resolution?.resolveWorkspaceRelative ?? false,
									...(workspaceFolder && { workspaceFolder }),
								};
								const resolved = await resolvePathCanonical(
									path.value,
									resolveOptions,
								);
								if (resolved !== path.value) {
									resolvedCount++;
								}
								return resolved;
							} catch (_error) {
								// Fallback to original path if resolution fails
								fallbackCount++;
								return path.value;
							}
						}
						return path.value;
					}),
				);

				// Update status with resolution results
				if (canonicalEnabled) {
					if (resolvedCount > 0) {
						deps.statusBar.showProgress(
							`✅ Resolved ${resolvedCount} canonical paths`,
						);
					} else if (fallbackCount > 0) {
						deps.statusBar.showProgress(
							'⚠️ Canonical resolution failed, using original paths',
						);
					}
				}

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
