// CreateCommitRequest — body of POST /commits (U11). weekStart + the initial items. The optional
// memberId field exists ONLY so the controller test can prove KTD6: a client-supplied memberId is
// IGNORED — the owner is always the CurrentMemberProvider's acting member, never this field.
package com.solovis.wcm.commit.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CreateCommitRequest(
    @NotNull LocalDate weekStart,
    @Valid List<CommitItemRequest> items,
    /** IGNORED by the server (KTD6) — kept only to assert spoofing is rejected. */
    UUID memberId) {

  /** Null-safe view of the requested items. */
  public List<CommitItemRequest> safeItems() {
    return items == null ? List.of() : items;
  }
}
