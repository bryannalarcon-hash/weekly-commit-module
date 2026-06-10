<!-- 06-frontend-data.md — the frontend data layer (libs/api + libs/types): the single RTK Query path
     app code uses to reach the backend, its cache-tag graph, the token seam, and the MSW mock backend. -->

# Layer 06 — Frontend Data Layer

## Executive summary

`libs/api` is the **only** path app code uses to reach the backend — no `fetch`/`axios` anywhere in the
screens (`libs/api/src/commitApi.ts:1-2`). It is one RTK Query slice, `commitApi`, whose
`baseQuery` attaches auth on every request: `X-Debug-Member` in the hermetic E2E path, otherwise
`Authorization: Bearer <token>` from an injectable token provider; empty-safe, so requests build with
no header when neither is set (`libs/api/src/commitApi.ts:86-98`). The base URL defaults to `/api`
(same-origin as the host, then proxied to the Spring backend) and is overridable with `VITE_API_BASE`
(`libs/api/src/commitApi.ts:64-77`). Every endpoint in the frozen contract is covered, grouped into
commits, reconciliation/carry-forward, RCDO browse + admin CRUD, review/roll-up/review-queue, pulse,
Outlook integration, and settings (`libs/api/src/commitApi.ts:104-446`).

Cache coherence is a `providesTags`/`invalidatesTags` graph over eleven `tagTypes`
(`libs/api/src/tags.ts:5-17`): a submit busts the commit **and** the week list; a review busts the
review, commit, roll-up, **and** review-queue; any RCDO admin mutation busts the single tree tag so the
picker/browse refetch (`libs/api/src/commitApi.ts:145-149,309-326,218-221`). The store is assembled by
`makeStore()` — `commitApi` reducer + middleware + `setupListeners` — and each call returns an isolated
store so tests and the per-widget instance don't collide (`libs/api/src/store.ts:9-18`).

Two collaborators make the layer testable and contract-faithful: `tokenProvider.ts` is the injectable
auth seam (the host bridge / self-Auth0 / a test mock register a getter here), and
`libs/api/src/msw/handlers.ts` is a **full in-memory mock REST backend** mirroring the contract 1:1, so
FE units and hermetic E2E run with no live backend (`libs/api/src/tokenProvider.ts`,
`libs/api/src/msw/handlers.ts:1-8`). The wire shapes themselves are hand-written DTOs in
`libs/types/src/contract.ts`, mirrored 1:1 from the Java records — **not** generated; conformance is
proven by the backend's MockMvc tests (`libs/types/src/contract.ts:1-4`).

## Responsibilities

- **Be the sole backend access path** for app code via RTK Query (`libs/api/src/commitApi.ts:1-2`).
- **Resolve the API base** — `/api` by default, `VITE_API_BASE` override, absolutized under jsdom
  (`libs/api/src/commitApi.ts:64-77`).
- **Attach auth per request** — `X-Debug-Member` (E2E) or `Authorization: Bearer` (normal), empty-safe
  (`libs/api/src/commitApi.ts:86-98`).
- **Define every endpoint** across the eight groups, with their query shapes and request/response types
  (`libs/api/src/commitApi.ts:104-446`).
- **Maintain cache coherence** through the tag graph (`libs/api/src/tags.ts`, `commitApi.ts` per
  endpoint).
- **Build the store** with the slice reducer + middleware + focus/reconnect listeners
  (`libs/api/src/store.ts`).
- **Expose the injectable token seam** (`setTokenGetter`/`getAccessToken`/`setDebugMember`/
  `clearTokenGetter`) so auth source is swappable (`libs/api/src/tokenProvider.ts`).
- **Provide a contract-faithful mock backend** (in-memory DB, RFC-7807 errors, test toggles) for
  no-backend runs (`libs/api/src/msw/handlers.ts`).
- **Own the shared DTO/contract types** mirroring the Java records (`libs/types/src/contract.ts`).

## Key components

| Component | Path:line | Role |
| --- | --- | --- |
| Barrel exports | `libs/api/src/index.ts:7-28` | Re-exports `commitApi`, tags, store, token provider, MSW handlers; `API_BASE_PATH = '/api'` |
| `commitApi` slice | `libs/api/src/commitApi.ts:100-446` | The RTK Query `createApi` with all endpoints + tag graph |
| `resolveApiBase` | `libs/api/src/commitApi.ts:64-77` | `/api` default, `VITE_API_BASE` override, origin-absolutized for jsdom |
| `baseQuery` | `libs/api/src/commitApi.ts:86-98` | `fetchBaseQuery` + `prepareHeaders` attaching `X-Debug-Member` or Bearer |
| Generated hooks | `libs/api/src/commitApi.ts:448-491` | `useGet*Query` / `use*Mutation` (+ lazy variants) per endpoint |
| Tag vocabulary | `libs/api/src/tags.ts:5-58` | 11 `tagTypes` + typed id helpers (`commitTag`, `weekListTag`, …) |
| `makeStore` | `libs/api/src/store.ts:9-18` | Fresh isolated store: `commitApi` reducer + middleware + `setupListeners` |
| Store types | `libs/api/src/store.ts:20-22` | `AppStore` / `RootState` / `AppDispatch` |
| Token provider | `libs/api/src/tokenProvider.ts:10-44` | Injectable getter + debug-member seam |
| MSW handlers | `libs/api/src/msw/handlers.ts:232-665` | Full mock REST backend mirroring the contract |
| `resetMockDb` | `libs/api/src/msw/handlers.ts:89-101` | Resets the in-memory DB + RCDO tree between tests |
| `problem()` | `libs/api/src/msw/handlers.ts:115-124` | Emits RFC-7807 `ProblemDetail` error bodies |
| `__setMockOutlookConnected` | `libs/api/src/msw/handlers.ts:671-678` | Forces the mock Outlook into CONNECTED for tests |
| `outlookScheduleIllegalStateHandler` | `libs/api/src/msw/handlers.ts:685-688` | Switchable 409 variant for the schedule-1:1 path |
| Contract DTOs/enums | `libs/types/src/contract.ts:6-381` | Hand-written types mirroring the Java records 1:1 |
| Types barrel | `libs/types/src/index.ts:5-28` | Re-exports `./contract` + a legacy `WeeklyCommit` alias |

## Interfaces & contracts

### Endpoint groups (all under base `/api`)

| Group | Endpoints (method · path) | Source |
| --- | --- | --- |
| Commits | `getCommit` GET `/commits/{id}`; `getMyWeeks` GET `/commits`; `getCurrentWeek` GET `/commits/current` (204→`null`); `createCommit` POST `/commits`; `updateCommit` PUT `/commits/{id}`; `submitCommit` POST `/commits/{id}/submit` | `commitApi.ts:106-149` |
| Reconciliation + carry-forward | `startReconcile` POST `/commits/{id}/reconcile`; `patchItemStatus` PATCH `/commits/{id}/items/{itemId}/status`; `markReconciled` POST `/commits/{id}/reconciled`; `getReconciliation` GET `/commits/{id}/reconciliation`; `carryForward` POST `/commits/{id}/carry-forward` | `commitApi.ts:152-199` |
| RCDO browse | `getRcdoTree` GET `/rcdo/tree`; `searchSupportingOutcomes` GET `/rcdo/supporting-outcomes?q=` | `commitApi.ts:202-211` |
| RCDO admin CRUD | create/update/delete on `rally-cries`, `defining-objectives`, `outcomes`, `supporting-outcomes` under `/admin/rcdo/*` | `commitApi.ts:218-306` |
| Review + roll-up | `reviewCommit` POST `/commits/{id}/review`; `getRollup` GET `/rollup`; `getReportLatestCommit` GET `/rollup/reports/{memberId}/latest-commit`; `getReviewQueue` GET `/review-queue` | `commitApi.ts:309-364` |
| Pulse | `getPulse` GET `/commits/{id}/pulse`; `putPulse` PUT `/commits/{id}/pulse` | `commitApi.ts:367-379` |
| Outlook integration | `getOutlookConnection` GET `/integration/outlook`; `connectOutlook` POST `/integration/outlook/connect`; `disconnectOutlook` DELETE `/integration/outlook`; `scheduleOutlookEvent` POST `/integration/outlook/schedule`; `updateOutlookSettings` PUT `/integration/outlook/settings` | `commitApi.ts:382-416` |
| Settings | `getAccount`/`updateAccount` GET/PUT `/settings/account`; `getNotifications`/`updateNotifications` GET/PUT `/settings/notifications` | `commitApi.ts:419-444` |

### Tag types & the invalidation graph

The eleven `tagTypes` (`libs/api/src/tags.ts:5-17`): `Commit`, `WeekList`, `Reconciliation`, `RcdoTree`,
`SupportingOutcome`, `Review`, `Rollup`, `ReviewQueue`, `Pulse`, `Outlook`, `Settings`. Each has a typed
id helper (e.g. `commitTag(id)`, `reviewQueueTag(weekStart)`, `settingsTag('account'|'notifications')`)
(`libs/api/src/tags.ts:22-58`). The notable edges:

| Mutation | Invalidates | Source |
| --- | --- | --- |
| `submitCommit` | `commitTag(id)`, `weekListTag()` | `commitApi.ts:145-149` |
| `createCommit` | `weekListTag()`, `commitTag('LIST')` | `commitApi.ts:131-135` |
| `carryForward` | `commitTag(id)`, `commitTag('LIST')`, `weekListTag()` | `commitApi.ts:191-199` |
| `startReconcile` / `markReconciled` | `commitTag(id)`, `reconciliationTag(id)`, `weekListTag()` | `commitApi.ts:152-184` |
| `patchItemStatus` | `commitTag(id)`, `reconciliationTag(id)` | `commitApi.ts:161-175` |
| `reviewCommit` | `reviewTag(id)`, `commitTag(id)`, `rollupTag()`, `reviewQueueTag('LIST')` | `commitApi.ts:309-326` |
| Any RCDO admin mutation | `rcdoTreeTag()` (+ `'SupportingOutcome'` for leaf CRUD) | `commitApi.ts:218-306` |
| `putPulse` | `pulseTag(id)` | `commitApi.ts:372-379` |
| `disconnectOutlook` / `updateOutlookSettings` | `outlookTag()` | `commitApi.ts:392-416` |
| `scheduleOutlookEvent` | _(none — the event lives in Outlook, not a WCM read model)_ | `commitApi.ts:397-407` |
| `updateAccount` / `updateNotifications` | `settingsTag('account')` / `settingsTag('notifications')` | `commitApi.ts:419-444` |

### Token provider seam

`TokenGetter = () => Promise<string | null>` with `setTokenGetter` / `clearTokenGetter` /
`getAccessToken` (defaults to `null` → no header) plus `setDebugMember` / `getDebugMember` for the
hermetic-E2E `X-Debug-Member` value (`libs/api/src/tokenProvider.ts:10-44`). The `baseQuery` reads these:
debug member wins (sends `X-Debug-Member`, no Bearer); else a token → `Authorization: Bearer`; else no
header (`libs/api/src/commitApi.ts:88-97`).

## Data & state

- **Store shape.** A single `commitApi` reducer slice; RTK Query owns the cache, in-flight requests,
  and tag bookkeeping inside it (`libs/api/src/store.ts:11-14`). `setupListeners` enables
  refetch-on-focus / refetch-on-reconnect (`libs/api/src/store.ts:15`).
- **Cache entries** are keyed by endpoint + arg; tags map entries to invalidation events per the table
  above. `getCurrentWeek` transforms a 204 (no body) into `null` so the "Start your week" empty state
  can render (`libs/api/src/commitApi.ts:124-129`).
- **Mock backend state** (MSW) is module-level in-memory: a `commits` map, a `pulses` map, a single
  mutable `outlook` row, `account`/`notifications` rows, and a mutable `rcdoTree`; `resetMockDb()`
  rebuilds all of them between tests (`libs/api/src/msw/handlers.ts:56-101`).
- **Acting member is server-owned even in the mock.** `createCommit` stamps `MOCK_MEMBER_ID` and
  ignores any client-supplied `memberId` (spoof ignored), mirroring the real contract
  (`libs/api/src/msw/handlers.ts:251-265`, `libs/types/src/contract.ts:60-68`).
- **The mock enforces lifecycle guards**: PUT only while `DRAFT` (409), submit requires every item
  linked (422), status patch only while `RECONCILING` (409) — all as `ProblemDetail`
  (`libs/api/src/msw/handlers.ts:272-312`).

## Dependencies

**Depends on**

- `@reduxjs/toolkit` / `@reduxjs/toolkit/query/react` — `createApi`, `fetchBaseQuery`, `configureStore`,
  `setupListeners` (`libs/api/src/commitApi.ts:9`, `libs/api/src/store.ts:4-5`).
- `@wcm/types` — every DTO/request/response/enum the endpoints, hooks, and mocks are typed against
  (`libs/api/src/commitApi.ts:10-43`, `libs/api/src/msw/handlers.ts:10-45`).
- `msw` — `http` / `HttpResponse` for the mock handlers (`libs/api/src/msw/handlers.ts:9`).
- `VITE_API_BASE` (build-time env) — optional base-URL override (`libs/api/src/commitApi.ts:66-68`).

**Used by**

- **The remote's shell, screens, and widget** consume the generated hooks — e.g.
  `useGetReviewQueueQuery` for the unreviewed badge, `useGetCurrentWeekQuery` in the widget,
  `useLazyGetReportLatestCommitQuery` in the dashboard route adapter
  (`apps/wc-remote/src/WeeklyCommitApp.tsx:25,77-82`, `apps/wc-remote/src/widget.tsx:15,623-626`,
  `apps/wc-remote/src/app/routes.tsx:9,120`).
- **`AppProviders` / `AuthBridge`** build the store with `makeStore` and register the token getter /
  debug member with this layer's `tokenProvider`
  (`apps/wc-remote/src/app/AppProviders.tsx:6,44-46`, `apps/wc-remote/src/app/AuthBridge.tsx:14,126-132`).
- **The widget** mounts its own `makeStore()` instance per tile (`apps/wc-remote/src/widget.tsx:699-700`).
- **FE unit tests + hermetic E2E** run against the MSW `handlers` + `resetMockDb` / test toggles
  (`libs/api/src/index.ts:7-13`).

## How it works

A component renders a generated hook (e.g. `useGetCurrentWeekQuery()`). RTK Query checks its cache by
endpoint+arg; on a miss it dispatches through `baseQuery`. `prepareHeaders` resolves auth — `getDebugMember()`
first (E2E → `X-Debug-Member`), else `await getAccessToken()` (→ `Authorization: Bearer`), else nothing —
and issues `fetch` to `${API_BASE}${url}` (`libs/api/src/commitApi.ts:86-98`). In the browser that hits
`/api`, which the host's Vite dev server proxies to the Spring backend (see doc 05); under jsdom/MSW the
request is intercepted by the matching handler in `handlers.ts`. The response (or an RFC-7807 problem) is
cached and tagged via `providesTags`. A later mutation's `invalidatesTags` evicts the matching entries,
and any mounted subscriber to those tags refetches — that is how a `submitCommit` makes the week list
and that commit re-fetch without manual wiring (`libs/api/src/commitApi.ts:145-149`).

```
 React component
   │  useGet…Query() / use…Mutation()
   ▼
 commitApi (RTK Query)  ── cache hit? ─▶ return cached data (tagged)
   │ cache miss / mutation
   ▼
 baseQuery.prepareHeaders        tokenProvider.ts
   ├─ getDebugMember()  ───────▶  X-Debug-Member (E2E, no Bearer)
   └─ getAccessToken()  ───────▶  Authorization: Bearer <token>   (host getToken / self-Auth0 / test mock)
   ▼
 fetch  ${API_BASE}${url}   (API_BASE = VITE_API_BASE ?? /api)
   │
   ├── browser ───────▶ /api  ──(host Vite proxy)──▶ Spring backend (:8080)
   └── jsdom/E2E ─────▶ MSW handlers.ts  (in-memory DB, RFC-7807 problems)
                                 │
                                 ▼
              response cached + providesTags;  later invalidatesTags → subscribers refetch
```

## Design decisions & rationale

- **RTK Query is the single backend door.** Centralizing all I/O in one slice means one place for auth,
  caching, retries, and the tag graph — and a hard rule that screens never `fetch` directly
  (`libs/api/src/commitApi.ts:1-2`).
- **Injectable token seam over a hardcoded auth client.** `tokenProvider` lets the host bridge,
  self-Auth0, or a test mock register a getter, so the data layer is auth-source-agnostic and tests
  never call real Auth0 (`libs/api/src/tokenProvider.ts:1-9`).
- **Two auth headers, debug-member first.** The hermetic E2E path sends `X-Debug-Member` (no Bearer) to
  the backend's `@Profile("e2e")` header authenticator, so a real browser can drive the app with no
  Auth0 tenant; the check is ordered before the token path (`libs/api/src/commitApi.ts:88-97`).
- **Empty-safe everywhere.** A missing token getter returns `null` and no `Authorization` header, so the
  slice builds and unit tests run without auth configured (`libs/api/src/tokenProvider.ts:27-34`).
- **Default `/api`, same-origin.** Keeping the base same-origin lets the host proxy `/api` to the backend
  without CORS; `VITE_API_BASE` is the escape hatch, and relative bases are absolutized so undici under
  jsdom can build a valid Request (`libs/api/src/commitApi.ts:59-77`).
- **One `rcdoTreeTag()` for all RCDO admin writes.** Any node create/update/delete reshapes the whole
  tree, so invalidating a single tag refetches the browse/picker view rather than tracking per-node
  cache surgery (`libs/api/src/commitApi.ts:213-216`).
- **`reviewCommit` fans out to four tags.** A review changes that commit's review, the roll-up's
  unreviewed counts, and the still-subscribed review queue's `reviewState`, so all three must refetch
  (`libs/api/src/commitApi.ts:318-326`).
- **Fresh store per `makeStore()` call.** Isolated stores keep tests clean and let each embedded widget
  own its own store without colliding with the host or a sibling widget
  (`libs/api/src/store.ts:8-9`, `apps/wc-remote/src/widget.tsx:697-700`).
- **MSW mirrors the contract 1:1.** A full mock backend (CRUD round-trips, lifecycle guards, RFC-7807
  errors) lets the FE build and pass tests before the Spring controllers exist and powers hermetic E2E
  (`libs/api/src/msw/handlers.ts:1-8`).
- **Hand-written DTOs, not generated.** `contract.ts` is authored to match the Java records field-for-
  field; conformance is proven by the backend's MockMvc tests rather than a codegen step, avoiding a
  generator dependency in the build (`libs/types/src/contract.ts:1-4`).

## Gotchas & sharp edges

- **`getCurrentWeek` returns `null`, not 404, when there's no open week.** A 204 is transformed to `null`
  so the empty state renders; callers must handle `null` (`libs/api/src/commitApi.ts:124-129`).
- **Debug-member auth short-circuits the Bearer path.** If `getDebugMember()` is set, **no** Bearer
  token is sent regardless of any registered token getter — they are mutually exclusive by order
  (`libs/api/src/commitApi.ts:88-95`).
- **`X-Debug-Member` is a test-only seam.** It only reaches an authenticator under the backend's `e2e`
  profile; prod/standalone use the Bearer path (`libs/api/src/tokenProvider.ts:6-9`).
- **MSW route order matters.** `/commits/current` and the literal `/commits` are declared **before**
  `/commits/:id` so the param route doesn't swallow them — MSW matches in array order
  (`libs/api/src/msw/handlers.ts:234-249`).
- **The mock DB is module-global, mutable state.** Tests must call `resetMockDb()` between cases (and
  `__setMockOutlookConnected` / `server.use(outlookScheduleIllegalStateHandler)` to flip Outlook
  scenarios) or state leaks across tests (`libs/api/src/msw/handlers.ts:89-101,671-688`).
- **DTO drift is invisible until a contract test fails.** `contract.ts` is hand-maintained against the
  Java records; a field rename on either side is only caught by the backend MockMvc tests, not the
  compiler (`libs/types/src/contract.ts:1-4`).
- **`Page<T>` is a subset of Spring Data's page envelope** (`content`, `totalElements`, `totalPages`,
  `number`, `size`) — other Spring page fields aren't typed (`libs/types/src/contract.ts:173-180`).
- **A spoofed `memberId` is silently ignored** on create — both in the contract and the mock — so don't
  rely on the client to set ownership (`libs/types/src/contract.ts:60-68`,
  `libs/api/src/msw/handlers.ts:256`).

## Connects to

- **Doc 05 — Micro-Frontend Shell & Federation** (`docs/layers/05-microfrontend-federation.md`):
  `AuthBridge` registers the token getter here; the host's `/api` proxy is where browser requests land.
- **`docs/TECHNICAL.md` §1.5** — the frontend-layer overview, and §1.4/§5 for the backend Outlook/Graph
  side of the integration endpoints this layer calls.
