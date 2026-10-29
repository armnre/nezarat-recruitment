import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { applications, callRequiredDocuments, documents } from '../../db/schema.js';
import { scoped, type TenantContext } from '../../lib/tenant.js';
import { canViewApplication, isAssignedTo } from '../../lib/access.js';
import { Errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';

/** Detects type from magic bytes — never trusts the client-provided mime/extension. */
export function sniffMime(buf: Buffer): 'application/pdf' | 'image/jpeg' | 'image/png' | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

const safeName = (n: string) => n.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150) || 'file';

export class DocumentService {
  constructor(private db: Db, private uploadDir: string, private maxMb: number) {}

  async upload(ctx: TenantContext, input: { applicationId: string; requiredDocumentId: string; filename: string; data: Buffer }) {
    const [app] = await this.db.select().from(applications)
      .where(scoped(ctx, applications, eq(applications.id, input.applicationId), eq(applications.applicantId, ctx.userId))).limit(1);
    if (!app) throw Errors.notFound('درخواست');
    if (!['draft', 'incomplete'].includes(app.status)) throw Errors.validation('پس از ارسال درخواست امکان تغییر مدارک وجود ندارد');
    const [req] = await this.db.select().from(callRequiredDocuments)
      .where(and(eq(callRequiredDocuments.tenantId, ctx.tenantId), eq(callRequiredDocuments.id, input.requiredDocumentId), eq(callRequiredDocuments.callId, app.callId))).limit(1);
    if (!req) throw Errors.notFound('نوع مدرک');

    const limitMb = Math.min(req.maxSizeMb, this.maxMb);
    if (input.data.length > limitMb * 1024 * 1024) throw Errors.validation(`حجم فایل نباید بیش از ${limitMb} مگابایت باشد`);
    const mime = sniffMime(input.data);
    if (!mime || !req.mimeTypes.includes(mime)) throw Errors.validation('نوع فایل مجاز نیست؛ فقط PDF، JPG یا PNG');

    // Re-encode images: strips metadata and neutralises polyglot payloads.
    const data = mime === 'application/pdf' ? input.data
      : await sharp(input.data).rotate()[mime === 'image/png' ? 'png' : 'jpeg']().toBuffer();

    const storageKey = `${ctx.tenantId}/${randomUUID()}`;
    const full = path.join(this.uploadDir, storageKey);
    await mkdir(path.dirname(full), { recursive: true, mode: 0o750 });
    await writeFile(full, data, { mode: 0o640 });

    return this.db.transaction(async (tx) => {
      // one active file per required document: soft-delete previous
      await tx.update(documents).set({ deletedAt: new Date() })
        .where(and(eq(documents.tenantId, ctx.tenantId), eq(documents.applicationId, app.id), eq(documents.requiredDocumentId, req.id), isNull(documents.deletedAt)));
      const [doc] = await tx.insert(documents).values({
        tenantId: ctx.tenantId, ownerUserId: ctx.userId, applicationId: app.id, requiredDocumentId: req.id,
        storageKey, originalName: safeName(input.filename), mime, size: data.length,
        sha256: createHash('sha256').update(data).digest('hex'),
      }).returning();
      await audit(tx, { tenantId: ctx.tenantId, actorId: ctx.userId, action: 'document.upload', entity: 'documents', entityId: doc.id, ip: ctx.ip });
      return doc;
    });
  }

  async listForApplication(ctx: TenantContext, applicationId: string) {
    const [app] = await this.db.select({ id: applications.id, applicantId: applications.applicantId }).from(applications)
      .where(scoped(ctx, applications, eq(applications.id, applicationId))).limit(1);
    if (!app || !(await canViewApplication(this.db, ctx, app))) throw Errors.notFound('درخواست');
    return this.db.select({
      id: documents.id, requiredDocumentId: documents.requiredDocumentId, originalName: documents.originalName,
      mime: documents.mime, size: documents.size, createdAt: documents.createdAt,
    }).from(documents).where(scoped(ctx, documents, eq(documents.applicationId, applicationId)));
  }

  /** Owner, tenant admins, or committee members assigned to the application. */
  async read(ctx: TenantContext, id: string) {
    const [doc] = await this.db.select().from(documents).where(scoped(ctx, documents, eq(documents.id, id))).limit(1);
    if (!doc) throw Errors.notFound('فایل');
    let allowed = doc.ownerUserId === ctx.userId || ctx.permissions.includes('applications.view_all');
    if (!allowed && doc.applicationId) allowed = ctx.permissions.includes('evaluations.finalize') || (await isAssignedTo(this.db, ctx, doc.applicationId));
    if (!allowed) throw Errors.notFound('فایل');
    const data = await readFile(path.join(this.uploadDir, doc.storageKey));
    return { doc, data };
  }

  async remove(ctx: TenantContext, id: string) {
    const [doc] = await this.db.select().from(documents).where(scoped(ctx, documents, eq(documents.id, id), eq(documents.ownerUserId, ctx.userId))).limit(1);
    if (!doc) throw Errors.notFound('فایل');
    if (doc.applicationId) {
      const [app] = await this.db.select({ status: applications.status }).from(applications).where(eq(applications.id, doc.applicationId));
      if (app && !['draft', 'incomplete'].includes(app.status)) throw Errors.validation('پس از ارسال درخواست امکان حذف مدارک وجود ندارد');
    }
    await this.db.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, id));
  }
}
