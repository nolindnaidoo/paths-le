// Test cross-package imports in monorepo
import { utils } from '../../shared/src/utils.js';
import { api } from '../../../packages/backend/src/api.js';
import config from './config.json';
import styles from './styles.css';

// Test relative paths
const localFile = './components/Button.js';
const parentFile = '../assets/logo.png';

// Test absolute paths  
const absolutePath = '/usr/local/bin/node';
const windowsPath = 'C:\\Program Files\\Node\\node.exe';

// Test workspace-relative paths
const sharedUtil = 'packages/shared/src/helpers.js';
const buildScript = 'tools/build-scripts/webpack.config.js';