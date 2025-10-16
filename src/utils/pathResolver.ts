import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { normalizePath } from './pathValidation';

/**
 * Configuration options for path resolution
 */
export interface PathResolutionOptions {
	readonly resolveSymlinks: boolean;
	readonly resolveWorkspaceRelative: boolean;
	readonly workspaceFolder?: vscode.WorkspaceFolder;
}

/**
 * Cache for resolved paths to improve performance
 */
const resolvedPathCache = new Map<string, string>();
const CACHE_SIZE_LIMIT = 1000;

/**
 * Resolve a path canonically with support for symlinks and workspace-relative paths
 */
export async function resolvePath(
	inputPath: string,
	options: PathResolutionOptions,
): Promise<string> {
	if (!inputPath || inputPath.trim().length === 0) {
		return inputPath;
	}

	// Check cache first
	const cacheKey = `${inputPath}:${JSON.stringify(options)}`;
	if (resolvedPathCache.has(cacheKey)) {
		return resolvedPathCache.get(cacheKey)!;
	}

	let resolved = inputPath;

	try {
		// Step 1: Always normalize path separators (existing behavior)
		resolved = normalizePath(resolved);

		// Step 2: Resolve workspace-relative paths if enabled
		if (options.resolveWorkspaceRelative && options.workspaceFolder) {
			resolved = await resolveWorkspaceRelativePath(
				resolved,
				options.workspaceFolder,
			);
		}

		// Step 3: Resolve symlinks if enabled
		if (options.resolveSymlinks) {
			resolved = await resolveSymlinks(resolved);
		}

		// Cache the result
		setCachedPath(cacheKey, resolved);
		return resolved;
	} catch (_error) {
		// Graceful fallback to normalized path on any error
		const fallback = normalizePath(inputPath);
		setCachedPath(cacheKey, fallback);
		return fallback;
	}
}

/**
 * Resolve workspace-relative paths in monorepo scenarios
 */
async function resolveWorkspaceRelativePath(
	inputPath: string,
	workspaceFolder: vscode.WorkspaceFolder,
): Promise<string> {
	// If path is already absolute, return as-is
	if (path.isAbsolute(inputPath)) {
		return inputPath;
	}

	// Handle relative paths by resolving against workspace folder
	const workspacePath = workspaceFolder.uri.fsPath;
	return path.resolve(workspacePath, inputPath);
}

/**
 * Resolve symlinks to their canonical paths
 */
async function resolveSymlinks(inputPath: string): Promise<string> {
	// Check if we're in a virtual workspace
	if (isVirtualWorkspace()) {
		return inputPath;
	}

	try {
		// Use Node.js realpath to resolve symlinks
		return await fs.realpath(inputPath);
	} catch (error) {
		// Handle common errors gracefully
		if (error instanceof Error) {
			const nodeError = error as NodeJS.ErrnoException;

			// Path doesn't exist - return original path
			if (nodeError.code === 'ENOENT') {
				return inputPath;
			}

			// Permission denied - return original path
			if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
				return inputPath;
			}
		}

		// For any other error, return original path
		return inputPath;
	}
}

/**
 * Get the appropriate workspace folder for a given path
 */
export function getWorkspaceFolderForPath(
	inputPath: string,
): vscode.WorkspaceFolder | undefined {
	if (!vscode.workspace.workspaceFolders) {
		return undefined;
	}

	// If only one workspace folder, use it
	if (vscode.workspace.workspaceFolders.length === 1) {
		return vscode.workspace.workspaceFolders[0];
	}

	// For multiple workspace folders (monorepo), find the best match
	try {
		const uri = vscode.Uri.file(
			path.isAbsolute(inputPath) ? inputPath : path.resolve(inputPath),
		);
		return vscode.workspace.getWorkspaceFolder(uri);
	} catch {
		// If URI creation fails, return the first workspace folder as fallback
		return vscode.workspace.workspaceFolders[0];
	}
}

/**
 * Resolve paths for monorepo scenarios with cross-package references
 */
export async function resolveMonorepoPath(
	inputPath: string,
	options: PathResolutionOptions,
): Promise<string> {
	// First, try to resolve with the provided workspace folder
	if (options.workspaceFolder) {
		return await resolvePath(inputPath, options);
	}

	// If no workspace folder provided, try to find the best one
	const workspaceFolder = getWorkspaceFolderForPath(inputPath);
	if (workspaceFolder) {
		const newOptions: PathResolutionOptions = {
			...options,
			workspaceFolder,
		};
		return await resolvePath(inputPath, newOptions);
	}

	// Fallback to basic resolution without workspace context
	return await resolvePath(inputPath, options);
}

/**
 * Check if we're running in a virtual workspace
 */
function isVirtualWorkspace(): boolean {
	// Check if workspace is virtual (remote, web, etc.)
	return (
		vscode.workspace.workspaceFolders?.some(
			(folder) => folder.uri.scheme !== 'file',
		) ?? false
	);
}

/**
 * Set a cached path with size limit management
 */
function setCachedPath(key: string, value: string): void {
	// Clear oldest entries if cache is full
	if (resolvedPathCache.size >= CACHE_SIZE_LIMIT) {
		const firstKey = resolvedPathCache.keys().next().value;
		if (firstKey) {
			resolvedPathCache.delete(firstKey);
		}
	}

	resolvedPathCache.set(key, value);
}

/**
 * Clear the path resolution cache
 */
export function clearPathCache(): void {
	resolvedPathCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): { size: number; limit: number } {
	return {
		size: resolvedPathCache.size,
		limit: CACHE_SIZE_LIMIT,
	};
}

/**
 * Safe wrapper that always falls back to default mode on errors
 */
export async function safeResolvePath(
	inputPath: string,
	options: PathResolutionOptions,
): Promise<string> {
	// If both resolution options are disabled, use default mode
	if (!options.resolveSymlinks && !options.resolveWorkspaceRelative) {
		return normalizePath(inputPath);
	}

	try {
		return await resolvePath(inputPath, options);
	} catch (error) {
		// Log warning but don't throw - graceful degradation
		console.warn(
			'Canonical path resolution failed, using default mode:',
			error,
		);
		return normalizePath(inputPath);
	}
}

// Freeze all exports for immutability
Object.freeze({
	resolvePath,
	resolveMonorepoPath,
	getWorkspaceFolderForPath,
	safeResolvePath,
	clearPathCache,
	getCacheStats,
});
