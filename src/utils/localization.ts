import * as nls from 'vscode-nls';

export interface Localizer {
	readonly localize: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeError: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeWarning: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeInfo: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeProgress: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeStatus: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeRecovery: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizePerformance: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeSafety: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
	readonly localizeConfirmation: (
		key: string,
		...args: (string | number | boolean | null | undefined)[]
	) => string;
}

export function createLocalizer(): Localizer {
	const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

	return Object.freeze({
		localize(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeError(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeWarning(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeInfo(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeProgress(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeStatus(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeRecovery(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizePerformance(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeSafety(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},

		localizeConfirmation(
			key: string,
			...args: (string | number | boolean | null | undefined)[]
		): string {
			return localize(key, key, ...args);
		},
	});
}

export const messages = Object.freeze({
	// Error messages
	errorParsing: 'runtime.error.parsing',
	errorValidation: 'runtime.error.validation',
	errorFileSystem: 'runtime.error.file-system',
	errorConfiguration: 'runtime.error.configuration',
	errorPerformance: 'runtime.error.performance',
	errorUnknown: 'runtime.error.unknown',

	// Warning messages
	warningLargeFile: 'runtime.warning.large-file',
	warningMemoryUsage: 'runtime.warning.memory-usage',
	warningPerformance: 'runtime.warning.performance',

	// Info messages
	infoExtractionComplete: 'runtime.info.extraction-complete',
	infoAnalysisComplete: 'runtime.info.analysis-complete',
	infoValidationComplete: 'runtime.info.validation-complete',

	// Progress messages
	progressExtracting: 'runtime.progress.extracting',
	progressAnalyzing: 'runtime.progress.analyzing',
	progressValidating: 'runtime.progress.validating',

	// Status messages
	statusExtracting: 'runtime.status.extracting',
	statusAnalyzing: 'runtime.status.analyzing',
	statusValidating: 'runtime.status.validating',

	// Recovery messages
	recoveryRetry: 'runtime.recovery.retry',
	recoveryFallback: 'runtime.recovery.fallback',
	recoverySkip: 'runtime.recovery.skip',
	recoveryAbort: 'runtime.recovery.abort',

	// Performance messages
	performanceDuration: 'runtime.performance.duration',
	performanceMemory: 'runtime.performance.memory',
	performanceThroughput: 'runtime.performance.throughput',
	performanceCpu: 'runtime.performance.cpu',

	// Safety messages
	safetyFileSizeWarning: 'runtime.safety.file-size-warning',
	safetyOutputSizeWarning: 'runtime.safety.output-size-warning',
	safetyManyDocumentsWarning: 'runtime.safety.many-documents-warning',

	// Confirmation messages
	confirmationContinue: 'runtime.confirmation.continue',
	confirmationCancel: 'runtime.confirmation.cancel',
	confirmationYes: 'runtime.confirmation.yes',
	confirmationNo: 'runtime.confirmation.no',
});

export function formatMessage(template: string, ...args: unknown[]): string {
	if (args.length === 0) {
		return template;
	}

	return template.replace(/\{(\d+)\}/g, (match, index) => {
		const argIndex = parseInt(index, 10);
		const arg = args[argIndex];
		return arg !== undefined ? String(arg) : match;
	});
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(milliseconds: number): string {
	if (milliseconds < 1000) {
		return `${milliseconds}ms`;
	}

	const seconds = milliseconds / 1000;
	if (seconds < 60) {
		return `${seconds.toFixed(2)}s`;
	}

	const minutes = seconds / 60;
	if (minutes < 60) {
		return `${minutes.toFixed(2)}m`;
	}

	const hours = minutes / 60;
	return `${hours.toFixed(2)}h`;
}

export function formatThroughput(throughput: number): string {
	if (throughput < 1000) {
		return `${throughput.toFixed(0)} paths/s`;
	}

	const k = throughput / 1000;
	if (k < 1000) {
		return `${k.toFixed(1)}K paths/s`;
	}

	const m = k / 1000;
	return `${m.toFixed(1)}M paths/s`;
}

export function formatCount(count: number): string {
	return count.toLocaleString();
}

export function formatPercentage(value: number): string {
	return `${(value * 100).toFixed(2)}%`;
}

export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diffSeconds = Math.floor((now - timestamp) / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffDays > 0) {
		return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
	}
	if (diffHours > 0) {
		return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
	}
	if (diffMinutes > 0) {
		return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
	}
	if (diffSeconds > 0) {
		return `${diffSeconds} second${diffSeconds === 1 ? '' : 's'} ago`;
	}
	return 'just now';
}

export function formatList(
	items: string[],
	conjunction: string = 'and',
): string {
	if (items.length === 0) return '';
	if (items.length === 1) return items[0] || '';
	if (items.length === 2)
		return `${items[0] || ''} ${conjunction} ${items[1] || ''}`;

	const lastItem = items[items.length - 1] || '';
	const otherItems = items.slice(0, -1);
	return `${otherItems.join(', ')}, ${conjunction} ${lastItem}`;
}

export function formatBoolean(value: boolean): string {
	return value ? 'Yes' : 'No';
}

export function formatArray<T>(
	items: T[],
	formatter: (item: T) => string = String,
): string {
	if (items.length === 0) return 'None';
	if (items.length === 1) return formatter(items[0]!);
	if (items.length <= 3) return items.map(formatter).join(', ');

	return `${formatter(items[0]!)}, ${formatter(items[1]!)}, ... and ${items.length - 2} more`;
}

export function formatObject(
	obj: Record<string, unknown>,
	maxDepth: number = 2,
): string {
	if (maxDepth <= 0) return '[Object]';

	const entries = Object.entries(obj);
	if (entries.length === 0) return '{}';

	const formatted = entries
		.slice(0, 5) // Limit to first 5 entries
		.map(([key, value]) => {
			if (typeof value === 'object' && value !== null) {
				return `${key}: ${formatObject(value as Record<string, unknown>, maxDepth - 1)}`;
			}
			return `${key}: ${String(value)}`;
		})
		.join(', ');

	if (entries.length > 5) {
		return `{${formatted}, ... and ${entries.length - 5} more}`;
	}

	return `{${formatted}}`;
}

export function formatPath(path: string): string {
	// Format path for display, handling different path types
	if (path.startsWith('http://') || path.startsWith('https://')) {
		return `URL: ${path}`;
	}
	if (path.startsWith('file://')) {
		return `File URL: ${path}`;
	}
	if (path.includes('$')) {
		return `Environment Variable: ${path}`;
	}
	if (path.startsWith('/') || path.startsWith('\\')) {
		return `Absolute Path: ${path}`;
	}
	if (path.startsWith('./') || path.startsWith('../')) {
		return `Relative Path: ${path}`;
	}
	return `Path: ${path}`;
}

export function formatPathType(type: string): string {
	switch (type) {
		case 'file':
			return 'File';
		case 'directory':
			return 'Directory';
		case 'relative':
			return 'Relative Path';
		case 'absolute':
			return 'Absolute Path';
		case 'url':
			return 'URL';
		case 'unknown':
			return 'Unknown Type';
		default:
			return type;
	}
}

export function formatValidationStatus(status: string): string {
	switch (status) {
		case 'valid':
			return 'Valid';
		case 'invalid':
			return 'Invalid';
		case 'broken':
			return 'Broken';
		case 'inaccessible':
			return 'Inaccessible';
		default:
			return status;
	}
}

export function formatFileType(type: string): string {
	switch (type) {
		case 'json':
			return 'JSON';
		case 'yaml':
		case 'yml':
			return 'YAML';
		case 'javascript':
			return 'JavaScript';
		case 'typescript':
			return 'TypeScript';
		case 'log':
			return 'Log File';
		case 'ini':
			return 'INI File';
		case 'unknown':
			return 'Unknown';
		default:
			return type;
	}
}

export function formatOutputFormat(format: string): string {
	switch (format) {
		case 'text':
			return 'Plain Text';
		case 'json':
			return 'JSON';
		case 'csv':
			return 'CSV';
		default:
			return format;
	}
}

export function formatPermissions(permissions: string): string {
	if (!permissions) return 'No permissions';

	// Format Unix-style permissions (e.g., rwxr-xr-x)
	if (permissions.length === 9) {
		return `Permissions: ${permissions}`;
	}

	// Format Windows-style permissions
	if (
		permissions.includes('Full Control') ||
		permissions.includes('Read') ||
		permissions.includes('Write')
	) {
		return `Permissions: ${permissions}`;
	}

	return `Permissions: ${permissions}`;
}

export function formatPathDepth(path: string): string {
	const depth = path.split(/[/\\]/).length - 1;
	return `Depth: ${depth}`;
}

export function formatPathExtension(path: string): string {
	const extension = path.split('.').pop();
	if (!extension) return 'No extension';
	return `Extension: .${extension}`;
}

export function formatPathPattern(pattern: string): string {
	return `Pattern: ${pattern}`;
}

export function formatPathExamples(examples: string[]): string {
	if (examples.length === 0) return 'No examples';
	if (examples.length === 1) return `Example: ${examples[0]}`;
	if (examples.length <= 3) return `Examples: ${examples.join(', ')}`;

	return `Examples: ${examples.slice(0, 2).join(', ')}, ... and ${examples.length - 2} more`;
}
