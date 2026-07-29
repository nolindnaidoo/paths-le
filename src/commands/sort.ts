import * as vscode from 'vscode';
import type { Notifier } from '../ui/notifier';

type SortOrder = 'asc' | 'desc' | 'length-asc' | 'length-desc';

interface SortOption {
	readonly label: string;
	readonly value: SortOrder;
}

export function registerSortCommand(
	context: vscode.ExtensionContext,
	notifier: Notifier,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.postProcess.sort',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				notifier.showWarning('No active editor found');
				return;
			}

			const sortOption = await promptSortOrder();
			if (!sortOption) {
				return;
			}

			const document = editor.document;
			const lines = extractLines(document.getText());
			const sorted = sortLines(lines, sortOption.value);

			await replaceDocumentContent(document, sorted);

			notifier.showInfo(`Sorted ${sorted.length} paths (${sortOption.label})`);
		},
	);

	context.subscriptions.push(command);
}

async function promptSortOrder(): Promise<SortOption | undefined> {
	const options: SortOption[] = [
		{ label: 'Alphabetical (A → Z)', value: 'asc' },
		{ label: 'Alphabetical (Z → A)', value: 'desc' },
		{ label: 'By Length (Short → Long)', value: 'length-asc' },
		{ label: 'By Length (Long → Short)', value: 'length-desc' },
	];

	return vscode.window.showQuickPick(options, {
		placeHolder: 'Select sort order',
	});
}

function extractLines(text: string): string[] {
	return text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function sortLines(lines: string[], order: SortOrder): string[] {
	if (order === 'length-asc') {
		return [...lines].sort((a, b) => a.length - b.length);
	}

	if (order === 'length-desc') {
		return [...lines].sort((a, b) => b.length - a.length);
	}

	if (order === 'asc') {
		return [...lines].sort((a, b) => a.localeCompare(b));
	}

	return [...lines].sort((a, b) => b.localeCompare(a));
}

async function replaceDocumentContent(
	document: vscode.TextDocument,
	lines: string[],
): Promise<void> {
	const edit = new vscode.WorkspaceEdit();
	const fullRange = new vscode.Range(
		document.positionAt(0),
		document.lineAt(document.lineCount - 1).range.end,
	);
	edit.replace(document.uri, fullRange, lines.join('\n'));
	await vscode.workspace.applyEdit(edit);
}
