// MemberAccountDto — the acting member's profile shown on the Settings > Account tab.
// Response of GET/PUT /api/settings/account: id, email (read-only), displayName, the preferred
// IANA timezone (nullable), managerName (the manager's displayName resolved from the managerId
// self-FK; null for a top-of-graph member), canReview (whether the member acts as a
// reviewer/MANAGER), and canEditRcdo (whether the member holds MANAGER_SCOPE /
// SCOPE_reconcile:commits, gating the FE's RCDO "Edit tree" mode — any MANAGER may edit the
// shared strategy tree).
package com.solovis.wcm.settings.dto;

import java.util.UUID;

public record MemberAccountDto(
    UUID id,
    String email,
    String displayName,
    String timezone,
    String managerName,
    boolean canReview,
    boolean canEditRcdo) {}
