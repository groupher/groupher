# Migrate Groupher Entry To Cloudflare

> Status: proposal
>
> Goal: move the public `groupher.com` entry and static Landing delivery to
> Cloudflare, while preserving Groupher's path-first URL contract.

## Background

Groupher's public product model is path-first:

```text
groupher.com/                         Landing
groupher.com/pricing                  Landing
groupher.com/book-demo                Landing
groupher.com/:community/...           Main
groupher.com/:community/dashboard/... Dashboard
groupher.com/api/graphql              same-origin browser GraphQL facade
api.groupher.com/graphiql             Phoenix GraphQL origin
```

DNS cannot route by pathname. Whichever service receives `groupher.com` must be
the HTTP path router for Landing, Main, Dashboard, Auth, and GraphQL.

Today that routing responsibility lives in `backend/gateway`. The current
Gateway is a Hono/Node reverse proxy deployed on Vercel. It routes browser
requests to these origins:

```text
landing.groupher.com
main.groupher.com
dashboard.groupher.com
auth.groupher.com
api.groupher.com
```

Landing is a static-exported Next app and does not need API or DB access for its
first paint. Serving it from Cloudflare Pages is a better fit than keeping it
behind Vercel Gateway for every `groupher.com/` request.

The recommended Cloudflare target is not a standalone Worker project at first.
Use Cloudflare Pages advanced `_worker.js` mode for the Landing Pages project:

```text
Cloudflare Pages project: landing
  static assets: exported Landing output
  _worker.js: public HTTP path router for paths that need routing
```

This keeps Landing assets and the public entry in one Cloudflare project, while
still allowing programmable routing for non-Landing paths.

Treat static asset bypass as a validation gate for this target. Before relying
on `_routes.json` or equivalent Pages routing controls for cost assumptions,
verify against the final Pages deployment that hashed Landing assets bypass the
router path and that product, API, and Auth requests still reach `_worker.js`.

## Migration Principles

- Move hosting and routing first; evaluate frontend framework changes later.
- Add the Cloudflare router alongside the existing Vercel/Hono Gateway during
  migration. Do not delete `backend/gateway` as part of the first cutover.
- Keep `gateway.groupher.com` available as rollback, comparison target, and
  local development entry until Cloudflare routing is proven.
- Preserve the same-origin browser `/api/graphql` facade. Do not redesign
  GraphQL CORS or cookie behavior during the hosting migration.
- Keep Main, Dashboard, Auth, and Phoenix on their existing origins during the
  first Cloudflare cutover.

## Target Topology

```text
groupher.com / www.groupher.com
  -> Cloudflare Pages Landing project
     -> static asset delivery for hashed Landing assets excluded from Functions
        via _routes.json
     -> _worker.js only for paths included by Pages Functions routing rules
        -> env.ASSETS.fetch(request) for explicit Landing pages
        -> fetch(main origin) for Main product paths
        -> fetch(dashboard origin) for Dashboard product paths
        -> fetch(auth origin) for /api/auth/*
        -> fetch(Phoenix origin) for /api/graphql

api.groupher.com
  -> Phoenix / Fly origin

main.groupher.com
dashboard.groupher.com
auth.groupher.com
  -> existing app origins
```

OAuth provider callback configuration follows the Auth origin, not the public
Landing entry. For production GitHub OAuth, the callback allowlist must contain
`https://auth.groupher.com/api/auth/callback/github`; `groupher.com/api/auth/*`
remains a browser-facing stable entry that the router forwards to Auth.

`gateway.groupher.com` can remain during migration as a rollback or comparison
target. Once the Cloudflare path router passes production smoke tests, the
Vercel Gateway no longer needs to sit in the primary `groupher.com` request
path.

## Platform Limits And Cost

Cloudflare Pages static asset delivery and Pages Functions have different cost
and limit profiles.

Pages static assets are the cheap path:

```text
static asset request
  -> Cloudflare Pages asset service
  -> no Pages Function invocation
```

Cloudflare lists Pages static asset requests and bandwidth as unlimited on both
free and paid Pages plans. Pages Functions are different: they are billed and
limited as Workers.

Current public Cloudflare limits/pricing to account for:

```text
Workers Free:
  100,000 requests/day across Workers and Pages Functions
  10 ms CPU time per invocation

Workers Paid:
  $5/month minimum account charge
  10M requests/month included
  additional requests charged per million
  CPU time included up to a monthly quota, then metered
  no separate egress/bandwidth charge for Workers
```

The router is viable because it should not fan out:

```text
Landing static asset hit -> 0 Function invocations when excluded by routes
Explicit Landing page    -> 1 Function invocation, usually 1 env.ASSETS.fetch
Main/Dashboard/Auth/API  -> 1 Function invocation, 1 origin fetch
```

Do not add multi-origin fan-out, upstream probing, API aggregation, or auth
lookups inside `_worker.js` during the first cutover. Those would turn a routing
layer into an edge BFF and make subrequest/CPU/cost behavior harder to predict.

For cost comparison, the relevant Vercel Pro included usage is:

```text
Vercel Pro:
  $20/user/month
  10M Edge Requests/month included
  1TB Fast Data Transfer/month included
  1M Vercel Function invocations/month included
  4h Function active CPU/month included
```

This means Vercel Pro can already handle moderate cached/static traffic. The
Cloudflare move is still attractive because Landing static assets and bandwidth
can avoid both Vercel Gateway execution and Vercel transfer pressure, while
product paths can be moved gradually.

## Function Invocation Routing

The Cloudflare architecture only stays attractive if static assets bypass
Functions wherever possible.

Pages `_routes.json` or the equivalent Pages Functions routing controls are the
real boundary in standard Pages Functions mode. In advanced `_worker.js` mode,
the worker must still route static hits to `env.ASSETS.fetch(request)` itself and
production validation must confirm whether `_routes.json` is honored for
invocation bypass.

Use route include/exclude rules so hashed static assets do not invoke
`_worker.js`:

```text
exclude from Function when possible:
  /landing/_next/static/*
  /landing/*
  /avatars/*
  /icons/*
  /locales/*
  /pattern/*
  /pwa/*
  /images/*
  /fonts/*
  /*.ico
  /*.json
  /*.png
  /*.txt
  /*.webp
  /*.xml
  /favicon.ico
  /robots.txt
  /sitemap.xml

include in Function:
  /
  /pricing
  /book-demo
  /api/graphql
  /api/auth/*
  /*
```

Exact include/exclude patterns must be validated against the final Landing
export output. The goal is not to route every request through `_worker.js`; the
goal is to route only the paths that need HTTP-level decisions. Cloudflare
`_routes.json` patterns are globs, not named parameters; keep `/:community/...`
as prose for Groupher's public contract, not as a literal config pattern.

## Routing Contract

The Cloudflare `_worker.js` should preserve the current public contract, but not
blindly copy every historical Gateway rewrite.

### Landing

Serve these from Cloudflare Pages assets:

```text
/
/pricing
/book-demo
/landing/_next/static/*
/robots.txt
/sitemap.xml
/manifest.json
/favicon.ico
```

Implementation shape for explicit Landing paths:

```ts
if (isLandingPath(url.pathname)) {
  return env.ASSETS.fetch(request)
}
```

Do not use a global "ASSETS 404 -> Main" fallback. Explicit Landing paths should
return Landing assets or Landing 404s. Product paths should be routed by their
own path rules.

### Main

Default non-Landing, non-Dashboard product paths should go to Main:

```text
/:community/...
```

The public path should be preserved when forwarding to the Main origin.

### Dashboard

Dashboard routing needs a fresh verification before implementation.

The existing Gateway docs describe this historical behavior:

```text
groupher.com/cps/dashboard/appearance
  -> dashboard origin /cps/appearance
```

However the current dashboard app source contains real App Router paths under:

```text
frontend/dashboard/src/app/[community]/dashboard/...
```

and `frontend/dashboard/next.config.js` configures `assetPrefix: '/dashboard'`,
not `basePath: '/dashboard'`.

That suggests `/dashboard` is mainly an external path marker and static asset
marker for the unified host, not necessarily a segment that should be removed
when directly proxying to the Dashboard origin.

Before cutting over, verify the real Dashboard origin with both paths:

```text
https://dashboard.groupher.com/cps/dashboard
https://dashboard.groupher.com/cps/dashboard/appearance
```

If those work, Cloudflare should forward Dashboard paths unchanged:

```text
groupher.com/:community/dashboard/*
  -> dashboard origin /:community/dashboard/*
```

Only keep the old "trim dashboard segment" behavior if the deployed Dashboard
origin still requires it.

Dashboard static assets must continue to route to Dashboard:

```text
/dashboard/_next/static/*
```

### Auth

Keep Auth as an origin service:

```text
/api/auth/* -> https://auth.groupher.com/api/auth/*
```

The router should preserve redirects from Auth instead of following them inside
the proxy. OAuth callback and logout flows need the browser to observe upstream
`30x` responses.

### GraphQL

Phoenix's real GraphQL endpoint is:

```text
https://api.groupher.com/graphiql
```

The browser-facing endpoint should remain same-origin:

```text
https://groupher.com/api/graphql
```

Cloudflare should replace the current Gateway behavior:

```text
/api/graphql -> https://api.groupher.com/graphiql
```

Keep the request credential boundary:

- delete browser `authorization`
- delete the original `cookie`
- forward only `groupher-auth.token` as a Cookie when present

Do not switch browser code directly to `https://api.groupher.com/graphiql`
unless CORS, credentials, cookie domain, and CSRF behavior are intentionally
redesigned. The same-origin facade keeps frontend changes small and preserves
the current security shape.

Production frontend envs should be normalized as:

```text
NEXT_PUBLIC_GRAPHQL_ENDPOINT=/api/graphql
GRAPHQL_ENDPOINT=https://api.groupher.com/graphiql
```

`NEXT_PUBLIC_GRAPHQL_ENDPOINT` is for browser code. `GRAPHQL_ENDPOINT` is for
server-side Next/RSC/route handler code.

Landing should not depend on browser GraphQL in the Cloudflare static path.

## Proxy Policies

The Cloudflare router still needs basic reverse-proxy hygiene.

Keep:

- preserve request method
- forward request body for non-GET/HEAD requests
- use manual redirect behavior
- remove or avoid hop-by-hop headers such as `connection`, `host`,
  `keep-alive`, `te`, `transfer-encoding`, and `upgrade`
- set `x-forwarded-host` and `x-forwarded-proto`
- keep the GraphQL cookie-cleaning policy

Do not copy Node-only details:

- `duplex: 'half'` is only for Node fetch request body streaming
- Node `fs` static file reads should become `env.ASSETS.fetch(request)`
- Node `net`/`tls` WebSocket upgrade proxy cannot be copied directly

The current Node Gateway deletes `content-encoding` and `content-length` from
proxied responses because Node fetch may auto-decode upstream bodies. Cloudflare
Workers may not need that exact workaround. Add it only if smoke tests show
browser decoding or body length errors.

## Local Development

Adding a Pages advanced `_worker.js` does not have to replace local Gateway
development immediately.

During migration, keep two local modes:

```text
default local app development
  -> existing Dev Hub / backend/gateway route chain

Cloudflare routing development
  -> wrangler Pages dev / Pages preview running Landing assets + _worker.js
```

This avoids blocking daily Main/Dashboard/Auth/Phoenix work on Wrangler, local
HTTPS, cookie domain, or Portless changes.

After production traffic moves to Cloudflare, choose the long-term local model
explicitly:

```text
Option A: keep backend/gateway as local-only router
  lower migration risk
  production and local routing logic can drift

Option B: use wrangler Pages dev as the local unified entry
  closer to production
  requires Dev Hub, local ports, HTTPS, and cookie domains to be aligned
```

The recommended path is Option A during cutover, then evaluate Option B after
Cloudflare production behavior is stable.

`backend/gateway` should remain in the repo until both production rollback needs
and local routing needs are resolved.

## Future Framework Options

`frontend/landing` is currently Next.js-based, but it is configured for static
export:

```js
output: 'export'
assetPrefix: process.env.NODE_ENV === 'production' ? '/landing' : ''
cacheComponents: false
```

That is compatible with Cloudflare Pages static hosting. The first migration
should keep Landing on Next export to avoid mixing hosting migration with a
frontend rewrite.

Possible later options:

| Option                | Fit                                                                         | Tradeoff                                                                 |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Next export           | Lowest change. Already matches Landing's static shape.                      | Keeps Next build/tooling for a static marketing app.                     |
| Vinext                | Worth evaluating if the goal is Cloudflare/Vite-aligned Next compatibility. | Requires compatibility checks for current Landing APIs and build output. |
| TanStack Router/Start | Could make Landing lighter if it becomes a Vite-first app.                  | More rewrite work across routing, metadata, i18n, and app conventions.   |
| Astro/Vite static app | Strong fit for marketing/docs-style static content.                         | Full framework migration; not needed for the first cutover.              |

Framework migration should be treated as a later project after Cloudflare entry
routing has passed production smoke tests.

## Migration Steps

### Phase 1: Prepare Landing For Cloudflare Pages

1. Use `yarn workspace @groupher/frontend-landing build:cloudflare` as the
   Cloudflare Pages build command.
2. Ensure `frontend/landing` does not require runtime GraphQL for initial
   rendering.
3. Keep Landing on Next export for the first cutover. Do not rewrite it to
   Vinext, TanStack, Astro, or another framework during the hosting migration.
4. Keep production `assetPrefix: '/landing'` unless the Pages build strategy is
   intentionally redesigned.
5. Keep the Pages output directory as `frontend/landing/out`. Because the
   current production Next build emits HTML that references
   `/landing/_next/static/...`, `build:cloudflare` must prepare
   `out/landing/_next` from `out/_next` before deployment.
6. Add a Pages advanced `_worker.js` entry in the Landing output path.
7. Implement only these responses first:
   - `/health`
   - explicit Landing pages via `env.ASSETS.fetch(request)`
   - `/api/graphql` proxy to Phoenix with cookie cleaning
8. Add Function route include/exclude rules so hashed static assets avoid
   Function invocation where possible.

### Phase 2: Add Product Path Routing

1. Add explicit Main routing for default community paths.
2. Add Dashboard path routing after verifying whether the Dashboard origin needs
   `/dashboard` preserved or trimmed.
3. Add `/api/auth/*` proxy to Auth with manual redirects.
4. Add static asset ownership for `/landing/_next/static/*` and
   `/dashboard/_next/static/*`.
5. Keep `gateway.groupher.com` available for comparison.
6. Keep `backend/gateway` deployed and functional. The Cloudflare router is
   additive in this phase.
7. Confirm each dynamic request produces at most one origin fetch. Do not add
   fan-out or origin probing in this phase.

### Phase 3: Bind Domains

1. Add `groupher.com` to the Cloudflare Pages Landing project's Custom Domains.
2. Add `www.groupher.com` to the same Pages project, or configure a Cloudflare
   redirect between apex and `www` based on the desired canonical host.
3. Remove `groupher.com` and `www.groupher.com` from the Vercel Gateway project
   after Cloudflare validation.
4. Keep origin domains such as `main.groupher.com`, `dashboard.groupher.com`,
   `auth.groupher.com`, and `api.groupher.com` stable.
5. Do not delete the Vercel/Hono Gateway code after domain binding. Keep it for
   rollback and local routing until a separate retirement decision is made.

### Phase 4: Validate And Retire Vercel Gateway

Run smoke tests against the Cloudflare entry:

```text
GET  /
GET  /pricing
GET  /book-demo
GET  /home
GET  /home/dashboard
GET  /home/dashboard/appearance
POST /api/graphql
GET  /api/auth/signin
GET  /landing/_next/static/...
GET  /dashboard/_next/static/...
```

Validate:

- Landing loads from Cloudflare assets
- hashed Landing static assets do not invoke Pages Functions when excluded by
  routing rules
- Main RSC/page responses load correctly
- Dashboard routes and chunks load correctly
- Auth redirects are visible to the browser
- `/api/graphql` works from browser code without CORS changes
- cookies sent to Phoenix are limited to `groupher-auth.token`
- no content decoding errors appear in the browser
- direct `gateway.groupher.com` and Cloudflare-routed `groupher.com` have
  acceptable TTFB and behavior parity
- Pages Functions invocation volume matches expectations:
  - static assets should be near zero invocations
  - product/API/auth paths should be one invocation per browser request
- Cloudflare Workers CPU and subrequest metrics stay comfortably below limits

After this passes, remove Vercel Gateway from the production `groupher.com`
request path. Keep the code until rollback confidence is acceptable, then decide
whether to delete or archive `backend/gateway`.

## Open Questions

- Does the deployed Dashboard origin currently require `/dashboard` to be
  preserved or trimmed?
- Should canonical host be apex `groupher.com` or `www.groupher.com` after Pages
  cutover?
- Does Auth rely on host-specific callback URLs that need Cloudflare-specific
  environment updates?
- Should `api.groupher.com` stay DNS-only to Phoenix, or should it later move
  behind Cloudflare WAF/Worker as a separate API edge project?
- What is the measured monthly request and bandwidth split between Landing
  static assets, product page requests, API requests, and auth requests?
- Do any future real-time features need WebSocket upgrade through the public
  entry? Current frontend source does not show business WebSocket usage, but this
  should remain a release checklist item.

## Recommendation

This migration is worth doing.

The first production target should be:

```text
groupher.com -> Cloudflare Pages Landing advanced _worker.js
```

This gives the static Landing path the shortest route while preserving the
path-first product model and same-origin `/api/graphql` contract. It also lets
the Vercel Gateway leave the primary production path without forcing Main,
Dashboard, Auth, or Phoenix to move at the same time.
