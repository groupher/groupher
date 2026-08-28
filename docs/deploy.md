# Groupher 部署

> 状态：当前部署说明

## 公共入口

Groupher 的公共站点保持 path-first URL；独立产品使用独立子域名：

```text
groupher.com/                         Landing
groupher.com/pricing                  Landing
groupher.com/book-demo                Landing
groupher.com/:community/...           Community / Press
groupher.com/api/graphql              同源浏览器 GraphQL facade
dash.groupher.com                     Dash
apply.groupher.com                    Apply
api.groupher.com/graphiql             Phoenix GraphQL origin
press.groupher.com                    Press 服务 origin
```

`/:community/dashboard/*`、`/:community/dash/*`、`/apply` 和 `/apply/*` 是已经删除的旧公共
路径，返回 `404`。Dash、Apply 不通过 `groupher.com` 的社区路径提供页面。

Dash 的页面、`/api/artiment/*`、`/api/docs/import/*`、`/api/revalidate/community` 和
框架资产全部属于 `dash.groupher.com`。`groupher.com` 不代理这些路径；根域上的旧
Dashboard API/资产返回 `404`。

`/api/utils/slugify` 是例外：平台根域上的该路径属于 Community，用于后续用户内容创建；
Dash 独立域名保留自己的同名实现。

`.md`、Feed、`llms.txt` 和 community sitemap 仍使用
`groupher.com/:community/...` 这一公共 URL。`press.groupher.com` 只作为 Edge Router 和
Phoenix 调用 Press 的稳定 origin，不建立第二套 canonical 内容地址。

当前公共入口由 `edge-router` Worker 托管，静态 Landing 与应用 Worker 通过 Service Binding
接入：

```text
groupher.com/*, www.groupher.com/*
  -> edge-router Worker Route
       -> landing Worker Static Assets
       -> community Worker
       -> auth Worker
       -> Phoenix / Press HTTPS origins
```

生产入口只使用 Worker Routes 和 Service Bindings，不保留旧托管平台兼容入口或回滚通道。

## Cloudflare 应用

```text
Cloudflare Workers
  edge-router
    prod routes:
      groupher.com/*
      www.groupher.com/*
  landing
    consumed by edge-router Service Binding
  community
    direct domain: community.groupher.com
    consumed by edge-router Service Binding
  dash
    prod route:
      dash.groupher.com/*
  apply
    prod custom domain:
      apply.groupher.com/*
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

Cloudflare Account 的显示名称为 `Groupher`，它是这些资源的账户级边界。账户内的
Workers 统一使用产品级短名称，不再重复添加 `groupher-` 前缀。

Worker 统一使用短名称，不添加 `groupher-` 或 `-production`。旧的
`groupher-community-production` 已删除。

Community 对不存在的 slug 返回 `404`。Phoenix 的匿名与登录读取路径都保留
`CMS.Communities.ErrorCat.not_exist`（GraphQL code `5504`）；Community 将该预期领域错误转换
为 route-level not-found，其他 GraphQL 错误仍按服务错误处理。

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

local development
  Dev Hub / local Gateway / portless routes
```

如果之后需要公开的 staging 环境，应显式添加一个 `staging.groupher.com` 或
`dev.groupher.com` 这样的自定义域名，并绑定到对应的 Worker deployment。

## DNS 记录

apex 与 `www` 保留 orange-cloud proxied DNS 记录，并由 Worker Routes 接管：

```text
groupher.com/*      -> edge-router
www.groupher.com/*  -> edge-router
```

现有 DNS origin 只是 Worker Route 的 carrier；请求会在到达 origin 前进入 `edge-router`。
不要删除这两条 proxied DNS 记录，也不要切成 DNS-only，除非同一次变更中改用 Worker Custom
Domain 并完成 TLS 与公网 smoke。

Press custom domain 应绑定到 Fly app `groupher-press`：

```text
press.groupher.com  CNAME  groupher-press.fly.dev
```

实际 DNS target 和证书验证记录以 Fly 为 `press.groupher.com` 生成的 domain instructions
为准；证书和 `https://press.groupher.com/health` 未验证前，不能认为服务域名已经切换成功。

Cloudflare 会把 apex CNAME flatten 掉，因此在 Cloudflare DNS 中给 `groupher.com`
使用 CNAME 是合法的。

不要把这两个 hostname CNAME 到 `workers.dev`。当前使用 Worker Routes；Worker Custom
Domains 只是未来可选的 DNS 清理方案。完整设计见
[`docs/deploy/cf_arch.md`](deploy/cf_arch.md)。

推荐这些生产自定义域名使用 orange-cloud 代理。orange cloud 表示该主机名会经
Cloudflare 的 HTTP 代理层路由，Cloudflare 可以在此应用证书、WAF/规则、缓存、
redirect 和边缘可观测性。gray cloud 表示 DNS only：Cloudflare 只返回 DNS 目标，
不在该 DNS 记录上应用 zone 的 HTTP 代理能力。

`groupher.com` 和 `www.groupher.com` 必须保持代理状态；DNS-only 不会执行 Worker Route。

证书机构的 CAA 记录应保留：

```text
groupher.com CAA 0 issue "sectigo.com"
groupher.com CAA 0 issue "pki.goog"
groupher.com CAA 0 issue "letsencrypt.org"
```

## 部署命令

先部署下游 Worker，再部署公共 Router：

```bash
yarn workspace @groupher/frontend-landing deploy:worker
yarn workspace @groupher/frontend-community deploy
yarn workspace @groupher/backend-auth deploy:worker
yarn workspace @groupher/edge-router deploy
```

首次部署 `edge-router` 前必须人工确认 Landing、Community、Auth 已部署且 Service Bindings
可解析，因为该 Worker 配置包含 `groupher.com/*` 和 `www.groupher.com/*` production
Worker Routes；Edge Router 的 CI push 只执行验证，正式部署使用手动 workflow。

Landing 的 `build:worker` 会先执行根目录的 `sync:assets:landing`，再构建 Next 静态产物；
因此 icons 和 wallpaper 不需要额外手动同步。Landing 的 PR dry-run 和 `dev` 分支部署由
`.github/workflows/deploy-landing-worker.yml` 执行；Edge Router 的 PR/`dev` push 只做验证，
正式部署通过 `.github/workflows/deploy-edge-router.yml` 的手动 workflow 执行。

部署完成后，对自定义域名进行冒烟测试：

```bash
curl -i https://groupher.com/health
curl -i https://www.groupher.com/health
curl -i https://www.groupher.com/api/auth/providers
curl -i https://www.groupher.com/home
curl -i https://www.groupher.com/home/post
```

health 端点应从 Cloudflare 返回 `service: "edge-router"`。

构建并部署 TanStack Start Dash Worker：

```bash
yarn workspace @groupher/frontend-dash deploy
```

部署完成后只验证 Dash 的独立产品域名：

```bash
curl -i https://dash.groupher.com/health
curl -i https://dash.groupher.com/home/dash/overview
```

`groupher.com/health/dash` 和 `groupher.com/:community/dash/*` 保持 `404`，不属于 Dash 的
发布 smoke。

## Press 部署与切换

Press 的生产依赖：

```text
Press / Fly secrets
  PHOENIX_GRAPHQL_ENDPOINT=https://api.groupher.com/graphiql
  DATABASE_URL=<production PostgreSQL connection>
  METRIC_IP_SALT=<secret>
  SERVICE_AUTH_TOKEN_ENDPOINT=https://auth.groupher.com/oauth2/token
  SERVICE_AUTH_CLIENT_ID=<press client id>
  SERVICE_AUTH_CLIENT_SECRET=<press client secret>

Phoenix / Fly secrets
  PRESS_INTERNAL_URL=https://press.groupher.com
  SERVICE_AUTH_TOKEN_ENDPOINT=https://auth.groupher.com/oauth2/token
  SERVICE_AUTH_CLIENT_ID=<phoenix client id>
  SERVICE_AUTH_CLIENT_SECRET=<phoenix client secret>

Edge Router / Cloudflare Worker variables
  PRESS_SITE=https://press.groupher.com
```

部署顺序：

1. 部署 Phoenix Ecto migration 和 `CMS.Press` GraphQL projection。
2. 执行 `@groupher/press` Drizzle migration，建立 `analysis.press_*` 对象。
3. 部署 Fly app `groupher-press` 并绑定 `press.groupher.com`。
4. 直接请求 `press.groupher.com`，验证 Press 到生产 Phoenix 和 PostgreSQL。
5. Public Router 将 Press 公共输出规则放在 Community 通用路由之前，生产 `PRESS_SITE`
   指向 `https://press.groupher.com`。
6. 部署 Landing Worker 与 Edge Router 后，从 `groupher.com` 验证真实 `.md`、Feed、
   `llms.txt` 和 sitemap。
7. 验收通过后删除旧 Main Doc `.md` HTTP route/renderer；Phoenix 持久化 Markdown 和
   `CMS.Press.article` projection 保留。

Press `/health` 当前只证明 Node 进程可响应。部署完成还必须至少验证：

```bash
curl -i https://press.groupher.com/health
curl -i https://groupher.com/home/changelog/3.md
curl -i https://groupher.com/home/llms.txt
curl -i https://groupher.com/home/sitemap.xml
```

Feed 是否返回内容取决于社区是否开启对应输出；未开启时 `404` 是正常产品配置，不用于判断
Press 链路失败。Markdown、`llms.txt` 和 sitemap 是稳定的发布 smoke。

另选一篇真实 published Doc 验证 `.md`、ETag/`304`、不增加 Article human views、metrics
落库和 Phoenix-to-Press invalidation。完整检查表见 `docs/press/v1.md`。

Dev Hub 中 `press` 应显示 Fly logo 并链接到 `https://fly.io/apps/groupher-press`；Fly
infrastructure links 增加 Press。Landing 的 deployment target 应显示 Cloudflare，而不是旧的
Vercel 标识。
