// ReviewService — per-commit manager review writes (U14). The reviewer is the acting member from
// CurrentMemberProvider (never a body field); a write is authorized only when the acting member is
// a
// MANAGER who actually manages the commit's owner (row-level authz, KTD6) — otherwise 403. A
// lifecycle guard also rejects a review on a never-submitted DRAFT (no frozen plan to review) with
// 409 illegal_state. Upserts the single ManagerReview per commit, stamping the reviewer.
package com.solovis.wcm.review;

import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ForbiddenException;
import com.solovis.wcm.common.IllegalCommitStateException;
import com.solovis.wcm.common.ResourceNotFoundException;
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

  public ReviewService(
      WeeklyCommitRepository commits,
      ManagerReviewRepository reviews,
      MemberRepository members,
      CurrentMemberProvider currentMember) {
    this.commits = commits;
    this.reviews = reviews;
    this.members = members;
    this.currentMember = currentMember;
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
    // Lifecycle guard: a review only makes sense once a frozen plan exists. A never-submitted DRAFT
    // has no plan to review, and recording a REVIEWED state against it yields the contradictory
    // "DRAFT + REVIEWED" review-queue row. Reject unless the commit is LOCKED or later
    // (RECONCILING/RECONCILED). This is a state precondition, not an FSM move, so it is 409
    // illegal_state rather than illegal_transition.
    if (!reviewableState(commit.getLifecycleState())) {
      throw new IllegalCommitStateException(
          "commit "
              + commitId
              + " is "
              + commit.getLifecycleState()
              + "; a review requires the commit to be LOCKED or later (a submitted, frozen plan)");
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
    return ReviewDto.from(reviews.save(review));
  }

  /**
   * A commit is reviewable once it has a frozen plan — i.e. any state from LOCKED onward (LOCKED,
   * RECONCILING, RECONCILED, and the CARRY_FORWARD escape-hatch state, all of which carry the
   * snapshot written at LOCK). Only the never-submitted DRAFT has no plan and is not reviewable.
   */
  private static boolean reviewableState(LifecycleState state) {
    return state != LifecycleState.DRAFT;
  }
}
