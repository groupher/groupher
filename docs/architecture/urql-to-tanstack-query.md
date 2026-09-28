# urql 迁移到 TanStack Query

> 历史实施记录：下文的 Main/Dashboard 名称用于界定当时的迁移范围；两个 Next workspace
> 现已由 Community/Dash 替代并删除。

> 状态：全链路 urql runtime 替换与 Phase 8 领域收口已经完成（2026-08-20）。
> Main/Core/Dashboard/Dash 的 urql consumer、Provider、类型依赖和根依赖均已删除；Doc detail、
> tagGroups、comment public/viewer ownership、article/comment optimistic intent 以及目标范围内的
> Valtio server-state 双读均已收口。
>
> 2026-08-29 后续重组：公共 SSR no-user-spec、`Q.viewer` canonical batch、theme first-paint、
> `Q.dsb.config`、`DsbEditStore`、TanStack save mutations、按领域 response normalizer、Dsb editor UI
> owner、confirmed reconcile 与 server-owned cache-tag revalidation 已在本地实现。执行顺序与唯一外部发布门见
> [`workflow_query_store_reorg.md`](../dash/query-store-workflow.md)，
> 具体缓存与 Dsb 合同见 [`tanstack_rewrite/query_sync_cache.md`](../migrations/tanstack/query-sync-cache.md)
> 与 [`dashboard_store_reorg.md`](../dash/store-reorganization.md)。真实 Cloudflare purge/跨 PoP 证据仍需
> 部署凭据。
>
> 本文的 optimistic contract 只保证当前内存 QueryClient。跨刷新保留当前 viewer 已确认写入的
> 后续提案见
> [`tanstack_rewrite/optimistic_read_your_writes.md`](../migrations/tanstack/optimistic-read-your-writes.md)，
> 其前置 operation identity、inverse patch、queueKey 和 confirmed transition 见
> [`tanstack_rewrite/optimistic_operation.md`](../migrations/tanstack/optimistic-operation.md)；客户端 O1/O3/O4/O5
> 接线已落地，Article/Comment reaction 与 Comment entity 的 commandId/revision、receipt、private
> reconcile 和严格跨刷新 guard 已接通；SSR 首帧旧 public HTML 的短暂 flash 仍按 RYW 文档的边界接受。
>
> 范围：`frontend/main`、`frontend/dashboard`、`frontend/dash` 以及它们使用的
> `frontend/core` server-state 链路。迁移按垂直业务切片进行，允许短期双 runtime，
> 但不再把 Dashboard/Dash 的 urql 兼容视为长期边界。
>
> 目标架构覆盖说明：本文记录的 Community/Dash proxy `revalidateTag` 是已落地的历史桥接，不再是长期合同。
> 本次改造按 [`public-cache-invalidation.md`](./public-cache-invalidation.md) 直接切换为 Phoenix
> `PublicCache.Invalidation` outbox + Oban worker + Cloudflare；同时按本文“Query invalidation 通用能力”一节收口
> 浏览器 Query cache。切换时删除旧 proxy/facade，不保留兼容入口。
>
> 2026-09-26 后续 direct cutover 已将 ArticleStats `reactionCounts` 改为
> `emotionCounts: ArticleEmotionCount[]`，数据由 `cms.article_emotion_counts` typed 行提供；旧 key 没有保留 alias、双读或
> merge。实施合同见 [`article-emotion-counts.md`](./article-emotion-counts.md)。

## 实施结果

- `frontend/main` 的文章列表、Changelog、Kanban、Post/Changelog/Doc detail 与 preview、评论
  主体链路均由 TanStack Query 持有。Doc cover 与 public tree 仍是边界明确的独立数据集。
- `useArticle()` 只读取严格的 `ArticleQueryContext`，缺少 Provider 时 fail-fast；ArticleStore
  已删除 post/changelog/doc、指标与标签等 server fields，只保留 FAQ 子视图等 Doc 页面本地 UI
  state；cover/detail 页面形态由路由入口决定。
- 默认列表、详情与评论使用 request-scoped QueryClient 预取并 dehydration；浏览器使用稳定
  QueryClient hydration，fresh query 不重复请求。
- 公共 article/comment 数据和当前用户 viewer state 使用不同 query key；公共 SSR 评论会
  移除 viewer 字段后再进入跨请求缓存和 dehydration。
- article/comment mutation 已集中实现 optimistic patch、snapshot、rollback、server reconcile
  和精确 invalidate；comment reaction 同时更新 public aggregate 与 viewer-owned flags，快速
  toggle 通过同实体 operation lane 与最终意图缓冲收敛。article upvote 同样按实体合并最后意图，
  命令式 Mutation settle 后立即退出 mutation cache。
- Article view 通过独立的 `trackArticleView` mutation 记录 durable event，服务端以 event identity 幂等接受
  并由 worker 推进 `ViewSummary`；客户端不伪造 `views + 1`，`viewerHasViewed` 继续由独立
  viewer/read-state 查询读取。公开 `views` 由 ArticleStats 读取，不回写 Article content。
- Post/Changelog 的 `tagGroups` 已由 `Q.article.tagGroups` + SSR prefetch/hydration 持有，
  `useActiveTag` 不再读取 ArticleList store；dead update adapter、`activeTagStats` fallback 与
  `resState` 写入已删除。
- Main、Dashboard Next 与 Dash host 均只挂载 Query Provider。`urql`、`@urql/core`、
  `@urql/exchange-retry`、`@urql/next`、GraphQLProvider 与 `useGraphQLClient` 已从业务源码和根依赖
  删除，并增加静态迁移门禁防止回流。
- 删除 urql 时留下的临时 `~/hooks/useQuery` 已经移除，不再模拟 urql `requestPolicy`。稳定领域
  查询进入 `Q.*` factory；少量页面私有 typed GraphQL read 通过 `graphqlQueryOptions` 明确接入
  TanStack `useQuery`，freshness、polling、enabled 和 refetch 行为由调用点直接声明。
- ArticleList 与 Comments store 已删除列表、summary、participants、tagGroups 等 Query 数据副本；
  Account Valtio store 已整体删除，session 的 SSR seed、浏览器 probe 和 logout 只进入 TanStack Query。
  Dashboard 的 overview 与 CMS 只读列表直接读取 Query；表单字段、`original/touched`、拖拽与编辑
  草稿继续保留在 Valtio，因为它们是可修改的 working copy，而不是 Query cache 的只读镜像。
- 生产基线 `https://groupher.com/home/post` 实测返回 `x-vercel-cache: HIT`、
  `x-nextjs-prerender: 1`。本次改动部署后仍应把同一检查作为 release gate，确认平台配置
  没有改变。
- TanStack DB 评估结论为保持 Query-only；依据与重新评估条件见
  [`tanstack_query_db.md`](./tanstack-db.md)。

Phase 0-7 落地时的自动验证基线为：Main/Core 161 个测试文件、647 个用例通过；
Core/Main/Dashboard/Dash 类型检查通过；GraphQL repository/static/generated 三组契约通过；
Main production build 通过。Phase 8 新增 comment ownership、reaction、shape routing、tagGroups、
SSR filter、payload reconcile 与 urql 静态门禁测试；发布后仍需复验生产 URL 的 CDN cache header。

Phase 8 本地验收：Core/Main/Dashboard/Dash 类型检查通过；Main 与 Dash production build 通过；
GraphQL 三组契约及 urql 静态门禁通过；75 个后端 comment mutation 用例通过；迁移相关前端回归
通过。Dashboard production build 已完成编译和类型检查，但静态生成
`/[community]/appearance/theme` 时 GraphQL endpoint 返回 HTML，`Response.json()` 失败；连续两次结果
一致，属于构建环境数据源阻塞而不是本迁移的编译回归。Analytics 已增加 visibility 暂停、60 秒
轮询、mount refetch、stale/unavailable 降级与 demo-mode 禁止请求的组件契约测试；真实环境仍用于验证
浏览器节流、focus 与后端响应。当前仓库全量前端测试为 194 个文件、792 个用例，全部通过。

## 背景

迁移前，Main 同时存在三套与服务端数据相关的机制：

- Next.js Server Component loader 通过 `gqFetch` 或 `gqAuthFetch` 请求 GraphQL；
- 浏览器通过全局 urql Provider、声明式 `useQuery` 或命令式
  `useGraphQLClient` 请求 GraphQL；
- 查询结果通常再次写入 Valtio store，由 store 驱动文章列表、文章详情、评论和
  loading 状态。

迁移前链路大致是：

```text
SSR
  Next page/layout
    -> server GraphQL loaders
    -> gqFetch
    -> Phoenix GraphQL
    -> Valtio Provider initData
    -> UI

Client
  urql query/mutation 或 /api/posts
    -> Phoenix GraphQL
    -> 手工 commit 到 Valtio store
    -> UI
```

这导致 urql cache 不是 UI 的主要数据源。文章列表、详情和评论之间即使存在实体
关联，最终仍由各自的 Valtio store 保存副本，mutation 后需要手工寻找并更新这些
副本。urql 的缓存行为因此不够显式，也难以判断某个组件当前读取的是 urql cache、
SSR 初始值还是 Valtio 中后续写入的数据。

社区交互又需要满足下面这些要求：

- 点赞、取消点赞、评论和 emotion reaction 必须立即反馈；
- mutation 失败时能够回滚；
- 同一篇文章可能同时出现在列表、详情和预览抽屉；
- 公共文章数据可以被 CDN 和 Next 跨请求缓存；
- 当前用户是否 viewed、upvoted、commented 或 reacted 不能进入公共缓存；
- 服务端确认 mutation 后，需要刷新相应公共缓存，但不能让浏览器直接掌握缓存
  管理权限。

## 决策

- 使用 TanStack Query 管理浏览器中的 server state，包括请求生命周期、缓存、
  freshness、重试、失效、SSR hydration 和 mutation。
- GraphQL 继续作为传输协议。TanStack Query 不替代 GraphQL schema，也不要求把
  GraphQL 改成 REST。
- 保留 Next.js `use cache` 作为公共 SSR 数据的跨请求缓存。TanStack Query 的
  `QueryClient` 不是这层缓存的替代品。
- 公共 SSR 默认不读取 Cookie 或 Header。用户特定状态在客户端到达后单独请求并
  合并到 view。
- user-specific 数据统一进入 `Q.viewer` 命名空间；query key 使用 community、thread、
  `innerId` 等稳定实体身份，不用列表 offset 定位。公共实体与 viewer state 只在 selector/hook
  返回的渲染 view 中组合，不缓存第三份 ViewModel。
- 默认文章列表由 SSR 输出并允许公共缓存；带筛选条件的文章列表在客户端请求，
  不再为了 filtered URL 将整个页面强制变成动态 SSR。
- Query 成为已迁移 server state 的唯一客户端数据源。不得再把同一份 Query 数据
  镜像写入 Valtio。
- Valtio 继续管理 UI state，例如弹窗、编辑器草稿、折叠状态、选中项和临时交互
  状态。本阶段只完成职责分层，不因 UI state 数量较少而额外引入 TanStack Store。
- Dsb 已确认配置由 `Q.dsb.config` 持有；可编辑 Dash 的未保存字段、`original` 和 touched
  由专用 `DsbEditStore` 持有。只读页面不再创建通用 Dsb Valtio store。
- 可导航、可分享、刷新后需要恢复的页面状态由路由或 URL 管理。例如
  `isArticleLayout` 不应存入 Valtio：`/[community]/doc` 是 Doc cover，
  `/[community]/doc/[id]/[slug]` 是 Doc article，页面形态可直接由 route segment 推导。
- 当前正式方案保持 Query-only，不引入 TanStack DB。跨 detail/list/viewer 的实体同步由集中式
  mutation/cache helper 负责；只有这些 helper 被实际复杂度证明无法可靠维护，并且 DB 的收益
  足以覆盖约 71 KiB gzip 的增量后，才重新评估 normalized collections 和 live query。
- urql runtime、Provider 和依赖已经退出全部应用。后续不保留 urql 风格的 query option 或
  `requestPolicy` 兼容语义；每个查询直接声明 TanStack Query 的 freshness、refetch、polling 和
  placeholder 行为。

## 非目标

本迁移不负责：

- 重构与 Query 迁移无关的 Phoenix GraphQL schema；`createComment`/`replyComment` 为返回
  server-confirmed comment 与 article count 所需的窄 payload 调整属于本轮范围；
- 修改 Auth Session、Cookie、refresh、`401` 或 `403` 合约；
- 实现文章 collect 按钮、mutation 或 `viewerHasCollected` viewer state；
- 默认将 user-specific 数据放入 SSR HTML；
- 把所有 Valtio store 替换成 TanStack Store；
- 在第一阶段引入 TanStack DB；
- 拆分 `@groupher/rich-editor/style.css`；
- 动态加载 CommunityDigest 的 Classic、Hero、Sidebar 布局；
- Dashboard editing/demo store 不在历史 urql Phase 中处理；本轮已按
  [`dashboard_store_reorg.md`](../dash/store-reorganization.md) 收口；
- 重构 Wallpaper 编辑器/runtime。
- 为 Kanban 卡片增加 upvote count/viewer state 和交互。当前 `groupedKanbanPosts` 不查询
  `upvotesCount` 或 viewer 字段，卡片上的 Upvote 仅为展示壳且没有 `onAction`；本轮接受该现状，
  不把 Phase 3 的 Post/Changelog 一致性完成标准扩展到 Kanban。
- 为普通 `createXxx` 引入创建请求去重协议。创建 mutation 本轮统一 `retry: false`；Article 创建
  身份与断线重放在 Article Editor 生命周期中另行设计。
- 完善 report 的 optimistic、快速重复提交或后端幂等语义。为退出 urql 可以迁移其 transport，
  但本轮只在成功后精确失效 viewer/comment state，不扩展 report 产品行为。

Rich Editor 的 viewer/editor CSS 拆包需要在独立的
`@groupher/rich-editor` 项目和 package export 中处理。Main 后续只负责在正确的
页面或组件边界按需引入，不应继续从 root layout 全局引入完整 editor CSS。

CommunityDigest 的布局动态加载曾导致 SSR 与 hydration 之间闪烁。本迁移不以牺牲
首屏一致性换取这部分 bundle 减少；除非未来改成服务端确定布局并输出同一变体，
否则继续保留当前静态布局加载方式。

## 数据所有权

迁移后每一层只负责一种状态：

| 层               | 所有权                                                              | 不负责                    |
| ---------------- | ------------------------------------------------------------------- | ------------------------- |
| Phoenix          | 持久化后的业务真值、权限和计数                                      | 浏览器 optimistic overlay |
| CDN / Vercel     | 可公开复用的 HTML/RSC 响应                                          | 当前用户状态              |
| Next `use cache` | 公共 GraphQL loader 的跨请求缓存                                    | 浏览器 query freshness    |
| TanStack Query   | 浏览器 server state、请求状态、hydration、mutation、已确认 Dsb 配置 | 弹窗和未保存编辑值        |
| Valtio           | 本地 UI state、Dsb 未保存字段、组件协作状态                         | 已确认的服务端数据副本    |
| Route / URL      | 页面形态、文章列表筛选、分页和可分享导航状态                        | 查询结果本身              |

原则：同一份数据在客户端只能有一个可写 owner。

例如迁移文章列表后：

```text
错误
  useQuery(Q.article.posts(filter))
    -> useEffect
    -> articleList$.commit({ pagedPosts })
    -> UI 读取 articleList$.pagedPosts

目标
  useQuery(Q.article.posts(filter))
    -> UI 直接读取 query.data
```

如果组件仍需要组合 server state 和 UI state，应分别订阅 Query 与 Valtio，不要把
Query 结果复制到 Valtio。

## Query API 与目录边界

对业务代码统一暴露 `Q` query factory。调用形态采用：

```ts
Q.article.posts(filter)
Q.article.changelogs(filter)
Q.article.detail(path)
Q.article.tagGroups(community, thread)
Q.comment.list(articlePath, filter)
Q.viewer.session()
Q.viewer.articleStates(accountRef, articleRefs)
Q.viewer.commentStates(accountRef, articleRef, commentRefs)

Q.SSR.article.posts(filter)
Q.SSR.article.changelogs(filter)
Q.SSR.article.detail(path)
Q.SSR.article.tagGroups(community, thread)
Q.SSR.comment.list(articlePath, filter)
```

`Q.article.posts(filter)` 和 `Q.SSR.article.posts(filter)` 必须生成相同的
`queryKey`，区别只在 `queryFn`：

```text
Q.article.posts
  browser queryFn
  -> same-origin API
  -> authenticated browser GraphQL transport when required

Q.SSR.article.posts
  server queryFn
  -> public cached loader
  -> anonymous server GraphQL transport
```

建议提供两个模块入口，防止 client bundle 静态引用 server-only 代码：

```ts
// Client Component
import { Q } from '~/query'

// Server Component
import { Q } from '~/query/server'
```

客户端入口不应导入 `Q.SSR` 的实现。服务端入口可以在同一个 `Q` namespace 上增加
`SSR` 分支，从而保留统一调用语义。

建议目录：

```text
frontend/core/query/
  key.ts                 canonical key 和 filter normalize
  article.ts             Q.article
  comment.ts             Q.comment
  viewer.ts              Q.viewer
  client.ts              QueryClient 和 browser query factories
  server.ts              server-only Q.SSR
  mutation/
    article.ts          stable re-export facade
    article/            cache/schema/upvote
    comment.ts          stable re-export facade
    comment/            cache/lifecycle/reaction/moderation
    dashboard/           Dashboard/Dash 领域 mutation；不暴露 QueryClient 给组件

frontend/core/graphql/
  document.ts            transport-neutral GraphQL document helper
  client.ts              browser /api/graphql transport 和 Auth retry
  server.ts              publicQuery/authQuery transport
```

文件名可以在实施时贴合现有 alias，但下面的边界必须保留：

- query factory 不依赖 React 组件；
- query key 不重复声明；
- server-only loader 不进入客户端依赖图；
- GraphQL document 不再直接从 `urql` 导入 `gql`；
- GraphQL transport 不包含 Query cache 语义；
- `cached` 不出现在业务 query key 中。
- 业务组件不直接调用兼容式 `useGraphQLClient`；持续读取用 `useQuery`，命令式预取/读取用
  `queryClient.fetchQuery`/`ensureQueryData`，写操作用领域 `useMutation` hook；
- 不得新增一个内部仍调用 urql、只把名字改成 Query 的 wrapper。兼容 adapter 只能作为有明确
  删除任务的短期迁移边界。

不要创建下面这些互相重复的业务查询：

```ts
Q.article.posts(filter)
Q.article.postsFilter(filter)
Q.article.cachedPosts(filter)
```

筛选条件属于 `posts(filter)` 的参数；`use cache` 属于 SSR loader 的实现细节。

## Query key 规范

Query key 必须是稳定、可序列化、可按前缀失效的 tuple：

```ts
const postsKey = ['article', 'posts', normalizedFilter]
const changelogsKey = ['article', 'changelogs', normalizedFilter]
const articleKey = ['article', 'detail', community, thread, innerId]
const commentsKey = ['comment', 'list', community, thread, innerId, normalizedFilter]
const viewerStateKey = ['viewer', accountRef, 'article-state', normalizedArticleRefs]
```

规则：

- 所有默认值在进入 key 前标准化，例如 `page: undefined` 和 `page: 1` 必须得到同一
  key；
- 空字符串、`null` 和 `undefined` 不得为同一筛选语义制造多个 key；
- filter 对象字段顺序由 factory 固定，业务组件不得手写对象 key；
- mutation 可以使用 `['article', 'posts']` 前缀更新所有已加载列表；
- 所有用户实体 query 必须包含稳定的 `accountRef`；登录用户变化时清除所有 viewer queries；
- token、Cookie 和其他 secret 不得进入 query key。

## GraphQL transport

TanStack Query 调用用户提供的 `queryFn`，不会自动把 GraphQL POST 变成 Next.js
公共缓存请求。因此 transport 和 cache 必须分开设计。

transport 收敛为三个明确边界：

```ts
publicQuery(document, variables)
authQuery(document, variables)
browserGraphQLRequest(document, variables, options)
```

语义：

- `publicQuery` 不读取当前 request 的 Cookie/Header，可安全地位于 `use cache`
  loader 内；
- `authQuery` 读取当前 request，只转发 canonical Groupher auth token，不能在
  `use cache` 内调用；
- `browserGraphQLRequest` 以成熟的 `graphql-request` 作为标准 GraphQL transport，并用一层很薄的
  Groupher adapter 请求 same-origin `/api/graphql`，统一 credentials、CSRF header、Cookie、
  demand-driven refresh、一次 replay、错误形状和 `AbortSignal`；
- 该 adapter 只负责传输，不拥有 cache、retry 或请求状态。query/mutation 生命周期全部由
  TanStack Query 声明；不再维护功能重叠的自研 `browserQuery`；
- GraphQL validation/business error 不自动重试；
- query 的 network error 延续当前有上限的 retry；
- mutation 默认不自动 retry，只有后端已经明确提供幂等 set-state 语义的 operation 才能逐项
  开启；
- 所有 `createXxx` mutation 固定 `retry: false`。本轮不把普通创建强行改造成可重放 operation；
  超时后的未知结果由重新读取目标列表/详情确认，不能自动重发。

`gqFetch`/`gqAuthFetch` 可以在迁移中被上述 transport 取代或改名，但不能直接删除
“匿名公共请求”和“请求感知的鉴权请求”之间的语义边界。

## QueryClient 生命周期

客户端和服务端不会共享同一个 `QueryClient` 实例：

```text
Server request A -> request-scoped QueryClient A
Server request B -> request-scoped QueryClient B

Browser tab A -> stable browser QueryClient A
Browser tab B -> stable browser QueryClient B
```

SSR 通过 `dehydrate`/`HydrationBoundary` 把服务端 Query cache 的快照交给浏览器，
不是把服务端实例本身传给浏览器。

这个衔接由 TanStack Query 提供标准机制，但应用仍需完成框架接线：服务端使用
request-scoped `QueryClient` 执行 `prefetchQuery` 并 `dehydrate`，浏览器 Provider 持有稳定
`QueryClient`，`HydrationBoundary` 按相同 `queryKey` 恢复快照。SSR 实例与浏览器实例不会、
也不需要互相同步引用。

客户端交互发生后，只更新当前浏览器的 QueryClient：

```text
browser mutation
  -> cancelQueries + optimistic setQueryData
  -> Phoenix 写入 DB
  -> mutation response 合并 server-confirmed 数据
  -> invalidateQueries / refetch 使当前 tab 收敛

Phoenix domain transaction（仅需要刷新公共 HTML 的变化）
  -> write PublicCache.Invalidation outbox
  -> Oban worker 直接 purge Cloudflare tag
  -> 后续 SSR/CDN 请求收敛
```

其他 tab 不会自动得到同一份内存 cache；继续依赖 focus refetch、现有 Session channel，
或在确有实时需求时显式增加 BroadcastChannel。

TanStack Query 自带：

- `QueryClient`、cache、请求去重、stale/refetch 和 mutation 生命周期；
- `dehydrate`、`hydrate`/`HydrationBoundary`；
- `cancelQueries`、`setQueryData`、`invalidateQueries`、rollback 所需的基础能力。

Groupher 仍需维护：

- query key、public/viewer 数据所有权和公共字段裁剪；
- Next 中“服务端每请求一个 client、浏览器稳定一个 client”的创建边界；
- 同一 article/comment 在 detail、分页 entries、REPLIES 嵌套 replies 和 TIMELINE entries 中的
  定位规则；
- mutation 对 list/detail/preview/viewer cache 的 fan-out、快照、回滚和服务端确认合并；
- 临时 comment/reply 的插入、真实实体替换、失败删除和关联 count 恢复；
- 快速 toggle 的串行、最终意图合并和过期响应保护；
- 服务端控制的列表归属、排序和跨页位置何时通过 invalidate/refetch 收敛；
- 浏览器 query invalidation 的 typed target mapping；
- Phoenix 领域变化与公共 CDN cache scope 的映射；
- logout、账号切换、跨 tab 收敛策略。

这些责任必须集中在 Query 领域边界，不能散落到业务组件：

```text
业务组件
  -> article/comment/dsb 领域 hook/action
  -> optimistic 生命周期
  -> article/comment/viewer cache helper
  -> QueryClient
```

约束：

1. 组件不得直接用 `setQueryData`/`setQueriesData` 修改 article 或 comment 实体；
2. 每个 mutation 必须明确 cancel、snapshot、patch、reconcile、rollback 和 invalidate 的目标；
3. public aggregate 与 viewer flag 分开持有，但一次用户操作必须一起 patch/rollback；
4. 只有客户端能够确定的字段才做精确 optimistic；服务端排名、筛选归属和跨页位置通过
   targeted invalidate/refetch 校准；
5. Query response 不复制到 Valtio，Valtio 也不作为 Query mutation 的第二写入目标。
6. 业务组件不得接触 QueryClient、cache shape、snapshot 或 rollback；这些细节只存在于
   `frontend/core/query` 的 factory、selector、mutation 和 cache adapter 中。

基础策略：

- 服务端每个 request 创建 QueryClient，避免用户数据跨请求泄漏；
- 浏览器在模块或稳定 Provider 边界复用一个 QueryClient，不能在 suspend/re-render
  时重复创建；
- SSR 已预取的公共 query 设置大于零的 `staleTime`，避免 hydration 后立即重复请求；
- user-specific query 不做公共 SSR dehydration；
- 登录、登出或账号切换时清除 viewer-scoped cache；
- 默认不持久化整个 Query cache 到 localStorage。

TanStack Query 和 TanStack DB 默认都是每个浏览器 tab 的内存状态，不会因为名称里有
`DB` 就自动跨 tab 同步。跨 tab 登录状态继续使用现有 Session channel；如果未来确实
需要文章互动跨 tab 即时同步，应显式增加 BroadcastChannel 消息或在 tab focus 时
refetch，而不是假设 cache 自动共享。

## SSR、CDN 与用户状态

### 公共页面原则

Main 的 SSR HTML/RSC 继续只包含可公开复用的数据：

- 文章列表和详情的公共字段；
- 评论列表的公共字段；
- 作者、标签、公开计数；
- Community 和公开 Dashboard 配置。

下面的数据不进入公共页面缓存：

- `viewerHasViewed`；
- `viewerHasUpvoted`；
- 当前用户对 article/comment 的 emotion；
- 当前用户是否 joined、reported 或 subscribed；
- 其他由当前身份决定的字段。

这些字段在客户端查询完成前应为 `undefined`/`unknown`，不能先展示为 `false`。否则
页面会先显示“未点赞”，随后闪成“已点赞”。

### 默认文章列表

目标时序：

```text
Browser -> CDN/Vercel: GET /home/post
CDN/Vercel -> Browser: cached public HTML/RSC

Next SSR on cache miss
  -> Q.SSR.article.posts(defaultFilter)
  -> existing use cache loader
  -> publicQuery(P.pagedPosts)
  -> QueryClient prefetch
  -> dehydrate
  -> PostThread SSR

Browser hydrate
  -> Q.article.posts(defaultFilter)
  -> 命中 dehydrated data
  -> staleTime 内不重复请求
  -> Q.viewer.session()
  -> Q.viewer.articleStates(accountRef, visibleArticleRefs)
  -> 将当前用户状态合并进 view
```

### 带筛选参数的文章列表

已接受的目标是优先保持默认页面公共缓存：

```text
GET /home/post?tag=react&order=latest
  -> SSR 公共页面外壳和默认公共数据
  -> Client 读取 URL filter
  -> 发现 URL filter 与 SSR initialFilter 不同
  -> 显示 filtered pending/skeleton
  -> Q.article.posts(urlFilter)
  -> /api/posts
  -> 展示筛选结果
```

要求：

- `post/page.tsx` 不再因为 `searchParams` 将完整页面变成 dynamic/no-store；
- 服务端只预取 canonical default filter；
- 客户端不能无条件跳过第一次 filter 同步；
- 只有 URL filter 等于 SSR initialFilter 时，才复用 SSR 列表并跳过首个请求；
- URL filter 不同时，不把默认文章列表伪装成 filtered result；
- 接受 filtered URL 不提供对应 SSR SEO 内容的取舍。

## 文章与当前用户状态的组合

公共 article 与 viewer state 使用不同 query：

```ts
type PublicArticle = {
  id: string
  title: string
}

type ArticleStats = {
  community: string
  thread: string
  innerId: string
  views: number
  viewsRevision: number
  upvotesCount: number
  collectsCount: number
  emotionCounts: Array<{ type: string; count: number }>
  interactionRevision: number
  commentsCount: number
  commentsParticipantsCount: number
  commentsRevision: number
  snapshotAt: string
}

type ArticleViewerState = {
  articleKey: string
  viewerHasViewed?: boolean
  viewerHasUpvoted?: boolean
}
```

UI 组合它们，但不把 viewer state 写回公共 SSR query：

```text
public article query ───────┐
ArticleStats query ─────────┼─> selector/hook 返回 render view -> UI
viewer article state query ┘
```

这里的 render view 不是另一个 Query model，也不会写回 cache。组合必须先校验 canonical identity：

```text
articleKey = community + thread + innerId
viewerByArticleKey[articleKey]
  -> key 完全匹配时，只覆盖 viewer-owned 字段
  -> 不匹配或缺失时，viewer 字段保持 undefined
```

禁止按可见列表 offset 合并；分页、排序、过滤或后台 refetch 后 offset 都可能变化。公共内容字段来自
public article query，公开计数来自 ArticleStats，viewer query 不能顺带覆盖它们。

viewer state 的 fetch 也必须以实体身份为输入，不能只是把分页结果转换成 keyed record：

```ts
type TArticleRef = {
  community: string
  thread: TThread
  innerId: string
}

Q.viewer.articleStates(accountRef, articleRefs)
Q.viewer.commentStates(accountRef, articleRef, commentRefs)
```

后端提供按 refs 批量查询 viewer state 的 operation。Query factory 对 refs 排序、去重，并让同一组
refs 同时决定 query key 和 request variables。最终 key 不包含 list filter、page、mode 或 offset；
`accountRef` 是所有用户实体 query key 的必需部分，且只能是 non-secret、opaque、immutable public
account ref。生产实现不再以可变 login 作为 key；仅测试 fixture 在缺少该字段时保留 login fallback。
`accountRef` 的 session contract 与原子迁移由
[Optimistic Read Your Writes](../migrations/tanstack/optimistic-read-your-writes.md) Phase R0 冻结。

### Viewer batch GraphQL 合同

目标 operation 固定为 `articleViewerStates` 和 `commentViewerStates`：

```graphql
query ArticleViewerStates($paths: [ArticlePathInput!]!) {
  articleViewerStates(paths: $paths) {
    community
    thread
    innerId
    viewerHasViewed
  }
}

query ArticleInteractionStates($paths: [ArticlePathInput!]!) {
  articleInteractionStates(paths: $paths) {
    community
    thread
    innerId
    interactionRevision
    viewerHasUpvoted
    viewerHasCollected
    viewerEmotion
  }
}

query CommentViewerStates($article: ArticlePathInput!, $commentInnerIds: [ID!]!) {
  commentViewerStates(article: $article, commentInnerIds: $commentInnerIds) {
    innerId
    viewerHasUpvoted
    viewerHasReported
    emotions {
      type
      viewerHasReacted
    }
  }
}
```

合同约束：

- `ArticlePathInput` 只包含 `community`、`thread`、`innerId`；
- 单个 GraphQL request 最多接受 100 个 article paths 或 comment ids，超过上限返回 GraphQL
  validation error；
- Query factory 对完整 paths 排序、去重并生成一个 query key；queryFn 再按 100 条自动分片、并行请求
  并按 canonical identity 合并，业务组件不感知分片；
- 任一分片失败时整个 Query 失败，不返回可能被误认为完整结果的部分 record；
- 服务端从 auth session 确定 viewer，`accountRef` 只进入客户端 query key，不作为 GraphQL variable；
- 未登录时在发起分片请求前直接返回空 record；服务端收到无有效 session 的请求也返回空数组，
  不返回身份业务错误；客户端将缺失 viewer state 保持为 unknown。
- 输入在客户端排序、去重；服务端输出顺序不承担语义；
- article 输出以 `community + thread + innerId` 标识实体，comment 输出结合请求中的 article ref 与
  `innerId` 标识实体；
- response 只包含 identity 和 viewer-owned fields，不返回或覆盖 public aggregate；
- article viewer batch 本轮只实现 `viewerHasViewed` 和 `viewerHasUpvoted`；前端 collect、
  `viewerHasCollected`、`viewerHasCommented` 和 article emotions 均不在本轮范围；
- `articleStates`、`changelogStates`、`articleState`、`commentStates` 全部由 batch operation 替换，
  并删除对应旧 queryFn、query key 和 GraphQL documents；不保留共存或 fallback；
- `ArticleQueryProvider` 使用 `Q.viewer.articleStates(accountRef, [articleRef])`，再按 canonical
  articleKey 从 record 读取单实体 viewer state；
- `commentSummary` 及其 `isViewerJoined`、total/participants summary 保留，不属于 batch
  viewer-state 合同。

评论 viewer batch 的输入 ID 由 `gatherCommentViewerIds` 产生：它递归遍历 public comment graph
中的 entries、replies 和 replyToComment，并按 innerId 去重。该命名表示“聚合查询 ID”，不是收藏
功能；article collect/收藏仍明确不在本轮范围。

评论本身是独立实体和列表，不应作为一个布尔字段塞进
`ArticleViewerState`。评论上的 upvote/emotion 也以 comment key 为作用域；如果未来
重新评估 TanStack DB，才考虑把它们建模为独立 collection。当前 Query-only 方案直接维护
comment list 中 public-owned aggregate 与 viewer-scoped comment state，不为这项同步单独引入
DB。

### Comment 浏览器 cache 的字段所有权

当前 `Q.comment.list` 和 Community SSR loader 都使用 `PublicPagedComments` selection，结构上不再
请求 `viewerHasUpvoted`、`viewerHasReported` 或 `emotions.viewerHasReacted`。因此公共 Query cache
和 dehydration 不依赖运行时递归裁剪；`Q.viewer.commentStates` 是浏览器私有 viewer 字段的唯一
owner。组件不能直接从 list response 读取 viewer 字段。

`stripCommentViewerState` 只在 create/reply/update 等可能返回混合 CommentFields 的 mutation response
边界保留，用于保证写入公共 list cache 前移除 viewer-owned 字段。旧的 paged strip/extract helper
如果没有生产 caller，应按
[`query_store_boundary_hardening.md#phase-b3退出兼容层并缩小订阅`](./query-store-boundary.md#phase-b3退出兼容层并缩小订阅)
删除，不能继续让文档暗示 public list 依赖“先请求私有字段、再裁剪”的双重合同。

`Q.viewer.commentStates` 必须直接读取自己的鉴权 response，再规范化为
`TCommentViewerStates`，不能复用 `Q.comment.list` 的公共 Query data。它的输入 ID 由
`gatherCommentViewerIds` 递归遍历 entries、`replies` 和 `replyToComment` 产生；不能只收集顶层
entry 或只沿 `replies` 递归。
组合规则固定为：

- `upvotesCount`、emotion `count`、`latestUsers` 等 aggregate 永远来自 comment list query；
- `viewerHasUpvoted`、`viewerHasReported` 永远来自 `viewerQueryKeys.commentStates`；
- emotions 按 `type` 合并，只把 viewer query 的 `viewerHasReacted` overlay 到公共 emotion；
- 禁止 spread 整个 viewer emotions 数组覆盖公共数组；viewer query 尚未返回时，viewer flag
  保持 `undefined`/unknown，公共 count 仍正常展示。

`commentStates` 的 Query data 契约固定为：

```ts
type TCommentViewerState = {
  viewerHasUpvoted?: boolean
  viewerHasReported?: boolean
  emotionFlags: Partial<Record<Exclude<TEmotionRawType, 'UPVOTE'>, boolean>>
}

type TCommentViewerStates = Record<string, TCommentViewerState> // key = comment innerId
```

它不再保存包含公共 count 的整个 emotions 数组。comment upvote/emotion 的 optimistic、rollback
和 server reconcile 必须分别更新 public-owned aggregate 与 viewer-owned flag。report 本轮只在
transport 迁移成功后精确 invalidate/refetch `viewerQueryKeys.commentStates`，其 optimistic 和快速重复
提交语义后续单独处理。

## Optimistic mutation

当前方案使用 TanStack Query mutation 和显式 cache update。不要同时更新 Query
cache 与 Valtio server-state 副本。

本节描述当前 tab 内的 optimistic/confirmed 生命周期。页面刷新后若 public SSR/CDN 快照尚未
收敛，当前实现允许 public aggregate 短暂回旧；不能把这里的 snapshot/rollback 误认为跨刷新
持久事务。当前 mutation 向精确 inverse 与 confirmed handoff 演进的合同见
[Optimistic Operation](../migrations/tanstack/optimistic-operation.md)；需要 read-your-writes 时再使用
[Optimistic Read Your Writes](../migrations/tanstack/optimistic-read-your-writes.md) 定义的 confirmed
receipt + projection revision，而不是持久化完整 Query cache。

按产品语义把 mutation 分成三类：

| 类型               | 示例                                      | 客户端处理                                                                                |
| ------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| viewer relation    | upvote、collect、emotion                  | 可以 optimistic 更新 viewer flag；公开 count 只使用服务端确认 receipt，不写 ArticleStats  |
| 内容值变化         | 编辑标题/正文                             | patch canonical content query，成功后按服务端 confirmed result 收敛                       |
| 列表归属或顺序变化 | publish、delete、status/tag/category 变化 | 本地完成能够确定的插入/移除/字段更新，再失效由服务端决定的筛选与排序结果                  |
| 临时实体           | create comment、reply                     | 可插入 pending entity；公开 comment count 等服务端确认 receipt，失败时移除 pending entity |

必须即时一致的是按钮状态、viewer flag、服务端已经确认的公开 count 和当前可见内容。按热度排序后的精确位置、
跨分页移动以及服务端筛选归属允许在 mutation 后通过 refetch 收敛；Query-only 不在客户端复制
完整的服务端 query builder。

### Article upvote 示例

```text
用户点击 Upvote
  -> 检查登录状态
  -> cancel 当前 viewer state query
  -> optimistic patch viewerHasUpvoted = nextValue
  -> browser mutation -> /api/graphql -> Phoenix
       success -> 保存 confirmed count + interactionRevision receipt
       failure -> rollback viewer state + 展示错误
  -> QueryInvalidation.article.stats(articleRef)
  -> ArticleStats revision 追上 receipt 后清除 overlay
  -> 不创建公共 HTML invalidation
```

同一 article 可能出现在 detail、列表和 Drawer 中，但这些 surface 通过 `TArticleViewModel` 组合相同 identity 的
`content + stats + viewerState`。公开 count 不再 fan-out 写入 Article content：

- viewer relation mutation 只 optimistic patch 对应 viewer key；
- server-confirmed count/revision 写入短期 receipt overlay；
- `QueryInvalidation.article.stats(ref)` 同时覆盖单篇 stats key 和包含该 entity 的已加载 `statsBatch`；
- content mutation 只 patch/invalidate Article content 与受影响的 list membership。

组件不能遍历 `articleQueryKeys.all`、按 data shape 猜测 Article，或把 count merge 回 content。Query key fan-out 由
`frontend/core/query/invalidation/article.ts` 的领域 resolver 统一描述。

按 upvote 排序的列表通过预计算 ArticleStats 排序列与精确 invalidate/refetch 收敛；客户端不自行重排跨页结果。

### View

View mutation 使用 event id 幂等，并由后端滑动窗口决定是否 counted。accepted 只写 view receipt、标记
ArticleStats stale 并在投影延迟后 refetch；客户端不设置 `views + 1`。`viewerHasViewed` 只由 viewer state 的
服务端确认结果更新。

### Comment publish/update/delete

- publish 可以先插入带临时 key 的 pending comment，但不做本地 `commentsCount + 1`；
- `createComment`/`replyComment` 固定 `retry: false`，不在本轮增加请求去重参数；
- 后端 mutation 返回明确 payload：真实 comment，以及同一事务确认的 comments count/revision receipt；
- 服务端成功后用真实 comment 替换临时 entry，以 receipt overlay 显示 confirmed count，并 invalidate ArticleStats；
- 失败时移除临时 entry，不产生 receipt；
- update 先 patch 对应 comment，失败回滚；
- delete 在确认交互后 optimistic remove，失败恢复原位置；
- reply list 和 root comment list 必须通过同一 comment mutation helper 更新；
- 编辑器 body、reply target、弹窗开关等仍属于 Valtio UI state。

GraphQL 返回契约采用明确 payload，并由后端 comment writer 从同一事务结果中返回 comment 与
Comments owner 的确认 receipt；它不是一份 ArticleStats snapshot：

```graphql
type ArticleCommentsReceipt {
  article: ArticleRef!
  commentsCount: Int!
  commentsParticipantsCount: Int!
  commentsRevision: Int!
}

type CreateCommentPayload {
  comment: Comment!
  receipt: ArticleCommentsReceipt!
}

type ReplyCommentPayload {
  comment: Comment!
  receipt: ArticleCommentsReceipt!
}

createComment(article: ArticlePathInput!, body: String!): CreateCommentPayload!
replyComment(comment: CommentPathInput!, body: String!): ReplyCommentPayload!
```

前端至少选择 `comment.innerId/bodyHtml/author/insertedAt` 和完整 `receipt`。这是前后端协调发布的 schema 变更：同步更新 resolver、typed
document、codegen、mock schema、mutation helper 和测试，不保留同时返回旧 `Comment` shape 的双
协议兼容层。

### Emotion reaction

Emotion mutation 只 optimistic 更新目标 article/comment 的 viewer relation；公共 reaction count 使用服务端确认
receipt，并等待对应 owner revision 追上：

- `viewerHasReacted` 立即切换；
- 快速连续点击需要按 mutation key 串行化、合并意图或禁用尚未确认的重复动作；
- server response 的完整 public reaction projection + revision 是最终确认值；
- receipt overlay 不写入 ArticleStats entity，也不能从旧 Query 拼接缺失字段。

推荐维护每个实体的“最后期望状态”：请求进行中时 UI 继续反映最后一次点击，中间 toggle
不逐个发送；当前请求结束后，仅当服务端确认状态仍与最后期望不同，才发送一次补偿请求。
TanStack Query 的 mutation scope 可以串行请求，但不会自动合并业务意图；幂等和防滥用仍由
Phoenix mutation 保证。

这套连续 toggle 规则只适用于后端已经实现幂等 set-state 的 upvote/emotion。普通 `createXxx`
不进入 intent buffer、不自动补偿重发；report 的重复提交与 optimistic 语义也不在本轮套用该
规则。

## Query invalidation 通用能力

本节是迁移文档中的目标摘要；长期 canonical API、目录、policy、直接切换和测试合同以
[`query-invalidation.md`](./query-invalidation.md) 为准。

TanStack Query 的失效是前端通用基础设施，但“哪些 key 受某个领域变化影响”仍由领域 resolver 拥有。目标目录：

```text
frontend/core/query/invalidation/
├─ index.ts       唯一公共导出
├─ executor.ts    通用执行、去重、refetch policy 与 telemetry
├─ types.ts       target / plan 类型
├─ article.ts     Article、ArticleStats 与 article list targets
├─ comment.ts     Comment list、reply 与 viewer targets
├─ community.ts   Community/Dsb/导航 targets
└─ viewer.ts      当前 viewer 私有 targets
```

调用方只表达领域目标，不手写 query key、predicate 或 `invalidateQueries`：

```ts
await invalidate(queryClient, QueryInvalidation.article.stats(articleRef))

await invalidate(queryClient, QueryInvalidation.article.lists({ community, thread }))
```

`executor.ts` 只负责：

- 合并重复 target，并把 target 编译成 exact key、prefix 或受控 matcher；
- active query 默认立即 refetch，inactive query 默认只标记 stale；
- 等待策略、失败 telemetry 和测试用执行结果；
- 一次 mutation 产生多个 target 时统一调度，避免重复 refetch。

默认行为由同目录的 typed policy 固定：`active -> refetch`、`inactive -> stale`、`await -> active refetch settled`。
确需不同策略的 target 必须在领域 resolver 中显式声明受限 enum，调用方不能临时传任意 TanStack filters/options，避免
通用 API 退化为 `invalidateQueries` 的无类型透传。

它不能知道 Article、Comment、Community 或 Viewer 的 key 结构。`article.ts` 等领域 resolver 必须调用对应
key owner 导出的 factory/matcher；禁止解析 query key 的数组下标，也禁止按 cache data shape 猜测类型。

```text
mutation confirmed
  -> domain reconcile / receipt
  -> QueryInvalidation.<domain>.<target>(ref)
  -> generic executor dedupe + compile
  -> queryClient.invalidateQueries(...)
  -> active refetch / inactive stale
```

边界：

- optimistic patch、rollback、server-confirmed reconcile、revision guard 和 receipt 仍属于 mutation domain；
- invalidation 层不修改实体、不计算 count、不推进 `snapshotAt`；
- ArticleStats 的单篇 key 与所有包含该实体的 `statsBatch` key 都由 `article.stats(ref)` resolver 覆盖；
- `article.lists(scope)` 只覆盖匹配的 community/thread/filter family，不清空 `articleQueryKeys.all`；
- 新领域先建立 canonical key factory 和 resolver，再允许业务调用通用 executor。

本次改造直接迁移所有散落的 `queryClient.invalidateQueries`、手写 batch predicate 与旧 helper，完成后删除旧入口；
不保留 alias、兼容 facade 或双执行路径。静态门禁禁止领域代码重新直接调用 `invalidateQueries`，仅
`invalidation/executor.ts` 和基础测试允许使用底层 API。

专属测试至少覆盖：

- exact、prefix 与受控 matcher 只命中声明的 key family；
- 重复/重叠 target 在一次执行中去重，active query 不重复 refetch；
- active 立即 refetch、inactive 只 stale，await 语义与失败 telemetry 可预测；
- `article.stats(ref)` 同时命中单篇 key 和包含 ref 的多个 normalized `statsBatch`，不命中其他 Article；
- accountRef 不匹配时 viewer target 不跨账号失效；非法/空 ref fail closed；
- mutation domain 不再直接调用底层 `invalidateQueries`，executor 不触发 CDN purge 或修改 Query data。

### 与公共 CDN invalidation 的边界

浏览器 Query cache 与公共 CDN 是两个独立执行系统：

```text
TanStack Query invalidation
  owner: frontend/core/query/invalidation
  target: 当前浏览器 QueryClient
  trigger: mutation confirmed、receipt/view projection 收敛

Public CDN invalidation
  owner: Phoenix PublicCache
  target: Cloudflare 中的公共 HTML/hydration object
  trigger: content/publish/visibility/config 领域变化
  path: transaction outbox -> Oban PurgeWorker -> Cloudflare cache-tag purge
```

两边可以从同一个用户动作开始，但不能共享 executor，也不能由浏览器把 tag 传给 Phoenix。upvote/view/comment count
通常只失效当前浏览器的 ArticleStats Query，并依赖 HTML TTL；文章发布或内容修改由 Phoenix 事务创建
`PublicCache.Invalidation`。完整协议见
[`public-cache-invalidation.md`](./public-cache-invalidation.md)。

## Valtio 迁移边界

### 从 ArticleList store 移出

- `pagedPosts`；
- `pagedChangelogs`；
- backlog/todo/wip/done/rejected 等服务端列表；
- `resState`；
- 可由 query data 或 URL 推导的 active filter；
- 与列表请求结果绑定的 tag groups/stats。

其中 tag stats 已由 `Q.article.tagStats` 持有；tag groups 在 Phase 8 新增
`Q.article.tagGroups(community, thread)` 与同 key 的 `Q.SSR.article.tagGroups`，由页面 SSR
prefetch/dehydrate，`useActiveTag` 直接从 Query 读取。完成 consumer 切换后，删除页面通过
`initData -> ArticleListStoreProvider.tagGroups` 注入 server state 的链路。

同时删除两类遗留：

- `usePagedPosts`/`usePagedChangelogs` 无生产调用者的 `update()`、`TUpdate` 和对应测试；这些入口
  仍会 `commit({ tagGroups })`，会把已删除的 server state 写回 store；
- `TagNote/useLogic` 对 `activeTagStats` 的 fallback，以及 ArticleList store 中仅初始化/读取、从未
  commit 的 `activeTagStats` 死字段。TagNote 只读取 `Q.article.tagStats`。

`tagGroups` key 会位于 `articleQueryKeys.all` 下，它也因此成为 typed shape routing 的第一个实际
落点：`patchArticleEverywhere` 只能调度已声明的 article-bearing shape adapter，不再对未知
`articleQueryKeys.all` data 做隐式 shape 猜测。`tagGroups`/`tagStats` 明确标记为 non-entity query 并
跳过；不要为它们伪造一个“article locator”。routing 必须先匹配 query key，再选择 adapter；
实现可遍历 `getQueriesData` 返回的 `[queryKey, data]`，或按已注册前缀分别调用
`setQueriesData`，不能只根据 data 长相猜测。

当前状态：Main 与 Dashboard CMS 的 Post/Changelog/Kanban reader 已使用 Query；Dash loader data
直接 seed 对应 Query key。ArticleList store 中的 `pagedPosts`、`pagedChangelogs` 与五个 Kanban
lane 已删除，只保留当前阶段的列表 UI/filter state。

### 从 Article store 移出

- 公开 article detail；
- viewer article state；
- mutation 后只为同步服务端字段而存在的 commit。

该目标已经落地：`useArticle()` 只读取 `ArticleQueryContext`，缺少 Provider 时直接报错；
ArticleStore 不再声明或注入 `post`/`changelog`/`doc` server fields。Doc route 使用
request-scoped QueryClient prefetch/dehydrate；cover/detail 由 route page 显式选择，ArticleStore
仅为 FAQ 子视图等页面本地 UI state 保留 Valtio Provider。

收口顺序：

1. 补齐 Doc 的 browser/SSR detail query、viewer state、upvote/emotion 分支和
   cache tag；
2. Doc route 使用 request-scoped QueryClient prefetch/dehydrate，并挂载严格的 article
   Query context；
3. consumer 全部切到 Query 后，使 server-state hook 在缺少 Query Provider 时直接报错；
4. 删除 ArticleStore 的 `post`/`changelog`/`doc` server fields、双读 fallback、
   `commit({ post | changelog | doc })` shim，以及无调用者的 legacy `loadArticle`。

这里的 Doc 垂直切片只覆盖 article detail、viewer state、upvote/emotion 和对应 cache tag。
report 的产品语义后续处理。Doc cover 的 `docCover` 与侧边栏树 `docPublicTree` 是独立数据集，
本轮保持现有查询/SSR
initial tree 链路，不要求纳入 `Q.article.detail`，也不阻塞“ArticleStore 不再持有 Doc article
server data”的完成标准。它们后续若迁移，应建立各自的 query key，不能塞入 Doc detail cache。

文章编辑草稿、编辑模式、弹窗、折叠和临时选择等纯本地流程继续使用专属 Valtio store。
`isArticleLayout` 等可由 route 推导的字段直接删除，不转移到另一个 UI store。本阶段不引入
TanStack Store。

### 从 Comments store 移出

- `pagedComments` 和 `pagedPublishedComments`；
- list loading/initialized；
- 服务端 participants、totalCount；
- 仅用于 mutation 后修补 comment entity 的字段。

### Comments store 暂时保留

- `showEditor`、`showUpdateEditor`、`showReplyEditor`；
- comment/reply/update body；
- `replyToComment`；
- folded comment ids；
- publish UI 状态和编辑器本地状态。

迁移按字段完成，不要求一次删除整个 store。

当前状态：Comments list/viewer state 与 comments head summary 均由 Query 持有；participants、
`isViewerJoined`、count 与 list lifecycle 已从 Comments store 删除。Comments store 只保留模式、
分页选择、编辑器、reply loading 和折叠等本地交互状态。

### 其他 Valtio server state

- ArticleStore 的 article detail 已完全剥离，目前 Provider 只承担 Doc 页面本地 UI state；
- Dashboard store 不再持有 overview、CMS article/community list 等只读 Query 结果；`Q.dsb.config`
  持有已确认配置，只有可编辑 Dash route 创建 `DsbEditStore`，直接持有当前编辑字段、`original/touched`
  和拖拽结果；不存在额外 `.draft` 或通用只读 `DsbStore`。具体 reconcile 与保存边界见
  [`dashboard_store_reorg.md`](../dash/store-reorganization.md)；
- Account Valtio store 已删除。SSR account 数据只作为 Query initial data，浏览器 probe 与 logout
  直接更新同一个 query key，不再经过 Query -> effect -> Valtio 镜像；
- 无调用者且仍声明 article/community 等服务端字段的 legacy Viewing store 已删除。

## TanStack DB 的后续位置

当前决定是不引入 TanStack DB。Query-only 已能通过集中 helper 同步 article/comment 的所有
已加载副本；现有 comment viewer 覆盖问题属于 public/viewer cache 漏 patch，不是必须增加
normalized DB 才能解决的问题。

TanStack DB 只有在 Query 迁移后实际出现下面这些问题时才重新评估：

- 同一 article 同时存在于多个列表和详情，需要反复 fan-out patch；
- comments、authors、viewer states 需要跨 collection join；
- 页面希望直接订阅 normalized collection 和 live query；
- optimistic transaction 需要由 collection 自动 overlay 和 rollback。

候选 collection：

```text
articlesCollection
commentsCollection
articleViewerStatesCollection
commentViewerStatesCollection
```

其中 viewer-state collection 只表示当前登录用户的状态。账号切换时必须清空并重新
加载，不能将用户 A 的 viewer state 暴露给用户 B。

重新进入 spike 的条件是：

1. TanStack Query 已经成为相关 server state 的唯一 owner；
2. Query key 和 mutation transport 已稳定；
3. `patchArticleEverywhere` 等 helper 的复杂度已用实际代码和测试证明；
4. 能明确 collection hydration、账号切换和 route 生命周期；
5. bundle、SSR 与故障回滚收益大于新增抽象成本，并能解释约 71 KiB gzip 的客户端增量。

如果 Query helper 已足够简单，不需要为了使用 TanStack 全家桶而强行引入 DB。

## 依赖与 bundle 结论

TanStack Query 取代的是 urql 的 React Provider、hooks 和 cache runtime，不取代 GraphQL
transport。完全迁移后仍保留 typed documents/codegen、`graphql`/`print`、由
`graphql-request` 支撑的 `browserGraphQLRequest`、
SSR `publicQuery` 和 request-aware `authQuery`。

基于仓库当前版本，使用 esbuild、browser ESM、ES2022、minify、React external 和 gzip `-9`
做同口径隔离测量：

| 浏览器运行时切片                                             | Minified |           Gzip |
| ------------------------------------------------------------ | -------: | -------------: |
| TanStack Query：Provider、query、mutation、hydrate/dehydrate | 39,126 B |       11,580 B |
| 当前 urql：Provider、query、mutation、cache、fetch、retry    | 32,179 B |       11,471 B |
| Query 之上增加计划中的 TanStack DB coherent slice            |        — | 约 71 KiB 增量 |

前两者处于同一量级。隔离测量不等于 Next production route 的最终 chunk，但足以支持依赖
决策：最终以 Query 替换 urql，运行时成本基本持平；迁移期若同一路由同时可达两套 runtime，
会临时支付两份成本；TanStack DB 则是显著的额外增量。

Main、Dashboard 与 Dash 均已退出 urql。根依赖中的 `urql`、`@urql/core`、
`@urql/exchange-retry`、`@urql/next` 以及 GraphQLProvider、`useGraphQLClient` 和兼容 wrapper 已
删除。GraphQL typed documents、codegen 和 transport helper 继续保留；它们不依赖 urql runtime。

## 分阶段实施计划

### Phase 0：基线与契约（已完成）

- 记录 `/home/post`、文章详情和评论页的当前功能、请求数和 bundle 基线；
- 列出 Main 实际使用的 urql query/mutation，不把 Dashboard-only consumer 混入首个
  切片；
- 为 filter normalization、query key、Auth retry 和 cache-tag mapping 建立测试；
- 明确 public/user-specific GraphQL 字段，避免 viewer 字段再次进入公共 SSR。

完成标准：迁移前行为、性能和身份边界可以自动验证。

### Phase 1：Query 与 transport 基础设施（已完成）

- 增加 `@tanstack/react-query`；
- 建立 stable browser QueryClient 和 request-scoped server QueryClient；
- 增加 Query Provider、dehydrate 和 HydrationBoundary helper；
- 建立 `Q.article`、`Q.comment`、`Q.viewer` 和 `Q.SSR` factory；
- 提取 transport-neutral GraphQL document helper；
- 将 browser auth retry 从 urql-specific error 类型中解耦，但保留现有 Auth 行为；
- urql Provider 暂时与 Query Provider 共存。

完成标准：可以用一个不影响现有页面的 smoke query 验证 SSR hydration，且客户端不
立即重复请求。

### Phase 2：文章列表垂直切片（已完成）

- 迁移 `/[community]/post` 默认列表到 `Q.SSR.article.posts`；
- 客户端 PostThread 直接消费 `Q.article.posts`；
- 移除该页面 `ArticleListStoreProvider` 中已经由 Query 管理的数据字段；
- 服务端不再读取 filter `searchParams` 来决定完整 SSR 数据；
- filtered URL 由客户端立即请求并显示正确 pending 状态；
- 保留 tag/filter URL 行为和 refresh event 的兼容 adapter，随后再收敛调用者。

完成标准：匿名默认列表可公共缓存；直接打开 filtered URL 不闪错误数据；前进后退、
分页和预览抽屉不产生重复或过期请求。

### Phase 3：Post/Changelog 详情与 viewer state（已完成）

- 迁移 post/changelog detail 和 preview query；
- 公共详情走 `Q.SSR.article.detail`；
- 当前用户状态改为独立的 `Q.viewer.articleStates`；
- 未加载 viewer state 时 UI 使用 unknown/pending 语义；
- 实现 article upvote 的 optimistic mutation helper；view mutation 因 schema 暂无对应
  operation 而不在客户端伪造，viewer viewed 状态仍由独立 query 读取；
- 同时更新 detail、list、preview 和 viewer query。

完成标准：Post/Changelog 的列表、详情和预览中的计数与当前用户状态一致；mutation 失败
可以完整回滚。Doc 垂直切片进入 Phase 8。

### Phase 4：Comments（已完成）

- 迁移 comment/reply query；
- 分离 comment server state 与编辑器 UI state；
- 将 publish、update、delete、upvote、report 和 emotion mutation 接入 Query cache adapter；
- 增加临时 comment、rollback、快速连续 reaction 和 reply list 测试；
- mutation 成功后执行精确 Query invalidate 和 Next cache-tag revalidation。

完成标准：Comments store 不再保存 Query server-state 副本，编辑器和折叠等 UI 行为
保持不变。

### Phase 5：Main 其余 urql consumer（已完成）

- 迁移 TagNote、ArticleSettingMenu 及 Main 实际可达的剩余 query/mutation；
- 处理 schema 文件中对 `urql/gql` 的静态依赖；
- 确认 Dashboard/Dash 专属模块不会因 Core barrel 被带入 Main；
- 在 Main 依赖图中不存在 urql consumer 后，移除 Main 的 GraphQLProvider。

完成标准：Main 首屏不再加载 urql runtime；Dashboard/Dash 已迁移的功能保持原有产品语义。

### Phase 6：清理与性能验收（已完成）

- 删除 Main 已无调用者的兼容 adapter；Dashboard/Dash consumer 在 Phase 8 一并迁移；
- 仅在所有 workspace 都无 consumer 时，才从根依赖移除 urql packages；
- 对比 `/home/post` 的首屏 JS、请求数、hydration 和错误日志；
- 验证生产 URL 的 Vercel/CDN cache header，而不只验证本地 build；
- 检查 Query Devtools 不进入 production bundle。

完成标准：功能矩阵通过，Main bundle 中没有 urql，生产公共缓存行为没有退化。

### Phase 7：评估 TanStack DB（已完成，保持 Query-only）

- 统计 mutation helper 的 fan-out 数量和复杂度；
- 用 article + viewer state 做隔离 spike；
- 验证 collection 与 Query hydration、logout、账号切换和 tab focus；
- 对比 Query-only 与 Query Collection 的 bundle、测试成本和可观察性；
- 根据数据决定是否进入正式实现。

完成标准：形成单独的 DB ADR。没有收益证据时保持 Query-only。

### Phase 8：全链路 urql 替换、正确性与双读收口（已完成）

高优先级：

- 盘点并迁移 Main/Core/Dashboard/Dash 全部 `useGraphQLClient`、直接 `urql` hook、
  `@urql/core` 类型和 `GraphQLProvider` consumer。持续 server state 建立领域 `Q` factory，写操作
  进入领域 `useMutation`，一次性命令式读取使用 QueryClient factory；不能用另一个内部调用 urql
  的 wrapper 冒充完成迁移；
- Dashboard 与 Dash 可以继续共用 framework-neutral Core query/mutation 边界，但各自保留现有
  route tree 和 host Provider；“长期共存”指两个应用形态共存，不再意味着 urql 与 Query 两套
  server-state runtime 长期共存；
- consumer 按领域迁移并建立对应 key/invalidation：Core Comments/ArticleEditor/
  TagSettingEditor/ArticleView/PassportEditor；Dashboard CMS info/RSS/admins/tags/article/trash；
  Docs cover/import/editor tree/publish/revision；Appearance wallpaper/theme、Assets Hub 与 Analytics。
  direct urql Analytics panels、`usePersistence` 的 `@urql/core` 类型和测试 mock 必须一起退出；
- 所有 `createXxx` mutation 显式 `retry: false`。本轮不增加创建请求去重协议；create 的自动
  重放、离线队列和 Article 创建身份另行设计；
- comment upvote/emotion optimistic mutation 必须同时 patch/rollback comment list 中的
  public-owned aggregate 与 `viewerQueryKeys.commentStates`，避免旧 viewer 快照覆盖按钮状态或触发
  重复 mutation；
- 提取共享 `stripCommentViewerState`，browser `Q.comment.list` queryFn 与 SSR loader 都在写入
  cache/dehydration 前递归裁剪 viewer fields，使 comment list cache 结构上只有 public-owned
  fields；helper 必须同时递归 `replies` 与 `replyToComment`，修复当前 SSR runtime 只处理
  `replies` 的缺口；helper 放在 client/server 都能导入的 `~/lib/commentViewerState` 中立模块，
  禁止 `frontend/core/query/comment.ts` 依赖 `frontend/community/src/server/community.ts`；
- viewer comment-state query 返回明确的 `TCommentViewerStates` 契约；emotions 按 `type` 只
  overlay `viewerHasReacted`，公共 `count`/`latestUsers` 永远来自 comment list，禁止数组整体覆盖；
  `Q.viewer.commentStates` 直接消费未裁剪的 authenticated browser response，不能复用已裁剪的
  `Q.comment.list` cache；
- article upvote 与 comment upvote/emotion 统一接入
  [optimistic operation 通用层](../migrations/tanstack/optimistic-operation.md)：`useOptimisticToggle` 负责
  读取 canonical Query、合并最后期望状态，executor 负责 commandId、受影响 Query 取消、
  `queueKey` lane 串行、精确 effect plan、guarded rollback 和 server reconcile。当前实现不创建
  TanStack MutationCache 的 `mutationKey`/`scope.id` 记录，也不把 pending 状态放进 module-global Set；
  运行期 identity 以 `commandId + operation name + queueKey` 记录，未来若迁移到 `useMutation`，
  只能把这些不可变字段映射到 meta/观察 key，不得改变 queueKey 与 toggle intent buffer 语义；
- article upvote 必须补齐与 comment reaction 等价的按实体 intent buffer；UI 事件不得把基于
  stale prop 计算出的目标值直接排队。连续操作以最后期望状态为准，同一实体同时最多一个请求，
  settle 后仅在服务端确认状态与最新 intent 不同时补偿一次；命令式 `Mutation` settle 后显式从
  mutation cache 删除，避免在 GC 周期内按点击次数堆积无 observer 记录；
- 增加 `Q.article.tagGroups` 和同 key 的 SSR factory，迁移 `useActiveTag` 后删除
  ArticleList store 中的 `tagGroups` server state；同步删除 paged hooks 的无调用者 `update()`/
  `TUpdate` 和 `activeTagStats` 幽灵 fallback；
- 以 tagGroups 加入 `articleQueryKeys.all` 为首个落点，引入 typed shape routing：只对明确声明的
  article-bearing query 调用 adapter，`tagGroups`/`tagStats` 显式标记为 non-entity，不再依赖
  `patchData` 对未知 shape 恰好安全跳过；
- 完成上述 Doc article detail Query 垂直切片，并删除 `useArticle()` 的 server-state fallback；
  `docCover`/`docPublicTree` 保持独立现有链路，不纳入本切片。

行为与清理：

- Post/Changelog/Kanban 仅在“无可展示数据且正在请求”时进入初始 LOADING；后台或 focus
  refetch 不得让已有列表、筛选器或分页闪回 loading；
- 删除无 emitter 的 `EVENT.REFRESH_ARTICLES`、`useFetchPagedPosts` 适配器和无人读取的
  ArticleList `resState` 写入；
- 删除未被 query factory 使用的 `articleQueryKeys.preview`，避免与实际复用的 detail key 漂移；
- Changelog SSR 只 prefetch canonical default filter；非默认 filter 由客户端 Query 请求。
  不扩展当前按 community 缓存/失效的 SSR loader 去消费完整 filter，避免同 tag 多 key；
- 禁止 paged article 通用 filter 重新引入 `filter.author`。当前产品没有该筛选需求，按作者查询
  走 login-scoped 独立查询，不与通用列表 filter 混用；
- 产品和 hook 只暴露 `page`，adapter 固定 `size: 20`，不向业务层提供任意 offset/limit；
- query key、browser queryFn 与 SSR queryFn 必须消费同一组实际支持的筛选字段；补齐产品需要的
  `communityTags`、`when`、`sort` 到现有后端 query builder 的映射后再声明支持，禁止 key
  携带请求未消费的字段。尤其 `communityTags` 是复数列表，必须 key normalize、queryFn variables
  和后端 `community_tags` 映射三者同时落地，不能只暴露 schema 字段；
- 明确 Kanban 本轮不增加 upvote count/viewer state/interaction，避免用 Phase 3 的完成标准暗示
  已支持该能力；
- 将 Phoenix `createComment`/`replyComment` 返回值改成窄 payload，同时返回真实 comment 和同一事务确认的
  `ArticleCommentsReceipt`；前端成功后替换 pending entity，以 confirmed count/revision overlay，并通过
  `QueryInvalidation.article.stats(ref)` 收敛 ArticleStats；
- report 为移除 urql 迁移到 TanStack mutation transport，固定 `retry: false`，成功后精确
  invalidate comment viewer state；其 optimistic、快速重复提交和后端幂等语义后续单独处理；
- ArticleSettingMenu mutation 必须失效对应 article query；
- `getDoc` 必须注册与 Doc mutation revalidate 使用的同一个 article cache tag；
- `isAllFolded` 必须从 comment Query 的当前可折叠 entries 推导，不能继续读取无人写入的
  `CommentsStore.pagedComments`；
- 删除无调用者的 comment `updateOneComment`/`upvoteEmotion` helper 与 `DocArticle` 组件；
- Dashboard CMS article/Kanban reader 迁入领域 Query 后，删除 ArticleList store 的 server lists；
- comments head/summary reader 迁入 Query 后，删除 Comments store 的 server fields；
- 临时 `~/hooks/useQuery` 已删除。Analytics polling、focus、remount 和 loading 行为直接用 TanStack
  options 表达，并由契约测试和真实环境共同验证；
- 登录态下合并 comment list 与 viewer-state 两次请求属于可选性能优化，不作为正确性阻塞项。

完成标准：Doc article detail 不再依赖 ArticleStore server data；tagGroups 不再由 ArticleList
store 持有；public/viewer optimistic 状态不会互相覆盖；后台 refetch 不造成 loading 闪烁；
死适配器和漂移 key 清理完成；Main/Core/Dashboard/Dash 中不存在 urql import、Provider、兼容
wrapper、过渡 `~/hooks/useQuery` 或依赖；ArticleList/Comments Valtio store 不再持有 server data；
`createComment`/`replyComment` 使用 payload 完成真实实体和 count reconcile；新增
回归测试通过且不破坏 Phase 0-7 验证基线。

## 测试矩阵

### SSR 与缓存

- 匿名访问 `/home/post`；
- 登录用户访问同一 URL，公共 HTML 不因 Cookie 改变；
- default filter 命中公共 cache；
- filtered URL 不污染 default filter cache；
- hydration 后默认列表不重复 fetch；
- tagGroups SSR prefetch/dehydration 后 `useActiveTag` 直接命中 Query，不再依赖 ArticleList store；
- browser/SSR comment list 都经过同一 `stripCommentViewerState`，包括 `replies` 与
  `replyToComment` 在内的全部 comment graph 中不存在 viewer fields；
- 客户端依赖图中 `~/query/comment.ts` 与共享裁剪 helper 都不引用 server-only SSR runtime；
- production URL 实际返回预期 Vercel/CDN cache header。

### 导航

- default -> tag -> order -> page；
- 浏览器 back/forward；
- 直接打开 filtered URL；
- 打开/关闭文章 preview 不重复请求未变化的 filter；
- detail、preview、list 使用同一 article key。

### 身份

- 匿名 viewer state 保持 unknown/disabled；
- 登录后加载当前用户 viewer state；
- token 缺失/过期触发一次 refresh 和 replay；
- `403` 不触发 refresh；
- logout 清除 viewer queries；
- 账号切换不复用前一个账号的状态；
- 多 tab 至少在 focus 或 Session channel 事件后收敛。

### Optimistic mutation

- upvote/undo；
- view 去重；
- comment publish/update/delete；
- comment upvote 和 emotion；
- comment upvote/emotion 分别覆盖 optimistic patch、失败 rollback、server reconcile；
- comment report 使用 TanStack mutation、`retry: false`，成功后失效
  `viewerQueryKeys.commentStates`；本轮不要求 report optimistic；
- `TCommentViewerStates` 只含 upvote/report flags 和按 emotion type 的 reaction flags，不含公共
  emotion count/latestUsers；
- `Q.viewer.commentStates` 能从未裁剪 response 提取 render view 所需的 root/reply viewer flags，
  且不读取已裁剪的 `Q.comment.list` cache；
- comment merge 中公共 count/latestUsers 以 list query 为准，viewer flags 以 viewer query 为准；
- emotion merge 按 type overlay `viewerHasReacted`，旧 viewer emotions 不得覆盖 optimistic count；
- changelog SSR 对非默认 filter 不执行 prefetch，客户端 key/queryFn 字段集一致；
- `createComment`/`replyComment` GraphQL payload 同时返回真实 comment 与完整 `ArticleCommentsReceipt`；成功后
  pending entity 被真实 comment 替换，confirmed count/revision 进入 receipt overlay，不写回 Article content；
- 所有 `createXxx` mutation 的 TanStack 配置均为 `retry: false`，network error 不自动重发；
- 快速连续点击会合并到最后期望状态，不会出现负数、重复 upvote 或最终状态反转；
- commandId/name/queueKey 可用于日志和诊断；同一 operation 的正向与撤销共享 queueKey lane，
  toggle intent buffer 在请求期间合并最后期望状态，settle 后不会因点击次数堆积执行记录；
- list/detail/preview 同时打开时保持一致；
- REPLIES 模式的嵌套 reply 与 TIMELINE 模式的扁平 entry 都能被同一 mutation 更新；
- 排名或筛选归属由服务端决定时，optimistic 字段立即更新且 refetch 后顺序正确。

### 全链路 urql 退出

- Dashboard Next layout 和 Dash `DashboardShell` 都只挂载 Query Provider，不再挂载
  `GraphQLProvider`；两个应用的 route/navigation 行为保持不变；
- CMS info、admins、tags、RSS、article/trash、Docs cover/import/editor/publish/revision、Assets、
  Passport、Theme/Wallpaper 和 Analytics 的关键 query/mutation 流程均有领域测试；
- direct urql Analytics query 改用稳定 `Q` factory，focus/refetch 和错误态不回退；
- Dashboard 设置类 mutation 成功后精确更新或 invalidate 对应 query，失败状态不写入 Valtio
  server-state 副本；
- `useGraphQLClient`、GraphQLProvider、urql-specific error/type 和相关 mock 无生产调用者后删除；
- Main/Core/Dashboard/Dash typecheck、单测和 production build 全部通过；
- 静态扫描和依赖图共同证明没有隐藏在 Core barrel 或 lazy route 中的 urql consumer。

### 性能

- 首屏 JS gzip 和解压体积；
- 首屏 GraphQL/API 请求数；
- hydration mismatch 和 console error；
- LCP/INP/CLS；
- server query waterfall；
- cache HIT 与 cache miss 的 TTFB；
- urql、retry exchange 和兼容 wrapper 是否退出 Main/Dashboard/Dash 全部 production 依赖图；
- 静态门禁确认全仓业务源码不存在 `from 'urql'`、`@urql/core`、`GraphQLProvider` 或
  `useGraphQLClient` consumer，根依赖中不存在 urql packages。

## 风险与控制

### 两份客户端真值

风险最高。每个垂直切片必须同时把 UI reader 从 Valtio 切到 Query；禁止长期保留
Query -> effect -> Valtio 镜像。

### Query key 漂移

所有 key 只能由 `Q` factory 创建。组件和 mutation 不手写 tuple。

### SSR 数据与客户端数据分叉

Server Component 负责 prefetch，Client Component 负责持续读取和 refetch。不要在
Server Component 与 Client Query 中分别长期展示同一份可变化数据。

### 公共缓存被身份污染

`Q.SSR` 默认只能调用 public loader。公共 Community route 必须从 GraphQL selection 开始就排除
account、subscription 和全部 viewer 字段；不能因为入站请求恰好带 Cookie 就把公共 loader 标记为
private。真正调用 `headers()`、Cookie 或 `authQuery` 的 query 必须位于明确的 request-aware 动态
边界，不能进入 `use cache`。

theme 不作为 SSR 用户数据：公共 SSR 输出稳定默认 theme，现有 pre-paint script 在 hydration 前从
浏览器可读 cookie/`prefers-color-scheme` 应用用户 theme。服务端不读取 theme cookie 来改变公共
HTML；本轮已落实这一边界，发布后仍需复验实际响应。

### 全应用迁移的回归面

Dashboard/Dash 的 CMS、Docs editor、Assets、Passport、Theme、Analytics 等 consumer 已按领域
接入 query key、mutation invalidation 和测试；根依赖不再保留 urql。发布后仍需验证真实 URL 的
reachability 和缓存行为。

### 把 TanStack DB 当成本地持久数据库

本方案中的 DB 候选首先是浏览器内 normalized reactive store，不默认持久化，也不
默认跨 tab。持久化和跨 tab 同步必须另行设计。

## 观测与回滚

- 每个 Phase 以一个垂直业务切片提交，避免一次替换所有 query；
- urql 与 Query 只在迁移期短暂并存，但同一份 server state 只能有一个 UI owner；每迁完一个
  consumer 就删除对应旧入口，不建立长期 compatibility mode；
- 为 Query 和 mutation error 增加 operation/domain 标签，不记录 token 或 Cookie；
- 比较迁移前后的 API 次数、retry 次数和 cache hit；
- 某个切片出现 hydration、身份或一致性回归时，只回滚该切片，不回滚已经稳定的
  transport 与 Query 基础设施。

## 参考

- [TanStack Query: Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options)
- [TanStack Query: Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
- [TanStack Query: Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [TanStack Query: useMutation](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation)
- [TanStack DB: Overview](https://tanstack.com/db/latest/docs/overview)
- [TanStack DB: Query Collection](https://tanstack.com/db/latest/docs/collections/query-collection)
