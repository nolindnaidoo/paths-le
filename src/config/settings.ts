import * as vscode from 'vscode';
import { guarded } from '../commands/guard';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';

export function registerOpenSettingsCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{ telemetry: Telemetry; notifier: Notifier }>,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.openSettings',
		guarded(deps.notifier, async () => {
			deps.telemetry.event('command-open-settings');
			await vscode.commands.executeCommand(
				'workbench.action.openSettings',
				'paths-le',
			);
		}),
	);

	context.subscriptions.push(command);
}
