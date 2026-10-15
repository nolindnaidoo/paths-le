/**
 * The boundary a relative path may not escape, chosen as the Rust CLI's
 * `choose_root` chooses it: the enclosing git repository when there is one,
 * because that is what a workspace folder is on a command line. Rooting at the
 * directory argument instead made every cross-package import in a monorepo an
 * escape.
 *
 * Always canonical, or the escape check fires on paths that never left.
 */
import { existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { rustIoMessage } from './ioError';
import { display, parentDir } from './rustPath';

export function chooseRoot(
	explicit: string | null,
	inputs: readonly string[],
	cwd: string,
): string {
	if (explicit !== null) {
		if (!isDirectory(explicit))
			throw new Error(`${explicit} is not a directory`);
		return canonical(explicit, explicit);
	}
	const start = startOf(inputs, cwd);
	const resolved = canonical(start, display(start));
	return enclosingRepository(resolved) ?? resolved;
}

function startOf(inputs: readonly string[], cwd: string): string {
	const only = inputs.length === 1 ? (inputs[0] as string) : null;
	if (only === null) return cwd;
	return isDirectory(only) ? only : parentDir(only);
}

function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

function canonical(path: string, shown: string): string {
	try {
		return realpathSync.native(path);
	} catch (error) {
		throw new Error(`${shown}: ${rustIoMessage(error)}`);
	}
}

/** A worktree and a submodule carry `.git` as a file, so the test is existence. */
function enclosingRepository(start: string): string | null {
	if (existsSync(join(start, '.git'))) return start;
	const parent = dirname(start);
	if (parent === start) return null;
	return enclosingRepository(parent);
}
