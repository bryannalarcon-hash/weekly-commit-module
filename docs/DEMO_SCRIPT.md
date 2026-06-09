<!-- docs/DEMO_SCRIPT.md — step-by-step demo walkthrough for the Weekly Commit Module.
     Mirrors the Cypress/Gherkin E2E journeys (e2e/cypress/e2e/features/*.feature) against the
     Solovis demo seed (DemoSeeder / SOLOVIS_SEED.md): employee draft→lock, manager reconcile,
     roll-up, carry-forward, and Outlook connect. Use it to record the DEMO VIDEO deliverable. -->

# Weekly Commit Module — Demo Script

This walkthrough mirrors the automated E2E journeys (`e2e/cypress/e2e/features/*.feature`) so the
recorded demo and the test suite tell the same story. It runs against the **Solovis demo seed**
(`DemoSeeder`, `@Profile("demo")`) — a synthesized Solovis RCDO tree, a manager graph, and sample
commits across every lifecycle state.

The seed actors used below (emails are the seeded identities):

| Person | Role | Team | Relevance |
|---|---|---|---|
| **Sana Khan** (`sana@solovis.test`) | IC | Data Operations | drafts → locks a fresh week |
| **Priya Menon** (`priya@solovis.test`) | Manager | Data Operations | Sana's manager — reconciles/reviews |
| **Omar Haddad** (`omar@solovis.test`) | IC | Platform Engineering | has a RECONCILING week with a planned-vs-actual gap |
| **Lena Vogt** (`lena@solovis.test`) | IC | Risk Analytics | a LOCKED week on Marcus's roll-up |
| **Marcus Hale** (`marcus@solovis.test`) | Manager | Risk Analytics | review queue + roll-up dashboard |

---

## 0. Bring up the stack

Run the app in the hermetic demo mode so you can switch identities without an Auth0 login (the same
mode the E2E suite uses):

```bash
# Postgres 16.4
docker compose up -d postgres

# Backend with the demo seed + hermetic X-Debug-Member auth (no Auth0 tenant needed)
DB_URL=jdbc:postgresql://localhost:5433/wcm SPRING_PROFILES_ACTIVE=e2e,demo \
  mvn -f backend/pom.xml spring-boot:run

# Frontend — live Module Federation: remote first, then host
npx nx serve wc-remote     # terminal A → :4201 (serves remoteEntry.js)
npx nx serve host-shell    # terminal B → http://localhost:4200 (host loads the remote)
```

Open `http://localhost:4200`. In demo/e2e mode you act as a seeded member via the `X-Debug-Member`
identity (the host sets it for the embedded remote); switch the acting member where each act says
"act as …". For the cleanest run, hit **Reset demo data** (or `POST /api/e2e/reset`) before recording
so every week is in its seeded starting state.

> Alternative: run the journeys headless and screen-capture them with `bash e2e/run-e2e.sh`
> (`KEEP_UP=1` to leave the stack up afterward).

---

## Act 1 — Employee drafts and locks a weekly commit (mirrors `weekly-commit-lifecycle.feature`)

**Act as `sana@solovis.test` (IC, Data Operations).**

1. Open **My Weekly Commit**. With no open week, the empty "Start your week" state shows.
2. Click **Start a new week** — a DRAFT week is created (autosave indicator visible). The lifecycle
   badge reads **DRAFT**.
3. Add a commit item: *"Normalize custodian feeds"*. Note **Submit is disabled** — the item is not yet
   linked to a Supporting Outcome (this is the RCDO-link-at-LOCK guard).
4. Open the **RCDO picker** on item 1 and link it to a Supporting Outcome (e.g. *SO1.1.b — Normalize
   public holdings from 3 custodians into the canonical model* under *DO1 → O1.1*). The picker is a
   keyboard-accessible 4-level tree; the linked outcome appears as a breadcrumb chip.
5. Set item 1's **chess tier** to **KING** (highest strategic weight).
6. **Submit and lock** the week (confirm in the dialog). The week transitions **DRAFT → LOCKED**; the
   snapshot is frozen. Show the badge now reads **LOCKED** and the week is **read-only** — content
   edits return 409.

*Talking point:* "Every locked commitment is provably linked to strategy — the server refuses to lock
an unlinked plan, and the plan is now immutable so reconciliation has a fixed baseline."

---

## Act 2 — Manager reconciles, owner carries forward (mirrors `weekly-commit-lifecycle.feature` scenario 2)

Use Sana's locked week (one item to complete, one to leave incomplete — the seed sets this up, or
build it as in Act 1).

1. **Act as `priya@solovis.test` (Sana's manager).** Open the review for Sana's week and **start
   reconciliation** — the week moves **LOCKED → RECONCILING**, opening the actuals window.
2. **Act as `sana@solovis.test` (the owner).** On the **Reconciliation** view, mark the **first item
   complete** and the **second item incomplete**. Only the *status* changes — the planned text/link/
   tier stay frozen (a content edit here would 409).
3. **Act as `priya@solovis.test`.** **Mark the week reviewed** — the week moves **RECONCILING →
   RECONCILED** and the manager review is forced to **REVIEWED**. Badge reads **RECONCILED**.
4. **Act as `sana@solovis.test`.** **Carry the unfinished work forward** — a **new DRAFT week** is
   created carrying the still-open item forward (a carried-forward card shows its lineage); the old
   week moves to **CARRY_FORWARD**.

*Talking point:* "Planned-vs-actual is reconciled by the right roles — the manager opens and closes the
window, the owner records actuals — and nothing unfinished is silently dropped between weeks."

---

## Act 3 — Reconciliation: planned vs actual, added-after-lock (mirrors `reconciliation.feature`)

**Act as `omar@solovis.test` (IC, Platform).** Omar's seeded week is already **RECONCILING** with a gap.

1. Open Omar's **reconciling week**. The reconciliation view is a two-column **planned vs actual**: it
   lists the planned (snapshot) items, with **one flagged completed** and **one flagged incomplete**.
2. (Optional, mirrors scenario 2) Show an **item added after lock**: when an item's `created_date` is
   after the week's `submitted_at`, it is flagged **added-after-lock** — surfacing work that wasn't in
   the locked plan.

*Talking point:* "The diff is honest: the snapshot is the contract, the live status is reality, and
anything added after the fact is called out rather than blended in."

---

## Act 4 — Manager review queue & roll-up dashboard (mirrors `manager-review-rollup.feature`)

**Act as `marcus@solovis.test` (Manager, Risk Analytics).**

1. Open the **Review queue**. It lists Marcus's reports' submissions for the week — including **Lena
   Vogt** (a LOCKED week). Open **Lena Vogt's** review to show the per-item **review detail**.
2. Open the **Team dashboard**. The roll-up shows a row for **Lena Vogt** with **completion %**,
   **carry-over**, and an **alignment %** column (the fraction of items linked to strategy).
3. **Drill through** the Lena Vogt row — it resolves her latest reviewable commit and opens that
   report's **review detail** (not a dead-end to the queue).

*Talking point:* "A manager sees only their own reports (row-level authz from the token, never a
client id), and strategic alignment is a first-class metric — exactly the visibility 15Five lacked."

---

## Act 5 — Connect Outlook (delegated Microsoft Graph)

**Act as any IC (e.g. `sana@solovis.test`).**

1. Open **Settings**. Outlook shows **Disconnected**. Click **Connect Outlook** — the app redirects to
   the Microsoft Entra consent screen (delegated `Calendars.ReadWrite` + `offline_access`).
2. Grant consent. The browser returns to the app via the callback (guarded by the signed `state`, no
   bearer token), the encrypted per-user token is stored, and Settings now shows **Connected** with a
   last-sync indicator. Toggle the **create-event-on-lock** sync preference to on.
3. Now **lock a week** (as in Act 1). On LOCK, the `commit.locked` event drives the calendar sync — an
   **all-day weekly Outlook event** is created carrying the commit's items + a deep-link back into the
   app. Show the event in Outlook.

> The live Graph path needs a Microsoft 365 dev tenant + app registration (`AZURE_*` in `.env`,
> backend run with the `graph` profile). Without it, the stub adapter records the call so the rest of
> the demo still runs. Guided setup: `docs/setup/EXTERNAL_SERVICES_SETUP.md`.

*Talking point:* "Locking your week puts it on your calendar automatically — and because calendar sync
is an async side-effect behind an event, a Graph hiccup never blocks or rolls back the lock itself."

---

## Closing

Recap the through-line: **commit → linked to strategy → locked (immutable) → reconciled by the right
roles → rolled up for the manager → carried forward**, with Outlook as a side-effect and strategic
alignment measured at every step. That is the structural connection between weekly work and
organizational goals that the brief asked for, replacing the disconnected 15Five flow.
