// LockedCommitSyncFactory — assembles the CalendarSyncPort input (LockedCommitSync) from a commitId
// (U16). Loads the WeeklyCommit + its items, derives the week window (weekStart .. weekStart+6),
// renders each item as a "[TIER] text" line, and composes a deep-link from ${wcm.app.base-url}.
// Used
// by the commit.locked consumer (in-process and the SQS path) so both build an identical payload.
package com.solovis.wcm.integration;

import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.common.ResourceNotFoundException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class LockedCommitSyncFactory {

  private final WeeklyCommitRepository commits;
  private final CommitItemRepository items;
  private final String appBaseUrl;

  public LockedCommitSyncFactory(
      WeeklyCommitRepository commits,
      CommitItemRepository items,
      @Value("${wcm.app.base-url:http://localhost:8080}") String appBaseUrl) {
    this.commits = commits;
    this.items = items;
    this.appBaseUrl = appBaseUrl;
  }

  /** Build the sync payload for a commit, or empty if the commit no longer exists. */
  @Transactional(readOnly = true)
  public Optional<LockedCommitSync> forCommit(UUID commitId) {
    return commits.findById(commitId).map(this::build);
  }

  /** Build the sync payload for a commit, throwing if it does not exist. */
  @Transactional(readOnly = true)
  public LockedCommitSync requireForCommit(UUID commitId) {
    WeeklyCommit commit =
        commits
            .findById(commitId)
            .orElseThrow(() -> new ResourceNotFoundException("commit " + commitId + " not found"));
    return build(commit);
  }

  private LockedCommitSync build(WeeklyCommit commit) {
    List<String> lines =
        items.findByWeeklyCommitId(commit.getId()).stream().map(this::lineFor).toList();
    String deepLink = appBaseUrl + "/commits/" + commit.getId();
    return new LockedCommitSync(
        commit.getId(),
        commit.getMemberId(),
        commit.getWeekStart(),
        commit.getWeekStart().plusDays(6),
        lines,
        deepLink);
  }

  private String lineFor(CommitItem item) {
    String tier = item.getChessTier() == null ? "" : "[" + item.getChessTier() + "] ";
    return tier + item.getText();
  }
}
