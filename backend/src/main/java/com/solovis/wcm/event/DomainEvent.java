// DomainEvent — the immutable envelope for lifecycle side-effect events (U26 seam). Carries a
// stable type slug ("commit.locked", "review.completed"), the subject aggregate id, the acting
// member id, and an occurredAt stamp. Published synchronously today (InProcessEventPublisher); the
// integrations workflow swaps the publisher for SNS/SQS without changing this shape. A record so it
// stays a value object that consumers can dedup on (eventId is unique per publish).
package com.solovis.wcm.event;

import java.time.Instant;
import java.util.UUID;

public record DomainEvent(
    UUID eventId, String type, UUID subjectId, UUID actorId, Instant occurredAt) {

  /** Canonical event type slugs published by the lifecycle (kept in one place for consumers). */
  public static final String COMMIT_LOCKED = "commit.locked";

  public static final String REVIEW_COMPLETED = "review.completed";

  /** Build an event of {@code type} about {@code subjectId}, stamped now with a fresh id. */
  public static DomainEvent of(String type, UUID subjectId, UUID actorId) {
    return new DomainEvent(UUID.randomUUID(), type, subjectId, actorId, Instant.now());
  }
}
