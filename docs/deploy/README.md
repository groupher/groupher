# Groupher 部署

> 状态：current
>
> 当前进度：当前部署说明

## 本目录

- [`README.md`](./README.md)：当前整体部署入口、域名和服务拓扑。
- [`cloudflare.md`](./cloudflare.md)：当前 Cloudflare 生产架构。
- [`cloudflare-migration-proposal.md`](./cloudflare-migration-proposal.md)：已被当前架构取代的历史迁移提案。
- [`runbooks/oauth-v1-cutover.md`](./runbooks/oauth-v1-cutover.md)：OAuth V1 切换运行手册。

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
`groupher.com/:community/...` 这一公共 URL。`press.groupher.com` 只作为 Phoenix 调用 Press 的稳定 origin，不建立第二套 canonical 内容地址。

Press 生产已硬切到 Cloudflare Workers，旧 `groupher-press` Fly app 已删除。公共输出经
edge-router Service Binding 调用 named `Public`；`press.groupher.com` 为 default 入口，仅开放
health 和签名 invalidation。保持 Workers Free，超限拒绝、不升级；不保留 Fly fallback。
部署证据见 [Press 部署记录](../press/cloudflare-workers-deployment.md)。

当前公共入口由 `edge-router` Worker 托管，静态 Landing 与应用 Worker 通过 Service Binding
接入：

```text
groupher.com/*, www.groupher.com/*
  -> edge-router Worker Route
       -> landing Worker Static Assets
       -> community Worker
       -> auth Worker
       -> Phoenix HTTPS origin
       -> press Worker named Public (Service Binding)
```

生产入口只使用 Worker Routes 和 Service Bindings，不保留旧托管平台兼容入口或回滚通道。
Groupher 生产应用不再使用 Vercel；旧 Vercel 项目、团队域名关联和指向 Vercel 的 DNS 记录
已清理。账户中其他 demo 项目不属于 Groupher 生产部署。

### Vercel 退役记录（2026-10-26）

- 删除旧项目及其部署：`groupher-dashboard`、`dashboard`、`groupher-main`、
  `groupher-landing`、`groupher-gateway`、`groupher-web`、`cache-test`。
- 从 Vercel 团队移除 `groupher.com` 域名关联；域名注册商和 Cloudflare 权威 DNS 不变。
- 删除 Cloudflare DNS 中指向旧 Vercel 的 `dashboard.groupher.com`、
  `gateway.groupher.com`、`*.groupher.com` A 记录和 `_domainconnect` CNAME。
- Vercel 团队内剩余的 `with-zustand`、`transition-demo`、`epam-nextjs-boilerplate`、
  `auth-flow`、`sentry-test` 与 Groupher 生产服务无关，未删除。

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
  press
    custom domain: press.groupher.com (health/internal only)
    consumed by edge-router named Public Service Binding
  assets-hub
    prod route:
      assets.groupher.com/*
  inspire-me
    prod route:
      inspire-me.groupher.com/*
  status
    prod route: status.groupher.com/*
    frontend-only Cron checks; D1 current state
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
```

Press 不再属于 Fly 部署目标。Node 入口只用于本地开发；生产 Worker 每次 invocation 创建
`pg.Client`，Hyperdrive 管理连接，retention 由 Cron 执行。

| 层级                         | 名称                                         |
| ---------------------------- | -------------------------------------------- |
| 产品 / package               | `Press` / `@groupher/press`                  |
| 代码 / Dev Hub service id    | `backend/press` / `press`                    |
| Cloudflare Worker            | `press`                                      |
| health / invalidation origin | `press.groupher.com`                         |
| 用户内容入口                 | 平台/社区域名 → edge-router → named `Public` |

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

### 主题偏好 Cookie

Dash、Community 和 Landing 共享主题偏好时，构建环境应配置公开变量
`VITE_THEME_COOKIE_DOMAIN`：

```text
production:       .groupher.com
local subdomains:  .groupher.localhost
staging/preview:   当前部署环境可覆盖目标宿主的根域名
```

该变量由 Core 的 pre-paint script 和运行时主题持久化共同使用。Vite 会自动暴露
`VITE_` 前缀变量。主题 Cookie Domain 按当前 host 解析，优先级为：

1. `VITE_THEME_COOKIE_DOMAIN` 已设置且当前 host 属于该根域：使用 env Domain。
2. env 未设置或不匹配当前 host：尝试内置 `.groupher.localhost` / `.groupher.com`
   白名单。
3. env 和内置白名单都不匹配：降级为 host-only cookie。

env Domain 不匹配当前 host 时不会强行写入无效的跨域 Domain。裸 `localhost`、IP 地址和
不属于上述根域的 preview host 不能跨宿主共享主题偏好。

不要把该变量配置成认证 Cookie 的 Domain，也不要为了共享主题扩大 session、token 或
其他认证 Cookie 的作用域。

## DNS 记录

apex 与 `www` 保留 orange-cloud proxied DNS 记录，并由 Worker Routes 接管：

```text
groupher.com/*      -> edge-router
www.groupher.com/*  -> edge-router
```

现有 DNS origin 只是 Worker Route 的 carrier；请求会在到达 origin 前进入 `edge-router`。
不要删除这两条 proxied DNS 记录，也不要切成 DNS-only，除非同一次变更中改用 Worker Custom
Domain 并完成 TLS 与公网 smoke。

`press.groupher.com` 已绑定 Press Worker Custom Domain；DNS/TLS 由 Cloudflare 管理。
不要为它创建指向旧 Fly app 或 `workers.dev` 的 CNAME。直接访问内容路径应返回 no-store 404；
仅 `/health` 和签名 `/internal/invalidate` 可用。变更 zone/route 后按
[Press 运维复核](../../ops/press/README.md#free-监控与-route-复核) 检查 fail-closed。

Cloudflare 会把 apex CNAME flatten 掉，因此在 Cloudflare DNS 中给 `groupher.com`
使用 CNAME 是合法的。

不要把这两个 hostname CNAME 到 `workers.dev`。当前使用 Worker Routes；Worker Custom
Domains 只是未来可选的 DNS 清理方案。完整设计见
[`docs/deploy/cloudflare.md`](./cloudflare.md)。

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
pnpm --filter @groupher/frontend-landing run deploy:worker
pnpm --filter @groupher/frontend-community run deploy
pnpm --filter @groupher/backend-auth run deploy:worker
pnpm --filter @groupher/edge-router run deploy
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
pnpm --filter @groupher/frontend-dash run deploy
```

部署完成后只验证 Dash 的独立产品域名：

```bash
curl -i https://dash.groupher.com/health
curl -i https://dash.groupher.com/home/dash/overview
```

`groupher.com/health/dash` 和 `groupher.com/:community/dash/*` 保持 `404`，不属于 Dash 的
发布 smoke。

## Press 部署

生产已运行在 Cloudflare，使用 `Deploy Press Worker` workflow 的 `production` 目标。
先部署 Press，再部署 edge-router；日常发布 `apply_migrations=false`，不执行切换回 Fly。
Phoenix 领域修复需单独部署 API。Worker 资源、Secrets、独立 migration 与隔离 preview 的
操作见 [运维工具](../../ops/press/README.md)；已执行证据见 [部署记录](../press/cloudflare-workers-deployment.md)。

- Worker：`HYPERDRIVE`（query cache disabled、受限 analysis 角色）、Phoenix/Auth bindings、
  service client secrets、`METRIC_IP_SALT`、`PRESS_PUBLIC_DISABLED=false`。
- Phoenix：`PRESS_INTERNAL_URL=https://press.groupher.com`、
  `PRESS_INTERNAL_RESOURCE=https://press.groupher.com/internal`，service identity 具备
  `press:cache:invalidate` scope。token/失效调用失败必须由独立 Press Outbox 任务重试。
- edge-router：`PRESS` Service Binding 指向 named `Public`，不使用 `PRESS_SITE`。
- `/health` 仅证明进程可响应；发布后核对 Worker version/environment，并验证实际公开内容、
  ETag、metrics 和真实签名 invalidation。Feed 关闭时 404 属于正常配置。

```sh
curl -i https://press.groupher.com/health
curl -i https://groupher.com/home/llms.txt
curl -i https://groupher.com/home/sitemap.xml
```

Dev Hub 的 Press 部署目标为 Cloudflare；不得链接已删除的 Fly app。Node 本地进程不是生产目标。
保持 Workers Free、超限拒绝、不升级。账号整体限流时接受 Cloudflare 平台错误，不承诺应用 503。
