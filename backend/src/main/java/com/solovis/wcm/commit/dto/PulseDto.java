// PulseDto — wire shape of a weekly Pulse reading (U19 thin Pulse): a 1..5 rating (null when not
// yet
// rated), an optional comment, and a manager-private flag. Response of GET/PUT /commits/{id}/pulse.
// Mirrors the TS PulseDto. Maps the PulseReading entity's `score`/`commentPrivate` to
// rating/private.
package com.solovis.wcm.commit.dto;

import com.solovis.wcm.commit.PulseReading;

public record PulseDto(Integer rating, String comment, boolean privateToManager) {

  /** The empty reading the screen shows before a member rates the week. */
  public static PulseDto empty() {
    return new PulseDto(null, null, false);
  }

  public static PulseDto from(PulseReading reading) {
    return new PulseDto((int) reading.getScore(), reading.getComment(), reading.isCommentPrivate());
  }
}
