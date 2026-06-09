// EventPublisher — the outbound port for domain events (KTD11 / U26 seam). Services publish a
// DomainEvent through this interface, decoupling the request path from side-effects (Outlook sync,
// notifications). The in-process impl dispatches synchronously to local consumers; the integrations
// workflow provides an SNS/SQS-backed impl with the same contract.
package com.solovis.wcm.event;

public interface EventPublisher {

  /** Publish a domain event to all interested consumers. Must not throw to the caller's path. */
  void publish(DomainEvent event);
}
