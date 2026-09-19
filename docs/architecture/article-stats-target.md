# ArticleStats 目标架构

> 状态：本次改造的目标架构，待实施。
>
> 本文是本次 ArticleStats 改造的最终目标，不是后续可选优化。实现不保留旧字段、旧 Query key、双读或兼容层。
> 本文从长期维护、读取性能和扩展能力出发，定义本次按目标直接切换的 Article 公共计数架构。
> 当前 V1 已落地主链路及其 P0/P1 收敛补强仍以
> [`article-stats-and-public-cache.md`](./article-stats-and-public-cache.md) 为准。

## 1. 结论

目标架构只使用 `ArticleStats` 一个名称，表示从数据库读取投影、GraphQL DTO 到前端 Query cache
的同一条公共读取边界：

```text
Comments owner ──────────┐
Reactions owner ─────────┼─> ArticleStats 读取投影 ─> GraphQL ArticleStats ─> UI
ViewTracker owner ───────┘
```

`ArticleStats` 不是新的业务事实 owner。它是一份可重建、可排序、按 Article 定位的公共读取投影：

- Comments 决定 `commentsCount/commentsParticipantsCount/commentsRevision`；
- Interactions 决定 `upvotesCount/collectsCount/reactionCounts/interactionRevision`；
- ViewTracker 决定 `views/viewsRevision`；
- ArticleStats 只复制 owner 已确认的值，为公共页面提供固定查询成本和排序索引；
- `snapshotAt` 在每次响应组装完成时生成，不持久化为事实。

目标不是把不同 count 的写入语义统一，而是统一它们的公共读取、排序、缓存和收敛协议。

## 2. 为什么需要独立读取投影

当前架构已经解决了公开计数从 Article content 分离的问题，但读取时仍需要组合多个 owner：

```text
scoped Article query
  + ViewSummary join
  + Interactions counts query
  + Article.comments_count
  -> ArticleStats DTO
```

这条链路对普通列表是固定查询数量，不是 N+1；结构性问题主要出现在排序和扩展上：

- 按 views/upvotes/comments 排序时，需要从不同 owner join 后排序；
- `ViewSummary` 没有 `community_id`，难以建立社区范围的 views 排序索引；
- 新增可排序 emotion 时，不能为每种 emotion 在列表查询里临时增加相关子查询；
- owner revision 没有全部进入 ArticleStats，客户端无法证明每个公共 count 已经追上 mutation receipt；
- thread 对应不同物理 Article 表，ViewTracker 等多态投影无法建立统一 Article 外键。

目标架构通过 canonical Article identity 和 ArticleStats 读取投影解决这些问题。

## 3. Canonical Article identity

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

thread 专属内容继续放在各自模型中，但以 `article_id` 一对一关联 canonical Article：

```text
cms.articles
  ├─ cms.posts.article_id
  ├─ cms.blogs.article_id
  ├─ cms.changelogs.article_id
  └─ cms.docs.article_id
```

Comments、Interactions、ViewTracker 和 ArticleStats 都只引用 `articles.id`：

```text
                        ┌─ comments.article_id
cms.articles.id ────────┼─ article_reaction_infos.article_id
                        ├─ article_view_summaries.article_id
                        ├─ article_emotion_counts.article_id
                        └─ article_stats.article_id
```

这样可以删除领域内部的 `thread + physical article_id` 多态 identity、按 thread 选择模型的 Matcher
分支，以及 permanent delete 时手动模拟外键级联的协议。`thread` 仍是产品类型，不再承担数据库 identity。

## 4. ArticleStats 数据模型

### 4.1 固定公共计数

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

### 4.2 可扩展 reaction counts

emotion 等可配置 reaction 不增加固定列：

```text
cms.article_reaction_counts
├─ article_id             FK -> cms.articles.id
├─ community_id           用于社区范围排序
├─ thread                 用于 thread 范围排序
├─ type                   HEART / BEER / ...，不包含 UPVOTE
├─ count
├─ interaction_revision
└─ updated_at

UNIQUE (article_id, type)
```

GraphQL 使用 typed list：

```graphql
type ArticleReactionCount {
  type: EmotionType!
  count: Int!
}

type ArticleStats {
  community: String!
  thread: Thread!
  innerId: ID!

  views: Int!
  viewsRevision: Int!

  upvotesCount: Int!
  collectsCount: Int!
  interactionRevision: Int!
  reactionCounts: [ArticleReactionCount!]!

  commentsCount: Int!
  commentsParticipantsCount: Int!
  commentsRevision: Int!

  snapshotAt: Datetime!
}
```

`upvotesCount`、`collectsCount` 和 `commentsParticipantsCount` 保持显式字段，因为它们是稳定的公共计数；
其他 emotion 使用行模型，新增类型不需要 migration 或新增 GraphQL 字段。`UPVOTE` 不再写入 reaction count 行，避免同一
计数有两个读取投影。不能使用无类型的 `JSON` metric bag。

普通 emotion 行可以稀疏存储，缺失行按零处理；如果某个 emotion 要成为排序项，则发布排序能力前必须为现有
Article 补齐零值行，并让新建 Article 同步创建该行。`community_id` 和 `thread` 与 ArticleStats 相同，只是可修复
的排序维度副本。这样增加展示型 emotion 不需要数据迁移，增加可排序 emotion 则需要受控 backfill，但不需要
修改 schema。

### 4.3 revision 是 owner version vector

ArticleStats 不依赖 `snapshotAt` 单独判断新旧：

```text
ArticleStats revision vector
├─ viewsRevision
├─ interactionRevision
└─ commentsRevision
```

接收新快照时必须同时满足：

```text
incoming.snapshotAt >= current.snapshotAt
incoming.viewsRevision >= current.viewsRevision
incoming.interactionRevision >= current.interactionRevision
incoming.commentsRevision >= current.commentsRevision
```

任一 owner revision 倒退，都将整份 incoming ArticleStats 判定为 mixed snapshot 并丢弃。客户端不做逐字段拼接。
每个 revision 都是对应 owner 在单个 Article 范围内持久化的单调序列，不使用进程内计数器或 wall clock 代替。
这项 DTO、receipt 和客户端收敛规则已提升为当前 V1 的 P0 合同，不等待 canonical Article/ArticleStats 数据表重构。

### 4.4 一致快照

固定字段和 `reactionCounts` 必须由同一个数据库 statement snapshot 读取，例如在一条 SQL 中聚合 reaction rows；
也可以使用明确的 repeatable-read transaction，但不能以多个普通 read-committed 查询拼接后声称它们属于同一
`snapshotAt`。服务端完成整份 DTO 后才生成 `snapshotAt`。

这是读取一致性约束；§6.3/§6.4 中 owner transaction 内同步更新 ArticleStats 是写入原子性约束。两者相互独立：
写入不能依赖读取端修补半完成状态，读取也不能因为各 owner 分别原子提交就跨多个 statement 拼装伪快照。

## 5. 排序是一等能力

每个允许成为列表 order 的 count，都必须先拥有预计算值和匹配索引。禁止为了支持一个排序选项，在运行时引入
`COUNT(*)`、相关子查询或加载 reaction facts。

固定排序索引：

```sql
CREATE INDEX article_stats_views_order_idx
ON cms.article_stats (community_id, thread, views DESC, article_id DESC);

CREATE INDEX article_stats_upvotes_order_idx
ON cms.article_stats (community_id, thread, upvotes_count DESC, article_id DESC);

CREATE INDEX article_stats_comments_order_idx
ON cms.article_stats (community_id, thread, comments_count DESC, article_id DESC);
```

可配置 reaction 排序索引：

```sql
CREATE INDEX article_reaction_counts_order_idx
ON cms.article_reaction_counts
  (community_id, thread, type, count DESC, article_id DESC);
```

启用新的排序选项必须同时完成：

```text
领域 owner
  -> ArticleStats 投影字段或 reaction count 行
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
  stats: TArticleStats
  viewerState: TArticleViewerState
}
```

组件只通过 `article.content.*`、`article.stats.*` 和 `article.viewerState.*` 读取对应 owner。迁移时直接更新
GraphQL operation、Query key、selector 和组件调用方，然后删除旧字段；禁止 fallback、alias、双写或兼容 merge。

前端 Query option 和 key 在 `article` namespace 内使用短名：

```text
Q.article.stats(ref)
Q.article.statsBatch(refs)
articleKeys.stats(ref)
articleKeys.statsBatch(refs)
articleKeys.statsPrefix(scope)
```

GraphQL type/operation 继续使用领域全名 `ArticleStats`，源文件继续使用 `articleStats.ts`，wire key 继续使用
`article-stats`。不保留 `articleStats()` 等旧 TypeScript 函数 alias。

### 6.1 公共列表读取

```text
GET /home/post?order=views
        │
        v
cms.article_stats order index
  community=home
  thread=POST
  ORDER BY views DESC, article_id DESC
        │
        v
JOIN Gate-scoped cms.articles
  lifecycle=published
  visibility=public
ORDER BY stats.views DESC, stats.article_id DESC
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

Gate scope 必须组合进同一条 SQL；不能先把全部可见 Article id 物化到应用层。对公共社区列表，查询应允许
planner 从 ArticleStats 排序索引驱动，再通过 canonical Article 过滤生命周期和可见性。读取不执行
`COUNT(*)`，不查询 reaction facts，也不按 Article 循环加载 count。

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
                ├─ load ArticleStats
                ├─ render the same snapshot
                └─ dehydrate public queries only
        │
        v
Browser hydration
  ├─ restore Article content
  ├─ restore ArticleStats
  └─ fetch ViewerState privately
```

`snapshotAt` 只在源站组装 ArticleStats response 时生成。CDN hit、hydration 和浏览器 selector 都不能伪造新时间。

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
  ├─ mutation returns confirmed count + revision
  ├─ current browser keeps receipt until ArticleStats catches up
  └─ CDN HTML is not purged for one count increment
```

Comment update 可以只提升 `commentsRevision`，即使 `commentsCount/commentsParticipantsCount` 都不变；revision 表示
owner projection 的确认顺序，不只表示数值变化。

### 6.4 Upvote、collect 与 emotion

```text
Upvote / Collect / React command
        │
        v
Interaction transaction
  ├─ write reaction fact idempotently
  ├─ update ReactionInfo
  ├─ interaction_revision += 1
  ├─ upsert ArticleStats.interaction_revision
  ├─ UPVOTE
  │    └─ also update ArticleStats.upvotes_count
  ├─ COLLECT
  │    └─ also update ArticleStats.collects_count
  └─ other emotion
       └─ upsert ArticleReactionCount(type, count, revision)
        │
        v
commit
  ├─ return confirmed public projection
  ├─ update ViewerState privately
  └─ retain receipt until public ArticleStats revision catches up
```

新增 `HEART` emotion 时只需要：

```text
Emotion vocabulary + policy
        │
        v
Reaction fact
        │
        v
ArticleReactionCount(article_id, HEART, count)
        │
        v
ArticleStats.reactionCounts[]
```

不增加 `heart_count` Article 字段，不修改 ArticleStats 表，也不新增前端 cache key。

### 6.5 有效阅读与 views 投影

```text
Article visible >= 1 second
        │
        v
trackArticleView(eventId)
        │
        v
ViewTracker admission
  ├─ classify actor
  ├─ check read_purpose
  ├─ sliding-window dedupe
  └─ persist accepted ViewEvent / outbox
        │
        v
partitioned projection by article_id
  ├─ batch pending increments
  ├─ update ViewSummary
  └─ update ArticleStats.views/viewsRevision
        │
        v
mark events projected
```

投影任务按 `article_id` 合并或分区，不能为每个 view 永久维持一个互相争抢 Article lock 的独立任务。

如果产品规模和审计要求不需要 ViewEvent replay，可以使用更简单的路径：

```text
dedupe accepted
  -> atomic increment ViewSummary + ArticleStats
  -> append analytics outbox
```

两种实现只能选择一种 canonical write protocol，不能双写后依赖定时任务猜测哪边正确。

### 6.6 Receipt 收敛

```text
mutation confirmed
        │
        ├─ receipt.interactionRevision = 18
        └─ receipt.upvotesCount = 7
        │
        v
stale CDN hydration
  ArticleStats.interactionRevision = 17
        │
        v
UI overlays receipt
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
        └─ sample ViewTracker owner
        │
        v
compare ArticleStats count + revision
        │
        ├─ equal    -> record healthy sample
        └─ mismatch -> emit telemetry + enqueue repair
                            │
                            v
                    rebuild one ArticleStats row
```

全量重建按 Article id/keyset 分页：

```text
canonical Articles page
  -> batch owner reads
  -> bulk upsert ArticleStats
  -> verify revisions
  -> next cursor
```

repair 只从 owner 覆盖 ArticleStats，不能反向用 ArticleStats 修改领域事实。

### 6.8 Permanent delete

```text
permanently delete Article
        │
        v
terminalize retained append-only events
        │
        v
delete canonical Article
  └─ FK cascade
       ├─ thread content
       ├─ Comments
       ├─ ReactionInfo / ReactionCounts
       ├─ ViewSummary / ViewerState / DedupeState
       └─ ArticleStats
```

需要保留的 ViewEvent、Audit、MetricEvent 使用删除快照和 terminal state，不伪造跨多态表的外键。

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
  └─ public reaction types

Articles ordering contract
  └─ allowed precomputed sort fields

ViewTracker.Config
  ├─ dedupe window
  ├─ projection batch size
  ├─ retention
  └─ admission rate limits
```

以下内容不能成为普通运行时开关：

- revision 语义；
- ArticleStats identity；
- 是否允许无投影/无索引的 count 排序；
- public/private hydration 边界；
- owner 与 ArticleStats 的权威方向。

## 8. 相比当前架构的收益

| 维度                | 当前架构                                          | 目标架构                                                                      |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Article identity    | `thread + physical article_id`，跨多个 Article 表 | 一个全局 `articles.id`，其他领域使用 FK                                       |
| 公共读取            | 固定数量 owner reads 后组装 DTO                   | 单一 ArticleStats 读取投影                                                    |
| views 排序          | scoped Article LEFT JOIN ViewSummary 后排序       | `(community_id, thread, views, article_id)` 匹配社区范围排序索引              |
| upvote/comment 排序 | 分别依赖 owner 表或 Article 字段                  | 相同的 ArticleStats 排序协议                                                  |
| 公共计数边界        | 部分 count 仍留在 Article content                 | views/upvotes/comments/participants/collects/reactions 只从 ArticleStats 读取 |
| emotion 扩展        | owner 已支持行投影，但公共 DTO 尚未统一           | `reactionCounts[]` 行模型，无 schema migration                                |
| 客户端收敛          | `snapshotAt + viewsRevision`，其他 owner 无版本   | 三个 owner revision 组成 version vector                                       |
| receipt 清理        | 可能由私有查询提前证明“已收敛”                    | 只由公共 ArticleStats revision 证明                                           |
| 删除                | 多态表缺少统一 FK，需要手动清理                   | 大部分读取投影由 canonical Article FK 级联                                    |
| drift repair        | ViewTracker 有采样，其他 count 不统一             | 每个 owner 都可审计并重建 ArticleStats                                        |
| 新排序 metric       | 容易出现临时 join/子查询                          | 先投影、建索引、EXPLAIN，再开放 API                                           |
| 查询复杂度          | 固定查询数量，但 owner 增长会增加组装工作         | 列表和详情读取成本不随 owner 数量增长                                         |

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
Article content 再次拥有 views/upvotes/comments/commentsParticipants/collects/reactions 公共副本
ArticleStats 反向覆盖领域 owner
同时维护 ArticleStats 和 legacy Article count fallback
把 ArticleStats 或 ViewerState 摊平 merge 回 Article content
为了一个列表排序执行 runtime COUNT(*) 或相关子查询
为每种 emotion 增加一列和一个 GraphQL 字段
用 JSON metric bag 逃避 typed contract
只更新 count、不更新对应 owner revision
私有 ViewerState 证明公共 ArticleStats 已收敛
没有索引和 EXPLAIN 验收就开放新的 order enum
```

## 10. 验收条件

- Article、Comments、Interactions、ViewTracker、ArticleStats 都通过同一个 `articles.id` 定位；
- permanent delete 不留下 ArticleStats、ViewSummary、ReactionCount 或 ViewerState orphan；
- ArticleStats 对 1、20、100 个 Article 使用一次有上限的 batch read；
- 固定字段与 reaction rows 从同一个数据库 snapshot 组装；
- 按 views/upvotes/comments 排序均使用对应复合索引，不发生全量 count 子查询；如果开放 collects、participants
  或某种 reaction 排序，也必须先增加对应预计算索引并通过 EXPLAIN；
- 新 emotion 不需要 ArticleStats 数据表 migration；
- 任一 owner revision 倒退时，客户端丢弃整份 mixed snapshot；
- mutation receipt 只在对应公共 revision 追上后清除；
- SSR HTML 与 hydration 使用同一 ArticleStats snapshot，ViewerState 不进入公共 payload；
- drift audit 能检测并重建任意一行 ArticleStats；
- mixed snapshot、clock skew、receipt timeout、drift repair 和 purge health 都进入生产 telemetry/health，而不是只写 console；
- 读取投影可从 canonical Article 和三个 owner 完整重建，不依赖旧 Article count 字段。
