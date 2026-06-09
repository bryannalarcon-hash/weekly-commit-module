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

/** Spring Data Page envelope (subset) for GET /api/rollup. */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
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
