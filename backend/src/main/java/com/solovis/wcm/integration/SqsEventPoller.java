// SqsEventPoller — drains the SQS queue subscribed to the SNS topic and dispatches each DomainEvent
// to the shared EventDispatcher (U26/KTD11), @Profile("aws"). Long-polls (wait-time 20s, batch 10);
// on a successfully handled message it DELETES it (ack); on a dispatch error it LEAVES the message
// so
// SQS redelivers and, past maxReceiveCount, redrives to the DLQ (DLQ-aware). Idempotency is owned
// by
// the consumers (event-id dedup), so an at-least-once redelivery syncs at most once. pollOnce() is
// the deterministic unit the LocalStack IT calls; start() runs it on a daemon loop in production.
package com.solovis.wcm.integration;

import com.solovis.wcm.event.DomainEvent;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.DeleteMessageRequest;
import software.amazon.awssdk.services.sqs.model.Message;
import software.amazon.awssdk.services.sqs.model.ReceiveMessageRequest;

@Component
@Profile("aws")
public class SqsEventPoller {

  private static final Logger log = LoggerFactory.getLogger(SqsEventPoller.class);
  private static final int WAIT_SECONDS = 20;
  private static final int BATCH = 10;

  private final SqsClient sqs;
  private final DomainEventCodec codec;
  private final EventDispatcher dispatcher;
  private final AwsProperties props;

  private final boolean autoStart;
  private volatile boolean running;
  private Thread loopThread;

  public SqsEventPoller(
      SqsClient sqs,
      DomainEventCodec codec,
      EventDispatcher dispatcher,
      AwsProperties props,
      @Value("${wcm.aws.poller.auto-start:true}") boolean autoStart) {
    this.sqs = sqs;
    this.codec = codec;
    this.dispatcher = dispatcher;
    this.props = props;
    this.autoStart = autoStart;
  }

  /**
   * Start the background long-poll loop (production). No-op if the queue URL is unset OR auto-start
   * is disabled (the LocalStack IT disables it and drives pollOnce() deterministically instead).
   */
  @PostConstruct
  public void start() {
    if (!autoStart) {
      log.info("SQS poller auto-start disabled; pollOnce() must be driven explicitly");
      return;
    }
    if (props.getQueueUrl() == null || props.getQueueUrl().isBlank()) {
      log.warn("no SQS queue url configured; poller idle");
      return;
    }
    running = true;
    loopThread = new Thread(this::loop, "sqs-event-poller");
    loopThread.setDaemon(true);
    loopThread.start();
  }

  @PreDestroy
  public void stop() {
    running = false;
    if (loopThread != null) {
      loopThread.interrupt();
    }
  }

  private void loop() {
    while (running) {
      try {
        pollOnce();
      } catch (RuntimeException e) {
        log.error("SQS poll loop error (continuing): {}", e.toString());
      }
    }
  }

  /**
   * Receive a batch (long-poll), dispatch each event, and delete the ones handled cleanly. Returns
   * how many messages were handled+deleted. A message that throws during dispatch is left on the
   * queue for SQS redelivery / DLQ redrive.
   */
  public int pollOnce() {
    ReceiveMessageRequest request =
        ReceiveMessageRequest.builder()
            .queueUrl(props.getQueueUrl())
            .maxNumberOfMessages(BATCH)
            .waitTimeSeconds(WAIT_SECONDS)
            .build();
    List<Message> messages = sqs.receiveMessage(request).messages();
    int handled = 0;
    for (Message message : messages) {
      try {
        DomainEvent event = codec.fromMessageBody(message.body());
        if (dispatcher.dispatch(event)) {
          delete(message);
          handled++;
        }
      } catch (RuntimeException e) {
        // Leave the message: SQS will redeliver, then redrive to the DLQ past maxReceiveCount.
        log.error(
            "failed to handle SQS message {} (left for redrive): {}",
            message.messageId(),
            e.toString());
      }
    }
    return handled;
  }

  private void delete(Message message) {
    sqs.deleteMessage(
        DeleteMessageRequest.builder()
            .queueUrl(props.getQueueUrl())
            .receiptHandle(message.receiptHandle())
            .build());
  }
}
