// UpdateCommitRequest — body of PUT /commits/{id} (U11). Replaces the commit's item set with the
// supplied items (full-replace semantics keep the FE simple). Allowed only while DRAFT; a content
// edit to a LOCKED commit is a 409 (status edits go through the U13 reconciliation path).
package com.solovis.wcm.commit.dto;

import jakarta.validation.Valid;
import java.util.List;

public record UpdateCommitRequest(@Valid List<CommitItemRequest> items) {

  /** Null-safe view of the requested items. */
  public List<CommitItemRequest> safeItems() {
    return items == null ? List.of() : items;
  }
}
