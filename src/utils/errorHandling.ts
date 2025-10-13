import * as nls from 'vscode-nls';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

/**
 * Enhanced error handling utilities for Paths-LE
 * Provides sophisticated error categorization, recovery, and user feedback
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
	const _errorType = getErrorType(error, category);
	const userFriendlyMessage = getUserFriendlyMessage(
		error,
		category,
		context?.filepath as string,
	);
	const suggestion = options?.suggestion || getErrorSuggestion(error, category);
	const recoverable =
		options?.recoverable ?? isRecoverableError(error, category);
	const severity = options?.severity || 'medium';

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
 * Get error type for categorization
 */
function getErrorType(_error: Error, category: ErrorCategory): string {
	switch (category) {
		case 'parse':
			return 'path-parse-error';
		case 'validation':
			return 'path-validation-error';
		case 'safety':
			return 'path-safety-error';
		case 'file-system':
			return 'path-file-system-error';
		case 'configuration':
			return 'path-configuration-error';
		case 'operational':
			return 'path-operational-error';
		default:
			return 'unknown-error';
	}
}

/**
 * Determine if an error is recoverable
 */
function isRecoverableError(error: Error, category: ErrorCategory): boolean {
	switch (category) {
		case 'parse':
			// Parse errors are recoverable if they don't prevent path processing
			return true;
		case 'file-system':
			// File system errors might be recoverable (permissions, network issues)
			return (
				error.message.includes('permission') ||
				error.message.includes('network')
			);
		case 'configuration':
			// Configuration errors are recoverable (fallback to defaults)
			return true;
		case 'validation':
			// Validation errors are recoverable (skip invalid paths)
			return true;
		case 'safety':
			// Safety errors are not recoverable (user must take action)
			return false;
		case 'operational':
			return !error.message.includes('fatal');
		default:
			return false;
	}
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(
	error: Error,
	category: ErrorCategory,
	context?: string,
): string {
	switch (category) {
		case 'parse':
			return localize(
				'runtime.error.parse',
				'Failed to parse path values: {0}',
				context || 'unknown file',
			);
		case 'file-system':
			return localize(
				'runtime.error.file-system',
				'File system error: {0}',
				error.message,
			);
		case 'configuration':
			return localize(
				'runtime.error.configuration',
				'Configuration error: {0}',
				error.message,
			);
		case 'validation':
			return localize(
				'runtime.error.validation',
				'Path validation failed: {0}',
				error.message,
			);
		case 'safety':
			return localize(
				'runtime.error.safety',
				'Safety threshold exceeded: {0}',
				error.message,
			);
		case 'operational':
			return localize(
				'runtime.error.operational',
				'Path extraction failed: {0}',
				error.message,
			);
		default:
			return localize(
				'runtime.error.unknown',
				'Unknown error: {0}',
				error.message,
			);
	}
}

/**
 * Get error recovery suggestion
 */
function getErrorSuggestion(_error: Error, category: ErrorCategory): string {
	switch (category) {
		case 'parse':
			return localize(
				'runtime.error.parse.suggestion',
				'Check the path format and ensure values are valid',
			);
		case 'file-system':
			return localize(
				'runtime.error.file-system.suggestion',
				'Check file permissions and ensure the file exists',
			);
		case 'configuration':
			return localize(
				'runtime.error.configuration.suggestion',
				'Reset to default settings or check configuration syntax',
			);
		case 'validation':
			return localize(
				'runtime.error.validation.suggestion',
				'Review path values and ensure they meet validation criteria',
			);
		case 'safety':
			return localize(
				'runtime.error.safety.suggestion',
				'Reduce file size or adjust safety thresholds',
			);
		case 'operational':
			return localize(
				'runtime.error.operational.suggestion',
				'Try again or check system resources',
			);
		default:
			return localize(
				'runtime.error.unknown.suggestion',
				'Check the logs for more details and consider reporting this issue',
			);
	}
}

/**
 * Get error recovery options
 */
export function getErrorRecoveryOptions(
	error: EnhancedError,
): ErrorRecoveryOptions {
	switch (error.category) {
		case 'parse':
			return {
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
			};
		case 'file-system':
			return {
				retryable: true,
				maxRetries: 3,
				retryDelay: 1000,
			};
		case 'configuration':
			return {
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
				fallbackAction: async () => {
					// Fallback to default configuration
				},
			};
		case 'validation':
			return {
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
			};
		case 'safety':
			return {
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
			};
		case 'operational':
			return {
				retryable: true,
				maxRetries: 2,
				retryDelay: 2000,
			};
		default:
			return {
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
			};
	}
}

/**
 * Sanitize error message for display
 */
export function sanitizeErrorMessage(message: string): string {
	// Remove sensitive information
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
		// Show warning for recoverable errors
		console.warn(`[Paths-LE] ${sanitizedMessage}`);
	} else {
		// Show error for non-recoverable errors
		console.error(`[Paths-LE] ${sanitizedMessage}`);
	}
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
	return Object.freeze({
		async handle(error: EnhancedError): Promise<void> {
			deps.logger.logError(error);

			if (
				error.severity === 'high' ||
				(error.severity === 'medium' &&
					deps.config.notificationsLevel !== 'silent')
			) {
				deps.notifier.showError(error.userMessage, error.suggestion);
			} else if (
				error.severity === 'low' &&
				deps.config.notificationsLevel === 'all'
			) {
				deps.notifier.showWarning(error.userMessage, error.suggestion);
			}
		},

		async handleWithRecovery(
			error: EnhancedError,
			options?: ErrorRecoveryOptions,
		): Promise<boolean> {
			const recoveryOptions = options || getErrorRecoveryOptions(error);

			if (!recoveryOptions.retryable) {
				await this.handle(error);
				return false;
			}

			for (let attempt = 0; attempt < recoveryOptions.maxRetries; attempt++) {
				try {
					if (recoveryOptions.fallbackAction) {
						await recoveryOptions.fallbackAction();
						return true;
					}
				} catch (retryError) {
					deps.logger.logWarning(`Recovery attempt ${attempt + 1} failed`, {
						error: retryError,
					});

					if (attempt === recoveryOptions.maxRetries - 1) {
						await this.handle(error);
						return false;
					}

					await new Promise((resolve) =>
						setTimeout(resolve, recoveryOptions.retryDelay),
					);
				}
			}

			return false;
		},

		logError(error: EnhancedError): void {
			deps.logger.logError(error);
		},

		notifyUser(error: EnhancedError): void {
			if (error.severity === 'high') {
				deps.notifier.showError(error.userMessage, error.suggestion);
			} else if (error.severity === 'medium') {
				deps.notifier.showWarning(error.userMessage, error.suggestion);
			} else {
				deps.notifier.showInfo(error.userMessage, error.suggestion);
			}
		},
	});
}

/**
 * Create error logger with output channel
 */
export function createErrorLogger(outputChannel: {
	appendLine: (line: string) => void;
}): ErrorLogger {
	return Object.freeze({
		log(message: string, level: 'info' | 'warn' | 'error'): void {
			const timestamp = new Date().toISOString();
			outputChannel.appendLine(
				`[${timestamp}] [${level.toUpperCase()}] ${message}`,
			);
		},

		logError(error: EnhancedError): void {
			const timestamp = new Date().toISOString();
			outputChannel.appendLine(
				`[${timestamp}] [ERROR] ${error.category}: ${error.message}`,
			);
			if (error.originalError.stack) {
				outputChannel.appendLine(`Stack: ${error.originalError.stack}`);
			}
		},

		logWarning(message: string, context?: Record<string, unknown>): void {
			const timestamp = new Date().toISOString();
			const contextStr = context ? ` ${JSON.stringify(context)}` : '';
			outputChannel.appendLine(`[${timestamp}] [WARN] ${message}${contextStr}`);
		},

		logInfo(message: string, context?: Record<string, unknown>): void {
			const timestamp = new Date().toISOString();
			const contextStr = context ? ` ${JSON.stringify(context)}` : '';
			outputChannel.appendLine(`[${timestamp}] [INFO] ${message}${contextStr}`);
		},
	});
}

/**
 * Create error notifier with VS Code notifications
 */
export function createErrorNotifier(): ErrorNotifier {
	return Object.freeze({
		showError(message: string, details?: string): void {
			// Implementation would use vscode.window.showErrorMessage
			console.error(
				`[Paths-LE Error] ${message}${details ? `\nDetails: ${details}` : ''}`,
			);
		},

		showWarning(message: string, details?: string): void {
			// Implementation would use vscode.window.showWarningMessage
			console.warn(
				`[Paths-LE Warning] ${message}${details ? `\nDetails: ${details}` : ''}`,
			);
		},

		showInfo(message: string, details?: string): void {
			// Implementation would use vscode.window.showInformationMessage
			console.info(
				`[Paths-LE Info] ${message}${details ? `\nDetails: ${details}` : ''}`,
			);
		},

		showProgress(message: string): void {
			// Implementation would use vscode.window.withProgress
			console.info(`[Paths-LE Progress] ${message}`);
		},
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

void localize;
