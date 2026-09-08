"use client";

import { useEffect, type ReactNode } from "react";
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
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
          <div className={`form-modal flex max-h-[90vh] w-full flex-col rounded-lg border border-line bg-surface shadow-xl ${size === "small" ? "max-w-md" : size === "large" ? "max-w-4xl" : "max-w-2xl"}`} role="dialog" aria-modal="true" aria-labelledby="form-modal-title">
            <div className="flex shrink-0 items-start justify-between border-b border-line px-6 py-4">
              <div><h2 id="form-modal-title" className="form-modal-title text-lg font-semibold text-ink">{title}</h2>{description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}</div>
              <button type="button" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-canvas hover:text-ink" aria-label="Tutup dialog"><X size={18} /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-6">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
