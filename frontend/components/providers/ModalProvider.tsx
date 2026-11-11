"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Modal, type ModalSize } from "@/components/ui/Modal";

type ModalOptions = {
  dismissable?: boolean;
  /** Max width of the popup. Defaults to "lg". */
  size?: ModalSize;
};

type ModalContextValue = {
  /** Open a popup with arbitrary content. */
  open: (content: ReactNode, options?: ModalOptions) => void;
  /** Close the current popup. */
  close: () => void;
  isOpen: boolean;
};

const ModalContext = createContext<ModalContextValue | null>(null);

/**
 * App-wide popup mechanism. Any feature can render a popup imperatively:
 *
 *   const { open } = useModal();
 *   open(<ConfirmDelete onDone={close} />);
 */
export function ModalProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null);
  const [options, setOptions] = useState<ModalOptions>({});

  const open = useCallback((node: ReactNode, opts: ModalOptions = {}) => {
    setOptions(opts);
    setContent(node);
  }, []);

  const close = useCallback(() => setContent(null), []);

  // Close any open popup on route change — otherwise a modal that triggers
  // navigation (e.g. "Go to profile") would stay mounted over the new page.
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  useEffect(() => {
    if (firstPath.current === pathname) return;
    firstPath.current = pathname;
    setContent(null);
  }, [pathname]);

  return (
    <ModalContext.Provider value={{ open, close, isOpen: content !== null }}>
      {children}
      <Modal
        open={content !== null}
        onClose={close}
        dismissable={options.dismissable}
        size={options.size}
      >
        {content}
      </Modal>
    </ModalContext.Provider>
  );
}

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("useModal must be used within a <ModalProvider>");
  }
  return ctx;
}
