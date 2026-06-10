// ReviewService — per-commit manager review writes (U14), the ONLY place a ManagerReview becomes
// REVIEWED. The reviewer is the acting member from CurrentMemberProvider (never a body field); a
// write is authorized only when the acting member is a MANAGER who actually manages the commit's
// owner (row-level authz, KTD6) — otherwise 403. A lifecycle guard rejects a review until the IC
// has
// RECONCILED their week (RECONCILED or the CARRY_FORWARD escape-hatch) with 409 illegal_state: the
// manager reviews AFTER reconciliation, as a separate step. On a REVIEWED write it stamps the
// commit
// reviewer/reviewedAt and publishes review.completed (U26). Upserts the single ManagerReview per
// commit, stamping the reviewer.
package com.solovis.wcm.review;

import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ForbiddenException;
import com.solovis.wcm.common.IllegalCommitStateException;
import com.solovis.wcm.common.ResourceNotFoundException;
import com.solovis.wcm.event.DomainEvent;
import com.solovis.wcm.event.EventPublisher;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.review.dto.ReviewDto;
import com.solovis.wcm.review.dto.ReviewRequest;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReviewService {

  private final WeeklyCommitRepository commits;
  private final ManagerReviewRepository reviews;
  private final MemberRepository members;
  private final CurrentMemberProvider currentMember;
  private final EventPublisher events;

  public ReviewService(
      WeeklyCommitRepository commits,
      ManagerReviewRepository reviews,
      MemberRepository members,
      CurrentMemberProvider currentMember,
      EventPublisher events) {
    this.commits = commits;
    this.reviews = reviews;
    this.members = members;
    this.currentMember = currentMember;
    this.events = events;
  }

  /**
   * POST /commits/{id}/review — upsert the commit's ManagerReview as the acting manager. Authorized
   * only when the acting member manages the commit's owner; otherwise ForbiddenException (403).
   */
  @Transactional
  public ReviewDto review(UUID commitId, ReviewRequest request) {
    Member manager = currentMember.currentMember();
    WeeklyCommit commit =
        commits
            .findById(commitId)
            .orElseThrow(() -> new ResourceNotFoundException("commit " + commitId + " not found"));
    UUID ownersManagerId =
        members.findById(commit.getMemberId()).map(Member::getManagerId).orElse(null);
    if (!manager.canReview() || !java.util.Objects.equals(manager.getId(), ownersManagerId)) {
      throw new ForbiddenException("only the owner's manager may review commit " + commitId);
    }
    // Lifecycle guard: the manager reviews AFTER the IC reconciles. A review requires the commit to
    // be RECONCILED (the owner has reconciled their week) — or the CARRY_FORWARD escape-hatch that
    // follows it. A LOCKED/RECONCILING commit has not yet been reconciled by the owner, so a review
    // there is premature. This is a state precondition, not an FSM move, so it is 409 illegal_state
    // rather than illegal_transition.
    if (!reviewableState(commit.getLifecycleState())) {
      throw new IllegalCommitStateException(
          "commit "
              + commitId
              + " is "
              + commit.getLifecycleState()
              + "; a review requires the commit to be RECONCILED (the owner has reconciled their"
              + " week)");
    }
    ManagerReview review =
        reviews
            .findByWeeklyCommitId(commitId)
            .orElseGet(() -> ManagerReview.builder().weeklyCommitId(commitId).build());
    review.setReviewerId(manager.getId());
    review.setState(request.state());
    review.setComment(request.comment());
    if (request.state() == ReviewState.REVIEWED && review.getReviewedAt() == null) {
      review.setReviewedAt(Instant.now());
    }
    ReviewDto saved = ReviewDto.from(reviews.save(review));
    // A completed review (the manager's after-the-fact sign-off) stamps the commit's reviewer +
    // reviewedAt and publishes review.completed (U26) — the side-effects reconciliation used to
    // own.
    if (request.state() == ReviewState.REVIEWED) {
      commit.setReviewerId(manager.getId());
      commit.setReviewedAt(Instant.now());
      commits.save(commit);
      events.publish(
          DomainEvent.of(DomainEvent.REVIEW_COMPLETED, commit.getId(), commit.getMemberId()));
    }
    return saved;
  }

  /**
   * A commit is reviewable once the IC has RECONCILED their week — RECONCILED, or the CARRY_FORWARD
   * escape-hatch state that can follow it. Earlier states (DRAFT/LOCKED/RECONCILING) are not yet
   * reconciled by the owner, so the manager's review is premature there.
   */
  private static boolean reviewableState(LifecycleState state) {
    return state == LifecycleState.RECONCILED || state == LifecycleState.CARRY_FORWARD;
  }
}
