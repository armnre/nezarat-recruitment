import {
  pgTable, uuid, text, timestamp, integer, boolean, jsonb, numeric, date, index, uniqueIndex, pgEnum, primaryKey,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const ts = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
const softDelete = () => ({ deletedAt: timestamp('deleted_at', { withTimezone: true }) });
const tenantRef = () => uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'restrict' });

export const applicationStatus = pgEnum('application_status', [
  'draft', 'submitted', 'screening', 'incomplete', 'committee_review', 'interview', 'scored', 'accepted', 'rejected', 'reserve', 'withdrawn',
]);
export const callStatus = pgEnum('call_status', ['draft', 'published', 'closed']);
export const jobStatus = pgEnum('job_status', ['pending', 'running', 'done', 'failed']);

export const tenants = pgTable('tenants', {
  id: id(), slug: text('slug').notNull().unique(), name: text('name').notNull(),
  status: text('status').notNull().default('active'), plan: text('plan').notNull().default('basic'),
  maxApplicants: integer('max_applicants').notNull().default(1000), maxCalls: integer('max_calls').notNull().default(20),
  subscriptionEndsAt: timestamp('subscription_ends_at', { withTimezone: true }), ...ts(),
});

export const users = pgTable('users', {
  id: id(), tenantId: uuid('tenant_id').references(() => tenants.id),
  mobile: text('mobile'), email: text('email'), passwordHash: text('password_hash'),
  fullName: text('full_name').notNull().default(''), status: text('status').notNull().default('active'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }), ...ts(), ...softDelete(),
}, (t) => [uniqueIndex('users_tenant_mobile').on(t.tenantId, t.mobile), uniqueIndex('users_tenant_email').on(t.tenantId, t.email)]);

export const roles = pgTable('roles', { id: id(), key: text('key').notNull().unique(), title: text('title').notNull(), ...ts() });
export const permissions = pgTable('permissions', { id: id(), key: text('key').notNull().unique(), title: text('title').notNull(), ...ts() });
export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })]);
export const userRoles = pgTable('user_roles', {
  id: id(), tenantId: uuid('tenant_id').references(() => tenants.id),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id), ...ts(),
}, (t) => [uniqueIndex('user_roles_uniq').on(t.userId, t.roleId)]);

export const sessions = pgTable('sessions', {
  id: id(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(), csrfSecret: text('csrf_secret').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), ip: text('ip'), userAgent: text('user_agent'), ...ts(),
});

export const otpCodes = pgTable('otp_codes', {
  id: id(), tenantId: tenantRef(), mobile: text('mobile').notNull(), codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), attempts: integer('attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }), consumedAt: timestamp('consumed_at', { withTimezone: true }),
  ip: text('ip'), ...ts(),
}, (t) => [index('otp_mobile_idx').on(t.tenantId, t.mobile, t.createdAt)]);

export const faculties = pgTable('faculties', { id: id(), tenantId: tenantRef(), name: text('name').notNull(), ...ts(), ...softDelete() },
  (t) => [index('faculties_tenant').on(t.tenantId)]);
export const departments = pgTable('departments', {
  id: id(), tenantId: tenantRef(), facultyId: uuid('faculty_id').notNull().references(() => faculties.id), name: text('name').notNull(), ...ts(), ...softDelete(),
}, (t) => [index('departments_tenant').on(t.tenantId, t.facultyId)]);

export const applicantProfiles = pgTable('applicant_profiles', {
  id: id(), tenantId: tenantRef(), userId: uuid('user_id').notNull().unique().references(() => users.id),
  nationalCode: text('national_code'), firstName: text('first_name'), lastName: text('last_name'), fatherName: text('father_name'),
  birthDate: date('birth_date'), gender: text('gender'), maritalStatus: text('marital_status'),
  province: text('province'), city: text('city'), address: text('address'), email: text('email'),
  family: jsonb('family').$type<{ spouseName?: string; childrenCount?: number }>(),
  stepCompleted: integer('step_completed').notNull().default(0), ...ts(),
}, (t) => [index('profiles_tenant').on(t.tenantId)]);

const resumeBase = () => ({
  id: id(), tenantId: tenantRef(),
  profileId: uuid('profile_id').notNull().references(() => applicantProfiles.id, { onDelete: 'cascade' }), ...ts(), ...softDelete(),
});
export const education = pgTable('education', {
  ...resumeBase(), degree: text('degree').notNull(), field: text('field').notNull(), university: text('university').notNull(),
  country: text('country'), startDate: date('start_date'), endDate: date('end_date'), gpa: numeric('gpa'), thesisTitle: text('thesis_title'),
}, (t) => [index('education_profile').on(t.tenantId, t.profileId)]);
export const publications = pgTable('publications', {
  ...resumeBase(), type: text('type').notNull(), title: text('title').notNull(), venue: text('venue'), year: integer('year'),
  doi: text('doi'), indexing: text('indexing'), authors: text('authors'), role: text('role'),
}, (t) => [index('publications_profile').on(t.tenantId, t.profileId)]);
export const researchProjects = pgTable('research_projects', {
  ...resumeBase(), title: text('title').notNull(), employer: text('employer'), role: text('role'), budget: numeric('budget'),
  startDate: date('start_date'), endDate: date('end_date'), status: text('status'),
}, (t) => [index('research_profile').on(t.tenantId, t.profileId)]);
export const teachingExperience = pgTable('teaching_experience', {
  ...resumeBase(), institution: text('institution').notNull(), course: text('course').notNull(), level: text('level'),
  startDate: date('start_date'), endDate: date('end_date'), hours: integer('hours'),
}, (t) => [index('teaching_profile').on(t.tenantId, t.profileId)]);
export const executiveExperience = pgTable('executive_experience', {
  ...resumeBase(), organization: text('organization').notNull(), position: text('position').notNull(), startDate: date('start_date'), endDate: date('end_date'),
}, (t) => [index('executive_profile').on(t.tenantId, t.profileId)]);
export const patents = pgTable('patents', {
  ...resumeBase(), title: text('title').notNull(), number: text('number'), registrationDate: date('registration_date'), country: text('country'),
}, (t) => [index('patents_profile').on(t.tenantId, t.profileId)]);

export const calls = pgTable('calls', {
  id: id(), tenantId: tenantRef(), departmentId: uuid('department_id').references(() => departments.id),
  title: text('title').notNull(), description: text('description').notNull().default(''),
  opensAt: timestamp('opens_at', { withTimezone: true }).notNull(), closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
  status: callStatus('status').notNull().default('draft'), capacity: integer('capacity'),
  workflow: jsonb('workflow').$type<{ interview: boolean; minReviewers: number }>().notNull().default({ interview: true, minReviewers: 2 }),
  createdBy: uuid('created_by').references(() => users.id), ...ts(), ...softDelete(),
}, (t) => [index('calls_tenant_status').on(t.tenantId, t.status)]);
export const callRequiredDocuments = pgTable('call_required_documents', {
  id: id(), tenantId: tenantRef(), callId: uuid('call_id').notNull().references(() => calls.id, { onDelete: 'cascade' }),
  key: text('key').notNull(), title: text('title').notNull(), mimeTypes: text('mime_types').array().notNull(),
  maxSizeMb: integer('max_size_mb').notNull().default(5), required: boolean('required').notNull().default(true), ...ts(),
}, (t) => [uniqueIndex('crd_call_key').on(t.callId, t.key)]);
export const scoringCriteria = pgTable('scoring_criteria', {
  id: id(), tenantId: tenantRef(), callId: uuid('call_id').notNull().references(() => calls.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), category: text('category'), maxScore: integer('max_score').notNull(),
  weight: numeric('weight').notNull().default('1'), sortOrder: integer('sort_order').notNull().default(0), ...ts(),
}, (t) => [index('criteria_call').on(t.tenantId, t.callId)]);

export const applications = pgTable('applications', {
  id: id(), tenantId: tenantRef(), callId: uuid('call_id').notNull().references(() => calls.id),
  applicantId: uuid('applicant_id').notNull().references(() => users.id),
  status: applicationStatus('status').notNull().default('draft'), submittedAt: timestamp('submitted_at', { withTimezone: true }),
  finalScore: numeric('final_score'), decisionNote: text('decision_note'), ...ts(), ...softDelete(),
}, (t) => [uniqueIndex('applications_call_applicant').on(t.callId, t.applicantId), index('applications_tenant_status').on(t.tenantId, t.status)]);
export const applicationStatusHistory = pgTable('application_status_history', {
  id: id(), tenantId: tenantRef(), applicationId: uuid('application_id').notNull().references(() => applications.id),
  fromStatus: applicationStatus('from_status'), toStatus: applicationStatus('to_status').notNull(),
  changedBy: uuid('changed_by').references(() => users.id), note: text('note'), ...ts(),
}, (t) => [index('ash_app').on(t.tenantId, t.applicationId)]);

export const documents = pgTable('documents', {
  id: id(), tenantId: tenantRef(), ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
  applicationId: uuid('application_id').references(() => applications.id),
  requiredDocumentId: uuid('required_document_id').references(() => callRequiredDocuments.id),
  storageKey: text('storage_key').notNull().unique(), originalName: text('original_name').notNull(),
  mime: text('mime').notNull(), size: integer('size').notNull(), sha256: text('sha256').notNull(), ...ts(), ...softDelete(),
}, (t) => [index('documents_owner').on(t.tenantId, t.ownerUserId), index('documents_app').on(t.tenantId, t.applicationId)]);

export const committeeMembers = pgTable('committee_members', {
  id: id(), tenantId: tenantRef(), userId: uuid('user_id').notNull().references(() => users.id),
  specialization: text('specialization'), facultyId: uuid('faculty_id').references(() => faculties.id),
  active: boolean('active').notNull().default(true), ...ts(),
}, (t) => [uniqueIndex('cm_tenant_user').on(t.tenantId, t.userId)]);
export const committeeAssignments = pgTable('committee_assignments', {
  id: id(), tenantId: tenantRef(), applicationId: uuid('application_id').notNull().references(() => applications.id),
  memberId: uuid('member_id').notNull().references(() => committeeMembers.id),
  dueAt: timestamp('due_at', { withTimezone: true }), status: text('status').notNull().default('pending'), ...ts(),
}, (t) => [uniqueIndex('ca_app_member').on(t.applicationId, t.memberId), index('ca_member').on(t.tenantId, t.memberId)]);
export const evaluations = pgTable('evaluations', {
  id: id(), tenantId: tenantRef(), assignmentId: uuid('assignment_id').notNull().unique().references(() => committeeAssignments.id),
  comment: text('comment'), recommendation: text('recommendation'), totalScore: numeric('total_score'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }), ...ts(),
});
export const evaluationScores = pgTable('evaluation_scores', {
  id: id(), tenantId: tenantRef(), evaluationId: uuid('evaluation_id').notNull().references(() => evaluations.id, { onDelete: 'cascade' }),
  criterionId: uuid('criterion_id').notNull().references(() => scoringCriteria.id), score: numeric('score').notNull(), ...ts(),
}, (t) => [uniqueIndex('es_eval_criterion').on(t.evaluationId, t.criterionId)]);

export const notificationTemplates = pgTable('notification_templates', {
  id: id(), tenantId: tenantRef(), key: text('key').notNull(), channel: text('channel').notNull(),
  subject: text('subject'), body: text('body').notNull(), providerTemplate: text('provider_template'), ...ts(),
}, (t) => [uniqueIndex('nt_tenant_key_channel').on(t.tenantId, t.key, t.channel)]);
export const notifications = pgTable('notifications', {
  id: id(), tenantId: tenantRef(), userId: uuid('user_id').notNull().references(() => users.id),
  channel: text('channel').notNull(), title: text('title').notNull(), body: text('body').notNull(),
  readAt: timestamp('read_at', { withTimezone: true }), ...ts(),
}, (t) => [index('notifications_user').on(t.tenantId, t.userId, t.createdAt)]);
export const smsLogs = pgTable('sms_logs', {
  id: id(), tenantId: uuid('tenant_id').references(() => tenants.id), mobile: text('mobile').notNull(), kind: text('kind').notNull(),
  provider: text('provider').notNull(), providerMessageId: text('provider_message_id'),
  status: text('status').notNull().default('queued'), error: text('error'), ...ts(),
}, (t) => [index('sms_provider_msg').on(t.provider, t.providerMessageId)]);
export const jobs = pgTable('jobs', {
  id: id(), tenantId: uuid('tenant_id').references(() => tenants.id), type: text('type').notNull(), payload: jsonb('payload').notNull(),
  status: jobStatus('status').notNull().default('pending'), runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
  attempts: integer('attempts').notNull().default(0), lockedAt: timestamp('locked_at', { withTimezone: true }), lastError: text('last_error'), ...ts(),
}, (t) => [index('jobs_pick').on(t.status, t.runAt)]);
export const auditLogs = pgTable('audit_logs', {
  id: id(), tenantId: uuid('tenant_id').references(() => tenants.id), actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(), entity: text('entity').notNull(), entityId: uuid('entity_id'),
  before: jsonb('before'), after: jsonb('after'), ip: text('ip'), ...ts(),
}, (t) => [index('audit_tenant_entity').on(t.tenantId, t.entity, t.entityId)]);
