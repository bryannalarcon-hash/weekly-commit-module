<!-- docs/layers/02-api-contract.md — the WCM backend API & contract layer.
  Covers the thin REST controllers, the verified route/authz surface, RFC-7807 errors, the flat
  PageResponse envelope, springdoc-openapi, and the e2e-only surfaces. Anchored to path:line. -->

# API & Contract (Backend)

## Executive summary

This layer is the module's HTTP edge: a set of deliberately **thin** `@RestController`s under `/api/*` that translate JSON requests into service calls and back. They carry almost no logic — identity, ownership, and lifecycle-state decisions all live in the services and the domain FSM (see [Domain & Lifecycle](01-domain-lifecycle.md)). The acting member is always resolved server-side from the Auth0 JWT subject (`CurrentMemberProvider`), never from a request body or path, which is the key defense against IDOR/BOLA. Coarse "is this a manager / admin route" authorization is enforced once, centrally, in `SecurityConfig`; fine row-level ownership runs inside each service. Every error renders as an RFC-7807 `ProblemDetail` via one `@RestControllerAdvice` (`ApiExceptionHandler`), and the whole surface is published as machine-readable OpenAPI by springdoc, frozen into `docs/openapi.yaml`.

## Responsibilities

- **Accountable for:** mapping HTTP verbs/paths/bodies to service calls · choosing stable status codes (201/204/4xx) · request-body bean validation (`@Valid`) and `@RequestParam` bounds · projecting paged results into the flat `PageResponse<T>` envelope · centralizing exception → RFC-7807 translation · serving the OpenAPI/Swagger contract · the coarse route-level scope gate in `SecurityConfig`.
- **Explicitly NOT:** row-level ownership/manager-of-owner checks (services) · the lifecycle FSM and its guards (domain layer) · persistence · calendar/Graph side effects (integration layer). Controllers hold a single service field and forward — see `CommitController` (`backend/src/main/java/com/solovis/wcm/commit/CommitController.java:28`).

## Key components

| Component | What it does | Where |
|-----------|--------------|-------|
| `CommitController` | Weekly-commit CRUD + submit | `backend/src/main/java/com/solovis/wcm/commit/CommitController.java:28` |
| `ReconciliationController` | Reconcile transitions, item-status patch, diff, carry-forward | `backend/src/main/java/com/solovis/wcm/commit/ReconciliationController.java:23` |
| `PulseController` | Weekly Pulse read/upsert | `backend/src/main/java/com/solovis/wcm/commit/PulseController.java:20` |
| `ReviewController` | Per-commit manager review upsert | `backend/src/main/java/com/solovis/wcm/review/ReviewController.java:20` |
| `ReviewQueueController` | Manager's review queue (paged) | `backend/src/main/java/com/solovis/wcm/review/ReviewQueueController.java:23` |
| `RollupController` | Team roll-up (paged) + drill-through resolver | `backend/src/main/java/com/solovis/wcm/review/RollupController.java:31` |
| `RcdoController` | Read-only RCDO tree + picker filter | `backend/src/main/java/com/solovis/wcm/rcdo/RcdoController.java:19` |
| `RcdoAdminController` | Admin RCDO edit-tree CRUD at all 4 levels | `backend/src/main/java/com/solovis/wcm/rcdo/RcdoAdminController.java:34` |
| `OutlookController` | Outlook connection/preference + manager ad-hoc schedule | `backend/src/main/java/com/solovis/wcm/integration/OutlookController.java:26` |
| `GraphConsentController` | Delegated Graph consent (connect/callback/status) | `backend/src/main/java/com/solovis/wcm/integration/GraphConsentController.java:31` |
| `SettingsController` | Account profile/timezone + email-notification toggles | `backend/src/main/java/com/solovis/wcm/settings/SettingsController.java:23` |
| `E2eResetController` | `@Profile("e2e")` reset + inject-item test harness | `backend/src/main/java/com/solovis/wcm/member/E2eResetController.java:37` |
| `SecurityConfig` | The single always-on (`!e2e`) filter chain + scope gate | `backend/src/main/java/com/solovis/wcm/common/SecurityConfig.java:44` |
| `ApiExceptionHandler` | `@RestControllerAdvice` → RFC-7807 `ProblemDetail` | `backend/src/main/java/com/solovis/wcm/common/ApiExceptionHandler.java:39` |
| `PageResponse<T>` | Flat page envelope `{content,totalElements,totalPages,number,size}` | `backend/src/main/java/com/solovis/wcm/common/PageResponse.java:11` |
| `OpenApiConfig` | springdoc `OpenAPI` bean (title/description/version) | `backend/src/main/java/com/solovis/wcm/common/OpenApiConfig.java:14` |

## Interfaces & contracts

### REST surface (verified against the `*Controller.java` files)

Authz column key: **owner** = any authenticated member, row-level ownership enforced in the service; **manager scope** = route gated by `SCOPE_reconcile:commits` in `SecurityConfig`; **admin scope** = `SCOPE_admin:rcdo`; **authenticated** = valid JWT only; **open** = `permitAll`.

| Method · Path | Controller (path:line) | Purpose | Authz |
|---|---|---|---|
| `POST /api/commits` | `CommitController.java:37` | Create a DRAFT (owner = JWT subject); 201 | owner |
| `GET /api/commits` | `CommitController.java:43` | Acting member's week headers | owner |
| `GET /api/commits/current` | `CommitController.java:49` | Current open week (204 if none) | owner |
| `GET /api/commits/{id}` | `CommitController.java:58` | Read one commit (owner or owner's manager) | owner/manager |
| `PUT /api/commits/{id}` | `CommitController.java:64` | Replace DRAFT items (409 if LOCKED+) | owner |
| `POST /api/commits/{id}/submit` | `CommitController.java:70` | DRAFT → LOCKED (422 if empty/any unlinked) | owner |
| `POST /api/commits/{id}/reconcile` | `ReconciliationController.java:32` | LOCKED → RECONCILING | **manager scope** |
| `PATCH /api/commits/{id}/items/{itemId}/status` | `ReconciliationController.java:38` | Patch item ACTUAL (RECONCILING only) | owner |
| `POST /api/commits/{id}/reconciled` | `ReconciliationController.java:45` | RECONCILING → RECONCILED | **manager scope** |
| `GET /api/commits/{id}/reconciliation` | `ReconciliationController.java:51` | Planned-vs-actual diff | owner/manager |
| `POST /api/commits/{id}/carry-forward` | `ReconciliationController.java:57` | Carry unfinished into a new DRAFT | owner |
| `GET /api/commits/{id}/pulse` · `PUT …/pulse` | `PulseController.java:29` · `:36` | Weekly pulse read/upsert | owner |
| `POST /api/commits/{id}/review` | `ReviewController.java:29` | Per-commit manager review | **manager scope** |
| `GET /api/review-queue?weekStart=&page=&size=` | `ReviewQueueController.java:32` | Manager's review queue (Pageable) | **manager scope** |
| `GET /api/rollup?page=&size=` | `RollupController.java:41` | Team roll-up (page≥0, 1≤size≤2000) | **manager scope** |
| `GET /api/rollup/reports/{memberId}/latest-commit` | `RollupController.java:50` | Dashboard drill-through resolver | **manager scope** |
| `GET /api/rcdo/tree` · `GET /api/rcdo/supporting-outcomes?q=` | `RcdoController.java:28` · `:34` | RCDO tree + picker filter | authenticated |
| `POST/PUT/DELETE /api/admin/rcdo/{rally-cries,defining-objectives,outcomes,supporting-outcomes}` | `RcdoAdminController.java:45`–`:130` | Admin edit-tree CRUD (DELETE → 204) | **admin scope** |
| `GET /api/integration/outlook` · `POST …/connect` · `DELETE …` · `PUT …/settings` | `OutlookController.java:35`–`:54` | Outlook connection + sync preference | owner |
| `POST /api/integration/outlook/schedule` | `OutlookController.java:60` | Manager schedules ad-hoc event with a report | **manager scope** |
| `GET /api/graph/connect` · `GET /api/graph/callback` · `GET /api/graph/status` | `GraphConsentController.java:51`–`:87` | Delegated consent (connect/status JWT-gated; **callback open, guarded by signed state**) | mixed (see below) |
| `GET/PUT /api/settings/account` · `GET/PUT /api/settings/notifications` | `SettingsController.java:33`–`:51` | Account profile/timezone + email toggles | owner |
| `POST /api/e2e/reset` · `POST /api/e2e/commits/{id}/inject-item` | `E2eResetController.java:71` · `:96` | Hermetic per-scenario reset/inject | e2e only |

### Authorization model (where each check lives)

`SecurityConfig` defines `MANAGER_SCOPE = "SCOPE_reconcile:commits"` (`SecurityConfig.java:47`) and `ADMIN_RCDO_SCOPE = "SCOPE_admin:rcdo"` (`:50`). The single filter chain (`@Profile("!e2e")`, `:43`) `permitAll`s `/actuator/health`, the OpenAPI docs, and `GET /api/graph/callback` (`:63`–`:71`); gates `GET /api/rollup/**`, `GET /api/review-queue/**`, `POST /api/commits/*/review`, `POST /api/commits/*/reconcile`, `POST /api/commits/*/reconciled`, and `POST /api/integration/outlook/schedule` behind `MANAGER_SCOPE` (`:74`–`:86`); gates `POST/PUT/DELETE /api/admin/rcdo/**` behind `ADMIN_RCDO_SCOPE` (`:90`–`:95`); and requires a valid JWT for everything else (`:97`). Both the standard `scope` claim and Auth0's `permissions` array map to `SCOPE_*` authorities (`:122`–`:139`). The prod RS256 `JwtDecoder` (issuer + audience + JWKS) is built only when `AUTH0_ISSUER_URI` is set (`:147`–`:148`), so a bare boot or the test profile still starts. **Endpoint scope ≠ data scope:** even a manager-scoped route is row-filtered to the caller's own reports inside the service (e.g. `ReconciliationService.requireManagerOf`, `01-domain-lifecycle.md` references `ReconciliationService.java:314`).

### Graph consent callback (the one open app route)

`GET /api/graph/callback` is `permitAll` because Entra redirects the user's browser there with **no bearer token** (`SecurityConfig.java:67`–`:71`). It is instead guarded by a short-lived HMAC-signed `state` minted by `/connect` (`GraphConsentController.java:55`) and verified on callback to derive the member — never the security context (`:80`). A forged/stale state throws `InvalidConsentStateException` → 400 before any token is bound (`ApiExceptionHandler.java:107`).

### Error contract (RFC-7807)

`ApiExceptionHandler` (`@RestControllerAdvice`, `ApiExceptionHandler.java:39`) maps every domain/web exception to a `ProblemDetail` carrying a stable `type` URN (`urn:wcm:problem:<code>`, `:41`) and a `code` property the FE branches on (`:266`). Verified mappings include: unresolved member → 401 (`:43`), forbidden/ownership → 403 (`:48`), not-found → 404 (`:53`), illegal FSM transition → 409 with `from`/`to` properties (`:58`), wrong-state non-transition op → 409 `illegal_state` (`:83`), persistence constraint collision → 409 `constraint_violation` (`:93`), unlinked/empty submit → 422 (`:71`), invalid consent state → 400 (`:107`), bean-validation → 400 (`:112`), `@RequestParam` constraint violation → 400 (`:223`), missing/type-mismatched param → 400 (`:190`, `:205`), unknown route → 404 (`:165`), unsupported method → 405 (`:176`), malformed body → 400 (`:135`), unsupported media type → 415 (`:149`), Graph-not-configured → 503 (`:239`). The body-parse/media-type/no-handler/method handlers exist specifically so Spring's built-in MVC exceptions don't escape the advice and surface as a misleading bare 403 via the stateless chain's `/error` dispatch (`:8`–`:16`).

### Paging contract (flat `PageResponse<T>`)

`PageResponse<T>` is a flat record `{content, totalElements, totalPages, number, size}` projected from a Spring Data `Page` via `of(...)` (`PageResponse.java:11`–`:22`). It is deliberately **not** Spring's nested `PagedModel` (whose metadata sits under a `page` object) because the FE's TS `Page<T>` contract + RTK Query read the flat shape directly, and the MSW mocks mirror it (`PageResponse.java:1`–`:5`). The roll-up and review-queue caps are enforced in the services: `MAX_PAGE_SIZE = 2000` with `Math.min(pageable.getPageSize(), MAX_PAGE_SIZE)` (`RollupQueryService.java:40`, `:76`; `ReviewQueueService.java:36`, `:74`) — the brief's NFR — and a stable secondary sort so equal display names still order deterministically across the 2000-record requirement (`RollupQueryService.java:64`–`:68`). `RollupController` additionally rejects out-of-range pagination at the boundary via `@Min(0)`/`@Max(2000)` + `@Validated` → 400 (`RollupController.java:29`, `:42`–`:43`), while `ReviewQueueController` uses `@PageableDefault(size = 50)` (`ReviewQueueController.java:37`).

### OpenAPI / Swagger

`springdoc-openapi` (the `springdoc-openapi-starter-webmvc-ui` dependency in `backend/pom.xml`) serves `/v3/api-docs` + Swagger UI from the controller `@Operation`/DTO annotations; `OpenApiConfig` supplies the title, version `0.0.1`, and the "acting identity resolved server-side, never from the body" description (`OpenApiConfig.java:17`–`:28`). The OpenAPI docs paths are `permitAll` in the security chain (`SecurityConfig.java:65`). The generated contract is frozen at `docs/openapi.yaml` (header verified: `title: Weekly Commit Module API`, `version: 0.0.1`), which the FE generates against.

## Data & state

This layer is **stateless** — `SessionCreationPolicy.STATELESS`, CSRF disabled (`SecurityConfig.java:57`–`:58`). It owns no entities; it shapes request/response DTOs (the `*Dto`/`*Request`/`*Response`/`*View` records under each package's `dto/`) and the `PageResponse` envelope. The only "state" it touches directly is the security context (to derive the acting member) and, in the e2e profile, the `E2eResetController` which deletes and re-seeds commit-side rows in child-before-parent order (`E2eResetController.java:75`–`:84`).

## Dependencies

- **Depends on:** the application services and domain FSM in [Domain & Lifecycle](01-domain-lifecycle.md) · `CurrentMemberProvider` for the acting member · Spring Web MVC + Spring Security OAuth2 resource server · springdoc-openapi · Spring Data `Pageable`/`Page`.
- **Used by:** the frontend RTK Query slice (`libs/api/src/commitApi.ts`), `docs/openapi.yaml` consumers, the Cypress/Playwright E2E suites (via the e2e profile + `X-Debug-Member`), and the k6 stress paths.

## How it works (flow)

A representative authenticated write — submitting a commit:

1. Request hits `POST /api/commits/{id}/submit`. The `!e2e` filter chain validates the bearer JWT, maps `scope`/`permissions` to authorities, and (this route not being manager/admin-gated) requires only `authenticated` (`SecurityConfig.java:97`).
2. `CommitController.submit` forwards to `service.submit(id)` with no logic of its own (`CommitController.java:71`).
3. `CommitService` resolves the owner from the JWT, enforces row-level ownership (403 if not the caller's), runs the FSM `lock` guard (422 on empty/unlinked), persists the snapshot, and publishes `commit.locked`.
4. On success a `CommitDto` serializes as 200 JSON; on a guard failure the thrown exception is caught by `ApiExceptionHandler` and rendered as problem+json with the right status and stable `code`.

A representative paged manager read — the roll-up:

1. `GET /api/rollup?page=&size=` is gated by `MANAGER_SCOPE` at the filter chain (`SecurityConfig.java:74`).
2. `RollupController` validates `page`/`size` bounds (400 if out of range) and forwards to `RollupQueryService.rollup(pageable)` (`RollupController.java:41`).
3. The service caps size at 2000, row-filters to the caller's reports, applies the stable sort, and returns a `Page`.
4. `PageResponse.of(page)` flattens it to `{content,totalElements,totalPages,number,size}` (`RollupController.java:45`).

## Design decisions & rationale

- **Thin controllers, fat services.** Authorization and state belong in one tested place; controllers are forwarders so the contract is obvious and stable (`CommitController.java:1`–`:5`).
- **Acting member from the JWT, never the body (KTD6).** Closes IDOR/BOLA: a spoofed `memberId` is ignored (`CommitService.java:72`).
- **Coarse scope at the edge, fine ownership in services.** `SecurityConfig` answers "may this token reach this route?"; the service answers "may this member touch this row?" — defense in depth (`SecurityConfig.java:96`–`:98`).
- **Flat `PageResponse` over `PagedModel`.** Matches the FE `Page<T>` contract + MSW mocks exactly, avoiding a nested `page` object the FE never reads (`PageResponse.java:1`–`:5`).
- **Exhaustive MVC-exception handlers.** Without them, Spring's built-in exceptions escape to `/error` and the stateless chain surfaces a misleading bare 403; each is mapped to a precise problem+json instead (`ApiExceptionHandler.java:127`–`:197`).
- **Callback `permitAll` + signed state.** The browser arrives tokenless, so the trust anchor is an HMAC-signed `state`, not the security context (`GraphConsentController.java:71`–`:83`).

## Gotchas & sharp edges

- **`ReconciliationController`, `ReviewController` share `@RequestMapping("/api/commits/{id}")`** with distinct sub-paths — both mount under the same prefix (`ReconciliationController.java:22`, `ReviewController.java:19`); read them together to see the full commit sub-resource surface.
- **Manager-scoped routes are still data-scoped.** Passing `SCOPE_reconcile:commits` only clears the gate; the service still 403s a manager acting on a commit they don't manage (`ReconciliationService.java:314`). Granting the scope is not granting access to all commits.
- **`GET /api/rcdo/**` is intentionally only authenticated, not admin-gated** — strategy *reads* are open to any logged-in member; only the `/api/admin/rcdo/**` mutations require admin scope (`SecurityConfig.java:88`–`:95`).
- **The e2e surface is profile-gated and `permitAll` only under `e2e`.** `E2eResetController` is `@Profile("e2e")` (`E2eResetController.java:36`) and `E2eSecurityConfig` `permitAll`s `/api/e2e/**` because that chain authenticates from `X-Debug-Member`, which this maintenance call doesn't carry (`E2eSecurityConfig.java:73`). It never ships in prod.
- **`inject-item` deliberately bypasses the snapshot** to simulate an out-of-band post-lock addition the diff must flag `ADDED_AFTER_LOCK` — the product API forbids content edits on a LOCKED+ commit, so this is the only way to set up that state (`E2eResetController.java:88`–`:108`).

### DRIFT vs `docs/TECHNICAL.md`

- **The §1.2 REST table omits routes added since.** It does not list `RcdoAdminController` (`POST/PUT/DELETE /api/admin/rcdo/**`), `SettingsController` (`/api/settings/account` + `/notifications`), or `POST /api/integration/outlook/schedule` — all present in the code and gated in `SecurityConfig` (`:84`–`:95`). The admin/settings/schedule surfaces are real but undocumented in that table.
- **`SecurityConfig` enforces an admin scope TECHNICAL.md §1.3/§4 don't mention.** §1.3 lists only `SCOPE_reconcile:commits`; the code adds `SCOPE_admin:rcdo` for the RCDO edit-tree (`SecurityConfig.java:50`, `:90`–`:95`).

## Connects to

- [Domain & Lifecycle (Backend)](01-domain-lifecycle.md) — the entities, FSM, and services this layer exposes over HTTP.
