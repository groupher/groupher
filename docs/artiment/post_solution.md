# Post Solution：最佳回复关系

> 状态：当前实现合同。本文只描述现行事实源、命令、读取与测试边界，不包含历史数据迁移或旧 API 兼容。

相关文档：

- [Command](./command.md)
- [Activity V1](../activity/v1.md)
- [Gate V4](../community/gate_v4.md)

## 1. 领域事实

最佳回复是 QA Post 与一条 Comment 之间的独立关系：

```text
Post
  -> accepts
Comment
```

唯一事实源是：

```text
PostSolution
  post_id
  comment_id
  accepted_by_id
  accepted_at
```

职责划分：

| 问题                     | 权威来源                             |
| ------------------------ | ------------------------------------ |
| 当前最佳回复             | `PostSolution.comment_id`            |
| 谁在何时采纳             | `accepted_by_id` / `accepted_at`     |
| 回复正文                 | `Comment`                            |
| 人工置顶                 | `PinnedComment`                      |
| Post 工作流              | `Post.status`                        |
| Comment 是否来自 QA Post | `Comment.is_for_question` projection |
| 历史事件                 | Activity V1 `PostLog`                |

不得通过 pin、Post status、摘要、Activity 或旧 Comment flag 倒推当前最佳回复。

## 2. 数据库约束

数据库保证：

- `post_solutions.post_id` 唯一，一篇 Post 最多一个当前 solution；
- `post_solutions.comment_id` 唯一，一条 Comment 最多属于一个 solution relation；
- `(comment_id, post_id)` 组合外键保证 Comment 属于对应 Post；
- Post 或 Comment physical delete 时级联删除 relation；
- User physical delete 时 `accepted_by_id` 置空。

普通业务写入通过 `PostSolution.changeset/2` 要求完整 actor 和时间。数据库允许 actor 后续因 User 删除而变为 `nil`，不表示业务 command 可以创建匿名 relation。

## 3. 公共入口

外部业务只使用：

```elixir
CMS.Comments.accept_solution(comment_id, actor)
CMS.Comments.revoke_solution(comment_id, actor)
CMS.Comments.delete_comment(comment, actor)
CMS.Comments.update_comment(comment, body, actor)
```

GraphQL 只暴露：

```text
acceptSolution
revokeSolution
```

不存在 mark/undo-mark 兼容 alias。Resolver 只适配输入和输出，不直接调用 Gate、Writer 或 `PostSolution`。

## 4. 命令与事务边界

复杂写入遵循同一条链路：

```text
CMS.Comments facade
  -> Comments.Commands.<Action>.execute
  -> Gate.Access.with_check
       -> MutationLock.transact_article
            -> Repo.transact
                 -> advisory xact lock
                 -> canonical Load + Policy
                 -> command callback
            -> commit / rollback
```

`with_check/4` callback：

- 只使用锁内重新加载的 canonical resource；
- 只返回 `{:ok, result}` 或 `{:error, reason}`；
- `{:error, reason}` 回滚完整 transaction；
- 其他返回形态变成稳定的 `unexpected_callback_result`；
- raise、throw、exit 在 rollback 后按原样传播；
- 不得再次调用同一 aggregate 的 `Gate.access_check/3`；
- 不得在 callback 内创建另一个业务 transaction 边界。

create/reply 同样使用 `with_check`。它们不会保留锁外 Article、target Comment 或 root parent 作为写入依据。

Comments facade 保留 `article_comments_locked` 的产品错误适配；该映射不属于 Gate 通用规则。

## 5. Solution transition

`SolutionTransition` 是 transaction/lock 内部的共享领域步骤：

```text
current(Post)
accept(Post, Comment, actor)
revoke(Post, Comment, actor)
revoke_if_current(Post, Comment, actor, operation_ref, occurred_at)
```

### 5.1 Accept

- 无 relation：创建 `PostSolution`，写 `solution_accepted`；
- 同一 Comment 已是 solution：无副作用幂等成功；
- 另一 Comment 是 solution：更新同一 relation，写 `solution_replaced`；
- replacement payload 保存旧 Comment 的公开 ref。

### 5.2 Revoke

- 无 relation：无副作用幂等成功；
- target 是当前 solution：删除 relation，写 `solution_revoked`；
- target 不是当前 solution：返回 `solution_target_mismatch`，relation 不变。

### 5.3 Delete

`delete_comment` 是 soft-delete command：

```text
canonical Comment
  -> 当前 solution 时原子 revoke
  -> 删除独立 pin
  -> Lifecycle :deleted
  -> tombstone body
  -> comments_count
  -> commit
  -> search metrics enqueue
```

删除 Comment 时移除它自己的 pin 属于删除语义，不表示 solution 与 pin 耦合。

当前没有 Comment soft-destroy command。`Lifecycle.transition/2` 是 command 内部 primitive，不是可以绕过 aggregate reconciliation 的业务入口。未来增加 destroy 产品能力时，必须定义自己的 relation、Activity 和 projection 合同。

Physical hard delete 由 FK cascade 清理 relation；当前没有额外的 hard-destroy Activity contract。

## 6. 权限

solution 使用独立 Gate action：

```text
:accept_solution
:revoke_solution
```

当前允许条件：

- actor 已登录；
- Community 和 Post 可写；
- target Comment lifecycle 为 visible；
- Post category 为 QA；
- actor 是 Post 作者；
- Comment 真实属于该 Post。

Community moderator 的 solution capability 尚未接入。当前 moderator 与其他非作者一样稳定返回 `permission_denied`。

## 7. 独立维度

Solution command 不得：

- 创建、删除或修改普通 `PinnedComment`；
- 覆盖 `Post.status`；
- 写 `Comment.is_for_question`；
- 持久化 `Comment.is_solution`；
- 持久化 `Post.solution_digest`。

因此 accept、replace 和 revoke 不会破坏人工 pin 或 Post 的 `wip`、`done` 等工作流状态。

## 8. Reader projection

API 保留前端需要的虚拟字段：

```text
Comment.is_solution
Post.is_solved
Post.solution_comment_id
Post.solution_digest
```

派生链路：

```text
PostSolution.comment_id == Comment.id
  -> Comment.is_solution

Post -> PostSolution -> Comment
  -> is_solved
  -> solution_comment_id = Comment.inner_id
  -> solution_digest = current Comment body digest
```

`solution_comment_id` 使用公开 Comment ref，不泄露数据库 id。Comment 正文更新后无需写 Post projection，后续 Reader 会读取当前正文。

列表使用 join 或批量 relation 查询，一批 Comment/Post 只执行一次 solution relation 查询，禁止逐行查询。

Solution 排序独立于 pin：SQL 在分页前优先当前 solution；第一页合入 pinned Comments 后，再按已 hydrate 的 `is_solution` 保持 solution 位于首位。

## 9. Background job policy

Comments job 使用具名 facade：

```text
Jobs.audition
Jobs.sync_mentions
Jobs.notify_comment
Jobs.notify_reply
Jobs.subscribe_community
Jobs.reconcile_comments_participants
```

必需 job：

- create/reply/update 的 audition 在 aggregate transaction 内 enqueue；
- `{:error, changeset}` 转换为安全稳定的 `required_job_enqueue_failed`，transaction rollback；
- DB constraint exception 不捕获，transaction rollback 后异常向上传播。

可选 job：

- mentions、notification、subscription 在 commit 后 best-effort enqueue；
- participants count repair 在成功读取后 best-effort enqueue；
- error、非法返回、raise、throw、exit 只记录安全分类，不泄露原始值，也不改变业务结果。

Comments namespace 不使用 generic `Jobs.later/1`。仓库其他模块对它的使用不属于本合同。

## 10. Activity

Activity V1 记录：

```text
solution_accepted
solution_replaced
solution_revoked
```

Activity 与 relation 变更在同一 transaction 中。Activity 只表达历史，不参与当前状态判断。

自动 delete reconciliation 至少写 `solution_revoked`。当前不虚构 `comment_deleted` 或 `comment_destroyed` Activity。

## 11. 验证矩阵

测试必须覆盖：

- accept/revoke 幂等和错误 target；
- replacement 旧/新公开 ref；
- pin、workflow status、question projection 独立；
- 非 QA、非作者和不可写 lifecycle；
- delete 当前/非当前 solution；
- accept/replace/delete/update 并发；
- relation 唯一与 Comment/Post 归属约束；
- physical delete cascade；
- callback commit、rollback、非法返回和异常传播；
- required job 应用层 error 与数据库 exception；
- optional job 和 read repair 不劫持业务结果；
- Comment/Post batch projection 固定 relation 查询数；
- GraphQL 只有 accept/revoke contract；
- 从空数据库执行完整 migration。
