// SnsSqsEventingIT — hermetic proof of the U26 SNS->SQS eventing seam against a LocalStack
// Testcontainer (real SNS + SQS APIs, no AWS account). Boots the app under the "aws" profile so the
// real SnsEventPublisher + SqsEventPoller + AWS clients are wired (endpoint pointed at LocalStack).
// Flow: seed a LOCKED commit -> SnsEventPublisher.publish(commit.locked) -> SNS fans out to the
// subscribed SQS queue -> SqsEventPoller.pollOnce() decodes + dispatches -> CommitLockedCalendar
// consumer calls the StubCalendarAdapter EXACTLY once (idempotent on a second poll of the same
// event).
package com.solovis.wcm.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.solovis.wcm.WcmPostgresContainer;
import com.solovis.wcm.commit.ChessTier;
import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.CommitItemStatus;
import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.event.DomainEvent;
import com.solovis.wcm.event.EventPublisher;
import com.solovis.wcm.member.Member;
import com.solovis.wcm.member.MemberRepository;
import com.solovis.wcm.member.MemberRole;
import java.net.URI;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.localstack.LocalStackContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sns.SnsClient;
import software.amazon.awssdk.services.sns.model.CreateTopicResponse;
import software.amazon.awssdk.services.sns.model.SubscribeRequest;
import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.CreateQueueResponse;
import software.amazon.awssdk.services.sqs.model.GetQueueAttributesRequest;
import software.amazon.awssdk.services.sqs.model.QueueAttributeName;

@SpringBootTest
@ActiveProfiles({"test", "aws"})
@Import(com.solovis.wcm.common.TestJwtConfig.class)
@Testcontainers
class SnsSqsEventingIT {

  @Container
  static final LocalStackContainer LOCALSTACK =
      new LocalStackContainer(DockerImageName.parse("localstack/localstack:3.4"))
          .withServices(LocalStackContainer.Service.SNS, LocalStackContainer.Service.SQS);

  @DynamicPropertySource
  static void wire(DynamicPropertyRegistry registry) {
    // Share the existing Postgres container for the JPA layer the full context needs.
    WcmPostgresContainer.registerDatasource(registry);

    URI endpoint = LOCALSTACK.getEndpoint();
    String region = LOCALSTACK.getRegion();

    // Create the topic + queue and subscribe the queue to the topic BEFORE the context builds, so
    // the app's AwsProperties carry the live ARN/URL.
    try (SnsClient sns = sns(endpoint, region);
        SqsClient sqs = sqs(endpoint, region)) {
      CreateTopicResponse topic = sns.createTopic(b -> b.name("wcm-events"));
      CreateQueueResponse queue = sqs.createQueue(b -> b.queueName("wcm-events-queue"));
      String queueArn =
          sqs.getQueueAttributes(
                  GetQueueAttributesRequest.builder()
                      .queueUrl(queue.queueUrl())
                      .attributeNames(QueueAttributeName.QUEUE_ARN)
                      .build())
              .attributes()
              .get(QueueAttributeName.QUEUE_ARN);
      // Raw message delivery so the SQS body IS the DomainEvent JSON (no SNS envelope to unwrap).
      sns.subscribe(
          SubscribeRequest.builder()
              .topicArn(topic.topicArn())
              .protocol("sqs")
              .endpoint(queueArn)
              .attributes(java.util.Map.of("RawMessageDelivery", "true"))
              .build());

      registry.add("wcm.aws.topic-arn", topic::topicArn);
      registry.add("wcm.aws.queue-url", queue::queueUrl);
      registry.add("wcm.aws.region", () -> region);
      registry.add("wcm.aws.endpoint-override", endpoint::toString);
      // Drive the poller deterministically from the test; no background drain thread.
      registry.add("wcm.aws.poller.auto-start", () -> "false");
    }
  }

  private static SnsClient sns(URI endpoint, String region) {
    return SnsClient.builder()
        .endpointOverride(endpoint)
        .region(Region.of(region))
        .credentialsProvider(
            StaticCredentialsProvider.create(AwsBasicCredentials.create("test", "test")))
        .build();
  }

  private static SqsClient sqs(URI endpoint, String region) {
    return SqsClient.builder()
        .endpointOverride(endpoint)
        .region(Region.of(region))
        .credentialsProvider(
            StaticCredentialsProvider.create(AwsBasicCredentials.create("test", "test")))
        .build();
  }

  @Autowired private EventPublisher publisher; // SnsEventPublisher under "aws"
  @Autowired private SqsEventPoller poller;
  @Autowired private CalendarSyncPort calendarPort; // StubCalendarAdapter
  @Autowired private MemberRepository members;
  @Autowired private WeeklyCommitRepository commits;
  @Autowired private CommitItemRepository items;

  private UUID createdMemberId;
  private UUID createdCommitId;

  // This IT is NOT @Transactional (the SNS->SQS->poll path crosses transactions), so it must clean
  // up the rows it commits — otherwise the count-sensitive DemoSeederIT (which asserts exactly 14
  // members) sees the leftover member. Delete children-first to respect FKs.
  @org.junit.jupiter.api.AfterEach
  void cleanup() {
    if (createdCommitId != null) {
      items.deleteAll(items.findByWeeklyCommitId(createdCommitId));
      commits.deleteById(createdCommitId);
    }
    if (createdMemberId != null) {
      members.deleteById(createdMemberId);
    }
  }

  @Test
  void publishToSnsIsDeliveredToSqsConsumedAndSyncsTheCalendarOnce() {
    // The "aws" profile must have swapped in the SNS publisher, not the in-process one.
    assertThat(publisher).isInstanceOf(SnsEventPublisher.class);
    StubCalendarAdapter stub = (StubCalendarAdapter) calendarPort;

    Member owner =
        members.saveAndFlush(
            Member.builder()
                .email("sns-" + UUID.randomUUID() + "@solovis.test")
                .displayName("sns-owner")
                .role(MemberRole.EMPLOYEE)
                .auth0Subject("auth0|sns-" + UUID.randomUUID())
                .build());
    createdMemberId = owner.getId();
    WeeklyCommit wc =
        commits.saveAndFlush(
            WeeklyCommit.builder()
                .memberId(owner.getId())
                .weekStart(LocalDate.parse("2026-06-08"))
                .lifecycleState(LifecycleState.LOCKED)
                .build());
    createdCommitId = wc.getId();
    items.saveAndFlush(
        CommitItem.builder()
            .weeklyCommitId(wc.getId())
            .text("via SNS->SQS")
            .status(CommitItemStatus.OPEN)
            .chessTier(ChessTier.KING)
            .build());

    DomainEvent event = DomainEvent.of(DomainEvent.COMMIT_LOCKED, wc.getId(), owner.getId());
    int before = stub.syncedCommitCount();

    publisher.publish(event);

    // Poll until the message lands (SNS->SQS fan-out is async) and is consumed (bounded retries).
    pollUntilSynced(stub, wc.getId(), 40);
    assertThat(stub.eventIdFor(wc.getId())).isNotNull();
    assertThat(stub.syncedCommitCount()).isEqualTo(before + 1);

    // Idempotent: re-publishing the SAME event id and polling again does not double-sync.
    publisher.publish(event);
    pollUntilSynced(stub, wc.getId(), 40);
    assertThat(stub.syncedCommitCount()).isEqualTo(before + 1);
  }

  /** Poll the queue (long-poll) up to {@code maxRounds} times or until the commit is synced. */
  private void pollUntilSynced(StubCalendarAdapter stub, UUID commitId, int maxRounds) {
    for (int i = 0; i < maxRounds && stub.eventIdFor(commitId) == null; i++) {
      poller.pollOnce();
    }
  }
}
