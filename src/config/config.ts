import * as vscode from 'vscode';
import type { Configuration } from '../types';

/**
 * Fallback values, kept identical to the defaults declared in
 * package.json contributes.configuration. A unit test asserts parity so
 * the two can never drift again.
 */
export const CONFIG_DEFAULTS = Object.freeze({
	copyToClipboardEnabled: false,
	notificationsLevel: 'silent' as const,
	postProcessOpenInNewFile: true,
	openResultsSideBySide: true,
	safetyEnabled: true,
	safetyFileSizeWarnBytes: 1_000_000,
	safetyLargeOutputLinesThreshold: 50_000,
	statusBarEnabled: true,
	telemetryEnabled: false,
	resolveSymlinks: false,
	resolveWorkspaceRelative: false,
});

export function getConfiguration(): Configuration {
	const config = vscode.workspace.getConfiguration('paths-le');

	return Object.freeze({
		copyToClipboardEnabled: readBoolean(
			config,
			'copyToClipboardEnabled',
			CONFIG_DEFAULTS.copyToClipboardEnabled,
		),
		notificationsLevel: readNotificationLevel(config),
		postProcessOpenInNewFile: readBoolean(
			config,
			'postProcess.openInNewFile',
			CONFIG_DEFAULTS.postProcessOpenInNewFile,
		),
		openResultsSideBySide: readBoolean(
			config,
			'openResultsSideBySide',
			CONFIG_DEFAULTS.openResultsSideBySide,
		),
		safetyEnabled: readBoolean(
			config,
			'safety.enabled',
			CONFIG_DEFAULTS.safetyEnabled,
		),
		safetyFileSizeWarnBytes: readNumber(
			config,
			'safety.fileSizeWarnBytes',
			CONFIG_DEFAULTS.safetyFileSizeWarnBytes,
			1000,
		),
		safetyLargeOutputLinesThreshold: readNumber(
			config,
			'safety.largeOutputLinesThreshold',
			CONFIG_DEFAULTS.safetyLargeOutputLinesThreshold,
			100,
		),
		statusBarEnabled: readBoolean(
			config,
			'statusBar.enabled',
			CONFIG_DEFAULTS.statusBarEnabled,
		),
		telemetryEnabled: readBoolean(
			config,
			'telemetryEnabled',
			CONFIG_DEFAULTS.telemetryEnabled,
		),
		resolution: Object.freeze({
			resolveSymlinks: readBoolean(
				config,
				'resolution.resolveSymlinks',
				CONFIG_DEFAULTS.resolveSymlinks,
			),
			resolveWorkspaceRelative: readBoolean(
				config,
				'resolution.resolveWorkspaceRelative',
				CONFIG_DEFAULTS.resolveWorkspaceRelative,
			),
		}),
	});
}

function readBoolean(
	config: vscode.WorkspaceConfiguration,
	key: string,
	defaultValue: boolean,
): boolean {
	const value = config.get(key, defaultValue);
	return typeof value === 'boolean' ? value : defaultValue;
}

function readNumber(
	config: vscode.WorkspaceConfiguration,
	key: string,
	defaultValue: number,
	minValue: number,
): number {
	const value = Number(config.get(key, defaultValue));
	if (!Number.isFinite(value)) {
		return defaultValue;
	}
	return Math.max(minValue, value);
}

export type NotificationLevel = 'all' | 'important' | 'silent';

export function isValidNotificationLevel(v: unknown): v is NotificationLevel {
	return v === 'all' || v === 'important' || v === 'silent';
}

function readNotificationLevel(
	config: vscode.WorkspaceConfiguration,
): NotificationLevel {
	const raw = config.get<string>(
		'notificationsLevel',
		CONFIG_DEFAULTS.notificationsLevel,
	);
	return isValidNotificationLevel(raw)
		? raw
		: CONFIG_DEFAULTS.notificationsLevel;
}
