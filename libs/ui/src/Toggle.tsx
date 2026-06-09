// libs/ui/src/Toggle.tsx — the on/off switch (prototype/wcm/ui.jsx Toggle). An accessible role=switch
// button: signal-green track when on, surface-3 track when off, with a sliding white knob. The visible
// label is supplied by the caller's surrounding text; `label` here is the accessible name. Controlled —
// the parent owns `on` and gets the next value via onChange. data-testid=toggle, data-state on/off.

export interface ToggleProps {
  on: boolean;
  onChange: (next: boolean) => void;
  /** Accessible label (aria-label) — required so the switch is named for AT. */
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Toggle({ on, onChange, label, disabled = false, className }: ToggleProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      data-testid="toggle"
      data-state={on ? 'on' : 'off'}
      onClick={() => onChange(!on)}
      className={className}
      style={{
        width: 40,
        height: 23,
        borderRadius: 99,
        border: '1px solid',
        flex: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'background .15s, border-color .15s',
        background: on ? 'var(--signal)' : 'var(--surface-3)',
        borderColor: on ? 'var(--signal)' : 'var(--line-bright)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 19 : 2,
          width: 17,
          height: 17,
          borderRadius: 99,
          background: '#fff',
          boxShadow: 'var(--shadow-1)',
          transition: 'left .16s ease',
        }}
      />
    </button>
  );
}
