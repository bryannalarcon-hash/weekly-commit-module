// ReconciliationView — the GET /commits/{id}/reconciliation response (U13): the commit id, its
// current lifecycle state, and the ordered planned-vs-actual rows. Snapshot=planned, live=actual;
// each row flags completed/incomplete/carried/added-after-lock. Mirrored by the TS type.
package com.solovis.wcm.commit.dto;

import com.solovis.wcm.commit.LifecycleState;
import java.util.List;
import java.util.UUID;

public record ReconciliationView(
    UUID commitId, LifecycleState lifecycleState, List<ReconciliationRow> rows) {}
