# Article emotion counts direct cutover

> 状态：目标合同，待实施。
>
> 本文是 Article 公共 emotion count 从当前 JSONB 投影切换为 typed row 的唯一实施合同。它依赖 canonical
> `cms.articles.id` 已落地，或与 canonical Article identity 在同一个受控发布窗口直接切换。实施不保留双写、双读、
> fallback、旧 GraphQL 字段或兼容 alias。

## 1. 范围与结论

当前 V1：

```text
cms.article_stats.reaction_counts JSONB
  -> GraphQL ArticleStats.reactionCounts
```

目标：

```text
CMS.Interactions owner transaction
  ├─ ArticleStats.upvotes_count / collects_count / interaction_revision
  └─ cms.article_emotion_counts(type, count, interaction_revision)
             │
             v
GraphQL ArticleStats.emotionCounts: [ArticleEmotionCount!]!
```

`emotionCounts` 表示每个 emotion type 的独立 count，不是所有 emotion 的总和。`UPVOTE` 和 `COLLECT` 继续使用
`ArticleStats` 固定字段；它们不进入 emotion rows。

本切换不属于 [Article view 同步计数](../feature/view-tracker/article-view-counting.md) 的范围。ViewTracker direct cutover
会重组 ArticleStats owner API，并把所有 owner 的 `snapshot_at` 切到数据库时间，但不改变当前 Interactions 的物理存储或
GraphQL 字段；本合同在 canonical Article identity 具备后单独实施。

## 2. 前置 identity

`article_id` 必须是全局 canonical `cms.articles.id`：

```text
cms.articles.id
  ├─ cms.article_stats.article_id
  ├─ cms.article_reaction_infos.article_id
  └─ cms.article_emotion_counts.article_id
```

不同 thread 的物理 id 可能相同，例如 Post 42 与 Doc 42；因此禁止创建以下过渡 identity：

```text
UNIQUE (thread, physical_article_id, type)
```

也禁止在 typed table 中继续保留多态 `post_id/blog_id/doc_id/...`。canonical Article identity 没有完成时，本迁移不能开始；
当前 JSONB 保持唯一生产路径，不增加第二张影子表。

## 3. 数据模型

```text
cms.article_emotion_counts
├─ article_id             FK -> cms.articles.id ON DELETE CASCADE
├─ community_id           社区范围排序维度副本
├─ thread                 thread 范围排序维度副本
├─ type                   HEART / BEER / POPCORN / ...，不包含 UPVOTE/COLLECT
├─ count                  当前公开 count
├─ interaction_revision   本行最后改变时的 owner revision
├─ inserted_at
└─ updated_at

PRIMARY KEY (article_id, type)
CHECK (count >= 0)
CHECK (interaction_revision >= 0)
```

`community_id` 和 `thread` 不是 locator 或第二套 identity，只是排序索引需要的可修复维度副本。它们必须与 canonical
Article 一致，并进入 drift audit。

普通展示允许稀疏行：缺失 type 在同一读取快照中解释为零。开放某个 emotion 排序前，必须为现有 Article 补齐该 type
的零值行，并让新建 Article 同步创建该行，否则无法用同一索引稳定覆盖零值 Article。

## 4. GraphQL 合同

```graphql
type ArticleEmotionCount {
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
  emotionCounts: [ArticleEmotionCount!]!

  commentsCount: Int!
  commentsParticipantsCount: Int!
  commentsRevision: Int!
  snapshotAt: Datetime!
}
```

实例：

```text
cms.article_stats
  article_id=42, upvotes_count=27, collects_count=4, interaction_revision=81

cms.article_emotion_counts
  (42, HEART,   12, interaction_revision=81)
  (42, BEER,     3, interaction_revision=81)
  (42, POPCORN,  1, interaction_revision=81)

GraphQL ArticleStats
  upvotesCount: 27
  collectsCount: 4
  interactionRevision: 81
  emotionCounts: [
    {type: HEART, count: 12},
    {type: BEER, count: 3},
    {type: POPCORN, count: 1}
  ]
```

上例表示 backfill 刚完成的状态：JSONB 没有 per-type revision，因此每个 row 统一使用当时对应
`ArticleStats.interaction_revision=81`。cutover 后，每个 emotion row 的 revision 只表示该行最后改变的 owner 版本；后续
HEART mutation 可以只推进 HEART row，未改变的 BEER/POPCORN 不需要为了追平新 revision 发生无意义写放大。

不增加 `emotionsCount` 总数字段。若某个 UI 临时需要总数，可以对 `emotionCounts` 求和；产品语义不能把这个求和结果
误称为 UV、参与人数或 reaction 数。

## 5. 写入合同

Interaction command 在一个 owner transaction 中完成事实和公共投影：

```text
BEGIN
  ├─ idempotently write interaction fact
  ├─ update ReactionInfo / viewer state
  ├─ advance interaction_revision
  ├─ ArticleStats.apply_interaction_counts/2
  │    ├─ Ecto UPSERT all fixed interaction-owned fields from owner facts
  │    │    ├─ upvotes_count
  │    │    ├─ collects_count
  │    │    └─ interaction_revision
  │    └─ shared snapshot_at = DB clock_timestamp()
  └─ emotion command only
       └─ Ecto UPSERT ArticleEmotionCount(article_id, type)
            count = owner count
            interaction_revision = owner revision
COMMIT
```

约束：

- 使用 Ecto changeset/query、`Repo.insert(..., on_conflict: ...)` 或 `Ecto.Multi`；领域模块不执行裸 SQL；
- `apply_interaction_counts/2` 每次都从 Interactions owner facts 原子写入全部固定 interaction-owned 字段，不能按
  UPVOTE/COLLECT/emotion 命令类型只 patch 单个固定字段；
- 在 emotion cutover 前，该 API 的字段集合仍包含
  `upvotes_count/collects_count/reaction_counts/interaction_revision`；本合同 direct cutover 删除 JSONB 后，字段集合收敛为
  `upvotes_count/collects_count/interaction_revision`，emotion 命令另外只 UPSERT 受影响 type 的 typed row；
- `apply_interaction_counts/2` 在 ArticleStats 缺行时也必须 UPSERT，不能静默更新零行；
- emotion UPSERT 只写受影响 type，不扫描或重写其他 emotion rows；
- 同一 transaction 失败时，interaction fact、ArticleStats 和 emotion row 一起回滚；
- `snapshot_at` 由数据库 `clock_timestamp()` 写入，不使用应用节点时间；
- ArticleStats 不能反向覆盖 Interactions owner facts。

Ecto 与 PostgreSQL 原语边界遵守 [`orm.md`](./orm.md)；本写链路不需要新增 runtime `Repo.query*`。

新增 `HEART` 只扩展受控 emotion vocabulary 和策略，不增加 ArticleStats 列、GraphQL 字段或 Query key：

```text
EmotionType.HEART
  -> interaction fact
  -> ArticleEmotionCount(article_id, HEART)
  -> ArticleStats.emotionCounts[]
```

## 6. 读取一致性

固定 ArticleStats 字段与 emotion rows 必须来自同一个 PostgreSQL statement snapshot：

```text
one Ecto query
  ├─ scoped canonical Article
  ├─ JOIN cms.article_stats
  └─ LEFT JOIN / aggregate cms.article_emotion_counts
       -> one complete ArticleStats DTO
```

允许一条 Ecto query 中的 grouped/lateral aggregation；也允许明确的 repeatable-read transaction。禁止先读 ArticleStats，
再在普通 read-committed 的第二条 statement 读取 emotion rows 后手工拼接，因为两个 statement 可能跨过 interaction commit。

列表 batch 对 1、20、100 个 Article 都使用有上限的批量读取，不能按 Article 或 emotion type 循环查询。缺失稀疏行按同一
snapshot 中的零处理，不读取旧 JSONB fallback。

## 7. 排序

开放 emotion 排序前创建并通过 `EXPLAIN` 验收：

```sql
CREATE INDEX article_emotion_counts_order_idx
ON cms.article_emotion_counts
  (community_id, thread, type, count DESC, article_id DESC);
```

```text
order=HEART
  -> Gate-scoped canonical Articles
  -> article_emotion_counts(type=HEART) index order
  -> stable article_id tie-breaker
  -> LIMIT page size
```

未完成零行 backfill、索引和 Gate scope 组合前，只允许展示该 emotion，不开放 order enum。Redis sorted set 或搜索索引如果
未来存在，只能从 typed rows 重建，不能成为 count owner。

## 8. Direct-cutover 迁移

本迁移使用协调发布窗口，不建立 runtime 兼容层：

```text
0. canonical cms.articles.id 与所有现有 Article mapping 验收通过
1. 准备新 migration、后端 schema/query、GraphQL/codegen 和前端 consumer
2. 进入短时 interaction write maintenance；公开只读可以继续
3. 创建 cms.article_emotion_counts
4. 从 reaction_counts JSONB 按 canonical article_id 一次性 backfill
   └─ 每个 type row 的 interaction_revision = 当前 ArticleStats.interaction_revision
5. 校验逐 Article/type count、总和、orphan、revision 和排序维度
6. 协调发布后端 GraphQL 与前端 generated consumer
7. 删除 reaction_counts、reactionCounts、旧生成类型和旧 selector
8. purge 含旧 ArticleStats hydration shape 的公共 HTML/CDN
9. 恢复 interaction writes，执行读写与排序 smoke test
```

步骤 2–7 之间不允许旧 interaction writes 继续改变 JSONB，否则 backfill 后会丢增量。若数据规模无法满足一次维护窗口，
必须先另立在线迁移协议；不能在本文中偷偷加入临时双写或 fallback。

删除旧 JSONB 前设置 destructive checkpoint：此前任一步失败都退出维护窗口并继续使用原 V1。删除后若必须回滚，必须
重新进入 interaction write maintenance，停止新写入，再使用一次性 rollback migration 从 typed rows 重建 JSONB、恢复
旧 release，最后才重新开放 interaction writes；不能靠运行时双读或 alias 回滚。成功切换后不存在运行时版本判断。
旧客户端/旧 hydration 由协调发布和 CDN purge 清除。

## 9. 删除与修复

permanent delete 由 canonical FK cascade 删除 emotion rows：

```text
delete cms.articles row
  -> cascade ArticleStats
  -> cascade ArticleEmotionCount
  -> cascade Interaction facts according to their owner contract
```

Interactions drift audit 分别比较 owner fact、ArticleStats 固定字段和 emotion rows。修复只能调用
`ArticleStats.rebuild_interaction_fields/1` 及 Interactions 自己的 emotion repair，不触碰 Comments 或 ViewTracker 字段。

## 10. 明确禁止

```text
(thread, physical_article_id, type) 过渡 identity
article_stats.reaction_counts 与 article_emotion_counts runtime 双写
reactionCounts 与 emotionCounts 同时暴露
从旧 JSONB fallback 补 typed rows
为每个 emotion 增加 ArticleStats 固定列
把 UPVOTE/COLLECT 同时写入固定字段和 emotion row
跨 statement 拼接固定统计与 emotion rows
为排序执行 runtime COUNT(*) 或相关子查询
领域模块使用裸 SQL 更新 count
```

## 11. 验收条件

- canonical `articles.id` 在所有 thread 全局唯一，Post 42 与 Doc 42 不会冲突；
- 每个 `(article_id, type)` 至多一行，count/revision 非负且无 orphan；
- JSONB backfill 与原数据逐 Article/type 完全一致，每个初始 row revision 等于对应 ArticleStats 当前
  `interaction_revision`；
- Interaction transaction 原子更新事实、固定统计、受影响 emotion row 和 owner revision；
- `apply_interaction_counts/2` 每次从 owner facts 写入全部固定 interaction-owned 字段；emotion 命令只额外写受影响 type
  的 typed row；
- ArticleStats 缺行与 emotion row 缺行都通过 Ecto UPSERT 正确创建；
- 固定字段与 emotion rows 从同一个 statement snapshot 组装；
- GraphQL 只暴露 `emotionCounts: [ArticleEmotionCount!]!`；
- runtime 不存在 `reaction_counts`、`reactionCounts`、双写、fallback、alias 或兼容 merge；
- 新 emotion 不需要 ArticleStats schema migration 或新增 GraphQL 字段；
- 开放某个 emotion 排序前完成零行 backfill、复合索引与 `EXPLAIN` 验收；
- permanent delete 不留下 emotion row，drift repair 不覆盖其他 owner 字段；
- 公共 HTML/CDN 不再携带旧 ArticleStats hydration shape；
- destructive checkpoint 后的 rollback 会重新进入 interaction write maintenance，完成 JSONB 重建和旧 release
  恢复后才开放写入；切换成功后没有运行时新旧协议分支。
