import * as vscode from 'vscode';
import type { Notifier } from '../ui/notifier';
import { fullDocumentRange } from '../utils/document';

export function registerDedupeCommand(
	context: vscode.ExtensionContext,
	notifier: Notifier,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.postProcess.dedupe',
		async () => {
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

			const deduped = deduplicateLines(lines);

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
			notifier.showInfo(
				`Removed ${removedCount} duplicate paths (${deduped.length} remaining)`,
			);
		},
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
