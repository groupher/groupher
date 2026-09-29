# Post Merge Design

> Status: draft.
>
> 本文记录 Post duplicate merge 的产品语义和实现边界。核心方向是
> relation-based merge：不把 merge 状态塞进 `posts` 宽字段，不物理搬运评论，
> 也不把 source post 做成只能重定向的空壳。

## 1. 背景

反馈型社区里会出现多个用户提交相同或相近需求。Canny 这类产品提供 merge post
能力：把重复反馈归并到 canonical post，让投票信号集中，同时保留重复来源的历史
语境。

Groupher 的 Post 不是单纯票箱。它同时承载正文、评论树、楼层、投票、收藏、状态、
通知、mention、统计和审核等关系。如果把 B 的 votes/comments 直接改外键到 A，会
造成唯一约束、楼层、回复树、冗余 meta、通知和 unmerge 的复杂回滚问题。

因此第一版采用关系层建模：A 是 canonical post，B/C/D 是 archived sources。
source post 仍然是完整 post，仍然可直接访问，但进入只读归档状态。

## 2. 目标

1. 支持把一个或多个 source post 合并到一个 canonical post。
2. source post 永远可以通过原 URL 直接访问。
3. source post merge 后进入 read-only archived 状态，不允许新的互动操作。
4. source post 是否继续出现在公开列表中由管理员策略决定。
5. canonical post 聚合 merged sources 的投票信号。
6. canonical post 的评论区可以切换 source tabs 查看 B/C/D 的原始讨论。
7. 保持 comments、votes 和 source post 自身数据不被物理搬运，保证 unmerge 可行。
8. merge 状态由独立 `post_merges` relation/operation 表承载，不污染 `posts`
   主表字段。

## 3. 非目标

- 不把 Post、Blog、Changelog 和 Doc 合并成一张内容表。
- 不为 Blog、Changelog 或 Doc 提供 merge 能力；本方案只处理 Post duplicate
  feedback merge。
- 不为了 merge 在 `posts` 上添加 `merged_into_id`、`merged_at`、`merged_by_id`
  等宽字段。
- 不把 B/C/D 的 comments 混排进 A 的主评论流。
- 不通过 `where post_id in (...)` 做跨 source 的主评论分页。
- 不物理迁移 B/C/D 的 comments 到 A。
- 不物理迁移 B/C/D 的 votes 到 A 作为第一版默认方案。
- 不把 source post 隐藏成 redirect-only 页面。
- 不把 Audit/Event 当作当前 merge 状态的唯一来源。

## 4. 术语

| 名称             | 含义                                                       |
| ---------------- | ---------------------------------------------------------- |
| canonical post   | merge 目标。多个重复反馈最终归并到这个 post，记为 A。      |
| source post      | 被归并的 post，记为 B/C/D。source post 仍完整存在。        |
| active merge     | 当前生效的 merge relation。                                |
| undone merge     | 已撤销的 merge relation。                                  |
| effective votes  | canonical post 自身 votes 加 active sources votes 后去重。 |
| own comments     | 某个 post 自己的 comments，不包含 merged sources。         |
| source tabs      | A 评论区中按 A/B/C/D 切换评论上下文的 UI。                 |
| read-only source | active merge 下的 source post，禁止新写操作但允许浏览。    |

## 5. 核心不变量

1. Merge 是 relation，不是 source post 的物理删除。
2. Source post 不重定向为 canonical post；原 URL 永远可访问。
3. Active source post 是 read-only archived post。
4. `views_count` 不属于互动写入限制；访问 source post 仍可继续增长 views。
5. A 的主评论流只包含 A 自己的 comments。
6. B/C/D 的 comments 保留在各自 post 下，通过 source tabs 或 source selector
   在 A 页面查看。
7. Unmerge 不需要从 A 中拆回 comments/votes，因为第一版不搬运它们。
8. 一个 source post 同一时间只能 active merge 到一个 canonical post。
9. 一个 canonical post 可以拥有多个 active source posts。
10. Source 和 target 必须属于同一个 community，且都必须是 Post。
11. 禁止 merge 到自己。
12. 禁止形成 merge 环。
13. 如果 target 本身已经是 active source，必须拒绝本次 merge，并提示先 unmerge 或
    选择最终 canonical post，不能隐式形成链式语义。
14. 所有时间使用 UTC。Ecto schema 使用 `:utc_datetime`，migration 使用
    `:timestamptz`。

## 6. 数据模型

### 6.1 `post_merges`

第一版只支持 Post，所以 merge relation 直接使用 Post FK。不要为了未来可能的
Blog/Doc 能力先做多态 relation；当前需求没有跨 thread merge，Post FK 能提供更强的
数据库约束和更清楚的 Ecto 模型。

```text
post_merges
├─ id
├─ hash_id
├─ community_id
├─ source_post_id                 FK -> cms.posts(id)
├─ target_post_id                 FK -> cms.posts(id)
├─ actor_id
├─ status                         active | undone
├─ visibility_policy              keep_listed | hide_from_list
├─ reason                         nullable text
├─ snapshot                       nullable jsonb
├─ inserted_at
├─ updated_at
├─ undone_at
└─ undone_by_id
```

建议约束：

```text
UNIQUE (hash_id)
UNIQUE (community_id, source_post_id) WHERE status = 'active'
INDEX  (community_id, target_post_id) WHERE status = 'active'
CHECK  (source_post_id <> target_post_id)
FK     (source_post_id) REFERENCES cms.posts(id) ON DELETE RESTRICT
FK     (target_post_id) REFERENCES cms.posts(id) ON DELETE RESTRICT
```

`snapshot` 只保存展示和审计需要的轻量信息，例如 merge 当时的 source/target title、
inner id、author 和 counts。业务状态仍以 source/target 当前行和 active relation 为准。

Service 层还需要校验 `source_post.community_id == target_post.community_id ==
post_merges.community_id`。数据库 FK 只能保证 source/target 存在，不能单独保证二者
属于同一 community。

### 6.2 为什么不放到 `posts`

`merged_into_id`、`merged_at`、`merged_by_id`、`merge_reason`、`merge_visibility`
这类字段只服务一个可选状态。如果放进 `posts`，主表会持续变宽，且后续 Blog/Doc
需要类似能力时还会重复污染产品表。

独立 relation 表的好处：

- merge 状态和 post 内容分层；
- 支持多个 source 合并到同一个 target；
- 支持 unmerge；
- 支持 visibility 策略；
- 支持后台管理列表；
- 后续如果 Blog/Doc 真的需要类似能力，再独立评估对应 relation 或抽取共享 service，
  不提前污染当前 Post 模型。

## 7. 生命周期

```text
ACTIVE
  post exists
  no active post_merges row as source

        merge into A
             |
             v

MERGED_SOURCE
  post exists
  active post_merges row exists as source
  direct URL remains readable
  write actions are blocked
  views can still increment

        unmerge
          |
          v

ACTIVE
  source post is writable again
  active relation becomes undone
```

## 8. Action Guard

所有会改变 source post 业务状态的操作都要先检查该 post 是否是 active source。

Merge 后 B/C/D 禁止：

- create comment;
- reply comment;
- vote / undo vote;
- collect / undo collect;
- change status/category/tag;
- edit title/body;
- pin/unpin comment;
- mark solution;
- delete/trash。

Merge 后 B/C/D 允许：

- read post detail;
- read comments;
- read upvoted users;
- read historical source metadata;
- increment views;
- admin unmerge;
- admin change visibility policy。

对于被禁止的普通用户操作，UI 应引导到 canonical post。后端仍必须强校验，不能只依赖
前端禁用按钮。

Active source post 不能直接进入 Trash 或永久删除。管理员如果要删除 source post，
必须先 unmerge；如果未来需要删除整个 canonical group，应设计单独的 group-level
admin operation，而不是绕过 source guard。

## 9. Votes 语义

Canonical post 显示 effective votes：

```text
effective_votes(A) =
  count(distinct user_id)
  from article_upvotes
  where post_id in [A.id | active_source_ids(A)]
```

展示上可以同时保留 own/effective 信息：

```text
128 votes
45 from this post
83 from merged sources
128 unique voters total
```

第一版不建议把 source votes 物理迁到 A，原因：

- `article_upvotes` 有 `(user_id, post_id)` 唯一约束，同一用户可能同时 vote A 和 B；
- 物理迁移需要去重和删除 source vote，unmerge 时难以恢复用户原始行为；
- article `upvotes_count` 和 `meta.upvoted_user_ids/latest_upvoted_users` 是冗余字段，
  物理迁移会要求同步重算多处状态。

性能策略可以分阶段：

1. 第一版 service 层按 active sources 查询并去重，列表页可先只展示 own count 或
   后台限定使用。
2. 如果公开列表需要大规模排序 effective votes，再引入 materialized counter 或
   merge stats cache。
3. Cache 必须能通过 merge/unmerge/vote/undo vote 失效或重算。

如果引入 `effective_votes` cache，它的依赖关系必须显式建模：

```text
effective_votes_cache(target_post_id)
  depends on target_post_id + active_source_post_ids(target_post_id)
```

失效规则：

- merge/unmerge source posts -> 失效 target post cache；
- target post vote/undo vote -> 失效 target post cache；
- source post vote/undo vote 正常会被 action guard 拦截；如果后台或旧入口绕过 guard，
  也必须能通过 active `post_merges` 找到 target 并失效 target cache。

## 10. Comments 语义

Comments 不做物理迁移，不做 SQL 混排。A 的评论展示区使用 source tabs 切换评论上下文。

少量 sources：

```text
Discussion
[A · 24] [B · 8] [C · 2] [D · 0]
```

较多 sources：

```text
Discussion
[Current post] [Merged sources 12]

Merged sources
├─ B title    8 comments
├─ C title    2 comments
└─ D title    0 comments
```

选中某个 source 后，复用现有 comments 查询：

```text
loadComments(article_id: selected_source.id)
```

每个 tab 保持自己的：

- floor;
- reply tree;
- pagination;
- pinned comments;
- replies embed;
- comment upvotes;
- viewer state。

这避免把评论当成平铺行混在一起后产生的楼层冲突、分页歧义和回复树错位。

## 11. 页面展示

### 11.1 Canonical post A

A 页面仍按正常 post 展示。额外提供 merged source 信息：

```text
已合并 6 个相似反馈，贡献 83 个去重 votes 和 12 条历史讨论
[查看来源]
```

展开后：

```text
Merged sources
B title                         42 votes · 8 comments
C title                         11 votes · 2 comments
D title                          9 votes · 0 comments
```

评论区使用 source tabs 展示 A/B/C/D 的评论上下文。普通用户不需要看到
`merged_by`、`visibility_policy` 等后台字段。

### 11.2 Source post B/C/D

Source post 详情页保留正文和历史评论，并显示只读 notice：

```text
此反馈已合并到 A
A title
[查看主反馈]
```

互动按钮应禁用或变成跳转到 A：

```text
Vote    -> 去 A 投票
Comment -> 去 A 讨论
```

### 11.3 列表

如果管理员选择 `hide_from_list`，普通列表不显示 source post。

`hide_from_list` 必须进入列表 base query 和 count query，然后再分页。不能先分页再
过滤 active sources，否则会出现空页、`total_count` 不准和翻页尾部缺页。

如果管理员选择 `keep_listed`，source post 卡片要明确标记：

```text
B title
Merged into A · 42 votes · 8 comments
```

列表中 source post 的 votes/comments 建议显示 own counts，避免一个 canonical group 在
多个卡片上重复展示 effective counts。

### 11.4 后台管理

后台 canonical post 管理页展示完整 sources 面板：

```text
Merged sources

B title
source: /post/123
42 own votes · 8 comments
visibility: hidden from list
merged by xieyiming
merged at 2026-07-28 10:32 UTC
[open] [unmerge] [change visibility]
```

当 sources 很多时，后台使用搜索、排序和分页，不在前台横向 tab 中塞满所有来源。

## 12. Unmerge

Unmerge 在 relation-based 方案中是可行的：

1. 将 active `post_merges` 行更新为 `status = undone`。
2. 写入 `undone_at` 和 `undone_by_id`。
3. 清理 canonical post 的 effective votes/cache。
4. Source post 解除 read-only archived 状态。
5. Source post 根据策略恢复列表可见性。

因为 comments/votes 没有被物理搬运，unmerge 不需要重建评论楼层、回复树、comment
upvotes、article upvotes 或 article meta。

如果未来引入物理迁移，则必须先设计可逆 operation log，记录每条被迁移/删除/去重的
vote、comment、counter 和 meta 变化。否则 unmerge 不可靠。

## 13. GraphQL/API 形态

建议新增或扩展的读模型：

```text
Post.mergeInfo
├─ isMergedSource
├─ canonicalPost
├─ mergedSources
├─ visibilityPolicy
└─ mergedAt

Post.effectiveUpvotesCount
Post.ownUpvotesCount
Post.ownCommentsCount
Post.mergedCommentsCount
```

建议新增 mutations：

```text
mergePosts(sourceIds, targetId, visibilityPolicy, reason)
unmergePost(mergeId)
updatePostMergeVisibility(mergeId, visibilityPolicy)
```

`mergePosts` 从第一版就接收 `sourceIds` 数组。单个 source 只是数组长度为 1，
这样 API、事务和校验天然支持批量合并，不需要 Phase 4 再改签名。

这些 mutations 应只接收公开 ID 或当前 API 已使用的 post identity，不暴露内部数据库
ID。后端 resolver 内部解析到 `source_post_id` 和 `target_post_id`。

## 14. Notification / Activity

Merge/unmerge 需要有可见活动记录，但不应把通知当作业务状态来源。

推荐策略：

- source post author 收到一次轻量通知：自己的 post 已合并到 canonical post；
- target post author/admin 可以在后台 activity 中看到 merge/unmerge；
- 普通订阅者默认不收到强推通知，避免 duplicate merge 产生噪音；
- A 页面和 B/C/D 页面都可以展示 merge activity 或 notice；
- audit/activity 记录只用于展示和追责，当前状态始终来自 `post_merges` active row。

## 15. 实现阶段

### Phase 1: relation 和只读 source

- 新增 `post_merges`。
- 实现 merge/unmerge service。
- 对 source post 写操作加 action guard。
- Source post 详情显示 read-only notice。
- 后台可查看、unmerge、修改 visibility。
- `mergePosts(sourceIds, targetId, visibilityPolicy, reason)` 支持数组入参。

### Phase 2: canonical votes 聚合

- 为 A 计算 effective votes。
- 明确列表页是否使用 effective votes 排序。
- 如有性能需要，引入 stats cache。

### Phase 3: A 评论区 source tabs

- A comments 默认展示 A 自己的 comments。
- 增加 source tabs/source selector。
- 选中 B/C/D 时复用现有 comments 查询，只读展示该 source 的评论。
- 不引入跨 source comments 混排。

### Phase 4: polish 和推荐能力

- 支持 duplicate candidate 推荐。
- 支持 merge history/audit 展示。

## 16. 待确认问题

1. Merge 后 source post 是否允许收藏为历史页，还是 collect 也统一引导到 canonical post？
2. `keep_listed` source 在搜索结果中如何排序和标记？
3. Canonical post status 改变时，是否联动展示 source statuses？
4. Effective votes 是否要影响首页排序，还是只影响详情页展示？
5. Source tabs 中是否需要一个 `All sources` 只读汇总入口？第一版建议不做。
