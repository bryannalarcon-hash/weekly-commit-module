// MemberAccountService — read/update the acting member's own profile for the Settings > Account
// tab.
// Resolves WHO from CurrentMemberProvider (KTD6 — never a body id), re-loads the managed Member by
// id (404 ResourceNotFoundException if it vanished), and applies displayName + a validated IANA
// timezone. Blank/null timezone clears it; a non-blank value that is not a java.time.ZoneId raises
// IllegalArgumentException -> 400 via ApiExceptionHandler. email/role are NOT editable here.
package com.solovis.wcm.member;

import com.solovis.wcm.common.CurrentMemberProvider;
import com.solovis.wcm.common.ResourceNotFoundException;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberAccountService {

  private final MemberRepository members;
  private final CurrentMemberProvider currentMember;

  public MemberAccountService(MemberRepository members, CurrentMemberProvider currentMember) {
    this.members = members;
    this.currentMember = currentMember;
  }

  /** The acting member's own profile row (404 if it no longer exists). */
  @Transactional(readOnly = true)
  public Member currentAccount() {
    return loadActing();
  }

  /**
   * Update the acting member's own displayName + timezone. timezone must be a valid {@link ZoneId}
   * when non-blank, else {@link IllegalArgumentException} -> 400; blank/null clears it.
   */
  @Transactional
  public Member updateAccount(String displayName, String timezone) {
    Member member = loadActing();
    member.setDisplayName(displayName);
    member.setTimezone(normalizeTimezone(timezone));
    return members.save(member);
  }

  private Member loadActing() {
    UUID id = currentMember.currentMemberId();
    return members
        .findById(id)
        .orElseThrow(() -> new ResourceNotFoundException("acting member not found: " + id));
  }

  /** null/blank -> null (cleared); otherwise must parse as a {@link ZoneId} or 400. */
  private static String normalizeTimezone(String timezone) {
    if (timezone == null || timezone.isBlank()) {
      return null;
    }
    String trimmed = timezone.trim();
    try {
      ZoneId.of(trimmed);
    } catch (DateTimeException ex) {
      throw new IllegalArgumentException("timezone '" + trimmed + "' is not a valid time zone");
    }
    return trimmed;
  }
}
