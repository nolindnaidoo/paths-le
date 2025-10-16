#!/bin/bash
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

# Create some additional test files
touch packages/frontend/src/regular-file.js
touch packages/frontend/normal-file.js
touch packages/shared/src/helpers.js

echo "✅ Symlinks created successfully!"
echo ""
echo "📁 Test structure:"
find . -type l -exec ls -la {} \;
echo ""
echo "🚀 Ready to test! Open workspace.code-workspace in VS Code"
