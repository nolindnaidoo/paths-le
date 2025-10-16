// Test file with symlink references
import utils from './utils-link.js';  // This is a symlink
import config from '../webpack-link.js';  // This is a symlink
import shared from '../shared-link/src/helpers.js';  // Through symlinked directory

// Regular paths for comparison
import regular from './regular-file.js';
import normal from '../normal-file.js';