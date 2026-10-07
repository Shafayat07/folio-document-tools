"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { AppError } from "@/lib/core/errors";
import { cn, uid } from "@/lib/core/utils";

type Tone = "info" | "success" | "error";

interface Toast {
  id: string;
  tone: Tone;
  title: string;
  message?: string;
  hint?: string;
}

interface ToastApi {
  notify: (toast: Omit<Toast, "id">) => void;
  notifyError: (error: unknown, fallbackTitle?: string) => void;
  /** Report a batch of import errors as one grouped toast. */
  notifyErrors: (errors: AppError[]) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

const DURATIONS: Record<Tone, number> = { info: 6000, success: 5000, error: 10000 };

const ICONS: Record<Tone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  error: AlertTriangle,
};

const TONE_STYLES: Record<Tone, string> = {
  info: "border-line text-ink",
  success: "border-[#CBE9D8] text-ink",
  error: "border-[#F3C6C2] text-ink",
};

const ICON_STYLES: Record<Tone, string> = {
  info: "text-ink-400",
  success: "text-success",
  error: "text-danger",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = uid("toast");
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      const timer = window.setTimeout(() => dismiss(id), DURATIONS[toast.tone]);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const notifyError = useCallback(
    (error: unknown, fallbackTitle = "Something went wrong") => {
      if (error instanceof AppError) {
        notify({ tone: "error", title: error.title, message: error.message, hint: error.hint });
        return;
      }
      const message = error instanceof Error ? error.message : undefined;
      notify({ tone: "error", title: fallbackTitle, message });
    },
    [notify],
  );

  const notifyErrors = useCallback(
    (errors: AppError[]) => {
      if (!errors.length) return;
      if (errors.length === 1) {
        notifyError(errors[0]);
        return;
      }
      // Group so importing 30 files cannot produce 30 toasts.
      const sample = errors.slice(0, 3).map((error) => error.message);
      notify({
        tone: "error",
        title: `${errors.length} files were skipped`,
        message: sample.join(" "),
        hint: errors.length > 3 ? `…and ${errors.length - 3} more.` : errors[0].hint,
      });
    },
    [notify, notifyError],
  );

  const api = useMemo<ToastApi>(() => ({ notify, notifyError, notifyErrors, dismiss }), [notify, notifyError, notifyErrors, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:right-4 sm:left-auto sm:items-end sm:px-0 sm:pr-4"
        aria-live="polite"
        role="status"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded border bg-surface p-3 shadow-pop animate-pop-in",
                TONE_STYLES[toast.tone],
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_STYLES[toast.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug">{toast.title}</p>
                {toast.message ? <p className="mt-0.5 text-[13px] leading-snug text-ink-500">{toast.message}</p> : null}
                {toast.hint ? <p className="mt-1 text-2xs leading-snug text-ink-400">{toast.hint}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-400 hover:bg-[#ECEEF0] hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
