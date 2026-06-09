// libs/api/src/commitApi.ts — the RTK Query data layer for the WCM (U17): the ONLY way app code talks
// to the backend (no fetch/axios). Covers every endpoint in libs/types/contract.ts — commits, RCDO
// (browse + admin CRUD on rally-cries/objectives/outcomes/supporting-outcomes), reconciliation, review
// + roll-up, the My-Week/History week list, weekly Pulse, the manager review queue, the Outlook (Graph)
// connection, and Settings (account profile + the 5 notification toggles) — injects a Bearer token via
// the injectable tokenProvider, and wires the providesTags/invalidatesTags graph (RCDO mutations bust
// the tree tag; Settings reads/writes share per-resource tags). Generated React hooks feed the screens.
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  CommitDto,
  CreateCommitRequest,
  DefiningObjectiveRequest,
  DefiningObjectiveResponse,
  ItemStatusPatch,
  MemberAccountDto,
  NotificationPreferenceDto,
  OutcomeRequest,
  OutcomeResponse,
  OutlookConnectionDto,
  OutlookConnectResponse,
  OutlookSettingsRequest,
  Page,
  PulseDto,
  PulseRequest,
  RallyCryNode,
  RallyCryRequest,
  RallyCryResponse,
  ReconciliationView,
  ReviewDto,
  ReviewQueueRow,
  ReviewRequest,
  RollupRow,
  SupportingOutcomeDto,
  SupportingOutcomeRequest,
  SupportingOutcomeResponse,
  UpdateCommitRequest,
  UpdateMemberAccountDto,
  UpdateNotificationPreferenceDto,
  WeekSummary,
} from '@wcm/types';
import {
  TAG_TYPES,
  commitTag,
  outlookTag,
  pulseTag,
  rcdoTreeTag,
  reconciliationTag,
  reviewQueueTag,
  reviewTag,
  rollupTag,
  settingsTag,
  weekListTag,
} from './tags';
import { getAccessToken, getDebugMember } from './tokenProvider';

/**
 * Resolve the API base. Defaults to `/api` (same-origin as the host), overridable at build via
 * VITE_API_BASE. Relative bases are absolutized against the document origin so node's fetch (undici)
 * — used under jsdom in tests — can build a valid Request; the browser would resolve it implicitly.
 */
function resolveApiBase(): string {
  const configured =
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE) ||
    '/api';
  if (/^https?:\/\//.test(configured)) return configured;
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  return origin ? `${origin}${configured.startsWith('/') ? '' : '/'}${configured}` : configured;
}

const API_BASE: string = resolveApiBase();

/**
 * fetchBaseQuery with a prepareHeaders that injects auth. In the normal/prod/standalone path it sets
 * `Authorization: Bearer <token>` from the injected token getter (empty-safe: omitted when no token,
 * so the slice builds and tests run WITHOUT live Auth0). In the HERMETIC E2E path (KTD13) a debug
 * member is registered (setDebugMember); then it sends `X-Debug-Member: <member>` and NO Bearer, so a
 * real browser drives the federated app against the backend's @Profile("e2e") header authenticator.
 */
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  prepareHeaders: async (headers) => {
    const debugMember = getDebugMember();
    if (debugMember) {
      headers.set('X-Debug-Member', debugMember);
      return headers;
    }
    const token = await getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const commitApi = createApi({
  reducerPath: 'commitApi',
  baseQuery,
  tagTypes: TAG_TYPES,
  endpoints: (build) => ({
    // --- Commits (U11) -------------------------------------------------------------------------
    getCommit: build.query<CommitDto, string>({
      query: (id) => `/commits/${id}`,
      providesTags: (_res, _err, id) => [commitTag(id)],
    }),

    /** The acting member's authored weeks, newest first (My Week landing + History list). */
    getMyWeeks: build.query<WeekSummary[], void>({
      query: () => '/commits',
      providesTags: (res) => [
        weekListTag(),
        ...(res ?? []).map((w) => commitTag(w.commitId)),
      ],
    }),

    /**
     * The current (most recent open) week for the acting member, or null when none exists yet.
     * 204 → undefined body, surfaced as `null` so the "Start your week" empty state can render.
     */
    getCurrentWeek: build.query<CommitDto | null, void>({
      query: () => '/commits/current',
      transformResponse: (res: CommitDto | null) => res ?? null,
      providesTags: (res) =>
        res ? [commitTag(res.id), weekListTag()] : [weekListTag()],
    }),

    createCommit: build.mutation<CommitDto, CreateCommitRequest>({
      query: (body) => ({ url: '/commits', method: 'POST', body }),
      // A new commit appears in the authored-weeks list.
      invalidatesTags: [weekListTag(), commitTag('LIST')],
    }),

    updateCommit: build.mutation<
      CommitDto,
      { id: string; body: UpdateCommitRequest }
    >({
      query: ({ id, body }) => ({ url: `/commits/${id}`, method: 'PUT', body }),
      invalidatesTags: (_res, _err, { id }) => [commitTag(id)],
    }),

    submitCommit: build.mutation<CommitDto, string>({
      query: (id) => ({ url: `/commits/${id}/submit`, method: 'POST' }),
      // Locking changes the week's state → refetch the week list AND this commit.
      invalidatesTags: (_res, _err, id) => [commitTag(id), weekListTag()],
    }),

    // --- Reconciliation (U13) ------------------------------------------------------------------
    startReconcile: build.mutation<CommitDto, string>({
      query: (id) => ({ url: `/commits/${id}/reconcile`, method: 'POST' }),
      invalidatesTags: (_res, _err, id) => [
        commitTag(id),
        reconciliationTag(id),
        weekListTag(),
      ],
    }),

    patchItemStatus: build.mutation<
      CommitDto,
      { commitId: string; itemId: string; body: ItemStatusPatch }
    >({
      query: ({ commitId, itemId, body }) => ({
        url: `/commits/${commitId}/items/${itemId}/status`,
        method: 'PATCH',
        body,
      }),
      // A status edit changes both the commit and its planned-vs-actual diff.
      invalidatesTags: (_res, _err, { commitId }) => [
        commitTag(commitId),
        reconciliationTag(commitId),
      ],
    }),

    markReconciled: build.mutation<CommitDto, string>({
      query: (id) => ({ url: `/commits/${id}/reconciled`, method: 'POST' }),
      invalidatesTags: (_res, _err, id) => [
        commitTag(id),
        reconciliationTag(id),
        weekListTag(),
      ],
    }),

    getReconciliation: build.query<ReconciliationView, string>({
      query: (id) => `/commits/${id}/reconciliation`,
      providesTags: (_res, _err, id) => [reconciliationTag(id)],
    }),

    carryForward: build.mutation<CommitDto, string>({
      query: (id) => ({ url: `/commits/${id}/carry-forward`, method: 'POST' }),
      // Produces a NEW draft week and closes the old one → refresh the list + both commits.
      invalidatesTags: (_res, _err, id) => [
        commitTag(id),
        commitTag('LIST'),
        weekListTag(),
      ],
    }),

    // --- RCDO (U12) ----------------------------------------------------------------------------
    getRcdoTree: build.query<RallyCryNode[], void>({
      query: () => '/rcdo/tree',
      // Structured tag (id 'TREE') so the admin CRUD below can invalidate exactly this read.
      providesTags: [rcdoTreeTag()],
    }),

    searchSupportingOutcomes: build.query<SupportingOutcomeDto[], string>({
      query: (q) => ({ url: '/rcdo/supporting-outcomes', params: { q } }),
      providesTags: ['SupportingOutcome'],
    }),

    // --- RCDO admin CRUD (admin only; U12 strategy admin) ---------------------------------------
    // Each create/update/delete on ANY node mutates the shape of GET /rcdo/tree, so every mutation
    // invalidates the single rcdoTreeTag() — the picker/browse view refetches the whole tree.

    /** Create a top-level RallyCry. */
    createRallyCry: build.mutation<RallyCryResponse, RallyCryRequest>({
      query: (body) => ({ url: '/admin/rcdo/rally-cries', method: 'POST', body }),
      invalidatesTags: [rcdoTreeTag()],
    }),
    /** Update a RallyCry's title/description/window/owner. */
    updateRallyCry: build.mutation<
      RallyCryResponse,
      { id: string; body: RallyCryRequest }
    >({
      query: ({ id, body }) => ({ url: `/admin/rcdo/rally-cries/${id}`, method: 'PUT', body }),
      invalidatesTags: [rcdoTreeTag()],
    }),
    /** Delete a RallyCry and its entire subtree. */
    deleteRallyCry: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/rcdo/rally-cries/${id}`, method: 'DELETE' }),
      invalidatesTags: [rcdoTreeTag()],
    }),

    /** Create a DefiningObjective under a RallyCry (rallyCryId in the body). */
    createDefiningObjective: build.mutation<
      DefiningObjectiveResponse,
      DefiningObjectiveRequest
    >({
      query: (body) => ({ url: '/admin/rcdo/defining-objectives', method: 'POST', body }),
      invalidatesTags: [rcdoTreeTag()],
    }),
    /** Update a DefiningObjective's title/description/window/owner. */
    updateDefiningObjective: build.mutation<
      DefiningObjectiveResponse,
      { id: string; body: DefiningObjectiveRequest }
    >({
      query: ({ id, body }) => ({
        url: `/admin/rcdo/defining-objectives/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: [rcdoTreeTag()],
    }),
    /** Delete a DefiningObjective and its subtree. */
    deleteDefiningObjective: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/rcdo/defining-objectives/${id}`, method: 'DELETE' }),
      invalidatesTags: [rcdoTreeTag()],
    }),

    /** Create an Outcome under a DefiningObjective (definingObjectiveId in the body). */
    createOutcome: build.mutation<OutcomeResponse, OutcomeRequest>({
      query: (body) => ({ url: '/admin/rcdo/outcomes', method: 'POST', body }),
      invalidatesTags: [rcdoTreeTag()],
    }),
    /** Update an Outcome's title/description/window/owner. */
    updateOutcome: build.mutation<
      OutcomeResponse,
      { id: string; body: OutcomeRequest }
    >({
      query: ({ id, body }) => ({ url: `/admin/rcdo/outcomes/${id}`, method: 'PUT', body }),
      invalidatesTags: [rcdoTreeTag()],
    }),
    /** Delete an Outcome and its subtree. */
    deleteOutcome: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/rcdo/outcomes/${id}`, method: 'DELETE' }),
      invalidatesTags: [rcdoTreeTag()],
    }),

    /** Create a SupportingOutcome under an Outcome (outcomeId in the body). */
    createSupportingOutcome: build.mutation<
      SupportingOutcomeResponse,
      SupportingOutcomeRequest
    >({
      query: (body) => ({ url: '/admin/rcdo/supporting-outcomes', method: 'POST', body }),
      // A new leaf shows up in both the tree and the typeahead search results.
      invalidatesTags: [rcdoTreeTag(), 'SupportingOutcome'],
    }),
    /** Update a SupportingOutcome's title/description/window/owner. */
    updateSupportingOutcome: build.mutation<
      SupportingOutcomeResponse,
      { id: string; body: SupportingOutcomeRequest }
    >({
      query: ({ id, body }) => ({
        url: `/admin/rcdo/supporting-outcomes/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: [rcdoTreeTag(), 'SupportingOutcome'],
    }),
    /** Delete a SupportingOutcome; 409 if a commit item links it. */
    deleteSupportingOutcome: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/rcdo/supporting-outcomes/${id}`, method: 'DELETE' }),
      invalidatesTags: [rcdoTreeTag(), 'SupportingOutcome'],
    }),

    // --- Review + roll-up (U14) ----------------------------------------------------------------
    reviewCommit: build.mutation<
      ReviewDto,
      { commitId: string; body: ReviewRequest }
    >({
      query: ({ commitId, body }) => ({
        url: `/commits/${commitId}/review`,
        method: 'POST',
        body,
      }),
      // A review updates that commit's review, the roll-up's unreviewed counts, AND the manager
      // review queue (the still-subscribed list/'Needs review' filter must refetch its reviewState).
      invalidatesTags: (_res, _err, { commitId }) => [
        reviewTag(commitId),
        commitTag(commitId),
        rollupTag(),
        reviewQueueTag('LIST'),
      ],
    }),

    getRollup: build.query<
      Page<RollupRow>,
      { page?: number; size?: number } | void
    >({
      query: (args) => ({
        url: '/rollup',
        params: { page: args?.page ?? 0, size: args?.size ?? 50 },
      }),
      providesTags: [rollupTag()],
    }),

    /**
     * Resolve a report's latest reviewable commit id, for the dashboard drill-through → review.
     * Returns { commitId }; manager-gated + row-level authorized server-side.
     */
    getReportLatestCommit: build.query<{ commitId: string }, string>({
      query: (memberId) => `/rollup/reports/${memberId}/latest-commit`,
    }),

    /** The manager's review queue for a week: each report's submission status. */
    getReviewQueue: build.query<
      Page<ReviewQueueRow>,
      { weekStart?: string; page?: number; size?: number } | void
    >({
      query: (args) => ({
        url: '/review-queue',
        params: {
          ...(args?.weekStart ? { weekStart: args.weekStart } : {}),
          page: args?.page ?? 0,
          size: args?.size ?? 50,
        },
      }),
      providesTags: (_res, _err, args) => [
        reviewQueueTag(args?.weekStart ?? 'LIST'),
        reviewQueueTag('LIST'),
      ],
    }),

    // --- Pulse (U19 thin Pulse) ----------------------------------------------------------------
    getPulse: build.query<PulseDto, string>({
      query: (commitId) => `/commits/${commitId}/pulse`,
      providesTags: (_res, _err, commitId) => [pulseTag(commitId)],
    }),

    putPulse: build.mutation<PulseDto, { commitId: string; body: PulseRequest }>({
      query: ({ commitId, body }) => ({
        url: `/commits/${commitId}/pulse`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_res, _err, { commitId }) => [pulseTag(commitId)],
    }),

    // --- Outlook integration (U22) -------------------------------------------------------------
    getOutlookConnection: build.query<OutlookConnectionDto, void>({
      query: () => '/integration/outlook',
      providesTags: [outlookTag()],
    }),

    /** Begin the delegated Graph consent flow; returns the URL the screen redirects to. */
    connectOutlook: build.mutation<OutlookConnectResponse, void>({
      query: () => ({ url: '/integration/outlook/connect', method: 'POST' }),
    }),

    disconnectOutlook: build.mutation<OutlookConnectionDto, void>({
      query: () => ({ url: '/integration/outlook', method: 'DELETE' }),
      invalidatesTags: [outlookTag()],
    }),

    updateOutlookSettings: build.mutation<OutlookConnectionDto, OutlookSettingsRequest>({
      query: (body) => ({
        url: '/integration/outlook/settings',
        method: 'PUT',
        body,
      }),
      invalidatesTags: [outlookTag()],
    }),

    // --- Settings (Settings screen: Account + Notifications) ------------------------------------
    /** The acting member's account profile (email/displayName/timezone) + read-only canReview. */
    getAccount: build.query<MemberAccountDto, void>({
      query: () => '/settings/account',
      providesTags: [settingsTag('account')],
    }),

    /** Update displayName + (validated) timezone; canReview/email/id are server-owned. */
    updateAccount: build.mutation<MemberAccountDto, UpdateMemberAccountDto>({
      query: (body) => ({ url: '/settings/account', method: 'PUT', body }),
      invalidatesTags: [settingsTag('account')],
    }),

    /** The acting member's 5 email-notification toggles (lazy-created defaults). */
    getNotifications: build.query<NotificationPreferenceDto, void>({
      query: () => '/settings/notifications',
      providesTags: [settingsTag('notifications')],
    }),

    /** Replace all 5 email-notification toggles. */
    updateNotifications: build.mutation<
      NotificationPreferenceDto,
      UpdateNotificationPreferenceDto
    >({
      query: (body) => ({ url: '/settings/notifications', method: 'PUT', body }),
      invalidatesTags: [settingsTag('notifications')],
    }),
  }),
});

export const {
  useGetCommitQuery,
  useLazyGetCommitQuery,
  useGetMyWeeksQuery,
  useGetCurrentWeekQuery,
  useCreateCommitMutation,
  useUpdateCommitMutation,
  useSubmitCommitMutation,
  useStartReconcileMutation,
  usePatchItemStatusMutation,
  useMarkReconciledMutation,
  useGetReconciliationQuery,
  useCarryForwardMutation,
  useGetRcdoTreeQuery,
  useSearchSupportingOutcomesQuery,
  useLazySearchSupportingOutcomesQuery,
  useCreateRallyCryMutation,
  useUpdateRallyCryMutation,
  useDeleteRallyCryMutation,
  useCreateDefiningObjectiveMutation,
  useUpdateDefiningObjectiveMutation,
  useDeleteDefiningObjectiveMutation,
  useCreateOutcomeMutation,
  useUpdateOutcomeMutation,
  useDeleteOutcomeMutation,
  useCreateSupportingOutcomeMutation,
  useUpdateSupportingOutcomeMutation,
  useDeleteSupportingOutcomeMutation,
  useReviewCommitMutation,
  useGetRollupQuery,
  useLazyGetReportLatestCommitQuery,
  useGetReviewQueueQuery,
  useGetPulseQuery,
  usePutPulseMutation,
  useGetOutlookConnectionQuery,
  useConnectOutlookMutation,
  useDisconnectOutlookMutation,
  useUpdateOutlookSettingsMutation,
  useGetAccountQuery,
  useUpdateAccountMutation,
  useGetNotificationsQuery,
  useUpdateNotificationsMutation,
} = commitApi;
