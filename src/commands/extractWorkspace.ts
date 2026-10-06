import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import { extractPathsFromText } from '../extraction/extract';
import { resolveFormat } from '../mcp/fileType';
import {
	listFiles,
	type ScanLimits,
	type ScanSummary,
	scanFiles,
	unreadNotes,
} from '../workspace/scan';
import {
	askForFolder,
	code,
	deliver,
	hasSomethingToScan,
	limitsFrom,
	type WorkspaceDeps,
} from './workspaceShared';

/** One place a path is written. A reader that resolved the value has no position for it. */
export interface Occurrence {
	readonly file: string;
	readonly position:
		| { readonly line: number; readonly column: number }
		| undefined;
}

/** A file its format reader would not read, and why. */
export interface Refused {
	readonly file: string;
	readonly reason: string;
}

/** A path, and every place it was found. */
export interface DistinctPath {
	readonly value: string;
	readonly occurrences: readonly Occurrence[];
}

export function registerExtractWorkspaceCommands(
	context: vscode.ExtensionContext,
	deps: WorkspaceDeps,
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('paths-le.extractWorkspace', async () =>
			extractWorkspace(deps),
		),
		// The Explorer hands over the folder that was clicked. From the
		// palette there is none, and the command asks.
		vscode.commands.registerCommand(
			'paths-le.extractFolder',
			async (picked?: vscode.Uri) => {
				const folder = picked ?? (await askForFolder());
				if (folder !== undefined) await extractWorkspace(deps, folder);
			},
		),
	);
}

/**
 * Extract every path in every file under a folder, or in the whole workspace
 * when no folder is given.
 *
 * A project writes the same path in many places, so the answer is the
 * distinct paths and where each one is, not one long list. Files are read
 * from disk, so an unsaved edit is not seen.
 */
async function extractWorkspace(
	deps: WorkspaceDeps,
	root?: vscode.Uri,
): Promise<void> {
	deps.telemetry.event(
		root === undefined ? 'command-extract-workspace' : 'command-extract-folder',
	);
	if (!hasSomethingToScan(root, deps)) return;
	const config = getConfiguration();
	const limits = limitsFrom(config);

	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: vscode.l10n.t('Scanning files...'),
			cancellable: true,
		},
		async (progress, token) => {
			const { files, fileLimitReached, ignored } = await listFiles(
				root,
				limits,
			);
			const found = new Map<string, Occurrence[]>();
			const refused: Refused[] = [];
			let total = 0;
			const scanned = await scanFiles(
				root,
				files,
				limits,
				token,
				(done, all) =>
					progress.report({
						message: vscode.l10n.t('{0} of {1} files', done, all),
					}),
				({ file, text }) => {
					// The language comes from the file's name. One nothing
					// recognises is scanned whole, as Extract scans it.
					const extracted = extractPathsFromText(
						text,
						resolveFormat(undefined, file),
					);
					// A reader that refused a document found nothing in it, which is
					// not the same as the document holding nothing.
					if ('refusal' in extracted) {
						refused.push({ file, reason: extracted.refusal });
						return true;
					}
					for (const path of extracted.paths) {
						if (total >= config.workspaceScanMaxResults) return false;
						const occurrence = { file, position: path.position };
						const where = found.get(path.value);
						if (where === undefined) found.set(path.value, [occurrence]);
						else where.push(occurrence);
						total++;
					}
					return total < config.workspaceScanMaxResults;
				},
			);
			// A cancelled scan read part of the tree. Reporting that as the
			// project's paths would understate it without saying so.
			if (scanned.cancelled) return;
			const summary: ScanSummary = { ...scanned, fileLimitReached, ignored };

			const paths = distinct(found);
			const where =
				root === undefined
					? undefined
					: vscode.workspace.asRelativePath(root, false);
			await deliver(
				(positions) =>
					formatExtractWorkspaceReport({
						where,
						paths,
						refused,
						summary,
						limits,
						positions,
					}),
				config,
				deps,
			);

			deps.telemetry.event('extract-workspace-completed', {
				files: summary.read,
				paths: paths.length,
				occurrences: total,
			});
			deps.notifier.showInfo(headline(paths));
		},
	);
}

/**
 * The most widely used first, then by the path's own text.
 *
 * A plain comparison rather than `localeCompare`: the order must not change
 * with the editor's display language.
 */
function distinct(found: ReadonlyMap<string, Occurrence[]>): DistinctPath[] {
	return [...found]
		.map(([value, occurrences]) => ({ value, occurrences }))
		.sort(
			(a, b) =>
				b.occurrences.length - a.occurrences.length ||
				(a.value < b.value ? -1 : Number(a.value > b.value)),
		);
}

function filesOf(occurrences: readonly Occurrence[]): string[] {
	return [...new Set(occurrences.map((occurrence) => occurrence.file))];
}

function headline(paths: readonly DistinctPath[]): string {
	const occurrences = paths.flatMap((path) => path.occurrences);
	return vscode.l10n.t(
		'{0} distinct path(s), {1} occurrence(s) in {2} file(s)',
		paths.length,
		occurrences.length,
		filesOf(occurrences).length,
	);
}

export interface ExtractWorkspaceReportInput {
	/** The folder that was scanned, or undefined for the whole workspace. */
	readonly where: string | undefined;
	readonly paths: readonly DistinctPath[];
	readonly refused: readonly Refused[];
	readonly summary: ScanSummary;
	readonly limits: ScanLimits;
	readonly positions?: boolean;
}

/**
 * The report for a folder or a workspace: a table of the distinct paths with
 * how often and in how many files each is written, then where each one is,
 * and last whatever the scan left unread.
 */
export function formatExtractWorkspaceReport({
	where,
	paths,
	refused,
	summary,
	limits,
	positions = true,
}: ExtractWorkspaceReportInput): string {
	const lines: string[] = [
		`# ${vscode.l10n.t('{0} workspace report', 'Paths-LE')}`,
		'',
	];
	const scope = where === undefined ? '' : `${code(where)} · `;
	lines.push(
		`${scope}${vscode.l10n.t('{0} file(s) read', summary.read)} · ${headline(paths)}`,
		'',
	);
	if (paths.length === 0) lines.push(vscode.l10n.t('No paths found.'), '');

	if (paths.length > 0) {
		lines.push(
			`| ${vscode.l10n.t('Path')} | ${vscode.l10n.t('Occurrences')} | ${vscode.l10n.t('Files')} |`,
			'|---|---|---|',
		);
		for (const path of paths)
			lines.push(
				`| ${code(path.value).replace(/\|/g, '\\|')} | ${path.occurrences.length} | ${filesOf(path.occurrences).length} |`,
			);
		lines.push('');
	}

	for (const path of paths) {
		lines.push(`## ${code(path.value)} (${path.occurrences.length})`, '');
		// One line per file, with every place in it.
		for (const file of filesOf(path.occurrences)) {
			const here = path.occurrences.filter((o) => o.file === file);
			const placed = here.flatMap((o) =>
				o.position === undefined
					? []
					: [`**${o.position.line}:${o.position.column}**`],
			);
			if (positions && placed.length > 0)
				lines.push(`- ${code(file)} · ${placed.join(', ')}`);
			else
				lines.push(
					here.length > 1
						? `- ${code(file)} (${here.length})`
						: `- ${code(file)}`,
				);
		}
		lines.push('');
	}

	if (refused.length > 0) {
		lines.push(
			`## ${vscode.l10n.t('Could not be read ({0})', refused.length)}`,
			'',
			...refused.map((entry) => `- ${code(entry.file)}: ${entry.reason}`),
			'',
		);
	}

	const notes = unreadNotes(summary, limits, code('paths-le.workspace.*'));
	if (notes.length > 0) lines.push(...notes.map((note) => `> ${note}`), '');
	return lines.join('\n');
}
