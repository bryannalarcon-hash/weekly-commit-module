// libs/ui/src/Scrim.tsx — the modal/drawer backdrop shell (prototype/wcm/ui.jsx Scrim). A fixed,
// blurred tinted overlay that closes on Escape (keydown listener, cleaned up on unmount) and on a
// click outside its content (clicks inside stop-propagate). `align` centers the content (modals) or
// pins it right (drawers). The caller renders the actual panel as children. data-testid=scrim, with
// data-testid=scrim-content on the inner stop-propagation wrapper.
import { useEffect } from 'react';
import type { ReactNode } from 'react';

export interface ScrimProps {
  onClose: () => void;
  children: ReactNode;
  /** 'center' for modals (default), 'right' for slide-in drawers. */
  align?: 'center' | 'right';
  /** Accessible label for the overlay region. */
  label?: string;
}

export function Scrim({ onClose, children, align = 'center', label }: ScrimProps): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      <div data-testid="scrim-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
