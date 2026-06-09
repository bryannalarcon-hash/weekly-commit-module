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
}

/** Body of PUT /api/integration/outlook/settings (mirrors OutlookSettingsRequest). */
export interface OutlookSettingsRequest {
  createEventOnLock: boolean;
}

/** GET /api/integration/outlook/connect response — the Graph consent URL to redirect to. */
export interface OutlookConnectResponse {
  authorizationUrl: string;
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
