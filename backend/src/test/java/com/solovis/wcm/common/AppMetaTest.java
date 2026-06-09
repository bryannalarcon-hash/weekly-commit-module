// AppMetaTest — fast unit test exercising the AppMeta entity's accessors.
// Runs under surefire so jacoco records AppMeta as a covered, included class (non-vacuous gate).
package com.solovis.wcm.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class AppMetaTest {

  @Test
  void accessorsRoundTrip() {
    UUID id = UUID.randomUUID();
    AppMeta meta = new AppMeta();
    meta.setId(id);
    meta.setLabel("weekly-commit");

    assertThat(meta.getId()).isEqualTo(id);
    assertThat(meta.getLabel()).isEqualTo("weekly-commit");
  }

  @Test
  void factoryAndDescribeCoverBothBranches() {
    AppMeta labeled = AppMeta.of("weekly-commit");
    assertThat(labeled.getLabel()).isEqualTo("weekly-commit");
    assertThat(labeled.describe()).isEqualTo("app_meta(weekly-commit)");

    AppMeta blank = AppMeta.of("   ");
    assertThat(blank.describe()).isEqualTo("app_meta(unlabeled)");

    AppMeta nullLabel = new AppMeta();
    assertThat(nullLabel.describe()).isEqualTo("app_meta(unlabeled)");
  }
}
