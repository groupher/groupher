# Frontend Routing Cleanup V2

> 状态：V2 实施完成（2026-08-27）
>
> 说明：第 2 节保留实施前残留结构快照；当前架构以代码和第 8 节验收结果为准。
>
> 前置条件：`frontend/main`、`frontend/dashboard` 和真实 Next.js runtime 已完成退场；
> Landing、Community、Dash、Apply、Inspire Me 均已使用 TanStack Start/Vite。
>
> 目标：删除为 Next/TanStack 共存而建立的前端 routing compatibility layer，让共享前端
> 直接使用 TanStack Router，同时保留产品 URL、Community preview 和跨应用导航合同。

V1 的 Next.js、旧项目、Gateway 和基础设施清理记录继续保存在
[`infra/clean_up.md`](./clean_up.md)。V2 不重新打开已经完成的 Main/Dashboard 兼容问题。

## 1. 背景与结论

当前 `frontend/core/platform` 的主要设计前提是：同一批 Core UI 需要同时运行在 Next.js
和 TanStack Router 中，因此 Core 不能直接依赖任一 router runtime，而要通过
`RouteScopeProvider` 注入导航、位置、图片和脚本能力。

这个前提已经失效。当前正式前端统一使用 TanStack Start/Vite：

```text
frontend/landing
frontend/community
frontend/dash
frontend/apply
frontend/inspire-me
```

继续保留 framework-neutral adapter 会产生额外的协议面和转发路径：

```text
Core Link / navigation hook
  -> RouteScope Context
    -> per-app TanStack adapter
      -> TanStack Router
```

曾经发生、现已修复的 Community post preview 回归已经证明这层转发存在实际成本：
`Link` 的 `href` 分支一度没有把 `previewId` 传给 `navi.push`，导致本应打开 drawer 的点击
直接进入文章详情页。当前 `Link.tsx` 已同步传递该字段；这里记录的是架构证据，而不是
尚未修复的现状。问题并非 TanStack Router 自身导致，而是兼容协议容易遗漏产品导航语义。

V2 的结论是：

- 删除 Next/TanStack runtime adapter 和额外的 React route context；
- Core 可以正式依赖 `@tanstack/react-router`；
- 共享组件直接使用 TanStack Router 的 Link、location、navigate、preload 和 invalidate；
- 产品路径 resolver、search 规则和 preview mask 继续保留，但不再命名为 platform
  compatibility；
- 跨应用导航仍必须走完整文档请求，由 Edge Router 或 Dev Gateway 重新选择目标应用。

### Core 边界原则

V2 明确改变旧的 framework-neutral 原则：

```text
旧原则
  Core 不知道 Next.js 或 TanStack Router
  -> 由 Platform/RouteScope adapter 注入 runtime

V2 原则
  Core 知道并直接使用 TanStack Router runtime
  Core 不知道任一具体应用的 generated route tree
  Core 不知道 Edge Router、Dev Gateway 或 Cloudflare runtime 实现
```

需要保留的是 app-route-tree neutrality 和 infrastructure neutrality，不再保留已经失去
消费者的 framework neutrality：

- Core 可以声明并导入 `@tanstack/react-router`；
- Core 可以使用 TanStack `Link`、hooks、route mask、preload 和 invalidate；
- Core 不能静态导入 Community、Dash、Landing、Apply 或 Inspire Me 的 `routeTree.gen.ts`；
- Core Link 不能把某个应用的 TanStack `to` union 暴露为共享公开 API；
- Core 可以保留与生成 route tree 无关的产品 route targets/resolvers；
- Core 不能感知 Service Binding、Worker upstream、Portless 或 proxy 选择逻辑。

因此“删除兼容层”不意味着 Core 再次成为 framework-agnostic，而是让 Core 明确绑定仓库
唯一前端 router，同时继续隔离具体应用和基础设施实现。

Core 与所有宿主应用必须解析到同一版本、同一 runtime 实例的
`@tanstack/react-router`。Core 内部的 `useLocation()` 等 hooks 读取宿主
`RouterProvider` 建立的 React context；如果 Core 与应用加载了不同 package 副本，即使
版本兼容，也会读到不同 context。约束如下：

- Core 将 `@tanstack/react-router` 的 peer/dev dependency 都声明为与宿主 exact pin 一致的
  `1.170.21`；仓库升级 Router 时统一修改 Core 和所有宿主；
- Landing、Community、Dash、Apply 等宿主提供同一个统一版本；
- workspace 安装和 bundler 不得产生第二份 Router runtime；
- Vite 出现重复解析风险时，通过统一 alias 或 `resolve.dedupe` 收敛
  `@tanstack/react-router`，并同时保持 React/React DOM 单实例；
- Core 未来独立发布时仍由宿主提供 Router runtime，不把它打包进 Core 产物。

## 2. 当前残留结构

### Route Scope

当前共享 contract 位于：

```text
frontend/core/platform/context.tsx
frontend/core/platform/navigation.ts
frontend/core/platform/Link.tsx
frontend/core/platform/route.ts
```

应用侧存在四套注入实现：

```text
frontend/dash/src/platform/tanStackPlatform.tsx
frontend/landing/src/platform/TanStackRouteScopeProvider.tsx
frontend/community/src/platform/communityPlatform.tsx
frontend/apply/src/platform/ApplyRouteScopeProvider.tsx
```

Dash 与 Landing 的 provider 当前基本相同；Apply 维护另一份较宽松的实现；Community
主要因为 preview route mask 保留特殊分支。每个应用又要在 `routes/__root.tsx` 挂载一次
provider。

迁移面包括 RouteScope、Core Link、navigation hooks、`NextImage` 别名和 platform
`Script` consumers。文件数会随工作区变化，V2 不把一次人工统计写成固定事实；第 7 节
提供固定扫描口径，实施前保存文件列表，最终验收重复运行相同命令。

### Next-shaped UI API

`frontend/core/platform/Image.tsx` 已经只渲染原生 `<img>`，但仍接受 Next Image 风格的：

- 对象形式 `src`；
- `fill`；
- `priority`；
- `unoptimized`。

`frontend/core/platform/Script.tsx` 已不依赖 Next runtime，但仍使用：

- `beforeInteractive`；
- `afterInteractive`；
- `lazyOnload`。

其中 `beforeInteractive` 与 `afterInteractive` 当前都在 React effect 中插入脚本，实际不具备
“交互前加载”的差异。它们不能继续作为看似兼容、实则不同语义的 API 保留。

## 3. 不应删除的能力

删除 compatibility layer 不等于删除所有 `platform` 目录中的代码。以下是产品能力或部署
合同，必须迁移后保留。

### 产品 URL resolver

以下能力与 React framework 无关：

- `dsbRoutes` 和 Dsb typed route targets；
- Community typed route targets；
- `resolveDsbRoute`、`resolveCommunityRoute`；
- search schema、search allowlist 和 `preserveSearch`；
- Dsb 和 Community 各自的 active route 判断；
- 仍有活跃消费者的 pathname parser 和 editor URL helpers。

`frontend/core/lib/route.ts` 是 Next 时代遗留 parser。其 11 个导出当前没有活跃消费者，
文件内部函数互调不构成外部依赖；`ArticleEditor/logic.ts` 只剩一条已注释的旧 import。
该文件不属于应迁移能力，PR 4 直接删除。不能因为本节保留“仍被使用的 helper”而迁移
零消费者代码。

它们应迁移到明确的 `routes` 边界，例如：

```text
frontend/core/routes/dsb.ts
frontend/core/routes/community.ts
frontend/core/routes/search.ts
```

最终目录可以按实施时的依赖关系调整，但不再使用 `platform` 表达“支持多个 framework”。

### Community preview

Community 的 preview 是产品导航合同：

```text
visible URL: /:community/post/:id
matched route: /:community/post/previewer/:id
presentation: drawer over the mounted list
```

Post、Changelog 和 Kanban 都需要保留 canonical URL mask。当前生产 UI 中有 11 个文件、
12 处 `previewId` JSX 使用：PostItem 5 处、Changelog 2 处、Kanban 3 处、ArticleCard 2 处。
这些使用全部位于 Core，adapter 删除后不能反向导入 `frontend/community`，也不应由
Community route 逐层 prop drilling。`frontend/core/platform/Link.test.tsx` 另有 2 处测试
使用，属于 Link 测试重写清单，不计入生产 UI consumers。

现有实现应按职责拆分：

```text
frontend/core/routes/community-preview.ts
  纯 pathname/mask resolver
  从当前 list context + canonical href + preview id 生成 resolved mask

frontend/community/src/utils/preview-route.ts
  isCanonicalPreviewNavigation
  requireCanonicalPreviewMask
  Community route loader/redirect guard
```

当前 `resolveCommunityPreviewPath` 随 `resolveCommunityRoute` 一起迁入 Core 产品路由层并加固
为 `resolveCommunityPreviewMask`。这不违反 app-route-tree neutrality：Core 已经持有
Community URL 产品结构，但仍不导入 Community generated route tree。

最终 resolver 返回显式 mask：

```ts
type TResolvedRouteMask = {
  to: string
  visibleHref: string
}
```

其中 `to` 是实际匹配的 private preview route，`visibleHref` 是地址栏显示的 canonical
detail URL。

执行时方向必须固定为：

```ts
navigate({
  to: mask.to, // private preview route，实际参与 route match
  mask: {
    to: mask.visibleHref, // canonical detail URL，显示在地址栏
  },
})
```

例如 Post preview：

```text
mask.to          = /home/post/previewer/42
mask.visibleHref = /home/post/42
```

不能把两者传反。否则详情 route 会成为实际 matched route，而 previewer 只成为可见地址，
drawer 行为会再次丢失。

当前 Kanban 分支使用 `href.includes('/post/')` 判断 canonical target，容易接受错误
community、非规范路径或仅包含相似字符串的 URL。PR 1 必须改为结构化解析 pathname
segments，校验 current community、list section、target community、target thread 和 article
ID；query/hash 不参与 thread 判断，并补充 false-positive tests。

通用 Core Link 只执行 resolved mask，不接受 `previewId`，也不理解 Post/Changelog/Kanban。
这 11 个 Core 生产文件中的 12 处 JSX 使用改用产品专用 `CommunityPreviewLink`：

```text
frontend/core/ui/CommunityPreviewLink/index.tsx
  -> reads TanStack location
  -> calls resolveCommunityPreviewMask
  -> renders Core Link with navigation='router' + resolved mask
```

`previewId` 只保留为 `CommunityPreviewLink` 的产品 prop。该组件默认 `scroll={false}`，避免
打开 drawer 时重置底层列表滚动。这样不需要 Community -> Core prop drilling，也不会把
Community preview 规则重新塞回通用 navigation adapter。

最低行为合同是：

- 列表点击打开 drawer；
- 地址栏显示 canonical detail URL；
- 刷新 canonical URL 进入正常详情页；
- Back 关闭 drawer 并回到原列表状态；
- 列表滚动位置不因打开 drawer 被重置；
- unsupported route context 不应误建 preview route。

### 跨应用导航

所有应用使用 TanStack 不代表它们已经合并成一个 SPA。生产仍是多个独立构建产物：

```text
Browser
  -> Edge Router
       |-- Landing
       |-- Community
       |-- Auth
       `-- other service/upstream
```

本地由 Dev Gateway 和 Portless 提供对应入口。因此导航必须区分：

- 当前应用拥有的 route：使用 TanStack client navigation；
- Community preview：使用 TanStack route mask；
- 跨应用/跨 Worker route：使用普通 `<a>` 或等价的 full-document navigation；
- 外部 URL：使用普通浏览器导航；
- Auth/OAuth redirect：继续遵守 Auth 的完整页面跳转合同。

如果 Landing 用 TanStack client navigation 打开 Community URL，请求不会重新经过入口
router，Landing 的 route tree 会直接得到未知路由。V2 必须显式建模这个边界，不能简单把
所有以 `/` 开头的 URL 都当作当前 SPA 的内部路由。

### 基础设施 route contract

`packages/route-contract`、`infra/edge-router` 和 `infra/dev-gateway` 不属于本次前端 runtime
compatibility layer：

```text
packages/route-contract
  -> Edge Router production routing
  -> Dev Gateway local routing
```

V2 不删除或并入这些模块。跨应用 navigation 的浏览器验收需要经过它们，但产品前端不能
把 Edge/Dev runtime proxy 逻辑搬进 Core。

## 4. 目标架构

目标调用链为：

```text
same-app navigation
  Core/Product component
    -> TanStack Link or navigate
      -> current app route tree

Community preview
  Community preview target
    -> TanStack route mask
      -> preview route + canonical visible URL

cross-app navigation
  native document link
    -> Edge Router / Dev Gateway
      -> target application
```

Core 不再提供一个模拟 Next Navigation 的 `useRouter()` 返回值，也不再要求应用 root 注入
一套 `push/replace/refresh/prefetch` 函数。需要的语义直接映射为：

- `useLocation()`；
- `useNavigate()`；
- TanStack router `preloadRoute()`；
- TanStack router `invalidate()`；
- TanStack `Link`；
- route mask；
- native document link。

Core 可以保留少量以产品行为命名的 helper，但不能重新建立一套与 TanStack API 一一对应
的 facade。否则只是把 `PlatformProvider` 换了名字。

### Core Link 最终公开 API

Core 不能公开 TanStack `Link`/`navigate` 的 `to` 类型。每个应用注册的是不同 route tree，
Core 自身 type-check 时也不存在一个可以静态引用的应用 `RegisteredRouter`。因此 Core Link
继续公开不泄漏具体 router 类型的产品 `route` 或 Web `href`，但两者必须互斥，并显式
声明 navigation ownership：

```ts
type TCoreLinkDestination =
  | {
      route: TRouteTarget
      href?: never
      preserveSearch?: boolean
    }
  | {
      href: string
      route?: never
      preserveSearch?: never
    }

type TCoreLinkNavigation =
  | {
      navigation: 'router'
      mask?: TResolvedRouteMask
      prefetch?: boolean
      replace?: boolean
      scroll?: boolean
    }
  | {
      navigation: 'document'
      mask?: never
      prefetch?: never
      replace?: never
      scroll?: never
    }

type TCoreLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  TCoreLinkDestination &
  TCoreLinkNavigation
```

- `route` 继续由 Dsb/Community 产品 resolver 转成最终 URL；产品 resolver 不随 provider
  删除。
- `href` 不降级成非类型安全的 TanStack `to: string` 公共 API。
- `navigation: 'router'` 表示当前 route tree 拥有目标；`document` 表示必须重新经过
  Edge Router/Dev Gateway。
- `navigation` 故意没有默认值；所有 Core Link consumers 必须显式声明 ownership。
- 不能从 `href.startsWith('/')` 推断 ownership；以 `/` 开头的 URL 也可能属于另一个应用。
- `mask` 只允许配合 router navigation，由 Community 产品 resolver 提供 resolved target。
- `previewId` 从最终 Core Link props 中删除。
- 动态 resolved URL 到 TanStack `to` 的类型收窄只允许存在于 Core Link 内部一个私有
  边界，并由 Core Link tests 覆盖；不能把 cast 扩散到 consumers。

普通 modifier click、`target`、download、复制链接和无 JavaScript fallback 仍由真实
`href` 提供。

现有 Link consumers 按以下规则迁移。添加 prop 的语法可以机械修改，目标 ownership
必须逐项人工确认，不能先批量写成 `router` 再依赖运行时发现错误：

| 目标                          | `navigation` |
| ----------------------------- | ------------ |
| 当前 Community 内部 route     | `router`     |
| 当前 Dash 内部 route          | `router`     |
| Community preview/mask        | `router`     |
| Landing -> Community          | `document`   |
| Community -> Landing          | `document`   |
| Auth/OAuth redirect           | `document`   |
| 用户配置的任意 URL            | `document`   |
| 外部绝对 URL                  | `document`   |
| `target='_blank'` 或 download | `document`   |

用户配置 URL 使用 `document` 是安全默认。如果静态配置、受控字段类型或结构化 route
resolver 能确认目标属于当前应用 route tree，可以由调用方显式选择 `router`；不得只凭
`/` 前缀、字符串包含关系或运行时猜测自动切换。

没有显式 `navigation` 的 Link 必须在 type-check 阶段失败。禁止在 Core Link 内增加
`'router'` 默认值、`startsWith('/')` fallback 或静默 document/router 自动推断。

### Search 参数迁移

TanStack Router 没有返回 `URLSearchParams` 的 `useSearchParams()`。V2 不能把现有 consumers
机械替换为 `useSearch()`：

- route-owned、已声明 schema 的 search 使用 TanStack `useSearch({ from })`；
- Core 共享代码需要通用查询参数时，从 `useLocation().searchStr` 构造稳定的
  `URLSearchParams`；
- 构造结果必须按 `searchStr` memoize，不能每次 render 创建新对象。

仓库已有的 `frontend/core/hooks/useURLSearchParams` 返回 allowlist 过滤后的 query string，
但全仓没有生产消费者，只有自身文件和测试。不要为死 API 保留形状或做兼容改名。迁移时：

1. 删除旧 `useURLSearchParams` 实现和对应测试；
2. 使用同一名称新建返回 memoized `URLSearchParams` 的 hook，并按新合同重写测试；
3. 逐个分类现有 pathname/router/search consumers；
4. route-local consumer 优先使用 typed `useSearch`，共享通用 consumer 使用新的
   `useURLSearchParams`。

## 5. 具体删除与迁移

### 删除 Route Scope runtime

完成消费者迁移后删除：

```text
frontend/core/platform/context.tsx
frontend/core/platform/navigation.ts
frontend/dash/src/platform/tanStackPlatform.tsx
frontend/landing/src/platform/TanStackRouteScopeProvider.tsx
frontend/community/src/platform/communityPlatform.tsx
frontend/apply/src/platform/ApplyRouteScopeProvider.tsx
```

并从各应用 `routes/__root.tsx` 删除对应 provider wrapping。

同时删除以下类型和概念：

- `TRouteScope`；
- `TRouteNavigation`；
- `RouteScopeProvider`；
- `useRouteScope`；
- `dsbRootSegment?`；
- 只有 `'dash'` 一个取值的 `TDsbRouteRootSegment`；
- 通用 navigation adapter 上的 `previewId`。

删除 `TDsbRouteRootSegment` 时必须同步收敛所有 Dsb helper 签名：

```ts
resolveDsbRoute(target, { currentSearch, preserveSearch })
parseDsbPathname(pathname)
toDsbTargetFromPath(pathname)
isActiveDsbRoute(pathname, target)
```

同时删除 `isDsbRootSegment`、`TRouteMeta.rootSegment`、所有 `rootSegment` 参数，以及
`Link.tsx` 的 `navi.dsbRootSegment ?? 'dash'`。空 Dsb path 到 `overview` 的归一化继续作为
唯一产品规则保留，不再由伪可变 root segment 控制。

### 重写 Link

共享 Link 使用第 4 节定义的最终 props。它需要保留普通链接语义，包括 modifier click、
`target`、下载、复制链接地址和无 JavaScript fallback，但 router navigation 内部使用
TanStack 原生能力。

Link contract 必须明确区分：

```text
router navigation   current app owns the route
preview navigation  current app owns a masked preview route
document navigation another app/service owns the route
external navigation absolute external URL
```

不得继续用 `finalHref.startsWith('/')` 作为“当前应用内部路由”的唯一判断。

公开 prop 保留现有 `scroll?: boolean`，不为对齐 TanStack 命名制造
`scroll -> resetScroll` 的纯机械 churn。Core Link 私有实现负责一处映射：

```ts
resetScroll: scroll !== false
```

- 省略 `scroll` 或 `scroll={true}`：使用 reset scroll 行为；
- `scroll={false}`：传给 TanStack `resetScroll: false`；
- `CommunityPreviewLink` 默认 `scroll={false}`；
- Link tests 覆盖省略、`true`、`false` 和 preview mask 四种情况。

如果未来需要公开 API 改名，应作为独立机械重构评估，不属于 V2 compatibility cleanup
合同。

### 收敛 Image

优先让消费者直接使用原生 `<img>` 与 CSS：

- `priority` 改为明确的 `fetchPriority`/`loading`；
- `fill` 改为调用处的布局 class；
- 删除无效果的 `unoptimized`；
- 对象形式静态资源由调用处解析成字符串 URL；
- 删除 `NextImage` 命名。

如果仍需要统一 fallback、lazy loading 或 CDN URL 处理，应由已有 `Img` 领域组件承载，
不再保留伪 Next Image API。

### 收敛 active route

删除 adapter-wide `navi.isActive`，不再试图统一出第四套通用判断：

- Dsb 使用 `isActiveDsbRoute`，保留 `overview` 归一化和 section descendant 语义；
- Community 使用 `isActiveCommunityRoute`，保留 target/descendant 语义；
- route-tree local UI 使用 TanStack `useMatchRoute`；
- Apply 当前的裸字符串相等判断直接删除，不作为标准实现。

PR 1 必须为 Dsb 和 Community 两套产品语义补测试并写清 exact/descendant 边界。

### 收敛 Script

当前没有 `beforeInteractive` consumer，因此该策略和类型成员直接删除，不设计迁移分支。
实际 consumers 只有：

- `afterInteractive`：Third-party Analytics 和 Widget Preview；
- `lazyOnload`：Plausible/Fathom Analytics；
- 默认 strategy：OSS Uploader。

mount 后加载且需要去重/onLoad 的脚本保留为明确的 `ClientScript`；原
`afterInteractive` 和默认 strategy 收敛成默认 mount 行为，`lazyOnload` 改成显式 idle
选项。第三方 Analytics、Widget preview 和 OSS uploader 必须分别验证加载时序。

## 6. 实施顺序

### PR 1：冻结产品路由合同

1. 将 Dsb、Community 和 search route helpers 从 framework compatibility 中分类出来。
2. 按第 4 节冻结 Core Link props，不对外暴露 TanStack `to`。
3. 删除 `TDsbRouteRootSegment` 并完成 Dsb helper 签名收敛。
4. 明确 Dsb/Community active route 的 exact/descendant 语义，删除 Apply 裸比较的标准地位。
5. 将纯 `resolveCommunityPreviewPath` 迁入 `frontend/core/routes/community-preview.ts`，收敛为
   结构化的 `resolveCommunityPreviewMask`；Community route guard 继续留在 Community。
6. 冻结产品专用 `CommunityPreviewLink` 合同，通用 Core Link 不接受 `previewId`。
7. 为 route resolver、search preserve、active route 和 Community preview 补齐纯函数测试。
8. 明确 same-app、preview、cross-app 和 external 四种 navigation ownership。
9. 保留现有运行时行为，不在本 PR 删除 provider。

### PR 2：切换到 TanStack 原生导航

1. 为 Core 声明 exact `@tanstack/react-router@1.170.21` peer/dev dependency，并保证宿主、
   workspace 安装和 Vite bundle 使用单版本、单 runtime 实例。
2. 将 Core Link 按冻结的 `route`/`href` union props 迁移到 TanStack 原生 API。
3. 为所有 Link consumers 显式填写 router/document ownership，不提供默认值。
4. 保留公开 `scroll` prop，只在 Core Link 私有实现映射为 TanStack `resetScroll`。
5. 删除零消费者的旧 `useURLSearchParams` 及测试，新建 memoized `URLSearchParams` 合同。
6. 将其余 search consumers 分类迁移到 typed `useSearch` 或新的 `useURLSearchParams`。
7. 新建 `CommunityPreviewLink`，迁移 11 个 Core 生产文件中的 12 处 preview JSX 使用，重写
   `Link.test.tsx` 中另 2 处测试使用，并验证 mask 方向和滚动。
8. 对跨应用链接使用 full-document navigation。
9. 新增 `pnpm run check:router-runtime` 自动检查宿主/Core 声明和 lockfile 唯一解析版本。
10. 验证 Community、Dash、Landing 和 Apply 的 route tree/type-check。

### PR 3：删除 provider 与 adapter

1. 删除 `RouteScopeProvider`、`useRouteScope` 和 navigation facade。
2. 删除四个应用 adapter。
3. 删除各应用 root 中的 provider wrapping。
4. 重写 `frontend/core/platform/index.ts` export surface。
5. 重写 `frontend/core/platform/Link.test.tsx`，不再 mock RouteScope。
6. 删除 `frontend/core/vitest.setup.ts` 和 Dsb hook tests 中的 mock RouteScope。
7. 更新 Core、Community、Dash、Landing、Apply README 和历史文档状态。

### PR 4：清理 Image、Script 和命名残留

1. 删除 Next-shaped Image props 与 `NextImage` 别名。
2. 直接删除无人使用的 `beforeInteractive`，将 Script 收敛为 mount/idle 两种真实生命周期。
3. 删除零消费者的 `frontend/core/lib/route.ts` 和 ArticleEditor 中对应的陈旧注释。
4. 删除已经失效的 Next compatibility 说明。
5. 重跑全仓残留扫描和相关浏览器测试。

如果 PR 1 证明 route ownership 可以在一次安全改动中完全表达，PR 2 与 PR 3 可以合并；
不得为了保持旧 API 而长期维护双路径。

## 7. 删除前清点

实施前使用以下固定口径保存文件列表，最终验收重复运行相同命令。统计数字只由这些列表的
`wc -l` 产生，不使用编辑器搜索或临时变体作为 PR 前后对照。

```bash
rg -l \
  'RouteScopeProvider|useRouteScope|TRouteScope|TRouteNavigation|dsbRootSegment|previewId' \
  frontend \
  --glob '!**/node_modules/**' \
  --glob '!**/dist/**' \
  | LC_ALL=C sort

rg -l -U -P \
  "import\\s*\\{[^}]*\\bLink(?:\\s+as\\s+\\w+)?\\b[^}]*\\}\\s*from\\s*['\"]~/platform['\"]" \
  frontend/core \
  --glob '!**/node_modules/**' \
  --glob '!**/dist/**' \
  | LC_ALL=C sort

rg -l -U -P \
  "import\\s*\\{[^}]*\\buse(?:Pathname|Router|SearchParams)\\b[^}]*\\}\\s*from\\s*['\"]~/platform['\"]" \
  frontend/core \
  --glob '!**/node_modules/**' \
  --glob '!**/dist/**' \
  | LC_ALL=C sort

rg -l \
  'NextImage|unoptimized|beforeInteractive|afterInteractive|lazyOnload' \
  frontend/core frontend/landing frontend/community frontend/dash frontend/apply \
  --glob '!**/node_modules/**' \
  --glob '!**/dist/**' \
  | LC_ALL=C sort

rg -l \
  'tanStackPlatform|TanStackRouteScopeProvider|ApplyRouteScopeProvider|communityPlatform' \
  frontend \
  --glob '!**/node_modules/**' \
  --glob '!**/dist/**' \
  | LC_ALL=C sort

# production preview JSX occurrences and their owning files
rg -n --glob '*.tsx' '\bpreviewId=' frontend/core/unit | LC_ALL=C sort
rg -l --glob '*.tsx' '\bpreviewId=' frontend/core/unit | LC_ALL=C sort

# preview usages owned by the Core Link test rewrite
rg -n '\bpreviewId=' frontend/core/platform/Link.test.tsx | LC_ALL=C sort
```

`previewId` 的命中不能机械删除：它可能是文章数据字段或产品 UI state。这里只清理通过
通用 navigation adapter 转发 preview intent 的用法。当前基线是 11 个生产 UI 文件、
12 处 JSX 使用，另有 `Link.test.tsx` 中 2 处测试使用；文件清单由上面的固定命令生成，
迁移与最终验收以该清单为准，而不是仅按硬编码数量对账。

第二、三条使用 multiline PCRE 匹配 `~/platform` 的 named imports，覆盖单行和多行 import，
并分别统计 Link 与 navigation hook candidates。扫描结果仍需人工分类；固定命令保证 PR
前后列表可比较，不代表每个候选文件都必须采用同一种迁移方式。

Router runtime 版本不能只靠人工阅读 `pnpm why`。PR 2 新增仓库级
`pnpm run check:router-runtime`，至少自动检查：

- Core peer/dev dependency 和所有宿主 dependency 都 exact pin 到 `1.170.21`；
- `pnpm-lock.yaml` 中 `@tanstack/react-router` 的唯一解析版本是 `1.170.21`；
- 出现多个唯一解析版本、缺失宿主声明或范围漂移时以非零状态退出。

Yarn peer virtualization 会产生多个 `virtual:*#npm:1.170.21` locator，它们不是多个 package
版本。脚本必须归一化 virtual locator 并统计唯一 resolved version，不能把 locator 数量当作
版本数量。Router 升级时先统一修改约定版本，再由同一脚本验证新的 exact pin。

历史迁移文档可以保留 `PlatformProvider`、Next 或 adapter 名称，但必须标记为历史记录；
运行代码、测试 setup 和当前架构文档不得继续把它们描述为现行设计。

## 8. 验收标准

- Core 正式声明并直接使用 TanStack Router；
- `@tanstack/react-router`、React 和 React DOM 在每个宿主 bundle 中保持单 runtime 实例；
- Core peer/dev dependency 与所有宿主 exact pin 同一个 Router 版本；
- `pnpm run check:router-runtime` 自动确认 lockfile 只有一个 resolved Router version；
- Core 不再 framework-neutral，但继续保持 app-route-tree 和 infrastructure neutrality；
- Core 不导入任一应用的 generated route tree；
- Core Link 对外只接受互斥的 `route`/`href`，不公开 TanStack `to: string`；
- 每个 Link consumer 显式声明 router/document ownership，不存在默认值；
- Link 不再根据 `/` 前缀或其他 URL 形状猜测 ownership；
- TanStack resolved-path 类型收窄只存在于 Core Link 私有边界；
- 不存在 `RouteScopeProvider`、`useRouteScope`、`TRouteScope` 或 `TRouteNavigation`；
- Dash、Landing、Community 和 Apply root 不再挂载 route compatibility provider；
- 不存在四套 per-app TanStack navigation adapter；
- Core 不再模拟 Next Navigation 的 `useRouter` contract；
- 不存在 `TDsbRouteRootSegment`、`isDsbRootSegment`、`rootSegment` 参数或字段；
- route-owned search 使用 typed `useSearch`，共享 search 使用 memoized `URLSearchParams`；
- 零消费者的 allowlist-string `useURLSearchParams` 实现及旧测试已删除；
- Dsb 和 Community typed route resolver、search preserve 与 active route 测试通过；
- adapter-wide `isActive` 和 Apply 裸字符串比较已删除；
- Community Post、Changelog、Kanban 列表点击打开 drawer；
- 第 7 节扫描出的 11 个 Core 生产 UI 文件、12 处 preview JSX 使用均已迁移到产品专用
  `CommunityPreviewLink`，`Link.test.tsx` 中另 2 处测试使用已重写，通用 Link 不接受
  `previewId`；
- preview navigation 使用 private route 作为实际 `to`、canonical route 作为 visible mask；
- preview 地址栏显示 canonical URL，刷新进入详情页，Back 返回列表；
- unsupported context 不会错误打开 preview route；
- preview resolver 不再使用 `href.includes('/post/')` 判断 Kanban target；
- same-app 链接使用 client navigation 和 route preload；
- Landing/Community/Auth 等跨应用链接产生 full-document request，并重新经过入口 router；
- modifier click、`target='_blank'`、下载和复制链接地址保持原生行为；
- 公开 `scroll` prop 保持不变，并只在 Core Link 内正确映射 TanStack `resetScroll`；
- 不存在 `NextImage`、无效果的 `unoptimized` 或伪 `fill` compatibility props；
- 不存在 `beforeInteractive`/`afterInteractive`/`lazyOnload` Script compatibility API；
- Third-party Analytics、Widget preview 和 OSS uploader 的脚本时序验证通过；
- 不存在零消费者的 `frontend/core/lib/route.ts` 或 ArticleEditor 陈旧注释；
- `packages/route-contract`、Edge Router 和 Dev Gateway 行为不因前端 runtime 清理而漂移；
- Community、Dash、Landing、Apply、Inspire Me type-check/build 通过；
- Core 相关单测和 Community/Dash 浏览器回归通过；
- 删除前扫描在最终验收时无未分类的运行代码命中；
- 本轮改动不重新引入 Next.js、Vinext 或其他 framework compatibility facade。

## 9. 不在 V2 实施

- 不合并 Landing、Community、Dash、Apply 为单一 SPA；
- 不删除 Edge Router、Dev Gateway 或 `packages/route-contract`；
- 不改变生产 host/path 分类和自定义域名合同；
- 不恢复 Main/Dashboard、旧域名或旧路由兼容；
- 不拆分 Dsb 配置 store 与 Dsb editor/demo runtime；
- 不把 GraphQL、Auth、Phoenix 或 Content Import 逻辑搬入前端 router；
- 不以新的 `AppProvider`、`RouterProvider` 或同构 facade 替代 RouteScopeProvider。
