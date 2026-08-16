# Gate V3：Article Core 与 Doc Release 边界

本文定义 CMS Gate、普通 Article、Doc 内容版本和 Docs Release 的边界。

本文同时区分当前实现和目标实现。目标迁移不考虑历史数据，不保留旧模型的兼容读写，不做双表双写。实现应直接收敛到目标结构，不通过通用抽象把 Doc 专属能力重新暴露给普通 Article。

相关文档：

- [Gate V2：统一读取范围与操作准入](./gate_v2.md)
- [Community Lifecycle](./lifecycle.md)

## V3 与 Gate V2 的优先级

Gate V2 继续是 Gate 的通用接口和准入契约来源：

- `Gate.scope/3-4`；
- `Gate.access_check/3`；
- `Gate.Decision`；
- Community、Comment 和通用 action policy。

Gate V3 覆盖 V2 中与 Article / Doc 内容版本和发布边界有关的部分：

- V2 §3.3.1 的 Article draft、branch、snapshot 设计：普通 Article 不再拥有 Branch / Snapshot，只有 Doc 保留；
- V2 §5.2 的 Document Scope ownership：Document 改为 `DocBranch + DocLifecycle`；
- V2 §7.4 的 Document action matrix：保留 action 和两层 Gate 检查，但 Lifecycle 来源改为 DocLifecycle；
- V2 §10.2 的 ArticleLifecycle backfill 判定：被 V3 的“无历史回填、直接切换目标结构”取代，旧的 public head/archive 优先级不再适用；
- V2 §12 中涉及 ArticleLifecycle、`thread = :doc`、ArticleBranch/ArticleSnapshot 和 Document action matrix 的验收项：分别改由 V3 的 Article Core、DocLifecycle、DocBranch/DocSnapshot 和 Doc Gate 验收项取代；
- V2 中把 `ArticleBranch`、`ArticleSnapshot` 当作普通 Article 基础能力的验收条目。

V2 §12 中纯 Gate API、Decision、Reader/Writer、Scope ownership 和通用测试要求继续有效；其中涉及 Article/Doc Versioning、Lifecycle 或 `thread = :doc` 的条目以 V3 为准。两份文档冲突时，以 V3 的 Article / Doc Versioning、Lifecycle、Trash、Restore 和 Release 定义为准。

## 1. 结论

### 1.1 普通 Article 的 Public + Draft 已落地

普通 Article 的目标能力是：

- 创建和编辑 Draft；
- 授权团队查看当前 Draft；
- 比较当前 Draft 与 Public；
- 显式 Publish Draft；
- 使用 ArticleLifecycle 表达资源级状态。

当前 Post / Blog / Changelog 的编辑路径是：

```text
ensure_from_public
  -> 创建或更新持久化 Draft
  -> Public 保持不变
  -> 显式 Publish
  -> 同一事务内删除已发布 Draft
```

因此普通 Article 和 Doc 都可以在显式 Publish 前保留 Public + Draft 两条物理记录；普通 Article 不需要 Branch 或 Snapshot。

```text
当前实现：
  Post / Blog / Changelog
                  编辑后持久化 Draft，等待显式 Publish
  Doc             按 branch 持久化 Public + Draft，并由 Docs 发布编排
```

团队 Draft 读取使用 `:read_draft` Gate action；Article-level `has_unpublished_changes` 由 `DraftDiff.has_unpublished_changes/3` 派生，不物化额外事实表。

### 1.2 Article Core 的最小共享能力

Post、Blog、Changelog 的共同能力固定为：

```text
Article Draft
  -> DraftRead
  -> DraftDiff
  -> Publish
  -> Public
```

普通 Article 不拥有：

- Branch、Preview Branch；
- Fork / Promote；
- ArticleSnapshot；
- 普通 Article 历史版本；
- Docs Tree、Docs Site State、Docs Release。

已发布 Article 再次编辑时，目标状态允许同时存在 Public 和 Draft。这不需要 Branch 或 Snapshot。

当前 [Publish](../../backend/main/lib/groupher_server/cms/articles/publish.ex) 仅在 `:doc` 分支解析 `DocBranch` 并创建 `DocSnapshot`；Post、Blog、Changelog 只写 ArticleLifecycle 和 Public/Draft 行。

### 1.3 DraftDiff 是所有 Article 的基础能力

目标 DraftDiff 比较当前可编辑 Draft 与当前 Public head：

```text
Public head
     |
     | DraftDiff
     v
Current Draft
```

DraftDiff 是临时计算，不创建历史 Snapshot，也不依赖 Branch 或 Release。

`CMS.Articles.DraftDiff` 负责所有 Article 的 Draft/Public 比较；`CMS.Articles.Diff` 保留为 DocSnapshot 与 DocSnapshot / 当前 Doc 与 DocSnapshot 的历史差异工具，两者不混用。

### 1.4 Doc 保留完整的 Docs 专属发布链路

Doc 复用 Article Core 的 Draft、DraftRead、DraftDiff 和 Publish，但额外拥有：

- `DocBranch`：Docs workspace / 发布分支；
- branch-scoped `DocLifecycle`：某个 Doc 在某个 branch 上的资源状态；
- `DocSnapshot`：Doc 内容的不可变发布版本；
- `DocTreeNode`、`DocTreeEvent`、`DocTreeSnapshot`：导航树版本；
- `DocsSiteState`：站点级未发布变化和发布游标；
- `DocPublishRelease`：一次站点发布的跨域锚点。

Doc 的完整链路是：

```text
DocBranch
  -> DocLifecycle(branch)
  -> Doc Draft / Public
  -> DraftDiff
  -> DocTree Draft Events
  -> DocsSiteState
  -> DocTree.Publish
  -> DocSnapshot + DocTreeSnapshot
  -> DocPublishRelease
```

这条链路是 Doc 的产品复杂度，不应下沉到普通 Article，也不应通过新的总括性 Versioning 抽象隐藏两条链路的差异。

### 1.5 Lifecycle 方案直接选择 B

既然 `DocBranch` 是正式的 Docs workspace，Doc 的 Lifecycle 必须从一开始按 branch 识别。非 main branch 可以在 Dashboard 内独立完成 branch 内发布，供团队内部读取；公共 URL、Press、Feed 和匿名 public Scope 永远只读取 main branch：

```text
ArticleLifecycle
  post / blog / changelog

DocLifecycle
  community_id + branch_id + article_hash_id
```

不再把 `thread = :doc` 留在 `ArticleLifecycle` 中，也不再把 A/B 选择推迟到增加更多 Doc 字段之后。否则未来 branch 独立发布时仍然必须进行同等级的 Lifecycle 迁移。

`DocLifecycle` 只负责资源级状态，不拥有 Draft、Snapshot、Tree、Site State 或 Release 字段。

`DocLifecycle(branch) = published` 只表示该 branch 内部已经发布，不等于公共站点可见。公共可见性由 public Scope 的 main branch policy 决定。

任何 branch 内的 Doc Publish 都是该 branch 的内部发布：写入该 branch 的 `DocPublishRelease`，并推进同一 branch 的 `DocsSiteState` published cursor。只有 main branch 的 Release 才能被公共 URL、Press、Feed 或匿名 public Scope 读取；非 main branch 的 Release 只供 Dashboard 团队内部读取。

## 2. 核心概念

| 概念              | 所属           | 负责回答的问题                                 |
| ----------------- | -------------- | ---------------------------------------------- |
| Gate              | 共享准入层     | 当前 actor 能否执行 action？                   |
| ArticleLifecycle  | 普通 Article   | Post / Blog / Changelog 资源当前处于什么状态？ |
| DocLifecycle      | Doc            | 某个 Doc 在某个 branch 上处于什么状态？        |
| Draft / Public    | Article 内容层 | 当前可编辑内容和公开内容分别是什么？           |
| DraftDiff         | Article 内容层 | 当前 Draft 相比 Public 改了什么？              |
| DocBranch         | Doc            | 这份 Doc 属于哪个 Docs workspace？             |
| DocSnapshot       | Doc            | 某次 Doc 发布时的不可变内容是什么？            |
| DocTreeVersioning | Doc            | Docs 导航树的 Draft/Public 结构是什么？        |
| DocsSiteState     | Docs 站点      | 整个 Docs workspace 是否有未发布变化？         |
| DocPublishRelease | Docs 站点      | 一次站点发布包含哪些内容？                     |
| PublishSchedule   | 未来能力       | 未来什么时候执行一次正常 Publish？             |

这些概念可以在一个事务中协作，但不共享不属于自己的状态字段。

## 3. Lifecycle

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
- archive、delete、destroy 等资源级时间点。

`destroy` 是 Article Lifecycle 的通用终态转换，普通 Article 和 Doc 都使用
同一语义。`permanently_delete` 在事务内先完成 `transition(:destroy)`，再清理
完整 aggregate 并删除对应的 Lifecycle 行；因此 Lifecycle 行不作为永久删除后的
墓碑保留，长期操作审计由 AuditLog 承担。删除后重新使用同一 identity 会创建新的
Lifecycle。

它不拥有：

- 标题、正文和其他内容字段；
- Draft/Public 物理行；
- Branch；
- Snapshot、Diff、Restore 内容；
- Gate 权限判断；
- Schedule 执行状态。

### 3.2 DocLifecycle

DocLifecycle 的唯一身份是：

```text
community_id + branch_id + article_hash_id
```

状态仍然是：

```text
draft_only
published
archived
deleted
destroy
```

`draft_only` 表示这个 Doc 在这个 branch 上从未公开，不表示当前没有 Draft。

Doc 与普通 Article 一样使用 `destroy` 作为永久删除前的终态转换。Doc 的
`permanently_delete` 在完成 aggregate 清理后删除 branch-scoped `DocLifecycle` 行；
`destroyed_at` 不作为删除后的长期 Lifecycle 记录。

DocLifecycle 不拥有：

- Doc 正文、标题和其他内容字段；
- Draft/Public stage；
- DocSnapshot；
- DocTreeNode、DocTreeEvent、DocTreeSnapshot；
- DocsSiteState；
- DocPublishRelease；
- actor 权限和 Gate policy；
- Schedule job。

### 3.3 `draft_only` 与未发布修改

两者必须区分：

| 场景             | Lifecycle    | 内容状态                           |
| ---------------- | ------------ | ---------------------------------- |
| 新建但从未发布   | `draft_only` | 有 Draft，无 Public                |
| 已发布且没有修改 | `published`  | Public 与 Draft 相同，或没有 Draft |
| 已发布后再次编辑 | `published`  | Public + Draft，存在未发布变化     |
| 已归档           | `archived`   | 由资源状态控制访问                 |
| 已删除           | `deleted`    | 进入 Trash 流程                    |

不能用 Draft 是否存在直接替代 Lifecycle，也不能用某条代表行的 `stage` 推断资源是否曾经公开。

### 3.4 `has_unpublished_changes` 的事实来源

Article-level `has_draft` 和 `has_unpublished_changes` 是两个不同事实，均不物化，也不放进 Lifecycle：

```text
has_draft
  = 是否存在持久化 Draft

has_unpublished_changes
  = Draft 是否与 Public 内容不同
```

目标语义：

```text
没有持久化 Draft
  -> has_draft = false
  -> has_unpublished_changes = false

有 Draft 且 Draft 与 Public 内容相同
  -> has_draft = true
  -> has_unpublished_changes = false

有 Draft 且 Draft 与 Public 内容不同
  -> has_draft = true
  -> has_unpublished_changes = true
```

`has_unpublished_changes` 的查询先使用 `body_hash` 和版本字段 fingerprint 做快速路径，再在必要时计算完整 DraftDiff。`body_hash` 只覆盖正文，fingerprint 还必须包含 title、slug、subtitle、digest 等版本字段。

建议由 `DraftDiff.has_unpublished_changes/3` 提供统一查询 API。普通 Article 和 Doc 都使用内容层结果；Doc 站点是否 dirty 还要叠加 Tree event 和 DocsSiteState。

“相同内容的 Draft 不算未发布变化”是刻意语义；团队仍然可以通过 `has_draft` 看到并审阅这个 Draft。两个状态不能合并成一个 Boolean。

普通 Article 已通过同一 DraftDiff API 提供该事实；Doc 站点级 dirty 仍需叠加 Tree event 和 DocsSiteState。

## 4. Gate 与 Lifecycle

Gate 和 Lifecycle 是正交层次：

```text
Gate
  判断 actor 是否被允许执行 action
  -> access_check / scope

Lifecycle
  判断资源当前状态是否允许发生目标状态转换
  -> transition + lock + version guard
```

普通 Article 的 Publish 流程：

```text
Gate.access_check(actor, :publish, resource)
  -> 锁定资源与对应 Lifecycle
  -> 校验目标 Draft
  -> 写入 Public projection
  -> Lifecycle.transition(:published)
```

Doc 的 Publish 需要两层准入：

```text
Gate.access_check(actor, :manage_docs, community)
  -> Docs workspace / checklist 准入
  -> 选择 Doc 和 Tree changes
  -> Gate.access_check(actor, :publish, draft)
  -> Draft -> Public
```

`:manage_docs` 是 Community / Docs workspace 级管理权限；`:publish` 是当前 Draft 的资源级发布权限。两者不能互相替代。

团队读取当前 Draft 使用显式的 `:read_draft` action：

```text
Gate.access_check(actor, :read_draft, draft)
  -> policy_mode: :owner_management
  -> stage: draft
  -> Doc 还必须带显式 branch_id
```

`:read_draft` 是所有 Article 的共享授权读取能力；`:read` 只覆盖 Public，不得隐式授予 Draft 可见性。`moderator_management` 和 `operations` 可以作为同一 action 的更高权限 policy mode，但不新增平行动作。

Gate 不拥有 `draft_only`、`published` 等状态；Lifecycle 也不判断 actor 是否为 owner、moderator 或管理员。

Gate scope 必须是两条明确路径：

```text
Article scope
  -> 普通 Article + ArticleLifecycle

Doc scope
  -> Doc + DocBranch + DocLifecycle
  -> 按需加入 DocTree / DocsSiteState
```

当前 `lifecycle_scope/2` 无条件 join `ArticleLifecycle`，因此不能只在调用点切换参数；需要改造 scope 编译器本身。不要通过条件 join、union 或 view 保留双 Lifecycle 来源。

Doc Scope 的 branch 必须来自显式 policy context，不由 scope compiler 猜测或调用 `Branch.resolve`：

```elixir
# Public URL / Press / Feed
%{thread: :doc, stage: :public, branch_id: main_branch_id, policy_mode: :public}

# Dashboard 团队读取指定 workspace
%{thread: :doc, stage: :draft, branch_id: editor_branch_id, policy_mode: :owner_management}

# 跨社区的公共聚合读取或维护任务
%{thread: :doc, stage: :public, branch_policy: :main, policy_mode: :public}
```

规则：

- `context.branch_id` 是查询目标的 canonical id，不是“它已经是 main branch”的可信证明；
- public policy 编译为对 `DocBranch` 的 join，并在查询中断言 `doc_branch.type == :main`。因此 scope compiler 不执行 Repo、不主动查询 branch，也不需要在编译期把非 main 判定为异常；调用方执行返回的 query 后，非 main 输入自然得到空 public scope。缺失 `branch_id` 仍然是 `:scope_context_missing`，除非使用显式的 `branch_policy: :main`；
- 跨社区的公共聚合读取和维护任务可以显式使用 `branch_policy: :main`。例如没有固定 Community 的公共 Doc 列表可以使用它；这不是单 Community 请求的隐式 fallback；
- Dashboard 的 management policy 必须显式传入 branch，可读取被授权 workspace 的 Draft 或 branch 内 Public；
- Scope compiler 只消费 canonical `branch_id` 并编译 join，不执行 Repo、不解析 slug，也不取得 advisory lock；
- Draft read 和 Public read 是不同的 stage + branch policy，不能共用隐式 main fallback；Draft read 必须经过 `:read_draft`。

## 5. Article Core

### 5.1 普通 Article 的物理模型

Post、Blog、Changelog 只用 `stage` 区分 Draft 和 Public：

```text
article_hash_id
  逻辑 Article identity

stage
  draft / public
```

普通 Article 不保留 `branch_id`。因此普通 Article 的唯一约束也不再以 branch 为维度。

Doc 保留自己的 `branch_id`，但它属于 Doc 模型和 Doc 相关表，不属于普通 Article 基础模型。

### 5.2 Article Core API

目标 Article Core 只提供：

- `Draft.create`：创建 Draft；
- `Draft.update`：编辑 Draft；
- `Draft.read`：读取 Draft；
- `Draft.read_editor`：主编辑视图优先 Draft，否则读取 Public；
- `DraftDiff`：比较 Draft 与 Public；
- `Publish`：把 Draft 发布为 Public。

Draft 的并发契约由 Article Core 统一提供：

- 每个 Draft 行有单调递增的 `version` integer，创建时为 `1`；
- `Draft.read` / `Draft.read_editor` 返回当前 `version`；
- `Draft.update` 必须携带 `expected_version`，只允许在版本匹配时写入并递增 `version`；
- 更新行数为 `0` 时返回 `:draft_conflict`，不得静默覆盖其他团队成员的更新；
- Article Lock 只负责串行化事务，不能替代这个 optimistic version guard；
- `schema_version` 和 Snapshot 的 `revision_number` 不得复用为 Draft 并发 token。

普通 Article 的公开编辑必须停止调用“更新后立即 Publish”的路径。编辑和 Publish 是两个独立命令：

```text
edit Article
  -> 持久化 Draft

publish Article
  -> Draft -> Public
  -> 事务完成后删除已发布 Draft
```

团队查看当前 Draft 是 Article Core 的授权读取能力，不是 Changelog 或 Doc 的专属能力；其 Gate 契约固定为 `Gate.access_check(actor, :read_draft, draft)` + `policy_mode: :owner_management`。

如果普通 Article 和 Doc 复用字段复制逻辑，只提取无状态的字段复制函数；不要重新建立可选 Branch 的通用 Versioning facade。

### 5.3 Restore 不是 Publish

普通 Article 不支持历史 Snapshot restore。Doc 的 Snapshot restore 只把内容恢复到 Draft：

```text
DocSnapshot
  -> current Doc Draft
  -> DraftDiff
  -> normal Doc Publish
```

Restore 不直接修改 Public，也不自动把 Lifecycle 转换为 `published`。

## 6. Doc Content Versioning

### 6.1 DocBranch

`DocBranch` 只属于 Docs：

```text
Community
  -> DocBranch(main / preview / workspace)
  -> DocLifecycle(branch)
  -> Doc Draft / Public
```

它不包含 Article thread，也不负责普通 Article。Doc Tree、Doc 内容和 Docs Site State 都通过 `DocBranch` 定位 workspace。

### 6.2 DocSnapshot

`DocSnapshot` 是 Doc 发布时创建的不可变内容版本：

- 记录某次发布的 Doc 内容；
- 供 `DocPublishRelease` 引用；
- 支持 Doc 内容恢复到 Draft；
- 不参与普通 Article 的编辑和 Diff。

`DocSnapshot` 不等于当前 Draft。当前编辑差异始终由 DraftDiff 计算。

## 7. DocTreeVersioning

Docs Tree 是 Docs 产品独有的导航版本域：

```text
doc_tree_nodes(stage=draft)
  -> publish selected tree events
  -> doc_tree_nodes(stage=public)
```

`DocTreeEvent` 记录可审阅、可选择、可撤销的树结构变化：

- `owner = tree`：Tree publish 负责；
- `owner = doc`：Doc content publish 触发，例如页面首次公开到导航树；
- `staged / published / reverted / discarded`：事件状态，不是 DocLifecycle 状态。

以下状态是合法的：

```text
DocLifecycle(branch) = published
DocTreeNode(stage=draft)       有修改
DocTreeNode(stage=public)      仍是旧导航
```

这表示已发布的 Doc 有未发布导航变化，不表示 Doc 回到了 `draft_only`。

## 8. DocsSiteState 与 DocPublishRelease

### 8.1 DocsSiteState

`DocsSiteState` 是 Docs workspace 级别的协调状态：

```text
tree_lock_version
site_draft_version
published_version
base_snapshot_id
staged_event_count
```

站点级 `has_unpublished_changes` 不物化，直接由站点状态和 staged event 推导：

```text
site_draft_version != published_version
  或存在 staged tree event
  或存在 Doc content draft 差异
```

它不能代替单个 Doc 的 DocLifecycle，也不能决定单个 Doc 是否从未公开。

### 8.2 DocPublishRelease

`DocPublishRelease` 按 `(community_id, branch_id)` 记录 branch-local 发布历史。任何 branch 内的 Publish 都创建该 branch 的 Release，并引用该 branch 的站点状态和快照：

```text
DocPublishRelease
  -> branch_id
  -> DocTreeSnapshot
  -> DocSnapshot memberships
  -> DocTreeEvent memberships
```

它回答的问题是：

> 这次 branch 内发布完成后，该 branch 的 Docs workspace 是什么样子？

Release 不重复保存正文 JSON 或 Tree JSON；正文由 DocSnapshot 保存，树结构由 DocTreeSnapshot 保存，Release 只做跨域锚点和 membership。

只有 main branch 的 Release 属于公共发布历史；非 main branch 的 Release 和 `DocsSiteState.published_version` 只供 Dashboard 团队读取，不产生公共 URL、Press 或 Feed 可见性。

### 8.3 Publish 与 Release 的区别

```text
普通 Article Publish
  一个 Draft -> 一个 Public

Doc content Publish
  一个 Doc Draft -> 一个 Doc Public
  可能同步 Public tree shell

Docs Release
  一组 Doc content publish
  + 一组 Tree changes
  + 一个完整的 Public tree snapshot
  -> 一个站点级发布历史
```

普通 Article 不因为支持 Draft / Publish 而引入 Release。

## 9. 当前 Doc 发布链路

当前 [DocTree.Publish](../../backend/main/lib/groupher_server/cms/doc_tree/publish.ex) 是 Docs 编排入口，底层已经使用 DocBranch、DocLifecycle 和 DocSnapshot：

```text
Gate.access_check(:manage_docs, community)
  -> 解析 DocBranch
  -> 加载 DocLifecycle(branch)
  -> 读取 Doc / Tree checklist
  -> 选择 Doc 与 Tree changes
  -> Gate.access_check(:publish, draft)
  -> 发布 Doc Draft
  -> 写入 DocSnapshot
  -> 应用 Tree events
  -> 写入 DocTreeSnapshot
  -> 创建当前 branch 的 DocPublishRelease
  -> 更新当前 branch 的 DocsSiteState published cursor
```

DocTree.Publish 的编排顺序不需要增加新的通用 Versioning 层；需要替换的是 Branch、Lifecycle、Snapshot 的所有权和调用入口。

## 10. 直接重构步骤

本次不考虑历史数据，不保留兼容读写，不做双表双写。旧表、旧列、旧模块和旧 API 直接移除或改名。
以下按实际实施顺序记录目标结构切换；步骤 1–11 已完成，不是待办清单。历史命名收口见 §11。

### 步骤 1：先实现普通 Article 的持久化 Draft

对 Post、Blog、Changelog：

1. 移除公开编辑路径中“更新 Draft 后立即 Publish”的调用；
2. 编辑命令只创建或更新持久化 Draft；
3. Draft 更新必须携带 `expected_version`，冲突时返回 `:draft_conflict`；
4. Publish 命令单独读取 Draft 并写入 Public；
5. Publish 成功后在同一事务内删除已发布 Draft；
6. 提供团队授权读取当前 Draft 的 API；
7. 提供 Draft/Public 的 DraftDiff 查询。

验收时必须确认普通 Article 的 Public + Draft 和 `has_unpublished_changes` 均由上述持久化 Draft 链路提供。

### 步骤 2：简化普通 Article schema 和 Publish

对 Post、Blog、Changelog：

1. 移除 `branch_id` 和 branch 外键；
2. 将每个普通 Article 表的唯一约束改为 `(community_id, article_hash_id, stage)`；
3. 移除 `Branch.resolve` 对普通 Article 的调用；
4. 普通 Publish 不再创建 ArticleSnapshot；
5. 普通 Publish 返回 Article，而不是 Snapshot membership；
6. 移除普通 Article 的 Snapshot、Preview、Fork、Promote API。

### 步骤 3：将 Branch 和 Snapshot 直接收归 Doc

直接改名并替换所有调用：

```text
ArticleBranch       -> DocBranch
CMS.Articles.Branch -> CMS.Docs.Branch 或 Doc Tree 内部 Branch API

ArticleSnapshot       -> DocSnapshot
CMS.Articles.Snapshot -> CMS.Docs.Snapshot
```

同步更新：

- Doc schema；
- DocTreeNode、DocTreeEvent、DocTreeSnapshot；
- DocsSiteState；
- DocPublishRelease；
- DocTree reader、writer、import、trash、publish；
- Press 中 Doc 相关查询；
- DocPublishReleaseArticle 的 Snapshot 外键；
- 对应测试和数据库外键、索引。

`DocBranch` 删除 `thread` 字段和普通 Article 的 branch 校验。`DocSnapshot` 只保留 Doc 发布需要的字段。

### 步骤 4：建立 branch-scoped DocLifecycle 和 Doc Trash membership

创建 `doc_lifecycles`，唯一身份为：

```text
community_id + branch_id + article_hash_id
```

`doc_lifecycles` 不包含 `thread`，也不与 `article_lifecycles` 共享唯一约束。

Doc Trash 采用独立 membership，不把 branch 语义塞进普通 `TrashedArticle`：

```text
TrashedDocArticle
  trash_action_id
  community_id
  branch_id
  article_hash_id
  restore_state
  deleted_at
```

唯一约束为：

```text
(community_id, branch_id, article_hash_id)
```

同一 Doc 在不同 branch 被删除时可以拥有多条 membership。每条 membership 的 `restore_state` 都是该 branch 删除前的 Lifecycle 状态。普通 Article 继续使用不带 branch 的 `TrashedArticle`。

TrashAction 的批量编排必须同时识别三类 child：`TrashedArticle`、`TrashedDocArticle` 和 `TrashedDocTreeNode`。`action_has_other_children?`、`delete_empty_action`、restore 和 permanent-delete 都必须覆盖三类 membership，并按 membership 类型和 id 排除当前 child，不能假设三张表共享同一个 id 空间。

然后直接切换 Doc 的：

- create / import；
- Draft create / update / read；
- Doc publish；
- Doc Tree trash / restore；
- DocTree Reader 和 Press public scope；
- Doc Gate scope；
- Doc-specific lifecycle audit。

迁移期间不允许 ArticleLifecycle 和 DocLifecycle 双写或按不同规则判断 public visibility。

### 步骤 5：完整处理 `thread = :doc` 和 maintenance 调用点

需要切换为 Doc API 的范围包括：

- `Articles.Trash` 中 Doc 的 delete / restore / destroy transition；
- `DocTree.Trash` 和 `TrashedDocTreeNode` 的生命周期转换；
- Content Import Doc writer / validator；
- `Articles.Publish` 的 Doc 分支；
- Press 的 Doc public scope；
- DocTree Reader 的 Gate scope 和 lifecycle scope；
- `Articles.States.archive/1` 中旧 ArticleLifecycle 的 `ensure_thread_backfill`；Doc archive 必须改为 branch-scoped `DocLifecycle.archive_before`；
- archive、import、maintenance jobs 和 batch command；
- DocSnapshot、DocPublishRelease 相关查询；
- 测试、factory 和 seed 中的 lifecycle 调用。

以下 `:doc` 可以继续存在，因为它们表达的是数据格式或产品 thread，而不是 Lifecycle 权威：

- ArticleDocument 的文档格式标识；
- BodyBag 的 Doc 内容校验；
- Search、Comment、Mention 等产品 thread 标识。

这一步不是局部改名，而是一次完整的 Doc Lifecycle authority cutover。

### 步骤 6：清理 ArticleLifecycle 的 Doc 数据和 enum

Lifecycle 调用点切换完成后，按以下顺序清理旧来源：

```text
1. 确认没有 Doc 代码再读取或写入 ArticleLifecycle
2. 清理 article_lifecycles 中 thread = :doc 的行
3. 移除 ArticleLifecycle 唯一约束中的 Doc 语义
4. 从 Ecto.Enum 和 PG enum 移除 :doc
5. 移除 ensure_thread_backfill(:doc) 和 ArticleLifecycle 的 archive_before(:doc)；Doc 的 archive_before 保留在 DocLifecycle，并按 branch 执行
```

若数据库仍存在 `thread = :doc` 行，不能直接执行 PG enum 的 `DROP VALUE`。本次不做历史回填或兼容窗口；目标数据库必须先完成 Doc lifecycle 清理，再删除 enum value。

### 步骤 7：改造 Gate scope 编译器

将当前无条件 join `ArticleLifecycle` 的共享 scope 拆成：

```text
Article scope
  -> ArticleLifecycle

Doc scope
  -> DocBranch
  -> DocLifecycle
```

Scope compiler 的输入约定是：面向单个 Community 的 Doc 请求必须提供 `context.branch_id`；Public scope 会 join `DocBranch` 并在 SQL 中过滤 `type = :main`，而不是把调用方传入的 id 当作 main 的证明；Dashboard management scope 接受调用方已解析且已授权的 branch。跨社区的公共聚合读取或维护任务可以传 `branch_policy: :main`，由编译器按每个 Article 所属 Community join main branch；`Articles.List` 在没有固定 Community 的公共 Doc 列表中属于这一类。branch slug 到 canonical id 的解析属于 Reader/service policy，不属于 Scope compiler；单个请求缺少 `branch_id` 不得默认回退到 main。

因此 public scope 的 main 校验属于查询语义：compiler 只负责编译 `DocBranch` join/WHERE，Repo 只在调用方最终执行 query 时运行。若 service 需要把非法 context 立即报告为 policy error，可以在调用 Scope 前做显式的 branch policy 校验，但这不是 compiler 的职责。

不要使用条件 join、union、view 或兼容窗口来保留两套 Lifecycle 来源。代码和 schema 应在同一目标结构下直接切换。

### 步骤 8：同步调整 Lock 维度

Lifecycle 身份和 mutation lock 必须使用同一粒度：

```text
普通 Article
  article_lifecycle:community:thread:article_hash_id

Doc branch
  doc_lifecycle:community:branch_id:article_hash_id
```

Doc Draft、Doc Publish、Doc Tree Trash 和 Doc restore 都必须使用 branch-scoped lock。现有 branch-independent Lock 是为旧的 Fork / Promote 设计的，不能继续作为 Doc branch 的唯一锁。

若未来存在跨 branch 操作，必须按稳定排序获取多个 branch lock；不能退回到一个不带 branch 的全局 Article lock。

### 步骤 9：保存 Trash 的恢复来源

`restore_state/1` 不得再从代表 Article 行的 `stage` 推断恢复状态。

删除时必须先读取 Lifecycle 状态并保存到 Trash membership：

```text
读取 ArticleLifecycle / DocLifecycle
  -> TrashedArticle.restore_state 或 TrashedDocArticle.restore_state
  -> Lifecycle.transition(:deleted)
```

恢复时：

```text
读取 restore_state
  -> Lifecycle.transition(restore_state)
  -> 恢复内容 / Tree 到 Draft
  -> 可选的正常 Publish
```

`TrashedDocArticle` 必须携带 `branch_id`，避免跨 branch 恢复到错误的 Lifecycle。Doc Tree node 删除是 branch-local 操作，不得复用另一 branch 的 Trash membership。

Restore 不是 Publish，也不能因为代表行当前是 Draft 就把已发布资源恢复成 `draft_only`。

### 步骤 10：清理普通 Article Preview Branch 能力

普通 Article 移除 Branch 后，必须同步移除：

- `CMS.Articles.fork_preview/5`；
- `CMS.Articles.promote_preview/5`；
- 对应 GraphQL mutation、resolver、input、payload 和生成类型；
- Post、Blog、Changelog 的 Preview Branch 前端入口；
- 相关测试、factory 和文档。

Content Import 的临时 preview、未保存内容的临时渲染预览和独立路由预览不属于 Preview Branch，可以按各自领域继续保留。

### 步骤 11：最后处理 Schedule 语义

普通 Article 没有 Snapshot，因此普通 Schedule 指向当前 Draft 和版本 token，而不是“Article revision”：

```text
Schedule reaches publish_at
  -> 校验 Gate 和 ArticleLifecycle
  -> 确认目标 Draft 仍然有效
  -> normal Publish
  -> mark Schedule executed
```

Doc Schedule 如果指向 `DocSnapshot`，必须先：

```text
DocSnapshot
  -> restore to Doc Draft
  -> normal Doc Publish
```

当前 `Publish.publish` 只接受 Draft，因此“从 Snapshot 发布”必须明确为 restore-to-draft 后再 Publish，不能把 Restore 隐藏在 Publish 内部。

## 11. V3 完成后的历史命名与文档清理

本节是目标结构切换完成后的收口工作，不是兼容层，也不是历史数据迁移。清理直接针对当前运行时代码、GraphQL schema、前端类型和当前设计文档执行；不保留旧 alias、旧 API 或双写路径。

本节在步骤 1–11 的功能迁移全部合入并通过对应功能验证后执行，作为独立的历史清理 commit 完成。它不是前置兼容层，也不应无限期推迟；步骤 1–11 完成后即进入本节收口。

### 11.1 运行时命名收口

以下名称已经不再表达当前产品边界，当前运行时已统一为 Doc 专属命名：

```text
cms/articles/snapshot.ex       -> cms/docs/snapshot.ex
model/article_snapshot.ex      -> model/doc_snapshot.ex

article_branch_type             -> doc_branch_type
article_branch_status           -> doc_branch_status
ARTICLE_BRANCH_TYPE             -> DOC_BRANCH_TYPE
ARTICLE_BRANCH_STATUS           -> DOC_BRANCH_STATUS

article_snapshot_action         -> doc_snapshot_action
ARTICLE_SNAPSHOT_ACTION         -> DOC_SNAPSHOT_ACTION
ArticleSnapshot                 -> DocSnapshot
TArticleSnapshot*               -> TDocSnapshot*
```

本次同步清理的运行时契约包括：

- `CMS.Const`、DocBranch、DocSnapshot、Gate Scope、Press 和 DocTree 调用点；
- GraphQL 的 `:article_branch_type`、`:article_branch_status`、`:article_snapshot`、`:article_snapshot_stage` 和 `:article_snapshot_action`；Doc 相关类型统一改为 `:doc_branch_type`、`:doc_branch_status`、`:doc_snapshot`、`:doc_snapshot_stage` 和 `:doc_snapshot_action`，普通 Article Draft 使用共享的 `:article_stage`。修改 schema、query / mutation 和 enum 后，立即运行 `yarn graphql:codegen`，同步更新 `frontend/core/lib/graphql/generated`（包括 `graphql.ts` 等生成文件），再执行 GraphQL contract/generated checks；
- Doc 查询、mutation、resolver、测试和前端生成类型必须作为同一个收口步骤验收；
- RevisionDrawer、DiffStatus 等只服务 Docs 的前端类型；
- `DocPublishRelease`、DocTree Publish 和 change detection 中把 DocSnapshot 集合称为 `article_snapshots` 的局部变量和注释；
- `Articles.Publish` 中仍声称普通 Article 会创建 Snapshot 的 moduledoc 和 typespec。普通 Article 的返回值应表达为 `DocSnapshot.t() | nil`，而不是声称所有 Article 都有 Snapshot。

普通 Article 只保留 Article Core 的 Draft、Public、Stage 和 DraftDiff 命名，不因为清理 Branch / Snapshot 而删除 `ARTICLE_STAGE`、`TArticleStage` 或 `draft/public`。

### 11.2 当前文档与历史设计文档

以下文档仍大量描述已被 V3 取代的通用 Article Branch / Snapshot 设计：

- `docs/article_versioning.md`；
- `docs/docs_rename_refactor_plan.md`；
- `docs/doc_id_unification_plan.md`；
- `docs/bulk-import/article_publish_import_refactor.md`；
- `docs/community/gate_v2.md` 中被 V3 覆盖的章节；
- `docs/press/v1.md` 中仍把 DocSnapshot 写成 ArticleSnapshot 的部分。

处理规则：

1. 仍有历史参考价值的方案文档，在开头标记为 `superseded by Gate V3`，明确不再作为实现和验收依据；
2. 仍属于当前 source of truth 的 Gate、Press 和操作文档，直接改成 `DocBranch`、`DocSnapshot` 和 `DocLifecycle`；
3. `gate_v2.md` 保留 Gate 通用 API、Decision、Reader/Writer 和 Scope 契约，但其 Article / Doc Versioning、`thread = :doc` 和旧 Document action matrix 以 V3 为准；
4. V3 本身只保留当前契约。历史方案可以被引用来解释迁移原因，但不能用当前时态描述已删除的 ArticleBranch / ArticleSnapshot 能力。

### 11.3 不属于本次 V3 历史清理的内容

以下内容不能因为名称相似而删除或改写：

- `CMS.Snapshot`：这是展示数据 shadow refresh 服务，后续按独立的 `CMS.Snapshot -> CMS.ShadowSync` 命名迁移处理；
- Trash Audit 中表示 payload 的 `article_snapshot/2`：它不是 DocSnapshot 模型；
- `priv/repo/migrations` 中的历史 migration 文件名、旧表名和旧 constraint 名称；
- 已应用数据库中的历史 schema 标识，除非另有明确的数据迁移方案；
- Article Core 的 `stage`、Draft、Public 以及相关 `ArticleStage` 类型。

### 11.4 历史清理完成标准

历史清理完成后：

1. 当前运行时的 Doc Branch / Doc Snapshot API 不再暴露 `ArticleBranch` / `ArticleSnapshot` 旧名称；
2. GraphQL schema、前端生成类型和 Docs UI 使用同一套 `Doc*` 命名；
3. 普通 Article 运行链路不依赖 Branch 或 DocSnapshot；
4. 当前设计文档不会把旧通用 Versioning 设计写成现行契约；
5. 历史 migration 和独立的 `CMS.Snapshot` 服务没有被误删。

## 12. 验收原则

Article/Doc Lifecycle 之外的 upvote、emotion、collect mutation admission 不由本 V3 另建协议；它们
继续遵守 Gate V2，并按 [Artiment reactions v3](../artiment/reactions_v3.md) 补齐 Article action
matrix、祖先 Lifecycle 检查和同事务 fact/projection 写入。普通 Article 与 Doc Lifecycle 的拆分不得
产生两套 interaction Gate 路径。

### 当前实现状态

步骤 1–11 及历史命名收口已按本文目标结构实现，并由 Article Draft/Publish、DraftDiff、Doc Lifecycle/Trash、Gate Scope、Doc Release、GraphQL codegen 和全量后端测试共同验证。当前不再把以下能力标记为待实现：

1. 普通 Post / Blog / Changelog 的持久化 Public + Draft 双 head；
2. 普通 Article 的团队 Draft 读取和 `:read_draft` Gate action；
3. 普通 Article 的 Article-level `has_unpublished_changes`；
4. 普通 Article 的 Draft/Public DraftDiff；
5. 普通 Article 不创建 DocSnapshot；
6. Doc 使用独立 DocBranch、DocLifecycle、DocSnapshot、Doc Trash 和 branch-scoped Release。

### 重构完成后的验收

1. 普通 Article 不查询或写入 DocBranch、DocLifecycle、DocSnapshot、DocTree 或 Docs Release。
2. 普通 Article 编辑后能持久化 Draft，Publish 前 Public 不变。
3. 普通 Article Publish 成功后才删除 Draft。
4. 普通 Article 的 DraftDiff 只比较 Draft 与 Public，不依赖 Snapshot。
5. `DraftDiff.has_unpublished_changes/3` 是 Article-level 事实的唯一查询入口，结果不物化。
6. 团队查看当前 Draft 是所有 Article 的共享授权读取能力，统一通过 `Gate.access_check(actor, :read_draft, draft)`，默认 policy mode 为 `:owner_management`；普通 `:read` 不授予 Draft 可见性。
7. 已发布 Article 再次编辑时，Lifecycle 仍是 `published`，同时存在 Public + Draft。
8. `draft_only` 只表示对应资源和 branch 从未公开。
9. DocLifecycle 按 `community_id + branch_id + article_hash_id` 唯一定位。
10. Gate 负责 actor 权限；Lifecycle 负责资源状态；DraftDiff 负责当前内容差异；TreeVersioning 负责导航树；Release 负责站点发布锚点。
11. Restore 使用 Trash 保存的删除前状态，不从代表行 stage 推断 Lifecycle。
12. Restore 不直接 Publish；Schedule 从 Snapshot 执行时必须先 restore-to-draft。
13. Doc Trash membership 按 `(community_id, branch_id, article_hash_id)` 唯一定位，普通 Article Trash 不携带 branch。
14. Doc mutation lock 按 branch 定位；跨 branch 操作必须显式获取多个排序后的 lock。
15. `article_lifecycles` 不再保留 Doc rows，ArticleLifecycle 和 PG enum 都不再接受 `:doc`。
16. `Articles.States.archive(:doc)` 不再执行 ArticleLifecycle 的 `ensure_thread_backfill` 或 `archive_before`；它遍历所有 `status == :active` 的 DocBranch，并对每个 branch 调用 branch-local 的 `DocLifecycle.archive_before`。
17. Doc Publish 同时满足 `:manage_docs` workspace 准入和 `:publish` Draft 准入。
18. 普通 Article 的 Preview Branch、Fork、Promote API、GraphQL 和前端入口同步移除；非 Branch 预览能力单独判断。
19. 不保留旧模块、旧字段、旧 API 的兼容写法，不做 ArticleLifecycle / DocLifecycle 双写。
20. 不引入新的总括性 `ArticleVersioning`、`DocVersioning` 或可选 Branch 抽象来隐藏两条链路的差异。
21. Public Doc Scope 永远只读取 main branch；Dashboard 团队读取必须显式提供已授权的 `branch_id`。
22. Draft 更新使用 `expected_version` 做 optimistic guard，冲突不得 last-write-wins。
23. TrashAction 的 child 判断、空 action 清理、restore 和 permanent-delete 覆盖 `TrashedDocArticle`。
24. Post、Blog、Changelog 的唯一约束明确为 `(community_id, article_hash_id, stage)`。
25. Public Doc Scope 通过 `DocBranch` join/WHERE 强制 `type = :main`；Scope compiler 不执行 Repo，branch policy context 的解析和 query 执行由调用方负责。
26. 每个 branch 内的 Doc Publish 都创建 branch-local `DocPublishRelease` 并推进同一 branch 的 `DocsSiteState` published cursor；只有 main branch Release 对公共 URL、Press、Feed 和匿名 public Scope 可见。
27. 普通 Article 和 Doc 的 `permanently_delete` 都先转换到 `destroy`，完成 aggregate 清理后删除 Lifecycle 行；不引入 recreate、generation 或兼容状态。

本文最终边界：普通 Article 是简单的 Draft/Public 内容流；Doc 在复用 Article Core 的基础上，独立承担 branch-scoped Lifecycle、Snapshot、Tree 和 Release 的组合发布复杂度。
