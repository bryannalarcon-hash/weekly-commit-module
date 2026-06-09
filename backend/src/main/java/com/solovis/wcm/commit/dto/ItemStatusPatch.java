// ItemStatusPatch — body of PATCH /commits/{id}/items/{itemId}/status (U13). Carries the new ACTUAL
// status ONLY (never plan content). Allowed solely while the commit is RECONCILING; the FSM guard
// rejects it (-> 409) in any other state, keeping the frozen plan immutable.
package com.solovis.wcm.commit.dto;

import com.solovis.wcm.commit.CommitItemStatus;
import jakarta.validation.constraints.NotNull;

public record ItemStatusPatch(@NotNull CommitItemStatus status) {}
