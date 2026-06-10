// DemoSeeder — @Profile("demo") CommandLineRunner that loads the SOLOVIS_SEED.md fixture:
// the RCDO tree (RallyCry -> ... -> SupportingOutcomes), the 14-member manager graph (1 exec + 4
// line managers + 9 ICs), and sample weekly commits across lifecycle states. Post-DRAFT commits
// also
// get the rows their state's FSM invariants require: a frozen CommitSnapshot (+ SnapshotItems) for
// any LOCKED/RECONCILING/RECONCILED commit, and a ManagerReview (REVIEWED for RECONCILED).
// Determin-
// istic (fixed UUIDs via deterministicId) and idempotent (skips when the rally cry already exists),
// so hermetic tests stay clean and E2E/live suites can reference rows by id. NOT a Flyway
// migration.
package com.solovis.wcm.member;

import com.solovis.wcm.commit.ChessTier;
import com.solovis.wcm.commit.CommitItem;
import com.solovis.wcm.commit.CommitItemRepository;
import com.solovis.wcm.commit.CommitItemStatus;
import com.solovis.wcm.commit.CommitSnapshot;
import com.solovis.wcm.commit.CommitSnapshotRepository;
import com.solovis.wcm.commit.LifecycleState;
import com.solovis.wcm.commit.SnapshotItem;
import com.solovis.wcm.commit.SnapshotItemRepository;
import com.solovis.wcm.commit.WeeklyCommit;
import com.solovis.wcm.commit.WeeklyCommitRepository;
import com.solovis.wcm.rcdo.DefiningObjective;
import com.solovis.wcm.rcdo.Outcome;
import com.solovis.wcm.rcdo.RallyCry;
import com.solovis.wcm.rcdo.RcdoRepository;
import com.solovis.wcm.rcdo.SupportingOutcome;
import com.solovis.wcm.review.ManagerReview;
import com.solovis.wcm.review.ManagerReviewRepository;
import com.solovis.wcm.review.ReviewState;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("demo")
public class DemoSeeder implements CommandLineRunner {

  private static final UUID NAMESPACE = UUID.fromString("9f1c0b7e-2a4d-4c3b-8e6a-000000000000");

  private final TeamRepository teams;
  private final MemberRepository members;
  private final RcdoRepository rcdo;
  private final WeeklyCommitRepository commits;
  private final CommitItemRepository commitItems;
  private final CommitSnapshotRepository snapshots;
  private final SnapshotItemRepository snapshotItems;
  private final ManagerReviewRepository reviews;

  public DemoSeeder(
      TeamRepository teams,
      MemberRepository members,
      RcdoRepository rcdo,
      WeeklyCommitRepository commits,
      CommitItemRepository commitItems,
      CommitSnapshotRepository snapshots,
      SnapshotItemRepository snapshotItems,
      ManagerReviewRepository reviews) {
    this.teams = teams;
    this.members = members;
    this.rcdo = rcdo;
    this.commits = commits;
    this.commitItems = commitItems;
    this.snapshots = snapshots;
    this.snapshotItems = snapshotItems;
    this.reviews = reviews;
  }

  /** Stable UUID for a logical key so reruns and external suites reference identical rows. */
  public static UUID deterministicId(String key) {
    byte[] raw = (NAMESPACE + ":" + key).getBytes(StandardCharsets.UTF_8);
    return UUID.nameUUIDFromBytes(raw);
  }

  @Override
  @Transactional
  public void run(String... args) {
    seed();
  }

  /** Idempotent entry point: a no-op when the seed rally cry already exists. */
  @Transactional
  public void seed() {
    UUID rallyId = deterministicId("rally:total-portfolio-intelligence");
    if (rcdo.findAllRallyCries().stream().anyMatch(rc -> rallyId.equals(rc.getId()))) {
      return;
    }
    seedRcdo(rallyId);
    seedTeamsAndMembers();
    seedSampleCommits();
  }

  // --- RCDO tree (SOLOVIS_SEED.md) -------------------------------------------------------------

  private void seedRcdo(UUID rallyId) {
    RallyCry rally =
        RallyCry.builder()
            .id(rallyId)
            .title("Become the system of record for total-portfolio intelligence.")
            .description("Annual thematic Rally Cry.")
            .build();
    rcdo.save(rally);

    DefiningObjective do1 = objective(rallyId, "do1", "Unify public & private markets in one view");
    DefiningObjective do2 =
        objective(rallyId, "do2", "Deliver institutional-grade risk & exposure analytics");
    DefiningObjective do3 = objective(rallyId, "do3", "Compress client reporting turnaround");
    DefiningObjective do4 = objective(rallyId, "do4", "Scale data operations");
    DefiningObjective do5 = objective(rallyId, "do5", "Deepen asset-owner adoption & retention");

    Outcome o11 = outcome(do1.getId(), "o1.1", "Single source of truth across asset classes");
    so(o11.getId(), "so1.1.a", "Ingest private-capital statements (PCAP) for top 20 GPs");
    so(o11.getId(), "so1.1.b", "Normalize public holdings from 3 custodians into the model");
    so(o11.getId(), "so1.1.c", "Reconcile look-through exposures across commingled funds");
    Outcome o12 = outcome(do1.getId(), "o1.2", "Near-real-time position freshness");
    so(o12.getId(), "so1.2.a", "Cut position staleness to < 24h for public holdings");
    so(o12.getId(), "so1.2.b", "Automated capital-call / distribution capture");

    Outcome o21 = outcome(do2.getId(), "o2.1", "Factor & scenario coverage across the portfolio");
    so(o21.getId(), "so2.1.a", "Ship factor-based risk for private + public sleeves");
    so(o21.getId(), "so2.1.b", "Historical scenario library (2008, 2020, rate shock)");
    Outcome o22 = outcome(do2.getId(), "o2.2", "Liquidity & commitment analytics");
    so(o22.getId(), "so2.2.a", "Commitment-pacing model for private programs");
    so(o22.getId(), "so2.2.b", "Liquidity-coverage dashboard for the CIO");

    Outcome o31 = outcome(do3.getId(), "o3.1", "Board-ready reporting in days, not weeks");
    so(o31.getId(), "so3.1.a", "Templated quarterly board book auto-generation");
    so(o31.getId(), "so3.1.b", "Self-serve report builder for analysts");
    Outcome o32 = outcome(do3.getId(), "o3.2", "Reporting accuracy & auditability");
    so(o32.getId(), "so3.2.a", "Full audit trail on every reported figure");

    Outcome o41 = outcome(do4.getId(), "o4.1", "Offload manager/custodian data collection");
    so(o41.getId(), "so4.1.a", "Onboard 10 new managers to automated feeds");
    so(o41.getId(), "so4.1.b", "Exception-driven data-validation workflow");
    Outcome o42 = outcome(do4.getId(), "o4.2", "Operational resilience");
    so(o42.getId(), "so4.2.a", "SLA: 99.5% on daily data loads");

    Outcome o51 = outcome(do5.getId(), "o5.1", "Activate the CIO office workflows");
    so(o51.getId(), "so5.1.a", "Weekly CIO portfolio review live for 5 flagship clients");
    so(o51.getId(), "so5.1.b", "In-app alerting on mandate breaches");
    Outcome o52 = outcome(do5.getId(), "o5.2", "Reduce time-to-value for new clients");
    so(o52.getId(), "so5.2.a", "Onboarding playbook -> first insight in < 30 days");
  }

  private DefiningObjective objective(UUID rallyId, String slug, String title) {
    DefiningObjective o =
        DefiningObjective.builder()
            .id(deterministicId("do:" + slug))
            .rallyCryId(rallyId)
            .title(title)
            .build();
    return rcdo.save(o);
  }

  private Outcome outcome(UUID objectiveId, String slug, String title) {
    Outcome o =
        Outcome.builder()
            .id(deterministicId("o:" + slug))
            .definingObjectiveId(objectiveId)
            .title(title)
            .build();
    return rcdo.save(o);
  }

  private SupportingOutcome so(UUID outcomeId, String slug, String title) {
    SupportingOutcome o =
        SupportingOutcome.builder()
            .id(deterministicId("so:" + slug))
            .outcomeId(outcomeId)
            .ownerId(null)
            .title(title)
            .build();
    return rcdo.save(o);
  }

  // --- Teams & manager graph (~13 members) -----------------------------------------------------

  private void seedTeamsAndMembers() {
    Team product = team("Product", TeamType.DEPARTMENT, null);
    Team dataOps = team("Data Operations", TeamType.GROUP, product.getId());
    Team risk = team("Risk Analytics", TeamType.GROUP, product.getId());
    Team reporting = team("Client Reporting", TeamType.GROUP, product.getId());
    Team platform = team("Platform Engineering", TeamType.GROUP, product.getId());

    Member sofia =
        member(
            "sofia",
            "Sofia Romano",
            "sofia@solovis.test",
            "CPO",
            null,
            MemberRole.MANAGER,
            product.getId());

    Member priya = manager("priya", "Priya Menon", "Data Ops Lead", sofia, dataOps);
    Member marcus = manager("marcus", "Marcus Hale", "Risk Lead", sofia, risk);
    Member aisha = manager("aisha", "Aisha Bello", "Reporting Lead", sofia, reporting);
    Member wei = manager("wei", "Wei Zhang", "Platform Lead", sofia, platform);

    ic("diego", "Diego Alvarez", "Data Engineer", priya, dataOps);
    ic("sana", "Sana Khan", "Data Analyst", priya, dataOps);
    ic("tom", "Tom Becker", "Data Engineer", priya, dataOps);

    ic("lena", "Lena Vogt", "Risk Analyst", marcus, risk);
    ic("raj", "Raj Patel", "Quant", marcus, risk);

    ic("noah", "Noah Fisher", "Reporting Analyst", aisha, reporting);
    ic("grace", "Grace Lin", "Reporting Analyst", aisha, reporting);

    ic("omar", "Omar Haddad", "Platform Engineer", wei, platform);
    ic("ella", "Ella Novak", "Platform Engineer", wei, platform);
  }

  private Team team(String name, TeamType type, UUID parentId) {
    Team t =
        Team.builder()
            .id(deterministicId("team:" + name))
            .name(name)
            .type(type)
            .parentTeamId(parentId)
            .build();
    // saveAndFlush so a referenced parent (team/member/commit) exists before its child's FK is
    // inserted within this single seeding transaction (UUID FKs are opaque to Hibernate ordering).
    return teams.saveAndFlush(t);
  }

  private Member manager(String slug, String name, String title, Member managerOf, Team team) {
    return member(
        slug, name, slug + "@solovis.test", title, managerOf, MemberRole.MANAGER, team.getId());
  }

  private Member ic(String slug, String name, String title, Member managerOf, Team team) {
    return member(
        slug, name, slug + "@solovis.test", title, managerOf, MemberRole.EMPLOYEE, team.getId());
  }

  private Member member(
      String slug,
      String name,
      String email,
      String title,
      Member manager,
      MemberRole role,
      UUID teamId) {
    String subject = resolveSubject(slug);
    UUID seedId = deterministicId("member:" + slug);
    // A request can race boot and JIT-provision this auth0Subject BEFORE the seeder runs (Tomcat
    // accepts traffic before CommandLineRunners finish — e.g. a real login during startup, or a
    // verification probe). That stub has a random id and no domain data; the seed identity (the
    // deterministic id the seeded commits/reviews reference) must win, so adopt the subject by
    // deleting the stub first. A stub that already owns data would FK-fail loudly — correct, since
    // silently dropping user data would be worse.
    members
        .findByAuth0Subject(subject)
        .filter(existing -> !seedId.equals(existing.getId()))
        .ifPresent(
            stub -> {
              members.delete(stub);
              members.flush();
            });
    Member m =
        Member.builder()
            .id(seedId)
            .email(email)
            .displayName(name)
            .title(title)
            .managerId(manager == null ? null : manager.getId())
            .role(role)
            .auth0Subject(subject)
            .teamId(teamId)
            .build();
    return members.saveAndFlush(m);
  }

  /**
   * The auth0Subject a seeded member matches on. Defaults to the hermetic "auth0|seed-&lt;slug&gt;"
   * (used by the E2E X-Debug-Member path and the demo). For a LIVE Auth0 demo, three role-anchor
   * members can be re-pointed at REAL Auth0 user subjects via env vars so a real browser login
   * lands on the already-rich seeded member (its manager graph + commits + reconciliations):
   * sofia=admin (top-level + admin:rcdo role), priya=manager (has reports), diego=employee (full
   * commit history). Unset env (tests/e2e/normal boot) keeps the seed subject, so behavior is
   * unchanged there.
   */
  private static String resolveSubject(String slug) {
    String override =
        switch (slug) {
          case "sofia" -> System.getenv("DEMO_ADMIN_AUTH0_SUB");
          case "priya" -> System.getenv("DEMO_MANAGER_AUTH0_SUB");
          case "diego" -> System.getenv("DEMO_EMPLOYEE_AUTH0_SUB");
          default -> null;
        };
    return (override != null && !override.isBlank()) ? override.trim() : "auth0|seed-" + slug;
  }

  // --- Sample weekly commits across lifecycle states -------------------------------------------

  /**
   * Seed the sample weekly commits across lifecycle states. Public +
   * idempotent-by-truncate-then-seed so the E2E reset endpoint (E2eResetController) can restore the
   * per-scenario baseline; the normal boot path calls it once via {@link #seed()}.
   */
  @Transactional
  public void seedSampleCommits() {
    LocalDate currentWeek =
        LocalDate.now().with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
    LocalDate priorWeek = currentWeek.minusWeeks(1);
    Instant lockedAt = Instant.parse("2026-06-01T09:00:00Z");

    // Diego: RECONCILED, 3 items, one carried forward. Reviewer = Diego's manager (Priya).
    WeeklyCommit diego =
        commit(
            "commit:diego",
            deterministicId("member:diego"),
            currentWeek,
            LifecycleState.RECONCILED);
    item(
        "item:diego:1",
        diego,
        "PCAP ingest for top GPs",
        CommitItemStatus.COMPLETE,
        "so:so1.1.a",
        ChessTier.KING);
    item(
        "item:diego:2",
        diego,
        "Manager feed onboarding",
        CommitItemStatus.INCOMPLETE,
        "so:so4.1.a",
        ChessTier.ROOK);
    item(
        "item:diego:3",
        diego,
        "Capital-call capture",
        CommitItemStatus.COMPLETE,
        "so:so1.2.b",
        ChessTier.PAWN);
    freezeSnapshot("snapshot:diego", diego, lockedAt);
    reviewedReview("review:diego", diego, deterministicId("member:priya"), lockedAt);

    // Sana (Priya's report): LOCKED current week, 2 items — awaiting Priya's review. A LOCKED
    // commit
    // already carries a frozen snapshot, no review yet. Owning this to a demo persona (not a member
    // outside the bypass list) is what makes "act as Sana" + Priya's review queue actually
    // populate.
    WeeklyCommit sana =
        commit("commit:sana", deterministicId("member:sana"), currentWeek, LifecycleState.LOCKED);
    item(
        "item:sana:1",
        sana,
        "PCAP statement variance reconciliation",
        CommitItemStatus.OPEN,
        "so:so1.1.a",
        ChessTier.QUEEN);
    item(
        "item:sana:2",
        sana,
        "Capital-call capture QA pass",
        CommitItemStatus.OPEN,
        "so:so1.2.b",
        ChessTier.KNIGHT);
    freezeSnapshot("snapshot:sana", sana, lockedAt);

    // Tom (Priya's report): DRAFT current week, one item still unlinked (to show the submit guard).
    // No snapshot/review for a DRAFT.
    WeeklyCommit tom =
        commit("commit:tom", deterministicId("member:tom"), currentWeek, LifecycleState.DRAFT);
    item(
        "item:tom:1",
        tom,
        "Manager feed onboarding automation",
        CommitItemStatus.OPEN,
        "so:so4.1.a",
        ChessTier.ROOK);
    item(
        "item:tom:2",
        tom,
        "Ingest pipeline audit trail",
        CommitItemStatus.OPEN,
        null,
        ChessTier.BISHOP);

    // Omar: RECONCILING prior week, planned-vs-actual gap (1 incomplete). Snapshot frozen at lock.
    // The IC (Omar) is still reconciling, so there is NO ManagerReview yet — the manager reviews
    // only AFTER reconciliation completes (RECONCILED). A RECONCILING commit carries no review.
    WeeklyCommit omar =
        commit(
            "commit:omar", deterministicId("member:omar"), priorWeek, LifecycleState.RECONCILING);
    item(
        "item:omar:1",
        omar,
        "Daily-load SLA hardening",
        CommitItemStatus.COMPLETE,
        "so:so4.2.a",
        ChessTier.QUEEN);
    item(
        "item:omar:2",
        omar,
        "Exception validation workflow",
        CommitItemStatus.INCOMPLETE,
        "so:so4.1.b",
        ChessTier.BISHOP);
    freezeSnapshot("snapshot:omar", omar, lockedAt);

    // Priya (manager, reports to Sofia): her OWN week is RECONCILED + reviewed by Sofia, so the
    // demo
    // persona's My Week is populated — not just the Manager tab. (She also reviews Diego/Sana
    // above.)
    WeeklyCommit priya =
        commit(
            "commit:priya",
            deterministicId("member:priya"),
            currentWeek,
            LifecycleState.RECONCILED);
    item(
        "item:priya:1",
        priya,
        "Data-ops roadmap & Q3 staffing plan",
        CommitItemStatus.COMPLETE,
        "so:so4.1.a",
        ChessTier.KING);
    item(
        "item:priya:2",
        priya,
        "PCAP pipeline SLA review",
        CommitItemStatus.COMPLETE,
        "so:so1.1.a",
        ChessTier.ROOK);
    freezeSnapshot("snapshot:priya", priya, lockedAt);
    reviewedReview("review:priya", priya, deterministicId("member:sofia"), lockedAt);

    // Sofia (top exec / admin): her own week is LOCKED — populates her My Week. No review (top of
    // the
    // chain). Her primary surface is still the RCDO strategy tree + the org-wide roll-up.
    WeeklyCommit sofia =
        commit("commit:sofia", deterministicId("member:sofia"), currentWeek, LifecycleState.LOCKED);
    item(
        "item:sofia:1",
        sofia,
        "Board narrative: total-portfolio intelligence",
        CommitItemStatus.OPEN,
        "so:so5.1.a",
        ChessTier.KING);
    item(
        "item:sofia:2",
        sofia,
        "Q3 OKR alignment across team leads",
        CommitItemStatus.OPEN,
        "so:so5.2.a",
        ChessTier.QUEEN);
    freezeSnapshot("snapshot:sofia", sofia, lockedAt);
  }

  private WeeklyCommit commit(String key, UUID memberId, LocalDate week, LifecycleState state) {
    WeeklyCommit wc =
        WeeklyCommit.builder()
            .id(deterministicId(key))
            .memberId(memberId)
            .weekStart(week)
            .lifecycleState(state)
            .build();
    return commits.saveAndFlush(wc);
  }

  private void item(
      String key,
      WeeklyCommit commit,
      String text,
      CommitItemStatus status,
      String soSlug,
      ChessTier tier) {
    CommitItem ci =
        CommitItem.builder()
            .id(deterministicId(key))
            .weeklyCommitId(commit.getId())
            .text(text)
            .status(status)
            .supportingOutcomeId(soSlug == null ? null : deterministicId(soSlug))
            .chessTier(tier)
            .build();
    commitItems.saveAndFlush(ci);
  }

  /**
   * Freeze the commit's live items into a CommitSnapshot (+ SnapshotItems) — the KTD4 invariant
   * that any post-LOCK commit (LOCKED/RECONCILING/RECONCILED) must already have a captured plan.
   * Mirrors SnapshotItem.freeze: text/link/tier only, never status, with the source item id as the
   * join key.
   */
  private void freezeSnapshot(String key, WeeklyCommit commit, Instant capturedAt) {
    CommitSnapshot snapshot =
        CommitSnapshot.builder()
            .id(deterministicId(key))
            .weeklyCommitId(commit.getId())
            .capturedAt(capturedAt)
            .build();
    snapshots.saveAndFlush(snapshot);
    List<CommitItem> live = commitItems.findByWeeklyCommitId(commit.getId());
    for (CommitItem source : live) {
      SnapshotItem frozen =
          SnapshotItem.builder()
              .id(deterministicId(key + ":" + source.getId()))
              .snapshotId(snapshot.getId())
              .commitItemId(source.getId())
              .text(source.getText())
              .supportingOutcomeId(source.getSupportingOutcomeId())
              .chessTier(source.getChessTier())
              .build();
      snapshotItems.saveAndFlush(frozen);
    }
  }

  /**
   * A REVIEWED ManagerReview (the manager reviewed the reconciled week), by {@code reviewer}. Only
   * a RECONCILED commit carries one — the manager reviews AFTER the IC reconciles.
   */
  private void reviewedReview(
      String key, WeeklyCommit commit, UUID reviewerId, Instant reviewedAt) {
    reviews.saveAndFlush(
        ManagerReview.builder()
            .id(deterministicId(key))
            .weeklyCommitId(commit.getId())
            .reviewerId(reviewerId)
            .state(ReviewState.REVIEWED)
            .reviewedAt(reviewedAt)
            .build());
  }
}
