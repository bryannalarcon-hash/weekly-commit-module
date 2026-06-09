// PulseRequest — body of PUT /commits/{id}/pulse (U19 thin Pulse): a required 1..5 rating, an
// optional comment (bounded to the pulse_reading.comment varchar(2000) column so an over-length
// comment is rejected up front as a 400 validation_failed rather than failing as a 409 DB
// constraint_violation), and whether the comment is private to the manager. Mirrors the TS
// PulseRequest.
package com.solovis.wcm.commit.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PulseRequest(
    @NotNull @Min(1) @Max(5) Integer rating,
    @Size(max = 2000, message = "must be at most 2000 characters") String comment,
    Boolean privateToManager) {

  /** Null-safe accessor for the optional private flag (defaults to false). */
  public boolean privateOrFalse() {
    return Boolean.TRUE.equals(privateToManager);
  }
}
