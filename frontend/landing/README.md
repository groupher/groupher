# Groupher Landing

`frontend/landing` is Groupher's public marketing and product-information site.
It owns landing-page routing, metadata, static/public assets, and its deployment
adapter; it does not own authenticated community product behavior.

## Position in the system

```text
Visitor -> Gateway -> Landing/Next.js -> marketing pages
                            |
                            +-> narrow Core UI/platform reuse
                            +-> explicit product links to Main/Auth/Apply
```

Landing should remain independent of heavy Dashboard, editor, Widget runtime,
and authenticated store graphs. Shared assets are synchronized through the
repository asset scripts rather than imported from another app's build output.

## Local development and validation

```sh
yarn workspace @groupher/frontend-landing dev
yarn workspace @groupher/frontend-landing type-check
yarn workspace @groupher/frontend-landing format:check
yarn workspace @groupher/frontend-landing build
yarn workspace @groupher/frontend-landing build:cloudflare
```

This package uses the repository's current Next.js runtime. Consult the bundled
Next.js documentation before changing framework APIs or conventions.

## Related documentation

- [`docs/deploy.md`](../../docs/deploy.md)
- [`docs/platform/links.md`](../../docs/platform/links.md)
- [`docs/ssr_theme.md`](../../docs/ssr_theme.md)
