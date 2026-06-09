// ReconciliationRow — one line of the planned-vs-actual diff (U13). plannedText/plannedTier come
// from the frozen snapshot (null for an added-after-lock row that has no plan); actualStatus is the
// live CommitItem.status (null for a planned line whose live item was deleted); flag is the
// verdict.
// commitItemId is the deterministic join key shared by plan and actual. Mirrored by the TS type.
package com.solovis.wcm.commit.dto;

import com.solovis.wcm.commit.ChessTier;
import com.solovis.wcm.commit.CommitItemStatus;
import java.util.UUID;

public record ReconciliationRow(
    UUID commitItemId,
    String plannedText,
    ChessTier plannedTier,
    UUID supportingOutcomeId,
    CommitItemStatus actualStatus,
    ReconciliationFlag flag) {}
