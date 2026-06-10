// MemberAccountDto — the acting member's profile shown on the Settings > Account tab.
// Response of GET/PUT /api/settings/account: id, email (read-only), displayName, the preferred
// IANA timezone (nullable), canReview (whether the member acts as a reviewer/MANAGER), and
// canEditRcdo (whether the member holds the admin:rcdo scope, gating the FE's RCDO edit mode).
package com.solovis.wcm.settings.dto;

import java.util.UUID;

public record MemberAccountDto(
    UUID id,
    String email,
    String displayName,
    String timezone,
    boolean canReview,
    boolean canEditRcdo) {}
