// PulseRequest — body of PUT /commits/{id}/pulse (U19 thin Pulse): a required 1..5 rating, an
// optional comment, and whether the comment is private to the manager. Mirrors the TS PulseRequest.
package com.solovis.wcm.commit.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record PulseRequest(
    @NotNull @Min(1) @Max(5) Integer rating, String comment, Boolean privateToManager) {

  /** Null-safe accessor for the optional private flag (defaults to false). */
  public boolean privateOrFalse() {
    return Boolean.TRUE.equals(privateToManager);
  }
}
