# Canonical Path Resolution Test Fixture

This test fixture provides a realistic monorepo environment for testing Paths-LE's canonical path resolution features, including symlink handling and workspace-relative path resolution.

## 🏗️ Structure

```
test-fixtures/monorepo-test/
├── workspace.code-workspace          # VS Code multi-root workspace
├── setup-symlinks.sh               # Script to create symlinks
├── packages/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── main.js             # Cross-package imports
│   │   │   ├── symlink-test.js     # Symlink references
│   │   │   ├── utils-link.js       # → ../../shared/src/utils.js
│   │   │   ├── regular-file.js     # Regular file for comparison
│   │   │   └── config.json         # Local config file
│   │   ├── webpack-link.js         # → ../../../tools/build-scripts/webpack.config.js
│   │   ├── shared-link/            # → ../shared (directory symlink)
│   │   └── normal-file.js          # Regular file
│   ├── backend/
│   │   └── src/
│   │       └── api.js              # Backend API with shared imports
│   └── shared/
│       └── src/
│           ├── utils.js            # Shared utilities
│           └── helpers.js          # Additional shared code
└── tools/
    └── build-scripts/
        └── webpack.config.js       # Build configuration
```

## 🚀 Quick Start

### 1. Setup Symlinks

```bash
cd test-fixtures/monorepo-test
./setup-symlinks.sh
```

### 2. Open in VS Code

```bash
code workspace.code-workspace
```

### 3. Test Canonical Resolution

1. **Install the extension** (if not already installed):

   ```bash
   cd ../../  # Back to paths-le root
   code --install-extension release/paths-le-1.6.0.vsix
   ```

2. **Open test files** and run `Paths-LE: Extract Paths` (Cmd+Alt+P):
   - `packages/frontend/src/main.js` - Cross-package imports
   - `packages/frontend/src/symlink-test.js` - Symlink references

## 🧪 Test Scenarios

### Scenario A: Cross-Package Imports

**File**: `packages/frontend/src/main.js`

**Test**: Extract paths from cross-package imports

```javascript
import { utils } from '../../shared/src/utils.js'
import { api } from '../../../packages/backend/src/api.js'
```

**Expected Results**:

- With canonical resolution: Resolves relative to correct workspace folders
- Should handle complex relative paths across package boundaries

### Scenario B: Symlink Resolution

**File**: `packages/frontend/src/symlink-test.js`

**Test**: Extract paths that go through symlinks

```javascript
import utils from './utils-link.js' // Symlink to ../../shared/src/utils.js
```

**Expected Results**:

- `resolveSymlinks: true` → Shows canonical path to actual file
- `resolveSymlinks: false` → Shows symlink path as-is

### Scenario C: Directory Symlinks

**File**: `packages/frontend/src/symlink-test.js`

**Test**: Import through symlinked directory

```javascript
import shared from '../shared-link/src/helpers.js' // Via directory symlink
```

**Expected Results**:

- Should resolve through the symlinked directory to actual file

### Scenario D: Workspace-Relative Paths

**File**: `packages/frontend/src/main.js`

**Test**: Workspace-relative path references

```javascript
const sharedUtil = 'packages/shared/src/helpers.js'
```

**Expected Results**:

- With workspace resolution: Resolves relative to workspace root
- Should work correctly in multi-root workspace environment

## ⚙️ Configuration Testing

### Test Configuration A: Full Canonical Resolution

```json
{
  "paths-le.resolution.resolveSymlinks": true,
  "paths-le.resolution.resolveWorkspaceRelative": true
}
```

### Test Configuration B: Symlinks Only

```json
{
  "paths-le.resolution.resolveSymlinks": true,
  "paths-le.resolution.resolveWorkspaceRelative": false
}
```

### Test Configuration C: Workspace Only

```json
{
  "paths-le.resolution.resolveSymlinks": false,
  "paths-le.resolution.resolveWorkspaceRelative": true
}
```

### Test Configuration D: Traditional Mode

```json
{
  "paths-le.resolution.resolveSymlinks": false,
  "paths-le.resolution.resolveWorkspaceRelative": false
}
```

## 🔍 What to Verify

### ✅ Symlink Resolution

1. **File symlinks**: `utils-link.js` → `../../shared/src/utils.js`
2. **Directory symlinks**: `shared-link/` → `../shared/`
3. **Nested symlinks**: Paths through symlinked directories

### ✅ Workspace Resolution

1. **Multi-root workspace**: Each package as separate workspace folder
2. **Cross-package references**: Imports between frontend/backend/shared
3. **Relative path handling**: Complex `../../` paths across packages

### ✅ Error Handling

1. **Broken symlinks**: Create and test broken symlinks
2. **Permission errors**: Test with restricted permissions
3. **Non-existent paths**: References to missing files

### ✅ Performance

1. **Caching**: Extract same paths multiple times (should be faster on repeat)
2. **Large files**: Test with files containing many path references
3. **Deep nesting**: Complex directory structures

## 🛠️ Manual Testing Steps

### Step 1: Basic Functionality

```bash
# 1. Open the workspace
code test-fixtures/monorepo-test/workspace.code-workspace

# 2. Open a test file
# File: packages/frontend/src/main.js

# 3. Run extraction
# Cmd+Alt+P (or Ctrl+Alt+P on Windows/Linux)
```

### Step 2: Compare Resolution Modes

1. Enable canonical resolution in VS Code settings
2. Extract paths → Note results
3. Disable canonical resolution in settings
4. Extract paths → Compare results

### Step 3: Symlink-Specific Test

1. Open `packages/frontend/src/symlink-test.js`
2. Extract paths with canonical resolution ON
3. Should see resolved symlink targets
4. Extract paths with canonical resolution OFF
5. Should see symlink paths as-is

## 🐛 Expected Behaviors

### ✅ Success Cases

- Symlinks resolve to canonical paths when enabled
- Cross-package imports work correctly in multi-root workspace
- Performance remains fast with LRU caching
- Graceful fallback on resolution errors

### ⚠️ Edge Cases

- Broken symlinks → Use original path
- Circular symlinks → Detect and handle gracefully
- Permission denied → Fallback to original path
- Virtual workspaces → Auto-detect and use traditional resolution

## 🔧 Troubleshooting

### Symlinks Not Working?

```bash
# Recreate symlinks
cd test-fixtures/monorepo-test
./setup-symlinks.sh
```

### VS Code Not Recognizing Workspace?

- Ensure you opened `workspace.code-workspace` file
- Check that all workspace folders exist
- Reload VS Code window

### Extension Not Working?

```bash
# Reinstall extension
cd ../../  # Back to paths-le root
code --install-extension release/paths-le-1.6.0.vsix --force
```

### Debug Information

1. Enable telemetry: `"paths-le.telemetryEnabled": true`
2. Open VS Code Developer Tools (Help → Toggle Developer Tools)
3. Check console for Paths-LE logs

## 📊 Performance Testing

### Create Large Test File

```bash
cd test-fixtures/monorepo-test
node -e "
const fs = require('fs');
const paths = [];
for(let i = 0; i < 10000; i++) {
  paths.push(\`import file\${i} from './path/to/file\${i}.js';\`);
}
fs.writeFileSync('packages/frontend/src/large-test.js', paths.join('\\n'));
"
```

### Test Extraction Performance

- Should complete in < 1 second with caching
- Second extraction should be faster (cache hit)

## 🎯 Success Criteria

- ✅ All symlinks resolve correctly when canonical resolution is enabled
- ✅ Cross-package imports work in multi-root workspace
- ✅ Configuration toggles work as expected
- ✅ Performance remains acceptable (< 1s for large files)
- ✅ Graceful fallback on any resolution errors
- ✅ Backward compatibility maintained
