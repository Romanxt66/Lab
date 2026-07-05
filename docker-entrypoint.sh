#!/bin/sh
set -e

echo "[entrypoint] Asegurando el esquema dedicado del Lab..."
node prisma/ensure-schema.mjs

echo "[entrypoint] prisma db push (crea/sincroniza tablas del Lab en su esquema)..."
npx prisma db push

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "[entrypoint] Verificando superadmin ($ADMIN_EMAIL)..."
  SEED_ONLY_IF_ABSENT=true npm run seed:admin || echo "[entrypoint] seed:admin falló (no crítico), continúo."
fi

echo "[entrypoint] Iniciando servidor..."
exec npm run start
