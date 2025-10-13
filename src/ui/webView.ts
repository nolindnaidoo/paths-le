import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';

/**
 * WebView implementation for help and documentation
 */
export interface WebView {
	readonly show: () => void;
	readonly dispose: () => void;
}

/**
 * Create a help webview
 */
export function createHelpWebView(
	_context: vscode.ExtensionContext,
	telemetry: Telemetry,
): WebView {
	let panel: vscode.WebviewPanel | undefined;

	return Object.freeze({
		show(): void {
			if (panel) {
				panel.reveal();
				return;
			}

			telemetry.event('webview-help-opened');

			panel = vscode.window.createWebviewPanel(
				'paths-le-help',
				'Paths-LE Help',
				vscode.ViewColumn.Beside,
				{
					enableScripts: true,
					localResourceRoots: [],
				},
			);

			panel.webview.html = getHelpHtml();

			panel.onDidDispose(() => {
				panel = undefined;
				telemetry.event('webview-help-closed');
			});
		},

		dispose(): void {
			if (panel) {
				panel.dispose();
				panel = undefined;
			}
		},
	});
}

/**
 * Get the HTML content for the help webview
 */
function getHelpHtml(): string {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paths-LE Help</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        h1, h2, h3 {
            color: var(--vscode-textLink-foreground);
            margin-top: 30px;
        }
        h1 {
            border-bottom: 2px solid var(--vscode-textLink-foreground);
            padding-bottom: 10px;
        }
        code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        .command {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 8px 12px;
            border-radius: 4px;
            display: inline-block;
            margin: 5px 0;
        }
        .feature-list {
            list-style-type: none;
            padding-left: 0;
        }
        .feature-list li {
            margin: 10px 0;
            padding-left: 20px;
            position: relative;
        }
        .feature-list li:before {
            content: "✓";
            color: var(--vscode-textLink-foreground);
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        .warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            padding: 10px;
            border-radius: 4px;
            margin: 15px 0;
        }
        .info {
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            padding: 10px;
            border-radius: 4px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <h1>Paths-LE Help & Documentation</h1>
    
    <p>Paths-LE is a VS Code extension that extracts and analyzes file paths from various file formats including configuration files, logs, and code.</p>

    <h2>🚀 Quick Start</h2>
    <ol>
        <li>Open a file containing paths (JSON, YAML, JavaScript, etc.)</li>
        <li>Press <span class="command">Ctrl+Alt+P</span> (or <span class="command">Cmd+Alt+P</span> on Mac)</li>
        <li>View extracted paths in a new document</li>
    </ol>

    <h2>📋 Commands</h2>
    
    <h3>Extract Paths</h3>
    <p><span class="command">paths-le.extractPaths</span></p>
    <p>Extracts all file paths from the current document and displays them in a new file.</p>

    <h3>Validate Paths</h3>
    <p><span class="command">paths-le.validatePaths</span></p>
    <p>Validates extracted paths for existence and accessibility.</p>

    <h3>Analyze Paths</h3>
    <p><span class="command">paths-le.analyzePaths</span></p>
    <p>Analyzes path patterns, types, and naming conventions.</p>

    <h3>Help</h3>
    <p><span class="command">paths-le.help</span></p>
    <p>Shows this help information.</p>

    <h2>📁 Supported File Types</h2>
    <ul class="feature-list">
        <li><strong>JSON</strong> (.json) - JavaScript Object Notation</li>
        <li><strong>YAML</strong> (.yaml, .yml) - YAML Ain't Markup Language</li>
        <li><strong>JavaScript</strong> (.js) - JavaScript source files</li>
        <li><strong>TypeScript</strong> (.ts, .tsx) - TypeScript source files</li>
        <li><strong>Log Files</strong> (.log, .txt) - Log and text files</li>
        <li><strong>INI</strong> (.ini, .cfg, .conf) - Configuration files</li>
        <li><strong>CSV</strong> (.csv) - Comma-separated values</li>
        <li><strong>TOML</strong> (.toml) - Tom's Obvious, Minimal Language</li>
        <li><strong>Environment</strong> (.env) - Environment variable files</li>
    </ul>

    <h2>🔍 Path Types Detected</h2>
    <ul class="feature-list">
        <li><strong>Unix Paths</strong> - <code>/home/user/documents/file.txt</code></li>
        <li><strong>Windows Paths</strong> - <code>C:\\Users\\Documents\\file.txt</code></li>
        <li><strong>Relative Paths</strong> - <code>./config/settings.json</code></li>
        <li><strong>URL Paths</strong> - <code>https://example.com/path/to/file</code></li>
        <li><strong>File URLs</strong> - <code>file:///path/to/file</code></li>
    </ul>

    <h2>⚙️ Configuration</h2>
    <p>Access settings via <span class="command">paths-le.openSettings</span> or VS Code Settings UI.</p>
    
    <h3>Key Settings</h3>
    <ul class="feature-list">
        <li><strong>Safety Checks</strong> - Enable/disable file size warnings</li>
        <li><strong>Validation</strong> - Configure path existence and permission checks</li>
        <li><strong>Analysis</strong> - Control which analysis features are enabled</li>
        <li><strong>Output</strong> - Configure how results are displayed</li>
        <li><strong>Performance</strong> - Set performance thresholds and monitoring</li>
    </ul>

    <h2>🔧 Troubleshooting</h2>
    
    <h3>Common Issues</h3>
    
    <div class="warning">
        <strong>No paths found:</strong>
        <ul>
            <li>Ensure the document contains recognizable path patterns</li>
            <li>Check if the file type is supported</li>
            <li>Verify path format (quoted strings, variables, etc.)</li>
        </ul>
    </div>

    <div class="warning">
        <strong>Validation errors:</strong>
        <ul>
            <li>Check if paths are relative to the correct working directory</li>
            <li>Verify file permissions</li>
            <li>Ensure paths use correct path separators for your OS</li>
        </ul>
    </div>

    <div class="info">
        <strong>Performance issues:</strong>
        <ul>
            <li>Enable safety checks to prevent processing large files</li>
            <li>Use validation settings to limit checks</li>
            <li>Consider using analysis features selectively</li>
        </ul>
    </div>

    <h2>📚 Additional Resources</h2>
    <ul class="feature-list">
        <li><strong>GitHub Repository</strong> - <a href="https://github.com/nolindnaidoo/paths-le">https://github.com/nolindnaidoo/paths-le</a></li>
        <li><strong>Issues</strong> - <a href="https://github.com/nolindnaidoo/paths-le/issues">Report bugs and request features</a></li>
        <li><strong>Documentation</strong> - <a href="https://github.com/nolindnaidoo/paths-le#readme">Complete documentation</a></li>
    </ul>

    <h2>🙏 Thank You!</h2>
    <p>Thank you for using Paths-LE! If this extension has been helpful, please consider leaving a rating on the VS Code Marketplace.</p>

    <script>
        // Add any interactive features here
        console.log('Paths-LE Help WebView loaded');
    </script>
</body>
</html>
	`;
}
