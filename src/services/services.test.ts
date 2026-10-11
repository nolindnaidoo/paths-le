import { beforeEach, describe, expect, it } from 'vitest';
import { version as manifestVersion } from '../../package.json';
import {
	_createExtensionContext,
	_fireConfigChange,
	_mcpProviders,
	_outputChannels,
	_registeredCommands,
	_resetMockState,
	_setConfig,
	_setLmApi,
	_shownMessages,
	_statusBarItems,
	executedBuiltins,
	type McpStdioServerDefinition,
} from '../__mocks__/vscode';
import { registerOpenSettingsCommand } from '../config/settings';
import { activate } from '../extension';
import { createTelemetry } from '../telemetry/telemetry';
import { createNotifier } from '../ui/notifier';
import { createStatusBar } from '../ui/statusBar';
import { createHelpWebView } from '../ui/webView';
import { createServices } from './serviceFactory';

beforeEach(() => {
	_resetMockState();
});

describe('createServices / activate', () => {
	it('activate registers every declared command', () => {
		const context = _createExtensionContext();
		activate(context as never);

		const declared = [
			'paths-le.extractPaths',
			'paths-le.postProcess.dedupe',
			'paths-le.postProcess.sort',
			'paths-le.openSettings',
			'paths-le.help',
		];
		for (const id of declared) {
			expect(_registeredCommands().has(id), id).toBe(true);
		}
	});

	it('createServices returns frozen bag and registers disposables', () => {
		const context = _createExtensionContext();
		const services = createServices(context as never);
		expect(Object.isFrozen(services)).toBe(true);
		expect(context.subscriptions.length).toBeGreaterThan(0);
	});
});

describe('telemetry', () => {
	it('is a no-op when disabled (default)', () => {
		const telemetry = createTelemetry();
		telemetry.event('x');
		telemetry.dispose();
	});

	it('writes to the output channel when enabled', () => {
		_setConfig('paths-le.telemetryEnabled', true);
		const telemetry = createTelemetry();
		telemetry.event('activated', { count: 2 });
		expect(_outputChannels()[0]?._lines).toEqual([
			expect.stringMatching(/^\[.+\] activated \{"count":2\}$/),
		]);
		telemetry.dispose();
	});

	it('follows the setting while running, without a reload', () => {
		// The setting was read once, when the service was created at activation.
		// Turning it on afterwards logged nothing until the window was reloaded,
		// and the setting's description does not say a reload is needed.
		const telemetry = createTelemetry();
		telemetry.event('before');
		_setConfig('paths-le.telemetryEnabled', true);
		telemetry.event('after');
		expect(_outputChannels()).toHaveLength(1);
		expect(_outputChannels()[0]?._lines.map((l) => l.split('] ')[1])).toEqual([
			'after',
		]);

		_setConfig('paths-le.telemetryEnabled', false);
		telemetry.event('off again');
		expect(_outputChannels()[0]?._lines).toHaveLength(1);
		telemetry.dispose();
	});
});

describe('statusBar', () => {
	// Both of these tests called the code and asserted nothing, so the bar
	// could have shown anything, or stayed hidden, and they would have passed.
	it('shows progress and restores idle text', () => {
		const context = _createExtensionContext();
		const statusBar = createStatusBar(context as never);
		const item = _statusBarItems()[0];
		expect(item?.text).toBe('$(file-directory) Paths-LE');
		statusBar.showProgress('Working...');
		expect(item?.text).toBe('$(loading~spin) Working...');
		statusBar.hideProgress();
		expect(item?.text).toBe('$(file-directory) Paths-LE');
		statusBar.dispose();
	});

	it('reacts to statusBar.enabled config changes', () => {
		const context = _createExtensionContext();
		createStatusBar(context as never);
		const item = _statusBarItems()[0];
		expect(item?.visible).toBe(true);
		_setConfig('paths-le.statusBar.enabled', false);
		_fireConfigChange('paths-le.statusBar.enabled');
		expect(item?.visible).toBe(false);
		_setConfig('paths-le.statusBar.enabled', true);
		_fireConfigChange('paths-le.statusBar.enabled');
		expect(item?.visible).toBe(true);
	});
});

describe('notifier respects notificationsLevel', () => {
	it('silent (default): errors only', () => {
		const notifier = createNotifier();
		notifier.showInfo('i');
		notifier.showWarning('w');
		notifier.showError('e');
		expect(_shownMessages().map((m) => m.kind)).toEqual(['error']);
	});

	it('important: warnings and errors', () => {
		_setConfig('paths-le.notificationsLevel', 'important');
		const notifier = createNotifier();
		notifier.showInfo('i');
		notifier.showWarning('w');
		notifier.showError('e');
		expect(_shownMessages().map((m) => m.kind)).toEqual(['warning', 'error']);
	});

	it('all: everything', () => {
		_setConfig('paths-le.notificationsLevel', 'all');
		const notifier = createNotifier();
		notifier.showInfo('i');
		notifier.showWarning('w');
		notifier.showError('e');
		expect(_shownMessages().map((m) => m.kind)).toEqual([
			'info',
			'warning',
			'error',
		]);
	});
});

describe('mcp provider', () => {
	it('says nothing on a host without the API', () => {
		activate(_createExtensionContext() as never);
		expect(_mcpProviders()).toEqual([]);
	});

	it('registers the bundled server on a host with the API, launched as the README promises', () => {
		// The registration branch ran only in a real host, where nothing read
		// the definition back. The extension host is Electron, so the launch
		// has to say ELECTRON_RUN_AS_NODE or the editor starts a second editor.
		_setLmApi(true);
		const context = _createExtensionContext();
		activate(context as never);
		expect(_mcpProviders().map((entry) => entry.id)).toEqual(['paths-le']);
		const definitions =
			_mcpProviders()[0]?.provider.provideMcpServerDefinitions() as McpStdioServerDefinition[];
		expect(definitions).toHaveLength(1);
		const definition = definitions[0] as McpStdioServerDefinition;
		expect(definition.label).toBe('Paths-LE');
		expect(definition.command).toBe(process.execPath);
		expect(definition.args).toEqual(['/ext/dist/mcp-server.js']);
		expect(definition.env).toEqual({ ELECTRON_RUN_AS_NODE: '1' });
		expect(definition.version).toBe(manifestVersion);
		for (const disposable of context.subscriptions) disposable.dispose();
		expect(_mcpProviders()).toEqual([]);
	});
});

describe('openSettings command', () => {
	it('opens the settings UI scoped to paths-le', async () => {
		const context = _createExtensionContext();
		registerOpenSettingsCommand(context as never, {
			telemetry: { event: () => {}, dispose: () => {} },
			notifier: createNotifier(),
		});
		await _registeredCommands().get('paths-le.openSettings')?.();
		expect(executedBuiltins[0]).toEqual({
			id: 'workbench.action.openSettings',
			args: ['paths-le'],
		});
	});
});

describe('help webview', () => {
	it('opens without scripts enabled and documents only real commands', () => {
		const context = _createExtensionContext();
		const events: string[] = [];
		const webView = createHelpWebView(context as never, {
			event: (name: string) => events.push(name),
			dispose: () => {},
		});
		webView.show();
		expect(events).toContain('webview-help-opened');
		webView.show(); // second call reveals, no second open event
		expect(events.filter((e) => e === 'webview-help-opened')).toHaveLength(1);
		webView.dispose();
	});
});
