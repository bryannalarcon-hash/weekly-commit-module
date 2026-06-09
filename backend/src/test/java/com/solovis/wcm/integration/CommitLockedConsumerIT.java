// CommitLockedConsumerIT — full-stack proof of the commit.locked -> calendar side-effect (U16/U26).
// (1) End-to-end: an owner's submit (DRAFT->LOCKED) publishes commit.locked through the in-process
// EventPublisher seam, and the StubCalendarAdapter is invoked exactly once for that commit,
// recording
// an event id. (2) Idempotency: replaying the SAME DomainEvent through the consumer's handle(...)
// syncs only once (event-id dedup). (3) Fault isolation is covered structurally — the consumer
// never
// throws. Uses the default ("test", i.e. !graph) profile, so the active port is the stub.
package com.solovis.wcm.integration;

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
import com.solovis.wcm.event.DomainEvent;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import com.solovis.wcm.rcdo.Outcome;
import com.solovis.wcm.rcdo.RcdoRepository;
import com.solovis.wcm.rcdo.SupportingOutcome;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class CommitLockedConsumerIT extends AbstractWebIT {

  @Autowired private MemberRepository members;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository items;
  @Autowired private RcdoRepository rcdo;
  @Autowired private CommitLockedCalendarConsumer consumer;
  @Autowired private CalendarSyncPort calendarPort; // StubCalendarAdapter under !graph

  private Member member(String slug) {
    return members.saveAndFlush(
        Member.builder()
            .email(slug + "-" + UUID.randomUUID() + "@solovis.test")
            .displayName(slug)
            .role(MemberRole.EMPLOYEE)
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

  private WeeklyCommit draftWithLinkedItem(Member owner) {
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(owner.getId())
                .weekStart(LocalDate.parse("2026-06-08"))
                .lifecycleState(LifecycleState.DRAFT)
                .build());
    items.saveAndFlush(
        CommitItem.builder()
            .weeklyCommitId(wc.getId())
            .text("ship the thing")
            .status(CommitItemStatus.OPEN)
            .supportingOutcomeId(seedSupportingOutcome())
            .chessTier(ChessTier.KING)
            .build());
    return wc;
  }

  @Test
  void lockingACommitSyncsItToTheCalendarExactlyOnce() throws Exception {
    StubCalendarAdapter stub = (StubCalendarAdapter) calendarPort;
    Member owner = member("calOwner");
    WeeklyCommit wc = draftWithLinkedItem(owner);

    int before = stub.syncedCommitCount();
    mockMvc
        .perform(
            post("/api/commits/{id}/submit", wc.getId())
                .with(TestJwtConfig.employee(owner.getAuth0Subject(), owner.getEmail())))
        .andExpect(status().isOk());

    // The commit.locked event fired synchronously through the in-process publisher and the consumer
    // called the calendar port once, recording an event id for this commit.
    assertThat(stub.syncedCommitCount()).isEqualTo(before + 1);
    assertThat(stub.eventIdFor(wc.getId())).isNotNull();
  }

  @Test
  void redeliveredCommitLockedEventSyncsOnlyOnce() {
    StubCalendarAdapter stub = (StubCalendarAdapter) calendarPort;
    Member owner = member("dedupOwner");
    WeeklyCommit wc = draftWithLinkedItem(owner);

    DomainEvent event = DomainEvent.of(DomainEvent.COMMIT_LOCKED, wc.getId(), owner.getId());
    int before = stub.syncedCommitCount();

    var first = consumer.handle(event);
    var second = consumer.handle(event); // same eventId -> deduped

    assertThat(first).isPresent();
    assertThat(second).isEmpty();
    assertThat(consumer.hasHandled(event.eventId())).isTrue();
    assertThat(stub.syncedCommitCount()).isEqualTo(before + 1);
  }
}
