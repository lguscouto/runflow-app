"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

interface UseModalA11yOptions {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function getFocusableElements(modal: HTMLElement): HTMLElement[] {
  return Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true" &&
      !element.closest('[aria-hidden="true"]')
  );
}

function getActiveDialog(): Element | null {
  const activeElement = document.activeElement;
  return activeElement instanceof Element
    ? activeElement.closest('[role="dialog"]')
    : null;
}

export function useModalA11y<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  initialFocusRef,
}: UseModalA11yOptions) {
  const modalRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const initialFocusRefRef = useRef(initialFocusRef);

  // Keep callbacks current without restarting the modal lifecycle when a parent
  // passes an inline callback on every render.
  onCloseRef.current = onClose;
  initialFocusRefRef.current = initialFocusRef;

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitialControl = () => {
      const modal = modalRef.current;
      if (!modal) return;

      const requestedInitialFocus = initialFocusRefRef.current?.current;
      if (requestedInitialFocus && modal.contains(requestedInitialFocus)) {
        requestedInitialFocus.focus();
        return;
      }

      const firstFocusable = getFocusableElements(modal)[0];
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        modal.focus();
      }
    };

    focusInitialControl();

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = modalRef.current;
      if (!modal) return;

      // A builder can be opened inside the library modal. Only the topmost
      // dialog should consume keyboard events in that case.
      const activeDialog = getActiveDialog();
      if (activeDialog && activeDialog !== modal) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !modal.contains(document.activeElement)) return;

      const focusable = getFocusableElements(modal);
      if (focusable.length === 0) {
        event.preventDefault();
        modal.focus();
        return;
      }

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

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);

      const elementToRestore = previousActiveElement.current;
      previousActiveElement.current = null;
      if (elementToRestore?.isConnected) {
        elementToRestore.focus();
      }
    };
  }, [isOpen]);

  return { modalRef };
}
