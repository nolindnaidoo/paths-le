import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

/**
 * Creates a test fixture for canonical path resolution testing
 */
export function registerCreateTestFixtureCommand(
	context: vscode.ExtensionContext,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.createTestFixture',
		async () => {
			try {
				// Ask user where to create the test fixture
				const folderUri = await vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					openLabel: 'Select folder for test fixture',
					title: 'Create Paths-LE Test Fixture',
				});

				if (!folderUri || folderUri.length === 0) {
					return;
				}

				const baseDir = folderUri[0]!.fsPath;
				const testDir = path.join(baseDir, 'paths-le-test-monorepo');

				// Show progress
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: 'Creating Paths-LE test fixture...',
						cancellable: false,
					},
					async (progress) => {
						progress.report({
							increment: 10,
							message: 'Creating directories...',
						});
						await createDirectoryStructure(testDir);

						progress.report({
							increment: 30,
							message: 'Creating test files...',
						});
						await createTestFiles(testDir);

						progress.report({
							increment: 30,
							message: 'Creating workspace configuration...',
						});
						await createWorkspaceConfig(testDir);

						progress.report({
							increment: 20,
							message: 'Creating setup script...',
						});
						await createSetupScript(testDir);

						progress.report({
							increment: 10,
							message: 'Creating documentation...',
						});
						await createDocumentation(testDir);
					},
				);

				// Ask if user wants to open the test fixture
				const openChoice = await vscode.window.showInformationMessage(
					`Test fixture created successfully at:\n${testDir}`,
					'Open Workspace',
					'Open Folder',
					'Close',
				);

				if (openChoice === 'Open Workspace') {
					const workspaceFile = vscode.Uri.file(
						path.join(testDir, 'workspace.code-workspace'),
					);
					await vscode.commands.executeCommand(
						'vscode.openFolder',
						workspaceFile,
					);
				} else if (openChoice === 'Open Folder') {
					const folderUri = vscode.Uri.file(testDir);
					await vscode.commands.executeCommand('vscode.openFolder', folderUri);
				}
			} catch (error) {
				vscode.window.showErrorMessage(
					`Failed to create test fixture: ${error}`,
				);
			}
		},
	);

	context.subscriptions.push(command);
}

async function createDirectoryStructure(baseDir: string): Promise<void> {
	const dirs = [
		'packages/frontend/src',
		'packages/backend/src',
		'packages/shared/src',
		'tools/build-scripts',
	];

	for (const dir of dirs) {
		await fs.mkdir(path.join(baseDir, dir), { recursive: true });
	}
}

async function createTestFiles(baseDir: string): Promise<void> {
	// Frontend main.js
	await fs.writeFile(
		path.join(baseDir, 'packages/frontend/src/main.js'),
		`// Test cross-package imports in monorepo
import { utils } from '../../shared/src/utils.js'
import { api } from '../../../packages/backend/src/api.js'
import config from './config.json'
import styles from './styles.css'

// Test relative paths
const localFile = './components/Button.js'
const parentFile = '../assets/logo.png'

// Test absolute paths
const absolutePath = '/usr/local/bin/node'
const windowsPath = 'C:\\\\Program Files\\\\Node\\\\node.exe'

// Test workspace-relative paths
const sharedUtil = 'packages/shared/src/helpers.js'
const buildScript = 'tools/build-scripts/webpack.config.js'
`,
	);

	// Frontend symlink test
	await fs.writeFile(
		path.join(baseDir, 'packages/frontend/src/symlink-test.js'),
		`// Test file with symlink references
import utils from './utils-link.js' // This is a symlink
import config from '../webpack-link.js' // This is a symlink
import shared from '../shared-link/src/helpers.js' // Through symlinked directory

// Regular paths for comparison
import regular from './regular-file.js'
import normal from '../normal-file.js'
`,
	);

	// Frontend config.json
	await fs.writeFile(
		path.join(baseDir, 'packages/frontend/src/config.json'),
		JSON.stringify(
			{
				apiEndpoint: 'http://localhost:3000/api',
				staticAssets: './assets/',
				sharedLibrary: '../../shared/src/utils.js',
				buildScript: '../../../tools/build-scripts/webpack.config.js',
				paths: {
					components: './components/',
					styles: './styles/',
					images: '../assets/images/',
					shared: 'packages/shared/src/',
					backend: 'packages/backend/src/',
				},
			},
			null,
			2,
		),
	);

	// Shared utils.js
	await fs.writeFile(
		path.join(baseDir, 'packages/shared/src/utils.js'),
		`// Shared utility functions
export function formatPath(path) {
  return path.replace(/\\\\/g, '/')
}

export function isAbsolute(path) {
  return path.startsWith('/') || /^[A-Za-z]:/.test(path)
}
`,
	);

	// Shared helpers.js
	await fs.writeFile(
		path.join(baseDir, 'packages/shared/src/helpers.js'),
		`// Additional shared helper functions
import { formatPath } from './utils.js'

export function resolvePath(basePath, relativePath) {
  return formatPath(basePath + '/' + relativePath)
}

export function getFileExtension(filePath) {
  return filePath.split('.').pop()
}

// Test various path formats
const testPaths = [
  './local/file.js',
  '../parent/file.js',
  '../../grandparent/file.js',
  '/absolute/path/file.js',
  'C:\\\\Windows\\\\System32\\\\file.exe',
  'packages/frontend/src/main.js',
  'tools/build-scripts/webpack.config.js',
]
`,
	);

	// Backend api.js
	await fs.writeFile(
		path.join(baseDir, 'packages/backend/src/api.js'),
		`// Backend API functions
import { formatPath } from '../../shared/src/utils.js'

export function processPath(inputPath) {
  return formatPath(inputPath)
}

export function validatePath(path) {
  return path && path.length > 0
}
`,
	);

	// Webpack config
	await fs.writeFile(
		path.join(baseDir, 'tools/build-scripts/webpack.config.js'),
		`// Webpack configuration for monorepo
const path = require('path')

module.exports = {
  entry: './packages/frontend/src/main.js',
  output: {
    path: path.resolve(__dirname, '../../dist'),
    filename: 'bundle.js',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@backend': path.resolve(__dirname, '../../packages/backend/src'),
    },
  },
}
`,
	);

	// Create placeholder files for symlinks
	await fs.writeFile(
		path.join(baseDir, 'packages/frontend/src/regular-file.js'),
		'// Regular file for comparison\nexport default "regular";\n',
	);
	await fs.writeFile(
		path.join(baseDir, 'packages/frontend/normal-file.js'),
		'// Normal file for comparison\nexport default "normal";\n',
	);
}

async function createWorkspaceConfig(baseDir: string): Promise<void> {
	const workspaceConfig = {
		folders: [
			{
				name: 'Frontend',
				path: './packages/frontend',
			},
			{
				name: 'Backend',
				path: './packages/backend',
			},
			{
				name: 'Shared',
				path: './packages/shared',
			},
			{
				name: 'Tools',
				path: './tools',
			},
		],
		settings: {
			'paths-le.resolution.resolveSymlinks': true,
			'paths-le.resolution.resolveWorkspaceRelative': true,
		},
	};

	await fs.writeFile(
		path.join(baseDir, 'workspace.code-workspace'),
		JSON.stringify(workspaceConfig, null, 2),
	);
}

async function createSetupScript(baseDir: string): Promise<void> {
	const setupScript = `#!/bin/bash
# Setup script for creating symlinks in the test monorepo
# Run this script to create symlinks for testing canonical path resolution

set -e

echo "🔗 Setting up symlinks for canonical path resolution testing..."

# Navigate to the test directory
cd "$(dirname "$0")"

# Create symlinks for testing
echo "Creating symlinks..."

# Symlink to shared utils from frontend
ln -sf ../../shared/src/utils.js packages/frontend/src/utils-link.js

# Symlink to webpack config from frontend  
ln -sf ../../../tools/build-scripts/webpack.config.js packages/frontend/webpack-link.js

# Symlink to entire shared directory
ln -sf ../shared packages/frontend/shared-link

echo "✅ Symlinks created successfully!"
echo ""
echo "📁 Test structure:"
find . -type l -exec ls -la {} \\;
echo ""
echo "🚀 Ready to test! Open workspace.code-workspace in VS Code"
`;

	await fs.writeFile(path.join(baseDir, 'setup-symlinks.sh'), setupScript);

	// Make script executable (Unix systems)
	try {
		await fs.chmod(path.join(baseDir, 'setup-symlinks.sh'), 0o755);
	} catch (_error) {
		// Ignore chmod errors on Windows
	}
}

async function createDocumentation(baseDir: string): Promise<void> {
	const readme = `# Paths-LE Canonical Path Resolution Test Fixture

This test fixture was created by the Paths-LE extension to help you test canonical path resolution features including symlink handling and workspace-relative path resolution.

## 🚀 Quick Start

### 1. Setup Symlinks

\`\`\`bash
# On Unix/macOS/Linux:
./setup-symlinks.sh

# On Windows (PowerShell):
# Create symlinks manually or use mklink command
\`\`\`

### 2. Open in VS Code

\`\`\`bash
code workspace.code-workspace
\`\`\`

### 3. Test Canonical Resolution

1. Open test files and run \`Paths-LE: Extract Paths\` (Cmd+Alt+P):
   - \`packages/frontend/src/main.js\` - Cross-package imports
   - \`packages/frontend/src/symlink-test.js\` - Symlink references

## 🧪 Test Scenarios

### Cross-Package Imports
**File**: \`packages/frontend/src/main.js\`
- Tests complex relative paths across package boundaries
- Tests workspace-relative path resolution

### Symlink Resolution  
**File**: \`packages/frontend/src/symlink-test.js\`
- Tests file symlinks (\`utils-link.js\` → \`../../shared/src/utils.js\`)
- Tests directory symlinks (\`shared-link/\` → \`../shared/\`)

## ⚙️ Configuration Testing

Toggle these settings in VS Code to test different modes:

\`\`\`json
{
  "paths-le.resolution.resolveSymlinks": true,
  "paths-le.resolution.resolveWorkspaceRelative": true
}
\`\`\`

## 🔍 What to Verify

- ✅ Symlinks resolve to canonical paths when enabled
- ✅ Cross-package imports work in multi-root workspace
- ✅ Configuration toggles work as expected
- ✅ Graceful fallback on resolution errors

## 🛠️ Troubleshooting

### Symlinks Not Working?
- **Unix/macOS/Linux**: Run \`./setup-symlinks.sh\`
- **Windows**: Use \`mklink\` command or create symlinks manually

### VS Code Not Recognizing Workspace?
- Ensure you opened \`workspace.code-workspace\` file
- Check that all workspace folders exist
- Reload VS Code window

Created by Paths-LE extension v1.6.0
`;

	await fs.writeFile(path.join(baseDir, 'README.md'), readme);
}
