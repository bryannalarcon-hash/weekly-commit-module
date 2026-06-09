// NotificationPreferenceRepository — Spring Data JPA repository for NotificationPreference.
// findByMemberId resolves the acting member's single notification-toggle row (lazy-created with
// defaults on first read, upserted on the settings PUT — see SettingsService).
package com.solovis.wcm.settings;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationPreferenceRepository
    extends JpaRepository<NotificationPreference, UUID> {

  Optional<NotificationPreference> findByMemberId(UUID memberId);
}
