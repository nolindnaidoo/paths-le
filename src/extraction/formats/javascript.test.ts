import { describe, expect, it } from 'vitest';
import { extractFromJavaScript } from './javascript';

describe('extractFromJavaScript', () => {
	it('should extract ES6 import statements', () => {
		const content = `import React from './components/App';
import { Button } from './components/Button';
import * as utils from '../utils/helpers';`;

		const result = extractFromJavaScript(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('./components/App');
		expect(result[1]?.value).toBe('./components/Button');
		expect(result[2]?.value).toBe('../utils/helpers');
	});

	it('should extract dynamic import statements', () => {
		const content = `const module = import('./dynamic/module');
const lazy = import('../lazy/component');`;

		const result = extractFromJavaScript(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./dynamic/module');
		expect(result[1]?.value).toBe('../lazy/component');
	});

	it('should extract CommonJS require statements', () => {
		const content = `const fs = require('fs');
const path = require('./utils/path');
const config = require('../config/settings');`;

		const result = extractFromJavaScript(content);
		expect(result).toHaveLength(2); // 'fs' is excluded as it's not a path
		expect(result[0]?.value).toBe('./utils/path');
		expect(result[1]?.value).toBe('../config/settings');
	});

	it('should extract ES6 export statements', () => {
		const content = `export { default } from './components/App';
export * from '../utils/helpers';`;

		const result = extractFromJavaScript(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./components/App');
		expect(result[1]?.value).toBe('../utils/helpers');
	});

	it('should extract absolute paths', () => {
		const content = `import module from '/absolute/path/module';
require('/another/absolute/path');`;

		const result = extractFromJavaScript(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('/absolute/path/module');
		expect(result[1]?.value).toBe('/another/absolute/path');
	});

	it('should extract Windows absolute paths', () => {
		const content = `import config from 'C:\\\\Users\\\\name\\\\config';
require('D:\\\\project\\\\file');`;

		const result = extractFromJavaScript(content);
		expect(result).toHaveLength(2);
		// The regex extracts the literal string content between quotes, which includes the double backslashes
		expect(result[0]?.value).toBe('C:\\\\Users\\\\name\\\\config');
		expect(result[1]?.value).toBe('D:\\\\project\\\\file');
	});

	it('should extract URLs', () => {
		const content = `import module from 'https://cdn.example.com/module.js';
const script = require('http://example.com/script.js');`;

		const result = extractFromJavaScript(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('https://cdn.example.com/module.js');
		expect(result[1]?.value).toBe('http://example.com/script.js');
	});

	it('should exclude package names', () => {
		const content = `import React from 'react';
import { useState } from 'react';
const express = require('express');
const lodash = require('lodash');
import { Button } from '@mui/material';`;

		const result = extractFromJavaScript(content);
		expect(result).toHaveLength(0); // All are package names, not file paths
	});

	it('should handle mixed import styles', () => {
		const content = `import pkg from 'package-name';
import local from './local/file';
const remote = require('remote-package');
const file = require('./file/path');`;

		const result = extractFromJavaScript(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('./local/file');
		expect(result[1]?.value).toBe('./file/path');
	});

	it('should handle empty content', () => {
		expect(extractFromJavaScript('')).toEqual([]);
		expect(extractFromJavaScript('   ')).toEqual([]);
	});

	it('should include line and column positions', () => {
		const content = `import App from './App';`;

		const result = extractFromJavaScript(content);
		expect(result[0]?.position.line).toBe(1);
		expect(result[0]?.position.column).toBeGreaterThan(0);
	});

	it('should include context information', () => {
		const content = `import App from './App';
require('./config');
import('./dynamic');
export * from './utils';`;

		const result = extractFromJavaScript(content);
		expect(result[0]?.context).toContain('import');
		expect(result[1]?.context).toContain('require');
		expect(result[2]?.context).toContain('dynamic import');
		expect(result[3]?.context).toContain('export');
	});

	it('should classify path types correctly', () => {
		const content = `import a from './relative';
import b from '/absolute';
import c from 'https://url.com/file';`;

		const result = extractFromJavaScript(content);
		expect(result[0]?.type).toBe('relative');
		expect(result[1]?.type).toBe('absolute');
		expect(result[2]?.type).toBe('url');
	});
});
