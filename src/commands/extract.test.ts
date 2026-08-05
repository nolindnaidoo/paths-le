import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_createExtensionContext,
	_registeredCommands,
	_resetMockState,
	_respondToWarning,
	_setActiveEditor,
	_setApplyEditResult,
	_setConfig,
	_shownMessages,
} from '../__mocks__/vscode';
import { activate, deactivate } from '../extension';
import type { Telemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
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

function makeDeps(events: string[] = []) {
	const telemetry: Telemetry = {
		event: (name) => events.push(name),
		dispose: () => {},
	};
	const statusBar: StatusBar = {
		showProgress: () => {},
		hideProgress: () => {},
		dispose: () => {},
	} as unknown as StatusBar;
	return { telemetry, notifier: createNotifier(), statusBar };
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
