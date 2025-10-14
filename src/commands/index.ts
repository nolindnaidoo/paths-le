import type * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import type { ErrorHandler } from '../utils/errorHandling';
import type { Localizer } from '../utils/localization';
import type { PerformanceMonitor } from '../utils/performance';
import { registerAnalyzeCommand } from './analyze';
import { registerExtractCommand } from './extract';
import { registerHelpCommand } from './help';

export function registerCommands(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
		localizer: Localizer;
		performanceMonitor: PerformanceMonitor;
		errorHandler: ErrorHandler;
	}>,
): void {
	registerExtractCommand(context, deps);
	registerAnalyzeCommand(context, deps);
	registerHelpCommand(context, deps);
}
