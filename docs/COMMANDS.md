# Paths-LE Commands

## Overview

Paths-LE provides a comprehensive set of commands for extracting, analyzing, and validating file paths from various file formats. All commands are designed with developer empathy in mind, providing clear feedback and graceful error handling.

## Core Commands

### 1. Extract Paths (`paths-le.extractPaths`)

**Purpose**: Extract all file paths from the current document and display them in a structured format.

**Usage**:

- **Command Palette**: `Paths-LE: Extract Paths`
- **Keyboard Shortcut**: `Ctrl+Alt+P` (Windows/Linux) or `Cmd+Alt+P` (Mac)
- **Context Menu**: Right-click in editor → `Extract Paths`

**Features**:

- Detects paths in various formats (Unix, Windows, relative, absolute, URLs)
- Supports multiple file types (JSON, YAML, JavaScript, TypeScript, logs, INI)
- Handles different path types (files, directories, URLs, environment variables)
- Provides progress indication for large files
- Shows extraction results in a new document

**Output Format**:

```
Extracted Paths (5 found):
1. /home/user/documents/file.txt (Unix path)
2. C:\Users\Documents\file.txt (Windows path)
3. ./config/settings.json (Relative path)
4. https://example.com/api/data (URL)
5. $HOME/.config/app.json (Environment variable)
```

**Error Handling**:

- Gracefully handles invalid path formats
- Provides clear error messages for parsing failures
- Offers recovery suggestions for common issues
- Continues processing despite individual path errors

### 2. Validate Paths (`paths-le.postProcess.validate`)

**Purpose**: Validate extracted paths for existence, permissions, and accessibility.

**Usage**:

- **Command Palette**: `Paths-LE: Validate Paths`
- **Context Menu**: Available after extraction

**Features**:

- Checks if paths exist in the file system
- Validates file and directory permissions
- Checks path accessibility
- Detects broken symbolic links
- Provides detailed validation results

**Validation Types**:

- **Existence Check**: Verify paths exist
- **Permission Check**: Check read/write/execute permissions
- **Accessibility Check**: Verify path accessibility
- **Format Check**: Validate path format and syntax

**Configuration**:

- Enable/disable specific validation types
- Set validation timeouts
- Configure permission checking
- Custom validation rules

### 3. Analyze Paths (`paths-le.postProcess.analyze`)

**Purpose**: Generate comprehensive analysis reports for extracted paths.

**Usage**:

- **Command Palette**: `Paths-LE: Analyze Paths`
- **Context Menu**: Available after extraction

**Analysis Features**:

- **Pattern Recognition**: Identifies common path patterns
- **Depth Analysis**: Analyzes path depth and nesting
- **Naming Analysis**: Analyzes naming conventions
- **Validation Analysis**: Identifies invalid or broken paths
- **Permission Analysis**: Analyzes permission patterns

**Report Sections**:

1. **Summary**: Overview of extracted paths
2. **Patterns**: Identified path patterns
3. **Validation**: Path validation results
4. **Permissions**: Permission analysis
5. **Recommendations**: Suggestions for improvement

**Sample Report**:

```
Path Analysis Report
===================

Summary:
- Total paths: 25
- Valid paths: 22
- Invalid paths: 3
- Broken links: 1
- Permission issues: 2

Patterns:
- Unix paths: 15 paths (60%)
- Windows paths: 8 paths (32%)
- Relative paths: 2 paths (8%)

Validation:
- Existence: 22/25 (88%)
- Permissions: 20/25 (80%)
- Accessibility: 23/25 (92%)

Recommendations:
- Fix broken symbolic links
- Check file permissions
- Use consistent path formats
```

### 4. Open Settings (`paths-le.openSettings`)

**Purpose**: Open the Paths-LE configuration settings.

**Usage**:

- **Command Palette**: `Paths-LE: Open Settings`
- **Settings UI**: VS Code Settings → Extensions → Paths-LE

**Configuration Categories**:

- **Basic Settings**: Copy to clipboard, deduplication, notifications
- **Safety Settings**: File size warnings, output limits
- **Analysis Settings**: Pattern recognition, validation analysis
- **Validation Settings**: Existence checks, permission checks

### 5. Help (`paths-le.help`)

**Purpose**: Display comprehensive help and troubleshooting information.

**Usage**:

- **Command Palette**: `Paths-LE: Help & Troubleshooting`

**Help Sections**:

- **Command Overview**: Description of all commands
- **Supported Formats**: List of supported path formats
- **File Types**: Supported file types and extensions
- **Features**: Detailed feature descriptions
- **Troubleshooting**: Common issues and solutions
- **Settings**: Configuration options and explanations

## Command Workflow

### Typical Usage Pattern

1. **Open File**: Open a file containing paths
2. **Extract Paths**: Use `Extract Paths` command
3. **Review Results**: Check extracted paths in new document
4. **Validate Paths**: Use `Validate Paths` if needed
5. **Analyze Paths**: Use `Analyze Paths` for detailed analysis
6. **Configure Settings**: Use `Open Settings` to customize behavior

### Advanced Workflow

1. **Extract Paths**: Extract paths from multiple files
2. **Combine Results**: Merge results from different sources
3. **Validate Paths**: Check path validity across files
4. **Analyze Patterns**: Identify patterns across files
5. **Generate Report**: Create comprehensive analysis report
6. **Export Results**: Export results for further processing

## Command Dependencies

### Service Dependencies

- **Telemetry**: Event logging and usage tracking
- **Notifier**: User notifications and feedback
- **StatusBar**: Progress indication and status updates
- **ErrorHandler**: Error handling and recovery
- **PerformanceMonitor**: Performance tracking and optimization
- **Localizer**: Internationalization and localization

### Configuration Dependencies

- **Safety Settings**: File size and processing limits
- **Analysis Settings**: Analysis feature configuration
- **Validation Settings**: Path validation configuration
- **Notification Settings**: User feedback preferences

## Error Handling

### Common Errors

- **No Paths Found**: File doesn't contain recognizable path patterns
- **Invalid Format**: Path format not supported or invalid
- **File Access Error**: Cannot read file or insufficient permissions
- **Memory Error**: File too large for processing
- **Timeout Error**: Processing takes too long

### Recovery Actions

- **Retry**: Automatically retry failed operations
- **Fallback**: Use alternative processing methods
- **User Action**: Request user intervention
- **Skip**: Skip problematic entries
- **Abort**: Stop processing entirely

## Performance Considerations

### Large File Handling

- **Progress Indication**: Real-time progress updates
- **Cancellation Support**: Cancel long-running operations
- **Memory Management**: Efficient memory usage
- **Chunked Processing**: Process large files in chunks

### Optimization Features

- **Caching**: Cache frequently used data
- **Lazy Evaluation**: Defer expensive operations
- **Background Processing**: Process large files in background
- **Resource Cleanup**: Proper resource management

## Integration Points

### VS Code Integration

- **Command Palette**: All commands available in command palette
- **Context Menu**: Right-click context menu integration
- **Status Bar**: Status bar entry for quick access
- **Settings UI**: Integrated settings interface
- **Keybindings**: Customizable keyboard shortcuts

### File System Integration

- **File Watching**: Monitor file changes
- **Workspace Integration**: Workspace-aware processing
- **Multi-root Support**: Support for multi-root workspaces
- **Virtual Workspaces**: Limited support for virtual workspaces

## Best Practices

### Command Usage

- **Start Simple**: Begin with basic extraction
- **Iterate**: Use analysis to improve results
- **Configure**: Customize settings for your workflow
- **Monitor**: Watch for performance issues
- **Report**: Provide feedback for improvements

### Performance Tips

- **Enable Safety Checks**: Prevent processing of large files
- **Use Analysis Features**: Selectively enable analysis features
- **Monitor Memory**: Watch memory usage for large files
- **Cancel When Needed**: Don't hesitate to cancel long operations

### Troubleshooting

- **Check File Format**: Ensure file format is supported
- **Verify Path Formats**: Confirm path formats are recognizable
- **Review Settings**: Check configuration settings
- **Clear Cache**: Clear extension cache if needed
- **Restart Extension**: Reload extension if issues persist

---

This command reference provides comprehensive information about all Paths-LE commands, helping users make the most of the extension's capabilities while following best practices for performance and reliability.
