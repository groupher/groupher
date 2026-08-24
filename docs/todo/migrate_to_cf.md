# 将 Groupher 入口迁移到 Cloudflare

> 状态：提案
>
> 目标：将公共 `groupher.com` 入口和静态 Landing 交付迁移到
> Cloudflare，同时保留 Groupher 的 path-first URL 合约。

## 背景

Groupher 的公共产品模型是 path-first：

```text
groupher.com/                         Landing
groupher.com/pricing                  Landing
groupher.com/book-demo                Landing
groupher.com/:community/...           Main
groupher.com/:community/dashboard/... Dashboard
groupher.com/api/graphql              same-origin browser GraphQL facade
api.groupher.com/graphiql             Phoenix GraphQL origin
```

DNS 不能按 pathname 路由。无论哪个服务接收 `groupher.com`，它都必须
充当 Landing、Main、Dashboard、Auth 和 GraphQL 的 HTTP 路由器。

目前这个路由职责在 `backend/gateway` 中。当前 Gateway 是部署在 Vercel 上的
Hono/Node 反向代理。它将浏览器请求路由到这些源站：

```text
landing.groupher.com
main.groupher.com
dashboard.groupher.com
auth.groupher.com
api.groupher.com
```

Landing 是静态导出的 Next 应用，首屏不需要 API 或数据库访问。将其从
Cloudflare Pages 提供，比继续把每个 `groupher.com/` 请求都放在 Vercel Gateway
后面更合适。

推荐的 Cloudflare 目标起步时不是一个独立的 Worker 项目。对 Landing Pages
项目使用 Cloudflare Pages advanced `_worker.js` 模式：

```text
Cloudflare Pages project: landing
  static assets: exported Landing output
  _worker.js: public HTTP path router for paths that need routing
```

这样可以把 Landing 资产和公共入口放在同一个 Cloudflare 项目中，同时仍然允许
对非 Landing 路径进行可编程路由。

对这个目标来说，应把静态资源绕过作为验证门槛。在依赖 `_routes.json` 或
等效的 Pages 路由控制来做成本假设之前，先用最终 Pages 部署验证：带哈希的
Landing 资源是否绕过 router 路径，以及产品、API 和 Auth 请求是否仍然进入
`_worker.js`。

## 迁移原则

- 先迁移主机和路由；前端框架变更留到后面评估。
- 迁移期间，将 Cloudflare router 与现有的 Vercel/Hono Gateway 并行引入。
  不要在第一次切换时删除 `backend/gateway`。
- 保持 `gateway.groupher.com` 可用，作为回滚、对比目标和本地开发入口，直到
  Cloudflare 路由被证明可用。
- 保留同源浏览器 `/api/graphql` facade。不要在托管迁移期间重新设计 GraphQL
  CORS 或 cookie 行为。
- 在第一次 Cloudflare 切换中，保持 Main、Dashboard、Auth 和 Phoenix 继续使用
  现有源站。

## 目标拓扑

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

OAuth provider 回调配置跟随 Auth 源站，而不是公共 Landing 入口。对于生产环境的
GitHub OAuth，回调 allowlist 必须包含
`https://auth.groupher.com/api/auth/callback/github`；`groupher.com/api/auth/*`
仍然是一个面向浏览器的稳定入口，由 router 转发到 Auth。

`gateway.groupher.com` 可以在迁移期间保留，作为回滚或对比目标。一旦 Cloudflare
路径 router 通过生产烟雾测试，Vercel Gateway 就不再需要处在主
`groupher.com` 请求路径中。

## 平台限制与成本

Cloudflare Pages 的静态资源交付和 Pages Functions 有不同的成本与限制模型。

Pages 静态资源是便宜路径：

```text
static asset request
  -> Cloudflare Pages asset service
  -> no Pages Function invocation
```

Cloudflare 将 Pages 静态资源请求和带宽列为免费和付费 Pages 计划中的无限量。
Pages Functions 则不同：它们按 Workers 计费并受限。

当前需要考虑的公开 Cloudflare 限制/定价：

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

这个 router 是可行的，因为它不应该做 fan-out：

```text
Landing static asset hit -> 0 Function invocations when excluded by routes
Explicit Landing page    -> 1 Function invocation, usually 1 env.ASSETS.fetch
Main/Dashboard/Auth/API  -> 1 Function invocation, 1 origin fetch
```

在第一次切换中，不要在 `_worker.js` 里加入多源站 fan-out、上游探测、API 聚合或
auth 查询。这些会把一个路由层变成 edge BFF，使 subrequest/CPU/cost 行为更难
预测。

用于成本对比时，相关的 Vercel Pro 包含用量是：

```text
Vercel Pro:
  $20/user/month
  10M Edge Requests/month included
  1TB Fast Data Transfer/month included
  1M Vercel Function invocations/month included
  4h Function active CPU/month included
```

这意味着 Vercel Pro 其实已经能够承载中等规模的缓存/静态流量。Cloudflare 迁移
仍然有吸引力，因为 Landing 静态资源和带宽可以避开 Vercel Gateway 执行和
Vercel 传输压力，而产品路径可以逐步迁移。

## Function 调用路由

只有当静态资源尽可能绕过 Functions 时，Cloudflare 架构才依然有吸引力。

在标准 Pages Functions 模式下，Pages `_routes.json` 或等效的路由控制才是
真实边界。在 advanced `_worker.js` 模式中，worker 仍然必须自己把静态命中路由到
`env.ASSETS.fetch(request)`，并且生产验证必须确认 `_routes.json` 是否会被用于
绕过调用。

使用 route include/exclude 规则，让带哈希的静态资源不要调用 `_worker.js`：

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

精确的 include/exclude 模式必须根据最终的 Landing 导出结果进行验证。目标不是让
每个请求都经过 `_worker.js`；目标是只对那些需要 HTTP 层决策的路径进行路由。
Cloudflare `_routes.json` 模式是 glob，不是命名参数；`/:community/...` 应该保留为
Groupher 公共合约的说明，而不是字面配置模式。

## 路由合约

Cloudflare `_worker.js` 应保留当前的公共合约，但不要机械地照搬所有历史 Gateway
rewrite。

### Landing

以下内容应由 Cloudflare Pages 资源提供：

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

显式 Landing 路径的实现形态：

```ts
if (isLandingPath(url.pathname)) {
  return env.ASSETS.fetch(request)
}
```

不要使用全局的 “ASSETS 404 -> Main” 回退。显式 Landing 路径应返回 Landing 资源
或 Landing 404。产品路径应由它们自己的路径规则路由。

### Main

默认的、非 Landing 且非 Dashboard 的产品路径应进入 Main：

```text
/:community/...
```

向 Main 源站转发时，应保留公共路径。

### Dashboard

Dashboard 路由在实现前需要重新验证。

现有 Gateway 文档描述了这个历史行为：

```text
groupher.com/cps/dashboard/appearance
  -> dashboard origin /cps/appearance
```

不过当前 dashboard 应用源码里，确实存在位于以下位置的 App Router 路径：

```text
frontend/dashboard/src/app/[community]/dashboard/...
```

并且 `frontend/dashboard/next.config.js` 配置的是 `assetPrefix: '/dashboard'`，
而不是 `basePath: '/dashboard'`。

这表明 `/dashboard` 主要是统一主机的外部路径标记和静态资源标记，而不一定是
在直接代理到 Dashboard 源站时应删除的 segment。

在切换前，请用这两个路径验证真实的 Dashboard 源站：

```text
https://dashboard.groupher.com/cps/dashboard
https://dashboard.groupher.com/cps/dashboard/appearance
```

如果这些可用，Cloudflare 应当保持 Dashboard 路径不变地转发：

```text
groupher.com/:community/dashboard/*
  -> dashboard origin /:community/dashboard/*
```

只有在已部署的 Dashboard 源站仍然需要时，才保留旧的“trim dashboard segment”
行为。

Dashboard 静态资源必须继续路由到 Dashboard：

```text
/dashboard/_next/static/*
```

### Auth

将 Auth 继续作为源站服务：

```text
/api/auth/* -> https://auth.groupher.com/api/auth/*
```

router 应保留来自 Auth 的重定向，而不是在 proxy 内部跟随它们。OAuth 回调和
logout 流程需要浏览器看到上游的 `30x` 响应。

### GraphQL

Phoenix 真实的 GraphQL 端点是：

```text
https://api.groupher.com/graphiql
```

面向浏览器的端点应保持同源：

```text
https://groupher.com/api/graphql
```

Cloudflare 应替换当前 Gateway 行为：

```text
/api/graphql -> https://api.groupher.com/graphiql
```

保持请求凭据边界：

- 删除浏览器 `authorization`
- 删除原始 `cookie`
- 仅在存在时，将 `groupher-auth.token` 作为同名 cookie 转发

除非有意重新设计 CORS、credentials、cookie domain 和 CSRF 行为，否则不要让浏览器
代码直接切换到 `https://api.groupher.com/graphiql`。同源 facade 能保持前端改动
最小，并保留当前安全形态。

生产前端 env 应规范为：

```text
GRAPHQL_ENDPOINT=https://api.groupher.com/graphiql
```

浏览器代码始终调用同源的 `/api/graphql`。`GRAPHQL_ENDPOINT` 只用于服务器端的
Next/RSC/route handler 代码。

Landing 在 Cloudflare 静态路径中不应依赖浏览器 GraphQL。

## Proxy 策略

Cloudflare router 仍然需要基本的反向代理卫生措施。

保留：

- 保留请求方法
- 对非 GET/HEAD 请求转发 request body
- 使用手动 redirect 行为
- 移除或避免 hop-by-hop headers，例如 `connection`、`host`、
  `keep-alive`、`te`、`transfer-encoding` 和 `upgrade`
- 设置 `x-forwarded-host` 和 `x-forwarded-proto`
- 保持 GraphQL 的 cookie 清理策略

不要复制 Node 专用细节：

- `duplex: 'half'` 只适用于 Node fetch 请求体流式传输
- Node `fs` 静态文件读取应改为 `env.ASSETS.fetch(request)`
- Node `net`/`tls` WebSocket upgrade proxy 不能直接照搬

当前 Node Gateway 会从被代理的响应中删除 `content-encoding` 和
`content-length`，因为 Node fetch 可能会自动解码上游 body。Cloudflare Workers
可能不需要这个精确的 workaround。只有在烟雾测试显示浏览器解码或 body length
错误时，再添加它。

## 本地开发

引入 Pages advanced `_worker.js` 不一定要立即替代本地 Gateway 开发。

迁移期间，保留两种本地模式：

```text
default local app development
  -> existing Dev Hub / backend/gateway route chain

Cloudflare routing development
  -> wrangler Pages dev / Pages preview running Landing assets + _worker.js
```

这可以避免把日常的 Main/Dashboard/Auth/Phoenix 开发阻塞在 Wrangler、本地 HTTPS、
cookie domain 或 Portless 变更上。

当生产流量迁移到 Cloudflare 后，需要显式选择长期本地模型：

```text
Option A: keep backend/gateway as local-only router
  lower migration risk
  production and local routing logic can drift

Option B: use wrangler Pages dev as the local unified entry
  closer to production
  requires Dev Hub, local ports, HTTPS, and cookie domains to be aligned
```

推荐的路径是在切换期间采用 Option A，然后在 Cloudflare 生产行为稳定后再评估
Option B。

`backend/gateway` 应保留在仓库中，直到生产回滚需求和本地路由需求都得到解决。

## 未来的框架选项

`frontend/landing` 目前基于 Next.js，但它配置为静态导出：

```js
output: 'export'
assetPrefix: process.env.NODE_ENV === 'production' ? '/landing' : ''
cacheComponents: false
```

这与 Cloudflare Pages 的静态托管兼容。第一次迁移应继续让 Landing 保持 Next
export，避免把托管迁移和前端重写混在一起。

后续可能的选项：

| 选项                  | 适配性                                                      | 取舍                                              |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| Next export           | 改动最小。已经符合 Landing 的静态形态。                     | 对静态营销应用来说，继续保留 Next 构建/工具链。   |
| Vinext                | 如果目标是与 Cloudflare/Vite 对齐的 Next 兼容性，值得评估。 | 需要检查当前 Landing API 和构建产物的兼容性。     |
| TanStack Router/Start | 如果 Landing 变成 Vite-first 应用，这可能让它更轻量。       | 需要在路由、元数据、i18n 和应用约定上做更多重写。 |
| Astro/Vite static app | 对营销/文档类静态内容是很强的匹配。                         | 完整的框架迁移；第一次切换不需要。                |

框架迁移应被视为后续项目，等 Cloudflare 入口路由通过生产烟雾测试之后再做。

## 迁移步骤

### Phase 1: 为 Cloudflare Pages 准备 Landing

1. 使用 `yarn workspace @groupher/frontend-landing build:cloudflare` 作为
   Cloudflare Pages 的构建命令。
2. 确保 `frontend/landing` 在初始渲染时不依赖运行时 GraphQL。
3. 第一次切换时继续让 Landing 使用 Next export。不要在托管迁移期间把它重写为
   Vinext、TanStack、Astro 或其他框架。
4. 保持生产环境的 `assetPrefix: '/landing'`，除非 Pages 构建策略被有意重新设计。
5. 保持 Pages 输出目录为 `frontend/landing/out`。因为当前生产 Next 构建输出的 HTML
   引用了 `/landing/_next/static/...`，所以 `build:cloudflare` 在部署前必须先把
   `out/_next` 复制为 `out/landing/_next`。
6. 在 Landing 输出路径中添加 Pages advanced `_worker.js` 入口。
7. 先只实现这些响应：
   - `/health`
   - 通过 `env.ASSETS.fetch(request)` 提供显式 Landing 页面
   - `/api/graphql` 代理到 Phoenix，并清理 cookie
8. 添加 Function 路由 include/exclude 规则，让带哈希的静态资源尽可能避免
   Function 调用。

### Phase 2: 添加产品路径路由

1. 为默认社区路径添加显式的 Main 路由。
2. 在验证 Dashboard 源站是否需要保留或裁剪 `/dashboard` 之后，再添加 Dashboard
   路由。
3. 添加 `/api/auth/*` 到 Auth 的代理，并使用手动重定向。
4. 为 `/landing/_next/static/*` 和 `/dashboard/_next/static/*` 添加静态资源归属。
5. 保持 `gateway.groupher.com` 可用于对比。
6. 保持 `backend/gateway` 已部署且可用。这个阶段里 Cloudflare router 是增量添加的。
7. 确认每个动态请求最多只产生一次 origin fetch。这个阶段不要加入 fan-out 或
   origin probing。

### Phase 3: 绑定域名

1. 将 `groupher.com` 添加到 Cloudflare Pages Landing 项目的 Custom Domains。
2. 将 `www.groupher.com` 添加到同一个 Pages 项目，或者根据所需的 canonical host
   配置 Cloudflare 在 apex 与 `www` 之间跳转。
3. 在 Cloudflare 验证完成后，从 Vercel Gateway 项目中移除 `groupher.com` 和
   `www.groupher.com`。
4. 保持 `main.groupher.com`、`dashboard.groupher.com`、`auth.groupher.com`
   和 `api.groupher.com` 这些 origin 域名稳定。
5. 不要在域名绑定后删除 Vercel/Hono Gateway 代码。将其保留用于回滚和本地路由，
   直到另行决定退役。

### Phase 4: 验证并退役 Vercel Gateway

对 Cloudflare 入口运行烟雾测试：

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

验证：

- Landing 从 Cloudflare 资源加载
- 被哈希的 Landing 静态资源在被路由规则排除时不会调用 Pages Functions
- Main 的 RSC/page 响应正确加载
- Dashboard 路由和 chunk 正确加载
- Auth 重定向对浏览器可见
- 浏览器代码中的 `/api/graphql` 在不修改 CORS 的情况下可用
- 发往 Phoenix 的 cookie 只限于 `groupher-auth.token`
- 浏览器中没有出现内容解码错误
- 直接访问 `gateway.groupher.com` 与 Cloudflare 路由的 `groupher.com`
  在 TTFB 和行为上都足够接近
- Pages Functions 调用量符合预期：
  - 静态资源应接近零次调用
  - 产品/API/auth 路径应是每个浏览器请求一次调用
- Cloudflare Workers 的 CPU 和 subrequest 指标稳定低于限制

通过后，将 Vercel Gateway 从生产 `groupher.com` 请求路径中移除。保留代码，直到
回滚信心足够，再决定是否删除或归档 `backend/gateway`。

## 开放问题

- 已部署的 Dashboard 源站当前是否需要保留或裁剪 `/dashboard`？
- Pages 切换后，canonical host 应该是 apex `groupher.com` 还是 `www.groupher.com`？
- Auth 是否依赖需要 Cloudflare 特定环境更新的 host-specific 回调 URL？
- `api.groupher.com` 应该继续 DNS-only 指向 Phoenix，还是未来应作为单独的 API edge
  项目放到 Cloudflare WAF/Worker 后面？
- Landing 静态资源、产品页面请求、API 请求和 auth 请求之间的月请求量与带宽拆分的
  实测数据是多少？
- 未来是否有实时功能需要通过公共入口进行 WebSocket upgrade？当前前端源码没有
  显示业务 WebSocket 使用，但这仍应保留为发布检查项。

## 建议

这个迁移值得做。

首个生产目标应是：

```text
groupher.com -> Cloudflare Pages Landing advanced _worker.js
```

这样可以让静态 Landing 路径走最短路径，同时保留 path-first 的产品模型和同源
`/api/graphql` 合约。它也允许 Vercel Gateway 脱离主生产路径，而不强迫 Main、
Dashboard、Auth 或 Phoenix 同时迁移。
