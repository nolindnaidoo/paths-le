import * as vscode from 'vscode';

/**
 * The range covering a document's entire contents.
 *
 * The end is the real end of the last line. `Range(0, 0, lineCount, 0)` covers
 * the same text — VS Code clamps the out-of-range position to the document end
 * — but it only works by way of that clamping, and it read as though it might
 * drop the final line. This says what it means.
 */
export function fullDocumentRange(document: vscode.TextDocument): vscode.Range {
	return new vscode.Range(
		document.positionAt(0),
		document.lineAt(document.lineCount - 1).range.end,
	);
}
