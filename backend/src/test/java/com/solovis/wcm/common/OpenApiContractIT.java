// OpenApiContractIT — proves the U10 contract deliverable: springdoc serves /v3/api-docs as an
// OpenAPI document that includes the WCM endpoints (commits, rcdo, rollup). Guards against the
// dependency silently dropping out and against the controllers vanishing from the published spec.
package com.solovis.wcm.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import org.junit.jupiter.api.Test;

class OpenApiContractIT extends AbstractWebIT {

  @Test
  void apiDocsServesTheWcmContract() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.openapi").exists())
        .andExpect(jsonPath("$.info.title").value("Weekly Commit Module API"))
        // The U11-U14 endpoints are present in the published contract.
        .andExpect(jsonPath("$.paths['/api/commits']").exists())
        .andExpect(jsonPath("$.paths['/api/commits/{id}/submit']").exists())
        .andExpect(jsonPath("$.paths['/api/rcdo/tree']").exists())
        .andExpect(jsonPath("$.paths['/api/rollup']").exists());
  }
}
