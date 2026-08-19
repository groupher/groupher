# Gate V4：资源级强类型 Context

本文定义 Gate V4 的 Access Context、Scope Context 类型契约和迁移边界。V4 是 Gate V2/V3 已有能力之上的类型收口，不改变 Gate 的公开职责、Lifecycle 状态机、Interaction ownership、资源锁或已定义的业务 action 语义；Comment 跨 thread 公共查询当前错误地把 Doc Comment 送入普通 ArticleLifecycle fallback，V4 会显式修复这一实现错误。

相关文档：

- [Gate V2：统一读取范围与操作准入](./gate_v2.md)
- [Gate V3：Article Core 与 Doc Release 边界](./gate_v3.md)
- [Community Lifecycle](./lifecycle.md)

## 0. 实施状态（2026-08-17）

V4 本轮阶段已在当前代码中完成：

- Phase 0：`read_draft` 已从 Access 移到一次 scoped fetch，删除 `Gate.access_check/4`；
- Phase 1：Community、Article、Doc、Comment 已使用资源专属 Access Context，Access.Load、Access.Policy 和 Scope.Policy 边界已建立；
- Phase 2：Community、Article、Doc、Comment、Document 已使用资源专属 Scope Context，`Gate.scope/3` 与 raw-map Scope 已删除；
- Phase 3：Enable、Passport、CommunityChain、RateLimit.Publish 的 ownership 和命名已收口，旧 Gate 兼容模块已移除；
- Phase 4：Gate focused tests、真实 Reader/Doc Release 链路、按 ownership 拆分的 Gate 测试和编译期残留扫描已通过。
- Phase 5：`Gate.Access` 已收敛为内部 facade，访问检查由 `Access.Check.article/comment/community` 按资源编排；`Access.Load`、`Access.Policy` 和 Gate Decision 边界已收口，Gate 模块和 typed Context constructor 文档已补齐。

以下阶段章节保留为迁移决策与验收记录；其中“当前”描述指 V4 实施前状态。

## 1. 结论

Gate 当前有三条执行路径，其中 `read_draft` 仍是需要在 V4 收口的过渡路径：

```text
Gate.access_check(actor, action, resource)
  -> Gate 内部加载并锁定资源事实到无结构 map
  -> evaluate / evaluate_result / decision
  -> 返回 canonical resource 或 Gate.Decision

Gate.access_check(actor, :read_draft, resource, raw_map)
  -> 在资源已经加载后重新调用 Scope
  -> Repo.exists? 执行第二次授权查询

Gate.scope(queryable, actor, action, raw_map)
  -> 调用方通过 raw map 声明读取意图
  -> 各资源 Scope compiler 分散校验 map 字段
  -> 返回带准入条件的 Ecto.Query
```

V4 的目标是删除 `read_draft` Access 旁路，并将剩余两条路径中的无结构 map 收敛为两类不同的强类型数据：

```text
Gate.access_check(actor, action, resource)
  -> 加载并锁定资源事实
  -> 构造资源专属 Access Context
  -> check_access
  -> 返回 canonical resource 或 Gate.Decision

Gate.scope(queryable, actor, action, scope_context)
  -> 校验资源专属 Scope Context
  -> resource compiler
  -> 返回带准入条件的 Ecto.Query
```

- `Gate.Context.Access.*`：mutation admission 的内部权威事实集合；
- `Gate.Context.Scope.*`：query compilation 的显式读取意图。

二者不能合并为通用的参数袋，也不能通过一个带大量 optional field 的 struct 同时承载 Community、Article、Doc 和 Comment。

## 2. V4 不改变什么

V4 不改变 Gate 对 read scope 和 mutation admission 的 ownership，收口 V3 留下的两个过渡入口。V4 实施前 facade 曾暴露 `scope/3-4` 和仅供 `read_draft` 使用的 `access_check/4`；当前公开接口为：

```elixir
Gate.scope(queryable, actor, action, scope_context)
Gate.access_check(actor, action, resource)
```

`Gate.access_check/4` 不保留。`read_draft` 是读取行为，应在原始读取查询中使用 typed Scope Context 完成一次 scoped fetch，而不是在资源加载后通过 Access 再执行一次 `Scope + Repo.exists?`。

V4 在这一点上显式 supersede V3 的 `Gate.access_check(actor, :read_draft, draft)` 契约：`:read_draft` action 本身保留，但只属于 `Gate.scope/4`、Article Scope 和 Doc Scope，不再属于 Access action matrix。

`Gate.scope/3` 也不保留。它只能补一个无资源类型的 public map，无法可靠表达 Article thread、Doc branch、Document parent thread 或 Comment thread。现有调用方必须改为传入资源专属 Scope Context，V4 完成后的 read facade 只有 `Gate.scope/4`。

V4 不改变以下 ownership：

| 模块                    | 继续负责                                | 不负责                         |
| ----------------------- | --------------------------------------- | ------------------------------ |
| Gate                    | 读取范围和单资源操作准入                | 保存业务资源、拥有生命周期状态 |
| Lifecycle               | 资源当前状态及合法 transition           | actor 权限、Interaction 计数   |
| Writer / domain command | 完整业务事务和持久化                    | 自行复制 Gate policy           |
| Interaction             | reaction 事实、计数和 viewer projection | 资源权限、审核结论             |
| Audit                   | append-only 责任历史                    | 当前业务状态                   |

V4 也不要求业务调用方认识 Gate 内部如何加载 Community、Lifecycle 或 DocBranch。

## 3. Access Context

### 3.1 定位

Access Context 是 Gate 完成资源加载、锁定和 identity 校验后，交给资源 policy 的内部权威事实快照。

它回答：

> 针对这一个已经定位的资源，判断该 action 所需的权威事实是否完整？

它不回答：

- 调用方想查询 public 还是 management 数据；
- Writer 下一步要保存哪些字段；
- 当前操作是否已经发生；
- UI 应显示什么文案。

### 3.2 资源专属类型

目标类型至少包括：

```elixir
%Gate.Context.Access.Community{
  community: community,
  community_lifecycle: community_lifecycle
}
```

```elixir
%Gate.Context.Access.Article{
  article: article,
  article_lifecycle: article_lifecycle,
  community: community,
  community_lifecycle: community_lifecycle
}
```

```elixir
%Gate.Context.Access.Doc{
  doc: doc,
  doc_lifecycle: doc_lifecycle,
  doc_branch: doc_branch,
  community: community,
  community_lifecycle: community_lifecycle
}
```

```elixir
%Gate.Context.Access.Comment{
  comment: comment,
  comment_lifecycle: comment_lifecycle,
  article: article,
  article_lifecycle: article_lifecycle,
  community: community,
  community_lifecycle: community_lifecycle
}
```

Access Context 必须按资源区分。Doc 的 branch-scoped Lifecycle 和普通 Article Lifecycle 不是同一种事实，因此 Doc 使用独立 Context。

### 3.3 actor 不进入 Access Context

policy 准入接口已经显式接收 actor：

```elixir
check_access(actor, action, resource, access_context)
```

`actor` 不应再次存入 Access Context，否则会产生两个可能不一致的身份来源。Policy 只能使用显式参数中的 actor。

### 3.4 policy_mode 不进入 Access Context

`policy_mode` 表达 public、owner management、moderator management 或 operations 等读取意图，属于 Scope Context。

mutation admission 由以下事实决定：

- actor；
- action；
- resource；
- resource/ancestor Lifecycle；
- ownership、role、blocker 等 policy 所需事实。

调用方不能通过传入 `policy_mode: :owner_management` 暗示自己拥有管理权限。若某个 management command 需要特殊权限，应使用明确的 domain action，并由 Gate 根据 actor 和资源事实判断。

### 3.5 Access Context 由 Gate 内部构造

业务代码仍然只调用：

```elixir
Gate.access_check(actor, action, resource)
```

V4 实施前的 `Gate.access_check(actor, :read_draft, resource, raw_map)` 是待删除的兼容入口，不属于 V4 Access Context 协议。对应 Reader 现在在加载 Draft 时调用 `Gate.scope/4`。

以下接口不得成为公共协议：

```elixir
Gate.access_check(actor, action, resource, %Gate.Context.Access.Article{})
Gate.load_context(resource)
Writer.build_access_context(...)
Resolver.build_access_context(...)
```

`CMS.Gate.Access` 只作为内部入口 facade，根据 resource dispatch 到对应的
`Gate.Access.Check.article/comment/community`。Check flow 再调用对应的 `Gate.Access.Load.*`。
`Access.Load` 负责：

1. 确认资源与父资源身份一致；
2. 在既有锁边界内加载 canonical resource；
3. 加载并锁定所需 Lifecycle；
4. 对 Doc 加载正确 branch；
5. 构造对应资源的 Access Context；
6. 将 Context 交给对应 policy。

强类型化不能恢复 V2 已淘汰的“Writer 先装配授权事实，再交给 Gate”模式。

### 3.6 完整性与 fail closed

Access Context 的 required field 必须真实存在。以下情况统一拒绝，不允许使用默认值补齐：

- Article 缺少 ArticleLifecycle；
- Comment 缺少 CommentLifecycle 或父 Article；
- Comment 的 `community_id`、`article_hash_id` 或 `thread` 与父 Article 链不一致；
- Doc 缺少 DocBranch 或 branch-scoped DocLifecycle；
- resource 的 `community_id` 与加载到的 Community 不一致；
- `Gate.access_check/3` 收到 raw map 或非 Community/Comment/Article struct。

三类资源错误必须区分：不支持的输入类型返回 `unsupported_resource`；支持的资源
类型查不到 canonical row 返回 `resource_not_found`；输入 struct 与数据库或父链身份
不一致返回 `gate_resource_mismatch`。不得再把任意非 Community/Comment 值兜底交给
Article 检查，也不得让 pattern mismatch 泄漏为 `FunctionClauseError`。

- Access Context 类型与 policy 资源类型不一致。

错误继续转换为 `Gate.Decision`；Context struct 本身不承载用户可见错误文案。

## 4. Scope Context

### 4.1 定位

Scope Context 是调用方对读取目的的显式声明，由 Scope compiler 校验并编译成 SQL 条件。

它与 Access Context 的关键区别是：

|                            | Access Context            | Scope Context                                 |
| -------------------------- | ------------------------- | --------------------------------------------- |
| 用途                       | 单资源 mutation admission | 列表、详情和搜索范围编译                      |
| 构造者                     | Gate 内部 loader          | Reader / query caller                         |
| 内容                       | 已加载的权威资源事实      | stage、thread、branch、policy mode 等读取意图 |
| 是否包含 Ecto schema 实体  | 是                        | 通常否                                        |
| 是否允许调用方声明管理身份 | 否                        | 只能声明 mode，Scope 仍校验 actor             |

### 4.2 目标类型

```elixir
%Gate.Context.Scope.Community{
  policy_mode: :public
}
```

```elixir
%Gate.Context.Scope.Article{
  thread: :post,
  stage: :public,
  policy_mode: :public
}
```

```elixir
%Gate.Context.Scope.Doc{
  stage: :public,
  branch_policy: :main,
  policy_mode: :public
}
```

```elixir
%Gate.Context.Scope.Comment{
  thread: :doc,
  branch_policy: :main,
  policy_mode: :public
}
```

```elixir
%Gate.Context.Scope.Document{
  thread: :doc,
  stage: :public,
  branch_policy: :main,
  policy_mode: :public
}
```

Article、Doc Scope Context 的 `include_illegal` 是 moderation diagnostic 专用的
Scope-only 投影开关：为 `true` 时保留 `pending: :illegal` 内容，默认仍按 public
读取规则排除。它不改变 Lifecycle、`policy_mode`、actor 权限或 Access Context，且
不能出现在 Community、Comment、Document Context 中。

不同 Scope Context 只开放本资源真正支持的字段和枚举值。不能为了复用而让 Community Context 接受 `branch_id`，也不能让普通 Article Context 接受 Doc 专属 branch policy。

Doc 和 Document 使用显式 branch selector：

- `branch_id` 与 `branch_policy` 不能同时存在；
- `branch_policy` 当前唯一合法值为 `:main`；
- Draft read 必须使用 `branch_id`；
- 单 Community public read 可以使用 `branch_id`，query 仍断言该 branch 为 main；
- 跨 Community public 聚合使用 `branch_policy: :main`。

Comment Context 不提供隐式 thread 缺省。单 thread 查询必须显式传入 `thread`；Doc Comment public read 还必须使用 `branch_policy: :main`。`branch_policy` 只允许与 `thread: :doc` 组合，`thread: :post` 等普通 Article thread 搭配任何 branch selector 都必须 fail closed。Comment 暂不支持任意 `branch_id`，因为当前 Comment read model 只定义 official main Doc branch 的公共读取。

跨 thread 的公共 Comment 查询必须使用显式的 `Context.Scope.Comment.all_public()`，由 compiler 分别处理普通 ArticleLifecycle 与 main DocBranch/DocLifecycle。该入口会修复当前 `%{}` 走普通 ArticleLifecycle fallback、导致 Doc Comment 无法进入公共聚合结果的实现错误，因此是明确的 correctness fix，不是对现状查询结果的机械保持。不得把空 Context 或 `thread: nil` 解释成 all-thread，也不得继续使用普通 ArticleLifecycle fallback 代替 Doc policy。

### 4.3 mode 不是权限凭证

调用方传入 `policy_mode: :owner_management` 只是在声明“需要 owner management 读取语义”。Scope compiler 仍必须验证 actor 确实是 owner；不能因为 mode 的值而提升 actor 权限。

public、owner、moderator 和 operations 都必须显式选择，不根据 actor 身份自动升级读取范围。

### 4.4 Scope Context 的构造和读取

Reader 可以构造 Scope Context，但优先通过资源 Context 模块提供的明确 constructor，而不是在业务代码中任意组合 struct 字段：

```elixir
Context.Scope.Article.public(:post)
Context.Scope.Article.draft(:post, :owner_management)
Context.Scope.Doc.public_main()
Context.Scope.Doc.public_branch(branch_id)
Context.Scope.Doc.draft(branch_id, :owner_management)
Context.Scope.Comment.for_thread(:post)
Context.Scope.Comment.for_thread(:doc, branch_policy: :main)
Context.Scope.Comment.all_public()
Context.Scope.Document.public_main()
Context.Scope.Document.public_branch(branch_id)
Context.Scope.Document.draft(branch_id, :owner_management)
```

constructor 负责拒绝 `stage: :draft` 配合 `policy_mode: :public` 等非法组合。`Gate.scope/4` 和资源 compiler 通过 struct pattern 直接读取 Scope Context，不增加通用 getter 或把 Context 转回 map。

Access Context 不提供对应的公共 constructor；它只能由 `Gate.Access.Load.*` 根据数据库权威事实构造。

`Gate.Context.Scope` 和 `Gate.Context.Access` 是 union type 模块，不定义通用 struct：

```elixir
defmodule Gate.Context.Scope do
  @type t ::
          Community.t()
          | Article.t()
          | Doc.t()
          | Comment.t()
          | Document.t()
end

defmodule Gate.Context.Access do
  @type t :: Community.t() | Article.t() | Doc.t() | Comment.t()
end
```

因此 `Gate.Context.Scope.t()` 表示五种资源 Scope Context 的联合类型，不表示 `%Gate.Context.Scope{}`。

## 5. 命名与模块边界

`Gate.Context.Access` 和 `Gate.Context.Scope` 是两类强类型数据的 union type 模块，
不定义 `%Gate.Context{}` 通用 struct。不存在空的 `Gate.Context` 父模块。逻辑结构为：

```text
CMS.Gate
├── Context.Access
│   ├── Community
│   ├── Article
│   ├── Doc
│   └── Comment
└── Context.Scope
    ├── Community
    ├── Article
    ├── Doc
    ├── Comment
    └── Document
```

代码中的完整模块名分别是 `Gate.Context.Access.*` 和 `Gate.Context.Scope.*`。Access Context 承载 Gate 加载的权威事实；Scope Context 承载 Reader 声明的读取意图。

## 6. 迁移方案

### Phase 0：最小 Scope Context 与 read_draft Access 旁路收口

1. 先定义最小可用的 `Gate.Context.Scope.Article`、`Gate.Context.Scope.Doc` 及其 `draft` constructor；
2. 让 `Gate.scope/4` 和 Article/Doc compiler 接受这两种 typed Context；尚未迁移的调用方暂时继续走现有 raw map 透传路径，Phase 0 不负责把 map 转换为 typed Context；
3. 将 `Articles.read_draft` 收口为通过 `Gate.scope/4` 构造原始 Draft 查询；
4. 普通 Article 使用 `Gate.Context.Scope.Article.draft/2`，Doc 使用 `Gate.Context.Scope.Doc.draft/2`；
5. 在 scoped query 上追加 logical id、branch 等资源定位条件后执行一次 `Repo.one`；
6. 删除 `Gate.access_check/4`、`Access.access_check/4` 和 `Access.access_check/3` 的 `:read_draft` 特例；
7. 从 Access action matrix 删除 `:read_draft`，同时保留 Scope Article/Doc compiler 的 `:read_draft` action；
8. 增加 query-count 测试，证明 Draft read 不再执行“先加载、再 `Repo.exists?`”的第二次授权查询；
9. 同步更新 `gate_v3.md` 的 Draft read 契约、调用图和验收项，明确旧 Access 契约已被 V4 supersede。

`read_draft` 不得改为 caller 构造 Access Context，也不得声明为 Access 内部重跑 Scope 的永久豁免。

V3 同步更新范围固定为：

- §1.1 的“团队 Draft 读取使用 `:read_draft` Gate action”；
- §4 的 Draft read 调用图和 `policy_mode` 说明；
- §5.2 的 Article Core Draft read 契约；
- §12“重构完成后的验收”第 6 项。

这些位置只将调用入口从 Access 改为 Scope，不删除 `:read_draft` action，也不改变普通 `:read` 不授予 Draft 可见性的语义。

### Phase 1：Access Context 内部替换

1. 定义资源专属 `Gate.Context.Access.*`；
2. 让 `Access.Load` 的资源函数返回对应 Access Context struct；
3. 将 `Access.Policy` 的资源规则从 map pattern 改为 Access Context struct pattern；
4. 保持 `Gate.access_check/3` 和业务调用方不变；
5. 对 Access Context 缺失、资源错配和 Doc branch 缺失增加 focused tests；
6. 将资源准入入口统一为 `Access.Policy.article/comment/community`；
7. 删除 `evaluate`、`evaluate_result` 以及 policy 对无类型 map 的兼容 clause；
8. 由 `Access.Check` 私有地将 Policy 结果转换为 `Gate.Decision`，删除对外可调用的 `Access.decision/4`。

这一阶段按资源原子迁移 Load、Access Context 和 Policy。已迁移资源收到 map、未支持的 struct 或错误 Context 类型必须以 `unsupported_resource` fail closed，不得在 struct pattern 失败后退回 Article 路径。这一阶段不应修改业务 action、Lifecycle transition 或 Writer 的领域行为。

### Phase 2：Scope Context 完整定义与调用方迁移

1. 在 Phase 0 已有 Article/Doc 最小类型之上，补齐 Community、Comment、Document Scope Context，并补全 Article/Doc public constructor；
2. 原子实现 `Context.Scope.Comment.all_public()` 的 ordinary ArticleLifecycle 与 main DocLifecycle 两条查询路径，同时将 `CMS.Comments.List.paged_published_comments/3` 从 `%{}` 迁到该 constructor；两者不得拆成不同发布步骤；
3. 上一步完成后，Comment raw map adapter 对 `%{}`、缺少 `thread` 或显式 `thread: nil` 的输入 fail closed，不得自动转换为 `all_public()`；
4. 先迁移 Gate focused tests 和核心 Reader；
5. 再迁移 GraphQL、Press、Dashboard、Widget、Search、Feed 和后台任务；
6. 迁移 `Gate.scope/3` 调用方到显式资源 Scope Context，并删除 `Gate.scope/3`；
7. 将所有 `branch_policy: :main` 调用迁到 Doc、Document 或 Comment typed Context；
8. 清点所有 list/count/exists/publish caller；
9. 所有调用方迁移完成后，删除 raw map 支持。

Phase 0 的 raw map 兼容仍是现有透传路径，不是 map-to-typed adapter。进入 Phase 2 后，raw map 兼容才收口到 `Gate.Scope` 顶层：顶层根据 root schema 将合法 map 转换为对应 typed Scope Context，资源 compiler 从各自迁移开始只接受 Context struct。缺字段、未知字段、非法枚举和资源类型错配必须 fail closed，不得在 struct 校验失败后退回 map。Comment 迁移前暂时维持原实现；迁移 `Comment.all_public()` 时必须在同一个原子改动中替换 `%{}` 调用方，并让 adapter 从该改动起拒绝 `%{}`。adapter 任何时候都不得把 `%{}` 推断为跨 thread 查询。

过渡期 `Gate.scope/4` spec 接受 `map() | Gate.Context.Scope.t()`；全部调用方迁移完成后，spec 收紧为只接受 `Gate.Context.Scope.t()`。Scope Context 不能直接一次性 fail closed 后再等待调用方修复。删除 map 支持前，必须证明所有调用链已显式迁移，避免查询函数收到 `{:error, :scope_context_missing}` 后继续被当作 `Ecto.Query` 使用。

已知必须纳入 Phase 2 的调用方至少包括：

- `CMS.DocTree.Reader` 的 `Gate.scope/3` Community public read；
- `CMS.Articles.List`、`CMS.Comments.List`、`CMS.SearchArtiments.Indexer`、`CMS.SearchArtiments.Capacity` 和 `CMS.Snapshot` 的 `branch_policy: :main` 聚合读取；
- `CMS.Comments.List.paged_published_comments/3` 的无 thread Comment public read。

### Phase 3：内部 ownership 和命名收口

1. 已将 `CanCan.Communities` 迁为 `Communities.Enable`，旧 `Gate.Allow` 已删除；
2. 已将 Passport Registry、Assignment、Authorization 移出 Gate；
3. 已将 `Gate.PublishThrottle` 迁为 `Gate.RateLimit.Publish`；
4. 已将 `Scope.AncestorCommunity` 改名为 `Scope.CommunityChain`；
5. 已增加 `Scope.Registry`，集中 root schema 到 compiler 的映射；
6. 已按生产 ownership 移动并拆分对应测试，不改变原断言语义。

### Phase 4：契约收口

1. 对每个公开 action 建立资源/action/Context matrix；
2. 静态检查业务调用方只使用 `Gate.scope` 和 `Gate.access_check`；
3. 确认 Resolver、Writer 没有构造 Access Context；
4. 确认普通 Article 没有 Doc branch 字段；
5. 确认未知 action、未知 mode 和错误 Context 类型全部 fail closed；
6. 删除 raw map Scope adapter、旧模块、旧测试路径和所有 `Legacy` alias；
7. 更新 Gate V2/V3 的旧 Context 示例和索引入口。

## 7. 验收标准

V4 完成必须同时满足：

- mutation policy 不再接收无类型 map Context；
- 每种资源都有独立 Access Context；
- Doc 和普通 Article Access Context 明确分离；
- actor 只有一个来源；
- Access Context 不接受 caller-provided `policy_mode`；
- Access Context 只由 Gate 内部 `Access.Load` 构造；
- Scope Context 按 Community、Article、Doc、Comment、Document 分型；
- Scope mode 必须显式且仍校验 actor；
- `Gate.access_check/3` 公共签名不变；
- `Gate.access_check/4` 及 `:read_draft` Access 特例已删除；
- `:read_draft` 继续作为 Article/Doc Scope action，并通过一次 scoped fetch 完成 Draft read；
- `Gate.scope/3` 已删除，所有 Reader 显式传入资源 Scope Context；
- `Gate.scope/4` 的公开签名和 query-only 语义不变，第四个参数只接受资源专属 Scope Context；
- Doc/Document 的 `branch_id | branch_policy: :main` one-of 约束完整；
- Comment 的 Doc thread 只接受 `branch_policy: :main`，非 Doc thread 禁止任何 branch selector；
- 无 thread Comment 读取只通过 `Comment.all_public()`，并同时覆盖普通 ArticleLifecycle 与 main DocLifecycle；
- Lifecycle、Interaction、Writer 和 Audit ownership 不变；
- Context 缺失、类型错配和资源错配均 fail closed；
- focused Gate tests、相关 Reader tests 和调用方静态审计通过。

## 8. 非目标

V4 不处理：

- 新的通用 Command Framework；
- 新的 Policy DSL 或 rule engine；
- 将 domain action 压缩为通用 CRUD；
- 修改 Article/Doc Lifecycle 状态；
- 修改 Interaction 数据模型；
- 引入统一的 Resource/Lifecycle 基类；
- 将 Access Context 暴露到 GraphQL schema；
- 为未来插件开放任意 Context 注入能力。

如果未来需要 Command、插件或审核工作流，它们只能消费 Gate 的稳定公开接口，不能依赖或构造 Gate 内部 Access Context。

## 9. Gate 内部收口目标

V4 除了 Context 强类型化，还负责收口 Gate V2/V3 迁移后留下的内部命名和兼容层。当前额外存在 `read_draft` 专用的 `Gate.access_check/4`；该入口在 Phase 0 删除后，Gate 只保留两个产品级操作：

```elixir
Gate.scope(queryable, actor, action, scope_context)
Gate.access_check(actor, action, resource)
```

Gate 内部只保留四类能力：

```text
Gate
├── Access       单资源 mutation admission
├── Scope        read query compilation
├── RateLimit    Gate admission 使用的场景限频
└── Decision     稳定的准入结果和错误
```

Decision 只聚合内部 reason、去重并选择 primary，同时保留 Gate admission 所需的
结构化 violation 元数据。Gate 对外错误码由 `GroupherServer.CMS.Gate.ErrorCat` 声明，
由全局 `GroupherServer.ErrorCat` 校验并使用 `46xx` 作为 Gate admission 错误码段。
GraphQL/API 层负责错误 payload 投影和 Gettext
本地化，不再把 reason atom 转成大写字符串，也不在 CMS Gate 层硬编码中文用户文案。

Lifecycle、Passport 和 Community Enable 是 Gate 消费的权威事实来源，不是 Gate 的子模块：

| 模块                                           | 所有权              | Gate 如何使用                                  |
| ---------------------------------------------- | ------------------- | ---------------------------------------------- |
| `Communities/Articles/Docs/Comments.Lifecycle` | 各资源域            | 判断资源及祖先当前状态是否允许 action          |
| `CMS.Passport`                                 | Passport 权限域     | 判断 actor 的 role/permission                  |
| `CMS.Communities.Enable`                       | Community 产品配置  | 判断 thread、emotion、comment 等功能是否开启   |
| `CMS.Gate.RateLimit`                           | Gate 内部 admission | 判断 actor 是否超过某个 Gate action 的频率限制 |

## 10. 目标物理目录

以下是目标物理目录，不是调用关系图：

```text
cms/
│
├── gate.ex
├── gate/
│   ├── context/
│   │   ├── access.ex
│   │   ├── access/
│   │   │   ├── community.ex
│   │   │   ├── article.ex
│   │   │   ├── doc.ex
│   │   │   └── comment.ex
│   │   ├── scope.ex
│   │   └── scope/
│   │       ├── community.ex
│   │       ├── article.ex
│   │       ├── doc.ex
│   │       ├── comment.ex
│   │       └── document.ex
│   │
│   ├── access.ex
│   ├── access/
│   │   ├── policy.ex
│   │   ├── check/
│   │   │   ├── community.ex
│   │   │   ├── article.ex
│   │   │   └── comment.ex
│   │   ├── loader/
│   │   │   ├── community.ex
│   │   │   ├── article.ex
│   │   │   ├── comment.ex
│   │   │   └── queries.ex
│   │   ├── community.ex
│   │   ├── article.ex
│   │   ├── doc.ex
│   │   └── comment.ex
│   │
│   ├── scope.ex
│   ├── scope/
│   │   ├── policy.ex
│   │   ├── registry.ex
│   │   ├── community_chain.ex
│   │   ├── community.ex
│   │   ├── article.ex
│   │   ├── doc.ex
│   │   ├── comment.ex
│   │   └── document.ex
│   │
│   ├── rate_limit/
│   │   └── publish.ex
│   └── decision.ex
│
├── passport.ex
├── passport/
│   ├── registry.ex
│   ├── assignment.ex
│   └── authorization.ex
│
├── communities/
│   ├── lifecycle.ex
│   └── enable.ex
├── articles/
│   └── lifecycle.ex
├── docs/
│   └── lifecycle.ex
├── comments/
│   └── lifecycle.ex
│
└── model/
    ├── passport.ex
    ├── community_lifecycle.ex
    ├── community_lifecycle_blocker.ex
    ├── article_lifecycle.ex
    ├── doc_lifecycle.ex
    └── comment_lifecycle.ex
```

目录表达 ownership：各资源 Lifecycle 留在各自资源域；Passport 与 Gate 平级；只有访问检查使用的 RateLimit 留在 Gate 内部。

### 10.1 `@moduledoc` 要求

所有新增或迁移后的模块必须提供真实的 `@moduledoc`，不能使用 `@moduledoc false` 规避说明。至少覆盖：

- `Gate.Context.Access`、`Gate.Context.Scope` 及全部资源 Context；
- `Gate.Access`、`Gate.Access.Check`、`Gate.Access.Load`、`Gate.Access.Policy` 和 Access/Scope 边界；
- `Gate.Scope.Registry`、`Gate.Scope.CommunityChain` 和各资源 Scope compiler；
- `Gate.RateLimit.Publish`、`CMS.Passport.*`、`Communities.Enable` 等本次迁移模块。

每个 `@moduledoc` 必须说明：

1. 模块解决的具体问题；
2. ownership，以及明确不负责什么；
3. 谁构造、谁消费；
4. 与 Gate facade、Lifecycle、Passport 或 Reader/Command 的关系；
5. ASCII business-position flow。

Access Context 的 flow 至少表达：

```text
Gate.access_check
  -> Access.Load resource function
  -> Gate.Context.Access.*
  -> resource access policy
  -> Gate.Decision
```

Scope Context 的 flow 至少表达：

```text
Reader
  -> Gate.Context.Scope.*
  -> Gate.scope
  -> resource scope compiler
  -> Ecto.Query
```

Access facade 与 resource check flow 至少表达：

```text
CMS.Gate.access_check
  -> Gate.Access facade
  -> Access.Check.community/article/comment
  -> Access.Load + resource lock
  -> Access.Policy.community/article/comment
  -> Gate.Decision
```

`@moduledoc` 应描述稳定的业务位置和边界，不记录迁移过程、旧模块名或临时兼容实现。

## 11. Access 协议和命名

`CMS.Gate.Access` 是内部 facade，只负责稳定入口、资源分发，以及把不支持的输入类型转换为 fail-closed Decision；它不持有 Repo、锁、加载或资源 Policy。`Check`、`Load`、`Policy` 的函数都直接用资源名，避免 `Check.check`、`Loader.load` 这类模块名与函数名重复但仍未表达对象的命名。

```elixir
Access.Check.article(actor, action, article)
Access.Load.article(community, thread, article)
Access.Policy.article(actor, action, article, access_context)
```

内部调用链为：

```text
Gate.access_check(actor, action, resource)
  -> Gate.Access facade
  -> Access.Check.article/comment/community
  -> Access.Load + lock + typed Access Context
  -> Access.Policy.article/comment/community
  -> Gate.Decision
```

Access 检查编排按资源拆分：

```text
Access.Check.community
  -> Load.community
  -> Policy.community

Access.Check.article
  -> Repo community + FrontDesk thread
  -> Articles.MutationLock.with_article
  -> Load.article
  -> Policy.article

Access.Check.comment
  -> FrontDesk parent chain
  -> Articles.MutationLock.with_article
  -> Load.comment
  -> Policy.comment
```

私有检查使用具体名称，例如：

```text
check_lifecycle
check_community_access
check_branch_access
check_action_state
check_passport
```

`CMS.Gate.Access` 不应再同时暴露 `evaluate`、`evaluate_result` 和 `decision` 三层近义协议，也不应在单资源 mutation access check 中重新调用 Scope 查询来代替 Access Context 检查。

资源 `Policy.article/comment/community` 只返回 `:ok | {:error, reason}`。对应的
`Access.Check` 负责在唯一的资源编排路径将结果交给 `Gate.Decision` 构造
grant/deny 结果；`Gate.Access` 只为分发前的 `unsupported_resource` 构造拒绝结果，
不参与已支持资源的 Decision 编排，也不下沉到各资源 Policy。

### 11.1 资源加载

Access Context 包含 Gate 专属的权威事实。锁定 Lifecycle、校验 resource/ancestor identity、选择 DocBranch、区分 ArticleLifecycle 与 DocLifecycle，并保证缺失事实 fail closed，均由 `Access.Load` 完成：

```text
Gate.Access.Load
├── community(resource) -> Context.Access.Community
├── article(community, thread, resource)
│   ├── thread in Article threads -> Context.Access.Article
│   └── thread == :doc            -> Context.Access.Doc
└── comment(community, thread, article, resource) -> Context.Access.Comment
```

`Load.article/3` 按 thread 在 Article Context 与 Doc Context 之间分派；`Load.comment/4`
组合父级 Article/Doc Context 后返回 Comment Context。资源加载只能由
Gate 内部调用。

## 12. Scope 协议和 CommunityChain

每个资源 Scope compiler 实现同一个 behavior：

```elixir
defmodule GroupherServer.CMS.Gate.Scope.Policy do
  @callback scope(
              query :: Ecto.Query.t(),
              actor :: term(),
              action :: atom(),
              scope_context :: struct()
            ) :: Ecto.Query.t() | {:error, atom()}
end
```

`Scope.Registry` 负责从 root schema 选择 Community、Article、Doc、Comment 或 Document compiler，并校验对应的 `Gate.Context.Scope.*` 类型。behavior 只统一调用协议，不把各资源 Scope Context 合并为一个通用 struct。

原 `Scope.AncestorCommunity` 已收口为 `Scope.CommunityChain`。它负责为 Article、Doc、Comment 和 Document 查询构造共同的 Community 祖先查询链：

```text
child resource
  -> resource/article relation
  -> Community
  -> CommunityLifecycle
  -> Community read policy
```

`Scope.Community` 处理以 Community 为 root 的查询；`Scope.CommunityChain` 处理子资源查询需要的 Community join chain。二者不能合并。

## 13. Enable、Passport、CanCan 和 RateLimit

### 13.1 Community Enable

原 `CanCan.Communities` 承载的 thread、emotion 和 comment 配置不是完整 authorization，而是 Community 产品开关。目标模块为：

```elixir
Communities.Enable.thread?(community, thread)
Communities.Enable.emotion?(community, scope, thread, emotion)
Communities.Enable.comment?(article)
Communities.Enable.emotions(community, scope, thread)
```

当前已删除旧兼容层：

```text
CMS.CanCan
CMS.CanCan.Communities
CMS.Gate.Allow
CMS.Gate.Allow.Community
```

### 13.2 Passport

旧的 `Gate.Passport.Registry -> Helper.PermissionRegistry` 和 `Gate.Passport -> Communities.Passport`
迁移适配层已删除。Passport 被 GraphQL middleware、Accounts、Content Import、Community
moderator 和 Gate 共同使用，因此其 ownership 不属于 Gate。

目标边界为：

```text
CMS.Passport
├── Registry         rule 定义、requirement、normalize 和 validation
├── Assignment       get、stamp、erase 和 delete
└── Authorization    allowed?
```

Gate 只消费 `Passport.Authorization`，当前不再存在 `Gate.Passport`、
`Gate.Passport.Registry` 或 `as: Legacy`。

### 13.3 Gate RateLimit

RateLimit 目前只服务 Gate admission，因此保留在 Gate 内部：

```text
CMS.Gate.RateLimit.Publish
├── check(actor, options)
└── record(actor)
```

`check` 由 publish 的 `Gate.access_check` 路径组合；`record` 在 publish command 成功后调用。它是内部集成 seam，不增加第三个 Gate facade 入口。后续若引入原子 reservation/consume，应继续保持相同 ownership，不把计数状态混入 Lifecycle。

迁移对应关系为：

```text
Gate.PublishThrottle              -> Gate.RateLimit.Publish
Policy.PublishThrottle 的计数实现 -> Gate.RateLimit.Publish 内部 store/recorder
policy/publish_throttle_test.exs   -> gate/rate_limit/publish_test.exs
```

所有调用方和测试已经迁移，`Gate.PublishThrottle`、`Policy.PublishThrottle` 兼容入口及旧测试路径已删除；数据库表是否改名不属于本次模块收口的必要条件。

## 14. 测试目录和迁移

### 14.1 迁移前结构

当前 Gate 测试主要集中在两个大文件：

```text
test/groupher_server/cms/
├── gate_test.exs                 facade、Access、Decision、Allow、Passport 混合测试
├── gate/
│   └── scope_test.exs           所有资源 Scope compiler 的混合测试
├── can_can/
│   └── communities_test.exs     thread/emotion enable 测试
├── communities/
│   └── passport_test.exs        Passport assignment/storage 测试
└── policy/
    └── publish_throttle_test.exs
```

迁移前的问题与实现目录相同：`gate_test.exs` 同时覆盖 facade、Community/Article/Comment Access、Decision、Allow 和 Passport；`scope_test.exs` 同时覆盖 Community、Article、Doc、Comment、Document、SQL composition 和 query-count 行为。失败时难以直接定位 ownership。

### 14.2 目标测试结构

当前实现已按下列 ownership 拆分 facade、Access、Scope 和 RateLimit；其中仍保留的
`gate_test.exs` 与 `scope_test.exs` 只承载未再拆出的跨资源组合/集成行为，不再承载
所有资源的全部单元测试。

测试目录应镜像生产模块的职责层级，而不是机械地为每个私有函数创建测试文件：

```text
test/groupher_server/cms/
│
├── gate_test.exs
├── gate/
│   ├── context/
│   │   ├── access/
│   │   │   ├── community_test.exs
│   │   │   ├── article_test.exs
│   │   │   ├── doc_test.exs
│   │   │   └── comment_test.exs
│   │   └── scope/
│   │       ├── community_test.exs
│   │       ├── article_test.exs
│   │       ├── doc_test.exs
│   │       ├── comment_test.exs
│   │       └── document_test.exs
│   │
│   ├── access_test.exs
│   ├── access/
│   │   ├── loader/
│   │   │   ├── community_test.exs
│   │   │   ├── article_test.exs
│   │   │   ├── doc_test.exs
│   │   │   └── comment_test.exs
│   │   ├── community_test.exs
│   │   ├── article_test.exs
│   │   ├── doc_test.exs
│   │   └── comment_test.exs
│   │
│   ├── scope_test.exs
│   ├── scope/
│   │   ├── community_test.exs
│   │   ├── community_chain_test.exs
│   │   ├── article_test.exs
│   │   ├── doc_test.exs
│   │   ├── comment_test.exs
│   │   └── document_test.exs
│   │
│   ├── rate_limit/
│   │   └── publish_test.exs
│   └── decision_test.exs
│
├── passport/
│   ├── registry_test.exs
│   ├── assignment_test.exs
│   └── authorization_test.exs
│
└── communities/
    └── enable_test.exs
```

测试职责如下：

| 测试                                  | 只覆盖                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| `gate_test.exs`                       | facade 只暴露 `scope`、`access_check`，并正确 dispatch                  |
| `gate/context/access/*_test.exs`      | Access Context 的 required fields、资源分型和 struct 契约               |
| `gate/context/scope/*_test.exs`       | Scope Context constructor、合法组合、类型错配和 fail closed             |
| `gate/access_test.exs`                | Load dispatch、Policy dispatch、unsupported resource、Decision 转换     |
| `gate/access/load/*_test.exs`         | resource/ancestor 定位、锁定、identity 校验和 typed Access Context 构造 |
| `gate/access/*_test.exs`              | 对应资源的 action/state/actor admission matrix                          |
| `gate/scope_test.exs`                 | root schema dispatch、未知 root/action fail closed                      |
| `gate/scope/*_test.exs`               | 对应资源的 SQL policy 和 actor/mode matrix                              |
| `gate/scope/community_chain_test.exs` | reserved joins、Community/Lifecycle chain 和 binding conflict           |
| `gate/rate_limit/publish_test.exs`    | interval/hour/day 限制以及成功记账                                      |
| `gate/decision_test.exs`              | reason 聚合、primary reason、46xx 错误码和 public error                 |
| `passport/*_test.exs`                 | Registry、Assignment、Authorization 各自 ownership                      |
| `communities/enable_test.exs`         | thread、emotion、comment 产品开关                                       |

迁移测试文件时不改变断言语义。先按职责移动现有测试，再补 V4 typed Access/Scope Context 和 behavior contract 测试；不能用一次性重写测试掩盖行为变化。
