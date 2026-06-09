<!-- EXTERNAL_SERVICES_SETUP.md — step-by-step setup for the external services WCM integrates (Auth0 + Microsoft Graph),
     and exactly which .env values each step produces. Used when wiring the live integrations (U15/U16/U22/U32). -->

# External Services Setup — Auth0 & Microsoft Graph

Do these when ready to wire the **live** integrations. Until then the app builds/tests with hermetic doubles. Each step says which `.env` variable it produces (see `.env.example`).

## A. Auth0 (login + API authorization)

1. Create a free **Auth0 tenant** (auth0.com → sign up). Region note: the tenant domain looks like `your-tenant.us.auth0.com`. → `VITE_AUTH0_DOMAIN`, and `AUTH0_ISSUER_URI = https://<domain>/` (trailing slash).
2. **Applications → Create Application** → *Single Page Web Applications* (React). In its settings:
   - **Allowed Callback URLs**: `http://localhost:4200, http://localhost:5173, https://<deployed-cloudfront-domain>`
     (`:4200` is the host-shell dev origin; `:5173` a standalone preview; add the real deployed origin for prod.)
   - **Allowed Logout URLs**: same
   - **Allowed Web Origins**: same
   - Copy the **Client ID** → `VITE_AUTH0_CLIENT_ID`.
3. **APIs → Create API**:
   - Identifier (audience): `https://api.wcm` (any URI; must match) → `VITE_AUTH0_AUDIENCE` and `AUTH0_AUDIENCE`.
   - Signing alg: **RS256**. Enable **RBAC** and **Add Permissions in the Access Token** (API → Settings).
   - **Permissions** tab: add `reconcile:commits` (manager capability — gates rollup/review/reconcile)
     and `admin:rcdo` (gates the Strategy **edit-tree**: create/update/delete RCDO nodes). Add any
     others the app guards.
4. **Roles** (User Management → Roles):
   - create a `manager` role → assign `reconcile:commits` → assign to the demo manager users;
   - create an `admin` role → assign `admin:rcdo` (the RCDO strategy editor) → assign to the
     org-root/exec user. (Employees get no extra permission; an admin may also be a manager.)
5. No client secret is needed (SPA uses PKCE; the backend validates via JWKS).

**Result → fill in `.env`:** `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `AUTH0_ISSUER_URI`, `AUTH0_AUDIENCE`.

## B. Microsoft Graph (Outlook delegated calendar)

> **No Azure subscription needed.** A *subscription* is the billing container for Azure cloud
> resources; **app registrations live in Entra ID (the directory), which is free**. If the M365
> Developer Program or an Azure-subscription signup rejects you, use the personal-account path
> below — it works with any free outlook.com account (which includes the calendar we sync to).

**Path 1 — personal Microsoft account (no program, no subscription):**
1. Use (or create at signup.live.com) a **free personal Microsoft account** (outlook.com — its mailbox includes the calendar Graph writes to).
2. Sign in at **entra.microsoft.com** (ignore any "add a subscription" upsell — a free Default Directory tenant is created automatically).
3. **App registrations → New registration**: supported account types = **"Accounts in any organizational directory and personal Microsoft accounts"** (key — lets the personal account consent). Redirect URI (Web): `http://localhost:8080/api/graph/callback`.
4. **Certificates & secrets → New client secret** → `AZURE_CLIENT_SECRET` (🔒).
5. **API permissions → Microsoft Graph → Delegated**: `Calendars.ReadWrite`, `User.Read`, `offline_access`. No admin-consent step — consent happens at sign-in.
6. `.env`: `AZURE_CLIENT_ID` from the registration; **`AZURE_TENANT_ID=consumers`** (or `common`) — personal accounts don't use a directory tenant id.

**Path 2 — M365 Developer tenant (if eligible):**
1. Get a **free Microsoft 365 Developer tenant** (developer.microsoft.com/microsoft-365/dev-program) — instant Entra tenant + sample mailboxes for the demo.
2. **Entra admin center → App registrations → New registration**:
   - Supported account types: *Accounts in this org directory only* (single tenant) is fine for the dev tenant.
   - **Redirect URI** (Web): `http://localhost:8080/api/graph/callback` (add the deployed `https://<host>/api/graph/callback` later).
   - Copy **Application (client) ID** → `AZURE_CLIENT_ID`, and **Directory (tenant) ID** → `AZURE_TENANT_ID`.
3. **Certificates & secrets → New client secret** → copy the value immediately → `AZURE_CLIENT_SECRET` (🔒 secret).
4. **API permissions → Add → Microsoft Graph → Delegated**: add `Calendars.ReadWrite`, `User.Read`, `offline_access`. Click **Grant admin consent** (you're admin of the dev tenant).
5. The redirect URI in step 2 must equal `AZURE_REDIRECT_URI` in `.env`.

**Result → fill in `.env`:** `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_REDIRECT_URI`.

## C. Generated locally (not from any dashboard)

- `GRAPH_TOKEN_ENC_KEY` — generated at build time (`openssl rand -base64 32`), written into the gitignored `.env`, used to encrypt stored per-user Graph refresh tokens at rest.
- `POSTGRES_PASSWORD` — a strong local value.

## D. AWS (already configured)

`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_ACCOUNT_ID` / `AWS_DEFAULT_REGION` / `AWS_S3_BUCKET` come from `~/gauntlet/.env` (account `asl-learning`, admin). CDK pushes the backend secrets above into **AWS Secrets Manager**; the `VITE_*` values are baked into the frontend build for the deployed bundle.

## Wiring order in the build
- `.env` (local) for dev → U15 (Auth0 resource server) + U16/U22 (Graph) read these.
- For the deployed env, the same values live in Secrets Manager (backend) / build args (frontend), provisioned by the CDK infra (U28).
- The live real-integration suite (U32) exercises all of the above against the dev tenants + deployed stack.
