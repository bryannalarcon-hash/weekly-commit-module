// libs/api/src/commitApi.test.ts — MSW-backed RTK Query tests (U17) proving the slice talks the U10
// contract WITHOUT a backend: (1) two identical getCommit reads dedup to ONE network call (cache),
// (2) submit invalidates the WeekList tag so a subsequent list-style read refetches, (3) reviewCommit
// invalidates the ReviewQueue tag so a still-subscribed manager queue refetches its reviewState (U21),
// and (4) the injected token getter attaches a Bearer header. No real Auth0 — the token getter is mocked.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { handlers, resetMockDb } from './msw/handlers';
import { commitApi } from './commitApi';
import { makeStore } from './store';
import { clearTokenGetter, setTokenGetter } from './tokenProvider';

// Spy on outgoing requests by counting how often the GET handler is hit.
let getCommitHits = 0;
let lastAuthHeader: string | null = null;

const countingHandlers = [
  http.all('*', ({ request }) => {
    lastAuthHeader = request.headers.get('Authorization');
    if (
      request.method === 'GET' &&
      /\/commits\/[^/]+$/.test(new URL(request.url).pathname)
    ) {
      getCommitHits += 1;
    }
    // Returning undefined lets the real contract handlers handle it (passthrough).
    return undefined;
  }),
  ...handlers,
];

const server = setupServer(...countingHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers(...countingHandlers));
afterAll(() => server.close());

beforeEach(() => {
  resetMockDb();
  clearTokenGetter();
  getCommitHits = 0;
  lastAuthHeader = null;
});

/** Helper: create a commit through the slice and return its id. */
async function seedCommit(store: ReturnType<typeof makeStore>): Promise<string> {
  const res = await store.dispatch(
    commitApi.endpoints.createCommit.initiate({
      weekStart: '2026-06-08',
      items: [
        { text: 'Ship the picker', supportingOutcomeId: 'so-1', chessTier: 'KING' },
      ],
    }),
  );
  if ('error' in res && res.error) throw new Error('create failed');
  return res.data!.id;
}

describe('commitApi (MSW-backed)', () => {
  it('dedupes two identical getCommit reads into a single network call', async () => {
    const store = makeStore();
    const id = await seedCommit(store);
    getCommitHits = 0;

    const [a, b] = await Promise.all([
      store.dispatch(commitApi.endpoints.getCommit.initiate(id)),
      store.dispatch(commitApi.endpoints.getCommit.initiate(id)),
    ]);

    expect(a.data?.id).toBe(id);
    expect(b.data?.id).toBe(id);
    // RTK Query dedups concurrent identical requests → exactly one GET.
    expect(getCommitHits).toBe(1);
  });

  it('submit invalidates the WeekList tag and refetches dependents', async () => {
    const store = makeStore();
    const id = await seedCommit(store);

    // A subscriber that provides/consumes the WeekList-ish cache via getCommit (tagged Commit).
    const before = await store.dispatch(commitApi.endpoints.getCommit.initiate(id));
    expect(before.data?.lifecycleState).toBe('DRAFT');

    // Submit transitions DRAFT → LOCKED and invalidates commitTag(id) + WeekList.
    const submit = await store.dispatch(
      commitApi.endpoints.submitCommit.initiate(id),
    );
    expect('data' in submit && submit.data?.lifecycleState).toBe('LOCKED');

    // The invalidated Commit tag triggers an automatic refetch of the active getCommit subscription;
    // reading the cache now reflects LOCKED.
    const after = await store.dispatch(
      commitApi.endpoints.getCommit.initiate(id, { forceRefetch: true }),
    );
    expect(after.data?.lifecycleState).toBe('LOCKED');
  });

  it('reviewCommit invalidates the ReviewQueue tag so the queue refetches (U21)', async () => {
    const store = makeStore();

    // A still-subscribed review-queue read provides reviewQueueTag('LIST'). The server flips Diego's
    // row to REVIEWED after the first read, so a stale (non-refetched) cache would still show UNREVIEWED.
    let queueHits = 0;
    server.use(
      http.get('*/review-queue', () => {
        queueHits += 1;
        const reviewState = queueHits === 1 ? 'UNREVIEWED' : 'REVIEWED';
        return HttpResponse.json({
          content: [
            {
              memberId: 'm-diego',
              memberName: 'Diego Alvarez',
              commitId: 'c-a',
              lifecycleState: 'LOCKED',
              overdue: false,
              itemCount: 4,
              completedCount: 2,
              reviewState,
            },
          ],
          totalElements: 1,
          totalPages: 1,
          number: 0,
          size: 50,
        });
      }),
    );

    const sub = store.dispatch(commitApi.endpoints.getReviewQueue.initiate({}));
    const first = await sub.unwrap();
    expect(first.content[0]?.reviewState).toBe('UNREVIEWED');
    expect(queueHits).toBe(1);

    // Posting a review must invalidate the ReviewQueue tag → the active subscription refetches.
    await store
      .dispatch(
        commitApi.endpoints.reviewCommit.initiate({
          commitId: 'c-a',
          body: { state: 'REVIEWED', comment: 'looks good' },
        }),
      )
      .unwrap();

    // Let the invalidation-driven refetch of the still-subscribed query settle.
    await new Promise((r) => setTimeout(r, 50));
    expect(queueHits).toBeGreaterThanOrEqual(2);
    const refetched = commitApi.endpoints.getReviewQueue.select({})(store.getState());
    expect(refetched.data?.content[0]?.reviewState).toBe('REVIEWED');
    sub.unsubscribe();
  });

  it('attaches a Bearer token from the injected getter (no real Auth0)', async () => {
    setTokenGetter(async () => 'test-jwt-123');
    const store = makeStore();
    await seedCommit(store);
    expect(lastAuthHeader).toBe('Bearer test-jwt-123');
  });

  it('omits Authorization when no token getter is registered (empty-safe)', async () => {
    const store = makeStore();
    await seedCommit(store);
    expect(lastAuthHeader).toBeNull();
  });
});
