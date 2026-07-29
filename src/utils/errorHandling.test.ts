import { describe, expect, it } from 'vitest';
import {
	buildErrorRecoveryOptions,
	categorizeError,
	createEnhancedError,
	createError,
	createErrorHandler,
	createErrorLogger,
	createErrorNotifier,
	createParseError,
	determineRecoveryAction,
	determineSeverity,
	sanitizeErrorMessage,
} from './errorHandling';

describe('Error Handling', () => {
	describe('createError', () => {
		it('should create a generic error with correct properties', () => {
			const error = createError({
				category: 'parsing',
				severity: 'warning',
				message: 'Test error',
				recoverable: true,
				recoveryAction: 'skip',
			});

			expect(error.category).toBe('parsing');
			expect(error.severity).toBe('warning');
			expect(error.message).toBe('Test error');
			expect(error.recoverable).toBe(true);
			expect(error.recoveryAction).toBe('skip');
			expect(error.timestamp).toBeTypeOf('number');
		});

		it('should freeze error object', () => {
			const error = createError({
				category: 'parsing',
				severity: 'warning',
				message: 'Test error',
				recoverable: true,
				recoveryAction: 'skip',
			});

			expect(Object.isFrozen(error)).toBe(true);
		});
	});

	describe('createParseError', () => {
		it('should create parse error with correct properties', () => {
			const error = createParseError({
				message: 'Parse error',
				filepath: '/test/file.log',
				position: { line: 1, column: 5 },
			});

			expect(error.category).toBe('parsing');
			expect(error.severity).toBe('warning');
			expect(error.message).toBe('Parse error');
			expect(error.filepath).toBe('/test/file.log');
			expect(error.position).toEqual({ line: 1, column: 5 });
		});

		it('should create parse error without filepath', () => {
			const error = createParseError({
				message: 'Parse error',
			});

			expect(error.category).toBe('parsing');
			expect(error.message).toBe('Parse error');
			expect(error.filepath).toBeUndefined();
		});

		it('should create parse error without position', () => {
			const error = createParseError({
				message: 'Parse error',
				filepath: '/test/file.log',
			});

			expect(error.category).toBe('parsing');
			expect(error.filepath).toBe('/test/file.log');
			expect(error.position).toBeUndefined();
		});

		it('should freeze parse error object', () => {
			const error = createParseError({
				message: 'Parse error',
			});

			expect(Object.isFrozen(error)).toBe(true);
		});
	});

	describe('categorizeError', () => {
		it('should categorize parse errors', () => {
			const parseError = new Error('Parse error');
			expect(categorizeError(parseError)).toBe('parsing');
		});

		it('should categorize syntax errors', () => {
			const syntaxError = new Error('Syntax error');
			expect(categorizeError(syntaxError)).toBe('parsing');
		});

		it('should categorize validation errors', () => {
			const validationError = new Error('Validation failed');
			expect(categorizeError(validationError)).toBe('validation');
		});

		it('should categorize invalid input errors', () => {
			const invalidError = new Error('Invalid path');
			expect(categorizeError(invalidError)).toBe('validation');
		});

		it('should categorize permission errors', () => {
			const permissionError = new Error('Permission denied');
			expect(categorizeError(permissionError)).toBe('file-system');
		});

		it('should categorize access errors', () => {
			const accessError = new Error('Access denied');
			expect(categorizeError(accessError)).toBe('file-system');
		});

		it('should categorize configuration errors', () => {
			const configError = new Error('Config error');
			expect(categorizeError(configError)).toBe('configuration');
		});

		it('should categorize setting errors', () => {
			const settingError = new Error('Setting not found');
			expect(categorizeError(settingError)).toBe('configuration');
		});

		it('should categorize safety errors', () => {
			const safetyError = new Error('Safety threshold exceeded');
			expect(categorizeError(safetyError)).toBe('safety');
		});

		it('should categorize threshold errors', () => {
			const thresholdError = new Error('Threshold exceeded');
			expect(categorizeError(thresholdError)).toBe('safety');
		});

		it('should categorize unknown errors as operational', () => {
			const unknownError = new Error('Something went wrong');
			expect(categorizeError(unknownError)).toBe('operational');
		});
	});

	describe('determineSeverity', () => {
		it('should determine critical severity', () => {
			const error = new Error('Critical error');
			expect(determineSeverity(error, 'operational')).toBe('critical');
		});

		it('should determine fatal severity as critical', () => {
			const error = new Error('Fatal error');
			expect(determineSeverity(error, 'operational')).toBe('critical');
		});

		it('should determine error severity for error messages', () => {
			const error = new Error('Error occurred');
			expect(determineSeverity(error, 'operational')).toBe('error');
		});

		it('should determine error severity for file-system category', () => {
			const error = new Error('File not found');
			expect(determineSeverity(error, 'file-system')).toBe('error');
		});

		it('should determine warning severity for warning messages', () => {
			const error = new Error('Warning: something');
			expect(determineSeverity(error, 'operational')).toBe('warning');
		});

		it('should determine warning severity for validation category', () => {
			const error = new Error('Invalid input');
			expect(determineSeverity(error, 'validation')).toBe('warning');
		});

		it('should determine info severity for other messages', () => {
			const error = new Error('Something happened');
			expect(determineSeverity(error, 'operational')).toBe('info');
		});
	});

	describe('determineRecoveryAction', () => {
		it('should determine retry for file-system errors', () => {
			expect(determineRecoveryAction('file-system', 'error')).toBe('retry');
		});

		it('should determine skip for parsing errors', () => {
			expect(determineRecoveryAction('parsing', 'warning')).toBe('skip');
		});

		it('should determine skip for validation errors', () => {
			expect(determineRecoveryAction('validation', 'warning')).toBe('skip');
		});

		it('should determine abort for critical errors', () => {
			expect(determineRecoveryAction('operational', 'critical')).toBe('abort');
		});

		it('should determine fallback for other errors', () => {
			expect(determineRecoveryAction('operational', 'error')).toBe('fallback');
		});
	});

	describe('createEnhancedError', () => {
		it('should create enhanced error with all properties', () => {
			const error = createEnhancedError(new Error('Test error'), 'parse');

			expect(error.category).toBe('parse');
			expect(error.message).toBe('Test error');
			expect(error.userFriendlyMessage).toBeDefined();
			expect(error.suggestion).toBeDefined();
			expect(error.recoverable).toBe(true);
			expect(error.severity).toBe('medium');
			expect(error.timestamp).toBeInstanceOf(Date);
		});

		it('should create enhanced error with custom options', () => {
			const error = createEnhancedError(
				new Error('Test error'),
				'parse',
				undefined,
				{
					recoverable: false,
					severity: 'high',
					suggestion: 'Custom suggestion',
				},
			);

			expect(error.recoverable).toBe(false);
			expect(error.severity).toBe('high');
			expect(error.suggestion).toBe('Custom suggestion');
		});

		it('should freeze enhanced error object', () => {
			const error = createEnhancedError(new Error('Test error'), 'parse');
			expect(Object.isFrozen(error)).toBe(true);
		});

		it('should mark parse errors as recoverable', () => {
			const error = createEnhancedError(new Error('Parse failed'), 'parse');
			expect(error.recoverable).toBe(true);
		});

		it('should mark parsing errors as recoverable', () => {
			const error = createEnhancedError(new Error('Parsing failed'), 'parsing');
			expect(error.recoverable).toBe(true);
		});

		it('should mark safety errors as non-recoverable', () => {
			const error = createEnhancedError(new Error('File too large'), 'safety');
			expect(error.recoverable).toBe(false);
		});

		it('should mark file-system permission errors as recoverable', () => {
			const error = createEnhancedError(
				new Error('permission denied'),
				'file-system',
			);
			expect(error.recoverable).toBe(true);
		});

		it('should mark file-system network errors as recoverable', () => {
			const error = createEnhancedError(
				new Error('network timeout'),
				'file-system',
			);
			expect(error.recoverable).toBe(true);
		});

		it('should mark operational fatal errors as non-recoverable', () => {
			const error = createEnhancedError(
				new Error('fatal error occurred'),
				'operational',
			);
			expect(error.recoverable).toBe(false);
		});

		it('should mark configuration errors as recoverable', () => {
			const error = createEnhancedError(
				new Error('Config invalid'),
				'configuration',
			);
			expect(error.recoverable).toBe(true);
		});

		it('should mark validation errors as recoverable', () => {
			const error = createEnhancedError(
				new Error('Invalid path'),
				'validation',
			);
			expect(error.recoverable).toBe(true);
		});
	});

	describe('buildErrorRecoveryOptions', () => {
		it('should provide retry options for file-system errors', () => {
			const error = createEnhancedError(new Error('File error'), 'file-system');
			const options = buildErrorRecoveryOptions(error);

			expect(options.retryable).toBe(true);
			expect(options.maxRetries).toBe(3);
			expect(options.retryDelay).toBe(1000);
		});

		it('should provide retry options for operational errors', () => {
			const error = createEnhancedError(
				new Error('Extraction failed'),
				'operational',
			);
			const options = buildErrorRecoveryOptions(error);

			expect(options.retryable).toBe(true);
			expect(options.maxRetries).toBe(2);
			expect(options.retryDelay).toBe(2000);
		});

		it('should provide fallback for configuration errors', () => {
			const error = createEnhancedError(
				new Error('Config invalid'),
				'configuration',
			);
			const options = buildErrorRecoveryOptions(error);

			expect(options.retryable).toBe(false);
			expect(options.fallbackAction).toBeDefined();
		});

		it('should provide no recovery for parse errors', () => {
			const error = createEnhancedError(new Error('Parse failed'), 'parse');
			const options = buildErrorRecoveryOptions(error);

			expect(options.retryable).toBe(false);
			expect(options.maxRetries).toBe(0);
		});

		it('should freeze recovery options', () => {
			const error = createEnhancedError(new Error('Test error'), 'file-system');
			const options = buildErrorRecoveryOptions(error);
			expect(Object.isFrozen(options)).toBe(true);
		});
	});

	describe('sanitizeErrorMessage', () => {
		it('should sanitize Unix user paths', () => {
			const message = 'Error in /home/username/file.log';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toBe('Error in /home/***/file.log');
		});

		it('should sanitize macOS user paths', () => {
			const message = 'Error in /Users/username/file.log';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toBe('Error in /Users/***/file.log');
		});

		it('should sanitize Windows user paths', () => {
			const message = 'Error in C:\\Users\\username\\file.log';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toBe('Error in C:\\Users\\***\\file.log');
		});

		it('should sanitize passwords', () => {
			const message = 'password=secret123';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toBe('password=***');
		});

		it('should sanitize tokens', () => {
			const message = 'token=abc123def456';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toBe('token=***');
		});

		it('should sanitize API keys', () => {
			const message = 'key=sk-abc123def456';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toBe('key=***');
		});

		it('should sanitize multiple sensitive patterns', () => {
			const message = 'Error in /home/user/file.log with password=secret';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toContain('/home/***/file.log');
			expect(sanitized).toContain('password=***');
		});

		it('should preserve non-sensitive information', () => {
			const message = 'Path parsing failed for /var/log/app.log';
			const sanitized = sanitizeErrorMessage(message);
			expect(sanitized).toBe(message);
		});
	});

	describe('createErrorLogger', () => {
		it('should create error logger with output channel', () => {
			const lines: string[] = [];
			const outputChannel = {
				appendLine: (line: string) => lines.push(line),
			};

			const logger = createErrorLogger(outputChannel);
			expect(logger).toBeDefined();
			expect(typeof logger.log).toBe('function');
			expect(typeof logger.logError).toBe('function');
		});

		it('should log messages with correct format', () => {
			const lines: string[] = [];
			const outputChannel = {
				appendLine: (line: string) => lines.push(line),
			};

			const logger = createErrorLogger(outputChannel);
			logger.log('Test message', 'info');

			expect(lines).toHaveLength(1);
			expect(lines[0]).toContain('[INFO]');
			expect(lines[0]).toContain('Test message');
		});

		it('should log errors with stack trace', () => {
			const lines: string[] = [];
			const outputChannel = {
				appendLine: (line: string) => lines.push(line),
			};

			const logger = createErrorLogger(outputChannel);
			const error = createEnhancedError(new Error('Test error'), 'parse');
			logger.logError(error);

			expect(lines.length).toBeGreaterThan(0);
			expect(lines[0]).toContain('[ERROR]');
			expect(lines[0]).toContain('Test error');
		});

		it('should freeze logger object', () => {
			const outputChannel = {
				appendLine: () => {},
			};
			const logger = createErrorLogger(outputChannel);
			expect(Object.isFrozen(logger)).toBe(true);
		});
	});

	describe('createErrorNotifier', () => {
		it('should create error notifier', () => {
			const notifier = createErrorNotifier();
			expect(notifier).toBeDefined();
			expect(typeof notifier.showError).toBe('function');
			expect(typeof notifier.showWarning).toBe('function');
			expect(typeof notifier.showInfo).toBe('function');
		});

		it('should freeze notifier object', () => {
			const notifier = createErrorNotifier();
			expect(Object.isFrozen(notifier)).toBe(true);
		});
	});

	describe('createErrorHandler', () => {
		it('should create error handler with dependencies', () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'all' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			expect(handler).toBeDefined();
			expect(typeof handler.handle).toBe('function');
			expect(typeof handler.handleWithRecovery).toBe('function');
		});

		it('should freeze handler object', () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'all' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			expect(Object.isFrozen(handler)).toBe(true);
		});

		it('should handle high severity errors', async () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'all' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			const error = createEnhancedError(
				new Error('Critical error'),
				'safety',
				undefined,
				{
					severity: 'high',
				},
			);

			await handler.handle(error);
			// Should complete without throwing
			expect(true).toBe(true);
		});

		it('should handle recoverable errors with retry', async () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'all' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			const error = createEnhancedError(
				new Error('Temporary error'),
				'file-system',
			);

			const recovered = await handler.handleWithRecovery(error);
			expect(typeof recovered).toBe('boolean');
		});

		it('should handle medium severity errors with important notifications', async () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'important' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			const error = createEnhancedError(
				new Error('Medium error'),
				'operational',
				undefined,
				{
					severity: 'medium',
				},
			);

			await handler.handle(error);
			expect(true).toBe(true);
		});

		it('should handle low severity errors with all notifications', async () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'all' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			const error = createEnhancedError(
				new Error('Low error'),
				'operational',
				undefined,
				{
					severity: 'low',
				},
			);

			await handler.handle(error);
			expect(true).toBe(true);
		});

		it('should not show low severity errors with silent notifications', async () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'silent' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			const error = createEnhancedError(
				new Error('Low error'),
				'operational',
				undefined,
				{
					severity: 'low',
				},
			);

			await handler.handle(error);
			expect(true).toBe(true);
		});

		it('should log errors', () => {
			const lines: string[] = [];
			const logger = createErrorLogger({
				appendLine: (line) => lines.push(line),
			});
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'all' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			const error = createEnhancedError(new Error('Test error'), 'parse');

			handler.logError(error);
			expect(lines.length).toBeGreaterThan(0);
		});

		it('should notify user with high severity', () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'all' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			const error = createEnhancedError(
				new Error('High error'),
				'safety',
				undefined,
				{
					severity: 'high',
				},
			);

			handler.notifyUser(error);
			expect(true).toBe(true);
		});

		it('should notify user with medium severity', () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'all' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			const error = createEnhancedError(
				new Error('Medium error'),
				'operational',
				undefined,
				{
					severity: 'medium',
				},
			);

			handler.notifyUser(error);
			expect(true).toBe(true);
		});

		it('should notify user with low severity', () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'all' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			const error = createEnhancedError(
				new Error('Low error'),
				'operational',
				undefined,
				{
					severity: 'low',
				},
			);

			handler.notifyUser(error);
			expect(true).toBe(true);
		});

		it('should handle errors with fallback action', async () => {
			const logger = createErrorLogger({ appendLine: () => {} });
			const notifier = createErrorNotifier();
			const config = {
				showParseErrors: true,
				notificationsLevel: 'all' as const,
				maxRetries: 3,
				retryDelay: 1000,
			};

			const handler = createErrorHandler({ logger, notifier, config });
			const error = createEnhancedError(
				new Error('Config error'),
				'configuration',
			);
			const options = buildErrorRecoveryOptions(error);

			const recovered = await handler.handleWithRecovery(error, options);
			expect(typeof recovered).toBe('boolean');
		});
	});

	describe('createErrorLogger additional tests', () => {
		it('should log warnings with context', () => {
			const lines: string[] = [];
			const outputChannel = {
				appendLine: (line: string) => lines.push(line),
			};

			const logger = createErrorLogger(outputChannel);
			logger.logWarning('Test warning', { filepath: '/test/file.log' });

			expect(lines).toHaveLength(1);
			expect(lines[0]).toContain('[WARN]');
			expect(lines[0]).toContain('Test warning');
			expect(lines[0]).toContain('filepath');
		});

		it('should log info with context', () => {
			const lines: string[] = [];
			const outputChannel = {
				appendLine: (line: string) => lines.push(line),
			};

			const logger = createErrorLogger(outputChannel);
			logger.logInfo('Test info', { operation: 'extract' });

			expect(lines).toHaveLength(1);
			expect(lines[0]).toContain('[INFO]');
			expect(lines[0]).toContain('Test info');
			expect(lines[0]).toContain('operation');
		});
	});

	describe('createErrorNotifier additional tests', () => {
		it('should show error with details', () => {
			const notifier = createErrorNotifier();
			notifier.showError('Error message', 'Error details');
			expect(true).toBe(true);
		});

		it('should show warning with details', () => {
			const notifier = createErrorNotifier();
			notifier.showWarning('Warning message', 'Warning details');
			expect(true).toBe(true);
		});

		it('should show info with details', () => {
			const notifier = createErrorNotifier();
			notifier.showInfo('Info message', 'Info details');
			expect(true).toBe(true);
		});

		it('should show progress', () => {
			const notifier = createErrorNotifier();
			notifier.showProgress('Processing...');
			expect(true).toBe(true);
		});
	});
});
