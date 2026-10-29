import 'dotenv/config';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { buildApp } from './app.js';

const cfg = loadConfig();
const { db, pool } = createDb(cfg.DATABASE_URL);
const app = await buildApp(cfg, db, { logger: true });

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: cfg.PORT, host: cfg.HOST });
