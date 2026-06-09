// CurrentMemberProvider — the "acting member" seam (KTD6). Controllers/services resolve WHO is
// acting from this port, NEVER from the request body, closing the IDOR/BOLA spoofing path. The
// production impl (JwtCurrentMemberProvider, U15) resolves the Member from the validated Auth0 JWT
// subject via just-in-time provisioning; it throws when no acting member can be resolved (401).
package com.solovis.wcm.common;

import com.solovis.wcm.member.Member;

public interface CurrentMemberProvider {

  /**
   * The {@link Member} acting on the current request. Implementations resolve this from a trusted
   * source (the validated Auth0 JWT subject) — never from a client-supplied body field. Throws if
   * no acting member can be resolved.
   */
  Member currentMember();

  /** Convenience: the acting member's id (the row-level authorization key). */
  default java.util.UUID currentMemberId() {
    return currentMember().getId();
  }
}
