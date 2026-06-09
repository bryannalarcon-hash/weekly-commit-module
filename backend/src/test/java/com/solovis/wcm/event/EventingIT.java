// EventingIT — proves the U26 event seam end-to-end through the web stack: the OWNER's LOCK
// publishes
// a commit.locked DomainEvent and the MANAGER-driven RECONCILING->RECONCILED publishes
// review.completed, both delivered synchronously to an in-process @EventListener (the same path
// LoggingEventConsumer uses). Exercises the split actor model (KTD6): owner locks, owner's manager
// drives reconcile. A test RecordingConsumer captures every DomainEvent so we can assert the type
// slugs and subject ids fired on the real lifecycle transitions (not via a stub).
package com.solovis.wcm.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.commit.ChessTier;
import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.CommitItemStatus;
import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.TestJwtConfig;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import com.solovis.wcm.rcdo.Outcome;
import com.solovis.wcm.rcdo.RcdoRepository;
import com.solovis.wcm.rcdo.SupportingOutcome;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Import(EventingIT.RecordingConfig.class)
class EventingIT extends AbstractWebIT {

  @Autowired private MemberRepository members;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository items;
  @Autowired private RcdoRepository rcdo;
  @Autowired private RecordingConsumer recorder;

  @BeforeEach
  void clearRecorder() {
    recorder.events().clear();
  }

  private Member owner(String slug, UUID managerId) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.EMPLOYEE)
            .managerId(managerId)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  private Member managerMember(String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.MANAGER)
            .auth0Subject("auth0|" + slug + "-" + UUID.randomUUID())
            .build());
  }

  private UUID seedSupportingOutcome() {
    var rally = rcdo.save(com.solovis.wcm.rcdo.RallyCry.builder().title("RC").build());
    var objective =
        rcdo.save(
            com.solovis.wcm.rcdo.DefiningObjective.builder()
                .rallyCryId(rally.getId())
                .title("DO")
                .build());
    Outcome outcome =
        rcdo.save(Outcome.builder().definingObjectiveId(objective.getId()).title("O").build());
    return rcdo.save(SupportingOutcome.builder().outcomeId(outcome.getId()).title("SO").build())
        .getId();
  }

  private WeeklyCommit lockedCommit(Member m) {
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(m.getId())
                .weekStart(LocalDate.parse("2026-06-08"))
                .lifecycleState(LifecycleState.DRAFT)
                .build());
    items.saveAndFlush(
        CommitItem.builder()
            .weeklyCommitId(wc.getId())
            .text("task")
            .status(CommitItemStatus.OPEN)
            .supportingOutcomeId(seedSupportingOutcome())
            .chessTier(ChessTier.KING)
            .build());
    return wc;
  }

  @Test
  void lockPublishesCommitLockedAndReconciledPublishesReviewCompleted() throws Exception {
    Member manager = managerMember("evt-mgr");
    Member m = owner("evt", manager.getId());
    WeeklyCommit wc = lockedCommit(m);
    // Split actor model (KTD6): the OWNER (employee token, no scope) locks; the OWNER'S MANAGER
    // (scope token, manages the owner) drives the scope-gated reconcile transitions.
    var asOwner = TestJwtConfig.employee(m.getAuth0Subject(), m.getEmail());
    var asManager = TestJwtConfig.manager(manager.getAuth0Subject(), manager.getEmail());

    mockMvc
        .perform(post("/api/commits/{id}/submit", wc.getId()).with(asOwner))
        .andExpect(status().isOk());

    assertThat(recorder.typesFor(wc.getId())).contains(DomainEvent.COMMIT_LOCKED);

    mockMvc
        .perform(post("/api/commits/{id}/reconcile", wc.getId()).with(asManager))
        .andExpect(status().isOk());
    mockMvc
        .perform(post("/api/commits/{id}/reconciled", wc.getId()).with(asManager))
        .andExpect(status().isOk());

    assertThat(recorder.typesFor(wc.getId()))
        .contains(DomainEvent.COMMIT_LOCKED, DomainEvent.REVIEW_COMPLETED);
  }

  @TestConfiguration
  static class RecordingConfig {
    @Bean
    RecordingConsumer recordingConsumer() {
      return new RecordingConsumer();
    }
  }

  @Component
  static class RecordingConsumer {
    private final List<DomainEvent> events = new ArrayList<>();

    @EventListener
    synchronized void on(DomainEvent event) {
      events.add(event);
    }

    synchronized List<DomainEvent> events() {
      return events;
    }

    synchronized List<String> typesFor(UUID subjectId) {
      return events.stream()
          .filter(e -> subjectId.equals(e.subjectId()))
          .map(DomainEvent::type)
          .toList();
    }
  }
}
