# دپلوی روی Plesk — nezarat.shomal.ac.ir

پیش‌نیاز: Node.js ≥ 22، Yarn 1.22، PostgreSQL ≥ 14، دسترسی root/SSH روی سرور Plesk.

## ۱. DNS و SSL
1. رکورد `A` برای `nezarat.shomal.ac.ir` به IP سرور.
2. در Plesk: **Websites & Domains → Add Subdomain/Domain** با document root پیش‌فرض `httpdocs`.
3. **SSL/TLS Certificates → Let's Encrypt** (شامل www در صورت نیاز) و فعال‌سازی «Redirect from HTTP to HTTPS».

## ۲. دیتابیس PostgreSQL
اگر PostgreSQL از طریق Plesk (Tools & Settings → Database Servers) نصب است، از **Databases → Add Database** با نوع PostgreSQL استفاده کنید. در غیر این صورت:
```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE nezarat LOGIN PASSWORD '<<رمز قوی تصادفی>>';
CREATE DATABASE nezarat OWNER nezarat ENCODING 'UTF8';
SQL
```
رمز را فقط در فایل env سرور بگذارید، نه در ریپو.

## ۳. کاربر سیستمی، کد و پوشهٔ آپلود
```bash
sudo useradd --system --home /opt/nezarat --shell /usr/sbin/nologin nezarat
sudo git clone https://github.com/armnre/nezarat-recruitment.git /opt/nezarat
sudo chown -R nezarat:nezarat /opt/nezarat
sudo install -d -o nezarat -g nezarat -m 750 /var/lib/nezarat/uploads   # UPLOAD_DIR خارج از webroot
sudo install -d -m 750 /etc/nezarat
sudo cp /opt/nezarat/.env.example /etc/nezarat/nezarat.env
sudo chown root:nezarat /etc/nezarat/nezarat.env && sudo chmod 640 /etc/nezarat/nezarat.env
```
مقادیر `/etc/nezarat/nezarat.env` را پر کنید: `DATABASE_URL`، `SESSION_SECRET` (`openssl rand -base64 48`)، کلیدهای provider پیامک، `SMS_WEBHOOK_TOKEN`، `SMTP_*`، و `TENANT_HOSTNAME=nezarat.shomal.ac.ir` (برای تشخیص دانشگاه از روی دامنه).

## ۴. سرویس‌های systemd
```bash
sudo cp /opt/nezarat/deploy/shomal-nezarat*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable shomal-nezarat shomal-nezarat-worker
```

## ۵. directiveهای nginx
Plesk → دامنه → **Apache & nginx Settings → Additional nginx directives**: محتوای `deploy/nginx-additional-directives.conf` را بچسبانید. `client_max_body_size` را با `MAX_UPLOAD_MB` هماهنگ کنید (۲ مگ بیشتر). اگر «Proxy mode» فعال است و Apache لازم نیست، آن را خاموش کنید تا SPA fallback از nginx اعمال شود.
اگر `nginx -t` (یا ذخیرهٔ تنظیمات در Plesk) خطای `duplicate location "/"` داد، یعنی Plesk خودش `location /` دارد. در این صورت بلوک `location / { try_files ... }` را حذف کنید و به جای آن این خط را (در سطح server، همان بخش Additional directives) بگذارید:
```nginx
error_page 404 =200 /index.html;
```
بلوک `/api/` هدر `X-Forwarded-Host $host` را می‌فرستد؛ API فقط وقتی آن را می‌پذیرد که درخواست از `TRUSTED_PROXY_IPS` (پیش‌فرض `127.0.0.1,::1`) آمده باشد، و در غیر این صورت از هدر `Host` معتبر استفاده می‌کند. `TRUST_PROXY=false` یعنی هیچ هدر X-Forwarded-* پذیرفته نمی‌شود.
هدرهای CSP را (در صورت نیاز) در همان بخش یا «Additional headers» تنظیم کنید؛ API خودش با helmet همان CSP را می‌فرستد.

## ۶. اولین دپلوی
```bash
cd /opt/nezarat && sudo deploy/deploy.sh
( set -a; . /etc/nezarat/nezarat.env; set +a; cd apps/api && sudo -E -u nezarat node dist/cli/seed-base.js )   # tenant دانشگاه شمال و RBAC؛ اگر TENANT_HOSTNAME تنظیم باشد hostname را هم ست می‌کند
( set -a; . /etc/nezarat/nezarat.env; set +a; cd apps/api && sudo -E -u nezarat node dist/cli/seed-admin.js ) # رمز از ADMIN_PASSWORD یا prompt
```
`deploy.sh`: بکاپ httpdocs در `/var/backups/nezarat` → `yarn install --frozen-lockfile` → build → migrate → کپی `apps/web/dist-web` به httpdocs → restart سرویس‌ها → تست `GET /api/health`.

## ۷. webhook پیامک
آدرس گزارش تحویل: `https://nezarat.shomal.ac.ir/api/v1/webhooks/sms/<kavenegar|melipayamak|ippanel>`.
- اگر پنل ارائه‌دهنده امکان هدر سفارشی دارد، توکن را در هدر `X-Webhook-Token: <SMS_WEBHOOK_TOKEN>` بفرستید (اولویت با هدر است و توکن در لاگ دسترسی nginx ثبت نمی‌شود).
- در غیر این صورت `?token=<SMS_WEBHOOK_TOKEN>` را به انتهای آدرس اضافه کنید.

توصیه: دسترسی به webhook را به IPهای اعلام‌شدهٔ ارائه‌دهنده محدود کنید (IPها را از پشتیبانی ارائه‌دهنده بگیرید). این بلوک را **قبل از** `location ^~ /api/` در Additional nginx directives بگذارید:
```nginx
location ^~ /api/v1/webhooks/sms/ {
    allow 203.0.113.10;   # IP ارائه‌دهنده — جایگزین کنید
    deny all;
    proxy_pass http://127.0.0.1:3102;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    access_log off;
}
```

## ۸. بررسی
```bash
curl -s https://nezarat.shomal.ac.ir/api/health      # {"status":"ok"}
journalctl -u shomal-nezarat -f
journalctl -u shomal-nezarat-worker -f
```

## ۹. چنددانشگاهی (سوپرادمین)
1. ساخت مدیر پلتفرم (بدون `--tenant`):
   `( set -a; . /etc/nezarat/nezarat.env; set +a; cd apps/api && sudo -E -u nezarat node dist/cli/seed-admin.js --email root@example.ir )`
2. ورود در صفحهٔ «کمیته و مدیران» با تیک «ورود مدیر پلتفرم» ← پنل `/platform`.
3. «دانشگاه جدید»: نام، شناسه، **دامنه** (مثلاً `nezarat.shomal.ac.ir`)، پلن، سقف متقاضی/فراخوان و تاریخ پایان اشتراک. سپس «افزودن مدیر» برای آن دانشگاه.
4. هر دامنهٔ دانشگاه را در Plesk به همین سرور/سرویس اشاره دهید (alias یا subscription جدا با همان nginx directives). nginx هدر `Host` را عبور می‌دهد و سامانه دانشگاه را از روی hostname تشخیص می‌دهد؛ برای tenant اول، فیلد دامنه را `nezarat.shomal.ac.ir` بگذارید.
5. سقف‌ها در API اعمال می‌شوند: با پر شدن سقف یا پایان اشتراک، ساخت فراخوان و ثبت درخواست جدید با خطای `SUBSCRIPTION_LIMIT` رد می‌شود.

خروجی‌های Excel و PDF از فونت محلی `apps/api/assets/fonts/Vazirmatn-FD` (مجوز OFL) استفاده می‌کنند؛ پوشهٔ `assets` باید کنار `dist` باقی بماند.
