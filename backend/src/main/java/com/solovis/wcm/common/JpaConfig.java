// JpaConfig — enables Spring Data JPA auditing for the backend.
// Supplies an AuditorAware that resolves the current principal (or "system") for
// @CreatedBy/@LastModifiedBy.
package com.solovis.wcm.common;

import java.util.Optional;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaConfig {

  @Bean
  public AuditorAware<String> auditorProvider() {
    return () -> {
      Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
      if (authentication != null
          && authentication.isAuthenticated()
          && authentication.getName() != null) {
        return Optional.of(authentication.getName());
      }
      return Optional.of("system");
    };
  }
}
