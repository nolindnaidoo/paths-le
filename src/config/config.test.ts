import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULTS } from './config';

/**
 * CONFIG_DEFAULTS must stay identical to the defaults declared in
 * package.json contributes.configuration — v1.x shipped with the two
 * silently disagreeing (openResultsSideBySide et al).
 */
describe('config defaults parity with package.json', () => {
	const manifest = JSON.parse(
		readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
	) as {
		contributes: {
			configuration: { properties: Record<string, { default: unknown }> };
		};
	};
	const props = manifest.contributes.configuration.properties;

	const KEY_MAP: Record<string, keyof typeof CONFIG_DEFAULTS> = {
		'paths-le.copyToClipboardEnabled': 'copyToClipboardEnabled',
		'paths-le.notificationsLevel': 'notificationsLevel',
		'paths-le.postProcess.openInNewFile': 'postProcessOpenInNewFile',
		'paths-le.openResultsSideBySide': 'openResultsSideBySide',
		'paths-le.safety.enabled': 'safetyEnabled',
		'paths-le.safety.fileSizeWarnBytes': 'safetyFileSizeWarnBytes',
		'paths-le.safety.largeOutputLinesThreshold':
			'safetyLargeOutputLinesThreshold',
		'paths-le.showParseErrors': 'showParseErrors',
		'paths-le.statusBar.enabled': 'statusBarEnabled',
		'paths-le.telemetryEnabled': 'telemetryEnabled',
		'paths-le.resolution.resolveSymlinks': 'resolveSymlinks',
		'paths-le.resolution.resolveWorkspaceRelative': 'resolveWorkspaceRelative',
	};

	it('covers every declared setting', () => {
		expect(Object.keys(props).sort()).toEqual(Object.keys(KEY_MAP).sort());
	});

	for (const [manifestKey, defaultsKey] of Object.entries(KEY_MAP)) {
		it(`${manifestKey} default matches`, () => {
			expect(CONFIG_DEFAULTS[defaultsKey]).toBe(props[manifestKey]?.default);
		});
	}
});
