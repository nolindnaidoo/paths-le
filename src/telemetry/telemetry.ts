import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';

export interface Telemetry {
	event(name: string, properties?: Record<string, unknown>): void;
	dispose(): void;
}

export function createTelemetry(): Telemetry {
	let outputChannel: vscode.OutputChannel | undefined;

	return Object.freeze({
		event(name: string, properties?: Record<string, unknown>): void {
			// Read per event rather than once at activation, so the setting takes
			// effect when it is changed. Read once, turning it on logged nothing
			// until the window was reloaded, and nothing told the user so.
			if (!getConfiguration().telemetryEnabled) {
				return;
			}
			outputChannel ??= vscode.window.createOutputChannel('Paths-LE Telemetry');
			const timestamp = new Date().toISOString();
			const props = properties ? ` ${JSON.stringify(properties)}` : '';
			outputChannel.appendLine(`[${timestamp}] ${name}${props}`);
		},
		dispose(): void {
			outputChannel?.dispose();
		},
	});
}
