"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function FormModal({
  open,
  title,
  description,
  size = "medium",
  trigger,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  size?: "small" | "medium" | "large";
  trigger: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]"
    );
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]"
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-3 backdrop-blur-[3px] sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
          <div ref={dialogRef} data-size={size} className={`form-modal relative z-[101] flex h-[calc(100dvh-1.5rem)] max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:h-auto ${size === "small" ? "max-w-md" : size === "large" ? "max-w-4xl" : "max-w-2xl"}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="flex shrink-0 items-start justify-between border-b border-line bg-surface px-5 py-4 sm:px-6">
              <div><h2 id={titleId} className="form-modal-title text-lg font-semibold text-ink">{title}</h2>{description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}</div>
              <button type="button" onClick={onClose} className="ml-4 rounded-md p-2 text-ink-muted transition-colors hover:bg-canvas hover:text-ink" aria-label="Tutup dialog"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-5 sm:p-6">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
