// apps/wc-remote/src/lib/uuid.test.ts — unit tests for safeRandomUUID: RFC4122 v4 shape and
// uniqueness on the native crypto.randomUUID path, AND the getRandomValues fallback used in
// non-secure contexts (plain-http deploys lack crypto.randomUUID), including the version/variant bits.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeRandomUUID } from './uuid';

/** RFC4122 v4: third group starts with 4, fourth group starts with 8/9/a/b (variant 10xx). */
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('safeRandomUUID', () => {
  it('returns a valid RFC4122 v4 uuid on the native path', () => {
    expect(safeRandomUUID()).toMatch(V4);
  });

  it('returns unique values across calls', () => {
    const seen = new Set(Array.from({ length: 200 }, () => safeRandomUUID()));
    expect(seen.size).toBe(200);
  });

  it('falls back to getRandomValues when crypto.randomUUID is unavailable (http:// contexts)', () => {
    const real = globalThis.crypto;
    // A crypto WITHOUT randomUUID but WITH getRandomValues — what an insecure context provides.
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    expect(globalThis.crypto.randomUUID).toBeUndefined();
    const id = safeRandomUUID();
    expect(id).toMatch(V4);
  });

  it('fallback forces the version/variant bits even on all-0xff entropy', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array): Uint8Array => {
        arr.fill(0xff);
        return arr;
      },
    });
    expect(safeRandomUUID()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });
});
