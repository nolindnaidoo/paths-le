import { describe, expect, it } from 'vitest';
import {
	categorizeError,
	createError,
	createParseError,
	determineRecoveryAction,
	determineSeverity,
} from './errorHandling';

describe('Error Handling', () => {
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

	it('should categorize errors correctly', () => {
		const parseError = new Error('Parse error');
		const category = categorizeError(parseError);

		expect(category).toBe('parsing');
	});

	it('should determine severity correctly', () => {
		const error = new Error('Critical error');
		const severity = determineSeverity(error, 'validation');

		expect(severity).toBe('critical');
	});

	it('should determine recovery action correctly', () => {
		const action = determineRecoveryAction('file-system', 'error');

		expect(action).toBe('retry');
	});
});
