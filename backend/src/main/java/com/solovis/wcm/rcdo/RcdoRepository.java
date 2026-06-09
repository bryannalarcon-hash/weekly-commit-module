// RcdoRepository — single facade over the four RCDO level repositories.
// Aggregates RallyCry/DefiningObjective/Outcome/SupportingOutcome CRUD and tree-walk helpers so
// callers (seeder, query service, admin edit-tree) hold one handle. Delegates; owns no state.
// Adds per-level findById + delete (used by the admin CRUD cascade in RcdoAdminService) on top of
// the existing save + tree-walk helpers.
package com.solovis.wcm.rcdo;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class RcdoRepository {

  private final RallyCryRepository rallyCries;
  private final DefiningObjectiveRepository definingObjectives;
  private final OutcomeRepository outcomes;
  private final SupportingOutcomeRepository supportingOutcomes;

  public RcdoRepository(
      RallyCryRepository rallyCries,
      DefiningObjectiveRepository definingObjectives,
      OutcomeRepository outcomes,
      SupportingOutcomeRepository supportingOutcomes) {
    this.rallyCries = rallyCries;
    this.definingObjectives = definingObjectives;
    this.outcomes = outcomes;
    this.supportingOutcomes = supportingOutcomes;
  }

  // saveAndFlush throughout: RCDO rows use assigned UUID FKs (not @ManyToOne), so Hibernate cannot
  // infer parent-before-child insert ordering. Flushing each level keeps the NOT NULL parent FKs
  // satisfiable when a parent and child are saved within one transaction (seeder, tests).
  public RallyCry save(RallyCry rallyCry) {
    return rallyCries.saveAndFlush(rallyCry);
  }

  public DefiningObjective save(DefiningObjective objective) {
    return definingObjectives.saveAndFlush(objective);
  }

  public Outcome save(Outcome outcome) {
    return outcomes.saveAndFlush(outcome);
  }

  public SupportingOutcome save(SupportingOutcome supportingOutcome) {
    return supportingOutcomes.saveAndFlush(supportingOutcome);
  }

  public List<RallyCry> findAllRallyCries() {
    return rallyCries.findAll();
  }

  // --- Per-level findById (admin CRUD load-then-mutate) ---------------------------------------

  public Optional<RallyCry> findRallyCry(UUID id) {
    return rallyCries.findById(id);
  }

  public Optional<DefiningObjective> findObjective(UUID id) {
    return definingObjectives.findById(id);
  }

  public Optional<Outcome> findOutcome(UUID id) {
    return outcomes.findById(id);
  }

  public Optional<SupportingOutcome> findSupportingOutcome(UUID id) {
    return supportingOutcomes.findById(id);
  }

  // --- Per-level delete (admin cascade deletes children first; see RcdoAdminService) ----------

  public void delete(RallyCry rallyCry) {
    rallyCries.delete(rallyCry);
  }

  public void delete(DefiningObjective objective) {
    definingObjectives.delete(objective);
  }

  public void delete(Outcome outcome) {
    outcomes.delete(outcome);
  }

  public void delete(SupportingOutcome supportingOutcome) {
    supportingOutcomes.delete(supportingOutcome);
  }

  public List<DefiningObjective> findObjectives(UUID rallyCryId) {
    return definingObjectives.findByRallyCryId(rallyCryId);
  }

  public List<Outcome> findOutcomes(UUID definingObjectiveId) {
    return outcomes.findByDefiningObjectiveId(definingObjectiveId);
  }

  public List<SupportingOutcome> findSupportingOutcomes(UUID outcomeId) {
    return supportingOutcomes.findByOutcomeId(outcomeId);
  }

  /** Flatten the whole tree to its leaves (every SupportingOutcome) for picker queries. */
  public List<SupportingOutcome> findAllSupportingOutcomes() {
    return supportingOutcomes.findAll();
  }
}
