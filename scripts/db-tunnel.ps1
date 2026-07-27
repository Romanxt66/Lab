# Abre un túnel SSH desde tu PC a la Postgres de producción (Coolify), para que
# `npm run dev` pueda usar la base de datos real vía localhost:5433.
#
# Uso (PowerShell):
#   ./scripts/db-tunnel.ps1 -Server root@TU_SERVIDOR
#
# Deja esta ventana ABIERTA mientras trabajas; en OTRA terminal corre `npm run dev`.
# Ctrl+C aquí cierra el túnel.
#
# Parámetros:
#   -Server      usuario@host SSH del servidor Coolify (obligatorio).
#   -LocalPort   puerto local (debe coincidir con el de DATABASE_URL). Def: 5433.
#   -RemoteHost  host de la BD visto DESDE el servidor. Def: localhost
#                (Coolify publica Postgres en el host). Si tu BD no está
#                publicada en el host, usa el nombre interno del contenedor.
#   -RemotePort  puerto de la BD en el servidor. Def: 5433 (el puerto publicado).

param(
  [Parameter(Mandatory = $true)][string]$Server,
  [int]$LocalPort = 5433,
  [string]$RemoteHost = "localhost",
  [int]$RemotePort = 5433
)

Write-Host "Túnel: localhost:$LocalPort  ->  ${RemoteHost}:${RemotePort}  (vía $Server)" -ForegroundColor Cyan
Write-Host "Deja esta ventana abierta. En otra terminal: npm run dev. Ctrl+C para cerrar." -ForegroundColor DarkGray

# -N: sin comando remoto (solo forwarding).  -L: reenvío local -> remoto.
ssh -N -L "${LocalPort}:${RemoteHost}:${RemotePort}" $Server
