// AbstractAuditingEntity — @MappedSuperclass adding created/lastModified audit columns AND
// Persistable support. JPA auditing populates the audit fields via AuditingEntityListener. Entities
// carry caller-ASSIGNED UUID PKs, so Persistable.isNew() (true until first load/persist) tells
// Spring Data to INSERT (persist) instead of merge — fixing FK ordering when a parent and its child
// are saved in one transaction (e.g. the RCDO seed). Concrete entities supply getId() via Lombok.
package com.solovis.wcm.common;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Transient;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.domain.Persistable;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Getter
@Setter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class AbstractAuditingEntity implements Persistable<UUID>, Serializable {

  private static final long serialVersionUID = 1L;

  @CreatedBy
  @Column(name = "created_by", nullable = false, updatable = false, length = 120)
  private String createdBy;

  @CreatedDate
  @Column(name = "created_date", updatable = false)
  private Instant createdDate;

  @LastModifiedBy
  @Column(name = "last_modified_by", length = 120)
  private String lastModifiedBy;

  @LastModifiedDate
  @Column(name = "last_modified_date")
  private Instant lastModifiedDate;

  // Not mapped: transient lifecycle marker. True until the row is loaded or first persisted, so
  // Spring Data issues an INSERT for a manually-assigned PK instead of a merge (which mis-orders
  // FK inserts). Cleared by JPA load/persist callbacks below.
  @Transient
  @Setter(lombok.AccessLevel.NONE)
  @Getter(lombok.AccessLevel.NONE)
  private boolean persisted = false;

  /** Concrete entities expose their UUID PK (Lombok-generated getId on each subclass). */
  @Override
  public abstract UUID getId();

  @Override
  public boolean isNew() {
    return !persisted;
  }

  @PostLoad
  @PostPersist
  void markPersisted() {
    this.persisted = true;
  }
}
