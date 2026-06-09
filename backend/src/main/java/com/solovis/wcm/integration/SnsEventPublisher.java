// SnsEventPublisher — the @Profile("aws") EventPublisher (U26/KTD11). Publishes each DomainEvent as
// JSON (DomainEventCodec) to the configured SNS topic (ARN from wcm.aws.topic-arn), with the event
// type as a message attribute so subscribers can filter. SNS fans out to the SQS queue, where the
// SqsEventPoller drains and dispatches to the same consumers the in-process path uses. Replaces
// InProcessEventPublisher under "aws" (exactly one EventPublisher bean active). Must not throw to
// the
// caller's request path — a publish failure is logged, not propagated.
package com.solovis.wcm.integration;

import com.solovis.wcm.event.DomainEvent;
import com.solovis.wcm.event.EventPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.MessageAttributeValue;
import software.amazon.awssdk.services.sns.model.PublishRequest;

@Component
@Profile("aws")
public class SnsEventPublisher implements EventPublisher {

  private static final Logger log = LoggerFactory.getLogger(SnsEventPublisher.class);

  private final SnsClient sns;
  private final DomainEventCodec codec;
  private final AwsProperties props;

  public SnsEventPublisher(SnsClient sns, DomainEventCodec codec, AwsProperties props) {
    this.sns = sns;
    this.codec = codec;
    this.props = props;
  }

  @Override
  public void publish(DomainEvent event) {
    try {
      PublishRequest request =
          PublishRequest.builder()
              .topicArn(props.getTopicArn())
              .message(codec.toJson(event))
              .messageAttributes(
                  java.util.Map.of(
                      "type",
                      MessageAttributeValue.builder()
                          .dataType("String")
                          .stringValue(event.type())
                          .build()))
              .build();
      sns.publish(request);
      log.debug("published {} ({}) to SNS topic", event.type(), event.eventId());
    } catch (RuntimeException e) {
      // Side-effect isolation: never break the request path on a publish failure.
      log.error("failed to publish {} to SNS (non-fatal): {}", event.type(), e.toString());
    }
  }
}
