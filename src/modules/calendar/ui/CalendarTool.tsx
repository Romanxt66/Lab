"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  MapPin,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorNote } from "@/modules/dev-utils/ui/shared";
import { cn } from "@/lib/utils";
import {
  listMonthAction,
  saveEventAction,
  deleteEventAction,
  type SaveEventInput,
} from "@/modules/calendar/actions";
import type { EventDTO } from "@/modules/calendar/domain/event";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function sameDay(a: Date, b: Date) {
  return ymd(a) === ymd(b);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function CalendarTool() {
  // Render only after mount: the calendar renders locale/timezone-dependent
  // dates, which would otherwise mismatch between server and client.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="h-[520px] animate-pulse rounded-lg border border-border/60 bg-foreground/[0.03]" />
    );
  }
  return <CalendarInner />;
}

function CalendarInner() {
  const today = React.useMemo(() => new Date(), []);
  const [view, setView] = React.useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selected, setSelected] = React.useState<Date>(today);
  const [events, setEvents] = React.useState<EventDTO[]>([]);
  const [loading, setLoading] = React.useState(false);

  const year = view.getFullYear();
  const month0 = view.getMonth();

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await listMonthAction(year, month0 + 1));
    } finally {
      setLoading(false);
    }
  }, [year, month0]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // 6-week grid starting on the Monday on/before the 1st.
  const gridStart = React.useMemo(() => {
    const first = new Date(year, month0, 1);
    return addDays(first, -((first.getDay() + 6) % 7));
  }, [year, month0]);
  const cells = React.useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart],
  );

  function eventsOn(day: Date) {
    return events.filter((e) => sameDay(new Date(e.start), day));
  }

  const selectedEvents = eventsOn(selected).sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* Month grid */}
      <div className="glass rounded-lg border border-border/60 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium capitalize tracking-tight">
            {MONTHS[month0]} {year}
            {loading ? (
              <Loader2 className="ml-2 inline size-3.5 animate-spin text-muted-foreground" />
            ) : null}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView(new Date(year, month0 - 1, 1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setView(new Date(today.getFullYear(), today.getMonth(), 1));
                setSelected(today);
              }}
            >
              Hoy
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setView(new Date(year, month0 + 1, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="pb-1 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day) => {
            const inMonth = day.getMonth() === month0;
            const isToday = sameDay(day, today);
            const isSelected = sameDay(day, selected);
            const dayEvents = eventsOn(day);
            return (
              <button
                key={ymd(day)}
                onClick={() => setSelected(new Date(day))}
                className={cn(
                  "group flex aspect-square flex-col rounded-md border p-1.5 text-left transition-[background-color,border-color,transform] duration-200 [transition-timing-function:var(--ease-out)]",
                  isSelected
                    ? "border-foreground/40 bg-foreground/[0.06]"
                    : "border-transparent hover:border-border hover:bg-foreground/[0.03]",
                  !inMonth && "opacity-35",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs",
                    isToday
                      ? "bg-foreground font-semibold text-background"
                      : "text-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
                <div className="mt-1 flex-1 space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div
                      key={e.id}
                      className="truncate rounded bg-foreground/10 px-1 py-0.5 text-[10px] leading-tight text-foreground"
                      title={e.title}
                    >
                      {!e.allDay ? (
                        <span className="tabular-nums text-muted-foreground">
                          {new Date(e.start).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                        </span>
                      ) : null}
                      {e.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 ? (
                    <div className="px-1 text-[10px] text-muted-foreground">
                      +{dayEvents.length - 3} más
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day panel */}
      <DayPanel
        date={selected}
        events={selectedEvents}
        onChanged={refresh}
      />
    </div>
  );
}

function DayPanel({
  date,
  events,
  onChanged,
}: {
  date: Date;
  events: EventDTO[];
  onChanged: () => void | Promise<void>;
}) {
  const [editing, setEditing] = React.useState<EventDTO | null>(null);
  const [adding, setAdding] = React.useState(false);

  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium capitalize">
          {date.toLocaleDateString("es", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h3>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setAdding(true);
          }}
        >
          <Plus />
          Evento
        </Button>
      </div>

      {adding || editing ? (
        <EventForm
          date={date}
          event={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSaved={async () => {
            setAdding(false);
            setEditing(null);
            await onChanged();
          }}
        />
      ) : null}

      {events.length === 0 && !adding ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Sin eventos este día.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className="glass rounded-lg border border-border/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{e.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {e.allDay
                      ? "Todo el día"
                      : new Date(e.start).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }) +
                        (e.end
                          ? "–" +
                            new Date(e.end).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "")}
                  </p>
                  {e.location ? (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {e.location}
                    </p>
                  ) : null}
                  {e.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {e.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAdding(false);
                      setEditing(e);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Eliminar"
                    onClick={async () => {
                      await deleteEventAction(e.id);
                      await onChanged();
                    }}
                  >
                    <Trash2 className="text-danger" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function EventForm({
  date,
  event,
  onClose,
  onSaved,
}: {
  date: Date;
  event: EventDTO | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const startDate = event ? new Date(event.start) : date;
  const [title, setTitle] = React.useState(event?.title ?? "");
  const [day, setDay] = React.useState(ymd(startDate));
  const [allDay, setAllDay] = React.useState(event?.allDay ?? false);
  const [startTime, setStartTime] = React.useState(
    event && !event.allDay
      ? `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`
      : "09:00",
  );
  const [endTime, setEndTime] = React.useState(
    event?.end
      ? `${pad(new Date(event.end).getHours())}:${pad(
          new Date(event.end).getMinutes(),
        )}`
      : "10:00",
  );
  const [description, setDescription] = React.useState(event?.description ?? "");
  const [location, setLocation] = React.useState(event?.location ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const start = allDay
        ? new Date(`${day}T00:00`)
        : new Date(`${day}T${startTime}`);
      const end = allDay
        ? null
        : endTime
          ? new Date(`${day}T${endTime}`)
          : null;
      const input: SaveEventInput = {
        id: event?.id,
        title,
        description: description || undefined,
        location: location || undefined,
        start: start.toISOString(),
        end: end ? end.toISOString() : null,
        allDay,
      };
      const res = await saveEventAction(input);
      if (res.ok) await onSaved();
      else setError(res.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass space-y-3 rounded-lg border border-border/60 p-3">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título del evento"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          className="flex-1"
        />
        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          Todo el día
        </label>
      </div>
      {!allDay ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Inicio</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fin</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
      ) : null}
      <Input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Ubicación (opcional)"
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción (opcional)"
        className="min-h-16 font-sans"
      />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="animate-spin" /> : null}
          {event ? "Guardar" : "Añadir"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
