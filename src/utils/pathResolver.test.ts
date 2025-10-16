import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
	beforeEach,
	describe,
	expect,
	it,
	type MockedFunction,
	vi,
} from 'vitest';
import * as vscode from 'vscode';
import {
	clearPathCache,
	getCacheStats,
	getWorkspaceFolderForPath,
	type PathResolutionOptions,
	resolveMonorepoPath,
	resolvePath,
	safeResolvePath,
} from './pathResolver';

// Mock Node.js fs module
vi.mock('node:fs/promises');
const mockFs = fs as { realpath: MockedFunction<typeof fs.realpath> };

// Mock VS Code API
vi.mock('vscode', () => ({
	workspace: {
		workspaceFolders: undefined as vscode.WorkspaceFolder[] | undefined,
		getWorkspaceFolder: vi.fn(),
	},
	Uri: {
		file: vi.fn((fsPath: string) => ({ fsPath, scheme: 'file' })),
	},
}));

const mockVscode = vscode as {
	workspace: {
		workspaceFolders: vscode.WorkspaceFolder[] | undefined;
		getWorkspaceFolder: MockedFunction<
			typeof vscode.workspace.getWorkspaceFolder
		>;
	};
	Uri: {
		file: MockedFunction<typeof vscode.Uri.file>;
	};
};

describe('pathResolver', () => {
	beforeEach(() => {
		// Clear cache before each test
		clearPathCache();

		// Reset all mocks
		vi.clearAllMocks();

		// Reset workspace folders
		mockVscode.workspace.workspaceFolders = undefined;
	});

	describe('resolvePath', () => {
		it('should return empty string for empty input', async () => {
			const options: PathResolutionOptions = {
				resolveSymlinks: false,
				resolveWorkspaceRelative: false,
			};

			const result = await resolvePath('', options);
			expect(result).toBe('');
		});

		it('should normalize path when both options are disabled', async () => {
			const options: PathResolutionOptions = {
				resolveSymlinks: false,
				resolveWorkspaceRelative: false,
			};

			const result = await resolvePath('./test\\path//file.txt', options);
			expect(result).toBe('./test/path/file.txt');
		});

		it('should resolve symlinks when enabled', async () => {
			const inputPath = '/path/to/symlink';
			const resolvedPath = '/path/to/actual/file';

			mockFs.realpath.mockResolvedValue(resolvedPath);

			const options: PathResolutionOptions = {
				resolveSymlinks: true,
				resolveWorkspaceRelative: false,
			};

			const result = await resolvePath(inputPath, options);
			expect(result).toBe(resolvedPath);
			expect(mockFs.realpath).toHaveBeenCalledWith(inputPath);
		});

		it('should handle symlink resolution errors gracefully', async () => {
			const inputPath = '/path/to/nonexistent';
			const error = new Error(
				'ENOENT: no such file or directory',
			) as NodeJS.ErrnoException;
			error.code = 'ENOENT';

			mockFs.realpath.mockRejectedValue(error);

			const options: PathResolutionOptions = {
				resolveSymlinks: true,
				resolveWorkspaceRelative: false,
			};

			const result = await resolvePath(inputPath, options);
			expect(result).toBe(inputPath);
		});

		it('should resolve workspace-relative paths', async () => {
			const workspaceFolder: vscode.WorkspaceFolder = {
				uri: { fsPath: '/workspace/root', scheme: 'file' } as vscode.Uri,
				name: 'test-workspace',
				index: 0,
			};

			const options: PathResolutionOptions = {
				resolveSymlinks: false,
				resolveWorkspaceRelative: true,
				workspaceFolder,
			};

			const result = await resolvePath('./relative/path', options);
			const expected = path.resolve('/workspace/root', './relative/path');
			expect(result).toBe(expected);
		});

		it('should not modify absolute paths when resolving workspace-relative', async () => {
			const absolutePath = '/absolute/path/file.txt';
			const workspaceFolder: vscode.WorkspaceFolder = {
				uri: { fsPath: '/workspace/root', scheme: 'file' } as vscode.Uri,
				name: 'test-workspace',
				index: 0,
			};

			const options: PathResolutionOptions = {
				resolveSymlinks: false,
				resolveWorkspaceRelative: true,
				workspaceFolder,
			};

			const result = await resolvePath(absolutePath, options);
			expect(result).toBe(absolutePath);
		});

		it('should combine symlink and workspace resolution', async () => {
			const workspaceFolder: vscode.WorkspaceFolder = {
				uri: { fsPath: '/workspace/root', scheme: 'file' } as vscode.Uri,
				name: 'test-workspace',
				index: 0,
			};

			const relativePath = './symlink/file';
			const workspaceResolved = path.resolve('/workspace/root', relativePath);
			const symlinkResolved = '/workspace/root/actual/file';

			mockFs.realpath.mockResolvedValue(symlinkResolved);

			const options: PathResolutionOptions = {
				resolveSymlinks: true,
				resolveWorkspaceRelative: true,
				workspaceFolder,
			};

			const result = await resolvePath(relativePath, options);
			expect(result).toBe(symlinkResolved);
			expect(mockFs.realpath).toHaveBeenCalledWith(workspaceResolved);
		});
	});

	describe('getWorkspaceFolderForPath', () => {
		it('should return undefined when no workspace folders exist', () => {
			mockVscode.workspace.workspaceFolders = undefined;

			const result = getWorkspaceFolderForPath('/some/path');
			expect(result).toBeUndefined();
		});

		it('should return the only workspace folder when there is one', () => {
			const workspaceFolder: vscode.WorkspaceFolder = {
				uri: { fsPath: '/workspace', scheme: 'file' } as vscode.Uri,
				name: 'single-workspace',
				index: 0,
			};

			mockVscode.workspace.workspaceFolders = [workspaceFolder];

			const result = getWorkspaceFolderForPath('/some/path');
			expect(result).toBe(workspaceFolder);
		});

		it('should find the best matching workspace folder in monorepo', () => {
			const workspace1: vscode.WorkspaceFolder = {
				uri: { fsPath: '/monorepo/package1', scheme: 'file' } as vscode.Uri,
				name: 'package1',
				index: 0,
			};

			const workspace2: vscode.WorkspaceFolder = {
				uri: { fsPath: '/monorepo/package2', scheme: 'file' } as vscode.Uri,
				name: 'package2',
				index: 1,
			};

			mockVscode.workspace.workspaceFolders = [workspace1, workspace2];
			mockVscode.workspace.getWorkspaceFolder.mockReturnValue(workspace2);
			mockVscode.Uri.file.mockReturnValue({
				fsPath: '/monorepo/package2/file.txt',
				scheme: 'file',
			} as vscode.Uri);

			const result = getWorkspaceFolderForPath('/monorepo/package2/file.txt');
			expect(result).toBe(workspace2);
		});

		it('should fallback to first workspace folder on URI creation error', () => {
			const workspace1: vscode.WorkspaceFolder = {
				uri: { fsPath: '/monorepo/package1', scheme: 'file' } as vscode.Uri,
				name: 'package1',
				index: 0,
			};

			const workspace2: vscode.WorkspaceFolder = {
				uri: { fsPath: '/monorepo/package2', scheme: 'file' } as vscode.Uri,
				name: 'package2',
				index: 1,
			};

			mockVscode.workspace.workspaceFolders = [workspace1, workspace2];
			mockVscode.Uri.file.mockImplementation(() => {
				throw new Error('Invalid path');
			});

			const result = getWorkspaceFolderForPath('invalid-path');
			expect(result).toBe(workspace1);
		});
	});

	describe('resolveMonorepoPath', () => {
		it('should use provided workspace folder', async () => {
			const workspaceFolder: vscode.WorkspaceFolder = {
				uri: { fsPath: '/monorepo/package1', scheme: 'file' } as vscode.Uri,
				name: 'package1',
				index: 0,
			};

			const options: PathResolutionOptions = {
				resolveSymlinks: false,
				resolveWorkspaceRelative: true,
				workspaceFolder,
			};

			const result = await resolveMonorepoPath('./file.txt', options);
			const expected = path.resolve('/monorepo/package1', './file.txt');
			expect(result).toBe(expected);
		});

		it('should find workspace folder automatically', async () => {
			const workspaceFolder: vscode.WorkspaceFolder = {
				uri: { fsPath: '/monorepo/package1', scheme: 'file' } as vscode.Uri,
				name: 'package1',
				index: 0,
			};

			mockVscode.workspace.workspaceFolders = [workspaceFolder];

			const options: PathResolutionOptions = {
				resolveSymlinks: false,
				resolveWorkspaceRelative: true,
			};

			const result = await resolveMonorepoPath('./file.txt', options);
			const expected = path.resolve('/monorepo/package1', './file.txt');
			expect(result).toBe(expected);
		});
	});

	describe('safeResolvePath', () => {
		it('should use default mode when both options are disabled', async () => {
			const options: PathResolutionOptions = {
				resolveSymlinks: false,
				resolveWorkspaceRelative: false,
			};

			const result = await safeResolvePath('./test\\path', options);
			expect(result).toBe('./test/path');
		});

		it('should fallback to default mode on resolution errors', async () => {
			const inputPath = '/path/to/file';

			// Mock fs.realpath to throw a synchronous error that bypasses the async error handling
			mockFs.realpath.mockImplementation(() => {
				throw new Error('Synchronous error');
			});

			const options: PathResolutionOptions = {
				resolveSymlinks: true,
				resolveWorkspaceRelative: false,
			};

			const result = await safeResolvePath(inputPath, options);
			// Should fallback to normalized path
			expect(result).toBe(inputPath);
		});
	});

	describe('cache functionality', () => {
		it('should cache resolved paths', async () => {
			const inputPath = '/test/path';
			const resolvedPath = '/resolved/path';

			mockFs.realpath.mockResolvedValue(resolvedPath);

			const options: PathResolutionOptions = {
				resolveSymlinks: true,
				resolveWorkspaceRelative: false,
			};

			// First call
			const result1 = await resolvePath(inputPath, options);
			expect(result1).toBe(resolvedPath);
			expect(mockFs.realpath).toHaveBeenCalledTimes(1);

			// Second call should use cache
			const result2 = await resolvePath(inputPath, options);
			expect(result2).toBe(resolvedPath);
			expect(mockFs.realpath).toHaveBeenCalledTimes(1); // Still only called once
		});

		it('should provide cache statistics', async () => {
			const initialStats = getCacheStats();
			expect(initialStats.size).toBe(0);
			expect(initialStats.limit).toBe(1000);

			const options: PathResolutionOptions = {
				resolveSymlinks: false,
				resolveWorkspaceRelative: false,
			};

			await resolvePath('/test/path', options);

			const afterStats = getCacheStats();
			expect(afterStats.size).toBe(1);
		});

		it('should clear cache', async () => {
			const options: PathResolutionOptions = {
				resolveSymlinks: false,
				resolveWorkspaceRelative: false,
			};

			await resolvePath('/test/path', options);
			expect(getCacheStats().size).toBe(1);

			clearPathCache();
			expect(getCacheStats().size).toBe(0);
		});
	});

	describe('virtual workspace handling', () => {
		it('should skip symlink resolution in virtual workspaces', async () => {
			// Mock virtual workspace
			mockVscode.workspace.workspaceFolders = [
				{
					uri: {
						fsPath: '/remote/path',
						scheme: 'vscode-remote',
					} as vscode.Uri,
					name: 'remote-workspace',
					index: 0,
				},
			];

			const options: PathResolutionOptions = {
				resolveSymlinks: true,
				resolveWorkspaceRelative: false,
			};

			const result = await resolvePath('/test/path', options);
			expect(result).toBe('/test/path');
			expect(mockFs.realpath).not.toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('should handle EACCES errors gracefully', async () => {
			const inputPath = '/restricted/path';
			const error = new Error('Permission denied') as NodeJS.ErrnoException;
			error.code = 'EACCES';

			mockFs.realpath.mockRejectedValue(error);

			const options: PathResolutionOptions = {
				resolveSymlinks: true,
				resolveWorkspaceRelative: false,
			};

			const result = await resolvePath(inputPath, options);
			expect(result).toBe(inputPath);
		});

		it('should handle EPERM errors gracefully', async () => {
			const inputPath = '/restricted/path';
			const error = new Error(
				'Operation not permitted',
			) as NodeJS.ErrnoException;
			error.code = 'EPERM';

			mockFs.realpath.mockRejectedValue(error);

			const options: PathResolutionOptions = {
				resolveSymlinks: true,
				resolveWorkspaceRelative: false,
			};

			const result = await resolvePath(inputPath, options);
			expect(result).toBe(inputPath);
		});

		it('should handle unknown errors gracefully', async () => {
			const inputPath = '/test/path';
			mockFs.realpath.mockRejectedValue(new Error('Unknown error'));

			const options: PathResolutionOptions = {
				resolveSymlinks: true,
				resolveWorkspaceRelative: false,
			};

			const result = await resolvePath(inputPath, options);
			expect(result).toBe(inputPath);
		});
	});
});
