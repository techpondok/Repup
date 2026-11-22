"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TrainerDrawer({ title, onClose, children, centered = false }: { title: string; onClose: () => void; children: ReactNode; centered?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    return () => { if (element.open) element.close(); focused?.focus(); };
  }, []);

  return <dialog ref={dialog} aria-labelledby={heading} onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    className={`fixed overflow-hidden border border-line bg-surface text-ink shadow-xl backdrop:bg-black/55 ${centered ? "inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg rounded-xl" : "inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-3xl"}`}>
    <div className={`flex min-h-0 flex-col ${centered ? "max-h-[calc(100dvh-2rem)]" : "h-full"}`}>
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6">
        <h2 id={heading} className="text-lg font-semibold">{title}</h2>
        <Button type="button" variant="ghost" size="sm" aria-label="Close drawer" onClick={onClose}><X size={18} /></Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
    </div>
  </dialog>;
}
