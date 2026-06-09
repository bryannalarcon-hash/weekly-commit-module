// libs/types — shared DTO/contract types for the Weekly Commit Module.
// The frozen REST contract (commits, items, RCDO nodes, reconciliation, review, roll-up, errors)
// lives in ./contract and is mirrored 1:1 from the Spring Boot Java DTOs (U10). This barrel
// re-exports it and keeps a thin legacy `WeeklyCommit` alias used by early UI wiring.
export * from './contract';

import type { CommitDto, LifecycleState } from './contract';

/**
 * Legacy header view kept for the early UI scaffolding; prefer CommitDto from ./contract.
 * `state` uses the backend LifecycleState ('CARRY_FORWARD', not 'CARRIED_FORWARD').
 */
export interface WeeklyCommit {
  id: string;
  ownerId: string;
  weekStartIso: string;
  state: LifecycleState;
}

/** Narrow a full CommitDto down to the legacy header shape (transition helper). */
export function toWeeklyCommitHeader(dto: CommitDto): WeeklyCommit {
  return {
    id: dto.id,
    ownerId: dto.memberId,
    weekStartIso: dto.weekStart,
    state: dto.lifecycleState,
  };
}
