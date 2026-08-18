# Article Trash 与 CMS Audit 重构方案

> Status: implemented for the backend lifecycle and existing Docs Trash UI; the
> reusable non-Docs Trash management UI remains a follow-up consumer of the new API.
>
> 本方案是一次单向切换：完成数据迁移后，只保留新的 Trash 模型。
> 不引入 `mark_delete` 兼容分支、双读、双写或运行时 fallback。

## 1. 背景

当前 Article 删除使用各产品表上的 `mark_delete` 布尔字段。公开列表通过
`mark_delete: false` 排除被删除内容，恢复则把字段改回 `false`。

Docs Editor 另外维护 `doc_tree_trash_items`：删除 Tree 节点时保存节点快照、
原位置和可选 Doc draft 快照，再物理删除 draft Tree 节点。两套机制目前没有
统一的生命周期、列表、自动清理和审计边界。

这带来几个问题：

- `mark_delete` 只表达一个布尔状态，无法自然承载删除人、删除时间、自动永久
  删除时间和一次批量操作；
- 普通 Article 查询需要在各处记住追加 `mark_delete: false`；
- Post、Blog、Changelog 和 Doc 没有统一的 Trash 查询与恢复能力；
- Docs Tree Trash 同时保存结构和内容恢复信息，产品边界不够清楚；
- 永久删除与 Mention、统计、搜索、资源清理之间没有统一契约；
- 当前没有一个面向 CMS 重要操作的持久、不可变 Audit 模块。

## 2. 目标

1. 用 `trashed_articles` 取代所有 Article 表上的 `mark_delete`。
2. 为 Post、Blog、Changelog 和 Doc 提供统一的 Trash 生命周期。
3. 保持 Article 产品独立；只共享 Trash 基础设施和生命周期服务。
4. 保持 Docs Tree 为 Docs 专属扩展，通过一次 `trash_action` 与 Article Trash
   协调。
5. 支持恢复、手动永久删除和定时自动永久删除。
6. Trash Article 对外不可见，但已有 Mention 继续显示标题和“已删除”状态。
7. Trash 管理界面可以查询 `mentions` 和 `mentionedBy`，辅助恢复或永久删除决策。
8. 建立通用 `CMS.Audit`，记录所有 CMS 中重要、可追责的领域操作。
9. 修正 Docs Page Duplicate：复制为独立 Doc，不再让多个 Page 共享同一个
   `doc_id`。

## 3. 非目标

- 不把 Post、Blog、Changelog 和 Doc 合并到一张内容表。
- 不把完整 Article 数据搬到 Trash 表。
- 不把 Audit 当作 Snapshot、Trash、Domain Event 或业务数据恢复来源。
- 不记录每次浏览、点赞、收藏、自动保存或编辑器输入。
- 不让其他 Article 产品依赖 Docs Tree、Tree Revision 或 Docs Release。
- 不通过 GraphQL 暴露 Article 物理数据库 ID。
- 不保留多个 Page 共享一个 Doc 的运行时兼容逻辑。
- 不为本次重构扩展通用 `QueryBuilder` 或 `Helper.Transaction` 基座能力。
- 不预先引入通用批量锁、通用生命周期框架或 denormalized Trash flag；领域内先用
  最小实现解决，出现第二个稳定使用场景后再评估下沉。

## 4. 术语

| 名称                 | 含义                                                             |
| -------------------- | ---------------------------------------------------------------- |
| logical Article      | 由 `community + thread + article_hash_id` 标识的一篇逻辑 Article |
| physical Article row | 某个 branch/stage 中的实际产品表行，使用内部数据库 `id`          |
| Trash Article        | Article 数据仍然存在，但有对应 `trashed_articles` 行             |
| permanent deletion   | 删除完整 Article aggregate，不可通过产品功能恢复                 |
| trash action         | 一次用户或系统执行的 Trash 操作，可包含多个 Article 和 Tree 节点 |
| audit log            | 一条不可变、不可用于恢复的操作审计记录                           |
| `mentions`           | 这篇内容提到了哪些对象                                           |
| `mentionedBy`        | 哪些内容提到了这篇内容                                           |

## 5. 核心不变量

1. Trash 作用于 logical Article，不作用于某一条 physical row。
2. `trashed_articles` 使用 `community_id + thread + article_hash_id` 定位 Article。
3. `trashed_articles` 只保存当前仍在 Trash 的 Article。
4. 恢复成功后删除对应 `trashed_articles` 行。
5. 永久删除成功后，Article aggregate 和对应 `trashed_articles` 行都不存在。
6. 普通公开读取只能返回不存在 Trash membership 的 Article。
7. Trash 不删除 Article 的内容、评论、关系、Mention 或版本数据。
8. 永久删除会删除 Article 拥有的数据和关联，但不会误删共享 Tag、User、
   Community 或仍被引用的存储对象。
9. Article 进入 Trash 时更新可见性统计；永久删除不能重复扣减统计。
10. 一个 Docs Page 只能绑定一个独立 Doc；同一个 Doc 出现在其他位置时使用
    Link。
11. Duplicate Page 创建新的 `node_id` 和新的 `doc_id`。
12. Audit 是 append-only；业务状态不能依赖 Audit 记录恢复。
13. 所有时间均使用 UTC。Ecto schema 使用 `:utc_datetime`，migration 使用
    `:timestamptz`。
14. Docs Trash 是即时生命周期操作，不等待 Docs Publish：删除已发布节点时必须在
    同一事务中移除 draft/public Tree placement，并让对应 Article 立即对外不可见。
15. Docs 是否曾公开由删除时是否存在 public Tree snapshot 表达，不额外维护
    `was_published` 等布尔状态。
16. Docs Article 不能通过独立 `trashArticle` 入口删除；必须从 Docs Tree 入口发起，
    避免留下仍可见但正文不可访问的 Tree placement。Docs 内部仍复用通用 Article
    Trash membership。
17. Docs Group/Tab/Page action 只能整组恢复或永久删除，不能通过通用 Article API
    单独处理其中一个 Doc。

## 6. 生命周期

```text
ACTIVE
  Article exists
  trashed_articles row does not exist

        trash
          |
          v

TRASHED
  Article exists
  trashed_articles row exists

     restore | permanently delete
       |      |
       v      v

    ACTIVE   PERMANENTLY_DELETED
             Article aggregate does not exist
             trashed_articles row does not exist
```

判断逻辑：

```text
Active list:
  Article exists AND no active trashed_articles row

Trash list:
  trashed_articles JOIN current Article state

Permanently deleted:
  Article row is absent, so normal Article queries cannot return it
```

## 7. 数据模型

### 7.1 `trash_actions`

`trash_actions` 是当前业务状态的一部分。一行表示一次把内容移入 Trash 的操作，
用于整组恢复和整组永久删除。

```text
trash_actions
├─ id                         internal PK
├─ hash_id                    stable public UUID
├─ community_id
├─ actor_id                   nullable for system jobs
├─ root_type                  article | doc_tree_page | doc_tree_group | doc_tree_tab | ...
├─ root_ref                   stable public ref of the user-visible root target
├─ deleted_at
├─ scheduled_permanent_deletion_at
├─ inserted_at
└─ updated_at
```

约束和索引：

```text
UNIQUE (hash_id)
INDEX  (community_id, deleted_at)
INDEX  (scheduled_permanent_deletion_at)
```

`trashed_articles.trash_action_id` 和
`trashed_doc_tree_nodes.trash_action_id` 对 action 使用 `ON DELETE RESTRICT`。删除
`trash_actions` 不能级联删除当前仍在 Trash 的子项。

单篇 Article 删除也创建一个 `trash_action`，只是只有一个子项。Docs Group/Tab
删除会在同一个 action 下关联多个 Tree 节点和 Article。

当 action 下所有 Trash 子项都已恢复或永久删除时，可以删除 `trash_actions` 行。
历史由 `audit_logs` 保留。

### 7.2 `trashed_articles`

```text
trashed_articles
├─ id
├─ hash_id                              stable public UUID for GraphQL
├─ trash_action_id
├─ community_id
├─ thread                               post | blog | changelog | doc
├─ article_hash_id                      logical Article identity
├─ deleted_by_id                        nullable for system jobs
├─ deleted_at
├─ inserted_at
└─ updated_at
```

约束和索引：

```text
UNIQUE (hash_id)
UNIQUE (community_id, thread, article_hash_id)
INDEX  (trash_action_id)
INDEX  (community_id, thread, deleted_at)
```

自动永久删除时间属于 `trash_actions`，因为永久删除以 action 为原子单位，而且
Link-only 等没有 Article 子项的 action 也需要到期清理。不要在每个 child row 重复
保存同一时间。

`article_hash_id` 是已有 Article Versioning 架构中的 stable logical identity，
不是 physical Article row id。由于 Post、Blog、Changelog 和 Doc 仍在不同产品表，
该多态引用由 `thread + article_hash_id` 和共享 Trash service 校验，不建立指向某一
产品表的传统 FK。

### 7.3 `trashed_doc_tree_nodes`

目标模型用 `trashed_doc_tree_nodes` 替换或重命名当前
`doc_tree_trash_items`。它只保存 Docs Tree 的结构恢复信息。

```text
trashed_doc_tree_nodes
├─ id
├─ hash_id
├─ trash_action_id
├─ community_id
├─ branch_id
├─ node_id
├─ doc_id                              only for page
├─ draft_snapshot                      nullable
├─ public_snapshot                     nullable
├─ deleted_by_id
├─ deleted_at
├─ inserted_at
└─ updated_at
```

约束和索引：

```text
UNIQUE (hash_id)
UNIQUE (trash_action_id, node_id)
CHECK  (draft_snapshot IS NOT NULL OR public_snapshot IS NOT NULL)
INDEX  (trash_action_id)
INDEX  (community_id, branch_id, deleted_at)
```

一行表示一个 logical Tree node。draft/public 的 parent、index、slug、title 和展示配置
分别保存在两个 snapshot 中；snapshot 是否存在就是该 stage 删除前是否存在的事实来源。
不要再用单独布尔字段重复表达 public 状态。

恢复后删除对应行，不保留 `restored_at`。Audit 记录恢复事实。

目标状态下，Page 对应的 draft/public Doc rows 和 ArticleDocument 在软删除期间继续
保留，`trashed_articles` 只记录 logical Article 的 Trash membership。因此 Tree
snapshot 不再复制完整 Doc draft 或正文；完整 aggregate 只在永久删除时移除。

### 7.4 `audit_logs`

`audit_logs` 是 CMS 通用、不可变的操作审计表。

```text
audit_logs
├─ id
├─ hash_id
├─ community_id
├─ actor_type                          user | system
├─ actor_id                            nullable
├─ actor_snapshot                      minimal login/nickname/avatar
├─ action                              namespaced string
├─ resource_type
├─ resource_ref                        stable public ref
├─ resource_snapshot                   minimal title/thread; never full body
├─ operation_ref                       copied operation UUID, no FK
├─ source                              dashboard | api | scheduler | import | migration
├─ metadata
├─ occurred_at
└─ inserted_at
```

约束和索引：

```text
UNIQUE (hash_id)
INDEX  (community_id, occurred_at)
INDEX  (community_id, action, occurred_at)
INDEX  (resource_type, resource_ref, occurred_at)
INDEX  (operation_ref)
```

`action` 使用 namespaced string，并由代码中的 registry 校验。新增 action 不需要
修改数据库 enum。

Audit 不使用资源 FK：Article、User 或其他资源永久删除后，审计记录仍需存在。

## 8. Trash 与 Audit 的职责

```text
trash_actions
  当前操作分组
  用于恢复和永久删除
  action 清空后可删除

trashed_articles
  当前仍在 Trash 的 Article

trashed_doc_tree_nodes
  当前仍在 Trash 的 Docs Tree 节点

audit_logs
  永久历史事实
  append-only
  不参与恢复
```

一次 Article 生命周期示例：

```text
Trash Article
  create trash_action
  create trashed_article
  append article.trashed audit log

Restore Article
  delete trashed_article
  delete empty trash_action
  append article.restored audit log

Permanently Delete Article
  delete Article aggregate
  delete trashed_article
  delete empty trash_action
  append article.permanently_deleted audit log
```

Audit 写入必须与领域变更处于同一个数据库事务：业务变更或 Audit 任一失败时，
整个事务回滚。

## 9. Article Trash 服务

新增统一边界：

```text
CMS.Articles.Trash
```

建议接口：

```elixir
trash(article, actor, opts)
restore(trashed_article, actor, opts)
get(hash_id)
list(community, filter)
permanently_delete(trashed_article, actor, opts)
CMS.Trash.purge_due(opts)
```

产品 Resolver、Docs Tree 和 Scheduler 只能通过该 service 修改 Article Trash
状态，不直接创建或删除 `trashed_articles`。

本次只新增 Article 领域边界。单篇 Article 继续复用现有
`CMS.Articles.Lock`；Docs Group/Tab 确实需要同时锁多篇 Article 时，可以在
`CMS.Articles.Lock` 内增加领域专用的有序批量入口。不要为了这一个场景扩展
`Helper.Transaction` 或设计通用 lifecycle framework。

### 9.1 Trash

一个事务内：

1. 使用 logical Article lifecycle lock 锁定 Article；
2. 校验权限和当前状态；
3. 创建 `trash_action`；
4. 创建 `trashed_articles`；
5. 在 `trash_action` 设置 `scheduled_permanent_deletion_at`；
6. 从搜索、Feed、RSS、置顶、推荐、缓存和公开路由中移除；
7. 更新 Community、Article 和 Tag 可见性统计；
8. 保留 Article aggregate、Snapshot、Comment、Mention 和资源关系；
9. 写入 `article.trashed` Audit；
10. commit。

### 9.2 Restore

一个事务内：

1. 按 9.4 的固定顺序取得 logical lifecycle locks；
2. 使用 `FOR UPDATE` 锁定并重新读取 Trash action 和所有子项；
3. 校验恢复权限；
4. 对 Docs action 验证 Tree revision、stage snapshot 和恢复位置；
5. 删除 `trashed_articles`；
6. 恢复搜索、缓存和公开 projection；
7. 恢复可见性统计；
8. 恢复 Docs Tree；
9. 条件删除已经清空的 `trash_action`；
10. 写入 `article.restored` 或 `doc_tree.restored` Audit；
11. commit。

重新进入 Trash 时创建新的 action 和新的自动删除时间。

### 9.3 Permanent Delete

永久删除意味着产品层不可恢复。删除完整 Article aggregate：

- 当前 Article rows；
- Article Document；
- Comments 和 replies；
- upvotes、emotions、collects；
- Article 与 Tag 的 join rows；
- cover edit info；
- Article snapshots 和版本关系（不删除共享 branch）；
- pinned、report 等 Article 所属关系；
- Article document asset refs；
- Article 作为 mentioner 发出的 `mentions`；
- 随 Article 级联删除的 Comments 所发出或指向这些 Comments 的 Mention facts；
- `trashed_articles`；
- 空的 `trash_actions`。

不能删除共享实体：

- Tag；
- User/Author；
- Community；
- 仍被其他内容引用的 OSS object。

其他内容对该 Article 的 `mentionedBy` 保留；详见 Mention 章节。

Article 在进入 Trash 时已经从公开统计中扣除。永久删除不能再次扣除，否则会
double decrement。

### 9.4 并发和锁顺序

使用现有两类 PostgreSQL transaction advisory lock：

```text
Article: article_lifecycle:<community_id>:<thread>:<article_hash_id>
Docs:    doc_tree:<community_id>:<branch_id>
```

固定顺序：

```text
Docs action: doc_tree lock
          -> Article lifecycle locks（按 article_hash_id 排序）
          -> trash_action / Trash child rows FOR UPDATE

Non-Docs action: Article lifecycle locks（按 article_hash_id 排序）
             -> trash_action / Trash child rows FOR UPDATE
```

Scheduler 可以先无锁读取候选 action ref，但进入领域处理后必须按上述顺序重新加锁、
重新读取并验证 action。不能因为候选扫描时存在就假定它仍然存在。

Tree `base_revision` 不匹配属于业务冲突：整个事务回滚并把最新 revision 返回调用方，
不自动重试。只有 deadlock、serialization failure 等数据库瞬时错误允许有限重试。

恢复最后一个子项和 Scheduler 删除同一 action 时，双方都在 action row lock 下执行
以下条件清理：

```sql
DELETE FROM trash_actions action
WHERE action.id = :action_id
  AND NOT EXISTS (
    SELECT 1 FROM trashed_articles article
    WHERE article.trash_action_id = action.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM trashed_doc_tree_nodes node
    WHERE node.trash_action_id = action.id
  )
```

配合 child FK 的 `ON DELETE RESTRICT`，action 清理不能误删仍存在的 Trash 内容。

## 10. Active Article 读取边界

新增统一 Active scope。所有公开读取默认排除存在 `trashed_articles` 的 logical
Article：

```sql
WHERE NOT EXISTS (
  SELECT 1
  FROM trashed_articles trash
  WHERE trash.community_id = article.community_id
    AND trash.thread = :thread
    AND trash.article_hash_id = article.article_hash_id
)
```

Active scope 是 Article 领域返回的普通 Ecto queryable，先组合再交给现有
`QueryBuilder.filter_pack/2`：

```elixir
Article
|> CMS.Articles.active_scope(thread)
|> QueryBuilder.filter_pack(filter)
```

不要求 `filter_pack` 注入子查询，也不为此重构 QueryBuilder。7.2 中的
`UNIQUE (community_id, thread, article_hash_id)` 同时承担 Active scope 的 lookup
索引。上线前用真实列表查询执行 `EXPLAIN ANALYZE`；只有实际数据证明该索引和
anti-join 不足时，才讨论新的 projection。不能重新增加等价于 `mark_delete` 的
denormalized boolean。

必须覆盖：

- paged Article list；
- Article detail 和 slug/path 读取；
- search；
- pinned、recommended、RSS 和 Feed；
- sitemap 和 SEO；
- Comment 所属 Article 加载；
- GraphQL dataloader；
- 服务端直读和后台 projection。

Trash list 使用独立管理端 query，不允许公共 Article filter 暴露 Trash 状态。

## 11. GraphQL 契约

移除：

```text
markDelete[Thread]
undoMarkDelete[Thread]
batchMarkDelete[Threads]
batchUndoMarkDelete[Threads]
delete[Thread]
```

新增概念契约：

```text
trashArticle
restoreTrashedArticle
permanentlyDeleteTrashedArticle
permanentlyDeleteTrashAction
trashedArticles
trashedArticle
cmsAuditLogs
```

GraphQL 使用 Trash `hash_id`、Article `article_hash_id` 和其他稳定 public ref，
不暴露物理数据库 ID。

Trash Article 返回至少包含：

```text
id
thread
articleRef
article summary
deletedAt
scheduledPermanentDeletionAt
```

`scheduledPermanentDeletionAt` 从所属 `trash_action` 读取，不在每条
`trashed_articles` 重复存储。

详情按需分页加载：

```text
mentions
mentionedBy
```

`cmsAuditLogs` 只对有 Community 管理权限的用户开放。当前最小实现支持分页及按
action、resource type 过滤；actor/source/time range 可在 Audit UI 确认真实需求后增加，
不提前扩展查询基座。

## 12. Mention 契约

沿用现有产品命名：

```text
mentions     = 这篇内容提到了谁
mentionedBy  = 谁提到了这篇内容
```

现有 `ArtimentMention` 已有 `mentioner_snapshot` 和 `mentioned_snapshot`。Mention
创建/同步时生成内容快照；Article 进入 Trash 时只在已有 incoming Mention 的
`mentioned_snapshot` / `meta` 上写入删除状态，不重新解析或重建 Mention。

### 12.1 Article 进入 Trash

- 不删除 Mention 关系；
- Trash list/detail 可按需查询 `mentionedBy { totalCount }`；
- Trash detail 可查询 `mentions` 和 `mentionedBy`；
- 公共 Mention 渲染标题和“已删除”状态；
- 不能通过 Mention 打开 Trash Article 正文；
- Mention picker 不再提供 Trash Article 作为新目标。

### 12.2 Article 恢复

- 不需要重建 Mention；
- 清除 incoming Mention snapshot/meta 上的删除状态，badge 自动消失；
- 原链接重新有效。

### 12.3 Article 永久删除

当前 Mention purge 同时删除两个方向，目标实现必须拆分：

```text
Delete rows where deleted Article is mentioner
Keep rows where deleted Article is mentioned
```

保留行继续使用 `mentioned_snapshot` 渲染标题。永久删除事务必须先更新这些 incoming
Mention 的 snapshot/meta，记录目标已永久删除，再删除 Article aggregate；因此历史
Mention 仍可显示“已删除”。

Audit 不替代 `mentioned_snapshot`。

## 13. Docs Tree Trash

Docs 需要 Article Trash 以外的 Tree 恢复上下文：node type、原 group/tab、原 index、
subtree 和 Tree revision。它继续由 Docs 专属模块负责。

### 13.1 即时删除语义

Trash 不属于 Docs staged publish。用户确认删除后立即修改 draft/public Tree，并让
进入 Trash 的 Article 立即对外不可见：

| 删除前状态           | Trash                                                 | Restore                                     |
| -------------------- | ----------------------------------------------------- | ------------------------------------------- |
| 从未发布             | 保存并删除 draft Tree node；Article 进入 Trash        | 只恢复 draft，仍未公开                      |
| 已发布               | 保存并删除 draft/public Tree node；Article 进入 Trash | 恢复 draft/public，立即恢复删除前的公开状态 |
| 已发布且有未发布修改 | 保存并删除两个 Tree stage；保留 public/draft Doc rows | 恢复两个 Tree stage，保留原有未发布修改     |

public 状态由 `public_snapshot` 是否存在表达。Article aggregate 在软删除期间保持原样，
所以不复制正文，也不额外保存 Article publish/draft 状态。

即时 Trash 使用 Docs 专属入口复用现有 doc-tree lock 和 revision contract；不要把所有
`DocTree.Write.Operation` 改成同时操作两个 stage。普通新增、移动和更新继续保持现有
staged publish 语义，只有 Trash/Restore 处理 draft/public 两个 stage。

### 13.2 Page 和 Link

```text
Page:
trash_action
├─ trashed_doc_tree_node(page; draft/public snapshots)
└─ trashed_article(doc)

Link:
trash_action
└─ trashed_doc_tree_node(link; draft/public snapshots)
```

Page 的 Tree placement 和对应 logical Doc Article 在一个事务中进入 Trash。Link 只
删除 placement，不影响目标 Doc。

外部通用 `trashArticle` 对 `thread = doc` 返回领域错误。Docs Page、Group、Tab 的
入口先取得 Tree revision lock，再调用 Article Trash 的专用 attach 能力；这样通用
Article 生命周期保持可复用，同时不会绕开 Tree 的 draft/public 协调。

### 13.3 Group/Tab

draft/public Tree 可能因为未发布的新增或移动而不同。Docs 模块分别加载删除根节点在
两个 stage 中的 subtree，再按稳定 `node_id` 合并为一组
`trashed_doc_tree_nodes`；不把这套逻辑下沉到通用 Article Trash。

```text
trash_action
├─ trashed_doc_tree_node(each logical node; one or two stage snapshots)
└─ trashed_article(each page-owned Doc that no longer has a surviving draft Page)
```

例如某个 Page 在 public 中仍位于被删 Group，但已经在 draft 中移动到其他 Group：
删除旧 public placement，但保留新的 draft placement，也不把它的 Article 放入
Trash。这个判断基于删除后的 draft Page ownership，不增加新的兼容字段。

Group/Tab 恢复和永久删除仍以 action 为单位原子处理，不能要求用户逐个处理内部页面。

### 13.4 Restore 和 staged events

恢复前一次性检查 Tree revision、父节点、`node_id`、slug/title 和 index 冲突。任一
stage 无法恢复时整个 action 回滚。恢复顺序固定为：

```text
Tab -> Group -> Page / Link / Pin
```

`draft_snapshot` 存在就恢复 draft node；`public_snapshot` 存在就恢复 public node。
随后删除对应 Article Trash membership，并恢复公开 projection。

Trash 时，属于已删除 draft nodes 的 staged Tree events 在保存 snapshot 后丢弃；
Restore 时，Docs 模块比较恢复后的 draft/public snapshots，只重新记录受影响节点仍然
需要的 staged create/move/update events。复用现有 `CMS.DocTree.Events`，不新增通用
Event 恢复框架，也不复用旧 event id。

## 14. Docs Page Duplicate

产品约束：

```text
Page 1:1 Doc Article
Reuse existing Doc in another location = Link
Duplicate Page = new independent Doc copy
```

目标行为：

```text
Original:  node N1 -> doc D1
Duplicate: node N2 -> doc D2

N1 != N2
D1 != D2
```

复制：

- title、subtitle；
- body/document；
- marker、badge 等 Tree 展示配置；
- 生成唯一 slug；
- 创建新的独立 Draft；
- 重新解析复制后的正文，为 D2 生成自己的 `mentions`。

不复制：

- `doc_id`；
- comments、upvotes、reactions；
- Snapshot 和编辑历史；
- public 状态；
- Trash 状态；
- 原 Mention 数据行。

增加数据库约束，禁止同一 Tree scope 内多个 Page 绑定同一个 `doc_id`。完成约束和
数据迁移后删除：

- `unreferenced_doc_ids`；
- “其他 Page 是否仍引用 Doc”的 Trash 判断；
- 多个 Page 共享 Doc 的测试和运行时兼容分支。

一次性迁移已有共享数据：保留一个 Page，其他指向同一 Doc 的 Page 转换为 Link。

## 15. CMS Audit

### 15.1 边界

`CMS.Audit` 记录 CMS 中重要、可追责的领域操作：

```text
article.created
article.published
article.unpublished
article.archived
article.trashed
article.restored
article.permanently_deleted
article.merged

doc_tree.trashed
doc_tree.restored
doc_tree.permanently_deleted

moderation.approved
moderation.rejected

permission.granted
permission.revoked

community.setting_updated
```

第一阶段只需要接入 Trash 相关 action，但表和 API 从一开始保持通用。

不记录：

- 浏览、点赞、收藏等普通用户活动；
- Article 每次自动保存；
- 编辑器每个字段变化；
- CMS Event handler 内部步骤；
- Scheduler 没有产生状态变化的扫描。

### 15.2 与已有模块的边界

```text
Logs.UserActivity
  user interaction/activity surface

CMS.Events
  notification, mention sync and other side-effect dispatch

DocSnapshot
  immutable Doc content revision for diff/restore

DocTreeEvent
  staged Docs Tree domain change for publish/revert

CMS.Audit
  persistent accountability record: who did what to which resource and when
```

### 15.3 模块

```text
CMS.Audit
  record/2
  list/2
  get/1

CMS.Audit.Actions
  action registry and validation

CMS.Model.AuditLog
  persistence schema
```

Audit 记录必须：

- append-only；
- 不允许业务代码 update；
- 不随 Article、User 或 Community 级联删除；
- 不保存正文或可用于恢复的完整内容；
- 与被审计 mutation 同事务写入；
- 对管理端查询提供稳定、可分页的索引。

一次 Docs Tree action 只生成一条顶层 Audit，snapshot 保存 Tree node 和 Article
数量，不为每个 descendant 生成噪声日志。Article membership 的状态、Mention 和统计
仍逐项更新，只抑制重复 Audit。

## 16. 自动永久删除

新增 Scheduler job：

```text
Helper.Scheduler.purge_expired_trash
```

当前每小时第 17 分钟执行；保留周期仍由 action 的时间字段决定：

1. 从 `trash_actions` 查询
   `scheduled_permanent_deletion_at <= DateTime.utc_now()` 的候选 action ref；
2. 每个 action 使用独立事务，并按 9.4 的领域锁顺序重新加锁；
3. `FOR UPDATE` 重新读取 action 和所有当前子项；
4. 永久删除 action 中仍存在的 Article aggregate 和 Tree snapshots；
5. 写入 `article.permanently_deleted` 或 `doc_tree.permanently_deleted` Audit，
   `source = scheduler`；
6. 失败 action 保持原状态，记录错误并在下次任务重试；
7. 成功后清理空 action。

Scheduler 是 at-least-once job，领域 handler 的幂等定义为：

- 加锁后 action 已不存在：视为已完成；
- action 已被恢复或不再到期：不执行删除；
- 同一 action 的删除、Audit 和 action 清理处于同一事务；
- 任一步失败时整个 action 回滚，下次扫描重新处理；
- 已成功提交的 action 不会再次产生 Audit，因为 action 已不存在。

`mentionedBy` 默认不阻止到期自动删除，因为 Mention snapshot 会继续保留历史引用。

## 17. 权限

建议默认策略：

| 操作                               | 权限                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Trash own Article                  | Article owner 或对应 thread 的 `trash` 权限                                                                 |
| Restore Article                    | 对应 thread 的 `restore` 权限                                                                               |
| View community Trash               | 对应 thread 的 `trash` 权限                                                                                 |
| Permanently delete before schedule | 对应 thread 的 `permanent_delete` 权限                                                                      |
| View Audit                         | `audit.read` action；映射到当前社区的 `community.update` grant，Community Root/God 继续按 Passport 规则放行 |
| Automatic permanent deletion       | system actor                                                                                                |

Audit 保存权限判断后的最终事实，不参与权限判断。

## 18. Slug、路径和搜索

Trash 期间保留原 slug 和路径占用，避免其他 Article 抢占后导致恢复冲突。

进入 Trash：

- 公共 path 返回 not found/deleted response；
- 从 search index、RSS、Feed、sitemap、推荐和置顶 projection 移除；
- 已有 Mention 仍通过存储 snapshot 显示“已删除”。

恢复：

- 原 path 重新生效；
- 重建 search/cache/public projections。

永久删除：

- slug 随 Article aggregate 释放；
- Mention snapshot 保留历史标题，不重新开放正文。

## 19. GraphQL 与前端 UI

### 19.1 通用 Trash UI

Post、Blog、Changelog 可复用：

- Trash list；
- Article title/thread/author；
- deleted time；
- scheduled permanent deletion countdown；
- `mentionedBy { totalCount }`；
- Restore；
- Permanently Delete；
- irreversible action confirmation。

Docs 不使用独立 Article Trash 入口或通用单项 Restore，而是继续使用 Tree-aware
Drawer。非 Docs 的共享 Trash 管理 UI 尚未在本次后端切换中实现。

### 19.2 Docs UI

Docs 保留 Tree-aware Drawer：

- Page 显示对应 Article 信息；
- Link、Group、Tab 显示 Tree 信息；
- Group/Tab 只允许整组恢复；
- Tree revision conflict 继续由 Docs 处理；
- action 恢复成功后统一 reload Tree、Trash 和 publish checklist。

### 19.3 Mention UI

- Public Mention target 为 Trash 时显示“已删除” badge；
- 不允许打开 Trash Article 正文；
- Trash list/detail 可查询 `mentionedBy { totalCount }`；
- Trash detail 使用现有 `mentions` 和 `mentionedBy` 命名；
- 永久删除后仍使用 `mentioned_snapshot` 显示最小标题信息。

### 19.4 Audit UI

Audit 管理页面后续支持：

- action；
- actor；
- resource type/ref；
- source；
- time range；
- operation ref。

第一阶段可以只完成后端记录和查询契约，不要求同时完成完整 Audit 页面。

## 20. 单向迁移

项目使用一次性切换，不保留 runtime compatibility。

建议顺序：

```text
Phase 1: Schema
  create trash_actions
  create trashed_articles
  migrate/rename trashed_doc_tree_nodes
  create audit_logs
  add Page-to-Doc uniqueness constraint

Phase 2: Domain services
  add CMS.Audit
  add CMS.Articles.Trash
  add Active Article scope
  split Mention permanent-delete behavior

Phase 3: Docs
  integrate Tree deletion with trash_actions and trashed_articles
  replace draft-only Tree trash snapshot with draft/public snapshots
  stop deleting/copying draft Doc content during soft delete
  make Duplicate Page create independent Doc
  migrate shared Page references to Link
  remove shared-doc compatibility logic

Phase 4: API and frontend
  replace mark-delete GraphQL mutations
  add Trash queries and UI
  add Mention deleted state
  add Audit query contract

Phase 5: Scheduler
  add scheduled permanent deletion job
  add retry/idempotency behavior

Phase 6: Cutover cleanup
  backfill existing mark_delete rows
  switch every read to Active scope
  remove mark_delete functions and fields
  drop mark_delete columns
  remove obsolete tests/mocks/constants
```

Backfill 后不允许 dual read 或 dual write。当前项目未上线，已有本地数据可以一次
迁移到目标结构。

### 20.1 Backfill 取值规则

迁移开始时固定一个 `migration_started_at`，所有派生时间基于该值，不使用 Article
`updated_at` 猜测历史删除时间：

```text
trash_action.deleted_at = migration_started_at
trash_action.scheduled_permanent_deletion_at = migration_started_at + retention_period
trash_action.actor_id = NULL
trashed_article.deleted_at = migration_started_at
trashed_article.deleted_by_id = NULL
audit.source = migration
```

已有 `mark_delete = true` 数据按
`community_id + thread + article_hash_id` 聚合；同一 logical Article 的多个 physical
stage/branch rows 只创建一个 action 和一个 `trashed_articles` row。Audit 使用 system
actor，不能伪造无法恢复的历史用户。

现有 `doc_tree_trash_items` 没有可靠的 action 分组和 public snapshot。当前项目尚未
上线，cutover 时直接清理这些开发期 Trash rows，再切换到新表结构；不为本地历史数据
增加长期兼容或推断逻辑。如果未来面对真实生产数据，再单独设计一次性迁移脚本。

## 21. 主要代码影响范围

Backend：

- `backend/main/lib/groupher_server/cms/articles.ex`
- `backend/main/lib/groupher_server/cms/articles/lock.ex`
- `backend/main/lib/groupher_server/cms/articles/list.ex`
- `backend/main/lib/groupher_server/cms/articles/write.ex`
- `backend/main/lib/groupher_server/cms/artiment_mentions.ex`
- `backend/main/lib/groupher_server/cms/doc_tree.ex`
- `backend/main/lib/groupher_server/cms/doc_tree/write.ex`
- `backend/main/lib/groupher_server/cms/doc_tree/write/trash.ex`
- `backend/main/lib/groupher_server/cms/doc_tree/trash.ex`
- `backend/main/lib/groupher_server/cms/doc_tree/trash_snapshot.ex`（删除）
- `backend/main/lib/groupher_server/cms/model/doc_tree_trash_item.ex`（删除）
- `backend/main/lib/groupher_server_web/schema/helper/mutations.ex`
- `backend/main/lib/groupher_server_web/schema/cms/cms_queries.ex`
- `backend/main/lib/groupher_server_web/schema/cms/cms_types.ex`
- `backend/main/lib/groupher_server_web/resolvers/cms_resolver.ex`
- `backend/main/lib/helper/scheduler.ex`
- `backend/main/lib/helper/query_builder.ex`（只删除 `mark_delete` filter，不新增能力）
- `backend/main/config/config.exs`
- Article product schemas, migrations, Passport actions, factories and tests

New backend boundaries：

- `GroupherServer.CMS.Articles.Trash`
- `GroupherServer.CMS.Audit`
- `GroupherServer.CMS.Audit.Actions`
- `GroupherServer.CMS.Model.TrashAction`
- `GroupherServer.CMS.Model.TrashedArticle`
- `GroupherServer.CMS.Model.TrashedDocTreeNode`
- `GroupherServer.CMS.Model.AuditLog`

本次不增加新的 `Helper.*` 通用边界。领域实现先留在
`CMS.Articles.Trash`、`CMS.Articles.Lock` 和 `CMS.DocTree.Trash`；后续只有在出现多个
稳定复用场景时再讨论下沉。

Frontend：

- dashboard GraphQL schema；
- CMS Article tables and actions；
- Docs SideTree Trash Drawer；
- Mention renderer；
- shared Trash list/item/actions；
- Audit management query/UI boundary。

## 22. 测试清单

### Article Trash

- Post、Blog、Changelog 通过通用入口进入 Trash；Doc 通过 Tree action attach 到同一
  Article Trash service；
- Active list 和 detail 都不可见；
- Trash list 可见；
- Restore 恢复 path、search、cache 和统计；
- 重复 Trash/Restore 幂等；
- scheduled time 正确；
- slug 在 Trash 期间保留；
- Active scope 可以在 `filter_pack` 前组合；
- 并发 Trash/Restore/Permanent Delete 通过 lifecycle lock 串行化；
- 恢复最后一个子项与 Scheduler 并发时不会误删 action 或其他 child。

### Permanent Delete

- 删除完整 Article aggregate；
- 删除 Article-owned joins；
- 不误删 Tag、User、Community 和共享 asset；
- 不重复扣减统计；
- 失败时完整回滚；
- 成功后产品层无法恢复。

### Mention

- Trash 保留 `mentions` 和 `mentionedBy`；
- Trash 只更新已有 Mention snapshot/meta 的删除状态，不重新解析 Mention；
- Public Mention 显示“已删除”；
- Restore 后 badge 消失；
- Permanent Delete 删除 Article 发出的 Mention；
- Permanent Delete 保留其他内容对它的 Mention 和 `mentioned_snapshot`。

### Docs

- Page Trash 同时创建 Tree 和 Article Trash；
- 从未发布 Page 只保存/恢复 draft Tree snapshot；
- 已发布 Page 同时移除/恢复 draft 和 public Tree placement；
- 已发布且有 draft 修改的 Page 在恢复后保留原 draft；
- 软删除不删除 Doc rows 或 ArticleDocument，也不把正文复制进 Tree snapshot；
- Link Trash 不影响目标 Doc；
- Group/Tab 使用一个 trash action；
- Group/Tab 原子恢复；
- Group/Tab 在 draft/public subtree 不同时按 `node_id` 正确合并；
- public 旧位置已删除但 draft 新位置仍存在的 Page 不进入 Article Trash；
- Restore 根据 draft/public 差异重新记录必要的 staged Tree events；
- Tree revision conflict 回滚整个恢复；
- Duplicate Page 创建新的 `doc_id`；
- Duplicate 后两篇 Doc 可独立编辑、发布和删除；
- 数据库拒绝多个 Page 绑定同一 `doc_id`；
- 共享 Page 一次性迁移为 Link。

### Audit

- 重要 mutation 与 Audit 同事务；
- actor、resource、operation 和 source 正确；
- system actor 支持 Scheduler；
- Audit 不随 resource 永久删除；
- Audit 不保存正文；
- Docs subtree 只产生顶层操作日志；
- action registry 拒绝未知 action；
- Audit query 权限和分页正确。

### Scheduler

- 只处理到期记录；
- Link-only Tree action 也能按 action schedule 自动清理；
- 按 trash action 原子处理；
- action 已恢复或不存在时视为幂等 no-op；
- 单个 action 失败不影响其他 action；
- 失败记录可重试；
- system Audit 正确写入。

### Migration

- `mark_delete` Backfill 按 logical Article 去重；
- `deleted_at` 和 scheduled time 使用固定 `migration_started_at`；
- 缺失 actor 使用 system/NULL，不伪造用户；
- cutover 后不存在 dual read、dual write 或 runtime fallback。

## 23. 建议默认值与待确认项

本次实现采用以下默认值：

1. Trash 默认保留 30 天。
2. Slug 在 Trash 期间继续保留。
3. Author 可以 Trash 自己的非 Docs Article；Restore 和提前 Permanent Delete 使用
   独立的 thread 管理权限。
4. `mentionedBy` 不阻止到期自动永久删除。
5. Audit 只保留 actor、action、resource、时间和最小 metadata，不保留正文。
6. 完整 Audit 管理 UI 可以晚于 Audit 后端写入上线。

## 24. 验收标准

重构完成必须满足：

- 所有 Article 表和运行时代码不再包含 `mark_delete`；
- Post、Blog、Changelog 和 Doc 共用一个 Article Trash service；
- Docs Tree 只保留产品专属的结构恢复逻辑；
- Docs Trash 立即同步移除 draft/public placement，并能按删除前 stage 恢复；
- Page 和 Doc 保持一一对应；Duplicate Page 创建独立 Doc；
- Active、Trash 和永久删除三个状态互斥且可证明；
- 所有公共读取都无法绕过 Trash membership；
- Mention 在 Trash 和永久删除后均能正确显示删除状态；
- 自动永久删除可靠、幂等、可重试；
- 重要 Trash 操作拥有不可变 Audit；
- Audit、Snapshot、Domain Event、User Activity 的职责没有重叠；
- 没有为单一 Trash 场景污染 `QueryBuilder`、`Helper.Transaction` 等通用基座；
- 没有 runtime compatibility、dual read 或 dual write 残留。
