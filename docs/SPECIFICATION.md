# Paths-LE Specification

## Overview

Paths-LE is a VS Code extension that extracts and analyzes file paths from 9 different file formats including JavaScript, TypeScript, JSON, HTML, CSS, TOML, CSV, and environment files. It provides comprehensive path analysis, validation, and pattern recognition capabilities with smart filtering for modern web development workflows.

## Core Features

### 1. Path Extraction

- **Multi-format Support**: Extracts paths from 9 file formats - JavaScript, TypeScript, JSON, HTML, CSS, TOML, CSV, and environment files
- **Smart Filtering**: Automatically excludes npm packages in JS/TS, data: URLs in HTML/CSS, and javascript: URLs
- **Web Development Focus**: Full support for modern web development with import/require/export, HTML attributes, and CSS url()
- **Pattern Recognition**: Identifies path patterns across structured data, code, and markup
- **Path Types**: Handles file paths, directory paths, relative paths, absolute paths, and URLs
- **Cross-platform Support**: Works with Unix (`/`), Windows (`C:\`), and UNC paths (`\\server\share`)

### 2. Path Analysis

- **Pattern Analysis**: Identifies common path patterns and formats
- **Depth Analysis**: Analyzes path depth and nesting levels
- **Naming Analysis**: Analyzes path naming conventions and patterns
- **Validation Analysis**: Identifies invalid, broken, or inaccessible paths
- **Permission Analysis**: Checks file and directory permissions

### 3. Path Validation

- **Existence Validation**: Checks if paths exist in the file system
- **Permission Validation**: Validates read, write, and execute permissions
- **Format Validation**: Validates path format and syntax
- **Accessibility Validation**: Checks if paths are accessible
- **Broken Link Detection**: Identifies broken symbolic links

### 4. Validation and Safety

- **Input Validation**: Validates path formats and values
- **Safety Checks**: Prevents processing of extremely large files
- **Error Handling**: Graceful error handling with user feedback
- **Recovery Mechanisms**: Automatic recovery from common errors

## Supported Path Formats

### Standard Formats

- **Unix Paths**: `/home/user/documents/file.txt`
- **Windows Paths**: `C:\Users\Documents\file.txt`
- **Relative Paths**: `./config/settings.json`, `../data/file.csv`
- **URL Paths**: `https://example.com/path/to/file`
- **UNC Paths**: `\\server\share\file.txt`

### Special Formats

- **Config Paths**: `config/database/connection.json`
- **Log Paths**: `/var/log/application.log`
- **Build Paths**: `dist/build/output.js`
- **Asset Paths**: `assets/images/logo.png`

### Environment Variables

- **Home Directory**: `$HOME/documents`, `~/.config`
- **System Paths**: `$PATH`, `%TEMP%`
- **Custom Variables**: `$PROJECT_ROOT/src`

## Supported File Types

### Web Development (Primary)

1. **JavaScript** (`.js`, `.mjs`, `.cjs`, `.jsx`) - ES6 imports, CommonJS require, dynamic imports, exports
2. **TypeScript** (`.ts`, `.tsx`, `.mts`, `.cts`) - Full TypeScript support with same patterns as JavaScript
3. **JSON** (`.json`) - Recursive path detection in nested objects and arrays
4. **HTML** (`.html`, `.htm`) - All path attributes (src, href, data, srcset, poster, etc.)
5. **CSS** (`.css`, `.scss`, `.less`) - url() functions and @import statements

### Configuration & Data

6. **TOML** (`.toml`) - Configuration files with nested paths
7. **CSV** (`.csv`, `.tsv`) - Data files with path columns
8. **Environment** (`.env`, `.env.local`, `.env.*`) - Environment variable files with path values
9. **Log/Text** (`.log`, `.txt`) - Plain text files with extracted path patterns

### Smart Features by Format

- **JavaScript/TypeScript**: Filters out npm package names (e.g., 'react', '@mui/material', 'lodash')
- **HTML**: Automatically excludes data: and javascript: URLs
- **CSS**: Automatically excludes data: URLs
- **JSON**: Traverses nested structures recursively
- **All Formats**: Cross-platform path normalization and URL detection

## Command Interface

### Core Commands

- **Extract Paths**: `paths-le.extractPaths` - Extract paths from current document
- **Validate Paths**: `paths-le.postProcess.validate` - Validate extracted paths
- **Analyze Paths**: `paths-le.postProcess.analyze` - Generate analysis report
- **Open Settings**: `paths-le.openSettings` - Configure extension settings
- **Help**: `paths-le.help` - Show help and troubleshooting information

### Keyboard Shortcuts

- **Extract Paths**: `Ctrl+Alt+P` (Windows/Linux) or `Cmd+Alt+P` (Mac)

### Context Menu

- **Extract Paths**: Available in editor context menu for supported file types

## Configuration Options

### Basic Settings

- **Copy to Clipboard**: Automatically copy results to clipboard
- **Deduplication**: Remove duplicate paths from results
- **Notification Level**: Control notification verbosity
- **Status Bar**: Show/hide status bar entry

### Safety Settings

- **Safety Checks**: Enable/disable safety warnings
- **File Size Warning**: Threshold for large file warnings
- **Output Size Warning**: Threshold for large output warnings
- **Document Count Warning**: Threshold for multiple document warnings

### Analysis Settings

- **Analysis Enabled**: Enable/disable path analysis
- **Validation Analysis**: Include path validation
- **Pattern Analysis**: Include pattern recognition
- **Permission Analysis**: Include permission checking

### Validation Settings

- **Validation Enabled**: Enable/disable path validation
- **Existence Check**: Check if paths exist
- **Permission Check**: Check file permissions
- **Accessibility Check**: Check path accessibility

## Performance Specifications

### Processing Limits

- **Maximum File Size**: 10MB (configurable)
- **Maximum Processing Time**: 30 seconds (configurable)
- **Maximum Memory Usage**: 100MB (configurable)
- **Maximum CPU Usage**: 80% (configurable)

### Performance Features

- **Progress Indication**: Real-time progress updates
- **Cancellation Support**: Cancel long-running operations
- **Memory Management**: Efficient memory usage and cleanup
- **Caching**: Cache frequently used data

## Error Handling

### Error Categories

- **Parsing Errors**: Invalid path formats or values
- **Validation Errors**: Path validation failures
- **File System Errors**: File access or permission issues
- **Configuration Errors**: Invalid configuration settings
- **Performance Errors**: Performance threshold exceeded
- **Unknown Errors**: Unexpected errors

### Recovery Actions

- **Retry**: Automatically retry failed operations
- **Fallback**: Use alternative processing methods
- **User Action**: Request user intervention
- **Skip**: Skip problematic entries
- **Abort**: Stop processing entirely

## Output Formats

### Text Output

- **Plain Text**: Simple text list of paths
- **Formatted Text**: Formatted with additional information
- **CSV**: Comma-separated values
- **JSON**: Structured JSON output

### Analysis Reports

- **Summary Report**: Overview of extracted paths
- **Detailed Report**: Comprehensive analysis results
- **Pattern Report**: Pattern recognition results
- **Validation Report**: Path validation results

## Integration Points

### VS Code Integration

- **Command Palette**: All commands available in command palette
- **Context Menu**: Right-click context menu integration
- **Status Bar**: Status bar entry for quick access
- **Settings UI**: Integrated settings interface

### File System Integration

- **File Watching**: Monitor file changes
- **Workspace Integration**: Workspace-aware processing
- **Multi-root Support**: Support for multi-root workspaces
- **Virtual Workspaces**: Limited support for virtual workspaces

## Quality Assurance

### Testing Requirements

- **Unit Tests**: Minimum 80% code coverage
- **Integration Tests**: End-to-end workflow testing
- **Performance Tests**: Large file processing tests
- **Error Tests**: Error handling and recovery tests

### Code Quality

- **TypeScript**: Strict TypeScript configuration
- **Linting**: ESLint and Prettier configuration
- **Formatting**: Consistent code formatting
- **Documentation**: Comprehensive code documentation

## Security Considerations

### Data Privacy

- **Local Processing**: All processing happens locally
- **No Data Collection**: No user data is collected or transmitted
- **Configurable Telemetry**: Optional local-only telemetry
- **Privacy by Design**: Privacy considerations built into architecture

### Security Measures

- **Input Validation**: All inputs are validated and sanitized
- **Error Handling**: Secure error handling without information leakage
- **Resource Management**: Proper resource cleanup and management
- **Access Control**: Appropriate file system access controls

## Future Enhancements

### Planned Features

- **Plugin System**: Support for custom path extractors
- **Advanced Analysis**: Machine learning-based pattern recognition
- **Export Options**: Export results to various formats
- **Batch Processing**: Process multiple files simultaneously

### Potential Integrations

- **Git Integration**: Analyze paths in git history
- **CI/CD Integration**: Integrate with build pipelines
- **File System Integration**: Connect to file system APIs
- **Cloud Integration**: Connect to cloud storage services

---

This specification defines the complete feature set and requirements for Paths-LE, ensuring it meets the needs of developers working with path-related data across various file formats and use cases.
