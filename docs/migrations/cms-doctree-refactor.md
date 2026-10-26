# CMS DocTree / ContentImport：现状审计与独立重构计划

> 本文把 DocTree 与 Docs ContentImport 从 CMS Phase 5 总文档中单独拆出，记录当前真实功能、对外入口、Gate、lifecycle/version authority、identity、事务 owner、Receipt/workflow 边界和目录职责，并持续记录已落地的重构批次。
>
> 当前结论：DocTree 的 GraphQL 用户 mutation 已经有 concrete Command、非空 `commandId`、Confirmation/Replay 和明确的 Persist/Workflow owner；旧 Writer、writer_impl 和遗留 direct path 已在 caller migration 后删除。ContentImport 是一个有持久 Job、staging 和 atomic apply 的 workflow，现由 `DocTree.Workflows.ContentImport` 负责，不把内部步骤强行变成用户 Command。本文不创建第二套 Node/Phoenix 架构 source of truth。

### 0.1 本轮已落地的实现批次

- `CMS.DocTree.Workflows.TreeMutation` 现在是树 mutation 的 transaction/Gate/revision envelope owner；`Persist.Operation` 只保留 revision bump 和 payload helpers。
- `Events`、`Revision`、`State` 增加显式 owner 选项；树 workflow 继续持有与 `DocTree.initialize/read` 相同的 Docs site init lock，避免首次 state 初始化竞态，独立调用仍保留默认事务行为。
- `Commands.Support.run_tree_command/6` 与 `run_doc_command/8` 只接受显式 Command boundary；遗留无 identity 路径改为命名的 `run_tree_operation/3`、`run_doc_operation/3`，便于后续按调用方清退。
- ContentImport 的 mapped Trash restore 和 atomic apply 均走 `DocTree.Workflows.ContentImport`，不再借用用户 `DocTree` facade；`Jobs.create/3` 重试现在比较 dataset、source/target intent、bad smells 和每个 selected document 的完整持久化字段。
- 新增 Command boundary focused coverage；`mix test test/groupher_server/cms/doc_tree/ test/groupher_server/cms/content_import_flow_test.exs` 当前通过 88 tests，追加 `command_confirmation_test.exs` 后通过 97 tests。

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

| 对外能力                     | GraphQL 入口                   | 当前 domain owner                                                         | 当前结果/身份                                                              |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 编辑器 Draft tree            | `docTree`                      | `CMS.DocTree.read` → `DocTree.Query.read`                                 | Query；Gate scoped read，无 Command/Receipt                                |
| Public tree                  | `docPublicTree`                | `CMS.DocTree.read_public` → `DocTree.Query.read_public`                   | public query；只读公开 projection                                          |
| Draft document               | `docDraft`                     | `CMS.Docs.read_editor_head`                                               | Query；以 Article draft version 为版本 authority                           |
| Publish checklist            | `docPublishChecklist`          | `CMS.DocTree.publish_checklist` → `Publish.Checklist`                     | Query；以 staged events/revision/release readiness 为准                    |
| Trash drawer                 | `docTreeTrashItems`            | `CMS.DocTree.trash_items` → `Trash.list`                                  | Query；列出 branch-scoped product trash                                    |
| 创建 Tab/Group/Page/Link/Pin | `createDocTreeNode`            | `Commands.CreateNode` 分派到具体 Command/Persist                          | Command；`baseRevision` 做树并发检查                                       |
| 更新 node metadata           | `updateDocTreeNode`            | `Commands.UpdateNode`                                                     | Command；结果包含新 tree revision                                          |
| 更新 Draft 内容              | `updateDocDraft`               | `Commands.UpdateDraft` → Docs Draft store                                 | Command；`expectedVersion` 做文档版本检查                                  |
| Publish tree/docs changes    | `publishDocChanges`            | `Commands.PublishChanges` → `DocTree.Publish`                             | Command 启动 publish workflow；Confirmation 保存 release id                |
| Public page 回 Draft         | `moveDocToDraft`               | `Commands.MoveDocToDraft`                                                 | Command/Receipt；恢复时重新读取 editor head                                |
| subtree 批量建 Draft         | `moveDocTreeSubtreeToDraft`    | `Commands.MoveSubtreeToDraft`                                             | Command/Receipt；当前返回 done/affected count                              |
| 由 revision 恢复 Draft       | `restoreDocRevisionToDraft`    | `CMS.Docs.restore_revision_to_draft`                                      | Article/Docs command；不属于 tree node command，但共享 branch/version 合同 |
| 删除 node 到 product Trash   | `deleteDocTreeNode`            | `Commands.DeleteNode` → Persist/Trash                                     | Command；删除 snapshot 与 tree event 需要同一事务 owner                    |
| 从 product Trash 恢复        | `restoreDocTreeTrashItem`      | `Commands.RestoreTrashItem` → `Trash.restore`                             | Command/Receipt；旧 direct fallback 已删除                                 |
| 从 product Trash 永久删除    | `permanentlyDeleteTrashAction` | `Commands.PermanentlyDeleteTrashItem` → `Trash.permanently_delete_action` | 用户路径为 Command/Receipt；scheduler 使用独立 internal direct pipeline    |
| duplicate subtree/node       | `duplicateDocTreeNode`         | `Commands.DuplicateNode`                                                  | Command；可能同时创建 Article Draft                                        |
| 移动 node                    | `moveDocTreeNode`              | `Commands.MoveNode`                                                       | Command；`baseRevision` + branch lock                                      |

`addDocCoverCard`、`removeDocCoverCard`、pin/reorder 等 `DocCover` mutation 也出现在同一个 GraphQL schema 文件中，但 owner 是 `CMS.DocCover`，不是 DocTree 本次重构范围。它们应继续作为相邻 bounded context 处理，不能因为文件相同就把 Cover 的 transaction 或 Command 归入 DocTree。

### 2.2 ContentImport 对外能力

ContentImport 当前 GraphQL 入口位于 `GroupherServerWeb.Schema.CMS.ContentImport`，resolver 位于 `GroupherServerWeb.Resolvers.ContentImport`。它服务的是 GitHub Docs Dataset 的有界导入，不是普通编辑器 mutation。

| 对外能力        | GraphQL 入口                    | 当前 owner                              | identity / recovery                                              |
| --------------- | ------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| 预览目标树      | `previewDocContentImportTarget` | `Threads.Doc.Validator.preview`         | Query/planning；不创建 Job，不创建 Receipt                       |
| 创建或恢复 Job  | `startDocContentImport`         | `ContentImport.Jobs.create`             | `preview_ref` 绑定完整 confirmed intent；重复 start 返回同一 Job |
| 读取 Job        | `contentImportJob`              | `Jobs.get` → `Jobs.project`             | Query；以 `job_ref` 读取持久过程和结果                           |
| staging BodyBag | `stageDocContentImportBodies`   | `Staging.stage`                         | service workflow step；`(job_ref, external_ref, body_hash)` 幂等 |
| 原子 apply      | `applyDocContentImport`         | `DocTree.Workflows.ContentImport.apply` | workflow terminal step；锁 Job，写 Docs/Tree/Mapping，完成 Job   |
| 记录失败        | `failDocContentImport`          | `Jobs.fail`                             | workflow terminal transition；保留 error code/message            |
| 取消            | `cancelDocContentImport`        | `Jobs.cancel`                           | workflow transition；删除 staged bodies 并标记 cancelled         |

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
       -> Persist.Operation.run
       -> branch resolve
       -> transaction-scoped global doc-tree lock
       -> Gate.access_check(:manage_docs)
       -> DocsSiteState + draft state
       -> base_revision check
       -> Persist callback
            -> doc_tree_nodes draft
            -> staged DocTreeEvent
            -> tree/site revision bump
  -> canonical mutation payload + Receipt replay
```

`baseRevision` 冲突返回当前 tree state/affected nodes，不应重试成另一个 command。GraphQL path 和公开 domain mutation 现在都要求 actor 与非空 `commandId`；旧 convenience arity 与 `Support.run_tree_command` direct fallback 已删除，内部需要无 Receipt 的路径改走显式 named workflow/persistence API。

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

正文 Draft 的版本 authority 是 Article/Draft version；它不能用 tree `tree_lock_version` 代替。创建 Page 时，`Persist.create_page` 通过 `DraftDoc.ensure` 创建或复用默认 Article Draft，因此 Page node command 与 Article draft write 共享事务 owner。

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

Publish 是 workflow，不是“单个 node 的 one-shot write”。Command 的职责是保留用户入口、参数
canonicalization 和 Receipt；`Publish` 的职责是多事实发布、release/snapshot 和外部 invalidation。
当前用户入口会校验非空 `command_id`；内部调用必须显式使用 `execute_direct/4`，由独立
`direct_pipeline` 承担 Gate/transaction 边界，不伪装成带 Receipt 的用户重放。

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

Trash 不是单纯 `doc_tree_nodes` delete：它要保存可恢复的 tree/article 关系，并可能写 Activity。
当前用户入口校验非空 `command_id`；ContentImport 恢复导入目标时显式使用 `execute_internal/3`，进入
独立 internal `direct_pipeline`。该入口没有用户 Receipt 语义，也不会生成第二个用户 command identity。

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

`DocTree.Workflows.ContentImport.apply` 已经把 Docs、Tree、Mapping、staging 清理和 Job completion 放进一个 apply transaction；完成 Job 再次 apply 时返回持久化 projection。它不是 `CMS.Command` 的 Receipt，但它已经是 workflow 自己的结果恢复协议。

## 5. Gate、事务和结果恢复审计

### 5.1 Admission

- `DocTree.Query.read/read_public` 使用 `CMS.Gate.scope` 取得 community/branch scoped resource；Query 不接收 command id，也不创建 Receipt。
- `Persist.Operation.run` 在 tree lock 内调用 `CMS.Gate.access_check(actor, :manage_docs, community)`，并复用 canonical community/state。
- GraphQL tree mutation 当前统一做 `Authorize(:login)`、`FrontDesk(:community)`、`PutCurrentUser`；Draft mutation 还加 `BodyBagTrust` 和 `FrontDesk(:article_editor, thread: :doc)`。GraphQL schema 本身没有在每个 DocTree mutation 上显式列出 Passport action，领域 Gate 是真正的 docs management admission；transport 与 domain policy 的 action matrix 已按现有 Command contract 对齐。
- ContentImport start 由用户 Passport `doc.import` 加 delegated service scope admission；preview/stage/apply/fail/cancel 的部分入口是 service scope，依赖 `community` FrontDesk 和受信 service identity。Job 的 community/job_ref 绑定必须继续在领域层校验，不能只信 transport scope。

### 5.2 Transaction owner

当前实现的正常执行关系是：

| 路径                     | 当前 owner                                                                 | 现状判断                                                                              |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| tree node write          | `TreeMutation` → outer `Repo.transaction` → `Persist.Operation.run`        | 全局 advisory transaction lock、Gate、revision check 和 node callback 在同一 owner 内 |
| staged event             | `Persist.EventRecorder` 接收 owner context                                 | event primitive 不再成为独立业务 transaction owner                                    |
| revision bump            | `Persist.Index` / `Persist.Operation` 接收 owner context                   | revision primitive 不再隐藏第二个业务 transaction                                     |
| publish                  | `Publish.publish_changes` 的 branch/global lock + outer `Repo.transaction` | 当前最接近完整 workflow owner；release/snapshot/outbox 应继续留在这一层               |
| trash restore            | global tree lock + Article mutation lock + Trash callback                  | 跨 Article/tree/Activity；不能下沉成单表 Persist                                      |
| import stage/fail/cancel | `ContentImport.Workflow` + Job `FOR UPDATE`                                | 单个 workflow transition；job lock 是并发 authority                                   |
| import apply             | `DocTree.Workflows.ContentImport` + Job lock，再进入 DocTree global lock   | Docs、Tree、Mapping、staging cleanup、Job completion 的 atomic apply owner 已明确     |

因此，本轮已将 Command 或 named workflow 的显式 transaction owner 固定在 `TreeMutation`、Publish、Trash 和 `DocTree.Workflows.ContentImport`；Persist 只接受 owner context，不再隐藏另一个业务事务。`scripts/check-cms-context-module-boundary.mjs` 当前报告 0 findings。

### 5.3 Confirmation / result recovery

| 路径                         | 当前恢复方式                                                                          | 当前缺口                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 带 commandId 的 tree command | `CMS.Command` Receipt + `TreeConfirmation` + `CommandReplay`                          | GraphQL 与公开 domain path 统一使用同一 Confirmation/Replay 合同                                      |
| UpdateDraft                  | `NodeDraftConfirmation` 记录 article/draft 结果                                       | 无 command id 的旧 facade path 已删除                                                                 |
| MoveDoc/Subtree              | 专用 confirmation 保存 doc/affected count                                             | 应继续确认 `commandId` 与 effect 只使用入口 identity                                                  |
| Publish                      | `PublishChangesConfirmation` 保存 `release_id/done`，present 时重读 release/checklist | publish effect 使用入口 command/workflow identity，不生成第二个产品 command                           |
| Trash restore                | Tree confirmation/replay 在带 identity 时可恢复                                       | import 内部调用显式走 ContentImport workflow，不伪装成用户 Receipt                                    |
| ContentImport start          | 重复 `preview_ref` + 完整 intent 比较返回同一 Job                                     | 初次 start response 丢失时只能重发同一 Preview intent；若产品要求标准 Receipt，应增加薄 Start command |
| ContentImport stage          | 同一 Job/item/body hash 重放返回既有事实                                              | 每批 service call 不是用户 Receipt；Job projection 是恢复入口                                         |
| ContentImport apply          | 已完成 Job 返回持久化 result/projection；失败整体回滚                                 | response loss、重复 apply、Job lock/terminal state 已有 focused recovery 覆盖                         |

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
├── persist.ex                           # node mutation persistence facade
├── persist_impl/                        # node/index/identity/event/revision helpers
├── operation.ex (persist_impl)           # lock + Gate + revision envelope
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

当前结构的优点是 `commands/` 已经表达用户 use case，`publish/` 和 `workflows/` 明确表达跨文档/树的 workflow；`persist.ex` 与 `persist_impl/` 承担可组合的 node/index/event/revision primitive，`TreeMutation`、Publish、Trash 和 ContentImport workflow 持有业务 transaction owner。

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
    └── validator.ex                    # target tree/intent validation
    └── (apply owned by DocTree.Workflows.ContentImport)
```

ContentImport 的 `persistence/` 和 `threads/doc/` 保留数据 primitive 与 validator；atomic apply 已收口到 `DocTree.Workflows.ContentImport`。不应为了形式再复制一套 `Commands/Query/Persist/Setup` 空目录；workflow identity、job transition、atomic apply 和 service admission 已形成稳定合同。

### 6.3 与项目规范的对照

项目中较清晰的模式是：

```text
CMS.<BusinessContext>
├── Commands/     # 用户业务动作与 Confirmation
├── Query/        # 读模型/查询
├── Persist/      # 无业务 admission 的持久化 primitive
└── Setup/        # 初始化；没有才不创建
```

DocTree 当前已形成 `Commands`、`Query`、`Persist`、`Effects`、`Projection` 和 `Workflows` 边界；ContentImport 没有普通 user Command 子域，而是由 `DocTree.Workflows.ContentImport` 负责的独立 workflow context。

## 7. 已落地目录和 owner

以下是本轮完成后的物理目录和 owner：

```text
CMS.DocTree
├── commands/                           # user Command + Confirmation
├── query.ex                             # read/scoped projection
├── persist.ex                           # transaction-free persistence facade
├── persist_impl/                        # node/event/revision primitives
│   ├── node.ex
│   ├── event_recorder.ex
│   ├── operation.ex
│   └── index.ex
├── workflows/
│   ├── tree_mutation.ex                 # branch lock + Gate + one transaction owner
│   ├── publish/                         # release/snapshot/public projection
│   └── trash/                           # restore/delete + Article membership + Activity
├── integrations/
│   └── article_draft.ex                 # page create/update hooks, if still needed
├── import.ex                            # import projection primitive called by Import workflow
├── replay.ex / commands/*_confirmation.ex # Receipt/replay codecs
└── setup.ex                             # only branch/site initialization

CMS.ContentImport + CMS.DocTree.Workflows.ContentImport
├── jobs.ex / staging.ex                  # Job lifecycle and bounded staging
├── threads/doc/validator.ex              # intent validation
└── doc_tree/workflows/content_import.ex  # atomic apply/recovery owner
```

取舍：

- `Setup` 只给 `DocTree.initialize`/DocsSiteState 初始化使用，不把它做成普通 mutation 兼容入口。
- `Persist` 不调用 Gate、不生成 UUID、不写 Activity/Outbox、不包业务 transaction；它接受上层已解析的 branch/canonical resource 和 owner context。
- `Publish` 和 `Trash` 继续保留 workflow 名称，因为它们跨多个事实和模型；不能为了目录统一把它们压成单个 `Persist`。
- `ContentImport` 不必为了“看起来像 Commands”把 staging/apply/fail/cancel 改成四个 user Commands；Job 状态机才是这些步骤的 lifecycle authority。
- caller migration 和 transaction owner 已冻结；旧 direct facade/Writer business arity、兼容入口和旧物理目录已删除，剩余内部 helper 均明确为 persistence primitive 或 workflow step。

## 8. 本轮已完成记录

### 8.1 冻结 DocTree mutation contract

为每个公开 mutation 建一张合同表，至少包含：initiator、GraphQL field、Command module、Gate action、branch/lifecycle/version authority、transaction owner、command identity、Confirmation/result、Activity/Outbox effect。

已完成：

1. `create_tab/group/page/link/pin`、`update/delete/duplicate/move/restore` 的公开 domain arity 均要求 actor + command id；GraphQL-shaped request 已 fail-closed，旧无 identity arity 已删除。
2. `PublishChanges` 已明确为 Command 启动 Publish workflow；GraphQL 用户路径保留一个 command identity，内部 caller 不使用无 identity 的 publish 业务入口。
3. `RestoreTrashItem` 的 import 内部调用已改成明确的 ContentImport workflow API，不再与用户 Command 混用。
4. `restore_doc_revision_to_draft`、DocTree mutation、Docs article mutation 已统一 branch、Gate action 和 version authority。

### 8.2 收口一个事务 owner

已在不改变业务结果的前提下完成调用合同收口：

- `persist_impl/operation.ex` 的 branch resolve、global lock、Gate、state initialization、base revision check 和 node/event/revision write 已固定为 tree mutation workflow owner。
- `Persist.EventRecorder`、`Persist.Index`、`State.ensure_*` 的业务 transaction 责任已下沉为可组合 primitive，并显式接受 owner context。
- Page 创建/duplicate 与 Article Draft Store 的跨 context 写入已在同一个 owner 中验证回滚。
- Publish 由 `Publish.publish_changes` 持有外层 transaction；release/snapshot/public tree、doc draft、Outbox invalidation 的失败回滚为同一 publish attempt。
- Trash restore/delete 由 workflow 持有 Article mutation lock、tree lock、Trash action 和 Activity。

### 8.3 完成 DocTree Receipt / recovery

- 带 `commandId` 的所有 GraphQL mutation，首次执行、重复 command、response loss、冲突和业务失败都走同一 Confirmation/result builder。
- 无 command identity 的 user-facing facade arity 已删除，没有生成默认 UUID 的兼容层。
- `CommandReplay` 只重放已保存的业务结果，不重新执行 Persist/Publish/Trash；tree node、draft、release、trash 恢复 payload 都是 versioned JSON-safe codec。
- Outbox 只复用入口 command identity 或明确的 workflow identity，不为 source/destination、tree/doc scope、binding、provider effect 生成第二个业务 command id。
- publish 的 cache/search invalidation 只作为 effect 处理；Receipt 只保存 release/product result。

### 8.4 明确 ContentImport workflow 合同

已落地的产品/技术边界：

```text
preview target       -> Query/planning，不创建 Job
confirm/start        -> 创建或恢复一个 ImportJob
stage bodies         -> service workflow step，Job/Item/Body 幂等
apply                 -> workflow terminal step，一次 atomic Docs/Tree/Mapping commit
fail/cancel           -> workflow terminal transition
```

已完成合同：

1. 冻结 `preview_ref` 是 confirmed intent identity、`job_ref` 是 durable process identity、`external_ref` 是 source item identity；禁止互相替代。
2. start 保持 Job-only workflow：`preview_ref` 与完整 confirmed intent 负责重试/recovery，不增加薄
   `StartDocContentImport` Command，也不在内部生成 command id。
3. 保持 `stage` 的 batch 上限、BodyBag canonical hash/size、ready/skip/fail 单向状态和 `(job_ref, external_ref)` 幂等；覆盖相同 bytes 重放、不同 bytes 冲突和 completed Job 重放。
4. 保持 `apply` 单事务：Job lock、intent revalidation、trashed target restore、Docs Draft、`DocTree.Import`、`ImportSourceMapping`、staging cleanup、Job result 必须一起提交或一起回滚。
5. 记录 apply 的结果投影和失败摘要；response loss 通过 `job_ref` 或相同 `preview_ref` 重发恢复，不依赖内存 worker 状态。
6. Node PreviewStore、Dataset/BodyBag、Files SDK 和生产 Blob 的架构以 [`docs/import/content-import-architecture.md`](../import/content-import-architecture.md) 为准；本文只负责 Phoenix 当前实现的 CMS 边界，不再创建第三套导入架构。

### 8.5 物理目录迁移（已完成）

```text
1. mutation/workflow/identity/transaction 合同已冻结。
2. direct fallback、nested transaction、replay、import recovery 已有 focused tests。
3. DocTree node/event/revision primitives 与 workflow owner 已拆分。
4. Publish、Trash、Article integration 的目录边界已收口。
5. ContentImport 已采用 workflow-first 的 Workflows 物理目录。
6. resolver、GraphQL、测试 fixture 和内部 caller 已完成迁移。
7. 旧 facade business arity 和伪兼容入口已删除。
8. 静态 identity/transaction boundary gate 与 focused suite 已更新并通过。
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

### 本轮已收口

- [x] DocTree facade 的无 actor convenience arity 已清退；GraphQL-shaped request 不再静默 direct fallback。
- [x] Tree mutation workflow owner 与 user Command boundary 已拆出；Publish/Trash/Article integration 已完成 workflow owner 收口。
- [x] Events/Revision/State/Tree Persist owner 内调用已改为显式 transaction/lock 选项；独立 public helper 仍保留默认事务兼容行为。
- [x] 所有 tree/draft/publish/trash mutation 的 response-loss、重复 command、冲突和 replay focused coverage 已纳入 suite。
- [x] GraphQL transport Passport 与 domain Gate action matrix 已对齐到现有 Command contract。
- [x] ContentImport start 保持 Job-only workflow；`preview_ref` + 完整 confirmed intent 是 start retry/recovery 合同，不为 stage/apply/fail/cancel 生成用户 command id。
- [x] ContentImport `preview_ref` 重放会比较 selected document 的完整持久化 intent，而不是只比较 source hash。
- [x] ContentImport apply/retry/response-loss/duplicate staging/target conflict 的 focused recovery coverage 已通过。
- [x] DocTree 物理目录已按 `Commands / Query / Persist / Setup / Workflows` 收口；ContentImport 保持 workflow-first。

### 明确不在本文范围

- `CMS.DocCover` 的 Cover card/pin mutation；它是相邻 bounded context。
- Asset Upload、Provider cleanup、ReplacementPlan；见 [`cms-assets-refactor.md`](./cms-assets-refactor.md)。
- Article Activity export 产品；当前产品没有 Article activity export 功能。
- Auth/session、view/read markers 等明确的 Query/read 例外。
- Cloudflare `import` / `converter` 服务的生产部署与验收；见 [`cloudflare-workers-migration-plan.md`](../import/cloudflare-workers-migration-plan.md)。

## 10. 证据与验证

主要执行入口：

- `backend/api/lib/groupher_server/cms/doc_tree.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/commands/`
- `backend/api/lib/groupher_server/cms/doc_tree/persist.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/persist_impl/operation.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/query.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/publish.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/trash.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/import.ex`
- `backend/api/lib/groupher_server/cms/content_import/jobs.ex`
- `backend/api/lib/groupher_server/cms/content_import/staging.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/workflows/content_import.ex`
- `backend/api/lib/groupher_server_web/schema/cms/mutations/doc_tree.ex`
- `backend/api/lib/groupher_server_web/schema/cms/content_import.ex`
- `backend/api/lib/groupher_server_web/resolvers/cms/docs.ex`
- `backend/api/lib/groupher_server_web/resolvers/content_import_resolver.ex`

配套领域文档：

- [`Content Import 总体架构`](../import/content-import-architecture.md)
- [`Content Import 重构与落地计划`](../import/content-import-refactor-plan.md)
- [`Content Import 产品流程`](../import/bulk-import.md)
- [`CMS Command Phase 5 主迁移记录`](./cms-command-phase-5-legacy-workflows.md)

本轮已完成 DocTree/ContentImport 的 Command boundary、Tree workflow owner、owner-context transaction primitives 和 ContentImport intent comparison，并完成旧入口物理收口；未修改 GraphQL schema 的产品字段，也不提交 Git commit。`git diff --check`、backend focused/full suite、`mix compile --warnings-as-errors` 与 `pnpm docs:check` 均已通过。
