# weekly-commit-lifecycle.feature — the full weekly-commit lifecycle through the LIVE federated app
# (host-shell loading wc-remote over Module Federation, real Spring Boot backend, hermetic auth).
# Covers FR1–FR4: an employee drafts → links each item to an RCDO Supporting Outcome → sets chess
# tiers → submits to LOCKED (read-only); the owner's manager opens reconciliation; the owner records
# actuals; the manager marks reviewed → RECONCILED; carry-forward copies the unfinished item forward.
Feature: Weekly commit lifecycle

  Background:
    Given the demo data is reset

  Scenario: Employee drafts and locks a weekly commit linked to RCDO outcomes
    Given the employee "sana@solovis.test" opens the Weekly Commit app
    When they start a new week
    And they add a commit item "Normalize custodian feeds"
    And they link item 1 to a Supporting Outcome
    And they set item 1 chess tier to "KING"
    And they submit and lock the week
    Then the week is "LOCKED"
    And the locked week is read-only

  Scenario: Manager reconciles a locked week to RECONCILED and the owner carries forward
    Given the employee "sana@solovis.test" has a locked week with one completed and one incomplete item
    When the manager "priya@solovis.test" starts reconciliation for that week
    And the owner marks the first item complete and the second item incomplete
    And the manager marks the week reviewed
    Then the week is "RECONCILED"
    When the owner carries the unfinished work forward
    Then a new draft week is created carrying 1 item forward
