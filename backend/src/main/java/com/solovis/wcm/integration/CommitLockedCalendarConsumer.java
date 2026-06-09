// CommitLockedCalendarConsumer — the commit.locked side-effect: sync the locked commit to Outlook
// via CalendarSyncPort (U16/U26). Both transports share one idempotent core (syncOnce), but differ
// on failure handling so each transport gets the RIGHT guarantee:
//   - In-process @EventListener -> handle(...): SWALLOWS a sync failure (fault-isolated, never
// breaks
//     the LOCK request path; the lock already committed).
//   - SQS poller (via EventDispatcher) -> handleForRedelivery(...): RE-THROWS a sync failure so the
//     poller LEAVES the message for SQS redelivery and, past maxReceiveCount, DLQ redrive (U26).
// Idempotent: dedups by DomainEvent.eventId so a redelivered event calls the port at most once; a
// failed sync rolls back the dedup mark so a redrive can retry. Builds the payload via
// LockedCommitSyncFactory.
package com.solovis.wcm.integration;

import com.solovis.wcm.event.DomainEvent;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class CommitLockedCalendarConsumer {

  private static final Logger log = LoggerFactory.getLogger(CommitLockedCalendarConsumer.class);

  private final CalendarSyncPort calendar;
  private final LockedCommitSyncFactory syncFactory;

  // Seen event ids — at-least-once delivery means an event may arrive twice; we sync once.
  private final Set<UUID> handledEventIds = ConcurrentHashMap.newKeySet();

  public CommitLockedCalendarConsumer(
      CalendarSyncPort calendar, LockedCommitSyncFactory syncFactory) {
    this.calendar = calendar;
    this.syncFactory = syncFactory;
  }

  /** In-process delivery: every published DomainEvent; only commit.locked triggers a sync. */
  @EventListener
  public void onDomainEvent(DomainEvent event) {
    if (DomainEvent.COMMIT_LOCKED.equals(event.type())) {
      handle(event);
    }
  }

  /**
   * In-process delivery: idempotently sync the locked commit, SWALLOWING any failure. Returns the
   * event id created/reused, or empty when skipped (already handled, missing commit) or on a
   * swallowed error. Never throws — side-effect isolation keeps a Graph failure from breaking the
   * LOCK request path (the lock already committed). Used by the @EventListener path ONLY; the SQS
   * path uses {@link #handleForRedelivery(DomainEvent)} so a failure can redrive to the DLQ.
   */
  public Optional<String> handle(DomainEvent event) {
    try {
      return syncOnce(event);
    } catch (RuntimeException e) {
      log.warn(
          "calendar sync for commit {} failed (non-fatal, in-process): {}",
          event.subjectId(),
          e.toString());
      return Optional.empty();
    }
  }

  /**
   * SQS delivery: idempotently sync the locked commit, RE-THROWING a sync failure so the caller
   * (EventDispatcher -> SqsEventPoller) leaves the message on the queue for redelivery / DLQ
   * redrive rather than deleting it. The dedup mark is rolled back before the throw so the
   * redelivery (or DLQ replay) can retry. A clean handle (including a skipped duplicate / missing
   * commit) returns normally so the poller deletes the message.
   */
  public Optional<String> handleForRedelivery(DomainEvent event) {
    return syncOnce(event);
  }

  /**
   * The shared idempotent core: mark the event id seen-once, then sync. On a sync failure the mark
   * is rolled back (so a retry is possible) and the exception propagates — callers decide whether
   * to swallow it (in-process) or let it bubble for redrive (SQS).
   */
  private Optional<String> syncOnce(DomainEvent event) {
    if (!handledEventIds.add(event.eventId())) {
      log.debug("commit.locked {} already handled; skipping duplicate", event.eventId());
      return Optional.empty();
    }
    try {
      return syncFactory
          .forCommit(event.subjectId())
          .map(
              sync -> {
                String eventId = calendar.syncLockedCommit(sync);
                log.info("synced commit {} to calendar event {}", event.subjectId(), eventId);
                return eventId;
              });
    } catch (RuntimeException e) {
      // Roll back the dedup mark so a redelivery / DLQ replay can retry this event.
      handledEventIds.remove(event.eventId());
      throw e;
    }
  }

  /** Test hook: whether an event id has been marked handled. */
  public boolean hasHandled(UUID eventId) {
    return handledEventIds.contains(eventId);
  }
}
