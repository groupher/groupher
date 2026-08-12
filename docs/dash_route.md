# Dash 路由和域迁移

## 状态

本文档定义了新 TanStack Dash 的目标 URL 合约以及
旧版Next.jsDashboard。这是一个迁移设计，而不是声明
当前的路由树已经实现了目标。

这两个应用程序将继续共存。此次迁移并不意味着
从 Dashboard 切换到 Dash 或删除任一应用程序。

## 决定

应用程序由主机识别。该路径标识社区
以及该应用程序内的页面。

| 应用      | 运行时        | 生产产地                         | 本地产地                               |
| --------- | ------------- | -------------------------------- | -------------------------------------- |
| Dash      | TanStack 开始 | `https://dash.groupher.com`      | `https://dash.groupher.localhost`      |
| Dashboard | Next.js       | `https://dashboard.groupher.com` | `https://dashboard.groupher.localhost` |

规范的路线形状是：

```text
https://<application-host>/<community>/<section...>
```

示例：

```text
https://dash.groupher.com/home/overview
https://dash.groupher.com/home/doc/editor

https://dashboard.groupher.com/home/overview
https://dashboard.groupher.com/home/doc/editor
```

`/dash` 和 `/dashboard` 不保留在各自的规范中
路径。主机已经表达了该应用程序边界，因此重复
路径中的应用程序名称是多余的。

## 当前和目标路线

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

浏览器URL、SSR请求URL、路由器路由ID、生成的链接以及表单或
服务器函数返回 URL 必须同意此形状。网关不得使
应用程序似乎通过默默地修剪 `/dash` 拥有不同的路径或
`/dashboard` 在代理之前。这会创建两个路线标识和风险 SSR
和水合作用的分歧。

每个应用程序主机拥有其所有应用程序路由：

```text
dash.groupher.com/*       -> Dash upstream
dashboard.groupher.com/*  -> Dashboard upstream
```

健康检查可能仍然是应用程序主机端点，例如 `/health`，但它们
是操作端点而不是用户导航路线。

## 旧版重定向

现有的路径优先 URL 仍然是迁移输入，而不是规范别名。
他们应该发布永久重定向，同时保护社区，保留
路径和查询字符串：

```text
https://groupher.com/<community>/dash/<rest>?<query>
  -> 308 https://dash.groupher.com/<community>/<rest>?<query>

https://groupher.com/<community>/dashboard/<rest>?<query>
  -> 308 https://dashboard.groupher.com/<community>/<rest>?<query>
```

重定向优于透明重写，因为它们建立了一个
可见规范 URL 并防止服务器和客户端路由器观察
不同的路径。重定向行为必须显式定义空剩余情况；
例如，应用程序可以将其社区根重定向到`overview`。

## 身份验证和 Cookies

域分割必须保留 Auth 边界：

- Auth 在 `auth.groupher.com` 上拥有其仅主机浏览器 Session。
- 短暂的 Phoenix 访问 Cookie 在 `Domain=.groupher.com` 处共享，因此
  它可用于两个应用程序子域。
- Gateway、GraphQL 和 SSR 转发继续仅转发已批准的
  访问代币合约。
- OAuth 返回 URL、登录恢复、注销、刷新、CORS 允许列表和 CSRF
  来源检查必须识别两个规范应用程序来源。

域迁移不得扩大仅主机 Auth Session Cookie 或移动
授权权限来自Phoenix。

## 端到端变更清单

这是跨两个应用程序和两个路由的规范 URL 迁移
层。仅更改 Dev Hub 链接、DNS 或网关路径匹配是不行的
足够了。

### Dash: TanStack 开始

Dash目前拥有`/$community/dash/*`下的本地路线。应用
必须直接拥有 `/$community/*`。

实施包括：

- 将基于文件的路由层次结构移出`$community/dash/`；
- 更改每个`createFileRoute`，输入`Link`，`navigate`，重定向，默认
  路由、面包屑、选项卡路由和包含 `/dash` 的深层链接帮助器；
- 从新的本地树重新生成`frontend/dash/src/routeTree.gen.ts`；
- 更新 SSR 请求处理、服务器功能 URL、身份验证恢复 URL 和
  测试使用相同的浏览器可见路径；和
- 将本地 Vite HMR 所有权从共享 `groupher.localhost` 主机更改为
  `dash.groupher.localhost`。网关不得剥离 `/dash` 然后发送不同的路径到 Dash。的
  服务器请求、TanStack路线ID、水合位置和浏览器URL必须全部
  是`/<community>/<section...>`。

### Dashboard：Next.js

Dashboard 目前拥有其 App Router 层次结构
`src/app/[community]/dashboard/**`。相反，它必须拥有
直接`src/app/[community]/**`。

实施包括：

- 移动 Next.js 布局、页面、加载/错误边界和本地路由
  `dashboard` 目录段之外的助手；
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
独立验证。第一迁移阶段可能会保留
`/dashboard/_next/*`作为实现URL。

### 共享前端导航

共享 Core 和应用程序适配器必须停止通过
字符串替换。每个路线制作者必须区分：

```text
application + community + application-local path
```

受影响的表面包括路线常量、侧面菜单、面包屑、选项卡、
平台导航适配器、社区管理入口按钮、文档
编辑器和导入恢复、窗口小部件弹出/iframe/链接 URL 以及身份验证
返回路径。

Core 应保持框架中立的路线意图。 Dash 和 Dashboard 平台
适配器应该生成自己的规范来源和路径。新申请
代码不得生成任何主域遗留路由系列。

### Node Gateway

网关已识别两个应用程序主机并具有单独的 Dash 和
Dashboard上游起源。主机路由仍然是主要规则：

```text
Host: dash.groupher.com       -> Dash upstream, path preserved
Host: dashboard.groupher.com  -> Dashboard upstream, path preserved
```

主 Groupher 主机上的路径优先规则必须更改语义。他们是
当前应用程序代理匹配；迁移后它们成为规范
重定向匹配：

```text
/<community>/dash/<rest>       -> 308 Dash canonical URL
/<community>/dashboard/<rest>  -> 308 Dashboard canonical URL
```

Gateway因此工作包括：

- 将主机拥有的代理路由与传统路径重定向路由分开；
- 添加显式重定向结果，而不是将重定向伪装成
  上游代理目标；
- 保留查询字符串并定义空休息/默认页面行为；
- 更新基于Referer的静态资产和服务器功能所有权；
- 更新 HTTP 代理、WebSocket/HMR、转发主机和负匹配测试；
  和
- 确保包含单词 `dash` 或 `dashboard` 的不相关路径不会
  成为重定向。

### Cloudflare Main-站点边缘路由器

生产`groupher.com`在着陆Cloudflare中也有路由逻辑
工人。其当前的 Dash 和 Dashboard 路径将代理与其上游匹配。
它们必须发出与 Node 网关相同的 308 重定向。

Node 网关和 Cloudflare 边缘路由器是相同的两个实现
公共路线合同。它们的重定向状态、目标路径、查询处理、
空休息行为，负匹配必须保持一致，以便本地和
生产导航不会发散。

### 静态资产、HMR、服务器功能和 API

专用应用程序主机必须拥有其运行时资源以及其
HTML 路由：

- Dash Vite 依赖项、公共资产、TanStack 服务器功能，以及
  `__dash_hmr` 属于 `dash.groupher.com` 及其等效的 `.localhost`。
- Dashboard下一个资产/HMR和Dashboard拥有的API属于
  `dashboard.groupher.com` 及其等效的 `.localhost`。
- 基于引用的路由是模糊开发资产的兼容性辅助工具
  URL，而不是规范应用程序所有权的来源。
- Dashboard 拥有的 API 路径（例如内容导入和重新验证）必须是
  路由迁移后从 Dashboard 原点进行测试。### Auth 和 Browser 起源

Cookie 拓扑已经支持应用程序子域，但所有确切的
必须对原产地政策进行审核和测试：

- Auth 批准的来源和认证 CORS；
- CSRF 来源验证；
- OAuth回调返回-URL验证；
- Session探测、刷新、注销和登录恢复；
- CSP 和浏览器 API 端点白名单；和
- E2E/冒烟测试环境变量。

还从一个 `groupher.com` 浏览器源迁移到两个应用程序子域
意味着应用程序不能依赖共享源 `BroadcastChannel`
交叉表状态。规范的 Auth Session 探测焦点、可见性、进入
受保护的路由或身份验证失败仍然是跨域恢复
机制。

### 开发中心和本地 Gateway

开发中心必须打开：

```text
Dash       https://dash.groupher.localhost/<community>/<section...>
Dashboard  https://dashboard.groupher.localhost/<community>/<section...>
```

其直接健康 URL 可能仍为 `https://<application>.groupher.localhost/health`。
服务定义、浏览器指标来源、流标签、服务测试、
本地网关主机规则、TLS 覆盖范围和 HMR 测试必须一起更新。
直接端口是上游实现细节，不得显示为
规范的应用程序链接。

## 部署和 DNS

目标生产域已存在于存储库配置中。 Dash
将 `dash.groupher.com` 声明为 Cloudflare Worker 自定义域，而
网关和边缘路由配置已使用 `dashboard.groupher.com` 和
`dash.groupher.com` 作为单独的上游来源。

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
起源：

- 将本机 Dash 路由树部署到现有的 Cloudflare Worker 自定义
  域；
- 将本机 Dashboard 路由树部署到现有的 Vercel 项目/域；
- 将旧版重定向部署到 `groupher.com` Cloudflare 边缘路由器；
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
3. 更新应用程序导航、路线常量、面包屑、重定向和
   用于生成规范子域 URL 的深层链接。
4. 更新 Gateway 和边缘路由，以便每个应用程序主机拥有其完整路径
   空间，并在 `groupher.com` 上添加两个旧版 308 重定向系列。
   5.更新Vite/下一个静态资产、HMR、服务器功能、API路由和请求
   基于引用者的所有权，无需重新引入隐藏路径修剪。
5. 更新 Auth return-URL 验证、CORS/CSRF 来源、浏览器度量来源、
   开发中心链接、环境变量、部署域和文档。
6. 始终保持Dash和Dashboard独立部署和回滚安全
   迁移。

## 兼容性和推出

迁移的交付顺序应避免出现以下情况：
规范主机及其应用程序对路径存在分歧：

```text
Phase 1: compatibility preparation
  Auth/CORS/return-URL support for both canonical origins
  application and infrastructure tests for both route families

Phase 2: canonical application routes
  deploy native Dash routes to dash.groupher.com
  deploy native Dashboard routes to dashboard.groupher.com
  verify SSR, hydration, assets, HMR, APIs, Auth, and deep links

Phase 3: producers and local tooling
  switch shared navigation and application-generated URLs
  switch Dev Hub links and browser-metric origins
  verify the equivalent .localhost routes

Phase 4: canonical redirects
  change groupher.com legacy paths from proxy to query-preserving 308
  deploy matching Node Gateway and Cloudflare edge behavior
  verify real production redirects and rollback independently if required
```

如果应用程序内部暂时需要兼容性路由，它们
必须重定向到规范路径而不是渲染第二个副本
页。旧书签可能仍然通过网关重定向受到支持，但新书签
代码不得生成旧的主域 Dashboard 或 Dash URL。## 验收标准

- `dash.groupher.com/<community>/*` 仅渲染 TanStack Dash。
- `dashboard.groupher.com/<community>/*` 仅渲染 Next.js Dashboard。
- 等效的 `.localhost` URL 在本地开发中的行为方式相同。
- 规范应用程序 URL 均不包含 `/dash` 或 `/dashboard`
  社区部分。
- 旧的 `groupher.com/<community>/dash/*` 和
  `groupher.com/<community>/dashboard/*` 问题保留查询 308 重定向到
  相应的应用程序主机。
- 直接导航、SSR HTML、水合作用、客户端导航、刷新、静态
  资产、HMR、服务器功能、身份验证恢复和注销工作
  两个应用程序主机。
- 共享访问 Cookie 在两个应用程序子域上均可用，而
  Auth Session 在 `auth.groupher.com` 上仅保留主机。
- Dev Hub 为每项服务打开规范的 `.localhost` 应用程序 URL。
- 没有新的应用程序代码生成旧的主域路由系列。
- Node Gateway 和 Cloudflare 边缘路由产生等效的重定向结果。
- 现有的 Cloudflare 和 Vercel 自定义域绑定和证书是
  在部署期间重新验证，而不是从存储库配置中假设。

## 非目标

- 删除旧的 Dashboard 应用程序。
- 使 Dash 和 Dashboard 共享运行时或部署。
- 将公共社区内容移离`groupher.com/<community>/*`。
- 更改 Phoenix 授权所有权或 Auth Session 型号。
- 保留 `/dash` 或 `/dashboard` 作为新版本上的规范路径命名空间
  应用程序主机。
