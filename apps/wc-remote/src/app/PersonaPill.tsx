// apps/wc-remote/src/app/PersonaPill.tsx — the CB-2 demo account-switcher pill. A floating pill
// (fixed bottom-right of the remote's region) showing the acting demo persona; clicking opens an
// upward menu of the seeded personas. Selecting a different one persists the hermetic identity
// (e2eAuth.persistE2eIdentity — the same localStorage keys the `?member=` seam writes) and does a
// full window.location.assign reload so auth re-resolves and the RTK Query cache starts fresh
// (deliberate; no stale cross-member data). HARD GUARD (KTD13): renders null unless isE2e() — the
// real Auth0 path never shows it. Esc / outside-click closes the menu (local listeners, no Scrim so
// the page is not dimmed). The menu also exposes a demo-only "Reset demo data" action (persona-reset):
// after a window.confirm guard it POSTs /api/e2e/reset (same-origin via nginx) then hard-reloads to
// the seeded state. Testids: persona-pill, persona-menu, persona-option-<slug>, persona-signout,
// persona-reset.
import { useEffect, useRef, useState } from 'react';
import { Avatar, Icon } from '@wcm/ui';
import {
  DEMO_PERSONAS,
  identityOf,
  isE2e,
  persistE2eIdentity,
  personaForMember,
  resolveE2eIdentity,
  setE2eSignedOut,
  type DemoPersona,
} from './e2eAuth';

/**
 * Switch the acting demo persona: persist the identity, then hard-navigate with the full
 * `?member=&manager=&name=` seam params (member alone would re-resolve with manager=false —
 * the URL is authoritative, so it must carry the whole identity).
 */
function switchToPersona(p: DemoPersona): void {
  persistE2eIdentity(identityOf(p));
  const q = new URLSearchParams({ member: p.slug, manager: String(p.isManager), name: p.name });
  window.location.assign(`/?${q.toString()}`);
}

/**
 * Reset the demo back to its seeded state: confirm (so an accidental click doesn't wipe state),
 * POST the backend reset endpoint (same-origin via nginx — the data layer's '/api' base), then
 * hard-reload to '/' regardless of the request outcome so identity + RTK Query re-resolve fresh.
 */
function resetDemoData(): void {
  if (!window.confirm('Reset all demo data to the seeded state?')) return;
  void fetch('/api/e2e/reset', { method: 'POST' }).finally(() => window.location.assign('/'));
}

export function PersonaPill(): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape / click outside the pill+menu. Listeners only while open; cleaned up on close.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent): void => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // HARD GUARD (KTD13): demo-only affordance — never on the real Auth0 path.
  if (!isE2e()) return null;

  const identity = resolveE2eIdentity();
  const current = personaForMember(identity.member);
  const displayName = current?.name ?? identity.name;
  const firstName = displayName.split(/\s+/)[0] ?? displayName;

  const onSelect = (p: DemoPersona): void => {
    if (p.slug === current?.slug) {
      setOpen(false); // already acting as them — nothing to switch
      return;
    }
    switchToPersona(p);
  };

  return (
    <div ref={rootRef} style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 70 }}>
      {open ? (
        <div
          role="menu"
          aria-label="Switch demo persona"
          data-testid="persona-menu"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: 0,
            minWidth: 230,
            background: 'var(--surface-1)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-pop)',
            padding: 6,
            animation: 'riseIn .18s ease both',
          }}
        >
          <div className="kicker" style={{ padding: '6px 10px 4px' }}>
            Demo personas
          </div>
          {DEMO_PERSONAS.map((p) => {
            const isCurrent = p.slug === current?.slug;
            return (
              <button
                key={p.slug}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                data-testid={`persona-option-${p.slug}`}
                onClick={() => onSelect(p)}
                className="btn btn-quiet"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: 'var(--r-sm)',
                  textAlign: 'left',
                }}
              >
                <Avatar name={p.name} hue={p.hue} size={24} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {p.name}
                  </span>
                  {p.role ? (
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-low)' }}>
                      {p.role}
                    </span>
                  ) : null}
                </span>
                {isCurrent ? (
                  <Icon.check size={14} style={{ color: 'var(--signal)' }} aria-hidden />
                ) : null}
              </button>
            );
          })}
          {/* Hermetic sign-out: sets the e2e signed-out flag and reloads, surfacing the standalone
              login screen with the demo bypass (the full CB-2 loop is demonstrable). */}
          <div style={{ borderTop: '1px solid var(--line-soft)', margin: '6px 4px 4px' }} />
          <button
            type="button"
            role="menuitem"
            data-testid="persona-signout"
            onClick={() => {
              setE2eSignedOut(true);
              window.location.assign('/');
            }}
            className="btn btn-quiet"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              width: '100%',
              padding: '7px 10px',
              borderRadius: 'var(--r-sm)',
              textAlign: 'left',
              color: 'var(--red)',
            }}
          >
            <Icon.unlock size={14} aria-hidden /> Sign out
          </button>
          {/* Demo-only data reset: re-seed the backend, then hard-reload to the clean seeded state. */}
          <button
            type="button"
            role="menuitem"
            data-testid="persona-reset"
            onClick={resetDemoData}
            className="btn btn-quiet"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              width: '100%',
              padding: '7px 10px',
              borderRadius: 'var(--r-sm)',
              textAlign: 'left',
              color: 'var(--ink-mid)',
            }}
          >
            <Icon.refresh size={14} aria-hidden /> Reset demo data
          </button>
        </div>
      ) : null}
      <button
        type="button"
        data-testid="persona-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Acting as ${displayName} — switch demo persona`}
        onClick={() => setOpen((v) => !v)}
        className="lift"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px 6px 7px',
          borderRadius: 'var(--r-pill)',
          border: '1px solid var(--line)',
          background: 'var(--surface-1)',
          boxShadow: 'var(--shadow-pop)',
          cursor: 'pointer',
          color: 'var(--ink)',
          font: 'inherit',
        }}
      >
        <Avatar name={displayName} hue={current?.hue} size={22} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{firstName}</span>
        <Icon.chevD
          size={13}
          aria-hidden
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        />
      </button>
    </div>
  );
}
