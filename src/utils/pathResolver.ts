import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

export interface PathResolutionOptions {
	readonly resolveSymlinks: boolean;
	readonly resolveWorkspaceRelative: boolean;
	readonly workspaceFolder?: vscode.WorkspaceFolder;
}

const resolvedPathCache = new Map<string, string>();
const CACHE_SIZE_LIMIT = 1000;

/**
 * Normalize separators to forward slashes, collapse duplicates, and
 * strip a trailing slash (except for root).
 */
export function normalizePath(inputPath: string): string {
	let normalized = inputPath.replace(/\\/g, '/').replace(/\/+/g, '/');
	if (normalized.length > 1 && normalized.endsWith('/')) {
		normalized = normalized.slice(0, -1);
	}
	return normalized;
}

/**
 * Canonical resolution used by the extract command when the user has
 * opted in via the resolution.* settings: workspace-relative expansion
 * and/or symlink resolution, with graceful fallback to the normalized
 * input on any error.
 */
export async function resolvePathCanonical(
	inputPath: string,
	options?: Partial<PathResolutionOptions>,
): Promise<string> {
	const workspaceFolder =
		options?.workspaceFolder ?? getWorkspaceFolderForPath(inputPath);

	const resolveOptions: PathResolutionOptions = {
		resolveSymlinks: options?.resolveSymlinks ?? true,
		resolveWorkspaceRelative: options?.resolveWorkspaceRelative ?? true,
		...(workspaceFolder && { workspaceFolder }),
	};

	return safeResolvePath(inputPath, resolveOptions);
}

/**
 * Safe wrapper: with both resolution modes disabled this is just
 * normalizePath; otherwise resolves and never throws.
 */
export async function safeResolvePath(
	inputPath: string,
	options: PathResolutionOptions,
): Promise<string> {
	if (!options.resolveSymlinks && !options.resolveWorkspaceRelative) {
		return normalizePath(inputPath);
	}

	try {
		return await resolvePath(inputPath, options);
	} catch (_error) {
		return normalizePath(inputPath);
	}
}

async function resolvePath(
	inputPath: string,
	options: PathResolutionOptions,
): Promise<string> {
	if (!inputPath || inputPath.trim().length === 0) {
		return inputPath;
	}

	const cacheKey = [
		inputPath,
		options.resolveSymlinks,
		options.resolveWorkspaceRelative,
		options.workspaceFolder?.uri.toString() ?? '',
	].join('|');
	const cached = resolvedPathCache.get(cacheKey);
	if (cached !== undefined) {
		return cached;
	}

	let resolved = inputPath;

	try {
		resolved = normalizePath(resolved);

		if (options.resolveWorkspaceRelative && options.workspaceFolder) {
			resolved = resolveWorkspaceRelativePath(
				resolved,
				options.workspaceFolder,
			);
		}

		if (options.resolveSymlinks) {
			resolved = await resolveSymlinks(resolved);
		}

		setCachedPath(cacheKey, resolved);
		return resolved;
	} catch (_error) {
		const fallback = normalizePath(inputPath);
		setCachedPath(cacheKey, fallback);
		return fallback;
	}
}

function resolveWorkspaceRelativePath(
	inputPath: string,
	workspaceFolder: vscode.WorkspaceFolder,
): string {
	if (path.isAbsolute(inputPath)) {
		return inputPath;
	}
	return path.resolve(workspaceFolder.uri.fsPath, inputPath);
}

async function resolveSymlinks(inputPath: string): Promise<string> {
	if (isVirtualWorkspace()) {
		return inputPath;
	}

	try {
		return await fs.realpath(inputPath);
	} catch {
		// Any failure — missing file, permission denied, a broken link — falls
		// back to the path as written, which is the useful answer for an
		// extractor. This previously branched on ENOENT/EACCES/EPERM via an
		// `as NodeJS.ErrnoException` cast and then returned the same value from
		// both arms, so the condition and the cast were inert.
		return inputPath;
	}
}

export function getWorkspaceFolderForPath(
	inputPath: string,
): vscode.WorkspaceFolder | undefined {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return undefined;
	}

	if (folders.length === 1) {
		return folders[0];
	}

	try {
		const uri = vscode.Uri.file(
			path.isAbsolute(inputPath) ? inputPath : path.resolve(inputPath),
		);
		return vscode.workspace.getWorkspaceFolder(uri);
	} catch {
		return folders[0];
	}
}

function isVirtualWorkspace(): boolean {
	return (
		vscode.workspace.workspaceFolders?.some(
			(folder) => folder.uri.scheme !== 'file',
		) ?? false
	);
}

function setCachedPath(key: string, value: string): void {
	if (resolvedPathCache.size >= CACHE_SIZE_LIMIT) {
		const firstKey = resolvedPathCache.keys().next().value;
		if (firstKey) {
			resolvedPathCache.delete(firstKey);
		}
	}
	resolvedPathCache.set(key, value);
}
