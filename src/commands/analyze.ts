import * as vscode from 'vscode';
import { getConfiguration } from '../config/config';
import type { Telemetry } from '../telemetry/telemetry';
import type { AnalysisResult, CommonPattern } from '../types';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import { analyzePaths } from '../utils/analysis';

export function registerAnalyzeCommand(
	context: vscode.ExtensionContext,
	deps: Readonly<{
		telemetry: Telemetry;
		notifier: Notifier;
		statusBar: StatusBar;
	}>,
): void {
	const command = vscode.commands.registerCommand(
		'paths-le.postProcess.analyze',
		async () => {
			deps.telemetry.event('command-analyze-paths');

			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				deps.notifier.showWarning('No active editor found');
				return;
			}

			try {
				deps.statusBar.showProgress('Analyzing paths...');

				const document = editor.document;
				const text = document.getText();
				const lines = text.split('\n');
				const config = getConfiguration();

				// Check if this looks like a paths file (simple heuristic)
				const pathLines = lines.filter((line) => line.trim());
				const isPathsFile =
					pathLines.length > 0 &&
					pathLines.every((line) => {
						const trimmed = line.trim();
						return trimmed === '' || /[/\\]/.test(trimmed); // Has path separators
					});

				let pathsToAnalyze: string[];
				if (isPathsFile) {
					// Parse paths directly from the current file
					pathsToAnalyze = pathLines.filter((line) => line.trim().length > 0);
				} else {
					// Extract paths from source file first
					// This would need path extraction logic - for now use existing lines
					pathsToAnalyze = lines.filter((line) => line.trim().length > 0);
				}

				// Analyze the paths
				const analysisForPaths = analyzePaths(pathsToAnalyze, config);

				// Generate analysis report
				const report = generateAnalysisReport(analysisForPaths);

				// Replace the content of the current editor
				const success = await editor.edit((editBuilder) => {
					const fullRange = new vscode.Range(
						editor.document.positionAt(0),
						editor.document.positionAt(editor.document.getText().length),
					);
					editBuilder.replace(fullRange, report);
				});

				if (success) {
					deps.notifier.showInfo(
						`Analysis complete: ${analysisForPaths.count} paths analyzed in current editor`,
					);
				} else {
					deps.notifier.showError('Failed to update the editor content');
				}
				deps.telemetry.event('analyze-success', {
					count: analysisForPaths.count,
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : 'Unknown error occurred';
				deps.notifier.showError(`Analysis failed: ${message}`);
				deps.telemetry.event('analyze-error', { error: message });
			} finally {
				deps.statusBar.hideProgress();
			}
		},
	);

	context.subscriptions.push(command);
}

function generateAnalysisReport(analysis: AnalysisResult): string {
	const lines: string[] = [];

	lines.push('# Path Analysis Report');
	lines.push('');
	lines.push(`**Total Paths:** ${analysis.count}`);
	lines.push(`**Unique Paths:** ${analysis.unique}`);
	lines.push(`**Duplicates:** ${analysis.duplicates}`);
	lines.push('');

	if (analysis.types) {
		lines.push('## Path Types');
		Object.entries(analysis.types).forEach(([type, count]) => {
			lines.push(`- ${type}: ${count}`);
		});
		lines.push('');
	}

	if (analysis.validation) {
		lines.push('## Validation Summary');
		lines.push(`- **Valid:** ${analysis.validation.valid}`);
		lines.push(`- **Invalid:** ${analysis.validation.invalid}`);
		lines.push(`- **Broken:** ${analysis.validation.broken}`);
		lines.push(`- **Inaccessible:** ${analysis.validation.inaccessible}`);
		lines.push('');
	}

	if (analysis.patterns) {
		lines.push('## Pattern Analysis');
		lines.push('### Common Patterns');
		analysis.patterns.commonPatterns.forEach((pattern: CommonPattern) => {
			lines.push(
				`- **${pattern.pattern}**: ${pattern.count} (${pattern.percentage.toFixed(1)}%)`,
			);
			pattern.examples.slice(0, 3).forEach((example: string) => {
				lines.push(`  - ${example}`);
			});
		});
		lines.push('');

		if (analysis.patterns.extensions) {
			lines.push('### File Extensions');
			Object.entries(analysis.patterns.extensions)
				.sort(([, a], [, b]) => (b as number) - (a as number))
				.slice(0, 10)
				.forEach(([ext, count]) => {
					lines.push(`- ${ext}: ${count}`);
				});
			lines.push('');
		}
	}

	return lines.join('\n');
}
