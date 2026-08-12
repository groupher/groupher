# urql 迁移到 TanStack Query

> 状态：方案与实施计划，尚未开始业务代码迁移。
>
> 首要范围：`frontend/main` 以及它使用的 `frontend/core` 公共社区数据链路。
> `frontend/dashboard`、`frontend/dash` 和其他应用可以在迁移期间继续使用 urql，
> 不要求一次性切换。

## 背景

Main 当前同时存在三套与服务端数据相关的机制：

- Next.js Server Component loader 通过 `gqFetch` 或 `gqAuthFetch` 请求 GraphQL；
- 浏览器通过全局 urql Provider、声明式 `useQuery` 或命令式
  `useGraphQLClient` 请求 GraphQL；
- 查询结果通常再次写入 Valtio store，由 store 驱动文章列表、文章详情、评论和
  loading 状态。

当前链路大致是：

```text
SSR
  Next page/layout
    -> getPagedPosts/getPost/getPagedComments
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
- 默认文章列表由 SSR 输出并允许公共缓存；带筛选条件的文章列表在客户端请求，
  不再为了 filtered URL 将整个页面强制变成动态 SSR。
- Query 成为已迁移 server state 的唯一客户端数据源。不得再把同一份 Query 数据
  镜像写入 Valtio。
- Valtio 继续管理 UI state，例如弹窗、编辑器草稿、折叠状态、选中项和临时交互
  状态。Valtio 与 TanStack Store 功能接近且不互斥，本次迁移没有更换 UI store 的
  必要。
- TanStack DB 不进入第一阶段。先完成 Query 迁移，再根据实体重复更新的实际复杂度
  决定是否增加 normalized collections 和 live query。
- urql 按应用和功能垂直切片渐进退出。在某个应用仍有 urql consumer 时，不移除该
  应用需要的依赖和 Provider。

## 非目标

本迁移不负责：

- 修改 Phoenix GraphQL schema；
- 修改 Auth Session、Cookie、refresh、`401` 或 `403` 合约；
- 默认将 user-specific 数据放入 SSR HTML；
- 把所有 Valtio store 替换成 TanStack Store；
- 在第一阶段引入 TanStack DB；
- 拆分 `@groupher/rich-editor/style.css`；
- 动态加载 CommunityDigest 的 Classic、Hero、Sidebar 布局；
- 重构 Dashboard editing/demo store；
- 重构 Wallpaper 编辑器/runtime。

Rich Editor 的 viewer/editor CSS 拆包需要在独立的
`@groupher/rich-editor` 项目和 package export 中处理。Main 后续只负责在正确的
页面或组件边界按需引入，不应继续从 root layout 全局引入完整 editor CSS。

CommunityDigest 的布局动态加载曾导致 SSR 与 hydration 之间闪烁。本迁移不以牺牲
首屏一致性换取这部分 bundle 减少；除非未来改成服务端确定布局并输出同一变体，
否则继续保留当前静态布局加载方式。

## 数据所有权

迁移后每一层只负责一种状态：

| 层                | 所有权                                             | 不负责                      |
| ----------------- | -------------------------------------------------- | --------------------------- |
| Phoenix           | 持久化后的业务真值、权限和计数                     | 浏览器 optimistic overlay   |
| CDN / Vercel      | 可公开复用的 HTML/RSC 响应                         | 当前用户状态                |
| Next `use cache`  | 公共 GraphQL loader 的跨请求缓存                   | 浏览器 query freshness      |
| TanStack Query    | 浏览器 server state、请求状态、hydration、mutation | 弹窗和编辑草稿              |
| Valtio            | 本地 UI state、编辑状态、组件协作状态              | 已迁移的文章/评论服务端副本 |
| URL search params | 文章列表筛选、分页和可分享导航状态                 | 查询结果本身                |

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
Q.comment.list(articlePath, filter)
Q.viewer.articleStates(articleKeys)

Q.SSR.article.posts(filter)
Q.SSR.article.changelogs(filter)
Q.SSR.article.detail(path)
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
    article.ts
    comment.ts

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
const viewerStateKey = ['viewer', viewerScope, 'article-state', articleKeys]
```

规则：

- 所有默认值在进入 key 前标准化，例如 `page: undefined` 和 `page: 1` 必须得到同一
  key；
- 空字符串、`null` 和 `undefined` 不得为同一筛选语义制造多个 key；
- filter 对象字段顺序由 factory 固定，业务组件不得手写对象 key；
- mutation 可以使用 `['article', 'posts']` 前缀更新所有已加载列表；
- viewer query 应包含稳定的 `viewerScope`，或在登录用户变化时清除所有 viewer
  queries；
- token、Cookie 和其他 secret 不得进入 query key。

## GraphQL transport

TanStack Query 调用用户提供的 `queryFn`，不会自动把 GraphQL POST 变成 Next.js
公共缓存请求。因此 transport 和 cache 必须分开设计。

建议把现有服务端命名逐步收敛为：

```ts
publicQuery(document, variables)
authQuery(document, variables)
browserQuery(document, variables)
```

语义：

- `publicQuery` 不读取当前 request 的 Cookie/Header，可安全地位于 `use cache`
  loader 内；
- `authQuery` 读取当前 request，只转发 canonical Groupher auth token，不能在
  `use cache` 内调用；
- `browserQuery` 请求 same-origin `/api/graphql`，保留 CSRF header、Cookie、
  demand-driven refresh 和一次 replay；
- GraphQL validation/business error 不自动重试；
- network error 延续当前有上限的 retry；
- mutation 默认不自动 retry，除非该 operation 明确幂等。

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
  -> Q.viewer.articleStates(visibleArticleKeys)
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
  upvotesCount: number
  commentsCount: number
  views: number
}

type ArticleViewerState = {
  articleKey: string
  viewerHasViewed?: boolean
  viewerHasUpvoted?: boolean
  viewerHasCommented?: boolean
  emotions?: ViewerEmotionState[]
}
```

UI 组合它们，但不把 viewer state 写回公共 SSR query：

```text
public article query ───────┐
                            ├─> ArticleViewModel -> UI
viewer article state query ┘
```

评论本身是独立实体和列表，不应作为一个布尔字段塞进
`ArticleViewerState`。评论上的 upvote/emotion 也以 comment key 为作用域；如果未来
引入 TanStack DB，可以单独建立 `commentsCollection` 和
`commentViewerStatesCollection`。

## Optimistic mutation

第一阶段使用 TanStack Query mutation 和显式 cache update。不要同时更新 Query
cache 与 Valtio server-state 副本。

### Article upvote 示例

```text
用户点击 Upvote
  -> 检查登录状态
  -> cancel 相关 detail/list/viewer queries
  -> snapshot 受影响 cache
  -> optimistic patch
       public upvotesCount +/- 1
       viewerHasUpvoted = nextValue
  -> browser mutation -> /api/graphql -> Phoenix
       success -> 合并 server-confirmed count/state
       failure -> rollback snapshot + 展示错误
  -> targeted invalidate/refetch
  -> 服务端 mutation facade 刷新对应 Next cache tag
```

同一 article 可能出现在多个 Query cache 中。Query 本身不是 normalized entity
cache，因此 mutation helper 必须显式更新：

- 当前 article detail；
- 所有已加载的 posts/changelogs list 中匹配 article key 的 entry；
- article preview query；
- 当前 viewer article state。

这类 fan-out 更新应集中在领域 helper，例如：

```ts
patchArticleEverywhere(queryClient, articleKey, updater)
```

组件不能各自复制一份 list/detail 遍历逻辑。

### View

View mutation 应满足幂等或由后端去重。客户端首次确认当前用户尚未 viewed 时可以立即
设置 `viewerHasViewed: true`；是否立即增加公开 views count 取决于后端去重语义。
服务端结果最终覆盖 optimistic value。

### Comment publish/update/delete

- publish 可以先插入带临时 key 的 pending comment，并立即增加 comment count；
- 服务端成功后用真实 comment 替换临时 entry；
- 失败时移除临时 entry并恢复 count；
- update 先 patch 对应 comment，失败回滚；
- delete 在确认交互后 optimistic remove，失败恢复原位置；
- reply list 和 root comment list 必须通过同一 comment mutation helper 更新；
- 编辑器 body、reply target、弹窗开关等仍属于 Valtio UI state。

### Emotion reaction

Emotion mutation只更新目标 article/comment 对应 emotion entry：

- count 按 next viewer state 增减；
- `viewerHasReacted` 立即切换；
- 禁止 count 小于零；
- 快速连续点击需要按 mutation key 串行化、合并意图或禁用尚未确认的重复动作；
- server response 是最终确认值。

## 公共缓存失效

Query cache 失效和 Next 公共缓存失效是两件事：

```text
queryClient.invalidateQueries(...)
  -> 当前浏览器重新获取 server state

revalidateTag(...)
  -> 后续 SSR/CDN 请求重新生成公共数据
```

涉及公开计数或公开列表字段的 mutation 成功后，两者都可能需要执行。浏览器只负责
调用有权限的 mutation endpoint；同源服务端 facade 在 Phoenix mutation 成功后调用
对应 `revalidateTag`。不能允许浏览器提交任意 cache tag。

失效粒度至少区分：

```text
article detail: community + thread + innerId
article list:   community + thread
comments:       community + thread + innerId
community:      community
```

不要因为一次 article upvote 清空整个 QueryClient 或刷新整个 Community。

## Valtio 迁移边界

### 从 ArticleList store 移出

- `pagedPosts`；
- `pagedChangelogs`；
- backlog/todo/wip/done/rejected 等服务端列表；
- `resState`；
- 可由 query data 或 URL 推导的 active filter；
- 与列表请求结果绑定的 tag groups/stats。

### 从 Article store 移出

- 公开 article detail；
- viewer article state；
- mutation 后只为同步服务端字段而存在的 commit。

文章编辑草稿、编辑模式和纯本地流程可以继续使用专属 store。

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

## TanStack DB 的后续位置

TanStack DB 适合解决 Query 迁移后仍然存在的这类问题：

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

TanStack DB 不是第一阶段要求。进入条件是：

1. TanStack Query 已经成为相关 server state 的唯一 owner；
2. Query key 和 mutation transport 已稳定；
3. `patchArticleEverywhere` 等 helper 的复杂度已用实际代码和测试证明；
4. 能明确 collection hydration、账号切换和 route 生命周期；
5. bundle、SSR 与故障回滚收益大于新增抽象成本。

如果 Query helper 已足够简单，不需要为了使用 TanStack 全家桶而强行引入 DB。

## 分阶段实施计划

### Phase 0：基线与契约

- 记录 `/home/post`、文章详情和评论页的当前功能、请求数和 bundle 基线；
- 列出 Main 实际使用的 urql query/mutation，不把 Dashboard-only consumer 混入首个
  切片；
- 为 filter normalization、query key、Auth retry 和 cache-tag mapping 建立测试；
- 明确 public/user-specific GraphQL 字段，避免 viewer 字段再次进入公共 SSR。

完成标准：迁移前行为、性能和身份边界可以自动验证。

### Phase 1：Query 与 transport 基础设施

- 增加 `@tanstack/react-query`；
- 建立 stable browser QueryClient 和 request-scoped server QueryClient；
- 增加 Query Provider、dehydrate 和 HydrationBoundary helper；
- 建立 `Q.article`、`Q.comment`、`Q.viewer` 和 `Q.SSR` factory；
- 提取 transport-neutral GraphQL document helper；
- 将 browser auth retry 从 urql-specific error 类型中解耦，但保留现有 Auth 行为；
- urql Provider 暂时与 Query Provider 共存。

完成标准：可以用一个不影响现有页面的 smoke query 验证 SSR hydration，且客户端不
立即重复请求。

### Phase 2：文章列表垂直切片

- 迁移 `/[community]/post` 默认列表到 `Q.SSR.article.posts`；
- 客户端 PostThread 直接消费 `Q.article.posts`；
- 移除该页面 `ArticleListStoreProvider` 中已经由 Query 管理的数据字段；
- 服务端不再读取 filter `searchParams` 来决定完整 SSR 数据；
- filtered URL 由客户端立即请求并显示正确 pending 状态；
- 保留 tag/filter URL 行为和 refresh event 的兼容 adapter，随后再收敛调用者。

完成标准：匿名默认列表可公共缓存；直接打开 filtered URL 不闪错误数据；前进后退、
分页和预览抽屉不产生重复或过期请求。

### Phase 3：文章详情与 viewer state

- 迁移 post/changelog detail 和 preview query；
- 公共详情走 `Q.SSR.article.detail`；
- 当前用户状态改为独立的 `Q.viewer.articleStates`；
- 未加载 viewer state 时 UI 使用 unknown/pending 语义；
- 实现 article upvote/view 的 optimistic mutation helper；
- 同时更新 detail、list、preview 和 viewer query。

完成标准：列表、详情和预览中的计数与当前用户状态一致；mutation 失败可以完整回滚。

### Phase 4：Comments

- 迁移 comment/reply query；
- 分离 comment server state 与编辑器 UI state；
- 迁移 publish、update、delete、upvote、report 和 emotion mutation；
- 增加临时 comment、rollback、快速连续 reaction 和 reply list 测试；
- mutation 成功后执行精确 Query invalidate 和 Next cache-tag revalidation。

完成标准：Comments store 不再保存 Query server-state 副本，编辑器和折叠等 UI 行为
保持不变。

### Phase 5：Main 其余 urql consumer

- 迁移 TagNote、ArticleSettingMenu 及 Main 实际可达的剩余 query/mutation；
- 处理 schema 文件中对 `urql/gql` 的静态依赖；
- 确认 Dashboard/Dash 专属模块不会因 Core barrel 被带入 Main；
- 在 Main 依赖图中不存在 urql consumer 后，移除 Main 的 GraphQLProvider。

完成标准：Main 首屏不再加载 urql runtime；Dashboard/Dash 尚未迁移的功能不受影响。

### Phase 6：清理与性能验收

- 删除 Main 已无调用者的 `useGraphQLClient`、urql wrapper 和兼容 adapter；
- 仅在所有 workspace 都无 consumer 时，才从根依赖移除 urql packages；
- 对比 `/home/post` 的首屏 JS、请求数、hydration 和错误日志；
- 验证生产 URL 的 Vercel/CDN cache header，而不只验证本地 build；
- 检查 Query Devtools 不进入 production bundle。

完成标准：功能矩阵通过，Main bundle 中没有 urql，生产公共缓存行为没有退化。

### Phase 7：评估 TanStack DB

- 统计 mutation helper 的 fan-out 数量和复杂度；
- 用 article + viewer state 做隔离 spike；
- 验证 collection 与 Query hydration、logout、账号切换和 tab focus；
- 对比 Query-only 与 Query Collection 的 bundle、测试成本和可观察性；
- 根据数据决定是否进入正式实现。

完成标准：形成单独的 DB ADR。没有收益证据时保持 Query-only。

## 测试矩阵

### SSR 与缓存

- 匿名访问 `/home/post`；
- 登录用户访问同一 URL，公共 HTML 不因 Cookie 改变；
- default filter 命中公共 cache；
- filtered URL 不污染 default filter cache；
- hydration 后默认列表不重复 fetch；
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
- 请求失败 rollback；
- server 返回不同 count 时以 server 为准；
- 快速连续点击不会出现负数或最终状态反转；
- list/detail/preview 同时打开时保持一致。

### 性能

- 首屏 JS gzip 和解压体积；
- 首屏 GraphQL/API 请求数；
- hydration mismatch 和 console error；
- LCP/INP/CLS；
- server query waterfall；
- cache HIT 与 cache miss 的 TTFB；
- urql、retry exchange 和兼容 wrapper 是否退出 Main 初始依赖图。

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

`Q.SSR` 默认只能调用 public loader。任何调用 `headers()`、Cookie 或 `authQuery`
的 query 必须位于明确的 request-aware 动态边界，不能进入 `use cache`。

### 迁移扩大到所有应用

按应用验证 urql reachability。Main 完成不意味着可以删除 Dashboard/Dash 仍使用的
根依赖。

### 把 TanStack DB 当成本地持久数据库

本方案中的 DB 候选首先是浏览器内 normalized reactive store，不默认持久化，也不
默认跨 tab。持久化和跨 tab 同步必须另行设计。

## 观测与回滚

- 每个 Phase 以一个垂直业务切片提交，避免一次替换所有 query；
- urql 与 Query 在迁移期可以并存，但同一份 server state 只能有一个 UI owner；
- 为 Query 和 mutation error 增加 operation/domain 标签，不记录 token 或 Cookie；
- 比较迁移前后的 API 次数、retry 次数和 cache hit；
- 某个切片出现 hydration、身份或一致性回归时，只回滚该切片，不回滚已经稳定的
  transport 与 Query 基础设施。

## 参考

- [TanStack Query: Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options)
- [TanStack Query: Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
- [TanStack Query: Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)
- [TanStack DB: Overview](https://tanstack.com/db/latest/docs/overview)
- [TanStack DB: Query Collection](https://tanstack.com/db/latest/docs/collections/query-collection)
