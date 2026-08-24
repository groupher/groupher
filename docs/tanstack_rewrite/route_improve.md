# Community Route Review 与改进建议

> 状态：只读评审完成，建议作为 Community 进入 canary 前的 route 改进清单。
>
> 评审范围：`frontend/community` 的 TanStack Router route tree、loader、Query
> integration、route masking、PlatformLink、head、错误边界，以及
> `docs/tanstack_rewrite/` 中已经确定的 Community V1/V2 契约。

## 1. 结论

Community 当前的 route tree 方向是正确的，已经具备 TanStack Router 的主要价值：

- `$community` 作为 community-scoped parent layout；
- `_layout` 作为不进入公开 URL 的 pathless background route；
- preview route 挂在 list/board 背景树下；
- canonical detail route 与 preview route 分离；
- route loader 负责关键数据预加载，TanStack Query 负责 server-state；
- Main、Dashboard、Dash、Community 通过 `PlatformProvider` 保持 host adapter 隔离。

当前不需要重做 route tree，也不需要把 Community route 合并回 Main。进入 canary 前，
建议优先处理以下问题：

1. 收窄 route loader 返回值，避免 Router loader cache 与 Query cache 重复保存完整业务数据；
2. 统一 Post、Changelog、Kanban preview 的 article/comments 预加载；
3. 修复错误边界暴露内部错误，以及错误页指向 `/` 这一已知 404 的问题；
4. 将 preview mask 从 pathname 字符串判断升级为显式的 route presentation 意图；
5. 补充 route parity、refresh、slug canonical 和 canary asset base 验证。

## 2. 当前 route 模型

```text
__root__
└── $community
    ├── about
    ├── post
    │   ├── $id                         canonical detail
    │   └── _layout                     pathless background
    │       ├── index                   /:community/post exact leaf
    │       └── previewer/$id           masked Drawer
    ├── changelog
    │   ├── $id                         canonical detail
    │   └── _layout                     pathless background
    │       ├── index                   /:community/changelog exact leaf
    │       └── previewer/$id           masked Drawer
    ├── kanban
    │   └── _layout                     pathless background
    │       ├── index                   /:community/kanban exact leaf
    │       └── previewer/post/$id      masked Post Drawer
    ├── doc
    │   ├── index
    │   └── $id/$slug                   canonical detail
    └── $                               unknown community path -> not-found
```

裸 `/:community` 继续返回 404，裸 `/` 也继续返回 404。这与 Main 的既有公开 URL 契约
一致，不能因为 Community 使用 TanStack Router 就自行增加社区首页或 redirect。

### 2.1 `_layout` 是 pathless layout 目录

`_layout` 不是 Groupher 自定义的 URL 语法，而是 TanStack Router file-based routing
中的 pathless layout 命名方式：route segment 以 `_` 开头时，它会进入 route id 和组件
层级，但不会进入公开 pathname。这里统一使用 `layout` 明确表达目录职责，真正控制
pathless 行为的是前缀 `_`：

```text
文件目录                                      公开 URL
$community/post/_layout/route.tsx            /:community/post
$community/post/_layout/index.tsx            /:community/post
$community/post/_layout/previewer/$id.tsx    /:community/post/previewer/:id

$community/kanban/_layout/route.tsx          /:community/kanban
$community/kanban/_layout/previewer/post/$id /:community/kanban/previewer/post/:id
```

各自的 `_layout/route.tsx` 分别持有 Post/Changelog 列表背景与 Kanban board 背景。
这样 preview 可以作为它们的 child route 渲染，同时不把 `_layout` 暴露给用户。

### 2.2 `Outlet` 是嵌套路由的渲染插槽

TanStack Router 匹配一条嵌套路由时，parent component 不会自动被 child 替换。Parent
通过 `<Outlet />` 明确声明 child route 应渲染的位置：

```text
PostListLayout
├── ArticleListStoreProvider
├── PostThread                         parent 自己的背景 UI
└── Outlet                             child route 插槽
    ├── index.tsx -> null              访问 /post 时不叠加内容
    └── previewer/$id.tsx -> Drawer    打开 preview 时在背景上叠加 Drawer
```

因此 preview 打开和关闭时，`PostListLayout`、列表 Store 和背景滚动容器可以保持同一个
实例；变化的只是 `Outlet` 里的 child route。

## 3. 已符合最佳实践的部分

### 3.1 Parent layout 与 community runtime

`$community/route.tsx` 并行加载 community shell 和 locale，只把 head projection 返回给
Router；完整 shell 由 `CommunityBoundary` 从 Query cache 读取，并通过
`key={community}` 在切换社区时重建 runtime。

参考：

- [`frontend/community/src/routes/$community/route.tsx`](../../frontend/community/src/routes/$community/route.tsx)
- [`frontend/community/src/components/CommunityBoundary.tsx`](../../frontend/community/src/components/CommunityBoundary.tsx)

这个边界是正确的：社区级配置由 parent route 负责初始化，页面 server-state 由 leaf route
负责预加载，完整业务数据不应该再复制到 Router loader data。

### 3.2 Pathless background route

`_layout` 不进入公开 URL，却持有列表或 board 的数据、UI 和 `Outlet`。因此
打开 preview 时背景页面可以继续挂载，列表数据、筛选状态、滚动位置和 board 实例不会被
detail route 替换。

对应 `index.tsx` 保持为空 leaf，不重复定义 loader 或背景 UI。这一点符合 route tree
的精确匹配要求。

### 3.3 Preview route masking

Preview route 使用：

```text
source route id：/$community/post/_layout/previewer/$id
内部 pathname：/:community/post/previewer/:id
浏览器 URL：/:community/post/:id
```

preview route 使用共享 `@Drawer`，并通过 `${thread}:${articleId}` 设置 `resetKey`。
Preview 不输出文章 canonical、title 或 Open Graph，只有直接访问 canonical detail route
时才生成文章 head。

这里不是 Next.js intercepted route。拦截发生在 Community 的 TanStack Link adapter：

```text
用户点击文章 23
  -> CommunityLink 计算两个地址
       canonical: /home/post/23
       internal:  /home/post/previewer/23
  -> navigate({
       to: internal,
       mask: { to: canonical },
       resetScroll: false
     })
  -> 浏览器地址栏和 history 写入 canonical URL
  -> Router 使用 history state 中的内部 location
  -> 实际匹配 _layout/previewer/$id
  -> PostListLayout 保持挂载，Outlet 渲染 Drawer
```

Preview route 的 `beforeLoad` 再调用 `requireCanonicalPreviewMask` 检查
`location.maskedLocation.pathname`：

```text
存在正确 canonical mask
  -> 允许进入内部 preview route

用户直接访问 raw /post/previewer/23
  -> 没有 maskedLocation
  -> 308 redirect 到 /post/23
  -> canonical detail route 渲染完整详情页
```

因此，`CommunityLink` 负责创建 masked navigation，preview route 的 `beforeLoad` 负责
拒绝可直接寻址的内部 URL；两者共同构成当前的 preview 拦截机制。

参考：

- [`frontend/community/src/routes/$community/post/_layout/previewer/$id.tsx`](../../frontend/community/src/routes/$community/post/_layout/previewer/$id.tsx)
- [`frontend/community/src/utils/preview-route.ts`](../../frontend/community/src/utils/preview-route.ts)
- [TanStack Router Route Masking](https://tanstack.com/router/latest/docs/guide/route-masking)

### 3.4 Query SSR integration

`getRouter()` 为每个 SSR 请求创建 QueryClient，将其放入 Router context，并接入
`setupRouterSsrQueryIntegration`。`defaultPreloadStaleTime: 0` 让 TanStack Query 决定
Query freshness，避免 Router preload cache 与 Query cache 各自维护一套 freshness 规则。

Server 和 browser 不会共享同一个 QueryClient JavaScript 对象。当前生命周期是：

```text
SSR request A
  -> getQueryClient()
  -> 新 QueryClient A
  -> loaders + SSR render 复用 A
  -> dehydrate 成可序列化 Query state
  -> request 结束，A 释放

SSR request B
  -> 新 QueryClient B
  -> 与 A 完全隔离

Browser hydration
  -> 创建稳定的 browser QueryClient
  -> 把 SSR dehydrated state 恢复进 browser cache
  -> 后续客户端 route navigation 持续复用该 browser QueryClient
  -> full reload 后重新创建 browser runtime
```

也就是说，跨 server/client 传递的是可序列化的 Query cache state，不是 QueryClient
实例本身。Server 端必须按请求隔离；browser 端则在当前应用生命周期内保持稳定，避免每次
render 或 navigation 都丢失 cache。

参考：

- [`frontend/community/src/router.tsx`](../../frontend/community/src/router.tsx)
- [TanStack Router External Data Loading](https://tanstack.com/router/latest/docs/guide/external-data-loading)
- [TanStack Router Query Integration](https://tanstack.com/router/latest/docs/integrations/query)

### 3.5 关键数据在 loader 阶段并行加载

Post canonical detail、Changelog canonical detail，以及 Post preview 使用 `Promise.all`
并行加载 article 与 comments，避免组件挂载后再形成串行请求。关键数据在 render 前准备好，
也有利于 SSR、SEO 和 hydration 一致性。

当前 Changelog preview 与 Kanban → Post preview 仍只预加载 article/post，comments 会在
Drawer 挂载后再进入数据链路；这一差异列在 P1 中。

### 3.6 RootDocument、HeadContent 与 Scripts

Community 的 `shellComponent: RootDocument`、`<HeadContent />` 和 `<Scripts />` 是
TanStack Start 自己的 full-document SSR 机制，不是为了兼容 Next.js：

```text
RootDocument
├── <html>/<head>/<body>       应用拥有完整 document shell
├── <HeadContent />            输出各 matched route 的 head/meta/link/style
├── children                   SSR route 内容
└── <Scripts />                输出 hydration/runtime scripts
```

Groupher 放在 `<HeadContent />` 前面的 inline first-paint script 则是产品自己的首屏优化，
不属于 TanStack Start 的强制模板：

```text
prePaintThemeDetectScript
  -> React hydration 前确定 theme/color-scheme
  -> 避免亮暗主题闪烁

prePaintRuntimeSeedScript
  -> 把 SSR 的 renderedAt 传给首屏 TimeAgo/runtime
  -> 避免 server/client 首次时间基准不一致
```

这个组合适合当前 Community，但 inline script 必须保持小、确定、可审计，并与 CSP nonce/
hash 策略兼容。TanStack Start 提供 document/head/scripts 机制；具体 first-paint 内容仍由
Groupher 自己负责。

## 4. Route Context 的适用边界

Community 当前已经使用 Route Context：`TRouterContext` 只注入 request-local
`QueryClient`，各 route loader 通过 `context.queryClient` 调用 `ensureQueryData`。

建议继续保持以下分层：

| 位置                              | 适合放置                                                 | 不适合放置                                          |
| --------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| Router context                    | QueryClient、request id、logger、auth reader、API client | 完整 community shell、页面数据、UI store            |
| `beforeLoad` 返回的 route context | 认证结果、权限能力、feature flag、父子路由共享的轻量依赖 | 大型可变 server-state                               |
| React Provider                    | theme、account、community runtime、UI store、交互状态    | loader 必须依赖的 request-local 服务                |
| TanStack Query                    | community、article、comments、doc tree 等 server-state   | 浏览器 history、route presentation、Drawer 生命周期 |

当前公共社区页面没有强制登录的 route，因此没有必要为了“使用 Route Context”而新增
auth context。未来增加私有 reader route 或管理入口时，可以在 root/parent context
放置 request-local `getSession` / `requireUser`，再由 `beforeLoad` 做认证和授权。

不要把完整 shell 搬进 Route Context。当前 `CommunityBoundary` 从 Query cache 读取完整
shell、parent loader 只返回 head projection 的设计应当保留。

## 5. 问题清单

### P1：loader 与 Query cache 重复保存完整业务数据

当前多个 route loader 在 `ensureQueryData` 后又把完整结果返回给 Router：

- Post list 返回 `{ posts }`；
- Post detail 返回 `{ post }`；
- Changelog list、Kanban board、Doc list 直接返回 Query 结果；
- Preview route 返回完整 article/post，但组件仍通过 Query provider 读取。

这会形成两份 server-state：Router loader cache 一份，TanStack Query cache 一份。对于
列表、Kanban 和文档树尤其会增加内存和序列化成本。

Doc detail 需要单独区分：`doc/$id/$slug.tsx` 会并行确保 doc tree 和 doc，但通过
`const [, doc]` 丢弃 doc tree 的 loader 返回值，最终返回给 Router 的完整对象是 `{ doc }`。
因此需要收窄的是 detail loader 中的 `{ doc }`；doc tree 本身只进入 Query cache，并没有
被该 detail loader 再保存到 Router cache。

建议：

1. Post/Changelog list、Kanban board、Doc list loader 只执行 `ensureQueryData`，返回
   `undefined` 或轻量 metadata；当前 `ArticleListStoreProvider` 只需要 `{ thread }`，
   列表组件继续从 Query cache 读取数据；
2. detail loader 保留 not-found 判断，但只返回 head 所需的 `{ title }` 等最小 projection，
   不返回完整 `{ post }`、`{ article }` 或 `{ doc }`；
3. preview loader 只负责确保 Query 已准备好和判断 not-found，不返回完整文章；
4. 组件继续使用 `useSuspenseQuery` / Query provider 读取唯一 server-state；
5. route-local 非 Query 数据才保留在 Router loader data 中。

### P1：Preview 的 comments preload 不一致

Post preview 会同时加载 post 和 comments，但 Changelog preview 与 Kanban → Post
preview 只加载 article/post：

- [`changelog/_layout/previewer/$id.tsx`](../../frontend/community/src/routes/$community/changelog/_layout/previewer/$id.tsx)
- [`kanban/_layout/previewer/post/$id.tsx`](../../frontend/community/src/routes/$community/kanban/_layout/previewer/post/$id.tsx)

如果 `ArticleViewer` 首屏需要 comments，这两个入口会在 Drawer 挂载后再请求 comments，
产生 preview 内部 waterfall。三种 preview 应统一为：

```text
article + comments
  -> Promise.all
  -> Query cache
  -> Drawer / ArticleViewer
```

### P2：列表分页与筛选参数尚未形成 route contract

当前 `posts` 与 `changelogs` query key 固定使用 `page: 1, size: 20`，server loader 也把
同样的分页参数写死。默认第一页目前不是 bug，因为页面尚未暴露分页或筛选状态；但未来
加入分页、tag filter、sort 或 search 后，URL、Router loader、Query key 和 GraphQL filter
必须使用同一份规范化参数。

建议在实现列表状态前冻结：

```text
validateSearch
  -> loaderDeps
  -> query key
  -> server loader input
  -> GraphQL filter
```

`loaderDeps` 只应包含实际影响请求的字段，不能把整个 search object 作为依赖，否则无关的
view mode 或 UI 参数也会触发列表 loader 重新加载。当前问题属于潜在 contract 风险；如果
下一阶段马上实现分页，应提升为 R1，否则保留在 R2。

### P1：错误边界暴露内部错误，且 Home 链接指向 404

`RouteError` 直接渲染 `error.message`，可能暴露 GraphQL、server function 或内部实现
细节。生产环境应显示稳定的用户提示，详细错误写入服务端日志或关联 request id。

同时，错误页的 Home 链接指向 `/`，但 Community 明确规定 `/` 是 404。建议改为：

- 返回上一页；
- 重试；
- 如果能安全取得 community 参数，则回到 `/${community}/about`；
- 没有 community 时不显示伪造的 Home 链接。

参考：[`frontend/community/src/components/RouteError.tsx`](../../frontend/community/src/components/RouteError.tsx)

### P1：Preview mask 依赖 pathname 字符串判断

Core 入口已通过类型化的 `previewId` 表达预览意图，Community adapter 也已复用
`THREAD_PATH`，不再裸写 thread path 字符串；Main adapter 只在自身边界将 `previewId`
翻译为 PreviewHost 所需的 `data-preview-id`。

但 `CommunityLink` 仍通过 pathname segments 和 canonical href 的字符串包含关系推断具体
presentation。这在当前三种 list/board route 上可用，但未来加入 filter、别名、更多
presentation 或 detail workspace 后容易失效。

建议让 route target 显式表达 presentation：

```text
communityPostDetail({ community, id })
communityPostPreview({ community, id })
communityChangelogPreview({ community, id })
```

或者增加 `presentation: 'canonical' | 'preview'`，由 Community adapter 生成真实的
TanStack navigation。Core 继续只持有语义 route target，不直接 import TanStack Router。

Masked 分支手动调用 `navigate` 时已经显式传递 `replace`，确保自定义
`preventDefault()` 后仍保留调用方要求的 history 语义。

参考：[`frontend/community/src/platform/Link.tsx`](../../frontend/community/src/platform/Link.tsx)

### P2：prefetch 默认关闭，TanStack Router 的优势没有完全利用

CommunityLink 只有在显式传入 `prefetch` 时才设置 `preload='intent'`。这不是 correctness
问题，但意味着普通社区导航、文章卡片和 preview 入口默认不会进行 intent preload。

建议建立明确的 preload policy：

- 主导航和高概率下一步：允许 intent preload；
- 文章卡片：根据 preview latency 和数据量决定是否 preload；
- 低概率、重依赖、外部链接：显式关闭；
- 不要一开始全局打开，避免把 `/post` 的 preload 依赖图再次扩大。

参考：[TanStack Router Preloading](https://tanstack.com/router/latest/docs/guide/preloading)

### P2：`navi.refresh()` 只 invalidate Router，不一定刷新 Query

Community adapter 的 `refresh()` 当前只调用 `router.invalidate()`。这会让 route loader
重新参与调度，但 loader 内的 `ensureQueryData` 仍可能因为 Query `staleTime` 返回已有
数据。

需要先明确 `refresh` 的语义：

- 如果是“重新运行 route-local loader”，当前行为可以保留并改名说明；
- 如果是用户理解的“刷新当前数据”，应同时 invalidate 当前 route 相关 Query；
- 不要用无范围的 `router.invalidate()` 替代 mutation 后的精确 Query invalidation。

参考：[`frontend/community/src/platform/communityPlatform.tsx`](../../frontend/community/src/platform/communityPlatform.tsx)

### P2：Doc slug 的 canonical policy 未冻结

Doc route 按 `$id` 查询文档，却把输入的 `$slug` 直接写入 canonical。如果 slug 是公开
URL 的真实 identity，应验证 slug 与当前 doc 是否一致，并对旧 slug 做 redirect；如果 slug
只是展示字段，则应明确它不参与 identity，避免形成多个可索引 URL。

参考：[`frontend/community/src/routes/$community/doc/$id/$slug.tsx`](../../frontend/community/src/routes/$community/doc/$id/$slug.tsx)

### P2：production asset base 与 canary host 契约冲突

`app.config.ts` 在 production 中把 Vite asset base 固定为
`https://community.groupher.com/`。如果独立 canary host 复用同一个构建产物，页面静态
资源可能仍然指向正式域名，削弱 host 隔离和快速回滚能力。

建议：

- 默认使用同源相对 base `/`；或
- 按部署 host 构建 asset base；或
- 明确把固定域名作为独立 CDN origin，并验证版本隔离、CSP、CORS 和回滚行为。

参考：[`frontend/community/app.config.ts`](../../frontend/community/app.config.ts)

## 6. Preview workspace 的后续边界

当前 route mask 只负责第一次打开 Drawer：

```text
Post list -> /post/23
             实际匹配 preview route
```

后续在 Drawer 内从文章 23 切换到 24，不应该新增 browser history，也不应该创建
detail-background preview route。文章 Tab 应属于现有 Drawer workspace：

```text
preview route owner: 23
└── PreviewWorkspace
    ├── tabs: [23, 24, 25]
    └── activeArticleId: 24
```

这部分仍属于设计/后续实现，不应通过继续扩大 `CommunityLink` 的 pathname 判断来模拟。
应由 preview workspace 明确提供 `openPreviewTab(article)`，而“打开完整页面”继续使用
canonical Link/navigation。

参考：[`detail_preview.md`](./detail_preview.md)

## 7. 推荐实施顺序

### Phase R1：canary 前必须完成

1. 统一 Post、Changelog、Kanban preview 的 article/comments preload；
2. 收窄 route loader 返回值，确保 Query 是唯一完整 server-state authority；
3. 修复 `CommunityLink` masked navigation 的 `replace` 语义；
4. 错误边界改为用户安全提示，移除指向 `/` 的 Home 链接；
5. 补充 direct URL、refresh、back/forward、masked preview、404 和 error recovery 测试。

### Phase R2：性能与边界优化

1. 将 `src/query/queries.ts` 拆成按 route/domain 的 query options；
2. 冻结 Post/Changelog 的 search schema，并接通 `loaderDeps`、query key、server loader
   和 GraphQL filter；
3. 建立显式 preview/canonical route target；
4. 为主导航和高概率 preview 入口建立 preload policy；
5. 明确 `navi.refresh()` 的 Query invalidation 语义；
6. 冻结 Doc slug canonical policy；
7. 修正 canary asset base，并验证独立 host 的资源、CSP、缓存和回滚。

### Phase R3：产品 parity

1. 实现 PreviewWorkspace 和 Drawer 内文章 Tab；
2. Main 与 Community 使用同一套 preview workspace 产品契约；
3. 验证隐藏 Tab 不进入 SSR head、canonical、history 和刷新恢复；
4. 验证打开、切换、关闭、Back、Forward、刷新、错误和 not-found 行为。

## 8. Route、数据与状态的职责边界

当前架构可以用下面四句话作为实现和评审准则：

```text
Router 决定“去哪里、什么时候准备数据”
Query 决定“业务数据是什么、是否新鲜、如何复用”
Provider 决定“当前 UI 怎么运行”
History 决定“用户怎么返回和分享”
```

对应的 ownership 是：

| 层                   | 当前职责                                                       | 不应承担                               |
| -------------------- | -------------------------------------------------------------- | -------------------------------------- |
| TanStack Router      | pathname/search、route match、loader 调度、pending/error、mask | 完整业务数据的长期 authority           |
| TanStack Query       | shell、列表、文章、comments、doc tree 的 freshness 和复用      | URL、Drawer history、页面 presentation |
| React Provider/Store | theme、account、community runtime、组件交互状态                | 跨请求缓存和 canonical URL             |
| Browser History      | canonical URL、masked location、Back/Forward                   | article/comments 数据缓存              |

后续改动如果让同一份完整业务数据同时长期存在 Router cache、Query cache 和 Provider
store，应先重新确认 authority；如果普通导航绕过语义 Link 直接操作 history，也应先确认
是否破坏 mask、prefetch、scroll restoration 和可访问性。

## 9. 验证记录

本轮只读验证：

- Community contract：通过，16 条 generated route 检查通过；
- Community TypeScript：通过；
- preview-route 与 health 测试：4/4 通过。

这些结果只证明本地 route contract、类型和 focused tests；不能替代生产 URL、canary、
Cloudflare purge、真实 SSR latency、RSS 和浏览器 parity 验证。
