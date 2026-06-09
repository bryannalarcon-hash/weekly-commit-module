// NotificationPreference — a member's email-notification toggles for the Settings > Account tab,
// maps notification_preference, UNIQUE(member_id). Holds the five boolean flags (lock/review/
// reconciled/weekly-digest/reminder emails). Extends AbstractAuditingEntity; assigned UUID PK.
// Lazy-created with all-true defaults on first read and upserted on the settings PUT
// (SettingsService).
package com.solovis.wcm.settings;

import com.solovis.wcm.common.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(
    name = "notification_preference",
    uniqueConstraints =
        @UniqueConstraint(name = "uq_notification_preference_member", columnNames = "member_id"))
public class NotificationPreference extends AbstractAuditingEntity {

  // Application-assigned UUID PK (no @GeneratedValue); Persistable.isNew() drives INSERT vs merge.
  @Id
  @Column(name = "id", nullable = false, updatable = false)
  private UUID id;

  @Column(name = "member_id", nullable = false)
  private UUID memberId;

  @Column(name = "email_on_lock", nullable = false)
  private boolean emailOnLock;

  @Column(name = "email_on_review", nullable = false)
  private boolean emailOnReview;

  @Column(name = "email_on_reconciled", nullable = false)
  private boolean emailOnReconciled;

  @Column(name = "weekly_digest", nullable = false)
  private boolean weeklyDigest;

  @Column(name = "reminder_emails", nullable = false)
  private boolean reminderEmails;

  @Builder
  private NotificationPreference(
      UUID id,
      UUID memberId,
      boolean emailOnLock,
      boolean emailOnReview,
      boolean emailOnReconciled,
      boolean weeklyDigest,
      boolean reminderEmails) {
    this.id = id == null ? UUID.randomUUID() : id;
    this.memberId = memberId;
    this.emailOnLock = emailOnLock;
    this.emailOnReview = emailOnReview;
    this.emailOnReconciled = emailOnReconciled;
    this.weeklyDigest = weeklyDigest;
    this.reminderEmails = reminderEmails;
  }
}
