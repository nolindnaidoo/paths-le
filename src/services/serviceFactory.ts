import type * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import { createTelemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import { createNotifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { createStatusBar } from '../ui/statusBar';

/**
 * Core services used throughout the extension
 */
export interface ExtensionServices {
	readonly telemetry: Telemetry;
	readonly notifier: Notifier;
	readonly statusBar: StatusBar;
}

/**
 * Creates all core services for the extension
 * Centralizes service initialization and dependency management
 */
export function createServices(
	context: vscode.ExtensionContext,
): ExtensionServices {
	const telemetry = createTelemetry();
	const notifier = createNotifier();
	const statusBar = createStatusBar(context);

	context.subscriptions.push(telemetry, statusBar);

	return Object.freeze({
		telemetry,
		notifier,
		statusBar,
	});
}
