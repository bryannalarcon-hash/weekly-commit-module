// libs/api/src/tags.ts — the RTK Query cache-tag vocabulary for commitApi (U17). Centralizing the
// tagTypes + id helpers keeps the providesTags/invalidatesTags graph consistent: a submit invalidates
// the week list; reconcile/review invalidate the specific commit + its reconciliation view.
export const TAG_TYPES = [
  'Commit',
  'WeekList',
  'Reconciliation',
  'RcdoTree',
  'SupportingOutcome',
  'Review',
  'Rollup',
  'ReviewQueue',
  'Pulse',
  'Outlook',
] as const;

export type WcmTag = (typeof TAG_TYPES)[number];

/** A single commit, tagged by id (LIST sentinel for collection-level invalidation). */
export const commitTag = (id: string | 'LIST') =>
  ({ type: 'Commit', id }) as const;

/** The authored-weeks list (My Week / History). */
export const weekListTag = () => ({ type: 'WeekList', id: 'LIST' }) as const;

/** A commit's planned-vs-actual reconciliation view, by commit id. */
export const reconciliationTag = (commitId: string) =>
  ({ type: 'Reconciliation', id: commitId }) as const;

/** The manager team roll-up page set. */
export const rollupTag = () => ({ type: 'Rollup', id: 'LIST' }) as const;

/** A manager review keyed by the commit it belongs to. */
export const reviewTag = (commitId: string) =>
  ({ type: 'Review', id: commitId }) as const;

/** The manager's review queue for a given week (keyed by week-start; LIST for the whole set). */
export const reviewQueueTag = (weekStart: string | 'LIST' = 'LIST') =>
  ({ type: 'ReviewQueue', id: weekStart }) as const;

/** A commit's Pulse reading, by commit id. */
export const pulseTag = (commitId: string) =>
  ({ type: 'Pulse', id: commitId }) as const;

/** The acting member's Outlook connection state (single-row). */
export const outlookTag = () => ({ type: 'Outlook', id: 'SELF' }) as const;
