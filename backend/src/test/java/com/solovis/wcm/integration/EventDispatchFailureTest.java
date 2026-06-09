// EventDispatchFailureTest — proves the U26 redrive guarantee: when the calendar sync FAILS, the
// SQS
// dispatch path must signal failure so the poller LEAVES the message (SQS redelivery -> DLQ), while
// the in-process @EventListener path stays fault-isolated (swallows). Regression for the bug where
// EventDispatcher.dispatch returned true unconditionally and the poller deleted a message whose
// sync
// had actually failed — silently acking instead of redriving. Pure unit (mocked factory + port).
package com.solovis.wcm.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.solovis.wcm.event.DomainEvent;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class EventDispatchFailureTest {

  private LockedCommitSyncFactory factory;
  private CalendarSyncPort calendar;
  private OutlookService outlook;
  private CommitLockedCalendarConsumer consumer;
  private EventDispatcher dispatcher;

  @BeforeEach
  void setUp() {
    factory = mock(LockedCommitSyncFactory.class);
    calendar = mock(CalendarSyncPort.class);
    // Preference seam: default-enabled (mirrors the no-row default); recordLockSync is a no-op
    // mock.
    outlook = mock(OutlookService.class);
    when(outlook.createEventOnLockEnabled(any())).thenReturn(true);
    consumer = new CommitLockedCalendarConsumer(calendar, factory, outlook);
    dispatcher = new EventDispatcher(consumer);
  }

  private DomainEvent lockedEvent() {
    return DomainEvent.of(DomainEvent.COMMIT_LOCKED, UUID.randomUUID(), UUID.randomUUID());
  }

  private LockedCommitSync syncFor(UUID commitId) {
    return new LockedCommitSync(
        commitId,
        UUID.randomUUID(),
        LocalDate.parse("2026-06-08"),
        LocalDate.parse("2026-06-14"),
        List.of("[KING] ship it"),
        "http://localhost:8080/commits/" + commitId);
  }

  @Test
  void dispatchPropagatesSyncFailureSoThePollerLeavesTheMessage() {
    DomainEvent event = lockedEvent();
    when(factory.forCommit(event.subjectId())).thenReturn(Optional.of(syncFor(event.subjectId())));
    when(calendar.syncLockedCommit(any()))
        .thenThrow(new RuntimeException("Graph 503: calendar unavailable"));

    // EventDispatcher is the SQS poller's entry point: a sync failure must BUBBLE (not return
    // true),
    // so SqsEventPoller.pollOnce()'s catch leaves the message for redelivery / DLQ redrive.
    assertThatThrownBy(() -> dispatcher.dispatch(event)).isInstanceOf(RuntimeException.class);
  }

  @Test
  void failedSyncRollsBackDedupSoARedeliveryCanRetry() {
    DomainEvent event = lockedEvent();
    when(factory.forCommit(event.subjectId())).thenReturn(Optional.of(syncFor(event.subjectId())));
    when(calendar.syncLockedCommit(any()))
        .thenThrow(new RuntimeException("Graph 503"))
        .thenReturn("event-after-retry");

    // First SQS delivery fails and bubbles; the dedup mark must be rolled back...
    assertThatThrownBy(() -> dispatcher.dispatch(event)).isInstanceOf(RuntimeException.class);
    assertThat(consumer.hasHandled(event.eventId())).isFalse();

    // ...so the redelivery actually retries the sync (and succeeds this time).
    assertThat(dispatcher.dispatch(event)).isTrue();
    assertThat(consumer.hasHandled(event.eventId())).isTrue();
    verify(calendar, org.mockito.Mockito.times(2)).syncLockedCommit(any());
  }

  @Test
  void inProcessHandleSwallowsTheFailureToProtectTheLockRequestPath() {
    DomainEvent event = lockedEvent();
    when(factory.forCommit(event.subjectId())).thenReturn(Optional.of(syncFor(event.subjectId())));
    when(calendar.syncLockedCommit(any())).thenThrow(new RuntimeException("Graph down"));

    // The @EventListener path must NOT throw (the LOCK already committed) — fault isolation.
    Optional<String> result = consumer.handle(event);
    assertThat(result).isEmpty();
    // And it rolled back the mark too, so a later redrive of the same id can still sync.
    assertThat(consumer.hasHandled(event.eventId())).isFalse();
  }

  @Test
  void cleanDispatchReturnsTrueSoThePollerDeletesTheMessage() {
    DomainEvent event = lockedEvent();
    when(factory.forCommit(event.subjectId())).thenReturn(Optional.of(syncFor(event.subjectId())));
    when(calendar.syncLockedCommit(any())).thenReturn("calendar-event-1");

    assertThat(dispatcher.dispatch(event)).isTrue();
    assertThat(consumer.hasHandled(event.eventId())).isTrue();
    verify(calendar).syncLockedCommit(any());
  }

  @Test
  void unknownEventTypeIsAckedWithoutTouchingTheCalendar() {
    DomainEvent unknown = DomainEvent.of("week.past_due", UUID.randomUUID(), UUID.randomUUID());

    assertThat(dispatcher.dispatch(unknown)).isTrue();
    verify(calendar, never()).syncLockedCommit(any());
  }
}
