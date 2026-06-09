// RcdoRepositoryIT — @DataJpaTest proving U7 RCDO hierarchy persistence and constraints.
// Covers: a full RallyCry->...->SupportingOutcome tree round-trips and is tree-walkable; the parent
// FKs are NOT NULL (a DefiningObjective/Outcome/SupportingOutcome without a parent is rejected).
package com.solovis.wcm.rcdo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.solovis.wcm.AbstractPersistenceIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

@Import(RcdoRepository.class)
class RcdoRepositoryIT extends AbstractPersistenceIT {

  @Autowired private RcdoRepository rcdo;
  @Autowired private DefiningObjectiveRepository objectives;
  @Autowired private OutcomeRepository outcomes;
  @Autowired private SupportingOutcomeRepository supportingOutcomes;

  @Test
  void fullTreePersistsAndIsWalkable() {
    RallyCry rally = rcdo.save(RallyCry.builder().title("Win the year").build());
    DefiningObjective objective =
        rcdo.save(
            DefiningObjective.builder().rallyCryId(rally.getId()).title("Unify markets").build());
    Outcome outcome =
        rcdo.save(
            Outcome.builder()
                .definingObjectiveId(objective.getId())
                .title("Single source of truth")
                .build());
    SupportingOutcome leaf =
        rcdo.save(
            SupportingOutcome.builder()
                .outcomeId(outcome.getId())
                .title("Ingest PCAP statements")
                .build());

    assertThat(rcdo.findObjectives(rally.getId()))
        .extracting(DefiningObjective::getId)
        .contains(objective.getId());
    assertThat(rcdo.findOutcomes(objective.getId()))
        .extracting(Outcome::getId)
        .contains(outcome.getId());
    assertThat(rcdo.findSupportingOutcomes(outcome.getId()))
        .extracting(SupportingOutcome::getId)
        .contains(leaf.getId());
    assertThat(rcdo.findSupportingOutcome(leaf.getId())).isPresent();
  }

  @Test
  void definingObjectiveRequiresARallyCryParent() {
    assertThatThrownBy(
            () -> objectives.saveAndFlush(DefiningObjective.builder().title("orphan").build()))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void outcomeRequiresADefiningObjectiveParent() {
    assertThatThrownBy(() -> outcomes.saveAndFlush(Outcome.builder().title("orphan").build()))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void supportingOutcomeRequiresAnOutcomeParent() {
    assertThatThrownBy(
            () ->
                supportingOutcomes.saveAndFlush(
                    SupportingOutcome.builder().title("orphan").build()))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void emptyTreeIsValid() {
    RallyCry rally = rcdo.save(RallyCry.builder().title("Lonely rally").build());
    assertThat(rcdo.findObjectives(rally.getId())).isEmpty();
  }
}
