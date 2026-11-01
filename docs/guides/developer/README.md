# Developer Guide

Local development and verification for `sdkwork-manager`.

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm start    # Rust gateway :18092
pnpm dev      # PC Vite dev server :5190
```

Environment template: `apps/sdkwork-manager-pc/.env.standalone.development`

## Verification

```bash
pnpm typecheck
pnpm test
pnpm verify   # includes production build + gateway bundle validation
```

## Key packages

| Package | Role |
| --- | --- |
| `@sdkwork/manager-client-core` | URL/session + SDK service facades |
| `@sdkwork/manager-pc-core` | IAM runtime + SDK client factories |
| `@sdkwork/manager-pc-shell` | Auth routes, preference panels |

Standards: `sdkwork-specs/CODE_STYLE_SPEC.md`, `sdkwork-specs/FRONTEND_SPEC.md`
