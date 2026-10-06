# Groupher Action Matrix 与 Transition Contract

本文只回答三个问题：

1. Community、普通 Article、Doc branch 当前有哪些 action，它们的理想 transition contract 是什么；
2. 每个 action 是否覆盖 version conflict、权限失败和重复请求测试；
3. 客户端操作如何映射到 `commandId`、`queueKey` 和 `reconcile`。

本文以当前代码为准。已有设计文档只作为目标合同，不能代替实现和测试证据。

当前实现已从旧 `operationRef` 和 `interaction_operation_receipts` 直接切换到
`commandId` 与 `cms.command_receipts`，没有回填旧 receipt、保留旧字段别名或双读双写。
Receipt 恢复属于服务端内部实现，不进入产品合同；迁移顺序以 CMS Command Receipt 重构文档为准。Lifecycle、TrashAction、
DocPublishRelease、Audit 等领域事实始终按各自合同保留，不随幂等 Receipt 迁移。

本文延续 [Command：复杂领域操作的组织边界](../artiment/command.md) 和
[Optimistic Operation](../../migrations/tanstack/optimistic-operation.md)，不引入全局 Command Bus、通用状态机或客户端第二份 confirmed store。

同步 CMS 用户命令的长期 API 与 Receipt 所有权边界见
[CMS Command](../../architecture/cms-command.md)；从历史 `CMS.CommandReceipt.run_user_command/8`
迁移到该目标的阶段与验收见
[CMS Command Receipt 重构](../../migrations/cms-command-receipt-refactor.md)。本文只冻结业务一致性、
action matrix 与产品可观察结果，不冻结当前函数参数、callback 或模块内部实现。

## 相关文档与权威边界

本文是 Community、Article、Doc branch 的改进方案和验收清单，不取代现有领域合同。这里仅说明其他文档提供的上下文，以及本文应从哪里取得当前实现证据；不在本文复制它们的完整设计。

```text
Command 通用写入边界
  └─ transition_contract_improve：把通用合同应用到三类 action
       ├─ Community Lifecycle：Community state / Blocker / version
       ├─ Gate V3：Article / Doc Lifecycle、Versioning、Release
       └─ Interaction V4：当前 receipt / revision / transaction 实现证据

Optimistic Operation：command identity / queue / rollback / reconcile
  └─ Optimistic Read Your Writes：浏览器 confirmed receipt / revision overlay

Activity V3：command 与 Audit / Activity event 的关联
```

| 文档                                                                                                   | 当前负责的内容                                                                                               | 与本文的关系                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Command：复杂领域操作的组织边界](../artiment/command.md)                                              | Command、Writer、事务、锁、Gate、Lifecycle、Audit 和 post-commit effect 的职责边界                           | 通用 `cms.command_receipts` 最终应归属这个后端合同；本文只冻结目标并应用到具体 action，不建立 Command Bus                                                     |
| [CMS Command](../../architecture/cms-command.md)                                                       | 同步用户 Command 的长期 API、FrontDesk 结果投影、Receipt/Store 所有权和正反例                                | 本文冻结业务与并发合同；CMS Command 冻结长期代码边界，产品端不感知首次执行或 Receipt 恢复                                                                     |
| [CMS Command Receipt 重构](../../migrations/cms-command-receipt-refactor.md)                           | 从 `run_user_command/8`、replay callback 和内部状态泄漏迁移到目标架构的阶段与验收                            | 只记录实施顺序和临时状态，不覆盖本文业务合同或 CMS Command 长期边界                                                                                           |
| [CMS Facade 与实现目录收口](../../architecture/cms-facade-directory.md)                                | 顶层 facade、Reader/Writer 命名、`commands/` 目录与内部实现下沉顺序                                          | 本文冻结 command/receipt 行为；目录收口文档保证 Articles、DocTree 与 CommandReceipt 在不改变公开 API 的前提下落实该边界                                       |
| [Optimistic Operation](../../migrations/tanstack/optimistic-operation.md)                              | 前端从 optimistic apply 到 execute、rollback、reconcile 的内存期生命周期；该旧章节仍使用 `operationRef` 术语 | 本文把目标命名收敛为 `commandId`，并将它与 `queueKey`、version/revision 对接                                                                                  |
| [Optimistic Read Your Writes](../../migrations/tanstack/optimistic-read-your-writes.md)                | 浏览器跨刷新 confirmed receipt、revision guard 和旧 public cache overlay                                     | 其中约 960 秒的浏览器 receipt 解决缓存收敛；本文定义的服务端 receipt 保留 24 小时，解决 ambiguous commit 和 transport retry，两者不能混用                     |
| [Query Sync Cache](../../migrations/tanstack/query-sync-cache.md)                                      | public、viewer、Dashboard Query 的缓存边界与主动失效                                                         | 本文的 reconcile 只能在该缓存所有权边界内 patch/invalidate，不建立第二份 confirmed store                                                                      |
| [Community Lifecycle](./contract.md)                                                                   | Community state、Blocker、allowed transition 和锁内 version guard；Lifecycle 不判断 actor                    | Community action matrix 的状态和 precondition 以它为当前领域合同；`commandId` 和 receipt 由外层 Command transaction 负责                                      |
| [Gate V3：Article Core 与 Doc Release 边界](../gate/v3.md)                                             | Article Draft/Public/Lifecycle、Doc branch、DocLifecycle、Versioning 和 `DocPublishRelease` 的边界           | Article、Doc action matrix 的领域状态和 release 以它为依据；通用 receipt 可以指向 release，但不能取代 release                                                 |
| [Gate V4：资源级强类型 Context](../gate/v4.md) 与 [Gate V5：Scope Query 命名与分发边界](../gate/v5.md) | Gate 的 typed Access/Scope Context，以及当前 Scope query 命名和分发                                          | Gate 继续负责 actor/action admission；`commandId` 不能进入 Gate Policy/Scope Context，receipt 也不能改变 read scope                                           |
| [Artiment Interaction V4](../interaction/v4.md)                                                        | Interaction facade、Gate transaction、reaction fact、ReadState 和切换前的幂等实现                            | 历史上的 `interaction_operation_receipts` 已在本次切换中删除并由通用 `cms.command_receipts` 取代；reaction fact、projection 和 revision 仍由 Interaction 拥有 |
| [Activity V3](../activity/v3.md)                                                                       | Audit/Activity 事实、查询和规模治理                                                                          | `commandId` 用于关联一次 command；Activity 自己的 event identity 仍是另一层身份，长期审计不能依赖 24 小时 receipt                                             |

现阶段其他文档仍在描述当前代码，因此其中的 `operationRef`、`operationReplayed` 和
`interaction_operation_receipts` 不能直接当成已经完成的 `commandId` 和
`cms.command_receipts`。本文描述目标差异；只有实现、GraphQL、测试及对应权威文档一起迁移后，旧术语才算真正被取代。

历史实施记录（例如 [urql 迁移到 TanStack Query](../../architecture/urql-to-tanstack-query.md)）只用于解释旧路径，不作为新 CommandReceipt 合同的权威来源，也不要求为了本方案重写全部历史章节。

## 1. Action matrix 与理想 transition contract

### 1.1 通用合同

一个完整的 command 不能只有 `from -> to`。每次状态改变都必须携带以下信息：

先冻结本文使用的命名：

- `commandId`：一次用户意图的唯一键。网络超时后的重试必须复用同一个值；
- Receipt 恢复：服务端没有再次执行写入，而是返回同一个 command 的已确认结果；这是服务端内部执行策略，
  产品端只观察相同的成功结果，不接收或分支处理 Receipt 恢复状态；
- `queueKey`：客户端哪些 command 必须串行的分组键，不是请求身份；
- `expectedVersion` 或领域专用 revision：用户基于哪个已确认状态发起 command；
- 资源不使用笼统的 `resourceRef`。Community、Article、Doc 分别使用 `communitySlug`、`articleKey`、`branchKey`/`docId` 等领域键。

本文现有实施章节仍使用数据库和已落地 GraphQL 中的 `commandId` 名称；目标 API 统一采用
`commandId`，迁移与兼容要求见 CMS Command Receipt 重构。选择 command identity 而不是
`operationKey`，是因为后端的写边界已经称为 Command，而前端又已有
`queueKey`；`operationKey` 容易与队列分组键混淆。首次执行或 Receipt 恢复属于服务端内部状态，
不再为它建立产品响应术语。
当前代码中的 `operationRef`、`operationReplayed` 和若干 `...Ref` 是现状证据，不是本文建议的新协议名；迁移时应端到端一次性改名，不提供旧字段 alias、fallback、双读或双写。

```text
Command {
  commandId
  command
  target: communitySlug | articleKey | (branchKey, docId)
  expectedVersion | expectedDraftVersion | expectedChecklistRevision
  input
}

request authentication resolves initiator; command input never supplies trusted identity
  -> BEGIN
  -> configure claim wait budget
  -> INSERT receipt claim by (initiatorType, initiatorKey, commandId)
       ON CONFLICT DO NOTHING
       inserted: this request owns the new command
       conflict: wait for the competing transaction, then read its committed receipt
         expired receipt -> lock/delete it, then reclaim（见本节末尾）
         same fingerprint -> replay stored envelope
         different fingerprint -> command_id_conflict
  -> new command: Gate.access_check(initiator, gateAction, canonical target)
  -> lock canonical target/lifecycle
  -> verify expected version/revision
  -> verify allowed transition and blockers
  -> mutate target + lifecycle + Audit/outbox
  -> finalize receipt with outcome/result identity or a versioned result payload
  -> COMMIT
  -> return canonical business result
```

这里的 claim 和 finalize 是 receipt 的两个阶段，但处于**同一个数据库事务**，不是先提交一个
`pending` receipt 再执行领域事务。PostgreSQL 唯一约束会让第二个并发 INSERT 等待第一个事务：第一个提交后，
第二个读取 completed receipt 并 replay；第一个回滚后，第二个取得 claim，按新 command 执行。因此不会出现
“第二个请求先查不到 receipt、随后被第一个 bump 的 version 打成 `lifecycle_conflict`”的合同漏洞。

竞争请求在唯一约束冲突的 INSERT 或已有 receipt 的 `FOR UPDATE` 上等待；PostgreSQL 的 `lock_timeout` 同时约束这两类
等待。长事务超过预算时返回 `command_resolution_pending`，不再额外引入 advisory lock 或第二套 identity 锁。

实现时必须给 claim wait 设置短于 HTTP/request deadline 的 `lock_timeout`，并给整个 command transaction 设置
`statement_timeout`。当前实现使用 4 秒 `lock_timeout` 与 30 秒 transaction/statement budget。等待超时不能原样暴露为数据库错误，应回滚当前尝试并返回可重试的
`command_resolution_pending`；客户端退避后继续用**同一个** `commandId` 重试。这样第一笔事务随后提交时，
重试会 replay；第一笔回滚时，重试可以重新取得 claim。长耗时 batch 应拆分为 job/chunk，不能长期占用同步请求连接。
`lock_not_available/query_canceled` 保持这一可重试映射；`DBConnection.ConnectionError` 即使最终映射为
pending 也必须记录原始异常，不能静默吞掉。尤其 Gate denial 路径绝不能被误报成 pending。

`command` 是稳定的 handler/receipt 身份，例如 `community.request_destroy`；`gateAction` 是 handler
内部派生的授权动作，例如 `:request_destroy`，绝不能由客户端指定。切换前实现中的 receipt 字段 `operation`
在新 schema 和代码中直接统一为 `command`；不搬迁旧 receipt 数据，也不保留兼容字段。

replay 分支仍然必须完成请求认证，并校验 initiator identity 与 fingerprint，但它：

- 不重新执行 write Gate、version/revision 检查、transition 或领域写入；
- 不再次写 reaction fact、projection、counter、Audit 或 outbox；
- 不再次触发通知、搜索索引、成就或任何 post-commit effect；
- 一定从 receipt 的非敏感 envelope 取得 outcome 和 result identity；领域结果恢复可以用当前 Reader/Scope
  重读一个 canonical result，或者从 `result_payload` 恢复无法重新查询的最小结果。无论采用哪种方式，
  都不能重新执行写入或 post-commit effect。

若 replay handler 需要返回资源，它必须通过当前 Reader/Scope 重新读取并遵守当前可见性；若资源现在已不可见，
command 仍然是已提交成功，服务端返回 receipt envelope，但省略当前资源或标记 result unavailable。不能把历史
成功改写成 permission denied，也不能从 receipt 泄漏旧资源快照。

这里三个机制不能互相替代：

- `expectedVersion` 判断用户看到的状态是否已经过期；
- `commandId` 识别网络重试是否仍是同一次逻辑操作；
- 数据库锁只负责把并发执行串行化，不证明后执行者的意图仍然有效。

当前最主要的问题正是这三者没有在所有 lifecycle command 上同时成立。

#### Receipt 为什么不能成功后立刻删除

服务端只知道 transaction 已提交，无法知道浏览器是否收到响应。最需要 receipt 的场景恰好是“写入成功、响应在网络中丢失”：如果成功后立刻删除，客户端以同一个 `commandId` 重试时，服务端会把它当成新 command，再执行一次副作用。

但 receipt 也不应无限保留。切换前的 `cms.interaction_operation_receipts` 只有
`inserted_at/updated_at`，没有 `expires_at` 和清理任务，因而会持续增长；该表已删除，当前统一 receipt
使用 24 小时保留期和有界 retention job。

长期方案统一使用 `cms.command_receipts`，不再让 Interaction、Community、Article、Doc 分别定义自己的幂等规则。它是同步 CMS command 的共享幂等基础设施，不是接管业务执行的全局 Command Bus：具体 command 仍由领域模块拥有，Gate、Lifecycle、Versioning、Trash 和 Release 的职责不变。

本文将以下内容视为确定的目标合同，而不是待选方案：

- 请求身份在目标 API 中统一为 `commandId`；首次执行或 Receipt 恢复不改变产品响应形状；
- 需要处理 ambiguous commit/retry 的同步 CMS command 统一写入 `cms.command_receipts`；
- receipt 使用本节“Receipt 为什么不能成功后立刻删除”中定义的统一 idempotency window；
- Community blocker、`TrashAction`、`DocPublishRelease`、Lifecycle 和 reaction fact 不再分别承担通用幂等协议；
- receipt 可以指向领域事实，但不能取代领域事实，也不能取代 Audit/Activity。

```text
new command commits
  -> cms.command_receipts retained for 24 hours
  -> background sweeper deletes expired receipts in bounded batches
  -> Audit / Activity follows its own retention policy，不依赖 receipt
```

- 所有接入通用协议的同步 command 使用同一个窗口，不按 action 分出多套保留期；
- 表必须有 `expires_at` 和清理索引，由后台任务按时间分批删除；大规模后再考虑按时间分区；
- 协议必须公开 idempotency window。过期后相同 `commandId` 不再保证 replay，此时仍由领域唯一约束、Lifecycle precondition 和数据库约束防止非法重复；
- receipt 不是 Audit。它只保存重放所需的最小结果或结果主键，不能因为审计要长期保留而永久堆积。

当前前端 `CONFIRMED_WRITE_RECEIPT_TTL_MS` 是 960 秒，只用于覆盖 ArticleStats.CachePolicy 的 public HTML fresh、stale-while-revalidate 和 reconcile margin；它不是服务端 command 的 idempotency window，二者不能共用一个 TTL 语义。

duplicate request 测试除了同 key replay，还应固定 retention 边界：窗口内同 key 只产生一次业务事实；同 key 不同 fingerprint 永远冲突；清理任务只删除已过期 receipt；窗口过期后的请求仍必须通过 Gate、version 和领域不变量，不能因为 receipt 已删除而绕过业务约束。

#### 通用 receipt 与领域事实的边界

```text
cms.command_receipts
  -> 这个 initiator 的 commandId 是否已经执行
  -> 24 小时内如何 replay
  -> result_key 指向领域结果，或保存最小 replay payload

TrashAction / DocPublishRelease / Lifecycle / reaction fact
  -> 业务上实际发生了什么
  -> 按领域生命周期保留

Audit / Activity
  -> 谁在什么时候做了什么
  -> 使用独立的长期保留策略
```

目标表至少包含：

```text
cms.command_receipts
  initiator_type        user
  initiator_key         authenticated user id
  command_id UUID
  command
  target_type
  target_key
  payload_fingerprint
  outcome               changed | unchanged
  result_key
  result_payload
  expires_at
  inserted_at
  updated_at

UNIQUE(initiator_type, initiator_key, command_id)
INDEX(expires_at)
INDEX(target_type, target_key)
```

`payload_fingerprint` 必须绑定 command、领域目标、业务 input 和 expected version/revision。相同 actor、相同 `commandId`、相同 fingerprint 才能恢复已确认结果；复用同一个 commandId 提交不同 command、目标、input 或并发前提必须返回 `command_id_conflict`。`target_type/target_key` 是 Receipt 内部的通用目标/作用域索引，不限定为 Article 或 Comment；创建、恢复和 batch command 可以使用 owner 或领域 scope。fingerprint 不是可查询的目标字段，result 也不等于 target。

`result_payload` 只允许保存无法从领域事实恢复的最小、版本化 replay envelope，不保存完整 Community、Article 或 Doc，也不把敏感资源快照放进通用 JSON。已有领域结果时保存 `result_key`：例如 Docs publish receipt 指向 `DocPublishRelease`，具体结果类型由 `command` 和 `target_type` 解释；但 `DocPublishRelease` 本身不承担通用幂等协议。

runner 只拥有 transaction、claim、finalize 与 replay 调度，不嗅探 `%Comment{}`、`%Article{}`、tree map
或其他领域结果形状。简单 command 可以默认以 `target_key` 作为 `result_key`；复合结果必须在 execute
成功时显式返回 metadata。DocTree 的不可重读 tree/subtree envelope 由
`CMS.DocTree.CommandReplay` 负责版本化编码和解码，不能把 codec 再塞回通用 receipt。

通用 receipt 不持久化无人消费的 `confirmed_versions`。需要参与客户端 RYW merge 的
Article/Comment revision 属于对应 mutation response 与前端 session receipt 合同，不进入 command receipt。
`outcome` 只允许 `changed | unchanged`；
首次执行或 Receipt 恢复是 Runner 内部计算状态，不是持久化 outcome，也不进入领域实体或产品响应。
例如 `archive_before` 在固定 threshold 下没有任何候选时，可以提交 `outcome: unchanged`：这表示 command
已成功验证并得出“无需改变”的确定结果，后续同 key 可以 replay；Gate denial、version conflict 或业务错误则不是
`unchanged`，必须按失败路径回滚 receipt。

#### 无 User actor 的 command

通用 identity 不能依赖 nullable `actor_id`，也不能伪造 system user：

| 来源                 | initiator identity                            | `commandId` 的产生与重试                                 |
| -------------------- | --------------------------------------------- | -------------------------------------------------------- |
| 浏览器用户           | `user + authenticated user id`                | 浏览器在一次用户意图开始时生成；transport retry 复用     |
| 人工 operations 工具 | `user + operator user id`                     | operations client 生成；重试复用                         |
| 后台 job             | `job + stable job id`                         | enqueue 时生成并写入 job args；每次 job retry 复用同一值 |
| 系统入口             | `system + stable capability/command identity` | command entry 生成并持久化到可重试载体后再执行           |

当前 CMS.Command 只接受 authenticated user；Community Lifecycle 等内部函数保持 actor-independent，
外层 user command 负责 initiator、Gate 或 maintenance policy。未来 job/system 若有真实需求，另设独立入口，
不扩展当前 user API。
`initiator_type/initiator_key/command_id` 的组合才是 claim 唯一键。

#### 失败 command 是否保留 receipt

只保留已经提交的 `changed` 或 `unchanged` 结果。Gate denial、validation error、version conflict 和领域写入失败
都回滚 claim，不持久化 receipt；权限后来变化时，同一 key 的重试会重新执行 Gate，而不会 replay 旧 denial。
`pending` 只是事务尚未提交时数据库中的瞬时行，不是可读 outcome；`replayed` 也是响应语义，不是 outcome。
若调用方改变 input 或 expected version，应生成新的 `commandId`；同 key 不同 fingerprint 一律冲突。

receipt 必须和领域写入位于同一数据库 transaction：Gate、version 或领域写入失败时，claim 一起 rollback；成功时，领域事实、Audit/outbox 和 completed receipt 一起 commit。并发的相同 key 由唯一约束串行化，后一个请求读取前一个已提交的结果。

有一项明确例外：若产品合同要求记录 authenticated Gate denial，denied Activity 不是成功 command 的
receipt 附件，必须在 receipt transaction 回滚之后由领域 facade 写入。Article trash 使用同一
`commandId` 作为 Activity `operation_ref`；Activity 的确定性 `event_ref` 唯一约束保证同 key 重试只留下
一条 denied fact。24 小时 receipt 过期不影响该 Activity 幂等性。底层 `Trash.trash` 不自行写 denial，
避免它在 caller transaction 中被一并回滚。
如果冲突行已经超过 `expires_at`，请求应在锁定该 receipt 后删除过期行并重新 claim；不能因为 sweeper 尚未运行而把 24 小时窗口无限延长。

`CMS.Command` 的 user command 入口不接受 nil `commandId`，因此公开 receipt-backed GraphQL mutation 统一声明
`commandId: ID!`，不会再从 transport 层省略 identity。少数只供内部直接调用的 facade 仍可在没有 transport
上下文时生成一次性 key；这类调用不是 retry/replay 合同，不能把返回的 key 当成客户端重试依据。job/system
入口尚未接入共享 runner，接入时必须先持久化稳定 initiator/key，再复用同一事务管线，而不是新增第二套 runner。
GraphQL response type 上的 nullable `commandId` 只是兼容“该 mutation 没有 receipt 元数据”的响应字段；它不改变
receipt-backed mutation input 的 `commandId: ID!` 要求，也不代表客户端可以省略请求 key。

### 1.2 Community

当前状态权威在 `CMS.Communities.Lifecycle`，owner archive 通过 Blocker 投影为 Lifecycle state。GraphQL 目前只暴露 `request_destroy_community`；`restore`、`schedule_destroy`、`cancel_destroy`、`destroy` 仍是 Context/operations 命令。

实现位置：[Community Lifecycle](../../../backend/api/lib/groupher_server/cms/communities/lifecycle.ex)、[Community resolver](../../../backend/api/lib/groupher_server_web/resolvers/cms_resolver.ex)、[Community Lifecycle tests](../../../backend/api/test/groupher_server/cms/communities/lifecycle_test.exs)。

#### 切换前基线 action matrix

| Action             | 允许的当前状态                           | 当前结果                                        | Gate                                       | Version                | Duplicate                                                       |
| ------------------ | ---------------------------------------- | ----------------------------------------------- | ------------------------------------------ | ---------------------- | --------------------------------------------------------------- |
| `request_destroy`  | `active/read_only/suspended/archived`    | 建立 `owner_archive` blocker，投影为 `archived` | GraphQL resolver 调用 `Gate.access_check`  | 底层可选；GraphQL 不传 | 已有 blocker 时返回同一 blocker，但不是按 `operationRef` replay |
| `restore`          | 存在有效期内的 `owner_archive` blocker   | 释放 blocker，按剩余 blockers 重算状态          | Policy 有 `:restore`，命令本身不接收 actor | 底层可选               | 第二次调用返回 `blocker_not_found`                              |
| `schedule_destroy` | `archived` 且无 legal/moderation blocker | `archived -> pending_destroy`                   | Policy 有 action，命令本身不接收 actor     | 底层可选               | 第二次调用返回 state conflict                                   |
| `cancel_destroy`   | `pending_destroy`                        | 按 active blockers 重算状态                     | Policy 有 action，命令本身不接收 actor     | 底层可选               | 第二次调用返回 state conflict                                   |
| `destroy`          | `pending_destroy` 且 destroy guards 通过 | 终止 blockers，写 Audit，进入 `destroy`         | Policy 有 action，命令本身不接收 actor     | 底层可选               | 第二次调用返回 state conflict                                   |

Dashboard 的 Danger Zone 目前也没有消费这个合同：
[useDangerZone](../../../frontend/core/unit/DsbThread/logic/useBaseInfo/useDangerZone.ts) 中
`archiveCommunity` 和 `deleteCommunity` 仍只是 `console.log`。因此下面讨论的客户端
version、command identity 和 reconcile 不是对现有 UI 的小修补，而是正式接入这些 action 时必须先冻结的协议。

#### 实际场景：旧页面误删社区

管理员 A 打开 Danger Zone，看到 Lifecycle version 12。随后运营 B 给社区加上 legal hold，Lifecycle 已经变为 version 13。A 的旧页面仍然提交删除：

```text
当前：requestDestroyCommunity(community)
      -> resolver 生成新的 operationRef（当前字段名）
      -> 没有 expectedVersion
      -> 以当前状态执行 request_destroy
```

底层明明支持 `expected_version`，公开 mutation 却没有把 version 从读取结果带回来，因此无法区分“用户确认 version 12 的删除”与“用户明确接受 version 13 后重新删除”。数据库锁也解决不了这个问题：它只能保证两个写入不同时执行。

合理形态：

```text
requestDestroyCommunity(
  communitySlug,
  expectedVersion: 12,
  commandId: clientGeneratedUUID
)

transaction:
  authenticate actor + claim commandId
  -> Gate :request_destroy（与 lock/transition 位于同一 transaction）
  -> lock Lifecycle
  -> version 不是 12：返回 lifecycle_conflict，不建立 blocker
  -> version 是 12：建立 blocker并返回 version 13
```

#### 实际场景：请求成功但响应丢失

第一次 `request_destroy` 已经提交，但浏览器没有收到响应并重试。现在 resolver 每次生成新的 `operationRef`（当前字段名）；底层因 blocker 已存在而返回同一 blocker。最终状态虽然没有重复变化，但客户端无法知道这是“第一次 command 的 replay”，Audit/监控也无法稳定关联同一次用户意图。

`restore`、`schedule_destroy`、`cancel_destroy` 和 `destroy` 更明显：重复请求直接变成 state conflict 或 `blocker_not_found`。用户会看到失败，但实际上第一次请求可能已经成功。

合理形态是由调用方生成并重用 `commandId`，服务端保存 command receipt：

```text
(initiatorType, initiatorKey, commandId)
  + fingerprint(command, domain target, input, expected version/revision)
  -> confirmed result
```

相同 identity 重试返回与首次执行相同的 canonical business result；相同 `commandId` 被用于不同 command、目标、input 或 expected version/revision 时应返回 command identity conflict。
所有符合接入条件的同步 command 都使用 `cms.command_receipts`。Community blocker、`TrashAction` 和
`DocPublishRelease` 继续保存领域事实；通用 receipt 只保存 replay envelope 或指向这些事实的结果主键。

#### Community 理想 transition contract

| Action             | Gate                                       | 必需 precondition                                                                            | 原子写入                              | Confirmed result                              |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `request_destroy`  | owner/passport `community.request_destroy` | expected `CommunityLifecycle.version`；状态为 `active \| read_only \| suspended \| archived` | owner blocker + Lifecycle + Audit     | blocker key、Lifecycle state/version、receipt |
| `restore`          | `community.restore`                        | expected `CommunityLifecycle.version`；owner blocker 存在且未过恢复期                        | 结束 blocker + 重算 Lifecycle + Audit | Lifecycle state/version、receipt              |
| `schedule_destroy` | operations `community.schedule_destroy`    | expected `CommunityLifecycle.version`；`archived`；无 destroy blocker                        | `pending_destroy` + Audit             | Lifecycle state/version、receipt              |
| `cancel_destroy`   | operations `community.cancel_destroy`      | expected `CommunityLifecycle.version`；`pending_destroy`                                     | 重算 Lifecycle + Audit                | Lifecycle state/version、receipt              |
| `destroy`          | operations `community.destroy`             | expected `CommunityLifecycle.version`；`pending_destroy`；保留期已到；无 blocker             | 终止 blocker + `destroy` + Audit      | terminal state/version、receipt               |

Gate 必须在拥有 Lifecycle lock 的同一事务里完成准入。现在 resolver 先 Gate、随后 Lifecycle 自己开启事务，中间仍存在 admission fact 改变的窗口。
`restore` 的 expected version 明确指向被锁定的 `CommunityLifecycle.version`；blocker 是否存在是同一锁内检查的领域 precondition，不使用 blocker 自己的 version 代替 Lifecycle version。

### 1.3 普通 Article（Post / Blog / Changelog）

普通 Article 的内容版本和资源生命周期是两套 version：Draft row 的 `version` 保护编辑内容，`ArticleLifecycle.version`
保护资源状态。公开 Draft update 和 publish 分别携带对应的 expected version，publish 同时校验两者。

实现位置：[Article Publish](../../../backend/api/lib/groupher_server/cms/articles/publish.ex)、[Article Lifecycle](../../../backend/api/lib/groupher_server/cms/articles/lifecycle.ex)、[Article Trash](../../../backend/api/lib/groupher_server/cms/articles/trash.ex)。

#### 切换前基线 action matrix

| Action               | 当前状态变化                                      | Gate                              | Version                                       | Duplicate                                                |
| -------------------- | ------------------------------------------------- | --------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| `create_draft`       | 无 Lifecycle -> `draft_only`                      | article editor + Passport         | 新建，无 expected version                     | 没有 command identity                                    |
| `update_draft`       | Lifecycle 不变；Draft version `n -> n+1`          | `:edit`                           | `expectedVersion` 必需                        | 相同请求重复提交会再次更新，不是 replay                  |
| `publish_draft`      | `draft_only/published -> published`，Draft 被消费 | `:publish`                        | 切换前 GraphQL 不接收 Draft/Lifecycle version | 服务端生成 operation ref；重试通常找不到 Draft           |
| `archive_before`     | `published -> archived`                           | maintenance source，无 actor Gate | row lock，无 expected version                 | 候选查询避免再次选中，但没有 command replay              |
| `trash`              | `draft_only/published -> deleted`                 | `:delete`                         | row lock，无 expected version                 | 已存在 membership 时返回旧 item，但 fast path 在 Gate 前 |
| `restore`            | `deleted -> saved restore_state`                  | `:restore`                        | row lock，无 expected version                 | membership 已删除后再次调用返回 not found                |
| `permanently_delete` | `deleted -> destroy -> 删除 aggregate/lifecycle`  | 调用路径控制                      | row lock，无 expected version                 | item 不存在时返回 `done: true`，但无 replay metadata     |

#### 实际场景：两页签发布了用户没有确认过的内容

页面 A 读到 Draft version 4，准备发布。页面 B 又把 Draft 更新到 version 5。A 随后点击发布：

```text
当前 publishPostDraft(community, id)
  -> lock article
  -> 读取最新 Draft version 5
  -> 发布 version 5
```

A 实际确认的是 version 4，却发布了 B 的 version 5。这里不会出现数据库冲突，因为代码主动读取了最新 Draft；但从用户意图看，这是错误的 last-observed-write 语义。

尤其需要指出，[Article Publish](../../../backend/api/lib/groupher_server/cms/articles/publish.ex) 中的 `validate_version/1` 实际只校验 slug，并没有校验任何 version。这个命名会让维护者误以为 publish 已经有并发保护。

合理形态：publish 同时绑定内容和生命周期：

```text
publishDraft(
  articleKey,
  expectedDraftVersion: 4,
  expectedLifecycleVersion: 2,
  commandId
)
```

Draft 已变成 5 时返回 `draft_conflict`；Lifecycle 被归档/删除时返回 `lifecycle_conflict`。客户端重新加载 diff 后，由用户再次确认发布。

#### 实际场景：删除请求绕过一致的 Gate 语义

`Trash.trash/3` 在发现已有 Trash membership 时直接返回该 item，只有首次 trash 才执行 `Gate.access_check(actor, :delete, article)`。这让“同一 action 的首次执行”和“重复执行”走了不同的授权路径。即使 GraphQL 当前可能因为 Reader 隐藏已删除 Article 而挡住部分调用，domain command 本身仍然不是自洽的安全边界。

合理形态是先用 authenticated actor 和 command identity 查 receipt：

- 同一 actor、action、领域目标、input、`commandId`：允许 replay 已授权的原结果；
- 新 `commandId`：必须重新 Gate；
- 不允许仅因为资源已经处于目标状态就跳过 actor admission。

#### Article 理想 transition contract

| Action               | 必需 precondition                             | Concurrency contract                                                    | Client result                                               |
| -------------------- | --------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| `create_draft`       | Gate `:create`                                | `commandId` 保证重试不创建两个逻辑 Article                              | canonical `articleKey` + Draft version + Lifecycle version  |
| `update_draft`       | Gate `:edit`；Lifecycle 可写                  | expected Draft version + `commandId`                                    | confirmed Draft version；replay 标记                        |
| `publish_draft`      | Gate `:publish`；Draft 存在；Lifecycle 可发布 | expected Draft version + expected Lifecycle version + `commandId`       | Public article + Lifecycle version + changed fields         |
| `archive_before`     | maintenance policy；候选仍为 `published`      | 固定 threshold + batch `commandId`；每个候选锁内 compare-and-transition | batch result + archived count                               |
| `trash`              | Gate `:delete`；允许删除                      | expected Lifecycle version + `commandId`                                | Trash action key + Lifecycle version                        |
| `restore`            | Gate `:restore`；Trash membership 存在        | expected Lifecycle version + `commandId`                                | restored state/version + canonical article                  |
| `permanently_delete` | retention/operations policy；仍为 `deleted`   | expected Lifecycle version + `commandId`                                | 通用 terminal receipt；资源不存在时只允许同 identity replay |

`ArticleLifecycle.transition/2` 当前允许多种 self-transition，并且每次都会增加 version。理想情况下，重复 command 应由 command receipt 处理；普通 self-transition 要么返回明确的 unchanged result，要么拒绝，不能靠“再写一次相同状态”模拟幂等。

#### `archive_before` 的 batch command 合同

`archive_before` 不是把 N 个独立 UI command 粗暴塞进同一个 receipt，而是一个有稳定输入的 maintenance command：

```text
enqueue archive job
  -> freeze threshold
  -> generate commandId once
  -> persist {jobId, commandId, thread, threshold}

execute/retry
  command: article.archive_before
  initiator: {type: job, key: stable jobId}
  target: {type: article_archive_scope, key: "<thread>:before:<threshold>"}
  fingerprint: command + thread + threshold + source
```

重试必须复用同一个 job id、`commandId` 和 threshold，不能用“当前时间减 N 天”重新计算 threshold，
否则同一 command 会悄悄扩大候选集。receipt 保存最小结果，例如
`{outcome: changed, resultPayload: {archivedCount: 37, threshold: ...}}`。

当前可控规模下，候选集在一个领域事务中全部成功或全部回滚，不定义“一个 receipt 对应部分成功”。如果未来必须
分 chunk，应新增持久化 `ArchiveBatch`/`ArchiveBatchItem` 领域事实：父 workflow 固定候选范围，每个 chunk
使用稳定派生的 child `commandId`，通用 receipt 只指向 batch/chunk result，不把 N 个 article id 塞进
`result_payload`。这也解释了为什么 `target_type/target_key` 表示 batch scope，而不是单篇 Article。

### 1.4 Doc branch

Doc 的正确聚合边界不是单篇 Doc，而是：

```text
Community + DocBranch
  ├─ DocsSiteState.tree_lock_version
  ├─ staged tree events
  ├─ branch-scoped DocLifecycle
  ├─ Doc Draft versions
  └─ DocPublishRelease
```

当前 tree mutation 已经要求 `baseRevision`，但 publish release 没有携带用户读取 checklist 时的 revision，也没有稳定的客户端 command identity。

实现位置：[Doc Publish](../../../backend/api/lib/groupher_server/cms/doc_tree/publish.ex)、[Doc Lifecycle](../../../backend/api/lib/groupher_server/cms/docs/lifecycle.ex)、[Docs publish UI](../../../frontend/core/unit/DsbThread/CMS/Docs/ActionSnackbar/Publish/usePublishActions.ts)、[SideTree persistence](../../../frontend/core/unit/DsbThread/CMS/Docs/Editor/SideTree/usePersistence.ts)。

#### 切换前基线 action matrix

| Action                                | 当前聚合变化                                           | Gate                       | Version                                       | Duplicate                                                          |
| ------------------------------------- | ------------------------------------------------------ | -------------------------- | --------------------------------------------- | ------------------------------------------------------------------ |
| `update_doc_draft`                    | Draft version `n -> n+1`                               | editor/Gate                | GraphQL 要求 `expectedVersion`                | 无 command replay                                                  |
| `create/update/move/delete tree node` | draft tree + staged event + tree revision              | command actor/Gate         | `baseRevision`                                | 无 command identity；失败 reload                                   |
| `restore tree trash item`             | 恢复 placement + tree revision                         | command actor/Gate         | `baseRevision`                                | scheduler delete 有 stale replay 测试；普通 restore 无统一 receipt |
| `move_doc_to_draft`                   | 为 public Doc 建立 Draft                               | `:manage_docs` path        | GraphQL 不传 site/doc expected version        | 第二次行为依赖当前 Draft，未形成 replay contract                   |
| `move_subtree_to_draft`               | 为子树 public pages 建立 Draft                         | `:manage_docs` path        | 无 checklist/site expected version            | 无 command identity                                                |
| `publish_doc_changes`                 | selected docs/tree events -> release/public projection | 事务内 `Gate :manage_docs` | branch 全局锁；无 expected checklist revision | 并发时一个 release、另一个 noop，不是同结果 replay                 |
| `restore_selected_changes`            | 撤销 selected staged delete events                     | `Gate :manage_docs`        | branch 全局锁；无 expected checklist revision | 无 command identity                                                |

#### 实际场景：Doc autosave 必须沿用 confirmed version

后端 `updateDocDraft` GraphQL schema 要求 `expectedVersion`；当前
[browser publisher client](../../../frontend/core/lib/artimentPublisher.ts) 的输入类型和请求 payload 会携带该版本，
[autosave hook](../../../frontend/core/unit/DsbThread/CMS/Docs/Editor/Article/hooks/useDraftAutoSave.ts)
从已确认 Draft 版本传入并在成功后更新本地 confirmed state。

下游 `/api/artiment/publish` 必须原样转发该版本；如果改成在服务端临时读取最新 version 再提交，则两个编辑页签都可以
覆盖最新 Draft，实际上又绕过了用户所见版本的冲突保护。

合理形态是编辑器保存 confirmed Draft version，并在 autosave 发起时一起传递。发生 `draft_conflict` 时保留本地 working copy，
加载服务端 baseline 后展示差异，不能读取最新 version 后静默重试覆盖。

#### 实际场景：Publish All 发布了面板里没出现的改动

用户 A 打开 Publish 面板，checklist 中只有页面 X。协作者 B 随后新增页面 Y。A 没有刷新面板，点击 Publish All：

```text
当前客户端：input = undefined
当前服务端：重新读取 current_checklist
            -> nil selection 表示发布当前默认选择的全部项目
```

结果可能是 X 和 Y 一起发布。branch 全局锁只能确保 publish 串行，不能证明 A 确认过 Y。

合理形态：checklist payload 返回稳定的 `checklistRevision`，publish 必须回传：

```text
publishDocChanges(
  branchKey,
  expectedChecklistRevision,
  selectedItemIds,
  commandId
)
```

即便是 Publish All，也应展开为“用户看到的 revision 下的全部 item IDs”，而不是让 `nil` 在执行时重新解释成最新全部内容。revision 已变化时返回 conflict 并展示新增/变化项。

#### 实际场景：并发发布只是串行，不是幂等

当前并发测试证明两个 `publish_changes` 会得到“一次 release + 一次 noop”。它证明不会产生两个 release，但没有证明两个请求是同一个 logical operation：

- 两个不同用户同时发布，应当是两个竞争 command，后者应看到 checklist conflict/empty；
- 同一用户因网络重试重复发送同一 command，应 replay 第一次的 release；
- 现在两种情况都表现为后执行者拿到 noop，语义无法区分。

合理形态是 `commandId` 区分 replay，`expectedChecklistRevision` 区分竞争。

#### Doc branch 理想 transition contract

| Action                                 | Concurrency/identity                                                | Queue scope           | Confirmed result                                        |
| -------------------------------------- | ------------------------------------------------------------------- | --------------------- | ------------------------------------------------------- |
| `update_doc_draft`                     | expected Draft version + `commandId`                                | one branch/doc        | Draft version + publish state                           |
| tree create/update/move/delete/restore | expected tree revision + `commandId`                                | entire branch tree    | canonical node/tree + new revision                      |
| `move_doc_to_draft`                    | expected DocLifecycle + expected Draft/Public version + `commandId` | one branch/doc        | Draft + lifecycle version                               |
| `move_subtree_to_draft`                | expected tree/checklist revision + `commandId`                      | entire branch tree    | affected doc keys + new revision                        |
| `publish_doc_changes`                  | expected checklist revision + exact selection + `commandId`         | entire branch release | 通用 receipt 指向同一 release + next checklist revision |
| `restore_selected_changes`             | expected checklist revision + exact selection + `commandId`         | entire branch release | restored items + next checklist revision                |

`DocLifecycle.transition/2` 与 ArticleLifecycle 一样只有 row lock 和 allowed transition，没有 expected version/command receipt；理想实现应让 release orchestration 传入并验证 branch-scoped lifecycle version，而不是把锁当成完整并发合同。

## 2. 测试覆盖审计

本节保留的是切换前测试审计，用来说明为什么需要统一合同；本次落地后的可验证入口和测试命令见第 4 节。不要把表中的旧 `❌` 当作新协议已经回退。

标记含义：

- ✅：当前已有直接覆盖该 action 的测试；
- ◐：底层能力或邻近测试存在，但没有覆盖公开 command 的完整路径；
- ❌：未找到对应测试或当前协议本身不支持。

### 2.1 Community

| Action             | Version conflict | Permission failure | Duplicate request | 当前缺口                                                                                         |
| ------------------ | ---------------: | -----------------: | ----------------: | ------------------------------------------------------------------------------------------------ |
| `request_destroy`  |                ◐ |                  ◐ |                 ◐ | 底层支持 version，但 GraphQL 不传；Gate policy 有 denial 测试；blocker 去重不等于 command replay |
| `restore`          |               ✅ |                  ◐ |                ❌ | 有 stale `expected_version`；只有 Gate policy 测试；第二次 restore 返回 not found                |
| `schedule_destroy` |                ◐ |                  ◐ |                ❌ | expected version 代码存在但无直接 stale 测试；无 replay                                          |
| `cancel_destroy`   |                ◐ |                  ◐ |                ❌ | 同上                                                                                             |
| `destroy`          |                ◐ |                 ✅ |                ❌ | Gate policy 覆盖 other user；没有 stale/同 identity replay                                       |

一个明确的测试问题是：[Community GraphQL mutation tests](../../../backend/api/test/groupher_server_web/mutation/cms/crud_test.exs) 中名为“unauth user delete community fails”的测试实际调用 `@create_community_query`，并没有调用 `@request_destroy_community_query`。因此公开删除入口的 login、Passport 和 Gate 失败并未被该测试证明。

理想情况下，每个 action 至少固定下面四条：

```text
authorized + current version -> success
unauthorized + current version -> permission_denied, no facts and no receipt written
authorized + stale version -> conflict, no facts and no receipt written
same commandId replay -> same confirmed result, exactly one Audit fact and zero repeated effects
```

再为 destroy 类 action 增加 blocker/retention 测试。`restore` 的 stale case 必须明确传入旧的
`CommunityLifecycle.version`，而不是 blocker version。

### 2.2 Article

| Action               | Version conflict | Permission failure | Duplicate request | 当前缺口                                                                                                  |
| -------------------- | ---------------: | -----------------: | ----------------: | --------------------------------------------------------------------------------------------------------- |
| `create_draft`       |              N/A |                 ✅ |                ❌ | 没有 create command identity                                                                              |
| `update_draft`       |               ✅ |                 ✅ |                ❌ | Draft version guard 已有；同 `commandId` replay 未定义                                                    |
| `publish_draft`      |               ❌ |                 ✅ |                ❌ | schema 没有 expected versions/客户端 command identity；响应丢失后无法 replay                              |
| `archive_before`     |               ❌ |                N/A |                 ◐ | 有归档和归档后禁止编辑/删除测试；缺固定 batch identity、并发 retry 和原子 rollback 测试                   |
| `trash`              |               ❌ |                  ◐ |                 ◐ | resource-state 去重存在；缺 stale version 和同 identity replay；existing membership fast path 不重新 Gate |
| `restore`            |               ❌ |                  ◐ |                ❌ | 有业务恢复测试；缺 stale、denial、replay 三件套                                                           |
| `permanently_delete` |               ❌ |                  ◐ |                 ◐ | missing item 返回 done，但不是可验证的同 command replay                                                   |

Article 测试不能只证明最终列表里看不到文章。必须断言冲突、拒绝和 replay 情况下：

- Draft/Public 内容没有意外变化；
- Lifecycle version 没有多增；
- Trash membership 没有重复；
- Activity/Audit 对同一 command 只写一次；
- community counters 和 search enqueue 不重复执行。

所有 action 还必须共用 receipt 合同测试：并发相同 identity 只提交一次领域写入，后一个响应
相同 key 重试返回相同业务结果且不重复写入；同 key 不同 fingerprint 返回 command identity conflict；Gate denial、validation 和
version conflict 不留下 receipt；replay 不再次执行 counter、Audit/outbox、notification、search 或其他 effect；
清理器只删除超过 24 小时窗口的 completed receipt。

### 2.3 Doc branch

| Action                         | Version conflict | Permission failure | Duplicate request | 当前缺口                                                                          |
| ------------------------------ | ---------------: | -----------------: | ----------------: | --------------------------------------------------------------------------------- |
| `update_doc_draft`             |               ✅ |                  ◐ |                ❌ | 后端 GraphQL 有 expectedVersion，但当前 browser publisher payload 不传；无 replay |
| tree create/update/move/delete |               ✅ |                  ◐ |                ❌ | stale `base_revision` 已测；缺逐 action denial/replay matrix                      |
| restore tree item              |               ✅ |                  ◐ |                 ◐ | baseRevision 路径存在；scheduler stale retry 已测，但用户 restore 无统一 receipt  |
| `move_doc_to_draft`            |               ❌ |                  ◐ |                ❌ | 无 expected version/command identity                                              |
| `move_subtree_to_draft`        |               ❌ |                  ◐ |                ❌ | 无 expected checklist revision/command identity                                   |
| `publish_doc_changes`          |                ◐ |                  ◐ |                 ◐ | 并发串行已测，但无 stale checklist、权限失败、同 command replay                   |
| `restore_selected_changes`     |               ❌ |                  ◐ |                ❌ | 有非法 restore selection 测试，不等于 version/permission/replay 覆盖              |

Docs 发布至少需要区分三组并发测试：

1. 同一 `commandId` 重试：两次返回同一个 release；
2. 不同 `commandId`、相同 expected revision：一个成功，另一个 conflict；
3. 发布面板打开后 checklist 变化：旧 revision 不允许 Publish All 吸收新 item。

## 3. 客户端 optimistic 映射

Lifecycle command 不应该默认 optimistic 修改权威状态。客户端仍然需要 command identity 和 queue，只是不同 action 的 speculative 范围不同。

### 3.1 统一规则

```text
commandId = 一次用户意图的 UUID；网络重试继续使用同一个值
entityKey  = 客户端观察和 reconcile 的 canonical entity，不进入后端通用协议
queueKey   = 服务端共享同一个 version/lock 的最小冲突域
optimistic = 客户端能够确定撤销的最小 UI patch
reconcile  = 用 server confirmed result 覆盖本地推测，并刷新受影响 projection
```

同一个 queue lane 内的后续 action 必须基于前一个 confirmed version 继续，不能都携带页面首次加载时的旧 version。

### 3.2 Community 映射

| Action                                  | entityKey          | queueKey                     | Optimistic                                               | Reconcile                                                                                           |
| --------------------------------------- | ------------------ | ---------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| request/restore/schedule/cancel/destroy | `community:{slug}` | `community:{slug}:lifecycle` | 只显示 pending、禁用冲突按钮；不提前隐藏社区或伪造 state | 使用 confirmed Lifecycle state/version 替换 Dashboard 数据，invalidate public/management visibility |

这些 action 会改变整个站点是否可读、是否可写，且受 blocker、权限和保留期影响。客户端无法可靠复现 Lifecycle resolve，因此只应乐观更新按钮状态，不能乐观更新业务状态。

### 3.3 Article 映射

| Action                             | entityKey                                                     | queueKey                                                 | Optimistic                                                         | Reconcile                                                                                   |
| ---------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `create_draft`                     | `pending:${commandId}`，成功后替换为 canonical Article entity | `article-create:{community}:{thread}:{composerInstance}` | 插入 pending item 或显示 creating；不能假造 canonical `articleKey` | 用响应的 canonical `articleKey` 替换 pending identity，并写入 Draft/Lifecycle versions      |
| `update_draft`                     | `article:{community}:{thread}:{articleKey}`                   | `...:draft`                                              | 编辑器 working copy 保留；显示 saving，不覆盖 confirmed Draft      | 用响应更新 Draft version；conflict 时保留本地 working copy并加载 server baseline 做 diff    |
| `publish_draft`                    | 同上                                                          | `...:lifecycle`                                          | 只显示 publishing；不能提前删除 Draft 或替换 Public                | 使用 confirmed Public、Draft absence、Lifecycle version；刷新详情、列表、作者页和 checklist |
| `trash/restore/permanently_delete` | 同上                                                          | `...:lifecycle`                                          | 列表可临时 disable/fade；不永久移除 confirmed entity               | 用 Trash action/confirmed lifecycle 收敛，刷新列表、Trash、counter 和搜索相关 projection    |
| `archive_before`                   | N/A：后台 maintenance batch                                   | N/A：由 server job 串行/分 chunk                         | N/A：没有客户端 optimistic 状态                                    | job 根据 batch result/Audit 验证 archived count；管理页下次查询读取权威状态                 |

这里的 `composerInstance` 是一次 composer 页面实例的稳定 id：同一页面内的 transport retry 保持不变；
重新打开一个 composer 页面时生成新 id，避免两个并行的新建表单进入同一 create queue lane。

Draft lane 与 Lifecycle lane 是否可以并行取决于服务端合同。publish 会消费 Draft，因此 publish 前必须等待该 Article 的 draft lane 清空，并携带最后一次 confirmed Draft version。

### 3.4 Doc branch 映射

| Action                                 | entityKey                                 | queueKey                                                        | Optimistic                                                        | Reconcile                                                                              |
| -------------------------------------- | ----------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Doc autosave                           | `doc:{community}:{branch}:{docId}`        | 同 entity 的 `:draft` lane                                      | 保留 working copy 和 saving 状态                                  | 更新 confirmed Draft/version；冲突时保留本地内容用于 diff                              |
| tree create/rename/move/delete/restore | `doc-tree:{community}:{branch}` + node id | `doc-tree:{community}:{branch}`                                 | 可创建 local node、临时改名/排序；每个 command 保存 inverse patch | 响应返回 canonical tree/node + revision；失败仅撤销本 command，无法安全撤销时再 reload |
| move doc/subtree to Draft              | branch/doc or subtree key                 | `doc-tree:{community}:{branch}`                                 | 只显示 pending                                                    | 收敛 Draft、publishState、tree revision、checklist                                     |
| publish/restore selected changes       | `doc-release:{community}:{branch}`        | `doc-release:{community}:{branch}`；执行前等待 tree/draft lanes | 只显示 publishing；不提前改 `publishState`                        | 用 confirmed release、published doc ids、tree revision 和 next checklist 整体收敛      |

当前 SideTree 已经有 local node id、`localCreateStateRef`（当前代码名）和 `baseRevision`，但失败主要通过 reload 整棵树恢复。这在“创建后立刻删除”场景做了特殊处理，却没有形成通用 command identity：rename、move、delete 各自维护本地状态，很难判断一次失败应该撤销哪一块。

合理形态不是把所有 tree 操作塞进通用状态机，而是让每次 SideTree mutation 产生一个小的 command record：

```text
{
  commandId,
  queueKey: doc-tree:{community}:{branch},
  baseRevision,
  affectedNodeIds,
  inversePatch
}
```

执行成功后以 server payload 的 tree revision 和 canonical node reconcile；version conflict 时停止 lane、保留尚未执行的用户意图、reload authority，再明确决定哪些操作可以重新基于新 revision 执行。不能静默把旧 mutation 自动套到新树上。

客户端的 Toggle `read` 阶段只需要 `queryClient` 和 `accountRef`，不应伪造空的 `commandId`；executor
在进入 `queriesToCancel`、`apply` 和 `execute` 之前生成真实 key。这样“读取当前状态”和“开始一次可重放
command”在类型上就是两个明确阶段。

## 4. 本次直接切换的实际落点

前面三节的“当前缺口”表是切换前的基线；本次实现已经把通用 receipt 和 `commandId` 接到下面这些真实写入口。这里列文件和入口，是为了让后续 review 能从代码直接核对合同，而不是把设计表误读成仍未开始实现。

### 4.1 后端共享边界

```text
GraphQL resolver / CMS facade
  -> authenticated domain command
       -> %CMS.Command{actor, command_id, operation, target, params}
       -> CMS.Command.execute/2 with required action/result callbacks
       -> internal Receipt.Key: validate commandId
       -> internal Receipt.Runner: transaction + execute/recovery orchestration
            -> internal Receipt.Store: claim/finalize/prune persistence
            -> domain Gate + lifecycle/version transaction
            -> record result/outcome
            -> commit
            -> recovery: read result, skip write/effects
```

- `backend/api/lib/groupher_server/cms/command.ex` 是同步 CMS 用户命令的唯一公开边界；Receipt、Key、Runner、Store 都是其内部实现，不进入 GraphQL 或领域 facade 合同。
- `action` 与 `result` 必须在同一个 `Command.execute/2` 调用中显式成对出现；不保留
  `update_user/create_user` 构造器、公开 `resolve_command_id` 或 callback fallback。
- 目标键允许整数或领域组合字符串；`Store` 的 fingerprint 绑定 command、target、input 和 expected version/revision。
- `backend/api/lib/groupher_server/cms/model/command_receipt.ex` 与 `20260909120000_create_command_receipts.exs` 提供 `cms.command_receipts`、目标索引、唯一身份约束和 24 小时 `expires_at`。
- `backend/api/lib/groupher_server/jobs/command_receipt_retention.ex` 按批次清理过期行。旧 `interaction_operation_receipts` 不迁移、不双写；`operation_ref` 仍只属于领域 Audit/Activity/transition fact。

### 4.2 Community

当前公开写入口是 `request_destroy_community`：resolver 先通过 Community Gate，再在同一 receipt transaction 内调用 Lifecycle blocker；重试复用同一 `commandId` 时只读取 Community，不重新创建 blocker、Audit 或通知。Lifecycle 内部仍生成独立的 `operation_ref`，它不是客户端幂等键。

代码落点：

- `backend/api/lib/groupher_server_web/resolvers/cms_resolver.ex`：`request_destroy_community/3`；
- `backend/api/lib/groupher_server_web/schema/cms/mutations/community.ex`：`commandId` 入参；
- `backend/api/lib/groupher_server/cms/model/community.ex`、`cms_types.ex`：`commandId` 出参；服务端不暴露 replay 状态。

`restore`、`schedule_destroy`、`cancel_destroy`、`destroy` 仍是 operations/job 侧 Lifecycle command，当前尚未接入
用户 Command API。它们不能伪造 actor Gate；未来接入时应设计独立的 job/system 入口，initiator 由 job 记录并在 retry
时复用内部 Receipt 的 claim/finalize 管线。

### 4.3 Article

`backend/api/lib/groupher_server/cms/articles.ex` 已把以下入口统一包在 receipt 边界：

```text
create              -> article.create
create_draft        -> article.create_draft
update              -> article.update
update_draft        -> article.update_draft
publish_draft       -> article.publish_draft
trash               -> article.trash
restore_trashed     -> article.restore
permanently_delete  -> article.permanently_delete
```

`publish_post_draft`、`publish_blog_draft`、`publish_changelog_draft` 的公开 schema 现在要求 non-null
`expectedVersion` 与 `expectedLifecycleVersion`；resolver 原样转发这两个版本，`publish.ex` 在 Draft
读取和 Lifecycle 行锁内分别校验，不能再用最新 Draft version 静默兜底。底层 service 的 create/operations
路径仍允许内部调用方省略这些参数，但那不是公开客户端合同，不能被误读为具备冲突保护。

`publish.ex` 在 Gate/锁内校验 expected Draft 与 Lifecycle version；Trash restore/permanent delete 使用稳定的
`{community}:{thread}:{trashHashId}` target（`target_type = article_trash`）。这里有一个不能省略的真实场景：restore
成功后会删除 Trash membership，若响应丢失，第二次请求已经查不到该 item；resolver 会用同一个
`commandId` 直接进入 receipt replay，并通过 receipt 中保存的 Article result key 读取恢复后的文章。
Permanent delete 同理返回 terminal `done`，不要求已删除的数据库行重新存在。Article schema、Trash schema
和 `done_state` 都能返回 `commandId`；transport 响应丢失后的重试只保证返回相同业务结果，不暴露 replay 语义。

GraphQL 入口在 `mutations/post.ex`、`blog.ex`、`changelog.ex`、`operation.ex`；前端发布器和 Trash hook 在 `frontend/core/lib/artimentPublisher.ts`、`DsbThread/CMS/Trash/useTrashedPosts.ts` 复用同一个 `commandId`。

### 4.4 Doc branch

`CMS.DocTree`/`CMS.Docs` 的同步 command 已覆盖：

```text
update_doc_draft
checkpoint_snapshot
restore_snapshot
publish_doc_changes
move_doc_to_draft
move_subtree_to_draft
tree create/update/delete/duplicate/move/restore
```

其中：

- tree mutation 的 `baseRevision` 与 `commandId` 一起进入 fingerprint；首次成功会把版本化的
  `node/affected_nodes/tree_state` result envelope 写入内部 receipt，重试不再次写 event；必要时仍可由 Reader/Scope
  重读当前资源；
- `publish_doc_changes` 的后端 receipt 已覆盖 command identity，并在 receipt transaction 内校验公开 checklist
  revision；selection 仍按用户明确提交的 opaque ids 固定，nil selection 只表示当前 checklist 的默认选择；
- `update_doc_draft` 后端 schema 与 `useDraftAutoSave`、`artimentPublisher.ts` 已经接通 `expectedVersion`；下游
  handler 必须继续原样转发，不能读取最新版本后静默覆盖；
- `DocSnapshot`、`DocDraft`、tree mutation payload、publish payload 和 `done_state` 只暴露业务结果及必要的 `commandId`；
  不暴露 executed/replayed 等 Receipt 状态。

后端入口是 `backend/api/lib/groupher_server/cms/doc_tree.ex`、`docs.ex`、`doc_tree/publish.ex` 以及 `resolvers/cms_resolver.ex`；前端的 commandId、checklist revision、SideTree queue/reconcile 对接在 `DsbThread/schema/docs.ts`、`CMS/Docs/ActionSnackbar/Publish/usePublishActions.ts`、`CMS/Docs/Editor/SideTree/usePersistence.ts`。

### 4.5 验收证据

本次切换至少保留以下可重复验证的检查（命令均从仓库根目录执行，后端命令自行进入 `backend/api`）：

```text
cd backend/api && mix compile --warnings-as-errors
cd backend/api && mix test \
  test/groupher_server/cms/command_receipt_test.exs \
  test/groupher_server/cms/doc_tree/publish/release_test.exs \
  test/groupher_server/cms/doc_tree/publish/concurrency_test.exs \
  test/groupher_server/cms/doc_tree/revision_test.exs \
  test/groupher_server_web/mutation/cms/upvotes/post_upvote_test.exs \
  test/groupher_server_web/mutation/cms/comments/post_comment_test.exs
cd backend/api && mix test test/groupher_server_web/mutation/cms/trash_test.exs

pnpm run graphql:codegen
pnpm --filter @groupher/frontend-core run type-check
pnpm exec vitest --config frontend/core/vitest.config.mts run \
  frontend/core/schemas/feature.schema.test.ts \
  frontend/core/schemas/pages/pages.schema.test.ts \
  frontend/core/unit/DsbThread/dashboard-mutations.schema.test.ts
pnpm exec vitest --config frontend/core/vitest.config.mts run \
  frontend/core/query/mutation/optimistic/execute.test.ts \
  frontend/core/lib/artimentPublisher.test.ts \
  frontend/core/unit/DsbThread/CMS/Trash/useTrashedPosts.test.tsx \
  frontend/core/unit/DsbThread/CMS/Docs/Editor/SideTree/useLogic.test.ts \
  frontend/core/unit/DsbThread/CMS/Docs/Editor/Article/hooks/useDraftAutoSave.test.ts
git diff --check
```

上述第一条后端聚焦命令当前为 63 tests；Trash replay 单独为 4 tests；最后一条前端聚焦命令当前为
17 tests。schema 三个测试必须在删除重复 `command_id`、重新生成 `schema.graphql` 与 frontend GraphQL
types 后重新执行，不能沿用旧通过数字。

这不意味着每个领域都复制一套 receipt 测试。共享 receipt 测试固定身份冲突、字符串 target、rollback、replay 和 retention；各领域测试只负责自己的 Gate、version、Lifecycle、Trash、Release 和 post-commit effect 不变量。
