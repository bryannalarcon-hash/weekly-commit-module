// apps/wc-remote/src/app/e2eAuth.ts — the HERMETIC E2E auth source (KTD13), active ONLY when the
// remote is built with VITE_E2E=true. It reads the acting debug member (and whether they are a
// manager) from localStorage / a URL query param so Cypress can switch identities by setting them
// before a visit. The member string (email like "lena@solovis.test" or a slug like "lena") is sent
// as the X-Debug-Member header by @wcm/api's prepareHeaders. This is a test-only path; under a normal
// build VITE_E2E is unset and none of this runs (the real Auth0 / host getToken path is used).
// CB-2 productizes this seam into demo-only UI: DEMO_PERSONAS (the seeded demo team), and
// persistE2eIdentity (writes the SAME localStorage keys resolveE2eIdentity reads) power the login
// bypass (guards.tsx) and the account-switcher pill (PersonaPill.tsx) — still gated on isE2e().

/** True only in an E2E build (VITE_E2E=true). Guards every hermetic auth branch. */
export function isE2e(): boolean {
  return (
    typeof import.meta !== 'undefined' &&
    String((import.meta as { env?: Record<string, string> }).env?.VITE_E2E) === 'true'
  );
}

/** localStorage keys + URL params Cypress uses to pick the acting member for a scenario. */
const MEMBER_KEY = 'wcm.e2e.member';
const MANAGER_KEY = 'wcm.e2e.manager';
const NAME_KEY = 'wcm.e2e.name';
/** Hermetic signed-out flag: when set, AuthBridge's e2e branch reports unauthenticated so the
 *  standalone login screen (and its demo bypass) actually renders. Any sign-in path clears it. */
const SIGNED_OUT_KEY = 'wcm.e2e.signedOut';

/** Is the hermetic demo explicitly signed out? (drives the login screen in an E2E build) */
export function isE2eSignedOut(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.localStorage.getItem(SIGNED_OUT_KEY) === 'true'
  );
}

/** Set/clear the hermetic signed-out flag (pill/Settings sign-out sets it; sign-in clears it). */
export function setE2eSignedOut(out: boolean): void {
  if (typeof window === 'undefined') return;
  if (out) window.localStorage.setItem(SIGNED_OUT_KEY, 'true');
  else window.localStorage.removeItem(SIGNED_OUT_KEY);
}

export interface E2eIdentity {
  /** The X-Debug-Member value (email/slug of a seeded member). */
  member: string;
  /** Whether the acting member is a manager (drives the manager sub-nav / route gates). */
  isManager: boolean;
  /** Display name for the header chrome. */
  name: string;
}

/**
 * Resolve the current E2E identity from a URL query (?member=&manager=&name=) — which, when present,
 * is persisted to localStorage so it survives client-side navigation — else from localStorage. A
 * URL param wins so a Cypress `cy.visit('/?member=lena@solovis.test')` is authoritative. Defaults to
 * a known employee so the app is never stuck unauthenticated in an E2E build.
 */
export function resolveE2eIdentity(): E2eIdentity {
  let member = '';
  let manager = false;
  let name = '';
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const qpMember = params.get('member');
    if (qpMember) {
      member = qpMember;
      manager = params.get('manager') === 'true';
      name = params.get('name') ?? '';
      window.localStorage.setItem(MEMBER_KEY, member);
      window.localStorage.setItem(MANAGER_KEY, String(manager));
      if (name) window.localStorage.setItem(NAME_KEY, name);
      // An explicit ?member= is a sign-in intent (Cypress visitAs, the demo bypass, the persona
      // pill) — clear any hermetic signed-out flag so the app authenticates as that member.
      window.localStorage.removeItem(SIGNED_OUT_KEY);
    } else {
      member = window.localStorage.getItem(MEMBER_KEY) ?? '';
      manager = window.localStorage.getItem(MANAGER_KEY) === 'true';
      name = window.localStorage.getItem(NAME_KEY) ?? '';
    }
  }
  if (!member) {
    member = 'sana@solovis.test'; // a seeded employee with no current commit (clean "Start your week")
  }
  return { member, isManager: manager, name: name || member };
}

/**
 * Persist a hermetic identity to the SAME localStorage keys resolveE2eIdentity reads — i.e. exactly
 * what visiting `?member=&manager=&name=` does. Used by the demo login bypass + persona pill (CB-2);
 * callers then window.location.assign(...) so identity re-resolves cleanly on a fresh load.
 */
export function persistE2eIdentity(id: E2eIdentity): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MEMBER_KEY, id.member);
  window.localStorage.setItem(MANAGER_KEY, String(id.isManager));
  window.localStorage.setItem(NAME_KEY, id.name);
}

/** A seeded demo-team persona the demo bypass / switcher pill can act as (CB-2). */
export interface DemoPersona {
  /** Debug-member slug (DemoSeeder slug; also valid as the `?member=` value). */
  slug: string;
  /** Display name, e.g. "Priya Menon". */
  name: string;
  /** Human role label shown next to the name (Admin / Manager); employees have none. */
  role?: string;
  /** Whether this persona sees the manager surfaces (drives MANAGER_KEY). */
  isManager: boolean;
  /** OKLCH hue for the persona's avatar tint (stable role color, not name-hashed). */
  hue: number;
}

/**
 * The static demo-team persona list (matches the backend DemoSeeder's Data Ops team + admin):
 * Sofia (admin/CPO), Priya (Data Ops manager), and her reports Diego, Sana, Tom.
 */
export const DEMO_PERSONAS: readonly DemoPersona[] = [
  { slug: 'sofia', name: 'Sofia Romano', role: 'Admin', isManager: true, hue: 285 },
  { slug: 'priya', name: 'Priya Menon', role: 'Manager', isManager: true, hue: 215 },
  { slug: 'diego', name: 'Diego Alvarez', isManager: false, hue: 150 },
  { slug: 'sana', name: 'Sana Khan', isManager: false, hue: 45 },
  { slug: 'tom', name: 'Tom Becker', isManager: false, hue: 345 },
];

/** Convert a persona to the E2eIdentity persistE2eIdentity/resolveE2eIdentity speak. */
export function identityOf(p: DemoPersona): E2eIdentity {
  return { member: p.slug, isManager: p.isManager, name: p.name };
}

/**
 * Find the demo persona a resolved member string refers to (slug "sana" or seeded email
 * "sana@solovis.test"), or undefined for non-demo members (e.g. other seeded teams).
 */
export function personaForMember(member: string): DemoPersona | undefined {
  return DEMO_PERSONAS.find((p) => member === p.slug || member.startsWith(`${p.slug}@`));
}
