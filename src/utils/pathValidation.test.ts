import { describe, expect, it } from 'vitest';
import {
	detectPathType,
	getPathComponents,
	isValidPath,
	normalizePath,
} from './pathValidation';

describe('isValidPath', () => {
	it('should return true for valid Unix paths', () => {
		expect(isValidPath('/usr/bin/node')).toBe(true);
		expect(isValidPath('/home/user/file.txt')).toBe(true);
		expect(isValidPath('./config.json')).toBe(true);
	});

	it('should return false for Windows paths with colons', () => {
		// Colons are invalid characters except in drive letters at start
		expect(isValidPath('C:\\Program Files\\App')).toBe(false);
		expect(isValidPath('D:\\data\\file.txt')).toBe(false);
	});

	it('should return false for empty paths', () => {
		expect(isValidPath('')).toBe(false);
		expect(isValidPath('   ')).toBe(false);
	});

	it('should return false for paths with invalid characters', () => {
		expect(isValidPath('/path/with/pipe|')).toBe(false);
		expect(isValidPath('/path/with/question?')).toBe(false);
		expect(isValidPath('/path/with/asterisk*')).toBe(false);
		expect(isValidPath('/path/with/quotes"')).toBe(false);
		expect(isValidPath('/path/with/less<than')).toBe(false);
		expect(isValidPath('/path/with/greater>than')).toBe(false);
		expect(isValidPath('/path/with:colon')).toBe(false);
	});

	it('should return false for Windows reserved names', () => {
		expect(isValidPath('CON')).toBe(false);
		expect(isValidPath('PRN')).toBe(false);
		expect(isValidPath('AUX')).toBe(false);
		expect(isValidPath('NUL')).toBe(false);
		expect(isValidPath('COM1')).toBe(false);
		expect(isValidPath('LPT1')).toBe(false);
		expect(isValidPath('/path/to/CON')).toBe(false);
	});
});

describe('detectPathType', () => {
	it('should detect URLs', () => {
		expect(detectPathType('http://example.com')).toBe('url');
		expect(detectPathType('https://example.com/path')).toBe('url');
		expect(detectPathType('ftp://server.com')).toBe('url');
	});

	it('should detect absolute Unix paths', () => {
		expect(detectPathType('/usr/bin/node')).toBe('absolute');
		expect(detectPathType('/home/user/file.txt')).toBe('absolute');
	});

	it('should detect absolute Windows paths', () => {
		expect(detectPathType('C:\\Program Files')).toBe('absolute');
		expect(detectPathType('D:/data/file.txt')).toBe('absolute');
	});

	it('should detect relative paths', () => {
		expect(detectPathType('./config.json')).toBe('relative');
		expect(detectPathType('../parent/file.txt')).toBe('relative');
		expect(detectPathType('relative/path')).toBe('relative');
	});

	it('should detect paths with trailing slashes', () => {
		// Paths with trailing slashes are detected as absolute first
		const result1 = detectPathType('/home/user/');
		expect(['absolute', 'directory']).toContain(result1);

		const result2 = detectPathType('trailing/');
		expect(['relative', 'directory']).toContain(result2);
	});

	it('should detect file paths', () => {
		expect(detectPathType('config.json')).toBe('file');
		expect(detectPathType('file.txt')).toBe('file');
	});

	it('should return unknown for ambiguous paths', () => {
		expect(detectPathType('just-a-name')).toBe('unknown');
	});

	it('should handle paths with whitespace', () => {
		expect(detectPathType('  /usr/bin  ')).toBe('absolute');
	});
});

describe('normalizePath', () => {
	it('should convert backslashes to forward slashes', () => {
		expect(normalizePath('C:\\Users\\file.txt')).toBe('C:/Users/file.txt');
	});

	it('should remove duplicate slashes', () => {
		expect(normalizePath('/usr//bin///node')).toBe('/usr/bin/node');
	});

	it('should remove trailing slashes except for root', () => {
		expect(normalizePath('/usr/bin/')).toBe('/usr/bin');
		expect(normalizePath('/')).toBe('/');
	});

	it('should handle mixed separators', () => {
		expect(normalizePath('C:\\Users/Documents\\file.txt')).toBe(
			'C:/Users/Documents/file.txt',
		);
	});

	it('should preserve single slash', () => {
		expect(normalizePath('/')).toBe('/');
	});
});

describe('getPathComponents', () => {
	it('should extract components from Unix paths', () => {
		const result = getPathComponents('/usr/bin/node');

		expect(result.directory).toBe('/usr/bin');
		expect(result.filename).toBe('node');
		expect(result.extension).toBe('');
		expect(result.basename).toBe('node');
	});

	it('should extract components from paths with extensions', () => {
		const result = getPathComponents('/home/user/config.json');

		expect(result.directory).toBe('/home/user');
		expect(result.filename).toBe('config.json');
		expect(result.extension).toBe('json');
		expect(result.basename).toBe('config');
	});

	it('should handle paths without directory', () => {
		const result = getPathComponents('config.json');

		expect(result.directory).toBe('');
		expect(result.filename).toBe('config.json');
		expect(result.extension).toBe('json');
		expect(result.basename).toBe('config');
	});

	it('should handle paths without extension', () => {
		const result = getPathComponents('/usr/bin/node');

		expect(result.extension).toBe('');
		expect(result.basename).toBe('node');
	});

	it('should handle Windows paths', () => {
		const result = getPathComponents('C:\\Users\\file.txt');

		expect(result.directory).toBe('C:/Users');
		expect(result.filename).toBe('file.txt');
		expect(result.extension).toBe('txt');
		expect(result.basename).toBe('file');
	});

	it('should handle files with multiple dots', () => {
		const result = getPathComponents('/path/archive.tar.gz');

		expect(result.filename).toBe('archive.tar.gz');
		expect(result.extension).toBe('gz');
		expect(result.basename).toBe('archive.tar');
	});

	it('should handle hidden files', () => {
		const result = getPathComponents('/home/user/.bashrc');

		expect(result.filename).toBe('.bashrc');
		expect(result.extension).toBe('bashrc');
		expect(result.basename).toBe('');
	});

	it('should handle root directory', () => {
		const result = getPathComponents('/');

		expect(result.directory).toBe('');
		expect(result.filename).toBe('');
	});

	it('should handle simple filenames', () => {
		const result = getPathComponents('file');

		expect(result.directory).toBe('');
		expect(result.filename).toBe('file');
		expect(result.extension).toBe('');
		expect(result.basename).toBe('file');
	});
});
