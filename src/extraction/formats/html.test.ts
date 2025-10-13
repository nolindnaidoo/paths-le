import { describe, expect, it } from 'vitest';
import { extractFromHtml } from './html';

describe('extractFromHtml', () => {
	it('should extract src attributes', () => {
		const content = `<img src="./images/photo.jpg">
<script src="../js/app.js"></script>`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./images/photo.jpg');
		expect(result[1]?.value).toBe('../js/app.js');
	});

	it('should extract href attributes', () => {
		const content = `<a href="./page.html">Link</a>
<link href="../styles/main.css" rel="stylesheet">`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./page.html');
		expect(result[1]?.value).toBe('../styles/main.css');
	});

	it('should extract data attributes', () => {
		const content = `<div data="./data/config.json"></div>`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./data/config.json');
	});

	it('should extract action attributes', () => {
		const content = `<form action="./submit.php" method="post"></form>`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./submit.php');
	});

	it('should extract poster attributes', () => {
		const content = `<video poster="./images/thumbnail.jpg"></video>`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./images/thumbnail.jpg');
	});

	it('should extract srcset with single image', () => {
		const content = `<img srcset="./images/photo.jpg">`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./images/photo.jpg');
	});

	it('should extract srcset with multiple images', () => {
		const content = `<img srcset="./images/small.jpg 480w, ./images/large.jpg 800w">`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./images/small.jpg');
		expect(result[1]?.value).toBe('./images/large.jpg');
	});

	it('should extract srcset with pixel density', () => {
		const content = `<img srcset="./images/standard.jpg 1x, ./images/retina.jpg 2x">`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./images/standard.jpg');
		expect(result[1]?.value).toBe('./images/retina.jpg');
	});

	it('should extract absolute paths', () => {
		const content = `<img src="/absolute/path/image.jpg">`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('/absolute/path/image.jpg');
	});

	it('should extract URLs', () => {
		const content = `<img src="https://cdn.example.com/image.jpg">
<a href="http://example.com/page">Link</a>`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('https://cdn.example.com/image.jpg');
		expect(result[1]?.value).toBe('http://example.com/page');
	});

	it('should extract protocol-relative URLs', () => {
		const content = `<img src="//cdn.example.com/image.jpg">`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('//cdn.example.com/image.jpg');
	});

	it('should exclude data URLs', () => {
		const content = `<img src="data:image/svg+xml;base64,ABC123">`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(0);
	});

	it('should exclude javascript: URLs', () => {
		const content = `<a href="javascript:void(0)">Link</a>`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(0);
	});

	it('should extract mixed attributes', () => {
		const content = `<html>
  <link href="./styles.css" rel="stylesheet">
  <img src="./image.jpg" alt="Photo">
  <script src="./app.js"></script>
  <a href="./page.html">Link</a>
</html>`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(4);
		expect(result[0]?.value).toBe('./styles.css');
		expect(result[1]?.value).toBe('./image.jpg');
		expect(result[2]?.value).toBe('./app.js');
		expect(result[3]?.value).toBe('./page.html');
	});

	it('should handle empty content', () => {
		expect(extractFromHtml('')).toEqual([]);
		expect(extractFromHtml('   ')).toEqual([]);
	});

	it('should handle HTML with no paths', () => {
		const content = `<div><p>Hello World</p></div>`;
		expect(extractFromHtml(content)).toEqual([]);
	});

	it('should include line positions', () => {
		const content = `<img src="./image1.jpg">
<img src="./image2.jpg">`;

		const result = extractFromHtml(content);
		expect(result[0]?.position.line).toBe(1);
		expect(result[1]?.position.line).toBe(2);
	});

	it('should include context information', () => {
		const content = `<img src="./image.jpg">
<a href="./page.html">Link</a>`;

		const result = extractFromHtml(content);
		expect(result[0]?.context).toBe('HTML src');
		expect(result[1]?.context).toBe('HTML href');
	});

	it('should classify path types correctly', () => {
		const content = `<img src="./relative.jpg">
<link href="/absolute.css">
<script src="https://cdn.example.com/lib.js"></script>`;

		const result = extractFromHtml(content);
		expect(result[0]?.type).toBe('relative');
		expect(result[1]?.type).toBe('absolute');
		expect(result[2]?.type).toBe('url');
	});

	it('should extract background attribute', () => {
		const content = `<body background="./images/bg.jpg">`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./images/bg.jpg');
	});

	it('should extract cite attribute', () => {
		const content = `<blockquote cite="./article.html">Quote</blockquote>`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./article.html');
	});

	it('should extract formaction attribute', () => {
		const content = `<button formaction="./process.php">Submit</button>`;

		const result = extractFromHtml(content);
		expect(result).toHaveLength(1);
		expect(result[0]?.value).toBe('./process.php');
	});
});
