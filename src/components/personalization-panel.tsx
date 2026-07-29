"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACCENTS,
  STORAGE_KEYS,
  PERSONALIZATION_EVENT,
  subscribePersonalization,
  getPersonalizationSnapshot,
  getServerPersonalizationSnapshot,
  type Density,
  type FontSize,
  type Personalization,
} from "@/lib/personalization";

const SIDEBAR_EVENT = "lab:sidebarchange";

/**
 * Live UI personalization: accent gradient, density, font size and compact
 * sidebar. State lives in localStorage (an external store) read reactively, so
 * a change re-renders without setState-in-effect and stays in sync with the
 * sidebar toggle. Each change updates the <html> element immediately.
 */
export function PersonalizationPanel() {
  const pref = React.useSyncExternalStore(
    subscribePersonalization,
    getPersonalizationSnapshot,
    getServerPersonalizationSnapshot,
  );

  function update(patch: Partial<Personalization>) {
    const next = { ...pref, ...patch };
    const el = document.documentElement;
    if (patch.accent !== undefined) {
      el.setAttribute("data-accent", next.accent);
      localStorage.setItem(STORAGE_KEYS.accent, next.accent);
    }
    if (patch.density !== undefined) {
      el.setAttribute("data-density", next.density);
      localStorage.setItem(STORAGE_KEYS.density, next.density);
    }
    if (patch.fontSize !== undefined) {
      el.setAttribute("data-font", next.fontSize);
      localStorage.setItem(STORAGE_KEYS.fontSize, next.fontSize);
    }
    if (patch.compactSidebar !== undefined) {
      localStorage.setItem(
        STORAGE_KEYS.compactSidebar,
        next.compactSidebar ? "1" : "0",
      );
      window.dispatchEvent(new Event(SIDEBAR_EVENT));
    }
    window.dispatchEvent(new Event(PERSONALIZATION_EVENT));
  }

  return (
    <div className="glass rounded-xl border border-border/60 p-5">
      <h2 className="text-sm font-semibold">Personalización</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Se guarda en este dispositivo.
      </p>

      <div className="mt-4 space-y-5">
        {/* Accent */}
        <Field label="Color de acento">
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => {
              const active = pref.accent === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => update({ accent: a.id })}
                  title={a.name}
                  aria-label={a.name}
                  className={cn(
                    "relative size-8 rounded-full ring-offset-2 ring-offset-background transition-transform duration-200 [transition-timing-function:var(--ease-out)] hover:scale-110",
                    active && "ring-2 ring-foreground/40",
                  )}
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${a.c1}, ${a.c2})`,
                  }}
                >
                  {active ? (
                    <Check className="absolute inset-0 m-auto size-4 text-white drop-shadow" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Density */}
        <Field label="Densidad">
          <SegmentedControl<Density>
            value={pref.density}
            onChange={(v) => update({ density: v })}
            options={[
              { value: "comfortable", label: "Cómoda" },
              { value: "compact", label: "Compacta" },
            ]}
          />
        </Field>

        {/* Font size */}
        <Field label="Tamaño de fuente">
          <SegmentedControl<FontSize>
            value={pref.fontSize}
            onChange={(v) => update({ fontSize: v })}
            options={[
              { value: "sm", label: "Pequeña" },
              { value: "md", label: "Mediana" },
              { value: "lg", label: "Grande" },
            ]}
          />
        </Field>

        {/* Compact sidebar */}
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Sidebar compacto</span>
            <span className="block text-xs text-muted-foreground">
              Solo iconos, sin etiquetas.
            </span>
          </span>
          <Toggle
            checked={pref.compactSidebar}
            onChange={(v) => update({ compactSidebar: v })}
          />
        </label>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">{label}</div>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-3 py-1 text-sm transition-colors",
            value === o.value
              ? "accent-soft font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 [transition-timing-function:var(--ease-out)]",
        checked ? "accent-grad" : "bg-foreground/15",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 [transition-timing-function:var(--ease-out)]",
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
