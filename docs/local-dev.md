# Groupher 本地开发

> 状态：当前本地开发说明

## 运行时边界

生产环境和本地开发现在为同一公共路由契约使用不同的 gateway 运行时。

```text
production
  groupher.com / www.groupher.com
    -> Cloudflare Pages project `groupher-landing`
       -> frontend/landing/public/_worker.js
          -> Landing assets on Cloudflare
          -> Main on Vercel
          -> Dashboard on Vercel
          -> Auth on Cloudflare Workers
          -> Phoenix on api.groupher.com

local development
  https://groupher.localhost
    -> backend/gateway on port 3003
       -> Landing on port 3002
       -> Main on port 3000
       -> Dashboard on port 3001
       -> Auth on port 3004
       -> Phoenix on port 4001
```

`backend/gateway` 是 Dev Gateway。它保留用于本地路由和 Dev Hub 的易用性。在 Cloudflare Pages 切换之后，它不再是生产环境中 `groupher.com` 的运行时。

## 为什么在本地保留 Dev Gateway

本地 Dev Gateway 让日常开发更简单：

- 它兼容 Dev Hub 现有的启动链。
- 它使用稳定的 Portless 名称，例如 `https://groupher.localhost`。
- 它将本地 cookie 作用域保持在 `.groupher.localhost` 下。
- 对于每次 Main 或 Dashboard 变更，它避免了强制要求 Wrangler、Pages assets 和 Cloudflare 本地运行时。

生产环境的 Cloudflare 路由器和本地 Dev Gateway 应当在路由契约层面保持一致，但在正常本地开发中，它们不需要共享同一个运行时。

## 日常本地流程

使用 Dev Hub 或现有的 Makefile 命令。

```bash
make dev
```

或者启动单个服务：

```bash
make be.gateway.start
make fe.dev.main
make fe.dev.dashboard
make fe.dev.landing
make be.auth.start
```

Dev Hub 将本地入口建模为 `Dev Gateway`，但稳定的 service id、workspace name、directory 和 Makefile targets 保持不变：

```text
service id:    gateway
workspace:     @groupher/gateway
directory:     backend/gateway
entry command: make be.gateway.start
```

在有意进行 package 或目录重命名之前，保持这些项稳定。

## Portless 名称

当本地机器需要 HTTPS 开发域名时，运行 Portless 设置：

```bash
yarn portless:setup
```

当前别名：

```text
groupher.localhost             -> Dev Gateway, port 3003
main.groupher.localhost        -> Dev Gateway, port 3003
dashboard.groupher.localhost   -> Dev Gateway, port 3003
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
/                       -> Landing
/pricing                -> Landing
/book-demo              -> Landing
/:community/dashboard/* -> Dashboard
other product paths     -> Main
```

对于浏览器 GraphQL，Dev Gateway 保持与生产路由器相同的安全边界：浏览器请求使用同源 `/api/graphql`，并且只将 HttpOnly 的 `groupher-auth.token` 转发给 Phoenix。

## Cloudflare 本地路由模式

Cloudflare Pages `_worker.js` 不会在默认的 Dev Hub 流程中运行。它会在生产环境、Pages 预览以及 Wrangler Pages dev 中运行。

只有在验证生产路由器一致性时才使用 Cloudflare 本地路由：

```bash
yarn workspace @groupher/frontend-landing build:cloudflare

MAIN_SITE=http://127.0.0.1:3000 \
DASHBOARD_SITE=http://127.0.0.1:3001 \
AUTH_SITE=http://127.0.0.1:3004 \
API_SITE=http://127.0.0.1:4001 \
ENVIRONMENT=development \
./node_modules/.bin/wrangler pages dev frontend/landing/out --port 8788
```

然后进行冒烟测试：

```bash
curl -i http://127.0.0.1:8788/health
curl -i http://127.0.0.1:8788/pricing
curl -i http://127.0.0.1:8788/home/dashboard
curl -i http://127.0.0.1:8788/api/auth/providers
curl -i http://127.0.0.1:8788/api/graphql
```

这个模式目前还不能替代日常的 Dev Hub 入口。完整替代还需要对 HTTPS、本地 cookie 域、Portless 别名以及 Wrangler Pages asset 行为进行显式处理。

## 分析服务

`analysis.groupher.com` 是一个部署在 Vercel 上的 Umami 实例，可以保持为 DNS only：

```text
analysis.groupher.com -> Vercel
Proxy status: DNS only
```

除非 Groupher 之后需要 Cloudflare WAF、Access、Bot Management，或者该服务的 zone-level HTTP rules，否则它不需要经过 Cloudflare 代理。
