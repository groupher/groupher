# Groupher Frontend Core

`frontend/core` is the framework-neutral product and UI layer shared by Main,
Dashboard, Dash, Landing, and selected standalone applications. It is a package,
not an independently deployed website.

## Position in the system

```text
Main / Dashboard / Dash / Landing
                 |
                 v
        PlatformProvider adapter
                 |
                 v
 Core hooks + stores + UI + product units
                 |
                 v
      GraphQL/auth/browser contracts
```

Core owns reusable product behavior and presentation. Framework applications
own routing, server rendering, cache APIs, document shells, and deployment
entrypoints. Core must not import Next.js or TanStack Router runtime APIs; those
capabilities enter through `platform/` contracts.

## Main areas

- `app`: framework-neutral server/client orchestration shared by hosts.
- `hooks`: reusable state and product hooks.
- `lib`: protocol, formatting, browser, and integration helpers.
- `platform`: host adapters for navigation, links, images, and runtime services.
- `stores`: shared Valtio product state.
- `ui`, `shell`, `render`, `unit`: reusable visual and product boundaries.
- `schemas` and `lib/graphql`: authored operations and generated GraphQL output.
- `tailwind`: shared tokens and utility classes.

## Validation

```sh
yarn workspace @groupher/frontend-core type-check
yarn workspace @groupher/frontend-core format:check
yarn test:core
```

Generated GraphQL and generated asset files are updated through repository
scripts, not edited directly.

## Related documentation

- [`docs/rules_fe.md`](../../docs/rules_fe.md)
- [`docs/platform/links.md`](../../docs/platform/links.md)
- [`docs/urql_to_tanstack_query.md`](../../docs/urql_to_tanstack_query.md)
- [`docs/ssr_theme.md`](../../docs/ssr_theme.md)
