import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_createExtensionContext,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_respondToQuickPick,
	_setActiveEditor,
	_setConfig,
	_setWorkspaceFiles,
	_shownMessages,
	_statusBarItems,
	_webviewPanels,
	appliedEdits,
	executedBuiltins,
	Uri,
	workspace,
} from './__mocks__/vscode';
import { activate } from './extension';

/**
 * Every command, started a second time while the first is suspended.
 *
 * The policy the code implements is that each run is independent: no command
 * holds state another run reads, so two runs deliver two results. What they
 * share is the status bar, which the later run resets, and the canonical
 * warning flag, which two first runs may both ask for. Neither corrupts a
 * result, and both ends are asserted here.
 */

function command(id: string): (...args: unknown[]) => Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	return async (...args) => {
		await handler(...args);
	};
}

const IDLE = '$(file-directory) Paths-LE';

beforeEach(() => {
	_resetMockState();
	_setConfig('paths-le.notificationsLevel', 'all');
	_setWorkspaceFiles({ '/w/a.ts': "import x from './lib/x';\n" });
	workspace.workspaceFolders = [{ uri: Uri.file('/w'), name: 'w', index: 0 }];
	activate(_createExtensionContext() as never);
});

describe('two invocations at once', () => {
	it('extractPaths: both deliver, and the bar ends idle', async () => {
		_setActiveEditor(
			_createDocument({
				content: "import x from './y';",
				languageId: 'typescript',
			}),
		);
		const run = command('paths-le.extractPaths');
		await Promise.all([run(), run()]);
		expect(_openedDocuments()).toHaveLength(2);
		expect(
			_shownMessages().filter((m) => m.message.startsWith('Extracted')),
		).toHaveLength(2);
		expect(_statusBarItems()[0]?.text).toBe(IDLE);
	});

	it('extractWorkspace and extractFolder: two reports', async () => {
		await Promise.all([
			command('paths-le.extractWorkspace')(),
			command('paths-le.extractFolder')(Uri.file('/w')),
		]);
		expect(_openedDocuments()).toHaveLength(2);
		for (const report of _openedDocuments()) {
			expect(report.getText()).toContain('`./lib/x`');
		}
	});

	it('dedupe and sort: both edits land, each computed from the text it read', async () => {
		_setActiveEditor(_createDocument({ content: '/b\n/a\n/a' }));
		_respondToQuickPick((items) => items[0]);
		await Promise.all([
			command('paths-le.postProcess.dedupe')(),
			command('paths-le.postProcess.sort')(),
		]);
		expect(appliedEdits.map((edit) => edit.replacements[0]?.newText)).toEqual([
			'/b\n/a',
			'/a\n/a\n/b',
		]);
	});

	it('help and openSettings: one panel, two settings calls', async () => {
		await Promise.all([
			command('paths-le.help')(),
			command('paths-le.help')(),
			command('paths-le.openSettings')(),
			command('paths-le.openSettings')(),
		]);
		expect(_webviewPanels()).toHaveLength(1);
		expect(executedBuiltins).toHaveLength(2);
	});
});
