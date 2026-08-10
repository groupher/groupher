# Dash Route and Domain Migration

## Status

This document defines the target URL contract for the new TanStack Dash and the
legacy Next.js Dashboard. It is a migration design, not a statement that the
current route trees already implement the target.

The two applications will continue to coexist. The migration does not imply a
cutover from Dashboard to Dash or the removal of either application.

## Decision

The application is identified by the host. The path identifies the community
and the page inside that application.

| Application | Runtime        | Production origin                | Local origin                           |
| ----------- | -------------- | -------------------------------- | -------------------------------------- |
| Dash        | TanStack Start | `https://dash.groupher.com`      | `https://dash.groupher.localhost`      |
| Dashboard   | Next.js        | `https://dashboard.groupher.com` | `https://dashboard.groupher.localhost` |

The canonical route shape is:

```text
https://<application-host>/<community>/<section...>
```

Examples:

```text
https://dash.groupher.com/home/overview
https://dash.groupher.com/home/doc/editor

https://dashboard.groupher.com/home/overview
https://dashboard.groupher.com/home/doc/editor
```

`/dash` and `/dashboard` are not retained inside their respective canonical
paths. The host already expresses that application boundary, so repeating the
application name in the path is redundant.

## Current and Target Routes

```text
Current                                         Target
groupher.com/<community>/dash/<section...>      dash.groupher.com/<community>/<section...>
groupher.com/<community>/dashboard/<section...> dashboard.groupher.com/<community>/<section...>
```

The equivalent local targets are:

```text
dash.groupher.localhost/<community>/<section...>
dashboard.groupher.localhost/<community>/<section...>
```

Local development must preserve the same host and path semantics as production.
Ports and upstream addresses remain implementation details behind the local
gateway and must not become canonical browser URLs.

## Route Ownership

The target application-owned route trees are:

```text
frontend/dash       /$community/*
frontend/dashboard  /[community]/*
```

The browser URL, SSR request URL, router route ID, generated links, and form or
server-function return URLs must agree on this shape. The gateway must not make
an application appear to own a different path by silently trimming `/dash` or
`/dashboard` before proxying it. That creates two route identities and risks SSR
and hydration disagreement.

Each application host owns all of its application routes:

```text
dash.groupher.com/*       -> Dash upstream
dashboard.groupher.com/*  -> Dashboard upstream
```

Health checks may remain application-host endpoints such as `/health`, but they
are operational endpoints rather than user navigation routes.

## Legacy Redirects

The existing path-first URLs remain migration inputs, not canonical aliases.
They should issue permanent redirects while preserving the community, remaining
path, and query string:

```text
https://groupher.com/<community>/dash/<rest>?<query>
  -> 308 https://dash.groupher.com/<community>/<rest>?<query>

https://groupher.com/<community>/dashboard/<rest>?<query>
  -> 308 https://dashboard.groupher.com/<community>/<rest>?<query>
```

Redirects are preferred to transparent rewrites because they establish one
visible canonical URL and prevent the server and client routers from observing
different paths. Redirect behavior must define the empty-rest case explicitly;
for example, the application may redirect its community root to `overview`.

## Authentication and Cookies

The domain split must retain the Auth boundary:

- Auth owns its host-only browser Session on `auth.groupher.com`.
- The short-lived Phoenix access Cookie is shared at `Domain=.groupher.com`, so
  it is available to both application subdomains.
- Gateway, GraphQL, and SSR forwarding continue to forward only the approved
  access token contract.
- OAuth return URLs, login recovery, logout, refresh, CORS allowlists, and CSRF
  origin checks must recognize both canonical application origins.

The domain migration must not broaden the host-only Auth Session Cookie or move
authorization authority out of Phoenix.

## End-to-End Change Inventory

This is a canonical URL migration across two applications and two routing
layers. Changing only the Dev Hub links, DNS, or gateway path matching is not
sufficient.

### Dash: TanStack Start

Dash currently owns native routes under `/$community/dash/*`. The application
must instead own `/$community/*` directly.

The implementation includes:

- moving the file-based route hierarchy out of `$community/dash/`;
- changing every `createFileRoute`, typed `Link`, `navigate`, redirect, default
  route, breadcrumb, tab route, and deep-link helper that includes `/dash`;
- regenerating `frontend/dash/src/routeTree.gen.ts` from the new native tree;
- updating SSR request handling, Server Function URLs, auth recovery URLs, and
  tests to use the same browser-visible path; and
- changing local Vite HMR ownership from the shared `groupher.localhost` host to
  `dash.groupher.localhost`.

The gateway must not strip `/dash` and then send a different path to Dash. The
server request, TanStack route ID, hydration location, and browser URL must all
be `/<community>/<section...>`.

### Dashboard: Next.js

Dashboard currently owns its App Router hierarchy under
`src/app/[community]/dashboard/**`. It must instead own
`src/app/[community]/**` directly.

The implementation includes:

- moving the Next.js layouts, pages, loading/error boundaries, and route-local
  helpers out of the `dashboard` directory segment;
- updating generated navigation, SSR helpers, redirects, breadcrumbs, editor
  and import recovery URLs, and other deep links;
- verifying route-local APIs, parallel routes, cache behavior, and deployment
  output after the directory move; and
- updating Dashboard route and build tests to use the canonical host path.

Dashboard currently uses `assetPrefix: '/dashboard'` to namespace Next static
assets and HMR while it shares a gateway host with other applications. A
dedicated `dashboard.groupher.com` host no longer requires that namespace for
ownership. Removing the asset prefix is a follow-up candidate, but it should not
be coupled to the user-route migration unless the static asset and HMR change is
validated independently. The first migration phase may retain
`/dashboard/_next/*` as an implementation URL.

### Shared Frontend Navigation

Shared Core and application adapters must stop constructing legacy URLs through
string replacement. Every route producer must distinguish:

```text
application + community + application-local path
```

The affected surfaces include route constants, side menus, breadcrumbs, tabs,
platform navigation adapters, community administration entry buttons, Docs
Editor and Import recovery, Widgets popup/iframe/link URLs, and authentication
return paths.

Core should keep framework-neutral route intent. The Dash and Dashboard platform
adapters should generate their own canonical origin and path. New application
code must not generate either main-domain legacy route family.

### Node Gateway

The gateway already recognizes both application hosts and has separate Dash and
Dashboard upstream origins. Host routing remains the primary rule:

```text
Host: dash.groupher.com       -> Dash upstream, path preserved
Host: dashboard.groupher.com  -> Dashboard upstream, path preserved
```

The path-first rules on the main Groupher host must change semantics. They are
currently application proxy matches; after migration they become canonical
redirect matches:

```text
/<community>/dash/<rest>       -> 308 Dash canonical URL
/<community>/dashboard/<rest>  -> 308 Dashboard canonical URL
```

Gateway work therefore includes:

- separating host-owned proxy routing from legacy-path redirect routing;
- adding an explicit redirect result rather than disguising the redirect as an
  upstream proxy target;
- preserving query strings and defining the empty-rest/default-page behavior;
- updating Referer-based static asset and Server Function ownership;
- updating HTTP proxy, WebSocket/HMR, forwarded-host, and negative-match tests;
  and
- ensuring unrelated paths containing the words `dash` or `dashboard` do not
  become redirects.

### Cloudflare Main-Site Edge Router

Production `groupher.com` also has routing logic in the Landing Cloudflare
Worker. Its current Dash and Dashboard path matches proxy to their upstreams.
They must issue the same 308 redirects as the Node gateway.

The Node gateway and Cloudflare edge router are two implementations of the same
public route contract. Their redirect status, destination path, query handling,
empty-rest behavior, and negative matches must remain aligned so local and
production navigation do not diverge.

### Static Assets, HMR, Server Functions, and APIs

Dedicated application hosts must own their runtime resources as well as their
HTML routes:

- Dash Vite dependencies, public assets, TanStack Server Functions, and
  `__dash_hmr` belong to `dash.groupher.com` and its `.localhost` equivalent.
- Dashboard Next assets/HMR and Dashboard-owned APIs belong to
  `dashboard.groupher.com` and its `.localhost` equivalent.
- Referer-based routing is a compatibility aid for ambiguous development asset
  URLs, not the source of canonical application ownership.
- Dashboard-owned API paths such as content import and revalidation must be
  tested from the Dashboard origin after the route migration.

### Auth and Browser Origins

The Cookie topology already supports the application subdomains, but all exact
origin policy must be audited and tested:

- Auth approved origins and credentialed CORS;
- CSRF Origin validation;
- OAuth callback return-URL validation;
- Session probe, refresh, logout, and login recovery;
- CSP and browser API endpoint allowlists; and
- E2E/smoke-test environment variables.

Moving from one `groupher.com` browser origin to two application subdomains also
means the applications cannot rely on a shared-origin `BroadcastChannel` for
cross-tab state. The canonical Auth Session probe on focus, visibility, entry to
a protected route, or authentication failure remains the cross-origin recovery
mechanism.

### Dev Hub and Local Gateway

Dev Hub must open:

```text
Dash       https://dash.groupher.localhost/<community>/<section...>
Dashboard  https://dashboard.groupher.localhost/<community>/<section...>
```

Its direct health URLs may remain `https://<application>.groupher.localhost/health`.
The service definitions, browser metric origins, flow labels, service tests,
local gateway host rules, TLS coverage, and HMR tests must be updated together.
Direct ports are upstream implementation details and must not be shown as the
canonical application link.

## Deployment and DNS

The target production domains already exist in repository configuration. Dash
declares `dash.groupher.com` as a Cloudflare Worker custom domain, while the
gateway and edge routing configuration already use `dashboard.groupher.com` and
`dash.groupher.com` as separate upstream origins.

Live read-only verification on 2026-08-10 found:

```text
dash.groupher.com
  DNS resolves through Cloudflare
  GET /health -> 200, server: cloudflare

dashboard.groupher.com
  DNS resolves to the Vercel edge
  GET /health -> 200, server: Vercel
```

The migration therefore does not currently require creating either hostname,
moving Dashboard away from Vercel, or moving Dash away from Cloudflare. It does
require deploying changed application and routing behavior to the existing
origins:

- deploy the native Dash route tree to the existing Cloudflare Worker custom
  domain;
- deploy the native Dashboard route tree to the existing Vercel project/domain;
- deploy the legacy redirects to the `groupher.com` Cloudflare edge router;
- deploy matching behavior to the local/Node gateway; and
- re-verify DNS, certificates, custom-domain ownership, deployment environment
  variables, and real public URLs at rollout time.

DNS and platform bindings are external state. The repository configuration and
the dated verification above must not be treated as permanent proof that the
Cloudflare and Vercel account settings are unchanged.

## Migration Scope

Implementation must treat the following as one coordinated contract change:

1. Change the native Dash route tree from `/$community/dash/*` to
   `/$community/*`.
2. Change the native Dashboard route tree from `/[community]/dashboard/*` to
   `/[community]/*`.
3. Update application navigation, route constants, breadcrumbs, redirects, and
   deep links to generate the canonical subdomain URLs.
4. Update Gateway and edge routing so each application host owns its full path
   space, and add the two legacy 308 redirect families on `groupher.com`.
5. Update Vite/Next static assets, HMR, server functions, API routes, and request
   referer-based ownership without reintroducing hidden path trimming.
6. Update Auth return-URL validation, CORS/CSRF origins, browser-metric origins,
   Dev Hub links, environment variables, deployment domains, and documentation.
7. Keep Dash and Dashboard independently deployable and rollback-safe throughout
   the migration.

## Compatibility and Rollout

The migration should be delivered in an order that avoids a state where a
canonical host and its application disagree about the path:

```text
Phase 1: compatibility preparation
  Auth/CORS/return-URL support for both canonical origins
  application and infrastructure tests for both route families

Phase 2: canonical application routes
  deploy native Dash routes to dash.groupher.com
  deploy native Dashboard routes to dashboard.groupher.com
  verify SSR, hydration, assets, HMR, APIs, Auth, and deep links

Phase 3: producers and local tooling
  switch shared navigation and application-generated URLs
  switch Dev Hub links and browser-metric origins
  verify the equivalent .localhost routes

Phase 4: canonical redirects
  change groupher.com legacy paths from proxy to query-preserving 308
  deploy matching Node Gateway and Cloudflare edge behavior
  verify real production redirects and rollback independently if required
```

If compatibility routes are temporarily required inside an application, they
must redirect to the canonical path rather than render a second copy of the
page. Old bookmarks may remain supported through the gateway redirects, but new
code must not generate old main-domain Dashboard or Dash URLs.

## Acceptance Criteria

- `dash.groupher.com/<community>/*` renders only the TanStack Dash.
- `dashboard.groupher.com/<community>/*` renders only the Next.js Dashboard.
- The equivalent `.localhost` URLs behave the same way in local development.
- Neither canonical application URL contains `/dash` or `/dashboard` after the
  community segment.
- Both old `groupher.com/<community>/dash/*` and
  `groupher.com/<community>/dashboard/*` issue query-preserving 308 redirects to
  the corresponding application host.
- Direct navigation, SSR HTML, hydration, client navigation, refresh, static
  assets, HMR, server functions, authentication recovery, and logout work on
  both application hosts.
- The shared access Cookie is available on both application subdomains, while
  the Auth Session remains host-only on `auth.groupher.com`.
- Dev Hub opens the canonical `.localhost` application URL for each service.
- No new application code generates the legacy main-domain route families.
- Node Gateway and Cloudflare edge routing produce equivalent redirect results.
- Existing Cloudflare and Vercel custom-domain bindings and certificates are
  re-verified during deployment rather than assumed from repository config.

## Non-goals

- Removing the legacy Dashboard application.
- Making Dash and Dashboard share a runtime or deployment.
- Moving public community content away from `groupher.com/<community>/*`.
- Changing Phoenix authorization ownership or the Auth Session model.
- Preserving `/dash` or `/dashboard` as canonical path namespaces on the new
  application hosts.
