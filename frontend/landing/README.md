# Groupher Landing

`frontend/landing` is Groupher's public marketing and product-information site.
It owns landing-page routing, metadata, static/public assets, and its deployment
adapter; it does not own authenticated community product behavior.

## Position in the system

```text
Visitor -> Edge Router -> Landing/TanStack Start static output -> marketing pages
                              |
                              +-> narrow Core UI/platform reuse
                              +-> explicit product links to Main/Auth/Apply
```

Landing should remain independent of heavy Dashboard, editor, Widget runtime,
and authenticated store graphs. Shared assets are synchronized through the
repository asset scripts rather than imported from another app's build output.

## Local development and validation

```sh
pnpm --filter @groupher/frontend-landing run dev
pnpm --filter @groupher/frontend-landing run type-check
pnpm --filter @groupher/frontend-landing run format:check
pnpm --filter @groupher/frontend-landing run build
pnpm --filter @groupher/frontend-landing run deploy:worker:dry-run
```

TanStack Start prerenders `/`, `/pricing`, and `/book-demo` at build time. The
deployable boundary is only `dist/client`; the generated server build exists to
prerender and is not deployed. Public Vite assets use `/landing/assets/*`, which
the Edge Router and local Gateway map to the static bundle's `/assets/*` path.

The target deployment is the `landing` Worker Static Assets project configured
by `wrangler.jsonc`. Local development also exposes `/health` for Dev Hub and
local Status checks; production availability is covered by Edge Router health
and Gatus page probes.

## Related documentation

- [`docs/deploy.md`](../../docs/deploy.md)
- [`docs/platform/links.md`](../../docs/platform/links.md)
- [`docs/ssr_theme.md`](../../docs/ssr_theme.md)
- [`docs/tanstack_rewrite/landing_rewrite.md`](../../docs/tanstack_rewrite/landing_rewrite.md)
