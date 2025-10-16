<p align="center">
  <img src="src/assets/images/icon.png" alt="Paths-LE Logo" width="96" height="96"/>
</p>
<h1 align="center">Paths-LE: Zero Hassle Path Extraction</h1>
<p align="center">
  <b>Instantly extract and analyze file paths from your codebase with precision</b><br/>
  <i>JavaScript, TypeScript, JSON, HTML, CSS, TOML, CSV, and Environment files</i>
  <br/>
  <i>Designed for configuration management, dependency analysis, and path validation.</i>
</p>

<p align="center">
  <!-- VS Code Marketplace -->
  <a href="https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le">
    <img src="https://img.shields.io/visual-studio-marketplace/v/nolindnaidoo.paths-le" alt="VSCode Marketplace Version" />
  </a>
  <!-- Open VSX -->
  <a href="https://open-vsx.org/extension/nolindnaidoo/paths-le">
    <img src="https://img.shields.io/open-vsx/v/nolindnaidoo/paths-le" alt="Open VSX Version" />
  </a>
  <!-- Build -->
  <a href="https://github.com/nolindnaidoo/paths-le/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/nolindnaidoo/paths-le/ci.yml?branch=main" alt="Build Status" />
  </a>
  <!-- License -->
  <a href="https://github.com/nolindnaidoo/paths-le/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/nolindnaidoo/paths-le" alt="MIT License" />
  </a>
</p>

<p align="center">
  <i>Tested on <b>Ubuntu</b>, <b>macOS</b>, and <b>Windows</b> for maximum compatibility.</i>
</p>

---

<p align="center">
  <img src="src/assets/images/demo.gif" alt="Paths-LE Demo" style="max-width: 100%; height: auto;" />
</p>

<p align="center">
  <img src="src/assets/images/command-palette.png" alt="Command Palette" style="max-width: 80%; height: auto;" />
</p>

## 🙏 Thank You

If Paths-LE saves you time, a quick rating helps other developers discover it:  
⭐ [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le) • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/paths-le)

## ✅ Why Paths-LE?

Extract file paths from **any file format** — JavaScript, TypeScript, HTML, CSS, JSON, TOML — in one click. Find imports, assets, and references instantly.

Paths-LE intelligently detects file paths in multiple formats (absolute, relative, Windows, Unix) while filtering out URLs and package names. Get comprehensive dependency insights without manual searching.

- **Complete path detection**

  Automatically finds file paths in multiple formats: absolute paths, relative paths, Windows paths, and Unix paths.

- **Powerful post-processing**

  Deduplicate paths and sort with multiple modes (alphabetically or by length) for cleaner analysis results.

- **Interactive sorting options**

  Sort paths alphabetically (A→Z/Z→A) or by length (short→long/long→short) with user-friendly selection.

- **Dependency analysis support**

  Perfect for analyzing imports, exports, and file references to identify missing files and circular dependencies.

- **Comprehensive file format support**

  Works with JavaScript, TypeScript, JSON, HTML, CSS, TOML, CSV, and Environment files using proven parsing libraries for reliable extraction.

- **Smart path detection**

  Intelligently filters package imports (like 'react' or 'lodash') from actual file paths in JavaScript/TypeScript.

- **Cross-platform compatibility**

  Handles both Windows and Unix path formats with intelligent normalization and validation.

- **Canonical path resolution** 🆕 ⚠️

  Full monorepo and symlink support for enterprise development workflows. Resolves symlinks to canonical paths and handles workspace-relative paths across VS Code multi-root workspaces. Perfect for complex monorepo structures with cross-package references. **Security Note**: Disabled by default as it may expose sensitive file system paths.

- **Multi-language support**

  Available in 13 languages: English, Chinese (Simplified), German, Spanish, French, Indonesian, Italian, Japanese, Korean, Portuguese (Brazil), Russian, Ukrainian, and Vietnamese.

## 🚀 More from the LE Family

- **[String-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.string-le)** - Extract user-visible strings for i18n and validation • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/string-le)
- **[Numbers-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.numbers-le)** - Extract and analyze numeric data with statistics • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/numbers-le)
- **[EnvSync-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.envsync-le)** - Keep .env files in sync with visual diffs • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/envsync-le)
- **[URLs-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.urls-le)** - Audit API endpoints and external resources • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/urls-le)
- **[Scrape-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.scrape-le)** - Validate scraper targets before debugging • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/scrape-le)
- **[Colors-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.colors-le)** - Extract and analyze colors from stylesheets • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/colors-le)
- **[Dates-LE](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.dates-le)** - Extract temporal data from logs and APIs • [Open VSX](https://open-vsx.org/extension/nolindnaidoo/dates-le)

## 💡 Use Cases

- **Import Analysis** - Extract local imports from JS/TS (auto-excludes npm packages)
- **Asset Auditing** - Find all images, scripts, and styles referenced in HTML/CSS
- **Config Validation** - Pull file paths from JSON/TOML configs for verification
- **Dependency Mapping** - Track file references across your codebase

### TOML & Environment Files

Extract file paths from configuration files:

```toml
# Extract from config.toml
[paths]
data_dir = "./data"
log_file = "/var/log/app.log"
backup_path = "C:\\backups\\app"
```

```bash
# Extract from .env
DATABASE_PATH=./data/app.db
LOG_FILE=/var/log/app.log
BACKUP_DIR=C:\backups
```

---

### CSV Data Analysis

Extract paths from CSV data files:

```csv
path,type,description
./src/main.js,file,Main application file
/var/log/app.log,file,Application log
C:\Users\Name\data,dir,User data directory
```

---

### Dependency Mapping & Validation

- Map file dependencies across JavaScript/TypeScript projects
- Identify missing or broken references in HTML/CSS
- Validate configuration file paths
- Analyze import patterns and detect circular dependencies

## 🚀 Quick Start

1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nolindnaidoo.paths-le) or [Open VSX](https://open-vsx.org/extension/nolindnaidoo/paths-le)
2. Open any supported file (`.js`, `.ts`, `.json`, `.html`, `.css`, `.toml`, `.csv`, `.env`)
3. Run `Paths-LE: Extract Paths` (`Cmd+Alt+P` / `Ctrl+Alt+P`)
4. Use **Deduplicate Paths** or **Sort Paths** commands for post-processing

## 📋 Available Commands

Paths-LE provides **9 commands** accessible via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

### Core Extraction

- **Extract Paths** (`Cmd/Ctrl+Alt+P`) - Extract all file paths from current document

### Post-Processing

- **Deduplicate Paths** - Remove duplicate path entries while preserving order
- **Sort Paths** - Sort extracted paths with multiple modes:
  - Alphabetical (A → Z)
  - Alphabetical (Z → A)
  - By Length (Short → Long)
  - By Length (Long → Short)

### Settings & Help

- **Open Settings** - Quick access to extension settings
- **Help & Troubleshooting** - Comprehensive in-editor documentation
- **Export/Import/Reset Settings** - Manage extension configuration
- **Create Test Fixture** - Generate a complete test environment for canonical path resolution

## ⚙️ Configuration

Paths-LE has minimal configuration to keep things simple. Most settings are available in VS Code's settings UI under "Paths-LE".

Key settings include:

- Output format preferences (side-by-side, clipboard copy)
- Safety warnings and thresholds for large files
- Notification levels (silent, important, all)
- Status bar visibility
- Local telemetry logging for debugging

For the complete list of available settings, open VS Code Settings and search for "paths-le".

## 📁 Supported File Types

Paths-LE supports **9 file types** for path extraction:

| File Type   | Extensions                    | What Gets Extracted                             |
| ----------- | ----------------------------- | ----------------------------------------------- |
| JavaScript  | `.js`, `.mjs`, `.cjs`         | `import`/`require`/`export` with local paths    |
| TypeScript  | `.ts`, `.tsx`, `.mts`, `.cts` | `import`/`require`/`export` with local paths    |
| JSON        | `.json`                       | Path-like strings (absolute, relative, URLs)    |
| HTML        | `.html`                       | `src`, `href`, `data`, `action`, `poster`, etc. |
| CSS         | `.css`, `.scss`, `.less`      | `url()` and `@import` paths                     |
| TOML        | `.toml`                       | All string values that look like paths          |
| CSV         | `.csv`                        | Path values in any column                       |
| Environment | `.env`, `.env.local`          | Path values in environment variables            |
| Log/Text    | `.log`, `.txt`                | Pre-extracted paths for analysis                |

### Smart Features

- **JavaScript/TypeScript**: Excludes npm package names—only extracts local file paths
- **HTML**: Automatically excludes `data:` and `javascript:` URLs
- **CSS**: Automatically excludes `data:` URLs
- **All types**: Handles Windows (`C:\`) and Unix (`/`) paths, plus URLs

---

## 🌍 Language Support

**13 languages**: English, German, Spanish, French, Indonesian, Italian, Japanese, Korean, Portuguese (Brazil), Russian, Ukrainian, Vietnamese, Chinese (Simplified)

## 🧩 System Requirements

**VS Code** 1.70.0+ • **Platform** Windows, macOS, Linux  
**Memory** 200MB recommended for large files

## 🔒 Privacy

100% local processing. No data leaves your machine. Optional logging: `paths-le.telemetryEnabled`

## ⚡ Performance

<!-- PERFORMANCE_START -->

Paths-LE is built for speed and handles files from 100KB to 30MB+. See [detailed benchmarks](docs/PERFORMANCE.md).

| Format   | File Size | Throughput | Duration | Memory | Tested On     |
| -------- | --------- | ---------- | -------- | ------ | ------------- |
| **HTML** | 4K lines  | 2,021,212  | ~0.33    | < 1MB  | Apple Silicon |
| **CSV**  | 0.5MB     | 541305     | ~41.52   | < 1MB  | Apple Silicon |
| **CSV**  | 3MB       | 865986     | ~155.73  | ~27MB  | Apple Silicon |
| **CSV**  | 10MB      | 933250     | ~481.72  | ~55MB  | Apple Silicon |
| **CSV**  | 30MB      | 0          | ~1307.2  | < 1MB  | Apple Silicon |
| **TOML** | 3K lines  | 105,104    | ~5.29    | < 1MB  | Apple Silicon |
| **JSON** | 0.12MB    | 898921     | ~2.78    | < 1MB  | Apple Silicon |
| **JSON** | 1.21MB    | 1253130    | ~19.97   | < 1MB  | Apple Silicon |
| **JSON** | 6.07MB    | 2211718    | ~56.58   | < 1MB  | Apple Silicon |
| **JSON** | 24.3MB    | 0          | ~253.36  | < 1MB  | Apple Silicon |

**Real-World Performance**: Tested with actual data up to 30MB (practical limit: 1MB warning, 10MB error threshold)  
**Performance Monitoring**: Built-in real-time tracking with configurable thresholds  
**Full Metrics**: [docs/PERFORMANCE.md](docs/PERFORMANCE.md) • Test Environment: macOS, Bun 1.2.22, Node 22.x

<!-- PERFORMANCE_END -->

## 🔧 Troubleshooting

**Not detecting paths?**  
Ensure file is saved with supported extension (.js, .ts, .json, .html, .css, .toml, .csv, .env)

**Large files slow?**  
Files over 10MB may take longer. Consider splitting into smaller chunks

**Need help?**  
Check [Issues](https://github.com/nolindnaidoo/paths-le/issues) or enable logging: `paths-le.telemetryEnabled: true`

## ❓ FAQ

**What paths are extracted?**  
Absolute (/usr/local), relative (./src), Windows (C:\Users), Unix (/home) paths

**JS/TS imports?**  
Auto-excludes npm packages (react, lodash) - only extracts local file paths

**Cross-platform?**  
Yes! Handles both Windows and Unix path formats automatically

**Max file size?**  
Up to 30MB. Practical limit: 10MB for optimal performance

## 📊 Testing

**217 unit tests** • **58.25% function coverage, 27.89% line coverage**  
Powered by Vitest • Run with `bun run test:coverage`

### Test Suite Breakdown

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

### Performance Benchmarks (Internal)

Real-world extraction speeds tested on **macOS (Apple Silicon)**:

- **HTML**: 1.96M paths/sec (675 lines, 0.03MB file, 667 paths extracted)
- **JSON**: 2.23M paths/sec (196K lines, 6.07MB file, 125K paths extracted)
- **CSV**: 1.01M paths/sec (89K lines, 10MB file, 449K paths extracted)
- **TOML**: 105K paths/sec (1.1K lines, 0.02MB file, 556 paths extracted)
- **JavaScript**: 914K paths/sec (268 lines, 0.01MB file, 201 paths extracted)

### Running Tests Locally

```bash
bun run test              # Run all 217 tests
bun run test:coverage     # Generate detailed coverage report
bun run test:watch        # Watch mode for development
```

Coverage reports are generated in `coverage/` directory (open `coverage/index.html` for detailed view).

### Testing Canonical Path Resolution

**For Extension Users** (easiest method):

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `Paths-LE: Create Test Fixture`
3. Select a folder where you want to create the test environment
4. Follow the prompts to open the generated test workspace

**For Developers** (from repository):

```bash
# 1. Setup test environment
cd test-fixtures/monorepo-test
./setup-symlinks.sh

# 2. Open test workspace
code workspace.code-workspace
```

**Testing the Feature:**

1. **Enable canonical resolution** in VS Code settings:

   - `Paths-le › Resolution: Resolve Symlinks` ✅
   - `Paths-le › Resolution: Resolve Workspace Relative` ✅

2. **Open test file**: `packages/frontend/src/symlink-test.js`

3. **Run extraction**: `Paths-LE: Extract Paths` (`Cmd+Alt+P`)

4. **Expected results**:
   - **Before**: `./utils-link.js` (symlink path)
   - **After**: `/full/path/to/packages/shared/src/utils.js` (resolved canonical path)

The test fixture includes a complete monorepo with symlinks, cross-package imports, and comprehensive documentation for testing all canonical path resolution features.

## 🔒 Security Considerations

### Canonical Path Resolution

**⚠️ IMPORTANT SECURITY NOTICE**: Canonical path resolution is **disabled by default** for security reasons.

**Why it's disabled:**

- May expose sensitive file system paths in extracted output
- Could reveal internal directory structures
- Might leak information about development environment setup

**When to enable:**

- ✅ Trusted development environments
- ✅ Internal monorepo workflows
- ✅ When you control the output destination
- ❌ Public repositories or shared workspaces
- ❌ When output might be shared externally

**Security Settings:**

```json
{
  "paths-le.resolution.resolveSymlinks": false, // Default: disabled
  "paths-le.resolution.resolveWorkspaceRelative": false // Default: disabled
}
```

**First-time Warning:**
When you first enable canonical resolution, Paths-LE will show a security warning dialog with options to:

- Continue with canonical resolution
- Disable and continue with standard resolution
- Learn more about security implications

---

Copyright © 2025
<a href="https://github.com/nolindnaidoo">@nolindnaidoo</a>. All rights reserved.
