# Paths-LE Notification System

## Overview

Paths-LE uses a smart notification system that respects your workflow. By default, it runs silently, only showing notifications when something truly needs your attention.

## Notification levels

Configure via `paths-le.notificationsLevel`:

### `silent` (default)

Zero notification spam. The extension works quietly in the background:

- ✅ Status bar updates still show
- ✅ Clipboard operations happen silently
- ❌ No toast notifications
- ❌ No success/info messages

**Best for:** Developers who know the extension well and don't want interruptions.

### `important`

Shows only critical notifications:

- ✅ Safety warnings (large files, large outputs)
- ✅ Error messages (parse failures, invalid files)
- ✅ Validation failures (broken paths, permission errors)
- ❌ Success messages
- ❌ Info messages

**Best for:** Most users. Get alerted to problems without noise.

### `all`

Shows every notification:

- ✅ Success messages ("42 paths extracted")
- ✅ Info messages ("15 broken paths found")
- ✅ Safety warnings
- ✅ Error messages
- ✅ Parse error details (if `showParseErrors` enabled)
- ✅ Validation results

**Best for:** Debugging, learning the extension, or just wanting feedback.

---

## Notification types

### ✅ Success notifications

**Level:** `all` only

Confirm successful operations:

```
✓ Extracted 42 paths - copied to clipboard
✓ Validated 35 paths (32 valid, 3 broken)
✓ Analysis complete: 8 unique directories
```

**Purpose:** Positive feedback that operation completed.

### ℹ️ Info notifications

**Level:** `all` only

Provide context or tips:

```
ℹ Found 15 relative paths. Set a base directory for validation.
ℹ 5 paths point to missing files/directories
ℹ No paths found in the file
```

**Purpose:** Help users understand edge cases or behavior.

### ⚠️ Warning notifications

**Level:** `important` and `all`

Alert to potential issues before they become problems:

```
⚠ Large file detected (15 MB). Processing may take longer.
⚠ Large output detected (75,000 paths). Opening may be slow.
⚠ Many documents already open (10). Consider closing some.
⚠ 23 paths have permission issues
```

**Purpose:** Give users a chance to cancel or adjust before continuing.

**User actions:**

- Proceed anyway (operation continues)
- Cancel (operation aborts)
- Adjust settings (open settings panel)

### ❌ Error notifications

**Level:** `important` and `all`

Report failures that prevent operation completion:

```
✗ No active editor
✗ Failed to parse file: Invalid JSON syntax
✗ Document is no longer valid
✗ Operation canceled by user
✗ Cannot read file permissions (requires elevated access)
```

**Purpose:** Explain why something didn't work.

**User actions:**

- Fix the problem (edit file, open editor)
- Check documentation (link to help)
- Report issue (GitHub link)

---

## Configuration examples

### Minimal setup (silent workflow)

```json
{
  "paths-le.notificationsLevel": "silent",
  "paths-le.statusBar.enabled": true,
  "paths-le.copyToClipboardEnabled": true
}
```

Result: Work flows through status bar and clipboard, no notifications.

### Balanced setup (recommended)

```json
{
  "paths-le.notificationsLevel": "important",
  "paths-le.safety.enabled": true,
  "paths-le.showParseErrors": true
}
```

Result: Get warned about problems, stay informed about safety issues.

### Verbose setup (maximum feedback)

```json
{
  "paths-le.notificationsLevel": "all",
  "paths-le.showParseErrors": true,
  "paths-le.telemetryEnabled": true
}
```

Result: See everything, great for debugging or learning.

---

## Parse error notifications

Controlled separately via `paths-le.showParseErrors`:

```
✗ Parse error at line 15: Unexpected token }
✗ YAML parse error: Duplicate key 'paths'
✗ CSV parse error: Unclosed quote on line 42
```

**When enabled:**

- Shows specific syntax errors with line numbers
- Helps debug malformed files
- Works with all notification levels

**When disabled:**

- Parse errors are logged to Output panel only
- Less noise, still accessible for debugging

---

## Validation notifications

**Validation results** (Level: `important` and `all`):

```
⚠️ Validation: 3 of 42 paths are broken
ℹ️ Validation: All 28 paths exist and are accessible
⚠️ Validation: 5 paths have permission errors
```

**Analysis insights** (Level: `all` only):

```
ℹ️ Analysis: Found 8 unique directory patterns
ℹ️ Analysis: Max path depth: 7 levels
ℹ️ Analysis: 12 paths violate naming conventions
```

---

## Status bar indicators

**Always visible** regardless of notification level:

```
$(file-directory) Paths-LE
$(check) 42 paths extracted
$(warning) 3 broken paths
```

- Click to run extract command
- Tooltip shows current results
- Temporary success indicator (3 seconds)

---

## Best practices

### Development workflow

Start verbose, dial down as you learn:

1. **Week 1:** `"notificationsLevel": "all"` - Learn all features
2. **Week 2:** `"notificationsLevel": "important"` - Keep safety net
3. **Week 3+:** `"notificationsLevel": "silent"` - Master mode

### Team environments

Recommend `important` level for consistency:

- New team members get helpful warnings
- Experienced users aren't overwhelmed
- Safety checks still protect everyone
- Validation issues are immediately visible

### CI/automation

Use `silent` to avoid log spam:

```bash
# VS Code CLI with Paths-LE
code --user-data-dir=/tmp/vscode-test \
     --settings '{"paths-le.notificationsLevel": "silent"}'
```

---

## Troubleshooting notifications

### I'm not seeing any notifications

Check your notification level:

```json
{
  "paths-le.notificationsLevel": "silent"
}
```

Change to `"important"` or `"all"` to see messages.

### Too many notifications

Reduce verbosity:

```json
{
  "paths-le.notificationsLevel": "important",
  "paths-le.showParseErrors": false
}
```

### Missing validation warnings

Enable validation notifications:

```json
{
  "paths-le.validation.enabled": true,
  "paths-le.notificationsLevel": "important"
}
```

Check Output panel → "Paths-LE" for full logs.

### Notification timing issues

Some notifications are modal (block workflow):

- Safety warnings before large operations
- Validation confirmation dialogs
- Permission error prompts

Others are toast (auto-dismiss):

- Success messages
- Info tips
- Validation summaries

Configure thresholds to control when modals appear:

```json
{
  "paths-le.safety.fileSizeWarnBytes": 5000000, // 5MB threshold
  "paths-le.safety.largeOutputLinesThreshold": 100000 // 100K lines
}
```

---

## Output panel logging

**Always available** regardless of notification settings:

Open: View → Output → Select "Paths-LE" from dropdown

Logs include:

- All notifications (even in silent mode)
- Performance metrics
- Error stack traces
- Validation details
- Telemetry events (if enabled)

Enable detailed logging:

```json
{
  "paths-le.telemetryEnabled": true
}
```

---

## Accessibility

All notifications support:

- Screen readers (ARIA labels)
- High contrast themes
- Keyboard navigation

Toast notifications dismiss after 5 seconds or on click.
Modal dialogs require explicit user action.

---

**Current behavior:** Silent by default, configurable to three levels  
**Philosophy:** Respectful of your workflow, informative when needed

---

**Project:** [Issues](https://github.com/nolindnaidoo/paths-le/issues) • [Pull Requests](https://github.com/nolindnaidoo/paths-le/pulls) • [Releases](https://github.com/nolindnaidoo/paths-le/releases) • [MIT License](LICENSE)

**Dev:** [Spec](SPECIFICATION.md) • [Architecture](ARCHITECTURE.md) • [Development](DEVELOPMENT.md) • [Testing](TESTING.md)

**Docs:** [Commands](COMMANDS.md) • [Notifications](NOTIFICATIONS.md) • [Config](CONFIGURATION.md) • [Performance](PERFORMANCE.md) • [Privacy](PRIVACY.md)
