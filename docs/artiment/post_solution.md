# Post Solution：最佳回复关系设计

> 状态：设计草案。本文定义目标事实和迁移原则，不表示 `PostSolution` 已实现。

相关文档：

- [Gate V4：资源级强类型 Context](../community/gate_v4.md)
- [Command：复杂领域操作的组织边界](./command.md)
- [AuditLog 与 ActivityLog](./audit_log.md)

## 1. 背景

Groupher 当前已经支持将 Post 下的一条 Comment 标记为最佳回复。现有操作会：

1. 使用 Comment 的 `:pin` Gate action 检查资源是否可写；
2. 手工检查操作者是否为 Post 作者；
3. 清除同一 Post 下已有的 `Comment.is_solution`；
4. 将目标 Comment 自动置顶；
5. 设置 `Comment.is_solution = true`；
6. 将 Post 状态设置为 `resolved`；
7. 将 Comment 摘要复制到 `Post.solution_digest`。

现有实现具备事务、父资源状态检查、单一最佳回复和摘要同步等基础，但同一个业务事实分散在 Comment flag、PinnedComment、Post status 和 Post digest 中，且“最佳回复”和“置顶”被绑定。

## 2. 核心结论

最佳回复是 Post 与 Comment 之间的独立领域关系：

```text
Post
  -> accepts
Comment
```

它不是普通 Comment update，也不是 PinnedComment，不属于 Interaction fact，也不是 ArticleLifecycle 状态。

目标权威事实为：

```text
PostSolution
  post_id
  comment_id
  accepted_by_id
  accepted_at
```

`post_id` 必须唯一，使一篇 Post 在任意时刻最多只有一条最佳回复。Comment 必须真实属于对应 Post。

`PostSolution` 是窄关系：只保存“哪篇 Post 当前采纳了哪条 Comment”以及采纳责任信息，不复制 Comment 正文，不拥有 Post Lifecycle，也不保存 UI 排序状态。

## 3. 事实源与派生字段

### 3.1 唯一事实源

| 问题 | 权威来源 |
| --- | --- |
| 当前最佳回复是哪条 Comment | `PostSolution.comment_id` |
| 谁采纳了回复 | `PostSolution.accepted_by_id` |
| 何时采纳 | `PostSolution.accepted_at` |
| 最佳回复正文 | `Comment` |
| Comment 是否人工置顶 | `PinnedComment` / pin 状态 |
| 谁何时采纳或撤销过 | `AuditLog` |

不能通过 `Post.status`、`solution_digest` 或最后一条 AuditLog 反推当前最佳回复。

### 3.2 `Comment.is_solution`

目标状态下不再作为持久化事实，可以保留为 Ecto/GraphQL 虚拟字段：

```elixir
field(:is_solution, :boolean, virtual: true, default: false)
```

Comment Reader 在列表查询中关联 `PostSolution`，一次性映射：

```text
post_solutions.comment_id == comments.id
  -> is_solution = true
```

GraphQL 仍可返回 `isSolution`，前端不需要理解 `PostSolution`。列表必须使用 join、preload 或批量查询，禁止为每条 Comment 单独查询一次关系。

### 3.3 `Post.is_solved`

是否已解决由关系是否存在派生：

```text
存在 PostSolution(post_id = post.id) -> is_solved = true
否则                                  -> is_solved = false
```

`is_solved` 可以是 Ecto/GraphQL 虚拟字段。按解决状态筛选时，Scope/Reader 使用 `EXISTS` 或 join 编译 SQL，不需要先将所有 Post 加载到内存。

如果性能证据表明高频列表或统计需要物化，可以增加可重建 projection，但 projection 不是权威事实，必须与 `PostSolution` 在同一 command transaction 内更新，并提供校验或重建路径。

### 3.4 `Post.solution_digest`

最佳回复摘要可由以下链路派生：

```text
Post -> PostSolution -> Comment -> normalized digest
```

目标上可以作为虚拟字段返回：

- Post 详情读取时关联目标 Comment；
- 列表只有确实展示摘要时才关联；
- Search 保存自己的可重建搜索 projection；
- 禁止逐 Post 解析富文本或产生 N+1 查询。

若当前 Feed、Press、Search 或列表对 `Post.solution_digest` 有明确性能依赖，可在迁移期继续将它作为 projection 保留。Comment 内容仍是正文权威，`solution_digest` 必须可重建，不能成为最佳回复关系来源。

### 3.5 `Post.status = resolved`

“已解决”不应覆盖承载其他含义的通用 Post status。目标优先返回虚拟 `is_solved`，由 `PostSolution` 派生。

在移除 `resolved` 前必须盘点当前 status 的完整语义和调用方：

- 如果 status 只表达 solved/unsolved，可由 `PostSolution` 取代；
- 如果 status 同时表达其他业务状态，应将 solved 维度拆开；
- 如果列表性能确需物化，使用语义明确且可重建的 `is_solved` projection，而不是混用通用 status。

### 3.6 `Comment.is_pinned`

保留独立语义：

```text
Solution：作者或被授权者确认哪条回复解决了问题
Pin：管理员希望哪条评论固定展示
```

展示层可以把最佳回复排在前面，但不应通过创建普通 pin 来实现。撤销最佳回复不得取消原有人工置顶。

## 4. 领域操作

建议使用两个明确 action：

```text
:accept_solution
:revoke_solution
```

不能继续借用 `:pin`。Gate policy 至少验证：

- actor 具备采纳或撤销权限；
- Post 属于允许最佳回复的问答类型；
- Comment 属于该 Post；
- Community、Post 和 Comment Lifecycle 允许该操作；
- target 没有被删除或永久销毁。

默认产品规则可以是只有 Post 作者能够采纳；未来若允许 moderator 代为采纳，应扩展这两个 action 的 policy，而不是绕过 Gate 增加 Writer 内判断。

## 5. Command 与事务

采纳不是裸字段更新，而是完整业务操作：

```text
AcceptSolution
  -> 开启事务
  -> 锁定 Post aggregate
  -> 加载目标 Comment
  -> Gate.access_check(actor, :accept_solution, target)
  -> 校验 Comment/Post 归属
  -> insert or replace PostSolution
  -> 同步必要 projection
  -> Audit solution.accepted / solution.replaced
  -> commit
  -> 提交后发送通知、更新搜索
```

撤销同理：

```text
RevokeSolution
  -> 锁定 Post aggregate
  -> Gate.access_check(actor, :revoke_solution, target)
  -> 删除当前 PostSolution
  -> 清理或重建 projection
  -> Audit solution.revoked
  -> commit
```

整个操作必须原子完成。不得开放 `Writer.update(comment, %{is_solution: true})` 或直接插入 `PostSolution` 的业务旁路。

## 6. 并发与完整性

至少需要以下数据库与事务约束：

- `post_id` 唯一，一篇 Post 最多一个 solution；
- `comment_id` 根据产品规则决定是否唯一；通常一条 Comment 只能属于一个 Post，本身已能确定归属；
- 外键或等价 changeset constraint 保证 Post、Comment 存在；
- command 在替换/撤销时锁定所属 Post，避免并发写入产生不可预测覆盖；
- 必须校验 Comment 的 `post_id` 与 `PostSolution.post_id` 一致，单纯两个外键不能证明归属；
- 重复提交应定义为幂等成功或稳定 domain error，不能产生重复 Audit/Notification。

## 7. 读取与前端契约

前端继续消费面向产品的字段，不直接查询关系表：

```graphql
post {
  isSolved
  solutionDigest
  comments {
    entries {
      isSolution
      isPinned
    }
  }
}
```

Reader/Resolver 负责把 `PostSolution` 关联结果映射成虚拟字段。Resolver 只做结果适配，不逐行访问数据库，也不判断权限。

如果需要直接跳转到最佳回复，可额外返回稳定的 `solutionCommentId`；它同样从 `PostSolution` 派生。

## 8. Audit 与 ActivityLog

当前状态查 `PostSolution`，历史责任查 `AuditLog`：

```text
solution.accepted
solution.replaced
solution.revoked
```

建议 metadata 只保存必要的关联信息，例如旧/新 Comment ref；同一次替换通过一个 `operation_ref` 关联事务内记录。

产品 UI 可通过 ActivityLog 显示：

```text
张三在 11:20 将回复 #308 标记为最佳回复
张三在 12:10 将最佳回复从 #308 更换为 #412
```

ActivityLog 是 AuditLog 的受控产品视图，不参与当前 solution 判断。

## 9. 迁移顺序

1. 盘点 `is_solution`、`resolved`、`solution_digest`、pin 的所有读写调用方；
2. 建立 `PostSolution` 和唯一性/归属约束；
3. 建立 accept/revoke Gate action 与完整 command；
4. 将现有最佳回复迁移为 `PostSolution`；
5. Reader 同时读取关系并返回虚拟字段；
6. 切换 GraphQL、Feed、Press、Search 等消费者；
7. 停止写入 `Comment.is_solution` 和不再需要的 Post 状态；
8. 校验关系、投影和历史数据一致性；
9. 删除废弃字段和兼容逻辑。

迁移期间必须明确每个阶段的唯一权威，避免长期双写形成两个事实源。

## 10. 验收标准

- 一篇 Post 在数据库层最多存在一个 PostSolution；
- solution 与 pin 完全独立；
- `isSolution`、`isSolved` 和 `solutionDigest` 可由权威关系/内容派生；
- Comment/Post 列表没有 N+1；
- accept/revoke 使用独立 Gate action；
- 非作者或未授权 moderator 不能操作；
- Community/Post/Comment 不可写时稳定拒绝；
- 并发采纳不会产生两个 solution；
- 替换、撤销和重复请求有明确语义；
- Audit 与业务变更同事务，Notification/Search 只在提交后执行；
- 当前状态不通过 AuditLog 或 ActivityLog 倒推。

