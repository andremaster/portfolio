"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "./icons";

export function Submit({ children, className = "btn btn-primary", pendingText = "Salvando…" }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending} type="submit">{pending ? pendingText : children}</button>;
}

export function FormMessage({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (!state) return null;
  if (state.error) return <div className="alert alert-error" role="alert">{state.error}</div>;
  if (state.ok) return <div className="alert alert-ok" role="status">{state.ok}</div>;
  return null;
}

/** Modal no desktop, bottom sheet no celular. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="sheet-head">
        <h2>{title}</h2>
        <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="x" /></button>
      </div>
      <div className="sheet-body">{open && children}</div>
    </dialog>
  );
}

