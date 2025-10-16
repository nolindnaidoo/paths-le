// Additional shared helper functions
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
  'C:\\Windows\\System32\\file.exe',
  'packages/frontend/src/main.js',
  'tools/build-scripts/webpack.config.js',
]
