// RcdoControllerIT — MockMvc tests for the RCDO browse/picker endpoints (U12), full stack against
// Testcontainers Postgres. The strategy tree is confidential, so these routes require
// authentication (U15): every browse request carries a valid bearer token, and an unauthenticated
// request is rejected with 401. Proves: GET /rcdo/tree returns the nested 4 levels (RallyCry ->
// DefiningObjective -> Outcome -> SupportingOutcome); GET /rcdo/supporting-outcomes?q= filters by a
// case-insensitive title substring; an empty/blank query returns every leaf; no token -> 401.
package com.solovis.wcm.rcdo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.common.TestJwtConfig;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

class RcdoControllerIT extends AbstractWebIT {

  @Autowired private RcdoRepository rcdo;

  /** Any valid bearer token (the RCDO routes need authentication, not a specific identity). */
  private RequestPostProcessor authed() {
    return TestJwtConfig.employee("auth0|rcdo-" + UUID.randomUUID(), "rcdo@solovis.test");
  }

  /** Seed a single 4-level path with two distinctly-named leaves under one outcome. */
  private void seedTree(String tag) {
    var rally = rcdo.save(RallyCry.builder().title("Rally " + tag).build());
    var objective =
        rcdo.save(
            DefiningObjective.builder()
                .rallyCryId(rally.getId())
                .title("Objective " + tag)
                .build());
    var outcome =
        rcdo.save(
            Outcome.builder()
                .definingObjectiveId(objective.getId())
                .title("Outcome " + tag)
                .build());
    rcdo.save(
        SupportingOutcome.builder().outcomeId(outcome.getId()).title("Ingest PCAP " + tag).build());
    rcdo.save(
        SupportingOutcome.builder()
            .outcomeId(outcome.getId())
            .title("Normalize holdings " + tag)
            .build());
  }

  @Test
  void treeReturnsFourNestedLevels() throws Exception {
    String tag = UUID.randomUUID().toString().substring(0, 8);
    seedTree(tag);

    mockMvc
        .perform(get("/api/rcdo/tree").with(authed()))
        .andExpect(status().isOk())
        // Four nesting levels are present and reachable.
        .andExpect(
            jsonPath(
                    "$[?(@.title=='Rally %s')].definingObjectives[0].outcomes[0].supportingOutcomes"
                        .formatted(tag))
                .exists());
  }

  @Test
  void supportingOutcomesFilterIsCaseInsensitiveSubstring() throws Exception {
    String tag = UUID.randomUUID().toString().substring(0, 8);
    seedTree(tag);

    mockMvc
        .perform(
            get("/api/rcdo/supporting-outcomes").param("q", "ingest pcap " + tag).with(authed()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].title").value("Ingest PCAP " + tag));
  }

  @Test
  void blankQueryReturnsAllLeaves() throws Exception {
    String tag = UUID.randomUUID().toString().substring(0, 8);
    seedTree(tag);

    mockMvc
        .perform(get("/api/rcdo/supporting-outcomes").with(authed()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[?(@.title=='Ingest PCAP %s')]".formatted(tag)).exists())
        .andExpect(jsonPath("$[?(@.title=='Normalize holdings %s')]".formatted(tag)).exists());
  }

  @Test
  void unauthenticatedTreeIsUnauthorized() throws Exception {
    // The RCDO strategy tree is confidential: no bearer token -> 401 (U12).
    mockMvc.perform(get("/api/rcdo/tree")).andExpect(status().isUnauthorized());
  }
}
