import type * as vscode from 'vscode';
import { registerCommands } from './commands';
import {
	registerExportSettingsCommand,
	registerImportSettingsCommand,
	registerOpenSettingsCommand,
	registerResetSettingsCommand,
} from './config/settings';
import { createServices } from './services/serviceFactory';

/**
 * Extension activation entry point
 * Initializes services and registers all commands
 */
export function activate(context: vscode.ExtensionContext): void {
	// Initialize all core services
	const services = createServices(context);

	// Register all commands with dependencies
	registerCommands(context, services);

	// Register settings commands
	registerOpenSettingsCommand(context, services.telemetry);
	registerExportSettingsCommand(context, services.telemetry);
	registerImportSettingsCommand(context, services.telemetry);
	registerResetSettingsCommand(context, services.telemetry);

	// Log activation
	services.telemetry.event('extension-activated');
}

/**
 * Extension deactivation
 * Cleanup is handled automatically via context.subscriptions
 */
export function deactivate(): void {
	// Extensions are automatically disposed via context.subscriptions
}
