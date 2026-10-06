import * as vscode from 'vscode';
import type { Configuration } from '../types';

/**
 * The defaults, exported for the parity gate.
 *
 * Nothing else imports this: `config.test.ts` asserts it matches every
 * default declared in package.json, which is the invariant that stops the
 * two drifting apart. The export is the seam that test needs.
 */
export const CONFIG_DEFAULTS = Object.freeze({
	clipboardIncludesPositions: false,
	copyToClipboardEnabled: false,
	notificationsLevel: 'silent' as const,
	postProcessOpenInNewFile: true,
	openResultsSideBySide: true,
	safetyEnabled: true,
	safetyFileSizeWarnBytes: 1_000_000,
	safetyLargeOutputLinesThreshold: 50_000,
	showPositions: false,
	statusBarEnabled: true,
	telemetryEnabled: false,
	workspaceScanAlwaysInclude: Object.freeze([]) as readonly string[],
	workspaceScanExcludes: Object.freeze([]) as readonly string[],
	workspaceScanMaxFiles: 5000,
	workspaceScanMaxResults: 10000,
	workspaceScanPatterns: Object.freeze(['**/*']) as readonly string[],
	workspaceScanRespectGitignore: true,
	workspaceScanSkipBinaryFiles: true,
	workspaceScanUseDefaultExcludes: true,
	resolveSymlinks: false,
	resolveWorkspaceRelative: false,
});

export function getConfiguration(): Configuration {
	const config = vscode.workspace.getConfiguration('paths-le');

	return Object.freeze({
		clipboardIncludesPositions: readBoolean(
			config,
			'clipboardIncludesPositions',
			CONFIG_DEFAULTS.clipboardIncludesPositions,
		),
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
		showPositions: readBoolean(
			config,
			'showPositions',
			CONFIG_DEFAULTS.showPositions,
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
		workspaceScanAlwaysInclude: readStrings(
			config,
			'workspace.scanAlwaysInclude',
			CONFIG_DEFAULTS.workspaceScanAlwaysInclude,
		),
		workspaceScanExcludes: readStrings(
			config,
			'workspace.scanExcludes',
			CONFIG_DEFAULTS.workspaceScanExcludes,
		),
		workspaceScanMaxFiles: readNumber(
			config,
			'workspace.scanMaxFiles',
			CONFIG_DEFAULTS.workspaceScanMaxFiles,
			1,
		),
		workspaceScanMaxResults: readNumber(
			config,
			'workspace.scanMaxResults',
			CONFIG_DEFAULTS.workspaceScanMaxResults,
			1,
		),
		workspaceScanPatterns: readStrings(
			config,
			'workspace.scanPatterns',
			CONFIG_DEFAULTS.workspaceScanPatterns,
		),
		workspaceScanRespectGitignore: readBoolean(
			config,
			'workspace.scanRespectGitignore',
			CONFIG_DEFAULTS.workspaceScanRespectGitignore,
		),
		workspaceScanSkipBinaryFiles: readBoolean(
			config,
			'workspace.scanSkipBinaryFiles',
			CONFIG_DEFAULTS.workspaceScanSkipBinaryFiles,
		),
		workspaceScanUseDefaultExcludes: readBoolean(
			config,
			'workspace.scanUseDefaultExcludes',
			CONFIG_DEFAULTS.workspaceScanUseDefaultExcludes,
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

function readStrings(
	config: vscode.WorkspaceConfiguration,
	key: string,
	defaultValue: readonly string[],
): readonly string[] {
	const value = config.get<unknown>(key, defaultValue);
	return Object.freeze(
		Array.isArray(value)
			? value.filter((item): item is string => typeof item === 'string')
			: [...defaultValue],
	);
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
