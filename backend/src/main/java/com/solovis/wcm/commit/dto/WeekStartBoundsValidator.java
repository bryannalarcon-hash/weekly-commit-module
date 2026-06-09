// WeekStartBoundsValidator — backs @WeekStartBounds (deferred fix). Accepts a null date (let
// @NotNull own presence) and any date within [now - maxWeeksInPast, now + maxWeeksInFuture];
// rejects
// absurd far-past/far-future weekStarts. "now" is read from a Clock so the bound is testable; the
// default Clock is system-UTC. Stateless and thread-safe (one instance reused by the validator).
package com.solovis.wcm.commit.dto;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.Clock;
import java.time.LocalDate;

public class WeekStartBoundsValidator implements ConstraintValidator<WeekStartBounds, LocalDate> {

  private final Clock clock;
  private int maxWeeksInPast;
  private int maxWeeksInFuture;

  public WeekStartBoundsValidator() {
    this(Clock.systemUTC());
  }

  // Visible for tests: inject a fixed Clock to assert the boundary deterministically.
  WeekStartBoundsValidator(Clock clock) {
    this.clock = clock;
  }

  @Override
  public void initialize(WeekStartBounds annotation) {
    this.maxWeeksInPast = annotation.maxWeeksInPast();
    this.maxWeeksInFuture = annotation.maxWeeksInFuture();
  }

  @Override
  public boolean isValid(LocalDate value, ConstraintValidatorContext context) {
    if (value == null) {
      return true; // presence is @NotNull's job
    }
    LocalDate today = LocalDate.now(clock);
    LocalDate earliest = today.minusWeeks(maxWeeksInPast);
    LocalDate latest = today.plusWeeks(maxWeeksInFuture);
    return !value.isBefore(earliest) && !value.isAfter(latest);
  }
}
