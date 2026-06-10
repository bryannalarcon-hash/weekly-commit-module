<!-- docs/layers/04-integrations-eventing.md — Integrations & Eventing layer of the Weekly Commit
     Module. Covers the Outlook/Microsoft Graph integration behind CalendarSyncPort, the per-user
     encrypted delegated-token lifecycle, the commit.locked → consumer → calendar side-effect, and
     the EventPublisher seam (in-process default vs SNS→SQS under the aws profile). Anchored to
     path:line. -->

# Layer 04 — Integrations & Eventing

## Executive summary

Two external integrations sit behind **ports** so the core boots and tests with no live
credentials:

- **(A) Outlook / Microsoft Graph** — `CalendarSyncPort` (`CalendarSyncPort.java:9`) is the outbound
  seam. `StubCalendarAdapter` (`@Profile("!graph")`, `StubCalendarAdapter.java:18`) records calls
  in-memory for tests; `GraphCalendarAdapter` (`@Profile("graph")`, `GraphCalendarAdapter.java:31`)
  POSTs a real **delegated** event to `/me/events`. Each user's `GraphToken` is encrypted at rest
  (`TokenCipher`, AES-256-GCM) and obtained via an Authorization-Code + PKCE-style consent flow
  (`GraphConsentController` + `GraphTokenService`), refreshed before each call
  (`GraphTokenService.java:60`-`:71`). When a commit **LOCKs**, a `commit.locked` domain event drives
  `CommitLockedCalendarConsumer` → `CalendarSyncPort.syncLockedCommit` — and a Graph failure does
  **not** roll back the lock (it is a post-commit side effect, `CommitLockedCalendarConsumer.java:58`-`:60`).

- **(B) Eventing (SNS → SQS)** — lifecycle transitions emit `DomainEvent`s through the
  `EventPublisher` port (`EventPublisher.java:7`). The default `InProcessEventPublisher`
  (`@Profile("!aws")`, `InProcessEventPublisher.java:15`) dispatches synchronously in-VM via Spring's
  `ApplicationEventPublisher`. Under `@Profile("aws")`, `SnsEventPublisher` publishes JSON to an SNS
  topic (`SnsEventPublisher.java:22`) and `SqsEventPoller` long-polls the subscribed queue
  (`SqsEventPoller.java:27`), dispatching to the **same** consumers. Consumers dedup on event id so
  at-least-once redelivery doesn't double-sync (`CommitLockedCalendarConsumer.java:90`-`:94`). All AWS
  beans are profile-gated, so the app boots with no AWS credentials (`AwsClientConfig.java:24`).

```
 LOCK transaction commits ──▶ EventPublisher.publish(commit.locked)
                                         │
        ┌────────────────────────────────┴───────────────────────────────┐
        │ default (!aws)                          │ aws                    │
        ▼                                         ▼                        │
 InProcessEventPublisher                  SnsEventPublisher ─JSON─▶ SNS topic
   (Spring @EventListener)                                          │ fan-out
        │                                                           ▼
        │                                                        SQS queue
        │                                                           │ long-poll
        │                                                  SqsEventPoller.pollOnce()
        │                                                           │
        ▼                                                           ▼
 CommitLockedCalendarConsumer.handle()        EventDispatcher.dispatch()
   (swallows failures)                          → consumer.handleForRedelivery()
        │                                          (re-throws → SQS redrive/DLQ)
        └─────────────────┬─────────────── shared idempotent core (syncOnce)
                          ▼
                 CalendarSyncPort.syncLockedCommit(sync)
                   Stub (test) │ Graph POST /me/events (delegated token)
```

## Responsibilities

- Abstract Outlook calendar writes behind one port with a stub (test) and a real Graph adapter.
- Own the per-user delegated Graph token lifecycle: consent exchange, encrypted persistence,
  refresh-before-use.
- Turn a locked commit into an Outlook calendar event as a **fault-isolated side effect** that never
  breaks the LOCK request path.
- Abstract domain-event publication behind one port with an in-process default and an SNS/SQS impl.
- Guarantee at-least-once-safe processing via event-id idempotency, with SQS redelivery/DLQ on
  failure.
- Keep all external clients profile-gated and empty-safe so the default boot needs no Azure/AWS
  credentials.
- Support the manager-driven ad-hoc scheduling action (CB-1) through the same port.

## Key components

| Component | Path:line | Role |
|---|---|---|
| `CalendarSyncPort` | `…/integration/CalendarSyncPort.java:9` | Outbound port: `syncLockedCommit` + `scheduleEvent` |
| `StubCalendarAdapter` | `…/integration/StubCalendarAdapter.java:18` | `@Profile("!graph")` in-memory adapter; idempotent per commitId |
| `GraphCalendarAdapter` | `…/integration/GraphCalendarAdapter.java:31` | `@Profile("graph")` real delegated `POST /me/events` |
| `LockedCommitSync` | `…/integration/LockedCommitSync.java:12` | Immutable sync payload (commitId = Graph idempotency key) |
| `LockedCommitSyncFactory` | `…/integration/LockedCommitSyncFactory.java:21` | Builds the payload from a commitId (item lines + deep link) |
| `ScheduledEventCommand` | `…/integration/ScheduledEventCommand.java:11` | Immutable CB-1 ad-hoc-event input (organizer + attendee) |
| `GraphConsentController` | `…/integration/GraphConsentController.java:31` | `/connect` · `/callback` · `/status` consent endpoints |
| `GraphTokenService` | `…/integration/GraphTokenService.java:23` | Code exchange, encrypted store, refresh-before-use |
| `GraphToken` | `…/integration/GraphToken.java:30` | One encrypted token row per member, UNIQUE(member_id) |
| `TokenCipher` | `…/integration/TokenCipher.java:19` | AES-256-GCM encrypt/decrypt for tokens at rest |
| `GraphProperties` | `…/integration/GraphProperties.java:10` | `wcm.graph.*` config; authorize/token endpoint helpers |
| `OutlookService` | `…/integration/OutlookService.java:39` | Connection read model, prefs, system-side sync record, CB-1 schedule |
| `OutlookController` | `…/integration/OutlookController.java:26` | `/api/integration/outlook` REST surface |
| `CommitLockedCalendarConsumer` | `…/integration/CommitLockedCalendarConsumer.java:29` | `commit.locked` → calendar sync; idempotent; two failure modes |
| `EventPublisher` | `…/event/EventPublisher.java:7` | Outbound domain-event port |
| `DomainEvent` | `…/event/DomainEvent.java:11` | Immutable event envelope; `COMMIT_LOCKED` slug |
| `InProcessEventPublisher` | `…/event/InProcessEventPublisher.java:16` | `@Profile("!aws")` synchronous in-VM publisher |
| `SnsEventPublisher` | `…/integration/SnsEventPublisher.java:22` | `@Profile("aws")` publish JSON to SNS |
| `SqsEventPoller` | `…/integration/SqsEventPoller.java:27` | `@Profile("aws")` long-poll the queue, dispatch, ack/redrive |
| `EventDispatcher` | `…/integration/EventDispatcher.java:17` | SQS-path router → consumer redelivery variant |
| `DomainEventCodec` | `…/integration/DomainEventCodec.java:19` | JSON encode/decode (unwraps SNS envelope) |
| `AwsClientConfig` | `…/integration/AwsClientConfig.java:25` | `@Profile("aws")` SNS/SQS client beans |
| `AwsProperties` / `GraphProperties` | `…/integration/AwsProperties.java:12` / `GraphProperties.java:10` | `wcm.aws.*` / `wcm.graph.*` bound config |

## Interfaces & contracts

- **`CalendarSyncPort`** (`CalendarSyncPort.java:9`) — two methods:
  - `String syncLockedCommit(LockedCommitSync commit)` — create (or return the existing) event for a
    locked commit; **idempotent by `commit.commitId()`** (`CalendarSyncPort.java:11`-`:16`). The
    stub dedups via `computeIfAbsent` (`StubCalendarAdapter.java:27`-`:28`); Graph dedups via a
    `transactionId` header set to the commitId (`GraphCalendarAdapter.java:75`-`:76`).
  - `String scheduleEvent(ScheduledEventCommand cmd)` — create an ad-hoc event on the **organizer's**
    calendar with the report as a required attendee (CB-1, `CalendarSyncPort.java:18`-`:23`).
- **`EventPublisher`** (`EventPublisher.java:7`) — `void publish(DomainEvent event)`, with the
  contract "**must not throw to the caller's path**" (`EventPublisher.java:9`). `SnsEventPublisher`
  honors this by logging and swallowing publish failures (`SnsEventPublisher.java:53`-`:56`).
- **`DomainEvent`** (`DomainEvent.java:11`) — record `(eventId, type, subjectId, actorId,
  occurredAt)`; `eventId` is unique per publish and is the dedup key; type slugs `commit.locked` /
  `review.completed` are constants (`DomainEvent.java:15`-`:17`); `of(type, subjectId, actorId)`
  stamps a fresh id + `Instant.now()` (`DomainEvent.java:20`-`:22`).
- **`GraphTokenService`** (`GraphTokenService.java:23`):
  - `exchangeCode(memberId, code)` — POST the authorization-code grant, upsert one encrypted row
    (`GraphTokenService.java:50`-`:54`,`:108`-`:114`).
  - `validAccessToken(memberId)` — return a decrypted access token, refreshing first if within the
    5-minute skew of expiry and a refresh token exists (`GraphTokenService.java:25`-`:26`,`:60`-`:71`);
    throws `ResourceNotFoundException` if the member never consented (`:65`-`:66`).
  - `isConnected(memberId)` — true iff a token row exists (`GraphTokenService.java:74`-`:77`).
- **`SqsEventPoller.pollOnce()`** (`SqsEventPoller.java:98`) — receive a batch (wait 20s, batch 10),
  dispatch each, delete only the cleanly-handled ones, return the count; a throwing message is left
  for redelivery (`SqsEventPoller.java:107`-`:121`).
- **`EventDispatcher.dispatch(event)`** (`EventDispatcher.java:34`) — for `commit.locked` calls
  `handleForRedelivery` (failures **propagate**); unknown types are acked (`true`)
  (`EventDispatcher.java:35`-`:40`).
- **REST surface** (`OutlookController.java`): `GET /api/integration/outlook` (connection + prefs,
  `:35`), `POST …/connect` (Entra authorize URL, `:41`), `DELETE …` (disconnect, `:47`),
  `PUT …/settings` (prefs upsert, `:53`), `POST …/schedule` (CB-1, manager-scope gated, `:59`).
  Graph consent: `GET /api/graph/connect|callback|status` (`GraphConsentController.java:51`,`:72`,`:87`).

## Data & state

- **`GraphToken`** (`GraphToken.java:30`) — `graph_token`, `UNIQUE(member_id)`
  (`GraphToken.java:26`-`:29`). `accessTokenEnc` (NOT NULL) and `refreshTokenEnc` (nullable, present
  only when consent included `offline_access`) hold AES-GCM **ciphertext** — plaintext tokens are
  never persisted (`GraphToken.java:40`-`:46`). `expiresAt` drives refresh; `isExpiredAt(asOf)`
  compares against it (`GraphToken.java:64`-`:66`). Mutated only through `GraphTokenService`.
- **`OutlookPreference`** (`OutlookPreference.java:30`) — `outlook_preference`, `UNIQUE(member_id)`;
  `createEventOnLock` (the Settings opt-out toggle) and `lastSyncAt` (the "last synced" indicator).
  Absent row defaults `createEventOnLock` to **true** (`OutlookService.java:78`-`:83`).
- **In-flight dedup state** — `CommitLockedCalendarConsumer.handledEventIds` is an in-memory
  `ConcurrentHashMap.newKeySet()` of seen event ids (`CommitLockedCalendarConsumer.java:38`); a
  failed sync rolls the mark back so a retry can re-run (`CommitLockedCalendarConsumer.java:120`-`:123`).
- **Wire format** — `DomainEventCodec.toJson` writes `{eventId,type,subjectId,actorId,occurredAt}`
  (`DomainEventCodec.java:24`-`:36`); `fromMessageBody` unwraps an SNS notification envelope's
  `Message` field when raw-message-delivery is off (`DomainEventCodec.java:43`-`:51`).
- **Config (env-backed, empty-safe)** — `wcm.graph.*` (`GraphProperties.java:12`-`:19`; default
  scopes `offline_access User.Read Calendars.ReadWrite`, `:16`) and `wcm.aws.*`
  (`AwsProperties.java:14`-`:17`). `GRAPH_TOKEN_ENC_KEY`, `WCM_SNS_TOPIC_ARN`, `WCM_SQS_QUEUE_URL`
  default blank (`application.yml:24`,`:29`,`:31`).

## Dependencies

**Depends on**
- `TokenCipher` (AES-256-GCM at rest) and `GraphConsentState` (signed consent `state`) — both in
  Layer 03; see `03-security-authz.md`.
- `CurrentMemberProvider` — `GraphConsentController`/`OutlookService`/`GraphCalendarAdapter` resolve
  the acting member from the JWT, never a param (`GraphConsentController.java:52`,
  `OutlookService.java:46`, `GraphCalendarAdapter.java:46`).
- Spring `RestClient` for both the Entra token endpoint (`GraphTokenService.java:42`) and Graph
  (`GraphCalendarAdapter.java:53`), built from an injected builder so tests point at a MockWebServer.
- AWS SDK `SnsClient`/`SqsClient` (`AwsClientConfig.java:18`-`:21`), active only under `aws`.
- Commit/member repositories for payload assembly and persistence (`LockedCommitSyncFactory.java:23`-`:24`,
  `OutlookService.java:47`-`:48`).

**Used by**
- The lifecycle transition that LOCKs a commit publishes `commit.locked` via `EventPublisher`
  *(UNVERIFIED: the exact publish call site is in the `commit/` package, not read here)*.
- `CommitLockedCalendarConsumer` consumes the event (in-process `@EventListener`,
  `CommitLockedCalendarConsumer.java:48`) and, on the AWS path, via `EventDispatcher`
  (`EventDispatcher.java:35`).
- `OutlookController` exposes the connection/settings/schedule surface to the frontend Settings and
  manager screens.

## How it works (flow)

**Lock → event → consumer → calendar (in-process default):**

```
1. LifecycleService locks the commit; the transaction COMMITS.
2. EventPublisher.publish(DomainEvent.of("commit.locked", commitId, actorId))
   → InProcessEventPublisher re-publishes on the Spring context   (InProcessEventPublisher.java:25)
3. @EventListener CommitLockedCalendarConsumer.onDomainEvent(...)   (…Consumer.java:48-:53)
      → handle(event)  [in-process: SWALLOWS failures]             (…Consumer.java:62-:72)
        → syncOnce(event):
            a. handledEventIds.add(eventId)? no → skip (dup)        (…Consumer.java:91-:94)
            b. LockedCommitSyncFactory.forCommit(commitId)          (…Consumer.java:96-:97)
            c. OutlookService.createEventOnLockEnabled(memberId)?   (…Consumer.java:103)
                 false → clean skip (mark stays, no redelivery)
            d. CalendarSyncPort.syncLockedCommit(sync)              (…Consumer.java:113)
            e. OutlookService.recordLockSync(...) — eventId onto
               the commit's items, lastSyncAt onto the pref        (…Consumer.java:116)
```

A Graph error inside step 3d is caught by `handle(...)` and logged non-fatally — the LOCK already
committed, so calendar sync is a pure side effect that never rolls it back
(`CommitLockedCalendarConsumer.java:58`-`:60`,`:65`-`:71`).

**Real Graph event body.** `GraphCalendarAdapter.syncLockedCommit` fetches a valid delegated token
for the commit's owner (`GraphCalendarAdapter.java:69`), POSTs `/me/events` with the commit's item
lines + deep-link in an HTML body and the week window as the event window
(`GraphCalendarAdapter.java:70`-`:84`,`:112`-`:122`), and sets `transactionId = commitId` so Graph
itself dedups redeliveries (`GraphCalendarAdapter.java:75`-`:76`).

**Consent / token lifecycle.** `/connect` mints a signed `state` and 302s to Entra
(`GraphConsentController.java:51`-`:68`); the tokenless `/callback` verifies the state, derives the
member, and calls `exchangeCode` (`GraphConsentController.java:72`-`:83`). `exchangeCode` POSTs the
authorization-code grant to the Entra token endpoint (form-encoded, `GraphTokenService.java:108`-`:114`,
`:134`-`:149`) and stores the access/refresh tokens encrypted (`GraphTokenService.java:95`-`:106`).
On read, `validAccessToken` refreshes within a 5-minute skew of expiry using the `refresh_token`
grant, re-encrypting the rotated tokens (`GraphTokenService.java:60`-`:71`,`:85`-`:93`).

**AWS path (SNS → SQS).** Under `aws`, `SnsEventPublisher.publish` serializes the event
(`DomainEventCodec.toJson`) and publishes to the topic with a `type` message attribute for filtering
(`SnsEventPublisher.java:37`-`:51`). SNS fans out to the subscribed SQS queue; `SqsEventPoller`
long-polls (`SqsEventPoller.java:98`-`:123`), decodes each message (`DomainEventCodec.fromMessageBody`,
unwrapping the SNS envelope), and calls `EventDispatcher.dispatch` (`SqsEventPoller.java:109`-`:113`).
`dispatch` routes `commit.locked` to `handleForRedelivery`, whose failure **propagates**
(`EventDispatcher.java:35`-`:37`, `CommitLockedCalendarConsumer.java:81`-`:83`); the poller then
leaves the message so SQS redelivers and, past `maxReceiveCount`, redrives to the DLQ
(`SqsEventPoller.java:114`-`:120`). Because the consumer dedups on `eventId`, an at-least-once
redelivery syncs at most once (`CommitLockedCalendarConsumer.java:90`-`:94`).

**CB-1 manager scheduling.** A manager POSTs `/api/integration/outlook/schedule` (manager-scope
gated). `OutlookService.schedule` loads the report, asserts the acting member is that report's
manager (403 otherwise, 404 unknown report), requires the manager have Outlook connected (409
otherwise), applies subject/duration defaults, and calls `CalendarSyncPort.scheduleEvent`
(`OutlookService.java:167`-`:197`). The Graph adapter creates the event on the organizer's calendar
with the report as a required attendee (`GraphCalendarAdapter.java:89`-`:109`,`:125`-`:143`).

## Design decisions & rationale

- **Port + profile-gated adapters.** `CalendarSyncPort`/`EventPublisher` keep the domain free of
  Graph/AWS; `@Profile` selects exactly one impl per seam, so the default boot is fully functional
  with zero external credentials (`StubCalendarAdapter.java:18`, `InProcessEventPublisher.java:15`,
  `AwsClientConfig.java:24`).
- **Sync is a post-commit side effect, not in the transaction.** The lock commits first; the
  consumer fires afterward and isolates faults, so Outlook being down never fails a user's lock
  (`CommitLockedCalendarConsumer.java:1`-`:14`,`:58`-`:60`).
- **Two failure modes, one idempotent core.** The in-process listener *swallows* failures (the lock
  is already durable), while the SQS path *re-throws* so the message redrives to the DLQ — both share
  `syncOnce`, which dedups on `eventId` and rolls the mark back on failure
  (`CommitLockedCalendarConsumer.java:1`-`:9`,`:90`-`:125`, `EventDispatcher.java:1`-`:8`).
- **Idempotency at three layers.** Event-id dedup in the consumer, `transactionId`/`computeIfAbsent`
  in the adapters, and SQS redrive together make redelivery safe end-to-end
  (`CommitLockedCalendarConsumer.java:91`, `GraphCalendarAdapter.java:76`,
  `StubCalendarAdapter.java:28`).
- **Delegated tokens, encrypted, refreshed lazily.** One row per member, AES-GCM at rest, refreshed
  only within the skew of expiry — minimizes token endpoint calls and never persists plaintext
  (`GraphToken.java:1`-`:6`, `GraphTokenService.java:60`-`:71`).
- **Opt-out toggle defaults to on.** Absent preference ⇒ `createEventOnLock = true`, so the feature
  works out of the box and a *deliberate* opt-out is a clean handle (no redelivery)
  (`OutlookService.java:78`-`:83`, `CommitLockedCalendarConsumer.java:103`-`:109`).
- **Explicit, reflection-free JSON codec.** Keeps the SNS→SQS wire shape stable and unwraps the SNS
  envelope so raw-message-delivery can be on or off (`DomainEventCodec.java:1`-`:7`,`:43`-`:51`).
- **CB-1 schedule is deliberately not `@Transactional`.** Only short repo reads happen before an
  outbound Graph HTTP call, which a DB transaction should not span (`OutlookService.java:159`-`:166`).

## Gotchas & sharp edges

- **`scheduleEvent` is not idempotent.** Unlike `syncLockedCommit`, the CB-1 path has no
  `transactionId`/dedup, so a retried `POST …/schedule` can create duplicate events
  (`GraphCalendarAdapter.java:89`-`:109` — no transactionId).
- **The in-process listener returns *empty* on a swallowed error.** Callers can't tell "skipped" from
  "failed-and-swallowed"; only the SQS path surfaces failure (`CommitLockedCalendarConsumer.java:62`-`:72`).
- **Dedup state is per-process and in-memory.** `handledEventIds` does not survive a restart and is
  not shared across instances; cross-instance idempotency on the AWS path leans on Graph's
  `transactionId`, not this set (`CommitLockedCalendarConsumer.java:38`).
- **`OutlookService.recordLockSync` stamps the event id on *every* item of the commit.** That is the
  port's "stored on the commit" contract, not a per-item id (`OutlookService.java:92`-`:104`).
- **A refresh without a `refresh_token` can't recover.** `validAccessToken` only refreshes when a
  refresh token is present; otherwise an expired access token is returned as-is and the Graph call
  will 401 (`GraphTokenService.java:67`-`:70`).
- **AWS clients exist only under `aws`.** `SnsEventPublisher`/`SqsEventPoller`/`AwsClientConfig` are
  all `@Profile("aws")`; without it the seam is in-process and no AWS creds are read
  (`SnsEventPublisher.java:21`, `SqsEventPoller.java:26`, `AwsClientConfig.java:24`).
- **`SqsEventPoller` auto-starts unless told otherwise.** `wcm.aws.poller.auto-start` defaults true;
  the LocalStack IT disables it to drive `pollOnce()` deterministically (`SqsEventPoller.java:47`,`:60`-`:62`).

## Connects to

- [03-security-authz.md](03-security-authz.md) — `TokenCipher` (at-rest encryption), `GraphConsentState`
  (signed consent `state`), the `permitAll` callback, and the `SCOPE_reconcile:commits` gate on CB-1
  schedule.
- [01-domain-lifecycle.md](01-domain-lifecycle.md) — the LOCK transition that emits `commit.locked`.
- [02-api-contract.md](02-api-contract.md) — the Outlook/Graph REST routes.
