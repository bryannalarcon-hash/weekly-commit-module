// WeekStartBoundsValidator — backs @WeekStartBounds. Accepts a null date (let @NotNull own
// presence)
// then enforces, in order: (1) the date is a Monday (the ISO week start) — else reject with "must
// be
// a Monday (the start of the ISO week)"; (2) it lies within [now - maxWeeksInPast, now +
// maxWeeksInFuture] — else reject with "is outside the allowed range". Each rejection replaces the
// default violation message via the ConstraintValidatorContext so the rendered 400 detail is
// precise
// (and, per finding #13, the templates never start with "weekStart" — the handler prepends that).
// "now" is read from a Clock so the bound is testable; default Clock is system-UTC.
// Stateless/thread-safe.
package com.solovis.wcm.commit.dto;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.time.Clock;
import java.time.DayOfWeek;
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
    // Rule 1: weekStart must be a Monday so the member+week unique constraint cannot be bypassed by
    // posting any in-week date (findings #2/#3/#5).
    if (value.getDayOfWeek() != DayOfWeek.MONDAY) {
      return reject(context, "must be a Monday (the start of the ISO week)");
    }
    // Rule 2: keep weekStart within a sane window around "now".
    LocalDate today = LocalDate.now(clock);
    LocalDate earliest = today.minusWeeks(maxWeeksInPast);
    LocalDate latest = today.plusWeeks(maxWeeksInFuture);
    if (value.isBefore(earliest) || value.isAfter(latest)) {
      return reject(context, "is outside the allowed range");
    }
    return true;
  }

  /**
   * Replace the default violation with a precise, field-name-free template (finding #13 — the
   * handler prepends "weekStart"). A null context is tolerated for direct unit calls.
   */
  private static boolean reject(ConstraintValidatorContext context, String template) {
    if (context != null) {
      context.disableDefaultConstraintViolation();
      context.buildConstraintViolationWithTemplate(template).addConstraintViolation();
    }
    return false;
  }
}
