import { beforeEach, describe, expect, it } from 'vitest';
import {
	_createExtensionContext,
	_resetMockState,
	_webviewPanels,
} from '../__mocks__/vscode';
import { SUPPORTED_FORMATS } from '../mcp/fileType';
import { createHelpWebView } from './webView';

/**
 * The help page is prose about the code, and prose has no compiler. It listed
 * seven formats after the engine had grown to read every file, and told a
 * user with no results to check whether the file type was supported, which
 * had stopped being a reason.
 */

beforeEach(() => _resetMockState());

function helpHtml(): string {
	createHelpWebView(_createExtensionContext() as never, {
		event: () => {},
		dispose: () => {},
	}).show();
	return _webviewPanels()[0]?.webview.html ?? '';
}

const NAMES: Record<string, RegExp> = {
	csv: /\bCSV\b/,
	tsv: /\bTSV\b/,
	toml: /\bTOML\b/,
	dotenv: /\.env\b/,
	javascript: /\bJavaScript\b/,
	typescript: /\bTypeScript\b/,
	json: /\bJSON\b/,
	html: /\bHTML\b/,
	css: /\bCSS\b/,
	yaml: /\bYAML\b/,
	markdown: /\bMarkdown\b/,
};

describe('help webview', () => {
	it('names every format the engine advertises', () => {
		const html = helpHtml();
		for (const format of SUPPORTED_FORMATS) {
			const name = NAMES[format];
			expect(name, `no name pattern for ${format}`).toBeDefined();
			expect(html, format).toMatch(name as RegExp);
		}
	});

	it('says that every other file is read by a text scan', () => {
		expect(helpHtml()).toMatch(/text scan/i);
	});

	it('no longer tells a user to check whether the file type is supported', () => {
		expect(helpHtml()).not.toMatch(/file type is supported/i);
	});
});
