# CMS Command、Gate、Lifecycle 与 Persist 写入边界收口

> 状态：待实施（2026-10-08）
>
> 范围：冻结 CMS 写入链路中 public facade、领域 Command、`CMS.Command`、Gate、Lifecycle、
> Persist、Audit/Outbox 与 result builder 的职责；首批收口 Article Binding、Dashboard、Communities、
> DocCover，并统一客户端业务写入 identity 为 `commandId`。

相关合同：

- [CMS Command](../architecture/cms-command.md)：Command Receipt、ambiguous commit 与长期执行边界；
- [CMS Command V3](../architecture/cms-command-v3.md)：Confirmation、事务与 result builder；
- [CMS Command 入口与命名修复](./cms-command-entry-and-naming-fix.md)：public facade 与
  `Commands.<BusinessAction>.execute` 命名；
- [CMS Command 客户端 Identity 边界修复](./cms-command-client-identity-fix.md)：客户端
  `commandId` 的创建、持有与 retry/recovery；
- [Gate V2](../feature/gate/v2.md)：读取 Scope 与 mutation admission；
- [Gate V4](../feature/gate/v4.md)：资源级 Access/Scope Context；
- [Gate V5](../feature/gate/v5.md)：当前 Gate 公开接口与 Scope 命名；
- [Community Lifecycle](../feature/lifecycle/contract.md)：actor-independent 状态与转换权威。

## 1. 问题

当前代码已经建立 `CMS.Command`、Gate 和多种 Lifecycle，但写入入口仍存在五类混用：

1. `Command` 同时被用来表示领域 use case 和 Receipt 执行机制；
2. public facade 仍直接调用 `Writer`，使 GraphQL middleware 成为事实上的权限边界；
3. `Writer` 同时承担 Gate、事务、业务校验、持久化、Outbox 和结果构造；
4. `CMS.Command`、Gate callback 和 Writer 各自开启 transaction，事务所有权不清晰；
5. `commandId` 与 `idempotencyKey` 表达同一种客户端业务意图，形成两套 retry/recovery 协议。

典型现状：

```text
GraphQL Resolver
  -> CMS.Dashboard.update
       -> Dashboard.Writer.update
            -> transaction + persistence + Outbox
```

该路径没有领域 Command，facade 不接收 actor，领域层无法保证 Gate admission。未来 CLI、Agent、job 或
其他 transport 复用 facade 时，也无法继承 GraphQL middleware 的授权语义。

本文不把所有写入机械接入 Receipt，而是先统一完整业务动作的入口，再只为需要 ambiguous-commit 恢复的
动作启用 `CMS.Command`。

## 2. 术语与职责

### 2.1 冻结调用链

```text
Transport adapter
  GraphQL / CLI / MCP / Agent / job
  -> 解析协议参数与认证上下文

CMS public facade
  CMS.Articles / CMS.Dashboard / CMS.Communities / CMS.DocCover
  -> transport-neutral 业务入口

Concrete use case
  Commands.<BusinessAction>.execute
  -> Gate / Lifecycle / version / Persist / Audit / Outbox 编排

Reliable execution boundary（按需）
  CMS.Command.execute
  -> commandId / fingerprint / Receipt / Confirmation recovery

Persistence primitive
  <Domain>.Persist
  -> 加入既有事务，执行 lock/query/insert/update/delete

Result builder
  -> Command transaction 提交后，从 Confirmation immutable anchor 构造 canonical result
```

### 2.2 职责矩阵

| 层                   | 拥有                                                                           | 不拥有                                                   |
| -------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Resolver             | GraphQL 参数、认证上下文、transport result                                     | Gate、事务、领域写入、Receipt 分支                       |
| CMS facade           | 共享业务 API、委托具体 use case                                                | 直接调用 Repo/Writer/Persist、选择 one-shot/Receipt 分支 |
| `Commands.X.execute` | 一个完整业务动作、Gate/Lifecycle/version、写入顺序、Audit/Outbox               | 通用 Receipt 基础设施                                    |
| `CMS.Command`        | command identity、claim/finalize、Confirmation encode/decode、恢复             | 领域规则、Gate、Lifecycle、资源写入                      |
| Gate                 | actor/action/resource admission、canonical resource 与权威 Access facts        | 状态转换、业务写入、结果投影                             |
| Lifecycle            | actor-independent 状态、allowed transition、blocker、version/concurrency guard | actor policy、GraphQL、普通展示字段                      |
| Persist              | 已有事务内的数据库 lock/query/write                                            | Gate、Lifecycle 决策、transaction owner、Receipt、Outbox |
| FrontDesk            | public locator 解析、稳定资源读取与关系加载                                    | 写入、Receipt、幂等判断                                  |

### 2.3 两种 Command 不再混用

```text
Commands.Publish.execute   领域用例：发布什么、谁能发布、怎样发布
CMS.Command.execute        执行协议：同一 commandId 如何只执行一次并恢复结果
```

每个对外持久化业务写入都必须有 concrete use case；只有满足第 9 节条件的 use case 才进入
`CMS.Command`。

## 3. 强制结构规则

### 3.1 Public facade

Public write facade 只能委托 `Commands.<Action>.execute`：

```elixir
def update_section(community, section, attrs, actor) do
  Commands.UpdateSection.execute(community, section, attrs, actor)
end
```

禁止：

- facade 直接调用 `Writer`、`Persist` 或 `Repo`；
- facade 根据 `commandId` 是否为空选择两套领域实现；
- resolver 构造 `%CMS.Command{}` 或选择 Confirmation codec；
- resolver 直接调用 Persist。

### 3.2 Persist

`<Domain>.Persist` 只保留多个 use case 共享、值得独立测试的数据库 mechanics：

- `FOR UPDATE`/advisory lock 后的具体行操作；
- insert/upsert/update/delete；
- 批量 reindex；
- 关联数据清理；
- 数据库唯一性、外键和集合完整性检查。

Persist 必须：

- 返回 `{:ok, value} | {:error, reason}`；
- 加入调用方已经建立的 transaction；
- 不调用 `Repo.transaction`、`Repo.rollback`；
- 不调用 Gate、Lifecycle、`CMS.Command`、Audit、Activity、Outbox；
- 不生成 `commandId` 或 `operationRef`；
- 不组装 GraphQL 或 transport result。

只被一个 use case 使用且逻辑很短的持久化代码直接留在该 Command 内，不为“分层”创建空转 Persist。

### 3.3 事务所有权

Receipt-backed use case：

```text
Commands.X.execute
  -> CMS.Command.execute
       -> BEGIN
       -> Receipt.claim
       -> Gate admission + canonical lock
       -> Lifecycle/version check
       -> Persist
       -> Audit/Activity/Outbox intent
       -> Confirmation
       -> Receipt.finalize
       -> COMMIT
  -> Result.build
```

One-shot use case：

```text
Commands.X.execute
  -> Gate transactional access callback
       -> BEGIN
       -> canonical lock + admission
       -> Lifecycle/version check
       -> Persist
       -> Audit/Activity/Outbox intent
       -> COMMIT
  -> canonical result
```

Gate 的 transactional callback 必须能够加入现有 `CMS.Command` transaction；Persist 不再建立第三层
transaction。

## 4. 当前盘点

当前运行时 GraphQL schema 有 188 个 mutation：68 个声明 `commandId`，120 个没有声明。该数字只用于
说明审计规模，不能推导“剩余 120 个全部需要 Receipt”。

已确认的合同错误：

1. `restoreDocRevisionToDraft` 声明必填 `commandId`，resolver 却没有传给 use case；
2. `pinDoc` / `undoPinDoc` 由通用 Article macro 生成，但当前 Article Pin Command 明确拒绝 Doc；
3. Dashboard facade 不接收 actor 并直连 `Dashboard.Writer`；
4. DocCover 先完成 Gate 短事务，再进入独立 Writer transaction；
5. Dashboard/Communities persistence 自行生成新的 Outbox `command_id`，没有复用业务入口 identity；
6. Community Application 与 Wallpaper 仍对外使用 `idempotencyKey`，并维护领域专用幂等实现。

## 5. Article Binding：`BindingWriter` 收口为 `BindingPersist`

### 5.1 目标名称

```text
CMS.Articles.BindingWriter
  -> CMS.Articles.BindingPersist
```

`BindingPersist` 不是 facade 或业务 Command，只是 mirror、move、unmirror 共享的 persistence primitive。

### 5.2 保留职责

- 创建或更新 `ArticleBinding`；
- 分配 binding `inner_id`；
- 锁定目标 binding；
- 删除 source binding；
- 清理 binding-local `ArticleBindingTag`、`PinnedArticle`、`KanbanState`；
- 在删除公开 binding 前校验“已发布 Article 至少保留一个公开 binding”。

### 5.3 移出职责

- 删除 `BindingPersist.move/mirror/unmirror` 内部的 `Repo.transaction`；
- 删除 `Repo.rollback`，改为 tagged tuple；
- Command/Gate 已锁定 canonical Article 时，不再重复建立独立事务边界；
- Confirmation、result projection、tag orchestration、Outbox 继续由具体 Command 拥有。

### 5.4 目标调用者

```text
Commands.Mirror.execute   -> BindingPersist.mirror
Commands.Move.execute     -> BindingPersist.move
Commands.Unmirror.execute -> BindingPersist.unmirror
```

`Commands.Pin/Unpin` 不写入 Binding 本身，不放入 `BindingPersist`。若 pin persistence 后续需要共享复杂
mechanics，建立独立 `PinPersist`，不扩大 `BindingPersist` 职责。

## 6. Dashboard

### 6.1 当前问题

`Dashboard.Writer` 当前同时拥有：

- GraphQL `dsb_section` 分发；
- section payload normalize；
- Dashboard 初始化；
- Community base-info 同步；
- transaction；
- section persistence；
- public presentation Outbox。

`CMS.Dashboard.update` 和 ThemePresets 直接调用 Writer；resolver 没有把 actor 传入 facade。该结构使
Dashboard 无法在领域层稳定执行 Gate。

### 6.2 目标模块

```text
CMS.Dashboard
├── Commands
│   ├── UpdateBaseInfo
│   ├── UpdateSection
│   ├── SaveCustomThemePreset
│   └── SelectThemePreset
├── Persist
├── BaseInfo
├── SectionPayload
└── ThemePreset
```

### 6.3 Use case 映射

| 当前动作                  | 目标 use case                            | 执行协议           |
| ------------------------- | ---------------------------------------- | ------------------ |
| 更新 `base_info`          | `Commands.UpdateBaseInfo.execute`        | one-shot set-style |
| 更新普通 embedded section | `Commands.UpdateSection.execute`         | one-shot set-style |
| 更新 `content_shadow`     | `Commands.UpdateSection.execute`         | one-shot set-style |
| 保存 custom theme         | `Commands.SaveCustomThemePreset.execute` | one-shot set-style |
| 选择 theme preset         | `Commands.SelectThemePreset.execute`     | one-shot set-style |

`UpdateSection` 可以接受受限 section enum：这些字段共享同一 Gate、transaction、section replacement 和
cache invalidation 合同。无需为 SEO、RSS、footer、layout 创建只转发一行的模块。

### 6.4 `UpdateBaseInfo` 原子边界

```text
Commands.UpdateBaseInfo.execute(community, attrs, actor)
  -> Gate.with_access(actor, :update, community)
  -> Communities.Persist.update_identity_fields
  -> Dashboard.Persist.replace_section(:base_info)
  -> Outbox community.presentation_changed
```

Community row、Dashboard base-info 与 Outbox intent 必须同事务提交。

### 6.5 `Dashboard.Persist`

只保留：

```text
get_or_insert_dashboard
replace_section
update_content_shadow
```

`Analysis.Web` 当前调用 `Dashboard.Writer.ensure_exist`。读取路径不应隐式依赖 Writer；迁移时必须选择：

- 创建 Dashboard 是 provision/setup 的写入职责，Reader 对缺失行返回默认投影；或
- 明确建立内部 `Dashboard.Persist.get_or_insert_dashboard`，只允许 setup/maintenance 写路径调用。

普通 Analysis read 不应在查询过程中创建业务行。

## 7. Communities

### 7.1 当前问题

`Communities.Writer` 同时承载：

- 用户创建 Community；
- 用户/operations 更新 Community；
- Dashboard base-info 同步；
- Community Application workflow 的 core row 创建；
- Lifecycle 初始化、root moderator、DocTree 初始化；
- Web Analysis 外部 provisioning。

这些动作的事务、Gate、Receipt 和失败语义不同，不能继续放在同一个 Writer。

### 7.2 目标模块

```text
CMS.Communities
├── Commands
│   ├── Create
│   ├── Update
│   ├── CreateFromApplication
│   ├── RunSetup
│   ├── RetrySetup
│   └── RequestDestroy
├── Persist
├── Lifecycle
├── Setup
└── ...
```

### 7.3 `Commands.Create`

`createCommunity` 创建新资源身份，并组合 Lifecycle、root moderator、DocTree 和外部 provisioning，因此使用
Receipt-backed `CMS.Command`：

```text
Commands.Create.execute(attrs, actor, commandId)
  -> CMS.Command
  -> Gate :create
  -> Persist.insert_core
  -> Lifecycle.ensure_created
  -> Moderator root
  -> DocTree initialize
  -> Web Analysis provisioning Outbox/job intent
  -> CreateConfirmation
  -> Result.build
```

当前 `provision_web_analysis` 的提交后 best-effort 直接调用改为 durable Outbox/job intent；外部 provider
失败不能改变已经确认的 Community 创建结果。

### 7.4 `Commands.Update`

```text
Commands.Update.execute(community, attrs, actor)
  -> Gate.with_access(actor, :update, community)
  -> Persist.update_fields
  -> Outbox community.presentation_changed
```

普通字段覆盖是 set-style，可保持 one-shot。若以后增加 expected version、revision anchor 或必须恢复首次响应，
再升级为 Receipt-backed。

### 7.5 `sync_base_info` 与 `create_core`

- `Communities.sync_base_info` 不再是 public business action；改为
  `Communities.Persist.update_identity_fields`，只在 `Dashboard.Commands.UpdateBaseInfo` 已完成 Gate 的事务内调用；
- `Writer.create_core` 改为 `Communities.Persist.insert_core`；
- 当前 `Communities.Creation` 改为 `Communities.Commands.CreateFromApplication`，继续拥有 Application lock、
  asset promotion、Lifecycle、slug claim 和 setup job 编排。

完成后删除 `Communities.Writer`。

## 8. DocCover

### 8.1 目标模块

```text
CMS.DocCover
├── Commands
│   ├── AddCard
│   ├── RemoveCard
│   ├── ReorderCards
│   ├── UpdateCardAppearance
│   ├── PinDoc
│   ├── UnpinDoc
│   ├── ReorderPinnedDocs
│   └── UpdatePinnedDocAppearance
├── Persist
├── Query
└── Sync
```

### 8.2 事务与 Gate

当前 Writer 先调用 `CMS.Gate.access_check`，Gate 短事务提交后才开始部分写事务。目标为：

```text
Commands.<Action>.execute
  -> Gate.with_access(actor, :manage_docs, community)
       -> published-node/tree invariant
       -> Persist
       -> result
```

Gate admission、canonical Community/Lifecycle lock 与 Cover 写入必须处于同一 transaction。

### 8.3 Command 与 Receipt 分类

| use case                  | `commandId` | 原因                                        |
| ------------------------- | ----------- | ------------------------------------------- |
| AddCard                   | 必须        | 重试可能变成 already-exists，需恢复首次结果 |
| RemoveCard                | 必须        | 重试可能变成 not-found                      |
| PinDoc                    | 必须        | 重试可能变成 already-pinned                 |
| UnpinDoc                  | 必须        | 重试可能变成 not-found                      |
| ReorderCards              | one-shot    | 完整目标集合覆盖                            |
| UpdateCardAppearance      | one-shot    | set-style 覆盖                              |
| ReorderPinnedDocs         | one-shot    | 完整目标集合覆盖                            |
| UpdatePinnedDocAppearance | one-shot    | set-style 覆盖                              |

### 8.4 `DocCover.Persist`

保留多个 use case 共享的：

- published node resolution；
- card/pinned row insert/delete；
- 完整集合与唯一 ID 检查；
- batch reindex；
- appearance update。

“Cover 只能引用已发布 Group/Page”等产品规则属于 Command 或明确的 domain policy helper，不因需要 SQL
查询就自动归 Persist。

### 8.5 无调用 API

当前以下 `DocCover.Writer` 公开函数没有生产调用者：

- `set_item_hidden`；
- `update_item_appearance`；
- `reorder_items`。

若实施前复核仍无调用，直接删除，不为死 API 创建 Command 或 compatibility wrapper。

## 9. `commandId` 是唯一客户端业务写入 identity

### 9.1 冻结名称

```text
一次已经开始执行的逻辑业务写入 = commandId
```

禁止新增以下同义公共字段：

- `idempotencyKey`；
- `requestId`；
- `mutationId`；
- 作为 retry identity 使用的 `operationId`。

统一名称不等于所有 mutation 都必须进入 Receipt。只有需要恢复首次结果的动作要求
`commandId: ID!`；天然 set-style、允许读取最新 canonical result 的动作可以 one-shot。

### 9.2 与其他 ID 的边界

| 名称                        | 含义                                                    |
| --------------------------- | ------------------------------------------------------- |
| `commandId`                 | 一次逻辑业务写入，transport retry/recovery 复用         |
| `operationRef`              | Audit/Activity/Outbox 的执行关联，可由 Command 入口产生 |
| `jobRef`                    | 持久化 workflow resource identity                       |
| `previewRef`                | Preview resource identity                               |
| `batchRef`                  | 外部上传/处理批次 identity                              |
| `revisionId` / `snapshotId` | immutable domain resource identity                      |
| capability/token nonce      | 安全凭证 identity                                       |

资源 ref 不能代替 `commandId`，`commandId` 也不能代替资源主键。

### 9.3 Community Application

当前：

```text
submitCommunityApplication(idempotencyKey)
  -> CommunityApplications.Writer
  -> CommunityApplication.idempotency_key
```

目标：

```text
submitCommunityApplication(commandId)
  -> CommunityApplications.Commands.Submit
  -> CMS.Command
```

如果领域行需要永久 provenance/唯一约束，数据库字段改为 `submit_command_id` 并保存同一个
`commandId`。它是 defense-in-depth 和领域关联，不是第二套客户端 identity 或第二套 Receipt。

以下 expected-version transitions 同样增加 `commandId` 并进入 `CMS.Command`：

- cancel；
- start review；
- approve；
- reject；
- retry creation；
- retry setup。

首次提交成功但 response 丢失后，原请求若没有 Receipt 恢复会因 version 已变化而错误返回 conflict。

### 9.4 Wallpaper

当前 `WallpaperPublishReceipt` 与通用 `CommandReceipt` 重复表达一次用户发布意图。目标为：

```text
prepareWallpaperUpload(commandId)
  -> Batch/capability 绑定 commandId

publishWallpaper(commandId)
  -> Wallpaper.Commands.Publish
  -> CMS.Command
  -> Wallpaper PublishConfirmation

Assets Hub claimForPublish(batchRef, commandId)
```

迁移完成后：

- 删除 runtime `WallpaperPublishReceipt` 和专用 receipt retention；
- `requestDigest` 进入 Command fingerprint/params；
- Snapshot 可保存 `command_id` 作为 provenance；
- prepare 与 publish 由同一个客户端 command handle 协调；
- `restoreWallpaperSnapshot` 增加 `commandId` 并进入 `CMS.Command`。

### 9.5 Content Import

Content Import 不再向产品层暴露通用 `idempotencyKey`：

- 表示用户启动的一次逻辑写入时，使用 `commandId`；
- 只表示一次 preview 计算尝试时，使用 `attemptRef`；
- `previewRef`、`jobRef` 继续作为资源 identity；
- 禁止为同一次 attempt 同时维护 `attemptRef` 与 `idempotencyKey`。

Content Import Job 自身的状态机、row lock 和完成结果仍由 Job aggregate 拥有；不把 Job lifecycle 塞入
`CMS.Command`。

### 9.6 Outbox

Persist 不得调用 `Ecto.UUID.generate()` 填充 `command_id`。

- Receipt-backed action：Outbox 使用入口 `commandId`；
- one-shot action：使用一次明确生成并贯穿事务的 `operationRef`；
- 若 Outbox 字段实际只表达 correlation，应迁移命名为 `operation_ref`，不能继续冒充 Command identity。

## 10. Gate 与 Lifecycle 的组合

### 10.1 Gate

Gate 只回答：

```text
actor 是否可以对当前 canonical resource 执行 action？
```

所有外部写入必须在领域 Command 内调用 Gate。GraphQL Passport middleware 可以提前拒绝请求，但不是领域
授权权威，不能替代 Gate。

当前 `CMS.Gate` 公开 facade 已暴露两类入口：

- `scope/4`：构造读取范围，不执行 Repo；
- `access_check/3`：加载并检查单资源 mutation admission。

`Gate.Access` 还实现了 aggregate Command 所需的事务 callback：`with_check/4`、
`with_community_check/5` 和 `with_branch_check/6`。目标实现只将这三个可成功执行的签名按原名和原
arity 提升到 `CMS.Gate` facade，由 facade 委托给内部 `Gate.Access`；领域 Command 只依赖
`CMS.Gate`。

现有 `Gate.Access.with_branch_check/5` 只是在缺少显式 Community/binding context 时返回
`:article_binding_context_required` 的错误兜底，不是受支持的事务入口，也不提升到 `CMS.Gate`。
迁移时将其上游无 context 调用改为显式 `with_branch_check/6`，调用点清零后删除 `/5` 子句；不把该
兜底保留成 facade 兼容层。

不新增 `with_access/4` 同义入口。Community 与 Doc branch callback 需要显式 Community、Article 和
branch context，不能在没有定义 typed target 的情况下压缩成一个含义不完整的 `/4` API。
`Gate.Access` 继续作为内部加载、锁定和授权实现，不成为业务层可直接调用的公共边界。

### 10.2 Lifecycle

Lifecycle 只拥有长期资源状态和并发 guard：

- Community Lifecycle：setting up、active、read-only、archived、pending destroy、destroy 等；
- Article Lifecycle：draft-only、published、archived、deleted、destroy；
- Doc Lifecycle：branch-scoped draft/public lifecycle。

以下不是 Lifecycle：

- Dashboard section；
- Article sink flag；
- comment pin/fold；
- Kanban status；
- theme preset；
- upload Batch 或 Content Import Job 状态。

它们可以有领域状态和 transition，但不能为了统一命名都塞进 Lifecycle authority。

## 11. 其他 mutation 的后续分类

首批四个领域完成后，继续按同一规则审计：

| mutation family                   | concrete use case                             | Receipt 判断                             |
| --------------------------------- | --------------------------------------------- | ---------------------------------------- |
| Article sink/lock/category/status | 已有 Command，但 generic action dispatch 待拆 | set-style 可 one-shot                    |
| Article/Comment report            | 拆为 Report/UndoReport Command                | Report 需要；Undo 可 one-shot            |
| Comment solution                  | 拆为 AcceptSolution/RevokeSolution            | 当前天然幂等，可 one-shot                |
| Comment pin                       | 拆为 Pin/Unpin                                | 当前天然幂等，可 one-shot                |
| Category/Tag/TagGroup             | 每个业务动作建立 Command                      | create/delete/reindex 逐项判断           |
| Moderator                         | Add/AddMany/Remove/UpdatePassport Command     | 批量/删除优先 Receipt                    |
| Assets                            | Register/Delete/Archive/Restore Command       | capability/service callback 保留资源协议 |
| Activity export                   | ExportCommunityActivity Command               | 写 Audit 且返回 artifact，使用 Receipt   |
| Press config                      | UpdateConfig Command                          | set-style one-shot                       |
| Auth/session                      | Accounts/Auth 自有 use case                   | 不迁入 CMS.Command                       |
| view/read markers                 | Interaction/Accounts 自有投影协议             | 不要求 Receipt                           |

## 12. 实施阶段

### Phase 1：基础命名与事务

1. `BindingWriter` 改为 `BindingPersist`；
2. Persist 移除自有 transaction/rollback；
3. 冻结 Gate transactional API；
4. 增加 facade/resolver/Persist 静态依赖门禁。

### Phase 2：删除 Writer 业务入口

1. Dashboard Commands + Persist；
2. Communities Commands + Persist；
3. DocCover 八个 Commands + Persist；
4. 删除三个无调用 DocCover Writer API；
5. 删除 `Dashboard.Writer`、`Communities.Writer`、`DocCover.Writer`。

### Phase 3：服务端 identity 统一

1. Community Application `idempotencyKey` 改为 `commandId`；
2. Submit 与 expected-version transitions 接入 `CMS.Command`；
3. Wallpaper 专用 Receipt 迁移到 `CMS.Command`；
4. Wallpaper prepare/publish/Assets Hub claim 贯穿同一 `commandId`；
5. Outbox 停止自行生成伪 `command_id`；
6. Content Import 移除同义 `idempotencyKey`。

### Phase 4：客户端 identity 统一

按 [CMS Command 客户端 Identity 边界修复](./cms-command-client-identity-fix.md) 实施：

- 组件和领域 hook 不创建/保存 `commandId`；
- mutation executor 是唯一 owner；
- unknown outcome 保留同一 handle；
- Apply、Wallpaper、Content Import 删除各自的 `idempotencyKey` coordinator。

### Phase 5：其余 mutation 审计

按第 11 节逐领域迁移；每个 mutation 明确标注：

```text
concrete use case
Gate action
Lifecycle/version authority
transaction owner
one-shot | CMS.Command | domain workflow protocol
Confirmation/result builder
Audit/Activity/Outbox
```

## 13. 门禁与验收

### 13.1 静态门禁

- public facade 不得调用 `*.Writer`、`*.Persist` 或 `Repo`；
- resolver 不得调用 Writer/Persist、构造 `%CMS.Command{}` 或选择 Confirmation；
- Persist 不得调用 Gate、Lifecycle transition、`CMS.Command`、Audit、Activity、Outbox；
- production 代码不得新增 `idempotencyKey`；migration、历史文档可白名单；
- GraphQL 声明 `commandId` 的 mutation 必须可追踪到 `CMS.Command.execute`；
- `commandId` 不得在 Writer/Persist 内生成；
- 一个 public business action 只有一个 `Commands.<Action>.execute` 入口。

### 13.2 行为测试

- Gate denial 不产生任何领域写入、Audit 或 Outbox；
- Gate admission 与依赖其 mutable facts 的写入处于同一事务；
- Persist 错误使 Receipt、领域事实、Audit 和 Outbox 一起回滚；
- response 丢失后以同一 `commandId` 恢复首次 Confirmation/result；
- 相同 `commandId` 配不同 payload 返回 identity conflict；
- one-shot set-style 重复执行得到相同最终状态；
- Lifecycle transition 覆盖 allowed transition、version conflict 与 blocker；
- Dashboard base-info 的 Community/Dashboard/Outbox 原子性有回归测试；
- DocCover add/remove/pin/unpin 有首次执行与 recovery 测试；
- Community create 与 Application transitions 有 ambiguous-commit 测试；
- Wallpaper publish 不再写专用 Receipt。

### 13.3 验证命令

至少运行：

```text
mix compile --warnings-as-errors
mix test test/groupher_server/cms/gate
mix test test/groupher_server/cms/articles
mix test test/groupher_server/cms/dashboard
mix test test/groupher_server/cms/communities
mix test test/groupher_server/cms/doc_tree/cover_test.exs
mix test test/groupher_server/cms/community_applications_test.exs
mix test test/groupher_server_web/wallpaper_graphql_test.exs
pnpm docs:check
```

并运行 GraphQL codegen、frontend type-check、command identity 静态门禁与生成产物 freshness check。

## 14. 非目标

本文不：

- 把 `CMS.Command` 扩展成全局 Command Bus；
- 要求所有 mutation 都创建 Receipt；
- 把 SQL/Ecto 实现全部塞进 Command module；
- 用 `commandId` 代替 job、batch、revision、snapshot 等资源 identity；
- 把 Dashboard、Kanban、comment pin 等普通领域状态塞进 Lifecycle；
- 让 GraphQL middleware 取代领域 Gate；
- 为旧 Writer 或 `idempotencyKey` 保留 runtime compatibility wrapper；
- 修改历史 migration 文件中的旧列名或表名。
