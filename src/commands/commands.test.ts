import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_registeredCommands,
	_resetMockState,
	_respondToQuickPick,
	_setActiveEditor,
	_setApplyEditResult,
	_setConfig,
	_shownMessages,
	appliedEdits,
} from '../__mocks__/vscode';
import { createNotifier } from '../ui/notifier';
import { registerDedupeCommand } from './dedupe';
import { registerSortCommand } from './sort';

function makeContext() {
	return { subscriptions: [] as Array<{ dispose(): void }> } as never;
}

async function runCommand(id: string): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler();
}

beforeEach(() => {
	_resetMockState();
});

describe('paths-le.postProcess.dedupe', () => {
	it('warns when no editor is active', async () => {
		_setConfig('paths-le.notificationsLevel', 'important');
		registerDedupeCommand(makeContext(), createNotifier());
		await runCommand('paths-le.postProcess.dedupe');
		expect(_shownMessages()[0]?.kind).toBe('warning');
		expect(appliedEdits).toHaveLength(0);
	});

	it('removes duplicates and reports an honest count', async () => {
		_setConfig('paths-le.notificationsLevel', 'all');
		registerDedupeCommand(makeContext(), createNotifier());
		_setActiveEditor(_createDocument({ content: '/a\n/b\n\n/a\n/c\n/b\n' }));
		await runCommand('paths-le.postProcess.dedupe');

		expect(appliedEdits).toHaveLength(1);
		expect(appliedEdits[0]?.replacements[0]?.newText).toBe('/a\n/b\n/c');
		// 5 non-empty lines, 3 unique -> 2 duplicates (blank lines not counted)
		expect(_shownMessages()[0]?.message).toBe(
			'Removed 2 duplicate paths (3 remaining)',
		);
	});

	it('suppresses the success toast at the default silent level', async () => {
		registerDedupeCommand(makeContext(), createNotifier());
		_setActiveEditor(_createDocument({ content: '/a\n/a' }));
		await runCommand('paths-le.postProcess.dedupe');

		expect(appliedEdits).toHaveLength(1); // the edit still happens
		expect(_shownMessages()).toHaveLength(0); // the toast does not
	});
});

describe('paths-le.postProcess.sort', () => {
	it('sorts alphabetically ascending via quick pick', async () => {
		_setConfig('paths-le.notificationsLevel', 'all');
		registerSortCommand(makeContext(), createNotifier());
		_setActiveEditor(_createDocument({ content: '/c\n/a\n/b' }));
		_respondToQuickPick(
			(items) =>
				(items as Array<{ label: string; value: string }>).find(
					(item) => item.value === 'asc',
				) ?? items[0],
		);
		await runCommand('paths-le.postProcess.sort');

		expect(appliedEdits[0]?.replacements[0]?.newText).toBe('/a\n/b\n/c');
		expect(_shownMessages()[0]?.message).toContain('Sorted 3 paths');
	});

	it('sorts by length descending', async () => {
		registerSortCommand(makeContext(), createNotifier());
		_setActiveEditor(_createDocument({ content: '/ab\n/abcd\n/a' }));
		_respondToQuickPick((items) =>
			(items as Array<{ value: string }>).find(
				(item) => item.value === 'length-desc',
			),
		);
		await runCommand('paths-le.postProcess.sort');

		expect(appliedEdits[0]?.replacements[0]?.newText).toBe('/abcd\n/ab\n/a');
	});

	it('does nothing when the quick pick is dismissed', async () => {
		registerSortCommand(makeContext(), createNotifier());
		_setActiveEditor(_createDocument({ content: '/b\n/a' }));
		_respondToQuickPick(() => undefined);
		await runCommand('paths-le.postProcess.sort');
		expect(appliedEdits).toHaveLength(0);
	});
});

describe('paths-le.extractPaths', () => {
	it('extracts to a side-by-side document and copies when configured', async () => {
		const { registerExtractCommand } = await import('./extract');
		const context = {
			subscriptions: [],
			globalState: {
				get: () => false,
				update: async () => {},
			},
		} as never;

		const events: string[] = [];
		registerExtractCommand(context, {
			telemetry: { event: (n: string) => events.push(n), dispose: () => {} },
			notifier: {
				showInfo: (m: string) => events.push(`info:${m}`),
				showWarning: (m: string) => events.push(`warn:${m}`),
				showError: (m: string) => events.push(`error:${m}`),
			},
			statusBar: {
				showProgress: () => {},
				hideProgress: () => {},
				dispose: () => {},
			},
		});

		_setConfig('paths-le.copyToClipboardEnabled', true);
		_setActiveEditor(
			_createDocument({
				content: 'import { x } from "./lib/util";',
				languageId: 'javascript',
			}),
		);

		await runCommand('paths-le.extractPaths');

		expect(events).toContain('command-extract-paths');
		expect(events).toContain('info:Extracted 1 paths from document');
		const { _clipboardText } = await import('../__mocks__/vscode');
		expect(_clipboardText()).toBe('./lib/util');
	});

	it('extracts from a language with no typed extractor', async () => {
		const { registerExtractCommand } = await import('./extract');
		const context = {
			subscriptions: [],
			globalState: { get: () => false, update: async () => {} },
		} as never;

		const events: string[] = [];
		registerExtractCommand(context, {
			telemetry: { event: () => {}, dispose: () => {} },
			notifier: {
				showInfo: (m: string) => events.push(`info:${m}`),
				showWarning: (m: string) => events.push(`warn:${m}`),
				showError: (m: string) => events.push(`error:${m}`),
			},
			statusBar: {
				showProgress: () => {},
				hideProgress: () => {},
				dispose: () => {},
			},
		});

		// Changed deliberately: this used to assert the unsupported-format
		// notice. Every language is read now, so the command extracts instead.
		_setActiveEditor(
			_createDocument({
				content: 'open("./data/in.csv")',
				languageId: 'python',
			}),
		);
		await runCommand('paths-le.extractPaths');

		expect(events).toContain('info:Extracted 1 paths from document');
		expect(events.some((e) => e.startsWith('error:'))).toBe(false);
	});
});

describe('post-process: rejected edits', () => {
	// applyEdit resolves false for a read-only document, or one that changed
	// underneath the command. Both commands discarded that value and announced
	// a result over a document they had not touched.

	it('dedupe reports a failure instead of a count', async () => {
		_setConfig('paths-le.notificationsLevel', 'all');
		registerDedupeCommand(makeContext(), createNotifier());
		_setApplyEditResult(false);
		_setActiveEditor(_createDocument({ content: './a.ts\n./a.ts\n./b.ts\n' }));
		await runCommand('paths-le.postProcess.dedupe');
		expect(_shownMessages().some((m) => m.kind === 'error')).toBe(true);
		expect(
			_shownMessages().some((m) => String(m.message).startsWith('Removed')),
		).toBe(false);
	});

	it('sort reports a failure instead of a count', async () => {
		_setConfig('paths-le.notificationsLevel', 'all');
		registerSortCommand(makeContext(), createNotifier());
		_setApplyEditResult(false);
		_respondToQuickPick((items) => items[0]);
		_setActiveEditor(_createDocument({ content: './b.ts\n./a.ts\n./c.ts\n' }));
		await runCommand('paths-le.postProcess.sort');
		expect(_shownMessages().some((m) => m.kind === 'error')).toBe(true);
		expect(
			_shownMessages().some((m) => String(m.message).startsWith('Sorted')),
		).toBe(false);
	});
});
