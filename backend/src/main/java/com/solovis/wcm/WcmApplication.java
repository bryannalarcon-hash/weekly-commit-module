// WcmApplication — Spring Boot entry point for the Weekly Commit Module backend.
// Bootstraps component scanning, JPA, Flyway and the web layer under com.solovis.wcm.
package com.solovis.wcm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class WcmApplication {

  public static void main(String[] args) {
    SpringApplication.run(WcmApplication.class, args);
  }
}
