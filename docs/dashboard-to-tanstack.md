# Dashboard To TanStack Start

> Status: evaluation and migration plan.
>
> Scope: create a new `frontend/dash` TanStack Start sub-app for community
> dashboard experiments. Keep the existing `frontend/dashboard` and `frontend/main`
> apps unchanged during the spike.

## Background

Groupher has two different frontend product shapes:

```text
main
  anonymous-first public pages
  public SSR content must work without a viewer
  viewer-specific state is usually a client-side enhancement

dash
  auth-required community dashboard pages
  no useful anonymous page exists
  SSR must load viewer + community-specific dashboard data before render
```

The current Next.js model is still a good fit for `main`: public community pages,
docs, posts, articles, SEO metadata, and CDN-friendly public content. For these
routes, a server-rendered anonymous baseline plus client personalization is a
valid product model.

Community dashboard pages are different. They are effectively all-or-nothing:
without the viewer, permission scope, and community dashboard payload, the page
should not render. This makes several Next.js App Router features less valuable
for this surface:

- React Server Component boundaries add ongoing `use client` friction for highly
  interactive dashboard UI.
- Partial rendering and streaming are less useful when the page has no meaningful
  public shell.
- Cache Components are not a natural fit for strongly viewer-scoped data.
- Instant navigation and prefetch semantics can become cache/freshness noise when
  each route must be resolved against viewer and community permissions.

The proposed direction is to add a new `dash` app, inspired by Cloudflare's
dashboard naming, and use it to evaluate TanStack Start without disturbing the
existing `dashboard` app.

## Target Shape

```text
frontend/dash
  TanStack Start app
  auth-required runtime
  community dashboard routes
  SSR loads personalized dashboard payloads
  TanStack Router loaders own route data
  TanStack Query owns hydrated client server-state
  frontend/core is reused only where it already works without forcing core-wide
  framework-neutral refactors
```

`dash` is not a replacement for `frontend/dashboard` at the start. It is a
parallel sub-app used to prove whether the runtime, data flow, deployment, and
selected `frontend/core` reuse boundaries are practical.

## Initial Route Candidate

Use one concrete existing surface as the first comparison target instead of only
filtering by route qualities.

Recommended candidate:

```text
/:community/dash
/:community/dash/overview
```

Why this route:

- It keeps the new TanStack Start surface away from the existing
  `/:community/dashboard` path.
- `/:community/dash` is the new entry and can redirect to
  `/:community/dash/overview`.
- `overview` is the first concrete page, so the spike has a named page and a
  clear comparison target instead of only a route shell.
- It is the top-level community dashboard experience, so it directly tests the
  auth-required and viewer-specific SSR model.
- It needs community-specific dashboard payloads but does not start with the
  heaviest editor workflow.
- It has enough permission-dependent UI to expose cache-key and SSR data-shape
  mistakes.
- It gives the spike a clear side-by-side baseline against the current Next.js
  implementation.

Avoid the docs editor, import flow, and other multi-step CMS routes for the first
route. Those should be later candidates after the base runtime, auth, and core UI
reuse are proven.

## Runtime Model

The target request flow for a community dashboard route is:

```text
request /:community/dash/overview
  -> read cookie/header
  -> validate viewer session
  -> no viewer: redirect to login
  -> resolve community
  -> check viewer permission/membership
  -> fetch community dashboard payload
  -> SSR full page
  -> hydrate client with the same private payload
```

This is intentionally different from `main`:

```text
main route
  -> render public anonymous content on SSR
  -> hydrate
  -> client loads viewer-specific state when needed

dash route
  -> authenticate before render
  -> render personalized SSR output
  -> hydrate with private route/query data
```

## Cache Model

TanStack Router loader cache should be treated primarily as client-side route
match cache plus SSR hydration state. It is not equivalent to Next.js Cache
Components and should not be treated as a cross-user server cache.

For dashboard data, cache keys must include the viewer scope:

```ts
queryOptions({
  queryKey: ['community-dashboard', communityId, viewerId],
  queryFn: () => getCommunityDashboard({ communityId, viewerId }),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
})
```

Rules:

- Never key private dashboard data by community alone.
- Include `viewerId` or an equivalent permission/session scope in query keys.
- Treat SSR output as private.
- Prefer `Cache-Control: private, no-store` at first.
- Only consider short `private, max-age=...` headers after proving there is no
  cross-user leakage risk.
- Do not use public CDN caching for personalized dashboard HTML or data.

The useful cache layers for `dash` are:

```text
route loader cache
  Browser-owned route data freshness during client navigation.

TanStack Query cache
  Hydrated server-state reuse, mutation invalidation, and background refetch.

request-local server cache
  Optional dedupe inside one SSR request for repeated viewer/community/permission
  reads.

HTTP private cache headers
  Conservative browser/proxy behavior for user-specific responses.
```

## Server Functions

TanStack Start server functions can replace some app-internal API route usage,
but they should not be treated as a blanket replacement for public HTTP
endpoints.

Use server functions for typed dashboard actions:

```ts
export const updateDashboardLayout = createServerFn({ method: 'POST' })
  .validator(UpdateDashboardLayoutSchema)
  .handler(async ({ data }) => {
    const viewer = await requireViewer()

    return saveDashboardLayout({
      viewerId: viewer.id,
      communityId: data.communityId,
      layout: data.layout,
    })
  })
```

Use route/server handlers for:

- third-party callbacks
- webhooks
- public endpoints
- endpoints that must have stable external URLs

## `frontend/core` Boundary

The main technical risk is not the new router. It is whether the first `dash`
page can reuse selected `frontend/core` pieces without inheriting Next.js runtime
assumptions.

Good candidates for direct sharing:

- UI primitives
- theme tokens and CSS variables
- pure widgets
- domain types
- GraphQL documents and typed helpers
- pure formatters and utilities
- client stores that do not import Next APIs

Needs audit or adapter boundaries:

- `next/link`
- `next/image`
- `next/navigation`
- `next/dynamic`
- `next/server`
- App Router hooks
- React Server Component assumptions
- Next metadata APIs
- Next route handlers
- `useServerInsertedHTML` based theme insertion

Initial scan:

```text
frontend/core files importing next-related APIs: about 113

major groups
  next/link
  next/image
  next/navigation
  next/dynamic
  next/script
  next/server
  next/cache
  useServerInsertedHTML
```

This count is intentionally rough and should be refreshed before implementation.
It is enough to show that `dash` cannot assume `frontend/core` is already
framework-neutral.

Do not clean up these existing `frontend/core` imports as part of the spike. They
serve the current Next.js apps and should remain untouched unless a separate
refactor is explicitly approved.

The `dash` rule is:

```text
reuse core module if it works as-is
add a thin dash-local adapter if the dependency is only Link/Image/navigation
rewrite the small needed piece inside frontend/dash if the core module is
Next-specific or too coupled
```

Possible app-level adapters:

```text
frontend/dash/src/adapters/link.tsx
frontend/dash/src/adapters/image.tsx
frontend/dash/src/adapters/navigation.ts
```

This keeps the spike honest: `dash` must prove its own runtime model without
forcing the existing Next.js surfaces to pay migration cost.

## Theme First Paint

`dash` must independently verify theme first paint. Previous SSR theme work shows
that this is not only a client store problem: the server-rendered DOM, early head
script, CSS variable snapshots, and hydration timing all matter.

Validation requirements:

- SSR emits the correct initial theme-relevant markup and CSS.
- Early theme detection still runs before first paint.
- Community ThemePreset CSS can be injected without relying on Next-only APIs.
- Hydration does not briefly revert `html[data-theme]`.
- The same behavior is tested for light, dark, and system mode.

Suggested verification chain:

```text
Playwright screenshot comparison
  capture first visible frame and hydrated frame for light, dark, and system

Playwright DOM assertions
  verify html[data-theme], color-scheme, and critical CSS variables before and
  after hydration

Chrome DevTools Performance trace
  inspect first paint and hydration timing if screenshot checks show flicker

Optional Lighthouse run
  use only as a secondary signal for regressions, not as the primary acceptance
  gate for theme correctness
```

If `dash` cannot reuse the existing Next-specific insertion mechanism, create a
TanStack Start app-level equivalent rather than moving hacks into individual
widgets.

## Deployment Boundary

Start with independent local and production routing:

```text
local
  main: 3000
  dashboard: 3001
  dash: 3002

production candidate
  /dash/*
  or dash.groupher.com
```

Routing and rollout options:

```text
path-based trial
  Gateway maps /dash/* to the TanStack Start app.
  This is easiest for internal testing and rollback.

host-based trial
  dash.groupher.com points directly at the TanStack Start deployment.
  This isolates cookies, assets, and routing more clearly, but needs DNS and
  deployment environment setup.

future replacement
  Gateway can later route selected /:community/dash requests to dash while the
  existing /:community/dashboard path remains on the current dashboard app.
```

The first production proof should include:

- `/health`
- auth redirect behavior
- SSR GraphQL access
- private cache headers
- static asset loading
- source map/build output sanity
- gateway/proxy route isolation
- CI job for type-check/build
- deployment environment variables for GraphQL/auth endpoints
- preview deployment or temporary host for browser verification

Do not route real community dashboard traffic to `dash` until the spike has a
clear rollback path.

## Migration Phases

### Phase 0: Empty App

Create `frontend/dash` with TanStack Start, React, TypeScript, and the repo's
package manager conventions. Add only a health route and a minimal index route.

Acceptance:

- local dev server starts
- production build passes
- `/health` returns a simple readiness response

Estimate: 0.5-1 day.

### Phase 1: SSR Auth Probe

Add request context that can read cookies/headers and validate the current viewer.

Acceptance:

- anonymous dashboard route redirects to login
- logged-in request can identify viewer during SSR
- no client-only auth fetch is required for the first render

Estimate: 1-2 days, depending on how much auth logic is currently coupled to
Next runtime helpers.

### Phase 2: GraphQL Probe

Connect the existing backend GraphQL service from SSR.

Acceptance:

- route loader can call GraphQL on the server
- auth cookie forwarding matches the existing auth contract
- GraphQL errors render through an app-level error boundary

Estimate: 1 day if the existing GraphQL helper is server-safe; 2-3 days if a
dedicated server helper is needed.

### Phase 3: Minimal Community Dashboard Route

Add a route such as:

```text
/$community/dash
/$community/dash/overview
```

The loader should resolve the viewer, community, permissions, and a minimal
overview payload.

Acceptance:

- SSR HTML contains personalized dashboard content
- different viewers do not share cache
- missing permission returns redirect, forbidden, or not-found according to the
  product rule

Estimate: 2-4 days.

### Phase 4: Core UI Reuse

Render a small real overview surface using `frontend/core` components only where
they are compatible with `dash`.

Acceptance:

- no unexpected `next/*` imports leak into `dash`
- incompatible `frontend/core` components are copied or rewritten locally in
  `frontend/dash` instead of changing the original core module
- theme tokens and global styles render correctly
- hydration has no obvious mismatch

Estimate: 3-6 days. This is the least predictable phase because the initial scan
already shows many `frontend/core` files importing Next APIs.

### Phase 5: Query Hydration And Mutation

Introduce TanStack Query for the dashboard payload and one mutation.

Acceptance:

- SSR data hydrates into the client query cache
- mutation invalidates the correct viewer/community query key
- client navigation freshness behavior is explicit and predictable

Estimate: 1-2 days.

### Phase 6: Real Internal Trial

Expose `dash` behind an internal route, temporary host, or staff-only entry.

Acceptance:

- local and production health checks pass
- real browser verification covers first paint, auth redirect, data load, and
  asset loading
- rollback is a route/proxy change, not a code revert

Estimate: 1-3 days, depending on whether the first deployment target is a simple
temporary host or the existing Gateway path.

Overall spike estimate:

```text
small proof: 1-2 weeks
useful internal trial: 2-3 weeks
full replacement decision: only after the internal trial
```

## Risks

| Risk                                                    | Impact                                  | Mitigation                                          |
| ------------------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| `frontend/core` imports Next APIs                       | `dash` cannot consume shared UI cleanly | audit imports and add app-level adapters            |
| auth is bound to Next runtime                           | SSR auth probe fails                    | isolate auth contract around cookies/headers        |
| GraphQL client assumes browser-first usage              | server loader duplicates data logic     | create server-safe GraphQL helper                   |
| theme first paint relies on Next insertion APIs         | dark/system mode flicker returns        | implement Start-level head/style insertion          |
| personalized data is cached by community only           | cross-user data leakage                 | include viewer/permission scope in every key        |
| production runtime differs from Next/Vercel assumptions | deploy is blocked                       | prove build and health route before business routes |
| dual apps drift in behavior                             | product inconsistency                   | keep `dash` narrow until the route model is proven  |

## Non-Goals

- Do not replace `frontend/main`.
- Do not replace the existing `frontend/dashboard` during the spike.
- Do not redesign the full dashboard IA.
- Do not introduce public caching for personalized dashboard data.
- Do not force all `frontend/core` components to become framework-neutral before
  the first proof.
- Do not clean up or rewrite existing `frontend/core` Next.js imports as part of
  this spike.
- Do not use React Server Components as part of the initial `dash` model.

## Decision Gate

Expand `dash` only if the spike proves all of the following:

```text
auth-required SSR works
community dashboard payload renders server-side
private hydration cache behaves correctly
the overview page can be built with core reuse, dash-local adapters, or
dash-local rewrites
theme first paint is stable
production deployment is straightforward
rollback is simple
```

If these conditions are not met, keep `main` and `dashboard` on their current
Next.js paths and treat the spike as research output rather than a migration
commitment.
