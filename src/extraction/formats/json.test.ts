import { describe, expect, it } from 'vitest';
import type { Path } from '../../types';
import { extractFromJson } from './json';

/** The paths of a document that reads; a refusal fails the test by name. */
function read(content: string): readonly Path[] {
	const result = extractFromJson(content);
	if ('refusal' in result) throw new Error(result.refusal);
	return result.paths;
}

describe('extractFromJson', () => {
	it('should extract paths from simple JSON object', () => {
		const content = `{
  "config": "/etc/app/config.json",
  "log": "./logs/app.log",
  "data": "C:\\\\data\\\\app.db"
}`;

		const result = read(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/etc/app/config.json');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db'); // JSON.parse() unescapes backslashes
	});

	it('should extract paths from nested JSON structure', () => {
		const content = `{
  "paths": {
    "config": "/home/user/.config/app.json",
    "cache": "./cache/temp"
  },
  "urls": {
    "api": "https://api.example.com/v1/data",
    "file": "file:///usr/local/bin/app"
  }
}`;

		const result = read(content);
		expect(result).toHaveLength(4);
		expect(result[0]?.value).toBe('/home/user/.config/app.json');
		expect(result[1]?.value).toBe('./cache/temp');
		expect(result[2]?.value).toBe('https://api.example.com/v1/data');
		expect(result[3]?.value).toBe('file:///usr/local/bin/app');
	});

	it('should extract paths from JSON arrays', () => {
		const content = `{
  "files": [
    "/path/to/file1.txt",
    "./relative/file2.txt",
    "../parent/file3.txt"
  ]
}`;

		const result = read(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/path/to/file1.txt');
		expect(result[1]?.value).toBe('./relative/file2.txt');
		expect(result[2]?.value).toBe('../parent/file3.txt');
	});

	it('should extract URLs', () => {
		const content = `{
  "homepage": "https://example.com/page",
  "api": "http://api.example.com",
  "local": "file:///home/user/file.txt"
}`;

		const result = read(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('https://example.com/page');
		expect(result[1]?.value).toBe('http://api.example.com');
		expect(result[2]?.value).toBe('file:///home/user/file.txt');
	});

	it('should extract files with extensions', () => {
		const content = `{
  "script": "app.js",
  "style": "styles.css",
  "data": "config.json"
}`;

		const result = read(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('app.js');
		expect(result[1]?.value).toBe('styles.css');
		expect(result[2]?.value).toBe('config.json');
	});

	it('should ignore non-path strings', () => {
		const content = `{
  "name": "MyApp",
  "version": "1.0.0",
  "description": "An application",
  "file": "./real/path.txt"
}`;

		const result = read(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./real/path.txt');
	});

	it('should handle deeply nested structures', () => {
		const content = `{
  "level1": {
    "level2": {
      "level3": {
        "path": "/deep/nested/path.txt"
      }
    }
  }
}`;

		const result = read(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('/deep/nested/path.txt');
	});

	it('should handle mixed arrays and objects', () => {
		const content = `{
  "items": [
    {
      "file": "./file1.txt"
    },
    {
      "file": "./file2.txt"
    }
  ]
}`;

		const result = read(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./file1.txt');
		expect(result[1]?.value).toBe('./file2.txt');
	});

	it('should handle empty JSON', () => {
		expect(read('{}')).toEqual([]);
		expect(read('[]')).toEqual([]);
	});

	it('should handle empty content', () => {
		expect(read('')).toEqual([]);
		expect(read('   ')).toEqual([]);
	});

	/**
	 * A document that does not parse is refused and named, never read as
	 * empty: an empty result with an empty `diagnostics` is what a clean file
	 * answers, and a document holding `/etc/passwd` behind a syntax error used
	 * to answer exactly that. The crate refuses with the same words.
	 */
	it('refuses a document that does not parse, and says why', () => {
		expect(extractFromJson('{ invalid json }')).toEqual({
			refusal: 'Invalid JSON: the document does not parse',
		});
	});

	/**
	 * jsonc-parser recovers a partial tree from a document cut off mid-value,
	 * and reading paths out of it answered one path where the crate's parser
	 * answered none. The errors it collects are the signal.
	 */
	it('refuses a document cut off mid-value', () => {
		expect(extractFromJson('{"a": "./x.ts", "b": ')).toEqual({
			refusal: 'Invalid JSON: the document does not parse',
		});
	});

	/**
	 * A document nested deeper than the call stack ended this frontend with
	 * "Maximum call stack size exceeded" and the crate with an empty answer.
	 * The bound is counted on the text, so both refuse before either parses.
	 */
	it('refuses a document nested deeper than the bound, and reads one at it', () => {
		const nested = (depth: number) =>
			`${'['.repeat(depth)}"./x.ts"${']'.repeat(depth)}`;
		expect(extractFromJson(nested(513))).toEqual({
			refusal: 'Invalid JSON: nested deeper than 512 levels',
		});
		expect(read(nested(512)).map((p) => p.value)).toEqual(['./x.ts']);
	});

	it('reads a document that is only comments as empty, not as broken', () => {
		expect(read('// nothing here')).toEqual([]);
		expect(read('/* nothing */')).toEqual([]);
	});

	it('should include context information', () => {
		const content = `{
  "config": {
    "path": "/path/to/file"
  }
}`;

		const result = read(content);
		expect(result[0]?.context).toContain('JSON');
		expect(result[0]?.context).toContain('config.path');
	});

	it('should classify path types correctly', () => {
		const content = `{
  "rel": "./relative",
  "abs": "/absolute",
  "url": "https://example.com/file"
}`;

		const result = read(content);
		expect(result[0]?.type).toBe('relative');
		expect(result[1]?.type).toBe('absolute');
		expect(result[2]?.type).toBe('url');
	});
});
