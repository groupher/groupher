# CMS DocTree / ContentImport：现状审计与独立重构计划

> 本文把 DocTree 与 Docs ContentImport 从 CMS Phase 5 总文档中单独拆出，记录当前真实功能、对外入口、Gate、lifecycle/version authority、identity、事务 owner、Receipt/workflow 边界和目录职责。
>
> 当前结论：DocTree 的 GraphQL 用户 mutation 已经有 concrete Command、非空 `commandId` 和部分 Confirmation/Replay；但 facade 与内部 workflow 仍保留无 actor/无 `commandId` 的 direct Writer/Trash/Publish fallback，因此 DocTree 还没有完成 CMS.Command 收口。ContentImport 是一个有持久 Job、staging 和 atomic apply 的 workflow，不应把每个 service callback 或内部步骤强行变成用户 Command。本文不修改执行代码，也不把已有的 Node/Phoenix 架构文档重新写成第二套 source of truth。

## 1. 先给结论

DocTree 目前不是“完全没有 Command”，也不是“所有 Docs 动作都已经进入 Command”。应当分成三层看：

1. **编辑器直接触发的树/文档 mutation**：GraphQL 已经要求 `commandId`，并按动作拆成 `Commands.CreateNode`、`UpdateNode`、`DeleteNode`、`DuplicateNode`、`MoveNode`、`UpdateDraft`、`MoveDocToDraft`、`MoveSubtreeToDraft`、`RestoreTrashItem` 等 concrete use case。带 actor 和 command identity 的路径进入 `CMS.Command`，通过 `TreeConfirmation`、`NodeDraftConfirmation` 或专用 publish confirmation 恢复结果。
2. **发布、回收站和文章联动**：它们不是单行写入，而是跨 tree、Article Draft/Public、Trash、Release/Snapshot、Activity/Outbox 的 domain workflow。Command 可以作为用户入口和 Receipt 边界，但 workflow 负责内部多步事实；不能为每个 scope 或 effect 再生成一个 command UUID。
3. **ContentImport**：这是“Preview/Review → ImportJob → BodyBag staging → atomic Docs apply”的跨请求、跨服务 workflow。`preview_ref`、`dataset_ref`、`job_ref` 和 `external_ref` 是不同层次的 workflow/source identity；它们不应被命名成 `command_id`。如果产品需要用户在“确认开始导入”时获得同一份 Receipt，可以只给 start 增加一个薄的 `StartDocContentImport` Command，后续 stage/apply/fail/cancel 仍由 Job workflow 管理。

目标边界应是：

```text
用户 Docs mutation
  -> concrete Command(commandId)
  -> CMS.Gate admission
  -> 一个事务 owner / named workflow
  -> DocTree/Docs Persist primitives
  -> Confirmation/Receipt
  -> Activity / domain event / Outbox effect

ContentImport
  -> preview/query
  -> confirmed ImportJob(workflow identity)
  -> bounded staging
  -> atomic Docs + Tree + Mapping apply
  -> persisted Job result / retry / recovery
```

这里的关键不是“所有函数都叫 Command”，而是每个用户动作只有一个业务 identity 和一个明确的结果恢复 owner；Workflow 可以调用 Command 或 Persist primitive，但不能伪造另一个用户 `command_id`。

## 2. 对外功能和真实入口

### 2.1 DocTree 查询和编辑能力

当前 GraphQL 入口位于 `GroupherServerWeb.Schema.CMS.Queries`、`GroupherServerWeb.Schema.CMS.Mutations.DocTree`，resolver 位于 `GroupherServerWeb.Resolvers.CMS.Docs`。

| 对外能力                     | GraphQL 入口                | 当前 domain owner                                       | 当前结果/身份                                                              |
| ---------------------------- | --------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| 编辑器 Draft tree            | `docTree`                   | `CMS.DocTree.read` → `DocTree.Query.read`               | Query；Gate scoped read，无 Command/Receipt                                |
| Public tree                  | `docPublicTree`             | `CMS.DocTree.read_public` → `DocTree.Query.read_public` | public query；只读公开 projection                                          |
| Draft document               | `docDraft`                  | `CMS.Docs.read_editor_head`                             | Query；以 Article draft version 为版本 authority                           |
| Publish checklist            | `docPublishChecklist`       | `CMS.DocTree.publish_checklist` → `Publish.Checklist`   | Query；以 staged events/revision/release readiness 为准                    |
| Trash drawer                 | `docTreeTrashItems`         | `CMS.DocTree.trash_items` → `Trash.list`                | Query；列出 branch-scoped product trash                                    |
| 创建 Tab/Group/Page/Link/Pin | `createDocTreeNode`         | `Commands.CreateNode` 分派到具体 Command/Writer         | Command；`baseRevision` 做树并发检查                                       |
| 更新 node metadata           | `updateDocTreeNode`         | `Commands.UpdateNode`                                   | Command；结果包含新 tree revision                                          |
| 更新 Draft 内容              | `updateDocDraft`            | `Commands.UpdateDraft` → Docs Draft store               | Command；`expectedVersion` 做文档版本检查                                  |
| Publish tree/docs changes    | `publishDocChanges`         | `Commands.PublishChanges` → `DocTree.Publish`           | Command 启动 publish workflow；Confirmation 保存 release id                |
| Public page 回 Draft         | `moveDocToDraft`            | `Commands.MoveDocToDraft`                               | Command/Receipt；恢复时重新读取 editor head                                |
| subtree 批量建 Draft         | `moveDocTreeSubtreeToDraft` | `Commands.MoveSubtreeToDraft`                           | Command/Receipt；当前返回 done/affected count                              |
| 由 revision 恢复 Draft       | `restoreDocRevisionToDraft` | `CMS.Docs.restore_revision_to_draft`                    | Article/Docs command；不属于 tree node command，但共享 branch/version 合同 |
| 删除 node 到 product Trash   | `deleteDocTreeNode`         | `Commands.DeleteNode` → Writer/Trash                    | Command；删除 snapshot 与 tree event 需要同一事务 owner                    |
| 从 product Trash 恢复        | `restoreDocTreeTrashItem`   | `Commands.RestoreTrashItem` → `Trash.restore`           | Command/Receipt 目标；当前仍保留 direct fallback                           |
| duplicate subtree/node       | `duplicateDocTreeNode`      | `Commands.DuplicateNode`                                | Command；可能同时创建 Article Draft                                        |
| 移动 node                    | `moveDocTreeNode`           | `Commands.MoveNode`                                     | Command；`baseRevision` + branch lock                                      |

`addDocCoverCard`、`removeDocCoverCard`、pin/reorder 等 `DocCover` mutation 也出现在同一个 GraphQL schema 文件中，但 owner 是 `CMS.DocCover`，不是 DocTree 本次重构范围。它们应继续作为相邻 bounded context 处理，不能因为文件相同就把 Cover 的 transaction 或 Command 归入 DocTree。

### 2.2 ContentImport 对外能力

ContentImport 当前 GraphQL 入口位于 `GroupherServerWeb.Schema.CMS.ContentImport`，resolver 位于 `GroupherServerWeb.Resolvers.ContentImport`。它服务的是 GitHub Docs Dataset 的有界导入，不是普通编辑器 mutation。

| 对外能力        | GraphQL 入口                    | 当前 owner                      | identity / recovery                                              |
| --------------- | ------------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| 预览目标树      | `previewDocContentImportTarget` | `Threads.Doc.Validator.preview` | Query/planning；不创建 Job，不创建 Receipt                       |
| 创建或恢复 Job  | `startDocContentImport`         | `ContentImport.Jobs.create`     | `preview_ref` 绑定完整 confirmed intent；重复 start 返回同一 Job |
| 读取 Job        | `contentImportJob`              | `Jobs.get` → `Jobs.project`     | Query；以 `job_ref` 读取持久过程和结果                           |
| staging BodyBag | `stageDocContentImportBodies`   | `Staging.stage`                 | service workflow step；`(job_ref, external_ref, body_hash)` 幂等 |
| 原子 apply      | `applyDocContentImport`         | `Threads.Doc.Writer.apply`      | workflow terminal step；锁 Job，写 Docs/Tree/Mapping，完成 Job   |
| 记录失败        | `failDocContentImport`          | `Jobs.fail`                     | workflow terminal transition；保留 error code/message            |
| 取消            | `cancelDocContentImport`        | `Jobs.cancel`                   | workflow transition；删除 staged bodies 并标记 cancelled         |

当前 `start` 没有 GraphQL `commandId`；它通过 `preview_ref` 的唯一绑定和完整 intent 比较保证重试不会静默复用另一份导入意图。这个设计可以作为 workflow contract 保持，也可以在产品明确要求“用户确认开始导入必须有 Receipt”后增加一个只包住 start 的 Command。无论采用哪种选择，stage/apply/fail/cancel 都不应各自生成业务 command UUID。

## 3. 数据、生命周期与 identity authority

### 3.1 DocTree 的事实和版本

| 事实                    | authority                                          | 用途                                                             |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| branch                  | `CMS.Docs.Branch` / `DocBranch`                    | 解析 main 或指定 docs branch；所有 tree/read/write 必须带 branch |
| draft tree node         | `doc_tree_nodes(stage=draft)`                      | Dashboard 编辑器当前树                                           |
| public tree node        | `doc_tree_nodes(stage=public)` + public projection | public docs site 读取                                            |
| tree optimistic version | `DocsSiteState.tree_lock_version`                  | `baseRevision` 冲突检查，不是 command identity                   |
| site dirty version      | `DocsSiteState.site_draft_version`                 | tree/doc draft 是否领先于 published version                      |
| staged event            | `DocTreeEvent(owner=tree                           | doc,status=staged)`                                              | SavingBar、review、publish selection；不是 raw Outbox |
| public release          | `DocPublishRelease` / snapshot                     | 一次 publish 的产品结果和公开版本 authority                      |
| document draft          | `DocDraft.version`                                 | `expectedVersion` 内容并发检查                                   |
| trash action            | `TrashAction` + trashed memberships                | 删除/恢复快照和 article/tree 关系                                |

`DocTree.Import` 使用 `import:<type>:<sha>` 这类稳定 source node identity，并通过已有 node index 尝试复用结构 identity。它不是 command identity，也不能替代 `commandId`、`job_ref` 或 `external_ref`。

### 3.2 identity 分类

```text
用户请求
  command_id      -> CMS.Command / Receipt / Confirmation replay
  base_revision   -> tree optimistic concurrency
  expected_version-> Article/Draft optimistic concurrency

发布/副作用
  release_id      -> publish product result
  snapshot_id     -> public tree/content snapshot
  effect_key      -> Outbox effect idempotency (若存在)

ContentImport
  preview_ref     -> confirmed Preview intent / start idempotency
  dataset_ref     -> external immutable Dataset artifact
  job_ref         -> durable ImportJob workflow identity
  external_ref    -> one source document item
  mapping key     -> source connection + thread + external_ref
```

禁止的做法包括：在 publish 的 tree/doc scope 内生成第二个 UUID；在 import apply 的每篇 document 或每个 node 上生成一个伪 `command_id`；把 `job_ref`、`external_ref` 或 Outbox event id 回填为用户 command identity。

## 4. 当前真实流程

### 4.1 编辑器树 mutation

```text
GraphQL(commandId, baseRevision, input)
  -> resolver adds actor/command_id/base_revision
  -> CMS.DocTree facade
  -> Commands.<Action>.execute
  -> CMS.Command (when actor + command_id exist)
  -> TreeConfirmation / CommandReplay
  -> Operation.run
       -> branch resolve
       -> transaction-scoped global doc-tree lock
       -> Gate.access_check(:manage_docs)
       -> DocsSiteState + draft state
       -> base_revision check
       -> Writer callback
            -> doc_tree_nodes draft
            -> staged DocTreeEvent
            -> tree/site revision bump
  -> canonical mutation payload + Receipt replay
```

`baseRevision` 冲突返回当前 tree state/affected nodes，不应重试成另一个 command。GraphQL path 的 `commandId` 是非空参数，但 `CMS.DocTree.create_tab/create_group/create_page/create_link/create_pin` 等 convenience facade arity 仍可在没有 actor/command id 时落到 `Support.run_tree_command` 的 direct execution 分支；`update/delete/duplicate/move/restore` 也保留无 actor 的 arity。这是当前未收口的核心，而不是新的产品功能缺口。

### 4.2 Draft document mutation

```text
GraphQL(commandId, expectedVersion, BodyBag)
  -> BodyBagTrust + article editor transport checks
  -> CMS.DocTree.update_draft
  -> Commands.UpdateDraft / NodeDraftConfirmation
  -> CMS.Command
  -> CMS.Docs / Article Draft Store
  -> Draft version + result replay
```

正文 Draft 的版本 authority 是 Article/Draft version；它不能用 tree `tree_lock_version` 代替。创建 Page 时，`Writer.create_page` 还会通过 `DraftDoc.ensure` 创建或复用默认 Article Draft，因此 Page node command 与 Article draft write 必须共享事务 owner。

### 4.3 Publish workflow

```text
GraphQL(commandId, selected changes, cover mode)
  -> Commands.PublishChanges
  -> CMS.Command (当前 GraphQL path)
  -> CMS.DocTree.Publish
       -> branch + manage_docs Gate
       -> transaction-scoped global tree lock
       -> checklist/selection/revision validation
       -> restore/apply staged tree events
       -> publish selected Doc drafts
       -> public tree/projection + DocPublishRelease/snapshot
       -> Outbox invalidation with causation_id = same commandId
  -> PublishChangesConfirmation(release_id, done)
  -> checklist + release result
```

Publish 是 workflow，不是“单个 node 的 one-shot write”。Command 的职责是保留用户入口、参数 canonicalization 和 Receipt；`Publish` 的职责是多事实发布、release/snapshot 和外部 invalidation。当前 `Commands.PublishChanges` 仍允许 `command_id=nil` 时直接调用 `Publish.publish_changes`，因此内部 direct caller 没有同一份 Receipt/replay 合同。

### 4.4 Trash / restore workflow

```text
DeleteNode / RestoreTrashItem(commandId)
  -> Command wrapper
  -> DocTree.Trash
       -> branch/global tree lock
       -> Article mutation lock
       -> tree/article membership + trash snapshots
       -> DocTree Activity operation_ref
       -> tree revision
  -> TreeConfirmation / replay
```

Trash 不是单纯 `doc_tree_nodes` delete：它要保存可恢复的 tree/article 关系，并可能写 Activity。当前 `RestoreTrashItem` 在 actor + binary command id 存在时才进入 Command，否则直接调用 `Trash.restore`；ContentImport 为恢复被导入目标而调用它时也走 direct path。这种内部 workflow 调用可以存在，但必须被命名为 workflow/persistence call，不能让它看起来像另一个用户 Command。

### 4.5 ContentImport workflow

```text
Node/Browser preview
  -> previewDocContentImportTarget (Validator query)
  -> user confirms Preview/Dataset/TargetTree
  -> startDocContentImport
       -> validate intent + source documents
       -> unique (community, preview_ref)
       -> ImportJob + JobItems(status=staging)
  -> stageDocContentImportBodies (bounded 1..4)
       -> lock Job/Item
       -> BodyBag.cast + canonical body_hash/size
       -> ready/skipped/failed + progress
  -> applyDocContentImport(job_ref)
       -> outer Repo.transaction + Job FOR UPDATE
       -> main branch / doc-tree lock
       -> revalidate target intent
       -> lock ready items/bodies
       -> restore mapped trash if needed
       -> write Docs drafts
       -> DocTree.Import.apply (stable source node ids)
       -> upsert ImportSourceMapping
       -> delete staged bodies + complete Job/result
```

`Threads.Doc.Writer.apply` 已经把 Docs、Tree、Mapping、staging 清理和 Job completion 放进一个 apply transaction；完成 Job 再次 apply 时返回持久化 projection。它不是 `CMS.Command` 的 Receipt，但它已经是 workflow 自己的结果恢复协议。

## 5. Gate、事务和结果恢复审计

### 5.1 Admission

- `DocTree.Query.read/read_public` 使用 `CMS.Gate.scope` 取得 community/branch scoped resource；Query 不接收 command id，也不创建 Receipt。
- `Writer.Operation.run` 在 tree lock 内调用 `CMS.Gate.access_check(actor, :manage_docs, community)`，并复用 canonical community/state。
- GraphQL tree mutation 当前统一做 `Authorize(:login)`、`FrontDesk(:community)`、`PutCurrentUser`；Draft mutation 还加 `BodyBagTrust` 和 `FrontDesk(:article_editor, thread: :doc)`。GraphQL schema 本身没有在每个 DocTree mutation 上显式列出 Passport action，领域 Gate 是真正的 docs management admission；transport 与 domain policy 的对应关系应在下一阶段补一张 action matrix，避免两套规则漂移。
- ContentImport start 由用户 Passport `doc.import` 加 delegated service scope admission；preview/stage/apply/fail/cancel 的部分入口是 service scope，依赖 `community` FrontDesk 和受信 service identity。Job 的 community/job_ref 绑定必须继续在领域层校验，不能只信 transport scope。

### 5.2 Transaction owner

当前实现的正常执行关系是：

| 路径                     | 当前 owner                                                                    | 现状判断                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| tree node write          | `Helper.Transaction.lock_global` → outer `Repo.transaction` → `Operation.run` | 主路径有全局 advisory transaction lock；Gate、revision check、node callback 在锁内                                           |
| staged event             | `Events.record_staged_many` 自己调用 `Repo.transaction`                       | 在 Operation 外层调用时是同一 Repo connection 上的 nested transaction/savepoint；但 API 仍允许它脱离动作单独拥有 transaction |
| revision bump            | `Revision.bump_tree_draft` 自己调用 `Repo.transaction`                        | 同上；Revision/Events/Writer 各自表达 transaction，owner 在物理结构上分散                                                    |
| publish                  | `Publish.publish_changes` 的 branch/global lock + outer `Repo.transaction`    | 当前最接近完整 workflow owner；release/snapshot/outbox 应继续留在这一层                                                      |
| trash restore            | global tree lock + Article mutation lock + Trash callback                     | 跨 Article/tree/Activity；不能下沉成单表 Persist                                                                             |
| import stage/fail/cancel | 各自 `Repo.transaction` + Job `FOR UPDATE`                                    | 单个 workflow transition；job lock 是并发 authority                                                                          |
| import apply             | outer `Repo.transaction` + Job lock，再进入 DocTree global lock               | Docs、Tree、Mapping、staging cleanup、Job completion 的 atomic apply owner 已明确                                            |

因此，当前不能简单地说“DocTree 自己开启 transaction 是错误”：`lock_global` 本身会创建事务，嵌套 transaction 在正常同连接路径上是 savepoint。真正的问题是 `Writer`、`Events`、`Revision`、`Trash` 的 public helper 都能独立开启或假设 transaction，调用者无法从模块边界看出谁是最终 owner。目标是：Command 或 named workflow 持有一个显式 owner；Persist 只接受已在 owner 内的 connection/context，不再隐藏另一个业务事务。

### 5.3 Confirmation / result recovery

| 路径                         | 当前恢复方式                                                                          | 当前缺口                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 带 commandId 的 tree command | `CMS.Command` Receipt + `TreeConfirmation` + `CommandReplay`                          | GraphQL path 已具备；内部 direct fallback 没有同等 Receipt                                            |
| UpdateDraft                  | `NodeDraftConfirmation` 记录 article/draft 结果                                       | facade/内部无 command id 时走 direct execution                                                        |
| MoveDoc/Subtree              | 专用 confirmation 保存 doc/affected count                                             | 应继续确认 `commandId` 与 effect 只使用入口 identity                                                  |
| Publish                      | `PublishChangesConfirmation` 保存 `release_id/done`，present 时重读 release/checklist | `command_id=nil` 仍可绕过 Command；publish effect 状态不应冒充另一个产品 command                      |
| Trash restore                | Tree confirmation/replay 在带 identity 时可恢复                                       | direct `Trash.restore` 与 import 内部调用没有 Receipt                                                 |
| ContentImport start          | 重复 `preview_ref` + 完整 intent 比较返回同一 Job                                     | 初次 start response 丢失时只能重发同一 Preview intent；若产品要求标准 Receipt，应增加薄 Start command |
| ContentImport stage          | 同一 Job/item/body hash 重放返回既有事实                                              | 每批 service call 不是用户 Receipt；Job projection 是恢复入口                                         |
| ContentImport apply          | 已完成 Job 返回持久化 result/projection；失败整体回滚                                 | 需要 focused 验证 apply response loss、重复 apply、Job lock/terminal state                            |

## 6. 当前目录和模块职责

### 6.1 DocTree 真实目录

```text
cms/doc_tree.ex                         # CMS.DocTree public facade
cms/doc_tree/
├── commands/                           # concrete commands + confirmations + Support
│   ├── create_* / update_* / delete_*   # user action wrappers
│   ├── move_* / duplicate_*             # user action wrappers
│   ├── publish_changes.ex               # Command -> Publish workflow
│   ├── restore_trash_item.ex            # Command -> Trash workflow
│   ├── support.ex                       # Command construction/replay fallback
│   └── *_confirmation.ex                # Receipt payload codecs
├── query.ex                             # draft/public tree and tree-state reads
├── writer.ex                            # node mutation orchestration + Article draft hooks
├── writer_impl/                         # node/index/identity/event/revision helpers
├── operation.ex (writer_impl)            # lock + Gate + revision envelope
├── events.ex                            # staged domain event log
├── revision.ex                          # DocsSiteState counters
├── state.ex                             # branch-scoped DocsSiteState setup
├── trash.ex                             # product Trash list/restore/delete workflow
├── publish.ex + publish/                 # checklist, selection, release/public projection
├── import.ex                             # import tree projection inside caller transaction
├── snapshot.ex / published_fields.ex    # public release projection helpers
├── command_replay.ex / confirmation.ex   # result codec/replay support
└── const.ex / change_detection.ex       # domain constants and change helpers
```

当前结构的优点是 `commands/` 已经能表达用户 use case，`publish/` 也明确表达了跨文档/树的 workflow。主要问题是：`writer.ex` 和 `writer_impl/operation.ex` 同时承担 orchestration、Gate、lock、node persistence、event recording、revision bump；`events.ex`、`revision.ex` 又各自隐藏 transaction；`trash.ex` 和 `publish.ex` 是 workflow，却与基础 persistence helper 平铺在同一层。

### 6.2 ContentImport 真实目录

```text
cms/content_import/
├── jobs.ex                             # Job create/resume/get/fail/cancel/project
├── staging.ex                          # bounded BodyBag staging
├── process.ex                          # Job process projection
├── import_source_mapping.ex            # source ↔ Groupher sync baseline
├── persistence/
│   ├── connection.ex
│   ├── job.ex
│   ├── job/item.ex
│   ├── job/body.ex
│   └── import_source_mapping.ex
└── threads/doc/
    ├── validator.ex                    # target tree/intent validation
    └── writer.ex                       # atomic Docs/Tree/Mapping apply
```

ContentImport 的 `persistence/` 和 `threads/doc/` 已经比 DocTree 更接近“持久化 + thread workflow”结构；不应为了形式再复制一套 `Commands/Query/Persist/Setup` 空目录。它真正需要的是把 workflow identity、job transition、atomic apply 和 service admission 写成稳定合同，并在产品需要时只为 start 增加薄 Command。

### 6.3 与项目规范的对照

项目中较清晰的模式是：

```text
CMS.<BusinessContext>
├── Commands/     # 用户业务动作与 Confirmation
├── Query/        # 读模型/查询
├── Persist/      # 无业务 admission 的持久化 primitive
└── Setup/        # 初始化；没有才不创建
```

DocTree 目前只有 `Commands` 和 `Query` 的边界较清晰；`Writer` 实际上是一个 workflow/orchestration owner，却使用了容易被误认为 Persist 的名字。ContentImport 目前没有普通 user Command 子域，而是一个独立 workflow context，`Jobs/Staging/threads/doc` 的命名反而更符合其性质。

## 7. 建议的目标目录和 owner

这是下一阶段的物理目标，不是本轮直接移动代码：

```text
CMS.DocTree
├── commands/                           # user Command + Confirmation
├── query.ex                             # read/scoped projection
├── persist/                             # transaction-free row/event/revision primitives
│   ├── node.ex
│   ├── event.ex
│   ├── revision.ex
│   └── state.ex
├── workflows/
│   ├── tree_mutation.ex                 # branch lock + Gate + one transaction owner
│   ├── publish/                         # release/snapshot/public projection
│   └── trash/                           # restore/delete + Article membership + Activity
├── integrations/
│   └── article_draft.ex                 # page create/update hooks, if still needed
├── import.ex                            # import projection primitive called by Import workflow
├── replay.ex / confirmations/           # Receipt/replay codecs
└── setup.ex                             # only branch/site initialization

CMS.ContentImport
├── query.ex                             # Job/process/read projections, if query volume warrants it
├── persist/                             # Job/Item/Body/Mapping primitives
├── workflows/
│   └── docs/
│       ├── preview.ex
│       ├── start.ex                     # optional thin StartDocContentImport command boundary
│       ├── stage.ex
│       └── apply.ex
└── persistence/                         # Ecto schemas may remain here
```

取舍：

- `Setup` 只给 `DocTree.initialize`/DocsSiteState 初始化使用，不把它做成普通 mutation 兼容入口。
- `Persist` 不调用 Gate、不生成 UUID、不写 Activity/Outbox、不包业务 transaction；它接受上层已解析的 branch/canonical resource 和 owner context。
- `Publish` 和 `Trash` 继续保留 workflow 名称，因为它们跨多个事实和模型；不能为了目录统一把它们压成单个 `Persist`。
- `ContentImport` 不必为了“看起来像 Commands”把 staging/apply/fail/cancel 改成四个 user Commands；Job 状态机才是这些步骤的 lifecycle authority。
- 物理移动必须晚于调用方迁移和事务 owner 冻结；本项目不需要兼容 facade。旧 direct facade/Writer business arity 在迁移完成后应删除，剩余内部 helper 必须明确标为 persistence primitive 或 workflow step。

## 8. 下一阶段重构任务

### 8.1 冻结 DocTree mutation contract

为每个公开 mutation 建一张合同表，至少包含：initiator、GraphQL field、Command module、Gate action、branch/lifecycle/version authority、transaction owner、command identity、Confirmation/result、Activity/Outbox effect。

优先处理：

1. 让 `create_tab/group/page/link/pin`、`update/delete/duplicate/move/restore` 的公开 domain arity 都要求 actor + command id；不再用 Support 的 direct fallback 作为业务入口。
2. `PublishChanges` 必须明确是“Command 启动 Publish workflow”，还是纯内部 workflow；GraphQL 用户路径保留一个 command identity，内部 caller 不得使用无 identity 的 publish 业务入口。
3. `RestoreTrashItem` 的 import 内部调用改成明确的 workflow/persistence API，不能把 `Trash.restore` 的 direct path 和用户 Command 混在同一个 facade 名称下。
4. 对 `restore_doc_revision_to_draft`、DocTree mutation、Docs article mutation 统一 branch、Gate action 和 version authority；不能让不同 resolver 各自决定 resource scope。

### 8.2 收口一个事务 owner

先不改变业务结果，先改变调用合同：

- 将 `writer_impl/operation.ex` 的 branch resolve、global lock、Gate、state initialization、base revision check 和 node/event/revision write 固定为 tree mutation workflow owner。
- 把 `Events.record_staged_many`、`Revision.bump_tree_draft`、`State.ensure_*` 的业务 transaction 责任下沉为可组合 primitive；直接调用仍可使用 Repo，但必须显式接受 owner context，不能悄悄成为第二个业务事务。
- Page 创建/duplicate 与 Article Draft Store 的跨 context 写入要在同一个 owner 中验证回滚；覆盖 node insert、Article insert/update、event、revision 任一步失败的全量 rollback。
- Publish 继续由 `Publish.publish_changes` 持有外层 transaction；release/snapshot/public tree、doc draft、Outbox invalidation 的失败必须回滚为同一 publish attempt。
- Trash restore/delete 继续由 workflow 持有 Article mutation lock、tree lock、Trash action 和 Activity；不要将 Activity/Trash snapshot 直接放到基础 `Persist`。

### 8.3 完成 DocTree Receipt / recovery

- 对带 `commandId` 的所有 GraphQL mutation，保证首次执行、重复 command、response loss、冲突和业务失败都走同一 Confirmation/result builder。
- 删除/禁止无 command identity 的 user-facing facade arity；不添加生成默认 UUID 的兼容层。
- `CommandReplay` 只重放已保存的业务结果，不重新执行 Writer/Publish/Trash；确认 tree node、draft、release、trash 恢复 payload 都是 versioned JSON-safe codec。
- Outbox 只复用入口 command identity 或明确的 workflow identity；不为 source/destination、tree/doc scope、binding、provider effect 生成第二个业务 command id。
- 对 publish 的 cache/search invalidation 只作为 effect 处理；Receipt 保存 release/product result，不把非产品 effect 的 pending 状态冒充新的用户 command。

### 8.4 明确 ContentImport workflow 合同

推荐的产品/技术边界：

```text
preview target       -> Query/planning，不创建 Job
confirm/start        -> 创建或恢复一个 ImportJob
stage bodies         -> service workflow step，Job/Item/Body 幂等
apply                 -> workflow terminal step，一次 atomic Docs/Tree/Mapping commit
fail/cancel           -> workflow terminal transition
```

具体任务：

1. 冻结 `preview_ref` 是 confirmed intent identity、`job_ref` 是 durable process identity、`external_ref` 是 source item identity；禁止互相替代。
2. 决定 start 是否需要薄 `StartDocContentImport(commandId)`。若需要，Confirmation 只保存 `job_ref` 和首份 Job projection；若不需要，就把 `preview_ref` 重试/recovery 合同写清楚，不要在内部偷偷生成 command id。
3. 保持 `stage` 的 batch 上限、BodyBag canonical hash/size、ready/skip/fail 单向状态和 `(job_ref, external_ref)` 幂等；覆盖相同 bytes 重放、不同 bytes 冲突和 completed Job 重放。
4. 保持 `apply` 单事务：Job lock、intent revalidation、trashed target restore、Docs Draft、`DocTree.Import`、`ImportSourceMapping`、staging cleanup、Job result 必须一起提交或一起回滚。
5. 记录 apply 的结果投影和失败摘要；response loss 通过 `job_ref` 或相同 `preview_ref` 重发恢复，不依赖内存 worker 状态。
6. Node PreviewStore、Dataset/BodyBag、Files SDK 和生产 Blob 的架构以 [`docs/content-import/content-import-architecture.md`](../content-import/content-import-architecture.md) 为准；本文只负责 Phoenix 当前实现的 CMS 边界，不再创建第三套导入架构。

### 8.5 最后做物理目录迁移

```text
1. 冻结 mutation/workflow/identity/transaction 合同
2. 为 direct fallback、nested transaction、replay、import recovery 补 focused tests
3. 先拆 DocTree Writer 的 node/event/revision primitives 与 workflow owner
4. 再拆 Publish、Trash、Article integration 的目录边界
5. ContentImport 只在 workflow contract 冻结后决定是否引入 Query/Persist/Workflows 物理目录
6. 迁移所有 resolver、GraphQL、测试 fixture 和内部 caller
7. 删除旧 facade business arity 和伪兼容入口
8. 更新静态 identity/transaction boundary gate 与真实 focused suite 路径
```

## 9. 验收清单

### 当前已具备

- [x] DocTree GraphQL user mutations 使用 non-null `commandId`。
- [x] tree node、draft、move、publish、trash 等主要动作已有 concrete command 模块。
- [x] Tree/Node Draft/Publish confirmation 与 `CommandReplay` 已存在。
- [x] Tree `baseRevision`、Doc Draft `expectedVersion`、branch scope 分别承担并发/版本职责。
- [x] Query 通过 `CMS.Gate` 做 scoped read，不接收 Command/Receipt。
- [x] ContentImport 有 durable ImportJob、JobItem/Body staging、preview intent binding 和 atomic apply result。
- [x] `DocTree.Import` 使用稳定 source node identity，不为每个 imported node 生成 user command id。

### 仍未收口

- [ ] DocTree facade/Command Support 的 direct fallback 和无 actor convenience arity 清退。
- [ ] Publish/Trash/Article integration 的 workflow owner 与 user Command boundary 固化。
- [ ] Events/Revision/State/Writer 的 nested transaction API 改为显式 owner/context contract。
- [ ] 所有 tree/draft/publish/trash mutation 的 response-loss、重复 command、冲突和 replay focused coverage。
- [ ] GraphQL transport Passport 与 domain Gate action matrix 对齐并写入合同。
- [ ] ContentImport start 是否采用薄 Command + Receipt 的产品决策。
- [ ] ContentImport apply/retry/response-loss/duplicate staging/target conflict 的 focused recovery coverage。
- [ ] DocTree 物理目录按 `Commands / Query / Persist / Setup / Workflows` 收口；ContentImport 保持 workflow-first，不为形式添加空目录。

### 明确不在本文范围

- `CMS.DocCover` 的 Cover card/pin mutation；它是相邻 bounded context。
- Asset Upload、Provider cleanup、ReplacementPlan；见 [`cms-assets-refactor.md`](./cms-assets-refactor.md)。
- Article Activity export 产品；当前产品没有 Article activity export 功能。
- Auth/session、view/read markers 等明确的 Query/read 例外。
- Node Content Import 服务的生产部署、Browser E2E 和 Private Blob release gate；见 `docs/content-import/` 现有架构文档。

## 10. 证据与验证

主要执行入口：

- `backend/api/lib/groupher_server/cms/doc_tree.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/commands/`
- `backend/api/lib/groupher_server/cms/doc_tree/writer.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/writer_impl/operation.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/query.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/publish.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/trash.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/import.ex`
- `backend/api/lib/groupher_server/cms/content_import/jobs.ex`
- `backend/api/lib/groupher_server/cms/content_import/staging.ex`
- `backend/api/lib/groupher_server/cms/content_import/threads/doc/writer.ex`
- `backend/api/lib/groupher_server_web/schema/cms/mutations/doc_tree.ex`
- `backend/api/lib/groupher_server_web/schema/cms/content_import.ex`
- `backend/api/lib/groupher_server_web/resolvers/cms/docs.ex`
- `backend/api/lib/groupher_server_web/resolvers/content_import_resolver.ex`

配套领域文档：

- [`Content Import 总体架构`](../content-import/content-import-architecture.md)
- [`Content Import 重构与落地计划`](../content-import/content-import-refactor-plan.md)
- [`Content Import 产品流程`](../content-import/bulk-import.md)
- [`CMS Command Phase 5 主迁移记录`](./cms-command-phase-5-legacy-workflows.md)

本轮只新增本独立审计文档并更新文档索引，不修改 DocTree、ContentImport 或 GraphQL executable code，也不提交 Git commit。校验应至少执行 `git diff --check` 与 `pnpm docs:check`；这些检查证明文档和仓库文档门禁通过，不代表本文列出的 DocTree/ContentImport deferred work 已完成。
