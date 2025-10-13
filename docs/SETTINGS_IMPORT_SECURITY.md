# Settings Import Security

**Version**: 1.1.0  
**Last Updated**: 2025-10-13  
**Status**: Implemented

## Overview

Settings import in Paths-LE now includes comprehensive JSON schema validation to prevent malicious or invalid configuration from being imported. This document describes the security measures in place and how they protect users.

## Security Features

### 1. File Size Limits

**Protection**: Prevents Denial of Service (DoS) attacks via large files

**Implementation**:

- Maximum file size: 100KB
- Files are checked before reading into memory
- Clear error messages for oversized files

**Example**:

```typescript
const stats = await vscode.workspace.fs.stat(uri[0])
const fileSizeError = validateFileSize(stats.size)
if (fileSizeError) {
  vscode.window.showErrorMessage(`Cannot import settings: ${fileSizeError}`)
  return
}
```

### 2. JSON Parsing

**Protection**: Prevents malformed JSON from crashing the extension

**Implementation**:

- Safe JSON parsing with try-catch
- Clear error messages for parse failures
- No execution of code from JSON

**Example**:

```typescript
try {
  parsedSettings = JSON.parse(configJson)
} catch (parseError) {
  vscode.window.showErrorMessage(`Invalid JSON file: ${parseError.message}`)
  return
}
```

### 3. Schema Validation

**Protection**: Ensures only valid settings are imported

**Validations**:

- ✅ Key whitelist (only known settings allowed)
- ✅ Type checking (boolean, string, number)
- ✅ Enum validation (allowed values only)
- ✅ Number range constraints (min/max values)
- ✅ String length limits (max 500 characters)
- ✅ Object key count limit (max 100 settings)

**Example**:

```typescript
const validation: ValidationResult = validateSettings(parsedSettings)
if (!validation.valid) {
  // Show errors, prevent import
  vscode.window.showErrorMessage('Settings validation failed')
  return
}
```

### 4. Prototype Pollution Prevention

**Protection**: Prevents attacks that modify JavaScript object prototypes

**Dangerous Keys Blocked**:

- `__proto__`
- `constructor`
- `prototype`

**Implementation**:

```typescript
if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
  errors.push(`Dangerous setting key rejected: "${key}"`)
  continue
}
```

**Attack Example (Blocked)**:

```json
{
  "__proto__": {
    "polluted": true
  }
}
```

### 5. Plain Object Requirement

**Protection**: Prevents non-JSON objects (classes, arrays) from being imported

**Implementation**:

```typescript
if (Object.getPrototypeOf(settings) !== Object.prototype) {
  return {
    valid: false,
    errors: ['Settings must be a plain JSON object'],
  }
}
```

### 6. Type Safety

**Protection**: Ensures all values match expected types

**Type Validations**:

**Boolean Settings**:

```typescript
// Valid
{ "copyToClipboardEnabled": true }

// Invalid - wrong type
{ "copyToClipboardEnabled": "true" }
// Error: Expected boolean, got string
```

**Number Settings with Ranges**:

```typescript
// Valid
{ "safety.fileSizeWarnBytes": 1000000 }

// Invalid - below minimum
{ "safety.fileSizeWarnBytes": 500 }
// Error: Value 500 is below minimum 1000

// Invalid - above maximum
{ "safety.fileSizeWarnBytes": 200000000 }
// Error: Value 200000000 is above maximum 100000000

// Invalid - not finite
{ "safety.fileSizeWarnBytes": Infinity }
// Error: Value must be a finite number
```

**String Enum Settings**:

```typescript
// Valid
{ "notificationsLevel": "silent" }

// Invalid - not in enum
{ "notificationsLevel": "invalid" }
// Error: Value "invalid" not in allowed values: all, important, silent
```

### 7. Unknown Key Rejection

**Protection**: Prevents injection of arbitrary configuration

**Implementation**:

```typescript
if (!(key in SETTINGS_SCHEMA)) {
  errors.push(`Unknown setting: "${key}"`)
  continue
}
```

**Example**:

```json
{
  "copyToClipboardEnabled": true,
  "maliciousSetting": "exploit"
}
```

**Result**:

- ✅ `copyToClipboardEnabled` imported
- ❌ `maliciousSetting` rejected
- ⚠️ User warned about skipped settings

### 8. Partial Import with Warnings

**Protection**: Allows valid settings while rejecting invalid ones

**Flow**:

1. Validate all settings
2. Separate valid from invalid
3. Show confirmation if some settings are invalid
4. Only import validated settings

**User Experience**:

```
⚠️ Warning: 2 invalid setting(s) will be skipped.
Import 8 valid setting(s)?

[Import Valid Settings] [Cancel]
```

## Validation Schema

### All Valid Settings

The following settings can be imported:

#### Core Settings

- `copyToClipboardEnabled`: boolean
- `dedupeEnabled`: boolean
- `notificationsLevel`: "all" | "important" | "silent"
- `postProcess.openInNewFile`: boolean
- `openResultsSideBySide`: boolean
- `showParseErrors`: boolean
- `telemetryEnabled`: boolean

#### Safety Settings

- `safety.enabled`: boolean
- `safety.fileSizeWarnBytes`: number (1,000 - 100,000,000)
- `safety.largeOutputLinesThreshold`: number (100 - 10,000,000)
- `safety.manyDocumentsThreshold`: number (1 - 100)

#### Status Bar

- `statusBar.enabled`: boolean

#### Analysis Settings

- `analysis.enabled`: boolean
- `analysis.includeValidation`: boolean
- `analysis.includePatterns`: boolean

#### Validation Settings

- `validation.enabled`: boolean
- `validation.checkExistence`: boolean
- `validation.checkPermissions`: boolean

#### Performance Settings

- `performance.enabled`: boolean
- `performance.maxDuration`: number (1,000 - 300,000 ms)
- `performance.maxMemoryUsage`: number (1MB - 1GB bytes)
- `performance.maxCpuUsage`: number (100,000 - 10,000,000)
- `performance.minThroughput`: number (100 - 10,000,000)
- `performance.maxCacheSize`: number (100 - 100,000)

#### Keyboard Settings

- `keyboard.shortcuts.enabled`: boolean
- `keyboard.extractShortcut`: string (max 500 chars)
- `keyboard.validateShortcut`: string (max 500 chars)
- `keyboard.analyzeShortcut`: string (max 500 chars)

#### Preset Settings

- `presets.enabled`: boolean
- `presets.defaultPreset`: "minimal" | "balanced" | "comprehensive" | "performance" | "validation"

## Security Testing

### Test Coverage

✅ **36 tests** covering all security scenarios:

- Type validation (boolean, string, number)
- Enum validation
- Range validation (min/max)
- Infinite/NaN number rejection
- Unknown key rejection
- File size limits
- Prototype pollution prevention
- Constructor pollution prevention
- String length limits
- Key count limits
- Plain object requirement
- Mixed valid/invalid settings

### Security Test Examples

**Test: Prototype Pollution**

```typescript
const maliciousSettings = JSON.parse('{"__proto__": {"polluted": true}}')
const result = validateSettings(maliciousSettings)
// Result: { valid: false, errors: ['Dangerous setting key rejected: "__proto__"'] }
```

**Test: Type Safety**

```typescript
const settings = {
  'copyToClipboardEnabled': 'true', // Should be boolean
  'safety.fileSizeWarnBytes': '1000000', // Should be number
}
const result = validateSettings(settings)
// Result: valid: false, errors include type mismatches
```

**Test: Range Constraints**

```typescript
const settings = {
  'safety.fileSizeWarnBytes': -1000, // Negative not allowed
}
const result = validateSettings(settings)
// Result: valid: false, error about minimum value
```

## User Flow

### Successful Import

1. User selects settings file (JSON)
2. File size validated (< 100KB)
3. JSON parsed successfully
4. All settings validated successfully
5. Settings imported
6. Success message shown

### Partial Import (Some Invalid Settings)

1. User selects settings file
2. File size validated
3. JSON parsed
4. Validation finds 2 invalid settings
5. User shown warning dialog:
   ```
   ⚠️ 2 invalid setting(s) will be skipped.
   Import 8 valid setting(s)?
   ```
6. User confirms
7. Valid settings imported
8. Success message: "Imported 8 setting(s) successfully (2 invalid setting(s) skipped)"

### Failed Import

1. User selects settings file
2. Validation fails completely
3. Error dialog shown: "Cannot import settings due to validation errors"
4. User can view detailed errors in new document

## Best Practices

### For Users

✅ **DO**:

- Export settings using the built-in export command
- Keep settings files under 100KB
- Only import settings from trusted sources
- Review validation errors if import fails

❌ **DON'T**:

- Manually edit exported settings files with unknown keys
- Import settings from untrusted sources
- Ignore validation warnings

### For Developers

✅ **DO**:

- Update schema when adding new settings
- Add tests for new validation rules
- Use explicit type checking
- Freeze returned objects
- Provide clear error messages

❌ **DON'T**:

- Bypass validation
- Trust user input
- Allow arbitrary JSON structures
- Use eval() or similar dangerous functions

## Error Messages

All error messages are clear and actionable:

| Scenario         | Error Message                                                           |
| ---------------- | ----------------------------------------------------------------------- |
| File too large   | "Settings file too large (SIZE bytes). Maximum allowed: 100000 bytes"   |
| Empty file       | "Settings file is empty"                                                |
| Invalid JSON     | "Invalid JSON file: [parse error]"                                      |
| Wrong type       | "Setting \"KEY\": Expected TYPE, got ACTUAL_TYPE"                       |
| Out of range     | "Setting \"KEY\": Value VALUE is [below minimum / above maximum] LIMIT" |
| Invalid enum     | "Setting \"KEY\": Value \"VALUE\" not in allowed values: LIST"          |
| Unknown key      | "Unknown setting: \"KEY\""                                              |
| Dangerous key    | "Dangerous setting key rejected: \"KEY\""                               |
| Too many keys    | "Settings file contains too many keys (max 100)"                        |
| Not plain object | "Settings must be a plain JSON object"                                  |

## Performance

- **Validation Time**: < 1ms for typical settings files
- **Memory Usage**: Minimal (settings limited to 100KB)
- **No Blocking**: All operations are async

## Future Enhancements

Potential improvements for future versions:

1. **Settings Diff Preview**: Show what will change before importing
2. **Selective Import**: Allow users to choose which settings to import
3. **Settings History**: Track previous configurations
4. **Settings Sync**: Cloud sync for settings across devices
5. **Import from URL**: Validate and import from remote sources
6. **Custom Validation Rules**: User-defined constraints

## Related Documentation

- [Configuration Guide](CONFIGURATION.md)
- [Security & Privacy](../PRIVACY.md)
- [Quality Audit](../QUALITY_REAUDIT_2025-10-13.md)

## Changelog

### v1.1.0 (2025-10-13)

**Added**:

- JSON schema validation for settings import
- File size limits (100KB max)
- Prototype pollution prevention
- Type checking and range validation
- Comprehensive test suite (36 tests)
- Detailed validation error messages
- Partial import with warnings

**Security Impact**: High - Prevents malicious configuration injection

---

**Last Review**: 2025-10-13  
**Next Review**: 2026-01-13 (Quarterly)
