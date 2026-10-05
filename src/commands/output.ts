import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import { fullDocumentRange } from '../utils/document';
import { positioned } from '../utils/positions';

/**
 * Where extraction results go, and what the user is told afterwards.
 *
 * Split out of extract.ts, which held command orchestration, canonical path
 * resolution, output routing and the success message in one 398-line file.
 */

export async function displayResults(
	formattedPaths: string[],
	pathCount: number,
	document: vscode.TextDocument,
	config: {
		clipboardIncludesPositions: boolean;
		copyToClipboardEnabled: boolean;
		openResultsSideBySide: boolean;
		postProcessOpenInNewFile: boolean;
		showPositions: boolean;
	},
	deps: Readonly<{ notifier: Notifier; telemetry: Telemetry }>,
): Promise<void> {
	const all = formattedPaths.join('\n');
	const pathsContent = positioned(all, config.showPositions);
	// The copy is its own text: whether it carries positions is a separate setting.
	const forClipboard = config.copyToClipboardEnabled
		? positioned(all, config.clipboardIncludesPositions)
		: undefined;

	if (config.openResultsSideBySide) {
		await openInSideBySide(pathsContent, forClipboard, deps.notifier);
		showSuccessMessage(pathCount, document.languageId, deps);
		return;
	}

	if (config.postProcessOpenInNewFile) {
		await openInNewFile(pathsContent, forClipboard, deps.notifier);
		showSuccessMessage(pathCount, document.languageId, deps);
		return;
	}

	const replaced = await replaceCurrentDocument(
		document,
		pathsContent,
		forClipboard,
		deps.notifier,
	);
	if (!replaced) {
		deps.notifier.showError(
			vscode.l10n.t(
				'Could not replace the document contents: the edit was rejected.',
			),
		);
		return;
	}
	showSuccessMessage(pathCount, document.languageId, deps);
}

async function openInSideBySide(
	content: string,
	forClipboard: string | undefined,
	notifier: Notifier,
): Promise<void> {
	const doc = await vscode.workspace.openTextDocument({
		content,
		language: 'plaintext',
	});
	await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

	if (forClipboard !== undefined) {
		await copyResults(forClipboard, notifier);
	}
}

async function openInNewFile(
	content: string,
	forClipboard: string | undefined,
	notifier: Notifier,
): Promise<void> {
	const doc = await vscode.workspace.openTextDocument({
		content,
		language: 'plaintext',
	});
	await vscode.window.showTextDocument(doc);

	if (forClipboard !== undefined) {
		await copyResults(forClipboard, notifier);
	}
}

/** Returns false when the workspace rejected the edit. */
async function replaceCurrentDocument(
	document: vscode.TextDocument,
	content: string,
	forClipboard: string | undefined,
	notifier: Notifier,
): Promise<boolean> {
	const edit = new vscode.WorkspaceEdit();
	edit.replace(document.uri, fullDocumentRange(document), content);
	// applyEdit resolves false for a read-only document, or one that changed
	// underneath the command. Discarding it announced "Extracted N paths" over
	// a document that still held its original text.
	const applied = await vscode.workspace.applyEdit(edit);
	if (!applied) {
		return false;
	}

	if (forClipboard !== undefined) {
		await copyResults(forClipboard, notifier);
	}
	return true;
}

/**
 * Copy to the clipboard, reporting a failure as a warning.
 *
 * The results are already in an editor by the time this runs, so a clipboard
 * that is unavailable — a remote or headless session — must not surface as
 * "Failed to extract paths": that misattributes the failure and reads as
 * though nothing happened.
 */
async function copyResults(content: string, notifier: Notifier): Promise<void> {
	try {
		await vscode.env.clipboard.writeText(content);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown error';
		notifier.showWarning(
			vscode.l10n.t(
				'Extracted the paths, but could not copy them to the clipboard: {0}',
				message,
			),
		);
	}
}

export function showSuccessMessage(
	pathCount: number,
	languageId: string,
	deps: Readonly<{ notifier: Notifier; telemetry: Telemetry }>,
): void {
	deps.notifier.showInfo(
		vscode.l10n.t('Extracted {0} paths from document', pathCount),
	);
	deps.telemetry.event('extract-success', {
		count: pathCount,
		language: languageId,
	});
}
