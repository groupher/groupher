# Artiment Interaction V2：projection count 与 list 路径

> 状态：核心 v2 已落地；moderation report surface 与 Gate 阈值规则保留为后续 TODO。
> 互动排序采用常规 projection count + `NULLS LAST` 模式，性能压测按数据规模和线上指标需要另行执行。
>
> 实现状态：projection 写入、State 读路径、interaction 排序、搜索/导出读取、backfill、主表旧列
> cutover、view pending 索引和 State 专属测试均已落地；本轮已完成 `Store`/`ViewerState` 清理、
> `hydrate_*` 生产命名清理、评论 root/reply 去重，以及 `Interactions` 命名空间统一。
>
> 范围：为 reaction / emotion projection 增加可排序的 `xxxCount`，并定义
> `CMS.Interactions.State` 的读写边界，以及 article/comment list 的批量读取、排序、缓存和
> 测试边界。
>
> 后续 mutation admission、thread metadata、Audit 和 emotion 协议的已知问题与演进方案见
> [Interaction V3](./interaction_v3.md)。V2 仍是 projection count 与 list 路径的现行合同。

## 0. 当前前提与 cutover

主表 `upvotes_count`、`collects_count` 已通过
`20260814160000_cut_over_legacy_interaction_counts` 删除；schema 中保留的同名字段均为 virtual
response fields，不参与 changeset 或数据库写入。v2 在 reaction / emotion projection 维护可重建、
可排序的派生 count，并将
interaction reader、sorter、搜索和导出切到 projection。唯一保留在内容主表的互动指标是 `views`，
因为它是包含匿名浏览在内的总浏览 counter。

cutover 不提供“主表优先、projection 兜底”的双读或双写兼容期：`xxxCount` 一律以 projection
为唯一读源。

## 1. 决策

互动 count 不保留在 article/comment 主表；它与 bitmap 一起维护在 reaction projection。

```text
article/comment 主表
  -> 内容、workflow、发布时间、社区归属、正文排序字段

reaction_info
  -> fixed reaction bitmap、fixed reaction count、latest users

emotion_info
  -> emotion bitmap、emotion count、latest users
```

article reaction info 的固定 count 为：

```text
upvotes_count
collects_count
```

comment reaction info 为：

```text
upvotes_count
```

每条 emotion info 另有一个 count（例如 `users_count`）；GraphQL 的
`<emotion>Count` 从这一行投影得到。`views` 仍是主表上的总浏览次数：它包含匿名浏览，
由 view event worker 聚合，不能用已登录用户的 `viewed_user_ids` 或其 cardinality 代替。

对外 GraphQL 字段名不变：`upvotesCount`、`collectsCount` 和 `<emotion>Count` 继续存在；
改变的是其数据库来源，而不是 API。

`report` 是例外：公共内容响应只需要 `viewerHasReported` 来避免重复举报，不把举报人数或
举报 case 暴露为常规 interaction 字段。dashboard moderation 所需的举报计数、case 明细、
阈值和可见性规则不属于本 v2，见 v1 文档中的 moderation TODO。因此 v2 不新增
`reported_count` projection 列。现有 `meta.reported_count` 是尚未迁走的 moderation 兼容响应
投影，不是 v2 `xxxCount`、不参与排序，也不作为新的读取模式扩展；它会与 dashboard/Gate TODO 一起
单独收敛。

## 2. 为什么不把 count 放回主表

旧模型把 count、membership 和 latest users 写进 article/comment，导致高频互动与正文编辑、
发布、审核、置顶等操作争抢同一主记录。把 `upvotes_count` 单独留在主表虽然让排序少一次
join，却重新引入了该写热点，也让同一互动的 bitmap 与 count 分散在两行维护。

reaction info 已经是一次互动必须写入和锁定的行。将 count 放在同一 projection 行：

- 不增加主表写入或锁竞争；
- bitmap、count 和 latest snapshot 在同一事务中更新；
- projection 可由 fact table 重建，主记录保持内容职责；
- sort/read 只读取所需的 bounded projection 数据，不再解码无限增长的 JSONB user array。

count 是一个可重建的派生 projection，不是新的权威事实：upvote、collect、emotion 的 fact
table，以及 `abuse_reports` 中的 report case，仍是关系和审计的权威来源。

读路径的 upvote/collect/emotion count 只读上述物化 count 列；bitmap 只用于 membership、写入更新与
审计校验，绝不在正常 hydrate/list 路径执行 `rb64_cardinality`。`reported_count` 仍是 moderation
兼容字段，暂时沿用 report bitmap 的独立读取路径，不属于 v2 的固定 interaction count。相比在
cardinality 表达式上建索引，标量 count 让
读取不必计算集合基数，并能与 bitmap 一起原子维护；审计也能直接比较二者。

## 3. 写入规则与一致性

同步互动在一个数据库事务中按以下顺序完成：

```text
写入或删除 fact row
  -> 锁定 / lazy-create 对应 reaction_info 或 emotion_info
  -> 对 bitmap add/remove
  -> 对 count +1/-1
  -> 更新 bounded latest users snapshot
  -> 提交
```

count 的增减必须与 bitmap 的 add/remove 处于同一事务、使用数据库原子表达式执行，不能在应用层先读
count 再写回。固定 reaction/emotion projection 的 bitmap、count 和 latest snapshot 由一条 `UPDATE`
同时写入；重复操作先由 fact table 的唯一关系判定，只有事实确实变化时才变更 projection，避免重复
请求把 count 重复加减。

撤销互动时从 latest snapshot 中移除当前用户；不为补足第五名而扫描完整 bitmap。资料刷新由
ShadowSync 处理。定期校验任务以 fact table 为准，校验并在必要时重建 bitmap 和 count；它还应
断言 `xxx_count == rb64_cardinality(bitmap)`。举报 audit 对可空的 `report_cases` 使用
`COALESCE(report_cases, '[]'::jsonb)`，空 payload 按没有 report case 处理。

## 4. `CMS.Interactions.State` 读写边界

v1 定义 fact table、reaction/emotion projection 和 bitmap 语义；v2 将现有分散在
Article、Comment、AbuseReport 与旧 projection writer 中的读写，收敛为
`CMS.Interactions.State`。

它不是 fact table 的权威来源，也不负责 Gate、通知、成就、搜索或 moderation 后续。它只负责
interaction projection state：

```elixir
Interactions.State.write(target, interaction, user, operation)
Interactions.State.read(thread, entries, viewer, context)
```

`write/4` 只能在调用方已经成功写入或撤销权威 fact 后、同一事务内调用；它按目标和
interaction 更新对应 bitmap、count 与 bounded latest-user snapshot。调用方仍拥有该动作的
业务语义，例如文章/评论 Gate、achievement、notification、search 与 report case 审计。

view 不走 `State.write/4`：`ViewEvents` 记录 event 后由 worker 调用 `State.merge_viewed_users/3`，批量更新
主表 `views` 和 viewed-user bitmap。这是异步 projection 的专用入口。
`view_events.target_type` 在 Elixir 层使用 `Ecto.Enum`，值来源于
`CMS.Artiment.Threads.article_enums/0`；数据库仍保存字符串值。
worker batch size 与 view event retention 分别由 `CMS.Interactions.Config` 的
`view_batch_size`、`view_event_retention_days` 配置；latest users 上限由
`latest_users_limit` 配置，默认值不作为运维策略写死在模块属性中。

`read/4` 接收目标 thread、已经通过 Gate scope 且完成分页的 entries、当前 viewer 和必要的
产品上下文。它必须：

1. 从 entries 收集去重后的 target ids；comment entries 同时包含 root 与 embedded replies；
2. 按 thread 读取 fixed reaction projection 与 emotion projection；
3. 在模块内部将结果 merge 回原有 entry/reply 结构；
4. 返回既有 GraphQL response shape，而不向调用方暴露 `%{id => state}` 中间结构或物理
   projection schema。

`thread` 直接使用 `:comment`、`:post`、`:blog`、`:changelog`、`:doc`；模块内部通过模式匹配
选择对应 projection schema。comment list 需要文章作者点赞标记时，Comments 读取路径只解析一次
文章 author user id，并显式传入 `article_author_id`；State 在同一批 fixed reaction 查询中计算，
不能为每条 comment 反查文章或作者。

`context` 目前允许 comment 页面传入 `[article_author_id: integer() | nil]`，以及 moderation surface
显式传入 `surface: :report`；普通 public list 禁止打开后者。`thread` 已单独传入，Gate
scope 已在调用前完成，不把 community 或可见性策略带入 State。latest-user snapshot 始终是 state
的一部分，不以 context flag 控制。

`State.read/4` 在内部完成完整 state merge，并由最外层响应路径只刷新一次 ShadowSync；ShadowSync
不读取或修改 interaction membership/count。

单对象读取使用同一边界的 `State.read/3`；comment 在未显式传入 `article_author_id` 时只为单对象
读取解析一次所属文章作者。article list 的 interaction 排序由 `State.order_articles/3` 在分页前加入
projection `LEFT JOIN`，并移除默认 active 排序，避免 count 排序被内容默认排序覆盖。

## 5. list 加载

list 不采用逐条 association preload，也不逐 article 调用 `rb64_cardinality`；这两种方式都会
形成 N+1。一个单 thread 分页的最小读取形态是：

```text
1. 按社区、可见性、filter、cursor/page 查询 article entries
2. reaction_info WHERE <target_id> IN (entry ids)
3. emotion_info  WHERE <target_id> IN (entry ids)
4. 在内存按 target id 合并为既有 article/comment response shape
```

第 2、3 步分别是每页各一条批量查询；没有 interaction 的目标因 reaction info lazy-create
而没有行，合并时使用 0、false、空 latest users 和空 emotion map。登录 viewer 的
`viewerHasUpvoted`、`viewerHasCollected`、`viewerHas<Emotion>` 在这两条查询中用 bitmap
membership 批量计算，不新增逐项查询。

comment root/reply list 同样先收集整页 comment id，再各执行一次 fixed projection 和 emotion
projection 查询，然后由 `Interactions.State.read/4` 在内部回填 root 与 embedded replies。

公共高频 list 可以缓存已排序的 article id/page 或不含 viewer state 的 response skeleton；
登录用户的 viewer state 仍在请求内按当前页批量 hydrate。不要为了缓存而把 count 回写到内容
主表。

`read_comments/3` 先以 root 顺序收集 root 与 embedded replies，再按 comment id 去重；同一个
reply id 不会因为 `comments ++ replies` 的 Map 覆盖顺序而 shadow root。单对象和列表都通过
`State.read/4` 或 `State.read/3`，调用方不再依赖内部 Store 或 `hydrate_*` API。

## 6. 排序与索引

按 publish、active、comments 等内容字段排序继续以主表为主。按互动排序时，查询显式关联对应
thread 的 reaction info：

```sql
SELECT p.*
FROM cms.posts AS p
LEFT JOIN cms.post_reaction_infos AS r ON r.post_id = p.id
WHERE p.community_id = $1 AND p.pending = 'legal'
ORDER BY r.upvotes_count DESC NULLS LAST, p.id DESC NULLS LAST;
```

没有 reaction info 行的 article 视为 count 0。`LEFT JOIN` 是 lazy-create 的必要语义，不能把它
改成 inner join。

每个 reaction info 表为已有 projection 行的可排序 count 建立 B-tree 索引，例如：

```text
post_reaction_infos(upvotes_count DESC NULLS LAST, post_id DESC NULLS LAST)
post_reaction_infos(collects_count DESC NULLS LAST, post_id DESC NULLS LAST)
```

其他 article thread 和 comment 采用相同原则。projection 列为 `NOT NULL DEFAULT 0`，但 `LEFT JOIN`
缺行仍是 SQL `NULL`，因此排序必须显式使用 `DESC NULLS LAST`；否则 PostgreSQL 会把无 projection
的目标排到热文前面。对应索引也必须声明 `NULLS LAST`。有 projection 行但 count 为 0 的目标仍按
0 排在有 count 的目标之后、无 projection 目标之前。

emotion 排序只在产品明确提供 `ORDER BY <emotion>` 时增加：按 `emotion` 限定后 join 对应
emotion info，索引使用 `(emotion, users_count DESC, <target_id> DESC)`。未暴露的 emotion 排序
不预建索引。

View worker 尚未消费时，State 读取会批量检查当前 viewer 的 pending event，避免 durable view 在
异步 worker 完成前错误显示为未查看；消费完成后仍以 bitmap membership 为准。`ViewEvents.metrics/0`
同时返回 pending age、failed count，以及基于最近一次 processed event 计算的
`view_worker_lag_seconds`。
为 pending viewer lookup 增加 `(target_type, target_id, user_id) WHERE processed_at IS NULL`
partial index；worker 使用的 target 扫描索引保持不变。

## 7. 模块边界与后续 TODO

v2 的公共入口只有：

```text
CMS.Interactions.State    # read/write/count/order
CMS.Interactions.ViewEvents # durable view event + worker projection
CMS.Interactions.Config   # view batch/retention/latest-users runtime config
CMS.Interactions.Schema.* # reaction/emotion schema macros
CMS.Articles.Emotions     # article emotion fact mutation
```

`CMS.Reactions.Store`、`CMS.Comments.ViewerState` 和 reaction 读路径中的 `hydrate_*` 不再是稳定
业务 API。Trash 自己的 `CMS.Articles.Trash.hydrate_entries` 属于回收站领域，不在本次命名清理范围。
文章/评论的 Gate、fact mutation、achievement、通知和 report case 仍由各自产品上下文负责；不创建
`CMS.Articles.Interactions` 这种重复门面。

report 是显式例外：公共 `State.read` 只需要 `viewer_has_reported`；举报 mutation 返回值通过
`surface: :report` 显式读取兼容的 `reported_count`，其权威来源是 abuse report case。dashboard/
moderation 读取 report count 与阈值时同样必须走显式 moderation surface，不能把 report bitmap
cardinality 混入普通 interaction list；dashboard 聚合和 Gate 的 public/moderation scope 规则仍是
后续 TODO。

`latest_*_users` 的上限由 `CMS.Interactions.Config.latest_users_limit/0` 提供，默认 5，避免把
展示策略硬编码在 `State` 模块属性中。

## 8. v2 启用边界

v2 migration 新增 projection count、排序索引、`CMS.Interactions.State` 和相应查询路径；完成所有
reader、sorter、搜索/导出 projection 的切换后，删除主表的历史 interaction count。该删除已由
`20260814160000_cut_over_legacy_interaction_counts` 完成。所有这些路径必须
直接读取 reaction/emotion count；不得引入“主表 count 优先、reaction count 兜底”的双读或双写分支。

## 9. 必须覆盖的测试

### 写入与修复

- add/remove upvote、collect、emotion 后，fact、bitmap、`xxxCount` 与 latest snapshot
  在同一事务结果中一致；
- 重复 add、重复 remove、并发首次 lazy-create 不会重复增减 count；
- `xxxCount` 与 `rb64_cardinality(bitmap)` 一致；定期校验可从 fact table 修复刻意制造的不一致；
- 匿名 view 只增加主表 `views`；登录 view 的 bitmap membership 不影响 `views` 语义。

### list hydrate

- article list 和 comment/root/reply list 保持既有 GraphQL response shape；
- 有 projection、无 projection、多个 emotion、匿名和登录 viewer 都返回正确 count、latest users
  与 viewer state；
- 对一页 N 条 entry，固定 reaction 与 emotion 读取各最多一次，不出现随 N 增长的 SQL 查询数；
- viewer state 是请求级数据，公共缓存结果不会泄漏另一用户的 membership。
- `State.read/4` 负责 root/reply 的完整回填；调用方不再单独 merge 或再次读取 projection；
- `State.read/4`、`State.order_articles/3` 和 pending view fallback 有专属测试，覆盖无 projection
  行的 0 count、viewer 隔离和稳定 interaction 排序；
- 评论文章作者点赞标记只使用页面上下文中一次解析的 author id，不产生 comment 级 article/author
  查询；
- ShadowSync 只在完整 interaction state merge 后调用一次。

### 排序与分页

- upvote/collect 排序使用 reaction info count，0 count 的目标仍在结果内；
- count 相同使用稳定 secondary key，cursor/page 翻页不会重复或遗漏；
- filter、community scope、审核/可见性 scope 与 reaction join 组合后仍正确；
- 互动排序当前使用物化 count 和对应 B-tree 索引；当数据规模或线上指标触发性能验收时，
  再用真实规模 fixture 记录 `EXPLAIN (ANALYZE, BUFFERS)`，确认没有 bitmap cardinality
  计算或排序盘溢出；这不是当前 v2 的未完成项。
- 当前没有 interaction list cache；未来若引入缓存，再补 cache hit/miss 的排序、分页和 viewer
  state 隔离测试。
