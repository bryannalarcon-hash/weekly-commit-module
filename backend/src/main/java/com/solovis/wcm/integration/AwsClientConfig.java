// AwsClientConfig — provides the SNS + SQS clients for the eventing seam, ONLY under
// @Profile("aws")
// (U26). Reads region + an optional endpoint override (LocalStack/test) from AwsProperties. When an
// endpoint override is present (LocalStack), it wires static dummy credentials (LocalStack accepts
// any); otherwise it uses the default AWS credentials provider chain (IRSA/role on EKS). Inactive
// by
// default, so the app boots with no AWS account configured.
package com.solovis.wcm.integration;

import java.net.URI;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.SnsClientBuilder;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.SqsClientBuilder;

@Configuration
@Profile("aws")
public class AwsClientConfig {

  @Bean(destroyMethod = "close")
  public SnsClient snsClient(AwsProperties props) {
    SnsClientBuilder builder = SnsClient.builder().region(Region.of(props.getRegion()));
    applyEndpointAndCreds(props, builder::endpointOverride, builder::credentialsProvider);
    return builder.build();
  }

  @Bean(destroyMethod = "close")
  public SqsClient sqsClient(AwsProperties props) {
    SqsClientBuilder builder = SqsClient.builder().region(Region.of(props.getRegion()));
    applyEndpointAndCreds(props, builder::endpointOverride, builder::credentialsProvider);
    return builder.build();
  }

  /**
   * Shared wiring: endpoint override + creds (static dummy for LocalStack, default chain for AWS).
   */
  private static void applyEndpointAndCreds(
      AwsProperties props,
      java.util.function.Consumer<URI> endpointSetter,
      java.util.function.Consumer<software.amazon.awssdk.auth.credentials.AwsCredentialsProvider>
          credsSetter) {
    if (props.hasEndpointOverride()) {
      endpointSetter.accept(URI.create(props.getEndpointOverride()));
      credsSetter.accept(
          StaticCredentialsProvider.create(AwsBasicCredentials.create("test", "test")));
    } else {
      credsSetter.accept(DefaultCredentialsProvider.create());
    }
  }
}
