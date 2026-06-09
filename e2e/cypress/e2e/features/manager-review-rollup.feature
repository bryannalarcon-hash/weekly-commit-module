# manager-review-rollup.feature — the manager review queue, per-report review, and the team roll-up
# dashboard through the LIVE federated app (FR5). A manager sees who submitted, opens a report's
# review, and the dashboard shows completion% / carry-over / RCDO-alignment%. The dashboard
# drill-through opens the REPORT'S REVIEW (the deferred drill-through bug — exercised + fixed here).
Feature: Manager review queue and roll-up dashboard

  Background:
    Given the demo data is reset

  Scenario: Manager sees the review queue and opens a submitted report's review
    Given the manager "marcus@solovis.test" opens the review queue
    Then the review queue lists the report "Lena Vogt"
    When the manager opens the review for "Lena Vogt"
    Then the report's review detail is shown

  Scenario: Roll-up dashboard shows metrics and drill-through opens the report review
    Given the manager "marcus@solovis.test" opens the team dashboard
    Then the dashboard shows a roll-up row for "Lena Vogt"
    And the dashboard shows an alignment percentage column
    When the manager drills through the "Lena Vogt" row
    Then the report's review detail is shown
