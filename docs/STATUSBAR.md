# Paths-LE Status Bar Guide

This document describes the Status Bar integration, states, and interaction patterns for Paths-LE.

## Status Bar Overview

The Paths-LE Status Bar item provides:

- Quick access to path extraction commands
- Real-time operation progress feedback
- At-a-glance validation status
- Minimal UI footprint

**Location:** Bottom Status Bar (left side)

**Visibility:** Configurable via `paths-le.statusBar.enabled`

## Status Bar States

### Idle State

**Display:**

```
$(file-directory) Paths-LE
```

**Icon:** File directory icon indicates path management functionality

**Tooltip:** "Click to extract paths"

**Interaction:**

- Click: Runs "Paths-LE: Extract Paths" command
- Equivalent to keyboard shortcut `Cmd/Ctrl+Alt+P`
- Opens active editor for path extraction

**When shown:**

- Extension activated
- No operation currently running
- Default idle state

### Extracting State

**Display:**

```
$(sync~spin) Extracting...
```

**Icon:** Animated spinning sync icon

**Tooltip:** "Extracting paths from current file"

**Interaction:**

- Click: No action (extraction in progress)
- Progress cannot be cancelled from Status Bar
- Use Output channel to monitor detailed progress

**When shown:**

- Parsing file content
- Finding path patterns
- Processing large files

**Duration:** 100ms-5s typically (depends on file size)

### Success State

**Display:**

```
$(check) 42 paths
```

**Icon:** Checkmark indicates successful extraction

**Tooltip:**

```
Successfully extracted 42 paths
Duration: 1.2s
Click to extract again
```

**Interaction:**

- Click: Runs extraction again on active editor
- Shows count for last extraction
- Hover for full details

**When shown:**

- After successful path extraction
- Validation complete (if enabled)
- No critical errors

**Persistence:** Remains until next extraction or 30s timeout

### Validation Warning State

**Display:**

```
$(warning) 3 broken
```

**Icon:** Warning triangle indicates validation issues

**Tooltip:**

```
Found 3 broken paths (out of 42 total)
5 paths have permission issues
Click for validation details
```

**Interaction:**

- Click: Opens Output channel with validation report
- Shows count of broken paths
- Full details available in Output channel

**When shown:**

- Validation enabled and found issues
- Permission errors detected
- Inaccessible paths found

**Persistence:** Remains until next extraction or manually clicked

### Failed State

**Display:**

```
$(x) Failed
```

**Icon:** X indicates extraction failure

**Tooltip:**

```
Extraction failed
Reason: Parse error at line 42
Click for details in Output channel
```

**Interaction:**

- Click: Opens Output channel with error details
- Shows brief error reason
- Full details available in Output channel

**When shown:**

- Parse errors
- Invalid file format
- No active editor
- Permission errors

**Persistence:** Remains until next extraction attempt

## Configuration

### Enable/Disable Status Bar

**Via Settings UI:**

1. Open Settings (`Cmd/Ctrl + ,`)
2. Search "paths-le status bar"
3. Toggle "Paths-le: Statusbar › Enabled"

**Via settings.json:**

```json
{
  "paths-le.statusBar.enabled": true // default
}
```

**To hide:**

```json
{
  "paths-le.statusBar.enabled": false
}
```

**Note:** Disabling hides the Status Bar item but does not affect extension functionality.

### Status Bar Priority

**Default priority:** `100` (standard extension priority)

**Relative position:**

- Left side of Status Bar
- Near other extension indicators
- Customizable position by dragging (VS Code 1.60+)

## Status Bar Behavior

### Automatic Updates

Status Bar updates automatically during:

- Extraction initiation
- File parsing
- Path validation
- Analysis completion
- Error occurrence

**Update frequency:** Real-time (no polling)

### State Transitions

**Normal flow:**

```
Idle → Extracting → Success → Idle (after 30s)
```

**Validation warning flow:**

```
Idle → Extracting → Validation Warning → Idle (after click)
```

**Error flow:**

```
Idle → Extracting → Failed → Idle (after click)
```

### Multiple Extractions

**Behavior:**

- Only one extraction runs at a time
- Subsequent extractions queue automatically
- Status Bar shows current extraction only

**Example sequence:**

```
File 1: Extracting... → Success (42 paths)
File 2: Extracting... → Warning (3 broken)
File 3: Extracting... → Failed (parse error)
```

## Integration with Other Features

### Output Channel

**When Status Bar shows "Extracting...":**

- Output channel shows detailed progress
- View → Output → "Paths-LE"

**Example Output:**

```
[10:30:15] Extraction started: config.json
[10:30:16] Found 42 path patterns
[10:30:17] Validating paths...
[10:30:18] Validation: 39 valid, 3 broken
[10:30:18] Extraction complete (3.2s)
```

### Notifications

**Notification levels affect Status Bar:**

- `"all"`: Status Bar + notifications for each step
- `"important"`: Status Bar + error/warning notifications
- `"silent"`: Status Bar only (no popup notifications)

**Status Bar always updates** regardless of notification level.

### Commands

**Status Bar triggers commands:**

- Idle click: `paths-le.extractPaths`
- Failed/Warning click: Opens Output channel

**Commands update Status Bar:**

- `paths-le.extractPaths`: Triggers Extracting state
- `paths-le.postProcess.validate`: Triggers Validation state
- `paths-le.postProcess.analyze`: Triggers Analysis state

## Status Bar Use Cases

### Quick Path Extraction

**Workflow:**

1. Open file with paths
2. Click Status Bar item
3. Watch for state change
4. Success: Paths ready in editor/clipboard
5. Warning: Click for validation details

**Benefit:** Minimal workflow interruption

### Continuous Validation

**Workflow:**

1. Extract paths from multiple config files
2. Glance at Status Bar for validation status
3. Detailed review in Output channel
4. Fix broken paths
5. Re-extract to verify

**Benefit:** Stay in flow while validating multiple files

### Visual Progress Indicator

**Workflow:**

1. Start extraction
2. Monitor spinning icon
3. Switch to other tasks
4. Check back when icon changes

**Benefit:** Non-blocking progress awareness

### Error Detection

**Workflow:**

1. Extraction fails
2. Status Bar shows Failed state
3. Click for error details
4. Adjust file/settings
5. Retry

**Benefit:** Quick error awareness and diagnosis

## Status Bar Icons Reference

| Icon                | State              | Meaning               | Action                 |
| ------------------- | ------------------ | --------------------- | ---------------------- |
| `$(file-directory)` | Idle               | Ready to extract      | Click to start         |
| `$(sync~spin)`      | Extracting         | Operation in progress | Wait                   |
| `$(check)`          | Success            | Extraction succeeded  | Click to extract again |
| `$(warning)`        | Validation Warning | Some paths broken     | Click for details      |
| `$(x)`              | Failed             | Extraction failed     | Click for details      |

**Icon library:** [Codicons](https://microsoft.github.io/vscode-codicons/dist/codicon.html)

## Troubleshooting Status Bar

### Status Bar not visible

**Check if enabled:**

```json
{
  "paths-le.statusBar.enabled": true
}
```

**Reload VS Code:**

- `Cmd/Ctrl+Shift+P` → "Developer: Reload Window"

**Check Status Bar visibility:**

- Ensure Status Bar is not hidden globally
- View → Appearance → Show Status Bar

### Status Bar stuck in "Extracting..." state

**Causes:**

- Extension error
- Very large file
- Infinite regex loop (unlikely with current patterns)

**Solutions:**

1. Wait for timeout (check `paths-le.safety.fileSizeWarnBytes`)
2. Reload VS Code window
3. Check Output channel for errors
4. Report bug if persistent

### Status Bar not updating

**Check Output channel:**

- May show progress even if Status Bar frozen
- View → Output → "Paths-LE"

**Reload extension:**

- Disable and re-enable Paths-LE
- Or reload VS Code window

### Click not working

**Verify state:**

- Clicking during "Extracting..." does nothing (expected)
- Only "Idle" and "Failed/Warning" states respond to clicks

**Check keybinding conflicts:**

- Status Bar click may conflict with other extensions
- Try command directly: `Cmd/Ctrl+Alt+P`

## Customization

### Hide Status Bar for specific workspaces

**Workspace settings** (`.vscode/settings.json`):

```json
{
  "paths-le.statusBar.enabled": false
}
```

### Minimize distraction

**Silent notifications + Status Bar only:**

```json
{
  "paths-le.notificationsLevel": "silent",
  "paths-le.statusBar.enabled": true
}
```

### Full UI experience

**All notifications + Status Bar:**

```json
{
  "paths-le.notificationsLevel": "all",
  "paths-le.statusBar.enabled": true,
  "paths-le.validation.enabled": true
}
```

## Related Documentation

- [Notifications Guide](NOTIFICATIONS.md) - Notification levels and behavior
- [Commands Guide](COMMANDS.md) - Available commands
- [Configuration Guide](CONFIGURATION.md) - Settings reference

---

**Project:** [Issues](https://github.com/nolindnaidoo/paths-le/issues) • [Pull Requests](https://github.com/nolindnaidoo/paths-le/pulls) • [Releases](https://github.com/nolindnaidoo/paths-le/releases) • [MIT License](LICENSE)

**Dev:** [Spec](SPECIFICATION.md) • [Architecture](ARCHITECTURE.md) • [Development](DEVELOPMENT.md) • [Testing](TESTING.md)

**Docs:** [Commands](COMMANDS.md) • [Notifications](NOTIFICATIONS.md) • [Config](CONFIGURATION.md) • [Performance](PERFORMANCE.md) • [Privacy](PRIVACY.md)
