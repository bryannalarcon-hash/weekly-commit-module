// CommitSnapshotIT — @DataJpaTest proving U9 snapshot persistence (KTD4) against real postgres.
// Covers: a CommitSnapshot + its SnapshotItems persist and resolve by weeklyCommitId; the snapshot
// freezes text/link/tier (no status column exists on snapshot_item) and the source commit_item.id
// as the U13 reconciliation join key (FK to commit_item). Uses Flyway V5.
package com.solovis.wcm.commit;

import static org.assertj.core.api.Assertions.assertThat;

import com.solovis.wcm.AbstractPersistenceIT;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CommitSnapshotIT extends AbstractPersistenceIT {

  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository commitItems;
  @Autowired private CommitSnapshotRepository snapshots;
  @Autowired private SnapshotItemRepository snapshotItems;
  @Autowired private MemberRepository members;

  @Test
  void snapshotAndItemsPersistAndResolveByCommit() {
    Member m =
        members.saveAndFlush(
            Member.builder()
                .email("snap@solovis.test")
                .displayName("Snap")
                .role(MemberRole.EMPLOYEE)
                .auth0Subject("auth0|snap")
                .build());
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(m.getId())
                .weekStart(LocalDate.parse("2026-06-08"))
                .lifecycleState(LifecycleState.LOCKED)
                .build());

    CommitSnapshot snapshot =
        snapshots.saveAndFlush(
            CommitSnapshot.builder()
                .weeklyCommitId(wc.getId())
                .capturedAt(Instant.parse("2026-06-08T10:00:00Z"))
                .build());

    // The source must be a real persisted commit_item so the frozen commit_item_id FK resolves.
    CommitItem source =
        commitItems.saveAndFlush(
            CommitItem.builder()
                .weeklyCommitId(wc.getId())
                .text("frozen plan line")
                .status(CommitItemStatus.OPEN)
                .chessTier(ChessTier.KING)
                .build());
    snapshotItems.saveAndFlush(SnapshotItem.freeze(snapshot.getId(), source));

    assertThat(snapshots.findByWeeklyCommitId(wc.getId())).isPresent();
    assertThat(snapshotItems.findBySnapshotId(snapshot.getId()))
        .singleElement()
        .satisfies(
            si -> {
              assertThat(si.getText()).isEqualTo("frozen plan line");
              assertThat(si.getChessTier()).isEqualTo(ChessTier.KING);
              // U13 join key: the frozen line back-references its source live commit_item.
              assertThat(si.getCommitItemId()).isEqualTo(source.getId());
            });
  }
}
