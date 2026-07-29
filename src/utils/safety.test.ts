import { describe, expect, it } from 'vitest';
import { _createDocument } from '../__mocks__/vscode';
import type { Configuration } from '../types';
import { handleSafetyChecks } from './safety';

function makeConfig(overrides: Partial<Configuration> = {}): Configuration {
	return {
		copyToClipboardEnabled: false,
		notificationsLevel: 'silent',
		postProcessOpenInNewFile: true,
		openResultsSideBySide: true,
		safetyEnabled: true,
		safetyFileSizeWarnBytes: 1_000_000,
		safetyLargeOutputLinesThreshold: 50_000,
		showParseErrors: false,
		statusBarEnabled: true,
		telemetryEnabled: false,
		resolution: { resolveSymlinks: false, resolveWorkspaceRelative: false },
		...overrides,
	};
}

function makeDocument(content: string) {
	return _createDocument({ content }) as never;
}

describe('handleSafetyChecks', () => {
	it('passes small documents', () => {
		const result = handleSafetyChecks(makeDocument('a=1'), makeConfig());
		expect(result.proceed).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});

	it('refuses documents over the size threshold', () => {
		const result = handleSafetyChecks(
			makeDocument('x'.repeat(2001)),
			makeConfig({ safetyFileSizeWarnBytes: 2000 }),
		);
		expect(result.proceed).toBe(false);
		expect(result.message).toContain('exceeds safety threshold');
	});

	it('skips all checks when safety is disabled', () => {
		const result = handleSafetyChecks(
			makeDocument('x'.repeat(5000)),
			makeConfig({ safetyEnabled: false, safetyFileSizeWarnBytes: 2000 }),
		);
		expect(result.proceed).toBe(true);
	});

	it('warns on line count over threshold', () => {
		const result = handleSafetyChecks(
			makeDocument('a\n'.repeat(200)),
			makeConfig({ safetyLargeOutputLinesThreshold: 100 }),
		);
		expect(result.proceed).toBe(true);
		expect(result.warnings.some((w) => w.includes('Large file'))).toBe(true);
	});

	it('warns on high estimated path density', () => {
		const paths = Array.from({ length: 1200 }, (_, i) => `/opt/p${i}`).join(
			'\n',
		);
		const result = handleSafetyChecks(makeDocument(paths), makeConfig());
		expect(result.warnings.some((w) => w.includes('Large number'))).toBe(true);
	});
});
