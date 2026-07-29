#!/usr/bin/env node
/**
 * Bundle gate: the packaged VSIX ships dist/extension.js with no node_modules,
 * so every require() in the bundle must resolve to 'vscode' or a Node builtin.
 * A bare module specifier here means esbuild left a dependency external and
 * the extension would fail to activate after install (v1.x shipped broken
 * exactly this way).
 */
const fs = require('node:fs');
const { isBuiltin } = require('node:module');

const bundlePath = 'dist/extension.js';
const source = fs.readFileSync(bundlePath, 'utf8');

const offenders = new Set();
for (const match of source.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) {
	const specifier = match[1];
	if (specifier === 'vscode') continue;
	if (isBuiltin(specifier)) continue;
	if (specifier.startsWith('./') || specifier.startsWith('../')) continue;
	offenders.add(specifier);
}

if (offenders.size > 0) {
	console.error(
		`FAIL: ${bundlePath} requires unbundled modules: ${[...offenders].join(', ')}`,
	);
	console.error(
		'These are not shipped in the VSIX — the extension would not activate.',
	);
	process.exit(1);
}

console.log(`OK: ${bundlePath} has no external requires beyond vscode/builtins.`);
