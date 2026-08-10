# Groupher 部署

> 状态：当前部署说明

## 公共入口

Groupher 保持 path-first 的公共 URL 契约：

```text
groupher.com/                         Landing
groupher.com/pricing                  Landing
groupher.com/book-demo                Landing
groupher.com/:community/...           Main / Press（按路径分流）
groupher.com/:community/dashboard/... Dashboard
groupher.com/:community/dash/...      Dash
groupher.com/api/graphql              同源浏览器 GraphQL facade
api.groupher.com/graphiql             Phoenix GraphQL origin
press.groupher.com                    Press 服务 origin
```

`.md`、Feed、`llms.txt` 和 community sitemap 仍使用
`groupher.com/:community/...` 这一公共 URL。`press.groupher.com` 只作为 Cloudflare Pages
Worker 和 Phoenix 调用 Press 的稳定 origin，不建立第二套 canonical 内容地址。

当前公共入口由 Cloudflare Pages 项目 `groupher-landing` 托管。

```text
Cloudflare Pages project: groupher-landing
  production custom domains:
    groupher.com
    www.groupher.com
  internal/default domain:
    groupher-landing.pages.dev
  preview/debug domains:
    <deployment>.groupher-landing.pages.dev
    <branch>.groupher-landing.pages.dev
```

`groupher-landing.pages.dev` 是 Cloudflare Pages 自带的项目域名。它保留用于
preview、部署冒烟测试和自定义域名调试，不是面向用户生产 URL。

## Cloudflare 应用

```text
Cloudflare Pages
  groupher-landing
    prod:
      groupher.com
      www.groupher.com

Cloudflare Workers
  groupher-dash
    prod route:
      dash.groupher.com/*
  auth
    prod route:
      auth.groupher.com/*
  assets-hub
    prod route:
      assets.groupher.com/*
  inspire-me
    prod route:
      inspire-me.groupher.com/*
```

Cloudflare 项目使用产品级命名。`groupher-` 前缀虽然 Cloudflare 不强制要求，但
在共享 Cloudflare 账号里能让 `landing` 这类通用名保持清晰。

## Fly.io 应用

```text
Fly.io
  groupher-api
    public origin: api.groupher.com

  groupher-press
    public service origin: press.groupher.com
    package: @groupher/press
    source: backend/press
    primary region: sin
```

Press v1 使用 Docker 部署到 Fly.io。该选择不是 Cloudflare/Vercel 的容器能力限制，而是
当前 Press 已按常驻 Node/Hono 服务实现，并使用 PostgreSQL TCP、进程内 L1 cache、异步
metrics 和 retention timer。Fly 可以原样承载该模型，也与 Phoenix 的部署区域和运维方式
一致；v1 不先为平台迁移改写进程生命周期。

代码、基础设施和域名使用不同命名空间：

| 层级                  | 名称                     |
| --------------------- | ------------------------ |
| 产品                  | `Press`                  |
| Workspace package     | `@groupher/press`        |
| 代码目录              | `backend/press`          |
| Dev Hub service id    | `press`                  |
| Fly app id            | `groupher-press`         |
| Production origin     | `press.groupher.com`     |
| Fly diagnostic origin | `groupher-press.fly.dev` |

`groupher-press.fly.dev` 只用于平台诊断，正式配置统一使用 `press.groupher.com`。

## 环境边界

```text
production
  groupher.com
  www.groupher.com
  api.groupher.com
  press.groupher.com

preview/debug
  groupher-landing.pages.dev
  <deployment>.groupher-landing.pages.dev
  <branch>.groupher-landing.pages.dev

local development
  Dev Hub / local Gateway / portless routes
```

不要把 `*.pages.dev` 当作用户生产 URL。如果之后需要公开的 staging 环境，应
显式添加一个 `staging.groupher.com` 或 `dev.groupher.com` 这样的自定义域名，
并绑定到对应的 Pages 分支。

## DNS 记录

对于 Landing Pages 项目，apex 和 `www` 都应指向该 Pages 项目：

```text
groupher.com      CNAME  groupher-landing.pages.dev
www.groupher.com  CNAME  groupher-landing.pages.dev
```

Press custom domain 应绑定到 Fly app `groupher-press`：

```text
press.groupher.com  CNAME  groupher-press.fly.dev
```

实际 DNS target 和证书验证记录以 Fly 为 `press.groupher.com` 生成的 domain instructions
为准；证书和 `https://press.groupher.com/health` 未验证前，不能认为服务域名已经切换成功。

Cloudflare 会把 apex CNAME flatten 掉，因此在 Cloudflare DNS 中给 `groupher.com`
使用 CNAME 是合法的。

推荐这些生产自定义域名使用 orange-cloud 代理。orange cloud 表示该主机名会经
Cloudflare 的 HTTP 代理层路由，Cloudflare 可以在此应用证书、WAF/规则、缓存、
redirect 和边缘可观测性。gray cloud 表示 DNS only：Cloudflare 只返回 DNS 目标，
不在该 DNS 记录上应用 zone 的 HTTP 代理能力。

对于指向 `groupher-landing.pages.dev` 的 CNAME，gray-cloud DNS-only 在功能上
依然可以解析到 Cloudflare Pages，因为目标本身就在 Cloudflare 上。但保持
`groupher.com` 和 `www.groupher.com` 同时代理是更清晰的生产姿态。

证书机构的 CAA 记录应保留：

```text
groupher.com CAA 0 issue "sectigo.com"
groupher.com CAA 0 issue "pki.goog"
groupher.com CAA 0 issue "letsencrypt.org"
```

## 部署命令

构建并通过 Wrangler 直传 Landing Pages 产物：

```bash
yarn workspace @groupher/frontend-landing build:cloudflare
./node_modules/.bin/wrangler pages deploy frontend/landing/out \
  --project-name groupher-landing \
  --branch main
```

部署完成后，对自定义域名进行冒烟测试：

```bash
curl -i https://groupher.com/health
curl -i https://www.groupher.com/health
curl -i https://www.groupher.com/api/auth/providers
curl -i https://www.groupher.com/home/dashboard
curl -i https://www.groupher.com/home/dashboard/appearance
```

health 端点应从 Cloudflare 返回 `service: "edge-router"`。

构建并部署 TanStack Start Dash Worker：

```bash
yarn workspace @groupher/frontend-dash deploy
```

部署完成后验证 direct origin，再部署 Landing Pages 将公共路径接入 Dash：

```bash
curl -i https://dash.groupher.com/health
curl -i https://dash.groupher.com/home/dash/overview
curl -i https://groupher.com/health/dash
curl -i https://groupher.com/home/dash/overview
```

## Press 部署与切换

Press 的生产依赖：

```text
Press / Fly secrets
  PHOENIX_GRAPHQL_ENDPOINT=https://api.groupher.com/graphiql
  DATABASE_URL=<production PostgreSQL connection>
  METRIC_IP_SALT=<secret>
  PRESS_INTERNAL_TOKEN=<shared secret>

Phoenix / Fly secrets
  PRESS_INTERNAL_URL=https://press.groupher.com
  PRESS_INTERNAL_TOKEN=<same shared secret>

Landing / Cloudflare Pages variables
  PRESS_SITE=https://press.groupher.com
```

部署顺序：

1. 部署 Phoenix Ecto migration 和 `CMS.Press` GraphQL projection。
2. 执行 `@groupher/press` Drizzle migration，建立 `analysis.press_*` 对象。
3. 部署 Fly app `groupher-press` 并绑定 `press.groupher.com`。
4. 直接请求 `press.groupher.com`，验证 Press 到生产 Phoenix 和 PostgreSQL。
5. Landing Worker 在 Main fallback 前接入 Press route，生产 `PRESS_SITE` 指向
   `https://press.groupher.com`。
6. 部署 Landing Pages 后，从 `groupher.com` 验证真实 `.md`、Feed、`llms.txt` 和 sitemap。
7. 验收通过后删除旧 Main Doc `.md` HTTP route/renderer；Phoenix 持久化 Markdown 和
   `CMS.Press.article` projection 保留。

Press `/health` 当前只证明 Node 进程可响应。部署完成还必须至少验证：

```bash
curl -i https://press.groupher.com/health
curl -i https://groupher.com/home/feed.xml
curl -i https://groupher.com/home/feed.atom
curl -i https://groupher.com/home/feed.json
curl -i https://groupher.com/home/llms.txt
curl -i https://groupher.com/home/sitemap.xml
```

另选一篇真实 published Doc 验证 `.md`、ETag/`304`、不增加 Article human views、metrics
落库和 Phoenix-to-Press invalidation。完整检查表见 `docs/press/v1.md`。

Dev Hub 中 `press` 应显示 Fly logo 并链接到 `https://fly.io/apps/groupher-press`；Fly
infrastructure links 增加 Press。Landing 的 deployment target 应显示 Cloudflare，而不是旧的
Vercel 标识。
