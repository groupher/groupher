# 账号物理删除封闭方案

> 2026-11-05，当前工作区已实现并在两个新建私有数据库验收，未发布。此记录取代“仅记录账号删除风险即可”的处理状态；不覆盖早先无 guard 的审计证据，也不代表既有环境已经受保护。

## 1. 当前合同

账号物理删除没有受支持的业务入口。本轮采用数据库拒绝方案，不提供删除、匿名化、特权强删参数或 session bypass：

- `account.users` 的任意现存行，包括没有参与事实的账号，均不可物理 DELETE；ORM、单行/批量 SQL 和父级 FK 级联不能绕过行 guard。
- `TRUNCATE account.users` 由 statement guard 拒绝；测试使用 CASCADE，确认保护不是依赖原 FK 拒绝。
- 两个 trigger 都设为 `ENABLE ALWAYS`，`session_replication_role=replica` 下仍拒绝。
- 统一拒绝使用 SQLSTATE `23514`、constraint `account_users_physical_delete_forbidden`，在级联删除评论、回复和其他参与事实之前失败。WHERE 不匹配任何行的 DELETE 不删除账号，不要求报错。
- 正常资料更新、登录/退出、评论删除及生命周期变化沿用现有流程；Comment delete 不等于 Account delete。

迁移：[20261105234500](../../backend/api/priv/repo/migrations/20261105234500_block_uncontrolled_account_deletion.exs)。现有 CASCADE FK 没有改成新的历史保留政策；在制定受控账号删除合同之前由 guard 封闭其入口。没有回填、历史计数修补或读侧 repair。

## 2. 准入与可观测边界

`SchemaGeneration.schema_fingerprint!` 必须读到以下两个正确绑定、无 WHEN 条件且 ALWAYS enabled 的 trigger，以及对应零参数 trigger 函数正文：

```text
account.users
  BEFORE DELETE ROW       -> account.guard_users_physical_deletion()
  BEFORE TRUNCATE STATEMENT -> account.guard_users_physical_deletion()
```

两个 trigger 的结构、启用模式和函数正文进入批准的 schema SHA。缺失、普通 ENABLE、DISABLE 或函数被替换为放行实现，均不能通过对应准入校验。Release DDL 前/后及生产 API、worker 启动沿用同一 fresh-generation 合同。

这是发布和启动时的校验，不是对运行中所有特权 DDL 的持续监控。数据库所有者主动 DROP TABLE、禁用/移除 trigger 或修改 guard 不属于受支持写路径，也不在本 guard 的保护范围内；本轮没有修改任何实际环境的角色/权限，也没有新增常驻扫描 Job。发布执行人仍须按既有变更控制管理 DDL；拒绝事件可按上述 SQLSTATE/constraint 识别，不通过加长锁超时或吞掉错误伪装为删除成功。

## 3. 验收

[固定源码、SHA 和运行证据](comment-reaction-snapshot-counts-audit/account-delete-guard-20261105T132932Z/manifest.json)。

| 验收                                                                | 结果                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| guard、SchemaGeneration、Snapshot/ShadowSync                        | [31 passed](comment-reaction-snapshot-counts-audit/account-delete-guard-20261105T132932Z/account-delete-guard-tests.log)                                                                 |
| 全部 Accounts、Comments Summary/SharedDoc、production seed、Release | [143 passed](comment-reaction-snapshot-counts-audit/account-delete-guard-20261105T132932Z/account-delete-guard-regression.log)                                                           |
| 新库 bootstrap→迁移→ready                                           | [通过](comment-reaction-snapshot-counts-audit/account-delete-guard-20261105T132932Z/account-delete-guard-cutover.json)；禁用/篡改 guard 和旧指纹拒绝；测试 DDL 回滚后重新验证 ready 成功 |

数字是两组命令的执行数，有重复用例，不代表独立用例合计数。

`accounts/physical_delete_guard_test.exs` 覆盖 Post/Blog/Changelog/Doc 的“被删账号是回复作者”：每次拒绝 DELETE、批量 DELETE、TRUNCATE 后验证 User/Comment 事实仍存在，并比较完整 root 摘要（count、entries、头像、lastReplyAt、repliesRevision）、ArticleStats（count、人数、头像、commentsRevision）、commentsState、搜索指标输入及 `comment.changed` 数量，均不变化。

另覆盖无参与事实账号、ORM delete、replica 模式、同一事务之前的资料写入回滚；正常 Comment delete 对照验证有效回复数降为0、占位仍可访问、root/Article 版本推进、搜索指标输入同步及失效事件增加。外部搜索服务没有启动，此处验证的是权威输入与更新触发，不冒称外部索引内容实测。

TRUNCATE 集成夹具先 `SET CONSTRAINTS ALL IMMEDIATE`，避免 Sandbox 的待提交 owner constraint events 在 guard 前触发 PostgreSQL 55006。断言必须收到本 guard 的23514/具名 constraint，而不能把其他拒绝误算为通过。

Snapshot 和 ProfileViewTracker 的“资料/目标不存在”夹具改为预留但不插入的 sequence ID；未禁用 guard 来继续物理删测试用户，缺失读取合同保留。

## 4. 新指纹与发布剩余项

新批准指纹（仅本地验证）：

```text
fbc51ba8c1750dfd6205d144c79ac6aa2e90af46563fe44a0b9e463d9cacb5ae
```

验证库为 `groupher_user_delete_guard_cutover_20261105`，generation 为 `76896cc8-0cdd-494a-a21c-10c904a81501`。以前的 `dc181...` 和原私有库准入结果保留为历史，不能用于新构建发布；未往既有 ready 库回写新 marker/批准值。

本地已封闭这条未受控删除路径；真实 B5 放行仍要求目标新库应用完整迁移、正确 guard/函数和新 schema SHA、实际发布 owner/DB 身份核验、旧 writer drain、缓存切换及 URL 验收。没有在生产/既有开发库运行本迁移，不能宣称线上 blocker 已解除。

受控账号删除、匿名评论保留或删除事实后的全 aggregate 维护继续留待独立合同，不通过本 guard 默许任何一种产品策略。
