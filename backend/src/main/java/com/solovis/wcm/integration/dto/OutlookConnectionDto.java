// OutlookConnectionDto — the connection state of the acting member's delegated Outlook link (U22).
// status is CONNECTED when a GraphToken row exists, else DISCONNECTED; account is the member's
// email
// when connected; lastSyncAt + createEventOnLock come from the OutlookPreference row. Response of
// GET/DELETE/PUT(settings) /api/integration/outlook. Mirrors the TS OutlookConnectionDto.
package com.solovis.wcm.integration.dto;

import java.time.Instant;

public record OutlookConnectionDto(
    String status, String account, Instant lastSyncAt, boolean createEventOnLock) {

  public static final String CONNECTED = "CONNECTED";
  public static final String DISCONNECTED = "DISCONNECTED";
}
