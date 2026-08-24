# TanStack Start 与 Next.js 对比

> 状态：架构评估
>
> 本文比较 Groupher 当前 Community（TanStack Start）与 Main（Next.js）的实际运行模型，不把框架宣传材料当作性能结论。bundle、请求数和运行时内存必须以同一路由、同一数据、同一 production build 的测量结果为准。

## 1. 结论

对于 Groupher 的 Community，TanStack Start 更适合交互密集型页面：帖子列表、Drawer preview、评论、筛选、分页、投票和后台操作。

它的主要优势不是“框架默认一定更快”，而是：

1. 路由、数据加载、缓存和 pending 状态在同一条可见链路中；
2. SSR、客户端导航和 hydration 的边界可以显式控制；
3. route-scoped code splitting 更容易建立，首屏依赖不需要穿过 RSC/client boundary；
4. 不依赖 RSC 也能完成 SSR、streaming SSR 和 deferred data；
5. 更适合当前 Cloudflare Worker/WinterCG 的部署边界；
6. 交互问题更容易从真实的 route、loader、query 和 chunk 追踪到根因。

Next.js 仍然适合以内容输出、SEO 和成熟生态为主要目标的页面，也具备 SSR、streaming、预取和缓存能力。它的问题不是“做不到”，而是 App Router、RSC、parallel route、intercepted route、Next Data Cache 和客户端状态一起参与时，交互路径的隐含状态更多。

长期决策：Main 与 Community 可以继续共存，不要求两个应用共享同一套路由实现。Core 只提供平台无关的语义，具体导航和运行时能力由各自 adapter 负责。

## 2. 两种运行模型

### 2.1 Community：Router-first

TanStack Start 以 TanStack Router 作为应用契约，Start 在其外部提供 full-document SSR、streaming、server functions、middleware 和部署适配。

```text
request / navigation
  ↓
beforeLoad
  ↓
route loader
  ↓
QueryClient / loader cache
  ↓
route component
  ↓
SSR HTML 或客户端更新
```

Community 的帖子 preview 使用 masked navigation：浏览器地址保持 canonical 详情路径，实际渲染进入 preview route。preview loader 先并行准备 post 和 comments，数据完成后才挂载 Drawer。

当前实现：

- `frontend/community/src/routes/$community/post/_layout/previewer/$id.tsx`
- `frontend/community/src/query/queries.ts`
- `frontend/community/src/router.tsx`
- `frontend/core/ui/@Drawer/index.tsx`

这让“什么时候打开 Drawer”成为 route loader 的显式决策，而不是由多个 RSC/client boundary 间接决定。

### 2.2 Main：RSC-first

Next.js App Router 的典型链路是：

```text
click
  ↓
client router navigation
  ↓
parallel/intercepted route
  ↓
RSC Flight payload
  ↓
Next loading boundary
  ↓
Client Component / Drawer host
  ↓
client cache 与真实 route 状态同步
```

Next 官方把 modal/overlay 场景建立在 intercepted routes 和 parallel routes 上。这套机制适合在当前页面上下文中覆盖一个详情页，但 preview 的数据、Drawer 生命周期和 RSC payload 到达时间并不天然同步。

因此 Main 当前需要额外维护：

- `PreviewHost`；
- tab-local preview cache；
- preview `pending` / `ready` phase；
- `PreviewDrawerLoading`；
- `PreviewCacheSync`；
- `ArticleQueryProvider` 和 `CommentQuerySeed`。

这些代码不是业务功能本身，而是用来弥合 RSC 导航与客户端 Drawer 之间的时间差。

## 3. Drawer preview：为什么 Community 更自然

### 3.1 Community 的策略：ready 后打开

```text
点击文章
  ↓
列表保持原样
  ↓
loader 并行获取 post + comments
  ↓
Query cache hydration
  ↓
Drawer 一次性挂载完整内容
```

老帖子通常命中 Query cache；新帖子虽然需要请求，但用户看到的是稳定的列表，而不是一个空 Drawer。当前 Community 的 `post`、`comments` 查询分别设置了短期 `staleTime` 和较长 `gcTime`，因此重复打开的成本很低。

这种策略的代价是：如果线上请求明显变慢，Drawer 会延迟出现。它不是没有等待，而是把等待放在 Drawer 之前。应通过线上 p50/p95 preview latency 验证，而不是用本地开发服务器代替线上结论。

### 3.2 Main 的策略：先打开，再填充

Main 需要让 Drawer 外壳尽快出现，因此采用：

```text
点击文章
  ↓
PreviewHost 立即进入 pending
  ↓
有缓存：先展示 snapshot
无缓存：展示 Drawer skeleton
  ↓
RSC intercepted route 返回
  ↓
真实内容替换 snapshot / skeleton
```

这能让 Drawer 的进入动画更早开始，但必须处理缓存快照是否过期、真实 route 是否已经 ready、评论是否重复请求、返回时如何恢复状态等问题。

### 3.3 产品取舍

| 策略                    | 优点                                  | 代价                                      |
| ----------------------- | ------------------------------------- | ----------------------------------------- |
| Community：ready 后打开 | 无空 Drawer；状态简单；hydration 一致 | 慢请求时 Drawer 出现较晚                  |
| Main：立即打开          | 反馈更快；动画连续；可显示缓存内容    | 需要 preview cache、skeleton 和多阶段同步 |

对于 Community 当前的产品体验，ready 后打开更自然。只有产品明确要求“点击后 Drawer 外壳必须立即出现”时，才需要引入 Main 类似的 snapshot/skeleton 机制。

## 4. SSR、Streaming 与 SEO

TanStack Start 支持 full-document SSR、streaming SSR 和 selective SSR。TanStack Router 还支持 deferred data：关键数据可以先返回，慢数据通过 `defer`、`Await` 和 Suspense 边界继续流入。

页面可以拆成：

```text
首段 SSR HTML：
  header
  title / article heading
  article body
  canonical / meta / structured data
  footer

后续 stream：
  comments
  related posts
  sidebar
  statistics
```

SEO 关键原则：

- `title`、description、canonical、OG/Twitter card 必须在首轮 SSR 中确定；
- 文章标题、正文和结构化数据不要 defer；
- comments、相关文章、推荐内容和非首屏统计可以 defer；
- route head 所需的 `projectCommunityHead` 数据必须留在首屏 query；
- Suspense fallback 应提供稳定的 HTML 结构，避免布局跳动。

因此，TanStack 的 streaming 不等于“客户端渲染”，也不要求把 SEO 内容推迟到 hydration 后。正确做法是：首屏 HTML 保证关键内容，非关键区域增量流式补齐。

实现上需要注意：普通 route loader 默认倾向于等待 loader 完成后再渲染。要获得部分 streaming，必须显式区分快慢数据，不能把所有请求都放在一个 `await Promise.all(...)` 后再返回完整页面。

当前 Community preview 为了避免空 Drawer，仍然可以保留完整 post 的 gating；普通详情页可以考虑只等待 post/head，把 comments 和相关文章改成 deferred boundary。

参考：

- [TanStack Start Overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- [TanStack Router Deferred Data Loading](https://tanstack.com/router/latest/docs/guide/deferred-data-loading)
- [TanStack Router SSR](https://tanstack.com/router/latest/docs/how-to/setup-ssr)

TanStack Start 也提供 Server Components，但当前官方文档仍标记为 experimental。Community 不应为了实现 streaming 而强行引入 RSC；普通 SSR + deferred data + Suspense 已经覆盖主要需求。

## 5. 数据获取与缓存

### 5.1 Community

Community 的推荐数据链路是：

```text
route loader
  ↓
TanStack QueryClient.ensureQueryData
  ↓
dehydration / hydration
  ↓
useQuery / useSuspenseQuery
```

同一个 Query key 可以在 loader 和组件之间复用，因此组件首次渲染直接读到 success data。路由缓存和 Query cache 的职责也可以分开：

- Router cache：决定路由是否需要重新执行 loader；
- Query cache：管理 post、comments 等 server state 的 freshness 和复用；
- HTTP/CDN cache：管理公开响应的跨请求复用。

### 5.2 Main

Main 同时使用：

- Next Data Cache / `use cache`；
- `cacheLife` 和 `cacheTag`；
- intercepted route 的 RSC payload；
- preview tab-local cache；
- TanStack Query seed；
- Client Component 状态。

这些能力各自合理，但需要明确数据的 authority，否则容易出现“服务器缓存有一份、RSC 有一份、Query 又有一份、preview snapshot 还有一份”的同步问题。

### 5.3 结论

TanStack 的优势不是缓存能力更多，而是缓存边界更容易保持单一和显式。Next 也可以搭配 TanStack Query，但那通常是将两种数据模型叠加，而不是消除 RSC 的数据边界。

## 6. Bundle size 与请求数

### 6.1 不应宣称 TanStack 天然更小

Next 的 Server Components 在正确使用时可以把重依赖留在服务端，也可能产生更小的客户端 JS。因此“TanStack 框架一定比 Next 小”是不成立的。

更准确的判断是：TanStack 让首屏依赖边界更容易被应用代码直接控制。

### 6.2 Community 当前获得的实际收益

Community 当前的首屏优化主要来自：

- Vite/route code splitting；
- CommunityDigest 和 PostItem 的 layout scope；
- icons 直接跟随引用组件或按 route 合并；
- Markdown renderer lazy load；
- wallpaper catalog/renderer 不进入普通帖子首屏；
- `/post` 不静态引入 changelog、doc、kanban 的业务 query wiring；
- preview 能力不强行进入列表首屏。

`docs/tanstack_rewrite/v2.md` 记录了 `/demo/post` 的首屏基线：当前首屏 JS gzip 约 `371.1 KiB`，Markdown renderer 已移出首屏 preload。这个结果说明的是当前依赖拆分策略的收益，不是 TanStack 单独贡献的固定数字。

`docs/tanstack_rewrite/community_baseline.md` 还记录了同一轮本地 production build 的方向性比较：Community client chunk 的逐文件 gzip 总和约 `969,939 B`，Main 约 `1,193,838 B`。两者构建器和 route 集合不同，这个数字不能当作真实网络传输量或严格框架基准。

### 6.3 Bundle 的正确验收口径

每次比较必须固定：

1. 同一 production build 配置；
2. 同一社区和数据集；
3. 同一路由，例如 `/demo/post`；
4. 同一浏览器缓存状态；
5. 首屏实际 modulepreload 清单；
6. raw bytes、gzip bytes 和实际 transfer size 分开记录。

同时观察：

- modulepreload 数量；
- 首屏 JS gzip；
- 独立请求数；
- 请求瀑布；
- route navigation 到 Drawer ready 的时间；
- hydration error；
- JS heap 和长期驻留的 Query/cache 对象。

重点不是把所有文件压成一个大 chunk，而是让 `/post` 首屏只加载它真正需要的 framework、query runtime、layout、icons 和业务 wiring。

## 7. 路由、类型和调试体验

### 7.1 TanStack 的优势

TanStack Router 对以下内容提供更直接的类型约束：

- route params；
- search schema；
- loader context；
- loader data；
- route-level pending/error/not-found；
- link target；
- preload 和 masked navigation。

错误通常可以沿着 route tree、loader 和 Query key 追踪，不需要先理解 RSC payload 的内部结构。

### 7.2 Next 的优势和代价

Next 的文件约定、`loading.tsx`、`error.tsx`、parallel routes 和 intercepted routes 可以快速建立常见页面，但复杂交互中会出现更多隐式边界：

- 文件目录影响渲染拓扑；
- Server Component / Client Component 影响依赖进入哪个 bundle；
- `loading.tsx` 隐式创建 Suspense boundary；
- RSC payload 与客户端状态需要同步；
- Data Cache、Router cache 和客户端 cache 的失效路径不同。

这不是 Next 无法调试，而是需要同时掌握更多框架内部机制。

## 8. 部署与运行时

TanStack Start 的 server entry 使用通用 Fetch handler，适合 Cloudflare Workers 和其他 WinterCG 运行时；路由、server functions、middleware 和 response headers 也保持显式控制。

这与当前 Community 的部署目标更一致：

```text
Cloudflare Worker
  ↓
TanStack Start server entry
  ↓
SSR / route loader / GraphQL proxy
  ↓
Phoenix API
```

Next 也支持 Node、Edge 和多种部署方式，但其最佳路径更偏向 Next/Vercel 的运行模型。对于 Groupher，部署灵活性和 Worker 兼容性是 TanStack 的现实收益，而不是抽象上的偏好。

参考：[TanStack Start Server Entry Point](https://tanstack.com/start/latest/docs/framework/react/guide/server-entry-point)

## 9. 代价与风险

TanStack 并非没有代价：

- TanStack Start 当前仍处于 Release Candidate 阶段，升级时需要锁定版本并执行完整验证；
- Next 的 Server Components、Image、Font、Vercel 集成和生态成熟度更高；
- TanStack 允许更自由的架构，但也意味着团队需要自己定义缓存、错误、权限和部署约束；
- streaming 如果没有正确设置 critical/deferred 边界，可能让首屏内容不完整或造成布局跳动；
- route loader 如果无差别等待所有请求，仍然会产生“点击后等待”的体验；框架不会自动替我们选择哪些数据应该 defer。

因此，迁移不是把 Next API 换成 TanStack API，而是把数据、路由和 UI 的边界重新明确。

## 10. Groupher 的推荐边界

| 场景                                 | 推荐                         | 原因                                                 |
| ------------------------------------ | ---------------------------- | ---------------------------------------------------- |
| Community list/post/changelog/kanban | TanStack Start               | 交互密集、路由状态多、需要显式 loader/cache/pending  |
| Drawer preview                       | TanStack Router masked route | route 与 Drawer 生命周期可控，避免 RSC/client 同步层 |
| Comments、vote、filter、pagination   | TanStack Query + Router      | server state 和导航状态边界清晰                      |
| SEO 关键内容页                       | TanStack Start 或 Next 均可  | 两者都支持 SSR；按项目复杂度选择                     |
| 纯内容、低交互页面                   | Next 或 TanStack 均可        | 重点是缓存、SEO 和运营生态                           |
| Cloudflare Worker 首选路径           | TanStack Start               | Fetch/WinterCG 运行时边界更直接                      |
| 现有 Main                            | 暂不要求迁移                 | 先控制 preview/cache 复杂度，避免扩大迁移面          |

最终建议：

1. Community 继续以 TanStack Start 为主运行时；
2. 普通详情页引入 critical/deferred 数据分层，保留 SEO 首屏 HTML；
3. preview 继续使用“核心内容 ready 后打开”的简单策略；
4. 只有产品要求立即显示 Drawer 外壳时，才引入 Main 类似的 snapshot/skeleton；
5. 使用 `v2.md` 和 `community_baseline.md` 作为 bundle 量化依据；
6. Main 与 Community 共享 Core 语义，不共享各自框架的路由实现。
