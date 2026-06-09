// apps/wc-remote/src/app/e2eAuth.ts — the HERMETIC E2E auth source (KTD13), active ONLY when the
// remote is built with VITE_E2E=true. It reads the acting debug member (and whether they are a
// manager) from localStorage / a URL query param so Cypress can switch identities by setting them
// before a visit. The member string (email like "lena@solovis.test" or a slug like "lena") is sent
// as the X-Debug-Member header by @wcm/api's prepareHeaders. This is a test-only path; under a normal
// build VITE_E2E is unset and none of this runs (the real Auth0 / host getToken path is used).

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
