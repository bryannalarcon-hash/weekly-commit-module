// RollupRow — one report's roll-up metrics for a manager dashboard (U14). Per direct report:
// commit counts, completionPct (COMPLETE / total reconciled items), carryOverRate (CARRIED_FORWARD
// / total items) and rcdoAlignmentPct (items linked to a resolvable RCDO SupportingOutcome /
// total).
// Percentages are 0..100 doubles. Mirrored by the TS RollupRow.
package com.solovis.wcm.review.dto;

import java.util.UUID;

public record RollupRow(
    UUID memberId,
    String memberName,
    int commitCount,
    int itemCount,
    double completionPct,
    double carryOverRate,
    double rcdoAlignmentPct) {}
