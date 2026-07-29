import { describe, expect, it } from 'vitest';
import { classifyPathType, isPathLike } from './heuristics';

describe('isPathLike', () => {
	const CASES: ReadonlyArray<[string, boolean, string]> = [
		// strong patterns
		['/var/log/app.log', true, 'unix absolute'],
		['/srv/data with space/file.txt', true, 'unix absolute with space'],
		['C:\\Temp\\cache', true, 'windows drive backslash'],
		['C:/Temp/cache', true, 'windows drive forward slash'],
		['./relative/file.js', true, 'relative ./'],
		['../up/one.css', true, 'relative ../'],
		['./images/avatar with space.png', true, 'relative with space'],
		['https://example.com/path', true, 'https url'],
		['http://example.com', true, 'http url'],
		['file:///opt/data.bin', true, 'file url'],
		// weak patterns
		['logo.png', true, 'bare filename'],
		['src/app.ts', true, 'dir/file'],
		['assets/logo.png', true, 'dir/file with ext'],
		// rejections
		['1.8.1', false, 'semver'],
		['3.4.5', false, 'semver'],
		['127.0.0.1', false, 'ip address'],
		['2.0', false, 'bare version'],
		['a', false, 'too short'],
		['', false, 'empty'],
		['justaword', false, 'no structure'],
		['hello world.txt', false, 'weak pattern with space'],
		['my dir/file.txt', false, 'dir/file with space'],
		['a="b.txt"', false, 'contains quote'],
		['what?.txt', false, 'contains forbidden char'],
		// documented limitation
		['example.com', true, 'bare domain (documented limitation)'],
	];

	for (const [input, expected, label] of CASES) {
		it(`${label}: ${JSON.stringify(input)} -> ${expected}`, () => {
			expect(isPathLike(input)).toBe(expected);
		});
	}
});

describe('classifyPathType', () => {
	const CASES: ReadonlyArray<[string, ReturnType<typeof classifyPathType>]> = [
		['https://example.com/x', 'url'],
		['http://example.com', 'url'],
		['file:///opt/x', 'url'],
		['//cdn.example.com/lib.js', 'url'],
		['/var/log/app.log', 'absolute'],
		['C:\\Temp\\x', 'absolute'],
		['D:/data/x', 'absolute'],
		['./x/y.js', 'relative'],
		['../x/y.js', 'relative'],
		['logo.png', 'file'],
		['src/app', 'unknown'],
		['#fragment', 'unknown'],
	];

	for (const [input, expected] of CASES) {
		it(`${JSON.stringify(input)} -> ${expected}`, () => {
			expect(classifyPathType(input)).toBe(expected);
		});
	}
});
