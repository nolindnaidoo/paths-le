import * as vscode from 'vscode';
import type { Configuration } from '../types';

export function getConfiguration(): Configuration {
	const config = vscode.workspace.getConfiguration('paths-le');

	// Backward-compat: support both `notificationLevel` (preferred) and legacy `notificationsLevel`
	const notifRaw = config.get(
		'notificationLevel',
		config.get('notificationsLevel', 'silent'),
	) as unknown as string;
	const notificationsLevel = isValidNotificationLevel(notifRaw)
		? notifRaw
		: 'silent';

	return Object.freeze({
		copyToClipboardEnabled: Boolean(
			config.get('copyToClipboardEnabled', false),
		),
		dedupeEnabled: Boolean(config.get('dedupeEnabled', false)),
		notificationsLevel,
		postProcessOpenInNewFile: Boolean(
			config.get('postProcess.openInNewFile', false),
		),
		openResultsSideBySide: Boolean(config.get('openResultsSideBySide', false)),
		safetyEnabled: Boolean(config.get('safety.enabled', true)),
		safetyFileSizeWarnBytes: Math.max(
			1000,
			Number(config.get('safety.fileSizeWarnBytes', 1000000)),
		),
		safetyLargeOutputLinesThreshold: Math.max(
			100,
			Number(config.get('safety.largeOutputLinesThreshold', 50000)),
		),
		safetyManyDocumentsThreshold: Math.max(
			1,
			Number(config.get('safety.manyDocumentsThreshold', 8)),
		),
		showParseErrors: Boolean(config.get('showParseErrors', false)),
		statusBarEnabled: Boolean(config.get('statusBar.enabled', true)),
		telemetryEnabled: Boolean(config.get('telemetryEnabled', false)),
		analysisEnabled: Boolean(config.get('analysis.enabled', true)),
		analysisIncludeValidation: Boolean(
			config.get('analysis.includeValidation', true),
		),
		analysisIncludePatterns: Boolean(
			config.get('analysis.includePatterns', true),
		),
		validationEnabled: Boolean(config.get('validation.enabled', true)),
		validationCheckExistence: Boolean(
			config.get('validation.checkExistence', true),
		),
		validationCheckPermissions: Boolean(
			config.get('validation.checkPermissions', false),
		),
		performanceEnabled: Boolean(config.get('performance.enabled', true)),
		performanceMaxDuration: Math.max(
			1000,
			Number(config.get('performance.maxDuration', 5000)),
		),
		performanceMaxMemoryUsage: Math.max(
			1048576,
			Number(config.get('performance.maxMemoryUsage', 104857600)),
		),
		performanceMaxCpuUsage: Math.max(
			100000,
			Number(config.get('performance.maxCpuUsage', 1000000)),
		),
		performanceMinThroughput: Math.max(
			100,
			Number(config.get('performance.minThroughput', 1000)),
		),
		performanceMaxCacheSize: Math.max(
			100,
			Number(config.get('performance.maxCacheSize', 1000)),
		),
		keyboardShortcutsEnabled: Boolean(
			config.get('keyboard.shortcuts.enabled', true),
		),
		keyboardExtractShortcut: String(
			config.get('keyboard.extractShortcut', 'ctrl+alt+p'),
		),
		keyboardValidateShortcut: String(
			config.get('keyboard.validateShortcut', 'ctrl+alt+v'),
		),
		keyboardAnalyzeShortcut: String(
			config.get('keyboard.analyzeShortcut', 'ctrl+alt+a'),
		),
		presetsEnabled: Boolean(config.get('presets.enabled', true)),
		defaultPreset: isValidPreset(
			config.get('presets.defaultPreset', 'balanced'),
		)
			? (config.get('presets.defaultPreset', 'balanced') as
					| 'minimal'
					| 'balanced'
					| 'comprehensive'
					| 'performance'
					| 'validation')
			: 'balanced',
		resolution: Object.freeze({
			resolveSymlinks: Boolean(config.get('resolution.resolveSymlinks', false)),
			resolveWorkspaceRelative: Boolean(
				config.get('resolution.resolveWorkspaceRelative', false),
			),
		}),
		validation: Object.freeze({
			enabled: Boolean(config.get('validation.enabled', true)),
			checkExistence: Boolean(config.get('validation.checkExistence', true)),
			checkPermissions: Boolean(
				config.get('validation.checkPermissions', false),
			),
		}),
	});
}

export type NotificationLevel = 'all' | 'important' | 'silent';

export function isValidNotificationLevel(v: unknown): v is NotificationLevel {
	return v === 'all' || v === 'important' || v === 'silent';
}

export type PresetType =
	| 'minimal'
	| 'balanced'
	| 'comprehensive'
	| 'performance'
	| 'validation';

export function isValidPreset(v: unknown): v is PresetType {
	return (
		v === 'minimal' ||
		v === 'balanced' ||
		v === 'comprehensive' ||
		v === 'performance' ||
		v === 'validation'
	);
}
