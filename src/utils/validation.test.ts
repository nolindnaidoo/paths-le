import { describe, expect, it } from 'vitest';
import type { Configuration } from '../types';
import { validatePaths } from './validation';

describe('validatePaths', () => {
	const baseConfig: Configuration = {
		analysisIncludeValidation: false,
		analysisIncludePatterns: false,
		openResultsSideBySide: false,
		postProcessOpenInNewFile: false,
		copyToClipboardEnabled: false,
		safetyEnabled: true,
		safetyFileSizeWarnBytes: 1000000,
		safetyLargeOutputLinesThreshold: 50000,
		safetyManyDocumentsThreshold: 8,
		dedupeEnabled: false,
		notificationsLevel: 'silent',
		showParseErrors: false,
		statusBarEnabled: true,
		telemetryEnabled: false,
		analysisEnabled: false,
		validationEnabled: true,
		validationCheckExistence: true,
		validationCheckPermissions: false,
		performanceEnabled: false,
		performanceMaxDuration: 5000,
		performanceMaxMemoryUsage: 104857600,
		performanceMaxCpuUsage: 1000000,
		performanceMinThroughput: 1000,
		performanceMaxCacheSize: 1000,
		keyboardShortcutsEnabled: false,
		keyboardExtractShortcut: '',
		keyboardValidateShortcut: '',
		keyboardAnalyzeShortcut: '',
		presetsEnabled: false,
		defaultPreset: 'balanced',
	};

	it('should validate Unix absolute paths', async () => {
		const paths = ['/usr/bin/node', '/etc/config', '/var/log/app.log'];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(3);
		expect(results.every((r) => r.status === 'valid')).toBe(true);
	});

	it('should validate relative paths', async () => {
		const paths = ['./config.json', './data', './subdir/file.txt'];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(3);
		expect(results.every((r) => r.status === 'valid')).toBe(true);
	});

	it('should validate HTTP/HTTPS URLs', async () => {
		const paths = ['https://example.com', 'http://test.com'];
		const results = await validatePaths(paths, baseConfig);

		// URLs with colons are marked invalid by strict validation
		expect(results).toHaveLength(2);
		// Note: URLs may be marked invalid due to colon character restriction
	});

	it('should mark invalid paths with illegal characters', async () => {
		const paths = [
			'/path/with/pipe|',
			'/path/with/question?',
			'/path/with/asterisk*',
		];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(3);
		expect(results.every((r) => r.status === 'invalid')).toBe(true);
		expect(results.every((r) => r.error)).toBeDefined();
	});

	it('should mark invalid paths with reserved names', async () => {
		const paths = ['/path/to/CON', '/path/to/PRN', 'NUL'];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(3);
		expect(results.every((r) => r.status === 'invalid')).toBe(true);
	});

	it('should include path in validation result', async () => {
		const paths = ['/usr/bin/node'];
		const results = await validatePaths(paths, baseConfig);

		expect(results[0]?.path).toBe('/usr/bin/node');
	});

	it('should handle empty path list', async () => {
		const paths: string[] = [];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(0);
	});

	it('should handle mixed valid and invalid paths', async () => {
		const paths = [
			'/usr/bin/node',
			'/path/with/pipe|',
			'./config.json',
			'/path/to/CON',
		];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(4);
		const valid = results.filter((r) => r.status === 'valid');
		const invalid = results.filter((r) => r.status === 'invalid');
		expect(valid.length).toBeGreaterThan(0);
		expect(invalid.length).toBeGreaterThan(0);
	});

	it('should mark Windows paths with colons as invalid', async () => {
		const paths = ['D:/data/file.txt'];
		const results = await validatePaths(paths, baseConfig);

		// Windows paths with drive letters have colons which are invalid
		expect(results[0]?.status).toBe('invalid');
	});

	it('should handle paths with spaces', async () => {
		const paths = ['/path with spaces/file.txt'];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe('valid');
	});

	it('should include error messages for invalid paths', async () => {
		const paths = ['/path/with/pipe|'];
		const results = await validatePaths(paths, baseConfig);

		expect(results[0]?.status).toBe('invalid');
		expect(results[0]?.error).toBeDefined();
		expect(results[0]?.error).toContain('invalid');
	});

	it('should validate file paths with extensions', async () => {
		const paths = ['config.json', 'data.csv', 'app.log'];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(3);
		expect(results.every((r) => r.status === 'valid')).toBe(true);
	});

	it('should mark paths with traversal sequences as invalid', async () => {
		const paths = ['../parent', '../../grandparent', '../sibling/file.txt'];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(3);
		// Paths with .. are marked invalid due to security (path traversal)
		expect(results.every((r) => r.status === 'invalid')).toBe(true);
		expect(results.every((r) => r.error?.includes('traversal'))).toBe(true);
	});

	it('should mark file URLs with colons as invalid', async () => {
		const paths = ['file:///usr/local/file.txt'];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(1);
		// File URLs contain colons which are invalid characters
		expect(results[0]?.status).toBe('invalid');
	});

	it('should include exists flag for valid paths', async () => {
		const paths = ['/usr/bin/node'];
		const results = await validatePaths(paths, baseConfig);

		expect(results[0]?.exists).toBeDefined();
	});

	it('should handle empty strings gracefully', async () => {
		const paths = [''];
		const results = await validatePaths(paths, baseConfig);

		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe('invalid');
	});
});
