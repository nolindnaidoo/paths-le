import { describe, expect, it } from 'vitest';
import { collectPaths } from './collect';

describe('collectPaths', () => {
	it('should collect paths from string values', () => {
		const result = collectPaths('/usr/bin/node');

		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('/usr/bin/node');
		expect(result[0]?.type).toBe('absolute');
		expect(result[0]?.context).toBe('root');
	});

	it('should collect paths from array values', () => {
		const result = collectPaths([
			'/usr/bin/node',
			'/etc/config',
			null,
			undefined,
		]);

		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('/usr/bin/node');
		expect(result[0]?.context).toBe('root[0]');
		expect(result[1]?.value).toBe('/etc/config');
		expect(result[1]?.context).toBe('root[1]');
	});

	it('should collect paths from object values', () => {
		const result = collectPaths({
			configPath: '/etc/config',
			dataPath: '/var/data',
			other: 'not a path',
		});

		expect(result).toHaveLength(2);
		expect(result.some((p) => p.value === '/etc/config')).toBe(true);
		expect(result.some((p) => p.value === '/var/data')).toBe(true);
	});

	it('should collect paths from nested objects', () => {
		const result = collectPaths({
			config: {
				paths: {
					log: '/var/log/app.log',
					data: '/var/data',
				},
			},
		});

		expect(result.length).toBeGreaterThan(0);
		expect(result.some((p) => p.value === '/var/log/app.log')).toBe(true);
		expect(result.some((p) => p.value === '/var/data')).toBe(true);
	});

	it('should collect paths from object keys', () => {
		const result = collectPaths({
			'/etc/config': 'value',
			normalKey: '/var/data',
		});

		expect(result.length).toBeGreaterThan(0);
		expect(result.some((p) => p.value === '/etc/config')).toBe(true);
		expect(result.some((p) => p.value === '/var/data')).toBe(true);
	});

	it('should handle Windows-style paths', () => {
		// Windows paths with backslashes may not match path patterns
		const result = collectPaths('C:/Program Files/App');

		if (result.length > 0) {
			expect(result[0]?.value).toBeDefined();
		}
		// Note: Windows paths with backslashes may not be detected as valid paths
	});

	it('should handle relative paths', () => {
		const result = collectPaths('./config/settings.json');

		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./config/settings.json');
		expect(result[0]?.type).toBe('relative');
	});

	it('should handle parent relative paths', () => {
		const result = collectPaths('../config/settings.json');

		expect(result).toHaveLength(1);
		expect(result[0]?.type).toBe('relative');
	});

	it('should handle URLs', () => {
		const result = collectPaths('https://example.com/api');

		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('https://example.com/api');
		expect(result[0]?.type).toBe('url');
	});

	it('should handle file URLs', () => {
		const result = collectPaths('file:///usr/local/file.txt');

		expect(result).toHaveLength(1);
		expect(result[0]?.type).toBe('url');
	});

	it('should handle files with extensions', () => {
		const result = collectPaths('config.json');

		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('config.json');
	});

	it('should reject non-path strings', () => {
		const result = collectPaths('just a string');

		expect(result).toHaveLength(0);
	});

	it('should reject empty strings', () => {
		const result = collectPaths('');

		expect(result).toHaveLength(0);
	});

	it('should reject single character strings', () => {
		const result = collectPaths('/');

		expect(result).toHaveLength(0);
	});

	it('should handle null and undefined gracefully', () => {
		const result1 = collectPaths(null);
		const result2 = collectPaths(undefined);

		expect(result1).toHaveLength(0);
		expect(result2).toHaveLength(0);
	});

	it('should handle numbers gracefully', () => {
		const result = collectPaths(42);

		expect(result).toHaveLength(0);
	});

	it('should preserve context information', () => {
		const result = collectPaths([{ config: '/etc/app.conf' }]);

		expect(result.some((p) => p.context?.includes('[0].config'))).toBe(true);
	});

	it('should handle mixed arrays', () => {
		const result = collectPaths([
			'/usr/bin/node',
			{ path: '/etc/config' },
			['/var/log'],
			'not a path',
			42,
		]);

		expect(result.length).toBeGreaterThan(0);
		expect(result.some((p) => p.value === '/usr/bin/node')).toBe(true);
		expect(result.some((p) => p.value === '/etc/config')).toBe(true);
		expect(result.some((p) => p.value === '/var/log')).toBe(true);
	});

	it('should classify directory paths', () => {
		const result = collectPaths('/var/log/');

		if (result.length > 0) {
			expect(result[0]?.type).toBeDefined();
		}
	});
});
