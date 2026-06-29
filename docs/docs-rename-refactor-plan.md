# Doc Editor Rename & Refactor Plan

---

## 架构目标

```
                 内容 (Content)                             树 (Tree)

  Layer 1    ┌──────────────────┐              ┌──────────────────────┐
  Workspace  │ ArticleWorkspace │              │     DocTreeNode      │
  (可编辑)   │  stage: draft    │              │    stage: draft      │
             │  (review 可选)   │              │                      │
             └────────┬─────────┘              └──────────┬───────────┘
                      │ publish                           │ publish
                      ▼                                   ▼
  Layer 2    ┌──────────────────┐              ┌──────────────────────┐
  Runtime    │ docs + DocDocument│              │   DocTreeNode        │
  (source    │  source of truth │              │  stage: public       │
   of truth) │  线上读直接 serve │              │  公共树 serve 层      │
             └────────┬─────────┘              └──────────┬───────────┘
                      │                                   │
                      │ publish 时同步写 snapshot          │ publish 时同步写 snapshot
                      ▼                                   ▼
  Layer 3    ┌──────────────────┐              ┌──────────────────────┐
  History    │ ArticleSnapshot  │              │   DocTreeSnapshot    │
  (不可变    │  stage:          │              │    tree_json         │
   历史证据) │    draft | public│              │    tree_hash         │
             └──────────────────┘              └──────────────────────┘
                      │                                   │
                      └─────────┬─────────────────────────┘
                                │ 交叉引用
                                ▼
                     ┌──────────────────────┐
                     │   PublishRelease     │
                     │  tree_snapshot_id ───┼──▶ DocTreeSnapshot（单向 FK）
                     │  release_number      │
                     │  ├─ release_articles │──▶ ArticleSnapshot
                     │  └─ release_events   │
                     └──────────────────────┘
```

**关键原则**：

- **Workspace**：只表达当前编辑区，`stage` 只有 `draft`（未来可加 `review`），**不持有 `public` 镜像**
- **Runtime 层**：`docs` + `DocDocument`、`DocTreeNode(stage=public)` 是线上 source of truth，public 读直接查这里。简单、稳定、可独立演进
- **Snapshot 表**：不可变历史证据。`stage: draft` = 编辑存档点，`stage: public` = 记录「这次 publish 时的样子」。不参与 public serve，仅用于 diff / rollback / release 审计
- **PublishRelease**：发布锚点，将 tree snapshot + N 个 article snapshot + tree events 绑成一个原子发布单元。本身不存内容数据，是跨 snapshot 表的索引。单向 FK：`PublishRelease.tree_snapshot_id` → `DocTreeSnapshot`，snapshot 不反查 release。
- **Diff**：内容 = `ArticleWorkspace(draft)` ↔ `latest ArticleSnapshot(public)`；树 = `DocTreeNode(draft)` 构建的树 ↔ `DocTreeSnapshot.tree_json`。
  - **边界**：如果从未 publish（无 latest public snapshot / 无 tree snapshot），diff 判定为 **全量新建**，不是普通内容 diff。
- **Rollback**：选 release → 取 snapshots → 写回 `docs` + `DocDocument` + `DocTreeNode(public)` → 生成新的 public snapshots + release
- **branch / version** 字段加在 workspace、runtime、snapshot 三层，直接自然扩展

### 数据真相源约定

同一份 doc JSON 会出现在多张表里，但它们不是同一个职责层的真相源：

```
Draft current truth
  ArticleWorkspace.json
       │ checkpoint / publish
       ▼
History evidence
  ArticleSnapshot.document_json

Public current truth
  docs + DocDocument.json
       │ publish creates immutable evidence
       ▼
History evidence
  ArticleSnapshot(stage=public).document_json

Release ledger
  PublishRelease
       ├─ tree_snapshot_id ─▶ DocTreeSnapshot.tree_json
       ├─ release_articles ─▶ ArticleSnapshot
       └─ release_events   ─▶ PublishReleaseTreeEvent
```

- Draft 当前内容只以 `ArticleWorkspace.json` 为准。
- Public 当前内容只以 `docs` + `DocDocument.json` 为准。`ArticleSnapshot` 不参与 public serve。
- History / rollback / diff 只读 `ArticleSnapshot` 与 `DocTreeSnapshot`。
- `PublishRelease` 只做发布锚点和索引，不存正文 JSON，也不存 `tree_json`。
- `markdown` / `html` / `xml` / `rss` / `plain_text` / `digest` / `content_hash` 都是由 `ContentPipeline` 从 JSON 派生出的缓存字段，不是新的真相源。

---

## 一、Rename 清单（命名修正）

### 1. 最终核心模型 & 表

| # | 最终名称 | 位置 | 说明 |
|---|----------|------|------|
| 1 | `ArticleWorkspace` 模块 / `article_workspaces` 表 | `cms/model/article_workspace.ex` | draft 当前编辑区 |
| 2 | `ArticleSnapshot` 模块 / `article_snapshots` 表 | `cms/model/article_snapshot.ex` | article 内容历史证据 |
| 3 | `DocTreeSnapshot` 模块 / `doc_tree_snapshots` 表 | `cms/model/doc_tree_snapshot.ex` | tree 历史证据 |
| 4 | `DocDocument` 模块 / `doc_documents` 表 | `cms/model/doc_document.ex` | docs runtime 内容缓存 |

> `DocContent` 已改名为 `DocDocument`，与 `PostDocument` / `BlogDocument` / `ChangelogDocument` 命名对齐。
> 若从旧模型迁移，真实 diff 是 `ArticleVersion` → `ArticleWorkspace`、`ArticleRevision` → `ArticleSnapshot`、`DocTreeRevision` → `DocTreeSnapshot`、`DocContent` → `DocDocument`。

### 2. 最终 FK 字段命名

| # | 表 | 最终字段 | 指向 | 说明 |
|---|-----|----------|------|------|
| 5 | `doc_tree_nodes` | `workspace_id` | ArticleWorkspace | draft page 指向 workspace；public page 用 `doc_id` |
| 6 | `doc_tree_trash_items` | `workspace_id` | ArticleWorkspace | docs trash 语境内不需要 `article_` 前缀 |
| 7 | `doc_tree_events` | `workspace_id` | ArticleWorkspace | doc-owned event 绑定的 workspace |
| 8 | `doc_tree_events` | `snapshot_id` | DocTreeSnapshot | event 被发布进哪个 tree snapshot |
| 9 | `publish_release_articles` | `snapshot_id` | ArticleSnapshot | release article 子表只引用 article snapshot |
| 10 | `article_snapshots` | `workspace_id` | ArticleWorkspace | draft snapshot 指向 workspace；public snapshot 指向 `article_id` |
| 11 | `publish_releases` | `tree_snapshot_id` | DocTreeSnapshot | 必须保留 `tree_`，release 还通过子表关联 article snapshots |
| 12 | `docs_site_states` | `base_snapshot_id` | DocTreeSnapshot | 必须保留 `base_`，表示 staged changes 的基线（从 doc_tree_draft_states 搬来） |
| 13 | `publish_requests` | `base_snapshot_id` | DocTreeSnapshot | 必须保留 `base_`，表示 request/review 的基线 |

> **命名约定**：DB column / Ecto schema 用 `snake_case`；GraphQL / JSON payload / frontend store 用 `camelCase`。

### 2b. FK 迁移对照

| # | 表 / 位置 | 旧名 | 新名 |
|---|-----------|------|------|
| M1 | `doc_tree_nodes` | `article_workspace_id` | `workspace_id` |
| M2 | `doc_tree_trash_items` | `article_workspace_id` | `workspace_id` |
| M3 | `doc_tree_events` | `binding_workspace_id` | `workspace_id` |
| M4 | `doc_tree_events` | `published_snapshot_id` | `snapshot_id` |
| M5 | `publish_release_articles` | `article_snapshot_id` | `snapshot_id` |
| M6 | `article_snapshots` | `article_workspace_id` | `workspace_id` |
| M7 | GQL / JSON draft tree node | `docId` | `workspaceId` |
| M8 | GQL / JSON article snapshot | `articleWorkspaceId` | `workspaceId` |

> `publish_releases.tree_snapshot_id`、`docs_site_states.base_snapshot_id`、`publish_requests.base_snapshot_id` 不是冗余命名，不参与去前缀。

### 3. Ecto Schema 自身字段

| # | 表 | 字段 | 语义 |
|---|-----|------|------|
| 14 | `article_snapshots` | `snapshot_number` | 保留。同一 article 的 snapshot 线性序号（per-article，非全局） |
| 15 | `doc_tree_snapshots` | `snapshot_number` | 删除。与 `PublishRelease.release_number` 永远 1:1，用 release_number 即可（见 R9 定案） |

> `ArticleSnapshot.snapshot_number` 是同一 article 维度的递增序号，不是 community 全局序号。用于排序同一 article 的 checkpoint / publish 历史。
>
> `DocTreeSnapshot` 不需要自身序号：每次 publish 都创建 DocTreeSnapshot（即使本次无 tree changes），直接关联 `PublishRelease.release_number`。

### 4. 最终 Ecto belongs_to 关联

| # | 模型 | 最终关联 |
|---|------|----------|
| 16 | `DocTreeNode` | `belongs_to(:workspace, ArticleWorkspace)` |
| 17 | `DocTreeTrashItem` | `belongs_to(:workspace, ArticleWorkspace)` |
| 18 | `DocTreeEvent` | `belongs_to(:workspace, ArticleWorkspace)` |
| 19 | `DocTreeEvent` | `belongs_to(:snapshot, DocTreeSnapshot)` |
| 20 | `PublishReleaseArticle` | `belongs_to(:snapshot, ArticleSnapshot)` |
| 21 | `PublishRelease` | `belongs_to(:tree_snapshot, DocTreeSnapshot)` |
| 22 | `DocsSiteState` | `belongs_to(:base_snapshot, DocTreeSnapshot)` |
| 23 | `ArticleSnapshot` | `belongs_to(:workspace, ArticleWorkspace)`（draft snapshot 指向 workspace） |

### 5. Counter 字段 — 合并收敛

当前两个 per-community 单例表分工边界模糊，但两个 counter 的职责不同：tree lock 只管树操作冲突，site draft version 只管站点级 dirty。合并收益来自表结构简化，不来自强行合并计数器。

```
docs_site_states                      (合并后，删除 doc_tree_draft_states 表)
  tree_lock_version    integer       ← 只随 tree mutation +1，用于 baseRevision 冲突检测
  site_draft_version   integer       ← 所有 docs draft 变更 +1，用于 site-level dirty 检测
  published_version    integer       ← publish 完成时 = site_draft_version
  base_snapshot_id     FK → DocTreeSnapshot  ← 从 doc_tree_draft_states 搬过来
  staged_event_count   integer       ← 从 doc_tree_draft_states 搬过来
  last_published_at   utc_datetime
  last_published_by_id
```

**三层 dirty 检测**：
| 粒度 | 检测方式 |
|------|---------|
| tree conflict | `client.baseRevision == docs_site_states.tree_lock_version` |
| site-level | `site_draft_version != published_version` |
| tree-level | `staged_event_count > 0` |
| page-level | per-article snapshot/hash diff |

**关键约束**：publish 完成时在同一事务里更新 `base_snapshot_id` / `staged_event_count` / `last_published_*`；只有发布后 plan 已清空时才设置 `published_version = site_draft_version`。部分发布后不能推进 `published_version`，否则 site-level dirty 会被误判为干净。当前 publish 只更新了 tree draft state，没更新 site publish counter，这是旧模型半截子工程，一并修。

### 6. GraphQL 类型 & 枚举

| # | 最终名称 / 字段 | 说明 |
|---|-----------------|------|
| S1 | `object :article_snapshot` | ArticleSnapshot GQL 类型 |
| S2 | `enum :article_snapshot_stage` | values: `draft`, `public` |
| S3 | `field(:stage, :article_snapshot_stage)` | snapshot 生命周期阶段 |
| S4 | `field(:snapshot_number, :integer)` on `ArticleSnapshot` | 保留，per-article 线性序号 |
| S5 | `DocTreeSnapshot` 不暴露 number | tree 序号从 `PublishRelease.releaseNumber` 取 |

> 注：所有 item 编号为 section-local 阅读辅助，不要求全局唯一。

### 7. GraphQL Query Fields

| # | 改前 | 改后 |
|---|------|------|
| 30 | `field :doc_draft_revisions, list_of(:article_snapshot)` | `field :doc_draft_snapshots, list_of(:article_snapshot)` |
| 31 | `field :doc_draft_revision, :article_snapshot` | `field :doc_draft_snapshot, :article_snapshot` |
| 32 | `arg(:snapshot_id, non_null(:id))` | `arg(:snapshot_id, non_null(:id))` |

### 8. GraphQL Mutation Fields

| # | 改前 | 改后 |
|---|------|------|
| 33 | `field :checkpoint_doc_draft_revision, :article_snapshot` | `field :checkpoint_doc_draft_snapshot, :article_snapshot` |
| 34 | `field :restore_doc_draft_revision, :doc_draft` | `field :restore_doc_draft_snapshot, :doc_draft` |
| 35 | `arg(:snapshot_id, non_null(:id))` | `arg(:snapshot_id, non_null(:id))` |

### 9. GQL 类型上的 FK 字段

| # | 类型 | 字段 | 说明 |
|---|------|------|------|
| 36 | `doc_tree_state` | `base_snapshot_id` | 保留，表示 staged changes 的基线 |
| 37 | `doc_tree_state` | `latest_snapshot_id` | 保留，指向当前最新的 `DocTreeSnapshot` |
| 38 | `doc_tree_state` | `latest_snapshot_number` | 删除（DocTreeSnapshot 无自身序号，用 release_number） |
| 39 | `doc_tree_state` | `latest_release_number` | 如果 UI 需要展示树当前发布序号 |
| 40 | `doc_tree_state` | `latest_release_id` | 可选，便于从 tree state 跳到 release 详情 |

> `latest_snapshot_id` 保留，指向当前最新的 `DocTreeSnapshot`。数字序号不要挂在 snapshot 上；如果前端需要显示发布序号，读取 `latest_release_number`，语义来自 `PublishRelease.release_number`。

### 10. Backend Resolver Functions

| # | 改前 | 改后 |
|---|------|------|
| 39 | `doc_draft_revisions/3` | `doc_draft_snapshots/3` |
| 40 | `doc_draft_revision/3` | `doc_draft_snapshot/3` |
| 41 | `checkpoint_doc_draft_revision/3` | `checkpoint_doc_draft_snapshot/3` |
| 42 | `restore_doc_draft_revision/3` | `restore_doc_draft_snapshot/3` |

### 11. Public API 函数

| # | 位置 | 改前 | 改后 |
|---|------|------|------|
| 43 | `CMS.Articles` | `list_doc_draft_revisions/3` | `list_doc_draft_snapshots/3` |
| 44 | `CMS.Articles` | `get_doc_draft_revision/3` | `get_doc_draft_snapshot/3` |
| 45 | `CMS.Articles` | `checkpoint_doc_draft_revision/3` | `checkpoint_doc_draft_snapshot/3` |
| 46 | `CMS.Articles` | `restore_doc_draft_revision/3` | `restore_doc_draft_snapshot/3` |

### 12. Business Logic Module & Functions

| # | 文件 | 改前 | 改后 |
|---|------|------|------|
| 47 | `cms/articles/revision.ex` | Module `Articles.Revision` | Module `Articles.Snapshot` |
| 48 | 同上 | `get_article_workspace_revision/3` | `get_article_workspace_snapshot/3` |
| 49 | 同上 | `revision_attrs_from_article_workspace/4` | `snapshot_attrs_from_article_workspace/4` |
| 50 | 同上 | `revision_attrs_from_article/3` | `snapshot_attrs_from_article/3` |
| 53 | 同上 | `match_revision_target/2` | `match_snapshot_target/2` |
| 54 | 同上 | `latest_revision/2` | `latest_snapshot/2` |
| 55 | 同上 | `trim_revisions_after_restore/3` | `trim_snapshots_after_restore/3` |
| 56 | 同上 | `trim_published_revisions_after_restore/2` | `trim_published_snapshots_after_restore/2` |
| 57 | 同上 | `article_workspace_revisions_query/1` | `article_workspace_snapshots_query/1` |
| 58 | 同上 | `get_doc_draft_revision/3` | `get_doc_draft_snapshot/3` |
| 59 | 同上 | `revision_content_hash/2` | `snapshot_content_hash/2` |

### 12b. Business Logic 函数名中残留的 `version` 清理

> 模型名改完后，函数名中的 `version` 残留会让代码难以阅读理解。已经是最终领域名的 `workspace` 不需要为了“去前缀”再改。

| # | 位置 | 示例改前 | 改后 |
|---|------|---------|------|
| 62 | `Articles.Draft` | `publish_article_version/3` | `publish_workspace/3` 或 `publish_article_workspace/3`（二选一，按模块语境定） |
| 63 | `Articles.Draft` | `create_article_version/3` | `create_workspace/3` 或 `create_article_workspace/3`（二选一，按模块语境定） |
| 64 | 各模块 | `article_version` 变量名 | `workspace` |
| 65 | 各模块 | `%ArticleVersion{}` 模式匹配 | `%ArticleWorkspace{}` |
| 66 | 各模块 | `article_version_id` 变量 | `workspace_id` |

### 13. 前端 GraphQL Schema (`schema.ts`)

| # | 最终字段 / 操作 | 说明 |
|---|-----------------|------|
| 62 | `docDraftSnapshots` query | 使用 snapshot 命名，不再用 revision |
| 63 | `$stage: ArticleSnapshotStage` | `DRAFT` / `PUBLIC` |
| 64 | `snapshotNumber` field | ArticleSnapshot per-article 序号 |
| 65 | `checkpointDocDraftSnapshot` mutation | 创建 draft snapshot |
| 66 | `restoreDocDraftSnapshot` mutation | 从 snapshot 恢复 draft |
| 67 | `$snapshotId: ID!` arg | snapshot 参数 |
| 68 | `baseSnapshotId` field | 保留，基线语义 |
| 69 | `latestSnapshotId` field | 最新 tree snapshot id |
| 70 | `latestSnapshotNumber` field | 删除 |
| 71 | `latestReleaseNumber` field | 如 UI 需要发布序号 |
| 72 | `latestReleaseId` field | 可选 |

### 14. 前端组件 & Hooks

| # | 文件 | 改前 | 改后 |
|---|------|------|------|
| 71 | `Editor/Article/useLogic.ts` | `snapshotNumber` | `snapshotNumber` |
| 72 | 同上 | `revisionSignature` | `snapshotSignature` |
| 73 | `SideTree/useLogic.ts` | `revision` / `revisionRef` | 不变（计数器） |

---

## 二、Refactor 清单（结构改进）

### 高优先级

#### R1. 删除 `ArticleWorkspace(stage=public)` — Workspace 不再持有 public 镜像

**问题**：`ArticleWorkspace` 是可变工作区，同时维护 `draft` 和 `public` 两份副本语义矛盾。`docs` + `DocDocument` 才是线上 source of truth。

**方案**：
- `ArticleWorkspace.stage` 只保留 `:draft`（可选未来加 `:review`）
- 删除所有 `stage=public` 的 ArticleWorkspace 行（publish 不再创建 workspace public 镜像）
- Publish 流程：更新 `docs` + `DocDocument` → 创建 `ArticleSnapshot(stage=public)` 作为历史证据 → 创建 `PublishRelease` 引用该 snapshot
- Diff 改为：`ArticleWorkspace(draft)` ↔ `latest ArticleSnapshot(stage=public)` 跨表比较
- Public 读：直接查 `docs` + `DocDocument`，不经过 snapshot
- Rollback：选 release → 取 snapshot → 写回 `docs` + `DocDocument` → 生成新的 public snapshot + release
- `DocsSiteState.tree_lock_version` / `site_draft_version` / `published_version`：分别承担树乐观锁、站点 dirty、上次 publish 对齐点，和 workspace 双态解耦。

#### R2. `DocTreeNode(stage=public)` 保持作为树 runtime 层

**问题**：之前考虑删除 public node 行、从 DocTreeSnapshot 直接 serve。但树和内容应对齐：各自有 runtime 层（`docs` + `DocDocument` / `DocTreeNode(public)`）和 history 层（`ArticleSnapshot` / `DocTreeSnapshot`）。

**方案**：
- `DocTreeNode(stage=public)` **保留**，和 `docs` + `DocDocument` 对等，作为树的 runtime serving 层
- `DocTreeSnapshot` 退回到纯历史证据角色，和 `ArticleSnapshot` 对齐
- Publish 时写 `DocTreeNode(public)` 行（当前已有）+ 创建 `DocTreeSnapshot` 作为历史证据
- Tree diff = draft node 树 ↔ `DocTreeSnapshot.tree_json`
- Tree rollback = 选 release → 取 `DocTreeSnapshot.tree_json` → 写回 `DocTreeNode(public)`

#### R3. 删除 `PublishRelease.tree_json` 冗余

**问题**：`PublishRelease` 自存 `tree_json`，又通过 `tree_snapshot_id` FK 指向 `DocTreeSnapshot`（也存 `tree_json`）。

**方案**：
- 从 `PublishRelease` schema 删除 `tree_json` 字段
- 需要 tree_json 时通过 `Repo.preload(publish_release, :tree_snapshot)` 获取

#### R4. GQL `doc_id` 拆分为两个字段

**问题**：`DocTreeNode` 的 GQL 字段 `doc_id` 对 draft 节点映射到 `workspace_id`（→ workspaces），对 public 节点映射到 `doc_id`（→ docs）。前端无法区分。

**方案**：
- Draft 节点暴露 `workspace_id`（指向 ArticleWorkspace）
- Public 节点暴露 `doc_id`（指向 docs）
- 两个字段各在对应 stage 的节点上有效

#### R5. Diff 来源切换

**问题**：当前 diff = `ArticleWorkspace(draft)` vs `ArticleWorkspace(public)`（同表自比较）。

**方案**（配合 R1）：
- Diff = `ArticleWorkspace(draft)` vs `latest ArticleSnapshot(stage=public)`
- 内容 diff：比较 `content_hash`
- 树 diff：`DocTreeNode(draft)` 构建的树 vs `DocTreeSnapshot.tree_json`

#### R5b. 旧 publish 入口收敛到 release publish

**问题**：`publish_doc` / `publish_all_unpublished_docs` / `publish_tree` / `publish_group` 这类旧入口如果继续暴露，会绕过 `PublishRelease`，导致 release history 缺口。

**方案**：
- 不做兼容层，也不保留旧 GraphQL 暴露。
- 对外只保留统一 publish 入口：`publish_changes(change_set)`。
- 内部需要复用时，也必须通过 release publish 的计划、校验、写 runtime、写 snapshot、写 release 全链路。
- 若保留少量 private helper，命名必须体现职责，例如 `publish_article_workspace_to_runtime`，不能继续叫 `publish_doc` 造成语义歧义。

#### R6. DocTreeEvent 生命周期简化

**问题**：当前 event 有 `status: staged → published → reverted/discarded` 流程，`published` 状态用于跟踪哪些 event 已写入 public node 行。同时 `PublishReleaseTreeEvent` 也在 release 中保留了 event 副本，形成双重追踪。

**方案**（配合 R2 保留 public node）：
- Event 保持 `status: staged → published`，跟踪 draft 变更是否已发布到 public node
- `PublishReleaseTreeEvent` 保留作为发布时的审计副本
- 两者不冲突：event 表是工作流状态机，release event 是发布锚点下的不可变记录

### 中优先级

#### R7. DocTreeDraftState 并入 DocsSiteState

**问题**：两个 per-community 单例表，`base_snapshot_id` / `staged_event_count` 和站点级发布元数据分散在两张表；树变更时两个 counter 一起 bump，容易误读成完全重叠。实际上 tree lock 和 site dirty 是两种职责，应该合表但保留分离锁。

**方案**：
- **删除** `doc_tree_draft_states` 表
- 把 `base_snapshot_id`、`staged_event_count` 搬到 `docs_site_states`
- `doc_tree_draft_states.revision` 迁移为 `docs_site_states.tree_lock_version`
- `docs_site_states.draft_revision` 迁移为 `docs_site_states.site_draft_version`
- `docs_site_states.last_published_draft_revision` 迁移为 `docs_site_states.published_version`
- tree mutation：`tree_lock_version += 1`，同时 `site_draft_version += 1`
- content draft save：只 `site_draft_version += 1`
- publish 完成时在同一事务里同步更新 `base_snapshot_id` / `staged_event_count` / `last_published_*`；若发布后无剩余 plan，再设置 `published_version = site_draft_version`
- 前端 `baseRevision` 暂时仍读 GraphQL `revision`，后端来源改为 `tree_lock_version`

#### R8. PublishRelease.release_number vs DocTreeSnapshot.snapshot_number

**问题**：两个单调序号，不清楚语义关系。当前 DocTreeSnapshot 只在 publish/release 时创建（tree 每次 draft 操作产生的是 DocTreeEvent，不是 snapshot）。

**方案**（提前定案）：
- `release_number`：publish 行为序列（每次 publish 递增）
- **删除 `DocTreeSnapshot.snapshot_number`**，直接使用 `PublishRelease.release_number`。
- **1:1 约束**：每次 publish 都创建 DocTreeSnapshot，即使本次只有 doc content changes、没有 tree changes。content-only publish 时写入与上一次相同的 tree_json，并由新的 `PublishRelease.tree_snapshot_id` 指向它。这样 1:1 永远成立。
- 如果未来引入 tree checkpoint（非 publish 时创建 snapshot），届时再加 `snapshot_number` 并明确其与 `release_number` 的关系。

### 低优先级

#### R9. DocTreeNode.group_id 保持

**方案**：保持 `group_id`，不做修改。可读性优先。

#### R10. 删除 Doc.inner_id 占位字段

`Doc` schema 的 `@optional_fields` 包含 `:inner_id`，但 schema 块未声明该 field。若已废弃则清理。

#### R11. schema_version 字段文档化

`ArticleWorkspace`、`ArticleSnapshot`、`DocDocument` 三张表都有 `schema_version`（`default: 1`）。文档说明：这是 JSON 内容格式的 schema 版本号，用于内容格式迁移，非数据库 schema 版本。

#### R12. stage × status 命名约定文档化

- **stage**：内容/树节点的生命周期阶段
  - `ArticleWorkspace.stage`：`draft`（未来可加 `review`）
  - `ArticleSnapshot.stage`：`draft | public`
  - `DocTreeNode.stage`：`draft | public`
- **status**：工作流生命周期（`staged | published | reverted | discarded`，仅 event 表用）

---

## 三、新特性准备（branch + version 字段）

在 rename + refactor 完成后，以下表新增字段：

| # | 表 | 字段 | 类型 | 默认 | 说明 |
|---|-----|------|------|------|------|
| N1 | `article_workspaces` | `branch` | `:string` | `nil` | nil = 主分支 |
| N2 | `article_workspaces` | `version` | `:string` | `nil` | nil = 默认版本 |
| N3 | `doc_tree_nodes` | `branch` | `:string` | `nil` | 同上 |
| N4 | `doc_tree_nodes` | `version` | `:string` | `nil` | 同上 |
| N5 | `docs` | `branch` | `:string` | `nil` | 发布内容分支归属 |
| N6 | `docs` | `version` | `:string` | `nil` | 发布内容版本归属 |
| N7 | `doc_tree_snapshots` | `branch` | `:string` | `nil` | 树快照分支归属 |
| N8 | `doc_tree_snapshots` | `version` | `:string` | `nil` | 树快照版本归属 |
| N9 | `article_snapshots` | `branch` | `:string` | `nil` | 内容快照分支归属 |
| N10 | `article_snapshots` | `version` | `:string` | `nil` | 内容快照版本归属 |

### 扩展后的读模型

```
Public content read                Public tree read
       │                                │
       ▼                                ▼
    docs + DocDocument              DocTreeNode(stage=public)
  branch=nil, version=nil          branch=nil, version=nil
  (source of truth)                (source of truth)
       │                                │
       ▼                                ▼
  返回文章内容                      返回公共树结构

  ArticleSnapshot(public)          DocTreeSnapshot
  是历史证据，不 serve              是历史证据，不 serve
```

```
Branch preview:
  docs + DocDocument(branch="feat-x")         → 分支预览内容
  DocTreeNode(public, branch="feat-x")       → 分支预览树

Version isolation:
  docs + DocDocument(version="v1")            → v1 文档内容
  DocTreeNode(public, version="v2")          → v2 导航树
```

读路径上通过 `branch` + `version` 过滤；唯一约束、默认 fallback（`nil` = 主分支/默认版本）、branch/version 继承规则在 Phase 3 实现时精确定义。

---

## 四、执行顺序

```
Phase 1: Pure Rename（零行为变更，只改名字）
  1. ArticleVersion → ArticleWorkspace
     - 模型 + 表 + FK + belongs_to
     - 函数名/变量名中残留的 article_version → workspace（见 §12b）
  2. ArticleRevision → ArticleSnapshot
     - 模型 + 表 + FK + belongs_to
     - article_snapshot_id → snapshot_id（仅在 article-scoped 子表中）
     - snapshot_number 语义明确为 per-article 线性序号
  3. DocTreeRevision → DocTreeSnapshot
     - 模型 + 表 + FK + belongs_to
     - 同步删除 snapshot_number（R9 定案）
   4. DocContent → DocDocument
      - 表重命名 + 模型重命名 + 所有代码引用
   5. GQL 类型/query/mutation/frontend schema 跟随
   6. JSON payload & API 字段同步（见 §2b）
      - DocTreeEvent.payload.node.docId → workspaceId
      - DocTreeTrashItem.node_snapshot 中的 docId
      - PublishReleaseTreeEvent 注释更新

Phase 2: Structural Refactor（有行为变更）
  1. R1: 删除 ArticleWorkspace(stage=public)
  2. R3: 删除 PublishRelease.tree_json
  3. R5: Diff 来源从同表自比较切到跨表 workspace ↔ snapshot
     - 边界处理：无 public snapshot 时判定为全量新建
  4. R5b: 旧 publish 入口收敛到 publish_changes(change_set)
     - 不保留兼容 GraphQL 暴露
     - 所有 publish 都必须创建 PublishRelease
  5. R4: GQL doc_id 拆分（draft: workspaceId / public: docId）
   6. docTreeState 暴露 latestSnapshotId + latestReleaseNumber
      - 删除 latestSnapshotNumber
   7. R7: DocTreeDraftState 并入 DocsSiteState
      - 删除 doc_tree_draft_states 表
      - tree_lock_version / site_draft_version / published_version 取代旧 revision 字段
      - publish 链路补全：同一事务更新所有字段

Phase 3: New Features
  1. 加 branch + version 字段（workspace、runtime、snapshot 三层共 6 张表）
  2. 更新唯一约束
  3. Git sync 管道实现
```
