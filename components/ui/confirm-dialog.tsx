"use client";

import { FormModal } from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({ open, title, description, onClose, onConfirm, pending = false, confirmLabel = "Konfirmasi", destructive = false }: { open: boolean; title: string; description: string; onClose: () => void; onConfirm: () => void; pending?: boolean; confirmLabel?: string; destructive?: boolean }) {
  return <FormModal open={open} title={title} description={description} onClose={() => { if (!pending) onClose(); }} trigger={null} size="small"><div className="flex flex-wrap justify-end gap-3"><Button variant="secondary" disabled={pending} onClick={onClose}>Batal</Button><Button variant={destructive ? "danger" : "primary"} disabled={pending} aria-busy={pending} onClick={onConfirm}>{pending ? "Memproses…" : confirmLabel}</Button></div></FormModal>;
}
