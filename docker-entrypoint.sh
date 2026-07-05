#!/bin/sh
set -e

# Retry a command a few times — the database can be briefly unreachable or, if a
# stale/duplicate postgres container lingers on the network, a connection may
# occasionally hit the wrong one. Retrying rides over those transient failures.
retry() {
  max="$1"
  shift
  n=1
  while true; do
    if "$@"; then
      return 0
    fi
    if [ "$n" -ge "$max" ]; then
      echo "[entrypoint] '$*' falló tras $max intentos."
      return 1
    fi
    echo "[entrypoint] reintento $n/$max en 3s..."
    n=$((n + 1))
    sleep 3
  done
}

echo "[entrypoint] Asegurando el esquema dedicado del Lab..."
retry 15 node prisma/ensure-schema.mjs

echo "[entrypoint] prisma db push (crea/sincroniza tablas del Lab en su esquema)..."
retry 15 npx prisma db push

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  echo "[entrypoint] Verificando superadmin ($ADMIN_EMAIL)..."
  export SEED_ONLY_IF_ABSENT=true
  retry 15 npm run seed:admin || echo "[entrypoint] seed:admin no crítico, continúo."
fi

echo "[entrypoint] Iniciando servidor..."
exec npm run start
