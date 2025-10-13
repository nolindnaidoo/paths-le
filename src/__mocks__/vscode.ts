// Mock VS Code API for testing
export const window = {
	activeTextEditor: undefined,
	showInformationMessage: () => Promise.resolve(''),
	showWarningMessage: () => Promise.resolve(''),
	showErrorMessage: () => Promise.resolve(''),
	createStatusBarItem: () => ({
		text: '',
		tooltip: '',
		command: '',
		show: () => {},
		hide: () => {},
		dispose: () => {},
	}),
	createOutputChannel: () => ({
		appendLine: () => {},
		dispose: () => {},
	}),
	withProgress: () => Promise.resolve(),
};

export const workspace = {
	openTextDocument: () => Promise.resolve({}),
	applyEdit: () => Promise.resolve(true),
	getConfiguration: () => ({
		get: () => '',
	}),
};

export const commands = {
	registerCommand: () => ({ dispose: () => {} }),
	executeCommand: () => Promise.resolve(),
};

export const env = {
	clipboard: {
		writeText: () => Promise.resolve(),
	},
};

export const ViewColumn = {
	Beside: 2,
};

export const StatusBarAlignment = {
	Left: 1,
	Right: 2,
};

export const Range = () => {};
export const WorkspaceEdit = () => {};
