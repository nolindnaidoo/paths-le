# Paths-LE Visual Documentation

## Overview

This document catalogs all visual assets for Paths-LE, including screenshots, GIFs, and diagrams used in documentation and marketplace listings.

**Current Status:** ✅ Core assets available (icon.png)

---

## Required Screenshots

### 1. Command Palette

**Status:** 📅 Planned  
**File:** `src/assets/images/command-palette.png`  
**Priority:** HIGH

**Captures:**

- Open Command Palette (Cmd/Ctrl+Shift+P)
- Type "Paths-LE" showing all commands:
  - Paths-LE: Extract Paths
  - Paths-LE: Post-Process: Validate
  - Paths-LE: Post-Process: Analyze
  - Paths-LE: Open Settings
  - Paths-LE: Help
  - Paths-LE: Settings (Export/Import/Reset)
- Show keyboard shortcut (Ctrl+Alt+P / Cmd+Alt+P)

**Usage:** README.md, marketplace listing

---

### 2. Settings Panel

**Status:** 📅 Planned  
**File:** `src/assets/images/settings-panel.png`  
**Priority:** HIGH

**Captures:**

- Open Settings UI (Cmd/Ctrl+,)
- Search for "paths-le"
- Show visible settings:
  - Copy to Clipboard Enabled
  - Dedupe Enabled
  - Open Results Side by Side
  - Status Bar: Enabled
  - Validation: Enabled / Check Existence / Check Permissions
  - Analysis: Enabled / Include Validation / Include Patterns
  - Safety: Enabled / thresholds
  - Notifications Level
  - Performance settings
  - Keyboard shortcuts
  - Presets

**Usage:** CONFIGURATION.md, marketplace listing

---

### 3. Extraction Animation

**Status:** 📅 Planned  
**File:** `src/assets/images/extraction-demo.gif`  
**Priority:** HIGH

**Captures:**

- Open config file with file paths (e.g., webpack.config.js)
- Run "Paths-LE: Extract Paths" (show keyboard shortcut)
- Show paths appearing in split view
- Highlight extraction complete notification
- Show count in status bar

**Duration:** 10-15 seconds  
**Format:** Optimized GIF (<5MB)

**Usage:** README.md quick start section

---

### 4. Extraction Results Side-by-Side

**Status:** 📅 Planned  
**File:** `src/assets/images/results-side-by-side.png`  
**Priority:** HIGH

**Captures:**

- Open config file with paths (left pane)
- Extracted paths in new editor (right pane)
- Enable "Open Results Side by Side" setting
- Highlight split view layout

**Usage:** README.md, marketplace listing

---

### 5. Validation Results

**Status:** 📅 Planned  
**File:** `src/assets/images/validation-results.png`  
**Priority:** HIGH

**Captures:**

- Run "Paths-LE: Post-Process: Validate"
- Show validation output:
  - Total paths validated
  - Valid paths (✓)
  - Broken paths (✗)
  - Permission issues (⚠)
  - List of issues with details

**Usage:** README.md features, marketplace listing

---

### 6. Analysis Results

**Status:** 📅 Planned  
**File:** `src/assets/images/analysis-results.png`  
**Priority:** MEDIUM

**Captures:**

- Run "Paths-LE: Post-Process: Analyze"
- Show analysis output:
  - Total paths analyzed
  - Unique directories count
  - Path depth analysis (min/max/average)
  - Directory patterns
  - Naming conventions compliance
  - File type distribution

**Usage:** README.md, COMMANDS.md

---

### 7. Status Bar States

**Status:** 📅 Planned  
**File:** `src/assets/images/status-bar.png`  
**Priority:** MEDIUM

**Captures:**

- Composite showing status bar variants:
  - Idle: `$(file-directory) Paths-LE`
  - Extracting: `$(sync~spin) Extracting...`
  - Success: `$(check) 42 paths`
  - Warning: `$(warning) 3 broken`
  - Failed: `$(x) Failed`
- Hover tooltips for each state

**Usage:** STATUSBAR.md, README.md

---

### 8. Notifications

**Status:** 📅 Planned  
**File:** `src/assets/images/notifications.png`  
**Priority:** MEDIUM

**Captures:**

- Composite image showing notification types:
  - Info: "42 paths extracted"
  - Success: "Validation complete: all paths valid"
  - Warning: "Large file detected..."
  - Error: "No active editor"
  - Validation warning: "3 broken paths found"

**Usage:** NOTIFICATIONS.md

---

### 9. Context Menu Integration

**Status:** 📅 Planned  
**File:** `src/assets/images/context-menu.png`  
**Priority:** LOW

**Captures:**

- Right-click in editor with supported file type
- Show "Paths-LE: Extract Paths" in context menu
- Highlight the menu item

**Usage:** README.md, marketplace listing

---

### 10. Large Output Prompt

**Status:** 📅 Planned  
**File:** `src/assets/images/large-output-prompt.png`  
**Priority:** LOW

**Captures:**

- Extract from file producing >50,000 paths
- Modal dialog:
  - Title: "Large Output Detected"
  - Message: explaining threshold
  - Buttons: "Open in Editor", "Copy to Clipboard", "Cancel"

**Usage:** PERFORMANCE.md, safety documentation

---

### 11. Permission Validation

**Status:** 📅 Planned  
**File:** `src/assets/images/permission-validation.png`  
**Priority:** MEDIUM

**Captures:**

- Validation results showing permission issues:
  - Read-only paths
  - Write-protected paths
  - Inaccessible paths
  - Permission details per path

**Usage:** README.md features, COMMANDS.md

---

### 12. Preset Modes

**Status:** 📅 Planned  
**File:** `src/assets/images/preset-modes.png`  
**Priority:** LOW

**Captures:**

- Settings showing preset dropdown:
  - Minimal
  - Balanced
  - Comprehensive
  - Performance
  - Validation
- Highlight selected preset and its enabled features

**Usage:** CONFIGURATION.md

---

## Screenshot Guidelines

### Technical Requirements

**Resolution:**

- Minimum 1440px wide
- 2x retina for marketplace (2880px)
- Consistent across all screenshots

**Format:**

- PNG for static images
- GIF for animations
- Optimize with ImageOptim or similar

**Color & Theme:**

- Use popular dark theme (One Dark Pro, Dracula)
- Ensure text is readable
- Match VS Code's native UI

### Composition

**Framing:**

- Clean workspace (close unnecessary panels)
- Show context (file explorer when relevant)
- Focus on the feature
- Minimal distractions

**Annotations:**

- Add arrows/highlights only when necessary
- Use subtle colors that match theme
- Keep annotations minimal

**Consistency:**

- Same theme across all screenshots
- Same font size (14-16px)
- Same window size ratio

### Sample Data

Create realistic sample files in `sample/`:

- `sample-config.json` - JSON with various path formats
- `sample-webpack.js` - Webpack config with paths
- `sample-package.json` - package.json with file references
- `sample-paths.log` - Log file with file paths
- `sample-tsconfig.json` - TypeScript config with paths

---

## Recording GIFs

### Tools

- **macOS:** Gifski, Kap
- **Windows:** ScreenToGif
- **Linux:** Peek, SimpleScreenRecorder + Gifski

### Settings

- Frame rate: 15-20 fps (balance quality/size)
- Duration: 10-15 seconds maximum
- Resolution: 1440px wide minimum
- File size: <5MB (optimize aggressively)

### Process

1. Set up clean VS Code window
2. Prepare sample file
3. Start recording
4. Perform action slowly and deliberately
5. Stop recording
6. Optimize with Gifski: `gifski --fps 15 --quality 90 input.mp4 -o output.gif`

---

## Placeholder Status

Until screenshots are captured, use these placeholders in documentation:

```markdown
![Command Palette](../src/assets/images/command-palette.png)

<!-- Placeholder: Screenshot pending for v1.1.0 -->
```

Or reference existing icon:

```markdown
![Paths-LE Icon](../src/assets/images/icon.png)
```

---

## Marketplace Listing Requirements

**Primary screenshot (required):**

- Feature showcase or extraction demo
- 1280x800px minimum
- Shows core value proposition

**Additional screenshots (recommended 3-5):**

1. Extraction demo with side-by-side view
2. Validation results
3. Analysis output
4. Settings panel
5. Context menu integration

**Banner (optional):**

- 1280x640px
- Brand colors and logo
- Clear tagline

---

## Update Schedule

**v1.0.x:** English documentation complete, screenshots pending  
**v1.1.0:** Priority HIGH screenshots captured  
**v1.2.0:** All screenshots captured and integrated

---

**Next Steps:**

1. Create sample data files in `sample/`
2. Set up recording environment
3. Capture priority HIGH screenshots first
4. Optimize and commit to repository
5. Update documentation with real screenshots

---

**Project:** [Issues](https://github.com/nolindnaidoo/paths-le/issues) • [Pull Requests](https://github.com/nolindnaidoo/paths-le/pulls) • [Releases](https://github.com/nolindnaidoo/paths-le/releases) • [MIT License](LICENSE)

**Dev:** [Spec](SPECIFICATION.md) • [Architecture](ARCHITECTURE.md) • [Development](DEVELOPMENT.md) • [Testing](TESTING.md)

**Docs:** [Commands](COMMANDS.md) • [Notifications](NOTIFICATIONS.md) • [Config](CONFIGURATION.md) • [Performance](PERFORMANCE.md) • [Privacy](PRIVACY.md)
