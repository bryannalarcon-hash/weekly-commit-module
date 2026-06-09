// WeekStartBounds — a Bean Validation constraint bounding a weekly-commit weekStart to a sane
// window
// around "now" (deferred fix): rejects absurd far-past / far-future dates that would corrupt the
// weekly model or roll-up windows. Validation lives in WeekStartBoundsValidator; a violation
// surfaces
// as a 400 (MethodArgumentNotValidException -> ApiExceptionHandler).
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

  String message() default "weekStart is outside the allowed range";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};
}
