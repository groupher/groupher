# Gate / Lifecycle Cleanup：删除历史兼容与双权威

> 状态：设计确认，待实施。
>
> 本文是独立清理文档，不修改 Gate V1–V4、Community Lifecycle 和 Interaction V1–V4 的历史正文。
> 后续实现只服务新设计，不读取、迁移、回填或修复历史数据，也不保留长期兼容入口。

相关文档：

- [Gate V4](./gate_v4.md)：typed Access/Scope Context 与 canonical resource；
- [Community Lifecycle](./lifecycle.md)：Community state、Blocker 和 transition；
- [Interaction V5](../artiment/interaction_v5.md)：同步 ReadState、Audit 退役与 ReportFact；
- [Sentinel V1](../sentinel/v1.md)：跨领域内容风险检测。

## 1. 背景

Gate/Lifecycle 主体已经建立了正确方向：

```text
Gate
  actor + action + canonical facts
  -> allow / deny

Lifecycle
  actor-independent current resource state
  -> guarded transition

Command
  transaction + lock
  -> Gate
  -> authoritative write / Lifecycle
  -> commit
```

但当前运行时代码仍保留多轮迁移形成的兼容逻辑：

1. Community Lifecycle 缺失时回退读取 `Community.pending`；
2. Community command 可以现场 bootstrap 缺失 Lifecycle；
3. Community 同时存在 direct create 和 Application creation；
4. `Community.pending` 与 Community Lifecycle 重复表达 setup/current state；
5. Article archive 会运行时 backfill 缺失 Lifecycle；
6. Article/Doc `ensure_created` 同时表达 initial create 和 missing-row recovery；
7. Gate mutation 仍使用标记为 compatibility entry 的 `access_check/3`；
8. Passport 和 moderator policy 同时读取新旧数据形态；
9. Community Lifecycle 保留没有生产调用方的 standalone reconcile。

这些逻辑共同产生一个错误前提：

```text
权威数据不完整也可以继续运行
  -> Gate 猜旧字段
  -> Lifecycle 现场补行
  -> maintenance 以后再对齐
```

Cleanup 的目标是让新数据从创建起就完整。缺少权威事实必须 fail closed，不能自动推导或恢复。

## 2. 最终权威

### 2.1 Gate

Gate 只负责操作准入：

```text
Gate.scope/4
  query-time read boundary

Gate.with_check/4
  command transaction 内 canonical load + lock + policy + callback
```

Gate 不拥有：

- Lifecycle state；
- Community setup state；
- Passport/Membership facts；
- Report/Moderation state；
- 兼容数据转换；
- missing-row recovery。

### 2.2 Lifecycle

每类资源的 Lifecycle 是当前资源状态的唯一权威：

```text
CommunityLifecycle
ArticleLifecycle
DocLifecycle
CommentLifecycle
```

资源创建 command 必须在同一事务中创建 initial Lifecycle。后续 command 只加载并 transition 已存在的
Lifecycle；缺失时返回 `lifecycle_not_found`。

### 2.3 Community Application

Community Application 拥有申请和 provisioning workflow：

```text
draft / submitted / approved / setting_up / created / failed
```

Community Lifecycle 拥有 Community 当前状态：

```text
setting_up / active / read_only / suspended / archived / pending_destroy / destroy
```

`Community.pending` 不再承担任何状态权威。

### 2.4 Passport 与 Moderator

Gate typed Context 必须加载一种 canonical 事实：

```text
Passport
  one canonical passport representation

Moderator
  formal Community moderator/membership relation
```

Policy 不得从 User/Community 的多个字段猜测同一事实。

## 3. 删除 Community Lifecycle fallback

### 3.1 Scope fallback

当前公共 Scope 使用：

```text
Lifecycle state is readable
  OR
Lifecycle missing AND Community.pending == normal
```

这个 fallback 存在于 Community Scope 和 Article/Comment/Document 的 ancestor Community chain。

最终结构：

```text
Community query
  -> inner join CommunityLifecycle
  -> filter lifecycle.state
```

实施要求：

1. `left_join CommunityLifecycle` 改为必须存在的 join；
2. 删除所有 `is_nil(lifecycle.id) and community.pending == normal`；
3. management Scope 同样只消费 Lifecycle；
4. 缺失 Lifecycle 的 Community 不出现在正常产品读取中；
5. 不为缺失行执行 backfill。

### 3.2 Access fallback

删除以下语义：

```text
Lifecycle.can_read/can_manage
  -> lifecycle_not_loaded
  -> Community.pending == normal
```

最终语义：

```text
lifecycle loaded
  -> evaluate capability

lifecycle missing/not loaded
  -> deny / lifecycle error
```

`lifecycle_not_loaded` 不能被转换成允许结果。

## 4. 删除 Community Lifecycle bootstrap

删除：

```text
lock_for_transition_or_bootstrap
bootstrap_missing_lifecycle
bootstrap_from_community
insert_bootstrap_lifecycle
bootstrap_state
bootstrap_missing option
```

`request_destroy`、Blocker command 和所有 transition 必须锁定已有 Lifecycle。缺失时直接失败。

禁止通过以下旧字段推导 Lifecycle：

```text
Community.pending == normal -> active
Community.pending != normal -> setting_up
```

## 5. Community 创建只保留一条产品路径

当前存在：

```text
Direct create
  CMS.Communities.create
  -> Community
  -> Lifecycle.ensure_created(active)
  -> root / DocTree

Application create
  approved CommunityApplication
  -> create_core
  -> initial Lifecycle(setting_up)
  -> Setup
  -> Lifecycle(active)
```

最终产品路径只保留 Application create：

```text
CommunityApplication approved
  -> one creation transaction
  -> Community
  -> CommunityLifecycle(setting_up)
  -> required setup facts
  -> async/synchronous Setup
  -> explicit transition(active)
```

清理范围：

- 删除产品面的 `CMS.Communities.create/2` direct create；
- 删除 `CommunityLifecycle.ensure_created/2` 的 active-default 路径；
- GraphQL 不再直接创建 active Community；
- seed 使用明确的 operations/bootstrap command；
- test factory 使用专用 fixture builder，不借用旧产品入口；
- 测试依赖不构成保留 direct create 的理由。

Fixture builder 也必须创建完整的新模型，不得制造缺失 Lifecycle 的测试数据。

## 6. 删除 `Community.pending`

`Community.pending` 与 Lifecycle/Application 双写，应完整删除：

```text
Community schema pending field
Communities.Const.pending_state/1
Creation 写入 applying
Setup 写回 normal
Gate Scope fallback
Gate Access fallback
依赖 pending 的 query/test/GraphQL contract
```

切换后：

- provisioning 状态读取 CommunityApplication；
- Community 当前能力读取 CommunityLifecycle；
- 不增加 computed compatibility field；
- 不保留双写；
- 不迁移旧 `pending` 值。

## 7. 删除 Article runtime backfill

删除：

```text
Articles.Lifecycle.ensure_thread_backfill/2
Articles.States.archive/1 中的 backfill 调用
对应 raw SQL、文档和测试
```

Article archive 只处理拥有 Lifecycle 的新数据：

```text
archive candidates
  -> join ArticleLifecycle
  -> guarded transition archived
```

缺少 Lifecycle 的 Article 不在 archive command 中现场创建，也不从 `article.stage` 推导 lifecycle state。

## 8. 收紧 Lifecycle 创建入口

当前 Article/Doc `ensure_created` 同时承担：

```text
新 logical resource 创建 initial Lifecycle
已有 resource 缺失 Lifecycle 时补行
```

应拆成明确操作：

```elixir
Lifecycle.create_initial(...)
Lifecycle.get(...)
Lifecycle.lock(...)
Lifecycle.transition(...)
```

规则：

1. 新 logical resource 的 Draft/Article 与 initial Lifecycle 同事务创建；
2. 已有 logical resource 更新时必须加载已有 Lifecycle；
3. 已有 resource 缺 Lifecycle 时失败；
4. 不使用 get-or-create 隐藏生产者错误；
5. unique constraint 负责防止重复 initial create；
6. Content Import 同样遵守正式 create/update 分支，不调用 recovery helper。

Comment Lifecycle 当前在 Comment create transaction 中直接 insert，机制正确；只需把 `ensure_created`
重命名为 `create_initial`，使语义一致。

## 9. 删除 Community standalone reconcile

Community Blocker mutation 已要求在同一事务中 recompute materialized lifecycle state，因此删除：

```text
Lifecycle.reconcile/1
:__reconcile__ pseudo-state
transition 中的 reconcile bypass
仅覆盖 reconcile 的测试
```

保留：

```text
Blocker create/release/end
  -> same transaction
  -> recompute state
  -> guarded Lifecycle update
```

如果正常 Blocker command 后 state 不一致，应修复 command，不新增后台 reconcile。

## 10. Gate command API 收口

当前 `Gate.Access.access_check/3` 明确标记为 compatibility entry，但仍被大量 mutation 调用；部分调用
授权后才在另一个边界写数据库。

最终公开 API：

```elixir
Gate.scope(queryable, actor, action, context)

Gate.with_check(actor, action, resource, fn canonical ->
  domain_write(canonical)
end)
```

要求：

1. `with_check/4` 通过 `CMS.Gate` facade 公开；
2. mutation/command 全部迁移到 `with_check/4`；
3. canonical load、aggregate lock、policy 和 authoritative write 位于同一 transaction；
4. callback 只能返回 `{:ok, result}` 或 `{:error, reason}`；
5. 调用方不得在 Gate 返回后继续使用原始 resource struct；
6. 所有 mutation 迁移后删除 `access_check/3` compatibility entry；
7. UI/preflight 如有真实需求，另设只返回 boolean/Decision 的窄入口，不能代替 command check。

Interaction command 已拥有自己的 fact/ReadState transaction。迁移时必须避免双层含混边界：要么让
`Gate.with_check` 拥有外层 transaction 并在 callback 写 fact/ReadState，要么提供明确的 lock-internal
Gate primitive；不能继续依赖“compatibility check 恰好嵌套在调用方 transaction 中”。

## 11. 删除 Passport 与 Moderator fallback

### 11.1 Passport

删除同时读取以下形态的逻辑：

```text
user.cur_passport
user.cms_passport.rules
```

Gate Loader/Context 必须提供一个 canonical passport。Policy 只消费 typed Context，不自行 preload、
Map.get、fallback 或 rescue 成 false。

### 11.2 Moderator

删除同时读取以下形态的逻辑：

```text
community.moderators relation
community.meta.moderators_ids
```

Moderator 权限只来自正式 moderator/membership fact。Community meta 不参与授权。

## 12. 与 Sentinel / Moderation 的后续清理

当前 Article/Comment `pending`、`is_legal`、`audit_failed`、`illegal_reason` 和 `illegal_words` 属于旧
Audition 内容审核合同，不应长期留在 Gate/Lifecycle。

Sentinel V1 切换后：

```text
Sentinel signal
  -> Moderation Decision
  -> resource command / Lifecycle
```

届时删除 Gate Scope 中对旧 Article moderation `pending` 的直接过滤，并由正式 Moderation/Lifecycle
状态表达资源可见性。该清理属于 Sentinel/Moderation 实施批次，不与 Community pending 清理混为同一
字段迁移。

## 13. 不属于兼容逻辑的机制

以下机制保留：

- Gate typed Access/Scope Context；
- canonical resource reload；
- aggregate MutationLock；
- Lifecycle version guard；
- Lifecycle tombstone `deleted/destroy`；
- Community active Blockers；
- Blocker mutation同事务 recompute；
- Doc branch-scoped Lifecycle；
- `lifecycle_not_found/not_loaded` fail-closed error；
- command changed/unchanged 幂等合同。

这些机制表达当前业务正确性，不是历史数据恢复。

## 14. 实施批次

### Phase 1：独立无依赖删除

1. 删除 Interaction Audit/Job/cron（由 Interaction V5 承接）；
2. 删除 Article runtime lifecycle backfill；
3. 删除 Community standalone reconcile。

### Phase 2：Lifecycle 强制存在

1. 删除 Community bootstrap；
2. Gate Community/ancestor Scope 改为 required Lifecycle join；
3. 删除 Gate Access 的 `pending` fallback；
4. 补齐 missing Lifecycle fail-closed 测试。

### Phase 3：唯一 Community 创建流程

1. Application creation 成为唯一产品入口；
2. seed/test fixture 改用明确 builder；
3. 删除 direct create 和 active-default `ensure_created`；
4. 删除 `Community.pending` 及双写。

### Phase 4：Lifecycle producer 收紧

1. Article/Doc `ensure_created` 拆成 create/load；
2. Comment `ensure_created` 改名 `create_initial`；
3. Draft、Publish、Content Import 使用明确的新建/更新分支；
4. 缺失 Lifecycle 不自动恢复。

### Phase 5：Gate command 收口

1. facade 公开正式 `with_check`；
2. 逐个迁移 Community、Article、Comment、Docs、DocTree、Interaction mutation；
3. 删除 compatibility `access_check`；
4. 删除 passport/moderator fallback。

### Phase 6：治理域切换

1. 按 Interaction V5 切换规范化 ReportFact；
2. 按 Sentinel V1 切换内容检测；
3. Moderation Decision 调用正式资源 command/Lifecycle；
4. 删除旧 AbuseReport embed、threshold fold 和旧 moderation pending 字段。

各 Phase 完成后直接删除旧路径，不双写、不保留 feature flag、不等待历史数据迁移。

## 15. 验证要求

### Gate

- Scope 只通过 Lifecycle 判断资源当前可读性；
- Lifecycle 缺失时 fail closed；
- mutation 使用 canonical resource；
- lock、Gate、write 位于同一 transaction；
- Policy 不读取旧 passport/moderator 形态。

### Lifecycle

- 每个新资源与 initial Lifecycle 同事务创建；
- 不存在 runtime backfill/bootstrap/reconcile；
- transition 只接受已有 Lifecycle；
- Blocker mutation 与 state recompute 原子完成；
- 不从 `stage/pending/is_deleted/is_archived` 推导当前 Lifecycle。

### Community

- 产品只有 Application creation；
- 不存在 `Community.pending`；
- setting_up/active 只来自 Lifecycle；
- fixture 也生成完整新模型。

### Interaction / Governance

- fact 与同步 ReadState 同事务；
- 不存在全库 Audit/Repair Job；
- Report 使用规范化 fact；
- 举报数量和 Sentinel score 不能直接改变资源状态。

## 16. 验收标准

- 运行时代码不存在 Lifecycle backfill、bootstrap 或 standalone reconcile；
- Gate 不读取 `Community.pending`；
- Community/Application/Lifecycle 没有双重状态权威；
- direct Community create 不再是产品入口；
- Article/Doc/Comment Lifecycle 有明确 initial producer；
- Gate mutation 不使用 compatibility `access_check/3`；
- Passport 与 Moderator 各只有一种 canonical fact；
- 缺失 Lifecycle 一律 fail closed；
- 不迁移、不回填、不修复历史数据；
- 每个清理 Phase 完成后旧路径立即删除。
