# CMS 资源加载与 Canonical Reload 边界

> 状态：整改合同（Phase 1/2/3 已落地，Phase 4 的 Comment Gate aggregate callback 与首次发布通知 payload 已同步收口）。本文冻结资源从 transport ref 进入 CMS mutation 的加载边界，列出当前偏差与迁移顺序；不改变 Gate、Lifecycle、CMS.Command.Receipt 的既有职责。
>
> 范围：`backend/api` 中 GraphQL middleware/resolver、CMS facade、Command、Gate Access、Lifecycle，以及它们之间传递的 Community、Article、Doc、Comment 和内部状态资源。

相关文档：

- [Backend Rules](../rules/be.md)：后端长期协作规则；
- [CMS Facade 与实现目录收口](./cms-facade-directory.md)：facade、Command、Reader/Writer 的目录与所有权；
- [Gate V2](../feature/gate/v2.md)、[Gate V4](../feature/gate/v4.md)：mutation admission、typed Access Context 与 canonical resource；
- [Command：复杂领域操作的组织边界](../feature/artiment/command.md)：Command、Gate、Lifecycle、Writer 和事务职责；
- [Action Matrix 与 Transition Contract](../feature/lifecycle/transition-contract-improvement.md)：`commandId`、CMS.Command.Receipt、version/revision 与 replay 合同。

## 1. 问题

GraphQL 的 `FrontDesk` middleware 已经把外部 path/ref 解析成领域 struct，部分 Resolver 却立即取出 `.id`，下游 CMS facade 或 Command 再用该 ID 加载同一个资源：

```text
GraphQL path/ref
  -> FrontDesk middleware
  -> %Comment{} / %Post{} / ...
  -> Resolver 降级为 resource.id
  -> CMS facade / Command
  -> owning Reader resource(id)
```

这种链路带来四个问题：

- 同一资源在进入事务前被重复查询；
- “外部标识解析”和“业务动作执行”的所有权重新混入 Command/Writer；
- Resolver、Job 和领域调用方可能得到不同的 not-found/error 行为；
- 代码难以区分无意义的重复读取与锁内必须进行的 canonical reload。

本文解决的重点不是消灭所有二次查询，而是固定每类加载的 owner。

## 2. 冻结规则

### 2.1 Transport ref 只在入口解析一次

外部输入中的 slug、path、hash id、inner id 等 public ref 必须由 transport adapter 调用 `CMS.FrontDesk` 解析。GraphQL 默认由 `GroupherServerWeb.Middleware.FrontDesk` 完成：

```text
external ref/path
  -> FrontDesk
  -> domain resource struct
  -> Resolver / adapter
  -> CMS facade
  -> Command or Writer
```

资源不存在时在该入口直接返回稳定的领域错误，不进入 Command。

GraphQL 以外的同步 transport adapter 如果只有 public ref，也必须先调用 FrontDesk，再进入相同的资源型 CMS facade。不得因为调用方不是 GraphQL，就让 Command 同时承担 ref 解析。

Post-commit effect、Oban Job 和 replay 不属于这里的同步 transport 路径；它们必须携带稳定 identity，并在实际执行时重新加载当前权威资源，具体见 §2.6。

### 2.2 同步 mutation 不得把已解析资源降级为 ID

当 middleware 已经提供 `%Comment{}`、`%Community{}`、`%Post{}`、`%Blog{}`、`%Changelog{}` 或 `%Doc{}` 时，Resolver 必须把 struct 传入 CMS facade：

```elixir
# 接受
CMS.Comments.accept_solution(comment, actor)
CMS.Articles.publish_draft(community, thread, article, actor, opts)

# 拒绝
CMS.Comments.accept_solution(comment.id, actor)
CMS.Articles.publish_draft(community, thread, article.article_hash_id, actor, opts)
```

本规则只约束 `Resolver -> CMS mutation facade -> Command/Writer` 的同步写路径。Reader、list/count、projection 和 association query 可以接收 foreign key 构造集合查询，例如 `paged_comments(thread, article.id, ...)`、`paged_comment_replies(comment.id, ...)`，不得为了表面上的 struct 统一破坏查询合同。

CMS facade 和 Command 的主要 mutation target 应使用资源类型约束，避免重新扩张成 `id | struct` 双协议。没有真实调用方、只在 facade 与 Writer 之间自我转发的 ref overload 视为死协议，应删除而不是保留“以后可能使用”的兼容面。

### 2.3 Gate 锁内 canonical reload 必须保留

入口加载的 struct 只证明目标身份存在，不是可永久用于写入的权威快照。Aggregate Command 必须通过：

```text
Command
  -> Gate.Access.with_check
  -> aggregate transaction + lock
  -> Access.Load
  -> canonical resource + typed Access Context
  -> policy
  -> domain write
```

Gate 在取得 aggregate lock 后重新加载 Lifecycle、父级关系、branch、membership 等可变事实，这是必要的 canonical reload，不属于本文禁止的重复 FrontDesk 加载。

Command/Writer 必须使用 Gate callback 返回的 canonical resource，不得在 Gate 通过后再次按外部 ref 加载同一目标资源。

Gate canonical resource 只保证锁内 authority 事实；其 preload 形状不继承入口 struct。Writer 或统计逻辑需要的 join preload 必须显式补齐，但不能借此重新解析 transport ref。

### 2.4 Lifecycle 只加载自己拥有的状态事实

Lifecycle 不解析 transport ref，也不负责加载普通 Article/Comment 供调用方使用。它可以使用稳定 domain identity 定位并锁定自己拥有的 Lifecycle row：

```elixir
Comments.Lifecycle.transition(comment.id, :deleted)
Articles.Lifecycle.transition(community.id, thread, article.article_hash_id, :deleted)
```

如果 Command 已经持有锁内 canonical Lifecycle struct，应优先调用 struct 版本：

```elixir
Lifecycle.transition(lifecycle, target_state)
```

不得为了形式上统一传 struct，在事务外提前加载 Lifecycle，再用可能过期的 struct 执行转换。Lifecycle transition 仍须自行保证 `FOR UPDATE`、allowed transition、blocker 和 version guard。

### 2.5 关联资源由拥有关系语义的边界加载

Command 收到主要目标 struct 后，仍可加载完成用例所需的关联资源。例如 Comment Command 可以通过 `FrontDesk.article_of(comment)` 解析父级 Article。

但如果 Gate 为授权已经加载了相同父 aggregate，而 Command callback 随后再次查询它，说明 Gate callback 暴露的 canonical 数据不足。应先评估扩展明确的 aggregate callback contract，不能把重复查询永久隐藏在多个 helper 后面。

不得把 Gate 内部 `Context.Access.*` 直接暴露给 Resolver 或普通 CMS 调用方。需要共享父 aggregate 时，应设计稳定的 Gate/Command 内部返回合同，而不是允许调用方构造 Gate Context。

### 2.6 Post-commit/async effect 必须重新加载

Post-commit effect、Oban Job 或其他 durable async consumer 不能把 payload 中解码出的 struct 当成当前权威状态。它们应携带稳定 target identity，在任务实际执行时重新加载：

```text
committed effect/job payload
  -> stable target identity
  -> reload current authority
  -> missing/obsolete policy
  -> effect
```

这种 reload 是跨事务 authority refresh，不是同步 mutation 的重复查询。合法例子包括 `Events.Audition -> Comments.Moderation`、`Events.SubscribeCommunity.comment_parent_article/2`，以及首次发布后的 `Articles.Publish.run_after_publish/2`（private `defp`）→ `Later.run` → `Articles.Writer.notify_admin_new_article/1`。异步 owner 必须定义资源已删除、已归档或不再满足 effect 条件时的行为；例如 Audition 对已清理内容返回成功的 no-op。

## 3. 参数分类

并非所有 ID 参数都是违规。审查 mutation 时按下表分类：

| 参数类型                                 | 入口形态                                   | 下游形态                                   | 结论                                              |
| ---------------------------------------- | ------------------------------------------ | ------------------------------------------ | ------------------------------------------------- |
| Community/Article/Doc/Comment public ref | FrontDesk 解析                             | resource struct                            | 已解析后不得降级为 ID                             |
| 新资源属性                               | typed attrs/input                          | attrs/input                                | 没有可预加载资源，例如 create                     |
| Lifecycle row identity                   | canonical resource 派生                    | stable identity 或 locked Lifecycle struct | 允许 owner 在锁内加载                             |
| DocTree node identity                    | Community + branch/tree context + node ref | branch-scoped identity                     | 需由 DocTree 合同解析，不能脱离 branch 机械预加载 |
| Trash membership/ref                     | transport ref 或 `%TrashedArticle{}`       | struct；replay 可保留 ref fallback         | 资源消失后仍需 CMS.Command.Receipt replay         |
| Receipt result key                       | receipt metadata                           | domain replay reader                       | 仅用于 replay，不是首次资源解析入口               |
| Post-commit/async effect target          | durable payload 中的 stable identity       | 执行时重载当前资源                         | 合法且通常必需，必须定义 missing/obsolete 行为    |
| Ref-loading facade overload              | public ref 或 DB id                        | facade/Writer 内再次解析                   | 无真实消费者时是死协议，应移除而非保留双协议      |

## 4. 当前明确偏差

### 4.1 Comment solution

当前 `accept_solution`、`revoke_solution` 已由 GraphQL FrontDesk middleware 得到 `%Comment{}`，Resolver 却传递 `comment.id`；对应 Command 再执行通用 lookup。

目标：

```elixir
CMS.Comments.accept_solution(%Comment{} = comment, actor)
CMS.Comments.revoke_solution(%Comment{} = comment, actor)

Comments.Solution.accept(comment, actor)
Comments.Solution.revoke(comment, actor)
```

原有 `AcceptSolution`、`RevokeSolution` 和 `SolutionTransition` 没有必要拆成三个模块，现已统一收口为一个 Command 模块：

```text
comments/solution.ex
GroupherServer.CMS.Comments.Solution
  accept/2
  revoke/2
  revoke_if_current/5
```

`accept/2` 和 `revoke/2` 是完整 Command 入口；`current`、`upsert`、`record_accept` 等 relation helper 留作模块私有函数。`DeleteComment` 复用公开的 `revoke_if_current/5`，不再建立额外的 `Comments.Solutions` 或 `SolutionTransition` 模块。

`Solution.accept/2`、`Solution.revoke/2` 现在使用 Gate 的双参数内部 callback 直接取得锁内 canonical Comment 与父 Article（Post），不再执行通用 FrontDesk lookup。Gate 的 Access Context 仍未暴露给 Resolver 或普通 CMS 调用方。

### 4.2 Comment reply

当前 Resolver 已持有 parent `%Comment{}`，却调用 `reply_comment_payload(comment.id, ...)`，`Comments.Writer.reply/4` 再次加载 Comment。

目标是传递 parent Comment，并把带 CMS.Command.Receipt、Gate、多表写入和 post-commit effect 的完整用例收口到 `Comments.Commands.ReplyComment`；Writer 只保留具体持久化。Delete/Update Comment 的 Gate callback 同样接收锁内 canonical parent Article，避免在 callback 内再次调用 `FrontDesk.article_of/1`；replay 分支为重建返回 payload 而重新读取 Article，仍属于 replay reader。

### 4.3 Comment pin/unpin 与 fold/unfold

当前 pin/unpin 在 FrontDesk middleware 后重新传 ID；fold 同时接受 ID/struct，unfold 只接受 ID。

目标是产品 mutation facade 统一接收 `%Comment{}`。底层 Lifecycle 使用 `comment.id` 定位自身状态行不受影响。

Pin/unpin 还需独立确认 Gate admission 与写入是否处于同一个 aggregate transaction；这不是单纯的参数改名。

`fold_comment/unfold_comment` 当前没有线上调用方，现存调用均为测试；report 达到阈值后的折叠走 `Comments.States.fold_for_report/1`，并且已经传入 `%Comment{}`。因此 fold/unfold 的 ID 接口属于内部 API 收口，不需要修改 GraphQL schema 或虚构 Resolver 迁移。

### 4.4 普通 Article Draft update/publish

Post、Blog、Changelog schema 已使用 `FrontDesk` 的 `:article_editor` middleware。原先 `fetch_article_editor` 虽然调用 `CMS.Articles.read_editor/4` 读取 editor head，却只用它计算 `passport_is_owner`，没有把 `article` 写入 Resolver arguments；现已修复为写入 `arguments.article`。

目标首先修复 middleware：

```elixir
arguments
|> Map.put(:article, article)
|> maybe_put_article_passport_is_owner(article, resolution)
```

随后 update/publish Resolver 使用已解析的 `article`，CMS facade 和 Command 接收 `%Post{} | %Blog{} | %Changelog{}`。Publish 仍须在 aggregate lock 内根据 expected Draft/Lifecycle version 重载并校验权威状态。

`fetch_article_editor` 当前只 preload `author: :user`，没有 preload `community`。改为 resource struct 参数后，Command 构造 target key 和进入 aggregate 边界所需的 Community 必须有明确来源：可以继续使用已经由 `:community` middleware 写入的 `arguments.community`，或者由 `fetch_article_editor` 给 Article 补 `community` preload。实现时必须选择一种并写入函数合同，不能隐式读取尚未加载的 `article.community`，否则会触发 `Ecto.Association.NotLoaded`。

`CMS.Articles.read_editor_head/4` 表达“选择编辑页面展示的 Article head”，与富文本编辑器实现无关；原 `read_editor/4` 仅作为兼容别名保留。实现用 `@doc` 冻结行为：

```elixir
@doc """
Reads the Article head shown by the editor.

Returns the current Draft when one exists. For ordinary Article threads,
falls back to the Public head when no Draft exists. Doc reads remain
branch-scoped and do not fall back across branches.
"""
```

### 4.5 Doc Draft update/publish

`CMS.DocTree.update_draft(community, doc_id, ...)` 与 `CMS.Docs.publish_draft(community, doc_id, ...)` 是 Doc 内容 mutation，不应与 DocTree node identity 混为一类。

- GraphQL `update_doc_draft` 现由 `:article_editor` 解析主分支 Doc，并把 `%Doc{}` 传入 `CMS.DocTree`；其他 branch 的显式选择仍需补齐；
- Doc publish 由 branch release 内的 `DocPublisher` 调用；该路径已经持有 `community + branch + doc_id` 的稳定 identity，因此直接调用 `CMS.Docs.publish_draft/4` 的 ID 入口，不为构造一次性 `%Doc{}` 做机械预加载。`Articles.Publish` 会在 branch aggregate lock 内重载 Draft、DocLifecycle 和 branch，这是锁内 canonical reload，不是 transport ref 二次解析；
- 目标是为 Doc draft mutation 建立明确的 branch-aware resource contract，并保留 Draft、DocLifecycle、branch 和 expected version 的锁内重载。GraphQL update 使用 `%Doc{}`；publish facade 当前只保留 `community + doc_id + branch_id` 的 ID 合同，`DocPublisher` 是唯一生产调用方，显式 `branch_id` 仍用于防止跨 branch 发布。未来若新增 GraphQL 直发入口，应在出现真实调用方后重新设计 struct contract，不预留死 overload。

### 4.6 Comment create 的死 ref overload

原先 `CMS.Comments.create_comment(%Community{}, thread, article_ref, ...)` 只转发到
`Comments.Writer.create(%Community{}, thread, article_ref, ...)`，形成两层 `id | struct`
双协议。Writer 的 ref overload 现已移除；兼容性的 facade 入口暂时在 facade 边界通过
`FrontDesk.article/3` 解析一次，再调用 struct 版本，以承接现有服务/测试调用方。待这些
调用方迁移后，应继续删除 facade 的 ref overload，而不能恢复 Writer 内的二次解析。

### 4.7 合法的异步 reload

`Events.Audition` 由 Comments Oban Job 在事务提交后执行。`Comments.Moderation.set_illegal/2`、`unset_illegal/2` 按 Comment ID 重新加载，是异步 authority refresh，应保留，不属于 §4.3 的同步 Resolver 降级。

同类路径包括：

- `Events.SubscribeCommunity.comment_parent_article/2`：异步订阅 effect 执行时重新加载父 Article；
- `Events.Audition -> Comments.Moderation`：重新加载当前 Comment，并把已删除内容视为 no-op；
- `Articles.Publish.run_after_publish/2`（private `defp`）→ `Later.run` → `Articles.Writer.notify_admin_new_article/1`：首次发布成功后的真实 post-commit 链路，任务执行时按 Article ID 重新加载当前资源。

`notify_admin_new_article` 的 authority reload 合法；`Later.run` 现已只携带 `%{target: article_module, id: article_id}`，由任务执行端按身份重载当前资源。旧的完整 struct 形态仍被 Writer 兼容接收，以便处理已入队的历史任务。

### 4.8 暂不机械迁移

以下路径必须先冻结各自 identity/replay 合同：

- DocTree node：需要 Community、branch、tree revision 的组合上下文；
- Trash restore/permanent delete：首次资源可能已消失，相同 command key 仍需 replay；
- Lifecycle `ensure_created/transition`：加载的是其自身状态行，不是 transport 资源解析；
- create command：目标资源尚不存在，只能接收 parent resource 和 typed input。

### 4.9 调用方清单（审查时随迁移项更新）

| 迁移项                       | 同步 transport                                                      | 同步 domain / 内部                                                                                    | post-commit / async                                                          | replay / test-only                                                      |
| ---------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Solution accept/revoke       | `CMS Resolver.accept_solution/revoke_solution` → `CMS.Comments`     | `DeleteComment.revoke_if_current/5` 复用 `Commands.Solution`                                          | 无；Moderation 另属异步合法 reload                                           | `solution_commands_test` 等直接调用 Command/facade                      |
| Comment reply                | `CMS Resolver.reply_comment` → `CMS.Comments.reply_comment_payload` | 同步主入口传 parent Comment；`Comments.Writer.reply` 的 ID adapter 暂保，待调用方迁移后删除           | 创建后的 audition、mention、订阅 effect 按各自 identity 合同执行             | CMS.Command.Receipt replay reader 读取结果；旧 ID adapter 由测试覆盖    |
| Comment pin/fold             | GraphQL pin/unpin；fold/unfold 目前没有线上 Resolver                | `Comments.States` 使用 Gate callback 的 canonical Article                                             | 无                                                                           | `fold_for_report/1` 接收 struct；fold/unfold ID 入口仅兼容测试/内部调用 |
| Article Draft update/publish | Article middleware → `CMS Resolver` → `CMS.Articles`                | Importer/服务调用必须传 Article struct；Publish/Lifecycle 在锁内 canonical reload                     | 首次 publish 的 `notify_admin_new_article` 见 §4.7                           | CMS.Command.Receipt replay 通过 editor/public reader 恢复结果           |
| Doc Draft update/publish     | `update_doc_draft` 的 `:article_editor` middleware → `CMS.DocTree`  | `DocPublisher` 使用 branch-scoped `doc_id` 进入 `CMS.Docs.publish_draft/4`，由 Publish 锁内重载 Draft | Release 后的 tree/cover/history effect 使用 branch identity                  | `DocTree.Commands.Node` replay 保留 branch 参数；release tests 覆盖     |
| Moderation / notifications   | 不属于同步 Resolver mutation                                        | 不应改成同步 FrontDesk reload                                                                         | Audition、SubscribeCommunity、Publish notify 执行时按 stable identity reload | 已完成任务可按 missing/obsolete policy no-op                            |

这张表的用途是区分“入口已加载”“锁内 authority refresh”“异步执行时刷新”与“replay 恢复”，不能把所有调用方都默认成 GraphQL Resolver。

## 5. 目标职责

```text
Transport middleware / adapter
  public ref -> resource，处理 not found

CMS facade
  稳定的资源型领域入口，不执行重复 lookup

Command
  完整用例、CMS.Command.Receipt、Gate、Lifecycle、Audit/Activity、post-commit 编排

Gate Access
  aggregate transaction/lock、canonical reload、typed Access Context、actor/action admission

Lifecycle
  actor-independent state、allowed transition、blocker、version/concurrency guard

Writer / domain owner
  使用 canonical resource 执行具体持久化

CMS.Command.Receipt.Store
  通过 Ecto/Repo 持久化 `cms.command_receipts` 的 claim、finalize、conflict resolution 和 retention
```

`CMS.Command.Receipt.Store` 当前是 PostgreSQL persistence module，不是 Redis/PG 可插拔抽象；它不拥有业务 Command、Gate、Lifecycle 或 Audit。

## 6. 迁移顺序

### Phase 1：Comment 资源入口（已完成主要同步入口）

- accept/revoke solution 改为 `%Comment{}`；
- 原 `AcceptSolution`、`RevokeSolution`、`SolutionTransition` 已合并为 `Comments.Solution`，用 `accept/2`、`revoke/2` 区分动作；
- reply 改为 parent `%Comment{}`，并评估下沉到 `Commands.ReplyComment`；
- pin/unpin 改为 `%Comment{}`；
- fold/unfold 已补齐 struct 入口；现存 GraphQL 之外的 ID 兼容入口待调用方迁移后移除；
- 删除 Writer 层无真实消费者的 Comment create ref overload；facade 兼容入口待调用方迁移后再移除；
- 调用方清单分别列出同步 transport、同步 domain、async、replay 和 test-only caller。

### Phase 2：Article Draft 资源入口（已完成）

- 修复 `fetch_article_editor`，把 editor head 写入 `arguments.article`；
- `read_editor/4` 重命名为 `read_editor_head/4`，并用 `@doc` 明确 Draft/Public fallback 和 Doc branch 行为；
- update/publish Resolver 使用 `article_editor` middleware 提供的 `article`；
- CMS facade/Command 改为接收具体 Article struct；
- 保留锁内 Draft/Lifecycle canonical reload 和 expected version 校验。

### Phase 3：Doc Draft 资源入口（已完成首轮收口）

- 将 Doc draft update/publish 与普通 DocTree node mutation 分开审计；
- 为 GraphQL update 建立 branch-aware Doc target resolution（当前由 `:article_editor` 解析主分支 Doc，并把 struct 传入 `CMS.DocTree`）；
- release 内部保留 `community + branch + doc_id` 的 branch-scoped identity，直接进入 `CMS.Docs.publish_draft/4`；随后由 Publish 的 aggregate lock 做必要的 Draft/DocLifecycle canonical reload，避免机械预加载后再按 ID 重读；
- 调用方清单区分 GraphQL、release orchestration、replay 和 test-only caller。

### Phase 4：Aggregate callback 与事务审计（Comment solution/reply/pin 已完成首轮收口）

- `Commands.Solution.accept/revoke` 已改用 Gate 双参数 callback 取得锁内父 Post，不再使用通用 FrontDesk lookup；
- `DeleteComment`、`UpdateComment`、`ReplyComment` 和 pin/unpin 均使用 Gate 双参数 callback 传回的锁内 canonical parent Article；Delete/Update 的 command replay reader 仍可为恢复结果读取 Article；
- 已为需要父 aggregate 的同步 Comment command 增加内部双参数 callback contract；
- pin/unpin 已接入 `Gate.Access.with_check/4`，准入与写入处于同一 aggregate transaction；
- 不向 Resolver 暴露 Gate Access Context。

### Phase 5：特殊 identity 与异步合同（首次发布通知已完成，其他 effect 按清单推进）

- 单独定义 DocTree node 的 branch-scoped resolution；
- 保留并测试 Trash 缺失资源 replay；
- 统一 Lifecycle identity/locked struct overload 的使用条件。
- 为 post-commit/Oban effect 建立 stable identity、authority reload 和 missing/obsolete policy 白名单。
- `notify_admin_new_article` 已将 durable payload 瘦身为稳定 target identity，同时保留任务执行时的 authority reload；其他 effect 逐项推进。

每个 Phase 应独立提交并进行调用方、测试和文档核对，避免一次机械替换混淆 transport lookup、canonical reload 和 replay lookup。

## 7. 验收清单

- [x] 使用 FrontDesk middleware 的 mutation Resolver 不再把主要目标 struct 降级成 ID（已覆盖 Comment solution/reply/pin/unpin 与 Article draft update/publish）。
- [x] `fetch_article_editor` 将读取到的 editor head 写入 `arguments.article`。
- [x] `read_editor_head/4` 的名称和 `@doc` 准确表达 Draft/Public fallback 与 Doc branch 行为。
- [x] CMS facade/Command 的主要 mutation target 使用明确 struct 类型。
- [ ] public ref 的 not-found 在 adapter/FrontDesk 边界返回。
- [x] 已迁移的 Gate callback 内只使用锁内 canonical resource；未纳入本轮的特殊边界仍需按调用方清单审查。
- [x] 已迁移的同步 mutation 在 Gate 通过后不重新按外部 ref 加载同一目标；保留的兼容 adapter 与 replay reader 例外已在正文标注。
- [x] 已迁移的 Lifecycle 只加载和锁定自己拥有的状态事实。
- [x] 已迁移的 Comment/Article 关联加载没有可证明的同步重复查询；replay/async reload 仍按 §2.6 处理。
- [x] `Commands.Solution` 在 Gate callback 内不重复加载已锁定的父 Post。
- [x] Doc draft update/publish 完整使用 branch-aware target contract，不与 DocTree node identity 混淆（GraphQL update 使用 struct；release publish 有意使用显式 branch-scoped identity，并在锁内 canonical reload）。
- [ ] Comment facade 的 ref overload 已完全移除（Writer 层已移除，兼容 facade 待调用方迁移）。
- [ ] Trash replay 在目标资源消失后仍返回原 command 结果。
- [ ] Post-commit/async effect 保留必要的 authority reload，并覆盖 missing/obsolete 行为（本轮完成 notify，Audition/订阅仍按清单继续核对）。
- [x] `notify_admin_new_article` 的 durable async payload 不保存完整 Ecto struct，只保存完成 effect 所需的稳定 identity；其余 effect 仍按各自迁移合同推进。
- [ ] 不把 `Context.Access.*` 暴露为 CMS facade 参数。
- [ ] focused tests 覆盖 not-found、stale preloaded resource、并发转换、command replay 和 query count。
- [x] `mix compile --warnings-as-errors` 通过。

## 8. Review 检查方式

看到下面的形态时应要求解释或修改：

```elixir
def resolver(_, %{comment: %Comment{} = comment}, resolution) do
  CMS.Comments.some_mutation(comment.id, actor)
end

def execute(comment_id, actor) do
    with {:ok, comment} <- CMS.FrontDesk.comment(comment_id, mode: :internal) do
    # ...
  end
end
```

允许的锁内形态：

```elixir
def execute(%Comment{} = comment, actor) do
  Gate.Access.with_check(actor, :some_action, comment, fn canonical, article ->
    Writer.apply(canonical, article)
  end)
end
```

需要父级 aggregate 时使用这个内部 arity-2 callback；它只把锁内 canonical Comment 和 Article
交给 Command，不把 `Context.Access.*` 传到 Resolver 或公开 facade。

Review 必须先建立调用方清单：同步 transport、同步 domain、post-commit/async、replay、test-only。然后追问这次读取是在：

1. 解析 transport identity；
2. 取得锁内 canonical authority；
3. 加载关联 aggregate；
4. replay 已完成结果；
5. post-commit/async effect 执行时刷新当前 authority。

Reader/list/count/projection 的 foreign-key query 不套用 mutation target struct 规则。如果一次 mutation 读取无法归入前五种 owner，就不应新增该查询。
