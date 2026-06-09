// GraphCalendarAdapterTest — hermetic test of the REAL Graph adapter against an OkHttp
// MockWebServer
// (U16). Proves the adapter sends to /me/events with a delegated bearer header + transactionId, and
// that the JSON body it builds carries the subject (week), the item lines + deep-link in an HTML
// body, and a start/end window — then returns the event id from the Graph response. No live M365.
package com.solovis.wcm.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.solovis.wcm.common.CurrentMemberProvider;
import java.time.LocalDate;
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

class GraphCalendarAdapterTest {

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

    adapter = new GraphCalendarAdapter(tokenService, currentMember, props, RestClient.builder());
  }

  @AfterEach
  void tearDown() throws Exception {
    graph.shutdown();
  }

  @Test
  void sendsEventToGraphWithBearerAndBuildsTheExpectedBody() throws Exception {
    UUID commitId = UUID.randomUUID();
    UUID memberId = UUID.randomUUID();
    when(tokenService.validAccessToken(memberId)).thenReturn("delegated-access-token");
    graph.enqueue(
        new MockResponse()
            .setResponseCode(201)
            .setHeader("Content-Type", "application/json")
            .setBody("{\"id\":\"AAMkEventId123\"}"));

    LockedCommitSync sync =
        new LockedCommitSync(
            commitId,
            memberId,
            LocalDate.parse("2026-06-08"),
            LocalDate.parse("2026-06-14"),
            List.of("[KING] ship the release", "[PAWN] tidy the backlog"),
            "https://app.wcm.test/commits/" + commitId);

    String eventId = adapter.syncLockedCommit(sync);

    assertThat(eventId).isEqualTo("AAMkEventId123");

    RecordedRequest request = graph.takeRequest();
    assertThat(request.getMethod()).isEqualTo("POST");
    assertThat(request.getPath()).isEqualTo("/me/events");
    assertThat(request.getHeader("Authorization")).isEqualTo("Bearer delegated-access-token");
    // transactionId == commitId makes the create idempotent across redelivery.
    assertThat(request.getHeader("transactionId")).isEqualTo(commitId.toString());

    Map<?, ?> body = json.readValue(request.getBody().readUtf8(), Map.class);
    assertThat((String) body.get("subject")).contains("2026-06-08");
    Map<?, ?> start = (Map<?, ?>) body.get("start");
    Map<?, ?> end = (Map<?, ?>) body.get("end");
    assertThat(start.get("dateTime")).isEqualTo("2026-06-08T00:00:00");
    assertThat(start.get("timeZone")).isEqualTo("UTC");
    // Graph end is exclusive: week end (06-14) + 1 day.
    assertThat(end.get("dateTime")).isEqualTo("2026-06-15T00:00:00");

    Map<?, ?> htmlBody = (Map<?, ?>) body.get("body");
    assertThat(htmlBody.get("contentType")).isEqualTo("HTML");
    String content = (String) htmlBody.get("content");
    assertThat(content).contains("ship the release").contains("tidy the backlog");
    assertThat(content).contains("https://app.wcm.test/commits/" + commitId);
  }

  @Test
  void throwsWhenGraphReturnsNoEventId() throws Exception {
    UUID memberId = UUID.randomUUID();
    when(tokenService.validAccessToken(memberId)).thenReturn("tok");
    graph.enqueue(
        new MockResponse()
            .setResponseCode(201)
            .setHeader("Content-Type", "application/json")
            .setBody("{}"));

    LockedCommitSync sync =
        new LockedCommitSync(
            UUID.randomUUID(),
            memberId,
            LocalDate.parse("2026-06-08"),
            LocalDate.parse("2026-06-14"),
            List.of(),
            null);

    org.assertj.core.api.Assertions.assertThatThrownBy(() -> adapter.syncLockedCommit(sync))
        .isInstanceOf(IllegalStateException.class);
  }
}
