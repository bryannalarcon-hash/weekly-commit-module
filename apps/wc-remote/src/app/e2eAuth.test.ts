// apps/wc-remote/src/app/e2eAuth.test.ts — unit tests for the hermetic E2E identity resolver. Proves
// the URL-query path wins and persists to localStorage, the localStorage fallback is read when no
// query is present, and the seeded-employee default applies when neither source names a member. The
// VITE_E2E build flag itself is environment-driven; here we test the pure resolver logic that runs
// inside that build.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveE2eIdentity } from './e2eAuth';

function setUrl(search: string): void {
  window.history.replaceState({}, '', `/${search}`);
}

describe('resolveE2eIdentity', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setUrl('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setUrl('');
  });

  it('reads the member/manager/name from the URL query and persists them to localStorage', () => {
    setUrl('?member=lena@solovis.test&manager=true&name=Lena');
    const id = resolveE2eIdentity();
    expect(id).toEqual({ member: 'lena@solovis.test', isManager: true, name: 'Lena' });
    // Persisted so client-side navigation (which drops the query) keeps the identity.
    expect(window.localStorage.getItem('wcm.e2e.member')).toBe('lena@solovis.test');
    expect(window.localStorage.getItem('wcm.e2e.manager')).toBe('true');
    expect(window.localStorage.getItem('wcm.e2e.name')).toBe('Lena');
  });

  it('falls back to localStorage when no URL query is present', () => {
    window.localStorage.setItem('wcm.e2e.member', 'mira@solovis.test');
    window.localStorage.setItem('wcm.e2e.manager', 'true');
    // No name stored → name defaults to the member.
    const id = resolveE2eIdentity();
    expect(id.member).toBe('mira@solovis.test');
    expect(id.isManager).toBe(true);
    expect(id.name).toBe('mira@solovis.test');
  });

  it('defaults to a seeded employee when neither source names a member', () => {
    const id = resolveE2eIdentity();
    expect(id.member).toBe('sana@solovis.test');
    expect(id.isManager).toBe(false);
    expect(id.name).toBe('sana@solovis.test');
  });
});
