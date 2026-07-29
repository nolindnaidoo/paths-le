import fs from 'node:fs';
import { helper } from './utils/helper';
import * as appConfig from '../config/app.config.js';
import 'https://cdn.example.com/lib.js';
import './styles/global.css';
const legacy = require('./legacy/module.js');
const pkg = require('react');
const loader = import('./dynamic/loader.js');
export { thing } from './exports/thing';
export * from '/absolute/path/module';
import {
	alpha,
	beta,
} from './multiline/import-target.js';
const notAnImport = '/etc/hosts';
const winPath = require('C:\\Program Files\\app\\main.js');
const fileUrl = require('file:///opt/data/blob.bin');
