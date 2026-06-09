# reconciliation.feature — the planned(snapshot)-vs-actual diff through the LIVE federated app (FR4).
# A reconciling week (Omar, seeded RECONCILING with a planned-vs-actual gap) shows each item's planned
# plan frozen at lock against its live actual status, flagging completed / incomplete, and an item
# added after lock is flagged ADDED_AFTER_LOCK. The owner records an actual and the diff updates.
Feature: Reconciliation planned-vs-actual

  Background:
    Given the demo data is reset

  Scenario: Reconciliation view shows planned vs actual with completed and incomplete flags
    Given the employee "omar@solovis.test" opens their reconciling week
    Then the reconciliation view lists the planned items
    And one item is flagged completed
    And one item is flagged incomplete

  Scenario: An item added after lock is flagged as added-after-lock
    Given the employee "omar@solovis.test" has an item added after lock
    When the employee "omar@solovis.test" opens their reconciling week
    Then an item is flagged as added after lock
