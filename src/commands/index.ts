import type * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { registerDedupeCommand } from './dedupe';
import { registerExtractCommand } from './extract';
import { registerHelpCommand } from './help';
import { registerSortCommand } from './sort';

export function registerCommands(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	registerExtractCommand(context, deps);
	registerDedupeCommand(context);
	registerSortCommand(context);
	registerHelpCommand(context, deps);
}
