// InProcessEventPublisher — synchronous EventPublisher backed by Spring's ApplicationEventPublisher
// (U26 seam). Re-publishes each DomainEvent on the application context so any @EventListener bean
// (e.g. LoggingEventConsumer, later the Outlook-sync consumer) receives it in-process. Synchronous
// so a test can assert the side-effect fired; the integrations workflow replaces this with an
// SNS/SQS publisher. Swallows nothing here — listeners own their own failure isolation.
package com.solovis.wcm.event;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

@Component
public class InProcessEventPublisher implements EventPublisher {

  private final ApplicationEventPublisher delegate;

  public InProcessEventPublisher(ApplicationEventPublisher delegate) {
    this.delegate = delegate;
  }

  @Override
  public void publish(DomainEvent event) {
    delegate.publishEvent(event);
  }
}
