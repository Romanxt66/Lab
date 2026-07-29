import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Mail,
  Globe,
  Clock,
  CalendarDays,
  Send,
  Bell,
  Database,
  Wallet,
  Boxes,
  FolderGit2,
  Rocket,
} from "lucide-react";
import { EmailAutomation } from "@/modules/email/ui/EmailAutomation";
import { ScraperTool } from "@/modules/scraper/ui/ScraperTool";
import { JobScheduler } from "@/modules/scheduler/ui/JobScheduler";
import { CalendarTool } from "@/modules/calendar/ui/CalendarTool";
import { NotificationSettings } from "@/modules/notifications/ui/NotificationSettings";
import { DbAdminTool } from "@/modules/db-admin/ui/DbAdminTool";
import { FinanceTool } from "@/modules/finance/ui/FinanceTool";
import { InventoryTool } from "@/modules/inventory/ui/InventoryTool";
import { GitHubTool } from "@/modules/github/ui/GitHubTool";
import { CoolifyTool } from "@/modules/coolify/ui/CoolifyTool";

/**
 * Tool registry — the single source of truth for the lab.
 *
 * The dashboard (`app/page.tsx`) renders a card per entry, and the dynamic
 * route (`app/tools/[slug]/page.tsx`) mounts `Component` for the active slug.
 * Adding a tool = append one entry here + create its module under `modules/`.
 */

export type ToolCategory =
  | "email"
  | "scraper"
  | "scheduler"
  | "calendar"
  | "notifications"
  | "database"
  | "finance"
  | "inventory"
  | "github"
  | "deploy";

export interface CategoryMeta {
  id: ToolCategory;
  label: string;
  icon: LucideIcon;
}

export const CATEGORIES: Record<ToolCategory, CategoryMeta> = {
  finance: { id: "finance", label: "Finanzas", icon: Wallet },
  inventory: { id: "inventory", label: "Inventario", icon: Boxes },
  github: { id: "github", label: "GitHub", icon: FolderGit2 },
  deploy: { id: "deploy", label: "Despliegues", icon: Rocket },
  database: { id: "database", label: "Base de datos", icon: Database },
  calendar: { id: "calendar", label: "Calendario", icon: CalendarDays },
  email: { id: "email", label: "Correos", icon: Mail },
  notifications: { id: "notifications", label: "Notificaciones", icon: Bell },
  scraper: { id: "scraper", label: "Scraping / APIs", icon: Globe },
  scheduler: { id: "scheduler", label: "Tareas programadas", icon: Clock },
};

export interface ToolMeta {
  /** URL segment: /tools/<slug> */
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: LucideIcon;
  /** "ready" tools are clickable; "soon" render disabled on the dashboard. */
  status: "ready" | "soon";
  /** The tool UI. Omitted for "soon" tools. */
  Component?: ComponentType;
  /** Widen the tool's page container (useful for DB-admin style layouts). */
  wide?: boolean;
}

/**
 * Registered tools. Populated as each module is implemented.
 * Order here is the order shown within each category on the dashboard.
 */
export const TOOLS: ToolMeta[] = [
  {
    slug: "email-automation",
    name: "Automatización de correos",
    description: "Plantillas con variables, destinatarios y envío por SMTP.",
    category: "email",
    icon: Mail,
    status: "ready",
    Component: EmailAutomation,
  },
  {
    slug: "scraper",
    name: "Scraper / APIs",
    description: "Extrae datos de webs por selector CSS o consume APIs.",
    category: "scraper",
    icon: Globe,
    status: "ready",
    Component: ScraperTool,
  },
  {
    slug: "scheduler",
    name: "Tareas programadas",
    description: "Programa jobs con cron: scraping o envío de correos.",
    category: "scheduler",
    icon: Clock,
    status: "ready",
    Component: JobScheduler,
  },
  {
    slug: "calendar",
    name: "Calendario",
    description: "Registra y gestiona eventos en una vista mensual.",
    category: "calendar",
    icon: CalendarDays,
    status: "ready",
    Component: CalendarTool,
  },
  {
    slug: "telegram",
    name: "Telegram",
    description:
      "Recibe recordatorios del calendario en Telegram vía un bot propio.",
    category: "notifications",
    icon: Send,
    status: "ready",
    Component: NotificationSettings,
  },
  {
    slug: "db-admin",
    name: "DB Admin",
    description:
      "Conecta a bases PostgreSQL, explora tablas y ejecuta consultas SQL.",
    category: "database",
    icon: Database,
    status: "ready",
    Component: DbAdminTool,
    wide: true,
  },
  {
    slug: "finance",
    name: "Finanzas",
    description:
      "Cuentas, movimientos, categorías y resumen mensual de tu economía.",
    category: "finance",
    icon: Wallet,
    status: "ready",
    Component: FinanceTool,
    wide: true,
  },
  {
    slug: "inventory",
    name: "Inventario",
    description:
      "Artículos, ubicaciones anidadas y un historial de movimientos tipo mini-ERP.",
    category: "inventory",
    icon: Boxes,
    status: "ready",
    Component: InventoryTool,
    wide: true,
  },
  {
    slug: "github",
    name: "GitHub",
    description:
      "Vista previa de tus repositorios y proyectos en curso desde GitHub.",
    category: "github",
    icon: FolderGit2,
    status: "ready",
    Component: GitHubTool,
    wide: true,
  },
  {
    slug: "coolify",
    name: "Despliegues (Coolify)",
    description:
      "Panel sobre tu Coolify: despliega, controla apps y revisa logs y variables.",
    category: "deploy",
    icon: Rocket,
    status: "ready",
    Component: CoolifyTool,
    wide: true,
  },
];

export function getTool(slug: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function toolsByCategory(category: ToolCategory): ToolMeta[] {
  return TOOLS.filter((t) => t.category === category);
}
