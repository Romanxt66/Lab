import type { FinanceService } from "@/modules/finance/application/finance-service";
import type { UptimeService } from "@/modules/uptime/application/uptime-service";
import type { UserAdminService } from "@/modules/users/application/user-admin-service";
import type { CalendarService } from "@/modules/calendar/application/calendar-service";
import type { InventoryService } from "@/modules/inventory/application/inventory-service";
import type { AutomationService } from "@/modules/automations/application/automation-service";

export interface ToolContext {
  uid: string;
  role: string;
}

export interface AssistantTool {
  name: string;
  description: string;
  inputSchema: object;
  /** Returns the text to send back to the model as the tool result. Never throws. */
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

export interface ToolDeps {
  finance: FinanceService;
  uptime: UptimeService;
  users: UserAdminService;
  calendar: CalendarService;
  inventory: InventoryService;
  automations: AutomationService;
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

/**
 * The assistant's tool registry — a deliberately bounded set of read + write
 * operations, each delegating to the same services the UI uses (so every
 * validation rule/guard already in place still applies). Nothing here
 * deletes data, touches deployment/DB-admin/credentials, or changes roles;
 * see the module README-equivalent note in AssistantWidget for the full list
 * of what's intentionally out of scope for v1.
 */
export function buildAssistantTools(deps: ToolDeps): AssistantTool[] {
  return [
    // -- Finance (read) -------------------------------------------------
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
      description: "Lista las categorías de transacciones (ingreso/gasto) con su id, útil antes de crear una transacción.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const rows = await deps.finance.listCategories();
        return JSON.stringify(
          rows.map((c) => ({ id: c.id, nombre: c.name, tipo: c.kind })),
        );
      },
    },
    // -- Finance (write) --------------------------------------------------
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
      execute: async (input) => {
        const res = await deps.finance.saveTransaction({
          accountId: str(input.accountId),
          categoryId: input.categoryId ? str(input.categoryId) : null,
          kind: str(input.kind) === "income" ? "income" : "expense",
          amount: num(input.amount),
          notes: input.notes ? str(input.notes) : null,
          occurredAt: new Date(),
        });
        return res.ok
          ? `Transacción registrada (id ${res.value.id}).`
          : `Error: ${res.error}`;
      },
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
      name: "toggle_uptime_monitor",
      description: "Activa o pausa un monitor de Uptime.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          active: { type: "boolean" },
        },
        required: ["id", "active"],
      },
      execute: async (input) => {
        const monitor = await deps.uptime.detail(str(input.id));
        if (!monitor) return "Error: ese monitor ya no existe.";
        const res = await deps.uptime.save({
          id: str(input.id),
          name: monitor.monitor.name,
          url: monitor.monitor.url,
          method: monitor.monitor.method,
          expectedStatus: monitor.monitor.expectedStatus,
          intervalSeconds: monitor.monitor.intervalSeconds,
          timeoutMs: monitor.monitor.timeoutMs,
          active: bool(input.active),
          notifyOnFailure: monitor.monitor.notifyOnFailure,
        });
        return res.ok
          ? `Monitor "${res.value.name}" ${bool(input.active) ? "activado" : "pausado"}.`
          : `Error: ${res.error}`;
      },
    },
    // -- Users ----------------------------------------------------------
    {
      name: "list_pending_users",
      description:
        "Lista los usuarios pendientes de aprobación. Solo funciona si el usuario actual es superadmin.",
      inputSchema: { type: "object", properties: {} },
      execute: async (_input, ctx) => {
        const denied = requireSuperadmin(ctx);
        if (denied) return denied;
        const rows = await deps.users.list(ctx.uid);
        const pending = rows.filter((u) => u.status === "pending");
        return JSON.stringify(
          pending.map((u) => ({ id: u.id, nombre: u.name, email: u.email })),
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
        const res = await deps.users.approve(str(input.id), ctx.uid);
        return res.ok ? `Usuario ${res.value.email} aprobado.` : `Error: ${res.error}`;
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
        const res = await deps.users.reject(str(input.id), ctx.uid);
        return res.ok ? `Usuario ${res.value.email} rechazado.` : `Error: ${res.error}`;
      },
    },
    // -- Calendar -------------------------------------------------------
    {
      name: "list_upcoming_calendar_events",
      description: "Lista los eventos de calendario de los próximos N días (por defecto 7).",
      inputSchema: {
        type: "object",
        properties: { days: { type: "integer" } },
      },
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
        const res = await deps.calendar.create({
          title: str(input.title),
          start,
          allDay: input.allDay === undefined ? false : bool(input.allDay),
          description: input.description ? str(input.description) : null,
          end: null,
          location: null,
          color: null,
          remindMinutesBefore:
            input.remindMinutesBefore !== undefined ? num(input.remindMinutesBefore) : null,
        });
        return res.ok
          ? `Evento "${res.value.title}" creado para ${res.value.start.toLocaleString()}.`
          : `Error: ${res.error}`;
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
    // -- Automations --------------------------------------------------------
    {
      name: "list_automation_rules",
      description: "Lista las reglas de automatización configuradas (disparador, acciones, si están activas).",
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
  ];
}
