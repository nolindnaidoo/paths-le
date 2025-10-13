# Paths-LE Configuration

## Overview

Paths-LE provides comprehensive configuration options to customize behavior, performance, and user experience. All settings are designed with developer empathy in mind, providing sensible defaults while allowing extensive customization.

## Configuration Categories

### 1. Basic Settings

#### `paths-le.copyToClipboardEnabled`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Automatically copy extracted paths to clipboard
- **Impact**: Improves workflow efficiency for quick path access

#### `paths-le.dedupeEnabled`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Remove duplicate paths from extraction results
- **Impact**: Reduces clutter in results, improves readability

#### `paths-le.notificationsLevel`

- **Type**: `string`
- **Default**: `"silent"`
- **Options**: `"all"`, `"important"`, `"silent"`
- **Description**: Control notification verbosity
- **Impact**: Balances user feedback with distraction

#### `paths-le.postProcess.openInNewFile`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Open analysis results in a new file
- **Impact**: Preserves original file while showing results

#### `paths-le.openResultsSideBySide`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Open results side-by-side with original file
- **Impact**: Enables comparison between original and results

### 2. Safety Settings

#### `paths-le.safety.enabled`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable safety checks and warnings
- **Impact**: Prevents accidental processing of large files

#### `paths-le.safety.fileSizeWarnBytes`

- **Type**: `number`
- **Default**: `1000000` (1MB)
- **Minimum**: `1000`
- **Description**: File size threshold for warnings (in bytes)
- **Impact**: Prevents memory issues with large files

#### `paths-le.safety.largeOutputLinesThreshold`

- **Type**: `number`
- **Default**: `50000`
- **Minimum**: `100`
- **Description**: Output size threshold for warnings (in lines)
- **Impact**: Prevents UI issues with large outputs

#### `paths-le.safety.manyDocumentsThreshold`

- **Type**: `number`
- **Default**: `8`
- **Minimum**: `1`
- **Description**: Maximum number of documents to open simultaneously
- **Impact**: Prevents VS Code performance issues

### 3. Analysis Settings

#### `paths-le.analysis.enabled`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable path analysis features
- **Impact**: Provides detailed insights into path patterns

#### `paths-le.analysis.includePatterns`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Include pattern recognition in analysis
- **Impact**: Identifies common path patterns and conventions

#### `paths-le.analysis.includeValidation`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Include validation analysis in reports
- **Impact**: Identifies invalid or broken paths

#### `paths-le.analysis.includePermissions`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Include permission analysis in reports
- **Impact**: Analyzes file and directory permissions

### 4. Validation Settings

#### `paths-le.validation.enabled`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable path validation features
- **Impact**: Checks path existence and accessibility

#### `paths-le.validation.checkExistence`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Check if paths exist in file system
- **Impact**: Identifies broken or missing paths

#### `paths-le.validation.checkPermissions`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Check file and directory permissions
- **Impact**: Identifies permission issues

#### `paths-le.validation.checkAccessibility`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Check path accessibility
- **Impact**: Identifies inaccessible paths

#### `paths-le.validation.timeout`

- **Type**: `number`
- **Default**: `5000`
- **Minimum**: `1000`
- **Description**: Validation timeout in milliseconds
- **Impact**: Prevents hanging on slow file systems

### 5. Performance Settings

#### `paths-le.performance.enabled`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable performance monitoring and optimization
- **Impact**: Tracks performance metrics and optimizes operations

#### `paths-le.performance.maxDuration`

- **Type**: `number`
- **Default**: `5000`
- **Minimum**: `1000`
- **Description**: Maximum processing duration in milliseconds
- **Impact**: Prevents long-running operations

#### `paths-le.performance.maxMemoryUsage`

- **Type**: `number`
- **Default**: `104857600` (100MB)
- **Minimum**: `1048576` (1MB)
- **Description**: Maximum memory usage in bytes
- **Impact**: Prevents memory exhaustion

#### `paths-le.performance.maxCpuUsage`

- **Type**: `number`
- **Default**: `1000000`
- **Minimum**: `100000`
- **Description**: Maximum CPU usage in milliseconds
- **Impact**: Prevents CPU-intensive operations

#### `paths-le.performance.minThroughput`

- **Type**: `number`
- **Default**: `1000`
- **Minimum**: `100`
- **Description**: Minimum throughput in paths per second
- **Impact**: Ensures acceptable processing speed

#### `paths-le.performance.maxCacheSize`

- **Type**: `number`
- **Default**: `1000`
- **Minimum**: `100`
- **Description**: Maximum cache size in entries
- **Impact**: Controls memory usage for caching

### 6. User Interface Settings

#### `paths-le.statusBar.enabled`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Show status bar entry
- **Impact**: Provides quick access to extension features

#### `paths-le.showParseErrors`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Show parsing errors in output
- **Impact**: Helps debug extraction issues

#### `paths-le.telemetryEnabled`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable telemetry and usage tracking
- **Impact**: Helps improve extension through usage data

## Configuration Management

### Settings Access

- **VS Code Settings UI**: Extensions → Paths-LE
- **Command Palette**: `Paths-LE: Open Settings`
- **Settings JSON**: Direct editing of `settings.json`

### Configuration Hierarchy

1. **User Settings**: Global user preferences
2. **Workspace Settings**: Project-specific preferences
3. **Folder Settings**: Folder-specific preferences
4. **Default Settings**: Extension defaults

### Settings Validation

- **Type Checking**: Automatic type validation
- **Range Validation**: Min/max value enforcement
- **Dependency Checking**: Cross-setting validation
- **Error Reporting**: Clear error messages for invalid settings

## Performance Impact

### High Impact Settings

- **Safety Settings**: Directly affect processing limits
- **Performance Settings**: Control resource usage
- **Analysis Settings**: Affect processing complexity

### Medium Impact Settings

- **Validation Settings**: Impact validation performance
- **UI Settings**: Affect user experience
- **Basic Settings**: Minor performance impact

### Low Impact Settings

- **Telemetry Settings**: Minimal performance impact
- **Display Settings**: UI-only changes

## Best Practices

### Performance Optimization

- **Enable Performance Monitoring**: Track performance metrics
- **Set Appropriate Limits**: Balance functionality with performance
- **Use Caching**: Enable caching for repeated operations
- **Monitor Memory Usage**: Watch memory consumption

### Safety Configuration

- **Enable Safety Checks**: Prevent processing issues
- **Set Reasonable Limits**: Balance functionality with safety
- **Use Warnings**: Get notified of potential issues
- **Monitor File Sizes**: Prevent memory problems

### User Experience

- **Customize Notifications**: Balance feedback with distraction
- **Configure UI Elements**: Customize interface elements
- **Set Workflow Preferences**: Optimize for your workflow
- **Enable Helpful Features**: Use features that improve productivity

## Troubleshooting

### Common Configuration Issues

- **Invalid Values**: Check setting types and ranges
- **Conflicting Settings**: Review setting dependencies
- **Performance Issues**: Adjust performance settings
- **Memory Problems**: Increase memory limits

### Configuration Reset

- **Reset to Defaults**: Restore default settings
- **Clear Cache**: Clear extension cache
- **Restart Extension**: Reload extension
- **Restart VS Code**: Full restart if needed

### Getting Help

- **Check Documentation**: Review configuration guide
- **Use Help Command**: Run `Paths-LE: Help`
- **Report Issues**: Submit bug reports
- **Community Support**: Seek community help

## Advanced Configuration

### Custom Validation Rules

- **Pattern Matching**: Define custom path patterns
- **Validation Logic**: Implement custom validation
- **Error Handling**: Customize error responses
- **Recovery Actions**: Define recovery strategies

### Integration Settings

- **File System Integration**: Configure file system access
- **Workspace Integration**: Set workspace preferences
- **Extension Integration**: Configure extension interactions
- **External Tool Integration**: Set up external tool usage

### Development Settings

- **Debug Mode**: Enable debug logging
- **Development Features**: Enable development tools
- **Testing Configuration**: Set up testing preferences
- **Performance Profiling**: Enable performance profiling

---

This configuration guide provides comprehensive information about all Paths-LE settings, helping users optimize the extension for their specific needs while maintaining performance and reliability.
