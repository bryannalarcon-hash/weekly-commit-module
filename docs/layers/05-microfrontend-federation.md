<!-- 05-microfrontend-federation.md — the host/remote Module Federation seam: how host-shell consumes
     the wc remote, who owns the router, and how the remote stays standalone-runnable yet embed-ready. -->

# Layer 05 — Micro-Frontend Shell & Federation

## Executive summary

The frontend is split into two Vite apps joined at runtime by **Module Federation**: `host-shell`
(the consumer, port 4200) and `wc-remote` (the producer, port 4201). The host declares one remote,
`wc`, and lazy-loads two surfaces it exposes — the full module `wc/WeeklyCommitApp` and a
self-contained dashboard tile `wc/WeeklyCommitWidget` — fetching them live over MF, with **no SPA
fallback** (`apps/host-shell/src/App.tsx:22-33`). `react`, `react-dom`, and `react-router-dom` are
declared as shared singletons on both sides so one copy is used at runtime — required because the
**host owns the `BrowserRouter`** and the remote consumes the router context from it
(`apps/host-shell/vite.config.ts:32-38`, `apps/wc-remote/vite.config.ts:58-63`).

The remote is designed to be **standalone-but-remote-ready**: `WeeklyCommitApp` takes optional
`getToken`/`user`/`router` props and falls back to a `MemoryRouter` and self-Auth0 when run alone,
so the same component boots in `vite dev`, in Vitest, and embedded in the host
(`apps/wc-remote/src/WeeklyCommitApp.tsx:111-127`). Auth crosses the seam through `AuthBridge`, which
picks one token source by priority and registers it with the data layer
(`apps/wc-remote/src/app/AuthBridge.tsx:62-132`). The remote keeps **no host chrome** internally: its
single lazy route table renders only the feature plus its own sub-nav, and screens never call the
router directly — thin adapters bridge navigation, satisfying the "no hardcoded shell/navigation" NFR
(`apps/wc-remote/src/app/routes.tsx:53-134`).

## Responsibilities

- **Declare the federation contract.** Host names the `wc` remote and its `remoteEntry.js` URL; remote
  names itself `wc`, sets `filename: remoteEntry.js`, and lists its two `exposes`
  (`apps/host-shell/vite.config.ts:20-39`, `apps/wc-remote/vite.config.ts:49-64`).
- **Pin shared singletons** so the host-provided router context (and React itself) reaches the remote
  unduplicated (`apps/host-shell/vite.config.ts:32-38`).
- **Defer app code behind an MF async boundary** so the federation runtime + singletons initialize
  before any module that statically imports them runs (`apps/host-shell/src/main.tsx:5-9`).
- **Own the router and chrome at the host**; mount the remote under `BrowserRouter` and guard the
  remoteEntry load with an error boundary (`apps/host-shell/src/App.tsx:70-87,131-145`).
- **Keep the remote embed-agnostic**: optional host props, default `MemoryRouter`, self-Auth0, and a
  router-aware shell that maps pathname → active nav group (`apps/wc-remote/src/WeeklyCommitApp.tsx`).
- **Bridge auth across the seam** with a deterministic source priority and register it with `@wcm/api`
  (`apps/wc-remote/src/app/AuthBridge.tsx`).
- **Serve the remoteEntry cross-origin** by attaching CORS headers on both `vite` and `vite preview`
  (`apps/wc-remote/vite.config.ts:27-40`).

## Key components

| Component | Path:line | Role |
| --- | --- | --- |
| Host federation config | `apps/host-shell/vite.config.ts:20-39` | Declares remote `wc` (`type: module`, entry env-overridable) + shared singletons |
| Host dev/preview proxy | `apps/host-shell/vite.config.ts:45-67` | Same-origin `/api` → `WCM_API_TARGET ?? :8080`; `allowedHosts: true` for Dockerized E2E |
| Host async boundary | `apps/host-shell/src/main.tsx:5-9` | `import('./bootstrap')` so MF runtime + singletons init first |
| Host real mount | `apps/host-shell/src/bootstrap.tsx:9-18` | Mounts `<App/>` into `#root` under `StrictMode` |
| Host app shell | `apps/host-shell/src/App.tsx:131-145` | Header chrome, error boundary, `/dashboard` demo vs full-module switch |
| Live module import | `apps/host-shell/src/App.tsx:22-26` | `lazy(() => import('wc/WeeklyCommitApp'))` |
| Live widget import | `apps/host-shell/src/App.tsx:29-33` | `lazy(() => import('wc/WeeklyCommitWidget'))` |
| `RemoteErrorBoundary` | `apps/host-shell/src/App.tsx:36-67` | Renders a message instead of a blank page on remoteEntry failure |
| `ModuleView` | `apps/host-shell/src/App.tsx:70-87` | Wraps remote in a host `BrowserRouter` |
| `DashboardDemo` | `apps/host-shell/src/App.tsx:95-122` | Embeds the widget; `onOpen(route)` → `window.location.assign` |
| Test-only remote stub | `apps/host-shell/src/__mocks__/wc-remote-entry.tsx:6-10` | Resolvable `wc/WeeklyCommitApp` under Vitest (no MF runtime) |
| Test-only widget stub | `apps/host-shell/src/__mocks__/wc-remote-widget.tsx:12-18` | Resolvable `wc/WeeklyCommitWidget` under Vitest |
| Remote federation config | `apps/wc-remote/vite.config.ts:49-64` | `name: wc`, `filename: remoteEntry.js`, two exposes, shared singletons |
| `corsForRemoteEntry` | `apps/wc-remote/vite.config.ts:27-40` | ACAO header on dev serve + preview for cross-origin module import |
| Remote build/server | `apps/wc-remote/vite.config.ts:66-79` | `target: esnext`, `minify: false`, port 4201, `allowedHosts: true` |
| `WeeklyCommitApp` | `apps/wc-remote/src/WeeklyCommitApp.tsx:111-127` | Federated entry: optional host props; providers → RequireAuth → router → WcShell |
| `WcShell` (router-aware) | `apps/wc-remote/src/WeeklyCommitApp.tsx:89-109` | Maps pathname → active nav group; wires nav callbacks to react-router |
| Remote standalone mount | `apps/wc-remote/src/main.tsx:18-22` | Renders `WeeklyCommitApp` for local `vite dev` |
| `WeeklyCommitWidget` | `apps/wc-remote/src/widget.tsx:692-708` | Second expose: self-contained tile with its own per-instance store |
| `AppProviders` | `apps/wc-remote/src/app/AppProviders.tsx:22-40` | Redux → Auth0 (empty-safe) → AuthBridge composition |
| `AuthBridge` | `apps/wc-remote/src/app/AuthBridge.tsx:51-135` | Host↔remote auth seam; registers token getter with `@wcm/api` |
| `AuthProvider` | `apps/wc-remote/src/app/AuthProvider.tsx:65-92` | Empty-safe Auth0 wrapper (stub context when unconfigured / E2E) |
| `RequireAuth` | `apps/wc-remote/src/app/guards.tsx:72-216` | Auth-resolving skeleton / sign-in screen / children when authed |
| `WcRoutes` | `apps/wc-remote/src/app/routes.tsx:137-155` | The single internal route table, all lazy under one Suspense |
| `e2eAuth` | `apps/wc-remote/src/app/e2eAuth.ts` | Hermetic E2E identity source (`X-Debug-Member`, demo personas) |

## Interfaces & contracts

**Federation wire contract.** The remote publishes `remoteEntry.js` named `wc` with two exposes
(`apps/wc-remote/vite.config.ts:50-57`):

| Expose | Source module | Default export | Host import specifier |
| --- | --- | --- | --- |
| `./WeeklyCommitApp` | `src/WeeklyCommitApp.tsx` | `WeeklyCommitApp` | `wc/WeeklyCommitApp` |
| `./WeeklyCommitWidget` | `src/widget.tsx` | `WeeklyCommitWidget` | `wc/WeeklyCommitWidget` |

The host's declaration must match: remote `wc`, `type: module`, entry
`VITE_REMOTE_ENTRY ?? http://localhost:4201/remoteEntry.js` (`apps/host-shell/vite.config.ts:23-30`).

**Component props (the host↔remote prop contract).** `WeeklyCommitApp` accepts all-optional props so it
runs both ways (`apps/wc-remote/src/WeeklyCommitApp.tsx:33-40`):

- `getToken?: () => Promise<string>` — host-injected access-token provider (absent when standalone).
- `user?: { name?: string; isManager?: boolean }` — host-injected identity/role.
- `router?: (children) => JSX.Element` — host supplies a `BrowserRouter` wrapper; defaults to
  `MemoryRouter` (`apps/wc-remote/src/WeeklyCommitApp.tsx:116`).

In practice the host passes only `router` today (`apps/host-shell/src/App.tsx:82-84`); `getToken`/`user`
are part of the contract but the host's current demo leaves auth to the remote
(`apps/host-shell/src/App.tsx:9-11`).

`WeeklyCommitWidget` props (`apps/wc-remote/src/widget.tsx:30-40`): `onOpen?(route)`, `variant?`
(`'card' | 'compact'`), optional pre-fetched `week`. `WidgetRoute` is `'myweek' | 'edit'`
(`apps/wc-remote/src/widget.tsx:27`); the host maps it to a URL via `window.location.assign`
(`apps/host-shell/src/App.tsx:96-99`).

**Shared-singleton contract.** Both configs declare `react`, `react-dom`
(`^18.3.1`) and `react-router-dom` (`^6.26.1`) as `singleton: true`
(`apps/host-shell/vite.config.ts:32-38`, `apps/wc-remote/vite.config.ts:58-63`). The router must be a
singleton because the host provides the `BrowserRouter` and the remote consumes
`useNavigate`/`useLocation` from that one context — two copies would break it
(`apps/host-shell/vite.config.ts:35-37`).

## Data & state

This layer is mostly wiring; runtime data flows through the data layer (see doc 06). The seam-relevant
state:

- **Router state** lives in whatever router the entry receives — the host's `BrowserRouter`
  (real browser URL drives the remote's internal routes) or the remote's default `MemoryRouter`
  standalone (`apps/wc-remote/src/WeeklyCommitApp.tsx:116`, `apps/host-shell/src/App.tsx:83`).
- **Active-nav derivation** is computed from `location.pathname` by `activeGroupFor` / `managerSubFor`
  and fed to the presentational `WcShell` from `@wcm/ui`
  (`apps/wc-remote/src/WeeklyCommitApp.tsx:42-55,89-109`).
- **Unreviewed badge count** is derived from the same review-queue query the queue screen uses, so the
  badge and queue agree; it's skipped entirely for non-managers
  (`apps/wc-remote/src/WeeklyCommitApp.tsx:77-82`).
- **Auth context** is held by `AuthBridge`'s memoized `AuthContextValue` and read via `useWcAuth`
  (`apps/wc-remote/src/app/AuthBridge.tsx:66-135,138-144`).
- **The widget owns an isolated per-instance Redux store** (`useRef(makeStore())`), never the app-shell
  singleton, so a host can drop multiple tiles without collision
  (`apps/wc-remote/src/widget.tsx:699-705`).

## Dependencies

**Depends on**

- `@module-federation/vite` + `@vitejs/plugin-react` — the federation + React build plugins
  (`apps/host-shell/vite.config.ts:7-8`, `apps/wc-remote/vite.config.ts:15-16`).
- `react-router-dom` — `BrowserRouter`/`MemoryRouter`, `useNavigate`/`useLocation`
  (`apps/host-shell/src/App.tsx:19`, `apps/wc-remote/src/WeeklyCommitApp.tsx:15-19`).
- `@auth0/auth0-react` — the standalone identity provider, wrapped empty-safe
  (`apps/wc-remote/src/app/AuthProvider.tsx:9-15`).
- `@wcm/ui` — `WcShell` sub-nav + guard primitives (`apps/wc-remote/src/WeeklyCommitApp.tsx:21-24`).
- `@wcm/api` — `makeStore`, the review-queue hook, and the token-provider setters used by `AuthBridge`
  (`apps/wc-remote/src/WeeklyCommitApp.tsx:25`, `apps/wc-remote/src/app/AuthBridge.tsx:14`). See doc 06.
- The repo-root `postcss.config.js`, pinned so Tailwind scanning is cwd-independent
  (`apps/host-shell/vite.config.ts:10-12`, `apps/wc-remote/vite.config.ts:18-20`).

**Used by**

- `host-shell` is the deployed consumer that fronts the user; the dev proxy points `/api` at the Spring
  backend (`apps/host-shell/vite.config.ts:51-56`).
- The Cypress E2E harness drives the host with `VITE_REMOTE_ENTRY` repointed to
  `host.docker.internal:4201` so a Dockerized browser can reach the remote
  (`apps/host-shell/vite.config.ts:26-29`).
- `wc-remote/src/main.tsx` and Vitest mount `WeeklyCommitApp`/`WeeklyCommitWidget` directly for
  standalone dev and unit tests (`apps/wc-remote/src/main.tsx:18-22`).

## How it works

**Boot order (host):** `main.tsx` does `import('./bootstrap')` — an async boundary so the MF runtime +
shared singletons finish initializing before `bootstrap.tsx` (which statically imports React/the App)
runs (`apps/host-shell/src/main.tsx:1-9`). `bootstrap.tsx` mounts `<App/>` into `#root`
(`apps/host-shell/src/bootstrap.tsx:9-18`).

**Routing decision (host):** `App` checks `window.location.pathname === '/dashboard'`. For `/dashboard`
it renders `DashboardDemo` (host chrome around the federated widget); for every other URL it renders
`ModuleView`, which wraps the full remote in a host `BrowserRouter` so the real browser URL drives the
remote's internal routes — both paths sit inside `RemoteErrorBoundary`
(`apps/host-shell/src/App.tsx:125-145`).

**Inside the remote:** `WeeklyCommitApp` mounts `AppProviders` (Redux → Auth0 → AuthBridge) →
`RequireAuth` → the router wrapper → `WcShell` (sub-nav + `WcRoutes`); the demo-only `PersonaPill` is
added only in an E2E build (`apps/wc-remote/src/WeeklyCommitApp.tsx:117-126`). `WcShell` collapses the
pathname into the active nav group/manager sub-row and routes nav clicks back through `useNavigate`
(`apps/wc-remote/src/WeeklyCommitApp.tsx:89-109`).

**Widget path:** opening `/dashboard` renders the tile; clicking its CTA calls `onOpen(route)`, which the
host turns into `window.location.assign('/?open=edit' | '/')` — landing on the full-module path, whose
own `BrowserRouter` then takes over (`apps/host-shell/src/App.tsx:96-99`).

```
                 host-shell (:4200, consumer)                      wc-remote (:4201, producer)
 ┌───────────────────────────────────────────────┐        ┌──────────────────────────────────────────┐
 │ main.tsx  import('./bootstrap')  ← async MF    │        │ remoteEntry.js  name: wc                  │
 │   boundary; MF runtime + singletons init first │        │  exposes:                                 │
 │ bootstrap.tsx → <App/> into #root              │        │   ./WeeklyCommitApp  ─┐                    │
 │ App.tsx                                        │        │   ./WeeklyCommitWidget ┘                   │
 │  ├ /dashboard → DashboardDemo                  │        │  CORS: ACAO:* on serve + preview          │
 │  │    lazy import('wc/WeeklyCommitWidget') ────┼──MF────┼─▶ WeeklyCommitWidget (own per-inst store) │
 │  │    onOpen(route) → window.location.assign   │        │   AppProviders → WidgetBody (RTK Query)   │
 │  └ else → ModuleView                           │        │                                           │
 │       <BrowserRouter>  (HOST owns router)      │        │   WeeklyCommitApp(props: getToken/user/   │
 │       lazy import('wc/WeeklyCommitApp') ───────┼──MF────┼─▶   router?)  default MemoryRouter         │
 │       RemoteErrorBoundary wraps both           │        │   AppProviders→RequireAuth→router→WcShell │
 └───────────────────────────────────────────────┘        │   WcShell: pathname→nav; WcRoutes (lazy)  │
        shared singletons: react, react-dom,               │   AuthBridge → @wcm/api tokenProvider      │
        react-router-dom  (one runtime copy)               └──────────────────────────────────────────┘
        dev proxy /api → WCM_API_TARGET ?? :8080
```

## Design decisions & rationale

- **Async import boundary** (`main.tsx` → `bootstrap.tsx`). A host that eagerly imports shared deps can
  race MF runtime init; deferring to a dynamic import guarantees the runtime + singletons are ready
  first (`apps/host-shell/src/main.tsx:1-4`).
- **Host owns the router, declares it a shared singleton.** The remote consumes `useNavigate`/
  `useLocation` from the host's `BrowserRouter`; a duplicated `react-router-dom` would mean two contexts
  and a broken router (`apps/host-shell/vite.config.ts:35-37`).
- **Live MF import with no SPA fallback.** The host genuinely fetches the remote over federation rather
  than bundling it, proving the seam; a `RemoteErrorBoundary` turns a failed `remoteEntry` load into a
  visible message instead of a white screen (`apps/host-shell/src/App.tsx:1-3,36-67`).
- **Standalone-but-remote-ready remote.** All host props are optional and default to a `MemoryRouter` +
  self-Auth0, so the identical component boots in `vite dev`, Vitest, and embedded — no separate
  "standalone" build (`apps/wc-remote/src/WeeklyCommitApp.tsx:111-127`).
- **Two exposes, one of them self-contained.** The widget brings its own per-instance store and providers
  so a host dashboard can embed it without the full app shell, and calls back via `onOpen` rather than
  importing host navigation (`apps/wc-remote/src/widget.tsx:684-708`).
- **No hardcoded host chrome/navigation in the remote.** Screens receive callback props; thin route
  adapters are the only place `useNavigate` is called, so screens stay shell-agnostic
  (`apps/wc-remote/src/app/routes.tsx:53-134`).
- **CORS plugin on the remote.** A cross-origin module-script import of `remoteEntry.js` (:4200 importing
  :4201) requires `Access-Control-Allow-Origin`, on both `vite` and `vite preview`
  (`apps/wc-remote/vite.config.ts:22-40`).
- **`esnext` target, `minify: false` on both apps.** MF in Vite 5 needs a modern target; unminified
  output keeps the federation graph debuggable (`apps/wc-remote/vite.config.ts:66-70`,
  `apps/host-shell/vite.config.ts:41-44`).
- **`allowedHosts: true` everywhere.** The Dockerized E2E browser reaches the apps via
  `host.docker.internal`; Vite's host check would otherwise block it
  (`apps/host-shell/vite.config.ts:47-50`, `apps/wc-remote/vite.config.ts:72-74`).

## Gotchas & sharp edges

- **There is no MF runtime under Vitest.** Tests resolve the bare `wc/*` specifiers via workspace
  aliases to placeholder stubs, then `vi.mock()` them per scenario; the default stubs are never asserted
  on directly (`apps/host-shell/src/__mocks__/wc-remote-entry.tsx:1-5`,
  `apps/host-shell/src/__mocks__/wc-remote-widget.tsx:1-6`).
- **MF expose names must match exactly on both sides.** `wc/WeeklyCommitApp` /
  `wc/WeeklyCommitWidget` (host imports) must equal `./WeeklyCommitApp` / `./WeeklyCommitWidget`
  (remote `exposes`), or the import won't resolve.
- **The `/dashboard` demo is gated on `window.location` only.** The full-module mount path (and its
  remote-owned `BrowserRouter`) is byte-for-byte identical for every non-`/dashboard` URL; the demo is a
  separate branch, not a route (`apps/host-shell/src/App.tsx:124-129,141`).
- **Widget navigation is a hard browser navigation, not router push.** `onOpen` resolves to
  `window.location.assign`, deliberately handing the URL to the module path so the module's own router
  takes over — it is not a SPA transition (`apps/host-shell/src/App.tsx:96-99`).
- **`VITE_REMOTE_ENTRY` must repoint the remote for Dockerized E2E.** A container can't reach the host's
  `localhost`; the harness sets the entry to `host.docker.internal:4201`
  (`apps/host-shell/vite.config.ts:26-29`).
- **`getToken`/`user` props are declared but unused by the current host demo.** The host leaves auth to
  the remote and passes only `router`; embedding hosts that want host-owned auth must wire those props
  themselves (`apps/host-shell/src/App.tsx:82-84`, `apps/wc-remote/src/WeeklyCommitApp.tsx:33-40`).

## Connects to

- **Doc 06 — Frontend Data Layer** (`docs/layers/06-frontend-data.md`): `@wcm/api`, the token provider
  `AuthBridge` registers, the RTK Query hooks the shell/widget use, and the MSW backend.
- **`docs/TECHNICAL.md` §1.5** — the one-paragraph frontend-layer overview this doc expands.
