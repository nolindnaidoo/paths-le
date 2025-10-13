import { describe, expect, it } from 'vitest';
import { extractFromCss } from './css';

describe('extractFromCss', () => {
	it('should extract url() with single quotes', () => {
		const content = `body {
  background: url('./images/bg.jpg');
}`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./images/bg.jpg');
	});

	it('should extract url() with double quotes', () => {
		const content = `body {
  background: url("./images/bg.jpg");
}`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./images/bg.jpg');
	});

	it('should extract url() without quotes', () => {
		const content = `body {
  background: url(./images/bg.jpg);
}`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./images/bg.jpg');
	});

	it('should extract multiple url() values', () => {
		const content = `@font-face {
  src: url('./fonts/font.woff2') format('woff2'),
       url('./fonts/font.woff') format('woff');
}`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./fonts/font.woff2');
		expect(result[1]?.value).toBe('./fonts/font.woff');
	});

	it('should extract @import with quotes', () => {
		const content = `@import './styles/reset.css';
@import "./styles/theme.css";`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./styles/reset.css');
		expect(result[1]?.value).toBe('./styles/theme.css');
	});

	it('should extract @import with url()', () => {
		const content = `@import url('./styles/reset.css');
@import url("./styles/theme.css");`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./styles/reset.css');
		expect(result[1]?.value).toBe('./styles/theme.css');
	});

	it('should extract absolute paths', () => {
		const content = `body {
  background: url('/absolute/path/image.jpg');
}`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('/absolute/path/image.jpg');
	});

	it('should extract URLs', () => {
		const content = `body {
  background: url('https://cdn.example.com/image.jpg');
  cursor: url('http://example.com/cursor.cur');
}`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('https://cdn.example.com/image.jpg');
		expect(result[1]?.value).toBe('http://example.com/cursor.cur');
	});

	it('should extract protocol-relative URLs', () => {
		const content = `body {
  background: url('//cdn.example.com/image.jpg');
}`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('//cdn.example.com/image.jpg');
	});

	it('should exclude data URLs', () => {
		const content = `body {
  background: url('data:image/svg+xml;base64,ABC123');
  color: red;
}`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(0);
	});

	it('should handle url() with spaces', () => {
		const content = `body {
  background: url(  './images/bg.jpg'  );
}`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./images/bg.jpg');
	});

	it('should handle mixed import and url()', () => {
		const content = `@import './reset.css';
body {
  background: url('./images/bg.jpg');
}`;

		const result = extractFromCss(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./reset.css');
		expect(result[1]?.value).toBe('./images/bg.jpg');
	});

	it('should handle empty content', () => {
		expect(extractFromCss('')).toEqual([]);
		expect(extractFromCss('   ')).toEqual([]);
	});

	it('should include line positions', () => {
		const content = `@import './reset.css';
body { background: url('./bg.jpg'); }`;

		const result = extractFromCss(content);
		expect(result[0]?.position.line).toBe(1);
		expect(result[1]?.position.line).toBe(2);
	});

	it('should include context information', () => {
		const content = `@import './reset.css';
body { background: url('./bg.jpg'); }`;

		const result = extractFromCss(content);
		expect(result[0]?.context).toBe('CSS @import');
		expect(result[1]?.context).toBe('CSS url()');
	});

	it('should classify path types correctly', () => {
		const content = `@import './relative.css';
body {
  background: url('/absolute.jpg');
  cursor: url('https://example.com/cursor.cur');
}`;

		const result = extractFromCss(content);
		expect(result[0]?.type).toBe('relative');
		expect(result[1]?.type).toBe('absolute');
		expect(result[2]?.type).toBe('url');
	});
});
