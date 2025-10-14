# Paths-LE Commands

## Overview

Paths-LE provides **8 commands** for extracting, processing, and managing file paths from various file formats. All commands are designed with developer empathy in mind, providing clear feedback and graceful error handling.

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

## Post-Processing Commands

### 2. Deduplicate Paths (`paths-le.postProcess.dedupe`)

**Purpose**: Remove duplicate paths from the current document while preserving the original order.

**Usage**:

- **Command Palette**: `Paths-LE: Deduplicate Paths`

**Features**:

- Removes duplicate path entries while maintaining first occurrence
- Preserves original path order
- Works on any text document with paths (one per line)
- Shows count of removed duplicates
- Provides clear feedback on completion

**Example**:

```
Before:
./src/app.js
../config/settings.json
./src/app.js
./utils/helper.js

After:
./src/app.js
../config/settings.json
./utils/helper.js
```

### 3. Sort Paths (`paths-le.postProcess.sort`)

**Purpose**: Sort paths in the current document with multiple sort modes.

**Usage**:

- **Command Palette**: `Paths-LE: Sort Paths`

**Sort Modes**:

1. **Alphabetical (A → Z)** - Sort paths as strings, A to Z
2. **Alphabetical (Z → A)** - Sort paths as strings, Z to A
3. **By Length (Short → Long)** - Sort by path length, shortest first
4. **By Length (Long → Short)** - Sort by path length, longest first

**Features**:

- Interactive sort mode selection via quick pick
- Works with any path format (Unix, Windows, relative, absolute)
- Shows count of sorted paths
- Provides clear feedback on completion

**Example**:

```
Before:
../config/settings.json
./src/app.js
./utils/helper.js

After (Alphabetical A→Z):
../config/settings.json
./src/app.js
./utils/helper.js
```

## Settings Commands

### 4. Open Settings (`paths-le.openSettings`)

**Purpose**: Quick access to Paths-LE settings in VS Code.

**Usage**:

- **Command Palette**: `Paths-LE: Open Settings`

**Details**: Opens VS Code settings filtered to Paths-LE configuration options.

### 5. Export Settings (`paths-le.settings.export`)

**Purpose**: Export current Paths-LE settings to a JSON file.

**Usage**:

- **Command Palette**: `Paths-LE: Export Settings`

**Features**:

- Saves all Paths-LE configuration to a JSON file
- Includes version and export timestamp
- Useful for backing up configuration or sharing with team

### 6. Import Settings (`paths-le.settings.import`)

**Purpose**: Import Paths-LE settings from a previously exported JSON file.

**Usage**:

- **Command Palette**: `Paths-LE: Import Settings`

**Features**:

- Validates imported settings file format
- Confirms before overwriting current settings
- Provides clear success/failure feedback

**Safety**: Shows confirmation dialog before applying imported settings.

### 7. Reset Settings (`paths-le.settings.reset`)

**Purpose**: Reset all Paths-LE settings to their default values.

**Usage**:

- **Command Palette**: `Paths-LE: Reset Settings`

**Features**:

- Resets all configuration to defaults
- Shows confirmation dialog (cannot be undone)
- Provides clear feedback on completion

**Safety**: Requires explicit confirmation before resetting.

### 8. Help & Troubleshooting (`paths-le.help`)

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
4. **Deduplicate**: Use `Deduplicate Paths` to remove duplicates (optional)
5. **Sort**: Use `Sort Paths` to organize paths (optional)
6. **Configure Settings**: Use `Open Settings` to customize behavior

### Advanced Workflow

1. **Extract Paths**: Extract paths from multiple files
2. **Combine Results**: Merge results from different sources
3. **Post-Process**: Deduplicate and sort combined results
4. **Export Settings**: Save your configuration for reuse
5. **Export Results**: Export results for further processing

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
