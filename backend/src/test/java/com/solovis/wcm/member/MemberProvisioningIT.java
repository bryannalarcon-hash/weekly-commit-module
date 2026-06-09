// MemberProvisioningIT — @DataJpaTest proving U6 JIT provisioning and member constraints.
// Covers: first sight of an auth0Subject creates a Member; a second call reuses it (idempotent,
// no duplicate); email/auth0Subject uniqueness is enforced by the DB. Uses real postgres (Flyway
// V2).
package com.solovis.wcm.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.solovis.wcm.AbstractPersistenceIT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;

@Import({MemberProvisioningService.class, MemberProvisioningWriter.class})
class MemberProvisioningIT extends AbstractPersistenceIT {

  @Autowired private MemberProvisioningService provisioning;
  @Autowired private MemberRepository members;

  @Test
  void firstSightCreatesThenSecondCallReusesSameMember() {
    long before = members.count();

    Member first = provisioning.findOrProvision("auth0|jit-1", "jit1@solovis.test", "JIT One");
    Member second = provisioning.findOrProvision("auth0|jit-1", "jit1@solovis.test", "JIT One");

    assertThat(first.getId()).isNotNull();
    assertThat(second.getId()).isEqualTo(first.getId());
    assertThat(first.getRole()).isEqualTo(MemberRole.EMPLOYEE);
    assertThat(members.count()).isEqualTo(before + 1);
  }

  @Test
  void provisioningFallsBackToEmailWhenDisplayNameBlank() {
    Member m = provisioning.findOrProvision("auth0|jit-2", "blank@solovis.test", "  ");
    assertThat(m.getDisplayName()).isEqualTo("blank@solovis.test");
  }

  @Test
  void blankSubjectIsRejected() {
    assertThatThrownBy(() -> provisioning.findOrProvision("  ", "x@solovis.test", "X"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void duplicateAuth0SubjectViolatesUniqueConstraint() {
    members.saveAndFlush(
        Member.builder()
            .email("a@solovis.test")
            .displayName("A")
            .role(MemberRole.EMPLOYEE)
            .auth0Subject("auth0|dup")
            .build());

    assertThatThrownBy(
            () ->
                members.saveAndFlush(
                    Member.builder()
                        .email("b@solovis.test")
                        .displayName("B")
                        .role(MemberRole.EMPLOYEE)
                        .auth0Subject("auth0|dup")
                        .build()))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void duplicateEmailViolatesUniqueConstraint() {
    members.saveAndFlush(
        Member.builder()
            .email("same@solovis.test")
            .displayName("First")
            .role(MemberRole.EMPLOYEE)
            .auth0Subject("auth0|email-1")
            .build());

    assertThatThrownBy(
            () ->
                members.saveAndFlush(
                    Member.builder()
                        .email("same@solovis.test")
                        .displayName("Second")
                        .role(MemberRole.EMPLOYEE)
                        .auth0Subject("auth0|email-2")
                        .build()))
        .isInstanceOf(DataIntegrityViolationException.class);
  }

  @Test
  void managerGraphIsQueryableByManagerId() {
    Member manager =
        members.saveAndFlush(
            Member.builder()
                .email("mgr@solovis.test")
                .displayName("Mgr")
                .role(MemberRole.MANAGER)
                .auth0Subject("auth0|mgr")
                .build());
    members.saveAndFlush(
        Member.builder()
            .email("rep@solovis.test")
            .displayName("Rep")
            .role(MemberRole.EMPLOYEE)
            .auth0Subject("auth0|rep")
            .managerId(manager.getId())
            .build());

    assertThat(members.findByManagerId(manager.getId()))
        .extracting(Member::getEmail)
        .contains("rep@solovis.test");
    assertThat(manager.canReview()).isTrue();
    assertThat(manager.isTopLevel()).isTrue();
  }
}
