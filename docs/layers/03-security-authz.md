<!-- docs/layers/03-security-authz.md — Security & Authorization layer of the Weekly Commit Module.
     Covers the three defense-in-depth layers (Auth0 authentication, scope-gated routes, row-level
     ownership), the tokenless Graph consent callback's signed-state guard, the hermetic E2E dev-auth
     isolation, and the secrets/at-rest-encryption posture. All claims anchored to path:line. -->

# Layer 03 — Security & Authorization

## Executive summary

The backend is an **Auth0 OAuth2 resource server** that defends every `/api/*` route with three
stacked layers (defense-in-depth):

1. **Authentication** — a valid RS256 Auth0 JWT is required everywhere except a tiny allow-list
   (`SecurityConfig.java:55`). No token → 401.
2. **Coarse authorization (scope-gated routes)** — manager-only routes require `SCOPE_reconcile:commits`
   and the RCDO edit-tree mutations require `SCOPE_admin:rcdo`; an authenticated user without the
   authority → 403 (`SecurityConfig.java:74`, `:90`).
3. **Fine authorization (row-level ownership)** — the acting member is always resolved from the
   **JWT subject** via `CurrentMemberProvider`, never a client-supplied id, so a spoofed `memberId`
   in a body/param is ignored. This closes IDOR/BOLA (`CurrentMemberProvider.java:1`,
   `JwtCurrentMemberProvider.java:35`).

A single `SecurityFilterChain` is always active under `@Profile("!e2e")`
(`SecurityConfig.java:43`,`:56`). The one app route that is `permitAll` is the **Graph consent
callback** (`GET /api/graph/callback`), because Entra redirects the browser there with no bearer
token; it is instead guarded by a short-lived **HMAC-signed `state`** (`GraphConsentState.java`).
For hermetic browser E2E, `@Profile("e2e")` swaps the JWT chain for an `X-Debug-Member` header
authenticator over seeded members (`E2eSecurityConfig.java:47`) — strictly test-path, never prod.
Secrets are env refs defaulting to empty (so a bare boot still starts) and Graph tokens are
AES-256-GCM encrypted at rest (`TokenCipher.java:1`).

```
                  Request to /api/*
                        │
   ┌────────────────────▼─────────────────────┐
   │ (1) AUTHENTICATION  — Auth0 RS256 JWT     │  no/invalid token → 401
   │     issuer + audience + JWKS              │  (ProblemAuthHandlers)
   └────────────────────┬─────────────────────┘
                        │ valid JWT (or X-Debug-Member under e2e)
   ┌────────────────────▼─────────────────────┐
   │ (2) COARSE AUTHZ    — route scope gate    │  missing authority → 403
   │     SCOPE_reconcile:commits / admin:rcdo  │
   └────────────────────┬─────────────────────┘
                        │ authority OK / route not gated
   ┌────────────────────▼─────────────────────┐
   │ (3) FINE AUTHZ      — row-level ownership  │  not your row → 403
   │     acting member = JWT subject (never id) │
   └────────────────────┬─────────────────────┘
                        ▼
                  handler executes

   exception: GET /api/graph/callback is permitAll (no bearer) —
   guarded instead by HMAC-signed, short-lived `state` (GraphConsentState).
```

## Responsibilities

- Turn the API into an Auth0 resource server and validate every bearer token (signature, issuer,
  expiry, audience).
- Map Auth0 `scope` and `permissions` claims to Spring `SCOPE_*` authorities.
- Gate manager-only and admin-only routes at the filter chain (coarse authz).
- Expose a single trusted "who is acting" seam (`CurrentMemberProvider`) so services enforce
  row-level ownership without trusting client input (fine authz).
- Render filter-chain 401/403 denials as RFC-7807 `application/problem+json` matching the
  service-layer error shape (`ProblemAuthHandlers.java:1`).
- Guard the tokenless Graph consent callback with a signed, short-lived `state`.
- Provide a hermetic, prod-isolated E2E auth path (`X-Debug-Member`).
- Keep every external secret env-backed and empty-safe; encrypt Graph tokens at rest.

## Key components

| Component | Path:line | Role |
|---|---|---|
| `SecurityConfig` | `backend/src/main/java/com/solovis/wcm/common/SecurityConfig.java:42` | Prod/default/test filter chain (`@Profile("!e2e")`); route gates + prod JWT decoder bean |
| `SecurityFilterChain` bean | `…/common/SecurityConfig.java:55` | The single always-on chain: permit-list, scope gates, `anyRequest().authenticated()` |
| `jwtAuthenticationConverter` | `…/common/SecurityConfig.java:122` | Maps `scope` claim **and** `permissions` array → `SCOPE_*` authorities |
| `auth0JwtDecoder` | `…/common/SecurityConfig.java:147` | Prod RS256 `NimbusJwtDecoder` (issuer+audience+JWKS), built only when issuer configured |
| `Auth0IssuerConfiguredCondition` | `…/common/Auth0IssuerConfiguredCondition.java:12` | Gates the prod decoder on a **non-blank** issuer (empty default ≠ "present") |
| `AudienceValidator` | `…/common/AudienceValidator.java:14` | Asserts the token's `aud` contains this API's identifier |
| `CurrentMemberProvider` | `…/common/CurrentMemberProvider.java:9` | The "acting member" port (KTD6) — resolve who is acting, never from a body |
| `JwtCurrentMemberProvider` | `…/common/JwtCurrentMemberProvider.java:21` | Prod impl (`@Profile("!e2e")`): member from JWT `sub`, JIT-provisioned |
| `ProblemAuthHandlers` | `…/common/ProblemAuthHandlers.java:22` | RFC-7807 problem+json writers for filter-chain 401/403 |
| `E2eSecurityConfig` | `…/common/E2eSecurityConfig.java:47` | `@Profile("e2e")` chain: `X-Debug-Member` authenticator over seeded members |
| `DebugMemberFilter` | `…/common/E2eSecurityConfig.java:117` | Resolves the header to a seeded member and authenticates the request |
| `DebugHeaderCurrentMemberProvider` | `…/common/DebugHeaderCurrentMemberProvider.java:19` | `@Profile("e2e")` acting-member impl: reloads the member id set by the filter |
| `GraphConsentState` | `…/integration/GraphConsentState.java:29` | HMAC-SHA256 signer/verifier of the consent `state` (CSRF / code-injection guard) |
| `TokenCipher` | `…/integration/TokenCipher.java:19` | AES-256-GCM encrypt/decrypt for Graph tokens at rest |

## Interfaces & contracts

- **`CurrentMemberProvider`** (`CurrentMemberProvider.java:9`) — `Member currentMember()` plus a
  default `currentMemberId()` (the row-level authorization key, `:19`). The contract is explicit:
  implementations resolve the acting member "from a trusted source (the validated Auth0 JWT
  subject) — never from a client-supplied body field" (`CurrentMemberProvider.java:12`), and throw
  when none can be resolved. Two profile-scoped impls: prod `JwtCurrentMemberProvider`
  (`@Profile("!e2e")`, `JwtCurrentMemberProvider.java:20`) and hermetic
  `DebugHeaderCurrentMemberProvider` (`@Profile("e2e")`, `DebugHeaderCurrentMemberProvider.java:18`).
- **Authority mapping** — `jwtAuthenticationConverter` (`SecurityConfig.java:122`) runs the standard
  `JwtGrantedAuthoritiesConverter` over the space-delimited `scope` claim, then *also* maps each
  entry of Auth0's `permissions` array to `SCOPE_<permission>` (`SecurityConfig.java:129`-`:135`).
  So an RBAC permission `reconcile:commits` becomes authority `SCOPE_reconcile:commits`, gating
  routes the same way a scope would.
- **Route gates** (constants `SecurityConfig.java:47`,`:50`):
  - `MANAGER_SCOPE = "SCOPE_reconcile:commits"` gates `GET /api/rollup(/**)`,
    `GET /api/review-queue(/**)`, `POST /api/commits/*/review`, `POST /api/commits/*/reconcile`,
    `POST /api/commits/*/reconciled`, and `POST /api/integration/outlook/schedule`
    (`SecurityConfig.java:74`-`:86`).
  - `ADMIN_RCDO_SCOPE = "SCOPE_admin:rcdo"` gates `POST/PUT/DELETE /api/admin/rcdo/**`
    (`SecurityConfig.java:90`-`:95`).
- **Permit-list** (`SecurityConfig.java:63`-`:71`): `/actuator/health(/**)`, `/v3/api-docs(/**)`,
  `/swagger-ui/**`, and `GET /api/graph/callback`. Everything else → `anyRequest().authenticated()`
  (`SecurityConfig.java:97`).
- **`GraphConsentState`** — `issue(UUID memberId)` returns
  `base64url(memberId|expiry) "." base64url(HMAC-SHA256(payload))` (`GraphConsentState.java:55`-`:61`);
  `verify(String state)` checks the MAC in constant time (`MessageDigest.isEqual`,
  `GraphConsentState.java:87`) and enforces the 10-minute TTL (`GraphConsentState.java:34`,`:103`),
  returning the bound member id or throwing `InvalidConsentStateException`. `isConfigured()`
  (`:46`) is false when no key is set; `issue`/`verify` then fail fast with
  `GraphNotConfiguredException` (`GraphConsentState.java:119`-`:123`).
- **`AudienceValidator`** — `validate(Jwt)` succeeds only if `token.getAudience()` contains the
  required audience (`AudienceValidator.java:30`-`:33`), else fails with `invalid_token`.

## Data & state

- **No security state is persisted by this layer itself.** Authentication is per-request and
  stateless: `SessionCreationPolicy.STATELESS` and CSRF disabled (`SecurityConfig.java:57`-`:58`,
  `E2eSecurityConfig.java:61`-`:62`).
- **Consent `state` is stateless too** — there is no server-side nonce store; the HMAC signature
  plus the embedded expiry *are* the guard (`GraphConsentState.java:14`). The signing key is the
  same 256-bit secret used for token encryption: `${wcm.graph.token-enc-key}`
  (`GraphConsentState.java:41`, `TokenCipher.java:28`).
- **Graph tokens at rest** — `TokenCipher` produces `base64(IV ‖ ciphertext+tag)` with a fresh
  random 12-byte IV per encrypt and a 128-bit GCM tag (`TokenCipher.java:21`-`:23`,`:38`-`:53`).
  The key decodes to 16/24/32 bytes (AES-128/192/256) or construction fails
  (`TokenCipher.java:83`-`:86`).
- **Secrets are env refs defaulting to empty** (`backend/src/main/resources/application.yml:11`-`:31`):
  `AUTH0_ISSUER_URI`, `AUTH0_AUDIENCE`, `GRAPH_TOKEN_ENC_KEY`, `WCM_SNS_TOPIC_ARN`,
  `WCM_SQS_QUEUE_URL` all default blank, so a bare/test boot starts without them. A missing key
  leaves `TokenCipher`/`GraphConsentState` *unconfigured* (boots, fails only when invoked).

## Dependencies

**Depends on**
- Spring Security OAuth2 resource server (`NimbusJwtDecoder`, `JwtAuthenticationConverter`,
  `DelegatingOAuth2TokenValidator`) — `SecurityConfig.java:29`-`:36`.
- `MemberProvisioningService.findOrProvision(...)` for JIT member creation from the JWT subject
  (`JwtCurrentMemberProvider.java:41`).
- `MemberRepository` (e2e header→member resolution and reload) — `E2eSecurityConfig.java:143`-`:152`,
  `DebugHeaderCurrentMemberProvider.java:35`.
- `wcm.auth0.*` and `wcm.graph.token-enc-key` properties (`application.yml:11`-`:24`).

**Used by**
- Every service that enforces ownership consumes `CurrentMemberProvider` (e.g.
  `OutlookService.java:46`,`:109` resolves the acting member, never a param).
- `GraphConsentController` uses `GraphConsentState` to mint/verify `state` and
  `CurrentMemberProvider` for `/connect` and `/status` (`GraphConsentController.java:51`-`:90`).
- `GraphCalendarAdapter` and `GraphTokenService` use `TokenCipher` (indirectly, via the token
  store) — see `04-integrations-eventing.md`.

## How it works (flow)

**(1) Normal authenticated request.** The resource-server filter validates the bearer JWT with the
configured decoder, builds an `Authentication` whose principal is the `Jwt`, and maps its
`scope`/`permissions` to authorities (`SecurityConfig.java:105`-`:113`,`:122`). The route matchers
then apply the coarse gate (`SecurityConfig.java:74`-`:97`). Inside the handler, the service calls
`currentMember()`; `JwtCurrentMemberProvider` reads the `sub` from the `SecurityContext` JWT and
JIT-provisions/loads the `Member` (`JwtCurrentMemberProvider.java:35`-`:43`). Row-level checks then
compare *that* member to the resource owner — never to a request-supplied id — which is what closes
IDOR/BOLA (`CurrentMemberProvider.java:1`-`:4`). A missing subject or unauthenticated context throws
`UnresolvedMemberException` → 401 (`JwtCurrentMemberProvider.java:38`,`:53`).

**(2) Prod decoder built only when configured.** `auth0JwtDecoder` is annotated
`@Conditional(Auth0IssuerConfiguredCondition.class)` (`SecurityConfig.java:148`), and the condition
requires a *non-blank* `wcm.auth0.issuer-uri` (`Auth0IssuerConfiguredCondition.java:15`-`:17`).
Because the property defaults to empty (`application.yml:12`), a bare or test boot skips this bean
(tests supply a local-keypair decoder instead). When present, the decoder validates signature
against the Auth0 JWKS, the default issuer/expiry, and — if an audience is set — the audience
(`SecurityConfig.java:153`-`:159`); a forged test-JWT fails because its issuer/signature don't match
Auth0.

**(3) Tokenless Graph consent callback.**

```
Browser ──GET /api/graph/connect (JWT)──▶ GraphConsentController.connect
   │   issue(state) binds memberId+expiry, HMAC-signs it      (GraphConsentState.java:55)
   ◀── 302 to Entra authorize URL  ?…&state=<signed>          (GraphConsentController.java:51)
Entra ── user consents ──▶
   ◀── 302 back to /api/graph/callback?code=…&state=<signed>  (NO bearer token)
Browser ──GET /api/graph/callback──▶  permitAll              (SecurityConfig.java:70)
        verify(state): constant-time HMAC + expiry → memberId (GraphConsentState.java:69)
        exchangeCode(memberId, code) → store encrypted token   (GraphConsentController.java:80)
```

The callback derives the member **from the verified state, not from any principal** hitting the open
endpoint (`GraphConsentController.java:76`-`:81`); a forged/stale/tampered `state` throws
`InvalidConsentStateException` → 400 before any token is bound (`GraphConsentState.java:87`,`:103`).

**(4) Hermetic E2E (KTD13).** Under `@Profile("e2e")`, `E2eSecurityConfig` replaces the JWT chain
entirely (`E2eSecurityConfig.java:46`-`:47`). `DebugMemberFilter` reads the `X-Debug-Member` header
and resolves it to a seeded member — first by email, then by `auth0|seed-<slug>` subject, then raw
subject (`E2eSecurityConfig.java:143`-`:152`) — and authenticates the request as that member's id
(`:131`-`:135`). Seeded **MANAGER** members are granted `SCOPE_reconcile:commits` and the
**top-level** exec additionally gets `SCOPE_admin:rcdo` (`E2eSecurityConfig.java:167`-`:176`), so the
*same* route gates apply as in prod. No/unknown header stays anonymous → 401/403 with the same
problem+json bodies (`E2eSecurityConfig.java:96`-`:105`,`:130`).

## Design decisions & rationale

- **Single always-on chain, prod decoder is conditional.** One `SecurityFilterChain` keeps the
  policy in one readable place; gating only the *decoder bean* on `AUTH0_ISSUER_URI` lets the app
  (and the test profile) boot with no Auth0 tenant while still rejecting forged tokens once
  configured (`SecurityConfig.java:147`-`:148`, `Auth0IssuerConfiguredCondition.java:1`-`:5`).
- **Map `permissions` as well as `scope`.** Auth0 RBAC delivers grants in a `permissions` array,
  not the `scope` claim; mapping both means the route gates work whether the tenant uses scopes or
  RBAC permissions (`SecurityConfig.java:117`-`:137`).
- **Audience check is defense against token confusion.** A valid Auth0 token minted for a *different*
  API would otherwise pass issuer/signature; `AudienceValidator` closes that path
  (`AudienceValidator.java:1`-`:5`).
- **Acting member from the token, never the body (KTD6).** This is the structural IDOR/BOLA defense:
  even if a caller spoofs `memberId`, ownership is judged against the JWT subject
  (`CurrentMemberProvider.java:1`-`:4`, `JwtCurrentMemberProvider.java:1`-`:6`).
- **Signed stateless `state` for the tokenless callback (KTD7).** The browser can't carry a bearer
  on the Entra round-trip, so the callback must be `permitAll`; an HMAC-signed, 10-minute `state`
  carrying the member id is the CSRF / authorization-code-injection guard, with no server-side nonce
  store to operate (`GraphConsentState.java:1`-`:14`).
- **Reuse one 256-bit secret for HMAC and AES.** `GraphConsentState` signs with the same
  `wcm.graph.token-enc-key` that `TokenCipher` encrypts with, so the Graph flow has one secret to
  configure (`GraphConsentState.java:39`-`:43`, `TokenCipher.java:28`).
- **E2E auth is a separate profile, not a fallback.** `E2eSecurityConfig` / `DebugHeaderCurrentMemberProvider`
  are `@Profile("e2e")` only and the prod impls are `@Profile("!e2e")`, so the header path can never
  be reached in prod (`E2eSecurityConfig.java:46`, `JwtCurrentMemberProvider.java:20`).
- **Filter-chain denials get the same problem+json shape.** Without `ProblemAuthHandlers` the
  stateless resource-server chain returns an empty 401/403 body; wiring them on *both* chains keeps
  the error contract uniform (`ProblemAuthHandlers.java:1`-`:8`, `SecurityConfig.java:101`-`:113`).

## Gotchas & sharp edges

- **`/api/graph/callback` is permitAll — but only `GET`.** The matcher is method-scoped
  (`SecurityConfig.java:70`); any other verb on that path falls through to `authenticated()`.
- **Empty `AUTH0_ISSUER_URI` means no prod decoder.** Boot succeeds, but real Auth0 tokens are not
  validated until the issuer is set; a deploy that forgets it silently runs without prod validation
  (mitigated in tests by a local-keypair decoder) — `Auth0IssuerConfiguredCondition.java:1`-`:5`.
- **Audience is optional.** If `wcm.auth0.audience` is blank, only issuer/expiry are checked and the
  audience validator is *not* composed (`SecurityConfig.java:155`-`:158`).
- **`TokenCipher`/`GraphConsentState` boot even with no key.** They are "unconfigured," so consent
  and token operations throw at *invocation* time, not at startup (`TokenCipher.java:71`-`:75`,
  `GraphConsentState.java:119`-`:123`). Read of Outlook connection still works (it just reports
  not-connected).
- **E2E header is trusted as identity.** `X-Debug-Member` is an unauthenticated identity assertion —
  safe ONLY because the chain that honors it is `@Profile("e2e")` and the seeded data is hermetic
  (`E2eSecurityConfig.java:1`-`:17`). Never enable that profile in prod.
- **Coarse scope ≠ data scope.** `SCOPE_reconcile:commits` lets a manager *reach* the rollup/review
  routes, but the rows returned are still filtered to their reports by the row-level layer in the
  services — the two gates are independent (TECHNICAL.md §4 step 3).
- **Two profiles map the *same* admin grant differently.** Prod derives `SCOPE_admin:rcdo` from the
  Auth0 `admin:rcdo` permission; e2e grants it to the seeded **top-level** member only
  (`E2eSecurityConfig.java:172`-`:174`). Line managers/ICs get 403 on admin RCDO routes in both.

## Connects to

- [02-api-contract.md](02-api-contract.md) — the REST routes these gates protect.
- [04-integrations-eventing.md](04-integrations-eventing.md) — the Graph consent/token flow and the
  `commit.locked` calendar sync this layer protects (consent `state`, `TokenCipher`).
- [01-domain-lifecycle.md](01-domain-lifecycle.md) — the lifecycle whose manager transitions the
  `SCOPE_reconcile:commits` gate protects.
