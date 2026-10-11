import * as vscode from 'vscode';
import type { Notifier } from '../ui/notifier';
import { fullDocumentRange } from '../utils/document';
import { hasPosition, onValues } from '../utils/positions';
import { guarded } from './guard';

export function registerDedupeCommand(
	context: vscode.ExtensionContext,
	notifier: Notifier,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.postProcess.dedupe',
		guarded(notifier, async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				notifier.showWarning(vscode.l10n.t('No active editor found'));
				return;
			}

			const document = editor.document;
			const lines = document
				.getText()
				.split('\n')
				.map((line) => line.trim())
				.filter((line) => line.length > 0);

			// By value: with positions shown every line is different, and a
			// dedupe over whole lines would remove nothing.
			const deduped = onValues(lines, deduplicateLines);

			const edit = new vscode.WorkspaceEdit();
			edit.replace(
				document.uri,
				fullDocumentRange(document),
				deduped.join('\n'),
			);
			// applyEdit resolves false for a read-only document, or one that
			// changed underneath the command.
			const applied = await vscode.workspace.applyEdit(edit);
			if (!applied) {
				notifier.showError(
					vscode.l10n.t('Could not deduplicate: the edit was rejected.'),
				);
				return;
			}

			const removedCount = lines.length - deduped.length;
			// Two whole sentences rather than one with a suffix: a translation
			// cannot be assembled from parts that each read right on their own.
			notifier.showInfo(
				lines.some(hasPosition)
					? vscode.l10n.t(
							'Removed {0} duplicate paths ({1} remaining). Each path shows its first position only.',
							removedCount,
							deduped.length,
						)
					: vscode.l10n.t(
							'Removed {0} duplicate paths ({1} remaining)',
							removedCount,
							deduped.length,
						),
			);
		}),
	);

	context.subscriptions.push(command);
}

function deduplicateLines(lines: readonly string[]): string[] {
	const seen = new Set<string>();
	const deduped: string[] = [];

	for (const line of lines) {
		if (seen.has(line)) {
			continue;
		}

		seen.add(line);
		deduped.push(line);
	}

	return deduped;
}
