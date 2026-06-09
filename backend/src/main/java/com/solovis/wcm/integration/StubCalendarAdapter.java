// StubCalendarAdapter — the in-memory CalendarSyncPort used by tests and any boot WITHOUT the
// "graph" profile (U16). Records each locked commit's synthetic event id in a map keyed by
// commitId,
// so syncLockedCommit is idempotent (same commit -> same id) and a test can assert the port was hit
// exactly once. Active under @Profile("!graph"); GraphCalendarAdapter takes over under "graph".
package com.solovis.wcm.integration;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("!graph")
public class StubCalendarAdapter implements CalendarSyncPort {

  private final Map<UUID, String> eventsByCommit = new ConcurrentHashMap<>();

  @Override
  public String syncLockedCommit(LockedCommitSync commit) {
    // computeIfAbsent makes repeated syncs for the same commit return the first synthetic id.
    return eventsByCommit.computeIfAbsent(commit.commitId(), id -> "stub-event-" + id);
  }

  /** Test/inspection hook: how many DISTINCT commits have been synced. */
  public int syncedCommitCount() {
    return eventsByCommit.size();
  }

  /** Test/inspection hook: the event id recorded for a commit, or null if never synced. */
  public String eventIdFor(UUID commitId) {
    return eventsByCommit.get(commitId);
  }
}
