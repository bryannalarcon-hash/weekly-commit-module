// WeekStartBounds — a Bean Validation constraint on a weekly-commit weekStart. Enforces TWO rules:
// (1) the date must be a Monday (the ISO week start) so "one commit per member per week" cannot be
// bypassed by posting an in-week date; (2) it must fall within a sane window around "now" (rejects
// absurd far-past / far-future dates). Validation lives in WeekStartBoundsValidator, which builds a
// precise per-rule message; a violation surfaces as a 400 (MethodArgumentNotValidException ->
// ApiExceptionHandler). Messages deliberately do NOT begin with "weekStart" (the handler prepends
// the field name, so a "weekStart"-prefixed message would render the field name twice).
package com.solovis.wcm.commit.dto;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = WeekStartBoundsValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface WeekStartBounds {

  /** How many weeks into the PAST a weekStart may be (default ~5 years). */
  int maxWeeksInPast() default 260;

  /** How many weeks into the FUTURE a weekStart may be (default ~2 years). */
  int maxWeeksInFuture() default 104;

  // Must NOT begin with "weekStart": the handler prepends the field name (finding #13). This is the
  // fallback message; the validator overrides it per-rule via the ConstraintValidatorContext.
  String message() default "is outside the allowed range";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};
}
