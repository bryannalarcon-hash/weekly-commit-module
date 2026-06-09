// StressSeeder — @Profile("stress") CommandLineRunner that bulk-loads a LARGE, single-manager
// roll-up dataset for the perf/load tier (perf/): one dedicated manager ("stress-mgr@solovis.test")
// with ~210 direct reports and ~2000 weekly commits spread across the lifecycle states, every
// post-DRAFT commit carrying a frozen CommitSnapshot. Items link to the SupportingOutcomes the
// DemoSeeder already loaded, so RCDO-alignment % is meaningful. It is DETERMINISTIC (fixed UUIDs
// via
// DemoSeeder.deterministicId) and IDEMPOTENT (no-op once the stress manager exists). It defensively
// calls demoSeeder.seed() first (idempotent) so the RCDO tree the stress items link to is present
// regardless of CommandLineRunner ordering. NOT a Flyway migration; a load-test fixture only,
// profile-gated to "stress" so it never inflates the demo/e2e/prod datasets.
package com.solovis.wcm.member;

import com.solovis.wcm.commit.ChessTier;
import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.CommitItemStatus;
import com.solovis.wcm.commit.CommitSnapshot;
import com.solovis.wcm.commit.CommitSnapshotRepository;
import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.SnapshotItem;
import com.solovis.wcm.commit.SnapshotItemRepository;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.rcdo.SupportingOutcome;
import com.solovis.wcm.rcdo.SupportingOutcomeRepository;
import com.solovis.wcm.review.ManagerReview;
import com.solovis.wcm.review.ManagerReviewRepository;
import com.solovis.wcm.review.ReviewState;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("stress")
@Order(100) // late among CommandLineRunners; also defensively re-runs the demo seed below.
public class StressSeeder implements CommandLineRunner {

  /** The single manager whose roll-up the perf tier loads. Drive k6 with X-Debug-Member = this. */
  public static final String STRESS_MANAGER_EMAIL = "stress-mgr@solovis.test";

  /** ~210 reports * ~10 weeks ≈ ~2000 commits — the brief's Pageable ≤2000 roll-up ceiling. */
  static final int REPORT_COUNT = 210;

  static final int WEEKS_PER_REPORT = 10;
  static final int ITEMS_PER_COMMIT = 4;

  private final TeamRepository teams;
  private final MemberRepository members;
  private final WeeklyCommitRepository commits;
  private final CommitItemRepository commitItems;
  private final CommitSnapshotRepository snapshots;
  private final SnapshotItemRepository snapshotItems;
  private final ManagerReviewRepository reviews;
  private final SupportingOutcomeRepository supportingOutcomes;
  private final DemoSeeder demoSeeder;

  public StressSeeder(
      TeamRepository teams,
      MemberRepository members,
      WeeklyCommitRepository commits,
      CommitItemRepository commitItems,
      CommitSnapshotRepository snapshots,
      SnapshotItemRepository snapshotItems,
      ManagerReviewRepository reviews,
      SupportingOutcomeRepository supportingOutcomes,
      DemoSeeder demoSeeder) {
    this.teams = teams;
    this.members = members;
    this.commits = commits;
    this.commitItems = commitItems;
    this.snapshots = snapshots;
    this.snapshotItems = snapshotItems;
    this.reviews = reviews;
    this.supportingOutcomes = supportingOutcomes;
    this.demoSeeder = demoSeeder;
  }

  @Override
  @Transactional
  public void run(String... args) {
    seedStress();
  }

  /** Idempotent: a no-op once the stress manager (and thus its dataset) already exists. */
  @Transactional
  public void seedStress() {
    if (members.findByEmail(STRESS_MANAGER_EMAIL).isPresent()) {
      return;
    }

    // The stress items link to the demo RCDO tree, so guarantee it exists first. demoSeeder.seed()
    // is idempotent (no-op when already loaded), removing any CommandLineRunner-ordering
    // dependency.
    demoSeeder.seed();

    // SupportingOutcomes from the demo seed — items link round-robin so alignment % is meaningful.
    List<UUID> outcomeIds =
        supportingOutcomes.findAll().stream().map(SupportingOutcome::getId).toList();
    if (outcomeIds.isEmpty()) {
      throw new IllegalStateException(
          "stress seed requires the demo RCDO tree; run with profiles demo,stress");
    }

    Team stressTeam =
        teams.saveAndFlush(
            Team.builder()
                .id(id("stress:team"))
                .name("Stress Load Team")
                .type(TeamType.DEPARTMENT)
                .parentTeamId(null)
                .build());

    Member manager =
        members.saveAndFlush(
            Member.builder()
                .id(id("stress:manager"))
                .email(STRESS_MANAGER_EMAIL)
                .displayName("Stress Manager")
                .title("Load Test Manager")
                .managerId(null)
                .role(MemberRole.MANAGER)
                .auth0Subject("auth0|seed-stress-mgr")
                .teamId(stressTeam.getId())
                .build());

    LocalDate baseWeek =
        LocalDate.now().with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
    Instant lockedAt = Instant.parse("2026-06-01T09:00:00Z");

    // Batch the inserts so ~2000 commits + ~8000 items don't flush row-by-row.
    List<Member> reportBatch = new ArrayList<>();
    for (int r = 0; r < REPORT_COUNT; r++) {
      reportBatch.add(
          Member.builder()
              .id(id("stress:report:" + r))
              .email("stress-report-" + r + "@solovis.test")
              .displayName(String.format("Stress Report %03d", r))
              .title("Stress IC")
              .managerId(manager.getId())
              .role(MemberRole.EMPLOYEE)
              .auth0Subject("auth0|seed-stress-report-" + r)
              .teamId(stressTeam.getId())
              .build());
    }
    members.saveAll(reportBatch);
    members.flush();

    List<WeeklyCommit> commitBatch = new ArrayList<>();
    List<CommitItem> itemBatch = new ArrayList<>();
    List<CommitSnapshot> snapshotBatch = new ArrayList<>();
    List<SnapshotItem> snapshotItemBatch = new ArrayList<>();
    List<ManagerReview> reviewBatch = new ArrayList<>();

    int outcomeCursor = 0;
    for (int r = 0; r < REPORT_COUNT; r++) {
      Member report = reportBatch.get(r);
      for (int w = 0; w < WEEKS_PER_REPORT; w++) {
        // Each report's weeks are distinct (UNIQUE(member, week_start)); newest is week 0.
        LocalDate week = baseWeek.minusWeeks(w);
        LifecycleState state = stateFor(w);
        UUID commitId = id("stress:commit:" + r + ":" + w);

        commitBatch.add(
            WeeklyCommit.builder()
                .id(commitId)
                .memberId(report.getId())
                .weekStart(week)
                .lifecycleState(state)
                .build());

        List<CommitItem> theseItems = new ArrayList<>(ITEMS_PER_COMMIT);
        for (int i = 0; i < ITEMS_PER_COMMIT; i++) {
          UUID outcomeId = outcomeIds.get(outcomeCursor++ % outcomeIds.size());
          CommitItem item =
              CommitItem.builder()
                  .id(id("stress:item:" + r + ":" + w + ":" + i))
                  .weeklyCommitId(commitId)
                  .text("Stress item r" + r + " w" + w + " i" + i)
                  .status(statusFor(state, i))
                  .supportingOutcomeId(outcomeId)
                  .chessTier(ChessTier.values()[i % ChessTier.values().length])
                  .build();
          theseItems.add(item);
          itemBatch.add(item);
        }

        // Post-DRAFT commits carry a frozen snapshot (KTD4 invariant), and RECONCILED ones a
        // review.
        if (state != LifecycleState.DRAFT) {
          UUID snapshotId = id("stress:snapshot:" + r + ":" + w);
          snapshotBatch.add(
              CommitSnapshot.builder()
                  .id(snapshotId)
                  .weeklyCommitId(commitId)
                  .capturedAt(lockedAt)
                  .build());
          for (CommitItem source : theseItems) {
            snapshotItemBatch.add(
                SnapshotItem.builder()
                    .id(id("stress:snapitem:" + source.getId()))
                    .snapshotId(snapshotId)
                    .commitItemId(source.getId())
                    .text(source.getText())
                    .supportingOutcomeId(source.getSupportingOutcomeId())
                    .chessTier(source.getChessTier())
                    .build());
          }
          if (state == LifecycleState.RECONCILED) {
            reviewBatch.add(
                ManagerReview.builder()
                    .id(id("stress:review:" + r + ":" + w))
                    .weeklyCommitId(commitId)
                    .reviewerId(manager.getId())
                    .state(ReviewState.REVIEWED)
                    .reviewedAt(lockedAt)
                    .build());
          }
        }
      }
    }

    commits.saveAll(commitBatch);
    commits.flush();
    commitItems.saveAll(itemBatch);
    commitItems.flush();
    snapshots.saveAll(snapshotBatch);
    snapshots.flush();
    snapshotItems.saveAll(snapshotItemBatch);
    snapshotItems.flush();
    reviews.saveAll(reviewBatch);
    reviews.flush();
  }

  /** Spread weeks across the lifecycle so roll-up metrics exercise every status path. */
  private static LifecycleState stateFor(int weekIndex) {
    return switch (weekIndex % 5) {
      case 0 -> LifecycleState.RECONCILED;
      case 1 -> LifecycleState.RECONCILING;
      case 2 -> LifecycleState.LOCKED;
      case 3 -> LifecycleState.DRAFT;
      default -> LifecycleState.RECONCILED;
    };
  }

  /**
   * Item ACTUAL status by commit state — DRAFT/LOCKED stay OPEN; reconciled weeks vary outcomes.
   */
  private static CommitItemStatus statusFor(LifecycleState state, int itemIndex) {
    if (state == LifecycleState.DRAFT || state == LifecycleState.LOCKED) {
      return CommitItemStatus.OPEN;
    }
    return switch (itemIndex % 4) {
      case 0 -> CommitItemStatus.COMPLETE;
      case 1 -> CommitItemStatus.INCOMPLETE;
      case 2 -> CommitItemStatus.CARRIED_FORWARD;
      default -> CommitItemStatus.COMPLETE;
    };
  }

  /**
   * Stable UUID for a logical key (shares the DemoSeeder namespace for cross-suite determinism).
   */
  private static UUID id(String key) {
    return DemoSeeder.deterministicId(key);
  }
}
