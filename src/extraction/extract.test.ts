import { describe, expect, it, vi } from 'vitest';
import { extractPaths } from './extract';

// Mock the format extractors
vi.mock('./formats/csv', () => ({
	extractFromCsv: vi.fn(() => [
		{ value: '/home/user/file.txt', line: 1, column: 10 },
		{ value: '/etc/config', line: 2, column: 5 },
	]),
}));

vi.mock('./formats/toml', () => ({
	extractFromToml: vi.fn(() => [
		{ value: '/usr/bin/python', line: 1, column: 15 },
		{ value: '/var/log/app.log', line: 3, column: 8 },
	]),
}));

vi.mock('./formats/dotenv', () => ({
	extractFromDotenv: vi.fn(() => [
		{ value: '/opt/application', line: 1, column: 12 },
		{ value: '/tmp/cache', line: 2, column: 20 },
	]),
}));

describe('extractPaths', () => {
	it('should extract paths from CSV files', async () => {
		const result = await extractPaths(
			'test,content\n/home/user/file.txt,value',
			'csv',
		);

		expect(result.success).toBe(true);
		expect(result.paths).toHaveLength(2);
		expect(result.paths[0]?.value).toBe('/home/user/file.txt');
		expect(result.paths[1]?.value).toBe('/etc/config');
		expect(result.errors).toHaveLength(0);
	});

	it('should extract paths from TOML files', async () => {
		const result = await extractPaths(
			'[config]\npath = "/usr/bin/python"',
			'toml',
		);

		expect(result.success).toBe(true);
		expect(result.paths).toHaveLength(2);
		expect(result.paths[0]?.value).toBe('/usr/bin/python');
		expect(result.paths[1]?.value).toBe('/var/log/app.log');
		expect(result.errors).toHaveLength(0);
	});

	it('should extract paths from dotenv files', async () => {
		const result = await extractPaths(
			'PATH=/opt/application\nTMP=/tmp/cache',
			'dotenv',
		);

		expect(result.success).toBe(true);
		expect(result.paths).toHaveLength(2);
		expect(result.paths[0]?.value).toBe('/opt/application');
		expect(result.paths[1]?.value).toBe('/tmp/cache');
		expect(result.errors).toHaveLength(0);
	});

	it('should extract paths from env language ID', async () => {
		const result = await extractPaths('PATH=/opt/application', 'env');

		expect(result.success).toBe(true);
		expect(result.paths).toHaveLength(2);
		expect(result.errors).toHaveLength(0);
	});

	it('should return error for unsupported file types', async () => {
		const result = await extractPaths('some content', 'python');

		expect(result.success).toBe(false);
		expect(result.paths).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.category).toBe('format');
		expect(result.errors[0]?.severity).toBe('info');
		expect(result.errors[0]?.message).toContain('not supported');
		expect(result.errors[0]?.message).toContain('python');
	});

	it('should handle parsing errors gracefully', async () => {
		const { extractFromCsv } = await import('./formats/csv');
		vi.mocked(extractFromCsv).mockImplementationOnce(() => {
			throw new Error('Parse error occurred');
		});

		const result = await extractPaths('bad,content', 'csv');

		expect(result.success).toBe(false);
		expect(result.paths).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.category).toBe('parsing');
		expect(result.errors[0]?.severity).toBe('error');
		expect(result.errors[0]?.message).toBe('Parse error occurred');
		expect(result.errors[0]?.recoverable).toBe(true);
	});

	it('should handle non-Error exceptions', async () => {
		const { extractFromToml } = await import('./formats/toml');
		vi.mocked(extractFromToml).mockImplementationOnce(() => {
			throw 'String error';
		});

		const result = await extractPaths('[bad]', 'toml');

		expect(result.success).toBe(false);
		expect(result.errors[0]?.message).toBe('Unknown parsing error');
	});

	it('should return immutable results', async () => {
		const result = await extractPaths('test', 'csv');

		expect(Object.isFrozen(result)).toBe(true);
		expect(Object.isFrozen(result.paths)).toBe(true);
		expect(Object.isFrozen(result.errors)).toBe(true);
	});

	it('should include metadata in unsupported format errors', async () => {
		const result = await extractPaths('content', 'python');

		expect(result.errors[0]?.metadata).toEqual({
			languageId: 'python',
			supportedFormats: [
				'csv',
				'toml',
				'dotenv',
				'javascript',
				'typescript',
				'json',
				'html',
				'css',
			],
		});
	});
});
