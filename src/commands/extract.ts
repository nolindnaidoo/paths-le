import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractPaths } from '../extraction/extract';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { sanitizeErrorMessage } from '../utils/errors';
import {
	getWorkspaceFolderForPath,
	resolvePathCanonical,
} from '../utils/pathResolver';
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

			const safetyResult = handleSafetyChecks(document, config);
			if (!safetyResult.proceed) {
				deps.notifier.showWarning(safetyResult.message);
				return;
			}

			const result = await extractPaths(
				document.getText(),
				document.languageId,
			);

			if (!result.success) {
				handleExtractionFailure(result, deps);
				return;
			}

			if (result.paths.length === 0) {
				deps.notifier.showInfo('No paths found in the current document');
				return;
			}

			const canonicalEnabled = Boolean(
				config.resolution?.resolveSymlinks ||
					config.resolution?.resolveWorkspaceRelative,
			);

			if (canonicalEnabled) {
				const shouldContinue = await handleCanonicalResolutionWarning(
					context,
					deps,
				);
				if (!shouldContinue) {
					return;
				}
			}

			deps.statusBar.showProgress('Extracting paths...');

			const formattedPaths = await resolvePathsIfNeeded(
				result.paths,
				config,
				canonicalEnabled,
				deps,
			);

			await displayResults(
				formattedPaths,
				result.paths.length,
				document,
				config,
				deps,
			);

			deps.statusBar.hideProgress();
		},
	);

	context.subscriptions.push(command);
}

function handleExtractionFailure(
	result: { success: boolean; errors: readonly unknown[] },
	deps: Readonly<{ notifier: Notifier }>,
): void {
	const firstError = result.errors[0] as
		| { category?: string; message?: string }
		| undefined;

	if (!firstError) {
		deps.notifier.showError('Failed to extract paths: Unknown error');
		return;
	}

	if (firstError.category === 'format') {
		deps.notifier.showInfo(firstError.message ?? 'Unsupported format');
		return;
	}

	deps.notifier.showError(
		sanitizeErrorMessage(
			`Failed to extract paths: ${firstError.message ?? 'Unknown error'}`,
		),
	);
}

const CANONICAL_WARNING_KEY = 'paths-le.canonicalWarningShown';

async function handleCanonicalResolutionWarning(
	context: vscode.ExtensionContext,
	deps: Readonly<{ notifier: Notifier; statusBar: StatusBar }>,
): Promise<boolean> {
	deps.statusBar.showProgress('⚠️ Resolving canonical paths...');

	const warningShown = context.globalState.get<boolean>(
		CANONICAL_WARNING_KEY,
		false,
	);

	if (warningShown) {
		return true;
	}

	const choice = await vscode.window.showWarningMessage(
		'⚠️ SECURITY WARNING: Canonical path resolution is enabled. This may expose sensitive file system paths in the extracted output. Only use in trusted environments.',
		'Continue',
		'Disable and Continue',
		'Learn More',
	);

	if (choice === 'Disable and Continue') {
		await disableCanonicalResolution(deps);
		return false;
	}

	if (choice === 'Learn More') {
		await vscode.env.openExternal(
			vscode.Uri.parse(
				'https://github.com/nolindnaidoo/paths-le#privacy--security',
			),
		);
		return false;
	}

	if (choice === 'Continue') {
		await context.globalState.update(CANONICAL_WARNING_KEY, true);
		return true;
	}

	return false;
}

async function disableCanonicalResolution(
	deps: Readonly<{ notifier: Notifier }>,
): Promise<void> {
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
	deps.notifier.showInfo('Canonical path resolution disabled for security');
}

async function resolvePathsIfNeeded(
	paths: readonly { value: string }[],
	config: {
		resolution?: {
			resolveSymlinks?: boolean;
			resolveWorkspaceRelative?: boolean;
		};
	},
	canonicalEnabled: boolean,
	deps: Readonly<{ statusBar: StatusBar }>,
): Promise<string[]> {
	if (!canonicalEnabled) {
		return paths.map((p) => p.value);
	}

	let resolvedCount = 0;
	let fallbackCount = 0;

	const formattedPaths = await Promise.all(
		paths.map(async (path) => {
			const workspaceFolder = getWorkspaceFolderForPath(path.value);
			const resolveOptions = {
				resolveSymlinks: config.resolution?.resolveSymlinks ?? false,
				resolveWorkspaceRelative:
					config.resolution?.resolveWorkspaceRelative ?? false,
				...(workspaceFolder && { workspaceFolder }),
			};

			const resolved = await resolvePathCanonical(path.value, resolveOptions);

			if (resolved !== path.value) {
				resolvedCount++;
			} else {
				fallbackCount++;
			}

			return resolved;
		}),
	);

	if (resolvedCount > 0) {
		deps.statusBar.showProgress(`✅ Resolved ${resolvedCount} canonical paths`);
	} else if (fallbackCount > 0) {
		deps.statusBar.showProgress(
			'⚠️ Canonical resolution failed, using original paths',
		);
	}

	return formattedPaths;
}

async function displayResults(
	formattedPaths: string[],
	pathCount: number,
	document: vscode.TextDocument,
	config: {
		copyToClipboardEnabled: boolean;
		openResultsSideBySide: boolean;
		postProcessOpenInNewFile: boolean;
	},
	deps: Readonly<{ notifier: Notifier; telemetry: Telemetry }>,
): Promise<void> {
	const pathsContent = formattedPaths.join('\n');

	if (config.openResultsSideBySide) {
		await openInSideBySide(pathsContent, config.copyToClipboardEnabled);
		showSuccessMessage(pathCount, document.languageId, deps);
		return;
	}

	if (config.postProcessOpenInNewFile) {
		await openInNewFile(pathsContent, config.copyToClipboardEnabled);
		showSuccessMessage(pathCount, document.languageId, deps);
		return;
	}

	await replaceCurrentDocument(
		document,
		pathsContent,
		config.copyToClipboardEnabled,
	);
	showSuccessMessage(pathCount, document.languageId, deps);
}

async function openInSideBySide(
	content: string,
	copyToClipboard: boolean,
): Promise<void> {
	const doc = await vscode.workspace.openTextDocument({
		content,
		language: 'plaintext',
	});
	await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

	if (copyToClipboard) {
		await vscode.env.clipboard.writeText(content);
	}
}

async function openInNewFile(
	content: string,
	copyToClipboard: boolean,
): Promise<void> {
	const doc = await vscode.workspace.openTextDocument({
		content,
		language: 'plaintext',
	});
	await vscode.window.showTextDocument(doc);

	if (copyToClipboard) {
		await vscode.env.clipboard.writeText(content);
	}
}

async function replaceCurrentDocument(
	document: vscode.TextDocument,
	content: string,
	copyToClipboard: boolean,
): Promise<void> {
	const edit = new vscode.WorkspaceEdit();
	edit.replace(
		document.uri,
		new vscode.Range(0, 0, document.lineCount, 0),
		content,
	);
	await vscode.workspace.applyEdit(edit);

	if (copyToClipboard) {
		await vscode.env.clipboard.writeText(content);
	}
}

function showSuccessMessage(
	pathCount: number,
	languageId: string,
	deps: Readonly<{ notifier: Notifier; telemetry: Telemetry }>,
): void {
	deps.notifier.showInfo(`Extracted ${pathCount} paths from document`);
	deps.telemetry.event('extract-success', {
		count: pathCount,
		language: languageId,
	});
}
