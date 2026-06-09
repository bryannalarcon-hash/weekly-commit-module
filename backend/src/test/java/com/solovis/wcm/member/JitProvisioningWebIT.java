// JitProvisioningWebIT — regression for the read-only-transaction provisioning bug. A brand-new
// Auth0 subject whose FIRST request hits a READ-ONLY endpoint (GET /api/commits/current resolves
// the
// acting member) must be JIT-provisioned and get a clean response — NOT a 500 ("cannot execute
// INSERT in a read-only transaction"). The INSERT now runs in MemberProvisioningWriter's
// REQUIRES_NEW
// tx, so it succeeds regardless of the caller's read-only tx. Also covers a token with no email
// claim
// (email/displayName synthesized from the subject). Runs the prod JWT chain (TestJwtConfig).
package com.solovis.wcm.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.solovis.wcm.AbstractWebIT;
import com.solovis.wcm.common.TestJwtConfig;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class JitProvisioningWebIT extends AbstractWebIT {

  @Autowired private MemberRepository members;

  @Test
  void firstRequestToAReadOnlyEndpointProvisionsTheMemberInsteadOf500() throws Exception {
    String subject = "auth0|jit-readonly-" + UUID.randomUUID();
    String email = "jit-" + UUID.randomUUID() + "@solovis.test";
    assertThat(members.findByAuth0Subject(subject)).isEmpty();

    // GET /api/commits/current is @Transactional(readOnly=true) and resolves the acting member.
    // For a never-seen subject this triggers first-login provisioning (an INSERT) from inside a
    // read-only tx — which used to 500. It must now succeed (204: the new member has no week yet).
    mockMvc
        .perform(get("/api/commits/current").with(TestJwtConfig.employee(subject, email)))
        .andExpect(status().isNoContent());

    assertThat(members.findByAuth0Subject(subject)).isPresent();
  }

  @Test
  void tokenWithoutEmailClaimStillProvisions() throws Exception {
    // A token lacking an email claim must not break the NOT-NULL email/displayName columns — the
    // writer synthesizes deterministic values from the subject.
    String subject = "auth0|jit-noemail-" + UUID.randomUUID();
    mockMvc
        .perform(get("/api/commits/current").with(TestJwtConfig.employee(subject, null)))
        .andExpect(status().isNoContent());

    var provisioned = members.findByAuth0Subject(subject);
    assertThat(provisioned).isPresent();
    assertThat(provisioned.get().getEmail()).isNotBlank();
    assertThat(provisioned.get().getDisplayName()).isNotBlank();
  }
}
