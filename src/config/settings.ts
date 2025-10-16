import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import { getWorkspaceFolderForPath } from '../utils/pathResolver';
import { resolvePathCanonical } from '../utils/pathValidation';
import { getConfiguration } from './config';
import {
	type ValidationResult,
	validateFileSize,
	validateSettings,
} from './settingsSchema';

export function registerOpenSettingsCommand(
	context: vscode.ExtensionContext,
	telemetry: Telemetry,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.openSettings',
		async () => {
			telemetry.event('command-open-settings');
			await vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'paths-le',
			);
		},
	);

	context.subscriptions.push(command);
}

export function registerExportSettingsCommand(
	context: vscode.ExtensionContext,
	telemetry: Telemetry,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.settings.export',
		async () => {
			telemetry.event('command-settings-export');

			try {
				const config = getConfiguration();
				const configJson = JSON.stringify(config, null, 2);

				const uri = await vscode.window.showSaveDialog({
					filters: { JSON: ['json'] },
					defaultUri: vscode.Uri.file('paths-le-settings.json'),
				});

				if (uri) {
					// Resolve the canonical path for the export location
					let resolvedPath = uri.fsPath;
					try {
						const workspaceFolder = getWorkspaceFolderForPath(uri.fsPath);
						const options = {
							resolveSymlinks: true,
							resolveWorkspaceRelative: true,
							...(workspaceFolder && { workspaceFolder }),
						};
						resolvedPath = await resolvePathCanonical(uri.fsPath, options);

						// Create a new URI with the resolved path
						const resolvedUri = vscode.Uri.file(resolvedPath);
						await vscode.workspace.fs.writeFile(
							resolvedUri,
							Buffer.from(configJson, 'utf8'),
						);
					} catch (_resolveError) {
						// Fallback to original URI if resolution fails
						await vscode.workspace.fs.writeFile(
							uri,
							Buffer.from(configJson, 'utf8'),
						);
					}

					vscode.window.showInformationMessage(
						'Settings exported successfully',
					);
				}
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to export settings: ${error}`);
			}
		},
	);

	context.subscriptions.push(command);
}

export function registerImportSettingsCommand(
	context: vscode.ExtensionContext,
	telemetry: Telemetry,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.settings.import',
		async () => {
			telemetry.event('command-settings-import');

			try {
				// Show file picker
				const uri = await vscode.window.showOpenDialog({
					filters: { JSON: ['json'] },
					canSelectMany: false,
					title: 'Import Paths-LE Settings',
				});

				if (!uri || uri.length === 0 || !uri[0]) {
					return;
				}

				// Resolve the canonical path for the import file
				let resolvedUri = uri[0];
				try {
					const workspaceFolder = getWorkspaceFolderForPath(uri[0].fsPath);
					const options = {
						resolveSymlinks: true,
						resolveWorkspaceRelative: true,
						...(workspaceFolder && { workspaceFolder }),
					};
					const resolvedPath = await resolvePathCanonical(
						uri[0].fsPath,
						options,
					);
					resolvedUri = vscode.Uri.file(resolvedPath);
				} catch (_resolveError) {
					// Continue with original URI if resolution fails
					resolvedUri = uri[0];
				}

				// Get file stats to check size before reading
				const stats = await vscode.workspace.fs.stat(resolvedUri);
				const fileSizeError = validateFileSize(stats.size);

				if (fileSizeError) {
					telemetry.event('settings-import-rejected-size', {
						size: stats.size.toString(),
					});
					vscode.window.showErrorMessage(
						`Cannot import settings: ${fileSizeError}`,
					);
					return;
				}

				// Read and parse file
				const fileContent = await vscode.workspace.fs.readFile(resolvedUri);
				const configJson = Buffer.from(fileContent).toString('utf8');

				let parsedSettings: unknown;
				try {
					parsedSettings = JSON.parse(configJson);
				} catch (parseError) {
					telemetry.event('settings-import-parse-error');
					vscode.window.showErrorMessage(
						`Invalid JSON file: ${parseError instanceof Error ? parseError.message : 'Parse error'}`,
					);
					return;
				}

				// Validate settings against schema
				const validation: ValidationResult = validateSettings(parsedSettings);

				if (!validation.valid) {
					telemetry.event('settings-import-validation-failed', {
						errorCount: validation.errors.length.toString(),
					});

					// Show detailed validation errors
					const errorMessage = [
						'Settings validation failed:',
						'',
						...validation.errors.slice(0, 10), // Limit to first 10 errors
					].join('\n');

					const viewDetails = await vscode.window.showErrorMessage(
						'Cannot import settings due to validation errors',
						'View Details',
					);

					if (viewDetails === 'View Details') {
						const doc = await vscode.workspace.openTextDocument({
							content: errorMessage,
							language: 'plaintext',
						});
						await vscode.window.showTextDocument(doc);
					}

					return;
				}

				// Show confirmation if there were warnings (some settings skipped)
				const validCount = Object.keys(validation.validSettings).length;
				const totalCount =
					parsedSettings &&
					typeof parsedSettings === 'object' &&
					parsedSettings !== null
						? Object.keys(parsedSettings).length
						: 0;
				const skippedCount = totalCount - validCount;

				if (skippedCount > 0) {
					const proceed = await vscode.window.showWarningMessage(
						`${skippedCount} invalid setting(s) will be skipped. Import ${validCount} valid setting(s)?`,
						{ modal: true },
						'Import Valid Settings',
						'Cancel',
					);

					if (proceed !== 'Import Valid Settings') {
						telemetry.event('settings-import-cancelled');
						return;
					}
				}

				// Import validated settings
				const workspaceConfig = vscode.workspace.getConfiguration('paths-le');
				let importedCount = 0;

				for (const [key, value] of Object.entries(validation.validSettings)) {
					try {
						await workspaceConfig.update(
							key,
							value,
							vscode.ConfigurationTarget.Global,
						);
						importedCount++;
					} catch (updateError) {
						// Log but continue with other settings
						console.error(`Failed to update setting "${key}":`, updateError);
					}
				}

				// Show success message
				telemetry.event('settings-import-success', {
					count: importedCount.toString(),
					skipped: skippedCount.toString(),
				});

				if (skippedCount > 0) {
					vscode.window.showInformationMessage(
						`Imported ${importedCount} setting(s) successfully (${skippedCount} invalid setting(s) skipped)`,
					);
				} else {
					vscode.window.showInformationMessage(
						`Imported ${importedCount} setting(s) successfully`,
					);
				}
			} catch (error) {
				telemetry.event('settings-import-error');
				vscode.window.showErrorMessage(
					`Failed to import settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
			}
		},
	);

	context.subscriptions.push(command);
}

export function registerResetSettingsCommand(
	context: vscode.ExtensionContext,
	telemetry: Telemetry,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.settings.reset',
		async () => {
			telemetry.event('command-settings-reset');

			const confirm = await vscode.window.showWarningMessage(
				'Are you sure you want to reset all Paths-LE settings to defaults?',
				{ modal: true },
				'Reset Settings',
			);

			if (confirm === 'Reset Settings') {
				try {
					const workspaceConfig = vscode.workspace.getConfiguration('paths-le');
					await workspaceConfig.update(
						'',
						undefined,
						vscode.ConfigurationTarget.Global,
					);
					vscode.window.showInformationMessage('Settings reset to defaults');
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to reset settings: ${error}`);
				}
			}
		},
	);

	context.subscriptions.push(command);
}
