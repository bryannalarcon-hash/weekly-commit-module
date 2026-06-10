// apps/wc-remote/src/lib/rcdo.ts — RCDO tree helpers for the WC remote screens. Flattens the
// GET /rcdo/tree shape (rallyCries → definingObjectives → outcomes → supportingOutcomes) into a
// lookup so an item's supportingOutcomeId resolves to its human Supporting-Outcome title for the
// RcdoChip (My Week, manager Review Detail, Reconciliation). Pure + memoizable; mirrors the
// pathById flatten in PastCommitDetail.tsx (this one only needs id → title).
import type { RallyCryNode } from '@wcm/types';

/**
 * Build a `supportingOutcomeId → SupportingOutcome.title` map by walking the full RCDO tree.
 * Returns an empty Map while the tree is undefined (still loading), so callers fall back gracefully.
 */
export function outcomeTitleById(tree: RallyCryNode[] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const rally of tree ?? []) {
    for (const dobj of rally.definingObjectives) {
      for (const outcome of dobj.outcomes) {
        for (const so of outcome.supportingOutcomes) {
          map.set(so.id, so.title);
        }
      }
    }
  }
  return map;
}
