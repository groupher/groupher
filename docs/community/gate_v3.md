# Gate V3：Lifecycle、Versioning 与 Docs Release 边界

本文整理 CMS Gate、Article/Doc Lifecycle、内容版本、Docs Tree 版本和 Docs Release 之间的边界。

本文不是对现有 Doc / DocTree 实现的推倒重来方案，而是确定后续实现应该遵守的领域契约。当前系统已经实现的能力，除 Lifecycle 权威需要进一步收敛外，原则上继续保留。

相关文档：

- [Gate V2：统一读取范围与操作准入](./gate_v2.md)
- [Community Lifecycle](./lifecycle.md)

## 1. 结论

### 1.1 Draft 是 Article 的通用能力

Post、Blog、Changelog 和 Doc 都可以拥有 draft。Draft 表示一个可编辑的物理工作副本，不等于资源当前是否已经公开。

普通 Article 同样需要支持以下场景：

- 新建后先保存为 draft；
- 已发布 Article 再次编辑，形成 public + draft；
- 从历史 revision 恢复到 draft；
- 后续定时发布 draft。

因此，Draft、Publish、Revision、Diff、Restore 以及未来的 PublishSchedule，属于 Article Versioning / Publication 的通用能力，不应被设计成只有 Docs 才能使用的能力。

### 1.2 Lifecycle 不等于 Draft/Public Stage

Lifecycle 表示逻辑资源的生命周期状态；`stage` 表示某一条物理内容记录处于 draft 还是 public。

```text
逻辑资源状态：
  ArticleLifecycle / DocLifecycle
  draft_only / published / archived / deleted / destroy

物理内容坐标：
  Article row
  branch + stage(draft/public) + version fields

历史版本：
  ArticleSnapshot
  append-only revision history
```

一个已经发布的 Article 或 Doc 可以同时拥有 public head 和 draft head：

```text
Lifecycle = published
Versioning = public v1 + draft v2
```

所以不能用“是否存在 draft”直接覆盖 Lifecycle，也不能用 Lifecycle 的 `draft_only` 代替版本系统的 draft head。

### 1.3 Doc/DocTree 当前实现与新边界基本兼容

当前实现已经分别承载了：

- Doc 内容的 draft/public head 和 Article Snapshot；
- Docs Tree 的 draft/public projection、staged event 和 tree snapshot；
- Docs 站点级的 publish release 和 published cursor。

这些能力不需要整体重构。真正需要收敛的是：当前 `ArticleLifecycle` 表仍然使用 `thread = :doc` 表示 Doc 的逻辑生命周期；如果正式采用独立 `DocLifecycle`，必须迁移这部分权威，不能让两个 Lifecycle 同时写状态。

## 2. 核心概念

| 概念                | 回答的问题                                | 典型数据                                                    |
| ------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Gate                | 当前 actor 能不能执行这个 action？        | actor、action、resource、ancestor policy                    |
| Resource Lifecycle  | 这个逻辑资源当前处于什么生命周期状态？    | `draft_only`、`published`、`archived`、`deleted`、`destroy` |
| Versioning          | 当前工作副本和公开副本分别是什么？        | branch、stage、draft head、public head                      |
| Revision / Snapshot | 过去某个时刻的内容是什么？                | immutable ArticleSnapshot、DocTreeSnapshot                  |
| Tree Versioning     | Docs 站点导航的 draft/public 结构是什么？ | DocTreeNode、DocTreeEvent                                   |
| Release             | 一次 Docs 站点发布包含哪些内容？          | tree snapshot、article snapshots、tree events               |
| Schedule            | 未来什么时候执行一次发布？                | target revision、publish_at、execution status               |

这些概念可以在一次事务中协作，但不应该共享同一组状态字段。

## 3. Resource Lifecycle

### 3.1 ArticleLifecycle

普通 Article 的 Lifecycle 适用于 Post、Blog、Changelog：

```text
ArticleLifecycle
  draft_only
  published
  archived
  deleted
  destroy
```

它拥有：

- 逻辑 Article 的当前状态；
- 状态转换合法性；
- 并发版本和状态变更时间；
- archive、delete、destroy 等生命周期时间点。

它不拥有：

- 标题、正文和其他内容字段；
- draft/public 物理行；
- branch；
- revision、diff、restore 内容；
- Gate actor 权限；
- public Scope 查询；
- 定时任务执行状态。

当前实现参考：[ArticleLifecycle schema](../../backend/main/lib/groupher_server/cms/model/article_lifecycle.ex)、[Article Lifecycle service](../../backend/main/lib/groupher_server/cms/articles/lifecycle.ex)。

### 3.2 DocLifecycle

Doc 是独立的产品资源。它与普通 Article 共享底层的状态机思想，但不要求共享同一张包含 Docs 专属字段的表。

目标边界：

```text
DocLifecycle
  draft_only
  published
  archived
  deleted
  destroy
```

`draft_only` 的准确含义是“这个逻辑 Doc 从来没有公开版本”：

```text
新建 / 导入 Doc
  docs(stage=draft)              有
  doc_tree_nodes(stage=draft)    可能有
  ArticleSnapshot(stage=draft)   可能有
  docs(stage=public)             没有
  -> DocLifecycle = draft_only
```

第一次发布后：

```text
docs(stage=public) 有
doc_tree_nodes(stage=public) 有
-> DocLifecycle = published
```

已发布 Doc 再次编辑时：

```text
docs(stage=public) + docs(stage=draft)
DocLifecycle 仍然是 published
Versioning 表示存在未发布 draft
```

DocLifecycle 拥有：

- Doc 逻辑资源是否曾经公开；
- Doc 是否可被公共读取；
- archived、deleted、destroy 等资源级状态；
- 状态转换和并发 guard；
- 状态变更的审计关联。

DocLifecycle 不拥有：

- Doc 正文、标题和其他版本字段；
- draft/public stage；
- branch 和 revision；
- tree node、tree event、tree snapshot；
- DocsSiteState；
- DocPublishRelease；
- actor 权限和 Gate policy；
- schedule job。

DocLifecycle 不建议包含 `branch_id`。Branch 属于 Versioning；Lifecycle 表示逻辑 Doc 的资源状态，而不是某个 branch 的工作状态。若未来不同 branch 需要独立的公开结果，应由 branch/version/release 层表达。

### 3.3 `draft_only` 与 `has_unpublished_changes`

两者必须明确区分：

| 状态             | Lifecycle    | Versioning / Site state                  |
| ---------------- | ------------ | ---------------------------------------- |
| 新建但从未发布   | `draft_only` | 有 draft，可能有 draft tree              |
| 已发布且没有修改 | `published`  | public head 等于最新工作状态             |
| 已发布后再次编辑 | `published`  | public + draft，存在 unpublished changes |
| 已归档           | `archived`   | 可能仍保留历史 snapshot                  |
| 已删除           | `deleted`    | 进入 Trash / retention 流程              |

`has_unpublished_changes` 只能由 Versioning 或 Docs Site State 推导，不能反向改变 Lifecycle 的状态。

## 4. Gate 与 Lifecycle 的关系

Gate 和 Lifecycle 是两个正交层次：

```text
Gate
  判断 actor 是否被允许执行 action
  -> access_check / scope

Lifecycle
  判断资源当前状态是否允许发生目标状态转换
  -> transition + lock + version guard
```

典型的发布流程：

```text
Gate.access_check(actor, :publish, resource)
  |
  v
读取并锁定 canonical resource + Lifecycle
  |
  v
Versioning 校验目标 draft / branch / revision
  |
  v
写入 public projection
  |
  v
Lifecycle.transition(:published)
```

Gate 不应该拥有 `draft_only`、`published` 等状态；Lifecycle 也不应该判断 actor 是否为 owner、moderator 或管理员。

公共读取也必须组合两者：

```text
Gate.scope
  -> public Article / Doc stage = public
  -> ArticleLifecycle / DocLifecycle = published or archived
  -> Community public policy
  -> Repo query
```

## 5. Article Versioning

Article Versioning 是 Post、Blog、Changelog、Doc 共享的底层内容能力。

### 5.1 当前共享能力

当前 Article 模型通过以下坐标区分逻辑资源和物理版本：

```text
article_hash_id
  逻辑 Article identity

branch_id
  main / preview 等工作分支

stage
  draft / public

ArticleSnapshot
  immutable checkpoint
```

当前 Doc 也使用这一套底层坐标：[Doc schema](../../backend/main/lib/groupher_server/cms/model/doc.ex)、[ArticleSnapshot schema](../../backend/main/lib/groupher_server/cms/model/article_snapshot.ex)。

### 5.2 Versioning 拥有的动作

Versioning 层负责：

- 创建 draft；
- 编辑 draft；
- 从 public head 创建 draft；
- 创建 checkpoint；
- 计算 diff；
- restore 到 draft；
- fork / promote branch；
- 将目标 draft 发布为 public head。

Versioning 的 publish command 需要调用 Lifecycle transition，但不应该自己成为 Lifecycle 状态的第二个来源。

### 5.3 Restore 不是 Publish

恢复历史 Snapshot 的语义是把历史内容复制到当前 draft：

```text
ArticleSnapshot(v1)
  |
  | restore
  v
current draft
  |
  | publish
  v
public head
```

Restore 不应该直接改变 public 内容，也不应该自动将 Lifecycle 从 `draft_only` 或 `published` 转换为 `published`。

## 6. DocTreeVersioning

Docs Tree 是 Docs 产品独有的导航版本域，不是普通 Article Versioning 的附属字段。

### 6.1 当前职责

`doc_tree_nodes` 使用同一个稳定 `node_id` 表示 draft/public 两套 materialized tree：

```text
doc_tree_nodes(stage=draft)
  |
  | publish selected tree events
  v
doc_tree_nodes(stage=public)
```

`doc_tree_events` 记录可审阅、可选择、可撤销的 tree diff：

- `owner = tree`：由 Tree publish 负责；
- `owner = doc`：由 Doc content publish 触发，例如首次把页面公开到导航树；
- `status = staged / published / reverted / discarded`：事件状态，不是 DocLifecycle 状态。

当前实现参考：[DocTreeNode schema](../../backend/main/lib/groupher_server/cms/model/doc_tree_node.ex)、[DocTreeEvent schema](../../backend/main/lib/groupher_server/cms/model/doc_tree_event.ex)。

### 6.2 Tree 状态不能替代 Doc 状态

以下情况是合法的：

```text
DocLifecycle = published
DocTreeNode(stage=draft) 存在修改
DocTreeNode(stage=public) 仍是旧导航
```

这表示“已发布的 Doc 资源有未发布的导航变化”，不是 Doc 本身退回了 `draft_only`。

同样，Tree event 的 `staged` 只能说明某个 tree diff 尚未进入 public projection，不能说明 Doc 资源从未公开。

## 7. Docs Site State 与 Doc Release

### 7.1 DocsSiteState

`DocsSiteState` 是 Docs 站点或 branch 级别的协调状态，不是单个 Doc 的 Lifecycle：

```text
tree_lock_version
  Tree editor 的并发锁

site_draft_version
  Docs workspace 的 draft 版本

published_version
  最近一次已发布的 site draft version

base_snapshot_id
  staged tree events 所基于的 public tree snapshot

staged_event_count
  站点 dirty state 的快速计数
```

```text
has_unpublished_changes
  = site_draft_version != published_version
```

它表达的是“整个 Docs 站点是否有未发布变化”，不能被用来判断单个 Doc 的 Lifecycle。

当前实现参考：[DocsSiteState schema](../../backend/main/lib/groupher_server/cms/model/docs_site_state.ex)。

### 7.2 DocPublishRelease

`DocPublishRelease` 是一次已完成的 Docs 站点发布历史，不是 DocLifecycle，也不是一个普通 Article 的 publish snapshot。

一次 release 记录：

```text
DocPublishRelease
  -> DocTreeSnapshot
  -> published ArticleSnapshot membership
  -> published DocTreeEvent membership
```

它回答的问题是：

> 这次发布完成后，整个公开 Docs 站点是什么样子？

它不应该拥有正文 JSON 或 Tree JSON 的第二份副本；正文和 Tree 内容分别由 ArticleSnapshot、DocTreeSnapshot 保存，Release 只做跨域锚点和 membership。

当前实现参考：[DocPublishRelease schema](../../backend/main/lib/groupher_server/cms/model/doc_publish_release.ex)、[Docs publish orchestrator](../../backend/main/lib/groupher_server/cms/doc_tree/publish.ex)。

### 7.3 Publish 与 Release 的区别

```text
Article publish
  一个 Article draft -> 一个 public head

Doc content publish
  一个 Doc draft -> 一个 public head
  可能同步 public tree shell

Docs release
  一组 Doc content publish
  + 一组 Tree changes
  + 一个完整的 public tree snapshot
  -> 一个站点级发布历史
```

普通 Article 不需要因为支持 draft/publish 而引入 Docs Release。Release 是 Docs 站点组合发布的产品能力。

## 8. 当前 Doc / DocTree 发布链路

当前实现的职责分工可以表达为：

```text
Gate
  |
  v
CMS.DocTree.Publish.publish_changes
  |
  +-- 选择 Doc / Tree checklist
  |
  +-- DocPublisher
  |     +-- docs draft -> docs public
  |     +-- ArticleSnapshot(action=publish)
  |     +-- ArticleLifecycle -> published
  |     +-- public ancestors / page shell
  |
  +-- PublicProjection
  |     +-- draft tree -> public tree
  |     +-- staged tree events -> published
  |
  +-- DocTreeSnapshot
  |
  +-- DocPublishRelease
        +-- article snapshot membership
        +-- tree event membership
        +-- DocsSiteState published cursor
```

这条链路已经接近目标结构：

```text
Gate
  -> DocLifecycle
  -> DocVersioning
  -> DocTreeVersioning
  -> DocRelease
```

但这不是要求 `DocLifecycle` 直接调用 `DocRelease`。这些模块由 Docs publish orchestrator 在同一个发布事务中组合；各自仍只修改自己拥有的事实。

## 9. Lifecycle 表的设计与迁移边界

### 9.1 当前设计

当前 `cms.article_lifecycles` 是一张按 `community_id + thread + article_hash_id` 唯一定位的通用 Lifecycle 表：

```text
article_lifecycles
  community_id
  thread(post/blog/changelog/doc)
  article_hash_id
  state
  version
  changed_at
  archived_at / deleted_at / destroyed_at
```

它没有 branch、stage、revision、tree、release 字段，因此普通 Article 没有被迫承担 Docs 的 Versioning 或 Release 复杂度。

### 9.2 目标选择

有两种可行方案：

#### 方案 A：继续使用统一表

保留 `ArticleLifecycle(thread=:doc)`，但在代码和文档中把它视为 DocLifecycle 的当前实现。

适用条件：

- Doc 和普通 Article 的资源级状态机长期一致；
- Doc 不需要额外的生命周期字段；
- 产品更看重少一次表迁移。

优点是当前代码改动最小。缺点是产品边界通过 `thread` 隐藏，后续 Doc 专属状态容易继续堆进通用模块。

#### 方案 B：DocLifecycle 独立表

将普通 Article 和 Doc 的 Lifecycle 拆成两个资源域：

```text
article_lifecycles
  post / blog / changelog

doc_lifecycles
  doc
```

两张表可以共享相同的底层 Lifecycle 协议和状态转换工具，但不能互相成为状态来源。

如果采用方案 B，`doc_lifecycles` 仍只保存 Doc 资源状态，不复制 Versioning、Tree 或 Release 字段。迁移属于局部 Lifecycle authority migration，不是 Doc/DocTree 全量重构。

### 9.3 推荐

短期不修改当前 Doc/DocTree 表结构；先固定以下约束：

1. `ArticleLifecycle(thread=:doc)` 是当前 Doc Lifecycle 的唯一事实来源；
2. 不新增第二个 DocLifecycle 状态表并行写入；
3. Doc 专属状态或字段出现前，再决定是否执行方案 B；
4. 无论方案 A 还是 B，Versioning、TreeVersioning、Release 都不搬进 Lifecycle 表。

如果确认 Docs 会继续发展独立的页面状态、文档可见性和站点发布策略，则在增加更多 Doc 专属逻辑前执行方案 B，避免把迁移成本继续扩大。

## 10. 普通 Article 的定时发布

定时发布暂不实现，但边界必须预留。

定时发布不能把 `scheduled` 直接加进 ArticleLifecycle 或 DocLifecycle。Lifecycle 表示资源状态，Schedule 表示未来的一次执行意图。

目标结构：

```text
PublishSchedule / PublicationIntent
  target_type(article / doc / docs_site)
  target_id
  branch_id
  target_revision or snapshot_id
  publish_at
  status(pending / canceled / executed / failed)
```

执行流程：

```text
Job reaches publish_at
  -> 重新执行 Gate/access_check
  -> 锁定 Lifecycle 和目标 Version
  -> 验证 target revision 仍然有效
  -> 调用正常 publish command
  -> Lifecycle transition
  -> 标记 Schedule executed
```

对于普通 Article，Schedule 指向一个 Article revision 或 draft head。

对于 Docs，未来更可能是站点级 Schedule：它指向某个 Docs branch、选定的内容和 Tree changes，最终仍走正常的 Docs publish/release 流程，而不是分别修改每个 DocLifecycle。

## 11. 是否需要重构当前实现

结论分为两层：

### 不需要重构的部分

- `docs` 的 draft/public head；
- `ArticleBranch`；
- `ArticleSnapshot`；
- `doc_tree_nodes` 的 draft/public projection；
- `doc_tree_events`；
- `DocTreeSnapshot`；
- `DocsSiteState`；
- `DocPublishRelease` 及其 membership。

这些表和模块已经分别承担了 Versioning、TreeVersioning、Site State 和 Release 的职责。

### 需要收敛的部分

- 明确 `draft_only` 是资源从未公开，不是当前没有 draft；
- 明确普通 Article 也拥有 draft 和 `draft_only`；
- 禁止用 stage、tree event 或 site dirty state 替代 Lifecycle；
- 禁止 Gate 和 Lifecycle 互相承担对方的职责；
- 决定是否把 `thread=:doc` 从通用 ArticleLifecycle 中抽出；
- 如果抽出，迁移唯一状态权威，不做双写。

### 未来采用独立 DocLifecycle 时的迁移顺序

```text
1. 定义 DocLifecycle 的状态和唯一身份
2. 从 article_lifecycles(thread=doc) backfill doc_lifecycles
3. 切换 Doc create/import/draft/publish/trash 的读写入口
4. 切换 Doc Gate scope/access_check 的 Lifecycle 来源
5. 验证 public read、publish、restore、delete、import
6. 移除 ArticleLifecycle 对 thread=doc 的支持
```

迁移期间不得让 ArticleLifecycle 和 DocLifecycle 根据不同规则分别判断 public visibility。

## 12. 验收原则

后续实现或评审可以用以下问题判断边界是否被破坏：

1. 这个字段描述的是资源状态、物理版本、Tree 变化、站点发布，还是一次未来任务？
2. 这个状态是否会被普通 Article 使用？如果会，是否应该放在共享 Versioning，而不是 Docs 模块？
3. 这个状态是否需要 actor 才能判断？如果需要，应由 Gate 负责，而不是 Lifecycle。
4. 这个状态是否只表示某次内容快照？如果是，应由 Snapshot/Revision 负责。
5. 这个状态是否描述整个 Docs 站点？如果是，应由 DocsSiteState/DocPublishRelease 负责。
6. 是否出现了两个模块都能决定 public visibility 或 Lifecycle state 的情况？如果是，必须收敛为唯一权威。

本文当前结论：保留已实现的 Doc / DocTree Versioning 和 Release；先不做全量重构；在继续增加 Doc 专属生命周期能力前，完成 `ArticleLifecycle(thread=:doc)` 与独立 `DocLifecycle` 之间的最终选择。
