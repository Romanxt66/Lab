#!/bin/sh
set -e

echo "[entrypoint] prisma db push (crea/sincroniza tablas del Lab)..."
npx prisma db push --skip-generate

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "[entrypoint] Verificando superadmin ($ADMIN_EMAIL)..."
  SEED_ONLY_IF_ABSENT=true npm run seed:admin || echo "[entrypoint] seed:admin falló (no crítico), continúo."
fi

echo "[entrypoint] Iniciando servidor..."
exec npm run start
