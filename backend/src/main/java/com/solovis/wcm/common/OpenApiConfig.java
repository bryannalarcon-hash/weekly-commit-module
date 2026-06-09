// OpenApiConfig — describes the Weekly Commit Module REST contract for springdoc (U10), so
// /v3/api-docs and the Swagger UI render the frozen DTO/endpoint shapes. Acting identity is taken
// from the Auth0 bearer JWT and enforced by SecurityConfig (U15); routes other than the
// health/openapi probes require a valid token.
package com.solovis.wcm.common;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

  @Bean
  public OpenAPI wcmOpenApi() {
    return new OpenAPI()
        .info(
            new Info()
                .title("Weekly Commit Module API")
                .version("0.0.1")
                .description(
                    "Weekly commit lifecycle (draft -> lock -> reconcile -> carry-forward), RCDO "
                        + "browsing, manager review and team roll-up. Acting identity is resolved "
                        + "server-side (CurrentMemberProvider), never from the request body.")
                .license(new License().name("Proprietary")));
  }
}
