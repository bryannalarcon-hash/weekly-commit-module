// CommitRepositoryIT — @DataJpaTest proving U8 weekly-commit aggregate persistence + KTD5.
// Covers: an UNLINKED CommitItem (no supportingOutcomeId) PERSISTS (KTD5 — column is nullable);
// duplicate (memberId, weekStart) violates the UNIQUE constraint; carried-from lineage chains; and
// the PulseReading score check + ManagerReview persist. Uses real postgres (Flyway V4/V5).
package com.solovis.wcm.commit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.solovis.wcm.AbstractPersistenceIT;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import com.solovis.wcm.review.ManagerReview;
import com.solovis.wcm.review.ManagerReviewRepository;
import com.solovis.wcm.review.ReviewState;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

class CommitRepositoryIT extends AbstractPersistenceIT {

  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository items;
  @Autowired private PulseReadingRepository pulses;
  @Autowired private ManagerReviewRepository reviews;
  @Autowired private MemberRepository members;

  private Member newMember(String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.EMPLOYEE)
            .auth0Subject("auth0|" + slug)
            .build());
  }

  private WeeklyCommit newCommit(UUID memberId, LocalDate week) {
    return commits.saveAndFlush(
        WeeklyCommit.builder()
            .memberId(memberId)
            .weekStart(week)
            .lifecycleState(LifecycleState.DRAFT)
            .build());
  }

  @Test
  void unlinkedCommitItemPersistsProvingKtd5NullableLink() {
    Member m = newMember("ktd5");
    WeeklyCommit wc = newCommit(m.getId(), LocalDate.parse("2026-06-08"));

    CommitItem unlinked =
        items.saveAndFlush(
            CommitItem.builder()
                .weeklyCommitId(wc.getId())
                .text("draft thought, not yet linked")
                .status(CommitItemStatus.OPEN)
                .supportingOutcomeId(null) // KTD5: must persist anyway
                .build());

    assertThat(unlinked.getId()).isNotNull();
    assertThat(unlinked.getSupportingOutcomeId()).isNull();
    assertThat(unlinked.isLinked()).isFalse();
    assertThat(items.findByWeeklyCommitId(wc.getId())).hasSize(1);
  }

  @Test
  void duplicateMemberAndWeekViolatesUniqueConstraint() {
    Member m = newMember("uniq");
    LocalDate week = LocalDate.parse("2026-06-08");
    newCommit(m.getId(), week);

    assertThatThrownBy(() -> newCommit(m.getId(), week))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void sameMemberDifferentWeeksAreAllowed() {
    Member m = newMember("multiweek");
    newCommit(m.getId(), LocalDate.parse("2026-06-08"));
    newCommit(m.getId(), LocalDate.parse("2026-06-15"));
    assertThat(commits.findByMemberId(m.getId())).hasSize(2);
  }

  @Test
  void carriedFromLineageChains() {
    Member m = newMember("lineage");
    WeeklyCommit prior = newCommit(m.getId(), LocalDate.parse("2026-06-01"));
    CommitItem source =
        items.saveAndFlush(
            CommitItem.builder()
                .weeklyCommitId(prior.getId())
                .text("missed last week")
                .status(CommitItemStatus.INCOMPLETE)
                .build());

    WeeklyCommit next = newCommit(m.getId(), LocalDate.parse("2026-06-08"));
    CommitItem carried =
        items.saveAndFlush(
            CommitItem.builder()
                .weeklyCommitId(next.getId())
                .text("missed last week")
                .status(CommitItemStatus.OPEN)
                .carriedFromItemId(source.getId())
                .build());

    assertThat(carried.getCarriedFromItemId()).isEqualTo(source.getId());
  }

  @Test
  void pulseReadingPersistsWithinRange() {
    Member m = newMember("pulse");
    WeeklyCommit wc = newCommit(m.getId(), LocalDate.parse("2026-06-08"));
    PulseReading reading =
        pulses.saveAndFlush(
            PulseReading.builder()
                .weeklyCommitId(wc.getId())
                .score((short) 4)
                .comment("steady week")
                .commentPrivate(true)
                .build());
    assertThat(pulses.findByWeeklyCommitId(wc.getId())).hasSize(1);
    assertThat(reading.getScore()).isEqualTo((short) 4);
    assertThat(reading.isCommentPrivate()).isTrue();
  }

  @Test
  void managerReviewPersistsAndResolvesByCommit() {
    Member reviewer = newMember("reviewer");
    Member author = newMember("author");
    WeeklyCommit wc = newCommit(author.getId(), LocalDate.parse("2026-06-08"));
    reviews.saveAndFlush(
        ManagerReview.builder()
            .weeklyCommitId(wc.getId())
            .reviewerId(reviewer.getId())
            .state(ReviewState.UNREVIEWED)
            .build());
    assertThat(reviews.findByWeeklyCommitId(wc.getId())).isPresent();
  }

  @Test
  void secondManagerReviewForSameCommitViolatesUniqueConstraint() {
    // Deferred fix (V7): one ManagerReview per weekly_commit. A second insert for the same commit
    // must fail at the DB, not silently create a duplicate review.
    Member reviewer = newMember("dupReviewer");
    Member author = newMember("dupAuthor");
    WeeklyCommit wc = newCommit(author.getId(), LocalDate.parse("2026-06-08"));
    reviews.saveAndFlush(
        ManagerReview.builder()
            .weeklyCommitId(wc.getId())
            .reviewerId(reviewer.getId())
            .state(ReviewState.UNREVIEWED)
            .build());

    assertThatThrownBy(
            () ->
                reviews.saveAndFlush(
                    ManagerReview.builder()
                        .weeklyCommitId(wc.getId())
                        .reviewerId(reviewer.getId())
                        .state(ReviewState.REVIEWED)
                        .build()))
        .isInstanceOf(DataIntegrityViolationException.class);
  }
}
