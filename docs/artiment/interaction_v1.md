# Artiment Interaction V1：互动存储模型

> 状态：已实现并验证。reaction/emotion bitmap projection、durable view event、
> ShadowSync、每日 projection audit、retention/telemetry 与 PostgreSQL 14 本机迁移均已落地；
> CI 使用 PostgreSQL 15 + `pg_roaringbitmap` 1.2.0 镜像。
>
> 目标：保持对外 CMS / GraphQL 调用契约不变，将文章和评论的互动事实、集合判断、统计和展示快照从主记录的 JSONB 中拆出。

## 1. 背景

Artiment 的互动包括 view、article upvote、article collect、comment upvote、
article/comment emotion，以及 report 等需要判断“当前用户是否参与”的关系。

这些关系有相似的读取需求：

```text
当前用户是否参与过？
这个目标有多少参与者？
最近参与的用户是谁？
参与关系是否可以安全地新增、取消和重建？
```

旧实现把一部分关系事实和展示数据嵌进 article/comment 的 `meta` 或 `emotions`
JSONB，同时又保留独立的 upvote/emotion fact table。数据职责因此重叠，写入路径也会
同时修改主记录和事实记录。

本方案保持上层 CMS facade、GraphQL 字段和 mutation 不变，也不把数据库内部 ID 暴露给
前端。新 schema 直接采用 reaction info、emotion info 和 bitmap projection，不创建互动
JSONB 字段，也不引入双写、双读或运行时兼容分支。

这是新项目的初始模型设计：数据库从空状态开始，不存在历史互动、浏览或 moderation 数据
需要迁移。不做 backfill，不保留双写、双读或运行时兼容分支。

> v1 定义互动事实、projection schema 与 bitmap 语义；projection 的统一读写边界、批量 response
> 组装与 list 路径由 [Interaction V2](./interaction_v2.md) 的 `CMS.Interactions.State` 负责。
> v2 的实现入口统一为 `CMS.Interactions.State`、`CMS.Interactions.ViewEvents`、
> `CMS.Interactions.Config` 与 `CMS.Interactions.Schema.*`；旧 `CMS.Reactions.Store` 和
> `CMS.Comments.ViewerState` 已移除，Trash 专属的 `hydrate_entries` 不属于互动读路径。

> §2-3 只描述旧 Groupher 代码库的模型和问题，作为设计背景与教训；新项目不迁移这些数据。
> §5 的接口契约与旧实现对齐，但底层 schema、存储和计算从本方案开始。

## 2. 旧代码库数据模型（背景）

### 2.1 Article 表

旧代码库中的以下对象是不同的物理表：

```text
cms.posts
cms.blogs
cms.changelogs
cms.docs
```

它们共享 Article workflow、`ArticleMeta`、`ArticleEmotion` 和部分通用字段，但数据库
主键空间和外键目标仍然属于各自的表。

因此通用 reaction 表不能只使用一个裸 `article_id`。如果需要跨 article 类型查询，
必须带 thread，或使用明确的 `post_id/blog_id/changelog_id/doc_id` 外键。

### 2.2 Comment 表

comment 使用统一的 `cms.comments` 表，通过 `thread`、`post_id`、`blog_id`、
`changelog_id`、`doc_id` 指向所属 article。数据库约束保证只存在一个有效 article ref，
且 thread 与 ref 匹配。

### 2.3 旧 JSONB / embed 字段

旧 Article `meta` 包含：

```text
upvoted_user_ids
collected_user_ids
viewed_user_ids
reported_user_ids
latest_upvoted_users
latest_collected_users
```

旧 Comment `meta` 包含：

```text
upvoted_user_ids
reported_user_ids
```

ArticleEmotion / CommentEmotion 为每种 emotion 生成：

```text
<emotion>_count
<emotion>_user_logins
latest_<emotion>_users
viewer_has_<emotion>ed
```

命名规则保持对外 API/schema 约定：

```text
emotion = beer

latest_beer_users   # latest 用户快照，不加 ed
viewer_has_beered   # viewer 状态字段，保留 ed
```

例如 `downvote` 对应约定的 `latest_downvote_users` 和
`viewer_has_downvoteed`。`latest_<emotion>_users` 与 `viewer_has_<emotion>ed` 是两类
不同字段，不能混用或改名。

其中 `viewer_has_*` 是请求级状态，旧实现通过登录名数组或 embed 计算；它不是应该持久化
的事实。

### 2.4 已存在的事实表

旧代码库已经有独立事实表：

```text
cms.article_upvotes
cms.article_collects
cms.comments_upvotes
cms.articles_users_emotions
cms.comments_users_emotions
cms.abuse_reports.report_cases[].user.user_id
```

这些来源保存 user、目标、emotion、时间、唯一约束以及 emotion 的 `received_user_id`
等事实。`abuse_reports.report_cases` 是嵌入式 moderation 事实，举报原因、状态、处理人
和审计信息仍由 `AbuseReport` 管理。它们作为权威事实源，而不是被 bitmap 直接替代。

## 3. 旧实现问题（背景）

### 3.1 无限增长数组

`viewed_user_ids` 和 emotion 的 `*_user_logins` 会随着参与用户增加而增长。每次新增或
删除一项，都可能重写包含完整数组的 JSONB。

这同时带来：

- 主记录越来越大；
- Ecto decode/encode 成本增加；
- 读请求为了判断一个 user 是否存在，需要遍历数组；
- 旧 login 会因为用户资料变化而变成过期身份；
- 不同写操作会争抢同一条 article/comment 行。

简单地把 login 数组换成 user ID 数组，只能改善身份稳定性，不能解决数组增长和父行锁。

### 3.2 事实和缓存职责重叠

emotion 已有 fact table，但同时把 count、参与者 login 列表和最近用户复制进
`emotions` JSONB。upvote 也同时维护 fact row、count 和 user ID 数组。

同一个 mutation 需要维护多份状态，任何一份写入失败或并发覆盖，都可能形成不一致。

### 3.3 count 和 viewer state 不应依赖展示 JSONB

count 是集合基数或业务计数；viewer state 是当前请求的投影；latest users 是展示快照。
它们不应该和内容主记录的持久化 meta 绑定。

特别是 `viewer_has_*` 不应写入 JSONB。它应该在读取时根据当前 viewer 的 user ID 生成，
或者作为 GraphQL resolver 返回的 virtual/projection 字段存在。

### 3.4 旧 article upvote/collect 的锁范围过大

旧 article upvote/collect 会锁 article，并更新 article count、meta user IDs，之后
再写 fact row。高并发下，互动写入会和正文或其他互动更新争抢 article 主记录。

comment upvote/emotion 也会更新 comment 的 meta/emotions JSONB，存在同样的父行耦合。

## 4. 目标模型

目标是把职责拆成四层：

```text
fact table
  -> 权威关系、时间、唯一约束、审计

reaction info
  -> 固定互动的 user ID bitmap

emotion info
  -> 动态 emotion 的 user ID bitmap

ShadowSync
  -> latest users 的昵称、头像等展示资料刷新
```

### 4.1 按物理目标表拆 reaction info

因为 article 本身是四张表，reaction info 也按真实 FK 拆开：

```text
post_reaction_infos
blog_reaction_infos
changelog_reaction_infos
doc_reaction_infos
comment_reaction_infos
```

每个目标最多一条 reaction info：

```text
post_reaction_infos.post_id           UNIQUE FK -> posts.id
blog_reaction_infos.blog_id           UNIQUE FK -> blogs.id
changelog_reaction_infos.changelog_id UNIQUE FK -> changelogs.id
doc_reaction_infos.doc_id             UNIQUE FK -> docs.id
comment_reaction_infos.comment_id     UNIQUE FK -> comments.id
```

reaction info 的固定字段可以是：

```text
viewed_user_ids    roaringbitmap64
upvoted_user_ids   roaringbitmap64
collected_user_ids roaringbitmap64   # article only
reported_user_ids  roaringbitmap64

latest_upvoted_users   jsonb[]  # 默认最多 5 个用户资料 snapshot
latest_collected_users jsonb[]  # 默认最多 5 个用户资料 snapshot
```

以上字段按能力应用到全部 reaction info 表：

```text
post_reaction_infos
blog_reaction_infos
changelog_reaction_infos
doc_reaction_infos
  -> viewed / upvoted / collected / reported
  -> latest_upvoted_users、latest_collected_users

comment_reaction_infos
  -> viewed / upvoted / reported
  -> latest_upvoted_users
```

`collected_*` 只属于支持收藏的 article thread，不属于 comment；view 不维护
`latest_viewed_users`，report 不维护 `latest_reported_users`。

`latest_*_users` 由同步写路径在同一 mutation 事务内维护，不由 ShadowSync 或异步 worker
从 fact table 重建：

```text
新增互动：prepend 当前 user profile snapshot -> 按 user_id 去重 -> 按
`CMS.Interactions.Config.latest_users_limit/0` 截断（默认 5）
撤销互动：从对应 latest 列表移除当前 user_id
```

这会产生一次最多 5 个元素的 JSONB 重写，但保证 mutation 成功后 latest users 立即可见。
完整 user 集合、count 和 viewer membership 仍由 bitmap 负责。

reaction info 表由目标 FK 指向 article/comment，比在 article/comment 上增加
`reaction_info_id` 更容易处理删除级联、创建顺序和孤儿记录。

### 4.2 emotion 单独建表

emotion 不应该成为 reaction info 的固定字段：emotion whitelist 和社区配置可能变化，
新增 emotion 不应该要求数据库迁移。

因此使用每个目标、每种实际出现的 emotion 一行：

```text
post_emotion_infos
- post_id
- emotion
- user_ids roaringbitmap64
- latest_users jsonb[]  # 当前 emotion 的最多 5 个用户资料 snapshot
- unique(post_id, emotion)

blog_emotion_infos
- blog_id
- emotion
- user_ids roaringbitmap64
- latest_users jsonb[]  # 当前 emotion 的最多 5 个用户资料 snapshot
- unique(blog_id, emotion)

changelog_emotion_infos
- changelog_id
- emotion
- user_ids roaringbitmap64
- latest_users jsonb[]  # 当前 emotion 的最多 5 个用户资料 snapshot
- unique(changelog_id, emotion)

doc_emotion_infos
- doc_id
- emotion
- user_ids roaringbitmap64
- latest_users jsonb[]  # 当前 emotion 的最多 5 个用户资料 snapshot
- unique(doc_id, emotion)

comment_emotion_infos
- comment_id
- emotion
- user_ids roaringbitmap64
- latest_users jsonb[]  # 当前 emotion 的最多 5 个用户资料 snapshot
- unique(comment_id, emotion)
```

所有五类 emotion info 都遵循同一结构：每个实际出现的目标-emotion 组合一行，
`user_ids` 保存该 emotion 的完整用户集合，`latest_users` 保存最多 5 个展示用户资料。
每行已经由 `emotion` 区分，因此不创建不可能随运行时 emotion 动态变化的列名。
没有用户参与过的目标-emotion 组合不创建记录，因此不会形成“所有目标 × 所有 emotion”
的空矩阵。

### 4.3 bitmap 的身份边界

bitmap 只保存内部数字 `user_id`，不保存 login：

```text
users roaringbitmap64(user_id)
```

login、nickname、avatar 只出现在 `ShadowSync` 的展示资料刷新和 GraphQL 安全投影中。
GraphQL 不应把 reaction info 或 bitmap 原样暴露给前端。

### 4.4 count 和 viewer 查询

`pg_roaringbitmap` 提供数据库函数和操作符，具体能力以生产环境实际安装的扩展版本为准：

[`pg_roaringbitmap` 文档](https://pgxn.org/dist/pg_roaringbitmap/)

```sql
rb64_cardinality(bitmap)   -- 集合元素数量
bitmap @> user_id          -- 是否包含某个用户
```

v1 的 bitmap 基线对应关系（v2 启用后，count 读取以
[Interaction V2](./interaction_v2.md) 的物化 count 列为准）：

```text
upvoteCount       -> rb64_cardinality(upvoted_user_ids)
emotionCount      -> rb64_cardinality(emotion.user_ids)
viewerHasUpvoted  -> upvoted_user_ids @> viewer_id
viewerHasEmotion  -> emotion.user_ids @> viewer_id
```

这些不是 Ecto 内建能力，Ecto 层应通过领域 helper 或 `fragment` 封装，避免业务代码
到处散落 SQL。

view 要保留两个语义：

```text
views                         = 总浏览次数
viewed_user_ids               = 已登录用户是否看过
```

bitmap 不能替代总 views counter，也不能记录匿名用户。`rb64_cardinality(viewed_user_ids)` 可以
用于内部诊断，但不是本次对外业务统计指标。

所有 reaction info 都必须 lazy create：第一次实际互动时创建对应行，不为所有目标预建空行。
并发首次互动使用唯一 FK 和幂等的 get-or-insert，避免产生重复 info 行。

### 4.5 同步与异步写入边界

不是所有 bitmap 更新都异步：

| 互动    | 写入方式                                       | 语义                                                   |
| ------- | ---------------------------------------------- | ------------------------------------------------------ |
| upvote  | fact row + bitmap + latest snapshot 同步事务   | 操作完成后立即反映 viewer state、count 和 latest users |
| collect | fact row + bitmap + latest snapshot 同步事务   | 操作完成后立即反映收藏状态和 latest users              |
| emotion | fact row + bitmap + latest snapshot 同步事务   | 操作完成后立即反映 emotion 状态和 latest users         |
| report  | `abuse_reports` + `reported_user_ids` 同步事务 | 立即阻止重复举报                                       |
| view    | event + Oban 异步聚合                          | 允许短暂最终一致，降低最高频写入的行锁竞争             |

同步互动必须在同一数据库事务内完成 fact 写入和 bitmap projection 更新。Oban 不参与
upvote、collect、emotion、report 的正常请求链路。

view 继续使用目标表的 `views` 字段作为总浏览次数，不新增
`reaction_info.views_count`。view event 必须写入 `cms.view_events`，并由
`event_id UNIQUE` 提供业务幂等；Oban 的 unique 配置只用于减少重复入队，不是最终幂等保障：

```text
cms.view_events
  event_id       UNIQUE / PRIMARY KEY
  target_type
  target_id
  user_id        nullable
  processed_at
  inserted_at
```

`target_type` 在 Elixir 层使用 `Ecto.Enum`，复用
`CMS.Artiment.Threads.article_enums/0`；数据库仍保存字符串值，不另建 PostgreSQL 原生 enum。

```text
请求线程
  -> 记录/投递 view event
  -> GroupherServer.Jobs facade 入队

ViewProjection worker
  -> insert event on conflict do nothing
  -> 聚合同一目标的一批未处理 event
  -> 同一事务批量更新目标 `views` 字段
  -> 同一事务批量合并 viewed_user_ids bitmap
  -> 标记 event processed
```

由 `GroupherServer.Jobs` 统一封装入队，由专用 view projection worker 承担聚合和重试；
`cms.view_events.event_id` 承担严格幂等，业务 context 不应直接调用 `Oban.insert/2`。
如果 worker 事务失败，event 和 counter/bitmap 更新一起回滚，Oban 可以安全重试。`viewerHasViewed` 在 view
异步窗口内允许短暂最终一致。匿名 event 只更新 `views`，没有 `user_id` 时不更新 bitmap。

## 5. 上层契约不变

本方案的上层接口保持不变：

- `CMS.Articles.upvote/2`、`undo_upvote/2`；
- `CMS.Articles.collect/2`、`undo_collect/2`；
- `CMS.Articles.emotion/3`、`undo_emotion/3`；
- `CMS.Comments.upvote_comment/2`、`undo_upvote_comment/2`；
- `CMS.Comments.emotion_to_comment/3`、`undo_emotion_to_comment/3`；
- article/comment read、list 和 GraphQL resolver。

GraphQL 返回结构继续保留：

```text
upvotesCount
collectsCount
views
viewerHasUpvoted
viewerHasViewed
viewerHasCollected
viewerHas<Emotion>
<emotion>.count

article read 新增可选的 `view_event_id` 参数（旧调用不受影响）。新客户端必须为一次逻辑浏览
生成 UUID，并在重试时复用它；未提供该参数的旧客户端由服务端按每次 read 生成 event id，
因此无法把网络重试识别为同一次浏览。
<emotion>.latestUsers
```

bitmap、reaction info 的表名和内部 user ID 不属于公开契约。

## 6. ShadowSync 边界

新项目统一使用 `CMS.ShadowSync`，不引入 `CMS.Snapshot` 这个名称。

ShadowSync 只负责展示字段：

- 根据内部 user ID 批量读取最新 login/nickname/avatar；
- 刷新 reaction/emotion info 已维护的 latest snapshot 内的 profile 字段；
- 不决定 latest 列表成员，不改变成员顺序和数量；
- latest 列表成员、顺序和最多 5 条边界由同步写路径维护；
- 支持 stale-first 和 blocking 两种读取策略；
- 不判断当前 viewer 是否参与；
- 不维护 count；
- 不把数据库 ID 输出给前端。

最终的 `latest users` 从 reaction/emotion info 的 bounded snapshot 生成响应 projection，
不再持久化到 article/comment 的 `meta` JSONB。用户修改资料时，不需要扫描并重写所有
reaction info 中的 bounded snapshot；下一次读取通过 ShadowSync 刷新 snapshot 内的展示资料即可。

## 7. 实施步骤

### Phase 0：确认扩展和边界

1. 项目 PostgreSQL 基线固定为 14+；生产、CI、开发数据库都必须预装固定版本的
   `pg_roaringbitmap` 二进制，并支持 `CREATE EXTENSION roaringbitmap`。当前镜像基线为
   PostgreSQL 15 + `pg_roaringbitmap` 1.2.0，使用通用 `make` 编译，不使用 CPU 特定的
   `Makefile_native`。
2. user ID 是 PostgreSQL bigint，统一使用 `roaringbitmap64`。
3. 部署 gate 必须验证 `roaringbitmap64`、`rb64_cardinality` 和 contains 操作符可用；不提供运行时
   数组 fallback。
4. 明确 `views` 是总浏览次数，`viewed_user_ids` 只表示已登录用户的 membership。
5. `reported_user_ids` 纳入 reaction info；它从 `abuse_reports.report_cases[].user.user_id`
   构建，举报原因、状态、审核记录和审计仍由 moderation fact/model 负责。
6. `view_events.event_id` 由客户端生成 UUID，同一次逻辑 view 的重试必须复用同一个值；服务端
   校验 event 与 target/user 绑定关系。

### Phase 1：创建新表和类型封装

1. 在初始化 schema 时启用 pg roaring extension。
2. 创建五类固定 reaction info 表。
3. 创建五类 emotion info 表。
4. 创建 `cms.view_events`，以 `event_id` 为唯一键，并增加目标索引和处理状态字段。
   `event_id` 是客户端可复用的幂等键，不由每次请求重新生成。
5. 增加唯一 FK、删除级联和必要索引。
6. 为 `roaringbitmap64` 增加 Ecto 类型、changeset 和领域 helper。
7. 封装 `contains`、`cardinality`、add/remove、空 bitmap 初始化等操作；v2 启用前读取 cardinality
   时统一将 `NULL` 处理为 0，v2 启用后 cardinality 仅用于审计。
8. 所有 info 行使用 lazy create，不预建全量空行。
9. 为 `cms.view_events` 增加 retention job：只删除已处理且
   `processed_at < now() - retention_window` 的记录。`retention_window` 必须覆盖 Oban
   最大重试窗口、客户端最大重试周期和运维 replay 余量；未处理或失败中的 event 不得清理。
   retention window 由 `CMS.Interactions.Config.view_event_retention_days/0` 配置，默认 30 天；
   每日执行一次。latest users 的上限同样由 `CMS.Interactions.Config.latest_users_limit/0`
   配置，默认 5。

view 不在请求线程同步更新 reaction info；由 view projection worker 批量合并。只有未来
批量 worker 仍成为瓶颈时，才讨论 view 专用 shard 表。

### Phase 2：新项目初始化与启用新模型

新项目直接从空数据库启动，按以下顺序创建并启用新模型：

```text
1. 应用新 schema、扩展和新模型代码
2. 确认 reaction info、emotion info 和 view_events 表已建好，初始为空
3. 启动新读写路径，从空 bitmap、空 latest snapshot 和零计数开始
```

新 mutation 从空状态开始，直接写入 fact table、bitmap projection 和对应 latest snapshot。
article/comment 主记录不再因 viewer membership 或 latest users 被更新。

### Phase 3：启用读路径

读路径保持既定返回 shape，但数据来源改为：

```text
count          -> v2 projection materialized count 或 `views` counter
viewer state   -> bitmap contains
latest users   -> ShadowSync
full users     -> fact table 分页
```

列表页必须批量读取 viewer state，不能在每个 article/comment 上单独发一条查询。

### Phase 4：定期 projection 校验

增加 Oban 定期校验任务：

1. 对 fact table 和 bitmap 做 cardinality 对比。
2. 只有发现数量不一致时，才执行精确集合差异检查。
3. 以 fact table 为准重建对应 bitmap，并记录 repair 次数、失败和耗时。
4. `reported_user_ids` 以 `abuse_reports.report_cases[].user.user_id` 为来源；
   `report_cases_count` 仍由 moderation 模型负责，不自动用 bitmap cardinality 替代。
5. 定期删除已处理且超过 retention window 的 `cms.view_events`；未处理和失败 event 保留。
6. 监控 `pending_view_events_count`、`oldest_pending_view_event_age`、
   `failed_view_events_count` 和 `view_worker_lag`；未处理 event 持续堆积、最老 event
   超过阈值或失败数持续增长时告警。
7. 长时间失败的 event 可以标记 dead-letter 并保留 `failure_reason`、`retry_count`，
   不自动删除，避免把处理故障伪装成成功消费。
8. 校验任务不参与正常请求链路，不引入旧 JSONB 读取。

当前实现已提供每日 `CMS.Interactions.Audit`：它以 upvote、collect、emotion 和
`abuse_reports.report_cases` 为事实源，先统计 drift，再重建 bitmap，并发出
`[:groupher, :cms, :interactions, :audit]` telemetry。view retention job 同时发出
`[:groupher, :cms, :reactions, :view_metrics]`，包含 pending、最老 pending age 和 failed count；
具体告警阈值由部署侧 telemetry handler 配置。

## 8. 测试方案

测试不应继续以“article/comment 的 JSONB 是否被改写”为核心断言，而应按职责拆分。

### 8.1 Schema / extension 测试

新增覆盖：

- extension 可用，bitmap 类型可写入；
- `rb64_cardinality` 返回正确数量；
- `bitmap @> user_id` 对存在、不存在用户分别正确；
- `cms.view_events.event_id` 唯一约束生效，重复 event 可安全 insert-or-ignore；
- retention job 只删除超过窗口的已处理 event，不删除未处理或失败 event；
- 相同 `event_id` 绑定不同 target 或 user 时拒绝写入；
- 客户端重试复用同一 `event_id` 时只产生一次 view 计数；
- add/remove 幂等；
- 空 bitmap 的默认行为；
- 每个 reaction info 只能绑定一个目标；
- 删除 post/blog/changelog/doc/comment 会级联清理 info；
- emotion `(target, emotion)` 唯一；
- v2 启用后 schema 在 projection 中创建物化 count 列；article/comment 主表不保留 interaction count，
  count 不从 bitmap cardinality 的正常读路径计算；
- 不支持的 emotion 仍由 Gate/配置拒绝。

### 8.2 Fact table 测试

从旧代码库移植并重写相关测试：

- 同一用户重复 upvote/emotion 仍然幂等或返回既定错误语义；
- undo 不存在关系不会产生负 count；
- article emotion 只写对应 thread 的 FK；
- comment emotion 保留 `received_user_id`；
- fact row 的时间和唯一约束不受 bitmap projection 影响。

可参考旧代码库测试目录：

```text
backend/main/test/groupher_server/cms/comments/emotion/*_test.exs
backend/main/test/groupher_server/cms/comments/write/*_comment_test.exs
backend/main/test/groupher_server/cms/polymorphic_article_writes_test.exs
backend/main/test/groupher_server/cms/polymorphic_article_constraints_test.exs
```

### 8.3 Projection 测试

新增 reaction info / emotion info 测试：

- fact row 创建后 bitmap 包含 user ID；
- undo 后 bitmap 移除 user ID；
- bitmap cardinality 与 fact row 数一致；
- `abuse_reports.report_cases` 构建的 `reported_user_ids` 与 reporter user ID 一致；
- projection 校验发现 cardinality 漂移时可从 fact table 修复；
- 重复事件重放不会重复增加 bitmap 成员；
- 同一目标不同 emotion 互不覆盖；
- 不同 thread 的同值数据库 ID 不会串数据。

### 8.4 Viewer state 测试

断言针对对外行为，不检查 JSONB 数组内容：

```text
viewerHasUpvoted == true / false
viewerHasViewed == true / false
viewerHas<Emotion> == true / false
```

同时增加批量场景：

- 一页多个 article/comment 只使用批量 membership 查询；
- 空 viewer 返回全部 false；
- viewer 只命中部分目标时，其余目标保持 false；
- reply 和 root comment 的 viewer emotion state 不串位。
- view 异步窗口内允许 `viewerHasViewed` 短暂延迟，worker 完成后状态正确。

### 8.5 ShadowSync 测试

为 `CMS.ShadowSync` 增加专门测试：

- user ID 能刷新最新 nickname/avatar；
- stale-first 命中 cache 时 patch 展示字段；
- miss 保留原 snapshot 并安排批量刷新；
- blocking 返回最新 summary；
- 保持 latest users 的成员、顺序和长度；
- profile 更新不会修改 reaction membership；
- GraphQL projection 不返回 `id/user_id`；
- article、comment 和 emotion latest users 都能走统一批量刷新。

### 8.6 API 回归测试

对 article/comment 的 GraphQL 查询和 mutation 做黑盒契约测试：

- 字段名和返回类型不变；
- 初始空状态下 count 为 0；
- 初始空状态下 viewer state 全为 false；
- 初始空状态下 latest users 为空；
- 使用新建的 upvote/collect/emotion/view 数据验证 count 正确递增和撤销；
- 使用新 viewer 验证 viewer state 从 false 到 true，再在 undo 后恢复 false；
- 使用新互动验证 latest users 的成员、顺序、最多 5 条边界和最新 profile 字段；
- undo、重复操作、跨 thread 操作的错误码不变；
- response 中不出现内部 bitmap、reaction info ID 或数据库 user ID。

### 8.7 并发和重建测试

至少覆盖：

- 同一目标多个用户并发 upvote/emotion；
- 同一用户重复请求同一 emotion；
- add/undo 重试和乱序到达；
- 同步写路径会立即维护 reaction/emotion latest snapshot 的成员、顺序、去重和最多 5 条边界；
- ShadowSync 只刷新 latest snapshot 内的 profile 字段，不改变成员和顺序；
- bitmap projection 写失败后重试；
- 相同 `view event_id` 重试或重复入队只增加一次 `views`；
- 不同 `view event_id` 按产品定义分别计数；
- 相同 `event_id` 换 target 或 user 时返回幂等绑定错误；
- event 超过 retention window 被清理后，重复提交按明确的窗口语义处理；
- 匿名 view 只增加 `views`，不会写入 `viewed_user_ids`；
- view worker 按目标批量更新 `views` 字段和 `viewed_user_ids` bitmap；
- fact table 与 projection 暂时不一致时的修复任务；
- 热门 view 目标不会在请求线程同步更新 article/comment；worker 只批量更新 `views`
  counter 和 `viewed_user_ids` projection；
- （预留）view shard 落地后补充 cardinality 汇总测试。

## 9. 不在本次范围内的事情

- TODO（moderation 可见性）：举报去重、`reporter_count` / `report_case_count` 的权威来源、
  举报阈值触发的折叠策略，以及主站 `:public` 与 dashboard `:moderation` 的 Gate scope
  规则，后续作为独立的 moderation 设计处理。所有内容可见性条件必须收敛在 Gate scope，
  不在 List 或其他后续业务层追加过滤。
- 不改变 GraphQL 对外字段；
- 不向前端暴露数据库 ID；
- 不把 bitmap 当作包含时间和审计的完整事实源；
- 不把所有 emotion 预建成空记录；
- 不默认给所有目标创建 view shard；
- 不维护 `latest_reported_users`；report 的原因、状态、审核记录、comment participant
  等附加字段继续由 moderation 模型负责；
- 不用 `ShadowSync` 修改 article/comment 的 `meta` JSONB。

## 10. 最终判断

最终模型为：

```text
post_reaction_infos
blog_reaction_infos
changelog_reaction_infos
doc_reaction_infos
comment_reaction_infos
  -> view/upvote/collect 等固定关系 bitmap

post_emotion_infos
blog_emotion_infos
changelog_emotion_infos
doc_emotion_infos
comment_emotion_infos
  -> 每个实际使用的 emotion 一行 user_ids bitmap + latest_users snapshot

cms.view_events
  -> view event 幂等记录和处理状态

fact tables
  -> 权威关系和审计

ShadowSync
  -> latest users 展示资料

CMS / GraphQL
  -> 接口和返回结构保持不变
```

这能同时解决旧 JSONB 的无限增长、login 身份不稳定、viewer 判断低效、count 读取
重复聚合，以及互动写入与内容主记录耦合的问题。
