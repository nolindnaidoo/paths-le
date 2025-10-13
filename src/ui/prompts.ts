import * as vscode from 'vscode';

/**
 * User input prompts and dialogs
 */

export interface PromptOptions {
	readonly title?: string;
	readonly placeholder?: string;
	readonly value?: string;
	readonly validateInput?: (value: string) => string | undefined;
}

export interface QuickPickOptions {
	readonly title?: string;
	readonly placeholder?: string;
	readonly canPickMany?: boolean;
	readonly ignoreFocusOut?: boolean;
}

/**
 * Show an input box for user input
 */
export async function showInputBox(
	message: string,
	options: PromptOptions = {},
): Promise<string | undefined> {
	const inputBoxOptions: vscode.InputBoxOptions = {
		prompt: message,
		ignoreFocusOut: true,
	};

	if (options.title !== undefined) inputBoxOptions.title = options.title;
	if (options.placeholder !== undefined)
		inputBoxOptions.placeHolder = options.placeholder;
	if (options.value !== undefined) inputBoxOptions.value = options.value;
	if (options.validateInput !== undefined)
		inputBoxOptions.validateInput = options.validateInput;

	return vscode.window.showInputBox(inputBoxOptions);
}

/**
 * Show a quick pick menu
 */
export async function showQuickPick<T extends vscode.QuickPickItem>(
	items: readonly T[],
	options: QuickPickOptions = {},
): Promise<T | readonly T[] | undefined> {
	const quickPickOptions: vscode.QuickPickOptions = {};

	if (options.title !== undefined) quickPickOptions.title = options.title;
	if (options.placeholder !== undefined)
		quickPickOptions.placeHolder = options.placeholder;
	if (options.canPickMany !== undefined)
		quickPickOptions.canPickMany = options.canPickMany;
	if (options.ignoreFocusOut !== undefined)
		quickPickOptions.ignoreFocusOut = options.ignoreFocusOut;

	return vscode.window.showQuickPick(items, quickPickOptions);
}

/**
 * Show a confirmation dialog
 */
export async function showConfirmation(
	message: string,
	detail?: string,
	modal: boolean = false,
): Promise<boolean> {
	const messageOptions: vscode.MessageOptions = { modal };
	if (detail !== undefined) messageOptions.detail = detail;

	const result = await vscode.window.showWarningMessage(
		message,
		messageOptions,
		'Yes',
		'No',
	);
	return result === 'Yes';
}

/**
 * Show an information message
 */
export function showInfo(
	message: string,
	...items: string[]
): Promise<string | undefined> {
	return Promise.resolve(
		vscode.window.showInformationMessage(message, ...items),
	);
}

/**
 * Show a warning message
 */
export function showWarning(
	message: string,
	...items: string[]
): Promise<string | undefined> {
	return Promise.resolve(vscode.window.showWarningMessage(message, ...items));
}

/**
 * Show an error message
 */
export function showError(
	message: string,
	...items: string[]
): Promise<string | undefined> {
	return Promise.resolve(vscode.window.showErrorMessage(message, ...items));
}

/**
 * Show a progress dialog
 */
export function showProgress<T>(
	title: string,
	task: (
		progress: vscode.Progress<{ message?: string; increment?: number }>,
		token: vscode.CancellationToken,
	) => Promise<T>,
): Promise<T> {
	return Promise.resolve(
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title,
				cancellable: true,
			},
			task,
		),
	);
}

/**
 * Show a file save dialog
 */
export async function showSaveDialog(
	title: string = 'Save File',
	defaultUri?: vscode.Uri,
	filters?: { [name: string]: string[] },
): Promise<vscode.Uri | undefined> {
	const options: vscode.SaveDialogOptions = { title };
	if (defaultUri !== undefined) options.defaultUri = defaultUri;
	if (filters !== undefined) options.filters = filters;

	return vscode.window.showSaveDialog(options);
}

/**
 * Show a file open dialog
 */
export async function showOpenDialog(
	title: string = 'Open File',
	canSelectMany: boolean = false,
	filters?: { [name: string]: string[] },
): Promise<readonly vscode.Uri[] | undefined> {
	const options: vscode.OpenDialogOptions = { title, canSelectMany };
	if (filters !== undefined) options.filters = filters;

	return vscode.window.showOpenDialog(options);
}

/**
 * Show a folder picker dialog
 */
export async function showFolderPicker(
	title: string = 'Select Folder',
): Promise<vscode.Uri | undefined> {
	const result = await vscode.window.showOpenDialog({
		title,
		canSelectMany: false,
		canSelectFolders: true,
		canSelectFiles: false,
	});
	return result?.[0];
}

/**
 * Create a quick pick item
 */
export function createQuickPickItem(
	label: string,
	description?: string,
	detail?: string,
): vscode.QuickPickItem {
	const item: vscode.QuickPickItem = { label };
	if (description !== undefined) item.description = description;
	if (detail !== undefined) item.detail = detail;

	return item;
}

/**
 * Validate file path input
 */
export function validateFilePath(value: string): string | undefined {
	if (!value || value.trim().length === 0) {
		return 'Path cannot be empty';
	}

	// Check for invalid characters
	const invalidChars = /[<>:"|?*]/;
	if (invalidChars.test(value)) {
		return 'Path contains invalid characters';
	}

	// Check for reserved names (Windows)
	const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
	if (reservedNames.test(value)) {
		return 'Path uses a reserved name';
	}

	return undefined;
}

/**
 * Validate numeric input
 */
export function validateNumber(
	value: string,
	min?: number,
	max?: number,
): string | undefined {
	const num = Number(value);
	if (Number.isNaN(num)) {
		return 'Please enter a valid number';
	}
	if (min !== undefined && num < min) {
		return `Value must be at least ${min}`;
	}
	if (max !== undefined && num > max) {
		return `Value must be at most ${max}`;
	}
	return undefined;
}

/**
 * Validate URL input
 */
export function validateUrl(value: string): string | undefined {
	if (!value || value.trim().length === 0) {
		return 'URL cannot be empty';
	}

	try {
		new URL(value);
		return undefined;
	} catch {
		return 'Please enter a valid URL';
	}
}
