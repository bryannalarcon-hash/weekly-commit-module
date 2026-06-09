// WeekStartMondayRuleTest — pure unit test for the Monday-only weekStart rule (findings #2/#3/#5)
// and the precise message templates (#13). Pins a fixed Clock (so the bounds check is
// deterministic)
// and a captured-template ConstraintValidatorContext mock to assert: a non-Monday in-window date is
// rejected with "must be a Monday (the start of the ISO week)"; an out-of-window date is rejected
// with "is outside the allowed range"; neither template begins with "weekStart" (so the rendered
// 400 detail does not double the field name). No Spring/DB — the validator is built with a test
// Clock.
package com.solovis.wcm.commit.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.ConstraintValidatorContext.ConstraintViolationBuilder;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class WeekStartMondayRuleTest {

  // 2026-06-08 is a Monday; +/- whole weeks stay Mondays.
  private static final LocalDate MONDAY = LocalDate.parse("2026-06-08");
  private final Clock fixed =
      Clock.fixed(MONDAY.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);

  private WeekStartBoundsValidator validator() {
    WeekStartBoundsValidator v = new WeekStartBoundsValidator(fixed);
    v.initialize(defaults());
    return v;
  }

  @Test
  void acceptsAMondayInsideTheWindow() {
    assertThat(validator().isValid(MONDAY, ctx(new ArrayList<>()))).isTrue();
    assertThat(validator().isValid(MONDAY.plusWeeks(4), ctx(new ArrayList<>()))).isTrue();
    assertThat(MONDAY.plusWeeks(4).getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
  }

  @Test
  void rejectsANonMondayInsideTheWindowWithTheMondayMessage() {
    LocalDate tuesday = MONDAY.plusDays(1);
    assertThat(tuesday.getDayOfWeek()).isEqualTo(DayOfWeek.TUESDAY);
    List<String> templates = new ArrayList<>();

    assertThat(validator().isValid(tuesday, ctx(templates))).isFalse();

    assertThat(templates).containsExactly("must be a Monday (the start of the ISO week)");
  }

  @Test
  void everyNonMondayWeekdayIsRejected() {
    for (int offset = 1; offset <= 6; offset++) {
      LocalDate notMonday = MONDAY.plusDays(offset);
      assertThat(notMonday.getDayOfWeek()).isNotEqualTo(DayOfWeek.MONDAY);
      assertThat(validator().isValid(notMonday, ctx(new ArrayList<>())))
          .as("weekday %s must be rejected", notMonday.getDayOfWeek())
          .isFalse();
    }
  }

  @Test
  void rejectsAnOutOfWindowDateWithTheRangeMessage() {
    // A Monday far in the future fails the bounds check (not the Monday check).
    LocalDate farFutureMonday = MONDAY.plusWeeks(104).plusWeeks(1);
    assertThat(farFutureMonday.getDayOfWeek()).isEqualTo(DayOfWeek.MONDAY);
    List<String> templates = new ArrayList<>();

    assertThat(validator().isValid(farFutureMonday, ctx(templates))).isFalse();

    assertThat(templates).containsExactly("is outside the allowed range");
  }

  @Test
  void neitherMessageTemplateBeginsWithWeekStart() throws Exception {
    // Finding #13: ApiExceptionHandler prepends the field name; a template starting with
    // "weekStart"
    // would render "weekStart weekStart ...". Guard the REAL annotation default + both context
    // templates the validator builds.
    String annotationDefault =
        (String) WeekStartBounds.class.getMethod("message").getDefaultValue();
    assertThat(annotationDefault).doesNotStartWith("weekStart");

    List<String> mondayTemplate = new ArrayList<>();
    validator().isValid(MONDAY.plusDays(1), ctx(mondayTemplate));
    assertThat(mondayTemplate.get(0)).doesNotStartWith("weekStart");

    List<String> rangeTemplate = new ArrayList<>();
    validator().isValid(MONDAY.plusWeeks(105), ctx(rangeTemplate));
    assertThat(rangeTemplate.get(0)).doesNotStartWith("weekStart");
  }

  @Test
  void nullStillDefersToNotNull() {
    assertThat(validator().isValid(null, ctx(new ArrayList<>()))).isTrue();
  }

  /**
   * A ConstraintValidatorContext that records every buildConstraintViolationWithTemplate(...) call
   * into {@code sink}, so a test can assert which message template the validator chose.
   */
  private static ConstraintValidatorContext ctx(List<String> sink) {
    ConstraintValidatorContext context = mock(ConstraintValidatorContext.class);
    ConstraintViolationBuilder builder = mock(ConstraintViolationBuilder.class);
    when(context.buildConstraintViolationWithTemplate(org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(
            inv -> {
              sink.add(inv.getArgument(0));
              return builder;
            });
    return context;
  }

  /** A @WeekStartBounds carrying the annotation defaults (260 past / 104 future). */
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
        return "is outside the allowed range";
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
