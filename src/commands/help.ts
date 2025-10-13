import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { createHelpWebView } from '../ui/webView';

export function registerHelpCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const webView = createHelpWebView(context, deps.telemetry);

	const command = vscode.commands.registerCommand('paths-le.help', async () => {
		deps.telemetry.event('command-help');
		webView.show();
		deps.telemetry.event('help-displayed');
	});

	context.subscriptions.push(command);
	context.subscriptions.push(webView);
}
