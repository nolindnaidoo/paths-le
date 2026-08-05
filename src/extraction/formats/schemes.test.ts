import { describe, expect, it } from 'vitest';
import { isExcludedScheme } from './schemes';

/**
 * These cases come from a real CodeQL finding
 * (`js/incomplete-url-scheme-check`): the original check was
 * case-sensitive and anchored at position zero, so `JavaScript:` and
 * ` vbscript:` were both extracted as file paths.
 */
describe('isExcludedScheme', () => {
	it('excludes the pseudo-schemes', () => {
		expect(isExcludedScheme('data:image/png;base64,iVBOR')).toBe(true);
		expect(isExcludedScheme('javascript:alert(1)')).toBe(true);
		expect(isExcludedScheme('vbscript:msgbox')).toBe(true);
	});

	it('is case-insensitive', () => {
		// HTML attribute values are not case-normalised by the parser.
		expect(isExcludedScheme('JavaScript:alert(1)')).toBe(true);
		expect(isExcludedScheme('DATA:text/html,x')).toBe(true);
		expect(isExcludedScheme('VBScript:msgbox')).toBe(true);
	});

	it('looks past leading whitespace', () => {
		// Nor are they trimmed.
		expect(isExcludedScheme('  javascript:alert(1)')).toBe(true);
		expect(isExcludedScheme('\tdata:text/html,x')).toBe(true);
	});

	it('leaves real paths alone', () => {
		expect(isExcludedScheme('./src/index.ts')).toBe(false);
		expect(isExcludedScheme('/etc/hosts')).toBe(false);
		expect(isExcludedScheme('../assets/logo.png')).toBe(false);
		expect(isExcludedScheme('C:\\Users\\dev\\file.txt')).toBe(false);
	});

	it('leaves real URLs alone — they are extractable paths', () => {
		expect(isExcludedScheme('https://example.com/a.png')).toBe(false);
		expect(isExcludedScheme('file:///tmp/x')).toBe(false);
	});

	it('does not match a scheme name appearing later in the value', () => {
		expect(isExcludedScheme('./docs/javascript:notes.md')).toBe(false);
	});
});
