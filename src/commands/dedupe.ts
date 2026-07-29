import * as vscode from 'vscode';

export function registerDedupeCommand(context: vscode.ExtensionContext): void {
	const command = vscode.commands.registerCommand(
		'paths-le.postProcess.dedupe',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage('No active editor found');
				return;
			}

			const document = editor.document;
			const text = document.getText();
			const lines = text.split('\n').map((line) => line.trim());

			const deduped = deduplicateLines(lines);

			const edit = new vscode.WorkspaceEdit();
			edit.replace(
				document.uri,
				new vscode.Range(0, 0, document.lineCount, 0),
				deduped.join('\n'),
			);
			await vscode.workspace.applyEdit(edit);

			const removedCount = lines.length - deduped.length;
			vscode.window.showInformationMessage(
				`Removed ${removedCount} duplicate paths (${deduped.length} remaining)`,
			);
		},
	);

	context.subscriptions.push(command);
}

function deduplicateLines(lines: string[]): string[] {
	const seen = new Set<string>();
	const deduped: string[] = [];

	for (const line of lines) {
		if (line === '' || seen.has(line)) {
			continue;
		}

		seen.add(line);
		deduped.push(line);
	}

	return deduped;
}
