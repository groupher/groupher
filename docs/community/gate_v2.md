# Gate V2：统一读取范围与操作准入

本文是 CMS Gate V2 的通用 Gate API 和准入契约入口，定义 Gate 的公开接口、资源读取边界、mutation 准入边界，以及 Reader、Writer、Lifecycle、Interaction 的职责。Article / Doc 内容版本、DocLifecycle、Trash、Restore 和 Docs Release 的后续边界以 [Gate V3](./gate_v3.md) 为准；Scope Context 的最终 typed 契约以 [Gate V4](./gate_v4.md) 为准。

本文不为旧接口、旧逻辑或旧数据路径设计保留层。当前系统尚未发布，重构按一次性切换处理；代码、测试、文档和调用方必须同时切到本文协议。V3 覆盖本文中与普通 Article Branch / Snapshot、Document Lifecycle 来源和 Docs Release 相关的旧定义，但不覆盖 Gate API、Decision、Community 和 Comment 契约。

相关文档：

- [Community Lifecycle](./lifecycle.md)
- [Membership / Billing 旧链路清理](./membership_billing_legacy_cleanup.md)

## 1. 当前状态

截至 2026-08-15，Gate V2 已经具备以下基础：

- Community、Article、Comment、Document 的 Scope query 实现已建立，并统一通过 `Gate.scope/4` 接收资源专属 typed Scope Context；
- Article Lifecycle、Comment Lifecycle、Community Lifecycle 已分出状态权威；
- Comment 的 Interaction 已由独立模块承载，reaction V2 作为 Gate 的既定下游基线；
- Article、Comment 的主要 mutation 已开始使用锁定后的生命周期事实；
- Community public read 已改为先编译 `Gate.scope` 再执行 Repo；
- Community 产品删除已收敛为 `request_destroy -> archived -> pending_destroy -> destroy`，不再提供顶层 `ORM.delete`；
- Comment 的无 actor mutation、旧 lifecycle preflight 已移除，删除会同步 CommentLifecycle；Comment mutation 已直接使用 `Gate.access_check/3`；
- Content import 会在写入 Doc 时建立 ArticleLifecycle，Embeds.User 已明确支持 atom-key/string-key 输入；
- Article 批量 archive 已改为逐 Lifecycle 锁定并写入 per-resource Audit；它是同步 maintenance command，当前没有需要异步投递的下游 consumer，因此不伪造 outbox；Interaction projection 已修复 embedded-reply 覆盖顶层 preload 的问题；
- Community read policy 已落为显式 `public`、`owner_management`、`moderator_management`、`operations` mode；Scope 与 Community access 共用 Lifecycle 状态矩阵，owner 不再隐式读取 `destroy`；
- Community Reader 已统一为 `fetch`；旧的 `read_for_management`、`public?` 和裸 `exist?` 入口已删除。名字可用性由 `Communities.check_name -> NamePolicy.check` 统一判断格式、保留路由、活跃 claim、冷却和争议占用；它不是 Gate 资源准入。
- GraphQL 的旧状态字段已移向 lifecycle 语义，Article/Comment 测试 fixture 也已同步；
- Membership/Billing 旧链路已清理，本阶段不建立新的 Membership/Billing 领域事实。

Gate V2 的 Gate facade、Reader/Writer 命名、Community/Article/Comment/Document Scope、mutation access_check、Document Trash/Cover 管理边界、Community 写入口以及 GraphQL fixture 已完成一次性切换。V4 已进一步删除 `scope/3`、`access_check/4` 和 raw-map Scope 入口；跨 GraphQL、Press、Dashboard、Widget、Search、Feed 和后台 jobs 的静态禁用项审计也已完成。

## 2. Gate V2 的唯一公开接口

```elixir
Gate.scope(queryable, actor, action, context)
Gate.access_check(actor, action, resource_ref)
```

两条接口是不同执行路径：

```text
Gate.scope
  读取范围编译
  -> 返回带准入条件的 query

Gate.access_check
  单资源操作准入
  -> 内部加载并锁定所需资源
  -> 允许时返回 {:ok, resource}
  -> 拒绝时返回 {:error, %Gate.Decision{}}
```

Gate V2 的公共面是编译期硬约束：除 `scope/4` 和 `access_check/3` 外，`CMS.Gate` 不得暴露任何资源准入 API。

`CMS.Gate.Access`、资源级 `evaluate*`、`decision/4` 和 `Decision.allow/1` 是 Gate 内部实现 seam；它们可被 focused seam tests 覆盖，但不属于业务调用协议。业务代码只能使用 `CMS.Gate.scope` 和 `CMS.Gate.access_check`。

以下名称全部禁止出现在 `CMS.Gate` 公共 facade、业务调用方和 Gate V2 测试协议中：

```text
Gate.can
Gate.check
Gate.decide
Gate.Loader
Comments.Gate
Decision.legacy_result
```

`Gate.Decision` 数据结构本身保留，因为它是 `access_check/3` 的拒绝结果；禁止的是 `decide` 函数和旧错误转换函数。Passport、PublishThrottle、Allow 等旧 Gate delegate 也不得继续挂在 `CMS.Gate` facade 上，应由各自领域边界直接提供。

这不是兼容层清理，而是一次性 API 切换：不增加 alias、不保留旧 arity、不通过 wrapper 延长旧协议生命周期。

### 2.1 Gate.scope

scope 是读取、列表、搜索和公开 projection 的正式入口。参数顺序固定为 queryable-first：

```elixir
queryable
|> Gate.scope(actor, action, context)
```

Scope 只构造 query，不执行数据库查询，也不逐行调用 access_check。

```elixir
query =
  Community
  |> Gate.scope(actor, :read, CMS.Gate.Context.Scope.Community.public())
  |> where([community], community.slug == ^slug or community.aka == ^slug)
  |> preload([:dashboard, :lifecycle])

Repo.one(query)
```

Scope 负责 Community、Article、Comment、Document 的可见性条件、父级 lifecycle 条件、moderation 条件、thread/root schema 条件和 join ownership。

Scope 不负责执行 Repo、读取 Interaction state、修改资源或逐条判断列表结果。

### 2.2 Gate.access_check

access_check 是 mutation 和单资源操作的正式入口。调用方只提供 actor、action 和资源，不知道 Gate 内部的 context loader。

```elixir
Gate.access_check(user, :edit, comment_id)
```

成功：

```elixir
{:ok, comment}
```

返回的资源是本次事务中 Gate 加载和锁定的 canonical resource。Writer 直接使用它，不得重新加载 Comment、Article 或 lifecycle。

拒绝：

```elixir
{:error,
 %Gate.Decision{
   code: :comment_deleted,
   source: :comment_lifecycle,
   action: :edit,
   retryable: false
 }}
```

Decision 只在拒绝时返回。成功不返回 allowed 为 true 的 Decision，而是直接返回需要继续操作的资源。

Gate 内部可以有私有 context loader，但它不是公共 API；业务代码只能调用 access_check。

#### access_check 的演进

旧的设计曾要求 Command Service 先装配 Context，再把已加载资源交给 Gate。V2 改为由 Writer 在自己的事务中调用 access_check，Gate 在同一事务内完成资源加载、Lifecycle 锁定和准入判断，成功后返回本次写入要使用的 canonical resource。

这样做的原因是：

- Gate 对外只保留 scope 和 access_check；
- Writer 不再重复实现 Article、Comment、Community context 装配；
- Context 不再成为业务调用方需要理解的公开协议；
- 加载、锁定、准入和写入处于同一事务；
- Writer 不会在 Gate 通过后重新加载同一资源。

Gate 的加载逻辑现在是 `CMS.Gate.Access` 内的私有 `load_context`；代码和业务调用方不再看到旧 loader/callback facade。业务调用方只传 resource_ref 并消费 access_check 的结果。

## 3. Reader、Writer、Lifecycle、Interaction 的边界

### 3.1 Reader

Reader 是资源读取服务，不是 Gate policy。模块统一使用 Reader 命名，函数使用资源语义：

```text
Communities.Reader.fetch
Articles.Reader.read
Comments.Reader.fetch_comment / one_comment
Assets.Reader.stats / usage / refs
DocTree.Reader.read / read_public / read_draft
```

公共读取流程：

```text
Reader.fetch
  -> 构造 resource query
  -> Gate.scope(actor, action, context)
  -> Repo 执行最终 query
  -> metadata / Interaction enrichment
```

Reader 不应包含 scope_all 形式的公共绕过入口、先 Repo 再 Gate 的后置判断、mutation 锁定 context、写入、状态初始化或 batch maintenance。

任何能返回业务资源的读取都必须明确 actor、action 并经过 Gate。纯 retention、migration、projection maintenance 使用独立 job/query，不冒充 Reader。

### 3.2 Writer

Writer 是 mutation command 和持久化服务：

```text
Communities.Writer
Articles.Writer
Comments.Writer
Assets.Writer
CommunityApplications.Writer
DocCover.Writer
DocTree.Writer
```

Writer 流程：

```text
Writer command
  -> 开启事务并取得必要的资源锁
  -> Gate.access_check(actor, action, resource_ref)
  -> {:ok, resource}
  -> Writer 持久化
  -> Lifecycle transition / Audit / outbox
```

Writer 不应自己查询父 Article、Community lifecycle，不应实现 ensure_mutable，不应在 Gate 通过后重新加载资源，也不应使用隐藏 owner 或旧 Visibility 判断。

通知归 Notifications，作者初始化归 Authors，序列化归 Presenter/Serializer，批处理归 Maintenance/Job。

### 3.3 Lifecycle

Lifecycle 只拥有资源自身状态、状态转换和并发 guard：

```text
CommunityLifecycle
  setting_up / setup_failed / active / read_only / suspended
  archived / pending_destroy / destroy

ArticleLifecycle
  draft_only / published / archived / deleted / destroy

CommentLifecycle
  visible / deleted / destroy
```

Lifecycle 不负责 actor 权限、父资源有效能力组合、Interaction projection 或 public Scope。

#### 3.3.1 Article 的 draft、publish、snapshot 边界

> 本小节的 Article Branch / ArticleSnapshot 设计已被 Gate V3 取代，仅保留历史上下文。当前普通 Article 只使用 Article Core 的 Draft/Public；Doc 的 Branch、Snapshot、Tree 和 Release 以 Gate V3 为准。

Article 的物理版本和逻辑 Lifecycle 不是同一层状态：

```text
Article row
  draft/public stage、branch、版本字段
  -> 表示某个物理工作副本

ArticleLifecycle
  draft_only / published / archived / deleted / destroy
  -> 表示一个逻辑 Article 聚合的可用状态

ArticleSnapshot
  append-only revision history
  -> 不拥有 public visibility，也不执行 Lifecycle transition
```

`CMS.Articles.create/4` 是直接发布入口：它在同一把 Article lock 内先调用 Draft.create（创建物理 draft，并将新 Lifecycle 初始化为 `draft_only`），随后立即执行 publish，将 draft 转为 public、把 Lifecycle 转为 `published`，最后追加 publish Snapshot。只有 `CMS.Articles.create_draft/4` 才会停留在 `draft_only`。

已发布 Article 的再次编辑可以创建 branch-local draft，但 Lifecycle 必须继续保持 `published`；只有 publish 才替换 public 内容。Snapshot checkpoint/restore 只写历史或 draft，不得把“恢复历史版本”误当成“重新发布”。

Trash 的 `TrashedArticle` / `TrashAction` 负责回收站、恢复窗口和保留期；删除流程仍必须同步 `ArticleLifecycle: deleted`，最终回收必须先转为 `destroy`。公共 Reader 的可见性唯一由 Gate + ArticleLifecycle 决定，Trash membership 不得成为第二套 public policy。

### 3.4 Interaction

reaction、upvote、emotion、follow 等 Interaction 由 Interaction 模块负责：

```text
目标资源读取
  -> Gate.scope / Reader
  -> Interaction state projection
```

Interaction 不重新实现 Article、Comment、Community 的可见性 policy，也不恢复旧 ViewerState、reaction legacy count 或旧 reaction Gate。

Interaction mutation 仍必须消费 Gate，而不是把“Interaction 自己拥有 fact/projection”误解为可以
绕过准入。Article 的 upvote、emotion、collect 及撤销路径已接入 `Gate.access_check/3` 和 Article
action matrix；Phase 1 对 Article/Community 不可写状态的 add/remove 一律拒绝，并复用 Gate 返回的
canonical Article。其事务边界、thread metadata 与后续阶段统一记录在
[Artiment Interaction V3](../artiment/interaction_v3.md)。

此外，普通 Scope 的 `policy_mode` 不应把调用方遗漏的 management context 静默解释为 public；public
Reader 和 owner/moderator/operations Reader 必须分别显式选择 mode。`:read_draft` 当前是通过 scoped
query 验证可见性的 authorization-read 例外，不取得 mutation 使用的 Lifecycle `FOR UPDATE` lock；
它不提供 mutation serialization 保证。上述两项应按 Interaction V3 Phase 2 收口，不能由 Interaction
模块自行补一套 policy。

## 4. Mutation 的实际形态

以编辑 Comment 为例：

```elixir
def update(comment_id, body, actor) do
  Repo.transaction(fn ->
    with {:ok, comment} <- Gate.access_check(actor, :edit, comment_id),
         {:ok, payload} <- BodyCodec.parse(body),
         {:ok, updated} <- persist(comment, payload) do
      sync_mentions(updated)
      updated
    else
      {:error, %Gate.Decision{} = decision} ->
        Repo.rollback(decision)
      {:error, reason} ->
        Repo.rollback(reason)
    end
  end)
end
```

职责：

```text
Writer.update
  -> 外层事务

Gate.access_check
  -> Comment、Article、Community 及 Lifecycle 的内部装配
  -> 锁定 mutation 需要的状态
  -> 检查 edit
  -> {:ok, comment} 或 {:error, Decision}

Writer.persist
  -> 使用 Gate 返回的 comment 写入
  -> 处理同一事务内的 mention、metric、Audit/outbox
```

不允许 Writer -> Gate.access_check -> Writer.update -> ensure_mutable 的重复链路，也不允许先 Repo 读取、再 Gate 判断、再重新加载后写入。

所有 mutation 必须明确 action，例如 Article 的 create/edit/publish/archive/restore/delete/create_comment/
upvote/emotion/collect，Comment 的 reply/edit/delete/upvote/emotion/pin/mark_solution，以及 Document 的
edit/move/publish/restore_snapshot/delete。Article interaction 的 add/remove 共用对应 action；Phase 1
默认对不可写 Article 或 Community 的两种 operation 都拒绝。

系统 job 也必须显式传递 system actor 或 management actor，不能通过没有 user 的 overload 跳过 access_check。

## 5. Scope 的结构约束

### 5.1 Queryable-first

唯一调用形式：

```elixir
queryable
|> Gate.scope(actor, action, context)
```

不提供 actor-first、运行时参数猜测或多个含义相同的入口。

### 5.2 Scope query ownership

```text
CommunityChain
  Community
  CommunityLifecycle

Article Scope
  ArticleLifecycle

Comment Scope
  CommentLifecycle
  ArticleLifecycle

Document Scope
  Article
  ArticleLifecycle
  Community
  CommunityLifecycle
```

Scope 组合前必须拒绝冲突 binding。内部函数命名为 reject_conflicting_scope_joins/2：只检查 Gate 准备注入的 alias/schema join 是否已经存在，冲突时返回 scope_binding_conflict；不检查 Community 是否公开，也不检查 actor 权限。

### 5.2.1 Scope context 的职责

Scope 接收的 context 不是一个可以随意塞入资源或权限结果的 map。它只承载 Scope query 无法从 queryable 本身可靠推导的 policy 输入。

```text
Queryable facts
  root schema、既有 join、既有 alias
  -> 用于判断 query 结构和 join ownership

Policy context
  thread、branch、stage、moderation mode 等显式输入
  -> 用于选择正确的 Scope policy

Lifecycle facts
  已加载的 resource/lifecycle
  -> 只在 access_check 的内部事务 context 中使用
```

规则：

1. Scope 优先消费调用方明确提供且 Gate 认可的 policy fact；
2. 缺失的 policy fact 才由 Gate-owned join 补齐；
3. 已存在但 ownership 不明确的 join 不复用，返回 scope_binding_conflict；
4. Scope 不从任意 struct 或任意 context 猜测 actor 权限。

### 5.3 Public read 的单查询边界

```text
构造 query
  -> Gate.scope
  -> 资源过滤、排序、分页
  -> 一次主查询
```

不允许 scope_all -> Repo -> Gate，也不允许对列表结果逐条执行 access_check。

## 6. Decision 和错误契约

Gate.Decision 只表示拒绝原因，不表示成功状态：

```elixir
%Gate.Decision{
  code: :ancestor_article_archived,
  source: :article_lifecycle,
  action: :edit,
  retryable: false,
  actions: []
}
```

Gate 合同：

```elixir
Gate.scope(...)
  # => %Ecto.Query{} | {:error, :scope_binding_conflict | :scope_context_missing | ...}

Gate.access_check(...)
  # => {:ok, resource} | {:error, %Gate.Decision{}}
```

不返回 {:ok, true}、{:ok, false}、{:error, atom} 或成功态 Decision。GraphQL、HTTP、job 等边界可以根据 Decision 生成自己的错误 payload，但 Gate 不维护第二套错误协议。

## 7. Resource policy

### 7.1 Community

CommunityLifecycle 的完整状态集是：

```text
setting_up
setup_failed
active
read_only
suspended
archived
pending_destroy
destroy
```

Community public Scope 对匿名 actor 只允许 active、read_only，并处理尚未物化 lifecycle 时的明确 pending 规则。owner 不能通过无条件 bypass 读取所有状态；公共 read/list 与 owner/moderator 的 management read 必须使用明确的 policy mode。以下矩阵是 Scope、access_check、CommunityLifecycle 和测试共同遵守的验收基线：

| CommunityLifecycle state | anonymous public | owner management          | moderator management      | operations / audit |
| ------------------------ | ---------------- | ------------------------- | ------------------------- | ------------------ |
| `setting_up`             | deny             | allow                     | deny                      | allow              |
| `setup_failed`           | deny             | allow                     | deny                      | allow              |
| `active`                 | allow            | allow                     | allow                     | allow              |
| `read_only`              | allow            | allow                     | allow                     | allow              |
| `suspended`              | deny             | allow                     | allow                     | allow              |
| `archived`               | deny             | allow                     | allow                     | allow              |
| `pending_destroy`        | deny             | allow during grace period | allow during grace period | allow              |
| `destroy`                | deny             | deny                      | deny                      | allow audit-only   |

`operations / audit` 是内部运维模式，只能读取 Lifecycle、Audit 和回收流程所需的管理数据，不代表已销毁 Community 的公共内容仍可通过产品 Reader 返回。`setting_up` / `setup_failed` 对 owner 的可读性属于 onboarding 入口，不能因此放宽匿名或 moderator 的 public read。所有 owner、moderator 和 operations 查询都必须显式选择对应 mode，不得由 actor 身份隐式升级为 unrestricted read。

Community 的产品删除不是 deleted 状态，而是一条可恢复到不可逆的流程：

```text
request_destroy
  -> 建立 owner_archive blocker
  -> archived
  -> recovery window
  -> 检查 reclaim blockers
  -> pending_destroy
  -> destroy
```

restore 只能在 recovery window 内释放 owner_archive blocker；pending_destroy 表示已经进入不可逆 destroy 的等待阶段，仍可在明确的 grace period 内 cancel。`readable_states/1` 把它作为管理态允许读取的状态，前提是 Lifecycle orchestration 保证该状态只存在于 grace window；状态集合本身不做 wall-clock deadline 判断。destroy 会终止 active blockers，并执行最终回收。

Community 的 gate action 使用 request_destroy、restore、schedule_destroy、cancel_destroy、destroy。不要再使用 community_delete、scheduled_reclaim 或 cancel_reclaim 作为产品协议名称。

Community mutation 通过 access_check，不能由 Communities.Writer 自己判断 owner 或 moderator。

### 7.2 Article

Article public Scope 要求 stage 为 public、ArticleLifecycle 为 published 或 archived、Community 公开且 moderation 允许公开。

Article 的 edit、publish、archive、restore、delete 使用 access_check，状态转换最终由 ArticleLifecycle transition 负责并发 guard。`archive` 是不可编辑的公开保留态；V2 不提供隐式 `archived -> published`，Lifecycle 也不再允许该转换。若未来要恢复归档内容，必须新增显式 management action、Decision、审计和事务测试。

### 7.3 Comment

Comment public Scope 要求 CommentLifecycle 不是 destroy、ArticleLifecycle 为 published 或 archived、Community 公开，并满足 moderation 规则。

Comment mutation 必须通过 access_check，不能只加载 Comment 本身。Comment 不镜像父 Article/Community 状态；父级有效能力由 Gate 组合。

### 7.4 Document

> 本矩阵只保留 Gate action 的通用形状。Document 的 Lifecycle 来源、branch context、Trash、Restore 和 Release 语义以 Gate V3 为准：使用 branch-scoped `DocLifecycle`，公共读取锁定 main branch，Dashboard 读取必须显式提供 branch。

Document policy 已落到两条明确 Scope 路径：

| Document action        | actor / mode                               | Scope 或 access_check                                                       | 允许的 DocLifecycle(branch)                                         | 其它边界                                                        |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| public read/list       | anonymous / `public`                       | `Gate.scope(ArticleDocument, actor, action, DocumentScope.public_main())`   | `published`, `archived`                                             | Community 只允许 `active`, `read_only`；过滤 illegal moderation |
| draft read             | owner/moderator/operations management mode | `Gate.scope(..., DocumentScope.draft(editor_branch_id, mode))`              | `draft_only`, `published`, `archived`                               | Community 状态和 actor 关系在 SQL 内约束                        |
| branch/editor read     | 同上                                       | `Articles.Draft` 内部调用 `Gate.scope`                                      | draft branch 的上述状态                                             | 不读已 trash membership                                         |
| edit                   | User                                       | `Gate.access_check(user, :edit, draft)`                                     | `draft_only`, `published`                                           | Writer 使用 canonical Draft                                     |
| move / tree edit       | User 或显式 operations actor               | `Gate.access_check(actor, :manage_docs, community)`                         | Community 必须 writable                                             | Tree revision、event、Audit 同事务                              |
| publish                | User                                       | `Gate.access_check(user, :publish, draft)` + `:manage_docs` Community check | `draft_only`, `published`                                           | 生成 `DocPublishRelease`、`DocSnapshot`、projection             |
| restore snapshot       | User                                       | `Gate.access_check(user, :restore_snapshot, snapshot)`                      | `draft_only`, `published`                                           | `DocSnapshot` 只恢复到 Draft，不直接改 public row               |
| delete / restore trash | User / operations                          | Doc `:delete` / `:restore` access_check                                     | delete 只从 `draft_only`/`published` 开始；restore 只接受 `deleted` | Doc Trash membership 与 DocLifecycle transition 同事务          |
| management read        | owner/moderator/operations                 | explicit `policy_mode`                                                      | 由 mode 状态矩阵决定                                                | 不提供 unscoped `read_all`                                      |

Document 的物理 draft/public stage、branch、DocLifecycle 和 DocTree event 是四个不同事实；任何 publish、restore 或 move 都必须在同一 mutation 事务中分别处理，不能用一个 stage 字段代替生命周期准入。

### 7.5 Membership / Billing

Membership/Billing 不属于当前 Gate V2 实施范围：不创建新的领域事实，不虚构付费内容 EXISTS 条件，不调用外部 Billing，等产品模型确定后另行定义 resource policy。

## 8. 模块和文件命名整理

一次性完成 Read -> Reader、Write -> Writer：

```text
communities/read.ex       -> communities/reader.ex
articles/read.ex          -> articles/reader.ex
comments/read.ex          -> comments/reader.ex
assets/read.ex            -> assets/reader.ex
doc_cover/read.ex         -> doc_cover/reader.ex
doc_tree/read.ex          -> doc_tree/reader.ex
community_applications/read.ex -> community_applications/reader.ex
dashboard/write.ex        -> dashboard/writer.ex

communities/write.ex      -> communities/writer.ex
comments/write.ex         -> comments/writer.ex
assets/write.ex           -> assets/writer.ex
doc_cover/write.ex        -> doc_cover/writer.ex
doc_tree/write.ex         -> doc_tree/writer.ex
community_applications/write.ex -> community_applications/writer.ex
```

模块函数避免重复，例如 Communities.Reader.fetch、Comments.Reader.fetch_comment、DocTree.Reader.read_public，而不是旧的 Read/Write 模块形态。

不属于 Reader/Writer 的函数拆到对应领域模块：通知归 Notifications，作者初始化归 Authors，序列化归 Presenter/Serializer，批处理归 Maintenance/Job。

## 9. 实施计划

### Phase 0：冻结最终合同

1. 将本文的两个 Gate 接口写入 module spec；
2. 删除 can、check、decide、run 的设计和调用；
3. 删除成功态 Decision；
4. 统一失败为 {:error, %Gate.Decision{}}；
5. 明确 Reader、Writer、Lifecycle、Interaction 的 ownership。

### Phase 1：完成 Reader/Writer 命名和公共入口

1. 一次性重命名 Read/Write 文件、模块、alias、测试和文档；
2. 公共 Reader 函数使用资源语义命名（`read`、`read_public`、`read_draft`、`fetch_comment` 等），不再出现模块名与函数名相同的 `Read.read` / `Write.write`；
3. 将 scope_all/read_all 从业务 Reader 入口移除；
4. 删除裸 `exist?` 查询；社区名字可用性统一走 `Communities.check_name/1-2 -> NamePolicy.check/1`，由命名空间 policy 判断，而不是返回数据库是否存在；
5. 将不属于读写服务的函数拆出。

### Phase 2：完成 Scope query

1. Community、Article、Comment、Document 的 public Scope 统一 queryable-first；
2. Community public read 删除后置 Gate 判断；
3. 所有 public list/search/count 使用 Scope；
4. 实现 reject_conflicting_scope_joins/2；
5. 增加 named alias、anonymous join、root mismatch、duplicate lifecycle join 测试；
6. 记录每类 Scope 的最终 SQL 和查询次数。
7. 收敛 Article public visibility 的唯一事实为 `Gate.scope + ArticleLifecycle`；`Trash.not_trashed_scope` 只允许留在 Trash/Retention/明确的 management 查询中。
8. 明确 Community public read 与 owner/moderator management read 的状态矩阵，禁止 owner 分支无条件绕过 Lifecycle。

### Phase 3：完成 access_check

1. 将 Loader 变成 Gate 内部实现；
2. access_check 在当前 mutation 事务内加载和锁定资源；
3. 成功返回 {:ok, canonical_resource}；
4. 拒绝返回 {:error, %Gate.Decision{}}；
5. Writer 只使用返回资源；
6. 删除 Comment ensure_mutable 和无 actor mutation bypass；
7. 删除 Article update 的锁外 lifecycle preflight；
8. 统一 Comment 的 create/reply/edit/delete/upvote/emotion/pin/solution。
9. 将 Community 的 request_destroy、restore、schedule_destroy、cancel_destroy、destroy 收敛到 Lifecycle 流程；移除 Writer 的直接物理删除。
10. 将 Article publish/edit/snapshot restore 的 Gate 加载和检查收敛为同一 mutation transaction 内的一次 canonical access check；不得在 Writer 内重复 Loader/Decision。
11. `archived` 已确定为不可编辑的公开保留态；Lifecycle transition、Gate action、Audit 和测试共享该 action matrix，未来恢复必须另立 management action。

### Phase 4：完成错误和事务边界

1. 删除所有 atom error 的 Gate 外部协议；
2. GraphQL/API/job 各自消费 Decision；
3. access check、Lifecycle transition、write 在同一事务；
4. Audit/outbox 位于对应 mutation transaction 内；
5. 批量 archive 已确定为同步 per-resource Audit；没有异步 consumer 时不创建空 outbox。

### Phase 5：完成 Document policy（已完成）

Document 的 public/draft/branch read、edit、move、publish、restore snapshot、delete、management read 已使用 §7.4 action matrix；Scope 负责 queryable-first 的 stage/DocLifecycle/Community SQL，access_check 负责 mutation 内锁定和 Decision，DocTree event、DocSnapshot、Trash membership 和 Audit 保持各自事实边界。

### Phase 6：跨表面清理和验收

已完成 GraphQL、Press、Dashboard、Widget、Search、Feed 和后台 jobs 的静态审计。旧 Visibility/public helper、裸 Passport owner 判断、旧 CanCan 分支、implicit Gate loading、public scope_all/read_all bypass、can/check/decide/run 以及旧文件和 alias 均已从 Gate V2 业务面移除；Dataloader 的 `CMS.Helper.Loader` 仅保留为 GraphQL association 基础设施，不属于 Gate API。

## 10. Migration data decisions

### 10.1 已删除 Comment 的正文擦除

Lifecycle migration 将已删除 Comment 的 `body` 设为 `NULL`，并以 tombstone 文本写入 `body_html`。这是不可逆的数据删除决策；migration 的 down 只能移除 lifecycle 表，不能恢复原始正文。后续任何 restore 都不得假设原始 `body` 仍可取回。

### 10.2 ArticleLifecycle backfill 的状态判定

ArticleLifecycle backfill 采用固定优先级：已有 TrashedArticle 判定为 deleted；否则只要存在 public head 且任一 public head archived 就判定为 archived；否则存在 public head 判定为 published；其余为 draft_only。

多 public head 同时存在且 archived 与非 archived 混合时，当前决策是按上述优先级静默归为 archived，不生成冲突报告，也不以非零报告阻断切换。若要改成强校验，必须另立 migration 方案，先产出并处理冲突清单。

## 11. 当前剩余工作清单

### 已清零：跨表面静态审计

GraphQL、Press、Dashboard、Widget、Search、Feed 和后台 jobs 已完成最终静态审计；未发现 Gate 旧 API、旧 Visibility/public helper、裸 Passport owner 判断、旧 CanCan 分支、implicit Gate loading 或 public unscoped read。GraphQL Article/Comment read fixture 已删除产品类型中不存在的 `isArchived` / `archivedAt` 字段；Absinthe 编译期拒绝 query 的 51 个同源失败已纳入验证。

Community 读取和命名检查也已完成一次性切换：业务调用只使用 `CMS.Communities.fetch`，operations 读取显式传 `:operations` policy mode；GraphQL 使用 `checkCommunityName`，不再暴露 `isCommunityExist` / `CheckState`。NamePolicy 会先做规范化和格式/保留路由检查，再检查未释放的 application/community/reserved/disputed claim、有效 cooldown 以及 Community 行；数据库唯一约束仍是并发写入的最后防线。

## 12. 验收标准

### API

- Gate 对外只有 scope 和 access_check；
- scope 返回 query，不执行 Repo；
- access_check 返回 {:ok, resource} 或 {:error, %Gate.Decision{}}；
- 没有 `can/check/decide`、`legacy_result` 或 Gate Loader 公共入口；
- 没有 legacy_result 或旧 boolean/error 协议。
- 社区命名检查不属于 Gate；对外返回 `available`、`normalizedSlug` 和可审计的 `reasonCode`，不把“数据库存在”伪装成产品可用性。

### Read

- public read/list/search/count 全部先 Scope 后执行查询；
- 没有无 policy 的 `scope_all/read_all` -> Repo -> Gate；
- 没有列表逐条 access check；
- Reader 不拥有 policy。

### Mutation

- Writer 在事务内调用 access_check；
- Gate 内部完成资源和 lifecycle 装配；
- Writer 使用 Gate 返回的 canonical resource；
- 没有 ensure_mutable 或无 actor bypass；
- Lifecycle transition 是最终并发 guard；
- Audit 与 mutation 同事务；只有存在明确异步 consumer 时才引入同事务 outbox，当前同步 batch archive 不创建空 outbox 记录。

### Scope

- Scope query 有明确 join ownership；
- duplicate alias/schema/anonymous join 返回 scope_binding_conflict；
- Article、Comment、Document 不重复注入 lifecycle join；
- queryable-first 顺序固定。

### 命名

- 资源读取模块使用 Reader；
- 资源写入模块使用 Writer；
- Reader/Writer 内不混入 Presenter、Notification、Maintenance；
- 不存在模块名与函数名重复的 Read.read、Write.write 形态。

### 测试

必须覆盖 Community public read 的 Scope SQL 边界、Community request_destroy 到 destroy 的 lifecycle 流程、Comment access_check 的父级 lifecycle 组合、Article update 的锁内 access check、Content import 的 ArticleLifecycle 建立、Embeds.User 的 atom/string key 输入、Scope duplicate join、Decision 拒绝结构、Writer canonical resource 复用、batch archive per-resource Audit 原子性、Document action matrix，以及 GraphQL、Press、Dashboard、Widget、Search、Feed 的旧入口静态清理。

## 13. 最终心智模型

```text
Read
  Reader.read / Reader.read_public / Reader.fetch_comment
    -> Gate.scope
    -> Repo query
    -> Interaction enrichment

Mutation
  Writer.update / Writer.delete / Writer.publish
    -> transaction / lock
    -> Gate.access_check
         -> internal load + lifecycle checks
         -> {:ok, resource}
            or {:error, Decision}
    -> Writer.persist
    -> Lifecycle transition
    -> Audit / outbox
```

Gate 只回答两类问题：

```text
这批资源应该进入查询结果吗？
这个 actor 现在可以对这个资源执行这个 action 吗？
```

所有读取范围进入 scope，所有单资源操作进入 access_check；其余旧入口和隐式准入都不再属于 Gate V2。
