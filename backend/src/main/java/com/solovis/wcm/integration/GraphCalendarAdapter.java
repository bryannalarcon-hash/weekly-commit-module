// GraphCalendarAdapter — the REAL delegated Microsoft Graph CalendarSyncPort (U16/KTD7/CB-1),
// active under @Profile("graph"). syncLockedCommit POSTs an all-day weekly calendar event to
// {graphBase}/me/events carrying the commit's item lines + a deep-link in the HTML body, the week
// start/end as the event window, and the commitId as the Graph transactionId so re-syncs are
// idempotent (Graph dedups by transactionId). scheduleEvent (CB-1) POSTs an ad-hoc manager event to
// /me/events with the ORGANIZER's delegated token, a UTC-converted start + duration window, the
// report as a required attendee, and an HTML body (note + WCM deep link). Delegated bearer tokens
// come from GraphTokenService. Empty-safe: the RestClient is built once from an injected builder;
// with no AZURE_*/token the bean still constructs, failing only when actually invoked without
// consent.
package com.solovis.wcm.integration;

import com.solovis.wcm.common.CurrentMemberProvider;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
  private static final DateTimeFormatter GRAPH_LOCAL_DATE_TIME =
      DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

  private final GraphTokenService tokenService;
  private final CurrentMemberProvider currentMember;
  private final RestClient graphClient;
  private final String appBaseUrl;

  @Autowired
  public GraphCalendarAdapter(
      GraphTokenService tokenService,
      CurrentMemberProvider currentMember,
      GraphProperties props,
      RestClient.Builder restClientBuilder,
      @Value("${wcm.app.base-url:http://localhost:8080}") String appBaseUrl) {
    this.tokenService = tokenService;
    this.currentMember = currentMember;
    this.graphClient = restClientBuilder.baseUrl(props.getGraphBase()).build();
    this.appBaseUrl = appBaseUrl;
  }

  /** Convenience constructor (tests predating CB-1): defaults the WCM deep-link base URL. */
  GraphCalendarAdapter(
      GraphTokenService tokenService,
      CurrentMemberProvider currentMember,
      GraphProperties props,
      RestClient.Builder restClientBuilder) {
    this(tokenService, currentMember, props, restClientBuilder, "http://localhost:8080");
  }

  @Override
  @SuppressWarnings("unchecked")
  public String syncLockedCommit(LockedCommitSync commit) {
    String accessToken = tokenService.validAccessToken(commit.memberId());
    Map<String, Object> response =
        graphClient
            .post()
            .uri("/me/events")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
            // transactionId makes the create idempotent on Graph's side across redelivery.
            .header("transactionId", commit.commitId().toString())
            .contentType(MediaType.APPLICATION_JSON)
            .body(buildEventBody(commit))
            .retrieve()
            .body(Map.class);

    String eventId = requireEventId(response);
    log.info("created Outlook event {} for commit {}", eventId, commit.commitId());
    return eventId;
  }

  @Override
  @SuppressWarnings("unchecked")
  public String scheduleEvent(ScheduledEventCommand cmd) {
    // The ORGANIZER (acting manager) creates the event on their own calendar via /me/events.
    String accessToken = tokenService.validAccessToken(cmd.organizerMemberId());
    Map<String, Object> response =
        graphClient
            .post()
            .uri("/me/events")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
            .contentType(MediaType.APPLICATION_JSON)
            .body(buildScheduledEventBody(cmd))
            .retrieve()
            .body(Map.class);

    String eventId = requireEventId(response);
    log.info(
        "scheduled Outlook event {} by organizer {} with report {}",
        eventId,
        cmd.organizerMemberId(),
        cmd.reportEmail());
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

  /** Build the CB-1 ad-hoc event JSON: UTC window, note+deep-link body, report as attendee. */
  Map<String, Object> buildScheduledEventBody(ScheduledEventCommand cmd) {
    // Convert the request's offset to UTC and send dateTime + timeZone UTC (simplest stable form).
    OffsetDateTime startUtc = cmd.start().withOffsetSameInstant(ZoneOffset.UTC);
    OffsetDateTime endUtc = startUtc.plusMinutes(cmd.durationMinutes());
    Map<String, Object> event = new LinkedHashMap<>();
    event.put("subject", cmd.subject());
    event.put("body", Map.of("contentType", "HTML", "content", scheduledHtmlBody(cmd)));
    event.put("start", dateTime(GRAPH_LOCAL_DATE_TIME.format(startUtc)));
    event.put("end", dateTime(GRAPH_LOCAL_DATE_TIME.format(endUtc)));
    event.put(
        "attendees",
        List.of(
            Map.of(
                "emailAddress",
                Map.of("address", cmd.reportEmail(), "name", cmd.reportDisplayName()),
                "type",
                "required")));
    return event;
  }

  private static String requireEventId(Map<String, Object> response) {
    if (response == null || response.get("id") == null) {
      throw new IllegalStateException("Graph /me/events returned no event id");
    }
    return (String) response.get("id");
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

  private String scheduledHtmlBody(ScheduledEventCommand cmd) {
    StringBuilder sb = new StringBuilder();
    if (cmd.note() != null && !cmd.note().isBlank()) {
      sb.append("<p>").append(escape(cmd.note())).append("</p>");
    }
    sb.append("<p><a href=\"")
        .append(escape(appBaseUrl))
        .append("\">Open in Weekly Commit</a></p>");
    return sb.toString();
  }

  private static String escape(String s) {
    return s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;");
  }
}
