# ArticleStats 目标架构

> 状态：ArticleStats 持久化公共投影、三类 owner revision、排序索引、typed emotion 行表及 GraphQL/SSR/Query
> 边界已在本地落地；本文原先的 canonical Article 长期候选已被
> [Article Revision / Draft 目标架构](../feature/article/revision-draft-target.md) 吸收。
> 当前 stats runtime 仍使用 physical identity，后续随该 direct cutover 一次性切换，
> 不再维护第二套 canonical Article 方案。
>
> 本文是本次 ArticleStats 改造的最终目标，不是后续可选优化。实现不保留旧字段、旧 Query key、双读或兼容层。
> 本文从长期维护、读取性能和扩展能力出发，定义本次按目标直接切换的 Article 公共计数架构。
> 当前主链路及其 P0/P1 收敛补强仍以
> [`article-stats-and-public-cache.md`](./article-stats-and-public-cache.md) 为准。
> views 的 direct cutover 已按
> [`article-view-counting.md`](../feature/view-tracker/article-view-counting.md) 落地；ViewSummary/EventProcessor 已删除，
> `ArticleStats.views/viewsRevision` 已成为 ViewTracker 的 canonical current counter。
> emotion typed-row 与 GraphQL 改名是独立 direct cutover，以
> [`article-emotion-counts.md`](./article-emotion-counts.md) 为准；它不属于 views 写协议。

## 1. 结论

目标架构只使用 `ArticleStats` 一个名称，表示从数据库读取投影、GraphQL DTO 到前端 Query cache
的同一条公共读取边界：

```text
Comments owner ───────────┐
Interactions owner ───────┼─> ArticleStats 读取投影 ─> GraphQL ArticleStats ─> UI
ViewTracker owner ────────┘
```

`ArticleStats` 是可排序、按 Article 定位的公共读取边界。Comments/Interactions 列是可从各自领域事实重建的投影；
同步 view 计数切换后，views 列同时是 ViewTracker 拥有的 canonical current counter：

- Comments 决定 `commentsCount/commentsParticipantsCount/commentsRevision`；
- Interactions 决定 `upvotesCount/collectsCount/emotionCounts/interactionRevision`；
- ViewTracker 通过字段级 UPSERT 决定 `views/viewsRevision`，不再保留 ViewSummary 副本；
- ArticleStats 为公共页面提供固定查询成本和排序索引，不反向覆盖 Comments/Interactions 领域事实；
- `snapshotAt` 由每个 owner 的数据库写语句使用 `clock_timestamp()` 推进；公共 GraphQL 直接返回该值。

目标不是把不同 count 的写入语义统一，而是统一它们的公共读取、排序、缓存和收敛协议。

## 2. 为什么需要独立读取投影

当前实现已解决公开计数从 Article content 分离的问题，公共读取直接使用 `cms.article_stats`；长期目标继续讨论
跨 thread identity 和 emotion 排序扩展：

```text
scoped Article query
  + cms.article_stats(thread, article_id)
  -> Article content + ArticleStats DTO
```

这条链路对普通列表是固定查询数量，不是 N+1；结构性问题主要出现在排序和扩展上：

- 当前排序已经使用 ArticleStats 的 `(thread, count)` 预计算索引；目标模型将 community 维度纳入统一 identity；
- 新增可排序 emotion 时，不能为每种 emotion 在列表查询里临时增加相关子查询；
- owner revision 没有全部进入 ArticleStats，客户端无法证明每个公共 count 已经追上 mutation receipt；
- thread 对应不同物理 Article 表，ViewTracker 等多态投影无法建立统一 Article 外键。

typed emotion 投影已经基于现有 `(thread, article_id)` identity 落地。canonical Article identity
现已并入 Revision / Draft 目标方案；它仍不是已完成 emotion direct cutover 的前置条件，
但后续 stable identity cutover 会统一替换本文的 physical identity。

## 3. Canonical Article identity（已并入 Revision / Draft 目标方案）

本节描述已被 Revision / Draft 目标方案吸收的物理方向，不代表当前 runtime 已完成切换。当前仍使用 `(thread, article_id)` 作为
ArticleStats、typed emotion rows 和各 owner state 的内部 identity；公共 GraphQL locator 仍是
`community + thread + innerId`。

所有 Article thread 共享一个稳定、全局唯一的 Article identity：

```text
cms.articles
├─ id                    全局 Article id
├─ community_id
├─ thread
├─ inner_id
├─ lifecycle_state
├─ author_id
├─ inserted_at
└─ updated_at

UNIQUE (community_id, thread, inner_id)
```

thread 专属内容继续放在各自模型中。Post/Blog/Changelog 一对一关联 canonical Article；
Doc 的 stable identity 跨 branch 共享，但 stats/runtime facts 按 `article_id + branch_id` 隔离：

```text
cms.articles
  ├─ cms.posts.article_id
  ├─ cms.blogs.article_id
  ├─ cms.changelogs.article_id
  └─ cms.docs.article_id
       ├─ branch A physical row
       └─ branch B physical row（若 canonical 表示跨 branch logical Doc）
```

当前 runtime 仍由不同 Doc branch 的 physical `docs.id` 各自拥有 stats。stable identity
cutover 后，Doc views/interactions/comments/stats 的 owner key 改为
`article_id + branch_id`；删除 preview branch 不影响 main。不能只把 canonical id 合并后
继续用一行 article-global stats 覆盖所有 branch。

Comments、Interactions、ViewTracker 和 ArticleStats 都只引用 `articles.id`：

```text
                        ┌─ comments.article_id
cms.articles.id ────────┼─ article_reaction_infos.article_id
                        ├─ article_view_dedupe_states.article_id
                        ├─ article_viewer_states.article_id
                        ├─ article_emotion_counts.article_id
                        └─ article_stats.article_id
```

这样可以删除领域内部的 `thread + physical article_id` 多态 identity、按 thread 选择模型的 Matcher
分支，以及 permanent delete 时手动模拟外键级联的协议。`thread` 仍是产品类型，不再承担数据库 identity。

## 4. ArticleStats 数据模型

### 4.0 当前固定字段物理模型

```text
cms.article_stats
├─ thread
├─ article_id
├─ views / views_revision
├─ upvotes_count / collects_count
├─ comments_count / comments_participants_count
├─ interaction_revision / comments_revision
└─ snapshot_at           当前由每个字段 owner API 使用 DB clock_timestamp() 写入

cms.article_emotion_counts
├─ thread / article_id / type
├─ count
└─ interaction_revision

UNIQUE (thread, article_id)
INDEX (thread, views|upvotes_count|comments_count|collects_count)
```

当前 owner transaction 直接 upsert 这一行；FrontDesk/GraphQL 不在 request time 从 Article、ReactionInfo 或其他
owner 表重新拼 count，也不对缺失行做 legacy fallback。GraphQL 在同一 statement snapshot 中读取固定字段并聚合 typed emotion
rows；views 由 ViewTracker 字段级 UPSERT 直接写入 ArticleStats，所有 owner 的 `snapshot_at` 都由数据库
`clock_timestamp()` 写入。旧 `reaction_counts` 已在 direct cutover 中删除，没有双读、双写或兼容字段。

### 4.1 固定公共计数（canonical 目标模型）

稳定、所有 Article 都有的公共计数使用显式字段：

```text
cms.article_stats
├─ article_id             PK, FK -> cms.articles.id
├─ community_id           用于社区范围排序
├─ thread                 用于 thread 范围排序
├─ views
├─ views_revision
├─ upvotes_count
├─ collects_count
├─ interaction_revision
├─ comments_count
├─ comments_participants_count
├─ comments_revision
├─ inserted_at
└─ updated_at
```

约束：

```text
所有 count >= 0
所有 revision >= 0
community_id/thread 必须与 canonical Article 一致
每个 Article 恰好一行 ArticleStats
```

`community_id` 和 `thread` 是有意保留的排序维度副本，不是第二套 locator。它们由 Article 创建、移动或类型迁移
协议维护，并可通过一致性任务从 canonical Article 修复。

### 4.2 可扩展 emotion counts（当前实现）

旧 `article_stats.reaction_counts` JSONB 和 GraphQL `reactionCounts` 已删除。当前 direct cutover 已创建
`cms.article_emotion_counts`，并将 GraphQL 字段改为 `emotionCounts`，没有建立
`ArticleReactionCount`、JSONB shadow、双写或兼容 alias。

每个 emotion type 使用独立 `ArticleEmotionCount` 行；`UPVOTE`/`COLLECT` 继续使用 ArticleStats 固定字段。
`emotionCounts` 不是所有 emotion 的总数。typed schema、Ecto owner transaction、同一 statement snapshot、排序索引、
维护窗口迁移和验收的唯一详细合同见
[`article-emotion-counts.md`](./article-emotion-counts.md)。

typed row 直接使用现有 `(thread, article_id, type)` identity；其中 `article_id` 是对应 thread 内容表的主键。
本次没有引入 `cms.articles`，也没有保留旧 JSONB/GraphQL 生产路径。若未来采用 §3 的全局 identity，需要单独迁移这些
typed rows，不能把该长期方案描述为当前事实。

### 4.3 revision 是 owner version vector

ArticleStats 不依赖 `snapshotAt` 单独判断新旧：

```text
ArticleStats revision vector
├─ viewsRevision
├─ interactionRevision
└─ commentsRevision
```

接收新快照时先比较 revision vector：

```text
任一 incoming owner revision < current owner revision
  -> mixed/stale，丢弃整份 ArticleStats

没有 revision 倒退，且至少一个 revision 严格前进
  -> 接受整份 ArticleStats
  -> snapshotAt 反常只记录 clock_skew

所有 revisions 相等
  -> 使用 snapshotAt 决定新旧
```

任一 owner revision 倒退，都将整份 incoming ArticleStats 判定为 mixed snapshot 并丢弃。客户端不做逐字段拼接。
每个 revision 都是对应 owner 在单个 Article 范围内持久化的单调序列，不使用进程内计数器或 wall clock 代替。
合法的私有 ViewerState 独立应用，不随被拒绝的 ArticleStats 一起丢弃。`snapshotAt` 由 owner SQL 使用数据库
`clock_timestamp()` 写入；这项 revision-first 规则已经随同步 view 计数 direct cutover 替换旧 timestamp-first guard。

### 4.4 一致快照

当前模型中，固定字段和 `emotionCounts` 由同一个数据库 statement snapshot 读取：一条 Ecto query 按 thread JOIN
ArticleStats 并聚合 typed emotion rows。`snapshotAt` 不在 response 组装时伪造，而是返回持久化投影时间。

这是读取一致性约束；§6.3/§6.4 中 owner transaction 内同步更新 ArticleStats 是写入原子性约束。两者相互独立：
写入不能依赖读取端修补半完成状态，读取也不能因为各 owner 分别原子提交就跨多个 statement 拼装伪快照。

## 5. 排序是一等能力

每个允许成为列表 order 的 count，都必须先拥有预计算值和匹配索引。禁止为了支持一个排序选项，在运行时引入
`COUNT(*)`、相关子查询或加载 interaction facts。

当前固定字段已落地 `(thread, metric, article_id)` 索引；当前 typed emotion 排序索引是：

```sql
CREATE INDEX article_emotion_counts_order_idx
ON cms.article_emotion_counts
  (thread, type, count DESC, article_id DESC);
```

它与当前 `(thread, physical article_id)` identity 一致。以下带 `community_id` 的索引只属于 §3 全局 identity 候选方案，
不是当前 schema：

固定排序索引：

```sql
CREATE INDEX article_stats_views_order_idx
ON cms.article_stats (community_id, thread, views DESC, article_id ASC);

CREATE INDEX article_stats_upvotes_order_idx
ON cms.article_stats (community_id, thread, upvotes_count DESC, article_id ASC);

CREATE INDEX article_stats_comments_order_idx
ON cms.article_stats (community_id, thread, comments_count DESC, article_id ASC);
```

候选方案的可配置 emotion 排序索引：

```sql
CREATE INDEX article_emotion_counts_order_idx
ON cms.article_emotion_counts
  (community_id, thread, type, count DESC, article_id DESC);
```

启用新的排序选项必须同时完成：

```text
领域 owner
  -> ArticleStats 固定投影字段或 emotion count 行
  -> 排序索引
  -> Gate scoped 查询组合
  -> EXPLAIN 验收
  -> API enum / UI option
```

没有投影和索引的 metric 只能展示，不能进入排序选项。

对当前论坛规模，PostgreSQL 复合索引就是预计算排序结构，解决运行时相关子查询问题，不需要先引入 Redis
sorted set。如果未来单库索引不能满足吞吐量，可以从 ArticleStats 派生搜索索引或 sorted set；它只能是可重建
的加速层，不能成为 count owner，也不能改变 ArticleStats revision 和 Gate 过滤语义。

## 6. 常见流程

公共读取在前端必须保持三层结构，不再把统计或 viewer 字段摊平回 Article content：

```ts
type TArticleViewModel = {
  content: TArticleContent
  stats: TArticleStats | null
  viewerState: TArticleViewerState
}
```

组件只通过 `article.content.*`、`article.stats.*` 和 `article.viewerState.*` 读取对应 owner。迁移时直接更新
GraphQL operation、Query key、selector 和组件调用方，然后删除旧字段；禁止 fallback、alias、双写或兼容 merge。

前端 Query option 和 key 在 `article` namespace 内使用短名：

```text
Q.article.stats(ref)
Q.article.statsBatch(refs)
articleQueryKeys.stats(path)
articleQueryKeys.statsBatch(paths)
articleStatsCache.contains(queryKey, path)
```

GraphQL type/operation 继续使用领域全名 `ArticleStats`，源文件继续使用 `articleStats.ts`，wire key 继续使用
`article-stats`。不保留 `articleStats()` 等旧 TypeScript 函数 alias。

### 6.1 公共列表读取

```text
GET /home/post?order=views
        │
        v
cms.article_stats order index
  thread=post
  ORDER BY views DESC, article_id ASC
        │
        v
JOIN Gate-scoped cms.posts
  community=home
  lifecycle=published
  visibility=public
ORDER BY stats.views DESC, stats.article_id ASC
LIMIT 20
        │
        ├─> load Post content by article_id
        └─> use the same ArticleStats rows
        │
        v
one page response
  ├─ Article content[]
  └─ ArticleStats[]
```

Gate scope 必须组合进同一条 SQL；不能先把全部可见 Article id 物化到应用层。当前 FrontDesk 按 thread dispatch 到
`cms.posts`、`cms.blogs`、`cms.changelogs` 或 `cms.docs`，再以 `(thread, physical article_id)` 连接 ArticleStats。查询应允许
planner 从 ArticleStats 排序索引驱动，再通过对应 physical thread 表过滤 community、生命周期和可见性。读取不执行
`COUNT(*)`，不查询 interaction facts，也不按 Article 循环加载 count。Revision / Draft
stable identity cutover 实施 §3 时，再把四个 physical scope 一次性改成 canonical Article scope。

### 6.2 详情页 SSR、CDN 与 hydration

```text
Browser GET /home/post/42
        │
        v
CDN
  ├─ hit  -> HTML + public hydration snapshot
  └─ miss -> request-scoped SSR QueryClient
                │
                ├─ load Article content
                ├─ load persisted ArticleStats
                ├─ render the same snapshot
                └─ dehydrate public queries only
        │
        v
Browser hydration
  ├─ restore Article content
  ├─ restore ArticleStats
  └─ fetch ViewerState privately
```

`snapshotAt` 来自源站读取的持久化 ArticleStats 行。CDN hit、hydration 和浏览器 selector 都不能伪造新时间；只有
owner transaction 的数据库写语句成功提交时才会用 `clock_timestamp()` 推进它。

### 6.3 创建 Comment

```text
CreateComment command
        │
        v
Article aggregate transaction
  ├─ insert Comment
  ├─ owner comments_count += 1
  ├─ first participation by this actor?
  │    └─ owner comments_participants_count += 1
  ├─ owner comments_revision += 1
  └─ upsert ArticleStats
       comments_count = owner count
       comments_participants_count = owner participants count
       comments_revision = owner revision
        │
        v
  commit
  ├─ mutation returns viewer confirmation + owner revision
  ├─ current browser keeps receipt until ArticleStats catches up
  └─ CDN HTML is not purged for one count increment
```

Comment update 可以只提升 `commentsRevision`，即使 `commentsCount/commentsParticipantsCount` 都不变；revision 表示
owner projection 的确认顺序，不只表示数值变化。

### 6.4 Upvote、collect 与 emotion

本节只展示目标架构中的 owner flow；实际 direct-cutover 顺序、维护窗口和 rollback 以
[`article-emotion-counts.md`](./article-emotion-counts.md) 为准。

```text
Upvote / Collect / React command
        │
        v
Interaction transaction
  ├─ write interaction fact idempotently
  ├─ update ReactionInfo
  ├─ interaction_revision += 1
  ├─ upsert ArticleStats.interaction_revision
  ├─ UPVOTE
  │    └─ also update ArticleStats.upvotes_count
  ├─ COLLECT
  │    └─ also update ArticleStats.collects_count
  └─ other emotion
       └─ Ecto upsert ArticleEmotionCount(type, count, revision)
        │
        v
  commit
  ├─ return viewer confirmation + owner revision
  ├─ update ViewerState privately
  └─ retain receipt until public ArticleStats revision catches up
```

新增 `HEART` emotion 时只需要：

```text
Emotion vocabulary + policy
        │
        v
Interaction fact
        │
        v
ArticleEmotionCount(article_id, HEART, count)
        │
        v
ArticleStats.emotionCounts[]
```

不增加 `heart_count` Article 字段，不修改 ArticleStats 表，也不新增前端 cache key。

Interaction command 在同一个 owner transaction 中使用 Ecto 更新 interaction fact、固定 ArticleStats 字段和受影响的
`ArticleEmotionCount` 行；不拼接裸 SQL。`ArticleStats.interaction_revision` 表示完整公开 interaction snapshot 的 owner
版本，emotion row 的 `interaction_revision` 表示该行最后一次改变时的 owner 版本，未改变的其他 emotion 行不必为了
追平版本而发生无意义写放大。读取仍须遵守 §4.4 的同一 statement snapshot 约束。Ecto 与数据库原语的详细边界见
[`orm.md`](./orm.md)。

### 6.5 有效阅读与 views 写入

views 的当前写协议完全由
[`article-view-counting.md`](../feature/view-tracker/article-view-counting.md) 定义：

```text
qualified public read
  -> atomic watermark claim
  -> UPSERT ArticleStats.views/viewsRevision
  -> append Analysis.MetricEvent in the same transaction
  -> return committed complete ArticleStats
```

`ArticleStats.views/viewsRevision` 是 ViewTracker 字段级拥有的 canonical current counter。当前架构不保留
ViewEvent、ViewSummary、每事件 Oban job、projection generation、replay/drop 或 tracking 后延迟 refetch。高流量
sharded counter 不属于本协议；只有真实行锁/P99 指标证明必要后，才另立完整版本并直接替换同步协议。

### 6.6 Receipt 收敛

本节 receipt 只适用于 interaction/comment mutation 的私有 viewer confirmation。view tracking 使用
`ViewCountReceipt(eventId)` 解决 transport retry，并直接返回 committed ArticleStats，不经过下述公共投影等待。

```text
mutation confirmed
        │
        ├─ receipt.interactionRevision = 18
        │
        v
stale CDN hydration
  ArticleStats.interactionRevision = 17
        │
        v
refetch ArticleStats
  ├─ revision < 18 -> keep receipt
  └─ revision >= 18 -> accept snapshot, clear receipt
```

receipt 不能因为私有 ViewerState 或另一个 query 已追上就提前清除；只有对应的公共 ArticleStats owner revision
可以证明公共 cache 已收敛。

### 6.7 Drift 检测与重建

```text
scheduled consistency audit
        │
        ├─ sample Comments owner
        ├─ sample Interactions owner
        │
        v
compare ArticleStats count + revision
        │
        ├─ equal    -> record healthy sample
        └─ mismatch -> emit telemetry + enqueue repair
                            │
                            v
                    rebuild non-view ArticleStats fields
```

全量重建按 physical Article id/keyset 分页：

```text
thread-specific physical Article page
  -> Post | Blog | Changelog | Doc Gate scope
  -> batch owner reads
  -> bulk upsert ArticleStats
  -> verify revisions
  -> next cursor
```

repair 只从 Comments/Interactions owner 覆盖各自 ArticleStats 列，不能反向用 ArticleStats 修改领域事实，也不能通过全
owner `sync/1` 覆盖其他 owner 列。同步计数切换后，`ArticleStats.views/viewsRevision` 本身就是 ViewTracker 当前总数，
不存在第二份在线 owner 可供 drift 对照或重建；views 的灾难恢复依赖数据库备份/PITR，不能为了理论可重建重新引入
ViewSummary 或 ViewEvent 双写。

### 6.8 Permanent delete

```text
§3 canonical identity 候选方案（当前未实施）

permanently delete Article
        │
        v
delete canonical Article
  └─ FK cascade
       ├─ thread content
       ├─ Comments
       ├─ ReactionInfo / ArticleEmotionCount
       ├─ ViewerState / ViewWatermark / ViewCountReceipt
       └─ ArticleStats
```

当前实际链路是：

```text
permanently delete physical Post | Blog | Changelog | Doc
  -> delete thread-owned facts/projections
  -> ViewTracker.delete_article_state(thread, article_id)
  -> ArticleStats.delete(thread, article_id)
       ├─ delete ArticleEmotionCount rows
       └─ delete ArticleStats row
```

当前没有 canonical Article FK。owner delete hooks 显式删除 ArticleStats、ArticleEmotionCount、ViewerState、dedupe state 和
短期 receipt；Analysis MetricEvent 按自身 retention/删除快照合同处理，不伪造跨多态表的外键。若未来落地 §3，才能再
评估哪些 cleanup 可以由 FK cascade 替代。

## 7. 配置边界

真正需要配置的选项集中在明确 owner，不建立通用 metric registry：

```text
ArticleStats.CachePolicy
  ├─ public HTML TTL / SWR
  ├─ snapshot max age
  └─ clock skew tolerance

Shared QueryClient defaults
  └─ Article content browser stale time

PublicCache.Policy
  ├─ timeout / retry budget
  ├─ retry delay
  └─ health and telemetry sink

Interactions.Config
  ├─ emotion vocabulary
  └─ public emotion types

Articles ordering contract
  └─ allowed precomputed sort fields

ViewTracker.Config
  ├─ human_dedupe_window_seconds
  ├─ agent_dedupe_window_seconds
  ├─ view_count_receipt_ttl_seconds
  └─ watermark_retention_seconds
```

以下内容不能成为普通运行时开关：

- revision 语义；
- ArticleStats identity；
- 是否允许无投影/无索引的 count 排序；
- public/private hydration 边界；
- owner 与 ArticleStats 的权威方向。

## 8. Stable identity 目标方案相对当前架构的取舍

| 维度                | 当前架构                                                                     | stable identity 目标架构                                                       |
| ------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Article identity    | `thread + physical article_id`，跨多个 Article 表                            | 一个全局 `articles.id`，其他领域使用 FK                                        |
| 公共读取            | `cms.article_stats` 单行投影                                                 | canonical Article + ArticleStats 单一读取投影                                  |
| views 排序          | `(thread, views)` 预计算索引                                                 | `(community_id, thread, views, article_id)` 匹配社区范围排序索引               |
| upvote/comment 排序 | ArticleStats `(thread, metric)` 预计算索引                                   | 相同的 ArticleStats 排序协议                                                   |
| 公共计数边界        | views/upvotes/comments/participants/collects/emotions 只从 ArticleStats 读取 | 同一边界，并由全局 Article identity 约束                                       |
| emotion 扩展        | JSONB `reaction_counts` + GraphQL `reactionCounts`                           | `article_emotion_counts` + `emotionCounts[]` typed 行；旧名直接删除            |
| 客户端收敛          | 三个 owner revision 组成 version vector                                      | 同一 version vector                                                            |
| receipt 清理        | 只由公共 ArticleStats revision 证明                                          | 只由公共 ArticleStats revision 证明                                            |
| 删除                | owner delete hooks 显式清理多态投影                                          | canonical Article FK cascade                                                   |
| drift repair        | Comments/Interactions 可从 owner 重建                                        | Comments/Interactions 仍可字段级重建；views 是 canonical counter，依赖 DB 恢复 |
| 新排序 metric       | 容易出现临时 join/子查询                                                     | 先投影、建索引、EXPLAIN，再开放 API                                            |
| 查询复杂度          | 固定查询数量，但 owner 增长会增加组装工作                                    | 列表和详情读取成本不随 owner 数量增长                                          |

当前架构的正确部分应保留：

- Article content、ArticleStats、ViewerState 三层分离；
- tracking 与普通 content read 分离；
- mutation receipt 不把局部值伪装成完整服务端快照；
- public hydration allowlist；
- count 变化不逐次 purge HTML；
- 各领域 owner 保留自己的写入一致性。

目标架构不是推翻这些边界，而是把已经正确的公共合同下沉为可排序、可修复、有完整 revision 的数据库读取投影。

## 9. 明确禁止

```text
Article content 再次拥有 views/upvotes/comments/commentsParticipants/collects/emotions 公共副本
ArticleStats 反向覆盖领域 owner
同时维护 ArticleStats 和 legacy Article count fallback
把 ArticleStats 或 ViewerState 摊平 merge 回 Article content
为了一个列表排序执行 runtime COUNT(*) 或相关子查询
为每种 emotion 增加一列和一个 GraphQL 字段
用 JSON metric bag 逃避 typed contract
保留 reaction_counts/reactionCounts 作为 emotionCounts 的兼容来源或 alias
只更新 count、不更新对应 owner revision
私有 ViewerState 证明公共 ArticleStats 已收敛
没有索引和 EXPLAIN 验收就开放新的 order enum
```

## 10. Direct-cutover 目标验收条件

以下第一条和涉及全局 FK 的条目属于 Revision / Draft stable identity 目标验收，不代表当前 runtime 已实现。typed emotion 与公共读取验收同时遵守
`article-emotion-counts.md` 和 `article-stats-and-public-cache.md`。

- Article、Comments、Interactions、ViewTracker、ArticleStats 都通过同一个 `articles.id` 定位；
- permanent delete 不留下 ArticleStats、ArticleEmotionCount、ViewerState、ViewWatermark 或 ViewCountReceipt orphan；
- ArticleStats 对 1、20、100 个 Article 使用一次有上限的 batch read；
- 固定字段与 emotion rows 从同一个数据库 snapshot 组装；
- 按 views/upvotes/comments 排序均使用对应复合索引，不发生全量 count 子查询；如果开放 collects、participants
  或某种 emotion 排序，也必须先增加对应预计算索引并通过 EXPLAIN；
- 新 emotion 不需要 ArticleStats 数据表 migration；
- GraphQL 只暴露 `emotionCounts: [ArticleEmotionCount!]!`，旧 `reactionCounts`、JSONB `reaction_counts` 和
  `ArticleReactionCount` 在同一切换删除；
- Interactions 使用 Ecto 在同一 owner transaction 更新固定统计与 emotion 行，领域模块不执行裸 SQL；
- 任一 owner revision 倒退时，客户端丢弃整份 mixed snapshot；
- mutation receipt 只在对应公共 revision 追上后清除；
- SSR HTML 与 hydration 使用同一 ArticleStats snapshot，ViewerState 不进入公共 payload；
- drift audit 能检测并字段级修复 Comments/Interactions 列，不宣称从第二份在线事实重建 views；
- mixed snapshot、clock skew、receipt timeout、drift repair 和 purge health 都进入生产 telemetry/health，而不是只写 console；
- Comments/Interactions 读取投影可从 canonical Article 和对应 owner 重建；views 只依赖 ArticleStats canonical counter，
  不依赖旧 Article count、ViewSummary 或 ViewEvent。
