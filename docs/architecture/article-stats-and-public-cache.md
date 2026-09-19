# ArticleStats 与公共页面缓存

> 状态：V1 主链路已落地；`interactionRevision`、`commentsRevision`、生产 telemetry 和 purge health
> 是当前合同的 P0/P1 补强项，完成条件见第 8 节。完整数据模型与排序演进属于本次结构性改造。
>
> 本文定义 Article 公共统计、SSR hydration、HTML/CDN 缓存和阅读判断边界。
> 本次改造的最终数据模型、排序投影和重建协议见
> [`article-stats-target.md`](./article-stats-target.md)。
> 可靠 CDN 失效协议见 [`public-cache-invalidation.md`](./public-cache-invalidation.md)。
> 它在读取与缓存合同上独立于 [ViewTracker V2](../feature/view-tracker/v2.md) 的事件、去重和投影协议；
> 本文列出的 ViewTracker 后端命名只表示边界映射，事件处理、投影和 retention 的 canonical 重构仍以 V2 为准。
> ViewTracker 只拥有有效阅读事实与当前 views，本文定义这些事实如何和其他公开计数一起被读取。

## 1. 结论

Article 的公开统计使用一个独立的 `ArticleStats` 读取合同：

```text
Article content
  └─ 标题、正文、作者、标签、生命周期

ArticleStats（公开 headline stats）
  ├─ views              <- CMS.ViewTracker.Model.ViewSummary
  ├─ upvotesCount       <- CMS.Interactions 同步事实/读取投影
  ├─ collectsCount      <- CMS.Interactions 同步事实/读取投影
  ├─ reactionCounts     <- CMS.Interactions typed emotion 读取投影
  ├─ commentsCount      <- Article/Comment 现有同步读取投影
  ├─ commentsParticipantsCount <- Comments 现有同步读取投影
  └─ snapshotAt         <- 本次 ArticleStats 响应的服务端生成时间

ViewerState
  └─ viewerHasViewed / viewerHasUpvoted / viewerEmotion ...
```

`ArticleStats` 是公共读取 DTO 和前端 Query cache 边界，不是新的业务事实 owner。目标范围是文章页面所有公开、
可变、Article 级聚合计数：`views`、`upvotesCount`、`collectsCount`、`reactionCounts`、`commentsCount` 和
`commentsParticipantsCount`。它们虽然写入来源不同，
但在公共读取层使用同一个快照、同一个 `snapshotAt` 和同一套缓存策略。

Article 内容、ArticleStats 和 ViewerState 不能再互相覆盖：

```text
Article content  ───────┐
ArticleStats     ───────┼─> render selector -> UI
ViewerState      ───────┘

禁止：把 ArticleStats 再写回 Article.views/viewsRevision
禁止：把 ViewerState 写回公共 ArticleStats
禁止：通过 spread、fallback 或 alias 把 ArticleStats/ViewerState 摊平回 Article content
```

前端组合使用明确的 view model：

```ts
type TArticleViewModel = {
  content: TArticleContent
  stats: TArticleStats
  viewerState: TArticleViewerState
}
```

这不是兼容 wrapper。旧的 root count、root viewer flag 和 `{ ...article, articleStats, ...viewerState }` merge 必须
在同一验收边界删除。

## 2. 命名和所有权

### 2.1 命名表

| 名称                               | 含义                                                                 | 所有者                  | 是否进入公共 HTML            |
| ---------------------------------- | -------------------------------------------------------------------- | ----------------------- | ---------------------------- |
| `ArticleStats`                     | Article 的公开可变聚合计数组合快照                                   | 公共读取合同 / Query 层 | 是                           |
| `ViewSummary`                      | 当前 views 的持久化汇总                                              | `CMS.ViewTracker`       | 通过 `ArticleStats` 间接进入 |
| `ViewerState`                      | 当前用户的 `viewerHas*` / emotion 等私有状态；不包含公开 views count | Viewer Query            | 否                           |
| `snapshotAt`                       | ArticleStats 在服务端组装完成的时间                                  | ArticleStats transport  | 是                           |
| `viewsRevision`                    | ViewSummary 成功投影后的版本                                         | `CMS.ViewTracker`       | 是                           |
| `interactionRevision`              | Interactions 公共计数的确认版本                                      | `CMS.Interactions`      | 是                           |
| `commentsRevision`                 | Comments 公共计数的确认版本                                          | Article / Comments      | 是                           |
| `thread` + `article_id`            | ViewTracker 内部唯一 identity                                        | `CMS.ViewTracker`       | 否                           |
| `community` + `thread` + `innerId` | GraphQL 和前端公开 locator                                           | Article Reader / Query  | 是                           |

`ArticleStats` 不叫 `ArticleSummary`，避免和 ViewTracker 的持久化 Summary 混淆；不叫
`Statistics`，避免重新建立无语义的泛化模块。

旧的公共读取合同直接删除，不保留 alias、fallback 或双读：

```text
articleViewSummaries       -> articleStats
article_view_summary       -> 删除旧 GraphQL type，使用 ArticleStats type
view-summary/{...}         -> article-stats/{community}/{thread}/{innerId}
```

这里的 `CMS.ViewTracker.Model.ViewSummary` 是后端持久化 views 汇总模型，不能与已删除的
`article_view_summary` GraphQL type 或旧的 `view-summary/*` 前端 cache key 混用。

`views` 是公开的 Article 总浏览数，不属于 `ViewerState`。`ViewerState.viewerHasViewed` 表示“当前 viewer
是否看过”，两者不是同一个数据维度：

```text
views                 -> 所有用户共享 -> ArticleStats -> 公共缓存
viewerHasViewed       -> 按 viewer 隔离 -> ViewerState  -> 私有缓存
```

前端命名：

```text
Q.article.stats(ref)                    单篇公共统计 Query option
Q.article.statsBatch(refs)              列表批量公共统计 Query option
articleKeys.stats(ref)                  单篇 entity key
articleKeys.statsBatch(refs)            列表 transport key
articleKeys.statsPrefix(scope)          失效匹配边界
usePagedPosts/usePagedChangelogs        列表消费方
trackArticleView(ref)                   单篇可见阅读 tracking；不是批量统计查询
```

产品列表通过 `usePagedPosts` / `usePagedChangelogs` 消费 `statsBatch`，Drawer 和详情通过同一 `stats` entity key
读取；各页面不能拼装自己的计数 query，也不能把结果写回 Article entity。GraphQL type/operation 和文件名继续使用
领域全名 `ArticleStats` / `articleStats.ts`；TypeScript namespace 内不保留旧函数 alias。

后端命名：

```text
CMS.ViewTracker.Model.ViewSummary         持久化当前 views
CMS.ViewTracker.Query.summaries/2        已授权 canonical Article 的内部批量读取
CMS.FrontDesk.article_for_view_tracking  tracking 专用的 public Article admission
CMS.ViewTracker.EventProcessor            ViewEvent 领域处理和投影协调
GroupherServer.Jobs.ViewProjection        Oban worker 外壳
```

`EventProcessor` 是 canonical 领域名称，`Jobs.ViewProjection` 只负责 Oban 执行、重试和 dead-letter 协调。
当前源码中的 `CMS.ViewTracker.Project`、`Project.project/2` 和 `ViewTracker.project/2` 是尚未清理的实现漂移，必须
直接重命名并同步调用方；不为旧名称保留 delegate、alias 或兼容入口。
`article_for_view_tracking` 只表示 tracking admission，普通 Article content reader 不承担计数副作用。

字段和分类遵循统一术语：使用 `actor_type`、`type`、`is_authenticated`、
`viewer_tracking_key`、`read_purpose`；不新增 `_kind`、`target_type/target_id` 或 `count_intent`。

### 2.2 缓存策略的唯一所有者

缓存常量由一个共享契约 owner 统一定义并向各层输出，不允许 SSR、CDN 配置和前端 hook 各自复制：

```text
ArticleStats.CachePolicy
  ├─ public_html_s_maxage_seconds       = 600
  ├─ public_html_swr_seconds            = 300
  ├─ snapshot_max_age_seconds           = 600
  ├─ clock_skew_tolerance_seconds       = 120
  └─ policy_version                     = 1
```

该 owner 负责源站 `Cache-Control`/`Date` 相关输出、`snapshotAt` 新鲜度合同和前端 hydration metadata；客户端只消费
合同，不重新声明另一组默认值。`policy_version` 是语义版本，规则或算法改变时必须提升，不能当作普通运行时旋钮。

`ArticleStats.CachePolicy` 不拥有 hydration 后的 Article content 重取频率。公共 Article content 继承共享
QueryClient 唯一默认值 `staleTime = 60s`；ArticleStats 显式覆盖为 `snapshot_max_age_seconds = 600s`。这两个值
分别解决正文更新和高频计数新鲜度，不要求相等，也不能在列表、Drawer、详情页再次复制。

## 3. ArticleStats 合同

### 3.1 GraphQL 形状

公开读取按单一 Community、单一 thread、批量 inner id 执行：

```graphql
query ArticleStats($community: String!, $thread: Thread!, $innerIds: [ID!]!) {
  articleStats(community: $community, thread: $thread, innerIds: $innerIds) {
    community
    thread
    innerId
    views
    viewsRevision
    upvotesCount
    collectsCount
    interactionRevision
    reactionCounts {
      type
      count
    }
    commentsCount
    commentsParticipantsCount
    commentsRevision
    snapshotAt
  }
}
```

`viewsRevision` 已落地；`interactionRevision` 和 `commentsRevision` 是本轮提升到 current 的 P0 合同字段，当前实现
尚未提供。后端 DTO、GraphQL schema/operation、前端类型和 receipt guard 必须作为同一验收边界切换，不能通过
optional field、默认零或旧字段 fallback 过渡。

`ArticleStats` 查询复用 public Article Gate/Lifecycle；不存在、不可公开读取的 Article 不返回。
存在但还没有 `ViewSummary` 的 Article 返回 `views=0, viewsRevision=0`。

批量输入约束：

```text
同一 community
同一 thread
innerIds 去重后最多 100 个
空列表直接返回 []
```

公开 locator 不允许 sentinel：`community` trim 后必须是非空 slug，`thread` 必须是支持的公开 Article thread，
`innerId` 必须是合法公开 id。GraphQL boundary 在进入 loader 前拒绝 `community: ""`；ArticleStats DTO 和 Query key
也不得生成空 community。只持有内部 `thread + article_id` 的 ViewTracker 路径必须先通过 canonical Article reader
解析公开 locator，不能用空字符串表示“社区未知”。

一次 `articleStats` batch request 返回每个 Article 的完整 headline stats；不能为了 views、upvotes 和 comments
分别发三次请求，也不能在服务端按 Article 逐篇查询。

服务端在一次 response assembly 中生成 `snapshotAt`。它表示整个 DTO 快照完成组装的时间，不是某一张表的
`updated_at`，也不是客户端收到响应的时间。

### 3.2 前端 cache identity

网络层可以是批量请求，缓存层必须按单篇公开 locator 归一化：

```text
articleStats(home, POST, [18, 19, 20])
  ├─ article-stats/home/POST/18
  ├─ article-stats/home/POST/19
  └─ article-stats/home/POST/20

Drawer(article=home/POST/20)
  └─ 读取 article-stats/home/POST/20
```

列表和 Drawer 不能分别拥有数组快照与单篇快照。Mirror 共享物理 Article 时，可以有多个公开 locator cache
entry，但它们的值来自同一个后端 Summary；每个 locator 只负责自己的 Query key，不能复制数据库事实。

列表读取的固定路径是：

```text
Article list [18, 19, 20]
  -> one articleStats GraphQL request
  -> one normalized entity write per returned Article
  -> each entity contains the complete ArticleStats snapshot
```

Dirty marker 也按同一原则工作：多个 dirty Article 合并成一次 batch request；单篇 dirty 不得退化为“每个 count
一个请求”。

公开 `ArticleStats` 与私有 `ViewerState` 使用不同 Query key。UI 可以在 selector 中组合，不能把私有字段写进
公共 Query，也不能把 ViewerState dehydration 到共享 HTML。所有公共 count 和 owner revision 必须作为完整
ArticleStats entity 一起写入，不能按字段拆成不同更新时间或缓存策略。

## 4. SSR、hydration 与 CDN

### 4.1 数据流

```text
浏览器 GET public Article route
        │
        v
CDN/Vercel
  ├─ cache hit: 返回既有 HTML/RSC + TanStack hydration state
  └─ cache miss/revalidate
       │
       v
源站 SSR request-scoped QueryClient
  ├─ prefetch Article content
  ├─ prefetch ArticleStats
  ├─ ArticleStats 生成 snapshotAt
  ├─ 用同一份 Query data 渲染 HTML
  └─ dehydrate 同一 QueryClient 的 public queries
       │
       v
HTML/RSC + hydration state 一起进入公共 CDN
       │
       v
浏览器 HydrationBoundary 恢复同一个 ArticleStats query
```

`dehydrate` 是 TanStack Query 提供的 SSR 状态传输机制：它把服务端 QueryClient 中允许传输的缓存转换成可序列化
状态，随 HTML/RSC 交给浏览器；它不负责生成 HTML，也不负责决定 CDN 是否缓存 HTML。

每个 SSR request 必须创建独立的 request-scoped QueryClient，浏览器每个 tab 使用自己的稳定 QueryClient：

```text
SSR request A -> QueryClient A -> dehydrate public state A
SSR request B -> QueryClient B -> dehydrate public state B

Browser tab A -> hydrate into QueryClient A
Browser tab B -> hydrate into QueryClient B
```

### 4.1.1 Public hydration allowlist

同一个 SSR QueryClient 可能暂时持有公共 Query 和私有 Query，但公共页面只能 dehydration 明确标记为 public 的
Query。采用 opt-in allowlist，未标记的 Query 默认不得进入公共 hydration：

```text
QueryClient
  ├─ Article content       hydration: public  -> allow
  ├─ ArticleStats          hydration: public  -> allow
  ├─ public config         hydration: public  -> allow
  └─ ViewerState/account   hydration: private -> reject
```

概念上的 TanStack 配置为：

```text
dehydrate(queryClient, {
  shouldDehydrateQuery: query => query.meta.hydration == public,
  shouldDehydrateMutation: () => false
})
```

`dehydrate` 同时会序列化 mutation 状态。公共页面不允许任何 mutation（包括 optimistic 变量）进入 hydration
payload，因此必须显式关闭 mutation dehydration，或对 mutation 使用同一套 allowlist；不能依赖 SSR
request-scoped client 恰好没有 mutation。

不能使用“除了 ViewerState 以外全部允许”的黑名单。未来新增身份相关 Query 时，如果忘记加入黑名单，就会把
私有数据带入共享 CDN。`ViewerState` 也不能参与 public route 的 SSR HTML 渲染；否则即使被 hydration filter
排除，私有状态仍可能已经泄漏到 HTML。需要 SSR 渲染 ViewerState 的页面必须使用 private/no-store 响应，不得进入
公共 CDN。

这里的 Article content query 是 SSR 用来生成 HTML/RSC 的公开数据，不是 tracking 请求。
SSR、API 或 Agent 读取内容不会因为“调用了 content reader”自动计数；需要计数的 producer 必须另外调用
tracking 边界，见第 6 节。

如果 SSR 只把数字写进 HTML、没有把相同 ArticleStats 放进 hydration state，客户端就无法可靠复用这份数字，
会在 hydration 后重新请求。因此 ArticleStats 的 HTML 输出和 TanStack hydration state 必须来自同一个服务端快照。
`HydrationBoundary`/`hydrate` 只负责恢复 allowlist 中的 public Query；ViewerState 在浏览器 hydration 后通过私有
请求读取。

### 4.2 默认缓存参数

页面 freshness 由两个单一 owner 组成：HTML 与 ArticleStats 参数来自 `ArticleStats.CachePolicy`，Article content
浏览器 staleTime 来自共享 QueryClient 默认策略。所有 public Article surface 共用，不由列表、Drawer、详情页各自调整：

```text
public_article_html_s_maxage_seconds       = 600   # 10 分钟
public_article_html_swr_seconds            = 300   # 额外 5 分钟 stale-while-revalidate
article_stats_snapshot_max_age_seconds     = 600   # 10 分钟
clock_skew_tolerance_seconds               = 120   # 客户端/服务端时钟偏差保护

public_article_content_browser_stale_seconds = 60  # 继承共享 QueryClient 默认值
```

这里采用明确的双层 freshness，而不是强行把正文和高频计数对齐：

```text
公共首屏 HTML/RSC
  ├─ Article content hydration ─┐
  └─ ArticleStats hydration ────┴─ 共同受 CDN 600s fresh + 300s SWR 约束

浏览器 hydration 后
  ├─ Article content age >= 60s  -> 后台 refetch content query
  └─ ArticleStats age >= 600s    -> refetch ArticleStats query
```

因此 CDN hit 可以先展示同一份源站快照，但较旧正文会在 hydration 后比 ArticleStats 更早后台更新。内容编辑、发布和
生命周期变化仍必须 purge HTML tag，使正常路径不等待 600 秒；purge 是正确性加速机制，不改变浏览器 60 秒的兜底。
处于 600–900 秒 SWR 窗口的 HTML 可以被先返回，但 content 和 ArticleStats 都必须按各自 age 规则立即判断，且每个
query 最多触发一次初始 refresh。

含义：

```text
HTML cache age < 10 分钟
  └─ 可以直接使用 HTML 中的 ArticleStats hydration snapshot

HTML cache age 10–15 分钟（SWR）
  └─ CDN 可以先返回旧 HTML 并后台回源
  └─ 客户端看到 snapshotAt 已超过 10 分钟时主动请求 ArticleStats

没有 snapshotAt / hydration state
  └─ 不猜测数据年龄，直接请求 ArticleStats
```

客户端不需要知道 CDN 当前处于缓存生命周期的第几分钟。它只读取 SSR 随 ArticleStats 一起注入的
`snapshotAt`；CDN `Date`/`Age` header（若能可靠保留）可作为保守辅助，但不能覆盖 payload 内的服务端时间：

```text
rawAge = client_now - snapshotAt

rawAge < 0
  -> 视为 0；记录 clock_skew telemetry，不因为客户端时钟落后而循环 refetch

0 <= rawAge < clock_skew_tolerance_seconds
  -> 按 0 处理，只使用一次当前 hydration snapshot

snapshotAge = rawAge（但按上面的规则将小于 tolerance 的值视为 0）

snapshotAge < article_stats_snapshot_max_age_seconds
  -> 使用 hydration data，不发起初始 ArticleStats 请求

snapshotAge >= article_stats_snapshot_max_age_seconds
  -> 只 refetch ArticleStats 一次
```

TanStack Query 的 `dataUpdatedAt` 可以作为 Query runtime 的辅助元数据，但不能替代 `snapshotAt`：
`dataUpdatedAt` 记录的是 Query fetch/hydration 时间，无法单独表达公共 CDN 返回的 HTML 是何时由源站生成的。
`snapshotAt` 必须随数据进入共享 hydration payload；CDN 命中不会重新生成它，源站每次 revalidate 才会生成新值。

如果响应没有可靠的 `Date`/`Age`，仍以 `snapshotAt` 加服务端定义的 `clock_skew_tolerance_seconds` 做保守判断；不得使用
浏览器本地时钟直接制造新的 `snapshotAt`。客户端时钟领先、落后、CDN cache hit 和一次过期 refetch 都必须有验收用例，
并保证一次 hydration 最多触发一次初始 refresh，不形成 refetch loop。

`revision` 和 `snapshotAt` 职责不同：

```text
snapshotAt           判断整份快照新鲜度
viewsRevision        防止旧的 ViewSummary 覆盖新 views
interactionRevision  防止旧的 interaction projection 覆盖新 upvotes/collects/reactions
commentsRevision     防止旧的 comments projection 覆盖新 comments/participants
```

### 4.3 哪些操作失效什么缓存

```text
内容编辑 / 发布 / 生命周期变化
  -> purge 对应 Article HTML cache tag
  -> 下一次回源重新生成 Article + ArticleStats hydration

单次 view / upvote / comment count 变化
  -> 不 purge 整页 HTML
  -> 当前浏览器的 ArticleStats entity 标记 stale 并 refetch
  -> 后续 HTML 在 TTL 到期或显式 revalidate 后收敛
```

这些 count 的写入一致性不同：views 经过异步投影，interactions/comments 通常由同步业务事务更新；这不改变它们在
ArticleStats 公共读取层使用同一 `snapshotAt` 和同一缓存策略。论坛页面接受公共 HTML 中的计数最多陈旧约 10 分钟；
这不是数据库事实不一致，而是公共页面快照策略。
需要立即看到变化的当前用户依赖 mutation receipt 后的 Query invalidate/refetch，不依赖本地 `+1`，也不要求清理整页 CDN。

ArticleStats GraphQL 可以在真实 QPS 数据证明有收益后增加 5–15 秒的服务端/边缘 microcache；该 microcache
必须按单篇 ArticleStats identity 处理，不能把不同 batch 参数当成不同权威快照。它不能改变第 4.2 节的
hydration freshness 合同。

## 5. 阅读和 tracking 判断策略

“调用 Article 内容”与“计入 Groupher 业务 views”是两个动作。判断由 producer 明确声明，不能从普通 reader 的
调用位置推断。

| 场景                            | 是否 tracking | 判断规则                                              |
| ------------------------------- | ------------- | ----------------------------------------------------- |
| 详情页真正可见                  | 是            | wrapper 相交、页面 visible、连续可见至少 1 秒         |
| Drawer 预取                     | 否            | 只是加载数据，不代表用户阅读                          |
| Drawer 打开并实际可见           | 是            | 复用详情页同一 tracking 状态机                        |
| 列表滚动看到卡片                | 否            | 列表 exposure 不等于打开阅读                          |
| SSR 生成 HTML                   | 否            | 内容读取没有阅读语义                                  |
| 浏览器 hydration 后达到可见条件 | 是            | 独立调用 `trackArticleView`                           |
| Dashboard / Trash / Export      | 否            | `read_purpose` 不是 `public_read`                     |
| API / Agent 作为产品阅读者      | 是            | producer 显式调用 tracking adapter，并提供 actor 分类 |
| 搜索索引 / 普通 crawler         | 否            | 默认不进入业务 views，交给 Edge/Umami                 |
| 被产品纳入的 verified crawler   | 是            | 只有显式 producer policy 才进入业务 views             |

浏览器判断条件：

```text
Article wrapper intersecting
  + document.visibilityState == visible
  + 连续保持 >= 1 秒
  -> trackArticleView(event_id)
```

后台标签页、中键批量打开但未切到前台、hover、prefetch、快速关闭和普通 API 内容读取都不计数。
Agent/crawler 没有浏览器 visibility；它们通过明确的 server-side tracking adapter 表达“这是一次产品阅读”。

### 5.1 read_purpose

所有 tracking 入口必须显式传入服务端推导的 `read_purpose`，客户端不能自报：

```text
public_read
author_preview
moderation_review
operations_inspection
internal_probe
```

只有 `public_read` 进入有效阅读去重和 counted ViewEvent；其他 purpose 直接落 terminal uncounted，
不能因为调用方忘传参数而默认为公开阅读。普通内容 reader 不调用 tracking，因此不会产生隐式副作用。

### 5.2 身份和分类

请求主体先由平台级 [`GroupherServer.RequestActor`](./request-actor.md) 在 request boundary 分类一次，ViewTracker
只消费可信 request context 中的 `RequestActor.Classification`，不再自行解析 User-Agent、Cookie 或 agent header：

```text
actor_type
├─ human
├─ agent
├─ crawler
└─ unknown

is_authenticated
├─ true
└─ false
```

匿名 Session 使用服务端签发的 `__Host-groupher-viewer` Cookie；登录用户使用同一个 tracking 协议但 key 来源为
登录主体。Cookie 不可用时可以是 `unknown`，不能把 IP 或浏览器指纹变成长期 identity。

`RequestActor` 只输出分类判断；`viewer_tracking_key`、`read_purpose`、滑动去重和 counted policy 仍由 ViewTracker
拥有。未来 Analysis、RateLimit 或 ContentPresentation 可以复用同一个分类结果，但不能把业务策略塞回
RequestActor，也不能根据可伪造的 User-Agent 在同一 CDN key 下返回不同 body。

## 6. 失败、revision 与读取收敛

ArticleStats 是最终一致的公开快照：

### 6.1 View tracking 收敛

```text
trackArticleView accepted
  -> 只表示 ViewEvent 已接收/幂等处理
  -> 不表示本次一定 counted
  -> 不表示 Summary 已完成投影
  -> 不允许本地 views + 1
```

tracking accepted 后：

```text
当前 ArticleStats entity
  -> mark stale
  -> 等待通常投影延迟后 refetch 同一个 entity key
  -> 以服务端 views/viewsRevision 为准
```

### 6.2 快照顺序与 mutation receipt

写入 cache 前执行：

```text
incoming.snapshotAt < current.snapshotAt
  -> 丢弃整份旧快照，不做字段级合并

incoming.snapshotAt >= current.snapshotAt
  且 incoming.viewsRevision >= current.viewsRevision
  且 incoming.interactionRevision >= current.interactionRevision
  且 incoming.commentsRevision >= current.commentsRevision
  -> 用 incoming 整份替换 ArticleStats entity

incoming.snapshotAt > current.snapshotAt
  但任一 owner revision 倒退
  -> 视为混合/非法响应，丢弃整份并记录 telemetry
```

ArticleStats 不对任何公共 count 做逐字段拼接。`snapshotAt` 是公共快照的唯一整体顺序，三个 owner revision 分别
防止各自计数倒退；任何不满足上述关系的响应都 fail closed。

upvote、emotion 和 comment mutation 返回服务端确认的 count 与对应 revision。前端 receipt 是已确认结果，不是
optimistic `+1`，也不能写入或拼接 ArticleStats entity：

```text
mutation confirmed
  -> receipt = confirmed count + owner revision
  -> invalidate/refetch ArticleStats
  -> selector 可以在 UI 上覆盖显示 receipt 的 confirmed count

ArticleStats owner revision < receipt revision
  -> 保留 receipt；ViewerState 或 comment list 追上不能证明公共快照已收敛

ArticleStats owner revision >= receipt revision
  -> 接受完整 ArticleStats snapshot；清除对应 receipt
```

receipt TTL 必须覆盖 `public_html_s_maxage + public_html_swr` 的最坏窗口。TTL 到期仍未观察到对应 revision 时，前端
清理 receipt 前必须记录 convergence timeout telemetry 并再次 invalidate ArticleStats，不能静默恢复到更旧数字。
当前共享合同取 `600 + 300 + 60 = 960s`，最后 60 秒是网络、调度和时钟误差余量。

### 6.3 生产可观测性

网络失败不应阻断文章阅读，但必须记录不包含 Cookie、event id 或 tracking key 的 failure telemetry，至少区分
timeout、network 和 GraphQL error category。

`clock_skew`、`invalid_snapshot`、`mixed_snapshot`、`receipt_convergence_timeout` 必须进入生产 telemetry sink；
`console.warn` 只允许作为开发环境 fallback，不能作为生产验收完成的依据。事件至少包含安全的 Article locator、
policy version、revision 差值和 snapshot age，不包含 Cookie、viewer key、event id 或正文。

HTML purge 必须暴露健康状态和结构化指标：成功/失败次数、重试次数、耗时和最近一次失败原因。mutation 需要立即
purge 但运行时缺少 Cloudflare 配置时，必须记录 `purge_not_configured` 并让 health/readiness 可见，不能因为
`hasConfiguredPurge() == false` 静默跳过。purge 失败仍不回滚已经成功的领域 mutation。

## 7. 不允许的实现形态

```text
Article.views + ArticleStats 双写
ArticleStats miss -> fallback Article.views
Summary 查询结果回写 Article.views/viewsRevision
Article content 和 ArticleStats 各自维护一份公开 count 快照
把公开 views count 误放进 ViewerState
SSR 普通 content reader 隐式 tracking
用客户端收到响应的时间伪造 snapshotAt
把 ViewerState dehydration 到公共 HTML
把 mutation/optimistic 状态 dehydration 到公共 HTML
用 accepted receipt 做本地 +1
为每次 view 增量 purge 公共 HTML
```

本设计不迁移历史 `Article.views`，不从旧字段、ViewEvent 或 Analysis hourly metric 回填新的 Summary。
目标改造完成后 Article content schema、GraphQL fragments、DTO 和前端类型中不再存在旧
`views/viewsRevision/upvotesCount/commentsCount/commentsParticipantsCount/collectsCount/emotions` 公共字段。

## 8. 实施状态与验收

已落地的 V1 基线：

- `ArticleStats` GraphQL 查询的 V1 字段、`snapshotAt`、public locator 和归一化 Query key；
- SSR request-scoped QueryClient、public hydration allowlist、600 秒 HTML/ArticleStats freshness；
- 初始 `views/upvotes/comments` 已从 Article content 分离，列表、Drawer、详情共享 ArticleStats entity；
- tracking admission、ViewSummary/`viewsRevision` 投影以及客户端 mixed-response fail-closed；
- 旧 `articleViewSummaries`、`article_view_summary`、`view-summary/*` 和 Article count fallback 已删除；
- 内容变化 purge HTML、单次 view/upvote/comment 不 purge 整页的缓存边界。

当前合同剩余工作，并与本次 target 架构作为同一改造验收：

1. P0：将存储层已有的 `article_interaction_revision/comments_revision` 纳入后端 ArticleStats DTO，并把
   `interactionRevision/commentsRevision` 加入 GraphQL operation、前端类型、mixed-response guard 和 mutation receipt；
2. P0：把 `collectsCount/reactionCounts/commentsParticipantsCount` 移入 ArticleStats，前端切换为
   `TArticleViewModel { content, stats, viewerState }`，并删除 root 字段、spread merge、旧 Query 函数与所有 fallback；
3. P0：禁止 `community: ""` sentinel，修正 ViewTracker loader 和固化空字符串的测试；
4. P1：将 `CMS.ViewTracker.Project` / `project/2` 直接重命名为 `EventProcessor` 对应入口并同步所有调用方，
   不保留旧 delegate/alias；
5. P1：把 ArticleStats 浏览器诊断接入生产 telemetry sink，`console.warn` 只保留开发 fallback；
6. P1：按 [`public-cache-invalidation.md`](./public-cache-invalidation.md) 建立 `PublicCache.Invalidation`
   transactional outbox、Oban `PurgeWorker` 和 Phoenix Cloudflare adapter，切换后删除 Community/Dash proxy purge owner；
7. P1：补齐双层 freshness、revision receipt、可靠 purge 和生产可观测性的测试。

验收至少包括：

- `articleStats` 对 1、20、100 个 Article 都只产生一次 GraphQL batch request；返回每篇完整的
  `views/upvotesCount/collectsCount/reactionCounts/commentsCount/commentsParticipantsCount` 和三个 owner revision；
- 后端 ArticleStats 读取使用一个 scoped SQL，或有明确上限的固定数量 owner reads；查询次数不随 Article 数量
  或 count 类型数量增长，禁止 N+1 和按 count 类型拆分查询；
- 对 1、20、100 条输入执行 `EXPLAIN (ANALYZE, BUFFERS)` 和 select-count 测试，验证 Article locator、
  ViewSummary 及 count owner 读取使用预期索引；
- `community: ""`、全空格 community、未知 thread 和非法 inner id 在 GraphQL boundary fail closed，DTO 和 Query key
  从不产生空 community sentinel；
- CDN cache hit 返回的 HTML 与 hydration ArticleStats 数字一致；
- SSR 使用独立 request-scoped QueryClient，浏览器 hydration 恢复同一 public ArticleStats query；
- `dehydrate` 只输出 public allowlist，登录 SSR 中的 ViewerState、account 和 subscription 数据不出现在 HTML/RSC
  或 hydration payload；mutation/optimistic 状态同样不得进入公共 hydration；
- public route 不使用 ViewerState 生成 SSR HTML；需要 SSR viewer 状态的页面必须是 private/no-store；
- SSR 回源生成新的 `snapshotAt`，CDN cache hit 不伪造新的时间；
- snapshot 未过期时 hydration 后不发起 ArticleStats 初始请求；
- snapshot 过期、缺失或被 invalidate 时只请求 ArticleStats，不重新请求正文；
- hydration content age 达到 60 秒时可以独立后台重取正文，ArticleStats 未达到 600 秒时继续复用；SWR HTML
  同时按两套 age 规则各自最多触发一次初始 refresh；
- 客户端时钟领先、落后或缺少可靠 `Date`/`Age` 时，按 `clock_skew_tolerance_seconds` 保守判断，不产生 refetch loop；
  一次 hydration 最多触发一次初始 ArticleStats refresh；
- 内容编辑/发布 purge HTML；单次 view/upvote/comment 不触发整页 purge；
- 详情页、列表和 Drawer 使用同一个 ArticleStats entity，不能出现两份公开 count；
- ArticleStats 的 `snapshotAt` 较旧响应整份丢弃；不早于 current 的 `snapshotAt` 若任一 owner revision 倒退也整份丢弃，
  不允许把不同 count 从不同响应拼接；
- ArticleStats 中所有公开 count 使用同一 snapshot/cache policy；ViewerState 只包含 viewer-owned flags，不包含公开 count；
- ViewerState 不进入公共 HTML，登录/匿名状态不会污染 ArticleStats cache；
- prefetch、SSR、后台标签页、列表曝光不 tracking；详情和 Drawer 真正可见后只 tracking 一次；
- SSR hydration 使用真实 ArticleStats，不显示 placeholder；SPA 客户端导航在 ArticleStats pending 时使用固定加载槽位：
  列表/card 至少 `4ch`，Drawer/detail 至少 `5ch`，加载完成前后 bounding rect 不发生可感知位移；
- API/Agent/Crawler 只有显式 public-read adapter 才进入 Groupher 业务 views；
- confirmed mutation receipt 不做本地加一、不写入 ArticleStats cache；只有对应公共 owner revision 追上才清除，
  ViewerState 或 comment list 追上不能提前清除；
- `clock_skew`、`invalid_snapshot`、`mixed_snapshot` 和 receipt timeout 可在生产 telemetry 中查询，不能只出现在
  浏览器 console；
- purge 未配置、重试和最终失败都有结构化 metric/health 信号；领域 mutation 成功后 purge 失败不会回滚 mutation；
- 旧 `articleViewSummaries`、`article_view_summary` 和 `view-summary/*` 不再被读取，只有 `articleStats`、
  `ArticleStats` 和 `article-stats/*` 存在；
- 公共页面计数允许在约定 TTL 内陈旧，但 ArticleStats 直接查询仍返回合法 public scope 数据。

相关文档：

- [ViewTracker V2](../feature/view-tracker/v2.md)：事件、去重、Summary 投影、dead-letter 和删除协议；
- [Article Insights V1](../feature/analysis/article-insights-v1.md)：MetricEvent 与小时趋势；
- [Query/Store 边界](./query-store-boundary.md)：公共 Query、Viewer Query 和 hydration 的通用边界；
- [TanStack Query 通用失效](./query-invalidation.md)：typed target、ArticleStats batch matcher 与通用 executor；
- [TanStack Query 迁移](./urql-to-tanstack-query.md)：SSR QueryClient 与 HydrationBoundary 基础设施。
- [RequestActor](./request-actor.md)：公共 human/agent/crawler/unknown 请求主体分类能力；
- [公共缓存可靠失效](./public-cache-invalidation.md)：Phoenix transactional outbox、Oban worker 和 Cloudflare cache-tag purge。
