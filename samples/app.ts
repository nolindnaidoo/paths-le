import { createServer } from './server/http';
import { attachMiddleware } from './server/middleware';
import { loadConfig } from '../config/load';
import { validateConfig } from '../config/validate';
import { registerRoutes } from './routes/index';
import { userRoutes } from './routes/users';
import { billingRoutes } from './routes/billing';
import { logger } from '../../shared/logging/logger';
import { metrics } from '../../shared/telemetry/metrics';
import { connect } from '../../shared/db/pool';
import type { Options } from './types';

const schema = require('./schemas/request.schema.json');
const defaults = require('../config/defaults.json');

export async function main(opts: Options) {
  const config = validateConfig(await loadConfig(), schema, defaults);
  const db = await connect(config.database);
  const server = createServer(config);

  attachMiddleware(server, { logger, metrics });
  registerRoutes(server, [userRoutes, billingRoutes]);

  return { server, db };
}
