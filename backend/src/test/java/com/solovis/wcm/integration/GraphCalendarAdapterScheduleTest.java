// GraphCalendarAdapterScheduleTest — hermetic MockWebServer test of the REAL Graph adapter's CB-1
// scheduleEvent path. Proves it POSTs /me/events with the ORGANIZER's delegated bearer token, a
// UTC-converted start/end window (start + durationMinutes), an HTML body carrying the note + the
// WCM deep link, and the report as a required attendee — returning the created event id (and
// throwing IllegalStateException when Graph returns none, mirroring syncLockedCommit).
package com.solovis.wcm.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.solovis.wcm.common.CurrentMemberProvider;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

class GraphCalendarAdapterScheduleTest {

  private static final String APP_BASE_URL = "https://app.wcm.test";

  private MockWebServer graph;
  private GraphTokenService tokenService;
  private GraphCalendarAdapter adapter;
  private final ObjectMapper json = new ObjectMapper();

  @BeforeEach
  void setUp() throws Exception {
    graph = new MockWebServer();
    graph.start();

    tokenService = mock(GraphTokenService.class);
    CurrentMemberProvider currentMember = mock(CurrentMemberProvider.class);

    GraphProperties props = new GraphProperties();
    props.setGraphBase(graph.url("/").toString().replaceAll("/$", ""));

    adapter =
        new GraphCalendarAdapter(
            tokenService, currentMember, props, RestClient.builder(), APP_BASE_URL);
  }

  @AfterEach
  void tearDown() throws Exception {
    graph.shutdown();
  }

  private ScheduledEventCommand command(UUID organizerId) {
    return new ScheduledEventCommand(
        organizerId,
        "Sana Qureshi",
        "sana@solovis.test",
        "Pipeline sync",
        // -05:00 offset: the adapter must convert to UTC (15:30) before sending.
        OffsetDateTime.of(2026, 6, 15, 10, 30, 0, 0, ZoneOffset.ofHours(-5)),
        45,
        "agenda: <pipeline> & blockers");
  }

  @Test
  void schedulesWithOrganizerTokenUtcWindowAttendeeAndHtmlBody() throws Exception {
    UUID organizerId = UUID.randomUUID();
    when(tokenService.validAccessToken(organizerId)).thenReturn("organizer-delegated-token");
    graph.enqueue(
        new MockResponse()
            .setResponseCode(201)
            .setHeader("Content-Type", "application/json")
            .setBody("{\"id\":\"AAMkScheduled456\"}"));

    String eventId = adapter.scheduleEvent(command(organizerId));

    assertThat(eventId).isEqualTo("AAMkScheduled456");

    RecordedRequest request = graph.takeRequest();
    assertThat(request.getMethod()).isEqualTo("POST");
    assertThat(request.getPath()).isEqualTo("/me/events");
    assertThat(request.getHeader("Authorization")).isEqualTo("Bearer organizer-delegated-token");

    Map<?, ?> body = json.readValue(request.getBody().readUtf8(), Map.class);
    assertThat(body.get("subject")).isEqualTo("Pipeline sync");

    // 10:30-05:00 == 15:30Z; end = start + 45 minutes, both stamped timeZone UTC.
    Map<?, ?> start = (Map<?, ?>) body.get("start");
    Map<?, ?> end = (Map<?, ?>) body.get("end");
    assertThat(start.get("dateTime")).isEqualTo("2026-06-15T15:30:00");
    assertThat(start.get("timeZone")).isEqualTo("UTC");
    assertThat(end.get("dateTime")).isEqualTo("2026-06-15T16:15:00");
    assertThat(end.get("timeZone")).isEqualTo("UTC");

    // The report is a REQUIRED attendee.
    List<?> attendees = (List<?>) body.get("attendees");
    assertThat(attendees).hasSize(1);
    Map<?, ?> attendee = (Map<?, ?>) attendees.get(0);
    assertThat(attendee.get("type")).isEqualTo("required");
    Map<?, ?> emailAddress = (Map<?, ?>) attendee.get("emailAddress");
    assertThat(emailAddress.get("address")).isEqualTo("sana@solovis.test");
    assertThat(emailAddress.get("name")).isEqualTo("Sana Qureshi");

    // HTML body: the (escaped) note + the WCM deep link.
    Map<?, ?> htmlBody = (Map<?, ?>) body.get("body");
    assertThat(htmlBody.get("contentType")).isEqualTo("HTML");
    String content = (String) htmlBody.get("content");
    assertThat(content).contains("agenda: &lt;pipeline&gt; &amp; blockers");
    assertThat(content).contains(APP_BASE_URL);
  }

  @Test
  void throwsWhenGraphReturnsNoEventId() {
    UUID organizerId = UUID.randomUUID();
    when(tokenService.validAccessToken(organizerId)).thenReturn("tok");
    graph.enqueue(
        new MockResponse()
            .setResponseCode(201)
            .setHeader("Content-Type", "application/json")
            .setBody("{}"));

    assertThatThrownBy(() -> adapter.scheduleEvent(command(organizerId)))
        .isInstanceOf(IllegalStateException.class);
  }
}
