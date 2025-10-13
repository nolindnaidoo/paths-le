import { describe, expect, it } from 'vitest';
import { extractFromToml } from './toml';

describe('extractFromToml', () => {
	it('should extract paths from simple TOML', () => {
		const content = `config = "/etc/app/config.toml"
log = "./logs/app.log"
data = "C:\\\\data\\\\app.db"`;

		const result = extractFromToml(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/etc/app/config.toml');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db');
	});

	it('should extract paths from nested TOML structure', () => {
		const content = `[paths]
config = "/home/user/.config/app.toml"
cache = "./cache/temp"

[urls]
api = "https://api.example.com/v1/data"
file = "file:///usr/local/bin/app"`;

		const result = extractFromToml(content);
		expect(result).toHaveLength(4);
		expect(result[0]?.value).toBe('/home/user/.config/app.toml');
		expect(result[1]?.value).toBe('./cache/temp');
		expect(result[2]?.value).toBe('https://api.example.com/v1/data');
		expect(result[3]?.value).toBe('file:///usr/local/bin/app');
	});

	it('should extract paths from arrays', () => {
		const content = `paths = [
  "/etc/app/config.toml",
  "./logs/app.log",
  "C:\\\\data\\\\app.db"
]`;

		const result = extractFromToml(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/etc/app/config.toml');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db');
	});

	it('should handle empty content', () => {
		const result = extractFromToml('');
		expect(result).toHaveLength(0);
	});

	it('should handle invalid TOML gracefully', () => {
		const content = 'invalid toml content [broken';
		const result = extractFromToml(content);
		// Should not throw and return empty array
		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it('should include position information', () => {
		const content = `config = "/etc/app/config.toml"
log = "./logs/app.log"`;

		const result = extractFromToml(content);
		expect(result[0]?.position).toEqual({
			line: 1,
			column: 1,
		});
	});

	it('should include context information', () => {
		const content = `config = "/etc/app/config.toml"`;

		const result = extractFromToml(content);
		expect(result[0]?.context).toBe('TOML value');
	});

	it('should classify path types correctly', () => {
		const content = `absolute = "/etc/app/config.toml"
relative = "./logs/app.log"
windows = "C:\\\\data\\\\app.db"
url = "https://api.example.com/v1/data"`;

		const result = extractFromToml(content);
		expect(result[0]?.type).toBe('absolute');
		expect(result[1]?.type).toBe('relative');
		expect(result[2]?.type).toBe('absolute');
		expect(result[3]?.type).toBe('url');
	});

	it('should extract paths from keys that look like paths', () => {
		const content = `["/etc/app/config.toml"]
value = "test"

["./logs/app.log"]
another_value = "test"`;

		const result = extractFromToml(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('/etc/app/config.toml');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[0]?.context).toBe('TOML key');
		expect(result[1]?.context).toBe('TOML key');
	});
});
