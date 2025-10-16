# Paths-LE Canonical Resolution Testing Plan

## 🧪 Test Scenarios

### 1. **Basic Path Extraction**

- Open `packages/frontend/src/main.js`
- Run `Paths-LE: Extract Paths` (Cmd+Alt+P)
- **Expected**: Should extract all import paths and string paths

### 2. **Symlink Resolution Test**

- Open `packages/frontend/src/symlink-test.js`
- Run `Paths-LE: Extract Paths`
- **Expected**:
  - With `resolveSymlinks: true` → Should show canonical paths
  - With `resolveSymlinks: false` → Should show symlink paths as-is

### 3. **Workspace-Relative Resolution**

- Open any file in the monorepo
- Extract paths that reference other packages
- **Expected**: Should resolve relative to correct workspace folder

### 4. **Configuration Testing**

#### Test A: Enable Canonical Resolution

```json
// In VS Code settings
"paths-le.resolution.resolveSymlinks": true,
"paths-le.resolution.resolveWorkspaceRelative": true
```

#### Test B: Disable Canonical Resolution

```json
"paths-le.resolution.resolveSymlinks": false,
"paths-le.resolution.resolveWorkspaceRelative": false
```

### 5. **Error Handling Test**

- Create a broken symlink: `ln -s /nonexistent/file broken-link.js`
- Reference it in a JS file
- **Expected**: Should gracefully fallback to original path

### 6. **Performance Test**

- Extract paths from large files
- **Expected**: Should complete quickly (LRU cache working)

## 🔍 **What to Verify**

### ✅ **Symlink Resolution**

1. **Before**: `./utils-link.js` (symlink path)
2. **After**: `/tmp/paths-le-test-monorepo/packages/shared/src/utils.js` (canonical path)

### ✅ **Workspace Resolution**

1. **Before**: `../../shared/src/utils.js` (relative path)
2. **After**: Correctly resolved within workspace context

### ✅ **Cross-Package References**

1. Import from `packages/backend` to `packages/frontend`
2. Should resolve correctly across workspace boundaries

### ✅ **Fallback Behavior**

1. Broken symlinks → Use original path
2. Permission errors → Use original path
3. Virtual workspaces → Use default resolution

## 🛠 **Manual Testing Steps**

### Step 1: Basic Functionality

```bash
# 1. Open the workspace
code /tmp/paths-le-test-monorepo/workspace.code-workspace

# 2. Open a test file
# File: packages/frontend/src/main.js

# 3. Run extraction
# Cmd+Alt+P (or Ctrl+Alt+P on Windows/Linux)
```

### Step 2: Compare Resolution Modes

```bash
# 1. Enable canonical resolution in settings
# 2. Extract paths → Note results
# 3. Disable canonical resolution in settings
# 4. Extract paths → Compare results
```

### Step 3: Symlink-Specific Test

```bash
# 1. Open packages/frontend/src/symlink-test.js
# 2. Extract paths with canonical resolution ON
# 3. Should see resolved symlink targets
# 4. Extract paths with canonical resolution OFF
# 5. Should see symlink paths as-is
```

### Step 4: Validation Test

```bash
# 1. Create a file with paths to existing files
# 2. Create a file with paths through symlinks
# 3. Run validation (if available in extension)
# 4. Should find files through symlinks when canonical resolution is enabled
```

## 🐛 **Expected Behaviors**

### ✅ **Success Cases**

- Symlinks resolve to canonical paths
- Cross-package imports work correctly
- Performance remains fast with caching
- Graceful fallback on errors

### ⚠️ **Edge Cases to Test**

- Broken symlinks
- Circular symlinks
- Permission denied errors
- Non-existent workspace folders
- Virtual/remote workspaces

### 🚫 **Failure Cases (Should Handle Gracefully)**

- Invalid symlinks → Use original path
- Missing workspace folders → Use default resolution
- File system errors → Fallback to string manipulation

## 📊 **Performance Verification**

### Test Large Files

```bash
# Create a large test file
cd /tmp/paths-le-test-monorepo
node -e "
const fs = require('fs');
const paths = [];
for(let i = 0; i < 10000; i++) {
  paths.push(\`import file\${i} from './path/to/file\${i}.js';\`);
}
fs.writeFileSync('packages/frontend/src/large-test.js', paths.join('\\n'));
"

# Test extraction performance
# Should complete in < 1 second with caching
```

## 🔧 **Debug Information**

### Check Extension Logs

1. Open VS Code Developer Tools (Help → Toggle Developer Tools)
2. Look for Paths-LE logs in console
3. Enable telemetry: `"paths-le.telemetryEnabled": true`

### Verify Configuration

```bash
# Check if settings are applied
# Open VS Code settings and search for "paths-le.resolution"
```

### Test Cache Performance

```bash
# Extract paths from same file multiple times
# Second extraction should be faster (cache hit)
```
