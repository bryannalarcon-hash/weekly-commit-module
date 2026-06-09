// apps/wc-remote/src/app/guards.test.tsx — tests for the CB-2 "Demo personas" login bypass on the
// standalone sign-in screen. Mocks useWcAuth directly (guards are pure UX over that context) and
// ONLY isE2e from the e2eAuth seam (the VITE_E2E flag is environment-driven; same pattern as the
// AuthBridge/PersonaPill tests) — persistE2eIdentity stays REAL so the test proves a bypass click
// writes the hermetic-identity localStorage keys the seam reads. window.location is swapped (jsdom
// assign is non-configurable; host.test.tsx pattern). KTD13: the section must be ABSENT when the
// hermetic demo mode is off. The broader guard states (loading/manager) live in AuthBridge.test.tsx.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RequireAuth } from './guards';

// Guards read auth purely from useWcAuth — mock it unauthenticated so the sign-in screen renders.
vi.mock('./AuthBridge', () => ({
  useWcAuth: () => ({
    getToken: async () => null,
    isAuthenticated: false,
    isLoading: false,
    isManager: false,
    login: vi.fn(),
  }),
}));

// Controllable isE2e; the rest of e2eAuth (persistE2eIdentity etc.) stays REAL.
const e2eState = vi.hoisted(() => ({ enabled: false }));
vi.mock('./e2eAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./e2eAuth')>();
  return { ...actual, isE2e: () => e2eState.enabled };
});

// jsdom's location.assign is non-configurable, so swap the whole location object per test.
const realLocation = window.location;
const assign = vi.fn();

beforeEach(() => {
  e2eState.enabled = false;
  window.localStorage.clear();
  assign.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...realLocation, search: '', assign },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: realLocation,
  });
  window.localStorage.clear();
});

describe('RequireAuth demo bypass (CB-2)', () => {
  it('hides the demo-personas section on the real Auth0 path (KTD13)', () => {
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );
    // The normal sign-in screen renders, but NO bypass affordance.
    expect(screen.getByTestId('auth-required')).toBeInTheDocument();
    expect(screen.getByTestId('auth-signin')).toBeInTheDocument();
    expect(screen.queryByTestId('demo-bypass')).not.toBeInTheDocument();
    expect(screen.queryByTestId('demo-login-priya')).not.toBeInTheDocument();
  });

  it('shows one quick-login button per seeded persona in the hermetic demo build', () => {
    e2eState.enabled = true;
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );
    expect(screen.getByTestId('demo-bypass')).toBeInTheDocument();
    for (const slug of ['sofia', 'priya', 'diego', 'sana', 'tom']) {
      expect(screen.getByTestId(`demo-login-${slug}`)).toBeInTheDocument();
    }
    // Human-readable labels (name + role), and the Auth0 buttons are still present above.
    expect(screen.getByTestId('demo-login-sofia')).toHaveTextContent('Sofia Romano');
    expect(screen.getByTestId('demo-login-sofia')).toHaveTextContent('Admin');
    expect(screen.getByTestId('demo-login-diego')).toHaveTextContent('Diego Alvarez');
    expect(screen.getByTestId('auth-signin')).toBeInTheDocument();
  });

  it('clicking a persona persists the hermetic identity (the ?member= seam keys) and reloads to /', async () => {
    e2eState.enabled = true;
    const user = userEvent.setup();
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );

    await user.click(screen.getByTestId('demo-login-priya'));

    // Same localStorage contract as visiting ?member=priya&manager=true&name=Priya Menon.
    expect(window.localStorage.getItem('wcm.e2e.member')).toBe('priya');
    expect(window.localStorage.getItem('wcm.e2e.manager')).toBe('true');
    expect(window.localStorage.getItem('wcm.e2e.name')).toBe('Priya Menon');
    // Full reload so identity re-resolves cleanly (fresh auth + RTK cache).
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/');
  });

  it('an employee persona persists manager=false', async () => {
    e2eState.enabled = true;
    const user = userEvent.setup();
    render(
      <RequireAuth>
        <div>secret</div>
      </RequireAuth>,
    );

    await user.click(screen.getByTestId('demo-login-sana'));
    expect(window.localStorage.getItem('wcm.e2e.member')).toBe('sana');
    expect(window.localStorage.getItem('wcm.e2e.manager')).toBe('false');
    expect(window.localStorage.getItem('wcm.e2e.name')).toBe('Sana Khan');
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/');
  });
});
