// E2eResetController — a HERMETIC, test-only reset endpoint (@Profile("e2e")) that restores the
// demo
// data to its seeded baseline between E2E scenarios, so a scenario that creates/locks/reconciles a
// commit (or a Cypress retry) starts from a known state. POST /api/e2e/reset deletes all
// commit-side
// rows (pulse, snapshots, reviews, items, commits, outlook prefs/tokens) and re-runs the
// sample-commit
// seed; the RCDO tree + member graph (stable, never mutated by a scenario) are left intact. NEVER
// ships in prod — it is profile-gated to e2e and is permitAll only because the e2e chain
// authenticates
// from X-Debug-Member, which this maintenance call doesn't carry. Not a product surface.
package com.solovis.wcm.member;

import com.solovis.wcm.commit.ChessTier;
import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.CommitItemStatus;
import com.solovis.wcm.commit.CommitSnapshotRepository;
import com.solovis.wcm.commit.PulseReadingRepository;
import com.solovis.wcm.commit.SnapshotItemRepository;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.integration.GraphTokenRepository;
import com.solovis.wcm.integration.OutlookPreferenceRepository;
import com.solovis.wcm.review.ManagerReviewRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/e2e")
@Profile("e2e")
public class E2eResetController {

  private final DemoSeeder seeder;
  private final WeeklyCommitRepository commits;
  private final CommitItemRepository items;
  private final CommitSnapshotRepository snapshots;
  private final SnapshotItemRepository snapshotItems;
  private final ManagerReviewRepository reviews;
  private final PulseReadingRepository pulses;
  private final GraphTokenRepository graphTokens;
  private final OutlookPreferenceRepository outlookPrefs;

  public E2eResetController(
      DemoSeeder seeder,
      WeeklyCommitRepository commits,
      CommitItemRepository items,
      CommitSnapshotRepository snapshots,
      SnapshotItemRepository snapshotItems,
      ManagerReviewRepository reviews,
      PulseReadingRepository pulses,
      GraphTokenRepository graphTokens,
      OutlookPreferenceRepository outlookPrefs) {
    this.seeder = seeder;
    this.commits = commits;
    this.items = items;
    this.snapshots = snapshots;
    this.snapshotItems = snapshotItems;
    this.reviews = reviews;
    this.pulses = pulses;
    this.graphTokens = graphTokens;
    this.outlookPrefs = outlookPrefs;
  }

  /** Reset the per-scenario commit-side state and re-seed the sample commits. */
  @PostMapping("/reset")
  @Transactional
  public Map<String, Object> reset() {
    // Order matters: children before parents (no cascade on these flat FKs).
    pulses.deleteAllInBatch();
    snapshotItems.deleteAllInBatch();
    snapshots.deleteAllInBatch();
    reviews.deleteAllInBatch();
    items.deleteAllInBatch();
    commits.deleteAllInBatch();
    outlookPrefs.deleteAllInBatch();
    graphTokens.deleteAllInBatch();
    // Re-seed the lifecycle sample commits (RCDO tree + members are untouched / already present).
    seeder.seedSampleCommits();
    return Map.of("reset", true);
  }

  /**
   * Inject a live CommitItem into a commit WITHOUT adding it to the frozen snapshot — simulating an
   * out-of-band addition after lock, which the reconciliation diff must flag ADDED_AFTER_LOCK. The
   * product API (by design) forbids content edits on a LOCKED+ commit, so this hermetic e2e-only
   * endpoint is the way to set up that diff state. Returns the new item id.
   */
  @PostMapping("/commits/{id}/inject-item")
  @Transactional
  public Map<String, Object> injectItem(@PathVariable UUID id) {
    // Assign the id explicitly (not null) so the response never dereferences a possibly-null
    // getId().
    UUID itemId = UUID.randomUUID();
    items.saveAndFlush(
        CommitItem.builder()
            .id(itemId)
            .weeklyCommitId(id)
            .text("Unplanned: hotfix the nightly load")
            .status(CommitItemStatus.COMPLETE)
            .chessTier(ChessTier.PAWN)
            .build());
    return Map.of("itemId", itemId.toString());
  }
}
