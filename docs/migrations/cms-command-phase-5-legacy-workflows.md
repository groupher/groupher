# CMS Command Phase 5：Legacy Mutation 分类与迁移

> 状态：本阶段非 deferred mutation 已完成迁移并进入验证收口（typed identity、Tag/TagGroup、Asset row mutation、Moderator、Press config、Article sink/lock/category/status、Article binding、Article moderation/visibility、Report/solution/pin、Comments、Community Categories/Subscriptions 与 Community Application 用户 Command 入口均已有 concrete boundary；Assets Upload/Provider workflow、Asset ReplacementPlan、DocTree/ContentImport 按范围 deferred）。后续只补回归证据，不再把 deferred workflow 混入本阶段。
>
> 范围：Tag / TagGroup、Assets 用户 Command、Community Categories/Subscriptions、CommunityApplications，以及尚未逐项确认写入合同的 CMS mutation。Assets Upload/Provider workflow、Asset ReplacementPlan 与 DocTree/ContentImport 明确不在本阶段实现。
>
> 前置文档：
> [CMS Command、Gate、Lifecycle 与 Persistence 边界](./cms-command-gate-lifecycle-persist-boundary.md)、
> [CMS Command](../architecture/cms-command.md)、
> [CMS Domain Outbox](../architecture/cms-outbox.md)。

## 1. 结论

现有 `CMS.Command` 内核、concrete Command、Gate facade 和客户端 `commandId` owner 已经完成；本阶段
纳入的非 deferred mutation 已按以下边界收口。本文仍不宣称“所有 CMS mutation 都完成迁移”，因为
Asset Upload/Provider/Replacement workflow 与 DocTree/ContentImport 明确后置。以下职责清单记录的是
本轮要从旧 Writer/Facade 中拆出的历史混合点，而不是对已完成 family 的新遗留判断：

- 解释完整业务动作；
- 执行 Gate admission；
- 开启数据库事务；
- 写 Audit、Activity 或 Outbox；
- 生成被命名为 `command_id` 的内部 UUID；
- 决定重试、幂等和 response 丢失后的恢复语义。

Phase 5 不把所有写入机械塞进 `CMS.Command`。它先为每个 mutation 建立 concrete use case，再按
ambiguous commit、结果恢复和已有领域 workflow 判断执行协议：

```text
GraphQL / service callback / maintenance scheduler
  -> public CMS facade
  -> concrete Command or named domain workflow
       -> Gate / service admission
       -> Lifecycle or version authority（仅在真实需要时）
       -> one transaction owner
       -> Persist primitives
       -> Audit / Activity / Outbox intent
  -> canonical result
```

目标不是得到“所有路径都调用 `CMS.Command.execute/2`”，而是得到“每个业务动作只有一个明确 owner，
每种 identity 只表达一种语义”。

## 2. 完成边界

本文完成后才能声明 Phase 5 收口。完成条件不是模块改名，而是每个纳入范围的 mutation 都回答并实现：

```text
concrete use case
actor / initiator
Gate action or service admission
Lifecycle / version authority
transaction owner
one-shot | CMS.Command Receipt | domain workflow protocol
Confirmation / result builder
Audit / Activity / Outbox effects
retry and unknown-outcome behavior
```

以下状态必须明确区分：

- `classified`：上述合同已经冻结，但代码尚未迁移；
- `migrated`：入口、事务、identity 和 effect 已按合同迁移；
- `verified`：静态门禁、行为测试、GraphQL codegen 和调用方测试通过。

只有 `verified` 才算完成。本文不把计划能力描述成已上线能力。

当前已落地的代码切片（不等于 Phase 5 完成）：

- `CMS.Outbox` 支持 `identity: {:command, id} | {:workflow, ref}`，并以 `effect_key` 区分同一
  command 的多 scope effect；数据库迁移已把旧 `command_id` 兼容到 typed identity 存储；
- Article Move、Article moderation、DocTree publish、Doc publish 的 producer 不再为每个 scope 或
  binding 生成第二个 command UUID；尤其 Move 的 source/destination 两个 scope 必须复用同一个入口
  `commandId`；maintenance/provider reconciliation 使用 workflow identity；
- Comment create/reply、Upvote/Emotion/Collect 的生产入口缺少 command identity 时 fail closed；Upvote、Emotion
  与 Collect 都通过独立 reaction operation 进入 Receipt，Collect 的 Metric 与 Outbox 复用入口 identity。
  Accounts collect-folder 在同一用户命令内调用 Collect 时沿用外层 transaction，避免同一个 command id
  递归 claim 两个 Receipt；直接 CMS reaction 调用仍可从 CollectConfirmation 恢复首次结果；
- Asset register/delete/archive/restore 已有 concrete Command 和单一 transaction owner；ReplacementPlan
  使用稳定的 workflow step ref，不再为 locator 生成 `command_id`；provider cleanup/reconciliation
  使用显式 `{:workflow, ref}` identity；Upload/Replacement 的 crash-resume 仍按 workflow 批次验收；
- Tag/TagGroup GraphQL mutation 已接收必填 `command_id`，taxonomy Outbox 使用同一 command identity 和
  stable effect key；CRUD 已进入 `Commands.*`、Gate、Receipt confirmation，set/unset/reindex 使用
  Gate-admitted one-shot；旧 facade arity 已全部 fail closed，291 个测试/查询调用方显式传递 actor 与
  identity，seed 和无 branch 的 domain fixture 改走命名的 maintenance workflow/`Tags.Persist` primitive。`Tags.Persist` 已
  承接 row/batch primitives；`Tags.Mutation` 承接 Tag/TagGroup count 与 taxonomy orchestration，
  `Articles.Tags.Assignment` 承接 Article association/stats，`Tags.Query` 仅保留 read/query API。
  `Tags.Mutation` 与 article tag-assignment primitive 在缺少外层事务时
  fail closed；具体 Command、Gate 或命名 maintenance workflow 是唯一 transaction owner；不保留旧 facade
  transaction fallback；
- Comment create/reply/update/delete 与 Article/Comment report 已收紧为显式 command identity；缺失 identity
  在 facade、Command 和 Writer 边界 fail closed，Report add/remove 使用 Receipt/result builder；旧测试夹具
  已迁移到显式 fixture identity；
- Comment solution/pin 已进入 concrete Command：`SolutionChange` 与 `StateChange` 通过 `CMS.Command`
  Receipt 接收 `commandId`，Gate 锁内直接调用 domain transition；Confirmation/result builder 从稳定
  `comment_id` 恢复结果，Activity operation ref 复用同一个 command identity。旧两参数 facade/States
  arity fail closed；Comment solution/pin mutation GraphQL 的四个入口已要求 `commandId`；Comment delete
  在撤销当前 solution 时也复用 delete command identity，不再生成第二个 operation UUID。Comment command/
  write/query suites 已通过，当前 family 已完成；后续只补并发回归。
- Article sink/undo-sink、comment lock/unlock、Post category/status 已进入六个 action-specific
  one-shot Command（`Sink`、`UndoSink`、`LockComments`、`UnlockComments`、`SetCategory`、`SetStatus`）。
  GraphQL mutation 的 `commandId` 均为必填，Command 边界校验 UUID 后复用现有 Gate admission、
  ArticleBinding/branch scope 与状态 transition；这些 set-style 状态不使用 Receipt，且没有为每个
  scope 或内部 effect 派生第二 UUID。Article action focused mutation suites 当前为 **124/124**（验证路径：
  `backend/api/test/groupher_server_web/mutation/cms/articles` + `backend/api/test/groupher_server_web/mutation/cms/sink`）；这证明
  transport、concrete Command、Gate 和 result builder 已闭合；Article moderation 与 move/mirror 另按
  service workflow / shared Outbox 合同记录，不重复归入此 set-style suite。
- Press config 已进入 `UpdateConfig` Receipt Command：GraphQL 顶层 `commandId` 必填，配置 revision
  与 Activity `operation_ref` 复用同一 command identity；`ConfigWriter` 在 Receipt 已持有事务时直接
  使用当前 owner，不再嵌套开启 `Repo.transaction`。Confirmation 以 community slug/revision 恢复
  首次配置，重复同一 command 不递增 revision；Press focused suite 当前为 **10/10**。
- facade/resolver 的默认 command UUID 已清退；静态脚本同时检查 facade/resolver 与 production CMS
  source 中的派生 `command_id`。
- Article publish、DocTree publish 的旧内部夹具已补齐显式 `command_id`（相关 suite 72/72）；这只证明
  调用方跟随 fail-closed 合同迁移，不把底层 `Publish` workflow 重新变成隐式 command。
- Analysis Contribution 的 Community 更新属于 maintenance workflow，改走
  `Communities.update_operations/3`，以 `{:workflow, ref}` 写入 presentation Outbox；workflow step ref
  包含贡献计数，避免把内部 job identity 冒充用户 `commandId`，也避免同一日重复贡献时的 Outbox 冲突。
- Tag/TagGroup 的旧 CRUD、set/unset/reindex convenience arity 已 fail closed：`create/update/delete tag` 与
  `create/update/delete tag group` 不再在 `CMS.Communities` 内隐式执行。226 个测试/查询夹具已补上
  显式 actor 和 command identity；seed helper 改走命名的 maintenance path（不提供旧 facade arity），
  不伪造用户 command。Receipt result builder 同时恢复 marker 的领域规范形状。该切片 focused Tag suites
  为 **104/104**（验证路径：`backend/api/test/groupher_server/cms/communities/tags` 59 +
  `backend/api/test/groupher_server/cms/communities/commands/tag_commands_test.exs` 2 +
  `backend/api/test/groupher_server_web/mutation/cms/community_tags` 41 +
  `backend/api/test/groupher_server_web/query/cms/community_tag_groups_test.exs` 2），与 §11 aggregate 合计为 **194/194**。set/unset/reindex 另有 65 个调用方迁移，
  无 branch 的 Doc domain fixture 改走显式 maintenance workflow；Tag/TagGroup row insert/update/delete
  与 batch reindex SQL 已提取到无 Gate、Outbox、事务和 identity 处理的 `CMS.Communities.Tags.Persist`，用户 CRUD
  也已进入 concrete Command/Receipt；十一个 concrete Command 已位于 `CMS.Communities.Tags.Commands`。
  `Tags.Mutation` 已承接 Tag/TagGroup command orchestration、count、taxonomy effect，Article association/stats
  已由 `CMS.Articles.Tags.Assignment` 承接；`Tags.Query` 不再提供写入 facade。`Tags.Mutation` 与 assignment
  primitive 要求外层 owner 已持有事务，调用方缺失时
  fail closed，不生成或隐式开启事务。

上述切片的 focused compile/gate、Tag/Asset 行为测试、GraphQL codegen 和 frontend type-check 已通过。
Phase 5.6 清退 facade convenience arity 后，旧测试夹具曾以 168/191 通过，剩余 23 个失败全部为
`cms.command_id_required`；本批已将这些夹具改为显式 command identity，并把 §11 四个 aggregate
suites 跑到 194/194。随后又清理了全测试树中旧的 Comment create/reply 与 Interaction reaction
convenience arity：77 个测试文件中的 1,167 个调用现在显式传递 fixture identity，评论域套件为
312/312，reaction/emotion/read-state 套件为 132/132，资产 GraphQL query 套件为 3/3。
这些数字证明测试调用方已经跟随 fail-closed 合同迁移。Tag CRUD facade arity 切片另有 226 个调用方
迁移，focused **104/104**（路径组成同上：59 + 2 + 41 + 2），§11 aggregate suites 为 **194/194**；
本阶段其余纳入 family 已完成，只有明确列出的 Asset workflow 与 DocTree/ContentImport 保持 deferred。

## 3. 分类规则

### 3.1 Concrete Command 与 `CMS.Command` 不是同义词

每个用户可见的完整业务动作都应有 `Commands.<Action>.execute`，但 concrete Command 可以选择三种执行协议：

| 协议                  | 适用条件                                                                     | transaction owner | identity                                                        |
| --------------------- | ---------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------- |
| one-shot              | set-style、重复执行收敛到同一最终状态，首次响应无需恢复                      | concrete Command  | 可无 Receipt；若写 Outbox，仍接收同一客户端 `commandId`         |
| `CMS.Command` Receipt | create/delete、revision-producing、返回首次结果、response 丢失后不能安全重跑 | `CMS.Command`     | 客户端 `commandId`                                              |
| domain workflow       | upload、batch、plan、maintenance 等拥有独立资源状态机                        | workflow owner    | upload/batch/plan/workflow identity，不伪装成客户端 `commandId` |

Receipt 只解决有限窗口内的用户命令重放与结果恢复。它不是权限系统、任务队列或通用 workflow engine。

#### 3.1.1 Command、Workflow 与 step 的关系

`Command` 是一个有业务语义的逻辑执行单元，不等于最小函数，也不要求每个内部 helper 都变成
Command。它可以是用户直接调用的根操作，也可以是一个 workflow 中具有独立 admission、输入合同和
重试语义的 step。

`Workflow` 是跨多个步骤、可能异步、需要持久化进度和恢复的编排单元。二者不是互斥层级：

```text
root user Command(commandId = C1)
  -> synchronous domain transaction
  -> Outbox / Workflow(runRef = W1)
       -> stepRef = S1  (可调用一个 concrete Command)
       -> stepRef = S2  (可调用 provider/domain operation)
```

identity 规则如下：

- `commandId` 标识一次用户业务意图；同一次意图只能有一个根 command identity；
- `workflowRef` 标识一个可恢复的长流程或维护流程；可以包含根 `commandId` 作为 causation，但不能
  用新的 UUID 冒充第二个用户 command；
- `stepRef` / `effectKey` 标识 workflow 内的可重试子操作；它可以对应一个 concrete Command 的执行，
  但不是新的顶层 `commandId`；
- 只有另一个独立的用户意图，才允许拥有另一个顶层 `commandId`。

因此“Command 比 Workflow 更细”只在部分场景成立：Command 是业务合同边界，Workflow 是恢复和编排边界，
二者可以嵌套，但不能混用 identity 语义。

#### 3.1.2 文档状态标记

- `implemented, verified`：代码路径、GraphQL/客户端合同和当前列出的 focused 验收均已通过；
- `implemented / owner migration pending`：主要 Command/identity 边界已落地，但旧编排 owner 或扩大恢复验收仍在进行；
- `classified/ongoing`：已冻结部分合同，但仍需完成具体 family 的协议、Gate、事务或 recovery 验收；
- `deferred`：按当前产品范围或本轮任务明确后置，不计为本轮代码遗漏；
- `product scope stable`：当前对外功能合同已明确，不因尚未存在的未来字段制造迁移债务。

### 3.2 Receipt 判断清单

满足任意一项时，默认使用 Receipt；若选择其他协议，必须在对应 mutation 行中记录理由：

1. 首次提交成功但 response 丢失后，再执行会创建第二个实体或第二份事实；
2. 再执行会因为目标已经删除、version 已推进或状态已变化而返回与首次不同的结果；
3. 调用方需要恢复首次创建的稳定引用、revision、artifact 或删除确认；
4. 同一次用户意图必须与 Outbox effect 使用同一个客户端 identity 去重；
5. 操作对外部系统产生不可逆或昂贵 effect，且没有更合适的领域 workflow identity。

以下情况通常 one-shot：

- 完整目标集合覆盖；
- 明确的 set/unset、archive/restore；
- 重复执行得到相同最终状态，并允许返回最新 canonical projection；
- 不要求恢复首次时刻快照。

“当前实现看起来没有报错”不是幂等证明。必须由数据库约束、锁、expected version 或完整集合覆盖证明。

### 3.3 Gate 与 transport middleware

GraphQL `Passport` middleware 只负责 transport 层快速拒绝，不能替代领域 admission。目标调用链为：

```text
Passport middleware
  -> resolver
  -> CMS facade
  -> Commands.<Action>.execute
       -> CMS.Gate.with_check / with_community_check / with_branch_check
       -> canonical resource lock
       -> Persist
```

Gate action 必须在领域 policy 中显式注册/实现（例如 Moderator 的 `:manage_moderators`）；不得把
GraphQL 字符串直接当成新的领域合同。
service callback 使用 scoped service credential/capability admission，不伪造用户 Gate。

### 3.4 事务所有权

Receipt-backed：

```text
Commands.X.execute
  -> CMS.Command.execute
       -> Receipt claim
       -> Gate + lock + Persist + Audit/Outbox
       -> Confirmation finalize
       -> COMMIT
  -> result builder
```

one-shot：

```text
Commands.X.execute
  -> Repo.transaction
       -> Gate + lock + Persist + Audit/Outbox
       -> COMMIT
  -> canonical result
```

domain workflow：

```text
Workflow owner
  -> claim workflow resource / step
  -> Repo.transaction
       -> state transition + Persist + Outbox
  -> worker or service continuation
```

`Writer`/`Persist` 不得自行开启事务、调用 Gate、生成 command identity 或发送 Outbox。

### 3.5 Outbox identity

当前 `CMS.Outbox.send/1` 已要求调用方显式选择 typed identity；production producer 已完成迁移，
event/job identity 不再冒充客户端业务命令 identity。

#### 3.5.1 Typed identity contract（已完成）

当前调用合同区分两类来源：

```elixir
identity: {:command, command_id}
identity: {:workflow, workflow_ref}
```

- 用户 mutation 产生的 effect 使用同一个客户端 `commandId`，不得在 Command、Persist 或 Outbox producer 内生成；
- maintenance/batch/upload workflow 使用其持久化的 workflow ref；
- Outbox 自己生成的 event id 只标识 Event，不回填为 command identity；
- 数据库存储和唯一索引必须能区分 command 与 workflow 两个 namespace；
- typed identity 已落地；新的 production producer 不得新增 `command_id: Ecto.UUID.generate()` 或 nil fallback。

typed source/等价约束、reader/writer 和唯一索引已经按 command/workflow 两个 namespace 迁移完成；
残留旧字段只属于存储兼容迁移，不再是 producer API。不得在新代码中重新混用旧的必填 `command_id`
假设。

#### 3.5.2 同一 command 的 multi-scope effects（effect_key 已选定并完成迁移）

一个 command 可以产生多个 Outbox effect，但不能为第二个 scope 生成第二个 `commandId`。当前
`Articles.Commands.Move` 会分别失效 source/destination binding；两个 Event 若继续使用相同的
`event/resource_type/resource_id`，现有
`command_id + event + resource_type + resource_id` 唯一键无法区分它们，这正是 destination effect
生成第二个 UUID 的根因。

当前已选定并迁移为稳定 `effect_key` / scope key：同一 `commandId` 下的 source/destination 或多个
binding effect 通过不同 `effect_key` 区分；实际 `ArticleBinding` 仍作为 resource identity（适用时）。
唯一约束和 producer 均按 `(commandId, effectKey)` 表达，禁止通过派生随机 `command_id` 绕过约束。
Article moderation 对多个 binding 发送 visibility effect 时使用同一决策。

#### 3.5.3 多 scope effect 的恢复策略（已完成；effect 非产品事实）

以 Article Move 为例，Command transaction 先写入两个 effect，而不是让 worker 直接重新执行整次
业务 mutation：

```text
commandId = C1
  effectKey = article-move:<article>:source      -> pending
  effectKey = article-move:<article>:destination -> pending
```

每个 effect 必须持久化 `pending | claimed | succeeded | failed` 状态、attempt 次数、lease/claimed_at
和最后错误；这些状态由共享 Outbox worker 管理。当前 Move/Moderation 的 search/cache/visibility
失效是 best-effort effect，不是需要向用户确认的产品事实。因此本节的 1–5 步由共享 Outbox 协议满足；
Receipt confirmation 只恢复根业务结果，不读取 effect 状态，也不返回 `command_resolution_pending`。
若未来某个 effect 变成用户可见的产品事实，必须另行定义 Receipt/workflow 合同，不能默认套用本节。

worker 处理流程固定为：

1. 以 `(commandId, effectKey)` 唯一键 claim 一个待处理 effect；
2. 若已经是 `succeeded`，直接跳过，不重复副作用；
3. 执行 scope-specific effect，外部 provider/search 调用使用同一个稳定 idempotency key；
4. 在同一笔 effect transaction 中写入本地完成标记；
5. 进程崩溃或 lease 超时后，只重试未完成 effect；不重新生成 `commandId`；
6. **不适用当前合同**：effect 不是产品事实，Confirmation 不聚合 effect 状态；response 丢失时仅恢复
   根业务结果。`command_resolution_pending` 不属于 Move/Moderation 当前返回协议。

这样 source 已成功、destination 尚未执行时，重试只会继续 destination；HTTP response 丢失时，仍可通过
根 `commandId` 恢复同一 Move 结果。这个策略同时适用于 moderation 的多个 binding visibility effect。

### 3.6 CMS bounded context 的目录组织规则

`Commands / Query / Persist / Setup` 是有多个用户 mutation 的 bounded context 的默认结构，但不是
每个模块都必须机械创建四个目录。目录名表达 ownership，而不是文件类型：

```text
<bounded_context>
  |-- Commands/       # 用户可见业务动作；每个动作一个 concrete execute
  |-- Query/          # 只读事实/投影；通过 Gate query scope admission
  |-- Persist/        # caller-owned DB primitive；不负责 Gate、transaction、identity、effects
  |-- Setup/           # 初始化/bootstrap；只由创建或安装 workflow 调用
  |-- Workflow/       # 可恢复的长流程、service callback、maintenance
  `-- Effects/        # 只有在 Activity/Outbox producer 需要独立组合时才建立
```

以下规则适用于本阶段目录盘点：

1. 用户 mutation 不能停留在旧 `Writer`/facade；必须有 `Commands.<Action>`，但 concrete Command 可以调用
   同一 bounded context 的 `Persist` primitive；
2. `Query` 不接收 `commandId`、不创建 Receipt，但仍由统一 `CMS.Gate` 管理权限和 scope；
3. `Persist` 不得自行打开事务、调用 Gate、生成 UUID 或写 Activity/Outbox；事务和 effects 由 Command 或
   named workflow 持有；
4. `Setup` 只表达初始化，不作为普通业务 mutation 的兼容入口；
5. Upload、ReplacementPlan、ProviderReconciliation、ContentImport 等拥有独立状态机的对象使用
   `Workflow`/`Maintenance` identity，不伪装成用户 `commandId`。

当前已经符合该模式或有明确理由不再拆分的模块：`Communities.Moderators`、`Communities.Tags`、
`Communities.Categories`、`Communities.Subscriptions`、`Assets` 用户 row mutation、`Press`、
`Dashboard`、`Kanban`、`Interactions.Reactions`、`CommunityApplications` 和 `Comments`。其中
`Comments.Writer` 是 Command callback 内的业务 orchestration，不再是对外 mutation 入口；低层 row
primitive 与 effect producer 的 owner 由该 bounded context 的 Command/Writer 合同固定。`Upload`、
`ProviderReconciliation`、`ReplacementPlan` 与 `DocTree/ContentImport` 保留各自的 Workflow/Maintenance
目录和独立 identity，属于明确 deferred 范围。

## 4. Tag / TagGroup 迁移边界

当前用户入口大致为：

```text
GraphQL
  -> CMS.Communities
  -> CMS.Communities.Commands.<Action>
       -> CMS.Command Receipt or one-shot Gate
       -> CMS.Communities.Tags.Mutation orchestration
       -> CMS.Communities.Tags.Persist / Articles.Tags.Assignment primitives
       -> CMS.Outbox.send
```

迁移前的问题与当前处理结果如下：

- GraphQL mutation 已统一接收必填 `commandId`；
- resolver/facade 已进入 `Commands.CreateTag`、`Commands.DeleteTag` 等具体 use case；
- taxonomy Outbox 不再生成伪 command UUID，而是接收同一 command identity，旧 service caller 使用稳定
  community/thread workflow ref；
- create/update/delete/group CRUD 已由 `CMS.Command` Receipt 与 Confirmation 恢复；set/unset/reindex
  是 one-shot，但仍传递入口 command identity 给 taxonomy effect；
- GraphQL Passport 仍只是 transport 快速拒绝，所有新用户 mutation 在 concrete Command 内再次走 Gate；
- `Communities.Tags` 旧模块不再作为 query/write 混合边界；查询改由 `Communities.Tags.Query` 提供，写入编排由
  `Communities.Tags.Mutation` 统一持有。`Tags.Mutation` 将 count、taxonomy effect 编排交给外层 concrete
  Command、Gate 或命名 maintenance workflow 的单一 transaction owner；`Tags.Persist` 与
  `Articles.Tags.Assignment` 继续保持无 Gate、Outbox、identity 和 transaction owner 的 persistence primitive。

### 4.1 目标模块

```text
CMS.Communities
  `-- Tags
       |-- Query
       |-- Persist
       |-- Stats
       |-- Mutation
       |-- Maintenance
       `-- Commands
            |-- CreateTag
            |-- UpdateTag
            |-- DeleteTag
            |-- CreateTagGroup
            |-- UpdateTagGroup
            |-- DeleteTagGroup
            |-- SetTag
            |-- UnsetTag
            |-- ReindexTagsInGroup
            |-- ReindexTagsAcrossGroups
            `-- ReindexTagGroups

CMS.Articles
  `-- Tags.Assignment
```

Tag 相关实现统一收纳在 `CMS.Communities.Tags` bounded context 下：

- `Tags.Query` 只负责 Tag/TagGroup 查询；查询不携带 command identity，也不创建 Receipt，但仍通过统一
  `CMS.Gate` query scope 完成权限和 scope admission；
- `Tags.Persist` 只保留由外层 owner 调用的 query、lock、insert/update/delete 和 batch update；不启动事务、
  不执行 Gate、Outbox 或 identity；
- `Tags.Stats` 维护 Tag 使用计数 projection，不是权限层或 transaction owner；
- `Tags.Mutation` 负责 Tag/TagGroup canonical aggregate、community count 和 taxonomy effect 编排，并要求
  调用方已经持有事务；
- `Tags.Maintenance` 负责 seed、repair、reindex 等命名 workflow，使用 `{:workflow, ref}`，不冒充用户
  `commandId`；
- `Tags.Commands.*` 是用户可见的 concrete Command 入口。旧 `Communities.Tags` 写入 facade 不再保留；
- Article 的绑定关系属于 Article 领域，最终由 `CMS.Articles.Tags.Assignment` 负责 `set/unset`、
  `ArticleBinding` 和关联 stats；Community Tag 目录只提供被它调用的 taxonomy primitives。

`ArticleBinding.Tags.replace/2` 当前仍是 caller-owned primitive，缺少外层事务时 fail closed。用户 CRUD
不再走旧 facade arity；seed/maintenance 调用方使用显式 `{:workflow, ref}` workflow。

### 4.1.1 本批目录迁移结果

本批已完成模块和文件边界迁移，并完成跨域 assignment 拆分：

1. `communities/tags/query.ex`、`persist.ex`、`stats.ex`、`mutation.ex`、`maintenance.ex` 已组成 Tag 内部细节；
2. 十一个 Tag concrete Command 已移到 `communities/tags/commands/`，模块命名空间同步为
   `CMS.Communities.Tags.Commands.*`；
3. resolver/facade 现在只调用 `Tags.Commands.*`，不直接依赖 `Persist`、`Stats` 或 `Maintenance`；
4. Article `SetTag`/`UnsetTag` 的 association 编排已从 `Tags.Mutation` 下沉到
   `CMS.Articles.Tags.Assignment`，但 taxonomy effect 仍使用同一个入口 identity；
5. 本批未引入兼容目录或旧模块别名；旧 `CMS.Communities.Tags` 写入 API 已消失，查询改用
   `CMS.Communities.Tags.Query`。

GraphQL 与 concrete Command 的明确映射为：

```text
reindexTagsInGroup           -> ReindexTagsInGroup
reindexCommunityTags         -> ReindexTagsAcrossGroups
reindexCommunityTagGroups    -> ReindexTagGroups
```

Command 名称表达领域动作，不机械重复已经存在于 `CMS.Communities.Commands` namespace 中的
`Community`，但也不保留无法区分 in-group/across-groups 的泛化名称。

### 4.2 Mutation 合同矩阵

| GraphQL / use case                           | Gate action         | version/lock authority                    | 协议     | Confirmation / result               | effect                                     |
| -------------------------------------------- | ------------------- | ----------------------------------------- | -------- | ----------------------------------- | ------------------------------------------ |
| `createCommunityTag` / `CreateTag`           | community `:update` | canonical community lock + taxonomy scope | Receipt  | `tag_id`，经 FrontDesk 返回 Tag     | taxonomy Outbox，同一 `commandId`          |
| `updateCommunityTag` / `UpdateTag`           | community `:update` | canonical tag + community lock            | Receipt  | 最新 canonical Tag                  | taxonomy Outbox，同一 `commandId`          |
| `deleteCommunityTag` / `DeleteTag`           | community `:update` | canonical tag + community lock            | Receipt  | stable deleted-tag id result        | taxonomy Outbox，同一 `commandId`          |
| `createCommunityTagGroup` / `CreateTagGroup` | community `:update` | canonical community lock + taxonomy scope | Receipt  | `group_id`，经 FrontDesk 返回 Group | taxonomy Outbox，同一 `commandId`          |
| `updateCommunityTagGroup` / `UpdateTagGroup` | community `:update` | canonical group + community lock          | Receipt  | 最新 canonical Group                | taxonomy Outbox，同一 `commandId`          |
| `deleteCommunityTagGroup` / `DeleteTagGroup` | community `:update` | group + member tags + community lock      | Receipt  | stable deleted-group id result      | taxonomy Outbox，同一 `commandId`          |
| `setCommunityTag` / `SetTag`                 | Article `:edit`     | ArticleBinding + tag assignment lock      | one-shot | canonical Article projection        | stats/taxonomy effect 复用入口 `commandId` |
| `unsetCommunityTag` / `UnsetTag`             | Article `:edit`     | ArticleBinding + tag assignment lock      | one-shot | canonical Article projection        | 同上                                       |
| 三类 reindex Command                         | community `:update` | `(community, thread)` taxonomy scope      | one-shot | `{:ok, :pass}` / GraphQL `done`     | taxonomy Outbox，同一 `commandId`          |

这里的 one-shot 不表示“绕过 concrete Command”，只表示不创建 Command Receipt。当前 CRUD 统一使用
Receipt，避免删除或更新 response 丢失后的结果歧义；set/unset/reindex 虽然不持久化 Receipt，仍必须
接收并传递 GraphQL `commandId`，因为 taxonomy/stats effect 属于同一次用户意图。

### 4.3 Create 与 Update

`CreateTag`、`UpdateTag`、`DeleteTag` 及三个 TagGroup CRUD Command 当前均 Receipt-backed：

- target 使用 community/taxonomy scope，不能伪造尚不存在的 tag id；
- intent params 包含 community、thread 和规范化后的业务字段；正文/扩展字段按 IntentCodec policy 保存 digest；
- create/update/delete、count 更新、taxonomy Outbox 和 Receipt finalize 在同一事务；
- Confirmation 只保存稳定实体 id 与 command identity；
- 首次执行和恢复都经 FrontDesk 构建同一 GraphQL 结果。

更新即使业务上接近 patch，也采用 Receipt，原因是 taxonomy effect 与 response recovery 需要保存一次
明确 intent。重复命令由 Receipt/IntentCodec 拒绝不同 intent，不能静默生成第二个 id。

### 4.4 Delete Confirmation

Tag/Group 删除后通常无法通过 FrontDesk 重读，所以 Command 在首次执行前锁定 canonical resource，
Confirmation 只保存稳定 id 和 command identity；重放时由 result builder 返回同一 terminal projection。
当前 codec 合同为：

```text
DeleteTagConfirmation v1
  tag_id
  command_id

DeleteTagGroupConfirmation v1
  group_id
  command_id
```

它是有限、稳定的 terminal result，不是完整 Ecto struct 快照。当前 GraphQL 仍返回领域对象，因此
result builder 对已删除行返回带 id 的 terminal stub；后续若产品合同允许改为 `done`/payload，应优先
缩小 GraphQL 结果。

### 4.5 Set / Unset 与 stats

`SetTag`/`UnsetTag` 天然是集合成员关系的 set-style 动作，但只有同时满足以下条件才能保持 one-shot：

- association 有唯一约束或锁，重复 add 不插入第二行；
- repeated unset 对缺失关系返回成功；
- `Tags.Stats` delta 只根据事务内 old/new 集合计算；
- ArticleBinding、association 和 stats 更新处于同一事务；
- Gate 在锁内基于 canonical Article/Community context 执行。

若现有 stats 实现无法证明重复重试不会重复加减，必须先改为“从 old/new 集合求差”或 authoritative
recompute，不能用 Receipt 掩盖错误的 projection 算法。

当前 public `ArticlePathInput` 没有显式 branch identity；FrontDesk 对公开 Doc path 解析 main branch，
`SetTag`/`UnsetTag` 会保留这个 `ArticleView.branch_id` 并走 `CMS.Gate.with_branch_check`。因此公开
Doc set/unset 已完成 main-branch admission；非 main branch 仍需要扩展 ArticlePathInput 和调用方合同，
继续列入 §6 的 DocTree/Article family 验收队列。不能把缺少显式 branch input 误写成 command identity
缺失，也不能回退到普通 Article Gate。

### 4.6 Reindex

三类 reindex 接收完整目标集合，保持 one-shot。Command 负责：

1. 规范化 id/index；
2. 锁定 `(community_id, thread)` taxonomy scope；
3. 验证输入集合完整、无重复且目标仍属于该 scope；
4. 批量更新并检查 affected rows；
5. 在同一事务写 taxonomy-changed Outbox event；
6. 返回 `{:ok, :pass}`。

不同 payload 的并发 reindex 由 scope lock 串行化，后提交者形成最终完整顺序；它不需要恢复首次排序快照。

### 4.7 Tag persistence owner 的当前边界

本批已完成 Tag/TagGroup 写入 owner 的下沉：`Tags.Query` 只提供查询，`Tags.Mutation` 统一承接
canonical aggregate 查找、community count、taxonomy effect 编排；具体 Command、Gate 或命名 maintenance
workflow 持有唯一外层事务。`Tags.Persist` 与 `Articles.Tags.Assignment` 只执行 caller-owned
transaction 内的 persistence primitive，缺少外层事务时 fail closed。

| 责任                            | 当前 owner / 边界                                                 | 验收状态                                  |
| ------------------------------- | ----------------------------------------------------------------- | ----------------------------------------- |
| Tag/TagGroup row 与 reindex SQL | `Tags.Persist`：query/lock/insert/update/delete/batch，不开事务   | implemented / focused verified            |
| count + taxonomy effect         | `Tags.Mutation`：复用入口 `commandId` 或 `{:workflow, ref}`       | implemented / focused verified            |
| set/unset association + stats   | `Articles.Tags.Assignment` + `Tags.Stats` caller-owned primitive  | implemented / rollback 与并发测试持续扩展 |
| seed/maintenance caller         | `Tags.Maintenance`：显式 `{:workflow, ref}`，外层 `Repo.transact` | implemented / focused verified            |

因此不再保留旧 Tag mutation compatibility arity、`Tags` transaction fallback 或由 facade 生成 identity。
后续只扩大并发、stats 和 maintenance 场景的回归覆盖，不再重复迁移 owner。

### 4.8 Community Categories 与 Subscriptions（Command 边界已迁移）

这两个 family 已从用户 GraphQL mutation 的旧 facade/Writer 路径切到独立的 `Commands / Query / Persist`
目录。`CMS.Communities` 只负责公开边界与 setup workflow；旧用户 mutation arity fail closed，默认订阅仍
明确属于 setup/operations workflow。

#### Categories

当前入口是：

```text
GraphQL create/update/delete/set/unset category
  -> resolver CMS.Communities
  -> CMS.Communities.Categories.Commands.*
  -> Gate -> Categories.Persist
  -> CMS.Command Receipt / Confirmation
```

目录为：

```text
CMS.Communities.Categories
  |-- Commands
  |     |-- Create
  |     |-- Update
  |     |-- Delete
  |     |-- Set
  |     `-- Unset
  |-- Query
  `-- Persist
```

Category CRUD 与 association 均由 concrete Command 接收入口 `commandId`，Gate 在 Command callback 内
admit，Receipt confirmation 以 category/community id 恢复结果；`set/unset` 是收敛型 Receipt Command，
association primitive 不自行开启事务。focused category/query/mutation suites 已通过 **39/39**。

#### Subscriptions

用户 `subscribeCommunity` / `unsubscribeCommunity` 是 preference mutation，GraphQL 现在要求
`commandId: ID!`，由 Receipt Command 持有 Gate read admission、subscriber/count/profile 同一事务和
canonical Community confirmation；默认订阅和事件补偿不复用用户 identity，统一走 `Subscriptions.Setup`：

```text
CMS.Communities.Subscriptions
  |-- Commands      # Subscribe / Unsubscribe（若纳入用户 mutation 合同）
  |-- Query         # 当前用户订阅状态/订阅列表
  `-- Persist       # subscriber row、count、profile state primitive
```

初始化默认订阅属于 Setup/operations workflow，不复用用户 Command identity；`Subscriptions.Persist` 只写
membership row，`Subscriptions.Query` 只读状态。focused subscription/query/mutation suites 已通过 **17/17**，
路径组成为：`subscribe/subscribe_test.exs` 4 + `mutation/cms/crud_test.exs:591` 8 +
`communities/query/fetch_test.exs:60` 1 + `query/cms/cms_test.exs:387` 4。

## 5. Assets 迁移边界

> 状态：`RegisterAsset`、`DeleteAsset`、`ArchiveAsset`、`RestoreAsset` 的用户 Command + Confirmation/Receipt 边界已落地，
> `Assets.Persist` 已承接用户 asset-row primitives；
> Upload completion、provider reconciliation/cleanup 属于后续 workflow 批次；ReplacementPlan 的 apply run/
> step identity 已部分落地，但完整 crash-resume 属于 pending recovery 验收，不宣称已 verified。

当前路径分成用户 mutation、service callback 和 maintenance workflow。迁移前的混合点与当前处理结果为：

- register/delete/archive/restore 已通过 concrete Command 进入领域 Gate；用户入口必须传入同一
  `commandId`，不能由 facade 或 Writer 补 UUID；
- `Assets.Writer.delete/3` 只执行已在外层锁/事务内的资产事实和 Outbox intent，不再自行开启事务；
- upload completion 仍由 `Assets.Upload` workflow 负责，不能当作第二次用户 Command；
- `ProviderReconciliation` 要求持久化/调用方提供 `workflow_ref`，`Deletion` 的 retention cleanup 使用
  显式或确定性的 workflow ref；
- `ReplacementPlan` locator 使用稳定 `step_ref`，apply 时传入 `{:workflow, ref}`，不创建第二套用户
  `command_id`；
- upload capability、service completion、用户 mutation 和 maintenance workflow 的 identity 已分层，
  但 Upload/Replacement 的完整 crash/resume 验收仍属于后续 workflow 批次。

### 5.1 目标模块

```text
CMS.Assets
  -> CMS.Assets.Commands
       |-- RegisterAsset
       |-- DeleteAsset
       |-- ArchiveAsset
       |-- RestoreAsset
       `-- ReplaceUse
  -> CMS.Assets.UploadWorkflow
  -> CMS.Assets.ReplacementWorkflow
  -> CMS.Assets.ProviderReconciliation
  -> CMS.Assets.Persist
```

Article Draft 内替换 asset use 的写入继续由 `Assets.Commands.ReplaceUse`/Article Draft authority 持有；
Assets facade 不成为 Article 内容 Writer。

### 5.2 Mutation / workflow 合同矩阵

| 入口                                       | admission                                                        | 协议                     | transaction owner     | identity / result                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------- | ------------------------ | --------------------- | ----------------------------------------------------------------------------------- |
| `registerCommunityAsset` / `RegisterAsset` | user Gate `community :update`（transport 为 `community.update`） | Receipt                  | `CMS.Command`         | asset id + canonical confirmation；storage/public identity 冲突仍由 upsert 约束收敛 |
| `createCommunityAssetUploadIntent`         | user Gate `asset.upload`                                         | upload workflow          | `UploadWorkflow`      | 新 `uploadRef`；允许重新签发，不创建 Receipt                                        |
| `completeCommunityAssetUpload`             | scoped service credential + capability facts                     | upload workflow one-shot | `UploadWorkflow`      | `uploadRef`/public ref/storage identity；重复 callback 返回同一 Asset               |
| `deleteCommunityAsset` / `DeleteAsset`     | user Gate `community :update`（transport 为 `asset.upload`）     | Receipt                  | `CMS.Command`         | asset id + deleted confirmation；provider-delete Outbox 使用同一 `commandId`        |
| `ArchiveAsset`                             | user Gate `community :update`                                    | Receipt                  | `CMS.Command`         | asset id + archived confirmation；返回 canonical archived Asset                     |
| `RestoreAsset`                             | user Gate `community :update`                                    | Receipt                  | `CMS.Command`         | asset id + restored confirmation；返回 canonical active Asset                       |
| provider cleanup reconciliation            | maintenance admission                                            | maintenance workflow     | reconciliation owner  | persisted workflow/run ref，不使用 `command_id` 随机 UUID                           |
| `CreateReplacementPlan`                    | user Gate（下一阶段冻结）                                        | Replacement workflow     | `ReplacementWorkflow` | plan ref；协议和结果恢复合同下一阶段确认                                            |
| apply replacement plan                     | user starts, workflow revalidates each item                      | domain workflow          | `ReplacementWorkflow` | plan ref + stable step ref；支持 partial completion/resume                          |

archive/restore 当前主要是 facade API 和测试入口；在暴露新的 GraphQL mutation 前也必须先经过上述 Command，
不能因为暂时没有 transport 就继续保留 Writer 业务入口。`Writer` 仍可为 Article ref projection
持有自己的局部 transaction；这不等于它重新取得 Asset user mutation 的事务所有权。

### 5.3 Register 用户 mutation 与 upload boundary

`RegisterAsset` 当前是 Receipt-backed CMS Command。active row 唯一约束仍是资源数据层的幂等 authority，
但它不再决定 mutation 是否属于 one-shot；response-loss recovery 由 `Confirmation`/Receipt 提供。
Register 的 canonical upsert 已由 `Assets.Persist` 实现并由 Receipt-backed Command 调用：

- 有 storage identity 时按 `(community_id, storage, storage_key)` upsert；
- 否则按 active URL hash upsert；
- `public_ref` 的唯一性冲突返回现有 canonical Asset 或明确 conflict，不创建第二行；
- Gate、quota/completeness check 与 upsert 在 concrete Command 定义的事务/锁边界内完成。

upload intent 不是已经提交的 Asset。response 丢失时允许重新签发新 capability，旧 capability 按 TTL 过期，
因此不使用 Command Receipt。`uploadRef` 是资源协议 identity，不能改名为 `commandId`。

upload completion 是 assets-hub 的 scoped service callback，不是用户 mutation 的第二次执行：

- callback 必须携带/解析同一个 `uploadRef` 与 capability-bound facts；
- community、public ref、storage key、hash、size 等不可由未验证 transport 任意覆盖；
- 重复 completion 通过 public/storage identity 返回同一 canonical Asset；
- quota lock、validation 和 upsert 处于一个 workflow transaction；
- service callback 不使用用户 Gate，也不创建用户 Command Receipt。

### 5.4 Delete / archive / restore

`DeleteAsset` 使用 Receipt，因为首次事务同时提交 soft delete 与 provider-delete Outbox，response
丢失后 active lookup 已无法再次得到相同结果。流程为：

```text
DeleteAsset.execute(actor, community, asset_id, command_id)
  -> CMS.Command.execute
       -> Gate
       -> lock active asset + ref/completeness scope
       -> reject referenced asset
       -> Persist.soft_delete
       -> Outbox provider-delete(identity: {:command, command_id})
       -> DeleteAssetConfirmation
  -> deleted result builder
```

archive/restore 虽然是可收敛的 set-style 状态切换，当前协议仍统一为 Receipt-backed CMS Command。两者
执行前在事务内重新加载、锁定 Asset、执行 Gate，并通过 Confirmation/Receipt 恢复同一 canonical result；
`Writer.archive/restore` 不再作为 public business API。

### 5.5 Provider reconciliation

`ProviderReconciliation` 是 maintenance workflow，不迁入 user-only `CMS.Command`。目标行为：

- 扫描数据库 authority 与 provider objects；
- 以持久化 reconciliation run/step ref 记录一次维护尝试；
- 缺失 cleanup intent 时写 Outbox `identity: {:workflow, workflow_ref}`；
- Outbox event id 由 Outbox 自己生成；
- 同一 asset 的 pending/executing/completed cleanup intent 继续阻止重复入队；
- workflow telemetry/audit 明确标注 maintenance initiator，不伪造 user actor。

### 5.6 ReplacementPlan（Asset replacement workflow，deferred）

`ReplacementPlan` 不是文档导入功能。它读取 Asset 使用事实并逐篇调用 Article Draft 的
`Assets.Commands.ReplaceUse`，用于把一个 Asset 在文章内容中的引用替换为另一个 Asset。真正的文档导入
路径是 `CMS.ContentImport.Threads.Doc.Writer -> CMS.DocTree.Import`，与 ReplacementPlan 是两个不同的
bounded workflow。

本阶段按 Asset workflow 范围明确延期 ReplacementPlan 的 create/apply Receipt 协议、worker recovery
和 version-conflict 验收；不能因此把它写成已完成，也不在本阶段新增代码。

历史实现曾在 plan 创建时为 locator 生成随机 `command_id`，随后把它传给 `ReplaceUse`；该伪业务
identity 已移除。当前代码已经使用稳定 locator/step ref，并持久化 `apply_run_ref`、locator status/result；
完整的 worker claim/lease 和 crash-resume 验收留到 Asset replacement workflow 阶段。

目标改为：

```text
ReplacementPlan
  plan_ref
  apply_run_ref
  items[]
    item_ref
    locators[]
      locator_ref / step_ref
      observed revision and position
      status/result
```

- plan 创建不再为 locator 生成 `command_id`（当前已完成）；
- apply 启动时持久化唯一 `apply_run_ref`（已完成）；
- 每个 locator 使用稳定 step ref，重试复用，不在执行循环内重新生成（已完成）；
- `ReplaceUse` 已区分 user-command initiator 与 workflow-step initiator，workflow 使用
  `{:workflow, workflow_ref}`，不把 step ref 填入用户 `command_id`（已完成）；
- 每项继续 revalidate live revision 与 expected draft version；
- partial completion 已写回 item/step 状态，workflow 可从未完成 step 继续；
- 下一阶段必须把 apply run/step 的 claim、lease、worker crash recovery 和 version conflict 作为独立
  durable authority 验收，不能只依赖最后一次进程内循环结果。

## 6. 其余 Phase 5 对象

### 6.0 对外功能清单（当前实际提供）

本节先记录当前 GraphQL/客户端真正可见的能力，再讨论内部迁移方案；没有对外字段的未来能力不算
“已提供功能”。

#### Activity

| 对外字段                  | 类型     | 当前输入                                      | 当前返回/作用                                                                                    | 当前 admission                                |
| ------------------------- | -------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `articleLogs`             | Query    | `article`、`filter.page`                      | 单篇 Article 的安全 ActivityLog 分页                                                             | `FrontDesk :article`                          |
| `communityActivity`       | Query    | `community`、`selection`、`page`              | Community Activity timeline、query context、pagination                                           | login + `audit.read` + `FrontDesk :community` |
| `communityActivityStats`  | Query    | `community`、`selection`                      | UTC daily buckets、total count、query context                                                    | login + `audit.read` + `FrontDesk :community` |
| `communityActivityConfig` | Query    | `community`                                   | 当前 manager 可用的 resource/action/source/actor/preset 配置                                     | login + `audit.read` + `FrontDesk :community` |
| `communityActivityEvent`  | Query    | `community`、`eventRef`                       | 单个 event 及 parent/child 关联                                                                  | login + `audit.read` + `FrontDesk :community` |
| `exportCommunityActivity` | Mutation | `community`、`selection`、`format = JSON/CSV` | 同步返回 `content`、filename、mime type、统计、manifest、query context，并写 `activity_exported` | login + `audit.read` + `FrontDesk :community` |

`communityActivity` 的 `selection` 由 `presetKey` 和可选 filter 组成。filter 当前覆盖 resource type、action、
category、outcome、denial code、actor type/ref、on-behalf-of ref、subject/target ref、changed fields、
source、occurred time range 和 operation ref。timeline event 对外可读字段包括：
`eventRef`、`operationRef`、parent/child event、message/action/category/high risk、outcome/denial code、
changed fields、operation/record sequence、resource、actor/on-behalf-of、subject/target、source、payload、
metadata、occurred/recorded timestamps。Stats 返回 UTC granularity、buckets、total count 和同一
`queryContext`；Config 返回当前可用 resource/action、source、actor type 和 preset/default time range。

当前没有对外的 `exportArticleActivity`；不能从 `articleLogs` 查询推断 Article export 已经存在。当前
Community export 是 bounded、同步、内存返回的内容，不创建后台 job，也没有 `commandId`。

#### Moderator

| 对外字段                   | 类型     | 当前输入                                  | 当前实现入口                                                   |
| -------------------------- | -------- | ----------------------------------------- | -------------------------------------------------------------- |
| `pagedCommunityModerators` | Query    | `community`、filter                       | `CMS.Communities.Moderators.Query.page/2`                      |
| `addModerator`             | Mutation | `commandId`、`community`、`user`          | `CMS.Communities.Moderators.Commands.Add.execute/4`            |
| `addModerators`            | Mutation | `commandId`、`community`、`users[]`       | `CMS.Communities.Moderators.Commands.AddMany.execute/4`        |
| `removeModerator`          | Mutation | `commandId`、`community`、`user`          | `CMS.Communities.Moderators.Commands.Remove.execute/4`         |
| `updateModeratorPassport`  | Mutation | `commandId`、`community`、`user`、`rules` | `CMS.Communities.Moderators.Commands.UpdatePassport.execute/5` |

这四个 mutation 当前均要求 `commandId: ID!`；GraphQL Passport admission 仍在 transport 层快速拒绝，
具体 Command 内再次执行 `CMS.Gate`。前端 Dashboard/PassportEditor 通过统一 executor 注入 command
identity；不再由 resolver/facade 生成默认 UUID。Moderator 不产生额外 Activity/Outbox 产品事件；
Receipt confirmation 已是该 mutation 的完整结果合同，不能把“没有产品事件”误报成 producer 遗漏。

#### Article binding

| 对外字段          | 类型     | 当前输入                                                     | 当前返回 |
| ----------------- | -------- | ------------------------------------------------------------ | -------- |
| `moveArticle`     | Mutation | `commandId`、`article`、`targetCommunity`、`communityTags[]` | Article  |
| `mirrorArticle`   | Mutation | `commandId`、`article`、`targetCommunity`、`communityTags[]` | Article  |
| `unmirrorArticle` | Mutation | `commandId`、`article`、`targetCommunity`                    | Article  |

三者当前已经经过 concrete Command、Gate 和 Receipt；source/destination effect 使用同一根
`commandId` 与稳定 `effect_key`，共享 Outbox claim/lease/retry/completion 协议。worker/recovery 的
通用证据由 Outbox suite 覆盖，不再另造第二套 Article identity。

以下是必须逐项完成合同确认的审计队列，不表示每项当前都有 bug，也不预先要求 Receipt：

| family                            | concrete use case                                                                     | 初始协议判断                                              | 重点确认                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Article sink/lock/category/status | `Sink` / `UndoSink` / `LockComments` / `UnlockComments` / `SetCategory` / `SetStatus` | one-shot（已实施）                                        | action-specific Gate、ArticleBinding/branch scope；`mutation/cms/articles` + `mutation/cms/sink` focused 124/124 已验证                                                       |
| Article binding move/mirror       | 现有 `Move` / `Mirror` / `Unmirror`                                                   | Receipt（已实施）                                         | source/destination multi-scope 已复用同一 `commandId`；共享 Outbox worker 的 claim/lease/retry/completion 已覆盖                                                              |
| Article moderation/visibility     | `Moderate` / visibility workflow                                                      | service/maintenance workflow；无当前用户 GraphQL mutation | operations/audition 使用 `{:workflow, ref}`；binding effect 复用稳定 identity，走共享 Outbox worker；不创建伪用户 Receipt                                                     |
| Article/Comment report            | `Report` / `UndoReport`                                                               | Report Receipt；Undo Receipt                              | duplicate report、Audit/Activity、首次结果；add/remove 均复用 command identity                                                                                                |
| Comment create/reply              | 现有 `CreateComment` / `ReplyComment`                                                 | Receipt                                                   | facade/Writer 的 `nil` identity 已 fail closed；GraphQL/Receipt 合同与 312/312 comment suite 已验证                                                                           |
| Comment solution                  | `AcceptSolution` / `RevokeSolution`                                                   | Receipt（已实施）                                         | canonical comment/article lock、唯一 solution、response recovery                                                                                                              |
| Comment pin                       | `Pin` / `Unpin`                                                                       | Receipt（已实施）                                         | set-style、thread policy、Activity/association recovery                                                                                                                       |
| Interaction reactions             | `Upvote` / `Emotion` / `Collect` 及 undo                                              | Receipt（已实施）                                         | 三类动作各自使用 reaction operation；同一 command id 可由 Accounts 外层 transaction 复用；Metric/Outbox identity 一致                                                         |
| Moderator                         | `Add` / `AddMany` / `Remove` / `UpdatePassport`                                       | Receipt；AddMany root command + per-target summary        | membership uniqueness、partial success；Command/Receipt、专用 Gate action、Persist/transaction owner 与 response recovery 已实施；当前产品无 Moderator Activity/Outbox effect |
| Activity export                   | 当前 `ExportCommunityActivity`（Community scope）                                     | 当前同步 bounded export；Article export 不在当前产品范围  | selection snapshot、audit effect 与 bounded result；不是当前 Article 功能缺口                                                                                                 |
| Press config                      | `UpdateConfig`                                                                        | Receipt（已实施）                                         | Community Gate、ConfigWriter transaction owner、Activity operation_ref 同一 `commandId`、response recovery                                                                    |
| DocTree legacy                    | 按真实动作建立 Command                                                                | deferred                                                  | tree revision、branch lock、owner codec，禁止万能 payload；后续单独处理                                                                                                       |

### 6.1 Moderator 当前实现与剩余验收

用户 moderator mutation 已完成 concrete Command/Receipt 入口迁移；GraphQL/resolver/facade 不再提供旧的
隐式 identity arity，`CMS.Communities.Moderators.Setup` 现在只保留 community 初始化时的 `add_root/2` setup
workflow，不再提供旧的公开 add/remove/update transaction API。专用 `:manage_moderators` Gate action
已负责 lifecycle 与 root/god admission；`Moderators.Persist` 只执行锁内 membership、passport、count
写入，`Setup.add_root/2` 只接受调用方已持有的事务。当前产品没有 Moderator Activity/Outbox 事件合同，
因此不再为不存在的 effect 增加 producer；Receipt confirmation、partial summary、唯一约束和并发重试
由 Command/Outbox/Moderator focused suites 覆盖。

| 当前函数 / 模块                                | 现在做什么                                                                                       | 状态                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `Moderators.Commands.Add.execute/4`            | 一个 target 的 membership、默认 passport、count、Command Confirmation/Receipt                    | Command/Receipt、专用 Gate action 与 response recovery 已实施；无 Moderator Activity/Outbox effect 合同                |
| `Moderators.Commands.AddMany.execute/4`        | 一个 root command 下逐 target 写入并记录 `ok/error`，业务失败可部分成功                          | partial-success summary 已实施；仍是一个 root transaction                                                              |
| `Moderators.Commands.Remove.execute/4`         | passport erase、membership delete、count、Command Confirmation/Receipt                           | Command/Receipt、专用 Gate action 与 response recovery 已实施；无 Moderator Activity/Outbox effect 合同                |
| `Moderators.Commands.UpdatePassport.execute/5` | passport replacement、item count、Command Confirmation/Receipt                                   | Command/Receipt、Gate admission、persistence 边界与 response recovery 已实施；无 Moderator Activity/Outbox effect 合同 |
| `Moderators.Persist`                           | 无 transaction/admission；只执行传入 canonical Community 上的 passport、membership、count writes | persistence primitive 已完成；不负责不存在的 Activity/Outbox effect                                                    |
| `Moderators.Setup.add_root/2`                  | 新 community 初始化首个 root moderator；要求 caller-owned transaction                            | 独立 setup workflow；不再自行 lock/transaction                                                                         |

当前调用链为：

```text
GraphQL(commandId)
  -> Moderators.Commands.*
  -> CMS.Command Receipt
  -> CMS.Gate.with_community_check(:manage_moderators)
       -> canonical Community lock
       -> Moderators.Persist membership/passport/count
       -> ModeratorConfirmation
```

`:manage_moderators` 是 Moderator 专属 Gate action；root/god admission 已从 `Moderators.Persist`
移出。Gate 锁内传入的 canonical Community 直接用于 membership/count 写入，`Persist` 不再通过
`ORM.find/2` 二次加载，也不再持有 actor policy。

`CMS.FrontDesk.community/2` 的 `mode: :public | :management | :internal` 只改变读边界和 scope policy，
不等于当前事务里的 `FOR UPDATE` canonical resource。它适合 Command 完成后的 presentation/recovery
读取（例如 Confirmation presenter），不应在 Gate 锁内为了更新 count 再重新读取 Community。
`Moderators.Persist.update_count/3` 直接使用 Gate 传入的 locked canonical Community。

当前代码未在 `Moderators.Commands.*`、`Moderators.Persist` 或 `Moderators.Setup` 中直接产生 Activity/Outbox effect；
这是当前产品合同的明确选择，不是遗漏。若未来 Moderator mutation 需要进入 Community Activity 或下游
Outbox，必须另立 event schema，并在同一 root command transaction 中复用入口 `commandId`。

### 6.1.1 Moderator 目录与职责边界（当前切片已收口）

本切片已将 Moderator feature 从 Community 根目录和共享 `commands/` 中收口；当前物理布局为：

```text
communities/
├── moderators/
│   ├── commands/
│   │   ├── add.ex
│   │   ├── add_many.ex
│   │   ├── remove.ex
│   │   ├── update_passport.ex
│   │   ├── confirmation.ex
│   │   └── support.ex
│   ├── query.ex
│   ├── persist.ex
│   └── setup.ex
└── subscribers/
    └── query.ex
```

这与 Tag 迁移前的平铺问题相同；现在已按 Moderator bounded feature 聚合。`support.ex` 是内部共享的
Receipt/Confirmation 执行 helper，不是对外 Command；旧 `commands/moderator.ex`、`moderator.ex`、
`moderator_persist.ex` 和 `members.ex` 不再作为当前模块名。

`Communities.Query` 保留 Community 列表/分类等 aggregate-level query；`Moderators.Query` 和
`Subscribers.Query` 分别负责成员集合读取。`Count`、`Passport`、`Lifecycle`、Community `Persist`
仍是跨 feature 或 aggregate-level service，不应为了目录整齐硬塞进 `Moderators`。本目录迁移不保留
旧 Moderator alias 或兼容入口，调用方已直接切换到新的 namespace。

`AddMany` 已按产品要求采用一个 root Receipt command + per-target summary：每个 target 独立记录成功或
失败，前端可以看到部分成功，不要求全量回滚。当前实现仍在同一个 Command/Gate callback 和同一个
root transaction 内完成：业务校验失败可以进入 summary，未捕获的数据库/基础设施失败仍会让 root
transaction rollback。它不是每个 target 独立提交；如果未来规模需要 worker，再把这些 target 结果提升
为稳定 `step_ref`，不改变对外结果合同。旧 `Moderator.add/3`、
`add_many/3`、`remove/3`、`update_passport/4` 不保留兼容入口。

产品已确认 `addModerators` 不要求全量回滚，前端需要看到每个目标成功或失败。因此当前结果合同是
“一个 root command + per-target summary”；worker 化是未来的容量选项，不是当前迁移的前置条件：

| Command                   | Gate / lock                           | 事务内事实                                                                                   | Receipt confirmation                                               |
| ------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `AddModerator`            | `:manage_moderators` + community lock | membership unique insert、默认 passport、count；当前无 Moderator Activity/Outbox effect 合同 | community id + target user id，重新加载 Community                  |
| `AddManyModerators`       | 同上                                  | 同一 root transaction；逐 target 生成 `ok/error` summary，基础设施失败整体 rollback          | root command + per-target summary；`step_ref` 属于未来 worker 扩展 |
| `RemoveModerator`         | 同上                                  | membership delete、passport erase、count；当前无 Moderator Activity/Outbox effect 合同       | community id + target user id；Receipt 恢复同一删除结果            |
| `UpdateModeratorPassport` | 同上 + passport community-match       | passport replacement、item count；Gate admission 与 Persist 已分离                           | community id + target user id + rules digest                       |

同一个 `commandId` 配不同 community 或 user 集合必须返回 identity conflict。Receipt/summary 保存每个
target 的 terminal status，response 丢失时恢复同一份成功/失败汇总；membership unique constraint 和
passport 操作必须各自幂等。只有 `add_root` 仍是独立 setup workflow，不作为用户 AddMany 的隐式 fallback。

### 6.1.2 Moderator 下一批实施顺序

目录迁移已完成，后续按以下顺序收口语义，不再改变对外 GraphQL 字段：

1. **[implemented] Gate admission**：Moderator 管理使用专用 `:manage_moderators` action；Gate 负责
   Community lifecycle 与 actor root/god admission，`Moderators.Persist` 不再定义 `root_allowed?/2`。
2. **[implemented] 事务 owner**：`Moderators.Setup.add_root/2` 是 caller-owned transaction primitive；
   Community Create Command 与 Setup workflow 各自明确唯一 owner，`add_root/2` 不再调用
   `Transaction.lock_row` 或 `Repo.transaction`。
3. **[implemented] canonical reuse**：`Moderators.Persist` 直接使用 Gate/owner 传入的 locked Community；
   `update_count/3` 不再 `ORM.find/2` 二次加载，`FrontDesk` 只保留 post-command presentation/recovery read。
4. **[implemented] effects and recovery**：当前产品没有 Moderator Activity/Outbox effect 合同；Command
   confirmation、AddMany summary、并发唯一约束和 setup retry 已由 focused suites 验收。若未来产品新增
   Moderator timeline，再单独定义 event schema，不把未来需求倒写成本阶段欠债。

### 6.2 Article Move/Mirror 的理想形态

当前对外 API 已经明确要求 `commandId`，理想形态不是再增加一层 facade，而是把每个公共动作固定成
一个 root Receipt Command：

| Command           | 业务事实                                                                 | Outbox effect                                                                           | Confirmation                           |
| ----------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | -------------------------------------- |
| `MoveArticle`     | 在 source/destination binding、tags、community counts 上执行一次原子变更 | `source`、`destination`、search/cache 等稳定 effect keys，全部归属同一 root `commandId` | destination binding/article projection |
| `MirrorArticle`   | 保留 stable Article，在 destination 创建/更新一个 binding 与 tags        | destination effect key、search/cache effect                                             | destination binding/article projection |
| `UnmirrorArticle` | 删除指定 community binding，保留 stable Article                          | target-community invalidation/cleanup effect                                            | stable done/binding-deleted result     |

理想的 `MoveArticle` 执行链为：

```text
GraphQL(commandId = C1)
  -> MoveArticle Command
  -> source/destination Gate admission
  -> one transaction owner
       -> binding/tag/count facts
       -> OutboxEffect(C1, source, E1, pending)
       -> OutboxEffect(C1, destination, E2, pending)
       -> Receipt confirmation
  -> worker claims E1/E2 independently
```

每个 effect 至少保存：`command_id`、`effect_key`、resource/scope、status、attempt、lease、completed_at
和 error。worker 必须：

1. 以 `(commandId, effectKey)` claim，禁止同一 effect 并发执行；
2. 已 `succeeded` 时直接跳过；
3. 外部 search/cache/provider 调用携带稳定 idempotency key；
4. effect 成功与本地 completion marker 一起提交；
5. lease 超时只恢复未完成 effect；
6. Receipt confirmation 汇总 root business fact 与 effect state，区分 terminal、pending 和 failed。

这样 response 丢失时，重放 `C1` 仍返回同一个 binding/result；source 已完成而 destination 未完成时，
只继续 E2；任何 worker retry 都不得生成第二个业务 `commandId`。

### 6.3 Activity export 当前实现与后续合同

当前仓库已有的是 **Community scope 的同步 export**，不是 Article detail 下的产品功能：

```text
GraphQL exportCommunityActivity
  -> Passport audit.read + FrontDesk community
  -> Activity.export_community_logs
  -> bounded CommunityLog query
  -> CSV/JSON content
  -> Activity.log(:activity_exported)
  -> response artifact
```

它目前不创建后台 job，也没有 `commandId`；但它不是纯 read，因为返回前会写
`:activity_exported` audit event。因此后续合同不能只讨论同步/异步，而要同时冻结：

- selection/filter 的规范化 snapshot 与 schema version；
- `audit.read` admission 与 community/article scope；
- 最大导出边界、CSV/JSON 格式和 UTC 时间语义；
- export audit event 是否需要与用户 identity 绑定；
- response 丢失时是否要求恢复同一 content/manifest；这里的“同一”是指第一次导出的 filter snapshot、
  event 集合边界、统计和 manifest，而不是重试时重新查询得到的最新数据；
- 超出 bounded limit 时是否创建 artifact/job，以及 job 的 run/step identity。

短期没有 Article Activity export 产品需求时，不把它伪称为“Article mutation 未迁移”；保留现有
Community export 的同步实现，并将未来 Article export 作为独立 product contract。这里的 Article scope
是指“只导出某一篇 Article 关联的 Activity”，不是当前 `articleLogs` 查询本身，也不是已经存在的导出
入口。当前阶段不预先决定 Receipt、同步 artifact 还是后台 workflow；先由产品冻结导出范围、数据快照、
审计和 response-loss 要求，再据此选择协议。无论最终协议为何，完整合同都必须覆盖 selection 可复现、
权限边界、格式/大小限制、失败恢复和审计结果。

Comment solution/pin 当前实现矩阵为：

| action                              | admission                                            | transaction owner                                            | identity / result                                                                            |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `AcceptSolution` / `RevokeSolution` | `Gate.with_check(:accept_solution/:revoke_solution)` | `CMS.Command` Receipt callback + Post aggregate lock         | `commandId` 同时作为 Activity operation ref；`SolutionConfirmation` + stable comment reload  |
| `Pin` / `Unpin`                     | `Gate.with_check(:pin)`                              | `CMS.Command` Receipt callback + Post/Article aggregate lock | `commandId` 同时作为 pin Activity operation ref；`StateConfirmation` + stable comment reload |

两者属于 Receipt，而非旧表格中的 one-shot 初始判断：solution replacement/response 丢失需要恢复稳定
terminal result，pin 的 Activity/association 写入也必须与用户意图绑定。内部 delete reconciliation
可以调用 `revoke_if_current/5`，但必须传入上层 delete command identity；不再生成独立 UUID。

本阶段纳入的 family 已按 §4.2/§5.2 的粒度完成 concrete use case、GraphQL 参数、Gate、事务、
Confirmation 和 effects 确认；只有 §5.4 Upload/Provider workflow、§5.5 ReplacementPlan 与 §6.4
DocTree legacy 按范围保持 `deferred`，不再把未来产品能力列为当前迁移债务。

明确排除：

- Auth/session 由 Accounts/Auth 自有协议管理；
- view/read markers 由 Interaction/Accounts 投影协议管理；
- 两者不迁入 `CMS.Command`，也不计入 Phase 5 遗漏；
- reaction mutations 会写 reaction fact、Metric 与 Outbox，不属于 view/read marker 例外。

### 6.4 其他本阶段必须收口的 CMS family

#### CommunityApplications

`CMS.CommunityApplications.Query` 已是独立查询边界；用户提交、取消、审核和 setup retry 已进入
`Commands` + Receipt，工作流仍明确由 `ExpireSubmitted` / `CreateCommunity` / `Setup` 持有。目标目录为：

```text
CMS.CommunityApplications
  |-- Commands
  |     |-- Submit
  |     |-- Cancel
  |     `-- Review
  |-- Query
  |-- Persist
  |-- Workflows
  |     |-- ExpireSubmitted
  |     `-- CreateCommunity
  `-- Policy / ReviewAuth / Transitions
```

用户提交、取消、审核和 setup retry 分别使用稳定 `commandId`、Application Gate admission、version
authority 与 Confirmation；approve/retry/setup 启动的 workflow 直接复用 root `commandId` 作为 job/event
operation ref，不生成第二个业务 command UUID。过期和创建 Community 是 workflow/job，不生成伪用户
command。GraphQL mutation 的 `commandId` 已补齐，aggregate suite **13/13** 通过；`CreateCommunity` 与
`Setup` worker 的重复执行、operation ref 复用和状态恢复已按自身 job 合同验收，不把 job identity
冒充 Receipt identity。

#### Comments

Comment 的 concrete Command 已存在；`CreateComment` / `ReplyComment` 委托的是 Command callback 内的
`CMS.Comments.Writer` orchestration，而不是对外 Writer 入口。Writer 不再生成 identity，也不自行开启
Article transaction；Article lock/Gate 与 Receipt runner 持有外层 owner，Writer 只组合 caller-owned row
writes、audition producer 和 commit 后 effects。目标链路为：

```text
CMS.Comments.Commands.*
  -> Gate + Article scope lock
  -> CMS.Comments.Persist
  -> Activity / audition / notification effects
  -> Receipt confirmation
```

`Query` 保持只读；Writer 内的 row primitives 不作为 facade API 暴露；mention、audition、notification 等
effect 已区分 root transaction 内 producer 与 commit 后 workflow。identity fail-closed、Receipt replay、
GraphQL contract 与 focused tests 已完成；后续只增加并发回归，不再把这项列为未迁移 family。

#### Article 与 Community 其他遗漏

- `CMS.Communities.Categories`：已进入 `Commands / Query / Persist`，GraphQL commandId、Gate、Receipt 与
  setup caller 已收口；
- `CMS.Communities.Subscribe`：用户 preference mutation 已进入 `Subscriptions.Commands / Query / Persist`；
  默认订阅保留 Setup/operations workflow；
- Article Move/Mirror：concrete Commands 复用根 `commandId` 与稳定 scope effect，使用共享 Outbox
  recovery；Article moderation/visibility 是 operations/audition workflow，不存在用户 GraphQL mutation，
  使用 `{:workflow, ref}`；Moderator 当前无 Activity/Outbox 产品合同。三者不再因为未来产品扩展被标为
  当前迁移债务。

## 7. GraphQL 与客户端迁移

### 7.1 Schema

- Receipt-backed mutation 增加必填 `commandId: ID!`；
- one-shot 但写用户 Outbox 的 mutation也接收 `commandId: ID!`，用于同一意图的 effect identity；
- 纯 set-style 且无可靠 effect 的 mutation不为了形式统一强加 Receipt；
- service callback 保留 scoped input/capability identity，不增加用户 `commandId`；
- response 不暴露 `commandReplayed`、Receipt payload 或 workflow 内部 step identity。

### 7.2 Resolver

resolver 只做 transport adaptation：

```text
args + authenticated actor
  -> CMS facade concrete action
  -> domain result / transport error
```

resolver 不构造 `%CMS.Command{}`、不选择 one-shot/Receipt、不生成 UUID、不直接调用 Writer/Persist。

### 7.3 Client executor

需要 `commandId` 的用户 mutation 继续由统一 mutation executor 创建和保存 handle：

- unknown outcome 重试复用同一个 id；
- settled 后清理 handle；
- upload `uploadRef`、replacement `planRef` 与 `commandId` 分开保存；
- 不能用新的 local UUID 覆盖服务端返回的 workflow/resource identity。

## 8. 分阶段实施

### Phase 5.0：Outbox typed identity（已完成）

1. [done] 冻结 `{:command, id} | {:workflow, ref}` producer API；
2. [done] 冻结同一 command 多 Event 的 stable effect/scope identity；
3. [done] 完成 schema、唯一索引与 migration；
4. [done] producer、reader/worker 的 claim/lease/recovery 已统一到 typed identity；
5. [done for identity] Article Move 和 moderation 的 multi-scope producer 不再用第二个 UUID 绕过唯一键；
6. [done] 增加静态门禁，禁止 production producer 直接生成 `command_id`；
7. [done for current boundary] 更新 CMS Outbox identity 合同文档。

验收：ProviderReconciliation 可以写 maintenance event；Article Move/moderation 可在同一入口 identity 下
表达多个 scope effect；数据库中不再出现伪业务 command identity。

### Phase 5.1：Tag/TagGroup persistence split（目录与 owner 已完成，focused verified）

1. [done] 从旧 `Communities.Tags` 提取 `Tags.Persist` primitives，完成 `Communities.Tags.*` 物理目录迁移；
2. [done] `Tags.Mutation` 已接管 Tag/TagGroup command orchestration、count、taxonomy effect；
   `Tags.Query` 已收缩为 read/query boundary；seed/maintenance caller 通过 `Tags.Maintenance`
   使用显式 workflow identity；
3. [done] `Tags.Persist`、`Articles.Tags.Assignment` 不开启 transaction；assignment、taxonomy
   scope、group/member 的锁由外层 Command/Gate/workflow 持有；
4. [done] 保持 read API 与 GraphQL 输出不变；后续只补并发、stats 和 rollback 回归。

验收：所有 GraphQL/user Tag 写入只能由 `Tags.Commands.*` 调用 `Tags.Mutation`/`Tags.Persist`；
seed/maintenance caller 必须显式声明 workflow admission；旧 Tags mutation arity 和 transaction fallback
均已删除。

### Phase 5.2：Tag/TagGroup Commands 与 Receipt（已完成，focused verified）

1. 十一项 concrete Command 已实现并按 GraphQL 语义命名；
2. tag/group CRUD 接入 `CMS.Command` 与 Confirmation；
3. set/unset/reindex 保持 one-shot，并贯穿 `commandId` 到 taxonomy Outbox；
4. set/unset 走 Article Gate，reindex 走 Community Gate；并发/stats 回归已纳入 focused suites；
5. GraphQL schema、resolver、codegen 和客户端 executor 调用已更新。

验收：create/update/delete/group response 丢失可恢复；one-shot 重试收敛；无内部 command UUID。

### Phase 5.3：Asset user mutations（已完成；workflow 单独 deferred）

1. [done for current boundary] `Assets.Persist` 已承接 register/delete/archive/restore 的 asset-row primitives；
   `Assets.Writer` 保留 Article ref projection 等局部 transaction，不再作为这些用户 mutation 的 owner；
2. [done for current boundary] Register/Delete/Archive/Restore 均使用 concrete Command + Confirmation/Receipt 合同；
3. [done] 用户 mutation 的 Receipt 与同 identity Outbox；provider worker recovery 属于 §5.4 deferred workflow；
4. [done] Register 的 storage/url/public-ref canonical upsert 与 Receipt replay 合同已由 `Assets.Persist`、
   `RegisterAssetConfirmation` 和资产 focused suite 覆盖；这是资源数据唯一性和恢复合同，不是 one-shot
   分类依据；
5. [done] archive/restore 的 canonical lock 与 Gate 行为由 `Assets.Persist` 和资产行为套件覆盖。

当前批次已确认用户 Command 入口、identity、canonical upsert、Receipt replay 和 archive/restore Gate
边界，并将 user asset-row 写入移到 `Assets.Persist`；provider/ref projection 的局部 transaction 与
user Asset mutation 分开标注，Upload/Provider/Replacement workflow recovery 留在明确 deferred 的后续批次。

### Phase 5.4：Upload 与 maintenance workflow（TODO/deferred；下一阶段）

1. [TODO] 收口 UploadWorkflow 的 capability、completion 与 transaction；
2. [TODO] completion 以 upload/public/storage identity 幂等；
3. [TODO] ProviderReconciliation 使用 workflow identity；
4. [TODO] provider cleanup worker 测试重复入队与完成事件。

验收（TODO）：用户、service、maintenance 三类 initiator 在代码和数据中可区分。

### Phase 5.5：ReplacementPlan（Asset replacement workflow；deferred）

1. [deferred] CreateReplacementPlan 的 Receipt/one-shot 协议、Gate 与 result builder 下一阶段确认；
2. [implemented for current apply path] 持久化 `apply_run_ref`、稳定 locator `step_ref` 与 per-step status/result；
3. [done] 删除 locator 随机 `command_id`；
4. [done] ReplaceUse 使用明确的 `{:workflow, workflow_ref}` initiator；
5. [deferred] 补齐 worker claim/lease、crash/resume、partial completion 和 version conflict 的独立验收；
   该功能不是文档导入，文档导入仍由 `CMS.ContentImport -> CMS.DocTree.Import` 单独处理。

### Phase 5.6：其余 family

1. [done] 按 §6 逐 family 执行 `classified -> migrated -> verified`；本阶段只保留明确 deferred 的 Asset workflow 与 DocTree。
2. [implemented, verified for current focused suites] 移除 Comment create/reply/update/delete、Upvote/Emotion 的 `nil` command identity fallback；Comment domain suite 312/312 通过，跨目录 fixtures 继续纳入回归清单；
3. [implemented, verified for current focused suites] Article/Comment Report add/remove 统一使用 concrete command identity、Receipt 与 result builder；GraphQL report mutations 的 `commandId` 已为必填；
4. [implemented, verified for current focused suites] Upvote/Emotion/Collect 及 undo 均进入独立 reaction
   Receipt operation；缺失 command identity 在 reaction boundary fail closed。Accounts collect-folder 的外层
   transaction 复用同一 command id 但不递归 claim，CollectConfirmation 可恢复首次结果；focused
   collect/reaction suites **29/29**，reaction/emotion/read-state aggregate **132/132**；
5. [done in this batch] 清退 `CMS.Communities`、`CMS.Dashboard` 在 facade 内生成 UUID 的 convenience arity；所有受影响的 legacy fixture 必须显式传入 actor/command identity；
6. [done in this batch] seed、maintenance、operations caller 显式提供 workflow/operation identity，不能回退为伪客户端 command；Community contribution 通过 `update_operations/3` 写入 typed workflow Outbox；
7. [implemented, verified for current focused suites] Comment solution/pin 的四个 GraphQL mutation 增加必填 `commandId`；`SolutionChange` / `StateChange` 使用 Receipt + Confirmation，旧两参数 facade/States arity fail closed；
8. [implemented, verified for current focused suites] Article sink/lock/category/status GraphQL mutation 增加必填 `commandId`，并切换到六个 action-specific one-shot Command；Article state transition 仍由 Gate + ArticleBinding/branch scope owner 执行，不创建 Receipt 或第二 UUID；`backend/api/test/groupher_server_web/mutation/cms/articles` + `backend/api/test/groupher_server_web/mutation/cms/sink` 为 124/124。
9. [implemented, verified for current focused suites] Press config mutation 增加必填 `commandId`，由 `UpdateConfig` Receipt Command 统一 Gate、ConfigWriter transaction owner、Activity identity 与 Confirmation recovery；focused suite 10/10。
10. [implemented, focused verified] Moderator Add/AddMany/Remove/UpdatePassport：
    concrete Command、显式 `commandId`、Receipt、专用 `:manage_moderators` Gate action、
    `Moderators.Persist` admission/persistence 拆分、caller-owned `add_root/2` 与旧 mutation arity
    清退已完成；AddMany 返回 per-target partial-success summary，不要求全量回滚。当前产品没有 Moderator
    Activity/Outbox effect；response replay/concurrency 由 Receipt、唯一约束和 focused suites 覆盖；目录重组已完成。
    本轮验证路径为 `backend/api/test/groupher_server/cms/communities/moderators/moderator_test.exs`
    **11/11**、`backend/api/test/groupher_server_web/mutation/cms/crud_test.exs` **33/33**，以及
    `backend/api/test/groupher_server/cms/communities` 聚合 **134/134**。
11. [product scope stable, current Community export is synchronous] Activity export：保留 bounded CSV/JSON
    的同步 Community 产品合同；当前没有 Article scope export 产品需求，不新增 `exportArticleActivity`，
    也不把它计为未迁移 mutation。
12. [implemented, focused verified] Article Move/Mirror：沿用同一个 root command identity；source/destination
    effect key 稳定并由共享 Outbox claim/lease/retry/completion 协议处理；binding mutation 与 revision target
    suites 已通过。
13. [implemented, focused verified] Article moderation/visibility：当前只有 operations/audition service
    workflow，没有用户 GraphQL mutation；typed/stable `{:workflow, ref}` identity 与多 binding visibility
    effect 已由共享 Outbox worker 处理，不生成第二个 command UUID。
14. [implemented, focused verified] Community Categories：create/update/delete/set/unset 已进入
    `Commands / Query / Persist`，GraphQL `commandId`、Gate、Receipt/Confirmation 和 setup caller 已迁移；
    focused category/mutation suites **39/39**。
15. [implemented, focused verified] Community Subscriptions：subscribe/unsubscribe 已进入
    `Subscriptions.Commands / Query / Persist`，用户 preference mutation 使用 Receipt，默认订阅使用
    `Subscriptions.Setup` workflow；focused subscription/query/mutation suites **17/17**（4 + 8 + 1 + 4，
    路径见 §4.8）。
16. [implemented, focused verified] CommunityApplications：submit/cancel/review/setup-retry 已进入
    concrete Commands、Application Gate、Receipt/Confirmation；expire/create-community 保留显式 workflow
    identity，focused aggregate suite **13/13**；`CreateCommunity`/`Setup` worker 的重复执行与恢复已按
    独立 job 合同验收。
17. [implemented, focused verified] Comments：Create/Reply 的 Command/Receipt、GraphQL identity、Writer
    callback owner、audition/Outbox producer 与 replay contract 已完成；comment domain focused suite
    **312/312** 通过。
18. [implemented, focused verified] Article Move/Mirror、Article moderation/visibility 与 Moderator：
    concrete boundary、typed identity、shared worker recovery 及无产品 effect 的边界均已确认；后续只在
    业务新增 Activity/Outbox 产品需求时另开合同。

Convenience arity 清退的夹具影响（已在本批修复）如下；这些是测试调用方迁移债务，不是恢复隐式
identity 的理由：

| 套件                                                 | 原失败数 | 缺失 identity 的旧调用                         | 修复方式                            |
| ---------------------------------------------------- | -------: | ---------------------------------------------- | ----------------------------------- |
| `communities/enable_test.exs`                        |        9 | `Communities.create/2`、`Dashboard.update/3`   | 显式 `command_id`，operations actor |
| `communities/writer/crud_test.exs`                   |        6 | `Communities.create/2`                         | 显式 `command_id`                   |
| `communities/moderators/moderator_test.exs`          |        3 | `Communities.create/2`                         | 显式 `command_id`                   |
| `communities/meta/meta_test.exs`                     |        2 | `Communities.create/2`、`update/3`             | 显式 `command_id`                   |
| `communities/tags/{blog,changelog,doc}_tag_test.exs` |        3 | 跨 community fixture 的 `Communities.create/2` | 显式 `command_id`                   |
| **合计**                                             |   **23** | 全部为 `cms.command_id_required`               | **已迁移**                          |

## 9. 静态门禁

当前 `scripts/check-command-identity.mjs` 已实现的检查范围包括：

- 扫描全部 `*Persist`，禁止 Gate、Command、Outbox、transaction/rollback 和 UUID generation；
- 扫描 resolver 与 CMS 根 facade 是否直接调用 Persist；
- 扫描 resolver、facade 与 production CMS source 是否派生 `command_id`；
- 前端另行限制 `createCommandId()` owner。

该门禁检查的是 production CMS source 中的 Persist 依赖与 identity 派生；它不负责统计测试 fixture
中被清退的 convenience arity，也不以 regex 证明每个 workflow 分支的语义。fixture 迁移必须由对应
focused suite 和 §11 命令集报告，不能把“静态门禁通过”写成“全仓库 mutation 已迁移”。

脚本仍不试图通过正则判定所有 `nil` workflow 分支、Outbox producer 的语义或 Gate action；这些必须由
对应 concrete Command/workflow 测试和人工 review 验收。

Phase 5 在现有扫描上增加：

- 新的 concrete Command 不得把 transaction owner 隐藏在 Writer/Persist；`Communities.Tags` 不再提供
  transaction fallback，seed/maintenance 必须显式进入命名 workflow；
- Writer/Persist 不得调用 `CMS.Gate`、`CMS.Command`、Audit、Activity、Outbox；
- 用户 mutation 的 resolver/facade 不得生成 UUID 或直接调用 Writer/Persist；read/projection、seed 和
  明确标注的 legacy service workflow 例外必须单独列入 migration manifest；
- `command_id: Ecto.UUID.generate()`、`command_id || Ecto.UUID.generate()` 以及 nil-command fallback
  在 production CMS 用户命令路径中为零；
- Outbox producer 必须显式选择 command/workflow identity；
- multi-scope effect 必须复用入口 identity，并用 effect/scope identity 区分多个 Event；
- GraphQL Receipt mutation 的 `commandId` 可追踪到 `CMS.Command.execute`；
- 同一个 public action 只有一个 `Commands.<Action>.execute`；
- maintenance workflow 不调用 user-only Command API；
- workflow `step_ref` 不命名为 `command_id`。

Outbox Event id、lease/lock ref、Article/DocTree node id、anonymous-view id 等真实资源或基础设施 identity
不是业务 `commandId`，静态门禁应使用窄 allowlist，而不是禁止所有 `Ecto.UUID.generate()`。

静态扫描只证明依赖方向，不替代行为测试。

## 10. 行为测试

### 10.1 Tag / TagGroup

- create tag/group 首次成功与同 `commandId` 重试返回同一实体；
- 相同 `commandId` 配不同 community/thread/payload 返回 identity conflict；
- delete tag/group response 丢失后从 Confirmation 恢复同一 terminal result；
- Gate denial 不写 tag/group/count/assignment/Outbox/Receipt；
- update/reindex 相同 payload 重试收敛且 taxonomy effect 不重复；
- set/unset 重复执行不重复更改 stats；
- 并发 reindex 不产生部分集合或重复 index；
- Persist/Outbox 失败使领域事实与 Receipt 一起回滚。

### 10.2 Assets

- register 按 storage identity、URL hash 和 public ref 重试不产生第二行；
- upload intent 可重新签发，旧 capability 按 TTL 失效；
- completion callback 重试返回同一 Asset，伪造 capability facts 被拒绝；
- delete 首次成功与 Receipt 恢复返回同一 terminal result；
- delete 的 Asset 状态与 provider-delete Outbox 原子提交；
- archive/restore 重复执行收敛并执行领域 Gate；
- reconciliation 重跑不重复创建有效 cleanup intent；
- maintenance Outbox 不出现 user command identity；
- replacement apply crash 后从稳定 step 继续，不重复已完成 ReplaceUse；
- partial conflict 不被聚合成全局成功。

### 10.3 Legacy identity 与 multi-scope effects

- Article Move 的 source/destination effects 共享同一 `commandId`，且不会触发 Outbox 唯一键冲突；
- Article moderation 多 binding effects 共享入口 command/workflow identity；
- Comment create/reply 无 command identity 时 fail closed，不再静默进入无 Receipt 分支；
- Upvote/Emotion 的生产入口不接受 nil command identity；
- Collect/undo 的生产入口不接受 nil command identity，直接 CMS reaction 调用通过
  `CollectConfirmation` replay；Accounts collect-folder 已在外层 Receipt transaction 内复用同一 identity，
  不再递归 claim；Metric 与 Outbox 仍复用入口 identity；
- Comment solution/pin 的 Activity operation ref 与 Receipt `commandId` 相同，重放从 Confirmation 恢复稳定 comment result；
- facade convenience arity 不生成 UUID，seed/maintenance caller 显式提供 workflow identity；缺少 actor 或
  command identity 的旧调用应收到 `cms.command_id_required`，而不是恢复隐式 UUID。

### 10.4 通用事务与恢复

- transaction owner 只有一层，不出现 nested transaction 掩盖 rollback；Comment solution/pin command path 不再进入 States 自己的 `Repo.transaction`；Collect 在外层 Accounts command 内复用当前 transaction，直接 reaction 调用由 `CMS.Command` 持有 Receipt；
- first execution 与 recovery 使用同一 result builder；
- Receipt、Audit/Activity 与 Outbox identity 可追踪但语义不混用；
- expired Receipt 不改变领域事实；
- Outbox worker retry 不重新执行领域 mutation。

### 10.5 Article sink/lock/category/status

- sink/undo-sink、comment lock/unlock、Post category/status 的 GraphQL `commandId` 缺失时在 schema
  层拒绝，非法 UUID 在 action-specific Command 边界 fail closed；
- concrete Command 只执行一次 Gate admission 和 ArticleBinding/branch scope transition，不在
  `StateChange`、`Kanban` 或 resolver 内生成第二 UUID；
- set-style 重试收敛到当前 Article/branch projection，不要求 Receipt；首次结果仍由同一 result builder
  返回；
- post/category/status 与四种 sink/lock thread fixture 覆盖成功、未登录和 enum/error 路径，当前
  `backend/api/test/groupher_server_web/mutation/cms/articles` + `backend/api/test/groupher_server_web/mutation/cms/sink` focused mutation suites **124/124**。

### 10.6 Press config

- `updatePressConfig` 缺失 `commandId` 时在 schema 层拒绝，非法或缺失 identity 不进入 writer；
- 同一 `commandId` 重试只恢复第一次 configuration confirmation，不重复递增 revision 或 Activity；
- Receipt callback 内由 `ConfigWriter` 使用已有 transaction，配置、Activity 与 confirmation 一起提交，
  cache invalidation 仍在 commit 后 best-effort 执行；Press suite **10/10**。

## 11. 验证命令

每批至少运行对应 focused tests，最终运行：

```text
cd backend/api
mix format --check-formatted <changed Elixir files>
mix compile --warnings-as-errors
mix test test/groupher_server/cms/communities
mix test test/groupher_server/cms/assets_test.exs
mix test test/groupher_server/cms/command_receipt_test.exs
mix test test/groupher_server/cms/outbox_test.exs
mix test test/groupher_server/cms/communities/commands/tag_commands_test.exs

cd ../../
pnpm run graphql:codegen
pnpm --filter @groupher/frontend-core run type-check
pnpm check:command-identity
pnpm docs:check
git diff --check
```

若测试文件在实施期间拆分，验证命令同步更新为真实路径，不保留不存在的目录占位。

§11 命令集的初始基线为 `168/191`，23 个失败全部集中在 convenience arity 清退后的五组 legacy
fixture，而不是只有 Tag CRUD：

| 套件                                                 | 失败数 | 触发点                                                  |
| ---------------------------------------------------- | -----: | ------------------------------------------------------- |
| `communities/enable_test.exs`                        |      9 | setup `Communities.create/2`；测试 `Dashboard.update/3` |
| `communities/writer/crud_test.exs`                   |      6 | 旧 Writer CRUD `Communities.create/2`                   |
| `communities/moderators/moderator_test.exs`          |      3 | 跨 community `Communities.create/2`                     |
| `communities/meta/meta_test.exs`                     |      2 | `Communities.create/2`、`Communities.update/3`          |
| `communities/tags/{blog,changelog,doc}_tag_test.exs` |      3 | 跨 community tag fixture 的 `Communities.create/2`      |
| **合计**                                             | **23** | 全部返回 `cms.command_id_required`                      |

这些失败是 fail-closed 合同的预期迁移债务，不能通过 facade 重新生成 UUID 规避。本批已将测试夹具
和旧 GraphQL Tag CRUD mutation document/variables 改为传入显式 identity，并补上 transport action 与
领域 `community.update` admission；重跑 §11 四个 aggregate suites 后结果为：`communities` 134/134、
Assets 24/24、Receipt 26/26、Outbox 10/10，即 **194/194**。上面的 Tag focused **104/104** 已包含
`tag_commands_test.exs` 的 2 个测试，不是额外相加。Reaction upvote GraphQL suite 曾有 5 个旧 direct setup
调用省略 command identity，现已迁移并验证 **21/21**；Emotion GraphQL suite 曾有 6 个 direct reaction setup
和 1 个 Dashboard setup 省略
identity，现已迁移并验证 **14/14**；CMS Interactions ReadState suite 的 16 个 direct reaction setup/并发
调用也已迁移并验证 **13/13**。Article publish 与 DocTree publish 的 legacy internal fixtures 又补齐
显式 command identity，相关 focused suite 为 **72/72**；Analysis Contribution 的 maintenance
workflow 改用 typed workflow identity，相关 suite 为 **17/17**。这类 fixture 迁移不应通过恢复
`nil` fallback 解决。上述数字是各迁移切片的 focused 证据；扩展到评论 create/reply 和全测试树
reaction fixture 后，评论域套件为 **312/312**、reaction/emotion/read-state 套件为 **132/132**、
资产 query 套件为 **3/3**。本轮 backend 全量 `mix test --max-failures 100` 为 **2189 passed,
1 excluded, 0 failures**（2190 tests）。该数字证明回归树稳定；Asset Upload/Provider/Replacement
workflow 与 DocTree 仍按 deferred 边界单独验收，不因全量回归通过而被误报为已迁移。

扩展的 GraphQL community-tag mutation 目录目前为 **41/41**：Tag CRUD、set/unset（post/blog/changelog/doc）
和 reindex 均已通过。Doc set/unset 的实现保留 FrontDesk public projection 提供的 main-branch
identity，并在 `with_branch_check` 内完成 branch-scoped lock、lifecycle 和 policy admission；非 main
branch 的显式路径参数仍属于 §6 的后续合同债务。

## 12. 提交拆分

建议按可独立回滚的合同拆分：

1. `refactor(be): add typed outbox producer identity`；
2. `refactor(be): split tag persistence from workflows`；
3. `feat(be): migrate tag commands and receipts`；
4. `refactor(be): split asset persistence from workflows`；
5. `feat(be): migrate asset user commands`；
6. `refactor(be): separate asset maintenance identity`；
7. `refactor(be): make replacement plan steps resumable`；
8. 其余 mutation 每个 owner 单独批次。

每批显式 stage 路径/hunk，检查 cached `name-only`、`stat`、`diff --check` 和 focused tests；不吸收
工作树中其他迁移或生成噪音。

## 13. 非目标

本文不：

- 把所有 CMS mutation 强行迁入 `CMS.Command`；
- 建立全局 Command Bus 或通用 CRUD framework；
- 用 Receipt 替代数据库唯一约束、锁、expected version 或 workflow state；
- 把 uploadRef、batchRef、planRef、workflowRef 改名为 commandId；
- 让 GraphQL Passport 取代领域 Gate；
- 把普通 tag/asset UI 状态塞进 Lifecycle；
- 让 Persist 负责事务、authorization 或 effects；
- 修改 Auth/session 或 view/read marker 的既有归属；
- 在分类未完成前宣称“全仓库 CMS mutation 已迁移完成”。
