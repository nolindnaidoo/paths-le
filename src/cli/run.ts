/**
 * The terminal surface, as the Rust CLI's `cli.rs` runs it.
 *
 * stdout is protocol: one JSON report per line whenever something is reading
 * it, and nothing when it is a terminal, because the stderr summary already
 * says everything a person reads there.
 */
import { join } from 'node:path';
import { type Cli, parse } from './args';
import {
	type AuditOptions,
	auditContent,
	auditFile,
	describe,
	exitCode,
	type FileReport,
	position,
} from './audit';
import { decodeUtf8OrThrow, rustIoMessage } from './ioError';
import { isFinding } from './resolve';
import { chooseRoot } from './root';
import { display } from './rustPath';
import { USAGE } from './usage';
import { collect } from './walk';

export interface RunIo {
	readonly stdout: (text: string) => void;
	readonly stderr: (text: string) => void;
	readonly stdoutIsTerminal: boolean;
	readonly readStdin: () => Promise<Uint8Array>;
	readonly cwd: string;
	readonly version: string;
}

interface Audit {
	readonly reports: readonly FileReport[];
	readonly binary: number;
	readonly root: string;
}

export async function run(args: readonly string[], io: RunIo): Promise<number> {
	const first = args[0];
	if (first === '--help' || first === '-h') {
		io.stdout(`${USAGE}\n`);
		return 0;
	}
	if (first === '--version' || first === '-V') {
		io.stdout(`paths-le ${io.version}\n`);
		return 0;
	}

	try {
		return await execute(args, io);
	} catch (error) {
		io.stderr(
			`paths-le: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		return 2;
	}
}

async function execute(args: readonly string[], io: RunIo): Promise<number> {
	const options = parse(args);
	const { reports, binary, root } = options.stdin
		? await auditStdin(options, io)
		: auditInputs(options, io.cwd);

	io.stdout(jsonLines(reports, io.stdoutIsTerminal));
	io.stderr(summary(reports, options.resolve ? root : null, binary));
	return exitCode(reports, options.strict);
}

/**
 * A binary file gets no report, since it was never a text candidate, but it is
 * counted, because a run that covered fewer files than the tree holds has to
 * say so.
 */
function auditInputs(options: Cli, cwd: string): Audit {
	const targets = collect(options.inputs, options.walk);
	const audit = auditOptions(
		options,
		chooseRoot(options.root, options.inputs, cwd),
	);
	const reports = targets
		.map((target) => auditFile(target, audit))
		.filter((report): report is FileReport => report !== null);
	return { reports, binary: targets.length - reports.length, root: audit.root };
}

/**
 * A document on stdin has no directory of its own, so a relative path in it
 * resolves against the working directory. The format is checked before
 * reading: a caller who forgot it is told so rather than left waiting.
 */
async function auditStdin(options: Cli, io: RunIo): Promise<Audit> {
	const format = options.format;
	if (format === null) {
		throw new Error(
			'reading from stdin needs --format: the name that would carry the format is not there',
		);
	}
	let content: string;
	try {
		content = decodeUtf8OrThrow(await io.readStdin());
	} catch (error) {
		throw new Error(`could not read stdin: ${rustIoMessage(error)}`);
	}
	const audit = auditOptions(
		options,
		chooseRoot(options.root, [io.cwd], io.cwd),
	);
	const report = auditContent(
		content,
		{ path: join(io.cwd, '<stdin>'), languageId: format },
		audit,
	);
	return {
		reports: [{ ...report, file: '<stdin>' }],
		binary: 0,
		root: audit.root,
	};
}

function auditOptions(options: Cli, root: string): AuditOptions {
	return Object.freeze({
		resolve: options.resolve,
		resolveScanned: options.resolveScanned,
		root,
		denySymlinks: options.denySymlinks,
	});
}

function jsonLines(reports: readonly FileReport[], terminal: boolean): string {
	if (terminal) return '';
	return reports.map((report) => `${JSON.stringify(report)}\n`).join('');
}

/**
 * The human half. Every line restates the JSON, plus the root, named once,
 * because every location in the report is spelled relative to it. A resolved
 * run lists its findings; an unresolved run can have none, so it lists every
 * path, which is what `--no-resolve` asks for.
 */
function summary(
	reports: readonly FileReport[],
	root: string | null,
	binary: number,
): string {
	const lines: string[] = [];
	let listed = 0;
	for (const report of reports) {
		for (const diagnostic of report.diagnostics) {
			lines.push(`${report.file}: ${diagnostic.message}`);
		}
		for (const audited of report.paths) {
			if (root === null) {
				lines.push(position(report, audited));
				continue;
			}
			if (!isFinding(audited.resolution.verdict, true)) continue;
			listed += 1;
			lines.push(describe(report, audited));
		}
	}

	const paths = reports.reduce((sum, report) => sum + report.summary.paths, 0);
	const counted = reports.reduce(
		(sum, report) => sum + report.summary.findings,
		0,
	);
	const tail =
		root === null ? 'not resolved' : plural(counted, 'finding', 'findings');
	// A symlink listed above that this run does not count is said to be so,
	// or the tally and the list disagree in plain sight.
	const noted = listed - Math.min(counted, listed);
	const notedText = noted > 0 ? `, ${noted} noted but not counted` : '';
	const binaryText = binary > 0 ? `, ${binary} binary files skipped` : '';
	const scope = root === null ? '' : ` (root ${display(root)})`;
	lines.push(
		`${plural(paths, 'path', 'paths')} in ${plural(reports.length, 'file', 'files')} — ${tail}${notedText}${binaryText}${scope}`,
	);
	return lines.map((line) => `${line}\n`).join('');
}

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}
