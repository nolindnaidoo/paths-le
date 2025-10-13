import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';

export interface Telemetry {
	event(name: string, properties?: Record<string, unknown>): void;
	dispose(): void;
}

export function createTelemetry(): Telemetry {
	const config = getConfiguration();
	let outputChannel: vscode.OutputChannel | undefined;

	if (config.telemetryEnabled) {
		outputChannel = vscode.window.createOutputChannel('Paths-LE Telemetry');
	}

	return Object.freeze({
		event(name: string, properties?: Record<string, unknown>): void {
			if (outputChannel) {
				const timestamp = new Date().toISOString();
				const props = properties ? ` ${JSON.stringify(properties)}` : '';
				outputChannel.appendLine(`[${timestamp}] ${name}${props}`);
			}
		},
		dispose(): void {
			outputChannel?.dispose();
		},
	});
}
