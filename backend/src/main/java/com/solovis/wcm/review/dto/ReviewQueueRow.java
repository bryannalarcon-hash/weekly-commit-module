// ReviewQueueRow — one report's submission status for a manager's review queue in a selected week
// (U21). Per direct report: their commit for that week (null when not started), its lifecycle
// state,
// whether it is overdue (DRAFT past its Friday), item/completed counts, and the manager-review
// state.
// Mirrors the TS ReviewQueueRow 1:1.
package com.solovis.wcm.review.dto;

import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.review.ReviewState;
import java.util.UUID;

public record ReviewQueueRow(
    UUID memberId,
    String memberName,
    UUID commitId,
    LifecycleState lifecycleState,
    boolean overdue,
    int itemCount,
    int completedCount,
    ReviewState reviewState) {}
