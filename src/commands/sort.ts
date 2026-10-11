import * as vscode from 'vscode';
import type { Notifier } from '../ui/notifier';
import { fullDocumentRange } from '../utils/document';
import { onValues } from '../utils/positions';
import { guarded } from './guard';

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
		guarded(notifier, async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				notifier.showWarning(vscode.l10n.t('No active editor found'));
				return;
			}

			const sortOption = await promptSortOrder();
			if (!sortOption) {
				return;
			}

			const document = editor.document;
			const lines = extractLines(document.getText());
			// By value, so a position shown on a line travels with it.
			const sorted = onValues(lines, (values) =>
				sortLines(values, sortOption.value),
			);

			const replaced = await replaceDocumentContent(document, sorted);
			if (!replaced) {
				notifier.showError(
					vscode.l10n.t('Could not sort: the edit was rejected.'),
				);
				return;
			}

			notifier.showInfo(
				vscode.l10n.t(
					'Sorted {0} paths ({1})',
					sorted.length,
					sortOption.label,
				),
			);
		}),
	);

	context.subscriptions.push(command);
}

async function promptSortOrder(): Promise<SortOption | undefined> {
	const options: SortOption[] = [
		{ label: vscode.l10n.t('Alphabetical (A → Z)'), value: 'asc' },
		{ label: vscode.l10n.t('Alphabetical (Z → A)'), value: 'desc' },
		{ label: vscode.l10n.t('By Length (Short → Long)'), value: 'length-asc' },
		{ label: vscode.l10n.t('By Length (Long → Short)'), value: 'length-desc' },
	];

	return vscode.window.showQuickPick(options, {
		placeHolder: vscode.l10n.t('Select sort order'),
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
		return [...lines].sort(byCodeUnit);
	}

	return [...lines].sort((a, b) => byCodeUnit(b, a));
}

/**
 * A plain comparison rather than `localeCompare`: the order must not change
 * with the machine's locale. The scan and the workspace report follow the
 * same rule, so one list sorts the same way everywhere it is shown.
 */
function byCodeUnit(a: string, b: string): number {
	return a < b ? -1 : Number(a > b);
}

/** Returns false when the workspace rejected the edit. */
async function replaceDocumentContent(
	document: vscode.TextDocument,
	lines: string[],
): Promise<boolean> {
	const edit = new vscode.WorkspaceEdit();
	edit.replace(document.uri, fullDocumentRange(document), lines.join('\n'));
	// applyEdit resolves false for a read-only document, or one that changed
	// underneath the command.
	return await vscode.workspace.applyEdit(edit);
}
