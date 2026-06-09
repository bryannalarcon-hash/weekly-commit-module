// libs/api/src/tokenProvider.ts — the injectable access-token seam for commitApi (U17). The RTK Query
// baseQuery's prepareHeaders pulls the Bearer token from whatever getToken the app registers here:
// the host-injected getToken when embedded, or the remote's own Auth0 getter when standalone. Tests
// register a mock token getter (NEVER calling real Auth0). Default returns null → no Authorization header.
//
// HERMETIC E2E (KTD13): when the host runs with VITE_E2E it registers a DEBUG MEMBER instead of a
// token; prepareHeaders then sends `X-Debug-Member: <member>` (no Bearer) so a real browser drives the
// federated app against the backend's @Profile("e2e") header authenticator with NO Auth0 tenant. This
// is a test-only path; prod/standalone keep the Bearer-token getter.
export type TokenGetter = () => Promise<string | null>;

let current: TokenGetter = async () => null;

/** The hermetic-E2E debug member (email/slug) sent as X-Debug-Member, or null in prod/standalone. */
let debugMember: string | null = null;

/** Register the active token getter (host bridge, self-Auth0, or a test mock). */
export function setTokenGetter(getter: TokenGetter): void {
  current = getter;
}

/** Reset to the empty-safe default (used between tests and when unmounting). */
export function clearTokenGetter(): void {
  current = async () => null;
}

/** Resolve the current Bearer token (or null). Empty-safe: never throws on a missing provider. */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await current();
  } catch {
    return null;
  }
}

/** Set (or clear, with null) the hermetic-E2E debug member sent as the X-Debug-Member header. */
export function setDebugMember(member: string | null): void {
  debugMember = member && member.trim() ? member.trim() : null;
}

/** The active hermetic-E2E debug member, or null when not in the E2E auth mode. */
export function getDebugMember(): string | null {
  return debugMember;
}
