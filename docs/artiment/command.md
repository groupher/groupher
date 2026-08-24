# Command：复杂领域操作的组织边界

> 状态：设计原则。本文不引入 Command Bus、DSL 或强制的全仓重构。

相关文档：

- [Gate V2：统一读取范围与操作准入](../community/gate_v2.md)
- [Gate V4：资源级强类型 Context](../community/gate_v4.md)
- [AuditLog 与 ActivityLog](../todo/audit_log.md)
- [Post Solution](./post_solution.md)

## 1. 背景

Groupher 当前使用 Reader/Writer 组织 CMS 读写。Gate V2 已将 Writer 定义为 mutation command 和持久化服务：Writer 开启事务、取得资源锁、调用 `Gate.access_check`、保存资源，并协调 Lifecycle、Audit 和必要的 outbox。

这种结构对简单写入足够直接，但随着业务操作变复杂，一个 Writer 可能同时承担：

- 简单 create/update/delete；
- 多资源加载和锁；
- 专属 Gate action；
- 多表事务；
- Lifecycle transition；
- Audit 和 `operation_ref`；
- 提交后 Notification/Search；
- 底层 changeset 和持久化 helper。

问题不在于函数没有再包一层，而在于一个完整业务动作是否具备明确、不可绕过的入口和事务承诺。

## 2. 什么是 Command

Command 表达一个用户或系统希望完成的完整业务动作：

```text
AcceptSolution
PublishArticle
ArchiveCommunity
ResolveReviewCase
RestoreDocument
```

它的核心承诺是：

> 要么完整业务动作成功，要么权威状态不发生部分改变。

Command 不是：

- 一套必须安装的框架；
- Command Bus；
- 对每个数据库 update 的机械包装；
- 用统一 CRUD 名称抹掉领域 action；
- 绕过现有 CMS facade、Gate 或 Lifecycle 的新入口。

## 3. Command 与 Writer

### 3.1 两者不是天然互斥

一个 Writer 函数只要代表完整业务动作、拥有事务并且是唯一正式入口，本质上已经是 command：

```elixir
Comments.Writer.accept_solution(comment_id, actor)
```

当复杂操作开始让 Writer 膨胀时，可以把用例编排拆成独立模块：

```elixir
Comments.Commands.AcceptSolution.execute(comment_id, actor)
```

CMS facade 对调用方保持领域化接口：

```elixir
CMS.Comments.accept_solution(comment_id, actor)
```

调用方不需要知道内部当前由 Writer 还是独立 Command 实现。

### 3.2 建议边界

```text
CMS facade
  -> 对 GraphQL、job、moderation 暴露稳定领域入口

Command
  -> 编排完整用例、事务、锁、Gate、Audit 和提交后副作用

Writer / persistence helper
  -> 执行 command 内部的具体持久化

Lifecycle
  -> 校验并执行资源状态 transition

Gate
  -> 判断 actor 能否对当前资源执行 action
```

Command 不复制 Gate policy，不直接修改 Lifecycle state，不把 Audit 当状态存储，也不让 Resolver 决定事务步骤。

## 4. 什么时候需要独立 Command

简单 mutation 可以继续留在 Writer：

- 修改一个资源的正文或普通字段；
- 单 changeset、单表写入；
- 没有独立 Lifecycle transition；
- 没有多个必须原子完成的步骤；
- Writer 已能清楚表达完整业务语义。

满足以下任意两到三项时，优先考虑独立 Command：

- 多表或多 aggregate 事务；
- 专属 Gate action；
- Lifecycle transition；
- 需要资源锁或并发版本 guard；
- 必须写 Audit；
- 有 `operation_ref` 贯穿多个模块；
- 提交后需要 Notification、Search 或外部事件；
- 同一业务动作由 GraphQL、job、审核流程等多个入口复用；
- Writer 中已经出现一串可被错误拆开调用的步骤。

不以代码行数作为唯一判断依据。短函数也可能代表关键领域事务，长函数也可能只是机械数据转换。

## 5. 接口约定

Command 模式没有行业强制的 `execute` 接口。常见名称包括：

```text
execute
call
run
perform
```

Groupher 可以约定独立 Command 模块统一使用 `execute`，但这只是项目约定：

```elixir
Comments.Commands.AcceptSolution.execute(comment_id, actor)
```

建议固定的是语义合同，而不只是函数名：

```text
命名       动词 + 领域对象，表达完整业务意图
输入       actor + resource ref + command input
返回       {:ok, result} | {:error, Gate.Decision | domain_error}
事务       command 拥有完整业务事务
准入       command 内调用 Gate 的公开接口
状态       通过 Lifecycle 的公开 transition
审计       权威变更和 Audit 同事务
副作用     事务提交后执行或进入可靠 outbox
幂等       对重试定义稳定结果
```

不要为了统一接口把所有参数塞入无类型 map。复杂输入可以使用 command 专属 input struct，但不能让调用方构造 Gate 内部 Policy Context。

## 6. 一个完整例子：AcceptSolution

错误的裸字段更新：

```elixir
Writer.update(comment, %{is_solution: true})
```

它无法单独表达：

- 操作者是否为 Post 作者；
- Comment 是否属于该 Post；
- 是否已有其他 solution；
- Post/Comment/Community 是否可写；
- 如何处理并发替换；
- 如何同步摘要和 solved projection；
- 如何记录 Audit 和发送通知。

完整 Command：

```text
AcceptSolution.execute(comment_id, actor)
  -> begin transaction
  -> locate and lock Post aggregate
  -> load Comment
  -> Gate.access_check(actor, :accept_solution, comment)
  -> validate Comment belongs to Post
  -> insert/replace PostSolution
  -> update required projections
  -> Audit.record(solution.accepted/replaced, operation_ref)
  -> commit
  -> notify accepted Comment author
```

这在代码形态上确实是“把一系列写操作组织成一个函数”，但它还必须做到：

- 成为唯一正式业务入口；
- 拥有事务和锁；
- 使用明确 Gate action；
- 阻止调用方绕过不变量；
- 给失败、重试和并发定义稳定语义。

只有包装而没有这些承诺，不构成有意义的领域 Command。

## 7. 事务边界

属于同一事务：

- 权威业务事实；
- 必须同步一致的 projection；
- Lifecycle transition；
- AuditLog；
- 用于可靠异步投递的 outbox（仅在有明确 consumer 时）。

通常在提交后执行：

- Notification；
- Search refresh；
- 非权威 analytics；
- 外部 webhook。

不能在事务提交前发送不可撤销的外部通知。也不能为了形式完整，在没有异步 consumer 时创建空 outbox。

## 8. Gate Context 边界

Command 只消费 Gate 的稳定公共接口：

```elixir
Gate.access_check(actor, action, resource)
```

它不能：

- 构造 `ArticlePolicyContext` 或 `CommentPolicyContext`；
- 自行加载父 Lifecycle 复制 policy；
- 调用 Gate 内部 evaluate/decision seam；
- 通过传入 `policy_mode` 暗示管理权限；
- Gate 通过后重新加载同一 canonical resource 再写入。

Policy Context 由 Gate 内部 loader 构造；Scope Context 由 Reader/query caller 使用。Command 不能把两者混合。

## 9. 错误与返回值

错误至少分为：

```text
Gate.Decision
  actor/action/resource 准入拒绝

domain error
  资源归属错误、状态冲突、不变量不满足

conflict/retryable error
  乐观锁、唯一约束竞争、幂等冲突

infrastructure error
  数据库或外部依赖故障
```

Command 不应把所有失败压缩成字符串，也不应把底层 changeset 泄漏为 GraphQL 的不稳定协议。CMS facade/resolver 负责将稳定领域错误适配成 API error。

## 10. 测试方式

Command 测试围绕业务结果，而不是只验证函数被调用：

- authorized actor 成功；
- unauthorized actor 返回稳定 Gate Decision；
- Lifecycle 不可写时拒绝；
- 中间步骤失败时所有权威写入和 Audit 回滚；
- 并发请求不破坏唯一性；
- 重复请求符合幂等合同；
- 提交失败时不发送外部副作用；
- 成功后 Audit、projection 和返回资源一致；
- GraphQL/job 复用同一 facade，不复制 command 步骤。

## 11. 渐进采用

1. 不批量重命名现有 Writer；
2. 从具有真实复杂度的操作开始，例如 AcceptSolution；
3. 先明确领域入口、Gate action、事务和 Audit；
4. 复杂度仍可控则继续留在 Writer；
5. Writer 职责混杂时再提取 `Commands.<Action>`；
6. 多个 Command 出现稳定重复后，才提取极薄的 transaction/after-commit helper；
7. 不引入 Command Bus、通用 DSL 或全局基类作为前置条件。

## 12. 验收标准

- Command 名称表达领域动作，不退化成通用 CRUD；
- 每个复杂操作只有一个正式 CMS facade 入口；
- 事务、锁、Gate、Lifecycle、Audit 和副作用边界明确；
- Writer 与 Command 可以渐进共存；
- Resolver/job 不复制业务步骤；
- Command 不构造 Gate Policy Context；
- 失败、并发、重试和幂等有测试合同；
- 没有为了模式而引入 Command Bus、DSL 或全仓机械重构。
