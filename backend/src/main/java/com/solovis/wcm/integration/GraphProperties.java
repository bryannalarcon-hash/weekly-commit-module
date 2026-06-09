// GraphProperties — bound config for the delegated Microsoft Graph integration (U16), prefix
// wcm.graph. Carries the Entra app registration (tenant/clientId/secret/redirect), requested OAuth
// scopes, and the authorize/token/graph base URLs. Every value is env-backed and empty-safe; helper
// methods compose the authorize and token endpoints from the tenant. No secrets are logged.
package com.solovis.wcm.integration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "wcm.graph")
public class GraphProperties {

  private String tenant = "common";
  private String clientId = "";
  private String clientSecret = "";
  private String redirectUri = "";
  private String scopes = "offline_access User.Read Calendars.ReadWrite";
  private String authorizeBase = "https://login.microsoftonline.com";
  private String graphBase = "https://graph.microsoft.com/v1.0";
  private String tokenEncKey = "";

  /** True when the app registration is configured enough to run the consent + token flow. */
  public boolean isConfigured() {
    return clientId != null && !clientId.isBlank();
  }

  /** The Entra authorize endpoint for the configured tenant. */
  public String authorizeEndpoint() {
    return authorizeBase + "/" + tenant + "/oauth2/v2.0/authorize";
  }

  /** The Entra token endpoint for the configured tenant. */
  public String tokenEndpoint() {
    return authorizeBase + "/" + tenant + "/oauth2/v2.0/token";
  }

  public String getTenant() {
    return tenant;
  }

  public void setTenant(String tenant) {
    this.tenant = tenant;
  }

  public String getClientId() {
    return clientId;
  }

  public void setClientId(String clientId) {
    this.clientId = clientId;
  }

  public String getClientSecret() {
    return clientSecret;
  }

  public void setClientSecret(String clientSecret) {
    this.clientSecret = clientSecret;
  }

  public String getRedirectUri() {
    return redirectUri;
  }

  public void setRedirectUri(String redirectUri) {
    this.redirectUri = redirectUri;
  }

  public String getScopes() {
    return scopes;
  }

  public void setScopes(String scopes) {
    this.scopes = scopes;
  }

  public String getAuthorizeBase() {
    return authorizeBase;
  }

  public void setAuthorizeBase(String authorizeBase) {
    this.authorizeBase = authorizeBase;
  }

  public String getGraphBase() {
    return graphBase;
  }

  public void setGraphBase(String graphBase) {
    this.graphBase = graphBase;
  }

  public String getTokenEncKey() {
    return tokenEncKey;
  }

  public void setTokenEncKey(String tokenEncKey) {
    this.tokenEncKey = tokenEncKey;
  }
}
