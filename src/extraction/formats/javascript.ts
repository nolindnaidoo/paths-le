import type { Path } from '../../types';

/**
 * Extract paths from JavaScript/TypeScript files
 * Extracts import/require/export statements with reliable patterns
 */
export function extractFromJavaScript(content: string): Path[] {
	if (content.trim().length === 0) return [];

	const paths: Path[] = [];
	const lines = content.split('\n');

	// Patterns for reliable extraction
	const patterns = [
		// ES6 import: import x from './path'
		/import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g,
		// Dynamic import: import('./path')
		/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
		// CommonJS require: require('./path')
		/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
		// ES6 export: export x from './path'
		/export\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g,
	];

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		if (!line) continue;

		for (const pattern of patterns) {
			// Reset regex lastIndex for each line
			pattern.lastIndex = 0;
			let match: RegExpExecArray | null;

			while ((match = pattern.exec(line)) !== null) {
				const pathValue = match[1];
				if (pathValue && isModulePath(pathValue)) {
					paths.push({
						value: pathValue,
						type: classifyPathType(pathValue),
						position: {
							line: lineIndex + 1,
							column: match.index + 1,
						},
						context: `JS ${getImportType(match[0])}`,
					});
				}
			}
		}
	}

	return paths;
}

/**
 * Check if a string is a module path (not a package name)
 * Valid paths start with: ./ ../ / or are absolute (C:\ etc)
 */
function isModulePath(value: string): boolean {
	if (!value || value.length < 2) return false;

	// Relative paths
	if (value.startsWith('./') || value.startsWith('../')) return true;

	// Absolute Unix paths
	if (value.startsWith('/')) return true;

	// Absolute Windows paths
	if (/^[A-Za-z]:[/\\]/.test(value)) return true;

	// URLs
	if (value.startsWith('http://') || value.startsWith('https://')) return true;
	if (value.startsWith('file://')) return true;

	// Not a file path - likely a package name like 'react' or '@org/package'
	return false;
}

/**
 * Determine the type of import statement
 */
function getImportType(statement: string): string {
	if (statement.includes('require')) return 'require';
	if (statement.includes('export')) return 'export';
	if (statement.includes('import(')) return 'dynamic import';
	return 'import';
}

/**
 * Classify the type of path
 */
function classifyPathType(
	path: string,
): 'file' | 'directory' | 'relative' | 'absolute' | 'url' | 'unknown' {
	if (
		path.startsWith('http://') ||
		path.startsWith('https://') ||
		path.startsWith('file://')
	) {
		return 'url';
	}
	if (path.startsWith('/')) {
		return 'absolute';
	}
	if (
		path.startsWith('C:\\') ||
		path.startsWith('D:\\') ||
		/^[A-Za-z]:[/\\]/.test(path)
	) {
		return 'absolute';
	}
	if (path.startsWith('./') || path.startsWith('../')) {
		return 'relative';
	}
	if (path.includes('.')) {
		return 'file';
	}
	return 'unknown';
}
