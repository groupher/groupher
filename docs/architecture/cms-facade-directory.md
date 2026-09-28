# CMS Facade 与实现目录收口

> 状态：F1–F7 已实施，公开 API 保持不变；整体验证记录见 §6.3。
>
> 范围：`backend/api/lib/groupher_server/cms` 下的公开 Context/facade 与同名实现目录。
> 本文只调整内部文件职责，不改变 GraphQL、Job 或领域调用方使用的公开 API。

相关文档：

- [Backend Rules](../rules/be.md)：后端模块所有权和 facade 约束；
- [Command：复杂领域操作的组织边界](../feature/artiment/command.md)：Command、Writer、Gate、Lifecycle 与事务职责；
- [Groupher Action Matrix 与 Transition Contract](../feature/lifecycle/transition-contract-improvement.md)：`commandId`、`CommandReceipt` 和具体 action 的执行合同；
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
  -> Comments.Reader / Writer / Commands / States / Moderation

CMS.CommandReceipt
  -> CommandReceipt.Key / Runner / Store
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

### 2.2 读取模块统一命名为 Reader

CMS 当前已有 7 个 `reader.ex` 和 9 个 `writer.ex`，已经形成稳定配对：

```text
Reader / Writer
reader.ex / writer.ex
```

因此后续统一使用：

```elixir
CMS.Press.Reader
CMS.Wallpaper.Reader
CMS.Snapshot.Reader
```

不引入 `Read`，也不在同一 domain 中同时保留 `Read` 和 `Reader`。本文不要求重命名现有
`Articles.Reader`、`Assets.Reader`、`Comments.Reader` 等模块。

### 2.3 复杂操作使用 commands/ 目录

Command 按业务动作放入 `commands/`，沿用现有 `Comments.Commands.*` 结构：

```text
<domain>/commands/<action>.ex
CMS.<Domain>.Commands.<Action>
```

Command 模块负责：

- `commandId` 和 `CommandReceipt` 编排；
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

本次检查覆盖 `cms/*.ex` 的 34 个顶层模块及其中 23 个同名目录。

| 优先级 | 顶层模块        | 当前问题                                                                                          | 目标                                                 |
| ------ | --------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| P1     | `CMS.Wallpaper` | 读取、upload、publish transaction、restore、receipt replay、retention 集中在约 968 行中           | facade + Reader/Upload/Publisher/Retention           |
| P1     | `CMS.Press`     | 配置写入、Activity、HTTP invalidation、public query 和 projection 集中在约 637 行中               | facade + Reader/Projection/ConfigWriter/Invalidation |
| P2     | `CMS.Articles`  | facade 内包含 create/update/draft/publish/trash 的 receipt 和 replay 编排                         | action 下沉到 `articles/commands/`                   |
| P2     | `CMS.DocTree`   | facade 内包含 node/publish/trash 的 receipt 和 replay 编排                                        | action 下沉到 `doc_tree/commands/`                   |
| P2     | `CMS.Assets`    | `delete_generated_assets/2` 直接查询并循环删除，Application upload 删除也在 facade 构造持久化对象 | 下沉到现有 `Assets.Deletion`                         |
| P2     | `CMS.FrontDesk` | Community/Article/Comment/Tag/Relation/Reaction 查询与一个 Comment 写同步混在单文件               | 保持 API，内部按职责目录化                           |
| P2     | `CMS.Snapshot`  | cache、authority read、projection、nested patch 和 refresh job 集中在约 500 行中                  | facade + Reader/Cache/Projection/Refresh             |

以下是确认不属于 facade 目录错误的代表性模块，并非对全部 34 个顶层文件的穷举清单：

- `CMS.Comments` 虽然公开函数多，但主要负责路由到 Reader、Writer、Commands、States 和 Moderation；
- `CMS.Communities` 主要负责领域入口、admission 和子模块路由，没有把 Repo 实现堆在 facade；
- `CMS.CommunityApplications`、`CMS.DocCover`、`CMS.AbuseReports`、`CMS.Dashboard`、
  `CMS.Search`、`CMS.Seeds`、`CMS.Interactions`、`CMS.Gate`、`CMS.Passport` 和
  `CMS.Policy` 的当前边界可以保留；
- `CMS.DocPublishRelease` 和 `CMS.Covers` 是明确的领域实现模块，后续可以因文件复杂度拆分，
  但不属于“伪装成 facade”的同一问题。

本次也检查了 `CMS.Trash`、`CMS.Docs`、`CMS.ShadowSync`、`CMS.Events`、`CMS.Marker`、
`CMS.QueryBuilder` 和 `CMS.ErrorCat`。它们分别是跨 Trash action 协调、领域入口、projection
同步或基础支撑模块；当前不纳入本次 facade 目录整改。未列出的顶层文件不能据此自动归入问题域，
需要按 §2.4 的职责标准单独判断。

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

### 4.2 Articles Commands

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
       -> CommandReceipt
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
- denied Activity 的事务外写入属于具体 Trash command，不移回共享 `CommandReceipt.Runner`；
- `Articles` facade 继续暴露现有函数，调用方不引用 `Commands.*`。

### 4.3 DocTree Commands

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
`commandId`、`CommandReceipt`、replay 编排和执行入口。版本化 codec 继续由
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

### 4.4 Press

```text
press.ex                        # public facade

press/
├── config.ex                  # 已存在：静态 thread contract
├── reader.ex                  # article/feed/manifest authority reads
├── projection.ex              # article/feed/community/config projection
├── config_writer.ex           # persisted config + Activity
└── invalidation.ex            # Press HTTP cache invalidation
```

```text
CMS.Press
  ├── config/update_config -> ConfigWriter
  ├── article/feed/manifest -> Reader -> Projection
  └── invalidate           -> Invalidation
```

`Config` 继续只表示 Press-owned 静态配置，不把数据库中的 `PressConfig` 写入逻辑塞入该模块。

### 4.5 Wallpaper

```text
wallpaper.ex                    # public facade

wallpaper/
├── error_cat.ex               # 已存在
├── request_digest.ex          # 已存在
├── settings.ex                # 已存在
├── reader.ex                  # wallpaper/settings/history
├── upload.ex                  # targets + prepare_upload
├── publisher.ex               # publish + restore + receipt replay
└── retention.ex               # reconcile_lifecycle
```

```text
CMS.Wallpaper
  ├── wallpaper/settings/history -> Reader
  ├── prepare_upload             -> Upload
  ├── publish/restore            -> Publisher
  └── reconcile_lifecycle        -> Retention
```

不建立 Wallpaper 通用 `Store`。各模块拥有自己的查询和事务，避免 `Store` 再次成为无业务语义的
数据库 helper 集合。

### 4.6 FrontDesk

FrontDesk 的上层 API 保持不变，只移动内部实现：

```text
front_desk.ex                   # public facade

front_desk/
├── article.ex                  # article path、Gate scope、query、Response
├── comment.ex                  # comment path、full comment
├── community.ex                # community 与 community tag
├── lookup.ex                   # get/get_by 等受控通用 lookup
├── relation.ex                 # preload_author/author_of/article_of/thread_of
└── reaction_users.ex           # reaction user pagination
```

```text
现有 caller
  -> CMS.FrontDesk.article/comment/community/...
       -> FrontDesk.Article / Comment / Community / Relation / ReactionUsers
```

特殊入口：

- `live_user`、`revalidate_user` 继续由 facade 一行转发根 `GroupherServer.FrontDesk`；
- `sync_embed_replies/1` 的公开入口保留。当前只有 root-comment 查找委托
  `Comments.Replies.root_comment/1`，embed 定位和 `ORM.update_embed` 写入仍在 facade；F6 的目标态是
  为 `Comments.Replies` 增加 `sync_embed_replies/1`，完整承接查找和 embed 写入，FrontDesk 只转发；
- `get/get_by` 暂时通过 `FrontDesk.Lookup` 保持合同，不在本次内部拆分中强迫调用方迁移；
- 当前没有生产调用方的 `community_tags/1`、`get_by/2,3` 只记录为后续 dead-code 裁决，
  不能在纯目录重构中顺手删除。

### 4.7 Snapshot

保留 User、Article、Comment 三种 Snapshot 合同，即使其中一部分当前只有测试调用。

```text
snapshot.ex                     # public facade

snapshot/
├── reader.ex                   # authority DB query + typed summary/unavailable result
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
       +-- blocking ----> Snapshot.Reader
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
`Snapshot.Reader`。文件和模块保持在 CMS 根目录的 `shadow_sync.ex` / `CMS.ShadowSync`，F7 不将其
顺手移动到 `snapshot/`。

## 5. 执行顺序

每个 phase 独立完成、独立验证，不把多个大型 facade 放进同一个 diff。

```text
F0  冻结 Reader/Writer、commands/ 和 facade API 规则
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
```

实施结果：

```text
[x] F0  冻结公开 API、Reader/Writer、commands/ 与 Gate/Lifecycle 边界
[x] F1  Assets.Deletion 承接删除实现
[x] F2  Articles.Commands.{Create,Update,Draft,Publish,Trash}
[x] F3  DocTree.Commands.{Node,Publish,Trash}
[x] F4  Press.{Reader,Projection,ConfigWriter,Invalidation}
[x] F5  Wallpaper.{Reader,Upload,Publisher,Retention}
[x] F6  FrontDesk 按 Article/Comment/Community/Lookup/Relation/ReactionUsers 拆分
[x] F7  Snapshot.{Reader,Cache,Projection,Refresh}
```

实现过程中没有新增 GraphQL operation，也没有要求 resolver、Job 或领域调用方改用内部子模块。
`CMS.Articles`、`CMS.DocTree`、`CMS.Press`、`CMS.Wallpaper`、`CMS.FrontDesk` 和
`CMS.Snapshot` 仍是稳定入口。

依赖说明：

- F2/F3 依赖当前稳定的 `CMS.CommandReceipt` facade、`Key/Runner/Store` 合同；
- F4/F5 不依赖 optimistic operation，可独立实施和回归；
- F6 只移动内部实现，不迁移上层调用；
- F7 保留完整 Snapshot API，不以当前生产 caller 数量删除合同。

## 6. 每阶段验收

### 6.1 API 与边界

- GraphQL resolver、Job 和领域调用方继续只调用顶层 facade；
- facade 公开函数名称、参数默认值、返回形状和 ErrorCat 不变；
- 新实现模块位于 owner 的同名目录，不建立跨领域 `Utils` 或通用 mutation framework；
- `Reader/Writer` 命名统一，不出现新的 `Read`；
- action module 使用 `commands/<action>.ex`，不创建大而模糊的 `Commands.Write`；
- facade 不再拥有 Ecto query、Repo transaction、HTTP 调用、cache 或长 private algorithm；
- 领域 Command 可以调用共享 `CommandReceipt`，但共享 Runner 不吸收领域 Gate、Lifecycle、Activity
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
- implementation 测试直接测试对应 Reader、Commands、Publisher 或 Projection；
- Command phase 覆盖 execute、replay、fingerprint conflict、Gate denial 和 rollback；
- 纯目录移动不能通过改测试期望掩盖行为变化；
- `git diff --check` 通过，并确认没有吸收工作区其他功能改动。

### 6.3 实施验证记录

各 phase 完成后执行了 warnings-as-errors 编译和 owner-focused tests：

| Phase                | Focused tests | 结果   |
| -------------------- | ------------: | ------ |
| F1 Assets            |            21 | passed |
| F2 Articles Commands |           280 | passed |
| F3 DocTree Commands  |            84 | passed |
| F4 Press             |             9 | passed |
| F5 Wallpaper         |            12 | passed |
| F6 FrontDesk         |           246 | passed |
| F7 Snapshot          |            16 | passed |

这些数字记录每个 phase 当时执行的测试集合，集合之间可能重叠，不能相加当作唯一测试数。

最终整体验证：

```text
mix compile --warnings-as-errors  passed
mix test                          2156 passed, 0 failures, 1 excluded
git diff --check                  passed
```

`pnpm docs:check` 已覆盖到本次新增模块，当前全仓检查通过。此前阻塞检查的
`Assets.Endpoints` 与 `CanonicalJSON` 源码文档缺口已经在后续 source-documentation 清理中修复；
这两项不属于 F1–F7 的目录重构改动。

## 7. 非目标

- 不把所有长文件机械拆目录；
- 不修改 GraphQL operation 或前端调用；
- 不建立 Command Bus、Repository 基类、callback registry 或统一 Store；
- 不因为内部模块移动而创建兼容 alias；顶层 facade 本身就是稳定兼容边界；
- 不在同一 phase 处理 unrelated dead code、业务行为或 schema migration；
- 不在 Snapshot 拆分时删除 Article/Comment Snapshot 合同；
- 不把 `DocPublishRelease`、`Covers` 等明确实现模块伪装成新的空 facade。

## 8. 完成标准

全部 phase 完成后，目录应直接表达调用关系：

```text
GraphQL / Job / domain caller
              |
              v
      CMS.<Domain> facade
              |
      +-------+------------------+
      |       |                  |
      v       v                  v
   Reader   Commands          Projection/Cache
              |
              v
       Writer/Lifecycle/Gate
              |
              v
             Repo
```

顶层 facade 仍是唯一稳定入口；目录中的实现模块可以独立演进、独立测试，也不会把 Repo、HTTP、
cache、replay 和领域 policy 再次堆回 facade 文件。
