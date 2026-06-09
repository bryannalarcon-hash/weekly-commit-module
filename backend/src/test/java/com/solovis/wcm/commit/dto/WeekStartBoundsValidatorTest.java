// WeekStartBoundsValidatorTest — pure unit test for the deferred weekStart-bounds fix. Pins a fixed
// Clock and asserts: today/in-window dates pass; far-past and far-future dates fail; null defers to
// @NotNull (passes here). No Spring/DB — the validator is constructed directly with a test Clock.
package com.solovis.wcm.commit.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class WeekStartBoundsValidatorTest {

  private static final LocalDate TODAY = LocalDate.parse("2026-06-08");
  private final Clock fixed =
      Clock.fixed(TODAY.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);

  private WeekStartBoundsValidator validator() {
    WeekStartBoundsValidator v = new WeekStartBoundsValidator(fixed);
    v.initialize(defaults());
    return v;
  }

  @Test
  void acceptsTodayAndDatesInsideTheWindow() {
    WeekStartBoundsValidator v = validator();
    assertThat(v.isValid(TODAY, null)).isTrue();
    assertThat(v.isValid(TODAY.plusWeeks(4), null)).isTrue();
    assertThat(v.isValid(TODAY.minusWeeks(4), null)).isTrue();
  }

  @Test
  void rejectsAbsurdFarFutureAndFarPast() {
    WeekStartBoundsValidator v = validator();
    assertThat(v.isValid(LocalDate.parse("3000-01-06"), null)).isFalse();
    assertThat(v.isValid(LocalDate.parse("1990-01-01"), null)).isFalse();
  }

  @Test
  void nullDefersToNotNull() {
    assertThat(validator().isValid(null, null)).isTrue();
  }

  @Test
  void boundariesAreInclusive() {
    WeekStartBoundsValidator v = validator();
    assertThat(v.isValid(TODAY.plusWeeks(104), null)).isTrue(); // latest allowed
    assertThat(v.isValid(TODAY.plusWeeks(104).plusDays(1), null)).isFalse();
    assertThat(v.isValid(TODAY.minusWeeks(260), null)).isTrue(); // earliest allowed
    assertThat(v.isValid(TODAY.minusWeeks(260).minusDays(1), null)).isFalse();
  }

  /** A @WeekStartBounds instance carrying the annotation defaults (260 past / 104 future). */
  private static WeekStartBounds defaults() {
    return new WeekStartBounds() {
      @Override
      public Class<? extends java.lang.annotation.Annotation> annotationType() {
        return WeekStartBounds.class;
      }

      @Override
      public int maxWeeksInPast() {
        return 260;
      }

      @Override
      public int maxWeeksInFuture() {
        return 104;
      }

      @Override
      public String message() {
        return "weekStart is outside the allowed range";
      }

      @Override
      public Class<?>[] groups() {
        return new Class<?>[0];
      }

      @Override
      public Class<? extends jakarta.validation.Payload>[] payload() {
        return uncheckedEmpty();
      }

      @SuppressWarnings("unchecked")
      private Class<? extends jakarta.validation.Payload>[] uncheckedEmpty() {
        return (Class<? extends jakarta.validation.Payload>[]) new Class<?>[0];
      }
    };
  }
}
