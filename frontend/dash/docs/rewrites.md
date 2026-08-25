# Dash Rewrite Records

## Theme First Paint Script

module
`frontend/core/lib/ssr/script.ts`

background
Dash must resolve the request theme before React hydration without depending
on Next.js insertion APIs.

conflict
A localStorage-only script cannot determine the server-rendered theme and can
flash the wrong palette before hydration. The Next implementation also uses
`useServerInsertedHTML`, which is not part of TanStack Start.

before
Dash read `localStorage.theme` in an inline script and initialized Theme
Valtio later with its defaults.

after
The root loader reads `themeMode` and `resolvedTheme` cookies through
`frontend/dash/src/server/theme.ts`. SSR writes `html[data-theme]` and
initializes Theme Valtio from the same seed. The inline script only resolves
`system` mode with `matchMedia` before hydration and refreshes the resolved
cookie.

comparison
Kept: root `data-theme`, `color-scheme`, `matchMedia` for system mode, and
`window.__GROUPHER_INITIAL_NOW__`.
Dropped: localStorage as the Dash SSR source and Next insertion APIs.
Changed: the server cookie seed and Valtio initialization now agree.

extraction path
Keep request-cookie access in Dash. Shared browser persistence and theme
runtime helpers remain in Core.

validation
Unit tests cover cookie seed resolution and pre-paint `system` resolution.
Dash type-check and production build verify the full root route integration.

## Global Tailwind Entrypoint

module
`frontend/core/tailwind/global.css`

background
Core global CSS is the shared styling entrypoint for the existing Next.js apps.
It wires Tailwind config, sources, plugins, and common utilities for that build
pipeline.

conflict
The file contains Tailwind-specific at-rules such as `@config`, `@source`, and
`@plugin`. The initial TanStack Start/Vite build reaches Lightning CSS before
an equivalent Tailwind pipeline is configured for `frontend/dash`, so importing
the core file directly fails minification.

before
Next apps import the shared core Tailwind entrypoint and rely on their existing
framework/build setup to process those directives.

after
Dash configures the Vite Tailwind plugin and imports the shared entrypoint
directly from `frontend/core/tailwind/global.css`. Dash owns
`frontend/dash/public`; shared icon and wallpaper generators sync equivalent
generated assets into both app-local public directories.

comparison
Kept: the full shared utility layer, plugins, tokens, wallpaper assets, and
icon assets used by Dashboard.
Dropped: none for the migrated routes.
Changed: the consumer is Vite plus `@tailwindcss/vite`, rather than Next.

extraction path
Keep the shared entrypoint while the build contracts remain compatible. Split
framework-neutral token/reset CSS only if the two build systems later need
materially different Tailwind configuration.

validation
`yarn workspace @groupher/frontend-dash build` compiles the shared entrypoint.
Browser verification of `/home/dash/overview` confirms the same wallpaper and
Lucide static assets load through the local gateway.

## Remaining Next Runtime Compatibility Shims

module
`frontend/dash/src/platform/Script.tsx` owns Dash's native script lifecycle;
there is no remaining `frontend/dash/src/adapters/next/*` module.

background
Dashboard UI is intentionally shared from `frontend/core`. Next-only cache
calls remain in Next application server modules, while shared client scripts
use the platform Script capability.

conflict
TanStack Start runs on Vite and cannot resolve the Next runtime packages or
their lifecycle semantics. Cache ownership must move to each application's
server layer; scripts must move to each application's document/runtime
lifecycle.

platform
Shared Link, Image, pathname, search-param, and client router behavior comes
directly from `PlatformProvider`. Main, Dashboard, and Landing provide Next
implementations; Dash provides TanStack navigation plus a native image
renderer. Server-only hooks and app-owned APIs remain outside the platform
contract.

before
Dash aliased Link, Image, Navigation, Dynamic, Script, and Cache imports to
local compatibility modules.

after
Link, Image, Navigation, Dynamic, Cache, and Script no longer use Dash
compatibility adapters. The first three resolve through `PlatformProvider`;
Dynamic resolves through `React.lazy`, `Suspense`, and explicit client-only
boundaries; Dash scripts resolve through `PlatformProvider`.

comparison
Kept: shared Dashboard components, Next Image optimization in Next apps,
native image loading in Dash, and stable logical links.
Dropped: fake client navigation/image/dynamic compatibility behavior.
Changed: client runtime ownership is explicit through PlatformProvider and
React lifecycle primitives.

extraction path
Keep `next/cache` in Next-only SSR modules outside the Dash dependency graph
and keep shared parsing in `frontend/core/lib/ssr/parse.ts`. Platform Script
maps Next's lifecycle-aware implementation to Dash's native lifecycle.

validation
Browser navigation from Dash Info to Appearance preserves `/home/dash/*` and
completes with no console error. Core, Dash, Main, Dashboard, and Landing
type-check against the shared platform contract; Main, Dash, and Landing
production builds complete.

## SSR Account Store Initialization - OBSOLETE

> Status: obsolete as of the Native Route Rewrite. The viewer (`P.me`) is no
> longer loaded during SSR; it stays client-side through the GraphQL provider,
> matching the current Next.js Dashboard behavior. `MainProvider` no longer
> receives an `account` init slice and `loadCommunity` replaces the previous
> `loadDashboardShell` shell loader.

module
`frontend/core/stores/account/{index,provider,spec}.ts`

background
Dashboard widgets read the shared Valtio account store for the current user,
moderation state, and loading state. A Dash SSR response already has this
data after its authenticated GraphQL request.

conflict
The previous provider could construct only the default client-loading store.
Dash would therefore render a personalized page with a client store that said
the account was still loading, then require a duplicate client fetch.

before
`AccountStore()` always started with `user: null` and `loading: true`.

after
`AccountStore(init)` and its provider accept a typed optional initial account
slice. Dash's parent route loader forwards the SSR `P.me` response into
`MainProvider`, which creates one Valtio store per rendered tree with
`loading: false`.

comparison
Kept: the existing account store shape, actions, and default Next behavior.
Dropped: no Dashboard behavior.
Changed: server-derived state is now an explicit provider input instead of a
Dash-only workaround.

extraction path
Keep the account data DTO and store factory in core. Each app remains
responsible for obtaining its request-scoped viewer payload.

validation
The account-store unit test covers a preloaded viewer. SSR HTML for Dash
Overview contains the authenticated community payload and browser hydration
renders the same overview without a client account-loading gap.

## Direct SSR GraphQL Loaders

module
`frontend/dash/src/server/dashboard-shell.ts`

background
Every Dash page needs a viewer-scoped community shell before the UI is useful:
account, community, permission-derived dashboard state, theme, wallpaper, and
locale.

conflict
Existing Dashboard server pages use Next request helpers and route params.
Using their page modules directly would make Dash SSR depend on the Next App
Router.

before
Dashboard Next pages read request state in the App Router and fetch their
GraphQL requirements through Next-bound server helpers.

after
Dash TanStack server functions read the auth cookie from the request, forward
it to the existing GraphQL endpoint, load `P.community` plus `P.me`, and pass
the parsed data to the shared providers. Trend and Docs Editor have dedicated
server functions for their additional SSR data.

comparison
Kept: the GraphQL schema, auth cookie contract, Dashboard parsers, shared UI,
wallpaper, theme tokens, and private viewer/community payload.
Dropped: Next request helpers and page-level RSC boundaries.
Changed: loader payloads are TanStack Start serialized route data and all Dash
responses set `Cache-Control: private, no-store`.

extraction path
Extract a framework-neutral, request-scoped GraphQL transport only after a
second server consumer needs it. Do not move Dash route policy into core.

validation
`curl` of `/home/dash/overview` returns personalized SSR HTML and the private
cache header. Browser verification confirms the server-rendered wallpaper,
overview values, and hydrated Dashboard shell.

## Canonical Dash Paths, Vite Assets, And HMR

module
`infra/gateway/src/routing.ts` and `frontend/dash/app.config.ts`

background
Local development uses one canonical gateway origin so the session cookie,
Dashboard public paths, and browser navigation behave like production.

conflict
The first implementation trimmed `/dash` before forwarding to Dash. TanStack
Router then rendered `/home/overview` on the server while the browser hydrated
`/home/dash/overview`. Vite's dependency, shared static asset, and websocket
paths also had no Dash-specific gateway ownership.

before
The gateway trimmed `/dashboard` before forwarding and both Next applications
shared unprefixed development chunks/HMR on the canonical host. Nested
Dashboard routes could therefore 404 and HMR ownership was ambiguous.

after
Dash owns the public canonical route itself: `/:community/dash/*`, while
Dashboard keeps `/:community/dashboard/*` unchanged. The gateway preserves
both route families. Dash uses `__dash_hmr`; Dashboard uses the stable
`/dashboard/_next/*` asset/HMR namespace. Static files remain app-local.

comparison
Kept: `/home/dashboard/*` remains entirely on the existing Dashboard app;
`/home/dash/*` is a separately routable, rollback-safe application.
Dropped: the incorrect namespace trimming assumption for TanStack Start.
Changed: Dash's internal route shape deliberately includes `/dash`.

extraction path
If another Vite sub-app is added, make a small gateway resource-ownership
registry instead of extending conditional path checks ad hoc.

validation
Gateway routing and websocket tests pass. Browser navigation loads Dash icons
and wallpaper through `https://groupher.localhost` without static-resource or
hydration errors.

## CommonJS Copy Control Adapter

module
`frontend/dash/src/adapters/react-copy-to-clipboard.tsx`

background
A shared Dashboard widget uses the legacy `react-copy-to-clipboard` render
prop-style wrapper.

conflict
The package's CommonJS runtime calls `require`, which is unavailable in Dash
Vite SSR output.

before
Next's bundler tolerates the package in the current Dashboard runtime.

after
Dash aliases the small used API surface to a native Clipboard API wrapper.

comparison
Kept: wrapping a clickable child and invoking its original click handler.
Dropped: legacy clipboard fallbacks that Dash does not otherwise need.
Changed: copy execution is `navigator.clipboard.writeText`.

extraction path
Replace the dependency in core only when all applications can use a common
explicit copy-control component.

validation
Dash production build completes its SSR bundle without a CommonJS `require`
runtime error.
