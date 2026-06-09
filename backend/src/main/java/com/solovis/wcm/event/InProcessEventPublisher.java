// InProcessEventPublisher — synchronous EventPublisher backed by Spring's ApplicationEventPublisher
// (U26 seam). Re-publishes each DomainEvent on the application context so any @EventListener bean
// (e.g. LoggingEventConsumer, the Outlook-sync consumer) receives it in-process. Synchronous so a
// test can assert the side-effect fired. The DEFAULT publisher: active under @Profile("!aws");
// under
// the "aws" profile the SnsEventPublisher takes over (exactly one EventPublisher bean either way).
// Swallows nothing here — listeners own their own failure isolation.
package com.solovis.wcm.event;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!aws")
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
