// OutlookConnectionDto — the connection state of the acting member's delegated Outlook link (U22).
// status is CONNECTED when a GraphToken row exists, else DISCONNECTED; account is the member's
// email
// when connected; lastSyncAt + createEventOnLock come from the OutlookPreference row. `available`
// is whether the server has Entra/Graph configured at all (a demo host with no AZURE_* env cannot
// run the consent flow) — the UI then hides "Connect" and explains, rather than redirecting to a
// broken Microsoft page. Response of GET/DELETE/PUT(settings) /api/integration/outlook. Mirrors TS.
package com.solovis.wcm.integration.dto;

import java.time.Instant;

public record OutlookConnectionDto(
    String status,
    String account,
    Instant lastSyncAt,
    boolean createEventOnLock,
    boolean available) {

  public static final String CONNECTED = "CONNECTED";
  public static final String DISCONNECTED = "DISCONNECTED";
}
