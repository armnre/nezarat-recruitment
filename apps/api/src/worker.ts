import 'dotenv/config';
import pino from 'pino';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { runOnce } from './jobs/processor.js';
import { createMailer } from './providers/email.js';
import { createSmsProvider } from './providers/sms/index.js';

const cfg = loadConfig();
const logger = pino({ name: 'nezarat-worker' });
const log = (msg: string, data: object = {}) => logger.info(data, msg);
const { db, pool } = createDb(cfg.DATABASE_URL);
const deps = { db, sms: createSmsProvider(cfg, fetch, log), mailer: createMailer(cfg, log), log };

let stopping = false;
let wake: (() => void) | null = null;

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'در حال توقف worker؛ منتظر اتمام دستهٔ جاری');
  wake?.();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

logger.info({ provider: deps.sms.name }, 'worker شروع شد');
while (!stopping) {
  let n = 0;
  try {
    n = await runOnce(deps, { batch: cfg.WORKER_BATCH, staleMinutes: cfg.WORKER_STALE_MINUTES });
  } catch (e) {
    logger.error(e, 'خطا در حلقهٔ worker');
  }
  if (n === 0 && !stopping) {
    await new Promise<void>((r) => {
      const t = setTimeout(r, cfg.WORKER_POLL_MS);
      wake = () => { clearTimeout(t); r(); };
    });
    wake = null;
  }
}
await pool.end();
logger.info('worker متوقف شد');
process.exit(0);
