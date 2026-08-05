import * as assert from 'node:assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'nolindnaidoo.paths-le';

async function openEditor(
	content: string,
	language: string,
): Promise<vscode.TextEditor> {
	const document = await vscode.workspace.openTextDocument({
		content,
		language,
	});
	return vscode.window.showTextDocument(document);
}

describe('Paths-LE integration', function () {
	this.timeout(30_000);

	it('activates', async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		assert.ok(extension, `extension ${EXTENSION_ID} not found`);
		await extension.activate();
		assert.strictEqual(extension.isActive, true);
	});

	it('registers every declared command', async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		await extension?.activate();
		const commands = await vscode.commands.getCommands(true);
		for (const id of [
			'paths-le.extractPaths',
			'paths-le.postProcess.dedupe',
			'paths-le.postProcess.sort',
			'paths-le.openSettings',
			'paths-le.help',
		]) {
			assert.ok(commands.includes(id), `missing command: ${id}`);
		}
	});

	it('extracts paths from a JavaScript document into a results document', async () => {
		await openEditor(
			[
				"import { a } from './lib/alpha';",
				'import {',
				'\tbeta,',
				"} from '../shared/beta.js';",
				"const c = require('/opt/gamma.node');",
			].join('\n'),
			'javascript',
		);

		await vscode.commands.executeCommand('paths-le.extractPaths');

		// Results open in a new plaintext document (side-by-side default).
		const resultDoc = vscode.workspace.textDocuments.find(
			(doc) =>
				doc.languageId === 'plaintext' &&
				doc.getText().includes('./lib/alpha'),
		);
		assert.ok(resultDoc, 'no results document found');
		const lines = resultDoc.getText().split('\n');
		assert.deepStrictEqual(lines, [
			'./lib/alpha',
			'../shared/beta.js',
			'/opt/gamma.node',
		]);
	});

	it('offers its MCP server to agent mode', async () => {
		// The provider is registered against the id the manifest declares; a
		// mismatch leaves the tools invisible with nothing logged. Assert the
		// declaration and the API the floor was raised for, together — the
		// registration itself is only observable in a real host, which
		// scripts/e2e-vsix.js covers against the installed VSIX.
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		await extension?.activate();

		assert.strictEqual(
			typeof vscode.lm.registerMcpServerDefinitionProvider,
			'function',
			'this VS Code build predates the MCP provider API',
		);

		const providers = extension?.packageJSON.contributes
			.mcpServerDefinitionProviders as { id: string; label: string }[];
		assert.deepStrictEqual(
			providers.map((p) => p.id),
			['paths-le'],
		);
	});

	it('dedupe removes duplicate lines from the active document', async () => {
		const editor = await openEditor('/a\n/b\n/a\n/c\n/b', 'plaintext');

		await vscode.commands.executeCommand('paths-le.postProcess.dedupe');

		assert.strictEqual(editor.document.getText(), '/a\n/b\n/c');
	});
});
