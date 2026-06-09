// apps/wc-remote/src/app/PersonaPill.test.tsx — tests for the CB-2 demo account-switcher pill.
// Mocks ONLY isE2e (the VITE_E2E build flag is environment-driven; same pattern as the AuthBridge
// tests) and keeps the REAL e2eAuth resolver/persist logic against real localStorage, so the tests
// prove the pill actually writes the hermetic-identity keys the seam reads. window.location is
// swapped wholesale (jsdom's assign is non-configurable — same pattern as host.test.tsx) to assert
// the full-reload navigation. Covers: hidden when not e2e (KTD13), current-persona rendering, menu
// open with the acting persona checked, switching persists + navigates, current persona is a no-op
// close, and Esc / outside-click closing.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonaPill } from './PersonaPill';

// Controllable isE2e; everything else in e2eAuth stays REAL (localStorage-backed).
const e2eState = vi.hoisted(() => ({ enabled: true }));
vi.mock('./e2eAuth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./e2eAuth')>();
  return { ...actual, isE2e: () => e2eState.enabled };
});

// jsdom's location.assign is non-configurable, so swap the whole location object per test.
const realLocation = window.location;
const assign = vi.fn();

beforeEach(() => {
  e2eState.enabled = true;
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

describe('PersonaPill', () => {
  it('renders NOTHING when the hermetic demo mode is off (KTD13 — real Auth0 path)', () => {
    e2eState.enabled = false;
    window.localStorage.setItem('wcm.e2e.member', 'priya');
    const { container } = render(<PersonaPill />);
    expect(screen.queryByTestId('persona-pill')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the acting persona (resolved from the seam identity, email form included)', () => {
    window.localStorage.setItem('wcm.e2e.member', 'priya@solovis.test');
    render(<PersonaPill />);
    // Pill shows the persona first name, resolved by slug from the seeded email.
    expect(screen.getByTestId('persona-pill')).toHaveTextContent('Priya');
    expect(screen.queryByTestId('persona-menu')).not.toBeInTheDocument();
  });

  it('opens an upward menu listing every persona with the current one checked', async () => {
    window.localStorage.setItem('wcm.e2e.member', 'diego');
    const user = userEvent.setup();
    render(<PersonaPill />);

    await user.click(screen.getByTestId('persona-pill'));
    expect(screen.getByTestId('persona-menu')).toBeInTheDocument();
    for (const slug of ['sofia', 'priya', 'diego', 'sana', 'tom']) {
      expect(screen.getByTestId(`persona-option-${slug}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('persona-option-diego')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('persona-option-priya')).toHaveAttribute('aria-checked', 'false');
    // Role labels are human-readable (Admin / Manager), shown in the menu.
    expect(screen.getByTestId('persona-option-sofia')).toHaveTextContent('Sofia Romano');
    expect(screen.getByTestId('persona-option-sofia')).toHaveTextContent('Admin');
  });

  it('selecting a DIFFERENT persona persists the hermetic identity and hard-navigates', async () => {
    window.localStorage.setItem('wcm.e2e.member', 'sana');
    const user = userEvent.setup();
    render(<PersonaPill />);

    await user.click(screen.getByTestId('persona-pill'));
    await user.click(screen.getByTestId('persona-option-priya'));

    // Identity persisted to the SAME keys resolveE2eIdentity reads (the ?member= seam contract).
    expect(window.localStorage.getItem('wcm.e2e.member')).toBe('priya');
    expect(window.localStorage.getItem('wcm.e2e.manager')).toBe('true');
    expect(window.localStorage.getItem('wcm.e2e.name')).toBe('Priya Menon');
    // Full reload through the seam URL, carrying the WHOLE identity (member alone would
    // re-resolve manager=false — the URL param is authoritative).
    expect(assign).toHaveBeenCalledTimes(1);
    const url = String(assign.mock.calls[0]?.[0]);
    expect(url).toMatch(/^\/\?member=priya/);
    expect(url).toContain('manager=true');
  });

  it('selecting the CURRENT persona just closes the menu (no navigation)', async () => {
    window.localStorage.setItem('wcm.e2e.member', 'tom');
    const user = userEvent.setup();
    render(<PersonaPill />);

    await user.click(screen.getByTestId('persona-pill'));
    await user.click(screen.getByTestId('persona-option-tom'));

    expect(assign).not.toHaveBeenCalled();
    expect(screen.queryByTestId('persona-menu')).not.toBeInTheDocument();
  });

  it('closes on Escape and on a click outside', async () => {
    window.localStorage.setItem('wcm.e2e.member', 'sana');
    const user = userEvent.setup();
    render(<PersonaPill />);

    await user.click(screen.getByTestId('persona-pill'));
    expect(screen.getByTestId('persona-menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('persona-menu')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('persona-pill'));
    expect(screen.getByTestId('persona-menu')).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByTestId('persona-menu')).not.toBeInTheDocument();
  });

  it('Sign out sets the hermetic signed-out flag and reloads to the login screen', async () => {
    // The CB-2 demo loop: pill -> Sign out -> the standalone login screen (with the bypass).
    window.localStorage.setItem('wcm.e2e.member', 'priya');
    const user = userEvent.setup();
    render(<PersonaPill />);

    await user.click(screen.getByTestId('persona-pill'));
    await user.click(screen.getByTestId('persona-signout'));

    expect(window.localStorage.getItem('wcm.e2e.signedOut')).toBe('true');
    expect(assign).toHaveBeenCalledWith('/');
  });
});
