# Dash 路由和域迁移

> 历史迁移设计：文中的 Next Dashboard、旧域名和共存状态用于说明硬切换前的输入；
> 当前只保留 `frontend/dash` 与 `dash.groupher.com`，不提供旧入口兼容。

## 状态

本文档定义了新 TanStack Dash 和旧版 Next.js Dashboard 的目标 URL
合约。这是一次不保留旧入口的硬切换设计，而不是声明当前的路由树
已经实现了目标。

这两个应用程序将继续独立共存。此次迁移不删除任一应用程序，
但不再兼容旧的主域 Dash/Dashboard 入口。

## 决定

应用程序由主机识别。路径只标识社区以及该应用程序内的页面。

| 应用      | 运行时         | 生产 origin                      | 本地 origin                            |
| --------- | -------------- | -------------------------------- | -------------------------------------- |
| Dash      | TanStack Start | `https://dash.groupher.com`      | `https://dash.groupher.localhost`      |
| Dashboard | Next.js        | `https://dashboard.groupher.com` | `https://dashboard.groupher.localhost` |

规范的路由形状是：

```text
https://<application-host>/<community>/<section...>
```

示例：

```text
Dash overview:       https://dash.groupher.com/home/overview
Dashboard overview:  https://dashboard.groupher.com/home

https://dash.groupher.com/home/doc/editor
https://dashboard.groupher.com/home/doc/editor
```

两个应用的 overview 路径不对称，这是有意的路由树结果：

- Dash 当前的 `frontend/dash/src/routes/$community/dash/overview.tsx`
  上移后是 `/$community/overview`，即
  `dash.groupher.com/<community>/overview`；
- Dashboard 当前的 `frontend/dashboard/src/app/[community]/dashboard/page.tsx`
  上移后是 `frontend/dashboard/src/app/[community]/page.tsx`，即
  `dashboard.groupher.com/<community>`。

因此，`DSB_ROUTES.overview = createSection('')` 不能直接代表两个应用
相同的最终 URL。Core 可以继续表达 overview intent，但 Dash 和 Dashboard
adapter 必须分别生成 `/overview` 与空 section；不得用同一个
`rootSegment` 假设两边路径相同。

`/dash` 和 `/dashboard` 不保留在各自的规范路径中。主机已经表达了
该应用程序边界，因此路径中的应用程序名称是多余的。

## 当前和目标路由

```text
Current                                         Target
groupher.com/<community>/dash/<section...>      dash.groupher.com/<community>/<section...>
groupher.com/<community>/dashboard/<section...> dashboard.groupher.com/<community>/<section...>
```

等效的本地目标是：

```text
dash.groupher.localhost/<community>/<section...>
dashboard.groupher.localhost/<community>/<section...>
```

本地开发必须保留与生产相同的主机和路径语义。
端口和上游地址保留本地背后的实现细节
网关，并且不能成为规范的浏览器 URL。

## 路由所有权

目标应用程序拥有的路由树是：

```text
frontend/dash       /$community/*
frontend/dashboard  /[community]/*
```

浏览器 URL、SSR 请求 URL、路由器路由 ID、生成的链接以及表单或
服务器函数返回 URL 必须同意此形状。网关不得使
应用程序似乎通过默默地修剪 `/dash` 拥有不同的路径或
`/dashboard` 在代理之前。这会创建两个路由标识并导致 SSR
和水合位置的分歧。

每个应用程序主机拥有其所有应用程序路由：

```text
dash.groupher.com/*       -> Dash upstream
dashboard.groupher.com/*  -> Dashboard upstream
```

健康检查可能仍然是应用程序主机端点，例如 `/health`，但它们
是操作端点而不是用户导航路由。

## 旧版路径废弃

不保留主域上的旧版 Dash/Dashboard 入口。以下路径迁移后必须直接
返回 404，不得 308、透明重写或代理到新应用程序主机：

这是有意的硬切换决策：不维护旧书签、历史外链和搜索引擎历史索引的
兼容链路，接受这些链接失效，避免长期保留两套路由语义、让旧入口
继续被误认为受支持的产品入口。

```text
https://groupher.com/<community>/dash/<rest>?<query>
  -> 404

https://groupher.com/<community>/dashboard/<rest>?<query>
  -> 404
```

新应用程序主机只接受自身的规范路径。Dash 的 overview 是
`dash.groupher.com/<community>/overview`；Dashboard 的 overview 是
`dashboard.groupher.com/<community>`。因此，
`dashboard.groupher.com/<community>/overview` 不属于本次目标路由，
不得作为兼容别名实现。

`groupher.com/health/dash` 也不再作为 Dash 的兼容健康入口。运维检查
直接请求 `https://dash.groupher.com/health`。

## 身份验证和 Cookies

域分割必须保留 Auth 边界：

- Auth 在 `auth.groupher.com` 上拥有其仅主机浏览器 Session。
- 短暂的 Phoenix 访问 Cookie 在 `Domain=.groupher.com` 处共享，因此
  它可用于两个应用程序子域。
- Gateway、GraphQL 和 SSR 转发继续仅转发已批准的
  访问代币合约。
- OAuth 返回 URL、登录恢复、注销、刷新、CORS 允许列表和 CSRF
  origin 检查只需要识别两个规范应用程序 origin 以及 Auth 自身 origin。

域迁移不得扩大仅主机 Auth Session Cookie 或移动
从 Phoenix 移走授权权限。

`SERVICE_AUTH_RESOURCES_JSON` 描述的是服务 API audience，不是浏览器入口。
当前 `backend/auth/wrangler.jsonc` 中的 `dashboard.groupher.com/scheduler`
只应在 Dash 实际拥有对应服务 API 时扩展；不能仅因为新增
`dash.groupher.com` 浏览器主机就盲目增加 Dash resource。

## 端到端变更清单

这是跨两个应用程序和两个路由层的规范 URL 迁移。仅更改 Dev Hub
链接、DNS 或网关路径匹配是不够的。

### Dash: TanStack Start

Dash 目前拥有 `/$community/dash/*` 下的原生路由。应用
必须直接拥有 `/$community/*`。

实施包括：

- 将基于文件的路由层次结构移出`$community/dash/`；
- 将 `frontend/dash/src/routes/$community/index.tsx:6` 当前指向
  `/$community/dash` 的 redirect 改为 `/$community/overview`，与 Dash
  overview 的目标路径保持一致；
- 更改每个 `createFileRoute`、类型化 `Link`、`navigate`、重定向、默认
  路由、面包屑、选项卡路由和包含 `/dash` 的深层链接 helper；
- 从新的原生路由树重新生成 `frontend/dash/src/routeTree.gen.ts`；
- 更新 SSR 请求处理、服务器功能 URL、身份验证恢复 URL 和
  测试使用相同的浏览器可见路径；和
- 将本地 Vite HMR 所有权从共享 `groupher.localhost` 主机更改为
  `dash.groupher.localhost`。网关不得剥离 `/dash` 后再把不同的路径发送给
  Dash。服务器请求、TanStack 路由 ID、水合位置和浏览器 URL 必须全部
  对齐到 `/<community>/<section...>`；overview 使用
  `/<community>/overview`。

### Dashboard：Next.js

Dashboard 目前拥有其 App Router 层次结构
`src/app/[community]/dashboard/**`。相反，它必须拥有
直接`src/app/[community]/**`。

实施包括：

- 移动 Next.js 布局、页面、加载/错误边界和本地路由
  `dashboard` 目录段之外的助手；
- 将 `frontend/dashboard/src/app/[community]/dashboard/page.tsx` 的 overview
  合并到 `frontend/dashboard/src/app/[community]/page.tsx`。该文件已经存在
  （当前是 `Community served` 占位页），不能直接移动后覆盖，必须明确合并
  或替换；迁移后的 Dashboard overview 是 `/<community>`，不是
  `/<community>/overview`；
- 更新生成的导航、SSR 帮助程序、重定向、面包屑、编辑器
  并导入恢复 URL 和其他深层链接；
- 验证路由本地 API、并行路由、缓存行为和部署
  目录移动后的输出；和
- 更新 Dashboard 路由并构建测试以使用规范主机路径。

Dashboard 当前使用 `assetPrefix: '/dashboard'` 命名空间 Next static
资产和 HMR，同时与其他应用程序共享网关主机。一个
专用 `dashboard.groupher.com` 主机不再需要该命名空间
所有权。删除资产前缀是后续候选方案，但不应该
耦合到用户路由迁移，除非静态资产和 HMR 发生变化
独立验证。静态资源实现路径可以继续由框架内部决定，但不得把旧的
用户路由 `/<community>/dashboard/*` 重新暴露为浏览器入口。

### 共享前端导航

共享 Core 和应用程序适配器必须停止通过
字符串替换。每个路由生成器必须区分：

```text
application + community + application-local path
```

受影响的表面包括路由常量、侧边菜单、面包屑、选项卡、
平台导航适配器、社区管理入口按钮、文档
编辑器和导入恢复、窗口小部件弹出/iframe/链接 URL 以及身份验证
返回路径。

Core 应保持框架中立的路由意图。 Dash 和 Dashboard 平台
适配器应该生成自己的规范 origin 和路径。新应用
代码不得生成主域遗留路由，也不得生成包含 `/dash` 或 `/dashboard`
的应用程序规范路径。

迁移时必须显式检查以下共享导航和 URL producer：

- `frontend/core/platform/route.ts`：`resolveDsbRoute`、`TDsbRouteRootSegment`、
  `parseDsbPathname` 和 `DSB_ALLOWED_SEARCH_KEYS`；
- `frontend/main/src/platform/nextPlatform.tsx`、
  `frontend/landing/app/platform/NextPlatformProvider.tsx`、
  `frontend/dashboard/src/platform/nextPlatform.tsx`、
  `frontend/dashboard/src/platform/Link.tsx`、
  `frontend/dash/src/platform/tanStackPlatform.tsx` 和
  `frontend/dash/src/platform/Link.tsx`；
- `frontend/core/hooks/useDsbTabs/index.ts`、
  `frontend/core/hooks/useDsbCrumbItems/index.ts`、
  `frontend/core/unit/DashboardThread/SideMenu/SubMenu.tsx` 和
  `frontend/core/unit/DashboardThread/CMS/Docs/Editor/SideTree/useDocEditorUrl.ts`；
- `frontend/core/constant/route.ts` 的 `DSB_ROUTE`、
  `frontend/core/unit/DashboardCovers/index.tsx`（直接用
  `joinPath(slug, seg)` 生成路径）、
  `frontend/core/unit/PostThread/UniBar/MorePanel.tsx`、
  `frontend/landing/app/widgets/Landing/index.tsx`；以及
- `frontend/core/unit/TagSettingEditor/index.tsx:148` 的硬编码
  `/dashboard/home/<appearance>` 路径。该路径当前已经与社区/应用程序段顺序不一致，
  迁移时必须一并修复。

### Node Gateway

网关已识别两个应用程序主机，并具有单独的 Dash/Dashboard upstream
origin。主机路由仍然是主要规则：

```text
Host: dash.groupher.com       -> Dash upstream, path preserved
Host: dashboard.groupher.com  -> Dashboard upstream, path preserved
```

主 Groupher 主机上的旧路径优先规则必须删除。它们不再是应用程序
代理或重定向匹配：

```text
/<community>/dash/<rest>       -> 404
/<community>/dashboard/<rest>  -> 404
```

Gateway因此工作包括：

- 删除旧路径到应用程序主机的重定向和透明代理；
- 为旧路径定义明确的 404 行为；
- 更新基于Referer的静态资产和服务器功能所有权；
- 更新 HTTP 代理、WebSocket/HMR、转发主机和负匹配测试；
  和
- 确保包含单词 `dash` 或 `dashboard` 的不相关路径不会
  成为重定向。

### Cloudflare Main-站点边缘路由器

生产 `groupher.com` 的 Landing Cloudflare Worker 也有路由逻辑。
其当前的 Dash 和 Dashboard 路径代理必须删除，并与 Node Gateway
保持一致地返回 404。

Node Gateway 和 Cloudflare 边缘路由器必须共享同一个主域负匹配
合同：旧路径返回 404，规范子域按 Host 直接转发且保持路径。

### 静态资产、HMR、服务器功能和 API

专用应用程序主机必须拥有其运行时资源以及其
HTML 路由：

- Dash Vite 依赖项、公共资产、TanStack 服务器功能，以及
  `__dash_hmr` 属于 `dash.groupher.com` 及其等效的 `.localhost`。
- Dashboard Next 资产/HMR 和 Dashboard 拥有的 API 属于
  `dashboard.groupher.com` 及其等效的 `.localhost`。
- 基于引用的路由是模糊开发资产的兼容性辅助工具
  URL，而不是规范应用程序所有权的 origin。
- Dashboard 拥有的 API 路径（例如内容导入和重新验证）必须是
  路由迁移后从 Dashboard origin 进行测试。

### Auth 和浏览器 origin

Cookie 拓扑已经支持应用程序子域，但所有具体 origin 策略
必须审核和测试：

- Auth 批准的 origin 和认证 CORS；
- CSRF origin 验证；
- OAuth 回调 return URL 验证；
- Session探测、刷新、注销和登录恢复；
- CSP 和浏览器 API 端点白名单；和
- E2E/冒烟测试环境变量。

从一个 `groupher.com` 浏览器 origin 迁移到两个应用程序子域，
意味着应用程序不能依赖共享 origin 的 `BroadcastChannel`
交叉表状态。规范的 Auth Session 探测焦点、可见性、进入
受保护的路由或身份验证失败仍然是跨域恢复
机制。

### Dev Hub 和本地 Gateway

Dev Hub 必须打开：

```text
Dash       https://dash.groupher.localhost/<community>/<section...>
Dashboard  https://dashboard.groupher.localhost/<community>/<section...>
```

其直接健康 URL 可能仍为 `https://<application>.groupher.localhost/health`。
服务定义、browser metrics origin、流标签、服务测试、
本地网关主机规则、TLS 覆盖范围和 HMR 测试必须一起更新。
直接端口是上游实现细节，不得显示为
规范的应用程序链接。

具体需要核对：

- `local/dev-hub/src/server/services.ts` 和 `services.test.ts` 的
  `portlessAppUrl`、`appUrl`、browser metrics origin；Dash 当前仍使用
  `https://groupher.localhost/home/dash/overview`，且 `appUrl` 端口与服务
  端口不一致；
- `Makefile:49,52` 的 `NEXT_PUBLIC_SITE_URL`，Auth target 的 `AUTH_URL`，
  `frontend/dashboard/.env.development`、`.env.example` 和
  `frontend/dash/.env.example`；
- `frontend/dash/app.config.ts`、共享 Next dev origins、Gateway host
  配置和 TLS/Portless host 解析；
- `backend/assets-hub/src/app.ts`、`backend/assets-hub/.env.example` 以及
  Dev Hub 中的 `ASSETS_HUB_CORS_ORIGIN`，必须允许 Dash canonical origin；
- `infra/gateway/.env.example` 必须包含 `DASH_SITE`；运行时默认值可以
  保留，但模板不能遗漏该覆盖项。
- `ops/status/config.yaml:232-249` 的 `Dash Public Route` 检查必须删除，
  或改为直查 `https://dash.groupher.com/health`；
  `config.yaml:143-164` 已经直查 Dash 的检查不受影响。

## 测试和验收数据

测试必须验证 canonical host/path，同时验证旧主域入口直接 404。需要更新
或新增的高信号用例包括：

- `frontend/core/platform/route.test.ts`；
- `frontend/core/lib/auth/login-request.test.ts` 和
  `frontend/core/ui/AuthLoginModal/index.test.tsx`；
- `frontend/e2e/tests/dash/smoke.spec.ts`、
  `frontend/e2e/tests/dashboard/smoke.spec.ts` 和
  `frontend/e2e/tests/auth/auth-v1.spec.ts`；
- `frontend/e2e/playwright.config.ts`：Dashboard 和 Dash 都使用各自的
  canonical `.localhost` host + port，不能使用裸 `localhost` 作为浏览器
  canonical URL；
- `infra/gateway/src/routing.test.ts`、`app.test.ts` 和 `upgrade.test.ts`；
- `infra/edge-router/src/index.test.ts` 和 `packages/route-contract/src/index.test.ts`，
  包括旧主域路径和 `/health/dash` 的 404；
- `ops/status/config.yaml:232-249` 的 `Dash Public Route` 检查，必须与
  `https://dash.groupher.com/health` 保持一致，避免继续请求已废弃的
  `https://groupher.com/health/dash` 并触发 Discord 告警；
- `frontend/core/lib/oauth.test.ts`、`frontend/core/lib/signal.test.ts` 和
  `backend/auth/redirect-url.test.ts`；以及
- `scripts/smoke-auth-v1.sh`：`AUTH_SMOKE_APPROVED_ORIGIN` 必须使用
  canonical Dash origin。

## 部署和 DNS

目标生产域已存在于存储库配置中。 Dash
将 `dash.groupher.com` 声明为 Cloudflare Worker 自定义域，而
网关和边缘路由配置已使用 `dashboard.groupher.com` 和
`dash.groupher.com` 作为单独的 upstream origin。

2026-08-10实时只读验证发现：

```text
dash.groupher.com
  DNS resolves through Cloudflare
  GET /health -> 200, server: cloudflare

dashboard.groupher.com
  DNS resolves to the Vercel edge
  GET /health -> 200, server: Vercel
```

因此，迁移当前不需要创建主机名，
将 Dashboard 远离 Vercel，或将 Dash 远离 Cloudflare。确实如此
需要将更改的应用程序和路由行为部署到现有的
origin：

- 将本机 Dash 路由树部署到现有的 Cloudflare Worker 自定义
  域；
- 将本机 Dashboard 路由树部署到现有的 Vercel 项目/域；
- 删除 `groupher.com` Cloudflare 边缘路由器中的旧版代理/重定向匹配，
  并部署明确的 404；
- 将匹配行为部署到本地/Node网关；和
- 重新验证 DNS、证书、自定义域所有权、部署环境
  变量以及推出时的真实公共 URL。

DNS 和平台绑定是外部状态。存储库配置和
上述注明日期的验证不得被视为永久证明
Cloudflare 和 Vercel 帐户设置不变。

## 迁移范围

实施必须将以下内容视为一项协调的合同变更：

1. 将原生 Dash 路由树从 `/$community/dash/*` 更改为
   `/$community/*`。
2. 将本机 Dashboard 路由树从 `/[community]/dashboard/*` 更改为
   `/[community]/*`。
3. 更新应用程序导航、路由常量、面包屑、重定向和
   用于生成规范子域 URL 的深层链接。
4. 更新 Gateway 和边缘路由，以便每个应用程序主机拥有其完整路径
   空间，并让 `groupher.com` 上的两个旧版路径系列直接 404。
5. 更新 Vite/Next 静态资产、HMR、服务器功能、API 路由和基于 Referer
   的所有权，无需重新引入隐藏路径修剪。
6. 更新 Auth return-URL 验证、CORS/CSRF origin、browser metrics origin、
   Dev Hub 链接、环境变量、部署域和文档。
7. 始终保持 Dash 和 Dashboard 独立部署和回滚安全
   迁移。

## 推出

迁移的交付顺序应避免出现以下情况：
规范主机及其应用程序对路径存在分歧：

```text
阶段 1：canonical origin 准备
  为两个 canonical origin 准备 Auth/CORS/return URL 支持
  覆盖 canonical 路由和 legacy 404 的应用与基础设施测试

阶段 2：canonical 应用路由
  将原生 Dash 路由部署到 dash.groupher.com
  将原生 Dashboard 路由部署到 dashboard.groupher.com
  验证 SSR、水合、资产、HMR、API、Auth 和深层链接

阶段 3：URL producer 和本地工具
  切换共享导航和应用生成的 URL
  切换 Dev Hub 链接和 browser metrics origin
  验证对应的 `.localhost` 路由

阶段 4：删除 legacy 路径
  删除 groupher.com 的 legacy proxy/redirect matching
  部署匹配的 Node Gateway 和 Cloudflare edge 404 行为
  验证真实生产 404，并在需要时独立回滚
```

应用程序内部不得保留兼容性路由。旧书签和旧主域入口不再受到支持；
新代码也不得生成旧的主域 Dashboard 或 Dash URL。

## 验收标准

- `dash.groupher.com/<community>/*` 仅渲染 TanStack Dash。
- `dashboard.groupher.com/<community>/*` 仅渲染 Next.js Dashboard。
- 等效的 `.localhost` URL 在本地开发中的行为方式相同。
- 规范应用程序 URL 均不包含 `/dash` 或 `/dashboard`
  社区段之后的路径部分。
- 旧的 `groupher.com/<community>/dash/*` 和
  `groupher.com/<community>/dashboard/*` 直接返回 404，不执行重定向或代理。
- 直接导航、SSR HTML、水合、客户端导航、刷新、静态
  资产、HMR、服务器功能、身份验证恢复和注销工作
  两个应用程序主机。
- 共享访问 Cookie 在两个应用程序子域上均可用，而
  Auth Session 在 `auth.groupher.com` 上仅保留主机。
- Dev Hub 为每项服务打开规范的 `.localhost` 应用程序 URL。
- 没有新的应用程序代码生成旧的主域路由系列。
- Node Gateway 和 Cloudflare 边缘路由对旧路径产生等效的 404 结果。
- 现有的 Cloudflare 和 Vercel 自定义域绑定和证书是
  在部署期间重新验证，而不是从存储库配置中假设。

## 非目标

- 删除旧的 Dashboard 应用程序。
- 使 Dash 和 Dashboard 共享运行时或部署。
- 将公共社区内容移离`groupher.com/<community>/*`。
- 为旧版主域 Dash/Dashboard 路径提供兼容入口。
- 更改 Phoenix 授权所有权或 Auth Session 模型。
- 保留 `/dash` 或 `/dashboard` 作为新版本上的规范路径命名空间
  应用程序主机。
