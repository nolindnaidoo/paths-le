import { describe, expect, it } from 'vitest';
import type { Configuration } from '../types';
import { analyzePaths } from './analysis';

describe('analyzePaths', () => {
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
		validationEnabled: false,
		validationCheckExistence: false,
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

	it('should count total paths', () => {
		const lines = ['/usr/bin/node', '/etc/config', '/var/log/app.log'];
		const result = analyzePaths(lines, baseConfig);

		expect(result.count).toBe(3);
	});

	it('should count unique paths', () => {
		const lines = [
			'/usr/bin/node',
			'/etc/config',
			'/usr/bin/node',
			'/etc/config',
		];
		const result = analyzePaths(lines, baseConfig);

		expect(result.unique).toBe(2);
		expect(result.count).toBe(4);
	});

	it('should identify duplicates', () => {
		const lines = ['/usr/bin/node', '/usr/bin/node', '/etc/config'];
		const result = analyzePaths(lines, baseConfig);

		expect(result.duplicates).toBe(1);
	});

	it('should filter empty lines', () => {
		const lines = ['/usr/bin/node', '', '  ', '/etc/config', '\t'];
		const result = analyzePaths(lines, baseConfig);

		expect(result.count).toBe(2);
	});

	it('should categorize path types', () => {
		const lines = [
			'/usr/bin/node', // absolute
			'./config.json', // relative
			'https://example.com', // url
			'file.txt', // file
		];
		const result = analyzePaths(lines, baseConfig);

		expect(result.types?.absolute).toBeGreaterThan(0);
		expect(result.types?.relative).toBeGreaterThan(0);
		expect(result.types?.url).toBeGreaterThan(0);
		expect(result.types?.file).toBeGreaterThan(0);
	});

	it('should analyze absolute Unix paths', () => {
		const lines = ['/usr/bin/node', '/etc/config', '/var/log'];
		const result = analyzePaths(lines, baseConfig);

		expect(result.types?.absolute).toBe(3);
	});

	it('should analyze relative paths', () => {
		const lines = ['./config.json', '../parent/file.txt', './data'];
		const result = analyzePaths(lines, baseConfig);

		expect(result.types?.relative).toBe(3);
	});

	it('should analyze URLs', () => {
		const lines = [
			'https://example.com',
			'http://test.com',
			'ftp://server.com',
		];
		const result = analyzePaths(lines, baseConfig);

		expect(result.types?.url).toBe(3);
	});

	it('should include validation when enabled', () => {
		const config = { ...baseConfig, analysisIncludeValidation: true };
		const lines = ['/usr/bin/node', '/etc/config'];
		const result = analyzePaths(lines, config);

		expect(result.validation).toBeDefined();
		expect(result.validation?.valid).toBeDefined();
		expect(result.validation?.invalid).toBeDefined();
	});

	it('should include patterns when enabled', () => {
		const config = { ...baseConfig, analysisIncludePatterns: true };
		const lines = ['/usr/bin/node', '/usr/bin/python', '/etc/config'];
		const result = analyzePaths(lines, config);

		expect(result.patterns).toBeDefined();
	});

	it('should handle empty input', () => {
		const lines: string[] = [];
		const result = analyzePaths(lines, baseConfig);

		expect(result.count).toBe(0);
		expect(result.unique).toBe(0);
		expect(result.duplicates).toBe(0);
	});

	it('should handle mixed path types', () => {
		const lines = [
			'/usr/bin/node',
			'./config.json',
			'https://example.com',
			'/etc/config',
			'../parent/file.txt',
		];
		const result = analyzePaths(lines, baseConfig);

		expect(result.count).toBe(5);
		expect(result.types?.absolute).toBe(2);
		expect(result.types?.relative).toBe(2);
		expect(result.types?.url).toBe(1);
	});

	it('should validate paths correctly', () => {
		const config = { ...baseConfig, analysisIncludeValidation: true };
		const lines = [
			'/usr/bin/node', // valid
			'/etc/config', // valid
			'/path/with/pipe|', // invalid (contains |)
		];
		const result = analyzePaths(lines, config);

		expect(result.validation?.valid).toBe(2);
		expect(result.validation?.invalid).toBe(1);
	});

	it('should count no duplicates when all paths are unique', () => {
		const lines = ['/usr/bin/node', '/etc/config', '/var/log'];
		const result = analyzePaths(lines, baseConfig);

		expect(result.duplicates).toBe(0);
	});

	it('should handle Windows paths', () => {
		const lines = ['C:\\Program Files', 'D:/data/file.txt'];
		const result = analyzePaths(lines, baseConfig);

		expect(result.count).toBe(2);
		expect(result.types?.absolute).toBeGreaterThan(0);
	});

	it('should count HTTP URLs', () => {
		const lines = ['https://example.com', 'http://test.com'];
		const result = analyzePaths(lines, baseConfig);

		// Note: URLs with colons may not be counted due to path validation
		expect(result.count).toBe(2);
	});
});
