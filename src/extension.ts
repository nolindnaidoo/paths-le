import type * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerOpenSettingsCommand } from './config/settings';
import { registerMcpProvider } from './mcp/provider';
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

	// Register settings command
	registerOpenSettingsCommand(context, services.telemetry);

	// Log activation
	// Offer the bundled MCP server to agent mode, where the host supports it
	registerMcpProvider(context);

	services.telemetry.event('extension-activated');
}

/**
 * Extension deactivation
 * Cleanup is handled automatically via context.subscriptions
 */
export function deactivate(): void {
	// Extensions are automatically disposed via context.subscriptions
}
