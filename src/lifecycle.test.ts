import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createDocument,
	_createExtensionContext,
	_live,
	_outputChannels,
	_registeredCommands,
	_resetMockState,
	_respondToQuickPick,
	_setActiveEditor,
	_setConfig,
	_setLmApi,
	_setWorkspaceFiles,
	_statusBarItems,
	_webviewPanels,
	Uri,
	workspace,
} from './__mocks__/vscode';
import { activate } from './extension';
import { createTelemetry } from './telemetry/telemetry';
import { createStatusBar } from './ui/statusBar';
import { createHelpWebView } from './ui/webView';

/**
 * What the extension holds, and whether it lets go.
 *
 * An extension host stays up for days, so a resource created per command and
 * never released is a real leak, and a deactivation that leaves a listener or
 * a panel behind is one too. The mock counts what is alive: created and not
 * disposed, registered and not removed.
 */

async function run(id: string, ...args: unknown[]): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler(...args);
}

function openWorkspace(): void {
	_setWorkspaceFiles({ '/w/a.ts': "import x from './lib/x';\n" });
	workspace.workspaceFolders = [{ uri: Uri.file('/w'), name: 'w', index: 0 }];
}

beforeEach(() => {
	_resetMockState();
	_setConfig('paths-le.telemetryEnabled', true);
	_setLmApi(true);
});

describe('dispose is complete and safe to repeat', () => {
	it('status bar', () => {
		const statusBar = createStatusBar(_createExtensionContext() as never);
		statusBar.dispose();
		expect(_statusBarItems()[0]?.disposed).toBe(true);
		expect(() => statusBar.dispose()).not.toThrow();
	});

	it('telemetry channel', () => {
		const telemetry = createTelemetry();
		telemetry.event('x');
		telemetry.dispose();
		expect(_outputChannels()[0]?.disposed).toBe(true);
		expect(() => telemetry.dispose()).not.toThrow();
	});

	it('help panel, whether or not it was ever opened', () => {
		const never = createHelpWebView(_createExtensionContext() as never, {
			event: () => {},
			dispose: () => {},
		});
		expect(() => never.dispose()).not.toThrow();

		const opened = createHelpWebView(_createExtensionContext() as never, {
			event: () => {},
			dispose: () => {},
		});
		opened.show();
		opened.dispose();
		expect(_webviewPanels()[0]?.disposed).toBe(true);
		expect(() => opened.dispose()).not.toThrow();
	});
});

describe('deactivation leaves nothing behind', () => {
	it('after every command has run once', async () => {
		openWorkspace();
		const context = _createExtensionContext();
		activate(context as never);
		_setActiveEditor(
			_createDocument({
				content: "import x from './y';\n/a\n/a",
				languageId: 'typescript',
			}),
		);
		_respondToQuickPick((items) => items[0]);
		await run('paths-le.extractPaths');
		await run('paths-le.extractWorkspace');
		await run('paths-le.extractFolder', Uri.file('/w'));
		await run('paths-le.postProcess.dedupe');
		await run('paths-le.postProcess.sort');
		await run('paths-le.openSettings');
		await run('paths-le.help');
		expect(_live()).toMatchObject({
			statusBarItems: 1,
			outputChannels: 1,
			webviewPanels: 1,
			configListeners: 1,
			commands: 7,
			mcpProviders: 1,
		});

		for (const disposable of context.subscriptions) disposable.dispose();
		expect(_live()).toEqual({
			statusBarItems: 0,
			outputChannels: 0,
			webviewPanels: 0,
			configListeners: 0,
			commands: 0,
			mcpProviders: 0,
		});
	});
});

describe('repeated runs do not grow', () => {
	it('fifty extractions, fifty help commands', async () => {
		activate(_createExtensionContext() as never);
		_setActiveEditor(
			_createDocument({
				content: "import x from './y';",
				languageId: 'typescript',
			}),
		);
		await run('paths-le.extractPaths');
		await run('paths-le.help');
		const afterOne = _live();
		for (let i = 0; i < 49; i++) {
			await run('paths-le.extractPaths');
			await run('paths-le.help');
		}
		expect(_live()).toEqual(afterOne);
		expect(_webviewPanels()).toHaveLength(1);
	});
});
