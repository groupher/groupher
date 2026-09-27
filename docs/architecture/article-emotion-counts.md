# Article emotion counts direct cutover

> 状态：本地实现完成；生产迁移窗口、CDN purge 与线上 smoke test 待验收。
>
> 本文是 Article 公共 emotion count 从 JSONB 切换为 typed rows 的实施合同。切换不保留双写、双读、fallback、
> 旧 GraphQL 字段或兼容 alias。本项目不迁移历史 JSONB/generic emotion 数据，也不提供历史清理或转换逻辑。

## 1. 结论

旧路径：

```text
cms.article_stats.reaction_counts JSONB
  -> GraphQL ArticleStats.reactionCounts
  -> frontend TArticleStats.reactionCounts
```

当前路径：

```text
CMS.Interactions owner transaction
  ├─ cms.article_stats
  │    ├─ upvotes_count
  │    ├─ collects_count
  │    └─ interaction_revision
  └─ cms.article_emotion_counts
       ├─ thread
       ├─ article_id
       ├─ type
       ├─ count
       └─ interaction_revision

GraphQL ArticleStats.emotionCounts
  -> frontend TArticleStats.emotionCounts
```

`UPVOTE` 和 `COLLECT` 仍使用 ArticleStats 固定字段；typed rows 只保存普通 emotion：
`DOWNVOTE/BEER/HEART/BICEPS/ORZ/CONFUSED/PILL/POPCORN`。

## 2. Identity 与非目标

本次不引入 `cms.articles`，也不修改 Article content 模型：

```text
cms.posts
cms.blogs
cms.changelogs
cms.docs
```

不同 thread 继续使用不同表和不同字段，FrontDesk 继续按 thread dispatch。公共 GraphQL locator 仍是
`community + thread + innerId`。

ArticleStats 与 typed emotion rows 使用现有内部 identity：

```text
(thread, article_id)

thread      = post | blog | changelog | doc
article_id  = 对应 thread 内容表的主键 id
```

因此 Post 42 与 Doc 42 不冲突。这里的 `article_id` 是后端内部定位字段，不新增任何需要暴露给前端的自增 id。

typed row 的唯一 identity 是：

```text
PRIMARY KEY (thread, article_id, type)
```

Doc branch 语义也由这个 identity 明确定义：同一 `article_hash_id` 在不同 branch 中对应不同的物理 `docs.id`，因此 views、
interactions、comments 和 emotion counts 都按 branch 独立，不跨 branch 汇总。若未来产品要改为 logical Doc 聚合，必须先完成
独立 canonical identity 迁移，不能在当前投影层按 `article_hash_id` 临时合并。

## 3. 数据模型

```text
cms.article_emotion_counts
├─ thread                required
├─ article_id            required
├─ type                  required
├─ count                 non-negative bigint
├─ interaction_revision  non-negative bigint
├─ inserted_at           timestamptz
└─ updated_at            timestamptz

PRIMARY KEY (thread, article_id, type)
CHECK thread IN (post, blog, changelog, doc)
CHECK type IN (downvote, beer, heart, biceps, orz, confused, pill, popcorn)
CHECK count >= 0 AND interaction_revision >= 0
```

因为 Article 内容分散在四张表，数据库不能用一个普通 FK 表达 `(thread, article_id)` 的多态引用。本次仍沿用现有 owner
删除编排，不伪造跨表 FK，也不为此额外引入 identity registry。

## 4. 写入协议

emotion command 保持单事务：

```text
BEGIN
  ├─ idempotently write interaction fact
  ├─ update per-thread reaction/emotion projection
  ├─ advance interaction_revision
  ├─ ArticleStats.apply_interaction_counts(article)
  │    └─ UPSERT fixed fields
  └─ ArticleStats.apply_emotion_count(article, affected_type)
       └─ UPSERT (thread, article_id, type)
COMMIT
```

约束：

- Interactions 仍是事实 owner；ArticleStats 与 typed rows 都只是公共读取投影；
- `apply_interaction_counts/1` 写入全部固定 interaction 字段，但不再生成 JSONB；
- `apply_emotion_count/2` 只更新受影响的一个 type，不扫描或重写其他 type；
- count 归零时保留零值 typed row，公共读取只返回 `count > 0` 的 emotion；
- interaction fact、固定统计和 typed row 任一步失败，整笔事务回滚；
- `UPVOTE/COLLECT` 不能通过通用 emotion mutation 写入 typed table；GraphQL `articleEmotion` input enum 与领域入口都显式拒绝。

## 5. 读取协议

ArticleStats 的公共读取在一个 PostgreSQL statement snapshot 内完成：

```text
scoped Article rows
  -> load cms.article_stats by (thread, article_id[])
  -> LEFT JOIN grouped cms.article_emotion_counts
  -> jsonb_agg(type, count), count > 0
  -> ArticleStats DTO
```

返回排序固定为 `count DESC, type ASC`。查询次数不随 Article 数量或 emotion type 数量增长，不允许 N+1。

GraphQL 唯一字段：

```graphql
type ArticleEmotionCount {
  type: EmotionType!
  count: Int!
}

type ArticleStats {
  emotionCounts: [ArticleEmotionCount!]!
}
```

前端唯一合同：

```ts
type TArticleStats = {
  emotionCounts: Array<{ type: string; count: number }>
}
```

## 6. 删除协议

继续使用现有 permanent-delete 编排：

```text
Trash / Docs.Trash
  -> delete thread-specific Article content and owner state
  -> ViewTracker.delete_article_state(thread, article_id)
  -> ArticleStats.delete(thread, article_id)
       ├─ DELETE cms.article_emotion_counts
       └─ DELETE cms.article_stats
```

这不是数据库 cascade；typed rows 和 ArticleStats 一样，由现有显式 owner cleanup 清理。`Docs.Trash` 删除哪个 branch 的物理
Doc，就只清理对应 `docs.id` 的投影；其他 branch 的 Doc 与统计不受影响，也不存在“最后一个 branch 才删除 canonical”的协议。

## 7. 迁移与发布

迁移只负责 schema direct cutover：

```text
1. 创建 cms.article_emotion_counts
2. 删除 article_stats.reaction_counts
3. 同一 release 发布 GraphQL schema/codegen/frontend consumer
4. purge 旧 SSR/HTML/CDN payload
5. 执行四个 Article thread 的读写 smoke test
```

不存在 JSONB backfill、历史 generic emotion 对账、reserved 数据清理或一次性转换任务。迁移不检查、保留或重建旧
emotion 数据；删除 `reaction_counts` 时，任何旧值都按产品决定直接丢弃。后续也不为这些数据增加兼容读取或恢复路径。

runtime 中不存在：

```text
reaction_counts 与 article_emotion_counts 双写
reactionCounts 与 emotionCounts 同时暴露
JSONB fallback
兼容 alias
```

## 8. 排序扩展

typed table 预建索引：

```sql
CREATE INDEX article_emotion_counts_order_idx
ON cms.article_emotion_counts
  (thread, type, count DESC, article_id DESC);
```

这只提供物理基础。本次没有新增按 emotion 排序的 GraphQL order enum；开放某个 emotion 排序前仍需完成 Gate scope、
稳定分页和真实数据 `EXPLAIN (ANALYZE, BUFFERS)` 验收。

## 9. 验收条件

- schema 中不存在 `article_stats.reaction_counts`；
- runtime 与生成类型中不存在 `reaction_counts`、`reactionCounts` 或 `ArticleReactionCount`；
- 每个 `(thread, article_id, type)` 至多一行，count/revision 非负；
- emotion add/undo 与重复命令保持幂等，零值不出现在公共响应；
- Post/Blog/Changelog/Doc 均返回 `emotionCounts`；
- batch ArticleStats 读取包含一次 typed-row 聚合且没有 N+1；
- permanent delete 同时清理 ArticleStats 与 typed emotion rows；
- 同一 logical Doc 的不同 branch 保持独立 stats/emotion rows，删除一个 branch 不影响其他 branch；
- generic Article emotion 在 GraphQL 与领域入口均拒绝 UPVOTE/COLLECT；
- migration 不读取、解析或迁移旧 JSONB/generic emotion 数据；
- FrontDesk dispatch、各 thread 内容表和现有公开 locator 保持不变。
