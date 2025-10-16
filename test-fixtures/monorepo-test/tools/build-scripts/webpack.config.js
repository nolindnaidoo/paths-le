// Webpack configuration for monorepo
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
