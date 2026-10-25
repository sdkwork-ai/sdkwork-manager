# Manager Launch Readiness

Status: active
Owner: SDKWork maintainers
Updated: 2026-07-18

Pre-launch checklist for the commercial PC `backend-admin` host. This document
is release evidence guidance, not authorization to enable unapproved modules.

## 0. Current readiness status

Repository verification, production PC build, SDK boundary checks, topology,
cloud gateway configuration validation, and automated TypeScript/Rust tests
pass locally. This is code-release evidence only; production commercialization
is not complete until the following release blockers are closed and recorded:

- run `/healthz`, `/readyz`, login/session, tenant-isolation, and every domain
  operations smoke against the target IAM and domain databases;
- migrate and initialize the Manager tenant-application entitlement authority,
  provision a control-plane identity for grants and trusted service identities
  for verify calls, and record Payment/Order/domain enforcement smoke evidence;
- deliver an IAM service-account client-credentials or workload-token exchange
  that issues short-lived, tenant-bound dual tokens whose RBAC scope includes
  `manager.entitlements.enforce`; the existing service-account directory alone
  is not credential issuance and does not close this gate;
- provision production IAM roles explicitly; the Manager default grant excludes
  payment certificate, sandbox-trigger, and webhook-signature-test permissions;
- record provider credentials, storage bindings, database migration evidence,
  release artifact checksum, rollback version, CDN path, and monitoring owner.

Do not mark a production cutover complete from `pnpm verify` alone.

## 1. Repository verification

```bash
cd sdkwork-manager
pnpm install
pnpm --dir apps/sdkwork-manager-pc typecheck
pnpm --dir apps/sdkwork-manager-pc build
pnpm test:vitest
node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
node ../sdkwork-specs/tools/check-application-layering.mjs --workspace .
node ../sdkwork-specs/tools/check-tailwind-integration.mjs --root .
```

Run the repository `pnpm verify` gate in CI after the module-level commands
above. It includes contract checks, production PC build, cloud gateway bundle
validation, Rust clippy/tests, and API envelope alignment.

## 2. PC module smoke

```bash
pnpm start                    # manager-server on :18092
pnpm dev                      # PC shell on :5190 through the IAM dev bootstrap runner
curl http://127.0.0.1:18092/healthz
```

Sign in at `http://127.0.0.1:5190/auth/login`, then confirm:

- `/app/v3/api/system/iam/runtime` and
  `/app/v3/api/system/iam/verification_policy` return SDKWork success
  envelopes through the configured platform gateway;
- password, verification-code, registration, recovery, OAuth, QR login, and
  session bridge entries match the public IAM runtime policy without a
  Manager-local capability override;
- `/auth/register`, `/auth/forgot-password`, `/auth/oauth/callback/:provider`,
  and QR deep links remain inside the canonical IAM route surface;
- a valid dual-token session survives browser reload, propagates logout across
  tabs, and does not restore a persisted single-token payload;
- the global Header exposes only registered and permitted modules;
- selecting **Identity & Access** renders its module Header and its own Sidebar;
- the IAM Sidebar exposes only the routes allowed by the current session scope;
- Trade Center exposes seven permitted routes and write actions only to
  `commerce.orders.manage` operators;
- Marketing Center exposes five permitted routes and campaign status actions
  only to `commerce.marketing.manage` operators;
- Payment Center exposes monitor, provider, and channel routes in production,
  while `/admin/payments/integration` remains absent;
- Payment and Order upstream admin workspaces receive capability-aware props
  from the Manager IAM session; read-only operators retain list/detail access
  but do not render create, update, delete, replay, test, rotate, cancel, or
  close controls without the exact OpenAPI command permission;
- payment certificate, sandbox-trigger, and webhook-signature-test permissions
  are not part of the Manager application's default IAM grant; non-production
  diagnostics require a separately approved operator role with explicit grants;
- Drive Center exposes its eight routes according to the matching
  `drive.*.admin` permission;
- Customer Center exposes overview and directory to `iam.users.read`
  operators, resolves `/admin/customers/:userId` after browser reload, masks
  email/phone, and loads Membership only with `commerce.memberships.read`;
- Membership Center exposes overview, members, plans, package groups,
  packages, and entitlements to `commerce.memberships.read`; member detail is
  deep-linkable and write actions appear only with `commerce.memberships.manage`;
- users, tenants, organizations, authorization, OAuth, account binding, and
  audit deep links load their owning IAM package without an invalid React Hook
  runtime error;
- a disallowed deep link shows the host access-denied state; and
- logout invalidates the protected route and returns to `/auth/login`.

Do not replace `pnpm dev` with a direct `vite` command. The repository script
uses IAM's canonical renderer bootstrap runner to create a private,
manifest-scoped credential-entry token for local development only.

## 3. Environment and session safety

1. Start from `apps/sdkwork-manager-pc/.env.example` or the selected
   environment template. Tracked templates contain only public base URLs and
   non-secret IAM runtime choices.
2. Verify the selected profile uses `VITE_SDKWORK_MANAGER_APPLICATION_PUBLIC_HTTP_URL`
   for manager APIs and for IAM, Drive, Membership, Order, Promotion, and Payment
   SDKs. In `standalone` profiles all SDKs resolve through the application
   ingress; `VITE_SDKWORK_MANAGER_PLATFORM_API_GATEWAY_HTTP_URL` is cloud-only
   and must not appear in standalone env files (see
   `APP_RUNTIME_TOPOLOGY_SPEC.md` section 7).
3. Confirm no `VITE_ACCESS_TOKEN`, `SDKWORK_ACCESS_TOKEN`, password, refresh
   token, or private key is present in tracked env files, manifests, build logs,
   or the static asset bundle.
4. Confirm the release records `deploymentProfile` (`standalone` or `cloud`),
   browser runtime target, public runtime config version, and CDN cache
   invalidation plan.

## 4. Module release gate

Every enabled contribution must provide all of the following evidence before it
is added to `src/bootstrap/adminModuleAssembly.ts`:

| Gate | Required evidence |
| --- | --- |
| Ownership | Module-local `component.spec.json`, `backend-admin` surface, owning domain and package version |
| Routing | Unique `/admin/...` prefix, route-collision test, declared default route, module Header and Sidebar metadata |
| SDK and auth | Composed backend SDK facade, shared TokenManager injection, no raw HTTP/manual headers, IAM permission mapping |
| Commercial | Entitlement key, tier, release channel, server-side entitlement enforcement, upgrade/support copy owner |
| Quality | Loading, empty, validation, error, and access-denied states tested by the owning module; typecheck and smoke result recorded |
| Release | Compatible backend/API version, rollback package version, feature-flag owner, operator runbook, release notes |

Commercial modules are fail-closed through the Manager-owned tenant application
authority. The PC shell reads the authenticated application's snapshot through
the composed Manager Backend SDK and renders paid modules only when the snapshot
is active, unexpired, and contains the contribution's entitlement key. Loading
or API failure never grants a paid module. Do not manually add paid entitlement
keys in browser configuration or bypass the backend check.

The authority persists versioned snapshots and auditable grants in
`platform_manager_entitlement_snapshot` and
`platform_manager_entitlement_grant`. `manager.entitlements.manage` is reserved
for the licensing/control-plane identity; `manager.entitlements.enforce` is
reserved for trusted gateway/domain service identities. Payment, Order,
Promotion, Membership, and Drive paid commands must call the generated Manager
Backend SDK (`commercialEntitlements.verify` in TypeScript or
`commercial_entitlements_verify` in Rust) before execution. Browser visibility
is only a usability projection. Do not derive
these keys from Membership
`/memberships/entitlements`: that API lists end-user membership subscription
benefit accounts (`benefit_code`, quota, membership id) within a tenant and is
not a tenant application licensing authority.

## 5. Database lifecycle

```bash
pnpm db:validate
pnpm db:plan
pnpm db:migrate
pnpm db:status
```

The `0002_manager_commercial_entitlements` migration creates the snapshot and
grant tables. Apply it before enabling any paid tier. Its down migration removes
all tenant licensing state and is therefore allowed only during a pre-launch
rollback after exporting the grant inventory; production incidents should use a
forward fix or suspend snapshots instead.

## 6. IAM app bootstrap

Manifests are bootstrap-ready (`audit-app-manifest-bootstrap` reports 2 ready, 0 blocked).

When IAM backend is available from workspace root:

```bash
node bin/bootstrap-all-apps.mjs --filter sdkwork-manager --appbase-root sdkwork-iam --profile dev --dry-run
node bin/bootstrap-all-apps.mjs --filter sdkwork-manager --appbase-root sdkwork-iam --profile dev
```

The repository also exposes the canonical thin wrapper for a single Manager
manifest. Supply backend bootstrap credentials through the approved IAM
operator environment, never through a tracked env file:

```bash
pnpm admin:bootstrap:app -- --config agent.app.config.json --domain admin.sdkwork.com
```

Note: workspace default runner path targets `sdkwork-appbase`; use `--appbase-root sdkwork-iam` until the workspace bootstrap entry is repointed.

For a production browser release, `SDKWORK_ACCESS_TOKEN` MUST NOT appear in a
`VITE_*` variable, public runtime config, HTML document, or static asset. The
Manager production build intentionally contains no credential-entry handoff.
Production credential-entry must be supplied by an IAM/gateway-attested
application context that resolves the registered tenant application from the
trusted deployment route. Do not release a browser deployment that substitutes
a long-lived bootstrap token for this platform capability.

## 7. Cloud browser packaging

```bash
pnpm release:package:cloud
pnpm release:validate:cloud
```

Artifact: `apps/sdkwork-manager-pc/dist/` with CycloneDX evidence under
`artifacts/release/sbom/`. Platform cloud gateway registration, configuration,
and rollout are owned by the platform gateway repository.

## 8. Operations suite dependency matrix

| Domain | Gateway feature | Required runtime configuration | Health/smoke evidence |
| --- | --- | --- | --- |
| IAM | `foundation-appbase` | IAM database and application bootstrap context | Login, session restore, permission-denied behavior |
| Drive | `foundation-drive` | `DRIVE_*` database/lifecycle and provider configuration | Providers, quotas, spaces, audit, maintenance |
| Membership | `foundation-membership` | `MEMBERSHIP_*` database/lifecycle and fulfillment service credentials | Customer membership tab, members, plans, packages, entitlements |
| Order | `foundation-order` | `ORDER_*` database/lifecycle and approved integration ports | Orders, after-sales, shipments, refunds, withdrawals |
| Promotion | `foundation-promotion` | `PROMOTION_*` database/lifecycle | Overview, offers, stock, codes, applications |
| Payment | `foundation-payment` | `PAYMENT_*` database/lifecycle and provider credentials | Monitor, providers, channels, webhooks, reconciliation |

The platform gateway release must include the `manager-operations-suite`
aggregate Cargo feature. A manifest registration without the compiled feature
is a release blocker because it produces `embedded_dependency_not_available`.

Deferred items remain `sdkwork-discovery` until RPC/cloud-split discovery is
required and mobile `deploy.yaml` packages while this release is PC web only.

## 9. Operations smoke

After IAM bootstrap, use a tenant-scoped operator and verify:

1. Trade lists return one server page at a time; order detail loads; a permitted
   non-production cancel/close command is audited; refund/withdrawal review
   updates are visible after refresh.
2. Marketing overview totals match list filters; offers paginate; a permitted
   status toggle persists and is isolated from another tenant.
3. Payment monitor lists intents, attempts, webhooks, and reconciliation;
   provider/channel reads succeed; production has no integration route.
4. Drive provider, quota, space, audit, maintenance, and download-package lists
   load through the shared operator session.
5. Customer directory requests one IAM page at a time; customer detail masks
   contact data and does not show Membership without its read permission.
6. Membership member detail survives a direct browser reload; another tenant
   or organization cannot retrieve or update it; catalog lists paginate and a
   permitted non-production status/catalog change persists after refresh.
7. A read-only operator sees no mutation controls and direct mutation requests
   receive an HTTP 403 `ProblemDetail` with numeric code and `traceId`.
8. Unknown resources return HTTP 404; domain failures never return HTTP 200
   with a non-zero business code.
9. An unconfigured, suspended, expired, or missing entitlement returns an
   `allowed: false` verify decision; an active grant returns `allowed: true`
   with the same immutable snapshot version observed by the licensing service.
10. Direct paid Payment/Order/domain commands are rejected server-side when the
    verify decision is false. The current static cloud-gateway policy chain does
    not perform this external decision call, so a domain-service enforcement
    adapter or a future asynchronous gateway policy adapter is a cutover gate.
11. The enforcement adapter authenticates with a short-lived, tenant-bound IAM
    service-account dual token carrying `manager.entitlements.enforce`. It must
    not use the IAM super-admin bootstrap-body credential, a tracked/static
    token, or the end-user/operator token being authorized. IAM currently lacks
    this machine credential issuance flow, so paid command cutover remains
    blocked until that platform capability and its rotation/revocation smoke are
    delivered.

This release includes the Manager `0002_manager_commercial_entitlements`
migration and no Membership migration. Rollback normally consists of restoring
the prior PC asset and gateway versions while retaining entitlement tables;
domain data and licensing records must not be deleted during rollback.

Monitor gateway `/healthz`, `/readyz`, dependency bootstrap errors, IAM denials,
payment webhook/reconciliation failures, refund/withdrawal retries, campaign
status failures, and Drive provider/maintenance failures during the cutover.

## 10. Production cutover

1. Select the production topology profile from `etc/deployments/cloud.production.env`
2. Deploy `manager-server` binary and cloud gateway config bundle
3. Publish versioned PC static assets from `apps/sdkwork-manager-pc/dist/` and
   record checksum, CDN path, cache invalidation, and prior asset version
4. Execute IAM bootstrap for production tenant
5. Confirm the platform gateway binary contains `manager-operations-suite` and
   all five domain database/lifecycle profiles resolve without fallback tenants
6. Run the PC and operations smoke checklists and monitor `/healthz`, `/readyz`,
   IAM failures, authorization denials, route-load errors, domain backlogs, and
   API envelopes (`code: 0`, `traceId`)

## 11. Rollback

For a browser release, restore the previously recorded static asset version and
runtime public endpoint configuration, then invalidate only the affected CDN
paths. Roll back a contribution by removing its explicit assembly import or
releasing the recorded previous package version; do not delete domain data or
alter permission catalogs from the manager host. If a domain module introduced
a backend migration, follow that module's migration rollback or approved
forward-fix plan before restoring its UI package.

For an operations-suite failure, first disable the affected Manager module at
the assembly/release boundary and restore the previous static asset and gateway
binary versions. Do not delete orders, promotion records, payment events,
refunds, withdrawals, or Drive objects. Payment provider/channel changes and
campaign status changes must be reverted through their audited domain commands;
database rollback is permitted only under the owning domain's runbook.
