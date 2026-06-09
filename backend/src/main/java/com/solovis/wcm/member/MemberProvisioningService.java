// MemberProvisioningService — JIT (just-in-time) Member provisioning from an Auth0 identity.
// findOrProvision is idempotent: it resolves an existing Member by auth0Subject (a plain read that
// joins the caller's transaction — the hot path for every request after the first), or, on first
// sight, delegates the INSERT to MemberProvisioningWriter, which runs it in its OWN writable
// (REQUIRES_NEW) transaction. That separation matters because provisioning is triggered lazily from
// JwtCurrentMemberProvider, frequently inside a READ-ONLY service method (a GET resolving the
// acting
// member): a same-tx INSERT there fails ("INSERT in a read-only transaction"). Concurrency-safe
// (the
// writer catches the unique-constraint race). Collaborates with MemberRepository + the writer.
package com.solovis.wcm.member;

import org.springframework.stereotype.Service;

@Service
public class MemberProvisioningService {

  private final MemberRepository memberRepository;
  private final MemberProvisioningWriter writer;

  public MemberProvisioningService(
      MemberRepository memberRepository, MemberProvisioningWriter writer) {
    this.memberRepository = memberRepository;
    this.writer = writer;
  }

  /**
   * Resolve the Member bound to {@code auth0Subject}, creating one on first login. Idempotent: a
   * second call with the same subject returns the already-provisioned row, never a duplicate. The
   * lookup is a read (safe inside a read-only caller tx); the first-login INSERT is delegated to
   * the writer's REQUIRES_NEW transaction so it succeeds regardless of the caller's tx.
   *
   * @param auth0Subject the JWT {@code sub} claim (stable, unique per identity)
   * @param email the email claim used for the new Member's email (synthesized if absent)
   * @param displayName the human-readable name for a newly created Member (synthesized if absent)
   * @return the existing or newly created Member
   */
  public Member findOrProvision(String auth0Subject, String email, String displayName) {
    if (auth0Subject == null || auth0Subject.isBlank()) {
      throw new IllegalArgumentException("auth0Subject is required for provisioning");
    }
    return memberRepository
        .findByAuth0Subject(auth0Subject)
        .orElseGet(() -> writer.insertOrReread(auth0Subject, email, displayName));
  }
}
