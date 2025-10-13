import { bench } from 'vitest';
import { extractPaths } from '../extraction/extract';

// Test data generators
function generateJavaScriptContent(size: number): string {
	const paths = [
		'/home/user/file.txt',
		'./src/components/Button.js',
		'../utils/helpers.js',
		'C:\\Users\\John\\file.txt',
		'/var/log/app.log',
	];
	const variables: string[] = [];

	for (let i = 0; i < size; i++) {
		const path = paths[i % paths.length];
		if (path) {
			variables.push(`const path${i} = "${path}";`);
		}
	}

	return variables.join('\n');
}

function generateJsonContent(size: number): string {
	const paths = [
		'/home/user/file.txt',
		'./src/components/Button.js',
		'../utils/helpers.js',
		'C:\\Users\\John\\file.txt',
		'/var/log/app.log',
	];
	const obj = {
		files: Array.from({ length: size }, (_, i) => ({
			id: i,
			path: paths[i % paths.length],
			name: `file${i}.txt`,
		})),
	};

	return JSON.stringify(obj);
}

function generateYamlContent(size: number): string {
	const paths = [
		'/home/user/file.txt',
		'./src/components/Button.js',
		'../utils/helpers.js',
		'C:\\Users\\John\\file.txt',
		'/var/log/app.log',
	];
	const lines: string[] = [];

	for (let i = 0; i < size; i++) {
		const path = paths[i % paths.length];
		if (path) {
			lines.push(`file_${i}: "${path}"`);
		}
	}

	return lines.join('\n');
}

// Benchmark tests
bench('extractPaths: JavaScript - 1KB', async () => {
	const content = generateJavaScriptContent(50);
	await extractPaths(content, 'javascript');
});

bench('extractPaths: JavaScript - 10KB', async () => {
	const content = generateJavaScriptContent(500);
	await extractPaths(content, 'javascript');
});

bench('extractPaths: JavaScript - 100KB', async () => {
	const content = generateJavaScriptContent(5000);
	await extractPaths(content, 'javascript');
});

bench('extractPaths: JavaScript - 1MB', async () => {
	const content = generateJavaScriptContent(50000);
	await extractPaths(content, 'javascript');
});

bench('extractPaths: JSON - 1KB', async () => {
	const content = generateJsonContent(50);
	await extractPaths(content, 'json');
});

bench('extractPaths: JSON - 10KB', async () => {
	const content = generateJsonContent(500);
	await extractPaths(content, 'json');
});

bench('extractPaths: JSON - 100KB', async () => {
	const content = generateJsonContent(5000);
	await extractPaths(content, 'json');
});

bench('extractPaths: JSON - 1MB', async () => {
	const content = generateJsonContent(50000);
	await extractPaths(content, 'json');
});

bench('extractPaths: YAML - 1KB', async () => {
	const content = generateYamlContent(50);
	await extractPaths(content, 'yaml');
});

bench('extractPaths: YAML - 10KB', async () => {
	const content = generateYamlContent(500);
	await extractPaths(content, 'yaml');
});

bench('extractPaths: YAML - 100KB', async () => {
	const content = generateYamlContent(5000);
	await extractPaths(content, 'yaml');
});

bench('extractPaths: YAML - 1MB', async () => {
	const content = generateYamlContent(50000);
	await extractPaths(content, 'yaml');
});

// Memory usage tests
bench('extractPaths: Memory usage - Large JavaScript', async () => {
	const content = generateJavaScriptContent(10000);
	await extractPaths(content, 'javascript');

	// Log memory usage if available
	if (process?.memoryUsage) {
		console.log('Memory usage:', process.memoryUsage());
	}
});

bench('extractPaths: Memory usage - Large JSON', async () => {
	const content = generateJsonContent(10000);
	await extractPaths(content, 'json');

	// Log memory usage if available
	if (process?.memoryUsage) {
		console.log('Memory usage:', process.memoryUsage());
	}
});

bench('extractPaths: Memory usage - Large YAML', async () => {
	const content = generateYamlContent(10000);
	await extractPaths(content, 'yaml');

	// Log memory usage if available
	if (process?.memoryUsage) {
		console.log('Memory usage:', process.memoryUsage());
	}
});
