import type * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import type { ErrorHandler } from '../utils/errorHandling';
import type { Localizer } from '../utils/localization';
import type { PerformanceMonitor } from '../utils/performance';
import { registerCreateTestFixtureCommand } from './createTestFixture';
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
		localizer: Localizer;
		performanceMonitor: PerformanceMonitor;
		errorHandler: ErrorHandler;
	}>,
): void {
	registerExtractCommand(context, deps);
	registerDedupeCommand(context);
	registerSortCommand(context);
	registerHelpCommand(context, deps);
	registerCreateTestFixtureCommand(context);
}
