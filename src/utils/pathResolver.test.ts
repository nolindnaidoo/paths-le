import { beforeEach, describe, expect, it } from 'vitest';
import { _resetMockState, Uri, workspace } from '../__mocks__/vscode';
import {
	getWorkspaceFolderForPath,
	normalizePath,
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
