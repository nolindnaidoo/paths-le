import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { getConfiguration } from '../config/config';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

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
		statusBarItem.text = localize(
			'runtime.statusbar.text',
			'$(file-directory) Paths-LE',
		);
		statusBarItem.tooltip = localize(
			'runtime.statusbar.tooltip',
			'Paths-LE: File Path Extraction',
		);
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
				statusBarItem.text = localize(
					'runtime.statusbar.text',
					'$(file-directory) Paths-LE',
				);
			}
		},
		dispose(): void {
			statusBarItem?.dispose();
		},
	});
}
