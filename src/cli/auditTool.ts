/**
 * `paths_le_audit`, the tool the Rust server offers beside the shared
 * `extract_paths`: files or directories in, the same reports the command line
 * writes. `paths-le mcp` serves both, as the crate's `paths-le mcp` does, so an
 * agent configured with either binary sees the same two tools.
 *
 * A finding is an ordinary result, not an error: a model that reads a broken
 * path as a broken tool retries instead of reacting.
 */
import { type Diagnostic, envelope } from '../mcp/envelope';
import type { ToolDefinition } from '../mcp/transport';
import {
	auditFile,
	type FileReport,
	isGenericScan,
	isIncomplete,
} from './audit';
import { chooseRoot } from './root';
import { collect, DEFAULT_WALK } from './walk';

const DESCRIPTION =
	'Audit files or directories: find every path and report whether it still points at ' +
	'anything — missing, escaping the audited tree, non-canonical, or a symlink with its ' +
	'target. Reads the filesystem; never writes to it. Findings are a normal result, not ' +
	'an error.';

async function audit(args: Record<string, unknown>): Promise<unknown> {
	const inputs = requestedPaths(args);
	const flag = (name: string, fallback: boolean): boolean => {
		const value = args[name];
		return typeof value === 'boolean' ? value : fallback;
	};
	const resolve = flag('resolve', true);
	const resolveScanned = flag('resolveScanned', false);

	const targets = collect(inputs, DEFAULT_WALK);
	const explicitRoot = typeof args.root === 'string' ? args.root : null;
	const root = chooseRoot(explicitRoot, inputs, process.cwd());
	const options = {
		resolve,
		resolveScanned,
		root,
		denySymlinks: flag('denySymlinks', false),
	};
	const reports = targets
		.map((target) => auditFile(target, options))
		.filter((report): report is FileReport => report !== null);
	const binary = targets.length - reports.length;
	const findings = reports.reduce(
		(sum, report) => sum + report.summary.findings,
		0,
	);

	const diagnostics: Diagnostic[] = [];
	if (!resolve) {
		diagnostics.push(
			warning(
				'resolve',
				'paths were reported as written and not checked against the filesystem, so none could be a finding',
			),
		);
	}
	// Said out loud: "0 findings" over a tree of Python files would otherwise
	// read as clean, when this declined to claim either way.
	const scanned = targets.filter((target) =>
		isGenericScan(target.languageId),
	).length;
	if (resolve && !resolveScanned && scanned > 0) {
		diagnostics.push(
			warning(
				'scanned',
				`${scanned} of ${targets.length} files had no format extractor and were scanned as raw text; their paths are reported as written, not checked`,
			),
		);
	}
	if (binary > 0) {
		diagnostics.push(
			warning(
				'binary',
				`${binary} files were binary and hold no text to examine`,
			),
		);
	}
	for (const report of reports.filter(isIncomplete)) {
		diagnostics.push(
			warning(
				'unreadable',
				`${report.file} could not be examined, so this audit does not cover it`,
			),
		);
	}

	return envelope(
		'paths_le_audit',
		{ reports, findings },
		reports.length,
		diagnostics,
		false,
	);
}

function warning(code: string, message: string): Diagnostic {
	return { severity: 'warning', code, message };
}

function requestedPaths(args: Record<string, unknown>): readonly string[] {
	if (typeof args.path === 'string') return [args.path];
	if (!Array.isArray(args.paths))
		throw new Error('no file or directory was supplied to audit');
	const paths = args.paths.filter(
		(item): item is string => typeof item === 'string',
	);
	if (paths.length === 0) throw new Error('the list of paths was empty');
	return paths;
}

export const AUDIT_TOOL: ToolDefinition = Object.freeze({
	name: 'paths_le_audit',
	description: DESCRIPTION,
	inputSchema: {
		type: 'object',
		properties: {
			path: { type: 'string', description: 'a file or directory to audit' },
			paths: {
				type: 'array',
				items: { type: 'string' },
				description: 'several files or directories, instead of `path`',
			},
			resolve: {
				type: 'boolean',
				default: true,
				description:
					'check each path against the filesystem (default true). With it off, paths are reported as written and none can be a finding.',
			},
			resolveScanned: {
				type: 'boolean',
				default: false,
				description:
					'check the paths found in a file no format extractor reads — Python, Markdown, a Dockerfile — against the filesystem too. Those are found by scanning raw text, so they are reported as written by default rather than claimed to be missing.',
			},
			root: {
				type: 'string',
				description:
					'the directory a relative path may not escape; the audited directory is used when omitted',
			},
			denySymlinks: {
				type: 'boolean',
				default: false,
				description:
					'count a symlink as a finding too; it is reported either way',
			},
		},
	},
	handler: audit,
});
