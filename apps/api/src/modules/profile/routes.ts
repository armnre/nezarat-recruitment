import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { familyStepSchema, identityStepSchema, RESUME_SECTIONS, type ResumeSection } from '@nezarat/shared';
import { tenantCtx } from '../../plugins/auth.js';
import type { ProfileService } from './service.js';

const sectionParam = z.object({ section: z.enum(RESUME_SECTIONS as [ResumeSection, ...ResumeSection[]], { message: 'بخش نامعتبر است' }) });
const itemParam = sectionParam.extend({ id: z.string().uuid() });

export function profileRoutes(app: FastifyInstance, { service }: { service: ProfileService }) {
  app.get('/api/v1/profile', async (req) => {
    const ctx = tenantCtx(req, 'applicant');
    const profile = await service.mine(ctx);
    return { profile, resume: await service.fullResume(ctx, profile.id) };
  });
  app.put('/api/v1/profile/identity', async (req) => service.saveIdentity(tenantCtx(req, 'applicant'), identityStepSchema.parse(req.body)));
  app.put('/api/v1/profile/family', async (req) => service.saveFamily(tenantCtx(req, 'applicant'), familyStepSchema.parse(req.body)));
  app.post('/api/v1/profile/education-done', async (req) => {
    await service.markEducationStep(tenantCtx(req, 'applicant'));
    return { ok: true };
  });

  app.post('/api/v1/resume/:section', async (req) => {
    const { section } = sectionParam.parse(req.params);
    return service.addItem(tenantCtx(req, 'applicant'), section, req.body);
  });
  app.put('/api/v1/resume/:section/:id', async (req) => {
    const { section, id } = itemParam.parse(req.params);
    return service.updateItem(tenantCtx(req, 'applicant'), section, id, req.body);
  });
  app.delete('/api/v1/resume/:section/:id', async (req) => {
    const { section, id } = itemParam.parse(req.params);
    await service.deleteItem(tenantCtx(req, 'applicant'), section, id);
    return { ok: true };
  });
}
