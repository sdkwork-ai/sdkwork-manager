# Application Guidelines

## SDKWORK Soul

Read `../../../sdkwork-specs/SOUL.md` before executing tasks in this application root.

## SDKWORK Standards

Use `../../../sdkwork-specs/README.md` as the task router, `../../../sdkwork-specs/AGENTS_SPEC.md` for this entrypoint, and inherit the repository rules from `../../AGENTS.md`. Do not copy global standards locally.

## Application Identity

Read `sdkwork.app.config.json` for the PC surface identity, capabilities, SDK wiring, and release metadata. Read `etc/` for PC runtime source configuration.

## Local Dictionary Structure

- `src/`: application bootstrap, composition, styling, and entrypoint.
- `packages/`: authored PC shell, core, and admin capability packages; each package owns its nearest `specs/component.spec.json`.
- `specs/component.spec.json`: PC application contract.
- `etc/`: PC deployable source configuration.
- `sdkwork.app.config.json`: PC surface manifest.

## Spec Resolution Order

Use dynamic progressive loading: read this file and `../../AGENTS.md`, then the PC manifest and nearest component spec, then only task-specific standards from `../../../sdkwork-specs/` before implementation files. Language-specific specs are on-demand only.

## Required Specs By Task Type

React/admin work loads `../../../sdkwork-specs/FRONTEND_CODE_SPEC.md`, `../../../sdkwork-specs/BACKEND_UI_SPEC.md`, and `../../../sdkwork-specs/APP_PC_ARCHITECTURE_SPEC.md`. SDK consumption loads `../../../sdkwork-specs/APP_SDK_INTEGRATION_SPEC.md` and `../../../sdkwork-specs/SDK_SPEC.md`. Runtime config loads `../../../sdkwork-specs/SOURCE_CONFIG_SPEC.md`. Command changes load `../../../sdkwork-specs/PNPM_SCRIPT_SPEC.md`; packaging workflows load `../../../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md`. List/search work loads `../../../sdkwork-specs/PAGINATION_SPEC.md`.

## Code Style Rules

Use TypeScript package boundaries and `@sdkwork/utils`; consume composed SDK facades and the shared TokenManager. Do not introduce raw HTTP, manual authorization headers, local DTO/SDK forks, or edits under generated SDK output.

## Build, Test, and Verification

Run package-local tests and typecheck first, then repository `pnpm verify`. SDK consumer changes also run `node ../../../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace ../..`; list/search changes run `node ../../../sdkwork-specs/tools/check-pagination.mjs --workspace ../..`.

## Agent Execution Rules

Preserve unrelated worktree changes, use exact component contracts, and require evidence before completion. Stop on missing SDK methods or ambiguous app/backend ownership.

## HTTP API Response Envelope

All L2+ SDKWork-owned custom HTTP contracts, including `app-api`, `backend-api`, and SDKWork-owned business `open-api`, `MUST` follow `API_SPEC.md` section 4.5, section 14, and section 15:

- **Default classification:** omitted `x-sdkwork-wire-protocol` means SDKWork-owned custom API (`sdkwork-v3`); only operation-level `x-sdkwork-wire-protocol: external` plus `x-sdkwork-external-protocol-id` identifies a third-party compatibility `open-api` operation.
- **Input:** typed request bodies, section 14.1 list/search/command input, `SdkWorkListQuery`, and `q` for free-text search.
- **Success output:** `SdkWorkApiResponse` with `{ "code": 0, "data": <payload>, "traceId": "<server-uuid>" }`.
- **Error output:** HTTP 4xx/5xx `application/problem+json` (`ProblemDetail`) with numeric `code` and `traceId`; SDKWork-owned errors may include `i18nKey` and `locale` presentation metadata.
- Success `code` is numeric `int32`; HTTP 2xx JSON bodies `MUST` use `0` only. REST semantics remain on HTTP status (`201`, `202`, etc.).
- Platform error codes are numeric non-zero values per section 15.3 (`40001`, `40101`, `40401`, …).
- Single resource: `data.item`
- Lists: `data.items` + `data.pageInfo` (`PageInfo.mode` is `offset` or `cursor`)
- Commands: `data.accepted` plus optional `resourceId` / `status`
- Async accept (`202`): `data.operationId`, `data.status`, optional `pollUrl`
- Operation patterns: retrieve/list/search/create/update/delete/command/async/bulk semantics follow `API_SPEC.md` section 15.4; create uses `201`, delete uses `204` with no JSON body, and `PUT`/`PATCH` use SDK action `update`.

Vendor compatibility `open-api` routes that mirror upstream tool or provider wire (for example OpenAI `/v1/*`, Anthropic/Claude `/anthropic/v1/*`, Google/Gemini `/google/v1beta/*`, Claude Code, or Codex) `MAY` opt out only when every exempt operation declares operation-level `x-sdkwork-wire-protocol: external` and `x-sdkwork-external-protocol-id` per `API_SPEC.md` section 4.5.2. SDKWork-owned business `open-api` operations `MUST NOT` opt out. Mixed OpenAPI documents are validated per operation; one external operation never exempts SDKWork-owned operations in the same document.

Errors `MUST` use HTTP 4xx/5xx with `application/problem+json` (`ProblemDetail`) including required numeric `code` and `traceId`. Optional `i18nKey` and `locale` are display metadata only. Business failures `MUST NOT` use HTTP 2xx with non-zero `code`, string wire codes, `success`, or human `message`.

Forbidden legacy envelopes and fields: `PlusApiResult`, `AppbaseApiResult`, `StoreApiResult`, `SdkWorkResponse`, per-domain `*ApiResult`, wire field `requestId`, bare domain DTOs at the HTTP root, and top-level `{ items, pageInfo, traceId }` without `data`.

Handlers `MUST` serialize success and map errors through `sdkwork-web-framework` response mapping. Generated HTTP SDKs (`--standard-profile sdkwork-v3`) unwrap `data` by default and expose typed numeric `ProblemDetail.code` / `traceId` and returned localization metadata on errors; use `.raw` when the full envelope is required.

Before completing API contract, SDK generation, or frontend service work, run:

```bash
node <sdkwork-specs>/tools/check-api-operation-patterns.mjs --workspace <workspace-root>
node <sdkwork-specs>/tools/check-api-response-envelope.mjs --workspace <workspace-root>
```

Authority: `sdkwork-specs/API_SPEC.md` section 4.5 and sections 14–16, `SDK_SPEC.md` section 4.2, `FRONTEND_SPEC.md`, `MIGRATION_SPEC.md` section 4.2.

## Human Review Rules

Require human review for public UX direction, permission model changes, production credentials, security exceptions, destructive actions, and database lifecycle changes.
