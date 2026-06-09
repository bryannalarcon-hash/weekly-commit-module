// OutlookPreferenceRepository — Spring Data JPA repository for OutlookPreference.
// findByMemberId resolves the acting member's single sync-preference row (upserted on settings
// PUT).
package com.solovis.wcm.integration;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutlookPreferenceRepository extends JpaRepository<OutlookPreference, UUID> {

  Optional<OutlookPreference> findByMemberId(UUID memberId);
}
