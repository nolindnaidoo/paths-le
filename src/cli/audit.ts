/**
 * One file end to end, as the Rust CLI's `audit.rs` does it, over the same
 * extraction engine the extension and the MCP server run.
 *
 * The report's shape and field order are the crate's, because stdout is
 * protocol: a script reading JSON Lines from `paths-le` cannot know which of
 * the two binaries it is talking to.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { determineFileType, extractPathsFromText } from '../extraction/extract';
import type { PathType } from '../types';
import { decodeUtf8OrThrow, rustIoMessage, withoutBom } from './ioError';
import { isFinding, type Resolution, resolvePath, unresolved } from './resolve';
import { display, parentDir } from './rustPath';
import type { Target } from './walk';

export interface AuditOptions {
	/** Off reports every path as written, and none can be a finding. */
	readonly resolve: boolean;
	/**
	 * Whether resolution reaches a file the generic scan read. Off by default:
	 * the scan is generous, and resolving its false positives would turn them
	 * into `missing` claims.
	 */
	readonly resolveScanned: boolean;
	readonly root: string;
	readonly denySymlinks: boolean;
}

export interface ReportDiagnostic {
	readonly severity: 'info' | 'error';
	readonly code: string;
	readonly message: string;
}

export interface AuditedPath {
	readonly value: string;
	readonly type: PathType;
	readonly line: number;
	readonly column: number;
	readonly context: string;
	readonly resolution: Resolution;
}

export interface FileReport {
	readonly file: string;
	readonly root: string;
	readonly format: string;
	readonly paths: readonly AuditedPath[];
	readonly diagnostics: readonly ReportDiagnostic[];
	readonly summary: { readonly paths: number; readonly findings: number };
}

const BINARY_WINDOW = 8 * 1024;

/**
 * `null` for a binary file, which was never a text candidate. It is counted by
 * the caller, not reported, so `--strict` does not fail every repository that
 * holds an image.
 */
export function auditFile(
	target: Target,
	options: AuditOptions,
): FileReport | null {
	let bytes: Buffer;
	try {
		bytes = readFileSync(target.path);
	} catch (error) {
		return skipped(target, options, rustIoMessage(error));
	}
	if (bytes.subarray(0, BINARY_WINDOW).includes(0)) return null;

	let content: string;
	try {
		content = decodeUtf8OrThrow(bytes);
	} catch {
		return skipped(target, options, 'not UTF-8 text');
	}
	return auditContent(withoutBom(content), target, options);
}

export function auditContent(
	content: string,
	target: Target,
	options: AuditOptions,
): FileReport {
	const extracted = extractPathsFromText(content, target.languageId);
	const found = 'paths' in extracted ? extracted.paths : [];
	const diagnostics: ReportDiagnostic[] =
		'refusal' in extracted
			? [{ severity: 'error', code: 'parsing', message: extracted.refusal }]
			: [];

	// The comparison happens in one spelling, the canonical one, or every
	// relative path under macOS's /var would escape a root under /private/var.
	const lexical = parentDir(target.path);
	const baseDir = canonicalOr(lexical);

	const scanned = isGenericScan(target.languageId);
	const resolve = options.resolve && (!scanned || options.resolveScanned);
	const declined =
		scanned && options.resolve
			? 'a generic scan reports paths as written unless resolution is asked for'
			: 'resolution was not requested';

	const paths = found.map((path) =>
		Object.freeze({
			value: path.value,
			type: path.type,
			line: path.position.line,
			column: path.position.column,
			context: path.context,
			resolution: resolve
				? resolvePath(path.value, path.type, baseDir, options.root)
				: unresolved(declined),
		}),
	);
	const findings = paths.filter((path) =>
		isFinding(path.resolution.verdict, options.denySymlinks),
	).length;

	return Object.freeze({
		file: display(target.path),
		root: display(options.root),
		format: target.languageId,
		paths: Object.freeze(paths),
		diagnostics: Object.freeze(diagnostics),
		summary: Object.freeze({ paths: paths.length, findings }),
	});
}

export function isGenericScan(languageId: string): boolean {
	return determineFileType(languageId) === 'unknown';
}

/**
 * 0 clear · 1 findings · 2 could not answer. An audit that gave up part way
 * always fails, since it would otherwise report nothing found in a file it
 * never finished reading.
 */
export function exitCode(
	reports: readonly FileReport[],
	strict: boolean,
): number {
	if (reports.some(isIncomplete)) return 2;
	if (strict && reports.some(wasSkipped)) return 2;
	return reports.some((report) => report.summary.findings > 0) ? 1 : 0;
}

export function isIncomplete(report: FileReport): boolean {
	return report.diagnostics.some((found) => found.severity === 'error');
}

function wasSkipped(report: FileReport): boolean {
	return report.diagnostics.some((found) => found.code === 'skipped');
}

/** Where a path was written, and what was written there. */
export function position(report: FileReport, audited: AuditedPath): string {
	return `${report.file}:${audited.line}:${audited.column}  ${audited.value}`;
}

const LABELS: Readonly<Record<Resolution['verdict'], string>> = Object.freeze({
	ok: 'ok',
	symlinked: 'symlink',
	'non-canonical': 'non-canonical',
	missing: 'missing',
	'escapes-root': 'escapes root',
	unresolved: 'unresolved',
});

/** The one-line human projection of a path. It says what the JSON says. */
export function describe(report: FileReport, audited: AuditedPath): string {
	const reason = audited.resolution.reason;
	const detail = reason === null ? '' : ` — ${reason}`;
	return `${position(report, audited)}  [${LABELS[audited.resolution.verdict]}${detail}]`;
}

function canonicalOr(path: string): string {
	try {
		return realpathSync.native(path);
	} catch {
		return path;
	}
}

/**
 * A file that looked like text and could not be read as it. `info`, because
 * `error` is reserved for an audit that gave up part way; `--strict` is how a
 * pipeline asks for this to fail the run.
 */
function skipped(
	target: Target,
	options: AuditOptions,
	reason: string,
): FileReport {
	return Object.freeze({
		file: display(target.path),
		root: display(options.root),
		format: target.languageId,
		paths: Object.freeze([]),
		diagnostics: Object.freeze([
			{ severity: 'info' as const, code: 'skipped', message: reason },
		]),
		summary: Object.freeze({ paths: 0, findings: 0 }),
	});
}
