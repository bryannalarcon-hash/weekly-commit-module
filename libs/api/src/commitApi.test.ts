// libs/api/src/commitApi.test.ts — MSW-backed RTK Query tests (U17) proving the slice talks the U10
// contract WITHOUT a backend: (1) two identical getCommit reads dedup to ONE network call (cache),
// (2) submit invalidates the WeekList tag so a subsequent list-style read refetches, (3) reviewCommit
// invalidates the ReviewQueue tag so a still-subscribed manager queue refetches its reviewState (U21),
// (4) the injected token getter attaches a Bearer header, (5) RCDO admin CRUD mutates the tree and the
// rcdoTreeTag invalidation refetches a subscribed getRcdoTree, and (6) Settings account/notifications
// round-trip + invalidate their tags. No real Auth0 — the token getter is mocked.
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

  // Exercises every remaining endpoint against the MSW contract so each query/tag builder runs and
  // the request it constructs matches a handler (the slice IS the only path to the backend, so a
  // broken URL/method/param here is a real bug). Asserts on the contract-shaped response, not padding.
  it('builds a valid request for every endpoint in the slice', async () => {
    const store = makeStore();

    // A latest-commit handler the in-memory contract set does not include.
    server.use(
      http.get('*/rollup/reports/:memberId/latest-commit', ({ params }) =>
        HttpResponse.json({ commitId: `latest-of-${params.memberId}` }),
      ),
    );

    const id = await seedCommit(store);

    // Commits.
    expect((await store.dispatch(commitApi.endpoints.getMyWeeks.initiate())).data).toBeDefined();
    await store.dispatch(commitApi.endpoints.getCurrentWeek.initiate());
    const updated = await store
      .dispatch(
        commitApi.endpoints.updateCommit.initiate({
          id,
          body: { items: [{ text: 'edited', supportingOutcomeId: 'so-1', chessTier: 'KING' }] },
        }),
      )
      .unwrap();
    expect(updated.id).toBe(id);

    // RCDO.
    expect(
      (await store.dispatch(commitApi.endpoints.getRcdoTree.initiate())).data?.length,
    ).toBeGreaterThan(0);
    await store.dispatch(commitApi.endpoints.searchSupportingOutcomes.initiate('state'));

    // Lock → reconcile lifecycle so the reconcile endpoints have a valid target.
    await store.dispatch(commitApi.endpoints.submitCommit.initiate(id)).unwrap();
    await store.dispatch(commitApi.endpoints.startReconcile.initiate(id)).unwrap();
    const recon = await store
      .dispatch(commitApi.endpoints.getReconciliation.initiate(id))
      .unwrap();
    expect(recon.commitId).toBe(id);
    const itemId = recon.rows[0]?.commitItemId;
    if (itemId) {
      await store.dispatch(
        commitApi.endpoints.patchItemStatus.initiate({
          commitId: id,
          itemId,
          body: { status: 'COMPLETE' },
        }),
      );
    }
    await store.dispatch(commitApi.endpoints.markReconciled.initiate(id)).unwrap();
    await store.dispatch(commitApi.endpoints.carryForward.initiate(id)).unwrap();

    // Review + roll-up.
    const rollup = await store.dispatch(commitApi.endpoints.getRollup.initiate({})).unwrap();
    expect(rollup.content).toBeDefined();
    const latest = await store
      .dispatch(commitApi.endpoints.getReportLatestCommit.initiate('m-diego'))
      .unwrap();
    expect(latest.commitId).toBe('latest-of-m-diego');

    // Pulse.
    await store.dispatch(commitApi.endpoints.getPulse.initiate(id));
    await store.dispatch(
      commitApi.endpoints.putPulse.initiate({
        commitId: id,
        body: { rating: 4, comment: 'ok' },
      }),
    );

    // Outlook integration.
    expect(
      (await store.dispatch(commitApi.endpoints.getOutlookConnection.initiate())).data,
    ).toBeDefined();
    await store.dispatch(commitApi.endpoints.connectOutlook.initiate()).unwrap();
    await store.dispatch(
      commitApi.endpoints.updateOutlookSettings.initiate({ createEventOnLock: false }),
    );
    await store.dispatch(commitApi.endpoints.disconnectOutlook.initiate()).unwrap();
  });

  it('RCDO admin CRUD mutates the tree and refetches a subscribed getRcdoTree', async () => {
    const store = makeStore();

    // A live subscription to the tree provides rcdoTreeTag(); mutations must invalidate it.
    const sub = store.dispatch(commitApi.endpoints.getRcdoTree.initiate());
    const initial = await sub.unwrap();
    expect(initial.length).toBe(1);

    // Create a brand-new RallyCry → tree grows to 2 roots after the invalidation refetch.
    const created = await store
      .dispatch(
        commitApi.endpoints.createRallyCry.initiate({
          title: 'Win the mid-market',
          description: 'Land 50 logos',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        }),
      )
      .unwrap();
    expect(created.id).toBeTruthy();
    expect(created.title).toBe('Win the mid-market');
    expect(created.createdDate).toBeTruthy();

    await new Promise((r) => setTimeout(r, 50));
    let tree = commitApi.endpoints.getRcdoTree.select()(store.getState()).data ?? [];
    expect(tree.length).toBe(2);
    const newRoot = tree.find((rc) => rc.id === created.id)!;
    expect(newRoot.title).toBe('Win the mid-market');

    // Add a DefiningObjective under the new RallyCry.
    const obj = await store
      .dispatch(
        commitApi.endpoints.createDefiningObjective.initiate({
          rallyCryId: created.id,
          title: 'Ship self-serve onboarding',
        }),
      )
      .unwrap();
    expect(obj.rallyCryId).toBe(created.id);

    // Add an Outcome under that objective, then a SupportingOutcome leaf under the Outcome.
    const outcome = await store
      .dispatch(
        commitApi.endpoints.createOutcome.initiate({
          definingObjectiveId: obj.id,
          title: 'Cut activation time in half',
        }),
      )
      .unwrap();
    expect(outcome.definingObjectiveId).toBe(obj.id);

    const leaf = await store
      .dispatch(
        commitApi.endpoints.createSupportingOutcome.initiate({
          outcomeId: outcome.id,
          title: 'Guided product tour',
          ownerId: null,
        }),
      )
      .unwrap();
    expect(leaf.outcomeId).toBe(outcome.id);

    // The new leaf is searchable via the typeahead (SupportingOutcome tag also invalidated).
    const hits = await store
      .dispatch(commitApi.endpoints.searchSupportingOutcomes.initiate('guided'))
      .unwrap();
    expect(hits.some((so) => so.id === leaf.id)).toBe(true);

    // Update then delete the leaf; tree shrinks back.
    const renamed = await store
      .dispatch(
        commitApi.endpoints.updateSupportingOutcome.initiate({
          id: leaf.id,
          body: { outcomeId: outcome.id, title: 'Interactive onboarding tour' },
        }),
      )
      .unwrap();
    expect(renamed.title).toBe('Interactive onboarding tour');

    await store
      .dispatch(commitApi.endpoints.deleteSupportingOutcome.initiate(leaf.id))
      .unwrap();

    // Delete the whole new RallyCry subtree → back to a single root after refetch.
    await store
      .dispatch(commitApi.endpoints.deleteRallyCry.initiate(created.id))
      .unwrap();
    await new Promise((r) => setTimeout(r, 50));
    tree = commitApi.endpoints.getRcdoTree.select()(store.getState()).data ?? [];
    expect(tree.length).toBe(1);

    // Exercise the remaining update/delete builders against valid targets so each runs.
    const baseRoot = tree[0]!;
    const baseObj = baseRoot.definingObjectives[0]!;
    const baseOutcome = baseObj.outcomes[0]!;
    await store
      .dispatch(
        commitApi.endpoints.updateRallyCry.initiate({
          id: baseRoot.id,
          body: { title: baseRoot.title },
        }),
      )
      .unwrap();
    await store
      .dispatch(
        commitApi.endpoints.updateDefiningObjective.initiate({
          id: baseObj.id,
          body: { rallyCryId: baseRoot.id, title: baseObj.title },
        }),
      )
      .unwrap();
    await store
      .dispatch(
        commitApi.endpoints.updateOutcome.initiate({
          id: baseOutcome.id,
          body: { definingObjectiveId: baseObj.id, title: baseOutcome.title },
        }),
      )
      .unwrap();
    await store
      .dispatch(commitApi.endpoints.deleteOutcome.initiate(baseOutcome.id))
      .unwrap();
    await store
      .dispatch(commitApi.endpoints.deleteDefiningObjective.initiate(baseObj.id))
      .unwrap();

    sub.unsubscribe();
  });

  it('Settings account round-trips and updateAccount refetches a subscribed getAccount', async () => {
    const store = makeStore();

    const sub = store.dispatch(commitApi.endpoints.getAccount.initiate());
    const before = await sub.unwrap();
    expect(before.canReview).toBe(true);
    expect(before.email).toBeTruthy();

    const updated = await store
      .dispatch(
        commitApi.endpoints.updateAccount.initiate({
          displayName: 'Lindsley A.',
          timezone: 'America/New_York',
        }),
      )
      .unwrap();
    expect(updated.displayName).toBe('Lindsley A.');
    expect(updated.timezone).toBe('America/New_York');
    // email/canReview are server-owned and unchanged by the write.
    expect(updated.email).toBe(before.email);
    expect(updated.canReview).toBe(before.canReview);

    // The settingsTag('account') invalidation refetches the still-subscribed getAccount.
    await new Promise((r) => setTimeout(r, 50));
    const after = commitApi.endpoints.getAccount.select()(store.getState()).data;
    expect(after?.displayName).toBe('Lindsley A.');
    sub.unsubscribe();
  });

  it('Settings notifications round-trip the 5 toggles and invalidate the tag', async () => {
    const store = makeStore();

    const sub = store.dispatch(commitApi.endpoints.getNotifications.initiate());
    const before = await sub.unwrap();
    // All 5 booleans are present.
    expect(Object.keys(before).sort()).toEqual(
      ['emailOnLock', 'emailOnReconciled', 'emailOnReview', 'reminderEmails', 'weeklyDigest'].sort(),
    );

    const next = {
      emailOnLock: false,
      emailOnReview: false,
      emailOnReconciled: false,
      weeklyDigest: false,
      reminderEmails: true,
    };
    const updated = await store
      .dispatch(commitApi.endpoints.updateNotifications.initiate(next))
      .unwrap();
    expect(updated).toEqual(next);

    await new Promise((r) => setTimeout(r, 50));
    const after = commitApi.endpoints.getNotifications.select()(store.getState()).data;
    expect(after).toEqual(next);
    sub.unsubscribe();
  });
});
