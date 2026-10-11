import { beforeEach, describe, expect, it } from 'vitest';
import { _resetMockState, Uri, workspace } from '../__mocks__/vscode';
import {
	getWorkspaceFolderForPath,
	normalizePath,
	resolvePathCanonical,
	safeResolvePath,
} from './pathResolver';

beforeEach(() => {
	_resetMockState();
});

describe('normalizePath', () => {
	it('converts backslashes to forward slashes', () => {
		expect(normalizePath('C:\\Temp\\x')).toBe('C:/Temp/x');
	});

	it('collapses duplicate separators', () => {
		expect(normalizePath('/var//log///app.log')).toBe('/var/log/app.log');
	});

	it('strips trailing slash except root', () => {
		expect(normalizePath('/var/log/')).toBe('/var/log');
		expect(normalizePath('/')).toBe('/');
	});
});

describe('safeResolvePath', () => {
	it('only normalizes when both modes are disabled', async () => {
		const result = await safeResolvePath('a\\b\\c', {
			resolveSymlinks: false,
			resolveWorkspaceRelative: false,
		});
		expect(result).toBe('a/b/c');
	});

	it('returns input for nonexistent paths with symlink resolution on', async () => {
		const result = await safeResolvePath('/definitely/not/a/real/path-xyz', {
			resolveSymlinks: true,
			resolveWorkspaceRelative: false,
		});
		expect(result).toBe('/definitely/not/a/real/path-xyz');
	});
});

describe('getWorkspaceFolderForPath', () => {
	it('returns undefined without workspace folders', () => {
		expect(getWorkspaceFolderForPath('/x')).toBeUndefined();
	});

	it('returns the single workspace folder when only one exists', () => {
		const folder = { uri: Uri.file('/repo'), name: 'repo', index: 0 };
		workspace.workspaceFolders = [folder];
		expect(getWorkspaceFolderForPath('./anything')).toBe(folder);
	});
});

describe('resolvePathCanonical', () => {
	it('normalizes only when both resolution modes are off', async () => {
		const result = await resolvePathCanonical('a//b\\c', {
			resolveSymlinks: false,
			resolveWorkspaceRelative: false,
		});
		expect(result).toBe(normalizePath('a//b\\c'));
	});

	it('returns an empty input unchanged', async () => {
		expect(await resolvePathCanonical('')).toBe('');
		expect(await resolvePathCanonical('   ')).toBe('   ');
	});

	it('falls back to the input for a path that does not exist', async () => {
		// realpath throws; safeResolvePath swallows it and normalizes instead of
		// failing the extraction.
		const result = await resolvePathCanonical('/definitely/not/here/x.ts', {
			resolveSymlinks: true,
			resolveWorkspaceRelative: false,
		});
		expect(result).toContain('x.ts');
	});

	it('resolves a relative path against the workspace folder', async () => {
		workspace.workspaceFolders = [
			{ uri: Uri.file('/workspace'), name: 'w', index: 0 },
		] as never;
		const result = await resolvePathCanonical('src/index.ts', {
			resolveSymlinks: false,
			resolveWorkspaceRelative: true,
		});
		expect(result).toContain('workspace');
	});

	it('leaves an absolute path alone when resolving workspace-relative', async () => {
		workspace.workspaceFolders = [
			{ uri: Uri.file('/workspace'), name: 'w', index: 0 },
		] as never;
		const result = await resolvePathCanonical('/etc/hosts', {
			resolveSymlinks: false,
			resolveWorkspaceRelative: true,
		});
		expect(result).toContain('hosts');
	});

	it('leaves a URL as written, whatever the resolution settings', async () => {
		// A URL is not a filesystem path. Normalising collapsed its `//` and
		// workspace-relative resolution then nested it under the folder, so
		// `https://x/y` came out as `/workspace/https:/x/y`.
		const workspaceFolder = {
			uri: Uri.file('/workspace'),
			name: 'w',
			index: 0,
		} as never;
		for (const url of ['https://example.com/a/b', 'file:///opt/data.bin']) {
			expect(
				await resolvePathCanonical(url, {
					resolveSymlinks: false,
					resolveWorkspaceRelative: true,
					workspaceFolder,
				}),
			).toBe(url);
			expect(
				await resolvePathCanonical(url, {
					resolveSymlinks: true,
					resolveWorkspaceRelative: true,
					workspaceFolder,
				}),
			).toBe(url);
		}
	});

	it('does not nest a drive-letter path under the workspace', async () => {
		// `path.isAbsolute` is the host's: on POSIX `C:/Temp/x.txt` is relative,
		// so it was resolved to `/workspace/C:/Temp/x.txt`.
		const result = await resolvePathCanonical('C:\\Temp\\x.txt', {
			resolveSymlinks: false,
			resolveWorkspaceRelative: true,
			workspaceFolder: {
				uri: Uri.file('/workspace'),
				name: 'w',
				index: 0,
			} as never,
		});
		expect(result).toBe('C:/Temp/x.txt');
	});

	it('serves a repeated resolution from cache', async () => {
		// The cache is keyed on the path plus both flags; the second call must
		// return the same answer without re-hitting the filesystem.
		const options = {
			resolveSymlinks: true,
			resolveWorkspaceRelative: false,
		};
		const first = await resolvePathCanonical('/tmp/cached-probe.ts', options);
		const second = await resolvePathCanonical('/tmp/cached-probe.ts', options);
		expect(second).toBe(first);
	});

	it('treats different flag combinations as different cache entries', async () => {
		const a = await resolvePathCanonical('relative/x.ts', {
			resolveSymlinks: false,
			resolveWorkspaceRelative: false,
		});
		workspace.workspaceFolders = [
			{ uri: Uri.file('/workspace'), name: 'w', index: 0 },
		] as never;
		const b = await resolvePathCanonical('relative/x.ts', {
			resolveSymlinks: false,
			resolveWorkspaceRelative: true,
		});
		expect(a).not.toBe(b);
	});
});
