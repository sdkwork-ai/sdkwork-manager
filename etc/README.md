# Manager Source Configuration

`sdkwork.deployment.config.json` indexes the supported deployment profiles. The profile files under
`deployments/` are the checked-in source for public origins, bind addresses, and SDK Base URLs.
The canonical matrix contains `standalone|cloud` crossed with
`development|test|staging|production`. Run `pnpm workflow:materialize-client-env` after changing a
profile and `pnpm check:client-env` to verify the tracked PC env projections.

Local `.env` files and process environment variables may override these values. Secrets and access
tokens must not be committed under `etc/`. Validate the topology with `pnpm topology:validate`.

For standalone server development, copy the repository-root `.env.postgres.example` to the ignored
`.env.postgres` overlay. The Manager IAM bootstrap loads that file before database lifecycle setup,
materializes the unified PostgreSQL URL and schema search path, and then exposes the same profile to
the embedded Manager services. On Windows with PostgreSQL running in WSL, use the WSL-forwarded
`127.0.0.1:5432` endpoint unless the local WSL networking configuration requires an explicit address.
The standalone development profile refreshes only this PostgreSQL `portproxy` rule before Manager
starts, so run `pnpm start` or `pnpm dev` from an elevated terminal. Override
`SDKWORK_MANAGER_WSL_DISTRIBUTION` when the PostgreSQL distribution is not `Ubuntu-22.04`, or set
`SDKWORK_MANAGER_WSL_POSTGRES_PORTPROXY_ENABLED=false` when PostgreSQL runs natively on Windows.

The repository-root overlay takes precedence over the legacy sibling `sdkwork-cloudrouter` fallback.
Keep database credentials in `.env.postgres` or protected process environment variables; keep only
development placeholders in `.env.postgres.example`.

Payment database initialization is owned by `sdkwork-payment`. Both Manager development profiles
enable its idempotent `development` seed during gateway assembly so the payment admin workspace has
the provider catalog plus an active local sandbox method and channel after startup. Production
profiles select the `production` seed profile but keep automatic seeding disabled; operators must
explicitly enable or run the controlled Payment database seed during deployment.

<!-- SDKWORK-DEPLOY-LAYOUT: v1 -->
## Installed Runtime Paths

Authority: `APPLICATION_DEPLOY_LAYOUT_SPEC.md` (`../sdkwork-specs/`).

| Item | Value |
| --- | --- |
| `appId` | `sdkwork-manager` |
| `runtimeCode` | `manager` |
| Config root | `/etc/sdkwork/manager/` |
| Runtime TOML | `/etc/sdkwork/manager/config.toml` |
| Secrets | `/etc/sdkwork/manager/secrets/` |
| Override | `SDKWORK_MANAGER_CONFIG_FILE` |

Source profiles live under `etc/` (`sdkwork.deployment.config.json` index). Deploy manifest: `deployments/deploy.yaml`. Web data-plane source: `deployments/webserver/` (`SDKWORK_WEBSERVER_SPEC.md` layout v3).

```bash
node ../sdkwork-specs/tools/check-source-config-standard.mjs --root .
node ../sdkwork-specs/tools/check-application-deploy-layout.mjs --root .
node ../sdkwork-specs/tools/check-webserver-toml-standard.mjs --root deployments/webserver
```
<!-- /SDKWORK-DEPLOY-LAYOUT -->


