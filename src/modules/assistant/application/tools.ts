import type { FinanceService } from "@/modules/finance/application/finance-service";
import type { UptimeService } from "@/modules/uptime/application/uptime-service";
import type { UserAdminService } from "@/modules/users/application/user-admin-service";
import type { CalendarService } from "@/modules/calendar/application/calendar-service";
import type { InventoryService } from "@/modules/inventory/application/inventory-service";
import type { AutomationService } from "@/modules/automations/application/automation-service";
import type { DbAdminService } from "@/modules/db-admin/application/db-admin-service";
import type { CoolifyService } from "@/modules/coolify/application/coolify-service";
import type { GitHubService } from "@/modules/github/application/github-service";
import type { N8nService } from "@/modules/n8n/application/n8n-service";

/** Side effects a tool can request from the client (rather than perform server-side). */
export interface ToolEffects {
  /** Tool slug to open in the UI, set by `navigate_to_module`. */
  navigateTo?: string;
}

export interface ToolContext {
  uid: string;
  role: string;
  effects: ToolEffects;
}

export interface AssistantTool {
  name: string;
  description: string;
  inputSchema: object;
  /** Returns the text to send back to the model as the tool result. Never throws. */
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

/** A navigable destination in the app, passed in so this layer needn't import the UI registry. */
export interface NavigableTool {
  slug: string;
  name: string;
  description: string;
}

export interface ToolDeps {
  finance: FinanceService;
  uptime: UptimeService;
  users: UserAdminService;
  calendar: CalendarService;
  inventory: InventoryService;
  automations: AutomationService;
  dbAdmin: DbAdminService;
  coolify: CoolifyService;
  github: GitHubService;
  n8n: N8nService;
  navigable: NavigableTool[];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}
function bool(v: unknown): boolean {
  return typeof v === "boolean" ? v : v === "true";
}

const requireSuperadmin = (ctx: ToolContext): string | null =>
  ctx.role === "superadmin"
    ? null
    : "No autorizado: esta acción requiere el rol superadmin.";

/** Render a Result-returning call as tool-result text. */
async function fromResult<T>(
  call: Promise<{ ok: true; value: T } | { ok: false; error: string }>,
  onOk: (value: T) => string,
): Promise<string> {
  const res = await call;
  return res.ok ? onOk(res.value) : `Error: ${res.error}`;
}

/**
 * The assistant's tool registry — read + write operations across every module,
 * each delegating to the same services the UI uses, so existing validation and
 * guards still apply.
 *
 * Deliberately NOT exposed: deleting anything (records, connections, Coolify
 * resources), changing user roles, editing connection credentials, and
 * destructive SQL — `run_database_query` goes through DbAdminService without
 * `confirmDestructive`, so the service itself rejects DROP/DELETE/UPDATE-style
 * statements and read-only connections stay read-only.
 */
export function buildAssistantTools(deps: ToolDeps): AssistantTool[] {
  return [
    // -- Navigation -------------------------------------------------------
    {
      name: "navigate_to_module",
      description:
        `Abre una herramienta del Lab en pantalla para el usuario. Úsala cuando pida "llévame a", "muéstrame el apartado de", "abre", etc. Slugs disponibles: ${deps.navigable
          .map((t) => `${t.slug} (${t.name})`)
          .join(", ")}.`,
      inputSchema: {
        type: "object",
        properties: { slug: { type: "string", description: "Slug de la herramienta a abrir." } },
        required: ["slug"],
      },
      execute: async (input, ctx) => {
        const slug = str(input.slug);
        const target = deps.navigable.find((t) => t.slug === slug);
        if (!target) {
          return `Error: no existe la herramienta "${slug}". Opciones: ${deps.navigable
            .map((t) => t.slug)
            .join(", ")}`;
        }
        ctx.effects.navigateTo = target.slug;
        return `Abriendo "${target.name}" en pantalla.`;
      },
    },

    // -- Finance ----------------------------------------------------------
    {
      name: "get_finance_summary",
      description:
        "Resumen financiero de un mes: ingresos, gastos, neto y estado de los presupuestos por categoría. Si no se indica mes/año, usa el mes actual.",
      inputSchema: {
        type: "object",
        properties: {
          year: { type: "integer", description: "Año, ej. 2026" },
          month: { type: "integer", description: "Mes 1-12" },
        },
      },
      execute: async (input) => {
        const now = new Date();
        const year = input.year ? num(input.year) : now.getFullYear();
        const month = input.month ? num(input.month) : now.getMonth() + 1;
        const [summary, budgets] = await Promise.all([
          deps.finance.monthlySummary(year, month),
          deps.finance.budgetsWithProgress(year, month),
        ]);
        return JSON.stringify({
          year,
          month,
          ingresos: summary.income,
          gastos: summary.expense,
          neto: summary.net,
          presupuestos: budgets.map((b) => ({
            categoriaId: b.budget.categoryId,
            limite: b.progress.limit,
            gastado: b.progress.spent,
            estado: b.progress.status,
          })),
        });
      },
    },
    {
      name: "list_finance_accounts",
      description: "Lista las cuentas financieras (caja, banco, tarjeta...) con su saldo actual.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const rows = await deps.finance.listAccountsWithBalances();
        return JSON.stringify(
          rows.map((r) => ({
            id: r.account.id,
            nombre: r.account.name,
            tipo: r.account.kind,
            saldo: r.balance,
          })),
        );
      },
    },
    {
      name: "list_finance_categories",
      description:
        "Lista las categorías de transacciones (ingreso/gasto) con su id, útil antes de crear una transacción.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const rows = await deps.finance.listCategories();
        return JSON.stringify(rows.map((c) => ({ id: c.id, nombre: c.name, tipo: c.kind })));
      },
    },
    {
      name: "list_finance_transactions",
      description: "Lista los movimientos financieros más recientes.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", description: "Máximo de movimientos (por defecto 20)." } },
      },
      execute: async (input) => {
        const rows = await deps.finance.listTransactions({
          limit: input.limit ? num(input.limit) : 20,
        });
        return JSON.stringify(
          rows.map((t) => ({
            id: t.id,
            tipo: t.kind,
            monto: t.amount,
            categoriaId: t.categoryId,
            fecha: t.occurredAt.toISOString(),
            notas: t.notes,
          })),
        );
      },
    },
    {
      name: "create_financial_transaction",
      description:
        "Registra un ingreso o gasto. Necesitas el id de cuenta (list_finance_accounts) y, opcionalmente, el id de categoría (list_finance_categories).",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string" },
          categoryId: { type: "string", description: "Opcional." },
          kind: { type: "string", enum: ["income", "expense"] },
          amount: { type: "number", description: "Monto positivo." },
          notes: { type: "string" },
        },
        required: ["accountId", "kind", "amount"],
      },
      execute: async (input) =>
        fromResult(
          deps.finance.saveTransaction({
            accountId: str(input.accountId),
            categoryId: input.categoryId ? str(input.categoryId) : null,
            kind: str(input.kind) === "income" ? "income" : "expense",
            amount: num(input.amount),
            notes: input.notes ? str(input.notes) : null,
            occurredAt: new Date(),
          }),
          (t) => `Transacción registrada (id ${t.id}).`,
        ),
    },
    {
      name: "set_budget",
      description: "Define o actualiza el límite mensual de presupuesto para una categoría.",
      inputSchema: {
        type: "object",
        properties: {
          categoryId: { type: "string" },
          amount: { type: "number", description: "Límite mensual, mayor que 0." },
        },
        required: ["categoryId", "amount"],
      },
      execute: async (input) =>
        fromResult(
          deps.finance.saveBudget({
            categoryId: str(input.categoryId),
            amount: num(input.amount),
          }),
          (b) => `Presupuesto fijado en ${b.amount} para la categoría ${b.categoryId}.`,
        ),
    },

    // -- Uptime -------------------------------------------------------------
    {
      name: "list_uptime_monitors",
      description: "Estado actual de todos los monitores de Uptime: en línea, caído o sin datos.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const rows = await deps.uptime.list();
        return JSON.stringify(
          rows.map((m) => ({
            id: m.id,
            nombre: m.name,
            url: m.url,
            estado: m.lastStatus,
            activo: m.active,
            fallosSeguidos: m.consecutiveFailures,
          })),
        );
      },
    },
    {
      name: "check_uptime_monitor_now",
      description: "Fuerza una comprobación inmediata de un monitor y devuelve el resultado.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      execute: async (input) =>
        fromResult(
          deps.uptime.checkNow(str(input.id)),
          (m) => `"${m.name}": ${m.lastStatus}${m.lastResponseMs ? ` (${m.lastResponseMs} ms)` : ""}.`,
        ),
    },
    {
      name: "toggle_uptime_monitor",
      description: "Activa o pausa un monitor de Uptime.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" }, active: { type: "boolean" } },
        required: ["id", "active"],
      },
      execute: async (input) => {
        const detail = await deps.uptime.detail(str(input.id));
        if (!detail) return "Error: ese monitor ya no existe.";
        const m = detail.monitor;
        return fromResult(
          deps.uptime.save({
            id: m.id,
            name: m.name,
            url: m.url,
            method: m.method,
            expectedStatus: m.expectedStatus,
            intervalSeconds: m.intervalSeconds,
            timeoutMs: m.timeoutMs,
            active: bool(input.active),
            notifyOnFailure: m.notifyOnFailure,
          }),
          (saved) => `Monitor "${saved.name}" ${bool(input.active) ? "activado" : "pausado"}.`,
        );
      },
    },

    // -- Users ----------------------------------------------------------
    {
      name: "list_users",
      description:
        "Lista los usuarios del Lab con su estado (pendiente/aprobado/rechazado) y rol. Solo superadmin.",
      inputSchema: {
        type: "object",
        properties: {
          onlyPending: { type: "boolean", description: "Si es true, solo los pendientes de aprobación." },
        },
      },
      execute: async (input, ctx) => {
        const denied = requireSuperadmin(ctx);
        if (denied) return denied;
        const rows = await deps.users.list(ctx.uid);
        const filtered = bool(input.onlyPending) ? rows.filter((u) => u.status === "pending") : rows;
        return JSON.stringify(
          filtered.map((u) => ({
            id: u.id,
            nombre: u.name,
            email: u.email,
            estado: u.status,
            rol: u.role,
          })),
        );
      },
    },
    {
      name: "approve_pending_user",
      description: "Aprueba a un usuario pendiente para que pueda entrar. Solo superadmin.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      execute: async (input, ctx) => {
        const denied = requireSuperadmin(ctx);
        if (denied) return denied;
        return fromResult(
          deps.users.approve(str(input.id), ctx.uid),
          (u) => `Usuario ${u.email} aprobado.`,
        );
      },
    },
    {
      name: "reject_pending_user",
      description: "Rechaza (o revoca el acceso de) un usuario. Solo superadmin.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      execute: async (input, ctx) => {
        const denied = requireSuperadmin(ctx);
        if (denied) return denied;
        return fromResult(
          deps.users.reject(str(input.id), ctx.uid),
          (u) => `Usuario ${u.email} rechazado.`,
        );
      },
    },

    // -- Calendar -------------------------------------------------------
    {
      name: "list_upcoming_calendar_events",
      description: "Lista los eventos de calendario de los próximos N días (por defecto 7).",
      inputSchema: { type: "object", properties: { days: { type: "integer" } } },
      execute: async (input) => {
        const days = input.days ? num(input.days) : 7;
        const now = new Date();
        const until = new Date(now.getTime() + days * 86_400_000);
        const [thisMonth, nextMonth] = await Promise.all([
          deps.calendar.listMonth(now.getFullYear(), now.getMonth() + 1),
          deps.calendar.listMonth(now.getFullYear(), now.getMonth() + 2),
        ]);
        const events = [...thisMonth, ...nextMonth]
          .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
          .filter((e) => e.start >= now && e.start <= until)
          .sort((a, b) => a.start.getTime() - b.start.getTime());
        return JSON.stringify(
          events.map((e) => ({ id: e.id, titulo: e.title, inicio: e.start.toISOString() })),
        );
      },
    },
    {
      name: "create_calendar_event",
      description: "Crea un evento en el calendario.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          start: { type: "string", description: "Fecha/hora ISO 8601." },
          allDay: { type: "boolean" },
          description: { type: "string" },
          remindMinutesBefore: { type: "integer", description: "Minutos antes para recordar (opcional)." },
        },
        required: ["title", "start"],
      },
      execute: async (input) => {
        const start = new Date(str(input.start));
        if (Number.isNaN(start.getTime())) return "Error: la fecha no es válida.";
        return fromResult(
          deps.calendar.create({
            title: str(input.title),
            start,
            allDay: input.allDay === undefined ? false : bool(input.allDay),
            description: input.description ? str(input.description) : null,
            end: null,
            location: null,
            color: null,
            remindMinutesBefore:
              input.remindMinutesBefore !== undefined ? num(input.remindMinutesBefore) : null,
          }),
          (e) => `Evento "${e.title}" creado para ${e.start.toLocaleString()}.`,
        );
      },
    },

    // -- Inventory --------------------------------------------------------
    {
      name: "get_inventory_summary",
      description: "Lista los artículos de inventario con su cantidad actual.",
      inputSchema: {
        type: "object",
        properties: { search: { type: "string", description: "Filtrar por nombre (opcional)." } },
      },
      execute: async (input) => {
        const rows = await deps.inventory.listItems(
          input.search ? { search: str(input.search) } : undefined,
        );
        return JSON.stringify(
          rows.map((i) => ({
            id: i.id,
            nombre: i.name,
            categoria: i.category,
            cantidad: i.quantity,
            unidad: i.unit,
          })),
        );
      },
    },
    {
      name: "record_inventory_movement",
      description:
        "Registra un movimiento de stock de un artículo (comprado, vendido, regalado, recibido, ajuste).",
      inputSchema: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          kind: {
            type: "string",
            enum: ["bought", "sold", "gave_away", "received", "moved", "adjust"],
          },
          quantity: { type: "number" },
          notes: { type: "string" },
        },
        required: ["itemId", "kind", "quantity"],
      },
      execute: async (input) =>
        fromResult(
          deps.inventory.recordMovement({
            itemId: str(input.itemId),
            kind: str(input.kind) as "bought" | "sold" | "gave_away" | "received" | "moved" | "adjust",
            quantity: num(input.quantity),
            toLocationId: null,
            notes: input.notes ? str(input.notes) : null,
            occurredAt: new Date(),
          }),
          (m) => `Movimiento registrado (id ${m.id}).`,
        ),
    },

    // -- Automations --------------------------------------------------------
    {
      name: "list_automation_rules",
      description:
        "Lista las reglas de automatización configuradas (disparador, acciones, si están activas).",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const rows = await deps.automations.list();
        return JSON.stringify(
          rows.map((r) => ({
            id: r.id,
            nombre: r.name,
            disparador: r.trigger,
            activa: r.active,
            acciones: r.actions.map((a) => a.type),
          })),
        );
      },
    },
    {
      name: "toggle_automation_rule",
      description: "Activa o pausa una regla de automatización.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" }, active: { type: "boolean" } },
        required: ["id", "active"],
      },
      execute: async (input) => {
        const rules = await deps.automations.list();
        const rule = rules.find((r) => r.id === str(input.id));
        if (!rule) return "Error: esa regla ya no existe.";
        return fromResult(
          deps.automations.save({
            id: rule.id,
            name: rule.name,
            trigger: rule.trigger,
            actions: rule.actions,
            active: bool(input.active),
          }),
          (r) => `Regla "${r.name}" ${r.active ? "activada" : "pausada"}.`,
        );
      },
    },

    // -- Database admin -----------------------------------------------------
    {
      name: "list_database_connections",
      description:
        "Lista las conexiones a bases de datos configuradas en el módulo Base de datos (nombre, si son de solo lectura).",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const rows = await deps.dbAdmin.list();
        return JSON.stringify({
          total: rows.length,
          conexiones: rows.map((c) => ({ id: c.id, nombre: c.name, soloLectura: c.readOnly })),
        });
      },
    },
    {
      name: "list_database_tables",
      description:
        "Lista las tablas de un esquema en una conexión (usa list_database_connections para el id). El esquema por defecto es 'public'.",
      inputSchema: {
        type: "object",
        properties: {
          connectionId: { type: "string" },
          schema: { type: "string", description: "Por defecto 'public'." },
        },
        required: ["connectionId"],
      },
      execute: async (input) =>
        fromResult(
          deps.dbAdmin.listTables(str(input.connectionId), input.schema ? str(input.schema) : "public"),
          (tables) =>
            JSON.stringify(
              tables.map((t) => ({ tabla: t.name, tipo: t.kind, filasAprox: t.rowsApprox })),
            ),
        ),
    },
    {
      name: "run_database_query",
      description:
        "Ejecuta una consulta SQL de lectura (SELECT) en una conexión. Las sentencias destructivas se rechazan: para esas, el usuario debe usar el editor SQL del módulo.",
      inputSchema: {
        type: "object",
        properties: {
          connectionId: { type: "string" },
          sql: { type: "string", description: "Consulta SQL, preferiblemente con LIMIT." },
        },
        required: ["connectionId", "sql"],
      },
      execute: async (input) =>
        fromResult(deps.dbAdmin.runQuery(str(input.connectionId), str(input.sql)), (r) =>
          JSON.stringify({
            columnas: r.columns,
            filas: r.rows.slice(0, 50),
            totalFilas: r.rowCount,
          }),
        ),
    },

    // -- Deployments (Coolify) ---------------------------------------------
    {
      name: "list_deployments_overview",
      description:
        "Estado de la infraestructura en Coolify: aplicaciones, bases de datos y servicios, con su estado de ejecución.",
      inputSchema: { type: "object", properties: {} },
      execute: async () =>
        fromResult(deps.coolify.overview(), (o) =>
          JSON.stringify({
            aplicaciones: o.apps.map((a) => ({
              uuid: a.uuid,
              nombre: a.name,
              estado: a.state,
              url: a.fqdn,
            })),
            basesDeDatos: o.databases.map((d) => ({ uuid: d.uuid, nombre: d.name, estado: d.state })),
            servicios: o.services.map((s) => ({ uuid: s.uuid, nombre: s.name, estado: s.state })),
          }),
        ),
    },
    {
      name: "list_recent_deployments",
      description: "Historial reciente de despliegues en Coolify y su estado.",
      inputSchema: { type: "object", properties: {} },
      execute: async () =>
        fromResult(deps.coolify.listDeployments(), (rows) =>
          JSON.stringify(
            rows.slice(0, 15).map((d) => ({
              uuid: d.uuid,
              app: d.applicationName,
              estado: d.status,
              commit: d.commitMessage,
              fecha: d.createdAt,
            })),
          ),
        ),
    },
    {
      name: "deploy_application",
      description:
        "Lanza un despliegue de una aplicación en Coolify. Confirma con el usuario antes de usarla.",
      inputSchema: {
        type: "object",
        properties: { uuid: { type: "string", description: "UUID de la app (list_deployments_overview)." } },
        required: ["uuid"],
      },
      execute: async (input) => fromResult(deps.coolify.deploy(str(input.uuid)), (msg) => msg),
    },
    {
      name: "control_application",
      description:
        "Arranca, detiene o reinicia una aplicación en Coolify. Confirma con el usuario antes de usarla.",
      inputSchema: {
        type: "object",
        properties: {
          uuid: { type: "string" },
          action: { type: "string", enum: ["start", "stop", "restart"] },
        },
        required: ["uuid", "action"],
      },
      execute: async (input) =>
        fromResult(
          deps.coolify.control(
            str(input.uuid),
            str(input.action) as "start" | "stop" | "restart",
          ),
          (msg) => msg,
        ),
    },
    {
      name: "get_application_logs",
      description: "Devuelve las últimas líneas de log de una aplicación en Coolify.",
      inputSchema: {
        type: "object",
        properties: {
          uuid: { type: "string" },
          lines: { type: "integer", description: "Número de líneas (por defecto 100)." },
        },
        required: ["uuid"],
      },
      execute: async (input) =>
        fromResult(
          deps.coolify.logs(str(input.uuid), input.lines ? num(input.lines) : 100),
          (logs) => logs.slice(-4000) || "(sin logs)",
        ),
    },

    // -- GitHub --------------------------------------------------------------
    {
      name: "list_github_repos",
      description: "Lista tus repositorios de GitHub con lenguaje, estrellas y última actualización.",
      inputSchema: { type: "object", properties: {} },
      execute: async () =>
        fromResult(deps.github.overview(), (o) =>
          JSON.stringify({
            usuario: o.profile.login,
            total: o.repos.length,
            repos: o.repos.slice(0, 40).map((r) => ({
              nombre: r.name,
              privado: r.isPrivate,
              lenguaje: r.language,
              estrellas: r.stars,
              url: r.url,
            })),
          }),
        ),
    },

    // -- n8n ------------------------------------------------------------------
    {
      name: "list_n8n_workflows",
      description: "Lista los workflows de tu instancia de n8n y si están activos.",
      inputSchema: { type: "object", properties: {} },
      execute: async () =>
        fromResult(deps.n8n.listWorkflows(), (rows) =>
          JSON.stringify(rows.map((w) => ({ id: w.id, nombre: w.name, activo: w.active }))),
        ),
    },
    {
      name: "toggle_n8n_workflow",
      description: "Activa o desactiva un workflow de n8n.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" }, active: { type: "boolean" } },
        required: ["id", "active"],
      },
      execute: async (input) =>
        fromResult(
          deps.n8n.setActive(str(input.id), bool(input.active)),
          () => `Workflow ${bool(input.active) ? "activado" : "desactivado"}.`,
        ),
    },
  ];
}
