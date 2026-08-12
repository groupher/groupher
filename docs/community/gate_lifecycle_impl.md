# Gate 与 Community Lifecycle 实施与验收

本文把 [CMS Gate](./gate.md) 与 [Community Lifecycle](./lifecycle.md) 的实施拆成可独立合入的批次。
目标是允许无依赖的工作并行进行，同时保证任何一个已合入的中间态都能编译、可回归、可回滚，且不会
出现“Gate 已经消费不存在的 Lifecycle 能力”或“公开读取绕过 Community 状态”的正确性空洞。

本文是实施顺序和验收标准，不替代两个领域设计文档。状态、Blocker、转换和能力的最终语义以
`lifecycle.md` 为准；Gate 的 action、Passport、Allow 和 Web adapter 边界以 `gate.md` 为准。

本轮 V1 只验证 Lifecycle 状态/Blocker/能力与 Gate 组合是否能服务现有系统。Application
Slug Claim、tombstone、物理清理、Press/Search 副作用、通知和定时 Job 均不进入本轮核心实现，
统一作为 V2 扩展点。
Application Event 不是 Lifecycle 状态；若 Apply 继续保留它，只作为 Application 自身历史。

## 总体顺序

```text
┌──────────────┐       ┌──────────────┐
│ A1 Lifecycle │ ────▶ │ B1 Lifecycle │ ────┐
│ public read  │       │ capabilities │     │
└──────────────┘       └──────────────┘     │
                                             ▼
┌──────────────┐                       ┌──────────────┐       ┌──────────────┐
│ A2 Gate      │ ────────────────────▶ │ B2 Gate      │ ────▶ │ C Lifecycle  │
│ namespace    │                       │ Access       │       │ commands     │
└──────────────┘                       └──────────────┘       └──────────────┘
```

实施和合入规则如下：

1. A1 与 A2 可以并行开发、分别合入。
2. B1 必须在 A1 的默认读取边界稳定后合入；B1 先提供 Lifecycle 能力，暂不切换 Gate 消费者。
3. B2 只能在 B1 的能力 API、状态投影和迁移数据稳定后合入。
4. C 的 Lifecycle command 可以与 B2 并行开发，但 Gate action 映射和最终合入必须在 B2 之后。
5. 每个批次都必须通过本文件对应的验收门槛；“代码已经存在”不等于“批次完成”。

## 关键边界

### `Read.scope/1` 不是 `Gate.can/3`

`CMS.Communities.Read.scope/1` 是 SQL query scope，用于列表、搜索和默认公开读取；
`Gate.can/3` 是加载资源后的 actor-aware 操作准入判断。A 批不能让 `Gate.Access.Community :read`
直接消费 `Read.scope/1`，也不能在 Gate 内重新构造 query 来模拟资源能力。

因此：

- A1 负责 `Read.scope/1`、`scope_all/1` 和默认/内部读取边界。
- B1 负责 `Lifecycle.can_read/1` 等 actor-independent 能力。
- B2 才负责 `Gate.Access.Community` 与 `Gate.can/check` 的组合。

### Lifecycle 与 Gate 的生产者/消费者关系

Lifecycle 是状态和能力的权威；Gate 是操作准入的消费者。B1 可以先合入未被 Gate 使用的能力 API，
但不允许 B2 先接 stub、默认值或临时 fail-open 能力。

Lifecycle command 仍必须在行锁内重新检查状态、Blocker、恢复时间和 version。Gate 的检查不能取代
command 内的并发安全检查，也不能把一次 preflight 结果当成事务授权。

### A2 不提前删除 owner 关系兼容路径

当前 Passport middleware 和 FrontDesk middleware 仍参与 Article/Comment owner fallback 和资源定位。
A2 只迁移 Gate namespace 与稳定 facade；`passport_is_owner` 的关系权威收敛属于 B2 的 Access 工作。
在 B2 完成前，不得为了“看起来更干净”提前删除现有 owner 兼容路径。

## 批次 A1：Lifecycle Phase 1，默认公开读取

### 实施范围

- 将现有 `CMS.Communities.Visibility.public_query/1` 的策略收敛到
  `CMS.Communities.Read.scope/1`。
- 增加明确的跨状态读取入口：`scope_all/1`，并在 facade 层区分默认读取和管理/转换读取。
- `CMS.Communities.read/list/search` 默认只读取公开 Community。
- FrontDesk、Community List、Community Search 使用默认 Communities facade 或 Read scope。
- 修复 `CMS.Press`：不得先直接 `Repo.get_by` Community，再后置执行 `Visibility.public?/1`。
- Press TS 继续只消费 Phoenix 公开 GraphQL；Gateway 只负责 host 到 slug 的 routing。
- 补齐 Article、Doc、Comment、GraphQL node 等祖先 Community 读取门禁。
- 保留存量 Community 的临时兼容规则：没有 Lifecycle 时，只有 `pending == normal` 才可公开；
  该规则同时覆盖 Read scope、Gate capability/bootstrap fallback；B1 合入不能视为永久保留，
  上线前必须核对回填数量，确认异常为零后一次性关闭。

### 不在 A1 实施

- 不创建 `Lifecycle` 的完整状态机、Blocker 或回收 command。
- 不让 Lifecycle 接收 user，也不在 Read 中判断 Owner、Manager 或 Reviewer。
- 不调用 `Gate.can/3` 逐行过滤列表或搜索结果。
- 不移除 `communities.pending` 字段或 GraphQL 字段；只停止新增绕过默认 scope 的公开查询。
- `Community.lifecycle_state` 已由 GraphQL 暴露；前端 `TCommunity` 类型同步属于独立协议合入，
  不作为本轮 V1 核心验收条件。

### 合入前验收

- [ ] `Read.scope/1` 的结果与迁移前 `Visibility.public_query/1` 一致，包含有 Lifecycle 和无 Lifecycle 两类数据。
- [ ] `scope_all/1` 明确绕过公开过滤，但不被默认 `read/list/search` 调用。
- [ ] 从 A1 起必须保持不可见的非公开状态（包括 B1 新增的 `suspended`、`archived`、
      `scheduled_reclaim`、`destroy`，以及现有的 `setting_up`、`setup_failed`）不出现在默认公开
      列表和搜索中。
- [ ] `read_only` 是 B1 扩展后的新状态；A1 不要求它出现，但 B1 合入后必须验证它出现在默认公开
      读取中，且不能与其他非公开状态一起放行。
- [ ] 单条 slug/aka 读取、列表、搜索、Press Article、Feed、Sitemap、Manifest 均覆盖非公开 fixture。
- [ ] Article、Doc、Comment 和 GraphQL node 不能通过所属 Community 的直接路径绕过祖先门禁。
- [ ] Dashboard、Reviewer、Setup Job 和运维路径仍能通过显式内部入口读取非公开 Community。
- [ ] Press 的所有公开入口使用同一默认 Community 读取边界，不再依赖后置 `Visibility.public?/1`。
- [ ] 通过受影响的 backend targeted tests、`mix compile --warnings-as-errors` 和 `git diff --check`。

### A1 合入后的不变量

```text
默认公开读取 -> CMS.Communities.Read.scope/1
内部/管理读取 -> 显式 *_all / management / transition 入口
Press TS       -> Phoenix public GraphQL
Gate Access    -> 尚未消费 Community Lifecycle 能力
```

## 批次 A2：Gate namespace 与行为保持迁移

### 实施范围

- 建立 `CMS.Gate` 根 facade 及 `Gate.Allow`、`Gate.Passport`、`Gate.PublishThrottle` namespace。
- 迁移：
  - `CMS.CanCan` -> `CMS.Gate.Allow`
  - `CMS.CanCan.Communities` -> `CMS.Gate.Allow.Community`
  - `CMS.Communities.Passport` -> `CMS.Gate.Passport`
- `CMS.CommunityApplications.ReviewAuth` -> `CMS.Gate.Passport`，并迁移
  `ReviewAuth.authorize/2` 调用点到 `Gate.check_passport/3`
- 当前 Apply/Review/Setup 的运行时调用点已经直接使用 `Gate.check_passport/3`；旧的
  `ReviewAuth.authorize/2` 仅作为短期兼容 facade 保留，不再新增业务依赖，后续可单独删除。
  - `CMS.Policy.PublishThrottle` -> `CMS.Gate.PublishThrottle`
  - Passport/PublishThrottle model、config、registry 到 Gate 所属目录。
- 根 facade 暴露稳定入口：`allow_thread`、`allow_emotion`、`allow_comment`、Passport CRUD、
  `check_passport`、PublishThrottle check/log。
- `CMS.Const` 开始集中 Gate/Passport 合法词汇；Const 不拥有权限政策或 action 映射。
- GraphQL middleware 改为依赖 Gate facade，但暂时保留现有资源定位和 owner fallback 的执行顺序。
- 保持现有 Passport rule JSON、GraphQL error code、限流窗口和数据库表不变。

### A2 的明确边界

- 不实现 `Gate.Access.Community`。
- 不启用 `Gate.can/3` 的 Lifecycle 判断。
- 不删除 `passport_is_owner`，不把 Article/Comment owner 关系提前搬进 Access。
- 不把 `Helper.PermissionRegistry` 的所有通用调用未经分类地暴露到根 facade；需要逐一确认是
  Passport 管理查询、资源授权，还是测试/支持工具。
- TODO(V2)：在确认外部调用方不再依赖后，单独清理 `ReviewAuth.authorize/2` 兼容 facade；不与
  Lifecycle 核心修复绑定。
- `allow_comment/1` 去掉未参与判断的 user 参数时，必须同步更新所有调用方和测试。

### 合入前验收

- [ ] `CMS.CanCan`、旧 Passport、旧 Policy 的业务调用点已迁移或明确保留兼容桥。
- [ ] Apply/Setup/Review 中的 reviewer Passport 检查已从 `ReviewAuth.authorize/2` 迁移到
      `Gate.check_passport/3`，并保留原有 reviewer action、context 和错误合同。
- [ ] Allow 的 thread/emotion/comment 结果和 domain error 与迁移前一致。
- [ ] Passport 的 global/community/root/god、thread grant、owner fallback 行为与迁移前一致。
- [ ] Passport unknown action、invalid context、missing passport 的错误合同稳定。
- [ ] PublishThrottle 的 interval/hour/day 限制、god bypass、首次发布行为稳定。
- [ ] Middleware 的 article path 解析、FrontDesk 资源加载和 owner fallback 顺序稳定。
- [ ] 直接依赖旧 namespace 的调用点已通过静态搜索清理，剩余兼容入口有删除条件和测试覆盖。
- [ ] 通过 Allow、Passport、PublishThrottle、middleware 相关测试、编译和 diff 检查。

### A2 合入后的不变量

```text
Gate facade 已可发现
Allow/Passport/PublishThrottle 已归属 Gate
Gate.can/check 尚未承担 Community Lifecycle 语义
现有 GraphQL 行为、错误码和 Passport 数据格式不变
```

## 批次 B1：Lifecycle 基础与能力生产端

### 实施范围

- 扩展 Lifecycle state：
  `setting_up`、`setup_failed`、`active`、`read_only`、`suspended`、`archived`、
  `scheduled_reclaim`、`destroy`。
- 增加 Lifecycle Blocker、状态投影、transition facade、行锁、version 和事务内 Audit。
- 实现 `resolve_state/1`，并保证：

  ```text
  lifecycle.state == Lifecycle.resolve_state(active_blockers)
  ```

- 为 active Blocker 增加 NULL-safe 部分唯一约束，覆盖 `cause_ref = NULL` 的 Owner archive。
- 将 `community_lifecycles.application_id` 调整为可空，完成存量 Community 回填。
- Global Community 创建路径同步创建 `active` Lifecycle；Application 创建仍由 Creation 显式创建
  `setting_up` Lifecycle，旧无 Lifecycle 数据只保留命令锁内的兼容补建。
- 将 Apply/Setup 的直接 Lifecycle changeset 更新改为正式 transition，并保持同事务；Setup Job
  只负责执行初始化工作，Application Event 不作为 Lifecycle 状态机制。
- 实现：
  `can_read/1`、`can_write/1`、`can_manage/1`、`can_reclaim/1`，统一返回
  `{:ok, boolean} | {:error, reason}`；`can_write/1` 只表示状态允许写入，不代表普通成员权限。
- 扩展默认公开读取的 Lifecycle state 白名单：`Read.scope/1` 必须允许 `active` 和 `read_only`，
  而 `setting_up`、`setup_failed`、`suspended`、`archived`、`scheduled_reclaim`、`destroy` 仍必须
  被过滤；无 Lifecycle 的存量兼容规则在回填完成前继续保留。
- 回填验证完成后，停止使用 `communities.pending` 作为长期状态权威；是否删除旧 GraphQL/前端字段
  必须单独完成迁移清单，不得只停写不清理消费方。

### B1 的明确边界

- Lifecycle API 不接收 user，不判断 Owner、Manager、Reviewer 或 Passport。
- 不在本批把 Gate Access 切换到新能力 API；已有公开读取在切换期间仍必须正确。
- 不实现 `archive/restore/schedule_reclaim/cancel_reclaim/destroy` 完整 command；这些属于 C。
- 不把 Moderation report、Billing entitlement 或 Audit 查询当作当前状态来源。

### 合入前验收

- [ ] 所有 state、Blocker type、Blocker end type 来自 `CMS.Const`、Ecto.Enum、数据库约束和 GraphQL Enum 的同一套词汇。
- [ ] 所有 Blocker 创建、释放、终止都在 Lifecycle transition facade 内完成，并在同一事务重算 state。
- [ ] Apply/Setup 的重复 operation ref 由 Application 状态机和 version 稳定拒绝或幂等返回，不重复推进；
      重复 active Blocker、Owner `cause_ref = NULL` 重复归档均幂等或稳定失败。通用 transition
      operation_ref 去重留后续。
- [ ] 跨 Lifecycle 的 Job、Application Event、Blocker 和 Audit 复用同一个 UUID operation_ref；非 UUID
      输入稳定失败，不能在 Audit 写入时静默生成替代值。
- [ ] `resolve_state/1` 穷举测试覆盖单个和多个来源 Blocker 的交集能力。
- [ ] `can_read/write/manage/reclaim` 对每个 state 和 blocker 组合返回正确的 `{:ok, boolean}`。
- [ ] `Read.scope/1` 的公开 state 白名单包含 `active`、`read_only`；`read_only` fixture 出现在默认
      单条/列表/搜索/Press 公开读取中，`suspended`、`archived`、`scheduled_reclaim`、`destroy` 等
      非公开状态仍不可见。
- [ ] Apply/Setup、回填、`application_id` nullable migration 和旧数据 fixture 均通过测试。
- [ ] 行锁、version、事务 rollback、Audit 写入和状态漂移 reconcile 有测试。
- [ ] 公开读取在 B1 期间没有回归；历史无 Lifecycle Community 的兼容规则已被明确验证。
- [ ] 通过受影响的 migration/domain tests、`mix compile --warnings-as-errors` 和 `git diff --check`。

### B1 合入后的不变量

```text
Lifecycle 是状态/Blocker/能力的唯一权威
Lifecycle 不认识 user
Gate 尚未消费新能力
所有状态写入经过 transition facade
```

## 批次 B2：Gate.Access.Community 消费能力

### 实施范围

- 建立 `Gate.Access` 与 `Gate.Access.Community`。
- `Gate.can/3` 和 `Gate.check/3` 开始消费：
  - Lifecycle capability
  - Community owner/moderator 等资源关系
  - `Gate.Passport`
  - 必要的 Allow 结果
- 第一批启用并穷举：`:read` 以及 `:archive`、`:restore`、`:schedule_reclaim`、
  `:cancel_reclaim`、`:destroy` 等具体 Community command action；不启用泛化 `:write`/`:manage`。
- `CMS.Communities.Read.read(ref, user)` 在需要 viewer-aware 读取时，将 user 交给 Gate；拒绝时对外
  映射为 Not Found，不泄漏 Blocker、审核原因或内部状态。
- 默认 list/search 继续走 SQL `Read.scope/1`，不逐行调用 Gate。
- Community 的 resolver owner/moderator 判断收敛到 Read/Access 约定；Article/Comment 的既有
  owner fallback 在本批保持现状，直到后续建立 `Gate.Access.Article/Comment`。

### Action 穷举规则

每个 resource/action 必须明确属于以下一种：

1. 映射到已注册 Passport action；
2. 明确声明不需要 Passport；
3. 返回 `{:error, :unknown_action}`。

Gate action atom 和 Passport action string 都必须来自 `CMS.Const`；Access 不能直接解释 Registry
底层 grant，也不能重复实现 thread expansion 或 owner fallback。

### 合入前验收

- [ ] Community `:read` 和具体 command action 对 active、read_only、suspended、archived 等状态均有穷举测试；
      未定义的 `:write`/`:manage` 返回 `{:error, :unknown_action}`。
- [ ] Owner、moderator、reviewer、普通用户、god、未登录和缺失资源上下文均有测试。
- [ ] `Gate.can/3` 保持 `{:ok, boolean} | {:error, reason}`；`Gate.check/3` 将 false 映射为稳定 domain error。
- [ ] unknown action、缺失能力事实、缺失关系事实和查询失败不会被误判为允许。
- [ ] viewer-aware 单条读取不能泄漏非公开 Community 内容；默认列表/搜索仍是 SQL 过滤。
- [ ] Article/Comment 的既有 owner fallback 行为保持不变；本批不声称已经完成
      `Gate.Access.Article/Comment` 的关系收敛。
- [ ] Passport、Allow、Lifecycle 三类失败原因不会互相覆盖成不稳定的通用错误。
- [ ] 通过 Gate Access、Community Read、GraphQL resolver/middleware 和回归测试。

### B2 合入后的不变量

```text
Lifecycle.can_* -> 只回答状态能力
Gate.Access      -> 组合 actor、resource、关系、Passport、Lifecycle、Allow
Read.scope       -> 仍负责列表/搜索 SQL 过滤
Gate.check       -> 不能替代 Lifecycle command 的锁内 guard
```

## 批次 C：Community 归档、恢复、回收与销毁

当前实现先完成 command core：Lifecycle.archive/2、restore/2、
schedule_reclaim/2、cancel_reclaim/2、destroy/2，以及 Gate 对应 action
的 preflight。它们已经具备行锁、expected_version、Blocker 重算/终止和事务内 Audit；
现有 GraphQL delete_community 入口已转为 archive adapter，旧的无 Lifecycle Community 会在
命令锁内补建兼容 Lifecycle；
destroy 只在同一事务中完成 Lifecycle 终态、Blocker termination 和 Audit；不改 Community.slug，
不处理 Slug Claim、tombstone 或物理清理。Search/Press、通知和定时推进都是 V2 扩展点，不把
“状态已 destroy”误报为“所有数据已物理删除”。

### 实施范围

- 实现 Lifecycle facade：
  `archive/1`、`restore/1`、`schedule_reclaim/1`、`cancel_reclaim/1`、`destroy/1`。
- `archive` 创建对应 Archive Blocker；`restore` 只释放自己的 Blocker，再按剩余 Blocker 重算。
- `schedule_reclaim` 与 `destroy` 在锁内重新检查全部 active Blocker、恢复窗口、state 和 version。
- `destroy` 在同一事务中将 active Blocker 以 `terminated` 结束，并写入 Audit；slug、tombstone、
  数据清理和外部副作用留到 V2。
- Gate 增加具体 command action 映射：`:archive`、`:restore`、`:schedule_reclaim`、
  `:cancel_reclaim`、`:destroy`。
- 不新增泛化 `:manage` 或 Community `:write` 的成员语义；Gate action 必须对应具体产品操作和
  已注册 Passport action。Dashboard、Article、Comment 的具体写操作另行定义。

### C 的并发和安全要求

- Gate preflight 通过不能跳过 Lifecycle command 的锁内检查。
- 多个 Archive Blocker 并存时，整体恢复窗口取最大 `recover_until`。
- Moderation/Ops/Legal Hold 仍 active 时，Owner 不能通过 archive/reclaim/destroy 绕过限制。
- `destroy` 不等于立即删除 `communities` 行；V1 保留现有 Community 数据，物理清理留到 V2。
- 不新增 Community `mark_delete`，不使用 `purged` 作为终态；终态固定为 `destroy`。

### 合入前验收

- [ ] archive/restore/reclaim/destroy 的状态转换和非法转换均有测试。
- [ ] 恢复窗口边界覆盖 `now < recover_until`、等于和超过三种情况。
- [ ] restore 只允许在 `now < recover_until` 时释放 Owner Archive Blocker；窗口到期返回稳定错误。
- [ ] 多个 Archive Blocker、Blocker 释放、cancel reclaim 和状态重算均有测试。
- [ ] Moderation/Ops/Legal Hold 阻止回收的测试覆盖 Owner、Reviewer 和 god 等 actor。
- [ ] restore、schedule_reclaim、destroy 与并发更新通过行锁和 version 测试。
- [ ] Apply/Setup 重放由 Application 状态机和 expected_version 拒绝；通用
      `Lifecycle.transition/3` 的 operation_ref 幂等去重不属于本轮保证，不能在验收中暗示已实现。
- [ ] destroy 不留下 active Blocker，写入 Blocker termination Audit 和 Community destroyed Audit。
- [ ] `cause_ref IS NOT NULL` 的 active Blocker 重复创建命中 changeset constraint error；被 Gate 拒绝的
      viewer read 不增加 Community views。
- [ ] 公开 GraphQL、Lifecycle command、Gate action 和 Audit 行为均有回归测试；Press、Search、
      Slug Claim、清理 Job 和 tombstone 不属于 V1 验收。
- [ ] 所有新 command 的 Gate action 都完成 Registry 存在性、Passport 映射和 unknown action 测试。
- [ ] 通过 lifecycle command、Gate Access、migration 和端到端领域测试。

## 暂不纳入本轮汇合点的工作

以下工作依赖 C 的稳定边界，但不应为了本次 Gate/Lifecycle 汇合提前塞入 B：

- `Gate.Access.Article`、`Gate.Access.Comment` 及 Article/Comment owner 关系的统一收敛；本轮只保持
  现有 owner fallback 行为，不阻塞 Community Access 汇合。
- Community Moderation Case、正式审核决定和申诉模型；它们未来是 Lifecycle Blocker 的生产者。
- 重写后的 Billing entitlement、Trial 和 Billing Blocker；它们未来是 Lifecycle Blocker 的生产者。
- `setup_failed` 超时自动 abandon、Archive Blocker 到期 sweep 和其他定时 Job；它们依赖后续
  明确的调度与通知合同。
- 所有子 Aggregate 的最终物理清理策略、tombstone 和名称释放；它们不参与本轮 Community
  Gate/Lifecycle 核心汇合。

对 Moderation/Billing 这类 Blocker 生产者，必须通过 Lifecycle facade 创建/释放自己的 Blocker，
不能直接改公开状态，也不能查询 Audit 推断当前状态。Access.Article/Comment 只保持现有 owner
fallback；物理清理和名称策略不承担 Blocker 状态判断。

## 跨批次静态检查与回滚规则

每个 PR 合入前都必须完成：

- `mix compile --warnings-as-errors`
- 对应批次的 targeted tests
- `git diff --check`
- 对旧 namespace、旧公开读取入口、裸 Passport action 和裸 Gate action 的静态搜索
- 检查 GraphQL error code、Passport rule JSON、public ref、operation ref 没有非必要变化

允许的回滚方式是按批次回退 facade 调用点，保留已写入的兼容数据；不得通过直接 SQL 更新 Lifecycle state、
删除 Community 数据、删除 Audit 或绕过 transition facade 回滚业务状态。

以下情况禁止合入或必须暂停下一批：

- Gate 依赖不存在或临时 stub 的 Lifecycle capability。
- 默认公开读取仍有直查 Community 后置过滤路径。
- 列表/搜索逐行调用 Gate。
- Resolver、middleware 和 Access 同时拥有不同的 owner 关系判断。
- `destroy`、Blocker 或 Audit 可被绕过直接写入。
- 失败原因被统一吞成 `false`，导致“事实缺失”和“明确拒绝”无法区分。

## 完成定义

整个实施完成，必须同时满足：

1. 默认公开 Community 读取只有一个 SQL scope 边界，内部读取用途显式命名。
2. Lifecycle Aggregate、active Blocker、状态投影和 transition facade 成为当前状态唯一权威。
3. Gate 是操作准入 facade，Access 只组合事实，不拥有状态或 Passport 规则。
4. `can/3`、`check/3`、`can_*` 的返回合同和错误语义稳定，并有穷举测试。
5. 所有归档、恢复、回收、销毁操作都通过锁内 Lifecycle command 完成。
6. Press、Search、GraphQL、Dashboard、Apply、Reviewer、Job 和运维入口均使用正确的公开或内部读取边界。
7. 没有 `CMS.Gate.Lifecycle`、Community `mark_delete`、`purged` 终态或 Audit 反向推断状态的实现。
