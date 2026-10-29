# معماری «سامانه جذب و گزینش اساتید»

دامنه: https://nezarat.shomal.ac.ir — مستقل از هر زیرساخت ابری؛ اجرا با Node ≥ 22 روی Plesk.

## ۱. ساختار مونوریپو (yarn workspaces)

```
nezarat/
├─ apps/
│  ├─ api/                 Fastify 5 + drizzle-orm + pg
│  │  ├─ src/server.ts     ورودی HTTP (پورت PORT=3102)
│  │  ├─ src/worker.ts     پردازش صف jobs (پیامک/ایمیل/یادآوری)
│  │  ├─ src/cli/          migrate.ts, seed-admin.ts
│  │  ├─ src/db/           schema.ts, client.ts
│  │  ├─ src/modules/      auth, tenants, profile, resume, calls, applications,
│  │  │                    documents, committee, evaluations, reports, admin, notify
│  │  ├─ src/lib/          tenant-context, rbac, jalali, errors(fa), audit
│  │  ├─ src/providers/sms kavenegar | melipayamak | ippanel | mock
│  │  └─ drizzle/          مایگریشن‌های تولیدشده
│  └─ web/                 React 18 + Vite → خروجی dist-web
└─ packages/shared/        zod schemas + types + ثابت‌های وضعیت
deploy/  docs/  .env.example
```

## ۲. لایه‌ها
- **Route** (اعتبارسنجی zod از packages/shared) → **Service** (منطق + فیلتر tenant اجباری) → **Repository/drizzle**.
- هر Service یک `TenantContext {tenantId, userId, roles, permissions}` می‌گیرد؛ هیچ تابع داده‌ای بدون tenantId وجود ندارد (کمک‌تابع `scoped(table)` شرط `tenant_id = ctx.tenantId AND deleted_at IS NULL` را می‌افزاید).
- tenant از نشست کاربر تعیین می‌شود؛ برای صفحات عمومی (فراخوان‌ها) از `slug` دانشگاه در مسیر `/api/v1/t/:slug/...`. سوپرادمین tenant ندارد و از مسیرهای `/api/v1/platform/*` استفاده می‌کند.

## ۳. امنیت
- نشست: جدول `sessions` (توکن تصادفی ۳۲ بایتی، در DB فقط hash SHA-256)، کوکی `sid` httpOnly، Secure، SameSite=Lax، انقضای لغزان.
- CSRF: double-submit — `GET /api/v1/auth/csrf` توکن وابسته به نشست می‌دهد؛ همه درخواست‌های تغییردهنده باید هدر `X-CSRF-Token` داشته باشند.
- @fastify/helmet (CSP منطبق با سرور)، @fastify/rate-limit سراسری + محدودیت ویژه OTP.
- ادمین‌ها: ایمیل + رمز argon2id. متقاضیان: موبایل + OTP.
- فایل‌ها: در `UPLOAD_DIR` خارج از webroot، نام تصادفی، بررسی magic-bytes (PDF/JPEG/PNG) و حجم، دانلود فقط از طریق API با بررسی مالکیت/نقش؛ تصاویر با sharp بازنویسی (حذف metadata).
- هیچ secret در ریپو؛ فقط `.env` و `.env.example`.

## ۴. نقش‌ها و مجوزها
| نقش | محدوده |
|---|---|
| `applicant` | پرونده و درخواست‌های خود |
| `committee_member` | پرونده‌های تخصیص‌یافته (با تخصص/حوزه) |
| `committee_chair` | + تصمیم نهایی کمیته |
| `university_admin` | کل tenant |
| `super_admin` | پلتفرم (همه tenantها) |

مجوزها ریزدانه‌اند (`calls.manage`, `applications.view_all`, `evaluations.score`, `reports.export`, ...) و در `role_permissions` به نقش وصل می‌شوند؛ یک کاربر می‌تواند چند نقش داشته باشد (`user_roles` با tenant_id).

## ۵. گردش وضعیت درخواست
```
draft → submitted → screening → (incomplete ↺ submitted) → committee_review
      → interview → scored → accepted | rejected | reserve ;  هر وضعیت → withdrawn (توسط متقاضی تا قبل از scored)
```
ماشین حالت در `packages/shared/status.ts`؛ هر انتقال در `application_status_history` و `audit_logs` ثبت و یک job اطلاع‌رسانی (پیامک+ایمیل) در صف می‌گذارد. فراخوان می‌تواند مراحل اختیاری (مثل interview) را غیرفعال کند (`calls.workflow` JSON).

## ۶. صف jobs (PostgreSQL)
جدول `jobs` با `status, run_at, attempts, locked_at`. worker با `SELECT ... FOR UPDATE SKIP LOCKED` دسته برمی‌دارد، backoff نمایی، حداکثر ۵ تلاش. انواع: `sms.otp`, `sms.notify`, `email.send`, `reminder.deadline`.

## ۷. پیامک
رابط `SmsProvider { sendOtp(mobile, code); sendTemplate(mobile, templateKey, params); parseDeliveryWebhook(req) }` با پیاده‌سازی Kavenegar، Melipayamak، IPPanel و mock (فقط وقتی `NODE_ENV!=production`). OTP: کد ۶ رقمی، hash در DB، انقضای ۲ دقیقه، ۵ تلاش ناموفق → قفل ۱۵ دقیقه، محدودیت ۳ ارسال/۱۰ دقیقه برای هر شماره و ۱۰ برای هر IP. Webhook: `POST /api/v1/webhooks/sms/:provider?token=` → به‌روزرسانی `sms_logs`.

## ۸. بومی‌سازی
DB: `timestamptz` به UTC. نمایش: تبدیل جلالی با `Intl.DateTimeFormat('fa-IR-u-ca-persian')` (بدون وابستگی) + تقویم انتخابگر شمسی سفارشی. اعداد با `toLocaleString('fa-IR')`. فونت Vazirmatn محلی (woff2). خطاهای API کد + پیام فارسی: `{error:{code,message}}`.

## ۹. مدل داده
تمام جداول: `id uuid pk`, `created_at`, `updated_at`؛ جداول داده‌ای tenant دارای `tenant_id` (FK → tenants) و ایندکس ترکیبی با آن؛ soft-delete (`deleted_at`) روی users، calls، applications، documents، اقلام رزومه، faculties، departments.

| جدول | فیلدهای کلیدی |
|---|---|
| tenants | slug (unique), name, status, plan, max_applicants, max_calls, subscription_ends_at |
| users | tenant_id (null برای سوپرادمین), mobile, email, password_hash, full_name, status, last_login_at — unique(tenant_id, mobile) |
| roles / permissions / role_permissions / user_roles | RBAC |
| sessions | user_id, token_hash, csrf_secret, expires_at, ip, user_agent |
| otp_codes | tenant_id, mobile, code_hash, expires_at, attempts, locked_until |
| applicant_profiles | user_id (unique), national_code, birth_date, gender, marital_status, father_name, address, step_completed, family JSON |
| education | profile_id, degree, field, university, country, start/end, gpa, thesis_title |
| publications | profile_id, type(journal/conference/book/chapter), title, venue, year, doi, indexing, authors, role |
| research_projects | title, employer, role, budget, start/end, status |
| teaching_experience | institution, course, level, start/end, hours |
| executive_experience | organization, position, start/end |
| patents | title, number, registration_date, country |
| faculties / departments | ساختار سازمانی |
| calls | department_id, title, description, opens_at, closes_at, status(draft/published/closed), capacity, workflow JSON |
| call_required_documents | call_id, key, title, mime_types, max_size_mb, required |
| scoring_criteria | call_id, title, category, max_score, weight, sort_order |
| applications | call_id, applicant_id, status, submitted_at, final_score, decision_note — unique(call_id, applicant_id) |
| application_status_history | application_id, from, to, changed_by, note |
| documents | owner_user_id, application_id?, required_document_id?, storage_key, original_name, mime, size, sha256 |
| committee_members | user_id, specialization, faculty_id?, active |
| committee_assignments | application_id, member_id, due_at, status |
| evaluations | assignment_id, comment, recommendation, submitted_at |
| evaluation_scores | evaluation_id, criterion_id, score — unique(evaluation_id, criterion_id) |
| notifications | user_id, channel, title, body, read_at |
| notification_templates | key, channel, body (قابل مدیریت در پنل) |
| sms_logs | mobile, kind(otp/notify), provider, provider_message_id, status, error |
| jobs | type, payload, status, run_at, attempts, last_error |
| audit_logs | actor_id, action, entity, entity_id, before, after, ip |

## ۱۰. API (پیشوند /api/v1)
`auth/*` (csrf, otp/request, otp/verify, login, logout, me) · `profile`, `resume/:section` · `t/:slug/calls` · `applications` · `documents` · `committee/assignments`, `evaluations` · `admin/*` (calls, criteria, faculties, members, templates, dashboard, reports.xlsx/pdf) · `platform/*` (tenants, users, stats) · `webhooks/sms/:provider` · `GET /api/health`.

## ۱۱. دپلوی
`node dist/server.js` و `node dist/worker.js` با systemd؛ nginx در Plesk فایل‌های dist-web را سرو و `/api/` را به 127.0.0.1:3102 پراکسی می‌کند. جزئیات در docs/DEPLOY.md.
