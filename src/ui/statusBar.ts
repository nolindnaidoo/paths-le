import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';

const IDLE_TEXT = '$(file-directory) Paths-LE';

export interface StatusBar {
	showProgress(message: string): void;
	hideProgress(): void;
	dispose(): void;
}

export function createStatusBar(context: vscode.ExtensionContext): StatusBar {
	const statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100,
	);
	statusBarItem.text = IDLE_TEXT;
	statusBarItem.tooltip = vscode.l10n.t('Paths-LE: File Path Extraction');
	statusBarItem.command = 'paths-le.extractPaths';
	context.subscriptions.push(statusBarItem);

	const applyVisibility = (): void => {
		if (getConfiguration().statusBarEnabled) {
			statusBarItem.show();
			return;
		}
		statusBarItem.hide();
	};
	applyVisibility();

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration('paths-le.statusBar.enabled')) {
				applyVisibility();
			}
		}),
	);

	return Object.freeze({
		showProgress(message: string): void {
			statusBarItem.text = `$(loading~spin) ${message}`;
		},
		hideProgress(): void {
			statusBarItem.text = IDLE_TEXT;
		},
		dispose(): void {
			statusBarItem.dispose();
		},
	});
}
