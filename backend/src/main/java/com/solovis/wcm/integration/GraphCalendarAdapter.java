// GraphCalendarAdapter — the REAL delegated Microsoft Graph CalendarSyncPort (U16/KTD7), active
// under @Profile("graph"). syncLockedCommit POSTs an all-day weekly calendar event to {graphBase}
// /me/events carrying the commit's item lines + a deep-link in the HTML body, the week start/end as
// the event window, and the commitId as the Graph transactionId so re-syncs are idempotent (Graph
// dedups by transactionId). The delegated bearer token comes from GraphTokenService. Empty-safe:
// the
// RestClient is built once from an injected builder; with no AZURE_*/token the bean still
// constructs,
// failing only when actually invoked without consent.
package com.solovis.wcm.integration;

import com.solovis.wcm.common.CurrentMemberProvider;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
@Profile("graph")
public class GraphCalendarAdapter implements CalendarSyncPort {

  private static final Logger log = LoggerFactory.getLogger(GraphCalendarAdapter.class);
  private static final String UTC = "UTC";

  private final GraphTokenService tokenService;
  private final CurrentMemberProvider currentMember;
  private final RestClient graphClient;

  public GraphCalendarAdapter(
      GraphTokenService tokenService,
      CurrentMemberProvider currentMember,
      GraphProperties props,
      RestClient.Builder restClientBuilder) {
    this.tokenService = tokenService;
    this.currentMember = currentMember;
    this.graphClient = restClientBuilder.baseUrl(props.getGraphBase()).build();
  }

  @Override
  @SuppressWarnings("unchecked")
  public String syncLockedCommit(LockedCommitSync commit) {
    String accessToken = tokenService.validAccessToken(commit.memberId());
    Map<String, Object> eventBody = buildEventBody(commit);

    Map<String, Object> response =
        graphClient
            .post()
            .uri("/me/events")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
            // transactionId makes the create idempotent on Graph's side across redelivery.
            .header("transactionId", commit.commitId().toString())
            .contentType(MediaType.APPLICATION_JSON)
            .body(eventBody)
            .retrieve()
            .body(Map.class);

    if (response == null || response.get("id") == null) {
      throw new IllegalStateException("Graph /me/events returned no event id");
    }
    String eventId = (String) response.get("id");
    log.info("created Outlook event {} for commit {}", eventId, commit.commitId());
    return eventId;
  }

  /** Build the Graph calendarEvent JSON: subject, start/end window, HTML body with items + link. */
  Map<String, Object> buildEventBody(LockedCommitSync commit) {
    Map<String, Object> event = new LinkedHashMap<>();
    event.put("subject", "Weekly Commit — week of " + commit.weekStart());
    event.put("body", Map.of("contentType", "HTML", "content", htmlBody(commit)));
    // All-day-style window: start at week start, end the day AFTER week end (Graph end is
    // exclusive).
    event.put("start", dateTime(commit.weekStart() + "T00:00:00"));
    event.put("end", dateTime(commit.weekEnd().plusDays(1) + "T00:00:00"));
    event.put("isReminderOn", false);
    return event;
  }

  private static Map<String, Object> dateTime(String localDateTime) {
    return Map.of("dateTime", localDateTime, "timeZone", UTC);
  }

  private static String htmlBody(LockedCommitSync commit) {
    StringBuilder sb = new StringBuilder("<h3>This week's commitments</h3><ul>");
    List<String> lines = commit.safeItemLines();
    if (lines.isEmpty()) {
      sb.append("<li><i>(no items)</i></li>");
    } else {
      for (String line : lines) {
        sb.append("<li>").append(escape(line)).append("</li>");
      }
    }
    sb.append("</ul>");
    if (commit.deepLink() != null && !commit.deepLink().isBlank()) {
      sb.append("<p><a href=\"")
          .append(escape(commit.deepLink()))
          .append("\">Open in Weekly Commit</a></p>");
    }
    return sb.toString();
  }

  private static String escape(String s) {
    return s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;");
  }
}
