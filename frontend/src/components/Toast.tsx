import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircle,
  Info,
  Warning,
  XCircle,
} from "@phosphor-icons/react";
import {
  ToastContext,
  type ToastContextValue,
  type ToastEntry,
  type ToastOptions,
  type ToastVariant,
} from "./toast-context";

/* ── Constants ──────────────────────────────────────── */

const MAX_TOASTS = 5;
const DEFAULT_DURATION = 4000;
const ENTER_MS = 300;
const EXIT_MS = 200;

let nextId = 0;

/* ── Variant config ─────────────────────────────────── */

const variantBorder: Record<ToastVariant, string> = {
  default: "border-l-gray-5",
  success: "border-l-emerald",
  warning: "border-l-amber",
  error:   "border-l-rose",
};

const variantIcon: Record<ToastVariant, ReactNode> = {
  default: <Info   weight="fill" size={16} className="text-gray-7 shrink-0" />,
  success: <CheckCircle weight="fill" size={16} className="text-emerald shrink-0" />,
  warning: <Warning     weight="fill" size={16} className="text-amber shrink-0" />,
  error:   <XCircle     weight="fill" size={16} className="text-rose shrink-0" />,
};

/* ── Individual toast ───────────────────────────────── */

function ToastItem({
  entry,
  onDismiss,
}: {
  entry: ToastEntry;
  onDismiss: (id: number) => void;
}) {
  const animClass =
    entry.state === "entering"
      ? "animate-toast-enter"
      : entry.state === "exiting"
        ? "animate-toast-exit"
        : "translate-x-0 opacity-100";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        flex items-center gap-3 px-4 py-3
        bg-white border border-rule border-l-2 ${variantBorder[entry.variant]}
        shadow-[var(--shadow-elevated)] font-body text-sm text-ink
        rounded-[var(--radius-card)]
        ${animClass}
      `}
    >
      {variantIcon[entry.variant]}

      <span className="flex-1 min-w-0">{entry.message}</span>

      {entry.action && (
        <button
          type="button"
          onClick={() => {
            entry.action!.onClick();
            onDismiss(entry.id);
          }}
          className="text-orange text-xs font-semibold hover:underline shrink-0 cursor-pointer"
        >
          {entry.action.label}
        </button>
      )}

      <button
        type="button"
        onClick={() => onDismiss(entry.id)}
        className="text-muted hover:text-ink transition-colors shrink-0 cursor-pointer leading-none text-base"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

/* ── Provider ───────────────────────────────────────── */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  /* Clean up timers on unmount */
  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      for (const timer of currentTimers.values()) clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    /* Begin exit animation */
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, state: "exiting" as const } : t)),
    );

    /* Remove after animation completes */
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, EXIT_MS);
    timers.current.set(id, timer);
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId++;
      const duration = options.duration ?? DEFAULT_DURATION;
      const variant = options.variant ?? "default";

      const entry: ToastEntry = {
        id,
        message: options.message,
        variant,
        duration,
        action: options.action,
        state: "entering",
      };

      setToasts((prev) => {
        /* Trim oldest if at max capacity */
        const trimmed =
          prev.length >= MAX_TOASTS ? prev.slice(prev.length - MAX_TOASTS + 1) : prev;
        return [...trimmed, entry];
      });

      /* Transition to visible after enter animation */
      const enterTimer = setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, state: "visible" as const } : t)),
        );
      }, ENTER_MS);
      timers.current.set(-id - 1, enterTimer);

      /* Schedule auto-dismiss */
      const dismissTimer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, dismissTimer);
    },
    [dismiss],
  );

  const value: ToastContextValue = { toast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-[360px] max-w-[calc(100vw-3rem)] pointer-events-none"
      >
        {toasts.map((entry) => (
          <div key={entry.id} className="pointer-events-auto">
            <ToastItem entry={entry} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
