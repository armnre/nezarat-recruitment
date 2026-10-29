/**
 * Creates/updates an admin user.
 *   node dist/cli/seed-admin.js --email admin@shomal.ac.ir --name "مدیر" [--tenant shomal] [--role university_admin|super_admin]
 * Password: from ADMIN_PASSWORD env, otherwise prompted (hidden). Never hard-coded.
 */
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline';
import argon2 from 'argon2';
import { and, eq, isNull } from 'drizzle-orm';
import { createDb } from '../db/client.js';
import { seedRbac } from '../db/rbac-seed.js';
import { roles, tenants, userRoles, users } from '../db/schema.js';

const { values } = parseArgs({
  options: { email: { type: 'string' }, name: { type: 'string', default: 'مدیر سامانه' }, tenant: { type: 'string' }, role: { type: 'string' } },
});
if (!values.email) throw new Error('--email الزامی است');
const role = values.role ?? (values.tenant ? 'university_admin' : 'super_admin');
if (!['university_admin', 'super_admin'].includes(role)) throw new Error('نقش نامعتبر');
if (role === 'university_admin' && !values.tenant) throw new Error('برای university_admin پارامتر --tenant لازم است');

async function promptHidden(q: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  let muted = false;
  out._writeToOutput = (s: string) => { if (!muted) out.output.write(s); };
  return new Promise((res) => {
    rl.question(q, (a) => { rl.close(); process.stdout.write('\n'); res(a); });
    muted = true;
  });
}

const password = process.env.ADMIN_PASSWORD || (await promptHidden('Password: '));
if (password.length < 12) throw new Error('رمز عبور باید حداقل ۱۲ کاراکتر باشد');

const { db, pool } = createDb(process.env.DATABASE_URL ?? '');
await seedRbac(db);
let tenantId: string | null = null;
if (values.tenant) {
  const [t] = await db.select().from(tenants).where(eq(tenants.slug, values.tenant));
  if (!t) throw new Error(`tenant "${values.tenant}" یافت نشد`);
  tenantId = t.id;
}
const email = values.email.toLowerCase();
const hash = await argon2.hash(password, { type: argon2.argon2id });
const [existing] = await db.select().from(users)
  .where(and(tenantId ? eq(users.tenantId, tenantId) : isNull(users.tenantId), eq(users.email, email)));
const user = existing
  ? (await db.update(users).set({ passwordHash: hash, fullName: values.name }).where(eq(users.id, existing.id)).returning())[0]
  : (await db.insert(users).values({ tenantId, email, fullName: values.name!, passwordHash: hash }).returning())[0];
const [r] = await db.select().from(roles).where(eq(roles.key, role));
await db.insert(userRoles).values({ tenantId, userId: user.id, roleId: r.id }).onConflictDoNothing();
await pool.end();
console.log(`admin ${email} (${role}) ready`);
