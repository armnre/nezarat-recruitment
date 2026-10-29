# پلتفرم جامع جذب و گزینش اساتید

سامانهٔ چنددانشگاهی (multi-tenant) برای فراخوان، ثبت‌نام متقاضیان، رزومهٔ ساختارمند، بارگذاری امن مدارک، داوری کمیته و تصمیم نهایی.

## پنل‌ها
| نقش | امکانات |
|---|---|
| **متقاضی** | ورود با کد پیامکی، پروفایل چندمرحله‌ای، رزومهٔ علمی، مشاهده فراخوان‌ها، ثبت درخواست، بارگذاری مدارک، پیگیری وضعیت |
| **عضو کمیته** | کارتابل ارزیابی، مشاهدهٔ کامل پرونده/رزومه/مدارک، امتیازدهی وزنی، پیشنهاد و نظر، پیش‌نویس و ارسال نهایی (قفل) |
| **رئیس کمیته** | تخصیص داور با مهلت، جمع‌بندی ارزیابی‌ها، ثبت امتیاز نهایی پس از حدنصاب |
| **مدیر دانشگاه** | پیشخوان آماری، مدیریت فراخوان‌ها و مدارک و معیارها، بررسی اولیه و اعلام نقص، تصمیم نهایی، اعضای کمیته، ساختار سازمانی، خروجی CSV، رویدادنگار |

## ساختار
```
apps/api        Fastify + Drizzle + PostgreSQL (REST /api/v1)
apps/web        React + Vite + Tailwind (RTL, فونت محلی Vazirmatn)
packages/shared اسکیماهای Zod، ماشین وضعیت پرونده، تقویم جلالی
docs/ARCHITECTURE.md
```

## امنیت
- جداسازی سخت‌گیرانهٔ دانشگاه‌ها در لایهٔ سرویس (`tenantId` از نشست، نه از ورودی)
- نشست httpOnly با هش توکن در DB، CSRF double-submit، rate limit، Helmet/CSP
- RBAC نقش/مجوز؛ داور فقط پرونده‌های تخصیص‌یافته را می‌بیند
- تشخیص نوع فایل با magic bytes، بازکدگذاری تصاویر و حذف metadata، ذخیره خارج از webroot
- ثبت audit برای هر تغییر امتیاز، وضعیت، تخصیص و مشاهدهٔ پرونده؛ محافظت CSV در برابر formula injection

## اجرا
```bash
cp .env.example .env          # مقادیر را تنظیم کنید
yarn install
yarn build
yarn workspace @nezarat/api db:migrate
yarn workspace @nezarat/api seed:admin   # ساخت نخستین مدیر دانشگاه
yarn workspace @nezarat/api start        # API
yarn workspace @nezarat/api start:worker # صف پیامک/ایمیل
```
خروجی وب در `apps/web/dist-web` است و باید توسط وب‌سرور (Nginx در Plesk) سرو شود و مسیر `/api` به Node پروکسی شود.

## تست
```bash
TEST_DATABASE_URL=postgres://user:pass@localhost:5432/nezarat_test yarn test
```
