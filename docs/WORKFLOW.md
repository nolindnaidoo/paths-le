# Paths-LE User Workflows

## Overview

This guide walks through common workflows and best practices for using Paths-LE effectively in real-world scenarios.

---

## Quick Extraction Workflows

### Workflow 1: Basic Path Extraction from Config

**Scenario:** Extract all file paths from a configuration file for verification.

**Steps:**

1. Open `webpack.config.js`, `package.json`, or `config.json` in VS Code
2. Press `Ctrl+Alt+P` (Mac: `Cmd+Alt+P`)
3. Paths open in new editor, one per line
4. Review or copy to documentation

**Time:** 2 seconds  
**Best for:** Quick spot checks, JSON/TOML config review

**Tip:** Enable `copyToClipboardEnabled` to skip the editor step. Works with JSON, TOML, JavaScript config files.

---

### Workflow 2: Path Validation

**Scenario:** Verify all paths in a config file actually exist on disk.

**Steps:**

1. Open config file (e.g., `tsconfig.json`, `package.json`)
2. Run `Paths-LE: Extract Paths`
3. Run `Paths-LE: Post-Process: Validate`
4. Review validation report:
   - ✓ Valid paths
   - ✗ Broken paths (missing files/directories)
   - ⚠ Permission issues
5. Fix broken paths in original file

**Time:** 10-15 seconds  
**Best for:** Build configuration, CI/CD setup validation

**Tip:** Enable automatic validation in settings for continuous checking.

---

### Workflow 3: Log File Analysis

**Scenario:** Extract file paths from application logs to identify accessed files.

**Steps:**

1. Open `app.log` or similar log file
2. Extract paths with `Ctrl+Alt+P`
3. Run `Paths-LE: Post-Process: Dedupe` to remove duplicates
4. Run `Paths-LE: Post-Process: Analyze` for insights:
   - Unique directory count
   - Path depth analysis
   - File type distribution

**Time:** 5-10 seconds  
**Best for:** Debugging, security audits, performance analysis

---

### Workflow 4: Web Development - Import Analysis

**Scenario:** Analyze and verify all import paths in a React/TypeScript project.

**Steps:**

1. Open `App.tsx` or main JavaScript/TypeScript file
2. Run `Paths-LE: Extract Paths` (Ctrl+Alt+P)
3. Review extracted paths:
   - ✓ Local imports (e.g., `./components/Button`, `../utils/helpers`)
   - ✗ Package imports automatically filtered (e.g., 'react', 'lodash')
4. Check for broken relative paths
5. Validate file existence for all local imports

**Time:** 5 seconds  
**Best for:** Refactoring, dependency cleanup, import optimization

**Note:** Smart filtering automatically excludes npm packages like 'react', '@mui/material', 'lodash', etc.

---

### Workflow 5: HTML/CSS Asset Verification

**Scenario:** Verify all asset paths referenced in HTML and CSS files exist.

**Steps:**

1. Open `index.html`
2. Extract paths → Review all src, href, data attributes
3. Open `styles.css`
4. Extract paths → Review all url() and @import statements
5. Run validation to check for:
   - Missing images
   - Broken stylesheet links
   - Inaccessible font files
6. Fix broken asset references

**Time:** 10-15 seconds  
**Best for:** Static site generation, asset pipeline verification, frontend deployment

**Note:** Automatically excludes data: URLs and javascript: URLs from extraction.

---

## Advanced Workflows

### Workflow 6: Multi-Environment Configuration Comparison

**Scenario:** Compare file paths across multiple environment configurations.

**Steps:**

1. Open `.env.production`
2. Extract paths → Save as `prod-paths.txt`
3. Open `.env.staging`
4. Extract paths → Save as `staging-paths.txt`
5. Use VS Code's diff feature: Right-click → "Compare With..."
6. Identify mismatched paths
7. Validate both environments

**Time:** 30-60 seconds  
**Best for:** DevOps, deployment verification, configuration management

**Automation tip:** Create a VS Code task to automate extraction across environments.

---

### Workflow 7: Build System Audit

**Scenario:** Verify all referenced files in build configuration exist.

**Setup:**

```json
{
  "paths-le.validation.enabled": true,
  "paths-le.validation.checkExistence": true,
  "paths-le.notificationsLevel": "important"
}
```

**Steps:**

1. Open build config (webpack, rollup, vite, tsconfig)
2. Extract paths (includes entry points, output paths, aliases)
3. Automatic validation runs (if enabled)
4. Review validation report:
   - Missing source files
   - Invalid output directories
   - Broken alias paths
5. Fix issues before build

**Time:** 1-2 minutes  
**Best for:** Pre-build checks, CI/CD integration

---

### Workflow 6: Permission Audit

**Scenario:** Identify files with incorrect permissions in configuration.

**Setup:**

```json
{
  "paths-le.validation.enabled": true,
  "paths-le.validation.checkPermissions": true
}
```

**Steps:**

1. Extract paths from config
2. Run validation with permission checking
3. Review permission report:
   - Read-only files
   - Write-protected directories
   - Inaccessible paths
4. Adjust permissions via terminal:
   ```bash
   chmod +w path/to/file
   ```
5. Re-validate to confirm

**Time:** 2-5 minutes  
**Best for:** Security audits, deployment preparation

---

### Workflow 7: Pattern Analysis

**Scenario:** Analyze directory structure and naming patterns.

**Steps:**

1. Extract paths from project config
2. Run `Paths-LE: Post-Process: Analyze`
3. Review pattern analysis:
   - Directory depth statistics (min/max/avg)
   - Common directory patterns
   - Naming convention compliance
   - Path length analysis
4. Identify inconsistencies
5. Refactor as needed

**Time:** 30 seconds  
**Best for:** Code organization, refactoring planning

**Output example:**

```
=== Path Analysis Report ===

File: webpack.config.js
Type: javascript
Paths Found: 87

--- Path Statistics ---
Total Paths: 87
Unique Directories: 23
Unique Files: 64

--- Depth Analysis ---
Min Depth: 1
Max Depth: 7
Average Depth: 3.4

--- Patterns ---
Common Directories:
  - src/ (42 paths)
  - dist/ (15 paths)
  - node_modules/ (18 paths)
  - config/ (8 paths)

--- Naming Conventions ---
kebab-case: 45 paths
camelCase: 28 paths
PascalCase: 10 paths
snake_case: 4 paths
```

---

## Keyboard-Driven Workflows

### Power User Setup

**Configuration:**

```json
{
  "paths-le.openResultsSideBySide": true,
  "paths-le.copyToClipboardEnabled": true,
  "paths-le.notificationsLevel": "silent",
  "paths-le.statusBar.enabled": true,
  "paths-le.validation.enabled": true
}
```

**Key mappings:**

- `Ctrl+Alt+P` - Extract
- `Ctrl+Alt+V` - Validate
- `Ctrl+Alt+A` - Analyze

**Workflow:**

1. Open file → `Ctrl+Alt+P` (extract, results on right)
2. `Ctrl+Alt+V` (validate, report copied)
3. `Ctrl+Alt+A` (analyze, insights copied)
4. `Ctrl+V` (paste report into ticket/doc)
5. Close temp editors → `Ctrl+W`

**Time:** 10 seconds  
**Best for:** Repetitive tasks, muscle memory workflows

---

## Team Workflows

### Workflow 8: Code Review - Path References

**Scenario:** Reviewer wants to verify all file references in a PR are valid.

**Steps:**

1. Open changed files in PR
2. For each file with path references:
   - Run `Paths-LE: Extract Paths`
   - Run validation
   - Flag broken paths
3. Comment on PR with findings

**Example findings:**

```
Found path issues in config.ts:
- Line 42: ./dist/bundle.js (missing)
- Line 105: ../../legacy/old-file.ts (broken)
- Line 203: ../../../secret.env (permission denied)
```

**Time:** 2-5 minutes per file  
**Best for:** Code quality, build reliability

---

### Workflow 9: Documentation - File Structure

**Scenario:** Document project file structure for README.

**Steps:**

1. Extract paths from main config files
2. Run analysis to get directory statistics
3. Deduplicate to get unique directories
4. Format for markdown tree structure
5. Update README with file structure

**Example:**

```markdown
## Project Structure
```

project/
├── src/ (42 files)
│ ├── components/
│ ├── utils/
│ └── services/
├── dist/ (generated)
├── config/ (8 files)
└── docs/

```

```

**Time:** 10 minutes  
**Best for:** Documentation, onboarding

---

## Integration Workflows

### Workflow 10: VS Code Tasks Integration

**Scenario:** Automate path extraction and validation as part of pre-commit.

**`.vscode/tasks.json`:**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Validate Config Paths",
      "type": "shell",
      "command": "code",
      "args": ["--command", "paths-le.extractPaths", "--command", "paths-le.postProcess.validate"],
      "presentation": {
        "reveal": "silent"
      },
      "problemMatcher": []
    }
  ]
}
```

**Usage:** Run via `Terminal → Run Task → Validate Config Paths`

---

### Workflow 11: CI/CD Pipeline Integration

**Scenario:** Validate configuration paths in CI before deployment.

**GitHub Actions example:**

```yaml
- name: Validate Config Paths
  run: |
    code --install-extension nolindnaidoo.paths-le
    code --command paths-le.extractPaths config/production.json
    code --command paths-le.postProcess.validate
    # Check for validation errors in output
    if grep -q "broken" paths-validation.txt; then
      echo "Configuration has broken paths"
      exit 1
    fi
```

**Best for:** Automated quality checks, deployment gates

---

## Troubleshooting Workflows

### Workflow 12: Parse Error Debugging

**Scenario:** File won't parse, need to identify the issue.

**Steps:**

1. Enable parse errors:
   ```json
   {
     "paths-le.showParseErrors": true
   }
   ```
2. Run extract → See specific error
3. Check Output panel → "Paths-LE" for full details
4. Fix syntax error at reported line
5. Re-run extraction

**Time:** 1-2 minutes  
**Best for:** Debugging malformed configuration files

---

### Workflow 13: Performance Profiling

**Scenario:** Extraction is slow, need to optimize.

**Steps:**

1. Enable telemetry:
   ```json
   {
     "paths-le.telemetryEnabled": true
   }
   ```
2. Run extraction
3. Open Output panel → "Paths-LE"
4. Review performance metrics:
   - Duration
   - Throughput
   - Memory usage
   - Patterns matched
5. Adjust settings based on recommendations

**Example output:**

```
Performance Metrics:
- Duration: 3,234ms
- Paths Found: 487
- Throughput: 150 paths/sec
- Memory: 45MB
- File Size: 5MB

Recommendations:
- File size is large, consider splitting config
- Enable deduplication to reduce memory
```

**Best for:** Optimization, large file handling

---

## Best Practices Summary

### Do's

✅ **Enable validation** for build configurations  
✅ **Use side-by-side view** for comparison workflows  
✅ **Check permissions** for deployment configs  
✅ **Run analysis** to identify structural issues  
✅ **Save common extractions** as VS Code tasks  
✅ **Validate before commits** to catch issues early

### Don'ts

❌ **Don't skip validation** for production configs  
❌ **Don't ignore permission warnings** (they affect deployments)  
❌ **Don't extract from unsaved files** (save first)  
❌ **Don't auto-enable all features** (impacts performance)  
❌ **Don't ignore broken paths** in CI (will fail at runtime)

---

## Workflow Templates

### Template: Configuration Validation Project

**Initial setup:**

```json
{
  "paths-le.validation.enabled": true,
  "paths-le.validation.checkExistence": true,
  "paths-le.validation.checkPermissions": true,
  "paths-le.analysis.enabled": true,
  "paths-le.notificationsLevel": "important"
}
```

**Workflow:**

1. Extract from config → Validate automatically
2. Review validation report
3. Fix broken paths
4. Analyze for patterns
5. Document structure

---

### Template: DevOps Multi-Environment Audit

**Initial setup:**

```json
{
  "paths-le.notificationsLevel": "silent",
  "paths-le.copyToClipboardEnabled": true,
  "paths-le.validation.enabled": true,
  "paths-le.openResultsSideBySide": true
}
```

**Workflow:**

1. Extract from dev/staging/prod configs
2. Validate each environment
3. Compare results with diff
4. Flag discrepancies
5. Document required changes

---

### Template: Code Quality Review

**Initial setup:**

```json
{
  "paths-le.notificationsLevel": "important",
  "paths-le.showParseErrors": true,
  "paths-le.validation.enabled": true
}
```

**Workflow:**

1. Review PR changed files
2. Extract and validate paths
3. Identify broken references
4. Request fixes
5. Approve when resolved

---

**Next Steps:** Try these workflows in your projects and adapt to your needs!

---

**Project:** [Issues](https://github.com/nolindnaidoo/paths-le/issues) • [Pull Requests](https://github.com/nolindnaidoo/paths-le/pulls) • [Releases](https://github.com/nolindnaidoo/paths-le/releases) • [MIT License](LICENSE)

**Dev:** [Spec](SPECIFICATION.md) • [Architecture](ARCHITECTURE.md) • [Development](DEVELOPMENT.md) • [Testing](TESTING.md)

**Docs:** [Commands](COMMANDS.md) • [Notifications](NOTIFICATIONS.md) • [Config](CONFIGURATION.md) • [Performance](PERFORMANCE.md) • [Privacy](PRIVACY.md)
