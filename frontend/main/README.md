# Groupher Main

`frontend/main` is the public community application: community home pages,
threads, articles, comments, public Docs, and signed-in reader interactions.

## Position in the system

```text
Visitor/member -> Gateway -> Main/Next.js
                               |
                               +-> Core PlatformProvider and product units
                               +-> Auth Session/token refresh contract
                               +-> Phoenix GraphQL
```

Main owns its Next.js routes, SSR/cache boundaries, metadata, application shell,
and deployment configuration. Reusable product behavior belongs in Core;
Dashboard-only administration and Widget runtime must not enter Main's default
bundle.

## Local development and validation

```sh
yarn workspace @groupher/frontend-main dev
yarn workspace @groupher/frontend-main type-check
yarn workspace @groupher/frontend-main format:check
yarn workspace @groupher/frontend-main build
```

Use `/home` for local UI and Playwright verification. This package uses the
repository's current Next.js runtime; consult the bundled framework docs before
changing routing or server APIs.

## Related documentation

- [`docs/auth/v1.md`](../../docs/auth/v1.md)
- [`docs/platform/links.md`](../../docs/platform/links.md)
- [`docs/ssr_theme.md`](../../docs/ssr_theme.md)
- [`docs/embed-widget/v1.md`](../../docs/embed-widget/v1.md)
