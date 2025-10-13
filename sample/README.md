# Paths-LE Sample Files

This directory contains comprehensive sample files for testing the Paths-LE extension across all supported file types.

## ✅ Supported File Types for Extraction

Paths-LE supports **9 file types** for path extraction:

### Configuration & Data Files

- **TOML** files (`.toml`) - Configuration files
- **CSV** files (`.csv`) - Data files with path columns
- **Environment** files (`.env`, `.env.local`) - Environment variables
- **JSON** files (`.json`) - Configuration and data structures

### Web Development Files

- **JavaScript/TypeScript** (`.js`, `.ts`, `.jsx`, `.tsx`) - Import/require/export statements
- **HTML** files (`.html`) - src, href, and other path attributes
- **CSS** files (`.css`, `.scss`, `.less`) - url() and @import statements

## 🧪 Sample Files

### 1. `paths-only.txt` - Pure Path List ✅

**What it is**: Pre-extracted paths (one per line) ready for analysis  
**How to test**:

- Open this file in VS Code
- Run `Paths-LE: Analyze Paths` → See analysis report replace content
- Run `Paths-LE: Validate Paths` → See validation report replace content

**Use case**: Skip extraction, directly analyze/validate paths

---

### 2. `config.json` - JSON Configuration ✅

**What it is**: JSON file with nested paths, URLs, arrays, and Windows paths  
**How to test**:

- Open this file in VS Code
- Run `Paths-LE: Extract Paths` → Extracts all path-like strings
- Paths from nested objects, arrays, and URLs are all detected

**Sample content**:

```json
{
  "paths": {
    "config": "/etc/app/config.json",
    "logs": "./logs/application.log"
  },
  "files": ["./file1.txt", "../file2.txt"]
}
```

---

### 3. `config-paths.json` - Comprehensive JSON Test ✅

**What it is**: Extended JSON with deep nesting, Windows paths, URLs, and edge cases  
**How to test**:

- Open this file and extract paths
- Verify it handles nested structures, arrays, and mixed path types

---

### 4. `app.js` - JavaScript/TypeScript ✅

**What it is**: JavaScript file with ES6 imports, CommonJS require, dynamic imports, exports  
**How to test**:

- Open this file in VS Code
- Run `Paths-LE: Extract Paths` → Extracts local file paths
- Package names like 'react' and 'lodash' are **excluded** (not file paths)

**Sample content**:

```javascript
import React from './components/App' // ✅ Extracted
import { Button } from './components/Button' // ✅ Extracted
import lodash from 'lodash' // ❌ Excluded (package)
const config = require('./config/settings') // ✅ Extracted
```

**Smart detection**: Only extracts paths starting with `./`, `../`, `/`, `C:\`, or URLs

---

### 5. `index.html` - HTML Document ✅

**What it is**: HTML file with various path attributes (src, href, srcset, poster, etc.)  
**How to test**:

- Open this file in VS Code
- Run `Paths-LE: Extract Paths` → Extracts from all HTML attributes
- Handles responsive srcset, CDN URLs, protocol-relative URLs

**Sample content**:

```html
<link href="./styles/main.css" rel="stylesheet" />
<img src="./images/logo.png" alt="Logo" />
<script src="../vendor/jquery.min.js"></script>
<img srcset="./small.jpg 480w, ./large.jpg 800w" />
```

**Excluded automatically**:

- `data:` URLs (inline SVG, base64)
- `javascript:` URLs

---

### 6. `styles.css` - CSS Stylesheet ✅

**What it is**: CSS file with url() and @import statements  
**How to test**:

- Open this file in VS Code
- Run `Paths-LE: Extract Paths` → Extracts from url() and @import
- Handles font faces, backgrounds, cursors, and imports

**Sample content**:

```css
@import './reset.css';
@import url('../vendor/normalize.css');
body {
  background: url('./images/background.jpg');
}
@font-face {
  src: url('./fonts/font.woff2');
}
```

**Excluded automatically**:

- `data:` URLs (inline SVG)

---

### 7. `config.toml` - TOML Configuration ✅

**What it is**: TOML config with embedded paths  
**How to test**:

- Open this file in VS Code
- Run `Paths-LE: Extract Paths` → New tab with extracted paths opens
- Analyze the extracted paths

---

### 8. `app.env` - Environment Variables ✅

**What it is**: Environment file with path variables  
**How to test**:

- Open this file in VS Code
- Run `Paths-LE: Extract Paths` → Extracts paths from env values
- Validate the extracted paths

---

### 9. `file-paths.csv` - CSV Data ✅

**What it is**: CSV file with path data in columns  
**How to test**:

- Open this file in VS Code
- Run `Paths-LE: Extract Paths` → Extracts paths from CSV columns
- Validate the extracted paths

---

## 🔍 Testing the Smart Detection

The extension automatically detects:

- **Extracted paths file** (`paths-only.txt`) → Process directly
- **Source files** (all supported types) → Extract paths first, then process

---

## ✨ Expected Behavior

✅ **In-place editing**: Commands replace current editor content  
✅ **Smart detection**: Knows extracted vs source files  
✅ **Cross-platform paths**: Handles Windows (C:\) and Unix (/) paths  
✅ **Package filtering**: JavaScript imports exclude npm packages  
✅ **URL support**: Extracts http://, https://, file://, and protocol-relative URLs  
✅ **Data URL exclusion**: Skips data: and javascript: URLs automatically

---

## 🚀 Quick Start

### Test JavaScript/TypeScript

1. Open `app.js`
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type "Paths-LE: Extract Paths" → Extracts only file paths, not packages

### Test HTML

1. Open `index.html`
2. Run `Paths-LE: Extract Paths` → Extracts from src, href, srcset, etc.

### Test CSS

1. Open `styles.css`
2. Run `Paths-LE: Extract Paths` → Extracts from url() and @import

### Test JSON

1. Open `config-paths.json`
2. Run `Paths-LE: Extract Paths` → Extracts path-like strings recursively

---

## 📝 File Type Summary

| File Type   | Extensions           | What Gets Extracted                           |
| ----------- | -------------------- | --------------------------------------------- |
| JavaScript  | .js, .ts, .jsx, .tsx | import/require/export with local paths only   |
| JSON        | .json                | Path-like strings (absolute, relative, URLs)  |
| HTML        | .html                | src, href, data, action, poster, srcset, etc. |
| CSS         | .css, .scss, .less   | url() and @import paths                       |
| TOML        | .toml                | All string values that look like paths        |
| CSV         | .csv                 | Path values in any column                     |
| Environment | .env, .env.local     | Path values in environment variables          |

---

## 🎯 Advanced Testing Scenarios

### Test Cross-Platform Paths

- Mix Unix (`/usr/local`) and Windows (`C:\Users`) paths
- Verify normalization and classification

### Test URL Handling

- HTTP/HTTPS URLs
- Protocol-relative URLs (`//cdn.example.com`)
- File URLs (`file:///path/to/file`)

### Test Edge Cases

- Empty files
- Files with no paths
- Deeply nested JSON structures
- Multiple paths on the same line (CSS)
- Package vs file path distinction (JavaScript)

---

## ✅ What Should Work

All 9 file types listed above fully support extraction, analysis, and validation.

---

## 📚 Next Steps

After testing these samples:

1. Try on your real project files
2. Experiment with the analysis and validation commands
3. Check the status bar for real-time feedback
4. Configure settings to customize behavior

For more information, see the main [README.md](../README.md) or check the [documentation](https://github.com/nolindnaidoo/paths-le).
