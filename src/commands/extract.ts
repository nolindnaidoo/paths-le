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
import { displayResults } from './output';

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
				deps.notifier.showWarning(vscode.l10n.t('No active editor found'));
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
				deps.notifier.showInfo(
					vscode.l10n.t('No paths found in the current document'),
				);
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
		deps.notifier.showError(
			vscode.l10n.t('Failed to extract paths: Unknown error'),
		);
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
	deps.statusBar.showProgress(vscode.l10n.t('⚠️ Resolving canonical paths...'));

	const warningShown = context.globalState.get<boolean>(
		CANONICAL_WARNING_KEY,
		false,
	);

	if (warningShown) {
		return true;
	}

	// Bound once and reused for the comparisons below. showWarningMessage
	// returns the label that was clicked, so a localized label compared against
	// an English literal silently takes the "dismissed" path in every other
	// language — and this particular dialog governs whether absolute filesystem
	// paths end up in the output.
	const continueLabel = vscode.l10n.t('Continue');
	const disableLabel = vscode.l10n.t('Disable and Continue');
	const learnMoreLabel = vscode.l10n.t('Learn More');

	const choice = await vscode.window.showWarningMessage(
		vscode.l10n.t(
			'⚠️ SECURITY WARNING: Canonical path resolution is enabled. This may expose sensitive file system paths in the extracted output. Only use in trusted environments.',
		),
		continueLabel,
		disableLabel,
		learnMoreLabel,
	);

	if (choice === disableLabel) {
		await disableCanonicalResolution(deps);
		return false;
	}

	if (choice === learnMoreLabel) {
		await vscode.env.openExternal(
			vscode.Uri.parse(
				'https://github.com/nolindnaidoo/paths-le#privacy--security',
			),
		);
		return false;
	}

	if (choice === continueLabel) {
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
	deps.notifier.showInfo(
		vscode.l10n.t('Canonical path resolution disabled for security'),
	);
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
				return resolved;
			}
			fallbackCount++;

			return resolved;
		}),
	);

	if (resolvedCount > 0) {
		deps.statusBar.showProgress(`✅ Resolved ${resolvedCount} canonical paths`);
		return formattedPaths;
	}
	if (fallbackCount > 0) {
		deps.statusBar.showProgress(
			'⚠️ Canonical resolution failed, using original paths',
		);
	}

	return formattedPaths;
}
