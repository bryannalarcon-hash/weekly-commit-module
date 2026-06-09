// libs/api/src/commitApi.ts — the RTK Query data layer for the WCM (U17): the ONLY way app code talks
// to the backend (no fetch/axios). Covers every endpoint in libs/types/contract.ts — commits, RCDO,
// reconciliation, review + roll-up, the My-Week/History week list, weekly Pulse, the manager review
// queue, and the Outlook (Graph) connection — injects a Bearer token via the injectable tokenProvider,
// and wires the providesTags/invalidatesTags graph. Generated React hooks feed the screens (U18–U22).
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  CommitDto,
  CreateCommitRequest,
  ItemStatusPatch,
  OutlookConnectionDto,
  OutlookConnectResponse,
  OutlookSettingsRequest,
  Page,
  PulseDto,
  PulseRequest,
  RallyCryNode,
  ReconciliationView,
  ReviewDto,
  ReviewQueueRow,
  ReviewRequest,
  RollupRow,
  SupportingOutcomeDto,
  UpdateCommitRequest,
  WeekSummary,
} from '@wcm/types';
import {
  TAG_TYPES,
  commitTag,
  outlookTag,
  pulseTag,
  reconciliationTag,
  reviewQueueTag,
  reviewTag,
  rollupTag,
  weekListTag,
} from './tags';
import { getAccessToken } from './tokenProvider';

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
 * fetchBaseQuery with a prepareHeaders that injects `Authorization: Bearer <token>` from the
 * injected token getter. Empty-safe: when no token is available (tests/standalone-no-auth) the
 * header is simply omitted, so the slice builds and tests run WITHOUT live Auth0.
 */
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  prepareHeaders: async (headers) => {
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
      providesTags: ['RcdoTree'],
    }),

    searchSupportingOutcomes: build.query<SupportingOutcomeDto[], string>({
      query: (q) => ({ url: '/rcdo/supporting-outcomes', params: { q } }),
      providesTags: ['SupportingOutcome'],
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
  useReviewCommitMutation,
  useGetRollupQuery,
  useGetReviewQueueQuery,
  useGetPulseQuery,
  usePutPulseMutation,
  useGetOutlookConnectionQuery,
  useConnectOutlookMutation,
  useDisconnectOutlookMutation,
  useUpdateOutlookSettingsMutation,
} = commitApi;
