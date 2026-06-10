// libs/ui/src/Scrim.tsx — the modal/drawer backdrop shell (prototype/wcm/ui.jsx Scrim). A fixed,
// blurred tinted overlay that closes on Escape (keydown listener, cleaned up on unmount) and on a
// click outside its content (clicks inside stop-propagate). `align` centers the content (modals) or
// pins it right (drawers). FOCUS MANAGEMENT (WAI-ARIA dialog): on mount, focus moves into the
// content (the first [data-autofocus] element, else the first focusable); Tab/Shift-Tab wrap at the
// content edges via an element-scoped onKeyDown (no document listener — leak-free under parallel
// tests / stacked modals); on unmount, focus returns to the element that was focused when the scrim
// opened. The caller renders the actual panel as children. data-testid=scrim, with
// data-testid=scrim-content on the inner stop-propagation wrapper.
import { useEffect, useRef } from 'react';
import type React from 'react';
import type { ReactNode } from 'react';

export interface ScrimProps {
  onClose: () => void;
  children: ReactNode;
  /** 'center' for modals (default), 'right' for slide-in drawers. */
  align?: 'center' | 'right';
  /** Accessible label for the overlay region. */
  label?: string;
}

/** Everything keyboard-reachable inside the dialog content. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Scrim({ onClose, children, align = 'center', label }: ScrimProps): JSX.Element {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Initial focus + focus restore: runs once per mount. The opener's focused element is captured
  // synchronously, focus moves to [data-autofocus] (or the first focusable) inside the content, and
  // on unmount focus returns to the opener (if it is still in the document).
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const content = contentRef.current;
    if (content) {
      const target =
        content.querySelector<HTMLElement>('[data-autofocus]') ??
        content.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }
    return () => {
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  // Tab trap — wrap Tab/Shift-Tab at the content's edges. Scoped to the content element via onKeyDown
  // (NOT a document-level listener), so it only acts while focus is inside the dialog and leaves no
  // global side effect — important under parallel test load and when modals stack.
  const onContentKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Tab') return;
    const content = contentRef.current;
    if (!content) return;
    const focusables = Array.from(content.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    }
  };

  return (
    <div
      data-testid="scrim"
      aria-label={label}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'oklch(0.2 0.03 260 / 0.42)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        justifyContent: align === 'right' ? 'flex-end' : 'center',
        alignItems: align === 'center' ? 'center' : 'stretch',
        padding: align === 'center' ? 20 : 0,
      }}
    >
      <div
        ref={contentRef}
        data-testid="scrim-content"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onContentKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
