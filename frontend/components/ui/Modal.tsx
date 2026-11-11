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
 * Base popup built on the native <dialog> element, so focus-trapping,
 * Esc-to-close and the backdrop come for free. Prefer the imperative
 * `useModal()` API for feature usage; use this directly for declarative cases.
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
        // The dialog element itself fills the backdrop; clicks on children
        // won't have it as the target.
        if (dismissable && e.target === ref.current) onClose();
      }}
      className={`m-auto w-full ${SIZE_CLASS[size]} rounded-xl border border-black/10 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50 dark:border-white/10`}
    >
      {open && <div className="p-6">{children}</div>}
    </dialog>
  );
}
