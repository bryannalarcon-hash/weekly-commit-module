// AwsProperties — bound config for the SNS/SQS eventing seam (U26), prefix wcm.aws. Carries the SNS
// topic ARN the SnsEventPublisher publishes to, the SQS queue URL the poller drains, the region,
// and
// an optional endpoint override (LocalStack/test). All env-backed and empty-safe; the SNS/SQS beans
// and the publisher/poller are only active under @Profile("aws"), so the default boot needs none
// set.
package com.solovis.wcm.integration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "wcm.aws")
public class AwsProperties {

  private String topicArn = "";
  private String queueUrl = "";
  private String region = "us-east-1";
  private String endpointOverride = "";

  /** True when an endpoint override (e.g. LocalStack) is configured. */
  public boolean hasEndpointOverride() {
    return endpointOverride != null && !endpointOverride.isBlank();
  }

  public String getTopicArn() {
    return topicArn;
  }

  public void setTopicArn(String topicArn) {
    this.topicArn = topicArn;
  }

  public String getQueueUrl() {
    return queueUrl;
  }

  public void setQueueUrl(String queueUrl) {
    this.queueUrl = queueUrl;
  }

  public String getRegion() {
    return region;
  }

  public void setRegion(String region) {
    this.region = region;
  }

  public String getEndpointOverride() {
    return endpointOverride;
  }

  public void setEndpointOverride(String endpointOverride) {
    this.endpointOverride = endpointOverride;
  }
}
