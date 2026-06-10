// libs/types/contract.ts — the frozen WCM REST contract (U10), mirrored 1:1 from the Spring Boot
// Java DTOs in backend/.../{commit,rcdo,review}/dto. These shapes are what the RTK Query apiSlice
// (libs/api) and the MSW mocks build against, so the FE can compile before controllers exist. Keep
// every field name/type identical to its Java record; the controller MockMvc tests prove conformance.

/** Lifecycle states of a weekly commit (mirrors the backend LifecycleState enum exactly). */
export type LifecycleState =
  | 'DRAFT'
  | 'LOCKED'
  | 'RECONCILING'
  | 'RECONCILED'
  | 'CARRY_FORWARD';

/** Live ACTUAL status of a commit item (mirrors CommitItemStatus). */
export type CommitItemStatus = 'OPEN' | 'COMPLETE' | 'INCOMPLETE' | 'CARRIED_FORWARD';

/** Ordered priority "chess" tiers, KING highest (mirrors ChessTier). */
export type ChessTier = 'KING' | 'QUEEN' | 'ROOK' | 'BISHOP' | 'KNIGHT' | 'PAWN';

/** Manager-review state (mirrors ReviewState). */
export type ReviewState = 'UNREVIEWED' | 'INCOMPLETE' | 'REVIEWED';

/** Per-row verdict in the planned-vs-actual diff (mirrors ReconciliationFlag). */
export type ReconciliationFlag =
  | 'COMPLETED'
  | 'INCOMPLETE'
  | 'CARRIED'
  | 'ADDED_AFTER_LOCK';

// --- Commit DTOs (mirror commit/dto/*) --------------------------------------------------------

/** One item of a weekly commit (mirrors CommitItemDto). */
export interface CommitItemDto {
  id: string;
  text: string;
  status: CommitItemStatus;
  supportingOutcomeId: string | null;
  chessTier: ChessTier | null;
  carriedFromItemId: string | null;
}

/** A weekly commit with its items (mirrors CommitDto). */
export interface CommitDto {
  id: string;
  memberId: string;
  weekStart: string; // ISO date (yyyy-MM-dd)
  lifecycleState: LifecycleState;
  submittedAt: string | null; // ISO instant
  reviewedAt: string | null;
  items: CommitItemDto[];
}

/** One item in a create/update request (mirrors CommitItemRequest). */
export interface CommitItemRequest {
  text: string;
  supportingOutcomeId?: string | null;
  chessTier?: ChessTier | null;
}

/**
 * Body of POST /api/commits (mirrors CreateCommitRequest). NOTE: memberId is IGNORED server-side
 * (the owner is the authenticated/acting member); it exists only to document that spoofing fails.
 */
export interface CreateCommitRequest {
  weekStart: string;
  items?: CommitItemRequest[];
  memberId?: string;
}

/** Body of PUT /api/commits/{id} (mirrors UpdateCommitRequest). */
export interface UpdateCommitRequest {
  items?: CommitItemRequest[];
}

/** Body of PATCH /api/commits/{id}/items/{itemId}/status (mirrors ItemStatusPatch). */
export interface ItemStatusPatch {
  status: CommitItemStatus;
}

// --- Reconciliation DTOs (mirror commit/dto/Reconciliation*) ----------------------------------

/** One line of the planned-vs-actual diff (mirrors ReconciliationRow). */
export interface ReconciliationRow {
  commitItemId: string;
  plannedText: string | null;
  plannedTier: ChessTier | null;
  supportingOutcomeId: string | null;
  actualStatus: CommitItemStatus | null;
  flag: ReconciliationFlag;
}

/** GET /api/commits/{id}/reconciliation response (mirrors ReconciliationView). */
export interface ReconciliationView {
  commitId: string;
  lifecycleState: LifecycleState;
  rows: ReconciliationRow[];
}

// --- RCDO DTOs (mirror rcdo/dto/*) ------------------------------------------------------------

/** RCDO leaf (mirrors SupportingOutcomeDto). */
export interface SupportingOutcomeDto {
  id: string;
  outcomeId: string;
  title: string;
  ownerId: string | null;
}

/** Third tree level (mirrors OutcomeNode). */
export interface OutcomeNode {
  id: string;
  title: string;
  supportingOutcomes: SupportingOutcomeDto[];
}

/** Second tree level (mirrors DefiningObjectiveNode). */
export interface DefiningObjectiveNode {
  id: string;
  title: string;
  outcomes: OutcomeNode[];
}

/** Root tree level (mirrors RallyCryNode); element of the GET /api/rcdo/tree array. */
export interface RallyCryNode {
  id: string;
  title: string;
  definingObjectives: DefiningObjectiveNode[];
}

// --- Review + roll-up DTOs (mirror review/dto/*) ----------------------------------------------

/** Body of POST /api/commits/{id}/review (mirrors ReviewRequest). */
export interface ReviewRequest {
  state: ReviewState;
  comment?: string | null;
}

/** Manager review wire shape (mirrors ReviewDto). */
export interface ReviewDto {
  id: string;
  weeklyCommitId: string;
  reviewerId: string | null;
  state: ReviewState;
  comment: string | null;
  reviewedAt: string | null;
}

/** One report's roll-up metrics (mirrors RollupRow). Percentages are 0..100. */
export interface RollupRow {
  memberId: string;
  memberName: string;
  commitCount: number;
  itemCount: number;
  completionPct: number;
  carryOverRate: number;
  rcdoAlignmentPct: number;
}

/** One row of a report's submission status in the manager review queue (mirrors ReviewQueueRow). */
export interface ReviewQueueRow {
  memberId: string;
  memberName: string;
  /** The report's commit for the selected week, if one exists yet. */
  commitId: string | null;
  lifecycleState: LifecycleState | null;
  /** Whether the commit is past its weekly due date and still unsubmitted. */
  overdue: boolean;
  itemCount: number;
  completedCount: number;
  reviewState: ReviewState;
}

/** Spring Data Page envelope (subset) for GET /api/rollup and GET /api/review-queue. */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// --- Week list / history DTOs (mirror commit/dto/WeekSummary) ----------------------------------

/**
 * A compact header for one of the acting member's weekly commits, for the My Week landing + History
 * list (mirrors WeekSummary). Avoids shipping every item just to render a row.
 */
export interface WeekSummary {
  commitId: string;
  weekStart: string; // ISO date (yyyy-MM-dd)
  lifecycleState: LifecycleState;
  itemCount: number;
  completedCount: number;
  /** Count of items carried into this week from a prior week (lineage). */
  carriedInCount: number;
}

// --- Pulse DTOs (mirror commit/dto/Pulse*) ----------------------------------------------------

/** A weekly Pulse reading: a 1..5 rating + optional comment + manager-private flag (mirrors PulseDto). */
export interface PulseDto {
  /** 1..5; null when the member has not yet rated the week. */
  rating: number | null;
  comment: string | null;
  /** When true, the comment is visible only to the member's manager. */
  privateToManager: boolean;
}

/** Body of PUT /api/commits/{id}/pulse (mirrors PulseRequest). */
export interface PulseRequest {
  rating: number;
  comment?: string | null;
  privateToManager?: boolean;
}

// --- Outlook integration DTOs (mirror integration/dto/*) --------------------------------------

/** Connection state of the delegated Microsoft Graph link (mirrors OutlookStatus). */
export type OutlookStatus = 'DISCONNECTED' | 'CONNECTED';

/** GET /api/integration/outlook response (mirrors OutlookConnectionDto). */
export interface OutlookConnectionDto {
  status: OutlookStatus;
  /** The connected Microsoft account's email, when CONNECTED. */
  account: string | null;
  /** ISO instant of the last successful calendar sync, when known. */
  lastSyncAt: string | null;
  /** Whether locking a week creates a calendar event for it. */
  createEventOnLock: boolean;
  /** Whether the server has Entra/Graph configured (false on a demo host with no AZURE_* env) — when
   *  false the UI hides "Connect" and explains, instead of dead-ending on a Microsoft error page. */
  available: boolean;
}

/** Body of PUT /api/integration/outlook/settings (mirrors OutlookSettingsRequest). */
export interface OutlookSettingsRequest {
  createEventOnLock: boolean;
}

/** GET /api/integration/outlook/connect response — the Graph consent URL to redirect to. */
export interface OutlookConnectResponse {
  authorizationUrl: string;
}

/**
 * Body of POST /api/integration/outlook/schedule (CB-1 — manager schedules a 1:1/check-in with a
 * report through their delegated Graph link). 409 illegal_state when the acting manager's Outlook
 * is not CONNECTED; row-level authz restricts reportMemberId to the manager's own reports.
 */
export interface ScheduleOutlookEventRequest {
  /** The report (direct report of the acting manager) the event is with. */
  reportMemberId: string;
  subject: string;
  /** ISO-8601 date-time WITH a UTC offset (e.g. 2026-06-10T10:00:00-05:00) — an absolute instant. */
  startDateTime: string;
  durationMinutes: number;
  /** Optional body/agenda note placed on the event. */
  note?: string | null;
  /** Idempotency key (one per dialog open): a retried POST dedups on Graph's transactionId. */
  clientRequestId?: string | null;
}

/** POST /api/integration/outlook/schedule response — the created Graph calendar event's id. */
export interface ScheduleOutlookEventResponse {
  eventId: string;
}

// --- Settings DTOs (mirror settings/dto/*) ----------------------------------------------------

/** GET /api/settings/account response (mirrors MemberAccountDto): the acting member's profile. */
export interface MemberAccountDto {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  /** Whether this member can review reports (manager access) — read-only, server-derived. */
  canReview: boolean;
  /** Whether this member can edit the RCDO strategy tree (admin:rcdo scope) — gates FE edit mode. */
  canEditRcdo: boolean;
}

/**
 * Body of PUT /api/settings/account (mirrors UpdateMemberAccountDto). displayName is required
 * (<=160 chars); timezone is optional/validated server-side (<=63 chars, IANA zone id).
 */
export interface UpdateMemberAccountDto {
  displayName: string;
  timezone?: string;
}

/**
 * GET/PUT /api/settings/notifications shape (mirrors NotificationPreferenceDto): the 5 email
 * toggles surfaced on the Settings → Notifications panel. Lazy-created with defaults server-side.
 */
export interface NotificationPreferenceDto {
  emailOnLock: boolean;
  emailOnReview: boolean;
  emailOnReconciled: boolean;
  weeklyDigest: boolean;
  reminderEmails: boolean;
}

/**
 * Body of PUT /api/settings/notifications (mirrors UpdateNotificationPreferenceDto). All 5
 * booleans are required (full replace, not a partial patch).
 */
export type UpdateNotificationPreferenceDto = NotificationPreferenceDto;

// --- RCDO admin DTOs (mirror rcdo/dto/*Request|*Response, admin-only CRUD) ---------------------

/**
 * Shared request fields for every RCDO admin create/update body. title is required (<=200 chars);
 * description (<=2000), startDate/endDate (ISO date) and ownerId (uuid) are optional. Each child
 * level adds the parent id (see the per-level Request interfaces below).
 */
export interface RcdoNodeRequestBase {
  title: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  ownerId?: string | null;
}

/**
 * Shared response fields for every RCDO admin create/update result, plus audit columns. Each child
 * level adds its parent id (see the per-level Response interfaces below).
 */
export interface RcdoNodeResponseBase {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerId: string | null;
  createdBy: string | null;
  createdDate: string | null; // ISO instant
}

/** Body of POST/PUT /api/admin/rcdo/rally-cries[/{id}] (mirrors RallyCryRequest). Root level: no parent. */
export type RallyCryRequest = RcdoNodeRequestBase;

/** Result of the RallyCry admin mutations (mirrors RallyCryResponse). */
export type RallyCryResponse = RcdoNodeResponseBase;

/** Body of POST/PUT /api/admin/rcdo/defining-objectives[/{id}] (mirrors DefiningObjectiveRequest). */
export interface DefiningObjectiveRequest extends RcdoNodeRequestBase {
  /** Parent RallyCry id (required on create; carried for placement). */
  rallyCryId?: string | null;
}

/** Result of the DefiningObjective admin mutations (mirrors DefiningObjectiveResponse). */
export interface DefiningObjectiveResponse extends RcdoNodeResponseBase {
  rallyCryId: string | null;
}

/** Body of POST/PUT /api/admin/rcdo/outcomes[/{id}] (mirrors OutcomeRequest). */
export interface OutcomeRequest extends RcdoNodeRequestBase {
  /** Parent DefiningObjective id (required on create). */
  definingObjectiveId?: string | null;
}

/** Result of the Outcome admin mutations (mirrors OutcomeResponse). */
export interface OutcomeResponse extends RcdoNodeResponseBase {
  definingObjectiveId: string | null;
}

/** Body of POST/PUT /api/admin/rcdo/supporting-outcomes[/{id}] (mirrors SupportingOutcomeRequest). */
export interface SupportingOutcomeRequest extends RcdoNodeRequestBase {
  /** Parent Outcome id (required on create). */
  outcomeId?: string | null;
}

/** Result of the SupportingOutcome admin mutations (mirrors SupportingOutcomeResponse). */
export interface SupportingOutcomeResponse extends RcdoNodeResponseBase {
  outcomeId: string | null;
}

/** RFC-7807 ProblemDetail error body (mirrors the ApiExceptionHandler output). */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  from?: string;
  to?: string;
}
