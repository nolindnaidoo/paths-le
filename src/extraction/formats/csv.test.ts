import { describe, expect, it } from 'vitest';
import { extractFromCsv } from './csv';

describe('extractFromCsv', () => {
	it('should extract paths from CSV with headers', () => {
		const content = `Name,Path,Type
config,/etc/app/config.json,file
log,./logs/app.log,file
data,C:\\data\\app.db,file`;

		const result = extractFromCsv(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/etc/app/config.json');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db');
	});

	it('should extract paths from CSV without headers', () => {
		const content = `config,/etc/app/config.json,file
log,./logs/app.log,file
data,C:\\data\\app.db,file`;

		const result = extractFromCsv(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/etc/app/config.json');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db');
	});

	it('should handle mixed data types', () => {
		const content = `ID,Name,Path,Status
1,app,/usr/bin/app,active
2,config,/home/user/.config/app.yaml,active
3,cache,./cache/temp,inactive`;

		const result = extractFromCsv(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/usr/bin/app');
		expect(result[1]?.value).toBe('/home/user/.config/app.yaml');
		expect(result[2]?.value).toBe('./cache/temp');
	});

	it('should handle empty content', () => {
		const result = extractFromCsv('');
		expect(result).toHaveLength(0);
	});

	it('should handle invalid CSV gracefully', () => {
		const content = 'invalid,csv,content\nwith,broken,structure';
		const result = extractFromCsv(content);
		// Should not throw and return empty array or partial results
		expect(Array.isArray(result)).toBe(true);
	});

	it('should include position information', () => {
		const content = `Name,Path
config,/etc/app/config.json`;

		const result = extractFromCsv(content);
		expect(result[0]?.position).toEqual({
			line: 2,
			column: 2,
		});
	});

	it('should include context information', () => {
		const content = `Name,Path
config,/etc/app/config.json`;

		const result = extractFromCsv(content);
		expect(result[0]?.context).toBe('CSV cell [2,2]');
	});

	it('should classify path types correctly', () => {
		const content = `Type,Path
absolute,/etc/app/config.json
relative,./logs/app.log
windows,C:\\data\\app.db
url,https://api.example.com/v1/data`;

		const result = extractFromCsv(content);
		expect(result[0]?.type).toBe('absolute');
		expect(result[1]?.type).toBe('relative');
		expect(result[2]?.type).toBe('absolute');
		expect(result[3]?.type).toBe('url');
	});
});
