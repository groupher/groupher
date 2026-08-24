# Post Solution V2：最终收尾与简化评估

> 状态：已完成。本文保留为实施前 review 与验收记录；当前合同以
> [`docs/artiment/post_solution.md`](../artiment/post_solution.md) 为准。

## 实施结果

本清单已全部落地：旧 solution API、历史回填与 Writer 兼容层已删除；
create/reply 已迁移到 canonical `with_check` 链路并保留
`article_comments_locked` 产品错误；并发、批量 projection、required job 两类失败和
空数据库 migration 均有验证。相关公共边界已补齐 `@doc`、示例和准确的 ASCII
`@moduledoc`，最终设计文档已收缩到 `docs/artiment/post_solution.md`。

以下章节是实现前问题快照，用于解释最终改动的原因，不再表示待办状态。

## 0. 前提与结论

本轮收尾采用以下前提：

- 不需要迁移历史 solution 数据；
- 不需要兼容旧的 solution API、错误码或运行逻辑；
- 不为尚不存在的 Comment destroy 产品能力预先建设完整 command；
- 继续以 `CMS.Comments.*` 作为业务公共边界；
- 保留已经证明有明确职责的领域抽象，删除迁移中间态和纯兼容层。

核心方案不需要推倒重来：

```text
CMS.Comments.accept_solution / revoke_solution / delete_comment / update_comment
  -> Comments.Commands.<Action>
  -> Gate.Access.with_check
       -> MutationLock.transact_article
            -> canonical Load + Policy
            -> Command writes + Activity + required job
            -> commit / rollback
  -> optional jobs after commit

Reader
  -> PostSolution + Comment
  -> virtual isSolution / isSolved / solutionCommentId / solutionDigest
```

以下抽象各自拥有清晰职责，不属于过度抽象：

- `AcceptSolution`、`RevokeSolution`、`DeleteComment`、`UpdateComment`；
- `SolutionTransition`，复用 accept、replace、revoke 和 delete reconciliation；
- `Gate.Access.with_check/4`；
- `MutationLock.transact_article/3`；
- 具名 `Jobs.*` facade 和 closed-vocabulary `Jobs.Comments` worker；
- Comment/Post 的批量 Reader projection。

当前复杂度主要来自新旧链路并存、历史兼容代码和实施过程文档，而不是上述核心模型。

## 1. 必须修正的运行时问题

### 1.1 create/reply 仍使用旧的嵌套事务链路

`Comments.Writer.create/reply` 当前仍是：

```text
MutationLock.with_article
  -> Gate.access_check
       -> MutationLock.with_article
       -> transaction
  -> Ecto.Multi
  -> Repo.transaction
```

这条链路有三个问题：

1. 同一 aggregate 重复进入 lock 和 transaction；
2. Gate 重新加载了 canonical Article/Comment，但 Writer 丢弃返回值；
3. callback 继续使用锁外加载的 Article、reply target 和 parent Comment。

第三点不仅是结构冗余，也可能在等待锁期间发生 Post category、Comment parent 或其他 canonical 状态变化后继续使用陈旧数据。

目标链路：

```text
create
  -> Gate.Access.with_check(actor, :create_comment, article, callback)
  -> callback 只使用 canonical Article

reply
  -> Gate.Access.with_check(actor, :reply_comment, target_comment, callback)
  -> 锁内根据 canonical Comment 重新计算 thread、Article 和 root parent
```

迁移后删除：

- create/reply 外层 `MutationLock.with_article`；
- callback 内的 `Gate.access_check`；
- callback 内独立的 `Repo.transaction`；
- 通用 `Decision.primary_error` 和 reply result 的重复归一化样板。

但必须保留 create/reply 对 `article_comments_locked` 的产品错误归一化。当前
`with_check` 的 `normalize_decision` 只返回 `Decision.primary_error/1`，不会将该
Gate 拒绝映射成 Comments 既有的 `article_comments_locked` details。迁移时应在
Comments command/facade 边界保留这一项明确适配，不要重新扩展成 Gate 通用规则。

create/reply 的 required audition 仍在同一 aggregate transaction 中 enqueue；mentions、notification 和 subscription 仍在 commit 后 best-effort enqueue。

### 1.2 soft destroy 目前没有 solution reconciliation

当前 `Comments.Lifecycle.transition(comment_id, :destroy)` 可以直接写 lifecycle，但不会检查或清理 `PostSolution`。

已有测试只覆盖：

```text
Comment 已经 destroy
  -> 后续 accept 被 Gate 拒绝
```

尚未覆盖，也没有实现：

```text
Comment 已经是当前 solution
  -> transition(:destroy)
  -> PostSolution 如何处理
```

当前没有正式的 Comment destroy command，因此 V2 不为它增加新的 speculative abstraction。收尾方案是：

- 当前只承诺 `delete_comment` 的 soft-delete reconciliation；
- 文档不再宣称 soft destroy 已支持；
- `Lifecycle.transition/2` 只作为 command 内部 lifecycle primitive，不作为业务入口；
- 未来真正增加 destroy command 时，再复用 `SolutionTransition.revoke_if_current/5`；
- physical hard delete 继续由 FK cascade 清理关系，但不虚构尚不存在的 Activity/projection contract。

## 2. 删除历史数据与兼容逻辑

### 2.1 migration 不再回填旧 flag

删除 `BackfillAndHardenPostSolutions` 中以下内容：

- 从 `comments.is_solution` 回填 relation 的 CTE；
- visible Comment 排序选择；
- 从 Post author 恢复 `accepted_by_id`；
- migration 前历史审计 SQL；
- provenance、生产数据报告和 relation 差异核验要求。

保留数据库最终约束：

- `post_solutions.post_id` 唯一；
- `post_solutions.comment_id` 唯一；
- `(comment_id, post_id)` 组合外键保证 Comment 属于对应 Post；
- Post/Comment physical delete cascade；
- User delete 对 `accepted_by_id` 使用 `nilify_all`。

具体 migration 形态取决于初始 create migration 是否已经部署：

- 未在任何环境部署：把最终约束合入 `CreatePostSolutions`，删除单独 harden migration；
- 已部署 create migration：保留纯 `HardenPostSolutions` migration，只增加约束，不做数据回填。

`RemoveLegacySolutionProjections` 只负责删除旧数据库字段。其 `down/0` 不需要根据 `PostSolution` 重建历史 projection。

### 2.2 删除旧 solution API

删除以下兼容入口及其测试、schema contract 和生成物：

- `CMS.Comments.mark_comment_solution/2`；
- `CMS.Comments.undo_mark_comment_solution/2`；
- `Comments.Writer.mark_solution/2`；
- `Comments.Writer.undo_mark_solution/2`；
- GraphQL `markCommentSolution`；
- GraphQL `undoMarkCommentSolution`；
- Resolver 对应 alias；
- 测试 helper 中的旧 mutation builder。

最终只保留：

```text
acceptSolution
revokeSolution
```

前端当前没有旧 mutation 的生产调用，因此无需保留双入口。

### 2.3 删除 retired tombstone 和无调用入口

在“不保留历史错误协议”前提下删除：

- `require_questioner` code 4409 reserved tombstone；
- 对应 ErrorCat 测试和文档条目；
- `comment_archive_retired`；
- `CMS.Comments.archive_comments/0`；
- `Comments.Writer.archive_comments/0`；
- 未被 scheduler 配置使用的 `Helper.Scheduler.archive_comments/0`。

删除 `update_user_in_comments_participants/1`：它没有生产调用，只有旧测试直接调用，而且实现只查询 Post，并没有执行函数名所表达的 update。

不在本任务删除仓库级 `Jobs.later/1`。Comments namespace 已不再依赖它，但 Articles、Press 和 Interactions 仍有真实调用；其仓库级淘汰属于独立任务。

## 3. Writer 的残留清理

create/reply 切换到 `with_check` 后，Writer 只保留 creation/reply orchestration 和仍有真实调用的 question projection helper。

删除无调用的 command delegates：

- `update/2`、`update/3`；
- `delete/1`、`delete/2`；
- `mark_solution/2`；
- `undo_mark_solution/2`。

删除旧 Multi 链路遗留的 result clauses：

- `result(%{delete_comment: ...})`；
- `result(%{mark_solution: ...})`；
- `result(%{sync_embed_replies: ...})`。

同时清理不再使用的 alias、ErrorCat adapter 和 `normalize_reply_result` 分支。

## 4. 测试评估

本轮 review 已执行 Comments、Gate、Jobs 和 GraphQL 相关回归测试：

```text
502 tests, 0 failures
```

绿色回归证明现有已覆盖路径没有立即回归，但不等于验收矩阵完整。

### 4.1 已有关键覆盖

- accept 幂等；
- revoke 无 relation 时无副作用；
- revoke 错误 target；
- accept -> replace -> revoke Activity；
- pin 与 solution 独立；
- Post workflow status 不被覆盖；
- 非 QA、非作者和不可写 lifecycle 拒绝；
- delete 当前 solution 原子 revoke；
- delete 非当前 solution 不影响 relation；
- Reader 派生 Comment/Post solution 字段；
- solution 排序不制造 pin；
- 并发 accept 最终只有一个 relation；
- Comment/Post 归属组合约束；
- physical hard delete FK cascade；
- `with_check` callback commit、error rollback、非法返回、raise 和 throw；
- required audition 的数据库 constraint exception rollback；
- optional job 和 read-side repair 失败不劫持业务结果。

### 4.2 仍需补齐

必须新增：

1. create/reply 切换 `with_check` 后，验证 callback 使用 canonical resource；
2. delete 与 accept/replace 并发，验证同一 aggregate lock 串行化；
3. update 当前 solution 与 replace 并发，验证 Reader 不会使用旧 relation；
4. Comment/Post Reader 固定查询数测试，证明列表没有 N+1；
5. required job 的两类失败分别覆盖：
   - 应用层校验失败：让 `Oban.insert` 返回 `{:error, changeset}`，例如构造缺少
     required payload/args 的 job，或通过可控 Oban adapter/mock 注入该结果；
     create/reply/update 必须 rollback，并返回稳定的结构化 domain error；
   - 数据库层失败：保留现有 constraint violation 测试，验证 transaction rollback，
     且 `Ecto.ConstraintError` 按现有异常合同向上传播；
6. 简化 migration 后，从空测试数据库执行完整 migration 的 smoke test。

不新增以下 speculative 测试：

- 不存在的 soft destroy command；
- 不存在的 hard destroy Activity/projection 顺序；
- moderator solution capability；当前合同仍是 author-only。

### 4.3 测试目录收尾

大量旧 `mark/undo_mark` 测试与新的 command 测试重复。收尾时：

- 全部改用 `accept_solution/revoke_solution`；
- 删除重复的旧 Writer solution describe；
- solution transition 测试保留在 `comments/commands/solution_commands_test.exs`；
- update/delete 的 command 专属 edge case 放入与实现文件同名的测试文件；
- GraphQL 只保留 `acceptSolution/revokeSolution` contract 测试。

## 5. `@doc` 与 `@moduledoc` 评估

当前不满足“所有公共函数都有可读注释和示例”。基于编译后的 ExDoc metadata，至少存在：

- `CMS.Comments`：11 个公开 arity 没有 `@doc`；
- `Comments.Writer`：11 个公开函数没有 `@doc`；
- `Comments.List`：8 个公开函数没有 `@doc`；
- `Comments.Lifecycle.ensure_created/1` 没有 `@doc`；
- `Gate.Access.access_check/3`、`with_check/4` 为 `@doc false`；
- `MutationLock.transact_article/3` 为 `@doc false`。

V2 采用以下规则：

- `CMS.Comments.*` 支持的公共 API：必须有完整 `@doc`、返回合同和示例；
- 跨模块使用的核心内部原语，如 `with_check/4`、`transact_article/3`：必须有 `@doc` 和示例，即使不向外部业务开放；
- 只为同一内部模块族服务的 helper，可以保留 `@doc false`，但 moduledoc 必须明确它是 internal primitive；
- 同名不同 arity 分别检查，不能因为 `/2` 有文档就认为 `/3` 已覆盖；
- 不保留“Runs X through boundary”这类没有说明参数、返回和副作用的占位文档。

需要修正的 moduledoc：

1. `Gate.Access` 当前声称自己“不包含 loading、locking、transaction”，但 `with_check` 明确编排这些边界；
2. `Access.Check` 当前声称每个函数都进入 aggregate lock，但 `with_authorized` 要求调用方已经持锁；
3. `Comments.Writer` 不应再描述 compatibility delegates；
4. `CMS.Comments` 应明确 facade、Reader、Command、States、Moderation 的分流；
5. Command、InteractionResponse、PostSolution、Jobs 的现有 moduledoc 和 ASCII flow 可以保留。

现有 `scripts/check-documentation.mjs` 不能完整证明该合同：

- Elixir shared function 检查按函数名去重，没有按 name/arity 检查；
- CMS 子目录中的 exported function 没有完整纳入 shared API 检查；
- `@doc false` 与真正私有 API 的判断没有结合模块边界。

需要先修正文档检查器，再将它作为验收门禁。

## 6. 文档收缩

旧 `docs/todo/post_solution.md` 同时混入：

- 历史问题分析；
- 多阶段迁移计划；
- Ecto transaction 选择过程；
- 历史数据审计 SQL；
- 已完成和未完成的验收项；
- 不存在的未来 destroy contract。

V2 完成后，应将最终 source of truth 收缩并移回：

```text
docs/artiment/post_solution.md
```

最终文档只保留：

1. `PostSolution` 权威事实；
2. accept/replace/revoke/delete 当前流程；
3. Gate、transaction、lock 和 Activity 边界；
4. pin、workflow status、question projection 的独立性；
5. Reader 派生字段与查询约束；
6. required/optional job policy；
7. 当前真实支持的权限与 lifecycle；
8. 测试矩阵。

不再保留 phases、历史回填、兼容期双写、旧 API 名称和已经解决的 Ecto 选型讨论。

## 7. 推荐实施顺序

```text
1. 删除历史回填和旧 API compatibility
2. 将 create/reply 迁移到 with_check canonical callback
3. 删除 Writer delegates、dead clauses、retired APIs 和 tombstone
4. 收口 Lifecycle primitive 与当前 delete/destroy 表述
5. 更新并去重 tests
6. 补并发、N+1、structured job error、migration smoke tests
7. 补齐 @doc/@moduledoc 并修正文档检查器
8. 将本文压缩为最终 docs/artiment/post_solution.md
```

每一步都不得重新引入以下耦合：

- solution 修改普通 pin；
- solution 修改 Post workflow status；
- solution 写 `Comment.is_for_question`；
- Reader 通过 Activity、pin、status、digest 或旧 flag 判断当前 solution；
- callback 内再次调用同一 aggregate 的 `Gate.access_check`；
- optional job enqueue 失败改变已经成功的业务结果。

## 8. 最终验收标准

- `PostSolution` 是当前 solution 的唯一事实源；
- 一篇 Post 最多一个 solution，一条 Comment 最多属于一个 solution relation；
- 数据库保证 relation 中的 Comment 属于对应 Post；
- 只有 `acceptSolution/revokeSolution` 两个 GraphQL mutation；
- Comments namespace 不存在旧 mark/undo alias；
- create/reply/update/delete/accept/revoke 都在同一 canonical aggregate transaction 中完成授权和写入；
- create/reply callback 不使用锁外陈旧 resource；
- delete 当前 solution 原子 revoke；
- 当前不宣称支持 Comment soft destroy command；
- pin、workflow status 和 question projection 与 solution 独立；
- Activity 与 relation 变更同事务；
- required job 失败 rollback，optional job 失败只安全记录；
- Comment/Post Reader 无 N+1，并始终从 relation 与当前 Comment 正文派生字段；
- 没有历史回填、兼容 Resolver、retired ErrorCat tombstone 和无调用 Writer delegate；
- 所有支持的公共函数都有按 arity 独立的 `@doc`、返回合同和示例；
- 所有相关 `@moduledoc` 准确描述实际边界，并包含可读的 ASCII flow；
- 精简后的测试矩阵与实现目录对应，相关回归、并发和 migration smoke tests 全部通过。
