import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Mail,
  Wrench,
  Globe,
  Clock,
  Braces,
  Binary,
  KeyRound,
  Fingerprint,
  CalendarClock,
  CalendarDays,
  Regex,
} from "lucide-react";
import { JsonFormatter } from "@/modules/dev-utils/ui/JsonFormatter";
import { Base64Tool } from "@/modules/dev-utils/ui/Base64Tool";
import { JwtDecoder } from "@/modules/dev-utils/ui/JwtDecoder";
import { UuidHash } from "@/modules/dev-utils/ui/UuidHash";
import { TimestampTool } from "@/modules/dev-utils/ui/TimestampTool";
import { RegexTester } from "@/modules/dev-utils/ui/RegexTester";
import { EmailAutomation } from "@/modules/email/ui/EmailAutomation";
import { ScraperTool } from "@/modules/scraper/ui/ScraperTool";
import { JobScheduler } from "@/modules/scheduler/ui/JobScheduler";
import { CalendarTool } from "@/modules/calendar/ui/CalendarTool";

/**
 * Tool registry — the single source of truth for the lab.
 *
 * The dashboard (`app/page.tsx`) renders a card per entry, and the dynamic
 * route (`app/tools/[slug]/page.tsx`) mounts `Component` for the active slug.
 * Adding a tool = append one entry here + create its module under `modules/`.
 */

export type ToolCategory =
  | "email"
  | "dev-utils"
  | "scraper"
  | "scheduler"
  | "calendar";

export interface CategoryMeta {
  id: ToolCategory;
  label: string;
  icon: LucideIcon;
}

export const CATEGORIES: Record<ToolCategory, CategoryMeta> = {
  "dev-utils": { id: "dev-utils", label: "Utilidades de dev", icon: Wrench },
  calendar: { id: "calendar", label: "Calendario", icon: CalendarDays },
  email: { id: "email", label: "Correos", icon: Mail },
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
}

/**
 * Registered tools. Populated as each module is implemented.
 * Order here is the order shown within each category on the dashboard.
 */
export const TOOLS: ToolMeta[] = [
  {
    slug: "json-formatter",
    name: "JSON Formatter",
    description: "Formatea, valida y minifica JSON.",
    category: "dev-utils",
    icon: Braces,
    status: "ready",
    Component: JsonFormatter,
  },
  {
    slug: "base64",
    name: "Base64",
    description: "Codifica y decodifica texto en Base64 (UTF-8).",
    category: "dev-utils",
    icon: Binary,
    status: "ready",
    Component: Base64Tool,
  },
  {
    slug: "jwt-decoder",
    name: "JWT Decoder",
    description: "Inspecciona el header y payload de un JWT.",
    category: "dev-utils",
    icon: KeyRound,
    status: "ready",
    Component: JwtDecoder,
  },
  {
    slug: "uuid-hash",
    name: "UUID & Hash",
    description: "Genera UUIDs v4 y calcula hashes SHA.",
    category: "dev-utils",
    icon: Fingerprint,
    status: "ready",
    Component: UuidHash,
  },
  {
    slug: "timestamp",
    name: "Timestamp",
    description: "Convierte entre unix, ISO y fechas legibles.",
    category: "dev-utils",
    icon: CalendarClock,
    status: "ready",
    Component: TimestampTool,
  },
  {
    slug: "regex-tester",
    name: "Regex Tester",
    description: "Prueba expresiones regulares en vivo.",
    category: "dev-utils",
    icon: Regex,
    status: "ready",
    Component: RegexTester,
  },
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
];

export function getTool(slug: string): ToolMeta | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function toolsByCategory(category: ToolCategory): ToolMeta[] {
  return TOOLS.filter((t) => t.category === category);
}
