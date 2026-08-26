# Next.js 退场与基础设施清理

> 状态：目标方案，尚未实施
>
> 目标：删除已经被 TanStack 应用替代的旧项目和全部真实 Next.js 依赖，收敛生产与本地
> 路由基础设施，并清理失效的脚本、配置、测试和文档。

## 最终形态

产品应用统一使用 TanStack：

```text
frontend/landing     官网与营销页面
frontend/community   公开社区
frontend/dash        社区管理后台
frontend/apply       社区申请
```

入口基础设施分为生产和本地两层。以下是依赖关系，不表示目录嵌套；共享 contract 的
实际路径是 `packages/route-contract`：

```text
packages/route-contract (@groupher/route-contract)
  |-- consumed by infra/edge-router: production adapter
  `-- consumed by infra/dev-gateway: local development adapter
```

- `edge-router` 是生产公共入口，运行在 Cloudflare Workers。
- `dev-gateway` 仅服务本地 Portless、Vite dev server、TanStack server functions 和 HMR。
- 两者共享纯路由 contract，不共享 runtime-specific proxy 实现。

## 1. 删除 Main 和 Dashboard

以下 Next.js 项目已被 TanStack 应用替代，应直接删除：

```text
frontend/main       -> frontend/community
frontend/dashboard  -> frontend/dash
```

不保留应用、路由或域名兼容层：

- 删除 `main.groupher.*`；
- 删除 `dashboard.groupher.*`；
- 删除 `/:community/dashboard/*`；
- 删除 `/_next/static/*` 和 `/_next/hmr`；
- 删除旧 Main/Dashboard API routes；
- `dashboard.groupher.com` 不重定向、不映射到 Dash，直接退场；
- 正式管理后台只使用 `dash.groupher.com`。

删除项目目录时还必须同步删除：

- 根目录的 Main/Dashboard dev、build、serve、test、doctor 和 asset sync scripts；
- Makefile targets；
- Lefthook targets；
- GitHub Actions build、type-check、lint 和 E2E matrix；
- `frontend/e2e/playwright.config.ts` 中的 Main/Dashboard web servers 和 app matrix；
- `frontend/e2e/tests` 中只覆盖 Main/Dashboard 的用例、fixture 和断言；
- Local Dev Hub 的服务定义；
- `ops/status/config.yaml` 中的 `https://dashboard.groupher.com/health`；
- `ops/status/config.local.yaml` 中的 Gateway、Main、Dashboard service checks；
- baseline、bundle 和 `.next` 产物统计脚本；
- 指向两个 workspace 的文档与配置。

Gateway 的 Next 分支删除时，必须同步删除或改写
`infra/gateway/src/upgrade.test.ts` 和 `infra/gateway/src/routing.test.ts` 中的
`/_next/hmr`、`/dashboard/_next/static` 及 Dashboard upstream 用例。不能保留已经不存在的
兼容行为作为回归测试。

## 2. 清理 Next.js 根依赖

删除 Main/Dashboard 后，根 workspace 不再保留：

- `next`；
- `@next/bundle-analyzer`；
- `next-compose-plugins`；
- `next dev/build/start/info/export` scripts；
- `.next` cache、build 和 clean 约定；
- 只为 Next 项目存在的环境与构建配置。

清理范围不只限于被删除的 Main/Dashboard。所有存活 workspace、CI 和容器配置中的陈旧
Next 产物约定也必须删除，当前已知包括：

- `frontend/landing/package.json` 的 `clean` 脚本仍包含 `.next`；
- `.github/workflows/build-landing.yml` 仍缓存 `frontend/landing/.next/cache`，cache key 仍为
  `next-landing`；
- `.dockerignore` 仍包含全局 `**/.next` 和 `frontend/landing/.next`；
- `.gitignore` 仍包含 `**/.next/`。

当仓库不存在真实 Next.js 项目后，`.next` ignore/cache/clean 约定应整体删除，而不是继续
以“可能还会用到”为理由保留。

重新生成锁文件后，`yarn why next` 应无真实 Next.js package 依赖。

`NEXT_PUBLIC_*` 名称本身不等于 Next.js runtime 依赖。TanStack 应用仍在使用的变量应单独
评估并逐步迁移到统一的公开环境变量命名，不阻塞本轮项目删除。

## 3. 清理 Frontend Core

`frontend/core` 中的 Next 专用入口应删除或迁移：

- `next.config.js` 及 package export；
- `NextRequest`、`NextResponse` proxy helpers；
- `next/cache`、`next/headers` 和 Next Metadata helpers；
- `useServerInsertedHTML` 实现；
- 共享 UI 中对 `next/navigation` 的直接引用；
- 只被旧 Main/Dashboard 使用的 server-only modules。

不能按目录整块删除共享 SSR 代码。Community 和 Dash 仍使用的纯解析、序列化和 route
helpers 应保留，并移动到不带 Next runtime 语义的边界。

完成后 Core 不直接依赖 Next.js 或 TanStack Router runtime；产品路由语义继续保留为纯
route target/resolver，runtime hooks 由具体 TanStack host 提供。

## 4. PlatformProvider 收敛

所有正式前端统一到 TanStack 后，当前 `PlatformProvider` 不再需要承担 Next/TanStack
framework adapter 职责。

应删除或收敛：

- Next Platform Provider；
- Static Next Platform Provider；
- 通过 Context 注入的 Next Image、Link 和 Script；
- Router push、replace、refresh、prefetch 的 Next/TanStack 转译；
- 测试中的 platform fallback。

仍需保留为普通 routing 能力：

- typed route targets；
- Dashboard、Community 等产品路径 resolver；
- search schema 与 `preserveSearch`；
- active route 判断；
- 跨产品 URL contract。

如果不同应用仍需要少量当前宿主配置，应使用窄化的 route scope，而不是继续保留一整套
Platform Provider。

## 5. Gateway 改名为 Dev Gateway

当前 `infra/gateway` 已经只应承担本地开发职责，因此目标名称为：

```text
infra/gateway       -> infra/dev-gateway
@groupher/gateway   -> @groupher/dev-gateway
```

名称必须同步到目录、workspace package、Makefile、根 scripts、Dev Hub、测试和文档；迁移
完成后不保留 `gateway` alias，避免它再次被理解为生产基础设施。

Dev Gateway 负责：

- `groupher.localhost` 的 Landing/Community 组合入口；
- 本地 `/api/auth/*`；
- 本地 `/api/graphql` 和浏览器 header/cookie policy；
- Press 公共输出的本地转发；
- Vite module/source 请求；
- TanStack dev-only server function routes；
- Vite HMR WebSocket upgrade；
- Host、Forwarded Host 和 Referer 驱动的 dev server 选择。

以下本地协议不得进入生产 Edge Router：

```text
/@fs/*
/@id/*
/@vite/*
/@react-refresh
/src/*
/_vite/*
/node_modules/.vite/*
TanStack dev-only server function routes
Vite HMR WebSocket upgrades
```

Dash、Apply 等独立产品域名由 Portless 直接连接各自 dev server，不需要经过 Dev Gateway。

## 6. Edge Router

`infra/edge-router` 继续作为生产公共入口：

```text
Browser
  -> edge-router
       |-- LANDING Service Binding
       |-- COMMUNITY Service Binding
       |-- AUTH Service Binding
       |-- Phoenix HTTP upstream
       `-- Press HTTP upstream
```

它负责生产 host/path 分类、同源 Auth/GraphQL、请求 policy、自定义域名、公共输出、健康检查
和 observability，不负责 Dash、Apply、本地 dev assets 或 HMR。

Edge Router 可以通过 Wrangler 在本地连接 Landing、Community 和 Auth Service Bindings，
但该模式只用于生产一致性 smoke。开发配置需要：

- 接受 `groupher.localhost`、`localhost` 和 `127.0.0.1` platform hosts；
- 将 API、Press upstream 指向本地地址；
- 连接本地 Service Bindings；
- 不启用生产 Worker Routes。

日常开发继续使用 Dev Gateway。只有 TanStack/Vite HMR、server functions 和共享资源代理
经过 Edge Router 的真实验证全部稳定后，才重新评估是否删除 Dev Gateway。

## 7. Route Contract

`@groupher/route-contract` 是生产 Edge Router 与本地 Dev Gateway 的共享来源，只包含：

```text
hostname + pathname + method + custom domains
  -> target kind + internal pathname + request policy
```

它不能依赖 Node、Hono、Cloudflare runtime、Vite、TanStack Router、React、Portless、Service
Binding、WebSocket proxy 或环境特定 upstream URL。

开发专属资产/HMR 判断可以属于 Dev Gateway；公共 host/path 分类必须由共享 contract 决定，
并由 contract tests 防止两个 adapter 漂移。

## 8. Inspire Me

`inspire-me` 是前端应用，长期不应位于 `backend`：

```text
backend/inspire-me  -> frontend/inspire-me
TanStack Start      -> TanStack Start
```

Inspire Me 已完成 TanStack Start 改写，不再保留 Vinext 或 `next/*` 兼容 API。目录迁移到
`frontend/inspire-me` 可作为独立的纯路径调整，不阻塞本轮 Next 清理验收。

## Dev Gateway public assets

`infra/dev-gateway/public/` 的 favicon、manifest、robots 和 sitemap 源自已删除的
`frontend/dashboard/public/`。它们不含旧产品标识，现作为 `groupher.localhost` 的通用本地
入口资产保留；后续维护应从 Dev Gateway 管理，而非恢复 Dashboard。

## 删除前清点

开始实施前先保存一次全仓残留清单，作为各 PR 的输入和最终验证对照。至少运行：

```bash
rg -l \
  'frontend/main|frontend/dashboard|@groupher/gateway|next-compose-plugins|NextRequest|useServerInsertedHTML' \
  --glob '!**/node_modules/**' \
  --glob '!**/.next/**'

rg -n \
  '\.next|/_next|dashboard\.groupher\.com|service.*(gateway|main|dashboard)' \
  --glob '!**/node_modules/**' \
  --glob '!**/.next/**'
```

第二条中的 `service.*(gateway|main|dashboard)` 是有意采用的宽匹配，只用于发现 Status、
Dev Hub 和类似服务清单中的陈旧条目。它可能命中普通说明文字或无关 service 行，结果必须
人工分类，不能把每个命中都直接视为待删除代码。

清点结果必须覆盖而不限于：

- 根 `package.json`、Makefile、Lefthook 和 tsconfig paths；
- GitHub Actions、Docker ignore 和 Git ignore；
- `frontend/e2e/playwright.config.ts` 与 `frontend/e2e/tests`；
- Local Dev Hub；
- `ops/status/config.yaml` 与 `ops/status/config.local.yaml`；
- Gateway routing、upgrade 实现及测试；
- Frontend Core imports、exports 和 config；
- 文档、部署脚本和生成产物约定。

最终验收重复运行相同命令。剩余命中必须逐条分类为有效历史文字、Vinext 兼容 API 或明确
保留的非 Next 语义，不能只凭数量下降判断完成。

## 生成产物与忽略规则

清理仓库根部和 workspace 中散落的 `*.tsbuildinfo`，但不删除仍有效的统一 ignore 规则。
当前 `.gitignore` 已覆盖 `*.tsbuildinfo` 和 Playwright `output/`，实施时验证这些规则继续
生效即可。

Next 项目退场后，删除 `.gitignore`、`.dockerignore`、CI 和 workspace clean scripts 中的
`.next` 规则。TanStack 的 `.output`、`.tanstack`、`dist` 和 route tree 规则按各 workspace
实际产物边界保留。

## 实施顺序与 PR 边界

### PR 1：Dev Gateway 原地收敛并改名

在同一个 PR 内完成，避免产生 `gateway`/`dev-gateway` 双名和中间态：

1. 删除 Main、Dashboard、Next static 和 Next HMR 路由与对应测试。
2. 将剩余规则收敛到本地公共入口、dev assets、server functions 和 HMR。
3. 将 `infra/gateway` 原地改名为 `infra/dev-gateway`。
4. 同步 workspace package、根 scripts、Makefile、Dev Hub、测试和文档；Status 在本 PR
   只更新 Gateway -> Dev Gateway 相关条目，不删除 Main/Dashboard checks。

### PR 2：删除旧产品

1. 删除 `frontend/main` 和 `frontend/dashboard`。
2. 删除对应 Makefile、Lefthook、CI、E2E、Dev Hub、Main/Dashboard Status checks、资产同步
   和统计入口。
3. 删除旧域名、旧 API 和部署配置。
4. 清理 Landing 等存活 workspace 中遗留的 `.next` cache/clean 约定。

### PR 3：清理共享层和根依赖

1. 清理 Core 的 Next 专用模块。
2. 收敛 PlatformProvider，保留纯 routing 能力。
3. 删除根 Next 依赖和 Next scripts。
4. 重新生成锁文件并验证 `yarn why next`。
5. 清理 `.next` ignore 规则和散落的生成产物。

### PR 4：基础设施一致性与文档收尾

1. 补充 Edge Router 本地 Service Binding smoke。
2. 更新部署、本地开发、子应用、路由和历史迁移文档。
3. 重跑删除前清点命令并逐条关闭剩余项。

### 后续独立项目

将 Inspire Me 移入 `frontend` 并迁到 TanStack Start。

## 验收标准

- 不存在 `frontend/main` 和 `frontend/dashboard`；
- 不存在 `infra/gateway` 和 `@groupher/gateway`；
- 本地入口统一为 `infra/dev-gateway` 和 `@groupher/dev-gateway`；
- 不存在 Main、Dashboard、`dashboard.groupher.com` 和 `_next` 路由；
- `ops/status` 不再监控 Gateway、Main、Dashboard 或旧 Dashboard 域名；
- `frontend/e2e` 不再启动或测试 Main/Dashboard；
- Dev Gateway 的 routing/upgrade tests 不再包含 Next HMR/static 用例；
- 根 workspace 不依赖 `next`、`@next/bundle-analyzer` 或 Next config；
- `yarn why next` 无真实 Next.js package 依赖；
- 存活 workspace、CI、`.gitignore` 和 `.dockerignore` 不再包含 `.next` 产物约定；
- Core 不直接导入 Next runtime；
- Landing、Community、Dash、Apply、Auth、Press 和 Phoenix 可独立启动；
- `groupher.localhost` 的 Landing、Community、Auth、GraphQL 和 Press 路径正常；
- Dash、Apply 独立本地域名正常；
- Vite HMR 和 TanStack server functions 经 Dev Gateway 正常；
- Edge Router 本地 smoke 能连接 Landing、Community、Auth Service Bindings；
- route-contract、Edge Router、Dev Gateway 测试通过；
- 全仓 type-check 和相关 workspace build 通过；
- 删除前清点命令在最终验收时重复运行后无未分类命中；
- 旧架构文档已更新或明确标记为历史记录。

## 不在本轮实施

- 不保留 Main/Dashboard 兼容应用或旧域名重定向；
- 不让 Dev Gateway 进入生产部署或 Status 监控；
- 不将本地 HMR 规则加入生产 Edge Router；
- 不把 GraphQL、Auth 或 Phoenix 领域逻辑搬进路由层；
- 不在本轮顺带重写 Inspire Me。
