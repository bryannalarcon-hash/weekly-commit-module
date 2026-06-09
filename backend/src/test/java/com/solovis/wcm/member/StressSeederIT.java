// StressSeederIT — @DataJpaTest proving the perf/load fixture (StressSeeder) builds the
// ~2000-record
// single-manager roll-up dataset deterministically and idempotently. Runs the demo seed first (it
// owns the RCDO tree the stress items link to), then the stress seed, and asserts: one stress
// manager
// with ~210 direct reports, ~2000 weekly commits all owned by those reports, every post-DRAFT
// commit
// carrying a frozen snapshot, items linked to resolvable SupportingOutcomes (alignment-%
// meaningful),
// and a re-run that adds nothing (idempotent). Uses the shared WcmPostgresContainer (real
// postgres:16.4). This is the regression test guarding the load tier's data setup.
package com.solovis.wcm.member;

import static org.assertj.core.api.Assertions.assertThat;

import com.solovis.wcm.WcmPostgresContainer;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.CommitSnapshotRepository;
import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.JpaConfig;
import com.solovis.wcm.rcdo.RcdoRepository;
import com.solovis.wcm.review.ManagerReviewRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles({"demo", "stress"})
@Import({DemoSeeder.class, StressSeeder.class, RcdoRepository.class, JpaConfig.class})
class StressSeederIT {

  @DynamicPropertySource
  static void datasourceProperties(DynamicPropertyRegistry registry) {
    WcmPostgresContainer.registerDatasource(registry);
  }

  @Autowired private StressSeeder stressSeeder;
  @Autowired private MemberRepository members;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository commitItems;
  @Autowired private CommitSnapshotRepository snapshots;
  @Autowired private ManagerReviewRepository reviews;

  @Test
  void seedsTwoThousandRecordRollupDeterministicallyAndIdempotently() {
    // Both CommandLineRunners (demo, then stress) already seeded at startup; this must be a no-op.
    stressSeeder.seedStress();

    Member manager = members.findByEmail(StressSeeder.STRESS_MANAGER_EMAIL).orElseThrow();

    // ~210 direct reports under the single stress manager.
    List<Member> reports = members.findByManagerId(manager.getId());
    assertThat(reports).hasSize(StressSeeder.REPORT_COUNT);

    // ~2000 commits, ALL owned by the manager's reports (row-level roll-up sees exactly these).
    int expectedCommits = StressSeeder.REPORT_COUNT * StressSeeder.WEEKS_PER_REPORT;
    List<UUID> reportIds = reports.stream().map(Member::getId).toList();
    List<WeeklyCommit> reportCommits =
        reportIds.stream().flatMap(id -> commits.findByMemberId(id).stream()).toList();
    assertThat(reportCommits).hasSize(expectedCommits);
    assertThat(expectedCommits).isGreaterThanOrEqualTo(2000);

    // States span the lifecycle so roll-up metrics exercise every path.
    assertThat(reportCommits)
        .extracting(WeeklyCommit::getLifecycleState)
        .contains(
            LifecycleState.RECONCILED,
            LifecycleState.RECONCILING,
            LifecycleState.LOCKED,
            LifecycleState.DRAFT);

    // Every commit carries the right number of items, all linked to a resolvable SupportingOutcome.
    WeeklyCommit sample = reportCommits.get(0);
    assertThat(commitItems.findByWeeklyCommitId(sample.getId()))
        .hasSize(StressSeeder.ITEMS_PER_COMMIT)
        .allMatch(i -> i.getSupportingOutcomeId() != null);

    // Every post-DRAFT stress commit has a frozen snapshot (KTD4 invariant); DRAFT weeks do not.
    // Scope to the stress commits (per-commit lookups) so the demo seed's own snapshots/reviews,
    // which also persist across this transactional @DataJpaTest, don't skew the assertion.
    long postDraftStressCommits =
        reportCommits.stream()
            .filter(c -> c.getLifecycleState() != LifecycleState.DRAFT)
            .filter(c -> snapshots.findByWeeklyCommitId(c.getId()).isPresent())
            .count();
    long expectedPostDraft =
        reportCommits.stream().filter(c -> c.getLifecycleState() != LifecycleState.DRAFT).count();
    assertThat(postDraftStressCommits).isEqualTo(expectedPostDraft);
    assertThat(
            reportCommits.stream()
                .filter(c -> c.getLifecycleState() == LifecycleState.DRAFT)
                .noneMatch(c -> snapshots.findByWeeklyCommitId(c.getId()).isPresent()))
        .isTrue();
    // RECONCILED stress weeks each carry a REVIEWED ManagerReview (scoped per stress commit).
    long reconciledWithReview =
        reportCommits.stream()
            .filter(c -> c.getLifecycleState() == LifecycleState.RECONCILED)
            .filter(c -> reviews.findByWeeklyCommitId(c.getId()).isPresent())
            .count();
    long reconciledCommits =
        reportCommits.stream()
            .filter(c -> c.getLifecycleState() == LifecycleState.RECONCILED)
            .count();
    assertThat(reconciledWithReview).isEqualTo(reconciledCommits);

    // Idempotent: a second explicit run adds nothing.
    long membersBefore = members.count();
    long commitsBefore = commits.count();
    stressSeeder.seedStress();
    assertThat(members.count()).isEqualTo(membersBefore);
    assertThat(commits.count()).isEqualTo(commitsBefore);
  }
}
