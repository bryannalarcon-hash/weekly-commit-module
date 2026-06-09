// StubCalendarAdapter — the in-memory CalendarSyncPort used by tests and any boot WITHOUT the
// "graph" profile (U16/CB-1). syncLockedCommit records each locked commit's synthetic event id in a
// map keyed by commitId, so it is idempotent (same commit -> same id) and a test can assert the
// port was hit exactly once. scheduleEvent (CB-1) records each manager-scheduled command and mints
// "stub-scheduled-<n>" ids, with scheduledCount()/lastScheduled() test accessors. Active under
// @Profile("!graph"); GraphCalendarAdapter takes over under "graph".
package com.solovis.wcm.integration;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!graph")
public class StubCalendarAdapter implements CalendarSyncPort {

  private final Map<UUID, String> eventsByCommit = new ConcurrentHashMap<>();
  private final AtomicInteger scheduledCounter = new AtomicInteger();
  private final AtomicReference<ScheduledEventCommand> lastScheduled = new AtomicReference<>();

  @Override
  public String syncLockedCommit(LockedCommitSync commit) {
    // computeIfAbsent makes repeated syncs for the same commit return the first synthetic id.
    return eventsByCommit.computeIfAbsent(commit.commitId(), id -> "stub-event-" + id);
  }

  @Override
  public String scheduleEvent(ScheduledEventCommand cmd) {
    lastScheduled.set(cmd);
    return "stub-scheduled-" + scheduledCounter.incrementAndGet();
  }

  /** Test/inspection hook: how many DISTINCT commits have been synced. */
  public int syncedCommitCount() {
    return eventsByCommit.size();
  }

  /** Test/inspection hook: the event id recorded for a commit, or null if never synced. */
  public String eventIdFor(UUID commitId) {
    return eventsByCommit.get(commitId);
  }

  /** Test/inspection hook: how many ad-hoc events have been scheduled (CB-1). */
  public int scheduledCount() {
    return scheduledCounter.get();
  }

  /** Test/inspection hook: the most recently scheduled command, or null if none yet (CB-1). */
  public ScheduledEventCommand lastScheduled() {
    return lastScheduled.get();
  }
}
