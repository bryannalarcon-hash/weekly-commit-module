// libs/api/msw/handlers.ts — MSW request handlers mirroring the WCM REST contract (U10), so the FE
// (RTK Query units U17+) can build and test against mocks BEFORE the Spring controllers exist. The
// endpoints, methods, status codes and JSON shapes mirror the Java controllers 1:1 (see
// backend/.../{commit,rcdo,review}). A tiny in-memory store backs a create->read->submit round-trip;
// errors are emitted as RFC-7807 ProblemDetail to match ApiExceptionHandler.
import { http, HttpResponse } from 'msw';
import type {
  CommitDto,
  CommitItemDto,
  CreateCommitRequest,
  ItemStatusPatch,
  OutlookConnectionDto,
  OutlookSettingsRequest,
  ProblemDetail,
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

const BASE = '/api';

/** The mock acting member — the real impl resolves this from the JWT (CurrentMemberProvider). */
export const MOCK_MEMBER_ID = '00000000-0000-0000-0000-0000000000aa';

const uuid = (): string =>
  (globalThis.crypto?.randomUUID?.() ??
    '00000000-0000-0000-0000-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0'));

/** In-memory commit store keyed by id (reset via resetMockDb in tests). */
const commits = new Map<string, CommitDto>();
/** Per-commit Pulse readings (commitId → reading). */
const pulses = new Map<string, PulseDto>();
/** The acting member's single Outlook connection row. */
let outlook: OutlookConnectionDto = {
  status: 'DISCONNECTED',
  account: null,
  lastSyncAt: null,
  createEventOnLock: true,
};

export function resetMockDb(): void {
  commits.clear();
  pulses.clear();
  outlook = {
    status: 'DISCONNECTED',
    account: null,
    lastSyncAt: null,
    createEventOnLock: true,
  };
}

/** Project a stored commit down to the list/history WeekSummary header. */
function toSummary(dto: CommitDto): WeekSummary {
  return {
    commitId: dto.id,
    weekStart: dto.weekStart,
    lifecycleState: dto.lifecycleState,
    itemCount: dto.items.length,
    completedCount: dto.items.filter((i) => i.status === 'COMPLETE').length,
    carriedInCount: dto.items.filter((i) => i.carriedFromItemId).length,
  };
}

function problem(status: number, code: string, detail: string): HttpResponse<ProblemDetail> {
  const body: ProblemDetail = {
    type: `urn:wcm:problem:${code}`,
    title: code,
    status,
    detail,
    code,
  };
  return HttpResponse.json(body, { status });
}

function toItem(req: { text: string; supportingOutcomeId?: string | null; chessTier?: string | null }): CommitItemDto {
  return {
    id: uuid(),
    text: req.text,
    status: 'OPEN',
    supportingOutcomeId: req.supportingOutcomeId ?? null,
    chessTier: (req.chessTier as CommitItemDto['chessTier']) ?? null,
    carriedFromItemId: null,
  };
}

/** A small fixed RCDO tree for the picker mock. */
const RCDO_TREE: RallyCryNode[] = [
  {
    id: uuid(),
    title: 'Become the system of record for total-portfolio intelligence.',
    definingObjectives: [
      {
        id: uuid(),
        title: 'Unify public & private markets in one view',
        outcomes: [
          {
            id: uuid(),
            title: 'Single source of truth across asset classes',
            supportingOutcomes: [
              { id: uuid(), outcomeId: uuid(), title: 'Ingest private-capital statements', ownerId: null },
              { id: uuid(), outcomeId: uuid(), title: 'Normalize public holdings', ownerId: null },
            ],
          },
        ],
      },
    ],
  },
];

const ALL_LEAVES: SupportingOutcomeDto[] = RCDO_TREE.flatMap((rc) =>
  rc.definingObjectives.flatMap((dobj) =>
    dobj.outcomes.flatMap((o) => o.supportingOutcomes),
  ),
);

export const handlers = [
  // --- Commits (U11) ---------------------------------------------------------------------------
  // NOTE: the literal `/commits` and `/commits/current` routes are declared BEFORE `/commits/:id`
  // so the `:id` param route does not swallow them (MSW matches handlers in array order).
  http.get(`${BASE}/commits/current`, () => {
    const current = [...commits.values()]
      .filter((c) => c.lifecycleState !== 'CARRY_FORWARD')
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
    // 204 when there is no open week yet → the "Start your week" empty state.
    return current ? HttpResponse.json(current) : new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/commits`, () => {
    const summaries = [...commits.values()]
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .map(toSummary);
    return HttpResponse.json(summaries);
  }),

  http.post(`${BASE}/commits`, async ({ request }) => {
    const req = (await request.json()) as CreateCommitRequest;
    const dto: CommitDto = {
      id: uuid(),
      // memberId is the acting member, NEVER req.memberId (KTD6 — spoof ignored).
      memberId: MOCK_MEMBER_ID,
      weekStart: req.weekStart,
      lifecycleState: 'DRAFT',
      submittedAt: null,
      reviewedAt: null,
      items: (req.items ?? []).map(toItem),
    };
    commits.set(dto.id, dto);
    return HttpResponse.json(dto, { status: 201 });
  }),

  http.get(`${BASE}/commits/:id`, ({ params }) => {
    const dto = commits.get(params.id as string);
    return dto ? HttpResponse.json(dto) : problem(404, 'not_found', 'commit not found');
  }),

  http.put(`${BASE}/commits/:id`, async ({ params, request }) => {
    const dto = commits.get(params.id as string);
    if (!dto) return problem(404, 'not_found', 'commit not found');
    if (dto.lifecycleState !== 'DRAFT') {
      return problem(409, 'illegal_transition', 'content edits are only allowed while DRAFT');
    }
    const req = (await request.json()) as UpdateCommitRequest;
    dto.items = (req.items ?? []).map(toItem);
    return HttpResponse.json(dto);
  }),

  http.post(`${BASE}/commits/:id/submit`, ({ params }) => {
    const dto = commits.get(params.id as string);
    if (!dto) return problem(404, 'not_found', 'commit not found');
    if (!dto.items.every((i) => i.supportingOutcomeId)) {
      return problem(422, 'unprocessable', 'every item must link a supporting outcome before submit');
    }
    dto.lifecycleState = 'LOCKED';
    dto.submittedAt = new Date().toISOString();
    return HttpResponse.json(dto);
  }),

  // --- Reconciliation (U13) --------------------------------------------------------------------
  http.post(`${BASE}/commits/:id/reconcile`, ({ params }) => {
    const dto = commits.get(params.id as string);
    if (!dto) return problem(404, 'not_found', 'commit not found');
    dto.lifecycleState = 'RECONCILING';
    return HttpResponse.json(dto);
  }),

  http.patch(`${BASE}/commits/:id/items/:itemId/status`, async ({ params, request }) => {
    const dto = commits.get(params.id as string);
    if (!dto) return problem(404, 'not_found', 'commit not found');
    if (dto.lifecycleState !== 'RECONCILING') {
      return problem(409, 'illegal_transition', 'status edits are only allowed while RECONCILING');
    }
    const patch = (await request.json()) as ItemStatusPatch;
    const item = dto.items.find((i) => i.id === params.itemId);
    if (item) item.status = patch.status;
    return HttpResponse.json(dto);
  }),

  http.post(`${BASE}/commits/:id/reconciled`, ({ params }) => {
    const dto = commits.get(params.id as string);
    if (!dto) return problem(404, 'not_found', 'commit not found');
    dto.lifecycleState = 'RECONCILED';
    dto.reviewedAt = new Date().toISOString();
    return HttpResponse.json(dto);
  }),

  http.get(`${BASE}/commits/:id/reconciliation`, ({ params }) => {
    const dto = commits.get(params.id as string);
    if (!dto) return problem(404, 'not_found', 'commit not found');
    const view: ReconciliationView = {
      commitId: dto.id,
      lifecycleState: dto.lifecycleState,
      rows: dto.items.map((i) => ({
        commitItemId: i.id,
        plannedText: i.text,
        plannedTier: i.chessTier,
        supportingOutcomeId: i.supportingOutcomeId,
        actualStatus: i.status,
        flag:
          i.status === 'COMPLETE'
            ? 'COMPLETED'
            : i.status === 'CARRIED_FORWARD'
              ? 'CARRIED'
              : 'INCOMPLETE',
      })),
    };
    return HttpResponse.json(view);
  }),

  http.post(`${BASE}/commits/:id/carry-forward`, ({ params }) => {
    const dto = commits.get(params.id as string);
    if (!dto) return problem(404, 'not_found', 'commit not found');
    const next: CommitDto = {
      id: uuid(),
      memberId: dto.memberId,
      weekStart: dto.weekStart,
      lifecycleState: 'DRAFT',
      submittedAt: null,
      reviewedAt: null,
      items: dto.items
        .filter((i) => i.status === 'INCOMPLETE')
        .map((i) => ({ ...i, id: uuid(), status: 'OPEN', carriedFromItemId: i.id })),
    };
    dto.lifecycleState = 'CARRY_FORWARD';
    commits.set(next.id, next);
    return HttpResponse.json(next);
  }),

  // --- RCDO (U12) ------------------------------------------------------------------------------
  http.get(`${BASE}/rcdo/tree`, () => HttpResponse.json(RCDO_TREE)),

  http.get(`${BASE}/rcdo/supporting-outcomes`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? '';
    const filtered = ALL_LEAVES.filter((so) => so.title.toLowerCase().includes(q));
    return HttpResponse.json(filtered);
  }),

  // --- Review + roll-up (U14) ------------------------------------------------------------------
  http.post(`${BASE}/commits/:id/review`, async ({ params, request }) => {
    const req = (await request.json()) as ReviewRequest;
    const dto: ReviewDto = {
      id: uuid(),
      weeklyCommitId: params.id as string,
      reviewerId: MOCK_MEMBER_ID,
      state: req.state,
      comment: req.comment ?? null,
      reviewedAt: req.state === 'REVIEWED' ? new Date().toISOString() : null,
    };
    return HttpResponse.json(dto);
  }),

  http.get(`${BASE}/rollup`, ({ request }) => {
    const url = new URL(request.url);
    const size = Number(url.searchParams.get('size') ?? '50');
    const page = Number(url.searchParams.get('page') ?? '0');
    const rows: RollupRow[] = [
      {
        memberId: uuid(),
        memberName: 'Diego Alvarez',
        commitCount: 3,
        itemCount: 4,
        completionPct: 50,
        carryOverRate: 25,
        rcdoAlignmentPct: 75,
      },
    ];
    return HttpResponse.json({
      content: rows,
      totalElements: rows.length,
      totalPages: 1,
      number: page,
      size,
    });
  }),

  http.get(`${BASE}/review-queue`, ({ request }) => {
    const url = new URL(request.url);
    const size = Number(url.searchParams.get('size') ?? '50');
    const page = Number(url.searchParams.get('page') ?? '0');
    const rows: ReviewQueueRow[] = [
      {
        memberId: uuid(),
        memberName: 'Diego Alvarez',
        commitId: uuid(),
        lifecycleState: 'LOCKED',
        overdue: false,
        itemCount: 4,
        completedCount: 2,
        reviewState: 'UNREVIEWED',
      },
      {
        memberId: uuid(),
        memberName: 'Priya Natarajan',
        commitId: null,
        lifecycleState: 'DRAFT',
        overdue: true,
        itemCount: 1,
        completedCount: 0,
        reviewState: 'UNREVIEWED',
      },
    ];
    return HttpResponse.json({
      content: rows,
      totalElements: rows.length,
      totalPages: 1,
      number: page,
      size,
    });
  }),

  // --- Pulse (U19) -----------------------------------------------------------------------------
  http.get(`${BASE}/commits/:id/pulse`, ({ params }) => {
    const reading = pulses.get(params.id as string) ?? {
      rating: null,
      comment: null,
      privateToManager: false,
    };
    return HttpResponse.json(reading);
  }),

  http.put(`${BASE}/commits/:id/pulse`, async ({ params, request }) => {
    const req = (await request.json()) as PulseRequest;
    const reading: PulseDto = {
      rating: req.rating,
      comment: req.comment ?? null,
      privateToManager: req.privateToManager ?? false,
    };
    pulses.set(params.id as string, reading);
    return HttpResponse.json(reading);
  }),

  // --- Outlook integration (U22) ---------------------------------------------------------------
  http.get(`${BASE}/integration/outlook`, () => HttpResponse.json(outlook)),

  http.post(`${BASE}/integration/outlook/connect`, () =>
    HttpResponse.json({
      authorizationUrl:
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=wcm&scope=Calendars.ReadWrite',
    }),
  ),

  http.delete(`${BASE}/integration/outlook`, () => {
    outlook = {
      status: 'DISCONNECTED',
      account: null,
      lastSyncAt: null,
      createEventOnLock: outlook.createEventOnLock,
    };
    return HttpResponse.json(outlook);
  }),

  http.put(`${BASE}/integration/outlook/settings`, async ({ request }) => {
    const req = (await request.json()) as OutlookSettingsRequest;
    outlook = { ...outlook, createEventOnLock: req.createEventOnLock };
    return HttpResponse.json(outlook);
  }),
];

/**
 * Test helper: force the mock Outlook connection into a CONNECTED state (the real connect flow is a
 * Graph redirect we cannot complete under jsdom). Lets Settings tests assert the connected surface.
 */
export function __setMockOutlookConnected(account = 'ada@solovis.com'): void {
  outlook = {
    status: 'CONNECTED',
    account,
    lastSyncAt: new Date().toISOString(),
    createEventOnLock: outlook.createEventOnLock,
  };
}
