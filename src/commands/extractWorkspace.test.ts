import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	_clipboardText,
	_openedDocuments,
	_registeredCommands,
	_resetMockState,
	_respondToOpenDialog,
	_setConfig,
	_setWorkspaceFiles,
	_shownMessages,
	Uri,
	workspace,
} from '../__mocks__/vscode';
import { createTelemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import { createStatusBar } from '../ui/statusBar';
import { registerExtractWorkspaceCommands } from './extractWorkspace';

const TREE = {
	'/w/src/a.ts':
		"import { x } from './lib/util';\nimport { y } from './lib/util';\nconst cfg = './config/app.json';\n",
	'/w/src/b.ts': "import { x } from './lib/util';\n",
	'/w/deploy.json': '{\n  "config": "./config/app.json"\n}\n',
	'/w/node_modules/x.js': "require('./skipped/dep');\n",
	'/w/logo.png': './not/text',
};

async function runCommand(id: string, ...args: unknown[]): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler(...args);
}

function report(): string {
	const last = _openedDocuments().at(-1);
	if (!last) throw new Error('no report was opened');
	return last.getText();
}

function open(files: Record<string, string> = TREE): void {
	_setWorkspaceFiles(files);
	workspace.workspaceFolders = [{ uri: Uri.file('/w'), name: 'w', index: 0 }];
}

beforeEach(() => {
	_resetMockState();
	const context = { subscriptions: [] as Array<{ dispose(): void }> } as never;
	registerExtractWorkspaceCommands(context, {
		telemetry: createTelemetry(),
		notifier: createNotifier(),
		statusBar: createStatusBar(context),
	});
});

describe('paths-le.extractWorkspace and paths-le.extractFolder', () => {
	it('warns when no workspace is open', async () => {
		_setConfig('paths-le.notificationsLevel', 'all');
		await runCommand('paths-le.extractWorkspace');
		expect(_shownMessages()[0]).toMatchObject({ kind: 'warning' });
		expect(_openedDocuments()).toHaveLength(0);
	});

	it('lists each distinct path once, the most widely used first, with how often and where', async () => {
		_setConfig('paths-le.notificationsLevel', 'all');
		open();
		await runCommand('paths-le.extractWorkspace');

		const text = report();
		expect(text).toContain(
			'3 file(s) read · 2 distinct path(s), 4 occurrence(s) in 3 file(s)',
		);
		expect(text.split('\n').filter((line) => line.startsWith('| `'))).toEqual([
			'| `./lib/util` | 3 | 2 |',
			'| `./config/app.json` | 1 | 1 |',
		]);
		// Positions are off by default here: a file, and how many times.
		expect(text).toContain('- `/w/src/a.ts` (2)\n- `/w/src/b.ts`');
		expect(text).not.toMatch(/\*\*\d+:\d+\*\*/);
		// Left out by the built-in list, and a .png is never opened.
		expect(text).not.toContain('skipped/dep');
		expect(text).not.toContain('not/text');
		expect(_shownMessages().at(-1)?.message).toBe(
			'2 distinct path(s), 4 occurrence(s) in 3 file(s)',
		);
	});

	it('names a file its format reader refused, with the reason, and never as holding nothing', async () => {
		open({ ...TREE, '/w/bad.csv': 'a,"b\n' });
		await runCommand('paths-le.extractWorkspace');

		expect(report()).toContain('## Could not be read (1)');
		expect(report()).toMatch(/^- `\/w\/bad\.csv`: Invalid CSV: /m);
	});

	it('places every occurrence when positions are on, and decides the copy separately', async () => {
		open();
		_setConfig('paths-le.showPositions', true);
		_setConfig('paths-le.copyToClipboardEnabled', true);
		await runCommand('paths-le.extractWorkspace');

		expect(report()).toContain(
			'- `/w/src/a.ts` · **1:20**, **2:20**\n- `/w/src/b.ts` · **1:20**',
		);
		// The clipboard has its own setting, and that one is still off.
		expect(_clipboardText()).toContain('- `/w/src/a.ts` (2)');
		expect(_clipboardText()).not.toMatch(/\*\*\d+:\d+\*\*/);
	});

	it('scans only the folder it is handed, and names files relative to it', async () => {
		open();
		await runCommand('paths-le.extractFolder', Uri.file('/w/src'));

		expect(report()).toContain(
			'`/w/src` · 2 file(s) read · 1 distinct path(s), 3 occurrence(s) in 2 file(s)',
		);
		expect(report()).toContain('- `a.ts` (2)\n- `b.ts`');
	});

	it('asks for a folder from the palette, and does nothing when none is picked', async () => {
		open();
		_respondToOpenDialog(() => undefined);
		await runCommand('paths-le.extractFolder');
		expect(_openedDocuments()).toHaveLength(0);

		_respondToOpenDialog(() => [Uri.file('/w/src')]);
		await runCommand('paths-le.extractFolder');
		expect(report()).toContain('`/w/src` · 2 file(s) read');
	});

	it('stops at the results limit and says the rest was not read', async () => {
		open();
		_setConfig('paths-le.workspace.scanMaxResults', 1);
		await runCommand('paths-le.extractWorkspace');

		expect(report()).toContain(
			'1 distinct path(s), 1 occurrence(s) in 1 file(s)',
		);
		expect(report()).toContain(
			'> The results limit was reached. The rest of the files were not read.',
		);
	});

	it('says when a folder holds no paths', async () => {
		open({ '/w/a.txt': 'nothing here\n' });
		await runCommand('paths-le.extractWorkspace');
		expect(report()).toContain('No paths found.');
	});

	it('prints the report the README shows as its sample', async () => {
		open({ ...TREE, '/w/bad.csv': 'a,"b\n' });
		_setConfig('paths-le.showPositions', true);
		await runCommand('paths-le.extractFolder', Uri.file('/w'));

		const readme = readFileSync(
			join(__dirname, '..', '..', 'README.md'),
			'utf8',
		);
		const shown = report()
			.split('\n')
			.filter(
				(line) =>
					line.startsWith('- ') ||
					line.startsWith('| `') ||
					line.startsWith('## '),
			);
		expect(shown).toHaveLength(9);
		for (const line of shown) expect(readme).toContain(line);
		expect(readme).toContain(
			'4 file(s) read · 2 distinct path(s), 4 occurrence(s) in 3 file(s)',
		);
	});
});
