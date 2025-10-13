# Paths-LE Testing Guide

## Framework

Vitest with V8 coverage provider. **220 tests** with 90%+ coverage on core extraction modules.

**Current Test Suite (v1.2.0)**:
- Total Tests: **220 passing**
- Coverage: 38.74% statements, 82.98% branches, 68.75% functions
- Core Extraction Modules: 90%+ coverage

### Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      threshold: {
        global: { branches: 80, functions: 80, lines: 80, statements: 80 },
      },
    },
  },
})
```

## Test Breakdown by Module

| Module                | Tests | Coverage | Focus Area                      |
| --------------------- | ----- | -------- | ------------------------------- |
| **Extraction Core**   | 9     | 88%      | Main extraction logic           |
| **Collection Logic**  | 19    | 95%      | Path collection & deduplication |
| **JavaScript Format** | 13    | 93%      | Import/require/export patterns  |
| **JSON Format**       | 13    | 97%      | Recursive path detection        |
| **HTML Format**       | 22    | 90%      | Attribute extraction & srcset   |
| **CSS Format**        | 16    | 93%      | url() and @import extraction    |
| **CSV Format**        | 8     | 90%      | CSV parsing with quotes         |
| **DOTENV Format**     | 11    | 78%      | Environment file parsing        |
| **TOML Format**       | 9     | 94%      | TOML config parsing             |
| **Path Validation**   | 27    | 76%      | Cross-platform path checks      |
| **Analysis**          | 16    | 100%     | Path statistics & grouping      |
| **Validation Utils**  | 16    | 66%      | Input sanitization              |
| **Settings Schema**   | 36    | 100%     | Configuration validation        |
| **Error Handling**    | 5     | 13%      | Error recovery (lightweight)    |
| **TOTAL**             | **220** | **~90%*** | ***Core modules only**          |

## Test Organization

```
src/
├── extraction/
│   ├── extract.test.ts (9 tests)
│   ├── collect.test.ts (19 tests)
│   └── formats/
│       ├── javascript.test.ts (13 tests)
│       ├── json.test.ts (13 tests)
│       ├── html.test.ts (22 tests)
│       ├── css.test.ts (16 tests)
│       ├── csv.test.ts (8 tests)
│       ├── dotenv.test.ts (11 tests)
│       └── toml.test.ts (9 tests)
├── config/
│   └── settingsSchema.test.ts (36 tests)
├── utils/
│   ├── pathValidation.test.ts (27 tests)
│   ├── analysis.test.ts (16 tests)
│   ├── validation.test.ts (16 tests)
│   └── errorHandling.test.ts (5 tests)
└── __mocks__/
    └── vscode.ts
```

## Test Categories

### Unit Tests

Pure function validation:

```typescript
describe('Path Extraction', () => {
  it('extracts Unix paths from JSON', () => {
    const content = '{ "path": "/home/user/file.txt" }'
    const result = extractPaths(content, 'json')

    expect(result.success).toBe(true)
    expect(result.paths).toHaveLength(1)
    expect(result.paths[0].value).toBe('/home/user/file.txt')
    expect(result.paths[0].isAbsolute).toBe(true)
  })

  it('extracts Windows paths from JSON', () => {
    const content = '{ "path": "C:\\\\Users\\\\file.txt" }'
    const result = extractPaths(content, 'json')

    expect(result.success).toBe(true)
    expect(result.paths[0].value).toBe('C:\\Users\\file.txt')
    expect(result.paths[0].platform).toBe('windows')
  })

  it('handles relative paths', () => {
    const content = '{ "path": "./config/settings.json" }'
    const result = extractPaths(content, 'json')

    expect(result.paths[0].isAbsolute).toBe(false)
  })
})
```

### Integration Tests

Workflow validation:

```typescript
describe('Complete Workflow', () => {
  it('completes extract → validate → analyze', async () => {
    const content = JSON.stringify({
      paths: ['/home/user/file.txt', './config.json'],
    })

    // Extract
    const extractResult = await extractPaths(content, 'json')
    expect(extractResult.success).toBe(true)
    expect(extractResult.paths).toHaveLength(2)

    // Validate
    const validateResult = await validatePaths(extractResult.paths)
    expect(validateResult.success).toBe(true)

    // Analyze
    const analyzeResult = await analyzePaths(extractResult.paths)
    expect(analyzeResult.success).toBe(true)
    expect(analyzeResult.report).toBeDefined()
  })
})
```

### Performance Tests

Resource usage validation:

```typescript
describe('Performance', () => {
  it('extracts 10k paths within 5 seconds', () => {
    const content = generateLargeTestContent(10000)
    const start = Date.now()

    const result = extractPaths(content, 'json')

    expect(Date.now() - start).toBeLessThan(5000)
    expect(result.paths).toHaveLength(10000)
  })

  it('uses less than 100MB memory', () => {
    const initial = process.memoryUsage().heapUsed
    const content = generateLargeTestContent(50000)

    extractPaths(content, 'json')

    const used = process.memoryUsage().heapUsed - initial
    expect(used).toBeLessThan(100 * 1024 * 1024)
  })
})
```

## Test Utilities

### Mock VS Code

```typescript
// __mocks__/vscode.ts
export const window = {
  showInformationMessage: vi.fn(),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    show: vi.fn(),
  })),
  withProgress: vi.fn((opts, task) => task({}, {})),
}

export const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn((key, defaultValue) => defaultValue),
  })),
}
```

### Test Data Generators

```typescript
export function generateLargeTestContent(pathCount: number): string {
  const paths = Array.from({ length: pathCount }, (_, i) => `/home/user/file${i}.txt`)

  return JSON.stringify({ paths })
}

export function generateComplexTestContent(): string {
  return JSON.stringify({
    unixPaths: ['/home/user/file.txt', '/var/log/app.log'],
    windowsPaths: ['C:\\Users\\file.txt', 'D:\\Data\\config.ini'],
    relativePaths: ['./config.json', '../data/file.csv'],
  })
}
```

## Running Tests

```bash
npm test                       # Run all 220 tests
npm run test:watch             # Watch mode
npm run test:coverage          # Generate coverage report
npm test -- extraction         # Run specific tests
npm test -- javascript         # Run JavaScript format tests
npx vitest --ui                # Visual test UI
```

## Coverage Requirements

- **Minimum**: 80% across all metrics
- **Critical Paths**: 100% for extraction and validation functions
- **Reports**: HTML reports in `coverage/` directory

## Performance Benchmarks

| Input | Paths  | Max Duration | Max Memory | Throughput    |
| ----- | ------ | ------------ | ---------- | ------------- |
| 1MB   | 1,000  | 1s           | 10MB       | 1,000 paths/s |
| 10MB  | 10,000 | 5s           | 50MB       | 2,000 paths/s |
| 50MB  | 50,000 | 30s          | 100MB      | 1,666 paths/s |

## Quality Assurance

### Test Writing Principles

1. **Arrange-Act-Assert**: Clear three-phase structure
2. **Single Focus**: One behavior per test
3. **Independence**: Tests run in any order
4. **Speed**: Under 100ms per test
5. **Descriptive**: Meaningful test names

### Error Testing

```typescript
describe('Error Handling', () => {
  it('handles file read errors gracefully', async () => {
    vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('Read error'))

    const result = await extractPathsFromFile('missing.json')

    expect(result.success).toBe(false)
    expect(result.errors[0].category).toBe('file-system')
    expect(result.errors[0].severity).toBe('error')
  })

  it('recovers from malformed JSON', () => {
    const content = '{ invalid json }'
    const result = extractPaths(content, 'json')

    expect(result.success).toBe(false)
    expect(result.errors[0].category).toBe('parsing')
  })

  it('continues after partial failures', () => {
    const content = JSON.stringify({
      valid: '/home/user/file.txt',
      invalid: null,
      another: './config.json',
    })

    const result = extractPaths(content, 'json')

    expect(result.success).toBe(true)
    expect(result.paths).toHaveLength(2)
    expect(result.errors).toHaveLength(1)
  })
})
```

## Validation Testing

```typescript
describe('Path Validation', () => {
  it('validates existing files', async () => {
    const testFile = await createTempFile()
    const result = validatePaths([{ value: testFile, isAbsolute: true }])

    expect(result.results[0].exists).toBe(true)
    expect(result.results[0].accessible).toBe(true)
  })

  it('handles missing files', () => {
    const result = validatePaths([
      {
        value: '/nonexistent/file.txt',
        isAbsolute: true,
      },
    ])

    expect(result.results[0].exists).toBe(false)
  })
})
```

## Continuous Integration

GitHub Actions runs tests on every push:

```yaml
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

---

**Related:** [Architecture](ARCHITECTURE.md) | [Performance](PERFORMANCE.md) | [Development](DEVELOPMENT.md)
