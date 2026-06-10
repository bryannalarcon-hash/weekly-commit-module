// ReconciliationView — the GET /commits/{id}/reconciliation response (U13): the commit id, its
// current lifecycle state, the ordered planned-vs-actual rows, and canReconcile. Snapshot=planned,
// live=actual; each row flags pending/completed/incomplete/carried/added-after-lock. canReconcile
// is
// true only when the acting member OWNS this commit and may therefore drive the reconcile
// transitions (begin/patch/finalize) — a reading manager gets false, so the FE renders read-only.
// Mirrored by the TS type.
package com.solovis.wcm.commit.dto;

import com.solovis.wcm.commit.LifecycleState;
import java.util.List;
import java.util.UUID;

public record ReconciliationView(
    UUID commitId,
    LifecycleState lifecycleState,
    List<ReconciliationRow> rows,
    boolean canReconcile) {}
