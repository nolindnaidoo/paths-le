# Paths-LE Development Guide

## Overview

This guide provides comprehensive information for developers working on the Paths-LE extension. It covers setup, architecture, development practices, testing, and deployment.

## Required Software

### Core Requirements

- **Node.js**: Version 20.0.0 or higher
- **VS Code**: Version 1.105.0 or higher
- **TypeScript**: Version 5.9.3 or higher
- **Git**: For version control

### Recommended Tools

- **VS Code Extensions**:
  - TypeScript and JavaScript Language Features
  - Prettier - Code formatter
  - ESLint
  - GitLens
  - Thunder Client (for API testing)

## Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/nolindnaidoo/paths-le.git
cd paths-le
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build Extension

```bash
npm run build
```

### 4. Run Tests

```bash
npm test
```

### 5. Watch Mode

```bash
npm run watch
```

## Source Code Organization

### Directory Structure

```
src/
├── commands/           # Command implementations
│   ├── extract.ts      # Extract paths command
│   ├── validate.ts     # Validate paths command
│   ├── analyze.ts      # Analyze paths command
│   ├── help.ts         # Help command
│   └── index.ts        # Command registration
├── config/             # Configuration management
│   ├── config.ts       # Configuration utilities
│   └── settings.ts     # Settings command
├── extraction/         # Path extraction engine
│   ├── extract.ts      # Main extraction logic
│   ├── patterns.ts     # Path pattern definitions
│   └── formats/         # Format-specific extractors
│       ├── json.ts     # JSON path extraction
│       ├── yaml.ts     # YAML path extraction
│       ├── javascript.ts # JavaScript path extraction
│       ├── log.ts      # Log file path extraction
│       └── ini.ts      # INI file path extraction
├── analysis/            # Path analysis engine
│   ├── analyzer.ts     # Main analysis logic
│   ├── patterns.ts     # Pattern recognition
│   ├── validation.ts   # Validation analysis
│   └── permissions.ts  # Permission analysis
├── validation/          # Path validation engine
│   ├── validator.ts     # Main validation logic
│   ├── existence.ts    # Existence checking
│   ├── permissions.ts  # Permission checking
│   └── accessibility.ts # Accessibility checking
├── ui/                 # User interface components
│   ├── notifier.ts     # Notification system
│   └── statusBar.ts    # Status bar integration
├── utils/               # Utility functions
│   ├── errorHandling.ts # Error handling system
│   ├── performance.ts  # Performance monitoring
│   └── localization.ts # Internationalization
├── telemetry/           # Telemetry and logging
│   └── telemetry.ts    # Telemetry system
├── types.ts            # Type definitions
└── extension.ts        # Extension entry point
```

### Key Files

- **`extension.ts`**: Extension activation and service setup
- **`types.ts`**: Core type definitions and interfaces
- **`commands/index.ts`**: Command registration and dependency injection
- **`extraction/extract.ts`**: Main path extraction logic
- **`analysis/analyzer.ts`**: Path analysis engine
- **`validation/validator.ts`**: Path validation engine

## Architecture Principles

### Functional Programming

- **Pure Functions**: Functions without side effects
- **Immutability**: Use `readonly` types and `Object.freeze()`
- **Factory Patterns**: Create objects through factory functions
- **Dependency Injection**: Pass dependencies as parameters

### Example Factory Pattern

```typescript
export function createErrorHandler(deps: {
  logger: ErrorLogger
  notifier: ErrorNotifier
  config: ErrorConfig
}): ErrorHandler {
  return Object.freeze({
    handleError: (error: Error) => {
      // Error handling logic
    },
    // ... other methods
  })
}
```

### Service Registration Pattern

```typescript
export function registerCommands(
  context: vscode.ExtensionContext,
  deps: Readonly<{
    telemetry: Telemetry
    notifier: Notifier
    statusBar: StatusBar
    localizer: Localizer
    performanceMonitor: PerformanceMonitor
    errorHandler: ErrorHandler
  }>,
): void {
  // Register commands with dependencies
}
```

## Development Workflow

### 1. Feature Development

1. **Create Feature Branch**: `git checkout -b feature/new-feature`
2. **Implement Feature**: Follow functional programming patterns
3. **Add Tests**: Write comprehensive tests
4. **Update Documentation**: Update relevant documentation
5. **Submit PR**: Create pull request with description

### 2. Bug Fixes

1. **Create Bug Branch**: `git checkout -b bugfix/issue-description`
2. **Reproduce Issue**: Create test case reproducing the bug
3. **Fix Issue**: Implement fix following patterns
4. **Add Tests**: Ensure fix is covered by tests
5. **Submit PR**: Create pull request with fix description

### 3. Documentation Updates

1. **Identify Need**: Determine documentation needs
2. **Update Files**: Modify relevant documentation files
3. **Review Changes**: Ensure accuracy and completeness
4. **Submit PR**: Create pull request with documentation

## Testing

### Test Structure

```
src/
├── __tests__/          # Test files
│   ├── commands/       # Command tests
│   ├── extraction/     # Extraction tests
│   ├── analysis/       # Analysis tests
│   ├── validation/     # Validation tests
│   └── utils/          # Utility tests
├── __mocks__/          # Mock implementations
│   └── vscode.ts       # VS Code API mocks
└── test-data/          # Test data files
    ├── sample.json     # Sample JSON files
    ├── sample.yaml     # Sample YAML files
    └── sample.log      # Sample log files
```

### Test Categories

- **Unit Tests**: Test individual functions and methods
- **Integration Tests**: Test component interactions
- **Command Tests**: Test command execution and workflows
- **Performance Tests**: Test performance characteristics
- **Error Handling Tests**: Test error scenarios and recovery

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Test Coverage Requirements

- **Functions**: 80% minimum coverage
- **Branches**: 80% minimum coverage
- **Lines**: 80% minimum coverage
- **Statements**: 80% minimum coverage

## TypeScript Configuration

### Compiler Options

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "outDir": "dist",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "skipLibCheck": true,
    "esModuleInterop": true
  }
}
```

### Code Style

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for strings
- **Semicolons**: Always use semicolons
- **Trailing Commas**: Use trailing commas in objects/arrays
- **Function Declarations**: Use function expressions for consistency

## Error Handling

### Error Categories

- **Parsing Errors**: Path format parsing issues
- **Validation Errors**: Path validation failures
- **File System Errors**: File access issues
- **Configuration Errors**: Configuration problems
- **Performance Errors**: Performance threshold violations
- **Unknown Errors**: Unclassified errors

### Error Recovery

- **Retry**: Automatically retry failed operations
- **Fallback**: Use alternative processing methods
- **User Action**: Request user intervention
- **Skip**: Skip problematic entries
- **Abort**: Stop processing entirely

### Error Logging

- **Structured Logging**: Use structured log format
- **Error Context**: Include relevant context information
- **Stack Traces**: Include stack traces for debugging
- **User-Friendly Messages**: Provide clear user messages

## Performance Considerations

### Memory Management

- **Object Pooling**: Reuse objects when possible
- **Lazy Loading**: Load data only when needed
- **Garbage Collection**: Minimize object creation
- **Memory Monitoring**: Track memory usage

### CPU Optimization

- **Algorithm Efficiency**: Use efficient algorithms
- **Caching**: Cache frequently used data
- **Background Processing**: Process large files in background
- **Cancellation**: Support operation cancellation

### File Processing

- **Streaming**: Process large files in streams
- **Chunked Processing**: Process files in chunks
- **Progress Reporting**: Provide progress updates
- **Timeout Handling**: Handle long-running operations

## VS Code Integration

### Extension API Usage

- **Commands**: Register and execute commands
- **Configuration**: Access and modify settings
- **Workspace**: Access workspace information
- **File System**: Read and write files
- **UI Components**: Status bar, notifications, etc.

### Debugging

- **Extension Host**: Debug extension in extension host
- **Test Runner**: Debug tests in test runner
- **Breakpoints**: Set breakpoints in code
- **Logging**: Use console.log for debugging

### Logging

- **Output Channel**: Use VS Code output channel
- **Log Levels**: Use appropriate log levels
- **Structured Logging**: Use structured log format
- **Error Tracking**: Track and report errors

## Common Issues

### Development Issues

- **Type Errors**: Check TypeScript configuration
- **Import Errors**: Verify import paths and exports
- **Runtime Errors**: Check VS Code API usage
- **Performance Issues**: Monitor memory and CPU usage

### Build Issues

- **Compilation Errors**: Check TypeScript configuration
- **Dependency Issues**: Verify package.json dependencies
- **Path Issues**: Check file paths and imports
- **Configuration Issues**: Verify VS Code extension configuration

### Testing Issues

- **Test Failures**: Check test implementation and mocks
- **Coverage Issues**: Ensure adequate test coverage
- **Mock Issues**: Verify mock implementations
- **Environment Issues**: Check test environment setup

## Getting Help

### Documentation

- **README**: Extension overview and quick start
- **ARCHITECTURE**: Detailed architecture documentation
- **SPECIFICATION**: Functional requirements
- **COMMANDS**: Command reference
- **CONFIGURATION**: Configuration guide
- **PERFORMANCE**: Performance characteristics
- **PRIVACY**: Privacy policy and data handling

### Community Support

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Pull Requests**: Contribute code and documentation
- **Code Reviews**: Participate in code reviews

### Development Resources

- **VS Code Extension API**: Official VS Code extension documentation
- **TypeScript Handbook**: TypeScript language documentation
- **Node.js Documentation**: Node.js runtime documentation
- **Testing Best Practices**: Testing guidelines and patterns

---

This development guide provides comprehensive information for developers working on Paths-LE, ensuring consistent development practices and high code quality.
