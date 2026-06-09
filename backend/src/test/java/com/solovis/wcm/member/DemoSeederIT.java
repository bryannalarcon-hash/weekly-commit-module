// DemoSeederIT — @DataJpaTest proving the U6 demo seed loads deterministically and idempotently.
// Uses the shared WcmPostgresContainer; the demo-profile CommandLineRunner seeds once at startup,
// then the test calls seed() again and asserts no duplication (idempotent). Counts are
// deterministic
// because every other IT is transactional/rolled-back, so only the seed rows persist. Verifies the
// SOLOVIS_SEED content: RCDO tree, the 14-member manager graph, sample commits across lifecycle
// states, and Noah's unlinked draft item. Imports JpaConfig so @CreatedBy populates created_by.
package com.solovis.wcm.member;

import static org.assertj.core.api.Assertions.assertThat;

import com.solovis.wcm.WcmPostgresContainer;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.JpaConfig;
import com.solovis.wcm.rcdo.RcdoRepository;
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

    // Noah's draft has exactly one UNLINKED item (to demo the submit guard, KTD5).
    UUID noahCommit = DemoSeeder.deterministicId("commit:noah");
    assertThat(commitItems.findByWeeklyCommitId(noahCommit))
        .filteredOn(ci -> ci.getSupportingOutcomeId() == null)
        .hasSize(1);

    // Second explicit run is also a no-op: counts unchanged.
    seeder.seed();
    assertThat(members.count()).isEqualTo(membersAfterFirst);
    assertThat(teams.count()).isEqualTo(teamsAfterFirst);
    assertThat(commits.count()).isEqualTo(commitsAfterFirst);
  }
}
