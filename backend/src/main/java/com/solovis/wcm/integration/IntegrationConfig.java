// IntegrationConfig — registers the @ConfigurationProperties for the external integrations
// (U16/U26):
// GraphProperties (wcm.graph.*) and AwsProperties (wcm.aws.*). Beans for the Graph RestClient are
// built inside each adapter from the injected RestClient.Builder; the AWS SNS/SQS clients are
// provided by AwsClientConfig under @Profile("aws"). Pure wiring — no business logic.
package com.solovis.wcm.integration;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({GraphProperties.class, AwsProperties.class})
public class IntegrationConfig {}
