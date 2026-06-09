// ManagerReviewRepository — Spring Data JPA repository for ManagerReview.
// findByWeeklyCommitId resolves the review the FSM invariant (RECONCILED => REVIEWED) checks.
package com.solovis.wcm.review;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ManagerReviewRepository extends JpaRepository<ManagerReview, UUID> {

  Optional<ManagerReview> findByWeeklyCommitId(UUID weeklyCommitId);
}
