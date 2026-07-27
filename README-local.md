# Desarrollo local contra la base de datos de producción

Permite correr la app en tu PC (`npm run dev`), loguearte y ver los cambios de
UI al instante **sin redeploy**, usando los datos reales de producción a través
de un túnel SSH a la Postgres de Coolify.

> ⚠️ Estás conectado a **producción**. Lo que crees/edites/borres desde local se
> escribe en la base real. Para solo mirar la UI, no toca nada; ten cuidado al
> guardar formularios si no quieres alterar datos reales.

## Requisitos (ya cubiertos)

- Cliente `ssh` (viene con Windows 10/11 — `OpenSSH`).
- `.env.local` con `DATABASE_URL=...localhost:5433/master_db?schema=lab` y
  `DISABLE_SCHEDULER="true"` (ya configurado).

## Pasos cada vez que quieras trabajar

1. **Abre el túnel** (deja la ventana abierta):

   ```powershell
   ./scripts/db-tunnel.ps1 -Server root@TU_SERVIDOR
   ```

   Sustituye `root@TU_SERVIDOR` por el usuario y host SSH de tu servidor Coolify.

2. **En otra terminal**, arranca el dev server:

   ```powershell
   npm run dev
   ```

3. Abre <http://localhost:3000>, entra con tu usuario y navega. Los cambios de
   código recargan solos (HMR); no hace falta redeploy.

## Notas

- El puerto local **5433** debe coincidir con el de `DATABASE_URL`. Si cambias
  uno, cambia el otro.
- `-RemoteHost/-RemotePort` asumen que Coolify publica Postgres en el host del
  servidor en `5433`. Verifícalo en Coolify → recurso Postgres → *Ports* (mapeo
  tipo `5433:5432`). Si el puerto publicado es otro, pásalo con `-RemotePort`.
- `DISABLE_SCHEDULER="true"` evita que el dev server local mande recordatorios
  de Telegram o cree pagos recurrentes en paralelo con la instancia desplegada.
  En producción el flag va sin definir, así que el scheduler sigue activo allí.
- Si el túnel se cae, el dev server dará errores de conexión a la BD; reabre el
  túnel y recarga.
