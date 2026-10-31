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
مقادیر `/etc/nezarat/nezarat.env` را پر کنید: `DATABASE_URL`، `SESSION_SECRET` (`openssl rand -base64 48`)، کلیدهای provider پیامک، `SMS_WEBHOOK_TOKEN`، `SMTP_*`.

## ۴. سرویس‌های systemd
```bash
sudo cp /opt/nezarat/deploy/shomal-nezarat*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable shomal-nezarat shomal-nezarat-worker
```

## ۵. directiveهای nginx
Plesk → دامنه → **Apache & nginx Settings → Additional nginx directives**: محتوای `deploy/nginx-additional-directives.conf` را بچسبانید. `client_max_body_size` را با `MAX_UPLOAD_MB` هماهنگ کنید (۲ مگ بیشتر). اگر «Proxy mode» فعال است و Apache لازم نیست، آن را خاموش کنید تا SPA fallback از nginx اعمال شود.
هدرهای CSP را (در صورت نیاز) در همان بخش یا «Additional headers» تنظیم کنید؛ API خودش با helmet همان CSP را می‌فرستد.

## ۶. اولین دپلوی
```bash
cd /opt/nezarat && sudo deploy/deploy.sh
( set -a; . /etc/nezarat/nezarat.env; set +a; cd apps/api && sudo -E -u nezarat node dist/cli/seed-base.js )   # tenant دانشگاه شمال و RBAC
( set -a; . /etc/nezarat/nezarat.env; set +a; cd apps/api && sudo -E -u nezarat node dist/cli/seed-admin.js ) # رمز از ADMIN_PASSWORD یا prompt
```
`deploy.sh`: بکاپ httpdocs در `/var/backups/nezarat` → `yarn install --frozen-lockfile` → build → migrate → کپی `apps/web/dist-web` به httpdocs → restart سرویس‌ها → تست `GET /api/health`.

## ۷. webhook پیامک
در پنل ارائه‌دهنده، آدرس گزارش تحویل را `https://nezarat.shomal.ac.ir/api/v1/webhooks/sms/<kavenegar|melipayamak|ippanel>?token=<SMS_WEBHOOK_TOKEN>` بگذارید.

## ۸. بررسی
```bash
curl -s https://nezarat.shomal.ac.ir/api/health      # {"status":"ok"}
journalctl -u shomal-nezarat -f
journalctl -u shomal-nezarat-worker -f
```
