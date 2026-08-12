# Dashboard TanStack V2 实现评审

> 评审日期：2026-08-08
>
> 范围：`frontend/dash`、`frontend/dashboard`、`frontend/core` 中共享的 Dashboard
> 界面，以及暴露两个应用的本地 Gateway 路由。

## 发布结论

原生 TanStack 迁移、PlatformProvider 客户端边界、应用隔离、SSR/provider 生命周期、
主题/时间 hydration、pending/error shell、静态资源和本地双应用路由均已实现并验证。

V2 整体目前还不能标记为完成。Phase 3 仍被一个后端领域前置条件阻塞：canonical
Community payload 没有暴露一个覆盖 profile、Dashboard、theme、wallpaper、navigation、
aliases、threads、tags、SEO 及相关配置表的单调递增版本。没有这个合同，
`syncFromServer`、focus version probe 和幂等的跨云 Main revalidation request 无法实现
V2 规定的顺序保证。

## 已验证的实现

- `frontend/dash/src/adapters` has no runtime files or aliases.
- Dash and Dashboard are separate workspace applications and have no static
  imports of each other.
- Shared client navigation, Link, Image, Script, pathname, search parameters,
  and router operations resolve through `PlatformProvider`.
- Next-only cache, headers, proxy, and server-insertion modules remain in
  Next-owned server import graphs; the Dash bundle consumes the pure SSR parser.
- Both public route families remain intact:
  `/:community/dashboard/*` and `/:community/dash/*`.
- Gateway forwarding preserves both canonical pathnames. Dashboard development
  assets/HMR use `/dashboard/_next/*`; Dash Vite HMR uses `__dash_hmr`.
- Dash owns its own public directory and generated icon, wallpaper, and revision
  worker outputs. It does not read `frontend/dashboard/public`.
- Community and Dashboard providers are request/route scoped. Leaf article list
  providers are initialized from loader data without render-time commits.
- Parent Community/Dashboard shell remains mounted during Dash leaf navigation.
- Route errors render inside the stable shell and no longer turn operational
  GraphQL errors into empty data.
- Anonymous Doc Editor requests render an explicit sign-in-required state
  instead of an HTTP 500. Public Community information remains anonymous, per
  product policy; authenticated editor data still forwards the canonical
  `groupher-auth.token` cookie.
- Clipboard is a framework-neutral browser hook and no longer imports the
  CommonJS `react-use` clipboard hook during Vite SSR.
- Theme and TimeAgo use the same request seed for SSR and first hydration.
- Shared aliases come from `frontend/tsconfig.paths.json`; application-local
  aliases remain local.
- GitHub Actions treats Dash as a first-class application: production build,
  type-check, Oxlint, Oxfmt, React Doctor, and a dedicated Playwright overview
  smoke test run for Dash changes; shared Core changes also select Dash.

## Local acceptance evidence

Validated through the local Gateway and real browser:

```text
http://groupher.localhost:3003/home/dash
  -> redirects to /home/dash/overview

http://groupher.localhost:3003/home/dash/post/content
http://groupher.localhost:3003/home/dash/appearance/theme
http://groupher.localhost:3003/home/dash/trend
  -> native TanStack routes render real local GraphQL data

http://groupher.localhost:3003/home/dash/doc/editor
  -> anonymous session renders Sign in required inside the stable shell

http://groupher.localhost:3003/home/dashboard/post/content
http://groupher.localhost:3003/home/dashboard/doc/editor
  -> existing Next Dashboard routes render through the Gateway
```

The Post list, Appearance, Trend, nested navigation, redirects, shell
persistence, error boundary, static icons/wallpapers, and Dashboard CMS provider
were exercised. The external mock image
`https://assets.groupher.com/communities/groupher-alpha.png` may be unavailable
on a local network; it is fixture/environment data, not an application import
or routing dependency.

The repository Playwright suite also has an isolated TanStack Dash target. It
starts mock GraphQL plus the Dash Vite server and asserts that
`/home/dash/overview` renders the shared Dashboard overview title. This prevents
the CI matrix from appearing green while silently omitting the new application.

## Explicit blockers and follow-up contract

### 1. Aggregate Community version

Backend must own and advance one monotonic version for every configuration
mutation in V2 scope. A Community row timestamp alone is insufficient because
many settings are stored in related Dashboard, theme, wallpaper, tag, thread,
alias, and SEO resources.

After that field exists:

1. Add `version` to the canonical Community GraphQL fragment and `TCommunity`.
2. Implement version-aware `community$.syncFromServer()`.
3. Add `reloadDsbCommunity()` in both apps.
4. In Dash, invalidate only the `$community` route match.
5. Add the no-store, single-flight, 60-second focus/visibility version probe.

### 2. Cross-cloud Main revalidation

The current `/api/revalidate/community` endpoint is a compatibility path using
the browser Phoenix cookie. It is not the V2 server-to-server contract.

After aggregate version and service credentials exist:

1. Add `POST /api/dsb/cache/revalidate` to Main.
2. Sign requests from the Dash server layer; do not call it from Core/browser
   mutation code.
3. Include community identity, aggregate version, and domain scopes.
4. Add timestamp/replay validation, idempotency, bounded retry, and structured
   operational logging.
5. Replace the compatibility browser call only after both applications use the
   canonical reload lifecycle.

### 3. Shared Auth refresh lifecycle

Dash does not define a second token lifecycle. The target refresh/session
consumer remains governed by `docs/auth/v1.md` and depends on its Auth endpoint
work. Until then, protected anonymous entry shows the canonical sign-in flow;
public Community loaders remain public and authenticated loaders forward the
existing cookie without locally decoding or extending it.

## Release gates

- Do not mark V2 Phase 3 complete until blockers 1 and 2 are implemented and
  mutation/focus concurrency tests pass.
- Do not remove the Next Dashboard route family as part of this migration.
- Do not add fake `next/*` aliases or app-to-app imports to solve shared UI
  issues; extend a framework-neutral Core contract or keep server behavior in
  the owning application.
