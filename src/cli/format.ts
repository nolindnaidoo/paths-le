/**
 * The format a file's name implies, as the Rust CLI's `resolve_format` answers
 * it for the walk.
 *
 * One rule more than `src/mcp/fileType.ts` has: `.env.local`, `.env.production`
 * and the rest are dotenv. Split on the last dot they ask `local` for a format,
 * fall to the generic scan, and a value with a space in it becomes two
 * `missing` findings over a file that was correct.
 */
import { resolveFormat } from '../mcp/fileType';

export function formatForName(name: string): string {
	if (isDotenv(name.trim().toLowerCase())) return 'dotenv';
	return resolveFormat(undefined, name);
}

/**
 * The leading dot is the signal, so `env.ts` stays TypeScript, and `.envrc`
 * is direnv's shell script rather than a dotenv file.
 */
function isDotenv(name: string): boolean {
	return (
		name === '.env' ||
		name.startsWith('.env.') ||
		name === 'env' ||
		(name.endsWith('.env') && name.length > '.env'.length)
	);
}
