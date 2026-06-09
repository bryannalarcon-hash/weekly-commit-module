// MemberProvisioningWriter — performs the JIT Member INSERT in its OWN writable transaction
// (REQUIRES_NEW). This is separated from MemberProvisioningService so the transaction boundary is
// applied through the Spring proxy (not a same-class self-invocation): first-login provisioning is
// triggered lazily by JwtCurrentMemberProvider, which often runs inside a read-only service method
// (e.g. a GET that resolves the acting member) — joining that read-only tx made the INSERT fail
// ("cannot execute INSERT in a read-only transaction"). REQUIRES_NEW suspends the caller's tx and
// commits the new Member independently. Concurrency-safe: a unique-constraint race is caught and
// the
// now-committed row re-read.
package com.solovis.wcm.member;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberProvisioningWriter {

  private final MemberRepository members;

  public MemberProvisioningWriter(MemberRepository members) {
    this.members = members;
  }

  /**
   * Insert a fresh EMPLOYEE for {@code auth0Subject} in a NEW writable transaction; if a concurrent
   * first-login already inserted it, re-read and return the committed row. Always runs writable,
   * even when the calling service method holds a read-only transaction.
   */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public Member insertOrReread(String auth0Subject, String email, String displayName) {
    try {
      return members.saveAndFlush(buildEmployee(auth0Subject, email, displayName));
    } catch (DataIntegrityViolationException race) {
      return members.findByAuth0Subject(auth0Subject).orElseThrow(() -> race);
    }
  }

  /**
   * Build a new EMPLOYEE. email/displayName are NOT NULL columns, so when a token omits those
   * claims (e.g. a missing {@code email} scope, or a non-interactive client) we synthesize stable,
   * deterministic, unique values from the subject rather than failing the INSERT.
   */
  private Member buildEmployee(String auth0Subject, String email, String displayName) {
    String safeEmail =
        (email != null && !email.isBlank())
            ? email
            : auth0Subject.replaceAll("[^A-Za-z0-9._-]", "_") + "@users.noreply.wcm";
    String safeName =
        (displayName != null && !displayName.isBlank())
            ? displayName
            : (email != null && !email.isBlank() ? email : auth0Subject);
    return Member.builder()
        .auth0Subject(auth0Subject)
        .email(safeEmail)
        .displayName(safeName)
        .role(MemberRole.EMPLOYEE)
        .build();
  }
}
