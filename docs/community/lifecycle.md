# Community Lifecycle

本文与 [CMS Gate](./gate.md) 配套阅读。Lifecycle 是 Community 状态权威；Gate 负责消费 Lifecycle 能力并与其他准入条件共同决定一次 CMS 操作能否继续。

本文定义 Community 从创建、公开、受限、归档、回收到销毁的统一生命周期，以及它与
Application、未来重写的 Billing、Moderation、Trash 和 Audit 的边界。旧 payment/Billing
存储已于 2026-04 通过不可逆 migration 移除，当前不存在 Billing 存储或 Billing Blocker。

目标不是把所有业务状态塞进一个枚举，而是让所有产品入口对“这个 Community 当前允许做
什么”得到同一个答案。

## V1 边界

本轮只验证四个核心概念：Lifecycle 状态、Lifecycle Blocker、状态能力，以及 Gate 对
actor/资源关系和状态能力的组合。Slug 占用与释放、Application 的名称预约、tombstone、
物理清理、Press/Search 副作用和定时调度都不是 V1 的核心机制，统一留到 V2；Lifecycle
V1 不依赖这些模型，也不从这些模型推断当前状态。
若现有 Apply 流程已经使用 `CommunitySlugClaim` 做名称预约，它仍属于 Application 内部实现；
本轮不扩展它，也不让 Lifecycle 或 Gate 调用它。
Application Event 如因 Apply 流程需要继续保留，也只记录 Application 自身的历史，不是
Community 状态，不参与 Gate 判断，也不参与 Lifecycle 状态同步。

## 背景

Community 当前同时存在几套不完整的状态表达：

- `communities.pending` 用整数区分旧的 `normal/applying`，但多数查询没有消费它。
- `community_lifecycles` 由 Apply V1 引入，目前只覆盖 `setting_up/active/setup_failed`。
- `Communities.Visibility.public_query/1` 已经统一服务 FrontDesk、List 和 Search；Press 的
  Phoenix 实现仍先直接读取 `communities`，再后置执行相同可见性判断。
- Article 的旧 `mark_delete` 已迁移到 Trash Aggregate；Community 本身没有可靠的软删除模型。
- `CMS.Audit` 是通用责任日志，但不是可变业务状态。
- `AbuseReport` 当前只覆盖 Article 和 Comment，没有 Community 级举报与审核 Case。

这会造成最直接的问题：即使 Community 仍处于 `setting_up`，只要用户猜到 slug，就可能绕过
列表入口直接读取；未来再增加违规暂停、用户删除和 Trial 到期后，这种分散判断会继续扩大。

## 当前遇到的问题

### 1. 公开可见性入口尚未完成收敛

FrontDesk、Community List 和 Search 已共享 `Communities.Visibility.public_query/1`，因此
当前问题不是“完全没有统一入口”，而是现有统一 policy 的归属、命名和覆盖范围仍不完整：

- Main 的 Community slug 页面、列表和搜索已经消费统一 policy；
- Phoenix `CMS.Press` 仍直接按 slug 读取 Community，再通过 `Visibility.public?/1` 后置判断；
- Press TS 不直接访问 `communities`，只通过 Phoenix GraphQL 获取 Article、Feed、Sitemap 和
  Manifest；
- 自定义域名只在 Gateway 将 host 映射为 Community slug，最终仍由 Press GraphQL 读取数据；
- Widget 和其他公开 API 仍需逐一确认是否从默认公开 scope 进入。

Phase 1 的目标是把已有 `Visibility` policy 搬迁到 `CMS.Communities.Read.scope/1`，并让遗漏
入口消费它，而不是从头创建一套公开 policy。只过滤列表没有意义，单条 slug、Article、Doc、
Comment 或 GraphQL node 查询同样不能绕过所属 Community 的 Lifecycle。反过来，也不能把
过滤硬塞进通用 ORM，因为 Dashboard、Reviewer、Setup Job 和运维工具必须读取非公开状态。

### 2. `pending` 与 Lifecycle 双重表达

Creation 写入 `pending = applying`，Setup 完成后再写回 `normal`，同时又更新 Lifecycle。这让
两个字段都像状态权威，但查询并没有一致消费它们。长期保留双写会产生状态漂移。

### 3. 软删除没有 Community 领域模型

Community 不应重新增加 `mark_delete: boolean`。布尔值无法表达删除人、删除原因、恢复期限、
名称回收时间、后台清理进度和最终销毁结果。

Community 的软删除应表现为 Lifecycle 转换，并保留恢复窗口：

```text
active -> archived -> scheduled_reclaim -> destroy
```

### 4. 举报、审核决定与公开状态混在一起

“被举报”只是事实线索，不代表违规成立。不能因为存在举报记录或举报数量达到某个值，就在
公开查询中直接隐藏 Community。

正确链路是：

```text
举报
  -> Moderation Case
  -> 审核决定
  -> 必要时触发 Lifecycle transition
```

严重安全事件可以先执行临时暂停，但也必须产生明确的审核操作和恢复路径。

### 5. Audit 容易被误用为状态表

`CMS.Audit` 的职责是回答“谁在什么时候因为什么执行了什么操作”。公开查询不能扫描 Audit
推断 Community 当前是否可见，恢复流程也不能依赖 Audit 重建当前状态。

Lifecycle 保存当前有效状态；Audit 只保存不可变的责任记录。

### 6. Billing、Moderation 与删除状态可能同时存在

一个 Community 可能同时处于 Trial、正在被举报审核、并由 Owner 发起归档。如果把
`trialing/under_review/owner_deleted` 全塞进同一个枚举，会迅速出现组合状态爆炸。

Billing 和 Moderation 应保留各自的业务状态，Lifecycle 只保存最终生效的产品可用状态。
单值 `source_type/source_ref` 无法表达多来源共存：如果 Billing 和 Moderation 同时暂停一个
Community，缴费恢复只能解除 Billing 自己施加的限制，不能直接把 Community 置回 `active`。

Lifecycle 因此需要保存当前仍生效的 Blocker。每个来源只能创建和释放自己的 Blocker；任何
恢复操作都必须在锁内释放指定 Blocker，然后根据全部剩余 Blocker 重新计算最终状态。

## 领域边界

```text
Community Application
  负责申请、审核和创建前历史
                |
                v
Community Lifecycle <---- 未来 Billing entitlement
  当前有效可用状态 <----- Moderation decision
       ^                  Owner / Ops action
       |
       +---- Setup result
       |
       +---- Lifecycle Blockers（当前仍生效的限制）
                |
                +----> CMS.Audit（只记录，不反向驱动状态）
```

各模块职责：

| 模块                        | 负责                                           | 不负责                             |
| --------------------------- | ---------------------------------------------- | ---------------------------------- |
| `CMS.CommunityApplications` | 创建前申请、审核、创建任务                     | Community 创建后的长期可用性       |
| `CMS.Communities.Lifecycle` | 当前有效状态、Blocker、转换、访问能力          | Payment Provider payload、举报证据 |
| 未来重写的 `Billing`        | Subscription、Trial、PaymentEvent、entitlement | 直接隐藏或删除 CMS 数据            |
| `Moderation`                | 举报、Case、证据、审核决定、申诉               | 在公开查询中临时拼过滤条件         |
| `CMS.Audit`                 | 责任追踪和操作快照                             | 当前状态、恢复状态、访问授权       |
| Community 回收 Job（V2）    | 按 Lifecycle 执行后续清理                      | 自行决定是否应销毁 Community       |

## Lifecycle 当前状态模型

Lifecycle 的 `state` 表达最终生效的可用状态：

| 状态                | Public read | Member write |    Owner manage | 含义                                 |
| ------------------- | ----------: | -----------: | --------------: | ------------------------------------ |
| `setting_up`        |          否 |           否 | 仅 Apply 状态页 | 正在初始化                           |
| `setup_failed`      |          否 |           否 |    仅状态与重试 | 初始化失败                           |
| `active`            |          是 |           是 |              是 | 正常可用                             |
| `read_only`         |          是 |           否 |            有限 | Grace、欠费或受控只读                |
| `suspended`         |          否 |           否 |            有限 | 违规、安全或运营暂停，可申诉/导出    |
| `archived`          |          否 |           否 |            有限 | Owner 删除或运营归档，可在期限内恢复 |
| `scheduled_reclaim` |          否 |           否 |            有限 | 已进入回收流程                       |
| `destroy`           |          否 |           否 |              否 | 不可恢复终态，保留当前数据与 Audit   |

`destroy` 是终态名称，不使用 `purged`。

未来 Billing 的 `trialing/grace/past_due` 属于 Billing 状态，不直接扩充 Lifecycle 枚举。新
Billing 计算 entitlement 后，通过 Blocker 让 Lifecycle 重算为 `active/read_only/suspended`。

Moderation 的 `reported/under_review/decided/appealed` 同理属于 Moderation Case；只有正式
决定或预防性暂停才转换 Lifecycle。

`read_only` 始终表示“仍可公开读取，但禁止 Member 写入”。如果 Moderation 或 Ops 的决定要求
隐藏 Community，最终状态必须是 `suspended`，不能根据 Blocker 来源让同一个 `read_only`
有时公开、有时隐藏。

## Lifecycle 数据

`community_lifecycles` 只保存当前最终状态和转换所需字段：

```text
community_id
state
version
changed_at
archived_at
scheduled_reclaim_at
destroyed_at
last_error
```

`version` 用于乐观锁。`scheduled_reclaim_at` 表示 Community 已正式进入回收流程的时间，不是
归档恢复截止时间。

当前仍生效的限制保存在 `community_lifecycle_blockers`：

```text
community_id
blocker_type
cause_code
cause_ref
recover_until
applied_at
ended_at
end_type
created_by_operation_ref
ended_by_operation_ref
version
```

`state`、`blocker_type` 和 `end_type` 必须通过现有 `CMS.Const` 机制集中定义，并分别用于
Ecto Enum、changeset、GraphQL Enum、Lifecycle 状态计算和 Job 参数校验。业务代码不能散落
裸 atom/string。
每次增加枚举值，还必须通过新 migration 同步更新数据库 CHECK；历史 migration 保存创建时的
固定枚举快照，不动态依赖以后会变化的 Const。

### Blocker 来源引用

`cause_ref` 是可空的来源 Aggregate `public_ref`。它不指向 CMS Audit、Lifecycle transition、
Job 或数据库内部 id。每个 `blocker_type` 必须在对应实施阶段明确 `cause_ref` 指向的实体；来源
实体尚未实现时，不得写入虚构的 ref。

| `blocker_type`       | `cause_ref` 指向                         | 当前状态                         |
| -------------------- | ---------------------------------------- | -------------------------------- |
| `owner_archive`      | `nil`；Owner 与原因由 Audit 记录         | 待实现                           |
| `moderation_suspend` | `community_moderation_cases.public_ref`  | Community Moderation Case 未实现 |
| `moderation_archive` | `community_moderation_cases.public_ref`  | Community Moderation Case 未实现 |
| `ops_legal_hold`     | 待 Ops 领域确定                          | 不提前实现                       |
| `billing_read_only`  | 未来 Billing Entitlement 的 `public_ref` | 等 Billing 重写                  |
| `billing_suspend`    | 未来 Billing Entitlement 的 `public_ref` | 等 Billing 重写                  |

`recover_until` 属于一次 Archive Blocker，而不是整个 Lifecycle。它只对允许期限内恢复的
Archive Blocker 有值。多个 active Archive Blocker 并存时，整体回收必须等待所有有效恢复窗口
结束；有效截止时间取这些 Blocker `recover_until` 的最大值，而不是最小值。Moderation 自身的
申诉期限仍由 Moderation Case 管理，不能用 Owner 的恢复窗口替代。

当前 `AbuseReport` 只支持 Article/Comment，且 Case 是 embedded payload，不能作为 Community
Blocker 的来源。Community Moderation Case 必须先成为独立 Aggregate，之后才能创建
`moderation_suspend` Blocker。

同一次 Lifecycle 操作用统一 UUID `operation_ref` 关联 Lifecycle transition、Blocker 和 Audit。
operation_ref 必须在操作入口生成一次并沿链路复用；非 UUID 输入必须拒绝，不能在 Audit 写入时静默
替换成另一个 UUID。后续 Job 若在 V2 引入，再沿用这个值作为跨表幂等键。Blocker 上使用更明确的
`created_by_operation_ref/ended_by_operation_ref`：前者记录哪个操作创建它，后者记录哪个操作
结束它。一个来源只能按自己的 `blocker_type + cause_ref` 释放对应 Blocker。

Blocker 结束后继续保留。`end_type = released` 表示来源领域确认限制已经解除；
`end_type = terminated` 表示来源问题未必解决，但 Community 已 `destroy`，Blocker 不再有可
作用对象。当前生效集合只包含 `ended_at IS NULL`。数据库需要阻止同一
来源重复创建相同 active Blocker；Apply/Setup 当前通过 Application 状态机和
`expected_version` 防止同一操作重复推进。通用 `Lifecycle.transition/3` 的 operation_ref 幂等去重
不作为 V1 的独立保证，调用方必须提供正确的 version；通用去重策略留作后续设计。无论是否去重，
同一操作链路中的 transition、Blocker、Audit 和 Job 必须使用同一个 UUID。

`owner_archive` 的 `cause_ref` 可以为 `NULL`，普通 unique index 不能阻止多个 NULL。active
Blocker 的部分唯一索引必须使用 PostgreSQL 15 `NULLS NOT DISTINCT`，或使用等价表达式索引：

```text
UNIQUE (community_id, blocker_type, COALESCE(cause_ref, ''))
WHERE ended_at IS NULL
```

Migration 测试必须覆盖 Owner 重复归档不会产生第二个 active Blocker。

### Blocker 组合与状态投影

Blocker 不使用 `moderation > billing > ops > owner` 这类来源优先级。每个 Blocker 只收紧明确
能力，全部生效 Blocker 的效果取交集：

```text
默认能力
  read           = true
  member_write   = true
  owner_manage   = true
  reclaim        = true

billing_read_only
  member_write   = false

billing_suspend
  read           = false
  member_write   = false

moderation_suspend
  read           = false
  member_write   = false
  reclaim        = false

moderation_archive
  archived       = true
  read           = false
  member_write   = false
  reclaim        = false

owner_archive
  archived       = true
  read           = false
  member_write   = false

ops_legal_hold
  reclaim        = false
```

未来 `billing_read_only/billing_suspend` 默认只影响 Community 可用性，不把 `reclaim` 改为
`false`：Owner 仍可归档和回收自己的 Community，但 Community `destroy` 不得删除或抵消独立
Billing Aggregate 中的账单、欠款和支付责任。若退款争议、司法或合规保全确实要求阻止销毁，
必须创建单独的保全 Blocker，不能让所有 Billing Blocker 隐式阻止回收。该决策在 Phase 5
实现时必须保持并通过测试。

Owner 可以在 Moderation Blocker 生效期间归档 Community，但不能借此绕过审核流程销毁内容。
`schedule_reclaim` 和 `destroy` 都必须在 Lifecycle 行锁内重新检查 `can_reclaim`；任一
`moderation_suspend/moderation_archive/ops_legal_hold` 仍 active 时返回 `{:ok, false}`，拒绝
排期或销毁。不能只在自动 Job 中检查，因为显式命令同样可能绕过 Moderation。

Lifecycle state 分成显式工作流状态和 Blocker 计算状态：

```text
显式工作流状态
  setting_up
  setup_failed
  scheduled_reclaim
  destroy

Blocker 计算状态
  active
  read_only
  suspended
  archived
```

`setting_up/setup_failed` 由 Apply/Setup command 显式转换，`scheduled_reclaim/destroy` 由回收
command 显式转换；这四个状态不参与 Blocker 状态计算，也不会把当前 `state` 当成同一个
`state` 的输入。对其余状态，最终结果由集中规则确定：

```text
存在任一 archive Blocker            -> archived
read == false                       -> suspended
member_write == false               -> read_only
其他                                -> active
```

例如 Owner 归档和 Moderation 暂停同时存在时显示 `archived`，但 Moderation Blocker 不会消失；
Owner 恢复只释放 `owner_archive`，重算后仍会得到 `suspended`。`ops_legal_hold` 不需要改变显示
状态，只通过 `can_reclaim` 阻止回收继续推进。

例如 Billing 只读和 Moderation 暂停同时存在：

```text
billing_read_only + moderation_suspend
                  |
                  v
              suspended

缴费恢复：只释放 billing_read_only
                  |
                  v
              suspended   # moderation_suspend 仍存在

申诉成功：释放 moderation_suspend
                  |
                  v
                active
```

组合逻辑集中在 `CMS.Communities.Lifecycle.resolve_state/1`。它不是提供给 resolver 或普通
调用方的读取 facade，而是 transition facade 在持有 Lifecycle 行锁时调用的内部状态计算：

```text
Lifecycle.resolve_state(active_blockers)

active_blockers
  同一事务中完成创建、释放或终止后，ended_at IS NULL 的全部 Blocker。
```

上层调用顺序：

```text
Lifecycle transition facade
  -> lock_for_transition
  -> 校验 expected_version
  -> 应用显式工作流变更（可选）
  -> 创建、释放或终止 Blocker（可选）
  -> 如果 command 最终退出显式工作流状态
       -> 读取当前 active Blockers
       -> resolve_state(active_blockers)
  -> 如果 command 最终进入或保持显式工作流状态
       -> 使用经过 transition guard 校验的显式目标状态
  -> 保存新的 state/version
  -> 写 Audit
```

显式工作流变更和 Blocker 变更不是互斥分支：

```text
cancel_reclaim
  -> 清除 scheduled_reclaim 工作流事实
  -> resolve_state(active_blockers)
  -> 结果可以是 archived/suspended/read_only/active，不能直接写 active

abandon setup_failed
  -> 结束 Setup 失败工作流
  -> 创建 owner_archive Blocker
  -> resolve_state(active_blockers)
  -> archived

schedule_reclaim
  -> 检查全部恢复窗口和 can_reclaim
  -> 显式进入 scheduled_reclaim

destroy
  -> 终止全部 active Blocker
  -> 显式进入 destroy
```

例如 Owner 归档、Moderation 决定、Blocker 释放和显式 reconcile 都复用这一条路径；默认
`read/list/search` 不在读取时逐行调用 `resolve_state/1`。

Lifecycle 能力 API 统一返回 `{:ok, boolean}`；`false` 表示已完成判断但能力不允许，`error`
只表示无法完成判断：

```text
Lifecycle.can_read(community)
Lifecycle.can_write(community)
Lifecycle.can_manage(community)
Lifecycle.can_reclaim(community)

{:ok, true}       已完成判断，允许
{:ok, false}      已完成判断，不允许
{:error, reason}  数据不完整或查询失败
```

Lifecycle 只回答资源状态能力。它不接收 `user`，不判断 actor 是否为 Owner、Author、Manager
或 Reviewer，也不解释 Passport；这些身份与资源关系由配套的 [CMS Gate](./gate.md) 在操作
上下文中组合。

需要显式资源状态检查时，`CMS.Gate` facade 委托内部 `Gate.Access` 组合 Lifecycle 能力、资源
关系、Passport 与必要的 Allow 结果：

```text
CMS.Gate.can(user, :read, community)
CMS.Gate.can(user, :archive, community)

{:ok, true}
{:ok, false}
{:error, reason}
```

真正执行 command 或 mutation 时使用 `CMS.Gate.check/3`，由它把不允许映射为稳定 domain
error。`Gate.Access` 不能修改 Lifecycle，`Gate.Passport` 不能自行推断 Lifecycle 状态，
Lifecycle 也不能因为某个 actor 是 Owner 而改变自身状态投影。

Lifecycle 的能力 API 和 `Gate.can/3` 都使用 `{:ok, boolean} | {:error, reason}` 合同，但两者
回答的问题不同：前者只回答状态能力，后者回答具体 actor 对具体 resource 的操作准入。
`Gate.check/3` 将 `false` 映射为稳定 domain error。公开列表和搜索不逐行调用 Gate，而是在
SQL 层使用默认 `Read.scope/1`。

`state` 是供默认 scope 高效查询的物化结果。对 Blocker 计算状态必须始终满足：

```text
lifecycle.state == Lifecycle.resolve_state(active_blockers)
```

所有 Blocker 写入必须在同一事务中重算并保存 `state`，禁止绕过 transition facade 直接更新。
提供显式 `Lifecycle.reconcile/1` 用于锁行、重算和修复漂移，并写
`community.lifecycle_reconciled` Audit；当前不增加周期性 reconcile Job。显式工作流状态按
transition guard 校验，不适用上述 Blocker 等式。

`destroy` 不表示立即删除 `communities` 行，也不在 V1 改写 slug。它只是不可恢复的
Lifecycle 终态；物理清理、tombstone、名称释放和外部副作用都留给 V2。

## 允许的主要转换

```text
Setup：

setting_up ---------> active
     |
     v
setup_failed -------> setting_up   # Reviewer retry
     |
     +-------------> archived      # 显式 abandon；自动超时见 Phase 5 TODO

长期状态：

active/read_only/suspended
             |
             | 创建或结束 Blocker 后重算
             +<------------------------------+
             |                               |
             +---------> archived -----------+  # 截止时间前恢复
                            |
                            v
                   scheduled_reclaim
                            |
                            v
                         destroy
```

补充规则：

- `setup_failed -> setting_up` 只能由受权 Reviewer 重试。
- `setup_failed` 当前只允许 Reviewer/Owner 通过显式 abandon command 进入归档/回收路径；
  自动超时推进暂不实现。
- Billing 恢复、审核撤销、申诉成功或运维恢复只释放对应 Blocker，然后重算状态；不能直接写
  `suspended -> active`。
- `read_only` 必须允许 Owner 归档，也必须能因更严格 Blocker 进入 `suspended`。
- 归档恢复只允许在对应 `blocker.recover_until` 前释放归档 Blocker，然后根据剩余 Blocker 重算，
  不保证结果一定是 `active`。
- `scheduled_reclaim` 恢复需要显式取消回收并重算，不能由普通更新隐式恢复。
- `destroy` 不可恢复；如需重新创建，应产生新的 Community identity。

## 公开与内部读取

公开能力统一归 `CMS.Communities`，不增加独立的 `Visibility` 领域概念。读取默认就是公开
读取，因此默认 API 不增加 `public` 后缀：

```text
CMS.Communities.read(slug)
CMS.Communities.list(filter)
CMS.Communities.search(query)
```

它们共享 `CMS.Communities.Read.scope/1`，默认公开查询只依据 Lifecycle 的公开读取能力判断。
FrontDesk、Widget 和其他公开 API 必须调用这些默认 facade，不能直接查询 `communities`。

单条读取如果需要允许申请者、Owner、Manager 或 Reviewer 查看非公开 Community，则由领域 Read
加载判断所需的最小上下文，并调用 [CMS Gate](./gate.md) 完成 viewer-aware 判断：

```text
CMS.Communities.read(ref, user)
          |
          v
Gate.can(user, :read, community)
          |
     +----+----+
     |         |
 {:ok, true} {:ok, false}
     |         |
 返回内容    对外 Not Found
```

Resolver 只传入 `cur_user`，不能自行判断 owner/manager；Lifecycle 也不识别 user。允许返回后，
GraphQL 可以通过 Meta 输出当前 viewer 有权看到的状态提示；拒绝时不能泄漏 Community 内容、
Blocker 或审核原因。

Press TS 继续只消费 Phoenix 公开 GraphQL。GraphQL 是 Phoenix 与 Press TS 的协议边界，但
resolver 本身保持薄层；实际 policy 由 resolver 背后的 `CMS.Communities` 默认读取 facade
强制执行。Phoenix `CMS.Press` 不再自行 `Repo.get_by` 后置判断，而是从默认读取入口取得
Community。Feed、Sitemap、Manifest 和自定义域名因此不需要在 TS/Gateway 重复实现 policy。

读取所有 Lifecycle 状态时必须显式带 `_all`：

```text
CMS.Communities.read_all(ref)
CMS.Communities.list_all(filter)
CMS.Communities.search_all(query)
CMS.Communities.Read.scope_all(queryable)
```

`_all` 只表示不按 Lifecycle 隐藏，不能代替 actor authorization。管理与转换继续使用表达
用途的专用入口：

```text
CMS.Communities.read_for_management(ref, actor)
CMS.Communities.lock_for_transition(ref)
```

Dashboard 是否可进入不能复用默认读取 scope。例如 `suspended/archived` Community
虽然不公开，Owner 仍可能需要查看原因、提交申诉、导出数据或取消归档。

## 举报和违规处理

当前 `AbuseReport` 只支持 Article/Comment。Community 级治理需要独立的 Moderation Case，
而不是往 Community meta 中追加举报计数。

建议流程：

```text
report submitted
  -> moderation case opened
  -> triage
     -> no_action
     -> require_disclaimer
     -> force_rename
     -> temporarily_suspend
     -> archive
  -> appeal
  -> final decision
```

只有会改变产品可用性的决定才调用 Lifecycle facade，例如：

```text
temporarily_suspend -> 创建 moderation_suspend Blocker -> 重算状态
appeal_accepted     -> 释放对应 moderation_suspend Blocker -> 重算状态
archive             -> 创建 owner_archive 或 moderation_archive Blocker -> 重算状态
```

举报数可以触发风控检查或人工队列优先级，但不能直接成为 Public query 条件。

## 与 Community Application 的集成

Lifecycle 是独立领域，但必须在 Setup 的少数转换点与 Apply 原子集成：

```text
Community 创建前
  Community Application 是状态权威

Community 创建并进入 Setup
  Apply 负责 Setup 工作流
  Lifecycle 负责 Community 是否可用
  Application 与 Lifecycle 在同一事务中转换

Community active 以后
  Lifecycle 独立负责长期状态
  Application 只保留创建历史
```

明确交点：

```text
Apply approved
  -> 创建 Community
  -> 创建 Lifecycle(setting_up)

Setup success
  -> Application(created)
  -> Lifecycle(active)

Setup failed
  -> Application(setup_failed)
  -> Lifecycle(setup_failed)

Reviewer retry
  -> Application(setting_up)
  -> Lifecycle(setting_up)

放弃失败申请
  -> Application(cancelled)
  -> Lifecycle 进入归档/回收路径
```

Apply 不直接长期持有 Community 可用状态。当前 Setup 中已有 `FOR UPDATE + expected_version`
先例；正式 Lifecycle transition 必须锁定 Lifecycle 行并校验 Lifecycle version。
Setup 成功、失败和重试直接调用 Lifecycle transition；Application 的状态或历史记录不参与
Community 当前状态计算，Setup Job 只负责执行初始化工作。

## 软删除、回收和名称释放

Owner 删除 Community 时不直接删表：

```text
Owner delete
 -> archived
  -> 恢复窗口
  -> scheduled_reclaim
  -> destroy
```

V1 只保证 Lifecycle 状态转换、Blocker 终止和 Audit 原子性。`destroy` 保留现有 Community
数据和 slug，不负责名称释放、tombstone、对象清理或索引清理；这些都是 V2 的独立策略，不能
反过来成为 Gate/Lifecycle 的状态依赖。

`destroy` 命令必须在持有 Lifecycle 行锁时将全部 active Blocker 标记为：

```text
ended_at = now
end_type = terminated
ended_by_operation_ref = destroy operation_ref
```

每个被终止的 Blocker 写 `community.blocker_terminated`，再写 `community.destroyed`；它们共享
同一个 `operation_ref`。`terminated` 不表示 Moderation/Billing 等来源问题已经解决，只表示
Community 已进入不可恢复终态，Blocker 不再有可作用对象。

恢复与回收的时间边界必须确定：某个 Archive Blocker 的恢复要求
`now < blocker.recover_until`；`now >= blocker.recover_until` 时 restore 必须拒绝；整体回收要求所有可恢复 Archive Blocker 的窗口都已结束，且
`Lifecycle.can_reclaim(community) == {:ok, true}`。`schedule_reclaim` 和 `destroy`
都必须在事务中
`lock_for_transition`，重新检查 `state/version`、全部 active Blocker 和恢复窗口。恢复与回收
同时发生时由行锁串行化；后获得锁的一方必须根据最新事实幂等退出或返回冲突。

回收窗口到期后的自动推进 Job 也不属于 V1；V1 只提供可被未来 Job 调用的
`schedule_reclaim/2` command，并在 command 内完成锁、version、Blocker 和时间边界校验。

`recover_until == nil` 的 Archive Blocker 在 V1 不提供恢复窗口；创建可恢复的 Owner Archive
必须显式提供截止时间。`setup_failed` 超时自动 abandon 仍是 TODO：需要先确定超时时长、通知对象和
`abandon_setup_failed` command，放到 V2/后续 Application policy 中，不在当前版本猜测。

### 子内容级联

Community 状态是 Article、Doc、Comment、Press 输出和搜索索引的祖先门禁。进入
`read_only/suspended/archived` 时不批量改写子内容自身状态，也不批量把 Article/Doc 放入
Trash；Article Trash 表达单个逻辑内容的可恢复删除，不是 Community 销毁的替代机制。

| Community 状态      | 子内容数据                    | 默认读取     | 写入                | Press / 搜索        |
| ------------------- | ----------------------------- | ------------ | ------------------- | ------------------- |
| `read_only`         | 保留原状态                    | 允许         | Member 写入全部拒绝 | 保持公开输出        |
| `suspended`         | 保留原状态                    | 祖先门禁隐藏 | 拒绝                | invalidate 并撤索引 |
| `archived`          | 保留原状态                    | 祖先门禁隐藏 | 拒绝                | invalidate 并撤索引 |
| `scheduled_reclaim` | 保留并进入清理清单            | 隐藏         | 拒绝                | 保持不可见          |
| `destroy`           | 保留当前数据，后续清理留给 V2 | 不可见       | 不可写              | V2 再处理           |

所有公开 Article、Doc、Comment 查询都必须同时校验所属 Community 的默认读取 scope，包括
inner id、comment id、旧 URL 和 GraphQL node 等直接入口。只隐藏 Community slug 页面不能
阻止子内容泄露。

Press cache、Search index 和通知属于 V2 的副作用编排。V1 只要求公开读取在 SQL/GraphQL
入口消费 Lifecycle 能力，不要求在本轮引入 Job、Outbox 或外部服务 adapter。

## Audit 集成

每次 Lifecycle 转换必须在同一事务中：

1. 锁定 Lifecycle 行。
2. 校验 `from -> to` 和 `expected_version`。
3. 更新 Lifecycle 当前状态。
4. 写入对应 `CMS.Audit` 记录。
5. V2 才插入清理、索引或通知 Job；V1 不依赖 Job 提交状态。

建议增加稳定 Audit action 值。它们写入 `cms.audit_logs.action`，不是 Community schema 字段。
Blocker 操作记录操作事实，状态影响统一放在 metadata：

```text
community.blocker_created
community.blocker_released
community.blocker_terminated
community.setup_failed
community.setup_retried
community.activated
community.reclaim_scheduled
community.reclaim_cancelled
community.destroyed
community.lifecycle_reconciled
```

创建或释放 Blocker 时始终写对应 Blocker action。即使状态计算结果不变，也不能改写成另一个
状态 action。例如 Community 已经是 `suspended` 时新增 `billing_read_only`，应记录
`community.blocker_created`，且 `fromState/toState` 都是 `suspended`。不再使用
`community.suspended/community.read_only_enabled/community.archived/community.restored` 混合表达
Blocker 操作和状态结果。

Audit metadata 至少包含：

```text
fromState
toState
reasonCode
blockerType
causeCode
causeRef
operationRef
stateChanged
note
```

Audit 写失败时，Lifecycle 转换也必须回滚。反过来，任何查询都不能通过最后一条 Audit 推断
Lifecycle 当前状态。

## 兼容与迁移

存量 Community 当前没有 Lifecycle 行，短期只能使用：

```text
有 Lifecycle：以 Lifecycle 为准
无 Lifecycle：临时兼容 pending == normal
```

这只能作为迁移桥梁，不能永久保留。最终需要为所有存量 Community 回填 `active` Lifecycle，
校验数量后，必须在上线切换中一次性关闭 `pending` 的公开状态职责。当前 `Read.scope/1`、
Gate capability/bootstrap fallback 中的 `pending == normal` 都属于这条迁移桥梁，不能变成永久双权威。
`pending` 如仍被旧代码需要，也只能作为过渡投影，不能参与新查询判断；关闭前必须记录回填总数、
成功数和异常数，异常未清零不得移除 fallback。

存量回填的 `active` 是一次性 Lifecycle migration 规则，不是 Billing fallback。旧
payment/Billing 存储已于 2026-04 通过
`20260413000100_drop_payment_and_customization.exs` 不可逆移除，当前没有 Billing 存储或
Billing Blocker。未来重写的 Billing 上线时，由新系统显式创建 Entitlement 和对应 Blocker，
并单独设计初始化与切换；正式启用后不能用“找不到 Billing 记录就当 active”的长期
fail-open 规则。

现有 `community_lifecycles.application_id` 是必填，但存量 Community 不一定有 Application，
会直接阻碍回填。Lifecycle 只强依赖 Community：

```text
community_id    required
application_id  optional，仅记录 Apply 创建来源
```

当前 migration 对 `application_id` 同时使用 `on_delete: :nilify_all` 与 `null: false`，两者也相互
冲突，必须由新 migration 修正。扩展状态时还需要同步修改：

```text
CMS.Const 中的 Lifecycle state Enum
CommunityLifecycle 的 Ecto.Enum
community_lifecycles_state_check 的新 migration
GraphQL Lifecycle Enum
`Lifecycle.resolve_state/1` 与穷举测试
```

当前 GraphQL 已暴露 `Community.lifecycle_state`。前端 `TCommunity` 是否同步该字段，以及
`TCommunity.pending` 等旧字段的清理，是独立的前端协议合入事项，不属于本轮 Lifecycle/Gate
核心验收。最终移除 `communities.pending` 的状态职责时，仍必须另行完成 GraphQL 旧字段、前端
类型、旧常量消费和相关 fixture 的迁移，不能只停止后端双写。

## 实施计划

### Phase 1：搬迁并补全 V1 默认读取

- 将已有 `Communities.Visibility` policy 搬迁到 `CMS.Communities.Read.scope/1`，不是从头创建。
- 默认建立 `read/list/search`；跨状态读取显式使用 `read_all/list_all/search_all/scope_all`。
- List、Search 和 FrontDesk 改用默认 Communities facade；Phoenix `CMS.Press` 修复直查后置判断。
- Press TS 继续消费公开 GraphQL，自定义域名继续只负责 host 到 slug 的 routing。
- 保留明确命名的 management/transition 读取入口。
- 补齐单条、列表、搜索、Press 和 Sitemap 的非公开测试。
- 补齐 Article、Doc、Comment 与 GraphQL node 直接读取的祖先 Lifecycle 测试。

### Phase 2：建立 Lifecycle 基础并与 Apply 集成

- 通过 `CMS.Const` 集中 Lifecycle state、Blocker type 和 Blocker end type Enum。
- 增加 Blocker、`resolve_state/1`、transition facade、Audit 和锁。
- 为 active Blocker 增加 NULL-safe 部分唯一索引，并测试 `cause_ref = NULL` 的 Owner 重复归档。
- 明确 Setup/回收终态由 command 显式转换，只有可用性状态通过 active Blocker 计算。
- 将 Apply/Setup 当前直接更新 Lifecycle changeset 的路径改为调用正式 Lifecycle transition，并保持
  同事务；Application Event 不作为 Lifecycle 状态机制。
- 为所有存量 Community 回填 Lifecycle。
- 将 `application_id` 改为可空；将 `recover_until` 放到 Archive Blocker，并增加相关时间字段。
- 将状态能力集中为 `can_read/1`、`can_write/1`、`can_manage/1`、`can_reclaim/1`，统一返回
  `{:ok, boolean} | {:error, reason}`；`can_write/1` 只表示状态允许写入，不代表普通成员权限。
- 接入 `CMS.Gate.can/3` 与 `check/3`：Lifecycle 保持 actor-independent，Gate 组合具体资源关系、
  Passport action 和状态能力；Resolver 只传递 `cur_user`。
- 停止以 `communities.pending` 决定公开性，随后移除双写。

### Phase 3：Community 软删除与恢复

- 实现 `archive/restore/schedule_reclaim/cancel_reclaim/destroy` facade。
- 增加 Blocker 恢复期限、显式 abandon/回收命令和数据导出；通知明确列为 V2 TODO。
- `schedule_reclaim` 和 `destroy` 必须拒绝仍有 Moderation/Ops 回收 Blocker 的 Community。
- 明确子内容祖先门禁和各 Aggregate 的 destroy cleanup，而不是批量写入 Article Trash。
- `destroy` 的后续 tombstone、物理清理和名称释放策略留到 V2，不进入本轮状态机。
- `destroy` 在锁内以 `terminated` 结束全部 active Blocker，并写对应 Audit。
- 禁止新增 Community `mark_delete` 字段。

### Phase 4：Moderation 接入

- 建立 Community Moderation Case、决定和申诉模型。
- 举报只创建/更新 Case，不直接改变公开可见性。
- 审核决定通过 Lifecycle facade 创建或释放有明确 `cause_ref` 的 Blocker。
- 增加对应 Audit action 和 Reviewer/Ops UI。

### Phase 5：重写后的 Billing 和 Free Trial 接入

- Billing 持有 Trial、Subscription 和 PaymentEvent。
- 新 Billing 显式创建 Entitlement；Lifecycle 将其变化表达为 Billing Blocker 并重新投影状态。
- `billing_read_only/billing_suspend` 默认不阻止 Community 回收；Community `destroy` 不删除
  Billing ledger 或消除欠款。需要阻止回收时创建独立保全 Blocker。
- Trial 从 Setup 成功开始；到期依次进入 grace、只读、暂停和回收流程。
- 完成 `setup_failed` 超时 abandon Job、Archive Blocker 到期的 reclaim sweep 和其他定时调度。
- Billing 不直接删除 CMS 数据。

## 验收测试

至少覆盖：

- `setting_up/setup_failed/suspended/archived/scheduled_reclaim/destroy` 不出现在任何公开入口。
- `active/read_only` 的公开读取和写入能力符合矩阵。
- 单条 slug 读取不能绕过列表过滤。
- Article、Doc、Comment 的 id/ref/node 直读不能绕过所属 Community 的 Lifecycle。
- Dashboard Owner 可以按能力进入非公开 Community，匿名用户不能进入。
- 举报记录本身不改变 Lifecycle；审核决定才触发转换。
- Billing、Moderation、Owner 或 Ops 同时存在时，只释放一个 Blocker 不会错误解除其他来源。
- Moderation Blocker 生效时，Owner 归档不能通过显式 `schedule_reclaim/destroy` 绕过审核。
- Billing 可用性 Blocker 默认不阻止回收，Community `destroy` 不删除独立 Billing ledger。
- 多个 Archive Blocker 并存时，回收等待所有有效恢复窗口结束。
- `cancel_reclaim` 清除显式工作流事实后按 active Blocker 重算，不能直接写 `active`。
- `abandon setup_failed` 创建归档 Blocker 后重算为 `archived`。
- Lifecycle 和 Audit 同事务成功或回滚。
- Blocker 计算状态始终等于 `resolve_state(active_blockers)`；显式 reconcile 可以修复漂移。
- Apply/Setup 重放不会重复推进 Application/Lifecycle 或创建重复 Job；通用 Lifecycle transition
  的 operation_ref 去重不属于 V1 独立保证。
- `cause_ref = NULL` 的 Owner 重复归档不会产生重复 active Blocker。
- `destroy` 将所有 active Blocker 标记为 `terminated`，不会留下 `ended_at IS NULL` 的残留。
- 归档恢复、取消回收和最终销毁遵守时间窗口。
- 回收 command 与恢复竞态通过 Lifecycle 行锁、version 和时间边界得到确定结果。
- Community 销毁不改变 slug；名称预约、释放和冲突策略留到 V2。
- 存量 Lifecycle 回填后，不再依赖 `pending` fallback。

## 不变量

1. Community 默认 `read/list/search` 只读取可公开状态；跨状态读取必须显式使用 `_all` 或专用入口。
2. Lifecycle Aggregate（显式工作流状态与 active Blocker）是当前可用状态的唯一权威。
3. Lifecycle 不接收 user；viewer 与资源关系、Passport 和 Lifecycle 能力只能由 Gate 组合。
4. Audit 只记录事实，不驱动状态。
5. 举报不是处罚决定。
6. 未来 Billing、Moderation 和 Application 保留自己的领域状态。
7. Community 不重新引入 `mark_delete`。
8. `destroy` 是不可恢复终态；Lifecycle 不负责 slug 释放或物理清理。
9. 每个来源只能创建和释放自己的 Blocker；恢复操作必须释放 Blocker 后重算状态。
10. 子内容公开读取和写入必须消费所属 Community 的 Lifecycle 能力。
11. `schedule_reclaim` 和 `destroy` 必须拒绝任何仍在阻止回收的 active Blocker。
12. Blocker 计算状态必须恒等于 `Lifecycle.resolve_state(active_blockers)`；显式工作流状态只能由
    transition command 改变。
