# CMS Facade 与实现目录收口

> 状态：F1–F13 已实施，公开 API 保持不变；实施验证记录见 §6.3。
>
> 范围：`backend/api/lib/groupher_server/cms` 下的公开 Context/facade 与同名实现目录。
> 本文只调整内部文件职责，不改变 GraphQL、Job 或领域调用方使用的公开 API。

相关文档：

- [CMS Query V2](./cms-query-v2.md)：冻结 Query、Store/Facts 与 FrontDesk 边界；
- [Backend Rules](../rules/be.md)：后端模块所有权和 facade 约束；
- [Command：复杂领域操作的组织边界](../feature/artiment/command.md)：Command、Writer、Gate、Lifecycle 与事务职责；
- [Groupher Action Matrix 与 Transition Contract](../feature/lifecycle/transition-contract-improvement.md)：`commandId`、`CMS.Command.Receipt` 和具体 action 的执行合同；
- [Optimistic Operation](../migrations/tanstack/optimistic-operation.md)：前端 operation 到后端 command 的衔接。

## 1. 问题

CMS 顶层 Context 文件同时承担两种角色：

```text
GraphQL / Job / domain caller
              |
              v
      CMS.<Domain> facade
              |
              v
       domain implementation
```

正常情况下，顶层模块负责稳定公开 API、参数形状和少量领域编排，具体读取、写入、Command、
projection、cache 和外部副作用由同名目录下的 owner 模块承担。

当前部分模块已经遵守这个结构，例如：

```text
CMS.Comments
  -> Comments.Query / Writer / Commands / States / Moderation

CMS.Command.Receipt
  -> CMS.Command.Receipt.Key / Runner / Store
```

但还有一些顶层 facade 直接包含大量 Repo 查询、事务、HTTP 调用、projection、replay 或 retention
实现。文件名仍表达“公开边界”，实际却成为实现容器，导致：

- facade 的稳定 API 与内部算法一起变化；
- 不同职责只能依靠文件内私有函数区分；
- 测试难以按 owner 聚焦；
- 新逻辑继续向顶层文件堆积；
- review 难以判断某段代码属于公开合同还是可替换实现。

## 2. 已冻结决策

### 2.1 公开 API 不变

目录收口只改变 facade 内部调用：

```text
改造前
  caller -> CMS.FrontDesk.article -> facade 内直接查询

改造后
  caller -> CMS.FrontDesk.article -> FrontDesk.Article.read
```

调用方继续使用：

```elixir
CMS.Articles.publish_draft(...)
CMS.DocTree.update_node(...)
CMS.FrontDesk.article(...)
CMS.Snapshot.users(...)
CMS.Press.site_manifest(...)
CMS.Wallpaper.publish(...)
```

不得为了移动内部实现，要求 GraphQL resolver、Job 或领域调用方改用子模块。

### 2.2 读取模块统一命名为 Query

> 历史 F1–F7 文档曾使用 `Reader`。该命名已经被 [CMS Query V2](./cms-query-v2.md)
> 取代；新代码和后续审计统一使用 `Query`、`Store/Facts` 或具名 read owner。

读取职责按以下规则判断：

```text
single resource       -> CMS.FrontDesk
list/search/aggregate -> CMS.<Domain>.Query
persisted facts       -> CMS.<Domain>.Store / Facts
projection/cache      -> owning Projection / Cache
```

不得新增 `*.Reader`、`*.List` 或 Reader/Query 双轨兼容层。历史段落、旧目录名和旧测试名称如仍
出现 `Reader`，只能作为迁移记录理解，不能作为新实现的命名依据。

### 2.3 复杂操作使用 commands/ 目录

Command 按业务动作放入 `commands/`，沿用现有 `Comments.Commands.*` 结构：

```text
<domain>/commands/<action>.ex
CMS.<Domain>.Commands.<Action>
```

Command 模块负责：

- `commandId` 和 `CMS.Command.Receipt` 编排；
- 调用具体 Writer、Lifecycle、Gate 或领域服务；
- replay 和权威结果重读；
- 一个完整 action 的事务边界。

Command 不复制底层 Writer，也不建立通用 Command Bus、DSL 或 callback registry。

### 2.4 facade 可以编排，但不拥有实现

允许留在 facade：

- 稳定公开函数和类型合同；
- 参数默认值与轻量归一化；
- 未登录等公开边界分流；
- 一到两步、没有私有算法的领域路由。

应下沉到同名目录：

- Ecto query、Repo 写入和 transaction；
- 外部 HTTP、异步清理和 retention；
- projection、codec、cache key 和 replay 算法；
- 需要多个私有 helper 才能表达的完整业务 action。

行数不是唯一标准。较长的纯 facade 可以保留；较短但拥有事务或外部副作用的函数也应下沉。

## 3. 当前审计结果

本次检查覆盖 `cms/*.ex` 的全部顶层模块、同名目录、Query V2、Command/Receipt、资源加载规则，
以及 GraphQL、Job 和领域生产调用者。之前只列 F1–F7 七个模块的表格不完整，尤其遗漏了
`CMS.Docs` 和 `CMS.Communities.request_destroy/3`。

### 3.1 本轮收口项

| 优先级 | 顶层模块          | 当前问题                                                                            | 目标                                                      |
| ------ | ----------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| F8     | `CMS.Docs`        | editor head、draft update、publish、restore、materialization 已移出 facade          | `Docs.Editor` + `Docs.Commands.*` + `Docs.BranchVersions` |
| F9     | `CMS.Communities` | `request_destroy/3` 已移除 facade 内的 Command/Gate/Lifecycle 编排                  | `Communities.Commands.RequestDestroy`                     |
| F10    | `CMS.Articles`    | archive/sink/status/category/comment-lock/moderation 已移入具体 Commands            | `Articles.Commands.*`                                     |
| F11    | `CMS.Comments`    | create/reply/pin/fold/moderation 已移入具体 Commands；ID 兼容入口先解析再进入 owner | `Comments.Commands.*`                                     |
| F12    | `CMS.Assets`      | 剩余入口逐项审计为一到两步 Writer delegate，无需虚构 Commands                       | `Assets.Writer` / `Assets.Deletion` / existing owners     |
| F13    | `CMS.Command`     | execute contract 已收紧为 typed Confirmation action result                          | `CMS.Command` + `Receipt`                                 |

已完成的 F1–F7 实施结果：

| 模块            | 当前状态                                                            |
| --------------- | ------------------------------------------------------------------- |
| `CMS.Wallpaper` | 已拆为 Query、Upload、Publisher、Retention                          |
| `CMS.Press`     | 已拆为 Query、Projection、ConfigWriter、Invalidation                |
| `CMS.DocTree`   | 已有 Commands、Query、Writer、Publish、Trash                        |
| `CMS.FrontDesk` | 已按 Article、Comment、Community、Relation 等内部 owner 拆分        |
| `CMS.Snapshot`  | 已拆为 Query、Cache、Projection、Refresh                            |
| `CMS.Assets`    | Deletion 与 ReplaceUse 已完成；其余入口确认保持轻量 Writer delegate |
| `CMS.Kanban`    | 本轮已完成 Commands、Query 和 canonical Article/Community 入口      |

### 3.2 本轮实施边界

`CMS.Docs` 的 `read_editor_head/3`、`update_draft/4`、`publish_branch/4` 和
`restore_revision_to_draft/5` 现在分别经过 `Docs.Editor` 与具体 Commands；facade 只保留稳定入口和
轻量 BranchVersions delegate。

`CMS.Communities.request_destroy/3` 现在由 `Communities.Commands.RequestDestroy` 拥有 action、
Confirmation、Gate、Lifecycle 和 receipt result，顶层只保留 delegate。

`CMS.Articles` 的 Kanban `set_status/4`、普通 `set_status/3`、sink、moderation 和 comment lock
现在都进入具体 command owner；projection map 的兼容入口在 command boundary 只解析一次 canonical Article。

`CMS.Comments` 的 ID overload 作为现有可信内部兼容入口保留；struct 入口是 Commands 的主要合同，
facade 不再把已加载 struct 降级为 ID 后交给 Writer/States/Moderation。

### 3.3 已审计且刻意保留的 owner

以下模块当前不因“文件内有 Repo/Ecto/helper”而纳入 facade 迁移：

- 基础设施：`CMS.Command`、`CMS.Outbox`、`CMS.QueryBuilder`、`CMS.ErrorCat`、`CMS.CanonicalJson`、`CMS.Hash`、`CMS.Const`；
- 领域实现：`CMS.ArticleStats`、`CMS.DocPublishRelease`、`CMS.Trash`、`CMS.ShadowSync`、`CMS.Marker`；
- 稳定 facade：`CMS.AbuseReports`、`CMS.CommunityApplications`、`CMS.DocCover`、`CMS.Dashboard`、
  `CMS.Events`、`CMS.Gate`、`CMS.Interactions`、`CMS.Passport`、`CMS.Policy`、`CMS.Search`、
  `CMS.SearchArtiments`、`CMS.Seeds`、`CMS.ViewTracker`、`CMS.ArtimentMentions`。

`CMS.Command` 不是普通产品 facade。它拥有 commandId、operation tag、target identity、
Confirmation contract 和 Receipt 执行边界，不能因为模块名或 helper 较多就机械拆分；后续只需
单独审计其 typespec 与 Command V3 文档一致性。

## 4. 目标目录

### 4.1 Assets

目标：只下沉已经越过 facade 边界的删除实现，不扩大抽象。

```text
assets.ex
  -> public API

assets/deletion.ex
  -> delete_application_upload_object
  -> delete_generated_assets
  -> provider object deletion enqueue
```

Facade 保留原函数名和返回值：

```elixir
CMS.Assets.delete_generated_assets(community, public_refs)
CMS.Assets.delete_application_upload_object(upload)
```

### 4.2 Docs Commands 与 Projection

`CMS.Docs` 不是纯路由 facade。目标目录如下：

```text
docs.ex
  -> Docs.Query / BranchVersions
  -> Docs.Commands.UpdateDraft
  -> Docs.Commands.PublishBranch
  -> Docs.Commands.RestoreRevisionToDraft
  -> Docs.DraftResult / Projection
```

具体职责：

- `read_editor_head/3`：由 Query 和 DraftResult/Projection 承担 branch、lifecycle 和
  draft/public materialization；
- `update_draft/4`：由 `Commands.UpdateDraft` 承担版本冲突、Gate、draft 初始化和写入；
- `publish_branch/4`：由 `Commands.PublishBranch` 承担 Gate、发布和 PublishEffects；
- `restore_revision_to_draft/5`：由 `Commands.RestoreRevisionToDraft` 承担 Gate 和 restore；
- `list_branch_versions/3`、`get_branch_version/3`、`diff_versions/4`：可以继续作为轻量
  facade delegate 到 `Docs.BranchVersions`。

`stable_doc/1`、actor normalization 和结果 materialization 不应继续作为 `docs.ex` 的私有业务
算法。公开 Doc API 的参数和返回形状保持不变。

### 4.3 Communities RequestDestroy

```text
communities.ex
  -> Communities.Commands.RequestDestroy
       -> CMS.Command
       -> Gate / Lifecycle / Confirmation
```

`CMS.Communities.request_destroy/3` 只保留公开入口。Command、Gate、Lifecycle、Confirmation 和
receipt result projection 全部归入具体 action；字符串/ID 兼容入口 `request_destroy/2` 仍按现有
Lifecycle 合同保留，不能与 authenticated command 入口混为一谈。

### 4.4 Articles 与 Comments 延迟写入口

Articles 的延迟写动作已统一进入现有 concrete command owner：

```text
archive
sink / undo_sink
set_cat / set_status
update_active_timestamp
lock_comments / undo_lock_comments
set_illegal / unset_illegal / set_audit_failed
```

这些动作分别由 `Commands.Archive`、`Commands.StateChange`、`Commands.CommentLock`、
`Commands.Moderate` 和既有 Articles state owner 承担；Kanban 专用 `set_status/4` 与普通
`set_status/3` 的边界不同，但两者都已通过 concrete command/owner 进入 Gate 和状态写入路径。

Comments 的写入口已统一进入现有 concrete command/state owner：

```text
create_comment* / reply_comment*
pin_comment / undo_pin_comment
fold_comment / unfold_comment
set_comment_illegal / unset_comment_illegal
set_comment_audit_failed / paged_audit_failed_comments
```

其中 `update_comment`、`delete_comment`、`create/reply` 使用具体 Commands，pin/fold 使用
`Comments.Commands.StateChange`，moderation 使用 `Comments.Commands.Moderate`；ID overload
只在兼容入口解析一次 canonical Comment，不把已加载 struct 降级为 ID。

### 4.5 Assets 剩余 Writer 入口审计

`Assets.Deletion` 和 `Assets.Commands.ReplaceUse` 已完成。以下入口已逐项确认保持简单
Writer delegate；它们不携带独立 commandId、跨步骤 Gate 或额外事务编排：

```text
register / register_to_community
delete / archive / restore
link_refs / copy_refs / cleanup_refs
```

资源形态、事务边界、commandId 和生产调用者已核对；需要完整 action 编排的新入口仍必须进入
`Assets.Commands.*`，不得继续扩展 Writer delegate。

### 4.6 Articles Commands

```text
articles.ex

articles/commands/
├── create.ex
├── update.ex
├── draft.ex
├── publish.ex
└── trash.ex
```

```text
CMS.Articles
  -> Commands.Create
  -> Commands.Update
  -> Commands.Draft
  -> Commands.Publish
  -> Commands.Trash
       -> CMS.Command.Receipt
       -> existing Draft / Publish / Trash implementation
```

`Commands.Trash` 完整承接以下公开入口的 command/receipt 编排：

```text
trash
restore_trashed
permanently_delete_trashed -> permanently_delete
```

同时下沉与这些入口配套的 `replay_or_resolve_missing_trash`、`replay_restored_article`、
`persist_denied_trash` 等私有编排，不能只移动首次 trash 而把 restore/permanent-delete replay
留在 facade。

边界说明：

- `Draft`、`Publish`、`Trash` 继续拥有对应领域状态和持久化；
- `Commands.*` 只拥有 authenticated command、receipt 和 replay 编排；
- denied Activity 的事务外写入属于具体 Trash command，不移回共享 `CMS.Command.Receipt.Runner`；
- `Articles` facade 继续暴露现有函数，调用方不引用 `Commands.*`。

### 4.7 DocTree Commands

```text
doc_tree.ex

doc_tree/commands/
├── node.ex
├── publish.ex
└── trash.ex
```

```text
Commands.Node
  -> create_node/create_page
  -> update/delete/duplicate/move node

Commands.Publish
  -> publish changes
  -> move doc/subtree to draft

Commands.Trash
  -> restore trash item
```

现有 `DocTree.Writer`、`DocTree.Publish` 和 `DocTree.Trash` 继续拥有底层行为；Commands 负责
`commandId`、`CMS.Command.Receipt`、replay 编排和执行入口。版本化 codec 继续由
`DocTree.CommandReplay` 独立拥有，Commands 只调用它，不复制或内联其协议实现。

范围必须保持精确：

- `create_node/4` 和 `create_page/4` 已通过 `run_tree_command` 使用 `commandId`，必须与其
  receipt/replay 编排一并下沉到 `Commands.Node`；
- `create_tab/create_group/create_link/create_pin` 这四个命名单一入口当前不经过 receipt；F3 中继续由
  facade 直接转发 `DocTree.Writer.create_*`。不得仅因为建立 `Commands.Node` 就为它们新增
  command/receipt 支持；
- `trash_items/2` 是读取入口，继续由 facade 转发 `DocTree.Trash.list/2`，不属于 Command；
- `restore_trash_item/3` 归入 `Commands.Trash`；
- `delete_node/3` 归入 `Commands.Node`，它删除树节点并创建可恢复快照，但不是“永久删除 Trash item”；
- 永久删除入口仍是 `CMS.Trash.permanently_delete_action/3`，并继续路由到
  `CMS.DocTree.Trash.permanently_delete_action/3`。该路径当前不使用 receipt/replay，不在 F3
  范围内，也不为此新增 `CMS.DocTree` 公开入口。

### 4.8 Press

```text
press.ex                        # public facade

press/
├── config.ex                  # 已存在：静态 thread contract
├── query.ex                   # article/feed/manifest authority reads
├── projection.ex              # article/feed/community/config projection
├── config_writer.ex           # persisted config + Activity
└── invalidation.ex            # Press HTTP cache invalidation
```

```text
CMS.Press
  ├── config/update_config -> ConfigWriter
  ├── article/feed/manifest -> Query -> Projection
  └── invalidate           -> Invalidation
```

`Config` 继续只表示 Press-owned 静态配置，不把数据库中的 `PressConfig` 写入逻辑塞入该模块。

### 4.9 Wallpaper

```text
wallpaper.ex                    # public facade

wallpaper/
├── error_cat.ex               # 已存在
├── request_digest.ex          # 已存在
├── settings.ex                # 已存在
├── query.ex                   # wallpaper/settings/history
├── upload.ex                  # targets + prepare_upload
├── publisher.ex               # publish + restore + receipt replay
└── retention.ex               # reconcile_lifecycle
```

```text
CMS.Wallpaper
  ├── wallpaper/settings/history -> Query
  ├── prepare_upload             -> Upload
  ├── publish/restore            -> Publisher
  └── reconcile_lifecycle        -> Retention
```

不建立 Wallpaper 通用 `Store`。各模块拥有自己的查询和事务，避免 `Store` 再次成为无业务语义的
数据库 helper 集合。

### 4.10 FrontDesk

FrontDesk V2 已直接切换。以下目录只描述当前资源 facade 与稳定关系，
不再保留 V1 的通用 lookup、reaction-users 或写操作转发：

```text
front_desk.ex                   # public facade

front_desk/
├── article.ex                  # article path、Gate scope、query、Response
├── comment.ex                  # comment path、named internal view
├── community.ex                # community 与 community tag
└── relation.ex                 # author_of/article_of/thread_of
```

```text
现有 caller
  -> CMS.FrontDesk.article/comment/community/...
       -> FrontDesk.Article / Comment / Community / Relation
```

特殊入口的当前合同：

- `article_for_view_tracking/1`、`lock_article_for_view_tracking/1` 已按 FrontDesk V3 移入 Root Article
  read 与 ViewTracker 私有事务 loader，
  不改造成通用 `FrontDesk.article/…` view；
- `article_insights/3` 已移入 `Analysis.ArticleInsights.trend_by_path/3`，保留 Article 专属
  `:read_insights` action/view，不新增 FrontDesk mode；
- `community_tag/1,3`、`community_tag_group/1` 保留为稳定业务关系 lookup，不扩展为 batch facade；
- `full_comment/1` 已删除。需要父 Article、thread 和 Article author context 时，使用
  `FrontDesk.comment(comment_id, mode: :internal, view: :article_context)`；
- `sync_embed_replies/1` 已移出 FrontDesk，由 `CMS.Comments.Replies`/Comments 写侧承接；
- `live_user`、CMS 层 `revalidate_user/1` 已删除。User cache refresh 统一使用根
  `GroupherServer.FrontDesk.revalidate().user/1`；
- 通用 `get/get_by/preload` 与 `CMS.FrontDesk.Lookup` 已删除，不保留兼容 wrapper；内部行读取归
  owning Query、Store、Gate Loader 或 maintenance owner；
- `community_tags/1` 已删除且不新增替代 wrapper；batch、list、stats、reaction-users 等读取归各自
  owning facade，不进入 FrontDesk。

以上边界以 [FrontDesk V2](../feature/front-desk/v2.md) 的 mode、single-resource 和 surface 处置表为准。

### 4.11 Snapshot

保留 User、Article、Comment 三种 Snapshot 合同，即使其中一部分当前只有测试调用。

```text
snapshot.ex                     # public facade

snapshot/
├── query.ex                    # authority DB query + typed summary/unavailable result
├── cache.ex                    # cache key/get/put/TTL
├── projection.ex               # mode orchestration + flat/nested patch
└── refresh.ex                  # enqueue + perform_refresh
```

```text
CMS.Snapshot
       |
       v
Snapshot.Projection
       |
       +-- stale_first --> Snapshot.Cache
       |                       |
       |                    cache miss
       |                       v
       |                Snapshot.Refresh
       |
       +-- blocking ----> Snapshot.Query
                               |
                               v
                         Snapshot.Cache
```

Facade 继续暴露：

```elixir
users/users_in
articles/articles_in
comments/comments_in
refresh_async/perform_refresh
```

`ShadowSync` 继续作为 reaction-facing projection boundary，不把 reaction 字段遍历逻辑塞入
`Snapshot.Query`。文件和模块保持在 CMS 根目录的 `shadow_sync.ex` / `CMS.ShadowSync`，F7 不将其
顺手移动到 `snapshot/`。

## 5. 执行顺序

每个 phase 独立完成、独立验证，不把多个大型 facade 放进同一个 diff。

```text
F0  冻结 Query/Writer、commands/ 和 facade API 规则
 |
 v
F1  Assets 小范围下沉
 |
 v
F2  Articles Commands
 |
 v
F3  DocTree Commands              # 不包含 CMS.Trash 的永久删除入口

F4  Press                      # 与 F2/F3 无代码依赖，独立批次

F5  Wallpaper                  # 与 Press 分开，独立批次

F6  FrontDesk 内部目录化

F7  Snapshot 四模块拆分
 |
 v
F8  Docs facade 收口
 |
 v
F9  Communities.RequestDestroy command-entry 收口
 |
 v
F10 Articles 延迟写动作审计与 Commands 收口
 |
 v
F11 Comments 写入口与资源加载合同审计
 |
 v
F12 Assets 剩余 Writer 入口审计
 |
 v
F13 CMS.Command 类型合同与文档一致性审计
```

实施结果：

```text
[x] F0  冻结公开 API、Query/Writer、commands/ 与 Gate/Lifecycle 边界
[x] F1  Assets.Deletion 承接删除实现
[x] F2  Articles.Commands.{Create,Update,Draft,Publish,Trash}
[x] F3  DocTree.Commands.{Node,Publish,Trash}
[x] F4  Press.{Query,Projection,ConfigWriter,Invalidation}
[x] F5  Wallpaper.{Query,Upload,Publisher,Retention}
[x] F6  FrontDesk 按 Article/Comment/Community/Lookup/Relation/ReactionUsers 拆分
[x] F7  Snapshot.{Query,Cache,Projection,Refresh}
[x] F8  Docs facade 收口
[x] F9  Communities.Commands.RequestDestroy
[x] F10 Articles 延迟写动作
[x] F11 Comments 写入口与资源加载合同
[x] F12 Assets 剩余 Writer 入口审计
[x] F13 CMS.Command 类型合同与文档一致性
```

实现过程中没有新增 GraphQL operation，也没有要求 resolver、Job 或领域调用方改用内部子模块。
`CMS.Articles`、`CMS.DocTree`、`CMS.Press`、`CMS.Wallpaper`、`CMS.FrontDesk` 和
`CMS.Snapshot` 仍是稳定入口。

F1–F13 已完成。后续新增 CMS 写入口必须直接进入具体 Commands 或已有明确 owner，不得重新把完整 action
编排放回顶层 facade。

依赖说明：

- F2/F3 依赖当前稳定的 `CMS.Command.Receipt` facade、`Key/Runner/Store` 合同；
- F4/F5 不依赖 optimistic operation，可独立实施和回归；
- F6 只移动内部实现，不迁移上层调用；
- F7 保留完整 Snapshot API，不以当前生产 caller 数量删除合同。

## 6. 每阶段验收

### 6.1 API 与边界

- GraphQL resolver、Job 和领域调用方继续只调用顶层 facade；
- facade 公开函数名称、参数默认值、返回形状和 ErrorCat 不变；
- 新实现模块位于 owner 的同名目录，不建立跨领域 `Utils` 或通用 mutation framework；
- `Query/Writer` 命名和 Query V2 规则适用于新代码；不得新增 `Reader`、`List` 或双轨兼容层；
- action module 使用 `commands/<action>.ex`，不创建大而模糊的 `Commands.Write`；
- facade 不再拥有 Ecto query、Repo transaction、HTTP 调用、cache 或长 private algorithm；
- 领域 Command 可以调用共享 `CMS.Command.Receipt`，但共享 Runner 不吸收领域 Gate、Lifecycle、Activity
  或 replay codec。

### 6.2 测试

每个 phase 至少执行：

```bash
cd backend/api
mix format --check-formatted <本 phase 文件>
mix compile --warnings-as-errors
mix test <owner context focused tests>
```

还需验证：

- facade 合同测试覆盖原公开入口；
- implementation 测试直接测试对应 Query、Commands、Publisher 或 Projection；
- Command phase 覆盖 execute、replay、fingerprint conflict、Gate denial 和 rollback；
- 纯目录移动不能通过改测试期望掩盖行为变化；
- `git diff --check` 通过，并确认没有吸收工作区其他功能改动。

### 6.3 实施验证记录

各 phase 完成后执行了 warnings-as-errors 编译和 owner-focused tests：

| Phase                |                   Focused tests | 结果   |
| -------------------- | ------------------------------: | ------ |
| F1 Assets            |                              21 | passed |
| F2 Articles Commands |                             280 | passed |
| F3 DocTree Commands  |                              84 | passed |
| F4 Press             |                               9 | passed |
| F5 Wallpaper         |                              12 | passed |
| F6 FrontDesk         |                             246 | passed |
| F7 Snapshot          |                              16 | passed |
| F8 Docs              | compile + facade contract audit | passed |
| F9 Communities       |                              58 | passed |
| F10 Articles         |                              14 | passed |
| F11 Comments         |                              17 | passed |
| F12 Assets           |           compile + owner audit | passed |
| F13 CMS.Command      |   compile + type contract audit | passed |

这些数字记录每个 phase 当时执行的测试集合，集合之间可能重叠，不能相加当作唯一测试数。

本轮最终验证：

```text
mix compile --warnings-as-errors  passed
git diff --check                  passed
```

本轮 focused tests：

```text
Communities lifecycle / Gate / GraphQL      58 passed
Articles Kanban / status                    14 passed
Comments solution / command                 17 passed
```

当前工作区同时包含 ArticleCommunity placement 与 migration 的既有改动；Docs/DocTree 综合测试中
仍有 `stable_article_not_found`、placement 迁移相关失败，属于该工作区的独立基线问题，不由本轮
facade 收口引入，也不能把它们伪装成全量通过。

`pnpm docs:check` 已覆盖到本次新增模块，当前全仓检查通过。此前阻塞检查的
`Assets.Endpoints` 与 `CanonicalJSON` 源码文档缺口已经在后续 source-documentation 清理中修复；
这两项不属于 F1–F7 的目录重构改动。

Phase 2/3 focused structural gate：`pnpm check:cms-facade-boundary` 已接入 `pnpm docs:check`，
当前覆盖 10 个产品 facade 和 Docs/Kanban concrete command manifest。该门禁不宣称全量 Credo
清零；既有 Credo refactoring/readability/design findings 仍由独立后续批次处理。

## 7. 非目标

- 不把所有长文件机械拆目录；
- 不修改 GraphQL operation 或前端调用；
- 不建立 Command Bus、Repository 基类、callback registry 或统一 Store；
- 不因为内部模块移动而创建兼容 alias；顶层 facade 本身就是稳定兼容边界；
- 不在同一 phase 处理 unrelated dead code、业务行为或 schema migration；
- 不在 Snapshot 拆分时删除 Article/Comment Snapshot 合同；
- 不把 `DocPublishRelease`、`Covers` 等明确实现模块伪装成新的空 facade。

## 8. 完成标准

F1–F13 已完成，目录现在可以宣称 CMS facade 这一轮收口：

```text
GraphQL / Job / domain caller
              |
              v
      CMS.<Domain> facade
              |
      +-------+------------------+
      |       |                  |
      v       v                  v
   Query    Commands          Projection/Cache
              |
              v
       Writer/Lifecycle/Gate
              |
              v
             Repo
```

顶层 facade 仍是唯一稳定入口；目录中的实现模块可以独立演进、独立测试，也不会把 Repo、HTTP、
cache、replay 和领域 policy 再次堆回 facade 文件。
