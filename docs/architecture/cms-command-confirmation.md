# CMS Command Confirmation

> 状态：current。单一 Confirmation 协议已经完成；不兼容历史 Receipt。

本文冻结 `CMS.Command` 的结果恢复、意图身份、隐私与 retention 合同。通用边界见
[CMS Command](./cms-command.md)，实施历史见
[CMS Command Receipt 重构](../migrations/cms-command-receipt-refactor.md)。

## 1. 核心合同

Receipt-backed mutation 只接受以下组合：

```elixir
CMS.Command.execute(command,
  action: &execute_once/1,
  confirmation: Confirmation
)
```

- `action/1` 只在首次 claim 成功时执行；
- `confirmation` 是实现 `operations/0`、`encode/2`、`decode/2` 的 typed codec；
- 不存在 legacy `result` callback；
- Runner 不解释领域 map，不保存 `outcome/result_key/result_payload` 顶层列；
- transport 只看统一的领域成功或 ErrorCat，不感知 executed/recovered。

Action、Confirmation encode 和 Receipt finalize 处于同一事务。任一步失败都回滚 claim 与领域写入。

## 2. Confirmation 所有权

每个 payload 合同由领域 owner 定义。字段合同相同的 operations 可以共用一个 codec，不要求为了目录
对称而复制模块。当前共用 family 包括 Article create/update、Comment 四类写入、collect add/remove、
DocTree tree mutation/trash restore，以及 reaction add/remove。

每个 codec 必须声明闭合 operation 集合，encode 为 JSON-safe map，严格验证 operation tag、schema
version、必需/额外字段和类型，并 decode 为自己的 typed struct。未知版本、损坏 payload 或 struct
mismatch 必须 fail closed。

Confirmation payload 硬上限为 64 KiB。超限或合同不匹配统一成为 `command_invalid_result`，事务不提交。
恢复失败日志只记录 receipt id、operation、payload bytes 等元数据，绝不 inspect payload 内容。

## 3. Receipt schema

当前运行时 schema 只包含：

```text
initiator_type, initiator_key, command_id, command
resource_type, resource_id, intent_params, confirmation
expires_at, identity_expires_at, inserted_at, updated_at
```

唯一约束是 `initiator_type + initiator_key + command_id`。claim 查询依赖该组合键；retention 清理依赖
`expires_at` 与 `identity_expires_at` 索引。

`payload_fingerprint/intent_fingerprint/outcome/result_key/result_payload` 已从目标 schema 删除。历史
migration 文件不可删除或改写。contract migration 清空旧 Receipt 后删除旧列；旧数据不参与新协议恢复，
也不会继续占用 commandId。

## 4. IntentCodec：唯一身份输入

`intent_params` 是参数身份的唯一事实源。运行时不再同时比较 canonical params 与两套 fingerprint。

```text
domain params
  -> operation-specific IntentCodec policy
  -> canonical JSON-safe intent_params
  -> Receipt claim / equality / conflict diff
```

policy 穷举全部受支持 operation；未知 operation 直接返回 invalid command intent。只有明确声明的
非敏感标量可以明文保存，例如 operation、emotion、folder_id、item_id。动态或可能包含作者内容的字段
只保存 `sha256 + encoded bytes` descriptor。

动态属性采用逐字段 digest，因此未来新增 `description`、`content_json` 等名字时，值不会因为漏出
blocklist 而进入数据库；冲突仍能报告变化的顶层字段。IntentCodec 不接受 struct、association 或 preload
状态；map key 规范为 string，keyword list 必须无重复 key，普通 list 保留顺序。

actor 来自认证上下文，不属于 params identity；`actor/actor_id/cur_user/current_user` 不持久化。command
与 target 坐标分别在固定列中，不重复混入 `intent_params`。

## 5. Claim 与冲突语义

```text
INSERT claim
  -> inserted: execute action
  -> unique conflict: SELECT ... FOR UPDATE
       -> row exists: compare identity and retention
       -> row disappeared after lock wait: retry INSERT once
```

最后一条处理事务 A 插入后回滚、事务 B 被唯一键阻塞的竞态。B 等到 A 回滚后看不到行时必须重新 claim，
不能误报 conflict；第二次仍无法解析才返回可重试的 `command_resolution_pending`。

存在 Receipt 时：

- command、target、intent params 相同且 result 未过期：decode Confirmation，不执行 Action；
- 任一 identity 字段不同：`command_id_conflict`，details 只含不同字段名；
- identity 相同但 Confirmation 缺失：`command_result_unavailable`；
- result 已过期、tombstone 有效且 identity 相同：`command_result_expired`；
- result 已过期但 identity 不同：仍为 `command_id_conflict`。

`command_resolution_pending` actions 为 `[:retry, :reconcile]`；`command_result_expired` actions 为
`[:reconcile]`。首次提交后 result builder 无法返回产品结果时，客户端进入 read/reconcile，不得自动换新
commandId 重放写入。

## 6. 两段 retention

结果恢复窗口为 24 小时；identity-only tombstone 为独立、有界的 30 天窗口：

```text
0 .. 24h   identity + Confirmation：可恢复原结果
24h .. 30d identity only：同意图返回 expired，不重新执行
after 30d  Receipt 删除：不再提供该 commandId 的去重承诺
```

tombstone 只守护相同 actor/commandId。客户端换新 commandId 仍可能产生第二次业务写入，所以它是
defense-in-depth，不是永久业务幂等；领域唯一约束仍然必要。

## 7. Result builder 与 projection

Confirmation 只保存恢复所需的非敏感事实：资源 id、branch/revision/version、content hash 等。Article
和 Doc Draft 正文由版本化 snapshot 表重建，不能复制到 Receipt。

Article command result 使用 typed `ArticleResult`，而不是自由形状 map。revision builder 以 Confirmation
的 immutable revision anchor 为根；current operational decoration 属于明确命名的 transport layer。
builder 不伪装 Ecto schema，不实现 `__schema__/1,2` compatibility delegation。

首次执行与恢复都只返回 Confirmation；领域 result builder 在 Receipt transaction 提交后按 immutable
anchor 重建 canonical result。`CommandOutcome` struct 留待后续；当前只接受
`{:ok, confirmation}` 这一种成功形状。

## 8. 外部副作用

Action 事务内只能写领域数据、Audit 与 Outbox intent。禁止直接 HTTP、notify、Webhook、搜索服务、
异步 task 或其他不可回滚副作用。`NoExternalEffectsInCommands` Credo rule 提供静态护栏，Outbox consumer
负责提交后的至少一次投递和消费幂等。

## 9. Schema version 与发布

当前 codec 只写 schema version 1。未来引入 v2 时必须真实演练 N/N-1：先部署可读 v1/v2、仍写 v1 的
reader；全部节点就绪后才切换 v2 writer；rollback window 内不得部署只读 v2 的节点；retention 结束后
才可删除 v1 decoder。

这项未来版本策略不等于兼容本次 legacy Receipt。本次旧数据已由 contract migration 明确清空。

## 10. 可观测性与验收

指标至少覆盖 claim new/recovery/conflict/pending/expired、Confirmation encoded/rejected/bytes/version、
recovery decode/result-builder failure，以及 retention compacted/deleted rows。日志与公共错误不得包含
Confirmation、原始 params 或 digest 前正文。

| 场景                         | 必须结果                                    |
| ---------------------------- | ------------------------------------------- |
| 首次成功                     | Action、Confirmation、Receipt 同事务提交    |
| 相同 commandId/intent retry  | Action 不再执行，返回同一 canonical result  |
| 相同 commandId、不同 intent  | conflict，并返回不同字段名                  |
| 首次事务回滚                 | claim 一起消失，下一请求可重新 claim        |
| insert conflict 后对方回滚   | waiter 重新 INSERT，不产生假 conflict       |
| Confirmation 缺失/损坏/超限  | unavailable 或 invalid result，绝不伪造成功 |
| result 过期、identity 未过期 | expired + reconcile，不重新执行             |
| identity 过期                | Receipt 删除，可按新 claim 正常执行         |
| 新敏感字段名                 | 只保存 digest，不保存值                     |
| 外部 effect                  | 只写 Outbox，retry 不重复创建 intent        |

最小验证包括 format、warnings-as-errors compile、Command/Confirmation/Article recovery focused tests、
完整 backend suite、Credo rule tests、migration 可执行性与文档链接检查。
