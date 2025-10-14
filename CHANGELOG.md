# Changelog

All notable changes to Paths-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2025-10-14

### Documentation

- Fixed test coverage section to remove vague "comprehensive coverage" claim
- Updated to show accurate 38.74% overall coverage with 220 passing tests across 14 test suites
- Individual module coverage ranges from 66-100% with excellent extraction testing
- Aligns with honest documentation standard across the LE family

## [1.2.1] - 2025-10-13

### Fixed

- **Documentation**: Added missing multi-language support section to README highlighting 13 available languages

## [1.2.0] - 2025-10-13

### 🚀 Major Feature Release - Web Development Support

This release dramatically expands Paths-LE's capabilities with full support for modern web development workflows.

### Added

- **JavaScript/TypeScript Support** - Extract paths from modern JavaScript and TypeScript files

  - ES6 `import` statements (`import x from './path'`)
  - Dynamic imports (`import('./path')`)
  - CommonJS `require()` statements
  - ES6 `export` statements (`export * from './path'`)
  - Smart package filtering - automatically excludes npm packages like 'react', 'lodash'
  - File extensions: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`
  - 13 comprehensive tests with 93% coverage

- **JSON Support** - Recursive path extraction from JSON configuration files

  - Traverses nested objects and arrays
  - Detects path-like strings throughout JSON structure
  - Handles Windows paths (`C:\`), Unix paths (`/`), relative paths (`./`, `../`)
  - Extracts URLs (`http://`, `https://`, `file://`)
  - Context tracking shows JSON key path for each extracted path
  - 13 comprehensive tests with 97% coverage

- **HTML Support** - Comprehensive path extraction from HTML documents

  - Standard attributes: `src`, `href`, `data`, `action`, `poster`, `background`, `cite`, `formaction`
  - Responsive images: `srcset` with multiple image descriptors (e.g., `480w`, `2x`)
  - Protocol-relative URLs: `//cdn.example.com`
  - Automatic exclusion of `data:` URLs (inline SVG, base64)
  - Automatic exclusion of `javascript:` URLs
  - 22 comprehensive tests with 90% coverage

- **CSS Support** - Extract paths from stylesheets

  - `url()` function in all properties (backgrounds, fonts, cursors, etc.)
  - `@import` statements (with or without `url()`)
  - Font face declarations with multiple formats
  - Automatic exclusion of `data:` URLs
  - Smart handling to avoid double-counting `@import url()`
  - 16 comprehensive tests with 93% coverage

- **Sample Files** - Added comprehensive examples for all new formats
  - `app.js` - JavaScript with ES6 imports, require, exports, package filtering examples
  - `config-paths.json` - JSON with nested paths, arrays, Windows paths, URLs
  - `index.html` - HTML with all supported attributes, srcset, data URL examples
  - `styles.css` - CSS with url(), @import, font faces, media queries
  - Updated `sample/README.md` with detailed testing instructions for all formats

### Changed

- **Documentation** - Completely revised README

  - Updated tagline: Now highlights all 9 supported file types
  - Added detailed "Use Cases & Examples" section for each format
  - Created comprehensive "Supported File Types" table
  - Updated performance benchmarks for all formats
  - Enhanced troubleshooting with format-specific guidance
  - Added FAQ entries about JavaScript/TypeScript smart filtering
  - Updated test coverage table with accurate numbers

- **Test Suite** - Expanded from 156 to 220 tests

  - Added 64 new tests for web development formats (JavaScript: 13, JSON: 13, HTML: 22, CSS: 16)
  - All 220 tests passing with excellent coverage
  - Overall coverage: 38.74% statements, 82.98% branches, 68.75% functions
  - Core extraction modules: 90%+ coverage
  - Updated test coverage documentation

- **Internationalization** - Updated all 13 language files

  - Added translations for new file format descriptions
  - Added smart filtering messages (package filtering, data: URL filtering, javascript: URL filtering)
  - Updated extension descriptions to highlight new capabilities
  - Languages: English, Chinese (Simplified), German, Spanish, French, Indonesian, Italian, Japanese, Korean, Portuguese (Brazil), Russian, Ukrainian, Vietnamese

- **Configuration** - Enhanced settings

  - Changed default for `paths-le.openResultsSideBySide` to `true` for better UX
  - Updated manifest description to reflect all supported formats

- **GitHub Repository** - Updated repository metadata
  - Updated description to highlight all 9 supported file types
  - Refreshed topics to reflect web development support
  - New topics: javascript, typescript, html, css, json, import-analysis, web-development

### Technical Details

**Supported File Types** (9 total):

1. JavaScript (`.js`, `.mjs`, `.cjs`) - Import/require/export with package filtering
2. TypeScript (`.ts`, `.tsx`, `.mts`, `.cts`) - Full TypeScript support
3. JSON (`.json`) - Recursive path detection
4. HTML (`.html`) - All standard path attributes
5. CSS (`.css`, `.scss`, `.less`) - url() and @import
6. TOML (`.toml`) - Configuration files
7. CSV (`.csv`) - Data files
8. Environment (`.env`, `.env.local`) - Environment variables
9. Log/Text (`.log`, `.txt`) - Pre-extracted paths

**Smart Features**:

- JavaScript/TypeScript: Package name exclusion (filters 'react', '@mui/material', etc.)
- HTML: Automatic data: and javascript: URL exclusion
- CSS: Automatic data: URL exclusion
- All formats: Cross-platform path support (Windows/Unix)

**Performance**:

- JavaScript: Fast regex-based pattern matching
- JSON: Efficient recursive traversal
- HTML/CSS: Fast line-by-line scanning
- All formats maintain sub-second processing for typical files

## [1.1.2] - 2025-10-13

### Fixed

- **Documentation**: Corrected README header to accurately show supported formats (CSV, TOML, DOTENV) instead of misleading "JavaScript, JSON, YAML, logs, configs, and more"

## [1.1.1] - 2025-10-13

### Fixed

- **Documentation**: Corrected performance metrics to show actual benchmarked speeds
  - CSV: 530K paths/sec (tested with 988KB file, 30K paths)
  - DOTENV: 980K paths/sec (tested with 427KB file, 10K paths)
  - Removed incorrect references to unsupported formats (JS, JSON, YAML, INI, LOG)
- **Documentation**: Fixed supported file extensions in troubleshooting (now correctly shows .csv, .toml, .env, .dotenv)
- **Test Coverage**: Added comprehensive test coverage breakdown showing all 156 tests with per-module metrics

### Changed

- **Documentation**: Updated performance table to reflect only supported formats (CSV, TOML, DOTENV)
- **Documentation**: Enhanced test coverage section with detailed module breakdown and real benchmark data

## [1.1.0] - 2025-10-13

### Added

- **Internationalization**: Full support for 13 languages
  - 🇬🇧 English (primary)
  - 🇨🇳 Chinese (Simplified) • 🇪🇸 Spanish • 🇫🇷 French • 🇷🇺 Russian • 🇧🇷 Portuguese (Brazil)
  - 🇯🇵 Japanese • 🇰🇷 Korean • 🇩🇪 German • 🇮🇹 Italian • 🇻🇳 Vietnamese • 🇺🇦 Ukrainian • 🇮🇩 Indonesian
  - All commands, settings, and messages automatically display in your VS Code language
- **Visual assets**: Command palette screenshot in README for better discoverability

### Fixed

- **Code quality**: Resolved type safety issue with `exactOptionalPropertyTypes` in error handling
- **Build system**: Updated i18n scripts to properly handle all 13 language files

### Changed

- **Documentation**: Updated README to reflect full language support and minimal screenshot standard

## [1.0.1] - 2025-10-12

### Fixed

- **Documentation**: Updated LE family links in README to remove dead marketplace links
- **Sample files**: Fixed sample files to only include supported formats (TOML, CSV, ENV)
- **User experience**: Removed confusing "extraction not supported" errors by providing proper test files

### Added

- **Sample files**: Added working sample files for all supported extraction formats
  - `config.toml` - TOML configuration with embedded paths
  - `app.env` - Environment variables with path values
  - `file-paths.csv` - CSV data with path columns
  - `paths-only.txt` - Ready-to-analyze extracted paths
- **Documentation**: Updated sample README with clear format support information

## [1.0.0] - 2025-10-11

### Initial Public Release

Paths-LE brings zero-hassle file path extraction to VS Code with comprehensive validation and dependency analysis.

#### Core Features

- **Multi-format support** - Extract paths from CSV, TOML, and environment files with proven parsing libraries
- **Path type detection** - Absolute, relative, Windows, Unix, and network paths
- **Smart validation** - File existence checking and permission analysis
- **Dependency analysis** - Path patterns, depth analysis, and reference tracking
- **Cross-platform** - Handles Windows, macOS, and Linux path conventions

#### User Experience

- **One-command extraction** - Quick access via command palette and shortcuts
- **Side-by-side results** - Open results alongside your source files
- **Progress indicators** - Real-time feedback for large operations
- **Clipboard integration** - Automatic copying when enabled
- **English interface** - Clean, professional English-only interface

#### Performance & Reliability

- **High reliability** - Focus on proven file formats with 100% accuracy
- **Memory efficient** - Optimized processing with configurable limits
- **Robust error handling** - Graceful fallbacks and user-friendly messages
- **Comprehensive testing** - 120 tests with excellent coverage
- **TypeScript safety** - Full type safety and modern development practices

#### Developer Experience

- **Zero configuration** - Works out of the box with sensible defaults
- **Extensive customization** - Multiple settings for fine-tuned control
- **Rich documentation** - Complete guides and troubleshooting
- **Open source** - MIT licensed with active community support
