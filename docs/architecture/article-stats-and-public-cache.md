# ArticleStats 与公共页面缓存

> 状态：目标架构，待实施。
>
> 本文定义 Article 公共统计、SSR hydration、HTML/CDN 缓存和阅读判断边界。
> 它在读取与缓存合同上独立于 [ViewTracker V2](../feature/view-tracker/v2.md) 的事件、去重和投影协议；
> 本文列出的 ViewTracker 后端命名只表示边界映射，事件处理、投影和 retention 的 canonical 重构仍以 V2 为准。
> ViewTracker 只拥有有效阅读事实与当前 views，本文定义这些事实如何和其他公开计数一起被读取。

## 1. 结论

Article 的公开统计使用一个独立的 `ArticleStats` 读取合同：

```text
Article content
  └─ 标题、正文、作者、标签、生命周期

ArticleStats（公开 headline stats）
  ├─ views              <- CMS.ViewTracker.ArticleViewSummary
  ├─ upvotesCount       <- CMS.Interactions 同步事实/读取投影
  ├─ commentsCount      <- Article/Comment 现有同步读取投影
  └─ snapshotAt         <- 本次 ArticleStats 响应的服务端生成时间

ViewerState
  └─ viewerHasViewed / viewerHasUpvoted / viewerEmotion ...
```

`ArticleStats` 是公共读取 DTO 和前端 Query cache 边界，不是新的业务领域，也不是新的数据库事实表。
V1 的范围是文章页面的 headline stats：`views`、`upvotesCount`、`commentsCount`。三者虽然写入来源不同，
但在公共读取层使用同一个快照、同一个 `snapshotAt` 和同一套缓存策略。

Article 内容、ArticleStats 和 ViewerState 不能再互相覆盖：

```text
Article content  ───────┐
ArticleStats     ───────┼─> render selector -> UI
ViewerState      ───────┘

禁止：把 ArticleStats 再写回 Article.views/viewsRevision
禁止：把 ViewerState 写回公共 ArticleStats
```

## 2. 命名和所有权

### 2.1 命名表

| 名称                               | 含义                                                                 | 所有者                  | 是否进入公共 HTML            |
| ---------------------------------- | -------------------------------------------------------------------- | ----------------------- | ---------------------------- |
| `ArticleStats`                     | views、upvotes、comments 三个 headline stats 的组合快照              | 公共读取合同 / Query 层 | 是                           |
| `ArticleViewSummary`               | 当前 views 的持久化汇总                                              | `CMS.ViewTracker`       | 通过 `ArticleStats` 间接进入 |
| `ViewerState`                      | 当前用户的 `viewerHas*` / emotion 等私有状态；不包含公开 views count | Viewer Query            | 否                           |
| `snapshotAt`                       | ArticleStats 在服务端组装完成的时间                                  | ArticleStats transport  | 是                           |
| `viewsRevision`                    | ViewSummary 成功投影后的版本                                         | `CMS.ViewTracker`       | 是                           |
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

这里的 `CMS.ViewTracker.ArticleViewSummary` 是后端持久化 views 汇总模型，不能与已删除的
`article_view_summary` GraphQL type 或旧的 `view-summary/*` 前端 cache key 混用。

`views` 是公开的 Article 总浏览数，不属于 `ViewerState`。`ViewerState.viewerHasViewed` 表示“当前 viewer
是否看过”，两者不是同一个数据维度：

```text
views                 -> 所有用户共享 -> ArticleStats -> 公共缓存
viewerHasViewed       -> 按 viewer 隔离 -> ViewerState  -> 私有缓存
```

前端命名：

```text
useArticleStats(ref)          单篇公共统计
useArticleListStats(refs)     列表批量公共统计
useArticleViews(ref)          只有在确实只需要 views 时使用的窄读取
useArticleListViews(refs)     只有在确实只需要 views 时使用的批量窄读取
useTrackArticleView(ref)      单篇可见阅读 tracking；不是批量统计查询
```

产品列表、Drawer 和详情页默认使用 `useArticleStats`，不各自拼装一套计数读取。
`useArticleViews` / `useArticleListViews` 不能再把结果写回 Article entity。

后端命名：

```text
CMS.ViewTracker.ArticleViewSummary       持久化当前 views
CMS.ViewTracker.Query.summaries/2        已授权 canonical Article 的内部批量读取
CMS.FrontDesk.article_for_view_tracking  tracking 专用的 public Article admission
CMS.ViewTracker.EventProcessor            ViewEvent 领域处理和投影协调
GroupherServer.Jobs.ViewEventProcessor   Oban worker 外壳
```

不再使用 `Project.project` 作为投影入口；`project` 既不表达事件处理边界，也容易和普通
Project 业务模块混淆。`read_public_article_for_tracking` 只表示 tracking admission，普通
Article content reader 不承担计数副作用。

字段和分类遵循统一术语：使用 `actor_type`、`type`、`is_authenticated`、
`viewer_tracking_key`、`read_purpose`；不新增 `_kind`、`target_type/target_id` 或 `count_intent`。

### 2.2 缓存策略的唯一所有者

三项缓存常量由一个后端/契约 owner 统一定义并向各层输出，不允许 SSR、CDN 配置和前端 hook 各自复制：

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
    commentsCount
    snapshotAt
  }
}
```

`ArticleStats` 查询复用 public Article Gate/Lifecycle；不存在、不可公开读取的 Article 不返回。
存在但还没有 `ArticleViewSummary` 的 Article 返回 `views=0, viewsRevision=0`。

批量输入约束：

```text
同一 community
同一 thread
innerIds 去重后最多 100 个
空列表直接返回 []
```

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
  -> each entity contains views + upvotesCount + commentsCount
```

Dirty marker 也按同一原则工作：多个 dirty Article 合并成一次 batch request；单篇 dirty 不得退化为“每个 count
一个请求”。

公开 `ArticleStats` 与私有 `ViewerState` 使用不同 Query key。UI 可以在 selector 中组合，不能把私有字段写进
公共 Query，也不能把 ViewerState dehydration 到共享 HTML。`views`、`upvotesCount` 和 `commentsCount` 三个
公开 count 不因写入来源不同而拆成不同的公共缓存策略。

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

默认值由 `ArticleStats.CachePolicy` 定义，所有 public Article surface 共用，不由列表、Drawer、详情页各自调整：

```text
public_article_html_s_maxage_seconds       = 600   # 10 分钟
public_article_html_swr_seconds            = 300   # 额外 5 分钟 stale-while-revalidate
article_stats_snapshot_max_age_seconds     = 600   # 10 分钟
clock_skew_tolerance_seconds               = 120   # 客户端/服务端时钟偏差保护
```

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
snapshotAt     判断快照新鲜度
viewsRevision  防止旧的 ViewSummary 覆盖新的 ViewSummary
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

三种 count 的写入一致性不同：views 经过异步投影，upvotes/comments 通常由同步业务事务更新；这不改变它们在
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

登录用户和匿名 Session 都进入同一套 `viewer_tracking_key` + 滑动窗口去重，只在分类维度上区分：

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

## 6. 失败、revision 与读取收敛

ArticleStats 是最终一致的公开快照：

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

写入 cache 前执行：

```text
incoming.snapshotAt < current.snapshotAt
  -> 丢弃整份旧快照，不做字段级合并

incoming.snapshotAt >= current.snapshotAt
  且 incoming.viewsRevision >= current.viewsRevision
  -> 用 incoming 整份替换 ArticleStats entity

incoming.snapshotAt > current.snapshotAt
  但 incoming.viewsRevision < current.viewsRevision
  -> 视为混合/非法响应，丢弃整份并记录 telemetry

upvotesCount/commentsCount
  -> 没有独立 revision；只随较新的 snapshotAt 整体收敛
```

ArticleStats 不做 `views`、`upvotesCount`、`commentsCount` 的逐字段拼接。`snapshotAt` 是公共快照的唯一整体顺序，
`viewsRevision` 只是 views 投影的额外单调保护；任何不满足上述关系的响应都 fail closed。

网络失败不应阻断文章阅读，但必须记录不包含 Cookie、event id 或 tracking key 的 failure telemetry，至少区分
timeout、network 和 GraphQL error category。

## 7. 不允许的实现形态

```text
Article.views + ArticleStats 双写
ArticleStats miss -> fallback Article.views
Summary 查询结果回写 Article.views/viewsRevision
Article content 和 ArticleStats 各自维护一份公开 views/upvotes/comments 快照
把公开 views count 误放进 ViewerState
SSR 普通 content reader 隐式 tracking
用客户端收到响应的时间伪造 snapshotAt
把 ViewerState dehydration 到公共 HTML
把 mutation/optimistic 状态 dehydration 到公共 HTML
用 accepted receipt 做本地 +1
为每次 view 增量 purge 公共 HTML
```

本设计不迁移历史 `Article.views`，不从旧字段、ViewEvent 或 Analysis hourly metric 回填新的 Summary。
实施完成后 Article content schema、GraphQL fragments、DTO 和前端类型中不再存在旧
`views/viewsRevision/upvotesCount/commentsCount` 字段。

## 8. 实施与验收

实施顺序：

1. 固定 `ArticleStats` GraphQL DTO、`snapshotAt` 和 public locator/query key；
2. 在 SSR request-scoped QueryClient 中预取 ArticleStats，并和 HTML 使用同一数据渲染；
3. 接入 `dehydrate/HydrationBoundary`，设置统一 10 分钟 freshness；
4. 移除 Article content 中的 `views/viewsRevision`、`upvotesCount`、`commentsCount` 及对应公开 revision/overlay/fallback；
5. 让列表、Drawer、详情统一读取 ArticleStats entity；
6. 将 tracking、ViewerState 和 ArticleStats 的失效边界分别接好；
7. 用 `articleStats` 完整替换 `articleViewSummaries`；删除 `article_view_summary` GraphQL type、旧 generated
   operation、旧 hooks/tests 和 `view-summary/*` cache key；不保留 alias、fallback 或双读；
8. 最后删除旧 QueryBuilder `ORDER BY Article.views` 和残留类型/fragment。持久化的
   `CMS.ViewTracker.ArticleViewSummary` 仍作为 views owner，但只能通过 ArticleStats 进入公共读取。

验收至少包括：

- `articleStats` 对 1、20、100 个 Article 都只产生一次 GraphQL batch request；返回每篇完整的
  `views/upvotesCount/commentsCount`；
- 后端 ArticleStats 读取使用一个 scoped SQL，或有明确上限的固定数量 owner reads；查询次数不随 Article 数量
  或 count 类型数量增长，禁止 N+1 和 views/upvotes/comments 三路拆分查询；
- 对 1、20、100 条输入执行 `EXPLAIN (ANALYZE, BUFFERS)` 和 select-count 测试，验证 Article locator、
  ArticleViewSummary 及 count owner 读取使用预期索引；
- CDN cache hit 返回的 HTML 与 hydration ArticleStats 数字一致；
- SSR 使用独立 request-scoped QueryClient，浏览器 hydration 恢复同一 public ArticleStats query；
- `dehydrate` 只输出 public allowlist，登录 SSR 中的 ViewerState、account 和 subscription 数据不出现在 HTML/RSC
  或 hydration payload；mutation/optimistic 状态同样不得进入公共 hydration；
- public route 不使用 ViewerState 生成 SSR HTML；需要 SSR viewer 状态的页面必须是 private/no-store；
- SSR 回源生成新的 `snapshotAt`，CDN cache hit 不伪造新的时间；
- snapshot 未过期时 hydration 后不发起 ArticleStats 初始请求；
- snapshot 过期、缺失或被 invalidate 时只请求 ArticleStats，不重新请求正文；
- 客户端时钟领先、落后或缺少可靠 `Date`/`Age` 时，按 `clock_skew_tolerance_seconds` 保守判断，不产生 refetch loop；
  一次 hydration 最多触发一次初始 ArticleStats refresh；
- 内容编辑/发布 purge HTML；单次 view/upvote/comment 不触发整页 purge；
- 详情页、列表和 Drawer 使用同一个 ArticleStats entity，不能出现两份公开 views/upvotes/comments 计数；
- ArticleStats 的 `snapshotAt` 较旧响应整份丢弃；较新的 `snapshotAt` 若带较低 `viewsRevision` 也整份丢弃，
  不允许把三个 count 分别从不同响应拼接；
- ArticleStats 中三种公开 count 使用同一 snapshot/cache policy；ViewerState 只包含 viewer-owned flags，不包含公开 count；
- ViewerState 不进入公共 HTML，登录/匿名状态不会污染 ArticleStats cache；
- prefetch、SSR、后台标签页、列表曝光不 tracking；详情和 Drawer 真正可见后只 tracking 一次；
- SSR hydration 使用真实 ArticleStats，不显示 placeholder；SPA 客户端导航在 ArticleStats pending 时使用固定加载槽位：
  列表/card 至少 `4ch`，Drawer/detail 至少 `5ch`，加载完成前后 bounding rect 不发生可感知位移；
- API/Agent/Crawler 只有显式 public-read adapter 才进入 Groupher 业务 views；
- accepted receipt 不做本地加一，投影完成后通过 refetch/revision 收敛；
- 旧 `articleViewSummaries`、`article_view_summary` 和 `view-summary/*` 不再被读取，只有 `articleStats`、
  `ArticleStats` 和 `article-stats/*` 存在；
- 公共页面计数允许在约定 TTL 内陈旧，但 ArticleStats 直接查询仍返回合法 public scope 数据。

相关文档：

- [ViewTracker V2](../feature/view-tracker/v2.md)：事件、去重、Summary 投影、dead-letter 和删除协议；
- [Article Insights V1](../feature/analysis/article-insights-v1.md)：MetricEvent 与小时趋势；
- [Query/Store 边界](./query-store-boundary.md)：公共 Query、Viewer Query 和 hydration 的通用边界；
- [TanStack Query 迁移](./urql-to-tanstack-query.md)：SSR QueryClient 与 HydrationBoundary 基础设施。
