<!-- EXTERNAL_SERVICES_SETUP.md — step-by-step setup for the external services WCM integrates (Auth0 + Microsoft Graph),
     and exactly which .env values each step produces. Used when wiring the live integrations (U15/U16/U22/U32). -->

# External Services Setup — Auth0 & Microsoft Graph

Do these when ready to wire the **live** integrations. Until then the app builds/tests with hermetic doubles. Each step says which `.env` variable it produces (see `.env.example`).

## A. Auth0 (login + API authorization)

1. Create a free **Auth0 tenant** (auth0.com → sign up). Region note: the tenant domain looks like `your-tenant.us.auth0.com`. → `VITE_AUTH0_DOMAIN`, and `AUTH0_ISSUER_URI = https://<domain>/` (trailing slash).
2. **Applications → Create Application** → *Single Page Web Applications* (React). In its settings:
   - **Allowed Callback URLs**: `http://localhost:5173, https://<deployed-cloudfront-domain>`
   - **Allowed Logout URLs**: same
   - **Allowed Web Origins**: same
   - Copy the **Client ID** → `VITE_AUTH0_CLIENT_ID`.
3. **APIs → Create API**:
   - Identifier (audience): `https://api.wcm` (any URI; must match) → `VITE_AUTH0_AUDIENCE` and `AUTH0_AUDIENCE`.
   - Signing alg: **RS256**. Enable **RBAC** and **Add Permissions in the Access Token** (API → Settings).
   - **Permissions** tab: add `reconcile:commits` (manager capability) and any others the app guards.
4. **Roles** (User Management → Roles): create a `manager` role, assign it the `reconcile:commits` permission; assign the role to the demo manager users. (Employees get no extra permission.)
5. No client secret is needed (SPA uses PKCE; the backend validates via JWKS).

**Result → fill in `.env`:** `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `AUTH0_ISSUER_URI`, `AUTH0_AUDIENCE`.

## B. Microsoft Graph (Outlook delegated calendar)

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
