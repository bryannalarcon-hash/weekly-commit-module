// DomainEventCodec — JSON serialize/deserialize for DomainEvent on the SNS/SQS wire (U26).
// Publishing
// turns a DomainEvent into a compact JSON object; the SQS poller decodes it back (unwrapping the
// SNS
// notification envelope's "Message" field when raw-message-delivery is off). Kept tiny and explicit
// (no reflection on the record) so the wire shape is stable across the SNS->SQS hop. Thread-safe (a
// single shared ObjectMapper).
package com.solovis.wcm.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.solovis.wcm.event.DomainEvent;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class DomainEventCodec {

  private final ObjectMapper mapper = new ObjectMapper();

  /** Serialize a DomainEvent to its canonical JSON string. */
  public String toJson(DomainEvent event) {
    ObjectNode node = mapper.createObjectNode();
    node.put("eventId", event.eventId().toString());
    node.put("type", event.type());
    node.put("subjectId", event.subjectId() == null ? null : event.subjectId().toString());
    node.put("actorId", event.actorId() == null ? null : event.actorId().toString());
    node.put("occurredAt", event.occurredAt().toString());
    try {
      return mapper.writeValueAsString(node);
    } catch (Exception e) {
      throw new IllegalStateException("failed to serialize DomainEvent", e);
    }
  }

  /**
   * Decode an SQS message body into a DomainEvent. Accepts either the raw DomainEvent JSON OR an
   * SNS notification envelope ({"Type":"Notification","Message":"<json>"...}) — when SNS
   * raw-message delivery is off, the event JSON arrives nested under "Message".
   */
  public DomainEvent fromMessageBody(String body) {
    try {
      JsonNode root = mapper.readTree(body);
      JsonNode event = root.has("Message") ? mapper.readTree(root.get("Message").asText()) : root;
      return new DomainEvent(
          UUID.fromString(event.get("eventId").asText()),
          event.get("type").asText(),
          uuidOrNull(event, "subjectId"),
          uuidOrNull(event, "actorId"),
          Instant.parse(event.get("occurredAt").asText()));
    } catch (Exception e) {
      throw new IllegalStateException("failed to decode DomainEvent from SQS body", e);
    }
  }

  private static UUID uuidOrNull(JsonNode node, String field) {
    JsonNode value = node.get(field);
    return value == null || value.isNull() ? null : UUID.fromString(value.asText());
  }
}
