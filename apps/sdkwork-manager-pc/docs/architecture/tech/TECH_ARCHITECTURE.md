# SDKWork Manager PC Technical Architecture

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-14
Specs: `sdkwork-specs/APP_PC_ARCHITECTURE_SPEC.md`, `FRONTEND_SPEC.md`

## 1. Architecture Overview

`sdkwork-manager-pc` is the PC unified `backend-admin` host for SDKWork. It
authenticates through IAM and assembles independently owned admin module
packages into one operational workspace. It does not own domain business pages
or make domain SDK calls.

Repository-wide HTTP and database architecture: `../../../docs/architecture/tech/TECH_ARCHITECTURE.md`.

## 2. Technology Choices

| Layer | Technology |
| --- | --- |
| UI | React 19 + Vite |
| Routing | `react-router-dom` |
| Auth | `@sdkwork/auth-pc-react` + `auth-runtime-pc-react` |
| IAM | `@sdkwork/auth-pc-react`, `@sdkwork/auth-runtime-pc-react`, `@sdkwork/iam-app-sdk` |
| Module integration | typed `AdminModuleContribution` registry and explicit build-time assembly |
| Domain SDK clients | constructed in the application bootstrap and injected into each owning `pc-admin-*` module |
| Shared UI tokens | `@sdkwork/ui-pc-react/styles.css` imported once by the host |

## 3. Package Layout

- `packages/sdkwork-manager-pc-core`: IAM runtime, session bridge, global
  TokenManager, and contribution registry validation
- `packages/sdkwork-manager-pc-shell`: Auth routes and domain-neutral
  operational shell/Header rendering
- `packages/sdkwork-manager-pc-admin-iam`: Integration adapter for published
  IAM pages; it owns no copied IAM business behavior
- `src/bootstrap/adminModuleAssembly.ts`: explicit module composition boundary
- `src/`: thin Vite entry and global shell styles

## 4. Runtime Flow

1. The shell loads public IAM auth metadata through
   `system.iam.runtime.retrieve()` and `system.iam.verificationPolicy.retrieve()`.
   Login methods, registration, recovery, OAuth, QR login, and session bridge
   availability are derived from those responses rather than hard-coded by the
   Manager host.
2. Unauthenticated users route to `/auth/login` through the IAM PC runtime.
   `/auth/register`, `/auth/forgot-password`, OAuth callbacks, and QR entry
   routes remain owned and rendered by `@sdkwork/auth-pc-react`.
3. `RequireOperatorSession` validates `auth.sessions.current.retrieve()` before
   rendering a protected route.
4. The complete dual-token IAM session is persisted by the session bridge,
   migrated from legacy session storage when present, and synchronized across
   browser tabs. Logout clears the persisted session and global TokenManager.
5. The host builds a validated module registry from the explicit assembly.
6. IAM session permissions become the read-only navigation scope. Commercial
   offer metadata does not trigger a login-time entitlement request or block
   access to the administration shell; backend authorization remains authoritative.
7. The shell renders global navigation, the active module Header, the active
   module Sidebar, and the module-owned route component.
8. The IAM adapter lazily loads the published IAM pages and creates their
   controllers from the injected IAM service. Module services call generated
   backend SDK clients; server-side authorization remains the authority.

## 5. Local Development

```bash
pnpm --dir apps/sdkwork-manager-pc dev   # http://127.0.0.1:5190
pnpm start                               # API gateway http://127.0.0.1:18092 (repo root)
```

The browser calls the Manager application ingress directly. The Manager Rust
gateway assembly mounts IAM app-api and backend-api routes alongside Manager
routes; Vite does not proxy API traffic. Public browser configuration contains
endpoints only; no access token is embedded through Vite defines. Production builds
resolve workspace SDK packages through `apps/sdkwork-manager-pc/vite.config.ts`
aliases aligned with `tsconfig.base.json`. The same configuration forces a
single React/ReactDOM/i18n runtime for all sibling workspace sources. Tracked
templates are `.env.example`, `.env.standalone.development.example`, and
`.env.standalone.production.example`; private `.env.*` values live in the user
credential bundle and no materialized `.env.<profile>.<environment>` file carries
a secret.

## 6. Verification

```bash
pnpm --dir apps/sdkwork-manager-pc typecheck
pnpm build
pnpm test
node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
node ../sdkwork-specs/tools/check-application-layering.mjs --workspace .
node ../sdkwork-specs/tools/check-tailwind-integration.mjs --root .
```
