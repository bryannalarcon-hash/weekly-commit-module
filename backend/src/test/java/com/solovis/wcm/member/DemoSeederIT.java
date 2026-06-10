// DemoSeederIT — @DataJpaTest proving the U6 demo seed loads deterministically and idempotently.
// Uses the shared WcmPostgresContainer; the demo-profile CommandLineRunner seeds once at startup,
// then the test calls seed() again and asserts no duplication (idempotent). Counts are
// deterministic
// because every other IT is transactional/rolled-back, so only the seed rows persist. Verifies the
// SOLOVIS_SEED content: RCDO tree, the 14-member manager graph, sample commits across lifecycle
// states, Noah's unlinked draft item, and the FSM invariants on seeded data — a frozen snapshot for
// every post-LOCK commit and a REVIEWED ManagerReview for the RECONCILED one. Imports JpaConfig so
// @CreatedBy populates created_by.
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
import com.solovis.wcm.review.ReviewState;
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
@ActiveProfiles("demo")
@Import({DemoSeeder.class, RcdoRepository.class, JpaConfig.class})
class DemoSeederIT {

  @DynamicPropertySource
  static void datasourceProperties(DynamicPropertyRegistry registry) {
    WcmPostgresContainer.registerDatasource(registry);
  }

  @Autowired private DemoSeeder seeder;
  @Autowired private MemberRepository members;
  @Autowired private TeamRepository teams;
  @Autowired private RcdoRepository rcdo;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository commitItems;
  @Autowired private CommitSnapshotRepository snapshots;
  @Autowired private ManagerReviewRepository reviews;

  @Test
  void seedsDeterministicallyAndIsIdempotent() {
    // The demo CommandLineRunner already seeded at startup; this call must be a clean no-op.
    seeder.seed();

    long membersAfterFirst = members.count();
    long teamsAfterFirst = teams.count();
    long commitsAfterFirst = commits.count();

    // 14 members (1 exec + 4 line managers + 9 ICs) across 5 teams (SOLOVIS_SEED manager graph).
    assertThat(membersAfterFirst).isEqualTo(14);
    assertThat(teamsAfterFirst).isEqualTo(5);

    // Deterministic ids resolve known rows; full RCDO leaf set present (>= 18 supporting outcomes).
    assertThat(members.findById(DemoSeeder.deterministicId("member:diego"))).isPresent();
    assertThat(rcdo.findAllSupportingOutcomes()).hasSizeGreaterThanOrEqualTo(18);

    // The manager graph is queryable: Marcus Hale manages Lena + Raj.
    UUID marcus = DemoSeeder.deterministicId("member:marcus");
    assertThat(members.findByManagerId(marcus))
        .extracting(Member::getDisplayName)
        .contains("Lena Vogt", "Raj Patel");

    // Sample commits span the lifecycle states.
    assertThat(commits.findAll())
        .extracting(WeeklyCommit::getLifecycleState)
        .contains(
            LifecycleState.RECONCILED,
            LifecycleState.LOCKED,
            LifecycleState.DRAFT,
            LifecycleState.RECONCILING);

    // Tom's draft has exactly one UNLINKED item (to demo the submit guard, KTD5).
    UUID tomCommit = DemoSeeder.deterministicId("commit:tom");
    assertThat(commitItems.findByWeeklyCommitId(tomCommit))
        .filteredOn(ci -> ci.getSupportingOutcomeId() == null)
        .hasSize(1);

    // FSM invariants on seeded data: post-LOCK commits carry a frozen snapshot; RECONCILED carries
    // a REVIEWED ManagerReview; the DRAFT (Tom) has neither. The LOCKED/DRAFT weeks are owned by
    // Priya's reports (Sana/Tom) so the demo personas + the manager queue populate.
    UUID diego = DemoSeeder.deterministicId("commit:diego");
    UUID sana = DemoSeeder.deterministicId("commit:sana");
    UUID omar = DemoSeeder.deterministicId("commit:omar");
    assertThat(snapshots.findByWeeklyCommitId(diego)).isPresent();
    assertThat(snapshots.findByWeeklyCommitId(sana)).isPresent();
    assertThat(snapshots.findByWeeklyCommitId(omar)).isPresent();
    assertThat(snapshots.findByWeeklyCommitId(tomCommit)).isEmpty();
    // RECONCILED Diego has a REVIEWED review (the manager reviewed it AFTER the IC reconciled).
    assertThat(reviews.findByWeeklyCommitId(diego))
        .get()
        .extracting(r -> r.getState())
        .isEqualTo(ReviewState.REVIEWED);
    // RECONCILING Omar has NO review: the IC is still reconciling, the manager reviews only after.
    assertThat(reviews.findByWeeklyCommitId(omar)).isEmpty();

    // Second explicit run is also a no-op: counts unchanged.
    seeder.seed();
    assertThat(members.count()).isEqualTo(membersAfterFirst);
    assertThat(teams.count()).isEqualTo(teamsAfterFirst);
    assertThat(commits.count()).isEqualTo(commitsAfterFirst);
  }
}
