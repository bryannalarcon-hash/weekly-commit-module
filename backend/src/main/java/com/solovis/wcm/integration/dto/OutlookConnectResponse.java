// OutlookConnectResponse — body of POST /api/integration/outlook/connect (U22): the Entra authorize
// URL the Settings screen redirects the browser to, to begin the delegated Graph consent flow.
// Mirrors the TS OutlookConnectResponse.
package com.solovis.wcm.integration.dto;

public record OutlookConnectResponse(String authorizationUrl) {}
