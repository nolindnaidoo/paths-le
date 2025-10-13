// Sample JavaScript file with various import/require patterns
// Test Paths-LE extraction on this file!

// ES6 imports - relative paths

// Dynamic imports
const LazyComponent = import('./components/LazyLoad')
const asyncModule = import('../modules/async')

// CommonJS require - local files
const path = require('./utils/path')
const logger = require('../services/logger')
const dbConfig = require('./config/database')

// ES6 export statements
export * from '../components/shared'
export { default as MainApp } from './App'

// Absolute paths (less common but supported)
const absoluteRequire = require('/var/www/html/config')

// Windows absolute paths (if working cross-platform)
// import winPath from 'C:\\Users\\Developer\\project\\config';
// const winConfig = require('D:\\projects\\app\\settings');

// URLs (CDN imports, edge cases)
const remoteScript = require('http://example.com/scripts/app.js')

// Package imports (should be excluded - not file paths)
const express = require('express')
const axios = require('axios')

// Mixed imports showing what gets extracted vs ignored
const fileRequire = require('./file/path') // ✅ Extracted
const pkgRequire = require('remote-package') // ❌ Ignored (package)
