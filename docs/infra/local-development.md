# Groupher 本地开发

> 状态：当前本地开发说明

## 运行时边界

生产环境和本地开发对齐产品 URL 边界，但使用不同的 runtime adapter。

```text
production
  groupher.com / www.groupher.com
    -> Cloudflare Worker `edge-router`
       -> Landing Worker Static Assets (Service Binding)
       -> Community Worker (Service Binding)
       -> Auth Worker (Service Binding)
       -> Phoenix / Press (HTTPS)

local development
  https://groupher.localhost
    -> infra/dev-gateway on port 3003
       -> Landing on port 3002
       -> Dash on port 3005
       -> Apply on port 3006
       -> Community on port 3007
       -> Auth on port 3004
       -> Phoenix on port 4001
```

`infra/dev-gateway` 是 Dev Gateway。它保留用于本地路由和 Dev Hub 的易用性，但不是生产环境中
`groupher.com` 的运行时。

## 为什么在本地保留 Dev Gateway

本地 Dev Gateway 让日常开发更简单：

- 它兼容 Dev Hub 现有的启动链。
- 它使用稳定的 Portless 名称，例如 `https://groupher.localhost`。
- 它将本地 cookie 作用域保持在 `.groupher.localhost` 下。
- 对于每次 Community 或其他子应用变更，它避免强制要求 Wrangler 与 Cloudflare 本地运行时。

生产环境的 Cloudflare Router 和本地 Dev Gateway 应共享纯生产路由契约，但不需要共享同一个
runtime。Dev Gateway 还可以保留 HMR、开发资产和 referer 分流等本地专用能力。

## 日常本地流程

使用 Dev Hub 或现有的 Makefile 命令。

```bash
make dev
```

或者启动单个服务：

```bash
make be.dev-gateway.start
make fe.dev.dash
make fe.dev.apply
make fe.dev.landing
make be.auth.start
```

Dev Hub 将本地入口统一建模为 `Dev Gateway`：

```text
service id:    dev-gateway
workspace:     @groupher/dev-gateway
directory:     infra/dev-gateway
entry command: make be.dev-gateway.start
```

在有意进行 package 或目录重命名之前，保持这些项稳定。

## Portless 名称

当本地机器需要 HTTPS 开发域名时，运行 Portless 设置：

```bash
pnpm run portless:setup
```

当前别名：

```text
groupher.localhost             -> Dev Gateway, port 3003
dash.groupher.localhost        -> Dash, port 3005
apply.groupher.localhost       -> Apply, port 3006
community.groupher.localhost   -> Community, port 3007
landing.groupher.localhost     -> Dev Gateway, port 3003
auth.groupher.localhost        -> Auth, port 3004
api.groupher.localhost         -> Phoenix, port 4001
assets-hub.groupher.localhost  -> Assets Hub, port 8002
assets.groupher.localhost      -> Assets read Worker, port 8787
```

前端产品流程通常应通过 `https://groupher.localhost` 进入，而不是直接通过每个前端监听器。直接的子应用 URL 适合隔离调试。

## Dev Gateway 路由

Dev Gateway 接收浏览器请求，并按 host/path 路由：

```text
/api/auth/*             -> Auth
/api/graphql            -> Phoenix /graphiql with browser cookie cleanup
/api/utils/slugify      -> Community
/                       -> Landing
/pricing                -> Landing
/book-demo              -> Landing
/:community/*           -> Community（共享生产契约）
/:community/dashboard/* -> 404
/:community/dash/*      -> 404
/apply, /apply/*        -> 404

dash.groupher.localhost/*      -> Dash
apply.groupher.localhost/*     -> Apply
```

Dash 和 Apply 是独立产品入口，不通过 `groupher.localhost/:community/...` 路由。
Dev Gateway 不包含旧产品 fallback 或 `/apply` 兼容产品路由，只保留真正的 dev-only 规则。

对于浏览器 GraphQL，Dev Gateway 保持与生产路由器相同的安全边界：浏览器请求使用同源 `/api/graphql`，并且只将 HttpOnly 的 `groupher-auth.token` 转发给 Phoenix。

Landing 的旧入口路由实现已清理。需要验证生产形态时，使用当前 `landing` Worker Static
Assets 和 `edge-router` 的 dry-run/development 流程；现有 Dev Gateway 仍覆盖开发路由和 HMR。

然后进行冒烟测试：

```bash
curl -i http://127.0.0.1:8788/health
curl -i http://127.0.0.1:8788/pricing
curl -i http://127.0.0.1:8788/home
curl -i http://127.0.0.1:8788/api/auth/providers
curl -i http://127.0.0.1:8788/api/graphql
```

## Edge Router 本地一致性模式

独立 `edge-router` 已落地。生产一致性 smoke 应使用 Wrangler 的多 Worker 本地开发和
Service Bindings 同时启动 Router、Landing、Community、Auth 等目标；日常产品开发仍使用
Dev Gateway，避免强制所有下游都运行在 Wrangler 中。

Community 的 Wrangler 入口由 TanStack Start build 生成，不能直接对源码配置运行：

```bash
pnpm --filter @groupher/frontend-community run build
cd frontend/community
pnpm exec wrangler dev --config dist/server/wrangler.json --port 8790
```

随后分别启动 Landing Worker、Auth Worker 和 Edge Router；当四个 Worker 使用各自的
Wrangler 配置运行时，Edge Router 的 Service Bindings 会显示为 `local [connected]`。
本地 smoke 入口固定为 `http://127.0.0.1:8787`，至少验证 `/health`、`/pricing`、`/home`、
`/api/auth/providers` 和 `/api/graphql`。

该模式用于验证 route contract、Service Binding、header/cookie/redirect 和自定义 host
语义；日常开发仍可使用 Dev Hub + Dev Gateway。长期结构是：

```text
@groupher/route-contract
  |-- edge-router: production adapter and local parity smoke
  `-- infra/dev-gateway: local adapter, Portless, dev assets and HMR
```

该 workspace package 只包含 hostname/path 分类和内部 pathname transform，不依赖 Node、Hono
或 Cloudflare runtime；Dev Gateway 与 edge-router 各自实现运行时 adapter。

Dev Gateway 的 `/@fs/*`、`/@id/*`、`/@vite/*`、`/__dash_hmr`、`/__apply_hmr`、开发专用
`_serverFn` 和 HMR WebSocket 规则不进入生产 Router。

## 分析服务

`analysis.groupher.com` 是一个部署在 Fly.io 上的 Umami 实例；本地开发仍使用稳定的公开源站：

```text
analysis.groupher.com -> Fly.io
```

Umami 的前端脚本和 Phoenix provider 都固定使用这个域名，不应改用 Fly 的 `*.fly.dev` 诊断域名。
