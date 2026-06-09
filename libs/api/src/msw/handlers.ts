// libs/api/msw/handlers.ts — MSW request handlers mirroring the WCM REST contract (U10), so the FE
// (RTK Query units U17+) can build and test against mocks BEFORE the Spring controllers exist. The
// endpoints, methods, status codes and JSON shapes mirror the Java controllers 1:1 (see
// backend/.../{commit,rcdo,review,settings}). A tiny in-memory store backs a create->read->submit
// round-trip, the RCDO admin CRUD (mutates the in-memory tree the browse/picker read), Settings
// (account + the 5 notification toggles), and the CB-1 Outlook schedule-1:1 POST (success default;
// outlookScheduleIllegalStateHandler is the switchable 409 not-connected variant); errors are emitted
// as RFC-7807 ProblemDetail to match ApiExceptionHandler.
import { http, HttpResponse } from 'msw';
import type {
  CommitDto,
  CommitItemDto,
  CreateCommitRequest,
  DefiningObjectiveNode,
  DefiningObjectiveRequest,
  DefiningObjectiveResponse,
  ItemStatusPatch,
  MemberAccountDto,
  NotificationPreferenceDto,
  OutcomeNode,
  OutcomeRequest,
  OutcomeResponse,
  OutlookConnectionDto,
  OutlookSettingsRequest,
  ProblemDetail,
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
  ScheduleOutlookEventRequest,
  ScheduleOutlookEventResponse,
  SupportingOutcomeDto,
  SupportingOutcomeRequest,
  SupportingOutcomeResponse,
  UpdateCommitRequest,
  UpdateMemberAccountDto,
  UpdateNotificationPreferenceDto,
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

/** Default account profile for the acting member (Settings → Account). */
const defaultAccount = (): MemberAccountDto => ({
  id: MOCK_MEMBER_ID,
  email: 'lindsley.alvaro@solovis.com',
  displayName: 'Lindsley Alvaro',
  timezone: 'America/Chicago',
  canReview: true,
});
/** Default notification toggles for the acting member (Settings → Notifications). */
const defaultNotifications = (): NotificationPreferenceDto => ({
  emailOnLock: true,
  emailOnReview: true,
  emailOnReconciled: true,
  weeklyDigest: true,
  reminderEmails: false,
});

/** The acting member's Settings rows (lazy-created defaults, mutated by PUTs). */
let account: MemberAccountDto = defaultAccount();
let notifications: NotificationPreferenceDto = defaultNotifications();

export function resetMockDb(): void {
  commits.clear();
  pulses.clear();
  outlook = {
    status: 'DISCONNECTED',
    account: null,
    lastSyncAt: null,
    createEventOnLock: true,
  };
  account = defaultAccount();
  notifications = defaultNotifications();
  resetRcdoTree();
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

/**
 * A small RCDO tree for the picker/browse mock. MUTABLE so the admin CRUD handlers below can
 * insert/update/delete nodes and the next GET /rcdo/tree reflects it (mirrors the real tree refetch
 * the rcdoTreeTag invalidation triggers). Rebuilt on resetMockDb via resetRcdoTree().
 */
function seedRcdoTree(): RallyCryNode[] {
  const outcomeId = uuid();
  return [
    {
      id: uuid(),
      title: 'Become the system of record for total-portfolio intelligence.',
      definingObjectives: [
        {
          id: uuid(),
          title: 'Unify public & private markets in one view',
          outcomes: [
            {
              id: outcomeId,
              title: 'Single source of truth across asset classes',
              supportingOutcomes: [
                { id: uuid(), outcomeId, title: 'Ingest private-capital statements', ownerId: null },
                { id: uuid(), outcomeId, title: 'Normalize public holdings', ownerId: null },
              ],
            },
          ],
        },
      ],
    },
  ];
}

let rcdoTree: RallyCryNode[] = seedRcdoTree();

function resetRcdoTree(): void {
  rcdoTree = seedRcdoTree();
}

/** All SupportingOutcome leaves across the (current, mutable) tree — feeds the typeahead search. */
function allLeaves(): SupportingOutcomeDto[] {
  return rcdoTree.flatMap((rc) =>
    rc.definingObjectives.flatMap((dobj) =>
      dobj.outcomes.flatMap((o) => o.supportingOutcomes),
    ),
  );
}

/** Today's ISO date — the createdDate stamp for admin-created RCDO nodes. */
const nowIso = (): string => new Date().toISOString();

/** Common request → response audit-field projection for RCDO admin create/update. */
function rcdoBase(
  id: string,
  req: { title: string; description?: string | null; startDate?: string | null; endDate?: string | null; ownerId?: string | null },
): {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerId: string | null;
  createdBy: string;
  createdDate: string;
} {
  return {
    id,
    title: req.title,
    description: req.description ?? null,
    startDate: req.startDate ?? null,
    endDate: req.endDate ?? null,
    ownerId: req.ownerId ?? null,
    createdBy: MOCK_MEMBER_ID,
    createdDate: nowIso(),
  };
}

/** Find a DefiningObjective node by id across the tree (for child placement on create). */
function findObjective(id: string): DefiningObjectiveNode | undefined {
  for (const rc of rcdoTree) {
    const found = rc.definingObjectives.find((d) => d.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Find an Outcome node by id across the tree (for leaf placement on create). */
function findOutcome(id: string): OutcomeNode | undefined {
  for (const rc of rcdoTree) {
    for (const dobj of rc.definingObjectives) {
      const found = dobj.outcomes.find((o) => o.id === id);
      if (found) return found;
    }
  }
  return undefined;
}

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
  http.get(`${BASE}/rcdo/tree`, () => HttpResponse.json(rcdoTree)),

  http.get(`${BASE}/rcdo/supporting-outcomes`, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q')?.toLowerCase() ?? '';
    const filtered = allLeaves().filter((so) => so.title.toLowerCase().includes(q));
    return HttpResponse.json(filtered);
  }),

  // --- RCDO admin CRUD (admin only; mutates the in-memory tree the reads above project) ---------
  // RallyCry (root).
  http.post(`${BASE}/admin/rcdo/rally-cries`, async ({ request }) => {
    const req = (await request.json()) as RallyCryRequest;
    const node: RallyCryNode = { id: uuid(), title: req.title, definingObjectives: [] };
    rcdoTree.push(node);
    return HttpResponse.json(rcdoBase(node.id, req) satisfies RallyCryResponse);
  }),
  http.put(`${BASE}/admin/rcdo/rally-cries/:id`, async ({ params, request }) => {
    const id = params.id as string;
    const node = rcdoTree.find((rc) => rc.id === id);
    if (!node) return problem(404, 'not_found', 'rally cry not found');
    const req = (await request.json()) as RallyCryRequest;
    node.title = req.title;
    return HttpResponse.json(rcdoBase(id, req) satisfies RallyCryResponse);
  }),
  http.delete(`${BASE}/admin/rcdo/rally-cries/:id`, ({ params }) => {
    const id = params.id as string;
    const idx = rcdoTree.findIndex((rc) => rc.id === id);
    if (idx < 0) return problem(404, 'not_found', 'rally cry not found');
    rcdoTree.splice(idx, 1);
    return new HttpResponse(null, { status: 200 });
  }),

  // DefiningObjective (under a RallyCry).
  http.post(`${BASE}/admin/rcdo/defining-objectives`, async ({ request }) => {
    const req = (await request.json()) as DefiningObjectiveRequest;
    const parent = rcdoTree.find((rc) => rc.id === req.rallyCryId);
    if (!parent) return problem(404, 'not_found', 'parent rally cry not found');
    const node: DefiningObjectiveNode = { id: uuid(), title: req.title, outcomes: [] };
    parent.definingObjectives.push(node);
    return HttpResponse.json({
      ...rcdoBase(node.id, req),
      rallyCryId: req.rallyCryId ?? null,
    } satisfies DefiningObjectiveResponse);
  }),
  http.put(`${BASE}/admin/rcdo/defining-objectives/:id`, async ({ params, request }) => {
    const id = params.id as string;
    const node = findObjective(id);
    if (!node) return problem(404, 'not_found', 'defining objective not found');
    const req = (await request.json()) as DefiningObjectiveRequest;
    node.title = req.title;
    return HttpResponse.json({
      ...rcdoBase(id, req),
      rallyCryId: req.rallyCryId ?? null,
    } satisfies DefiningObjectiveResponse);
  }),
  http.delete(`${BASE}/admin/rcdo/defining-objectives/:id`, ({ params }) => {
    const id = params.id as string;
    for (const rc of rcdoTree) {
      const idx = rc.definingObjectives.findIndex((d) => d.id === id);
      if (idx >= 0) {
        rc.definingObjectives.splice(idx, 1);
        return new HttpResponse(null, { status: 200 });
      }
    }
    return problem(404, 'not_found', 'defining objective not found');
  }),

  // Outcome (under a DefiningObjective).
  http.post(`${BASE}/admin/rcdo/outcomes`, async ({ request }) => {
    const req = (await request.json()) as OutcomeRequest;
    const parent = req.definingObjectiveId ? findObjective(req.definingObjectiveId) : undefined;
    if (!parent) return problem(404, 'not_found', 'parent defining objective not found');
    const node: OutcomeNode = { id: uuid(), title: req.title, supportingOutcomes: [] };
    parent.outcomes.push(node);
    return HttpResponse.json({
      ...rcdoBase(node.id, req),
      definingObjectiveId: req.definingObjectiveId ?? null,
    } satisfies OutcomeResponse);
  }),
  http.put(`${BASE}/admin/rcdo/outcomes/:id`, async ({ params, request }) => {
    const id = params.id as string;
    const node = findOutcome(id);
    if (!node) return problem(404, 'not_found', 'outcome not found');
    const req = (await request.json()) as OutcomeRequest;
    node.title = req.title;
    return HttpResponse.json({
      ...rcdoBase(id, req),
      definingObjectiveId: req.definingObjectiveId ?? null,
    } satisfies OutcomeResponse);
  }),
  http.delete(`${BASE}/admin/rcdo/outcomes/:id`, ({ params }) => {
    const id = params.id as string;
    for (const rc of rcdoTree) {
      for (const dobj of rc.definingObjectives) {
        const idx = dobj.outcomes.findIndex((o) => o.id === id);
        if (idx >= 0) {
          dobj.outcomes.splice(idx, 1);
          return new HttpResponse(null, { status: 200 });
        }
      }
    }
    return problem(404, 'not_found', 'outcome not found');
  }),

  // SupportingOutcome (leaf, under an Outcome).
  http.post(`${BASE}/admin/rcdo/supporting-outcomes`, async ({ request }) => {
    const req = (await request.json()) as SupportingOutcomeRequest;
    const parent = req.outcomeId ? findOutcome(req.outcomeId) : undefined;
    if (!parent) return problem(404, 'not_found', 'parent outcome not found');
    const leaf: SupportingOutcomeDto = {
      id: uuid(),
      outcomeId: parent.id,
      title: req.title,
      ownerId: req.ownerId ?? null,
    };
    parent.supportingOutcomes.push(leaf);
    return HttpResponse.json({
      ...rcdoBase(leaf.id, req),
      outcomeId: parent.id,
    } satisfies SupportingOutcomeResponse);
  }),
  http.put(`${BASE}/admin/rcdo/supporting-outcomes/:id`, async ({ params, request }) => {
    const id = params.id as string;
    const leaf = allLeaves().find((so) => so.id === id);
    if (!leaf) return problem(404, 'not_found', 'supporting outcome not found');
    const req = (await request.json()) as SupportingOutcomeRequest;
    leaf.title = req.title;
    leaf.ownerId = req.ownerId ?? null;
    return HttpResponse.json({
      ...rcdoBase(id, req),
      outcomeId: leaf.outcomeId,
    } satisfies SupportingOutcomeResponse);
  }),
  http.delete(`${BASE}/admin/rcdo/supporting-outcomes/:id`, ({ params }) => {
    const id = params.id as string;
    for (const rc of rcdoTree) {
      for (const dobj of rc.definingObjectives) {
        for (const o of dobj.outcomes) {
          const idx = o.supportingOutcomes.findIndex((so) => so.id === id);
          if (idx >= 0) {
            o.supportingOutcomes.splice(idx, 1);
            return new HttpResponse(null, { status: 200 });
          }
        }
      }
    }
    return problem(404, 'not_found', 'supporting outcome not found');
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

  // CB-1: schedule a 1:1 Outlook event with a report. The default mock always succeeds with a fresh
  // event id (the real impl 409s when the manager's Outlook link is missing — tests exercise that
  // path by switching in outlookScheduleIllegalStateHandler below via server.use).
  http.post(`${BASE}/integration/outlook/schedule`, async ({ request }) => {
    // Consume the body so spies layered over this handler see the same parsed shape.
    (await request.json()) as ScheduleOutlookEventRequest;
    const body: ScheduleOutlookEventResponse = { eventId: `evt-${uuid()}` };
    return HttpResponse.json(body, { status: 201 });
  }),

  // --- Settings (Account + Notifications) ------------------------------------------------------
  http.get(`${BASE}/settings/account`, () => HttpResponse.json(account)),

  http.put(`${BASE}/settings/account`, async ({ request }) => {
    const req = (await request.json()) as UpdateMemberAccountDto;
    // email/id/canReview are server-owned; only displayName + timezone are editable.
    account = {
      ...account,
      displayName: req.displayName,
      timezone: req.timezone ?? account.timezone,
    };
    return HttpResponse.json(account);
  }),

  http.get(`${BASE}/settings/notifications`, () => HttpResponse.json(notifications)),

  http.put(`${BASE}/settings/notifications`, async ({ request }) => {
    // Full replace of all 5 toggles (mirrors the required-all UpdateNotificationPreferenceDto).
    notifications = (await request.json()) as UpdateNotificationPreferenceDto;
    return HttpResponse.json(notifications);
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

/**
 * Test variant for CB-1: POST /integration/outlook/schedule fails 409 illegal_state — the acting
 * manager has no connected Outlook link. Switch in via server.use(outlookScheduleIllegalStateHandler)
 * to drive the dialog's "Connect Outlook in Settings → Integrations first" inline error.
 */
export const outlookScheduleIllegalStateHandler = http.post(
  `${BASE}/integration/outlook/schedule`,
  () => problem(409, 'illegal_state', 'Outlook is not connected for the acting member'),
);
