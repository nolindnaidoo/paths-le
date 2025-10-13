import * as vscode from 'vscode';

export interface Notifier {
	showInfo(message: string): void;
	showWarning(message: string): void;
	showError(message: string): void;
}

export function createNotifier(): Notifier {
	return Object.freeze({
		showInfo(message: string): void {
			vscode.window.showInformationMessage(message);
		},
		showWarning(message: string): void {
			vscode.window.showWarningMessage(message);
		},
		showError(message: string): void {
			vscode.window.showErrorMessage(message);
		},
	});
}
