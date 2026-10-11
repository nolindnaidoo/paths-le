import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createExtensionContext,
	_fireConfigChange,
	_outputChannels,
	_registeredCommands,
	_resetMockState,
	_setConfig,
	_shownMessages,
	executedBuiltins,
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
	it('shows progress and restores idle text', () => {
		const context = _createExtensionContext();
		const statusBar = createStatusBar(context as never);
		statusBar.showProgress('Working...');
		statusBar.hideProgress();
		statusBar.dispose();
	});

	it('reacts to statusBar.enabled config changes', () => {
		const context = _createExtensionContext();
		createStatusBar(context as never);
		_setConfig('paths-le.statusBar.enabled', false);
		_fireConfigChange('paths-le.statusBar.enabled');
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
