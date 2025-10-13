import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';

export interface StatusBar {
	showProgress(message: string): void;
	hideProgress(): void;
	dispose(): void;
}

export function createStatusBar(context: vscode.ExtensionContext): StatusBar {
	const config = getConfiguration();
	let statusBarItem: vscode.StatusBarItem | undefined;

	if (config.statusBarEnabled) {
		statusBarItem = vscode.window.createStatusBarItem(
			vscode.StatusBarAlignment.Left,
			100,
		);
		statusBarItem.text = '$(file-directory) Paths-LE';
		statusBarItem.tooltip = 'Paths-LE: File Path Extraction';
		statusBarItem.command = 'paths-le.extractPaths';
		statusBarItem.show();

		context.subscriptions.push(statusBarItem);
	}

	return Object.freeze({
		showProgress(message: string): void {
			if (statusBarItem) {
				statusBarItem.text = `$(loading~spin) ${message}`;
			}
		},
		hideProgress(): void {
			if (statusBarItem) {
				statusBarItem.text = '$(file-directory) Paths-LE';
			}
		},
		dispose(): void {
			statusBarItem?.dispose();
		},
	});
}
