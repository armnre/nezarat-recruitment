import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { tenantCtx } from '../../plugins/auth.js';
import { Errors } from '../../lib/errors.js';
import type { DocumentService } from './service.js';

const idParam = z.object({ id: z.string().uuid() });

export function documentRoutes(app: FastifyInstance, { service }: { service: DocumentService }) {
  app.post('/api/v1/documents', async (req) => {
    const ctx = tenantCtx(req, 'applicant');
    const file = await req.file();
    if (!file) throw Errors.validation('فایلی انتخاب نشده است');
    const fields = z.object({ applicationId: z.string().uuid(), requiredDocumentId: z.string().uuid() }).parse({
      applicationId: (file.fields.applicationId as { value?: string } | undefined)?.value,
      requiredDocumentId: (file.fields.requiredDocumentId as { value?: string } | undefined)?.value,
    });
    let data: Buffer;
    try {
      data = await file.toBuffer();
    } catch {
      throw Errors.validation('حجم فایل بیش از حد مجاز است');
    }
    const doc = await service.upload(ctx, { ...fields, filename: file.filename, data });
    return { id: doc.id, originalName: doc.originalName, size: doc.size, mime: doc.mime, requiredDocumentId: doc.requiredDocumentId };
  });

  app.get('/api/v1/applications/:id/documents', async (req) => service.listForApplication(tenantCtx(req), idParam.parse(req.params).id));

  app.get('/api/v1/documents/:id', async (req, reply) => {
    const { doc, data } = await service.read(tenantCtx(req), idParam.parse(req.params).id);
    return reply
      .header('Content-Type', doc.mime)
      .header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'private, no-store')
      .send(data);
  });

  app.delete('/api/v1/documents/:id', async (req) => {
    await service.remove(tenantCtx(req, 'applicant'), idParam.parse(req.params).id);
    return { ok: true };
  });
}
