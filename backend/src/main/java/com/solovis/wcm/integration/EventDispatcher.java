// EventDispatcher — routes a decoded DomainEvent to the right consumer(s) for the SQS transport
// (U26). This is the SQS poller's entry point: it calls the consumer's REDELIVERY variant so a
// genuine sync failure PROPAGATES (the poller then leaves the message for SQS redelivery / DLQ
// redrive). The in-process @EventListener path bypasses this dispatcher and is fault-isolated
// separately. Idempotency is shared (event-id dedup in the consumer). Today it maps
// commit.locked -> CommitLockedCalendarConsumer; review.completed/week.past_due land here as they
// gain consumers. Returns true when the event was fully handled (so the poller may ack/delete);
// a consumer failure throws (so the poller leaves the message); unknown types are acked (true).
package com.solovis.wcm.integration;

import com.solovis.wcm.event.DomainEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class EventDispatcher {

  private static final Logger log = LoggerFactory.getLogger(EventDispatcher.class);

  private final CommitLockedCalendarConsumer commitLocked;

  public EventDispatcher(CommitLockedCalendarConsumer commitLocked) {
    this.commitLocked = commitLocked;
  }

  /**
   * Dispatch {@code event} to its consumer for the SQS transport. Returns true when the event was
   * fully handled (the message may be deleted); unknown types are acked (true) so they don't loop
   * the queue. A consumer's sync failure PROPAGATES as a RuntimeException (via handleForRedelivery)
   * so the poller leaves the message for SQS redelivery / DLQ redrive — it is NOT swallowed here
   * (that would silently ack a failed sync).
   */
  public boolean dispatch(DomainEvent event) {
    if (DomainEvent.COMMIT_LOCKED.equals(event.type())) {
      commitLocked.handleForRedelivery(event);
      return true;
    }
    log.debug("no consumer for event type {}; acking", event.type());
    return true;
  }
}
