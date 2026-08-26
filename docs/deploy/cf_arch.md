# Cloudflare 公共入口架构

> 状态：首轮生产切换已于 2026-08-25 完成。`groupher.com` 与 `www.groupher.com` 的生产流量由
> `edge-router` 接管，Landing、Community、Auth 通过 Service Binding 调用。当前 Edge Router
> 版本为 `4244410b-e384-4857-a577-ee491aa8551d`，Landing Worker 版本为
> `0bba8372-8601-4e03-9cbd-cd23e6ad0089`。

## 目标与产品边界

Groupher 的公共站点保持 path-first URL；独立产品使用独立子域名：

```text
groupher.com/                         Landing
groupher.com/pricing                  Landing
groupher.com/book-demo                Landing
groupher.com/:community/...           Community / Press

dash.groupher.com/...                 Dash
apply.groupher.com/...                Apply
auth.groupher.com/...                 Auth direct origin
```

以下旧公共路径已经删除，迁移后继续返回 `404`，不恢复路由：

```text
groupher.com/:community/dashboard/*
groupher.com/:community/dash/*
groupher.com/apply
groupher.com/apply/*
```

DNS 不能按 path 分流，因此 `groupher.com` 需要一个 HTTP 层入口。该入口是独立的
Cloudflare Worker `edge-router`，不属于 Landing、Community 或其他产品应用。

## 资源命名

Cloudflare Account 的显示名称为 `Groupher`。账户本身已经提供产品命名空间，内部资源
统一使用短名称，不重复添加 `groupher-` 前缀，也不添加 `-production` 后缀：

```text
edge-router
landing
community
dashboard
dash
apply
auth
assets-hub
inspire-me
```

`edge-router` 表示 Cloudflare Edge 上的公共 HTTP 路由层。它不是某个前端框架的应用内
router，也不承载产品 UI。

## 目标拓扑

```text
groupher.com / www.groupher.com / mapped community custom domains
  |
  v
edge-router Worker
  |-- Landing paths -------- Service Binding --> landing
  |-- Community paths ------ Service Binding --> community
  |-- Auth facade ---------- Service Binding --> auth
  |-- GraphQL facade ------- HTTPS -----------> Phoenix
  `-- Press public outputs - HTTPS -----------> Press
```

`edge-router` 当前通过 Worker Routes 绑定 `groupher.com/*` 和 `www.groupher.com/*`；社区
自定义域名只有在写入显式 hostname 映射并配置入口后才交给 Router。它的配置、binding
和路由表不知道旧 Main、Dashboard、Dash、Apply 的存在；这些独立产品各自管理自己的域名和
完整路径空间。

Cloudflare Worker 下游使用 Service Binding，不通过公开的 `*.groupher.com` 或
`*.workers.dev` 地址互相调用。Phoenix、Press 等非 Worker 目标继续使用 HTTPS fetch；这是
Service Binding 只适用于 Worker-to-Worker 调用的边界，不是例外 fallback。

## 路由契约

生产实现以 `packages/route-contract` 为路由分类 source of truth；历史入口实现仅作为
迁移背景，不再作为运行时代码或测试入口。Router 必须先按 hostname 进入互斥分支，再执行
该分支的 pathname 规则。

### 平台根域

以下规则只适用于 `groupher.com` 和 `www.groupher.com`，优先级从高到低：

1. `GET /health` 只返回 `edge-router` 自身的 `health.v1` 响应。
2. `/health/*` 返回 `404`，不提供 `/health/dash` 一类下游 fan-out health。
3. `/`、`/pricing`、`/book-demo` 及 Landing 静态资产交给 `landing`。静态资产包括现有前缀
   规则，以及根级单段文件规则 `^/[^/]+\.(ico|json|png|txt|webp|xml)$`，例如
   `/robots.txt`、`/llms.txt`、`/sitemap.xml` 和 favicon；该规则必须先于 community slug。
4. `/api/auth`、`/api/auth/*` 交给 `auth`。
5. `/api/graphql` 转发到 Phoenix `/graphiql`，并保持浏览器 cookie 清理策略。
6. `/api/utils/slugify` 交给 Community。它是用户创建内容时使用的公共 Community 工具端点，
   不需要 community slug；Dashboard 独立域名可以拥有自己的同名实现。
7. 下列 Press 公共输出交给 Press：
   - `/:community/doc/:document/.../*.md`
   - `/:community/{post,blog,changelog,doc}/.../*.md`
   - `/:community/feed.{xml,atom,json}`
   - `/:community/{post,blog,changelog,doc}/feed.xml`
   - `/:community/{llms.txt,sitemap.xml}`
8. 旧 Dashboard、Dash、Apply 公共产品路径返回 `404`。
9. 旧 Dashboard 根域 API/资产不再代理，以下路径与其他未知 `/api/*` 一样返回 `404`：
   - `/api/artiment/*`
   - `/api/docs/import/*`
   - `/api/internal/docs-import/*`
   - `/api/revalidate/community`
   - `/dashboard/_next/*`
10. 其余 `/api/*`、`/health/*` 等未识别的保留 namespace 返回 `404`。
11. 符合 `^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` 且不超过 30 字节的 `/:community` 和
    `/:community/*` 交给 Community；社区是否真实存在由 Community 判断。显式平台路径和
    namespace 已由更高优先级规则排除，不再额外使用会误伤现有社区的通用 reserved list。
    Regex 和长度限制与 Phoenix `CMS.Communities.NamePolicy` 的语法约束一致；Phoenix 的
    reserved/occupancy 规则不复制到 Router。
12. 其他未匹配路径返回 `404`，不存在旧 Main 或 Dashboard fallback。

`/:community/...` 不是无条件吞掉任意 URL 的兜底规则。Router 必须先排除保留 namespace、
静态资产、已删除产品路径和显式集成路径，再将有效的首段 slug 交给 Community。

### 社区自定义域名

已映射的社区自定义域名不执行上述 Landing、Auth、GraphQL、旧 Dashboard API/assets 或已删除
产品路径规则。Router 先把 hostname 解析为符合相同 slug 语法的 community slug，然后：

1. Feed、Markdown、`llms.txt`、sitemap 等 Press 公共输出路径注入映射 slug 后交给 Press。
2. 其他所有路径交给 Community，并携带映射 slug；例如自定义域名上的 `/api/graphql`
   不进入平台 GraphQL facade。
3. 未映射 hostname 返回 `404`。

例如 `talk.example.com -> home`：

```text
talk.example.com/post/123       -> Community(home), internal path /home/post/123
talk.example.com/feed.xml       -> Press, internal path /home/feed.xml
talk.example.com/post/a.md      -> Press, internal path /home/post/a.md
talk.example.com/doc/xyz/123.md -> Press, internal path /home/doc/xyz/123.md
talk.example.com/api/graphql    -> Community(home), not Phoenix
talk.example.com/api/utils/slugify -> Community, internal path /api/utils/slugify
```

公开 URL 始终保留 `talk.example.com`；注入 slug 只用于内部目标解析。

## Edge Router 边界

`edge-router` 只负责公共入口协议：

- 根据 hostname、pathname 和 method 选择目标。
- 保留原始 path、query、method 和 request body。
- 执行明确的 header、cookie、redirect 和 response 透传策略。
- 提供 `GET /health`，service id 为 `edge-router`。
- 输出结构化日志和 Trace，记录 route class、目标服务、状态码和耗时。

它不渲染产品 UI，不实现社区业务逻辑，也不持有 Community 的备用实现。Community 是
社区页面的唯一目标；Router 不配置旧 Main、Dashboard、Dash、Apply 的 origin、binding、
fallback、feature flag 或双写逻辑。Community 返回的 `404`、`500` 或其他响应均为最终响应。

## Host、Service Binding 与自定义社区域名

Service Binding 调用应从入站请求构造 `Request`，保留公开 URL 的 host、scheme 和 query；
自定义域名进入 Community 或 Press 时，内部 pathname 可以补上已映射 slug。Router 同时写入
受信任的 `X-Forwarded-Host`、`X-Forwarded-Proto` 和
`X-Groupher-Community-Slug`，并先删除客户端传入的同名转发信息。下游只能在确认请求来自
Router 的边界内信任这些 header，不能接受公网客户端伪造的转发信息。
Community 根据受信任的 slug 上下文和自身路由参数生成 canonical、Open Graph URL 和
redirect；内部注入的 `/:community` 前缀不能泄漏回自定义域名。
Community 还要求 slug header 与 Service Binding 注入后的 pathname 首段一致；直连源上
不满足该条件时，不启用自定义域名语义。

社区自定义域名需要显式维护 `hostname -> community slug` 映射。映射值使用与平台路径相同
的 slug 语法。Router 在进入 Community 或 Press 前完成 hostname 解析，并把标准化 slug
作为受信任上下文传递；下游使用公开 host 生成 canonical link、Open Graph URL 和
redirect，不使用 `workers.dev` 或 binding 名称。

经 Service Binding 调用后必须验收各应用不依赖错误的内部 host：

- Auth redirect、callback、CSRF 与 cookie domain。
- Community canonical URL、SEO metadata 和自定义域名识别。
- 下游生成的绝对资源 URL 和 redirect `Location`。

## Shared Route Contract

生产 Router 与本地 Gateway 共享一个独立 workspace package：

```text
packages/route-contract
@groupher/route-contract
```

该 package 只包含 runtime-neutral 的 TypeScript/ESM 路由策略和单元测试：

- 输入为 hostname、pathname、method 和已解析的自定义域名映射。
- 输出为 route class、target kind 和必要的内部 pathname transform。
- 不导入 Hono、Node API、Cloudflare `env`、`Request`、具体 fetcher 或 Gateway dev 逻辑。
- `edge-router` 和 `infra/dev-gateway` 分别实现 Worker/Node adapter、代理和运行时测试。

Wrangler 和 Gateway 的 esbuild 都直接 bundle 这个 package。生产路径分类只在 package 中测试
一次；Service Binding、header/cookie、HTTPS fetch、开发资产和 WebSocket 行为留在各自
adapter 测试中。

## Landing 与 Workers Static Assets

`frontend/landing` 继续生成静态产物，但托管方式统一为名为 `landing`
的 Worker，使用 Workers Static Assets：

```text
frontend/landing/out
  -> landing Worker Static Assets
  -> edge-router LANDING Service Binding
```

主要收益是概念和运维模型统一，不假设它天然比旧静态托管更快：

- 所有 Cloudflare 子项目统一使用 Wrangler、Worker versions 和 deployments。
- Logs、Traces、bindings、环境变量和本地开发使用同一套配置方式。
- Landing 与 Router 之间形成明确的 Service Binding 边界。
- 生产链路只维护 Landing Worker，不保留旧托管平台的兼容入口或回滚通道。

## 健康检查

`edge-router` 的 `/health` 只表示 Router handler 可响应，不能证明所有下游健康。Router
不提供 fan-out health，避免一个下游故障污染入口状态，也避免形成隐式公共 API。

独立应用在自己的子域名提供健康检查：

```text
dash.groupher.com/health
apply.groupher.com/health
auth.groupher.com/health
```

Landing 和 Community 通过少量真实公共页面 smoke check 验证。Status 系统分别监控 Router
自身、各 direct origin 和代表性用户链路。

## 本地开发

`infra/dev-gateway` 长期保留为本地开发基础设施。它负责 Dev Hub、Portless、开发
资源归属、referer 判断、Vite/TanStack 资源和 HMR WebSocket；这些都不是生产 Router 的
职责。

本地产品入口与生产产品边界一致：

```text
groupher.localhost                    Landing / Community 公共入口
dash.groupher.localhost               Dash
apply.groupher.localhost              Apply
auth.groupher.localhost               Auth
```

长期采用三层模型：

```text
@groupher/route-contract
  |-- edge-router: production adapter
  `-- infra/dev-gateway: local adapter + dev-only routes
```

`edge-router` 也应能通过 Wrangler 的多 Worker 本地开发模式连接本地 Service Bindings，用于
生产一致性 smoke。它不必替代日常 Dev Gateway；两者共享纯路由契约和测试即可。

以下开发路径只属于 Dev Gateway，生产 `edge-router` 不得暴露：

```text
/@fs/*  /@id/*  /@vite/*  /@react-refresh  /src/*
/_vite/*  /node_modules/.vite/*
/__dash_hmr  /__apply_hmr
dev-only _serverFn routes and HMR WebSocket upgrades
```

## Observability

生产 Worker 默认启用：

```text
Logs   100%
Traces 1%
```

`edge-router` 的日志和 Trace 至少包含 request/trace id、hostname、method、标准化 route
class、target service、response status、duration 和 Cloudflare colo。不得记录 access token、
完整 cookie、Authorization header 或用户提交的敏感正文。

## Preview 与发布验证

普通的 `workers.dev` / preview URL 只能验证 Router preview 加当前 active deployment 的下游
链路，不能证明一组尚未发布的 Worker version 能协同工作。

验证分四层：

1. 本地 route contract 单元测试。
2. Router preview + active downstream deployments。
3. 协同 preview：下游 version 已存在于 deployment 中，并由
   `Cloudflare-Workers-Version-Overrides` 指定目标 version。
4. Worker Route 或 Custom Domain 生效后的真实 zone、TLS、cookie、redirect 和页面 smoke。

Preview 结果必须注明使用的是 active downstream 还是 version override，避免把单点预览写成
“完整公共链路已验证”。

## DNS 与 Worker Routes

生产入口使用 Cloudflare Worker Routes：

```text
groupher.com/*      -> edge-router
www.groupher.com/*  -> edge-router
```

对应 hostname 必须保留 proxied DNS 记录，Cloudflare 才能在到达旧 DNS origin 前执行 Worker
Route。该 DNS 记录只是 route carrier；请求处理权属于 `edge-router`，不代表旧静态 origin
仍是生产入口。不要把 apex 或 `www` CNAME 到 `*.workers.dev`，也不要把记录切成 DNS-only。

Worker Custom Domains 是未来可选的 DNS 清理方式，不是当前架构的必要条件。若改用 Custom
Domains，应先删除冲突 DNS 记录，再由 Cloudflare 创建目标记录和证书，并完成同一套公网
smoke；不能同时配置同 hostname 的 Worker Route 与 Custom Domain。

## Wrangler 基线

`infra/edge-router/wrangler.jsonc` 跟随仓库现有 Worker 惯例，至少包含：

- `$schema`、`name`、`main`、`compatibility_date` 和必要的 compatibility flags。
- 当前锁定的 Wrangler 4.118.0 使用 `2026-08-06` compatibility date；升级 Wrangler
  后才可将日期推进到更晚版本，不需要日常跟随 Cloudflare 日期变更。
- Landing、Community、Auth 等 Service Bindings。
- Logs 与 Trace observability 配置。
- version metadata binding。
- `workers_dev: false`，生产只使用显式 Worker Routes；preview URL 只用于验证。
- `preview_urls: true`，preview URL 通过 Cloudflare Access 或同等措施保护。

## Community 运行状态

Community 已独立部署并承担自身域名流量，不再设置单独的“生产 Gate”迁移阶段。常规发布
仍应持续 smoke 以下能力：登录态、SSR/hydration、404、canonical、Feed/Markdown、缓存和
自定义社区域名；这些是运行监控项，不是 Edge Router 切换前的额外迁移步骤。

## 迁移后 TODO

- **P1：**配置 `CUSTOM_DOMAIN_COMMUNITIES` 后，补做第三方社区域名的 canonical、redirect 和
  Press 路径专项 smoke；同时验证伪造转发 header 被拒绝，以及内部注入的 slug 不会泄漏到
  公共 URL。
- 决定是否提供 Landing `/llms.txt`；当前没有对应资源，公网返回 `404`。
- 在 Cloudflare Workers Observability 中采集一条真实 Trace，确认 Router route class 与下游
  Worker 边界可区分。

## 迁移记录

以下步骤已于 2026-08-25 完成（第 9 项保留未配置自定义域名的边界说明）：

1. 建立 `@groupher/route-contract`，完整覆盖平台根域、自定义域名、slug、根级静态资产、
   Press transform 和目标 404。
2. 建立 `infra/edge-router` Worker、Wrangler 配置、bindings、observability 和单元测试。
3. 让 Dev Gateway 复用共享生产规则，并在本地 adapter 中保留 dev-only 规则。
4. Dash 保持独立产品域名，不接入 Edge Router。
5. 配置 Landing、Community、Auth Service Bindings，并验证 host/header 契约。
6. 将 Landing `out` 部署为 `landing` Worker Static Assets。
7. 完成本地、active downstream preview、version override 和 direct origin 验证。
8. 人工确认 Landing、Community、Auth 已部署且 bindings 可解析，再首次部署带 production
   Worker Routes 的 Edge Router。
9. 已验证 Router health、真实社区页面、Landing、Auth、Press health、`robots.txt`、
   `sitemap.xml` 和 GraphQL facade 的公网可达性；GraphQL 未携带 CSRF proof 时返回预期的
   `400 INVALID_CSRF`。自定义域名、`/llms.txt` 和 Observability Trace 验收已移入上方
   “迁移后 TODO”，不计入本次首轮切换的完成项。
10. 更新部署、状态监控和 DNS 文档，确认生产入口只剩 Worker Routes 与 Service Bindings。

当前实现验证命令：

```bash
yarn workspace @groupher/route-contract test
yarn workspace @groupher/edge-router test
yarn workspace @groupher/dev-gateway test
yarn workspace @groupher/frontend-landing build:worker
yarn workspace @groupher/frontend-landing deploy:worker:dry-run
yarn workspace @groupher/edge-router deploy:dry-run
```

`build:worker` 内部会先运行 `sync:assets:landing`，确保 Worker 上传的 icons 和 wallpaper
来自当前源码；不要改成只执行 `yarn build` 的部署链路。

`edge-router` 的首次正式部署会立即激活 `groupher.com/*` 和 `www.groupher.com/*` Worker
Routes。部署前必须人工确认 Landing、Community、Auth 三个下游 Worker 已部署且 Service
Bindings 可解析；Edge Router workflow 的 push/PR 触发只做验证，正式部署使用手动触发。

Dev Gateway 不在这条生产迁移链中退役；后续只有在本地开发体验有明确替代时才单独讨论删除。

## 验收条件

- Landing、Community 与 Press 公共路径按上述优先级正确分流。
- 旧 Dashboard、Dash、Apply 公共路径以及 `/health/*` 返回 `404`。
- Dash、Apply 只通过独立子域名提供产品页面。
- `/api/utils/slugify` 在平台根域交给 Community；旧 Dashboard 的其他根域 API/资产返回
  `404`，Dashboard 调用方只使用其独立域名。
- Router 配置中不存在旧 Main、Dashboard、Dash、Apply 的 hostname、binding、origin、fallback
  或 feature flag。
- 未识别 `/api/*` 不会误入 Community。
- 平台根域和社区自定义域名使用互斥规则；自定义域名的 GraphQL-like 路径不会进入平台
  facade，Press 公共输出能正确注入映射 slug。
- Service Binding 保留公开 host 语义，Auth 与自定义社区域名验收通过。
- Preview 报告明确 downstream version；Worker Route 上的最终公网 smoke 通过。
- Trace 能区分 Router route class 和下游 Worker 边界。
- 生产部署不依赖旧托管平台、兼容入口或 fallback。
- Dev Gateway 可继续承担日常本地开发；edge-router 可用于本地生产一致性 smoke。

## Cloudflare 参考

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Local development with multiple Workers](https://developers.cloudflare.com/workers/local-development/multi-workers/)
- [Version overrides](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/#version-overrides)
- [Routes and domains](https://developers.cloudflare.com/workers/configuration/routing/)
- [Workers observability](https://developers.cloudflare.com/workers/observability/)
