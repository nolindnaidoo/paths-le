import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	DEFAULT_EXCLUDED_FILES,
	DEFAULT_EXCLUDED_FOLDERS,
	DEFAULT_EXCLUDED_PATHS,
} from '../workspace/defaults';
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
		'paths-le.clipboardIncludesPositions': 'clipboardIncludesPositions',
		'paths-le.copyToClipboardEnabled': 'copyToClipboardEnabled',
		'paths-le.notificationsLevel': 'notificationsLevel',
		'paths-le.postProcess.openInNewFile': 'postProcessOpenInNewFile',
		'paths-le.openResultsSideBySide': 'openResultsSideBySide',
		'paths-le.safety.enabled': 'safetyEnabled',
		'paths-le.safety.fileSizeWarnBytes': 'safetyFileSizeWarnBytes',
		'paths-le.safety.largeOutputLinesThreshold':
			'safetyLargeOutputLinesThreshold',
		'paths-le.showPositions': 'showPositions',
		'paths-le.statusBar.enabled': 'statusBarEnabled',
		'paths-le.telemetryEnabled': 'telemetryEnabled',
		'paths-le.workspace.scanAlwaysInclude': 'workspaceScanAlwaysInclude',
		'paths-le.workspace.scanExcludes': 'workspaceScanExcludes',
		'paths-le.workspace.scanMaxFiles': 'workspaceScanMaxFiles',
		'paths-le.workspace.scanMaxResults': 'workspaceScanMaxResults',
		'paths-le.workspace.scanPatterns': 'workspaceScanPatterns',
		'paths-le.workspace.scanRespectGitignore': 'workspaceScanRespectGitignore',
		'paths-le.workspace.scanSkipBinaryFiles': 'workspaceScanSkipBinaryFiles',
		'paths-le.workspace.scanUseDefaultExcludes':
			'workspaceScanUseDefaultExcludes',
		'paths-le.resolution.resolveSymlinks': 'resolveSymlinks',
		'paths-le.resolution.resolveWorkspaceRelative': 'resolveWorkspaceRelative',
	};

	it('covers every declared setting', () => {
		expect(Object.keys(props).sort()).toEqual(Object.keys(KEY_MAP).sort());
	});

	for (const [manifestKey, defaultsKey] of Object.entries(KEY_MAP)) {
		it(`${manifestKey} default matches`, () => {
			expect(CONFIG_DEFAULTS[defaultsKey]).toEqual(props[manifestKey]?.default);
		});
	}
});

describe('the README states the scan limits the code uses', () => {
	const readme = readFileSync(join(__dirname, '..', '..', 'README.md'), 'utf8');
	// Grouped by hand, not by Intl. The first Intl call in a process loads its
	// locale data, and on a Windows runner that once took sixteen seconds
	// inside a test that only compares two strings.
	const grouped = (n: number) =>
		String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

	it('in the settings table', () => {
		expect(readme).toContain(
			`| \`paths-le.workspace.scanMaxFiles\` | \`${CONFIG_DEFAULTS.workspaceScanMaxFiles}\` |`,
		);
		expect(readme).toContain(
			`| \`paths-le.workspace.scanMaxResults\` | \`${CONFIG_DEFAULTS.workspaceScanMaxResults}\` |`,
		);
	});

	it('in the prose', () => {
		expect(readme).toContain(
			`It stops at ${grouped(CONFIG_DEFAULTS.workspaceScanMaxFiles)} files or ${grouped(CONFIG_DEFAULTS.workspaceScanMaxResults)} listed occurrences.`,
		);
	});
});

describe('the README lists the folders a scan skips', () => {
	it('exactly as the code has them', () => {
		const readme = readFileSync(
			join(__dirname, '..', '..', 'README.md'),
			'utf8',
		);
		const listed =
			/<!-- built-in-folders -->\n(.*)\n<!-- \/built-in-folders -->/
				.exec(readme)?.[1]
				?.split(', ')
				.map((entry) => entry.replace(/`/g, ''));
		expect(listed).toEqual([...DEFAULT_EXCLUDED_FOLDERS, '*.egg-info']);
	});

	it('and the files, exactly as the code has them', () => {
		const readme = readFileSync(
			join(__dirname, '..', '..', 'README.md'),
			'utf8',
		);
		const listed = /<!-- built-in-files -->\n(.*)\n<!-- \/built-in-files -->/
			.exec(readme)?.[1]
			?.split(', ')
			.map((entry) => entry.replace(/`/g, ''));
		expect(listed).toEqual([
			...DEFAULT_EXCLUDED_FILES,
			...DEFAULT_EXCLUDED_PATHS,
		]);
	});
});
