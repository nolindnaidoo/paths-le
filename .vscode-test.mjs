import { defineConfig } from '@vscode/test-cli';

// No GPU process. Under xvfb on a CI runner there is no GPU to start, and
// the window has sat unresponsive from launch until the test run gave up
// on it: "CodeWindow: detected unresponsive", sixteen seconds in, before a
// single test had run. Software rendering has nothing to wait for.
const launchArgs = ['--disable-extensions', '--disable-gpu'];

const mocha = {
	ui: 'bdd',
	timeout: 30_000,
};

export default defineConfig([
	{
		label: 'integration',
		files: 'out-test/integration/**/*.test.js',
		version: 'stable',
		launchArgs,
		mocha,
	},
	{
		// The same host in German, so a test can read what each localization
		// mechanism actually loaded: a command title the host substituted, and
		// a report the extension wrote. Parity of the catalogue files says
		// nothing about either, and this is the only place both are shown.
		//
		// A display language needs its language pack: without one the host
		// reports `en` whatever `--locale` says, so the pack is installed into
		// the test profile, and `--disable-extensions` would switch it off
		// again, so this config does not pass it.
		label: 'german host',
		files: 'out-test/locale/**/*.test.js',
		version: 'stable',
		installExtensions: ['MS-CEINTL.vscode-language-pack-de'],
		launchArgs: ['--disable-gpu', '--locale=de'],
		mocha,
	},
]);
