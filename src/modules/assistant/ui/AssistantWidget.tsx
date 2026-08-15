"use client";

import * as React from "react";
import { Send, X, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendAssistantMessageAction } from "@/modules/assistant/actions";
import type { ChatMessage } from "@/modules/assistant/domain/chat";

interface UiMessage extends ChatMessage {
  toolsUsed?: string[];
  isError?: boolean;
}

const GREETING =
  "Hola, soy el asistente del Lab. Puedo consultar tus datos (finanzas, uptime, calendario, inventario, usuarios, automatizaciones) y hacer algunas acciones por ti. ¿En qué ayudo?";

/** The floating avatar + chat panel. Mounted once in the authenticated app shell. */
export function AssistantWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    const history = messages.map((m): ChatMessage => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setThinking(true);
    try {
      const res = await sendAssistantMessageAction(history, text);
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.value.reply, toolsUsed: res.value.toolsUsed },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.error, isError: true },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "No se pudo conectar con el asistente.", isError: true },
      ]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="fixed right-5 bottom-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div
          className="glass-strong assistant-panel-enter flex h-[28rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-border/60 shadow-xl"
          role="dialog"
          aria-label="Asistente del Lab"
        >
          <header className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
            <Avatar size={30} thinking={thinking} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Asistente</p>
              <p className="truncate text-xs text-muted-foreground">
                {thinking ? "Pensando…" : "En línea"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              aria-label="Cerrar chat"
            >
              <X className="size-4" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <Bubble role="assistant" content={GREETING} />
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} toolsUsed={m.toolsUsed} isError={m.isError} />
            ))}
            {thinking ? <ThinkingBubble /> : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t border-border/60 p-2.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta algo sobre el Lab…"
              className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="accent-grad flex size-9 shrink-0 items-center justify-center rounded-md text-white transition-opacity disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      ) : null}

      <button
        onClick={() => {
          setOpen((v) => !v);
          setPressed(true);
          window.setTimeout(() => setPressed(false), 400);
        }}
        aria-label={open ? "Cerrar el asistente" : "Abrir el asistente"}
        aria-expanded={open}
        className="group flex size-14 items-center justify-center rounded-full shadow-lg transition-transform duration-200 [transition-timing-function:var(--ease-out)] hover:scale-105 active:scale-95"
      >
        <Avatar size={56} thinking={thinking} bob={!open} pressed={pressed} />
      </button>
    </div>
  );
}

/**
 * The character: an original blocky pixel-art robot (own design, in the
 * app's accent gradient — not Anthropic's branding). Drawn as crisp SVG
 * rects on a 10x9 grid, Atari-era sprite style: chunky pixels, no
 * anti-aliasing, "steppy" (not eased) motion.
 */
function Avatar({
  size,
  thinking,
  bob,
  pressed,
}: {
  size: number;
  thinking: boolean;
  bob?: boolean;
  pressed?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 10 9"
      shapeRendering="crispEdges"
      className={cn(bob && "assistant-bob", pressed && "assistant-press", thinking && "assistant-thinking-glow")}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Avatar del asistente"
    >
      <defs>
        <linearGradient id="assistant-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--accent-1)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>

      {/* Antenna stick + body silhouette. */}
      <rect x="4" y="1" width="2" height="1" fill="url(#assistant-body)" />
      <rect x="2" y="2" width="6" height="1" fill="url(#assistant-body)" />
      <rect x="1" y="3" width="8" height="1" fill="url(#assistant-body)" />
      <rect x="1" y="4" width="8" height="1" fill="url(#assistant-body)" />
      <rect x="1" y="5" width="8" height="1" fill="url(#assistant-body)" />
      <rect x="1" y="6" width="8" height="1" fill="url(#assistant-body)" />
      <rect x="2" y="7" width="6" height="1" fill="url(#assistant-body)" />
      <rect x="3" y="8" width="4" height="1" fill="url(#assistant-body)" />

      {/* Antenna beacon light. */}
      <rect className="assistant-antenna" x="4" y="0" width="2" height="1" fill="#fff" />

      {/* Eyes. */}
      <rect className="assistant-blink" x="2" y="4" width="2" height="1" fill="#fff" style={{ transformBox: "fill-box" }} />
      <rect
        className="assistant-blink"
        x="6"
        y="4"
        width="2"
        height="1"
        fill="#fff"
        style={{ transformBox: "fill-box", animationDelay: "120ms" }}
      />

      {/* Mouth: idle bar, flaps while thinking. */}
      <rect
        className={thinking ? "assistant-mouth-talk" : undefined}
        x="3"
        y="6"
        width="4"
        height="1"
        fill="var(--background)"
        style={{ transformBox: "fill-box" }}
      />
    </svg>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="glass flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border/50 px-3.5 py-2.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="assistant-think-dot size-1.5 rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  toolsUsed,
  isError,
}: {
  role: ChatMessage["role"];
  content: string;
  toolsUsed?: string[];
  isError?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "accent-grad rounded-br-sm text-white"
            : cn(
                "glass rounded-bl-sm border border-border/50",
                isError && "border-danger/40 text-danger",
              ),
        )}
      >
        {content}
      </div>
      {toolsUsed && toolsUsed.length > 0 ? (
        <p className="mt-1 flex items-center gap-1 px-1 text-[0.65rem] text-muted-foreground">
          <Wrench className="size-2.5" />
          {[...new Set(toolsUsed)].join(", ")}
        </p>
      ) : null}
    </div>
  );
}
