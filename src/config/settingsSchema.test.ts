import { describe, expect, it } from 'vitest';
import {
	isSafeValue,
	MAX_IMPORT_FILE_SIZE,
	SETTINGS_SCHEMA,
	validateFileSize,
	validateSettings,
} from './settingsSchema';

describe('settingsSchema', () => {
	describe('validateSettings', () => {
		it('should accept valid boolean settings', () => {
			const settings = {
				copyToClipboardEnabled: true,
				dedupeEnabled: false,
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.validSettings).toEqual(settings);
		});

		it('should accept valid string enum settings', () => {
			const settings = {
				notificationsLevel: 'silent',
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.validSettings).toEqual(settings);
		});

		it('should accept valid number settings within range', () => {
			const settings = {
				'safety.fileSizeWarnBytes': 1000000,
				'performance.maxDuration': 5000,
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.validSettings).toEqual(settings);
		});

		it('should accept valid preset settings', () => {
			const settings = {
				'presets.enabled': true,
				'presets.defaultPreset': 'balanced',
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.validSettings).toEqual(settings);
		});

		it('should reject non-object settings', () => {
			const result = validateSettings('not an object');

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Settings must be a JSON object');
			expect(result.validSettings).toEqual({});
		});

		it('should reject null settings', () => {
			const result = validateSettings(null);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Settings must be a JSON object');
		});

		it('should reject settings with wrong types', () => {
			const settings = {
				copyToClipboardEnabled: 'true', // Should be boolean
				'safety.fileSizeWarnBytes': '1000000', // Should be number
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Setting "copyToClipboardEnabled": Expected boolean, got string',
			);
			expect(result.errors).toContain(
				'Setting "safety.fileSizeWarnBytes": Expected number, got string',
			);
			expect(result.validSettings).toEqual({});
		});

		it('should reject invalid enum values', () => {
			const settings = {
				notificationsLevel: 'invalid',
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toContain('not in allowed values');
		});

		it('should reject numbers below minimum', () => {
			const settings = {
				'safety.fileSizeWarnBytes': 500, // Min is 1000
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Setting "safety.fileSizeWarnBytes": Value 500 is below minimum 1000',
			);
		});

		it('should reject numbers above maximum', () => {
			const settings = {
				'safety.fileSizeWarnBytes': 200_000_000, // Max is 100_000_000
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Setting "safety.fileSizeWarnBytes": Value 200000000 is above maximum 100000000',
			);
		});

		it('should reject infinite numbers', () => {
			const settings = {
				'safety.fileSizeWarnBytes': Number.POSITIVE_INFINITY,
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Setting "safety.fileSizeWarnBytes": Value must be a finite number',
			);
		});

		it('should reject NaN numbers', () => {
			const settings = {
				'safety.fileSizeWarnBytes': Number.NaN,
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Setting "safety.fileSizeWarnBytes": Value must be a finite number',
			);
		});

		it('should reject unknown setting keys', () => {
			const settings = {
				copyToClipboardEnabled: true,
				unknownSetting: 'value',
				anotherUnknown: 123,
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Unknown setting: "unknownSetting"');
			expect(result.errors).toContain('Unknown setting: "anotherUnknown"');
			expect(result.validSettings).toEqual({ copyToClipboardEnabled: true });
		});

		it('should reject excessively long strings', () => {
			const settings = {
				'keyboard.extractShortcut': 'a'.repeat(501), // Max is 500
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Setting "keyboard.extractShortcut": String value too long (max 500 characters)',
			);
		});

		it('should reject settings with too many keys', () => {
			const settings: Record<string, unknown> = {};
			for (let i = 0; i < 101; i++) {
				settings[`key${i}`] = true;
			}

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Settings file contains too many keys (max 100)',
			);
		});

		it('should reject non-plain objects', () => {
			class CustomObject {
				copyToClipboardEnabled = true;
			}
			const settings = new CustomObject();

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain('Settings must be a plain JSON object');
		});

		it('should handle mixed valid and invalid settings', () => {
			const settings = {
				copyToClipboardEnabled: true, // Valid
				dedupeEnabled: 'false', // Invalid type
				unknownKey: 'value', // Invalid key
				'safety.fileSizeWarnBytes': 2000, // Valid
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.validSettings).toEqual({
				copyToClipboardEnabled: true,
				'safety.fileSizeWarnBytes': 2000,
			});
		});

		it('should accept all valid setting keys from schema', () => {
			const settings: Record<string, unknown> = {
				copyToClipboardEnabled: true,
				dedupeEnabled: false,
				notificationsLevel: 'silent',
				'postProcess.openInNewFile': true,
				openResultsSideBySide: false,
				showParseErrors: true,
				telemetryEnabled: false,
				'safety.enabled': true,
				'safety.fileSizeWarnBytes': 1000000,
				'safety.largeOutputLinesThreshold': 50000,
				'safety.manyDocumentsThreshold': 8,
				'statusBar.enabled': true,
				'analysis.enabled': true,
				'analysis.includeValidation': true,
				'analysis.includePatterns': true,
				'validation.enabled': true,
				'validation.checkExistence': true,
				'validation.checkPermissions': false,
				'performance.enabled': true,
				'performance.maxDuration': 5000,
				'performance.maxMemoryUsage': 104857600,
				'performance.maxCpuUsage': 1000000,
				'performance.minThroughput': 1000,
				'performance.maxCacheSize': 1000,
				'keyboard.shortcuts.enabled': true,
				'keyboard.extractShortcut': 'ctrl+alt+p',
				'keyboard.validateShortcut': 'ctrl+alt+v',
				'keyboard.analyzeShortcut': 'ctrl+alt+a',
				'presets.enabled': true,
				'presets.defaultPreset': 'balanced',
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(Object.keys(result.validSettings)).toHaveLength(
				Object.keys(settings).length,
			);
		});

		it('should accept empty settings object', () => {
			const result = validateSettings({});

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.validSettings).toEqual({});
		});
	});

	describe('validateFileSize', () => {
		it('should accept valid file size', () => {
			const result = validateFileSize(50 * 1024); // 50KB

			expect(result).toBeNull();
		});

		it('should accept maximum allowed size', () => {
			const result = validateFileSize(MAX_IMPORT_FILE_SIZE);

			expect(result).toBeNull();
		});

		it('should reject file size exceeding limit', () => {
			const result = validateFileSize(MAX_IMPORT_FILE_SIZE + 1);

			expect(result).toBeTruthy();
			expect(result).toContain('too large');
			expect(result).toContain('Maximum allowed');
		});

		it('should reject empty file', () => {
			const result = validateFileSize(0);

			expect(result).toBeTruthy();
			expect(result).toContain('empty');
		});

		it('should accept minimum non-zero size', () => {
			const result = validateFileSize(1);

			expect(result).toBeNull();
		});
	});

	describe('isSafeValue', () => {
		it('should accept safe primitive values', () => {
			expect(isSafeValue(true)).toBe(true);
			expect(isSafeValue(false)).toBe(true);
			expect(isSafeValue(123)).toBe(true);
			expect(isSafeValue(0)).toBe(true);
			expect(isSafeValue('string')).toBe(true);
			expect(isSafeValue('')).toBe(true);
			expect(isSafeValue(null)).toBe(true);
			expect(isSafeValue(undefined)).toBe(true);
		});

		it('should reject objects', () => {
			expect(isSafeValue({})).toBe(false);
			expect(isSafeValue({ key: 'value' })).toBe(false);
			expect(isSafeValue([])).toBe(false);
			expect(isSafeValue([1, 2, 3])).toBe(false);
		});

		it('should reject functions', () => {
			expect(isSafeValue(() => {})).toBe(false);
			expect(
				isSafeValue(function test() {
					return true;
				}),
			).toBe(false);
		});

		it('should reject symbols', () => {
			expect(isSafeValue(Symbol('test'))).toBe(false);
		});
	});

	describe('SETTINGS_SCHEMA', () => {
		it('should be frozen', () => {
			expect(Object.isFrozen(SETTINGS_SCHEMA)).toBe(true);
		});

		it('should contain all expected setting keys', () => {
			const expectedKeys = [
				'copyToClipboardEnabled',
				'dedupeEnabled',
				'notificationsLevel',
				'postProcess.openInNewFile',
				'openResultsSideBySide',
				'showParseErrors',
				'telemetryEnabled',
				'safety.enabled',
				'safety.fileSizeWarnBytes',
				'safety.largeOutputLinesThreshold',
				'safety.manyDocumentsThreshold',
				'statusBar.enabled',
				'analysis.enabled',
				'analysis.includeValidation',
				'analysis.includePatterns',
				'validation.enabled',
				'validation.checkExistence',
				'validation.checkPermissions',
				'performance.enabled',
				'performance.maxDuration',
				'performance.maxMemoryUsage',
				'performance.maxCpuUsage',
				'performance.minThroughput',
				'performance.maxCacheSize',
				'keyboard.shortcuts.enabled',
				'keyboard.extractShortcut',
				'keyboard.validateShortcut',
				'keyboard.analyzeShortcut',
				'presets.enabled',
				'presets.defaultPreset',
			];

			const schemaKeys = Object.keys(SETTINGS_SCHEMA);
			expect(schemaKeys).toHaveLength(expectedKeys.length);
			for (const key of expectedKeys) {
				expect(schemaKeys).toContain(key);
			}
		});

		it('should have valid types for all settings', () => {
			for (const [_key, schema] of Object.entries(SETTINGS_SCHEMA)) {
				expect(['boolean', 'string', 'number']).toContain(schema.type);

				if ('enum' in schema) {
					expect(Array.isArray(schema.enum)).toBe(true);
					expect((schema.enum as readonly unknown[]).length).toBeGreaterThan(0);
				}

				if ('min' in schema) {
					expect(typeof schema.min).toBe('number');
				}

				if ('max' in schema) {
					expect(typeof schema.max).toBe('number');
				}
			}
		});
	});

	describe('Security tests', () => {
		it('should prevent prototype pollution', () => {
			const maliciousSettings = JSON.parse('{"__proto__": {"polluted": true}}');

			const result = validateSettings(maliciousSettings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Dangerous setting key rejected: "__proto__"',
			);
		});

		it('should reject constructor pollution attempt', () => {
			const settings = {
				constructor: { prototype: { polluted: true } },
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Dangerous setting key rejected: "constructor"',
			);
		});

		it('should handle extremely large numbers safely', () => {
			const settings = {
				'safety.fileSizeWarnBytes': Number.MAX_SAFE_INTEGER,
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should handle negative numbers appropriately', () => {
			const settings = {
				'safety.fileSizeWarnBytes': -1000,
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(false);
			expect(result.errors).toContain(
				'Setting "safety.fileSizeWarnBytes": Value -1000 is below minimum 1000',
			);
		});

		it('should accept unusual but valid string patterns', () => {
			// VS Code handles the value safely, we just validate type and length
			const settings = {
				'keyboard.extractShortcut': 'ctrl+alt+shift+x',
			};

			const result = validateSettings(settings);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			// Check using bracket notation which works with frozen objects
			expect(result.validSettings['keyboard.extractShortcut']).toBe(
				'ctrl+alt+shift+x',
			);
			expect(Object.keys(result.validSettings)).toContain(
				'keyboard.extractShortcut',
			);
		});
	});
});
