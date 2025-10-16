// Test cross-package imports in monorepo

// Test relative paths
const localFile = './components/Button.js'
const parentFile = '../assets/logo.png'

// Test absolute paths
const absolutePath = '/usr/local/bin/node'
const windowsPath = 'C:\\Program Files\\Node\\node.exe'

// Test workspace-relative paths
const sharedUtil = 'packages/shared/src/helpers.js'
const buildScript = 'tools/build-scripts/webpack.config.js'
