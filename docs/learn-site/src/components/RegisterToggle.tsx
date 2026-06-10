// RegisterToggle.tsx — a small Plain⇄Deep segmented switch.
// Reused in the header (sets the default) and per-panel (local override).
import type { Register } from '../types';

interface Props {
  value: Register;
  onChange: (next: Register) => void;
  /** Accessible label describing what this toggle controls. */
  label: string;
  size?: 'sm' | 'md';
}

export function RegisterToggle({ value, onChange, label, size = 'md' }: Props) {
  return (
    <div className={`register-toggle register-toggle--${size}`} role="group" aria-label={label}>
      <button
        type="button"
        className={value === 'plain' ? 'is-active' : ''}
        aria-pressed={value === 'plain'}
        onClick={() => onChange('plain')}
      >
        Plain
      </button>
      <button
        type="button"
        className={value === 'deep' ? 'is-active' : ''}
        aria-pressed={value === 'deep'}
        onClick={() => onChange('deep')}
      >
        Deep
      </button>
    </div>
  );
}
