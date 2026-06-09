// LoggingEventConsumer — the placeholder consumer for the event seam (U26). Logs every published
// DomainEvent at INFO and counts them, proving the publish->consume path end-to-end before the real
// SNS/SQS consumers (Outlook sync, notifications) land in the integrations workflow. The counter is
// exposed so an in-process test can assert a transition actually published its event.
package com.solovis.wcm.event;

import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class LoggingEventConsumer {

  private static final Logger log = LoggerFactory.getLogger(LoggingEventConsumer.class);

  private final AtomicLong handled = new AtomicLong();

  @EventListener
  public void onDomainEvent(DomainEvent event) {
    handled.incrementAndGet();
    log.info(
        "domain event {} type={} subject={} actor={} at={}",
        event.eventId(),
        event.type(),
        event.subjectId(),
        event.actorId(),
        event.occurredAt());
  }

  /** Total events consumed since startup (used by the eventing seam test). */
  public long handledCount() {
    return handled.get();
  }
}
