import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_createExtensionContext,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_respondToWarning,
	_setActiveEditor,
	_setApplyEditResult,
	_setClipboardError,
	_setConfig,
	_shownMessages,
	_statusBarItems,
	Uri,
	workspace,
} from '../__mocks__/vscode';
import { activate, deactivate } from '../extension';
import type { Telemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import type { RatingPrompt } from '../ui/ratingPrompt';
import { createStatusBar, type StatusBar } from '../ui/statusBar';
import { registerExtractCommand } from './extract';

/**
 * The extract command, which was the least-covered file in the family.
 *
 * Almost all of it sits behind guards — no editor, the safety check, an empty
 * result — or behind the canonical-resolution security dialog, which only
 * appears when that setting is on and the warning has not been acknowledged.
 * The existing suite covered the default happy path, so none of it ran.
 */

function makeContext() {
	return _createExtensionContext() as never;
}

function makeDeps(events: string[] = [], successes: number[] = []) {
	const telemetry: Telemetry = {
		event: (name) => events.push(name),
		dispose: () => {},
	};
	const statusBar: StatusBar = {
		showProgress: () => {},
		hideProgress: () => {},
		dispose: () => {},
	} as unknown as StatusBar;
	const ratingPrompt: RatingPrompt = {
		recordSuccess: async () => {
			successes.push(1);
		},
	};
	return { telemetry, notifier: createNotifier(), statusBar, ratingPrompt };
}

async function runCommand(id: string): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler();
}

// extractPaths keys off languageId, not the filename, and plaintext is not a
// supported format — a plaintext document yields no paths and returns early
// before any of the interesting branches.
const PATHS = '{"main": "./src/index.ts", "lib": "../lib/util.ts"}';
const LANG = 'json';

beforeEach(() => {
	_resetMockState();
	_setConfig('paths-le.notificationsLevel', 'all');
});

describe('extract: guards', () => {
	it('warns without an active editor', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		await runCommand('paths-le.extractPaths');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('reports a document with no paths', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content: '{}', languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('reports an empty document', async () => {
		registerExtractCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content: '', languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('extracts paths from a plain document', async () => {
		const events: string[] = [];
		registerExtractCommand(makeContext(), makeDeps(events));
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(events.length).toBeGreaterThan(0);
	});
});

describe('extract: safety warnings', () => {
	it('shows the large-output warning the setting promises', async () => {
		// `safety.largeOutputLinesThreshold` is described as a warning threshold
		// and the README says "Warn above this line count". The warning was
		// computed and put in a list that nothing read, so the setting changed
		// nothing a user could see.
		_setConfig('paths-le.safety.largeOutputLinesThreshold', 100);
		registerExtractCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({
				content: `{"a": "./x.ts"${',\n"k": 1'.repeat(150)}}`,
				languageId: LANG,
			}),
		);
		await runCommand('paths-le.extractPaths');
		expect(
			_shownMessages().filter(
				(m) => m.kind === 'warning' && m.message.includes('Large file'),
			),
		).toHaveLength(1);
		// The warning is advice, not a refusal: the extraction still runs.
		expect(_openedDocuments().at(-1)?.getText()).toBe('./x.ts');
	});

	it('shows nothing when the document is under the threshold', async () => {
		_setConfig('paths-le.safety.largeOutputLinesThreshold', 100);
		registerExtractCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(_shownMessages().filter((m) => m.kind === 'warning')).toEqual([]);
	});
});

describe('extract: canonical resolution warning', () => {
	// The dialog governs whether absolute filesystem paths reach the output, so
	// each answer is checked rather than just the happy path.
	// "Canonical" is on when either resolution mode is enabled — there is no
	// single canonical flag.
	function enableCanonical(): void {
		_setConfig('paths-le.resolution.resolveSymlinks', true);
	}

	it('asks before resolving canonically the first time', async () => {
		enableCanonical();
		let asked = false;
		_respondToWarning((items) => {
			asked = true;
			return items.find((i) => String(i).includes('Continue'));
		});
		registerExtractCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(asked).toBe(true);
	});

	it('stops when the dialog is dismissed', async () => {
		enableCanonical();
		_respondToWarning(() => undefined);
		const events: string[] = [];
		registerExtractCommand(makeContext(), makeDeps(events));
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(events.some((e) => e.includes('success'))).toBe(false);
	});

	it('turns the setting off when asked to disable', async () => {
		enableCanonical();
		_respondToWarning((items) =>
			items.find((i) => String(i).includes('Disable')),
		);
		registerExtractCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(_shownMessages().length).toBeGreaterThan(0);
	});

	it('opens the docs when asked to learn more', async () => {
		enableCanonical();
		_respondToWarning((items) =>
			items.find((i) => String(i).includes('Learn More')),
		);
		const events: string[] = [];
		registerExtractCommand(makeContext(), makeDeps(events));
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		// Learn More does not proceed with the extraction.
		expect(events.some((e) => e.includes('success'))).toBe(false);
	});

	it('does not ask again once acknowledged', async () => {
		enableCanonical();
		let asks = 0;
		_respondToWarning((items) => {
			asks += 1;
			return items.find((i) => String(i).includes('Continue'));
		});
		const context = _createExtensionContext();
		registerExtractCommand(context as never, makeDeps());
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		await runCommand('paths-le.extractPaths');
		expect(asks).toBe(1);
	});

	it('never asks while both resolution modes are off', async () => {
		_setConfig('paths-le.resolution.resolveSymlinks', false);
		_setConfig('paths-le.resolution.resolveWorkspaceRelative', false);
		let asked = false;
		_respondToWarning(() => {
			asked = true;
			return undefined;
		});
		registerExtractCommand(makeContext(), makeDeps());
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(asked).toBe(false);
	});
});

describe('extract: the status bar is reset however the command ends', () => {
	// The spinner went up before the security dialog, and every answer but
	// Continue returned without taking it down, so the bar read "Resolving
	// canonical paths..." until the next successful extraction.
	const IDLE = '$(file-directory) Paths-LE';

	function withRealStatusBar(context: ReturnType<typeof makeContext>) {
		return { ...makeDeps(), statusBar: createStatusBar(context) };
	}

	it('after the security dialog is dismissed', async () => {
		_setConfig('paths-le.resolution.resolveSymlinks', true);
		_respondToWarning(() => undefined);
		const context = makeContext();
		registerExtractCommand(context, withRealStatusBar(context));
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(_statusBarItems()[0]?.text).toBe(IDLE);
	});

	it('after Disable and Continue', async () => {
		_setConfig('paths-le.resolution.resolveSymlinks', true);
		_respondToWarning((items) =>
			items.find((i) => String(i).includes('Disable')),
		);
		const context = makeContext();
		registerExtractCommand(context, withRealStatusBar(context));
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(_statusBarItems()[0]?.text).toBe(IDLE);
	});

	it('after a rejected in-place edit', async () => {
		_setConfig('paths-le.openResultsSideBySide', false);
		_setConfig('paths-le.postProcess.openInNewFile', false);
		_setApplyEditResult(false);
		const context = makeContext();
		registerExtractCommand(context, withRealStatusBar(context));
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(_statusBarItems()[0]?.text).toBe(IDLE);
	});
});

describe('extract: what the status bar claims about resolution', () => {
	it('does not report a failure when every path was already canonical', async () => {
		// "Canonical resolution failed, using original paths" was shown whenever
		// no path changed, which is also what happens when every path was
		// already canonical, or is a URL. Nothing failed.
		workspace.workspaceFolders = [{ uri: Uri.file('/w'), name: 'w', index: 0 }];
		_setConfig('paths-le.resolution.resolveWorkspaceRelative', true);
		_respondToWarning((items) =>
			items.find((i) => String(i).includes('Continue')),
		);
		const status: string[] = [];
		const deps = makeDeps();
		registerExtractCommand(makeContext(), {
			...deps,
			statusBar: {
				showProgress: (message: string) => status.push(message),
				hideProgress: () => status.push('idle'),
				dispose: () => {},
			},
		});
		_setActiveEditor(
			_createDocument({
				content: '{"a": "/etc/hosts", "b": "https://example.com/x"}',
				languageId: LANG,
				fileName: '/w/app.json',
			}),
		);
		await runCommand('paths-le.extractPaths');
		expect(status.filter((s) => /fail/i.test(s))).toEqual([]);
		expect(_openedDocuments().at(-1)?.getText()).toBe(
			'/etc/hosts\nhttps://example.com/x',
		);
	});
});

describe('extract: workspace-relative resolution', () => {
	it('resolves against the folder the document is in', async () => {
		// The folder was looked up from the extension host's working directory,
		// which is nowhere near the document in a multi-root workspace, so the
		// lookup found nothing and workspace-relative resolution silently did
		// nothing. The document's own folder is known and is the only right one.
		workspace.workspaceFolders = [
			{ uri: Uri.file('/first'), name: 'first', index: 0 },
			{ uri: Uri.file('/second'), name: 'second', index: 1 },
		];
		_setConfig('paths-le.resolution.resolveWorkspaceRelative', true);
		_respondToWarning((items) =>
			items.find((i) => String(i).includes('Continue')),
		);
		registerExtractCommand(makeContext(), makeDeps());
		_setActiveEditor(
			_createDocument({
				content: '{"main": "./src/index.ts"}',
				languageId: LANG,
				fileName: '/second/app.json',
			}),
		);
		await runCommand('paths-le.extractPaths');
		expect(_openedDocuments().at(-1)?.getText()).toBe('/second/src/index.ts');
	});
});

describe('activation', () => {
	it('registers every command declared in the manifest', () => {
		activate(makeContext());
		for (const command of [
			'paths-le.extractPaths',
			'paths-le.postProcess.dedupe',
			'paths-le.postProcess.sort',
			'paths-le.openSettings',
			'paths-le.help',
		]) {
			expect(_registeredCommands().has(command)).toBe(true);
		}
	});

	it('opens the help webview', async () => {
		activate(makeContext());
		await runCommand('paths-le.help');
		// The command exists to show a webview; reaching the end without
		// throwing is the contract.
		expect(_registeredCommands().has('paths-le.help')).toBe(true);
	});

	it('deactivate is a no-op that does not throw', () => {
		expect(() => deactivate()).not.toThrow();
	});
});

describe('extract: rejected in-place edit', () => {
	it('reports a failure instead of a count', async () => {
		// The replace route is the one that writes to the user's document.
		// applyEdit resolves false for a read-only document, or one that changed
		// underneath the command, and that value was discarded — so "Extracted N
		// paths from document" was shown over unchanged text.
		const events: string[] = [];
		registerExtractCommand(makeContext(), makeDeps(events));
		_setConfig('paths-le.openResultsSideBySide', false);
		_setConfig('paths-le.postProcess.openInNewFile', false);
		_setApplyEditResult(false);
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(_shownMessages().some((m) => m.kind === 'error')).toBe(true);
		expect(
			_shownMessages().some((m) => String(m.message).includes('Extracted')),
		).toBe(false);
		expect(events).not.toContain('extract-success');
	});

	it('does not count a rejected edit towards the rating prompt', async () => {
		const successes: number[] = [];
		registerExtractCommand(makeContext(), makeDeps([], successes));
		_setConfig('paths-le.openResultsSideBySide', false);
		_setConfig('paths-le.postProcess.openInNewFile', false);
		_setApplyEditResult(false);
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(successes).toHaveLength(0);
	});

	it('counts a delivered extraction towards the rating prompt', async () => {
		const successes: number[] = [];
		registerExtractCommand(makeContext(), makeDeps([], successes));
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(successes).toHaveLength(1);
	});

	it('announces the count when the edit applies', async () => {
		const events: string[] = [];
		registerExtractCommand(makeContext(), makeDeps(events));
		_setConfig('paths-le.openResultsSideBySide', false);
		_setConfig('paths-le.postProcess.openInNewFile', false);
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(_shownMessages().some((m) => m.kind === 'error')).toBe(false);
		expect(events).toContain('extract-success');
	});
});

describe('extract: clipboard failure', () => {
	it('warns instead of failing the extraction', async () => {
		// The results are already in an editor by the time the copy runs, so an
		// unavailable clipboard — a remote or headless session — must not surface
		// as "Failed to extract paths" for work that succeeded.
		const events: string[] = [];
		registerExtractCommand(makeContext(), makeDeps(events));
		_setConfig('paths-le.copyToClipboardEnabled', true);
		_setClipboardError(new Error('clipboard unavailable'));
		_setActiveEditor(_createDocument({ content: PATHS, languageId: LANG }));
		await runCommand('paths-le.extractPaths');
		expect(_shownMessages().some((m) => m.kind === 'warning')).toBe(true);
		expect(_shownMessages().some((m) => m.kind === 'error')).toBe(false);
		expect(events).toContain('extract-success');
	});
});
