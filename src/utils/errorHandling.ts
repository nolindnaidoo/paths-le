/**
 * Error handling utilities for Paths-LE
 * Provides error categorization, recovery, and user feedback
 */

export type ErrorCategory =
	| 'parse'
	| 'validation'
	| 'safety'
	| 'operational'
	| 'file-system'
	| 'configuration'
	| 'parsing';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export type RecoveryAction = 'skip' | 'retry' | 'abort' | 'fallback';

export interface EnhancedError {
	readonly category: ErrorCategory;
	readonly originalError: Error;
	readonly message: string;
	readonly userFriendlyMessage: string;
	readonly userMessage: string;
	readonly suggestion: string;
	readonly recoverable: boolean;
	readonly severity: 'low' | 'medium' | 'high';
	readonly timestamp: Date;
}

export interface ErrorRecoveryOptions {
	readonly retryable: boolean;
	readonly maxRetries: number;
	readonly retryDelay: number;
	readonly fallbackAction?: () => Promise<void>;
	readonly userAction?: string;
}

/**
 * Create an enhanced error with categorization and user-friendly messaging
 */
export function createEnhancedError(
	error: Error,
	category: ErrorCategory,
	context?: Record<string, unknown>,
	options?: {
		recoverable?: boolean;
		severity?: 'low' | 'medium' | 'high';
		suggestion?: string;
	},
): EnhancedError {
	const userFriendlyMessage = buildUserFriendlyMessage(
		error,
		category,
		context?.filepath as string | undefined,
	);
	const suggestion = options?.suggestion ?? buildErrorSuggestion(category);
	const recoverable =
		options?.recoverable ?? isErrorRecoverable(error, category);
	const severity = options?.severity ?? 'medium';

	return Object.freeze({
		category,
		originalError: error,
		message: error.message,
		userFriendlyMessage,
		userMessage: userFriendlyMessage,
		suggestion,
		recoverable,
		severity,
		timestamp: new Date(),
	});
}

/**
 * Determine if an error is recoverable based on category
 */
function isErrorRecoverable(error: Error, category: ErrorCategory): boolean {
	if (category === 'parse' || category === 'parsing') {
		return true;
	}

	if (category === 'file-system') {
		return (
			error.message.includes('permission') || error.message.includes('network')
		);
	}

	if (category === 'configuration' || category === 'validation') {
		return true;
	}

	if (category === 'safety') {
		return false;
	}

	if (category === 'operational') {
		return !error.message.includes('fatal');
	}

	return false;
}

/**
 * Build user-friendly error message
 */
function buildUserFriendlyMessage(
	error: Error,
	category: ErrorCategory,
	context?: string,
): string {
	if (category === 'parse' || category === 'parsing') {
		return `Failed to parse path values: ${context ?? 'unknown file'}`;
	}

	if (category === 'file-system') {
		return `File system error: ${error.message}`;
	}

	if (category === 'configuration') {
		return `Configuration error: ${error.message}`;
	}

	if (category === 'validation') {
		return `Path validation failed: ${error.message}`;
	}

	if (category === 'safety') {
		return `Safety threshold exceeded: ${error.message}`;
	}

	if (category === 'operational') {
		return `Path extraction failed: ${error.message}`;
	}

	return `Unknown error: ${error.message}`;
}

/**
 * Build error recovery suggestion
 */
function buildErrorSuggestion(category: ErrorCategory): string {
	switch (category) {
		case 'parse':
		case 'parsing':
			return 'Check the path format and ensure values are valid';
		case 'file-system':
			return 'Check file permissions and ensure the file exists';
		case 'configuration':
			return 'Reset to default settings or check configuration syntax';
		case 'validation':
			return 'Review path values and ensure they meet validation criteria';
		case 'safety':
			return 'Reduce file size or adjust safety thresholds';
		case 'operational':
			return 'Try again or check system resources';
		default:
			return 'Check the logs for more details and consider reporting this issue';
	}
}

/**
 * Get error recovery options
 */
export function buildErrorRecoveryOptions(
	error: EnhancedError,
): ErrorRecoveryOptions {
	switch (error.category) {
		case 'file-system':
			return Object.freeze({
				retryable: true,
				maxRetries: 3,
				retryDelay: 1000,
			});
		case 'operational':
			return Object.freeze({
				retryable: true,
				maxRetries: 2,
				retryDelay: 2000,
			});
		case 'configuration':
			return Object.freeze({
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
				fallbackAction: async () => {
					// Fallback to default configuration
				},
			});
		default:
			return Object.freeze({
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
			});
	}
}

/**
 * Sanitize error message for display
 */
export function sanitizeErrorMessage(message: string): string {
	return message
		.replace(/\/Users\/[^/]+\//g, '/Users/***/')
		.replace(/\/home\/[^/]+\//g, '/home/***/')
		.replace(/C:\\Users\\[^\\]+\\/g, 'C:\\Users\\***\\')
		.replace(/password[=:]\s*[^\s]+/gi, 'password=***')
		.replace(/token[=:]\s*[^\s]+/gi, 'token=***')
		.replace(/key[=:]\s*[^\s]+/gi, 'key=***');
}

/**
 * Handle error with appropriate user feedback
 */
export function handleError(error: EnhancedError): void {
	const sanitizedMessage = sanitizeErrorMessage(error.userFriendlyMessage);

	if (error.recoverable) {
		console.warn(`[Paths-LE] ${sanitizedMessage}`);
		return;
	}

	console.error(`[Paths-LE] ${sanitizedMessage}`);
}

/**
 * Error handler interface for centralized error management
 */
export interface ErrorHandler {
	readonly handle: (error: EnhancedError) => Promise<void>;
	readonly handleWithRecovery: (
		error: EnhancedError,
		options?: ErrorRecoveryOptions,
	) => Promise<boolean>;
	readonly logError: (error: EnhancedError) => void;
	readonly notifyUser: (error: EnhancedError) => void;
}

/**
 * Error logger interface for error logging
 */
export interface ErrorLogger {
	readonly log: (message: string, level: 'info' | 'warn' | 'error') => void;
	readonly logError: (error: EnhancedError) => void;
	readonly logWarning: (
		message: string,
		context?: Record<string, unknown>,
	) => void;
	readonly logInfo: (
		message: string,
		context?: Record<string, unknown>,
	) => void;
}

/**
 * Error notifier interface for user notifications
 */
export interface ErrorNotifier {
	readonly showError: (message: string, details?: string) => void;
	readonly showWarning: (message: string, details?: string) => void;
	readonly showInfo: (message: string, details?: string) => void;
	readonly showProgress: (message: string) => void;
}

/**
 * Create error handler with logger and notifier
 */
export function createErrorHandler(deps: {
	readonly logger: ErrorLogger;
	readonly notifier: ErrorNotifier;
	readonly config: {
		readonly showParseErrors: boolean;
		readonly notificationsLevel: 'all' | 'important' | 'silent';
		readonly maxRetries: number;
		readonly retryDelay: number;
	};
}): ErrorHandler {
	const shouldShowError = (error: EnhancedError): boolean => {
		if (error.severity === 'high') {
			return true;
		}

		if (
			error.severity === 'medium' &&
			deps.config.notificationsLevel !== 'silent'
		) {
			return true;
		}

		if (error.severity === 'low' && deps.config.notificationsLevel === 'all') {
			return true;
		}

		return false;
	};

	const handle = async (error: EnhancedError): Promise<void> => {
		deps.logger.logError(error);

		if (!shouldShowError(error)) {
			return;
		}

		if (error.severity === 'high') {
			deps.notifier.showError(error.userMessage, error.suggestion);
			return;
		}

		deps.notifier.showWarning(error.userMessage, error.suggestion);
	};

	const handleWithRecovery = async (
		error: EnhancedError,
		options?: ErrorRecoveryOptions,
	): Promise<boolean> => {
		const recoveryOptions = options ?? buildErrorRecoveryOptions(error);

		if (!recoveryOptions.retryable) {
			await handle(error);
			return false;
		}

		for (let attempt = 0; attempt < recoveryOptions.maxRetries; attempt++) {
			if (!recoveryOptions.fallbackAction) {
				await handle(error);
				continue;
			}

			try {
				await recoveryOptions.fallbackAction();
				return true;
			} catch {
				// Continue to next retry attempt
			}
		}

		await handle(error);
		return false;
	};

	const logError = (error: EnhancedError): void => {
		deps.logger.logError(error);
	};

	const notifyUser = (error: EnhancedError): void => {
		if (error.severity === 'high') {
			deps.notifier.showError(error.userMessage, error.suggestion);
			return;
		}

		if (error.severity === 'medium') {
			deps.notifier.showWarning(error.userMessage, error.suggestion);
			return;
		}

		deps.notifier.showInfo(error.userMessage, error.suggestion);
	};

	return Object.freeze({
		handle,
		handleWithRecovery,
		logError,
		notifyUser,
	});
}

/**
 * Create error logger with output channel
 */
export function createErrorLogger(outputChannel: {
	appendLine: (line: string) => void;
}): ErrorLogger {
	const log = (message: string, level: 'info' | 'warn' | 'error'): void => {
		const timestamp = new Date().toISOString();
		outputChannel.appendLine(
			`[${timestamp}] [${level.toUpperCase()}] ${message}`,
		);
	};

	const logError = (error: EnhancedError): void => {
		const timestamp = new Date().toISOString();
		outputChannel.appendLine(
			`[${timestamp}] [ERROR] ${error.category}: ${error.message}`,
		);
		if (error.originalError.stack) {
			outputChannel.appendLine(`Stack: ${error.originalError.stack}`);
		}
	};

	const logWarning = (
		message: string,
		context?: Record<string, unknown>,
	): void => {
		const timestamp = new Date().toISOString();
		const contextStr = context ? ` ${JSON.stringify(context)}` : '';
		outputChannel.appendLine(`[${timestamp}] [WARN] ${message}${contextStr}`);
	};

	const logInfo = (
		message: string,
		context?: Record<string, unknown>,
	): void => {
		const timestamp = new Date().toISOString();
		const contextStr = context ? ` ${JSON.stringify(context)}` : '';
		outputChannel.appendLine(`[${timestamp}] [INFO] ${message}${contextStr}`);
	};

	return Object.freeze({
		log,
		logError,
		logWarning,
		logInfo,
	});
}

/**
 * Create error notifier with VS Code notifications
 */
export function createErrorNotifier(): ErrorNotifier {
	const showError = (message: string, details?: string): void => {
		console.error(
			`[Paths-LE Error] ${message}${details ? `\nDetails: ${details}` : ''}`,
		);
	};

	const showWarning = (message: string, details?: string): void => {
		console.warn(
			`[Paths-LE Warning] ${message}${details ? `\nDetails: ${details}` : ''}`,
		);
	};

	const showInfo = (message: string, details?: string): void => {
		console.info(
			`[Paths-LE Info] ${message}${details ? `\nDetails: ${details}` : ''}`,
		);
	};

	const showProgress = (message: string): void => {
		console.info(`[Paths-LE Progress] ${message}`);
	};

	return Object.freeze({
		showError,
		showWarning,
		showInfo,
		showProgress,
	});
}

/**
 * Create a generic error with standard properties
 */
export function createError(props: {
	readonly category: ErrorCategory;
	readonly severity: ErrorSeverity;
	readonly message: string;
	readonly recoverable: boolean;
	readonly recoveryAction: RecoveryAction;
}): {
	readonly category: ErrorCategory;
	readonly severity: ErrorSeverity;
	readonly message: string;
	readonly recoverable: boolean;
	readonly recoveryAction: RecoveryAction;
	readonly timestamp: number;
} {
	return Object.freeze({
		...props,
		timestamp: Date.now(),
	});
}

/**
 * Create a parse error with position information
 */
export function createParseError(props: {
	readonly message: string;
	readonly filepath?: string;
	readonly position?: { readonly line: number; readonly column: number };
}): {
	readonly category: 'parsing';
	readonly severity: 'warning';
	readonly message: string;
	readonly filepath?: string;
	readonly position?: { readonly line: number; readonly column: number };
	readonly recoverable: boolean;
	readonly recoveryAction: 'skip';
	readonly timestamp: number;
} {
	return Object.freeze({
		category: 'parsing' as const,
		severity: 'warning' as const,
		recoverable: true,
		recoveryAction: 'skip' as const,
		timestamp: Date.now(),
		...props,
	});
}

/**
 * Categorize an error based on its message and type
 */
export function categorizeError(error: Error): ErrorCategory {
	const message = error.message.toLowerCase();

	if (message.includes('parse') || message.includes('syntax')) {
		return 'parsing';
	}

	if (message.includes('validation') || message.includes('invalid')) {
		return 'validation';
	}

	if (message.includes('permission') || message.includes('access')) {
		return 'file-system';
	}

	if (message.includes('config') || message.includes('setting')) {
		return 'configuration';
	}

	if (message.includes('safety') || message.includes('threshold')) {
		return 'safety';
	}

	return 'operational';
}

/**
 * Determine error severity based on error and category
 */
export function determineSeverity(
	error: Error,
	category: ErrorCategory,
): ErrorSeverity {
	const message = error.message.toLowerCase();

	if (message.includes('critical') || message.includes('fatal')) {
		return 'critical';
	}

	if (message.includes('error') || category === 'file-system') {
		return 'error';
	}

	if (message.includes('warning') || category === 'validation') {
		return 'warning';
	}

	return 'info';
}

/**
 * Determine recovery action based on category and severity
 */
export function determineRecoveryAction(
	category: ErrorCategory,
	severity: ErrorSeverity,
): RecoveryAction {
	if (category === 'file-system' && severity === 'error') {
		return 'retry';
	}

	if (category === 'parsing' || category === 'validation') {
		return 'skip';
	}

	if (severity === 'critical') {
		return 'abort';
	}

	return 'fallback';
}
