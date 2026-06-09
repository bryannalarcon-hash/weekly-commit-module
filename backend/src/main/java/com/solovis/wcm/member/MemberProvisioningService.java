// MemberProvisioningService — JIT (just-in-time) Member provisioning from an Auth0 identity.
// findOrProvision is idempotent: it resolves an existing Member by auth0Subject, or creates a
// new EMPLOYEE on first sight. Concurrency-safe: if two simultaneous first-logins race to INSERT
// the
// same subject, the loser's unique-constraint violation is caught and the now-committed row
// re-read,
// so a single Member is always returned. Collaborates with MemberRepository; single transaction.
package com.solovis.wcm.member;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberProvisioningService {

  private final MemberRepository memberRepository;

  public MemberProvisioningService(MemberRepository memberRepository) {
    this.memberRepository = memberRepository;
  }

  /**
   * Resolve the Member bound to {@code auth0Subject}, creating one on first login. Idempotent: a
   * second call with the same subject returns the already-provisioned row, never a duplicate.
   *
   * @param auth0Subject the JWT {@code sub} claim (stable, unique per identity)
   * @param email the email claim used for the new Member's email
   * @param displayName the human-readable name for a newly created Member
   * @return the existing or newly created Member
   */
  @Transactional
  public Member findOrProvision(String auth0Subject, String email, String displayName) {
    if (auth0Subject == null || auth0Subject.isBlank()) {
      throw new IllegalArgumentException("auth0Subject is required for provisioning");
    }
    return memberRepository
        .findByAuth0Subject(auth0Subject)
        .orElseGet(() -> insertOrReread(auth0Subject, email, displayName));
  }

  /**
   * Insert a fresh EMPLOYEE for {@code auth0Subject}; if a concurrent first-login already inserted
   * it (unique-constraint race), re-read and return the now-committed row instead of failing.
   */
  private Member insertOrReread(String auth0Subject, String email, String displayName) {
    try {
      return memberRepository.saveAndFlush(buildEmployee(auth0Subject, email, displayName));
    } catch (DataIntegrityViolationException race) {
      return memberRepository.findByAuth0Subject(auth0Subject).orElseThrow(() -> race);
    }
  }

  private Member buildEmployee(String auth0Subject, String email, String displayName) {
    return Member.builder()
        .auth0Subject(auth0Subject)
        .email(email)
        .displayName(displayName == null || displayName.isBlank() ? email : displayName)
        .role(MemberRole.EMPLOYEE)
        .build();
  }
}
