# Community：TanStack 版本的公共社区应用

> 状态：实施中；首个公共 Community vertical slice 已落地，后续按 Phase 2-6 扩展。
>
> Community 是 `frontend/main` 的 TanStack 版本，代码目录为 `frontend/community`。
> 现有 Main（Next.js）继续保留，
> 两者在验证期长期并行，不做原地迁移，也不因为 Community 存在而删除或重写
> `frontend/main`。

## 背景

`frontend/main` 是 Groupher 的公共社区应用，负责：

- 社区公共 shell、About、Post、Changelog、Kanban、Doc 和文章详情；
- 公共 SSR、SEO Metadata、Feed discovery links 和 not-found；
- 社区级 dashboard/theme/wallpaper 配置；
- 评论、登录用户交互、预览 Drawer 和 intercepted navigation；
- GraphQL public data、认证会话和按社区缓存失效。

现有 Main 的公共 URL 是稳定契约。注意裸 `/:community` 当前没有 page，实际为
404；Community 第一阶段保持这一行为，不自行增加“社区首页”或 redirect：

```text
/:community                  当前 404
/:community/about
/:community/post/...
/:community/changelog/...
/:community/kanban/...
/:community/doc/...
```

Next.js Main 可以继续承担现有线上流量，但其 App Router 模型在 Main 上带来
越来越高的边界成本：

```text
社区配置加载
  -> [community]/layout.tsx 阻塞
  -> Provider 初始化
  -> 页面和交互树可用

Preview
  -> parallel route
  -> intercepted route
  -> Next Router Cache
  -> 额外 browser-memory preview cache
  -> PreviewRuntime / PreviewHost 协调

Core 交互组件
  -> Server Component / Client Component 边界
  -> 大量 "use client"
  -> host-specific adapter
```

Community 的目标是用 TanStack Router/Start 重新表达同一套公共产品，而不是把
Dashboard/Dash 的两个应用合并。Dashboard 和 Dash 继续长期共存；Community 是第三
个独立 host。

## 决策

### 应用边界

```text
frontend/main       Next.js Main，现有线上应用，继续保留
frontend/community  TanStack Start Community，新公共社区应用
frontend/dashboard  Next.js Dashboard，继续保留
frontend/dash       TanStack Dash，继续保留
frontend/core       框架无关的共享产品和 UI 层
```

Community 不修改 Main 的公开实现，不把 Community 的 route tree 写回 Main，也不让
Core 直接依赖 TanStack Router。

### 与 Main 长期共存和非回归

Community 与 Main 的关系对齐 Dash/Dashboard：它们是同一公共产品的两个独立 host，
长期共存，不是“新项目一创建就开始替换旧项目”。

```text
frontend/main
  -> Next route tree / cache / preview / revalidation / production default

frontend/community
  -> TanStack route tree / cache / preview / revalidation / canary

frontend/core
  -> framework-neutral contract
     -> Main Next adapter
     -> Community TanStack adapter
```

非回归契约：

- Community 不删除、移动或重写 Main route、Next cache、Preview 或 revalidation；
- 两个应用拥有独立 workspace、route tree、构建产物、部署和回滚；
- Gateway 默认继续把生产流量交给 Main，Community 只通过独立 host/canary 明确切流；
- Community 未覆盖或发生故障时可直接回退 Main，不需要数据库迁移或重新构建 Main；
- 任何共享 Core 修改都必须保持 Next adapter 行为兼容，并同时验证 Main 与 Community；
- 在单独作出退役决策前，Main 不是临时兼容层，不能因 Community 已覆盖部分 route 而
  删除其功能。

### 目标运行模型

```text
getRouter（Community / Dash 各自的应用入口）
  -> 创建 request-local QueryClient
  -> 注入 Router context.queryClient
  -> setupRouterSsrQueryIntegration
  -> typed route params + validated search
  -> route loader 调 ensureQueryData
  -> component 调 useSuspenseQuery / useQuery
  -> 自动 SSR dehydration / hydration / streaming
```

`getRouter` 是应用自己的工厂函数；`QueryClient`、`ensureQueryData`、
`useSuspenseQuery` 和 `useQuery` 来自 `@tanstack/react-query`，route loader/context
来自 `@tanstack/react-router`，SSR 集成来自
`@tanstack/react-router-ssr-query`。SSR 与浏览器仍需要隔离的 QueryClient；官方集成
消除的是逐 route 手工 prefetch/dehydrate/hydrate 的胶水，不是请求隔离本身。

社区配置不再依赖 Next `[community]/layout.tsx` 的隐式阻塞，而由 `$community/route.tsx`
作为显式 parent layout 加载并向所有子页面提供：

```text
$community parent route
  -> loader.ensureQueryData(communityQuery)
  -> CommunityRuntimeProvider
      ├── community
      ├── dashboard
      ├── wallpaper
      ├── locale
      └── account/session（按页面需要）
  -> CommunityShell + Outlet
```

在同一 community 的子页面间导航时 parent route、RuntimeProvider 和 Shell 保持挂载；
切换 community slug 时使用新的 query key，并重建对应的社区 runtime。React 子组件从
CommunityRuntimeProvider 读取共享配置。TanStack Router 的 matched loaders 默认并行，
子 loader 不得假设 parent loader 已先完成；需要 community 数据时应调用同一个
`ensureQueryData(communityQuery)`，由 Query cache 复用或合并在途请求。只有子 loader
必须先取得配置才能构造自身请求时，才把这项依赖放进串行的 parent `beforeLoad`。

页面数据属于 leaf route；社区级配置属于 parent route；慢数据使用 streaming 或独立
route loader，不把所有页面数据合并成一个全局 bootstrap。完整 community 配置以
Query cache 为 server-state authority；parent loader 只额外返回 head 所需的精简投影，
避免 Router loader cache 和 Query cache 各维护一份完整配置。

## 可复用的 Dashboard/Dash 机制

### 可以直接复用的机制

- `frontend/core/platform` 的 `PlatformProvider`、`PlatformLink`、`TRouteTarget`
  和 host adapter 边界；
- `PlatformProvider` 继续只提供 `navi` 以及 Link、Image、Script 等客户端宿主能力；
- Core 不 import `@tanstack/react-router`，TanStack 依赖只进入 Community adapter；
- Dash 的 `createFileRoute`、`validateSearch`、`loaderDeps`、`beforeLoad`、
  `loader`、`head`、`pendingComponent`、`errorComponent` 约定；
- `CommunityBoundary` 的社区级 Provider 初始化方式；
- `CommunityBoundary` 使用 `key={community.slug}`，确保社区切换时不会复用旧
  社区 Store；
- `routeTree.gen.ts` 作为生成产物，业务代码不得手动编辑或依赖内部节点；
- server function / server route 的服务端数据边界；
- `auth.groupher.com` 和 `Domain=.groupher.com` 的现有认证契约；
- Dash 的 loader 并行加载、错误边界和 route-local search 类型化方式。

### 不能直接复制的部分

- 不复用 Dashboard 的 `/dashboard` 或 Dash 的 `/dash` route root；
- 不复用 DSB 专属的 `TRouteTarget` 语义来表达 Main 公共 URL；
- 不把 `DashboardShell`、SideMenu、Dashboard Store 或 DSB metric 带入 Community；
- 不把 Dashboard 的管理权限、demo mode 或 editor search 参数当成 Community 契约；
- 不因 Community 使用 TanStack 就把 Core 改成直接依赖 TanStack Router；
- 不把 Dashboard 的 `loadCommunity` 原样当成 Community 的完整 loader。Community 需要
  公共 reader 数据、SEO、feed alternate links、评论和预览专属的数据契约。
- 不复制 Dash 当前的 `loader raw data -> render 时 queryClient.setQueryData` 过渡桥接；
- 不复用 Main 的 `QueryProvider`、`Q.SSR`、route-local QueryClient、`dehydrate` 或
  `HydrationBoundary`；
- 不把 QueryClient、query invalidation 或 SSR 能力塞进 `PlatformProvider`。

### PlatformProvider 与 Query runtime 的边界

现有 Dashboard/Dash 共享机制保持不变：

```text
Core Dashboard UI
  -> PlatformProvider contract
      -> Dashboard Next adapter
      -> Dash TanStack adapter
```

Main/Community 按同一方式形成公开产品的两个 host：

```text
Core Community UI
  -> PlatformProvider contract
      -> Main Next adapter
      -> Community TanStack adapter
```

当前 `TRouteTarget`/resolver 只完整表达 DSB 语义，Dash adapter 还写入 `dash` root、
`resolveDsbRoute` 和 `isActiveDsbRoute`。Community 不直接复用这个 DSB adapter；Phase 1C
新增 `TCommunityRouteTarget` 与 `resolveCommunityRoute`，由 Main Next adapter 和
Community TanStack adapter 分别绑定到原生 router。Core 继续使用语义 Link；普通导航
不用 `navi.to()` 代替链接。

Platform 和 Query 是正交的两层：

```text
PlatformProvider
  -> React 客户端宿主能力
  -> Link / Image / Script / navigation

TanStack Query runtime
  -> Router 创建和 SSR 请求生命周期
  -> request-local QueryClient / loader context / hydration / streaming
```

`PlatformProvider` 是 client React context，不能成为 loader、head 或 server function 的
QueryClient 来源。Community/Dash 的 Query runtime 由 Router SSR integration 在应用根部
建立；PlatformProvider 在其下方提供宿主组件和导航。不要增加 `platform.queryClient`、
`platform.ensureQueryData` 或 `platform.invalidateQuery`。

```text
TanStack Router SSR Query integration
  -> QueryClientProvider
      -> Community/Dash TanStack PlatformProvider
          -> application runtime bridges
              -> $community parent layout / Outlet
```

## 兼容性原则

### URL 兼容

Community 必须覆盖 Main 当前已公开的 community-scoped URL。迁移期间采用：

```text
现有公开 URL
  -> Gateway / edge route
      -> Main（默认）
      -> Community（canary / 明确切流后）
```

Community 开发和验证使用独立 host 或本地 alias；最终是否使用
`community.groupher.com`、内部 canary host 或按路径切流，留到部署方案确认，不在
第一阶段改变 `groupher.com/:community/*` 的生产归属。

兼容要求：

- community、thread、article、doc 的 public ref 保持不变；
- 不把数据库 id 暴露为新的公共 URL；
- canonical URL、Open Graph URL、RSS/Atom/JSON Feed URL 保持一致；
- 直接访问详情 URL、刷新、复制链接和无 JS 请求都必须有明确行为；
- Community 未覆盖的 URL 继续由 Main 提供，不返回错误的 404。

### 数据和缓存兼容

```text
Main / Community
    -> 同一 Phoenix GraphQL schema
    -> 同一 public ref / community slug
    -> 同一 auth token / session contract
    -> 同一 backend mutation 与 cache invalidation 语义
```

Community 使用 TanStack 和 Cloudflare 的原生能力，不兼容或模拟 Next.js 的
`'use cache'`、`cacheLife`、`cacheTag`、`revalidateTag` API。需要迁移的是缓存效果和
失效语义，而不是 Next API。完整方案见
[`query_sync_cache.md`](./query_sync_cache.md)。

必须明确区分：

- request cache：单次 SSR 请求内的去重；
- server/public cache：社区和文章等跨请求缓存；
- router loader cache：浏览器会话内的 route data 复用；
- query cache：浏览器数据缓存、SSR dehydration 和 mutation 后的局部失效；
- CDN cache：Cloudflare 上跨请求、跨实例的公共响应缓存；
- Valtio/React context：页面交互状态和社区 runtime；TanStack Query 是 GraphQL
  server-state authority；
- preview snapshot：用于快速显示 Drawer 的轻量数据，不缓存 React tree。

### 认证兼容

- 复用现有 Auth host、cookie domain、token refresh 和 GraphQL auth header；
- public SSR 不把浏览器私有会话误加入可共享缓存；
- server function / server route 对私有数据逐个执行 auth 校验；
- 登录、评论、收藏、订阅和 mutation 成功后的 revalidation 先做到行为等价，
  再考虑优化请求数量。

### Core 兼容

```text
Core semantic contract
  -> Main Next adapter
  -> Community TanStack adapter
  -> Dashboard Next adapter
  -> Dash TanStack adapter
```

普通导航仍然使用语义链接；button 只用于状态改变、modal 控制和确认流程。
Community 不以迁移方便为理由把 `navi.to()` 扩散到 Core。

### Community/Dash 的 TanStack Query 基线

Community 和 Dash 使用同一种全新模式，但每个应用拥有自己的 Router 实例、SSR
QueryClient 和浏览器 QueryClient：

```text
Community / Dash getRouter
  -> createQueryClient
  -> createRouter({ context: { queryClient } })
  -> setupRouterSsrQueryIntegration({ router, queryClient })
  -> loader: context.queryClient.ensureQueryData(queryOptions)
  -> component: useSuspenseQuery(queryOptions) / useQuery(queryOptions)
```

统一约束：

- QueryClient 在 SSR 中按请求创建，禁止 Worker 全局 singleton；浏览器保持稳定实例；
- SSR 关键数据由 loader `ensureQueryData` 或 `useSuspenseQuery` 参与 SSR；纯客户端可选
  数据才使用普通 `useQuery`；
- query key、参数归一化、GraphQL document、domain adapter 和 mutation cache 更新规则可
  由 Core 共享，Router/SSR Provider 和 transport adapter 由 TanStack host 持有；
- `setupRouterSsrQueryIntegration` 默认拥有 `QueryClientProvider`。Community/Dash 的
  session、legacy event 和 mutation bridge 作为其下的独立 runtime bridge 重建，不复用
  或条件化现有 Next `QueryProvider`；
- Router 负责 URL、loader 调度、pending/error 和 preload；Query cache 负责 community、
  article、comments、viewer 等 server state；不得用两个互不一致的 `staleTime` 缓存同一
  份完整业务数据；
- 当 Query 决定数据 freshness 时，Router 的 preload freshness 设为 `0`，让 intent
  preload 触发 loader，再由 `ensureQueryData` 决定是否请求；
- Dashboard/Dash 配置 mutation 引发的跨应用更新仍走 Community 的签名 revalidation
  通道；浏览器 Query invalidation 不能替代 Cloudflare 跨请求失效。

#### 交付顺序：Dash-first，Community 后消费

“使用同一种模式”描述最终架构，不代表在同一个批次同时改造两个 host。Dash 已上线，
当前还存在 `loader raw data -> render 时 setQueryData` 桥接；Community 不得一边创建新
应用、一边把这项生产数据层迁移藏进同一 workstream。

```text
T0 冻结共同契约
  -> QueryClient policy / Router context / query options / Provider boundary

T1 Dash-first
  -> Dash 成为共享 runtime 的唯一首个消费者
  -> 独立迁移、回归、发布和生产观察

Gate D
  -> Dash parity、回滚和生产稳定性通过

T2 Community
  -> 消费 Gate D 后冻结的 runtime
  -> 不在同一交付批次继续修改 Dash 数据链路
```

Community 的 route inventory、Preview spike、Platform route target、Gateway、SEO 和缓存
契约可以与 T1 并行；Community 正式接入 Query runtime 必须等待 Gate D。Dash runtime
迁移与 Community 首次消费不得进入同一个 PR、发布批次或回归结论。

#### Workspace 依赖归属

当前 `@tanstack/react-query` 只由根 `package.json` 声明，Core 和 Dash 的直接 import
依赖 node-modules hoisting；`@tanstack/react-router-ssr-query` 尚未声明。新 runtime
落地前必须修正：

```text
frontend/core
  peerDependencies: @tanstack/react-query
  devDependencies:  @tanstack/react-query

frontend/dash
  dependencies: @tanstack/react-query
                @tanstack/react-router-ssr-query

frontend/community
  dependencies: @tanstack/react-query
                @tanstack/react-router
                @tanstack/react-start
                @tanstack/react-router-ssr-query
```

Core 提供 query keys/options/hooks/cache mutation，但 QueryClient 和 Provider 由 host
拥有，因此 React Query 是 peer contract；Core 的 devDependency 只服务独立 type-check
和测试。SSR Query integration 是 TanStack host 依赖，不进入 Core。所有 workspace 必须
能从自己的 manifest 完成 install/build/type-check，不把根 hoisting 当成依赖声明。
根 React Query 暂时保留，待所有真实消费者完成声明后再单独审计是否删除。

明确禁止在 Community/Dash 新链路中出现：

```text
route-local createQueryClient + dehydrate + HydrationBoundary
Q.SSR 或 Next server-only query option 分支
render 阶段 setQueryData 注入 loader data
兼容 Next 的 platform/framework 条件 Provider
Next 'use cache' / cacheTag / revalidateTag
```

## 路由和功能映射

### Community route tree 草案

```text
routes/
  __root.tsx
  $community/
    route.tsx                 community loader + runtime + Outlet
    about.tsx
    post/
      $id.tsx                 canonical detail
      _layout/                pathless list layout
        route.tsx             Post list loader/UI + Outlet，唯一 list background
        index.tsx             /post exact 空 leaf，不含 loader/list UI
        previewer/$id.tsx     preview Drawer，mask 为 post detail URL
    changelog/
      $id.tsx                 canonical detail
      _layout/                pathless list layout
        route.tsx             Changelog list loader/UI + Outlet，唯一 list background
        index.tsx             /changelog exact 空 leaf，不含 loader/list UI
        previewer/$id.tsx     preview Drawer，mask 为 changelog detail URL
    kanban/
      _layout/                pathless board layout
        route.tsx             Kanban loader/UI + Outlet，唯一 board background
        index.tsx             /kanban exact 空 leaf，不含 loader/board UI
        previewer/post/$id.tsx 跨 thread preview，mask 为 post detail URL
    doc/
      index.tsx
      $id/$slug.tsx
    $.tsx                     未知 thread 段的 not-found
```

这是逻辑 route tree，`_layout` 表示不进入公开 URL 的背景布局，最终文件名以
TanStack Router 的 file-route 规则和最小 spike 为准。这里明确
不创建 `$community/index.tsx`：裸 `/:community` 的 parity 是 404。Main 的
`[...thread]` 只是未知 thread 的 not-found 占位，不是 thread 解析器；Community
只需保留同等的兜底行为。

各自的 `_layout/route.tsx` 是背景数据和 UI 的唯一 owner：list/board
loader、query preload、search/filter state 和可滚动 UI 都在这里创建一次并持续挂载。
对应 `index.tsx` 只负责精确匹配 `/post`、`/changelog` 或 `/kanban`，不定义 loader、
不重复渲染背景，component 返回 `null`。不默认省略 index route；若要省略，必须先用
生成后的 route tree 和直接访问测试证明 parent layout 能独立完成 exact match。

### Preview

Preview 的首要产品契约不是“详情页上盖一个 Modal”，而是：

```text
打开前的 list / board 保持挂载
  + 保留列表数据、筛选条件和滚动位置
  + preview route 只在上层 Outlet 渲染 Drawer
  + route masking 显示 canonical detail URL
  + 关闭、back 后回到同一个 list / board 实例
```

Preview route 必须挂在 Post/Changelog list 或 Kanban board 的背景子树下，自行保留并
渲染背景；不得挂在 `$id` detail route 下，也不得以 detail 页面作为 Drawer 背景。
Canonical detail route 是独立 sibling，直接访问、刷新和复制 canonical URL 时渲染完整
详情页。

#### Drawer 实现契约

Community 不单独实现 preview Modal。Post、Changelog 和 Kanban → Post preview route
统一复用 `frontend/core/ui/@Drawer`，由 route 持有 Drawer shell，并在其中以
`isFullView` 渲染对应 ArticleViewer。这样位置、宽度、遮罩、页面锁、打开/关闭动画和
Main 使用同一套实现；禁止在 preview route 中重新使用 `fixed inset-0`、居中
`max-width` 容器或自定义 overlay 模拟 Drawer。

每次切换 preview 都必须用 `${thread}:${articleId}` 作为 Drawer `resetKey`，确保复用
Drawer 实例时正文滚动位置重置。关闭行为继续由共享 Drawer 在退出动画结束后执行
route back，不允许 preview route 提前卸载内容或自行复制一套关闭计时器。

所有能够打开 preview 的入口都必须经过 `~/platform` 导出的 Link/navigation adapter，
并通过类型化的 `previewId` 表达预览意图。Core 组件不能直接依赖 DOM `data-*` 协议；
Main adapter 会将 `previewId` 翻译为 PreviewHost 所需的 `data-preview-id`，Community
adapter 则用它生成 masked navigation。不能在具体卡片布局中直接调用 Router `push`，
否则会绕过 Community 的 route mask，退化成 canonical detail 整页跳转。该约束同样适用
于 Kanban 的 Classic Simple、Full 和 Waterfall 等布局。

Drawer 和内部 Modal 共用页面滚动锁时，每个组件只能释放自己获取的 lock。Modal 即使
处于隐藏状态或被卸载，也不能调用无归属的全局 unlock，否则会在 Drawer 打开动画后
意外恢复 body 滚动。共享 Modal 因此必须通过 `usePageLock` 的 ownership-safe
`lockPageOnce` / `unlockPageOnce` 管理锁。

2026-08-22 的真实浏览器回归覆盖了 Post、Changelog 和 Kanban → Post：三者均保持
masked canonical URL，使用右侧全高 Drawer 和共享进出动画；Drawer 展示及退出动画期间
body 持续锁定，切换文章时正文滚动位置重置。production build、Community contract、
类型检查和相关页面锁测试通过。共享 Drawer 仍由 preview route 按需加载，不进入
`/post` 初始 preload。

Masked preview 不覆盖背景页面的 head。Post、Changelog 和 Kanban preview route 不设置
article title、description、canonical 或 Open Graph；打开和切换 Drawer 时浏览器 title
保持 list/board 的 title。只有直接访问 canonical `$id` detail route 时才生成文章
metadata。

Masked navigation 还必须保持背景滚动。Community 若沿用 Dash 的
`scrollRestoration: true`，Router 会为新的 history location 记录并恢复 window/body
滚动；真实 preview route 即使被 mask 为 detail URL，仍是一次导航，不能假设背景组件
保持挂载就自然不会跳动。

最小 spike 先按 window-level scroll 验证 Post、Changelog 和 Kanban：

```text
记录打开前 window.scrollY
  -> 打开 preview
  -> 切换另一个 preview
  -> close / back / forward
  -> 每一步 window.scrollY 都不发生非预期变化
```

Preview Link/navigate 优先验证 `resetScroll: false`，关闭路径也必须覆盖；不要在未证明
必要前修改全局 `getScrollRestorationKey`。如果某个 list 改用自定义滚动容器，则不需要
处理 window restoration，但仍要证明容器实例、`scrollTop` 和虚拟列表 offset 保持，且
该容器没有被 `scrollToTopSelectors` 或 Drawer body-lock 间接重置。

现有 `frontend/main/src/app/[community]/_preview` 的 cache entry 设计可以在
第一阶段复用其数据契约和“缓存 snapshot、不缓存 React tree”的原则；但不应
机械复制 Next intercepted route 的实现。第一阶段先保证：

- preview 打开时背景仍是打开前的 list/board，组件实例和滚动位置不变；
- preview 打开、切换和关闭时 head/title 与 Main 一致，保持 list/board title；
- 首次打开 preview；
- 同一文章二次打开；
- 从 preview 返回；
- 直接访问详情 URL；
- 刷新和复制 URL；
- back/forward；
- preview loader 失败和 not-found；
- post 与 changelog 的行为一致；
- 从 Kanban 打开 Post preview，地址 mask 为 `/:community/post/:id`；
- Kanban → Post preview 的 back/forward、关闭返回 Kanban 和直接访问行为正确；
- preview 内部真实路径被直接访问时，按冻结后的契约返回 404 或 redirect 到 canonical
  详情页，不意外渲染一个无父上下文的 Drawer。

Kanban → Post 是跨 thread masking，不可当成 Kanban 自身的 `$id` 详情页。

### SEO 和 head

Community 需要为社区、文章、Changelog 和 Doc 建立显式 head contract：

- title、description、canonical、Open Graph、Twitter metadata；
- 社区 dashboard 中的 SEO 字段；
- 详情页面的 public article metadata；
- 404、not-found、redirect 的状态行为；
- Main 当前发布的 RSS、Atom、JSON Feed alternate links 保持 URL 不变；Feed 内容、
  headers、缓存与 thread-scoped Feed 仍完全由 Gateway/Press 负责。

Head 生成属于 route/host 层，不进入 Core product component。

### Community 机器入口与保留路径

只盘点 Community 自己需要承接或明确回退的非页面 HTTP 契约，不把 Press/Auth 的
服务能力纳入 Community 实施范围。

Phase 0 需要冻结：

```text
/api/utils/slugify            Main route；确认 Community 是否仍有相对调用方
/api/graphql                  Main route；Community GraphQL proxy parity
/api/widgets/v1               Main route；确认 Community/Core 是否仍有相对调用方
/health                       Community 自己的健康检查
/api/revalidate/community     Main/Next 专属；保留回退，不在 Community 复刻
/internal/cache/revalidate    Community 自己的签名失效入口
/.well-known/*                保留路径；不得路由为 community slug
```

`frontend/main/src/app/.well-known/[...path]/route.ts` 当前对 GET 返回 `200 ok`，用于避免
Next `[community]` 把 `.well-known` 识别为社区并报 community not-found。Community 不
默认复制这个 route；首选由 Gateway 排除 `/.well-known/*`，或在 Community root
matcher/beforeLoad 中拒绝把保留段识别为 `$community`。只有实际部署验证要求 Community
host 响应验证请求时，才增加显式 route。

以下入口不属于 Community，不进入 Community body/header parity matrix：

```text
/:community/feed.xml
/:community/feed.atom
/:community/feed.json
/:community/:thread/feed.xml
community-scoped sitemap / llms 等 Press 输出
/.well-known/jwks.json        Auth service
/robots.txt                   Main 根级静态文件，Community 不承接
/sitemap.xml                  Main 遗留根级静态文件，Community 不承接
```

Feed 的 URL、内容、headers、缓存和可用性由 Gateway/Press 测试负责。Community 只验证
自己页面 head 中原本存在的 community-level alternate links，不实现或测试 Feed route。

## 实施步骤

### Phase 0：冻结契约和基线

以下结论已经在 Main/Backend review 中核实，是 Phase 0 的审计起点，不应重新作为未知
问题从零调查：

| 已核实结论                                                                       | 证据                                                                                   | Community 处理                                                            |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `[community]` 下没有 `page.tsx`，裸 `/:community` 当前为 404                     | `frontend/main/src/app/[community]`                                                    | 保持 parity，不自行增加首页或 redirect                                    |
| `/:community/about` 是公开页面                                                   | `frontend/main/src/app/[community]/about/page.tsx`                                     | 建立 typed public route                                                   |
| `[...thread]` 只是未知 thread 的 not-found 占位                                  | `frontend/main/src/app/[community]/[...thread]/page.tsx`                               | 建立未知 thread 兜底，不实现虚构的 thread resolver                        |
| `/.well-known/[...path]` 的 GET 返回 `200 ok`，用于避免被 `[community]` 当作社区 | `frontend/main/src/app/.well-known/[...path]/route.ts`                                 | 首选 Gateway/root matcher 排除保留段，不默认复制 route                    |
| Community GraphQL 的 `inc_views` 默认值是 `true`                                 | `backend/main/lib/groupher_server_web/schema/cms/cms_queries.ex`                       | 冻结目标计数语义，不能把“未显式传参”解释成 false                          |
| Community Reader 默认执行 views increment                                        | `backend/main/lib/groupher_server/cms/communities/reader.ex`                           | 明确 cache miss 与 community views 的现状关系                             |
| Article detail read 调用 `Interactions.record_view`                              | `backend/main/lib/groupher_server/cms/articles/reader.ex`                              | 明确 detail cache hit/miss 与 view event 的现状关系                       |
| Post/Changelog preview 背景是保持挂载的 list；Kanban 跨 thread preview 到 Post   | `frontend/main/src/app/[community]/{post,changelog,kanban}/layout.tsx` 与 `@previewer` | 用 list/board pathless parent + masked Drawer 保持同等行为                |
| Intercepted preview 不生成 article metadata                                      | `frontend/main/src/app/[community]/{post,changelog}/@previewer/(.)[id]/page.tsx`       | Masked 状态保持 list/board head；canonical detail 才生成 article metadata |
| Community、thread Feed 与 community sitemap/llms 由 Gateway/Press 提供           | `backend/gateway/src/routing.ts`、`backend/press/src/app.ts`                           | 不实现或测试 Press response；只保持页面已有 alternate links               |
| 根级 `/robots.txt` 和遗留 `/sitemap.xml` 是 Main 静态文件                        | `frontend/main/public/robots.txt`、`frontend/main/public/sitemap.xml`                  | Community 不承接，保持既有路由归属                                        |
| `/api/revalidate/community` 是 Main 的 Next tag 失效入口                         | `frontend/main/src/app/api/revalidate/community/route.ts`                              | 不复刻 Next API；Community 使用独立签名 revalidation endpoint             |

Phase 0 inventory 在此基础上补齐尚未确认的 URL、headers、调用方、部署规则和边界条件，
并在实现期间持续更新这张表。

当前 Main public inventory 已对照 route tree 复核：

```text
/:community/about
/:community/post              /:community/post/:id
/:community/changelog         /:community/changelog/:id
/:community/kanban            /:community/doc  /:community/doc/:id/:slug
/.well-known/*                /health
/api/graphql                  /api/utils/slugify
/api/widgets/v1               /api/revalidate/community
```

Community 自己承接 `/health`、`/api/graphql`、`/api/utils/slugify` 和
`/internal/cache/revalidate`；Widget、Feed、sitemap、llms 和 Auth `.well-known` 继续
由既有服务或 Gateway/Press 归属，Community 不复制它们的业务实现。

- [x] 建立 `frontend/community` package、`@groupher/frontend-community` workspace、端口、local alias 和启动方式；
- [x] 记录 Main 当前完整 public route inventory；
- [x] 明确记录裸 `/:community` 为 404、`/:community/about` 为公开页面，未知 thread
      catch-all 为 not-found 占位；
- [x] 盘点 slugify、GraphQL proxy、Widget、health 和 Community revalidation 等
      Community-owned/relative-call 入口；Main-only API 保持明确回退；
- [x] 在 Gateway 或 Community root matcher 冻结 `/.well-known/*` 等保留段，证明它们
      不会进入 `$community` loader；
- [ ] Feed、thread Feed、sitemap 和 llms 保持由 Gateway/Press 独立测试，不列入
      Community response parity；Community 只核对现有 feed alternate links；
- [ ] 根级 `/robots.txt`（含 `Disallow: /blockhole`）和遗留 `/sitemap.xml` 继续由
      Gateway/Main/既有静态资源归属承接，Community 不实现、不重复审计；
- [x] 记录每类 route 的 SSR、SEO、auth、cache、preview 和 not-found 要求；
- [x] 冻结 locale 来源：parity 阶段保持 Main 当前的 `LOCALE.EN`；cookie、
      `Accept-Language` 或社区 locale 属于后续增强；
- [x] 冻结 views 的真实触发点：Main community query 未显式传 `incViews`，GraphQL
      默认 `true`，因此源查询/cache miss 会增加 community views；文章详情通过
      `CMS.Articles.read -> Interactions.record_view` 记 view event，同样受详情 cache
      命中影响；不得把 `cacheInvalidation.ts` 的 `View` regex 当成客户端 View mutation
      已存在的证据；
- [x] 记录 Main 当前构建产物、列表/详情页 JS、TTFB、LCP 和 dev RSS 基线；
- [x] 决定 Community 的首个 host，不改变生产 `groupher.com` route ownership；
- [x] 确认 TanStack Start 版本、Vite/Rsbuild 选择和部署 runtime。

### Phase 1A：冻结 Query runtime 与依赖契约

- [x] 冻结 Community/Dash 共用的 QueryClient policy、Router context 类型、query options
      规范、SSR Query integration 和 runtime bridge 边界；生产发布观察仍单独走 Gate D；
- [x] Core 把 `@tanstack/react-query` 声明为 peerDependency，并提供独立检查所需的
      devDependency；
- [x] Dash 显式声明 `@tanstack/react-query` 和
      `@tanstack/react-router-ssr-query` 为直接依赖，不依赖根 hoisting；
- [x] 冻结兼容当前 Router/Start 版本的 SSR Query integration 版本并更新 lockfile；
- [ ] 明确 Dash-first 的 PR、发布、回滚和生产观察边界；Community 首次消费属于后续
      独立交付。

### Phase 1B：Dash-first 迁移与 Gate D

- [x] Dash `getRouter` 创建 request-local QueryClient、注入 Router context，并安装
      `setupRouterSsrQueryIntegration`；
- [x] Dash loaders 改用 `ensureQueryData`，组件使用 `useSuspenseQuery`/`useQuery`；
- [x] 删除 Dash 的 render-time `setQueryData` 桥接和 DashboardShell 内重复
      `QueryProvider`，不修改 Dashboard 的 Next runtime；
- [ ] 独立验证 Dash SSR、自动 hydration、无重复首屏请求、intent preload、auth/private
      response、mutation invalidation、error/not-found 和 route back/forward；
- [ ] Dash build、type-check、route generation 和生产 Cloudflare 部署通过；
- [ ] 验证可回滚到迁移前 Dash 构建，并完成约定的生产观察窗口；
- [ ] Gate D 通过后冻结共享 runtime；未通过时 Community 不接入该 runtime。

### Phase 1C：创建 Community host 并消费冻结 runtime

- [x] 创建 Community 的 TanStack Start/Vite 基础应用；
- [x] 在 Community workspace 显式声明 `@tanstack/react-query`、
      `@tanstack/react-router`、`@tanstack/react-start` 和
      `@tanstack/react-router-ssr-query`；
- [x] 接入 React、Core、GraphQL、auth、现有 asset contract 和独立 Query runtime；本批次
      不继续修改 Dash 数据链路；Gate D 的生产证据仍是发布门；
- [x] 建立 Community TanStack `PlatformProvider` adapter，只绑定 navigation、Link、
      Image 和 Script，不承载 QueryClient；
- [x] 为 Main/Community 公共 URL 建立 `TCommunityRouteTarget` 和
      `resolveCommunityRoute`，保留现有 DSB target/resolver；
- [x] 让 Main Next adapter 与 Community TanStack adapter 分别绑定同一套公开语义
      target，不把 TanStack Router import 带入 Core；
- [x] Community 新建自己的 runtime bridge，不复用或修改 Main 的 `QueryProvider`；
- [x] 配置 root document、CSS、theme pre-paint、Script 和 image adapter；
- [x] 建立 error、not-found、pending 和 server entry boundary；
- [x] 生成 route tree，并把生成文件排除在手工业务修改之外；
- [x] 将 `generate:routes` 作为 `type-check` 前置步骤，沿用 Dash 的生成契约。

### 当前已落地切片（2026-08-21）

以下内容已经在当前工作区实现并通过本地验证；它们是第一批 vertical slice 的已交付部分，
不代表后续 Phase 2-6 已完成：

- [x] 建立 `frontend/community` workspace、独立端口 `3007`、local alias、TanStack Start
      server entry、Cloudflare 配置和健康检查入口；
- [x] 建立独立的 Community router/runtime：request-local QueryClient、typed Router
      context、`setupRouterSsrQueryIntegration`、route generation、pending/error/not-found
      boundary；
- [x] 建立 `TCommunityRouteTarget`、`resolveCommunityRoute`，并让 Main Next adapter 与
      Community TanStack adapter 各自绑定同一套公开语义；Core 不 import TanStack Router；
- [x] 保持裸 `/:community`、`/.well-known/*` 为 not-found/保留路径，不进入 Community
      loader；建立 `/:community/about`、post list、canonical detail 和 masked preview；
- [x] 接入 public community/post GraphQL reader、theme、wallpaper、locale、Article/Comment
      Query seed 和 `CommunityBoundary`，完成 auth-independent reader 首屏；
- [x] Dash 已先接入同一 SSR Query integration，移除其 render-time Query cache bridge 和
      DashboardShell 内重复 QueryProvider；Community 在此基础上独立消费，不复用 Main runtime；
- [x] 完成 Community type-check、lint、format、production build、dev health/404 smoke，
      并完成 Core test suite、Main/Dash/Core type-check；

仍待发布门完成的范围包括 runtime 全函数 inventory（tag stats、doc cover 等长尾数据）、
Main/Community 全路由 parity、Cloudflare purge secret/zone 配置、真实 canary URL、生产
RSS/延迟/错误率观测和回滚观察窗口；Feed/Press 继续由其既有服务负责，不进入 Community
实现。

### Phase 2：社区 Runtime 和 SSR

- [ ] 以 `frontend/core/app/ssr/runtime.ts` 的公开函数为迁移清单，逐函数建立
      Community server boundary 和缓存等价物；
- [x] 在 `$community/route.tsx` 通过 `ensureQueryData(communityQuery)` 加载 community、
      dashboard、wallpaper、locale 和必要 session，并建立 parent layout；
- [x] 建立 `CommunityBoundary`/`CommunityRuntimeProvider`，按 community slug 重建 Store，
      在同社区子 route 间保持挂载；
- [x] 子 loader 需要 community 配置时调用同一 query 复用/合并请求，不依赖 parent
      loader 完成顺序；只有必须串行的请求构造依赖才进入 parent `beforeLoad`；
- [x] parent loader 仅额外返回 head projection，完整配置以 Query cache 为 authority；
- [x] 将 ThemePreset、Wallpaper、locale、account、GraphQL transport adapter 和新的
      TanStack runtime bridges 接入；不复用 Main 的 GraphQL/Query Provider 组合；
- [x] 验证缓存边界不会把用户私有状态写入公共缓存；
- [x] 带 cookie 或 viewer-specific 数据的 SSR 明确使用私有且不缓存的响应 header；
      公开响应不得混入 viewer state；
- [x] 落地 [`query_sync_cache.md`](./query_sync_cache.md) 定义的 Dashboard → Community
      主动失效链路；
- [x] 为 community shell 和文章详情冻结明确的 Query `staleTime`/`gcTime`；Router
      preload freshness 设为 `0`，不得用浏览器 freshness 掩盖 CDN 或源数据过期；
- [x] 用 post list 验证 loader `ensureQueryData`、component `useSuspenseQuery`、intent
      preload 和自动 SSR hydration；不得出现手工 HydrationBoundary 或 render-time
      `setQueryData`；
- [x] 实现社区公共 shell，并保持裸 `/:community` 返回 404；
- [x] 为依赖 loader data 的 `head` 定义 loader 未完成、失败和 not-found 时的退化输出。

### Phase 3：先迁移公共内容主链路

建议顺序：

1. community shell、裸 `/:community` 404 与 `about`；
2. post list/detail；
3. changelog list/detail；
4. kanban public view；
5. doc public tree/detail；
6. comments、login、reaction、subscription 等 reader interaction。

每个 thread 必须同时完成：

- typed params/search；
- loader 和缓存依赖；
- SSR 直接访问；
- head/SEO；
- loading/error/not-found；
- Core platform navigation；
- GraphQL query/mutation；
- community query 与 article detail 的 view side effect 按 Phase 0 冻结结果实现；
- 现有 public URL 回归。

### Phase 4：Preview 和交互完整性

- [ ] 首先验证打开 preview 后原 list/board 组件保持挂载，筛选、数据和滚动位置不变；
- [ ] 在 `scrollRestoration: true` 下验证打开、切换、关闭、back/forward preview 时
      window-level `scrollY` 不被重置；自定义滚动容器则验证实例和 `scrollTop` 不变；
- [ ] spike 验证 preview 的 Link/navigate/close 路径使用 `resetScroll: false` 是否足够，
      不先全局改写 `getScrollRestorationKey`；
- [x] 通过 Community contract 检查验证 list/board loader 和 UI 只由 pathless parent 创建，
      exact index 是无 loader、无背景 UI 的空 leaf；
- [x] 通过 Community contract 检查验证 masked preview 不提供 article metadata；直接访问
      internal preview path 时 redirect 到 canonical detail，合法 masked navigation 通过
      `maskedLocation` 保持 list/board 背景；浏览器滚动/回退行为仍需真实数据环境回归；
- [x] 实现 post preview route mask 和 Drawer；
- [x] 实现 changelog preview route mask 和 Drawer；
- [x] 实现 Kanban → Post 的跨 thread preview route mask 和 Drawer；
- [x] 三类 preview route 统一复用 Core `@Drawer`，禁止自建居中 Modal；
- [x] Kanban 各卡片布局通过 PlatformLink 进入 masked preview，不直接 Router push；
- [x] 修复共享 Modal 对 Drawer page lock 的越权释放，并补充 ownership 回归测试；
- [ ] 复用现有 preview snapshot contract，但不复用 Next route lifecycle；
- [ ] 覆盖 cache hit、cache miss、live、error、back/forward 和 refresh；
- [ ] 验证 preview 不会导致完整 community runtime 重建；
- [ ] 验证浏览器内存 cache 有明确 TTL 和清理策略。

### Phase 5：认证和读者交互

- [x] 接入 Auth session、token refresh 和跨 host cookie 行为；
- [x] 接入 comments、reaction、subscribe、bookmark 等交互；
- [x] 对每个 server function/server route 执行服务端 auth 校验；
- [x] mutation 成功后执行正确的 GraphQL/公共缓存失效；
- [x] Dashboard/Main/Dash 配置 mutation 已接入 Community revalidation endpoint；真实
      community/theme/wallpaper/SEO 无需等待 TTL 的结果需 production Phoenix/Cloudflare
      环境确认；
- [ ] 验证登录失效、重试、redirect、返回原 route 和跨 host 行为。

### Phase 6：并行验证和逐步切流

当前代码与本地验证已形成可重复基线，见 [`community_baseline.md`](./community_baseline.md)。
生产域名、Cloudflare purge secret/zone、canary 流量和真实并发观测仍是发布门，不能由
本地 build 或 dev smoke 代替。

- [x] 记录 Community client/server bundle、压缩体积、health 和保留路径的本地基线；

- [ ] Main 与 Community 对同一 community/route 输出 parity matrix；
- [ ] 明确记录 detail 页相关文章的 preview workspace 行为：首次打开创建一个 Drawer
      history entry，Drawer 内 Tab 切换不改 URL、不新增 history，浏览器 Back 直接回到
      list/board；Main 与 Community 最终遵循同一产品契约，详见
      [`detail_preview.md`](./detail_preview.md)；
- [ ] 每个共享 Core 修改同时执行 Main 与 Community 的 type-check、关键 route 和
      Preview 回归；Main 的 URL、SSR、cache、revalidation 和 bundle entry 不变；
- [ ] 比较 HTML、head、canonical、HTTP status、GraphQL 请求和 URL；
- [ ] 比较 Community-owned API 的 body、status、`Content-Type`、`Cache-Control`、
      `Vary`、CORS 和认证行为；Press/Auth 由各自服务矩阵验证；
- [ ] 比较 about、post、doc、changelog 的 client bundle 和压缩传输大小；
- [ ] 比较 dev RSS、production SSR RSS、SSR 峰值和并发下 RSS；
- [ ] 比较 TTFB、FCP、LCP、hydration 和 preview open latency；
- [ ] 先使用独立 canary host 或明确用户范围切流；
- [ ] Community 未覆盖的 route 继续回退到 Main；
- [ ] 验证 Community 故障或撤销 canary 时可直接恢复 Main 流量，不需要数据迁移或
      重新构建 Main；
- [ ] 只有 parity、性能、错误率和部署回滚均通过后，才扩大流量。

## 验收矩阵

| 范围        | Community 必须证明的结果                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| URL         | 旧 public URL 可直接访问、刷新、分享和回退                                                                                          |
| SSR         | HTML、status、not-found、redirect 和 head 正确                                                                                      |
| 社区        | community 配置、theme、wallpaper、locale 不串社区                                                                                   |
| 缓存        | public、router、GraphQL、session、preview snapshot 边界清晰                                                                         |
| Preview     | list/board 背景实例和滚动保持；首次打开、缓存命中、返回、刷新、back/forward 正确                                                    |
| 认证        | 登录、token refresh、评论和 reader mutation 行为等价                                                                                |
| Core        | Core 不 import TanStack，Main、Dashboard、Dash 现有行为不变                                                                         |
| Platform    | Main/Community 与 Dashboard/Dash 均通过 PlatformProvider 绑定原生 Link、Image、Script 和 navigation；Query 不进入 Platform contract |
| Query       | Dash 先独立迁移、发布并通过 Gate D；Community 后续消费冻结的同一 Router Query SSR 模式，两个 host 不在同一批次切换数据链路          |
| 依赖        | Core peer 与 Dash/Community direct dependencies 完整；各 workspace 不依赖根 hoisting 即可解析、type-check 和 build                  |
| Main 非回归 | Community 和共享 Core 修改不改变 Main 的 URL、SSR、Preview、cache、revalidation、bundle entry 与生产路由归属                        |
| 性能        | bundle、hydration、preview latency、RSS 有同口径基线对比                                                                            |
| 部署        | canary、健康检查、日志、回滚和真实 URL 已验证                                                                                       |

## 暂不做

- 不删除或大规模重构 `frontend/main`；
- 不合并 Dashboard/Dash/Community route tree；
- 不把 Community 的 TanStack API 暴露给 Core；
- 不因为迁移而更换 Phoenix GraphQL schema、public ref 或 auth contract；
- 不迁移 Press 的 feed/sitemap/llms 或 Auth `.well-known` 能力；
- 不用“空 loading”掩盖社区配置或 preview loader 的实际错误；
- 不用单一 bundle 数字或 dev 内存数字宣布迁移成功。

## 第一批交付定义

Community 第一批不是完整替换 Main，而是一个可独立验证的公共 vertical slice：

```text
一个真实 community
  -> community SSR/runtime
  -> about + bare-community 404
  -> post list/detail
  -> post preview
  -> public head/404
  -> auth-independent reader flow
  -> bundle/RSS/latency 基线
```

只有这一批证明了 URL、社区初始化、SSR、preview、缓存和 Core host 边界，才进入
Changelog、Doc、Kanban 和登录交互的扩展迁移。
