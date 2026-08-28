# Groupher Frontend Core

`frontend/core` is the shared product and UI layer used by the TanStack Start
applications. It is a package, not an independently deployed website.

## Position in the system

```text
TanStack Start hosts
        |
        v
Core TanStack Router runtime + product UI
        |
        v
 GraphQL/auth/browser contracts
```

Core owns reusable product behavior and presentation, and directly uses the
TanStack Router runtime without importing any application's generated route tree.
Applications own route trees, server rendering, cache APIs, document shells,
and deployment entrypoints. Cross-application links remain full-document links.

## Main areas

- `app`: shared server/client orchestration.
- `hooks`: reusable state and product hooks.
- `lib`: protocol, formatting, browser, and integration helpers.
- `platform`: the shared TanStack Link and script boundary.
- `stores`: shared Valtio product state.
- `ui`, `shell`, `render`, `unit`: reusable visual and product boundaries.
- `schemas` and `lib/graphql`: authored operations and generated GraphQL output.
- `tailwind`: shared tokens and utility classes.

## Validation

```sh
pnpm --filter @groupher/frontend-core run type-check
pnpm --filter @groupher/frontend-core run format:check
pnpm run test:core
```

Generated GraphQL and generated asset files are updated through repository
scripts, not edited directly.

## Related documentation

- [`docs/rules_fe.md`](../../docs/rules_fe.md)
- [`docs/platform/links.md`](../../docs/platform/links.md)
- [`docs/urql_to_tanstack_query.md`](../../docs/urql_to_tanstack_query.md)
- [`docs/ssr_theme.md`](../../docs/ssr_theme.md)
