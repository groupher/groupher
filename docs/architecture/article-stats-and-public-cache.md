# ArticleStats 与公共页面缓存

> 状态：ArticleStats 持久化投影、同步 views 写入、owner revision DTO、SSR/CDN 合同、TanStack Query owner 和 Phoenix 公共缓存失效主链路已落地；
> 生产 telemetry、真实 Cloudflare purge 验收和外部观测接线仍是部署验收项，见第 8 节。
>
> 本文定义 Article 公共统计、SSR hydration、HTML/CDN 缓存和阅读判断边界。
> 本次改造的最终数据模型、排序投影和重建协议见
> [`article-stats-target.md`](./article-stats-target.md)。
> emotion direct cutover 已改用 `cms.article_emotion_counts` typed 行、GraphQL `ArticleEmotionCount` 和
> `emotionCounts`；旧 `reaction_counts`/`reactionCounts` 只作为历史名称保留在迁移说明中，runtime 不保留 alias、双读
> 或 JSONB fallback。迁移协议见 [`article-emotion-counts.md`](./article-emotion-counts.md)。
> 可靠 CDN 失效协议见 [`public-cache-invalidation.md`](./public-cache-invalidation.md)。
> [ViewTracker V2](../feature/view-tracker/v2.md) 只描述已经删除的历史异步实现；当前 canonical views 写协议以
> [`article-view-counting.md`](../feature/view-tracker/article-view-counting.md) 为准。本文的 ArticleStats 公共读取、
> SSR/CDN 与 hydration 边界继续有效。
> ViewTracker 只拥有阅读去重状态与当前 views，本文定义这些状态如何和其他公开计数一起被读取。
> 当前前端写后同步合同见
> [`article-stats-and-viewer-state-sync.md`](./article-stats-and-viewer-state-sync.md)。它已取代本文 §3.2 的 batch -> entity
> normalization 与 §6.2 的 whole-snapshot rejection；以下旧段落仅保留历史背景。

## 1. 结论

Article 的公开统计使用一个独立的 `ArticleStats` 读取合同：

```text
Article content
  └─ 标题、正文、作者、标签、生命周期

ArticleStats（公开 headline stats）
  ├─ views              <- CMS.ViewTracker 同步字段级 UPSERT
  ├─ upvotesCount       <- CMS.Interactions 同步事实/读取投影
  ├─ collectsCount      <- CMS.Interactions 同步事实/读取投影
  ├─ emotionCounts      <- CMS.Interactions typed emotion 读取投影
  ├─ commentsCount      <- Article/Comment 现有同步读取投影
  ├─ commentsParticipantsCount <- Comments 现有同步读取投影
  └─ snapshotAt         <- ArticleStats owner transaction 写入的持久化快照时间

ViewerState
  └─ viewerHasViewed / viewerHasUpvoted / viewerEmotion ...
```

`ArticleStats` 是公共读取 DTO 和前端 Query cache 边界，不是新的业务事实 owner。目标范围是文章页面所有公开、
可变、Article 级聚合计数：`views`、`upvotesCount`、`collectsCount`、`emotionCounts`、`commentsCount` 和
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
  stats: TArticleStats | null
  viewerState: TArticleViewerState
}
```

这不是兼容 wrapper。公开 content query 中的旧 root count、root viewer flag 和
`{ ...article, articleStats, ...viewerState }` merge 必须在同一验收边界删除。mutation confirmation 可以继续
返回专属 viewer state；它不属于 Article content view model，也不得被公共读取 Query 重新摊平。

## 2. 命名和所有权

### 2.1 命名表

| 名称                               | 含义                                                                 | 所有者                  | 是否进入公共 HTML |
| ---------------------------------- | -------------------------------------------------------------------- | ----------------------- | ----------------- |
| `ArticleStats`                     | Article 的公开可变聚合计数组合快照                                   | 公共读取合同 / Query 层 | 是                |
| `ViewerState`                      | 当前用户的 `viewerHas*` / emotion 等私有状态；不包含公开 views count | Viewer Query            | 否                |
| `snapshotAt`                       | ArticleStats 投影行最近一次 owner 同步的持久化快照时间               | ArticleStats projection | 是                |
| `viewsRevision`                    | ViewTracker 同步增加 views 后推进的版本                              | `CMS.ViewTracker`       | 是                |
| `interactionRevision`              | Interactions 公共计数的确认版本                                      | `CMS.Interactions`      | 是                |
| `commentsRevision`                 | Comments 公共计数的确认版本                                          | Article / Comments      | 是                |
| `thread` + `article_id`            | ViewTracker 内部唯一 identity                                        | `CMS.ViewTracker`       | 否                |
| `community` + `thread` + `innerId` | GraphQL 和前端公开 locator                                           | Article Reader / Query  | 是                |

`ArticleStats` 不叫 `ArticleSummary`，避免把公共多 owner 快照误解成 views-only 汇总；不叫
`Statistics`，避免重新建立无语义的泛化模块。

旧的公共读取合同直接删除，不保留 alias、fallback 或双读：

```text
articleViewSummaries       -> articleStats
article_view_summary       -> 删除旧 GraphQL type，使用 ArticleStats type
view-summary/{...}         -> article-stats/{community}/{thread}/{innerId}
```

旧 `CMS.ViewTracker.Model.ViewSummary`、`article_view_summary` GraphQL type 和 `view-summary/*` 前端 cache key
均已删除，不存在兼容读写入口。

`views` 是公开的 Article 总浏览数，不属于 `ViewerState`。`ViewerState.viewerHasViewed` 表示“当前 viewer
是否看过”，两者不是同一个数据维度：

```text
views                 -> 所有用户共享 -> ArticleStats -> 公共缓存
viewerHasViewed       -> 按 viewer 隔离 -> ViewerState  -> 私有缓存
```

前端命名：

```text
Q.article.stats(path)                         单篇公共统计 Query option
Q.article.statsBatch(paths)                   列表批量公共统计 Query option
articleQueryKeys.stats(path)                  真实单篇 query key
articleQueryKeys.statsBatch(paths)            真实列表 batch query key
articleStatsCache.contains(queryKey, path)    Detail/Batch 成员匹配边界
usePagedPosts/usePagedChangelogs              列表消费方
trackArticleView(path)                        单篇可见阅读 tracking；不是批量统计查询
```

产品列表通过 `usePagedPosts` / `usePagedChangelogs` 消费 `statsBatch`，Drawer 和详情通过同一 `stats` entity key
读取；各页面不能拼装自己的计数 query，也不能把结果写回 Article entity。GraphQL type/operation 和文件名继续使用
领域全名 `ArticleStats` / `articleStats.ts`；TypeScript namespace 内不保留旧函数 alias。

后端命名：

```text
CMS.FrontDesk.article_for_view_tracking  tracking 专用的 public Article admission
CMS.FrontDesk.lock_article_for_view_tracking 事务内 physical Article 锁与 Gate revalidation
CMS.ViewTracker.Record.track/4           同步 receipt/watermark/count 事务
CMS.ViewTracker.Retention                receipt/watermark 有界清理
CMS.ArticleStats.increment_views/2       ViewTracker 字段 owner UPSERT
```

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
    emotionCounts {
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

`viewsRevision`、`interactionRevision` 和 `commentsRevision` 已进入后端 DTO、GraphQL schema/operation、前端类型
和 mixed-response guard；它们不是 optional fallback，也不通过默认零掩盖缺失。

`ArticleStats` 查询复用 public Article Gate/Lifecycle；不存在、不可公开读取的 Article 不返回。
publish 会初始化 ArticleStats 零值行；历史异常缺行返回 `projection_not_updated`，不能伪造 epoch/zero 快照。

批量输入约束：

```text
同一 community
同一 thread
innerIds 去重后最多 100 个
空列表直接返回 []
```

公开 locator 不允许 sentinel：`community` trim 后必须是非空 slug，`thread` 必须是支持的公开 Article thread，
`innerId` 必须是合法公开 id。GraphQL boundary 在进入 loader 前拒绝 `community: ""`；ArticleStats DTO 和 Query key
也不得生成空 community。只持有内部 `thread + article_id` 的 ViewTracker 路径必须先通过权威 public Article reader
解析公开 locator，不能用空字符串表示“社区未知”。

一次 `articleStats` batch request 返回每个 Article 的完整 headline stats；不能为了 views、upvotes 和 comments
分别发三次请求，也不能在服务端按 Article 逐篇查询。

服务端 response assembly 只读取持久化 `snapshotAt`，不是 SSR/GraphQL 组装时间，也不是客户端收到响应的时间。
所有字段 owner API 都使用数据库 `clock_timestamp()` 写入，不能退回应用节点时间或 transaction-start `now()`。

### 3.2 前端 cache identity

> 历史合同，已被
> [`article-stats-and-viewer-state-sync.md`](./article-stats-and-viewer-state-sync.md) 取代。当前不再 batch -> entity seed；
> `articleQueryKeys.stats(path)` 只作为 Detail/Drawer 的真实 query key 保留。

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
  ├─ 读取 ArticleStats 持久化 snapshotAt
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
`snapshotAt` 必须随数据进入共享 hydration payload；CDN 命中不会重新生成它，只有 owner transaction 成功同步
ArticleStats 投影时才会写入新值。

如果响应没有可靠的 `Date`/`Age`，仍以 `snapshotAt` 加服务端定义的 `clock_skew_tolerance_seconds` 做保守判断；不得使用
浏览器本地时钟直接制造新的 `snapshotAt`。客户端时钟领先、落后、CDN cache hit 和一次过期 refetch 都必须有验收用例，
并保证一次 hydration 最多触发一次初始 refresh，不形成 refetch loop。

`revision` 和 `snapshotAt` 职责不同：

```text
snapshotAt           判断整份快照新鲜度
viewsRevision        防止旧 views 响应覆盖已同步提交的新 views
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
  -> mutation 返回完整 ArticleStats 时直接按 revision vector 写入 entity
  -> 没有完整快照的其他 mutation 才 invalidate 对应 ArticleStats target
  -> 后续 HTML 在 TTL 到期或显式 revalidate 后收敛
```

这些 count 由不同 owner 的同步业务事务写入；这不改变它们在
ArticleStats 公共读取层使用同一 `snapshotAt` 和同一缓存策略。论坛页面接受公共 HTML 中的计数最多陈旧约 10 分钟；
这不是数据库事实不一致，而是公共页面快照策略。
需要立即看到变化的当前用户依赖 mutation 返回的确认快照或通用 Query invalidation，不依赖本地 `+1`，也不要求清理整页 CDN。

ArticleStats GraphQL 可以在真实 QPS 数据证明有收益后增加 5–15 秒的服务端/边缘 microcache；该 microcache
必须按单篇 ArticleStats identity 处理，不能把不同 batch 参数当成不同权威快照。它不能改变第 4.2 节的
hydration freshness 合同。

## 5. 阅读和 tracking 判断策略

> 本节记录当前 admission 行为；完整策略见
> [`article-view-counting.md`](../feature/view-tracker/article-view-counting.md) §3。

“调用 Article 内容”与“计入 Groupher 业务 views”是两个动作。判断由 producer 明确声明，不能从普通 reader 的
调用位置推断。

| 场景                            | 是否 tracking | 判断规则                                              |
| ------------------------------- | ------------- | ----------------------------------------------------- |
| 详情页真正可见                  | 是            | wrapper 相交、页面 visible、连续可见达到共享合同阈值  |
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
  + 连续保持 >= VIEW_COUNTING_CONTRACT.humanMinVisibleMs
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

只有 `public_read` 进入有效阅读去重和同步 counted transaction；其他 purpose 返回 `EXCLUDED_BY_POLICY` 且不写
receipt/watermark/MetricEvent/ViewerState。不能因为调用方忘传参数而默认为公开阅读。普通内容 reader 不调用 tracking，
因此不会产生隐式副作用。

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

ArticleStats 是多 owner 的持久化公开快照：

### 6.1 View tracking 收敛

```text
trackArticleView
  -> counted / duplicate / excluded 明确决定
  -> counted 返回时 views/viewsRevision 已提交
  -> 返回完整 ArticleStats + ViewerArticleState
  -> 前端按 revision vector 写入各自 cache
  -> 不 invalidate、不延迟 refetch、不本地 views + 1
```

### 6.2 快照顺序与 mutation receipt

> 当前客户端 guard 是 revision-vector-first：任一 owner revision 倒退时拒绝整份 ArticleStats；没有倒退且至少
> 一个 revision 前进时接受，`snapshotAt` 只在 revisions 全部相等时排序。合法的 ViewerState 始终独立应用，
> 不随 ArticleStats 一起丢弃。
>
> 以下 whole-snapshot guard 是历史合同，已被
> [`article-stats-and-viewer-state-sync.md`](./article-stats-and-viewer-state-sync.md) 的 owner-wise merge 取代。服务端
> `snapshotAt` 语义不变，前端合成对象的 `snapshotAt` 只用于 stale/refetch 提示与诊断。

写入 cache 前执行：

```text
任一 incoming owner revision < current owner revision
  -> 丢弃整份 mixed/stale 快照并记录 telemetry

没有 revision 倒退，且至少一个 owner revision 前进
  -> 接受 incoming 整份；timestamp 非法时标记 Query stale 并记录 telemetry

所有 owner revisions 相等
  -> 只按 snapshotAt 排序；非法或更旧的 incoming timestamp 被拒绝
```

ArticleStats 不对任何公共 count 做逐字段拼接。三个 owner revision 是首要偏序，`snapshotAt` 只处理 revision 相等的
响应顺序；任何 revision 倒退都 fail closed。

upvote、emotion 和 comment mutation 的 receipt 只保存 viewer confirmation 与对应 owner revision。公开 count 不进入
mutation receipt，也不能写入或拼接 ArticleStats entity。这个 receipt 是私有 ViewerState 的短期 read-your-writes 桥接，
不是 ArticleStats projection 的生命周期标记：

```text
mutation confirmed
  -> receipt = viewer state + owner revision
  -> invalidate/refetch ArticleStats
  -> selector 只读取 ArticleStats 的公开 count；viewer state 走私有 Query

ArticleStats owner revision < receipt revision
  -> 保留 receipt，并继续 invalidate/refetch ArticleStats；它只决定是否需要继续读取私有 ViewerState

ArticleStats owner revision >= receipt revision
  -> 接受完整 ArticleStats snapshot；允许 reconciliation 顺手清除陈旧 receipt

ViewerState.interactionRevision >= receipt.interactionRevision
  -> 清除 receipt；这只证明私有 viewer state 已收敛，不宣称公共 ArticleStats 已收敛
```

receipt TTL 仍使用共享 `CONFIRMED_WRITE_RECEIPT_TTL_MS`，覆盖公共 HTML 的最大陈旧窗口，避免确认后的私有 viewer state
在公共页面尚未刷新时过早消失。TTL 到期是私有 receipt 的卫生清理，不把 ArticleStats revision 伪装成已收敛；如果仍需
监控 public projection latency，使用独立的 revision/convergence telemetry。

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

本设计不迁移历史 `Article.views`，不从旧字段、已删除的 ViewEvent 或 Analysis hourly metric 重算当前 views。
当前 Article content schema、GraphQL fragments、DTO 和前端类型中不再存在旧
`views/viewsRevision/upvotesCount/commentsCount/commentsParticipantsCount/collectsCount/emotions` 公共字段。

## 8. 实施状态与验收

> 同步 views direct cutover 已落地；剩余项是生产边缘、观测和并发负载验收，不存在另一套运行时协议。

已落地主链路：

- `ArticleStats` GraphQL 查询的 V1 字段、`snapshotAt`、public locator 和归一化 Query key；
- SSR request-scoped QueryClient、public hydration allowlist、600 秒 HTML/ArticleStats freshness；
- 初始 `views/upvotes/comments` 已从 Article content 分离，列表、Drawer、详情共享 ArticleStats entity；
- tracking admission、同步 `views/viewsRevision` UPSERT、短期 receipt/watermark 以及客户端 revision-vector fail-closed；
- mutation 直接返回 committed ArticleStats/ViewerState，旧 accepted、异步 projector 和两次 refetch 已删除；
- 旧 `articleViewSummaries`、`article_view_summary`、`view-summary/*` 和 Article count fallback 已删除；
- 内容变化 purge HTML、单次 view/upvote/comment 不 purge 整页的缓存边界。

当前剩余的是生产验收与观测，不是另一套运行时读路径：

1. P1：把 `ArticleStats` mixed-response、clock-skew 和同步 counting transaction 的 telemetry 接入生产指标/告警
   sink；开发环境仍可保留 `console.warn` fallback；
2. P1：在真实 Cloudflare zone 验证 tag purge、`CF-Cache-Status`、outbox drain、dead-letter 和 credential/readiness 告警；
3. P2：补齐真实浏览器 tracking、SSR/CDN freshness 与生产 purge health e2e；不增加旧字段、旧 Query key 或兼容入口。

验收至少包括：

- `articleStats` 对 1、20、100 个 Article 都只产生一次 GraphQL batch request；返回每篇完整的
  `views/upvotesCount/collectsCount/emotionCounts/commentsCount/commentsParticipantsCount` 和三个 owner revision；
- 后端 ArticleStats 读取使用一个 scoped SQL，或有明确上限的固定数量 owner reads；查询次数不随 Article 数量
  或 count 类型数量增长，禁止 N+1 和按 count 类型拆分查询；
- 对 1、20、100 条输入执行 `EXPLAIN (ANALYZE, BUFFERS)` 和 select-count 测试，验证 Article locator、
  ArticleStats locator、排序及 count owner 读取使用预期索引；
- `community: ""`、全空格 community、未知 thread 和非法 inner id 在 GraphQL boundary fail closed，DTO 和 Query key
  从不产生空 community sentinel；
- CDN cache hit 返回的 HTML 与 hydration ArticleStats 数字一致；
- SSR 使用独立 request-scoped QueryClient，浏览器 hydration 恢复同一 public ArticleStats query；
- `dehydrate` 只输出 public allowlist，登录 SSR 中的 ViewerState、account 和 subscription 数据不出现在 HTML/RSC
  或 hydration payload；mutation/optimistic 状态同样不得进入公共 hydration；
- public route 不使用 ViewerState 生成 SSR HTML；需要 SSR viewer 状态的页面必须是 private/no-store；
- SSR 回源读取 owner 已写入的 `snapshotAt`，CDN cache hit 不伪造新的时间；只有 ArticleStats owner sync 才推进该时间；
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
- confirmed mutation receipt 不做本地加一、不携带公开 count、不写入 ArticleStats cache；receipt 清除由私有 ViewerState
  收敛或 TTL 负责，ArticleStats owner revision 只负责控制公开 snapshot 的接收与 refetch；
- `clock_skew`、`invalid_snapshot`、`mixed_snapshot` 和 receipt timeout 可在生产 telemetry 中查询，不能只出现在
  浏览器 console；
- purge 未配置、重试和最终失败都有结构化 metric/health 信号；领域 mutation 成功后 purge 失败不会回滚 mutation；
- 旧 `articleViewSummaries`、`article_view_summary` 和 `view-summary/*` 不再被读取，只有 `articleStats`、
  `ArticleStats` 和 `article-stats/*` 存在；
- 公共页面计数允许在约定 TTL 内陈旧，但 ArticleStats 直接查询仍返回合法 public scope 数据。

相关文档：

- [ViewTracker V2](../feature/view-tracker/v2.md)：事件、去重、Summary 投影、dead-letter 和删除协议；
- [Article View 同步计数](../feature/view-tracker/article-view-counting.md)：已替换 V2 views 写协议的当前合同；
- [Article emotion counts](./article-emotion-counts.md)：沿用 `(thread, article_id)` 的 typed-row 与 GraphQL direct cutover；
- [Article Insights V1](../feature/analysis/article-insights-v1.md)：MetricEvent 与小时趋势；
- [Query/Store 边界](./query-store-boundary.md)：公共 Query、Viewer Query 和 hydration 的通用边界；
- [TanStack Query 通用失效](./query-invalidation.md)：typed target、ArticleStats batch matcher 与通用 executor；
- [TanStack Query 迁移](./urql-to-tanstack-query.md)：SSR QueryClient 与 HydrationBoundary 基础设施。
- [RequestActor](./request-actor.md)：公共 human/agent/crawler/unknown 请求主体分类能力；
- [公共缓存可靠失效](./public-cache-invalidation.md)：Phoenix transactional outbox、Oban worker 和 Cloudflare cache-tag purge。
