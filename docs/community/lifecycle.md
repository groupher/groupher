# Community Lifecycle

Community Lifecycle 只拥有 Community 自身状态、Blocker 投影、状态转换和并发 guard。Gate V2 的读取与操作准入合同统一记录在 [gate_v2.md](./gate_v2.md)，本文不再定义另一套 Gate facade 或读取绕过入口。

Interaction mutation 对这些能力的消费与当前缺口记录在
[Artiment Interaction V3](../artiment/interaction_v3.md)：Article upvote、emotion、collect 必须通过 Gate
组合 `Lifecycle.can_write/1`，不能因目标曾通过 public read 就继续写 fact/projection。Lifecycle 不拥有
interaction action，也不直接读写 reaction fact。

## 状态权威

```text
setting_up -> active / setup_failed
setup_failed -> setting_up / archived
active / read_only / suspended / archived
  -> active / read_only / suspended / archived / pending_destroy
pending_destroy -> active / read_only / suspended / archived / destroy
destroy -> destroy
```

状态集合：`setting_up`、`setup_failed`、`active`、`read_only`、`suspended`、`archived`、`pending_destroy`、`destroy`。

`archived` 是可恢复的产品归档态；`pending_destroy` 是进入不可逆回收前的等待态；`destroy` 是终态。产品删除通过 `request_destroy -> archived -> pending_destroy -> destroy` 完成，不使用 `deleted`、`scheduled_reclaim` 或 `cancel_reclaim` 作为协议名称。

## 能力与 Gate 的边界

Lifecycle 的能力函数只接收资源和已加载的状态事实，不判断 actor：

```elixir
Lifecycle.can_read(community)
Lifecycle.can_write(community)
Lifecycle.can_manage(community)
Lifecycle.can_destroy(community)
```

它们返回 `{:ok, boolean()} | {:error, reason}`。Owner、moderator、operations 和 Passport 关系由 `CMS.Gate.access_check/3` 组合；public/management 查询由 `CMS.Gate.scope/4` 编译。不要在 Lifecycle 里重新实现 actor policy。

Community 读取矩阵：

| state                         | public | owner management   | moderator management | operations |
| ----------------------------- | ------ | ------------------ | -------------------- | ---------- |
| `setting_up` / `setup_failed` | deny   | allow              | deny                 | allow      |
| `active` / `read_only`        | allow  | allow              | allow                | allow      |
| `suspended` / `archived`      | deny   | allow              | allow                | allow      |
| `pending_destroy`             | deny   | allow during grace | allow during grace   | allow      |
| `destroy`                     | deny   | deny               | deny                 | audit-only |

矩阵的唯一实现入口是 `Communities.Lifecycle.readable_states/1`，Scope、access_check 与测试必须共享它。`destroy` 只能进入 operations/audit 查询，不能经产品 Reader 返回。

## Blocker 与转换

Blocker 是 Lifecycle 的输入事实。每次 Blocker 建立、结束、恢复或回收都必须在同一事务内锁定 Lifecycle、重算状态、写 Audit；禁止直接更新 `state` 或绕过 transition facade。

主要 Blocker：`owner_archive`、`moderation_suspend`、`moderation_archive`、`ops_legal_hold`。`resolve_state/1` 按产品优先级生成 materialized state；回收流程在锁内检查 destroy blockers，终止 active blockers 后才可写入 `destroy`。

Community 命令：

```text
request_destroy / restore / schedule_destroy / cancel_destroy / destroy
```

这些命令的 actor 关系和操作准入由 `CMS.Gate.access_check(actor, action, community)` 负责；Lifecycle 只执行锁内状态转换和版本冲突检查。

Gate 对 Community Lifecycle 的 `FOR SHARE` admission lock 表示当前事务中的时刻性准入；目标资源的
transition 再以 `FOR UPDATE`、allowed transition 和 version guard 保证状态变化。两者不表示一次 Gate
检查永久冻结聚合状态。Interaction 必须在调用 Gate 的同一事务内完成 fact 与 projection 写入，具体
事务形态和测试矩阵见 [Artiment Interaction V3](../artiment/interaction_v3.md) §3、§5。

## 数据和清理

Lifecycle 行必须在 Community 创建时建立。存量数据由一次性 migration 回填；回填和 down 的不可逆决定记录在 [gate_v2.md](./gate_v2.md) §10。

`destroy` 是逻辑终态，不等同于立即物理删除。物理清理、slug 释放、外部通知和保留期由明确的 maintenance/job 流程处理，不能由 Reader 或普通 Writer 直接 `ORM.delete` Community。

## 验收

- 所有状态转换都有 allowed transition、版本 guard 和 Audit。
- Blocker 状态与 materialized Lifecycle state 在同一事务内保持一致。
- public Scope、management Scope、access_check 和测试使用同一状态矩阵。
- Community 不存在 product-level `deleted` 或 `scheduled_reclaim` 状态。
- Gate V2 是所有 actor-aware 读取与操作准入的唯一合同。
