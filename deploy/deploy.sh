#!/usr/bin/env bash
# Usage: sudo deploy/deploy.sh   (run from the repo checkout, e.g. /opt/nezarat)
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
HTTPDOCS="${HTTPDOCS:-/var/www/vhosts/nezarat.shomal.ac.ir/httpdocs}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nezarat}"
ENV_FILE="${ENV_FILE:-/etc/nezarat/nezarat.env}"
RUN_AS="${RUN_AS:-nezarat}"
WEB_OWNER="${WEB_OWNER:-$(stat -c '%U:%G' "$HTTPDOCS")}"
PORT="${PORT:-3102}"

cd "$APP_DIR"
echo "==> backup httpdocs"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
tar -czf "$BACKUP_DIR/httpdocs-$STAMP.tar.gz" -C "$HTTPDOCS" .

echo "==> install & build"
sudo -u "$RUN_AS" yarn install --frozen-lockfile
sudo -u "$RUN_AS" yarn build

echo "==> migrate"
( set -a; . "$ENV_FILE"; set +a; cd apps/api && sudo -E -u "$RUN_AS" node dist/cli/migrate.js )

echo "==> publish dist-web"
rsync -a --delete --exclude '.well-known' apps/web/dist-web/ "$HTTPDOCS/"
chown -R "$WEB_OWNER" "$HTTPDOCS"

echo "==> restart services"
systemctl restart shomal-nezarat.service shomal-nezarat-worker.service

echo "==> health check"
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" | grep -q '"ok"'; then
    echo "OK"; exit 0
  fi
  sleep 1
done
echo "Health check failed; restore with: tar -xzf $BACKUP_DIR/httpdocs-$STAMP.tar.gz -C $HTTPDOCS" >&2
journalctl -u shomal-nezarat.service -n 50 --no-pager >&2
exit 1
