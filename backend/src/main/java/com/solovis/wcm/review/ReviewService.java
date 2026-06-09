// ReviewService — per-commit manager review writes (U14). The reviewer is the acting member from
// CurrentMemberProvider (never a body field); a write is authorized only when the acting member is
// a
// MANAGER who actually manages the commit's owner (row-level authz, KTD6) — otherwise 403. Upserts
// the single ManagerReview per commit, stamping the reviewer.
package com.solovis.wcm.review;

import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ForbiddenException;
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
}
