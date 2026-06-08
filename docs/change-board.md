<!--
  change-board.md — living kanban for post-build changes to the ST6 Weekly Commit
  Module. Planner owns To Do; the implementing agent owns In Progress / Done.
  Legend + hard constraints are customized to this project; see Workflow section.
-->
# Change Board

> Living kanban for changes after the first build. The planner owns **To Do**;
> the implementing agent owns **In Progress** and **Done**. Items are appended
> here as they're discussed. **Implementer prompts are produced on request** — an
> item sitting in To Do is scoped, not yet authorized to build.

---

## Workflow (read this first)

**What this file is.** The single source of truth for *what changes* and *who is doing what right now*. It sits on top of the project's binding docs (spec, architecture/contract, test plan, design source of truth) — it does not replace them. Binding docs for this project:

- `assignment_description.md` — the build sheet / spec; defines "done" for the Weekly Commit Module. *(authoritative until an architecture/contract doc is added)*
- `<architecture / API contract>` — **not yet written.** Add the Spring Boot REST contract + Module Federation remote interface here once it exists.
- `<test plan>` — **not yet written.** Vitest (FE units) + Cypress/Gherkin (E2E) + JaCoCo ≥80% (BE). Add the suite map once scaffolded.
- `<design source of truth>` — **not yet written.** No mock/Figma referenced in the brief; capture one before UI items.

**The discipline (do this every time):**

1. **Pull only what you're told.** Don't start a To Do item until you've been handed its prompt. The board defines scope; the prompt authorizes execution.
2. **Before you touch code:** move every unit you're *about to* work on from **To Do → In Progress** and fill the In Progress template (owner, plan, files). Split one item into `CB-NN.a/.b` if it's several work units.
3. **While working:** keep the In Progress checklist current. Record blockers inline rather than going silent.
4. **When finished AND verified:** move the item **In Progress → Done** and fill the Done template (actual files, verification result). "Finished" is *tests green + matches the design + no regression*, not "code written."
5. **Never delete history.** Items only move forward. Edit in place; don't rewrite IDs.

### Default workflows

- **Bug-fix flow:** reproduce → write/extend the failing test (it should fail for the stated reason) → fix → test green → visual/behavior diff vs the design → move to Done.
- **Feature flow:** confirm it fits the spec/contract (fix the signature first if not) → write the acceptance test → build behind the agreed seam → test green → diff vs design → move to Done.

**IDs.** `CB-NN`, stable and never reused. These are **internal indices** — never render them in any viewer-facing surface (UI, decks, dashboards, copy). Code/comments/`data-*` only.

**Project hard constraints (every item must uphold):**
- **RCDO linkage is mandatory** — every weekly commit links to a Supporting Outcome in the Rally Cry → Defining Objective → Outcome hierarchy. No unlinked commits may be persisted. *(This is the product's whole reason to exist.)*
- **Lifecycle state machine enforced** — `DRAFT → LOCKED → RECONCILING → RECONCILED → Carry Forward`, server-side; illegal transitions rejected, never silently allowed.
- **Frontend stack lock** — TypeScript strict mode; Tailwind utility classes only (no CSS Modules / styled-components); RTK Query for all API calls (no Saga/Thunk); Flowbite React components.
- **Backend stack lock** — Spring Data JPA + Hibernate (no Prisma/TypeORM/Sequelize); Lombok `@Getter/@Setter/@Builder` (never `@Data`); all entities extend `AbstractAuditingEntity`; Flyway for every schema change.
- **Perf + coverage budgets** — plan-retrieval API < 200ms; lazy-loaded routes (sub-second first render); JaCoCo ≥ 80% backend coverage; team views paginate (Spring `Pageable`) up to 2000 records.
- **MF discipline** — single route entry point, shared deps declared, no hardcoded shell/navigation (must work standalone AND as a Vite Module Federation remote in the PA host, PM-remote pattern).
- **No internal-index leakage** — RCDO enum slugs, `CB-NN`, and any internal ID stay out of viewer-facing text; render the human-readable label instead.

**Field legend (used by all three templates):**
- **Type:** `bug` (diverges from spec/design) · `feature` (new capability) · `change` (intentional spec revision).
- **Surface:** `commit-entry` (weekly commit CRUD + RCDO linking + chess-layer prioritization) · `reconciliation` (planned-vs-actual view) · `manager-dashboard` (team roll-up) · `lifecycle` (state-machine engine) · `api` (Spring Boot REST) · `data` (Postgres schema / JPA entities / Flyway) · `mf-remote` (Vite Module Federation host/remote wiring) · `auth` (Auth0 OAuth2 JWT).
- **Size:** `S` (≤1 file / localized) · `M` (a component + its wiring) · `L` (multi-file / new subsystem).
- **Prereqs:** other `CB-NN` or a doc/signature that must land first; `—` if none.

---

## To Do

> **Template — copy this block per item.**
> ```
> ### CB-NN — <short title>
> - **Type / Surface / Size:** <bug|feature|change> · <surface> · <S|M|L>
> - **Prereqs:** <CB-NN, …, or —>
> - **Important files (candidates):** <best-guess paths; verify against the contract>
> - **Current:** <what it does today>
> - **Desired:** <what it should do; cite the design/spec it must match>
> - **Acceptance:** <how we'll know it's done — visible behavior + which test>
> - **Refs:** <spec docs / sections / design files>
> ```

### CB-01 — <example bug — delete or replace>
- **Type / Surface / Size:** bug · `commit-entry` · S
- **Prereqs:** —
- **Important files (candidates):** `<path/to/component>`
- **Current:** `<the wrong behavior observed today>`
- **Desired:** `<the correct behavior; cite the design it must match>`
- **Acceptance:** `<observable behavior + the test that proves it>`
- **Refs:** `<design file / spec section>`

### CB-02 — <example feature — delete or replace>
- **Type / Surface / Size:** feature · `api` · M
- **Prereqs:** —
- **Important files (candidates):** `<path/to/module>`
- **Current:** `<capability absent today>`
- **Desired:** `<the new capability and its boundaries>`
- **Acceptance:** `<observable behavior + the test that proves it>`
- **Refs:** `<spec section>`

---

## In Progress

> **Template — copy this block when you pull an item.**
> ```
> ### CB-NN[.x] — <short title>
> - **Type / Surface / Size:** <…>
> - **Owner:** <agent / model tier>
> - **Started:** <YYYY-MM-DD>
> - **Prereqs met?:** <yes / blocked on CB-NN>
> - **Plan (checklist):**
>   - [ ] <step>
>   - [ ] <step>
>   - [ ] test written/updated (which test)
>   - [ ] diff vs design
> - **Files being touched:** <actual paths>
> - **Notes / blockers:** <inline; don't go silent>
> ```

_(empty — fill as items are pulled)_

---

## Done

> **Template — copy this block when an item is finished AND verified.**
> ```
> ### CB-NN[.x] — <short title>
> - **Type / Surface / Size:** <…>
> - **Completed:** <YYYY-MM-DD>
> - **Files changed (actual):** <paths>
> - **What changed:** <1–3 lines — the real diff, not the intent>
> - **Verification:** <tests run + pass/fail; diff vs which design>
> - **Constraints checked:** <project invariants verified, or N/A>
> - **Follow-ups / known gaps:** <or none>
> ```

_(empty — fill as items finish)_
