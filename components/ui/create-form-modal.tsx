"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/ui/form-modal";

export function CreateFormModal({
  title,
  description,
  size = "medium",
  label,
  form,
}: {
  title: string;
  description?: string;
  size?: "small" | "medium" | "large";
  label: string;
  form: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleSuccess = () => close();
    window.addEventListener("repup:crud-success", handleSuccess);
    return () => window.removeEventListener("repup:crud-success", handleSuccess);
  }, [open, close]);

  return <FormModal open={open} onClose={close} title={title} description={description} size={size} trigger={<Button onClick={() => setOpen(true)}>{label}</Button>}>{form}</FormModal>;
}