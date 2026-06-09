// libs/api/src/tags.ts — the RTK Query cache-tag vocabulary for commitApi (U17). Centralizing the
// tagTypes + id helpers keeps the providesTags/invalidatesTags graph consistent: a submit invalidates
// the week list; reconcile/review invalidate the specific commit + its reconciliation view; RCDO admin
// mutations invalidate the whole RcdoTree; Settings reads/writes share the Settings account/notifications tags.
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
  'Settings',
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

/** The whole RCDO tree (browse + picker); admin CRUD on any node invalidates this single tag. */
export const rcdoTreeTag = () => ({ type: 'RcdoTree', id: 'TREE' }) as const;

/**
 * A Settings sub-resource for the acting member: 'account' (profile/timezone) or 'notifications'
 * (the 5 email toggles). Separate ids so an account write does not refetch notifications and vice versa.
 */
export const settingsTag = (which: 'account' | 'notifications') =>
  ({ type: 'Settings', id: which }) as const;
