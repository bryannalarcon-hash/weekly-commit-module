// libs/api/src/tokenProvider.ts — the injectable access-token seam for commitApi (U17). The RTK Query
// baseQuery's prepareHeaders pulls the Bearer token from whatever getToken the app registers here:
// the host-injected getToken when embedded, or the remote's own Auth0 getter when standalone. Tests
// register a mock token getter (NEVER calling real Auth0). Default returns null → no Authorization header.
export type TokenGetter = () => Promise<string | null>;

let current: TokenGetter = async () => null;

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
