"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type ModalSize = "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";

const SIZE_CLASS: Record<ModalSize, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Close when clicking the backdrop. Defaults to true. */
  dismissable?: boolean;
  /** Max width of the dialog. Defaults to "lg". */
  size?: ModalSize;
};

/**
 * Base popup built on the native <dialog> element for focus trapping, Esc
 * close and backdrop. Prefer `useModal()` for imperative feature usage.
 */
export function Modal({
  open,
  onClose,
  children,
  dismissable = true,
  size = "lg",
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (dismissable && e.target === ref.current) onClose();
      }}
      className={`m-auto w-full ${SIZE_CLASS[size]} rounded-lg border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40`}
    >
      {open && <div className="p-5">{children}</div>}
    </dialog>
  );
}
